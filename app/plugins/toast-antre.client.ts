// When toasts pile up, the older ones leave sooner so the newest is the one read.
// Each new toast cuts every older timed toast down to TOAST_SISA ms (Reka restarts
// the timer when `duration` changes). A toast with no timer (0 or Infinity) is
// waiting on the user and is left alone. The pile itself is capped by
// `toaster.max` in app.vue.
// @nuxt/ui does not re-export its Toast type from the package root, and this
// plugin only reads two fields — so a local structural type is enough.
interface ToastAntre {
  duration?: number
  open?: boolean
  [k: string]: unknown
}

const TOAST_SISA = 1500

export default defineNuxtPlugin(() => {
  // The list useToast() writes to (@nuxt/ui runtime/composables/useToast.js).
  const toasts = useState<ToastAntre[]>('toasts', () => [])

  watch(() => toasts.value.length, (n, lama) => {
    if (n <= lama) return
    toasts.value = toasts.value.map((t, i) => {
      const d = t.duration
      const berwaktu = d === undefined || (d > TOAST_SISA && Number.isFinite(d))
      return i < n - 1 && t.open !== false && berwaktu ? { ...t, duration: TOAST_SISA } : t
    })
  })
})
