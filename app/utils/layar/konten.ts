// The screens of the Konten Panel, in the order and groups of the old sidebar
// (`NAV`, deploy/konten/index.html:1579-1602; subtitles from VIEW_META :1686).
// Keys are the old view keys, unchanged.
//
// What a person may open comes from the Panel's own role matrix (`perms`,
// T-08) through `bolehLihatKonten` — the old canView(). The matrix is loaded by
// the shell's `siapkan` (muatPeranKonten) before the menu is drawn; until it
// arrives the default matrix applies, exactly like the old client.
//
// `profile` (Profil Saya) is reached from the user chip, not the menu (konten.md C).
import type { Me } from '~/composables/useMe'
import type { Layar } from '~/utils/layar'
import { bolehLihatKonten, usePeranKonten } from '~/composables/useKonten'

const boleh = (key: string) => (me: Me) => {
  const p = usePeranKonten().value
  return bolehLihatKonten(me, p.users, p.perms, key)
}

const l = (key: string, label: string, desc: string, icon: string, grup: string): Layar =>
  ({ key, label, desc, icon, to: `/konten/${key}`, grup, boleh: boleh(key) })

export const LAYAR_KONTEN: Layar[] = [
  l('dashboard', 'Dashboard', 'Ringkasan operasional real-time', 'i-lucide-layout-grid', 'Operasi'),
  l('planning', 'Content Planning', 'Semua unit konten dari ide sampai tayang', 'i-lucide-list', 'Operasi'),
  l('pipeline', 'Pipeline', 'Papan alur produksi', 'i-lucide-columns-3', 'Operasi'),
  l('calendar', 'Calendar', 'Jadwal tayang lintas brand', 'i-lucide-calendar', 'Operasi'),
  l('shooting', 'Shooting Schedule', 'Jadwal produksi foto & video', 'i-lucide-camera', 'Produksi'),
  l('design', 'Design Queue', 'Antrian pekerjaan desain', 'i-lucide-pen-tool', 'Produksi'),
  l('editing', 'Editing Queue', 'Antrian pekerjaan video', 'i-lucide-film', 'Produksi'),
  l('assets', 'Asset Management', 'Pustaka file produksi', 'i-lucide-folder', 'Produksi'),
  l('approval', 'Approval', 'Alur persetujuan konten berjenjang', 'i-lucide-circle-check', 'Kontrol'),
  l('publishing', 'Publishing', 'Catatan publikasi aktual', 'i-lucide-send', 'Kontrol'),
  l('perfinput', 'Input Performa', 'Angka insight tiap platform untuk konten yang sudah tayang', 'i-lucide-activity', 'Kontrol'),
  l('analytics', 'Performa Konten', 'Reach, Engagement Rate, Virality Index, CTA Click Rate & Content Pillar', 'i-lucide-chart-column', 'Kontrol'),
  l('designperf', 'Performa Desain', 'Virality konten berdesain & jumlah desain selesai per kategori', 'i-lucide-pen-line', 'Kontrol'),
  l('kol', 'KOL & Medpar Management', 'Database KOL & Media Partner + planning kunjungan event', 'i-lucide-users-round', 'Promosi'),
  l('ads', 'Ads Management', 'Kelola & pantau Meta / Google / TikTok Ads', 'i-lucide-megaphone', 'Promosi'),
  l('chats', 'Report Percakapan', 'Rekap chat / percakapan hasil dari iklan', 'i-lucide-message-circle', 'Promosi'),
  l('brands', 'Brand Management', 'Master data & pedoman brand', 'i-lucide-anchor', 'Brand'),
  l('activity', 'Activity Log', 'Jejak audit seluruh aktivitas', 'i-lucide-clock', 'Sistem'),
  l('settings', 'Pengaturan', 'Konfigurasi sistem, daftar kru & hak akses', 'i-lucide-settings', 'Sistem'),
]
