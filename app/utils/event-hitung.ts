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
import type { Acara, JadwalTalent, KelasTiket, OrderTiket, Tiket } from '~/composables/useEvent'
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

/** `salesRingkas(eid)` (`:6919-6976`): per-class count & rupiah of non-refunded
 *  tickets, returned amount, valid tickets. Refunds are EMS crew work. */
export function ringkasPenjualan(
  eid: string,
  tiket: Pick<Tiket, 'event_id' | 'ticket_class_id' | 'status'>[],
  kelas: Pick<KelasTiket, 'id' | 'event_id' | 'name' | 'price'>[],
) {
  const milik = tiket.filter(t => t.event_id === eid && (t.status ?? '') !== 'Refunded')
  const kembali = tiket.filter(t => t.event_id === eid && (t.status ?? '') === 'Refunded')
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
  const mulai = new Map(acara.map(e => [e.id, String(e.start_datetime ?? '').slice(0, 7)]))
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
