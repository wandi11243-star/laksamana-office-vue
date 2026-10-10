// Tagihan Rutin (VUE-14, old `viewTagihan`, laksamana-office bc9e0b9,
// deploy/finance/kas/index.html "TAGIHAN RUTIN") — the pure rules.
//
// Recurring subscriptions (wifi, Claude, ChatGPT, Spotify, YouTube): "when is
// each due" and "how much have we paid in total". Contract:
// laksamana-api/docs/api/finance.md "Tagihan Rutin".
//
// - TOTALS come from payment rows with the nominal AS PAID, never price ×
//   months: prices go up, and recomputing from today's price rewrites history.
// - DUE DATES ARE COMPUTED, never stored: `mulai` (first due date) + multiples
//   of `siklus` months. A due date is paid when a LIVE payment has that
//   `periode`. Stored, it would be a second source that goes stale the moment
//   the cycle changes.
// - Day 31 in a 30-day month lands on the month's LAST day, never spills into
//   the next month (`Date` does the latter, and a February due read as March).
//
// Pure functions only: no Vue, no API (`tools/uji-tagihan.mjs` imports this).

export interface Tagihan {
  id: number
  nama: string
  kategori: string
  nominal: number
  siklus: number
  /** First due date `YYYY-MM-DD`, or `''` while unknown. */
  mulai: string
  metode: string
  catatan: string
  aktif: boolean
  dibuatOleh?: string
  dibuatAt?: number
  diubahOleh?: string
  diubahAt?: number
}

export interface BayarTagihan {
  id: number
  tagihanId: number
  /** The due date this payment settles. */
  periode: string
  tglBayar: string
  nominal: number
  catatan: string
  oleh: string
  at?: number
  /** `null` while live; a cancelled row stays visible but never counts. */
  batalAt: number | null
  batalOleh?: string
  batalAlasan?: string
}

/** The cycles the API accepts (anything else → 422). */
export const SIKLUS_TAGIHAN: { value: number, label: string }[] = [
  { value: 1, label: 'Tiap bulan' },
  { value: 2, label: 'Tiap 2 bulan' },
  { value: 3, label: 'Tiap 3 bulan' },
  { value: 6, label: 'Tiap 6 bulan' },
  { value: 12, label: 'Tiap tahun' },
]

/** Suggested categories next to the ones already in use (`tgFormHtml`). */
export const KATEGORI_TAGIHAN_BAWAAN = ['Internet', 'Langganan Software', 'Hiburan']

/**
 * The list the user gave when this page was requested (`TG_AWAL`). Offered
 * through ONE button only while the list is completely empty — never written
 * on its own. Nominal and due date are genuinely unknown.
 */
export const TAGIHAN_AWAL: { nama: string, kategori: string }[] = [
  { nama: 'Wifi CK', kategori: 'Internet' },
  { nama: 'Wifi Biznet', kategori: 'Internet' },
  { nama: 'Wifi Indihome', kategori: 'Internet' },
  { nama: 'Claude Bulanan', kategori: 'Langganan Software' },
  { nama: 'Chatgpt Bulanan', kategori: 'Langganan Software' },
  { nama: 'Spotify Bulanan', kategori: 'Hiburan' },
  { nama: 'Youtube Bulanan', kategori: 'Hiburan' },
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `tgTambahBulan`: add `n` months to `YYYY-MM-DD`, clamping the day to the month's end. */
export function tambahBulanTagihan(iso: string, n: number): string {
  const [y0, m0, d0] = String(iso).split('-').map(Number)
  const idx = y0! * 12 + (m0! - 1) + n
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${pad2(m)}-${pad2(Math.min(d0!, akhir))}`
}

/** `tgSelisihHari`: whole days from `a` to `b` (both `YYYY-MM-DD`). */
export function selisihHariTagihan(a: string, b: string): number {
  const ua = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const ub = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((ub - ua) / 86400000)
}

const BLN_TG = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** `fmtTgl` of the old page: "2026-10-05" → "5 Okt 2026" (no weekday, no timezone). */
export function tglTagihan(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = String(iso).split('-')
  if (p.length !== 3) return String(iso)
  return `${Number(p[2])} ${BLN_TG[Number(p[1]) - 1] ?? p[1]} ${p[0]}`
}

export const bayarHidup = (b: Pick<BayarTagihan, 'batalAt'>) => !b.batalAt

export const siklusTeks = (n: number) =>
  SIKLUS_TAGIHAN.find(s => s.value === Number(n))?.label ?? `Tiap ${n} bulan`

export type JenisStatusTagihan = 'kosong' | 'telat' | 'segera' | 'aman'

export interface StatusTagihan {
  jenis: JenisStatusTagihan
  /** The oldest unpaid due date (`''` without `mulai`). */
  next: string
  /** How many past due dates are unpaid. */
  telat: number
  /** Days from today to `next` (negative when late), `null` without `mulai`. */
  sisa: number | null
}

/**
 * `tgStatus`: sweep due dates from the FIRST one, counting every unpaid date
 * before today as late — not just the nearest. A bill forgotten two months in
 * a row must read "2 periode terlambat": whoever prepares the money needs to
 * know how much to pay at once. `segera` = due within 7 days.
 */
export function statusTagihan(t: Pick<Tagihan, 'id' | 'mulai' | 'siklus'>, bayar: BayarTagihan[], hari: string): StatusTagihan {
  if (!t.mulai) return { jenis: 'kosong', next: '', telat: 0, sisa: null }
  const lunas = new Set(bayar.filter(b => String(b.tagihanId) === String(t.id) && bayarHidup(b)).map(b => b.periode))
  let next = ''
  let telat = 0
  for (let k = 0; k < 600; k++) {
    const due = tambahBulanTagihan(t.mulai, k * (Number(t.siklus) || 1))
    if (lunas.has(due)) continue
    if (!next) next = due
    if (due < hari) {
      telat++
      continue
    }
    break
  }
  const sisa = next ? selisihHariTagihan(hari, next) : null
  const jenis: JenisStatusTagihan = telat > 0 ? 'telat' : (sisa !== null && sisa <= 7 ? 'segera' : 'aman')
  return { jenis, next, telat, sisa }
}

/** `tgUrutStatus`: most urgent first; inactive bills last. */
export function urutStatusTagihan(s: StatusTagihan, aktif: boolean): number {
  if (!aktif) return 9
  return { telat: 0, segera: 1, aman: 2, kosong: 3 }[s.jenis]
}

/** The list order of the Daftar tab: urgency, then next due date, then name. */
export function urutDaftarTagihan<T extends { t: Pick<Tagihan, 'nama' | 'aktif'>, s: StatusTagihan }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const x = urutStatusTagihan(a.s, a.t.aktif) - urutStatusTagihan(b.s, b.t.aktif)
    if (x) return x
    if (a.s.next !== b.s.next) return (a.s.next || '9') < (b.s.next || '9') ? -1 : 1
    return String(a.t.nama).localeCompare(String(b.t.nama))
  })
}

/** Sum of LIVE payments, at the nominal as paid. */
export const totalBayar = (bayar: BayarTagihan[]) =>
  bayar.filter(bayarHidup).reduce((s, b) => s + (Number(b.nominal) || 0), 0)

/**
 * Monthly estimate = nominal ÷ cycle. A Rp1.2 jt yearly bill counts as Rp100rb a
 * month — summed in full, a month without the yearly bill reads far cheaper
 * than reality.
 */
export const perkiraanBulanan = (tagihan: Tagihan[]) =>
  tagihan.filter(t => t.aktif).reduce((s, t) => s + (Number(t.nominal) || 0) / (Number(t.siklus) || 1), 0)
