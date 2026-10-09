// Marketing — constants, record shapes, the in-module access matrix and the
// small readers every screen shares. Pure: no API, no Vue.
//
// Source: laksamana-office deploy/marketing/index.html (line numbers below),
// docs/migrasi/marketing.md B, C, F. Money rules live in marketing-uang.ts.
//
// Field names are the old app's (`nama`, `mktPIC`, `tanggal`, …): the v1 API
// stores each row's JSON as the old client wrote it (docs/api/marketing.md).
import { BLN } from '~/utils/format'

// ---------------------------------------------------------------- status & lists

/** Every event status, incl. 'Event Done' which has no kanban column (:3581). */
export const STATUS_EVENT_MKT = ['Lead', 'Prospect', 'Approval', 'Quotation Terkirim', 'Deal', 'Event Done', 'Lost'] as const

/** Kanban columns (:3574). 'Negotiation' was dropped; normEventMkt moves old rows. */
export const PIPE_COLS_MKT = ['Lead', 'Prospect', 'Approval', 'Quotation Terkirim', 'Deal', 'Lost'] as const

/** Stages that still count as an open opportunity (:3588). */
export const TAHAP_TERBUKA_MKT = ['Lead', 'Prospect', 'Approval', 'Quotation Terkirim']

/** Statuses whose value is revenue: closing, invoices, reports (:5000). */
export const STATUS_OMSET_MKT = ['Confirmed', 'Deal', 'Event Done']

/** Follow-up result → the stage it moves the event to; null = no move (:3589-3596). */
export const HASIL_FU_MKT: Record<string, string | null> = {
  'Tertarik / kebutuhan jelas': 'Prospect',
  'Nego harga': 'Quotation Terkirim',
  'Quotation dikirim': 'Quotation Terkirim',
  'Belum jawab / masih pikir': null,
  'Deal': 'Deal',
  'Lost': 'Lost',
}
export const AKSI_FU_MKT = ['Call', 'WA', 'Meeting', 'Visit', 'Email']

export const JENIS_EVENT_MKT = ['Wedding', 'Corporate Event', 'Birthday', 'Gathering', 'Seminar', 'Launching', 'Competition', 'Private Party', 'Collaboration Event', 'Compliment', 'Lainnya']
export const SOURCE_CLIENT_MKT = ['Instagram', 'TikTok', 'Walk In', 'Referral', 'Google', 'Website', 'Repeat Customer', 'Event Organizer', 'Komunitas', 'Wedding', 'Corporate']
export const DIVISI_MKT = ['Kitchen', 'Bar', 'Floor', 'Design', 'Event', 'Security']
/** Seed of the F&B formats; the live list is `fbFormats` (:3613). */
export const FORMAT_FB_BAWAAN = ['Prasmanan', 'Set Menu', 'Coffee Break', 'Nasi Kotak']

/** Pengakuan Omset (:10104-10109). Empty is a STATE, never a third choice (F.2). */
export const MENU_FIX_MKT = [
  { v: 'tetap', t: 'Menu sudah ditetapkan', d: 'Paketnya disepakati sebelum hari-H. Omsetnya diakui untuk Marketing — di Finance → Breakdown Sumber Omset barisnya menyebut kasir yang menginput, dan saldo omset kasir itu dipotong sebesar nilainya.' },
  { v: 'ditempat', t: 'Menu dipilih di tempat', d: 'Tamu memesan sendiri di meja pada hari-H. Omsetnya tetap diakui kasir yang melayani — tidak ada kasir yang dipotong, dan barisnya di Breakdown tidak memakai pilihan kasir.' },
] as const
export const MENU_FIX_KOSONG_MKT = 'Selama belum dipilih, Finance tidak bisa tahu apakah omset acara ini memotong kasir atau tidak.'
export const menuFixMkt = (o?: { menuFix?: unknown } | null) => {
  const v = String(o?.menuFix ?? '')
  return MENU_FIX_MKT.some(x => x.v === v) ? v : ''
}

/** Business rules (:3399-3420), merged under the stored `settings` document. */
export const SETTING_MKT_BAWAAN = {
  dpPercent: 50, pb1: 10, serviceCharge: 5, fuTarget: 10,
  kwPrefix: 'KW/LM/2026/', kwSeq: 1, waBooking: '6285365234898', fuNextDays: 3, staleDays: 7,
}
export type SettingsMkt = typeof SETTING_MKT_BAWAAN & { freeTemplate?: string, [k: string]: unknown }

/** A VIP client spends more than this on finished events (:5552). */
export const BATAS_VIP_MKT = 20_000_000
/** Deal/Confirmed events close themselves from H+2 (:4703). */
export const TENGGANG_TUTUP_MKT = 2

// ---------------------------------------------------------------- records

export interface UserMkt {
  id: string
  name: string
  role?: string
  active?: boolean
  div?: string
  jabatan?: string
  hp?: string
  /** Per-person override of the role matrix, {view: 0|1|2}. */
  acc?: Record<string, number>
  updatedAt?: number
}

export interface ClientMkt {
  id: string
  nama: string
  perusahaan?: string
  pic?: string
  hp?: string
  email?: string
  ig?: string
  alamat?: string
  source?: string
  mktPIC?: string
  birthday?: string
  nextFU?: string
  catatan?: string
  createdAt?: string
  lastContact?: string
  /** Legacy: clients born as a Lead carry these; stages live on events. */
  status?: string
  pipeCol?: string
  updatedAt?: number
}

export interface PembayaranMkt { id?: string, no?: string, type?: string, amount?: number | string, method?: string, at?: string, receipt?: unknown, receiptUrl?: string, verified?: boolean, by?: string, dariDpForm?: boolean }
export type DetailEventMkt = Record<string, unknown>

/** One DP proof row of a VIP reservation (vipBuktiList). */
export interface BuktiVipMkt { id: string, nominal?: number | string, metode?: string, name?: string, key?: string, url?: string, by?: string, at?: string | number }

/** One Reservasi VIP row (D.14). */
export interface VipMkt {
  id: string
  jenis?: string
  nominal?: number | string
  menuFix?: string
  nama?: string
  clientId?: string
  perusahaan?: string
  hp?: string
  tanggal?: string
  jamMulai?: string
  jamSelesai?: string
  paxMin?: number | string
  paxMax?: number | string
  layoutReq?: string
  tv?: boolean
  speaker?: boolean
  catatan?: string
  meja?: string[]
  mktPIC?: string
  resId?: string
  bukti?: BuktiVipMkt[]
  batalAt?: string
  batalOleh?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: number
}

/** One design/video request (D.13). Stays here; Konten only reads it. */
export interface RequestDesainMkt {
  id: string
  jenis?: string
  judul?: string
  brief?: string
  acara?: string
  deadline?: string
  prioritas?: string
  brand?: string
  brandNama?: string
  pic?: string
  picNama?: string
  platforms?: string[]
  refs?: { t: string, v: string, n?: string }[]
  by?: string
  byNama?: string
  at?: string
  batalAt?: string
  updatedAt?: number
}

/** One DP row of a `vip-<id>` Reservasi record (vipDpsUntukReservasi). */
export interface DpVipMkt {
  id: string
  vipBuktiId?: string
  amount?: number
  method?: string
  proofData?: string
  proofName?: string
  by?: string
  at?: number
  [k: string]: unknown
}

/** Surat Penawaran on the event row (penawaranCard, :10088-10190). */
export interface PenawaranMkt {
  status?: string
  noSurat?: string
  validUntil?: string
  file?: { key?: string, name?: string, size?: number, at?: string | number, by?: string }
  note?: string
  revisiKe?: number
  revisiAlasan?: string
  revisiRiwayat?: { ke?: number, status?: string, alasan?: string, at?: string | number, by?: string, note?: string, sebelumnya?: Record<string, unknown> }[]
  sentAt?: string | number
  sentBy?: string
  sentVia?: string
  submittedBy?: string
  submittedAt?: string | number
  decidedBy?: string
  decidedAt?: string | number
  rejectNote?: string
  approvedBy?: string
  approvedAt?: string | number
}

export interface EventMkt {
  id: string
  clientId: string
  nama: string
  jenis?: string
  tanggal?: string
  tanggalSelesai?: string
  status: string
  pipeCol?: string
  mktPIC?: string
  pax?: number | string
  menuFix?: string
  invoiceSent?: boolean
  dpPercent?: number
  nextFU?: string
  createdAt?: string
  detail?: DetailEventMkt
  payments?: PembayaranMkt[]
  tasks?: Record<string, unknown>
  penawaran?: PenawaranMkt
  updatedAt?: number
}

export interface FollowupMkt {
  id: string
  clientId: string
  eventId?: string
  by?: string
  action?: string
  hasil?: string
  note?: string
  at: string
  next?: string
  updatedAt?: number
}

export interface AktivitasMkt { id?: string, refType?: string, refId?: string, action?: string, detail?: string, by?: string, at?: string }

// ---------------------------------------------------------------- access matrix
// One number per (screen, role): 0 Tak Terlihat · 1 Lihat · 2 Boleh Ubah
// (:3870-3966). Actions are tied to ONE screen (ACTION_VIEW); "may I do X" =
// edit level on that screen. Super Admin is always full.

export type LevelMkt = 0 | 1 | 2
export const OPSI_LEVEL_MKT = [{ value: 0, label: 'Tak Terlihat' }, { value: 1, label: 'Lihat' }, { value: 2, label: 'Boleh Ubah' }]

/** Every matrix row, in NAV_DEF order incl. the hidden `events`, `brief`, `users` (:4826-4900). */
export const VIEW_KEYS_MKT = ['dashboard', 'calendar', 'pipeline', 'events', 'brief', 'vip', 'designreq', 'kalkulator', 'invoices', 'approvals', 'purchasing', 'perfomset', 'reports', 'tasks', 'crm', 'katalog', 'templates', 'notifications', 'staff', 'settings', 'timeline', 'users']

/** Roles and the screens each opens by default (:3620-3626). */
export const ROLES_MKT: Record<string, { t: string, nav: string[] }> = {
  super_admin: { t: 'Super Admin', nav: ['dashboard', 'crm', 'pipeline', 'events', 'vip', 'katalog', 'brief', 'kalkulator', 'calendar', 'invoices', 'tasks', 'templates', 'staff', 'approvals', 'perfomset', 'reports', 'timeline', 'notifications', 'purchasing', 'users', 'settings'] },
  marketing: { t: 'Marketing', nav: ['dashboard', 'crm', 'pipeline', 'events', 'vip', 'katalog', 'brief', 'kalkulator', 'calendar', 'invoices', 'tasks', 'templates', 'staff', 'perfomset', 'reports', 'timeline', 'notifications', 'purchasing', 'settings'] },
  finance: { t: 'Finance', nav: ['dashboard', 'crm', 'events', 'vip', 'katalog', 'brief', 'kalkulator', 'calendar', 'invoices', 'tasks', 'templates', 'staff', 'perfomset', 'reports', 'timeline', 'notifications', 'purchasing', 'settings'] },
  manager: { t: 'Manager / Approver', nav: ['dashboard', 'crm', 'pipeline', 'events', 'vip', 'katalog', 'brief', 'kalkulator', 'calendar', 'invoices', 'tasks', 'templates', 'staff', 'approvals', 'perfomset', 'reports', 'timeline', 'notifications', 'purchasing', 'settings'] },
  operational: { t: 'Operational', nav: ['dashboard', 'events', 'brief', 'kalkulator', 'calendar', 'tasks', 'templates', 'staff', 'notifications', 'settings'] },
}

/** Empty role = a valid state: not yet allowed in (:3632-3635). */
export const namaRoleMkt = (role?: string) => (role ? ROLES_MKT[role]?.t ?? role : 'Belum ada akses')

/** Action → the screen that owns it. ORDER MATTERS: see permBawaanMkt (:3877-3885). */
export const ACTION_VIEW_MKT: Record<string, string> = {
  edit_client: 'crm', del_client: 'crm', del_event: 'events', edit_event: 'events',
  verify_payment: 'invoices', approve: 'approvals', manage_users: 'users',
  edit_task: 'tasks', edit_template: 'templates', edit_staff: 'staff',
  edit_vip: 'vip', edit_designreq: 'designreq', edit_katalog: 'katalog',
}

/**
 * The default level of a role on a screen, used while the matrix was never
 * saved (:3891-3923). Only the FIRST action mapped to the screen counts — so
 * del_client (false for all) sits after edit_client.
 */
export function permBawaanMkt(role: string | undefined, view: string): LevelMkt {
  if (role === 'super_admin') return 2
  const r = role ?? ''
  const edit: Record<string, boolean> = {
    edit_client: r === 'marketing',
    del_client: false,
    del_event: false,
    edit_event: ['marketing', 'manager'].includes(r),
    verify_payment: r === 'finance',
    approve: r === 'manager',
    manage_users: false,
    edit_task: ['operational', 'marketing', 'finance', 'manager'].includes(r),
    edit_template: ['operational', 'marketing', 'finance', 'manager'].includes(r),
    edit_staff: ['marketing', 'manager'].includes(r),
    edit_vip: ['marketing', 'manager'].includes(r),
    edit_designreq: ['marketing', 'manager'].includes(r),
    edit_katalog: ['marketing', 'manager'].includes(r),
  }
  const action = Object.keys(ACTION_VIEW_MKT).find(a => ACTION_VIEW_MKT[a] === view)
  if (action && edit[action]) return 2
  return ROLES_MKT[r]?.nav.includes(view) ? 1 : 0
}

export const permBawaanRoleMkt = (role: string) =>
  Object.fromEntries(VIEW_KEYS_MKT.map(v => [v, permBawaanMkt(role, v)])) as Record<string, number>

export type RoleAccMkt = Record<string, Record<string, number>>

/** Old nav[]/perms[] arrays → a matrix row (:2328-2337). */
function dariNavLama(nav: unknown, perms: unknown): Record<string, number> {
  return Object.fromEntries(VIEW_KEYS_MKT.map((v) => {
    const action = Object.keys(ACTION_VIEW_MKT).find(a => ACTION_VIEW_MKT[a] === v)
    const edit = !!action && Array.isArray(perms) && perms.includes(action)
    return [v, edit ? 2 : (Array.isArray(nav) && nav.includes(v) ? 1 : 0)]
  }))
}

/**
 * The stored matrix brought up to date, as normalizeState did (:2597-2620):
 * built from the old roleNav/rolePerms when roleAcc was never saved, and every
 * screen added since filled with its role default.
 */
export function normRoleAccMkt(roleAcc: unknown, roleNav?: unknown, rolePerms?: unknown): RoleAccMkt {
  let acc: RoleAccMkt = {}
  if (roleAcc && typeof roleAcc === 'object' && !Array.isArray(roleAcc)) acc = structuredClone(roleAcc as RoleAccMkt)
  else if (roleNav || rolePerms) {
    const nav = (roleNav ?? {}) as Record<string, unknown>
    const perms = (rolePerms ?? {}) as Record<string, unknown>
    for (const r of new Set([...Object.keys(nav), ...Object.keys(perms)])) acc[r] = dariNavLama(nav[r], perms[r])
  }
  for (const [r, row] of Object.entries(acc)) {
    if (!row || typeof row !== 'object') continue
    for (const v of VIEW_KEYS_MKT) if (typeof row[v] !== 'number') row[v] = permBawaanMkt(r, v)
  }
  return acc
}

/** A user row brought up to date (:2617-2628): missing screens filled, old nav/perms moved to acc. */
export function normUserMkt(u: UserMkt & { nav?: unknown, perms?: unknown }): UserMkt {
  const { nav, perms, ...rest } = u
  let acc = rest.acc && typeof rest.acc === 'object' ? { ...rest.acc } : undefined
  if (!acc && (Array.isArray(nav) || Array.isArray(perms))) acc = dariNavLama(nav, perms)
  if (acc) for (const v of VIEW_KEYS_MKT) if (typeof acc[v] !== 'number') acc[v] = permBawaanMkt(rest.role, v)
  return acc ? { ...rest, acc } : rest
}

/** A role's row: the saved matrix overrides the defaults; Super Admin always full (:3895-3898). */
export function roleAccMkt(roleAcc: RoleAccMkt, role?: string): Record<string, number> {
  if (role === 'super_admin') return Object.fromEntries(VIEW_KEYS_MKT.map(v => [v, 2]))
  const row = role ? roleAcc[role] : undefined
  return row && typeof row === 'object' ? row : permBawaanRoleMkt(role ?? '')
}

/** A person's levels: their own override, else their role's (:3906-3910). */
export function userAccMkt(u: UserMkt | null | undefined, roleAcc: RoleAccMkt): Record<string, number> {
  if (!u) return {}
  if (u.role === 'super_admin') return roleAccMkt(roleAcc, 'super_admin')
  return u.acc && typeof u.acc === 'object' ? u.acc : roleAccMkt(roleAcc, u.role)
}

/** Level on one screen (:3952-3957). VIEW_TERBUKA is empty since 7 Sep 2026, so no floor. */
export function viewPermMkt(view: string, u: UserMkt | null | undefined, roleAcc: RoleAccMkt): LevelMkt {
  const v = userAccMkt(u, roleAcc)[view]
  return (v === 1 || v === 2 ? v : 0)
}

/** May this person do `action` (old can(), :3967). */
export function bolehAksiMkt(action: string, u: UserMkt | null | undefined, roleAcc: RoleAccMkt): boolean {
  if (!u) return false
  if (u.role === 'super_admin') return true
  const view = ACTION_VIEW_MKT[action]
  return !!view && viewPermMkt(view, u, roleAcc) >= 2
}

/**
 * May this person open a screen (go(), :4959-4986). Merged screens: Sales
 * Pipeline also opens on the `events` row, Pegawai & Akses on `users`. The
 * event detail page has no row and is open to anyone in the module.
 */
export function bolehBukaMkt(view: string, u: UserMkt | null | undefined, roleAcc: RoleAccMkt): boolean {
  if (view === 'event') return !!u
  const lihat = (v: string) => viewPermMkt(v, u, roleAcc) >= 1
  if (view === 'pipeline') return lihat('pipeline') || lihat('events')
  if (view === 'staff') return lihat('staff') || lihat('users')
  return lihat(view)
}

/** True when the person has at least one screen at all (:4987-4993 "Akses belum aktif"). */
export const punyaLayarMkt = (u: UserMkt | null | undefined, roleAcc: RoleAccMkt) =>
  VIEW_KEYS_MKT.some(v => viewPermMkt(v, u, roleAcc) >= 1)

/**
 * Is this person on the Marketing team (:20062-20076): a whole word
 * marketing/sales/penjualan in their Office title (or division).
 */
export function timMarketing(u?: UserMkt | null): boolean {
  const kata = String(u?.jabatan || u?.div || '').trim().toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)
  return kata.includes('marketing') || kata.includes('sales') || kata.includes('penjualan')
}

// ---------------------------------------------------------------- dates
// All dates are local wall-clock 'YYYY-MM-DD' (F.9: never toISOString()).

/** Whole days from `dari` to `ke` (both 'YYYY-MM-DD'); same as old daysBetween (:3466). */
export const hariAntaraMkt = (dari: string, ke: string) => Math.round((Date.parse(ke) - Date.parse(dari)) / 86_400_000)

/** End date of an event; one-day events have no tanggalSelesai (:3481). */
export const tglSelesaiEvent = (e?: EventMkt | null) => e?.tanggalSelesai || e?.tanggal || ''
export const multiHariEvent = (e?: EventMkt | null) => !!(e?.tanggal && e.tanggalSelesai && e.tanggalSelesai > e.tanggal)

/** Does the event touch this day (calendar draws a two-day event on BOTH days, :3485-3492). */
export function eventPadaTgl(e: EventMkt | null | undefined, tgl: string): boolean {
  if (!e?.tanggal || !tgl) return false
  const a = e.tanggal
  let b = tglSelesaiEvent(e)
  if (b < a) b = a
  return tgl >= a && tgl <= b
}

/** The type to SHOW: "Lainnya" is a marker for the typed text (:3598-3602). */
export function jenisEvent(e?: EventMkt | null): string {
  const j = e?.jenis ?? ''
  if (j !== 'Lainnya') return j
  return String(e?.detail?.jenisLain ?? '').trim() || 'Lainnya'
}

/** Typed-name confirmation for permanent deletes: spaces/nbsp folded, case-insensitive (:6459-6462, F.7). */
export function namaCocok(a: unknown, b: unknown): boolean {
  const n = (x: unknown) => String(x ?? '').replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase()
  return n(a) === n(b)
}

/** Phone numbers compared as digits only, 62… = 0… (:5706-5710). */
export function hpKunci(t: unknown): string {
  const d = String(t ?? '').replace(/\D+/g, '')
  return d.startsWith('62') ? `0${d.slice(2)}` : d
}

// ---------------------------------------------------------------- pipeline

/** The kanban column of an event (:6246-6256): Confirmed shows as Deal. */
export function kolomPipeMkt(e: EventMkt): string {
  if (e.status === 'Event Done') return 'Event Done'
  if (e.pipeCol) return e.pipeCol
  if (e.status === 'Confirmed') return 'Deal'
  return (PIPE_COLS_MKT as readonly string[]).includes(e.status) ? e.status : 'Lead'
}

export const penStatusMkt = (e?: EventMkt | null) => e?.penawaran?.status || null

/**
 * The ONE rule for moving to Quotation Terkirim, used by drag AND the stage
 * picker (:6380-6389, F.3): the offer letter must be approved first. '' = allowed.
 */
export function pindahBolehMkt(e: EventMkt, tujuan: string): string {
  if (tujuan !== 'Quotation Terkirim') return ''
  const st = penStatusMkt(e)
  if (st === 'Disetujui') return ''
  if (st === 'Menunggu Approval') return 'Surat Penawaran masih menunggu keputusan manajemen di Approval Flow.'
  if (st === 'Ditolak') return 'Surat Penawaran ditolak manajemen. Perbaiki lalu ajukan ulang dari kartu Penawaran.'
  return 'Surat Penawaran belum diajukan. Ajukan dulu dari kartu Penawaran di detail event.'
}

/**
 * The required "core" fields of D.1 Informasi Dasar — the fields before its
 * first heading (missingBasic, :6529-6538; EVENT_SCHEMA :3973-4005). Read from
 * `detail`, a {v} wrapper unwrapped (getVal). #59 brings the whole schema;
 * this list must stay equal to its core part.
 */
const DASAR_WAJIB: { k: string, l: string, syarat?: string }[] = [
  { k: 'nama', l: 'Nama Event' }, { k: 'jenis', l: 'Jenis Event' }, { k: 'fbFormat', l: 'Format F&B' },
  { k: 'tanggal', l: 'Tanggal Event' }, { k: 'tanggalSelesai', l: 'Tanggal Selesai', syarat: 'multiHari' },
  { k: 'mulaiSetup', l: 'Mulai Setup' }, { k: 'tamuDatang', l: 'Tamu Datang / Jam Mulai' }, { k: 'selesai', l: 'Estimasi Selesai' },
  { k: 'pax', l: 'Estimasi Jumlah Tamu (Pax)' }, { k: 'privacy', l: 'Sifat Acara' }, { k: 'area', l: 'Lantai / Area' },
  { k: 'rundown', l: 'Rundown Acara' },
]
const nilaiDetail = (e: EventMkt, k: string) => {
  const v = e.detail?.[k]
  return v && typeof v === 'object' && 'v' in v ? (v as { v: unknown }).v : v
}
export function kurangDasarMkt(e: EventMkt): string[] {
  return DASAR_WAJIB
    .filter(f => !f.syarat || !!nilaiDetail(e, f.syarat))
    .filter((f) => {
      const v = nilaiDetail(e, f.k)
      return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
    })
    .map(f => f.l)
}

/**
 * Moving to Quotation Terkirim or Deal with basic data missing: a reminder,
 * never a block (ingatkanStage, :6541-6545, F.10). '' = nothing to say.
 */
export function ingatTahapMkt(e: EventMkt, tahap: string): string {
  if (!['Quotation Terkirim', 'Deal'].includes(tahap)) return ''
  const k = kurangDasarMkt(e)
  if (!k.length) return ''
  return `Belum terisi: ${k.slice(0, 3).join(', ')}${k.length > 3 ? ` (+${k.length - 3} lagi)` : ''}. Tahapnya tetap naik — lengkapi kalau sempat.`
}

/** The one F&B format an event's to-do comes from, when it is a known format (:5310-5313). */
export function kategoriEventMkt(e: EventMkt, fbFormats: string[]): string[] {
  const f = e.detail?.fbFormat
  return typeof f === 'string' && f && fbFormats.includes(f) ? [f] : []
}

/** Moving to Deal opens a handover task per category, without touching existing ones (genTasks, :4743-4748). */
export function tugasDealMkt(e: EventMkt, fbFormats: string[]): Record<string, unknown> {
  const tasks = { ...(e.tasks ?? {}) }
  for (const k of kategoriEventMkt(e, fbFormats)) {
    if (!tasks[k]) tasks[k] = { status: 'Pending', progress: 0, by: '', at: '' }
  }
  return tasks
}

/** Next follow-up date: today + fuNextDays (:4730). */
export function tglFuBerikut(hari: string, fuNextDays: number): string {
  const d = new Date(`${hari}T00:00:00`)
  d.setDate(d.getDate() + (+fuNextDays || 3))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Event list period (BRIEF_PERIODE + month stepper, :11130-11169). */
export type PeriodeEventMkt = '' | 'hari' | 'minggu' | 'bulan' | 'pilih'
export const PERIODE_EVENT_MKT: { value: PeriodeEventMkt, label: string }[] = [
  { value: '', label: 'Semua' }, { value: 'hari', label: 'Hari ini' }, { value: 'minggu', label: 'Minggu ini' }, { value: 'bulan', label: 'Bulan ini' },
]

/** The date range of a period; null = all dates. `bulan` is 'YYYY-MM' for 'pilih'. */
export function rentangPeriodeMkt(p: PeriodeEventMkt, hari: string, bulan: string): { a: string, b: string } | null {
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (p === 'hari') return { a: hari, b: hari }
  if (p === 'minggu') {
    const d = new Date(`${hari}T00:00:00`)
    const sen = new Date(d)
    sen.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const min = new Date(sen)
    min.setDate(sen.getDate() + 6)
    return { a: f(sen), b: f(min) }
  }
  if (p === 'bulan' || p === 'pilih') {
    const bl = p === 'pilih' ? (bulan || hari.slice(0, 7)) : hari.slice(0, 7)
    const akhir = new Date(+bl.slice(0, 4), +bl.slice(5, 7), 0)
    return { a: `${bl}-01`, b: `${bl}-${String(akhir.getDate()).padStart(2, '0')}` }
  }
  return null
}

// ---------------------------------------------------------------- tables
// The shared table engine (tblUrut / tblPage, :5451-5530): click a header to
// sort, again to reverse; 10 rows a page; empty values always last.

export interface KolomMkt<T> {
  k: string
  t: string
  /** Sort value; omit = not sortable. */
  v?: (r: T) => unknown
  /** Sorts descending first (amounts, dates). */
  turun?: boolean
  /** The default sort column. */
  def?: boolean
}
export type UrutMkt = { k: string, arah: 1 | -1 }
export const PER_HAL_MKT = 10

/** The default sort: the `def` column, else the first sortable one (:5486-5497). */
export function urutAwalMkt<T>(kolom: KolomMkt<T>[]): UrutMkt | null {
  const bisa = kolom.filter(c => c.v)
  const d = bisa.find(c => c.def) ?? bisa[0]
  return d ? { k: d.k, arah: d.turun ? -1 : 1 } : null
}

/** Numbers as numbers, the rest as text with numeric collation (:5503-5516). */
export function urutMkt<T>(rows: T[], kolom: KolomMkt<T>[], s: UrutMkt | null): T[] {
  const c = s && kolom.find(x => x.k === s.k)
  if (!s || !c?.v) return rows
  const v = c.v
  return rows.slice().sort((a, b) => {
    const va = v(a)
    const vb = v(b)
    const kosongA = va == null || va === ''
    const kosongB = vb == null || vb === ''
    if (kosongA && kosongB) return 0
    if (kosongA) return 1
    if (kosongB) return -1
    const r = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'id', { numeric: true, sensitivity: 'base' })
    return r * s.arah
  })
}

// ---------------------------------------------------------------- date text

const HARI3 = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** "Sen, 7 Okt 2026" — a date ALWAYS names its day (fmtDate, :3473-3476). '' → "—". */
export function tglMkt(d?: string): string {
  if (!d) return '—'
  const x = new Date(`${d.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(x.getTime())) return '—'
  return `${HARI3[x.getDay()]}, ${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}`
}

/** One day, or "start – end" for a multi-day event (fmtRentang, :3501-3504). */
export const rentangTglMkt = (e?: EventMkt | null) =>
  (multiHariEvent(e) ? `${tglMkt(e!.tanggal)} – ${tglMkt(e!.tanggalSelesai)}` : tglMkt(e?.tanggal))

/** "Hari ini" / "H-3" / "lewat" against today. */
export function hMinusMkt(tgl: string | undefined, hari: string): string {
  if (!tgl) return ''
  const rd = hariAntaraMkt(hari, tgl)
  return rd >= 0 ? (rd === 0 ? 'Hari ini' : `H-${rd}`) : 'lewat'
}

// ---------------------------------------------------------------- clients (CRM)
// A client has no status of its own: everything is read from its events (:5600-5615).

export const eventsClientMkt = (events: EventMkt[], id: string) => events.filter(e => e.clientId === id)
export const peluangClientMkt = (events: EventMkt[], id: string) => events.filter(e => e.clientId === id && TAHAP_TERBUKA_MKT.includes(e.status))
export const menangClientMkt = (events: EventMkt[], id: string) => events.filter(e => e.clientId === id && STATUS_OMSET_MKT.includes(e.status))
export const selesaiClientMkt = (events: EventMkt[], id: string) => events.filter(e => e.clientId === id && e.status === 'Event Done')

/** The relation filter of Database Client (:5562-5567, crmData :5582-5594). */
export const OPSI_RELASI_MKT = [
  { value: 'open', label: 'Punya peluang aktif' },
  ...TAHAP_TERBUKA_MKT.map(s => ({ value: `stage:${s}`, label: `↳ tahap ${s}` })),
  { value: 'deal', label: 'Pernah deal' },
  { value: 'repeat', label: 'Repeat customer' },
  { value: 'nodeal', label: 'Belum pernah deal' },
]

export function saringClientMkt(clients: ClientMkt[], events: EventMkt[], f: { q: string, rel: string, source: string }): ClientMkt[] {
  const q = f.q.trim().toLowerCase()
  return clients.filter((c) => {
    const r = f.rel
    if (r === 'open' && !peluangClientMkt(events, c.id).length) return false
    if (r.startsWith('stage:')) {
      const s = r.slice(6)
      if (!events.some(e => e.clientId === c.id && e.status === s)) return false
    }
    if (r === 'deal' && !menangClientMkt(events, c.id).length) return false
    if (r === 'repeat' && selesaiClientMkt(events, c.id).length < 2) return false
    if (r === 'nodeal' && menangClientMkt(events, c.id).length) return false
    if (f.source && c.source !== f.source) return false
    if (q && !`${c.nama} ${c.perusahaan} ${c.hp} ${c.email || ''} ${c.ig || ''}`.toLowerCase().includes(q)) return false
    return true
  })
}

// ---- Export / Import Excel (CSV) — one column list both ways (:5662-5695) ----

/** `b` = field; columns without `b` are read-once notes, written but never read back. */
export interface KolomCsvClient { k: string, b?: keyof ClientMkt }
export const KOLOM_CSV_CLIENT: KolomCsvClient[] = [
  { k: 'ID', b: 'id' }, { k: 'Nama', b: 'nama' }, { k: 'Perusahaan', b: 'perusahaan' }, { k: 'PIC Client', b: 'pic' },
  { k: 'No. HP', b: 'hp' }, { k: 'Email', b: 'email' }, { k: 'Instagram', b: 'ig' }, { k: 'Alamat', b: 'alamat' },
  { k: 'Source', b: 'source' }, { k: 'Marketing PIC', b: 'mktPIC' }, { k: 'Tanggal Lahir', b: 'birthday' },
  { k: 'Next Follow Up', b: 'nextFU' }, { k: 'Catatan', b: 'catatan' },
  { k: 'Jumlah Event' }, { k: 'Peluang Aktif' }, { k: 'Total Spending' },
]
/** Header names compared lower-case, letters and digits only (:5700). */
export const kunciKolomCsv = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Rows → CSV text with the `sep=,` line Excel (id-ID) needs (:5738-5746); unduhCsv adds the BOM. */
export const csvTeksMkt = (baris: unknown[][]) =>
  `sep=,\r\n${baris.map(r => r.map(sel => `"${String(sel ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')}`

/** Quote-aware CSV reader; separator from `sep=` or guessed from the header (:5751-5791). */
export function bacaCsvMkt(teks: string): string[][] {
  let t = String(teks || '').replace(/^\uFEFF/, '')
  let pisah = ''
  const m = /^sep=(.)\r?\n/i.exec(t)
  if (m) {
    pisah = m[1]!
    t = t.slice(m[0].length)
  }
  if (!pisah) {
    const kepala = t.split(/\r?\n/)[0] ?? ''
    const hit: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
    let luar = true
    for (const ch of kepala) {
      if (ch === '"') luar = !luar
      else if (luar && hit[ch] !== undefined) hit[ch]++
    }
    pisah = [',', ';', '\t'].sort((a, b) => hit[b]! - hit[a]!)[0]!
    if (!hit[pisah]) pisah = ','
  }
  const baris: string[][] = []
  let sel = ''
  let row: string[] = []
  let dalam = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!
    if (dalam) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          sel += '"'
          i++
        }
        else dalam = false
      }
      else sel += ch
    }
    else if (ch === '"') dalam = true
    else if (ch === pisah) {
      row.push(sel)
      sel = ''
    }
    else if (ch === '\n') {
      row.push(sel)
      baris.push(row)
      row = []
      sel = ''
    }
    else if (ch !== '\r') sel += ch
  }
  if (sel !== '' || row.length) {
    row.push(sel)
    baris.push(row)
  }
  return baris.filter(r => r.some(x => String(x).trim() !== ''))
}

/** Tiered match: ID (certain), then phone (natural key), then name (:5877-5884). */
export function cariClientMkt(clients: ClientMkt[], id: string, hp: string, nama: string): ClientMkt | null {
  if (id) {
    const c = clients.find(x => x.id === id)
    if (c) return c
  }
  const k = hpKunci(hp)
  if (k) {
    const c = clients.find(x => hpKunci(x.hp) === k)
    if (c) return c
  }
  const n = nama.trim().toLowerCase()
  return clients.find(x => String(x.nama || '').trim().toLowerCase() === n) ?? null
}

export interface RencanaImporMkt {
  baru: { c: Partial<ClientMkt>, n: number }[]
  ubah: { c: ClientMkt, nilai: Partial<ClientMkt>, beda: string[], n: number }[]
  sama: string[]
  lewat: { n: number, sebab: string }[]
  ingat: string[]
}

/**
 * Read an import file into a plan, changing nothing (crmImportBaca, :5810-5871).
 * A column absent from the file is not touched; an empty Marketing PIC keeps the
 * old one (new rows: me); an unknown PIC name is reported and the old one kept.
 * Returns {judul, pesan} when the file cannot be used.
 */
export function rencanaImporClient(baris: string[][], clients: ClientMkt[], users: UserMkt[], sayaId: string): RencanaImporMkt | { judul: string, pesan: string } {
  if (baris.length < 2) return { judul: 'Berkas kosong', pesan: 'Tidak ada satu baris data pun di bawah baris judul.' }
  const kepala = baris[0]!.map(kunciKolomCsv)
  const idx: Partial<Record<keyof ClientMkt, number>> = {}
  for (const kol of KOLOM_CSV_CLIENT) {
    if (!kol.b) continue
    const i = kepala.indexOf(kunciKolomCsv(kol.k))
    if (i >= 0) idx[kol.b] = i
  }
  if (idx.nama === undefined) {
    return { judul: 'Kolom Nama tidak ditemukan', pesan: `Berkas ini berjudul kolom: ${baris[0]!.slice(0, 8).join(', ')}. Ekspor dulu dari tombol Export Excel supaya judul kolomnya benar.` }
  }
  const userId = (nama: string) => {
    const x = nama.trim().toLowerCase()
    return x ? users.find(u => String(u.name || '').trim().toLowerCase() === x)?.id ?? '' : ''
  }
  const out: RencanaImporMkt = { baru: [], ubah: [], sama: [], lewat: [], ingat: [] }
  baris.slice(1).forEach((r, i) => {
    const no = i + 2
    const amb = (b: keyof ClientMkt) => (idx[b] === undefined ? '' : String(r[idx[b]!] ?? '').trim())
    const nama = amb('nama')
    if (!nama) {
      out.lewat.push({ n: no, sebab: 'kolom Nama kosong' })
      return
    }
    const lama = cariClientMkt(clients, amb('id'), amb('hp'), nama)
    const nilai: Record<string, string> = {}
    for (const kol of KOLOM_CSV_CLIENT) {
      if (!kol.b || kol.b === 'id' || idx[kol.b] === undefined) continue
      let v = amb(kol.b)
      if (kol.b === 'mktPIC') {
        if (!v) {
          nilai.mktPIC = lama ? (lama.mktPIC || '') : sayaId
          continue
        }
        const id = userId(v)
        if (!id) {
          out.ingat.push(`Baris ${no}: Marketing PIC "${v}" tidak ada di daftar pegawai — PIC lamanya dipertahankan.`)
          nilai.mktPIC = lama ? (lama.mktPIC || '') : sayaId
          continue
        }
        v = id
      }
      nilai[kol.b] = v
    }
    if (lama) {
      const beda = Object.keys(nilai).filter(k => String(lama[k as keyof ClientMkt] ?? '') !== String(nilai[k]))
      if (!beda.length) out.sama.push(lama.nama)
      else out.ubah.push({ c: lama, nilai, beda, n: no })
    }
    else {
      out.baru.push({ c: { status: 'Lead', pipeCol: 'Lead', nama: '', perusahaan: '', pic: '', hp: '', email: '', ig: '', alamat: '', source: '', mktPIC: sayaId, birthday: '', nextFU: '', catatan: '', ...nilai }, n: no })
    }
  })
  return out
}
