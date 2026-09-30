// The chrome of a module, as the old Office drew it (DESIGN.md › Shell): inside a
// module the sidebar becomes that module's own screen menu, and the top bar
// carries the module's search, its gold "+" and its bell.
//
//   laksamana-office deploy/reservasi/index.html:851-872  sidebar + appbar
//   laksamana-office deploy/reservasi/index.html:3819     bell dot = follow-ups today
//   laksamana-office deploy/reservasi/index.html:3830     bell opens today's map
//
// A module without an entry here keeps the Office sidebar (Beranda + modules).
import type { ComputedRef } from 'vue'
import type { Me } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'

export interface ModulShell {
  /** Small gold capitals under "Laksamana Muda" in the sidebar. */
  subjudul: string
  layar: Layar[]
  /** Top-bar search: submits to `to?q=<text>`. */
  cari?: { placeholder: string, to: string }
  /** The gold "+" in the top bar: the module's most frequent new thing. */
  tambah?: { label: string, to: string }
  /** The bell in the top bar. */
  lonceng?: { label: string, to: string }
  /** The line under the user's name: their role inside this module. */
  peran?: (me: Me | null) => string
  /** Counts shown as red badges on menu items, by screen key; `lonceng` lights the bell dot. */
  lencana?: () => ComputedRef<Record<string, number>>
  /** Loads what the menu needs before it is drawn (the in-module role matrix). */
  siapkan?: () => void
}

export const MODUL_SHELL: Record<string, ModulShell> = {
  reservasi: {
    subjudul: 'Reservasi',
    layar: LAYAR_RESERVASI,
    cari: { placeholder: 'Cari nama tamu, no. HP…', to: '/reservasi/dashboard' },
    tambah: { label: 'Reservasi baru', to: '/reservasi/input' },
    lonceng: { label: 'Kedatangan hari ini', to: '/reservasi/dashboard?tab=denah' },
    peran: me => ROLE_LABEL_RESERVASI[roleReservasi(me)],
    lencana: () => useLencanaReservasi(),
    siapkan: () => muatPeranReservasi(),
  },
  homepage: {
    subjudul: 'Homepage',
    layar: LAYAR_HOMEPAGE,
    peran: me => [me?.modules.includes('menu') && 'Menu', me?.modules.includes('news') && 'Berita', me?.modules.includes('homepage') && 'Event & promo'].filter(Boolean).join(' · '),
  },
  radar: {
    subjudul: 'Pusat Koordinasi',
    layar: LAYAR_RADAR,
    // The old footer: the Tim column, or "Kru" (deploy/radar render()).
    peran: me => me?.keterangan || 'Kru',
  },
  service_excellent: {
    subjudul: 'Service Excellent',
    layar: LAYAR_SERVICE_EXCELLENT,
    tambah: { label: 'Catat review', to: '/service_excellent/review?catat=1' },
    peran: me => LABEL_TINGKAT_SE[tingkatSe(me)],
    siapkan: () => muatPeranSE(),
  },
}

/** The module the current route belongs to, when it has its own chrome. */
export function useModulShell() {
  const route = useRoute()
  const key = computed(() => route.path.split('/')[1] ?? '')
  const modul = computed(() => MODUL.find(m => m.key === key.value) ?? null)
  const shell = computed(() => MODUL_SHELL[key.value] ?? null)
  return { key, modul, shell }
}
