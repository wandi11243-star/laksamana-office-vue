// Cross-tab sync: keep parallel Marketing tabs fresh after writes in another
// tab (zero background polling), and propagate logout across open tabs.
import { dengarTab } from '~/utils/tab-sync'

export default defineNuxtPlugin((nuxtApp) => {
  let marketingKotor = false

  const segarkanMarketing = () => {
    if (nuxtApp.payload.data['marketing-state'] === undefined) return
    marketingKotor = false
    void refreshNuxtData('marketing-state')
  }

  dengarTab((jenis) => {
    if (jenis === 'marketing-state') {
      if (nuxtApp.payload.data['marketing-state'] === undefined) return
      if (document.visibilityState === 'visible') {
        segarkanMarketing()
      }
      else {
        marketingKotor = true
      }
      return
    }
    if (jenis === 'auth-logout') {
      useToken().value = null
      useMe().value = null
      clearNuxtData()
      const route = useRoute()
      if (route.path !== '/login') {
        void navigateTo('/login')
      }
    }
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && marketingKotor) {
      segarkanMarketing()
    }
  })
})
