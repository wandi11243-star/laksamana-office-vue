// The status pill of a Jadwal request, one source for every screen (DESIGN.md
// rule 5). The words are the old LABEL_STATUS_AJU (utils/jadwal.ts), which name
// WHO the request waits for; the colours follow DESIGN.md rule 4.
export type WarnaStatusJadwal = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const STATUS_AJU_WARNA: Record<string, WarnaStatusJadwal> = {
  MENUNGGU: 'warning',
  MENUNGGU_HRD: 'info',
  DISETUJUI: 'success',
  DITOLAK: 'error',
}

export const STATUS_AJU_IKON: Record<string, string> = {
  MENUNGGU: 'i-lucide-hourglass',
  MENUNGGU_HRD: 'i-lucide-forward',
  DISETUJUI: 'i-lucide-check',
  DITOLAK: 'i-lucide-x',
}
