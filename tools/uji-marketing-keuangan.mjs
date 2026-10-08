/* Guard untuk app/utils/marketing-keuangan.ts (issue #60: invoice, approval,
 * reporting, notifikasi, timeline).
 * node tools/uji-marketing-keuangan.mjs (Node 24: impor .ts langsung)
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

const M = await import('../app/utils/marketing.ts')
const K = await import('../app/utils/marketing-keuangan.ts')

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
const ST = { ...M.SETTING_MKT_BAWAAN }
const ev = (detail = {}, lain = {}) => ({ id: 'e1', clientId: 'c1', nama: 'Uji', status: 'Deal', tanggal: '2026-10-20', detail, payments: [], ...lain })
const tagih = { rincianItem: [{ desc: 'A', harga: 10_000 }] }

console.log('\nmarketing-keuangan: invoice')
const layak = [ev({}, { status: 'Deal' }), ev({}, { status: 'Lead' }), ev({}, { status: 'Confirmed' }), ev({}, { status: 'Quotation Terkirim' })]
cek('hanya Confirmed/Deal/Event Done yang tampil', sama(K.layakTagihMkt(layak).map(e => e.status), ['Deal', 'Confirmed']))
cek('rekap: piutang + overdue + lunas + draft tersembunyi', (() => {
  const r = K.rekapInvoiceMkt([{ inv: 'Pending', remaining: 5, paid: 5 }, { inv: 'Paid', remaining: 0, paid: 10 }, { inv: 'Overdue', remaining: 7, paid: 0 }], 2)
  return r.piutang === 12 && r.overdue === 1 && r.lunas === 1 && r.draft === 2
})())
cek('tab: lunas/dp/belum', K.kelompokBayarMkt('lunas', { remaining: 0, paid: 1 }) && K.kelompokBayarMkt('dp', { remaining: 1, paid: 1 }) && !K.kelompokBayarMkt('dp', { remaining: 1, paid: 0 }) && K.kelompokBayarMkt('belum', { remaining: 9, paid: 0 }))
cek('resId mkt:<id>:dp|lunas', K.resIdInvMkt('e9', 'dp') === 'mkt:e9:dp' && K.resIdInvMkt('e9', 'lunas') === 'mkt:e9:lunas')
cek('nomor resmi: pelunasan didahulukan', (() => {
  const peta = { 'mkt:e1:dp': { status: 'DIBUAT', no: 'DP/1' }, 'mkt:e1:lunas': { status: 'DIBUAT', no: 'LNS/1' } }
  return K.noResmiInvMkt(peta, 'e1') === 'LNS/1' && K.noResmiInvMkt({ 'mkt:e1:dp': { status: 'DIBUAT', no: 'DP/1' } }, 'e1') === 'DP/1' && K.noResmiInvMkt({}, 'e1') === ''
})())
cek('tiga keadaan nomor: terbit / memeriksa / belum', K.teksNoInvMkt({}, 'e1', true).includes('memeriksa') && K.teksNoInvMkt({}, 'e1', false).includes('belum'))
cek('pra-pelunasan: sisa SEBELUM pelunasannya', (() => {
  const e = ev({}, { payments: [{ type: 'DP', amount: 4000 }, { type: 'Pelunasan', amount: 5000 }] })
  const U = { grand: 10_000, dp: 4000, paid: 9000, remaining: 1000, dpCentang: false }
  const pra = K.praPelunasanMkt(e, U)
  return pra.praBayar === 4000 && pra.tagih === 6000
})())
cek('DP ada begitu uang masuk; pelunasan butuh baris/nol', K.punyaDpMkt({ paid: 1 }) && !K.punyaDpMkt({ paid: 0 }) && K.punyaPelunasanMkt(ev({}, { payments: [{ type: 'Pelunasan', amount: 1 }] }), {}) && K.punyaPelunasanMkt(ev({}), { grand: 5, remaining: 0 }))

console.log('\nmarketing-keuangan: approval')
const evPen = ev({}, { penawaran: { status: 'Menunggu Approval', noSurat: '001/X', validUntil: '2026-11-01', submittedBy: 'u1', submittedAt: '2026-10-01' } })
const baris = K.barisApprovalMkt([evPen, ev({}, { status: 'Lead' })], [{ id: 'a1', eventId: 'e1', reason: 'Diskon 10%', status: 'Pending', by: 'u2', at: '2026-10-02' }], ST)
cek('draft tidak jadi perkara; pen + nego bersatu', baris.length === 2 && baris[0].jenis === 'Surat Penawaran' && baris[1].jenis === 'Negosiasi Harga')
cek('revisi = Negosiasi Lanjutan', K.barisApprovalMkt([ev({}, { penawaran: { status: 'Terkirim', revisiKe: 2, revisiAlasan: 'Minta turun' } })], [], ST)[0].jenis === 'Negosiasi Lanjutan')
cek('tiga kartu: penawaran, lanjutan, antrean', (() => {
  const r = K.rekapApprovalMkt(baris)
  return r.pen === 1 && r.rev === 1 && r.antri === 2 && r.total === 2
})())

console.log('\nmarketing-keuangan: reporting')
cek('per kategori + TOTAL + rata-rata', (() => {
  const evs = [ev({}, { jenis: 'Gathering' }), ev({}, { jenis: 'Gathering' }), ev({}, { jenis: 'Wedding', tanggal: '2026-09-01' })]
  const lap = K.laporanMkt(evs, ST, '2026-10')
  return lap.n === 2 && lap.baris.length === 1 && lap.baris[0].jenis === 'Gathering' && lap.total === lap.baris[0].total && lap.rata === Math.round(lap.total / 2)
})())
cek('jenis kosong = (tanpa jenis)', K.laporanMkt([ev({})], ST, '2026-10').baris[0].jenis === '(tanpa jenis)')
cek('CSV ramah Excel + nama berkas', K.csvMkt([['a', 'b, c']]).startsWith('﻿sep=,') && K.namaBerkasCsvMkt('2026-10-08') === 'laksamana_events_2026-10-08.csv')

console.log('\nmarketing-keuangan: notifikasi & timeline')
const pg = K.pengingatMkt(
  [ev(tagih, { status: 'Deal', nextFU: '2026-10-08' }), ev(tagih, { status: 'Confirmed', tanggal: '2026-10-08' })],
  [{ id: 'c1', nama: 'PT X', nextFU: '2026-10-08' }], ST, '2026-10-08',
)
cek('live: DP + FU + H-0 + overdue', ['dp', 'fu', 'event', 'inv'].every(t => pg.some(p => p.type === t)))
cek('link lama # dinormalkan', K.linkNotifMkt('#event/e9') === '/marketing/event/e9' && K.linkNotifMkt('#pipeline') === '/marketing/pipeline' && K.linkNotifMkt('/marketing/brief') === '/marketing/brief')
cek('belum dibaca dihitung', K.belumDibacaMkt([{ read: true }, {}, { read: false }]) === 2)
cek('label jenis + lalu', K.labelJenisMkt('event') === 'EVENT' && K.laluMkt(Date.now() - 90_000, Date.now()) === '1 mnt lalu' && K.laluMkt(Date.now() - 3_600_000 * 30, Date.now()) === '1 hari lalu')

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
