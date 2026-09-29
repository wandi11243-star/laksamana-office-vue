// Service Excellent — achievement, reward, review periods, divisions.
//
// Pure functions, owned by the Reservasi module (PLAN.md §4) for its second
// panel. The board is keyed by NAME, not id — a review stores the host name
// as written — so matching is case-insensitive by name throughout.
//
// Source: laksamana-office/deploy/service_excellent/index.html (lines inline).

import type { Review, RewardTier } from '~/composables/useServiceExcellent'

/** Who counts for review scores: cashier, host, floor (`:7754`). */
export const DIVISI_REVIEW = ['kasir', 'cashier', 'host', 'floor']

/** Who stands on the crew list: the same, plus office (`:7755`). */
export const DIVISI_KRU = [...DIVISI_REVIEW, 'office']

/** Who SEES the "not yet asked" panel: office, ceo, cfo, host (`:7734`). */
export const DIVISI_MINTA_REVIEW = ['office', 'ceo', 'cfo', 'host']

/**
 * Whole-word match. Office keterangan can hold several teams ("office,
 * marketing"), and a plain indexOf lets "backoffice" pass as "office"
 * (`:7756-7762`).
 */
export function divisiCocok(divisi: string | null | undefined, daftar: string[]): boolean {
  const kata = String(divisi || '').toLowerCase().split(/[\s,;/]+/).filter(Boolean)
  return daftar.some(d => kata.includes(d))
}

/** Filter a crew list to divisions; the filtered-out are COUNTED, not hidden silently (`:7764-7774`). */
export function kruTersaring<T extends { divisi?: string | null }>(list: T[], daftar: string[]): { dipakai: T[], tersembunyi: number } {
  const dipakai = list.filter(u => divisiCocok(u.divisi, daftar))
  return { dipakai, tersembunyi: list.length - dipakai.length }
}

export type ModePeriode = 'hari' | 'minggu' | 'bulan'

/** The active date range, inclusive (`:7862-7875`). Weeks start Monday. */
export function rentangReview(mode: ModePeriode, date: string, month: string): { from: string, to: string } {
  if (mode === 'hari') return { from: date, to: date }
  if (mode === 'minggu') {
    const d = new Date(`${date}T00:00:00`)
    const geser = (d.getDay() + 6) % 7
    const s = new Date(d)
    s.setDate(d.getDate() - geser)
    const e = new Date(s)
    e.setDate(s.getDate() + 6)
    const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    return { from: f(s), to: f(e) }
  }
  const [y, m] = month.split('-').map(Number)
  const akhir = new Date(y!, m!, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(akhir).padStart(2, '0')}` }
}

export function labelRentang(mode: ModePeriode, r: { from: string, to: string }, tglPanjang: (t: string) => string, tglPendek: (t: string) => string, labelBulan: string): string {
  if (mode === 'hari') return tglPanjang(r.from)
  if (mode === 'minggu') return `${tglPendek(r.from)} – ${tglPendek(r.to)}`
  return labelBulan
}

/** Targets are monthly, so progress always counts the month the range sits in (`:7879-7881`). */
export const bulanTarget = (r: { from: string }) => r.from.slice(0, 7)

export const dalamRentang = (ymd: string | null | undefined, r: { from: string, to: string }) => {
  const s = String(ymd || '')
  return !!s && s >= r.from && s <= r.to
}

/** The host a review counts for (`:8622`). */
export const hostDari = (x: Pick<Review, 'host' | 'claimedBy' | 'by'>): string =>
  String(x.host || x.claimedBy || x.by || '').trim() || '—'

/** When the invitation went out. Old notes lack `askedAt` and fall back to `at`. */
export const tsDiminta = (rv: Pick<Review, 'askedAt' | 'at'>): number =>
  Number((rv as { askedAt?: unknown }).askedAt || rv.at) || 0

// ---------------------------------------------------------------- reward

export const REWARD_MIN_AWAL = 30
export const REWARD_TIER_AWAL: RewardTier[] = [{ rv: 40, bonus: 40000 }, { rv: 70, bonus: 70000 }, { rv: 100, bonus: 200000 }]

export interface AturanReward { min: number, tiers: RewardTier[] }

/**
 * Cleaned and sorted ASC, once — not at every reader. rewardOf walks small to
 * large and keeps the last match, so an unsorted list would pay tier 40 over
 * tier 100 (`:7594-7612`).
 */
export function normalisasiReward(c: { min?: unknown, tiers?: unknown }): AturanReward {
  const src = c as { min?: number, tiers?: { rv?: unknown, bonus?: unknown }[] }
  const min = typeof src.min === 'number' && Number.isFinite(src.min) && src.min >= 0 ? src.min : REWARD_MIN_AWAL
  const tiers = (Array.isArray(src.tiers) ? src.tiers : REWARD_TIER_AWAL)
    .map(t => ({ rv: Math.max(0, Math.round(Number(t?.rv) || 0)), bonus: Math.max(0, Math.round(Number(t?.bonus) || 0)) }))
    .filter(t => t.rv > 0)
    .sort((a, b) => a.rv - b.rv)
  return { min, tiers }
}

export interface HasilReward {
  n: number
  layak: boolean
  tier: RewardTier | null
  berikut: RewardTier | null
  kurang: number
  min: number
  /** Paid, display only (T-19: never written anywhere). */
  bonus: number
}

/**
 * One crew member's bonus from VERIFIED reviews — never claimed ones
 * (`:7614-7627`, F12). Highest passed tier, never summed; the minimum beats
 * the tier: passing a tier below `min` still pays nothing.
 */
export function rewardDari(sah: number, aturan: AturanReward): HasilReward {
  const n = Math.max(0, Number(sah) || 0)
  const layak = n >= aturan.min
  let tier: RewardTier | null = null
  for (const t of aturan.tiers) {
    if (n >= t.rv) tier = t
  }
  const berikut = aturan.tiers.find(t => n < t.rv) || null
  return { n, layak, tier, berikut, kurang: berikut ? berikut.rv - n : 0, min: aturan.min, bonus: (layak && tier) ? tier.bonus : 0 }
}

/** The team target is the SUM of per-person targets — never a separate number (`:7808-7810`, F13). */
export const targetTim = (targets: Record<string, number> | undefined): number =>
  Object.values(targets || {}).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0)

export const targetUntuk = (targets: Record<string, number> | undefined, nama: string): number =>
  Math.max(0, Number(targets?.[String(nama || '').trim()]) || 0)

// ---------------------------------------------------------------- capaian

export interface BarisCapaian {
  nama: string
  minta: number
  klaim: number
  sah: number
  tolak: number
  fb: number
  target: number
  pct: number | null
  reward: HasilReward
}

/**
 * One row per CREW member — never per whoever happens to have a review. A
 * crew with zero output needs to be seen most (`:9389-9411`).
 */
export function rekapCapaian(input: {
  kru: string[]
  diminta: Pick<Review, 'askedBy' | 'host' | 'claimedBy' | 'by'>[]
  diklaim: Pick<Review, 'host' | 'claimedBy' | 'by'>[]
  sah: Pick<Review, 'host' | 'claimedBy' | 'by'>[]
  ditolak: Pick<Review, 'host' | 'claimedBy' | 'by'>[]
  feedback: { by: string }[]
  targets: Record<string, number> | undefined
  aturan: AturanReward
}): BarisCapaian[] {
  const peta = new Map<string, BarisCapaian>()
  const isi = (n: string) => {
    const k = String(n || '—').trim() || '—'
    let o = peta.get(k)
    if (!o) {
      o = { nama: k, minta: 0, klaim: 0, sah: 0, tolak: 0, fb: 0, target: 0, pct: null, reward: rewardDari(0, input.aturan) }
      peta.set(k, o)
    }
    return o
  }
  for (const n of input.kru) isi(n)
  for (const x of input.diminta) isi((x as { askedBy?: string }).askedBy || hostDari(x)).minta++
  for (const x of input.diklaim) isi(hostDari(x)).klaim++
  for (const x of input.sah) isi(hostDari(x)).sah++
  for (const x of input.ditolak) isi(hostDari(x)).tolak++
  for (const x of input.feedback) isi(x.by).fb++
  return [...peta.values()].map((o) => {
    o.target = targetUntuk(input.targets, o.nama)
    o.pct = o.target ? Math.min(100, Math.round(o.sah / o.target * 100)) : null
    o.reward = rewardDari(o.sah, input.aturan)
    return o
  }).sort((a, b) => b.sah - a.sah || b.minta - a.minta || a.nama.localeCompare(b.nama))
}

/**
 * Office and System Admins run the module, they are not scored (F17).
 * Two markers, and only these: "office" in the team, or the module level
 * "admin". Managers are NOT hidden (`:9306-9374`).
 */
export const keluarDariPapan = (divisi: string | null | undefined, tingkat: string | null | undefined): boolean => {
  if (divisiCocok(divisi, ['office'])) return true
  return String(tingkat || '') === 'admin'
}

// ---------------------------------------------------------------- feedback

/** The seven divisions, `other` needing `catOther` (`:8275-8283`). */
export const FB_CATS = [
  { id: 'bar', label: 'Bar' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'floor', label: 'Floor' },
  { id: 'kasir', label: 'Kasir' },
  { id: 'hygiene', label: 'Hygiene' },
  { id: 'system', label: 'System' },
  { id: 'other', label: 'Other' },
] as const

export type IdKategori = typeof FB_CATS[number]['id']

export function labelKategori(cat: string, catOther: string): string {
  if (cat === 'other' && catOther) return catOther
  return FB_CATS.find(c => c.id === cat)?.label ?? 'Other'
}

/** Guests eligible for an ask: really came, in range, with a callable number (`reviewTargetsInRange`). */
export function layakDiminta(
  reservasi: { id: string, date: string, time: string, status: string, phone: string }[],
  r: { from: string, to: string },
  sudahIds: Set<string>,
  normTelp: (p: string) => string,
): { belum: typeof reservasi, sudah: typeof reservasi, layak: typeof reservasi } {
  const layak = reservasi.filter(x =>
    dalamRentang(x.date, r) && x.status === 'Datang' && normTelp(x.phone || '').length >= 8)
  return {
    belum: layak.filter(x => !sudahIds.has(x.id)).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    sudah: layak.filter(x => sudahIds.has(x.id)),
    layak,
  }
}
