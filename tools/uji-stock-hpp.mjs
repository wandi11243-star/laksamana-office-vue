/*
 * tools/uji-stock-hpp.mjs — guard for app/utils/stock-hpp.ts.
 *
 *   node tools/uji-stock-hpp.mjs      (Node 24+: imports the .ts directly)
 *
 * The HPP panel's rules: the spare buffer applies ONCE on finished menus only
 * (F.1), memoised bases are never padded twice (F.2), negative buffers are
 * refused (F.3), COGS divides by the yield first (F.4), `{catatan}` lines never
 * count as ingredients (F.5), one name may live on both sides (F.6).
 */
import * as H from '../app/utils/stock-hpp.ts'

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
const dekat = (nama, dapat, harap) => cek(nama, Math.abs(dapat - harap) < 1e-9, { dapat, harap })

// Tepung 10.000/Kg; Ayam Karage is a self-made base (recipe AND a zero-priced
// ingredient row); Nasi Goreng is a dish of 2 portions @ Rp15.000.
const bahan = [
  { nama: 'Tepung', satuan: 'Kg', qty_beli: 1, harga_beli: 10000 },
  { nama: 'Ayam Karage', satuan: 'Gram', qty_beli: 1, harga_beli: 0 },
  { nama: 'Minyak', satuan: 'Liter', qty_beli: 1, harga_beli: 20000 },
]
const resep = [
  {
    id: 'b1', nama: 'Ayam Karage', jenis: 'food', tipe: 'base',
    yield_qty: 1000, yield_unit: 'Gram',
    bahan: [{ nama: 'Tepung', qty: 500, satuan: 'Gram' }],
  },
  {
    id: 'd1', nama: 'Nasi Goreng', jenis: 'food', tipe: 'dish',
    yield_qty: 2, yield_unit: 'Porsi', harga_baru: 15000,
    bahan: [
      { nama: 'Ayam Karage', qty: 80, satuan: 'Gram', ref: 'resep' },
      { nama: 'Minyak', qty: 50, satuan: 'ML' },
      { catatan: 'bumbu blender saring' },
    ],
  },
]
const ctx = H.buatKonteks(bahan, resep)

console.log('\nstock-hpp: konversi satuan')
{
  samakan('Kg→Gram', H.konvFam(1, 'Kg', 'Gram'), 1000)
  samakan('ML→Liter', H.konvFam(500, 'ML', 'Liter'), 0.5)
  samakan('Pcs = Butir', H.konvFam(2, 'Butir', 'Pcs'), 2)
  samakan('Gram→ML diizinkan (dapur menulis begitu)', H.konvFam(250, 'Gram', 'ML'), 250)
  samakan('Pack→Gram ditolak', H.konvFam(1, 'Pack', 'Gram'), null)
  samakan('Pcs→Gram ditolak', H.konvFam(1, 'Pcs', 'Gram'), null)
  const q = H.qtySesuai(1, 'Pack', 'Gram')
  cek('tak terkonversi dipakai apa adanya + campur', q.qty === 1 && q.campur === true)
}

console.log('\nstock-hpp: modal berjenjang')
{
  // Ayam Karage: 500 Gram Tepung @ Rp10/Gram = Rp5.000 per 1000 Gram hasil.
  const base = H.modalResep(ctx, H.cariResep(ctx, 'Ayam Karage', 'food'))
  dekat('modal base', base.total, 5000)
  // Nasi Goreng: 80 Gram Karage @ Rp5/Gram = 400 + 50 ML Minyak @ Rp20/ML = 1000 → 1400.
  const dasar = H.modalDasar(ctx, H.cariResep(ctx, 'Nasi Goreng', 'food'))
  dekat('modal dasar dish', dasar.total, 1400)
  // Buffer 5% hanya di dish: 1400 * 1.05 = 1470. Base tidak kena.
  const menu = H.modalMenu(ctx, H.cariResep(ctx, 'Nasi Goreng', 'food'), 0.05)
  dekat('spare sekali di dish', menu.total, 1470)
  const baseMenu = H.modalMenu(ctx, H.cariResep(ctx, 'Ayam Karage', 'food'), 0.05)
  dekat('base tanpa spare', baseMenu.total, 5000)
  // Objek baru tiap panggilan: padding dua kali tidak menumpuk.
  const a = H.modalMenu(ctx, H.cariResep(ctx, 'Nasi Goreng', 'food'), 0.05)
  const b = H.modalMenu(ctx, H.cariResep(ctx, 'Nasi Goreng', 'food'), 0.05)
  cek('modalMenu selalu objek baru', a !== b && a.total === b.total)
  // COGS = (1470 / 2 porsi) / 15000 = 4.9%.
  dekat('COGS per porsi', H.cogsOf(ctx, H.cariResep(ctx, 'Nasi Goreng', 'food'), 0.05), 735 / 15000)
  samakan('tanpa harga → COGS null', H.cogsOf(ctx, H.cariResep(ctx, 'Ayam Karage', 'food'), 0.05), null)
  // Buffer negatif ditolak, nol sah.
  samakan('buffer negatif = 0', H.spareModal(-0.1), 0)
  samakan('buffer nol sah', H.spareModal(0), 0)
}

console.log('\nstock-hpp: tanpa bahan & dua sisi')
{
  const manual = { id: 'm1', nama: 'Sirup', jenis: 'drink', tipe: 'dish', yield_qty: 1, modal_manual: 3000, bahan: [{ catatan: 'aduk' }] }
  cek('baris catatan bukan bahan', H.tanpaBahan(manual) === true)
  const ctx2 = H.buatKonteks([], [manual])
  dekat('modal manual dipakai', H.modalDasar(ctx2, manual).total, 3000)
  const kosong = { id: 'm2', nama: 'Baru', jenis: 'food', tipe: 'dish', bahan: [] }
  dekat('tanpa modal manual = 0', H.modalDasar(ctx2, kosong).total, 0)
  // Base bertabrakan → sisi resep; dish yang dipakai → bukan resep (baca bahan).
  const ctx3 = H.buatKonteks(
    [{ nama: 'Ayam Karage', satuan: 'Gram', qty_beli: 1, harga_beli: 0 }],
    [{ id: 'b1', nama: 'Ayam Karage', jenis: 'food', tipe: 'base', yield_qty: 1, bahan: [] }],
  )
  samakan('base tabrakan = sisi resep', H.sisiHarga(ctx3, { nama: 'Ayam Karage' }), 'resep')
  samakan('ref eksplisit menang', H.lewatResep(ctx3, { nama: 'Ayam Karage', ref: 'bahan' }), true)
  samakan('sisi tersimpan menang', H.sisiHarga(ctx3, { nama: 'Ayam Karage', sisi_harga: 'beli' }), 'beli')
}

console.log('\nstock-hpp: prasmanan & target')
{
  cek('prasmanan dari seksi', H.prasmananKah({ nama: 'X', seksi: 'PRASMANAN - Pagi' }) === true)
  cek('bukan prasmanan', H.prasmananKah({ nama: 'X', seksi: 'Dapur' }) === false)
  samakan('kategori pras', H.kategoriResep({ nama: 'X', tipe: 'dish', seksi: 'Prasmanan Siang' }), 'pras')
  samakan('seksi tanpa awalan', H.seksiTanpaPras('PRASMANAN — Pagi'), 'Pagi')
  samakan('ambang drink', H.ambangOf({ targetFood: 0.33, targetDrink: 0.25 }, { nama: 'X', jenis: 'drink' }), 0.25)
  samakan('ambang food', H.ambangOf({ targetFood: 0.33, targetDrink: 0.25 }, { nama: 'X', jenis: 'food' }), 0.33)
}

console.log('\nstock-hpp: CSV resep')
{
  const csv = H.csvResep(resep)
  const baris = csv.split('\n')
  cek('satu baris bahan = satu baris CSV', baris.length === 1 + 1 + 3)
  cek('kolom resep hanya di baris pertama', baris[3].startsWith(',') && baris[2].startsWith('Nasi Goreng'))
  cek('baris catatan Ref=Catatan', baris[4].includes('Catatan'))
}

console.log('\nstock-hpp: pemakaian & selisih')
{
  const set = { lampuKuning: 3, lampuMerah: 8 }
  const ctxP = H.buatKonteks([{ nama: 'Beras', satuan: 'Kg', qty_beli: 1, harga_beli: 12000 }], [])
  // masuk 100+20, tercatat 90+5, aktual 120−15=105 → selisih +10 (+10.5%) → merah.
  const c = H.hitungPakai(ctxP, { bahan: 'Beras', sa: 100, beli: 20, resep: 90, spoil: 5, opname: 15 }, set)
  samakan('masuk = sa + beli', c.masuk, 120)
  samakan('tercatat = resep + lain', c.tercatat, 95)
  samakan('aktual = masuk − opname', c.aktual, 105)
  samakan('selisih + boros', c.selisih, 10)
  cek('lampu merah di atas ambang', c.lampu === 'merah', c.lampu)
  samakan('nilai = selisih × harga satuan', c.nilai, 120000)
  const irit = H.hitungPakai(ctxP, { bahan: 'Beras', sa: 100, beli: 0, resep: 100, opname: 0 }, set)
  cek('selisih nol = hijau', irit.lampu === 'hijau' && irit.selisih === 0)
  const kosong = H.hitungPakai(ctxP, { bahan: 'Beras' }, set)
  cek('tanpa angka = tidak ada', kosong.ada === false)
}

console.log('\n' + (gagal ? 'GAGAL ' + gagal : 'SEMUA OK') + ' — ' + ok + ' cek\n')
process.exit(gagal ? 1 : 0)
