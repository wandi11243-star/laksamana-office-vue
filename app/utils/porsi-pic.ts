// Cashier's share of the money engine: porsiPic (both variants), event
// deductions, Open Bill, the cashier bonus ladder, and the Tim/Keterangan
// filters. Shared with Finance › Omset and Finance › Kas later — this file is
// owned by the cashier lane (docs/migrasi/PLAN.md §4, TIM-A.md §3). Nobody
// copies these functions; they import them.
//
// Pure functions only: no Vue, no API, and no imports at all so that
// `tools/uji-porsi-pic.mjs` can import this file with plain Node like the
// other rule files.
//
// K-04 (owner decision, _pertanyaan.md): the cashier porsiPic and the Kompas
// porsiPic are DELIBERATELY different and must NEVER be merged:
//
//   cashier : r.tiket ? round(amount × 0.5) : amount
//   kompas  : marketing → amount + tax + service + obTotal
//             event     → round(amount / 2) + obTotal
//
// Both change live money; both live in this one file so whoever "simplifies"
// one of them sees the other line first.
//
// Source: laksamana-office/deploy/cashier/index.html:2248-2365, 3517-3635;
//         deploy/finance/omset/index.html:2796-2800 (Kompas twin).

/** Same as the old `num()`: digits and minus only, anything else is 0. */
export function ppNum(v: unknown): number {
  const n = Number.parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** Half the ticket is the PIC's share in the CASHIER variant only (K-04). */
export const PORSI_PIC_TIKET = 0.5

/** One breakdown row inside `daily[].bd.kasir / .marketing / .event`. */
export interface BarisPotong {
  kasirId?: string
  amount?: unknown
  disc?: unknown
  off?: boolean
  tiket?: boolean
  shift?: unknown
  dw?: unknown
  menuFix?: string
  payGroup?: boolean
  ob?: boolean
  obAmount?: unknown
  obTax?: unknown
  obService?: unknown
  obKasirId?: string
  eventName?: string
  tax?: unknown
  service?: unknown
  /**
   * Manual per-cashier nominals (`{kasirId: rupiah}`), written by the
   * "Atur nominal" switch of the shift modal. Sums to `total` when honoured;
   * anything else falls back to the even split, never to a partial manual.
   */
  shiftNom?: Record<string, unknown> | null
  [k: string]: unknown
}

/** One `daily[]` row of the kompas blob (only the fields this engine reads). */
export interface HariKompas {
  date: string
  bd?: { kasir?: BarisPotong[], marketing?: BarisPotong[], event?: BarisPotong[] }
  [k: string]: unknown
}

/** One PIC row of `employees.{kasir,marketing,event}` (written by Kompas). */
export interface PicKompas {
  id: string
  name: string
  target?: unknown
  officeUserId?: string | null
  [k: string]: unknown
}

export interface EmployeesKompas {
  kasir?: PicKompas[]
  marketing?: PicKompas[]
  event?: PicKompas[]
  [k: string]: unknown
}

/**
 * CASHIER variant (:2249-2252). Sent as `porsiPic` in the old cashier file.
 * Only used for the cashier's own deduction (`potonganBaris`).
 */
export function porsiPicCashier(r?: BarisPotong | null): number {
  const a = ppNum(r?.amount)
  return r?.tiket ? Math.round(a * PORSI_PIC_TIKET) : a
}

/** Open Bill is only counted when the row is ticked (`obAktif`, :2266). */
export function obAktif(r?: BarisPotong | null): boolean {
  return !!(r && r.ob)
}

/** `obAmount + obTax + obService` of a ticked row; 0 otherwise (:2267). */
export function obTotal(r?: BarisPotong | null): number {
  return obAktif(r) ? ppNum(r?.obAmount) + ppNum(r?.obTax) + ppNum(r?.obService) : 0
}

/**
 * KOMPAS variant (omset & kas, `deploy/finance/omset/index.html:2798-2800`).
 * Event rows no longer deduct the cashier at all (7 Aug 2026) — this is the
 * PIC's recognition, not the cashier's deduction.
 */
export function porsiPicKompas(r: BarisPotong | null | undefined, divi: 'marketing' | 'event'): number {
  if (divi === 'event') return Math.round(ppNum(r?.amount) / 2) + obTotal(r)
  return ppNum(r?.amount) + ppNum(r?.tax) + ppNum(r?.service) + obTotal(r)
}

/**
 * Open Bill rows of one day: `[{kasirId, eventName, total}]` (:2270-2280).
 * Read by the cashier screen for recognition only — the money is already
 * inside the day's gross, so it is never added to `real`.
 */
export function openBillList(d: HariKompas): { kasirId: string, eventName: string, total: number }[] {
  const out: { kasirId: string, eventName: string, total: number }[] = []
  for (const key of ['marketing', 'event'] as const) {
    for (const r of d.bd?.[key] ?? []) {
      if (!obAktif(r)) continue
      const t = obTotal(r)
      if (t <= 0) continue
      out.push({ kasirId: String(r.obKasirId || ''), eventName: String(r.eventName || ''), total: t })
    }
  }
  return out
}

/** `'tetap' | 'ditempat' | ''` — anything else is undecided (:2315). */
export function menuFixRow(r?: BarisPotong | null): '' | 'tetap' | 'ditempat' {
  const v = String((r && r.menuFix) || '')
  return v === 'tetap' || v === 'ditempat' ? v : ''
}

/** `payGroup !== false` (:2316). */
export function payGroupRow(r?: BarisPotong | null): boolean {
  return !(r && r.payGroup === false)
}

/**
 * Whether a row deducts the cashier at all (:2317-2322): menu chosen on the
 * spot never deducts; agreed menus and undecided rows do, unless finance
 * explicitly excluded the payment group.
 */
export function potongKasirAktif(r?: BarisPotong | null): boolean {
  const mf = menuFixRow(r)
  if (mf === 'ditempat') return false
  if (mf === 'tetap') return true
  return payGroupRow(r)
}

/**
 * The deduction one event row puts on the cashier shift (:2323-2330). Split
 * per SHIFT, not per cashier present; DW never joins the split so the money
 * and the deduction stay equal. Shift empty → `pembagi 0`, nobody is charged.
 *
 * `potongKasirAktif` is applied HERE (the cashier file had lagged the 5 Sep
 * 2026 fix that already lives in the omset/kas twins, cashier.md §F.13):
 * `ditempat` rows and payGroup=false rows give 0 even when a shift was stored
 * on them before the marker existed.
 */
/**
 * One row's deduction, split per cashier on shift (the cashier variant: FREE
 * rows are halved by `porsiPicCashier`, K-04).
 *
 * `manual` is true only when `r.shiftNom` names an exact rupiah amount for
 * EVERY checked cashier AND the amounts add up to `total` — the modal holds
 * Save until they do. A short, over, gappy or negative map is ignored
 * completely (the even split applies), so a half-typed manual can never
 * silently under-charge someone. `nom` carries the per-cashier amounts and
 * is empty unless `manual`.
 */
export interface HasilPotong { per: number, ids: string[], dw: number, pembagi: number, total: number, manual: boolean, nom: Record<string, number> }

/** Read one row's manual map: every checked id with an exact rupiah, or null. */
function bacaNom(total: number, ids: string[], shiftNom: unknown): Record<string, number> | null {
  if (!shiftNom || typeof shiftNom !== 'object') return null
  const m = shiftNom as Record<string, unknown>
  const nom: Record<string, number> = {}
  let jumlah = 0
  for (const id of ids) {
    const mentah = m[id]
    if (mentah === null || mentah === undefined || String(mentah).trim() === '') return null
    const n = ppNum(mentah)
    if (n < 0) return null
    nom[id] = n
    jumlah += n
  }
  return jumlah === total ? nom : null
}

export function potonganBaris(r: BarisPotong): HasilPotong {
  const total = potongKasirAktif(r) ? porsiPicCashier(r) : 0
  const ids = Array.isArray(r.shift) ? r.shift.filter(Boolean).map(String) : []
  const dw = Math.max(0, ppNum(r.dw))
  const pembagi = ids.length
  if (total <= 0 || pembagi <= 0) return { per: 0, ids: [], dw, pembagi, total: Math.max(total, 0), manual: false, nom: {} }
  const nom = bacaNom(total, ids, r.shiftNom)
  if (nom) return { per: 0, ids, dw, pembagi, total, manual: true, nom }
  return { per: Math.round(total / pembagi), ids, dw, pembagi, total, manual: false, nom: {} }
}

/**
 * One cashier's share of one split row: the manual nominal when the row is
 * manual, the even share when the cashier is on shift, else 0. Every
 * per-cashier total goes through here so manual and even rows never mix
 * formulas.
 */
export function bagianPotong(b: HasilPotong, kasirId: string): number {
  if (b.manual) return b.nom[kasirId] ?? 0
  return b.ids.includes(kasirId) ? b.per : 0
}

/**
 * Total deduction for one cashier on one day — MARKETING rows only, exactly
 * like both sibling files (:2347-2354). Event rows stopped deducting on
 * 7 Aug 2026.
 */
export function potonganHari(d: HariKompas, kasirId: string): number {
  let s = 0
  for (const r of d.bd?.marketing ?? []) {
    s += bagianPotong(potonganBaris(r), kasirId)
  }
  return s
}

/**
 * KOMPAS twin of the deduction: the FULL `amount` column (omset :2861,
 * kas `potongKasir`). The tiket halving is the CASHIER variant only (K-04) —
 * the two modules deliberately answer differently for the same free-entry row,
 * and this file keeps both so nobody "fixes" one into the other.
 */
export function potongKasirKompas(r?: BarisPotong | null): number {
  return potongKasirAktif(r) ? ppNum(r?.amount) : 0
}

/** `potonganBaris` for Finance › Omset / Kas: same split per shift, full amount. Manual nominals work the same way. */
export function potonganBarisKompas(r: BarisPotong): HasilPotong {
  const total = potongKasirKompas(r)
  const ids = Array.isArray(r.shift) ? r.shift.filter(Boolean).map(String) : []
  const dw = Math.max(0, ppNum(r.dw))
  const pembagi = ids.length
  if (total <= 0 || pembagi <= 0) return { per: 0, ids: [], dw, pembagi, total: Math.max(total, 0), manual: false, nom: {} }
  const nom = bacaNom(total, ids, r.shiftNom)
  if (nom) return { per: 0, ids, dw, pembagi, total, manual: true, nom }
  return { per: Math.round(total / pembagi), ids, dw, pembagi, total, manual: false, nom: {} }
}

/** Finance › Omset / Kas: total marketing deduction for one cashier on one day. */
export function potonganHariKompas(d: HariKompas, kasirId: string): number {
  let s = 0
  for (const r of d.bd?.marketing ?? []) {
    s += bagianPotong(potonganBarisKompas(r), kasirId)
  }
  return s
}

/**
 * Rows that carry an amount but whose shift is still undecided (:2358-2365).
 * The `potongKasirAktif` filter comes FIRST: rows that never deduct are not
 * "unset", and flagging them sends people to fix nothing.
 */
export function barisTanpaShift(d: HariKompas): BarisPotong[] {
  return (d.bd?.marketing ?? [])
    .filter(r => potongKasirAktif(r) && ppNum(r.amount) > 0 && potonganBaris(r).pembagi <= 0)
}

/** Gross revenue of one cashier row, before the bill discount (:1050). */
export function omsetKasir(r?: BarisPotong | null): number {
  return ppNum(r && r.amount) - ppNum(r && r.disc)
}

/** Discount given by one cashier; an OFF row never counts (:1051). */
export function diskonKasir(r?: BarisPotong | null): number {
  return r && r.off ? 0 : ppNum(r && r.disc)
}

export interface LevelBonus { min: number, bonus: number, label: string }

/**
 * The cashier bonus ladder (SDM document "Skema Target & Bonus — Tim Kasir",
 * :3522-3527). The top is deliberately NOT capped. Twin of the copy in
 * deploy/kompas/index.html — change all three together.
 */
export const BONUS_KASIR: readonly LevelBonus[] = [
  { min: 200000000, bonus: 500000, label: 'Level 4' },
  { min: 150000000, bonus: 300000, label: 'Level 3' },
  { min: 100000000, bonus: 150000, label: 'Level 2' },
  { min: 80000000, bonus: 50000, label: 'Level 1' },
]

/** Current level + the next rung (null on the top level) (:3528-3532). */
export function bonusKasir(real: number): LevelBonus & { next: LevelBonus | null } {
  const t = BONUS_KASIR.find(x => real >= x.min)
  if (t) return { ...t, next: BONUS_KASIR[BONUS_KASIR.indexOf(t) - 1] || null }
  return { min: 0, bonus: 0, label: 'Standar kerja', next: BONUS_KASIR[BONUS_KASIR.length - 1]! }
}

/** `'#<officeUserId>'` / `'@<lower name>'` → the RAW Tim/Keterangan text. */
export type KetMap = Record<string, string>

/**
 * Raw Tim/Keterangan of a PIC, id first then name (:3619-3627). `null` means
 * "not known" (Office unreachable) and callers must keep the person visible —
 * hiding a real cashier because the network lagged is the worse mistake.
 */
export function ketKasir(e: PicKompas | null | undefined, ket: KetMap | null): string | null {
  if (!e) return null
  if (ket) {
    if (e.officeUserId != null) {
      const a = ket['#' + e.officeUserId]
      if (a !== undefined) return a
    }
    const b = ket['@' + String(e.name || '').trim().toLowerCase()]
    if (b !== undefined) return b
  }
  return null
}

/**
 * Only accounts whose Tim/Keterangan is EXACTLY "kasir" (not "Floor, Kasir",
 * not "kasir/office") are assessed on the cashier screen (:3628-3635). Unknown
 * stays visible; the split matches every module (space, comma, semicolon,
 * slash).
 */
export function kasirMurni(e: PicKompas, ket: KetMap | null): boolean {
  const k = ketKasir(e, ket)
  if (k === null) return true
  const t = String(k).toLowerCase().split(/[\s,;/]+/).filter(Boolean)
  return t.length === 1 && t[0] === 'kasir'
}

/** The logged-in cashier's own row, officeUserId first, then name (:3663-3674). */
export function kasirSaya(list: PicKompas[], saya: { id?: string, name?: string } | null): PicKompas | null {
  if (!saya) return null
  const oid = saya.id || ''
  let s = oid ? list.find(k => k.officeUserId && String(k.officeUserId) === oid) : undefined
  if (!s) {
    const nama = String(saya.name || '').trim().toLowerCase()
    if (nama) s = list.find(k => String(k.name || '').trim().toLowerCase() === nama)
  }
  return s || null
}

/** Compliment cut for one PIC (5 Aug 2026): SUB TOTAL only, old rows fall
 *  back to `nominal` so closed months never change (:2173-2181). */
export function compPotong(c?: { subTotal?: unknown, nominal?: unknown } | null): number {
  return c && c.subTotal != null ? ppNum(c.subTotal) : ppNum(c && c.nominal)
}

/** Minimal shape of a compliment row needed by the filter (structure only). */
export interface KomplimenPotong {
  date?: string
  subTotal?: unknown
  nominal?: unknown
  picDiv?: string
  picOfficeId?: string
  picName?: string
  pemberiDiv?: string
  pemberiOfficeId?: string
  pemberiName?: string
}

/**
 * Compliments that charge one PIC: match as PIC KASIR **or** as PEMBERI
 * (:2188-2200). "Tamu" never matches anyone. Both sides are assessed on their
 * own performance screens, so nothing is cut twice in the same place.
 */
export function compFilterPic<T extends KomplimenPotong>(list: T[], emp: Pick<PicKompas, 'name' | 'officeUserId'> | null | undefined): T[] {
  if (!emp) return []
  const nama = String(emp.name || '').trim().toLowerCase()
  const cocok = (div?: string, oid?: string, pnama?: string) => {
    if (div === 'tamu') return false
    if (emp.officeUserId && oid) return String(oid) === String(emp.officeUserId)
    if (!pnama) return false
    return String(pnama).trim().toLowerCase() === nama
  }
  return list.filter(c =>
    cocok(c.picDiv, c.picOfficeId, c.picName)
    || cocok(c.pemberiDiv, c.pemberiOfficeId, c.pemberiName),
  )
}
