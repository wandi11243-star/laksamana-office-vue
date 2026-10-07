// People Score engine — the pure rules of the old People OS
// (laksamana-office deploy/hr/index.html §ENGINE, :1022-1478). Owned by the hr
// module (PLAN.md §4); other modules import, never copy.
//
// Nothing here is stored as a final number: every screen recomputes from the
// raw rows, which is why changing a weight or an attendance rule applies
// retroactively (F.1/F.2). `completeness` marks how much of the score really
// came from data — below SCORE_MIN_COMPLETENESS the score is mostly the
// default value and must not be shown as a judgement (F.5).
import type { HrAkademiStat, HrEmployee, HrSettings, HrState } from '~/utils/hr'
import { REVIEW_ASPECTS, SCORE_MIN_COMPLETENESS, empById, kpiTemplateFor } from '~/utils/hr'
import { geserBulan } from '~/utils/jadwal'
import { hariIni } from '~/utils/format'

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const rataRata = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

/** `'YYYY-MM'` of a date string (`monthKey`). */
export const bulanDariTgl = (tgl?: string) => String(tgl || '').slice(0, 7)

/** The last `n` months ending at `from` (`lastMonths`, :320). */
export function bulanTerakhir(n: number, from: string): string[] {
  const out: string[] = []
  let mk = from
  for (let i = 0; i < n; i++) {
    out.unshift(mk)
    mk = geserBulan(mk, -1)
  }
  return out
}

// ---------------------------------------------------------------- KPI (:1022)

/** One indicator against its template item (`kpiItemScore`, :1024). */
export function kpiItemScore(item: { dir: string, target: number }, actual: unknown): number | null {
  if (actual == null || actual === '' || Number.isNaN(Number(actual))) return null
  const a = Number(actual)
  const ach = item.dir === 'down'
    ? (a <= 0 ? 120 : (item.target / a) * 100)
    : (item.target <= 0 ? 100 : (a / item.target) * 100)
  return clamp(ach, 0, 120)
}

/** Weighted score of one division's indicators (`divKpiScore`, :1032). */
export function divKpiScore(s: HrState, divId: string, mk: string): { score: number, filled: number, total: number } | null {
  const t = kpiTemplateFor(s, divId)
  if (!t) return null
  const acts = s.kpiActuals[divId]?.[mk] ?? {}
  let sw = 0
  let sum = 0
  let filled = 0
  for (const it of t.items) {
    const sc = kpiItemScore(it, acts[it.id])
    if (sc != null) {
      sum += sc * it.weight
      sw += it.weight
      filled++
    }
  }
  if (!sw) return null
  return { score: clamp(sum / sw, 0, 120), filled, total: t.items.length }
}

/** The employee's KPI component: override wins, else the division's (`empKpiScore`, :1043). */
export function empKpiScore(s: HrState, emp: Pick<HrEmployee, 'id' | 'divId'>, mk: string): number | null {
  const mi = s.monthlyInputs[emp.id]?.[mk] ?? {}
  const ov = mi.kpiOverride
  if (ov != null && ov !== '') return clamp(Number(ov), 0, 120)
  const d = divKpiScore(s, emp.divId, mk)
  return d ? Math.min(d.score, 100) : null
}

// ---------------------------------------------------------------- attendance (:1188)

export const attRules = (s: HrState): HrSettings['attendanceRules'] => s.settings.attendanceRules

/** Is this shift name a non-working day (`isOffShift`, :1196)? */
export function isOffShift(s: HrState, shift: unknown): boolean {
  const R = attRules(s)
  const x = String(shift || '').trim().toLowerCase()
  if (!x) return false
  if ((R.offShifts || []).some(v => String(v).trim().toLowerCase() === x)) return true
  return (R.offShiftContains || []).some(v => x.includes(String(v).toLowerCase()))
}

export interface RincianHari {
  date: string
  shift: string
  code: string
  status: 'libur' | 'izin' | 'izin-lewat' | 'hadir' | 'tanpa-checkout' | 'alpa'
  checkIn: string
  checkOut: string
  lateMin: number
}

export interface AttendanceDetail {
  hariKerja: number
  hadir: number
  hadirPenuh: number
  tanpaCheckout: number
  alpa: number
  telat: number
  telatMenit: number
  libur: number
  izin: number
  izinLewatJatah: number
  kredit: number
  penaltiTelat: number
  rincian: RincianHari[]
  noData?: boolean
  score: number | null
  presence: number | null
  punctuality: number | null
}

/**
 * One worker's month from the stored Talenta rows (`attendanceDetail`, :1214).
 * Check order matters: off-shift → excused (within quota) → free excused →
 * check-in → alpa. A month with zero check-ins is `noData`, not zero
 * (F.4): almost always the app was not used, not 25 days skipped.
 */
export function attendanceDetail(s: HrState, empId: string, mk: string): AttendanceDetail | null {
  const bulan = s.attendance[mk]
  if (!bulan || !Array.isArray(bulan.days)) return null
  const hari = bulan.days.filter(d => d.empId === empId)
  if (!hari.length) return null

  const R = attRules(s)
  const tol = R.lateToleranceMin ?? 15
  const cap = R.lateCapMin ?? 45
  const kreditNoOut = R.noCheckoutCredit ?? 0.5
  const caps = R.excusedCaps || {}
  const bebas = R.excusedCodes || []

  const d: AttendanceDetail = {
    hariKerja: 0, hadir: 0, hadirPenuh: 0, tanpaCheckout: 0, alpa: 0,
    telat: 0, telatMenit: 0, libur: 0, izin: 0, izinLewatJatah: 0,
    kredit: 0, penaltiTelat: 0, rincian: [], score: null, presence: null, punctuality: null,
  }
  const dipakai: Record<string, number> = {}

  hari.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((h) => {
    const kode = String(h.code || '').trim().toUpperCase()
    let status: RincianHari['status']

    if (isOffShift(s, h.shift)) {
      d.libur++
      status = 'libur'
    }
    else if (caps[kode] != null) {
      dipakai[kode] = (dipakai[kode] ?? 0) + 1
      if (dipakai[kode]! <= caps[kode]!) {
        d.izin++
        status = 'izin'
      }
      else {
        d.hariKerja++
        d.alpa++
        d.izinLewatJatah++
        status = 'izin-lewat'
      }
    }
    else if (bebas.includes(kode)) {
      d.izin++
      status = 'izin'
    }
    else if (h.checkIn) {
      d.hariKerja++
      if (h.checkOut) {
        d.hadir++
        d.hadirPenuh++
        d.kredit += 1
        status = 'hadir'
      }
      else {
        d.hadir++
        d.tanpaCheckout++
        d.kredit += kreditNoOut
        status = 'tanpa-checkout'
      }
      const lm = Number(h.lateMin || 0)
      if (lm > tol) {
        d.telat++
        d.telatMenit += lm
        // Linear ramp tolerance→cap: 15 min → 0, 45 min and over → 1.
        d.penaltiTelat += cap > tol ? Math.min((lm - tol) / (cap - tol), 1) : 1
      }
    }
    else {
      d.hariKerja++
      d.alpa++
      status = 'alpa'
    }

    d.rincian.push({ date: h.date, shift: h.shift, code: kode, status, checkIn: h.checkIn, checkOut: h.checkOut, lateMin: Number(h.lateMin || 0) })
  })

  if (!d.hariKerja) return null
  if (d.hadir === 0) {
    d.noData = true
    return d
  }

  const W = R.weights || { presence: 70, punctuality: 30 }
  const totalW = (W.presence || 0) + (W.punctuality || 0)
  d.presence = (d.kredit / d.hariKerja) * 100
  d.punctuality = clamp((1 - d.penaltiTelat / d.hariKerja) * 100, 0, 100)
  d.score = totalW ? clamp((d.presence * (W.presence || 0) + d.punctuality * (W.punctuality || 0)) / totalW, 0, 100) : 0
  return d
}

/** The attendance number for People Score (`attendanceScore`, :1289). */
export function attendanceScore(s: HrState, empId: string, mk: string): number | null {
  const d = attendanceDetail(s, empId, mk)
  return d && d.score != null ? d.score : null
}

/** Weighted by working days across every stored month (`attendanceCumulative`, :1295). */
export function attendanceCumulative(s: HrState, empId: string): { score: number, bulan: number, hariKerja: number } | null {
  const mks = Object.keys(s.attendance).sort()
  const nilai: AttendanceDetail[] = []
  for (const mk of mks) {
    const d = attendanceDetail(s, empId, mk)
    if (d && d.score != null) nilai.push(d)
  }
  if (!nilai.length) return null
  const totHari = nilai.reduce((a, x) => a + x.hariKerja, 0)
  return { score: nilai.reduce((a, x) => a + x.score! * x.hariKerja, 0) / totHari, bulan: nilai.length, hariKerja: totHari }
}

// ---------------------------------------------------------------- training & feedback (:1307)

/** Akademi completion wins over the manual records (`trainingScore`, :1308, F.6). */
export function trainingScore(s: HrState, empId: string, akademi: Record<string, HrAkademiStat> | null): number | null {
  const stat = akademi?.[empId]
  if (stat && stat.mandPct != null) return clamp(Number(stat.mandPct), 0, 100)
  const recs = s.trainingRecords.filter(r => r.empId === empId)
  const mandatory = s.trainings.filter(t => t.mandatory && (t.divId === 'all' || t.divId === (empById(s, empId)?.divId ?? '')))
  if (!mandatory.length && !recs.length) return null
  const relevant = mandatory.length ? mandatory : s.trainings.filter(t => recs.some(r => r.trainingId === t.id))
  if (!relevant.length) return null
  const done = relevant.filter(t => recs.some(r => r.trainingId === t.id && r.status === 'Lulus')).length
  return (done / relevant.length) * 100
}

export const trainingDariAkademi = (akademi: Record<string, HrAkademiStat> | null, empId: string) =>
  !!(akademi?.[empId] && akademi[empId]!.mandPct != null)

/** Guest feedback of one month (`feedbackScore`, :1328). */
export function feedbackScore(s: HrState, empId: string, mk: string): number | null {
  const fb = s.feedbacks.filter(f => f.empId === empId && bulanDariTgl(f.date) === mk)
  if (!fb.length) return null
  const pos = fb.filter(f => f.kind === 'positif').length
  const neg = fb.length - pos
  return clamp(80 + pos * 5 - neg * 10, 0, 100)
}

/** Violations of the month, cancelled ones excluded (`disciplineScore`, :1334). */
export function disciplineScore(s: HrState, empId: string, mk: string): number {
  const vio = s.violations.filter(v => v.empId === empId && bulanDariTgl(v.date) === mk && v.status !== 'Dibatalkan')
  let ded = 0
  for (const v of vio) ded += s.settings.violationDeduct[v.severity] || 0
  return clamp(100 - ded, 0, 100)
}

/** Weighted average of the filled layers for a set of aspects (`reviewAspectScore`, :1340). */
export function reviewAspectScore(s: HrState, empId: string, mk: string, aspects: string[]): number | null {
  const rv = s.reviews.find(r => r.empId === empId && r.month === mk)
  if (!rv) return null
  const w = s.settings.reviewLayerWeights
  const vals: number[] = []
  for (const a of aspects) {
    let sw = 0
    let sum = 0
    for (const L of ['self', 'manager', 'hr', 'ceo']) {
      const lay = rv.layers?.[L]
      const v = lay?.aspects?.[a]
      if (v != null) {
        sum += Number(v) * (w[L] || 0)
        sw += (w[L] || 0)
      }
    }
    if (sw) vals.push(sum / sw)
  }
  if (!vals.length) return null
  return rataRata(vals)! * 10
}

export const reviewOverallScore = (s: HrState, empId: string, mk: string) => reviewAspectScore(s, empId, mk, REVIEW_ASPECTS)

// ---------------------------------------------------------------- People Score (:1361)

export interface KomponenScore {
  attendance: number | null
  kpi: number | null
  training: number | null
  review: number | null
  discipline: number | null
  teamwork: number | null
  initiative: number | null
  [k: string]: number | null
}

export interface HasilScore { score: number, comp: KomponenScore, completeness: number }

/**
 * The seven weighted components (`peopleScore`, :1361). Talenta beats manual
 * attendance input (F.7); Akademi beats manual training (F.6). Empty
 * components use the default and are NOT counted in completeness.
 */
export function peopleScore(s: HrState, emp: EmployeeLike, mk: string, akademi: Record<string, HrAkademiStat> | null = null): HasilScore {
  const W = s.settings.scoreWeights
  const mi = s.monthlyInputs[emp.id]?.[mk] ?? {}
  const dflt = s.settings.defaultComponentScore
  const comp: KomponenScore = {
    attendance: null, kpi: null, training: null, review: null,
    discipline: null, teamwork: null, initiative: null,
  }
  comp.attendance = attendanceScore(s, emp.id, mk)
  if (comp.attendance == null && mi.attendance != null && mi.attendance !== '') comp.attendance = clamp(Number(mi.attendance), 0, 100)
  comp.kpi = empKpiScore(s, emp, mk)
  comp.training = trainingScore(s, emp.id, akademi)
  comp.review = feedbackScore(s, emp.id, mk)
  if (comp.review == null && mi.review != null && mi.review !== '') comp.review = clamp(Number(mi.review), 0, 100)
  comp.discipline = disciplineScore(s, emp.id, mk)
  comp.teamwork = reviewAspectScore(s, emp.id, mk, ['Attitude', 'Communication'])
  if (comp.teamwork == null && mi.teamwork != null && mi.teamwork !== '') comp.teamwork = clamp(Number(mi.teamwork), 0, 100)
  comp.initiative = reviewAspectScore(s, emp.id, mk, ['Initiative', 'Ownership'])
  if (comp.initiative == null && mi.initiative != null && mi.initiative !== '') comp.initiative = clamp(Number(mi.initiative), 0, 100)

  let sum = 0
  let dataFilled = 0
  let totalW = 0
  for (const k of ['attendance', 'kpi', 'training', 'review', 'discipline', 'teamwork', 'initiative']) {
    const w = W[k] || 0
    totalW += w
    let v = comp[k]
    if (v == null) v = dflt
    else dataFilled += w
    comp[`${k}_used`] = v
    sum += Math.min(v, 100) * w
  }
  const score = totalW ? sum / totalW : 0
  return { score, comp, completeness: totalW ? Math.round((dataFilled / totalW) * 100) : 0 }
}

/** Only the fields the engine needs; a full employee satisfies it. */
interface EmployeeLike { id: string, divId: string, appRole?: string }

export function gradeOf(s: HrState, score: number): string {
  const g = s.settings.grades.slice().sort((a, b) => b.min - a.min).find(x => score >= x.min)
  return g ? g.g : 'D'
}

export interface GradeInfo { kurang: boolean, grade: string, tone: 'success' | 'gold' | 'warning' | 'error' | 'neutral' }

/** Grade + whether the data is too thin to rank (`gradeTag`, :1406). */
export function gradeInfo(s: HrState, score: number, completeness?: number): GradeInfo {
  if (completeness != null && completeness < SCORE_MIN_COMPLETENESS) return { kurang: true, grade: 'data kurang', tone: 'neutral' }
  const grade = gradeOf(s, score)
  const tone = score >= 85 ? 'success' : score >= 70 ? 'gold' : score >= 60 ? 'warning' : 'error'
  return { kurang: false, grade, tone }
}

// ---------------------------------------------------------------- discipline escalation (:2242)

/** Highest SP still inside its validity window (`activeSP`, :2242). */
export function activeSP(s: HrState, empId: string): string {
  const cutoff = geserBulan(hariIni().slice(0, 7), -s.settings.spRules.spValidMonths)
  const sps = s.violations
    .filter(v => v.empId === empId && v.sp && v.status !== 'Dibatalkan' && bulanDariTgl(v.date) >= cutoff)
    .map(v => v.sp)
  if (sps.includes('SP3')) return 'SP3'
  if (sps.includes('SP2')) return 'SP2'
  if (sps.includes('SP1')) return 'SP1'
  return ''
}

/** The system only SUGGESTS the next SP (`suggestSP`, :2250, F.8). */
export function suggestSP(s: HrState, empId: string): string {
  const cutoff = geserBulan(hariIni().slice(0, 7), -s.settings.spRules.spValidMonths)
  const vios = s.violations.filter(v => v.empId === empId && v.status !== 'Dibatalkan' && bulanDariTgl(v.date) >= cutoff)
  const cur = activeSP(s, empId)
  const berat = vios.some(v => v.severity === 'Berat')
  const ringanCnt = vios.filter(v => v.severity === 'Ringan').length
  const sedangCnt = vios.filter(v => v.severity === 'Sedang').length
  if (cur === 'SP2' && (berat || sedangCnt >= 3)) return 'SP3'
  if (cur === 'SP1' && (berat || sedangCnt >= 2)) return 'SP2'
  if (!cur && (berat || sedangCnt >= 2 || ringanCnt >= s.settings.spRules.ringanToSP1)) return 'SP1'
  return ''
}

// ---------------------------------------------------------------- certificate (:2155)

/** Highest issued number + 1, per year (`nextCertNo`, :2155, F.16). */
export function nextCertNo(s: HrState, dateStr: string): string {
  const yr = (dateStr && dateStr.slice(0, 4)) || String(new Date().getFullYear())
  const prefix = `LM-CERT-${yr}-`
  const used = new Set(s.trainingRecords.map(r => r.certNo).filter(Boolean) as string[])
  let max = 0
  used.forEach((no) => {
    if (!String(no).startsWith(prefix)) return
    const n = Number.parseInt(String(no).slice(prefix.length), 10)
    if (!Number.isNaN(n) && n > max) max = n
  })
  let n = max + 1
  let cand = prefix + String(n).padStart(3, '0')
  while (used.has(cand)) {
    n++
    cand = prefix + String(n).padStart(3, '0')
  }
  return cand
}

// ---------------------------------------------------------------- calendar (:2522)

export interface ItemKalenderHr { id?: string, date: string, title: string, kind: string, note?: string }

/** Stored agendas + automatic birthdays/contracts/probations (`calendarItems`, :2522, F.11). */
export function calendarItemsHr(s: HrState, ref = new Date()): ItemKalenderHr[] {
  const out: ItemKalenderHr[] = s.calendar.map(ev => ({ date: ev.date, title: ev.title, kind: ev.kind, note: ev.note, id: ev.id }))
  const yr = ref.getFullYear()
  for (const e of s.employees.filter(x => x.status === 'Aktif')) {
    if (e.birthDate) out.push({ date: `${yr}-${e.birthDate.slice(5)}`, title: `Ulang tahun ${e.name}`, kind: 'Birthday' })
    if (e.contractEnd) out.push({ date: e.contractEnd, title: `Kontrak habis: ${e.name}`, kind: 'Kontrak', note: 'Putuskan perpanjang/evaluasi H-30' })
    if (e.probationEnd) out.push({ date: e.probationEnd, title: `Probation selesai: ${e.name}`, kind: 'Probation' })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------- insights (:1452)

export interface InsightHr { sev: 'warn' | 'bad' | 'info', text: string, act: string, empId?: string }

/**
 * Fixed rules — score drop, violations piling, training behind, contract/coaching
 * deadlines. The caller passes `scopeEmps` results so a plain crew member never
 * sees a co-worker's data (F.11).
 */
export function buildInsights(s: HrState, mk: string, scope: HrEmployee[], akademi: Record<string, HrAkademiStat> | null, hariIni: string): InsightHr[] {
  const prev = geserBulan(mk, -1)
  const out: InsightHr[] = []
  for (const e of scope) {
    if (e.appRole === 'ceo') continue
    const now = peopleScore(s, e, mk, akademi)
    const was = peopleScore(s, e, prev, akademi)
    if (now.completeness >= SCORE_MIN_COMPLETENESS && was.completeness >= SCORE_MIN_COMPLETENESS && was.score - now.score >= 8) {
      out.push({ sev: 'warn', act: 'coach', empId: e.id, text: `${e.name}: People Score turun ${Math.round((was.score - now.score) * 10) / 10} poin dari bulan lalu (${Math.round(was.score * 10) / 10} → ${Math.round(now.score * 10) / 10}). Rekomendasi: jadwalkan coaching minggu ini.` })
    }
    const vio = s.violations.filter(v => v.empId === e.id && bulanDariTgl(v.date) === mk && v.status !== 'Dibatalkan')
    if (vio.length >= 2) out.push({ sev: 'bad', act: 'disc', empId: e.id, text: `${e.name}: ${vio.length} pelanggaran bulan ini. Cek modul Disiplin. Kemungkinan perlu SP sesuai aturan eskalasi.` })
    const ts = trainingScore(s, e.id, akademi)
    if (ts != null && ts < 50) out.push({ sev: 'info', act: 'training', empId: e.id, text: `${e.name}: training wajib baru ${Math.round(ts)}% selesai. Assign ulang di Training Center.` })
  }
  for (const e of scope.filter(x => x.contractEnd)) {
    const days = Math.round((new Date(e.contractEnd).getTime() - new Date(hariIni).getTime()) / 86400000)
    if (days >= 0 && days <= 45) out.push({ sev: 'warn', act: 'emp', empId: e.id, text: `Kontrak ${e.name} habis ${e.contractEnd} (${days} hari lagi). Putuskan perpanjang / evaluasi.` })
  }
  const cnt = s.coachings.filter(c => c.status !== 'Selesai' && c.deadline && c.deadline < hariIni).length
  if (cnt) out.push({ sev: 'warn', act: 'coach', text: `${cnt} action plan coaching lewat deadline dan belum di-follow up.` })
  return out.slice(0, 8)
}
