// The chapter gate for /help/<kunci>. The old router (buka(), help/index.html:
// 643-663) sent BOTH an unknown key and a key the reader may not open back to
// the Help home — deliberately with the same message, so the page cannot be
// used to probe which modules the company has. This keeps that rule: whether
// the chapter does not exist or is not yours, it is simply "not available".
import { HELP_BAB, bolehKunci } from '~/utils/help/registry'

export default defineNuxtRouteMiddleware((to) => {
  const kunci = String(to.params.kunci ?? '')
  const me = useMe()
  const ada = HELP_BAB.some(b => b.key === kunci)
  if (!ada || !bolehKunci(kunci, me.value?.modules)) {
    useHelp().pesan.value = 'Bab panduan itu tidak tersedia.'
    return navigateTo('/help', { replace: true })
  }
})
