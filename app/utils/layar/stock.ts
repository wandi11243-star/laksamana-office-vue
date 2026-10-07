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

  // ── Pemakaian Bahan Baku (kunci usage; K-07: usage-only boleh masuk) ──
  { key: 'opname', label: 'Daily SO', desc: 'Buku stok harian: awal + masuk − keluar, lalu stok fisik', icon: 'i-lucide-clipboard-check', to: '/stock/usage/opname', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
  { key: 'pemakaian', label: 'Pemakaian Bahan', desc: 'Bahan untuk prasmanan, training & RND', icon: 'i-lucide-utensils', to: '/stock/usage/pemakaian', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
  { key: 'waste', label: 'Waste Produk', desc: 'Produk & bahan terbuang beserta sebabnya', icon: 'i-lucide-trash-2', to: '/stock/usage/waste', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
  { key: 'serah', label: 'Serah Terima', desc: 'Stok keluar ke Kitchen/Bar, wajib berfoto', icon: 'i-lucide-handshake', to: '/stock/usage/serah', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
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
