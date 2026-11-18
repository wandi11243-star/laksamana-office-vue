// Marketing › invoice, approval, reporting, notification, timeline (issue #60).
// Pure rules of the five screens (docs/migrasi/marketing.md D.9, D.11,
// D.16–D.18, F.16). No API, no Vue. Tested by tools/uji-marketing-keuangan.mjs.
//
// Source: laksamana-office deploy/marketing/index.html
//   :13419 invResId · :13464 mktPraPelunasan · :13476 invRingkasMkt
//   :13529 muatInvMkt · :13575 invNoResmi · :13602 slotInvIsi · :13645 mintaInvoiceMkt
//   :13158 invoice rows (Confirmed/Deal/Event Done) · :13192 bayarTab
//   :14216 approvalRows (pen + nego) · :14273 putusPenawaran/decideApproval
//   :18551 reports + :18622 exportCSV · :5738 unduhCsv
//   :18631 timeline (KOL_TIMELINE, tlLabel, tlRef) · :18770 clearActivities
//   :18681 notifications (live reminders, notifGo, markAllRead)
import type { ClientMkt, EventMkt, SettingsMkt } from '~/utils/marketing'
import { STATUS_OMSET_MKT, TAHAP_TERBUKA_MKT, hariAntaraMkt } from '~/utils/marketing'
import type { UangEventMkt } from '~/utils/marketing-uang'
import { eventFinance, invStatus } from '~/utils/marketing-uang'
import { rupiah } from '~/utils/format'

// ---------------------------------------------------------------- invoices

/** Invoice & Payment only sees closing stages (F.16): Confirmed is the old
 * name of Deal — dropping it would hide real bills (renderInvoices). */
export const layakTagihMkt = (events: EventMkt[]) => events.filter(e => STATUS_OMSET_MKT.includes(e.status))

export interface RingkasUangMkt { inv: string, remaining: number, paid: number }

/** The four cards: piutang (closing, still owed), overdue, paid, hidden drafts. */
export function rekapInvoiceMkt(rows: RingkasUangMkt[], nDraft: number) {
  return {
    piutang: rows.filter(r => r.remaining > 0).reduce((a, r) => a + r.remaining, 0),
    overdue: rows.filter(r => r.inv === 'Overdue').length,
    lunas: rows.filter(r => r.inv === 'Paid').length,
    draft: nDraft,
  }
}

export type TabBayarMkt = 'upcoming' | 'lewat' | 'semua' | 'lunas' | 'dp' | 'belum'

/**
 * bayarTab: lunas = nothing left; dp = something in; belum = nothing yet.
 * Owner request (Nov 2026) put two date tabs in front: upcoming = the event
 * is today or later (any payment state); lewat = the event is past and money
 * is still owed. Both need the event date and today (YYYY-MM-DD).
 */
export function kelompokBayarMkt(tab: TabBayarMkt, r: RingkasUangMkt & { tanggal?: string, hari?: string }): boolean {
  if (tab === 'semua') return true
  if (tab === 'upcoming') return !!r.tanggal && !!r.hari && r.tanggal >= r.hari
  if (tab === 'lewat') return !!r.tanggal && !!r.hari && r.tanggal < r.hari && r.remaining > 0
  if (tab === 'lunas') return r.remaining <= 0
  if (tab === 'dp') return r.paid > 0 && r.remaining > 0
  return r.paid <= 0
}

export const resIdInvMkt = (evId: string, jenis: 'dp' | 'lunas') => `mkt:${evId}:${jenis}`

export interface StatusInvMkt { status?: string, no?: string, catatan?: string }

/** The ONE official number, from Finance: pelunasan first (invNoResmi). */
export function noResmiInvMkt(peta: Record<string, StatusInvMkt>, evId: string): string {
  const lunas = peta[resIdInvMkt(evId, 'lunas')]
  if (lunas?.status === 'DIBUAT' && lunas.no) return lunas.no
  const dp = peta[resIdInvMkt(evId, 'dp')]
  if (dp?.status === 'DIBUAT' && dp.no) return dp.no
  return ''
}

/** Loading reads as "checking" so a pending fetch never looks like "not issued". */
export function teksNoInvMkt(peta: Record<string, StatusInvMkt>, evId: string, memuat: boolean): string {
  const no = noResmiInvMkt(peta, evId)
  if (no) return no
  if (memuat) return 'memeriksa ke Finance…'
  return 'belum diterbitkan Finance'
}

/** DP exists once money is in — recorded rows or the ticked DP alike. */
export const punyaDpMkt = (uang: UangEventMkt) => uang.paid > 0

/** Pelunasan: a Pelunasan row, or nothing left on a non-zero bill. */
export function punyaPelunasanMkt(ev: EventMkt, uang: UangEventMkt): boolean {
  if ((ev.payments ?? []).some(p => String(p.type ?? '') === 'Pelunasan')) return true
  return uang.grand > 0 && uang.remaining <= 0
}

export interface PraPelunasanMkt { dpRow: number, dpCentang: number, dpMasuk: number, lain: number, praBayar: number, tagih: number }

/**
 * What the pelunasan sheet really bills (mktPraPelunasan): the remainder
 * BEFORE the pelunasan itself — total minus DP and earlier payments — never
 * f.remaining, which is already zero by request time.
 */
export function praPelunasanMkt(ev: EventMkt, uang: UangEventMkt): PraPelunasanMkt {
  const p = ev.payments ?? []
  const jml = (fn: (x: (typeof p)[number]) => boolean) => p.filter(fn).reduce((a, x) => a + (+(x.amount ?? 0) || 0), 0)
  const dpRow = jml(x => String(x.type ?? '') === 'DP')
  const lain = jml((x) => {
    const t = String(x.type ?? '')
    return t !== 'DP' && t !== 'Pelunasan'
  })
  const dpCentang = uang.dpCentang ? Math.max(0, uang.dp - dpRow - lain) : 0
  const dpMasuk = dpRow + dpCentang
  return { dpRow, dpCentang, dpMasuk, lain, praBayar: dpMasuk + lain, tagih: Math.max(0, uang.grand - dpMasuk - lain) }
}

export interface BarisRingkasMkt { desc: string, qty: number, harga: number, total: number }
export interface BayarRingkasMkt { jenis: string, nominal: number, tanggal: string, metode: string, no: string, adaBukti: boolean, catatan: string }

/**
 * What travels with the request (invRingkasMkt): enough for Finance to
 * decide & print — never the whole event row (internal notes, client HP).
 */
export function ringkasInvMkt(
  ev: EventMkt, jenis: 'INV_DP' | 'INV_LUNAS', uang: UangEventMkt, pra: PraPelunasanMkt,
  namaClient: string, perusahaan: string, picClient: string, namaPic: string,
) {
  const d = (ev.detail ?? {}) as Record<string, unknown>
  const items: BarisRingkasMkt[] = ((Array.isArray(d.rincianItem) ? d.rincianItem : []) as Record<string, unknown>[])
    .filter(r => String((r.jenis as string) || 'bayar') === 'bayar')
    .map((r) => {
      const qty = (+(r.jumlah as number) || 0) || 1
      const harga = +(r.harga as number) || 0
      return { desc: String(r.desc ?? ''), qty, harga, total: qty * harga }
    })
  const bayar: BayarRingkasMkt[] = (ev.payments ?? []).map(p => ({
    jenis: String(p.type ?? ''), nominal: +(p.amount ?? 0) || 0, tanggal: String(p.at ?? ''),
    metode: String(p.method ?? ''), no: String(p.no ?? ''), adaBukti: !!p.receiptUrl, catatan: String(p.receipt ?? ''),
  }))
  return {
    jenisDok: jenis, client: namaClient, perusahaan, picClient,
    event: ev.nama, jenisAcara: ev.jenis ?? '', tanggal: ev.tanggal ?? '', pax: +(ev.pax ?? 0) || 0,
    noInternal: '', pic: namaPic,
    sub: uang.sub, disc: uang.disc, service: uang.service, tax: uang.tax, taxPct: uang.taxPct,
    grand: uang.grand, dp: uang.dp, paid: uang.paid, remaining: uang.remaining,
    dpBayar: bayar.filter(p => p.jenis === 'DP').reduce((a, p) => a + p.nominal, 0),
    tagih: pra.tagih, praBayar: pra.praBayar, items, bayar,
  }
}

export const INV_KOP_MKT = {
  pt: 'PT. Laksamana Muda Bersatu',
  alamat: 'Jl. Soekarno - Hatta No. 39, Labuh Baru Tim, Kec. Payung Sekaki, Kota Pekanbaru, Riau 28282',
  bank: 'UOB | PT. Laksamana Muda Bersatu',
  rek: '319-303-3588',
}

// ---------------------------------------------------------------- approvals

export interface BarisApprovalMkt {
  jenis: string
  kind: 'pen' | 'nego'
  revisi: number
  rid: string
  ev: EventMkt
  perkara: string
  sub: string
  catatan: string
  tolakNote: string
  nilai: number
  olehId?: string
  pada: string
  status: string
  antri: boolean
  putusId?: string
  putusPada: string
  tanpaBerkas?: boolean
}

export const jenisPerkaraMkt = (revisi: number) => (revisi > 0 ? 'Negosiasi Lanjutan' : 'Surat Penawaran')

/**
 * One list for two different sources (approvalRows): penawaran rows from the
 * events, negotiation rows from /approvals — normalized once, here.
 */
export function barisApprovalMkt(events: EventMkt[], approvals: Record<string, unknown>[], st: SettingsMkt): BarisApprovalMkt[] {
  const out: BarisApprovalMkt[] = []
  for (const e of events) {
    const p = (e.penawaran ?? {}) as Record<string, unknown>
    const status = String(p.status ?? '')
    if (!status || status === 'Draft') continue
    const rev = +(p.revisiKe ?? 0) || 0
    const berkas = p.file as { key?: string } | undefined
    out.push({
      jenis: jenisPerkaraMkt(rev), kind: 'pen', revisi: rev, rid: e.id, ev: e,
      perkara: `${String(p.noSurat ?? '—')}${rev ? ` · revisi ke-${rev}` : ''}`,
      sub: rev ? String(p.revisiAlasan ?? 'permintaan client') : (p.validUntil ? `berlaku s/d ${String(p.validUntil)}` : ''),
      catatan: String(p.note ?? ''),
      tolakNote: status === 'Ditolak' ? String(p.rejectNote ?? '') : '',
      nilai: eventFinance(e, st).grand,
      olehId: String(p.submittedBy ?? ''), pada: String(p.submittedAt ?? ''),
      status, antri: status === 'Menunggu Approval',
      putusId: String(p.approvedBy ?? p.decidedBy ?? ''), putusPada: String(p.approvedAt ?? p.decidedAt ?? ''),
      tanpaBerkas: !berkas?.key,
    })
  }
  for (const a of approvals) {
    const e = events.find(x => x.id === String(a.eventId ?? ''))
    if (!e) continue
    const status = String(a.status ?? '')
    out.push({
      jenis: 'Negosiasi Harga', kind: 'nego', revisi: 0, rid: String(a.id ?? ''), ev: e,
      perkara: String(a.reason ?? '—'), sub: '', catatan: '',
      tolakNote: status === 'Rejected' ? String(a.note ?? '') : '',
      nilai: eventFinance(e, st).grand,
      olehId: String(a.by ?? ''), pada: String(a.at ?? ''),
      status, antri: status === 'Pending',
      putusId: String(a.by2 ?? ''), putusPada: String(a.decidedAt ?? ''),
    })
  }
  return out
}

/** The three cards: first-round waiting, follow-up waiting, and their totals. */
export function rekapApprovalMkt(rows: BarisApprovalMkt[]) {
  const pen = rows.filter(r => r.kind === 'pen' && !r.revisi)
  const rev = rows.filter(r => (r.kind === 'pen' && !!r.revisi) || r.kind === 'nego')
  return {
    pen: pen.filter(r => r.antri).length, penTotal: pen.length,
    rev: rev.filter(r => r.antri).length, revTotal: rev.length,
    antri: rows.filter(r => r.antri).length, total: rows.length,
  }
}

// ---------------------------------------------------------------- reports

export interface BarisLaporanMkt { jenis: string, n: number, total: number }

/** Omset & event count per category for one month, biggest first + TOTAL. */
export function laporanMkt(events: EventMkt[], st: SettingsMkt, bulan: string) {
  const tutup = events.filter(e => STATUS_OMSET_MKT.includes(e.status) && String(e.tanggal ?? '').slice(0, 7) === bulan)
  const per = new Map<string, { n: number, total: number }>()
  for (const e of tutup) {
    const k = String(e.jenis ?? '').trim() || '(tanpa jenis)'
    const x = per.get(k) ?? { n: 0, total: 0 }
    x.n++
    x.total += eventFinance(e, st).grand
    per.set(k, x)
  }
  const baris: BarisLaporanMkt[] = [...per.entries()]
    .map(([jenis, x]) => ({ jenis, ...x }))
    .sort((a, b) => b.total - a.total)
  const total = baris.reduce((a, b) => a + b.total, 0)
  return { total, n: tutup.length, rata: tutup.length ? Math.round(total / tutup.length) : 0, baris }
}

/** CSV rows (exportCSV): the header + every event, money included. */
export function barisCsvMkt(events: EventMkt[], namaClient: (id: string) => string, namaUser: (id?: string) => string, st: SettingsMkt): (string | number)[][] {
  const out: (string | number)[][] = [['Event', 'Client', 'Jenis', 'Tanggal', 'Status', 'Pax', 'Grand Total', 'DP', 'Terbayar', 'Sisa', 'Marketing PIC']]
  for (const e of events) {
    const f = eventFinance(e, st)
    out.push([e.nama, namaClient(e.clientId), e.jenis ?? '', e.tanggal ?? '', e.status, +(e.pax ?? 0) || 0, f.grand, f.dp, f.paid, f.remaining, namaUser(e.mktPIC)])
  }
  return out
}

/** Excel id-ID friendly: BOM + sep=, CRLF, quoted (unduhCsv). */
export function csvMkt(baris: (string | number)[][]): string {
  const isi = baris.map(r => r.map(sel => `"${String(sel ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  return '\ufeffsep=,\r\n' + isi
}

export const namaBerkasCsvMkt = (hari: string) => `laksamana_events_${hari}.csv`

// ---------------------------------------------------------------- notifications

export interface PengingatMkt { type: string, title: string, body: string, link: string }
export interface NotifMkt { id?: string, type?: string, title?: string, body?: string, link?: string, read?: boolean, at?: string | number, updatedAt?: number }

/**
 * Live reminders, computed — never stored (renderNotifications :18797-18803).
 * `progres` = taskProgress(e) of the old screen (readiness of the divisions, %).
 */
export function pengingatMkt(events: EventMkt[], clients: ClientMkt[], st: SettingsMkt, hari: string, progres: (e: EventMkt) => number = () => 0): PengingatMkt[] {
  const live: PengingatMkt[] = []
  const nama = (id: string) => clients.find(c => c.id === id)?.nama ?? '—'
  for (const e of events.filter(x => ['Confirmed', 'Deal'].includes(x.status) && eventFinance(x, st).paid === 0))
    live.push({ type: 'dp', title: 'DP belum masuk', body: `${e.nama} — DP ${rupiah(eventFinance(e, st).dp)} belum diverifikasi.`, link: `/marketing/event/${e.id}` })
  for (const e of events) {
    const d = hariAntaraMkt(hari, String(e.tanggal ?? ''))
    if (['Confirmed', 'Deal'].includes(e.status) && d >= 0 && d <= 7)
      live.push({ type: 'event', title: d === 0 ? 'Event HARI INI' : `Event H-${d}`, body: `${e.nama} · cek kesiapan divisi (${progres(e)}%).`, link: `/marketing/event/${e.id}` })
  }
  for (const e of events.filter(x => TAHAP_TERBUKA_MKT.includes(x.status) && x.nextFU === hari))
    live.push({ type: 'fu', title: 'Follow up hari ini', body: `${e.nama} · ${nama(e.clientId)}`, link: '/marketing/pipeline' })
  for (const c of clients.filter(x => x.nextFU === hari && !events.some(e => e.clientId === x.id && TAHAP_TERBUKA_MKT.includes(e.status))))
    live.push({ type: 'fu', title: 'Follow up (nurture)', body: String(c.nama ?? ''), link: '/marketing/pipeline' })
  for (const e of events.filter(x => invStatus(x, st, hari) === 'Overdue'))
    live.push({ type: 'inv', title: 'Invoice Overdue', body: `${e.nama} lewat H-7 tanpa pelunasan.`, link: `/marketing/event/${e.id}` })
  return live
}

export const belumDibacaMkt = (notifs: NotifMkt[]) => notifs.filter(n => !n.read).length

/** Old '#event/<id>' links → Vue paths (notifGo). */
export function linkNotifMkt(link?: string): string {
  const l = String(link ?? '')
  if (l.startsWith('/')) return l
  const partes = l.replace(/^#/, '').split('/')
  const peta: Record<string, string> = { event: '/marketing/event', pipeline: '/marketing/pipeline', approvals: '/marketing/approvals' }
  const dasar = peta[partes[0] ?? ''] ?? '/marketing/dashboard'
  return partes[1] ? `${dasar}/${partes[1]}` : dasar
}

// ---------------------------------------------------------------- timeline

/** CLIENT/EVENT/USER/… tag of an activity row (tlLabel). */
export const labelJenisMkt = (refType?: string) =>
  ({ client: 'CLIENT', event: 'EVENT', user: 'USER', template: 'TEMPLATE' }[String(refType ?? '')] ?? String(refType ?? '').toUpperCase())

/** "x menit/jam/hari lalu" for the Waktu column. */
export function laluMkt(at?: string | number, kini = Date.now()): string {
  const ts = typeof at === 'number' ? at : Date.parse(String(at ?? ''))
  if (!ts || Number.isNaN(ts)) return '—'
  const s = Math.max(0, (kini - ts) / 1000)
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  return `${Math.floor(s / 86400)} hari lalu`
}
