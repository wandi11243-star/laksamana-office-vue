/*
 * tools/uji-performa-bonus.mjs — guard for app/utils/performa-bonus.ts.
 *
 *   node tools/uji-performa-bonus.mjs      (Node 24: imports the .ts directly)
 *
 * Two layers, both without dependencies:
 *
 *   1. INVARIANTS that need no reference: a bonus must never DROP when the omset
 *      RISES (swept per Rp1 jt up to Rp600 jt plus every boundary and its exact
 *      neighbours — a ladder with a gap fails here without anyone knowing the
 *      thresholds), plus the rules the old file's comments record.
 *   2. PARITY with the old engine: ../laksamana-office/deploy/assets/performa-bonus.js
 *      is run AS IS on hundreds of seeded random datasets and every result must
 *      be deep-equal. Skipped (clearly) when the old repo is not next to this one.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as PB from '../app/utils/performa-bonus.ts'

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

console.log('\nperforma-bonus: invarian')

// 1. Monotonic ladders.
const titik = new Set()
for (let v = 0; v <= 600000000; v += 1000000) titik.add(v)
for (const tab of [PB.MK_S2, PB.MK_S3, PB.EV_S4]) {
  for (const t of tab) [t.min - 1, t.min, t.min + 1].forEach(x => titik.add(x))
}
const urut = [...titik].sort((a, b) => a - b)
const naik = (f) => {
  let prev = -1
  for (const v of urut) {
    const b = f(v)
    if (b < prev) return `turun di ${v}: ${prev} -> ${b}`
    prev = b
  }
  return ''
}
let m
m = naik(v => PB.bonusS2(v).bonus)
cek('Skema 2 marketing tidak pernah turun saat omset naik', !m, m)
m = naik(v => PB.mkTangga(PB.MK_S3, v)?.leader || 0)
cek('Skema 3 (leader) tidak pernah turun', !m, m)
m = naik(v => PB.mkTangga(PB.MK_S3, v)?.tim || 0)
cek('Skema 3 (tim) tidak pernah turun', !m, m)
m = naik(v => PB.tanggaEvS4(v).bonus)
cek('Skema 4 event tidak pernah turun', !m, m)

cek('tepat Rp150.000.000 dapat tangga yang lebih besar (tumpang tindih dokumen)', PB.bonusS2(150000000).bonus === 500000)
cek('celah Rp200.000.001 masuk tangga di atasnya', PB.bonusS2(200000001).bonus === 750000)
cek('"Rp 4.00.0000" dibaca Rp4.000.000', PB.MK_S3[0].leader === 4000000)
cek('di bawah tangga: next = tangga terbawah', PB.bonusS2(1).next?.min === 120000000 && PB.bonusS2(1).bonus === 0)
cek('tangga teratas: next null', PB.bonusS2(999999999).next === null)

// Head: whole word only, and null = nobody.
const ketDari = peta => e => (e.id in peta ? peta[e.id] : null)
const pic = id => ({ id, name: id })
cek('Head kata utuh', PB.pbHead(pic('a'), ketDari({ a: 'Marketing, Head' })))
cek('Overhead / Headhunter bukan Head', !PB.pbHead(pic('a'), ketDari({ a: 'Overhead' })) && !PB.pbHead(pic('a'), ketDari({ a: 'Headhunter' })))
cek('"Leader" tidak lagi dikenali', !PB.pbHead(pic('a'), ketDari({ a: 'Marketing Leader' })))
cek('tanpa ket tidak ada yang Head', !PB.pbHead(pic('a')))

// Porsi & Open Bill.
const r = { amount: 10000000, tax: 1000000, service: 500000, ob: true, obAmount: 100, obTax: 10, obService: 5 }
cek('porsi marketing = amount+tax+service+OB', PB.pbPorsiPic(r, 'marketing') === 11500115)
cek('porsi event = amount/2 + OB', PB.pbPorsiPic(r, 'event') === 5000115)
cek('OB nonaktif tidak dihitung', PB.pbObTotal({ ...r, ob: false }) === 0)
cek('pbNum membuang pemisah', PB.pbNum('Rp1.500.000') === 1500000 && PB.pbNum(null) === 0)

// Aggregation: yatim reported, compliment cuts, divisor = PICs with events.
const days = [
  { date: '2026-09-01', bd: { marketing: [
    { picId: 'a', eventName: 'A1', amount: 30000000 },
    { picId: 'zz', eventName: 'Yatim', amount: 5000000 },
    { eventName: 'Tanpa PIC', amount: 1000000 },
  ] } },
  { date: '2026-09-02', bd: { marketing: [{ picId: 'a', eventName: 'A2', amount: 75000000 }] } },
]
const comps = [
  { picDiv: 'marketing', picName: 'a', subTotal: 200000, nominal: 999999 },
  { pemberiDiv: 'marketing', pemberiName: 'b', pemberiStatus: 'menunggu', subTotal: 50000 },
]
const list = [pic('a'), pic('b'), pic('c')]
const { agg, yatim } = PB.pbAgregasi(days, 'marketing', list, comps)
cek('baris yatim dikumpulkan, tidak dibuang', yatim.length === 2 && yatim.some(y => y.ada) && yatim.some(y => !y.ada))
cek('compliment memotong sub total, bukan nominal', agg.a.comp === 200000 && agg.a.real === 105000000 - 200000)
cek('compliment pemberi "menunggu" tidak memotong', agg.b.comp === 0)
const info = PB.bonusMarketing(list, agg, ketDari({ a: 'Marketing', b: 'Marketing Head' }))
cek('pool Skema 1 dibagi PIC yang punya event saja', info.s1.bagi === 1)
cek('event Rp75 jt dihitung sekali di tangga tertinggi', info.s1.ev.length === 2 && info.s1.pool === 800000)
cek('Head menerima kolom leader', info.headIds.join() === 'b')
cek('ketAda dibedakan dari "belum ada Head"', info.ketAda === true && PB.bonusMarketing(list, agg).ketAda === false)

// Event: scheme 4 = half, schemes 1 & 3 = net.
const ev = PB.pbAgregasi([{ date: '2026-09-03', bd: { event: [{ picId: 'a', amount: 120000000 }] } }], 'event', [pic('a')])
const ie = PB.bonusEvent([pic('a')], ev.agg)
cek('event Skema 1 dari nilai utuh', ie.per.a.s1 === 1000000)
cek('event Skema 3 satu voucher tertinggi', ie.per.a.voucher === 250000)
cek('event Skema 4 dari separuh nilai', ie.per.a.dasarS4 === 60000000 && ie.per.a.s4.bonus === 0)

// selRealisasi as data.
cek('selRealisasi: null -> kosong', PB.selRealisasi(null, 5, false).jenis === 'kosong')
cek('selRealisasi: aktif', PB.selRealisasi(7, 5, true).jenis === 'aktif')
cek('selRealisasi: terlampaui', PB.selRealisasi(7, 5, false).jenis === 'terlampaui')
const k = PB.selRealisasi(3, 5, false)
cek('selRealisasi: kurang berapa', k.jenis === 'kurang' && k.nilai === 2)

// 2. Parity with the old engine.
console.log('\nperforma-bonus: paritas dengan berkas lama')
const LAMA = path.resolve(import.meta.dirname, '../../laksamana-office/deploy/assets/performa-bonus.js')
if (!fs.existsSync(LAMA)) {
  if (process.env.STRICT === '1') {
    gagal++
    console.log('  STRICT berkas lama tidak ada di ' + LAMA)
  }
  else {
    lewat++
    console.log('  LEWAT berkas lama tidak ada di ' + LAMA)
  }
}
else {
  const W = {}
  new Function('window', fs.readFileSync(LAMA, 'utf8'))(W)

  let seed = 20261006
  const acak = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const pilih = a => a[Math.floor(acak() * a.length)]
  const rp = () => pilih([0, 1, 999999, 20000000, 30000000, 35000000, 45000001, 56000000, 70000000, 100000001,
    Math.floor(acak() * 150000000), String(Math.floor(acak() * 90000000)), 'Rp12.500.000', null])
  const kanon = v => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map(k2 => [k2, x[k2]]))
    : x))

  const buatData = () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5']
    const roster = ids.map((id, i) => ({ id, name: 'Nama ' + id, officeUserId: i % 2 ? 'u' + id : undefined }))
    const hari = []
    const nHari = 1 + Math.floor(acak() * 30)
    for (let i = 0; i < nHari; i++) {
      const baris = div => Array.from({ length: Math.floor(acak() * 4) }, () => ({
        picId: pilih([...ids, ...ids, 'zz', undefined, '']),
        eventName: pilih(['Acara', '', undefined]),
        amount: rp(), tax: rp(), service: rp(),
        ob: acak() < 0.3, obAmount: rp(), obTax: rp(), obService: rp(),
        tiket: acak() < 0.2, srcId: pilih(['mkt:1', 'vip:2', '', undefined]), srcJenis: pilih(['Corporate Event', '']),
        srcPic: pilih(['Event Manager', '']), _div: div,
      }))
      hari.push({ date: '2026-09-' + String(i + 1).padStart(2, '0'), bd: { marketing: baris('m'), event: baris('e') } })
    }
    const komp = Array.from({ length: Math.floor(acak() * 6) }, () => ({
      subTotal: acak() < 0.3 ? null : rp(), nominal: rp(),
      picDiv: pilih(['marketing', 'tamu', '']), picOfficeId: pilih(['up2', 'up4', '']), picName: pilih(['nama p1', ' Nama p3 ', '']),
      pemberiDiv: pilih(['marketing', 'tamu']), pemberiOfficeId: pilih(['up2', '']), pemberiName: pilih(['Nama p5', '']),
      pemberiStatus: pilih(['potong', 'tidak', 'menunggu', undefined, 'aneh']),
    }))
    const ketPeta = Object.fromEntries(ids.map(id => [id, pilih(['Marketing', 'Marketing, Head', 'Head/Event', 'Overhead', null])]))
    return { roster, hari, komp, ketPeta }
  }

  let beda = ''
  const PUTARAN = 400
  for (let n = 0; n < PUTARAN && !beda; n++) {
    const { roster, hari, komp, ketPeta } = buatData()
    const ket = e => ketPeta[e.id]
    W.pbSetKeterangan(ket)
    for (const divi of ['marketing', 'event']) {
      const lama = W.pbAgregasi(hari, divi, roster, komp)
      const baru = PB.pbAgregasi(hari, divi, roster, komp)
      if (kanon(lama) !== kanon(baru)) {
        beda = `pbAgregasi ${divi} putaran ${n}`
        break
      }
      const bl = divi === 'marketing' ? W.bonusMarketing(roster, lama.agg) : W.bonusEvent(roster, lama.agg)
      const bb = divi === 'marketing' ? PB.bonusMarketing(roster, baru.agg, ket) : PB.bonusEvent(roster, baru.agg)
      if (kanon(bl) !== kanon(bb)) {
        beda = `bonus ${divi} putaran ${n}`
        break
      }
    }
  }
  cek(`pbAgregasi + bonusMarketing + bonusEvent identik dengan berkas lama (${PUTARAN} data acak)`, !beda, beda)

  const U = W.PB_UJI
  let bedaT = ''
  for (const v of urut) {
    if (kanon(U.bonusS2(v)) !== kanon(PB.bonusS2(v))) bedaT = 'bonusS2 ' + v
    else if (kanon(U.tanggaEvS4(v)) !== kanon(PB.tanggaEvS4(v))) bedaT = 'tanggaEvS4 ' + v
    if (bedaT) break
  }
  cek('bonusS2 & tanggaEvS4 identik di seluruh titik sapuan', !bedaT, bedaT)
  const konst = ['MK_S2', 'MK_S3', 'MK_S1_JUMLAH', 'MK_S1_EVENT', 'MK_S4_VOUCHER', 'MK_S1_MIN_EVENT', 'MK_S4_CUTI_MIN',
    'MK_S4_CUTI_PER', 'MK_S4_TOP', 'EV_S1', 'EV_S2', 'EV_S2_DASAR', 'EV_S3_VOUCHER', 'EV_S4']
  const bedaK = konst.filter(k2 => kanon(U[k2]) !== kanon(PB[k2]))
  cek('seluruh konstanta tangga sama persis', !bedaK.length, bedaK.join(', '))
}

console.log(`\n${ok} OK, ${gagal} GAGAL${lewat ? `, ${lewat} LEWAT` : ''}\n`)
process.exit(gagal ? 1 : 0)
