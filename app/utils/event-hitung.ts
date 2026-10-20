// Event pure sums — the browser-side arithmetic of the EMS panel, ported
// 1:1 from the old client so Performance & Report never differ.
//
// No API, no Vue: importable from plain node for tools/uji-event.mjs.
// Pages import these directly from here (same pattern as stock pages
// importing from app/utils/stock-*.ts).
//
// Sources (all in laksamana-office/deploy/event/index.html):
//   statusPengajuan :4687-4688 · paxAcara :10902 · salesRingkas :6919
//   omzetPerBulanEms :4975 (T-22: Paid only, event-start month, millions)
//   angkaEms :4925 (D.13: one function for Performance & Report)
//   overlaps :1687 · hasConflict :3101 (F.4) · feeAngka :3972 · roiIde :11130
import type { Acara, Checkin, JadwalTalent, KelasTiket, OrderTiket, Tiket } from '~/composables/useEvent'
import type { Versi } from '~/utils/versi'

/** Single source for the EMS constants (old values, unchanged). */
export type StatusEvent = 'Planning' | 'Prospect' | 'Approval' | 'Upcoming' | 'Event Done'
export const EVT_STATUS: StatusEvent[] = ['Planning', 'Prospect', 'Approval', 'Upcoming', 'Event Done']
/** Stages that count as RESULT, not plan (`:4495`). A separate list on purpose. */
export const EVT_STATUS_HASIL: StatusEvent[] = ['Approval', 'Upcoming', 'Event Done']

export const EVT_CATS = ['Free', 'Paid', 'Internal', 'Community', 'Corporate', 'Wedding', 'Festival', 'Music', 'Launching', 'Private']
export const TAL_CATS = ['Band', 'DJ', 'MC DJ', 'Acoustic', 'Solo Singer', 'Saxophone', 'Violin', 'Guest Artist']
export const TIMELINE_PHASES = ['Preparation', 'Marketing', 'Vendor', 'Talent', 'Decoration', 'Opening', 'Closing', 'Evaluation']
export const IDEA_CATS = ['Music', 'Community', 'Food', 'Competition', 'Family', 'Kids', 'Education', 'Business', 'Religious', 'Festival']
export const FREQS = ['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly', 'One Time']

/** The version of a row from a list read (`meta.versions`). */
export const versiBarisEvent = (versions: Record<string, Versi> | undefined, id: string): Versi | undefined =>
  versions?.[id]

/** `statusPengajuan(e)` from `e.pengajuan` (`:4687-4688`). */
export function statusPengajuan(e: { pengajuan?: { status?: string } }): string {
  return e.pengajuan?.status ?? 'Belum diajukan'
}

/** Pax of an event: tickets sold when there are classes, else planned capacity (`:10902`). */
export function paxAcara(e: Pick<Acara, 'id' | 'capacity'>, kelas: Pick<KelasTiket, 'event_id' | 'sold'>[]): number {
  const milik = kelas.filter(c => c.event_id === e.id)
  return milik.length ? milik.reduce((a, c) => a + (Number(c.sold) || 0), 0) : Number(e.capacity) || 0
}

/** Orders by id, for `eventTiket`. */
export const petaOrder = (order: Pick<OrderTiket, 'id' | 'event_id'>[]) =>
  new Map(order.map(o => [String(o.id), { event_id: String(o.event_id ?? '') }]))

type TiketEvent = Pick<Tiket, 'event_id'> & { order_item_id?: unknown, order_id?: unknown }

/** The event a ticket belongs to (contract `docs/api/event.md`, Tickets; legacy
 *  `ciTiket :10379-10382`): its own `event_id` when present, else its order's
 *  (`order_item_id`, then `order_id`). Legacy tickets carry NO `event_id` —
 *  filtering on `t.event_id` alone drops them from every summary. */
export function eventTiket(t: TiketEvent, orderById?: Map<string, { event_id?: string }>): string {
  const own = String(t.event_id ?? '')
  if (own) return own
  return orderById?.get(String(t.order_item_id ?? ''))?.event_id
    || orderById?.get(String(t.order_id ?? ''))?.event_id
    || ''
}

/** Presence rule (contract `docs/api/event.md`, Check-ins): per ticket_id the
 *  newest row wins (`checked_in_at`, then `id`). */
export function checkinTerbaru<C extends Pick<Checkin, 'id' | 'ticket_id' | 'checked_in_at'>>(checkins: C[]): Map<string, C> {
  const m = new Map<string, C>()
  for (const c of checkins) {
    const cur = m.get(c.ticket_id)
    if (!cur || c.checked_in_at > cur.checked_in_at || (c.checked_in_at === cur.checked_in_at && c.id > cur.id)) m.set(c.ticket_id, c)
  }
  return m
}

/** Tickets checked in: those whose newest row is NOT a cancellation (`batalDari`).
 *  A raw `result === 'Valid'` count is wrong twice: a cancellation row has no
 *  `result` (so `?? 'Valid'` counted it) and a re-scan counts again. */
export function idCheckin(checkins: Pick<Checkin, 'id' | 'ticket_id' | 'checked_in_at' | 'batalDari'>[]): Set<string> {
  return new Set([...checkinTerbaru(checkins)].filter(([, c]) => !c.batalDari).map(([tid]) => tid))
}

/** `salesRingkas(eid)` (`:6919-6976`): per-class count & rupiah of non-refunded
 *  tickets, returned amount, valid tickets. Refunds are EMS crew work. Pass the
 *  orders so legacy tickets without `event_id` count (`eventTiket`). */
export function ringkasPenjualan(
  eid: string,
  tiket: (Pick<Tiket, 'ticket_class_id' | 'status'> & TiketEvent)[],
  kelas: Pick<KelasTiket, 'id' | 'event_id' | 'name' | 'price'>[],
  orderById?: Map<string, { event_id?: string }>,
) {
  const punya = tiket.filter(t => eventTiket(t, orderById) === eid)
  const milik = punya.filter(t => (t.status ?? '') !== 'Refunded')
  const kembali = punya.filter(t => (t.status ?? '') === 'Refunded')
  const harga = new Map(kelas.filter(c => c.event_id === eid).map(c => [c.id, Number(c.price) || 0]))
  const perKelas = new Map<string, { nama: string, n: number, rp: number }>()
  for (const t of milik) {
    const k = kelas.find(c => c.id === t.ticket_class_id)
    const nama = k?.name ?? 'Tanpa kelas'
    const s = perKelas.get(nama) ?? { nama, n: 0, rp: 0 }
    s.n += 1
    s.rp += harga.get(t.ticket_class_id ?? '') ?? 0
    perKelas.set(nama, s)
  }
  return {
    perKelas: [...perKelas.values()].sort((a, b) => b.n - a.n),
    omzet: milik.reduce((a, t) => a + (harga.get(t.ticket_class_id ?? '') ?? 0), 0),
    dikembalikan: kembali.reduce((a, t) => a + (harga.get(t.ticket_class_id ?? '') ?? 0), 0),
    tiketSah: milik.length,
  }
}

const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

/** `omzetPerBulanEms(n)` (`:4975-4987`): Paid orders only, mapped to the month
 *  of the event's start, in millions. The dashboard chart is computed from
 *  this — never hard-coded demo numbers (T-22). */
export function omzetPerBulan(
  n: number,
  acara: Pick<Acara, 'id' | 'start_datetime'>[],
  order: Pick<OrderTiket, 'event_id' | 'payment_status' | 'total'>[],
  now = new Date(),
): { label: string, jt: number }[] {
  const mulai = new Map(acara.map(e => [e.id, tglWIB(e.start_datetime).slice(0, 7)]))
  const perBulan = new Map<string, number>()
  for (const o of order) {
    if (o.payment_status !== 'Paid') continue
    const ym = mulai.get(o.event_id ?? '')
    if (ym) perBulan.set(ym, (perBulan.get(ym) ?? 0) + (Number(o.total) || 0))
  }
  const keluar: { label: string, jt: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    keluar.push({ label: BLN_PENDEK[d.getMonth()]!, jt: Math.round(((perBulan.get(ym) ?? 0) / 1000000) * 10) / 10 })
  }
  return keluar
}

/** One function for Performance & Report so the two never differ (`angkaEms :4925`). */
export function angkaEms(
  acara: Pick<Acara, 'status'>[],
  kelas: Pick<KelasTiket, 'sold' | 'quota'>[],
  tiket: Pick<Tiket, 'status'>[],
  order: Pick<OrderTiket, 'payment_status' | 'total'>[],
) {
  const hasil = acara.filter(e => (EVT_STATUS_HASIL as string[]).includes(String(e.status)))
  const omzet = order.filter(o => o.payment_status === 'Paid').reduce((a, o) => a + (Number(o.total) || 0), 0)
  const terjual = kelas.reduce((a, c) => a + (Number(c.sold) || 0), 0)
  const kuota = kelas.reduce((a, c) => a + (Number(c.quota) || 0), 0)
  const lembar = tiket.length
  const hadir = tiket.filter(t => (t.status ?? '') === 'Checked-In').length
  return {
    hasil: hasil.length,
    omzet,
    terjual,
    kuota,
    tiket: lembar,
    hadir,
    isi: kuota ? Math.round(terjual / kuota * 100) : 0,
    hadirPct: lembar ? Math.round(hadir / lembar * 100) : 0,
  }
}

/** Two time ranges overlap (`overlaps :1687`). */
export function tumpangTindih(a1: string, a2: string, b1: string, b2: string): boolean {
  return (a1 || '') < (b2 || '') && (b1 || '') < (a2 || '')
}

/** `hasConflict` (`:3101`): same talent, same date, not Cancelled, overlapping. */
export function bentrokJadwal(
  list: Pick<JadwalTalent, 'id' | 'talent_id' | 'date' | 'start_time' | 'end_time' | 'status'>[],
  talentId: string,
  date: string,
  st: string,
  et: string,
  abaikanId?: string,
): boolean {
  return list.some(s =>
    s.id !== abaikanId
    && s.talent_id === talentId
    && s.date === date
    && (s.status ?? '') !== 'Cancelled'
    && tumpangTindih(String(s.start_time ?? ''), String(s.end_time ?? ''), st, et),
  )
}

/** `feeAngka(s)` (`:3972`): strip thousand separators to a number. */
export function feeAngka(v: unknown): number {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[^0-9-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** ROI of an idea, in percent (`:11130`). */
export function roiIde(budget: number, potensi: number): number {
  return budget > 0 ? Math.round((potensi - budget) / budget * 100) : 0
}

// --- WIB wall-clock (commit 43f6851 in laksamana-office) ---
// `start_datetime` is stored as a UTC instant ("2026-10-25T04:00:00.000Z" =
// 11.00 WIB); old rows may also carry a zoneless local stamp
// ("2026-10-25T11:00"). Slicing the raw string reads UTC: an 11.00 WIB show
// displays as 04:00, and a past-midnight show lands on the previous day — at
// a month edge, in the previous MONTH. Every screen reads dates through
// these, never through a raw slice.

const pad2 = (n: number) => String(n).padStart(2, '0')
const POLA_TGL = /^\d{4}-\d{2}-\d{2}$/
const POLA_BLN = /^\d{4}-\d{2}$/
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** `dtLokalInput(s)`: fill a datetime-local box with LOCAL time (zoned
 *  instant → local `YYYY-MM-DDTHH:mm`; zoneless is already local and goes in
 *  as-is). A raw zoned value makes the browser show an empty box. */
export function dtLokalInput(s: unknown): string {
  if (!s) return ''
  const x = String(s)
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(x)) return x.slice(0, 16)
  const d = new Date(x)
  if (Number.isNaN(d.getTime())) return x.slice(0, 16)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** `pevTglWIB(x)` (`:5181`): the WIB calendar date `YYYY-MM-DD` of a
 *  start_datetime. Unparseable values fall back to the raw slice. */
export function tglWIB(s: unknown): string {
  const t = Date.parse(String(s ?? ''))
  if (Number.isNaN(t)) return String(s ?? '').slice(0, 10)
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/** WIB wall-clock `HH:mm` for display (the same local rule `fmtDateTime`
 *  `:1744` uses — detail pages show the hour people actually gather). */
export function jamWIB(s: unknown): string {
  if (!s) return '—'
  const d = new Date(String(s))
  if (Number.isNaN(d.getTime())) return String(s).slice(11, 16) || '—'
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** The `saveEvent()` (`:6425`) write-back: a datetime-local value (local)
 *  becomes the UTC instant the record keeps — the same rule that read it, so
 *  Edit → Simpan round-trips without drifting. Empty stays empty: unlike the
 *  old form this never invents "now" for a missing end time. */
export function instanDariLokal(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** `rentangPeriode(mode)` (`:6313`): the ONE range counter for the event module
 *  — the event list shares it (the dashboard keeps its own presets), so "this
 *  week" means the same everywhere here. `''` → no filter; `YYYY-MM-DD` →
 *  that day; `YYYY-MM` → that month; `hari`/`minggu` (Monday–Sunday)/`bulan`.
 *  Named per-module like `rentangPeriodeMkt`: `radar.ts` owns the bare name. */
export function rentangPeriodeEvent(mode: string, now = new Date()): { a: string, b: string } | null {
  if (!mode) return null
  const m = String(mode)
  if (POLA_TGL.test(m)) return { a: m, b: m }
  if (POLA_BLN.test(m)) {
    const akh = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)
    return { a: `${m}-01`, b: `${m}-${pad2(akh.getDate())}` }
  }
  if (m === 'hari') {
    const t = ymd(now)
    return { a: t, b: t }
  }
  if (m === 'minggu') {
    const sen = new Date(now)
    sen.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const min = new Date(sen)
    min.setDate(sen.getDate() + 6)
    return { a: ymd(sen), b: ymd(min) }
  }
  const awal = new Date(now.getFullYear(), now.getMonth(), 1)
  const akhir = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { a: ymd(awal), b: ymd(akhir) }
}

/** `periodeBulanAktif` (`:5080`): the month the picker shows — the chosen
 *  `YYYY-MM` itself, else the current month. */
export function bulanAktif(periode: string, now = new Date()): string {
  const m = String(periode ?? '')
  if (/^\d{4}-\d{2}/.test(m)) return m.slice(0, 7)
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

/** `periodeGeser` (`:5086`) without the `window[fn]` indirection: stepping
 *  shifts the unit in use (a picked day steps a day, anything else a month);
 *  from a fixed keyword it steps from the current month. Returns the new mode. */
export function geserPeriode(aktif: string, arah: -1 | 1, now = new Date()): string {
  const m = String(aktif ?? '')
  if (POLA_TGL.test(m)) {
    const d = new Date(`${m}T00:00:00`)
    d.setDate(d.getDate() + arah)
    return ymd(d)
  }
  const b = bulanAktif(m, now)
  const d = new Date(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1 + arah, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
