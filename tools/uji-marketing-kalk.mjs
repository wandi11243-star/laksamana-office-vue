/* Guard untuk app/utils/hpp-mesin.ts + app/utils/marketing-kalk.ts (issue #63:
 * Menu Kalkulator). node tools/uji-marketing-kalk.mjs (Node 24: impor .ts langsung)
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

const H = await import('../app/utils/hpp-mesin.ts')
const K = await import('../app/utils/marketing-kalk.ts')

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

// Fixture: bahan 10.000/kg, ayam goreng prasmanan (1 kg -> 10 porsi), harga lama
// only; a base recipe; an inactive prasmanan; a non-prasmanan dish; a Kg-yield sambal.
const bahan = [{ nama: 'Ayam', satuan: 'Kg', qty_beli: 1, harga_beli: 10000 }, { nama: 'Cabe', satuan: 'Kg', qty_beli: 1, harga_beli: 40000 }]
const resep = [
  { id: 'r1', nama: 'Ayam Goreng', jenis: 'food', tipe: 'dish', seksi: 'PRASMANAN - AYAM', yield_qty: 10, yield_unit: 'porsi', harga_lama: 5000, bahan: [{ nama: 'Ayam', qty: 1, satuan: 'Kg', ref: 'bahan' }], aktif: 1 },
  { id: 'r2', nama: 'Bakwan', jenis: 'food', tipe: 'dish', seksi: 'PRASMANAN - gorengan', yield_qty: 1, yield_unit: 'pcs', harga_baru: 2000, bahan: [], modal_manual: 800, aktif: 1 },
  { id: 'r3', nama: 'Sop Lama', jenis: 'food', tipe: 'dish', seksi: 'PRASMANAN - SOUP', yield_qty: 1, harga_baru: 9000, bahan: [], aktif: 0 },
  { id: 'r4', nama: 'Nasi Goreng', jenis: 'food', tipe: 'dish', seksi: 'WOK', yield_qty: 1, harga_baru: 30000, bahan: [], aktif: 1 },
  { id: 'r5', nama: 'Sambal Merah', jenis: 'food', tipe: 'dish', seksi: 'PRASMANAN', yield_qty: 1, yield_unit: 'Kg', harga_baru: 0, bahan: [{ nama: 'Cabe', qty: 1, satuan: 'Kg', ref: 'bahan' }], aktif: 1 },
  { id: 'r6', nama: 'Tempe', jenis: 'food', tipe: 'dish', seksi: 'PRASMANAN - gorengan', yield_qty: 1, yield_unit: '', harga_baru: 1500, bahan: [], aktif: '0' },
]

console.log('\nhpp-mesin: pabrik di atas stock-hpp')
const asli = structuredClone(resep)
const m = H.hppMesin({ bahan, resep, setting: { buffer: 0.1 } })
cek('harga lama dimigrasikan ke harga_baru', m.hargaJual(m.resep[0]) === 5000)
cek('baris pemanggil TIDAK disunting (salinan)', sama(resep, asli))
cek('setting digabung di atas bawaan (target tetap, buffer ditimpa)', m.setting.targetFood === 0.33 && m.setting.buffer === 0.1)
cek('modal per porsi = (10.000 + spare 10%) / 10', Math.abs(m.modalPorsi(m.resep[0]) - 1100) < 1e-9, String(m.modalPorsi(m.resep[0])))
cek('modal manual dipakai saat tanpa bahan', Math.abs(m.modalPorsi(m.resep[1]) - 880) < 1e-9, String(m.modalPorsi(m.resep[1])))
cek('COGS = modal/porsi ÷ harga', Math.abs(m.cogsOf(m.resep[0]) - 0.22) < 1e-9)
cek('COGS null tanpa harga', m.cogsOf(m.resep[4]) === null)
const m0 = H.hppMesin({ bahan, resep })
cek('buffer bawaan 5% bila setting kosong', Math.abs(m0.modalPorsi(m0.resep[0]) - 1050) < 1e-9)
cek('prasmananKah dari seksi', m.prasmananKah(m.resep[0]) && !m.prasmananKah(m.resep[3]))

console.log('\nmarketing-kalk: menu dari Prasmanan')
cek('nama kategori: buang PRASMANAN -, title case', K.namaKatKalkMkt('PRASMANAN - AYAM goreng') === 'Ayam Goreng')
cek('nama kategori kosong -> Lainnya', K.namaKatKalkMkt('PRASMANAN') === 'Lainnya' && K.namaKatKalkMkt('') === 'Lainnya')
cek('satuan dari yield_unit (huruf awal besar)', K.satuanKalkMkt({ yield_unit: 'pcs' }) === 'Pcs')
cek('satuan kosong -> Porsi', K.satuanKalkMkt({ yield_unit: '' }) === 'Porsi')
const items = K.menuKalkMkt(m)
cek('hanya prasmanan aktif (nonaktif 0 dan "0" dibuang, non-prasmanan dibuang)', sama(Object.keys(items).sort(), ['Ayam', 'Gorengan', 'Lainnya']) && items.Gorengan.length === 1, JSON.stringify(Object.keys(items)))
cek('harga 0 -> null (bukan Rp 0)', items.Lainnya[0].h === null)
cek('satuan item ikut resep', items.Gorengan[0].u === 'Pcs' && items.Ayam[0].u === 'Porsi')
const kat = K.kategoriKalkMkt({ ...items, Ayam: [...items.Ayam, { kat: 'Ayam', n: 'Ayam Bakar', h: 8000, u: 'Porsi' }] })
const ayam = kat.find(k => k.kat === 'Ayam')
cek('kotak kategori: jumlah + rentang harga', ayam.jml === 2 && ayam.min === 5000 && ayam.max === 8000)
cek('rentang harga mengabaikan item tanpa harga', kat.find(k => k.kat === 'Lainnya').min === 0)
const h31 = s => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 6
cek('warna kategori = hash ×31 mod 6 (sama dengan Office lama)', ['Beef', 'Soup', 'Ikan', 'Protein Ringan', 'Udang'].every(k => K.idxWarnaKatKalkMkt(k) === h31(k)), ['Beef', 'Soup', 'Ikan', 'Protein Ringan', 'Udang'].map(k => `${K.idxWarnaKatKalkMkt(k)}/${h31(k)}`).join(' '))
cek('warna kategori stabil (hash ×31 mod 6)', K.idxWarnaKatKalkMkt('Ayam') === K.idxWarnaKatKalkMkt('Ayam') && K.idxWarnaKatKalkMkt('Ayam') === [...'Ayam'].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 6)
const urut = ['Soup', 'Ayam', 'Beef', 'Ikan', 'Gorengan', 'Lainnya'].sort(K.urutKatKalkMkt)
cek('urutan: warna dulu, lalu nama', urut.every((k, i) => i === 0 || K.idxWarnaKatKalkMkt(urut[i - 1]) < K.idxWarnaKatKalkMkt(k) || (K.idxWarnaKatKalkMkt(urut[i - 1]) === K.idxWarnaKatKalkMkt(k) && urut[i - 1].localeCompare(k, 'id') <= 0)), urut.join(','))
cek('semua menu mengikuti urutan kategori', K.semuaMenuKalkMkt(items).map(x => x.kat).join() === Object.keys(items).sort(K.urutKatKalkMkt).join())

console.log('\nmarketing-kalk: baris & pilihan')
cek('baris baru = jumlah pax', sama(K.barisBaruKalkMkt(100), { ref: '', pcs: 100 }))
const rows = [{ ref: 'Ayam|Ayam Goreng', pcs: 80 }, { ref: '', pcs: 100 }]
const ter = K.terapkanPilihKalkMkt(rows, ['Ayam|Ayam Goreng', 'Gorengan|Bakwan'], 120)
cek('pilihan: porsi lama dipertahankan, baru = pax', sama(ter, [{ ref: 'Ayam|Ayam Goreng', pcs: 80 }, { ref: 'Gorengan|Bakwan', pcs: 120 }]))
cek('pilihan kosong menyisakan satu baris kosong', sama(K.terapkanPilihKalkMkt(rows, [], 50), [{ ref: '', pcs: 50 }]))
cek('rasio per pax pecahan + yang tidak kebagian', K.rasioKalkMkt(80, 100, 'Porsi') === '= 0,80 porsi / pax  ·  20 pax tidak kebagian')
cek('rasio bulat tanpa koma', K.rasioKalkMkt(200, 100, 'Pcs') === '= 2 pcs / pax')
cek('rasio tanpa pax -> tanda hubung', K.rasioKalkMkt(10, 0, 'Porsi') === '—')

console.log('\nmarketing-kalk: total & deal')
const rk = K.ringkasKalkMkt(items, [{ ref: 'Ayam|Ayam Goreng', pcs: 100 }, { ref: 'Gorengan|Bakwan', pcs: 200 }, { ref: 'Lainnya|Sambal Merah', pcs: 3 }, { ref: '', pcs: 50 }], 100)
cek('total = Σ harga × jumlah (tanpa harga tidak menambah)', rk.total === 100 * 5000 + 200 * 2000, String(rk.total))
cek('peringatan harga kosong', rk.adaHargaKosong === true)
cek('jumlah per satuan (porsi & pcs tidak dijumlah jadi satu)', sama(rk.perSatuan, [{ u: 'Porsi', jml: 100 }, { u: 'Pcs', jml: 200 }, { u: 'Kg', jml: 3 }]), JSON.stringify(rk.perSatuan))
cek('baris kosong tidak ikut', rk.baris.length === 3)
cek('harga jual / pax dibulatkan', K.ringkasKalkMkt(items, [{ ref: 'Gorengan|Bakwan', pcs: 1 }], 3).perPax === 667)
cek('tanpa pax -> 0, bukan Infinity', K.ringkasKalkMkt(items, [{ ref: 'Gorengan|Bakwan', pcs: 1 }], 0).perPax === 0)
const d1 = K.dealKalkMkt(9000, 7500, 100)
cek('diskon: selisih + persen + total deal', d1.selisih === 1500 && d1.jenis === 'diskon' && d1.teks === 'Diskon 16.67%' && d1.totalDeal === 750000, JSON.stringify(d1))
cek('diskon bulat tanpa desimal', K.dealKalkMkt(10000, 8000, 10).teks === 'Diskon 20%')
const d2 = K.dealKalkMkt(10000, 12000, 10)
cek('deal di atas harga = markup (merah)', d2.jenis === 'markup' && d2.teks === 'Markup 20% (deal di atas harga jual)')
cek('deal sama = tanpa diskon', K.dealKalkMkt(10000, 10000, 10).jenis === 'sama')
cek('tanpa deal / tanpa harga -> null', K.dealKalkMkt(10000, null, 10) === null && K.dealKalkMkt(0, 5000, 10) === null)
cek('deal 0 tetap dihitung (bukan dianggap kosong)', K.dealKalkMkt(10000, 0, 10)?.teks === 'Diskon 100%')
cek('yield Kg/L ditandai, porsi/pcs tidak', K.yieldAnehKalkMkt({ yield_unit: 'Kg' }) && !K.yieldAnehKalkMkt({ yield_unit: 'Porsi' }) && !K.yieldAnehKalkMkt({ yield_unit: '' }))

console.log(`\n${ok} OK, ${gagal} GAGAL`)
process.exit(gagal ? 1 : 0)
