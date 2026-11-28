// Konten — constants and pure rules, ported as-is from the old Panel.
//
// Source: laksamana-office/deploy/konten/index.html (line numbers below are
// that file's, 2026-10-07). Spec: docs/migrasi/konten.md (C, D, F).
//
// No API calls and no Vue here: screens and useKonten.ts import these. Field
// names are the stored ones (`title`, `publishDate`, `prod.shoot.date`, …).

// ---------------------------------------------------------------- roles & matrix
// Roles of the Panel itself, stored on its own crew rows (`users[].roles`).
// A crew member may hold several ("rangkap kerja"); the loosest level wins.
// Source: :955 ROLES, :981 PERM_*, :988 PERM_ROLES_LEGACY, :1015 VIEW_PERM, :1034 analytics/activity seed.

export const ROLES_KONTEN = {
  super_admin: { label: 'Super Admin', short: 'Nahkoda Agung', desc: 'Akses penuh semua modul, brand & pengaturan' },
  content_director: { label: 'Content Director', short: 'Direktur Konten', desc: 'Lihat semua brand, approval final, analytics lintas brand' },
  content_planner: { label: 'Content Planner', short: 'Perencana', desc: 'Buat planning, kelola calendar & bank ide' },
  account_manager: { label: 'Account Manager', short: 'AM', desc: 'Handle brand, input request, approval, deadline' },
  designer: { label: 'Designer', short: 'Desainer', desc: 'Design request, upload desain, revisi' },
  video_editor: { label: 'Video Editor', short: 'Editor', desc: 'Editing queue, upload video final' },
  photographer: { label: 'Fotografer / Videografer', short: 'Produksi', desc: 'Jadwal shooting, upload raw file' },
  ads_specialist: { label: 'Ads Specialist', short: 'Ads', desc: 'Kelola & pantau Meta/Google/TikTok Ads' },
  analyst: { label: 'Analyst', short: 'Analis', desc: 'Lihat analytics & susun laporan performa' },
} as const
export type RoleKonten = keyof typeof ROLES_KONTEN
export const ROLE_KEYS_KONTEN = Object.keys(ROLES_KONTEN) as RoleKonten[]

/** A crew member that is new to the Panel starts as planner (:975 KONTEN_DEFAULT_ROLES). */
export const ROLE_BAWAAN_KONTEN: RoleKonten[] = ['content_planner']

/** 0 = not visible, 1 = view, 2 = may edit (:981 PERM_NONE/VIEW/EDIT). */
export type LevelKonten = 0 | 1 | 2
export type PermsKonten = Record<string, Partial<Record<RoleKonten, number>>>

/** Who held each matrix row before levels existed (:988-1001). Listed = edit. */
const PERM_ROLES_KONTEN: Record<string, RoleKonten[]> = {
  brands: ['content_director', 'account_manager', 'content_planner'],
  content: ['content_director', 'content_planner', 'account_manager', 'designer', 'video_editor', 'photographer'],
  approve: ['content_director', 'account_manager'],
  assets: ['content_director', 'content_planner', 'designer', 'video_editor', 'photographer'],
  shooting: ['content_director', 'content_planner', 'photographer', 'account_manager'],
  design: ['content_director', 'designer', 'content_planner'],
  editing: ['content_director', 'video_editor', 'content_planner'],
  publish: ['content_director', 'account_manager', 'content_planner'],
  ads: ['content_director', 'ads_specialist', 'account_manager'],
  kol: ['content_director', 'account_manager', 'content_planner'],
  team: ['super_admin', 'content_director'],
  settings: ['super_admin'],
  // seeded separately in the old client (:1034-1038), same shape
  analytics: ['content_director', 'analyst', 'content_planner'],
  activity: ['content_director', 'analyst', 'content_planner'],
}

/**
 * The default matrix, used while `documents/perms` was never set (T-08 / U1).
 * Built fresh each call so a screen may edit it without touching the seed.
 */
export function permDefaultKonten(): PermsKonten {
  const p: PermsKonten = {}
  for (const [m, roles] of Object.entries(PERM_ROLES_KONTEN)) {
    p[m] = {}
    for (const r of ROLE_KEYS_KONTEN) p[m]![r] = roles.includes(r) ? 2 : 0
  }
  return p
}

/** Rows whose page was removed; kept in storage, hidden from the matrix (:4720). */
export const PERM_PENSIUN_KONTEN = ['bank', 'reports', 'ads']

/**
 * The stored matrix brought up to date, like the old boot did (:867-883):
 * a missing module gets its default; an OLD row stored as a list of roles
 * becomes edit for those roles (never silently locks anyone out); a missing
 * role in a row takes the default.
 */
export function permsKonten(stored: unknown): PermsKonten {
  const def = permDefaultKonten()
  if (!stored || typeof stored !== 'object' || !Object.keys(stored).length) return def
  const out: PermsKonten = { ...(stored as PermsKonten) }
  for (const m of Object.keys(def)) {
    const cur = (stored as Record<string, unknown>)[m]
    if (Array.isArray(cur)) {
      out[m] = Object.fromEntries(ROLE_KEYS_KONTEN.map(r => [r, cur.includes(r) ? 2 : 0]))
    }
    else if (!cur || typeof cur !== 'object') {
      out[m] = { ...def[m] }
    }
    else {
      const row: Partial<Record<RoleKonten, number>> = { ...(cur as Partial<Record<RoleKonten, number>>) }
      for (const r of ROLE_KEYS_KONTEN) if (typeof row[r] !== 'number') row[r] = def[m]![r] ?? 0
      out[m] = row
    }
  }
  return out
}

/** One role's level on one row (:1011 modPerm). super_admin is always edit. */
export function modPermKonten(perms: PermsKonten, m: string, role: string): LevelKonten {
  if (role === 'super_admin') return 2
  const v = perms[m]?.[role as RoleKonten]
  return (typeof v === 'number' ? Math.max(0, Math.min(2, v)) : 0) as LevelKonten
}

/** The LOOSEST level among all of a crew member's roles (:1396 userModPerm). */
export const levelKonten = (perms: PermsKonten, roles: string[], m: string): LevelKonten =>
  Math.max(0, ...roles.map(r => modPermKonten(perms, m, r))) as LevelKonten

/** Screen → matrix row (:1015-1032 VIEW_PERM). Screens not listed are open to everyone. */
export const VIEW_PERM_KONTEN: Record<string, string> = {
  brands: 'brands',
  planning: 'content', pipeline: 'content', calendar: 'content',
  approval: 'approve', assets: 'assets',
  shooting: 'shooting', design: 'design', editing: 'editing',
  publishing: 'publish', analytics: 'analytics',
  perfinput: 'analytics', designperf: 'analytics',
  ads: 'ads', chats: 'ads', kol: 'kol',
  activity: 'activity', settings: 'settings',
  insight: 'analytics', riset: 'analytics', bank: 'analytics',
  kalender: 'content', sosmed: 'settings',
}

// ---------------------------------------------------------------- content
// Source: :1040-1210.

/** Pipeline order (:1046). `Draft` and `Cancelled` are statuses but not steps. */
export const PIPELINE_KONTEN = ['Idea', 'Research', 'Script', 'Design', 'Shooting', 'Editing', 'Revision', 'Approval', 'Scheduled', 'Posted'] as const
export const STATUS_KONTEN = ['Idea', 'Research', 'Draft', 'Script', 'Design', 'Shooting', 'Editing', 'Revision', 'Approval', 'Scheduled', 'Posted', 'Cancelled'] as const

/** Done statuses — ONE list for the archive filter and every counter (:1882, F.1). */
export const STATUS_ARSIP = ['Posted', 'Cancelled']
export const sudahArsip = (c: { status?: string }) => STATUS_ARSIP.includes(c.status ?? '')

/** Platform codes (:1047-1051); old rows used long names (:1053 PLATFORM_ALIAS). */
export const PLATFORM_KONTEN = ['IG', 'TT', 'YT', 'FB', 'Website', 'Threads', 'Google'] as const
const PLATFORM_ALIAS: Record<string, string> = { 'Instagram': 'IG', 'TikTok': 'TT', 'YouTube': 'YT', 'Facebook': 'FB', 'Google Business': 'Google', 'Google Bisnis': 'Google' }
export const normPlatform = (p: unknown) => {
  const s = String(p ?? '').trim()
  return PLATFORM_ALIAS[s] ?? s
}

export const PILLARS = ['Product & Menu', 'Promotion', 'Event', 'Entertainment', 'Education', 'Lifestyle', 'BTS', 'Corporate', 'Community', 'Information'] as const
export const CONTENT_TYPES = ['Reel', 'Feed / Carousel', 'Story', 'Single Image', 'Video Long', 'Short/Shorts', 'Live', 'Article', 'Thread', 'Videotron'] as const
/** Print size notes, shown under the choice in the form (:1188-1198). */
export const PRINT_TYPES: Record<string, string> = {
  'A4': '21 × 29,7 cm (210 × 297 mm)',
  'A5': '14,8 × 21 cm (148 × 210 mm)',
  'A6': '10,5 × 14,8 cm (105 × 148 mm)',
  'X Banner': '60 × 160 cm - rangka X standar',
  'Voucher': '9 × 5,5 cm - seukuran kartu nama',
  'Menu': '21 × 29,7 cm (A4) - bisa dibuat 2 muka',
  'Gelang': '25 × 2,5 cm - gelang tiket/entry',
  'Tiket': '15 × 5 cm - termasuk sobekan stub',
  'Spanduk': '300 × 100 cm - flexi outdoor',
}

/** Priority, with its weight for sorting (:1184). */
export const PRIORITY_KONTEN: Record<string, { label: string, n: number }> = {
  urgent: { label: 'Urgent', n: 4 },
  high: { label: 'Tinggi', n: 3 },
  medium: { label: 'Sedang', n: 2 },
  low: { label: 'Rendah', n: 1 },
}

/** Production needs a content item can carry (:1202-1206). */
export const PROD_TYPES = {
  shoot: { label: 'Rekam Video', short: 'Shoot', view: 'shooting' },
  design: { label: 'Desain', short: 'Design', view: 'design' },
  edit: { label: 'Editing', short: 'Editing', view: 'editing' },
} as const
export type ProdKind = keyof typeof PROD_TYPES
export const PROD_KINDS = Object.keys(PROD_TYPES) as ProdKind[]

/** Days before publishing each need is due (:2179 PROD_OFFSET). */
export const PROD_OFFSET: Record<ProdKind, number> = { shoot: 5, design: 4, edit: 2 }

/** "Dekat" for the Tugas Saya card, in days (:1759). */
export const DEADLINE_DEKAT = 3

/** Visit (KOL) statuses (:1221-1227). */
export const VISIT_STATUS: Record<string, { label: string }> = {
  planned: { label: 'Direncanakan' },
  confirmed: { label: 'Terkonfirmasi' },
  came: { label: 'Hadir / Datang' },
  noshow: { label: 'Tidak Hadir' },
  done: { label: 'Selesai' },
}

// ---------------------------------------------------------------- record shapes

export interface ProdNeed { date?: string, status?: string, doneAt?: number }
export interface RefKonten { t: 'link' | 'img', v?: string, n?: string, dipangkas?: boolean }
export interface Approval { stage?: string, by?: string, ok?: boolean, at?: number }
export interface Komentar { by?: string, at?: number, text?: string, mentions?: string[] }

export interface KontenItem {
  id: string
  title?: string
  brand?: string
  campaign?: string
  platform?: string
  platforms?: string[]
  pillar?: string
  contentType?: string
  contentTypes?: string[]
  printType?: string
  printTypes?: string[]
  detail?: string
  // legacy text fields, read when `detail` is empty, never overwritten (F.28)
  keyword?: string
  caption?: string
  hashtags?: string[]
  script?: string
  refs?: RefKonten[]
  pic?: string
  priority?: string
  status?: string
  deadline?: string
  publishDate?: string
  publishTime?: string
  prod?: Partial<Record<ProdKind, ProdNeed>>
  checklist?: { t: string, done?: boolean }[]
  approvals?: Approval[]
  comments?: Komentar[]
  revisions?: { at?: number, by?: string, note?: string }[]
  publishRecord?: { platform?: string, platforms?: string[], url?: string, at?: number, pic?: string }
  perf?: Record<string, Record<string, unknown>>
  metrics?: Record<string, number>
  createdAt?: number
  createdBy?: string
  updatedAt?: number
}

export interface ProdTask {
  id: string
  kind: ProdKind
  title?: string
  brand?: string
  priority?: string
  pic?: string
  date?: string
  note?: string
  status?: string
  doneAt?: number
  updatedAt?: number
  /** Linked KontenItem id; lives in the free task JSON blob, no server-side filter. */
  contentId?: string
}

export interface UserKonten {
  id: string
  name: string
  roles?: string[]
  division?: string
  email?: string
  capacity?: number
  workHours?: string
  avail?: string
  skills?: string[]
  active?: boolean
  updatedAt?: number
}

export interface BrandKonten {
  id: string
  name: string
  color?: string
  desc?: string
  pic?: string
  pillars?: string[]
  /** platform accounts as the old records store them: {p, user, followers, target} */
  platforms?: { p?: string, user?: string, followers?: number, target?: number }[]
  website?: string
  audience?: string
  tone?: string
  kpiReach?: number
  kpiFollowers?: number
  freq?: string
  hashtags?: string[]
  updatedAt?: number
}

export interface VisitKonten {
  id: string
  title?: string
  date?: string
  time?: string
  brand?: string
  status?: string
  invitees?: string[]
  kolId?: string
  updatedAt?: number
}

export interface ShootingKonten { id: string, title?: string, date?: string, time?: string, brand?: string, contentId?: string, updatedAt?: number }

// ---------------------------------------------------------------- readers

/** Multi-platform: `platforms` is the truth, `platform` the old single value (:1057-1062, F.27). */
export function contentPlatforms(c?: KontenItem | null): string[] {
  if (!c) return []
  const list = (c.platforms?.length ? c.platforms : (c.platform ? [c.platform] : [])).map(normPlatform)
  return [...new Set(list.filter(Boolean))]
}
export function contentTypes(c?: KontenItem | null): string[] {
  if (!c) return []
  return [...new Set((c.contentTypes?.length ? c.contentTypes : (c.contentType ? [c.contentType] : [])).filter(Boolean))]
}
export function printTypes(c?: KontenItem | null): string[] {
  if (!c) return []
  return [...new Set((c.printTypes?.length ? c.printTypes : (c.printType ? [c.printType] : [])).filter(Boolean))]
}
export const contentTypeLabel = (c?: KontenItem | null) => contentTypes(c).join(' + ') || '-'
export const contentRefs = (c?: KontenItem | null): RefKonten[] => (Array.isArray(c?.refs) ? c!.refs! : [])

/**
 * Detailing, one field. Read BOTH ways (:1111-1121, F.28): when `detail` is
 * empty, the four old fields are put back together with their headings, so an
 * old item shows its text whole and can be edited straight away.
 */
export function contentDetail(c?: KontenItem | null): string {
  if (!c) return ''
  if (c.detail) return c.detail
  const p: string[] = []
  if (c.keyword) p.push(`Keyword: ${c.keyword}`)
  if (c.caption) p.push(`Caption:\n${c.caption}`)
  if (c.hashtags?.length) p.push(`Hashtag: ${c.hashtags.join(' ')}`)
  if (c.script) p.push(`Script / Storyboard:\n${c.script}`)
  return p.join('\n\n')
}

// ---------------------------------------------------------------- dates

/** Local `YYYY-MM-DD` → days from today (negative = past). Null when empty (:1302 daysDiff). */
export function sisaHariKonten(tgl?: string, kini = new Date()): number | null {
  if (!tgl) return null
  const a = new Date(`${tgl.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(a.getTime())) return null
  const b = new Date(kini)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 864e5)
}

/** "Hari ini / Besok / H-3" — only for dates not yet past; a past date is just red (:1303-1316). */
export function relHariKonten(tgl?: string, kini?: Date): string {
  const n = sisaHariKonten(tgl, kini)
  if (n == null || n < 0) return ''
  if (n === 0) return 'Hari ini'
  if (n === 1) return 'Besok'
  return `H-${n}`
}
export const lewatTenggat = (tgl?: string, selesai?: boolean, kini?: Date) => {
  if (selesai || !tgl) return false
  const n = sisaHariKonten(tgl, kini)
  return n != null && n < 0
}

// ---------------------------------------------------------------- PIC filter

/** "Belum ada PIC" is `__none__`, not '' (which already means all) (F.13, :2518). */
export const PIC_KOSONG = '__none__'
export const picCocok = (pilih: string, pic?: string) => !pilih || (pilih === PIC_KOSONG ? !pic : pic === pilih)

// ---------------------------------------------------------------- Tugas Saya

export interface TugasSaya {
  jenis: 'konten' | 'prod' | 'mandiri'
  kind?: ProdKind
  title: string
  brand?: string
  deadline?: string
  status?: string
  /** Content id (konten / prod) or task id (mandiri). */
  ref: string
  sisa: number | null
}

/**
 * My open work from THREE sources (:1760-1794, F.12): content I am PIC of,
 * its open production needs (the PIC of a need is the content's PIC), and my
 * own standalone tasks. Most overdue first; no deadline last — dropping those
 * would hide a task someone forgot to date.
 */
export function tugasSaya(saya: string, content: KontenItem[], tasks: ProdTask[], kini?: Date): TugasSaya[] {
  const out: TugasSaya[] = []
  for (const c of content) {
    if (c.pic !== saya) continue
    if (!sudahArsip(c)) out.push({ jenis: 'konten', title: c.title || '(tanpa judul)', brand: c.brand, deadline: c.deadline, status: c.status, ref: c.id, sisa: null })
    for (const k of PROD_KINDS) {
      const t = c.prod?.[k]
      if (!t || t.status === 'done') continue
      out.push({ jenis: 'prod', kind: k, title: `${PROD_TYPES[k].short}: ${c.title || '(tanpa judul)'}`, brand: c.brand, deadline: t.date, ref: c.id, sisa: null })
    }
  }
  for (const t of tasks) {
    if (t.pic !== saya || t.status === 'done') continue
    out.push({ jenis: 'mandiri', kind: t.kind, title: t.title || '(tanpa judul)', brand: t.brand, deadline: t.date, ref: t.id, sisa: null })
  }
  for (const x of out) x.sisa = sisaHariKonten(x.deadline, kini)
  return out.sort((a, b) => (a.sisa == null ? (b.sisa == null ? 0 : 1) : b.sisa == null ? -1 : a.sisa - b.sisa))
}

// ---------------------------------------------------------------- calendar events

export interface AcaraKalender {
  date: string
  type: 'publish' | ProdKind | 'visit'
  title: string
  label: string
  time: string
  done?: boolean
  cid?: string
  tid?: string
  sid?: string
  vid?: string
  kind?: ProdKind
}

export interface SumberKalender {
  content: KontenItem[]
  prodTasks: ProdTask[]
  shootings: ShootingKonten[]
  visits: VisitKonten[]
  /** Visit label: its title, else the first invitee's name (:3579 visitLabel). */
  namaKol?: (id: string) => string
}

export type FilterKalender = Record<'publish' | ProdKind | 'visit', boolean>

/**
 * Every dated thing on one calendar (:2574-2607): publishing (not Cancelled),
 * production needs inside content, shootings NOT linked to content (linked ones
 * already come in through `prod.shoot`), standalone tasks, and KOL visits.
 * Lists are assumed already filtered by brand.
 */
export function acaraKalender(s: SumberKalender, f: FilterKalender): AcaraKalender[] {
  const ev: AcaraKalender[] = []
  for (const c of s.content) {
    if (f.publish && c.publishDate && c.status !== 'Cancelled') {
      ev.push({ date: c.publishDate, type: 'publish', title: c.title || '', cid: c.id, time: c.publishTime || '', label: 'Tayang' })
    }
    for (const k of PROD_KINDS) {
      const p = c.prod?.[k]
      if (f[k] && p?.date) ev.push({ date: p.date, type: k, title: c.title || '', cid: c.id, time: '', label: PROD_TYPES[k].short, done: p.status === 'done' })
    }
  }
  if (f.shoot) {
    for (const x of s.shootings) {
      if (x.contentId || !x.date) continue
      ev.push({ date: x.date, type: 'shoot', title: x.title || 'Shooting', sid: x.id, time: x.time || '', label: 'Shoot' })
    }
  }
  for (const x of s.prodTasks) {
    if (!f[x.kind] || !x.date) continue
    ev.push({ date: x.date, type: x.kind, title: x.title || '', tid: x.id, kind: x.kind, time: '', label: PROD_TYPES[x.kind]?.short ?? x.kind, done: x.status === 'done' })
  }
  if (f.visit) {
    for (const v of s.visits) {
      if (!v.date) continue
      const inv = v.invitees?.length ? v.invitees : (v.kolId ? [v.kolId] : [])
      const nama = v.title || inv.map(id => s.namaKol?.(id) ?? '').find(n => n && n !== '-') || 'Event'
      ev.push({ date: v.date, type: 'visit', title: nama + (inv.length ? ` - ${inv.length} undangan` : ''), vid: v.id, time: v.time || '', label: 'Kunjungan', done: v.status === 'came' || v.status === 'done' })
    }
  }
  return ev
}

// ---------------------------------------------------------------- Content Planning

export interface FilterPlanning { arsip: 'aktif' | 'arsip' | '', status: string, platform: string, pillar: string, pic: string, q: string }
/** Reset goes back to ACTIVE, not to everything (F.3, :1924 planReset). */
export const filterPlanningBawaan = (): FilterPlanning => ({ arsip: 'aktif', status: '', platform: '', pillar: '', pic: '', q: '' })

/**
 * Planning list (:1936-1953 filteredContent). The archive filter is SKIPPED
 * when the chosen status is itself an archive status (F.2) — otherwise picking
 * "Posted" returns an empty table that reads as "nothing published yet".
 * Search covers title + detailing; sorted by deadline, undated last.
 * `tanpaPic` = every filter except the PIC one, for the PIC option counts (F.13).
 */
export function saringPlanning(list: KontenItem[], f: FilterPlanning, tanpaPic = false): KontenItem[] {
  let out = list
  if (f.arsip && !(f.status && STATUS_ARSIP.includes(f.status))) {
    out = f.arsip === 'arsip' ? out.filter(sudahArsip) : out.filter(c => !sudahArsip(c))
  }
  if (f.status) out = out.filter(c => c.status === f.status)
  if (f.platform) out = out.filter(c => contentPlatforms(c).includes(f.platform))
  if (f.pillar) out = out.filter(c => c.pillar === f.pillar)
  if (f.pic && !tanpaPic) out = out.filter(c => picCocok(f.pic, c.pic))
  if (f.q) {
    const q = f.q.toLowerCase()
    out = out.filter(c => `${c.title} ${contentDetail(c)}`.toLowerCase().includes(q))
  }
  return [...out].sort((a, b) => (a.deadline || '2099').localeCompare(b.deadline || '2099'))
}

/**
 * PIC choices with counts (:2499-2516 picOptions): "Semua PIC", then "Punya
 * saya" on top when I hold something, then only the people who hold anything,
 * then "Belum ada PIC" (__none__) when some rows have none. `hitung(id)` counts
 * rows under every OTHER filter; null = all.
 */
export function opsiPicKonten(users: { id: string, name: string }[], hitung: (id: string | null) => number, saya?: string) {
  const n = (v: number) => (v ? ` (${v})` : '')
  const out: { label: string, value: string }[] = [{ label: `Semua PIC${n(hitung(null))}`, value: '' }]
  if (saya && hitung(saya)) out.push({ label: `Punya saya${n(hitung(saya))}`, value: saya })
  for (const u of users) if (hitung(u.id) > 0) out.push({ label: `${u.name}${n(hitung(u.id))}`, value: u.id })
  if (hitung(PIC_KOSONG)) out.push({ label: `Belum ada PIC${n(hitung(PIC_KOSONG))}`, value: PIC_KOSONG })
  return out
}

// ---------------------------------------------------------------- detail & form

/** Crew mentioned in a comment: "@<full name>" (:2370 mentionedUsers). */
export const kruDisebut = <T extends { id: string, name?: string }>(users: T[], text: string) =>
  users.filter(u => u.name && text.includes(`@${u.name}`))

/** Split a comment into text and @mentions, longest name first so "Budi Santoso" beats "Budi" (:2372-2383). */
export function potongMention(text: string, names: string[]): { t: string, mention: boolean }[] {
  const urut = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!urut.length) return [{ t: text, mention: false }]
  const rx = new RegExp(`@(${urut.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const out: { t: string, mention: boolean }[] = []
  let last = 0
  for (let m = rx.exec(text); m; m = rx.exec(text)) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), mention: false })
    out.push({ t: m[0], mention: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: text.slice(last), mention: false })
  return out
}

/** Local date + n days as YYYY-MM-DD (no UTC shift). */
export function geserTanggal(tgl: string, n: number): string {
  const d = new Date(`${tgl}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Recommended due date of a production need (:2181-2188): publish date minus
 * the need's offset; without a publish date, today + (7 - offset).
 */
export const rekomTglProduksi = (k: ProdKind, publishDate: string, hariIni: string) =>
  (publishDate ? geserTanggal(publishDate, -PROD_OFFSET[k]) : geserTanggal(hariIni, 7 - PROD_OFFSET[k]))

/** Print size note for the ticked print types (:2069-2073 printHintText). */
export const catatanCetak = (list: string[]) =>
  (list.length ? list.map(r => `${r}: ${PRINT_TYPES[r] ?? 'ukuran belum tercatat'}`).join('  •  ') : 'Centang jenis cetakan bila konten ini perlu dicetak.')

/** A link reference gets https:// when it has no scheme, else href reads it as a relative path (:2091-2095). */
export function rapikanLink(v: string): string {
  const s = v.trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) || /^mailto:/i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`
}

/** Next/previous pipeline status; null at the ends or for a status outside the pipeline (:2445 moveStatus). */
export function statusGeser(status: string | undefined, arah: 1 | -1): string | null {
  const i = PIPELINE_KONTEN.indexOf(status as typeof PIPELINE_KONTEN[number])
  if (i < 0) return null
  return PIPELINE_KONTEN[i + arah] ?? null
}

/**
 * Production needs to store on save (:2202-2236): the ticked ones with their
 * date, keeping the existing todo/done state so editing never resets work.
 */
export function prodSimpan(dicentang: Partial<Record<ProdKind, string>>, lama?: KontenItem['prod']): KontenItem['prod'] {
  const out: NonNullable<KontenItem['prod']> = {}
  for (const k of PROD_KINDS) {
    if (dicentang[k] === undefined) continue
    out[k] = { date: dicentang[k] ?? '', status: lama?.[k]?.status || 'todo' }
  }
  return out
}

// ---------------------------------------------------------------- production queues (#48)
// Source: prodRows / queueSortVal / reqMktUntuk / kirimOpsiMkt, :2924-3210.

export const printTypeLabel = (c?: KontenItem | null) => printTypes(c).join(' + ')

/** One Marketing design/video request as `GET /marketing/design-queue` sends it (field names as the API). */
export interface ReqDesainMkt {
  id: string
  jenis: 'design' | 'edit'
  judul?: string
  brief?: string
  acara?: string
  deadline?: string
  prioritas?: string
  pemohon?: string
  brand?: string
  brandNama?: string
  platforms?: string[]
  picMinta?: string
  picId?: string
  nRef?: number
  status?: string
  /** who finished it and when (ISO UTC) — read by Performa Desain */
  pic?: string
  doneAt?: string
}

/** One row of a queue: a content's production need, a standalone task, or a Marketing request. */
export interface BarisAntrian {
  src: 'content' | 'task' | 'mkt'
  /** content id / task id / request id */
  id: string
  title: string
  sub: string
  brand?: string
  platforms: string[]
  pic?: string
  priority: string
  date?: string
  done: boolean
  /** Linked KontenItem id, carried from the task; only `task` rows have it. */
  contentId?: string
}

/**
 * Marketing requests as queue rows (reqMktUntuk, :3060-3084): design/edit only;
 * brand and PIC kept only when they exist here, otherwise named in the subline.
 */
export function reqMktUntuk(kind: ProdKind, reqs: ReqDesainMkt[], brands: BrandKonten[], users: UserKonten[]): BarisAntrian[] {
  if (kind !== 'design' && kind !== 'edit') return []
  return reqs.filter(r => r?.jenis === kind).map((r) => {
    const adaBrand = brands.some(b => b.id === r.brand)
    const adaPic = users.some(u => u.id === r.picId)
    const ket = ['Request Marketing']
    if (r.acara) ket.push(r.acara)
    if (r.brandNama && !adaBrand) ket.push(r.brandNama)
    if (r.picMinta) ket.push(`diminta: ${r.picMinta}`)
    if (r.pemohon) ket.push(`oleh ${r.pemohon}`)
    if (r.nRef) ket.push(`${r.nRef} referensi`)
    return {
      src: 'mkt' as const, id: r.id, title: r.judul || '(tanpa judul)', sub: ket.join(' · '),
      brand: adaBrand ? r.brand : '', platforms: Array.isArray(r.platforms) ? r.platforms.map(normPlatform).filter(Boolean) : [],
      pic: adaPic ? r.picId : '', priority: r.prioritas && PRIORITY_KONTEN[r.prioritas] ? r.prioritas : 'medium',
      date: r.deadline || '', done: false,
    }
  })
}

/**
 * Every row of a queue before filtering (prodRows, :3172-3187): content needs
 * and standalone tasks follow the brand bar; Marketing requests do not.
 */
export function barisAntrian(kind: ProdKind, content: KontenItem[], tasks: ProdTask[], mkt: BarisAntrian[]): BarisAntrian[] {
  const dariKonten = content.filter(c => c.prod?.[kind]).map(c => ({
    src: 'content' as const, id: c.id, title: c.title || '', sub: contentTypeLabel(c) + (printTypeLabel(c) ? ` - cetak ${printTypeLabel(c)}` : ''),
    brand: c.brand, platforms: contentPlatforms(c), pic: c.pic, priority: c.priority || 'medium',
    date: c.prod![kind]!.date, done: c.prod![kind]!.status === 'done',
  }))
  const mandiri = tasks.filter(x => x.kind === kind).map(x => ({
    src: 'task' as const, id: x.id, title: x.title || '', sub: x.note || 'Tugas mandiri', brand: x.brand, platforms: [],
    pic: x.pic, priority: x.priority || 'medium', date: x.date, done: x.status === 'done',
    contentId: x.contentId,
  }))
  return [...dariKonten, ...mandiri, ...mkt]
}

/**
 * Title of the content a task links to, for the queue badges. Found by id in
 * the already loaded content list; a deleted link never crashes — it shows a
 * short-id fallback so the row still reads as linked.
 */
export function judulKonten(list: KontenItem[], id?: string): string {
  if (!id) return ''
  const c = list.find(x => x.id === id)
  if (c) return c.title || '(tanpa judul)'
  return `Konten tidak ditemukan (${id.slice(0, 8)})`
}

/** Queue filter; default hides the archive (QUEUE_BAWAAN, :2924). Reset returns here (F.3). */
export interface FilterAntrian { q: string, status: 'todo' | 'done' | '', priority: string, sort: string, dir: 1 | -1 }
export const filterAntrianBawaan = (): FilterAntrian => ({ q: '', status: 'todo', priority: '', sort: 'date', dir: 1 })

/**
 * Filter + sort (prodRows :3189-3196, queueSortVal :2940-2950): search title +
 * subline; ties fall back to priority (high first) then date.
 */
export function saringAntrian(rows: BarisAntrian[], f: FilterAntrian, namaBrand: (id?: string) => string, namaUser: (id?: string) => string): BarisAntrian[] {
  const prio = (p: string) => PRIORITY_KONTEN[p]?.n ?? 0
  const ms = (d?: string) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY)
  const nilai = (r: BarisAntrian): number | string => {
    switch (f.sort) {
      case 'priority': return prio(r.priority)
      case 'title': return r.title.toLowerCase()
      case 'brand': return namaBrand(r.brand).toLowerCase()
      case 'pic': return namaUser(r.pic).toLowerCase()
      case 'status': return r.done ? 1 : 0
      default: return ms(r.date)
    }
  }
  const q = f.q.toLowerCase()
  let list = rows
  if (q) list = list.filter(r => (r.title + r.sub).toLowerCase().includes(q))
  if (f.status) list = list.filter(r => (f.status === 'done' ? r.done : !r.done))
  if (f.priority) list = list.filter(r => r.priority === f.priority)
  return list.slice().sort((a, b) => {
    const va = nilai(a)
    const vb = nilai(b)
    if (va < vb) return -f.dir
    if (va > vb) return f.dir
    return (prio(b.priority) - prio(a.priority)) || (ms(a.date || '2099') - ms(b.date || '2099'))
  })
}

/**
 * What Konten lends Marketing for its request form, once per session
 * (kirimOpsiMkt, :3031-3056; T-07): brands, active crew (production roles
 * first) and the platform codes.
 */
export function opsiDesainMkt(brands: BrandKonten[], users: UserKonten[]) {
  const peranProd = ['designer', 'video_editor', 'photographer', 'content_director', 'content_planner']
  const pics = users.filter(u => u?.id && u.active !== false).map(u => ({
    id: u.id, name: u.name || '',
    peran: (u.roles ?? []).map(r => (ROLES_KONTEN as Record<string, { short: string }>)[r]?.short ?? r).join(' + '),
    prod: (u.roles ?? []).some(r => peranProd.includes(r)) ? 1 : 0,
  })).sort((a, b) => (b.prod - a.prod) || a.name.localeCompare(b.name))
  return { brands: brands.map(b => ({ id: b.id, name: b.name || '' })), pics, platforms: [...PLATFORM_KONTEN] }
}

// ---------------------------------------------------------------- assets (#48)
// Source: VIEWS.assets / openAssetForm / saveAsset, :4267-4305. Links only:
// the old client never uploaded files here (konten.md E).

export const KATEGORI_ASSET = ['Photo', 'Video', 'RAW', 'Edited', 'Logo', 'Font', 'Music', 'Motion Template', 'PSD', 'AI', 'Canva']
export interface AssetKonten {
  id: string
  name: string
  category?: string
  brand?: string
  version?: string
  tags?: string[]
  link?: string
  by?: string
  at?: number
  updatedAt?: number
}
/** "a, b ,, c" → ['a','b','c'] (tags field). */
export const pisahKoma = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

/** "baru saja" / "5m lalu" / "3j lalu" / "2h lalu" (timeAgo, :1321). */
export function lamaKonten(ts?: number, kini = Date.now()): string {
  if (!ts) return ''
  const s = (kini - ts) / 1000
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`
  return `${Math.floor(s / 86400)}h lalu`
}
