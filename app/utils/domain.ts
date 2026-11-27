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
