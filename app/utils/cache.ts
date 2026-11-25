import type { NuxtApp } from '#app'

// One canonical key per master read, with a short TTL.
//
// Several screens read the same master list under different useAsyncData
// keys (ten keys for GET /stock/products alone), so one session fetched it
// ten times. Canonical composables share a single key; writers keep calling
// their refresh() (which always refetches), and the TTL bounds staleness
// everywhere else (issue #147).

/** Master reads stay fresh for a minute without a writer round-trip. */
export const TTL_MASTER = 60000

const cap = new Map<string, number>()

/** Mark a key freshly fetched (called inside the canonical fetcher). */
export function stempelCache(key: string) {
  cap.set(key, Date.now())
}

/** useAsyncData getCachedData: serve the payload while the stamp is young. */
export function bacaCache(ttlMs: number = TTL_MASTER) {
  return (key: string) => {
    const t = cap.get(key)
    const data = useNuxtApp().payload.data[key]
    if (t !== undefined && Date.now() - t < ttlMs && data !== undefined) return data
    cap.delete(key)
    return undefined
  }
}

// ---- stale-while-revalidate for the per-module state documents ----
//
// Every screen of a module reads one state document (`marketing/state`,
// `konten/state`, …) under one key. Without a cache each screen switch inside
// the module waited for the whole document again. `cacheSegar()` serves the
// last copy straight away when a screen mounts and refetches it in the
// background, so the screen paints at once and settles a moment later.
// Only the first read of a mount is served from cache: refresh() after a
// write, polls and watch-triggered reloads always go to the server.

const segarDijadwal = new Set<string>()

/**
 * useAsyncData getCachedData: last copy on mount, then one background refresh.
 * With `mudaMs`, a copy fetched less than that ago (the fetcher calls
 * `stempelCache`) is served as is, with no refetch: for a large document that
 * only this module writes, refetching on every screen switch froze the page.
 */
export function cacheSegar(mudaMs = 0) {
  return (key: string, nuxtApp: NuxtApp, ctx: { cause: string }) => {
    if (ctx.cause !== 'initial') return undefined
    const data = nuxtApp.payload.data[key]
    if (data === undefined || data === null) return undefined
    const masihMuda = mudaMs > 0 && Date.now() - (cap.get(key) ?? 0) < mudaMs
    if (!masihMuda && !segarDijadwal.has(key)) {
      segarDijadwal.add(key)
      setTimeout(() => {
        segarDijadwal.delete(key)
        void refreshNuxtData(key)
      }, 0)
    }
    return data
  }
}
