/*
 * tools/uji-analytics.mjs — guard for app/utils/analytics-pos.ts and
 * app/utils/analytics-agregat.ts (Lane L1, issue #20).
 *
 *   node tools/uji-analytics.mjs      (Node 24: imports the .ts directly)
 *
 * The POS column matcher, the Indonesian number reader, the three date
 * shapes, the payment split and the month-summary aggregation. A drift here
 * silently moves turnover between days, methods or months.
 */
import * as P from '../app/utils/analytics-pos.ts'
import * as A from '../app/utils/analytics-agregat.ts'

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

console.log('\nanalytics-pos: petaKolom')
const kepala = { A: 'Sales Date', B: 'Grand Total', C: 'Table Section', D: 'Table', E: 'Visit Purpose', F: 'Menu', G: 'Qty' }
const peta = P.petaKolomPos(kepala)
cek('kolom menurut nama', peta.tgl === 'A' && peta.grand === 'B' && peta.kunjung === 'E' && peta.menu === 'F')
cek('pencocokan persis (table vs table section)', peta.meja === 'D' && peta.seksi === 'C')
cek('tidak peka huruf kapital', P.petaKolomPos({ A: 'GRAND TOTAL' }).grand === 'A')
cek('kolom tak dikenal = null', peta.kasir === null && peta.bayar === null)

console.log('\nanalytics-pos: cariBarisKepala')
const barisKepala = [
  { A: 'Sales Recapitulation' },
  { A: 'Periode: Agustus 2026' },
  { A: 'Sales Date', B: 'Sales In Time', C: 'Grand Total', D: 'Bill Number', E: 'Visit Purpose', F: 'Table' },
  { A: '2026-08-01', B: '10:00', C: '100000', D: 'SLM1', E: 'DINE IN', F: '12' },
]
cek('melewati baris judul', P.cariBarisKepala(barisKepala) === 2)
cek('tanpa kepala = -1', P.cariBarisKepala([{ A: '1' }, { A: '2' }]) === -1)

console.log('\nanalytics-pos: angka')
cek('angkaTampil Indonesia', P.angkaTampil('4.167.925') === 4167925 && P.angkaTampil('1.234,56') === 1234.56)
cek('angkaTampil Inggris', P.angkaTampil('1,234.56') === 1234.56 && P.angkaTampil('25.000') === 25000)
cek('angkaTampil kosong', P.angkaTampil('') === 0 && P.angkaTampil(null) === 0)
cek('angkaPos sel numerik', P.angkaPos(150000) === 150000)
// angkaPos is ONLY for numeric cells: Indonesian text ("25.000") must go
// through angkaTampil, never here (the old angka() comment says the same).
cek('angkaPos bukan untuk teks Indonesia', P.angkaTampil('25.000') === 25000)

console.log('\nanalytics-pos: tanggal & jam')
const serial = iso => String(Date.parse(iso + 'T00:00:00Z') / 86400000 + 25569)
cek('ISO polos', P.isoDariTanggal('2026-08-01') === '2026-08-01')
cek('serial Excel', P.isoDariTanggal(serial('2026-08-01')) === '2026-08-01')
cek('dd-mm-yyyy', P.isoDariTanggal('01-08-2026') === '2026-08-01')
cek('ber-zona digeser ke WIB', P.isoDariTanggal('2026-08-02T18:00:00.000Z') === '2026-08-03')
cek('serial di luar rentang ditolak', P.isoDariTanggal('12') === '' && P.isoDariTanggal('nomor') === '')
cek('blnDari', P.blnDari('2026-08-01') === '2026-08')
cek('jam teks', P.jamDari('10:03:21') === 10)
cek('jam serial Excel', P.jamDari('46235.419108796') === 10)
cek('serial bulat bukan jam 0', P.jamDari('46235') === -1 && P.jamDari('') === -1)

console.log('\nanalytics-pos: paket & kode')
cek('paketGenerik', P.paketGenerik('LARGE (PACKAGE)') && !P.paketGenerik('MINERAL WATER (PACKAGE)'))
cek('paketNamaAsli', P.paketNamaAsli('MINERAL WATER (PACKAGE)') === 'MINERAL WATER')
cek('kodeMenu menerima kode', P.kodeMenu('AMERICANO02') === 'AMERICANO02')
cek('kodeMenu menolak catatan kasir', P.kodeMenu('Setengah mateng') === '' && P.kodeMenu('SEMUA MAKANAN NYA UDAH KELUAR YA') === '')

console.log('\nanalytics-pos: pembayaran gabungan')
const parts = P.pecahBayar('VOUCHER (25.000),QRIS MANDIRI (15.250)')
cek('pecahBayar dua komponen', parts.length === 2 && parts[0].nama === 'VOUCHER' && parts[0].nom === 25000)
cek('pecahBayar tunggal tanpa kurung', JSON.stringify(P.pecahBayar('CASH')) === JSON.stringify([{ nama: 'CASH', nom: null }]))
const bagi = P.porsiBayar(P.pecahBayar('CASH (100.000),VOUCHER (25.000)'), 75000)
cek('kembalian dipotong dari tunai', Math.abs(bagi.porsi[0] - 50000 / 75000) < 1e-9 && Math.abs(bagi.porsi[1] - 25000 / 75000) < 1e-9)
const rata = P.porsiBayar(P.pecahBayar('QRIS,EDC'), 100000)
cek('nominal tak terbaca dibagi rata', rata.rata && Math.abs(rata.porsi[0] - 0.5) < 1e-9)
cek('satu metode = penuh', P.porsiBayar(P.pecahBayar('CASH'), 50000).porsi[0] === 1)

console.log('\nanalytics-pos: bulan & jenis berkas')
cek('bulan terbanyak menang', JSON.stringify(P.bulanPosTerbanyak({ '2026-08': 40, '2026-09': 3 })) === JSON.stringify({ bulan: '2026-08', lain: [{ b: '2026-09', n: 3 }] }))
cek('deteksi pos', P.deteksiJenisBerkas({ A: 'Sales Date', B: 'Grand Total' }) === 'pos')
cek('deteksi promo', P.deteksiJenisBerkas({ A: 'Sales Date', B: 'Promo Name', C: 'Promo Type' }) === 'promo')
cek('deteksi void duluan', P.deteksiJenisBerkas({ A: 'Sales Number', B: 'Cancel / Void', C: 'Cancel Notes', D: 'Cancel / Void Time', E: 'Promo Name', F: 'Promo Type' }) === 'void')

console.log('\nanalytics-agregat: uraiLaporanPos (bill)')
const billRows = [
  { A: 'Laporan Penjualan' },
  { A: 'Sales Date', B: 'Sales In Time', C: 'Grand Total', D: 'Bill Number', E: 'Visit Purpose', F: 'Payment Method', G: 'Table', H: 'Waiter', I: 'Additional Info' },
  { A: '2026-08-01', B: '10:15:00', C: '150000', D: 'B1', E: 'DINE IN', F: 'CASH (200.000)', G: '12', H: 'Sari', I: '' },
  { A: '2026-08-02', B: '20:30:00', C: '100000', D: 'B2', E: 'ESB ORDER', F: 'QRIS MANDIRI (100.000)', G: '14', H: 'Rian', I: 'ERROR FLOOR' },
  { A: '2026-09-01', B: '12:00:00', C: '50000', D: 'B3', E: 'DINE IN', F: 'CASH', G: '12', H: 'Sari', I: '' },
]
const bill = A.uraiLaporanPos(billRows, 'bill-agust.xlsx')
cek('jenis bill, bulan terbanyak', bill.jenis === 'bill' && bill.bulan === '2026-08')
cek('blnLain dilaporkan', bill.blnLain.length === 1 && bill.blnLain[0].b === '2026-09' && bill.blnLain[0].n === 1)
// Old behaviour: ringkas/kunjung/bayar cover the WHOLE FILE (only hari,
// hariJam, error and meja are cut to the stored month).
cek('total & bill seluruh berkas', bill.ringkas.bill === 3 && bill.ringkas.grand === 300000)
cek('hari & jam', bill.hari['2026-08-01'].bill === 1 && bill.jam[10].bill === 1 && bill.jam[20].grand === 100000)
cek('bulan sebelah dibuang', !bill.hari['2026-09-01'] && bill.hariJam['2026-08-02']['20'].g === 100000)
cek('kunjungan', bill.kunjung['DINE IN'].grand === 200000 && bill.kunjung['ESB ORDER'].bill === 1)
cek('bayar: tunai dipotong kembalian', Math.round(bill.bayar.CASH.grand) === 200000 && bill.bayar['QRIS MANDIRI'].grand === 100000)
cek('meja', bill.meja['12'].bill === 1 && bill.ringkas.mejaKolom && !bill.ringkas.seksiKolom)
cek('error dari Additional Info', bill.error.length === 1 && bill.error[0].bill === 'B2' && bill.error[0].label[0] === 'ERROR FLOOR')
cek('tglAwal/Akhir bulan ini', bill.tglAwal === '2026-08-01' && bill.tglAkhir === '2026-08-02')

console.log('\nanalytics-agregat: uraiLaporanPos (menu + paket)')
const menuRows = [
  { A: 'Sales Date', B: 'Order Time', C: 'Subtotal', D: 'Sales Number', E: 'Menu', F: 'Qty', G: 'Menu Total', H: 'Menu Category', I: 'Menu Code', J: 'Table', K: 'Menu Category Detail' },
  { A: '2026-08-01', B: '19:05:00', C: '30000', D: 'M1', E: 'ICE KOPI LAKSAMANA', F: '2', G: '30000', H: 'BEVERAGES', I: '', J: '5', K: 'COFFEE SERIES' },
  { A: '2026-08-01', B: '19:05:00', C: '0', D: 'M1', E: 'REGULAR (PACKAGE)', F: '2', G: '0', H: 'BEVERAGES', I: 'KOPISUSU001', J: '5', K: 'COFFEE SERIES' },
  { A: '2026-08-01', B: '20:00:00', C: '25000', D: 'M2', E: 'LYCHEE TEA', F: '1', G: '25000', H: 'BEVERAGES', I: '', J: '6', K: 'TEA SERIES' },
]
const menu = A.uraiLaporanPos(menuRows, 'menu-agust.xlsx')
cek('jenis menu', menu.jenis === 'menu' && menu.ringkas.bill === 2)
cek('menu mentah tetap', menu.menu['ICE KOPI LAKSAMANA'].qty === 2 && menu.menu['REGULAR (PACKAGE)'].qty === 2)
cek('ukuran menempel induk', menu.ukuran['ICE KOPI LAKSAMANA'].REGULAR.KOPISUSU001.qty === 2)
cek('kategori + isinya', menu.kategori['COFFEE SERIES'].qty === 4 && menu.kategori['COFFEE SERIES'].kat === 'BEVERAGES' && menu.katMenu['TEA SERIES']['LYCHEE TEA'].nilai === 25000)
cek('paket dirinci per kode', menu.paket['REGULAR (PACKAGE)']['KOPISUSU001'].qty === 2)

console.log('\nanalytics-agregat: galat berkas')
let galatKepala = ''
try {
  A.uraiLaporanPos([{ A: '1' }], 'rusak.xlsx')
}
catch (e) {
  galatKepala = e.message
}
cek('tanpa kepala melempar', /kepala/.test(galatKepala))
let galatTgl = ''
try {
  A.uraiLaporanPos([{ A: 'Grand Total', B: 'Bill Number', C: 'Menu', D: 'Qty', E: 'Visit Purpose' }, { A: '100', B: 'B1', C: 'Kopi', D: '1', E: 'DINE IN' }], 'tanpa-tgl.xlsx')
}
catch (e) {
  galatTgl = e.message
}
cek('tanpa kolom tanggal melempar', /tanggal/.test(galatTgl))

console.log('\nanalytics-agregat: shift')
cek('bawaan 10-18 & 18-24', A.batasShift(null).s1a === 10 && A.batasShift(null).s2b === 24)
cek('kunci hilang + dijepit', A.batasShift({ s1a: 9 }).s1b === 18 && A.batasShift({ s1a: 99 }).s1a === 24)
cek('diRentang lurus & melingkar', A.diRentang(12, 10, 18) && !A.diRentang(19, 10, 18) && A.diRentang(1, 18, 2) && !A.diRentang(10, 18, 2))
cek('shiftDariJam', A.shiftDariJam(12, A.SHIFT_AN_BAWAAN) === 1 && A.shiftDariJam(20, A.SHIFT_AN_BAWAAN) === 2)

console.log('\n' + ok + ' lulus, ' + gagal + ' gagal')
process.exit(gagal ? 1 : 0)
