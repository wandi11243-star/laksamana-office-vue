// The screens of the Marketing module, in the order and groups of the old
// sidebar (`NAV_DEF`, deploy/marketing/index.html:4826-4900; subtitles from
// TITLES :4940). Keys are the old view keys, unchanged.
//
// What a person may open comes from the module's own access matrix (`roleAcc`
// + per-person `acc`) through `bolehLihatMkt` — the old go() check. The matrix
// is loaded by the shell's `siapkan` (muatPeranMkt) before the menu is drawn;
// until it arrives the role defaults apply, exactly like the old client.
//
// Hidden rows (`events`, `brief`, `users`) are matrix rows, not menu items:
// `events` merged into Sales Pipeline, `users` into Kelola Akses, and the
// brief page is reached from the Internal/Client/Draft buttons (marketing.md C).
// The event detail (`/marketing/event/<id>`) has no menu row either.
import type { Me } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'
import { bolehLihatMkt, usePeranMkt } from '~/composables/useMarketing'

const boleh = (key: string) => (me: Me) => {
  const p = usePeranMkt().value
  return bolehLihatMkt(me, p.users, p.roleAcc, key)
}

const l = (key: string, label: string, desc: string, icon: string, grup: string): Layar =>
  ({ key, label, desc, icon, to: `/marketing/${key}`, grup, boleh: boleh(key) })

export const LAYAR_MARKETING: Layar[] = [
  l('dashboard', 'Dashboard', 'Ringkasan aktivitas & target hari ini', 'i-lucide-layout-grid', 'Ruang Komando'),
  l('calendar', 'Kalender', 'Satu jadwal untuk seluruh venue', 'i-lucide-calendar', 'Ruang Komando'),
  l('pipeline', 'Sales Pipeline & Event', 'Papan peluang & daftar seluruh event — satu tempat', 'i-lucide-columns-3', 'Event'),
  l('vip', 'Reservasi VIP', 'Booking ruang VIP — langsung mengunci meja di modul Reservasi', 'i-lucide-star', 'Event'),
  l('designreq', 'Request Design & Video', 'Ajukan kebutuhan desain & video — masuk ke antrian modul Konten', 'i-lucide-palette', 'Event'),
  l('kalkulator', 'Menu Kalkulator', 'Hitung harga jual per pax & diskon dari harga deal customer', 'i-lucide-calculator', 'Finance & Kontrol'),
  l('invoices', 'Invoice & Payment', 'Siklus invoice & tracking pembayaran', 'i-lucide-receipt', 'Finance & Kontrol'),
  l('approvals', 'Approval Flow', 'Persetujuan negosiasi harga / diskon khusus', 'i-lucide-circle-check', 'Finance & Kontrol'),
  l('purchasing', 'Purchase Order', 'Kirim kebutuhan pembelian ke papan Purchasing BD OS', 'i-lucide-shopping-cart', 'Finance & Kontrol'),
  l('perfomset', 'Performa Omset & Bonus', 'Omset yang diakui tiap PIC berikut skema bonusnya — angkanya sama dengan panel Finance', 'i-lucide-trophy', 'Analitik'),
  l('reports', 'Reporting', 'Omset & jumlah event per kategori', 'i-lucide-chart-column', 'Analitik'),
  l('crm', 'Database Client', 'CRM — semua klien dari Lead sampai repeat customer', 'i-lucide-contact', 'Sistem'),
  l('katalog', 'Katalog', 'Materi presentasi venue — gambar & deskripsi, bisa dijalankan layar penuh', 'i-lucide-presentation', 'Sistem'),
  l('notifications', 'Notification Center', 'Semua pengingat penting', 'i-lucide-bell', 'Sistem'),
  l('staff', 'Kelola Akses', 'Data pegawai dari database user Office sekaligus role & hak aksesnya', 'i-lucide-key-round', 'Sistem'),
  l('settings', 'Pengaturan', 'Aturan bisnis, tarif & data', 'i-lucide-settings', 'Sistem'),
  l('timeline', 'Log Activity', 'Jejak seluruh perubahan data', 'i-lucide-history', 'Sistem'),
]
