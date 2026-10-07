// Jadwal Shift — the pure rules of the old sheet (laksamana-office
// deploy/jadwal/index.html), no Vue and no API. Screens and useJadwal.ts
// import from here so a rule lives in one place.
//
// The Divisi of a crew member is NOT resolved here: GET /jadwal/roster sends
// `divisi` already resolved by the server with the legacy `jdw_divisi_user`
// rule (docs/api/jadwal.md "Roster"). Only the Office/Kantor word test stays,
// because "who sees every division" (`bisaLihatSemua`) reads it for the
// viewer themself.
import type { RosterUser } from '~/composables/useRoster'
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import { tambahHari } from '~/utils/format'

/** Source: deploy/jadwal/index.html:765-770. The only divisions that work in shifts. */
export const DIVISI = [
  { k: 'bar', n: 'Bar', icon: 'i-lucide-martini' },
  { k: 'kitchen', n: 'Kitchen', icon: 'i-lucide-chef-hat' },
  { k: 'floor', n: 'Floor', icon: 'i-lucide-utensils' },
  { k: 'cashier', n: 'Cashier', icon: 'i-lucide-banknote' },
] as const

export type KodeDivisi = typeof DIVISI[number]['k']

/** Everyone who is not in one of the four shift divisions (`:780`). */
export const DIV_NONSHIFT = 'nonshift'

export const namaDivisiJadwal = (k: string) => DIVISI.find(d => d.k === k)?.n ?? 'Tidak dijadwalkan'

export interface ShiftDef {
  n: string
  m: string
  s: string
  /** Hex colour from the old Excel sheet; admin-editable data, never a constant in a component. */
  w: string
  libur: number
  urut: number
}

/** Source: `:806-815`. Colours follow the Excel sheet the crew already read from the board. */
export const SHIFT_BAWAAN: Record<string, ShiftDef> = {
  PAGI: { n: 'PAGI', m: '08:00', s: '17:00', w: '#00B0F0', libur: 0, urut: 10 },
  MIDDLE: { n: 'MIDDLE', m: '11:00', s: '20:00', w: '#92D050', libur: 0, urut: 20 },
  SPLIT: { n: 'SPLIT', m: '11:00', s: '23:00', w: '#00B050', libur: 0, urut: 30 },
  SIANG: { n: 'SIANG', m: '14:00', s: '23:00', w: '#FFC000', libur: 0, urut: 40 },
  OFF: { n: 'OFF', m: '', s: '', w: '#FF0000', libur: 1, urut: 50 },
  IZIN: { n: 'IZIN', m: '', s: '', w: '#0070C0', libur: 1, urut: 60 },
  CUTI: { n: 'CUTI', m: '', s: '', w: '#C00000', libur: 1, urut: 70 },
  LAIN: { n: 'LAIN', m: '', s: '', w: '#7A756B', libur: 1, urut: 80 },
}

/** Labels for every request kind, including the retired UBAH so old rows still read (`:816-829`). */
export const JENIS_AJU: Record<string, string> = {
  OFF: 'Ganti Hari Off',
  IZIN: 'Izin',
  CUTI: 'Cuti',
  TUKAR: 'Tukar Shift',
  UBAH: 'Ubah Jam Shift',
}
/** What a crew member may still pick (`:834`). */
export const JENIS_AJU_PILIH = ['OFF', 'IZIN', 'CUTI', 'TUKAR'] as const

/** Who the request is waiting for, not just "Menunggu" (`:842`). */
export const LABEL_STATUS_AJU: Record<string, string> = {
  MENUNGGU: 'Menunggu head',
  MENUNGGU_HRD: 'Menunggu HRD',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
}
export const AJU_BERJALAN = ['MENUNGGU', 'MENUNGGU_HRD']
export const ajuBerjalan = (a: { status: string } | null | undefined) => !!a && AJU_BERJALAN.includes(a.status)

/** An approved request writes this shift into the cell (`:852`). TUKAR uses the shift it asked for. */
export const AJU_KE_SHIFT: Record<string, string> = { OFF: 'OFF', IZIN: 'IZIN', CUTI: 'CUTI' }

/** Shifts that are born from a request, hidden from the cell editor unless already in the cell (`:1163`). */
export const SHIFT_AJU = ['IZIN', 'CUTI', 'LAIN']

/** One schedule cell, as `GET /jadwal/cells` sends it. */
export interface SelJadwal {
  u: string
  d: string
  t: string
  m: string
  s: string
  n: string
}

/** The setting blob of GET /jadwal/settings, normalised (`normalizeState`, `:1073-1110`). */
export interface SettingJadwal {
  shifts: Record<string, ShiftDef>
  /** Divisi -> user ids (T-11: this is the settings shape, not `/heads`). */
  heads: Record<string, string[]>
  divOverride: Record<string, string>
  jabatan: Record<string, string>
  shiftKru: Record<string, string>
  manajemen: string[]
  maksBeruntun: number
  jedaMin: number
  [k: string]: unknown
}

/** PHP may send an empty map as `[]` (`petaObjek`, `:1062`). */
function peta<T>(v: unknown): Record<string, T> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return v as Record<string, T>
}

export function normalSetting(raw: unknown): SettingJadwal {
  const st = peta<unknown>(raw)
  const asal = peta<Partial<ShiftDef>>(st.shifts)
  const shifts: Record<string, ShiftDef> = {}
  for (const k of Object.keys(SHIFT_BAWAAN)) shifts[k] = { ...SHIFT_BAWAAN[k]!, ...(asal[k] ?? {}) }
  // Shifts the admin added keep their own definition.
  for (const k of Object.keys(asal)) {
    if (!shifts[k]) shifts[k] = { n: k, m: '', s: '', w: '#7A756B', libur: 0, urut: 90, ...asal[k] }
  }
  return {
    ...st,
    shifts,
    heads: peta<string[]>(st.heads),
    divOverride: peta<string>(st.divOverride),
    jabatan: peta<string>(st.jabatan),
    shiftKru: peta<string>(st.shiftKru),
    manajemen: Array.isArray(st.manajemen) ? st.manajemen.map(String) : [],
    maksBeruntun: Number(st.maksBeruntun) > 0 ? Number(st.maksBeruntun) : 6,
    jedaMin: Number(st.jedaMin) > 0 ? Number(st.jedaMin) : 10,
  }
}

export function shiftDef(set: SettingJadwal, k: string): ShiftDef {
  return set.shifts[k] ?? SHIFT_BAWAAN[k] ?? { n: k, m: '', s: '', w: '#7A756B', libur: 1, urut: 99 }
}

export const daftarShift = (set: SettingJadwal) =>
  Object.keys(set.shifts).sort((a, b) => (shiftDef(set, a).urut || 99) - (shiftDef(set, b).urut || 99))

/** The shifts offered in the cell editor: request-born ones only when already in the cell (`:1170`). */
export const shiftPilihan = (set: SettingJadwal, sekarang: string) =>
  daftarShift(set).filter(k => !SHIFT_AJU.includes(k) || k === sekarang)

/** The cell's working hours, falling back to the shift defaults (`:1203`). */
export function jamSel(set: SettingJadwal, c: SelJadwal | null | undefined): { m: string, s: string } | null {
  if (!c) return null
  const d = shiftDef(set, c.t)
  const m = c.m || d.m
  const s = c.s || d.s
  return m && s ? { m, s } : null
}

/** A free note replaces the shift name in the cell (`:1212`). */
export const labelSel = (set: SettingJadwal, c: SelJadwal | null | undefined) =>
  c ? (c.n || shiftDef(set, c.t).n) : ''

/** Hours between start and end; a shift past midnight wraps (`:4465`). */
export function durasiJam(m: string, s: string): number {
  const t = (x: string) => {
    const p = String(x).split(':')
    return Number(p[0]) * 60 + Number(p[1])
  }
  const a = t(m)
  let b = t(s)
  if (b <= a) b += 1440
  return (b - a) / 60
}

/**
 * Text colour on a shift pill, from the brightness of its colour (`warnaTeks`,
 * `:1048`): admins pick the colour, and white on #FFC000 does not read.
 * Returns a class, so components never carry a colour literal.
 */
export function kelasTeksShift(hex: string): string {
  let h = String(hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = Number.parseInt(h, 16) || 0
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? 'text-ink-900' : 'text-white'
}

// ------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, '0')
const parseD = (s: string) => {
  const p = String(s).split('-')
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
}
const fmtD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 0 = Monday … 6 = Sunday (`idxHari`, `:1196`). */
export const idxHari = (s: string) => (parseD(s).getDay() + 6) % 7
export const HARI_SENIN = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export const bulanDari = (s: string) => String(s).slice(0, 7)
export const awalBulan = (mk: string) => `${mk}-01`
export function akhirBulan(mk: string): string {
  const p = mk.split('-')
  return fmtD(new Date(Number(p[0]), Number(p[1]), 0))
}
export function geserBulan(mk: string, n: number): string {
  const p = mk.split('-')
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export function hariSebulan(mk: string): string[] {
  const out: string[] = []
  for (let d = awalBulan(mk); d <= akhirBulan(mk); d = tambahHari(d, 1)) out.push(d)
  return out
}
/** "28/09/26" — the sheet's column head (`tglPendek`, `:1194`). */
export function tglSel(s: string): string {
  const d = parseD(s)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
}

// ------------------------------------------------------------- load

export interface Beban {
  masuk: number
  libur: number
  kosong: number
  jam: number
  maxBeruntun: number
}

export type PetaSel = Map<string, SelJadwal>
export const kunciSel = (uid: string, tgl: string) => `${uid}|${tgl}`
export function petaSel(cells: SelJadwal[]): PetaSel {
  return new Map(cells.map(c => [kunciSel(c.u, c.d), c]))
}

/** One person's month (`bebanKru`, `:3067`). */
export function bebanKru(set: SettingJadwal, sel: PetaSel, uid: string, mk: string): Beban {
  let masuk = 0
  let libur = 0
  let kosong = 0
  let jam = 0
  let beruntun = 0
  let maxBeruntun = 0
  for (let d = awalBulan(mk); d <= akhirBulan(mk); d = tambahHari(d, 1)) {
    const c = sel.get(kunciSel(uid, d))
    if (!c) {
      kosong++
      beruntun = 0
      continue
    }
    if (shiftDef(set, c.t).libur) {
      libur++
      beruntun = 0
      continue
    }
    masuk++
    beruntun++
    if (beruntun > maxBeruntun) maxBeruntun = beruntun
    const j = jamSel(set, c)
    if (j) jam += durasiJam(j.m, j.s)
  }
  return { masuk, libur, kosong, jam: Math.round(jam * 10) / 10, maxBeruntun }
}

/** Totals over a group of people (`rekapBulan`, `:3104`). */
export function rekapBulan(set: SettingJadwal, sel: PetaSel, uids: string[], mk: string) {
  let masuk = 0
  let libur = 0
  let kosong = 0
  for (const uid of uids) {
    for (let d = awalBulan(mk); d <= akhirBulan(mk); d = tambahHari(d, 1)) {
      const c = sel.get(kunciSel(uid, d))
      if (!c) kosong++
      else if (shiftDef(set, c.t).libur) libur++
      else masuk++
    }
  }
  return { masuk, libur, kosong }
}

// ------------------------------------------------------------- access

/** The roster row with the server-resolved Divisi (GET /jadwal/roster). */
export type KruJadwal = RosterUser & { divisi: string }

/** Office/Kantor staff: the Tim column names Office or Kantor (`stafKantor`, `:1286`). */
export function stafKantor(keterangan: string | undefined): boolean {
  const kata = String(keterangan || '').toLowerCase().split(/[^a-z]+/).filter(Boolean)
  return kata.includes('office') || kata.includes('kantor')
}

/**
 * The viewer's standing in this module. Admin of `jadwal` is HRD (`isAdmin`,
 * `:1320`); a head is whoever the setting lists for a Divisi. Built once per
 * screen from the loaded setting so every rule below reads the same answer.
 */
export interface PeranJadwal {
  id: string
  admin: boolean
  /** Ticked "Rekap" in Pengaturan (`setting.manajemen`). */
  manajemen: boolean
  kantor: boolean
  heads: Record<string, string[]>
}

export function peranJadwal(me: Me | null, set: SettingJadwal, kru: KruJadwal[]): PeranJadwal {
  const id = me?.id ?? ''
  const aku = kru.find(u => u.id === id)
  return {
    id,
    admin: isAdminOf(me, 'jadwal'),
    manajemen: !!id && set.manajemen.includes(id),
    kantor: stafKantor(aku?.keterangan ?? me?.keterangan),
    heads: set.heads,
  }
}

export const isHeadUser = (p: PeranJadwal, uid: string, div: string) => (p.heads[div] ?? []).includes(uid)

/** No head named anywhere yet: everyone with the module may write, like `jdw_ada_head()` (`:1362`). */
export const adaHead = (p: PeranJadwal) => DIVISI.some(d => (p.heads[d.k] ?? []).length > 0)
export const divPunyaHead = (p: PeranJadwal, div: string) => (p.heads[div] ?? []).length > 0

/** May this person change the cells of one Divisi (`bolehUbah`, `:1370`)? */
export function bolehUbah(p: PeranJadwal, div: string): boolean {
  if (p.admin) return true
  if (!adaHead(p)) return true
  return !!p.id && isHeadUser(p, p.id, div)
}

/** Divisions this person may edit (`divisiKuasa`, `:1388`). */
export function divisiKuasa(p: PeranJadwal): string[] {
  if (p.admin) return DIVISI.map(d => d.k)
  if (!p.id) return []
  return DIVISI.map(d => d.k).filter(k => isHeadUser(p, p.id, k))
}

/** The company-wide viewers: admin, manajemen, and Office staff (`bisaLihatSemua`, `:1330`). */
export const bisaLihatSemua = (p: PeranJadwal) => p.admin || p.manajemen || p.kantor

/** Rekap Pegawai is for admin, manajemen, Office staff and any head (`bolehRekap`, `:1344`). */
export const bolehRekap = (p: PeranJadwal) => bisaLihatSemua(p) || divisiKuasa(p).length > 0

/** Step 1 — the head of the requester's Divisi forwards; admin only where the Divisi has no head (`:4497`). */
export function bisaPutusHead(p: PeranJadwal, a: { status: string }, divPengaju: string | null): boolean {
  if (a.status !== 'MENUNGGU' || !divPengaju || !p.id) return false
  if (isHeadUser(p, p.id, divPengaju)) return true
  return p.admin && !divPunyaHead(p, divPengaju)
}

/** Step 2 — HRD (= admin of the module) approves (`:4510`). */
export const bisaPutusHRD = (p: PeranJadwal, a: { status: string }) => a.status === 'MENUNGGU_HRD' && p.admin

/** Who may SEE a request: admin, the requester, the head of their Divisi (`bisaLihatAju`, `:4535`). */
export function bisaLihatAju(p: PeranJadwal, a: { userId: string }, divPengaju: string | null): boolean {
  if (p.admin) return true
  if (a.userId === p.id) return true
  return !!divPengaju && !!p.id && isHeadUser(p, p.id, divPengaju)
}

/**
 * Crew of one Divisi, active only, heads first then by name (`kruDivisi`, `:1272`).
 */
export function kruDivisi(p: PeranJadwal, kru: KruJadwal[], div: string): KruJadwal[] {
  return kru
    .filter(u => u.active !== false && u.divisi === div)
    .sort((a, b) => {
      const ha = isHeadUser(p, a.id, div) ? 0 : 1
      const hb = isHeadUser(p, b.id, div) ? 0 : 1
      return ha - hb || String(a.name || '').localeCompare(String(b.name || ''))
    })
}

/** The role line under the user's name (`labelPeran`, `:1393`). */
export function labelPeran(p: PeranJadwal, divSaya: string): string {
  if (p.admin) return 'Admin Jadwal'
  const k = divisiKuasa(p)
  if (k.length) return `Head ${k.map(namaDivisiJadwal).join(', ')}`
  return `Kru · ${namaDivisiJadwal(divSaya)}`
}

/** The default shift for a request form: the same weekday last week, else the most used, else `shiftKru`, else the first working shift (`shiftKru`, `:1127`). */
export function shiftKruBawaan(set: SettingJadwal, sel: PetaSel, uid: string, tgl: string): string {
  if (tgl) {
    const lalu = sel.get(kunciSel(uid, tambahHari(tgl, -7)))
    if (lalu?.t && set.shifts[lalu.t]) return lalu.t
    const senin = tambahHari(tambahHari(tgl, -idxHari(tgl)), -7)
    const n: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const c = sel.get(kunciSel(uid, tambahHari(senin, i)))
      if (!c?.t || shiftDef(set, c.t).libur) continue
      n[c.t] = (n[c.t] ?? 0) + 1
    }
    let top = ''
    let max = 0
    for (const [k, v] of Object.entries(n)) {
      if (v > max) {
        max = v
        top = k
      }
    }
    if (top) return top
  }
  const pilih = set.shiftKru[uid]
  if (pilih && set.shifts[pilih]) return pilih
  const urut = daftarShift(set)
  return urut.find(k => !shiftDef(set, k).libur) ?? urut[0] ?? 'PAGI'
}
