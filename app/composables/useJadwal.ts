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
import type { KruJadwal, PeranJadwal, PetaSel, SelJadwal, SettingJadwal, Timpa } from '~/utils/jadwal'
import { daftarTimpa, kunciSel, normalSetting, peranJadwal, selDariPengajuan } from '~/utils/jadwal'

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

/**
 * The bulk-write flow shared by the sheet tools (Salin, Isi Jadwal, Impor,
 * Kosongkan): compute the overwrites, ask through JadwalTimpa when any filled
 * cell changes, then write in one PUT. With no clash it still asks when
 * `selaluTanya` (the old tools confirmed "Salin minggu lalu?" too).
 */
export function useJadwalMassal(o: {
  peta: Ref<PetaSel>
  nama: (uid: string) => string
  aju: Ref<PengajuanJadwal[]>
  sesudah: () => unknown
}) {
  const toast = useToast()
  const open = ref(false)
  const sibuk = ref(false)
  const judul = ref('')
  const pesan = ref('')
  const ya = ref('')
  const alt = ref('')
  const bentrok = ref<Timpa[]>([])
  const dariAju = ref(0)
  let rows: SelJadwal[] = []
  let clear: { u: string, d: string }[] = []
  let aman: SelJadwal[] = []
  let selesai = ''

  async function tulis(r: SelJadwal[], c: { u: string, d: string }[], teks: string) {
    if (!r.length && !c.length) {
      toast.add({ title: 'Tidak ada yang perlu diubah', color: 'info' })
      open.value = false
      return
    }
    sibuk.value = true
    try {
      await saveCells(r, c)
      toast.add({ title: teks, color: 'success' })
      open.value = false
      await o.sesudah()
    }
    catch (e) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
    finally {
      sibuk.value = false
    }
  }

  /** Ask (if needed) and write. `pesanSelesai(n)` is the toast for n cells written. */
  function minta(p: {
    rows?: SelJadwal[]
    clear?: { u: string, d: string }[]
    judul: string
    judulBentrok?: (n: number) => string
    pesan: string
    ya: string
    yaBentrok?: (n: number) => string
    bolehLewati?: boolean
    selaluTanya?: boolean
    selesai: string
  }) {
    rows = p.rows ?? []
    clear = p.clear ?? []
    selesai = p.selesai
    bentrok.value = daftarTimpa(o.peta.value, rows, o.nama)
    const kunci = new Set(bentrok.value.map(x => kunciSel(x.baru.u, x.baru.d)))
    aman = rows.filter(r => !kunci.has(kunciSel(r.u, r.d)))
    dariAju.value = selDariPengajuan(clear.length ? clear : bentrok.value.map(x => x.baru), o.aju.value).length
    if (!bentrok.value.length && !p.selaluTanya) {
      tulis(rows, clear, selesai)
      return
    }
    judul.value = bentrok.value.length && p.judulBentrok ? p.judulBentrok(bentrok.value.length) : p.judul
    pesan.value = p.pesan
    ya.value = bentrok.value.length && p.yaBentrok ? p.yaBentrok(bentrok.value.length) : p.ya
    alt.value = p.bolehLewati && bentrok.value.length && aman.length ? `Lewati yang terisi (${aman.length})` : ''
    open.value = true
  }

  const jalan = () => tulis(rows, clear, selesai)
  const jalanAman = () => tulis(aman, [], selesai)
  return { open, sibuk, judul, pesan, ya, alt, bentrok, dariAju, minta, jalan, jalanAman, tulis }
}
