// Promo display rules shared by BD (owner of the promo data) and Radar (reads
// it). Pure functions, no Vue, no API. One source on purpose: the old Office had
// two drifting copies (deploy/bd/index.html:2332-2378 and
// deploy/radar/index.html:2408-2432), which is the "twin file" pattern
// PLAN.md §4 forbids.
//
// Status: Radar gets it from the server (RadarRules::promoStatus, running and
// upcoming only); BD computes it here with the same rule.

export type PromoStatus = 'running' | 'upcoming' | 'paused' | 'ended'
export interface PromoMeta { l: string, icon: string }
/** The fields the shared rules read; BdPromo and RadarPromo both fit. */
export interface PromoTanggal { paused?: boolean, mulai?: string, selesai?: string }

/** `PROMO_TIPE` — an unknown type still shows its raw key. */
export const PROMO_TIPE: Record<string, PromoMeta> = {
  partner_kartu: { l: 'Kartu / Komunitas', icon: 'i-lucide-credit-card' },
  partner_sekolah: { l: 'Sekolah / Organisasi', icon: 'i-lucide-graduation-cap' },
  tiktok: { l: 'TikTok / Voucher', icon: 'i-lucide-music' },
  in_house: { l: 'Promo Laksamana', icon: 'i-lucide-utensils' },
  happy_hour: { l: 'Happy Hour', icon: 'i-lucide-clock' },
  event: { l: 'Event / Musiman', icon: 'i-lucide-party-popper' },
}
export const promoTipe = (k?: string): PromoMeta => PROMO_TIPE[k || ''] || { l: String(k || 'Lainnya'), icon: 'i-lucide-tag' }

/** `PROMO_KAT` — what the guest gets, separate from the type (where it comes from). */
export const PROMO_KAT: Record<string, PromoMeta> = {
  diskon: { l: 'Diskon', icon: 'i-lucide-tag' },
  free_item: { l: 'Free Item', icon: 'i-lucide-gift' },
}
export const promoKat = (k?: string): PromoMeta | null => (k ? PROMO_KAT[k] || { l: String(k), icon: 'i-lucide-tag' } : null)

export const PROMO_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
export const PROMO_HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** `PROMO_ST` — status label + tone. */
export const PROMO_ST: Record<PromoStatus, { l: string, tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  running: { l: 'Berlangsung', tone: 'success' },
  upcoming: { l: 'Akan Datang', tone: 'info' },
  ended: { l: 'Selesai', tone: 'neutral' },
  paused: { l: 'Dijeda', tone: 'warning' },
}
/** `PROMO_URUT` — running, upcoming, paused, ended; BD and Radar never order the same data differently. */
export const PROMO_URUT: Record<string, number> = { running: 0, upcoming: 1, paused: 2, ended: 3 }

const tglLokal = (s?: string): Date | null => {
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  return Number.isNaN(+d) ? null : d
}
const hariIniLokal = () => {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

/** `promoHariArr` — the `hari` array as 0–6 indices, legacy free text ignored. */
export function promoHariArr(h: unknown): number[] {
  return Array.isArray(h) ? h.map(Number).filter(n => n >= 0 && n <= 6) : []
}
/**
 * `promoHariTeks` — "" when no day is set; callers that want a default write
 * `|| 'Setiap hari'` (Radar and the BD detail do, the BD form does not).
 * Legacy free text from the first version is drawn as is, never guessed.
 */
export function promoHariTeks(h: unknown): string {
  if (Array.isArray(h)) {
    const a = promoHariArr(h)
    if (!a.length) return ''
    if (a.length === 7) return 'Setiap hari'
    return [...a].sort((x, y) => x - y).map(i => PROMO_HARI[i]).join(', ')
  }
  return String(h || '')
}

/** `promoStatus` — computed from the dates, never stored (a stored status goes stale at midnight). */
export function promoStatus(p: PromoTanggal): PromoStatus {
  if (p.paused) return 'paused'
  const t = hariIniLokal()
  const a = tglLokal(p.mulai)
  const b = tglLokal(p.selesai)
  if (a && t < a) return 'upcoming'
  if (b && t > b) return 'ended'
  return 'running'
}

/**
 * `promoSisa` — one wording for both boards. The old copies differed: Radar said
 * "Mulai besok" for one day away, BD "Mulai dalam 1 hari"; BD also labels ended
 * and paused promos, which Radar never receives. Interim choice pending the
 * owner (docs/migrasi/_pertanyaan.md K-12): Radar's "Mulai besok" plus BD's
 * ended/paused labels.
 */
export function promoSisa(p: PromoTanggal & { status?: PromoStatus }): string {
  const st = p.status || promoStatus(p)
  const t = hariIniLokal()
  const a = tglLokal(p.mulai)
  const b = tglLokal(p.selesai)
  const H = 86400000
  if (st === 'upcoming' && a) {
    const n = Math.ceil((+a - +t) / H)
    return n <= 1 ? 'Mulai besok' : `Mulai dalam ${n} hari`
  }
  if (st === 'running' && b) {
    const n = Math.ceil((+b - +t) / H)
    return n <= 0 ? 'Berakhir hari ini' : `Sisa ${n} hari`
  }
  if (st === 'ended') return 'Sudah berakhir'
  if (st === 'paused') return 'Sementara dijeda'
  return ''
}
