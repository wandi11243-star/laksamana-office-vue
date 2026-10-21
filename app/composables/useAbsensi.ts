// Absensi API calls + types. Pattern for every module: one composable file per
// module, fields named exactly as the API sends them
// (laksamana-api/docs/api/absensi.md).
//
// Absensi is the one module WITHOUT version/ETag: the contract says so
// (`docs/api/absensi.md:14`), because the rules are the concurrency control.
// MASUK first-wins, PULANG last-wins, and a decision only lands while the punch
// is still MENUNGGU — the loser is told through `{berubah:0}`, never silently
// believed. So writes here send no `If-Match` and `tanganiKonflik()` is only
// the shared pattern (it always returns false for Absensi).
//
// Punch (face + GPS) and face enrolment are NOT built here: K-02 keeps them in
// the Absensi PWA until task #15 (PLAN.md §3). The Vue screens only READ the
// context, recap, queue, faces, locations and settings.

export interface AbsensiPunch {
  id: string
  tipe: string
  uid: string
  nama: string
  tgl: string
  arah: 'MASUK' | 'PULANG'
  /** Server ms. */
  waktu: number
  /** "08:12". */
  jam: string
  lat: number
  lng: number
  akurasi: number
  lokasi: string
  jarak: number
  dalamArea: 0 | 1
  wajahSkor: number
  wajahOk: 0 | 1
  shift: string
  m: string
  s: string
  sumber: string
  dalamShift: 0 | 1
  status: 'VALID' | 'MENUNGGU' | 'DITOLAK'
  /** Queue reason: LUAR_AREA | LUAR_SHIFT | TANPA_SHIFT | HARI_LIBUR | WAJAH | WAJAH_KOSONG. */
  sebab: string
  alasan: string
  putusAt: number
  putusOleh: string
  putusNota: string
  /** Only the queue sends this: the face the HR must look at. */
  foto?: string | null
}

export interface AbsensiHitung {
  telat: number
  lembur: number
  cepat: number
  durasi: number
  lengkap: 0 | 1
}

export interface AbsensiHari {
  tipe: string
  uid: string
  nama: string
  tgl: string
  masuk: AbsensiPunch | null
  pulang: AbsensiPunch | null
  /** Minutes, computed by the API on read. */
  hitung: AbsensiHitung
  shift: string
  menunggu: 0 | 1
}

export interface AbsensiShift {
  kode: string
  mulai: string
  selesai: string
  sumber: string
  libur: 0 | 1
}

export interface AbsensiLokasi {
  id: string
  nama: string
  lat: number
  lng: number
  radius: number
  aktif: 0 | 1
}

export interface AbsensiSetting {
  toleransiTelat: number
  awalMenit: number
  akhirMenit: number
  lemburMinMenit: number
  wajahAmbang: number
  wajahWajib: boolean
  tanpaShiftBoleh: boolean
  hr: string[]
}

export interface AbsensiSiapa {
  id: string
  nama: string
  keterangan: string
  boleh: 0 | 1
  admin: 0 | 1
  hr: 0 | 1
}

export interface AbsensiContext {
  lokasi: AbsensiLokasi[]
  setting: AbsensiSetting
  /** Server ms. */
  waktuServer: number
  siapa?: AbsensiSiapa
  /** array = a shift exists; null = unscheduled; false = the roster did not answer. */
  shift?: AbsensiShift[] | null | false
  tgl?: string
  hariIni?: AbsensiHari | null
  wajahTerdaftar?: 0 | 1
}

export interface AbsensiRecap {
  dari: string
  sampai: string
  hari: AbsensiHari[]
  setting: AbsensiSetting
}

export interface AbsensiWajah {
  tipe: string
  id: string
  nama: string
  aktif: 0 | 1
  ada: 0 | 1
  at: number
  oleh: string
}

/** The merged defaults of the settings blob (`AbsensiService::defaultSetting()`). */
export const absensiSettingDefault = (): AbsensiSetting => ({
  toleransiTelat: 5,
  awalMenit: 60,
  akhirMenit: 180,
  lemburMinMenit: 15,
  wajahAmbang: 0.45,
  wajahWajib: false,
  tanpaShiftBoleh: false,
  hr: [],
})

/** `siapa` loaded from the context, shared by every screen and the menu (T-05). */
export const useAbsensiSiapa = () => useState<AbsensiSiapa | null>('absensi-siapa', () => null)

/** GET /absensi/context — today's shift, punches, locations, settings and `siapa`. */
export const useAbsensiContext = () =>
  useAsyncData('absensi-context', () => useApi()<Envelope<AbsensiContext>>('/absensi/context').then(r => r.data), { dedupe: 'defer' })

/** Mirror `context.siapa` into the shared state; called once from the module chrome. */
export function muatAbsensiSiapa() {
  const { data } = useAbsensiContext()
  const siapa = useAbsensiSiapa()
  watch(data, (v) => {
    siapa.value = v?.siapa ?? null
  }, { immediate: true })
  return siapa
}

/**
 * Is this person HR in Absensi? The server decides in `context.siapa.hr`
 * (admin of the module, or listed in `setting.hr`) — never guessed from the
 * rows (T-05). Also needed by the menu before it is drawn.
 */
export function useAbsensiHr() {
  const siapa = muatAbsensiSiapa()
  return computed(() => siapa.value?.hr === 1)
}

/** GET /absensi/recap — crew always get their own rows; HR see everyone's. */
export const useAbsensiRecap = (from: Ref<string>, to: Ref<string>) =>
  useAsyncData(
    'absensi-recap',
    () => useApi()<Envelope<AbsensiRecap>>('/absensi/recap', { query: { from: from.value, to: to.value } }).then(r => r.data.hari),
    { watch: [from, to], default: () => [] },
  )

/**
 * GET /absensi/queue — HR only, so the fetch waits until `siapa.hr` is known
 * (`immediate:false`); otherwise every crew opening the module would collect a
 * needless 403. One cache key, shared by the Antrean screen and the menu badge.
 */
export const useAbsensiQueue = () =>
  useAsyncData('absensi-queue', () => useApi()<Envelope<AbsensiPunch[]>>('/absensi/queue').then(r => r.data), {
    dedupe: 'defer',
    default: () => [],
    immediate: false,
  })

/** GET /absensi/faces — HR only, same lazy pattern as the queue. */
export const useAbsensiFaces = () =>
  useAsyncData('absensi-faces', () => useApi()<Envelope<AbsensiWajah[]>>('/absensi/faces').then(r => r.data), {
    dedupe: 'defer',
    default: () => [],
    immediate: false,
  })

/** GET /absensi/locations — all points, active and not. */
export const useAbsensiLocations = () =>
  useAsyncData('absensi-locations', () => useApi()<Envelope<AbsensiLokasi[]>>('/absensi/locations').then(r => r.data), { dedupe: 'defer', default: () => [] })

/** GET /absensi/settings — the single blob with its defaults merged. */
export const useAbsensiSettings = () =>
  useAsyncData('absensi-settings', () => useApi()<Envelope<AbsensiSetting>>('/absensi/settings').then(r => r.data), { dedupe: 'defer', default: absensiSettingDefault })

/** The queue count for the red "Antrean" badge. Fetches only for HR. */
export function useLencanaAbsensi() {
  const hr = useAbsensiHr()
  const { data, refresh } = useAbsensiQueue()
  watch(hr, (v) => {
    if (v) {
      refresh()
    }
  }, { immediate: true })
  return computed<Record<string, number>>(() => ({ antrean: hr.value ? (data.value?.length ?? 0) : 0 }))
}

// ---------------------------------------------------------------- writes

/** POST /absensi/punches/{id}/decision — only while still MENUNGGU; `berubah:0` = lost the race. */
export const decidePunch = (id: string, status: 'VALID' | 'DITOLAK', nota = '') =>
  useApi()<Envelope<{ berubah: 0 | 1 }>>(`/absensi/punches/${id}/decision`, { method: 'POST', body: { status, nota } })

/** POST /absensi/locations — create or replace; radius is clamped server-side to 30–2000 m. */
export const saveLocation = (body: { id?: string, nama: string, lat: number, lng: number, radius: number, aktif: 0 | 1 }) =>
  useApi()<Envelope<{ id: string }>>('/absensi/locations', { method: 'POST', body })

/** DELETE /absensi/locations/{id} — hard delete. */
export const deleteLocation = (id: string) =>
  useApi()<Envelope<{ hapus: number }>>(`/absensi/locations/${id}`, { method: 'DELETE' })

/** PUT /absensi/settings — the single blob. */
export const saveSettings = (data: AbsensiSetting) =>
  useApi()<Envelope<AbsensiSetting>>('/absensi/settings', { method: 'PUT', body: { data } })
