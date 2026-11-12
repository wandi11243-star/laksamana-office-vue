/**
 * Colour classes for a product category tag (DESIGN.md › Label kategori).
 * The same name always gets the same hue, from six `kat-*` tokens that never
 * overlap the status colours. Empty / "Lainnya" stays neutral.
 */
const PALET = [
  'bg-kat-1/12 text-kat-1',
  'bg-kat-2/12 text-kat-2',
  'bg-kat-3/12 text-kat-3',
  'bg-kat-4/12 text-kat-4',
  'bg-kat-5/12 text-kat-5',
  'bg-kat-6/12 text-kat-6',
] as const

export function warnaKategori(nama?: string | null): string {
  const n = (nama || '').trim().toLowerCase()
  if (!n || n === 'lainnya') return 'bg-muted text-muted'
  let h = 0
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALET[h % PALET.length]!
}
