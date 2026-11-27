import { hariIni } from '~/utils/format'

/** The period of Finance › Dashboard, kept while switching between its two tabs. */
export function useDashboardPeriode() {
  return {
    mode: useState<'hari' | 'bulan'>('fin-dash-mode', () => 'bulan'),
    periode: useState('fin-dash-bulan', () => hariIni().slice(0, 7)),
    tanggal: useState('fin-dash-tanggal', () => hariIni()),
  }
}
