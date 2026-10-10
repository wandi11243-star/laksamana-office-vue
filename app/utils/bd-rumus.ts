// BD OS screen maths — pure functions, no Vue, no API.
//
// Faithful port of the browser-side calculations of the old Panel
// (laksamana-office/deploy/bd/index.html). They MUST stay client-side: the API
// stores rows and the old client derived every one of these while drawing. Each
// function names the old source line it comes from.
//
// Dates always go through the local helpers below, never `Date#toISOString()`:
// that is UTC and in WIB anything before 07:00 is reported as yesterday, which
// would mark tasks overdue every morning (deploy/bd/index.html:767-772).
import type { BdApproverSet, BdPo, BdPerson, BdPr, BdProject, BdSubtask, BdTask } from '~/composables/useBd'
import { BLN, fTglP, hariIni } from '~/utils/format'

// ─────────────────────────── organisation (deploy/bd/index.html:708-755) ──
/** `OWNER_DIVS` — the divisions whose work BD OS manages. */
export const OWNER_DIVS = ['Business Development', 'Project', 'Purchasing']
/** `COORD_DIVS` — the other divisions, the destinations of a coordination request. */
export const COORD_DIVS = ['Kitchen', 'Bar', 'Marketing', 'Finance', 'Event', 'Floor', 'HR']
/** `STATUS_FLOW` — the four Kanban columns (putaran keempat, 7 Okt 2026). */
export const STATUS_FLOW = ['To Do', 'Doing', 'Review', 'Done']
/** `STATUS_LAMA` — read mapping for rows written before the fourth round. */
export const STATUS_LAMA: Record<string, string> = { Backlog: 'To Do', Waiting: 'Doing' }
/**
 * `normalize` (status part) — an old or unknown status never leaves a card
 * column-less: unknown statuses fall to To Do, where they are seen.
 */
export function normalisasiStatus(status?: string): string {
  if (status && STATUS_LAMA[status]) return STATUS_LAMA[status]!
  if (status && STATUS_FLOW.includes(status)) return status
  return 'To Do'
}
/** `PRIORITAS`. */
export const PRIORITAS = ['Urgent', 'High', 'Medium', 'Low']
/** `PROJ_STAGES`. */
export const PROJ_STAGES = ['Idea', 'Planning', 'Running', 'Review', 'Completed']
/** `PROJ_HEALTH` keys. */
export const PROJ_HEALTH = ['on-track', 'at-risk', 'off-track']
/** `COORD_FLOW`. */
export const COORD_FLOW = ['Diminta', 'Diproses', 'Review', 'Selesai']
/** `PO_FLOW`. */
export const PO_FLOW = ['Draft', 'Diajukan', 'Approved', 'Dibeli', 'Diterima']

/**
 * USelect (Radix SelectItem) refuses an empty-string option value, so the old
 * "all / none" options use these sentinels in the UI. Filters compare against
 * `PILIHAN_SEMUA`; forms map `PILIHAN_TANPA` back to `''`/`null` before saving —
 * the API stores "no project / no division / no boss" exactly like the old client.
 */
export const PILIHAN_SEMUA = '__semua__'
export const PILIHAN_TANPA = '__tanpa__'
/** `PR_FLOW`. */
export const PR_FLOW = ['Draft', 'Diajukan', 'Disetujui', 'Selesai']
/** `PO_SELESAI` — the final stage, written once. */
export const PO_SELESAI = 'Diterima'
/** `TASK_TIPE`. */
export const TASK_TIPE = ['Ad-hoc', 'Rutin', 'Project']
/** `FREQ`. */
export const FREQ = ['Daily', 'Weekly', 'Monthly', 'Custom']
/** `AGENDA_TIPE`. */
export const AGENDA_TIPE = ['Meeting', 'Vendor', 'Internal', 'Deadline']
/** `PENYETUJU_BIBIT` — used ONCE, only while no signer set exists yet. */
export const PENYETUJU_BIBIT = ['Dina Mariana', 'Howandi Chandra', 'Wandi Pranata']

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** `isoOf` — a Date as a local "YYYY-MM-DD". */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** `todayISO`. */
export const todayISO = hariIni
/** `pDate` — "YYYY-MM-DD" as a local Date (never UTC). */
export function pDate(iso?: string): Date {
  const p = String(iso || '').split('-')
  return new Date(Number(p[0]) || 1970, (Number(p[1]) || 1) - 1, Number(p[2]) || 1)
}
/** `inDays`. */
export function inDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoOf(d)
}
/** `sisaHari` — days from today; 9999 when there is no date. */
export function sisaHari(iso?: string): number {
  if (!iso) return 9999
  const a = pDate(iso)
  a.setHours(0, 0, 0, 0)
  const b = new Date()
  b.setHours(0, 0, 0, 0)
  return Math.round((+a - +b) / 86400000)
}
/** `fDue` — "Hari ini", "Besok", "3h lewat", "5h lagi". */
export function fDue(iso?: string): string {
  if (!iso) return ''
  const n = sisaHari(iso)
  if (n === 0) return 'Hari ini'
  if (n === 1) return 'Besok'
  if (n === -1) return 'Kemarin'
  if (n < 0) return `${Math.abs(n)}h lewat`
  if (n <= 7) return `${n}h lagi`
  return fTglP(iso)
}

/** `ribuan` — a plain number with id-ID thousand separators. */
export const ribuan = (n: unknown) => (Number(n) || 0).toLocaleString('id-ID')
/** `fRp` — the abbreviated form ("Rp 5 jt"). Cards only, never the PR sheet. */
export function fRp(n: unknown): string {
  let v = Number(n) || 0
  const s = v < 0 ? '-' : ''
  v = Math.abs(v)
  if (v >= 1e9) return `${s}Rp ${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2).replace(/\.?0+$/, '')} M`
  if (v >= 1e6) return `${s}Rp ${Math.round(v / 1e6)} jt`
  if (v >= 1e3) return `${s}Rp ${Math.round(v / 1e3)}rb`
  return `${s}Rp ${v.toLocaleString('id-ID')}`
}
/** `fRpPenuh` — the full form, for the PR sheet and the item lists. */
export const fRpPenuh = (n: unknown) => `Rp ${ribuan(n)}`
/** `rzFormat` — a plain number to "1.985.000" for the realisation input. */
export function rzFormat(v: unknown): string {
  const d = String(v == null ? '' : v).replace(/[^0-9]/g, '')
  return d ? Number(d).toLocaleString('id-ID') : ''
}
/** `nowStamp` — "YYYY-MM-DD HH:MM", local device time. */
export function nowStamp(): string {
  const d = new Date()
  return `${isoOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** `fWaktu` — "27 Sep" or "27 Sep · 08:30". */
export function fWaktu(s?: string): string {
  const t = String(s || '')
  if (!t) return '—'
  const p = t.split(' ')
  return fTglP(p[0]) + (p[1] ? ` · ${p[1]}` : '')
}
/** `inisial` — up to two initials. */
export const inisial = (n?: string) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

// ─────────────────────────── Eisenhower & people ──

export type Kuadran = 'do' | 'schedule' | 'delegate' | 'delete'
export interface KuadranInfo { k: Kuadran, l: string, d: string }

/** `kuadran` — DERIVED from important+urgent, never stored (`:1316-1322`). */
export function kuadran(t: { important?: boolean, urgent?: boolean }): KuadranInfo {
  if (t.important && t.urgent) return { k: 'do', l: 'DO', d: 'Kerjakan sekarang' }
  if (t.important && !t.urgent) return { k: 'schedule', l: 'SCHEDULE', d: 'Jadwalkan' }
  if (!t.important && t.urgent) return { k: 'delegate', l: 'DELEGATE', d: 'Delegasikan / koordinasi' }
  return { k: 'delete', l: 'DELETE', d: 'Pertimbangkan hapus' }
}
/** `selesai`. */
export const selesai = (t: { status?: string }) => t.status === 'Done'
/** `lewat`. */
export const lewat = (t: { deadline?: string, status?: string }) => !!t.deadline && !selesai(t) && sisaHari(t.deadline) < 0

type BerPic = { pics?: string[], pic?: string }
/** `pics` — always an array, never null. */
export function pics(o?: BerPic | null): string[] {
  if (o && Array.isArray(o.pics)) return o.pics
  return o && o.pic ? [o.pic] : []
}
/** `punyaPic`. */
export const punyaPic = (o: BerPic | null | undefined, id: string) => pics(o).includes(id)
/** `setPics` — the ONLY place `pic` and `pics` are written, so they never drift. */
export function setPics(o: BerPic, daftar: string[]): void {
  o.pics = (daftar || []).filter((v, i, a) => v && a.indexOf(v) === i)
  o.pic = o.pics[0] || ''
}
/** `P(id)` — a person by row id, with a safe placeholder. */
export const orangById = (people: BdPerson[], id?: string | null): BdPerson =>
  people.find(p => p.id === id) || { id: '', name: '—', role: '', div: '' } as BdPerson
/** `jabatanOrang` — Office `ket`, fallback `role`, then "—" (never invented). */
export function jabatanOrang(p?: Pick<BdPerson, 'ket' | 'role'> | null): string {
  const t = String((p && p.ket) || '').trim() || String((p && p.role) || '').trim()
  return t ? t.toUpperCase() : '—'
}
/** `bawahan` — all reports, direct and indirect. */
export function bawahan(people: BdPerson[], id: string): string[] {
  let out: string[] = []
  people.forEach((p) => {
    if (p.boss === id) {
      out.push(p.id)
      out = out.concat(bawahan(people, p.id))
    }
  })
  return out
}
/** `lingkup` — null means "everything" (admin or no matching row). */
export function lingkupIds(people: BdPerson[], akuId?: string, admin = false): string[] | null {
  if (!akuId || admin) return null
  return [akuId, ...bawahan(people, akuId)]
}
/** `dalamLingkup` — visible when ANY of its PICs is in scope. */
export function dalamLingkup(o: BerPic, l: string[] | null): boolean {
  if (!l) return true
  return pics(o).some(id => l.includes(id))
}
/** `saringLingkup` — shared by Tasks, Projects and Calendar. */
export function saringLingkup<T extends BerPic>(daftar: T[], scope: string, l: string[] | null, akuId?: string): T[] {
  if (scope === 'semua') return daftar
  if (scope === 'saya') return akuId ? daftar.filter(o => punyaPic(o, akuId)) : daftar
  return daftar.filter(o => dalamLingkup(o, l))
}
/** `kenali` — the crew row of the signed-in user: officeUserId first, then name. */
export function cariAku(people: BdPerson[], me?: { id?: string, name?: string } | null): BdPerson | null {
  if (!me) return null
  return people.find(p => p.officeUserId && p.officeUserId === me.id)
    || people.find(p => String(p.name || '').toLowerCase() === String(me.name || '').toLowerCase())
    || null
}
/** `catIniAku` — the key of the daily-focus document. */
export function catIniAku(people: BdPerson[], meId?: string): string {
  const aku = people.find(p => p.officeUserId && p.officeUserId === meId)
  return aku ? aku.id : `office:${meId || '?'}`
}

// ─────────────────────────── Projects ──

/** `projTasks`. */
export const projTasks = (tasks: BdTask[], pid: string) => tasks.filter(t => t.project === pid)
/** `projProgress` — from tasks, fallback milestones, else 0 (`:1883-1888`). */
export function projProgress(p: BdProject, tasks: BdTask[]): number {
  const ts = projTasks(tasks, p.id)
  if (ts.length) return Math.round((ts.filter(selesai).length / ts.length) * 100)
  const m = p.milestones || []
  if (m.length) return Math.round((m.filter(x => x.done).length / m.length) * 100)
  return 0
}
/** `opsiProject` — Completed is not offered unless it is already linked. */
export function opsiProject(projects: BdProject[], terpilih?: string | null): { value: string, label: string }[] {
  const out: { value: string, label: string }[] = [{ value: PILIHAN_TANPA, label: '— tanpa project —' }]
  projects.forEach((p) => {
    const beres = p.stage === 'Completed'
    if (beres && p.id !== terpilih) return
    out.push({ value: p.id, label: p.name + (beres ? ' (selesai)' : '') })
  })
  return out
}

// ─────────────────────────── Weekly helpers ──
// Monday is the first day, the same as the calendar (`:3119-3128`).

export function awalMinggu(iso?: string): string {
  const d = pDate(iso || todayISO())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoOf(d)
}
export function geserMinggu(iso: string, n: number): string {
  const d = pDate(iso)
  d.setDate(d.getDate() + n * 7)
  return isoOf(d)
}
export function akhirMinggu(iso?: string): string {
  const d = pDate(awalMinggu(iso))
  d.setDate(d.getDate() + 6)
  return isoOf(d)
}
export function labelMinggu(senin: string): string {
  const m = pDate(senin)
  const a = new Date(m)
  a.setDate(a.getDate() + 6)
  return `${m.getDate()} ${BLN[m.getMonth()]} — ${a.getDate()} ${BLN[a.getMonth()]} ${a.getFullYear()}`
}

// ─────────────────────────── Purchasing ──

/** `poRequester` — `by` first, then the free-text `byName`, then `pic`. */
export function poRequester(p: BdPo, people: BdPerson[]): string {
  if (p.by && orangById(people, p.by).id) return orangById(people, p.by).name
  if (p.byName) return p.byName
  return p.pic ? orangById(people, p.pic).name : '—'
}
/** `poBeres` — processed marker OR the final status. */
export const poBeres = (p: BdPo) => !!p.proses || p.status === 'Diterima'
/** `prItems` — items point back through `prId` (one item, one home). */
export const prItems = (prId: string, po: BdPo[]) => po.filter(p => p.prId === prId)
/** `prBeres` — computed; an empty sheet is NEVER complete (`:3379-3382`). */
export function prBeres(prId: string, po: BdPo[]): boolean {
  const items = prItems(prId, po)
  return items.length > 0 && items.every(poBeres)
}
/** `prTotal`. */
export function prTotal(prId: string, po: BdPo[]): { grand: number, belum: number } {
  let grand = 0
  let belum = 0
  prItems(prId, po).forEach((p) => {
    const a = Number(p.amount) || 0
    grand += a
    if (!a) belum++
  })
  return { grand, belum }
}
/** `prNoBerikut` — highest + 1, never reused (`:3392-3398`). */
export function prNoBerikut(pr: BdPr[]): string {
  let maks = 0
  pr.forEach((x) => {
    const n = Number.parseInt(String(x.no), 10)
    if (!Number.isNaN(n) && n > maks) maks = n
  })
  return String(maks + 1)
}
/** `realisasiNum` — empty is NOT 0 (`:3806-3808`). */
export function realisasiNum(p?: Pick<BdPo, 'realisasi'> | null): number | null {
  const v = p && p.realisasi
  return v === '' || v === null || v === undefined ? null : (Number(v) || 0)
}
/** `overbudget` — amount − realisation; positive = saving (`:3810-3812`). */
export function overbudget(p: Pick<BdPo, 'realisasi' | 'amount'>): number | null {
  const r = realisasiNum(p)
  return r === null ? null : (Number(p.amount) || 0) - r
}
/**
 * `togglePoProses` fields — the marker MOVES the status to `Diterima` and keeps
 * the previous one in `statusSebelum`; cancelling restores it (`:3222-3237`).
 */
export function fieldsProses(p: BdPo, on: boolean, nama: string): Partial<BdPo> {
  if (on) {
    const out: Partial<BdPo> = { proses: true, prosesAt: Date.now(), prosesBy: nama || '' }
    if (p.status !== 'Diterima') {
      out.statusSebelum = p.status
      out.status = 'Diterima'
    }
    return out
  }
  const out: Partial<BdPo> = { proses: false, prosesAt: null, prosesBy: null, statusSebelum: null }
  if (p.status === 'Diterima' && p.statusSebelum) out.status = p.statusSebelum
  return out
}

// ─────────────────────────── Routine compliance ──

/** `vRoutine` average compliance over ACTIVE routines (`:2197-2198`). */
export function kepatuhanRoutine(routines: { active?: boolean, done?: number, total?: number }[]): number {
  const aktif = routines.filter(r => r.active)
  if (!aktif.length) return 100
  return Math.round((aktif.reduce((s, r) => s + (r.total ? (Number(r.done) || 0) / r.total : 1), 0) / aktif.length) * 100)
}
/** One routine's compliance (`:2211`). */
export const kepatuhanBaris = (r: { done?: number, total?: number }) => (r.total ? Math.round(((Number(r.done) || 0) / r.total) * 100) : 100)

// ─────────────────────────── Signers ──

/** The set a PR uses (`setPr`): its own `setId`, else the default. */
export function setPr(pr: BdPr | null | undefined, sets: BdApproverSet[]): BdApproverSet | undefined {
  return (pr && pr.setId && sets.find(x => x.id === pr.setId)) || sets.find(x => x.bawaan) || sets[0]
}
export interface Penyetuju { k: string, l: string, nama: string, pid: string }
/** `penyetujuPr` — signers of one PR, keyed by person id. */
export function penyetujuPr(pr: BdPr | null | undefined, sets: BdApproverSet[], people: BdPerson[]): Penyetuju[] {
  const set = setPr(pr, sets)
  return ((set && set.orang) || [])
    .map((pid) => {
      const p = people.find(x => x.id === pid)
      if (!p) return null
      return { k: p.id, l: jabatanOrang(p), nama: p.name || '—', pid: p.id }
    })
    .filter((x): x is Penyetuju => x !== null)
}
/** A person is allowed to approve if they are the signer OR a BD admin (browser-checked trace, not authorisation). */
export function bolehSetuju(pid: string, people: BdPerson[], meId: string | null, admin: boolean): boolean {
  if (admin) return true
  const p = people.find(x => x.id === pid)
  if (p && meId && p.officeUserId && String(p.officeUserId) === String(meId)) return true
  const aku = people.find(x => x.officeUserId === meId)
  return !!aku && aku.id === pid
}
/** `alasanTakBolehSetuju`. */
export function alasanTakBolehSetuju(pid: string, people: BdPerson[]): string {
  const p = people.find(x => x.id === pid)
  return p
    ? `Hanya ${p.name} atau admin BD yang bisa menekan ini.`
    : 'Orang ini belum terdaftar di User Database Office — mintakan akunnya dibuat dulu.'
}
/** `tuntaskanTaskProject` — closing a project closes its tasks, ONLY on the stage change. */
export const tasksPerluDitutup = (tasks: BdTask[], pid: string) => projTasks(tasks, pid).filter(t => !selesai(t))

/** `uid` — the old client's id shape (`t…`, `p…`, `pr…`). Settings documents are not server-generated. */
export const uidBd = (prefix: string) => prefix + Math.random().toString(36).slice(2, 9)

/** `bacaMilestone` — one per line, "name | YYYY-MM-DD"; done is matched by NAME. */
export function bacaMilestone(teks: string, lama?: { t: string, done?: boolean }[]): { t: string, date: string, done: boolean }[] {
  return String(teks || '').split('\n').map(b => b.trim()).filter(Boolean).map((b) => {
    const q = b.split('|')
    const nama = (q[0] || '').trim()
    const tgl = (q[1] || '').trim()
    const sebelum = (lama || []).find(m => m.t === nama)
    return { t: nama, date: /^\d{4}-\d{2}-\d{2}$/.test(tgl) ? tgl : '', done: sebelum ? !!sebelum.done : false }
  })
}
/** Milestones back to the textarea shape (`projModal`). */
export const tulisMilestone = (m?: { t: string, date?: string }[]) => (m || []).map(x => `${x.t} | ${x.date || ''}`).join('\n')

// ─────────────────────────── Task management (putaran keempat, 7 Okt 2026) ──
// The module is no longer just a BD board: per project there are tasks, each
// task may carry sub-tasks, and a task may wait on others (`dependsOn`). Both
// ride INSIDE the task row (`subtasks`, `dependsOn`) — the API stores the
// whole row as JSON in `data`, so no new field ever needs a SQL migration.

/** `subs` — a task's sub-tasks, always an array. */
export function subs(t: { subtasks?: BdSubtask[] | null } | null | undefined): BdSubtask[] {
  return t && Array.isArray(t.subtasks) ? t.subtasks : []
}
/** `subHitung` — `{n, d}` = total / done. */
export function subHitung(t: { subtasks?: BdSubtask[] | null } | null | undefined): { n: number, d: number } {
  const s = subs(t)
  return { n: s.length, d: s.filter(x => x && x.done).length }
}
/** `deps` — waited-on task ids, always an array. */
export function deps(t: { dependsOn?: string[] | null } | null | undefined): string[] {
  return t && Array.isArray(t.dependsOn) ? t.dependsOn : []
}

interface PunyaIdNamaStatus { id: string, name?: string, status?: string }

/** `penghalang` — waited-on tasks that are still not Done. A prerequisite
 * that was DELETED never blocks: a task locked by something nobody can open
 * again would stay locked forever. */
export function penghalang<T extends PunyaIdNamaStatus>(
  t: { id?: string, dependsOn?: string[] | null } | null | undefined,
  semua: T[],
): T[] {
  if (!t) return []
  return deps(t)
    .map(id => semua.find(x => x.id === id))
    .filter((x): x is T => !!x && x.id !== t.id && x.status !== 'Done')
}
/** `penunggu` — tasks waiting on one id. Deleting a task releases them. */
export function penunggu<T extends { id: string, dependsOn?: string[] | null }>(semua: T[], id: string): T[] {
  return semua.filter(t => deps(t).includes(id))
}
/**
 * `menungguTransitif` — whether task a waits on b directly or through a
 * chain. Refuses circles: A waiting on B waiting on A means neither can ever
 * be Done, and no screen could explain why.
 */
export function menungguTransitif(
  semua: { id: string, dependsOn?: string[] | null }[],
  aId: string,
  bId: string,
  seen?: Record<string, boolean>,
): boolean {
  const s = seen || {}
  if (s[aId]) return false
  s[aId] = true
  return deps(semua.find(x => x.id === aId)).some(d => d === bId || menungguTransitif(semua, d, bId, s))
}

/** Short name for guard messages (`namaPendek`). */
export const namaPendekTask = (t: { name?: string } | null | undefined) =>
  `"${String(t?.name || '').slice(0, 40)}"`

export interface HasilCekDone { boleh: boolean, nama: string[] }
/**
 * `cekBolehDone` — THE ONE guard on the road to Done, used by all three
 * paths (the row checkbox, Save in the form, dropping a card). Only Done is
 * held: starting (Doing) a waiting task stays allowed — preparation often
 * runs in parallel. Returns the blockers; callers toast them with
 * `pesanTunggu`.
 */
export function cekBolehDone<T extends PunyaIdNamaStatus>(
  t: { id?: string, name?: string, dependsOn?: string[] | null } | null | undefined,
  daftarDeps: string[] | null | undefined,
  semua: T[],
): HasilCekDone {
  const h = (daftarDeps ?? deps(t))
    .map(id => semua.find(x => x.id === id))
    .filter((x): x is T => !!x && x.id !== t?.id && x.status !== 'Done')
  return { boleh: !h.length, nama: h.map(x => namaPendekTask(x)) }
}
/** The refusal sentence for a held Done. */
export const pesanTunggu = (t: { name?: string } | null | undefined, nama: string[]) =>
  `${namaPendekTask(t)} belum bisa Done — selesaikan dulu: ${nama.join(', ')}`

/**
 * `segarkanProgress` — Done stamps `progress = 100` and `doneAt` (once: the
 * deadline stops counting — "waktunya berhenti"); reopening drops `doneAt`.
 * A task with sub-tasks is COUNTED from them, never typed; a sub-task-less
 * task left at 100 by hand falls back to 0.
 */
export function segarkanProgress(t: { status?: string, progress?: number, doneAt?: string, subtasks?: BdSubtask[] | null }): void {
  if (t.status === 'Done') {
    t.progress = 100
    if (!t.doneAt) t.doneAt = todayISO()
    return
  }
  delete t.doneAt
  const h = subHitung(t)
  if (h.n) t.progress = Math.round((h.d / h.n) * 100)
  else if (t.progress === 100) t.progress = 0
}

/**
 * `urutDeadline` — THE ONE task order: nearest deadline on top, dateless at
 * the bottom (a dateless task is not the most urgent), then the name so the
 * order never reshuffles between renders.
 */
export function urutDeadline(a: { deadline?: string, name?: string }, b: { deadline?: string, name?: string }): number {
  const da = a.deadline || '9999-99-99'
  const db = b.deadline || '9999-99-99'
  if (da !== db) return da < db ? -1 : 1
  return String(a.name || '').localeCompare(String(b.name || ''))
}

export type ModeArsip = 'aktif' | 'arsip' | 'semua'
/**
 * `saringArsip` — Done IS the archive marker, not a new field: two markers
 * for one state would drift (a task reopened from Done but still flagged
 * archive vanishes from the board).
 */
export function saringArsip<T extends { status?: string }>(list: T[], mode: ModeArsip): T[] {
  if (mode === 'arsip') return list.filter(t => t.status === 'Done')
  if (mode === 'semua') return list
  return list.filter(t => t.status !== 'Done')
}

export type SehatProject = 'done' | 'over' | 'on-track' | 'at-risk' | 'off-track'
/** `projSehat` — attention state of one project. */
export function sehatProject(p: { stage?: string, end?: string, health?: string }): { k: SehatProject } {
  if (p.stage === 'Completed') return { k: 'done' }
  if (p.end && sisaHari(p.end) < 0) return { k: 'over' }
  const h = p.health
  return { k: h === 'off-track' || h === 'at-risk' ? h : 'on-track' }
}
/**
 * Projects most needing attention first: overdue, off/at-risk, nearest
 * deadline (`vProjects` kartu view).
 */
export function urutProjectPerhatian<T extends { stage?: string, end?: string, health?: string }>(daftar: T[]): T[] {
  const bobot: Record<SehatProject, number> = { 'over': 0, 'off-track': 1, 'at-risk': 2, 'on-track': 3, 'done': 4 }
  return daftar.slice().sort((a, b) => {
    const x = bobot[sehatProject(a).k]
    const y = bobot[sehatProject(b).k]
    if (x !== y) return x - y
    return (a.end || '9999') < (b.end || '9999') ? -1 : 1
  })
}
/**
 * `waktuTerpakai` — how much of the start→deadline span has passed. Read
 * against progress, it answers "on track or not".
 */
export function waktuTerpakai(p: { stage?: string, start?: string, end?: string }): string {
  if (p.stage === 'Completed') return 'Selesai'
  if (p.start && p.end && p.end > p.start) {
    const tot = Math.round((+pDate(p.end) - +pDate(p.start)) / 86400000)
    if (tot <= 0) return '—'
    const jl = Math.round((+pDate(todayISO()) - +pDate(p.start)) / 86400000)
    return `${Math.max(0, Math.min(100, Math.round((jl / tot) * 100)))}%`
  }
  return '—'
}
