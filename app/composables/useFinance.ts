import { ifMatch, versiDari, type Versi } from '~/utils/versi'

// Finance invoice calls used by reservasi's kwitansi flow.
//
// Owned by the finance module; reservasi only borrows the three calls its
// receipt needs (PLAN.md §4: `kwitansi.ts` owned by reservasi, used later by
// marketing). Callers need any of the `finance`, `reservasi`, `marketing`
// modules (laksamana-api/docs/api/finance.md "Invoices & kwitansi").

/** The printable document of an issued request (`GET /invoices/file/{resId}`). */
export interface BerkasKwitansi {
  jenis: string
  no: string
  putusOleh: string
  putusAt: number | string
  cap: string
  penanda: { nama: string, jabatan: string, ttd: string }[]
}

/** A kwitansi request row, as `GET /invoices/status?res=` reports it. */
export interface StatusKwitansi {
  id?: string
  resId?: string
  jenis?: string
  status: 'MENUNGGU' | 'DIBUAT' | 'DITOLAK'
  no?: string
  mintaOleh?: string
  mintaAt?: number
  catatan?: string
}

/**
 * POST /finance/invoices/requests — idempotent per resId: an issued one comes
 * back untouched, a waiting or rejected one becomes a live request.
 */
export const mintaKwitansi = (body: { resId: string, jenis?: string, ringkas?: unknown }) =>
  useApi()<Envelope<StatusKwitansi>>('/finance/invoices/requests', { method: 'POST', body })

/** GET /finance/invoices/status?res=a,b,… — at most 400 ids, without images. */
export const statusKwitansi = (resIds: string[]) =>
  useApi()<Envelope<Record<string, StatusKwitansi>>>('/finance/invoices/status', { query: { res: resIds.join(',') } })

/** GET /finance/invoices/file/{resId} — the printable document, or 404 `not_issued`. */
export const berkasKwitansi = (resId: string) =>
  useApi()<Envelope<BerkasKwitansi>>(`/finance/invoices/file/${resId}`)

// ════════════════════════════════════════════════════════════════════════════
// Kas Kecil (`/finance/petty-cash`), the payment plan in the vault blob, and
// the vault itself for Brankas. Contract: laksamana-api/docs/api/finance.md.
//
// Versions are content hashes: a list read carries `meta.versions` keyed by id,
// a single read carries `meta.version`. Writes send it as If-Match. The whole
// vault blob has ONE version (`meta.version`) for every list.
// ════════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------- Kas Kecil

export interface KkBaris { pos_id: string, debet: number, kredit: number }
export interface KkTrx {
  id: string
  tgl: string
  keterangan: string
  kategori_id?: string | null
  input?: boolean
  bon?: boolean
  dibuat_oleh?: string
  baris: KkBaris[]
}
export interface KkItem { id: string, nama: string, urut?: number, aktif?: boolean }
export type KkList = 'sources' | 'categories'
export type KkTingkat = 0 | 1 | 2
export interface KkAkses {
  matrix: Record<string, Record<string, number>>
  roles: Record<string, string>
}
export interface KkState {
  pos: KkItem[]
  kategori: KkItem[]
  trx: KkTrx[]
  akses: KkAkses
  peran: unknown
}

const VERSIONS = (m?: Record<string, unknown>) => (m?.versions ?? {}) as Record<string, Versi>

/** Bootstrap (`getAll`): pos, kategori, trx, akses, peran. */
export const getKk = () => useApi()<Envelope<KkState>>('/finance/petty-cash/')

/** `GET /transactions?from&to` + `meta.versions` per row. */
export async function getKkTrx(from?: string, to?: string) {
  const r = await useApi()<Envelope<KkTrx[]> & { meta?: Record<string, unknown> }>('/finance/petty-cash/transactions', { query: { from, to } })
  return { trx: r.data, versions: VERSIONS(r.meta) }
}
/** One transaction with its split rows + `meta.version` (needed for an edit). */
export async function getKkTrxSatu(id: string) {
  const r = await useApi()<Envelope<KkTrx>>(`/finance/petty-cash/transactions/${id}`)
  return { trx: r.data, version: versiDari(r) }
}
export function createKkTrx(body: Partial<KkTrx>) {
  return useApi()<Envelope<{ id: string }>>('/finance/petty-cash/transactions', { method: 'POST', body })
}
/** PUT replaces the transaction and rewrites its split rows. */
export function updateKkTrx(id: string, body: Partial<KkTrx>, versi: Versi) {
  return useApi()<Envelope<KkTrx>>(`/finance/petty-cash/transactions/${id}`, { method: 'PUT', body, headers: ifMatch(versi) })
}
/** PATCH only the administrative ticks. */
export function patchKkTrx(id: string, body: { input?: boolean, bon?: boolean }, versi: Versi) {
  return useApi()<Envelope<KkTrx>>(`/finance/petty-cash/transactions/${id}`, { method: 'PATCH', body, headers: ifMatch(versi) })
}
export function deleteKkTrx(id: string, versi: Versi) {
  return useApi()<{ deleted: boolean }>(`/finance/petty-cash/transactions/${id}`, { method: 'DELETE', headers: ifMatch(versi) })
}

/** `GET /sources` or `/categories` + `meta.versions` per row. */
export async function getKkItems(list: KkList) {
  const r = await useApi()<Envelope<KkItem[]> & { meta?: Record<string, unknown> }>(`/finance/petty-cash/${list}`)
  return { items: r.data, versions: VERSIONS(r.meta) }
}
export function createKkItem(list: KkList, body: { nama: string, urut?: number }) {
  return useApi()<Envelope<KkItem>>(`/finance/petty-cash/${list}`, { method: 'POST', body })
}
export function updateKkItem(list: KkList, id: string, body: Partial<KkItem>, versi: Versi) {
  return useApi()<Envelope<KkItem>>(`/finance/petty-cash/${list}/${id}`, { method: 'PATCH', body, headers: ifMatch(versi) })
}
export function deleteKkItem(list: KkList, id: string, versi: Versi) {
  return useApi()<{ deleted: boolean }>(`/finance/petty-cash/${list}/${id}`, { method: 'DELETE', headers: ifMatch(versi) })
}

export async function getKkAkses() {
  const r = await useApi()<Envelope<KkAkses> & { meta?: Record<string, unknown> }>('/finance/petty-cash/access')
  return { akses: r.data, version: versiDari(r), roleVersions: (r.meta?.roleVersions ?? {}) as Record<string, Versi> }
}
export function putKkMatrix(matrix: Record<string, Record<string, number>>, versi: Versi) {
  return useApi()<Envelope<KkAkses>>('/finance/petty-cash/access/matrix', { method: 'PUT', body: { matrix }, headers: ifMatch(versi) })
}
export function putKkRole(userId: string, role: string, versi: Versi | undefined) {
  return useApi()<Envelope<unknown>>(`/finance/petty-cash/access/roles/${encodeURIComponent(userId)}`, { method: 'PUT', body: { role }, headers: versi === undefined ? undefined : ifMatch(versi) })
}

// ---------------------------------------------------------------- Planning Pembayaran (bayar list in the vault blob)

export interface RencanaBayar {
  id: string
  vendor?: string
  keterangan?: string
  kategori?: string
  dari?: string
  amount?: number
  batch?: string
  status?: 'scheduled' | 'paid' | string
  bukti?: { ok?: boolean, [k: string]: unknown }
  name?: string
  cat?: string
  [k: string]: unknown
}

/** The payment plan + the vault blob version (one version for the whole blob). */
export async function getBayar() {
  const r = await useApi()<Envelope<{ bayar?: RencanaBayar[] }> & { meta?: Record<string, unknown> }>('/finance/petty-cash/payment-plan')
  return { bayar: r.data.bayar ?? [], version: versiDari(r) }
}
export function putBayar(bayar: RencanaBayar[], versi: Versi) {
  return useApi()<Envelope<unknown>>('/finance/petty-cash/payment-plan', { method: 'PUT', body: { bayar }, headers: ifMatch(versi) })
}
