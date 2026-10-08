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
  KUN_TANPA,
  MEJA_TANPA,
  PAKET_RE,
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
