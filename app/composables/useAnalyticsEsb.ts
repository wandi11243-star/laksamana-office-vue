// Analytics × POS ESB: the "Sinkronkan dengan ESB" pull and the "Per hari"
// mode (deploy/analytics/index.html :1531 muatHari, :8166 anSinkronEsb).
// Both pull bills through GET /kompas/esb/sales and parse them with the SAME
// parser as an Excel upload; only the sync saves anything.
import { getEsbSales, laporanDariHasil, type LaporanBulan } from '~/composables/useAnalytics'
import { uraiLaporanPos } from '~/utils/analytics-agregat'
import { esbKeBaris, esbTarikPerHari, type EsbInfo, type HariEsb } from '~/utils/analytics-esb'
import { hariIni } from '~/utils/format'

/** Days kept from a pull that stopped half way; memory only, gone on reload. */
const hariTersimpan = new Map<string, HariEsb>()

/** Pull a date range and summarise it like a Detail Report upload. */
export async function tarikLaporanEsb(dari: string, sampai: string, label: string, lapor: (t: string) => void): Promise<{ L: LaporanBulan, bulan: string, info: EsbInfo, ganda: number } | null> {
  const { bills, ganda } = await esbTarikPerHari(dari, sampai, (tgl, p) => getEsbSales(tgl, tgl, p).catch((e) => {
    throw new Error(apiErrorMessage(e), { cause: e })
  }), lapor, label, { simpanan: hariTersimpan, hariIni: hariIni() })
  if (!bills.length) return null
  const { rows, info } = esbKeBaris(bills)
  const u = uraiLaporanPos(rows, `API ESB · ${label}`)
  return { L: { ...laporanDariHasil(u), diunggah: hariIni(), oleh: useMe().value?.name ?? '' }, bulan: u.bulan, info, ganda }
}

/** Pages that answer a one-period question (HARIAN_VIEW); trend pages compare days and stay monthly. */
export const HARIAN_VIEW = ['ringkasan', 'hari', 'menu', 'kategori', 'kunjungan', 'meja', 'error']

type MuatHari = 'memuat' | { kosong: true } | { galat: string }

/**
 * "Per hari": a picked date is pulled from ESB and replaces that month for the
 * pages above. Memory only (one pull per date per session) — never saved, the
 * monthly summary does not change. Picking a month leaves daily mode.
 */
export function useAnalyticsHarian() {
  const hari = useState<string>('analytics-hari', () => '')
  const data = useState<Record<string, LaporanBulan>>('analytics-hari-data', () => ({}))
  const muatSt = useState<Record<string, MuatHari>>('analytics-hari-st', () => ({}))
  const blnPilih = useState<string | null>('analytics-bln', () => null)

  async function muat(t: string, ulang = false) {
    if (ulang) {
      const { [t]: _, ...sisa } = data.value
      data.value = sisa
    }
    muatSt.value = { ...muatSt.value, [t]: 'memuat' }
    try {
      const r = await tarikLaporanEsb(t, t, t, () => {})
      if (!r) {
        muatSt.value = { ...muatSt.value, [t]: { kosong: true } }
        return
      }
      if (!r.L.hari?.[t]) throw new Error(`ESB tidak memulangkan bill bertanggal ${t}.`)
      data.value = { ...data.value, [t]: { ...r.L, esb: { sampai: t, harian: true, at: new Date().toISOString(), ...r.info, ganda: r.ganda } } }
      const { [t]: _, ...sisa } = muatSt.value
      muatSt.value = sisa
    }
    catch (e) {
      muatSt.value = { ...muatSt.value, [t]: { galat: (e as Error)?.message || String(e) } }
    }
  }
  function pilih(t: string) {
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      hari.value = ''
      return
    }
    if (t > hariIni()) return
    hari.value = t
    blnPilih.value = t.slice(0, 7)
    if (!data.value[t] && muatSt.value[t] !== 'memuat') void muat(t)
  }
  function geser(n: number) {
    const d = new Date(`${hari.value || hariIni()}T00:00:00`)
    d.setDate(d.getDate() + n)
    pilih(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  /** A month chip leaves daily mode (blnPilih, :1521). */
  function pilihBulan(b: string | null | undefined) {
    hari.value = ''
    blnPilih.value = b ?? null
  }
  const laporanHari = computed(() => (hari.value ? data.value[hari.value] ?? null : null))
  const status = computed(() => (hari.value ? muatSt.value[hari.value] ?? null : null))
  return { hari, laporanHari, status, pilih, geser, muat, pilihBulan }
}
