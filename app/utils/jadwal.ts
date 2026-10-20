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
  /** Written by HRIS (ADR-0012 J1): blocks, shift Divisi and active flag. The Office screen must keep them. */
  blok?: { mulai: string, selesai: string }[]
  divisi?: string[]
  aktif?: number
}

/** The keys this Office screen owns. Everything else in a shift definition belongs to HRIS. */
export const SHIFT_EDITABLE = ['n', 'm', 's', 'w', 'libur', 'urut'] as const

/** Source: `:806-815`. Colours follow the Excel sheet the crew already read from the board. */
export const SHIFT_BAWAAN: Record<string, ShiftDef> = {
  PAGI: { n: 'PAGI', m: '08:00', s: '17:00', w: '#00B0F0', libur: 0, urut: 10 },
  MIDDLE: { n: 'MIDDLE', m: '11:00', s: '21:00', w: '#92D050', libur: 0, urut: 20 },
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

/**
 * Merge a shift draft into the latest server blob. Only the keys this Office
 * screen owns (`SHIFT_EDITABLE`) come from the draft, so `blok`, `divisi` and
 * `aktif` written by HRIS after the draft loaded are never overwritten. A
 * shift added in this screen has no server copy yet and is sent as-is.
 */
export function gabungShift(server: Record<string, ShiftDef>, draf: Record<string, ShiftDef>): Record<string, ShiftDef> {
  const out: Record<string, ShiftDef> = {}
  for (const [k, d] of Object.entries(draf)) {
    const s = server[k]
    if (!s) {
      out[k] = { ...d }
      continue
    }
    const bersih: ShiftDef = { ...s }
    for (const f of SHIFT_EDITABLE) {
      const v = d[f]
      if (v !== undefined) Object.assign(bersih, { [f]: v })
    }
    out[k] = bersih
  }
  return out
}

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
export type KruJadwal = RosterUser & { divisi: string, tim?: string[] }

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

/** Divisions whose sheet this person may SEE on the per-Divisi screens (`divisiLihat`, `:1349`). */
export function divisiLihat(p: PeranJadwal, divSaya: string): string[] {
  if (bisaLihatSemua(p) || !adaHead(p)) return DIVISI.map(d => d.k)
  const k = divisiKuasa(p)
  if (k.length) return k
  return DIVISI.some(d => d.k === divSaya) ? [divSaya] : []
}

// ------------------------------------------------------------- weeks

export const seninDari = (s: string) => tambahHari(s, -idxHari(s))
export const tujuhHari = (senin: string) => Array.from({ length: 7 }, (_, i) => tambahHari(senin, i))
const BLN_JADWAL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tglManusia = (s: string) => {
  const d = parseD(s)
  return `${d.getDate()} ${BLN_JADWAL[d.getMonth()]}`
}
/** "28 Sep – 4 Okt 2026" (`rentangMinggu`, `:1196`). */
export function rentangMinggu(senin: string): string {
  const a = parseD(senin)
  const b = parseD(tambahHari(senin, 6))
  return `${a.getDate()} ${BLN_JADWAL[a.getMonth()]} – ${b.getDate()} ${BLN_JADWAL[b.getMonth()]} ${b.getFullYear()}`
}
const BULAN_JADWAL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const labelBulanJadwal = (mk: string) => `${BULAN_JADWAL[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`

// ------------------------------------------------------------- bulk writes

/** An overwrite the bulk tools must name before writing (`daftarTimpa`, `:3570`). */
export interface Timpa {
  nama: string
  tgl: string
  lama: SelJadwal
  baru: SelJadwal
}

/** Writing the identical value is not a clash (`samaSel`, `:3566`). */
export const samaSel = (a: SelJadwal, b: SelJadwal) =>
  a.t === b.t && (a.m || '') === (b.m || '') && (a.s || '') === (b.s || '') && (a.n || '') === (b.n || '')

export function daftarTimpa(sel: PetaSel, rows: SelJadwal[], nama: (uid: string) => string): Timpa[] {
  const out: Timpa[] = []
  for (const r of rows) {
    const lama = sel.get(kunciSel(r.u, r.d))
    if (!lama || samaSel(lama, r)) continue
    out.push({ nama: nama(r.u), tgl: r.d, lama, baru: r })
  }
  return out.sort((a, b) => (a.tgl === b.tgl ? a.nama.localeCompare(b.nama) : a.tgl < b.tgl ? -1 : 1))
}

/** Rows that sit on an approved request: overwriting them breaks a promise (`selDariPengajuan`, `:4316`). */
export function selDariPengajuan<R extends { u: string, d: string }>(rows: R[], aju: { userId: string, dari: string, sampai: string, status: string }[]): R[] {
  const ok = aju.filter(a => a.status === 'DISETUJUI')
  if (!ok.length) return []
  return rows.filter(r => ok.some(a => a.userId === r.u && r.d >= a.dari && r.d <= a.sampai))
}

/** A cell row with the shift's default hours, empty on a day-off shift. */
export function barisShift(set: SettingJadwal, u: string, d: string, t: string): SelJadwal {
  const def = shiftDef(set, t)
  return { u, d, t, m: def.libur ? '' : def.m, s: def.libur ? '' : def.s, n: '' }
}

/**
 * Source date for "Salin bulan lalu" (`sumberBulanLalu`, `:2997`): `hari` keeps
 * the weekday (28 days back, 35 for the 29th–31st so it lands in the previous
 * month); `tanggal` keeps the date and skips days the previous month lacks.
 */
export function sumberBulanLalu(d: string, mk: string, mode: 'hari' | 'tanggal'): string {
  if (mode === 'tanggal') {
    const lalu = geserBulan(mk, -1)
    const akhir = Number(akhirBulan(lalu).slice(-2))
    if (Number(d.slice(8)) > akhir) return ''
    return `${lalu}-${d.slice(8)}`
  }
  let s = tambahHari(d, -28)
  if (s >= awalBulan(mk)) s = tambahHari(d, -35)
  return s
}

// ------------------------------------------------------------- Excel import

const IMP_BULAN: Record<string, number> = {
  jan: 0, januari: 0, january: 0, feb: 1, februari: 1, february: 1, mar: 2, maret: 2, march: 2,
  apr: 3, april: 3, mei: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6,
  agu: 7, agt: 7, ags: 7, agustus: 7, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9, nov: 10, november: 10, des: 11, dec: 11, desember: 11, december: 11,
}
const impISO = (y: number, mo: number, d: number) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null)

/**
 * A date cell of a pasted/uploaded sheet (`impTgl`, `:3873`): ISO, dd/mm/yyyy,
 * dd/mm, "1 Sep [2026]", or an Excel serial. More than ~18 months from `ref`
 * is refused, so a misread number never writes into 2125.
 */
export function impTgl(raw: unknown, ref: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let iso: string | null = null
  let m: RegExpMatchArray | null
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const p = s.split('-')
    iso = impISO(Number(p[0]), Number(p[1]), Number(p[2]))
  }
  else if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
    let d = Number(m[1])
    let mo = Number(m[2])
    let y = Number(m[3])
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    if (y < 100) y += 2000
    iso = impISO(y, mo, d)
  }
  else if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})$/))) {
    let d = Number(m[1])
    let mo = Number(m[2])
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    iso = impISO(Number(String(ref).slice(0, 4)), mo, d)
  }
  else if ((m = s.match(/^(\d{1,2})[ -]([A-Z]{3,})\.?(?:[ -](\d{2,4}))?$/i))) {
    const mo = IMP_BULAN[m[2]!.toLowerCase()]
    if (mo === undefined) return null
    let y = m[3] ? Number(m[3]) : Number(String(ref).slice(0, 4))
    if (y < 100) y += 2000
    iso = impISO(y, mo + 1, Number(m[1]))
  }
  else if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000)
    iso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
  }
  if (!iso) return null
  const beda = Math.abs(parseD(iso).getTime() - parseD(ref).getTime()) / 86400000
  return beda > 560 ? null : iso
}

const impNorm = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()

/** One name token against the Divisi roster: one hit, several (never guessed), or none (`impCocokNama`, `:3910`). */
export function impCocokNama(token: string, emps: { id: string, name: string }[]): { id: string, name: string } | { ganda: string[] } | null {
  const t = impNorm(token)
  if (t.length < 3) return null
  const kena = emps.filter(u => impNorm(u.name).split(' ').some(w => w === t || (t.length >= 4 && w.includes(t)) || (w.length >= 4 && t.includes(w))))
  if (kena.length === 1) return { id: kena[0]!.id, name: kena[0]!.name }
  if (kena.length > 1) return { ganda: kena.map(u => u.name) }
  return null
}

export interface HasilImpor {
  rows: SelJadwal[]
  cocok: { token: string, ke: string }[]
  lewat: string[]
  ganda: { token: string, kandidat: string[] }[]
  bebas: string[]
  adaTgl: boolean
}

/**
 * Parse a pasted or uploaded schedule (`imporParse`, `:3925`). Dates come only
 * from the sheet, never from the open week; names outside the Divisi roster
 * are skipped, not guessed; a code that is no shift becomes LAIN + cell note.
 */
export function imporParse(teks: string, opts: { emps: { id: string, name: string }[], shifts: Record<string, ShiftDef>, ref: string }): HasilImpor {
  const { emps, shifts, ref } = opts
  const KUNCI: Record<string, string> = {}
  for (const k of Object.keys(shifts)) {
    KUNCI[impNorm(k)] = k
    if (shifts[k]?.n) KUNCI[impNorm(shifts[k].n)] = k
  }
  const KODE_BEBAS = shifts.LAIN ? 'LAIN' : shifts.OFF ? 'OFF' : (Object.keys(shifts)[0] ?? 'LAIN')
  const LEWAT_KATA = new Set(['NO', 'NO.', 'NAMA', 'TGL', 'HARI', 'JABATAN', 'ROLE', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  let kolTgl: Record<number, string> | null = null
  const rows: SelJadwal[] = []
  const cocok: HasilImpor['cocok'] = []
  const lewat: string[] = []
  const ganda: HasilImpor['ganda'] = []
  const bebas: string[] = []
  const seen = new Map<string, number>()
  const sudah = { token: new Set<string>(), lewat: new Set<string>(), bebas: new Set<string>(), ganda: new Set<string>() }
  for (const ln of String(teks || '').replace(/\r/g, '').split('\n')) {
    const sel = ln.split('\t').map(x => x.trim())
    const tg: Record<number, string> = {}
    let nTg = 0
    sel.forEach((c, i) => {
      const d = impTgl(c, ref)
      if (d) {
        tg[i] = d
        nTg++
      }
    })
    if (nTg >= 2) {
      kolTgl = tg
      continue
    }
    if (!kolTgl) continue
    let orang: { id: string, name: string } | null = null
    let token = ''
    for (let i = 0; i < sel.length && i < 4; i++) {
      const c = sel[i]!
      if (!c || LEWAT_KATA.has(c.toUpperCase()) || /^\d+$/.test(c) || KUNCI[impNorm(c)] || impTgl(c, ref)) continue
      if (/\d/.test(c) || c.length > 24) continue
      const hit = impCocokNama(c, emps)
      if (hit && 'id' in hit) {
        orang = hit
        token = c
        break
      }
      if (hit && 'ganda' in hit) {
        if (!sudah.ganda.has(c)) {
          sudah.ganda.add(c)
          ganda.push({ token: c, kandidat: hit.ganda })
        }
        break
      }
      if (/[A-Z]{3,}/i.test(c)) {
        if (!sudah.lewat.has(c)) {
          sudah.lewat.add(c)
          lewat.push(c)
        }
        break
      }
    }
    if (!orang) continue
    if (!sudah.token.has(token)) {
      sudah.token.add(token)
      cocok.push({ token, ke: orang.name })
    }
    for (const [iStr, tgl] of Object.entries(kolTgl as Record<number, string>)) {
      const raw = (sel[Number(iStr)] || '').trim()
      if (!raw) continue
      const kode = KUNCI[impNorm(raw)]
      let t = kode ?? KODE_BEBAS
      let n = ''
      if (!kode) {
        t = KODE_BEBAS
        n = raw.slice(0, 20)
        if (!sudah.bebas.has(raw)) {
          sudah.bebas.add(raw)
          bebas.push(raw)
        }
      }
      const def = shifts[t] ?? { m: '', s: '', libur: 1 }
      const row: SelJadwal = { u: orang.id, d: tgl, t, m: def.libur ? '' : (def.m || ''), s: def.libur ? '' : (def.s || ''), n }
      const key = `${orang.id}|${tgl}`
      if (seen.has(key)) rows[seen.get(key)!] = row
      else {
        seen.set(key, rows.length)
        rows.push(row)
      }
    }
  }
  return { rows, cocok, lewat, ganda, bebas, adaTgl: !!kolTgl }
}

// ------------------------------------------------------------- exports

/**
 * The Talenta import file (`exportExcel`, `:5913`): Employee ID | Employee
 * Name | one column per date. The SHIFT NAME is written (never the cell note),
 * an empty cell stays empty. CSV per K-05 (1).
 */
export function csvJadwal(set: SettingJadwal, sel: PetaSel, kru: KruJadwal[], hari: string[]): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Employee ID', 'Employee Name', ...hari]
  const body = kru.map(u => [u.talentaId || '', u.name, ...hari.map((d) => {
    const c = sel.get(kunciSel(u.id, d))
    return c ? shiftDef(set, c.t).n : ''
  })])
  return [head, ...body].map(r => r.map(q).join(',')).join('\n')
}

const HARI_PJG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

/**
 * WhatsApp text of one Divisi for a week or a month (`exportWA`, `:5502`).
 * Emoji are allowed here: this is message text (DESIGN.md rule 2).
 */
export function teksWA(set: SettingJadwal, sel: PetaSel, kru: KruJadwal[], div: string, hari: string[], judul: string, mingguan: boolean, dw: { divisi: string, tgl: string, nama: string, posisi: string, m: string, s: string }[] = []): string {
  const garis = '━━━━━━━━━━━━━━━'
  let txt = `*JADWAL SHIFT — ${namaDivisiJadwal(div).toUpperCase()}*\n_${judul}_\n${garis}\n`
  const dipakai = new Set<string>()
  let totalKosong = 0
  let adaDW = false
  for (const d of hari) {
    const per: Record<string, string[]> = {}
    let kosong = 0
    for (const u of kru) {
      const c = sel.get(kunciSel(u.id, d))
      if (!c) {
        kosong++
        continue
      }
      ;(per[c.t] ??= []).push(u.name)
    }
    totalKosong += kosong
    const urut = Object.keys(per).sort((a, b) => (shiftDef(set, a).urut || 99) - (shiftDef(set, b).urut || 99))
    urut.forEach(k => dipakai.add(k))
    const dwHari = dw.filter(x => x.divisi === div && x.tgl === d)
    if (dwHari.length) adaDW = true
    const kepala = `${mingguan ? HARI_PJG[idxHari(d)] : HARI_PJG[idxHari(d)]!.slice(0, 3)} · ${tglManusia(d)}${idxHari(d) >= 5 ? ' 🔴' : ''}`
    if (!urut.length && !dwHari.length) {
      txt += mingguan ? `\n*${kepala}*\n_belum diatur_\n` : `*${kepala}* _belum diatur_\n`
      continue
    }
    if (mingguan) {
      txt += `\n*${kepala}*\n`
      for (const k of urut) {
        const sd = shiftDef(set, k)
        txt += `▪ ${sd.n}${sd.libur ? '' : ` _${sd.m}–${sd.s}_`}\n`
        for (const n of per[k]!) txt += `   • ${n}\n`
      }
      if (dwHari.length) {
        txt += '▪ Daily Worker\n'
        for (const x of dwHari) txt += `   • ${x.nama} _(${x.posisi || 'DW'}${x.m && x.s ? ` · ${x.m}–${x.s}` : ''})_\n`
      }
    }
    else {
      const bagian = urut.slice()
        .sort((x, y) => (shiftDef(set, x).libur ? 1 : 0) - (shiftDef(set, y).libur ? 1 : 0))
        .map(k => `${shiftDef(set, k).n}: ${per[k]!.join(', ')}`)
      if (dwHari.length) bagian.push(`DW: ${dwHari.map(x => x.nama).join(', ')}`)
      txt += `*${kepala}* ${bagian.join(' · ')}\n`
    }
  }
  txt += `\n${garis}\n`
  const legenda = [...dipakai]
    .sort((x, y) => (shiftDef(set, x).urut || 99) - (shiftDef(set, y).urut || 99))
    .filter(k => !shiftDef(set, k).libur)
    .map(k => `${shiftDef(set, k).n} ${shiftDef(set, k).m}–${shiftDef(set, k).s}`)
  if (legenda.length) txt += `_${legenda.join('  ·  ')}_\n`
  if (adaDW) txt += '_DW = daily worker (pekerja harian)_\n'
  if (totalKosong) txt += `_⚠️ ${totalKosong} sel belum diatur_\n`
  return `${txt}_Laksamana Muda_`
}

/** Download text as a UTF-8 CSV with BOM, for Excel. */
export function unduhCsvJadwal(nama: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nama
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ------------------------------------------------------------- Rekap Pegawai

/** Hours between today's shift end and tomorrow's start; null when either is off/empty (`jedaKeBesok`, `:3084`). */
export function jedaKeBesok(set: SettingJadwal, sel: PetaSel, uid: string, tgl: string): number | null {
  const c1 = sel.get(kunciSel(uid, tgl))
  const c2 = sel.get(kunciSel(uid, tambahHari(tgl, 1)))
  if (!c1 || !c2 || shiftDef(set, c1.t).libur || shiftDef(set, c2.t).libur) return null
  const j1 = jamSel(set, c1)
  const j2 = jamSel(set, c2)
  if (!j1 || !j2) return null
  const men = (t: string) => {
    const q = t.split(':')
    return Number(q[0]) * 60 + Number(q[1])
  }
  let selesai = men(j1.s)
  if (selesai <= men(j1.m)) selesai += 1440
  return Math.round((1440 + men(j2.m) - selesai) / 60 * 10) / 10
}

/** Weekend days worked and the shortest rest between shifts (`rekapDetail`, `:3166`). */
export function rekapDetail(set: SettingJadwal, sel: PetaSel, uid: string, mk: string) {
  const z = akhirBulan(mk)
  let wknd = 0
  let jedaMin: number | null = null
  for (let d = awalBulan(mk); d <= z; d = tambahHari(d, 1)) {
    const c = sel.get(kunciSel(uid, d))
    if (c && !shiftDef(set, c.t).libur && idxHari(d) >= 5) wknd++
    if (d < z) {
      const j = jedaKeBesok(set, sel, uid, d)
      if (j !== null && (jedaMin === null || j < jedaMin)) jedaMin = j
    }
  }
  return { wknd, jedaMin }
}

/** How often each shift code was used in the month (`rincianShift`, `:3157`). */
export function rincianShift(sel: PetaSel, uid: string, mk: string): Record<string, number> {
  const n: Record<string, number> = {}
  for (let d = awalBulan(mk); d <= akhirBulan(mk); d = tambahHari(d, 1)) {
    const c = sel.get(kunciSel(uid, d))
    if (c) n[c.t] = (n[c.t] ?? 0) + 1
  }
  return n
}

/** A job title that only repeats the Divisi name is not shown twice (`jabatanSetara`). */
export function jabatanSetara(jab: string, div: string): boolean {
  const rapi = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const j = rapi(jab)
  return !j || j === rapi(namaDivisiJadwal(div))
}

// ------------------------------------------------------------- Data Pegawai

/** Picklists of the HR columns (deploy/jadwal/index.html:1961-1964). */
export const HR_BRANCH = ['PT Laksamana Indonesia Nusantara']
export const HR_ORG = ['Office', 'FOH', 'Cashier', 'Kitchen', 'Bar']
export const HR_LEVEL = ['Staff', 'Karyawan']
export const HR_STATUS = ['Contract', 'Probation', 'Permanent']

/**
 * Display-only hint of which sheet a Tim value lands on (`hintDivisiForm`).
 * The SERVER resolves the real Divisi (GET /jadwal/roster); this copy of the
 * synonyms (`DIV_SINONIM`, :796) only explains the form while typing.
 */
const DIV_SINONIM: Record<string, string[]> = {
  bar: ['bar', 'bartender'],
  kitchen: ['kitchen', 'dapur'],
  floor: ['floor', 'service', 'waiter', 'waitress', 'host', 'hostess', 'foh'],
  cashier: ['cashier', 'kasir'],
}
export function divisiDariTim(keterangan: string): string {
  if (stafKantor(keterangan)) return DIV_NONSHIFT
  const kata = String(keterangan || '').toLowerCase().split(/[^a-z]+/).filter(Boolean)
  for (const d of DIVISI) {
    if ((DIV_SINONIM[d.k] ?? [d.k]).some(x => kata.includes(x))) return d.k
  }
  return DIV_NONSHIFT
}
