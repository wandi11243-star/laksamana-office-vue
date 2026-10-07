// HR (Staff Performance) — types, defaults and pure helpers of the old
// People OS (laksamana-office deploy/hr/index.html). No Vue, no API.
//
// The score engine lives in utils/people-score.ts (owned by this module,
// PLAN.md §4); this file holds the document shape, the seed defaults, the
// permission map and the roster-matching helpers used by the composable.
//
// Concurrency note: the server guards the WHOLE document with one rev
// (laksamana-api/docs/api/hr.md §Concurrency), so screens send If-Match on
// every write; that plumbing is in composables/useHr.ts.
import type { Me } from '~/composables/useMe'
import { hariIni } from '~/utils/format'

// ---------------------------------------------------------------- types

export interface HrDivisi {
  id: string
  name: string
  color?: string
}

export type AppRole = 'ceo' | 'hr' | 'manager' | 'staff'

export interface HrEmployee {
  id: string
  name: string
  role: string
  divId: string
  level: string
  appRole: AppRole | string
  joinDate: string
  birthDate: string
  status: string
  phone: string
  email: string
  notes: string
  probationEnd: string
  contractEnd: string
  talentaId?: string
  [k: string]: unknown
}

export interface HrKpiItem { id: string, name: string, weight: number, target: number, unit: string, dir: 'up' | 'down' }
export interface HrKpiTemplate { id: string, divId: string, items: HrKpiItem[] }

export interface HrKeyResult { id: string, name: string, target: number, unit: string, progress: number }
export interface HrOkr { id: string, ownerType: string, ownerId: string, period: string, objective: string, keyResults: HrKeyResult[] }

export interface HrReviewLayer { aspects?: Record<string, number | string>, comment?: string }
export interface HrReview { id: string, empId: string, month: string, layers: Record<string, HrReviewLayer>, status?: string }

export interface HrCompetency { id: string, empId: string, skills: { name: string, level: number }[] }
export interface HrTraining { id: string, title: string, divId: string, type: string, desc: string, passingGrade: number, mandatory: boolean, durasi?: number }
export interface HrTrainingRecord { id: string, trainingId: string, empId: string, status: string, score: number | null, date: string, certNo?: string }
export interface HrCoaching { id: string, empId: string, coachId: string, date: string, problem: string, actionPlan: string, deadline: string, followUp: string, status: string }
export interface HrReward { id: string, empId: string, date: string, type: string, points: number, reason: string, badge?: string }
export interface HrBadge { id: string, empId: string, month: string, badge: string, note: string }
export interface HrViolation { id: string, empId: string, date: string, type: string, severity: string, note: string, sp: string, status: string }
export interface HrFeedback { id: string, empId: string, date: string, kind: string, note: string, source: string }
export interface HrCareerPath { id: string, track: string, steps: string[], req: string }
export interface HrSuccession { id: string, position: string, empId: string, readiness: string, gap: string }
export interface HrMood { id: string, empId: string, date: string, mood: number | null }
export interface HrSuggestion { id: string, empId: string | null, date: string, text: string, status: string, response: string }
export interface HrCalendar { id: string, date: string, title: string, kind: string, note: string }
export interface HrAudit { id: string, at: string, userId: string, userName: string, action: string, detail: string }

export interface HrAttendanceDay {
  talentaId: string
  empId: string
  date: string
  shift: string
  code: string
  checkIn: string
  checkOut: string
  lateMin: number
  org?: string
  resign?: string
}

export interface HrAttendanceMonth {
  fileName: string
  importedAt: string
  importedBy: string
  unmatched: { talentaId: string, name: string, org: string }[]
  days: HrAttendanceDay[]
}

export interface HrAttendanceRules {
  lateToleranceMin: number
  lateCapMin: number
  noCheckoutCredit: number
  excusedCaps: Record<string, number>
  excusedCodes: string[]
  offShifts: string[]
  offShiftContains: string[]
  weights: { presence: number, punctuality: number }
}

export interface HrSettings {
  venueName: string
  scoreWeights: Record<string, number>
  grades: { g: string, min: number }[]
  violationDeduct: Record<string, number>
  spRules: { ringanToSP1: number, spValidMonths: number }
  passingGrade: number
  reviewLayerWeights: Record<string, number>
  defaultComponentScore: number
  pointRules: Record<string, number>
  attendanceRules: HrAttendanceRules
  [k: string]: unknown
}

export interface HrState {
  version: number
  settings: HrSettings
  divisions: HrDivisi[]
  employees: HrEmployee[]
  kpiTemplates: HrKpiTemplate[]
  kpiActuals: Record<string, Record<string, Record<string, number | null>>>
  monthlyInputs: Record<string, Record<string, Record<string, unknown>>>
  attendance: Record<string, HrAttendanceMonth>
  okrs: HrOkr[]
  reviews: HrReview[]
  competencies: HrCompetency[]
  trainings: HrTraining[]
  trainingRecords: HrTrainingRecord[]
  coachings: HrCoaching[]
  rewards: HrReward[]
  badges: HrBadge[]
  violations: HrViolation[]
  feedbacks: HrFeedback[]
  careerPaths: HrCareerPath[]
  successions: HrSuccession[]
  moods: HrMood[]
  suggestions: HrSuggestion[]
  calendar: HrCalendar[]
  audit: HrAudit[]
  [k: string]: unknown
}

/** Akademi `GET /training-stats` rows: completion per Office user id. */
export interface HrAkademiStat { mandPct?: number | null, mandTotal?: number, mandDone?: number, total?: number, done?: number, certified?: number }

// ---------------------------------------------------------------- constants

export const ROLE_LABEL: Record<string, string> = { ceo: 'CEO / Nahkoda', hr: 'HRD', manager: 'Manager', staff: 'Kru' }

/** The four layers of a review (D.6). */
export const REVIEW_ASPECTS = ['Skill', 'Knowledge', 'Attitude', 'Leadership', 'Discipline', 'Communication', 'Problem Solving', 'Ownership', 'Integrity', 'Initiative', 'Creativity', 'Customer Service']

export const BADGE_LIST = ['Employee of the Month', 'Top Attendance', 'Best Sales', 'Best SOP', 'Best Teamwork', 'Most Helpful', 'Customer Favorite', 'Best Improvement', 'Fastest Service', 'Cleanliness Champion', 'Best Leader', 'Best Service']

export const VIO_TYPES = ['Terlambat', 'Absen tanpa izin', 'Merokok di area kerja', 'Tidak pakai seragam', 'Komplain pelanggan', 'Selisih kas', 'Pelanggaran SOP', 'Sikap tidak profesional', 'Lainnya']

/** Values only; the Lucide icon per mood is chosen in the component. */
export const MOODS = [1, 2, 3, 4, 5]

export const SCORE_MIN_COMPLETENESS = 40
/** Suggestions only leak an individual below this count (`:2325`). */
export const MOOD_MIN_N = 3

// ---------------------------------------------------------------- defaults (seed)

const div = (id: string, name: string, color: string): HrDivisi => ({ id, name, color })

const kpi = (id: string, divId: string, items: [string, number, number, string, 'up' | 'down'][]): HrKpiTemplate => ({
  id,
  divId,
  items: items.map((it, i) => ({ id: `${id}_i${i}`, name: it[0], weight: it[1], target: it[2], unit: it[3], dir: it[4] })),
})

export const DIVISI_BAWAAN: HrDivisi[] = [
  div('d_mgmt', 'Management', '#0B1F33'),
  div('d_kitchen', 'Kitchen', '#C0392B'),
  div('d_bar', 'Bar', '#B8893A'),
  div('d_store', 'Store / Service', '#1E8E5A'),
  div('d_marketing', 'Marketing & Digital', '#2563EB'),
  div('d_finance', 'Finance', '#7C3AED'),
  div('d_event', 'Event', '#DB2777'),
  div('d_hrga', 'HR / GA / Legal', '#0891B2'),
]

export const KPI_BAWAAN: HrKpiTemplate[] = [
  kpi('kpit_kitchen', 'd_kitchen', [['Food Cost', 30, 30, '%', 'down'], ['Kecepatan Penyajian (menit)', 15, 15, 'mnt', 'down'], ['Waste', 20, 3, '%', 'down'], ['Hygiene Audit', 20, 90, 'skor', 'up'], ['Kepatuhan SOP', 15, 90, 'skor', 'up']]),
  kpi('kpit_bar', 'd_bar', [['Beverage Cost', 30, 22, '%', 'down'], ['Speed of Service (menit)', 20, 7, 'mnt', 'down'], ['Upselling', 25, 15, 'juta', 'up'], ['Konsistensi Rasa (QC pass)', 25, 90, '%', 'up']]),
  kpi('kpit_marketing', 'd_marketing', [['Reach (ribu)', 20, 500, 'rb', 'up'], ['Leads / Inquiry', 25, 60, 'leads', 'up'], ['Konten Terbit', 20, 30, 'konten', 'up'], ['Closing Sponsor/Partner', 35, 50, 'juta', 'up']]),
  kpi('kpit_finance', 'd_finance', [['Ketepatan Laporan (on-time)', 35, 100, '%', 'up'], ['Umur Piutang (hari)', 30, 14, 'hari', 'down'], ['Cash Accuracy', 35, 100, '%', 'up']]),
  kpi('kpit_store', 'd_store', [['Omzet vs Target', 30, 100, '%', 'up'], ['Komplain Pelanggan (kasus)', 20, 2, 'kasus', 'down'], ['Rating Google', 25, 4.7, '★', 'up'], ['Repeat Customer', 25, 30, '%', 'up']]),
  kpi('kpit_event', 'd_event', [['Event Terlaksana', 25, 4, 'event', 'up'], ['Uplift Revenue Event', 35, 100, '% target', 'up'], ['Kepuasan Klien Event', 25, 90, 'skor', 'up'], ['On-time Rundown', 15, 90, '%', 'up']]),
]

export const SETTING_BAWAAN: HrSettings = {
  venueName: 'Laksamana Muda Coffee & Live Space',
  scoreWeights: { attendance: 20, kpi: 30, training: 10, review: 15, discipline: 10, teamwork: 10, initiative: 5 },
  grades: [{ g: 'A+', min: 90 }, { g: 'A', min: 85 }, { g: 'B+', min: 80 }, { g: 'B', min: 70 }, { g: 'C', min: 60 }, { g: 'D', min: 0 }],
  violationDeduct: { Ringan: 5, Sedang: 15, Berat: 30 },
  spRules: { ringanToSP1: 3, spValidMonths: 6 },
  passingGrade: 80,
  reviewLayerWeights: { self: 10, manager: 40, hr: 20, ceo: 30 },
  defaultComponentScore: 75,
  pointRules: { badge: 50, trainingPass: 20, eom: 150 },
  attendanceRules: {
    lateToleranceMin: 15,
    lateCapMin: 45,
    noCheckoutCredit: 0.5,
    excusedCaps: { I: 3, S: 2 },
    excusedCodes: ['OTL', 'CT', 'CKM'],
    offShifts: ['dayoff', 'National Holiday'],
    offShiftContains: ['dayoff', 'day off', 'libur', 'holiday'],
    weights: { presence: 70, punctuality: 30 },
  },
}

export const CAREER_BAWAAN: Omit<HrCareerPath, 'id'>[] = [
  { track: 'Service', steps: ['Junior Waiter', 'Senior Waiter', 'Captain', 'Supervisor', 'Store Manager'], req: 'Attendance >95%, KPI >85, Training wajib lulus, Tanpa SP aktif, Min. 1 tahun di level' },
  { track: 'Bar', steps: ['Bar Crew', 'Barista', 'Senior Barista', 'Head Bar'], req: 'Sertifikasi Coffee Knowledge, KPI >85, Kompetensi rata-rata ≥4★' },
  { track: 'Kitchen', steps: ['Cook Helper', 'Cook', 'Senior Cook', 'Sous Chef', 'Head Chef'], req: 'Hygiene Test lulus, Food cost dalam target 3 bulan, Tanpa SP aktif' },
]

// ---------------------------------------------------------------- normalise

const daftar = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : [])

/** Fill whatever the stored document does not have yet (`migrate`, :576). */
export function normalHr(raw: unknown): HrState {
  const d = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const setelan = (d.settings && typeof d.settings === 'object') ? d.settings as Record<string, unknown> : {}
  const settings = { ...SETTING_BAWAAN, ...setelan } as HrSettings
  // Nested objects the old `migrate` fills one key at a time.
  settings.scoreWeights = { ...SETTING_BAWAAN.scoreWeights, ...(setelan.scoreWeights as Record<string, number> | undefined) }
  settings.reviewLayerWeights = { ...SETTING_BAWAAN.reviewLayerWeights, ...(setelan.reviewLayerWeights as Record<string, number> | undefined) }
  settings.pointRules = { ...SETTING_BAWAAN.pointRules, ...(setelan.pointRules as Record<string, number> | undefined) }
  settings.violationDeduct = { ...SETTING_BAWAAN.violationDeduct, ...(setelan.violationDeduct as Record<string, number> | undefined) }
  settings.spRules = { ...SETTING_BAWAAN.spRules, ...(setelan.spRules as Record<string, number> | undefined) }
  settings.attendanceRules = {
    ...SETTING_BAWAAN.attendanceRules,
    ...(setelan.attendanceRules as Partial<HrAttendanceRules> | undefined),
    excusedCaps: { ...SETTING_BAWAAN.attendanceRules.excusedCaps, ...((setelan.attendanceRules as Partial<HrAttendanceRules> | undefined)?.excusedCaps) },
    weights: { ...SETTING_BAWAAN.attendanceRules.weights, ...((setelan.attendanceRules as Partial<HrAttendanceRules> | undefined)?.weights) },
  }
  settings.grades = daftar<HrSettings['grades'][number]>(setelan.grades).length ? setelan.grades as HrSettings['grades'] : SETTING_BAWAAN.grades

  return {
    ...d,
    version: Number(d.version) || 1,
    settings,
    divisions: daftar<HrDivisi>(d.divisions).length ? d.divisions as HrDivisi[] : DIVISI_BAWAAN.map(x => ({ ...x })),
    employees: daftar<HrEmployee>(d.employees),
    kpiTemplates: daftar<HrKpiTemplate>(d.kpiTemplates).length ? d.kpiTemplates as HrKpiTemplate[] : KPI_BAWAAN.map(t => ({ ...t, items: t.items.map(i => ({ ...i })) })),
    kpiActuals: (d.kpiActuals && typeof d.kpiActuals === 'object') ? d.kpiActuals as HrState['kpiActuals'] : {},
    monthlyInputs: (d.monthlyInputs && typeof d.monthlyInputs === 'object') ? d.monthlyInputs as HrState['monthlyInputs'] : {},
    attendance: (d.attendance && typeof d.attendance === 'object') ? d.attendance as HrState['attendance'] : {},
    okrs: daftar<HrOkr>(d.okrs),
    reviews: daftar<HrReview>(d.reviews),
    competencies: daftar<HrCompetency>(d.competencies),
    trainings: daftar<HrTraining>(d.trainings),
    trainingRecords: daftar<HrTrainingRecord>(d.trainingRecords),
    coachings: daftar<HrCoaching>(d.coachings),
    rewards: daftar<HrReward>(d.rewards),
    badges: daftar<HrBadge>(d.badges),
    violations: daftar<HrViolation>(d.violations),
    feedbacks: daftar<HrFeedback>(d.feedbacks),
    careerPaths: daftar<HrCareerPath>(d.careerPaths).length
      ? d.careerPaths as HrCareerPath[]
      : CAREER_BAWAAN.map((c, i) => ({ ...c, id: `cp_bawaan_${i}` })),
    successions: daftar<HrSuccession>(d.successions),
    moods: daftar<HrMood>(d.moods),
    suggestions: daftar<HrSuggestion>(d.suggestions),
    calendar: daftar<HrCalendar>(d.calendar),
    audit: daftar<HrAudit>(d.audit),
  }
}

// ---------------------------------------------------------------- lookups

export const empById = (s: HrState, id: string) => s.employees.find(e => e.id === id)
export const divById = (s: HrState, id: string) => s.divisions.find(d => d.id === id)
export const divName = (s: HrState, id: string) => divById(s, id)?.name ?? '-'
export const activeEmps = (s: HrState) => s.employees.filter(e => e.status === 'Aktif')
export const kpiTemplateFor = (s: HrState, divId: string) => s.kpiTemplates.find(t => t.divId === divId)

// ---------------------------------------------------------------- permissions (A)

export type HrPerm = 'manageOps' | 'manageEmployees' | 'manageSettings' | 'inputKpi' | 'manageReview' | 'manageTraining' | 'manageReward' | 'manageDiscipline' | 'manageCareer' | 'seeAll' | 'coach' | 'viewAudit' | 'exportData'

const PERM_ROLE: Partial<Record<HrPerm, AppRole[]>> = {
  manageEmployees: ['ceo', 'hr'],
  manageSettings: ['ceo', 'hr'],
  inputKpi: ['ceo', 'hr', 'manager'],
  manageReview: ['ceo', 'hr', 'manager'],
  manageTraining: ['ceo', 'hr', 'manager'],
  manageReward: ['ceo', 'hr', 'manager'],
  manageDiscipline: ['ceo', 'hr'],
  manageCareer: ['ceo', 'hr'],
  seeAll: ['ceo', 'hr'],
  coach: ['ceo', 'hr', 'manager'],
  viewAudit: ['ceo', 'hr'],
  exportData: ['ceo', 'hr'],
}

/**
 * `can(perm)` (:676). `manageOps` uses the OFFICE module-admin flag, not the
 * in-app role — superadmin or an hr module admin only. Pass
 * `isAdminOf(me, 'hr')` from the session.
 */
export function canHr(perm: HrPerm, cu: HrEmployee | null, officeHrAdmin: boolean): boolean {
  if (!cu) return false
  if (perm === 'manageOps') return officeHrAdmin
  return (PERM_ROLE[perm] ?? []).includes(cu.appRole as AppRole)
}

/**
 * Which employees this viewer may see (D. B / F.9):
 * seeAll → every active; a manager with a division → that division; anyone
 * else → themself. A manager with NO division deliberately sees only
 * themself, never everyone without a division (:699).
 */
export function scopeEmps(s: HrState, cu: HrEmployee | null, officeHrAdmin = false): HrEmployee[] {
  const aktif = activeEmps(s)
  if (!cu) return []
  if (canHr('seeAll', cu, officeHrAdmin)) return aktif
  if (cu.appRole === 'manager' && cu.divId) return aktif.filter(e => e.divId === cu.divId)
  return aktif.filter(e => e.id === cu.id)
}

export const isOfficeHrAdmin = (me: Me | null) => !!me && (me.adminModules.includes('hr') || me.adminModules.includes('*'))

// ---------------------------------------------------------------- roster matching (F.14/F.15)

export const normName = (n: unknown) => String(n || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Find this session's employee record (`findEmployeeForSession`, :746):
 * Office id first, then Talenta id, then exact name, then a single loose
 * first-name match. Never guesses when two candidates share a name.
 */
export function cariKruSesi(s: HrState, sesi: { userId: string, name: string, talentaId?: string }): HrEmployee | null {
  const byId = s.employees.find(x => x.id === sesi.userId)
  if (byId) return byId
  const tid = String(sesi.talentaId ?? '')
  if (tid) {
    const byTid = s.employees.filter(x => String(x.talentaId ?? '') === tid)
    if (byTid.length === 1) return byTid[0]!
  }
  const bukanOrangLain = (x: HrEmployee) => !tid || !x.talentaId || String(x.talentaId) === tid
  const target = normName(sesi.name)
  const exact = s.employees.filter(x => normName(x.name) === target && bukanOrangLain(x))
  if (exact.length === 1) return exact[0]!
  const first = target.split(' ')[0]
  if (first) {
    const loose = s.employees.filter(x => normName(x.name).split(' ')[0] === first && bukanOrangLain(x))
    if (loose.length === 1) return loose[0]!
  }
  return null
}

/** Move every empId reference from old to new (`reassignEmployeeId`, :785). */
export function pindahIdKru(s: HrState, oldId: string, newId: string): void {
  if (!oldId || !newId || oldId === newId) return
  for (const e of s.employees) if (e.id === oldId) e.id = newId
  const koleksi: { empId?: unknown }[][] = [s.reviews, s.competencies, s.trainingRecords, s.coachings, s.rewards, s.badges, s.violations, s.feedbacks, s.successions, s.moods, s.suggestions]
  for (const list of koleksi) for (const r of list) if (r && r.empId === oldId) r.empId = newId
  for (const c of s.coachings) if (c.coachId === oldId) c.coachId = newId
  for (const o of s.okrs) if (o.ownerType === 'emp' && o.ownerId === oldId) o.ownerId = newId
  for (const a of s.audit) if (a.userId === oldId) a.userId = newId
  if (s.monthlyInputs[oldId]) {
    s.monthlyInputs[newId] = s.monthlyInputs[oldId]!
    const sisa: typeof s.monthlyInputs = {}
    for (const k of Object.keys(s.monthlyInputs)) {
      if (k !== oldId) sisa[k] = s.monthlyInputs[k]!
    }
    s.monthlyInputs = sisa
  }
}

/**
 * Merge duplicate records that share the SAME non-empty Talenta id
 * (`gabungKembarTalenta`, :811); the winner is the one with the most history.
 */
export function gabungKembarTalenta(s: HrState): boolean {
  const perTid: Record<string, HrEmployee[]> = {}
  for (const e of s.employees) {
    const t = String(e.talentaId ?? '').trim()
    if (t) (perTid[t] = perTid[t] ?? []).push(e)
  }
  let berubah = false
  for (const grup of Object.values(perTid)) {
    if (grup.length < 2) continue
    const skor = (e: HrEmployee) => s.reviews.filter(r => r.empId === e.id).length
      + s.trainingRecords.filter(r => r.empId === e.id).length
      + s.violations.filter(r => r.empId === e.id).length
      + (s.monthlyInputs[e.id] ? 5 : 0)
    const menang = grup.slice().sort((a, b) => skor(b) - skor(a))[0]!
    for (const e of grup) {
      if (e === menang) continue
      pindahIdKru(s, e.id, menang.id)
      berubah = true
    }
    const lihat = new Set<string>()
    s.employees = s.employees.filter((e) => {
      if (e.id !== menang.id) return true
      if (lihat.has(e.id)) return false
      lihat.add(e.id)
      return true
    })
  }
  return berubah
}

/**
 * Drop ghost crew that Office no longer has AND that carry no history at all
 * (`buangYatimRoster`, :858). Four guards, all needed.
 */
export function buangYatimRoster(s: HrState, members: { id: string }[], cuId: string): string[] {
  if (!Array.isArray(members) || !members.length) return []
  const diOffice = new Set(members.map(m => m?.id).filter(Boolean) as string[])
  const punyaRiwayat = (id: string) => {
    const cek: { empId?: unknown, coachId?: unknown }[][] = [s.reviews, s.competencies, s.trainingRecords, s.coachings, s.rewards, s.badges, s.violations, s.feedbacks, s.successions, s.moods, s.suggestions]
    if (cek.some(list => list.some(r => r && (r.empId === id || r.coachId === id)))) return true
    if (s.okrs.some(o => o.ownerType === 'emp' && o.ownerId === id)) return true
    if (s.monthlyInputs[id]) return true
    for (const mk of Object.keys(s.attendance)) {
      if ((s.attendance[mk]?.days ?? []).some(dd => dd?.empId === id)) return true
    }
    return false
  }
  const buang = s.employees.filter(e => !diOffice.has(e.id) && !punyaRiwayat(e.id) && e.id !== cuId)
  if (!buang.length) return []
  s.employees = s.employees.filter(e => !buang.includes(e))
  return buang.map(e => e.name)
}

/** The legacy "klaim" step: bind a name-matched record to the Office id. */
export function klaimKruSesi(s: HrState, cu: HrEmployee, userId: string): boolean {
  if (cu.id === userId) return false
  pindahIdKru(s, cu.id, userId)
  return true
}

// ---------------------------------------------------------------- audit

export const logAksi = (s: HrState, cu: HrEmployee | null, action: string, detail = '') => {
  s.audit.unshift({ id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), userId: cu?.id ?? '-', userName: cu?.name ?? '-', action, detail })
  if (s.audit.length > 800) s.audit.length = 800
}

// ---------------------------------------------------------------- dates

export const bulanDariHr = (tgl?: string) => (tgl || hariIni()).slice(0, 7)

export const hariIniHr = hariIni
