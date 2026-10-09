// Marketing › Purchase Order + Katalog (issue #62): pure rules.
// No API, no Vue. Tested by tools/uji-marketing-tugas.mjs.
//
// Source: laksamana-office deploy/marketing/index.html
//   PO: poAkhirMinggu :13932 · poKirimKeBD :14127 · poChipStatus :14076
//       poGambarDaftar :14086 (only rows sent from Marketing, newest first)
//   Katalog: katUpload :8893 (fotoKah, 8 MB, title from the file name)
//            katGeser :8986 · katKe :9038 (wraps around)

// ---------------------------------------------------------------- purchase order

export const DIVISI_PO_MKT = ['Business Development', 'Marketing', 'Project', 'Purchasing'] as const

/** One form row (poBarisMkt): name, qty, unit, reason, estimated price. */
export interface BarisPoMkt { item: string, qty: string, unit: string, note: string, amount: string }
export const barisPoKosongMkt = (): BarisPoMkt => ({ item: '', qty: '1', unit: 'Unit', note: '', amount: '' })

/** A purchase-order row as BD keeps it (only the fields this page reads). */
export interface PoBdMkt {
  id?: string
  item?: string
  qty?: number | string
  unit?: string
  note?: string
  amount?: number | string
  needBy?: string
  status?: string
  vendor?: string
  prId?: string | null
  byName?: string
  input?: string
  sumber?: string
  createdAt?: number | string
}

/** Sunday of this week, Monday-based (poAkhirMinggu, :13932). */
export function akhirMingguMkt(hari: string): string {
  const d = new Date(`${hari}T00:00:00`)
  d.setDate(d.getDate() + (7 - ((d.getDay() + 6) % 7) - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Digits of a typed price, "1.250.000" → 1250000 (poBacaRp). */
export const angkaRpMkt = (s: string) => Number.parseInt(String(s ?? '').replace(/\D/g, ''), 10) || 0

/** Re-format while typing: thousands with dots, at most 15 digits (poFmtRp). */
export function formatRpKetikMkt(s: string): string {
  const d = String(s ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15)
  return d ? (+d).toLocaleString('id-ID') : ''
}

/**
 * Rows → the batch body (poKirimKeBD, :14127). Rows without a name are
 * skipped; the event name rides in the note so purchasing knows the event.
 * `by` stays empty: it is a BD `people` id Marketing does not know — the
 * name goes as text in byName/input.
 */
export function itemPoMkt(baris: BarisPoMkt[], f: { needBy: string, div: string, event: string, nama: string }) {
  const out: Record<string, unknown>[] = []
  for (const b of baris) {
    const nama = b.item.trim()
    if (!nama) continue
    const alasan = b.note.trim()
    out.push({
      item: nama,
      qty: +b.qty || 1,
      unit: b.unit.trim() || 'Unit',
      amount: angkaRpMkt(b.amount),
      needBy: f.needBy, div: f.div, status: 'Diajukan', vendor: '', prId: null,
      by: '', byName: f.nama || 'Marketing', input: f.nama || 'Marketing', sumber: 'Marketing',
      note: alasan + (f.event ? `${alasan ? ' · ' : ''}Event: ${f.event}` : ''),
    })
  }
  return out
}

/** Only what Marketing sent, newest first (poGambarDaftar, :14086). */
export const poMarketingMkt = (po: PoBdMkt[]) =>
  po.filter(p => p && String(p.sumber ?? '') === 'Marketing').slice().sort((a, b) => (+(b.createdAt ?? 0) || 0) - (+(a.createdAt ?? 0) || 0))

/**
 * Status colour by meaning (poChipStatus, :14076): refused red, done green,
 * still waiting amber; an UNKNOWN status is still drawn, never dropped.
 */
export function warnaStatusPoMkt(s?: string): 'error' | 'success' | 'warning' | 'neutral' {
  const l = String(s ?? '').trim().toLowerCase()
  if (/tolak|reject|batal|cancel/.test(l)) return 'error'
  if (/setuju|approve|terima|selesai|done|beli|terbeli/.test(l)) return 'success'
  if (/ajukan|menunggu|pending|proses/.test(l)) return 'warning'
  return 'neutral'
}

// ---------------------------------------------------------------- katalog

export interface SlideKatalogMkt {
  id: string
  judul?: string
  sub?: string
  desc?: string
  key?: string
  name?: string
  at?: string
  by?: string
}

export const MAKS_GAMBAR_KATALOG_MKT = 8 * 1024 * 1024

/** An image by its file name — the server keeps no mime type (fotoKah, :8804). */
export const fotoKahMkt = (nama: string) => /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(String(nama ?? ''))

/** Upload gate (katUpload, :8898): images only, 8 MB. null = fine. */
export function cekGambarKatalogMkt(nama: string, ukuran: number): { judul: string, isi: string } | null {
  if (!fotoKahMkt(nama)) return { judul: 'Harus gambar', isi: `${nama} bukan file gambar.` }
  if (ukuran > MAKS_GAMBAR_KATALOG_MKT) return { judul: 'File terlalu besar', isi: `${nama} lebih dari 8MB.` }
  return null
}

/** Title guessed from the file name, so 20 uploads are not 20 "Belum ada judul" (:8909). */
export const tebakJudulMkt = (nama: string) => String(nama ?? '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

/** Swap with the neighbour; out of range = unchanged (katGeser, :8986). */
export function geserSlideMkt<T>(arr: T[], i: number, arah: -1 | 1): T[] {
  const j = i + arah
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return arr
  const out = arr.slice()
  const t = out[i]!
  out[i] = out[j]!
  out[j] = t
  return out
}

/** Slide index that wraps both ways (katKe, :9038). */
export const indeksSlideMkt = (i: number, n: number) => (n ? ((i % n) + n) % n : 0)
