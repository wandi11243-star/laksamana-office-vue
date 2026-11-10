export default defineNuxtPlugin((nuxtApp) => {
  const cekUpdate = () => {
    if (!navigator.onLine) return
    void nuxtApp.$pwa?.getSWRegistration()?.update()
  }
  // resumed from background (phone PWA): check right away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') cekUpdate()
  })
  // Nuxt saw a newer build: install the new SW so autoUpdate reloads into it
  // (otherwise Nuxt's own reload would be answered by the OLD SW's shell)
  nuxtApp.hook('app:manifest:update', cekUpdate)
  // the app booted: clear the one-shot recovery flag set by spa-loading-template.html
  nuxtApp.hook('app:mounted', () => {
    try {
      sessionStorage.removeItem('lm-boot-reset')
    }
    catch {
      // storage blocked (private mode): nothing to clear
    }
  })
})
