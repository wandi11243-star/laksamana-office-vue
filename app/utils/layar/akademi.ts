// The 13 screens of the Akademi module, in the old sidebar order
// (laksamana-office/deploy/akademi/index.html navSections :836-861). The keys are
// the old NAV keys unchanged.
//
// Admin screens are Office module-admin only (`isAdminOf(me,'akademi')`,
// :598-603); Progress Tim is for manager+ — module admin, or a crew row with the
// internal role `manager` (`isManager`, :601). The page files guard too, the menu
// only hides what would certainly 403.
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import { isManagerAkademi } from '~/composables/useAkademi'

const bolehAdmin = (me: Me) => isAdminOf(me, 'akademi')
const bolehManager = (me: Me) => isManagerAkademi(me)

export const LAYAR_AKADEMI: Layar[] = [
  { key: 'dashboard', label: 'Beranda', desc: 'Progress trainingmu dan materi yang menunggu.', icon: 'i-lucide-home', to: '/akademi/dashboard', grup: 'Operasi' },
  { key: 'materi', label: 'Materi Saya', desc: 'Materi training untuk divisimu + materi semua divisi.', icon: 'i-lucide-book-open', to: '/akademi/materi', grup: 'Operasi' },
  { key: 'program', label: 'Program Bulanan', desc: 'Training baru & refresher tiap bulan, standar dijaga terus.', icon: 'i-lucide-calendar-days', to: '/akademi/program', grup: 'Operasi' },
  { key: 'perpus', label: 'Perpustakaan', desc: 'Semua materi lintas divisi; materi luar divisimu terbuka dalam Mode Baca.', icon: 'i-lucide-library', to: '/akademi/perpus', grup: 'Operasi' },
  { key: 'struktur', label: 'Struktur Organisasi', desc: 'Jalur komando kapal & PIC divisimu.', icon: 'i-lucide-network', to: '/akademi/struktur', grup: 'Data & analisa' },
  { key: 'sertifikat', label: 'Progress & Sertifikat', desc: 'Jejak trainingmu di Akademi Laksamana.', icon: 'i-lucide-award', to: '/akademi/sertifikat', grup: 'Data & analisa' },
  { key: 'tim', label: 'Progress Tim', desc: 'Progress wajib kru divisimu, untuk PIC & manajemen.', icon: 'i-lucide-users', to: '/akademi/tim', grup: 'Data & analisa', boleh: bolehManager },
  { key: 'anjungan', label: 'Anjungan', desc: 'Pusat kendali training, kondisi standar kru secara keseluruhan.', icon: 'i-lucide-compass', to: '/akademi/anjungan', grup: 'Kontrol', boleh: bolehAdmin },
  { key: 'kelolaMateri', label: 'Kelola Materi', desc: 'Tambah / edit video, modul, SOP, menu baru, dan kuis.', icon: 'i-lucide-folder-cog', to: '/akademi/kelola-materi', grup: 'Kontrol', boleh: bolehAdmin },
  { key: 'kelolaProgram', label: 'Kelola Program', desc: 'Susun training bulanan: materi baru + refresher lama.', icon: 'i-lucide-calendar-cog', to: '/akademi/kelola-program', grup: 'Kontrol', boleh: bolehAdmin },
  { key: 'kelolaKru', label: 'Kelola Kru', desc: 'Divisi dan peran kru. Akun & login dikelola di Office.', icon: 'i-lucide-anchor', to: '/akademi/kelola-kru', grup: 'Kontrol', boleh: bolehAdmin },
  { key: 'log', label: 'Log Aktivitas', desc: 'Jejak audit training (500 terakhir).', icon: 'i-lucide-clock', to: '/akademi/log', grup: 'Kontrol', boleh: bolehAdmin },
  { key: 'sync', label: 'Sinkronisasi & Backup', desc: 'Status data & unduh backup. Data tersimpan di server.', icon: 'i-lucide-cloud', to: '/akademi/sync', grup: 'Kontrol', boleh: bolehAdmin },
]
