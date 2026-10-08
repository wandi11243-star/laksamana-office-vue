/* Guard untuk app/utils/marketing-vip.ts (issue #61: Reservasi VIP +
 * Request Design & Video).
 * node tools/uji-marketing-vip.mjs (Node 24: impor .ts langsung)
 * hook resolve: ~/x -> app/x.ts, file diuji apa adanya.
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  import { pathToFileURL } from 'node:url'
  import path from 'node:path'
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('~/')) return next(pathToFileURL(path.resolve('app', spec.slice(2) + '.ts')).href, ctx)
    return next(spec, ctx)
  }
`))

const V = await import('../app/utils/marketing-vip.ts')

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
const vip = (isi = {}) => ({ id: 'v1', jenis: 'Assisted', nama: 'Arisan', tanggal: '2026-10-20', ...isi })

console.log('\nmarketing-vip: angka & rekap')
cek('pax: maks dulu', V.vipPaxMkt(vip({ paxMin: 10, paxMax: 20 })) === 20 && V.vipPaxMkt(vip({ paxMin: 10 })) === 10)
cek('Regular tidak jadi omzet', V.vipNominalMkt(vip({ jenis: 'Regular', nominal: 99 })) === 0 && V.vipNominalMkt(vip({ nominal: 50 })) === 50 && V.vipNominalMkt(vip({ jenis: '', nominal: 50 })) === 0)
cek('DP dijumlah dari bukti', V.vipDpTotalMkt(vip({ bukti: [{ nominal: 5 }, { nominal: '7' }] })) === 12)
cek('rekap + tanpa nominal', (() => {
  const r = V.rekapVipMkt([vip({ nominal: 10 }), vip({ nominal: '' }), vip({ jenis: 'Regular' }), vip({ batalAt: 'x' })])
  return r.total === 3 && r.assisted === 2 && r.regular === 1 && r.nominal === 10 && r.tanpaNominal === 1 && r.batal === 1
})())
cek('saring: jenis + batal + tanggal', V.saringVipMkt([vip({}), vip({ batalAt: 'x' })], '', 'semua', '', '', '', '2026-10-08', 'batal').length === 1)

console.log('\nmarketing-vip: yatim & pulihkan')
const daftar = [vip({ id: 'a', tanggal: '2026-10-04' }), vip({ id: 'b', tanggal: '2026-10-05', jenis: 'Regular' }), vip({ id: 'c', tanggal: '2026-10-11', meja: ['VIP-3'] }), vip({ id: 'd', tanggal: '2026-10-12', batalAt: 'x' }), vip({ id: 'e', tanggal: '2026-11-01' })]
const ids = r => r.map(v => v.id).join('')
cek('saring minggu: Senin–Minggu', ids(V.saringVipMkt(daftar, '', 'minggu', '', '', '', '2026-10-08', 'semua')) === 'bc')
cek('saring bulan: awal–akhir bulan', ids(V.saringVipMkt(daftar, '', 'bulan', '', '', '2026-10', '', 'semua')) === 'abcd')
cek('saring pilih: dari–sampai', ids(V.saringVipMkt(daftar, '', 'pilih', '2026-10-05', '2026-10-11', '', '', 'semua')) === 'bc')
cek('saring jenis: batal tidak ikut Assisted', ids(V.saringVipMkt(daftar, '', 'semua', '', '', '', '', 'Assisted')) === 'ace')
cek('cari: meja ikut', ids(V.saringVipMkt(daftar, 'vip-3', 'semua', '', '', '', '', 'semua')) === 'c')
cek('perusahaan: CRM dulu, teks lama cadangan', V.vipPerusahaanMkt(vip({ clientId: 'k1', perusahaan: 'Lama' }), id => (id === 'k1' ? 'PT Baru' : '')) === 'PT Baru' && V.vipPerusahaanMkt(vip({ clientId: 'k2', perusahaan: 'Lama' }), () => '') === 'Lama')
cek('PIC dari nama: tak peka huruf', V.penggunaDariNamaMkt(' wandi ', [{ id: 'u1', name: 'Wandi' }]) === 'u1')

cek('id dari resId vip-', V.vipIdDariResMkt('vip-abc') === 'abc' && V.vipIdDariResMkt('ev-abc') === '')
cek('yatim: tanpa pasangan + saring nama PIC', (() => {
  const rows = [{ id: 'vip-a', picName: 'Wandi' }, { id: 'vip-b', picName: 'Sari' }, { id: 'ev-c' }]
  return V.vipYatimMkt(rows, new Set(['a']), 'wandi').length === 0 && V.vipYatimMkt(rows, new Set(), '').length === 2
})())
cek('batal: cancelled/no-show', V.vipResBatalMkt({ status: 'Cancelled' }) && V.vipResBatalMkt({ status: 'No-Show' }) && !V.vipResBatalMkt({ status: 'Confirmed' }))
cek('uraian catatan per posisi', (() => {
  const u = V.uraianCatatanVipMkt('RESERVASI RUANG VIP (Assisted)\nPerusahaan: PT X\nRequest layout: panggung\nTV: Ya · Speaker & Mic: Tidak\nramai\nDari modul Marketing — PIC Wandi')
  return u.jenis === 'Assisted' && u.perusahaan === 'PT X' && u.tv && !u.speaker && u.catatan === 'ramai' && u.pic === 'Wandi'
})())
cek('pulihkan: ragu = Assisted, nominal dikosongkan', (() => {
  const v = V.vipDariReservasiMkt({ id: 'vip-z', name: 'Rapat', date: '2026-10-21', time: '19:00', phone: '081', pax: 30, table: 'M1, M2', notes: 'RESERVASI RUANG VIP (cling)\nDari modul Marketing — PIC Sari', status: 'Confirmed', dps: [{ vipBuktiId: 'b1', amount: 5, method: 'Cash', proofName: 's.jpg' }] })
  return v.jenis === 'Assisted' && v.nominal === '' && v.menuFix === '' && v.meja.length === 2 && v.bukti.length === 1 && v.bukti[0].nominal === 5
})())

console.log('\nmarketing-vip: dps & baris reservasi')
cek('gabung: milik kru bertahan, verifikasi terbawa', (() => {
  const lama = [{ id: 'x', amount: 1 }, { vipBuktiId: 'b1', amount: 2, tfStatus: 'verified', proofName: 'lama.jpg' }]
  const g = V.gabungDpsVipMkt(lama, [{ vipBuktiId: 'b1', amount: 9, proofData: '', proofName: '' }])
  return g.length === 2 && g.find(p => p.vipBuktiId === 'b1').amount === 9 && g.find(p => p.vipBuktiId === 'b1').tfStatus === 'verified' && g.find(p => p.vipBuktiId === 'b1').proofName === 'lama.jpg'
})())
cek('ringkasan dp ikut dps', (() => {
  const r = V.ringkasDpVipMkt([{ amount: 3, method: 'Cash' }])
  return r.dpStatus === 'Sudah' && r.dpAmount === 3 && V.ringkasDpVipMkt([]).dpStatus === 'Belum'
})())
cek('baris vip-: Confirmed + dps + catatan', (() => {
  const b = V.barisReservasiVipMkt(vip({ nama: 'Arisan', meja: ['M1'], bukti: [{ id: 'b1', nominal: 4, metode: 'Cash' }] }), V.dpsVipMkt(vip({ bukti: [{ id: 'b1', nominal: 4, metode: 'Cash' }] }), 'Wandi'), 'PT X', 'Wandi', 'Wandi')
  return b.id === 'vip-v1' && b.status === 'Confirmed' && b.dps.length === 1 && b.dpAmount === 4
})())
cek('dps: id vip-<vip>-<bukti> + baris vip:true', (() => {
  const d = V.dpsVipMkt(vip({ bukti: [{ id: 'b1', nominal: 4 }] }), 'Wandi')
  return d[0].id === 'vip-v1-b1' && d[0].vipBuktiId === 'b1' && V.barisReservasiVipMkt(vip(), d, '', 'W', 'W').vip === true
})())
cek('yatim: terbaru di atas', V.vipYatimMkt([{ id: 'vip-a', date: '2026-10-01' }, { id: 'vip-b', date: '2026-10-09' }], new Set()).map(r => r.id).join() === 'vip-b,vip-a')
cek('pulihkan: cicilan kru bukan bukti Marketing', V.vipDariReservasiMkt({ id: 'vip-q', dps: [{ id: 'x', amount: 9 }, { vipBuktiId: 'b1', amount: 5 }] }).bukti.length === 1)
cek('jenis aktif: tanpa yang batal; semua: termasuk', ids(V.saringVipMkt(daftar, '', 'semua', '', '', '', '', 'aktif')) === 'abce' && ids(V.saringVipMkt(daftar, '', 'semua', '', '', '', '', 'semua')) === 'abcde' && ids(V.saringVipMkt(daftar, '', 'semua', '', '', '', '', 'Regular')) === 'b')
cek('belum nominal: Assisted tanpa angka saja', V.vipBelumNominalMkt(vip({ nominal: '' })) && V.vipBelumNominalMkt(vip({ nominal: 0 })) && !V.vipBelumNominalMkt(vip({ nominal: 5 })) && !V.vipBelumNominalMkt(vip({ jenis: 'Regular' })))
cek('status bayar: Belum DP / DP / Lunas', V.vipStatusBayarMkt(vip({ nominal: 10 })).k === 'belum' && V.vipStatusBayarMkt(vip({ nominal: 10, bukti: [{ nominal: 4 }] })).k === 'dp' && V.vipStatusBayarMkt(vip({ nominal: 10, bukti: [{ nominal: 10 }] })).k === 'lunas' && V.vipStatusBayarMkt(vip({ jenis: 'Regular', bukti: [{ nominal: 10 }] })).k === 'dp')
const rsv = [
  { id: 'r1', name: 'A', date: '2026-10-10', time: '19:00', table: 'M1, M2', status: 'Confirmed' },
  { id: 'r2', name: 'B', date: '2026-10-10', time: '12:00', table: 'M3', status: 'Cancelled' },
  { id: 'r3', name: 'C', date: '2026-10-11', time: '01:00', table: 'M4', status: 'Confirmed' },
  { id: 'r4', name: 'D', date: '2026-10-10', time: '17:00', table: 'M5', status: 'Datang', checkinAt: new Date(2026, 9, 10, 18, 0).getTime() },
  { id: 'r5', name: 'E', date: '2026-10-10', time: '18:00', table: 'M6', status: 'Datang', leftAt: 1 },
  { id: 'r6', name: 'F', date: '2026-10-10', table: 'M7', status: 'Confirmed' },
]
cek('meja: jendela H-3 jam s/d jam+3', Object.keys(V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '16:00')).sort().join() === 'M1,M2,M5' && !V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '15:59').M1 && V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '22:00').M1 && !V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '22:01').M1)
cek('meja: batal / pulang / tanpa jam membebaskan', (t => !t.M3 && !t.M6 && !t.M7)(V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '12:00')))
cek('meja: lintas hari (01:00 mengunci dari 22:00)', V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '23:00').M4 === 'C' && !V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '21:59').M4)
cek('meja: tamu duduk dari check-in + estimasi', V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '20:59').M5 === 'D' && !V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '21:01').M5)
cek('meja: baris sendiri tidak dihitung', !V.mejaTerpakaiVipMkt(rsv, '2026-10-10', '19:00', 'r1').M1)
cek('buka lagi: sudah datang tetap Datang', V.vipStatusPulihMkt({ checkinAt: 5 }) === 'Datang' && V.vipStatusPulihMkt({ arrivals: [1] }) === 'Datang' && V.vipStatusPulihMkt({}) === 'Confirmed')
cek('jam kosong = 00:00', V.jamAtau00Mkt('') === '00:00' && V.jamAtau00Mkt('19:30') === '19:30')

console.log('\nmarketing-vip: designreq')
const req = (isi = {}) => ({ id: 'dr1', jenis: 'design', judul: 'Banner', ...isi })
cek('status: batal > selesai > tunggu', V.drStatusMkt(req({ batalAt: 'x' }), {}) === 'Dibatalkan' && V.drStatusMkt(req(), { dr1: { status: 'done' } }) === 'Selesai' && V.drStatusMkt(req(), {}) === 'Menunggu dikerjakan')
cek('hitung kategori', (() => {
  const n = V.drHitungKatMkt([req(), req({ batalAt: 'x' }), req({ id: 'd2' })], { d2: { status: 'done' } })
  return n.open === 1 && n.done === 1 && n.batal === 1
})())
cek('status: batal menang atas selesai', V.drStatusMkt(req({ batalAt: 'x' }), { dr1: { status: 'done' } }) === 'Dibatalkan')
cek('cari request: brief ikut', V.drDataMkt([req({ brief: 'logo emas' })], {}, '', 'semua', 'emas').length === 1)
cek('prioritas: label + bawaan Sedang', V.drPrioLabelMkt('urgent') === 'Urgent' && V.drPrioLabelMkt('') === 'Sedang')
cek('sisa deadline: H-n / Hari ini / lewat; kosong bila selesai/batal', V.drSisaMkt(req({ deadline: '2026-10-11' }), {}, '2026-10-08') === 'H-3' && V.drSisaMkt(req({ deadline: '2026-10-08' }), {}, '2026-10-08') === 'Hari ini' && V.drSisaMkt(req({ deadline: '2026-10-06' }), {}, '2026-10-08') === 'lewat 2h' && V.drSisaMkt(req({ deadline: '2026-10-06' }), { dr1: { status: 'done' } }, '2026-10-08') === '' && V.drSisaMkt(req({ deadline: '2026-10-06', batalAt: 'x' }), {}, '2026-10-08') === '')
cek('saring: jenis + kat + cari', V.drDataMkt([req({ acara: 'Nikahan' }), req({ jenis: 'edit', judul: 'Video' })], {}, 'edit', 'open', 'video').length === 1)
cek('foto mentah: gambar saja, maks 2MB', V.refFotoBesarMkt('a.pdf', 'application/pdf', 10) !== null && V.refFotoBesarMkt('a.jpg', 'image/jpeg', 3 * 1024 * 1024) !== null && V.refFotoBesarMkt('a.jpg', 'image/jpeg', 2 * 1024 * 1024) === null)
const MB = 1024 * 1024
cek('foto total: hitung yang sudah ada', V.refFotoPenuhMkt([{ t: 'img', v: 'x'.repeat(8 * MB) }, { t: 'link', v: 'y'.repeat(9 * MB) }], 'z'.repeat(0.3 * MB)) === true && V.refFotoPenuhMkt([{ t: 'img', v: 'x'.repeat(7 * MB) }, { t: 'link', v: 'y'.repeat(9 * MB) }], 'z'.repeat(0.3 * MB)) === false)
cek('link: https:// dipasang, kosong → ""', V.refLinkMkt(' ig.com/x ') === 'https://ig.com/x' && V.refLinkMkt('http://a.b') === 'http://a.b' && V.refLinkMkt('//a.b') === 'https://a.b' && V.refLinkMkt('mailto:a@b') === 'mailto:a@b' && V.refLinkMkt('  ') === '')

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
