// Akademi constants — the fixed vocabularies of the module, unchanged from the
// old Office client so a screen built for one maps 1:1 to the other.
//
// Source: laksamana-office/deploy/akademi/index.html:301-323 (DEFAULT_DIVISIONS,
// TYPES, CATS), :600-608 (peran), :1601 (DIV_IC_CHOICES).
import type { DivisiAkademi, PeranAkademi, TipeMateri } from '~/composables/useAkademi'

/** The five material types, in the old chip order (`:310-316`). */
export const TIPE_MATERI: TipeMateri[] = ['video', 'modul', 'sop', 'menu', 'quiz']

export const LABEL_TIPE: Record<TipeMateri, string> = {
  video: 'Video',
  modul: 'Modul',
  sop: 'SOP',
  menu: 'Menu Baru',
  quiz: 'Kuis',
}

/** Material categories (`:317-323`). */
export const KATEGORI_MATERI: { id: string, name: string }[] = [
  { id: 'onboarding', name: 'Onboarding' },
  { id: 'sop', name: 'SOP & Standar' },
  { id: 'menu', name: 'Product Knowledge' },
  { id: 'skill', name: 'Skill & Service' },
  { id: 'brand', name: 'Brand & Culture' },
]

/** A material's category label, or the raw id when it is not in the list. */
export const namaKategori = (id: string) => KATEGORI_MATERI.find(c => c.id === id)?.name ?? id

/** The default divisions a fresh database is seeded with (`:301-308`). */
export const DIVISI_DEFAULT: DivisiAkademi[] = [
  { id: 'service', name: 'Service / FOH', ic: 'bell' },
  { id: 'kitchen', name: 'Galangan Dapur', ic: 'chef' },
  { id: 'bar', name: 'Galangan Bar', ic: 'cup' },
  { id: 'marketing', name: 'Marketing & Digital', ic: 'megaphone' },
  { id: 'sales', name: 'Sales & Event', ic: 'handshake' },
  { id: 'finance', name: 'Finance & Admin', ic: 'chart' },
]

/**
 * The icon choices of the division form (`:1601`), as the old SVG keys. They are
 * mapped to Lucide here — no emoji reaches the UI (DESIGN.md rule 2).
 */
export const IKON_DIVISI: string[] = ['bell', 'chef', 'cup', 'megaphone', 'handshake', 'chart', 'compass', 'anchor', 'users', 'folder', 'globe', 'dot']

/** Old SVG key -> Lucide icon name. */
const LUCIDE_DIVISI: Record<string, string> = {
  bell: 'i-lucide-bell',
  chef: 'i-lucide-chef-hat',
  cup: 'i-lucide-coffee',
  megaphone: 'i-lucide-megaphone',
  handshake: 'i-lucide-handshake',
  chart: 'i-lucide-chart-column',
  compass: 'i-lucide-compass',
  anchor: 'i-lucide-anchor',
  users: 'i-lucide-users',
  folder: 'i-lucide-folder',
  globe: 'i-lucide-globe',
  dot: 'i-lucide-circle',
}

/** The legacy fallback map when a division row has no `ic` (`:328`). */
const DIV_IC_LEGACY: Record<string, string> = {
  service: 'bell', kitchen: 'chef', bar: 'cup', marketing: 'megaphone', sales: 'handshake', finance: 'chart',
}

/** Resolve the Lucide icon of a division id, from the loaded division list. */
export function ikonDivisi(divisions: DivisiAkademi[], id: string): string {
  if (id === 'all') return LUCIDE_DIVISI.globe!
  const d = divisions.find(x => x.id === id)
  const kunci = (d?.ic && LUCIDE_DIVISI[d.ic]) ? d.ic : DIV_IC_LEGACY[id]
  return LUCIDE_DIVISI[kunci ?? 'dot'] ?? LUCIDE_DIVISI.dot!
}

/** Lucide icon of one of the form's icon keys. */
export const ikonDariKunci = (kunci: string) => LUCIDE_DIVISI[kunci] ?? LUCIDE_DIVISI.dot!

export const PERAN_AKADEMI: PeranAkademi[] = ['staff', 'manager', 'admin']

/** Short labels as the old Kelola Kru pill (`:1377`). */
export const LABEL_PERAN: Record<PeranAkademi, string> = {
  admin: 'Nahkoda',
  manager: 'PIC Divisi',
  staff: 'Kru',
}

/** Long labels as the old peran `<select>` (`:1392-1394`). */
export const LABEL_PERAN_PANJANG: Record<PeranAkademi, string> = {
  staff: 'Kru',
  manager: 'PIC Divisi (lihat progress tim)',
  admin: 'Nahkoda / Admin (akses penuh)',
}

/** Quiz passing score when a material has none (`DB.settings.passingDefault`). */
export const PASSING_DEFAULT = 80
