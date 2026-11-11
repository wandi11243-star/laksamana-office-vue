import type { MaybeRefOrGetter } from 'vue'
import { getReservasiVer } from '~/composables/useReservasi'

export interface OpsiPoll {
  /** Interval in ms. A random 0–1000 ms offset is added to each start so screens don't tick together. */
  jeda: number
  /** Extra "user is busy" check (open sheet, save in flight, …). Ticks are skipped while it returns true. */
  tunda?: () => boolean
  /** Poll only while this is true (e.g. only on one tab). Default: always. */
  aktif?: MaybeRefOrGetter<boolean>
  /** Also skip while focus is in an input/textarea/select/contenteditable. Default true. Set false for screens whose pull never touches what the user is typing. */
  tundaSaatMengetik?: boolean
}

/**
 * Smart poll for reservation screens (old Office: deploy/reservasi/index.html:3089-3156).
 * Each tick asks GET /reservasi/ver; `tarik()` runs only when the counter changed since the
 * last tick (or the ver call failed — never a stale screen because of a ver error). The
 * baseline is taken at start WITHOUT pulling (the screen just loaded its data). Skipped while
 * the browser tab is hidden, while `tunda()`/typing says the user is busy, or while a previous
 * pull is still running. When the tab becomes visible again it ticks at once.
 * Returns `{ setel() }` to reset the baseline (e.g. after the screen changes its window).
 */
export function usePollReservasi(tarik: () => Promise<unknown>, opsi: OpsiPoll): { setel: () => void } {
  const aktif = opsi.aktif ?? true
  const sedangTarik = ref(false)
  let verTerakhir: number | null = null
  let perluTarik = false
  let interval: ReturnType<typeof setInterval> | undefined
  let awal: ReturnType<typeof setTimeout> | undefined

  function sedangMengetik() {
    if (opsi.tundaSaatMengetik === false) return false
    const el = document.activeElement as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  }

  async function tick() {
    if (document.visibilityState !== 'visible' || !toValue(aktif) || sedangTarik.value
      || opsi.tunda?.() || sedangMengetik()) return

    sedangTarik.value = true
    try {
      let ver: number | undefined
      try {
        const hasil = await getReservasiVer()
        const nilai: unknown = hasil.data?.ver
        if (typeof nilai === 'number') ver = nilai
      }
      catch {
        // A failed version check falls back to a full pull.
      }

      if (ver === undefined) {
        await tarik()
      }
      else if (verTerakhir === null) {
        verTerakhir = ver
        if (perluTarik) await tarik()
      }
      else if (perluTarik || ver !== verTerakhir) {
        verTerakhir = ver
        await tarik()
      }
      perluTarik = false
    }
    catch {
      // Background failures are retried on the next tick.
    }
    finally {
      sedangTarik.value = false
    }
  }

  function hentikan() {
    clearTimeout(awal)
    clearInterval(interval)
    awal = undefined
    interval = undefined
  }

  function mulai() {
    hentikan()
    if (!import.meta.client || !toValue(aktif)) return
    awal = setTimeout(() => {
      void tick()
      interval = setInterval(() => void tick(), opsi.jeda)
    }, Math.random() * 1000)
  }

  function saatVisibel() {
    if (document.visibilityState === 'visible' && toValue(aktif)) void tick()
  }

  const setel = () => {
    verTerakhir = null
    perluTarik = true
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', saatVisibel)
    mulai()
  })
  watch(() => toValue(aktif), (nyala) => {
    if (nyala) mulai()
    else hentikan()
  })
  onBeforeUnmount(() => {
    hentikan()
    document.removeEventListener('visibilitychange', saatVisibel)
  })

  return { setel }
}
