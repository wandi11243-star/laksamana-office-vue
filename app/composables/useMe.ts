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
    await navigateTo('/login')
  }
}

/** True when the user holds any of the access keys (a menu entry opens for any of them). */
export function hasAccess(me: Me | null, keys: string[]): boolean {
  return !!me && keys.some(k => me.modules.includes(k))
}

export const isAdminOf = (me: Me | null, key: string): boolean =>
  !!me && (me.adminModules.includes(key) || me.adminModules.includes('*'))
