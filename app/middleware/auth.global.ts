// Every page needs a login unless it says `definePageMeta({ public: true })`.
// A page that belongs to a module says `definePageMeta({ access: ['absensi'] })`;
// users without any of those keys get a 403 page. The API enforces the same
// rule again, so this is only about not showing a screen that would fail.
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
    catch {
      return navigateTo('/login')
    }
  }

  if (to.meta.access && !hasAccess(me.value, to.meta.access)) {
    throw createError({ statusCode: 403, statusMessage: 'Anda belum punya akses ke modul ini. Minta admin membukanya di Kelola Akses.' })
  }
})
