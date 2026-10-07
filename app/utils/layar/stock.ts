// The screens of the Stock module. One backend serves five panels with their
// own keys: ordering/, purchasing/, tree/, usage/, hpp/ — stock.md bagian B.
// In Vue they share ONE module card (`MODUL` access: all five keys), so each
// screen declares the panel key it needs via `boleh`. Panel entries land here
// as their branches do; unbuilt panels stay out (their launcher card reads
// "Segera" instead of linking nowhere).
import { hasAccess, type Me } from '~/composables/useMe'

const panel = (kunci: string) => (me: Me) => hasAccess(me, [kunci])

export const LAYAR_STOCK: Layar[] = [
  // ── Pohon Resep (kunci tree; read-only, tanpa role internal) ──
  { key: 'tree_pohon', label: 'Pohon Resep', desc: 'Rincian tiap menu sampai bahan mentah', icon: 'i-lucide-tree-deciduous', to: '/stock/tree', grup: 'Pohon Resep', boleh: panel('tree') },
]

/** The line under the user's name in the module chrome. */
export function peranStock(me: Me | null): string {
  if (!me) return ''
  const p: string[] = []
  if (hasAccess(me, ['ordering'])) p.push('Ordering')
  if (hasAccess(me, ['purchasing'])) p.push('Purchasing')
  if (hasAccess(me, ['tree'])) p.push('Pohon Resep')
  if (hasAccess(me, ['usage'])) p.push('Pemakaian')
  if (hasAccess(me, ['hpp'])) p.push('HPP')
  return p.join(' · ') || 'Kru'
}
