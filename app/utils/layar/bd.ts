// The screens of the BD OS panel, in the order of the old sidebar
// (`deploy/bd/index.html:1333-1345` NAV). Keys are the old NAV keys, unchanged.
//
// `projectDetail` and `prDetail` are NOT entries here: the old panel opened them
// from a card (`bukaProject` / `bukaPr`), never from the menu.
//
// Inside the module there is no per-screen permission matrix: access is decided
// by the Office grant (`docs/migrasi/bd.md` bagian B). Only the signer sets are
// admin-only, and that is checked on the Penyetuju tab itself.
export const LAYAR_BD: Layar[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Kondisi hari ini — BD, Project & Purchasing', icon: 'i-lucide-layout-dashboard', to: '/bd/dashboard', grup: 'Workspace' },
  { key: 'tasks', label: 'Tasks', desc: 'Prioritas ala Eisenhower — penting × mendesak', icon: 'i-lucide-layout-grid', to: '/bd/tasks', grup: 'Workspace' },
  { key: 'projects', label: 'Projects', desc: 'Pekerjaan besar berjangka + milestone', icon: 'i-lucide-folder-kanban', to: '/bd/projects', grup: 'Workspace' },
  { key: 'calendar', label: 'Calendar', desc: 'Deadline, milestone & agenda', icon: 'i-lucide-calendar-days', to: '/bd/calendar', grup: 'Workspace' },
  { key: 'coord', label: 'Koordinasi', desc: 'Request & follow-up ke divisi lain', icon: 'i-lucide-handshake', to: '/bd/coord', grup: 'Operasi' },
  { key: 'routine', label: 'Routine', desc: 'Task berulang & kepatuhannya', icon: 'i-lucide-repeat', to: '/bd/routine', grup: 'Operasi' },
  { key: 'promo', label: 'Promotion', desc: 'Promo berjalan & akan datang — terbaca seluruh kru di Radar', icon: 'i-lucide-tag', to: '/bd/promo', grup: 'Operasi' },
  { key: 'purchasing', label: 'Purchasing', desc: 'Purchase request mingguan, vendor & status pembelian', icon: 'i-lucide-shopping-cart', to: '/bd/purchasing', grup: 'Operasi' },
  { key: 'tim', label: 'Kru BD', desc: 'Siapa mengerjakan apa, dan siapa atasannya', icon: 'i-lucide-users', to: '/bd/tim', grup: 'Tim' },
]
