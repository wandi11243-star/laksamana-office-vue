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
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Me } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'
import { HELP_BAB } from '~/utils/help/registry'

export interface ModulShell {
  /** Small gold capitals under "Laksamana Muda" in the sidebar. */
  subjudul: string
  layar: Layar[]
  /** Top-bar search: submits to `to?q=<text>`. `realtime` updates while typing (Help). */
  cari?: { placeholder: string, to: string, realtime?: boolean }
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
  /** Extra sidebar groups after the module's screens (Help: held keys with no chapter). */
  navEkstra?: () => NavigationMenuItem[][]
  /** Replaces the logout power button in the sidebar foot (Help: "Keluar ke Office"). */
  kaki?: { label: string, to: string, icon?: string }
}

export const MODUL_SHELL: Record<string, ModulShell> = {
  akademi: {
    subjudul: 'Akademi',
    layar: LAYAR_AKADEMI,
    // The old footer showed the crew member's Office title; "Kru" while the row
    // is not in the local crew list yet (roster sync is admin-only, see gap G-18).
    peran: me => kruSaya(me)?.title || 'Kru',
    siapkan: () => muatAkademiKru(),
  },
  absensi: {
    subjudul: 'Absensi',
    layar: LAYAR_ABSENSI,
    peran: () => (useAbsensiSiapa().value?.hr ? 'HR Absensi' : 'Kru'),
    lencana: () => useLencanaAbsensi(),
    siapkan: () => muatAbsensiSiapa(),
  },
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
  help: {
    subjudul: 'Help Center',
    layar: LAYAR_HELP,
    // The old page searched in the sidebar as you typed; 180 ms debounce, live.
    cari: { placeholder: 'Cari panduan…', to: '/help', realtime: true },
    // Held keys with no chapter stay visible as "Belum ada di Help" (old
    // gambarNav), rather than disappearing as if the module did not exist.
    navEkstra: () => {
      const me = useMe()
      const mods = me.value?.modules ?? []
      if (mods.includes('*')) return []
      const dikenal = new Set(HELP_BAB.filter(b => b.izin).map(b => b.izin!))
      const asing = mods.filter(k => k !== 'help' && k !== '*' && !dikenal.has(k))
      if (!asing.length) return []
      return [[
        { label: 'Belum ada di Help', type: 'label' as const },
        ...asing.map((k: string) => ({ label: k, disabled: true })),
      ]]
    },
    // Old Help's power button: back to the Office, WITHOUT clearing the session
    // (deploy/help/index.html:688-713). Same meaning as the power button in the
    // other modules, so it must not end the session here either.
    kaki: { label: 'Keluar ke Office', to: '/', icon: 'i-lucide-power' },
  },
  hlife: {
    subjudul: 'Howandi Life OS',
    layar: LAYAR_HLIFE,
  },
  bd: {
    subjudul: 'BD OS',
    layar: LAYAR_BD,
  },

  // Slots for modules built in parallel (docs/migrasi/TIM-A.md §4): each module
  // adds its entry directly under its own marker, so branches never touch the
  // same lines. Keep the blank lines between markers.

  // ── jadwal ──
  jadwal: {
    subjudul: 'Jadwal Shift',
    layar: LAYAR_JADWAL,
    tambah: { label: 'Ajukan off / izin', to: '/jadwal/saya?ajukan=1' },
    peran: me => peranJadwalLabel(me),
    lencana: () => useLencanaJadwal(),
    siapkan: () => muatPeranJadwal(),
  },
  dw: {
    subjudul: 'Daily Worker',
    layar: LAYAR_DW,
    tambah: { label: 'Minta DW', to: '/dw/permintaan?minta=1' },
    peran: me => peranDwLabel(me),
    lencana: () => useLencanaDw(),
    siapkan: () => muatPeranDw(),
  },

  // ── hr ──
  hr: {
    subjudul: 'Staff Performance',
    layar: LAYAR_HR,
    peran: me => peranHrLabel(me),
    siapkan: () => muatPeranHr(),
  },

  // ── cashier ──
  cashier: {
    subjudul: 'Cashier',
    layar: LAYAR_CASHIER,
    tambah: { label: 'Report Daily', to: '/cashier/report' },
    peran: me => (isAdminOf(me, 'cashier') ? 'Admin modul' : 'Kasir'),
  },

  // ── finance ──

  // ── konten ──

  // ── marketing ──

  // ── stock ──

  // ── event ──

  // ── analytics ──

  // ── investor ──
}

/** The module the current route belongs to, when it has its own chrome. */
export function useModulShell() {
  const route = useRoute()
  const key = computed(() => route.path.split('/')[1] ?? '')
  const modul = computed(() => MODUL.find(m => m.key === key.value) ?? null)
  const shell = computed(() => MODUL_SHELL[key.value] ?? null)
  return { key, modul, shell }
}
