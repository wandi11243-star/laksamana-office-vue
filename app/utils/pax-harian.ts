// Daily guests of one date — the old `satukan()` of deploy/dw (and its twin in
// deploy/radar), owned by the jadwal module (PLAN.md §4). Pure: no API calls.
//
// The old page read three module APIs directly (Marketing, Event, Reservasi;
// deploy/dw/index.html:971-979). That door is gone in v1: those endpoints are
// gated by their own modules, and a `dw` holder does not necessarily have them
// — gap G-05, laksamana-api#180, which asks for `GET /api/v1/dw/guests`.
// This file holds the mapping so the screen only has to call the endpoint
// once it exists; meanwhile the Kalender Tamu shows the guest part as
// "Segera (G-05)" and keeps the DW context it can get from /dw/overview.
//
// The shape mapping lives in ONE place now — the old twin copies in dw and
// radar were exactly the kind of duplication PLAN.md §4 forbids.

/** An agenda row from Marketing or Event. */
export interface TamuAgenda {
  sumber: 'mkt' | 'evt'
  id: string
  tgl: string
  judul: string
  jam: string
  tempat: string
  status: string
  pax: number
  jenis: string
  fb: string
}

/** A table reservation (module Reservasi), kept apart from agendas (`RSV`, :1308). */
export interface TamuReservasi {
  id: string
  tgl: string
  nama: string
  jam: string
  pax: number
  status: string
}

/** Only events that will really happen (`ST_MKT_JALAN`/`ST_EVT_JALAN`, :2036). */
export const ST_MKT_JALAN = ['deal', 'confirmed', 'event done']
export const ST_EVT_JALAN = ['upcoming', 'today', 'finished']

export function tamuPasti(a: { sumber?: string, status?: string }): boolean {
  const s = String(a.status || '').trim().toLowerCase()
  if (a.sumber === 'mkt') return ST_MKT_JALAN.includes(s)
  if (a.sumber === 'evt') return ST_EVT_JALAN.includes(s)
  return true
}

/**
 * An instant or a local date string into `{tgl, jam}` (`pecahWaktu`, :2019).
 * Event stores UTC instants (`…Z`); Marketing stores local dates unchanged.
 * Chopping the raw UTC string moves a 00:30 WIB event to the day before —
 * and the DW would be called for the wrong night.
 */
export function pecahWaktu(dt: unknown): { tgl: string, jam: string } | null {
  const s = String(dt || '')
  if (!s) return null
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s)
    if (Number.isNaN(t)) return null
    const d = new Date(t + 7 * 3600 * 1000)
    return { tgl: d.toISOString().slice(0, 10), jam: d.toISOString().slice(11, 16) }
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/)
  return m ? { tgl: m[1]!, jam: m[2] || '' } : null
}

interface RawMarketing { events?: Record<string, unknown>[] }
interface RawEvent { events?: Record<string, unknown>[] }
interface RawReservasi { reservations?: Record<string, unknown>[] }

/** Merge the three sources into agendas + reservations (`satukan`, :2054). */
export function satukan(mkt: RawMarketing | null, evt: RawEvent | null, rsv: RawReservasi | null): { tamu: TamuAgenda[], rsv: TamuReservasi[] } {
  const gabung: TamuAgenda[] = []
  const gabungRsv: TamuReservasi[] = []
  for (const e of mkt?.events ?? []) {
    if (!e || !e.tanggal) continue
    const detail = (e.detail && typeof e.detail === 'object') ? e.detail as Record<string, unknown> : {}
    gabung.push({
      sumber: 'mkt',
      id: String(e.id ?? ''),
      tgl: String(e.tanggal).slice(0, 10),
      judul: String(e.nama || '(tanpa nama)'),
      jam: String(detail.tamuDatang || ''),
      tempat: String(detail.area || ''),
      status: String(e.status || ''),
      pax: Number(e.pax) || 0,
      jenis: String(e.jenis || ''),
      fb: String(detail.fbFormat || ''),
    })
  }
  for (const e of evt?.events ?? []) {
    if (!e) continue
    const mulai = pecahWaktu(e.start_datetime || e.tanggal)
    if (!mulai?.tgl) continue
    gabung.push({
      sumber: 'evt',
      id: String(e.id ?? ''),
      tgl: mulai.tgl,
      judul: String(e.title || '(tanpa judul)'),
      jam: mulai.jam,
      tempat: String(e.venue || ''),
      status: String(e.status || ''),
      pax: Number(e.capacity) || 0,
      jenis: String(e.category || ''),
      fb: '',
    })
  }
  for (const r of rsv?.reservations ?? []) {
    if (!r || !r.date) continue
    gabungRsv.push({
      id: String(r.id ?? ''),
      tgl: String(r.date).slice(0, 10),
      nama: String(r.name || '(tanpa nama)'),
      jam: String(r.time || '').slice(0, 5),
      pax: Number(r.pax) || 0,
      status: String(r.status || ''),
    })
  }
  const tamu = gabung.filter(tamuPasti).sort((a, b) => {
    if (a.tgl !== b.tgl) return a.tgl < b.tgl ? -1 : 1
    return String(a.jam || 'zz').localeCompare(String(b.jam || 'zz'))
  })
  // Cancelled reservations are dropped once, not per screen (`:2111`).
  const reservations = gabungRsv.filter(r => !/cancel|batal/i.test(String(r.status || '')))
  return { tamu, rsv: reservations }
}

export const tamuTgl = (tamu: TamuAgenda[], iso: string) => tamu.filter(a => a.tgl === iso)
export const rsvTgl = (rsv: TamuReservasi[], iso: string) => rsv.filter(r => r.tgl === iso)

/** Guest pax from AGENDAS only — the quota guide uses this, never paxTgl (`paxAcaraTgl`, :2179). */
export const paxAcaraTgl = (tamu: TamuAgenda[], iso: string) =>
  tamuTgl(tamu, iso).reduce((n, a) => n + (Number(a.pax) || 0), 0)

/** No-show counts 0 pax but keeps its row (`paxRsvTgl`, :2182). */
export const paxRsvTgl = (rsv: TamuReservasi[], iso: string) =>
  rsvTgl(rsv, iso).reduce((n, r) => n + (/no.?show/i.test(String(r.status || '')) ? 0 : (Number(r.pax) || 0)), 0)

/** Total people in the building: two different crowds, one number on purpose (`paxTgl`, :2193). */
export const paxTgl = (tamu: TamuAgenda[], rsv: TamuReservasi[], iso: string) =>
  paxAcaraTgl(tamu, iso) + paxRsvTgl(rsv, iso)
