// POS Sales Recapitulation parsing — the pure half of the Analytics upload.
// Port of laksamana-office/deploy/analytics/index.html (Berkas POS + mesin
// pengurai). Pure and import-free so tools/uji-analytics.mjs can import it
// with plain Node. The workbook is read by the shared app/utils/xlsx-baca.ts
// (imported, never copied); everything below starts from its BarisTabel rows.
//
// Two rules from the old module shape every function here:
// - columns are found BY NAME, never by position (the POS reorders columns
//   between versions without telling anyone);
// - what is stored is the SUMMARY, never the rows (one month is ~4.000
//   bills; the blob must stay under ~100 KB per month).
import type { BarisTabel } from '~/utils/xlsx-baca'

/** Column letters per canonical field, or null when the file lacks it. */
export type PetaKolomPos = Record<string, string | null>

/** One alias list per canonical field (exact match, lower-cased). */
// Source: laksamana-office/deploy/analytics/index.html:6620
export const KOL_POS: Record<string, string[]> = {
  tgl: ['sales date', 'sales in date', 'date', 'tanggal', 'trx date', 'transaction date'],
  jam: ['sales in time', 'order time', 'time', 'jam', 'transaction time', 'sales date in'],
  grand: ['total after bill discount', 'grand total', 'total', 'total amount', 'nett amount'],
  net: ['net sales', 'nett sales', 'netsales', 'net amount'],
  sub: ['subtotal', 'sub total', 'gross sales', 'amount'],
  dMenu: ['menu discount', 'discount'],
  dBill: ['bill discount'],
  dVouc: ['voucher discount'],
  svc: ['service charge total', 'service charge', 'service'],
  tax: ['tax total', 'tax', 'pb1', 'pb 1'],
  pax: ['pax total', 'pax', 'guest', 'cover'],
  bill: ['bill number', 'sales number', 'receipt number', 'no bill'],
  kunjung: ['visit purpose', 'visit purpose name', 'visit type', 'order type', 'sales type', 'order channel'],
  bayar: ['payment method', 'payment methods', 'payment type', 'metode pembayaran', 'payment'],
  meja: ['table', 'table name', 'table no', 'nomor meja', 'no meja', 'meja'],
  seksi: ['table section', 'section'],
  waiter: ['waiter', 'server', 'pramusaji'],
  kasir: ['cashier', 'kasir'],
  info: ['additional info', 'additional information', 'keterangan', 'remark', 'remarks'],
  catatan: ['menu notes', 'note', 'notes', 'item notes'],
  menu: ['menu', 'menu name', 'product', 'product name', 'item', 'item name', 'nama menu'],
  qty: ['qty', 'quantity', 'jumlah', 'qty sold', 'sold'],
  nilai: ['menu total', 'item total', 'total menu', 'sales amount', 'subtotal'],
  kode: ['menu code', 'item code', 'product code', 'kode menu'],
  kode2: ['custom menu name', 'nama menu custom'],
  kat: ['menu category', 'category', 'kategori'],
  katD: ['menu category detail', 'sub category', 'subcategory', 'kategori detail'],
}

/** Detection aliases for the Promotion Report (name + type must both hit). */
// Source: laksamana-office/deploy/analytics/index.html:7463
export const KOL_PROMO_DETEKSI: Record<string, string[]> = {
  nama: ['promotion name', 'promo name', 'nama promo'],
  tipe: ['promotion type', 'promo type', 'jenis promo'],
}

/** Detection aliases for the Cancel/Void file (jenis + nota + waktu must hit). */
// Source: laksamana-office/deploy/analytics/index.html:7657
export const KOL_VOID_DETEKSI: Record<string, string[]> = {
  jenis: ['cancel / void', 'cancel/void', 'type', 'action'],
  nota: ['cancel notes', 'void notes', 'notes', 'reason'],
  waktu: ['cancel / void time', 'cancel/void time', 'void time', 'cancel time'],
}

/** Full column list of the Promotion Report. */
// Source: laksamana-office/deploy/analytics/index.html:7463
export const KOL_PROMO: Record<string, string[]> = {
  tgl: ['sales date', 'date', 'tanggal', 'trx date', 'transaction date'],
  jam: ['sales in time', 'order time', 'time', 'jam', 'transaction time'],
  bill: ['sales number', 'bill number', 'receipt number', 'no bill'],
  nama: ['promotion name', 'promo name', 'nama promo'],
  tipe: ['promotion type', 'promo type', 'jenis promo'],
  menu: ['menu name', 'menu', 'item name', 'product name', 'nama menu'],
  qty: ['qty', 'quantity', 'jumlah', 'qty sold'],
  harga: ['original price', 'normal price', 'harga normal'],
  disc: ['discount total', 'total discount', 'discount amount'],
}

/** Full column list of the Cancel Menu Detail Report. */
// Source: laksamana-office/deploy/analytics/index.html:7657
export const KOL_VOID: Record<string, string[]> = {
  bill: ['sales number', 'bill number', 'no bill'],
  menu: ['menu', 'menu name', 'item'],
  kat: ['menu category'],
  katD: ['menu category detail'],
  orderBy: ['order by', 'ordered by', 'waiter'],
  orderTgl: ['order time'],
  by: ['cancel / void by', 'cancel/void by', 'void by', 'cancel by'],
  waktu: ['cancel / void time', 'cancel/void time', 'void time', 'cancel time'],
  jenis: ['cancel / void', 'cancel/void', 'type', 'action'],
  nota: ['cancel notes', 'void notes', 'notes', 'reason'],
  qty: ['qty', 'quantity'],
  sub: ['subtotal', 'sub total'],
  svc: ['service charge'],
  tax: ['tax'],
  total: ['total'],
}

/**
 * Loose but bounded: production holds ~84 rows a month, while a POS export
 * over a whole year would blow up the stored blob. Cut rows are COUNTED and
 * reported on screen, never dropped silently.
 */
// Source: laksamana-office/deploy/analytics/index.html:7675
export const VOID_MAKS = 800

/**
 * The Promotion Report has no time column, so the claim hour is derived from
 * the bill number (SLMCL + 12 digits, first ten = epoch seconds — proven on
 * 4.785 August 2026 bills, 99.2% second-exact). Only used when the epoch's
 * own date matches the row's Sales Date; otherwise -1 and reported.
 */
// Source: laksamana-office/deploy/analytics/index.html:7469
export const PROMO_EPOCH_MIN = 1262304000 /* 2010-01-01 */
export const PROMO_EPOCH_MAX = 4102444800 /* 2100-01-01 */

export const KUN_TANPA = '(tanpa keterangan)'
export const KAT_TANPA = '(tanpa kategori)'
export const MEJA_TANPA = '(tanpa meja)'

/** A package row that names only a SIZE, not a drink. Closed list. */
// Source: laksamana-office/deploy/analytics/index.html:6900
export const PAKET_RE = /\s*\(PACKAGE\)\s*$/i
export const PAKET_GENERIK = /^(REGULAR|LARGE|LARGE KOPI|LARGE TEH|SMALL|MEDIUM)$/i
export const UKURAN_BAWAAN = 'REGULAR'

/** Cash-like payment components carry the change (see porsiBayar). */
// Source: laksamana-office/deploy/analytics/index.html:6828
export const BAYAR_TUNAI = /\bCASH\b|\bTUNAI\b/

/** Error bills start with ERROR (open prefix, never a closed list). */
// Source: laksamana-office/deploy/analytics/index.html:7030
export const ERR_RE = /\bERROR\b/i
export const ERR_MAKS = 400

/**
 * Header names -> column letters, exact match on the normalised name.
 * Written once for all three column lists (sales, promo, void): two copies
 * of the matcher would drift apart.
 */
// Source: laksamana-office/deploy/analytics/index.html:6734
export function petaKolom(kepala: BarisTabel, def: Record<string, string[]>): PetaKolomPos {
  const p: Record<string, string> = {}
  for (const k of Object.keys(kepala)) {
    const nm = String(kepala[k] ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (nm && p[nm] === undefined) p[nm] = k
  }
  const out: PetaKolomPos = {}
  for (const j of Object.keys(def)) {
    let ketemu: string | null = null
    for (const nm of def[j] ?? []) {
      if (p[nm]) {
        ketemu = p[nm]!
        break
      }
    }
    out[j] = ketemu
  }
  return out
}

/** Sales-report flavour of the generic matcher. */
// Source: laksamana-office/deploy/analytics/index.html:6745
export const petaKolomPos = (kepala: BarisTabel): PetaKolomPos => petaKolom(kepala, KOL_POS)

/**
 * The header row: the first row with at least five text cells. POS files
 * carry a dozen title & filter rows above it.
 */
// Source: laksamana-office/deploy/analytics/index.html:6746
export function cariBarisKepala(baris: BarisTabel[]): number {
  for (let i = 0; i < Math.min(baris.length, 80); i++) {
    const v = Object.values(baris[i] ?? {})
    if (v.filter(x => x && Number.isNaN(Number(x))).length >= 5) return i
  }
  return -1
}

/** Raw numeric cells of .xlsx (the dot is a DECIMAL separator there). */
// Source: laksamana-office/deploy/analytics/index.html:6756
export function angkaPos(v: unknown): number {
  const n = Number.parseFloat(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? 0 : n
}

/**
 * Numbers written FOR HUMANS in Indonesian format ("4.167.925", "1.234,56").
 * The last separator wins, so both Indonesian and English files read right.
 */
// Source: laksamana-office/deploy/analytics/index.html:6771
export function angkaTampil(t: unknown): number {
  let s = String(t == null ? '' : t).trim().replace(/[^0-9.,-]/g, '')
  if (!s) return 0
  const dot = s.lastIndexOf('.')
  const com = s.lastIndexOf(',')
  if (dot > -1 && com > -1) s = com > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (com > -1) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  else if (dot > -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number.parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

/**
 * One date from the three shapes the POS uses: Excel serials, ISO, and
 * dd-mm-yyyy. Zoned datetimes shift to WIB first (+7 fixed, not the browser
 * zone); plain dates and zone-less datetimes are echoed untouched.
 */
// Source: laksamana-office/deploy/analytics/index.html:820
export function isoDariTanggal(v: unknown): string {
  if (v == null || v === '') return ''
  const s = String(v).trim()
  const WIB_MS = 7 * 3600 * 1000
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const tz = Date.parse(s)
    if (!Number.isNaN(tz)) return new Date(tz + WIB_MS).toISOString().slice(0, 10) // UTC on purpose: shifted to WIB
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const nA = Number(s)
    if (nA < 20000 || nA > 80000) return ''
    return new Date(Math.round((nA - 25569) * 86400000)).toISOString().slice(0, 10) // UTC on purpose: an Excel serial is a zoneless calendar day
  }
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return ''
}

/** '2026-10-05' -> '2026-10'. */
// Source: laksamana-office/deploy/analytics/index.html:875
export const blnDari = (iso: unknown): string => String(iso || '').slice(0, 7)

/**
 * The hour of day from the three shapes the POS uses ("10:03:21", Excel
 * serials, time-only fractions). -1 when no hour can be read. A whole serial
 * (a date WITHOUT a time) is -1, not 0: midnight must not look like rush hour.
 */
// Source: laksamana-office/deploy/analytics/index.html:6864
export function jamDari(v: unknown): number {
  const s = String(v == null ? '' : v).trim()
  if (!s) return -1
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (m) {
    const j = +m[1]!
    return j >= 0 && j < 24 ? j : -1
  }
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ''))
  if (Number.isNaN(n) || n < 0) return -1
  const f = n - Math.floor(n)
  if (f === 0 && n >= 1) return -1
  const j = Math.floor(f * 24 + 1e-9)
  return j >= 0 && j < 24 ? j : -1
}

/** A (PACKAGE) row whose name is only a size ("LARGE (PACKAGE)"). */
// Source: laksamana-office/deploy/analytics/index.html:6909
export function paketGenerik(nama: unknown): boolean {
  const s = String(nama || '').trim()
  return PAKET_RE.test(s) && PAKET_GENERIK.test(s.replace(PAKET_RE, '').trim())
}

/** Package name without the (PACKAGE) suffix. */
// Source: laksamana-office/deploy/analytics/index.html:6914
export function paketNamaAsli(nama: unknown): string {
  return String(nama || '').trim().replace(PAKET_RE, '').trim()
}

/**
 * A package CODE from the free-text column (AMERICANO02). Cashier notes
 * ("Setengah mateng") fail the shape and stay out of the code list.
 */
// Source: laksamana-office/deploy/analytics/index.html:6923
export function kodeMenu(v: unknown): string {
  const s = String(v == null ? '' : v).trim()
  if (!s) return ''
  return /^[A-Za-z][A-Za-z0-9_.-]*\d$/.test(s) ? s.toUpperCase() : ''
}

export interface PecahBayar { nama: string, nom: number | null }

/**
 * One combined payment string ("VOUCHER (25.000),QRIS MANDIRI (15.250)")
 * into components. Split on commas OUTSIDE brackets. No brackets means a
 * single method whose nominal is the whole bill (null, not 0).
 */
// Source: laksamana-office/deploy/analytics/index.html:6801
export function pecahBayar(teks: unknown): PecahBayar[] {
  const t = String(teks == null ? '' : teks).trim()
  if (!t) return []
  const out: PecahBayar[] = []
  t.split(/,(?![^()]*\))/).forEach((p) => {
    const x = p.trim()
    if (!x) return
    const m = x.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
    if (m) out.push({ nama: m[1]!.trim().toUpperCase(), nom: angkaTampil(m[2]) })
    else out.push({ nama: x.toUpperCase(), nom: null })
  })
  return out
}

/**
 * Each component's share of the bill. ALWAYS sums to 1. Cash absorbs the
 * change (its nominal is money HANDED OVER); unreadable nominals split
 * evenly and are reported (rata: true), never duplicated.
 */
// Source: laksamana-office/deploy/analytics/index.html:6830
export function porsiBayar(parts: PecahBayar[], grand: number): { porsi: number[], rata: boolean } {
  const n = parts.length
  if (!n) return { porsi: [], rata: false }
  if (n === 1) return { porsi: [1], rata: false }
  const nom = parts.map(p => (p.nom == null || p.nom < 0) ? 0 : p.nom)
  let jum = nom.reduce((a, x) => a + x, 0)
  const lebih = jum - grand
  if (lebih > 0) {
    const i = parts.findIndex(p => BAYAR_TUNAI.test(p.nama))
    if (i > -1 && nom[i]! >= lebih) {
      nom[i]! -= lebih
      jum = grand
    }
  }
  if (jum <= 0) return { porsi: parts.map(() => 1 / n), rata: true }
  return { porsi: nom.map(x => x / jum), rata: false }
}

/** Which month to store: the one with the most rows, the rest reported. */
// Source: laksamana-office/deploy/analytics/index.html:7383
export function bulanPosTerbanyak(perBln: Record<string, number>): { bulan: string, lain: { b: string, n: number }[] } {
  const urut = Object.keys(perBln).sort((a, b) => (perBln[b] ?? 0) - (perBln[a] ?? 0))
  const bulan = urut[0] ?? ''
  return { bulan, lain: urut.slice(1).map(b => ({ b, n: perBln[b] ?? 0 })) }
}

export type JenisBerkasPos = 'pos' | 'promo' | 'void'

/**
 * Which report a file is, from its columns — never from its file name.
 * Void is checked first: twelve of its columns match the sales report, and
 * only the missing date column keeps it from falling there.
 */
// Source: laksamana-office/deploy/analytics/index.html:7735
export function deteksiJenisBerkas(kepala: BarisTabel): JenisBerkasPos {
  const vd = petaKolom(kepala, KOL_VOID_DETEKSI)
  if (vd.jenis && vd.nota && vd.waktu) return 'void'
  const p = petaKolom(kepala, KOL_PROMO_DETEKSI)
  if (p.nama && p.tipe) return 'promo'
  return 'pos'
}
