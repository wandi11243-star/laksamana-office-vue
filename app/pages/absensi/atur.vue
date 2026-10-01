<!--
  Atur (HR) — absensi/index.html viewAtur, :1643-1691. Two sections in one
  panel: Titik Kerja (locations) and Aturan (the settings blob). The old screen
  drew a Leaflet map; K-03 chose "no map", so a location is set by typing or
  pasting coordinates and checking the point on Google Maps in a new tab.
  Saving a radius stores what was typed — the SERVER clamps it to 30–2000 m.
-->
<script setup lang="ts">
import type { AbsensiLokasi, AbsensiSetting } from '~/composables/useAbsensi'
import {
  absensiSettingDefault, deleteLocation, saveLocation, saveSettings,
  useAbsensiHr, useAbsensiLocations, useAbsensiSettings,
} from '~/composables/useAbsensi'
import { bacaKoordinat, isKoordinat, tautanMaps, teksKoordinat } from '~/utils/absensi'

definePageMeta({ access: ['absensi'] })

const hr = useAbsensiHr()
const toast = useToast()

const { data: lokasi, status: statusLokasi, error: errLokasi, refresh: refreshLokasi } = useAbsensiLocations()
const { data: setting, status: statusSetting, error: errSetting, refresh: refreshSetting } = useAbsensiSettings()

const sibuk = ref(false)

// --- Titik kerja ------------------------------------------------------------

const sheetLok = ref(false)
const hapusSheet = ref(false)
const hapusId = ref('')
const hapusNama = ref('')
const tempel = ref('')
const galatTempel = ref('')

/** Coordinates are kept as typed strings so an empty field never becomes 0,0. */
const lokForm = reactive({ id: '', nama: '', lat: '', lng: '', radius: 120, aktif: 1 as 0 | 1 })

function bukaLokasi(l?: AbsensiLokasi) {
  Object.assign(lokForm, l
    ? { id: l.id, nama: l.nama, lat: String(l.lat), lng: String(l.lng), radius: l.radius, aktif: l.aktif }
    : { id: '', nama: '', lat: '', lng: '', radius: 120, aktif: 1 })
  tempel.value = ''
  galatTempel.value = ''
  sheetLok.value = true
}

const latN = computed(() => Number(lokForm.lat))
const lngN = computed(() => Number(lokForm.lng))
const adaKoord = computed(() => lokForm.lat.trim() !== '' && lokForm.lng.trim() !== ''
  && Number.isFinite(latN.value) && Number.isFinite(lngN.value))
const koordTeks = computed(() => (adaKoord.value ? teksKoordinat(latN.value, lngN.value) : ''))
const tautanLok = computed(() => (adaKoord.value ? tautanMaps(latN.value, lngN.value) : ''))

function bacaTempel() {
  const r = bacaKoordinat(tempel.value)
  if (!r) {
    galatTempel.value = 'Isi dulu koordinat atau tautannya.'
    return
  }
  if (!isKoordinat(r)) {
    galatTempel.value = r.galat
    return
  }
  lokForm.lat = String(r.lat)
  lokForm.lng = String(r.lng)
  galatTempel.value = ''
  toast.add({ title: 'Koordinat terbaca.', color: 'success' })
}

async function muatUlangLokasi() {
  await refreshLokasi()
}

async function simpanLokasi() {
  const nama = lokForm.nama.trim()
  if (!nama) {
    toast.add({ title: 'Nama titik kerja diisi dulu.', color: 'error' })
    return
  }
  if (lokForm.lat.trim() === '' || lokForm.lng.trim() === '' || !Number.isFinite(latN.value) || !Number.isFinite(lngN.value)) {
    toast.add({ title: 'Koordinatnya masih kosong. Tempel dari Google Maps atau ketik dua angka.', color: 'error' })
    return
  }
  if (latN.value < -90 || latN.value > 90) {
    toast.add({ title: 'Lintang harus antara -90 dan 90. Mungkin urutannya tertukar?', color: 'error' })
    return
  }
  if (lngN.value < -180 || lngN.value > 180) {
    toast.add({ title: 'Bujur harus antara -180 dan 180.', color: 'error' })
    return
  }
  if (latN.value === 0 && lngN.value === 0) {
    toast.add({ title: 'Koordinat 0,0 bukan titik di Bumi yang dimaksud. Isi yang benar.', color: 'error' })
    return
  }

  sibuk.value = true
  try {
    await saveLocation({
      id: lokForm.id || undefined,
      nama,
      lat: latN.value,
      lng: lngN.value,
      radius: Number(lokForm.radius) || 120,
      aktif: lokForm.aktif,
    })
    await muatUlangLokasi()
    sheetLok.value = false
    toast.add({ title: 'Titik kerja tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangLokasi))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function tanyaHapus(id: string, nama: string) {
  hapusId.value = id
  hapusNama.value = nama
  hapusSheet.value = true
}

async function hapusLokasi() {
  hapusSheet.value = false
  sibuk.value = true
  try {
    await deleteLocation(hapusId.value)
    await refreshLokasi()
    sheetLok.value = false
    toast.add({ title: 'Titik kerja dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshLokasi))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// --- Aturan -----------------------------------------------------------------

const atur = reactive<AbsensiSetting>(absensiSettingDefault())
watch(setting, (v) => {
  if (v) Object.assign(atur, v)
}, { immediate: true })

async function muatUlangAturan() {
  await refreshSetting()
  // The watch above refills the form from the reloaded blob.
}

async function simpanAturan() {
  const data: AbsensiSetting = {
    toleransiTelat: Number(atur.toleransiTelat) || 0,
    lemburMinMenit: Number(atur.lemburMinMenit) || 0,
    awalMenit: Number(atur.awalMenit) || 0,
    akhirMenit: Number(atur.akhirMenit) || 0,
    wajahAmbang: Number(atur.wajahAmbang) || 0.45,
    wajahWajib: !!atur.wajahWajib,
    tanpaShiftBoleh: !!atur.tanpaShiftBoleh,
    // The HR list is owned elsewhere; never drop it on a settings save.
    hr: Array.isArray(setting.value?.hr) ? setting.value.hr : [],
  }
  sibuk.value = true
  try {
    await saveSettings(data)
    await muatUlangAturan()
    toast.add({ title: 'Aturan tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangAturan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Atur"
    description="Titik kerja & aturan absensi. Absen di dalam radius salah satu titik langsung sah; di luar semuanya masuk antrean pengajuan."
  >
    <p
      v-if="!hr"
      class="text-muted"
    >
      Tidak ada akses.
    </p>

    <template v-else>
      <p
        v-if="errLokasi || errSetting"
        class="mb-4 text-error"
        role="alert"
      >
        {{ apiErrorMessage(errLokasi ?? errSetting) }}
      </p>

      <AppPanel>
        <div class="grid gap-x-4 lg:grid-cols-2">
          <AppSectionTitle
            title="Titik kerja"
            icon="i-lucide-map-pin"
          />

          <div class="col-span-full">
            <div
              v-if="statusLokasi === 'pending' && !lokasi?.length"
              class="rounded-panel border border-default px-4 py-6 text-center text-muted"
            >
              Memuat titik kerja…
            </div>
            <div
              v-else-if="lokasi?.length"
              class="divide-y divide-default rounded-panel border border-default"
            >
              <div
                v-for="l in lokasi"
                :key="l.id"
                class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3"
              >
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-highlighted">
                    {{ l.nama }}
                    <AppStatus
                      v-if="!l.aktif"
                      size="sm"
                      color="neutral"
                    >
                      Nonaktif
                    </AppStatus>
                  </p>
                  <p class="text-sm text-muted num">
                    {{ teksKoordinat(l.lat, l.lng) }} · Radius {{ l.radius }} m
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <UButton
                    :to="tautanMaps(l.lat, l.lng)"
                    target="_blank"
                    rel="noopener"
                    label="Google Maps"
                    icon="i-lucide-map-pin"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                  />
                  <UButton
                    label="Ubah"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    @click="bukaLokasi(l)"
                  />
                </div>
              </div>
            </div>
            <p
              v-else
              class="rounded-panel border border-dashed border-default px-4 py-6 text-center text-muted"
            >
              Belum ada titik kerja. Selama kosong, semua absen dianggap di dalam area.
            </p>

            <div class="mt-3">
              <UButton
                label="Tambah titik kerja"
                icon="i-lucide-plus"
                @click="bukaLokasi()"
              />
            </div>
          </div>

          <AppSectionTitle
            title="Aturan"
            icon="i-lucide-sliders-horizontal"
          />

          <UFormField label="Toleransi telat">
            <UInput
              v-model.number="atur.toleransiTelat"
              type="number"
              min="0"
              max="60"
              class="w-full"
            >
              <template #trailing>
                <span class="text-xs text-muted">menit</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField label="Lembur diabaikan di bawah">
            <UInput
              v-model.number="atur.lemburMinMenit"
              type="number"
              min="0"
              max="120"
              class="w-full"
            >
              <template #trailing>
                <span class="text-xs text-muted">menit</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField label="Boleh absen sebelum shift">
            <UInput
              v-model.number="atur.awalMenit"
              type="number"
              min="0"
              max="360"
              class="w-full"
            >
              <template #trailing>
                <span class="text-xs text-muted">menit</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField label="…dan sesudah shift">
            <UInput
              v-model.number="atur.akhirMenit"
              type="number"
              min="0"
              max="720"
              class="w-full"
            >
              <template #trailing>
                <span class="text-xs text-muted">menit</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField
            label="Ambang kemiripan wajah"
            help="Makin kecil makin ketat."
          >
            <UInput
              v-model.number="atur.wajahAmbang"
              type="number"
              step="0.01"
              min="0.2"
              max="0.8"
              class="w-full"
            />
          </UFormField>

          <USwitch
            v-model="atur.wajahWajib"
            class="col-span-full"
            label="Wajah wajib cocok"
            description="Nyalakan setelah semua kru mendaftarkan wajah. Kalau dinyalakan lebih awal, yang belum terdaftar tidak bisa absen sama sekali."
          />
          <USwitch
            v-model="atur.tanpaShiftBoleh"
            class="col-span-full"
            label="Boleh absen tanpa jadwal shift"
            description="Kalau mati, absen tanpa jadwal selalu masuk antrean pengajuan."
          />

          <div class="col-span-full mt-1">
            <UButton
              label="Simpan Aturan"
              :loading="sibuk"
              :disabled="statusSetting === 'pending'"
              @click="simpanAturan"
            />
          </div>
        </div>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="sheetLok"
      :title="lokForm.id ? 'Ubah titik kerja' : 'Tambah titik kerja'"
      description="Titik ditandai dengan koordinat; periksa lewat Google Maps."
    >
      <div class="space-y-4">
        <UFormField
          label="Nama titik"
          required
        >
          <UInput
            v-model="lokForm.nama"
            placeholder="Kantor / Outlet Sudirman"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Lintang (lat)">
            <UInput
              v-model="lokForm.lat"
              type="number"
              step="0.000001"
              placeholder="-0.5071"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Bujur (lng)">
            <UInput
              v-model="lokForm.lng"
              type="number"
              step="0.000001"
              placeholder="101.4478"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="Tempel koordinat / tautan Google Maps"
          :error="galatTempel || undefined"
        >
          <UTextarea
            v-model="tempel"
            :rows="2"
            placeholder="-0.507100, 101.447800"
            class="w-full"
          />
        </UFormField>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            label="Baca koordinat"
            icon="i-lucide-clipboard-paste"
            color="neutral"
            variant="soft"
            @click="bacaTempel"
          />
          <UButton
            v-if="tautanLok"
            :to="tautanLok"
            target="_blank"
            rel="noopener"
            label="Buka di Google Maps"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
          />
        </div>
        <p
          v-if="koordTeks"
          class="text-sm text-muted num"
        >
          Koordinat: {{ koordTeks }}
        </p>
        <p
          v-else
          class="text-sm text-dimmed"
        >
          Koordinat belum diisi.
        </p>

        <UFormField label="Radius">
          <UInput
            v-model.number="lokForm.radius"
            type="number"
            min="30"
            max="2000"
            size="xl"
            class="w-full"
          >
            <template #trailing>
              <span class="text-xs text-muted">meter</span>
            </template>
          </UInput>
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="r in [80, 120, 200, 400]"
            :key="r"
            :label="`${r} m`"
            color="neutral"
            variant="soft"
            size="sm"
            @click="lokForm.radius = r"
          />
        </div>
        <p class="text-xs text-muted">
          Di bawah 30 m tidak diterima: akurasi GPS di dalam bangunan jarang lebih baik dari itu,
          dan kru yang berdiri di dalam kantor akan dinyatakan di luar area. Server menjepit 30–2000 m.
        </p>

        <UFormField label="Status titik">
          <AppPilihan
            v-model="lokForm.aktif"
            name="lokasi-aktif"
            :options="[{ value: 1, label: 'Aktif' }, { value: 0, label: 'Nonaktif' }]"
          />
        </UFormField>

        <UButton
          v-if="lokForm.id"
          label="Hapus titik ini"
          color="error"
          variant="soft"
          class="w-full justify-center"
          @click="tanyaHapus(lokForm.id, lokForm.nama)"
        />
      </div>

      <template #footer>
        <UButton
          label="Simpan Titik Kerja"
          size="xl"
          :loading="sibuk"
          @click="simpanLokasi"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetLok = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSheet"
      title="Hapus titik kerja?"
      :description="hapusNama"
    >
      <p class="text-sm text-muted">
        Hapus titik kerja ini? Absen di sana akan mulai masuk antrean pengajuan.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapusLokasi"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
