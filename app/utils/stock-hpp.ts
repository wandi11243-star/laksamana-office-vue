// HPP math — pure port of the costing rules in
// `laksamana-office/deploy/stock/hpp/index.html` (stock.md F.1–F.9).
//
// Costs are computed by the CLIENT, cascading through recipes that use other
// recipes; only `per1 = harga_beli / qty_beli` is trivial. Everything here is
// a pure function over plain rows: no API, no Vue.
//
// Source lines (hpp/index.html): konvFam :386 · modalResep :520 · tanpaBahan
// :580 · spare/buffer :610 · hargaJual :655 · porsi/yield :668 · sisi_harga
// :735 · lewatResep :788 · tabrakan :801 · JUDUL :826 · prasmananKah :928.

export interface BarisHpp { nama?: string, qty?: number, satuan?: string, ref?: string, catatan?: string }

export interface BahanHppHitung {
  nama: string
  satuan?: string
  qty_beli?: number
  harga_beli?: number
  produk?: string
  sisi_harga?: string
  dibeli_jadi?: boolean
}

export interface ResepHitung {
  id?: string
  nama: string
  jenis?: string
  tipe?: string
  seksi?: string
  kode?: string
  yield_qty?: number
  yield_unit?: string
  harga_baru?: number
  harga_lama?: number
  modal_manual?: number
  bahan?: BarisHpp[]
  aktif?: number | boolean
}

/** Purchasing measure of one ingredient: smallest unit + per-unit sizes. */
export interface UkurPur { satuanDasar?: string, isi?: Record<string, number> }

export interface SettingHppHitung { targetFood?: number, targetDrink?: number, buffer?: number, lampuKuning?: number, lampuMerah?: number }

/** Lookup context: name→ingredient, kind-aware name→recipe, name→purchasing product. */
export interface KonteksHpp {
  PB: Map<string, BahanHppHitung>
  PR: Map<string, ResepHitung>
  PRODUK: Map<string, UkurPur>
}

export const low = (v: unknown): string => String(v ?? '').trim().toLowerCase()

export function numHpp(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Build the lookup context from the three lists (names matched case-insensitively). */
export function buatKonteks(
  bahan: BahanHppHitung[],
  resep: ResepHitung[],
  produk?: { nama: string, satuanDasar?: string, isi?: Record<string, number> }[],
): KonteksHpp {
  const PB = new Map<string, BahanHppHitung>()
  for (const b of bahan ?? []) {
    if (b?.nama) PB.set(low(b.nama), b)
  }
  const PR = new Map<string, ResepHitung>()
  for (const r of resep ?? []) {
    if (!r?.nama) continue
    PR.set(`${low(r.jenis)}|${low(r.nama)}`, r)
    if (!PR.has(low(r.nama))) PR.set(low(r.nama), r)
  }
  const PRODUK = new Map<string, UkurPur>()
  for (const p of produk ?? []) {
    if (p?.nama) PRODUK.set(low(p.nama), { satuanDasar: p.satuanDasar, isi: p.isi })
  }
  return { PB, PR, PRODUK }
}

export function cariResep(ctx: KonteksHpp, nama: string, jenis?: string): ResepHitung | null {
  return ctx.PR.get(`${low(jenis)}|${low(nama)}`) ?? ctx.PR.get(low(nama)) ?? null
}

/** Price of one purchase unit (`harga_beli / qty_beli`, 0 when unpriced). */
export function per1(b?: BahanHppHitung | null): number {
  if (!b || numHpp(b.qty_beli) <= 0) return 0
  return numHpp(b.harga_beli) / numHpp(b.qty_beli)
}

// ---------------------------------------------------------------- unit conversion

type Fam = [string, number]
const SATUAN_FAM: Record<string, Fam> = {
  kg: ['berat', 1],
  kilo: ['berat', 1],
  kilogram: ['berat', 1],
  gram: ['berat', 0.001],
  gr: ['berat', 0.001],
  g: ['berat', 0.001],
  liter: ['volume', 1],
  ltr: ['volume', 1],
  l: ['volume', 1],
  ml: ['volume', 0.001],
  cc: ['volume', 0.001],
  pcs: ['hitung', 1],
  butir: ['hitung', 1],
  btr: ['hitung', 1],
  biji: ['hitung', 1],
  buah: ['hitung', 1],
}

export const satFam = (u: unknown): Fam | undefined => SATUAN_FAM[String(u ?? '').trim().toLowerCase()]

/**
 * Convert qty from one unit to another. Returns the number, or null when the
 * units are incomparable (packaging vs measure, count vs weight — except the
 * deliberate weight↔volume allowance, 1 Gram = 1 ML, stock.md F.12 note).
 */
export function konvFam(qty: number, dari: unknown, ke: unknown): number | null {
  const a = satFam(dari)
  const b = satFam(ke)
  if (!a || !b) return null
  if (a[0] !== b[0]) {
    const cair = (x: string, y: string) => x === 'berat' && y === 'volume'
    if (!cair(a[0], b[0]) && !cair(b[0], a[0])) return null
  }
  return qty * a[1] / b[1]
}

/** Purchasing measure of an HPP ingredient: by name, else via its old pairing. */
export function infoPur(ctx: KonteksHpp, b?: BahanHppHitung | null): UkurPur | null {
  if (!b) return null
  return ctx.PRODUK.get(low(b.nama))
    ?? (b.produk && b.produk !== '-' ? ctx.PRODUK.get(low(b.produk)) ?? null : null)
}

function keDasarPur(qty: number, u: unknown, p: UkurPur | null): number | null {
  const d = String(p?.satuanDasar ?? '').trim()
  if (!d) return null
  if (low(u) === low(d)) return qty
  const isi = p?.isi ?? {}
  for (const k of Object.keys(isi)) {
    if (low(k) === low(String(u ?? '').trim()) && Number(isi[k]) > 0) return qty * Number(isi[k])
  }
  return konvFam(qty, u, d)
}

function dariDasarPur(qty: number, u: unknown, p: UkurPur | null): number | null {
  const d = String(p?.satuanDasar ?? '').trim()
  if (!d) return null
  if (low(u) === low(d)) return qty
  const isi = p?.isi ?? {}
  for (const k of Object.keys(isi)) {
    if (low(k) === low(String(u ?? '').trim()) && Number(isi[k]) > 0) return qty / Number(isi[k])
  }
  return konvFam(qty, d, u)
}

/** Unit families first, then the per-item measure: a typo must not beat physics. */
export function konvSatuan(qty: number, dari: unknown, ke: unknown, pur?: UkurPur | null): number | null {
  const f = konvFam(qty, dari, ke)
  if (f !== null) return f
  if (!pur) return null
  const b = keDasarPur(qty, dari, pur)
  if (b === null) return null
  return dariDasarPur(b, ke, pur)
}

/**
 * A recipe line's qty expressed in its price unit (or the referenced recipe's
 * yield unit). `campur` = units differ and cannot convert: the number is still
 * used as-is (old behaviour) but flagged with ⚠, never silently zeroed.
 */
export function qtySesuai(qty: number, dari: unknown, ke: unknown, pur?: UkurPur | null): { qty: number, campur: boolean } {
  const d = String(dari ?? '').trim()
  const k = String(ke ?? '').trim()
  if (!d || !k || low(d) === low(k)) return { qty, campur: false }
  const c = konvSatuan(qty, d, k, pur)
  if (c === null) return { qty, campur: true }
  return { qty: c, campur: false }
}

// ---------------------------------------------------------------- cascading cost (F.1–F.4)

export interface HasilModal { total: number, hilang: string[], siklus: boolean, campur: string[], manual?: boolean }

/**
 * Cascading cost of one recipe, BEFORE the spare buffer. Missing ingredients
 * are REPORTED (`hilang`), never silently zeroed. Each top-level call gets a
 * fresh memo; results are never mutated (stock.md F.2).
 */
export function modalResep(ctx: KonteksHpp, r?: ResepHitung | null): HasilModal {
  const memo = new Map<string, HasilModal>()
  const jalan = (rec?: ResepHitung | null, jalur?: Record<string, number>): HasilModal => {
    if (!rec) return { total: 0, hilang: [], siklus: false, campur: [] }
    const kunci = String(rec.id ?? `${low(rec.jenis)}|${low(rec.nama)}`)
    const ada = memo.get(kunci)
    if (ada) return ada
    jalur = jalur ?? {}
    if (jalur[kunci]) return { total: 0, hilang: [], siklus: true, campur: [] }
    jalur[kunci] = 1
    let total = 0
    let hilang: string[] = []
    let campur: string[] = []
    let siklus = false
    for (const b of rec.bahan ?? []) {
      if (!b?.nama) continue
      if (lewatResep(ctx, b)) {
        const sub = cariResep(ctx, b.nama, rec.jenis)
        if (!sub) {
          hilang.push(b.nama)
          continue
        }
        const m = jalan(sub, jalur)
        if (m.siklus) siklus = true
        const perUnit = numHpp(sub.yield_qty) > 0 ? m.total / numHpp(sub.yield_qty) : 0
        const q = qtySesuai(numHpp(b.qty), b.satuan, sub.yield_unit)
        if (q.campur) campur.push(b.nama)
        total += perUnit * q.qty
        hilang = hilang.concat(m.hilang)
        campur = campur.concat(m.campur)
      }
      else {
        const it = ctx.PB.get(low(b.nama))
        if (!it) {
          hilang.push(b.nama)
          continue
        }
        const q = qtySesuai(numHpp(b.qty), b.satuan, it.satuan, infoPur(ctx, it))
        if (q.campur) campur.push(b.nama)
        total += per1(it) * q.qty
      }
    }
    jalur[kunci] = 0
    const hasil: HasilModal = { total, hilang, siklus, campur }
    memo.set(kunci, hasil)
    return hasil
  }
  return jalan(r)
}

/** "Without a recipe" = without NAMED ingredient lines (F.5): `{catatan}` lines never count. */
export function tanpaBahan(r?: ResepHitung | null): boolean {
  return (r?.bahan ?? []).filter(b => b?.nama).length === 0
}

/** Base cost: a recipe without ingredients but with a typed-in modal uses it. */
export function modalDasar(ctx: KonteksHpp, r?: ResepHitung | null): HasilModal {
  if (r && tanpaBahan(r) && numHpp(r.modal_manual) > 0) {
    return { total: numHpp(r.modal_manual), hilang: [], siklus: false, campur: [], manual: true }
  }
  return modalResep(ctx, r)
}

/** Spare buffer rate: negatives are refused, zero stays valid (F.3). */
export function spareModal(buffer: unknown): number {
  const p = numHpp(buffer)
  return Number.isFinite(p) && p > 0 ? p : 0
}

/** The buffer applies ONCE, only on finished menus (`tipe === 'dish'`, F.1). */
export function kenaSpare(r?: ResepHitung | null): boolean {
  return !!r && r.tipe === 'dish'
}

/** Menu cost: always a NEW object, so the memoised base is never padded twice (F.2). */
export function modalMenu(ctx: KonteksHpp, r?: ResepHitung | null, buffer?: unknown): HasilModal & { bahan: number, spare: number, rate: number } {
  const m = modalDasar(ctx, r)
  const p = kenaSpare(r) ? spareModal(buffer) : 0
  const spare = m.total * p
  return { total: m.total + spare, bahan: m.total, spare, rate: p, hilang: m.hilang, siklus: m.siklus, campur: m.campur, manual: !!m.manual }
}

/** The single selling price is `harga_baru` (the old column was migrated on load, F.4 note). */
export function hargaJual(r?: ResepHitung | null): number {
  return numHpp(r?.harga_baru) || 0
}

export function porsiYield(r?: ResepHitung | null): number {
  const y = numHpp(r?.yield_qty) || 1
  return y > 0 ? y : 1
}

/** Cost of one portion: the menu total divided by the yield, BEFORE COGS (F.4). */
export function modalPorsi(ctx: KonteksHpp, r?: ResepHitung | null, buffer?: unknown): number {
  return modalMenu(ctx, r, buffer).total / porsiYield(r)
}

/** COGS = portion cost / selling price. Never multiply the price by the yield (F.4). */
export function cogsOf(ctx: KonteksHpp, r?: ResepHitung | null, buffer?: unknown): number | null {
  const h = hargaJual(r)
  if (h <= 0) return null
  return modalPorsi(ctx, r, buffer) / h
}

/** Cost of one recipe line, for per-line breakdowns and dashboards. */
export function biayaBaris(ctx: KonteksHpp, b: BarisHpp, jenis?: string): { biaya: number, campur: boolean, hilang: boolean } {
  if (!b?.nama) return { biaya: 0, campur: false, hilang: false }
  if (lewatResep(ctx, b)) {
    const sub = cariResep(ctx, b.nama, jenis)
    if (!sub) return { biaya: 0, campur: false, hilang: true }
    const m = modalResep(ctx, sub)
    const perUnit = numHpp(sub.yield_qty) > 0 ? m.total / numHpp(sub.yield_qty) : 0
    const q = qtySesuai(numHpp(b.qty), b.satuan, sub.yield_unit)
    return { biaya: perUnit * q.qty, campur: q.campur, hilang: m.hilang.length > 0 }
  }
  const it = ctx.PB.get(low(b.nama))
  if (!it) return { biaya: 0, campur: false, hilang: true }
  const q = qtySesuai(numHpp(b.qty), b.satuan, it.satuan, infoPur(ctx, it))
  return { biaya: per1(it) * q.qty, campur: q.campur, hilang: false }
}

// ---------------------------------------------------------------- one name on two sides (F.6)

function sisiTersimpan(b?: BahanHppHitung | null): string {
  const s = low(b?.sisi_harga)
  if (s === 'beli' || s === 'resep') return s
  return b?.dibeli_jadi ? 'beli' : ''
}

/**
 * Price side of an ingredient: stated first, else inferred from the colliding
 * recipe's type (base → resep). Cheap on purpose: one map lookup, called from
 * inside the cost cascade.
 */
export function sisiHarga(ctx: KonteksHpp, b?: BahanHppHitung | null): string {
  const s = sisiTersimpan(b)
  if (s) return s
  const r = b ? ctx.PR.get(low(b.nama)) ?? null : null
  return r && r.tipe === 'base' ? 'resep' : ''
}

/** One decider for ALL readers: this line is priced from the RECIPE, not the ingredient list. */
export function lewatResep(ctx: KonteksHpp, b?: BarisHpp | null): boolean {
  if (!b) return false
  if (b.ref === 'resep') return true
  const it = ctx.PB.get(low(b.nama))
  return !!it && sisiHarga(ctx, it) === 'resep'
}

// ---------------------------------------------------------------- prasmanan, targets, misc (T-17)

/** Prasmanan is recognised from the section text, not a new column (T-17). */
export function prasmananKah(r?: ResepHitung | null): boolean {
  return /^PRASMANAN\b/i.test(String(r?.seksi ?? ''))
}

export type KategoriResep = 'pras' | 'base' | 'dish'

export function kategoriResep(r?: ResepHitung | null): KategoriResep {
  return prasmananKah(r) ? 'pras' : (r?.tipe === 'base' ? 'base' : 'dish')
}

export function seksiTanpaPras(s?: string): string {
  return String(s ?? '').trim().replace(/^PRASMANAN\b\s*[−–—:]?\s*/i, '')
}

/** COGS target: food vs drink may differ. */
export function ambangOf(set: SettingHppHitung, r?: ResepHitung | null): number {
  return r?.jenis === 'drink' ? numHpp(set.targetDrink) : numHpp(set.targetFood)
}

/** How many recipes use this name as an ingredient line. */
export function dipakaiOleh(resep: ResepHitung[], nama: string): ResepHitung[] {
  const n = low(nama)
  return (resep ?? []).filter(r => (r.bahan ?? []).some(b => b?.nama && low(b.nama) === n))
}

/** Default settings (hpp/index.html:302), used until the server answers. */
export const SET_DEFAULT: SettingHppHitung = { targetFood: 0.33, targetDrink: 0.33, buffer: 0.05, lampuKuning: 3, lampuMerah: 8 }

/**
 * Contribution of each base ingredient across finished menus: the "bahan yang
 * paling menggerakkan modal" list on the HPP dashboard. Only `dish` recipes
 * count; sub-recipe lines are expanded one level via biayaBaris.
 */
export function kontribusiBahan(ctx: KonteksHpp, resep: ResepHitung[], buffer?: unknown): { nama: string, total: number }[] {
  const agg = new Map<string, number>()
  for (const r of resep ?? []) {
    if (r.tipe !== 'dish') continue
    const faktor = (1 + (kenaSpare(r) ? spareModal(buffer) : 0)) / porsiYield(r)
    for (const b of r.bahan ?? []) {
      if (!b?.nama) continue
      const biaya = biayaBaris(ctx, b, r.jenis).biaya * faktor
      agg.set(b.nama, (agg.get(b.nama) ?? 0) + biaya)
    }
  }
  return [...agg.entries()]
    .map(([nama, total]) => ({ nama, total }))
    .sort((a, b) => b.total - a.total)
}

/** One CSV row per INGREDIENT line (F.8): recipe columns only on the first row. */
export function csvResep(resep: ResepHitung[]): string {
  const sel = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = 'Nama,Jenis,Tipe,Seksi,Kode,Yield,Satuan yield,Harga jual,Modal manual,Aktif,Bahan,Qty,Satuan,Ref,Catatan baris'
  const out = [head]
  for (const r of resep) {
    const named = (r.bahan ?? []).filter(b => b && (b.nama || b.catatan))
    const baris = named.length ? named : [{} as BarisHpp]
    baris.forEach((b, i) => {
      out.push([
        i === 0 ? sel(r.nama) : '',
        i === 0 ? sel(r.jenis) : '',
        i === 0 ? sel(r.tipe) : '',
        i === 0 ? sel(r.seksi) : '',
        i === 0 ? sel(r.kode) : '',
        i === 0 ? sel(r.yield_qty) : '',
        i === 0 ? sel(r.yield_unit) : '',
        i === 0 ? sel(r.harga_baru) : '',
        i === 0 ? sel(r.modal_manual) : '',
        i === 0 ? sel(r.aktif === 0 ? 0 : 1) : '',
        sel(b.nama ?? ''),
        sel(b.qty ?? ''),
        sel(b.satuan ?? ''),
        sel(b.nama ? (b.ref ?? '') : 'Catatan'),
        sel(b.catatan ?? ''),
      ].join(','))
    })
  }
  return out.join('\n')
}
