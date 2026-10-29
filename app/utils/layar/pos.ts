// The screens of the POS panel, in the order of the old sidebar
// (deploy/pos/index.html: view keys login, order, terbuka, riwayat, laporan,
// setting). The PIN gate is the login view; paying happens on the order
// screen, so `kasir` covers both order and pay.
export const LAYAR_POS: Layar[] = [
  { key: 'kasir', label: 'Kasir', desc: 'Order baru: grid menu, meja, bayar, struk', icon: 'i-lucide-shopping-cart', to: '/pos/kasir', grup: 'Kasir' },
  { key: 'terbuka', label: 'Open Order', desc: 'Order yang masih terbuka di semua perangkat', icon: 'i-lucide-receipt-text', to: '/pos/terbuka', grup: 'Kasir' },
  { key: 'riwayat', label: 'Riwayat', desc: 'Transaksi yang sudah dibayar atau dibatalkan', icon: 'i-lucide-history', to: '/pos/riwayat', grup: 'Kasir' },
  { key: 'laporan', label: 'Laporan', desc: 'Omset & PB1 harian — klik tanggal untuk rinciannya', icon: 'i-lucide-chart-column', to: '/pos/laporan', grup: 'Kasir' },
  { key: 'pengaturan', label: 'Pengaturan', desc: 'Menu, pengguna & PIN, pajak, printer, cadangan', icon: 'i-lucide-settings-2', to: '/pos/pengaturan', grup: 'Sistem', boleh: me => isAdminOf(me, 'pos') },
]
