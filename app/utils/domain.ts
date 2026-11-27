// investor.laksamanamuda.id (owner, Nov 2026): the same app, but on that host it
// is Investor Compass only — "/" and every other module land on /investor, and
// the "Beranda Office" links are hidden. teamv1 keeps the whole Office.
// Locally, `?domain=investor` (remembered for the tab) simulates the host.

const HAL_UMUM = ['/login', '/ganti-pin', '/profil']

export function diDomainInvestor(): boolean {
  if (!import.meta.client) return false
  if (location.hostname.startsWith('investor.')) return true
  try {
    const q = new URLSearchParams(location.search).get('domain')
    if (q === 'investor') sessionStorage.setItem('lm-domain', 'investor')
    if (q === 'office') sessionStorage.removeItem('lm-domain')
    return sessionStorage.getItem('lm-domain') === 'investor'
  }
  catch {
    return false
  }
}

/** On the investor host: where a path outside Investor Compass must go instead, or null. */
export function arahDomainInvestor(path: string): string | null {
  if (!diDomainInvestor()) return null
  if (path === '/investor' || path.startsWith('/investor/') || HAL_UMUM.includes(path)) return null
  return '/investor'
}

/** Built-in modules every account holds (laksamana-api OfficeAccess::builtinModules) plus Help. */
const BAWAAN = ['radar', 'hris', 'help', 'jadwal', 'dw']

/**
 * A pure investor: Investor Compass is the only module besides the built-ins
 * (owner, 28 Nov 2026). Such an account uses investor.laksamanamuda.id only —
 * no Team Office — and gets no Radar-based calendar.
 */
export function hanyaInvestor(me: { modules?: string[] } | null | undefined): boolean {
  const m = me?.modules ?? []
  return m.includes('investor') && m.every(k => k === 'investor' || BAWAAN.includes(k))
}

export const URL_INVESTOR = 'https://investor.laksamanamuda.id'
