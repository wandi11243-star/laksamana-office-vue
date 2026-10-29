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
  /** One live line on the module's Beranda card ("Dashboard tim"). Falls back to `desc`. */
  kartu?: Component
  /**
   * No old Office screen (homepage). The Help chapter guard does not demand a
   * guide for a module the old Office never documented.
   */
  greenfield?: boolean
  /**
   * Switched off: hidden from the launcher, sidebar, Beranda and Help, and its
   * pages answer 404. The code stays; delete the flag to bring the module back.
   */
  nonaktif?: boolean
}

// 'Lainnya' exists only to match the old launcher's GRUP list: the old Help
// card lived in group `lainnya` (deploy/index.html:1412), and U1 keeps the card
// where the crew expects it. It currently holds only Help Center.
export type ModulGroup = 'Operasional' | 'Tim & Kru' | 'Marketing & Event' | 'Bisnis & Target' | 'Lainnya'

export const MODUL: Modul[] = [
  // Off until the module is finished (Oct 2026).
  { key: 'absensi', label: 'Absensi', desc: 'Absen masuk & pulang', icon: 'i-lucide-clock', group: 'Tim & Kru', access: ['absensi'], nonaktif: true,
    widgets: [defineAsyncComponent(() => import('~/widgets/absensi/AbsenHariIni.vue'))] },
  { key: 'jadwal', label: 'Roster', desc: 'Jadwal shift & daily worker', icon: 'i-lucide-calendar-days', group: 'Tim & Kru', access: ['jadwal', 'dw'] },
  { key: 'akademi', label: 'Akademi', desc: 'Training kru', icon: 'i-lucide-graduation-cap', group: 'Tim & Kru', access: ['akademi'] },
  { key: 'hr', label: 'Staff Performance', desc: 'Human resource', icon: 'i-lucide-users', group: 'Tim & Kru', access: ['hr'] },
  { key: 'stock', label: 'Stock', desc: 'Ordering, purchasing & HPP', icon: 'i-lucide-package', group: 'Operasional', access: ['ordering', 'purchasing', 'tree', 'usage', 'hpp', 'breakloss'] },
  { key: 'reservasi', label: 'Reservasi', desc: 'Booking dan tamu', icon: 'i-lucide-coffee', group: 'Operasional', access: ['reservasi'],
    kartu: defineAsyncComponent(() => import('~/widgets/reservasi/KartuReservasi.vue')),
    widgets: [
      defineAsyncComponent(() => import('~/widgets/reservasi/ReservasiHariIni.vue')),
      defineAsyncComponent(() => import('~/widgets/reservasi/DpPerluVerifikasi.vue')),
    ] },
  { key: 'service_excellent', label: 'Service Excellent', desc: 'Review, feedback, reward', icon: 'i-lucide-star', group: 'Operasional', access: ['service_excellent'] },
  // Read-only board over Marketing, Event, Reservasi and BD. Built in for every
  // account since 27 Sep 2026 (laksamana-api OfficeAccess::builtinModules).
  { key: 'radar', label: 'Radar', desc: 'Pusat koordinasi', icon: 'i-lucide-radar', group: 'Operasional', access: ['radar'] },
  { key: 'cashier', label: 'Cashier', desc: 'Setoran & dana masuk', icon: 'i-lucide-banknote', group: 'Operasional', access: ['cashier'] },
  { key: 'pos', label: 'POS', desc: 'Kasir: order, bayar & struk', icon: 'i-lucide-shopping-cart', group: 'Operasional', access: ['pos'] },
  { key: 'konten', label: 'Konten', desc: 'Content operations', icon: 'i-lucide-pen-line', group: 'Marketing & Event', access: ['konten'] },
  { key: 'event', label: 'Event', desc: 'Event management', icon: 'i-lucide-mic-vocal', group: 'Marketing & Event', access: ['event'],
    kartu: defineAsyncComponent(() => import('~/widgets/event/KartuEvent.vue')) },
  // Greenfield (no old Office screen): the website's menu catalogue, news and
  // event switch. Three access keys so F&B can own the menu, marketing the news
  // and whoever runs Event the "tampil di website" switch.
  { key: 'homepage', label: 'Homepage', desc: 'Menu, berita & event website', icon: 'i-lucide-globe', group: 'Marketing & Event', access: ['menu', 'news', 'homepage'], greenfield: true },
  { key: 'marketing', label: 'Marketing', desc: 'CRM dan event', icon: 'i-lucide-megaphone', group: 'Marketing & Event', access: ['marketing'] },
  { key: 'finance', label: 'Finance', desc: 'Omset, kas kecil, brankas', icon: 'i-lucide-wallet', group: 'Bisnis & Target', access: ['kompas', 'finance', 'brankas'] },
  { key: 'bd', label: 'Task Management', desc: 'Task, project & purchasing', icon: 'i-lucide-briefcase', group: 'Bisnis & Target', access: ['bd'] },
  { key: 'hlife', label: 'Howandi Life OS', desc: 'Akses Nahkoda', icon: 'i-lucide-compass', group: 'Bisnis & Target', access: ['howandi_life'] },
  // Static: no backend, no data table, no endpoint (help.md). It carries its own
  // access key so its chapters can be filtered by the key of the module they
  // document (deploy/index.html:1394-1415).
  { key: 'help', label: 'Help Center', desc: 'Panduan pemakaian tiap modul', icon: 'i-lucide-book-open', group: 'Lainnya', access: ['help'] },
  // Investor Compass: read-only figures for investors, summed server-side from
  // the omset daily map (docs/migrasi/investor.md). The card must exist so the
  // key is registered in Kelola Akses (deploy/index.html:1186-1194).
  { key: 'investor', label: 'Investor Compass', desc: 'Ruang investor: omset, capaian target, dan laporan', icon: 'i-lucide-hand-coins', group: 'Bisnis & Target', access: ['investor'] },
  // Analytics reads the uploaded POS Sales Recapitulation in the browser and
  // answers top menus, hours, tables, talent, errors, promos and trends
  // (docs/migrasi/analytics.md). Its card must exist so the key registers in
  // Kelola Akses (laksamana-office/deploy/index.html:1204-1218).
  { key: 'analytics', label: 'Analytics', desc: 'Analisa Penjualan', icon: 'i-lucide-chart-line', group: 'Bisnis & Target', access: ['analytics'] },
]

/** Access keys whose module is switched off (`nonaktif`). */
export const KUNCI_NONAKTIF = new Set(MODUL.filter(m => m.nonaktif).flatMap(m => m.access))

export const MODUL_GROUPS: ModulGroup[] = ['Operasional', 'Tim & Kru', 'Marketing & Event', 'Bisnis & Target', 'Lainnya']
