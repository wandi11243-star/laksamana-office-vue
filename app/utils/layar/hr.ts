// The screens of HR / Staff Performance (laksamana-office deploy/hr PAGES
// :952-978, keys unchanged). `/hr` is the Anjungan; the other 16 live under
// `/hr/<key>`.
//
// Visibility: every holder of module `hr` gets the 13 staff screens; the four
// admin screens (Kru, Kalender HR, Pengaturan, Audit Log) need `manageOps` —
// the OFFICE hr module-admin flag, not the in-app role (A. `can`, :681). The
// server enforces the same on writes/audit.
import type { HrEmployee } from '~/utils/hr'
import { canHr, ROLE_LABEL } from '~/utils/hr'
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'

export const useHrCuSiap = () => useState<HrEmployee | null>('hr-cu', () => null)
export const useHrOfficeAdminSiap = () => useState('hr-office-admin', () => false)

/** Load the document once from the module chrome; the menu reads from here. */
export function muatPeranHr() {
  const cu = useHrCuSiap()
  const oa = useHrOfficeAdminSiap()
  const { cu: c, officeAdmin } = useHrDasar()
  watchEffect(() => {
    cu.value = c.value
    oa.value = officeAdmin.value
  })
  return cu
}

const cuAtau = (me: Me | null): HrEmployee | null => useHrCuSiap().value
  ?? (me
    ? {
        id: me.id,
        name: me.name,
        role: me.keterangan || '',
        divId: '',
        level: 'Staff',
        appRole: isAdminOf(me, 'hr') ? 'hr' : 'staff',
        joinDate: '',
        birthDate: '',
        status: 'Aktif',
        phone: '',
        email: '',
        notes: '',
        probationEnd: '',
        contractEnd: '',
      }
    : null)

const officeAdminAtau = (me: Me | null) => useHrOfficeAdminSiap().value || isAdminOf(me, 'hr')

/** One screen's visibility, read by both the sidebar and the page body. */
export function bolehLayarHr(key: string, me: Me | null): boolean {
  const adminPages = ['emp', 'cal', 'settings', 'audit']
  if (adminPages.includes(key)) return canHr('manageOps', cuAtau(me), officeAdminAtau(me))
  return true
}

export const LAYAR_HR: Layar[] = [
  { key: 'dash', label: 'Anjungan', desc: 'Ringkasan kinerja bulan ini', icon: 'i-lucide-layout-dashboard', to: '/hr', grup: 'Utama' },
  { key: 'score', label: 'People Score', desc: 'Skor tujuh komponen & ranking', icon: 'i-lucide-star', to: '/hr/score', grup: 'Utama' },
  { key: 'kehadiran', label: 'Kehadiran', desc: 'Report Talenta & skor presensi', icon: 'i-lucide-calendar-check', to: '/hr/kehadiran', grup: 'Kinerja' },
  { key: 'kpi', label: 'KPI Divisi', desc: 'Target indikator & aktualnya', icon: 'i-lucide-bar-chart-3', to: '/hr/kpi', grup: 'Kinerja' },
  { key: 'okr', label: 'OKR & Target', desc: 'Objective dan key result', icon: 'i-lucide-target', to: '/hr/okr', grup: 'Kinerja' },
  { key: 'review', label: 'Performance Review', desc: 'Penilaian berlapis 12 aspek', icon: 'i-lucide-clipboard-check', to: '/hr/review', grup: 'Kinerja' },
  { key: 'training', label: 'Training Center', desc: 'Program, hasil & sertifikat', icon: 'i-lucide-graduation-cap', to: '/hr/training', grup: 'Pengembangan' },
  { key: 'comp', label: 'Competency Matrix', desc: 'Kompetensi per kru', icon: 'i-lucide-grid-3x3', to: '/hr/comp', grup: 'Pengembangan' },
  { key: 'coach', label: 'Coaching Log', desc: 'Sesi coaching & action plan', icon: 'i-lucide-message-square-text', to: '/hr/coach', grup: 'Pengembangan' },
  { key: 'career', label: 'Career & Succession', desc: 'Jenjang karier & kandidat', icon: 'i-lucide-trending-up', to: '/hr/career', grup: 'Pengembangan' },
  { key: 'reward', label: 'Reward & Recognition', desc: 'Badge, poin & leaderboard', icon: 'i-lucide-trophy', to: '/hr/reward', grup: 'Budaya' },
  { key: 'disc', label: 'Disiplin', desc: 'Pelanggaran & saran SP', icon: 'i-lucide-triangle-alert', to: '/hr/disc', grup: 'Budaya' },
  { key: 'engage', label: 'Engagement', desc: 'Mood tim & kotak saran', icon: 'i-lucide-heart-handshake', to: '/hr/engage', grup: 'Budaya' },
  { key: 'emp', label: 'Kru', desc: 'Data kru & profil kinerja', icon: 'i-lucide-users', to: '/hr/emp', grup: 'Operasional', boleh: me => bolehLayarHr('emp', me) },
  { key: 'cal', label: 'Kalender HR', desc: 'Agenda HR & tanggal penting', icon: 'i-lucide-calendar-days', to: '/hr/cal', grup: 'Operasional', boleh: me => bolehLayarHr('cal', me) },
  { key: 'settings', label: 'Pengaturan', desc: 'Bobot skor, grade, aturan kehadiran', icon: 'i-lucide-settings', to: '/hr/settings', grup: 'Sistem', boleh: me => bolehLayarHr('settings', me) },
  { key: 'audit', label: 'Audit Log', desc: 'Jejak aksi terbaru', icon: 'i-lucide-scroll-text', to: '/hr/audit', grup: 'Sistem', boleh: me => bolehLayarHr('audit', me) },
]

/** Footer role line (`ROLE_LABEL`, :675) — the in-app role, not the Office key. */
export function peranHrLabel(me: Me | null): string {
  const cu = cuAtau(me)
  if (!cu) return ''
  return ROLE_LABEL[cu.appRole] ?? cu.appRole
}
