import { useBdState } from '~/composables/useBd'
import { useMe } from '~/composables/useMe'
import { bacaStateNotif, jumlahBelumDibacaNotif, kunciBacaNotif, notifBd, reviewTertunda } from '~/utils/bd-notif'
import { cariAku, catIniAku, lewat, selesai, todayISO, tugasSaya, undanganTertunda } from '~/utils/bd-rumus'

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
  { key: 'daily', label: 'Daily Task', desc: 'Pekerjaan harian tim — bisa berulang otomatis (harian, hari kerja, mingguan, bulanan)', icon: 'i-lucide-repeat', to: '/bd/daily', grup: 'Workspace' },
  { key: 'recurring', label: 'Recurring Task', desc: 'Semua task berulang — maju sendiri ke jadwal berikutnya, ditandai Done atau tidak', icon: 'i-lucide-history', to: '/bd/recurring', grup: 'Workspace' },
  { key: 'projects', label: 'Projects', desc: 'Pekerjaan besar berjangka + milestone', icon: 'i-lucide-folder-kanban', to: '/bd/projects', grup: 'Workspace' },
  { key: 'calendar', label: 'Calendar', desc: 'Deadline, milestone & agenda', icon: 'i-lucide-calendar-days', to: '/bd/calendar', grup: 'Workspace' },
  { key: 'inbox', label: 'Undangan & Notifikasi', desc: 'Undangan agenda, review, dan kabar tentang task-mu', icon: 'i-lucide-bell', to: '/bd/inbox', grup: 'Workspace' },
  { key: 'promo', label: 'Promotion', desc: 'Promo berjalan & akan datang — terbaca seluruh kru di Radar', icon: 'i-lucide-tag', to: '/bd/promo', grup: 'Operasi' },
  { key: 'purchasing', label: 'Purchasing', desc: 'Purchase request mingguan, vendor & status pembelian', icon: 'i-lucide-shopping-cart', to: '/bd/purchasing', grup: 'Operasi' },
  { key: 'tim', label: 'Kru', desc: 'Siapa mengerjakan apa, dan siapa atasannya', icon: 'i-lucide-users', to: '/bd/tim', grup: 'Tim' },
]

/**
 * Red menu badges (old renderNav, deploy/bd/index.html:1855-1860): My Task =
 * my tasks past their deadline; Undangan & Notifikasi = invites waiting for
 * my answer + tasks waiting on my review + unread notifications (old
 * jumlahInbox). The read marks live in this browser, so the count is re-read
 * on every navigation (leaving the inbox clears it).
 */
export function useLencanaBd() {
  const me = useMe()
  const route = useRoute()
  const { data: state } = useBdState()
  return computed((): Record<string, number> => {
    void route.fullPath
    const s = state.value
    const aku = cariAku(s.people, me.value)
    const telat = tugasSaya(s.tasks, aku?.id).filter(t => !selesai(t) && lewat(t)).length
    if (!aku) return { mytask: telat }
    const notif = notifBd(s.agenda, s.tasks, s.people, aku.id)
    const baca = bacaStateNotif(kunciBacaNotif(catIniAku(s.people, me.value?.id)))
    return {
      mytask: telat,
      inbox: undanganTertunda(s.agenda, aku.id, todayISO()).length + reviewTertunda(s.tasks, aku.id).length
        + jumlahBelumDibacaNotif(notif, baca),
    }
  })
}
