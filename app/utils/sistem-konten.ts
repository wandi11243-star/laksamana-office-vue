// Konten › Sistem: Brand Management, Activity Log, Pengaturan (crew, role
// matrix, exports), Profil — the pure rules. Source: laksamana-office/deploy/
// konten/index.html (brands :2693-2745, crew :2779-2900, roster :1489-1520,
// settings & exports :4628-4800); konten.md D.17–D.20, F.23–F.26, F.31.
import type { BrandKonten, KontenItem, PermsKonten, UserKonten } from '~/utils/konten'
import { PERM_PENSIUN_KONTEN, ROLES_KONTEN, ROLE_BAWAAN_KONTEN, ROLE_KEYS_KONTEN, contentPlatforms, contentTypeLabel, printTypeLabel } from '~/utils/konten'
import { pkBarisKonten, pkCTR, pkER, pkEngagement, pkViral } from '~/utils/performa-konten'
import { csvSel } from '~/utils/promosi-konten'

// ---------------------------------------------------------------- brands

/** One platform account of a brand, as the old records store it. */
export interface PlatformBrand { p?: string, user?: string, followers?: number, target?: number }

/** "KONTEN / TAYANG / FOLLOWERS / KE TARGET" of a brand card. */
export function statBrand(b: BrandKonten, content: KontenItem[]) {
  const milik = content.filter(c => c.brand === b.id)
  const plats = (b.platforms ?? []) as PlatformBrand[]
  const followers = plats.reduce((s, p) => s + (Number(p.followers) || 0), 0)
  const target = plats.reduce((s, p) => s + (Number(p.target) || 0), 0)
  return {
    konten: milik.length,
    tayang: milik.filter(c => c.status === 'Posted').length,
    followers,
    target,
    // old pct(): 0 when there is no target
    keTarget: target ? Math.round((followers / target) * 100) : 0,
  }
}

// ---------------------------------------------------------------- crew

export const rolesKru = (u?: UserKonten | null) => (u?.roles ?? []).filter(r => r in ROLES_KONTEN)
export const labelRole = (r: string) => (ROLES_KONTEN as Record<string, { label: string }>)[r]?.label ?? r
export const shortRole = (r: string) => (ROLES_KONTEN as Record<string, { short: string }>)[r]?.short ?? r

export interface FilterKru { q: string, role: string }
export const filterKruBawaan = (): FilterKru => ({ q: '', role: '' })

/** Sorted by name; search name + division + email (skills no longer shown, so not searched). */
export function saringKru(users: UserKonten[], f: FilterKru): UserKonten[] {
  let out = users.slice().sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
  if (f.role) out = out.filter(u => rolesKru(u).includes(f.role))
  const q = f.q.trim().toLowerCase()
  if (q) out = out.filter(u => `${u.name ?? ''} ${u.division ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q))
  return out
}
/** Holders per role, counted WITHOUT the role filter itself (else unchosen roles read 0). */
export const hitungRoleKru = (users: UserKonten[], r: string) => users.filter(u => rolesKru(u).includes(r)).length

export interface MemberOffice { id: string, name?: string, isModuleAdmin?: boolean, active?: boolean }
/**
 * What the Office roster of `konten` means for the crew rows (old
 * autoSyncOfficeRoster): a member with no row gets one (planner, or
 * super_admin for a module admin); a known row follows the Office name and
 * gains super_admin when the person became module admin. Rows matched only by
 * NAME but stored under an old id are reported — moving an id means deleting
 * and recreating a row, which is not done automatically.
 */
export function rencanaSinkronKru(members: MemberOffice[], users: UserKonten[]) {
  const baru: UserKonten[] = []
  const ubah: { u: UserKonten, fields: Partial<UserKonten> }[] = []
  const kembar: { u: UserKonten, officeId: string }[] = []
  for (const m of members) {
    if (!m?.id) continue
    const nama = String(m.name ?? '').toLowerCase()
    const u = users.find(x => x.id === m.id) ?? users.find(x => String(x.name ?? '').toLowerCase() === nama)
    if (!u) {
      baru.push({
        id: m.id, name: m.name || '(tanpa nama)', roles: m.isModuleAdmin ? ['super_admin'] : [...ROLE_BAWAAN_KONTEN],
        division: '', email: '', skills: [], capacity: 20, workHours: 'Fleksibel', avail: 'available', active: m.active !== false,
      })
      continue
    }
    if (u.id !== m.id) kembar.push({ u, officeId: m.id })
    const fields: Partial<UserKonten> = {}
    if (m.name && u.name !== m.name) fields.name = m.name
    if (m.isModuleAdmin && !(u.roles ?? []).includes('super_admin')) fields.roles = ['super_admin', ...(u.roles ?? [])]
    if (Object.keys(fields).length) ubah.push({ u, fields })
  }
  return { baru, ubah, kembar }
}

// ---------------------------------------------------------------- role matrix

/** Matrix labels (old MODULE_LABELS). */
export const LABEL_MODUL_KONTEN: Record<string, string> = {
  brands: 'Brand', content: 'Konten', approve: 'Approval', assets: 'Aset', shooting: 'Shooting', design: 'Design', editing: 'Editing',
  publish: 'Publishing', ads: 'Ads Management', kol: 'KOL & Medpar Management', team: 'Tim', analytics: 'Analytics', activity: 'Log Activity',
  settings: 'Pengaturan',
}
export const LEVEL_KONTEN = ['None', 'Lihat', 'Ubah'] as const
export const LEVEL_PANJANG = ['Tak Terlihat', 'Lihat', 'Boleh Ubah'] as const

/** Matrix rows shown: every stored row except retired pages (bank, reports stay stored). */
export const modulMatriks = (perms: PermsKonten) => Object.keys(perms).filter(m => !PERM_PENSIUN_KONTEN.includes(m))
/** The roles a super admin may edit (super_admin is always full). */
export const ROLE_MATRIKS = ROLE_KEYS_KONTEN.filter(r => r !== 'super_admin')
export const siklusLevel = (v: number) => ((Number(v) || 0) + 1) % 3

/**
 * The matrix to store (old savePerms): every shown row × every role, super_admin
 * written as edit; retired rows kept as they were stored.
 */
export function permSimpan(perms: PermsKonten, draf: Record<string, Record<string, number>>): PermsKonten {
  const out: PermsKonten = {}
  for (const [m, row] of Object.entries(perms)) {
    if (PERM_PENSIUN_KONTEN.includes(m)) {
      out[m] = { ...row }
      continue
    }
    const baru: Record<string, number> = {}
    for (const r of ROLE_KEYS_KONTEN) baru[r] = r === 'super_admin' ? 2 : (draf[m]?.[r] ?? row[r] ?? 0)
    out[m] = baru
  }
  return out
}

// ---------------------------------------------------------------- exports (CSV)

const csv = (rows: (string | number | undefined | null)[][]) => rows.map(r => r.map(csvSel).join(',')).join('\n')

export function csvKonten(content: KontenItem[], namaBrand: (id?: string) => string, namaUser: (id?: string) => string) {
  return csv([
    ['Judul', 'Brand', 'Platform', 'Pillar', 'Tipe', 'Print Type', 'PIC', 'Status', 'Prioritas', 'Deadline', 'Tayang'],
    ...content.map(c => [c.title, namaBrand(c.brand), contentPlatforms(c).join(' + '), c.pillar, contentTypeLabel(c), printTypeLabel(c), namaUser(c.pic), c.status, c.priority, c.deadline, c.publishDate]),
  ])
}

/** ONE ROW PER PLATFORM; ratios from performa-konten.ts, the same as the screen. */
export function csvPerforma(content: KontenItem[], namaBrand: (id?: string) => string) {
  const p1 = (v: number | null) => (v == null ? '' : Math.round(v * 10) / 10)
  const rows: (string | number | undefined)[][] = [['Judul', 'Brand', 'Platform', 'Content Pillar', 'Tayang', 'Reach', 'Impression', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Klik CTA', 'Follower Baru', 'Engagement', 'ER%', 'Virality%', 'CTA%']]
  for (const c of content) {
    for (const r of pkBarisKonten(c)) {
      const m = r.m
      rows.push([c.title, namaBrand(c.brand), r.plat, c.pillar ?? '', String(c.publishRecord?.at || c.publishDate || ''),
        m.reach, m.impr, m.views, m.likes, m.comments, m.shares, m.saves, m.cta, m.follow, pkEngagement(m), p1(pkER(m)), p1(pkViral(m)), p1(pkCTR(m))])
    }
  }
  return csv(rows)
}

export function csvTim(users: UserKonten[]) {
  return csv([
    ['Nama', 'Divisi', 'Role', 'Kapasitas', 'Skill', 'Email'],
    ...users.map(u => [u.name, u.division, rolesKru(u).map(labelRole).join(' - '), u.capacity, (u.skills ?? []).join('; '), u.email]),
  ])
}
