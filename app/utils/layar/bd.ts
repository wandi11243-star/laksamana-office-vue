// The screens of the Task Management panel, in the order of the old sidebar
// (deploy/bd/index.html NAV, putaran keempat). Keys are the old NAV keys, unchanged.
//
// Board & Tasks were pulled from the menu 7 Okt 2026 (replaced by My Task);
// Koordinasi & Routine 6 Okt 2026 — their DATA stays (still read and written
// by the API), only the menu entries are gone. Old addresses redirect:
// /bd/tasks → My Task (the tasks page itself redirects).
//
// `projectDetail` and `prDetail` are NOT entries here: the old panel opened them
// from a card (`bukaProject` / `bukaPr`), never from the menu.
//
// Inside the module there is no per-screen permission matrix: access is decided
// by the Office grant (`docs/migrasi/bd.md` bagian B). Only the signer sets are
// admin-only, and that is checked on the Penyetuju tab itself.
export const LAYAR_BD: Layar[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Kondisi hari ini — task, project & purchasing', icon: 'i-lucide-layout-dashboard', to: '/bd/dashboard', grup: 'Workspace' },
  { key: 'mytask', label: 'My Task', desc: 'Task yang kamu pegang — yang telat, minggu ini, dan yang masih menunggu task lain', icon: 'i-lucide-list-checks', to: '/bd/mytask', grup: 'Workspace' },
  { key: 'projects', label: 'Projects', desc: 'Pekerjaan besar berjangka + milestone', icon: 'i-lucide-folder-kanban', to: '/bd/projects', grup: 'Workspace' },
  { key: 'timeline', label: 'Timeline', desc: 'Gantt semua project — buka project untuk melihat task, sub-task & urutannya', icon: 'i-lucide-chart-gantt', to: '/bd/timeline', grup: 'Workspace' },
  { key: 'calendar', label: 'Calendar', desc: 'Deadline, milestone & agenda', icon: 'i-lucide-calendar-days', to: '/bd/calendar', grup: 'Workspace' },
  { key: 'promo', label: 'Promotion', desc: 'Promo berjalan & akan datang — terbaca seluruh kru di Radar', icon: 'i-lucide-tag', to: '/bd/promo', grup: 'Operasi' },
  { key: 'purchasing', label: 'Purchasing', desc: 'Purchase request mingguan, vendor & status pembelian', icon: 'i-lucide-shopping-cart', to: '/bd/purchasing', grup: 'Operasi' },
  { key: 'tim', label: 'Kru', desc: 'Siapa mengerjakan apa, dan siapa atasannya', icon: 'i-lucide-users', to: '/bd/tim', grup: 'Tim' },
]
