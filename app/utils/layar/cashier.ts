// The screens of the Cashier panel, in the order of the old sidebar
// (`deploy/cashier/index.html:379-414`, groups "Kasir" and "Sistem"). Keys are
// the old view keys, unchanged.
//
// No in-module levels (cashier.md bagian B, F.1): every holder of `cashier`
// opens all eleven screens. Module admin only widens Performa Kasir (all
// cashiers) and the Void tax/service setting; the server is the real guard.
export const LAYAR_CASHIER: Layar[] = [
  { key: 'report', label: 'Report Daily', desc: 'Setoran per metode pembayaran: POS vs Actual', icon: 'i-lucide-clipboard-list', to: '/cashier/report', grup: 'Kasir' },
  { key: 'piutang', label: 'Piutang / Bon', desc: 'Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya', icon: 'i-lucide-receipt-text', to: '/cashier/piutang', grup: 'Kasir' },
  { key: 'compliment', label: 'Compliment', desc: 'Catatan compliment beserta alasan & PIC penanggungnya', icon: 'i-lucide-gift', to: '/cashier/compliment', grup: 'Kasir' },
  { key: 'voidb', label: 'Void Menu', desc: 'Tiap menu yang di-void wajib dicatat berikut kronologinya', icon: 'i-lucide-ban', to: '/cashier/voidb', grup: 'Kasir' },
  { key: 'rokok', label: 'Daily Stock Rokok', desc: 'Barang masuk & keluar per hari, per item', icon: 'i-lucide-package', to: '/cashier/rokok', grup: 'Kasir' },
  { key: 'rokokrekap', label: 'Rekap Stock Rokok', desc: 'Masuk, keluar, dan sisa tiap produk sepanjang satu bulan', icon: 'i-lucide-calendar-range', to: '/cashier/rokokrekap', grup: 'Kasir' },
  { key: 'kasir', label: 'Performa Kasir', desc: 'Omset yang diakui tiap kasir — angka final', icon: 'i-lucide-chart-column', to: '/cashier/kasir', grup: 'Kasir' },
  { key: 'dp', label: 'Dana Masuk (DP)', desc: 'Uang DP reservasi yang sudah masuk — dibaca dari modul Reservasi', icon: 'i-lucide-wallet', to: '/cashier/dp', grup: 'Kasir' },
  { key: 'bri', label: 'Pencocokan QRIS BRI', desc: 'Mutasi masuk rekening BRI dicocokkan ke DP reservasi', icon: 'i-lucide-scan-line', to: '/cashier/bri', grup: 'Kasir' },
  { key: 'rokokset', label: 'Pengaturan Item Rokok', desc: 'Item apa saja yang muncul di lembar Daily Stock Rokok', icon: 'i-lucide-settings-2', to: '/cashier/rokokset', grup: 'Sistem' },
  { key: 'akses', label: 'Kelola Akses Kru', desc: 'Siapa saja yang bisa membuka modul Cashier', icon: 'i-lucide-key-round', to: '/cashier/akses', grup: 'Sistem' },
]
