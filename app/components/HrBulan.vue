<!--
  The old month picker (`monthPicker`, deploy/hr/index.html:1416): ‹ Bulan ›
  plus a "kembali" shortcut when the viewer has wandered off the current
  month. v-model is `YYYY-MM`.
-->
<script setup lang="ts">
import { labelBulanJadwal } from '~/utils/jadwal'
import { hariIni } from '~/utils/format'

const mk = defineModel<string>({ required: true })
const ini = hariIni().slice(0, 7)

function geser(n: number) {
  const p = mk.value.split('-')
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1)
  mk.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <UButton
      icon="i-lucide-chevron-left"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Bulan sebelumnya"
      @click="geser(-1)"
    />
    <b class="min-w-28 text-center text-sm text-highlighted">{{ labelBulanJadwal(mk) }}</b>
    <UButton
      icon="i-lucide-chevron-right"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Bulan berikutnya"
      @click="geser(1)"
    />
    <UButton
      v-if="mk !== ini"
      label="Bulan ini"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="mk = ini"
    />
  </div>
</template>
