// The screens of the Finance module. The old Office had a launcher plus three
// independent panels with their own permission keys: omset/ (`kompas`), kas/
// (`finance`), brankas/ (`brankas`) — finance.md bagian B. In Vue they share
// ONE module card (`MODUL` access:['kompas','finance','brankas']), so each
// screen declares the key it needs via `boleh`, and keys are prefixed with the
// panel because the three old documents reused the same view keys.
import { hasAccess, type Me } from '~/composables/useMe'
import { getKk } from '~/composables/useFinance'

const omset = (me: Me) => hasAccess(me, ['kompas'])
/** Visible when the module key is held AND the page matrix allows at least view. */
const kasHal = (page: string) => (me: Me) =>
  hasAccess(me, ['finance']) && tingkatKas(me, page, useKasAksesSiap().value) >= PERM_VIEW

// ── The Kas Kecil page matrix (old `aksTingkat`, deploy/finance/kas/index.html:974-1110) ──
// The module key already gates entry; this matrix only NARROWS what a holder
// may reach. Stored rows are overrides of DEFAULT_PERMS; the module admin is
// always full and cannot be lowered (that is the way back from a bad setting).
const PERM_NONE = 0
const PERM_VIEW = 1
const PERM_EDIT = 2
const AKS_HAL_ISI = ['kk_input', 'kk_buku', 'kk_pos', 'bayar', 'rekap', 'bri', 'invoice', 'akses']
const ROLE_KEYS = ['staf', 'manajemen', 'viewer']
const ROLE_BAWAAN = 'staf'
const DEFAULT_PERMS: Record<string, Record<string, number>> = {
  kk_input: { staf: PERM_EDIT, manajemen: PERM_NONE, viewer: PERM_NONE },
  kk_buku: { staf: PERM_EDIT, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  kk_pos: { staf: PERM_EDIT, manajemen: PERM_NONE, viewer: PERM_NONE },
  bayar: { staf: PERM_EDIT, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  rekap: { staf: PERM_EDIT, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  dp: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_NONE },
  bri: { staf: PERM_EDIT, manajemen: PERM_EDIT, viewer: PERM_VIEW },
  invoice: { staf: PERM_EDIT, manajemen: PERM_VIEW, viewer: PERM_NONE },
  voidb: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  bulanan: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  analytics: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  marketing: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  event: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  kasir: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
  akses: { staf: PERM_VIEW, manajemen: PERM_VIEW, viewer: PERM_VIEW },
}

export const useKasAksesSiap = () => useState<{ matriks: Record<string, Record<string, number>>, peran: Record<string, string> } | null>('kas-akses', () => null)

/** Pages that HAVE input; outside this list "Ubah" is clamped to Lihat. */
export const AKS_HAL_ISI_KAS = AKS_HAL_ISI

/** Default level of one page for one role (before stored overrides). */
export const tingkatBawaanKas = (page: string, role: string): number =>
  DEFAULT_PERMS[page]?.[role] ?? PERM_VIEW

/** Load the matrix + roles once from the module chrome (`siapkan`). */
export function muatPeranKas() {
  const s = useKasAksesSiap()
  if (s.value) return
  getKk()
    .then((r) => {
      s.value = { matriks: r.data.akses ?? {}, peran: r.data.peran ?? {} }
    })
    .catch(() => {
      s.value = { matriks: {}, peran: {} }
    })
}

function roleSaya(me: Me | null, s: { peran: Record<string, string> } | null): string {
  if (!me) return ROLE_BAWAAN
  if (me.adminModules.includes('*') || me.adminModules.includes('finance')) return 'admin'
  const byId = me.id ? s?.peran[`#${me.id}`] : undefined
  const byName = me.name ? s?.peran[`@${String(me.name).trim().toLowerCase()}`] : undefined
  const r = byId ?? byName ?? ''
  return ROLE_KEYS.includes(r) ? r : ROLE_BAWAAN
}

/** Effective level of one page for this user (0 none, 1 view, 2 edit). */
export function tingkatKas(me: Me | null, page: string, s: { matriks: Record<string, Record<string, number>>, peran: Record<string, string> } | null): number {
  const role = roleSaya(me, s)
  if (role === 'admin') return AKS_HAL_ISI.includes(page) ? PERM_EDIT : PERM_VIEW
  const baris = s?.matriks?.[role]
  let t = baris && baris[page] !== undefined ? Number(baris[page]) : (DEFAULT_PERMS[page]?.[role] ?? PERM_VIEW)
  if (!Number.isFinite(t)) t = DEFAULT_PERMS[page]?.[role] ?? PERM_VIEW
  t = Math.max(PERM_NONE, Math.min(PERM_EDIT, t))
  if (!AKS_HAL_ISI.includes(page) && t > PERM_VIEW) t = PERM_VIEW
  if (role === 'viewer' && t > PERM_VIEW) t = PERM_VIEW
  return t
}

/** Per-page guard for the Kas Kecil screens. */
export function useKasIzin() {
  const me = useMe()
  const s = useKasAksesSiap()
  const tingkat = (page: string) => tingkatKas(me.value, page, s.value)
  return {
    tingkat,
    lihat: (page: string) => tingkat(page) >= PERM_VIEW,
    ubah: (page: string) => tingkat(page) >= PERM_EDIT,
  }
}

export const LAYAR_FINANCE: Layar[] = [
  // ── Omset (kunci kompas; bekas modul Kompas) ──
  { key: 'omset_input', label: 'Input Omset Harian', desc: 'Catat pendapatan, diskon, tax & service, dan trafik harian', icon: 'i-lucide-pencil-line', to: '/finance/omset/input', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_breakdown', label: 'Breakdown Sumber Omset', desc: 'Isi omset per kasir, lalu potong untuk event marketing, Reservasi VIP & event internal', icon: 'i-lucide-git-branch', to: '/finance/omset/breakdown', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_report', label: 'Report Daily', desc: 'Setoran per metode pembayaran: POS vs Actual', icon: 'i-lucide-clipboard-list', to: '/finance/omset/report', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_piutang', label: 'Piutang / Bon', desc: 'Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya', icon: 'i-lucide-receipt-text', to: '/finance/omset/piutang', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_compliment', label: 'Compliment', desc: 'Catatan compliment beserta alasan & PIC penanggungnya', icon: 'i-lucide-gift', to: '/finance/omset/compliment', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_akses', label: 'Kelola Akses Kru', desc: 'Siapa saja yang bisa membuka modul Kompas', icon: 'i-lucide-key-round', to: '/finance/omset/akses', grup: 'Panel Omset', boleh: omset },

  // ── Kas Kecil (kunci finance) ──
  { key: 'kas_kk_buku', label: 'Buku Kas Kecil', desc: 'Semua transaksi berikut saldo berjalan tiap pos', icon: 'i-lucide-book-open', to: '/finance/kas', grup: 'Kas Kecil', boleh: kasHal('kk_buku') },
  { key: 'kas_kk_input', label: 'Input Transaksi Kas Kecil', desc: 'Satu baris = satu transaksi; tambah baris sebanyak yang perlu lalu simpan sekaligus', icon: 'i-lucide-pencil-line', to: '/finance/kas/input', grup: 'Kas Kecil', boleh: kasHal('kk_input') },
  { key: 'kas_kk_pos', label: 'Pos & Kategori', desc: 'Daftar pos pembayaran dan kategori belanja', icon: 'i-lucide-tags', to: '/finance/kas/pos', grup: 'Kas Kecil', boleh: kasHal('kk_pos') },
  { key: 'kas_bayar', label: 'Planning Pembayaran', desc: 'Lembar transfer mingguan per rekening pembayar', icon: 'i-lucide-calendar-clock', to: '/finance/kas/bayar', grup: 'Kas Kecil', boleh: kasHal('bayar') },
  { key: 'kas_rekap', label: 'Rekap Penjualan', desc: 'Cocokkan POS dengan setoran bank — angka penjualannya after tax & service', icon: 'i-lucide-clipboard-check', to: '/finance/kas/rekap', grup: 'Kas Kecil', boleh: kasHal('rekap') },
  { key: 'kas_dp', label: 'Dana Masuk (DP)', desc: 'DP reservasi yang sudah masuk — halaman milik modul Reservasi', icon: 'i-lucide-wallet', to: '/finance/kas/dp', grup: 'Kas Kecil', boleh: kasHal('dp') },
  { key: 'kas_bri', label: 'Pencocokan QRIS BRI', desc: 'Mutasi masuk rekening BRI dicocokkan ke DP reservasi', icon: 'i-lucide-scan-line', to: '/finance/kas/bri', grup: 'Kas Kecil', boleh: kasHal('bri') },
  { key: 'kas_invoice', label: 'Invoice & Kwitansi', desc: 'Permintaan kwitansi dari Reservasi — periksa dana masuknya, lalu terbitkan', icon: 'i-lucide-file-text', to: '/finance/kas/invoice', grup: 'Kas Kecil', boleh: kasHal('invoice') },
  { key: 'kas_void', label: 'Laporan Void', desc: 'Menu yang di-void berikut kronologinya — dicatat kasir di modul Cashier', icon: 'i-lucide-ban', to: '/finance/kas/void', grup: 'Kas Kecil', boleh: kasHal('voidb') },
  { key: 'kas_bulanan', label: 'Dashboard Omset', desc: 'Pencapaian target bulan berjalan', icon: 'i-lucide-calendar-range', to: '/finance/kas/bulanan', grup: 'Kas Kecil', boleh: kasHal('bulanan') },
  { key: 'kas_analytics', label: 'Dashboard Analytics', desc: 'Komposisi & sumber pendapatan', icon: 'i-lucide-pie-chart', to: '/finance/kas/analytics', grup: 'Kas Kecil', boleh: kasHal('analytics') },
  { key: 'kas_marketing', label: 'Performa Marketing', desc: 'Kontribusi omset per marketing', icon: 'i-lucide-megaphone', to: '/finance/kas/marketing', grup: 'Kas Kecil', boleh: kasHal('marketing') },
  { key: 'kas_event', label: 'Performa Event', desc: 'Kontribusi omset per PIC event', icon: 'i-lucide-party-popper', to: '/finance/kas/event', grup: 'Kas Kecil', boleh: kasHal('event') },
  { key: 'kas_kasir', label: 'Performa Kasir', desc: 'Omset yang diakui tiap kasir — angka final', icon: 'i-lucide-chart-column', to: '/finance/kas/kasir', grup: 'Kas Kecil', boleh: kasHal('kasir') },
  { key: 'kas_akses', label: 'Kelola Kru', desc: 'Siapa saja yang bisa membuka modul Finance', icon: 'i-lucide-key-round', to: '/finance/kas/akses', grup: 'Kas Kecil', boleh: kasHal('akses') },
]

/** The line under the user's name in the module chrome. */
export function peranFinance(me: Me | null): string {
  if (!me) return ''
  const p: string[] = []
  if (me.adminModules.includes('*') || me.adminModules.includes('finance') || me.adminModules.includes('kompas') || me.adminModules.includes('brankas')) p.push('Admin modul')
  if (hasAccess(me, ['kompas'])) p.push('Panel Omset')
  if (hasAccess(me, ['finance'])) p.push('Kas Kecil')
  if (hasAccess(me, ['brankas'])) p.push('Brankas')
  return p.join(' · ') || 'Kru'
}
