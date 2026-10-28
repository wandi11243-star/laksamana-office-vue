// Shared arithmetic of the two impact screens (Pengaruh Event & Pengaruh
// Marketing). Port of vDampak + barisBd + omsetBdAcara + kartuTop3
// (deploy/analytics/index.html), drawn from three read-only sources:
// the stored POS month, the Event/Marketing module states, and the Kompas
// blob's Breakdown Sumber (daily[].bd). Pure functions only: pages fetch,
// this file computes. Open Bill comes from ~/utils/performa-bonus
// (pbObTotal) — imported, never copied.
// NOTE: the value import below is relative with an explicit extension
// (./performa-bonus.ts), not ~/, so plain Node can run this file in
// tools/uji-analytics.mjs — the same rule as analytics-agregat.ts.
import { diRentang } from './analytics-agregat.ts'
import { pbObTotal } from './performa-bonus.ts'

export interface AcaraDampak { tgl: string, judul: string, sumber: 'Event' | 'Marketing', kategori: string }
export interface BdAcara { tgl: string, nama: string, omset: number }

const num = (v: unknown) => Number(v ?? 0) || 0

/** Only "Event Done" counts: the screen measures the impact of a show that
 *  really happened (case-insensitive, trimmed — typed by people). */
export const acaraSelesai = (status: unknown) =>
  String(status ?? '').trim().toLowerCase() === 'event done'

/** One breakdown row = what the guest was REALLY billed (amount+tax+service+Open Bill). */
export function omsetBdAcara(r: Record<string, unknown>): number {
  return num(r.amount) + num(r.tax) + num(r.service)
    + pbObTotal({
      ob: r.ob === true,
      obAmount: r.obAmount as number | string | undefined,
      obTax: r.obTax as number | string | undefined,
      obService: r.obService as number | string | undefined,
    })
}

/** Breakdown rows of one source ('Event'|'Marketing') inside one month. */
export function barisBdSumber(
  daily: { date?: unknown, bd?: Record<string, unknown> }[],
  sumber: 'Event' | 'Marketing',
  bulan: string,
): BdAcara[] {
  const kunci = sumber === 'Event' ? 'event' : 'marketing'
  const out: BdAcara[] = []
  for (const d of daily ?? []) {
    const t = String(d?.date ?? '').slice(0, 10)
    if (!t || !t.startsWith(bulan)) continue
    const bd = (d?.bd ?? {}) as Record<string, unknown>
    const rows = Array.isArray(bd[kunci]) ? bd[kunci] as Record<string, unknown>[] : []
    for (const r of rows) {
      out.push({ tgl: t, nama: String(r?.eventName ?? '').trim(), omset: omsetBdAcara(r) })
    }
  }
  return out
}

export interface HitungDampak {
  adaEv: string[]
  tanpa: string[]
  abuAbu: string[]
  rEv: number
  rNo: number
  omsetEv: number
  omsetSaja: number
  totalBulan: number
  bdHari: Record<string, number>
  belum: number
}

/** Split the month's dates into event days / plain days / grey days (an
 *  unfinished show must not pose as a plain day). */
export function hitungDampakPenuh(
  hari: Record<string, { grand?: number }>,
  selesai: AcaraDampak[],
  belumSelesai: AcaraDampak[],
  bdRows: BdAcara[],
): HitungDampak {
  const tgl = Object.keys(hari).sort()
  const totalBulan = tgl.reduce((a, t) => a + (hari[t]?.grand ?? 0), 0)
  const peta: Record<string, boolean> = {}
  for (const e of selesai) peta[e.tgl] = true
  const petaBelum: Record<string, boolean> = {}
  for (const e of belumSelesai) petaBelum[e.tgl] = true
  const adaEv = tgl.filter(t => peta[t])
  const tanpa = tgl.filter(t => !peta[t] && !petaBelum[t])
  const abuAbu = tgl.filter(t => !peta[t] && petaBelum[t])
  const bdHari: Record<string, number> = {}
  for (const r of bdRows) bdHari[r.tgl] = (bdHari[r.tgl] ?? 0) + r.omset
  const rata = (arr: string[]) => arr.length
    ? arr.reduce((a, t) => a + (hari[t]?.grand ?? 0), 0) / arr.length
    : 0
  const omsetEv = adaEv.reduce((a, t) => a + (hari[t]?.grand ?? 0), 0)
  const omsetSaja = adaEv.reduce((a, t) => a + (bdHari[t] ?? 0), 0)
  return {
    adaEv, tanpa, abuAbu, rEv: rata(adaEv), rNo: rata(tanpa),
    omsetEv, omsetSaja, totalBulan, bdHari, belum: belumSelesai.length,
  }
}

export interface TopAcara { nama: string, omset: number, tgl: string[] }

/** Top-3 contributing shows, grouped per NAME (a multi-day show is one row).
 *  Nameless rows stay separate — merging them would crown a pile of
 *  unrelated shows. Zero-valued rows are dropped. */
export function top3Acara(rows: BdAcara[]): { top: TopAcara[], sisa: number, sisaOmset: number, tanpaNama: number } {
  const pakai = rows.filter(r => r.omset > 0)
  const tanpaNama = pakai.filter(r => !r.nama).length
  const peta: Record<string, TopAcara> = {}
  const daftar: TopAcara[] = []
  for (const r of pakai) {
    if (!r.nama) {
      daftar.push({ nama: '(tanpa nama)', omset: r.omset, tgl: [r.tgl] })
      continue
    }
    const k = r.nama.toLowerCase()
    if (!peta[k]) {
      peta[k] = { nama: r.nama, omset: 0, tgl: [] }
      daftar.push(peta[k])
    }
    peta[k]!.omset += r.omset
    if (!peta[k]!.tgl.includes(r.tgl)) peta[k]!.tgl.push(r.tgl)
  }
  daftar.sort((a, x) => x.omset - a.omset || (a.nama < x.nama ? -1 : 1))
  const top = daftar.slice(0, 3)
  const sisa = daftar.slice(3)
  return {
    top, sisa: sisa.length,
    sisaOmset: sisa.reduce((a, x) => a + x.omset, 0), tanpaNama,
  }
}

/** Weekday of 'YYYY-MM-DD' (local, no zone shift). */
export const dowDari = (t: string) => new Date(`${t}T00:00:00`).getDay()

// ---------------------------------------------------------------- origin per shift
// Walk In / Event / Marketing per shift (asalAcaraBulan + tabelAsalShift,
// deploy/analytics/index.html:1151-1240). POS does not mark which bill
// belongs to a show; the Breakdown Sumber does, and each row lands on the
// shift of its show's START time. A row without a known time is never
// guessed into a shift.

/** 'HH:MM' from 'HH:MM' / 'HH:MM:SS'; anything else is '' (`jamPolos`, :1165). */
export function jamPolosAn(v: unknown): string {
  const m = String(v ?? '').trim().match(/^(\d{1,2})[:.](\d{2})/)
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return ''
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

/** WIB 'HH:MM' of an Event start_datetime: zoned instants shift +7 h fixed, zoneless ones read as is (`jamWIB`, :1174). */
export function jamWibAn(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s)
    if (Number.isNaN(t)) return ''
    const w = new Date(t + 7 * 3600000)
    return `${String(w.getUTCHours()).padStart(2, '0')}:${String(w.getUTCMinutes()).padStart(2, '0')}`
  }
  const m = s.match(/[T ](\d{1,2}:\d{2})/)
  return m ? jamPolosAn(m[1]) : ''
}

type Baris = Record<string, unknown>
const arr = (v: unknown): Baris[] => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as Baris[] : [])

/**
 * srcId -> start time of the show (`EVJAM`, :1292-1357): `evt:<id>` from the
 * Event module, `mkt:<id>` from Marketing (guests' arrival first, then set-up
 * — the shift is when guests spend), `vip:<id>` from Reservasi VIP.
 */
export function petaJamAcara(eventState: unknown, mktState: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const ev = (eventState ?? {}) as Baris
  const mk = (mktState ?? {}) as Baris
  for (const x of arr(ev.events)) {
    const j = jamWibAn(x.start_datetime)
    if (x.id != null && j) out[`evt:${x.id}`] = j
  }
  for (const x of arr(mk.events)) {
    const dt = (x.detail ?? {}) as Baris
    const j = jamPolosAn(dt.tamuDatang) || jamPolosAn(dt.mulaiSetup)
    if (x.id != null && j) out[`mkt:${x.id}`] = j
  }
  for (const v of arr(mk.vip)) {
    const j = jamPolosAn(v.jamMulai)
    if (v.id != null && j) out[`vip:${v.id}`] = j
  }
  return out
}

export interface BdJam { tgl: string, omset: number, jam: string, src: string, nama: string }

/** Breakdown rows of one source in one month, each with its show's start time (`barisBd`, :1112). */
export function barisBdJam(
  daily: { date?: unknown, bd?: Record<string, unknown> }[],
  sumber: 'Event' | 'Marketing',
  bulan: string,
  jam: Record<string, string>,
): BdJam[] {
  const kunci = sumber === 'Event' ? 'event' : 'marketing'
  const out: BdJam[] = []
  for (const d of daily ?? []) {
    const t = String(d?.date ?? '').slice(0, 10)
    if (!t || !t.startsWith(bulan)) continue
    const bd = (d?.bd ?? {}) as Record<string, unknown>
    for (const r of arr(bd[kunci])) {
      const src = String(r.srcId ?? '')
      out.push({ tgl: t, omset: omsetBdAcara(r), jam: (src && jam[src]) || '', src, nama: String(r.eventName ?? '').trim() })
    }
  }
  return out
}

export type KunciShift = 's1' | 's2' | 'lain'

/** Shift of a show by its start hour; '' when the hour is unknown (`asalShift`, :1194). */
export function asalShift(jam: string, s: { s1a: number, s1b: number, s2a: number, s2b: number }): KunciShift | '' {
  const m = String(jam || '').match(/^(\d{2}):/)
  if (!m) return ''
  const j = Number(m[1])
  if (diRentang(j, s.s1a, s.s1b)) return 's1'
  if (diRentang(j, s.s2a, s.s2b % 24)) return 's2'
  return 'lain'
}

export interface AsalPerShift {
  ev: Record<KunciShift | '', number>
  mk: Record<KunciShift | '', number>
  /** Walk In per shift, clamped at 0. */
  wi: Record<KunciShift, number>
  /** Show turnover without a known start time. */
  tak: number
  /** How much the shows exceed POS in some shift (Walk In written as 0). */
  minus: number
  kolom: KunciShift[]
}

/** The table under the Dua Shift cards (`tabelAsalShift`, :1202). `tot` IS the cards' numbers, so the Total row equals them. */
export function hitungAsalShift(
  ev: BdJam[],
  mk: BdJam[],
  tot: Record<KunciShift, number>,
  s: { s1a: number, s1b: number, s2a: number, s2b: number },
): AsalPerShift {
  const nol = (): Record<KunciShift | '', number> => ({ 's1': 0, 's2': 0, 'lain': 0, '': 0 })
  const e = nol()
  const m = nol()
  for (const r of ev) e[asalShift(r.jam, s)] += r.omset
  for (const r of mk) m[asalShift(r.jam, s)] += r.omset
  const wi = { s1: 0, s2: 0, lain: 0 }
  let minus = 0
  for (const k of ['s1', 's2', 'lain'] as const) {
    const v = tot[k] - e[k] - m[k]
    wi[k] = Math.max(0, v)
    if (v < -0.5) minus += -v
  }
  const tampilLain = tot.lain > 0 || e.lain > 0 || m.lain > 0
  return { ev: e, mk: m, wi, tak: e[''] + m[''], minus, kolom: tampilLain ? ['s1', 's2', 'lain'] : ['s1', 's2'] }
}

/**
 * Days with a finished show whose Breakdown Sumber has no row from that source
 * yet — its turnover still counts as Walk In (`asalAcaraBulan`, :1155-1161).
 */
export function hariBelumBd(
  acara: { tgl: string, sumber: 'Event' | 'Marketing', status: unknown }[],
  ev: BdJam[],
  mk: BdJam[],
  bulan: string,
): number {
  const ada = { Event: new Set(ev.map(r => r.tgl)), Marketing: new Set(mk.map(r => r.tgl)) }
  const belum = new Set<string>()
  for (const a of acara) {
    if (!a.tgl.startsWith(bulan) || !acaraSelesai(a.status)) continue
    if (!ada[a.sumber].has(a.tgl)) belum.add(`${a.sumber}|${a.tgl}`)
  }
  return belum.size
}

/** Distinct shows behind breakdown rows: by srcId, else date + name (`nAcara`, :4078). */
export const jumlahAcaraBd = (rows: BdJam[]) => new Set(rows.map(r => r.src || `${r.tgl}|${r.nama.toLowerCase()}`)).size
