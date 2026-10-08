// Forecast math — pure port of
// `laksamana-office/deploy/stock/ordering/laksamana-forecast.js` (stock.md
// D.5–D.6). The payload comes from Google Apps Script (K-06: Vue calls it
// like the old page does); the stock map comes from `GET /stock/stock-today`.
// Everything here is pure: no fetch, no DOM, no Vue.

export interface ItemForecast {
  unit?: string
  avg_daily?: number
  base_daily?: number
  reorder_point?: number
  tier?: string
  wape?: number | null
  lead_days?: number
  purchase_unit?: string
  per_purchase?: number
  weekend_factor?: number
}

export interface PayloadForecast { generated?: string, count?: number, items?: Record<string, ItemForecast> }

export interface StokKas { stock_now: number, stock_unit?: string }

export type StatusRestock = 'order' | 'soon' | 'safe' | 'check' | 'nostk' | 'nofc'

export const LABEL_STATUS: Record<StatusRestock, string> = {
  order: 'Pesan sekarang',
  soon: 'Segera siapkan',
  safe: 'Aman',
  check: 'Cek pencatatan',
  nostk: 'Stok belum ada',
  nofc: 'Belum ada forecast',
}

export const LABEL_TIER: Record<string, string> = { A: 'Andal', B: 'Cukup', C: 'Perlu dicek' }

/** Suggested orders top the shelf up to this many days of use. */
export const TARGET_COVER_DAYS = 14

/** Restock table shows at most this many rows (ordering/index.html:3757). */
export const RESTOCK_LIMIT = 80

export function normNama(s: unknown): string {
  return String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
}

/** Drop a trailing size/unit hint in parentheses, so "Bawang Putih Kupas" matches "Bawang Putih Kupas (Kg)". */
export function looseKey(s: unknown): string {
  return normNama(String(s ?? '').replace(/\s*\([^()]*\)\s*$/, ''))
}

/**
 * Manual renames the other two matchers cannot catch (genuinely different
 * vocabulary in the item DB vs the forecast). Edit directly; takes effect on
 * next load.
 */
export const NAME_ALIASES: Record<string, string> = {
  'BASIL FRESH': 'Daun Basil (30Gr)',
}

function indeksNama<T>(obj?: Record<string, T> | null): { exact: Record<string, T>, loose: Record<string, T> } {
  const idx = { exact: {} as Record<string, T>, loose: {} as Record<string, T> }
  if (obj) {
    for (const k of Object.keys(obj)) {
      idx.exact[normNama(k)] = obj[k] as T
      const lk = looseKey(k)
      if (!(lk in idx.loose)) idx.loose[lk] = obj[k] as T
    }
  }
  return idx
}

function cari<T>(idx: { exact: Record<string, T>, loose: Record<string, T> } | null, nama: string): T | null {
  if (!idx) return null
  const e = idx.exact[normNama(nama)]
  if (e !== undefined) return e
  const l = idx.loose[looseKey(nama)]
  if (l !== undefined) return l
  const alias = NAME_ALIASES[normNama(nama)]
  if (alias) {
    const a = idx.exact[normNama(alias)]
    if (a !== undefined) return a
    const al = idx.loose[looseKey(alias)]
    if (al !== undefined) return al
  }
  return null
}

export interface PenilaianRestock {
  hasForecast: boolean
  nama: string
  unit: string
  tier: string
  tierLabel: string
  wape?: number | null
  avgDaily: number
  reorderPoint: number
  leadDays?: number
  purchaseUnit: string
  perPurchase: number
  stockNow: number | null
  status: StatusRestock
  daysCover: number | null
  suggestOrderBase: number | null
  suggestOrderPacks: number | null
}

/** Wraps the forecast payload + current stock and answers per-item questions. */
export class BukuForecast {
  private items: Record<string, ItemForecast>
  private fIdx: { exact: Record<string, ItemForecast>, loose: Record<string, ItemForecast> }
  private stock: Record<string, StokKas> = {}
  private sIdx: { exact: Record<string, StokKas>, loose: Record<string, StokKas> } = { exact: {}, loose: {} }

  constructor(payload?: PayloadForecast | null, stock?: Record<string, StokKas> | null) {
    this.items = payload?.items ?? {}
    this.fIdx = indeksNama(this.items)
    this.setStock(stock)
  }

  setStock(stock?: Record<string, StokKas> | null) {
    this.stock = stock ?? {}
    this.sIdx = indeksNama(this.stock)
  }

  forecastFor(nama: string): ItemForecast | null {
    return cari(this.fIdx, nama)
  }

  stockFor(nama: string): number | null {
    const s = cari(this.sIdx, nama)
    return s && s.stock_now != null ? Number(s.stock_now) : null
  }

  /** Stock qty in the forecast's BASE unit (purchase-unit stock × pack size). */
  stockInBase(nama: string): number | null {
    const qty = this.stockFor(nama)
    if (qty == null) return null
    const fc = this.forecastFor(nama)
    if (!fc) return qty
    const s = cari(this.sIdx, nama)
    const su = s?.stock_unit ? normNama(s.stock_unit) : ''
    if (su && fc.purchase_unit && su === normNama(fc.purchase_unit)) {
      return qty * (fc.per_purchase || 1)
    }
    return qty
  }

  /** Per-item assessment. Never throws; always returns a status. */
  assess(nama: string): PenilaianRestock {
    const fc = this.forecastFor(nama)
    if (!fc) {
      return {
        hasForecast: false,
        nama,
        unit: '',
        tier: 'C',
        tierLabel: '',
        avgDaily: 0,
        reorderPoint: 0,
        purchaseUnit: '',
        perPurchase: 1,
        stockNow: this.stockInBase(nama),
        status: 'nofc',
        daysCover: null,
        suggestOrderBase: null,
        suggestOrderPacks: null,
      }
    }
    const avg = Number(fc.avg_daily) || 0
    const reorder = Number(fc.reorder_point) || 0
    const stockBase = this.stockInBase(nama)
    const out: PenilaianRestock = {
      hasForecast: true,
      nama,
      unit: fc.unit || '',
      tier: fc.tier || 'C',
      tierLabel: LABEL_TIER[fc.tier ?? ''] || '',
      wape: fc.wape,
      avgDaily: avg,
      reorderPoint: reorder,
      leadDays: fc.lead_days,
      purchaseUnit: fc.purchase_unit || '',
      perPurchase: fc.per_purchase || 1,
      stockNow: stockBase,
      status: 'nostk',
      daysCover: null,
      suggestOrderBase: null,
      suggestOrderPacks: null,
    }
    if (stockBase == null) return out
    if (stockBase < 0) out.status = 'check'
    else if (stockBase <= reorder) out.status = 'order'
    else if (stockBase <= reorder * 1.5) out.status = 'soon'
    else out.status = 'safe'
    out.daysCover = avg > 0 ? stockBase / avg : null
    if (stockBase <= reorder && avg > 0) {
      const needBase = Math.max(0, avg * TARGET_COVER_DAYS - stockBase)
      out.suggestOrderBase = needBase
      const pack = fc.per_purchase || 1
      out.suggestOrderPacks = pack > 0 ? Math.ceil(needBase / pack) : null
    }
    else {
      out.suggestOrderBase = 0
      out.suggestOrderPacks = 0
    }
    return out
  }

  /** Days that (current stock + a proposed restock) lasts at average daily use. */
  howLongWillLast(nama: string, addQty: number, addUnit: string): number | null {
    const fc = this.forecastFor(nama)
    if (!fc) return null
    const avg = Number(fc.avg_daily) || 0
    if (avg <= 0) return null
    const stockBase = this.stockInBase(nama) ?? 0
    const add = toBaseUnit(Number(addQty) || 0, addUnit, fc).qty
    return (stockBase + add) / avg
  }

  /**
   * Days until empty following the weekend surge day-by-day. Beyond the
   * horizon returns the horizon length with `beyond: true` (a lower bound).
   */
  daysUntilEmpty(nama: string, opts?: { horizon?: number, from?: string }): { days: number, beyond: boolean } | null {
    const fc = this.forecastFor(nama)
    if (!fc) return null
    const stock = this.stockInBase(nama)
    if (stock == null) return null
    let base = Number(fc.base_daily) || 0
    if (base <= 0) base = Number(fc.avg_daily) || 0
    if (base <= 0) return null
    const hari = upcomingDays(opts?.horizon ?? 45, opts?.from)
    let sisa = Number(stock)
    for (let i = 0; i < hari.length; i++) {
      const pakai = base * (hari[i]!.isWeekend ? Math.max(1, Number(fc.weekend_factor) || 1) : 1)
      sisa -= pakai
      if (sisa <= 0) return { days: Math.round((i + sisa / pakai + 1) * 10) / 10, beyond: false }
    }
    return { days: hari.length, beyond: true }
  }
}

const UNIVERSAL_FACTORS: Record<string, Record<string, number>> = {
  KG: { 'GRAM (GR)': 1000, 'GRAM': 1000, 'KG': 1 },
  GRAM: { 'GRAM (GR)': 1, 'GRAM': 1, 'KG': 0.001 },
  PCS: { PCS: 1 },
  IKAT: { IKAT: 1 },
}

/** Convert qty into the item's BASE unit; `converted: false` means "used as-is, flagged". */
export function toBaseUnit(qty: number, unit: string, fc: ItemForecast): { qty: number, converted: boolean } {
  const nu = normNama(unit)
  const baseUnit = normNama(fc.unit || '')
  const uf = UNIVERSAL_FACTORS[nu]
  if (uf && uf[baseUnit] != null) return { qty: qty * uf[baseUnit]!, converted: true }
  if (unit && fc.purchase_unit && nu === normNama(fc.purchase_unit)) {
    return { qty: qty * (fc.per_purchase || 1), converted: true }
  }
  if (nu === baseUnit) return { qty, converted: true }
  return { qty, converted: false }
}

/** Parse a "YYYY-MM-DD" as a LOCAL date (never `new Date(str)`: ISO date-only reads as UTC). */
export function toLocalDate(v?: string | Date | null): Date {
  if (v == null) return new Date()
  if (v instanceof Date) return v
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  if (m) return new Date(+m[1]!, +m[2]! - 1, +m[3]!)
  return new Date(v)
}

export interface HariKalendar { date: string, dow: number, isWeekend: boolean }

/** Next n days starting TOMORROW. */
export function upcomingDays(n: number, mulai?: string | Date): HariKalendar[] {
  const out: HariKalendar[] = []
  const t0 = toLocalDate(mulai ?? null)
  for (let i = 1; i <= n; i++) {
    const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i)
    const dow = d.getDay()
    out.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      dow,
      isWeekend: dow === 0 || dow === 6,
    })
  }
  return out
}

// ---------------------------------------------------------------- forecast reliability (health)

export interface BarisHealth { nama: string, tier: string, wape: number | null, avgDaily: number, unit: string }

/** Payload → flat rows, one per material. `wape: null` = never tested (not "perfect"). */
export function healthRows(payload?: PayloadForecast | null): BarisHealth[] {
  const items = payload?.items ?? {}
  return Object.keys(items).map((nama) => {
    const f = items[nama] ?? {}
    return {
      nama,
      tier: f.tier || 'C',
      wape: (f.wape == null || Number.isNaN(Number(f.wape))) ? null : Number(f.wape),
      avgDaily: Number(f.avg_daily) || 0,
      unit: f.unit || '',
    }
  })
}

/** Count per tier — always over ALL rows, never the filtered view. */
export function healthTally(rows?: BarisHealth[] | null): Record<string, number> {
  const t: Record<string, number> = { A: 0, B: 0, C: 0 }
  for (const r of rows ?? []) t[r.tier] = (t[r.tier] ?? 0) + 1
  return t
}

export type UrutHealth = 'wape_desc' | 'wape_asc' | 'usage_desc' | 'name'

/** Materials WITHOUT a wape are always pushed down on wape sorts: null is not "most accurate". */
export function urutHealth(rows: BarisHealth[], urut: UrutHealth): BarisHealth[] {
  const out = [...rows]
  if (urut === 'wape_desc') out.sort((a, b) => (b.wape == null ? -1 : b.wape) - (a.wape == null ? -1 : a.wape))
  else if (urut === 'wape_asc') out.sort((a, b) => (a.wape == null ? Number.POSITIVE_INFINITY : a.wape) - (b.wape == null ? Number.POSITIVE_INFINITY : b.wape))
  else if (urut === 'usage_desc') out.sort((a, b) => b.avgDaily - a.avgDaily)
  else out.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  return out
}

/** Filter + sort. Returns `{rows, total}` — total is AFTER filter but BEFORE the limit. */
export function healthView(rows: BarisHealth[], opts?: { search?: string, sort?: UrutHealth, limit?: number }): { rows: BarisHealth[], total: number } {
  let out = rows ?? []
  const cari = normNama(opts?.search || '')
  if (cari) out = out.filter(r => normNama(r.nama).includes(cari))
  out = urutHealth(out, opts?.sort ?? 'wape_desc')
  const total = out.length
  if (opts?.limit && opts.limit > 0) out = out.slice(0, opts.limit)
  return { rows: out, total }
}
