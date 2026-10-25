// Marketing › Performa Omset & Bonus (docs/migrasi/marketing.md D.12 + F.17,
// issue #63) — the rules AROUND the bonus engine, ported from
// deploy/marketing/index.html:14483-14990.
//
// The engine itself (realisation, compliment cut, the four schemes) is
// IMPORTED from `performa-bonus.ts` — never copied (F.17). What lives here is
// this screen's own part: the event list built from the module (so events
// Finance has not entered yet are still shown), its join with the breakdown
// rows by srcId, the contribution column, and who may see whom.
import type { AggPic, EventDiakui, PicBonus } from '~/utils/performa-bonus'
import type { ClientMkt, EventMkt, SettingsMkt, UserMkt } from '~/utils/marketing'
import { eventFinance } from '~/utils/marketing-uang'

/** Closing statuses — the same list as Reporting (PFO_TUTUP). */
export const STATUS_PFO_MKT = ['Confirmed', 'Deal', 'Event Done']

/** Events per page in the Daftar Event table (PFO_PER_HAL). */
export const PER_HAL_PFO_MKT = 5

export interface VipPfo { id: string, jenis?: string, tanggal?: string, nama?: string, clientId?: string, perusahaan?: string, nominal?: number | string, mktPIC?: string, batalAt?: unknown }

/** One event as this module knows it. */
export interface AcaraPfoMkt {
  srcId: string
  sumber: 'mkt' | 'vip' | 'bd' | 'evt'
  date: string
  name: string
  /** Office user id of the marketing PIC on the event / VIP row. */
  picUser: string
  /** The module's own figure before any manual override (null for breakdown-only rows). */
  asal: number | null
  nominal: number | null
  /** Event nominal overridden on this screen (`nominalDiakui`). */
  timpa: boolean
}
export interface BarisPfoMkt extends AcaraPfoMkt {
  bd: (EventDiakui & { pic?: string }) | null
  hanyaBd?: boolean
}

/** VIP nominal counts only for Assisted (vipNominal :15390). */
export const nominalVipPfoMkt = (v: VipPfo) => (v?.jenis === 'Assisted' ? (Number(v.nominal) || 0) : 0)

/** VIP company from the CRM row first, the typed name as fallback (vipPerusahaan :15400). */
export function perusahaanVipPfoMkt(v: VipPfo, clients: ClientMkt[]): string {
  const c = v?.clientId ? clients.find(x => x.id === v.clientId) : null
  if (c) return c.perusahaan || c.nama || ''
  return v?.perusahaan || ''
}

const adaTimpa = (e: EventMkt & { nominalDiakui?: unknown }) => e.nominalDiakui != null && e.nominalDiakui !== ''

/**
 * The month's events of this module (pfoAcaraModul): closing events (nominal =
 * grand total of the offer, or the manual `nominalDiakui`) plus Assisted VIP
 * rows that are not cancelled — the same filter as vip_hari() on the server,
 * which turns them into breakdown rows. VIP names are written exactly as the
 * breakdown row writes them.
 */
export function acaraPfoMkt(events: EventMkt[], vip: VipPfo[], clients: ClientMkt[], st: SettingsMkt, bulan: string): AcaraPfoMkt[] {
  const out: AcaraPfoMkt[] = []
  for (const e of events) {
    if (!STATUS_PFO_MKT.includes(e.status)) continue
    const tgl = String(e.tanggal ?? '').slice(0, 10)
    if (tgl.slice(0, 7) !== bulan) continue
    const asal = eventFinance(e, st).grand
    const timpa = adaTimpa(e as EventMkt & { nominalDiakui?: unknown })
    out.push({
      srcId: `mkt:${e.id}`, sumber: 'mkt', date: tgl, name: e.nama || '(tanpa nama)', picUser: e.mktPIC || '',
      asal, nominal: timpa ? (Number((e as { nominalDiakui?: unknown }).nominalDiakui) || 0) : asal, timpa,
    })
  }
  for (const v of vip) {
    if (v.batalAt || v.jenis !== 'Assisted') continue
    const tgl = String(v.tanggal ?? '').slice(0, 10)
    if (tgl.slice(0, 7) !== bulan) continue
    const pt = perusahaanVipPfoMkt(v, clients)
    const nom = nominalVipPfoMkt(v)
    out.push({
      srcId: `vip:${v.id}`, sumber: 'vip', date: tgl, name: `VIP — ${v.nama || '(tanpa nama)'}${pt ? ` (${pt})` : ''}`,
      picUser: v.mktPIC || '', asal: nom, nominal: nom, timpa: false,
    })
  }
  return out
}

/** Kompas PIC of a module user: officeUserId first, the name only as fallback (pfoPicDari). */
export function picDariPfoMkt(uid: string, pics: PicBonus[], users: UserMkt[]): PicBonus | null {
  if (!uid) return null
  const p = pics.find(x => x.officeUserId != null && String(x.officeUserId) === String(uid))
  if (p) return p
  const u = users.find(x => String(x.id) === String(uid))
  const nm = u ? String(u.name || '').trim().toLowerCase() : ''
  return nm ? pics.find(x => String(x.name || '').trim().toLowerCase() === nm) ?? null : null
}

/**
 * Module events joined with the breakdown rows by srcId (pfoGabung). Breakdown
 * rows WITHOUT a partner stay (`hanyaBd`): manual finance rows, or events whose
 * PIC differs here — both are recognised money, and dropping them would make
 * the Diakui column stop adding up to the Realisasi card.
 */
export function gabungPfoMkt(acara: AcaraPfoMkt[], bdEvents: (EventDiakui & { pic?: string })[], pid: string, picDari: (uid: string) => PicBonus | null): BarisPfoMkt[] {
  const bySrc = new Map<string, EventDiakui & { pic?: string }>()
  for (const ev of bdEvents) if (ev.srcId) bySrc.set(ev.srcId, ev)
  const pakai = new Set<string>()
  const out: BarisPfoMkt[] = []
  for (const x of acara) {
    if (pid !== '__all__') {
      const q = picDari(x.picUser)
      if (!q || String(q.id) !== String(pid)) continue
    }
    const bd = bySrc.get(x.srcId) ?? null
    if (bd) pakai.add(x.srcId)
    out.push({ ...x, bd })
  }
  for (const ev of bdEvents) {
    if (ev.srcId && pakai.has(ev.srcId)) continue
    out.push({ srcId: String(ev.srcId || ''), sumber: 'bd', date: ev.date, name: ev.name || '(tanpa nama)', picUser: '', asal: null, nominal: null, timpa: false, bd: ev, hanyaBd: true })
  }
  return out.sort((x, y) => (x.date !== y.date ? (x.date < y.date ? -1 : 1) : String(x.name).localeCompare(String(y.name))))
}

/** Diakui vs Nominal: 0 = "cocok", otherwise the signed gap; null when one side is missing. */
export function bedaDiakuiPfoMkt(r: BarisPfoMkt): number | null {
  if (!r.bd || r.nominal == null) return null
  return (Number(r.bd.porsi) || 0) - (Number(r.nominal) || 0)
}

/**
 * "Kontribusi hari itu" = (omset + tax + service + Open Bill) / the venue's
 * omset that day (pfoSelKontribusi). Null = no omset that day yet ("belum ada
 * omset"), never 0%.
 */
export function kontribusiPfoMkt(ev: { amount?: number, tax?: number, service?: number, ob?: number }, omsetHari: number | undefined): number | null {
  if (!omsetHari) return null
  const nilai = (Number(ev.amount) || 0) + (Number(ev.tax) || 0) + (Number(ev.service) || 0) + (Number(ev.ob) || 0)
  return nilai / omsetHari * 100
}

/** The PIC representing the signed-in person (pfoAkuPic): Office id first, name as fallback. */
export function akuPicPfoMkt(me: { id?: string, name?: string } | null, pics: PicBonus[]): PicBonus | null {
  if (!me) return null
  const p = pics.find(x => x.officeUserId != null && String(x.officeUserId) === String(me.id))
  if (p) return p
  const nm = String(me.name || '').trim().toLowerCase()
  return pics.find(x => String(x.name || '').trim().toLowerCase() === nm) ?? null
}

/** May this segment be shown (pfoBolehLihat): "Semua" always; others only whole-team viewers or self. */
export function bolehLihatPfoMkt(pid: string, bolehSemua: boolean, aku: PicBonus | null): boolean {
  if (pid === '__all__') return true
  if (bolehSemua) return true
  return !!aku && String(aku.id) === String(pid)
}

/**
 * "Semua PIC" combined (the old gambar('__all__')). PIC names ride along on the
 * events only for whole-team viewers — otherwise the list would name who earned
 * what, the very thing the access rule forbids.
 */
export function gabunganPfoMkt(list: PicBonus[], agg: Record<string, AggPic>, sertakanPic: boolean): AggPic & { events: (EventDiakui & { pic?: string })[] } {
  const a: AggPic & { events: (EventDiakui & { pic?: string })[] } = { real: 0, events: [], comp: 0, compRows: [] }
  for (const x of list) {
    const g = agg[x.id]
    if (!g) continue
    a.real += g.real
    a.comp = (a.comp ?? 0) + (g.comp ?? 0)
    a.compRows!.push(...(g.compRows ?? []))
    for (const ev of g.events) a.events.push(sertakanPic ? { pic: x.name, ...ev } : ev)
  }
  return a
}

/** Office Tim/Keterangan of a kompas PIC through the module's users (pfoPasangKeterangan). */
export function ketDariUsersPfoMkt(users: UserMkt[]) {
  return (e: PicBonus): string | null => {
    let u: UserMkt | undefined
    if (e.officeUserId != null && e.officeUserId !== '') u = users.find(x => String(x.id) === String(e.officeUserId))
    if (!u && e.name) {
      const nm = String(e.name).trim().toLowerCase()
      u = users.find(x => String(x.name || '').trim().toLowerCase() === nm)
    }
    return u ? String(u.jabatan || '') : null
  }
}

/** Parse a typed rupiah: digits only; '' stays '' (= restore / clear). */
export const digitRupiahPfoMkt = (teks: string) => String(teks ?? '').replace(/\D/g, '')
