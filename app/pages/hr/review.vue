<!--
  HR › Performance Review — reimagine (B): Perlu saya isi / Semua.

  Dulu satu tabel untuk semua kru. Versi ini memisah antrean kerja penilai
  ("Perlu saya isi": kru yang layer saya belum terisi) dari arsip ("Semua").
  Orang yang membuka halaman ini biasanya mau tahu "siapa yang harus saya
  nilai", bukan memindai seluruh tabel. Referensi: pemisahan My Review /
  Team Review di modul performance OmniHR — mental model "diri sendiri"
  vs "orang lain".
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrEmployee, HrReview } from '~/utils/hr'
import { canHr, divName, lapisanReview, scopeEmps } from '~/utils/hr'
import { rataRata, reviewOverallScore } from '~/utils/people-score'
import { useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

interface Baris {
  e: HrEmployee
  rv: HrReview | undefined
  layer: Record<string, number | null>
  akhir: number | null
}

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const mk = useState('hr-review-mk', () => hariIni().slice(0, 7))

const emps = computed(() => scopeEmps(s.value, cu.value, officeAdmin.value).filter(e => e.appRole !== 'ceo'))

const layerAvg = (rv: HrReview | undefined, L: string): number | null => {
  const aspects = rv?.layers?.[L]?.aspects
  if (!aspects) return null
  const vs = Object.values(aspects).map(Number).filter(v => !Number.isNaN(v))
  return vs.length ? rataRata(vs) : null
}

const daftar = computed<Baris[]>(() => emps.value.map((e) => {
  const rv = s.value.reviews.find(r => r.empId === e.id && r.month === mk.value)
  return {
    e,
    rv,
    layer: {
      self: layerAvg(rv, 'self'),
      manager: layerAvg(rv, 'manager'),
      hr: layerAvg(rv, 'hr'),
      ceo: layerAvg(rv, 'ceo'),
    },
    akhir: reviewOverallScore(s.value, e.id, mk.value),
  }
}))

const kolom: TableColumn<Baris>[] = [
  { id: 'kru', header: 'Kru' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'self', header: 'Self' },
  { id: 'manager', header: 'Manager' },
  { id: 'hrd', header: 'HRD' },
  { id: 'ceo', header: 'CEO' },
  { id: 'akhir', header: () => h('span', { class: 'block text-end' }, 'Nilai akhir') },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const tab = ref<'saya' | 'semua'>('saya')
const perluSaya = computed(() => daftar.value.filter((r) => {
  const L = lapisanReview(cu.value, r.e)
  return L != null && r.layer[L] == null
}))
const tampil = computed(() => (tab.value === 'saya' ? perluSaya.value : daftar.value))
const sheetOpen = ref(false)
const pilih = ref<HrEmployee | null>(null)
function buka(e: HrEmployee) {
  pilih.value = e
  sheetOpen.value = true
}
const bobot = computed(() => s.value.settings.reviewLayerWeights)
const nadaLayer = (v: number | null | undefined): 'success' | 'gold' | 'warning' | 'neutral' => (v == null ? 'neutral' : v >= 8.5 ? 'success' : v >= 7 ? 'gold' : 'warning')
async function sesudah() {
  await refresh()
}
const bolehInput = computed(() => canHr('inputKpi', cu.value, officeAdmin.value))
</script>

<template>
  <AppPage
    title="Performance review"
    description="Penilaian berlapis 12 aspek."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <template #head>
        <HrBulan v-model="mk" />
        <AppSeg
          v-model="tab"
          :options="[
            { value: 'saya', label: 'Perlu saya isi', badge: perluSaya.length || undefined },
            { value: 'semua', label: 'Semua' },
          ]"
        />
      </template>

      <p class="mb-3 rounded-field bg-muted px-3 py-2 text-sm text-muted">
        Penilaian 12 aspek (skala 1–10), berlapis: Self ({{ bobot.self }}%) → Manager ({{ bobot.manager }}%) →
        HRD ({{ bobot.hr }}%) → CEO ({{ bobot.ceo }}%). Nilai akhir = rata-rata tertimbang layer yang sudah
        mengisi. Hasil review otomatis mengisi komponen Teamwork & Inisiatif di People Score.
      </p>

      <UTable
        class="hidden lg:block"
        :data="tampil"
        :columns="kolom"
        :empty="tab === 'saya' ? 'Semua penilaian bulan ini sudah terisi.' : 'Belum ada kru dalam jangkauan Anda.'"
      >
        <template #kru-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ row.original.e.name }}
          </p>
        </template>
        <template #divisi-cell="{ row }">
          <span class="text-sm">{{ divName(s, row.original.e.divId) }}</span>
        </template>
        <template #self-cell="{ row }">
          <AppStatus
            v-if="row.original.layer.self != null"
            :color="nadaLayer(row.original.layer.self)"
            size="sm"
          >
            {{ Math.round((row.original.layer.self ?? 0) * 10) / 10 }}
          </AppStatus>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #manager-cell="{ row }">
          <AppStatus
            v-if="row.original.layer.manager != null"
            :color="nadaLayer(row.original.layer.manager)"
            size="sm"
          >
            {{ Math.round((row.original.layer.manager ?? 0) * 10) / 10 }}
          </AppStatus>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #hrd-cell="{ row }">
          <AppStatus
            v-if="row.original.layer.hr != null"
            :color="nadaLayer(row.original.layer.hr)"
            size="sm"
          >
            {{ Math.round((row.original.layer.hr ?? 0) * 10) / 10 }}
          </AppStatus>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #ceo-cell="{ row }">
          <AppStatus
            v-if="row.original.layer.ceo != null"
            :color="nadaLayer(row.original.layer.ceo)"
            size="sm"
          >
            {{ Math.round((row.original.layer.ceo ?? 0) * 10) / 10 }}
          </AppStatus>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #akhir-cell="{ row }">
          <span
            v-if="row.original.akhir != null"
            class="block text-end font-semibold num"
          >{{ Math.round(row.original.akhir * 10) / 10 }}</span>
          <span
            v-else
            class="block text-end text-muted"
          >–</span>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              :label="row.original.rv ? 'Lihat / isi' : 'Mulai'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="buka(row.original.e)"
            />
          </div>
        </template>
      </UTable>

      <div class="space-y-2 lg:hidden">
        <article
          v-for="r in tampil"
          :key="r.e.id"
          class="rounded-field border border-default p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ r.e.name }}
              </p>
              <p class="text-[13px] text-muted">
                {{ divName(s, r.e.divId) }}
              </p>
            </div>
            <div class="shrink-0 text-end">
              <span
                v-if="r.akhir != null"
                class="font-display text-lg font-bold text-highlighted num"
              >{{ Math.round(r.akhir * 10) / 10 }}</span>
              <span
                v-else
                class="text-muted"
              >–</span>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <AppStatus
              v-for="L in ['self', 'manager', 'hr', 'ceo']"
              :key="L"
              :color="nadaLayer(r.layer[L])"
              size="sm"
            >
              {{ L.toUpperCase() }} {{ r.layer[L] == null ? '—' : Math.round((r.layer[L] ?? 0) * 10) / 10 }}
            </AppStatus>
            <UButton
              :label="r.rv ? 'Lihat / isi' : 'Mulai'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="buka(r.e)"
            />
          </div>
        </article>
        <p
          v-if="!tampil.length"
          class="text-sm text-muted"
        >
          {{ tab === 'saya' ? 'Semua penilaian bulan ini sudah terisi.' : 'Belum ada kru dalam jangkauan Anda.' }}
        </p>
      </div>

      <p
        v-if="!bolehInput"
        class="mt-3 text-sm text-muted"
      >
        Anda tetap boleh mengisi review untuk diri sendiri sebagai layer Self.
      </p>
    </AppPanel>

    <HrReviewSheet
      v-model:open="sheetOpen"
      :e="pilih"
      :mk="mk"
      @saved="sesudah"
    />
  </AppPage>
</template>
