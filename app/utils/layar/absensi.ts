// The screens of the Absensi module, in the old PWA's tab order
// (`laksamana-office/absensi/index.html` HALAMAN, :1108-1114). Antrean and Atur
// are HR-only, exactly as the old `hr:1` screens — and HR comes from the
// server's `context.siapa.hr` (T-05), never from the rows.
//
// Punch (the old `absen` buttons) and face enrolment stay in the Absensi PWA
// until task #15 (K-02); these screens link there instead.
import { useAbsensiSiapa } from '~/composables/useAbsensi'

export const PWA_ABSENSI = 'https://absensi.laksamanamuda.id'

/** `siapa.hr` from GET /absensi/context, mirrored into shared state by the shell. */
export const bolehHrAbsensi = () => useAbsensiSiapa().value?.hr === 1

export const LAYAR_ABSENSI: Layar[] = [
  { key: 'absen', label: 'Absen', desc: 'Ringkasan hari ini & pintu ke aplikasi absen.', icon: 'i-lucide-clock', to: '/absensi' },
  { key: 'riwayat', label: 'Riwayat', desc: 'Absensi, telat & lembur — dihitung ulang tiap dibuka.', icon: 'i-lucide-history', to: '/absensi/riwayat' },
  { key: 'antrean', label: 'Antrean', desc: 'Pengajuan absen di luar ketentuan, untuk HR.', icon: 'i-lucide-list-checks', to: '/absensi/antrean', grup: 'HR', boleh: bolehHrAbsensi },
  { key: 'wajah', label: 'Wajah', desc: 'Sidik wajah yang terdaftar.', icon: 'i-lucide-scan-face', to: '/absensi/wajah' },
  { key: 'atur', label: 'Atur', desc: 'Titik kerja & aturan absensi, untuk HR.', icon: 'i-lucide-settings-2', to: '/absensi/atur', grup: 'HR', boleh: bolehHrAbsensi },
]
