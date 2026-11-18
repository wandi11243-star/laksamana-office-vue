<!--
  The shared period control (kendaliPeriode): Harian | Mingguan | Bulanan plus
  the Ordering date field (AppTanggal + Hari ini / Besok / Lusa) for a day or
  week, the browser's month picker for a month. Radar, Event and Reservasi ask for
  time the same way. The week is stored as its Monday: any picked date snaps
  to it, and ‹ › move a whole week.
-->
<script setup lang="ts">
import type { Periode } from '~/utils/radar'
import { OPSI_MODE, labelPeriode, seninMinggu } from '~/utils/radar'
import { hariIni, tambahHari } from '~/utils/format'

const p = defineModel<Periode>({ required: true })

const mode = computed({
  get: () => p.value.mode,
  set: (m) => {
    p.value = { ...p.value, mode: m, mgg: m === 'minggu' && !p.value.mgg ? seninMinggu(p.value.tgl) : p.value.mgg }
  },
})
const set = (k: 'tgl' | 'bln', v: string) => {
  if (v) p.value = { ...p.value, [k]: v }
}
const pilihMinggu = (v: string) => {
  if (v) p.value = { ...p.value, mgg: seninMinggu(v) }
}
const pintas = [
  { label: 'Hari ini', value: hariIni() },
  { label: 'Besok', value: tambahHari(hariIni(), 1) },
  { label: 'Lusa', value: tambahHari(hariIni(), 2) },
]
const geserMinggu = (n: number) => {
  p.value = { ...p.value, mgg: tambahHari(p.value.mgg, n) }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <AppSeg
      v-model="mode"
      :options="OPSI_MODE"
      size="sm"
    />
    <!-- Day and week use the Ordering date field: the app's own calendar
         (AppTanggal) plus Hari ini / Besok / Lusa shortcuts for a single day. -->
    <template v-if="p.mode === 'hari'">
      <AppTanggal
        :model-value="p.tgl"
        class="w-full sm:w-64"
        @update:model-value="v => set('tgl', String(v))"
      />
      <AppChips
        :model-value="p.tgl"
        :options="pintas"
        @update:model-value="v => set('tgl', String(v ?? ''))"
      />
    </template>
    <div
      v-else-if="p.mode === 'minggu'"
      class="flex items-center gap-1"
    >
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        size="sm"
        class="min-h-11 min-w-11 justify-center"
        aria-label="Minggu sebelumnya"
        @click="geserMinggu(-7)"
      />
      <AppTanggal
        :model-value="p.mgg"
        class="w-56"
        placeholder="Pilih tanggal mana pun"
        @update:model-value="v => pilihMinggu(String(v))"
      />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        size="sm"
        class="min-h-11 min-w-11 justify-center"
        aria-label="Minggu berikutnya"
        @click="geserMinggu(7)"
      />
    </div>
    <AppBulan
      v-else
      :model-value="p.bln"
      size="sm"
      class="min-h-11 w-40"
      aria-label="Bulan"
      @update:model-value="v => set('bln', String(v))"
    />
    <span class="text-sm text-muted">{{ labelPeriode(p) }}</span>
  </div>
</template>
