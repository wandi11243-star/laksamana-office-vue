// Reservasi API calls + types — one Backend shared by two Panels (Reservasi and
// Service Excellent), so everything here is mounted under /api/v1/reservasi.
//
// Field names are exactly the ones stored in each row's `data` JSON, the same
// fields the old client wrote: the contract keeps them as they are
// (laksamana-api/docs/api/reservasi.md "Envelope"). Nothing is renamed here.
//
// Versioning (fondasi F1): a reservation's version IS its `updatedAt` in ms.
// `GET /reservations/{id}` returns the authoritative one in `meta.version`; a
// list returns the raw rows with no per-row version, so use `updatedAt` from
// the row you are editing — or re-read that one row before a risky write.
// Every write takes the version it read; without it the API answers 428.
//
//   try { await patchReservation(id, { status: 'Datang' }, versi) }
//   catch (e) { if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' }) }
//
import type { LayoutDenah } from '~/utils/venue-layouts'

// Not ported on purpose, they have no v1 endpoint (see docs/migrasi/reservasi.md
// bagian E and _gap-api.md): `ringkasTamu` (G-07, guest profile / autofill),
// `halRecap` / `halDana` / `halAudit` (server paging, G-08), `riwayat` (paging +
// CSV export, G-08), `ver` (version-only poll, G-08), and the diagnostics
// `ping` / `stats` (U3 — not a screen feature).

/** Reservation status. "Booking" was the old Marketing value; the client maps it to "Confirmed". */
export type StatusReservasi = 'Pending' | 'Confirmed' | 'Datang' | 'Cancelled' | 'No-show'

/** Transfer check state of a DP. Empty = not verified yet; "rejected" still blocks the receipt. */
export type TfStatus = '' | 'verified' | 'rejected'

/** One arrival wave of a booking that comes in stages. */
export interface ReservasiArrival {
  pax: number
  at?: number
  by?: string
  [key: string]: unknown
}

/** Permission to share a table that is still locked by someone else. Single use, bound to table + date + time. */
export interface IzinTumpang {
  meja: string
  date: string
  time: string
  lawan: string
  by: string
  at: number
}

/** The newest 20 activity entries of one reservation, kept by the server. */
export interface ReservasiLog {
  ts: number
  by: string
  role: string
  action: string
  detail: string
}

/** One DP instalment. One row in Dana Masuk = one instalment. */
export interface ReservasiDp {
  id: string
  amount: number
  method: string
  proofData: string
  proofName: string
  by: string
  at: number
  // Transfer data read from the proof (scan) or typed in "Cek / Edit".
  tfDate: string
  tfTime: string
  tfBank: string
  tfName: string
  tfAmount: number
  tfStatus: TfStatus
  tfNote: string
  tfSource: string
  tfBy: string
  tfAt: number
  tfOcrAt: number
  tfOcrText: string
  /** OCR output is a suggestion only, never a filled-in value. */
  tfOcrSaran?: unknown
}

/** A reservation row, exactly as the old client stored it. */
export interface Reservasi {
  id: string
  name: string
  phone: string
  date: string
  time: string
  pax: number
  table: string
  sharing: boolean
  category: string
  foodReq: string
  drinkReq: string
  dpStatus: 'Sudah' | 'Belum'
  dpMethod: string
  dpAmount: number
  lunas: boolean
  dpProofData: string
  dpProofName: string
  dps: ReservasiDp[]
  docReqData: string
  docReqName: string
  source: string
  picType: string
  picName: string
  member: boolean
  memberNo: string
  notes: string
  vip: boolean
  status: StatusReservasi
  createdBy: string
  createdAt: number
  updatedAt: number
  actualPax: number | null
  arrivals: ReservasiArrival[]
  checkinAt: number | null
  /** The tables a guest was moved off while waiting, so they can be put back. The old form rebuilds the record from an explicit field list and does NOT copy this one (`:4850-4890`), so an edit can drop it. Kept in the type because the day-of map reads it; Tahap 3 must decide. */
  tableAsli?: string
  /** Marker for "counted as arrived at closing time". */
  datangDiasumsikan: 0 | 1
  leftAt: number
  followups: { ts: number, by: string, note: string }[]
  izinTumpang: IzinTumpang | null
  log: ReservasiLog[]
  cancelReason: string
  // Transfer fields of the first instalment, kept in step with dps[0] for old links.
  tfDate: string
  tfTime: string
  tfBank: string
  tfAmount: number
  tfStatus: TfStatus
  tfNote: string
  tfSource: string
  tfBy: string
  tfAt: number
  tfOcrAt: number
  tfOcrText: string
}

/** One queue entry of guests waiting for a table. */
export interface Waitlist {
  id: string
  name: string
  phone: string
  pax: number
  note: string
  date: string
  addedAt: number
  by: string
  status: 'waiting' | 'seated'
  seatedAt: number
  table: string
  resId: string
  calledAt: number
}

/** `master.perms` — 0 not visible, 1 view, 2 may edit; per permission row, per role. */
export type Perms = Record<string, Record<string, 0 | 1 | 2>>

/** The master blob. Every key is optional: the server keeps what is stored, and the old client's defaults are only its own fallback. */
export interface Master {
  tables?: string[]
  dpMethods?: string[]
  infoSources?: string[]
  categories?: string[]
  waTargets?: { id: string, name: string, type: string, detail: string, includeDP: boolean, fields: string[] }[]
  users?: { id: string, name: string, role: string }[]
  perms?: Perms
  dineEstMin?: number
  clashLeadMin?: number
  layouts?: Record<string, LayoutDenah>
  layoutOverrides?: Record<string, string>
  layoutOverrides2?: Record<string, string>
  layoutTanggal?: Record<string, LayoutDenah>
  waitlist?: Waitlist[]
  reviews?: unknown[]
  reviewCfg?: unknown
  feedbacks?: unknown[]
  sePerms?: Perms
  seCrew?: unknown[]
  [key: string]: unknown
}

/** Sections of the master that carry items with their own id (PUT/DELETE /master/{section}/{id}). */
export type SectionItem = 'reviews' | 'feedbacks' | 'waitlist'

/** One audit row, newest first. Append-only, trimmed to 500 by the server. */
export interface AuditRow {
  id: string
  ts: number
  user: string
  role: string
  action: string
  detail?: string
  /** Set when the action belongs to a reservation row. */
  res?: string
}

/** A photo or pdf: `{key, data}`, where data is a data: URI or an `@f:<key>` reference. */
export interface FileData {
  key: string
  data: string
}

/** The version of a row: `meta.version` when the read sent one, else the row's `updatedAt`. */
export const versiReservasi = (res: { meta?: Record<string, unknown> }, row?: Reservasi): Versi | undefined =>
  versiDari(res) ?? row?.updatedAt

/** One crew row of `master.users`: the Reservasi panel's own role per person. */
export interface KruReservasi {
  id: string
  name: string
  role: string
  pin?: string
}

/** The two inputs of the in-module role matrix (`master.users` + `master.perms`). */
export interface PeranReservasi {
  users: KruReservasi[]
  perms: Perms | null
}

/** The loaded matrix, shared by every screen's `Layar.boleh` (app/utils/layar/reservasi.ts). */
export const usePeranReservasi = () => useState<PeranReservasi>('reservasi-peran', () => ({ users: [], perms: null }))

/** Load `master.users` and `master.perms` once, on the module home. */
export const muatPeranReservasi = () => {
  const state = usePeranReservasi()
  const { data: users } = useSection<KruReservasi[]>('users')
  const { data: perms } = useSection<Perms>('perms')
  watchEffect(() => {
    state.value = { users: users.value ?? [], perms: perms.value ?? null }
  })
  return state
}

// ---------------------------------------------------------------- reads

/** GET /reservations?from&to — rows whose date is in range, in created_at order. */
export const listReservations = (from?: string, to?: string) =>
  useApi()<Envelope<Reservasi[]> & { meta: { total: number, ver: number } }>('/reservasi/reservations', { query: { from, to } })

/** The reactive window every Reservasi screen filters from (dashboard, Dana Masuk, riwayat, analitik). */
export const useDaftarReservasi = (from: Ref<string>, to: Ref<string>) =>
  useAsyncData(
    'reservasi-daftar',
    () => listReservations(from.value, to.value).then(r => r.data),
    { watch: [from, to], default: () => [] },
  )

/** GET /reservations/{id} — one row, with the authoritative `meta.version`. */
export const getReservation = (id: string) => useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${id}`)

/** GET /master — the whole blob. Bootstrap and migrations only; screens read their own section. */
export const getMaster = () => useApi()<Envelope<Master>>('/reservasi/master')

/** GET /master/{section} — one independently versioned section, with `meta.version` + `ETag`. */
export const getSection = <T = unknown>(section: string) => useApi()<Envelope<T>>(`/reservasi/master/${section}`)

/** The reactive read of one master section. */
export const useSection = <T = unknown>(section: string) =>
  useAsyncData(`reservasi-section-${section}`, () => getSection<T>(section).then(r => r.data), { default: () => undefined })

/** GET /audit — the newest 500 rows, newest first. */
export const getAudit = () => useApi()<Envelope<AuditRow[]>>('/reservasi/audit')

export const useAudit = () =>
  useAsyncData('reservasi-audit', () => getAudit().then(r => r.data), { default: () => [] })

/** GET /files/{key} — a photo or pdf. */
export const getFile = (key: string) => useApi()<Envelope<FileData>>(`/reservasi/files/${key}`)

// ---------------------------------------------------------------- writes

const headers = (versi?: Versi) => (versi === undefined ? undefined : ifMatch(versi))

/** POST /reservations. `id` is optional; `_audit` adds the audit line in the same transaction. */
export const createReservation = (body: Partial<Reservasi> & { _audit?: { action: string, detail?: string, res?: string } }) =>
  useApi()<Envelope<Reservasi>>('/reservasi/reservations', { method: 'POST', body })

/** PUT /reservations/{id} — replace (createdAt kept). */
export const updateReservation = (id: string, body: Partial<Reservasi>, versi?: Versi) =>
  useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${id}`, { method: 'PUT', body, headers: headers(versi) })

/** PATCH /reservations/{id} — shallow merge of the top-level fields. */
export const patchReservation = (id: string, fields: Partial<Reservasi>, versi?: Versi) =>
  useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${id}`, { method: 'PATCH', body: fields, headers: headers(versi) })

/** DELETE /reservations/{id} — also removes that reservation's photo files. */
export const deleteReservation = (id: string, versi?: Versi) =>
  useApi()<{ deleted: string, id: string }>(`/reservasi/reservations/${id}`, { method: 'DELETE', headers: headers(versi) })

/** PUT /master — the whole blob. Prefer section writes. */
export const putMaster = (value: Master, versi?: Versi) =>
  useApi()<Envelope<Master>>('/reservasi/master', { method: 'PUT', body: { value }, headers: headers(versi) })

/** PUT /master/{section} — one section; `null` removes it. */
export const putSection = (section: string, value: unknown, versi?: Versi) =>
  useApi()<Envelope<unknown>>(`/reservasi/master/${section}`, { method: 'PUT', body: { value }, headers: headers(versi) })

/** PUT /master/{section}/{id} — one item of reviews / feedbacks / waitlist. The id must match the URL. */
export const putSectionItem = <T extends { id: string }>(section: SectionItem, id: string, value: T, versi?: Versi) =>
  useApi()<Envelope<T>>(`/reservasi/master/${section}/${id}`, { method: 'PUT', body: { value }, headers: headers(versi) })

/** DELETE /master/{section}/{id} — the removed item's proof files go with it. */
export const deleteSectionItem = (section: SectionItem, id: string, versi?: Versi) =>
  useApi()<{ deleted: string, id: string }>(`/reservasi/master/${section}/${id}`, { method: 'DELETE', headers: headers(versi) })

/** POST /audit — an action that belongs to no reservation row (settings, roles, review targets). */
export const postAudit = (body: { action: string, detail?: string, res?: string }) =>
  useApi()<{ ok: true }>('/reservasi/audit', { method: 'POST', body })

/** PUT /files/{key} — empty `data` deletes the file. */
export const putFile = (key: string, data: string) =>
  useApi()<{ ok: true }>(`/reservasi/files/${key}`, { method: 'PUT', body: { data } })

// ---------------------------------------------------------------- the table plan
// Four master sections, each with its own content-hash version, so two people
// editing the plan and the per-date schedule never collide. The rules that read
// them (which plan applies on a date, which floor a template belongs to) and the
// editor's data helpers live in app/utils/venue-layouts.ts — this is transport.

export const SECTION_LAYOUT = ['layouts', 'layoutOverrides', 'layoutOverrides2', 'layoutTanggal'] as const
export type SectionLayout = typeof SECTION_LAYOUT[number]

/**
 * The four plan sections with their versions, in one read.
 * The envelope is kept whole, because a section write needs its own version and
 * `useAsyncData` throws the `meta` away.
 */
export const useDenah = () => {
  const sections = {
    layouts: useAsyncData('reservasi-section-layouts', () => getSection<Record<string, LayoutDenah>>('layouts')),
    layoutOverrides: useAsyncData('reservasi-section-layoutOverrides', () => getSection<Record<string, string>>('layoutOverrides')),
    layoutOverrides2: useAsyncData('reservasi-section-layoutOverrides2', () => getSection<Record<string, string>>('layoutOverrides2')),
    layoutTanggal: useAsyncData('reservasi-section-layoutTanggal', () => getSection<Record<string, LayoutDenah>>('layoutTanggal')),
  }

  const master = computed<Master>(() => ({
    layouts: sections.layouts.data.value?.data,
    layoutOverrides: sections.layoutOverrides.data.value?.data,
    layoutOverrides2: sections.layoutOverrides2.data.value?.data,
    layoutTanggal: sections.layoutTanggal.data.value?.data,
  }))

  /** Each section's own version, for `putDenah(section, value, versi)`. */
  const versi = computed<Record<SectionLayout, Versi | undefined>>(() => ({
    layouts: versiDari(sections.layouts.data.value),
    layoutOverrides: versiDari(sections.layoutOverrides.data.value),
    layoutOverrides2: versiDari(sections.layoutOverrides2.data.value),
    layoutTanggal: versiDari(sections.layoutTanggal.data.value),
  }))

  const status = computed(() => (Object.values(sections).some(s => s.status.value === 'pending') ? 'pending' : 'success'))

  return { ...sections, master, versi, status }
}

/** Write one plan section. Its version goes back in `If-Match`; the caller handles a conflict with tanganiKonflik(). */
export const putDenah = (section: SectionLayout, value: unknown, versi?: Versi) => putSection(section, value, versi)
