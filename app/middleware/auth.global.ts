// Every page needs a login unless it says `definePageMeta({ public: true })`.
// A page that belongs to a module says `definePageMeta({ access: ['absensi'] })`;
// users without any of those keys get a 403 page. The API enforces the same
// rule again, so this is only about not showing a screen that would fail.
import type { BdSettings } from '~/composables/useBd'
import { getBdSettings, layarTersembunyiBd } from '~/composables/useBd'
import { LAYAR_BD } from '~/utils/layar/bd'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) return

  // A switched-off module (MODUL[].nonaktif) has no pages, for anyone.
  if (MODUL.some(m => m.nonaktif && to.path.split('/')[1] === m.key)) {
    throw createError({ statusCode: 404, statusMessage: 'Halaman tidak ditemukan.' })
  }

  if (!useToken().value) {
    return navigateTo({ path: '/login', query: to.fullPath === '/' ? {} : { next: to.fullPath } })
  }

  const me = useMe()
  if (!me.value) {
    try {
      await fetchMe()
    }
    catch (e) {
      // A dead token (401) really means "log in again" — useApi() already
      // cleared it. Anything else (offline, 5xx) keeps the token and shows a
      // retryable error instead of bouncing between / and /login.
      if ((e as { statusCode?: number })?.statusCode === 401 || !useToken().value) {
        return navigateTo('/login')
      }
      throw createError({ statusCode: 503, statusMessage: 'Server tidak terjangkau. Periksa koneksi lalu coba lagi.' })
    }
  }

  if (to.meta.access && !hasAccess(me.value, to.meta.access)) {
    throw createError({ statusCode: 403, statusMessage: 'Anda belum punya akses ke modul ini. Minta admin membukanya di Kelola Akses.' })
  }

  // Task Management: a screen a BD admin closed for this crew member (Kelola
  // Akses) stays closed by URL too, not only in the menu. Detail pages follow
  // their list (a project → Projects, a PR sheet → Purchasing).
  if (to.path.startsWith('/bd/') && me.value && !isAdminOf(me.value, 'bd')) {
    const layar = LAYAR_BD.find(l => l.key !== 'dashboard' && (to.path === l.to || to.path.startsWith(`${l.to}/`) || to.path.startsWith(`${l.to}-`)))
    if (layar?.key === 'tim') {
      throw createError({ statusCode: 403, statusMessage: 'Kelola Akses hanya untuk admin Task Management.' })
    }
    if (layar) {
      const cache = useNuxtData<{ data?: BdSettings }>('bd-settings').data.value
      const akses = cache?.data?.aksesHalaman ?? (await getBdSettings().catch(() => null))?.data?.aksesHalaman
      if (layarTersembunyiBd(me.value, akses ?? {}).includes(layar.key)) {
        throw createError({ statusCode: 403, statusMessage: `${layar.label} belum dibuka untukmu. Minta admin Task Management membukanya di Kelola Akses.` })
      }
    }
  }
})
