<!--
  A deadline as the old Panel drew it (deadlineHTML, deploy/konten/index.html:1308-1318):
  always the FINAL date; past and not done = red, never the word "telat".
  "Hari ini / Besok / H-3" only while the date has not passed.
-->
<script setup lang="ts">
import { fTglP } from '~/utils/format'
import { lewatTenggat, relHariKonten } from '~/utils/konten'

const props = defineProps<{ tgl?: string, selesai?: boolean, kosong?: string }>()
const lewat = computed(() => lewatTenggat(props.tgl, props.selesai))
const rel = computed(() => relHariKonten(props.tgl))
</script>

<template>
  <span
    v-if="!tgl"
    class="text-xs text-dimmed"
  >{{ kosong ?? '-' }}</span>
  <span
    v-else
    class="inline-flex flex-col leading-tight"
  >
    <span
      class="num text-xs"
      :class="lewat ? 'font-bold text-error' : 'text-default'"
      :title="lewat ? 'Lewat deadline' : undefined"
    >{{ fTglP(tgl) }}</span>
    <span
      v-if="rel"
      class="text-[10.5px] text-muted"
    >{{ rel }}</span>
  </span>
</template>
