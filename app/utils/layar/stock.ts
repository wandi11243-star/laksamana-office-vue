// The screens of the Stock module. One backend serves six panels with their
// own keys: ordering/, purchasing/, tree/, usage/, hpp/, breakloss/ — stock.md bagian B.
// In Vue they share ONE module card (`MODUL` access: all five keys), so each
// screen declares the panel key it needs via `boleh`. Panel entries land here
// as their branches do; unbuilt panels stay out (their launcher card reads
// "Segera" instead of linking nowhere).
import { hasAccess, isAdminOf, type Me } from '~/composables/useMe'
import { LABEL_PERAN_ORDERING, izinHalaman, usePeranStock, type IzinHalaman } from '~/composables/useStock'

const panel = (kunci: string) => (me: Me) => hasAccess(me, [kunci])

// Ordering: admin tabs (users) are module-admin only. The daily screens follow
// the caller's own role from `GET /stock/me` (old ORD_PERM_DEFAULT: "Check-in
// saja" sees no Form Order / Central Kitchen, only views Gudang Bar). Until the
// role is known the old `full` menu shows; the server guards the writes.
const bolehOrdering = (adminSaja: boolean, halaman?: string) => (me: Me) => {
  if (!hasAccess(me, ['ordering'])) return false
  if (adminSaja) return isAdminOf(me, 'ordering')
  return !halaman || isAdminOf(me, 'ordering') || izinHalaman('ordering', halaman, 2) >= 1
}

// Purchasing permission matrix, ported from PERM_DEFAULT
// (`deploy/stock/purchasing/index.html:1650-1663`). The crew table is
// admin-only to read, so non-admin holders are shown the `full` row:
// dashboard/jemput/ck/database editable, overview view-only, online and the
// admin tabs hidden. `admin` always edits everything (old `:1667`).
type IzinLayar = 'edit' | 'lihat' | 'tak'
const PERM_DEFAULT_PURCHASING: Record<string, IzinLayar> = {
  dashboard: 'edit',
  jemput: 'edit',
  // `online` has NO entry in the old PERM_DEFAULT, so non-admins never see
  // it (T-16: admin-only, as the old page behaves).
  online: 'tak',
  ck: 'edit',
  overview: 'lihat',
  database: 'edit',
}

const bolehPurchasing = (layar: string, butuh: 'lihat' | 'ubah') => (me: Me) => {
  if (isAdminOf(me, 'purchasing')) return true
  if (!hasAccess(me, ['purchasing'])) return false
  // The caller's own role (`full` / `view`) once /stock/me answered; the old
  // `full` row until then. `online` stays admin-only (no PERM_DEFAULT entry).
  const awal = { edit: 2, lihat: 1, tak: 0 }[PERM_DEFAULT_PURCHASING[layar] ?? 'tak'] as IzinHalaman
  const izin = layar === 'online' ? 0 : izinHalaman('purchasing', layar, awal)
  return butuh === 'lihat' ? izin >= 1 : izin >= 2
}

const adminPurchasing = (me: Me) => isAdminOf(me, 'purchasing')

export const LAYAR_STOCK: Layar[] = [
  // ── Ordering (kunci ordering) ──
  { key: 'ordering_order', label: 'Form Order Belanja', desc: 'Pengajuan order barang baru', icon: 'i-lucide-shopping-cart', to: '/stock/ordering/order', grup: 'Ordering', boleh: bolehOrdering(false, 'order') },
  { key: 'ordering_acc', label: 'Approval Order', desc: 'Order belanja anggota disetujui head divisinya', icon: 'i-lucide-user-check', to: '/stock/ordering/acc', grup: 'Ordering', boleh: bolehOrdering(false) },
  { key: 'ordering_ck', label: 'Central Kitchen', desc: 'Pengajuan ke Central Kitchen', icon: 'i-lucide-chef-hat', to: '/stock/ordering/ck', grup: 'Ordering', boleh: bolehOrdering(false, 'ck') },
  { key: 'ordering_gb', label: 'Gudang Bar', desc: 'Stok Gudang Bar — diminta tim bar', icon: 'i-lucide-wine', to: '/stock/ordering/gb', grup: 'Ordering', boleh: bolehOrdering(false, 'gb') },
  { key: 'ordering_checkin', label: 'Check-in Penerimaan', desc: 'Tandai barang yang datang per nomor PO', icon: 'i-lucide-package-check', to: '/stock/ordering/checkin', grup: 'Ordering', boleh: bolehOrdering(false, 'checkin') },
  { key: 'ordering_users', label: 'Kelola Akses Ordering', desc: 'Kru dapur & perannya', icon: 'i-lucide-users', to: '/stock/ordering/users', grup: 'Ordering', boleh: bolehOrdering(true) },

  // ── Purchasing (kunci purchasing, matriks PERM_DEFAULT lama) ──
  { key: 'purchasing_dashboard', label: 'Monitor Order', desc: 'Antrean pesanan bahan baku', icon: 'i-lucide-clipboard-list', to: '/stock/purchasing/dashboard', grup: 'Purchasing', boleh: bolehPurchasing('dashboard', 'lihat') },
  { key: 'purchasing_jemput', label: 'Jemput Hari Ini', desc: 'Barang yang dijemput sendiri', icon: 'i-lucide-car', to: '/stock/purchasing/jemput', grup: 'Purchasing', boleh: bolehPurchasing('jemput', 'lihat') },
  { key: 'purchasing_online', label: 'Barang Online', desc: 'Pesanan daring & penerimaannya', icon: 'i-lucide-globe', to: '/stock/purchasing/online', grup: 'Purchasing', boleh: bolehPurchasing('online', 'lihat') },
  { key: 'purchasing_ck', label: 'CK Purchasing', desc: 'Stok, mutasi & dashboard Central Kitchen', icon: 'i-lucide-warehouse', to: '/stock/purchasing/ck', grup: 'Purchasing', boleh: bolehPurchasing('ck', 'lihat') },
  { key: 'purchasing_overview', label: 'Rekap Per Bulan', desc: 'Rekap & analitik order bulanan', icon: 'i-lucide-bar-chart-3', to: '/stock/purchasing/overview', grup: 'Purchasing', boleh: bolehPurchasing('overview', 'lihat') },
  { key: 'purchasing_database', label: 'Database & Vendor', desc: 'Kontak vendor & aturan distribusi bahan', icon: 'i-lucide-database', to: '/stock/purchasing/database', grup: 'Purchasing', boleh: bolehPurchasing('database', 'lihat') },
  { key: 'purchasing_users', label: 'Kelola Akses Purchasing', desc: 'Matriks izin & kru purchasing', icon: 'i-lucide-users', to: '/stock/purchasing/users', grup: 'Purchasing', boleh: adminPurchasing },
  { key: 'purchasing_log', label: 'Log Aktivitas', desc: 'Siapa mengubah apa di stock', icon: 'i-lucide-scroll-text', to: '/stock/purchasing/log', grup: 'Purchasing', boleh: adminPurchasing },

  // ── Pemakaian Bahan Baku (kunci usage; K-07: usage-only boleh masuk) ──
  { key: 'opname', label: 'Daily SO', desc: 'Buku stok harian: awal + masuk − keluar, lalu stok fisik', icon: 'i-lucide-clipboard-check', to: '/stock/usage/opname', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
  { key: 'pemakaian', label: 'Pemakaian Bahan', desc: 'Bahan untuk prasmanan, training & RND', icon: 'i-lucide-utensils', to: '/stock/usage/pemakaian', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
  { key: 'waste', label: 'Waste Produk', desc: 'Produk & bahan terbuang beserta sebabnya', icon: 'i-lucide-trash-2', to: '/stock/usage/waste', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },
  { key: 'serah', label: 'Serah Terima', desc: 'Stok keluar ke Kitchen/Bar, wajib berfoto', icon: 'i-lucide-handshake', to: '/stock/usage/serah', grup: 'Pemakaian Bahan Baku', boleh: panel('usage') },

  // ── HPP & Resep (kunci hpp; flag admin hanya menyembunyikan aksi) ──
  { key: 'hpp_dash', label: 'Dashboard HPP', desc: 'COGS, menu paling boros & penggerak modal', icon: 'i-lucide-gauge', to: '/stock/hpp/dash', grup: 'HPP & Resep', boleh: panel('hpp') },
  { key: 'hpp_resep', label: 'Daftar Resep', desc: 'Semua resep base & menu jadi berikut modalnya', icon: 'i-lucide-book-open', to: '/stock/hpp/resep', grup: 'HPP & Resep', boleh: panel('hpp') },
  { key: 'hpp_bahan', label: 'Bahan & Harga', desc: 'Harga beli tiap bahan — sumber semua angka modal', icon: 'i-lucide-tags', to: '/stock/hpp/bahan', grup: 'HPP & Resep', boleh: panel('hpp') },
  { key: 'hpp_floor', label: 'Barang Floor', desc: 'Dibeli & berharga, tapi tidak masuk resep', icon: 'i-lucide-armchair', to: '/stock/hpp/floor', grup: 'HPP & Resep', boleh: panel('hpp') },
  { key: 'hpp_pakai', label: 'Pemakaian & Selisih', desc: 'Stok awal, belanja, pemakaian & opname', icon: 'i-lucide-scale', to: '/stock/hpp/pakai', grup: 'HPP & Resep', boleh: panel('hpp') },
  { key: 'hpp_kalk', label: 'Kalkulator HPP', desc: 'Hitung modal & harga jual tanpa menyimpan', icon: 'i-lucide-calculator', to: '/stock/hpp/kalk', grup: 'HPP & Resep', boleh: panel('hpp') },
  { key: 'hpp_atur', label: 'Pengaturan HPP', desc: 'Target COGS, buffer & ambang lampu selisih', icon: 'i-lucide-settings', to: '/stock/hpp/atur', grup: 'HPP & Resep', boleh: panel('hpp') },

  // ── Break & Loss (kunci breakloss) ──
  { key: 'breakloss', label: 'Break & Loss', desc: 'Barang pecah & hilang + stok terkini', icon: 'i-lucide-package-x', to: '/stock/breakloss', grup: 'Break & Loss', boleh: panel('breakloss') },
]

/** The line under the user's name in the module chrome. */
export function peranStock(me: Me | null): string {
  if (!me) return ''
  const p: string[] = []
  if (hasAccess(me, ['ordering'])) {
    const r = usePeranStock().value?.ordering?.role
    p.push(r && r !== 'full' ? `Ordering (${LABEL_PERAN_ORDERING[r] ?? r})` : 'Ordering')
  }
  if (hasAccess(me, ['purchasing'])) p.push('Purchasing')
  if (hasAccess(me, ['usage'])) p.push('Pemakaian')
  if (hasAccess(me, ['hpp'])) p.push('HPP')
  if (hasAccess(me, ['breakloss'])) p.push('Break & Loss')
  return p.join(' · ') || 'Kru'
}
