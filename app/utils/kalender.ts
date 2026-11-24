// Month-grid arithmetic shared by every calendar. Pure: no Vue, no API.
// `bulan` is `YYYY-MM`, dates are `YYYY-MM-DD` (calendar days, no time zone).

const dua = (n: number) => String(n).padStart(2, '0')
export const isoTgl = (y: number, m: number, d: number) => `${y}-${dua(m + 1)}-${dua(d)}`

export interface SelKalender { d: number, tgl: string }

/** Cells as the old grid: weeks start Sunday, days of other months are blank (`tgl: ''`). */
export function selBulan(bulan: string): SelKalender[] {
  const y = +bulan.slice(0, 4)
  const m = +bulan.slice(5, 7) - 1
  const awal = new Date(y, m, 1).getDay()
  const jumlah = new Date(y, m + 1, 0).getDate()
  const bulanLalu = new Date(y, m, 0).getDate()
  const out: SelKalender[] = []
  for (let i = awal - 1; i >= 0; i--) out.push({ d: bulanLalu - i, tgl: '' })
  for (let i = 1; i <= jumlah; i++) out.push({ d: i, tgl: isoTgl(y, m, i) })
  let n = 1
  while (out.length % 7) out.push({ d: n++, tgl: '' })
  return out
}

/** First and last day of the month. */
export function rentangBulan(bulan: string): { a: string, b: string } {
  const y = +bulan.slice(0, 4)
  const m = +bulan.slice(5, 7) - 1
  return { a: isoTgl(y, m, 1), b: isoTgl(y, m, new Date(y, m + 1, 0).getDate()) }
}

/** Step the month by `n` (negative = back). */
export function geserBulan(bulan: string, n: number): string {
  const d = new Date(+bulan.slice(0, 4), +bulan.slice(5, 7) - 1 + n, 1)
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}`
}

/** Whole days since 1970 for a `YYYY-MM-DD`. */
export const hariKe = (t: string) => Math.round(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86400000)
export const tglDariHariKe = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)
/** `tgl` moved by `n` calendar days. */
export const geserTgl = (tgl: string, n: number) => tglDariHariKe(hariKe(tgl) + n)

/** Every day from `a` to `b` inclusive (a later `a` gives just `a`); capped against bad data. */
export function rentangHari(a: string, b: string, maks = 62): string[] {
  if (!a) return []
  const akhir = b && b > a ? b : a
  const out: string[] = []
  for (let n = hariKe(a); tglDariHariKe(n) <= akhir && out.length < maks; n++) out.push(tglDariHariKe(n))
  return out
}
