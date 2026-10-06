// Marketing & Event performance bonus engine, the single source for every
// screen that shows realisation or bonus (finance Kas Kecil, marketing, event).
// Port of laksamana-office deploy/assets/performa-bonus.js; owner: the fondasi
// lane (docs/migrasi/PLAN.md §4, TIM-A.md §3). Import it, never copy it: the old
// Office lost time four times to twin money formulas (porsiPic, potonganHari,
// hpp.php, cocokPic) before this file existed.
//
// Pure functions only. The old file also drew the bonus cards as HTML strings
// (kartuBonusMk / kartuBonusEv); those become Vue components and are NOT here.
// Whoever builds them first (finance #14, marketing #16 or event #18) puts them
// in app/components/ through a `fondasi` issue so the other two reuse them.
//
// One deliberate API change: the Office "Tim/Keterangan" lookup is passed in as
// an argument (`ket`) instead of being set once through a global
// (pbSetKeterangan). No ket = nobody is Head, exactly like the old default.

/** Same as the old `num()`: digits and minus only, anything else is 0. */
export function pbNum(v: unknown): number {
  const n = Number.parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

export type Divisi = 'marketing' | 'event'

/** One breakdown row (bd.marketing / bd.event) as stored in the kompas blob. */
export interface BarisBreakdown {
  picId?: string
  eventName?: string
  amount?: number | string
  tax?: number | string
  service?: number | string
  ob?: boolean
  obAmount?: number | string
  obTax?: number | string
  obService?: number | string
  tiket?: boolean
  srcId?: string
  srcJenis?: string
  srcPic?: string
}

export interface HariBreakdown {
  date: string
  bd?: Partial<Record<Divisi, BarisBreakdown[]>>
}

/** A PIC on the division roster. */
export interface PicBonus {
  id: string
  name: string
  officeUserId?: string
}

export interface Compliment {
  subTotal?: number | string | null
  nominal?: number | string
  picDiv?: string
  picOfficeId?: string
  picName?: string
  pemberiDiv?: string
  pemberiOfficeId?: string
  pemberiName?: string
  pemberiStatus?: string
}

/** Office Tim/Keterangan of a PIC; null = Office has not answered for them. */
export type KetFn = (e: PicBonus) => string | null

// ---- Realisation ----

export const pbObAktif = (r?: BarisBreakdown | null): boolean => !!r?.ob

export const pbObTotal = (r?: BarisBreakdown | null): number =>
  pbObAktif(r) ? pbNum(r!.obAmount) + pbNum(r!.obTax) + pbNum(r!.obService) : 0

/**
 * Amount credited to the PIC. MARKETING: amount + tax + service; EVENT: half the
 * amount. Open Bill is added to both and is NOT cut from any cashier.
 */
export function pbPorsiPic(r: BarisBreakdown, divi: Divisi): number {
  if (divi === 'event') return Math.round(pbNum(r.amount) / 2) + pbObTotal(r)
  return pbNum(r.amount) + pbNum(r.tax) + pbNum(r.service) + pbObTotal(r)
}

/** What is actually cut is the SUB TOTAL, not the full compliment value. */
export const pbCompPotong = (c?: Compliment | null): number =>
  c && c.subTotal != null ? pbNum(c.subTotal) : pbNum(c?.nominal)

/**
 * Office user id FIRST, name only as fallback (spelling changes, ids do not).
 * A side whose PIC is "Tamu" points at nobody, so it never matches.
 */
export function pbCompCocok(emp: PicBonus | null | undefined, div?: string, oid?: string, pnama?: string): boolean {
  if (!emp || div === 'tamu') return false
  if (emp.officeUserId && oid) return oid === emp.officeUserId
  if (!pnama) return false
  return String(pnama).trim().toLowerCase() === String(emp.name || '').trim().toLowerCase()
}

export const pbCompIsPicKasir = (c: Compliment, emp: PicBonus | null | undefined) =>
  pbCompCocok(emp, c.picDiv, c.picOfficeId, c.picName)

export const pbCompIsPemberi = (c: Compliment, emp: PicBonus | null | undefined) =>
  pbCompCocok(emp, c.pemberiDiv, c.pemberiOfficeId, c.pemberiName)

/** Old rows without the field read as "menunggu": their cut is released, not applied. */
export function pbCompStatusPemberi(c?: Compliment | null): 'potong' | 'tidak' | 'menunggu' {
  const st = String(c?.pemberiStatus || 'menunggu')
  return st === 'potong' || st === 'tidak' ? st : 'menunggu'
}

export function pbCompFilterPic(list: Compliment[], emp: PicBonus | null | undefined): Compliment[] {
  if (!emp) return []
  return list.filter(c =>
    pbCompIsPicKasir(c, emp)
    || (pbCompIsPemberi(c, emp) && pbCompStatusPemberi(c) === 'potong'))
}

export interface EventDiakui {
  date: string
  name?: string
  amount: number
  tax: number
  service: number
  ob: number
  porsi: number
  tiket: boolean
  /** `mkt:` / `vip:` / `evt:` id of the source event; empty for manual finance rows. */
  srcId: string
  jenis: string
}

export interface AggPic {
  real: number
  events: EventDiakui[]
  compRows?: Compliment[]
  comp?: number
}

export interface BarisYatim {
  date: string
  name: string
  srcId: string
  amount: number
  porsi: number
  srcPic: string
  /** The row had a picId, it just did not match anyone on the roster. */
  ada: boolean
}

/**
 * THE realisation counter for every screen that shows it. Rows whose PIC is not
 * on the roster are collected as `yatim` (credited to nobody, but reported),
 * never dropped silently. Compliments then cut the PIC's realisation, and the
 * rows are kept so the cut can be itemised.
 */
export function pbAgregasi(
  days: HariBreakdown[] | null | undefined,
  divi: Divisi,
  list: PicBonus[] | null | undefined,
  comps?: Compliment[] | null,
): { agg: Record<string, AggPic>, yatim: BarisYatim[] } {
  const agg: Record<string, AggPic> = {}
  const yatim: BarisYatim[] = []
  for (const e of list || []) agg[e.id] = { real: 0, events: [] }
  for (const d of days || []) {
    for (const r of d?.bd?.[divi] || []) {
      const porsi = pbPorsiPic(r, divi)
      // String(): the old code indexed with the raw value, so a missing picId
      // looked up "undefined". Kept identical rather than "tidied".
      const a = agg[String(r.picId)]
      if (a) {
        a.real += porsi
        a.events.push({
          date: d.date,
          name: r.eventName,
          amount: pbNum(r.amount),
          tax: pbNum(r.tax),
          service: pbNum(r.service),
          ob: pbObTotal(r),
          porsi,
          tiket: !!r.tiket,
          srcId: String(r.srcId || ''),
          jenis: String(r.srcJenis || ''),
        })
      }
      else if (pbNum(r.amount) > 0 || r.eventName) {
        yatim.push({
          date: d.date,
          name: r.eventName || '(tanpa nama)',
          srcId: String(r.srcId || ''),
          amount: pbNum(r.amount),
          porsi,
          srcPic: r.srcPic || '',
          ada: !!r.picId,
        })
      }
    }
  }
  for (const e of list || []) {
    const a = agg[e.id]!
    const cr = pbCompFilterPic(comps || [], e)
    a.compRows = cr
    a.comp = cr.reduce((t, c) => t + pbCompPotong(c), 0)
    a.real -= a.comp
  }
  return { agg, yatim }
}

// ---- Ladders ----

export interface Tangga { min: number, bonus: number, label?: string }
export interface TanggaS3 { min: number, leader: number, tim: number, label: string }
export interface TanggaVoucher { min: number, nilai: number }

/** Highest row whose `min` the value reaches; tables are ordered high to low. */
export function mkTangga<T extends { min: number }>(tab: readonly T[], nilai: number): T | null {
  return tab.find(t => nilai >= t.min) || null
}

// Marketing (SDM "Skema Target & Bonus — Tim Marketing", 7 Sep 2026). Basis is
// "Diakui" (omset + tax + service), per PIC already cut by compliments.
// Schemes 1+2+3 add up to one cash amount; scheme 4 (vouchers, leave, award)
// stands alone. Gaps and overlaps in the HR document were resolved IN FAVOUR OF
// THE PIC so that a higher omset can never lower the bonus.

export const MK_S1_MIN_EVENT = 20000000
/** Count of events >= MK_S1_MIN_EVENT. Highest row only, not cumulative. */
export const MK_S1_JUMLAH: readonly Tangga[] = [
  { min: 10, bonus: 2000000 },
  { min: 5, bonus: 500000 },
]
/** Per event, repeatable; each event counted once, at its highest row. */
export const MK_S1_EVENT: readonly Tangga[] = [
  { min: 70000000, bonus: 500000 },
  { min: 30000000, bonus: 300000 },
]
export const MK_S2: readonly Tangga[] = [
  { min: 350000001, bonus: 1500000, label: 'Di atas Rp350.000.000' },
  { min: 300000001, bonus: 1250000, label: 'Rp300.000.001 – Rp350.000.000' },
  { min: 250000001, bonus: 1000000, label: 'Rp250.000.001 – Rp300.000.000' },
  { min: 200000001, bonus: 750000, label: 'Rp200.000.001 – Rp250.000.000' },
  { min: 150000000, bonus: 500000, label: 'Rp150.000.000 – Rp200.000.000' },
  { min: 120000000, bonus: 250000, label: 'Rp120.000.000 – Rp149.999.999' },
]
/** Team omset; "Rp 4.00.0000" in the document is a typo for Rp4.000.000. */
export const MK_S3: readonly TanggaS3[] = [
  { min: 500000001, leader: 4000000, tim: 1750000, label: 'Di atas Rp500.000.000' },
  { min: 450000000, leader: 3000000, tim: 1500000, label: 'Rp450.000.000 – Rp500.000.000' },
  { min: 400000000, leader: 2000000, tim: 1250000, label: 'Rp400.000.000 – Rp450.000.000' },
  { min: 350000000, leader: 1000000, tim: 750000, label: 'Rp350.000.000 – Rp400.000.000' },
  { min: 300000000, leader: 500000, tim: 250000, label: 'Rp300.000.000 – Rp350.000.000' },
]
/** "Di atas Rp X" read as >= X here, same as scheme 1 (one threshold, two wordings). */
export const MK_S4_VOUCHER: readonly TanggaVoucher[] = [
  { min: 56000000, nilai: 200000 },
  { min: 20000000, nilai: 100000 },
]
export const MK_S4_CUTI_MIN = 50000000
export const MK_S4_CUTI_PER = 3
export const MK_S4_TOP = 350000000

export interface TanggaPosisi extends Tangga { label: string, next: Tangga | null }

export function bonusS2(nilai: number): TanggaPosisi {
  const t = mkTangga(MK_S2, nilai)
  if (t) return { ...t, label: t.label!, next: MK_S2[MK_S2.indexOf(t) - 1] || null }
  return { min: 0, bonus: 0, label: 'Belum masuk tangga', next: MK_S2[MK_S2.length - 1]! }
}

/**
 * Head = the WHOLE word "Head" in the Office Tim/Keterangan ("Overhead" and
 * "Headhunter" are not). The same word decides Bonus Leader and who may see the
 * whole team; "Leader" is deliberately no longer recognised.
 */
export function pbHead(e: PicBonus, ket?: KetFn): boolean {
  const k = ket ? ket(e) : null
  if (k === null || k === undefined) return false
  return String(k).toLowerCase().split(/[\s,;/]+/).includes('head')
}

export interface PerPicMarketing {
  s1: number
  ikutS1: boolean
  s2: TanggaPosisi
  s3: number
  isHead: boolean
  tunai: number
  voucher: number
  vJml: Record<number, number>
  evBesar: number
  cuti: number
  top: boolean
}

export interface InfoBonusMarketing {
  per: Record<string, PerPicMarketing>
  headIds: string[]
  /** False = Office answered for nobody (different from "no Head chosen"). */
  ketAda: boolean
  jumPic: number
  jumEvent: number
  s1: {
    lolos: EventDiakui[]
    jum: Tangga | null
    ev: { ev: EventDiakui, t: Tangga }[]
    pool: number
    /** Divisor = PICs WITH an event this period, not the whole roster. */
    bagi: number
    perPic: number
  }
  s3: { tier: TanggaS3 | null, total: number }
  tunaiSemua: number
  voucherSemua: number
  cutiSemua: number
  topSemua: string[]
}

/** Every marketing scheme, from the same `agg` that draws the event table. */
export function bonusMarketing(list: PicBonus[], agg: Record<string, AggPic>, ket?: KetFn): InfoBonusMarketing {
  const evSemua: EventDiakui[] = []
  const aktif: string[] = []
  for (const e of list) {
    const a = agg[e.id]
    if (!a) continue
    if (a.events.length) aktif.push(e.id)
    evSemua.push(...a.events)
  }

  const s1lolos = evSemua.filter(ev => ev.porsi >= MK_S1_MIN_EVENT)
  const s1jum = mkTangga(MK_S1_JUMLAH, s1lolos.length)
  const s1ev: { ev: EventDiakui, t: Tangga }[] = []
  for (const ev of evSemua) {
    const t = mkTangga(MK_S1_EVENT, ev.porsi)
    if (t) s1ev.push({ ev, t })
  }
  const s1pool = (s1jum ? s1jum.bonus : 0) + s1ev.reduce((s, x) => s + x.t.bonus, 0)
  const s1bagi = aktif.length
  const s1per = s1bagi ? Math.floor(s1pool / s1bagi) : 0

  const totTim = list.reduce((s, e) => s + (agg[e.id]?.real || 0), 0)
  const s3 = mkTangga(MK_S3, totTim)
  const headIds = list.filter(e => pbHead(e, ket)).map(e => e.id)
  const ketAda = list.some(e => (ket ? ket(e) : null) !== null)

  const per: Record<string, PerPicMarketing> = {}
  for (const e of list) {
    const a = agg[e.id] || { real: 0, events: [] }
    const ikutS1 = aktif.includes(e.id)
    const s1 = ikutS1 ? s1per : 0
    const s2 = bonusS2(a.real)
    const isHead = headIds.includes(e.id)
    const s3n = s3 ? (isHead ? s3.leader : s3.tim) : 0
    let voucher = 0
    const vJml: Record<number, number> = {}
    for (const ev of a.events || []) {
      const t = mkTangga(MK_S4_VOUCHER, ev.porsi)
      if (t) {
        voucher += t.nilai
        vJml[t.min] = (vJml[t.min] || 0) + 1
      }
    }
    const evBesar = (a.events || []).filter(ev => ev.porsi >= MK_S4_CUTI_MIN).length
    per[e.id] = {
      s1, ikutS1, s2, s3: s3n, isHead,
      tunai: s1 + s2.bonus + s3n,
      voucher, vJml, evBesar,
      cuti: Math.floor(evBesar / MK_S4_CUTI_PER),
      top: a.real >= MK_S4_TOP,
    }
  }
  return {
    per, headIds, ketAda,
    jumPic: list.length,
    jumEvent: evSemua.length,
    s1: { lolos: s1lolos, jum: s1jum, ev: s1ev, pool: s1pool, bagi: s1bagi, perPic: s1per },
    s3: { tier: s3, total: totTim },
    tunaiSemua: list.reduce((s, e) => s + per[e.id]!.tunai, 0),
    voucherSemua: list.reduce((s, e) => s + per[e.id]!.voucher, 0),
    cutiSemua: list.reduce((s, e) => s + per[e.id]!.cuti, 0),
    topSemua: list.filter(e => per[e.id]!.top).map(e => e.name),
  }
}

// Event (7 Sep 2026). Numbering FOLLOWS THE HR DOCUMENT: schemes 1+2+4 are cash,
// scheme 3 (voucher) stands alone. Schemes 1 & 3 use the NET event value
// (`amount`, "nett sebelum tax & services"), not porsi; scheme 4 uses the PIC's
// realisation = half the event value (owner decision 6 Oct 2026).

/** Per event, amount PER PERSON. Document gaps go to the row above. */
export const EV_S1: readonly Tangga[] = [
  { min: 100000001, bonus: 1000000, label: 'Di atas Rp100.000.000' },
  { min: 55000001, bonus: 500000, label: 'Rp55.000.001 – Rp100.000.000' },
  { min: 45000001, bonus: 400000, label: 'Rp45.000.001 – Rp55.000.000' },
  { min: 35000000, bonus: 300000, label: 'Rp35.000.000 – Rp45.000.000' },
]
/** COUNT of events in the month, one team pool. Highest row only. */
export const EV_S2: readonly Tangga[] = [
  { min: 12, bonus: 500000 },
  { min: 10, bonus: 200000 },
]
/** "8 event" is the work standard: drawn in the table, never pays. */
export const EV_S2_DASAR = 8
/** "Di atas Rp X" read literally (> X) here: no clashing threshold in this document. */
export const EV_S3_VOUCHER: readonly TanggaVoucher[] = [
  { min: 100000001, nilai: 250000 },
  { min: 56000001, nilai: 150000 },
  { min: 30000001, nilai: 100000 },
]
/** Its own table on purpose: shares nothing with MK_S2. */
export const EV_S4: readonly Tangga[] = [
  { min: 350000001, bonus: 1000000, label: 'Di atas Rp350.000.000' },
  { min: 300000001, bonus: 700000, label: 'Rp300.000.001 – Rp350.000.000' },
  { min: 250000001, bonus: 500000, label: 'Rp250.000.001 – Rp300.000.000' },
  { min: 200000001, bonus: 350000, label: 'Rp200.000.001 – Rp250.000.000' },
  { min: 150000000, bonus: 250000, label: 'Rp150.000.000 – Rp200.000.000' },
]

export function tanggaEvS4(nilai: number): TanggaPosisi {
  const t = mkTangga(EV_S4, nilai)
  if (t) return { ...t, label: t.label!, next: EV_S4[EV_S4.indexOf(t) - 1] || null }
  return { min: 0, bonus: 0, label: 'Belum masuk tangga', next: EV_S4[EV_S4.length - 1]! }
}

export interface PerPicEvent {
  s1: number
  s1Jml: Record<number, number>
  s2: number
  ikutS2: boolean
  s4: TanggaPosisi
  net: number
  dasarS4: number
  jumEvent: number
  tunai: number
  voucher: number
  vJml: Record<number, number>
}

export interface InfoBonusEvent {
  per: Record<string, PerPicEvent>
  jumPic: number
  jumEvent: number
  s2: { tier: Tangga | null, pool: number, bagi: number, perPic: number }
  tunaiSemua: number
  voucherSemua: number
  netSemua: number
}

/** Every event scheme, from the same `agg` that draws the event table. */
export function bonusEvent(list: PicBonus[], agg: Record<string, AggPic>): InfoBonusEvent {
  const evSemua: EventDiakui[] = []
  const aktif: string[] = []
  for (const e of list) {
    const a = agg[e.id]
    if (!a) continue
    if (a.events.length) aktif.push(e.id)
    evSemua.push(...a.events)
  }

  const s2tier = mkTangga(EV_S2, evSemua.length)
  const s2pool = s2tier ? s2tier.bonus : 0
  const s2bagi = aktif.length
  const s2per = s2bagi ? Math.floor(s2pool / s2bagi) : 0

  const per: Record<string, PerPicEvent> = {}
  for (const e of list) {
    const a = agg[e.id] || { real: 0, events: [] }
    const evs = a.events || []
    let s1 = 0
    const s1Jml: Record<number, number> = {}
    for (const ev of evs) {
      const t = mkTangga(EV_S1, pbNum(ev.amount))
      if (t) {
        s1 += t.bonus
        s1Jml[t.min] = (s1Jml[t.min] || 0) + 1
      }
    }
    let voucher = 0
    const vJml: Record<number, number> = {}
    for (const ev of evs) {
      const t = mkTangga(EV_S3_VOUCHER, pbNum(ev.amount))
      if (t) {
        voucher += t.nilai
        vJml[t.min] = (vJml[t.min] || 0) + 1
      }
    }
    const net = evs.reduce((s, ev) => s + pbNum(ev.amount), 0)
    // Rows without porsi (old shape) count half their own value, the event rule of pbPorsiPic.
    const dasarS4 = evs.reduce((s, ev) => s + (ev.porsi != null ? pbNum(ev.porsi) : Math.round(pbNum(ev.amount) / 2)), 0)
    const s4 = tanggaEvS4(dasarS4)
    const ikutS2 = aktif.includes(e.id)
    per[e.id] = {
      s1, s1Jml, s2: ikutS2 ? s2per : 0, ikutS2,
      s4, net, dasarS4, jumEvent: evs.length,
      tunai: s1 + (ikutS2 ? s2per : 0) + s4.bonus,
      voucher, vJml,
    }
  }
  return {
    per,
    jumPic: list.length,
    jumEvent: evSemua.length,
    s2: { tier: s2tier, pool: s2pool, bagi: s2bagi, perPic: s2per },
    tunaiSemua: list.reduce((s, e) => s + per[e.id]!.tunai, 0),
    voucherSemua: list.reduce((s, e) => s + per[e.id]!.voucher, 0),
    netSemua: list.reduce((s, e) => s + per[e.id]!.net, 0),
  }
}

/**
 * The "Realisasi" cell of a ladder table, as data (the old selRealisasi returned
 * HTML). The row in force shows the value, rows above show what is missing, rows
 * already passed say so. `nilai` null = the ladder is not judging one person
 * (the "Semua PIC" segment): showing a combined figure there promises a bonus
 * nobody will ever receive.
 */
export type SelRealisasi
  = | { jenis: 'kosong' }
    | { jenis: 'aktif', nilai: number }
    | { jenis: 'terlampaui' }
    | { jenis: 'kurang', nilai: number }

export function selRealisasi(nilai: number | null | undefined, min: number, aktif: boolean): SelRealisasi {
  if (nilai === null || nilai === undefined) return { jenis: 'kosong' }
  if (aktif) return { jenis: 'aktif', nilai }
  if (nilai >= min) return { jenis: 'terlampaui' }
  return { jenis: 'kurang', nilai: min - nilai }
}
