// The phone bottom bar (AppNavBawah): the sidebar menu folded into at most four
// slots plus "Lainnya". A headed group becomes one slot that opens a sheet of
// its screens; a screen outside any group becomes a slot of its own. Slots past
// the fourth, in menu order, move into the "Lainnya" sheet.
import type { NavigationMenuItem } from '@nuxt/ui'

export interface SlotNav {
  label: string
  icon: string
  /** Opens this screen directly. */
  to?: string
  /** Opens a sheet with these groups instead. */
  grup?: NavigationMenuItem[][]
  /** Red count over the icon: the sum of its screens' badges. */
  lencana: number
}

/** Slots shown before "Lainnya". Five in all fit 390px with readable labels. */
export const SLOT_NAV_BAWAH = 4

/** Lucide icon per group heading (utils/layar/*.ts `grup`, MODUL_GROUPS). Unknown: the group's first screen's icon. */
export const IKON_GRUP: Record<string, string> = {
  // Office launcher (MODUL_GROUPS)
  'Operasional': 'i-lucide-store',
  'Tim & Kru': 'i-lucide-users',
  'Marketing & Event': 'i-lucide-megaphone',
  'Bisnis & Target': 'i-lucide-target',
  'Lainnya': 'i-lucide-ellipsis',
  // Module screens
  'Agenda': 'i-lucide-calendar-days',
  'Analisa': 'i-lucide-chart-line',
  'Analitik': 'i-lucide-chart-column',
  'Belum ada di Help': 'i-lucide-circle-help',
  'Brankas': 'i-lucide-vault',
  'Break & Loss': 'i-lucide-trash-2',
  'Budaya': 'i-lucide-heart-handshake',
  'Cockpit': 'i-lucide-gauge',
  'Daily Worker': 'i-lucide-hard-hat',
  'Data': 'i-lucide-database',
  'Data & analisa': 'i-lucide-chart-column',
  'Event': 'i-lucide-mic-vocal',
  'Execution': 'i-lucide-list-checks',
  'Growth': 'i-lucide-sprout',
  'HPP & Resep': 'i-lucide-chef-hat',
  'HR': 'i-lucide-id-card',
  'Holding & wealth': 'i-lucide-landmark',
  'Investasi': 'i-lucide-hand-coins',
  'Jadwal': 'i-lucide-calendar-days',
  'Kas Kecil': 'i-lucide-wallet',
  'Kasir': 'i-lucide-banknote',
  'Keuangan': 'i-lucide-receipt',
  'Kinerja': 'i-lucide-target',
  'Kontrol': 'i-lucide-shield',
  'Kru': 'i-lucide-users',
  'Operasi': 'i-lucide-clipboard-list',
  'Ordering': 'i-lucide-shopping-cart',
  'Panel Omset': 'i-lucide-trending-up',
  'Pemakaian Bahan Baku': 'i-lucide-package-open',
  'Pengaturan': 'i-lucide-settings',
  'Pengembangan': 'i-lucide-graduation-cap',
  'Perusahaan': 'i-lucide-landmark',
  'Purchasing': 'i-lucide-shopping-bag',
  'Service Excellent': 'i-lucide-star',
  'Sistem': 'i-lucide-settings',
  'Talent': 'i-lucide-sparkles',
  'Tim': 'i-lucide-users',
  'Utama': 'i-lucide-house',
  'Workspace': 'i-lucide-layout-panel-left',
}

/** Fold the menu (useMenuNav) into the bar's slots; `sisa` is what "Lainnya" lists. */
export function slotNavBawah(menu: NavigationMenuItem[][], muat = SLOT_NAV_BAWAH): { slot: SlotNav[], sisa: NavigationMenuItem[][] } {
  const calon: { slot: SlotNav, asal: NavigationMenuItem[] }[] = []
  for (const g of menu) {
    const kepala = g[0]?.type === 'label' ? g[0] : null
    const items = kepala ? g.slice(1) : g
    if (kepala) {
      const label = String(kepala.label ?? '')
      calon.push({ slot: { label, icon: IKON_GRUP[label] ?? String(items[0]?.icon ?? 'i-lucide-folder'), grup: [items], lencana: jumlahLencana(items) }, asal: g })
      continue
    }
    for (const i of items) {
      if (typeof i.to !== 'string') continue
      calon.push({ slot: { label: String(i.label ?? ''), icon: String(i.icon ?? 'i-lucide-circle'), to: i.to, lencana: jumlahLencana([i]) }, asal: [i] })
    }
  }
  return { slot: calon.slice(0, muat).map(c => c.slot), sisa: calon.slice(muat).map(c => c.asal) }
}

/** Sum of the red count badges (useMenuNav `lencana`) on these items. */
export function jumlahLencana(items: NavigationMenuItem[]): number {
  return items.reduce((n, i) => {
    const b = i.badge
    return n + (b && typeof b === 'object' && b.color === 'error' ? Number(b.label) || 0 : 0)
  }, 0)
}

/** Is `path` this screen or one of its details? A module root ('/hr') matches only itself. */
export function cocokRute(path: string, to: string): boolean {
  const bersih = to.split('?')[0]!
  if (path === bersih) return true
  return bersih.split('/').length > 2 && path.startsWith(`${bersih}/`)
}
