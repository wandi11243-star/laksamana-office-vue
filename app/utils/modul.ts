import type { Component } from 'vue'

/**
 * The module menu: one entry per screen group, the same entries and access keys
 * as the old Office launcher (laksamana-office deploy/index.html, BRANCHES).
 * An entry shows when the user holds ANY of its `access` keys.
 * An entry whose page does not exist yet shows as "Segera" (see useModulNav).
 *
 * Adding a module: add its page under app/pages/<key>/, then (optionally) its
 * home-screen widgets under app/widgets/<key>/ and list them in `widgets`.
 */
export interface Modul {
  key: string
  label: string
  desc: string
  icon: string
  group: ModulGroup
  access: string[]
  /** Home-screen widgets, in order. Shown when the user holds the module. */
  widgets?: Component[]
}

export type ModulGroup = 'Operasional' | 'Tim & Kru' | 'Marketing & Event' | 'Bisnis & Target'

export const MODUL: Modul[] = [
  { key: 'absensi', label: 'Absensi', desc: 'Absen masuk & pulang', icon: 'i-lucide-clock', group: 'Tim & Kru', access: ['absensi'],
    widgets: [defineAsyncComponent(() => import('~/widgets/absensi/AbsenHariIni.vue'))] },
  { key: 'jadwal', label: 'Roster', desc: 'Jadwal shift & daily worker', icon: 'i-lucide-calendar-days', group: 'Tim & Kru', access: ['jadwal', 'dw'] },
  { key: 'akademi', label: 'Akademi', desc: 'Training kru', icon: 'i-lucide-graduation-cap', group: 'Tim & Kru', access: ['akademi'] },
  { key: 'hr', label: 'Staff Performance', desc: 'Human resource', icon: 'i-lucide-users', group: 'Tim & Kru', access: ['hr'] },
  { key: 'stock', label: 'Stock', desc: 'Ordering, purchasing & HPP', icon: 'i-lucide-package', group: 'Operasional', access: ['ordering', 'purchasing', 'tree', 'usage', 'hpp'] },
  { key: 'reservasi', label: 'Reservasi', desc: 'Booking dan tamu', icon: 'i-lucide-coffee', group: 'Operasional', access: ['reservasi'] },
  { key: 'cashier', label: 'Cashier', desc: 'Setoran & dana masuk', icon: 'i-lucide-banknote', group: 'Operasional', access: ['cashier'] },
  { key: 'konten', label: 'Konten', desc: 'Content operations', icon: 'i-lucide-pen-line', group: 'Marketing & Event', access: ['konten'] },
  { key: 'event', label: 'Event', desc: 'Event management', icon: 'i-lucide-mic-vocal', group: 'Marketing & Event', access: ['event'] },
  { key: 'marketing', label: 'Marketing', desc: 'CRM dan event', icon: 'i-lucide-megaphone', group: 'Marketing & Event', access: ['marketing'] },
  { key: 'finance', label: 'Finance', desc: 'Omset, kas kecil, brankas', icon: 'i-lucide-wallet', group: 'Bisnis & Target', access: ['kompas', 'finance', 'brankas'] },
  { key: 'bd', label: 'BD OS', desc: 'Bizdev, project & purchasing', icon: 'i-lucide-briefcase', group: 'Bisnis & Target', access: ['bd'] },
  { key: 'hlife', label: 'Howandi Life OS', desc: 'Akses Nahkoda', icon: 'i-lucide-compass', group: 'Bisnis & Target', access: ['howandi_life'] },
]

export const MODUL_GROUPS: ModulGroup[] = ['Operasional', 'Tim & Kru', 'Marketing & Event', 'Bisnis & Target']
