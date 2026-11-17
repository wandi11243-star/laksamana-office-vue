/**
 * Busy guard for plain `<button>`s that start a server write (a tick, a
 * toggle, a mood): while one runs for a key the button is disabled, so a
 * double click cannot fire the write twice or flip a toggle back. UButton
 * has this built in — use its `loading-auto` prop instead.
 *
 *   const { jalan, lagi } = useSibuk()
 *   <button :disabled="lagi(t)" @click="jalan(t, () => toggle(t))">
 *
 * The key is anything stable for the row (the row object, its id).
 */
export function useSibuk() {
  const aktif = shallowRef(new Set<unknown>())
  const lagi = (kunci: unknown) => aktif.value.has(kunci)
  async function jalan<T>(kunci: unknown, aksi: () => T | Promise<T>): Promise<T | undefined> {
    if (aktif.value.has(kunci)) return undefined
    aktif.value = new Set(aktif.value).add(kunci)
    try {
      return await aksi()
    }
    finally {
      const s = new Set(aktif.value)
      s.delete(kunci)
      aktif.value = s
    }
  }
  return { jalan, lagi }
}
