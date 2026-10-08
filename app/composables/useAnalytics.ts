// Analytics API calls + types. Analytics stores into the Kompas backend
// (tables an_state/an_akses/an_peran) and reads it back whole.
// Contract: laksamana-api/docs/api/kompas.md "Analytics — /analytics"
// (module analytics; access writes need its admin).
//
// Field names are exactly what the API sends. Money inside laporan may be
// JSON numbers or formatted strings — the server reads them like num().
// The three turnover conventions (net/tagihan/netSales) live in
// app/utils/kompas.ts (netOf/tagihanOf): import, never copy.
//
// Writes are whole-state with If-Match: GET hands back meta.version (= ts)
// and meta.accessVersion (hash of matrix + roles); PUT sends them back and
// the caller handles 428/409 through tanganiKonflik() (app/utils/versi.ts).
import type {
  AgregatKunjung,
  AgregatMeja,
  AgregatMenu,
  BatasShift,
  ErrorBill,
  HasilUraiPos,
  RingkasPos,
} from '~/utils/analytics-agregat'
import type { VoidBaris, VoidSetting } from '~/utils/cashier'

/** One stored month: the summary only, never the rows. */
export interface LaporanBulan {
  diunggah: string
  oleh: string
  berkas: string
  jenis: 'bill' | 'menu'
  hari: Record<string, { bill: number, grand: number, net: number }>
  jam: { bill: number, grand: number }[]
  hariJam: Record<string, Record<string, { g: number, b: number }>>
  menu: Record<string, AgregatMenu>
  paket: Record<string, Record<string, AgregatMenu>>
  ukuran: Record<string, Record<string, Record<string, AgregatMenu & { induk: number }>>>
  kategori: Record<string, { qty: number, nilai: number, kat: string }>
  katMenu: Record<string, Record<string, AgregatMenu>>
  kunjung: Record<string, AgregatKunjung>
  bayar: Record<string, AgregatKunjung>
  kunjungBayar: Record<string, AgregatKunjung>
  error: ErrorBill[]
  meja: Record<string, AgregatMeja>
  ringkas: RingkasPos
}

/** Shift bounds + menu-name maps (POS -> HPP) + package-code map. */
export interface AnalyticsSetting {
  shift?: BatasShift
  petaMenu?: Record<string, string>
  petaKode?: Record<string, string>
  [k: string]: unknown
}

/** The stored blob. promo/voidb are separate containers (L2): uploading one
 *  report must never overwrite the other's summary. */
export interface AnalyticsData {
  laporan: Record<string, LaporanBulan>
  setting: AnalyticsSetting
  promo?: Record<string, unknown>
  voidb?: Record<string, unknown>
  [k: string]: unknown
}

/** Page × role matrix: { staf: { ringkasan: 1, ... }, ... }. */
export type AnalyticsAkses = Record<string, Record<string, number>>
/** Role assignment per user key ('#<id>'). */
export type AnalyticsPeran = Record<string, string>

/** GET /kompas/analytics — data holds {laporan, setting, …} plus the matrix. */
export interface AnalyticsGet {
  data: AnalyticsData
  akses: AnalyticsAkses
  peran: AnalyticsPeran
  ts: number
}

export type AnalyticsEnvelope = Envelope<AnalyticsGet> & {
  meta: { version: number | string, accessVersion: string }
}

// Void rows are the cashier module's type (same /kompas/voids contract):
// imported above for the getVoids signature; screens import it from
// ~/utils/cashier, the single owner.

/** A crew member holding the analytics module (for the Akses screen, L3). */
export interface AnalyticsAnggota {
  id: string
  name: string
  username?: string
  isModuleAdmin?: boolean
  [k: string]: unknown
}

/** GET /api/v1/kompas/analytics. The envelope is kept whole: screens need
 *  meta.version (saves) and meta.accessVersion (access saves) next to data. */
export const getAnalytics = () => useApi()<AnalyticsEnvelope>('/kompas/analytics')

/** The shared analytics read: one request for every screen of the module. */
export const useAnalyticsState = () =>
  useAsyncData('analytics-state', () => getAnalytics())

/**
 * PUT /api/v1/kompas/analytics — replaces the WHOLE state. version is
 * meta.version of the read; 428 version_required / 409 version_conflict come
 * back when it is missing or stale (handle with tanganiKonflik).
 */
export const saveAnalytics = (data: AnalyticsData, version: Versi) =>
  useApi()<Envelope<{ saved: boolean }>>('/kompas/analytics', {
    method: 'PUT',
    body: { data },
    headers: ifMatch(version),
  })

/**
 * PUT /api/v1/kompas/analytics/access — analytics admin only. Each map given
 * replaces its whole map (tingkat clamped 0–2 server-side).
 */
export const saveAnalyticsAccess = (
  body: { matrix?: AnalyticsAkses, roles?: AnalyticsPeran },
  accessVersion: Versi,
) =>
  useApi()<Envelope<{ saved: boolean }>>('/kompas/analytics/access', {
    method: 'PUT',
    body,
    headers: ifMatch(accessVersion),
  })

/** GET /api/v1/kompas/voids — the Void & Cancel screen (L2). */
export const getVoids = (from: string, to: string) =>
  useApi()<Envelope<{ baris: VoidBaris[], total: number, maks: number, setting: VoidSetting }>>(
    '/kompas/voids',
    { query: { from, to } },
  )

/** GET /api/v1/account/modules/analytics/members — the Akses screen (L3). */
export const getAnalyticsMembers = () =>
  useApi()<Envelope<AnalyticsAnggota[]>>('/account/modules/analytics/members').then(r => r.data)

/** meta.accessVersion of an analytics read, for saveAnalyticsAccess. */
export function accessVersionDari(res?: { meta?: Record<string, unknown> } | null): Versi | undefined {
  const v = res?.meta?.accessVersion
  return typeof v === 'string' || typeof v === 'number' ? v : undefined
}

/**
 * Strip a parse result down to what the server stores. Preview-only keys
 * (nBaris, nLewat, blnLain, billDariBaris, tglAwal, tglAkhir) never leave
 * the browser. Built field by field: a closed key list that silently drops
 * a new parser key once cost the module its category page (Sep 2026), so a
 * new HasilUraiPos key fails the type checker here until it is listed.
 */
export function laporanDariHasil(u: HasilUraiPos): LaporanBulan {
  return {
    diunggah: '',
    oleh: '',
    berkas: u.berkas,
    jenis: u.jenis,
    hari: u.hari,
    jam: u.jam,
    hariJam: u.hariJam,
    menu: u.menu,
    paket: u.paket,
    ukuran: u.ukuran,
    kategori: u.kategori,
    katMenu: u.katMenu,
    kunjung: u.kunjung,
    bayar: u.bayar,
    kunjungBayar: u.kunjungBayar,
    error: u.error,
    meja: u.meja,
    ringkas: u.ringkas,
  }
}
