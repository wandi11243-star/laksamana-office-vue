// Report attendance (Talenta) reader — a port of the old People OS parser
// (deploy/hr/index.html:1050-1186), now built on the fondasi .xlsx reader
// (K-05 point 2) instead of its own ZIP/XML code.
//
// The rules that matter (F.3):
// - columns are found by TITLE, never by position — Talenta adds columns;
// - "TOTAL FOR EMPLOYEE" rows are skipped because their Date is not a date;
// - a crew row matches an Office account ONLY by talentaId, never by name;
// - resign rows are dropped here: they will never be scored.
import type { BarisTabel, BerkasTabel } from '~/utils/xlsx-baca'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import type { HrAttendanceDay, HrEmployee } from '~/utils/hr'

/** Title in the file -> our field (`ATT_KOLOM`, :1064). */
export const ATT_KOLOM: Record<string, string> = {
  'Employee ID': 'talentaId',
  'Full Name': 'name',
  'Organization': 'org',
  'Resign Status': 'resign',
  'Date': 'date',
  'Shift': 'shift',
  'Attendance Code': 'code',
  'Time Off Code': 'timeOff',
  'Check In': 'checkIn',
  'Check Out': 'checkOut',
  'Late In': 'lateIn',
}

export interface BarisTalenta {
  talentaId: string
  name: string
  org: string
  resign: string
  date: string
  shift: string
  code: string
  timeOff: string
  checkIn: string
  checkOut: string
  lateMin: number
}

/** 'HH:MM' -> minutes; '00:00' and empty are both 0 (`hhmmToMin`, :1081). */
export function hhmmToMin(t: unknown): number {
  const m = /^(\d{1,3}):(\d{2})/.exec(String(t || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

/**
 * Rows of whatever the reader produced -> Talenta attendance rows. The first
 * row is the header; required titles are Employee ID, Full Name, Date, Shift
 * (`parseTalentaXlsx`, :1086).
 */
export function uraiTalenta(baris: BarisTabel[]): BarisTalenta[] {
  if (!baris.length) throw new Error('Berkas kosong: tidak ada baris sama sekali.')
  const head = baris[0]!
  const peta: Record<string, string> = {} // column letter -> field
  for (const k of Object.keys(head)) {
    const field = ATT_KOLOM[String(head[k] ?? '').trim()]
    if (field) peta[k] = field
  }
  const wajib = ['talentaId', 'name', 'date', 'shift']
  const hilang = wajib.filter(f => !Object.values(peta).includes(f))
  if (hilang.length) throw new Error(`Kolom wajib tidak ada di berkas: ${hilang.join(', ')}`)

  const out: BarisTalenta[] = []
  for (const row of baris.slice(1)) {
    const rec: Record<string, string> = {}
    for (const k of Object.keys(row)) {
      const field = peta[k]
      if (field) rec[field] = String(row[k] ?? '').trim()
    }
    // The "TOTAL FOR EMPLOYEE" separator: its date is not a date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.date || '')) continue
    if (!rec.talentaId) continue
    out.push({
      talentaId: rec.talentaId,
      name: rec.name || '',
      org: rec.org || '',
      resign: rec.resign || '',
      date: rec.date!,
      shift: rec.shift || '',
      code: rec.code || '',
      timeOff: rec.timeOff || '',
      checkIn: rec.checkIn || '',
      checkOut: rec.checkOut || '',
      lateMin: hhmmToMin(rec.lateIn),
    })
  }
  if (!out.length) throw new Error('Tidak ada baris absensi yang terbaca. Pastikan ini report "Attendance" dari Talenta.')
  return out
}

/** One uploaded file (.xlsx or .csv) -> Talenta rows. */
export async function bacaTalenta(file: BerkasTabel): Promise<BarisTalenta[]> {
  return uraiTalenta(await bacaBerkasTabel(file))
}

/**
 * The month of the upload: the MOST FREQUENT one, not the first row — exports
 * often include a day or two of the neighbouring month (`prosesAttFile`, :1789).
 */
export function bulanTerbanyak(rows: BarisTalenta[]): string {
  const hitung: Record<string, number> = {}
  for (const b of rows) hitung[b.date.slice(0, 7)] = (hitung[b.date.slice(0, 7)] ?? 0) + 1
  return Object.keys(hitung).sort((a, b) => hitung[b]! - hitung[a]!)[0] ?? ''
}

export interface HasilCocokTalenta {
  bulan: string
  days: HrAttendanceDay[]
  unmatched: { talentaId: string, name: string, org: string }[]
  nResign: number
  /** Distinct employees that matched. */
  cocok: number
}

/**
 * Match the rows to Office accounts by talentaId only (`prosesAttFile`,
 * :1800-1812). Unmatched rows keep `empId: ''` and are reported, never guessed.
 */
export function cocokkanTalenta(rows: BarisTalenta[], employees: HrEmployee[]): HasilCocokTalenta {
  const bulan = bulanTerbanyak(rows)
  const aktif = rows.filter(b => String(b.resign || '').toLowerCase() !== 'resigned')
  const nResign = rows.length - aktif.length
  const byTid: Record<string, HrEmployee> = {}
  for (const e of employees) if (e.talentaId) byTid[String(e.talentaId)] = e

  const unmatched: Record<string, { talentaId: string, name: string, org: string }> = {}
  const days: HrAttendanceDay[] = aktif.map((b) => {
    const e = byTid[b.talentaId]
    if (!e) unmatched[b.talentaId] = { talentaId: b.talentaId, name: b.name, org: b.org }
    return {
      talentaId: b.talentaId,
      empId: e ? e.id : '',
      date: b.date,
      shift: b.shift,
      code: b.code,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      lateMin: b.lateMin,
      org: b.org,
    }
  })
  return {
    bulan,
    days,
    unmatched: Object.values(unmatched),
    nResign,
    cocok: new Set(days.filter(d => d.empId).map(d => d.empId)).size,
  }
}
