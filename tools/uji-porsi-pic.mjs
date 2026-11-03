/*
 * tools/uji-porsi-pic.mjs — guard for app/utils/porsi-pic.ts.
 *
 *   node tools/uji-porsi-pic.mjs      (Node 24: imports the .ts directly)
 *
 * The rules that fail SILENTLY and move real money:
 *   - K-04: the cashier porsiPic (tiket → half) must stay DIFFERENT from the
 *     Kompas one (amount + tax + service + obTotal; event → half + obTotal);
 *   - event rows are deducted per SHIFT, DW never joins the split;
 *   - only MARKETING rows deduct the cashier (since 7 Aug 2026);
 *   - `ditempat` rows and payGroup=false rows never deduct;
 *   - Open Bill is recognition only: never inside the cashier's porsiPic;
 *   - compliment cuts subTotal only; old rows fall back to nominal;
 *   - bonus ladder from the recognised figure, top level uncapped.
 * Plus: our BONUS_KASIR and both old porsiPic formulas are compared with
 * ../laksamana-office when that folder is present.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as P from '../app/utils/porsi-pic.ts'

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

console.log('\nporsi-pic: angka')
cek('ppNum membuang pemisah, minus tetap', P.ppNum('Rp1.500.000') === 1500000 && P.ppNum('-2.000') === -2000 && P.ppNum(null) === 0)

console.log('\nporsi-pic: K-04 — dua porsiPic yang SENGAJA beda')
cek('cashier: tiket → separuh dibulatkan', P.porsiPicCashier({ amount: 100, tiket: true }) === 50 && P.porsiPicCashier({ amount: 99, tiket: true }) === 50)
cek('cashier: bukan tiket → penuh, tax/service TIDAK ditambah', P.porsiPicCashier({ amount: 100, tiket: false, tax: 10, service: 5, ob: true, obAmount: 7 }) === 100)
cek('kompas marketing: amount + tax + service + obTotal', P.porsiPicKompas({ amount: 100, tax: 10, service: 5, ob: true, obAmount: 4, obTax: 2, obService: 1 }, 'marketing') === 122)
cek('kompas event: separuh + obTotal', P.porsiPicKompas({ amount: 99, ob: true, obAmount: 4, obTax: 2, obService: 1 }, 'event') === 57)
cek('obTotal hanya saat baris dicentang', P.obTotal({ ob: false, obAmount: 9 }) === 0 && P.obAktif({ ob: true }) === true)
cek('openBillList dari marketing & event, lewati nol', sama(P.openBillList({
  date: '2026-10-01',
  bd: {
    marketing: [{ ob: true, obAmount: 10, obKasirId: 'k1', eventName: 'GIG' }, { ob: true, obAmount: 0, obKasirId: 'k2' }],
    event: [{ ob: true, obAmount: 5 }],
  },
}), [{ kasirId: 'k1', eventName: 'GIG', total: 10 }, { kasirId: '', eventName: '', total: 5 }]))

console.log('\nporsi-pic: potongan kasir')
cek('potongKasirAktif: ditempat/off-payGroup tidak memotong', !P.potongKasirAktif({ menuFix: 'ditempat' }) && !P.potongKasirAktif({ payGroup: false }) && P.potongKasirAktif({}) && P.potongKasirAktif({ menuFix: 'tetap', payGroup: false }))
const pb = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'], dw: 3 })
cek('dibagi per SHIFT, DW tidak ikut membagi', pb.per === 50 && pb.pembagi === 2 && pb.dw === 3 && sama(pb.ids, ['k1', 'k2']))
cek('baris non-potong (ditempat/off-payGroup) = nol walau shift tersimpan', P.potonganBaris({ amount: 100, shift: ['k1'], menuFix: 'ditempat' }).per === 0 && P.potonganBaris({ amount: 100, shift: ['k1'], payGroup: false }).total === 0)
cek('shift kosong → tak dibebankan ke siapa pun', P.potonganBaris({ amount: 100 }).per === 0 && P.potonganBaris({ amount: 100 }).pembagi === 0 && P.potonganBaris({ amount: 100 }).total === 100)
const day = {
  date: '2026-10-02',
  bd: {
    marketing: [{ amount: 100, shift: ['k1', 'k2'] }, { amount: 60, shift: ['k1'], menuFix: 'ditempat' }],
    event: [{ amount: 100, shift: ['k1'] }],
  },
}
cek('potonganHari: hanya baris marketing, per shift', P.potonganHari(day, 'k1') === 50 && P.potonganHari(day, 'k2') === 50)
// K-04 di sisi potongan: versi Kompas memotong kolom Omset PENUH; versi Cashier
// membelah baris free-entry. Dua jawaban berbeda untuk baris yang sama —
// disengaja, dan keduanya diuji supaya tidak ada yang "merapikan" salah satunya.
const dayTiket = { date: '2026-10-02', bd: { marketing: [{ amount: 100, tiket: true, shift: ['k1'] }] } }
cek('Kompas potong amount penuh; cashier membelah free-entry', P.potonganHariKompas(dayTiket, 'k1') === 100 && P.potonganHari(dayTiket, 'k1') === 50 && P.potonganBarisKompas({ amount: 100, tiket: true, shift: ['k1'] }).per === 100)
cek('Kompas: baris non-potong = nol juga', P.potonganBarisKompas({ amount: 100, shift: ['k1'], menuFix: 'ditempat' }).total === 0 && P.potonganBarisKompas({ amount: 100, shift: ['k1', 'k2'] }).per === 50)
const tanpa = P.barisTanpaShift({
  date: '2026-10-03',
  bd: { marketing: [{ amount: 10 }, { amount: 10, shift: ['k1'] }, { amount: 10, menuFix: 'ditempat' }, { amount: 10, payGroup: false }, { amount: 0 }] },
})
cek('barisTanpaShift menyaring baris non-potong & nol', sama(tanpa.map(r => r.amount), [10]))
cek('omsetKasir bruto − diskon; baris OFF tanpa diskon', P.omsetKasir({ amount: 100, disc: 20 }) === 80 && P.diskonKasir({ off: true, disc: 20 }) === 0 && P.diskonKasir({ disc: 20 }) === 20)

console.log('\nporsi-pic: tangga bonus')
cek('level & next benar', P.bonusKasir(250000000).label === 'Level 4' && P.bonusKasir(250000000).next === null && P.bonusKasir(149999999).label === 'Level 2' && P.bonusKasir(149999999).next.label === 'Level 3')
cek('bawah level 1 → Standar kerja, next Level 1', P.bonusKasir(0).bonus === 0 && P.bonusKasir(79999999).label === 'Standar kerja' && P.bonusKasir(79999999).next.label === 'Level 1')

console.log('\nporsi-pic: Tim/Keterangan & compliment')
const ket = { '#u1': 'Floor, Kasir', '#u2': 'kasir', '#u3': 'kasir/office', '@budi': 'Kasir' }
const pic = (id, name, oid) => ({ id, name, officeUserId: oid })
cek('kasirMurni: hanya kata tunggal "kasir"', !P.kasirMurni(pic('a', 'A', 'u1'), ket) && P.kasirMurni(pic('b', 'B', 'u2'), ket) && !P.kasirMurni(pic('c', 'C', 'u3'), ket) && P.kasirMurni(pic('d', 'Budi'), ket))
cek('keterangan tak dikenal TETAP tampil', P.kasirMurni(pic('e', 'E', 'u9'), ket) && P.kasirMurni(pic('f', 'F'), null))
cek('ketKasir: id dulu, baru nama', P.ketKasir(pic('x', 'B', 'u1'), ket) === 'Floor, Kasir' && P.ketKasir(pic('y', 'budi', null), ket) === 'Kasir' && P.ketKasir(null, ket) === null)
const kList = [pic('a', 'Andi', 'u1'), pic('b', 'Budi', null)]
cek('kasirSaya: officeUserId dulu, nama sebagai cadangan', P.kasirSaya(kList, { id: 'u1', name: 'X' }).name === 'Andi' && P.kasirSaya(kList, { id: 'zz', name: 'budi' }).name === 'Budi' && P.kasirSaya(kList, null) === null)
cek('compPotong: subTotal saja; catatan lama → nominal; 0 tetap 0', P.compPotong({ subTotal: 30, nominal: 99 }) === 30 && P.compPotong({ subTotal: null, nominal: 99 }) === 99 && P.compPotong({ subTotal: 0, nominal: 99 }) === 0)
const comps = [
  { date: '2026-10-01', picDiv: 'kasir', picOfficeId: 'u1', picName: 'Andi', subTotal: 10, nominal: 10 },
  { date: '2026-10-01', pemberiDiv: 'marketing', pemberiOfficeId: 'u2', pemberiName: 'Budi', subTotal: 20, nominal: 20 },
  { date: '2026-10-01', picDiv: 'tamu', picName: 'Andi', subTotal: 30, nominal: 30 },
]
cek('compFilterPic: PIC kasir atau pemberi; tamu tidak pernah', P.compFilterPic(comps, pic('a', 'Andi', 'u1')).length === 1 && P.compFilterPic(comps, pic('b', 'Budi', 'u2')).length === 1 && P.compFilterPic(comps, null).length === 0)
cek('compFilterPic: nama dipakai saat id tidak ada', P.compFilterPic(comps, pic('c', 'andi', null)).length === 1)

console.log('\nporsi-pic: nominal per kasir (shiftNom)')
const m1 = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 60, k2: 40 } })
cek('manual pas: manual + nominal per kasir, per dikosongkan', m1.manual === true && m1.nom.k1 === 60 && m1.nom.k2 === 40 && m1.per === 0)
cek('bagianPotong membaca nominal; kasir luar nol', P.bagianPotong(m1, 'k1') === 60 && P.bagianPotong(m1, 'k2') === 40 && P.bagianPotong(m1, 'k3') === 0)
const mEven = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'] })
cek('tanpa shiftNom: tetap bagi rata, manual mati', mEven.manual === false && mEven.per === 50 && P.bagianPotong(mEven, 'k1') === 50)
cek('jumlah tak pas → fallback bagi rata utuh', (() => { const b = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 60, k2: 30 } }); return !b.manual && b.per === 50 })())
cek('id kurang/negatif/kosong → fallback bagi rata', (() => {
  const a = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 100 } })
  const b = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 120, k2: -20 } })
  const c = P.potonganBaris({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: '', k2: 100 } })
  return !a.manual && a.per === 50 && !b.manual && !c.manual
})())
cek('baris non-potong + shiftNom tetap nol & bukan manual', (() => { const b = P.potonganBaris({ amount: 100, shift: ['k1'], menuFix: 'ditempat', shiftNom: { k1: 100 } }); return !b.manual && b.per === 0 && b.total === 0 })())
const dayNom = { date: '2026-10-04', bd: { marketing: [{ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 70, k2: 30 } }, { amount: 60, shift: ['k1', 'k2'] }] } }
cek('potonganHari campur manual + rata', P.potonganHari(dayNom, 'k1') === 100 && P.potonganHari(dayNom, 'k2') === 60)
const mk1 = P.potonganBarisKompas({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 90, k2: 10 } })
cek('Kompas: manual nominal penuh (tanpa belah tiket)', mk1.manual === true && P.bagianPotong(mk1, 'k1') === 90)
const dayNomK = { date: '2026-10-04', bd: { marketing: [{ amount: 100, tiket: true, shift: ['k1'], shiftNom: { k1: 50 } }] } }
cek('manual separuh-tiket berlaku di cashier; di Kompas tak pas → fallback penuh', P.potonganHari(dayNomK, 'k1') === 50 && P.potonganHariKompas(dayNomK, 'k1') === 100)
cek('Kompas jumlah tak pas → fallback rata penuh', (() => { const b = P.potonganBarisKompas({ amount: 100, shift: ['k1', 'k2'], shiftNom: { k1: 1, k2: 2 } }); return !b.manual && b.per === 50 })())

console.log('\nporsi-pic: kembar dengan Office lama')
const LAMA = path.resolve(import.meta.dirname, '../../laksamana-office')
const fK = path.join(LAMA, 'deploy/cashier/index.html')
const fO = path.join(LAMA, 'deploy/finance/omset/index.html')
if (!fs.existsSync(fK) || !fs.existsSync(fO)) {
  lewat++
  console.log('  LEWAT ../laksamana-office tidak ada')
}
else {
  const srcK = fs.readFileSync(fK, 'utf8')
  const srcO = fs.readFileSync(fO, 'utf8')
  const mT = srcK.match(/PORSI_PIC_TIKET\s*=\s*([\d.]+)/)
  cek('PORSI_PIC_TIKET sama dengan Office lama', mT && Number(mT[1]) === P.PORSI_PIC_TIKET, mT ? mT[1] : 'tidak ketemu')
  const cekK = /function porsiPic\(r\)\{\s*const a=num\(r\.amount\);\s*return r\.tiket \? Math\.round\(a\*PORSI_PIC_TIKET\) : a;\s*\}/.test(srcK)
  const cekO = /function porsiPic\(r, divi\)\{[\s\S]{0,220}?event'\) return Math\.round\(num\(r\.amount\)\/2\)\+obTotal\(r\);\s*return num\(r\.amount\)\+num\(r\.tax\)\+num\(r\.service\)\+obTotal\(r\);/.test(srcO)
  cek('rumus cashier & Kompas persis seperti berkas lama', cekK && cekO, `cashier=${cekK} kompas=${cekO}`)
  const cekPotO = /function potongKasir\(r\)\{ return potongKasirAktif\(r\) \? num\(r\.amount\) : 0; \}/.test(srcO)
  cek('potongan Kompas = kolom amount penuh (tanpa belah tiket)', cekPotO)
  const mB = srcK.match(/const BONUS_KASIR=\[([\s\S]*?)\];/)
  const pB = mB ? [...mB[1].matchAll(/min:\s*(\d+),\s*bonus:\s*(\d+),\s*label:'([^']+)'/g)].map(x => ({ min: Number(x[1]), bonus: Number(x[2]), label: x[3] })) : null
  cek('BONUS_KASIR sama persis dengan Office lama', pB && sama(pB, P.BONUS_KASIR.map(x => ({ ...x }))), pB ? JSON.stringify(pB) : 'tidak ketemu')
}

console.log(`\n${ok} OK, ${gagal} GAGAL, ${lewat} LEWAT`)
process.exit(gagal ? 1 : 0)
