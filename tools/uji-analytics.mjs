/*
 * tools/uji-analytics.mjs — guard for app/utils/analytics-pos.ts,
 * app/utils/analytics-agregat.ts, app/utils/analytics-dampak.ts and
 * app/utils/analytics-menu.ts
 * (Lane L1/L2/L3, issue #20).
 *
 *   node tools/uji-analytics.mjs      (Node 24: imports the .ts directly)
 *
 * The POS column matcher, the Indonesian number reader, the three date
 * shapes, the payment split, the month-summary aggregation and the
 * event/marketing impact arithmetic. A drift here silently moves turnover
 * between days, methods, months or shows.
 */
import * as P from '../app/utils/analytics-pos.ts'
import * as A from '../app/utils/analytics-agregat.ts'
import * as D from '../app/utils/analytics-dampak.ts'
import * as M from '../app/utils/analytics-menu.ts'
import * as E from '../app/utils/analytics-esb.ts'

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

console.log('\nanalytics-agregat: promo & void')
const jEpoch = Math.floor(Date.parse('2026-08-02T20:00:00+07:00') / 1000)
const promoRows = [
  { A: 'Promotion Report' },
  { A: 'Sales Date', B: 'Sales Number', C: 'Promotion Name', D: 'Promotion Type', E: 'Menu Name', F: 'Qty', G: 'Original Price', H: 'Discount Total' },
  { A: '2026-08-02', B: 'SLMCL' + jEpoch + '01', C: 'DISKON 20%', D: 'Discount', E: '-', F: '1', G: '', H: '20000' },
  { A: '2026-08-02', B: 'SLMCL' + jEpoch + '01', C: 'GRATIS KOPI', D: 'Free Item', E: 'KOPI SUSU', F: '2', G: '15000', H: '' },
  { A: '2026-09-01', B: 'SLMCL' + jEpoch + '02', C: 'DISKON 20%', D: 'Discount', E: '-', F: '1', G: '', H: '10000' },
]
const pu = A.uraiLaporanPromo(promoRows, 'promo-agust.xlsx')
cek('promo bulan terbanyak', pu.bulan === '2026-08' && pu.blnLain.length === 1)
cek('promo diskon vs gratis dipisah sel', pu.ringkas.nilaiDisc === 20000 && pu.ringkas.nilaiGratis === 30000 && pu.ringkas.nilai === 50000)
cek('promo bill unik', pu.ringkas.bill === 1 && pu.promo['DISKON 20%'].bill === 1)
cek('promo tanpa menu dihitung', pu.ringkas.tanpaMenu === 1 && pu.menu['KOPI SUSU'].qty === 2)
cek('jam dari nomor bill', pu.jam[20].bill === 1 && pu.ringkas.jamGelap === 0)
cek('jam ditolak bila tanggal tak cocok', A.jamNomorBill('SLMCL' + jEpoch + '01', '2026-08-03') === -1)
const voidRows = [
  { A: 'Cancel Menu Detail' },
  { A: 'Sales Number', B: 'Menu', C: 'Cancel / Void', D: 'Cancel Notes', E: 'Cancel / Void Time', F: 'Cancel / Void By', G: 'Qty', H: 'Total', I: 'Order By' },
  { A: 'B1', B: 'KOPI SUSU', C: 'Void', D: 'Salah input', E: '2026-08-02 20:15', F: 'SPV', G: '1', H: '15000', I: '-' },
  { A: 'B1', B: 'TEH MANIS', C: 'Cancel', D: 'salah input', E: '2026-08-02 20:16', F: 'SPV', G: '2', H: '20000', I: 'Rian' },
]
const vu = A.uraiLaporanVoid(voidRows, 'void-agust.xlsx')
cek('void terbaca', vu.bulan === '2026-08' && vu.baris.length === 2 && vu.ringkas.total === 35000)
cek('vdOrang menolak strip', A.vdOrang('-') === '' && A.vdOrang('SPV') === 'SPV')
const vdK = A.vdKelompok(vu.baris, x => x.nota || '(tanpa alasan)')
cek('vdKelompok gabung beda kapital', vdK.length === 1 && vdK[0].baris === 2 && vdK[0].bill === 1)

console.log('\nanalytics-agregat: kanal, menu, meja, talent')
const rk = A.rekapKanal(
  { 'ONLINE': { grand: 100000, bill: 10 }, 'DINE IN': { grand: 200000, bill: 20 } },
  { 'ONLINE|GRABFOOD': { grand: 70000, bill: 7 }, 'ONLINE|GOFOOD': { grand: 10000, bill: 1 }, 'ONLINE|CASH': { grand: 20000, bill: 2 } },
)
cek('kanal dipecah', rk.baris.some(x => x.n === 'GRABFOOD' && x.grand === 70000))
cek('invarian omset kanal', rk.baris.reduce((a, x) => a + x.grand, 0) === 300000)
cek('sisa online + takKanal disebut', rk.baris.some(x => x.n === 'ONLINE') && (rk.takKanal.ONLINE || []).includes('CASH'))
cek('dineInKah', A.dineInKah('Dine In') && !A.dineInKah('DINE-IN X'))
const katM = { 'COFFEE SERIES': { qty: 4, nilai: 55000, kat: 'BEVERAGES' }, 'EVENT': { qty: 10, nilai: 100000, kat: 'OTHERS' } }
const katMenu = { 'COFFEE SERIES': { KOPI: { qty: 4, nilai: 55000 } }, 'EVENT': { Prasmanan: { qty: 10, nilai: 100000 } } }
const lewat = A.menuKatLewat(katMenu, katM)
cek('menuKatLewat', lewat.Prasmanan && !lewat.KOPI)
cek('kelMenu', A.kelMenu(katMenu, katM).KOPI === 'BEVERAGES')
cek('mejaNorm + bukan', A.mejaNorm('U 3') === 'U3' && A.mejaNorm('EXTRA 15') === 'EXT15' && A.mejaBukanKah('QuickService'))
cek('kursiDari batas bawah', A.kursiDari('10-12') === 10 && A.kursiDari('4') === 4 && A.kursiDari('') === 0)
cek('talSlot tanpa jam 23', JSON.stringify(A.talSlot({ tgl: '2026-08-02', mulai: '20:00', selesai: '23:00' }).jam.map(x => x.jam)) === '[20,21,22]')
cek('talSlot lewat tengah malam pindah tanggal', JSON.stringify(A.talSlot({ tgl: '2026-08-02', mulai: '22:30', selesai: '01:30' }).jam) === JSON.stringify([{ tgl: '2026-08-02', jam: 22 }, { tgl: '2026-08-02', jam: 23 }, { tgl: '2026-08-03', jam: 0 }, { tgl: '2026-08-03', jam: 1 }]))
cek('talSlot tak terbaca = null', A.talSlot({ tgl: '2026-08-02', mulai: '', selesai: '23:00' }) === null)
const to = A.talOmset({ '2026-08-02': { 20: { g: 50000, b: 5 } } }, ['2026-08-02|20', '2026-08-02|21'])
cek('talOmset + jamKosong', to.omset === 50000 && to.jamBerdata === 1 && to.jamKosong === 1)
cek('talKunci', A.talKunci({ jam: [{ tgl: '2026-08-02', jam: 20 }] })[0] === '2026-08-02|20')

console.log('\nanalytics-dampak: acara & breakdown')
cek('acaraSelesai tak peka huruf', D.acaraSelesai('Event Done') && D.acaraSelesai('  event done ') && !D.acaraSelesai('Upcoming') && !D.acaraSelesai(''))
cek('omsetBdAcara = amount+tax+service', D.omsetBdAcara({ amount: 100000, tax: 10000, service: 5000 }) === 115000)
const bdDaily = [
  { date: '2026-09-01', bd: { event: [{ eventName: 'Nobar', amount: 100000, tax: 10000, service: 5000 }], marketing: [{ eventName: 'Promo', amount: 50000, tax: 5000, service: 2500 }] } },
  { date: '2026-09-02', bd: { event: [], marketing: [] } },
  { date: '2026-08-01', bd: { event: [{ eventName: 'Lain', amount: 1, tax: 0, service: 0 }], marketing: [] } },
]
cek('barisBdSumber potong bulan', D.barisBdSumber(bdDaily, 'Event', '2026-09').length === 1 && D.barisBdSumber(bdDaily, 'Marketing', '2026-09')[0].omset === 57500)
cek('barisBdSumber tanpa nama tetap ikut', D.barisBdSumber([{ date: '2026-09-01', bd: { event: [{ amount: 7000, tax: 0, service: 0 }] } }], 'Event', '2026-09')[0].nama === '')

console.log('\nanalytics-dampak: hitungDampakPenuh (hari abu-abu)')
const hariD = { '2026-09-01': { grand: 100000 }, '2026-09-02': { grand: 200000 }, '2026-09-03': { grand: 150000 } }
const hdp = D.hitungDampakPenuh(
  hariD,
  [{ tgl: '2026-09-01', judul: 'Nobar', sumber: 'Event', kategori: 'Nobar' }],
  [{ tgl: '2026-09-03', judul: 'Rencana', sumber: 'Event', kategori: 'Musik' }],
  [{ tgl: '2026-09-01', nama: 'Nobar', omset: 30000 }],
)
cek('hari acara vs biasa vs abu-abu', JSON.stringify(hdp.adaEv) === '["2026-09-01"]' && JSON.stringify(hdp.tanpa) === '["2026-09-02"]' && JSON.stringify(hdp.abuAbu) === '["2026-09-03"]')
cek('rata & omset', hdp.rEv === 100000 && hdp.rNo === 200000 && hdp.omsetEv === 100000 && hdp.omsetSaja === 30000 && hdp.totalBulan === 450000)

console.log('\nanalytics-dampak: top3Acara')
const t3 = D.top3Acara([
  { tgl: '2026-09-01', nama: 'Nobar', omset: 30000 },
  { tgl: '2026-09-02', nama: 'nobar', omset: 20000 },
  { tgl: '2026-09-01', nama: '', omset: 90000 },
  { tgl: '2026-09-02', nama: 'Nol', omset: 0 },
  { tgl: '2026-09-03', nama: 'A', omset: 1000 },
  { tgl: '2026-09-04', nama: 'B', omset: 2000 },
  { tgl: '2026-09-05', nama: 'C', omset: 3000 },
])
cek('kelompok per nama tak peka huruf', t3.top[0].nama === '(tanpa nama)' && t3.top[1].nama === 'Nobar' && t3.top[1].omset === 50000)
cek('nol disaring, sisa dihitung', t3.top.length === 3 && t3.sisa === 2 && t3.sisaOmset === 3000 && t3.tanpaNama === 1)

console.log('\nanalytics-menu: menuNormal (paket, ukuran, kode HPP)')
{
  // ICE KOPI 834 plain + 33 named package = 867; 195 of them were LARGE (row under the parent).
  const lap = {
    menu: { 'ICE KOPI LAKSAMANA': { qty: 834, nilai: 834000 }, 'ICE KOPI LAKSAMANA (PACKAGE)': { qty: 33, nilai: 0 }, 'LARGE KOPI (PACKAGE)': { qty: 195, nilai: 975000 }, 'Nasi Kotak': { qty: 10, nilai: 300000 } },
    ukuran: { 'ICE KOPI LAKSAMANA': { LARGE: { KOPISUSU002: { qty: 195, nilai: 975000, induk: 195000 } } } },
    kategori: { EVENT: { kat: 'OTHERS' }, KOPI: { kat: 'BEVERAGES' } },
    katMenu: { EVENT: { 'Nasi Kotak': {} }, KOPI: { 'ICE KOPI LAKSAMANA': {} } },
  }
  const n1 = M.menuNormal(lap, {})
  cek('large dipindah, bukan dijumlah (867-195=672)', n1.gab['ICE KOPI LAKSAMANA'].qty === 672 && n1.gab['ICE KOPI LAKSAMANA (LARGE)'].qty === 195)
  cek('nilai tidak hilang', Object.values(n1.gab).reduce((a, x) => a + x.nilai, 0) + n1.ev.nilai === 834000 + 975000 + 300000)
  cek('kode tak dikenal dilaporkan berikut induknya', n1.takKenal.KOPISUSU002?.induk === 'ICE KOPI LAKSAMANA' && n1.takKenal.KOPISUSU002.qty === 195)
  cek('menu EVENT keluar dan dihitung', n1.ev.nama.includes('Nasi Kotak') && n1.ev.qty === 10 && !n1.gab['NASI KOTAK'])
  cek('kelompok ikut ke baris large', n1.gab['ICE KOPI LAKSAMANA (LARGE)'].kel === 'BEVERAGES')
  const resep = [{ nama: 'Ice Kopi Laksamana Large', tipe: 'dish', kode: 'kopisusu002' }, { nama: 'A', tipe: 'dish', kode: 'X1' }, { nama: 'B', tipe: 'dish', kode: 'x1' }, { nama: 'Base', tipe: 'base', kode: 'B1' }]
  const pk = M.petaKode({ KOPISUSU002: 'Manual', y9: 'Y' }, resep)
  cek('HPP menang atas manual', pk.KOPISUSU002 === 'Ice Kopi Laksamana Large' && pk.Y9 === 'Y')
  cek('kode kembar tidak dipasangkan, base tidak jadi tujuan', !pk.X1 && !pk.B1 && M.kodeCatatan({}, resep).dobel.X1.length === 2)
  const n2 = M.menuNormal(lap, pk)
  cek('nama resep dipakai untuk baris large', n2.gab['ICE KOPI LAKSAMANA LARGE']?.qty === 195 && !n2.takKenal.KOPISUSU002)
  cek('laporan lama: ukuran tidak dihitung, disebut', M.menuNormal({ menu: lap.menu }, {}).ukLama.qty === 195)
  const s = M.saranKode('LYCHEE02', ['LYCHEE TEA', 'LARGE (PACKAGE) · LYCHEE02'], ['Lychee Tea Large'], 'LARGE')
  cek('saran dijepit ke ukuran', s.utama.join() === 'Lychee Tea Large' && s.cadangan.join() === 'LYCHEE TEA')
  cek('kata utuh: ENLARGED bukan large', !M.punyaKataUkuran('ENLARGED TEA', 'LARGE'))
  const peta = M.resepPeta([{ nama: 'Kopi', yield_qty: 1, bahan: [{ nama: 'Espresso', qty: 60, satuan: 'Ml' }, { nama: 'Susu', qty: 120, satuan: 'Ml' }] }, { nama: 'Espresso', yield_qty: 30, bahan: [{ nama: 'Biji', qty: 18, satuan: 'Gram' }] }, { nama: 'Roti', bahan: [{ nama: 'Roti', qty: 1 }] }])
  const b = M.bahanSatuMenu('KOPI', 10, peta)
  cek('resep bertingkat dibagi yield', b.mentah['Biji (Gram)'] === 360 && b.mentah['Susu (Ml)'] === 1200 && b.prep['Espresso (Ml)'] === 600)
  const U = M.uraiBaru()
  M.uraiResep('Roti', 1, peta, U)
  cek('resep menunjuk dirinya: siklus', U.putar.Roti === 'siklus')
}

console.log('\nanalytics-esb: bill ESB -> baris Detail Report')
{
  const menu = (n, price, qty, extra = {}) => ({ menuName: n, price, qty, total: price * qty * 1.155, otherTaxValue: price * qty * 0.05, vatValue: price * qty * 0.105, discountValue: 0, menuCategoryName: 'BEVERAGES', menuCategoryDetailName: 'COFFEE', createdDate: '2026-08-15 19:10:00', ...extra })
  const bills = [
    { salesNum: 'A', salesDate: '2026-08-15', salesDateIn: '2026-08-15 12:00:00', statusName: 'Paid', grandTotal: 57750, paxTotal: 2, visitPurposeName: 'DINE IN', salesPayments: [{ paymentMethodName: 'QRIS', paymentAmount: 57750 }],
      salesMenus: [menu('ICE KOPI', 25000, 2, { packages: [{ menuName: 'LARGE KOPI', price: 0, qty: 1, total: 0, menuCode: 'K2' }] })] },
    { salesNum: 'B', salesDate: '2026-08-15', statusName: 'Paid', grandTotal: 115500, salesPayments: [{ paymentMethodName: 'GRABFOOD', paymentAmount: 100000 }, { paymentMethodName: 'CASH', paymentAmount: 15500 }],
      salesMenus: [menu('NASI', 50000, 2), menu('TEH', 5000, 1, { statusName: 'Cancelled' })] },
    { salesNum: 'C', salesDate: '2026-08-15', statusName: 'Void', grandTotal: 99999 },
  ]
  const { rows, info } = E.esbKeBaris(bills)
  cek('bill & menu batal dibuang dan dihitung', info.bill === 2 && info.billBatal === 1 && info.menuBatal === 1)
  cek('paket tepat di bawah menunya, berakhiran (PACKAGE)', rows[2].c17 === 'LARGE KOPI (PACKAGE)' && rows[1].c17 === 'ICE KOPI')
  cek('bayar gabungan berbentuk "A (n),B (n)"', rows[rows.length - 1].c12 === 'GRABFOOD (100.000),CASH (15.500)')
  const u = A.uraiLaporanPos(rows, 'API ESB')
  cek('diurai pengurai Excel yang sama', u.bulan === '2026-08' && u.ringkas.bill === 2 && Math.round(u.ringkas.grand) === 173250)
  cek('service = otherTax, pajak = vat', Math.round(u.ringkas.svc) === 7500 && Math.round(u.ringkas.tax) === 15750, JSON.stringify(u.ringkas))
  cek('bulan sinkron: bulan ini + bulan lalu yang belum penuh', E.esbBulanSinkron({ '2026-08': { esb: { sampai: '2026-08-20' } }, '2026-07': { esb: { sampai: '2026-07-31' } }, '2026-06': {} }, '2026-09-03').join() === '2026-08,2026-09')
  const hal = { 1: { bills: [{ salesNum: 1 }, { salesNum: 2 }], pageCount: 3 }, 2: { bills: [{ salesNum: 2 }, { salesNum: 3 }] }, 3: { bills: [{ salesNum: 4 }] } }
  const r = await E.esbTarikRentang(async p => hal[p], () => {}, 'x', async () => {})
  cek('semua halaman ditarik, bill ganda disaring', r.bills.length === 4 && r.ganda === 1)
  let coba = 0
  const g = await E.esbTarikRentang(async () => {
    coba++
    throw new Error('putus')
  }, () => {}, 'x', async () => {}).catch(e => e)
  cek('halaman gagal 3x menghentikan semuanya', g instanceof E.EsbGagal && coba === 3 && /Halaman 1/.test(g.message))
}

console.log('\n' + ok + ' lulus, ' + gagal + ' gagal')
process.exit(gagal ? 1 : 0)
