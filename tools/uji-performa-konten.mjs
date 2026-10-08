/*
 * tools/uji-performa-konten.mjs — guard for app/utils/performa-konten.ts.
 *
 *   node tools/uji-performa-konten.mjs      (Node 24: imports the .ts directly)
 *
 * The rules that fail SILENTLY (docs/migrasi/konten.md F.4–F.11): every wrong
 * version still prints a plausible percent.
 *   - one denominator: reach, else impression, else null (never 0);
 *   - Virality = shares + saves only; CTA counted ONCE (the old build once
 *     made it 4x);
 *   - aggregates sum first, divide later — not the mean of percents;
 *   - a post on two platforms is one post; the old flat `metrics` is one
 *     "(catatan lama)" row, never split, never in the per-platform table;
 *   - the month is publishRecord.at first, then publishDate; design months in
 *     fixed WIB;
 *   - no-value rows sink when sorting;
 *   - Input Performa: tab counts before the tab filter, first filler kept,
 *     clearing a filled platform = "hapus" (not yet possible in v1, G-01).
 */
import { register } from 'node:module'

// `~/x` → app/x (the Nuxt alias the util uses for its import of konten.ts)
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('~/')) {
    const url = new URL('../app/' + spec.slice(2) + (spec.endsWith('.ts') ? '' : '.ts'), ${JSON.stringify(import.meta.url)})
    return next(url.href, ctx)
  }
  return next(spec, ctx)
}`))
const P = await import('../app/utils/performa-konten.ts')

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
const dekat = (a, b) => a != null && Math.abs(a - b) < 1e-9

console.log('\nperforma-konten: angka & rumus')
cek('angka diketik: pemisah ribuan dibuang, minus & huruf → 0, desimal dibulatkan',
  P.pkAngka('1.234') === 1234 && P.pkAngka(-5) === 0 && P.pkAngka('abc') === 0 && P.pkAngka(12.6) === 13 && P.pkAngka(null) === 0)
cek('penyebut: reach dulu', sama(P.pkDasar({ reach: 200, impr: 500 }), { n: 200, dari: 'reach' }))
cek('penyebut: impression kalau reach kosong', sama(P.pkDasar({ impr: 500 }), { n: 500, dari: 'impr' }))
cek('tanpa penyebut → null, BUKAN 0', P.pkER({ likes: 10 }) === null && P.pkViral({ shares: 1 }) === null && P.pkCTR({ cta: 1 }) === null)
const m1 = { reach: 1000, likes: 30, comments: 10, shares: 5, saves: 5, cta: 10 }
cek('ER = (likes+komentar+share+save) ÷ reach', dekat(P.pkER(m1), 5))
cek('Virality = (share+save) ÷ reach, tanpa like/komentar', dekat(P.pkViral(m1), 1))
cek('CTA = klik ÷ reach', dekat(P.pkCTR(m1), 1))
cek('persen satu desimal, format Indonesia', P.pkPersen(4.75) === '4,8' && P.pkPersen(null) === '0,0')

console.log('\nperforma-konten: baris per platform')
const c1 = { id: 'c1', title: 'Promo A', status: 'Posted', platforms: ['IG', 'TikTok'], pillar: 'Promotion',
  publishDate: '2026-08-28', publishRecord: { at: '2026-09-02T03:00:00.000Z' },
  perf: { IG: { reach: 1000, likes: 30, comments: 10, shares: 5, saves: 5, cta: 10, at: 5, by: 'Ana' },
    TT: { reach: 4000, likes: 100 }, FB: { reach: 50, likes: 1 }, YT: { at: 9, by: 'x' } } }
const b1 = P.pkBarisKonten(c1)
cek('satu baris per platform terdaftar, alias TikTok → TT', sama(b1.filter(r => !r.lepas).map(r => r.plat), ['IG', 'TT']))
cek('platform yang sudah tidak terdaftar tapi terisi TETAP ikut (lepas)', b1.some(r => r.plat === 'FB' && r.lepas))
cek('catatan kosong (hanya jejak at/by) tidak dihitung', !b1.some(r => r.plat === 'YT'))
cek('jejak pengisi ikut terbaca', b1[0].at === 5 && b1[0].by === 'Ana')
const lamaC = { id: 'l', status: 'Posted', metrics: { reach: 300, likes: 9, followers: 4 } }
const bl = P.pkBarisKonten(lamaC)
cek('metrics LAMA = satu baris "(catatan lama)", follower dari `followers`', bl.length === 1 && bl[0].warisan && bl[0].plat === P.PK_WARISAN && bl[0].m.follow === 4)
cek('metrics lama diabaikan kalau sudah ada angka per platform', !P.pkBarisKonten({ ...c1, metrics: { reach: 9 } }).some(r => r.warisan))
cek('bulan tayang dari publishRecord.at dulu, baru publishDate', P.pkBulanKonten(c1) === '2026-09' && P.pkBulanKonten({ publishDate: '2026-08-28' }) === '2026-08')

console.log('\nperforma-konten: agregat')
const kecil = { id: 'k', title: 'Kecil', status: 'Posted', platforms: ['IG'], pillar: 'Event', publishDate: '2026-09-05',
  perf: { IG: { reach: 100, likes: 50 } } }
const besar = { id: 'b', title: 'Besar', status: 'Posted', platforms: ['IG'], pillar: 'Event', publishDate: '2026-09-06',
  perf: { IG: { reach: 100000, likes: 1000 } } }
const kAgg = P.pkKumpul([kecil, besar], {})
const tAgg = P.pkTotal(kAgg)
cek('dijumlahkan dulu baru dibagi (1050 ÷ 100.100), BUKAN rata-rata persen (25,5%)', dekat(P.pkAggER(tAgg), 1050 / 100100 * 100))
const kc = P.pkKumpul([{ id: 'x', status: 'Posted', platforms: ['IG'], publishDate: '2026-09-01', perf: { IG: { reach: 1000, cta: 10 } } }], {})
cek('CTA tidak digandakan di agregat (1,0%, bukan 2,0% / 4,0%)', dekat(P.pkAggCTR(P.pkTotal(kc)), 1))
const draft = { id: 'd', status: 'Scheduled', platforms: ['IG'], perf: { IG: { reach: 999 } } }
const kosong = { id: 'z', status: 'Posted', platforms: ['IG'], publishDate: '2026-09-09' }
const semua = [c1, kecil, besar, draft, kosong, lamaC]
const kS = P.pkKumpul(semua, { bulan: '2026-09' })
cek('hanya Posted; yang belum diisi dihitung (tanpaData)', kS.tayang === 5 && kS.tanpaData === 1 && !kS.konten.some(x => x.c.id === 'd'))
cek('bulan yang ADA dikumpulkan dari seluruh konten tayang, bukan yang lolos tapis', !!P.pkKumpul([c1, { ...kecil, publishDate: '2026-07-01' }], { bulan: '2026-09' }).bulanAda['2026-07'])
cek('tapis bulan memakai bulan TAYANG (Promo A ikut September)', kS.konten.some(x => x.c.id === 'c1'))
cek('kartu: n = jumlah KONTEN, bukan baris platform', P.pkTotal(kS).n === 3 && kS.baris.length === 5)
const perPlat = P.pkPerPlatform(P.pkKumpul([c1, lamaC], {}).baris)
cek('per platform: catatan lama TIDAK berdiri sebagai platform', !perPlat.some(p => p.nama === P.PK_WARISAN) && perPlat.length === 3)
cek('per platform diurut reach terbesar', perPlat[0].nama === 'TT')
const perPil = P.pkPerPillar(P.pkKumpul([c1, kecil, besar, { ...kecil, id: 'np', pillar: '' }], {}).konten)
cek('per pillar: konten 2 platform dihitung SEKALI', perPil.find(p => p.nama === 'Promotion').a.n === 1)
cek('pillar kosong → "(tanpa pillar)", tidak ditebak', perPil.some(p => p.nama === P.PK_TANPA_PILLAR))
cek('tapis platform', sama(P.pkKumpul([c1], { plat: 'TT' }).baris.map(r => r.plat), ['TT']))
cek('cari judul / pillar / platform', P.pkKumpul([c1, kecil], { cari: 'promotion' }).konten.length === 1 && P.pkKumpul([c1, kecil], { cari: 'tt' }).konten.length === 1)

console.log('\nperforma-konten: urutan')
const u = [
  { c: { title: 'A null' }, agg: P.pkTambah(P.pkKosongAgg(), P.pkRapikan({ likes: 5 })) },
  { c: { title: 'B nol' }, agg: P.pkTambah(P.pkKosongAgg(), P.pkRapikan({ reach: 100, likes: 5 })) },
  { c: { title: 'C viral' }, agg: P.pkTambah(P.pkKosongAgg(), P.pkRapikan({ reach: 100, shares: 5 })) },
]
cek('diurut Virality: tanpa nilai SELALU di bawah, nol sungguhan di atasnya', sama(P.pkUrutKonten(u, 'viral').map(x => x.c.title), ['C viral', 'B nol', 'A null']))
cek('urut menghasilkan SALINAN', P.pkUrutKonten(u, 'viral') !== u && u[0].c.title === 'A null')

console.log('\nperforma-konten: jumlah post')
const jp = P.pkHitungPost([c1, kecil, { ...kecil, id: 'tp', platforms: [], contentTypes: ['Reel', 'Story'] }], { bulan: '2026-09' })
cek('konten 2 platform dihitung di keduanya; total = konten unik', jp.n === 3 && jp.plat.IG === 2 && jp.plat.TT === 1)
cek('tanpa platform/tipe tidak dibuang', jp.plat[P.PK_TANPA_PLAT] === 1 && jp.tipe[P.PK_TANPA_TIPE] === 2 && jp.tipe.Reel === 1)

console.log('\nperforma-konten: desain')
const dk = [
  { id: 'd1', title: 'Poster', brand: 'b', pillar: 'Event', contentTypes: ['Reel', 'Story'], printTypes: ['A4'], prod: { design: { status: 'done', doneAt: Date.parse('2026-08-31T18:00:00Z'), date: '2026-08-30' } } },
  { id: 'd2', title: 'Belum', prod: { design: { status: 'todo' } } },
  { id: 'd3', title: 'Lama', prod: { design: { status: 'done', date: '2026-07-15' } } },
]
const dt = [{ id: 't1', kind: 'design', status: 'done', title: 'Banner', date: '2026-09-03', doneAt: 0 }, { id: 't2', kind: 'shoot', status: 'done' }]
const rows = P.pkDesainRows(dk, dt)
cek('dua sumber: konten desain selesai + tugas desain mandiri selesai', sama(rows.map(r => r.id), ['d1', 'd3', 't1']))
cek('tugas mandiri: kategori "(tanpa kategori)", tidak ditebak', rows[2].pillar === P.PK_TANPA_KAT && rows[2].src === 'mandiri')
cek('bulan selesai dari doneAt, WIB tetap (18:00Z 31 Agu = September)', P.pkBulanDesain(rows[0]) === '2026-09')
cek('tanpa doneAt → tanggal deadline desain', P.pkBulanDesain(rows[1]) === '2026-07')
const kat = P.pkDesainKategori(rows, 'tipe')
cek('jenis ganda dihitung di TIAP jenis + disebut', kat.ganda === 1 && kat.list.find(x => x.nama === 'Reel').n === 1 && kat.list.find(x => x.nama === 'Story').n === 1)
cek('kategori kosong dikumpulkan, dari konten vs mandiri dipisah', kat.list.find(x => x.nama === P.PK_TANPA_KAT).konten === 1 && kat.list.find(x => x.nama === P.PK_TANPA_KAT).mandiri === 1)
const bd = P.pkBandingDesain(P.pkKumpul([{ ...kecil, prod: { design: { status: 'done' } } }, besar], {}))
cek('berdesain vs tanpa desain dipisah', bd.pakai.n === 1 && bd.tanpa.n === 1 && bd.pakai.dasar === 100)
cek('request Marketing: doneAt ISO UTC → bulan WIB; tanpa doneAt → deadline',
  P.pkBulanMkt({ doneAt: '2026-08-31T20:00:00+00:00' }) === '2026-09' && P.pkBulanMkt({ deadline: '2026-07-04' }) === '2026-07' && P.pkBulanMkt({ doneAt: '' }) === '')
cek('nama bulan', P.pkNamaBulan('2026-09') === 'September 2026' && P.pkNamaBulan('') === 'Semua bulan')

console.log('\nperforma-konten: Input Performa')
const pi = [
  { id: 'p1', title: 'Lengkap', status: 'Posted', platforms: ['IG'], publishDate: '2026-09-01', perf: { IG: { reach: 5 } } },
  { id: 'p2', title: 'Separuh', status: 'Posted', platforms: ['IG', 'TT'], publishDate: '2026-09-03', perf: { IG: { reach: 5 } } },
  { id: 'p3', title: 'Lama saja', status: 'Posted', platforms: ['IG'], publishDate: '2026-09-02', metrics: { reach: 9 } },
  { id: 'p4', title: 'Tanpa platform', status: 'Posted', publishDate: '2026-08-01' },
  { id: 'p5', title: 'Belum tayang', status: 'Scheduled', platforms: ['IG'] },
]
const pr = P.perfBaris(pi)
cek('hanya Posted, terbaru di atas', sama(pr.map(r => r.c.id), ['p2', 'p3', 'p1', 'p4']))
cek('lengkap = semua platform terdaftar terisi; catatan lama tidak dihitung terisi', pr.find(r => r.c.id === 'p1').lengkap && !pr.find(r => r.c.id === 'p2').lengkap && !pr.find(r => r.c.id === 'p3').lengkap && pr.find(r => r.c.id === 'p3').warisan)
cek('tanpa platform tidak pernah lengkap', !pr.find(r => r.c.id === 'p4').lengkap)
const h = P.perfHitung(pr)
cek('hitungan tab dari daftar SEBELUM tapis tab', h.semua === 4 && h.belum === 3 && h.lengkap === 1 && h.tanpaPlat === 1)
cek('tapis tab + cari', P.perfSaring(pr, { isi: 'lengkap', q: '' }).length === 1 && P.perfSaring(pr, { isi: '', q: 'separuh' }).length === 1 && P.perfSaring(pr, P.filterPerfBawaan()).length === 3)
const cp = { id: 'q', platforms: ['IG', 'TT', 'YT'], perf: { IG: { reach: 5, at: 100, by: 'Ana' }, TT: { reach: 7, firstAt: 50, firstBy: 'Budi', at: 90, by: 'Cici' }, YT: { at: 1, by: 'x' } } }
const rc = P.perfRencana(cp, { IG: { reach: '1.200', likes: '' }, TT: {}, YT: {} }, 'Saya', 777)
cek('kirim angka yang terisi; pengisi PERTAMA dipertahankan', rc.kirim.IG.reach === 1200 && rc.kirim.IG.firstAt === 100 && rc.kirim.IG.firstBy === 'Ana')
cek('platform terisi lalu dikosongkan seluruhnya → hapus (bukan kirim nol)', sama(rc.hapus, ['TT']) && !rc.kirim.TT)
cek('catatan tanpa angka (jejak saja) yang tetap kosong → tidak dihapus', !rc.hapus.includes('YT') && !rc.kirim.YT)
const rb = P.perfRencana({ id: 'n', platforms: ['IG'] }, { IG: { reach: 3 } }, 'Saya', 777)
cek('pertama kali diisi: firstAt/firstBy = sekarang & saya', rb.kirim.IG.firstAt === 777 && rb.kirim.IG.firstBy === 'Saya')
cek('angka TT terisi dikirim dengan pengisi pertama lamanya', P.perfRencana(cp, { TT: { reach: 8 } }, 'Saya', 1).kirim.TT.firstBy === 'Budi')

console.log(`\n${ok} OK, ${gagal} GAGAL\n`)
process.exit(gagal ? 1 : 0)
