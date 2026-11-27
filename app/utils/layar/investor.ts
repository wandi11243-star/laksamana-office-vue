// The screens of Investor Compass. The old NAV groups (Kinerja, Investasi,
// Agenda) stay as menu groups.
//
//   laksamana-office/investor/index.html:792-798  TABS
//
// Nov 2026: Ringkasan + Laporan laba rugi became one "Laba Rugi" screen (the
// Analytics report), and Management Fee + Kelola Akses were added. Each screen
// follows the page × role matrix of GET /investor/settings (useInvestorIzin);
// the investor admin opens everything. Management Fee also needs a seat in the
// fee composition. The server checks again on every read.
import type { Layar } from '~/utils/layar'
import type { HalInvestor } from '~/composables/useInvestor'
import { useInvestorIzin } from '~/composables/useInvestor'

const boleh = (h: HalInvestor) => () => useInvestorIzin().lihat(h)

export const LAYAR_INVESTOR: Layar[] = [
  { key: 'labarugi', label: 'Laba Rugi', desc: 'Omset, biaya, dan laba dari laporan Laba Rugi ESB.', icon: 'i-lucide-wallet', to: '/investor', grup: 'Kinerja', boleh: boleh('labarugi') },
  { key: 'dividen', label: 'Dividen', desc: 'Riwayat dividen yang sudah dibagikan.', icon: 'i-lucide-hand-coins', to: '/investor/dividen', grup: 'Investasi', boleh: boleh('dividen') },
  { key: 'fee', label: 'Management Fee', desc: 'Setoran management fee dan bagian tiap penerima.', icon: 'i-lucide-briefcase', to: '/investor/fee', grup: 'Investasi', boleh: boleh('fee') },
  { key: 'event', label: 'Upcoming event', desc: 'Acara terjadwal dari modul Marketing & Event.', icon: 'i-lucide-calendar-days', to: '/investor/event', grup: 'Agenda', boleh: boleh('event') },
  { key: 'promo', label: 'Promo', desc: 'Yang sedang berjalan dan yang akan datang, dari modul BD OS.', icon: 'i-lucide-badge-percent', to: '/investor/promo', grup: 'Agenda', boleh: boleh('promo') },
  { key: 'akses', label: 'Kelola Akses', desc: 'Akses per halaman, peran tiap orang, dan komposisi management fee.', icon: 'i-lucide-key-round', to: '/investor/akses', grup: 'Sistem', boleh: boleh('akses') },
]
