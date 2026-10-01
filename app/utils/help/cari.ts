// Pure helpers for the Help search, ported from the old engine's `tekaBlok()`
// and `petik()`. `cariPanduan` only ever walks the chapters it is HANDED — the
// caller passes the chapters the user may read (guard 2, in useHelp), so a
// forbidden chapter can never surface even if its data is somehow loaded.
import type { BagianPanduan, Blok, Panduan } from './tipe'
import type { HelpBab } from './registry'

/** All searchable text of one block. An unknown block type is simply skipped. */
export function teksBlok(b: Blok): string {
  const out: string[] = []
  if ((b.t === 'langkah' || b.t === 'catatan') && b.judul) out.push(b.judul)
  switch (b.t) {
    case 'teks':
    case 'catatan':
      out.push(b.isi)
      break
    case 'langkah':
    case 'daftar':
      out.push(...b.isi)
      break
    case 'tanya':
      for (const x of b.isi) out.push(`${x.t} ${x.j}`)
      break
    case 'tabel':
      for (const r of b.baris) out.push(r.join(' '))
      break
    case 'gambar':
      if (b.teks) out.push(b.teks)
      if (b.tandai) out.push(b.tandai.join(' '))
      break
  }
  return out.join(' ')
}

/** Title plus every block of a section. */
export function teksBagian(s: BagianPanduan): string {
  return [s.judul, ...s.isi.map(teksBlok)].join(' ')
}

/** A highlighted excerpt, split into three parts so the view can wrap <mark>
 *  around the match without ever touching innerHTML. */
export interface Petikan { sebelum: string, cocok: string, sesudah: string }

export function petik(t: string, q: string): Petikan {
  const teks = String(t ?? '')
  const i = teks.toLowerCase().indexOf(q)
  if (i < 0) return { sebelum: teks.slice(0, 120), cocok: '', sesudah: '' }
  const a = Math.max(0, i - 45)
  const b = Math.min(teks.length, i + q.length + 65)
  return {
    sebelum: (a > 0 ? '...' : '') + teks.slice(a, i),
    cocok: teks.slice(i, i + q.length),
    sesudah: teks.slice(i + q.length, b) + (b < teks.length ? '...' : ''),
  }
}

export interface HasilCari {
  kunci: string
  label: string
  bagian: BagianPanduan
  petikan: Petikan
}

/**
 * Search the loaded chapters for `q` (at least two letters, like the old box).
 * `bab` and `isi` are already narrowed to what the user may read by useHelp.
 */
export function cariPanduan(
  bab: HelpBab[],
  isi: Record<string, Panduan>,
  q: string,
): HasilCari[] {
  const kw = q.trim().toLowerCase()
  if (kw.length < 2) return []
  const hasil: HasilCari[] = []
  for (const b of bab) {
    const d = isi[b.key]
    if (!d) continue
    for (const s of d.bagian) {
      const t = teksBagian(s)
      if (t.toLowerCase().includes(kw)) {
        hasil.push({ kunci: b.key, label: b.label, bagian: s, petikan: petik(t, kw) })
      }
    }
  }
  return hasil
}
