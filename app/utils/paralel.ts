// Bounded parallel map for independent writes (no Vue, no API).
//
// Screens used to await one row per turn (KompasBri-era loops in useKonten,
// useBd, DwIsiBaris, DwSelSheet); on a slow link a dozen rows meant a dozen
// round trips in a row. This runs `batas` at a time and reports per item, so
// one refusal never hides the rest. Order of results follows the input.

/** Independent writes run this many at a time (issue #151). */
export const BATAS_TULIS_PARALEL = 4
export async function petaParalel<T, R>(
  daftar: T[],
  batas: number,
  kerja: (item: T, i: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const n = Math.max(1, Math.floor(batas) || 1)
  const hasil: PromiseSettledResult<R>[] = []
  for (let awal = 0; awal < daftar.length; awal += n) {
    const potong = daftar.slice(awal, awal + n)
    const selesai = await Promise.allSettled(potong.map((item, k) => kerja(item, awal + k)))
    hasil.push(...selesai)
  }
  return hasil
}

/** How many of the settled results kept their promise. */
export const hitungBerhasilParalel = <R>(hasil: PromiseSettledResult<R>[]) =>
  hasil.filter(h => h.status === 'fulfilled').length
