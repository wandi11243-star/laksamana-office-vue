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
  BrandKonten, KontenItem, LevelKonten, PermsKonten, ProdTask, ShootingKonten, UserKonten, VisitKonten,
} from '~/utils/konten'
import { ROLE_BAWAAN_KONTEN, VIEW_PERM_KONTEN, levelKonten, normPlatform, permsKonten } from '~/utils/konten'
import type { Versi } from '~/utils/versi'
import { ifMatch, tanganiKonflik } from '~/utils/versi'

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
  assets: Record<string, unknown>[]
  bank: Record<string, unknown>[]
  kols: { id: string, name?: string, updatedAt?: number }[]
  visits: VisitKonten[]
  ads: Record<string, unknown>[]
  adFunds: Record<string, unknown>[]
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
