/*
 * tools/uji-tagihan.mjs — guard for app/utils/tagihan.ts (VUE-14).
 *
 *   node tools/uji-tagihan.mjs      (Node 24+: imports the .ts directly)
 *
 * The rules that fail SILENTLY and misstate money owed (laksamana-office
 * bc9e0b9, tools/uji-tagihan-rutin.js):
 *   - day 31 clamps to the month's end, never spills into the next month;
 *   - due dates sweep from the FIRST one: every unpaid past date counts late;
 *   - only LIVE payments settle a due date or count in a total;
 *   - totals use the nominal AS PAID, never price × months;
 *   - the monthly estimate divides by the cycle.
 */
import * as T from '../app/utils/tagihan.ts'

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

console.log('tambahBulanTagihan (legacy tgTambahBulan)')
cek('31 Jan + 1 bulan = 28 Feb', T.tambahBulanTagihan('2026-01-31', 1) === '2026-02-28')
cek('31 Jan 2028 + 1 bulan = 29 Feb (kabisat)', T.tambahBulanTagihan('2028-01-31', 1) === '2028-02-29')
cek('15 Nov + 3 bulan menyeberang tahun', T.tambahBulanTagihan('2026-11-15', 3) === '2027-02-15')
cek('tahunan', T.tambahBulanTagihan('2026-10-05', 12) === '2027-10-05')
cek('31 Jan + 2 bulan = 31 Mar (tidak ikut terjepit Februari)', T.tambahBulanTagihan('2026-01-31', 2) === '2026-03-31')

console.log('selisihHariTagihan')
cek('5 → 12 Okt = 7 hari', T.selisihHariTagihan('2026-10-05', '2026-10-12') === 7)
cek('mundur bernilai negatif', T.selisihHariTagihan('2026-10-12', '2026-10-05') === -7)

const t = { id: 1, mulai: '2026-08-05', siklus: 1 }
const bayar = (id, periode, batal = false, nominal = 100000) =>
  ({ id, tagihanId: 1, periode, tglBayar: periode, nominal, catatan: '', oleh: 'Uji', batalAt: batal ? 1 : null })

console.log('statusTagihan (legacy tgStatus), hari ini 2026-10-10')
const HARI = '2026-10-10'
let s = T.statusTagihan({ id: 1, mulai: '', siklus: 1 }, [], HARI)
cek('tanpa mulai → kosong', s.jenis === 'kosong' && s.next === '' && s.sisa === null, JSON.stringify(s))
s = T.statusTagihan(t, [], HARI)
cek('Agu, Sep, Okt belum dibayar → 3 periode terlambat sejak 5 Agu', s.jenis === 'telat' && s.telat === 3 && s.next === '2026-08-05', JSON.stringify(s))
s = T.statusTagihan(t, [bayar(1, '2026-08-05'), bayar(2, '2026-09-05')], HARI)
cek('Agu & Sep lunas → Okt terlambat 1', s.jenis === 'telat' && s.telat === 1 && s.next === '2026-10-05', JSON.stringify(s))
s = T.statusTagihan(t, [bayar(1, '2026-08-05'), bayar(2, '2026-09-05'), bayar(3, '2026-10-05')], HARI)
cek('semua lunas → berikutnya 5 Nov, aman', s.jenis === 'aman' && s.telat === 0 && s.next === '2026-11-05' && s.sisa === 26, JSON.stringify(s))
s = T.statusTagihan(t, [bayar(1, '2026-08-05'), bayar(2, '2026-09-05', true), bayar(3, '2026-10-05')], HARI)
cek('pembayaran batal tidak melunasi → Sep terlambat', s.jenis === 'telat' && s.telat === 1 && s.next === '2026-09-05', JSON.stringify(s))
s = T.statusTagihan({ id: 1, mulai: '2026-10-15', siklus: 1 }, [], HARI)
cek('jatuh tempo 5 hari lagi → segera', s.jenis === 'segera' && s.sisa === 5, JSON.stringify(s))
s = T.statusTagihan({ id: 1, mulai: '2026-10-10', siklus: 1 }, [], HARI)
cek('jatuh tempo hari ini → segera, sisa 0, belum terlambat', s.jenis === 'segera' && s.sisa === 0 && s.telat === 0, JSON.stringify(s))
s = T.statusTagihan({ id: 1, mulai: '2026-03-31', siklus: 6 }, [{ ...bayar(1, '2026-03-31'), tagihanId: 1 }], HARI)
cek('6 bulanan 31 Mar → 30 Sep terlambat', s.jenis === 'telat' && s.next === '2026-09-30', JSON.stringify(s))
s = T.statusTagihan(t, [{ ...bayar(1, '2026-08-05'), tagihanId: 2 }], HARI)
cek('pembayaran tagihan lain tidak melunasi', s.telat === 3, JSON.stringify(s))

console.log('urutan & total')
const urut = T.urutDaftarTagihan([
  { t: { nama: 'B', aktif: true }, s: { jenis: 'aman', next: '2026-11-01', telat: 0, sisa: 22 } },
  { t: { nama: 'Z', aktif: false }, s: { jenis: 'telat', next: '2026-01-01', telat: 9, sisa: -1 } },
  { t: { nama: 'A', aktif: true }, s: { jenis: 'telat', next: '2026-09-01', telat: 1, sisa: -9 } },
  { t: { nama: 'C', aktif: true }, s: { jenis: 'segera', next: '2026-10-12', telat: 0, sisa: 2 } },
])
cek('terlambat → segera → aman → nonaktif terakhir', urut.map(x => x.t.nama).join('') === 'ACBZ', urut.map(x => x.t.nama).join(''))
cek('total = pembayaran hidup dengan nominal saat dibayar',
  T.totalBayar([bayar(1, 'a', false, 100000), bayar(2, 'b', false, 120000), bayar(3, 'c', true, 999999)]) === 220000)
cek('perkiraan bulanan: tahunan dibagi 12, nonaktif tidak ikut',
  T.perkiraanBulanan([
    { nominal: 1200000, siklus: 12, aktif: true },
    { nominal: 300000, siklus: 1, aktif: true },
    { nominal: 500000, siklus: 1, aktif: false },
  ]) === 400000)
cek('format tanggal lama', T.tglTagihan('2026-10-05') === '5 Okt 2026' && T.tglTagihan('') === '—')

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
