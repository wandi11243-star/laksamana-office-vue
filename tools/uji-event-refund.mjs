/*
 * tools/uji-event-refund.mjs — guard for app/utils/event-refund.ts.
 *
 *   node tools/uji-event-refund.mjs      (Node 24+: imports the .ts directly)
 *
 * The rules that once left real orders stuck (commit d7a682d in
 * laksamana-office):
 *   - refundAktif: the still-living request wins, never the last row;
 *   - refundGantung: Approved request + order not Refunded;
 *   - rencanaRefund: order Refunded, its tickets Cancelled (both order_id and
 *     legacy order_item_id links), seats Available, class sold back one per
 *     ticket floored at 0, Cancelled tickets ignored;
 *   - jalankanRefund: every PATCH attempted, partial runs reported, never throws.
 */
import * as R from '../app/utils/event-refund.ts'

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    ok++
    console.log('  OK    ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket ? ' — ' + ket : ''))
  }
}

const refunds = [
  { id: 'r1', order_id: 'o1', status: 'Rejected' },
  { id: 'r2', order_id: 'o1', status: 'Approved' },
  { id: 'r3', order_id: 'o2', status: 'Pending' },
]

// refundAktif: living request first, not the last row
cek('aktif mengalahkan riwayat tolak', R.refundAktif('o1', refunds)?.id === 'r2', JSON.stringify(R.refundAktif('o1', refunds)))
cek('pending ikut aktif', R.refundAktif('o2', refunds)?.id === 'r3')
cek('tanpa pengajuan = undefined', R.refundAktif('o9', refunds) === undefined)
cek('hanya riwayat tolak = undefined', R.refundAktif('o1', [refunds[0]]) === undefined)

// refundGantung
cek('gantung: Approved + Paid', R.refundGantung({ id: 'r', status: 'Approved' }, { id: 'o', payment_status: 'Paid' }) === true)
cek('selesai: Approved + Refunded', R.refundGantung({ id: 'r', status: 'Approved' }, { id: 'o', payment_status: 'Refunded' }) === false)
cek('pending tidak gantung', R.refundGantung({ id: 'r', status: 'Pending' }, { id: 'o', payment_status: 'Paid' }) === false)
cek('tanpa pesanan tidak gantung', R.refundGantung({ id: 'r', status: 'Approved' }) === false)

// rencanaRefund: two tickets of one class, one seatless, one legacy link
const tiket = [
  { id: 't1', order_id: 'o1', ticket_class_id: 'c1', seat_id: 's1', status: 'Valid' },
  { id: 't2', order_id: 'o1', ticket_class_id: 'c1', status: 'Valid' },
  { id: 't3', order_item_id: 'o1', ticket_class_id: 'c2', seat_id: 's2', status: 'Checked-In' },
  { id: 't4', order_id: 'o1', ticket_class_id: 'c1', seat_id: 's3', status: 'Cancelled' },
  { id: 't5', order_id: 'o2', ticket_class_id: 'c1', status: 'Valid' },
]
const kursi = [{ id: 's1' }, { id: 's2' }]
const kelas = [{ id: 'c1', sold: 2 }, { id: 'c2', sold: 0 }]
const rencana = R.rencanaRefund('o1', tiket, kursi, kelas)
cek('3 tiket dibatalkan (Cancelled dikecualikan, order lain dikecualikan)',
  rencana.tiketIds.length === 3 && rencana.tiketIds.includes('t1') && rencana.tiketIds.includes('t3'), JSON.stringify(rencana.tiketIds))
cek('kursi yang ada saja (s3 tak dikenal dilewati)', JSON.stringify(rencana.kursiIds) === JSON.stringify(['s1', 's2']), JSON.stringify(rencana.kursiIds))
cek('c1 turun 2 → 0', rencana.kelasBaru.find(k => k.id === 'c1')?.sold === 0, JSON.stringify(rencana.kelasBaru))
cek('c2 sold 0 tetap 0 tanpa PATCH', rencana.kelasBaru.find(k => k.id === 'c2') === undefined, JSON.stringify(rencana.kelasBaru))

// jalankanRefund: all PATCHes attempted, one failure reported, never throws
const calls = []
const patchOk = async (res, id, body) => {
  calls.push([res, id, body])
}
const hasil = await R.jalankanRefund({
  refund: { id: 'r2', order_id: 'o1', status: 'Pending' },
  order: { id: 'o1', payment_status: 'Paid' },
  tiket, kursi, kelas,
  versi: {},
  patch: patchOk,
  nama: 'Uji',
  sekarang: 1000,
})
cek('sukses penuh', hasil.ok === true && hasil.tiketBatal === 3, JSON.stringify(hasil))
cek('urutan: refund dulu', calls[0][0] === 'refunds' && calls[0][2].status === 'Approved', JSON.stringify(calls[0]))
cek('penyetuju tercatat', calls[0][2].penyetuju === 'Uji')
cek('pesanan Refunded', calls[1][0] === 'orders' && calls[1][2].payment_status === 'Refunded')
cek('tiket Cancelled', calls.some(c => c[0] === 'tickets' && c[2].status === 'Cancelled'))
cek('kursi Available', calls.some(c => c[0] === 'seats' && c[2].status === 'Available'))
cek('kelas sold ditulis', calls.some(c => c[0] === 'ticket-classes' && c[2].sold === 0))

const patchGagalTiket = async (res, id) => {
  if (res === 'tickets' && id === 't2') {
    const e = new Error('macet')
    e.data = { error: { code: 'version_conflict' } }
    throw e
  }
}
const hasil2 = await R.jalankanRefund({
  refund: { id: 'r2', order_id: 'o1', status: 'Approved' },
  order: { id: 'o1', payment_status: 'Paid' },
  tiket, kursi, kelas,
  versi: {},
  patch: patchGagalTiket,
  nama: 'Uji',
  selesaikan: true,
  sekarang: 1000,
})
cek('gagal sebagian tidak throw', hasil2.ok === false, JSON.stringify(hasil2))
cek('yang gagal disebut', hasil2.belum.some(b => b.includes('tiket')), JSON.stringify(hasil2.belum))
cek('yang sudah disebut', hasil2.sudah.length > 0, JSON.stringify(hasil2.sudah))
cek('konflik terdeteksi', hasil2.konflik === true)
cek('selesaikan tidak mengubah status', hasil2.ok === false) // status stays Approved; checked via calls below
const calls2 = []
await R.jalankanRefund({
  refund: { id: 'r2', order_id: 'o1', status: 'Approved' },
  order: { id: 'o1', payment_status: 'Paid' },
  tiket: [], kursi: [], kelas: [],
  versi: {},
  patch: async (res, id, body) => { calls2.push([res, id, body]) },
  nama: 'Uji',
  selesaikan: true,
  sekarang: 1000,
})
cek('selesaikan mencatat penyelesai', calls2[0][2].diselesaikan_oleh === 'Uji' && !('status' in calls2[0][2]), JSON.stringify(calls2[0]))

cek('ringkasan menyebut sudah & belum', R.ringkasRefund(hasil2).includes('Sudah berubah') && R.ringkasRefund(hasil2).includes('Belum berubah'))

console.log(`\n${ok} OK, ${gagal} GAGAL`)
process.exit(gagal ? 1 : 0)
