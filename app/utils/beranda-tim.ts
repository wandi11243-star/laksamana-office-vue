/**
 * Which modules each team sees first on Beranda (the "Dashboard tim" cards).
 * The teams themselves come from the API: `me.tim` and `/jadwal/roster[].tim`,
 * matched from the Tim column by laksamana-api `App\Support\Tim`. This file
 * only holds the presentation: a team key -> MODUL keys, most important first.
 * It never grants access — the module still has to be in `me.modules`.
 */
export const MODUL_TIM: Record<string, string[]> = {
  kitchen: ['jadwal', 'stock', 'akademi'],
  bar: ['jadwal', 'stock', 'akademi'],
  floor: ['reservasi', 'service_excellent', 'jadwal'],
  cashier: ['cashier', 'finance', 'jadwal'],
  marketing: ['marketing', 'event', 'konten', 'radar'],
  konten: ['konten', 'homepage', 'marketing'],
  event: ['event', 'marketing', 'radar'],
  hr: ['hr', 'jadwal', 'akademi'],
  bd: ['bd', 'radar', 'stock'],
  finance: ['finance', 'cashier', 'investor'],
  manajemen: ['finance', 'radar', 'analytics', 'hr'],
}

/** The merged module order of several teams (profil gabungan), without duplicates. */
export const modulFokus = (tim: string[]): string[] => [...new Set(tim.flatMap(k => MODUL_TIM[k] ?? []))]

/** True when two people share at least one team. */
export const setim = (a: string[] | undefined, b: string[] | undefined): boolean =>
  !!a?.length && !!b?.some(k => a.includes(k))
