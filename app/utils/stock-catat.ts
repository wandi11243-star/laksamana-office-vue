// Usage Panel helpers for the stock module (panel `usage`: Daily SO, Pemakaian
// Bahan, Waste Produk, Serah Terima). Owned by stock.
//
// Pure formulas + a few DOM helpers (photo resize, CSV) moved from
// laksamana-office/deploy/stock/usage/index.html and
// laksamana-office/deploy/stock/catat-common.js. The business rules that must
// survive are docs/migrasi/stock.md bagian F: #10-12 (the stock book, 0 ≠ empty,
// unit conversion only where the ratio is certain), #17-18 (explicit team,
// mandatory handover photo).
//
// Old sources: usage/index.html:1255-1259 (month range), :1554 (causes),
// :1782-1797 (report filters), :1837-2055 (Daily SO + conversions), :2116-2125
// (stock book), :3107-3225 (recap + total per unit), catat-common.js:178-214
// (units) and :398-425 (photo downscale).
// Contract: laksamana-api/docs/api/stock.md (Usage Panel records).

export interface ProdukCatat {
  nama: string
  satuan?: string[]
  kategori?: string
  area?: string[]
  aktif?: boolean
  satuanDasar?: string
  isi?: Record<string, number>
  [k: string]: unknown
}

export type InfoBahan = Record<string, ProdukCatat>

// ------------------------------------------------------------------ options

export const SATUAN_TERSEDIA = [
  'Kg', 'Gram', 'Liter', 'ML', 'Pcs', 'Porsi', 'Pack', 'Dus', 'Sack', 'Jerigen',
  'Rim', 'Botol', 'Ekor', 'Slice', 'Tabung', 'Bal', 'Buah', 'Kaleng', 'Ikat', 'Papan',
]

/** The three teams of the old TIM_OPSI, without emoji (DESIGN.md rule 2). */
export const TIM_OPSI = ['Kitchen', 'Bar', 'Floor'] as const
export type TimCatat = typeof TIM_OPSI[number]

export const JENIS_OPSI = ['Prasmanan', 'Training', 'RND', 'Lainnya'] as const

export const SEBAB_OPSI = ['Kadaluarsa', 'Rusak', 'Tumpah', 'Salah Olah', 'Sisa Produksi', 'Lainnya'] as const

/** Category order of the Daily SO sheet; must match Purchasing (stock.md D.13). */
export const SO_KATEGORI = [
  'DRY ITEM', 'CHILLER ITEM', 'FRESH', 'OPERATIONAL', 'STORE ITEM', 'Liquid/Syrup',
  'Tea Section', 'Fresh Fruits', 'Cake', 'Kelapa', 'Buah Prep', 'Packaging', 'Powder', 'Powder Herbs',
]
export const SO_LAIN = 'Belum dikategori'
const SO_AWALAN_AREA = 'FLOOR · '

export const SRH_LAWAN: Record<string, string> = { Bar: 'Kitchen', Kitchen: 'Bar' }

export const pesanTimKosong = 'Tim Anda belum diisi, jadi belum ada catatan yang bisa ditampilkan. '
  + 'Minta admin mencentang Kitchen, Bar, atau Floor di Office → Kelola User (boleh lebih dari satu).'

// --------------------------------------------------------------------- teams

/** pur_tim_pemanggil(): every team named in `keterangan` (substring match, like legacy). */
export function timDariKeterangan(keterangan?: string | null): string[] {
  const ket = String(keterangan || '').toLowerCase()
  return TIM_OPSI.filter(t => ket.includes(t.toLowerCase()))
}

/** The form's team options: own teams when the account has any, otherwise all three. */
export function opsiTimCatat(keterangan?: string | null): { value: string, label: string }[] {
  const punya = timDariKeterangan(keterangan)
  const pakai = punya.length ? punya : [...TIM_OPSI]
  return pakai.map(t => ({ value: t, label: t }))
}

/** True when the account is pinned to a single team (old `kunciPilihanTim`). */
export const timCatatTerkunci = (keterangan?: string | null): boolean =>
  timDariKeterangan(keterangan).length === 1

/** Default team: the first own one, else Kitchen (old `timBawaan`). */
export const timBawaanCatat = (keterangan?: string | null): string =>
  timDariKeterangan(keterangan)[0] || TIM_OPSI[0]

/** A non-admin with no team in `keterangan` sees nothing (server scopes to teams). */
export function timBelumDiisi(keterangan: string | undefined | null, admin: boolean): boolean {
  return !admin && timDariKeterangan(keterangan).length === 0
}

// --------------------------------------------------------------------- units

/** Valid units for a product, or null when Purchasing has not set any (all allowed). */
export function satuanBahan(info: InfoBahan, nama?: string | null): string[] | null {
  const p = nama ? info[nama] : undefined
  const s = p && Array.isArray(p.satuan) ? p.satuan.filter(Boolean) : []
  return s.length ? s : null
}

/** The product's own measure: smallest unit + size of the named units. */
export function ukuranBahan(info: InfoBahan, nama?: string | null): { dasar: string, isi: Record<string, number> } {
  const p = nama ? info[nama] : undefined
  const isi: Record<string, number> = {}
  const v = p && p.isi
  if (v && typeof v === 'object') {
    Object.keys(v).forEach((k) => {
      const s = String(k).trim()
      const n = Number(v[k])
      if (s && n > 0) isi[s] = n
    })
  }
  return { dasar: String(p?.satuanDasar || '').trim(), isi }
}

/**
 * Unit options for a pemakaian/serah row: the product's units (or all), plus its
 * base unit and sized units; sized labels read "Botol (500 ML)" (catat-common.js:202).
 * Callers keep the selected value themselves; it should be one of these values
 * or the first one.
 */
export function opsiSatuanBahan(info: InfoBahan, nama: string | null | undefined): { value: string, label: string }[] {
  const u = ukuranBahan(info, nama)
  const daftar = (satuanBahan(info, nama) || SATUAN_TERSEDIA).slice()
  const tambah = (x: string) => {
    if (x && !daftar.some(y => y.toLowerCase() === x.toLowerCase())) daftar.push(x)
  }
  if (u.dasar) tambah(u.dasar)
  Object.keys(u.isi).forEach(tambah)
  return daftar.map((x) => {
    const kunci = Object.keys(u.isi).find(k => k.toLowerCase() === x.toLowerCase())
    const label = kunci ? `${x} (${u.isi[kunci]} ${u.dasar})` : x
    return { value: x, label }
  })
}

/**
 * Waste unit options (old `pasangSatuanWaste`, :1585): the product's list or all
 * units — sized units are NOT added here; the form offers "+ Satuan lain…".
 * Returns the options plus which one should be selected, custom text included.
 */
export function opsiSatuanWaste(info: InfoBahan, nama: string | null | undefined, terpilih?: string | null): { options: string[], terpilih: string, kustom: string } {
  const daftar = satuanBahan(info, nama) || SATUAN_TERSEDIA
  const t = String(terpilih || '').trim()
  const kustom = t !== '' && !daftar.includes(t) && !SATUAN_TERSEDIA.includes(t)
  const terpilihAkhir = kustom ? t : (daftar.includes(t) ? t : (daftar[0] ?? SATUAN_TERSEDIA[0]!))
  return { options: daftar, terpilih: terpilihAkhir, kustom: kustom ? t : '' }
}

// -------------------------------------------------------------- conversions

/** Unit families with a universal ratio — weight and volume only (stock.md F.12). */
const SO_SATUAN: Record<string, [string, number]> = {
  kg: ['berat', 1], gram: ['berat', 0.001], gr: ['berat', 0.001], g: ['berat', 0.001],
  liter: ['volume', 1], l: ['volume', 1], ltr: ['volume', 1], ml: ['volume', 0.001],
}

export const soUnitInfo = (u?: string | null): [string, number] | undefined =>
  SO_SATUAN[String(u || '').trim().toLowerCase()]

/** qty from one unit to another; null when not convertible (discrete or mixed families). */
export function soKonvFam(qty: number, dari?: string | null, ke?: string | null): number | null {
  const a = soUnitInfo(dari)
  const b = soUnitInfo(ke)
  if (!a || !b) return null
  if (a[0] !== b[0]) return null
  return qty * a[1] / b[1]
}

export const soDasar = (info: InfoBahan, nama: string): string =>
  String(info[nama]?.satuanDasar || '').trim()

function soIsi(info: InfoBahan, nama: string): Record<string, number> {
  const v = info[nama]?.isi
  const out: Record<string, number> = {}
  if (v && typeof v === 'object') {
    Object.keys(v).forEach((k) => {
      const s = String(k).trim().toLowerCase()
      const n = Number(v[k])
      if (s && n > 0) out[s] = n
    })
  }
  return out
}

/** qty expressed in the item's smallest unit; null when it cannot be done. */
export function soKeDasar(info: InfoBahan, qty: number, u: string | null | undefined, nama: string): number | null {
  const dasar = soDasar(info, nama)
  if (!dasar) return null
  const a = String(u || '').trim().toLowerCase()
  if (a === dasar.toLowerCase()) return qty
  const isi = soIsi(info, nama)
  if ((isi[a] ?? 0) > 0) return qty * isi[a]!
  return soKonvFam(qty, u, dasar)
}

export function soDariDasar(info: InfoBahan, qty: number, u: string | null | undefined, nama: string): number | null {
  const dasar = soDasar(info, nama)
  if (!dasar) return null
  const a = String(u || '').trim().toLowerCase()
  if (a === dasar.toLowerCase()) return qty
  const isi = soIsi(info, nama)
  if ((isi[a] ?? 0) > 0) return qty / isi[a]!
  return soKonvFam(qty, dasar, u)
}

/** Standard families first, the per-item table second (stock.md F.12; old :2040-2051). */
export function soKonversi(info: InfoBahan, qty: number, dari: string | null | undefined, ke: string | null | undefined, nama?: string): number | null {
  const f = soKonvFam(qty, dari, ke)
  if (f !== null) return f
  if (!nama) return null
  const b = soKeDasar(info, qty, dari, nama)
  if (b === null) return null
  return soDariDasar(info, b, ke, nama)
}

export function soUnit(info: InfoBahan, nama: string): string {
  const s = info[nama]?.satuan
  return s && Array.isArray(s) && s[0] ? s[0] : ''
}

export function soKategori(info: InfoBahan, nama: string): string {
  const k = typeof info[nama]?.kategori === 'string' ? String(info[nama]!.kategori).trim() : ''
  return k || SO_LAIN
}

/** Area list, normalised to the three teams; values outside them are dropped (old :1893). */
export function soAreas(info: InfoBahan, nama: string): string[] {
  const v: unknown = info[nama]?.area
  const l: unknown[] = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',') : [])
  const out: string[] = []
  l.forEach((x) => {
    const a = String(x || '').trim().toLowerCase()
    const cocok = TIM_OPSI.find(t => t.toLowerCase() === a)
    if (cocok && out.indexOf(cocok) < 0) out.push(cocok)
  })
  return out
}

/** Floor-only items are split into their own group (`FLOOR · <kategori>`, old :2150). */
export function soFloorMurni(info: InfoBahan, nama: string): boolean {
  const a = soAreas(info, nama)
  return a.length === 1 && a[0] === 'Floor'
}

/** Does the item belong to the sheet's selected team? Empty area = Umum (old :1862). */
export function soAreaCocok(info: InfoBahan, nama: string, timDipilih: string): boolean {
  if (!TIM_OPSI.some(t => t === timDipilih)) return true // admin / no team: everything
  const area = soAreas(info, nama)
  return !area.length || area.indexOf(timDipilih) > -1
}

/** Category groups of the sheet, category order preserved and unknowns after (old :2154). */
export function soKelompok(info: InfoBahan, daftar: string[], timDipilih: string): { grup: Record<string, string[]>, urut: string[] } {
  const grup: Record<string, string[]> = {}
  daftar.forEach((nama) => {
    if (!soAreaCocok(info, nama, timDipilih)) return
    const k = (soFloorMurni(info, nama) ? SO_AWALAN_AREA : '') + soKategori(info, nama)
    ;(grup[k] = grup[k] || []).push(nama)
  })
  const urut = SO_KATEGORI.filter(k => grup[k])
  Object.keys(grup).forEach((k) => {
    if (SO_KATEGORI.indexOf(k) < 0 && k !== SO_LAIN) urut.push(k)
  })
  if (grup[SO_LAIN]) urut.push(SO_LAIN)
  return { grup, urut }
}

/** Old `soAngka`: "" / null / undefined = not counted (null); 0 stays 0. */
export function soAngka(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ------------------------------------------------------------------ stock book

export interface BarisItemRingkas { item?: string, qty?: unknown, unit?: string }
export interface UsageRingkas { tanggal?: string, tim?: string, items?: BarisItemRingkas[] }
export interface WasteRingkas { tanggal?: string, tim?: string, item?: string, qty?: unknown, unit?: string }
export interface HandoverRingkas { tanggal?: string, tim?: string, items?: BarisItemRingkas[] }

/**
 * Keluar of one date: pemakaian + waste + serah terima for those items, summed
 * in each item's base unit; unconvertible lines are flagged "satuan campur"
 * (old `soMuatKeluar` :1910-1952; stock.md F.10).
 */
export function soKeluarHitung(opts: {
  pemakaian: UsageRingkas[]
  waste: WasteRingkas[]
  serah: HandoverRingkas[]
  tanggal: string
  tim: string
  info: InfoBahan
}): { keluar: Record<string, number>, campur: Record<string, boolean> } {
  const keluar: Record<string, number> = {}
  const campur: Record<string, boolean> = {}
  const tambah = (nm: string, q: unknown, unit?: string) => {
    if (!nm) return
    const qn = Number(q) || 0
    const dasar = soUnit(opts.info, nm)
    let nilai = qn
    if (unit && dasar && String(unit).trim().toLowerCase() !== dasar.trim().toLowerCase()) {
      const k = soKonversi(opts.info, qn, unit, dasar, nm)
      if (k === null) campur[nm] = true
      else nilai = k
    }
    keluar[nm] = (keluar[nm] || 0) + nilai
  }
  const cocokTim = (t?: string) => (!opts.tim || opts.tim === 'ALL') ? true : t === opts.tim
  opts.pemakaian.forEach((e) => {
    if (e.tanggal !== opts.tanggal || !cocokTim(e.tim)) return
    ;(e.items || []).forEach(it => tambah(String(it.item || ''), it.qty, it.unit))
  })
  opts.waste.forEach((w) => {
    if (w.tanggal !== opts.tanggal || !cocokTim(w.tim)) return
    tambah(String(w.item || ''), w.qty, w.unit)
  })
  opts.serah.forEach((s) => {
    if (s.tanggal !== opts.tanggal || !cocokTim(s.tim)) return
    ;(s.items || []).forEach(it => tambah(String(it.item || ''), it.qty, it.unit))
  })
  return { keluar, campur }
}

export interface OpnameItemRingkas { item?: string, unit?: string, opening?: unknown, masuk?: unknown, sistem?: unknown, fisik?: unknown, note?: string }
export interface OpnameRingkas { id?: string, tanggal?: string, tim?: string, waktu?: string, status?: string, pic?: string, items?: OpnameItemRingkas[] }

/** Yesterday's closing for one item + team: newest entry older than `tanggal` with fisik filled (old `soKemarin`). */
export function soKemarin(entries: OpnameRingkas[], nama: string, tanggal: string, tim: string): number | null {
  let terbaik: { tanggal: string, waktu: string, fisik: number } | null = null
  entries.forEach((e) => {
    if (String(e.tanggal || '') >= tanggal) return
    if (tim && tim !== 'ALL' && e.tim !== tim) return
    ;(e.items || []).forEach((it) => {
      if (String(it.item || '') !== nama) return
      if (it.fisik === null || it.fisik === undefined || it.fisik === '') return
      const tgl = String(e.tanggal || '')
      const waktu = String(e.waktu || '')
      if (!terbaik || tgl > terbaik.tanggal || (tgl === terbaik.tanggal && waktu > terbaik.waktu)) {
        terbaik = { tanggal: tgl, waktu, fisik: Number(it.fisik) }
      }
    })
  })
  return terbaik ? (terbaik as { fisik: number }).fisik : null
}

export interface SoHitungan {
  opening: number | null
  /** First ever count: it only sets the opening; no seharusnya/selisih yet. */
  baru: boolean
  masuk: number
  keluar: number
  closing: number | null
  seharusnya: number | null
  selisih: number | null
}

/** The stock book: seharusnya = opening + masuk − keluar; selisih = closing − seharusnya. */
export function soHitung(h: { opening: number | null, masuk: unknown, keluar: number | undefined, fisik: unknown }): SoHitungan {
  const baru = h.opening === null
  const masuk = soAngka(h.masuk) ?? 0
  const keluar = Number(h.keluar) || 0
  const closing = soAngka(h.fisik)
  const seharusnya = baru ? null : (h.opening as number) + masuk - keluar
  const selisih = (closing === null || seharusnya === null) ? null : closing - seharusnya
  return { opening: h.opening, baru, masuk, keluar, closing, seharusnya, selisih }
}

/** Difference cell: '—' not counted, 'awal' first count, number with sign otherwise. */
export function soSelisihTeks(h: SoHitungan): { teks: string, tone: 'neutral' | 'warning' | 'success' | 'error' } {
  if (h.closing === null) return { teks: '—', tone: 'neutral' }
  if (h.baru) return { teks: 'awal', tone: 'warning' }
  const d = h.selisih ?? 0
  if (d === 0) return { teks: '0', tone: 'success' }
  return { teks: `${d > 0 ? '+' : ''}${fmtQty(d)}`, tone: 'error' }
}

// ---------------------------------------------------------------------- recap

export interface BarisBahanCatat { item: string, qty: number, unit: string, rencana?: boolean }
export interface RekapBahan { item: string, unit: string, selesai: number, rencana: number, dipakai: number, total: number }

const REKAP_FAM_BASE: Record<string, string> = { berat: 'Kg', volume: 'Liter' }

/**
 * One line → its recap unit: the item's own smallest unit wins when it has one,
 * then same-family conversion, discrete units stay alone (old `bariskan` :3114).
 */
export function bariskan(info: InfoBahan, nama: string, qty: unknown, unit?: string | null): { qty: number, unit: string, kunciSat: string } {
  const u = String(unit || '').trim()
  const q = Number(qty) || 0
  if (soDasar(info, nama)) {
    const c = soKeDasar(info, q, u, nama)
    if (c !== null) {
      const d = soDasar(info, nama)
      return { qty: c, unit: d, kunciSat: `item:${d.toLowerCase()}` }
    }
  }
  const infoU = soUnitInfo(u)
  if (!infoU) return { qty: q, unit: u, kunciSat: `u:${u.toLowerCase()}` }
  const keluarga = infoU[0]
  const pu = soUnit(info, nama)
  const puInfo = soUnitInfo(pu)
  const target = (puInfo && puInfo[0] === keluarga) ? pu : (REKAP_FAM_BASE[keluarga] ?? u)
  const c = soKonversi(info, q, u, target)
  return { qty: c === null ? q : c, unit: target, kunciSat: `fam:${keluarga}` }
}

/** Recap per item from {item, qty, unit, rencana?} lines (old `rekapBaris` :3144). */
export function rekapBaris(info: InfoBahan, baris: BarisBahanCatat[]): RekapBahan[] {
  const peta = new Map<string, RekapBahan>()
  baris.forEach((b) => {
    const nama = String(b.item || '').trim()
    if (!nama) return
    const k = bariskan(info, nama, b.qty, b.unit)
    const kunci = nama.toLowerCase() + '|' + k.kunciSat
    const o = peta.get(kunci) || { item: nama, unit: k.unit, selesai: 0, rencana: 0, dipakai: 0, total: 0 }
    if (b.rencana) o.rencana += k.qty
    else o.selesai += k.qty
    o.dipakai += 1
    peta.set(kunci, o)
  })
  return [...peta.values()]
    .map(b => ({ ...b, total: b.selesai + b.rencana }))
    .sort((a, b) => b.total - a.total || a.item.localeCompare(b.item))
}

/** Harvest lines; usage not "Selesai" counts as a plan (old `barisPemakaian`). */
export function barisPemakaian(list: { status?: string, items?: BarisItemRingkas[] }[]): BarisBahanCatat[] {
  const out: BarisBahanCatat[] = []
  list.forEach(r => (r.items || []).forEach(i => out.push({ item: String(i.item || ''), qty: Number(i.qty) || 0, unit: String(i.unit || ''), rencana: r.status !== 'Selesai' })))
  return out
}
export const barisWaste = (list: WasteRingkas[]): BarisBahanCatat[] =>
  list.map(r => ({ item: String(r.item || ''), qty: Number(r.qty) || 0, unit: String(r.unit || '') }))
export function barisSerah(list: HandoverRingkas[]): BarisBahanCatat[] {
  const out: BarisBahanCatat[] = []
  list.forEach(s => (s.items || []).forEach(i => out.push({ item: String(i.item || ''), qty: Number(i.qty) || 0, unit: String(i.unit || '') })))
  return out
}

/** Total across items: same-family lines merge (Kg/Liter), discrete units stay apart. */
export function totalPerSatuan(baris: { qty: unknown, unit?: string }[]): Record<string, number> {
  const tot: Record<string, number> = {}
  baris.forEach((b) => {
    const u = String(b.unit || '').trim()
    const q = Number(b.qty) || 0
    const unitInfo = soUnitInfo(u)
    if (unitInfo) {
      const base = REKAP_FAM_BASE[unitInfo[0]] ?? u
      const c = soKonvFam(q, u, base)
      tot[base] = (tot[base] || 0) + (c === null ? q : c)
    }
    else tot[u || 'tanpa satuan'] = (tot[u || 'tanpa satuan'] || 0) + q
  })
  return tot
}

/** Fixed order Kg, Liter, then discrete units by size (old `urutSatuan` :3207). */
export function urutSatuan(tot: Record<string, number>): [string, number][] {
  const rank = (u: string) => u === 'Kg' ? 0 : u === 'Liter' ? 1 : 2
  return Object.entries(tot).filter(([, v]) => v > 0)
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** "12,5 Liter · 8 Kg · 47 Pcs"; '—' when nothing (old `teksTotal`). */
export function teksTotal(tot: Record<string, number>): string {
  const e = urutSatuan(tot)
  if (!e.length) return '—'
  return e.map(([u, v]) => `${fmtQty(v)} ${u}`).join(' · ')
}

/** Usage quantities are often fractional; drop trailing zeros ("2", "2,25"). */
export function fmtQty(n: unknown): string {
  const v = Number(n) || 0
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------- bar data

export interface DataBar { label: string, value: string, persen: number }

/** Old `gambarBars`: biggest first, width relative to the biggest, % of total in the text. */
export function dataBar(peta: Record<string, number>): DataBar[] {
  const baris = Object.entries(peta).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (!baris.length) return []
  const maks = baris[0]![1]
  const total = baris.reduce((a, [, v]) => a + v, 0)
  return baris.map(([k, v]) => ({
    label: k,
    value: `${fmtQty(v)} · ${Math.round(v / total * 100)}%`,
    persen: Math.max(2, Math.round(v / maks * 100)),
  }))
}

/**
 * Quantity bars: no percentage (mixed units make it a made-up number), duplicate
 * names with a different unit get "(unit)" appended (old `petaQty` + `gambarBarsQty`).
 */
export function dataBarQty(rekap: RekapBahan[], maksBaris = 8): DataBar[] {
  const peta: Record<string, { qty: number, unit: string }> = {}
  rekap.forEach((b) => {
    let nm = b.item
    if (peta[nm]) nm = `${b.item} (${b.unit || 'tanpa satuan'})`
    peta[nm] = { qty: b.total, unit: b.unit }
  })
  const baris = Object.entries(peta).filter(([, v]) => v.qty > 0).sort((a, b) => b[1].qty - a[1].qty).slice(0, maksBaris)
  if (!baris.length) return []
  const maks = baris[0]![1].qty
  return baris.map(([k, v]) => ({
    label: k,
    value: `${fmtQty(v.qty)} ${v.unit || ''}`.trim(),
    persen: Math.max(2, Math.round(v.qty / maks * 100)),
  }))
}

/** Subtitle of a quantity bars panel: the honest total + mixed-unit warning. */
export function subBarQty(rekap: RekapBahan[]): string {
  if (!rekap.length) return ''
  const tot = totalPerSatuan(rekap.map(b => ({ qty: b.total, unit: b.unit })))
  const campur = urutSatuan(tot).length > 1
  return teksTotal(tot) + (campur ? ' · satuan campur' : '')
}

/** Total of the lines currently shown, as {label, value} bars per team/jenis. */
export function dataBarHitung(peta: Record<string, number>, satuan: string): { data: DataBar[], sub: string } {
  return { data: dataBar(peta), sub: `${fmtQty(Object.values(peta).reduce((a, b) => a + b, 0))} ${satuan}` }
}

// ------------------------------------------------------------------- ranges

export const bulanIni = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** First to last day of YYYY-MM — last day, not today: a past month comes whole. */
export function rentangBulanCatat(ym: string): { dari: string, ke: string } {
  const [th, bl] = String(ym).split('-').map(Number)
  const akhir = new Date(th || 1970, bl || 1, 0).getDate()
  return { dari: `${ym}-01`, ke: `${ym}-${String(akhir).padStart(2, '0')}` }
}

/** 24 months back, newest first, Indonesian labels (old `isiPilihanBulan`). */
export function daftarBulanPilih(jumlah = 24): { value: string, label: string }[] {
  const now = new Date()
  const out: { value: string, label: string }[] = []
  for (let i = 0; i < jumlah; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    })
  }
  return out
}

// --------------------------------------------------------------------- CSV

const selCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export const csvTabel = (header: string[], rows: unknown[][]): string =>
  [header, ...rows].map(r => r.map(selCsv).join(',')).join('\n')

export interface CsvItemUsage {
  item?: string
  qty?: unknown
  unit?: string
  note?: string
}

export interface CsvBarisUsage {
  tanggal?: string
  jenis?: string
  status?: string
  namaEvent?: string
  tim?: string
  pic?: string
  catatan?: string
  items?: CsvItemUsage[]
}

export function csvPemakaian(rows: CsvBarisUsage[]): string {
  const out: unknown[][] = []
  rows.forEach((r) => {
    (r.items || []).forEach(i => out.push([
      r.tanggal, r.jenis, r.status, r.namaEvent, r.tim, r.pic, r.catatan,
      i.item, i.qty, i.unit, i.note,
    ]))
  })
  return csvTabel(['Tanggal', 'Jenis', 'Status', 'Kegiatan', 'Tim', 'PIC', 'Catatan', 'Bahan', 'Jumlah', 'Satuan', 'Catatan Baris'], out)
}

export interface CsvBarisWaste {
  tanggal?: string
  item?: string
  qty?: unknown
  unit?: string
  sebab?: string
  tim?: string
  pic?: string
  waktu?: string
  catatan?: string
  adaFoto?: boolean
}

export function csvWaste(rows: CsvBarisWaste[]): string {
  return csvTabel(
    ['Tanggal', 'Produk/Bahan', 'Jumlah', 'Satuan', 'Sebab', 'Tim', 'PIC', 'Dicatat', 'Catatan', 'Ada Foto'],
    rows.map(r => [r.tanggal, r.item, r.qty, r.unit, r.sebab, r.tim, r.pic, r.waktu, r.catatan, r.adaFoto ? 'Ya' : 'Tidak']),
  )
}

export interface CsvItemSerah {
  item?: string
  qty?: unknown
  unit?: string
}

export interface CsvBarisSerah {
  tanggal?: string
  tujuan?: string
  tim?: string
  penerima?: string
  pic?: string
  waktu?: string
  catatan?: string
  adaFoto?: boolean
  items?: CsvItemSerah[]
}

export function csvSerah(rows: CsvBarisSerah[]): string {
  const out: unknown[][] = []
  rows.forEach((s) => {
    (s.items || []).forEach(i => out.push([
      s.tanggal, s.tujuan, s.tim, s.penerima, s.pic, s.waktu, s.catatan, s.adaFoto ? 'Ya' : 'Tidak',
      i.item, i.qty, i.unit,
    ]))
  })
  return csvTabel(['Tanggal', 'Diserahkan ke', 'Dari tim', 'Penerima', 'PIC', 'Dicatat', 'Catatan', 'Ada Foto', 'Bahan', 'Jumlah', 'Satuan'], out)
}

export interface CsvBarisOpname {
  item: string
  unit: string
  opening: number | null
  masuk: number | null
  keluar: number
  seharusnya: number | null
  fisik: number | null
  selisih: number | null
}

export function csvOpname(tanggal: string, tim: string, rows: CsvBarisOpname[]): string {
  return csvTabel(
    ['Tanggal', 'Tim', 'Item', 'Satuan', 'Awal', 'Masuk', 'Keluar', 'Seharusnya', 'Stok Fisik', 'Selisih'],
    rows.map(r => [
      tanggal, tim, r.item, r.unit,
      r.opening ?? '', r.masuk ?? '', r.keluar,
      r.seharusnya ?? '', r.fisik ?? '', r.selisih ?? '',
    ]),
  )
}

/** Download a CSV string, UTF-8 with BOM for Excel (same shape as jadwal/reservasi). */
export function unduhCsvStock(nama: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nama
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ------------------------------------------------------------------- photos

/**
 * Downscale a photo before sending (1280px, quality 0.72) — the old
 * `fotoKeData` (catat-common.js:398). Rejects with a readable message for a
 * non-image or a file over 12 MB; an unreadable image travels as-is.
 */
export function fotoKeData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type || '')) {
      reject(new Error('Bukan gambar — pilih berkas foto (jpg/png).'))
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Foto terlalu besar — maksimal 12MB.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Berkas tidak terbaca.'))
    reader.onload = (e) => {
      const data = String(e.target?.result ?? '')
      const img = new Image()
      img.onerror = () => resolve(data)
      img.onload = () => {
        const maks = 1280
        let { width: w, height: h } = img
        if (w > maks || h > maks) {
          const r = Math.min(maks / w, maks / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')?.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.72))
      }
      img.src = data
    }
    reader.readAsDataURL(file)
  })
}
