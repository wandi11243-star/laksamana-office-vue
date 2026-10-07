// ONE source for the omset blob's day rows: the row shape, the derived numbers
// (gross/net/tagihan/avg/items) and the Input Omset Harian validation. The old
// Office repeated these in several files (`omset:1033-1041`, kas, brankas) and
// finance.md F.5/F.19 calls the twins out — import, never copy.
//
// Pure and import-free so `tools/uji-kompas.mjs` can import it with plain Node.

/** Same as the old `num()`: digits and minus only, anything else is 0. */
export function kNum(v: unknown): number {
  const n = Number.parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** One breakdown row inside `daily[].bd.{marketing,event,kasir}`. */
export interface BarisBd {
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
  picId?: string
  srcId?: string
  srcPic?: string
  tax?: unknown
  service?: unknown
  [k: string]: unknown
}

export interface BdB {
  marketing?: BarisBd[]
  event?: BarisBd[]
  kasir?: BarisBd[]
  self?: { amount?: unknown, disc?: unknown, [k: string]: unknown }
  abaikan?: string[]
  [k: string]: unknown
}

/** One trail row of a day (`log`) or of a breakdown (`bdLog`). */
export interface JejakHari {
  by: string
  at: number
}

/** One `daily[]` row of the kompas blob. */
export interface BarisHarian {
  date: string
  food?: unknown
  bev?: unknown
  lainnya?: unknown
  discount?: unknown
  service_charge?: unknown
  tax?: unknown
  traffic?: unknown
  bill?: unknown
  qty_food?: unknown
  qty_bev?: unknown
  qty_others?: unknown
  bd?: BdB
  bdValid?: boolean
  bdLog?: JejakHari[]
  log?: JejakHari[]
  [k: string]: unknown
}

/** `'2026-10-05'` → `'2026-10'`. */
export const monthKeyOf = (date: unknown) => String(date || '').slice(0, 7)

/** Σ food + bev + lainnya (:1033). */
export const grossOf = (d: Pick<BarisHarian, 'food' | 'bev' | 'lainnya'>) =>
  kNum(d.food) + kNum(d.bev) + kNum(d.lainnya)

/** Gross − discount (:1034). Tax & service sit OUTSIDE the omset. */
export const netOf = (d: Pick<BarisHarian, 'food' | 'bev' | 'lainnya' | 'discount'>) =>
  grossOf(d) - kNum(d.discount)

/** Service + tax, billed to the guest but never part of the omset (:1038). */
export const taxSvcOf = (d: Pick<BarisHarian, 'service_charge' | 'tax'>) =>
  kNum(d.service_charge) + kNum(d.tax)

/** What the guest actually pays: net + service + tax (:1039). */
export const tagihanOf = (d: Parameters<typeof netOf>[0] & Pick<BarisHarian, 'service_charge' | 'tax'>) =>
  netOf(d) + taxSvcOf(d)

/** Net ÷ bills; 0 when there are no bills (:1040). */
export const avgSpendOf = (d: Parameters<typeof netOf>[0] & Pick<BarisHarian, 'bill'>) => {
  const b = kNum(d.bill)
  return b > 0 ? netOf(d) / b : 0
}

/** Items sold (:1041). */
export const itemsOf = (d: Pick<BarisHarian, 'qty_food' | 'qty_bev' | 'qty_others'>) =>
  kNum(d.qty_food) + kNum(d.qty_bev) + kNum(d.qty_others)

const KOLOM_INPUT = ['food', 'bev', 'lainnya', 'discount', 'service_charge', 'tax', 'traffic', 'bill', 'qty_food', 'qty_bev', 'qty_others'] as const

/**
 * Input Omset Harian validation (`saveDaily`, omset :1490-1510). The Report
 * Daily difference gate was REMOVED 4 Aug 2026: a day with a receivable is
 * ALWAYS off by the bon, and locking the save only makes people invent numbers.
 * The difference is warned about, never enforced.
 */
export function validasiHarian(rec: Pick<BarisHarian, typeof KOLOM_INPUT[number]>): string[] {
  const errs: string[] = []
  for (const k of KOLOM_INPUT) if (kNum(rec[k]) < 0) errs.push('Nilai tidak boleh negatif.')
  if (grossOf(rec) === 0) errs.push('Pendapatan tidak boleh kosong.')
  if (kNum(rec.discount) > grossOf(rec)) errs.push('Diskon melebihi total pendapatan.')
  if (kNum(rec.traffic) < kNum(rec.bill)) errs.push('Traffic harus ≥ jumlah Bill.')
  return [...new Set(errs)]
}
