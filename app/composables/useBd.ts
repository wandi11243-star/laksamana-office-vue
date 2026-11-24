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
import { ifMatch, isKonflik, isVersiWajib, tanganiKonflik, tulisBerVersi } from '~/utils/versi'
import { cekBolehDone, deps, gulirPatch, labelUlang, lahirkanUlang, namaPendekTask, normalisasiStatus, normResp, parseUlang, penunggu, pesanTunggu, rantaiUlang, segarkanProgress, selesai, seriBerakhir, todayISO } from '~/utils/bd-rumus'
import { fTglP } from '~/utils/format'
import { isAdminOf, type Me } from '~/composables/useMe'
import { BATAS_TULIS_PARALEL, hitungBerhasilParalel, petaParalel } from '~/utils/paralel'

/** API resource names (`docs/api/bd.md:40`). */
export type BdResource = 'people' | 'projects' | 'tasks' | 'routines' | 'coord-requests' | 'purchase-orders' | 'purchase-requests' | 'agenda'
/** Setting documents (`docs/api/bd.md:60-68`). */
export type BdSetting = 'focus' | 'approverSets' | 'promos' | 'tagWarna' | 'aksesHalaman'

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
  /** Keterangan for this step (new in the Office, Nov 2026 — the old Panel has none). */
  note?: string
  /** Attachments: references to files on the server (`POST /bd/files`). */
  files?: BdLampiran[]
}

/** One sub-task attachment as `POST /bd/files` answered it. */
export interface BdLampiran {
  key: string
  name: string
  mime: string
  size: number
}

export interface BdProject {
  id: string
  businessGroup?: string
  businessGroupColor?: string
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
  /** Optional deadline time ("HH:MM"), shown as info next to the due text — never an hour-grid (WS2b owns that). */
  jam?: string
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
  /** Daily Task: this task lives on the Daily board, never inside a project. */
  daily?: boolean
  /** Recurrence (`harian`|`kerja`|`mingguan`|`bulanan` + `bulanan_ke`|`bulanan_akhir`|`tahunan` + custom `k/…`); empty = one-off. */
  ulang?: string
  /** Guard: the Done task this recurrence was born from — reopening + Done again never twins. */
  ulangDari?: string
  /** Ended-series trace: the pattern parked here while `ulang` is empty. */
  ulangBerhenti?: { u: string, at: number, by: string }
  /** Missed dates of a self-rolling series (`gulirUlang`): still readable in Recurring. */
  terlewat?: { d: string, sub: string }[]
  /** Reviewers: crew ids asked to review (`reviewers [id kru]`, never the assignee). */
  reviewers?: string[]
  /** When the task entered Review — the "waiting for your review" notification
   *  stamp. Dropped when it leaves Review, so re-entering notifies again
   *  (LM Agenda 30 Okt 2026). Blob passthrough, never migrated. */
  reviewAt?: number
  /** The reviewer's verdict (`{s: 'ok'|'balik', by, at, catatan?}`). Blob passthrough. */
  reviewHasil?: { s: 'ok' | 'balik', by?: string, at?: number, catatan?: string }
  /** Who assigned whom (`{crewId: {by, at}}`), stamped when a NEW pic is added
   *  in the task form — the added person gets a notification. Self-assigns are
   *  never stamped. Blob passthrough, never migrated. */
  tugasOleh?: Record<string, { by: string, at: number }>
  /** Same as `tugasOleh`, for newly added reviewers. */
  reviewOleh?: Record<string, { by: string, at: number }>
  /** Drag marker: the column the card was dropped into + drag time (`dropBoard`). */
  pindahKe?: { st: string, at: number }
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
  /** Optional start/end time ("HH:MM"); empty = all-day (LM Agenda 30 Okt 2026). */
  start?: string
  end?: string
  /** Free-text place or link. */
  lokasi?: string
  /** Free-text notes. */
  ket?: string
  /** The organising crew member. Empty = team agenda: visible to all, editable by all. */
  owner?: string
  /** Invite stamps per peserta id (`{at, ubah?}`): when the schedule shifts,
   *  the stamp is renewed with `ubah: 1` and the answer is dropped, so the
   *  invitee is asked again. Blob passthrough, never migrated. */
  undang?: Record<string, { at: number, ubah?: 1 }>
  /** Invited people: BD crew ids plus whole-Tim outsiders as `o:<officeUserId>`. Never BD people rows. */
  peserta?: string[]
  /** Name snapshot for `o:` peserta, keyed by the same id. */
  pesertaNama?: Record<string, string>
  /**
   * RSVP answers by peserta id (`hadir`|`mungkin`|`tidak`). The API handles
   * JSON as PHP arrays, so an empty map reads back as `[]` — normalized to
   * `{}` on read (see `normState`).
   */
  resp?: Record<string, 'hadir' | 'mungkin' | 'tidak'>
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
  /** Tag colours (`{lowercaseTag: hex}`); absent until the API carries it — readers fall back to the name hash. */
  tagWarna: Record<string, string>
  /** Kelola Akses: screens hidden per crew member, `{officeUserId: [screen keys]}`; absent = everything open. */
  aksesHalaman?: Record<string, string[]>
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
  const agenda = arr<BdAgenda>('agenda')
  for (const e of agenda) {
    // Defensive: the API serves JSON as PHP arrays, so an empty RSVP map
    // reads back as `[]` — and legacy rows may carry none of these fields or
    // unknown answer values. One normalizer (`normResp`, shared with the
    // form) so a bad value never survives a reload only to be cleaned on open.
    const rp = (e as unknown as Record<string, unknown>).resp
    e.resp = normResp(rp)
    if (!Array.isArray(e.peserta)) e.peserta = []
    const pn = (e as unknown as Record<string, unknown>).pesertaNama
    e.pesertaNama = (pn && typeof pn === 'object' && !Array.isArray(pn) ? pn : {}) as Record<string, string>
    // LM Agenda time/owner fields: legacy rows simply lack them.
    if (typeof e.start !== 'string') e.start = ''
    if (typeof e.end !== 'string') e.end = ''
    if (typeof e.lokasi !== 'string') e.lokasi = ''
    if (typeof e.ket !== 'string') e.ket = ''
    if (typeof e.owner !== 'string') e.owner = ''
    const un = (e as unknown as Record<string, unknown>).undang
    e.undang = (un && typeof un === 'object' && !Array.isArray(un) ? un : {}) as Record<string, { at: number, ubah?: 1 }>
  }
  return {
    people: arr<BdPerson>('people'),
    projects: arr<BdProject>('projects'),
    tasks,
    routines: arr<BdRoutine>('routines'),
    coord: arr<BdCoord>('coord', 'coord-requests'),
    po: arr<BdPo>('po', 'purchase-orders'),
    pr: arr<BdPr>('pr', 'purchase-requests'),
    agenda,
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
  return useAsyncData(key, () => getBdState().then(r => normState(r.data)), { dedupe: 'defer', default: stateKosong, getCachedData: cacheSegar() })
}

/** The setting documents with their envelope (a write needs `meta.versions`). */
export function useBdSettings() {
  return useAsyncData('bd-settings', () => getBdSettings(), { dedupe: 'defer', default: () => undefined })
}

/**
 * Tag colours (`tagWarna {lowercaseTag: hex}`): missing reads as no
 * overrides — `warnaTag` falls back to the stable name hash, so chips never
 * render grey while the document is still travelling.
 */
export function useTagWarna() {
  const { data: setelan } = useBdSettings()
  return computed(() => (setelan.value?.data.tagWarna || {}) as Record<string, string>)
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
  return tulisBerVersi(aksi, { sukses, muatUlang: () => refreshNuxtData(['bd-state', 'bd-settings']) })
}

/**
 * A versioned write with no success toast — for silent actions the old client
 * performed without a message (toggling a checkbox, dragging a card, auto-saving
 * the daily focus). A failure still speaks.
 */
export async function bdTulisDiam<T>(aksi: () => Promise<T>): Promise<boolean> {
  return tulisBerVersi(aksi, { muatUlang: () => refreshNuxtData(['bd-state', 'bd-settings']) })
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
  // The drag marker names its column: a checkbox flip is not a drag.
  delete body.pindahKe
  segarkanProgress(body)
  const ok = await bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
  if (ok && !buka) await lahirkanUlangSetelah({ ...t, ...body, id: t.id } as BdTask, semua)
  return ok
}

/**
 * Birth the next occurrence of a recurring task right after its Done is
 * saved, on every path (tick, modal, drag). No-op without `ulang`.
 */
export async function lahirkanUlangSetelah(t: BdTask, semua: BdTask[]): Promise<void> {
  if (t.status !== 'Done' || !t.ulang) return
  const b = lahirkanUlang(t, semua)
  if (!b) return
  const ok = await bdTulisDiam(() => buatBd<BdTask>('tasks', b))
  if (ok) toastBd()?.add({ title: `Berikutnya: ${namaPendekTask(b)} — ${fTglP(b.deadline)}`, color: 'success' })
}

/**
 * Approve a task waiting on my review: Done through the one guard
 * (`cekBolehDone`), with the verdict stamped so the PIC gets a notification.
 * Recurrence birth applies like any other Done.
 */
export async function setujuiReview(t: BdTask, semua: BdTask[], olehId: string): Promise<boolean> {
  const cek = cekBolehDone(t, t.dependsOn, semua)
  if (!cek.boleh) {
    toastBd()?.add({ title: pesanTunggu(t, cek.nama), color: 'error' })
    return false
  }
  const body: Partial<BdTask> = {
    ...t,
    status: 'Done',
    reviewHasil: { s: 'ok', by: olehId, at: Date.now() },
  }
  delete body.updatedAt
  delete body.pindahKe
  segarkanProgress(body)
  const ok = await bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
  if (ok) await lahirkanUlangSetelah({ ...t, ...body, id: t.id } as BdTask, semua)
  return ok
}

/**
 * Send a task back to Doing with the reviewer's note, stamped so the PIC
 * gets a notification. Leaving Review drops `reviewAt`, so re-entering
 * notifies again.
 */
export async function kembalikanReview(t: BdTask, semua: BdTask[], olehId: string, catatan: string): Promise<boolean> {
  const body: Partial<BdTask> = {
    ...t,
    status: 'Doing',
    reviewHasil: { s: 'balik', by: olehId, at: Date.now(), catatan: catatan.slice(0, 300) },
  }
  delete body.updatedAt
  delete body.pindahKe
  segarkanProgress(body)
  return bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
}

/**
 * Stamp who assigned whom: called with the pics/reviewers BEFORE the save
 * and the new lists, so only NEWLY added people are stamped. Self-assigns
 * are never stamped (nothing to tell). Blob passthrough, no migration.
 */
export function capPenugasan(
  body: Partial<BdTask>,
  picsLama: string[],
  revLama: string[],
  picsBaru: string[],
  revBaru: string[],
  olehId?: string | null,
): void {
  if (!olehId) return
  const now = Date.now()
  for (const id of picsBaru) {
    if (id !== olehId && !picsLama.includes(id)) {
      body.tugasOleh = { ...(body.tugasOleh || {}), [id]: { by: olehId, at: now } }
    }
  }
  for (const id of revBaru) {
    if (id !== olehId && !revLama.includes(id)) {
      body.reviewOleh = { ...(body.reviewOleh || {}), [id]: { by: olehId, at: now } }
    }
  }
}

/**
 * Who stopped a series (`ulangBerhenti.by`). Read through the Nuxt context
 * like `toastBd`: these writers run from event handlers where it is gone.
 */
function namaPenyetop(): string {
  try {
    const me = tryUseNuxtApp()?.vueApp.runWithContext(() => useMe().value) ?? null
    return me?.name ?? ''
  }
  catch {
    return ''
  }
}

/**
 * Stop a series: park the pattern in `ulangBerhenti` and empty `ulang` on
 * the head (old `hentikanUlang`). The running task stays; its Done just
 * births nothing more. PUT carries the whole row. The confirm sheet lives
 * in the Recurring screen (Task 3).
 */
export async function hentikanUlang(t: BdTask): Promise<boolean> {
  if (!t.ulang) return false
  const body: Partial<BdTask> = {
    ...t,
    ulang: '',
    ulangBerhenti: { u: t.ulang, at: Date.now(), by: namaPenyetop() },
  }
  delete body.updatedAt
  delete body.pindahKe
  return bdSimpan(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)), 'Pengulangan dihentikan')
}

/**
 * Resume a stopped series (old `lanjutkanUlang`): refuse a Done head, take
 * the parked pattern else walk back down the chain for the newest valid one,
 * restore `ulang` and drop `ulangBerhenti`. PUT carries the whole row, since
 * a PATCH merge could not remove the trace.
 */
export async function lanjutkanUlang(t: BdTask, semua: BdTask[]): Promise<boolean> {
  if (selesai(t)) return false
  const pola = t.ulangBerhenti?.u
    || rantaiUlang(t, semua).slice().reverse().find(x => x.ulang && labelUlang(x.ulang))?.ulang
    || ''
  if (!labelUlang(pola, t.deadline)) return false
  const body: Partial<BdTask> = { ...t, ulang: pola }
  delete body.updatedAt
  delete body.pindahKe
  delete body.ulangBerhenti
  return bdSimpan(
    () => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)),
    `Pengulangan dilanjutkan: ${labelUlang(pola, t.deadline)}`,
  )
}

/**
 * A custom `x:` series is spent once chain length (+ missed dates) reaches
 * the quota — the same count the old client used (completed AND skipped
 * occurrences). `gulirPatch` only sees the single row, so re-check here
 * against the FULL chain before rolling an `x:` series; `d:` series are
 * exact as returned.
 */
function seriHabisRantaiPenuh(t: BdTask, semua: BdTask[], berikut: string): boolean {
  const r = parseUlang(t.ulang)
  if (!r || r.akhir.j !== 'x') return false
  const n = rantaiUlang(t, semua).reduce((a, x) => a + 1 + (Array.isArray(x.terlewat) ? x.terlewat.length : 0), 0)
  return seriBerakhir(t, berikut, n, 0)
}

/**
 * Roll every overdue occurrence forward to its next unelapsed schedule
 * (old `gulirUlang` loop). Each row goes through its own versioned PUT, so
 * two tabs rolling together converge: both compute the same deterministic
 * target, one wins, the loser takes a 409 and just reloads — never retries
 * blindly. Returns the rolled count.
 */
export async function gulirUlangOtomatis(semua: BdTask[]): Promise<number> {
  const hari = todayISO()
  const muatUlang = () => refreshNuxtData(['bd-state', 'bd-settings'])
  let n = 0
  let konflik: unknown = null
  for (const t of semua) {
    const patch = gulirPatch(t, hari)
    if (!patch || !patch.deadline) continue
    if (seriHabisRantaiPenuh(t, semua, patch.deadline)) continue
    const body: Partial<BdTask> = { ...t, ...patch }
    delete body.updatedAt
    // The drag marker names its column: an automatic roll is not a drag.
    delete body.pindahKe
    try {
      await ubahBd<BdTask>('tasks', t.id, body, versiBaris(t))
      n++
    }
    catch (e) {
      // A 409 from a lost race means another tab won: reload once at the
      // end instead of refighting it. Any other failure still speaks.
      if (isKonflik(e) || isVersiWajib(e)) konflik = e
      else toastBd()?.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }
  if (konflik) await tanganiKonflik(konflik, muatUlang)
  else if (n) await muatUlang()
  if (n) toastBd()?.add({ title: `${n} task berulang maju ke jadwal berikutnya`, color: 'success' })
  return n
}

/**
 * Mark the running occurrence Done through the one guard (`toggleTask`, old
 * `selesaiUlang`): dependency check and next-occurrence birth apply. The
 * birth path already toasts "Berikutnya: …"; only an ended series speaks
 * here, so the toast tells scheduled-apart from ended.
 */
export async function selesaiUlang(t: BdTask, semua: BdTask[]): Promise<boolean> {
  if (selesai(t)) return false
  const ok = await toggleTask(t, semua)
  if (ok && t.ulang && labelUlang(t.ulang, t.deadline)) {
    const lahir = lahirkanUlang({ ...t, status: 'Done' } as BdTask, semua)
    if (!lahir) toastBd()?.add({ title: `${namaPendekTask(t)} selesai — seri berulangnya sudah berakhir`, color: 'success' })
  }
  return ok
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
  delete body.pindahKe
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
    // The releases are independent of each other, but every one of them must
    // be reported: a silent failure leaves a stray id that lies about the
    // order one day.
    const tunggu = penunggu(semua, t.id)
    const hasil = await petaParalel(tunggu, BATAS_TULIS_PARALEL, d =>
      tambalBd<BdTask>('tasks', d.id, { dependsOn: deps(d).filter(x => x !== t.id) }, versiBaris(d)))
    const gagal = hasil.length - hitungBerhasilParalel(hasil)
    if (gagal) throw new Error(`${gagal} penunggu gagal dilepas`)
  }, 'Task dihapus')
}

// ---------------------------------------------------------------- sub-task attachments (Nov 2026)

/** Same list and limit as the server (`BdFiles`): images, PDF, Office, TXT/CSV, 8 MB. */
export const LAMPIRAN_MAKS = 8 * 1024 * 1024
export const LAMPIRAN_TERIMA = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
const EKSTENSI_LAMPIRAN = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']

/** Why this file cannot be attached, or '' when it can (checked before the upload). */
export function tolakLampiran(f: File): string {
  const ext = (f.name.split('.').pop() || '').toLowerCase()
  if (!f.type.startsWith('image/') && !EKSTENSI_LAMPIRAN.includes(ext)) {
    return `${f.name}: jenis berkas tidak didukung. Pakai gambar, PDF, Word, Excel, PowerPoint, TXT atau CSV.`
  }
  if (f.size > LAMPIRAN_MAKS) return `${f.name}: lebih dari 8 MB.`
  return ''
}

/** `POST /bd/files` — upload one file; the caller keeps the answer in the sub-task's `files`. */
export async function unggahLampiranBd(f: File): Promise<BdLampiran> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Berkas gagal dibaca.'))
    r.readAsDataURL(f)
  })
  const r = await useApi()<{ data: BdLampiran }>('/bd/files', {
    method: 'POST',
    body: { dataBase64, fileName: f.name, mimeType: f.type },
  })
  // A proxy or firewall can answer 2xx with an HTML page (e.g. a large photo):
  // never hand the form an attachment without a key — it would break the sheet.
  const d = (r as { data?: Partial<BdLampiran> } | null)?.data
  if (!d || typeof d.key !== 'string' || !d.key) {
    throw new Error('Server tidak mengembalikan berkas yang tersimpan. Coba lagi, atau pakai foto yang lebih kecil.')
  }
  return { key: d.key, name: String(d.name || f.name), mime: String(d.mime || f.type), size: Number(d.size) || f.size }
}

/** Only well-formed attachments (an object with a key): a broken entry must never reach a chip. */
export function lampiranSah(files: unknown): BdLampiran[] {
  return Array.isArray(files)
    ? files.filter((x): x is BdLampiran => !!x && typeof x === 'object' && typeof (x as BdLampiran).key === 'string' && !!(x as BdLampiran).key)
    : []
}

const urlLampiran = new Map<string, Promise<string>>()

/**
 * A `/bd/files/{key}` file as an object URL (the endpoint needs the Bearer
 * token, so a plain <img src> or link cannot load it). Cached per key.
 */
export function urlLampiranBd(key: string): Promise<string> {
  let p = urlLampiran.get(key)
  if (!p) {
    p = useApi()<Blob>(`/bd/files/${encodeURIComponent(key)}`, { responseType: 'blob' }).then(b => URL.createObjectURL(b))
    p.catch(() => urlLampiran.delete(key))
    urlLampiran.set(key, p)
  }
  return p
}

/** Open an attachment in a new tab (images and PDF show inline, other types download). */
export async function bukaLampiranBd(f: BdLampiran): Promise<void> {
  // Open the tab synchronously (pop-up blockers allow only that), then point it at the blob.
  const tab = window.open('', '_blank')
  try {
    const url = await urlLampiranBd(f.key)
    if (tab) tab.location.href = url
    else window.location.href = url
  }
  catch (e) {
    tab?.close()
    toastBd()?.add({ title: `Lampiran tidak bisa dibuka: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

/** Short size label: "820 KB", "2,4 MB". */
export function ukuranLampiran(n: number): string {
  if (!(n > 0)) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`
}

export const lampiranGambar = (f: Pick<BdLampiran, 'mime'>) => String(f.mime || '').startsWith('image/')

// ---------------------------------------------------------------- Kelola Akses (page access)

/**
 * Screens a BD admin can close per crew member. Dashboard (the landing page)
 * and Kelola Akses itself are not in the list: everyone keeps a home screen,
 * and only admins reach the access page anyway.
 */
export const LAYAR_DIATUR_BD = ['mytask', 'daily', 'recurring', 'projects', 'calendar', 'inbox', 'promo', 'purchasing'] as const

/** The screen keys hidden from this Office user (empty for BD admins and while settings load). */
export function layarTersembunyiBd(me: Me | null, akses?: Record<string, string[]>): string[] {
  if (!me || isAdminOf(me, 'bd')) return []
  const a = akses ?? (useNuxtData<{ data?: BdSettings }>('bd-settings').data.value?.data?.aksesHalaman)
  return Array.isArray(a?.[me.id]) ? a![me.id]! : []
}
