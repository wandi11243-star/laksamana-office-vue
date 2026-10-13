// Auto-absorbed breakdown rows: deal events, Assisted VIP reservations (both
// from the Marketing module) and internal events (from the Event module).
//
// Source: laksamana-office/deploy/finance/omset/index.html :3108-3243
// (EVHARI, muatEventHari, vipPecah) and :3425-3461 (cocokPic, picAkun,
// picPengisi), reading the v1 endpoints GET /marketing/events-on/{date} +
// GET /event/events-on/{date} instead of the legacy `eventsHari` actions.
//
// The event VALUE reuses the Marketing module's own money formula
// (`eventFinance` in marketing-uang.ts, adapted to the slim events-on shape),
// never a copy: the old file warns that two formulas silently diverge. Only
// vipPecah is ported — it is finance-specific (a VIP nominal already includes
// tax & service, split FLAT, not chained like a quotation).
//
// The absorbed numbers are a COMPARISON only: finance still types the real
// Omset/Tax/Service columns by hand, and deleting a row only records its
// `srcId` in `abaikan` (bound on save, like the old screen).
import { eventFinance } from '~/utils/marketing-uang'
import { SETTING_MKT_BAWAAN, type EventMkt } from '~/utils/marketing'
import type { PicKompas } from '~/utils/porsi-pic'
import { kNum } from '~/utils/kompas'

/** One row of `GET /marketing/events-on/{date}` → `data.events`. Field names as the API sends them. */
export interface EventMktOn {
  id: string
  nama: string
  tanggal: string
  status: string
  pax: number
  picId: string
  picName: string | null
  menuFix: string
  selesai: string
  hari: number
  totalHari: number
  detail: Record<string, unknown>
}

/** One row of `GET /marketing/events-on/{date}` → `data.vip`. Field names as the API sends them. */
export interface VipOn {
  id: string
  nama: string
  perusahaan: string
  tanggal: string
  jam: string
  pax: number
  meja: unknown[]
  nominal: number
  picId: string
  picName: string | null
  menuFix: string
}

/** `GET /marketing/events-on/{date}` → `data.settings`. */
export interface SetelanSumber {
  serviceCharge: number
  pb1: number
}

/** One row of `GET /event/events-on/{date}` → `data`. Field names as the API sends them. */
export interface EventEvtOn {
  id: string
  nama: string
  status: string
  venue: string
  picName: string
  inputOleh: string
  inputOlehId: string
  mulai: string
}

/** The absorbed day, mirroring the old `EVHARI` (`tgl`, `st`, `mk`, `vp`, `ev`, `set`, `galat`). */
export interface SumberHari {
  tgl: string
  st: 'idle' | 'muat' | 'ok' | 'galat'
  mk: EventMktOn[]
  vp: VipOn[]
  ev: EventEvtOn[]
  set: SetelanSumber | null
  galat: string
}

export const sumberKosong = (tgl = ''): SumberHari =>
  ({ tgl, st: 'idle', mk: [], vp: [], ev: [], set: null, galat: '' })

/**
 * The event's value after the Marketing module's own quotation formula
 * (`mkFinance`, omset :3157-3204): subtotal → discount → service% → PB1
 * (inclusive or on top). Returns {omset, service, tax, grand} like the three
 * Section B columns plus the comparison total.
 */
export function nilaiEventMkt(ev: EventMktOn, set: SetelanSumber | null) {
  const st = {
    ...SETTING_MKT_BAWAAN,
    serviceCharge: set?.serviceCharge ?? SETTING_MKT_BAWAAN.serviceCharge,
    pb1: set?.pb1 ?? SETTING_MKT_BAWAAN.pb1,
  }
  const f = eventFinance(
    { pax: ev.pax, detail: ev.detail ?? {} } as EventMkt,
    st,
  )
  return { omset: f.afterDisc, service: f.service, tax: f.tax, grand: f.grand }
}

/**
 * Split a VIP reservation nominal into Omset/Tax/Service (`vipPecah`,
 * omset :3234-3243). The nominal ALREADY includes tax & service, so the
 * divisor is FLAT (1 + svc% + tax%) — not chained like a quotation. The
 * rounding rest lands on tax, never on Omset (Omset drives the shift cut).
 */
export function vipPecah(nominal: unknown, set: SetelanSumber | null) {
  const n = kNum(nominal)
  const svc = set?.serviceCharge ?? 5
  const pjk = set?.pb1 ?? 10
  const bagi = 1 + (svc + pjk) / 100
  if (n <= 0 || !Number.isFinite(bagi) || bagi <= 0) return { omset: Math.max(0, n), tax: 0, service: 0 }
  const omset = Math.round(n / bagi)
  const service = Math.round(omset * svc / 100)
  return { omset, service, tax: Math.max(0, n - omset - service) }
}

/** Match a roster name to a division PIC id (old `cocokPic`, omset :3425-3430). Ids are never guessed. */
export function cocokPic(list: PicKompas[], nama: unknown): string | null {
  const n = String(nama ?? '').trim().toLowerCase()
  if (!n) return null
  const e = list.find(x => String(x.name ?? '').trim().toLowerCase() === n)
  return e ? e.id : null
}

/**
 * Match an Office account to a division roster row: `officeUserId` first
 * (names change spelling, ids don't), then the name (old `picAkun`,
 * omset :3449-3458).
 */
export function picAkun(list: PicKompas[], officeId: unknown, nama: unknown): string | null {
  const byId = officeId ? list.find(e => e.officeUserId != null && e.officeUserId === officeId) : null
  if (byId) return byId.id
  return cocokPic(list, nama)
}

/** Where an absorbed row came from, by its `srcId` prefix (old `esrc`, omset :3761). */
export function sumberDari(srcId: unknown): 'Marketing' | 'Marketing (Reservasi VIP)' | 'Event' | '' {
  const awalan = String(srcId ?? '').slice(0, 3)
  return awalan === 'mkt' ? 'Marketing' : awalan === 'vip' ? 'Marketing (Reservasi VIP)' : awalan === 'evt' ? 'Event' : ''
}

/** Same-name check for the "recognised for X" note (old `sama`, omset :3777). */
export const namaSama = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
