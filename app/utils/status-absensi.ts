// Every Absensi status in one place (DESIGN.md rule 5), the same shape as
// app/utils/status-reservasi.ts: a colour, an icon and the word, never colour
// alone. The queue reasons are the six the server decides, in its order
// (laksamana-api/docs/api/absensi.md "Queue reasons"); the words are the old
// SEBAB_TEKS (laksamana-office/absensi/index.html:1529-1537).
//
// Colour meanings (DESIGN.md rule 4): warning = waiting / needs a look,
// info = confirmed-neutral, error = act now / rejected, success = good,
// neutral = background.
import type { AbsensiHari } from '~/composables/useAbsensi'
import { durasi } from '~/utils/absensi'

export type WarnaStatusAbsensi = 'success' | 'warning' | 'error' | 'info' | 'vip' | 'neutral' | 'gold'

export interface Lencana {
  label: string
  color: WarnaStatusAbsensi
  icon: string
}

/** LUAR_AREA … -> plain Indonesian, exactly the old SEBAB_TEKS. */
export const SEBAB_TEKS: Record<string, string> = {
  LUAR_AREA: 'Di luar area kerja',
  LUAR_SHIFT: 'Di luar jam shift',
  TANPA_SHIFT: 'Tidak dijadwalkan',
  HARI_LIBUR: 'Dijadwalkan libur',
  WAJAH: 'Wajah tidak cocok',
  WAJAH_KOSONG: 'Wajah belum didaftarkan',
}

export const SEBAB_WARNA: Record<string, WarnaStatusAbsensi> = {
  LUAR_AREA: 'warning',
  LUAR_SHIFT: 'warning',
  TANPA_SHIFT: 'warning',
  HARI_LIBUR: 'info',
  // "Mismatch" is HR suspicion; "never enrolled" is an admin chore — keeping
  // them apart is the point (absensi.md F.6).
  WAJAH: 'error',
  WAJAH_KOSONG: 'warning',
}

export const SEBAB_IKON: Record<string, string> = {
  LUAR_AREA: 'i-lucide-map-pin-off',
  LUAR_SHIFT: 'i-lucide-clock-alert',
  TANPA_SHIFT: 'i-lucide-calendar-x',
  HARI_LIBUR: 'i-lucide-palm-tree',
  WAJAH: 'i-lucide-user-x',
  WAJAH_KOSONG: 'i-lucide-scan-face',
}

export const teksSebab = (sebab: string) => SEBAB_TEKS[sebab] ?? (sebab || 'Perlu diperiksa')
export const warnaSebab = (sebab: string): WarnaStatusAbsensi => SEBAB_WARNA[sebab] ?? 'warning'
export const ikonSebab = (sebab: string) => SEBAB_IKON[sebab] ?? 'i-lucide-triangle-alert'

/**
 * The badges of one work day, in the old order (hariBarisHTML, :1499-1507):
 * Menunggu, Telat, Lembur, Tepat waktu, Belum pulang. A DITOLAK punch counts as
 * nothing, so that day reads "Ditolak" alone rather than a false "tepat waktu".
 */
export function lencanaHari(h: AbsensiHari): Lencana[] {
  if (h.masuk?.status === 'DITOLAK' || h.pulang?.status === 'DITOLAK') {
    return [{ label: 'Ditolak', color: 'error', icon: 'i-lucide-x' }]
  }
  const out: Lencana[] = []
  if (h.menunggu) out.push({ label: 'Menunggu', color: 'warning', icon: 'i-lucide-hourglass' })
  if (h.hitung.telat > 0) out.push({ label: `Telat ${durasi(h.hitung.telat)}`, color: 'error', icon: 'i-lucide-clock-alert' })
  if (h.hitung.lembur > 0) out.push({ label: `Lembur ${durasi(h.hitung.lembur)}`, color: 'info', icon: 'i-lucide-timer' })
  if (!out.length && h.hitung.lengkap) out.push({ label: 'Tepat waktu', color: 'success', icon: 'i-lucide-check' })
  if (!h.hitung.lengkap && !h.menunggu) out.push({ label: 'Belum pulang', color: 'neutral', icon: 'i-lucide-clock' })
  return out
}
