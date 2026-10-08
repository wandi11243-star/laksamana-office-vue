// The 18 screens of Analytics + its page × role matrix.
// Old: NAV groups Analisa/Data/Sistem (deploy/analytics/index.html:698-724),
// TITLES (index.html:1407-1429), PERM_* + role matrix (index.html:959-1036).
//
// The matrix only NARROWS what a module-key holder may reach: before it
// loads, everyone reads as role staf (the old "full access first" behaviour).
// Stored rows are overrides of DEFAULT_PERMS; the module admin is always full
// and cannot be lowered. Non-input pages clamp "Ubah" to "Lihat"; viewer
// never exceeds "Lihat".
import { hasAccess, isAdminOf, type Me } from '~/composables/useMe'
import { getAnalytics } from '~/composables/useAnalytics'
import type { Layar } from '~/utils/layar'

const PERM_NONE = 0
const PERM_VIEW = 1
const PERM_EDIT = 2
/** Pages that HAVE input. Outside this list "Ubah" means nothing. */
const AKS_HAL_ISI = ['unggah', 'pengaturan', 'akses']
const ROLE_KEYS = ['staf', 'manajemen', 'viewer']
const ROLE_BAWAAN = 'staf'
export const ROLE_LABEL_ANALYTICS: Record<string, string> = {
  staf: 'Staf',
  manajemen: 'Manajemen',
  viewer: 'View Only',
  admin: 'Admin Modul',
}
const DEFAULT_PERMS: Record<string, Record<string, number>> = {
  ringkasan: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  hari: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  menu: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  kategori: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  kunjungan: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  meja: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  talent: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  error: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  voidb: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  promo: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  tren: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  event: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  marketing: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  konten: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  desain: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  unggah: { staf: PERM_EDIT, manajemen: PERM_VIEW, viewer: PERM_NONE },
  pengaturan: { staf: PERM_EDIT, manajemen: PERM_NONE, viewer: PERM_NONE },
  akses: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
}

export interface MatriksAnalytics {
  matriks: Record<string, Record<string, number>>
  peran: Record<string, string>
}

export const useAnalyticsAksesSiap = () => useState<MatriksAnalytics | null>('analytics-akses', () => null)

/** Pages that HAVE input; outside this list "Ubah" is clamped to Lihat. */
export const AKS_HAL_ISI_ANALYTICS = AKS_HAL_ISI

/** Default level of one page for one role (before stored overrides). */
export const tingkatBawaanAnalytics = (page: string, role: string): number => {
  const b = DEFAULT_PERMS[page]
  if (!b) return AKS_HAL_ISI.includes(page) ? PERM_EDIT : PERM_VIEW
  return b[role] ?? PERM_VIEW
}

/** Load the matrix + roles once from the module chrome (`siapkan`). */
export function muatMatriksAnalytics() {
  const s = useAnalyticsAksesSiap()
  if (s.value) return
  getAnalytics()
    .then((r) => {
      s.value = { matriks: r.data.akses ?? {}, peran: r.data.peran ?? {} }
    })
    .catch(() => {
      s.value = { matriks: {}, peran: {} }
    })
}

function roleSaya(me: Me | null, s: MatriksAnalytics | null): string {
  if (!me) return ROLE_BAWAAN
  if (isAdminOf(me, 'analytics')) return 'admin'
  const byId = me.id ? s?.peran[`#${me.id}`] : undefined
  const byName = me.name ? s?.peran[`@${String(me.name).trim().toLowerCase()}`] : undefined
  const r = byId ?? byName ?? ''
  return ROLE_KEYS.includes(r) ? r : ROLE_BAWAAN
}

/** Effective level of one page for this user (0 none, 1 view, 2 edit). */
export function tingkatAnalytics(me: Me | null, page: string, s: MatriksAnalytics | null): number {
  const role = roleSaya(me, s)
  if (role === 'admin') return AKS_HAL_ISI.includes(page) ? PERM_EDIT : PERM_VIEW
  const baris = s?.matriks?.[role]
  let t = baris && baris[page] !== undefined ? Number(baris[page]) : tingkatBawaanAnalytics(page, role)
  if (!Number.isFinite(t)) t = tingkatBawaanAnalytics(page, role)
  t = Math.max(PERM_NONE, Math.min(PERM_EDIT, t))
  if (!AKS_HAL_ISI.includes(page) && t > PERM_VIEW) t = PERM_VIEW
  if (role === 'viewer' && t > PERM_VIEW) t = PERM_VIEW
  return t
}

/** Per-page guard for the Analytics screens. L2/L3 pages use this. */
export function useAnalyticsIzin() {
  const me = useMe()
  const s = useAnalyticsAksesSiap()
  const tingkat = (page: string) => tingkatAnalytics(me.value, page, s.value)
  return {
    tingkat,
    role: computed(() => roleSaya(me.value, s.value)),
    lihat: (page: string) => tingkat(page) >= PERM_VIEW,
    ubah: (page: string) => tingkat(page) >= PERM_EDIT,
  }
}

/** Visible when the module key is held AND the page matrix allows at least view. */
const anHal = (page: string) => (me: Me) =>
  hasAccess(me, ['analytics']) && tingkatAnalytics(me, page, useAnalyticsAksesSiap().value) >= PERM_VIEW

export const LAYAR_ANALYTICS: Layar[] = [
  { key: 'ringkasan', label: 'Ringkasan', desc: 'Angka pokok dari laporan POS yang diunggah', icon: 'i-lucide-chart-line', to: '/analytics/ringkasan', grup: 'Analisa', boleh: anHal('ringkasan') },
  { key: 'tren', label: 'Tren Bulanan', desc: 'Total omset bulan ke bulan, dan perbandingan dua bulan', icon: 'i-lucide-chart-column', to: '/analytics/tren', grup: 'Analisa', boleh: anHal('tren') },
  { key: 'hari', label: 'Hari & Jam', desc: 'Omset per hari dalam seminggu, dan sebaran jamnya', icon: 'i-lucide-calendar-days', to: '/analytics/hari', grup: 'Analisa', boleh: anHal('hari') },
  { key: 'menu', label: 'Menu & Bahan Baku', desc: 'Menu terlaris dan perkiraan bahan yang seharusnya keluar', icon: 'i-lucide-list', to: '/analytics/menu', grup: 'Analisa', boleh: anHal('menu') },
  { key: 'kategori', label: 'Kategori Menu', desc: 'Omset per kategori menu — termasuk EVENT, terpisah dari peringkat menu', icon: 'i-lucide-layout-grid', to: '/analytics/kategori', grup: 'Analisa', boleh: anHal('kategori') },
  { key: 'kunjungan', label: 'Metode Kunjungan', desc: 'Rekap kanal, cara tamu datang, dan cara mereka membayar', icon: 'i-lucide-log-in', to: '/analytics/kunjungan', grup: 'Analisa', boleh: anHal('kunjungan') },
  { key: 'meja', label: 'Performa Meja', desc: 'Omset tiap meja, kapasitasnya di denah Reservasi, dan omset per kursinya', icon: 'i-lucide-armchair', to: '/analytics/meja', grup: 'Analisa', boleh: anHal('meja') },
  { key: 'talent', label: 'Performa Talent', desc: 'Kontribusi omset tiap penampil, dihitung dari jam tampilnya sendiri', icon: 'i-lucide-music', to: '/analytics/talent', grup: 'Analisa', boleh: anHal('talent') },
  { key: 'error', label: 'Error & Koreksi', desc: 'Bill yang ditandai error — sebabnya, nilainya, dan siapa yang memegangnya', icon: 'i-lucide-triangle-alert', to: '/analytics/error', grup: 'Analisa', boleh: anHal('error') },
  { key: 'voidb', label: 'Void & Cancel', desc: 'Siapa yang membatalkan, alasannya, itemnya, nilainya, dan jamnya', icon: 'i-lucide-ban', to: '/analytics/voidb', grup: 'Analisa', boleh: anHal('voidb') },
  { key: 'promo', label: 'Promo & Klaim', desc: 'Promo mana yang paling banyak diklaim, barang apa, dan jam berapa', icon: 'i-lucide-badge-percent', to: '/analytics/promo', grup: 'Analisa', boleh: anHal('promo') },
  { key: 'event', label: 'Pengaruh Event', desc: 'Omset hari berevent dibanding hari biasa', icon: 'i-lucide-star', to: '/analytics/event', grup: 'Analisa', boleh: anHal('event') },
  { key: 'marketing', label: 'Pengaruh Marketing', desc: 'Omset hari ada acara Marketing dibanding hari biasa', icon: 'i-lucide-send', to: '/analytics/marketing', grup: 'Analisa', boleh: anHal('marketing') },
  { key: 'konten', label: 'Performa Konten', desc: 'Reach, Engagement Rate, Virality Index, CTA Click Rate & Content Pillar — semua platform', icon: 'i-lucide-trending-up', to: '/analytics/konten', grup: 'Analisa', boleh: anHal('konten') },
  { key: 'desain', label: 'Performa Desain', desc: 'Virality konten berdesain, dan jumlah desain selesai per kategori', icon: 'i-lucide-palette', to: '/analytics/desain', grup: 'Analisa', boleh: anHal('desain') },
  { key: 'unggah', label: 'Unggah Laporan', desc: 'Berkas Sales Recapitulation dari POS', icon: 'i-lucide-upload', to: '/analytics/unggah', grup: 'Data', boleh: anHal('unggah') },
  { key: 'pengaturan', label: 'Pengaturan', desc: 'Batas jam shift dan pemetaan nama menu', icon: 'i-lucide-settings', to: '/analytics/pengaturan', grup: 'Sistem', boleh: anHal('pengaturan') },
  { key: 'akses', label: 'Kelola Akses', desc: 'Siapa boleh membuka dan mengubah halaman mana', icon: 'i-lucide-key-round', to: '/analytics/akses', grup: 'Sistem', boleh: anHal('akses') },
]

/** The line under the user's name in the module chrome. */
export function peranAnalyticsLabel(me: Me | null): string {
  if (!me) return ''
  if (isAdminOf(me, 'analytics')) return 'Admin modul'
  return ROLE_LABEL_ANALYTICS[roleSaya(me, useAnalyticsAksesSiap().value)] ?? 'Kru'
}
