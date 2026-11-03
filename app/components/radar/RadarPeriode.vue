<!--
  The shared period control (kendaliPeriode): Harian | Mingguan | Bulanan plus
  the browser's own date / month picker. Radar, Event and Reservasi ask for
  time the same way. The week is stored as its Monday: any picked date snaps
  to it, and ‹ › move a whole week.
-->
<script setup lang="ts">
import type { Periode } from '~/utils/radar'
import { OPSI_MODE, labelPeriode, seninMinggu } from '~/utils/radar'
import { tambahHari } from '~/utils/format'

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
    <UInput
      v-if="p.mode === 'hari'"
      :model-value="p.tgl"
      type="date"
      size="sm"
      class="[&_input]:min-h-11"
      aria-label="Tanggal"
      @update:model-value="v => set('tgl', String(v))"
    />
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
      <UInput
        :model-value="p.mgg"
        type="date"
        size="sm"
        class="[&_input]:min-h-11"
        aria-label="Pilih tanggal mana pun, otomatis ke minggunya"
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
    <UInput
      v-else
      :model-value="p.bln"
      type="month"
      size="sm"
      class="[&_input]:min-h-11"
      aria-label="Bulan"
      @update:model-value="v => set('bln', String(v))"
    />
    <span class="text-sm text-muted">{{ labelPeriode(p) }}</span>
  </div>
</template>
