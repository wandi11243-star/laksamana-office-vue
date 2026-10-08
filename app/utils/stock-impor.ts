// Stock spreadsheet import — header mapping for `bacaBerkasTabel` rows.
//
// `bacaBerkasTabel` (app/utils/xlsx-baca.ts, fondasi-owned) returns rows keyed
// by COLUMN LETTER (`{A: 'Nama', B: '12'}`), with the header as the FIRST row.
// Every Stock import file (our own export CSVs included) carries its header on
// that first row, so callers must map letters -> header names before reading
// `r.Nama` etc. That mapping lives here, once, instead of in five pages.
import type { BarisTabel } from '~/utils/xlsx-baca'

/** One spreadsheet row keyed by its header text (`{Nama: 'Gula', ...}`). */
export type BarisBerkolom = Record<string, string>

const rapikanKepala = (s: unknown): string => String(s ?? '').replace(/^\uFEFF/, '').trim()

/**
 * Letters -> headers using the FIRST row, the rest become header-keyed rows.
 * Empty header cells are skipped (first header wins on duplicates); cells that
 * are empty stay absent, so callers keep reading `String(r.X || '')`.
 */
export function barisBerkolom(baris: BarisTabel[]): BarisBerkolom[] {
  if (!baris.length) return []
  const hurufKeKepala = new Map<string, string>()
  const kepalaTerpakai = new Set<string>()
  for (const [huruf, nilai] of Object.entries(baris[0] ?? {})) {
    const kepala = rapikanKepala(nilai)
    if (!kepala || kepalaTerpakai.has(kepala)) continue
    kepalaTerpakai.add(kepala)
    hurufKeKepala.set(huruf, kepala)
  }
  if (!hurufKeKepala.size) return []
  return baris.slice(1).map((b) => {
    const o: BarisBerkolom = {}
    for (const [huruf, kepala] of hurufKeKepala) {
      const v = b[huruf]
      if (v !== undefined && String(v) !== '') o[kepala] = String(v)
    }
    return o
  })
}

// ---------------------------------------------------------------- vendors & products (purchasing database)

// The export CSVs (`unduhVendor`, `unduhProduk` in database.vue) are the import
// format: headers are Indonesian labels, the API wants lowercase keys. Values
// are translated back to server codes; a column that is absent (or all empty)
// is left OUT of the row so the server keeps the stored value.
const HARI_ID: Record<string, number> = {
  minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6,
}

const angkaHariTutup = (s: string): number[] => {
  const out: number[] = []
  for (const pot of String(s ?? '').split(/[\s,;]+/)) {
    const t = pot.trim()
    if (!t) continue
    if (/^\d+$/.test(t)) {
      const n = Number(t)
      if (n >= 0 && n <= 6 && !out.includes(n)) out.push(n)
    }
    else {
      const n = HARI_ID[t.toLowerCase()]
      if (n !== undefined && !out.includes(n)) out.push(n)
    }
  }
  return out
}

const YA = (s: string): boolean => ['ya', 'y', '1', 'true'].includes(String(s ?? '').trim().toLowerCase())

const TIDAK = (s: string): boolean => ['tidak', 't', '0', 'false', 'no'].includes(String(s ?? '').trim().toLowerCase())

/** Export-labelled vendor row -> `{nama, whatsapp, ...}` for `POST /vendors-import`. */
export function barisKeVendor(r: BarisBerkolom): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  const ambil = (k: string): string => String(r[k] ?? '').trim()
  const nama = ambil('Nama')
  if (!nama) return o
  o.nama = nama
  if ('WhatsApp' in r) o.whatsapp = ambil('WhatsApp')
  if ('Perlu jadwal jemput' in r) o.perluJadwalJemput = YA(r['Perlu jadwal jemput'] ?? '')
  if ('Penerima' in r) o.penerima = ambil('Penerima')
  if ('Bank' in r) o.bank = ambil('Bank')
  if ('No. rekening' in r) o.norek = ambil('No. rekening')
  if ('Hari tutup' in r) o.tutupHari = angkaHariTutup(r['Hari tutup'] ?? '')
  return o
}

/** Export-labelled product row -> `{nama, sumber, ...}` for `POST /products-import`. */
export function barisKeProduk(r: BarisBerkolom): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  const ambil = (k: string): string => String(r[k] ?? '').trim()
  const nama = ambil('Nama')
  if (!nama) return o
  o.nama = nama
  if ('Sumber' in r) {
    const s = ambil('Sumber').toLowerCase()
    o.sumber = s.includes('central') || s === 'ck' ? 'ck' : (s.includes('vendor & ck') || s === 'both' ? 'both' : '')
  }
  if ('Vendor utama' in r) o.utama = ambil('Vendor utama')
  if ('Cara beli' in r) {
    const c = ambil('Cara beli').toLowerCase()
    o.caraBeli = c.includes('online') ? 'online' : (c.includes('jemput') ? 'jemput' : '')
  }
  if ('Kategori' in r) o.kategori = ambil('Kategori')
  if ('Aktif' in r) o.aktif = TIDAK(r.Aktif ?? '') ? false : true
  return o
}
