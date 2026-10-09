// Konten — API calls + types. One backend under /api/v1/konten
// (laksamana-api/docs/api/konten.md).
//
// Read: like the old `getAll`, every screen works from ONE `GET /state`
// (all collections + logs + settings/perms documents), shared under the key
// 'konten-state'. Write: per record, never whole-state (U4): POST / PUT /
// PATCH / DELETE /{resource}[/{id}] with the row's version as If-Match. A row's
// version IS its `updatedAt` (ms); a 409 carries the live row, a write identical
// to the stored row is a no-op success.
//
//   if (await kontenSimpan(() => tambalKonten('content', c.id, { status }, c.updatedAt), 'Status diubah')) …
//
// Who I am inside the Panel: the crew row whose id is my Office id (else my
// name), with its own roles; an Office admin of `konten` acts as super_admin
// for the session (old OFFICE_IS_ADMIN, deploy/konten/index.html:1389-1405).
// A person with no crew row yet gets planner, in memory only — the old client
// did the same (:1472-1483); creating the row is Kelola Kru's job (#51).
//
// Not carried over (docs/migrasi/konten.md E, _pertanyaan.md): `ping`/`stats`
// (U3), whole-state `saveAll` (U4), Restore JSON (K-01 → G-13).
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import type {
  AssetKonten, BrandKonten, KontenItem, LevelKonten, PermsKonten, ProdTask, ReqDesainMkt, ShootingKonten, UserKonten,
} from '~/utils/konten'
import { ROLE_BAWAAN_KONTEN, VIEW_PERM_KONTEN, levelKonten, normPlatform, opsiDesainMkt, permsKonten } from '~/utils/konten'
import type { KatPk, UrutPk } from '~/utils/performa-konten'
import type { DanaIklan, IklanKonten, KolKonten, VisitPenuh } from '~/utils/promosi-konten'
import { statusIklanOtomatis } from '~/utils/promosi-konten'
import type { MemberOffice } from '~/utils/sistem-konten'
import { rencanaSinkronKru } from '~/utils/sistem-konten'
import { hariIni } from '~/utils/format'
import { pkBulanIni } from '~/utils/performa-konten'
import type { Versi } from '~/utils/versi'
import { ifMatch, tanganiKonflik, versiDari } from '~/utils/versi'

/** v1 resource names (`docs/api/konten.md` Records). */
export type KontenResource = 'users' | 'brands' | 'campaigns' | 'content' | 'prod-tasks' | 'shootings' | 'assets' | 'bank' | 'kols' | 'visits' | 'ads' | 'ad-funds' | 'notifications'

/** One activity line (`logs`, append-only). */
export interface LogKonten { id?: string, by?: string, action?: string, target?: string, at?: number }

/** `GET /konten/state`: the collections under their LEGACY keys (`prodTasks`, `adFunds`, `notifs`). */
export interface StateKonten {
  users: UserKonten[]
  brands: BrandKonten[]
  campaigns: Record<string, unknown>[]
  content: KontenItem[]
  prodTasks: ProdTask[]
  shootings: ShootingKonten[]
  assets: AssetKonten[]
  bank: Record<string, unknown>[]
  kols: KolKonten[]
  visits: VisitPenuh[]
  ads: IklanKonten[]
  adFunds: DanaIklan[]
  notifs: Record<string, unknown>[]
  logs: LogKonten[]
  settings: { orgName?: string }
  perms: PermsKonten
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : [])

export function stateKontenKosong(): StateKonten {
  return {
    users: [], brands: [], campaigns: [], content: [], prodTasks: [], shootings: [], assets: [], bank: [],
    kols: [], visits: [], ads: [], adFunds: [], notifs: [], logs: [], settings: {}, perms: permsKonten(null),
  }
}

/**
 * The state as the old boot shaped it (:830-865): every list present, every
 * content row with `prod` and a de-duplicated `platforms` (normalised codes),
 * and the role matrix brought up to date.
 */
export function normStateKonten(raw: unknown): StateKonten {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const content = arr<KontenItem>(s.content).map((c) => {
    const platforms = [...new Set((c.platforms?.length ? c.platforms : (c.platform ? [c.platform] : [])).map(normPlatform).filter(Boolean))]
    return { ...c, prod: c.prod ?? {}, platforms, platform: platforms[0] ?? '' }
  })
  return {
    users: arr(s.users), brands: arr(s.brands), campaigns: arr(s.campaigns), content,
    prodTasks: arr(s.prodTasks), shootings: arr(s.shootings), assets: arr(s.assets), bank: arr(s.bank),
    kols: arr(s.kols), visits: arr(s.visits), ads: arr(s.ads), adFunds: arr(s.adFunds), notifs: arr(s.notifs),
    logs: arr(s.logs),
    settings: (s.settings && typeof s.settings === 'object' ? s.settings : {}) as StateKonten['settings'],
    perms: permsKonten(s.perms),
  }
}

/** GET /konten/state */
export const getStateKonten = () => useApi()<Envelope<unknown>>('/konten/state')

/** The shared state every Konten screen reads. One request per page load, refreshed after writes. */
export const useStateKonten = () =>
  useAsyncData('konten-state', () => getStateKonten().then(r => normStateKonten(r.data)), { default: stateKontenKosong })

// ---------------------------------------------------------------- who I am

export interface SayaKonten { user: UserKonten, roles: string[], super: boolean, sementara: boolean }

/** Map the Office user onto a crew row (:1472-1483): id first, then the name. */
export function sayaKonten(me: Me | null, users: UserKonten[]): SayaKonten | null {
  if (!me) return null
  const admin = isAdminOf(me, 'konten')
  const nama = String(me.name || '').toLowerCase()
  const u = users.find(x => x.id === me.id) ?? users.find(x => String(x.name || '').toLowerCase() === nama)
  if (u) {
    const roles = u.roles ?? []
    return { user: u, roles, super: admin || roles.includes('super_admin'), sementara: false }
  }
  const roles = admin ? ['super_admin'] : [...ROLE_BAWAAN_KONTEN]
  return { user: { id: me.id, name: me.name, roles }, roles, super: admin, sementara: true }
}

/** The bits the module menu needs before a screen is drawn (shell `siapkan`). */
export const usePeranKonten = () => useState<{ users: UserKonten[], perms: PermsKonten | null }>('konten-peran', () => ({ users: [], perms: null }))

/** Load the state once on entering the module and mirror crew + matrix for the menu. */
export function muatPeranKonten() {
  const peran = usePeranKonten()
  const { data } = useStateKonten()
  watchEffect(() => {
    peran.value = { users: data.value.users, perms: data.value.perms }
  })
  return peran
}

/** My level on a matrix row. super_admin / Office admin = edit everywhere. */
export function levelSayaKonten(me: Me | null, users: UserKonten[], perms: PermsKonten | null, row: string): LevelKonten {
  const s = sayaKonten(me, users)
  if (!s) return 0
  if (s.super) return 2
  return levelKonten(perms ?? permsKonten(null), s.roles, row)
}

/**
 * May I OPEN a screen (:1402-1414 canView). Screens outside the map are open to
 * everyone; Pengaturan also opens for the `team` row, so a Content Director
 * keeps the crew list (F.26).
 */
export function bolehLihatKonten(me: Me | null, users: UserKonten[], perms: PermsKonten | null, layar: string): boolean {
  if (layar === 'settings' && levelSayaKonten(me, users, perms, 'team') >= 1) return true
  const row = VIEW_PERM_KONTEN[layar]
  if (!row) return true
  return levelSayaKonten(me, users, perms, row) >= 1
}

/** Reactive access for a screen: `can('content')` = may edit, like the old `can()`. */
export function useAksesKonten() {
  const me = useMe()
  const { data } = useStateKonten()
  const saya = computed(() => sayaKonten(me.value, data.value.users))
  const can = (row: string) => levelSayaKonten(me.value, data.value.users, data.value.perms, row) >= 2
  const canView = (layar: string) => bolehLihatKonten(me.value, data.value.users, data.value.perms, layar)
  return { saya, can, canView }
}

// ---------------------------------------------------------------- brand filter
// The old global `brandFilter` (:1385-1387): one choice shared by every screen
// that shows the brand bar.

export const useBrandKonten = () => useState<string>('konten-brand', () => 'all')
export const saringBrand = <T extends { brand?: string }>(list: T[], brand: string) =>
  (brand === 'all' ? list : list.filter(x => x.brand === brand))

// ---------------------------------------------------------------- writes

const versiHdr = (v?: Versi) => (v === undefined ? undefined : ifMatch(v))

/** POST /konten/{resource} — `id` optional (server makes `<prefix>_xxxxxxxxxx`). */
export const buatKonten = <T>(res: KontenResource, body: Partial<T>) =>
  useApi()<Envelope<T>>(`/konten/${res}`, { method: 'POST', body })

/** PUT — replaces the whole record. Needs the version. */
export const ubahKonten = <T>(res: KontenResource, id: string, body: Partial<T>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/konten/${res}/${encodeURIComponent(id)}`, { method: 'PUT', body, headers: versiHdr(versi) })

/** PATCH — merges top-level fields. Needs the version. */
export const tambalKonten = <T>(res: KontenResource, id: string, fields: Partial<T>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/konten/${res}/${encodeURIComponent(id)}`, { method: 'PATCH', body: fields, headers: versiHdr(versi) })

/** DELETE — needs the version. */
export const hapusKonten = (res: KontenResource, id: string, versi?: Versi) =>
  useApi()<unknown>(`/konten/${res}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHdr(versi) })

/** POST /konten/logs — the activity trail (`by` comes from the token). */
export const logKonten = (action: string, target = '') =>
  useApi()<unknown>('/konten/logs', { method: 'POST', body: { action, target } })

/** PUT /konten/content/{id}/performance — merges one platform's figures, stamps {at, by}. */
export const simpanPerformaKonten = (id: string, platform: string, metrics: Record<string, unknown>) =>
  useApi()<Envelope<KontenItem>>(`/konten/content/${encodeURIComponent(id)}/performance`, { method: 'PUT', body: { platform, metrics } })

/**
 * PUT /konten/content/{id}/performance with `metrics: null` — REMOVES that one
 * platform's entry and keeps the others (G-01 / laksamana-api#177). This is the
 * old `delete c.perf[platform]` when every box of that platform was emptied;
 * the caller confirms first, naming the platform (konten.md F.10).
 */
export const hapusPerformaKonten = (id: string, platform: string) =>
  useApi()<Envelope<KontenItem>>(`/konten/content/${encodeURIComponent(id)}/performance`, { method: 'PUT', body: { platform, metrics: null } })

/** GET/PUT /konten/documents/{doc} — `settings`, `perms`, `seeded`; version = content hash. */
export const getDokumenKonten = <T>(doc: 'settings' | 'perms' | 'seeded') =>
  useApi()<Envelope<T>>(`/konten/documents/${doc}`)
export const putDokumenKonten = <T>(doc: 'settings' | 'perms' | 'seeded', value: T, versi: Versi) =>
  useApi()<Envelope<T>>(`/konten/documents/${doc}`, { method: 'PUT', body: value as Record<string, unknown>, headers: ifMatch(versi) })

/**
 * Run a versioned write: on 409/428 reload and say so, otherwise toast the
 * error. Reloads the shared state on success. Optional activity line, like the
 * old `logAct` that followed almost every action (F.32) — its failure never
 * fails the write.
 */
export async function kontenSimpan<T>(aksi: () => Promise<T>, sukses?: string, jejak?: { action: string, target?: string }): Promise<boolean> {
  const toast = tryUseNuxtApp()?.vueApp.runWithContext(() => useToast()) ?? null
  const muatUlang = () => refreshNuxtData('konten-state')
  try {
    await aksi()
    if (jejak) await logKonten(jejak.action, jejak.target).catch(() => {})
    await muatUlang()
    if (sukses) toast?.add({ title: sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast?.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}

/**
 * The old notify() (:1577): a notification row `{type, text, at, read, to}`.
 * Fire-and-forget like the old client — a failed notification never fails
 * the action that triggered it.
 */
export const notifKonten = (type: string, text: string, to = 'all') =>
  buatKonten('notifications', { type, text, at: Date.now(), read: false, to }).catch(() => {})

/** Reference photos: shrunk before storing (max side 1280px, JPEG ≤ ~700 KB of base64), :1978-1979. */
export const REF_IMG_MB = 3
export const REF_TOTAL_MB = 9

/**
 * Shrink an image in the browser (old kecilkanGambar, :2101-2130). White
 * background first: JPEG has no transparency and a transparent PNG would turn
 * black. Any failure is returned as a message — an image that silently fails
 * to save is only discovered when someone else opens the content.
 */
export function kecilkanGambarKonten(file: File, maksPx = 1280, batas = 700 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('berkasnya gagal dibaca'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('gambarnya tidak bisa dibaca — pakai JPG atau PNG'))
      img.onload = () => {
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (!w || !h) return reject(new Error('ukuran gambarnya tidak terbaca'))
        if (w > maksPx || h > maksPx) {
          const s = Math.min(maksPx / w, maksPx / h)
          w = Math.round(w * s)
          h = Math.round(h * s)
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')
        if (!g) return reject(new Error('gagal memproses gambar'))
        g.fillStyle = '#fff'
        g.fillRect(0, 0, w, h)
        g.drawImage(img, 0, 0, w, h)
        let hasil = ''
        for (const mutu of [0.8, 0.65, 0.5]) {
          hasil = c.toDataURL('image/jpeg', mutu)
          if (hasil.length <= batas) break
        }
        if (!hasil) return reject(new Error('gagal memproses gambar'))
        resolve(hasil)
      }
      img.src = String(fr.result)
    }
    fr.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------- Marketing design requests (#48)
// The Design & Editing queues READ Marketing's requests and write back only
// "done" (konten.md D.23b, F.21). G-16 (laksamana-api#190) opens the queue
// reads/writes to `marketing|konten`, so a crew member who holds only Konten
// can open and finish the queue. The read is still lazy and may fail on its own
// (API down); it must never block the queue: the screen shows a warning with
// "Coba lagi" and the rest of the queue as usual.

/** GET /marketing/design-queue?active=1 — once per session (shared key), like REQ_MKT. */
export const useReqDesainMkt = () =>
  useAsyncData('konten-req-mkt', () =>
    useApi()<Envelope<{ reqs?: ReqDesainMkt[] }>>('/marketing/design-queue', { query: { active: 1 } }).then(r => r.data?.reqs ?? []),
  { default: () => [] as ReqDesainMkt[], server: false })

/**
 * GET /marketing/design-queue WITHOUT `active`: finished requests too, with
 * their doneAt — Performa Desain counts them (separately). Loaded only when
 * that page is open; a failure shows a warning, never blocks.
 */
export const useReqDesainMktSemua = () =>
  useAsyncData('konten-req-mkt-semua', () =>
    useApi()<Envelope<{ reqs?: ReqDesainMkt[] }>>('/marketing/design-queue').then(r => r.data?.reqs ?? []),
  { default: () => [] as ReqDesainMkt[], server: false })

/** GET /marketing/design-requests/{id} — the full request incl. reference images (`refs` {t, v, n}). */
export const getReqDesainMkt = (id: string) =>
  useApi()<Envelope<{ refs?: { t: string, v: string, n?: string }[] }>>(`/marketing/design-requests/${encodeURIComponent(id)}`)

/** PUT /marketing/design-requests/{id}/progress — "✓ Tandai Selesai" (designReqSet). */
export const selesaiReqDesainMkt = (id: string, picNama: string) =>
  useApi()<unknown>(`/marketing/design-requests/${encodeURIComponent(id)}/progress`, { method: 'PUT', body: { status: 'done', picNama } })

/**
 * PUT /marketing/design-options — lend Marketing our brands, crew and
 * platforms for its request form, ONCE per session after the queue read
 * succeeded (T-07, kirimOpsiMkt). Fire-and-forget; nothing to send = not sent.
 */
export function kirimOpsiDesainMkt(st: StateKonten) {
  const terkirim = useState('konten-opsi-mkt', () => false)
  if (terkirim.value) return
  const opsi = opsiDesainMkt(st.brands, st.users)
  if (!opsi.brands.length && !opsi.pics.length) return
  terkirim.value = true
  useApi()('/marketing/design-options', { method: 'PUT', body: opsi }).catch(() => {})
}

// ---------------------------------------------------------------- performance pages

/**
 * The choices of Performa Konten & Performa Desain (old PK_STATE). ONE state
 * for both pages, so moving between them keeps the month — the old pages did
 * the same. Default month = this month (WIB). Another host (Analytics) passes
 * its own key.
 */
export interface KeadaanPk { bulan: string, plat: string, urut: UrutPk, cari: string, kat: KatPk }
export const useKeadaanPk = (kunci = 'konten-pk') =>
  useState<KeadaanPk>(kunci, () => ({ bulan: pkBulanIni(), plat: '', urut: 'reach', cari: '', kat: 'pillar' }))

// ---------------------------------------------------------------- ads

/**
 * Ad statuses follow their dates (old autoUpdateStatuses, :1635, run when the
 * Panel opened): ended / active / draft from start & end, a manual "paused"
 * untouched. Here: once per session, after the state loaded, only for whoever
 * may edit `ads` (a viewer opening the dashboard should not write), silently —
 * one PATCH per changed ad with its version, a failure just leaves the old
 * status for the next session.
 */
export function useStatusIklanOtomatis() {
  const { data, status } = useStateKonten()
  const { can } = useAksesKonten()
  const sudah = useState('konten-iklan-status', () => false)
  watch([status, () => data.value.ads.length, () => can('ads')], async ([s]) => {
    if (sudah.value || s !== 'success' || !can('ads')) return
    sudah.value = true
    const hari = hariIni()
    const ubah = data.value.ads.map(a => ({ a, s: statusIklanOtomatis(a, hari) })).filter(x => x.s)
    let n = 0
    for (const { a, s: baru } of ubah) {
      try {
        await tambalKonten<IklanKonten>('ads', a.id, { status: baru! }, a.updatedAt)
        n++
      }
      catch {
        // stale or refused: the next session tries again
      }
    }
    if (n) await refreshNuxtData('konten-state')
  }, { immediate: true })
}

// ---------------------------------------------------------------- documents

/**
 * Write a whole document (`settings`, `perms`) against its CURRENT content
 * hash: read it, apply `ubah` to what is stored now, PUT with that hash. A
 * stale hash (someone saved in between) comes back as 409 and kontenSimpan
 * reloads — the matrix editor never overwrites a matrix it did not see.
 */
export async function simpanDokumenKonten<T>(doc: 'settings' | 'perms', ubah: (lama: T | null) => T) {
  const r = await getDokumenKonten<T>(doc)
  return putDokumenKonten<T>(doc, ubah(r.data ?? null), versiDari(r) ?? '')
}

// ---------------------------------------------------------------- crew roster

/**
 * Crew rows follow the Office roster of `konten` (old autoSyncOfficeRoster,
 * :1489, at every boot): new members get a row, names follow Office, a new
 * module admin gains super_admin. Here: once per session, only for an Office
 * admin of `konten` (the only one who may manage crew), silently — a failed
 * write is retried next session. Rows that match only by NAME under an old
 * id are returned (`kembar`) for Pengaturan to mention; they are not re-keyed.
 */
export function useSinkronKruKonten() {
  const me = useMe()
  const { data, status } = useStateKonten()
  const sudah = useState('konten-kru-sinkron', () => false)
  const kembar = useState<{ nama: string, id: string, officeId: string }[]>('konten-kru-kembar', () => [])
  watch([status, () => me.value?.id], async ([s]) => {
    if (sudah.value || s !== 'success' || !isAdminOf(me.value, 'konten')) return
    sudah.value = true
    let members: MemberOffice[]
    try {
      members = (await useApi()<Envelope<MemberOffice[]>>('/account/modules/konten/members')).data ?? []
    }
    catch {
      return
    }
    const r = rencanaSinkronKru(members, data.value.users)
    kembar.value = r.kembar.map(x => ({ nama: x.u.name, id: x.u.id, officeId: x.officeId }))
    let n = 0
    for (const u of r.baru) {
      try {
        await buatKonten<UserKonten>('users', u)
        n++
      }
      catch { /* next session */ }
    }
    for (const { u, fields } of r.ubah) {
      try {
        await tambalKonten<UserKonten>('users', u.id, fields, u.updatedAt)
        n++
      }
      catch { /* next session */ }
    }
    if (n) await refreshNuxtData('konten-state')
  }, { immediate: true })
  return kembar
}

/** Download text as a file (old downloadFile, :4627) and say so. */
export function unduhKonten(nama: string, isi: string, tipe: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([isi], { type: tipe }))
  a.download = nama
  a.click()
  URL.revokeObjectURL(a.href)
  tryUseNuxtApp()?.vueApp.runWithContext(() => useToast())?.add({ title: `File diunduh: ${nama}`, color: 'success' })
}
