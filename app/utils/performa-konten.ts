// Content & design performance — the ONE place the formulas live.
// Port of laksamana-office/deploy/assets/performa-konten.js (owner: Konten).
// Used by Konten (Input Performa, Performa Konten, Performa Desain, detail
// page) and by the Analytics module (#20): import from here, never copy. Two
// copies of Engagement Rate are two screens quoting different numbers for the
// same post (konten.md F.5).
//
// Pure functions only. The screens (KontenPerformaPanel, KontenDesainPanel)
// render the results.
//
// Rules carried over (konten.md F.4–F.11):
//  - figures are stored per platform in `c.perf[<platform>]`; the old flat
//    `c.metrics` is still read, as ONE "(catatan lama)" row that is never split
//    across platforms (F.4);
//  - ONE denominator for the three ratios: reach, else impression, else none —
//    and none means null, not 0 (F.6);
//  - aggregates sum numerators and denominators first, then divide (F.7);
//  - a post on two platforms is one post, two rows (F.8);
//  - the month of a post is publishRecord.at first, then publishDate (F.9).
import type { KontenItem, ProdTask } from '~/utils/konten'
import { contentPlatforms, contentTypes, printTypes } from '~/utils/konten'

// ---------------------------------------------------------------- fields

/** The figures typed per platform (old PK_FIELD, order kept). */
export const PK_FIELD = [
  { k: 'reach', t: 'Reach', ket: 'Akun berbeda yang melihat konten ini' },
  { k: 'impr', t: 'Impression', ket: 'Berapa kali konten ini muncul — boleh berulang ke orang yang sama' },
  { k: 'views', t: 'Views', ket: 'Penayangan video / tontonan' },
  { k: 'likes', t: 'Likes', ket: 'Suka' },
  { k: 'comments', t: 'Comments', ket: 'Komentar' },
  { k: 'shares', t: 'Shares', ket: 'Dibagikan ulang — ikut menghitung Virality Index' },
  { k: 'saves', t: 'Saves', ket: 'Disimpan — ikut menghitung Virality Index' },
  { k: 'cta', t: 'Klik CTA', ket: 'Klik tautan / tombol ajakan: link in bio, WhatsApp, pesan sekarang' },
  { k: 'follow', t: 'Follower Baru', ket: 'Pertambahan follower dari konten ini' },
] as const
export type KunciPk = typeof PK_FIELD[number]['k']
export const PK_FIELD_K: KunciPk[] = PK_FIELD.map(f => f.k)
export type MetrikPk = Record<KunciPk, number>

export const PK_TANPA_PILLAR = '(tanpa pillar)'
export const PK_TANPA_KAT = '(tanpa kategori)'
export const PK_WARISAN = '(catatan lama)'
export const PK_TANPA_TIPE = '(tanpa tipe)'
export const PK_TANPA_PLAT = '(tanpa platform)'

/** A typed figure: thousands separators dropped, digits only, never negative (a negative denominator flips every percent). */
export function pkAngka(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : 0
  const n = Number.parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10)
  return Number.isNaN(n) || n < 0 ? 0 : n
}

/** Percent with one decimal, rounded in ONE place so a card and a table never say 4,7% and 4,8%. */
export const pkPersen = (x: number | null | undefined) =>
  (Math.round((x || 0) * 10) / 10).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const pkRapikan = (m?: Record<string, unknown> | null): MetrikPk =>
  Object.fromEntries(PK_FIELD_K.map(k => [k, pkAngka(m?.[k])])) as MetrikPk

export const pkKosong = (m?: Record<string, unknown> | null) => PK_FIELD_K.every(k => pkAngka(m?.[k]) === 0)

// ---------------------------------------------------------------- rows

/** Month a post went out, 'YYYY-MM': the real publish time first, else the plan (F.9). */
export function pkBulanKonten(c?: KontenItem | null): string {
  const s = String(c?.publishRecord?.at || c?.publishDate || '')
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''
}

export interface BarisPk { plat: string, m: MetrikPk, warisan: boolean, lepas: boolean, at: number, by: string }

/**
 * One figures row per platform of a post.
 *  - a platform no longer listed on the post but already filled still counts
 *    (`lepas`): dropping it would change totals whenever someone fixes a post's
 *    platform list;
 *  - the old flat `metrics` counts only when there are no per-platform rows,
 *    as one `warisan` row (its follower field was `followers`).
 */
export function pkBarisKonten(c?: KontenItem | null): BarisPk[] {
  const out: BarisPk[] = []
  if (!c) return out
  const plat = contentPlatforms(c)
  const perf = c.perf && typeof c.perf === 'object' && !Array.isArray(c.perf) ? c.perf : null
  if (perf) {
    const baris = (p: string, lepas: boolean) => {
      const raw = perf[p]
      if (!raw) return
      const m = pkRapikan(raw)
      if (pkKosong(m)) return
      out.push({ plat: p, m, warisan: false, lepas, at: Number(raw.at) || 0, by: String(raw.by ?? '') })
    }
    for (const p of plat) baris(p, false)
    for (const p of Object.keys(perf)) if (!plat.includes(p)) baris(p, true)
  }
  if (!out.length && c.metrics && typeof c.metrics === 'object') {
    const m = pkRapikan(c.metrics)
    if (!m.follow) m.follow = pkAngka((c.metrics as Record<string, unknown>).followers)
    if (!pkKosong(m)) out.push({ plat: PK_WARISAN, m, warisan: true, lepas: false, at: 0, by: '' })
  }
  return out
}
export const pkAdaData = (c?: KontenItem | null) => pkBarisKonten(c).length > 0

// ---------------------------------------------------------------- formulas

/** Denominator: reach, else impression; never both, never zero-as-value (F.6). */
export function pkDasar(m?: Partial<MetrikPk> | null): { n: number, dari: '' | 'reach' | 'impr' } {
  const r = pkAngka(m?.reach)
  const i = pkAngka(m?.impr)
  if (r > 0) return { n: r, dari: 'reach' }
  if (i > 0) return { n: i, dari: 'impr' }
  return { n: 0, dari: '' }
}
export const pkDasarLabel = (dari: string) => (dari === 'impr' ? 'impression' : dari === 'reach' ? 'reach' : '')

export const pkEngagement = (m?: Partial<MetrikPk> | null) =>
  pkAngka(m?.likes) + pkAngka(m?.comments) + pkAngka(m?.shares) + pkAngka(m?.saves)
/** Shares + saves only: what carries a post to the next person. */
export const pkViralJml = (m?: Partial<MetrikPk> | null) => pkAngka(m?.shares) + pkAngka(m?.saves)

/** null — not 0 — when there is no denominator: 0 would claim nobody reacted. */
const pkRasio = (atas: number, m?: Partial<MetrikPk> | null) => {
  const d = pkDasar(m)
  return d.n > 0 ? (atas / d.n) * 100 : null
}
export const pkER = (m?: Partial<MetrikPk> | null) => pkRasio(pkEngagement(m), m)
export const pkViral = (m?: Partial<MetrikPk> | null) => pkRasio(pkViralJml(m), m)
export const pkCTR = (m?: Partial<MetrikPk> | null) => pkRasio(pkAngka(m?.cta), m)

// ---------------------------------------------------------------- aggregates

/**
 * Sum first, divide later (F.7). `eng` and `viral` have their own buckets
 * because they are derived; `cta` does NOT — it is already summed as a field,
 * and adding it again made the CTA rate four times too big in the old build.
 */
export type AggPk = MetrikPk & { n: number, dasar: number, dasarImpr: number, eng: number, viral: number }

export const pkKosongAgg = (): AggPk =>
  ({ ...Object.fromEntries(PK_FIELD_K.map(k => [k, 0])), n: 0, dasar: 0, dasarImpr: 0, eng: 0, viral: 0 }) as AggPk

export function pkTambah(a: AggPk, m: MetrikPk): AggPk {
  for (const k of PK_FIELD_K) a[k] += pkAngka(m[k])
  const d = pkDasar(m)
  a.dasar += d.n
  if (d.dari === 'impr') a.dasarImpr += d.n
  a.eng += pkEngagement(m)
  a.viral += pkViralJml(m)
  a.n++
  return a
}
export function pkGabungAgg(a: AggPk, b: AggPk): AggPk {
  for (const k of PK_FIELD_K) a[k] += b[k]
  a.dasar += b.dasar
  a.dasarImpr += b.dasarImpr
  a.eng += b.eng
  a.viral += b.viral
  return a
}
const pkAggRasio = (a: AggPk | null | undefined, atas: number) => (a && a.dasar > 0 ? (atas / a.dasar) * 100 : null)
export const pkAggER = (a: AggPk) => pkAggRasio(a, a.eng)
export const pkAggViral = (a: AggPk) => pkAggRasio(a, a.viral)
export const pkAggCTR = (a: AggPk) => pkAggRasio(a, a.cta)

export interface TapisPk { bulan?: string, plat?: string, cari?: string }
export interface KontenPk { c: KontenItem, agg: AggPk, plat: string[] }
export interface KumpulPk {
  baris: { konten: KontenItem, plat: string, m: MetrikPk, warisan: boolean }[]
  konten: KontenPk[]
  warisan: number
  lepas: number
  tanpaData: number
  /** months of EVERY posted item, not only the filtered ones — the picker never loses the chosen month */
  bulanAda: Record<string, 1>
  tayang: number
}

/** Every figures row of the posted items, filtered. */
export function pkKumpul(konten: KontenItem[], tapis: TapisPk = {}): KumpulPk {
  const out: KumpulPk = { baris: [], konten: [], warisan: 0, lepas: 0, tanpaData: 0, bulanAda: {}, tayang: 0 }
  for (const c of konten ?? []) {
    if (!c || c.status !== 'Posted') continue
    out.tayang++
    const b = pkBulanKonten(c)
    if (b) out.bulanAda[b] = 1
    if (tapis.bulan && b !== tapis.bulan) continue
    let rows = pkBarisKonten(c)
    if (!rows.length) {
      out.tanpaData++
      continue
    }
    if (tapis.plat) rows = rows.filter(r => r.plat === tapis.plat)
    if (!rows.length) continue
    if (tapis.cari) {
      const teks = `${c.title ?? ''} ${c.pillar ?? ''} ${rows.map(r => r.plat).join(' ')}`.toLowerCase()
      if (!teks.includes(tapis.cari.toLowerCase())) continue
    }
    const agg = pkKosongAgg()
    for (const r of rows) {
      pkTambah(agg, r.m)
      if (r.warisan) out.warisan++
      if (r.lepas) out.lepas++
      out.baris.push({ konten: c, plat: r.plat, m: r.m, warisan: r.warisan })
    }
    out.konten.push({ c, agg, plat: rows.map(r => r.plat) })
  }
  return out
}

/** Totals for the cards: `n` = number of POSTS, not platform rows. */
export function pkTotal(k: KumpulPk): AggPk {
  const a = pkKosongAgg()
  for (const x of k.konten) pkGabungAgg(a, x.agg)
  a.n = k.konten.length
  return a
}

export interface GrupPk { nama: string, a: AggPk }

/** Per platform. Old flat records have no platform, so they never appear here. */
export function pkPerPlatform(baris: KumpulPk['baris']): GrupPk[] {
  const peta: Record<string, AggPk> = {}
  for (const r of baris) {
    if (r.warisan) continue
    pkTambah((peta[r.plat] ??= pkKosongAgg()), r.m)
  }
  return Object.entries(peta).map(([nama, a]) => ({ nama, a }))
    .sort((x, y) => (y.a.dasar - x.a.dasar) || x.nama.localeCompare(y.nama))
}

/** Per content pillar, summed from each POST's aggregate so a 3-platform post counts once. */
export function pkPerPillar(konten: KontenPk[]): GrupPk[] {
  const peta: Record<string, AggPk> = {}
  for (const x of konten) {
    const p = String(x.c.pillar ?? '').trim() || PK_TANPA_PILLAR
    const a = (peta[p] ??= pkKosongAgg())
    pkGabungAgg(a, x.agg)
    a.n++
  }
  return Object.entries(peta).map(([nama, a]) => ({ nama, a }))
    .sort((x, y) => (y.a.dasar - x.a.dasar) || x.nama.localeCompare(y.nama))
}

/** Post count per platform × content type (Posted only, figures NOT required). */
export function pkHitungPost(konten: KontenItem[], tapis: TapisPk = {}) {
  const sel: Record<string, number> = {}
  const plat: Record<string, number> = {}
  const tipe: Record<string, number> = {}
  let n = 0
  for (const c of konten ?? []) {
    if (!c || c.status !== 'Posted') continue
    if (tapis.bulan && pkBulanKonten(c) !== tapis.bulan) continue
    let ps = contentPlatforms(c)
    if (!ps.length) ps = [PK_TANPA_PLAT]
    if (tapis.plat) {
      ps = ps.filter(p => p === tapis.plat)
      if (!ps.length) continue
    }
    let ts = contentTypes(c)
    if (!ts.length) ts = [PK_TANPA_TIPE]
    n++
    for (const t of ts) tipe[t] = (tipe[t] ?? 0) + 1
    for (const p of ps) {
      plat[p] = (plat[p] ?? 0) + 1
      for (const t of ts) sel[`${t}\u0001${p}`] = (sel[`${t}\u0001${p}`] ?? 0) + 1
    }
  }
  const urut = (peta: Record<string, number>) => Object.keys(peta).sort((a, b) => (peta[b]! - peta[a]!) || a.localeCompare(b))
  return { n, sel, plat, tipe, daftarPlat: urut(plat), daftarTipe: urut(tipe) }
}

export const PK_URUT = {
  reach: { t: 'Reach', v: (a: AggPk) => a.dasar as number | null },
  er: { t: 'Engagement Rate', v: pkAggER },
  viral: { t: 'Virality Index', v: pkAggViral },
  cta: { t: 'CTA Click Rate', v: pkAggCTR },
} as const
export type UrutPk = keyof typeof PK_URUT

/** Sorted COPY; posts without a value always sink, whatever the direction. */
export function pkUrutKonten(list: KontenPk[], kunci: UrutPk): KontenPk[] {
  const f = (PK_URUT[kunci] ?? PK_URUT.reach).v
  const judul = (x: KontenPk) => String(x.c.title ?? '')
  return list.slice().sort((x, y) => {
    const a = f(x.agg)
    const b = f(y.agg)
    if (a == null && b == null) return judul(x).localeCompare(judul(y))
    if (a == null) return 1
    if (b == null) return -1
    return (b - a) || judul(x).localeCompare(judul(y))
  })
}

// ---------------------------------------------------------------- design

/** WIB month of a finished job; jobs finished before 18 Sep 2026 have no doneAt and fall back to their deadline. */
export function pkBulanDesain(r: { doneAt?: number, tgl?: string }): string {
  if (r.doneAt) {
    const d = new Date(+r.doneAt)
    // fixed +7, not the browser's zone: business dates are WIB
    if (!Number.isNaN(d.getTime())) return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7)
  }
  const s = String(r.tgl ?? '')
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''
}

export interface DesainPk {
  src: 'konten' | 'mandiri'
  id: string
  judul: string
  brand: string
  pic: string
  pillar: string
  tipe: string[]
  cetak: string[]
  doneAt: number
  tgl: string
}

/** Finished design jobs from the two Konten sources: content that needed design, and stand-alone design tasks. */
export function pkDesainRows(content: KontenItem[], tasks: ProdTask[]): DesainPk[] {
  const out: DesainPk[] = []
  for (const c of content ?? []) {
    const d = c?.prod?.design
    if (!d || d.status !== 'done') continue
    out.push({
      src: 'konten', id: c.id, judul: String(c.title || '(tanpa judul)'), brand: c.brand ?? '', pic: c.pic ?? '',
      pillar: String(c.pillar ?? '').trim() || PK_TANPA_PILLAR, tipe: contentTypes(c), cetak: printTypes(c),
      doneAt: Number(d.doneAt) || 0, tgl: d.date || c.publishDate || '',
    })
  }
  for (const t of tasks ?? []) {
    if (!t || t.kind !== 'design' || t.status !== 'done') continue
    // stand-alone tasks have no pillar/type: not guessed, not dropped
    out.push({
      src: 'mandiri', id: t.id, judul: String(t.title || '(tanpa judul)'), brand: t.brand ?? '', pic: t.pic ?? '',
      pillar: PK_TANPA_KAT, tipe: [], cetak: [], doneAt: Number(t.doneAt) || 0, tgl: t.date ?? '',
    })
  }
  return out
}

export const PK_KAT = {
  pillar: { t: 'Content Pillar', amb: (r: DesainPk) => [r.pillar] },
  tipe: { t: 'Jenis Konten', amb: (r: DesainPk) => (r.tipe.length ? r.tipe : [PK_TANPA_KAT]) },
  cetak: { t: 'Jenis Cetak', amb: (r: DesainPk) => (r.cetak.length ? r.cetak : [PK_TANPA_KAT]) },
} as const
export type KatPk = keyof typeof PK_KAT

/** A job with several types counts in EACH (columns don't add up; `ganda` says how many). */
export function pkDesainKategori(rows: DesainPk[], mode: KatPk) {
  const peta: Record<string, { nama: string, n: number, konten: number, mandiri: number }> = {}
  let ganda = 0
  const amb = (PK_KAT[mode] ?? PK_KAT.pillar).amb
  for (const r of rows) {
    const ks = amb(r)
    if (ks.length > 1) ganda++
    for (const k of ks) {
      const e = (peta[k] ??= { nama: k, n: 0, konten: 0, mandiri: 0 })
      e.n++
      if (r.src === 'konten') e.konten++
      else e.mandiri++
    }
  }
  const list = Object.values(peta).sort((x, y) => (y.n - x.n) || x.nama.localeCompare(y.nama))
  return { list, ganda }
}

export const pkDesainPakai = (c?: KontenItem | null) => !!c?.prod?.design

/** Virality of posts that used a design vs the ones that did not — the comparison must exist. */
export function pkBandingDesain(k: KumpulPk) {
  const pakai = pkKosongAgg()
  const tanpa = pkKosongAgg()
  for (const x of k.konten) {
    const a = pkDesainPakai(x.c) ? pakai : tanpa
    pkGabungAgg(a, x.agg)
    a.n++
  }
  return { pakai, tanpa }
}

/** Month a Marketing request was finished: doneAt is ISO UTC (shifted to WIB), else its deadline. */
export function pkBulanMkt(r: { doneAt?: string, deadline?: string }): string {
  const d = new Date(String(r.doneAt ?? ''))
  if (r.doneAt && !Number.isNaN(d.getTime())) return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7)
  const s = String(r.deadline ?? '')
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''
}

export const pkNamaBulan = (b: string) => {
  if (!b) return 'Semua bulan'
  const n = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const [y, m] = b.split('-')
  return `${n[Number.parseInt(m ?? '', 10) - 1] ?? m} ${y}`
}

/** This month in WIB, 'YYYY-MM' (the old default of both pages). */
export const pkBulanIni = (kini = Date.now()) => new Date(kini + 7 * 3600_000).toISOString().slice(0, 7)

// ---------------------------------------------------------------- input form (Input Performa)

export interface PerfBaris { c: KontenItem, plats: string[], terisi: number, warisan: boolean, lengkap: boolean }

/** Posted items with how many listed platforms already have figures (old perfRows). */
export function perfBaris(content: KontenItem[]): PerfBaris[] {
  const waktu = (c: KontenItem) => new Date(String(c.publishRecord?.at || c.publishDate || 0)).getTime() || 0
  return (content ?? []).filter(c => c?.status === 'Posted').map((c) => {
    const plats = contentPlatforms(c)
    const baris = pkBarisKonten(c)
    const terisi = baris.filter(r => !r.warisan && plats.includes(r.plat)).length
    return { c, plats, terisi, warisan: baris.some(r => r.warisan), lengkap: plats.length > 0 && terisi >= plats.length }
  }).sort((a, b) => waktu(b.c) - waktu(a.c))
}

/** Tab counts, computed BEFORE the tab filter (else the tab not chosen always says 0). */
export const perfHitung = (rows: PerfBaris[]) => ({
  semua: rows.length,
  belum: rows.filter(r => !r.lengkap).length,
  lengkap: rows.filter(r => r.lengkap).length,
  tanpaPlat: rows.filter(r => !r.plats.length).length,
})

export interface FilterPerf { isi: 'belum' | 'lengkap' | '', q: string }
export const filterPerfBawaan = (): FilterPerf => ({ isi: 'belum', q: '' })

export function perfSaring(rows: PerfBaris[], f: FilterPerf): PerfBaris[] {
  let list = rows
  if (f.isi === 'belum') list = list.filter(r => !r.lengkap)
  else if (f.isi === 'lengkap') list = list.filter(r => r.lengkap)
  const q = f.q.trim().toLowerCase()
  if (q) list = list.filter(r => `${r.c.title ?? ''} ${r.c.pillar ?? ''}`.toLowerCase().includes(q))
  return list
}

/**
 * What a "Simpan Performa" sends, per platform (old savePerf).
 *  - a platform with at least one figure → its figures, keeping the FIRST
 *    filler (`firstAt`/`firstBy`) so a later fix does not erase who typed it;
 *    the server stamps `at`/`by` itself;
 *  - a platform whose boxes are ALL empty but that had a record → `hapus`
 *    (the old client deleted it; G-01 / laksamana-api#177 sends `metrics: null`
 *    for each one, after asking and naming the platforms);
 *  - empty and never filled → nothing.
 */
export function perfRencana(c: KontenItem, isi: Record<string, Record<string, unknown>>, saya: string, kini = Date.now()) {
  const kirim: Record<string, Record<string, unknown>> = {}
  const hapus: string[] = []
  const lama = c.perf && typeof c.perf === 'object' ? c.perf : {}
  for (const p of contentPlatforms(c)) {
    const m = pkRapikan(isi[p])
    if (!pkKosong(m)) {
      const l = lama[p] ?? {}
      kirim[p] = { ...m, firstAt: l.firstAt || l.at || kini, firstBy: l.firstBy || l.by || saya }
    }
    else if (lama[p] && !pkKosong(lama[p])) {
      hapus.push(p)
    }
  }
  return { kirim, hapus }
}
