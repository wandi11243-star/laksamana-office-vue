// History, guest profile, punctuality and seating duration — pure functions.
//
// Owned by reservasi (PLAN.md §4), read by riwayat.vue and analitik.vue.
// Whole-history profiles come from GET /reservasi/guests/summary (G-07),
// merged below with the loaded window rows exactly like the old screen did
// (`profilGabung`); the directory feeds the input form's autofill.
//
// Source: laksamana-office/deploy/reservasi/index.html:3408-3440 (profile),
// :3432-3458 (profilGabung), :4550-4600 (guestDirectory, autofill),
// :10198-10213 (lateness, tolerance, durations), :1461-1466 (dpRekeningList is
// in dp-reservasi.ts), :5640-5662 (exportCSV).

import type { Reservasi, RingkasanTamu } from '~/composables/useReservasi'
import { normPhone, rekeningDp } from './dp-reservasi'
import { arrivedPax } from './kunci-meja'

/** Normalised status for comparison (twin of rsv_norm_status()): old rows still store the legacy values. */
export function normStatus(s?: string | null): string {
  if (s === 'Checked-in' || s === 'Completed') return 'Datang'
  if (s === 'Booking') return 'Confirmed'
  return String(s ?? '')
}

/** Outside the loaded window (twin of luarJendela): dated before its start. Undated rows are never outside. */
export function diLuarJendela(r: Pick<Reservasi, 'date'>, sebelum?: string): boolean {
  return !!sebelum && !!r.date && r.date < sebelum
}

/** On-time threshold: up to 10 minutes past the booking still counts (`:10205`). */
export const PUNCTUAL_TOL = 10

/**
 * Lateness in minutes = check-in vs the scheduled time. Positive = late,
 * negative = early, null = no arrival time yet (`:10198-10203`).
 */
export function keterlambatanDatang(r?: Reservasi | null): number | null {
  if (!r || !r.checkinAt || !r.date || !r.time) return null
  const sched = new Date(`${r.date}T${r.time}:00`).getTime()
  if (Number.isNaN(sched)) return null
  return Math.round((r.checkinAt - sched) / 60000)
}

/** Null when unknown, else whether within tolerance (`:10206`). */
export function tepatWaktu(r?: Reservasi | null): boolean | null {
  const l = keterlambatanDatang(r)
  return l == null ? null : l <= PUNCTUAL_TOL
}

/** Seating duration in minutes, for a finished guest (check-in → left) (`:10208-10211`). */
export function durasiDuduk(r?: Reservasi | null): number | null {
  if (!r || !r.checkinAt || !r.leftAt) return null
  return Math.max(0, Math.round((r.leftAt - r.checkinAt) / 60000))
}

/**
 * Group rows by normalised phone, ONCE per window — the O(n²) filter
 * (`profilTamu` per row over the whole list) this replaces recomputed the
 * same groups thousands of times per poll. Callers keep the map in a
 * `computed` and pass it to `profilTamuGabung`.
 */
export function kelompokBarisTamu(baris: Reservasi[]): Map<string, Reservasi[]> {
  const m = new Map<string, Reservasi[]>()
  for (const r of baris) {
    const k = normPhone(r.phone)
    const l = m.get(k) ?? []
    l.push(r)
    m.set(k, l)
  }
  return m
}

/** A guest profile from the loaded rows. Thresholds exactly as the old client. */
export interface ProfilTamu {
  nama: string
  telepon: string
  kunjungan: number
  totalBaris: number
  noShow: number
  tipe: 'Baru' | 'Repeat' | 'Loyal'
  blacklist: boolean
  member: boolean
  memberNo: string
  vip: boolean
  kunjunganTerakhir: string | null
  rataPax: number
}

export function profilTamu(baris: Reservasi[], phone: string): ProfilTamu {
  const key = normPhone(phone)
  const hist = baris.filter(r => normPhone(r.phone) === key)
  const datang = hist.filter(r => r.status === 'Datang')
  const noShow = hist.filter(r => r.status === 'No-show').length
  const kunjungan = datang.length
  return {
    nama: hist[0]?.name || '',
    telepon: hist[0]?.phone || phone,
    kunjungan,
    totalBaris: hist.length,
    noShow,
    tipe: kunjungan >= 5 ? 'Loyal' : kunjungan >= 1 ? 'Repeat' : 'Baru',
    blacklist: noShow >= 2,
    member: hist.some(r => r.member),
    memberNo: hist.find(r => r.member && r.memberNo)?.memberNo || '',
    vip: hist.some(r => r.vip) || kunjungan >= 8,
    kunjunganTerakhir: datang.map(r => r.date).sort().slice(-1)[0] || null,
    rataPax: hist.length ? Math.round(hist.reduce((a, r) => a + (Number(r.pax) || 0), 0) / hist.length) : 0,
  }
}

/** Pax cell: arrived/booked once seated, booked otherwise (`:1398-1401`). */
export function paxRiwayat(r: Reservasi): { datang: number | null, dipesan: number } {
  return { datang: normStatus(r.status) === 'Datang' ? arrivedPax(r) : null, dipesan: Number(r.pax) || 0 }
}

/**
 * Whole-history profile: the server summary (everything dated before the
 * window) merged with the window rows — the twin of `profilGabung()`, same
 * rules, same thresholds, no double counting. The summary side is normalised
 * (Checked-in/Completed count as visits), so the window side is too. Falls
 * back to the window rows alone while the summary has no entry for this
 * number (or has not loaded yet), exactly like the old screen.
 */
export function profilTamuGabung(
  ringkasan: Map<string, RingkasanTamu>,
  kelompok: Map<string, Reservasi[]>,
  phone: string,
  sebelum?: string,
): ProfilTamu {
  const key = normPhone(phone)
  const a = ringkasan.get(key)
  const grup = kelompok.get(key) ?? []
  const hist = sebelum ? grup.filter(r => !diLuarJendela(r, sebelum)) : grup
  if (!a) return profilTamu(grup, phone)
  const done = hist.filter(r => normStatus(r.status) === 'Datang')
  const count = (Number(a[0]) || 0) + hist.length
  const kunjungan = (Number(a[1]) || 0) + done.length
  const noShow = (Number(a[2]) || 0) + hist.filter(r => normStatus(r.status) === 'No-show').length
  const paxSum = (Number(a[7]) || 0) + hist.reduce((s, r) => s + (Number(r.pax) || 0), 0)
  return {
    nama: a[8] || '',
    telepon: hist[0]?.phone || phone,
    kunjungan,
    totalBaris: count,
    noShow,
    tipe: kunjungan >= 5 ? 'Loyal' : kunjungan >= 1 ? 'Repeat' : 'Baru',
    blacklist: noShow >= 2,
    member: !!Number(a[3]) || hist.some(r => r.member),
    memberNo: a[4] || hist.find(r => r.member && r.memberNo)?.memberNo || '',
    vip: !!Number(a[5]) || hist.some(r => r.vip) || kunjungan >= 8,
    kunjunganTerakhir: [a[6] || '', ...done.map(r => r.date)].filter(Boolean).sort().slice(-1)[0] || null,
    rataPax: count ? Math.round(paxSum / count) : 0,
  }
}

/** One guest-directory entry: the newest known name for a number. */
export interface EntriDirektori {
  phone: string
  name: string
}

/**
 * Guest directory for the input form's autofill (twin of `guestDirectory()`):
 * summary names first (latest non-empty), then window rows oldest-first, so
 * the newest row wins — the same order as reading the whole history.
 */
export function direktoriTamu(
  ringkasan: Map<string, RingkasanTamu>,
  baris: Reservasi[],
  sebelum?: string,
): EntriDirektori[] {
  const m = new Map<string, EntriDirektori>()
  ringkasan.forEach((a, key) => {
    if (key.length >= 8 && a[9]) m.set(key, { phone: key, name: String(a[9]).trim() })
  })
  ;[...baris]
    .filter(r => !diLuarJendela(r, sebelum))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .forEach((r) => {
      const key = normPhone(r.phone)
      if (!key || key.length < 8 || !r.name) return
      m.set(key, { phone: key, name: String(r.name).trim() })
    })
  return [...m.values()]
}

/** Directory lookup by phone (twin of `findGuestByPhone`). */
export function cariTamuLewatNomor(dir: EntriDirektori[], v: string): EntriDirektori | null {
  const k = normPhone(v)
  if (!k || k.length < 8) return null
  return dir.find(g => g.phone === k) || null
}

/**
 * Directory lookup by name (twin of `findGuestByName`): exact match first,
 * else the single name starting with the typed text.
 */
export function cariTamuLewatNama(dir: EntriDirektori[], v: string): EntriDirektori | null {
  const s = String(v || '').trim().toLowerCase()
  if (s.length < 3) return null
  const pas = dir.filter(g => g.name.toLowerCase() === s)
  if (pas.length) return pas[0]!
  const awal = dir.filter(g => g.name.toLowerCase().startsWith(s))
  return awal.length === 1 ? awal[0]! : null
}

/** Archive rows: past dates, or already closed whatever the date (`renderRiwayatLokal`). Statuses are normalised: a legacy `Completed` is closed too. */
export function barisArsip(baris: Reservasi[], hariIni: string): Reservasi[] {
  return baris.filter(r => r.date < hariIni || ['No-show', 'Cancelled'].includes(normStatus(r.status)))
}

/** Newest booking first (`renderRiwayatLokal`). */
export function urutArsip(baris: Reservasi[]): Reservasi[] {
  return [...baris].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
}

/**
 * History CSV, same columns as the old export (`:5649-5656`). The floor rides
 * along right after the table: a floor-filtered recap loses its floor in
 * Excel without it. `lantai` maps a table id to its floor (0/undefined = none).
 */
export function csvRiwayat(baris: Reservasi[], lantai?: (meja: string) => number | undefined): string {
  const cols = ['Nama', 'No HP', 'Tanggal', 'Jam', 'Pax', 'Pax Aktual', 'Meja', 'Lantai', 'Status', 'DP', 'Nominal DP', 'Metode DP', 'Rekening DP', 'Sumber', 'PIC', 'Member', 'No Member', 'Catatan', 'Diinput Oleh']
  const rows = baris.map((r) => {
    const meja = String(r.table || '')
    const lt = meja.split(',').map(m => lantai?.(m.trim())).filter((v): v is number => !!v)
    return [
      r.name, r.phone, r.date, r.time, r.pax, r.actualPax ?? '', r.table,
      [...new Set(lt)].sort((a, b) => a - b).join(' & '),
      r.status, r.dpStatus, r.dpAmount, r.dpMethod,
      rekeningDp(r).join(' & '),
      r.source, r.picName || '', r.member ? 'Ya' : 'Tidak', r.memberNo, r.notes, r.createdBy,
    ]
  })
  return [cols, ...rows].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

/** Download a CSV string, UTF-8 with BOM for Excel. */
export function unduhCsv(nama: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nama
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Download a Blob the server already built (GET /reservations/export is BOM'd for Excel itself). */
export function unduhBlob(nama: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nama
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
