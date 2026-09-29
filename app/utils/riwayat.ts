// History, guest profile, punctuality and seating duration — pure functions.
//
// Owned by reservasi (PLAN.md §4), read by riwayat.vue and analitik.vue.
// The windowed client cannot use `ringkasTamu` (G-07): the profile below is
// computed from the LOADED rows only, and says so where it is shown.
//
// Source: laksamana-office/deploy/reservasi/index.html:3408-3440 (profile),
// :10198-10213 (lateness, tolerance, durations), :1461-1466 (dpRekeningList is
// in dp-reservasi.ts), :5640-5662 (exportCSV).

import type { Reservasi } from '~/composables/useReservasi'
import { normPhone, rekeningDp } from './dp-reservasi'
import { arrivedPax } from './kunci-meja'

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
  return { datang: r.status === 'Datang' ? arrivedPax(r) : null, dipesan: Number(r.pax) || 0 }
}

/** Archive rows: past dates, or already closed whatever the date (`renderRiwayatLokal`). */
export function barisArsip(baris: Reservasi[], hariIni: string): Reservasi[] {
  return baris.filter(r => r.date < hariIni || ['No-show', 'Cancelled'].includes(r.status))
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
