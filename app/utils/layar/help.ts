// The Help Center's chapter list, for the in-module sidebar. It is BUILT from
// the registry (app/utils/help/registry.ts), which in turn copies its keys from
// app/utils/modul.ts — so there is no third list of chapters to keep in sync.
// A chapter with no data file shows the "Segera" pill; a chapter the user may
// not read is dropped by `boleh`, the same rule the old sidebar used.
import { HELP_BAB, HELP_GRUP, babBoleh, type HelpBab } from '~/utils/help/registry'
import { ADA } from '~/utils/help/muat'

// Lucide, one per chapter (the old page used none); a safe default for any key
// that is added later.
const IKON: Record<string, string> = {
  portal: 'i-lucide-door-open',
  reservasi: 'i-lucide-calendar-check',
  cashier: 'i-lucide-banknote',
  service_excellent: 'i-lucide-star',
  radar: 'i-lucide-radar',
  ordering: 'i-lucide-clipboard-list',
  purchasing: 'i-lucide-shopping-cart',
  tree: 'i-lucide-git-fork',
  usage: 'i-lucide-package-minus',
  hpp: 'i-lucide-calculator',
  breakloss: 'i-lucide-package-x',
  jadwal: 'i-lucide-calendar-days',
  dw: 'i-lucide-user-check',
  absensi: 'i-lucide-clock',
  akademi: 'i-lucide-graduation-cap',
  hr: 'i-lucide-users',
  marketing: 'i-lucide-megaphone',
  event: 'i-lucide-mic-vocal',
  konten: 'i-lucide-pen-line',
  kompas: 'i-lucide-chart-line',
  finance: 'i-lucide-wallet',
  brankas: 'i-lucide-vault',
  analytics: 'i-lucide-chart-column',
  bd: 'i-lucide-briefcase',
  investor: 'i-lucide-trending-up',
  howandi_life: 'i-lucide-compass',
}

function layarBab(bab: HelpBab): Layar {
  return {
    key: bab.key,
    label: bab.label,
    desc: bab.ringkas,
    icon: IKON[bab.key] ?? 'i-lucide-book-open',
    to: `/help/${bab.key}`,
    grup: HELP_GRUP.find(g => g.key === bab.grup)?.label,
    badge: ADA.has(bab.key) ? undefined : 'Segera',
    boleh: me => babBoleh(bab, me.modules),
  }
}

export const LAYAR_HELP: Layar[] = HELP_BAB.map(layarBab)
