// The Office menu, shared by the desktop sidebar and the phone bottom bar
// (DESIGN.md › Shell). Inside a module with its own chrome (utils/modul-shell.ts)
// it is that module's screens, grouped by `grup`; elsewhere Beranda and the
// modules the user holds. Each inner array is one group, led by a `label` item
// when the group has a heading. `pilih` runs when an item is chosen.
import type { NavigationMenuItem } from '@nuxt/ui'

export function useMenuNav(pilih: () => void = () => {}) {
  const me = useMe()
  const { grouped } = useModulNav()
  const { shell } = useModulShell()
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
      const grup = groupLayar(bisa).map(({ grup, items }) => [
        ...(grup ? [{ label: grup, type: 'label' as const }] : []),
        ...items.map(l => ({
          label: l.label,
          icon: l.icon,
          to: l.to,
          exact: true,
          badge: badge(l.key) ?? (l.badge
            ? { label: l.badge, color: 'neutral' as const, variant: 'soft' as const, size: 'sm' as const }
            : undefined),
          onSelect: pilih,
        })),
      ])
      return [...grup, ...(s.navEkstra?.() ?? [])]
    }
    return [
      [
        { label: 'Beranda', icon: 'i-lucide-house', to: '/', exact: true, onSelect: pilih },
        { label: 'Semua modul', icon: 'i-lucide-layout-grid', to: '/modul', onSelect: pilih },
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
