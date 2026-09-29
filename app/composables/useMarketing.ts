// Marketing read model for Dana Masuk's DP Event tab.
//
// The tab is READ-ONLY: payments are verified in Marketing first, and land
// here only to be looked at (`docs/migrasi/reservasi.md` F11).
// Filtered by EVENT date on the server; the pay date stays one column.

/** One event/VIP payment row of `GET /marketing/dp`. Field names as the API sends them. */
export interface DpEvent {
  sumber: 'event' | 'vip'
  evId: string
  event: string
  jenis: string
  tglEvent: string
  status: string
  client: string
  pic: string
  /** Set when a VIP row is also locked into a reservation: "don't count twice". */
  resId: string
  id: string
  no: string
  type: string
  amount: number
  method: string
  at: string
  receipt: string
  receiptUrl: string
}

export interface DpEventData {
  baris: DpEvent[]
  total: number
  tanpaTanggal: number
  vipTerkunci: { n: number, total: number }
  luar: { n: number, total: number, dari: string, sampai: string }
  dari: string
  sampai: string
}

/**
 * GET /marketing/dp?from&to — both required by the API, so the caller clamps
 * an open range to 2000-01-01..2100-12-31 first (the old client's rule).
 */
export const getMarketingDp = (from: string, to: string) =>
  useApi()<Envelope<DpEventData>>('/marketing/dp', { query: { from, to } })
