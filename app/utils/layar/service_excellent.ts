// The screens of the Service Excellent panel, with its in-module role matrix.
//
// This panel has its OWN three levels — staff, manager, admin — not Reservasi's
// six roles. The role is read from `master.seCrew` and mapped when read, never
// written back as a new value: writing "staff" into the shared record would
// hand Reservasi a role it does not know and lock the person out of their own
// module with no message (service_excellent/index.html:886-904).
// `master.sePerms` is this module's own matrix; it is NOT Reservasi's `perms`.
//
//   deploy/service_excellent/index.html:894      ROLE_LABEL
//   deploy/service_excellent/index.html:899-904  roleSE()
//   deploy/service_excellent/index.html:916-921  ROLE_NAV
//   deploy/service_excellent/index.html:929-943  CAN_DEFAULT
//   deploy/service_excellent/index.html:965-993  ACTION_PAGE + EXTRA_PERM_ROWS
import type { Me } from '~/composables/useMe'
import type { SeTingkat } from '~/composables/useServiceExcellent'
import { usePeranSE } from '~/composables/useServiceExcellent'

export const TINGKAT_SE: SeTingkat[] = ['staff', 'manager', 'admin']

export const LABEL_TINGKAT_SE: Record<SeTingkat, string> = {
  staff: 'Staff',
  manager: 'Manajer / Owner',
  admin: 'Admin Sistem',
}

/** A stored role, mapped to one of the module's three levels when read (`:899-904`). */
export function tingkatDariRole(role: string | undefined): SeTingkat {
  const s = String(role ?? '').toLowerCase()
  if (s === 'admin') return 'admin'
  if (s === 'manager') return 'manager'
  return 'staff'
}

/** Which screens a level may open (`:916-921`). Seed of `master.sePerms`, not the rule itself. */
const ROLE_NAV: Record<SeTingkat, string[]> = {
  // Staff: reviews & feedback, but no settings and no roles.
  staff: ['capaian', 'review', 'feedback'],
  manager: ['capaian', 'review', 'feedback', 'peran', 'setelan'],
  admin: ['capaian', 'review', 'feedback', 'peran', 'setelan'],
}

/** Who may EDIT, per action (`:929-943`). Seed of `master.sePerms`. */
const CAN_DEFAULT: Record<string, (tingkat: SeTingkat) => boolean> = {
  input: t => ['staff', 'manager', 'admin'].includes(t),
  editStatus: t => ['staff', 'manager', 'admin'].includes(t),
  catatReview: t => ['staff', 'manager', 'admin'].includes(t),
  mintaReview: t => ['staff', 'manager', 'admin'].includes(t),
  master: t => ['manager', 'admin'].includes(t),
  deleteReview: t => ['manager', 'admin'].includes(t),
  kelolaRole: t => ['manager', 'admin'].includes(t),
  manageUsers: t => ['manager', 'admin'].includes(t),
  audit: t => ['manager', 'admin'].includes(t),
  seeDP: () => true,
}

/** Each action belongs to one permission ROW, by the kind of data it changes (`:965-972`). */
const ACTION_PAGE: Record<string, string> = {
  input: 'feedback',
  editStatus: 'feedback',
  catatReview: 'review',
  mintaReview: 'mintaReview',
  master: 'verifikasi',
  audit: 'verifikasi',
  deleteReview: 'hapusCatatan',
  kelolaRole: 'peran',
  manageUsers: 'peran',
}

export interface BarisIzinSE {
  key: string
  label: string
  /** The screen that carries the row, for visibility. */
  page: string
  /** Draw it right after this screen in the matrix. */
  afterPage: string
}

/**
 * The permission rows of this panel (`:984-993`). `mintaReview` is split off from
 * the review screen on purpose: many people may see the review board without
 * being allowed to send an invitation to a guest's number.
 */
export const BARIS_IZIN_SE: BarisIzinSE[] = [
  { key: 'mintaReview', label: 'Kirim Ajakan Review (WhatsApp)', page: 'review', afterPage: 'review' },
  { key: 'verifikasi', label: 'Verifikasi Klaim, Link & Target', page: 'review', afterPage: 'review' },
  { key: 'hapusCatatan', label: 'Hapus Catatan Review / Feedback', page: 'feedback', afterPage: 'feedback' },
]

/**
 * This person's level in this panel. Until one manager or admin exists, EVERYONE
 * counts as the System Admin, otherwise the module would open with an empty menu
 * for every single person (`:9225-9242`).
 */
export function tingkatSe(me: Me | null): SeTingkat {
  const { crew } = usePeranSE().value
  const adaPengurus = crew.some(k => k.role === 'manager' || k.role === 'admin')
  if (!me) return 'admin'
  if (!adaPengurus) return 'admin'
  const kru = crew.find(k => k.id === me.id) ?? crew.find(k => String(k.name).toLowerCase() === me.name.toLowerCase())
  return tingkatDariRole(kru?.role)
}

/** The level of one row for one level, mirroring Reservasi's pagePerm(). */
export function pagePermSe(page: string, tingkat: SeTingkat): 0 | 1 | 2 {
  if (tingkat === 'admin') return 2
  const tersimpan = usePeranSE().value.perms?.[page]?.[tingkat]
  const nilai = typeof tersimpan === 'number'
    ? tersimpan as 0 | 1 | 2
    : (ROLE_NAV[tingkat].includes(page) ? 1 : 0)
  return tingkat === 'staff' && nilai > 1 ? 1 : nilai
}

export const bolehBukaSe = (page: string, tingkat: SeTingkat) => pagePermSe(page, tingkat) >= 1

/** The matrix seed, mirroring the old DEFAULT_PERMS IIFE (`:1084-1100`).
 *  Unlike Reservasi there is no viewer clamp: all three levels may reach Ubah.
 *  `sePerms` is this module's own section — saving it never touches
 *  Reservasi's `perms` (the old code merged for exactly this reason). */
export function seedPermsSE(): Record<string, Record<string, 0 | 1 | 2>> {
  const seed: Record<string, Record<string, 0 | 1 | 2>> = {}
  const induk = (row: string) => BARIS_IZIN_SE.find(b => b.key === row)?.page ?? row
  const baris: string[] = []
  for (const l of LAYAR_SERVICE_EXCELLENT) {
    baris.push(l.key)
    for (const b of BARIS_IZIN_SE.filter(b => b.afterPage === l.key && b.key !== l.key)) baris.push(b.key)
  }
  for (const row of baris) {
    seed[row] = {}
    const vis = induk(row)
    for (const t of TINGKAT_SE) {
      if (!ROLE_NAV[t].includes(vis)) {
        seed[row]![t] = 0
        continue
      }
      const aksi = Object.keys(ACTION_PAGE).filter(a => ACTION_PAGE[a] === row)
      const bolehUbah = aksi.length ? aksi.some(a => CAN_DEFAULT[a]?.(t)) : true
      seed[row]![t] = bolehUbah ? 2 : 1
    }
  }
  return seed
}

/** `CAN` proxy of this panel (`:999-1003`): an action with no row falls back to its default. */
export function bolehAksiSe(aksi: string, tingkat: SeTingkat): boolean {
  if (aksi === 'seeDP') return CAN_DEFAULT[aksi]!(tingkat)
  const row = ACTION_PAGE[aksi]
  if (row) return pagePermSe(row, tingkat) >= 2
  return CAN_DEFAULT[aksi] ? CAN_DEFAULT[aksi]!(tingkat) : false
}

const bolehLayarSe = (key: string) => (me: Me) => bolehBukaSe(key, tingkatSe(me))

/** The screens of the panel, in the order of the old sidebar. */
export const LAYAR_SERVICE_EXCELLENT: Layar[] = [
  { key: 'capaian', label: 'Dashboard', desc: 'Pencapaian tim dan papan reward.', icon: 'i-lucide-chart-column-increasing', to: '/service_excellent', grup: 'Pekerjaan', boleh: bolehLayarSe('capaian') },
  { key: 'review', label: 'Google review', desc: 'Ajakan review ke tamu, klaim, dan verifikasinya.', icon: 'i-lucide-star', to: '/service_excellent/review', grup: 'Pekerjaan', boleh: bolehLayarSe('review') },
  { key: 'feedback', label: 'Catat feedback', desc: 'Pujian & keluhan tamu, dikategorikan per divisi.', icon: 'i-lucide-message-square', to: '/service_excellent/feedback', grup: 'Pekerjaan', boleh: bolehLayarSe('feedback') },
  { key: 'peran', label: 'Kelola role', desc: 'Kelola role Service Excellent.', icon: 'i-lucide-shield', to: '/service_excellent/peran', grup: 'Pengaturan', boleh: bolehLayarSe('peran') },
  { key: 'setelan', label: 'Setelan', desc: 'Link Google Review, saklar ajakan WhatsApp, dan reward.', icon: 'i-lucide-settings', to: '/service_excellent/setelan', grup: 'Pengaturan', boleh: bolehLayarSe('setelan') },
]
