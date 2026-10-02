// BD OS promotion rules specific to BD's own screens (outlet list, hours, sort,
// CSV export/import) — pure functions, no Vue, no API. The rules Radar also
// shows (types, categories, days, status, remaining time) live in
// app/utils/promo.ts, the single source for both boards.
import type { BdPromo } from '~/composables/useBd'
import { PROMO_ST, PROMO_URUT, promoHariTeks, promoKat, promoStatus, promoTipe } from '~/utils/promo'

/** `PROMO_OUTLET_BAWAAN`. */
export const PROMO_OUTLET_BAWAAN = 'Laksamana Muda'
/** `promoOutletOpsi` — the default plus every outlet already used, plus the one being edited. */
export function promoOutletOpsi(promos: BdPromo[], terpilih?: string): string[] {
  const ada = [PROMO_OUTLET_BAWAAN]
  ;(promos || []).forEach((p) => {
    const o = String(p.outlet || '').trim()
    if (o && !ada.includes(o)) ada.push(o)
  })
  const t = String(terpilih || '').trim()
  if (t && !ada.includes(t)) ada.push(t)
  return ada
}
/** `promoJam` — "11:00 — 14:00" or "". */
export const promoJam = (p: BdPromo) =>
  (p.jamMulai || p.jamSelesai ? `${p.jamMulai || '—'} — ${p.jamSelesai || '—'}` : '')

/** `promoSort` — running, then nearest upcoming, then paused, then ended. */
export function promoSort(a: BdPromo, b: BdPromo): number {
  const sa = PROMO_URUT[promoStatus(a)] ?? 9
  const sb = PROMO_URUT[promoStatus(b)] ?? 9
  if (sa !== sb) return sa - sb
  return String(a.mulai || '').localeCompare(String(b.mulai || ''))
}

// ─────────────────────────── CSV export & import ──
// One column list writes the file AND reads it back: two lists drift, and what
// drifts silently is which column lands in which field (`:2829-2860`).

export interface PromoCsvKol { k: string, b?: string, alias?: string[], baca?: (v: string) => string, tulis?: (p: BdPromo) => string | number }

export const PROMO_CSV_KOL: PromoCsvKol[] = [
  { k: 'ID', b: 'id' },
  { k: 'Nama Promo', b: 'nama', alias: ['Promotion Notes', 'Promotion Master Code', 'Nama', 'Promo', 'Nama Promosi'] },
  { k: 'Tanggal Mulai', b: 'mulai', alias: ['Start Date', 'Mulai', 'Tgl Mulai'], baca: promoCsvTgl },
  { k: 'Tanggal Selesai', b: 'selesai', alias: ['End Date', 'Selesai', 'Tgl Selesai'], baca: promoCsvTgl },
  { k: 'Benefit / nilai diskon', b: 'benefit', alias: ['Discount', 'Diskon', 'Benefit', 'Nilai Diskon'], baca: promoCsvDiskon },
  { k: 'Tipe', tulis: p => promoTipe(p.tipe).l },
  { k: 'Kategori', tulis: p => promoKat(p.kategori)?.l || '' },
  { k: 'Status', tulis: p => PROMO_ST[promoStatus(p)]?.l || '' },
  { k: 'Hari Berlaku', tulis: p => promoHariTeks(p.hari) || 'Setiap hari' },
  { k: 'Jam', tulis: p => promoJam(p) },
  { k: 'Outlet', tulis: p => p.outlet || '' },
  { k: 'Kode', tulis: p => p.kode || '' },
  { k: 'Kuota', tulis: p => Number(p.kuota) || 0 },
  { k: 'PIC Laksamana', tulis: p => p.lmPIC || '' },
  { k: 'Syarat & Ketentuan', tulis: p => p.ketentuan || '' },
]

export const promoCsvKunci = (s: unknown) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase()

/** `promoCsvTgl` — POS "17-08-2026 02:30" to "2026-08-17"; day-first by default. */
export function promoCsvTgl(v: unknown): string {
  const s = String(v == null ? '' : v).trim()
  if (!s || s === '-') return ''
  const p2 = (n: string | number) => String(n).padStart(2, '0')
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return `${m[1]}-${p2(m[2]!)}-${p2(m[3]!)}`
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s)
  if (m) {
    const a = +m[1]!
    const b = +m[2]!
    if (b > 12 && a <= 12) return `${m[3]}-${p2(a)}-${p2(b)}`
    return `${m[3]}-${p2(b)}-${p2(a)}`
  }
  return ''
}
/** `promoCsvDiskon` — "17,00 %" → "17%", other text left as is. */
export function promoCsvDiskon(v: unknown): string {
  let s = String(v == null ? '' : v).trim()
  if (!s || s === '-' || s === '—') return ''
  s = s.replace(/(\d)[,.]00\s*%/, '$1%').replace(/\s+%/g, '%')
  return s.replace(/\s+/g, ' ').trim()
}

/** `promoBuatBarisCsv` — header + one row per promo. */
export function promoBuatBarisCsv(promos: BdPromo[]): (string | number)[][] {
  const baris: (string | number)[][] = [PROMO_CSV_KOL.map(k => k.k)]
  promos.forEach((p) => {
    baris.push(PROMO_CSV_KOL.map(kol => (kol.tulis ? kol.tulis(p) : (p as unknown as Record<string, unknown>)[kol.b!] == null ? '' : (p as unknown as Record<string, unknown>)[kol.b!] as string | number)))
  })
  return baris
}
/** `promoParseCsv` — quote-aware parser; a naive split mangles "Syarat & Ketentuan". */
export function promoParseCsv(teks: string): string[][] {
  let t = String(teks || '').replace(/^\uFEFF/, '')
  let pisah = ''
  const m = /^sep=(.)\r?\n/i.exec(t)
  if (m) {
    pisah = m[1]!
    t = t.slice(m[0].length)
  }
  if (!pisah) {
    const kepala = t.split(/\r?\n/)[0] || ''
    const hit: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
    let luar = true
    for (let i = 0; i < kepala.length; i++) {
      const ch = kepala[i]!
      if (ch === '"') luar = !luar
      else if (luar && hit[ch] !== undefined) hit[ch]!++
    }
    pisah = [',', ';', '\t'].sort((a, b) => hit[b]! - hit[a]!)[0]!
    if (!hit[pisah]) pisah = ','
  }
  const baris: string[][] = []
  let sel = ''
  let row: string[] = []
  let dalam = false
  for (let j = 0; j < t.length; j++) {
    const c = t[j]!
    if (dalam) {
      if (c === '"') {
        if (t[j + 1] === '"') {
          sel += '"'
          j++
        }
        else dalam = false
      }
      else sel += c
    }
    else if (c === '"') dalam = true
    else if (c === pisah) {
      row.push(sel)
      sel = ''
    }
    else if (c === '\n') {
      row.push(sel)
      baris.push(row)
      row = []
      sel = ''
    }
    else if (c !== '\r') sel += c
  }
  if (sel !== '' || row.length) {
    row.push(sel)
    baris.push(row)
  }
  return baris.filter(r => r.some(x => String(x).trim() !== ''))
}

export interface PromoImporRencana {
  baru: { nama: string, mulai: string, selesai: string, benefit: string }[]
  ubah: { id: string, lamaNama: string, isi: { nama: string, mulai: string, selesai: string, benefit: string } }[]
  lewat: { no: number, nama: string, sebab: string }[]
  berkas: string
}

/** `promoImportBaca` — match by ID, then by name; reversed dates are refused, not fixed. */
export function promoImporRencana(teks: string, namaBerkas: string, ada: BdPromo[]): PromoImporRencana | { error: string } {
  const baris = promoParseCsv(teks)
  if (baris.length < 2) return { error: 'Tidak ada satu baris data pun di bawah baris judul.' }
  const kepala = baris[0]!.map(promoCsvKunci)
  const idx: Record<string, number> = {}
  PROMO_CSV_KOL.forEach((kol) => {
    if (!kol.b) return
    const calon = [kol.k].concat(kol.alias || [])
    for (let i = 0; i < calon.length; i++) {
      const p = kepala.indexOf(promoCsvKunci(calon[i]))
      if (p >= 0) {
        idx[kol.b] = p
        break
      }
    }
  })
  if (idx.nama === undefined) return { error: 'Kolom nama promo tidak ketemu. Judulnya harus "Nama Promo" atau "Promotion Notes".' }
  const ambil = (r: string[], b: string) => (idx[b] === undefined ? '' : String(r[idx[b]!] == null ? '' : r[idx[b]!]).trim())
  const baru: PromoImporRencana['baru'] = []
  const ubah: PromoImporRencana['ubah'] = []
  const lewat: PromoImporRencana['lewat'] = []
  const petaNama: Record<string, BdPromo> = {}
  ada.forEach((p) => {
    petaNama[promoCsvKunci(p.nama)] = p
  })
  baris.slice(1).forEach((r, i) => {
    const nama = ambil(r, 'nama')
    if (!nama) {
      lewat.push({ no: i + 2, nama: '(kosong)', sebab: 'Nama promo kosong' })
      return
    }
    const mulai = promoCsvTgl(ambil(r, 'mulai'))
    const selesai = promoCsvTgl(ambil(r, 'selesai'))
    if (!mulai || !selesai) {
      lewat.push({ no: i + 2, nama, sebab: 'Tanggal mulai/selesai tidak terbaca' })
      return
    }
    if (selesai < mulai) {
      lewat.push({ no: i + 2, nama, sebab: 'Tanggal selesai sebelum tanggal mulai' })
      return
    }
    const benefit = promoCsvDiskon(ambil(r, 'benefit'))
    const id = ambil(r, 'id')
    const lama = (id && ada.find(p => p.id === id)) || petaNama[promoCsvKunci(nama)] || null
    const isi = { nama, mulai, selesai, benefit }
    if (lama) {
      ubah.push({ id: lama.id!, lamaNama: lama.nama, isi })
    }
    else baru.push(isi)
  })
  return { baru, ubah, lewat, berkas: namaBerkas }
}
