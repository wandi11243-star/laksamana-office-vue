// Daily Worker API calls + types (laksamana-api/docs/api/dw.md).
//
// The old page loaded everything in one `getAll` (`{setting, pekerja, ajuan,
// permintaan, peran}`, deploy/dw/index.html:1930); v1 keeps that bootstrap as
// GET /dw/overview, read here under one key so every screen (and the module
// chrome) shares the same state. Writes are the granular v1 endpoints.
//
// No version/ETag: the contract has none (last-wins per row, dw.md
// §Concurrency), so writes send no `If-Match`. Overlaps are the server's
// business: 409 `overlap` carries the conflict in `error.details`, and the
// screen has to ask the person what to do (`bentrokDari`).
import type { FetchError } from 'ofetch'
import type { AjuanDw, PekerjaDw, PermintaanDw, SettingDw } from '~/utils/dw'
import { akhirBulanDw, normalDw } from '~/utils/dw'
import { DIVISI, seninDari } from '~/utils/jadwal'
import { hariIni, tambahHari } from '~/utils/format'

// ---------------------------------------------------------------- shared range

/** Calendar month in view, `YYYY-MM` (`BULAN_AKTIF`, deploy/dw/index.html:1299). */
export const useDwBulan = () => useState('dw-bulan', () => hariIni().slice(0, 7))
/** Dashboard date (`DASH_TGL`, :1298). */
export const useDwDashTgl = () => useState('dw-dash-tgl', () => hariIni())
/** Attendance date (`HADIR_TGL`, :6532). */
export const useDwHadirTgl = () => useState('dw-hadir-tgl', () => hariIni())
/** Payment week Monday; '' = the week of today (`BAYAR_MINGGU`, :6846). */
export const useDwBayarMinggu = () => useState('dw-bayar-minggu', () => '')

/**
 * Guest pax per date (event sources only), filled by the Kalender Tamu from
 * GET /dw/guests (G-05). The quota guide reads this: a date missing here
 * means "no event", falling back to weekday/weekend like the old page
 * without Marketing.
 */
export const useDwPax = () => useState<Record<string, number>>('dw-pax', () => ({}))

/** One aggregated guest row (`GET /dw/guests` rows). */
export interface TamuHarian {
  tgl: string
  sumber: string
  pax: number
}

/**
 * GET /dw/guests — daily guest pax per source for the Kalender Tamu (G-05,
 * laksamana-api#254): `{rows: [{tgl, sumber, pax}]}` with `sumber` one of
 * `marketing`, `event` or `reservasi`. Read in-process from the three source
 * modules, so a `dw` holder needs none of them. Summing per day is the only
 * client work, in `app/utils/pax-harian.ts` — the quota guide keeps reading
 * the event sources only (`paxAcaraDari`), exactly as the old page.
 */
export const useDwGuests = (key: string, from: Ref<string>, to: Ref<string>) =>
  useAsyncData(
    key,
    () => useApi()<Envelope<{ rows: TamuHarian[], dari: string, sampai: string }>>('/dw/guests', { query: { from: from.value, to: to.value } }).then(r => r.data.rows ?? []),
    { watch: [from, to], default: () => [] as TamuHarian[] },
  )

/** The range the bootstrap must cover (`rentangDibutuhkan`, :1943). */
export function useDwRentang() {
  const mk = useDwBulan()
  const dash = useDwDashTgl()
  const bayar = useDwBayarMinggu()
  return computed(() => {
    let dari = tambahHari(seninDari(`${mk.value}-01`), -7)
    let sampai = tambahHari(seninDari(akhirBulanDw(mk.value)), 13)
    if (dash.value) {
      if (tambahHari(dash.value, -7) < dari) dari = tambahHari(dash.value, -7)
      if (tambahHari(dash.value, 7) > sampai) sampai = tambahHari(dash.value, 7)
    }
    if (bayar.value) {
      if (bayar.value < dari) dari = bayar.value
      if (tambahHari(bayar.value, 6) > sampai) sampai = tambahHari(bayar.value, 6)
    }
    return { dari, sampai }
  })
}

// ---------------------------------------------------------------- reads

/** GET /dw/overview — the one bootstrap: setting, talent pool, rows, peran.
 *  The key carries the range, so shifting the month/date loads a new slice
 *  without depending on which component registered a watcher first. */
export function useDwOverview() {
  const rentang = useDwRentang()
  return useAsyncData(
    () => `dw-overview-${rentang.value.dari}-${rentang.value.sampai}`,
    () => useApi()<Envelope<unknown>>('/dw/overview', { query: { from: rentang.value.dari, to: rentang.value.sampai } }).then(r => normalDw(r.data)),
    { default: () => normalDw(null) },
  )
}

/** One approved DW shift (`GET /dw/schedule` rows). */
export interface DwJadwalRow {
  id: string
  dwId: string
  nama: string
  divisi: string
  posisi: string
  tgl: string
  m: string
  s: string
  hadir?: string
}

/** Approved shifts only, for the screens that draw them apart from the pool. */
export const useDwSchedule = (key: string, from: Ref<string>, to: Ref<string>) =>
  useAsyncData(
    key,
    () => useApi()<Envelope<{ rows: DwJadwalRow[], dari: string, sampai: string }>>('/dw/schedule', { query: { from: from.value, to: to.value } }).then(r => r.data.rows ?? []),
    { watch: [from, to], default: () => [] as DwJadwalRow[] },
  )

/** The base every DW screen reads, mirroring `useJadwalDasar`. */
export function useDwDasar() {
  const me = useMe()
  const overview = useDwOverview()
  const state = computed(() => overview.data.value ?? normalDw(null))
  const set = computed<SettingDw>(() => state.value.setting)
  const pekerja = computed<PekerjaDw[]>(() => state.value.pekerja)
  const ajuan = computed<AjuanDw[]>(() => state.value.ajuan)
  const permintaan = computed<PermintaanDw[]>(() => state.value.permintaan)
  const peran = computed(() => state.value.peran)
  const pekerjaById = (id: string) => pekerja.value.find(p => p.id === id) ?? null
  const pending = computed(() => overview.status.value === 'pending')
  const error = computed(() => overview.error.value)
  const refresh = () => overview.refresh()
  return { me, state, set, pekerja, ajuan, permintaan, peran, pekerjaById, pending, error, refresh }
}

/**
 * Division heads, asked of Jadwal Shift (T-11: `GET /jadwal/heads` is
 * `{uid:[div]}`). A DW-only HRD may not hold module `jadwal`, so this NEVER
 * throws: failure means an empty column, said out loud in Hak Akses like the
 * old page (`HEAD_ERR`, deploy/dw/index.html:2166).
 */
export function useDwHeads() {
  const peta = useState<Record<string, string[]>>('dw-heads', () => ({}))
  const error = useState('dw-heads-err', () => '')
  const siap = useState('dw-heads-siap', () => false)
  async function muat() {
    if (siap.value) return
    try {
      const r = await useApi()<Envelope<Record<string, unknown>>>('/jadwal/heads')
      peta.value = normalHeadsDw(r.data)
      error.value = ''
    }
    catch {
      peta.value = {}
      error.value = 'Modul Jadwal Shift tidak menjawab'
    }
    finally {
      siap.value = true
    }
  }
  return { peta, error, siap, muat }
}

/** `{uid:[div]}` as the contract sends it, with the legacy `{div:[uid]}` accepted. */
export function normalHeadsDw(raw: Record<string, unknown> | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const kode: string[] = DIVISI.map(d => d.k)
  const keys = Object.keys(raw ?? {})
  const terbalik = keys.length > 0 && keys.every(k => kode.includes(k))
  for (const k of keys) {
    const v = Array.isArray(raw![k]) ? (raw![k] as unknown[]).map(String) : []
    if (terbalik) {
      for (const uid of v) (out[uid] ??= []).push(k)
    }
    else out[k] = v
  }
  return out
}

// ---------------------------------------------------------------- writes — workers

/** POST (new) / PUT (edit) /dw/workers. HRD only. */
export const saveWorkerDw = (p: Partial<PekerjaDw> & { id?: string }) => (p.id
  ? useApi()<Envelope<{ saved: boolean, id: string }>>(`/dw/workers/${p.id}`, { method: 'PUT', body: p })
  : useApi()<Envelope<{ saved: boolean, id: string, baru: boolean }>>('/dw/workers', { method: 'POST', body: p }))

export const hapusWorkerDw = (id: string) =>
  useApi()<Envelope<{ deleted: boolean }>>(`/dw/workers/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------- writes — requests

export const simpanPermintaanDw = (x: Partial<PermintaanDw> & { id?: string }) => (x.id
  ? useApi()<Envelope<{ saved: boolean, row: PermintaanDw, bentrok: unknown[] }>>(`/dw/requests/${x.id}`, { method: 'PUT', body: x })
  : useApi()<Envelope<{ saved: boolean, row: PermintaanDw, bentrok: unknown[] }>>('/dw/requests', { method: 'POST', body: x }))

export const putusPermintaanDw = (id: string, status: 'DISETUJUI' | 'DITOLAK' | 'MENUNGGU' | 'BATAL', nota = '') =>
  useApi()<Envelope<{ saved: boolean, id: string, status: string }>>(`/dw/requests/${id}/decision`, { method: 'POST', body: { status, nota } })

export const tugaskanDw = (permintaanId: string, dwIds: string[]) =>
  useApi()<Envelope<{ masuk: number, tertahan: { nama?: string, dwId?: string, divisi?: string }[] }>>(`/dw/requests/${permintaanId}/assign`, { method: 'POST', body: { dwIds } })

export const hapusPermintaanDw = (id: string) =>
  useApi()<Envelope<{ deleted: boolean }>>(`/dw/requests/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------- writes — assignments

/** POST /dw/assignments — always lands MENUNGGU; `timpa` replaces a clashing shift. */
export const simpanAjuanDw = (row: Partial<AjuanDw> & { timpa?: boolean }) =>
  useApi()<Envelope<{ saved: boolean, row: AjuanDw }>>('/dw/assignments', { method: 'POST', body: { ...row, timpa: !!row.timpa } })

export const putusAjuanDw = (id: string, status: 'DISETUJUI' | 'DITOLAK' | 'MENUNGGU' | 'BATAL', nota = '') =>
  useApi()<Envelope<{ saved: boolean, id: string, status: string }>>(`/dw/assignments/${id}/decision`, { method: 'POST', body: { status, nota } })

export const putusBanyakDw = (ids: string[], status: 'DISETUJUI' | 'DITOLAK', nota = '') =>
  useApi()<Envelope<{ saved: boolean, ids: string[] }>>('/dw/assignments/decisions', { method: 'POST', body: { ids, status, nota } })

export const simpanHadirDw = (id: string, hadir: '' | 'HADIR' | 'TELAT' | 'ALFA', nota = '') =>
  useApi()<Envelope<{ saved: boolean, id: string }>>(`/dw/assignments/${id}/attendance`, { method: 'POST', body: { hadir, nota } })

export const gantiOrangDw = (id: string, dwBaru: string, nota = '') =>
  useApi()<Envelope<{ saved: boolean, lama: AjuanDw, baru: AjuanDw }>>(`/dw/assignments/${id}/replace`, { method: 'POST', body: { dwBaru, nota } })

/** The conflict the 409 `overlap` carries in `error.details.bentrok`. */
export interface BentrokDw {
  id?: string
  dwId?: string
  nama?: string
  divisi?: string
  posisi?: string
  tgl?: string
  m?: string
  s?: string
  status?: string
  lintasHari?: boolean
}

/** Read the overlapping shift out of a 409, so the screen can ask (`tanyaBentrok`, :5862). */
export function bentrokDari(e: unknown): BentrokDw | null {
  const body = (e as FetchError<{ error?: { code?: string, details?: unknown } }>)?.data
  if (body?.error?.code !== 'overlap') return null
  const details = body.error.details as { bentrok?: BentrokDw } | undefined
  return details?.bentrok ?? null
}

// ---------------------------------------------------------------- writes — payments & settings

export const tandaiBayarDw = (senin: string, kunci: string, nyala: boolean) =>
  useApi()<Envelope<{ saved: boolean, kunci: string, nyala: boolean }>>('/dw/payments/marks', { method: 'POST', body: { senin, kunci, nyala } })

/** PUT /dw/settings — the whole blob (HRD; `hr`/`akses` preserved for non-admin). */
export const simpanSettingDw = (data: SettingDw) =>
  useApi()<Envelope<{ saved: boolean, ts: number }>>('/dw/settings', { method: 'PUT', body: data })

/** POST /dw/admin/clear — module admin + the typed keyword (danger zone). */
export const kosongkanDw = (pekerja: boolean) =>
  useApi()<Envelope<{ cleared: boolean, ajuan: number, permintaan: number, pekerja: number, ikutPekerja: boolean }>>('/dw/admin/clear', { method: 'POST', body: { konfirmasi: 'HAPUS SEMUA', pekerja } })
