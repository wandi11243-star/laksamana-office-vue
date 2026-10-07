/*
 * tools/uji-stock-catat.mjs — guard for app/utils/stock-catat.ts.
 *
 *   node tools/uji-stock-catat.mjs      (Node 24+: imports the .ts directly)
 *
 * The Usage panel's rules: the stock book (opening + masuk − keluar), 0 ≠ empty,
 * unit conversion only where the ratio is certain, the recap merging families,
 * the Daily SO area/category grouping and the CSV quoting. A drift here moves
 * numbers silently on four screens (docs/migrasi/stock.md bagian F.10-12).
 */
import * as S from '../app/utils/stock-catat.ts'

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket) => {
  if (syarat) {
    ok++
    console.log('  OK    ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket !== undefined ? '  — ' + JSON.stringify(ket) : ''))
  }
}
const samakan = (nama, dapat, harap) => cek(nama, JSON.stringify(dapat) === JSON.stringify(harap), { dapat, harap })

// The product master used all over: Ayam has a smallest unit + a pack size;
// Beras has NO measure at all (legacy data), Tisu is floor-only.
const info = {
  'Ayam Fillet': { nama: 'Ayam Fillet', satuan: ['Gram', 'Kg'], kategori: 'CHILLER ITEM', area: ['Kitchen'], satuanDasar: 'Gram', isi: { Kg: 1000 } },
  'Beras': { nama: 'Beras', satuan: [], kategori: 'DRY ITEM', area: ['Kitchen'], satuanDasar: '', isi: {} },
  'Gula Pasir': { nama: 'Gula Pasir', satuan: ['Gram', 'Kg'], kategori: 'DRY ITEM', area: ['Kitchen', 'Bar'], satuanDasar: 'Gram', isi: { Kg: 1000 } },
  'Air Mineral': { nama: 'Air Mineral', satuan: ['Botol', 'Dus'], kategori: 'DRY ITEM', area: ['Bar', 'Floor'], satuanDasar: 'Botol', isi: { Dus: 24 } },
  'Tisu': { nama: 'Tisu', satuan: ['Pack'], kategori: 'OPERATIONAL', area: ['Floor'], satuanDasar: '', isi: {} },
  'Es Batu': { nama: 'Es Batu', satuan: ['Pack'], kategori: '', area: [], satuanDasar: '', isi: {} },
}

console.log('\nstock-catat: buku stok (Daily SO)')
{
  const h = S.soHitung({ opening: 10, masuk: 2, keluar: 3, fisik: 9 })
  samakan('seharusnya = opening + masuk − keluar', h.seharusnya, 9)
  samakan('selisih = fisik − seharusnya', h.selisih, 0)
  cek('hitungan lanjutan bukan "baru"', h.baru === false)

  const baru = S.soHitung({ opening: null, masuk: '', keluar: 0, fisik: 12 })
  cek('hitungan pertama tidak punya seharusnya', baru.seharusnya === null)
  cek('hitungan pertama tidak punya selisih', baru.selisih === null)
  cek('hitungan pertama ditandai baru', baru.baru === true)
  samakan('closing tetap terbaca', baru.closing, 12)

  cek('0 ≠ kosong: 0 dihitung 0', S.soAngka(0) === 0)
  cek('kosong = belum dihitung', S.soAngka('') === null)
  cek('koma dibaca desimal', S.soAngka('2,5') === 2.5)

  const entries = [
    { tanggal: '2026-10-05', tim: 'Kitchen', waktu: 'x', items: [{ item: 'Beras', fisik: 5 }] },
    { tanggal: '2026-10-06', tim: 'Kitchen', waktu: 'a', items: [{ item: 'Beras', fisik: 7 }] },
    { tanggal: '2026-10-06', tim: 'Bar', waktu: 'b', items: [{ item: 'Beras', fisik: 99 }] },
    { tanggal: '2026-10-07', tim: 'Kitchen', waktu: 'c', items: [{ item: 'Beras', fisik: 8 }] },
  ]
  cek('opening = closing terakhir tim yang sama sebelum tanggal', S.soKemarin(entries, 'Beras', '2026-10-07', 'Kitchen') === 7)
  cek('tim ALL mencocokkan tim mana pun', S.soKemarin(entries, 'Beras', '2026-10-07', 'ALL') === 99)

  const cells = [
    S.soSelisihTeks({ closing: null, baru: false, selisih: null }),
    S.soSelisihTeks({ closing: 5, baru: true, selisih: null }),
    S.soSelisihTeks({ closing: 5, baru: false, selisih: 0 }),
    S.soSelisihTeks({ closing: 5, baru: false, selisih: -2 }),
  ]
  samakan('selisih teks: —, awal, 0, −2', cells.map(c => [c.teks, c.tone]), [['—', 'neutral'], ['awal', 'warning'], ['0', 'success'], ['-2', 'error']])
}

console.log('\nstock-catat: konversi satuan')
{
  cek('Kg → Gram = ×1000', S.soKonvFam(1, 'Kg', 'Gram') === 1000)
  cek('Kg → Liter tidak sekeluarga', S.soKonvFam(1, 'Kg', 'Liter') === null)
  cek('Pcs diskrit tidak ditawar', S.soKonvFam(1, 'Pcs', 'Pack') === null)
  cek('ukuran per barang: 2 Kg → Gram', S.soKonversi(info, 2, 'Kg', 'Gram', 'Ayam Fillet') === 2000)
  cek('ukuran per barang: 1 Dus → Botol', S.soKonversi(info, 1, 'Dus', 'Botol', 'Air Mineral') === 24)
  cek('barang tanpa ukuran tetap null', S.soKonversi(info, 1, 'Dus', 'Pcs', 'Beras') === null)
  cek('Liter → ML universal', S.soKonversi(info, 0.5, 'Liter', 'ML', 'Beras') === 500)
}

console.log('\nstock-catat: keluar harian (pemakaian + waste + serah)')
{
  const out = S.soKeluarHitung({
    pemakaian: [
      { tanggal: '2026-10-07', tim: 'Kitchen', items: [{ item: 'Ayam Fillet', qty: 1500, unit: 'Gram' }, { item: 'Beras', qty: 2, unit: 'Kg' }] },
      { tanggal: '2026-10-07', tim: 'Bar', items: [{ item: 'Gula Pasir', qty: 100, unit: 'Gram' }] },
      { tanggal: '2026-10-06', tim: 'Kitchen', items: [{ item: 'Ayam Fillet', qty: 999, unit: 'Gram' }] },
    ],
    waste: [{ tanggal: '2026-10-07', tim: 'Kitchen', item: 'Ayam Fillet', qty: 0.2, unit: 'Kg' }],
    serah: [{ tanggal: '2026-10-07', tim: 'Kitchen', items: [{ item: 'Ayam Fillet', qty: 100, unit: 'Gram' }, { item: 'Air Mineral', qty: 1, unit: 'Dus' }] }],
    tanggal: '2026-10-07',
    tim: 'Kitchen',
    info,
  })
  cek('hanya tanggal+tim yang cocok (Kg→Gram + waste 0,2 Kg + serah)', out.keluar['Ayam Fillet'] === 1500 + 200 + 100)
  cek('item tim lain tidak ikut', out.keluar['Gula Pasir'] === undefined)
  cek('item tanpa satuan dijumlah apa adanya (Beras 2 Kg)', out.keluar['Beras'] === 2)
  cek('Dus pada barang berukuran dikonversi ke dasar (24 Botol)', out.keluar['Air Mineral'] === 24)
  cek('konversi berhasil → tidak ditandai campur', out.campur['Air Mineral'] === undefined)
}

console.log('\nstock-catat: rekap per bahan & total lintas bahan')
{
  const baris = [
    { item: 'Ayam Fillet', qty: 1500, unit: 'Gram' },
    { item: 'Ayam Fillet', qty: 1, unit: 'Kg' },
    { item: 'Ayam Fillet', qty: 2, unit: 'Kg', rencana: true },
    { item: 'Air Mineral', qty: 1, unit: 'Dus' },
    { item: 'Air Mineral', qty: 3, unit: 'Pcs' },
  ]
  const rekap = S.rekapBaris(info, baris)
  const ayam = rekap.find(r => r.item === 'Ayam Fillet')
  const air = rekap.find(r => r.item === 'Air Mineral' && r.unit === 'Botol')
  const airPcs = rekap.find(r => r.item === 'Air Mineral' && r.unit === 'Pcs')
  samakan('Gram+Kg digabung ke satuan terkecil barang', { total: ayam.total, selesai: ayam.selesai, rencana: ayam.rencana, unit: ayam.unit }, { total: 4500, selesai: 2500, rencana: 2000, unit: 'Gram' })
  cek('Dus dikonversi ke Botol', air !== undefined && air.total === 24)
  cek('Pcs yang tak bisa dikonversi tetap baris sendiri', airPcs !== undefined && airPcs.total === 3)

  const tot = S.totalPerSatuan([{ qty: 0.3, unit: 'Kg' }, { qty: 1000, unit: 'Gram' }, { qty: 2, unit: 'Pcs' }, { qty: 1, unit: 'Liter' }])
  samakan('keluarga berat digabung ke Kg', tot.Kg, 1.3)
  samakan('volume ke Liter', tot.Liter, 1)
  samakan('diskrit tetap Pcs', tot.Pcs, 2)
  samakan('urutan tetap: Kg, Liter, diskrit', S.urutSatuan(tot).map(([u]) => u), ['Kg', 'Liter', 'Pcs'])
  samakan('teks total untuk kartu', S.teksTotal(tot), '1,3 Kg · 1 Liter · 2 Pcs')

  const bars = S.dataBarQty(rekap)
  cek('barang dengan dua satuan tampil dua batang', bars.filter(b => b.label.startsWith('Air Mineral')).length === 2)
  cek('persen batang relatif yang terbesar', bars[0].persen === 100)
}

console.log('\nstock-catat: area & kategori Daily SO')
{
  samakan('area dinormalkan', S.soAreas(info, 'Air Mineral'), ['Bar', 'Floor'])
  samakan('area asing dibuang (jadi Umum)', S.soAreas({ X: { nama: 'X', area: ['Gudang'] } }, 'X'), [])
  cek('Floor-murni dipisah', S.soFloorMurni(info, 'Tisu') === true)
  cek('Floor+Bar BUKAN floor-murni', S.soFloorMurni(info, 'Air Mineral') === false)
  cek('item Kitchen tidak muncul untuk Bar', S.soAreaCocok(info, 'Beras', 'Bar') === false)
  cek('item Bar+Floor muncul untuk Floor', S.soAreaCocok(info, 'Air Mineral', 'Floor') === true)
  cek('admin (tim "ALL") melihat semua', S.soAreaCocok(info, 'Beras', 'ALL') === true)

  const { grup, urut } = S.soKelompok(info, Object.keys(info), 'Floor')
  cek('kelompok FLOOR · membawa judul area', urut.includes('FLOOR · OPERATIONAL'))
  cek('kategori dikenal berurutan sesuai SO_KATEGORI', urut[0] === 'DRY ITEM')
  cek('kategori tak dikenal jatuh setelah yang dikenal', urut.indexOf('FLOOR · OPERATIONAL') > urut.indexOf('DRY ITEM'))
  cek('"Belum dikategori" paling bawah', urut[urut.length - 1] === S.SO_LAIN)
  cek('grup Floor hanya berisi item Floor', grup['FLOOR · OPERATIONAL'].join() === 'Tisu')
}

console.log('\nstock-catat: CSV')
{
  const pem = S.csvPemakaian([{ tanggal: '2026-10-07', jenis: 'RND', status: 'Selesai', namaEvent: 'Uji "sambal"', tim: 'Kitchen', pic: 'K', catatan: '', items: [{ item: 'Gula', qty: 1, unit: 'Kg', note: '' }] }])
  const baris = pem.split('\n')
  cek('satu baris bahan = satu baris CSV', baris.length === 2)
  cek('kutip ganda di-escape', baris[1].includes('"Uji ""sambal"""'))
  cek('header pemakaian lengkap', baris[0].startsWith('"Tanggal","Jenis","Status",'))
  const was = S.csvWaste([{ tanggal: '2026-10-07', item: 'Tisu', qty: 1, unit: 'Pack', sebab: 'Rusak', tim: 'Floor', pic: 'F', waktu: 'x', catatan: '', adaFoto: true }])
  cek('CSV waste menulis ada foto = Ya', was.includes('"Ya"'))
  const srh = S.csvSerah([{ tanggal: '2026-10-07', tujuan: 'Kitchen', tim: 'Bar', penerima: 'P', pic: 'B', waktu: 'x', catatan: '', adaFoto: false, items: [{ item: 'Gula', qty: 2, unit: 'Kg' }] }])
  cek('CSV serah satu baris per item', srh.split('\n').length === 2 && srh.includes('"Kitchen"'))
  const opn = S.csvOpname('2026-10-07', 'Kitchen', [{ item: 'Beras', unit: '', opening: 12, masuk: null, keluar: 2, seharusnya: 10, fisik: 9, selisih: -1 }])
  cek('CSV opname menulis angka & kosong', opn.includes('"9"') && opn.includes('"-1"') && opn.includes('""'))
}

console.log('\nstock-catat: rentang bulan')
{
  samakan('Februari pendek', S.rentangBulan('2026-02'), { dari: '2026-02-01', ke: '2026-02-28' })
  samakan('kabisat', S.rentangBulan('2024-02'), { dari: '2024-02-01', ke: '2024-02-29' })
  cek('24 bulan pilihan, terbaru dulu', S.daftarBulanPilih().length === 24 && S.daftarBulanPilih()[0].value === S.bulanIni())
}

console.log('\n' + (gagal ? 'GAGAL ' + gagal : 'SEMUA OK') + ' — ' + ok + ' cek\n')
process.exit(gagal ? 1 : 0)
