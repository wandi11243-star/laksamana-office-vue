// Numbers, money and dates — fondasi F3, the one source for every module, so
// "Rp 1.250.000" never reads differently on two screens. Plain functions, no
// Vue, no API.
//
// Source: moved out of useAbsensi.ts (`tglPendek`) per docs/migrasi/00-fondasi.md F3.

const pad = (n: number) => String(n).padStart(2, '0')

/** 1250000 -> "Rp 1.250.000" (the space is non-breaking). null/undefined -> "—". */
export function rupiah(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

/** 1250000 -> "1.250.000". null/undefined -> "—". */
export function angka(n: number | null | undefined, digit = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  }).format(n)
}

/** 0.125 -> "12,5%". A number already in percent (12.5) is not divided. */
export function persen(n: number | null | undefined, digit = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'percent',
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  }).format(n)
}

/** "2026-09-27" -> "Sab, 27 Sep". */
export const tglPendek = (tgl: string) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

/** "2026-09-27" -> "Sabtu, 27 September 2026". */
export const tglPanjang = (tgl: string) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/**
 * "19:00" or an ISO stamp -> "19.00". A plain wall-clock string is already the
 * venue's own time, so it is echoed back untouched; only real date stamps are
 * converted to the browser's timezone.
 */
export function jam(iso: string): string {
  if (!iso) return '—'
  const jamSaja = iso.match(/^(\d{1,2}):(\d{2})/)
  if (jamSaja) return `${jamSaja[1]!.padStart(2, '0')}.${jamSaja[2]}`
  const d = new Date(iso)
  return Number.isNaN(+d) ? '—' : `${pad(d.getHours())}.${pad(d.getMinutes())}`
}

/** Today as a local "YYYY-MM-DD". Never `toISOString()`: that is UTC and lies after 17.00 WIB. */
export function hariIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "2026-09-27" + 1 -> "2026-09-28". The venue's timezone, not UTC. */
export function tambahHari(tgl: string, n: number): string {
  const d = new Date(`${tgl}T00:00:00`)
  if (Number.isNaN(+d)) return tgl
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
