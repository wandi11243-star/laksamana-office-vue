/*
 * tools/uji-kompas.mjs — guard for app/utils/kompas.ts.
 *
 *   node tools/uji-kompas.mjs      (Node 24: imports the .ts directly)
 *
 * The derived numbers of the omset blob, and the Input Omset Harian
 * validation. A drift here silently moves revenue between screens.
 * The old formulas are also checked in the legacy source when it is present.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as K from '../app/utils/kompas.ts'

let ok = 0
let gagal = 0
let lewat = 0
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

const hari = { date: '2026-10-05', food: 1000000, bev: 500000, lainnya: 100000, discount: 50000, service_charge: 70000, tax: 140000, traffic: 40, bill: 25, qty_food: 30, qty_bev: 20, qty_others: 5 }

console.log('\nkompas: angka turunan')
cek('gross/net/taxSvc/tagihan', K.grossOf(hari) === 1600000 && K.netOf(hari) === 1550000 && K.taxSvcOf(hari) === 210000 && K.tagihanOf(hari) === 1760000)
cek('avgSpend = net ÷ bill; items = Σ qty; bill 0 → 0', K.avgSpendOf(hari) === 62000 && K.itemsOf(hari) === 55 && K.avgSpendOf({ ...hari, bill: 0 }) === 0)
cek('kNum membuang pemisah, minus tetap', K.kNum('Rp 1.500.000') === 1500000 && K.kNum('-2.000') === -2000 && K.kNum(null) === 0)
cek('monthKeyOf', K.monthKeyOf('2026-10-05') === '2026-10' && K.monthKeyOf('') === '')

console.log('\nkompas: validasi Input Omset Harian')
cek('hari sehat tidak punya galat', K.validasiHarian(hari).length === 0)
cek('negatif ditolak', K.validasiHarian({ ...hari, food: -1 }).includes('Nilai tidak boleh negatif.'))
cek('pendapatan nol ditolak', K.validasiHarian({ ...hari, food: 0, bev: 0, lainnya: 0 }).includes('Pendapatan tidak boleh kosong.'))
cek('diskon > gross ditolak', K.validasiHarian({ ...hari, discount: 2000000 }).includes('Diskon melebihi total pendapatan.'))
cek('traffic < bill ditolak', K.validasiHarian({ ...hari, traffic: 10 }).includes('Traffic harus ≥ jumlah Bill.'))
cek('galat kembar digabung', K.validasiHarian({ ...hari, food: -1, bev: -1 }).filter(x => x === 'Nilai tidak boleh negatif.').length === 1)

console.log('\nkompas: kembar dengan Office lama')
const fLama = path.resolve(import.meta.dirname, '../../laksamana-office/deploy/finance/omset/index.html')
if (!fs.existsSync(fLama)) {
  lewat++
  console.log('  LEWAT ../laksamana-office tidak ada')
}
else {
  const src = fs.readFileSync(fLama, 'utf8')
  cek('netOf/tagihanOf/avgSpendOf lama masih berbunyi sama', /function netOf\(d\)\{ return grossOf\(d\)-num\(d\.discount\); \}/.test(src)
  && /function tagihanOf\(d\)\{ return netOf\(d\)\+taxSvcOf\(d\); \}/.test(src)
  && /function avgSpendOf\(d\)\{ const b=num\(d\.bill\); return b>0\?netOf\(d\)\/b:0; \}/.test(src))
  cek('validasi lama masih berbunyi sama', src.includes('Nilai tidak boleh negatif.') && src.includes('Pendapatan tidak boleh kosong.') && src.includes('Diskon melebihi total pendapatan.') && src.includes('Traffic harus ≥ jumlah Bill.'))
  cek('gerbang selisih Report Daily TIDAK ada lagi di saveDaily', !/selisih.*tolak|lewat toleransi.*return/.test(src.slice(src.indexOf('function saveDaily'), src.indexOf('function saveDaily') + 1500)))

  console.log('\nkompas: rekap penjualan (rkHitung)')
  const rec = { date: '2026-10-05', pay: { cash: { pos: 1000000, actual: 990000 }, qris_bri: { pos: 500000, actual: 495000 }, compliment: { pos: 50000, actual: 50000 } } }
  const omsetR = { date: '2026-10-05', food: 1400000, bev: 0, lainnya: 0, discount: 0, service_charge: 0, tax: 0, bill: 0, traffic: 0, qty_food: 0, qty_bev: 0, qty_others: 0 }
  const tanpaPiutang = K.hitungRekapHari(rec, omsetR, [], '2026-10-05')
  cek('tanpa aktual diketik: MDR 0, akt = kotor (semua aktual masuk)', tanpaPiutang.g.qris_bri.mdr === 0 && tanpaPiutang.g.qris_bri.akt === 495000 && tanpaPiutang.g.cash.mdr === 0)
  cek('rekapAkt = setoran − MDR (+ dana lebih)', tanpaPiutang.rekapAkt === 1535000 && tanpaPiutang.mdrTotal === 0 && tanpaPiutang.kotorMdr === 495000)
  cek('kelompok ber-POS punya selisih; tanpa POS adjust = akt', tanpaPiutang.g.qris_bri.selisih === 5000 && tanpaPiutang.g.cash.selisih === 10000)
  const terketik = K.hitungRekapHari(rec, omsetR, [], '2026-10-05', { aktual: { qris_bri: 490000 } })
  cek('aktual yang DIKETIK menggantikan hitungan; MDR jadi selisihnya', terketik.g.qris_bri.akt === 490000 && terketik.g.qris_bri.mdr === 5000 && terketik.g.qris_bri.diketik && terketik.mdrTotal === 5000)
  const mdrLama = K.hitungRekapHari({ ...rec, mdr: { qris_bri: 7000 } }, omsetR, [], '2026-10-05')
  cek('MDR tersimpan dipakai saat aktual tidak diketik', mdrLama.g.qris_bri.akt === 488000 && mdrLama.g.qris_bri.mdr === 7000)
  const berlebih = K.hitungRekapHari(rec, omsetR, [], '2026-10-05', { aktual: { qris_bri: 508000 }, mdrman: { qris_bri: 2000 } })
  cek('aktual berlebih: MDR manual menang, dana lebih dihitung', berlebih.g.qris_bri.mdr === 2000 && berlebih.g.qris_bri.lebih === 15000 && berlebih.rekapAkt === 1535000 - 2000 + 15000)
  const bon = K.hitungRekapHari(rec, omsetR, [{ date: '2026-10-01', status: 'lunas', lunasDate: '2026-10-05', nominal: 25000 }], '2026-10-05')
  cek('koreksi bon ikut ke selisih; tanpa svc & tax ditandai', bon.bon.koreksi === 25000 && bon.selisihTotal === 1400000 - bon.rekapAkt + 25000 && bon.tanpaSvcTax === true)
  cek('RK_PAY mencakup compliment/member deposit/voucher/error kitchen', ['compliment', 'member_dep', 'voucher', 'error_kitchen'].every(k => K.RK_PAY.includes(k)) && K.RK_GRUP.length === 13)
}

console.log(`\n${ok} OK, ${gagal} GAGAL, ${lewat} LEWAT`)
process.exit(gagal ? 1 : 0)
