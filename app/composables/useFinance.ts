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
