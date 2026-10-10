/*
 * tools/uji-event.mjs — guard for app/utils/event-hitung.ts.
 *
 *   node tools/uji-event.mjs      (Node 24+: imports the .ts directly)
 *
 * The rules that fail SILENTLY and move real money or double-book talent:
 *   - T-22: the dashboard chart is COMPUTED (Paid only, event-start month,
 *     millions) — never the old hard-coded demo numbers;
 *   - D.13: angkaEms is the ONE source for Performance & Report (only
 *     Approval/Upcoming/Event Done count; `terjual` ≠ `tiket` on purpose);
 *   - F.4: anti double-booking (same talent, same date, overlapping,
 *     Cancelled ignored); F.5: one talent once per day on weekly sheets
 *     (checked by callers via bentrokJadwal before ANY write);
 *   - F.15: fee is per schedule ROW (callers sum j.fee, never the profile);
 *   - F.18: budget variance = actual − budget.
 */
import * as H from '../app/utils/event-hitung.ts'

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

const acara = [
  { id: 'e1', start_datetime: '2026-10-10T20:00:00', status: 'Upcoming', capacity: 200 },
  { id: 'e2', start_datetime: '2026-09-24T17:00:00', status: 'Event Done', capacity: 100 },
  { id: 'e3', start_datetime: '2026-10-17T10:00:00', status: 'Planning', capacity: 500 },
]
const order = [
  { event_id: 'e1', payment_status: 'Paid', total: 275000 },
  { event_id: 'e1', payment_status: 'Pending', total: 999999999 },
  { event_id: 'e2', payment_status: 'Paid', total: 4000000 },
  { event_id: 'e9', payment_status: 'Paid', total: 111 },
]
const kelas = [
  { id: 'c1', event_id: 'e1', name: 'Reguler', price: 75000, sold: 138, quota: 150 },
  { id: 'c2', event_id: 'e1', name: 'VIP', price: 200000, sold: 12, quota: 50 },
]
const tiket = [
  { event_id: 'e1', ticket_class_id: 'c1', status: 'Checked-In' },
  { event_id: 'e1', ticket_class_id: 'c2', status: 'Valid' },
  { event_id: 'e1', ticket_class_id: 'c1', status: 'Refunded' },
]

// T-22: Paid only, event-start month, millions
const g = H.omzetPerBulan(2, acara, order, new Date(2026, 9, 8))
cek('omzet 2 bulan berbentuk label+jt', g.length === 2 && g[0].label === 'Sep' && g[1].label === 'Okt')
cek('Sep = 4 jt (satu order Paid e2)', g[0].jt === 4, JSON.stringify(g[0]))
cek('Okt = 0.3 jt (Pending 999jt diabai)', g[1].jt === 0.3, JSON.stringify(g[1]))

// D.13: satu sumber
const a = H.angkaEms(acara, kelas, tiket, order)
cek('hasil = 2 (Planning bukan hasil)', a.hasil === 2)
cek('omzet = semua Paid (275rb + 4jt + 111)', a.omzet === 4275111, String(a.omzet))
cek('terjual = Σ sold', a.terjual === 150)
cek('lembar tiket ≠ terjual (3 baris, 1 refund tetap dihitung)', a.tiket === 3)
cek('hadir = Checked-In saja', a.hadir === 1)
cek('isi = round(150/200)', a.isi === 75)
cek('hadirPct = round(1/3)', a.hadirPct === 33, String(a.hadirPct))

// salesRingkas: refund keluar dari omzet, masuk dikembalikan
const r = H.ringkasPenjualan('e1', tiket, kelas)
cek('omzet = 75rb + 200rb', r.omzet === 275000, String(r.omzet))
cek('dikembalikan = 75rb', r.dikembalikan === 75000, String(r.dikembalikan))
cek('tiketSah = 2', r.tiketSah === 2)

// paxAcara: sold bila ada kelas, else kapasitas
cek('pax = Σ sold', H.paxAcara({ id: 'e1', capacity: 200 }, kelas) === 150)
cek('pax = kapasitas tanpa kelas', H.paxAcara({ id: 'e9', capacity: 80 }, kelas) === 80)

// F.4: anti double-booking
const jad = [
  { id: 's1', talent_id: 't1', date: '2026-10-08', start_time: '20:00', end_time: '23:00', status: 'Scheduled' },
  { id: 's2', talent_id: 't1', date: '2026-10-08', start_time: '10:00', end_time: '12:00', status: 'Cancelled' },
]
cek('tumpang tindih terdeteksi', H.bentrokJadwal(jad, 't1', '2026-10-08', '21:00', '22:00') === true)
cek('bersebelahan lolos (23:00 = mulai)', H.bentrokJadwal(jad, 't1', '2026-10-08', '23:00', '23:30') === false)
cek('Cancelled diabaikan', H.bentrokJadwal(jad, 't1', '2026-10-08', '10:30', '11:00') === false)
cek('talent lain bebas', H.bentrokJadwal(jad, 't2', '2026-10-08', '21:00', '22:00') === false)
cek('abaikan diri sendiri saat sunting', H.bentrokJadwal(jad, 't1', '2026-10-08', '20:30', '21:00', 's1') === false)

// feeAngka + roiIde
cek('feeAngka membersihkan ribuan', H.feeAngka('2.500.000') === 2500000)
cek('feeAngka angka lewat', H.feeAngka(1500) === 1500)
cek('ROI = round((25-10)/10)', H.roiIde(10000000, 25000000) === 150)
cek('ROI budget 0 = 0', H.roiIde(0, 25000000) === 0)

// statusPengajuan
cek('pengajuan default Belum diajukan', H.statusPengajuan({}) === 'Belum diajukan')
cek('pengajuan Menunggu terbaca', H.statusPengajuan({ pengajuan: { status: 'Menunggu' } }) === 'Menunggu')

// VUE-13: WIB wall-clock (commit 43f6851 di laksamana-office).
// dtLokalInput/jamWIB membaca jam LOKAL: jalankan berkas ini dengan
// TZ=Asia/Jakarta (`TZ=Asia/Jakarta node tools/uji-event.mjs`).
cek('dtLokalInput instant Z jadi lokal', H.dtLokalInput('2026-10-25T04:00:00.000Z') === '2026-10-25T11:00', H.dtLokalInput('2026-10-25T04:00:00.000Z'))
cek('dtLokalInput tanpa zona apa adanya', H.dtLokalInput('2026-10-25T11:00') === '2026-10-25T11:00')
cek('dtLokalInput kosong', H.dtLokalInput('') === '' && H.dtLokalInput(null) === '' && H.dtLokalInput(undefined) === '')
cek('tglWIB 04:00Z tetap 25 Okt', H.tglWIB('2026-10-25T04:00:00.000Z') === '2026-10-25')
cek('tglWIB lewat tengah malam tidak mundur', H.tglWIB('2026-10-24T18:00:00.000Z') === '2026-10-25', H.tglWIB('2026-10-24T18:00:00.000Z'))
cek('tglWIB tanpa zona', H.tglWIB('2026-10-25T11:00') === '2026-10-25')
cek('jamWIB 04:00Z tampil 11:00', H.jamWIB('2026-10-25T04:00:00.000Z') === '11:00', H.jamWIB('2026-10-25T04:00:00.000Z'))
cek('jamWIB kosong', H.jamWIB('') === '—')
cek('Edit-Simpan bolak-balik tidak geser', H.instanDariLokal(H.dtLokalInput('2026-10-25T04:00:00.000Z')) === '2026-10-25T04:00:00.000Z')
cek('instanDariLokal kosong tetap kosong', H.instanDariLokal('') === '')
cek('rentang bulan', JSON.stringify(H.rentangPeriodeEvent('2026-09')) === '{"a":"2026-09-01","b":"2026-09-30"}')
cek('rentang Februari kabisat', JSON.stringify(H.rentangPeriodeEvent('2024-02')) === '{"a":"2024-02-01","b":"2024-02-29"}')
cek('rentang tanggal', JSON.stringify(H.rentangPeriodeEvent('2026-10-25')) === '{"a":"2026-10-25","b":"2026-10-25"}')
cek('rentang kosong = tanpa saring', H.rentangPeriodeEvent('') === null)
cek('rentang minggu Senin-Minggu', JSON.stringify(H.rentangPeriodeEvent('minggu', new Date(2026, 9, 8))) === '{"a":"2026-10-05","b":"2026-10-11"}')
cek('rentang hari', JSON.stringify(H.rentangPeriodeEvent('hari', new Date(2026, 9, 8))) === '{"a":"2026-10-08","b":"2026-10-08"}')
cek('geser Des ke Jan', H.geserPeriode('2026-12', 1) === '2027-01')
cek('geser Jan ke Des', H.geserPeriode('2027-01', -1) === '2026-12')
cek('geser tanggal mundur sehari', H.geserPeriode('2026-10-01', -1) === '2026-09-30')
cek('geser kata tetap dari bulan berjalan', H.geserPeriode('bulan', 1, new Date(2026, 9, 8)) === '2026-11')
cek('bulan dipegang YYYY-MM', H.bulanAktif('2026-09', new Date(2026, 9, 8)) === '2026-09')
cek('bulan kata tetap = bulan berjalan', H.bulanAktif('bulan', new Date(2026, 9, 8)) === '2026-10')

console.log(`\n${ok} OK, ${gagal} GAGAL`)
process.exit(gagal ? 1 : 0)
