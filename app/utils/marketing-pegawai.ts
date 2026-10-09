// Marketing › Pegawai & Akses (docs/migrasi/marketing.md D.20, issue #63) —
// pure rules, ported from deploy/marketing/index.html:3705-3820 (roster sync)
// and :19915-20220 (staff list, role from Office title, access matrix).
//
// The roster comes from Office (`/account/roster` + `/account/modules/marketing/members`);
// what this module keeps per person is the `users` row: role, phone, and an
// optional per-person access override. Nothing here talks to the API.
import type { RosterUser } from '~/composables/useRoster'
import type { RoleAccMkt, UserMkt } from '~/utils/marketing'
import { ROLES_MKT, VIEW_KEYS_MKT } from '~/utils/marketing'

/**
 * Office title → Marketing role (ROLE_JABATAN :20042). ORDER MATTERS: the more
 * powerful words are checked first, so "Marketing Manager" becomes Manager /
 * Approver, not Marketing. Whole words, so "Barista" is not "bar" and
 * "Administrasi" is not "admin".
 */
export const ROLE_JABATAN_MKT: [string[], string][] = [
  [['super', 'admin'], 'super_admin'], [['administrator'], 'super_admin'], [['it'], 'super_admin'],
  [['owner'], 'manager'], [['direktur'], 'manager'], [['director'], 'manager'],
  [['manager'], 'manager'], [['manajer'], 'manager'], [['gm'], 'manager'],
  [['kepala'], 'manager'], [['supervisor'], 'manager'], [['approver'], 'manager'],
  [['finance'], 'finance'], [['keuangan'], 'finance'], [['accounting'], 'finance'],
  [['akunting'], 'finance'], [['kasir'], 'finance'], [['cashier'], 'finance'],
  [['marketing'], 'marketing'], [['sales'], 'marketing'], [['penjualan'], 'marketing'],
]

const kataDari = (t: unknown) => String(t ?? '').toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)

export function roleDariJabatanMkt(ket?: string): string {
  const kata = kataDari(ket)
  if (!kata.length) return ''
  return ROLE_JABATAN_MKT.find(([kunci]) => kunci.every(k => kata.includes(k)))?.[1] ?? ''
}

/** A person's team as typed in Office (Tim / Keterangan, stored in `jabatan`; old rows in `div`). */
export const timUserMkt = (u?: UserMkt | null) => String(u?.jabatan || u?.div || '').trim()

/** Division guessed from the Office text: a whole-word match against the module's categories. */
export function divisiDariKeteranganMkt(ket: string | undefined, cats: string[]): string {
  const kata = kataDari(ket)
  if (!kata.length) return ''
  return cats.find((d) => {
    const dl = kataDari(d)
    return dl.length && dl.every(w => kata.includes(w))
  }) ?? ''
}

/** Has a per-person override (hasCustomAccess :3966). */
export const aksesKhususMkt = (u: UserMkt & { nav?: unknown, perms?: unknown }) =>
  !!(u.acc && typeof u.acc === 'object') || Array.isArray(u.nav) || Array.isArray(u.perms)

export interface RencanaSinkronMkt {
  /** New users rows to create. */
  baru: UserMkt[]
  /** Existing rows to patch: only the fields that change. */
  ubah: { id: string, nama: string, fields: Partial<UserMkt>, versi?: number }[]
  /** "Nama: Marketing → Finance" lines for the audit log. */
  roleBerubah: string[]
  /** People with no Tim in Office — their role falls back to the default. */
  tanpaDiv: number
}

/**
 * Plan the roster sync (autoSyncOfficeRoster :3705-3820). `anggota` = the module
 * members (null = that read FAILED: then no role is touched at all, so roles do
 * not flip between browsers). Office is the source for name, phone, title and
 * active; a role follows the title, admin modul → Super Admin, an empty Tim
 * leaves the role as it is. Division is only filled when still empty (it is a
 * guess). The old client also re-keyed a row to the Office id when it was
 * matched by name; a REST row cannot change its id, so that step is left out.
 */
export function rencanaSinkronMkt(
  users: UserMkt[],
  semua: RosterUser[],
  anggota: { id: string, isModuleAdmin?: boolean }[] | null,
  cats: string[],
  namaRole: (r?: string) => string,
): RencanaSinkronMkt {
  const terbaca = Array.isArray(anggota)
  const admin = new Set((anggota ?? []).filter(m => m.isModuleAdmin).map(m => m.id))
  const anggotaSet = new Set((anggota ?? []).map(m => m.id))
  const roleSeharusnya = (m: RosterUser): string | null => {
    if (!terbaca) return null
    if (admin.has(m.id)) return 'super_admin'
    if (!String(m.keterangan || '').trim()) return null
    return roleDariJabatanMkt(m.keterangan) || (anggotaSet.has(m.id) ? 'marketing' : 'operational')
  }
  const out: RencanaSinkronMkt = { baru: [], ubah: [], roleBerubah: [], tanpaDiv: 0 }
  const dipakai = new Set<string>()
  for (const m of semua) {
    if (!m || (!m.id && !m.name)) continue
    const hp = String(m.noHp || '').trim()
    const div = divisiDariKeteranganMkt(m.keterangan, cats)
    if (!div) out.tanpaDiv++
    const u = (m.id ? users.find(x => x.id === m.id && !dipakai.has(x.id)) : undefined)
      ?? users.find(x => !dipakai.has(x.id) && String(x.name || '').toLowerCase() === String(m.name || '').toLowerCase())
    const role = roleSeharusnya(m)
    if (!u) {
      out.baru.push({ id: m.id, name: m.name || '(tanpa nama)', div, jabatan: m.keterangan || '', hp, role: role ?? '', active: m.active !== false })
      continue
    }
    dipakai.add(u.id)
    const f: Partial<UserMkt> = {}
    if (role !== null && (u.role ?? '') !== role) {
      out.roleBerubah.push(`${u.name}: ${namaRole(u.role)} → ${namaRole(role)}`)
      f.role = role
    }
    if (m.name && u.name !== m.name) f.name = m.name
    if (hp && u.hp !== hp) f.hp = hp
    if (m.keterangan && u.jabatan !== m.keterangan) f.jabatan = m.keterangan
    if (div && !u.div) f.div = div
    if ((u.active !== false) !== (m.active !== false)) f.active = m.active !== false
    if (Object.keys(f).length) out.ubah.push({ id: u.id, nama: u.name, fields: f, versi: u.updatedAt })
  }
  return out
}

/** Rows of the access matrix: every screen key with its menu title (permViewKeys). */
export const JUDUL_VIEW_MKT: Record<string, string> = {
  dashboard: 'Dashboard', calendar: 'Kalender', pipeline: 'Sales Pipeline & Event', events: 'Input & Event',
  brief: 'Event Brief & Quotation', vip: 'Reservasi VIP', designreq: 'Request Design & Video', kalkulator: 'Menu Kalkulator',
  invoices: 'Invoice & Payment', approvals: 'Approval Flow', purchasing: 'Purchase Order', perfomset: 'Performa Omset & Bonus',
  reports: 'Reporting', tasks: 'Task Divisi (Handover)', crm: 'Database Client', katalog: 'Katalog', templates: 'Template Task',
  notifications: 'Notification Center', staff: 'Pegawai & Akses', settings: 'Pengaturan', timeline: 'Timeline & Audit Log',
  users: 'Kelola Role & Hak Akses',
}
export const LABEL_LEVEL_MKT = ['None', 'Lihat', 'Ubah'] as const
export const RAGAM_LEVEL_MKT = ['Tak Terlihat', 'Lihat', 'Boleh Ubah'] as const

/** Next level of a cycling matrix cell: None → Lihat → Ubah → None (cyclePerm). */
export const putarLevelMkt = (v: number) => (((Number(v) || 0) + 1) % 3)

/**
 * The matrix to store (saveRoleMatrix): every role but Super Admin (always
 * full), and every role keeps at least "Lihat" on the dashboard — the way in.
 */
export function simpanMatriksMkt(draft: Record<string, Record<string, number>>): RoleAccMkt {
  const out: RoleAccMkt = {}
  for (const r of Object.keys(ROLES_MKT)) {
    if (r === 'super_admin') continue
    const acc: Record<string, number> = {}
    for (const v of VIEW_KEYS_MKT) acc[v] = Number(draft[r]?.[v] ?? 0)
    if ((acc.dashboard ?? 0) < 1) acc.dashboard = 1
    out[r] = acc
  }
  return out
}

/** A per-person override to store (saveUserAccess): dashboard always at least "Lihat". */
export function simpanAksesUserMkt(draft: Record<string, number>): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const v of VIEW_KEYS_MKT) acc[v] = Number(draft[v] ?? 0)
  if ((acc.dashboard ?? 0) < 1) acc.dashboard = 1
  return acc
}
