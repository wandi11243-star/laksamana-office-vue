// The Office menu, shared by the desktop sidebar and the phone bottom bar
// (DESIGN.md › Shell). Inside a module with its own chrome (utils/modul-shell.ts)
// it is that module's screens, grouped by `grup`; elsewhere Beranda and the
// modules the user holds. Each inner array is one group, led by a `label` item
// when the group has a heading. `pilih` runs when an item is chosen.
import type { NavigationMenuItem } from '@nuxt/ui'
import { isAdminOf } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'

export function useMenuNav(pilih: () => void = () => {}) {
  const me = useMe()
  const { grouped } = useModulNav()
  const { shell } = useModulShell()
  const route = useRoute()
  shell.value?.siapkan?.()
  const lencana = shell.value?.lencana?.()

  return computed<NavigationMenuItem[][]>(() => {
    const s = shell.value
    if (s) {
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
}
