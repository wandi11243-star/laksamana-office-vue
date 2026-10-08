// The status pills of the Event panel, as the old Office drew them everywhere
// (`statusBadge :2200`): one colour and one icon per status, the word always
// beside them. One source for every screen (DESIGN.md rule 5).
import type { WarnaStatus as WarnaDasar } from '~/utils/status-reservasi'

/** Event tones: the shared set plus vip (Upcoming, best-seller). */
export type WarnaStatusEvent = WarnaDasar | 'vip'

/** The five pipeline stages. */
export const STATUS_WARNA_EVENT: Record<string, WarnaStatusEvent> = {
  'Planning': 'neutral',
  'Prospect': 'info',
  'Approval': 'warning',
  'Upcoming': 'vip',
  'Event Done': 'success',
  'Draft': 'neutral',
  'Cancelled': 'error',
  'Finished': 'success',
}

export const STATUS_IKON_EVENT: Record<string, string> = {
  'Planning': 'i-lucide-lightbulb',
  'Prospect': 'i-lucide-telescope',
  'Approval': 'i-lucide-hourglass',
  'Upcoming': 'i-lucide-party-popper',
  'Event Done': 'i-lucide-check-check',
  'Draft': 'i-lucide-pencil',
  'Cancelled': 'i-lucide-x',
  'Finished': 'i-lucide-flag',
}

/** Submission state of a plan. */
export const PENGAJUAN_WARNA: Record<string, WarnaStatusEvent> = {
  'Belum diajukan': 'neutral',
  'Menunggu': 'warning',
  'Disetujui': 'success',
  'Ditolak': 'error',
}

export const PENGAJUAN_IKON: Record<string, string> = {
  'Belum diajukan': 'i-lucide-pencil',
  'Menunggu': 'i-lucide-hourglass',
  'Disetujui': 'i-lucide-check',
  'Ditolak': 'i-lucide-x',
}

/** Talent & contract status. */
export const TALENT_WARNA: Record<string, WarnaStatusEvent> = {
  Active: 'success',
  Inactive: 'neutral',
}

export const TALENT_IKON: Record<string, string> = {
  Active: 'i-lucide-check',
  Inactive: 'i-lucide-pause',
}

/** Schedule status. */
export const JADWAL_WARNA: Record<string, WarnaStatusEvent> = {
  Scheduled: 'info',
  Done: 'success',
  Cancelled: 'neutral',
}

export const JADWAL_IKON: Record<string, string> = {
  Scheduled: 'i-lucide-clock',
  Done: 'i-lucide-check-check',
  Cancelled: 'i-lucide-x',
}

/** Payment / order / refund status. */
export const BAYAR_WARNA: Record<string, WarnaStatusEvent> = {
  Paid: 'success',
  Pending: 'warning',
  Refunded: 'error',
  Approved: 'success',
  Rejected: 'error',
  Waiting: 'warning',
}

export const BAYAR_IKON: Record<string, string> = {
  Paid: 'i-lucide-check',
  Pending: 'i-lucide-hourglass',
  Refunded: 'i-lucide-undo-2',
  Approved: 'i-lucide-check',
  Rejected: 'i-lucide-x',
  Waiting: 'i-lucide-hourglass',
}

/** Check-in result. */
export const CHECKIN_WARNA: Record<string, WarnaStatusEvent> = {
  'Valid': 'success',
  'Belum datang': 'warning',
}

export const CHECKIN_IKON: Record<string, string> = {
  'Valid': 'i-lucide-check',
  'Belum datang': 'i-lucide-hourglass',
}

/** Talent category → tone (the old `TAL_WARNA :2441` hexes become tones; no
 *  hex in components, DESIGN.md rule 7). */
const NADA_KATEGORI: WarnaStatusEvent[] = ['info', 'vip', 'success', 'warning', 'error', 'neutral']
export function nadaKategori(category: string, cats: string[]): WarnaStatusEvent {
  const i = cats.indexOf(category)
  return NADA_KATEGORI[(i < 0 ? cats.length : i) % NADA_KATEGORI.length]!
}
