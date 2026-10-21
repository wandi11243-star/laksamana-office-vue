// Howandi Life OS (hlife) API calls + types.
//
// Field names are exactly the ones stored in each row's `data` JSON, the same
// fields the old client wrote: the contract keeps them as they are
// (laksamana-api/docs/api/hlife.md "Fields"). Nothing is renamed here.
//
// Two shapes need care (docs/migrasi/hlife.md F):
//   - `channels` and `dump` are ORDERED string arrays, not id-keyed objects.
//     `dump` is newest-first. They live in `/settings`, never in a table.
//   - `finance` is only the wrapper `{ledger: […]}`; the table-backed resource
//     is `ledger`, with amounts in MILLIONS of rupiah (× 1e6 for display).
//
// Versioning (fondasi F1): the exposed version is the first 16 hex characters
// of the sha1 of the stored JSON. A list read returns `meta.versions = {id:
// version}`; `GET /settings` returns `meta.versions = {key: version}`. Every
// write echoes the version back as `If-Match`; without it the API answers 428,
// with a stale one 409 `version_conflict`.
//
//   try { await updateHlifeRecord('tasks', id, body, versi) }
//   catch (e) { if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' }) }
//
// Not ported on purpose: `ping`/`stats` (U3 — diagnostics), the old `saveAll`
// blob (U4) and `resetAll` (K-01 = C, G-13 not available yet).
import type { Versi } from '~/utils/versi'
import { ifMatch } from '~/utils/versi'

/** The 13 table-backed resources of the module (laksamana-api/docs/api/hlife.md "Records"). */
export type HlifeResource = 'businesses' | 'projects' | 'tasks' | 'goals' | 'dreams' | 'roadmap' | 'content' | 'learning' | 'habits' | 'events' | 'assets' | 'reviews' | 'ledger'

/** The eight settings keys (laksamana-api/docs/api/hlife.md "Settings"). */
export type HlifeSettingKey = 'firstRun' | 'mood' | 'energy' | 'focus' | 'weeklyTarget' | 'auth' | 'channels' | 'dump'

export interface HlifeBusiness {
  id: string
  name: string
  field: string
  founded: number | string
  desc: string
  revenue: number
  area: string
}

export interface HlifeProject {
  id: string
  name: string
  desc: string
  biz: string
  priority: 'High' | 'Med' | 'Low'
  pic: string
  team: string
  stage: string
  due: string
  progress: number
}

export interface HlifeTask {
  id: string
  name: string
  desc: string
  biz: string
  project: string
  owner: string
  due: string
  est: number
  important: boolean
  urgent: boolean
  done: boolean
}

export interface HlifeGoal {
  id: string
  name: string
  desc: string
  cur: number
  target: number
  unit: string
  area: string
  milestone: string
  /** Present only on legacy "invert" goals; the old client kept it (`goalPct`). */
  invert?: boolean
  start?: number
}

export interface HlifeDream {
  id: string
  title: string
  cat: string
  status: string
  year: number | string
  note: string
  milestone: string
}

export interface HlifeMilestone {
  id: string
  title: string
  desc: string
  year: number
  done: boolean
}

export interface HlifeContent {
  id: string
  title: string
  channel: string
  platform: string
  stage: string
  date: string
  notes: string
}

export interface HlifeLearning {
  id: string
  title: string
  type: string
  source: string
  status: string
  rating: number
  take: string
  date: string
}

export interface HlifeHabit {
  id: string
  name: string
  streak: number
  dates: string[]
}

export interface HlifeEvent {
  id: string
  title: string
  date: string
  start: string
  end: string
  type: string
}

export interface HlifeAsset {
  id: string
  name: string
  cat: string
  loc: string
  qty: number
  unit: string
  value: number
  liab: boolean
}

export interface HlifeReview {
  id: string
  weekStart: string
  sContent: number
  sBusiness: number
  sProject: number
  sPersonal: number
  wins: string
  improve: string
}

/** One monthly ledger row. `income`/`expense` are MILLIONS of rupiah. */
export interface HlifeLedger {
  id: string
  month: string
  /** 'personal' | '__umum' | <business id>. */
  scope: string
  income: number
  expense: number
  note: string
}

/** `settings/auth` — the old browser-only lock. NOT enforced by the API (hlife.md H). */
export interface HlifeAuth {
  enabled: boolean
  hash: string
}

/** The full state S, as legacy `getAll` returned it (laksamana-api/docs/api/hlife.md "Bootstrap"). */
export interface HlifeState {
  firstRun?: boolean
  mood: number
  energy: number
  focus: string
  weeklyTarget: string
  auth: HlifeAuth
  businesses: HlifeBusiness[]
  projects: HlifeProject[]
  tasks: HlifeTask[]
  goals: HlifeGoal[]
  events: HlifeEvent[]
  habits: HlifeHabit[]
  dump: string[]
  finance: { ledger: HlifeLedger[] }
  channels: string[]
  content: HlifeContent[]
  learning: HlifeLearning[]
  dreams: HlifeDream[]
  roadmap: HlifeMilestone[]
  assets: HlifeAsset[]
  reviews: HlifeReview[]
}

/** A resource list plus the per-id versions the next write must echo. */
export interface HlifeList<T> {
  rows: T[]
  versions: Record<string, Versi>
}

// ---------------------------------------------------------------- reads

/** GET /hlife/state — the whole state, for the dashboard and the JSON backup. */
export const useHlifeState = () =>
  useAsyncData(
    'hlife-state',
    () => useApi()<Envelope<HlifeState>>('/hlife/state').then(r => r.data),
    { dedupe: 'defer' },
  )

/** GET /hlife/settings — all eight keys with their defaults, plus `meta.versions`. */
export const useHlifeSettings = () =>
  useAsyncData(
    'hlife-settings',
    async () => {
      const r = await useApi()<Envelope<Record<string, unknown>>>('/hlife/settings')
      return { values: r.data, versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
    },
    { dedupe: 'defer', default: () => ({ values: {} as Record<string, unknown>, versions: {} as Record<string, Versi> }) },
  )

/** GET /hlife/{res} — all rows of one resource, plus their versions. */
export function useHlifeResource<T>(res: HlifeResource) {
  return useAsyncData<HlifeList<T>>(
    `hlife-${res}`,
    async () => {
      const r = await useApi()<Envelope<T[]>>(`/hlife/${res}`)
      return { rows: r.data, versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
    },
    { default: () => ({ rows: [] as T[], versions: {} as Record<string, Versi> }) },
  )
}

// ---------------------------------------------------------------- writes

/** POST /hlife/{res} — `id` is generated by the API (7 chars, `[0-9a-z]`). */
export const createHlifeRecord = <T = unknown>(res: HlifeResource, body: Record<string, unknown>) =>
  useApi()<Envelope<T>>(`/hlife/${res}`, { method: 'POST', body })

/** PUT /hlife/{res}/{id} — replace the whole record; needs the version it was read with. */
export const updateHlifeRecord = <T = unknown>(res: HlifeResource, id: string, body: Record<string, unknown>, version: Versi) =>
  useApi()<Envelope<T>>(`/hlife/${res}/${id}`, { method: 'PUT', body, headers: ifMatch(version) })

/** PATCH /hlife/{res}/{id} — shallow merge of top-level fields; needs a version. */
export const patchHlifeRecord = <T = unknown>(res: HlifeResource, id: string, body: Record<string, unknown>, version: Versi) =>
  useApi()<Envelope<T>>(`/hlife/${res}/${id}`, { method: 'PATCH', body, headers: ifMatch(version) })

/** DELETE /hlife/{res}/{id} — needs a version. */
export const deleteHlifeRecord = (res: HlifeResource, id: string, version: Versi) =>
  useApi()<Envelope<{ deleted: boolean }>>(`/hlife/${res}/${id}`, { method: 'DELETE', headers: ifMatch(version) })

/** PUT /hlife/settings/{key} — body `{value}`; needs the version it was read with. */
export const saveHlifeSetting = <T = unknown>(key: HlifeSettingKey, value: T, version: Versi) =>
  useApi()<Envelope<unknown>>(`/hlife/settings/${key}`, { method: 'PUT', body: { value }, headers: ifMatch(version) })
