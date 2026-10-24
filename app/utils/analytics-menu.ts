// Analytics › Menu & Bahan Baku engine: a port of menuNormal / petaKode /
// saranKode / uraiResep from deploy/analytics/index.html (:2304–2720,
// :3829–3905). Pure functions, so tools/uji-analytics.mjs can run them.
//
// Package rows are merged at DRAW time, never at parse time: a code paired
// next month must heal every month already stored.
import type { ResepHpp } from '~/utils/pohon-resep'
import { kelMenu, menuKatLewat, type AgregatKategori, type AgregatMenu } from './analytics-agregat.ts'
import { PAKET_RE, UKURAN_BAWAAN, paketGenerik, paketNamaAsli } from './analytics-pos.ts'

interface Agg { qty?: number, nilai?: number }
interface AggUk extends Agg { induk?: number }
export interface LaporanMenu {
  menu?: Record<string, Agg>
  ukuran?: Record<string, Record<string, Record<string, AggUk>>> | null
  kategori?: Record<string, { kat?: string }>
  katMenu?: Record<string, Record<string, unknown>>
}

// ------------------------------------------------------------- package codes

/** Manual pairs from Pengaturan (fallback), codes upper-cased in one place. */
export function petaKodeManual(petaKode: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (petaKode && typeof petaKode === 'object') {
    for (const [k, v] of Object.entries(petaKode as Record<string, unknown>)) {
      const s = String(v ?? '').trim()
      if (s) out[String(k).toUpperCase()] = s
    }
  }
  return out
}

/**
 * `kode` on HPP dish recipes (wins). A code used by two recipes is paired to
 * neither and reported: picking one guesses which recipe gets the portions.
 * `base` never sells, so it is never a target.
 */
export function petaKodeHpp(resep: ResepHpp[] | null): { peta: Record<string, string>, dobel: Record<string, string[]> } {
  const out: Record<string, string> = {}
  const dobel: Record<string, string[]> = {}
  for (const r of resep ?? []) {
    if (!r || r.tipe !== 'dish') continue
    const kd = String(r.kode ?? '').trim().toUpperCase()
    const nm = String(r.nama ?? '').trim()
    if (!kd || !nm) continue
    if (out[kd] === undefined) {
      out[kd] = nm
      continue
    }
    if (out[kd] === nm) continue
    const d = dobel[kd] || (dobel[kd] = [out[kd]!])
    if (!d.includes(nm)) d.push(nm)
  }
  const peta = Object.fromEntries(Object.entries(out).filter(([k]) => !dobel[k]))
  return { peta, dobel }
}

/** HPP over manual: reversed, filling a code in HPP would change nothing while an old pair exists. */
export function petaKode(petaKode: unknown, resep: ResepHpp[] | null): Record<string, string> {
  return { ...petaKodeManual(petaKode), ...petaKodeHpp(resep).peta }
}

export interface KodeCatatan {
  bentrok: { kode: string, hpp: string, manual: string }[]
  dobel: Record<string, string[]>
}
export function kodeCatatan(petaKode: unknown, resep: ResepHpp[] | null): KodeCatatan {
  const man = petaKodeManual(petaKode)
  const h = petaKodeHpp(resep)
  const bentrok = Object.keys(h.peta).filter(k => man[k] && man[k] !== h.peta[k]).map(k => ({ kode: k, hpp: h.peta[k]!, manual: man[k]! }))
  return { bentrok, dobel: h.dobel }
}

// ------------------------------------------------------------- menuNormal

export interface GabMenu { qty: number, nilai: number, kel: string }
export interface TakKenal { qty: number, nilai: number, dari: string, induk: string }
export interface HasilMenu {
  gab: Record<string, GabMenu>
  takKenal: Record<string, TakKenal>
  digabung: number
  ev: { nama: string[], qty: number, nilai: number }
  ukTotal: { qty: number, pindah: number, sendiri: number, minus: number }
  ukLama: { qty: number, nilai: number }
  adaUkuran: boolean
  adaKel: boolean
}

/**
 * Raw POS menus -> merged list (menuNormal, :2401). Names are upper-cased (POS
 * and HPP spell them differently; one key per drink). Named package rows join
 * their drink; size-only rows are NOT extra drinks — they mark how many of the
 * parent's portions were large, so non-default sizes MOVE out of the parent.
 */
export function menuNormal(d: LaporanMenu, pk: Record<string, string>): HasilMenu {
  const mentah = d.menu ?? {}
  const uk = d.ukuran ?? null
  const ukLama = { qty: 0, nilai: 0 }
  const km = (d.katMenu ?? {}) as Record<string, Record<string, AgregatMenu>>
  const kat = (d.kategori ?? {}) as Record<string, AgregatKategori>
  const KEL = kelMenu(km, kat)
  const lewat = menuKatLewat(km, kat)
  const gab: Record<string, GabMenu> = {}
  const takKenal: Record<string, TakKenal> = {}
  const ev = { nama: [] as string[], qty: 0, nilai: 0 }
  let digabung = 0
  // the first non-empty group wins: otherwise the group depends on POS row order
  const tambah = (nama: string, q: number, n: number, kel?: string) => {
    const k = String(nama ?? '').trim().toUpperCase()
    const o = gab[k] || (gab[k] = { qty: 0, nilai: 0, kel: '' })
    o.qty += q
    o.nilai += n
    if (!o.kel && kel) o.kel = kel
  }
  for (const nm of Object.keys(mentah)) {
    const m = mentah[nm]!
    const q = m.qty ?? 0
    const n = m.nilai ?? 0
    // filtered BEFORE the package branch, so an event menu ending "(PACKAGE)" still leaves
    if (lewat[nm]) {
      ev.nama.push(nm)
      ev.qty += q
      ev.nilai += n
      continue
    }
    if (!PAKET_RE.test(nm)) {
      tambah(nm, q, n, KEL[nm])
      continue
    }
    if (!paketGenerik(nm)) {
      tambah(paketNamaAsli(nm), q, n, KEL[nm])
      digabung += q
      continue
    }
    // size-only row: already counted in its parent; an old upload cannot split it
    if (!uk) {
      ukLama.qty += q
      ukLama.nilai += n
    }
  }

  const ukTotal = { qty: 0, pindah: 0, sendiri: 0, minus: 0 }
  for (const ind of Object.keys(uk ?? {})) {
    for (const lbl of Object.keys(uk![ind] ?? {})) {
      for (const kd of Object.keys(uk![ind]![lbl] ?? {})) {
        const u = uk![ind]![lbl]![kd] ?? {}
        const q = u.qty ?? 0
        const nSur = u.nilai ?? 0
        const nInd = u.induk ?? 0
        ukTotal.qty += q
        const namaResep = kd ? pk[kd] : undefined
        // no parent row above it: this row IS the drink — added, not moved (no group: not guessed)
        if (!ind) {
          tambah(namaResep || (kd ? `${lbl} (PACKAGE) · ${kd}` : `${lbl} (PACKAGE)`), q, nSur, '')
          ukTotal.sendiri += q
          if (kd && !namaResep) {
            const t = takKenal[kd] || (takKenal[kd] = { qty: 0, nilai: 0, dari: `${lbl} (PACKAGE)`, induk: '' })
            t.qty += q
            t.nilai += nSur
          }
          continue
        }
        if (lewat[ind]) {
          ev.nilai += nSur
          continue
        }
        // the default size stays in its parent (its surcharge too, so totals do not move)
        if (!lbl || lbl === UKURAN_BAWAAN) {
          if (nSur) tambah(ind, 0, nSur, KEL[ind])
          continue
        }
        const dasar = gab[String(ind).trim().toUpperCase()]
        // never push a parent negative: left in place and reported
        if (!dasar || dasar.qty < q) {
          ukTotal.minus += q
          continue
        }
        dasar.qty -= q
        dasar.nilai -= nInd
        tambah(namaResep || `${ind} (${lbl})`, q, nInd + nSur, KEL[ind])
        ukTotal.pindah += q
        if (kd && !namaResep) {
          const t = takKenal[kd] || (takKenal[kd] = { qty: 0, nilai: 0, dari: `${lbl} (PACKAGE)`, induk: ind })
          t.qty += q
          t.nilai += nInd + nSur
        }
      }
    }
  }
  ev.nama.sort()
  return { gab, takKenal, digabung, ev, ukTotal, ukLama, adaUkuran: !!d.ukuran, adaKel: Object.keys(KEL).length > 0 }
}

// ------------------------------------------------------------- pairing suggestions

const UKURAN_PAKET = ['LARGE', 'REGULAR', 'SMALL', 'MEDIUM']
export function ukuranPaket(nm: unknown): string {
  const s = String(nm ?? '').replace(PAKET_RE, '').trim().toUpperCase()
  return s.match(/^(LARGE|REGULAR|SMALL|MEDIUM)\b/)?.[1] ?? ''
}
/** Whole word: "ENLARGED" is not large. */
export function punyaKataUkuran(nama: unknown, kata: string): boolean {
  return new RegExp(`\\b${kata}\\b`, 'i').test(String(nama ?? ''))
}

/**
 * Pairing guesses for a code (saranKode, :2629): `utama` match the row's size;
 * `cadangan` (size-less names) only for a sized code without its own recipe —
 * offered separately because picking one melts large portions into regular.
 */
export function saranKode(kode: string, namaAda: string[], hppNama: string[], ukuran: string): { utama: string[], cadangan: string[] } {
  const inti = String(kode ?? '').replace(/[0-9_.-]+$/, '').toUpperCase()
  if (inti.length < 3) return { utama: [], cadangan: [] }
  const norm = (n: string) => n.toUpperCase().replace(/[^A-Z]/g, '')
  const kumpul: Record<string, string> = {}
  for (const n of [...namaAda, ...hppNama]) {
    const s = String(n ?? '').trim()
    // an unpaired package row carries its own code and would always match itself
    if (!s || /\(PACKAGE\)/i.test(s)) continue
    const k = s.toLowerCase()
    if (kumpul[k] === undefined) kumpul[k] = s
  }
  const cocok = Object.values(kumpul).filter(n => norm(n).includes(inti))
  const berukuran = (n: string) => UKURAN_PAKET.some(u => u !== 'REGULAR' && punyaKataUkuran(n, u))
  if (!ukuran || ukuran === 'REGULAR') return { utama: cocok.filter(n => !berukuran(n)).slice(0, 4), cadangan: [] }
  return {
    utama: cocok.filter(n => punyaKataUkuran(n, ukuran)).slice(0, 4),
    cadangan: cocok.filter(n => !berukuran(n)).slice(0, 4),
  }
}

// ------------------------------------------------------------- recipes -> ingredients

export type PetaResep = Record<string, ResepHpp>
/** Recipes keyed lower-case, so upper-cased menu names still find them. */
export function resepPeta(resep: ResepHpp[] | null): PetaResep {
  const peta: PetaResep = {}
  for (const r of resep ?? []) if (r && r.nama) peta[String(r.nama).trim().toLowerCase()] = r
  return peta
}
/** Dish recipe names (for suggestions); `base` never sells. */
export function hppNamaMenu(peta: PetaResep): string[] {
  return Object.values(peta).filter(r => r.tipe === 'dish' && r.nama).map(r => String(r.nama).trim())
}

export interface Urai {
  keluar: Record<string, number>
  prep: Record<string, number>
  putar: Record<string, 'siklus' | 'dalam'>
  hilang: Record<string, number>
}
/**
 * Nested recipe expansion (uraiResep, :3850): a recipe may use another, the
 * yield divides. Raw leaves go to `keluar`, every base passed through to
 * `prep` (in the unit of the line that uses it). The two must not be summed.
 */
export function uraiResep(nama: string, qty: number, peta: PetaResep, U: Urai, dalam = 0, jejak: Record<string, 1> = {}): void {
  const k = String(nama ?? '').trim().toLowerCase()
  if (!k) return
  if (jejak[k]) {
    U.putar[String(nama).trim()] = 'siklus'
    return
  }
  if (dalam > 6) {
    U.putar[String(nama).trim()] = 'dalam'
    return
  }
  const r = peta[k]
  if (!r) {
    U.hilang[nama] = (U.hilang[nama] ?? 0) + qty
    return
  }
  const y = Number(r.yield_qty) || 1
  const j2 = { ...jejak, [k]: 1 as const }
  for (const x of Array.isArray(r.bahan) ? r.bahan : []) {
    const nm = String(x?.nama ?? x?.bahan ?? '').trim()
    const q = (Number(x?.qty ?? x?.jumlah) || 0) * qty / y
    if (!nm || !q) continue
    const sat = String(x?.satuan ?? x?.unit ?? '').trim()
    const sub = peta[nm.toLowerCase()]
    if (sub) {
      const kunci = String(sub.nama || nm) + (sat ? ` (${sat})` : '')
      U.prep[kunci] = (U.prep[kunci] ?? 0) + q
      uraiResep(nm, q, peta, U, dalam + 1, j2)
    }
    else {
      const kunci = nm + (sat ? ` (${sat})` : '')
      U.keluar[kunci] = (U.keluar[kunci] ?? 0) + q
    }
  }
}
export const uraiBaru = (): Urai => ({ keluar: {}, prep: {}, putar: {}, hilang: {} })

/** Ingredients of one menu, recomputed (the month totals cannot be split back). */
export function bahanSatuMenu(nama: string, qty: number, peta: PetaResep): { mentah: Record<string, number>, prep: Record<string, number> } {
  const U = uraiBaru()
  uraiResep(nama, qty, peta, U)
  return { mentah: U.keluar, prep: U.prep }
}

/** `>= 100` whole, else two decimals (mnBulat). */
export const mnBulat = (q: number): string => q >= 100
  ? Math.round(q).toLocaleString('id-ID')
  : (Math.round(q * 100) / 100).toLocaleString('id-ID')
