// HRIS (laksamana-hris PWA) takes over Jadwal and HR (ADR-0012 J9). The
// Office screens link out here during the two-week parallel period; they do
// not call the HRIS API.
export const HRIS = {
  dasar: 'https://hris.laksamanamuda.id',
  kelola: 'https://hris.laksamanamuda.id/kelola',
  roster: 'https://hris.laksamanamuda.id/kelola/roster',
  shift: 'https://hris.laksamanamuda.id/kelola/shift',
} as const
