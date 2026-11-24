import { layarTersembunyiCashier } from '~/composables/useCashier'
import { isAdminOf, type Me } from '~/composables/useMe'

// The screens of the Cashier panel, in the order of the old sidebar
// (`deploy/cashier/index.html:379-414`, groups "Kasir" and "Sistem"). Keys are
// the old view keys, unchanged.
//
// A holder of `cashier` opens every screen unless a Cashier admin closed it
// for them in Kelola Akses (owner request, Nov 2026; document `/kompas/cashier/access`).
// `bolehCashier(key)` hides the menu entry and the route guard (auth.global)
// keeps the URL closed too. Kelola Akses itself is admin-only. Module admin also
// widens Performa Kasir (all cashiers) and the Void tax/service setting; the
// server is the real guard of the data.
const bolehCashier = (key: string) => (me: Me) => !layarTersembunyiCashier(me).includes(key)
export const LAYAR_CASHIER: Layar[] = [
  { key: 'report', label: 'Report Daily', desc: 'Setoran per metode pembayaran: POS vs Actual', icon: 'i-lucide-clipboard-list', to: '/cashier/report', grup: 'Kasir', boleh: bolehCashier('report') },
  { key: 'piutang', label: 'Piutang / Bon', desc: 'Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya', icon: 'i-lucide-receipt-text', to: '/cashier/piutang', grup: 'Kasir', boleh: bolehCashier('piutang') },
  { key: 'compliment', label: 'Compliment', desc: 'Catatan compliment beserta alasan & PIC penanggungnya', icon: 'i-lucide-gift', to: '/cashier/compliment', grup: 'Kasir', boleh: bolehCashier('compliment') },
  { key: 'voidb', label: 'Void Menu', desc: 'Tiap menu yang di-void wajib dicatat berikut kronologinya', icon: 'i-lucide-ban', to: '/cashier/voidb', grup: 'Kasir', boleh: bolehCashier('voidb') },
  { key: 'rokok', label: 'Daily Stock Rokok', desc: 'Barang masuk & keluar per hari, per item', icon: 'i-lucide-package', to: '/cashier/rokok', grup: 'Kasir', boleh: bolehCashier('rokok') },
  { key: 'rokokrekap', label: 'Rekap Stock Rokok', desc: 'Masuk, keluar, dan sisa tiap produk sepanjang satu bulan', icon: 'i-lucide-calendar-range', to: '/cashier/rokokrekap', grup: 'Kasir', boleh: bolehCashier('rokokrekap') },
  { key: 'kasir', label: 'Performa Kasir', desc: 'Omset yang diakui tiap kasir — angka final', icon: 'i-lucide-chart-column', to: '/cashier/kasir', grup: 'Kasir', boleh: bolehCashier('kasir') },
  { key: 'dp', label: 'Dana Masuk (DP)', desc: 'Uang DP reservasi yang sudah masuk — dibaca dari modul Reservasi', icon: 'i-lucide-wallet', to: '/cashier/dp', grup: 'Kasir', boleh: bolehCashier('dp') },
  { key: 'bri', label: 'Pencocokan QRIS BRI', desc: 'Mutasi masuk rekening BRI dicocokkan ke DP reservasi', icon: 'i-lucide-scan-line', to: '/cashier/bri', grup: 'Kasir', boleh: bolehCashier('bri') },
  { key: 'rokokset', label: 'Pengaturan Item Rokok', desc: 'Item apa saja yang muncul di lembar Daily Stock Rokok', icon: 'i-lucide-settings-2', to: '/cashier/rokokset', grup: 'Sistem', boleh: bolehCashier('rokokset') },
  { key: 'akses', label: 'Kelola Akses', desc: 'Atur halaman Cashier yang boleh dibuka tiap kru', icon: 'i-lucide-key-round', to: '/cashier/akses', grup: 'Sistem', boleh: me => isAdminOf(me, 'cashier') },
]
