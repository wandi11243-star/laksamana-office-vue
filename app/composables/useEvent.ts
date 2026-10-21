// Event (EMS) API calls + types — the staff panel for events, talents, ticketing
// and check-in. The public ticket shop (Buyers, no Office session) is NOT part
// of Office Vue (T-26); only the staff screens are built here.
//
// Field names are exactly the ones the old client stored, kept as-is by the
// contract (laksamana-api/docs/api/event.md "Fields"). Nothing is renamed.
//
// Versioning (fondasi F1): a record's version IS its `updated_at` in ms.
// `GET /{res}/{id}` returns the authoritative one in `meta.version`; a list
// returns `meta.versions = {id: version}`. Every PUT/PATCH/DELETE sends it
// back as `If-Match`; without it the API answers 428, with a stale one 409
// (`error.details.current` carries the live record).
//
// Not ported on purpose (no v1 endpoint, see docs/migrasi/event.md E and
// _gap-api.md): `saveAll` (U4 — replaced by granular writes), `ping`/`stats`
// as screens (U3), `DB.perm` persistence (K-08 — in-memory default only),
// `resetData` (K-01/G-13 — whole-document reset), `ujiEmail` (ticketing dev).

import type { Versi } from '~/utils/versi'
import { ifMatch } from '~/utils/versi'
import { statusPengajuan } from '~/utils/event-hitung'

/** The twelve record collections of `GET /state`. */
export type ResourceEvent
  = | 'talents' | 'events' | 'schedules' | 'recurring-rules' | 'talent-payments'
    | 'ticket-classes' | 'seats' | 'orders' | 'tickets' | 'ideas' | 'refunds'
    | 'calendar-extra'

/** EMS constants live in app/utils/event-hitung.ts (pure, tested) — import
 *  them from there, like stock pages import from app/utils/stock-*.ts. */

/** Submission state of a plan (`statusPengajuan`, `:4687`). */
export type StatusPengajuan = 'Belum diajukan' | 'Menunggu' | 'Disetujui' | 'Ditolak'
export interface Pengajuan {
  status: StatusPengajuan
  oleh?: string
  pada?: number
  alasan?: string
}

/** A talent row, exactly as the old client stored it (`:2522-2538`). */
export interface Talent {
  id: string
  name: string
  category: string
  phone: string
  whatsapp: string
  instagram: string
  email: string
  manager_name: string
  default_fee: number
  bank_name: string
  bank_account: string
  account_holder: string
  contract_status: string
  /** 'Active' | 'Inactive' — different from contract_status on purpose (`:2470`). */
  status: string
  notes: string
  docs: { ktp?: Berkas | null, npwp?: Berkas | null, contract?: Berkas | null, portfolio?: Berkas[] }
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** Pointer to an uploaded file (`POST /files` → `{key, name, size, at}`). */
export interface Berkas {
  key: string
  name: string
  size: number
  at: number
}

/** One talent appearance. Fee is per show day, stored PER ROW, never re-read
 *  from the profile (`:3865-3869`). */
export interface JadwalTalent {
  id: string
  talent_id: string
  event_id?: string
  date: string
  start_time: string
  end_time: string
  /** Performance type (a TAL_CATS value). */
  type: string
  fee: number
  status: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** A recurring rule that generates schedules (`:3539-3604`). */
export interface AturanRutin {
  id: string
  talent_ids: string[]
  days: number[]
  type: string
  fee: number
  start_time: string
  end_time: string
  valid_from: string
  valid_to: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** One talent bill. The period key is 'YYYY-MM' for monthly, else
 *  'YYYY-MM-DD..YYYY-MM-DD' (`:3901`). */
export interface TagihanTalent {
  id: string
  talent_id: string
  period_month: string
  amount: number
  status: string
  proof_key?: string
  pic_finance?: string
  bank_tujuan?: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** An event row (`eventForm :6284`, `saveEvent :6313`). */
export interface Acara {
  id: string
  title: string
  poster_img?: string
  category: string
  theme: string
  venue: string
  capacity: number
  start_datetime: string
  end_datetime: string
  /** Locked to the creating account (`fieldPicEvent :6271`). */
  pic: string
  description: string
  is_ticketed: boolean
  status: StatusEvent | string
  pengajuan?: Pengajuan
  nominal?: number
  createdBy: string
  createdById: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** One event's detail document: rundown, vendors, budget, sponsors, tasks. */
export interface DetailAcara {
  rundown: { time: string, endtime: string, activity: string, pic: string, notes: string }[]
  vendors: { name: string, pic: string, phone: string, cost: number, status: string }[]
  budget: { item: string, type: string, budget: number, actual: number }[]
  sponsors: { name: string, package: string, nominal: number, agreement: string, status: string }[]
  tasks: { title: string, assignee: string, due: string, done: boolean }[]
  timeline?: Record<string, boolean>
  [key: string]: unknown
}

/** One ticket class of a ticketed event. */
export interface KelasTiket {
  id: string
  event_id: string
  name: string
  benefit: string
  price: number
  quota: number
  sold: number
  sale_start?: string
  sale_end?: string
  seating?: string
  class_id?: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** One seat-map object. */
export interface Kursi {
  id: string
  event_id: string
  class_id?: string
  price?: number
  status?: string
  [key: string]: unknown
}

/** One EMS order (paid through the shop's webhook, never a button — F.10). */
export interface OrderTiket {
  id: string
  event_id: string
  total: number
  payment_status: string
  buyer_name?: string
  buyer_phone?: string
  buyer_email?: string
  created: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** One issued e-ticket. `qr_token` is unique server-side (F.14). */
export interface Tiket {
  id: string
  event_id: string
  ticket_class_id?: string
  order_id?: string
  order_item_id?: string
  seat_id?: string
  qr_token: string
  status?: string
  checked_in_at?: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** One event idea with its evaluations (`:11119-11171`). */
export interface Ide {
  id: string
  name: string
  category: string
  target?: string
  frequency: string
  budget: number
  potential_revenue: number
  difficulty: string
  description: string
  evaluations: EvaluasiIde[]
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

export interface EvaluasiIde {
  id: string
  date: string
  omzet: number
  hadir: number
  biaya: number
  skor: number
  ulang: string
  baik: string
  perbaiki: string
  profit: number
  [key: string]: unknown
}

/** One e-ticket refund request. */
export interface Refund {
  id: string
  event_id?: string
  ticket_id?: string
  order_id?: string
  amount?: number
  reason?: string
  status: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** Holidays / birthdays on the unified calendar. */
export interface KalenderEkstra {
  id: string
  date: string
  type: string
  title: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** One attendance line. Append-only: no update, no delete (F.12). A row with
 *  `batalDari` is a cancellation correcting the named check-in (G-10); the
 *  trail stays intact and presence is newest-wins per ticket_id. */
export interface Checkin {
  id: string
  ticket_id: string
  gate?: string
  result?: string
  staff: string
  checked_in_at: string
  /** Set on cancellation rows: the id of the check-in being corrected. */
  batalDari?: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

/** The full state, the same shape as legacy `getAll` plus versions. */
export interface StateEvent {
  talents: Talent[]
  events: Acara[]
  schedules: JadwalTalent[]
  recurringRules: AturanRutin[]
  talentPayments: TagihanTalent[]
  ticketClasses: KelasTiket[]
  seats: Kursi[]
  orders: OrderTiket[]
  tickets: Tiket[]
  ideas: Ide[]
  refunds: Refund[]
  calendarExtra: KalenderEkstra[]
  checkins: Checkin[]
  eventDetails: Record<string, DetailAcara>
  entertainmentRules: unknown[]
  role: string
  layoutTemplates: unknown[]
  [key: string]: unknown
}

// ---------------------------------------------------------------- reads

/** GET /event/state — the full state + `meta.versions`. */
export const getStateEvent = () => useApi()<Envelope<StateEvent>>('/event/state')

/** The reactive full state every Event screen aggregates from client-side. */
export const useStateEvent = () =>
  useAsyncData('event-state', () => getStateEvent(), { dedupe: 'defer', default: () => null })

/** GET /event/stats — row counts, blob size, `versi`. Diagnostics only (U3). */
export const getStatsEvent = () => useApi()<Envelope<Record<string, unknown>>>('/event/stats')

/** GET /event/events-on/{date} — events of one day that actually happen
 *  (Planning/Draft/Cancelled dropped, F.8). Also read by Finance Omset. */
export const eventsOn = (date: string) =>
  useApi()<Envelope<{ id: string, nama: string, status: string, venue: string, picName: string, inputOleh: string, inputOlehId: string, mulai: string }[]>>(`/event/events-on/${date}`)

/** GET /event/{resource} — all records, in legacy order. */
export const listEvent = <T = Record<string, unknown>>(res: ResourceEvent, query?: Record<string, string>) =>
  useApi()<Envelope<T[]> & { meta: { total: number, versions: Record<string, Versi> } }>(`/event/${res}`, { query })

/** GET /event/{resource}/{id} — one record + authoritative `meta.version`. */
export const getEvent = <T = Record<string, unknown>>(res: ResourceEvent, id: string) =>
  useApi()<Envelope<T>>(`/event/${res}/${id}`)

/** Reactive list of one collection, refetched when the query changes. */
export const useDaftarEvent = <T = Record<string, unknown>>(
  res: ResourceEvent,
  query: Ref<Record<string, string>> | Record<string, string> = {},
  key?: string,
) => {
  const q = ref({ ...(isRef(query) ? query.value : query) })
  if (isRef(query)) watch(query, v => (q.value = { ...v }), { deep: true })
  return useAsyncData(
    key ?? `event-${res}`,
    () => listEvent<T>(res, q.value).then(r => ({ rows: r.data, versions: r.meta?.versions ?? {} as Record<string, Versi> })),
    { watch: [q], default: () => ({ rows: [] as T[], versions: {} as Record<string, Versi> }) },
  )
}

/** GET /event/event-details — map eventId → detail. */
export const getDetails = () =>
  useApi()<Envelope<Record<string, DetailAcara>>>('/event/event-details')

/** GET /event/event-details/{eventId} — one detail + version. */
export const getDetail = (eventId: string) =>
  useApi()<Envelope<DetailAcara>>(`/event/event-details/${eventId}`)

/** GET /event/checkins — newest first, at most 2000. */
export const listCheckins = (query?: Record<string, string | number>) =>
  useApi()<Envelope<Checkin[]>>('/event/checkins', { query })

export const useCheckins = (query?: Ref<Record<string, string>>) =>
  useAsyncData('event-checkins', () => listCheckins(query?.value).then(r => r.data), { watch: query ? [query] : [], default: () => [] as Checkin[] })

/** GET /event/settings — entertainmentRules, role, layoutTemplates. */
export const getSettings = () =>
  useApi()<Envelope<Record<string, unknown>>>('/event/settings')

export const getSetting = <T = unknown>(key: string) =>
  useApi()<Envelope<T>>(`/event/settings/${key}`)

/** GET /event/files/{key} — preview pointer. The file itself streams. */
export const fileEventUrl = (key: string) => {
  const { apiBase } = useRuntimeConfig().public as { apiBase: string }
  return `${apiBase.replace(/\/api\/v1\/?$/, '')}/api/v1/event/files/${key}`
}

/** GET /kompas/performa/event — recognised turnover + bonus per PIC (T-23).
 *  Lives in the kompas module, NOT here (`docs/api/event.md:32` is wrong, G-12).
 *  Range keys are `from`/`to` (`laksamana-api/docs/api/kompas.md` "performa"). */
export const performaEvent = (dari: string, sampai: string) =>
  useApi()<Envelope<unknown>>('/kompas/performa/event', { query: { from: dari, to: sampai } })

// ---------------------------------------------------------------- writes

const kepala = (versi?: Versi) => (versi === undefined ? undefined : ifMatch(versi))

/** POST /event/{resource}. `id` optional (uid shape generated when absent). */
export const createEvent = <T = Record<string, unknown>>(res: ResourceEvent, body: Record<string, unknown>) =>
  useApi()<Envelope<T>>(`/event/${res}`, { method: 'POST', body })

/** PUT /event/{resource}/{id} — replace (createdAt/createdBy kept). Needs a version. */
export const updateEvent = <T = Record<string, unknown>>(res: ResourceEvent, id: string, body: Record<string, unknown>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/event/${res}/${id}`, { method: 'PUT', body, headers: kepala(versi) })

/** PATCH /event/{resource}/{id} — shallow merge of top-level fields. Needs a version. */
export const patchEvent = <T = Record<string, unknown>>(res: ResourceEvent, id: string, fields: Record<string, unknown>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/event/${res}/${id}`, { method: 'PATCH', body: fields, headers: kepala(versi) })

/** DELETE /event/{resource}/{id} — that row only. Needs a version. */
export const removeEvent = (res: ResourceEvent, id: string, versi?: Versi) =>
  useApi()<{ deleted: boolean, id: string }>(`/event/${res}/${id}`, { method: 'DELETE', headers: kepala(versi) })

/** PUT /event/event-details/{eventId} — creates without version (201), replaces with. */
export const putDetail = (eventId: string, value: DetailAcara, versi?: Versi) =>
  useApi()<Envelope<DetailAcara>>(`/event/event-details/${eventId}`, { method: 'PUT', body: value, headers: kepala(versi) })

/** POST /event/checkins — `{ticket_id, gate?, result?}`. `staff` is the session
 *  user; the body cannot set it (F.12). No update, no delete. */
export const postCheckin = (body: { ticket_id: string, gate?: string, result?: string, id?: string }) =>
  useApi()<Envelope<Checkin>>('/event/checkins', { method: 'POST', body })

/** POST /event/checkins — cancellation `{batalDari: <id>, ticket_id?}` (G-10).
 *  Appends a correction row; nothing is deleted (owner decision 2026-09-29 —
 *  the old "Batalkan" deleted the row). `ticket_id` may be omitted (taken from
 *  the cancelled row); when sent it must match. Presence is newest-wins per
 *  ticket_id: the ticket counts as checked in only while its newest row has
 *  no `batalDari`. */
export const batalCheckin = (body: { batalDari: string, ticket_id?: string, id?: string }) =>
  useApi()<Envelope<Checkin>>('/event/checkins', { method: 'POST', body })

/** PUT /event/settings/{key} — body `{"value": …}`. Version required. */
export const putSetting = (key: string, value: unknown, versi?: Versi) =>
  useApi()<Envelope<unknown>>(`/event/settings/${key}`, { method: 'PUT', body: { value }, headers: kepala(versi) })

/** POST /event/files — images (jpg/png/webp/gif) or PDF, at most 8 MB. */
export const uploadFileEvent = (body: { dataBase64: string, fileName: string, mimeType: string }) =>
  useApi()<Envelope<Berkas>>('/event/files', { method: 'POST', body })

/**
 * The red counts of the Event chrome: plans waiting for a decision + pending
 * refunds, on the Approval menu item and as the bell dot
 * (`emsAntriApproval :2089`, same rule as the approval cards).
 */
export function useLencanaEvent() {
  const { data } = useStateEvent()
  return computed<Record<string, number>>(() => {
    const s = data.value?.data
    if (!s) return { approval: 0, lonceng: 0 }
    const rencana = s.events.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu').length
    const refund = s.refunds.filter(r => (r.status ?? '') === 'Pending').length
    return { approval: rencana + refund, lonceng: rencana + refund }
  })
}

// ---------------------------------------------------------------- shared sums
// Browser-side arithmetic lives in app/utils/event-hitung.ts (pure, no API,
// no Vue — importable from plain node for tools/uji-event.mjs). Pages import
// it from there directly; only statusPengajuan is imported above for internal use.
