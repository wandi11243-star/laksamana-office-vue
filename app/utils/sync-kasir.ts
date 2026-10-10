// Sync Performa Kasir (VUE-6) — ONE source for the cashier-performance freeze.
//
// The old Office copied these into THREE files (`deploy/finance/omset/`,
// `deploy/finance/kas/`, `deploy/cashier/`) and they drifted; here they live
// once. Owner: finance (omset) — the freeze is written by Finance › Omset ›
// Breakdown Sumber and read by PerformaKasir (Kas & Cashier).
//
// What is frozen is NUMBERS, not a final flag: `bdSync` sits NEXT TO `bd` on
// the day row (like `bdLog`), so replacing `bd` on every breakdown save can
// never drop it. `PUT /kompas/days/{tgl}` stores rows as-is under the
// `kompas_save` lock with the day's own version (`If-Match`), so no API
// change was needed.
//
// Formula note: the freeze uses the legacy omset formula exactly (`snapKasir`
// omset :2971-2976 = `omsetKasir` + Kompas-variant `potonganHariKompas`, the
// full amount). The old Office still writes `bdSync` on the same day rows, so
// both apps must freeze the same numbers (owner decision, 10 Oct 2026).
// Days before the cutoff keep the live cashier variant (K-04 untouched), so a
// free-entry tiket row reads differently once synced — as it does in legacy.
//
// Pure functions only: no Vue, no API. Imports only the two rule files
// (`porsi-pic.ts` must stay import-free for `tools/uji-porsi-pic.mjs` —
// importing FROM it here does not affect that).

import { kNum } from './kompas'
import { omsetKasir, potonganHari, potonganHariKompas, type BarisPotong, type HariKompas } from './porsi-pic'

/** The freeze applies from this date on (owner decision, 8 Oct 2026). Older months keep live computation. */
export const SYNC_KASIR_MULAI = '2026-10-01'

/** Whether the freeze applies to a date at all. */
export const syncKasirBerlaku = (tgl: string) => String(tgl) >= SYNC_KASIR_MULAI

/** One frozen cashier row: `{kasirId, off, real, potong}`. */
export interface BekuKasir {
  kasirId: string
  off: boolean
  real: number
  potong: number
}

/** The frozen snapshot on a day row, next to `bd` (`d.bdSync`). */
export interface BdSync {
  at: number
  by: string
  sidik: string
  kasir: BekuKasir[]
  [k: string]: unknown
}

interface BdBuatSidik {
  marketing?: unknown
  event?: unknown
  kasir?: unknown
  self?: unknown
}

/**
 * Fingerprint of the breakdown the freeze was taken from
 * (`sidikBd`, omset :2967-2970). A later breakdown save changes the
 * fingerprint, and the screen must say the freeze is stale — Performa keeps
 * reading the freeze until Sync ulang.
 */
export function sidikBd(bd: BdBuatSidik | null | undefined): string {
  // Same defaults as legacy (`bd.event||[]` …): a freeze written by the old
  // Office must read as "sudah" here when nothing changed.
  return JSON.stringify({ m: bd?.marketing || [], e: bd?.event || [], k: bd?.kasir || [], s: bd?.self || {} })
}

/**
 * Freeze the per-cashier realisasi from the SAVED breakdown (`snapKasir`,
 * omset :2971-2976): OFF cashiers contribute 0, the rest `omsetKasir − potong`
 * with the Kompas-variant deduction (`potonganHariKompas`), as legacy does.
 */
export function snapKasir(bd: BdBuatSidik | null | undefined): BekuKasir[] {
  const d: HariKompas = { date: '', bd: { marketing: (bd?.marketing ?? []) as BarisPotong[] } }
  const out: BekuKasir[] = []
  for (const r of (bd?.kasir ?? []) as BarisPotong[]) {
    const id = String(r.kasirId ?? '')
    if (r.off) {
      out.push({ kasirId: id, off: true, real: 0, potong: 0 })
      continue
    }
    const potong = potonganHariKompas(d, id)
    out.push({ kasirId: id, off: false, real: omsetKasir(r) - potong, potong })
  }
  return out
}

/**
 * Performance rows for one day (the twin in three old files, now one).
 * Before the cutoff: live rows (`omsetKasir − potong`, K-04 cashier variant,
 * exactly as the screen computes now). From the cutoff: the frozen `bdSync`
 * rows, or `null` = "belum dihitung" (not synced, or a broken freeze).
 */
export function barisKasirPerforma(d: HariKompas): BekuKasir[] | null {
  if (!syncKasirBerlaku(d.date)) {
    const out: BekuKasir[] = []
    for (const r of d.bd?.kasir ?? []) {
      const id = String(r.kasirId ?? '')
      if (r.off) {
        out.push({ kasirId: id, off: true, real: 0, potong: 0 })
        continue
      }
      const potong = potonganHari(d, id)
      out.push({ kasirId: id, off: false, real: omsetKasir(r) - potong, potong })
    }
    return out
  }
  const s = (d as { bdSync?: unknown }).bdSync as BdSync | null | undefined
  if (!s || !Array.isArray(s.kasir)) return null
  return s.kasir.map(r => ({
    kasirId: String(r.kasirId ?? ''),
    off: !!r.off,
    real: kNum(r.real),
    potong: kNum(r.potong),
  }))
}
