/**
 * Full screen for one element (the table plan, owner request Nov 2026: "untuk
 * denah kalau bisa langsung full screen"). The browser's own Fullscreen API:
 * Esc leaves it as everywhere else, and `penuh` follows whatever the browser
 * decides (Esc, F11, a tab switch).
 *   const kanvas = ref<HTMLElement | null>(null)
 *   const { penuh, alihkan } = useLayarPenuh(kanvas)
 */
export function useLayarPenuh(el: Ref<HTMLElement | null>) {
  const penuh = ref(false)
  const bisa = ref(false)
  const ikut = () => (penuh.value = !!document.fullscreenElement && document.fullscreenElement === el.value)

  onMounted(() => {
    bisa.value = typeof document.documentElement.requestFullscreen === 'function'
    document.addEventListener('fullscreenchange', ikut)
  })
  onBeforeUnmount(() => document.removeEventListener('fullscreenchange', ikut))

  async function alihkan() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.value?.requestFullscreen()
    }
    catch {
      // Refused (iframe, old browser): the plan simply stays where it is.
    }
  }

  return { penuh, bisa, alihkan }
}
