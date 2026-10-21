// Investor Compass — API calls + types. The module reads summed figures only:
// no staff names, no per-cashier breakdown, no receivables.
//
// Contract: laksamana-api/docs/api/kompas.md "Investor Compass — /investor"
// (module investor; uploading/deleting reports needs its admin).
// Login is the shared Office login (laksamana-api/docs/api/account.md):
// POST /api/v1/auth/login {login, pin}.
//
// Field names are exactly what the API sends. Money is always shown in full
// (rupiah()); only chart Y-axis ticks use the short form (rpSumbu() in
// app/utils/investor.ts). Every Ringkasan figure uses `netSales`
// (tagihan − compliment), never `net`/`tagihan`
// (laksamana-office/investor/index.html:600-615, CLAUDE.md:11244-11247).
//
// Reports carry no version: each (month, kind) is replaced whole by an admin,
// so there is no If-Match here (unlike the versioned kompas parts).
import { login as loginOffice } from '~/composables/useMe'

/** One month block of investorRingkas: all three conventions + the inputs. */
export interface InvestorBulan {
  kunci: string
  omset: number | null
  transaksi: number | null
  hariTerisi: number
  svc: number | null
  pajak: number | null
  compliment: number | null
  dibayarTamu: number | null
  netSales: number | null
  target?: number
}

/** One day of the daily map, already summed server-side. */
export interface InvestorHarian {
  tgl: string
  omset: number | null
  tagihan: number | null
  net: number | null
}

/** One month of the CFO Profit & Loss layout, newest first. Only the lines
 *  this system knows (Pendapatan); the cost rows have no input anywhere. */
export interface InvestorLabaRugi {
  kunci: string
  food: number
  bev: number
  lainnya: number
  pb1: number
  service: number
  totalSales: number
  diskon: number
  compliment: number
  totalDiskon: number
  netSales: number
  hariTerisi: number
}

/** One stored monthly PDF. */
export interface InvestorLaporFile {
  nama: string
  ukuran: number
  at: number
  oleh: string
}

/** Capital returns recorded in Finance → Brankas. `gagal` = the Finance panel
 *  did not answer: NOT the same as "never paid out". Since 6 Oct 2026 the
 *  server filters per viewer: an investor admin gets every investor
 *  (`semua: true` + the `per` table); anyone else only their own records
 *  (`semua: false`). A non-empty `per` with no `semua: false` is an old server. */
export interface InvestorDividenPer {
  nama: string
  modal: number
  kembali: number
  kali: number
  kepemilikan: number
  terhubung: boolean
}

export interface InvestorDividen {
  riwayat: { tgl: string, investor: string, nominal: number }[]
  total?: number
  modal?: number
  investor?: number
  per?: InvestorDividenPer[]
  semua?: boolean
  jumlahSemua?: number | null
  gagal: boolean
}

export interface InvestorSummary {
  ts: string
  hariIni: InvestorBulan & { tgl: string }
  kemarin: InvestorBulan & { tgl: string }
  bulanIni: InvestorBulan
  bulanLalu: InvestorBulan
  /** Year -> 12 monthly net sales (`null` = no data that month). */
  tahunan: Record<string, (number | null)[]>
  harian: InvestorHarian[]
  lapor: Record<string, Partial<Record<'balance' | 'ledger', InvestorLaporFile>>>
  dividen: InvestorDividen
  /** Missing entirely = the kompas backend is still the old version. */
  labaRugi?: InvestorLabaRugi[]
  terakhir: string | null
  adaData: boolean
}

export interface InvestorAgendaEvent {
  tgl: string
  jam: string
  judul: string
  tempat: string
  jenis: string
  pax: number
  sumber: string
}

export interface InvestorAgendaPromo {
  nama: string
  kategori: string
  benefit: string
  outlet: string
  mulai: string
  selesai: string
  status: 'running' | 'upcoming'
}

export interface InvestorAgenda {
  ts: string
  hariIni: string
  event: InvestorAgendaEvent[]
  eventLebih: number
  promo: InvestorAgendaPromo[]
  promoLebih: number
  /** Modules that could not be read when the agenda was built. */
  gagal: string[]
}

export type JenisLapor = 'balance' | 'ledger'

export const JENIS_LAPOR: { key: JenisLapor, label: string, icon: string }[] = [
  { key: 'balance', label: 'Balance Report', icon: 'i-lucide-book-text' },
  { key: 'ledger', label: 'General Ledger Report', icon: 'i-lucide-notebook-text' },
]

/** POST /api/v1/auth/login. The shared Office login; the caller checks the
 *  `investor` key afterwards (the masuk screen shows the exact gate message). */
export const loginInvestor = (login: string, pin: string) => loginOffice(login, pin)

/** GET /api/v1/kompas/investor/summary. The envelope is kept whole: the pages
 *  need `meta.canUpload` (investor admin) next to the figures. */
export const getSummary = () =>
  useApi()<Envelope<InvestorSummary> & { meta: { canUpload: boolean } }>('/kompas/investor/summary')

/** The shared summary read: one request for the Ringkasan, Laporan and
 *  Dividen screens. No polling; the figures change when Finance inputs a day. */
export const useInvestorSummary = () =>
  useAsyncData('investor-summary', () => getSummary(), { dedupe: 'defer' })

/** True when the signed-in user may upload/delete monthly PDFs. */
export const useInvestorCanUpload = () => {
  const { data } = useInvestorSummary()
  return computed(() => (data.value as unknown as { meta?: { canUpload?: boolean } } | null)?.meta?.canUpload === true)
}

/** GET /api/v1/kompas/investor/agenda. Fetched lazily by the Event/Promo
 *  screens only: one call fans out to Marketing, Event and BD server-side,
 *  and the Ringkasan screen must not pay for it. */
export const useInvestorAgenda = () =>
  useAsyncData('investor-agenda', () =>
    useApi()<Envelope<InvestorAgenda>>('/kompas/investor/agenda').then(r => r.data), { dedupe: 'defer' })

/** GET /api/v1/kompas/investor/reports — {bulan: {balance|ledger: {...}}}. */
export const getInvestorReports = () =>
  useApi()<Envelope<InvestorSummary['lapor']>>('/kompas/investor/reports').then(r => r.data)

/**
 * GET /api/v1/kompas/investor/reports/{bulan}/{jenis} as an object URL. The
 * endpoint streams the PDF binary and needs the Bearer token, so a plain
 * <a href> cannot point at it. The caller revokes the URL when done.
 */
export async function getInvestorReportUrl(bulan: string, jenis: JenisLapor): Promise<string> {
  const blob = await useApi()<Blob>(
    `/kompas/investor/reports/${encodeURIComponent(bulan)}/${jenis}`,
    { responseType: 'blob' },
  )
  return URL.createObjectURL(blob)
}

/** PUT .../reports/{bulan}/{jenis} — investor admin. Replaces that month's
 *  report; the old file is removed only after the new one is written.
 *  → the saved entry plus the refreshed `lapor` map. */
export const uploadInvestorReport = (bulan: string, jenis: JenisLapor, dataBase64: string, fileName?: string) =>
  useApi()<Envelope<{ saved: boolean } & { lapor: InvestorSummary['lapor'] }>>(
    `/kompas/investor/reports/${encodeURIComponent(bulan)}/${jenis}`,
    { method: 'PUT', body: { dataBase64, fileName } },
  )

/** DELETE .../reports/{bulan}/{jenis} — investor admin. */
export const deleteInvestorReport = (bulan: string, jenis: JenisLapor) =>
  useApi()<Envelope<{ deleted: boolean, lapor: InvestorSummary['lapor'] }>>(
    `/kompas/investor/reports/${encodeURIComponent(bulan)}/${jenis}`,
    { method: 'DELETE' },
  )
