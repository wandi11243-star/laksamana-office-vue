// Event refund execution — the one place that runs a refund, ported 1:1 from
// the old client so the new approval and the "Selesaikan refund" repair button
// can never drift apart (two copies of this rule once left sold seats
// permanently unsellable).
//
// No API, no Vue: the pages pass their `patchEvent` in, so this stays
// importable from plain node for tools/uji-event-refund.mjs.
//
// Sources (all in laksamana-office/deploy/event/index.html):
//   refundAktif :10097 · requestRefund :10100 (one living request per order)
//   approveRefund :10140 (confirm first — irreversible) · jalankanRefund :10165
//   refundGantung :10182 · selesaikanRefund :10187 · selesaikanRefundYakin :10206
//   approveRefundYakin :10217 · salesBody :7319 (active-first refund column)
//   apprTabelRefund :5872 (hanging label + Selesaikan) · hapusEvent :3024.
import type { ResourceEvent } from '~/composables/useEvent'
import type { Versi } from '~/utils/versi'

// Minimal shapes so tests can build rows without full records. Real
// OrderTiket/Tiket/Kursi/KelasTiket/Refund rows satisfy these structurally.
export interface RefundBaris {
  id: string
  order_id?: string
  status?: string
  [key: string]: unknown
}

export interface OrderBaris {
  id: string
  payment_status?: string
  [key: string]: unknown
}

export interface TiketBaris {
  id: string
  order_id?: string
  order_item_id?: string
  ticket_class_id?: string
  seat_id?: string
  status?: string
  [key: string]: unknown
}

export interface KursiBaris {
  id: string
  status?: string
  [key: string]: unknown
}

export interface KelasBaris {
  id: string
  sold?: number | string
  [key: string]: unknown
}

/** `refundAktif(oid)` (`:10097`): one living request per order — anything but
 *  Rejected. A rejected request frees the order for a fresh one. */
export function refundAktif(oid: string, refunds: RefundBaris[]): RefundBaris | undefined {
  return refunds.find(r => r.order_id === oid && (r.status ?? '') !== 'Rejected')
}

/** `refundGantung(r)` (`:10182`): Approved on paper, but the order is not
 *  Refunded yet — born from the old approval that only flipped the request
 *  status. Such an order is stuck: not paid, not refunded, not re-requestable,
 *  and its event looks undeletable. */
export function refundGantung(r: RefundBaris | undefined | null, order?: OrderBaris | null): boolean {
  if (!r || (r.status ?? '') !== 'Approved') return false
  if (!order) return false
  return (order.payment_status ?? '') !== 'Refunded'
}

/** The tickets one refund run cancels (`:10165` loops `order_item_id`; rows
 *  written by Vue carry `order_id`, so both are read — no field invented).
 *  Already-Cancelled tickets are left alone. */
export function tiketDariOrder(oid: string, tiket: TiketBaris[]): TiketBaris[] {
  return tiket.filter(t =>
    (t.order_id === oid || t.order_item_id === oid) && (t.status ?? '') !== 'Cancelled')
}

export interface RencanaRefund {
  orderId: string
  tiketIds: string[]
  kursiIds: string[]
  kelasBaru: { id: string, sold: number }[]
}

/** The record changes `jalankanRefund` (`:10165`) makes: the order goes
 *  Refunded, its tickets Cancelled, their seats Available again, and each
 *  ticket class quota back by one per ticket (sequential, floored at 0 —
 *  exactly like the old loop, so two tickets of a class with sold 1 end at
 *  0, not −1). Seats or classes missing from the lists are skipped: there is
 *  nothing to PATCH for them. */
export function rencanaRefund(
  orderId: string,
  tiket: TiketBaris[],
  kursi: KursiBaris[],
  kelas: KelasBaris[],
): RencanaRefund {
  const daftar = tiketDariOrder(orderId, tiket)
  const tiketIds = daftar.map(t => t.id)
  const kursiIds: string[] = []
  for (const t of daftar) {
    if (!t.seat_id) continue
    if (kursi.some(k => k.id === t.seat_id) && !kursiIds.includes(t.seat_id)) kursiIds.push(t.seat_id)
  }
  const sisa = new Map(kelas.map(k => [k.id, Number(k.sold) || 0]))
  const berubah = new Map<string, number>()
  for (const t of daftar) {
    const cid = t.ticket_class_id ?? ''
    if (!cid || !sisa.has(cid)) continue
    const v = sisa.get(cid)!
    if (v > 0) {
      sisa.set(cid, v - 1)
      berubah.set(cid, v - 1)
    }
  }
  return { orderId, tiketIds, kursiIds, kelasBaru: [...berubah].map(([id, sold]) => ({ id, sold })) }
}

/** `patchEvent` passed in by the page (same signature), so this file never
 *  touches Nuxt. */
export type PatchEvent = (res: ResourceEvent, id: string, body: Record<string, unknown>, versi?: Versi) => Promise<unknown>

/** The versions the run sends back as `If-Match` (from `meta.versions`). */
export interface VersiRefund {
  refund?: Versi
  order?: Versi
  tiket?: Record<string, Versi | undefined>
  kursi?: Record<string, Versi | undefined>
  kelas?: Record<string, Versi | undefined>
}

export interface HasilRefund {
  ok: boolean
  /** Tickets actually cancelled — for the success toast. */
  tiketBatal: number
  /** Indonesian labels of what landed, e.g. `pengajuan refund`, `3 tiket`. */
  sudah: string[]
  /** Indonesian labels of what did not, with ids only when few. */
  belum: string[]
  /** True when at least one refusal was a version check (caller reloads). */
  konflik: boolean
  galat?: unknown
}

const kodeGalat = (e: unknown): string | undefined =>
  (e as { data?: { error?: { code?: string } } })?.data?.error?.code

/**
 * Run one refund through the v1 endpoints (`approveRefundYakin :10217` for a
 * new approval, `selesaikanRefundYakin :10206` for a hanging one — both
 * through the same `jalankanRefund :10165` plan above).
 *
 * The refund request goes first on purpose: when it lands but a later PATCH
 * does not, the request is Approved with the order still Paid — exactly the
 * hanging state the Selesaikan button repairs. Every step is attempted even
 * after a failure so the report tells the whole story; nothing is retried
 * silently. This function never throws: check `hasil.ok`.
 */
export async function jalankanRefund(opsi: {
  refund: RefundBaris
  order: OrderBaris
  tiket: TiketBaris[]
  kursi: KursiBaris[]
  kelas: KelasBaris[]
  versi: VersiRefund
  patch: PatchEvent
  /** Acting crew name — the API takes the name from the session, but the
   *  record keeps `penyetuju`/`diselesaikan_oleh` like the old client. */
  nama: string
  /** True for the repair button: the request stays Approved, only the
   *  missed execution runs (`:10206`). */
  selesaikan?: boolean
  sekarang?: number
}): Promise<HasilRefund> {
  const { refund, order, tiket, kursi, kelas, versi, patch, nama } = opsi
  const now = opsi.sekarang ?? Date.now()
  const sudah: string[] = []
  const belum: string[] = []
  let konflik = false
  let galat: unknown
  let tiketBatal = 0

  const catat = async (label: string, kerja: () => Promise<unknown>) => {
    try {
      await kerja()
      sudah.push(label)
    }
    catch (e) {
      belum.push(label)
      galat = e
      const kode = kodeGalat(e)
      if (kode === 'version_conflict' || kode === 'version_required') konflik = true
    }
  }

  const rencana = rencanaRefund(order.id, tiket, kursi, kelas)

  if (opsi.selesaikan) {
    await catat('pengajuan refund', () => patch('refunds', refund.id, {
      diselesaikan_oleh: nama,
      diselesaikan_at: new Date(now).toISOString(),
      updatedAt: now,
    }, versi.refund))
  }
  else {
    const iso = new Date(now).toISOString()
    await catat('pengajuan refund', () => patch('refunds', refund.id, {
      status: 'Approved',
      penyetuju: nama,
      decided_at: iso,
      approved_at: iso,
      updatedAt: now,
    }, versi.refund))
  }
  await catat('pesanan', () => patch('orders', order.id, {
    payment_status: 'Refunded',
    updatedAt: now,
  }, versi.order))

  let gagalTiket = 0
  for (const tid of rencana.tiketIds) {
    try {
      await patch('tickets', tid, { status: 'Cancelled', updatedAt: now }, versi.tiket?.[tid])
      tiketBatal++
    }
    catch (e) {
      gagalTiket++
      galat = e
      const kode = kodeGalat(e)
      if (kode === 'version_conflict' || kode === 'version_required') konflik = true
    }
  }
  if (tiketBatal) sudah.push(`${tiketBatal} tiket`)
  if (gagalTiket) belum.push(`${gagalTiket} tiket`)

  let kursiLepas = 0
  let gagalKursi = 0
  for (const sid of rencana.kursiIds) {
    try {
      await patch('seats', sid, { status: 'Available', updatedAt: now }, versi.kursi?.[sid])
      kursiLepas++
    }
    catch (e) {
      gagalKursi++
      galat = e
      const kode = kodeGalat(e)
      if (kode === 'version_conflict' || kode === 'version_required') konflik = true
    }
  }
  if (kursiLepas) sudah.push(`${kursiLepas} kursi`)
  if (gagalKursi) belum.push(`${gagalKursi} kursi`)

  let kelasKembali = 0
  let gagalKelas = 0
  for (const k of rencana.kelasBaru) {
    try {
      await patch('ticket-classes', k.id, { sold: k.sold, updatedAt: now }, versi.kelas?.[k.id])
      kelasKembali++
    }
    catch (e) {
      gagalKelas++
      galat = e
      const kode = kodeGalat(e)
      if (kode === 'version_conflict' || kode === 'version_required') konflik = true
    }
  }
  if (kelasKembali) sudah.push(`${kelasKembali} kelas tiket`)
  if (gagalKelas) belum.push(`${gagalKelas} kelas tiket`)

  return { ok: belum.length === 0, tiketBatal, sudah, belum, konflik, galat }
}

/** One user-facing line from a partial run: what landed and what did not. */
export function ringkasRefund(h: HasilRefund): string {
  const s = h.sudah.length ? `Sudah berubah: ${h.sudah.join(', ')}.` : ''
  const b = h.belum.length ? `${s ? ' ' : ''}Belum berubah: ${h.belum.join(', ')} — muat ulang lalu ulangi.` : ''
  return `${s}${b}`.trim()
}
