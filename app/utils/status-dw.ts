// The status pills of Daily Worker, one source for every screen (DESIGN.md
// rule 5). Words are the old STATUS_AJU/HADIR_LBL (utils/dw.ts); colours
// follow DESIGN.md rule 4.
export type WarnaStatusDw = 'success' | 'warning' | 'error' | 'info' | 'neutral'

/** Ajuan/permintaan status → colour (deploy/dw/index.html pilStatus :2561). */
export const STATUS_DW_WARNA: Record<string, WarnaStatusDw> = {
  MENUNGGU: 'warning',
  DISETUJUI: 'success',
  DITOLAK: 'error',
  BATAL: 'neutral',
  KEDALUWARSA: 'neutral',
}

export const STATUS_DW_IKON: Record<string, string> = {
  MENUNGGU: 'i-lucide-hourglass',
  DISETUJUI: 'i-lucide-check',
  DITOLAK: 'i-lucide-x',
  BATAL: 'i-lucide-undo-2',
  KEDALUWARSA: 'i-lucide-calendar-x',
}

/** `hadir` value → pill. The empty string means "belum dikonfirmasi" and is
 *  still paid (utils/dw.ts hadirDibayar), so it must never read "tidak hadir". */
export const HADIR_DW_WARNA: Record<string, WarnaStatusDw> = {
  '': 'neutral',
  'HADIR': 'success',
  'TELAT': 'warning',
  'ALFA': 'error',
}

export const HADIR_DW_IKON: Record<string, string> = {
  '': 'i-lucide-circle-help',
  'HADIR': 'i-lucide-user-check',
  'TELAT': 'i-lucide-clock',
  'ALFA': 'i-lucide-user-x',
}

/** Worker status (STATUS_DW), not attendance. */
export const STATUS_PEKERJA_WARNA: Record<string, WarnaStatusDw> = {
  AKTIF: 'success',
  NONAKTIF: 'neutral',
}

export const STATUS_PEKERJA_IKON: Record<string, string> = {
  AKTIF: 'i-lucide-circle-check',
  NONAKTIF: 'i-lucide-circle-slash',
}
