// The screens of Daily Worker (laksamana-office deploy/dw NAV_DEF :1254-1300,
// keys unchanged). `/dw` itself is the module home (Dashboard), like every
// module.
//
// Visibility follows the old `bolehBuka()`: the server sends `peran`
// (hrd/head/lihat/admin) and the setting carries the `akses` matrix an admin
// may edit (T-10, UI-only). The shell mirrors both into shared state before
// the menu is drawn (`muatPeranDw`), exactly like Jadwal's own matrix.
import type { PeranDw, SettingDw } from '~/utils/dw'
import { antreanPerluDikerjakanDw, bolehBukaDw, divisiKuasaDw, labelPeranDw, normalSettingDw } from '~/utils/dw'
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'

export const usePeranDwSiap = () => useState<PeranDw | null>('dw-peran', () => null)
const useSetelanDwSiap = () => useState<SettingDw | null>('dw-setelan', () => null)

/** Load the overview once from the module chrome; the menu reads from here. */
export function muatPeranDw() {
  const peran = usePeranDwSiap()
  const set = useSetelanDwSiap()
  const { peran: p, set: s } = useDwDasar()
  watchEffect(() => {
    peran.value = p.value
    set.value = s.value
  })
  return peran
}

const peranAtauDw = (me: Me | null): PeranDw => usePeranDwSiap().value
  ?? { hrd: false, head: false, lihat: false, admin: isAdminOf(me, 'dw'), nama: me?.name ?? '', divisi: [] }
const setelanAtauDw = (): SettingDw => useSetelanDwSiap().value ?? normalSettingDw({})

/** One screen's visibility, read by both the sidebar and the page body. */
export function bolehLayarDw(key: string, me: Me | null): boolean {
  return bolehBukaDw(setelanAtauDw(), peranAtauDw(me), key)
}

export const LAYAR_DW: Layar[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'DW yang masuk hari ini', icon: 'i-lucide-layout-dashboard', to: '/dw', grup: 'Operasional', boleh: me => bolehLayarDw('dashboard', me) },
  { key: 'hadir', label: 'Konfirmasi kehadiran', desc: 'Siapa yang benar-benar datang — inilah dasar pembayarannya', icon: 'i-lucide-clipboard-check', to: '/dw/hadir', grup: 'Operasional', boleh: me => bolehLayarDw('hadir', me) },
  { key: 'tamu', label: 'Kalender tamu', desc: 'Pax dari Marketing, Event & Reservasi — klik hari untuk ajukan DW', icon: 'i-lucide-calendar-heart', to: '/dw/tamu', grup: 'Operasional', boleh: me => bolehLayarDw('tamu', me) },
  { key: 'kalender', label: 'Kalender DW', desc: 'Sebulan penuh per divisi', icon: 'i-lucide-calendar-days', to: '/dw/kalender', grup: 'Daily Worker', boleh: me => bolehLayarDw('kalender', me) },
  { key: 'permintaan', label: 'Permintaan DW', desc: 'Permintaan divisi Anda & putusannya', icon: 'i-lucide-mail', to: '/dw/permintaan', grup: 'Daily Worker', boleh: me => bolehLayarDw('permintaan', me) },
  { key: 'antrean', label: 'Antrean pengajuan', desc: 'Setujui atau tolak permintaan & pengajuan DW', icon: 'i-lucide-inbox', to: '/dw/antrean', grup: 'Daily Worker', boleh: me => bolehLayarDw('antrean', me) },
  { key: 'rekap', label: 'Rekap pegawai', desc: 'Jadwal sebulan, jam kerja & upah satu DW', icon: 'i-lucide-chart-line', to: '/dw/rekap', grup: 'Data', boleh: me => bolehLayarDw('rekap', me) },
  { key: 'bayar', label: 'Pembayaran', desc: 'Rekap mingguan & daftar transfer', icon: 'i-lucide-banknote', to: '/dw/bayar', grup: 'Data', boleh: me => bolehLayarDw('bayar', me) },
  { key: 'pekerja', label: 'Database DW', desc: 'Talent pool daily worker', icon: 'i-lucide-users', to: '/dw/pekerja', grup: 'Sistem', boleh: me => bolehLayarDw('pekerja', me) },
  { key: 'pengaturan', label: 'Pengaturan', desc: 'Tarif, posisi, jam bawaan, panduan jumlah DW', icon: 'i-lucide-settings', to: '/dw/pengaturan', grup: 'Sistem', boleh: me => bolehLayarDw('pengaturan', me) },
  { key: 'akses', label: 'Hak akses', desc: 'Siapa yang berhak memutuskan di modul ini', icon: 'i-lucide-shield-check', to: '/dw/akses', grup: 'Sistem', boleh: me => bolehLayarDw('akses', me) },
]

/** The footer role line (`setSubPeran`, deploy/dw/index.html:2367). */
export function peranDwLabel(me: Me | null): string {
  if (!me) return ''
  return labelPeranDw(peranAtauDw(me))
}

const peranKosong: PeranDw = { hrd: false, head: false, lihat: false, admin: false, nama: '', divisi: [] }
const peranUntukLencana = (me: Me | null): PeranDw => usePeranDwSiap().value ?? (me ? peranAtauDw(me) : peranKosong)

/** Red badges: the HRD desk (antrean) and the viewer's own division requests. */
export function useLencanaDw() {
  const me = useMe()
  const { ajuan, permintaan } = useDwDasar()
  const peran = computed(() => peranUntukLencana(me.value))
  return computed<Record<string, number>>(() => {
    const p = peran.value
    const kuasa = divisiKuasaDw(p)
    return {
      antrean: antreanPerluDikerjakanDw(ajuan.value, permintaan.value),
      permintaan: permintaan.value.filter(x => x.status === 'MENUNGGU' && (p.hrd || kuasa.includes(x.divisi))).length,
    }
  })
}
