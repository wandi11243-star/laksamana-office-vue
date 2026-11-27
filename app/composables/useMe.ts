/** GET /api/v1/me. `modules` is the server's truth for what this user may open. */
export interface Me {
  id: string
  name: string
  username: string
  keterangan: string
  modules: string[]
  adminModules: string[]
  headDivisi: string[]
  /** Beranda teams from the Tim column (laksamana-api AppSupportTim); several per person. */
  tim?: { key: string, label: string }[]
  /** Contact info from GET /me; absent on older backends. */
  email?: string
  noHp?: string
  ulid: string
  /** The PIN was set by someone else (new account, admin reset): /ganti-pin first. */
  harusGantiPin?: boolean
}

export const useMe = () => useState<Me | null>('me', () => null)

export async function fetchMe(): Promise<Me> {
  const { data } = await useApi()<Envelope<Me>>('/me')
  useMe().value = data
  return data
}

export async function login(login: string, pin: string): Promise<void> {
  const { data } = await useApi()<Envelope<{ token: string, user: Me }>>('/auth/login', {
    method: 'POST',
    body: { login, pin, device: 'office-vue' },
  })
  // Module states are kept between screens (cacheSegar); never show the
  // previous account's copy to the one signing in now.
  clearNuxtData()
  useToken().value = data.token
  await fetchMe()
}

export async function logout(): Promise<void> {
  try {
    await useApi()('/auth/logout', { method: 'POST' })
  }
  finally {
    useToken().value = null
    useMe().value = null
    clearNuxtData()
    siarkanTab('auth-logout')
    await navigateTo('/login')
  }
}

/** True when the user holds any of the access keys (a menu entry opens for any of them). */
export function hasAccess(me: Me | null, keys: string[]): boolean {
  return !!me && keys.some(k => me.modules.includes(k))
}

export const isAdminOf = (me: Me | null, key: string): boolean =>
  !!me && (me.adminModules.includes(key) || me.adminModules.includes('*'))

/** One `GET /me/badges` (api#311): `{modul: {layar: n}}` for the Beranda
 *  "Perlu tindakan" list, so it no longer opens 8–15 full states for a few
 *  numbers. Refreshed on every Beranda visit (tiny answer); module screens
 *  keep reading their own state.
 */
export type Badges = Record<string, Record<string, number>>
export const useBadges = () =>
  useAsyncData('me-badges', () => useApi()<Envelope<Badges>>('/me/badges').then(r => r.data ?? {}), {
    dedupe: 'defer',
    default: () => ({}) as Badges,
  })
export const refreshBadges = () => refreshNuxtData('me-badges')
