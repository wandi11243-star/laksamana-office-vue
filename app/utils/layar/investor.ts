// The screens of Investor Compass, in the order of the old sidebar tabs.
// The old NAV groups (Kinerja, Investasi, Agenda) become menu groups here.
//
//   laksamana-office/investor/index.html:792-798  TABS
//
// There is no in-module role matrix: everyone holding the `investor` key opens
// every screen. Uploading/deleting monthly PDFs is the investor admin's alone
// (isAdminOf(me, 'investor')), enforced by the API; the Laporan screen only
// hides the form.
import type { Layar } from '~/utils/layar'

export const LAYAR_INVESTOR: Layar[] = [
  { key: 'ringkasan', label: 'Ringkasan', desc: 'Omset harian dan bulanan, capaian target, dan perbandingan tahun ke tahun.', icon: 'i-lucide-layout-dashboard', to: '/investor', grup: 'Kinerja' },
  { key: 'laporan', label: 'Laporan laba rugi', desc: 'Susunan yang sama dengan profit loss report bulanan.', icon: 'i-lucide-file-text', to: '/investor/laporan', grup: 'Kinerja' },
  { key: 'dividen', label: 'Dividen', desc: 'Riwayat dividen yang sudah dibagikan.', icon: 'i-lucide-hand-coins', to: '/investor/dividen', grup: 'Investasi' },
  { key: 'event', label: 'Upcoming event', desc: 'Acara terjadwal dari modul Marketing & Event.', icon: 'i-lucide-calendar-days', to: '/investor/event', grup: 'Agenda' },
  { key: 'promo', label: 'Promo', desc: 'Yang sedang berjalan dan yang akan datang, dari modul BD OS.', icon: 'i-lucide-badge-percent', to: '/investor/promo', grup: 'Agenda' },
]
