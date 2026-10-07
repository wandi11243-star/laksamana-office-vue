// The screens of Jadwal Shift (laksamana-office deploy/jadwal NAV_DEF :882-905,
// TITLES :1823-1831), keys unchanged. `/jadwal` itself is the old Roster
// picker (deploy/roster): Jadwal Shift or Daily Worker.
//
// What a screen needs to decide visibility (heads, manajemen) lives in the
// setting blob, so the shell mirrors the viewer's standing into shared state
// (`muatPeranJadwal`) before the menu is drawn — like Reservasi's matrix.
import type { PeranJadwal } from '~/utils/jadwal'
import { ajuBerjalan, bisaPutusHead, bisaPutusHRD, bolehRekap, divisiKuasa, labelPeran } from '~/utils/jadwal'
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'

export const usePeranJadwal = () => useState<PeranJadwal | null>('jadwal-peran', () => null)
/** The viewer's own Divisi, from the roster, for the role line. */
const useDivSaya = () => useState<string>('jadwal-div-saya', () => '')

/** Load the setting + roster once from the module chrome and keep the viewer's standing in shared state. */
export function muatPeranJadwal() {
  const state = usePeranJadwal()
  const divSaya = useDivSaya()
  const { me, peran, divisiDari } = useJadwalDasar()
  watchEffect(() => {
    state.value = peran.value
    divSaya.value = divisiDari(me.value?.id ?? '') ?? ''
  })
  return state
}

const peranAtau = (me: Me): PeranJadwal => usePeranJadwal().value
  ?? { id: me.id, admin: isAdminOf(me, 'jadwal'), manajemen: false, kantor: false, heads: {} }

/** Input Mingguan is for whoever may write some Divisi; before any head exists, everyone may. */
const bolehMinggu = (me: Me) => {
  const p = peranAtau(me)
  return p.admin || divisiKuasa(p).length > 0 || !Object.values(p.heads).some(h => h.length)
}

export const LAYAR_JADWAL: Layar[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Siapa masuk dan siapa libur hari ini', icon: 'i-lucide-layout-dashboard', to: '/jadwal/dashboard', grup: 'Jadwal' },
  { key: 'bulanan', label: 'Jadwal bulanan', desc: 'Lembar sebulan penuh per divisi', icon: 'i-lucide-calendar-days', to: '/jadwal/bulanan', grup: 'Jadwal' },
  { key: 'minggu', label: 'Input mingguan', desc: 'Susun jadwal satu minggu', icon: 'i-lucide-pencil', to: '/jadwal/minggu', grup: 'Jadwal', boleh: bolehMinggu },
  { key: 'rekap', label: 'Rekap pegawai', desc: 'Jadwal sebulan dan jam kerja satu orang', icon: 'i-lucide-chart-line', to: '/jadwal/rekap', grup: 'Jadwal', boleh: me => bolehRekap(peranAtau(me)) },
  { key: 'saya', label: 'Jadwal saya', desc: 'Shift saya bulan ini', icon: 'i-lucide-user', to: '/jadwal/saya', grup: 'Kru' },
  { key: 'pengajuan', label: 'Pengajuan', desc: 'Off, izin, cuti, dan tukar shift', icon: 'i-lucide-message-square-text', to: '/jadwal/pengajuan', grup: 'Kru' },
  { key: 'pegawai', label: 'Data pegawai', desc: 'Tambah kru baru, ubah data diri, nonaktifkan yang keluar', icon: 'i-lucide-users', to: '/jadwal/pegawai', grup: 'Pengaturan', boleh: me => isAdminOf(me, 'jadwal') },
  { key: 'pengaturan', label: 'Pengaturan', desc: 'Definisi shift, head divisi, penempatan kru', icon: 'i-lucide-settings', to: '/jadwal/pengaturan', grup: 'Pengaturan', boleh: me => isAdminOf(me, 'jadwal') },
]

/** The footer role line (`labelPeran`, deploy/jadwal/index.html:1393). */
export function peranJadwalLabel(me: Me | null): string {
  if (!me) return ''
  return labelPeran(peranAtau(me), useDivSaya().value)
}

/** Red badge on Pengajuan: requests this person can act on now (`bisaPutuskan`, `:4516`). */
export function useLencanaJadwal() {
  const { data } = useJadwalRequests()
  const { peran, divisiDari } = useJadwalDasar()
  return computed<Record<string, number>>(() => ({
    pengajuan: (data.value ?? []).filter(a => ajuBerjalan(a)
      && (bisaPutusHead(peran.value, a, divisiDari(a.userId)) || bisaPutusHRD(peran.value, a))).length,
  }))
}
