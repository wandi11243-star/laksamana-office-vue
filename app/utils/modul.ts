import type { Component } from 'vue'

/**
 * The module menu: one entry per screen group, the same entries and access keys
 * as the old Office launcher (laksamana-office deploy/index.html, BRANCHES).
 * An entry shows when the user holds ANY of its `access` keys.
 * An entry whose page does not exist yet shows as "Segera" (see useModulNav).
 *
 * Two entries, two keys, even though they share one Backend: `reservasi` and
 * `service_excellent` are separate cards in the old launcher too
 * (laksamana-office/deploy/index.html:1133-1141).
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
  /**
   * No old Office screen (homepage). The Help chapter guard does not demand a
   * guide for a module the old Office never documented.
   */
  greenfield?: boolean
}

// 'Lainnya' exists only to match the old launcher's GRUP list: the old Help
// card lived in group `lainnya` (deploy/index.html:1412), and U1 keeps the card
// where the crew expects it. It currently holds only Help Center.
export type ModulGroup = 'Operasional' | 'Tim & Kru' | 'Marketing & Event' | 'Bisnis & Target' | 'Lainnya'

export const MODUL: Modul[] = [
  { key: 'absensi', label: 'Absensi', desc: 'Absen masuk & pulang', icon: 'i-lucide-clock', group: 'Tim & Kru', access: ['absensi'],
    widgets: [defineAsyncComponent(() => import('~/widgets/absensi/AbsenHariIni.vue'))] },
  { key: 'jadwal', label: 'Roster', desc: 'Jadwal shift & daily worker', icon: 'i-lucide-calendar-days', group: 'Tim & Kru', access: ['jadwal', 'dw'] },
  { key: 'akademi', label: 'Akademi', desc: 'Training kru', icon: 'i-lucide-graduation-cap', group: 'Tim & Kru', access: ['akademi'] },
  { key: 'hr', label: 'Staff Performance', desc: 'Human resource', icon: 'i-lucide-users', group: 'Tim & Kru', access: ['hr'] },
  { key: 'stock', label: 'Stock', desc: 'Ordering, purchasing & HPP', icon: 'i-lucide-package', group: 'Operasional', access: ['ordering', 'purchasing', 'tree', 'usage', 'hpp'] },
  { key: 'reservasi', label: 'Reservasi', desc: 'Booking dan tamu', icon: 'i-lucide-coffee', group: 'Operasional', access: ['reservasi'],
    widgets: [
      defineAsyncComponent(() => import('~/widgets/reservasi/ReservasiHariIni.vue')),
      defineAsyncComponent(() => import('~/widgets/reservasi/DpPerluVerifikasi.vue')),
    ] },
  { key: 'service_excellent', label: 'Service Excellent', desc: 'Review, feedback, reward', icon: 'i-lucide-star', group: 'Operasional', access: ['service_excellent'] },
  // Read-only board over Marketing, Event, Reservasi and BD. Built in for every
  // account since 27 Sep 2026 (laksamana-api OfficeAccess::builtinModules).
  { key: 'radar', label: 'Radar', desc: 'Pusat koordinasi', icon: 'i-lucide-radar', group: 'Operasional', access: ['radar'] },
  { key: 'cashier', label: 'Cashier', desc: 'Setoran & dana masuk', icon: 'i-lucide-banknote', group: 'Operasional', access: ['cashier'] },
  { key: 'konten', label: 'Konten', desc: 'Content operations', icon: 'i-lucide-pen-line', group: 'Marketing & Event', access: ['konten'] },
  { key: 'event', label: 'Event', desc: 'Event management', icon: 'i-lucide-mic-vocal', group: 'Marketing & Event', access: ['event'] },
  // Greenfield (no old Office screen): the website's menu catalogue, news and
  // event switch. Three access keys so F&B can own the menu, marketing the news
  // and whoever runs Event the "tampil di website" switch.
  { key: 'homepage', label: 'Homepage', desc: 'Menu, berita & event website', icon: 'i-lucide-globe', group: 'Marketing & Event', access: ['menu', 'news', 'homepage'], greenfield: true },
  { key: 'marketing', label: 'Marketing', desc: 'CRM dan event', icon: 'i-lucide-megaphone', group: 'Marketing & Event', access: ['marketing'] },
  { key: 'finance', label: 'Finance', desc: 'Omset, kas kecil, brankas', icon: 'i-lucide-wallet', group: 'Bisnis & Target', access: ['kompas', 'finance', 'brankas'] },
  { key: 'bd', label: 'BD OS', desc: 'Bizdev, project & purchasing', icon: 'i-lucide-briefcase', group: 'Bisnis & Target', access: ['bd'] },
  { key: 'hlife', label: 'Howandi Life OS', desc: 'Akses Nahkoda', icon: 'i-lucide-compass', group: 'Bisnis & Target', access: ['howandi_life'] },
  // Static: no backend, no data table, no endpoint (help.md). It carries its own
  // access key so its chapters can be filtered by the key of the module they
  // document (deploy/index.html:1394-1415).
  { key: 'help', label: 'Help Center', desc: 'Panduan pemakaian tiap modul', icon: 'i-lucide-book-open', group: 'Lainnya', access: ['help'] },
]

export const MODUL_GROUPS: ModulGroup[] = ['Operasional', 'Tim & Kru', 'Marketing & Event', 'Bisnis & Target', 'Lainnya']
