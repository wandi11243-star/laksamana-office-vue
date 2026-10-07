// Jadwal Shift API calls + types (laksamana-api/docs/api/jadwal.md).
//
// The old page loaded everything in one `getAll` (`{setting, sel, pengajuan}`,
// deploy/jadwal/index.html:1456); v1 splits it into cells, requests, settings
// and roster, read here with one cache key each so every screen and the menu
// share them.
//
// No version/ETag: the contract has none (cells are last-wins per row, like
// the old `simpanSel`), so writes send no `If-Match`. The server checks the
// head-of-Divisi rule per row and answers 403 `forbidden`.
//
// The DAILY WORKER block (approved DW shifts) needs `GET /dw/schedule`, which
// demands module `dw`. Most crew hold `jadwal` only, so the block is read only
// for `dw` holders until laksamana-api#179 (G-03) gives `jadwal` its own read.
import type { KruJadwal, PeranJadwal, SelJadwal, SettingJadwal } from '~/utils/jadwal'
import { normalSetting, peranJadwal } from '~/utils/jadwal'

export interface PengajuanJadwal {
  id: string
  userId: string
  jenis: string
  dari: string
  sampai: string
  alasan: string
  status: 'MENUNGGU' | 'MENUNGGU_HRD' | 'DISETUJUI' | 'DITOLAK'
  headAt: number
  headOleh: string
  shift: string
  jamMulai: string
  jamSelesai: string
  dibuatAt: number
  dibuatOleh: string
  putusAt: number
  putusOleh: string
  putusNota: string
}

/** One approved DW shift (`GET /dw/schedule` rows). */
export interface DwJadwal {
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

/** GET /jadwal/settings — the blob, normalised with the old defaults. */
export const useJadwalSettings = () =>
  useAsyncData('jadwal-settings', () => useApi()<Envelope<unknown>>('/jadwal/settings').then(r => normalSetting(r.data)), {
    default: () => normalSetting({}),
  })

/** GET /jadwal/roster — every Office User with `divisi` resolved by the server. */
export const useJadwalRoster = () =>
  useAsyncData('jadwal-roster', () => useApi()<Envelope<KruJadwal[]>>('/jadwal/roster').then(r => r.data), {
    default: () => [] as KruJadwal[],
  })

/** GET /jadwal/cells for a range. */
export const useJadwalCells = (key: string, from: Ref<string>, to: Ref<string>) =>
  useAsyncData(
    key,
    () => useApi()<Envelope<SelJadwal[]>>('/jadwal/cells', { query: { from: from.value, to: to.value } }).then(r => r.data),
    { watch: [from, to], default: () => [] as SelJadwal[] },
  )

/**
 * GET /jadwal/requests — the full table, newest first. Any module holder sees
 * every row (same as the old `getAll`); the screens narrow it with
 * `bisaLihatAju`. One key, shared by Pengajuan, Jadwal Saya and the badge.
 */
export const useJadwalRequests = () =>
  useAsyncData('jadwal-requests', () => useApi()<Envelope<PengajuanJadwal[]>>('/jadwal/requests').then(r => r.data), {
    default: () => [] as PengajuanJadwal[],
  })

/**
 * Approved DW shifts for a range — only for `dw` holders (G-03). Never throws
 * into the screen: like the old `muatDW()` (`:1478`), a failure is one warning
 * line and the crew sheet still draws whole.
 */
export function useJadwalDw(key: string, from: Ref<string>, to: Ref<string>) {
  const me = useMe()
  const bisa = computed(() => hasAccess(me.value, ['dw']))
  const res = useAsyncData(
    key,
    async () => {
      if (!bisa.value) return [] as DwJadwal[]
      const r = await useApi()<Envelope<{ rows: DwJadwal[] }>>('/dw/schedule', { query: { from: from.value, to: to.value } })
      return r.data.rows ?? []
    },
    { watch: [from, to, bisa], default: () => [] as DwJadwal[] },
  )
  return { ...res, bisa }
}

/**
 * The base every screen reads: setting, roster and the viewer's standing.
 * `peran` is computed from the loaded setting, so the head rules match the
 * sheet the person is looking at.
 */
export function useJadwalDasar() {
  const me = useMe()
  const settings = useJadwalSettings()
  const roster = useJadwalRoster()
  const set = computed<SettingJadwal>(() => settings.data.value ?? normalSetting({}))
  const kru = computed<KruJadwal[]>(() => roster.data.value ?? [])
  const peran = computed<PeranJadwal>(() => peranJadwal(me.value, set.value, kru.value))
  const kruById = (id: string) => kru.value.find(u => u.id === id) ?? null
  const divisiDari = (id: string) => kruById(id)?.divisi ?? null
  const pending = computed(() => settings.status.value === 'pending' || roster.status.value === 'pending')
  const error = computed(() => settings.error.value ?? roster.error.value ?? null)
  const refresh = () => Promise.all([settings.refresh(), roster.refresh()])
  return { me, set, kru, peran, kruById, divisiDari, pending, error, refresh }
}

// ---------------------------------------------------------------- writes

/** PUT /jadwal/cells — upsert `cells`, delete `clear`, one transaction. */
export const saveCells = (cells: SelJadwal[], clear: { u: string, d: string }[] = []) =>
  useApi()<Envelope<{ saved: boolean, isi: number, hapus: number, ts: number }>>('/jadwal/cells', {
    method: 'PUT',
    body: { cells, clear },
  })

/** POST /jadwal/requests — always lands as MENUNGGU; `userId` is forced to the caller unless admin. */
export const createRequest = (body: {
  userId?: string
  jenis: string
  dari: string
  sampai: string
  alasan: string
  shift: string
  jamMulai: string
  jamSelesai: string
}) => useApi()<Envelope<{ saved: boolean, id: string }>>('/jadwal/requests', { method: 'POST', body })

/** POST /jadwal/requests/{id}/decision — two steps, enforced by the server. */
export const decideRequest = (id: string, status: 'MENUNGGU_HRD' | 'DISETUJUI' | 'DITOLAK', nota = '') =>
  useApi()<Envelope<{ saved: boolean, id: string, status: string }>>(`/jadwal/requests/${id}/decision`, {
    method: 'POST',
    body: { status, nota },
  })

/** DELETE /jadwal/requests/{id} — the requester or a head. */
export const deleteRequest = (id: string) =>
  useApi()<Envelope<{ deleted: boolean, id: string }>>(`/jadwal/requests/${id}`, { method: 'DELETE' })
