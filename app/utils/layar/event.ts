// The screens of the Event (EMS) panel, with the in-module role matrix.
//
// Four roles of its own (`EMS_PERAN :4507`), resolved from the Office roster:
// the Tim column of `useModulMembers('event')` maps to a role, an Office admin
// of `event` is always `manajemen`, unknown → `event` (`:4611-4614`).
//
// K-08: the `EMS_HALAMAN × EMS_PERAN` matrix is NEVER persisted — the old
// backend only kept `entertainmentRules`/`role`/`layoutTemplates`
// (`event-mysql/lib_event_mysql.php:430-433`) and v1 has no endpoint for it
// either. So this file carries the default (`emsPermBawaan :4531`), the matrix
// lives in a `useState` that resets on reload, exactly like the old client.
// `setIzin`/`resetIzin` only touch that in-memory copy.
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'

export type PeranEvent = 'manajemen' | 'event' | 'kasir' | 'lihat'

export const PERAN_EVENT: PeranEvent[] = ['manajemen', 'event', 'kasir', 'lihat']

export const PERAN_LABEL_EVENT: Record<PeranEvent, string> = {
  manajemen: 'Manajemen',
  event: 'Tim Event',
  kasir: 'Kasir / Ticketing',
  lihat: 'Hanya Lihat',
}

export const EMS_HALAMAN_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  calendar: 'Event Calendar',
  talents: 'Talent Management',
  schedule: 'Talent Schedule',
  fee: 'Fee & Pembayaran',
  planning: 'Perencanaan Event',
  events: 'Event Management',
  ticketing: 'Ticketing',
  checkin: 'Check-In',
  ideas: 'Event Idea Bank',
  history: 'Event History',
  akses: 'Hak Akses',
  approval: 'Approval Flow',
  pipeline: 'Event Pipeline',
  performa: 'Event Performance',
  report: 'Report & Analytics',
  perfomset: 'Performa Omset & Bonus',
}

export type MatriksEvent = Record<string, Record<PeranEvent, 0 | 1 | 2>>

/** `emsPermBawaan()` (`:4531-4541`): usable without setup; cashiers only touch
 *  sales & the door; talent fees are not public consumption. */
export function permBawaanEvent(): MatriksEvent {
  const p: MatriksEvent = {}
  for (const h of Object.keys(EMS_HALAMAN_LABEL)) {
    p[h] = { manajemen: 2, event: 2, kasir: 1, lihat: 1 }
  }
  p.planning!.kasir = 0
  p.fee!.kasir = 0
  p.fee!.lihat = 0
  p.akses = { manajemen: 2, event: 0, kasir: 0, lihat: 0 }
  p.ticketing!.kasir = 2
  p.checkin!.kasir = 2
  return p
}

/** The in-memory matrix (K-08). Resets on reload, like the old client. */
export const useMatriksEvent = () => useState<MatriksEvent>('event-matriks', permBawaanEvent)

/** Reset to default (`resetIzin :6073`). In-memory only. */
export function resetMatriksEvent() {
  useMatriksEvent().value = permBawaanEvent()
}

/** Write one cell (`setIzin :6061`). In-memory only; needs `bisaUbah('akses')`. */
export function setIzinEvent(halaman: string, peran: PeranEvent, tingkat: 0 | 1 | 2) {
  useMatriksEvent().value[halaman]![peran] = tingkat
}

/** This person's role in this panel (`:4611-4614` + admin override). */
export function peranEvent(me: Me | null): PeranEvent {
  if (!me) return 'lihat'
  if (isAdminOf(me, 'event')) return 'manajemen'
  const tim = (me.keterangan || '').toLowerCase()
  if (/manajemen|owner|howandi|direk/.test(tim)) return 'manajemen'
  if (/kasir|ticketing|tiket/.test(tim)) return 'kasir'
  return 'event'
}

/** `bisaLihat(h)` — level ≥ 1. */
export const bolehBukaEvent = (halaman: string, peran: PeranEvent) =>
  (useMatriksEvent().value[halaman]?.[peran] ?? 1) >= 1

/** `bisaUbah(h)` — level ≥ 2 (`:4677`). */
export const bolehUbahEvent = (halaman: string, peran: PeranEvent) =>
  (useMatriksEvent().value[halaman]?.[peran] ?? 1) >= 2

/** `bisaSetujui()` — only `manajemen` decides (`:4680`). */
export const bolehSetujui = (peran: PeranEvent) => peran === 'manajemen'

/** The `boleh` of a screen, for `Layar`. */
export const bolehLayarEvent = (key: string) => (me: Me) => bolehBukaEvent(key, peranEvent(me))

/** The screens of the panel, in the order of the old sidebar (`NAV :2006-2046`).
 *  `ideas` and `history` keep their routes but are NOT in the menu — they live
 *  as tabs of Perencanaan (`:2036,5852`). */
export const LAYAR_EVENT: Layar[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Ringkasan operasional event.', icon: 'i-lucide-layout-dashboard', to: '/event/dashboard', grup: 'Utama', boleh: bolehLayarEvent('dashboard') },
  { key: 'calendar', label: 'Event calendar', desc: 'Kalender terpadu multi-sumber.', icon: 'i-lucide-calendar-days', to: '/event/calendar', grup: 'Utama', boleh: bolehLayarEvent('calendar') },
  { key: 'talents', label: 'Talent management', desc: 'Kelola profil, jadwal & fee talent.', icon: 'i-lucide-users', to: '/event/talents', grup: 'Talent', boleh: bolehLayarEvent('talents') },
  { key: 'schedule', label: 'Talent schedule', desc: 'Kalender jadwal, anti double-booking.', icon: 'i-lucide-clock', to: '/event/schedule', grup: 'Talent', boleh: bolehLayarEvent('schedule') },
  { key: 'fee', label: 'Fee & pembayaran', desc: 'Rekap otomatis show done × fee.', icon: 'i-lucide-banknote', to: '/event/fee', grup: 'Talent', boleh: bolehLayarEvent('fee') },
  { key: 'pipeline', label: 'Event pipeline', desc: 'Geser kartu antar tahap.', icon: 'i-lucide-kanban-square', to: '/event/pipeline', grup: 'Event', boleh: bolehLayarEvent('pipeline') },
  { key: 'planning', label: 'Perencanaan event', desc: 'Rencana yang belum disetujui manajemen.', icon: 'i-lucide-lightbulb', to: '/event/planning', grup: 'Event', boleh: bolehLayarEvent('planning') },
  { key: 'events', label: 'Event management', desc: 'Event yang sudah disetujui manajemen.', icon: 'i-lucide-party-popper', to: '/event/events', grup: 'Event', boleh: bolehLayarEvent('events') },
  { key: 'ticketing', label: 'Ticketing', desc: 'Event ber-tiket yang sudah disetujui.', icon: 'i-lucide-ticket', to: '/event/ticketing', grup: 'Event', boleh: bolehLayarEvent('ticketing') },
  { key: 'checkin', label: 'Check-in', desc: 'Scan QR, kursi terisi langsung.', icon: 'i-lucide-scan-line', to: '/event/checkin', grup: 'Event', boleh: bolehLayarEvent('checkin') },
  { key: 'approval', label: 'Approval flow', desc: 'Meja putusan manajemen.', icon: 'i-lucide-check-check', to: '/event/approval', grup: 'Event', boleh: bolehLayarEvent('approval') },
  { key: 'performa', label: 'Event performance', desc: 'Ukur hasil event & talent secara objektif.', icon: 'i-lucide-chart-column', to: '/event/performa', grup: 'Analitik', boleh: bolehLayarEvent('performa') },
  { key: 'perfomset', label: 'Performa omset & bonus', desc: 'Omset yang diakui tiap PIC event berikut skema bonusnya.', icon: 'i-lucide-award', to: '/event/perfomset', grup: 'Analitik', boleh: bolehLayarEvent('perfomset') },
  { key: 'report', label: 'Report & analytics', desc: 'Laporan omzet, tiket & kehadiran.', icon: 'i-lucide-file-chart-column', to: '/event/report', grup: 'Analitik', boleh: bolehLayarEvent('report') },
  { key: 'akses', label: 'Hak akses', desc: 'Siapa berperan apa, dan peran itu boleh membuka apa.', icon: 'i-lucide-shield', to: '/event/akses', grup: 'Pengaturan', boleh: bolehLayarEvent('akses') },
]
