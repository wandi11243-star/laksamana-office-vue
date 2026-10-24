// HRIS (laksamana-hris PWA) takes over Jadwal and HR (ADR-0012 J9). The
// Office screens link out here during the two-week parallel period; they do
// not call the HRIS API.
export const HRIS = {
  dasar: 'https://hris.laksamanamuda.id',
  kelola: 'https://hris.laksamanamuda.id/kelola',
  roster: 'https://hris.laksamanamuda.id/kelola/roster',
  shift: 'https://hris.laksamanamuda.id/kelola/shift',
} as const

/**
 * The Office Jadwal module is read-only (owner decision 2026-10-24, ADR-0012
 * J14): roster, requests, shifts, heads and crew data are written in HRIS
 * only, so HRIS keeps the complete roster history. Screens stay readable.
 */
export const JADWAL_BACA_SAJA = true

export const PESAN_JADWAL_BACA_SAJA = 'Jadwal di Office sekarang hanya bisa dibaca. Ubah roster, pengajuan, dan data kru di HRIS.'
