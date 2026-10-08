// POS summary aggregation — the second pure half of the Analytics upload.
// Port of ringkasPos() in laksamana-office/deploy/analytics/index.html:6937.
// Rows in, one month summary out. Set objects are turned into counts BEFORE
// returning (a Set serialises to {}, zeroing every transaction count).
//
// Normalisation (package codes, menu-name maps) happens when DRAWING, not
// here: a map fixed next month then applies to every month ever uploaded.
//
// NOTE: the value import below is relative with an explicit extension
// (./analytics-pos.ts), not ~/, so plain Node can run this file in
// tools/uji-analytics.mjs — the same rule as kompas.ts/cashier.ts.
import type { BarisTabel } from '~/utils/xlsx-baca'
import {
  ERR_MAKS,
  ERR_RE,
  KAT_TANPA,
  KOL_POS,
  KOL_PROMO,
  KOL_VOID,
  KUN_TANPA,
  MEJA_TANPA,
  PAKET_RE,
  PROMO_EPOCH_MAX,
  PROMO_EPOCH_MIN,
  VOID_MAKS,
  angkaPos,
  blnDari,
  bulanPosTerbanyak,
  cariBarisKepala,
  isoDariTanggal,
  jamDari,
  kodeMenu,
  paketGenerik,
  paketNamaAsli,
  pecahBayar,
  petaKolom,
  porsiBayar,
} from './analytics-pos.ts'

export interface AgregatHari { bill: number, grand: number, net: number }
export interface AgregatJam { bill: number, grand: number }
export interface AgregatHariJam { g: number, b: number }
export interface AgregatMenu { qty: number, nilai: number }
export interface AgregatKategori { qty: number, nilai: number, kat: string }
export interface AgregatKunjung { grand: number, bill: number }
export interface AgregatMeja { grand: number, bill: number, seksi: string }
export interface MenuError { n: string, q: number, v: number, c: string, w: string }
export interface ErrorBill {
  bill: string
  tgl: string
  jam: number
  grand: number
  label: string[]
  catatan: string
  vp: string
  kasir: string
  waiter: string[]
  menu: MenuError[]
}
export interface RingkasPos {
  bill: number
  grand: number
  net: number
  sub: number
  svc: number
  tax: number
  discMenu: number
  discBill: number
  discVoucher: number
  pax: number
  billPax: number
  bayarRata: number
  errLewat: number
  errSumber: string[]
  ukYatim: number
  mejaKolom: boolean
  seksiKolom: boolean
}

export interface HasilUraiPos {
  kind: 'pos'
  bulan: string
  jenis: 'bill' | 'menu'
  berkas: string
  hari: Record<string, AgregatHari>
  jam: AgregatJam[]
  hariJam: Record<string, Record<string, AgregatHariJam>>
  menu: Record<string, AgregatMenu>
  paket: Record<string, Record<string, AgregatMenu>>
  ukuran: Record<string, Record<string, Record<string, AgregatMenu & { induk: number }>>>
  kategori: Record<string, AgregatKategori>
  katMenu: Record<string, Record<string, AgregatMenu>>
  kunjung: Record<string, AgregatKunjung>
  bayar: Record<string, AgregatKunjung>
  kunjungBayar: Record<string, AgregatKunjung>
  error: ErrorBill[]
  meja: Record<string, AgregatMeja>
  ringkas: RingkasPos
  /** Preview-only: never stored (see anSimpanUnggah). */
  nBaris: number
  nLewat: number
  blnLain: { b: string, n: number }[]
  billDariBaris: boolean
  tglAwal: string
  tglAkhir: string
}

/**
 * Raw POS rows -> one stored month. Throws in Indonesian when the file is
 * not a sales export (missing header, date, or value columns; no dated rows).
 */
// Source: laksamana-office/deploy/analytics/index.html:6937
export function uraiLaporanPos(baris: BarisTabel[], namaBerkas: string): HasilUraiPos {
  const iH = cariBarisKepala(baris)
  if (iH < 0) throw new Error('Baris kepala kolom tidak ketemu. Pastikan berkasnya hasil ekspor POS, bukan berkas yang sudah disunting.')
  const K = petaKolom(baris[iH] ?? {}, KOL_POS)
  const sel = (b: BarisTabel, k: string | null | undefined): string => (k ? String(b[k] ?? '') : '')
  if (!K.tgl) throw new Error('Kolom tanggal tidak ketemu. Yang dicari: ' + (KOL_POS.tgl ?? []).join(', ') + '.')
  const jenis: 'bill' | 'menu' = K.menu && K.qty ? 'menu' : 'bill'
  if (jenis === 'bill' && !K.grand && !K.net) {
    throw new Error('Kolom nilai tidak ketemu (Grand Total / Net Sales).')
  }

  const hari: Record<string, AgregatHari> = {}
  const jam: AgregatJam[] = Array.from({ length: 24 }, () => ({ bill: 0, grand: 0 }))
  const menu: Record<string, AgregatMenu> = {}
  const perBln: Record<string, number> = {}
  const paket: Record<string, Record<string, AgregatMenu>> = {}
  const ukuran: HasilUraiPos['ukuran'] = {}
  let indukAkhir: { bill: string, nama: string, qty: number, nilai: number } | null = null
  let nUkYatim = 0
  const kategori: Record<string, AgregatKategori> = {}
  const katMenu: Record<string, Record<string, AgregatMenu>> = {}
  const kunjung: Record<string, AgregatKunjung> = {}
  const bKunjung: Record<string, Set<string>> = {}
  const mejaBln: Record<string, Record<string, AgregatMeja>> = {}
  const bMejaBln: Record<string, Set<string>> = {}
  const pbBill: Record<string, { pm: string, grand: number, vp: Record<string, number> }> = {}
  const bayar: Record<string, AgregatKunjung> = {}
  const bBayar: Record<string, Set<string>> = {}
  const kunjungBayar: Record<string, AgregatKunjung> = {}
  const bKunjungBayar: Record<string, Set<string>> = {}
  let nBayarRata = 0
  const errBill: Record<string, ErrorBill> = {}
  let nErrLewat = 0
  const r: RingkasPos = {
    bill: 0, grand: 0, net: 0, sub: 0, svc: 0, tax: 0,
    discMenu: 0, discBill: 0, discVoucher: 0, pax: 0, billPax: 0,
    bayarRata: 0, errLewat: 0, errSumber: [], ukYatim: 0, mejaKolom: false, seksiKolom: false,
  }
  let nLewat = 0
  let nRow = 0

  const bSemua = new Set<string>()
  const bHari: Record<string, Set<string>> = {}
  const bJam: Record<number, Set<string>> = {}
  const hariJam: Record<string, Record<string, AgregatHariJam>> = {}
  const bHariJam: Record<string, Set<string>> = {}
  const punyaBill = !!K.bill
  const catatBill = (no: string, t: string, jm: number) => {
    if (!punyaBill) return
    bSemua.add(no)
    ;(bHari[t] = bHari[t] || new Set()).add(no)
    if (jm >= 0) (bJam[jm] = bJam[jm] || new Set()).add(no)
  }

  for (let i = iH + 1; i < baris.length; i++) {
    const b = baris[i] ?? {}
    const t = isoDariTanggal(sel(b, K.tgl))
    if (!t) {
      if (Object.keys(b).length) nLewat++
      continue
    }
    const bln = blnDari(t)
    perBln[bln] = (perBln[bln] || 0) + 1

    const g = K.grand ? angkaPos(sel(b, K.grand)) : 0
    const net = K.net ? angkaPos(sel(b, K.net)) : 0
    if (!hari[t]) hari[t] = { bill: 0, grand: 0, net: 0 }
    hari[t]!.grand += g
    hari[t]!.net += net
    nRow++
    r.grand += g
    r.net += net
    if (!punyaBill) {
      hari[t]!.bill++
      r.bill++
    }
    if (K.sub) r.sub += angkaPos(sel(b, K.sub))
    if (K.svc) r.svc += angkaPos(sel(b, K.svc))
    if (K.tax) r.tax += angkaPos(sel(b, K.tax))
    if (K.dMenu) r.discMenu += angkaPos(sel(b, K.dMenu))
    if (K.dBill) r.discBill += angkaPos(sel(b, K.dBill))
    if (K.dVouc) r.discVoucher += angkaPos(sel(b, K.dVouc))
    if (K.pax) {
      const p = angkaPos(sel(b, K.pax))
      if (p > 0) {
        r.pax += p
        r.billPax++
      }
    }

    const jm = K.jam ? jamDari(sel(b, K.jam)) : -1
    if (jm >= 0) {
      jam[jm]!.grand += g
      if (!punyaBill) jam[jm]!.bill++
    }
    if (jm >= 0) {
      const hj = hariJam[t] || (hariJam[t] = {})
      const c = hj[String(jm)] || (hj[String(jm)] = { g: 0, b: 0 })
      c.g += g
      if (!punyaBill) c.b++
    }
    const noBill = sel(b, K.bill).trim()
    catatBill(noBill, t, jm)
    if (punyaBill && jm >= 0) {
      const k = `${t}|${jm}`
      ;(bHariJam[k] = bHariJam[k] || new Set()).add(noBill)
    }

    if (K.kunjung) {
      const vp = sel(b, K.kunjung).trim().toUpperCase() || KUN_TANPA
      if (!kunjung[vp]) kunjung[vp] = { grand: 0, bill: 0 }
      kunjung[vp]!.grand += g
      if (punyaBill) (bKunjung[vp] = bKunjung[vp] || new Set()).add(noBill)
      else kunjung[vp]!.bill++
    }

    if (K.meja) {
      const mj = sel(b, K.meja).trim() || MEJA_TANPA
      const wb = mejaBln[bln] || (mejaBln[bln] = {})
      const sm = wb[mj] || (wb[mj] = { grand: 0, bill: 0, seksi: '' })
      sm.grand += g
      if (K.seksi && !sm.seksi) sm.seksi = sel(b, K.seksi).trim()
      if (punyaBill) {
        const k = `${bln}|${mj}`
        ;(bMejaBln[k] = bMejaBln[k] || new Set()).add(noBill)
      }
      else sm.bill++
    }

    if (K.bayar) {
      const kb = punyaBill ? noBill : `#${nRow}`
      const pb = pbBill[kb] || (pbBill[kb] = { pm: '', grand: 0, vp: {} })
      if (!pb.pm) pb.pm = sel(b, K.bayar).trim()
      pb.grand += g
      const vpb = K.kunjung ? sel(b, K.kunjung).trim().toUpperCase() || KUN_TANPA : KUN_TANPA
      pb.vp[vpb] = (pb.vp[vpb] || 0) + g
    }

    if (K.bayar || K.info) {
      const pmT = K.bayar ? sel(b, K.bayar).trim() : ''
      const infoT = K.info ? sel(b, K.info).trim() : ''
      if (ERR_RE.test(pmT) || ERR_RE.test(infoT)) {
        const kb = punyaBill ? noBill : `#${nRow}`
        let e = errBill[kb]
        if (!e && Object.keys(errBill).length >= ERR_MAKS) nErrLewat++
        else if (!e) {
          e = errBill[kb] = {
            bill: noBill, tgl: t, jam: jm, grand: 0,
            label: [], catatan: '', vp: '', kasir: '', waiter: [], menu: [],
          }
        }
        if (e) {
          e.grand += g
          if (e.jam < 0 && jm >= 0) e.jam = jm
          if (pmT) {
            pecahBayar(pmT).forEach((p) => {
              if (/^ERROR\b/.test(p.nama) && e.label.indexOf(p.nama) < 0) e.label.push(p.nama)
            })
          }
          if (!e.label.length && ERR_RE.test(infoT)) {
            const L = infoT.toUpperCase()
            if (e.label.indexOf(L) < 0) e.label.push(L)
          }
          if (!e.catatan && infoT) e.catatan = infoT
          if (!e.vp && K.kunjung) e.vp = sel(b, K.kunjung).trim().toUpperCase()
          if (!e.kasir && K.kasir) e.kasir = sel(b, K.kasir).trim()
          if (K.waiter) {
            const wt = sel(b, K.waiter).trim()
            if (wt && wt !== '-' && e.waiter.indexOf(wt) < 0) e.waiter.push(wt)
          }
          if (jenis === 'menu' && K.menu) {
            const nmm = sel(b, K.menu).trim()
            if (nmm && e.menu.length < 40) {
              e.menu.push({
                n: nmm,
                q: angkaPos(sel(b, K.qty)) || 0,
                v: K.nilai ? angkaPos(sel(b, K.nilai)) : g,
                c: K.catatan ? sel(b, K.catatan).trim() : '',
                w: K.waiter ? sel(b, K.waiter).trim() : '',
              })
            }
          }
        }
      }
    }

    if (jenis === 'menu') {
      const nm = sel(b, K.menu).trim()
      if (nm) {
        const q = angkaPos(sel(b, K.qty)) || 0
        const nl = K.nilai ? angkaPos(sel(b, K.nilai)) : g
        if (!menu[nm]) menu[nm] = { qty: 0, nilai: 0 }
        menu[nm]!.qty += q
        menu[nm]!.nilai += nl

        if (PAKET_RE.test(nm)) {
          const kd = (K.kode ? kodeMenu(sel(b, K.kode)) : '') || (K.kode2 ? kodeMenu(sel(b, K.kode2)) : '')
          if (!paket[nm]) paket[nm] = {}
          if (!paket[nm]![kd]) paket[nm]![kd] = { qty: 0, nilai: 0 }
          paket[nm]![kd]!.qty += q
          paket[nm]![kd]!.nilai += nl

          if (paketGenerik(nm)) {
            const lbl = paketNamaAsli(nm).toUpperCase()
            const punya = !!(indukAkhir && indukAkhir.bill === noBill && indukAkhir.nama)
            const ind = punya ? indukAkhir!.nama : ''
            if (!ukuran[ind]) ukuran[ind] = {}
            if (!ukuran[ind]![lbl]) ukuran[ind]![lbl] = {}
            if (!ukuran[ind]![lbl]![kd]) ukuran[ind]![lbl]![kd] = { qty: 0, nilai: 0, induk: 0 }
            const u = ukuran[ind]![lbl]![kd]!
            u.qty += q
            u.nilai += nl
            if (punya) u.induk += indukAkhir!.qty > 0 ? indukAkhir!.nilai * (q / indukAkhir!.qty) : 0
            if (!punya) nUkYatim += q
          }
          indukAkhir = null
        }
        else {
          indukAkhir = { bill: noBill, nama: nm, qty: q, nilai: nl }
        }

        if (K.katD || K.kat) {
          const kd = (K.katD ? sel(b, K.katD).trim() : '') || KAT_TANPA
          const ka = (K.kat ? sel(b, K.kat).trim() : '') || KAT_TANPA
          if (!kategori[kd]) kategori[kd] = { qty: 0, nilai: 0, kat: ka }
          kategori[kd]!.qty += q
          kategori[kd]!.nilai += nl
          if (!katMenu[kd]) katMenu[kd] = {}
          if (!katMenu[kd]![nm]) katMenu[kd]![nm] = { qty: 0, nilai: 0 }
          katMenu[kd]![nm]!.qty += q
          katMenu[kd]![nm]!.nilai += nl
        }
      }
    }
  }

  if (punyaBill) {
    r.bill = bSemua.size
    for (const t of Object.keys(hari)) hari[t]!.bill = bHari[t] ? bHari[t]!.size : 0
    for (let j = 0; j < 24; j++) jam[j]!.bill = bJam[j] ? bJam[j]!.size : 0
    for (const k of Object.keys(bHariJam)) {
      const p = k.split('|')
      const t = p[0]!
      const j = p[1]!
      if (hariJam[t] && hariJam[t]![j]) hariJam[t]![j]!.b = bHariJam[k]!.size
    }
    for (const k of Object.keys(bKunjung)) kunjung[k]!.bill = bKunjung[k]!.size
    for (const k of Object.keys(bMejaBln)) {
      const i = k.indexOf('|')
      const bl = k.slice(0, i)
      const mj = k.slice(i + 1)
      if (mejaBln[bl] && mejaBln[bl]![mj]) mejaBln[bl]![mj]!.bill = bMejaBln[k]!.size
    }
  }

  for (const kb of Object.keys(pbBill)) {
    const pb = pbBill[kb]!
    const parts = pecahBayar(pb.pm)
    if (!parts.length) parts.push({ nama: KUN_TANPA, nom: null })
    const bagi = porsiBayar(parts, pb.grand)
    if (bagi.rata) nBayarRata++
    parts.forEach((p, i) => {
      const nm = p.nama
      if (!bayar[nm]) bayar[nm] = { grand: 0, bill: 0 }
      bayar[nm]!.grand += pb.grand * (bagi.porsi[i] ?? 0)
      ;(bBayar[nm] = bBayar[nm] || new Set()).add(kb)
      for (const vp of Object.keys(pb.vp)) {
        const k = `${vp}|${nm}`
        if (!kunjungBayar[k]) kunjungBayar[k] = { grand: 0, bill: 0 }
        kunjungBayar[k]!.grand += (pb.vp[vp] ?? 0) * (bagi.porsi[i] ?? 0)
        ;(bKunjungBayar[k] = bKunjungBayar[k] || new Set()).add(kb)
      }
    })
  }
  for (const k of Object.keys(bBayar)) bayar[k]!.bill = bBayar[k]!.size
  for (const k of Object.keys(bKunjungBayar)) kunjungBayar[k]!.bill = bKunjungBayar[k]!.size
  r.bayarRata = nBayarRata

  if (!nRow) throw new Error('Tidak ada satu pun baris yang punya tanggal terbaca.')

  const { bulan, lain: blnLain } = bulanPosTerbanyak(perBln)

  // Only the stored month is kept — same rule for hari[] and hariJam[].
  // Rebuilt instead of deleted: dynamic delete is banned by lint, and a
  // forgotten key here would count a neighbouring month's turnover silently.
  const simpanHari: typeof hari = {}
  for (const t of Object.keys(hari)) {
    if (blnDari(t) === bulan) simpanHari[t] = hari[t]!
  }
  const simpanHariJam: typeof hariJam = {}
  for (const t of Object.keys(hariJam)) {
    if (blnDari(t) === bulan) simpanHariJam[t] = hariJam[t]!
  }
  const error = Object.keys(errBill)
    .map(k => errBill[k]!)
    .filter(e => blnDari(e.tgl) === bulan)
    .sort((a, x) => (a.tgl < x.tgl ? -1 : a.tgl > x.tgl ? 1 : a.jam - x.jam))
  r.errLewat = nErrLewat
  r.errSumber = []
  if (K.bayar) r.errSumber.push('Payment Method')
  if (K.info) r.errSumber.push('Additional Info')
  const tglU = Object.keys(simpanHari).sort()

  r.ukYatim = nUkYatim
  r.mejaKolom = !!K.meja
  r.seksiKolom = !!K.seksi
  return {
    kind: 'pos',
    bulan,
    jenis,
    berkas: namaBerkas,
    hari: simpanHari,
    jam,
    hariJam: simpanHariJam,
    menu,
    paket,
    ukuran,
    kategori,
    katMenu,
    kunjung,
    bayar,
    kunjungBayar,
    error,
    meja: mejaBln[bulan] || {},
    ringkas: r,
    nBaris: nRow,
    nLewat,
    blnLain,
    billDariBaris: !punyaBill,
    tglAwal: tglU[0] || '',
    tglAkhir: tglU[tglU.length - 1] || '',
  }
}

// ---------------------------------------------------------------- shift
// The Hari & Jam screen splits turnover into two shifts. Defaults set by the
// owner 28 Aug 2026; stored in setting.shift, never hard-coded at draw time.

/** Shift bounds in hours 0–24; the night shift may cross midnight. */
// Source: laksamana-office/deploy/analytics/index.html:1436
export interface BatasShift { s1a: number, s1b: number, s2a: number, s2b: number }
export const SHIFT_AN_BAWAAN: BatasShift = { s1a: 10, s1b: 18, s2a: 18, s2b: 24 }

/** Stored shift bounds, clamped 0–24, defaults for missing keys. */
// Source: laksamana-office/deploy/analytics/index.html:1439
export function batasShift(s?: Partial<BatasShift> | null): BatasShift {
  const amb = (k: keyof BatasShift): number => {
    const v = Number.parseInt(String(s?.[k]), 10)
    return Number.isNaN(v) ? SHIFT_AN_BAWAAN[k] : Math.max(0, Math.min(24, v))
  }
  return { s1a: amb('s1a'), s1b: amb('s1b'), s2a: amb('s2a'), s2b: amb('s2b') }
}

/** Circular range check, so a night shift like 18–02 keeps its turnover. */
// Source: laksamana-office/deploy/analytics/index.html:1452
export function diRentang(j: number, a: number, b: number): boolean {
  if (a === b) return false
  return a < b ? j >= a && j < b : j >= a || j < b
}

/** Which shift an hour falls in: 1, 2, or 0 (outside both). */
export function shiftDariJam(j: number, s: BatasShift): 0 | 1 | 2 {
  if (diRentang(j, s.s1a, s.s1b)) return 1
  if (diRentang(j, s.s2a, s.s2b)) return 2
  return 0
}

// ---------------------------------------------------------------- promo
// The Promotion Report parser — the second upload flavour (L2, issue #20).
// Port of ringkasPromo() in deploy/analytics/index.html:7510. Rows in, one
// stored month out. Shape mirrors HasilUraiPos on purpose: the upload screen
// previews and saves it through the same closed-key-list discipline.
//
// Two things the sales parser does not need:
// - the hour comes from the BILL NUMBER (SLMCL + epoch seconds), because the
//   report has no time column at all;
// - what decides discount-vs-freebie is whether the Discount Total CELL is
//   present, never the promotion type name.

export interface PromoAgregat {
  tipe: Record<string, number>
  baris: number
  bill: number
  qty: number
  nilai: number
  nilaiDisc: number
  nilaiGratis: number
}
export interface PromoTipe { baris: number, bill: number, qty: number, nilai: number }
export interface PromoJam { baris: number, bill: number, qty: number, nilai: number }
export interface PromoMenu { baris: number, qty: number, nilai: number }
export interface RingkasPromo {
  baris: number
  bill: number
  qty: number
  nilai: number
  nilaiDisc: number
  nilaiGratis: number
  promoBeda: number
  jamGelap: number
  tanpaMenu: number
  tglAwal: string
  tglAkhir: string
}

export interface HasilUraiPromo {
  kind: 'promo'
  bulan: string
  berkas: string
  promo: Record<string, PromoAgregat>
  tipe: Record<string, PromoTipe>
  jam: PromoJam[]
  menu: Record<string, PromoMenu>
  ringkas: RingkasPromo
  /** Preview-only: never stored (see anSimpanPromo). */
  nBaris: number
  nLewat: number
  blnLain: { b: string, n: number }[]
  tglAwal: string
  tglAkhir: string
}

/** Fixed WIB offset, not the browser zone — same rule as isoDariTanggal. */
export const WIB_MS = 7 * 3600 * 1000

/**
 * The claim hour from the bill number's trailing epoch seconds. -1 unless
 * the epoch's own date matches the row's Sales Date: without that guard a
 * POS with non-timestamp numbering would produce 24 tidy, wholly invented
 * hour columns.
 */
// Source: laksamana-office/deploy/analytics/index.html:7479
export function jamNomorBill(nomor: unknown, tglIso: string): number {
  const s = String(nomor == null ? '' : nomor).trim()
  const m = s.match(/(\d{10})\d*$/)
  if (!m || !tglIso) return -1
  const dtk = Number(m[1])
  if (!(dtk >= PROMO_EPOCH_MIN && dtk <= PROMO_EPOCH_MAX)) return -1
  const d = new Date(dtk * 1000 + WIB_MS)
  if (d.toISOString().slice(0, 10) !== tglIso) return -1
  return d.getUTCHours()
}

/**
 * Raw Promotion Report rows -> one stored month. Throws in Indonesian when
 * the file has no readable promo row. Collected first, counted after the
 * winning month is known — counting on the fly would let the neighbouring
 * month's rows into every map before anyone knows which month won.
 */
// Source: laksamana-office/deploy/analytics/index.html:7510
export function uraiLaporanPromo(baris: BarisTabel[], namaBerkas: string): HasilUraiPromo {
  const iH = cariBarisKepala(baris)
  if (iH < 0) throw new Error('Baris kepala kolom tidak ketemu. Pastikan berkasnya hasil ekspor POS, bukan berkas yang sudah disunting.')
  const K = petaKolom(baris[iH] ?? {}, KOL_PROMO)
  const sel = (b: BarisTabel, k: string | null | undefined): string => (k ? String(b[k] ?? '') : '')
  if (!K.tgl) throw new Error('Kolom tanggal tidak ketemu di berkas promo. Yang dicari: ' + (KOL_PROMO.tgl ?? []).join(', ') + '.')
  if (!K.bill) {
    throw new Error('Kolom nomor bill tidak ketemu. Yang dicari: ' + (KOL_PROMO.bill ?? []).join(', ')
      + '. Tanpa nomor bill, jumlah klaim tidak bisa dibedakan dari jumlah baris.')
  }

  const promo: Record<string, PromoAgregat & { _b: Set<string> }> = {}
  const tipe: Record<string, PromoTipe & { _b: Set<string> }> = {}
  const menu: Record<string, PromoMenu> = {}
  const perBln: Record<string, number> = {}
  const jam: { baris: number, qty: number, nilai: number, bill: Set<string> }[]
    = Array.from({ length: 24 }, () => ({ baris: 0, qty: 0, nilai: 0, bill: new Set<string>() }))
  const bAll = new Set<string>()
  const tgls: string[] = []
  let nRow = 0
  let nLewat = 0
  let nJamGelap = 0
  let nTanpaMenu = 0
  const r = { baris: 0, bill: 0, qty: 0, nilai: 0, nilaiDisc: 0, nilaiGratis: 0 }
  const kumpul: { nm: string, no: string, t: string, b: BarisTabel }[] = []

  for (let i = iH + 1; i < baris.length; i++) {
    const b = baris[i] ?? {}
    if (!Object.keys(b).some(k => String(b[k] ?? '').trim() !== '')) continue
    nRow++
    const nm = sel(b, K.nama).trim()
    const no = sel(b, K.bill).trim()
    const t = isoDariTanggal(sel(b, K.tgl))
    // Footer TOTAL rows drop out here: no promo name and no bill number.
    if (!nm || !no || !t) {
      nLewat++
      continue
    }
    kumpul.push({ nm, no, t, b })
    const bl = blnDari(t)
    perBln[bl] = (perBln[bl] || 0) + 1
  }

  const { bulan, lain: blnLain } = bulanPosTerbanyak(perBln)
  if (!bulan) {
    throw new Error('Tidak ada satu baris promo pun yang bisa dibaca. '
      + 'Pastikan berkasnya *Promotion Report* hasil ekspor POS, bukan berkas yang sudah disunting.')
  }

  for (const { nm, no, t, b } of kumpul) {
    if (blnDari(t) !== bulan) continue
    const tp = sel(b, K.tipe).trim() || '(tanpa tipe)'
    const q = K.qty ? angkaPos(sel(b, K.qty)) : 1

    // Discount-vs-freebie is decided by the Discount Total CELL, not the type.
    const selDisc = K.disc ? sel(b, K.disc).trim() : ''
    const adaDisc = selDisc !== ''
    const nDisc = adaDisc ? angkaPos(selDisc) : 0
    const nGratis = adaDisc ? 0 : (K.harga ? angkaPos(sel(b, K.harga)) * q : 0)
    const nilai = adaDisc ? nDisc : nGratis

    tgls.push(t)
    bAll.add(no)
    r.baris++
    r.qty += q
    r.nilai += nilai
    r.nilaiDisc += nDisc
    r.nilaiGratis += nGratis

    const p = promo[nm] || (promo[nm] = { tipe: {}, baris: 0, bill: 0, qty: 0, nilai: 0, nilaiDisc: 0, nilaiGratis: 0, _b: new Set<string>() })
    p.tipe[tp] = (p.tipe[tp] || 0) + 1
    p.baris++
    p.qty += q
    p.nilai += nilai
    p.nilaiDisc += nDisc
    p.nilaiGratis += nGratis
    p._b.add(no)

    const tt = tipe[tp] || (tipe[tp] = { baris: 0, bill: 0, qty: 0, nilai: 0, _b: new Set<string>() })
    tt.baris++
    tt.qty += q
    tt.nilai += nilai
    tt._b.add(no)

    // Bill-level discounts name no menu ("-"): counted, never merged.
    const mn = K.menu ? sel(b, K.menu).trim() : ''
    if (mn && mn !== '-') {
      const mm = menu[mn] || (menu[mn] = { baris: 0, qty: 0, nilai: 0 })
      mm.baris++
      mm.qty += q
      mm.nilai += nilai
    }
    else nTanpaMenu++

    let j = K.jam ? jamDari(sel(b, K.jam)) : -1
    if (j < 0) j = jamNomorBill(no, t)
    if (j < 0) {
      nJamGelap++
      continue
    }
    jam[j]!.baris++
    jam[j]!.qty += q
    jam[j]!.nilai += nilai
    jam[j]!.bill.add(no)
  }

  // Sets do not survive JSON: a Set sent as-is becomes {} and every claim
  // count reads zero, without a single error.
  const promoOut: Record<string, PromoAgregat> = {}
  for (const k of Object.keys(promo)) {
    const p = promo[k]!
    promoOut[k] = { tipe: p.tipe, baris: p.baris, bill: p._b.size, qty: p.qty, nilai: p.nilai, nilaiDisc: p.nilaiDisc, nilaiGratis: p.nilaiGratis }
  }
  const tipeOut: Record<string, PromoTipe> = {}
  for (const k of Object.keys(tipe)) {
    const t = tipe[k]!
    tipeOut[k] = { baris: t.baris, bill: t._b.size, qty: t.qty, nilai: t.nilai }
  }
  const jamOut: PromoJam[] = jam.map(x => ({ baris: x.baris, bill: x.bill.size, qty: x.qty, nilai: x.nilai }))

  tgls.sort()
  return {
    kind: 'promo',
    bulan,
    berkas: namaBerkas,
    promo: promoOut,
    tipe: tipeOut,
    jam: jamOut,
    menu,
    ringkas: {
      baris: r.baris, bill: bAll.size, qty: r.qty, nilai: r.nilai,
      nilaiDisc: r.nilaiDisc, nilaiGratis: r.nilaiGratis,
      promoBeda: Object.keys(promoOut).length,
      jamGelap: nJamGelap, tanpaMenu: nTanpaMenu,
      tglAwal: tgls[0] || '', tglAkhir: tgls[tgls.length - 1] || '',
    },
    nBaris: nRow,
    nLewat,
    blnLain,
    tglAwal: tgls[0] || '',
    tglAkhir: tgls[tgls.length - 1] || '',
  }
}

// ---------------------------------------------------------------- void
// The Cancel Menu Detail Report parser (L2, issue #20). One row per
// CANCELLED ITEM, not per bill. Port of ringkasVoid() in
// deploy/analytics/index.html:7687. Cancel and void share the file and both
// are kept: in August 2026 cancel carried 68% of the value.

export interface VoidSimpan {
  tgl: string
  jam: number
  bill: string
  menu: string
  kat: string
  orderBy: string
  by: string
  jenis: string
  nota: string
  qty: number
  total: number
  sub: number
}
export interface RingkasVoid {
  nBaris: number
  nBill: number
  qty: number
  total: number
  blnLain: number
  terpotong: number
  takTerbaca: number
}

export interface HasilUraiVoid {
  kind: 'void'
  bulan: string
  berkas: string
  baris: VoidSimpan[]
  ringkas: RingkasVoid
  /** Preview-only: never stored. */
  nBaris: number
  nLewat: number
  blnLain: { b: string, n: number }[]
}

/** "-" is the POS's empty column, not a person's name. */
// Source: laksamana-office/deploy/analytics/index.html:7683
export function vdOrang(v: unknown): string {
  const t = String(v == null ? '' : v).trim()
  return (!t || t === '-') ? '' : t
}

/**
 * Raw Cancel/Void rows -> one stored month. The month comes from the DATA,
 * never from the "Period" header row (the requested range is not necessarily
 * what came out). Past VOID_MAKS the rows are cut and COUNTED.
 */
// Source: laksamana-office/deploy/analytics/index.html:7687
export function uraiLaporanVoid(baris: BarisTabel[], namaBerkas: string): HasilUraiVoid {
  const iH = cariBarisKepala(baris)
  if (iH < 0) throw new Error('Baris kepala kolom tidak ketemu. Pastikan berkasnya hasil ekspor POS, bukan berkas yang sudah disunting.')
  const K = petaKolom(baris[iH] ?? {}, KOL_VOID)
  const sel = (b: BarisTabel, k: string | null | undefined): string => (k ? String(b[k] ?? '') : '')

  const data: VoidSimpan[] = []
  const perBln: Record<string, number> = {}
  let takTerbaca = 0
  let nRow = 0

  for (let i = iH + 1; i < baris.length; i++) {
    const b = baris[i] ?? {}
    if (!Object.keys(b).some(k => String(b[k] ?? '').trim() !== '')) continue
    nRow++
    const bill = sel(b, K.bill).trim()
    const menu = sel(b, K.menu).trim()
    if (!bill && !menu) continue
    // Void hours read AS-IS from the Excel serial — already WIB, proven by
    // matching Order Time serials against bill-number epochs (all +7h).
    const t = isoDariTanggal(sel(b, K.waktu))
    const j = jamDari(sel(b, K.waktu))
    if (!t) {
      takTerbaca++
      continue
    }
    const m = t.slice(0, 7)
    perBln[m] = (perBln[m] || 0) + 1
    data.push({
      tgl: t,
      jam: j,
      bill,
      menu,
      kat: sel(b, K.katD).trim(),
      orderBy: vdOrang(sel(b, K.orderBy)),
      // The label is stored as written; upper-casing is for grouping at draw
      // time only, never here.
      by: vdOrang(sel(b, K.by)),
      jenis: sel(b, K.jenis).trim(),
      nota: sel(b, K.nota).trim(),
      qty: angkaPos(sel(b, K.qty)),
      total: angkaPos(sel(b, K.total)),
      sub: angkaPos(sel(b, K.sub)),
    })
  }

  const { bulan, lain } = bulanPosTerbanyak(perBln)
  const ikut = bulan ? data.filter(x => x.tgl.slice(0, 7) === bulan) : []
  const blnLain = data.length - ikut.length
  const terpotong = Math.max(0, ikut.length - VOID_MAKS)
  const simpan = ikut.slice(0, VOID_MAKS)
  const bl: Record<string, number> = {}
  simpan.forEach((x) => {
    if (x.bill) bl[x.bill] = 1
  })
  return {
    kind: 'void',
    bulan,
    berkas: namaBerkas,
    baris: simpan,
    ringkas: {
      nBaris: simpan.length,
      nBill: Object.keys(bl).length,
      qty: simpan.reduce((a, x) => a + x.qty, 0),
      total: simpan.reduce((a, x) => a + x.total, 0),
      blnLain,
      terpotong,
      takTerbaca,
    },
    nBaris: nRow,
    nLewat: takTerbaca,
    blnLain: lain,
  }
}

/**
 * Group void rows case-insensitively, display the first spelling met.
 * Reasons are free text typed by people ("ganti produk" vs "Ganti Produk"):
 * two spellings of the same meaning as two rows would split the top rank.
 */
// Source: laksamana-office/deploy/analytics/index.html:4390
export interface KelompokVoid { nama: string, baris: number, qty: number, total: number, bill: number }
export function vdKelompok(baris: VoidSimpan[], ambil: (x: VoidSimpan) => string): KelompokVoid[] {
  const m: Record<string, { nama: string, baris: number, qty: number, total: number, bill: Record<string, number> }> = {}
  baris.forEach((x) => {
    const asli = ambil(x)
    const k = asli.trim().toUpperCase()
    if (!m[k]) m[k] = { nama: asli.trim(), baris: 0, qty: 0, total: 0, bill: {} }
    m[k]!.baris++
    m[k]!.qty += x.qty
    m[k]!.total += x.total
    if (x.bill) m[k]!.bill[x.bill] = 1
  })
  return Object.keys(m).map(k => ({
    nama: m[k]!.nama, baris: m[k]!.baris, qty: m[k]!.qty, total: m[k]!.total,
    bill: Object.keys(m[k]!.bill).length,
  })).sort((a, x) => (x.baris - a.baris) || (x.total - a.total) || (a.nama < x.nama ? -1 : 1))
}

// ---------------------------------------------------------------- kunjungan
// Rekap Kanal: visit purposes split by ordering channel (L2, issue #20).
// GrabFood and GoFood are both written ONLINE by the POS; only the payment
// method tells them apart. Draw-time, never stored: the channel list grows,
// and a baked-in split would never improve for months already saved.

/**
 * Payment methods that are really ORDERING CHANNELS, not ways of paying.
 * Closed list — but failure is VISIBLE: unknown methods stay on the parent
 * row and their names are printed on screen, so the next channel is noticed
 * without anyone reading code.
 */
// Source: laksamana-office/deploy/analytics/index.html:3847
export const KANAL_BAYAR = /\b(GRAB\s*FOOD|GO\s*FOOD|SHOPEE\s*FOOD|TIKTOK\s*GO|MAXIM|TRAVELOKA)\b/
export const kanalKah = (n: unknown): boolean => KANAL_BAYAR.test(String(n || '').toUpperCase())

export interface KanalBaris { n: string, grand: number, bill: number, dari: string[] }

/**
 * Visit purposes + the "<purpose>|<method>" cross map -> one channel list.
 * INVARIANT: the recap's turnover sums EXACTLY to kunjung's turnover. Each
 * parent splits into (channels) + remainder, and the remainder is a
 * SUBTRACTION — never re-summed from unknown methods, which misses once a
 * combined-payment bill appears.
 */
// Source: laksamana-office/deploy/analytics/index.html:3900
export function rekapKanal(
  kj: Record<string, AgregatKunjung>,
  kb: Record<string, AgregatKunjung>,
): { baris: KanalBaris[], takKanal: Record<string, string[]> } {
  const out: Record<string, KanalBaris> = {}
  const takKanal: Record<string, string[]> = {}
  const tambah = (n: string, g: number, b: number, dari: string) => {
    const o = out[n] || (out[n] = { n, grand: 0, bill: 0, dari: [] })
    o.grand += g
    o.bill += b
    if (dari && n !== dari && o.dari.indexOf(dari) < 0) o.dari.push(dari)
  }
  for (const vp of Object.keys(kj)) {
    const g = kj[vp]?.grand || 0
    const b = kj[vp]?.bill || 0
    const pecah = Object.keys(kb)
      .filter(k => k.slice(0, vp.length + 1) === vp + '|')
      .map(k => ({ n: k.slice(vp.length + 1), grand: kb[k]?.grand || 0, bill: kb[k]?.bill || 0 }))
    const kanal = pecah.filter(x => kanalKah(x.n))
    if (!kanal.length) {
      tambah(vp, g, b, '')
      continue
    }
    let sg = 0
    let sb = 0
    kanal.forEach((x) => {
      tambah(x.n, x.grand, x.bill, vp)
      sg += x.grand
      sb += x.bill
    })
    // Leftover BILLS clamp to zero: one bill paid by channel AND another
    // method counts in both, so split bills may exceed the parent's. Turnover
    // does not — portions always sum to 1 — so leftover turnover stands.
    const sisaG = g - sg
    const sisaB = Math.max(0, b - sb)
    if (sisaG > 0.5 || sisaB > 0) {
      tambah(vp, sisaG, sisaB, '')
      const lain = pecah.filter(x => !kanalKah(x.n)).map(x => x.n)
      if (lain.length) takKanal[vp] = lain
    }
  }
  const baris = Object.keys(out).map(k => out[k]!)
    .sort((a, x) => (x.bill - a.bill) || (x.grand - a.grand) || (a.n < x.n ? -1 : 1))
  return { baris, takKanal }
}

/** DINE IN, normalised — the row that carries the Walk In/Event/Marketing split. */
// Source: laksamana-office/deploy/analytics/index.html:3895
export const dineInKah = (n: unknown): boolean =>
  String(n || '').trim().toUpperCase().replace(/[\s_-]+/g, ' ') === 'DINE IN'

// ---------------------------------------------------------------- menu
// Menu exclusions + groups (L2, issue #20). Draw-time, like menuNormal().

/** Event-category menus stay OUT of Menu & Bahan Baku (sold per-head, no HPP recipe). */
// Source: laksamana-office/deploy/analytics/index.html:2040
export const KAT_EVENT = 'EVENT'
/** Top group whose whole content stays out (cigarettes, packaging: sold as-is, never from stock). */
// Source: laksamana-office/deploy/analytics/index.html:2062
export const KEL_LEWAT = 'OTHERS'
export const kelLewatKah = (k: unknown): boolean => String(k || '').trim().toUpperCase() === KEL_LEWAT
export const katEventKah = (n: unknown): boolean => String(n || '').trim().toUpperCase() === KAT_EVENT

/**
 * Raw menu names excluded from Menu & Bahan Baku, read from their DETAIL
 * category: named EVENT, or topped by OTHERS. Returned as a map so the
 * filter is O(1) per menu.
 */
// Source: laksamana-office/deploy/analytics/index.html:2079
export function menuKatLewat(
  katMenu: Record<string, Record<string, AgregatMenu>>,
  kategori: Record<string, AgregatKategori>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const k of Object.keys(katMenu)) {
    if (!katEventKah(k) && !kelLewatKah((kategori[k] || {} as AgregatKategori).kat)) continue
    for (const n of Object.keys(katMenu[k] || {})) out[n] = true
  }
  return out
}

/**
 * Top group (FOOD / BEVERAGES / OTHERS) per RAW menu name, via
 * menu -> detail category -> group. First wins when one name sits in two
 * groups: predictable beats clever, and it never moves between renders.
 */
// Source: laksamana-office/deploy/analytics/index.html:2101
export function kelMenu(
  katMenu: Record<string, Record<string, AgregatMenu>>,
  kategori: Record<string, AgregatKategori>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(katMenu)) {
    const ka = String((kategori[k] || {} as AgregatKategori).kat || '').trim().toUpperCase()
    if (!ka || ka === KAT_TANPA.toUpperCase()) continue
    for (const n of Object.keys(katMenu[k] || {})) {
      if (!out[n]) out[n] = ka
    }
  }
  return out
}

// ---------------------------------------------------------------- meja
// Table-name translation + seat divisor (L2, issue #20). Capacities come from
// ~/utils/venue-layouts (imported, never copied); only the translation and
// the range rule live here.

/** POS values that are NOT tables (24% of August 2026 turnover): orders with no seat. */
// Source: laksamana-office/deploy/analytics/index.html:1995
export const MEJA_BUKAN = ['QUICKSERVICE']
/** Pseudo-zone for rows that never occupied a table: named, not left blank. */
// Source: laksamana-office/deploy/analytics/index.html:4970
export const MEJA_ZONA_TANPA = '(tanpa meja)'

/**
 * POS name -> denah id: "U 3" vs "U3" (spaces), "EXTRA 15" vs "EXT 15"
 * (abbreviation). Without it, real tables report as missing and get added
 * twice.
 */
// Source: laksamana-office/deploy/analytics/index.html:4948
export function mejaNorm(n: unknown): string {
  return String(n || '').trim().toUpperCase().replace(/^EXTRA\b/, 'EXT').replace(/\s+/g, '')
}
export const mejaBukanKah = (n: unknown): boolean => MEJA_BUKAN.indexOf(mejaNorm(n)) >= 0

/**
 * The seat divisor from a free-text capacity ("4", "4-5", "10-12"): the
 * LOWER bound — the chairs actually installed, not the squeezed-in maximum.
 */
// Source: laksamana-office/deploy/analytics/index.html:4962
export function kursiDari(cap: unknown): number {
  const m = String(cap || '').match(/\d+/)
  return m ? +m[0] : 0
}

// ---------------------------------------------------------------- talent
// Performance-slot math (L2, issue #20). A slot is the hours a show CLAIMS,
// as {tgl, jam} pairs: past midnight moves DATE, because the POS records
// 01:00 on the next day.

export interface TalSlotJam { tgl: string, jam: number }

/** "20:00" -> 1200. null when unreadable — a guessed slot bills turnover to a performer who may not be on stage. */
// Source: laksamana-office/deploy/analytics/index.html:4844
export function talMenit(x: unknown): number | null {
  const m = String(x == null ? '' : x).trim().match(/^(\d{1,2})[:.](\d{2})/)
  if (!m) return null
  const j = +m[1]!
  const n = +m[2]!
  if (j > 23 || n > 59) return null
  return j * 60 + n
}

export function tglGeser(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * The hours one performance claims. The LAST hour comes from its last minute
 * (start + duration - 1): 20:00–23:00 owns 20, 21, 22 — NOT 23, when it is
 * already done. Reading through 23 steals a full hour from the next act.
 */
// Source: laksamana-office/deploy/analytics/index.html:4864
export function talSlot(s: { tgl: string, mulai: unknown, selesai: unknown }): { jam: TalSlotJam[], menit: number } | null {
  const m1 = talMenit(s.mulai)
  const m2 = talMenit(s.selesai)
  if (m1 === null || m2 === null) return null
  let durasi = m2 - m1
  if (durasi <= 0) durasi += 1440
  const hMulai = Math.floor(m1 / 60)
  const hAkhir = Math.floor((m1 + durasi - 1) / 60)
  const out: TalSlotJam[] = []
  for (let h = hMulai; h <= hAkhir; h++) {
    const geser = Math.floor(h / 24)
    out.push({ tgl: geser ? tglGeser(s.tgl, geser) : s.tgl, jam: h % 24 })
  }
  return { jam: out, menit: durasi }
}

/**
 * Turnover of a key set ("tgl|jam"). Keys dedupe inside one set — that is
 * what keeps the CATEGORY and PAIR rows right when two acts share an hour.
 */
// Source: laksamana-office/deploy/analytics/index.html:4881
export function talOmset(
  peta: Record<string, Record<string, AgregatHariJam>>,
  kunci: string[],
): { omset: number, jamBerdata: number, jamKosong: number } {
  let g = 0
  let adaData = 0
  let luar = 0
  kunci.forEach((k) => {
    const p = k.split('|')
    const sel = (peta[p[0]!] || {})[+(p[1] ?? -1)]
    if (sel) {
      g += sel.g || 0
      adaData++
    }
    else luar++
  })
  return { omset: g, jamBerdata: adaData, jamKosong: luar }
}

export const talKunci = (slot: { jam: TalSlotJam[] }): string[] => slot.jam.map(x => x.tgl + '|' + x.jam)
