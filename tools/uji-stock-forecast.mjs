/*
 * tools/uji-stock-forecast.mjs — guard for app/utils/stock-forecast.ts.
 *
 *   node tools/uji-stock-forecast.mjs      (Node 24+: imports the .ts directly)
 *
 * The Ordering restock rules: status thresholds (D.5), pack-rounded
 * suggestions, name matching across the item DB and the forecast, and the
 * reliability table that never crowns an untested material (D.6).
 */
import * as F from '../app/utils/stock-forecast.ts'

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

const payload = {
  generated: '2026-10-01',
  items: {
    'Beras (Karung)': { unit: 'Gram', avg_daily: 2000, reorder_point: 10000, tier: 'A', wape: 0.1, purchase_unit: 'Karung', per_purchase: 20000 },
    'Minyak': { unit: 'ML', avg_daily: 500, reorder_point: 2000, tier: 'B', wape: 0.3, purchase_unit: 'Jerigen', per_purchase: 5000 },
    'Sambal': { unit: 'Gram', avg_daily: 100, reorder_point: 500, tier: 'C', wape: null, purchase_unit: 'Pack', per_purchase: 250 },
    'Kecap': { unit: 'ML', avg_daily: 0, reorder_point: 1000, tier: 'C', wape: 0.9, purchase_unit: 'Botol', per_purchase: 500 },
  },
}
const stock = {
  Beras: { stock_now: 0.4, stock_unit: 'Karung' },
  Minyak: { stock_now: 2500, stock_unit: 'ML' },
  Sambal: { stock_now: -2, stock_unit: 'Gram' },
}

console.log('\nstock-forecast: assess')
{
  const buku = new F.BukuForecast(payload, stock)
  // Beras: 0.4 Karung × 20000 = 8000 Gram ≤ RP 10000 → order.
  const beras = buku.assess('Beras')
  samakan('status order', beras.status, 'order')
  // need = 2000*14 − 8000 = 20000 → 1 Karung.
  samakan('saran pack dibulatkan ke atas', beras.suggestOrderPacks, 1)
  samakan('tier Andal', beras.tierLabel, 'Andal')
  const minyak = buku.assess('Minyak')
  // 2500 ≤ 2000×1.5 → soon.
  samakan('status soon', minyak.status, 'soon')
  samakan('soon tanpa saran', minyak.suggestOrderPacks, 0)
  const sambal = buku.assess('Sambal')
  samakan('stok negatif = cek pencatatan', sambal.status, 'check')
  const kecap = buku.assess('Kecap')
  samakan('tanpa stok = nostk', kecap.status, 'nostk')
  const asing = buku.assess('Lada Hitam')
  samakan('tanpa forecast = nofc', asing.status, 'nofc')
  // Loose key: "Beras (Karung)" di payload cocok dengan "Beras" di stok.
  samakan('loose key unit-suffix', buku.forecastFor('Beras')?.unit, 'Gram')
}

console.log('\nstock-forecast: health')
{
  const rows = F.healthRows(payload)
  samakan('satu baris per bahan', rows.length, 4)
  samakan('tally seluruh baris', F.healthTally(rows), { A: 1, B: 1, C: 2 })
  // wape null (Sambal) tidak boleh di puncak "paling akurat".
  const akurat = F.urutHealth(rows, 'wape_asc').map(r => r.nama)
  cek('null wape di bawah pada wape_asc', akurat[akurat.length - 1] === 'Sambal', akurat)
  const boros = F.urutHealth(rows, 'usage_desc')[0]
  cek('usage_desc = pemakaian terbesar', boros?.nama === 'Beras (Karung)', boros?.nama)
  const view = F.healthView(rows, { search: 'minyak', sort: 'name', limit: 60 })
  samakan('saring + total jujur', { total: view.total, nama: view.rows.map(r => r.nama) }, { total: 1, nama: ['Minyak'] })
}

console.log('\nstock-forecast: tanggal lokal')
{
  const d = F.toLocalDate('2026-10-04')
  cek('YYYY-MM-DD dibaca lokal (bukan UTC)', d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 4)
  const hari = F.upcomingDays(7, '2026-10-08')
  samakan('kalender mulai besok', hari[0]?.date, '2026-10-09')
  // 2026-10-10 Sabtu, 2026-10-11 Minggu.
  cek('akhir pekan ditandai', hari[1]?.isWeekend === true && hari[2]?.isWeekend === true && hari[0]?.isWeekend === false)
}

console.log('\n' + (gagal ? 'GAGAL ' + gagal : 'SEMUA OK') + ' — ' + ok + ' cek\n')
process.exit(gagal ? 1 : 0)
