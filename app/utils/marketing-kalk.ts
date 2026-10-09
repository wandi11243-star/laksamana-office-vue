// Marketing › Menu Kalkulator (docs/migrasi/marketing.md D.19, issue #63) —
// pure rules, ported from deploy/marketing/index.html:18935-19885.
//
// Menu & price come from the Prasmanan recipes of HPP & Resep, through the HPP
// engine (`hpp-mesin.ts`) — never a copy of its formulas. Nothing here talks to
// the API or Vue.
import type { HppMesin } from '~/utils/hpp-mesin'
import type { ResepHitung } from '~/utils/stock-hpp'

/** One offered menu: category, name, selling price per unit (null = not priced), unit. */
export interface MenuKalkMkt { kat: string, n: string, h: number | null, u: string, r: ResepHitung }

/** One calculator row: `ref` = "category|name" (stable while menus are added elsewhere), `pcs` = quantity. */
export interface BarisKalkMkt { ref: string, pcs: number }

/** "PRASMANAN - AYAM goreng" → "Ayam Goreng"; empty → "Lainnya" (kalkNamaKat :118). */
export function namaKatKalkMkt(seksi?: string): string {
  const s = String(seksi ?? '').replace(/^PRASMANAN\s*-?\s*/i, '').trim() || 'Lainnya'
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

/** Sale unit = the recipe's yield unit, first letter upper-cased; empty → "Porsi" (kalkSatuanDari). */
export function satuanKalkMkt(r?: ResepHitung | null): string {
  const u = String(r?.yield_unit ?? '').trim()
  return u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Porsi'
}

/** Six colour tokens (the old palette's gold, blue, green, brick, purple, teal). */
export const WARNA_KAT_KALK_MKT = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning', 'bg-vip', 'bg-inverted'] as const

/** Stable colour index of a category: hash ×31 over its characters (kalkWarnaIdx :79). */
export function idxWarnaKatKalkMkt(kat: string): number {
  const t = String(kat ?? '')
  let n = 0
  for (let i = 0; i < t.length; i++) n = (n * 31 + t.charCodeAt(i)) >>> 0
  return n % WARNA_KAT_KALK_MKT.length
}

/** One order everywhere: colour first (same colours side by side), then name (kalkUrutKat). */
export function urutKatKalkMkt(a: string, b: string): number {
  const wa = idxWarnaKatKalkMkt(a)
  const wb = idxWarnaKatKalkMkt(b)
  if (wa !== wb) return wa - wb
  return String(a).localeCompare(String(b), 'id')
}

/** Active Prasmanan recipes grouped by category, names sorted (muatHppKalk :140-147). */
export function menuKalkMkt(m: HppMesin): Record<string, MenuKalkMkt[]> {
  const items: Record<string, MenuKalkMkt[]> = {}
  for (const r of m.resep) {
    if (!m.prasmananKah(r) || r.aktif === 0 || r.aktif === false || (r.aktif as unknown) === '0') continue
    const kat = namaKatKalkMkt(r.seksi)
    const h = m.hargaJual(r)
    ;(items[kat] ??= []).push({ kat, n: String(r.nama ?? '').trim(), h: h > 0 ? h : null, u: satuanKalkMkt(r), r })
  }
  for (const k of Object.keys(items)) items[k]!.sort((a, b) => a.n.localeCompare(b.n))
  return items
}

/** Flat list in the one order (kalkMenuAll). */
export function semuaMenuKalkMkt(items: Record<string, MenuKalkMkt[]>): MenuKalkMkt[] {
  return Object.keys(items).sort(urutKatKalkMkt).flatMap(k => items[k] ?? [])
}

/** Category boxes: count + price range of the priced items (kalkKategori). */
export function kategoriKalkMkt(items: Record<string, MenuKalkMkt[]>): { kat: string, jml: number, min: number, max: number }[] {
  return Object.keys(items).map((kat) => {
    const it = items[kat] ?? []
    const hrg = it.map(m => m.h ?? 0).filter(x => x > 0)
    return { kat, jml: it.length, min: hrg.length ? Math.min(...hrg) : 0, max: hrg.length ? Math.max(...hrg) : 0 }
  }).filter(k => k.jml > 0).sort((a, b) => urutKatKalkMkt(a.kat, b.kat))
}

export const refKalkMkt = (m: { kat: string, n: string }) => `${m.kat}|${m.n}`

export function itemRefKalkMkt(items: Record<string, MenuKalkMkt[]>, ref: string): MenuKalkMkt | null {
  const i = String(ref ?? '').indexOf('|')
  if (!ref || i < 0) return null
  return (items[ref.slice(0, i)] ?? []).find(x => x.n === ref.slice(i + 1)) ?? null
}

/** A new row's quantity is the pax — the most common case (kalkBarisBaru). */
export const barisBaruKalkMkt = (pax: number): BarisKalkMkt => ({ ref: '', pcs: Math.max(0, Math.round(+pax || 0)) })

/**
 * Apply the picker's selection (kalkTerapkanPilih): rows already present keep
 * their quantity; new ones start at pax; never leave the table empty.
 */
export function terapkanPilihKalkMkt(rows: BarisKalkMkt[], dipilih: string[], pax: number): BarisKalkMkt[] {
  const lama = new Map(rows.filter(r => r.ref).map(r => [r.ref, r]))
  const baris = dipilih.map(ref => lama.get(ref) ?? { ref, pcs: Math.max(0, Math.round(+pax || 0)) })
  return baris.length ? baris : [barisBaruKalkMkt(pax)]
}

/** Per-row "= 1,25 porsi / pax · 20 pax tidak kebagian" (kalkHitung :19858-19866). */
export function rasioKalkMkt(pcs: number, pax: number, satuan: string): string {
  if (!pax || !pcs) return '—'
  const per = pcs / pax
  const teks = per % 1 ? per.toFixed(2).replace('.', ',') : String(per)
  return `= ${teks} ${satuan.toLowerCase()} / pax${pcs < pax ? `  ·  ${pax - pcs} pax tidak kebagian` : ''}`
}

export interface RingkasKalkMkt {
  /** Rows with a menu: name, quantity, price (null = no price). */
  baris: { ref: string, kat: string, n: string, pcs: number, h: number | null, u: string, sub: number }[]
  pax: number
  /** Total menu cost (rows without a price add nothing). */
  total: number
  /** A chosen menu has no price — the total carries a warning. */
  adaHargaKosong: boolean
  /** Quantities per unit: 100 porsi + 200 pcs are not "300" of anything. */
  perSatuan: { u: string, jml: number }[]
  /** total / pax, ROUNDED (no one bargains with Rp 12.345,67 per pax). */
  perPax: number
}

/** The totals (kalkRingkas + kalkHitung). */
export function ringkasKalkMkt(items: Record<string, MenuKalkMkt[]>, rows: BarisKalkMkt[], pax: number): RingkasKalkMkt {
  const p = Math.max(0, Math.round(+pax || 0))
  const baris: RingkasKalkMkt['baris'] = []
  const sat = new Map<string, number>()
  let total = 0
  let adaHargaKosong = false
  for (const r of rows) {
    if (!r.ref) continue
    const it = itemRefKalkMkt(items, r.ref)
    const i = r.ref.indexOf('|')
    const pcs = Math.max(0, Math.round(+r.pcs || 0))
    const h = it ? it.h : null
    const u = it?.u || 'Porsi'
    sat.set(u, (sat.get(u) ?? 0) + pcs)
    if (h == null) adaHargaKosong = true
    const sub = h == null ? 0 : h * pcs
    total += sub
    baris.push({ ref: r.ref, kat: r.ref.slice(0, i), n: r.ref.slice(i + 1), pcs, h, u, sub })
  }
  return {
    baris, pax: p, total, adaHargaKosong,
    perSatuan: [...sat].map(([u, jml]) => ({ u, jml })),
    perPax: p ? Math.round(total / p) : 0,
  }
}

export interface DealKalkMkt {
  /** perPax − deal: positive = the customer pays less. */
  selisih: number
  /** selisih / perPax × 100. */
  pct: number
  jenis: 'sama' | 'diskon' | 'markup'
  teks: string
  totalDeal: number
}

/** Discount from the customer's deal price; null when there is no deal or no price yet. */
export function dealKalkMkt(perPax: number, deal: number | null, pax: number): DealKalkMkt | null {
  if (deal == null || perPax <= 0) return null
  const selisih = perPax - deal
  const pct = selisih / perPax * 100
  const angka = (x: number) => x.toFixed(x % 1 ? 2 : 0)
  if (Math.abs(pct) < 0.005) return { selisih, pct, jenis: 'sama', teks: 'Tanpa diskon (harga sama)', totalDeal: deal * pax }
  if (pct > 0) return { selisih, pct, jenis: 'diskon', teks: `Diskon ${angka(pct)}%`, totalDeal: deal * pax }
  return { selisih, pct, jenis: 'markup', teks: `Markup ${angka(Math.abs(pct))}% (deal di atas harga jual)`, totalDeal: deal * pax }
}

/** Yield units whose cost per unit is not comparable with a price per portion (kalkYieldAneh). */
export function yieldAnehKalkMkt(r?: ResepHitung | null): boolean {
  const u = String(r?.yield_unit ?? '').trim().toLowerCase()
  return !!u && !['porsi', 'pcs', 'pax', 'cup', 'gelas', 'buah', 'pack'].includes(u)
}

// ---------------------------------------------------------------- named history (G-09)
// The named calculations of the old S.kalkHistori, stored as documents/kalkHistori.
// Only what the whole marketing team may see is saved: menus, quantities, the
// SELLING PRICE at save time (HPP can change later) and the deal — the cost per
// portion is NEVER stored (:19310-19325).

/** One saved named calculation (legacy S.kalkHistori record). */
export interface RiwayatKalkMkt {
  id: string
  nama: string
  pax: number
  deal: number | null
  /** rows at save time: ref, category, name, quantity, and the price SNAPSHOT. */
  rows: { ref: string, kat: string, n: string, pcs: number, h: number | null }[]
  total: number
  perPax: number
  by: string
  byId: string
  at: string
  updatedAt: number
}

/** A saved calculation from the current totals (kalkSimpanHistori, :19341). */
export function rekamKalkMkt(
  id: string,
  nama: string,
  rk: RingkasKalkMkt,
  deal: number | null,
  by: string,
  byId: string,
  at: string,
  updatedAt: number,
): RiwayatKalkMkt {
  return {
    id,
    nama,
    pax: rk.pax,
    deal,
    rows: rk.baris.map(b => ({ ref: b.ref, kat: b.kat, n: b.n, pcs: b.pcs, h: b.h })),
    total: rk.total,
    perPax: rk.perPax,
    by,
    byId,
    at,
    updatedAt,
  }
}

/** Newest saved first; entries without an id dropped (kalkHistoriList). */
export function urutRiwayatKalkMkt(list: RiwayatKalkMkt[] | null | undefined): RiwayatKalkMkt[] {
  return (Array.isArray(list) ? list : []).filter(x => x && x.id)
    .slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
}

/** The discount column from a saved calculation; '—' when there is no deal or no price (kalkHistoriHTML). */
export function diskonRiwayatKalkMkt(x: RiwayatKalkMkt): string {
  if (x.deal == null || !(x.perPax > 0)) return '—'
  const dis = (x.perPax - x.deal) / x.perPax * 100
  if (Math.abs(dis) < 0.005) return '0%'
  return `${dis > 0 ? 'Diskon ' : 'Naik '}${Math.abs(dis).toFixed(dis % 1 ? 1 : 0)}%`
}

/** Who may delete a saved calculation: module admin, or its author by id/name (kalkBolehHapus). */
export function bolehHapusKalkMkt(x: RiwayatKalkMkt, admin: boolean, meId?: string, meName?: string): boolean {
  return !!x && (admin || (!!meId && x.byId === meId) || (!!meName && x.by === meName))
}

/**
 * Menus whose Prasmanan price moved since the calculation was saved, and menus
 * that no longer exist — both are NAMED when a history is reopened, never
 * silently used (kalkBukaHistori, :19368-19383).
 */
export function cekHargaKalkMkt(
  x: RiwayatKalkMkt,
  items: Record<string, MenuKalkMkt[]>,
): { berubah: { n: string, dari: number | null, ke: number | null }[], hilang: string[] } {
  const berubah: { n: string, dari: number | null, ke: number | null }[] = []
  const hilang: string[] = []
  for (const r of x.rows ?? []) {
    const it = itemRefKalkMkt(items, r.ref)
    const lama = r.h == null ? null : +r.h
    if (!it) hilang.push(r.n)
    else if ((it.h || null) !== lama) berubah.push({ n: r.n, dari: lama, ke: it.h })
  }
  return { berubah, hilang }
}
