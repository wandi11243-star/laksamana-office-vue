/*
 * tools/uji-cashier.mjs — guard for app/utils/cashier.ts.
 *
 *   node tools/uji-cashier.mjs      (Node 24: imports the .ts directly)
 *
 * The rules the old screen's comments record, each of which fails SILENTLY:
 *   - only the TOTAL is judged, Rp5.000 exactly is still fine;
 *   - an unfilled row (POS 0, Actual 0) is not judged AND its bon leaves the total;
 *   - payment of a bon is booked on the day the money arrived;
 *   - open bon group per lower-cased name + type, biggest debt first;
 *   - compliment vs Daily Report uses POS, not Actual;
 *   - the submit trail keeps the last 20, old rows read back their by/at.
 * Plus PAYS: identical to the old Cashier list AND to Finance › Omset (both
 * write DB.reports[date].pay). Skipped clearly when ../laksamana-office is absent.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as C from '../app/utils/cashier.ts'

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

console.log('\ncashier: angka & format')
cek('num membuang pemisah, minus tetap', C.num('Rp1.500.000') === 1500000 && C.num('-2.000') === -2000 && C.num(null) === 0)
cek('fmtSel bertanda', C.fmtSel(1500) === '+Rp1.500' && C.fmtSel(-1500) === '−Rp1.500' && C.fmtSel(0) === 'Rp0')
cek('payName: kunci tak dikenal tampil apa adanya', C.payName('qris_esb') === 'QRIS POS' && C.payName('zz') === 'zz' && C.payName() === '—')

console.log('\ncashier: Report Daily')
const kosongPay = () => Object.fromEntries(C.PAYS.map(p => [p.k, { pos: 0, actual: 0 }]))
const bon = [
  { id: 'a', date: '2026-10-01', nama: 'Pak Budi', tipe: 'tamu', nominal: 100000, payKey: 'cash', status: 'open' },
  { id: 'b', date: '2026-09-20', nama: 'pak budi ', tipe: 'tamu', nominal: 50000, payKey: 'cash', status: 'lunas', lunasDate: '2026-10-01', lunasPayKey: 'qris_bri' },
  { id: 'c', date: '2026-10-01', nama: 'Bu Julita', tipe: 'owner', nominal: 300000, payKey: 'edc_bca', status: 'open' },
]
const bh = C.penjelasHari(bon, '2026-10-01')
cek('bon baru per metode', bh.baru.cash === 100000 && bh.baru.edc_bca === 300000 && bh.totBaru === 400000)
cek('pelunasan dicatat di tanggal uang masuk, lewat metode pelunasan', bh.lunas.qris_bri === 50000 && bh.totLunas === 50000)
cek('harus = pelunasan − bon', bh.harus.cash === -100000 && bh.harus.qris_bri === 50000 && bh.totHarus === -350000)
cek('tanggal lain tidak punya bon', !C.bonRingkasHari(bon, '2026-10-02').ada)

let pay = kosongPay()
pay.cash = { pos: 500000, actual: 400000 }
pay.qris_bri = { pos: 200000, actual: 250000 }
let h = C.hitungReport(pay, bh)
cek('baris kosong (EDC BCA) tidak dinilai, bonnya keluar dari total', h.th === -50000, `th=${h.th}`)
cek('sisa = tsel − th', h.tsel === -50000 && h.sisa === 0 && h.aman)
cek('baris yang sudah terjelaskan tidak masuk catatan', h.bermasalah.length === 0, JSON.stringify(h.bermasalah))

pay = kosongPay()
pay.cash = { pos: 100000, actual: 95000 }
h = C.hitungReport(pay, C.penjelasHari([], '2026-10-01'))
cek('Rp5.000 TEPAT masih aman', h.sisa === -5000 && h.aman)
pay.cash = { pos: 100000, actual: 94999 }
h = C.hitungReport(pay, C.penjelasHari([], '2026-10-01'))
cek('Rp5.001 lewat toleransi', !h.aman && h.bermasalah.length === 1)
pay = kosongPay()
pay.qris_bri = { pos: 0, actual: 20000 }
pay.cash = { pos: 20000, actual: 0 }
h = C.hitungReport(pay, C.penjelasHari([], '2026-10-01'))
cek('selisih antar metode saling menutup: total nol, keduanya tetap disebut', h.sisa === 0 && h.aman && h.bermasalah.length === 2)

console.log('\ncashier: piutang')
const g = C.bonGrupBelum([...bon, { id: 'd', date: '2026-09-01', nama: 'PAK BUDI', tipe: 'tamu', nominal: 500000, payKey: 'cash', status: 'open' }])
cek('grup per nama huruf kecil + tipe', g.length === 2 && g[0].items.length === 2, JSON.stringify(g.map(x => [x.nama, x.items.length])))
cek('utang terbesar di atas', g[0].total === 600000 && g[1].total === 300000)
cek('isi grup urut tanggal bill', g[0].items[0].date === '2026-09-01')
cek('bon lunas tidak ikut grup', !g.some(x => x.items.some(b => b.id === 'b')))
cek('namaUnik maks tiga + dkk', C.namaUnik([{ nama: 'A' }, { nama: 'B' }, { nama: 'A' }, { nama: 'C' }, { nama: 'D' }]) === 'A, B, C dkk')

console.log('\ncashier: jejak submit')
let log = []
for (let i = 0; i < 25; i++) log = C.tambahJejak({ log }, 'k' + i, i)
cek('jejak maks 20, yang terbaru di ujung', log.length === 20 && log[19].by === 'k24' && log[0].by === 'k5')
cek('baris lama dibaca dari by/at', sama(C.jejakList({ by: 'Ani', at: 5 }), [{ by: 'Ani', at: 5 }]) && C.jejakList(null).length === 0)

console.log('\ncashier: compliment')
const roster = [
  { id: '1', name: 'Kasir A', keterangan: 'Kasir', active: true },
  { id: '2', name: 'Marketing B', keterangan: 'Marketing, Head', active: true },
  { id: '3', name: 'Mati', keterangan: 'Kasir', active: false },
  { id: '4', name: 'Kitchen', keterangan: 'Kitchen', active: true },
  { id: '5', name: 'Rangkap', keterangan: 'Office/Event', active: true },
]
const o = C.rosterComp(roster)
cek('roster PIC: aktif & ber-Tim dikenal saja', sama(o.map(x => x.id), ['1', '2', '5']))
cek('divPemberi: marketing > event > office', C.divPemberi(o[1]) === 'marketing' && C.divPemberi(o[2]) === 'event' && C.divPemberi(o[0]) === '')
const rep = { pay: { compliment: { pos: 100000, actual: 0 }, member_dep: { pos: 50000, actual: 0 } } }
cek('cocok = POS compliment + POS member deposit', C.angkaRD(rep, 150000).cocok && !C.angkaRD(rep, 140000).cocok)
cek('tanpa report: tidak pernah cocok', !C.angkaRD(null, 0).cocok && C.angkaRD(null, 0).ada === false)
cek('ganti pemberi terdeteksi', C.gantiPemberi({ pemberiOfficeId: '2', pemberiName: 'B' }, { pemberiOfficeId: '5', pemberiName: 'E' }) && !C.gantiPemberi({ pemberiOfficeId: '2', pemberiName: 'B' }, { pemberiOfficeId: '2', pemberiName: 'B' }))
cek('status pemberi tak dikenal = menunggu', C.compStatusPemberi({ pemberiStatus: 'aneh' }) === 'menunggu' && C.compStatusPemberi({ pemberiStatus: 'potong' }) === 'potong')

console.log('\ncashier: PAYS kembar dengan Office lama')
const LAMA = path.resolve(import.meta.dirname, '../../laksamana-office/deploy')
const ambilPays = (f) => {
  const s = fs.readFileSync(f, 'utf8')
  const m = s.match(/const PAYS\s*=\s*\[([\s\S]*?)\];/)
  return m ? [...m[1].matchAll(/\{\s*k:\s*'([^']+)'\s*,\s*n:\s*'([^']+)'/g)].map(x => ({ k: x[1], n: x[2] })) : null
}
for (const rel of ['cashier/index.html', 'finance/omset/index.html']) {
  const f = path.join(LAMA, rel)
  if (!fs.existsSync(f)) {
    lewat++
    console.log('  LEWAT ' + rel + ' tidak ada')
    continue
  }
  const p = ambilPays(f)
  cek(`PAYS sama persis dengan ${rel}`, p && sama(p, C.PAYS.map(x => ({ k: x.k, n: x.n }))), p ? JSON.stringify(p.map(x => x.k)) : 'PAYS tidak ketemu')
}

console.log(`\n${ok} OK, ${gagal} GAGAL${lewat ? `, ${lewat} LEWAT` : ''}\n`)
process.exit(gagal ? 1 : 0)
