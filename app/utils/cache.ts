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
