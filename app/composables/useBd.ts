// BD OS API calls + types — one Backend, everything mounted under /api/v1/bd.
//
// Field names are EXACTLY the ones stored in each row's `data` JSON, the same
// fields the old client wrote (laksamana-api/docs/api/bd.md "Envelope"). Nothing
// is renamed.
//
// Versioning (fondasi F1): a record's version IS its `updated_at` in ms (the API
// stamps it into `data.updatedAt` too). A list/state read carries no per-row
// `meta.version`, so use the row's `updatedAt`; a single read hands back
// `meta.version` + ETag. Every write sends it back as `If-Match`; without it the
// API answers 428, and a stale one 409 `version_conflict`.
//
//   try { await useBd().ubah('tasks', id, body, versi) }
//   catch (e) { if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' }) }
//
// Not carried over on purpose (see docs/migrasi/bd.md, _pertanyaan.md):
// `ping`/`stats` (U3 — no screen uses them) and the legacy whole-state `saveAll`
// (T-25 → per-record CRUD).
import type { Versi } from '~/utils/versi'
import { ifMatch, tanganiKonflik } from '~/utils/versi'
import { cekBolehDone, deps, normalisasiStatus, penunggu, pesanTunggu, segarkanProgress, selesai } from '~/utils/bd-rumus'

/** API resource names (`docs/api/bd.md:40`). */
export type BdResource = 'people' | 'projects' | 'tasks' | 'routines' | 'coord-requests' | 'purchase-orders' | 'purchase-requests' | 'agenda'
/** Setting documents (`docs/api/bd.md:60-68`). */
export type BdSetting = 'focus' | 'approverSets' | 'promos'

/** One BD crew row. `ket/name/active/tanpaAkses` belong to the Office roster; `role/div/boss` are BD OS's. */
export interface BdPerson {
  id: string
  officeUserId?: string
  name: string
  ket?: string
  role: string
  div: string
  boss: string
  active: boolean
  /** Access revoked in Office: kept as a historical trace, never deleted. */
  tanpaAkses?: boolean
  createdAt?: number
  updatedAt?: number
}

export interface BdMilestone { t: string, date: string, done: boolean }

/** One sub-task, stored INSIDE its task (`subtasks`), never its own table. `d` is the optional sub-task deadline. */
export interface BdSubtask {
  id?: string
  t?: string
  done?: boolean
  d?: string
  /** The single crew member this sub-task is assigned to (empty = unassigned, never guessed). */
  p?: string
}

export interface BdProject {
  id: string
  name: string
  desc: string
  div: string
  type: string
  stage: string
  pics: string[]
  pic: string
  start: string
  end: string
  budget: number
  spent: number
  health: string
  milestones: BdMilestone[]
  createdAt?: number
  updatedAt?: number
}

export interface BdTask {
  id: string
  name: string
  desc: string
  div: string
  pics: string[]
  pic: string
  status: string
  priority: string
  type: string
  /** Optional start; plotted on the Timeline (VUE-11). Later than the deadline is refused. */
  start?: string
  deadline: string
  project: string | null
  important: boolean
  urgent: boolean
  progress: number
  /** Free-text tags, read by search (`tagsOf`). */
  tags?: string[]
  /** Sub-tasks (`subtasks [{id,t,done,d}]`), counted — never typed — into `progress`. */
  subtasks?: BdSubtask[]
  /** Ids of tasks that must be Done first. Only Done is held (`cekBolehDone`). */
  dependsOn?: string[]
  /** Stamped when the task becomes Done, dropped when reopened: a done deadline stops counting. */
  doneAt?: string
  createdAt?: number
  updatedAt?: number
}

export interface BdCoord {
  id: string
  title: string
  desc: string
  fromDiv: string
  toDiv: string
  /** Free text: the destination crew is not in the BD people table. */
  to: string
  by?: string
  status: string
  priority: string
  due: string
  project: string | null
  createdAt?: number
  updatedAt?: number
}

export interface BdRoutine {
  id: string
  name: string
  div: string
  pic: string
  freq: string
  time: string
  done: number
  total: number
  missed: number
  important: boolean
  urgent: boolean
  active: boolean
  createdAt?: number
  updatedAt?: number
}

export interface BdApproval { nama: string, at: string, oleh: string }

export interface BdPo {
  id: string
  item: string
  vendor: string
  amount: number
  qty: number
  unit: string
  needBy: string
  div: string
  /** Points back to the PR sheet; the item is never copied into the document. */
  prId: string | null
  pic: string
  by?: string
  /** Set when the row came from another module (Marketing) that has no BD crew id. */
  byName?: string
  /** Who typed it, when that differs from the requester. */
  input?: string
  at?: string
  status: string
  project: string | null
  note: string
  sumber?: string
  /** "Sudah diproses" marker, with its trace and the previous status. `null` clears it. */
  proses?: boolean
  prosesAt?: number | null
  prosesBy?: string | null
  statusSebelum?: string | null
  /** Filled by Purchasing / Finance; empty is NOT 0. */
  realisasi?: number | string | null
  createdAt?: number
  updatedAt?: number
}

export interface BdPr {
  id: string
  no: string
  nama: string
  dept: string
  tanggal: string
  weekStart: string
  status: string
  total: number
  approvals: Record<string, BdApproval>
  catatan: string
  setId?: string
  createdAt?: number
  updatedAt?: number
}

export interface BdAgenda {
  id: string
  title: string
  /** The OLD data field is `date`, the SQL column is `tanggal` (`:136`). */
  date: string
  type: string
  div: string
  createdAt?: number
  updatedAt?: number
}

export interface BdFocusEntry { teks: string, tgl: string }
export interface BdApproverSet { id: string, nama: string, orang: (string | null)[], bawaan?: boolean }

export interface BdPromo {
  id?: string
  nama: string
  tipe: string
  kategori: string
  benefit: string
  mulai: string
  selesai: string
  jamMulai: string
  jamSelesai: string
  hari: number[] | string
  outlet: string
  partner: string
  partnerPIC: string
  partnerKontak: string
  lmPIC: string
  kode: string
  kuota: number
  ketentuan: string
  poster: string
  paused?: boolean
  dibuatOleh?: string
  dibuatAt?: number
}

/** The whole board, the same shape as legacy `getAll` (`docs/api/bd.md:35`). */
export interface BdState {
  people: BdPerson[]
  projects: BdProject[]
  tasks: BdTask[]
  routines: BdRoutine[]
  coord: BdCoord[]
  po: BdPo[]
  pr: BdPr[]
  agenda: BdAgenda[]
  focus: Record<string, BdFocusEntry>
  approverSets: BdApproverSet[]
  promos: BdPromo[]
  _serverTs?: number
}

/** The three setting documents (`docs/api/bd.md:60-68`). */
export interface BdSettings {
  focus: Record<string, BdFocusEntry>
  approverSets: BdApproverSet[]
  promos: BdPromo[]
}

export const stateKosong = (): BdState => ({
  people: [],
  projects: [],
  tasks: [],
  routines: [],
  coord: [],
  po: [],
  pr: [],
  agenda: [],
  focus: {},
  approverSets: [],
  promos: [],
})

/**
 * The API keeps collection names from the legacy blob (`coord`, `po`, `pr`).
 * Accept both spellings so a documented name and a storage name never fight.
 */
export function normState(raw: unknown): BdState {
  const r = (raw ?? {}) as Record<string, unknown>
  const arr = <T>(...keys: string[]): T[] => {
    for (const k of keys) if (Array.isArray(r[k])) return r[k] as T[]
    return []
  }
  const tasks = arr<BdTask>('tasks')
  // Read mapping (old `normalize`): Backlog → To Do, Waiting → Doing, unknown
  // → To Do. A status without a column would lose its card without a trace.
  for (const t of tasks) t.status = normalisasiStatus(t.status)
  return {
    people: arr<BdPerson>('people'),
    projects: arr<BdProject>('projects'),
    tasks,
    routines: arr<BdRoutine>('routines'),
    coord: arr<BdCoord>('coord', 'coord-requests'),
    po: arr<BdPo>('po', 'purchase-orders'),
    pr: arr<BdPr>('pr', 'purchase-requests'),
    agenda: arr<BdAgenda>('agenda'),
    focus: (r.focus as Record<string, BdFocusEntry>) || {},
    approverSets: arr<BdApproverSet>('approverSets'),
    promos: arr<BdPromo>('promos'),
    _serverTs: typeof r._serverTs === 'number' ? r._serverTs : undefined,
  }
}

// ---------------------------------------------------------------- reads

/** GET /bd/state — the whole board, aggregated client-side like the old app. */
export const getBdState = () => useApi()<Envelope<BdState>>('/bd/state')

/** GET /bd/settings — the three documents with `meta.versions`. */
export const getBdSettings = () => useApi()<Envelope<BdSettings>>('/bd/settings')

/** GET /bd/{resource}?updatedSince — rows in legacy order. */
export const listBd = <T>(resource: BdResource, updatedSince?: number) =>
  useApi()<Envelope<T[]>>(`/bd/${resource}`, { query: { updatedSince } })

/** GET /bd/{resource}/{id} — one row with `meta.version` + ETag. */
export const getBd = <T>(resource: BdResource, id: string) =>
  useApi()<Envelope<T>>(`/bd/${resource}/${id}`)

/**
 * The reactive board every BD screen filters from. `key` keeps two screens on
 * one page from sharing one `useAsyncData` slot.
 */
export function useBdState(key = 'bd-state') {
  return useAsyncData(key, () => getBdState().then(r => normState(r.data)), { default: stateKosong })
}

/** The setting documents with their envelope (a write needs `meta.versions`). */
export function useBdSettings() {
  return useAsyncData('bd-settings', () => getBdSettings(), { default: () => undefined })
}

// ---------------------------------------------------------------- writes

const headers = (versi?: Versi) => (versi === undefined ? undefined : ifMatch(versi))

/** GET /bd/purchase-orders | purchase-requests — also open to `finance` (Kas Kecil PO panel). */
export const daftarBd = <T>(resource: 'purchase-orders' | 'purchase-requests') =>
  useApi()<Envelope<T[]>>(`/bd/${resource}`)

/** POST /bd/{resource} — `id` is optional; the server generates one when absent. */
export const buatBd = <T>(resource: BdResource, body: Partial<T>) =>
  useApi()<Envelope<T>>(`/bd/${resource}`, { method: 'POST', body })

/** PUT /bd/{resource}/{id} — replace (createdAt kept). Needs a version. */
export const ubahBd = <T>(resource: BdResource, id: string, body: Partial<T>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/bd/${resource}/${id}`, { method: 'PUT', body, headers: headers(versi) })

/** PATCH /bd/{resource}/{id} — shallow merge of top-level fields. Needs a version. */
export const tambalBd = <T>(resource: BdResource, id: string, fields: Partial<T>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/bd/${resource}/${id}`, { method: 'PATCH', body: fields, headers: headers(versi) })

/** DELETE /bd/{resource}/{id} — needs a version. */
export const hapusBd = (resource: BdResource, id: string, versi?: Versi) =>
  useApi()<{ deleted: boolean }>(`/bd/${resource}/${id}`, { method: 'DELETE', headers: headers(versi) })

/** POST /bd/purchase-orders/batch — insert-only, ids server-made, status defaults to "Diajukan". */
export const tambahPurchaseOrders = (items: Partial<BdPo>[]) =>
  useApi()<Envelope<{ added: number, ids: string[] }>>('/bd/purchase-orders/batch', { method: 'POST', body: { items } })

/** PUT /bd/purchase-orders/{id}/realisasi — sets the amount, or clears it with "" / null. */
export const setRealisasi = (id: string, realisasi: number | '' | null) =>
  useApi()<Envelope<{ result: string, record: BdPo }>>(`/bd/purchase-orders/${id}/realisasi`, { method: 'PUT', body: { realisasi } })

/** PUT /bd/settings/{key} — replaces the whole document. Needs a version. */
export const putSetelan = <T>(key: BdSetting, value: T, versi?: Versi) =>
  useApi()<Envelope<T>>(`/bd/settings/${key}`, { method: 'PUT', body: { value }, headers: headers(versi) })

// ---------------------------------------------------------------- versions

/** A row's version: the API's `updated_at` ms (mirrored into `data.updatedAt`). */
export const versiBaris = (row?: { updatedAt?: number }): Versi | undefined => row?.updatedAt

/** One document's version out of `GET /settings` (`meta.versions[key]`). */
export function versiSetelan(res: { meta?: Record<string, unknown> } | null | undefined, key: BdSetting): Versi | undefined {
  const versions = res?.meta?.versions as Record<string, Versi> | undefined
  return versions?.[key]
}

// ---------------------------------------------------------------- write helper

/**
 * `useToast()` reached from an event handler: the Vue context is gone by then.
 * Step back into it, the same way `app/utils/versi.ts` does.
 */
function toastBd() {
  return tryUseNuxtApp()?.vueApp.runWithContext(() => useToast()) ?? null
}

/**
 * Run a versioned write, handle a 409/428 with `tanganiKonflik` (which reloads),
 * and toast the outcome. Every BD screen goes through here so no write silently
 * overwrites another person's work.
 */
export async function bdSimpan<T>(aksi: () => Promise<T>, sukses: string): Promise<boolean> {
  const toast = toastBd()
  const muatUlang = () => refreshNuxtData(['bd-state', 'bd-settings'])
  try {
    await aksi()
    await muatUlang()
    toast?.add({ title: sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast?.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}

/**
 * A versioned write with no success toast — for silent actions the old client
 * performed without a message (toggling a checkbox, dragging a card, auto-saving
 * the daily focus). A failure still speaks.
 */
export async function bdTulisDiam<T>(aksi: () => Promise<T>): Promise<boolean> {
  const toast = toastBd()
  const muatUlang = () => refreshNuxtData(['bd-state', 'bd-settings'])
  try {
    await aksi()
    await muatUlang()
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast?.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}

/**
 * Flip a task Done ↔ To Do through the one guard (`toggleTask`, old
 * `toggleTask`). Done runs `cekBolehDone` (a held Done only toasts, never
 * writes); both directions go through `segarkanProgress`, so `doneAt` is
 * stamped once and dropped on reopen. PUT carries the whole row: reopening
 * must also drop `doneAt`, which a PATCH merge could not remove.
 */
export async function toggleTask(t: BdTask, semua: BdTask[]): Promise<boolean> {
  const toast = toastBd()
  const buka = selesai(t)
  if (!buka) {
    const cek = cekBolehDone(t, t.dependsOn, semua)
    if (!cek.boleh) {
      toast?.add({ title: pesanTunggu(t, cek.nama), color: 'error' })
      return false
    }
  }
  const body: Partial<BdTask> = { ...t, status: buka ? 'To Do' : 'Done' }
  delete body.updatedAt
  segarkanProgress(body)
  return bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
}

/** Delete sentence for the confirm sheet: dependents are named by count. */
export function pesanHapusTask(t: BdTask, semua: BdTask[]): string {
  const n = penunggu(semua, t.id).length
  return 'Semua kru ikut kehilangan datanya.'
    + (n ? ` ${n} task lain menunggu task ini; urutannya ikut dilepas.` : '')
}

/**
 * Tick a sub-task straight from its row (`subLangsung`): no Done gate here,
 * then `segarkanProgress` recounts. PUT carries the whole row.
 */
export async function centangSub(t: BdTask, ix: number, on: boolean): Promise<boolean> {
  const subs = [...(t.subtasks ?? [])]
  if (!subs[ix]) return false
  subs[ix] = { ...subs[ix], done: on }
  const body: Partial<BdTask> = { ...t, subtasks: subs }
  delete body.updatedAt
  segarkanProgress(body)
  return bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
}

/**
 * Delete a task and release it from its waiters (old `hapusTask`). A deleted
 * prerequisite never blocks (see `penghalang`), but a stray id in the data
 * would lie about the order one day.
 *
 * The API has no batch write here, so the task is deleted FIRST: if a later
 * release fails, only a harmless stray id is left. Releasing first could
 * strip the order from waiters of a task that then failed to delete.
 */
export async function hapusTaskDenganUrutan(t: BdTask, semua: BdTask[]): Promise<boolean> {
  return bdSimpan(async () => {
    await hapusBd('tasks', t.id, versiBaris(t))
    for (const d of penunggu(semua, t.id)) {
      await tambalBd<BdTask>('tasks', d.id, { dependsOn: deps(d).filter(x => x !== t.id) }, versiBaris(d))
    }
  }, 'Task dihapus')
}
