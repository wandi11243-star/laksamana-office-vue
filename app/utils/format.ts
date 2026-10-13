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

/**
 * 0.125 -> "12,5%". The input is a FRACTION: `Intl` percent style always
 * multiplies by 100, so a number that is already in percent (12.5) has to be
 * divided by 100 by the caller before it comes here.
 */
export function persen(n: number | null | undefined, digit = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'percent',
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  }).format(n)
}

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
/** Short months as the old Office wrote them ("Ags", not Intl's "Agu"). */
export const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

/** "YYYY-MM-DD" as a local Date, never UTC. */
const tglLokal = (iso: string) => {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}
/** "2026-09-27" -> "Sabtu, 27 September 2026" (Radar fTgl, BD fTglPanjang). */
export function fTgl(iso?: string): string {
  if (!iso) return '—'
  const d = tglLokal(iso)
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}
/** "2026-09-27" -> "27 Sep" (Radar fTglP, BD fTgl). */
export function fTglP(iso?: string): string {
  if (!iso) return '—'
  const d = tglLokal(iso)
  return `${d.getDate()} ${BLN[d.getMonth()]}`
}

/** "2026-09-27" -> "Sab, 27 Sep". */
export const tglPendek = (tgl: string) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

/** "2026-09-27" -> "Minggu, 27 Sep 2026" (the old screens' `dateLabel`). */
export const tglLabel = (tgl: string) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

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

/**
 * Tidy whatever was typed into a time field into 24-hour "HH:MM".
 * "7" -> 07:00, "19" -> 19:00, "1930" -> 19:30, "19.30" -> 19:30. An
 * unparseable value comes back as "" so the caller can refuse it.
 * Source: laksamana-office/deploy/reservasi/index.html:4019-4033.
 */
export function normTime(v: unknown): string {
  let s = String(v ?? '').trim()
  if (!s) return ''
  s = s.replace(/[^\d:]/g, m => (m === '.' || m === ' ') ? ':' : '')
  let h: number
  let m: number
  if (s.includes(':')) {
    const p = s.split(':')
    h = Number.parseInt(p[0]!, 10)
    m = Number.parseInt(p[1] || '0', 10)
  }
  else if (s.length <= 2) {
    h = Number.parseInt(s, 10)
    m = 0
  }
  else {
    h = Number.parseInt(s.slice(0, s.length - 2), 10)
    m = Number.parseInt(s.slice(-2), 10)
  }
  if (Number.isNaN(h)) return ''
  if (Number.isNaN(m)) m = 0
  h = Math.min(23, Math.max(0, h))
  m = Math.min(59, Math.max(0, m))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "Rp. 1.000.000" or "1500000" -> 1500000. Every non-digit is dropped, so what the crew typed never blocks the save. */
export function rupiahVal(v: unknown): number {
  const d = String(v ?? '').replace(/\D/g, '')
  return d ? Number(d) : 0
}

/** The rupiah field as it is typed: 1500000 -> "Rp. 1.000.000", 0 -> "". */
export const fmtRupiah = (n: number) => (n ? `Rp. ${new Intl.NumberFormat('id-ID').format(n)}` : '')

/** Every 15 minutes from 00:00, for a time dropdown. */
export const opsiJam = (step = 15): string[] => {
  const out: string[] = []
  for (let m = 0; m < 1440; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return out
}
