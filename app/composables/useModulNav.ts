/** The modules this user may open, with `ready` = its page exists in this app. */
export function useModulNav() {
  const me = useMe()
  const router = useRouter()

  const mine = computed(() => MODUL
    .filter(m => hasAccess(me.value, m.access))
    .map(m => ({ ...m, to: `/${m.key}`, ready: router.getRoutes().some(r => r.path === `/${m.key}`) })))

  const grouped = computed(() => MODUL_GROUPS
    .map(group => ({ group, items: mine.value.filter(m => m.group === group) }))
    .filter(g => g.items.length))

  return { mine, grouped }
}
