// Campaign analytics — API calls + types. The Konten Analytics panel
// (Insight, Kalender, Riset, Bank Konten, Pengaturan) under
// /api/v1/konten/analytics (laksamana-api/docs/api/konten.md "Analytics",
// port of konten-mysql/lib_campaign.php).
//
// Read: every screen works from ONE `GET /analytics/state` (insight, jadwal,
// riset, bank, postInfo, akun, setting), shared under 'campaign-state' —
// except Konten terpopuler, which pages server-side via `GET /analytics/top`.
// Write: per row with the row's version as If-Match (diubah_at, fallback
// dibuat_at); 409 carries the live row, identical payload is a no-op.
import type { Versi } from '~/utils/versi'
import { ifMatch, tanganiKonflik } from '~/utils/versi'

export interface AkunCampaign {
  platform: string
  nama: string
  avatar: string
  follower: number
  bio: string
  profil_url: string
  terverifikasi: number
  following: number
  likes_total: number
  jml_video: number
  stats_ada: number
  scope: string
  token_exp: number
  refresh_exp: number
  sync_at: number
  sync_galat: string
  oleh: string
  at: number
  terhubung: boolean
}

export interface RinciAngka { v: number | null, s: string }
export interface BarisTop {
  rinci: Record<string, RinciAngka>
  tercatat: boolean
  platform: string
  judul: string
  url: string
  tanggal: string
  views: number
  likes: number
  comments: number
  shares: number
  er: number | null
  sumber: string
}

export interface InsightCampaign {
  id: string
  platform: string
  kategori: string
  temuan: string
  url: string
  tgl_tayang: string
  metrik: string
  aksi: string
  sumber: string
  arsip: number
  dibuat_oleh: string
  dibuat_at: number
  diubah_oleh?: string
  diubah_at?: number
}

export interface JadwalCampaign {
  id: string
  platform: string
  judul: string
  caption: string
  tanggal: string
  jam: string
  status: 'DRAF' | 'TERJADWAL' | 'TAYANG' | 'BATAL'
  insight_id: string
  pic: string
  tautan: string
  catatan: string
  dibuat_oleh: string
  dibuat_at: number
  diubah_oleh?: string
  diubah_at?: number
}

export interface IdeBank {
  id: string
  judul: string
  platform: string
  format: string
  pilar: string
  hook: string
  caption: string
  tanggal: string
  jam: string
  alasan: string
  sumber: string
  batch: string
  status: 'IDE' | 'TERJADWAL' | 'ARSIP'
  jadwal_id: string
  dibuat_oleh: string
  dibuat_at: number
  diubah_oleh?: string
  diubah_at?: number
}

export interface RisetCampaign {
  id: string
  jenis: string
  topik: string
  platform: string
  catatan: string
  hasil: Record<string, unknown> | null
  model: string
  oleh: string
  at: number
}

export interface StateCampaign {
  insight: InsightCampaign[]
  jadwal: JadwalCampaign[]
  riset: RisetCampaign[]
  bank: IdeBank[]
  postInfo: { total: number, riwayatSelesai: boolean, igTotal: number, igRiwayatSelesai: boolean }
  akun: AkunCampaign[]
  setting: {
    aiSiap: boolean
    aiModel: string
    ai: { id: string, label: string, model: string[], modelPakai: string, siap: boolean, dariConfig: boolean }[]
    kategori: string[]
    profil: string
    tiktokSiap: boolean
    tiktokDariConfig: boolean
    redirectUri: string
    tiktokScope: string
    igSiap: boolean
    igDariConfig: boolean
    igRedirectUri: string
  }
  boleh: { admin: boolean }
}

/** One `GET /analytics/state`, shared by every analytics screen. */
export const useStateCampaign = () => useAsyncData<StateCampaign>('campaign-state', () =>
  useApi()<Envelope<StateCampaign>>('/konten/analytics/state').then(r => r.data))

const versiHdr = (v?: Versi) => (v === undefined ? undefined : ifMatch(v))

/** GET /analytics/top — one page of the most-running posts. */
export const getTopCampaign = (q: { platform?: string, urut?: string, dari?: string, sampai?: string, hal?: number, per?: number }) =>
  useApi()<Envelope<{ baris: BarisTop[], total: number, hal: number, per: number, halMaks: number }>>('/konten/analytics/top', {
    // The API caps a page at 100 rows (M4).
    query: { ...q, per: Math.min(q.per ?? 10, 100) },
  })

/** GET /analytics/bank — ideas, optionally filtered. */
export const getBankCampaign = (q: { status?: string, platform?: string }) =>
  useApi()<Envelope<IdeBank[]>>('/konten/analytics/bank', { query: q })

/** POST/PATCH insights — needs the version for edits. */
export interface InsightInput {
  id?: string
  platform?: string
  kategori?: string
  temuan?: string
  url?: string
  tglTayang?: string
  metrik?: string
  aksi?: string
  sumber?: string
}
export const simpanInsightCampaign = (body: InsightInput, versi?: Versi) =>
  useApi()<Envelope<InsightCampaign>>(body.id
    ? `/konten/analytics/insights/${encodeURIComponent(body.id)}`
    : '/konten/analytics/insights',
  { method: body.id ? 'PATCH' : 'POST', body, headers: versiHdr(versi) })

/** POST insights/{id}/arsip */
export const arsipInsightCampaign = (id: string, arsip: boolean) =>
  useApi()<unknown>(`/konten/analytics/insights/${encodeURIComponent(id)}/arsip`, { method: 'POST', body: { arsip } })

/** POST insights/suggest — AI proposals, never stored. */
export const usulanInsightCampaign = () =>
  useApi()<Envelope<{ usulan: Record<string, unknown>[], model: string }>>('/konten/analytics/insights/suggest', { method: 'POST' })

/** POST/PATCH schedules — needs the version for edits. */
export interface JadwalInput {
  id?: string
  platform?: string
  judul?: string
  caption?: string
  tanggal?: string
  jam?: string
  status?: string
  insightId?: string
  pic?: string
  tautan?: string
  catatan?: string
  bankId?: string
}
export const simpanJadwalCampaign = (body: JadwalInput, versi?: Versi) =>
  useApi()<Envelope<JadwalCampaign>>(body.id
    ? `/konten/analytics/schedules/${encodeURIComponent(body.id)}`
    : '/konten/analytics/schedules',
  { method: body.id ? 'PATCH' : 'POST', body, headers: versiHdr(versi) })

/** POST research — runs the AI (1–2 min), stores the row. */
export const jalankanRisetCampaign = (body: { topik: string, platform?: string, catatan?: string }) =>
  useApi()<Envelope<{ id: string, hasil: Record<string, unknown>, model: string }>>('/konten/analytics/research', { method: 'POST', body })

/** POST/PATCH bank — needs the version for edits. Status/jadwal_id untouched. */
export interface BankInput {
  id?: string
  judul?: string
  platform?: string
  format?: string
  pilar?: string
  hook?: string
  caption?: string
  tanggal?: string
  jam?: string
  alasan?: string
  sumber?: string
  batch?: string
}
export const simpanBankCampaign = (body: BankInput, versi?: Versi) =>
  useApi()<Envelope<IdeBank>>(body.id
    ? `/konten/analytics/bank/${encodeURIComponent(body.id)}`
    : '/konten/analytics/bank',
  { method: body.id ? 'PATCH' : 'POST', body, headers: versiHdr(versi) })

/** POST bank/{id}/arsip */
export const arsipBankCampaign = (id: string, arsip: boolean) =>
  useApi()<unknown>(`/konten/analytics/bank/${encodeURIComponent(id)}/arsip`, { method: 'POST', body: { arsip } })

/** DELETE bank/{id} — ARSIP only (server enforces it in SQL). */
export const hapusBankCampaign = (id: string, versi?: Versi) =>
  useApi()<unknown>(`/konten/analytics/bank/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHdr(versi) })

/** POST bank/generate — AI content planning stored as IDE ideas. */
export const generateBankCampaign = (body: { dari: string, sampai: string, platform?: string, jumlah?: number, fokus?: string }) =>
  useApi()<Envelope<{ batch: string, jumlah: number, ringkasan: string, model: string }>>('/konten/analytics/bank/generate', {
    method: 'POST', body: { ...body, jumlah: Math.min(body.jumlah ?? 10, 50) },
  })

/** OAuth: start (→ {url}), sync, disconnect per provider. */
export const oauthMulaiCampaign = (provider: 'tiktok' | 'instagram') =>
  useApi()<Envelope<{ url: string }>>(`/konten/analytics/oauth/${provider}/start`, { method: 'POST' })
export const oauthSinkronCampaign = (provider: 'tiktok' | 'instagram') =>
  useApi()<Envelope<{ jumlah: number, total: number, riwayatSelesai: boolean }>>(`/konten/analytics/oauth/${provider}/sync`, { method: 'POST' })
export const oauthPutusCampaign = (provider: 'tiktok' | 'instagram') =>
  useApi()<unknown>(`/konten/analytics/oauth/${provider}/disconnect`, { method: 'POST' })

/** PUT settings — campaign module admin only. */
export const simpanPengaturanCampaign = (body: Record<string, unknown>) =>
  useApi()<unknown>('/konten/analytics/settings', { method: 'PUT', body })

/**
 * Run a versioned campaign write: on 409/428 reload and say so, otherwise
 * toast the error. Reloads the shared campaign state on success.
 */
export async function campaignSimpan(aksi: () => Promise<unknown>, sukses?: string): Promise<boolean> {
  const toast = tryUseNuxtApp()?.vueApp.runWithContext(() => useToast()) ?? null
  const muatUlang = () => refreshNuxtData('campaign-state')
  try {
    await aksi()
    await muatUlang()
    if (sukses) toast?.add({ title: sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast?.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}
