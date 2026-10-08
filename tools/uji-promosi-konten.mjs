/*
 * tools/uji-promosi-konten.mjs — guard for app/utils/promosi-konten.ts.
 *
 *   node tools/uji-promosi-konten.mjs      (Node 24: imports the .ts directly)
 *
 * The money rules that fail SILENTLY (docs/migrasi/konten.md F.15–F.20):
 *   - an ad's spending lands in its START month, all expenses at once, with a
 *     fallback chain and a no-date bucket (never dropped);
 *   - spending includes 11% VAT;
 *   - cost per chat is null when chats OR spending is 0, and null sinks;
 *   - the combined cost per chat counts only ads that produced chats;
 *   - per video: same link once tidied = one video; links without protocol
 *     are fixed, non-links rejected; video platform read from the host;
 *   - status from dates never touches a manual "paused";
 *   - starting price history only on a change, max 60.
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('~/')) {
    const url = new URL('../app/' + spec.slice(2) + (spec.endsWith('.ts') ? '' : '.ts'), ${JSON.stringify(import.meta.url)})
    return next(url.href, ctx)
  }
  return next(spec, ctx)
}`))
const P = await import('../app/utils/promosi-konten.ts')

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket) => {
  if (syarat) {
    ok++
    console.log('  OK    ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket ? '  — ' + ket : ''))
  }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('\npromosi: dana iklan')
const a1 = { id: 'a1', name: 'Promo A', startDate: '2026-09-28', expenses: [{ date: '2026-10-02', amount: 1000000 }, { date: '2026-10-05', amount: '2000000' }], chats: 30, videoUrl: 'instagram.com/reel/x', platform: 'Meta Ads' }
cek('dana keluar = Σ rincian + PPN 11%', P.danaKeluarIklan(a1) === 3330000)
cek('data lama tanpa rincian → spend datar', P.danaKeluarIklan({ spend: 500000 }) === 500000 && P.danaKeluarIklan(null) === 0)
cek('bulan = tanggal MULAI, bukan tanggal rincian', P.bulanIklan(a1) === '2026-09')
cek('cadangan: createdDate → createdAt → rincian pertama', P.tglDanaIklan({ createdDate: '2026-07-04' }) === '2026-07-04'
&& P.tglDanaIklan({ createdAt: Date.parse('2026-06-10T05:00:00Z') }) === '2026-06-10'
&& P.tglDanaIklan({ expenses: [{ amount: 1 }, { date: '2026-05-02', amount: 2 }] }) === '2026-05-02')
cek('tanpa tanggal apa pun → keranjang "Belum ada tanggal mulai"', P.bulanIklan({ spend: 9 }) === P.ADS_TANPA_TGL && P.labelBulanIklan(P.ADS_TANPA_TGL) === 'Belum ada tanggal mulai')
cek('penanda cadangan hanya bila startDate kosong', P.iklanPakaiCadangan({ createdDate: '2026-07-04' }) && !P.iklanPakaiCadangan(a1) && !P.iklanPakaiCadangan({}))
const funds = [{ id: 'f1', date: '2026-09-02', amount: 5000000, brand: 'b1', note: 'Top-up, termin 1' }, { id: 'f2', date: '2026-10-01', amount: 1000000 }, { id: 'f3', amount: 7 }]
const rek = P.rekapBulanIklan(funds, [a1, { id: 'x', spend: 200000 }, { id: 'nol', startDate: '2026-10-01' }])
cek('rekap: seluruh dana keluar 1 iklan di bulan mulainya; terbaru di atas', sama(rek.map(r => r.ym), ['2026-10', '2026-09', P.ADS_TANPA_TGL]) && rek[1].out === 3330000 && rek[1].in === 5000000)
cek('rekap: iklan tanpa tanggal TIDAK dibuang (keranjang)', rek[2].out === 200000)
cek('rekap: dana masuk tanpa tanggal tidak ikut, iklan Rp0 tidak melahirkan bulan', rek[0].in === 1000000 && rek[0].out === 0)

console.log('\npromosi: status otomatis')
cek('selesai lewat → ended', P.statusIklanOtomatis({ status: 'active', startDate: '2026-09-01', endDate: '2026-09-30' }, '2026-10-08') === 'ended')
cek('sudah mulai → active', P.statusIklanOtomatis({ status: 'draft', startDate: '2026-10-01' }, '2026-10-08') === 'active')
cek('mulai HARI INI sudah active (bukan besok)', P.statusIklanOtomatis({ status: 'draft', startDate: '2026-10-08' }, '2026-10-08') === 'active')
cek('belum mulai → draft', P.statusIklanOtomatis({ status: 'active', startDate: '2026-10-20' }, '2026-10-08') === 'draft')
cek('dijeda manual tidak diganggu', P.statusIklanOtomatis({ status: 'paused', startDate: '2026-09-01', endDate: '2026-09-02' }, '2026-10-08') === null)
cek('tidak berubah → null', P.statusIklanOtomatis({ status: 'active', startDate: '2026-10-01' }, '2026-10-08') === null && P.statusIklanOtomatis({ status: 'draft' }, '2026-10-08') === null)

console.log('\npromosi: video & chat')
cek('link tanpa protokol dirapikan; bukan link → null; kosong → ""', P.rapikanVideo('instagram.com/reel/x') === 'https://instagram.com/reel/x' && P.rapikanVideo('reel promo') === null && P.rapikanVideo('  ') === '')
cek('platform video dari host, bukan platform iklan', P.platformVideo('https://www.instagram.com/reel/x') === 'Instagram' && P.platformVideo('fb.watch/abc') === 'Facebook' && P.platformVideo('https://vimeo.com/1') === 'vimeo.com' && P.platformVideo('') === null)
cek('biaya per chat = dana ÷ chat', P.biayaChat(a1) === 111000)
cek('chat 0 atau dana 0 → null (bukan ∞, bukan Rp0)', P.biayaChat({ chats: 0, spend: 100 }) === null && P.biayaChat({ chats: 9 }) === null)
const b2 = { id: 'b2', name: 'Budget Besar', chats: 100, spend: 20000000, videoUrl: 'https://instagram.com/reel/x', platform: 'Meta Ads' }
const c3 = { id: 'c3', name: 'Awareness', chats: 0, spend: 9000000, platform: 'TikTok Ads' }
const d4 = { id: 'd4', name: 'A tanpa dana', chats: 12 }
const r = P.rekapChat([a1, b2, c3, d4])
cek('total chat & dana keluar HANYA iklan berchat', r.totChats === 142 && r.totDana === 23330000)
cek('biaya gabungan = dana berchat ÷ chat', Math.round(r.bpc) === Math.round(23330000 / 142))
cek('chat tanpa dana disebut, tidak ikut peringkat termurah', r.tanpaDana.length === 1 && !r.bisaMurah.includes(d4))
cek('top chat vs top termurah bisa beda', r.topChat.id === 'b2' && r.topMurah.id === 'a1')
const vid = r.perVideo.find(v => v.url === 'https://instagram.com/reel/x')
cek('per video: tautan sama (sesudah dirapikan) digabung', vid && vid.n === 2 && vid.chats === 130)
cek('iklan tanpa link berdiri di barisnya sendiri, di bawah', r.perVideo.at(-1).url === '' && r.perVideo.at(-1).n === 2)
cek('top video hanya yang punya link & chat', r.topVideo.url === 'https://instagram.com/reel/x')
cek('per platform iklan', sama(r.perPlat.map(p => [p.key, p.n, p.chats]), [['Meta Ads', 2, 130], ['(tanpa platform)', 1, 12], ['TikTok Ads', 1, 0]]))
cek('urut termurah: tanpa nilai SELALU di bawah', sama(P.urutChat([d4, b2, a1], 'murah').map(a => a.id), ['a1', 'b2', 'd4']))
cek('urut chat terbanyak & dana terbesar', sama(P.urutChat([a1, b2, d4], 'chats').map(a => a.id), ['b2', 'a1', 'd4']) && sama(P.urutChat([a1, b2, c3], 'dana').map(a => a.id), ['b2', 'c3', 'a1']))

console.log('\npromosi: KOL & kunjungan')
const k1 = { id: 'k1', name: 'Rina Foodie', type: 'KOL', instagram: 'rina', category: 'Food & Beverage', rateValue: 1500000, rateHistory: [{ value: 1500000, prev: 0, at: 1, by: 'x' }] }
cek('niche lama tunggal terbaca', sama(P.kolCats(k1), ['Food & Beverage']) && P.kolType({}) === 'KOL')
cek('harga sama → riwayat tidak bertambah', P.riwayatRate(k1, 1500000, 'Saya').length === 1)
const h2 = P.riwayatRate(k1, 2000000, 'Saya', 9)
cek('harga berubah → entri baru di depan, dengan harga lama', h2.length === 2 && h2[0].value === 2000000 && h2[0].prev === 1500000 && h2[0].by === 'Saya' && P.rateDelta(h2[0]) === 500000)
cek('riwayat dibatasi 60', P.riwayatRate({ rateValue: 1, rateHistory: Array.from({ length: 60 }, () => ({ value: 1 })) }, 2, 'x').length === 60)
cek('nomor WA 08… → 628…', P.nomorWaKol('0812-345') === '62812345' && P.linkWaKol('') === '')
const kols = [k1, { id: 'k2', name: 'Batam Info', type: 'Media Partner', categories: ['Lifestyle', 'Food & Beverage'] }, { id: 'k3', name: 'Andi DJ', categories: ['DJ'], tiktok: 'andidj' }]
cek('saring: cari IG/TikTok/niche, tipe, niche; urut nama', sama(P.saringKol(kols, { q: 'andidj', type: '', category: '' }).map(k => k.id), ['k3'])
&& sama(P.saringKol(kols, { q: '', type: 'Media Partner', category: '' }).map(k => k.id), ['k2'])
&& sama(P.saringKol(kols, { q: '', type: '', category: 'Food & Beverage' }).map(k => k.id), ['k2', 'k1']))
cek('niche yang dipakai + jumlahnya', sama(P.nicheKol(kols), [{ c: 'DJ', n: 1 }, { c: 'Food & Beverage', n: 2 }, { c: 'Lifestyle', n: 1 }]))
const visits = [{ id: 'v1', title: 'Launching', date: '2026-10-20', invitees: ['k1', 'k2'] }, { id: 'v2', title: 'Lama', date: '2026-10-10', kolId: 'k3', status: 'came' }]
cek('undangan lama (kolId) terbaca', sama(P.undanganVisit(visits[1]), ['k3']))
const nama = id => kols.find(k => k.id === id)?.name ?? ''
cek('saring kunjungan: cari nama undangan, status, KOL; urut tanggal', sama(P.saringVisit(visits, { q: 'andi', status: '', kol: '' }, nama).map(v => v.id), ['v2'])
&& sama(P.saringVisit(visits, { q: '', status: '', kol: 'k1' }, nama).map(v => v.id), ['v1'])
&& sama(P.saringVisit(visits, P.filterVisitBawaan(), nama).map(v => v.id), ['v2', 'v1']))
const msg = P.pesanUndangan({ title: 'Launching', time: '13:00', location: 'Outlet Pusat' }, 'Rina', '20 Okt 2026')
cek('template undangan memuat nama, acara, jam WIB, lokasi', msg.startsWith('Halo Rina!') && msg.includes('Launching') && msg.includes('13:00 WIB') && msg.includes('Outlet Pusat'))

console.log('\npromosi: ekspor CSV')
const csv = P.csvBulanIklan('2026-09', funds, [a1, { id: 'old', name: 'Lama', startDate: '2026-09-10', spend: 400000 }], id => (id === 'b1' ? 'LM' : ''))
const baris = csv.split('\n')
cek('kepala + dana masuk + 2 rincian + iklan datar', baris.length === 5 && baris[0].startsWith('Tipe,Tanggal'))
cek('sel berkoma dikutip', baris[1] === 'Dana Masuk,2026-09-02,LM,"Top-up, termin 1",,5000000,0,5000000')
cek('rincian memakai tanggalnya sendiri + pajak per rincian', baris[2] === 'Dana Keluar,2026-10-02,,Promo A,,1000000,110000,1110000')
cek('bulan kosong → null (tidak mengunduh berkas kosong)', P.csvBulanIklan('2026-01', funds, [a1], () => '') === null)

console.log(`\n${ok} OK, ${gagal} GAGAL\n`)
process.exit(gagal ? 1 : 0)
