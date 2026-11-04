// Account admin (Kelola Akses) — superadmin data layer: users + modul registry.
// One backend under /api/v1/account (laksamana-api/docs/api/account.md "Users",
// "Modul registry"). Field names are EXACTLY what the API sends.
//
// GET /account/users already carries everything the old listAccess gave per
// user (modules, grants, denies, adminModules), so there is no separate
// listAccess read. Account writes carry NO versions (unlike bd/marketing):
// no If-Match here, and simpanAkun only reloads + toasts.
//
// Pages come later (task U2+); this file holds types, reads and writes only.
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import { tulisBerVersi } from '~/utils/versi'

/** One Office account as GET /account/users sends it. Never carries a PIN. */
export interface AccountUser {
  id: string
  name: string
  username: string
  keterangan: string
  active: boolean
  email?: string
  noHp?: string
  talentaId?: string
  branch?: string
  organization?: string
  jobPosition?: string
  jobLevel?: string
  employmentStatus?: string
  joinDate?: string
  modules: string[]
  grants: string[]
  denies: string[]
  adminModules: string[]
  ulid: string
}

/** One Modul registry row as GET /account/modules sends it. */
export interface AccountModule {
  key: string
  label: string
  active: boolean
}

/** meta.rules of GET /account/users: the checkbox defaults (account.md). */
export interface AccountRules {
  bawaan: Record<string, unknown>[]
  terbatas: Record<string, unknown>[]
  adminBawaan: Record<string, unknown>[]
}

/** GET /account/users shaped for the screens: the rows + the registry meta. */
export interface AccountData {
  users: AccountUser[]
  modules: string[]
  rules: AccountRules
}

export const accountKosong = (): AccountData => ({
  users: [],
  modules: [],
  rules: { bawaan: [], terbatas: [], adminBawaan: [] },
})

const teks = (v: unknown): string => (typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v)))
const opsional = (v: unknown): string | undefined => {
  const t = teks(v)
  return t === '' ? undefined : t
}
const daftar = (v: unknown): string[] => (Array.isArray(v) ? v.map(teks).filter(t => t !== '') : [])
const aktif = (v: unknown): boolean => v === true || v === 1

/** Defensive: the list may arrive as data itself or as data.users (legacy shape). */
export function normAccountUser(raw: unknown): AccountUser {
  const u = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    id: teks(u.id),
    name: teks(u.name),
    username: teks(u.username),
    keterangan: teks(u.keterangan),
    active: aktif(u.active),
    email: opsional(u.email),
    noHp: opsional(u.noHp),
    talentaId: opsional(u.talentaId),
    branch: opsional(u.branch),
    organization: opsional(u.organization),
    jobPosition: opsional(u.jobPosition),
    jobLevel: opsional(u.jobLevel),
    employmentStatus: opsional(u.employmentStatus),
    joinDate: opsional(u.joinDate),
    modules: daftar(u.modules),
    grants: daftar(u.grants),
    denies: daftar(u.denies),
    adminModules: daftar(u.adminModules),
    ulid: teks(u.ulid),
  }
}

export function normAccountModule(raw: unknown): AccountModule {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { key: teks(m.key), label: teks(m.label), active: aktif(m.active) }
}

export function normAccountRules(raw: unknown): AccountRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const arr = (v: unknown): Record<string, unknown>[] =>
    (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  return { bawaan: arr(r.bawaan), terbatas: arr(r.terbatas), adminBawaan: arr(r.adminBawaan) }
}

// ---------------------------------------------------------------- reads

/** GET /account/users — every real user + meta.modules + meta.rules. */
export const getAccountUsers = () => useApi()<Envelope<unknown>>('/account/users')

/** The user table every Kelola screen reads, with its registry meta. */
export function useAccountUsers() {
  return useAsyncData('account-users', async () => {
    const r = await getAccountUsers()
    const list = Array.isArray(r.data) ? r.data : (r.data as { users?: unknown } | null)?.users
    const meta = (r.meta ?? {}) as Record<string, unknown>
    return {
      users: (Array.isArray(list) ? list : []).map(normAccountUser),
      modules: daftar(meta.modules),
      rules: normAccountRules(meta.rules),
    } satisfies AccountData
  }, { dedupe: 'defer', default: accountKosong })
}

/** GET /account/modules — registry rows; semua=true keeps inactive Moduls. */
export const listAccountModules = (semua = true) =>
  useApi()<Envelope<unknown>>('/account/modules', { query: semua ? { all: 1 } : {} })

/** The Modul registry for the access checkboxes. */
export function useAccountModules() {
  return useAsyncData('account-modules', async () => {
    const r = await listAccountModules(true)
    const list = Array.isArray(r.data) ? r.data : []
    return list.map(normAccountModule)
  }, { dedupe: 'defer', default: () => [] as AccountModule[] })
}

// ---------------------------------------------------------------- writes

/** POST /account/users body (saveUser). Empty pin means the server default. */
export interface SimpanUserBody {
  name: string
  pin?: string
  username?: string | null
  keterangan?: string
  active?: boolean
  email?: string | null
  noHp?: string | null
  talentaId?: string | null
  branch?: string | null
  organization?: string | null
  jobPosition?: string | null
  jobLevel?: string | null
  employmentStatus?: string | null
  joinDate?: string | null
}

/** POST /account/users — name required; empty pin falls back to the server default. */
export const buatUser = (body: SimpanUserBody) =>
  useApi()<Envelope<{ id: string, email: string, noHp: string }>>('/account/users', { method: 'POST', body })

/** PATCH /account/users/{id} — same body; an empty/omitted pin keeps the old one. */
export const ubahUser = (id: string, body: SimpanUserBody) =>
  useApi()<Envelope<{ id: string, email: string, noHp: string }>>(`/account/users/${encodeURIComponent(id)}`, { method: 'PATCH', body })

/** PUT /account/users/{id}/active. */
export const setAktif = (id: string, active: boolean) =>
  useApi()<Envelope<{ id: string, active: boolean }>>(`/account/users/${encodeURIComponent(id)}/active`, { method: 'PUT', body: { active } })

/** DELETE /account/users/{id} — the server refuses active accounts: deactivate first. */
export const hapusUser = (id: string) =>
  useApi()<unknown>(`/account/users/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** PUT /account/users/{id}/access — grant (true) or revoke (false) one Modul. */
export const setAkses = (id: string, module: string, access: boolean) =>
  useApi()<unknown>(`/account/users/${encodeURIComponent(id)}/access`, { method: 'PUT', body: { module, access } })

/** PUT /account/users/{id}/admin — module admin, or '*' for superadmin. */
export const setAdmin = (id: string, module: string, admin: boolean) =>
  useApi()<Envelope<{ userId: string, module: string, admin: boolean }>>(`/account/users/${encodeURIComponent(id)}/admin`, { method: 'PUT', body: { module, admin } })

/** One failed row of POST /account/users/bulk. */
export interface BarisGagalImpor {
  baris: number
  nama: string
  error: string
  takenBy: string
}

/** POST /account/users/bulk {users} → counts + the failed rows. */
export const imporMassal = (users: (SimpanUserBody & { _baris?: number })[]) =>
  useApi()<Envelope<{ sukses: number, gagal: number, baris: BarisGagalImpor[] }>>('/account/users/bulk', { method: 'POST', body: { users } })

/** PATCH /account/modules/{key} — relabel and/or switch a Modul off/on. */
export const ubahModul = (key: string, body: { label?: string | null, active?: boolean }) =>
  useApi()<unknown>(`/account/modules/${encodeURIComponent(key)}`, { method: 'PATCH', body })

// ---------------------------------------------------------------- write helper + guard

/**
 * Run an account write, reload the account reads, and toast the outcome —
 * the bdSimpan pattern without versions (account writes carry none, so
 * tanganiKonflik only ever passes through to the error toast).
 */
export async function simpanAkun<T>(aksi: () => Promise<T>, pesanSukses: string): Promise<boolean> {
  return tulisBerVersi(aksi, { sukses: pesanSukses, muatUlang: () => refreshNuxtData(['account-users', 'account-modules']) })
}

/** True when the user is a superadmin (holds the '*' admin). */
export const isSuperadmin = (me: Me | null): boolean => isAdminOf(me, '*')
