// The screens of the Finance module. The old Office had a launcher plus three
// independent panels with their own permission keys: omset/ (`kompas`), kas/
// (`finance`), brankas/ (`brankas`) — finance.md bagian B. In Vue they share
// ONE module card (`MODUL` access:['kompas','finance','brankas']), so each
// screen declares the key it needs via `boleh`, and keys are prefixed with the
// panel because the three old documents reused the same view keys.
import { hasAccess, type Me } from '~/composables/useMe'

const omset = (me: Me) => hasAccess(me, ['kompas'])
const kas = (me: Me) => hasAccess(me, ['finance'])

export const LAYAR_FINANCE: Layar[] = [
  // ── Omset (kunci kompas; bekas modul Kompas) ──
  { key: 'omset_input', label: 'Input Omset Harian', desc: 'Catat pendapatan, diskon, tax & service, dan trafik harian', icon: 'i-lucide-pencil-line', to: '/finance/omset/input', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_breakdown', label: 'Breakdown Sumber Omset', desc: 'Isi omset per kasir, lalu potong untuk event marketing, Reservasi VIP & event internal', icon: 'i-lucide-git-branch', to: '/finance/omset/breakdown', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_report', label: 'Report Daily', desc: 'Setoran per metode pembayaran: POS vs Actual', icon: 'i-lucide-clipboard-list', to: '/finance/omset/report', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_piutang', label: 'Piutang / Bon', desc: 'Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya', icon: 'i-lucide-receipt-text', to: '/finance/omset/piutang', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_compliment', label: 'Compliment', desc: 'Catatan compliment beserta alasan & PIC penanggungnya', icon: 'i-lucide-gift', to: '/finance/omset/compliment', grup: 'Panel Omset', boleh: omset },
  { key: 'omset_akses', label: 'Kelola Akses Kru', desc: 'Siapa saja yang bisa membuka modul Kompas', icon: 'i-lucide-key-round', to: '/finance/omset/akses', grup: 'Panel Omset', boleh: omset },

  // ── Kas Kecil (kunci finance) ──
  { key: 'kas_kk_buku', label: 'Buku Kas Kecil', desc: 'Semua transaksi berikut saldo berjalan tiap pos', icon: 'i-lucide-book-open', to: '/finance/kas', grup: 'Kas Kecil', boleh: kas },
  { key: 'kas_kk_input', label: 'Input Transaksi Kas Kecil', desc: 'Satu baris = satu transaksi; tambah baris sebanyak yang perlu lalu simpan sekaligus', icon: 'i-lucide-pencil-line', to: '/finance/kas/input', grup: 'Kas Kecil', boleh: kas },
  { key: 'kas_kk_pos', label: 'Pos & Kategori', desc: 'Daftar pos pembayaran dan kategori belanja', icon: 'i-lucide-tags', to: '/finance/kas/pos', grup: 'Kas Kecil', boleh: kas },
  { key: 'kas_dp', label: 'Dana Masuk (DP)', desc: 'DP reservasi yang sudah masuk — halaman milik modul Reservasi', icon: 'i-lucide-wallet', to: '/finance/kas/dp', grup: 'Kas Kecil', boleh: kas },
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
