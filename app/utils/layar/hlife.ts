// The screens of the Howandi Life OS panel (fondasi F4).
//
// Keys are the old Office menu keys, unchanged (docs/migrasi/hlife.md C). There
// are no roles inside this module: one holder of `howandi_life` sees everything
// (hlife.md B), so no screen carries `boleh`.
//
// The two detail screens (`projectDetail`, `bizDetail`) are NOT menu entries:
// they open from a card, never from the menu (C).
import type { Layar } from '~/utils/layar'

export const LAYAR_HLIFE: Layar[] = [
  { key: 'home', label: 'Command Center', desc: 'Satu halaman. Semua kondisi hari ini.', icon: 'i-lucide-layout-dashboard', to: '/hlife/home', grup: 'Cockpit' },
  { key: 'calendar', label: 'Calendar', desc: 'Google Calendar = single source of truth untuk waktu.', icon: 'i-lucide-calendar-days', to: '/hlife/calendar', grup: 'Cockpit' },
  { key: 'tasks', label: 'Tasks', desc: 'Task & project tersambung — task yang sama, view berbeda.', icon: 'i-lucide-list-checks', to: '/hlife/tasks', grup: 'Execution' },
  { key: 'projects', label: 'Project Center', desc: 'Klik project untuk lihat detail & task-nya.', icon: 'i-lucide-kanban', to: '/hlife/projects', grup: 'Execution' },
  { key: 'content', label: 'Content Pipeline', desc: 'Konten pribadi + side project. Pilih akun untuk fokus.', icon: 'i-lucide-clapperboard', to: '/hlife/content', grup: 'Execution' },
  { key: 'goals', label: 'Goals', desc: 'Target terukur (numerik) + deskripsi singkat.', icon: 'i-lucide-target', to: '/hlife/goals', grup: 'Growth' },
  { key: 'roadmap', label: 'Roadmap & Dreams', desc: 'Target karir & hidup per tahun, dan semua mimpi.', icon: 'i-lucide-map', to: '/hlife/roadmap', grup: 'Growth' },
  { key: 'learning', label: 'Learning & Refleksi', desc: 'Pelajaran dari buku, video, film, podcast.', icon: 'i-lucide-book-open', to: '/hlife/learning', grup: 'Growth' },
  { key: 'reviews', label: 'Evaluasi Diri', desc: 'Review tiap minggu — recap otomatis per bulan.', icon: 'i-lucide-clipboard-check', to: '/hlife/reviews', grup: 'Growth' },
  { key: 'finance', label: 'Finance & Aset', desc: 'Kekayaan pribadi + bisnis, ledger bulanan, dan aset.', icon: 'i-lucide-wallet', to: '/hlife/finance', grup: 'Holding & wealth' },
  { key: 'business', label: 'Businesses', desc: 'Howandi Chandra Inc. — detail tiap anak perusahaan.', icon: 'i-lucide-building-2', to: '/hlife/business', grup: 'Holding & wealth' },
  { key: 'settings', label: 'Data, Sync & Login', desc: 'Penyimpanan, backup, integrasi Google Calendar.', icon: 'i-lucide-settings', to: '/hlife/settings', grup: 'Sistem' },
]
