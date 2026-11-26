// The Office menu, shared by the desktop sidebar and the phone bottom bar
// (DESIGN.md › Shell). Inside a module with its own chrome (utils/modul-shell.ts)
// it is that module's screens, grouped by `grup`; elsewhere Beranda and the
// modules the user holds. Each inner array is one group, led by a `label` item
// when the group has a heading. `pilih` runs when an item is chosen.
import type { NavigationMenuItem } from '@nuxt/ui'
import { isAdminOf } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'

/** Modules whose access rules have arrived, as `<user id>:<module key>`. Kept for
 *  the session, so a refetch or a remount never brings the placeholder back. */
const useMenuTerjawab = () => useState<Record<string, boolean>>('menu-terjawab', () => ({}))

/** False while the current module's menu may not be drawn yet: its access rules
 *  are still on the way. Screens outside a module chrome are always ready. */
export function useMenuSiap() {
  const me = useMe()
  const { key, shell } = useModulShell()
  const sudah = useMenuTerjawab()
  return computed(() => !shell.value || (!!me.value && !!sudah.value[`${me.value.id}:${key.value}`]))
}

export function useMenuNav(pilih: () => void = () => {}) {
  const me = useMe()
  const { grouped } = useModulNav()
  const { key, shell } = useModulShell()
  const route = useRoute()
  // The sidebar and bottom bar are keyed by module, so this runs once per module.
  // The key is captured here: the outgoing copy must not answer for the next one.
  const kunciModul = key.value
  if (shell.value) {
    const penanda = shell.value.siapkan?.()
    const sudah = useMenuTerjawab()
    watchEffect(() => {
      if (!me.value || (penanda && !penanda())) return
      const kunci = `${me.value.id}:${kunciModul}`
      if (!sudah.value[kunci]) sudah.value = { ...sudah.value, [kunci]: true }
    })
  }
  const siap = useMenuSiap()
  const lencana = shell.value?.lencana?.()

  const menu = computed<NavigationMenuItem[][]>(() => {
    const s = shell.value
    if (s) {
      if (!siap.value) return []
      const bisa = s.layar.filter(l => !l.boleh || (me.value && l.boleh(me.value)))
      const badge = (key: string) => {
        const n = lencana?.value[key] ?? 0
        return n > 0 ? { label: String(n), color: 'error' as const, variant: 'solid' as const, size: 'sm' as const } : undefined
      }
      const baris = (l: Layar): NavigationMenuItem => ({
        label: l.label,
        icon: l.icon,
        to: l.to,
        exact: true,
        badge: badge(l.key) ?? (l.badge
          ? { label: l.badge, color: 'neutral' as const, variant: 'soft' as const, size: 'sm' as const }
          : undefined),
        onSelect: pilih,
      })
      // A `kelompok` becomes one row that opens its first viewable screen and
      // stays lit on all of them. With a single viewable screen it is just that screen.
      const lipat = (items: Layar[]): NavigationMenuItem[] => {
        const selesai = new Set<string>()
        return items.flatMap((l) => {
          const nama = l.kelompok?.label
          if (!nama) return [baris(l)]
          if (selesai.has(nama)) return []
          selesai.add(nama)
          const isi = items.filter(x => x.kelompok?.label === nama)
          if (isi.length === 1) return [baris(l)]
          const n = isi.reduce((a, x) => a + (lencana?.value[x.key] ?? 0), 0)
          return [{
            ...baris(l),
            label: nama,
            icon: l.kelompok!.icon,
            active: isi.some(x => cocokRute(route.path, x.to)),
            badge: n > 0 ? { label: String(n), color: 'error' as const, variant: 'solid' as const, size: 'sm' as const } : undefined,
          }]
        })
      }
      const grup = groupLayar(bisa).map(({ grup, items }) => [
        ...(grup ? [{ label: grup, type: 'label' as const }] : []),
        ...lipat(items),
      ])
      return [...grup, ...(s.navEkstra?.() ?? [])]
    }
    return [
      [
        { label: 'Beranda', icon: 'i-lucide-house', to: '/', exact: true, onSelect: pilih },
        { label: 'Semua modul', icon: 'i-lucide-layout-grid', to: '/modul', onSelect: pilih },
        // Kelola Akses has no module key (superadmin-only page, app/pages/akses.vue),
        // so it cannot come from useModulNav — it is listed here instead. The same
        // menu feeds the sidebar and AppNavBawah, so both gain the entry.
        ...(isAdminOf(me.value, '*')
          ? [{ label: 'Kelola Akses', icon: 'i-lucide-key-round', to: '/akses', onSelect: pilih }]
          : []),
      ],
      ...grouped.value.map(g => [
        { label: g.group, type: 'label' as const },
        ...g.items.map(m => m.ready
          ? { label: m.label, icon: m.icon, to: m.to, onSelect: pilih }
          : { label: m.label, icon: m.icon, disabled: true, badge: 'Segera' }),
      ]),
    ]
  })
  return { menu, siap }
}
