// The screens of the Reservasi panel, with the in-module role matrix.
//
// The panel has SIX roles of its own, unrelated to the Office module keys: they
// live in `master.users[].role` and are resolved from the signed-in user (id
// first, then name), with an Office admin of `reservasi` overriding to `admin`
// for the session. What a role may open is `master.perms` (0 not visible,
// 1 view, 2 may edit); `ROLE_NAV` + `CAN_DEFAULT` are only the seed and the
// fallback while that matrix is not loaded, exactly as in the old client.
//
//   deploy/reservasi/index.html:3548-3571  OFFICE_TO_RESERVASI_ROLE + resolveReservasiUser
//   deploy/reservasi/index.html:961-982    ROLE_NAV
//   deploy/reservasi/index.html:985-998    CAN_DEFAULT
//   deploy/reservasi/index.html:3523-3533  pagePerm() / canEdit()
//
// `hariH` (an alias of dashboard) and the ghost page `review` are NOT screens
// here: review belongs to Service Excellent (T-21).
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import type { PeranReservasi } from '~/composables/useReservasi'
import { usePeranReservasi } from '~/composables/useReservasi'

export type RoleReservasi = 'host' | 'marketing' | 'cashier' | 'manager' | 'viewer' | 'admin'

export const ROLE_RESERVASI: RoleReservasi[] = ['host', 'marketing', 'cashier', 'manager', 'viewer', 'admin']

export const ROLE_LABEL_RESERVASI: Record<RoleReservasi, string> = {
  host: 'Host / Captain',
  marketing: 'Marketing (PIC)',
  cashier: 'Cashier',
  manager: 'Manajer / Owner',
  viewer: 'View Only',
  admin: 'Admin Sistem',
}

/**
 * Which screens a role may open (`:961-982`). Seed of `master.perms`, not the rule itself.
 *
 * The old `OFFICE_TO_RESERVASI_ROLE` (`:3548`) is gone with the rest: the current
 * Office session is v3 and carries no role at all, so that map has had no input
 * since — an unknown person became `host` there too.
 */
const ROLE_NAV: Record<RoleReservasi, string[]> = {
  host: ['dashboard', 'input', 'riwayat', 'analitik'],
  marketing: ['dashboard', 'input', 'riwayat', 'analitik'],
  cashier: ['dashboard', 'finance', 'riwayat'],
  manager: ['dashboard', 'input', 'finance', 'riwayat', 'analitik', 'denah', 'master', 'audit'],
  // View only: just the read-only screens. Input, Dana Masuk, Master and Audit
  // are not on the list, so a superadmin turns them on in the matrix by hand.
  viewer: ['dashboard', 'riwayat', 'analitik'],
  admin: ['dashboard', 'input', 'finance', 'riwayat', 'analitik', 'denah', 'master', 'audit'],
}

/** Who may EDIT, per action (`:985-998`). Seed of `master.perms`. */
const CAN_DEFAULT: Record<string, (role: RoleReservasi) => boolean> = {
  input: r => ['host', 'marketing', 'manager', 'admin'].includes(r),
  editStatus: r => ['host', 'marketing', 'manager', 'admin'].includes(r),
  deleteReservation: r => ['marketing', 'manager', 'admin'].includes(r),
  deleteReview: r => ['manager', 'admin'].includes(r),
  master: r => ['manager', 'admin'].includes(r),
  denah: r => ['manager', 'admin'].includes(r),
  audit: r => ['manager', 'admin'].includes(r),
  manageUsers: r => r === 'admin',
  seeDP: () => true,
  finance: r => ['cashier', 'manager', 'admin'].includes(r),
  // Removing a money record is the System Admin's alone: a cashier or manager may
  // reject a proof, but must not erase the trace of the transaction.
  deleteDp: r => r === 'admin',
}

/** Each action belongs to one permission ROW, by the kind of data it changes, not by the screen it is clicked on (`:1013-1018`). */
const ACTION_PAGE: Record<string, string> = {
  input: 'input',
  editStatus: 'input',
  deleteReservation: 'inputDelete',
  deleteReview: 'review',
  master: 'master',
  denah: 'denah',
  audit: 'audit',
  finance: 'finance',
  deleteDp: 'financeDelete',
}

/**
 * The permission rows of this panel: one per screen, plus the two EXTRA rows that
 * split "delete" away from the screen it lives on (`:1021-1024`). Splitting them
 * is the point: ticking "Boleh Ubah" for a cashier on Dana Masuk must not
 * quietly open the deletion of a money record.
 */
export interface BarisIzin {
  key: string
  label: string
  /** The screen that carries the row, for visibility. */
  page: string
  /** Draw it right after this screen in the matrix. */
  afterPage: string
}

export const BARIS_IZIN_RESERVASI: BarisIzin[] = [
  { key: 'input', label: 'Input Reservasi', page: 'input', afterPage: 'input' },
  { key: 'inputDelete', label: 'Hapus Reservasi', page: 'input', afterPage: 'input' },
  { key: 'finance', label: 'Dana Masuk (DP)', page: 'finance', afterPage: 'finance' },
  { key: 'financeDelete', label: 'Hapus Catatan DP', page: 'finance', afterPage: 'finance' },
  { key: 'master', label: 'Kelola Akses', page: 'master', afterPage: 'master' },
  { key: 'audit', label: 'Log Activity', page: 'audit', afterPage: 'audit' },
]

/** The matrix as stored in `master.perms`: row -> role -> level. */
export type PeranMatrix = NonNullable<PeranReservasi['perms']>

/**
 * The matrix seed, mirroring the old DEFAULT_PERMS IIFE (`:1109-1129`):
 * visibility from ROLE_NAV (through an extra row's parent page), edit level
 * from the loosest bound action, rows without an action default to edit, and
 * viewer never rises above view. The master screen resets to this.
 */
export function seedPermsReservasi(): PeranMatrix {
  const seed: PeranMatrix = {}
  const induk = (row: string) => BARIS_IZIN_RESERVASI.find(b => b.key === row)?.page ?? row
  const baris: string[] = []
  for (const l of LAYAR_RESERVASI) {
    baris.push(l.key)
    for (const b of BARIS_IZIN_RESERVASI.filter(b => b.afterPage === l.key && b.key !== l.key)) baris.push(b.key)
  }
  for (const row of baris) {
    seed[row] = {}
    const vis = induk(row)
    for (const r of ROLE_RESERVASI) {
      if (!ROLE_NAV[r].includes(vis)) {
        seed[row]![r] = 0
        continue
      }
      if (r === 'viewer') {
        seed[row]![r] = 1
        continue
      }
      const aksi = Object.keys(ACTION_PAGE).filter(a => ACTION_PAGE[a] === row)
      const bolehUbah = aksi.length ? aksi.some(a => CAN_DEFAULT[a]?.(r)) : true
      seed[row]![r] = bolehUbah ? 2 : 1
    }
  }
  return seed
}

/** This person's role in this panel (`:3558` plus the Office-admin override in boot(), `:3681`). */
export function roleReservasi(me: Me | null): RoleReservasi {
  if (!me) return 'viewer'
  if (isAdminOf(me, 'reservasi')) return 'admin'
  const { users } = usePeranReservasi().value
  const kru = users.find(u => u.id === me.id)
    ?? users.find(u => String(u.name).toLowerCase() === me.name.toLowerCase())
  const role = kru?.role as RoleReservasi | undefined
  if (role && role in ROLE_LABEL_RESERVASI) return role
  return me.modules.includes('marketing') ? 'marketing' : 'host'
}

/**
 * The level of one row for one role (`:3523`): admin always edits, a row or role
 * the matrix does not mention falls back to the ROLE_NAV seed, and `viewer` can
 * never rise above view — a matrix edited by hand must not hand a "View Only"
 * role a delete button.
 */
export function pagePerm(page: string, role: RoleReservasi): 0 | 1 | 2 {
  if (role === 'admin') return 2
  const perms = usePeranReservasi().value.perms
  // A matrix saved before "Atur denah & meja" got its own row has no `denah`
  // entry: until someone saves it, the screen keeps following Kelola Akses.
  if (page === 'denah' && perms && perms.denah?.[role] === undefined) return pagePerm('master', role)
  const tersimpan = perms?.[page]?.[role]
  const nilai = typeof tersimpan === 'number'
    ? tersimpan as 0 | 1 | 2
    : perms === null
      ? ((seedPermsReservasi()[page]?.[role] ?? 0) as 0 | 1 | 2)
      : (ROLE_NAV[role].includes(page) ? 1 : 0)
  return role === 'viewer' && nilai > 1 ? 1 : nilai
}

/** May this role open the screen at all (`:3621`)? */
export const bolehBuka = (page: string, role: RoleReservasi) => pagePerm(page, role) >= 1

/**
 * May this role change the kind of data this action touches (`CAN` proxy, `:1028`)?
 * An action with no row of its own falls back to its default.
 */
export function bolehAksi(aksi: string, role: RoleReservasi): boolean {
  if (aksi === 'manageUsers' || aksi === 'seeDP') return CAN_DEFAULT[aksi]!(role)
  const row = ACTION_PAGE[aksi]
  if (row) return pagePerm(row, role) >= 2
  return CAN_DEFAULT[aksi] ? CAN_DEFAULT[aksi]!(role) : false
}

/** The `boleh` of a screen, for `Layar`. */
export const bolehLayar = (key: string) => (me: Me) => bolehBuka(key, roleReservasi(me))

/** The screens of the panel, in the order of the old sidebar. */
export const LAYAR_RESERVASI: Layar[] = [
  { key: 'dashboard', label: 'Dashboard & recap', desc: 'Data reservasi, denah meja, dan antrean dalam satu halaman.', icon: 'i-lucide-layout-dashboard', to: '/reservasi/dashboard', grup: 'Operasi', boleh: bolehLayar('dashboard') },
  { key: 'input', label: 'Input reservasi', desc: 'Isi data tamu. Target: selesai di bawah 2 menit.', icon: 'i-lucide-calendar-plus', to: '/reservasi/input', grup: 'Operasi', boleh: bolehLayar('input') },
  { key: 'finance', label: 'Dana masuk (DP)', desc: 'Cek uang DP yang benar-benar masuk.', icon: 'i-lucide-receipt', to: '/reservasi/finance', grup: 'Keuangan', boleh: bolehLayar('finance') },
  { key: 'riwayat', label: 'Riwayat', desc: 'Arsip reservasi yang sudah lewat, dasar CRM dan evaluasi.', icon: 'i-lucide-history', to: '/reservasi/riwayat', grup: 'Data & analisa', boleh: bolehLayar('riwayat') },
  { key: 'analitik', label: 'Analitik', desc: 'Insight bisnis dari seluruh data reservasi.', icon: 'i-lucide-chart-column', to: '/reservasi/analitik', grup: 'Data & analisa', boleh: bolehLayar('analitik') },
  // Plan editing moved out of the dashboard into its own screen (owner request,
  // Nov 2026) and has its own row in the access matrix, so any role can be
  // given it without also getting Kelola Akses.
  { key: 'denah', label: 'Atur denah & meja', desc: 'Editor denah, jadwal denah per tanggal, dan kapasitas tiap meja.', icon: 'i-lucide-map', to: '/reservasi/denah', grup: 'Kontrol', boleh: bolehLayar('denah') },
  { key: 'master', label: 'Kelola Akses', desc: 'Kelola pilihan dropdown, role kru & hak akses.', icon: 'i-lucide-key-round', to: '/reservasi/master', grup: 'Kontrol', boleh: bolehLayar('master') },
  { key: 'audit', label: 'Log Activity', desc: 'Jejak seluruh aktivitas: siapa, kapan, apa yang diubah.', icon: 'i-lucide-history', to: '/reservasi/audit', grup: 'Kontrol', boleh: bolehLayar('audit') },
]
