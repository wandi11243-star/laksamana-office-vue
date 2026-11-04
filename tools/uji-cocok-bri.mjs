/*
 * tools/uji-cocok-bri.mjs — guard for app/utils/cocok-bri.ts.
 *
 *   node tools/uji-cocok-bri.mjs      (Node 24: imports the .ts directly)
 *
 * The rules that move money silently if they drift:
 *   - matching is FOUR GLOBAL ROUNDS, not greedy per row;
 *   - short names match EXACTLY (`Ika` must not grab `Rika`);
 *   - a DP already held by a live row is never offered again;
 *   - which DPs count as BRI is decided by the DP METHOD, not `tfBank`;
 *   - rows without a date stand LAST, cancelled rows leave every sum.
 * The exported functions are also compared FUNCTION BY FUNCTION with the old
 * engine (deploy/assets/cocok-bri.js, run through `new Function('window',…)`),
 * skipped clearly when ../laksamana-office is absent.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as CB from '../app/utils/cocok-bri.ts'

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
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const baris = o => ({ id: '', tgl: '', jam: '', nominal: 0, ket: '', resId: '', dpId: '', resNama: '', cara: '', catatan: '', sumber: 'manual', batalAt: 0, ...o })
const dp = o => ({ resId: 'r1', dpId: 'd1', nama: '', resTgl: '', tfTgl: '', tfJam: '', bank: '', metode: '', status: '', nominal: 0, diketik: 0, bukti: '', buktiNama: '', ...o })

console.log('\ncocok-bri: angka & waktu')
// Pemisah desimal = pemisah PALING BELAKANG (aturan lama, disengaja): API v1
// mengirim nominal sebagai angka JSON, jadi quirk ini hanya menyentuh teks
// bebas (mis. tfAmount hasil OCR) dan HARUS sama dengan layar lama.
cek('cbNum baca pemisah ala lama: "1.234,56" & "1,234.56" sama-sama benar', CB.cbNum('1.234,56') === 1234.56 && CB.cbNum('1,234.56') === 1234.56 && CB.cbNum('Rp 1.500.000') === 1500 && CB.cbNum('-2.000') === -2 && CB.cbNum(null) === 0)
cek('cbJamWIB menormalkan AM/PM, 24 jam', CB.cbJamWIB('07:30 PM') === '19:30' && CB.cbJamWIB('7.05 am') === '07:05' && CB.cbJamWIB('19:30:00') === '19:30' && CB.cbJamWIB('13:00 PM') === '13:00' && CB.cbJamWIB('') === '')
cek('cbTglID & rentang bulan (termasuk Februari kabisat)', CB.cbTglID('2026-10-05') === '5 Okt 2026' && CB.rentangBulan('2026-02').sampai === '2026-02-28' && CB.rentangBulan('2024-02').sampai === '2024-02-29')

console.log('\ncocok-bri: nama')
cek('nama diambil sesudah titik dua', CB.cbNamaDari('Reservasi : Arlanda') === 'Arlanda' && CB.cbNamaDari('PT. Ibra Harisindo') === 'PT. Ibra Harisindo' && CB.cbNamaDari('Nobar:Zhafira') === 'Zhafira')
cek('nama pendek WAJIB persis, panjang boleh sebagian', CB.cbNamaCocok('Nur', 'Nurlaila') === false && CB.cbNamaCocok('Nur', 'NUR') === true && CB.cbNamaCocok('Fenty', 'Fenty Aprilia') === true && CB.cbNamaCocok('Arlanda', 'arlanda') === true && CB.cbNamaCocok('', 'X') === false)

console.log('\ncocok-bri: usulan empat babak')
const dps = [
  dp({ dpId: 'd1', nama: 'Fenty', nominal: 100000, tfTgl: '2026-10-01', metode: 'QRIS BRI' }),
  dp({ dpId: 'd2', nama: 'Zhafira', nominal: 250000, tfTgl: '2026-10-02', metode: 'QRIS BRI' }),
  dp({ dpId: 'd3', nama: 'Arlanda', nominal: 300000, tfTgl: '2026-10-03', metode: 'QRIS BRI' }),
]
const us = CB.cbUsulan([
  baris({ id: 'm1', ket: 'Reservasi : Fenty', tgl: '2026-10-01', nominal: 100000 }),
  baris({ id: 'm2', ket: 'Reservasi : Zhafira', tgl: '2026-09-30', nominal: 250000 }),
  baris({ id: 'm3', ket: '', tgl: '2026-10-03', nominal: 300000 }),
], dps)
cek('babak 1 "nama-tgl" pasti; babak 3 "nama" tidak pasti; babak 4 "tgl"', us.m1?.babak.kode === 'nama-tgl' && us.m1.babak.pasti && us.m2?.babak.kode === 'nama' && !us.m2.babak.pasti && us.m3?.babak.kode === 'tgl' && !us.m3.babak.pasti, JSON.stringify(Object.fromEntries(Object.entries(us).map(([k, v]) => [k, v.babak.kode]))))

console.log('\ncocok-bri: sapuan global (bukan serakah per baris)')
const dps2 = [dp({ dpId: 'x1', nama: 'Fenty', nominal: 100000, tfTgl: '2026-10-01' })]
const us2 = CB.cbUsulan([
  baris({ id: 'a', ket: '', tgl: '2026-10-01', nominal: 100000 }),
  baris({ id: 'b', ket: 'Reservasi : Fenty', tgl: '2026-10-02', nominal: 100000 }),
], dps2)
cek('baris tanpa nama TIDAK merebut DP yang baris bernama butuh', !us2.a && us2.b?.babak.kode === 'nama')

console.log('\ncocok-bri: DP & penyaring')
cek('dpKeBri hanya dari METODE (QRIS/BRI), bukan bank pengirim', CB.dpKeBri({ metode: 'QRIS BCA' }) && CB.dpKeBri({ metode: 'Transfer BRI' }) && !CB.dpKeBri({ metode: 'Transfer BCA' }) && !CB.dpKeBri({ metode: 'Mandiri' }))
cek('tanpa metode → jatuh ke bank struk (tebakan)', CB.dpKeBri({ bank: 'BRI' }) && CB.dpKeBri({ bank: 'QRIS' }) && !CB.dpKeBri({ bank: 'BCA' }))
const rowsBulan = [
  baris({ id: 'r1', dpId: 'd1', cara: 'cocok', nominal: 100000, tgl: '2026-10-01' }),
  baris({ id: 'r2', dpId: 'd9', cara: 'lepas', nominal: 100000, tgl: '2026-10-01' }),
  baris({ id: 'r3', nominal: 50000, tgl: '2026-10-01' }),
]
const bulan = CB.dpsBulan(dps.concat([dp({ dpId: 'd4', nama: 'Budi', nominal: 1, tfTgl: '' })]), rowsBulan, {}, '2026-10', { far: true })
cek('dipakai ditandai; tanpa tanggal transfer selalu ikut; bulan lain tidak', bulan.find(d => d.dpId === 'd1').dipakai === true && bulan.find(d => d.dpId === 'd4') !== undefined && bulan.find(d => d.dpId === 'd2') !== undefined)
cek('DP bertanda abai tidak pernah ditawarkan', CB.dpsBulan(dps, [], { d1: { dpId: 'd1', alasan: 'dobel' } }, '2026-10').some(d => d.dpId === 'd1') === false)

console.log('\ncocok-bri: daftar, ringkasan, saringan')
const gab = CB.barisGabungan([
  baris({ id: 'g2', tgl: '2026-10-02', jam: '07:30 PM', nominal: 200000, ket: 'B' }),
  baris({ id: 'g1', tgl: '2026-10-02', jam: '09:00', nominal: 100000, ket: 'A' }),
  baris({ id: 'g3', tgl: '', jam: '', nominal: 50000, ket: 'tanpa tgl' }),
], dps)
cek('urut waktu (jam dinormalkan), tanpa tanggal SELALU di bawah', sama(gab.map(x => x.id), ['g1', 'g2', 'g3']) && gab[1].jam === '19:30')
const st = CB.statistikBri([
  baris({ id: 's1', cara: 'cocok', nominal: 100000, tgl: '2026-10-01' }),
  baris({ id: 's2', cara: 'bukan', nominal: 50000, tgl: '2026-10-01' }),
  baris({ id: 's3', nominal: 25000, tgl: '2026-10-01' }),
  baris({ id: 's4', nominal: 999999, tgl: '2026-10-01', batalAt: 1700000000000 }),
  baris({ id: 's5', nominal: 30000, tgl: '' }),
])
cek('ringkasan: batal dihitung tapi tidak dijumlah; tanpa tgl disebut', st.dana.total === 205000 && st.dana.n === 4 && st.dana.batal === 1 && st.rsv.total === 100000 && st.luar.total === 50000 && st.belum.total === 55000 && st.tanpaTgl === 1, JSON.stringify(st))
cek('saringan tapis + kata kunci menyentuh nama DP', CB.filterBarisGab(gab, 'semua', 'fenty').length === 0 && CB.filterBarisGab([{ ...gab[0], mut: baris({ id: 'x', cara: 'cocok', resNama: 'Fenty', nominal: 1 }) }], 'rsv', 'fenty').length === 1 && CB.filterBarisGab(gab, 'belum', '').length === 3)

console.log('\ncocok-bri: kartu DP')
const luar = CB.dpLuarBri([dp({ dpId: 'l1', metode: 'Transfer BCA', tfTgl: '2026-10-02' }), dp({ dpId: 'l2', metode: 'QRIS BRI', tfTgl: '2026-10-02' })], {}, '2026-10')
cek('dpLuarBri kebalikan dpKeBri + rentang bulan', sama(luar.map(d => d.dpId), ['l1']))
cek('caraLuar & namaLuar unik dan dibatasi', sama(CB.caraLuar([dp({ metode: 'BCA' }), dp({ metode: 'BCA' }), dp({ bank: 'Mandiri' })]), ['BCA', 'Mandiri']))
const abaiMp = { d1: { dpId: 'd1', alasan: 'dobel' } }
cek('dpBelumDicatat hanya BRI & belum dipakai', CB.dpBelumDicatat(CB.dpsBulan(dps, [], {}, '2026-10')).map(d => d.dpId).join(',') === 'd1,d2,d3')
cek('dpBernisan menampilkan yang ditandai, dengan tombol pulih', CB.dpBernisan(dps, [], abaiMp, '2026-10').map(d => d.dpId).join(',') === 'd1')
cek('bukti: penanda @f:, jenis dari nama', CB.cbBuktiRef('@f:abc') && CB.cbBuktiKey('@f:abc') === 'abc' && CB.cbBuktiGambar('@f:abc', 'bukti.pdf') === false && CB.cbBuktiGambar('@f:abc', 'bukti.jpg') === true && CB.cbBuktiGambar('data:image/png;base64,x', '') === true)

console.log('\ncocok-bri: kembar dengan mesin Office lama')
const LAMA = path.resolve(import.meta.dirname, '../../laksamana-office')
const fMesin = path.join(LAMA, 'deploy/assets/cocok-bri.js')
if (!fs.existsSync(fMesin)) {
  if (process.env.STRICT === '1') {
    gagal++
    console.log('  STRICT ../laksamana-office tidak ada')
  }
  else {
    lewat++
    console.log('  LEWAT ../laksamana-office tidak ada')
  }
}
else {
  const G = {}
  const docPalsu = { head: null, activeElement: null, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) }
  try {
    new Function('window', 'document', fs.readFileSync(fMesin, 'utf8'))(G, docPalsu)
  }
  catch (e) {
    gagal++
    console.log('  GAGAL mesin lama tidak jalan  — ' + e.message)
  }
  cek('mesin lama mengekspor fungsi yang dibandingkan', typeof G.cbUsulan === 'function' && typeof G.cbJamWIB === 'function' && typeof G.cbNamaCocok === 'function')
  const jamUji = ['07:30 PM', '7.05 am', '19:30:00', '13:00 PM', '', '10:31 Pembayaran', '12:00 am', '12:30 p.m.']
  cek('cbJamWIB identik dengan mesin lama', jamUji.every(x => CB.cbJamWIB(x) === G.cbJamWIB(x)), jamUji.map(x => `${x}→${CB.cbJamWIB(x)}/${G.cbJamWIB(x)}`).join(' '))
  const namaUji = [['Nur', 'Nurlaila'], ['Nur', 'NUR'], ['Fenty', 'Fenty Aprilia'], ['Ika', 'Rika'], ['', 'X'], ['Arlanda', 'arlanda']]
  cek('cbNamaCocok identik dengan mesin lama', namaUji.every(([a, b]) => CB.cbNamaCocok(a, b) === G.cbNamaCocok(a, b)))
  const ketUji = ['Reservasi : Arlanda', 'PT. Ibra Harisindo', 'Nobar:Zhafira', '']
  cek('cbNamaDari identik dengan mesin lama', ketUji.every(x => CB.cbNamaDari(x) === G.cbNamaDari(x)))
  const tglUji = ['2026-10-05', '2026-02-28', 'bukan-tanggal', '']
  cek('cbTglID identik dengan mesin lama', tglUji.every(x => CB.cbTglID(x) === G.cbTglID(x)))
  const dpsLama = dps.map(d => ({ ...d }))
  const mutLama = [
    baris({ id: 'm1', ket: 'Reservasi : Fenty', tgl: '2026-10-01', nominal: 100000 }),
    baris({ id: 'm2', ket: 'Reservasi : Zhafira', tgl: '2026-09-30', nominal: 250000 }),
    baris({ id: 'm3', ket: '', tgl: '2026-10-03', nominal: 300000 }),
    baris({ id: 'm4', ket: 'Reservasi : Fenty', tgl: '2026-10-01', nominal: 100000 }),
  ]
  const peta = u => Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.dp.dpId + ':' + v.babak.kode]))
  cek('cbUsulan identik dengan mesin lama (termasuk perebutan DP)', sama(peta(CB.cbUsulan(mutLama, dpsLama)), peta(G.cbUsulan(mutLama, dpsLama))), JSON.stringify(peta(G.cbUsulan(mutLama, dpsLama))))
}

console.log(`\n${ok} OK, ${gagal} GAGAL, ${lewat} LEWAT`)
process.exit(gagal ? 1 : 0)
