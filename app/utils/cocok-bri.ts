// QRIS BRI matching engine — the single source for the cashier screen AND
// Finance › Kas Kecil (docs/migrasi/PLAN.md §4, owner: cashier lane).
// Port of laksamana-office deploy/assets/cocok-bri.js (:1-2240) with the
// rendering left out: the old file also drew HTML/panels, those become the Vue
// page. Everything here is pure and importless so `tools/uji-cocok-bri.mjs`
// can import it with plain Node AND compare its answers with the old engine
// loaded through `new Function('window', …)`.
//
// The rows are PEOPLE'S STATEMENTS of money that came in (or bank-upload rows
// from before 21 Sep 2026); reservation DPs are READ from the reservasi module
// and CONNECTED to a row — never copied into bri_mutasi (haunts otherwise).
//
// Rules that cost real money if they drift:
//   - matching is FOUR GLOBAL ROUNDS, not greedy per row (:138-181);
//   - short names must match EXACTLY (`cbNamaCocok`), or "Ika" grabs Rika;
//   - which DPs count as BRI is decided by the DP METHOD, not `tfBank` (:468);
//   - a DP already held by any live row is never offered again;
//   - `cara` and `batal_at` are accountability: nothing is deleted.

/** Old `CB_NUM`: handles "1.234,56" AND "1,234.56" by taking the LAST
 *  separator as the decimal one. Plain parseFloat stops at the second dot in
 *  "4.167.925" and reads 4,167 — a thousand times smaller and still plausible.
 */
export function cbNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '')
  if (!s) return 0
  const t = s.lastIndexOf('.')
  const k = s.lastIndexOf(',')
  let b = s
  if (t >= 0 || k >= 0) {
    const p = Math.max(t, k)
    b = s.slice(0, p).replace(/[.,]/g, '') + '.' + s.slice(p + 1).replace(/[.,]/g, '')
  }
  const n = Number.parseFloat(b)
  return Number.isFinite(n) ? n : 0
}

const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Clock is always 24-hour WIB (:80-106). The VALUE is converted, not the
 * timezone: "07:30 PM" reads as 19:30 because the printed hour was wrong, not
 * because it moved zones. 1..12 is clamped so "13:00 PM" is not read as 25.
 * Unreadable input returns as-is — better odd on screen than gone.
 */
export function cbJamWIB(v: unknown): string {
  const s = String(v == null ? '' : v).trim()
  if (!s) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  let m = s.match(/^(0?[1-9]|1[0-2])[:.]([0-5]\d)(?:[:.][0-5]\d)?\s*([AaPp])\.?\s?[Mm]\.?(?![A-Za-z])/)
  if (m) {
    let h = Number(m[1]) % 12
    if (/p/i.test(m[3]!)) h += 12
    return p(h) + ':' + m[2]
  }
  m = s.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)/)
  if (m) return p(Number(m[1])) + ':' + m[2]
  return s
}

/** `2026-10-05` → `5 Okt 2026` (:110-114). */
export function cbTglID(iso: unknown): string {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return String(iso || '')
  return `${Number(m[3])} ${NAMA_BLN[Number(m[2]) - 1]} ${m[1]}`
}

/** `2026-10` → `Oktober 2026`. */
export function labelBulanYm(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00`)
  return Number.isNaN(+d) ? ym : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

/** First/last day of a month (:241-247). */
export function rentangBulan(ym: string): { dari: string, sampai: string } {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    const t = new Date()
    ym = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
  }
  const [y, b] = ym.split('-').map(Number) as [number, number]
  const akhir = new Date(Date.UTC(y, b, 0)).getUTCDate()
  return { dari: `${ym}-01`, sampai: `${ym}-${String(akhir).padStart(2, '0')}` }
}

// ---------------------------------------------------------------- rows & DP

/** One `bri_mutasi` row as `GET /kompas/bri` returns it. */
export interface BarisBri {
  id: string
  tgl: string
  jam: string
  nominal: number | string
  ket: string
  settle?: string
  booking?: string
  resId: string
  dpId: string
  resNama: string
  resTgl?: string
  cara: string
  catatan: string
  sumber: string
  cocokOleh?: string
  cocokAt?: number
  oleh?: string
  dibuat?: number
  diubah?: number
  batalAt: number
  batalOleh?: string
  batalAlasan?: string
  [k: string]: unknown
}

/** One reservation instalment, read through the Dana Masuk door (G-14). */
export interface DpBri {
  resId: string
  dpId: string
  nama: string
  resTgl: string
  tfTgl: string
  tfJam: string
  bank: string
  metode: string
  status: string
  /** tfAmount when the proof was read, else the typed amount (:307). */
  nominal: number
  /** What the crew typed — shown beside `nominal` when they differ. */
  diketik: number
  bukti: string
  buktiNama: string
}

/** One row of `bri_dp_abai` (:103-104). */
export interface AbaiBri {
  dpId: string
  resId?: string
  nama?: string
  tgl?: string
  nominal?: number
  alasan: string
  oleh?: string
  at?: number
}

/** NAME AFTER THE COLON: "Reservasi : Arlanda" → "Arlanda" (:118-125). */
export function cbNamaDari(ket: unknown): string {
  const s = String(ket || '').trim()
  const i = s.indexOf(':')
  return (i >= 0 ? s.slice(i + 1) : s).trim()
}

const norm = (s: unknown) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Short names must match EXACTLY; longer ones may be a substring (:126-136).
 * "Ika" would otherwise match Rika, Ikang and Marika — and a wrong match here
 * moves someone's money to someone else's reservation.
 */
export function cbNamaCocok(a: unknown, b: unknown): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x.length < 4 || y.length < 4) return x === y
  return x.includes(y) || y.includes(x)
}

export interface Babak { kode: string, pasti: boolean, teks: string, uji: (m: BarisBri, d: DpBri) => boolean }

/**
 * FOUR GLOBAL ROUNDS, swept over ALL rows before the next round (:138-164).
 * Greedy per row is wrong in a quiet way: a row that only matches by
 * date+nominal would take the DP of a later row that matches by NAME. Measured
 * on production data, greedy missed Fenty, Linda, Caca and Winanto.
 * The first two rounds are "certain" (name + nominal + one of the dates) and
 * may be applied in bulk; the last two must be pressed one by one.
 */
export const BABAK: Babak[] = [
  { kode: 'nama-tgl', pasti: true, teks: 'nama, tanggal bayar, dan nominalnya cocok',
    uji: (m, d) => d.tfTgl === m.tgl && cbNum(d.nominal) === cbNum(m.nominal) && cbNamaCocok(d.nama, cbNamaDari(m.ket)) },
  { kode: 'nama-book', pasti: true, teks: 'nama, tanggal booking, dan nominalnya cocok',
    uji: (m, d) => cbNum(d.nominal) === cbNum(m.nominal) && cbNamaCocok(d.nama, cbNamaDari(m.ket)) && !!m.booking && d.resTgl === m.booking },
  { kode: 'nama', pasti: false, teks: 'nama & nominalnya cocok, tapi tanggalnya tidak menguatkan',
    uji: (m, d) => cbNum(d.nominal) === cbNum(m.nominal) && cbNamaCocok(d.nama, cbNamaDari(m.ket)) },
  { kode: 'tgl', pasti: false, teks: 'tanggal & nominalnya cocok, tapi mutasinya tidak berketerangan',
    uji: (m, d) => !cbNamaDari(m.ket) && d.tfTgl === m.tgl && cbNum(d.nominal) === cbNum(m.nominal) },
]

export interface Usulan { dp: DpBri, babak: Babak }

/**
 * Map mutation id → {dp, babak}. Touches nothing: matching is a decision about
 * money, and writing it without anyone pressing anything decides on their
 * behalf (:166-181).
 */
export function cbUsulan(mutasi: BarisBri[], dps: DpBri[]): Record<string, Usulan> {
  const bebasDp = dps.filter(d => !(d as DpBri & { dipakai?: boolean }).dipakai)
  const pakai: Record<string, boolean> = {}
  const hasil: Record<string, Usulan> = {}
  for (const bb of BABAK) {
    for (const m of mutasi) {
      if (hasil[m.id]) continue
      const d = bebasDp.find(x => !pakai[x.dpId] && bb.uji(m, x))
      if (d) {
        pakai[d.dpId] = true
        hasil[m.id] = { dp: d, babak: bb }
      }
    }
  }
  return hasil
}

/** A cancelled row stays on screen, struck through, out of every sum (:591). */
export const hidupBaris = (r: BarisBri) => !(Number(r.batalAt) > 0)
export const sudahCocok = (r: BarisBri) => hidupBaris(r) && r.cara === 'cocok'
export const bukanCocok = (r: BarisBri) => hidupBaris(r) && r.cara === 'bukan'
export const belumCocok = (r: BarisBri) => hidupBaris(r) && r.cara !== 'cocok' && r.cara !== 'bukan'
export const jmlBaris = (list: { nominal: number | string }[]) => list.reduce((s, r) => s + cbNum(r.nominal), 0)

/**
 * DOES THIS DP ARRIVE IN THE BRI ACCOUNT — decided by the METHOD, never by
 * `tfBank` (:468-492). A QRIS paid from Mandiri/DANA/BCA still settles into
 * BRI's QRIS merchant; a "Transfer BCA" whose receipt says BRI did NOT.
 */
export function dpKeBri(d: { metode?: string, bank?: string }): boolean {
  const m = String(d.metode || '').toUpperCase()
  if (m) return /QRIS/.test(m) || /\bBRI\b/.test(m)
  const b = String(d.bank || '').toUpperCase()
  return /QRIS/.test(b) || /\bBRI\b/.test(b)
}

/**
 * dpId → true for every DP ALREADY held by a live row. Seeded from the server's
 * cross-month list first, then overridden by this month's rows (:454-467).
 * v1 `GET /kompas/bri` does not return `dipakai` yet (gap noted in
 * docs/migrasi/_gap-api.md), so the page passes `{}` and the month's own rows
 * carry the rule.
 */
export function dpTerpakai(rows: BarisBri[], dipakaiLain?: Record<string, unknown> | null): Record<string, boolean> {
  const p: Record<string, boolean> = {}
  for (const id of Object.keys(dipakaiLain || {})) p[id] = true
  for (const r of rows) if (sudahCocok(r) && r.dpId) p[r.dpId] = true
  return p
}

/**
 * The month's DP candidates (:494-512). A DP marked invalid is never offered
 * again; the month filter accepts the transfer date OR the reservation date,
 * and keeps rows WITHOUT a transfer date — 197 of 478 in production, because
 * OCR could not read the date, and dropping them would make them unpickable.
 */
export function dpsBulan(
  dps: DpBri[] | null,
  rows: BarisBri[],
  abai: Record<string, AbaiBri>,
  ym: string,
  dipakaiLain?: Record<string, unknown> | null,
): (DpBri & { dipakai: boolean })[] {
  if (!dps) return []
  const pakai = dpTerpakai(rows, dipakaiLain)
  const r = rentangBulan(ym)
  return dps
    .filter(d => !abai[d.dpId])
    .filter(d => (d.tfTgl >= r.dari && d.tfTgl <= r.sampai) || (d.resTgl >= r.dari && d.resTgl <= r.sampai) || !d.tfTgl)
    .map(d => ({ ...d, dipakai: !!pakai[d.dpId] }))
}

// ---------------------------------------------------------------- display list

export interface GabRow {
  jenis: 'bank' | 'manual'
  id: string
  tgl: string
  jam: string
  nominal: number
  ket: string
  mut: BarisBri
  dp: DpBri | null
}

/**
 * ONE list, ordered by transaction time (:514-590). DPs do not become rows:
 * they are connected to a row, and the ones without a row stand in the card
 * below the table. Rows without a date always go LAST — as an empty string they
 * would pile on top, exactly where the earliest transaction is looked for.
 */
export function barisGabungan(rows: BarisBri[], dps: DpBri[] | null): GabRow[] {
  const out: GabRow[] = rows.map(r => ({
    jenis: r.sumber === 'manual' ? 'manual' : 'bank',
    id: r.id,
    tgl: r.tgl,
    jam: cbJamWIB(r.jam),
    nominal: cbNum(r.nominal),
    ket: String(r.ket || ''),
    mut: r,
    dp: r.dpId ? (dps || []).find(d => d.dpId === r.dpId) || null : null,
  }))
  return out.sort((a, b) => {
    if (!a.tgl !== !b.tgl) return a.tgl ? -1 : 1
    return `${a.tgl} ${a.jam}`.localeCompare(`${b.tgl} ${b.jam}`) || a.ket.localeCompare(b.ket)
  })
}

export interface StatistikBri {
  dana: { total: number, n: number, batal: number }
  rsv: { total: number, n: number }
  luar: { total: number, n: number }
  belum: { total: number, n: number }
  tanpaTgl: number
}

/** The four summary cards (:671-692); cancelled rows are counted, never summed. */
export function statistikBri(rows: BarisBri[]): StatistikBri {
  const h = rows.filter(hidupBaris)
  const rsv = h.filter(sudahCocok)
  const luar = h.filter(bukanCocok)
  const blm = h.filter(belumCocok)
  return {
    dana: { total: jmlBaris(h), n: h.length, batal: rows.filter(r => !hidupBaris(r)).length },
    rsv: { total: jmlBaris(rsv), n: rsv.length },
    luar: { total: jmlBaris(luar), n: luar.length },
    belum: { total: jmlBaris(blm), n: blm.length },
    tanpaTgl: h.filter(r => !r.tgl).length,
  }
}

/** Reservation DPs of the month whose money arrives in BRI and has no row yet
 *  (`dpBelumDicatat`, :1366-1372) — the card that keeps them from vanishing. */
export const dpBelumDicatat = (bulan: (DpBri & { dipakai: boolean })[]) =>
  bulan.filter(d => !d.dipakai && dpKeBri(d))

/** DPs of the month that arrive OUTSIDE BRI — the card explaining the missing
 *  names, with the method to fix (:1336-1347). */
export function dpLuarBri(dps: DpBri[] | null, abai: Record<string, AbaiBri>, ym: string): DpBri[] {
  if (!dps) return []
  const rg = rentangBulan(ym)
  return dps.filter(d => !dpKeBri(d) && !abai[d.dpId]
    && ((d.tfTgl >= rg.dari && d.tfTgl <= rg.sampai)
      || (!d.tfTgl && d.resTgl >= rg.dari && d.resTgl <= rg.sampai)))
}

/** Invalid marks stay visible at the foot of the card, with the lift button
 *  (:1373-1387): a mark that cannot be lifted is a deletion. */
export function dpBernisan(dps: DpBri[] | null, rows: BarisBri[], abai: Record<string, AbaiBri>, ym: string, dipakaiLain?: Record<string, unknown> | null): DpBri[] {
  if (!dps) return []
  const rg = rentangBulan(ym)
  const pakai = dpTerpakai(rows, dipakaiLain)
  return dps.filter(d => abai[d.dpId] && !pakai[d.dpId] && dpKeBri(d)
    && ((d.tfTgl >= rg.dari && d.tfTgl <= rg.sampai)
      || (!d.tfTgl && d.resTgl >= rg.dari && d.resTgl <= rg.sampai)))
}

export const caraLuar = (lain: DpBri[]) => [...new Set(lain.map(d => d.metode || d.bank || '(tanpa metode)'))].slice(0, 6)
export const namaLuar = (lain: DpBri[]) => [...new Set(lain.map(d => d.nama).filter(Boolean))].slice(0, 8)

/** Tab + search filter (:801-814). `batal` keeps ONLY cancelled rows. */
export function filterBarisGab(gab: GabRow[], tapis: string, cari: string): GabRow[] {
  const q = norm(cari)
  return gab.filter((x) => {
    if (tapis === 'rsv' && !(hidupBaris(x.mut) && sudahCocok(x.mut))) return false
    if (tapis === 'luar' && !(hidupBaris(x.mut) && bukanCocok(x.mut))) return false
    if (tapis === 'belum' && !(hidupBaris(x.mut) && belumCocok(x.mut))) return false
    if (tapis === 'batal' && hidupBaris(x.mut)) return false
    if (!q) return true
    return norm([x.ket, x.mut.resNama, x.mut.catatan, x.nominal, x.tgl, x.dp && x.dp.nama].join(' ')).includes(q)
  })
}

/** TRUE = the proof reference points at a file on disk (`@f:<key>`, :1026). */
export const cbBuktiRef = (v: unknown) => typeof v === 'string' && v.indexOf('@f:') === 0
export const cbBuktiKey = (v: string) => v.slice(3)

/** File kind guessed from the NAME until the content lands (:1032-1036). */
export function cbBuktiGambar(data: unknown, nama: unknown): boolean {
  if (cbBuktiRef(data)) return !/\.pdf$/i.test(String(nama || ''))
  return String(data || '').indexOf('data:image') === 0
}

/**
 * data: URI → blob: URL. Chrome blocks top-level navigation to data: URLs
 * (window.open returns null with no error), so PDFs are opened through a blob
 * URL, revoked a minute later (:1880-1899).
 */
export function cbBlobUrl(dataUri: string): string {
  const m = String(dataUri || '').match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/)
  if (!m) return ''
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  try {
    let bytes: Uint8Array
    if (m[2]) {
      const bin = atob(m[3] || '')
      bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    }
    else {
      bytes = new TextEncoder().encode(decodeURIComponent(m[3] || ''))
    }
    return URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: m[1] }))
  }
  catch {
    return ''
  }
}
