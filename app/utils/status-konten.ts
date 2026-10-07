// Status pills of the Konten Panel — one source for every screen (DESIGN.md
// rule 5). The old client drew each status in its own hex (STATUS[].c,
// deploy/konten/index.html:1040-1045); here the colour carries the shared
// meaning instead: waiting = warning, in production = info, review = vip,
// done = success, cancelled = neutral, revision = error.
type Warna = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'vip' | 'gold'

const WARNA: Record<string, Warna> = {
  Idea: 'neutral',
  Research: 'neutral',
  Draft: 'neutral',
  Script: 'info',
  Design: 'info',
  Shooting: 'info',
  Editing: 'info',
  Revision: 'error',
  Approval: 'vip',
  Scheduled: 'gold',
  Posted: 'success',
  Cancelled: 'neutral',
}

const IKON: Record<string, string> = {
  Idea: 'i-lucide-lightbulb',
  Research: 'i-lucide-search',
  Draft: 'i-lucide-file-pen',
  Script: 'i-lucide-scroll-text',
  Design: 'i-lucide-palette',
  Shooting: 'i-lucide-camera',
  Editing: 'i-lucide-clapperboard',
  Revision: 'i-lucide-rotate-ccw',
  Approval: 'i-lucide-hourglass',
  Scheduled: 'i-lucide-calendar-clock',
  Posted: 'i-lucide-circle-check',
  Cancelled: 'i-lucide-x',
}

export const warnaStatusKonten = (s?: string): Warna => WARNA[s ?? ''] ?? 'neutral'
export const ikonStatusKonten = (s?: string) => IKON[s ?? ''] ?? 'i-lucide-circle'

/** Priority: urgent = error, high = warning, medium = info, low = neutral (old 🔴🟠🔵⚪, :1338). */
const PRIO: Record<string, Warna> = { urgent: 'error', high: 'warning', medium: 'info', low: 'neutral' }
export const warnaPrioKonten = (p?: string): Warna => PRIO[p ?? ''] ?? 'info'

/** Calendar event kinds (old PROD_TYPES colours + PUBLISH/VISIT, :1202-1212). */
const ACARA: Record<string, Warna> = { publish: 'success', shoot: 'info', design: 'vip', edit: 'warning', visit: 'gold' }
export const warnaAcaraKonten = (t: string): Warna => ACARA[t] ?? 'neutral'
const ACARA_IKON: Record<string, string> = {
  publish: 'i-lucide-send', shoot: 'i-lucide-video', design: 'i-lucide-palette', edit: 'i-lucide-clapperboard', visit: 'i-lucide-handshake',
}
export const ikonAcaraKonten = (t: string) => ACARA_IKON[t] ?? 'i-lucide-circle'
