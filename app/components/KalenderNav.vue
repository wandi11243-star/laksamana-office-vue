<!--
  ‹ Hari Ini › of a calendar, for the page's `#actions`. `v-model` is the
  month as `YYYY-MM`; with `mode="minggu"` it is the Monday of a week
  (`YYYY-MM-DD`) and the arrows step seven days.
-->
<script setup lang="ts">
import { hariIni } from '~/utils/format'
import { geserBulan, geserTgl } from '~/utils/kalender'
import { seninEms } from '~/utils/event-jadwal'

const props = withDefaults(defineProps<{ mode?: 'bulan' | 'minggu' }>(), { mode: 'bulan' })
const nilai = defineModel<string>({ required: true })

const langkah = (n: number) => {
  nilai.value = props.mode === 'minggu' ? geserTgl(nilai.value, n * 7) : geserBulan(nilai.value, n)
}
const sekarang = () => {
  nilai.value = props.mode === 'minggu' ? seninEms(hariIni()) : hariIni().slice(0, 7)
}
</script>

<template>
  <UButton
    icon="i-lucide-chevron-left"
    color="neutral"
    variant="outline"
    size="sm"
    :aria-label="mode === 'minggu' ? 'Minggu sebelumnya' : 'Bulan sebelumnya'"
    @click="langkah(-1)"
  />
  <UButton
    label="Hari Ini"
    color="neutral"
    variant="outline"
    size="sm"
    @click="sekarang()"
  />
  <UButton
    icon="i-lucide-chevron-right"
    color="neutral"
    variant="outline"
    size="sm"
    :aria-label="mode === 'minggu' ? 'Minggu berikutnya' : 'Bulan berikutnya'"
    @click="langkah(1)"
  />
</template>
