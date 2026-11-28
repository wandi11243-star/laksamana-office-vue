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
import { bolehLihatKonten, usePeranKonten, useStateKonten } from '~/composables/useKonten'

const boleh = (key: string) => (me: Me) => {
  const p = usePeranKonten().value
  return bolehLihatKonten(me, p.users, p.perms, key)
}

const l = (key: string, label: string, desc: string, icon: string, kelompok?: Layar['kelompok']): Layar =>
  ({ key, label, desc, icon, to: `/konten/${key}`, kelompok, boleh: boleh(key) })

const Operasi = { label: 'Perencanaan', icon: 'i-lucide-calendar-days' }
const Produksi = { label: 'Produksi', icon: 'i-lucide-clapperboard' }
const Kontrol = { label: 'Publikasi', icon: 'i-lucide-send' }
const Pengaturan = { label: 'Pengaturan', icon: 'i-lucide-settings' }
const Analytics = { label: 'Insight & Riset', icon: 'i-lucide-sparkles' }
export const LAYAR_KONTEN: Layar[] = [
  l('dashboard', 'Dashboard', 'Ringkasan operasional real-time', 'i-lucide-layout-grid'),
  l('planning', 'Content Planning', 'Semua unit konten dari ide sampai tayang', 'i-lucide-list', Operasi),
  l('pipeline', 'Pipeline', 'Papan alur produksi', 'i-lucide-columns-3', Operasi),
  l('calendar', 'Kalender', 'Jadwal tayang & rencana posting', 'i-lucide-calendar', Operasi),
  l('shooting', 'Shooting Schedule', 'Jadwal produksi foto & video', 'i-lucide-camera', Produksi),
  l('design', 'Design Queue', 'Antrian pekerjaan desain', 'i-lucide-pen-tool', Produksi),
  l('editing', 'Editing Queue', 'Antrian pekerjaan video', 'i-lucide-film', Produksi),
  l('assets', 'Asset Management', 'Pustaka file produksi', 'i-lucide-folder', Produksi),
  l('approval', 'Approval', 'Alur persetujuan konten berjenjang', 'i-lucide-circle-check', Kontrol),
  l('publishing', 'Publishing', 'Catatan publikasi aktual', 'i-lucide-send', Kontrol),
  l('kol', 'KOL & Medpar Management', 'Database KOL & Media Partner + planning kunjungan event', 'i-lucide-users-round'),
  l('brands', 'Brand Management', 'Master data & pedoman brand', 'i-lucide-anchor'),
  // Panel Analytics baru (#133, deploy/konten/analytics/): akun TikTok/IG,
  // insight, kalender posting & riset tren. Route `analytics`/`calendar` sudah
  // dipakai layar lama, jadi key-nya berbeda.
  l('insight', 'Insight Konten', 'Postingan terpopuler, akun terhubung & insight per platform', 'i-lucide-sparkles', Analytics),
  l('riset', 'Riset Tren', 'Riset tren AI dari postingan brand', 'i-lucide-radar', Analytics),
  l('bank', 'Bank Konten', 'Ide konten & content planning AI', 'i-lucide-lightbulb', Analytics),
  l('tumbuh', 'Pertumbuhan Akun', 'Kenaikan follower, views & interaksi, plus umur & gender follower', 'i-lucide-trending-up', Analytics),
  l('iklan', 'Performa Iklan', 'Iklan Facebook & Instagram: mana yang works, mana yang tidak', 'i-lucide-target', Analytics),
  l('designperf', 'Performa Desain', 'Virality konten berdesain & jumlah desain selesai per kategori', 'i-lucide-pen-line', Analytics),
  l('greview', 'Google Review', 'Ulasan Google tamu: yang perlu ditangani, dibalas langsung, dan dianalisa AI', 'i-lucide-star'),
  l('sosmed', 'Pengaturan Sosmed', 'Profil brand, TikTok, Instagram & Meta Ads', 'i-lucide-key-round', Pengaturan),
  l('settings', 'Kelola Akses', 'Konfigurasi sistem, daftar kru & hak akses', 'i-lucide-shield-check', Pengaturan),
  l('activity', 'Log Activity', 'Jejak audit seluruh aktivitas', 'i-lucide-history'),
]

/** Red badge on Approval: items waiting for approval across all brands (old updateApprovalBadge, :1683). */
export function useLencanaKonten() {
  const { data } = useStateKonten()
  return computed<Record<string, number>>(() => ({ approval: data.value.content.filter(c => c.status === 'Approval').length }))
}
