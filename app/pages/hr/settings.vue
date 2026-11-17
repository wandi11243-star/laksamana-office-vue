<!--
  HR › Pengaturan (deploy/hr/index.html RENDER.settings :2568-2686).

  Every number is an initial calibration point; changing the attendance rules
  applies RETROACTIVELY to every uploaded month because scores are recomputed
  from the daily rows (F.2). Saving writes one setting key at a time
  (`PUT /settings/{key}`), so a failure on one card does not roll back the
  others. Export backup works; Import/Reset show "Segera" — K-01 chose a
  dedicated endpoint (G-13), not a client loop.
-->
<script setup lang="ts">
import type { HrAttendanceRules, HrSettings } from '~/utils/hr'
import { canHr } from '~/utils/hr'
import { hrPostAudit, hrSaveSetting, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

interface FormSetting {
  scoreWeights: Record<string, string>
  defaultComponentScore: string
  grades: { g: string, min: string }[]
  reviewLayerWeights: Record<string, string>
  violationDeduct: Record<string, string>
  spRules: { ringanToSP1: string, spValidMonths: string }
  pointRules: Record<string, string>
  attendanceRules: {
    wp: string
    wt: string
    tol: string
    cap: string
    noout: string
    capI: string
    capS: string
    codes: string
    off: string
    offkw: string
  }
}

const toast = useToast()
const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const admin = computed(() => canHr('manageOps', cu.value, officeAdmin.value))
const sibuk = ref(false)

const JUDUL_BOBOT: [string, string][] = [
  ['attendance', 'Attendance (dari Talenta)'],
  ['kpi', 'KPI'],
  ['training', 'Training'],
  ['review', 'Customer Review'],
  ['discipline', 'Disiplin'],
  ['teamwork', 'Teamwork'],
  ['initiative', 'Inisiatif'],
]

const form = ref<FormSetting | null>(null)
function isiForm() {
  const st = s.value.settings
  const AR = st.attendanceRules
  form.value = {
    scoreWeights: Object.fromEntries(Object.keys(st.scoreWeights).map(k => [k, String(st.scoreWeights[k] ?? 0)])),
    defaultComponentScore: String(st.defaultComponentScore),
    grades: st.grades.map(g => ({ g: g.g, min: String(g.min) })),
    reviewLayerWeights: Object.fromEntries(['self', 'manager', 'hr', 'ceo'].map(k => [k, String(st.reviewLayerWeights[k] ?? 0)])),
    violationDeduct: Object.fromEntries(['Ringan', 'Sedang', 'Berat'].map(k => [k, String(st.violationDeduct[k] ?? 0)])),
    spRules: { ringanToSP1: String(st.spRules.ringanToSP1), spValidMonths: String(st.spRules.spValidMonths) },
    pointRules: Object.fromEntries(Object.keys(st.pointRules).map(k => [k, String(st.pointRules[k] ?? 0)])),
    attendanceRules: {
      wp: String(AR.weights.presence ?? 0),
      wt: String(AR.weights.punctuality ?? 0),
      tol: String(AR.lateToleranceMin ?? 15),
      cap: String(AR.lateCapMin ?? 45),
      noout: String(AR.noCheckoutCredit ?? 0.5),
      capI: String(AR.excusedCaps.I ?? 3),
      capS: String(AR.excusedCaps.S ?? 2),
      codes: (AR.excusedCodes || []).join(', '),
      off: (AR.offShifts || []).join(', '),
      offkw: (AR.offShiftContains || []).join(', '),
    },
  }
}
watch(s, () => {
  if (!form.value) isiForm()
}, { immediate: true })

const angka = (v: string | undefined, fallback = 0) => Number(v) || fallback
const totalBobot = computed(() => (form.value ? JUDUL_BOBOT.reduce((a, [k]) => a + angka(form.value!.scoreWeights[k]), 0) : 0))
const totalHadir = computed(() => (form.value ? angka(form.value.attendanceRules.wp) + angka(form.value.attendanceRules.wt) : 0))

const daftarKoma = (v: string) => String(v || '').split(',').map(x => x.trim()).filter(Boolean)

async function simpan() {
  if (!form.value || sibuk.value) return
  const f = form.value
  const st = s.value.settings
  const setelan: HrSettings = JSON.parse(JSON.stringify(st))
  setelan.scoreWeights = Object.fromEntries(Object.keys(st.scoreWeights).map(k => [k, angka(f.scoreWeights[k])]))
  setelan.defaultComponentScore = angka(f.defaultComponentScore, 75)
  setelan.grades = f.grades.map(g => ({ g: g.g, min: angka(g.min) }))
  setelan.reviewLayerWeights = Object.fromEntries(['self', 'manager', 'hr', 'ceo'].map(k => [k, angka(f.reviewLayerWeights[k])]))
  setelan.violationDeduct = Object.fromEntries(['Ringan', 'Sedang', 'Berat'].map(k => [k, angka(f.violationDeduct[k])]))
  setelan.spRules = { ringanToSP1: angka(f.spRules.ringanToSP1, 3), spValidMonths: angka(f.spRules.spValidMonths, 6) }
  setelan.pointRules = Object.fromEntries(Object.keys(st.pointRules).map(k => [k, angka(f.pointRules[k])]))
  const ar: HrAttendanceRules = {
    ...st.attendanceRules,
    weights: { presence: angka(f.attendanceRules.wp), punctuality: angka(f.attendanceRules.wt) },
    lateToleranceMin: angka(f.attendanceRules.tol),
    lateCapMin: angka(f.attendanceRules.cap, 45),
    noCheckoutCredit: Math.max(0, Math.min(1, Number(f.attendanceRules.noout) || 0)),
    excusedCaps: { ...st.attendanceRules.excusedCaps, I: angka(f.attendanceRules.capI), S: angka(f.attendanceRules.capS) },
    excusedCodes: daftarKoma(f.attendanceRules.codes).map(x => x.toUpperCase()),
    offShifts: daftarKoma(f.attendanceRules.off),
    offShiftContains: daftarKoma(f.attendanceRules.offkw).map(x => x.toLowerCase()),
  }
  if (ar.lateCapMin <= ar.lateToleranceMin) {
    ar.lateCapMin = ar.lateToleranceMin + 1
    toast.add({ title: `Penalti penuh harus lebih besar dari toleransi. Disetel ke ${ar.lateCapMin} menit.`, color: 'warning' })
  }
  setelan.attendanceRules = ar

  sibuk.value = true
  let gagal = 0
  try {
    for (const key of ['scoreWeights', 'defaultComponentScore', 'grades', 'reviewLayerWeights', 'violationDeduct', 'spRules', 'pointRules', 'attendanceRules']) {
      try {
        await hrSaveSetting(key, setelan[key])
      }
      catch {
        gagal++
      }
    }
    try {
      await hrPostAudit('SETTINGS_SAVE', '')
    }
    catch {
      // Audit is a bonus.
    }
    if (gagal) toast.add({ title: `${gagal} bagian gagal disimpan — coba simpan lagi`, color: 'warning' })
    else toast.add({ title: 'Pengaturan tersimpan', color: 'success' })
    await refresh()
  }
  finally {
    sibuk.value = false
  }
}

function ekspor() {
  const blob = new Blob([JSON.stringify(s.value, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Staff-Performance_Laksamana_backup_${hariIni()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  toast.add({ title: 'Backup terunduh', color: 'success' })
}
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Bobot skor, grade, aturan kehadiran."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="!admin"
      title="Halaman ini untuk admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Pengaturan diatur admin modul <b>hr</b> (dari Kelola Akses Office).
      </p>
    </AppPanel>

    <template v-else-if="form">
      <AppPanel>
        <p class="rounded-field bg-muted px-3 py-2 text-sm text-muted">
          Semua angka di bawah adalah <b>titik kalibrasi awal</b>. Setelah 2–3 bulan data aktual berjalan, review
          ulang bobot dan target bersama HRD & para manager.
        </p>
      </AppPanel>

      <div class="grid gap-0 lg:grid-cols-2 lg:gap-5">
        <AppPanel
          title="Bobot People Score"
          icon="i-lucide-scale"
        >
          <div class="mb-2">
            <AppStatus
              :color="totalBobot === 100 ? 'success' : 'warning'"
              size="sm"
            >
              total {{ totalBobot }}%{{ totalBobot === 100 ? '' : ', sebaiknya 100%' }}
            </AppStatus>
          </div>
          <div class="space-y-2">
            <div
              v-for="[k, l] in JUDUL_BOBOT"
              :key="k"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-sm">{{ l }}</span>
              <UInput
                v-model="form.scoreWeights[k]"
                type="number"
                min="0"
                max="100"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3 border-t border-default pt-2">
              <span class="text-sm">Nilai default komponen kosong</span>
              <UInput
                v-model="form.defaultComponentScore"
                type="number"
                class="w-24"
              />
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Grade & review"
          icon="i-lucide-award"
        >
          <div class="space-y-2">
            <div
              v-for="g in form.grades"
              :key="g.g"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-sm font-semibold">{{ g.g }} <span class="font-normal text-muted">min.</span></span>
              <UInput
                v-model="g.min"
                type="number"
                class="w-24"
              />
            </div>
          </div>
          <p class="mb-2 mt-4 text-sm font-semibold text-highlighted">
            Bobot layer review
          </p>
          <div class="space-y-2">
            <div
              v-for="L in [{ k: 'self', l: 'Self' }, { k: 'manager', l: 'Manager' }, { k: 'hr', l: 'HRD' }, { k: 'ceo', l: 'CEO' }]"
              :key="L.k"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-sm">{{ L.l }}</span>
              <UInput
                v-model="form.reviewLayerWeights[L.k]"
                type="number"
                class="w-24"
              />
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Disiplin & poin"
          icon="i-lucide-gavel"
        >
          <div class="space-y-2">
            <div
              v-for="k in ['Ringan', 'Sedang', 'Berat']"
              :key="k"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-sm">Potongan {{ k }}</span>
              <UInput
                v-model="form.violationDeduct[k]"
                type="number"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3 border-t border-default pt-2">
              <span class="text-sm">Ringan → SP1 setelah (×)</span>
              <UInput
                v-model="form.spRules.ringanToSP1"
                type="number"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Masa berlaku SP (bulan)</span>
              <UInput
                v-model="form.spRules.spValidMonths"
                type="number"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3 border-t border-default pt-2">
              <span class="text-sm">Poin badge</span>
              <UInput
                v-model="form.pointRules.badge"
                type="number"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Poin lulus training</span>
              <UInput
                v-model="form.pointRules.trainingPass"
                type="number"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Poin Employee of the Month</span>
              <UInput
                v-model="form.pointRules.eom"
                type="number"
                class="w-24"
              />
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Kehadiran"
          icon="i-lucide-calendar-check"
        >
          <div class="mb-2">
            <AppStatus
              :color="totalHadir === 100 ? 'success' : 'warning'"
              size="sm"
            >
              presensi + ketepatan = {{ totalHadir }}%{{ totalHadir === 100 ? '' : ', sebaiknya 100%' }}
            </AppStatus>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Bobot presensi</span>
              <UInput
                v-model="form.attendanceRules.wp"
                type="number"
                min="0"
                max="100"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Bobot ketepatan waktu</span>
              <UInput
                v-model="form.attendanceRules.wt"
                type="number"
                min="0"
                max="100"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Toleransi terlambat (menit)</span>
              <UInput
                v-model="form.attendanceRules.tol"
                type="number"
                min="0"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Penalti penuh di (menit)</span>
              <UInput
                v-model="form.attendanceRules.cap"
                type="number"
                min="1"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Nilai hari tanpa check-out</span>
              <UInput
                v-model="form.attendanceRules.noout"
                type="number"
                min="0"
                max="1"
                step="0.05"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Jatah izin (I) per bulan</span>
              <UInput
                v-model="form.attendanceRules.capI"
                type="number"
                min="0"
                class="w-24"
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm">Jatah sakit (S) per bulan</span>
              <UInput
                v-model="form.attendanceRules.capS"
                type="number"
                min="0"
                class="w-24"
              />
            </div>
          </div>
          <UFormField
            label="Kode absensi yang tidak mengurangi skor"
            help="Dipisah koma. Kode di luar daftar ini (dan di luar I/S berjatah) dihitung hari kerja biasa."
            class="mt-3"
          >
            <UInput
              v-model="form.attendanceRules.codes"
              placeholder="OTL, CT, CKM"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Nama shift yang bukan hari kerja"
            help="Dicocokkan persis. Tambahkan kalau ada shift baru yang berarti libur."
          >
            <UInput
              v-model="form.attendanceRules.off"
              placeholder="dayoff, National Holiday"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Shift libur berdasarkan kata kunci"
            help="Shift apa pun yang mengandung salah satu kata ini dianggap libur."
          >
            <UInput
              v-model="form.attendanceRules.offkw"
              placeholder="dayoff, libur, holiday"
              class="w-full"
            />
          </UFormField>
          <p class="mt-2 text-sm text-muted">
            Mengubah aturan ini berlaku <b>surut ke semua bulan</b> yang sudah diunggah. Skor dihitung ulang dari
            data harian, jadi tidak perlu unggah ulang berkas.
          </p>
        </AppPanel>
      </div>

      <AppPanel
        title="Data"
        icon="i-lucide-database"
      >
        <p class="mb-3 text-sm text-muted">
          Data tersimpan online ke database MySQL milik sendiri dan otomatis tersinkron antar perangkat. Ekspor
          backup tetap berguna sebelum perubahan besar.
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Ekspor backup (JSON)"
            icon="i-lucide-download"
            size="sm"
            loading-auto
            @click="ekspor"
          />
          <UButton
            label="Impor backup — Segera (G-13)"
            icon="i-lucide-upload"
            color="neutral"
            variant="outline"
            size="sm"
            disabled
          />
          <UButton
            label="Reset ke data awal — Segera (G-13)"
            icon="i-lucide-triangle-alert"
            color="error"
            variant="ghost"
            size="sm"
            disabled
          />
        </div>
        <p class="mt-2 text-xs text-muted">
          Impor & reset massal menunggu endpoint khusus (K-01 → G-13, laksamana-api#187) supaya tidak menimpa
          seluruh dokumen lewat klien.
        </p>
      </AppPanel>

      <div class="mb-5">
        <UButton
          :label="sibuk ? 'Menyimpan…' : 'Simpan pengaturan'"
          :loading="sibuk"
          size="lg"
          @click="simpan"
        />
      </div>
    </template>
  </AppPage>
</template>
