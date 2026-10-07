// Daily Worker — the pure rules of the old panel (laksamana-office
// deploy/dw/index.html), no Vue and no API. Screens and useDw.ts import from
// here so a rule lives in one place.
//
// The four Divisi codes are NOT defined here: they are imported from
// utils/jadwal.ts, because they must be identical in both modules (F.2,
// CLAUDE.md:7192). Renaming one in a copy makes every DW of that division
// disappear from the Jadwal sheet without a single error.
//
// Money: tariffs live in the setting blob and every calculation happens here
// (tarif, long-shift bonus, weekly grouping) — the server stores no pay logic
// (dw.md §Payments). `hadirDibayar` is the ONE place that decides whether a
// shift is paid.
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import { DIVISI, idxHari, namaDivisiJadwal, seninDari } from '~/utils/jadwal'
import { hariIni, tambahHari } from '~/utils/format'

// ---------------------------------------------------------------- constants

/** Position defaults per Divisi (`POSISI_DIVISI`, deploy/dw/index.html:1026). */
export const POSISI_DIVISI: Record<string, string[]> = {
  bar: ['Bar Helper', 'Dishwasher'],
  kitchen: ['Kitchen Helper', 'Dishwasher'],
  floor: ['Waiter/Waitress', 'Host', 'Cleaning'],
  cashier: ['Cashier'],
}

/** Retired positions that must not revive through an old stored list (`POSISI_CABUT`, :1037). */
export const POSISI_CABUT = ['Runner', 'Event Crew']

/** Only two worker states, on purpose (`STATUS_DW`, :1090). */
export const STATUS_DW: Record<string, { n: string, k: string }> = {
  AKTIF: { n: 'Aktif', k: 'Boleh masuk sistem dan dijadwalkan' },
  NONAKTIF: { n: 'Nonaktif', k: 'Tidak bisa masuk sistem lagi' },
}

/** Legacy statuses map onto the two current ones (`STATUS_DW_LAMA`, :1099). */
export const STATUS_DW_LAMA: Record<string, string> = { PANTAU: 'AKTIF', BLOKIR: 'NONAKTIF' }

/** Request/assignment status words (`STATUS_AJU`, :1103). */
export const STATUS_AJU_DW: Record<string, string> = {
  MENUNGGU: 'Menunggu HR',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  BATAL: 'Dibatalkan',
  KEDALUWARSA: 'Lewat tanggal',
}

/** Attendance words (`HADIR_LBL`, :1127). Empty = unconfirmed, still paid. */
export const HADIR_LBL: Record<string, string> = {
  HADIR: 'Hadir',
  TELAT: 'Telat',
  ALFA: 'Tidak hadir',
}

/** Payment destinations (`BAYAR`, :1176). Icons are Lucide, chosen in components. */
export const BAYAR: Record<string, { n: string, ket: string, hint: string }> = {
  BANK: { n: 'Transfer Bank', ket: 'No. rekening', hint: 'Angka rekeningnya saja — nama banknya di kolom sebelah kiri.' },
  GOPAY: { n: 'GoPay', ket: 'No. HP GoPay', hint: 'Nomor HP yang terdaftar di GoPay' },
  DANA: { n: 'DANA', ket: 'No. HP DANA', hint: 'Nomor HP yang terdaftar di DANA' },
}

/** Shared bank suggestions; the field itself is free text (`BANK_UMUM`, :1201). */
export const BANK_UMUM = [
  'BCA', 'Mandiri', 'BNI', 'BRI', 'BTN', 'BPD Bali', 'CIMB Niaga', 'Permata',
  'Danamon', 'Panin', 'OCBC', 'Maybank', 'Mega', 'Sinarmas', 'BSI', 'Muamalat',
  'Bank Jago', 'SeaBank', 'blu BCA Digital', 'Neo Commerce', 'Jenius (BTPN)',
]

/** Day contexts for the quota guide; only three (`KONTEKS`, :1589). */
export const KONTEKS = ['biasa', 'weekend', 'event'] as const
export type KonteksHari = typeof KONTEKS[number]
export const KONTEKS_LBL: Record<KonteksHari, string> = { biasa: 'Hari biasa', weekend: 'Akhir pekan', event: 'Hari event' }

/** Default quota per Divisi per context (`KUOTA_BAWAAN`, :1591). */
export const KUOTA_BAWAAN: Record<string, Record<KonteksHari, number>> = {
  bar: { biasa: 2, weekend: 3, event: 4 },
  kitchen: { biasa: 3, weekend: 4, event: 6 },
  floor: { biasa: 4, weekend: 6, event: 8 },
  cashier: { biasa: 1, weekend: 1, event: 2 },
}

/** Default tariffs (`normalSetting`, :1621). Only a starting point; HRD edits them. */
export const TARIF_BAWAAN: Record<string, number> = {
  'Kitchen Helper': 140000, 'Bar Helper': 140000, 'Waiter/Waitress': 130000,
  'Host': 135000, 'Cashier': 140000, 'Runner': 115000, 'Dishwasher': 110000,
  'Cleaning': 110000, 'Event Crew': 160000,
}

/** The confirmation keyword of the danger zone (`KOSONG_SANDI`, :7895). */
export const KOSONG_SANDI = 'HAPUS SEMUA'

// ---------------------------------------------------------------- types

export interface JamSiap { n: string, m: string, s: string }

/** One Daily Worker, normalised (`normalizeState`, :1479). */
export interface PekerjaDw {
  id: string
  nama: string
  hp: string
  gender: string
  area: string
  bank: string
  bayarJenis: string
  bayarBank: string
  bayarNomor: string
  bayarNama: string
  /** CSV, first is the main one (`dw_pekerja.divisi`). */
  divisi: string
  posisi: string
  skill: string
  status: string
  catatan: string
  dibuatAt: number
  terakhirKerja: string
  kerjaBulanIni: number
}

/** One assignment (ajuan), normalised (`normalizeState`, :1504). */
export interface AjuanDw {
  id: string
  dwId: string
  tgl: string
  m: string
  s: string
  divisi: string
  posisi: string
  catatan: string
  status: string
  dibuatAt: number
  dibuatOleh: string
  hadir: string
  hadirNota: string
  hadirOleh: string
  hadirAt: number
  putusAt: number
  putusOleh: string
  putusNota: string
  permintaanId: string
}

/** One head request (permintaan), normalised (`normalizeState`, :1536). */
export interface PermintaanDw {
  id: string
  divisi: string
  tgl: string
  m: string
  s: string
  posisi: string
  jumlah: number
  catatan: string
  status: string
  dibuatAt: number
  dibuatOleh: string
  diubahAt: number
  diubahOleh: string
  putusAt: number
  putusOleh: string
  putusNota: string
  usulan: string[]
}

/** The server-computed role (`data.peran`, dw.md §Reads). */
export interface PeranDw {
  hrd: boolean
  head: boolean
  lihat: boolean
  admin: boolean
  nama: string
  divisi: string[]
}

export interface SettingDw {
  tarif: Record<string, number>
  jam: JamSiap[]
  posisiDivisi: Record<string, string[]>
  kuota: Record<string, Record<KonteksHari, number>>
  hr: string[]
  bayarLunas: Record<string, { at?: number, oleh?: string }>
  akses: Record<string, Record<string, number>>
  jamDasar: number
  jamBatas: number
  tambahanPanjang: number
  [k: string]: unknown
}

/** The whole bootstrap of GET /dw/overview, normalised. */
export interface DwState {
  setting: SettingDw
  pekerja: PekerjaDw[]
  ajuan: AjuanDw[]
  permintaan: PermintaanDw[]
  peran: PeranDw
}

const peta = <T>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, T> : {})

// ---------------------------------------------------------------- normalise

export function statusDw(v: unknown): string {
  const s = String(v || 'AKTIF').toUpperCase()
  const p = STATUS_DW_LAMA[s] || s
  return STATUS_DW[p] ? p : 'AKTIF'
}

export function bayarJenisSah(v: unknown): string {
  const k = String(v || '').toUpperCase()
  return BAYAR[k] ? k : 'BANK'
}

function normalPosisiDivisi(s: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const ada = (s.posisiDivisi && typeof s.posisiDivisi === 'object') ? s.posisiDivisi as Record<string, unknown> : null
  for (const d of DIVISI) {
    const list = ada && Array.isArray(ada[d.k]) ? (ada[d.k] as unknown[]).map(String).map(x => x.trim()) : null
    out[d.k] = list
      ? list.filter((x, i, a) => x && a.indexOf(x) === i)
      : (POSISI_DIVISI[d.k] ?? []).slice()
  }
  if (!ada) {
    const bawaan: Record<string, number> = {}
    for (const k of Object.keys(POSISI_DIVISI)) for (const x of POSISI_DIVISI[k]!) bawaan[x] = 1
    for (const x of Array.isArray(s.posisi) ? (s.posisi as unknown[]) : []) {
      const v = String(x || '').trim()
      if (!v || bawaan[v] || POSISI_CABUT.includes(v)) continue
      for (const d of DIVISI) out[d.k]!.push(v)
    }
  }
  return out
}

function normalKuota(x: unknown): Record<string, Record<KonteksHari, number>> {
  const s = (x && typeof x === 'object') ? x as Record<string, unknown> : {}
  const out: Record<string, Record<KonteksHari, number>> = {}
  for (const d of DIVISI) {
    const bawaan = KUOTA_BAWAAN[d.k] ?? { biasa: 0, weekend: 0, event: 0 }
    const v = s[d.k]
    if (typeof v === 'number') out[d.k] = { biasa: v, weekend: v, event: v }
    else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      const baris = {} as Record<KonteksHari, number>
      for (const k of KONTEKS) baris[k] = typeof obj[k] === 'number' ? Math.max(0, obj[k] as number) : (bawaan[k] || 0)
      out[d.k] = baris
    }
    else out[d.k] = { ...bawaan }
  }
  return out
}

/** Setting blob, complete with defaults (`normalSetting`, :1616). */
export function normalSettingDw(raw: unknown): SettingDw {
  const s = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const jam = Array.isArray(s.jam) && s.jam.length
    ? (s.jam as unknown[]).map((j) => {
        const o = (j && typeof j === 'object') ? j as Record<string, unknown> : {}
        return { n: String(o.n || 'Shift'), m: String(o.m || ''), s: String(o.s || '') }
      })
    : [
        { n: 'Pagi', m: '08:00', s: '17:00' },
        { n: 'Middle', m: '11:00', s: '20:00' },
        { n: 'Siang', m: '14:00', s: '23:00' },
        { n: 'Event', m: '16:00', s: '23:59' },
      ]
  return {
    ...s,
    tarif: (s.tarif && typeof s.tarif === 'object') ? s.tarif as Record<string, number> : { ...TARIF_BAWAAN },
    jam,
    posisiDivisi: normalPosisiDivisi(s),
    kuota: normalKuota(s.kuota),
    hr: Array.isArray(s.hr) ? s.hr.map(String).filter(Boolean) : [],
    bayarLunas: peta<{ at?: number, oleh?: string }>(s.bayarLunas),
    akses: peta<Record<string, number>>(s.akses),
    jamDasar: Number(s.jamDasar) > 0 ? Number(s.jamDasar) : 6,
    jamBatas: Number(s.jamBatas) > 0 ? Number(s.jamBatas) : 12,
    tambahanPanjang: s.tambahanPanjang == null ? 20000 : Math.max(0, Number(s.tambahanPanjang) || 0),
  }
}

function normalPekerja(p: Record<string, unknown>): PekerjaDw {
  return {
    id: String(p.id),
    nama: String(p.nama || ''),
    hp: String(p.hp || ''),
    gender: String(p.gender || ''),
    area: String(p.area || ''),
    bank: String(p.bank || ''),
    bayarJenis: bayarJenisSah(p.bayarJenis),
    bayarBank: String(p.bayarBank || ''),
    bayarNomor: String(p.bayarNomor || ''),
    bayarNama: String(p.bayarNama || ''),
    divisi: String(p.divisi || ''),
    posisi: String(p.posisi || ''),
    skill: String(p.skill || ''),
    status: statusDw(p.status),
    catatan: String(p.catatan || ''),
    dibuatAt: Number(p.dibuatAt) || 0,
    terakhirKerja: String(p.terakhirKerja || ''),
    kerjaBulanIni: Number(p.kerjaBulanIni) || 0,
  }
}

function normalAjuan(a: Record<string, unknown>): AjuanDw {
  return {
    id: String(a.id),
    dwId: String(a.dwId || ''),
    tgl: String(a.tgl || ''),
    m: String(a.m || ''),
    s: String(a.s || ''),
    divisi: String(a.divisi || ''),
    posisi: String(a.posisi || ''),
    catatan: String(a.catatan || ''),
    status: String(a.status || 'MENUNGGU'),
    dibuatAt: Number(a.dibuatAt) || 0,
    dibuatOleh: String(a.dibuatOleh || ''),
    hadir: String(a.hadir || ''),
    hadirNota: String(a.hadirNota || ''),
    hadirOleh: String(a.hadirOleh || ''),
    hadirAt: Number(a.hadirAt) || 0,
    putusAt: Number(a.putusAt) || 0,
    putusOleh: String(a.putusOleh || ''),
    putusNota: String(a.putusNota || ''),
    permintaanId: String(a.permintaanId || ''),
  }
}

function normalPermintaan(x: Record<string, unknown>): PermintaanDw {
  return {
    id: String(x.id),
    divisi: String(x.divisi || ''),
    tgl: String(x.tgl || ''),
    m: String(x.m || ''),
    s: String(x.s || ''),
    posisi: String(x.posisi || ''),
    jumlah: Number(x.jumlah) || 0,
    catatan: String(x.catatan || ''),
    status: String(x.status || 'MENUNGGU'),
    dibuatAt: Number(x.dibuatAt) || 0,
    dibuatOleh: String(x.dibuatOleh || ''),
    diubahAt: Number(x.diubahAt) || 0,
    diubahOleh: String(x.diubahOleh || ''),
    putusAt: Number(x.putusAt) || 0,
    putusOleh: String(x.putusOleh || ''),
    putusNota: String(x.putusNota || ''),
    usulan: Array.isArray(x.usulan) ? (x.usulan as unknown[]).map(String) : [],
  }
}

/** Never trust the shape the server sends (`normalizeState`, :1467). */
export function normalDw(raw: unknown): DwState {
  const d = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const pr = (d.peran && typeof d.peran === 'object') ? d.peran as Record<string, unknown> : {}
  return {
    setting: normalSettingDw(d.setting),
    pekerja: (Array.isArray(d.pekerja) ? d.pekerja : []).filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && !!(p as Record<string, unknown>).id).map(normalPekerja),
    ajuan: (Array.isArray(d.ajuan) ? d.ajuan : []).filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && !!(a as Record<string, unknown>).id).map(normalAjuan),
    permintaan: (Array.isArray(d.permintaan) ? d.permintaan : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !!(x as Record<string, unknown>).id).map(normalPermintaan),
    peran: {
      hrd: !!pr.hrd,
      head: !!pr.head,
      lihat: !!pr.lihat,
      admin: !!pr.admin,
      nama: String(pr.nama || ''),
      divisi: Array.isArray(pr.divisi) ? (pr.divisi as unknown[]).map(String) : [],
    },
  }
}

// ---------------------------------------------------------------- people

export const namaDw = (pekerja: PekerjaDw[], dwId: string): string =>
  pekerja.find(p => p.id === dwId)?.nama ?? '(DW dihapus)'

export function csvDaftar(v: unknown): string[] {
  return String(v ?? '').split(',').map(x => x.trim()).filter((x, i, a) => x !== '' && a.indexOf(x) === i)
}
export const divPekerja = (p: PekerjaDw | null | undefined) => csvDaftar(p?.divisi)
export const posPekerja = (p: PekerjaDw | null | undefined) => csvDaftar(p?.posisi)
export const divUtama = (p: PekerjaDw | null | undefined) => divPekerja(p)[0] ?? ''
export const posUtama = (p: PekerjaDw | null | undefined) => posPekerja(p)[0] ?? ''
export const punyaDiv = (p: PekerjaDw | null | undefined, div: string) => divPekerja(p).includes(div)
export const punyaPos = (p: PekerjaDw | null | undefined, pos: string) => posPekerja(p).includes(pos)

/** "Bar + 1" for narrow columns; the full list is the tooltip. */
export function ringkasDivPekerja(p: PekerjaDw): string {
  const d = divPekerja(p)
  if (!d.length) return '—'
  if (d.length === 1) return namaDivisiJadwal(d[0]!)
  return `${namaDivisiJadwal(d[0]!)} +${d.length - 1}`
}

/** "terakhir 3 hari lalu · 4× bulan ini" (`riwayatPakaiHTML`, :5976). */
export function riwayatPakaiDw(p: PekerjaDw, ref = hariIni()): string {
  const bulan = p.kerjaBulanIni ? ` · ${p.kerjaBulanIni}× bulan ini` : ''
  if (!p.terakhirKerja) return `belum pernah dipakai${bulan}`
  const beda = Math.round((Date.parse(`${ref}T00:00:00`) - Date.parse(`${p.terakhirKerja}T00:00:00`)) / 86400000)
  const teks = beda <= 0 ? 'hari ini' : beda === 1 ? 'kemarin' : beda < 30 ? `${beda} hari lalu` : `${Math.round(beda / 30)} bulan lalu`
  return `· ${teks}${bulan}`
}

/** Posisi that may be picked in one Divisi (`posisiDivisi`, :1042). */
export const posisiDivisiDw = (set: SettingDw, div: string): string[] => {
  const list = set.posisiDivisi[div]
  return Array.isArray(list) ? list.slice() : (POSISI_DIVISI[div] ?? []).slice()
}

/** Every position used in the module, no duplicates (`posisiSemua`, :1050). */
export function posisiSemuaDw(set: SettingDw): string[] {
  const out: string[] = []
  for (const d of DIVISI) for (const x of posisiDivisiDw(set, d.k)) if (!out.includes(x)) out.push(x)
  return out
}

/** Select options with the stored-but-retired value kept as "(lama)" (`opsiPosisi`, :1062). */
export function opsiPosisiDw(set: SettingDw, div: string, terpilih: string): { value: string, label: string }[] {
  const sah = posisiDivisiDw(set, div)
  const list = sah.slice()
  const t = String(terpilih || '')
  if (t && !list.includes(t)) list.push(t)
  return list.map(x => ({ value: x, label: sah.includes(x) ? x : `${x} (lama)` }))
}

export const posisiBawaanDivisiDw = (set: SettingDw, div: string) => posisiDivisiDw(set, div)[0] ?? ''

/** Active candidates for one Divisi (+position); order per `urut` (`kandidatDW`, :3125). */
export function kandidatDw(pekerja: PekerjaDw[], divisi: string, posisi: string, urut: 'sering' | 'lama'): PekerjaDw[] {
  const aktif = pekerja.filter(p => p.status === 'AKTIF')
  const diDiv = aktif.filter(p => punyaDiv(p, divisi))
  const list = posisi ? diDiv.filter(p => punyaPos(p, posisi)) : diDiv
  const kapan = (p: PekerjaDw) => (p.terakhirKerja ? Date.parse(`${p.terakhirKerja}T00:00:00`) : 0)
  const nm = (a: PekerjaDw, b: PekerjaDw) => String(a.nama || '').localeCompare(String(b.nama || ''))
  return list.slice().sort(urut === 'sering'
    ? (a, b) => (b.kerjaBulanIni || 0) - (a.kerjaBulanIni || 0) || kapan(b) - kapan(a) || nm(a, b)
    : (a, b) => kapan(a) - kapan(b) || nm(a, b))
}

/** The three ways a person can be registered, in words the payment column reuses. */
export function labelTujuanDw(p: PekerjaDw | null): string {
  if (!p) return 'Data DW terhapus'
  const k = bayarJenisSah(p.bayarJenis)
  const j = BAYAR[k]!
  const nm = (k === 'BANK' && p.bayarBank) ? String(p.bayarBank) : j.n
  if (!p.bayarNomor) return `${nm} — nomor belum diisi`
  return `${nm} ${p.bayarNomor}${p.bayarNama ? ` a.n. ${p.bayarNama}` : ` a.n. ${p.nama}`}`
}

export function normalHp(v: unknown): string {
  let d = String(v ?? '').replace(/\D+/g, '')
  if (!d) return ''
  if (d.slice(0, 2) === '62') d = `0${d.slice(2)}`
  else if (d[0] !== '0') d = `0${d}`
  return d.slice(0, 20)
}

/** A bank list for the datalist: defaults + what other workers already use (`opsiBankHTML`, :1207). */
export function bankDipakaiDw(pekerja: PekerjaDw[]): string[] {
  const ada: Record<string, number> = {}
  const out: string[] = []
  for (const b of BANK_UMUM) {
    ada[b.toLowerCase()] = 1
    out.push(b)
  }
  for (const p of pekerja) {
    const b = String(p.bayarBank || '').trim()
    if (!b || ada[b.toLowerCase()]) continue
    ada[b.toLowerCase()] = 1
    out.push(b)
  }
  return out
}

// ---------------------------------------------------------------- time & money

export const jamTambah = (j: string, menit: number): string => {
  const p = String(j || '').split(':')
  let t = ((Number(p[0]) || 0) * 60 + (Number(p[1]) || 0) + (menit || 0)) % 1440
  if (t < 0) t += 1440
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`
}

export const cocokJamSiap = (set: SettingDw, m: string, s: string) =>
  (set.jam || []).some(j => j.m === m && j.s === s)

const menitJamDw = (x: string) => {
  const p = String(x || '').split(':')
  return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0)
}
const durasiMenitDw = (m: string, s: string) => {
  const a = menitJamDw(m)
  let b = menitJamDw(s)
  if (b <= a) b += 1440
  return b - a
}

/** Hours between two clock times; past midnight wraps (`durasiJam`, :1401). */
export const durasiJamDw = (m: string, s: string) => Math.round((durasiMenitDw(m, s) / 60) * 10) / 10
export const bulat1 = (n: number) => Math.round(n * 10) / 10

export const tarifPosisiDw = (set: SettingDw, p: string) => Number(set.tarif[p]) || 0
export const jamDasarDw = (set: SettingDw) => (Number(set.jamDasar) > 0 ? Number(set.jamDasar) : 6)
export const jamBatasDw = (set: SettingDw) => (Number(set.jamBatas) > 0 ? Number(set.jamBatas) : 12)
export const tambahanPanjangDw = (set: SettingDw) => (Number(set.tambahanPanjang) >= 0 ? Number(set.tambahanPanjang) : 20000)

/** Long-shift bonus for one time range (`tambahanJam`, :1800). */
export const tambahanJamDw = (set: SettingDw, m: string, s: string) =>
  durasiJamDw(m, s) > jamDasarDw(set) ? tambahanPanjangDw(set) : 0

/** True when the shift is at/over the sanity limit — a warning, not a price (`shiftKepanjangan`, :1803). */
export const shiftKepanjanganDw = (set: SettingDw, m: string, s: string) =>
  durasiJamDw(m, s) >= jamBatasDw(set)

export const biayaSatuOrangDw = (set: SettingDw, posisi: string, m: string, s: string): number =>
  tarifPosisiDw(set, posisi) + tambahanJamDw(set, m, s)

/** ONE calculation for assignments AND requests (`biayaAjuan`/`biayaPermintaan`, :1804-1813). */
export const biayaAjuanDw = (set: SettingDw, a: Pick<AjuanDw, 'posisi' | 'm' | 's'>) =>
  biayaSatuOrangDw(set, a.posisi, a.m, a.s)

export const biayaPermintaanDw = (set: SettingDw, x: Pick<PermintaanDw, 'posisi' | 'm' | 's' | 'jumlah'>) =>
  biayaSatuOrangDw(set, x.posisi, x.m, x.s) * Math.max(1, Number(x.jumlah) || 1)

// ---------------------------------------------------------------- attendance

export const hadirNilai = (a: Pick<AjuanDw, 'hadir'> | null | undefined) => String(a?.hadir ?? '')

/** Is this shift paid? ALFA is not; '', HADIR and TELAT are (`hadirDibayar`, :1137). */
export const hadirDibayar = (a: AjuanDw) => hadirNilai(a) !== 'ALFA'

/** Approved but not yet confirmed (`hadirBelum`, :1163). */
export const hadirBelum = (a: AjuanDw) => a.status === 'DISETUJUI' && hadirNilai(a) === ''

export const ajuanDibayarDw = (list: AjuanDw[]) => list.filter(hadirDibayar)
export const biayaListDw = (set: SettingDw, list: AjuanDw[]) => ajuanDibayarDw(list).reduce((n, a) => n + biayaAjuanDw(set, a), 0)
export const jamListDw = (set: SettingDw, list: AjuanDw[]) => ajuanDibayarDw(list).reduce((n, a) => n + durasiJamDw(a.m, a.s), 0)
export const alfaListDw = (list: AjuanDw[]) => list.length - ajuanDibayarDw(list).length

// ---------------------------------------------------------------- access

/** Pages that are HR-ish by default (`HALAMAN_HR`, :2264); `bayar` is HRD only. */
export const HALAMAN_HR_DW = ['pekerja', 'rekap']
/** Pages the matrix may not open (`HALAMAN_KUNCI`, :2269). */
export const HALAMAN_KUNCI_DW = ['akses']

export const AKSES_KOLOM_DW: { k: string, t: string, ket: string }[] = [
  { k: 'staf', t: 'Staf Office', ket: 'punya modul ini' },
  { k: 'head', t: 'Head Divisi', ket: 'ditunjuk di Jadwal Shift' },
  { k: 'hrd', t: 'HRD', ket: 'dicentang di bawah' },
  { k: 'admin', t: 'Admin Modul', ket: 'dari Kelola Akses Office' },
]

/** The default rule: page × role → may open (`bolehBukaBawaan`, :2275). */
export function bolehBukaBawaanDw(k: string, peran: string): boolean {
  const admin = peran === 'admin'
  const hrd = peran === 'hrd' || peran === 'admin'
  const head = peran === 'head'
  const lihat = hrd || head
  if (k === 'akses') return admin
  if (k === 'hadir') return lihat
  if (k === 'bayar') return hrd
  if (k === 'pengaturan') return admin || hrd
  if (k === 'antrean') return hrd
  if (k === 'permintaan') return head || hrd
  if (HALAMAN_HR_DW.includes(k)) return lihat
  return true
}

/** The stored matrix wins, except for locked pages (`bolehBukaPeran`, :2341). */
export function bolehBukaPeranDw(akses: Record<string, Record<string, number>>, k: string, peran: string): boolean {
  if (HALAMAN_KUNCI_DW.includes(k)) return bolehBukaBawaanDw(k, peran)
  const baris = akses[k]
  if (baris && typeof baris === 'object' && baris[peran] != null) return !!baris[peran]
  return bolehBukaBawaanDw(k, peran)
}

/** Held roles, 'staf' always included (`peranSayaDW`, :2352). */
export function peranSayaDw(p: Pick<PeranDw, 'admin' | 'hrd' | 'head'>): string[] {
  const out: string[] = []
  if (p.admin) out.push('admin')
  if (p.hrd) out.push('hrd')
  if (p.head) out.push('head')
  out.push('staf')
  return out
}

/** Final answer for the sidebar (`bolehBuka`, :2360). */
export const bolehBukaDw = (set: SettingDw, p: PeranDw, k: string) =>
  peranSayaDw(p).some(peran => bolehBukaPeranDw(set.akses, k, peran))

/** HRD sees every division; a head only their own (`divisiTampakDW`, :6561). */
export function divisiTampakDw(p: PeranDw): string[] {
  if (p.hrd || p.admin) return DIVISI.map(d => d.k)
  return DIVISI.map(d => d.k).filter(k => p.divisi.includes(k))
}

/** Divisions this person may write in (`divisiKuasaDW`, :2881). */
export function divisiKuasaDw(p: PeranDw): string[] {
  if (p.hrd) return DIVISI.map(d => d.k)
  return DIVISI.map(d => d.k).filter(k => p.divisi.includes(k))
}

/** May write in the open Division's sheet (`bolehIsiKalender`, :4978). */
export const bolehIsiKalenderDw = (p: PeranDw, div: string) =>
  p.hrd || divisiKuasaDw(p).includes(div)

/** Head of this division sees requests/rows; HRD everything (`punya`, :2658). */
export const divisiKahDw = (a: { divisi: string }, p: PeranDw) =>
  (p.hrd || p.admin) || p.divisi.includes(a.divisi)

/** HRD only sees money (`bolehLihatUang`, :1831). */
export const bolehLihatUangDw = (p: PeranDw) => p.hrd

/** May touch this row's attendance (`bolehKonfirmasi`, :6566). */
export function bolehKonfirmasiDw(a: AjuanDw | null, p: PeranDw): boolean {
  if (!a || a.status !== 'DISETUJUI') return false
  if (p.hrd) return true
  return p.divisi.includes(a.divisi)
}

/** Approved shifts, on/ before today, unconfirmed (`hadirTertunggak`, :6577). */
export function hadirTertunggakDw(ajuan: AjuanDw[], p: PeranDw, ref = hariIni()): AjuanDw[] {
  return ajuan.filter(a => hadirBelum(a) && a.tgl <= ref && bolehKonfirmasiDw(a, p))
}

/** "Hari ini / Besok / N hari lagi / lewat" (`segeraHTML`, :2955). */
export function segeraDw(tgl: string, ref = hariIni()): { teks: string, tone: 'lewat' | 'kini' | 'dekat' } | null {
  const beda = Math.round((Date.parse(`${tgl}T00:00:00`) - Date.parse(`${ref}T00:00:00`)) / 86400000)
  if (beda < 0) return { teks: 'lewat', tone: 'lewat' }
  if (beda === 0) return { teks: 'hari ini', tone: 'kini' }
  if (beda === 1) return { teks: 'besok', tone: 'kini' }
  if (beda <= 3) return { teks: `${beda} hari lagi`, tone: 'dekat' }
  return null
}

export const tglLampau = (tgl: string, ref = hariIni()) => String(tgl) < ref

// ---------------------------------------------------------------- requests & queue

export const ajuanHidup = (a: AjuanDw) => a.status === 'MENUNGGU' || a.status === 'DISETUJUI'

export const ajuanOrangTgl = (ajuan: AjuanDw[], dwId: string, tgl: string) =>
  ajuan.filter(a => a.dwId === dwId && a.tgl === tgl && ajuanHidup(a))

/** Do two clock ranges overlap (`jamBertindih`, :5853)? */
export function jamBertindih(m1: string, s1: string, m2: string, s2: string): boolean {
  const a1 = menitJamDw(m1)
  let b1 = menitJamDw(s1)
  if (b1 <= a1) b1 += 1440
  const a2 = menitJamDw(m2)
  let b2 = menitJamDw(s2)
  if (b2 <= a2) b2 += 1440
  return Math.max(a1, a2) < Math.min(b1, b2)
}

/** Neighbour days shift by ±1440 (`jamBertindihOffset`, :5798). */
export function jamBertindihOffset(m1: string, s1: string, off: number, m2: string, s2: string): boolean {
  const a1 = menitJamDw(m1) + off
  const b1 = a1 + durasiMenitDw(m1, s1)
  const a2 = menitJamDw(m2)
  const b2 = a2 + durasiMenitDw(m2, s2)
  return Math.max(a1, a2) < Math.min(b1, b2)
}

/** The overlapping live assignment of one worker, across ±1 day (`bentrokOrangJam`, :5784). */
export function bentrokOrangJam(ajuan: AjuanDw[], dwId: string, tgl: string, m: string, s: string, abaikan?: string): AjuanDw | null {
  const hari = [tambahHari(tgl, -1), tgl, tambahHari(tgl, 1)]
  return ajuan.find((a) => {
    if (a.dwId !== dwId) return false
    if (!ajuanHidup(a)) return false
    if (!hari.includes(a.tgl)) return false
    if (abaikan && a.id === abaikan) return false
    const off = a.tgl === tgl ? 0 : (a.tgl < tgl ? -1440 : 1440)
    return jamBertindihOffset(a.m, a.s, off, m, s)
  }) ?? null
}

/** Already suggested by ANOTHER head for the same date (`usulanOrangTgl`, :5828). */
export function usulanOrangTgl(permintaan: PermintaanDw[], dwId: string, tgl: string, divisi: string, kecualiId?: string, m?: string, s?: string): PermintaanDw | null {
  return permintaan.find((x) => {
    if (x.status !== 'MENUNGGU') return false
    if (x.tgl !== tgl) return false
    if (kecualiId && x.id === kecualiId) return false
    if (divisi && x.divisi === divisi) return false
    if (!x.usulan.includes(dwId)) return false
    if (!m || !s) return true
    return jamBertindihOffset(x.m, x.s, 0, m, s)
  }) ?? null
}

/** How many live assignments point at one request (`mintaTerpenuhi`, :2890). */
export const mintaTerpenuhi = (ajuan: AjuanDw[], id: string) =>
  ajuan.filter(a => a.permintaanId === id && ajuanHidup(a)).length

export const mintaOrang = (ajuan: AjuanDw[], id: string) =>
  ajuan.filter(a => a.permintaanId === id && ajuanHidup(a))

/** Still needs work: waiting, or approved but not fully staffed (`mintaBelumTuntas`, :2935). */
export function mintaBelumTuntas(ajuan: AjuanDw[], x: PermintaanDw | null): boolean {
  if (!x) return false
  if (x.status === 'MENUNGGU') return true
  if (x.status !== 'DISETUJUI') return false
  return mintaTerpenuhi(ajuan, x.id) < Math.max(1, Number(x.jumlah) || 1)
}

/** Fully satisfied requests are told by their assignment rows (`mintaTerwakiliAjuan`, :2913). */
export const mintaTerwakiliAjuan = (ajuan: AjuanDw[], x: PermintaanDw) =>
  x.status === 'DISETUJUI' && !mintaBelumTuntas(ajuan, x)

export interface EntriAntrean {
  jenis: 'minta' | 'ajuan'
  id: string
  tgl: string
  divisi: string
  status: string
  putusAt: number
  m: string
  x: PermintaanDw | AjuanDw
}

export function entriAntreanDw(ajuan: AjuanDw[], permintaan: PermintaanDw[]): EntriAntrean[] {
  return [
    ...permintaan.map(x => ({ jenis: 'minta' as const, x, id: x.id, tgl: x.tgl, divisi: x.divisi, status: x.status, putusAt: x.putusAt || 0, m: x.m })),
    ...ajuan.map(a => ({ jenis: 'ajuan' as const, x: a, id: a.id, tgl: a.tgl, divisi: a.divisi, status: a.status, putusAt: a.putusAt || 0, m: a.m })),
  ]
}

/** "Still work to do" is NOT the same as MENUNGGU (`entriPerluDikerjakan`, :2941). */
export function entriPerluDikerjakan(ajuan: AjuanDw[], e: EntriAntrean): boolean {
  return e.jenis === 'minta' ? mintaBelumTuntas(ajuan, e.x as PermintaanDw) : e.status === 'MENUNGGU'
}

/** Same rule as the Antrian tab, for the sidebar badge (`antreanPerluDikerjakan`, :2947). */
export function antreanPerluDikerjakanDw(ajuan: AjuanDw[], permintaan: PermintaanDw[]): number {
  return ajuan.filter(a => a.status === 'MENUNGGU').length + permintaan.filter(x => mintaBelumTuntas(ajuan, x)).length
}

/** Head may edit only while waiting (`bolehUbahMinta`, :3617). */
export function bolehUbahMintaDw(x: PermintaanDw, p: PeranDw): boolean {
  if (x.status !== 'MENUNGGU') return false
  if (p.hrd) return true
  return p.head && divisiKuasaDw(p).includes(x.divisi)
}

/** Head may delete only nobody-assigned requests; HRD any time (`bolehHapusMinta`, :3622). */
export function bolehHapusMintaDw(ajuan: AjuanDw[], x: PermintaanDw, p: PeranDw): boolean {
  if (p.hrd) return true
  return p.head && divisiKuasaDw(p).includes(x.divisi) && x.status === 'MENUNGGU' && mintaTerpenuhi(ajuan, x.id) === 0
}

/** A keterangan is mandatory at all three doors for everyone but HRD (`catatanWajibDW`, :3205, F.22). */
export const catatanWajibDw = (p: PeranDw) => !p.hrd

// ---------------------------------------------------------------- quota guide

/** `paxAcara` is the guest count of Marketing+Event only, never reservations (`konteksHari`, :2817). */
export function konteksHariDw(tgl: string, paxAcara: number): KonteksHari {
  if (paxAcara > 0) return 'event'
  return idxHari(tgl) >= 5 ? 'weekend' : 'biasa'
}

export function kuotaDivDw(set: SettingDw, div: string, tgl: string, paxAcara: number): number {
  const k = set.kuota[div]
  if (!k) return 0
  return Number(k[konteksHariDw(tgl, paxAcara)]) || 0
}

export function panduanTeksDw(set: SettingDw, tgl: string, paxAcara: number): string {
  const isi = DIVISI.map((d) => {
    const k = kuotaDivDw(set, d.k, tgl, paxAcara)
    return k ? `${d.n} ${k}` : ''
  }).filter(Boolean)
  return KONTEKS_LBL[konteksHariDw(tgl, paxAcara)] + (isi.length ? ` — panduan ${isi.join(' · ')}` : ' — panduan belum disetel')
}

export const terpakaiDivDw = (ajuan: AjuanDw[], tgl: string, div: string, status: string[], kecualiId?: string) =>
  ajuan.filter(a => a.tgl === tgl && a.divisi === div && status.includes(a.status) && a.id !== kecualiId).length

/** A warning when adding one more passes the guide, or null (`lampauiPanduan`, :2848). */
export function lampauiPanduanDw(ajuan: AjuanDw[], set: SettingDw, tgl: string, div: string, status: string[], kecualiId: string, paxAcara: number) {
  const kuota = kuotaDivDw(set, div, tgl, paxAcara)
  if (!kuota) return null
  const kini = terpakaiDivDw(ajuan, tgl, div, status, kecualiId)
  if (kini + 1 <= kuota) return null
  return { tgl, div, kuota, kini, jadi: kini + 1, konteks: konteksHariDw(tgl, paxAcara) }
}

/** "Setujui semua" checked per day+division up front (`lampauiBanyak`, :4454). */
export function lampauiBanyakDw(ajuan: AjuanDw[], set: SettingDw, ids: string[], paxOf: (tgl: string) => number) {
  const per: Record<string, number> = {}
  for (const id of ids) {
    const a = ajuan.find(x => x.id === id)
    if (!a) continue
    const k = `${a.tgl}|${a.divisi}`
    per[k] = (per[k] ?? 0) + 1
  }
  const out: { tgl: string, div: string, kuota: number, jadi: number, konteks: KonteksHari }[] = []
  for (const kunci of Object.keys(per)) {
    const [tgl, div] = kunci.split('|') as [string, string]
    const kuota = kuotaDivDw(set, div, tgl, paxOf(tgl))
    if (!kuota) continue
    const jadi = terpakaiDivDw(ajuan, tgl, div, ['DISETUJUI']) + per[kunci]!
    if (jadi > kuota) out.push({ tgl, div, kuota, jadi, konteks: konteksHariDw(tgl, paxOf(tgl)) })
  }
  return out
}

/** What a bulk approval is about to promise (`ringkasAjuan`, :4471). */
export function ringkasAjuanDw(set: SettingDw, ajuan: AjuanDw[], ids: string[]) {
  const list = ajuan.filter(a => ids.includes(a.id))
  const orang = new Set<string>()
  const divisi: Record<string, number> = {}
  let upah = 0
  for (const a of list) {
    orang.add(a.dwId)
    divisi[a.divisi] = (divisi[a.divisi] ?? 0) + 1
    upah += biayaAjuanDw(set, a)
  }
  return {
    n: list.length,
    orang: orang.size,
    upah,
    divisi: Object.keys(divisi).map(k => ({ k, n: divisi[k]! })).sort((x, y) => y.n - x.n),
    list,
  }
}

// ---------------------------------------------------------------- rekap & payment

export function rekapAjuanDw(ajuan: AjuanDw[], dwId: string, mk: string): AjuanDw[] {
  const a = `${mk}-01`
  const z = akhirBulanDw(mk)
  return ajuan.filter(x => x.dwId === dwId && x.tgl >= a && x.tgl <= z && x.status !== 'BATAL')
    .sort((x, y) => String(x.tgl).localeCompare(String(y.tgl)))
}

export const akhirBulanDw = (mk: string): string => {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y!, m!, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** One worker's month (`rekapBebanDW`, :6973). Only DISETUJUI counts as scheduled; only paid shifts count as money. */
export function rekapBebanDw(set: SettingDw, ajuan: AjuanDw[], dwId: string, mk: string) {
  const list = rekapAjuanDw(ajuan, dwId, mk)
  const setuju = list.filter(x => x.status === 'DISETUJUI')
  const dibayar = setuju.filter(hadirDibayar)
  const out = {
    masuk: setuju.length,
    hariMasuk: 0,
    jam: 0,
    upah: 0,
    wknd: 0,
    maxBeruntun: 0,
    alfa: setuju.length - dibayar.length,
    belum: setuju.filter(hadirBelum).length,
    menunggu: list.filter(x => x.status === 'MENUNGGU').length,
    ditolak: list.filter(x => x.status === 'DITOLAK').length,
    perDivisi: {} as Record<string, number>,
    perPosisi: {} as Record<string, number>,
  }
  for (const x of dibayar) {
    out.jam += durasiJamDw(x.m, x.s)
    out.upah += biayaAjuanDw(set, x)
    if (idxHari(x.tgl) >= 5) out.wknd++
    out.perDivisi[x.divisi] = (out.perDivisi[x.divisi] ?? 0) + 1
    const ps = x.posisi || '—'
    out.perPosisi[ps] = (out.perPosisi[ps] ?? 0) + 1
  }
  // Consecutive days: two rows on one date are ONE day (`:6998`).
  const tgl = [...new Set(dibayar.map(x => x.tgl))].sort()
  let run = 0
  tgl.forEach((t, i) => {
    run = (i > 0 && tambahHari(tgl[i - 1]!, 1) === t) ? run + 1 : 1
    if (run > out.maxBeruntun) out.maxBeruntun = run
  })
  out.hariMasuk = tgl.length
  out.jam = bulat1(out.jam)
  return out
}

export function statistikDw(ajuan: AjuanDw[], id: string) {
  const mine = ajuan.filter(a => a.dwId === id)
  const kerja = mine.filter(a => a.status === 'DISETUJUI')
  return {
    total: kerja.length,
    jam: bulat1(kerja.reduce((n, a) => n + durasiJamDw(a.m, a.s), 0)),
    menunggu: mine.filter(a => a.status === 'MENUNGGU').length,
  }
}

/** Grouping key of one destination (`kunciBayar`, :6931). The bank name is deliberately NOT in the key. */
export function kunciBayarDw(p: PekerjaDw | null, dwId: string): string {
  const nomor = String(p?.bayarNomor || '').replace(/[\s.-]/g, '')
  if (!nomor) return `KOSONG|${dwId || p?.id || ''}`
  return `${bayarJenisSah(p?.bayarJenis)}|${nomor.toLowerCase()}`
}

export interface BarisBayarDw {
  id: string
  p: PekerjaDw | null
  nama: string
  kali: number
  jam: number
  total: number
  tgl: string[]
  belum: number
  alfa: number
}

/** One week per worker (`rekapBayar`, :7196). Only DISETUJUI, and ALFA does not create a row. */
export function rekapBayarDw(set: SettingDw, pekerja: PekerjaDw[], ajuan: AjuanDw[], senin: string): BarisBayarDw[] {
  const sampai = tambahHari(senin, 6)
  const peta: Record<string, BarisBayarDw> = {}
  for (const a of ajuan) {
    if (a.status !== 'DISETUJUI') continue
    if (a.tgl < senin || a.tgl > sampai) continue
    const p = pekerja.find(x => x.id === a.dwId) ?? null
    if (!peta[a.dwId]) peta[a.dwId] = { id: a.dwId, p, nama: p?.nama ?? '(DW dihapus)', kali: 0, jam: 0, total: 0, tgl: [], belum: 0, alfa: 0 }
    const baris = peta[a.dwId]!
    if (!hadirDibayar(a)) {
      baris.alfa++
      continue
    }
    if (hadirBelum(a)) baris.belum++
    baris.kali++
    baris.jam += durasiJamDw(a.m, a.s)
    baris.total += biayaAjuanDw(set, a)
    baris.tgl.push(a.tgl)
  }
  return Object.values(peta).sort((x, y) => String(x.nama).localeCompare(String(y.nama)))
}

export interface GrupBayarDw {
  kunci: string
  p: PekerjaDw | null
  orang: BarisBayarDw[]
  total: number
  kali: number
}

/** Three workers with one account: one row, one amount, one transfer (`:7257`). */
export function grupBayarDw(baris: BarisBayarDw[]): GrupBayarDw[] {
  const kelompok: Record<string, GrupBayarDw> = {}
  for (const x of baris) {
    const k = kunciBayarDw(x.p, x.id)
    if (!kelompok[k]) kelompok[k] = { kunci: k, p: x.p, orang: [], total: 0, kali: 0 }
    kelompok[k]!.orang.push(x)
    kelompok[k]!.total += x.total
    kelompok[k]!.kali += x.kali
  }
  return Object.values(kelompok).sort((a, b) => b.total - a.total)
}

export const bayarLunasPetaDw = (set: SettingDw) => set.bayarLunas ?? {}
export const bayarSudahDw = (set: SettingDw, senin: string, kunci: string) => !!bayarLunasPetaDw(set)[`${senin}|${kunci}`]
export const bayarLunasInfoDw = (set: SettingDw, senin: string, kunci: string) => bayarLunasPetaDw(set)[`${senin}|${kunci}`] ?? null

/** Plain-text transfer list for WhatsApp (`salinBayar`, :7398). */
export function teksTransferDw(set: SettingDw, pekerja: PekerjaDw[], ajuan: AjuanDw[], senin: string): string {
  const baris = rekapBayarDw(set, pekerja, ajuan, senin)
  const grup = grupBayarDw(baris)
  if (!grup.length) return ''
  let t = `PEMBAYARAN DAILY WORKER\n${rentangMingguDw(senin)}\n`
  grup.forEach((g, i) => {
    t += `\n${i + 1}. ${labelTujuanDw(g.p)}\n`
    for (const o of g.orang) t += `   - ${o.nama} ${o.kali}x = Rp ${angkaPolos(o.total)}\n`
    t += `   TRANSFER: Rp ${angkaPolos(g.total)}\n`
  })
  t += `\nTOTAL: Rp ${angkaPolos(grup.reduce((n, g) => n + g.total, 0))}`
  return t
}

const angkaPolos = (n: number) => new Intl.NumberFormat('id-ID').format(Math.round(n))

/** "28 Sep – 4 Okt 2026" — local copy of the jadwal helper, kept dependency-free. */
export function rentangMingguDw(senin: string): string {
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  const a = new Date(`${senin}T00:00:00`)
  const b = new Date(`${tambahHari(senin, 6)}T00:00:00`)
  return `${a.getDate()} ${BLN[a.getMonth()]} – ${b.getDate()} ${BLN[b.getMonth()]} ${b.getFullYear()}`
}

// ---------------------------------------------------------------- WhatsApp

/** 08xxx → 62xxx (`waNomor`, :6502). */
export function waNomorDw(hp: unknown): string {
  const d = String(hp || '').replace(/\D+/g, '')
  return d.startsWith('0') ? `62${d.slice(1)}` : d
}

/** Prefilled confirmation message (`waTeksAjuan`, :6666). Emoji allowed: message text. */
export function waTeksAjuDw(a: AjuanDw, nama: string): string {
  const d = new Date(`${a.tgl}T00:00:00`)
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `Halo ${nama}, konfirmasi part time di Laksamana Muda:`
    + `\n\nTanggal : ${HARI[d.getDay()]}, ${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`
    + `\nJam     : ${a.m || '—'}–${a.s || '—'}`
    + `\nPosisi  : ${a.posisi || '-'} (${namaDivisiJadwal(a.divisi)})`
    + '\n\nApakah bisa hadir? Mohon balas ya, terima kasih.'
}

// ---------------------------------------------------------------- misc

/** The viewer's standing for the shell before the setting arrives. */
export function peranDwDasar(me: Me | null, state?: DwState | null): PeranDw {
  if (state) return state.peran
  return { hrd: false, head: false, lihat: false, admin: isAdminOf(me, 'dw'), nama: me?.name ?? '', divisi: [] }
}

/** Footer role line, most decisive first (`setSubPeran`, :2367). */
export function labelPeranDw(p: PeranDw): string {
  const out: string[] = []
  if (p.admin) out.push('Admin modul')
  if (p.hrd) out.push('HRD')
  if (p.head) out.push('Head divisi')
  return out.length ? out.join(' · ') : 'Staf Office'
}

/** The month grid starts on Monday, six weeks (`pitaBulan`, :1437 / viewTamu). */
export const mulaiKisi = (mk: string) => seninDari(`${mk}-01`)
