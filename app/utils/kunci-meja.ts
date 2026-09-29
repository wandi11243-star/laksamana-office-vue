// Seat locking and conflict — the rules that decide whether a table can be used
// for someone new, and what has to be asked first.
//
// Two sets of rules live here on purpose, and which one applies is decided by
// WHAT IS BEING DONE, not by the date or the status (`:1330-1345`):
//
//   selling a seat for later   strict  — the H±3h window applies. Selling a
//                              table already booked for 19:00 is a real
//                              conflict, and it stays refused.
//   seating someone now       loose   — only a guest who is ALREADY SITTING
//                              blocks the table. A table that is booked for
//                              tonight but whose guest has not arrived does
//                              not close it: a table that cannot be used for
//                              three hours is a wasted chair, and a guest who
//                              only wants to sit for twenty minutes while
//                              waiting still has to be seated.
//
// Three levels of lock, each born from a different request:
//   guest sitting now    never allowed
//   ≤ MEPET_MIN (60)     LOCKED, not negotiable
//   > MEPET_MIN          allowed, after a question the crew answers
//
// The 60-minute threshold is the same for every path, but the minutes are
// measured two ways, and the difference is deliberate:
//   day-of map / walk-in : from NOW to the booking time
//   form / move / VIP    : from the TIME ENTERED to the booking time
// The second uses absolute minutes: an opponent 30 minutes EARLIER is exactly
// as tight as one 30 minutes later.
//
// Pure: no Vue, no API, no clock of its own — "now" is passed in wherever the
// old code called Date.now(), so the same rules can be checked against a fixed
// time. Sources are marked line by line.

import type { Reservasi, IzinTumpang } from '~/composables/useReservasi'
import { capMax, capMin, type MasterDenah } from './venue-layouts'

/** A booking locks its table from 3 hours before the arrival time (`:1601-1602`). */
export const LOCK_LEAD_MIN = 180

/** ≤ this many minutes to the booking time, the table is locked outright (`:1350-1351`). */
export const MEPET_MIN = 60

/**
 * The "too close" threshold for the RESERVATION path — 2 hours (`:3966-3974`).
 * DELIBERATELY different from MEPET_MIN (60 min) used by the day-of map: that
 * one is about seating a guest who is already standing in front of the host
 * (an hour from now is still time for a short drink), this one is about
 * selling a seat for later — two parties arriving two hours apart will
 * practically meet at the same table. One number for both makes one of them
 * wrong.
 */
export const TUMPANG_MEPET_MIN = 120

/** Statuses that free the table again (`:2044`). */
export const STATUS_BEBAS: Reservasi['status'][] = ['Cancelled', 'No-show', 'Completed'] as unknown as Reservasi['status'][]

// --- absolute minutes ---------------------------------------------------------
// One number per moment, so times that cross midnight still compare correctly.

/** "YYYY-MM-DD" -> day number. */
export const dayNo = (date: string) => {
  const [y, m, d] = String(date ?? '').split('-').map(Number)
  return y ? Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000) : 0
}

export const toMin = (t: string) => {
  if (!t) return 0
  const [h, m] = String(t).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Minutes -> "HH:MM", wrapping around midnight (`:4033`). */
export const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const absMin = (date: string, time: string) => dayNo(date) * 1440 + toMin(time)

/** The LOCAL date of a timestamp (`:1586-1590`). Deliberately not toISOString(): that is UTC, and in WIB (UTC+7) one in the morning reads as yesterday. */
export const ymdOf = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const absOfTs = (ts: number) => {
  const d = new Date(ts)
  return absMin(ymdOf(ts), hhmm(d.getHours() * 60 + d.getMinutes()))
}

export const absNow = (now: number = Date.now()) => absOfTs(now)

// --- the reservation ----------------------------------------------------------

/** Table ids a booking uses; several tables are "12, 13" (`:1305`). */
export const tablesOf = (r?: Reservasi | null) =>
  String(r?.table ?? '').split(',').map(s => s.trim()).filter(Boolean)

/** The tables a guest was moved OFF while waiting (`:1306`). */
export const mejaAsliOf = (r?: Reservasi | null) =>
  String(r?.tableAsli ?? '').split(',').map(s => s.trim()).filter(Boolean)

/** Moved aside for now, waiting for their own table to free up (`:1307`). */
export const sedangDialihkan = (r?: Reservasi | null) =>
  !!(r?.tableAsli && !r.leftAt && !STATUS_BEBAS.includes(r.status))

export const arrivalsOf = (r?: Reservasi | null) => (Array.isArray(r?.arrivals) ? r.arrivals : [])

/** People who have actually arrived (`:1373-1377`). */
export const arrivedPax = (r?: Reservasi | null) => {
  const a = arrivalsOf(r)
  if (a.length) return a.reduce((s, x) => s + (Number(x.pax) || 0), 0)
  return r?.actualPax != null ? (Number(r.actualPax) || 0) : 0
}

export const remainingPax = (r?: Reservasi | null) => Math.max(0, (Number(r?.pax) || 0) - arrivedPax(r))

export const paxFull = (r?: Reservasi | null) => arrivedPax(r) >= (Number(r?.pax) || 0)

/** Seated, but the party is not complete yet — more people can still be added. */
export const canAddArrival = (r?: Reservasi | null) => isSeated(r) && remainingPax(r) > 0

/** Still at the table (arrived and not marked done). */
export const isSeated = (r?: Reservasi | null) => !!r && r.status === 'Datang' && !r.leftAt

// --- the window ---------------------------------------------------------------

/** How long a guest is expected to stay (minutes). Frees the table on its own, so one guest who forgets to be marked "Selesai" cannot block a table for days. Changeable in Master Data (`:1596-1599`). */
export const dineEstOf = (master?: MasterDenah & { dineEstMin?: number }) => {
  const n = Number(master?.dineEstMin)
  return n > 0 ? n : 180
}

/** How many minutes BEFORE the next booking a table starts warning. Changeable in Master Data, default 10 (`:1642-1645`). */
export const clashLeadOf = (master?: MasterDenah & { clashLeadMin?: number }) => {
  const n = Number(master?.clashLeadMin)
  return n > 0 ? n : 10
}

/** When a table starts being locked: 3 hours before the arrival time (`:1602`). */
export const lockStart = (r: Reservasi) => absMin(r.date, r.time) - LOCK_LEAD_MIN

/** When the guest starts sitting (`:1613-1617`). Arriving early does NOT free the table sooner. */
export const seatStart = (r: Reservasi) => {
  const jamBooking = absMin(r.date, r.time)
  const mulaiDuduk = r.checkinAt ? absOfTs(r.checkinAt) : jamBooking
  return Math.max(jamBooking, mulaiDuduk)
}

/**
 * When the lock ends (`:1618-1620`):
 *   not arrived: arrival + 3 hours, after that the table is free again;
 *   sitting: the return time is unknown, so the EXPECTED STAY (Master Data,
 *           default 3 hours) counted from when the guest sat down.
 *
 * It used to run to the end of the NEXT day. One guest who forgot to be marked
 * "Selesai" then blocked a table for days: a guest sitting at 02:00 on the 15th
 * made a booking for 07:00 the same day fail, and even 02:00 on the 16th stayed
 * blocked. The table now frees itself once the estimate has passed.
 */
export const lockEnd = (r: Reservasi, dineEst = 180) =>
  isSeated(r) ? seatStart(r) + dineEst : absMin(r.date, r.time) + LOCK_LEAD_MIN

/** Does this booking's lock touch the absolute minute range [a..b]? */
export const locksRange = (r: Reservasi, a: number, b: number, dineEst = 180) =>
  lockStart(r) <= b && lockEnd(r, dineEst) >= a

/** Does it lock the table at that minute? (null -> assume it does) */
export const locksAt = (r: Reservasi, at: number | null, dineEst = 180) =>
  at == null ? true : locksRange(r, at, at, dineEst)

/** The (date, time) form, used by the form's conflict check. */
export const locksTable = (r: Reservasi, date: string, time: string, dineEst = 180) =>
  locksAt(r, time ? absMin(date, time) : null, dineEst)

/**
 * Does a guest who is SITTING really block (date, time)? (`:1621-1637`)
 *
 * The loose rule used to be just `isSeated(r)` — without looking at the time at
 * all, even though the search window is ±1 day. A guest sitting right now then
 * blocked tomorrow evening's booking, even though they will be long gone. They
 * hold the table from sitting down until their expected stay is over — or until
 * NOW if they are overstaying, because they are still there. A time inside that
 * range (with the 3-hour lead in front of it) clashes; a time after it does not.
 * A walk-in is still always blocked: its time is now, and now is always inside
 * that range.
 */
export function dudukMenempati(r: Reservasi, date: string, time: string, dineEst = 180, now: number = Date.now()): boolean {
  if (!isSeated(r)) return false
  if (!date || !time) return true
  const t = absMin(date, time)
  return t >= seatStart(r) - LOCK_LEAD_MIN && t <= Math.max(lockEnd(r, dineEst), absNow(now))
}

/** Still sitting though their estimate has passed — the table counts as taken and the host is reminded to mark "Selesai". */
export const overStay = (r: Reservasi, dineEst = 180, now: number = Date.now()) => isSeated(r) && absNow(now) > lockEnd(r, dineEst)

export const overStayMin = (r: Reservasi, dineEst = 180, now: number = Date.now()) =>
  overStay(r, dineEst, now) ? absNow(now) - lockEnd(r, dineEst) : 0

/** Minutes to this booking's time (negative = it has passed). */
export const menitMenuju = (r: Reservasi, now: number = Date.now()) => absMin(r.date, r.time) - absNow(now)

// --- "too close" --------------------------------------------------------------

export const mepetKah = (menit: number) => menit <= MEPET_MIN

/** Absolute distance in minutes between a booking and the time being considered. Every path that sells a seat for later uses this. */
export function bedaMenitRes(r: Reservasi, date: string, time: string): number {
  if (!r?.date || !r.time || !date || !time) return Number.POSITIVE_INFINITY
  return Math.abs(absMin(r.date, r.time) - absMin(date, time))
}

export const mepetTerhadap = (r: Reservasi, date: string, time: string) => mepetKah(bedaMenitRes(r, date, time))

// --- who sits at a table ------------------------------------------------------

/** pax charged to a booking that uses SEVERAL tables (`:1725-1740`).
 *
 * It used to charge the full pax to every one of its tables. A party of 9 on
 * two 7-seat tables wrote "seats full" (9 of 7) on BOTH, though 9 people on 14
 * chairs still leaves 5 free — and the crew concluded no one more could be
 * added. The pax is now split by each table's share of the capacity. */
export function paxDiMeja(r: Reservasi, tableId: string, capOf: (id: string) => number): number {
  const meja = tablesOf(r)
  const total = Math.max(Number(r.pax) || 0, arrivedPax(r))
  if (meja.length <= 1) return total
  const i = meja.indexOf(tableId)
  if (i < 0) return 0
  const caps = meja.map(id => Math.max(1, capOf(id) || 1))
  const jml = caps.reduce((a, b) => a + b, 0)
  const porsi = caps.map(c => Math.floor(total * c / jml))
  porsi[0]! += total - porsi.reduce((a, b) => a + b, 0) // the rounding remainder goes to the first table
  return porsi[i]!
}

/** pax charged to one table. `tableId` empty = the whole booking (legacy behaviour). */
export const takenPaxAt = (list: Reservasi[], tableId: string, capOf: (id: string) => number) =>
  list.reduce((a, r) => a + (tableId ? paxDiMeja(r, tableId, capOf) : Math.max(Number(r.pax) || 0, arrivedPax(r))), 0)

/** `{terisi, min, max, sisaMin, sisaMax}` — the remainder is a range, following "4-5" (`:1749-1755`). */
export function tableFill(t: { id?: string, cap?: string }, list: Reservasi[], capOf: (id: string) => number) {
  const terisi = takenPaxAt(list, t?.id ?? '', capOf)
  const min = capMin(t?.cap)
  const max = capMax(t?.cap)
  return { terisi, min, max, sisaMin: Math.max(0, min - terisi), sisaMax: Math.max(0, max - terisi) }
}

/** A table can take more people only when EVERY party on it is sharing (`:2187`). */
export const isJoinable = (list: Reservasi[]) => list.length > 0 && list.every(r => !!r.sharing)

/** Free seats, but only meaningful when the table may be shared (`:1896-1919`). */
export const hasRoom = (t: { id?: string, cap?: string }, list: Reservasi[], capOf: (id: string) => number) => {
  const f = tableFill(t, list, capOf)
  return f.sisaMax > 0 && list.some(isSeated)
}

export const roomText = (f: { sisaMin: number, sisaMax: number }) =>
  (f.sisaMin && f.sisaMin !== f.sisaMax) ? `${f.sisaMin}-${f.sisaMax}` : String(f.sisaMax)

// --- who holds a table --------------------------------------------------------

/**
 * Reservations holding each table in a window (`:2045-2072`).
 *
 * `realita` = treat a seated guest as still occupying regardless of the window;
 * it only makes sense for TODAY, where a guest sitting now must not appear free
 * on tomorrow's map. Each table's list is sorted with the CLOSEST first: the
 * seated guest, then the earliest arrival. Without it the order follows the data
 * order, so a table can show a 20:00 booking while a 13:00 one came first.
 */
export function occupiedMap(list: Reservasi[], opts: { date: string, time?: string, exceptId?: string | null, realita?: boolean, dineEst?: number }): Map<string, Reservasi[]> {
  const { date, time, exceptId, realita = false, dineEst = 180 } = opts
  const m = new Map<string, Reservasi[]>()
  const d0 = dayNo(date) * 1440
  const a = time ? absMin(date, time) : d0
  const b = time ? absMin(date, time) : d0 + 1439
  for (const r of list) {
    if (r.id === exceptId) continue
    if (!r.date || !r.time) continue
    const dd = dayNo(r.date) - dayNo(date)
    if (dd < -1 || dd > 1) continue // out of reach, even across midnight
    if (STATUS_BEBAS.includes(r.status)) continue // cancelled / no-show / done -> free
    if (r.leftAt) continue // the guest has gone home
    const dudukTerus = realita && isSeated(r)
    if (!dudukTerus && !locksRange(r, a, b, dineEst)) continue
    for (const id of tablesOf(r)) {
      if (!m.has(id)) m.set(id, [])
      m.get(id)!.push(r)
    }
  }
  for (const arr of m.values()) {
    arr.sort((x, y) => {
      const sx = isSeated(x) ? 0 : 1
      const sy = isSeated(y) ? 0 : 1
      return sx !== sy ? sx - sy : absMin(x.date, x.time) - absMin(y.date, y.time)
    })
  }
  return m
}

/** The table's parties (`:2186`). */
export const partiesAt = (occ: Map<string, Reservasi[]>, id: string) => occ.get(id) || []

/**
 * The day-of map's split (`:2129-2183`): tables really taken NOW vs tables
 * booked for later.
 *
 * Tables are NOT auto-locked 3 hours ahead any more (19 September 2026, user
 * request: "don't auto lock 3 hours before, but a guest who only wants to sit
 * for a while should still be able to click it for a temporary walk-in").
 * What really fills a table is one thing: a guest who is SITTING there. A
 * booking whose time is close but whose guest has not arrived does not close it.
 * What replaces the lock is not a quiet relaxation: the table is marked
 * (lock icon + its booking time), a booking within the hour is marked HARDER, and
 * the walk-in form names who booked it and how long to go. Crew seat people
 * there while looking at the numbers, not without knowing.
 *
 * `!isToday` still locks, and that is not an oversight: a map of another date is
 * opened to LOOK at bookings, not for a walk-in — a walk-in always happens now.
 */
export function harihOccupancy(list: Reservasi[], opts: { date: string, hariIni: boolean, saring?: (r: Reservasi) => boolean, dineEst?: number }): {
  occ: Map<string, Reservasi[]>
  later: Map<string, Reservasi[]>
} {
  const { date, hariIni, saring, dineEst = 180 } = opts
  const all = occupiedMap(list, { date, dineEst, realita: hariIni })
  const occ = new Map<string, Reservasi[]>()
  const later = new Map<string, Reservasi[]>()
  for (const [id, list0] of all) {
    const di = saring ? list0.filter(saring) : list0
    if (!di.length) continue
    const locked: Reservasi[] = []
    const soon: Reservasi[] = []
    for (const r of di) {
      // Tomorrow's booking that has not arrived is NOT drawn on today's map
      // (26 September 2026, user request). occupiedMap() includes D+1 because an
      // early booking locks its table from the previous night — that still holds
      // in conflictCheck(), so the table is still protected; only the DISPLAY is
      // withdrawn, because "02:10 (27 Sep)" on today's map reads as a guest tonight.
      if (r.date > date && !isSeated(r)) continue
      if (isSeated(r) || !hariIni) locked.push(r)
      else soon.push(r)
    }
    if (locked.length) occ.set(id, locked)
    if (soon.length) later.set(id, soon)
  }
  return { occ, later }
}

/** The nearest booking on a table, and when that table will lock for it (`:2184`). */
export function nextBookingAt(later: Map<string, Reservasi[]>, id: string): { res: Reservasi, lebih: number } | null {
  const list = [...(later.get(id) ?? [])].sort((a, b) => absMin(a.date, a.time) - absMin(b.date, b.time))
  if (!list.length) return null
  return { res: list[0]!, lebih: list.length - 1 }
}

/**
 * The table that needs action: a guest still SITTING while the next booking on
 * that table is close (within the threshold) or already late (`:1647-1660`).
 *
 * What decides this is deliberately NOT "is overstaying". A guest sitting four
 * hours while the next booking is at 20:00 is NOT a problem — warning since
 * 16:00 only makes the map noisy and trains the crew to ignore it. What is truly
 * urgent is when the next guest is about to arrive and the table is still taken.
 */
export function perluDialihkan(list: Reservasi[], clashLead = 10, now: number = Date.now()): { duduk: Reservasi, nunggu: Reservasi[] } | null {
  const duduk = list.find(isSeated)
  if (!duduk) return null
  const nunggu = list.filter(x => x.id !== duduk.id && !isSeated(x) && menitMenuju(x, now) <= clashLead)
  return nunggu.length ? { duduk, nunggu } : null
}

// --- the shared-table permission ----------------------------------------------

/**
 * Is the crew's approval still in force? (`:3954-3959`)
 * It travels WITH its context — the table, the date and the time that were asked
 * about — and only applies while all three are unchanged. It is stored as a
 * boolean on the row and sticks there FOREVER: a booking that was forced once
 * passes the strict check on every later table move, with nobody ever being
 * asked again. It expires on its own as soon as one of the three changes.
 */
export function izinTumpangBerlaku(r?: Reservasi | null): boolean {
  const z = r?.izinTumpang
  if (!z || typeof z !== 'object') return false
  return z.meja === String(r?.table ?? '') && z.date === String(r?.date ?? '') && z.time === String(r?.time ?? '')
}

export const buatIzinTumpang = (meja: string, date: string, time: string, lawan?: Reservasi | null, nama = '-'): IzinTumpang => ({
  meja: String(meja ?? ''),
  date: String(date ?? ''),
  time: String(time ?? ''),
  lawan: lawan ? `${lawan.name} ${lawan.time}` : '',
  by: nama,
  at: Date.now(),
})

// --- conflict -----------------------------------------------------------------

/** How a check was made. Walk-in and approved override are written apart on purpose: they mean the same thing but arrive from different places, and they WILL drift if merged. */
export interface OpsiCek {
  /** The guest is already standing in front of the host. */
  walkin?: boolean
  /** The crew was asked and said yes. */
  izin?: boolean
  dineEst?: number
  now?: number
}

/** The walk-in and permission flags of a booking itself (`:3926`). Recognised from `source`, not from the status: an ordinary booking marked "Datang" has the same status and must stay strict when its table is moved. */
export const opsiCekOf = (r: Reservasi, dineEst = 180): OpsiCek => ({
  walkin: String(r?.source ?? '') === 'Walk-in',
  izin: izinTumpangBerlaku(r),
  dineEst,
})

/**
 * The booking that blocks (date, table, time), or null.
 *
 * A clash is the same table used by another live booking. The lock rule is
 * exactly the map's. `list` may be a FRESHER list from the server, to catch two
 * accounts racing for the same table while saving (`:3878-3901`).
 *
 * A guest who is SITTING blocks every mode — the chair really is in use. A
 * booking whose time is within the hour (or already past) is locked too, not
 * merely warned. This is deliberately inside the check and not only in the UI,
 * because this is what the data merge calls: if only the screen locked it, one
 * path that got through would still put two parties at one table.
 */
export function conflictCheck(list: Reservasi[], opts: {
  date: string
  table: string
  time: string
  exceptId?: string | null
  sharing?: boolean
  /** The loose rules: the walk-in path, and the approved-override path. */
  loose?: boolean
  dineEst?: number
  now?: number
}): Reservasi | null {
  const { date, table, time, exceptId, sharing = false, loose = false, dineEst = 180, now = Date.now() } = opts
  if (!table) return null
  const want = String(table).split(',').map(s => s.trim()).filter(Boolean)
  return list.find((r) => {
    if (r.id === exceptId) return false
    if (!r.date || !r.time) return false
    const dd = dayNo(r.date) - dayNo(date)
    if (dd < -1 || dd > 1) return false // the lock window can cross midnight
    if (STATUS_BEBAS.includes(r.status)) return false
    if (r.leftAt) return false // the guest has gone home -> free
    if (!tablesOf(r).some(t => want.includes(t))) return false
    if (sharing && r.sharing) return false // both sharing -> they may be joined
    if (loose) return dudukMenempati(r, date, time, dineEst, now) || mepetTerhadap(r, date, time)
    return locksTable(r, date, time, dineEst)
  }) ?? null
}

export type KeputusanTumpang
  = | { boleh: true }
    | { boleh: false, kunci: true, pesan: string }
    | { boleh: false, kunci: false, pesan: string, mepet: boolean, lawan: Reservasi }

/**
 * The question asked before a locked table is used anyway (`:3984-4004`).
 *
 * A guest who is SITTING IS NEVER PASSED, and that limit must not move: their
 * chair really is in use, and no "yes" can seat two parties on the same chairs.
 * What is relaxed is only the ±3h guard against a guest who has not arrived —
 * and who may weigh that is the crew looking at the table, not a rule.
 *
 * The decision is returned instead of asked here: a plain function has no
 * dialog, so the caller shows the message in a ResponsiveSheet and passes the
 * answer back.
 */
export function periksaTumpang(lawan: Reservasi, meja: string, date: string, time: string, dineEst = 180): KeputusanTumpang {
  if (dudukMenempati(lawan, date, time, dineEst)) {
    return { boleh: false, kunci: true, pesan: `Meja ${meja} sedang diduduki ${lawan.name} — tandai "Selesai" dulu kalau tamunya sudah pulang.` }
  }
  const beda = bedaMenitRes(lawan, date, time)
  // LOCKED, not negotiable. No question here: a question whose answer may only be
  // "yes" just trains people to press OK, and once the habit forms it carries
  // over to the questions that do need thought.
  if (mepetKah(beda)) {
    return { boleh: false, kunci: true, pesan: `Meja ${meja} terkunci — ${lawan.name} jam ${lawan.time}, tinggal ${fmtMenit(beda)} lagi.` }
  }
  const mepet = beda <= TUMPANG_MEPET_MIN
  return {
    boleh: false,
    kunci: false,
    mepet,
    lawan,
    pesan: `Meja ${meja} sudah dipesan\n\n${lawan.name} — ${lawan.date} jam ${lawan.time}, ${lawan.pax} pax (${lawan.status})\nJaraknya ${fmtMenit(beda)} dari jam yang kamu isi (${time}).\n\n${mepet
      ? 'Ini mepet. Dua rombongan yang jam datangnya cuma berselisih segitu hampir pasti bertemu di meja yang sama.\n\n'
      : 'Sistem mengunci meja H±3 jam supaya dua tamu tidak bertabrakan.\n\n'}Kalau diteruskan, kamu yang memastikan mejanya kosong tepat waktu — sistem tidak akan menahannya lagi, dan persetujuan ini tercatat atas namamu.`,
  }
}

/** "1 j 20 m" — the duration wording the lock messages use. */
export function fmtMenit(min: number): string {
  if (!Number.isFinite(min)) return '—'
  const m = Math.max(0, Math.round(min))
  const j = Math.floor(m / 60)
  return j ? `${j} j ${m % 60} m` : `${m} m`
}

/** "23:00", or "23:00 (14 Jul)" when the lock starts on another day than the booking (`:1661-1667`). */
export const lockStartText = (r: Reservasi, fmtTglPendek: (tgl: string) => string) => {
  const s = lockStart(r)
  const dn = Math.floor(s / 1440)
  const jam = hhmm(s)
  if (dn === dayNo(r.date)) return jam
  return `${jam} (${fmtTglPendek(ymdOf(dn * 86400000)).replace(/\s\d{4}$/, '')})`
}

/** When this booking locks its table, in words (`:1669-1675`). */
export const lockWindowText = (r: Reservasi, dineEst: number, fmtTglPendek: (tgl: string) => string) =>
  isSeated(r)
    ? `Meja terkunci sejak ${lockStartText(r, fmtTglPendek)} sampai ±${hhmm(lockEnd(r, dineEst))} (estimasi lama duduk ${fmtMenit(dineEst)}). Tandai "Selesai" untuk membukanya lebih cepat.`
    : `Meja terkunci ${lockStartText(r, fmtTglPendek)}–${hhmm(absMin(r.date, r.time) + LOCK_LEAD_MIN)} (H±3 jam dari jam datang ${r.time})`

// --- the six seat states ------------------------------------------------------

/**
 * What a seat looks like right now. The map needs ONE answer per table, and the
 * day-of map and the picking form must agree — they used the same classes in the
 * old client, and two maps that colour the same table differently send the crew
 * looking for the wrong table.
 *
 *   'kosong'    free, clickable
 *   'terpilih'  picked in the form
 *   'sharing'   every party on it shares, so more can be joined
 *   'pending' | 'confirmed' | 'datang'   booked, by reservation status
 *   'terkunci'  booked, cannot be used: seated guest, or within 60 minutes
 *   'mepet'     free now, booked within the hour
 *   'dipesan'   free now, booked later
 */
export type StateMeja = 'kosong' | 'terpilih' | 'sharing' | 'pending' | 'confirmed' | 'datang' | 'terkunci' | 'mepet' | 'dipesan'

export interface StatusMeja {
  state: StateMeja
  /** The parties on the table, closest first. */
  list: Reservasi[]
  /** The nearest booking, when the table is free but booked later. */
  next?: Reservasi | null
  /** There is more on this table than the one shown. */
  lain: number
  /** Table capacity, the free seats, and the word under the box. */
  fill: { terisi: number, min: number, max: number, sisaMin: number, sisaMax: number }
  /** The table is not free: seated guest, or too close to the booking. */
  kunci: boolean
  /** The table is being used against an approval the crew gave (their name is on the row). */
  dipaksa: boolean
  /** Seated past the expected stay. The table stays taken until it is marked "Selesai". */
  over: boolean
  /** Seated, and the next booking on this table is close or late: someone has to move. */
  alih: Reservasi[]
}

const STATE_STATUS: Record<string, StateMeja> = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Datang: 'datang',
}

/**
 * One table's state. `mode` 'tampil' is the day-of map, 'pilih' the form.
 * `pilih` mode is strict: a booked table is locked unless the crew answer
 * `periksaTumpang` first, and the caller then marks it `dipaksa`.
 */
export function statusMeja(t: { id?: string, cap?: string }, o: {
  occ: Map<string, Reservasi[]>
  later?: Map<string, Reservasi[]>
  mode: 'tampil' | 'pilih'
  /** The form's own date & time: the strict path measures the gap from the time ENTERED. */
  date?: string
  time?: string
  /** Tables already picked in the form. */
  terpilih?: string[]
  /** Tables the crew already forced with approval for this date+time. */
  dipaksa?: string[]
  capOf?: (id: string) => number
  /** `dineEstMin` & `clashLeadMin` from the master, for the overstay and clash warnings. */
  master?: MasterDenah & { dineEstMin?: number, clashLeadMin?: number }
  dineEst?: number
  now?: number
}): StatusMeja {
  const { occ, later, mode, date, time, terpilih = [], dipaksa = [], capOf = () => 0, dineEst = dineEstOf(o.master), now = Date.now() } = o
  const id = String(t?.id ?? '')
  const list = partiesAt(occ, id)
  const shared = isJoinable(list)
  const fill = tableFill(t, list, capOf)
  const dipilih = terpilih.includes(id)
  const lebih = [...list, ...(later?.get(id) ?? [])]
  const base = {
    list,
    fill,
    lain: Math.max(0, list.length - 1),
    dipaksa: dipaksa.includes(id),
    over: list.length ? overStay(list[0]!, dineEst, now) : false,
    alih: lebih.length ? (perluDialihkan(lebih, clashLeadOf(o.master), now)?.nunggu ?? []) : [],
  }

  if (dipilih) return { ...base, state: 'terpilih', kunci: false, next: null }
  if (shared) return { ...base, state: 'sharing', kunci: false, next: null }

  if (list.length) {
    const r0 = list[0]!
    if (mode === 'pilih') {
      // A guest who is SITTING is dead out: the chair really is in use, and no
      // confirmation can change that. A table booked for later can be chosen
      // after the question (20 Sep 2026) — the ±3h guard is a rule, not a
      // physical fact, and the crew looking at the table is the one who can weigh it.
      const duduk = isSeated(r0) || mepetTerhadap(r0, date ?? '', time ?? '')
      return { ...base, state: STATE_STATUS[r0.status] ?? 'terkunci', kunci: !!duduk, next: null }
    }
    return { ...base, state: STATE_STATUS[r0.status] ?? 'terkunci', kunci: false, next: null }
  }

  // Free right now, but booked later — still clickable for a walk-in, whatever
  // the time gap. Its signs are graded, and that is what replaced the lock: what
  // is still far off gets its time, what is within the hour is marked URGENT.
  // One sign for both trains the crew to stop telling "5 hours away" from
  // "10 minutes away" — and only the tight one decides whether a guest may sit.
  const nx = nextBookingAt(later ?? new Map(), id)
  if (nx) {
    const m = menitMenuju(nx.res, now)
    return { ...base, state: mepetKah(m) ? 'mepet' : 'dipesan', kunci: mepetKah(m), next: nx.res, lain: nx.lebih }
  }
  return { ...base, state: 'kosong', kunci: false, next: null }
}
