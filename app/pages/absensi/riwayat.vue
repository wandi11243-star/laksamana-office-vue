<!--
  Riwayat — the full attendance history (absensi/index.html viewRiwayat,
  :1459-1514). The old 14-day lock is gone (T-06): Dari/Sampai default to
  month-to-date like the old bulanIni(), and the three totals (hari kerja,
  total telat, total lembur) are back.

  Every number is the server's: late/overtime/duration are computed on read
  (absensi.md F.11), so this page only sums what the API already decided. HR
  sees everyone's rows; crew are forced to their own by the API.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AbsensiHari } from '~/composables/useAbsensi'
import { angka, hariIni, tglPendek, tambahHari } from '~/utils/format'
import { durasi } from '~/utils/absensi'
import { lencanaHari } from '~/utils/status-absensi'

definePageMeta({ access: ['absensi'] })

const hr = useAbsensiHr()

const awalBulan = () => `${hariIni().slice(0, 7)}-01`
const dariDraft = ref(awalBulan())
const sampaiDraft = ref(hariIni())
const dari = ref(awalBulan())
const sampai = ref(hariIni())

function tampilkan() {
  dari.value = dariDraft.value || awalBulan()
  sampai.value = sampaiDraft.value || hariIni()
}

const { data: hari, status, error } = useAbsensiRecap(dari, sampai)

/** Newest first, like the old client's sort (`:1483`). */
const rows = computed(() => [...(hari.value ?? [])].sort((a, b) => b.tgl.localeCompare(a.tgl)))

const totHari = computed(() => rows.value.filter(h => h.hitung.lengkap).length)
const totTelat = computed(() => rows.value.reduce((a, h) => a + (h.hitung.telat || 0), 0))
const totLembur = computed(() => rows.value.reduce((a, h) => a + (h.hitung.lembur || 0), 0))

// --- quick ranges: they only fill the same two date fields ------------------

const PILIHAN = [
  { value: 'bulan', label: 'Bulan ini' },
  { value: '7', label: '7 hari' },
  { value: 'hari', label: 'Hari ini' },
]
const pil = computed(() => {
  if (dari.value === awalBulan() && sampai.value === hariIni()) return 'bulan'
  if (dari.value === tambahHari(hariIni(), -6) && sampai.value === hariIni()) return '7'
  if (dari.value === hariIni() && sampai.value === hariIni()) return 'hari'
  return null
})
function pilihPil(v: string | null | undefined) {
  if (v === 'bulan') {
    dariDraft.value = awalBulan()
    sampaiDraft.value = hariIni()
  }
  else if (v === '7') {
    dariDraft.value = tambahHari(hariIni(), -6)
    sampaiDraft.value = hariIni()
  }
  else if (v === 'hari') {
    dariDraft.value = hariIni()
    sampaiDraft.value = hariIni()
  }
  if (v) tampilkan()
}

// --- paging (client-side, like the rest of Office Vue) ----------------------

const hal = ref(1)
const perHal = ref(10)
const maxHal = computed(() => Math.max(1, Math.ceil(rows.value.length / perHal.value)))
const halaman = computed(() => rows.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([rows, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

const kolom = computed<TableColumn<AbsensiHari>[]>(() => [
  { accessorKey: 'tgl', header: 'Tanggal', cell: ({ row }) => tglPendek(row.original.tgl) },
  ...(hr.value ? [{ id: 'nama', header: 'Nama', cell: ({ row }: { row: { original: AbsensiHari } }) => row.original.nama || row.original.uid }] : []),
  { id: 'shift', header: 'Shift', cell: ({ row }) => row.original.shift || '—' },
  { id: 'masuk', header: 'Masuk', cell: ({ row }) => row.original.masuk?.jam ?? '—' },
  { id: 'pulang', header: 'Pulang', cell: ({ row }) => row.original.pulang?.jam ?? '—' },
  { id: 'durasi', header: 'Durasi', cell: ({ row }) => (row.original.hitung.lengkap ? durasi(row.original.hitung.durasi) : '—') },
  { id: 'status', header: 'Status' },
])
</script>

<template>
  <AppPage
    title="Riwayat"
    description="Telat dan lembur dihitung ulang tiap kali dibuka, jadi ikut berubah kalau pengajuanmu baru disetujui."
  >
    <AppPanel title="Periode">
      <AppFilterGrid>
        <UFormField label="Dari">
          <UInput
            v-model="dariDraft"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Sampai">
          <UInput
            v-model="sampaiDraft"
            type="date"
            class="w-full"
          />
        </UFormField>
        <div class="col-span-2 flex items-end">
          <UButton
            label="Tampilkan"
            icon="i-lucide-search"
            class="w-full sm:w-auto"
            @click="tampilkan"
          />
        </div>
      </AppFilterGrid>
      <AppChips
        class="mt-3"
        :options="PILIHAN"
        :model-value="pil"
        @update:model-value="pilihPil"
      />
    </AppPanel>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppStatGrid>
      <AppStat
        label="Hari kerja"
        icon="i-lucide-calendar-check"
        :value="angka(totHari)"
        sub="Hari dengan masuk & pulang"
      />
      <AppStat
        label="Total telat"
        icon="i-lucide-clock-alert"
        :value="durasi(totTelat)"
        :tone="totTelat ? 'error' : 'gold'"
        sub="Setelah toleransi"
      />
      <AppStat
        label="Total lembur"
        icon="i-lucide-timer"
        :value="durasi(totLembur)"
        :tone="totLembur ? 'info' : 'gold'"
        sub="Setelah ambang lembur"
      />
    </AppStatGrid>

    <AppPanel
      title="Riwayat absensi"
      :count="rows.length"
      :description="`${tglPendek(dari)} – ${tglPendek(sampai)}`"
      flush
    >
      <UTable
        class="hidden lg:block"
        :data="halaman"
        :columns="kolom"
        :loading="status === 'pending'"
        empty="Belum ada absensi pada rentang ini."
      >
        <template #status-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <AppStatus
              v-for="l in lencanaHari(row.original)"
              :key="l.label"
              size="sm"
              :color="l.color"
              :icon="l.icon"
            >
              {{ l.label }}
            </AppStatus>
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="h in halaman"
          :key="`${h.uid}-${h.tgl}`"
          class="flex items-start justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ tglPendek(h.tgl) }}<span
                v-if="hr"
                class="text-muted"
              > · {{ h.nama || h.uid }}</span>
            </p>
            <p class="text-sm text-muted num">
              {{ h.masuk?.jam ?? '--:--' }} → {{ h.pulang?.jam ?? '--:--' }}
              · Shift {{ h.shift || '—' }}{{ h.hitung.lengkap ? ` · ${durasi(h.hitung.durasi)}` : '' }}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-1">
            <AppStatus
              v-for="l in lencanaHari(h)"
              :key="l.label"
              size="sm"
              :color="l.color"
              :icon="l.icon"
            >
              {{ l.label }}
            </AppStatus>
          </div>
        </div>
        <p
          v-if="status !== 'pending' && !halaman.length"
          class="px-4 py-6 text-center text-muted"
        >
          Belum ada absensi pada rentang ini.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-3 text-sm text-muted">
        <div class="flex items-center gap-2">
          <span class="num">{{ rows.length ? (hal - 1) * perHal + 1 : 0 }}–{{ Math.min(hal * perHal, rows.length) }} dari {{ rows.length }}</span>
          <USelect
            v-model.number="perHal"
            :items="[{ value: 10, label: '10 / hal' }, { value: 25, label: '25 / hal' }, { value: 50, label: '50 / hal' }]"
            size="sm"
            class="w-28"
          />
        </div>
        <div
          v-if="maxHal > 1"
          class="flex items-center gap-2"
        >
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Halaman sebelumnya"
            :disabled="hal <= 1"
            @click="hal--"
          />
          <span class="num">Hal {{ hal }} / {{ maxHal }}</span>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Halaman berikutnya"
            :disabled="hal >= maxHal"
            @click="hal++"
          />
        </div>
      </div>
    </AppPanel>
  </AppPage>
</template>
