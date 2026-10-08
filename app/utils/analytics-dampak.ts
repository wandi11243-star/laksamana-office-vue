// Shared arithmetic of the two impact screens (Pengaruh Event & Pengaruh
// Marketing). Port of vDampak + barisBd + omsetBdAcara + kartuTop3
// (deploy/analytics/index.html), drawn from three read-only sources:
// the stored POS month, the Event/Marketing module states, and the Kompas
// blob's Breakdown Sumber (daily[].bd). Pure functions only: pages fetch,
// this file computes. Open Bill comes from ~/utils/performa-bonus
// (pbObTotal) — imported, never copied.
import { pbObTotal } from '~/utils/performa-bonus'

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
