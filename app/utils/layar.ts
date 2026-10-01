// One screen of a module — fondasi F4. The old Office had 5-29 screens per
// module (NAV_DEF / NAV_SECTIONS); every module here keeps the same keys in
// `app/utils/layar/<modul>.ts` and one page file per key:
//
//   app/pages/<modul>/index.vue        module home: optional AppFocus + ModulMenu
//   app/pages/<modul>/<key>.vue        one file per screen
//   app/pages/<modul>/<key>/[id].vue   a detail, when the screen has one
//
// A screen the user may not open is dropped by `boleh`; a screen with no page
// file yet shows as "Segera" (ModulMenu checks router.getRoutes(), the same way
// the launcher does in useModulNav).
import type { Me } from '~/composables/useMe'

export interface Layar {
  /** The old NAV_DEF key, unchanged (e.g. 'perfinput'). */
  key: string
  /** Sentence case, Indonesian. */
  label: string
  /** One line, from the old TITLES subtitle. */
  desc?: string
  /** Lucide, as Nuxt UI resolves it: 'i-lucide-…'. */
  icon: string
  /** '/konten/perfinput' */
  to: string
  /** Optional section heading in the menu. */
  grup?: string
  /** A small pill on the menu row, e.g. "Segera" (Help chapter not written yet). */
  badge?: string
  /** In-module check (role matrix, admin). Omit = everyone with the module. */
  boleh?: (me: Me) => boolean
}

/** Group screens by `grup`, keeping the order of the list. Screens without a group come first. */
export function groupLayar(layar: Layar[]): { grup: string, items: Layar[] }[] {
  const grups = new Map<string, Layar[]>()
  for (const l of layar) {
    const key = l.grup ?? ''
    grups.set(key, [...(grups.get(key) ?? []), l])
  }
  return [...grups].map(([grup, items]) => ({ grup, items }))
}
