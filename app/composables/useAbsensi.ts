// Absensi API calls + types. Pattern for every module: one composable file per
// module, fields named exactly as the API sends them (laksamana-api docs/api/absensi.md).

export interface AbsensiPunch {
  id: string
  arah: 'MASUK' | 'PULANG'
  jam: string
  status: 'VALID' | 'MENUNGGU' | 'DITOLAK'
  shift: string
  m: string
  s: string
}

export interface AbsensiHari {
  uid: string
  tgl: string
  nama: string
  shift: string
  masuk: AbsensiPunch | null
  pulang: AbsensiPunch | null
  /** Minutes, computed by the API on read. */
  hitung: { telat: number, lembur: number, cepat: number, durasi: number, lengkap: 0 | 1 }
  menunggu: 0 | 1
}

export interface AbsensiContext {
  tgl: string
  hariIni: AbsensiHari | null
  shift: { kode: string, mulai: string, selesai: string, libur: 0 | 1 }[] | null | false
}

/** GET /absensi/context: today's punches and shift for the logged-in user. */
export const useAbsensiContext = () =>
  useAsyncData('absensi-context', () => useApi()<Envelope<AbsensiContext>>('/absensi/context').then(r => r.data))

/** GET /absensi/recap: crew always get their own rows; HR may pass `user`. */
export const useAbsensiRecap = (from: Ref<string>, to: Ref<string>) =>
  useAsyncData(
    'absensi-recap',
    () => useApi()<Envelope<{ hari: AbsensiHari[] }>>('/absensi/recap', { query: { from: from.value, to: to.value } }).then(r => r.data.hari),
    { watch: [from, to], default: () => [] },
  )

/** 95 -> "1 j 35 m". */
export function menit(n: number): string {
  if (!n) return '—'
  const j = Math.floor(n / 60)
  return j ? `${j} j ${n % 60} m` : `${n} m`
}

/** How a day reads, as an AppStatus colour + words. */
export function statusHari(h: AbsensiHari): { color: 'success' | 'warning' | 'error' | 'neutral', label: string } {
  if (h.menunggu) return { color: 'warning', label: 'Menunggu HR' }
  if (h.masuk?.status === 'DITOLAK') return { color: 'error', label: 'Ditolak' }
  if (h.hitung.telat) return { color: 'error', label: `Telat ${menit(h.hitung.telat)}` }
  if (!h.pulang) return { color: 'neutral', label: 'Belum pulang' }
  return { color: 'success', label: 'Tepat waktu' }
}

/** "2026-09-27" -> "Sab, 27 Sep". */
export const tglPendek = (tgl: string) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
