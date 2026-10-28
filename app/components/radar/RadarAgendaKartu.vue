<!--
  One agenda card (agendaCard): date block, title, time · place · pax · type,
  then source, F&B format, countdown and status. Reservations never appear on
  an event card: a table booking is not part of the event, and a number that
  sits on the card is read as the event's, whatever its label says.
-->
<script setup lang="ts">
import type { RadarAgenda } from '~/composables/useRadar'
import { IKON_SUMBER, SUMBER_PENDEK, WARNA_SUMBER, dDay, dLabel, dWarna } from '~/utils/radar'
import { BLN, HARI } from '~/utils/format'

const props = defineProps<{ a: RadarAgenda }>()
defineEmits<{ buka: [a: RadarAgenda] }>()

const tgl = computed(() => {
  const [y, m, d] = props.a.tgl.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
})
const n = computed(() => dDay(props.a.tgl))
</script>

<template>
  <button
    type="button"
    class="flex w-full items-start gap-3 rounded-panel border border-default bg-default p-3.5 text-left shadow-panel transition-colors hover:border-yellow-deep focus-visible:outline-2 focus-visible:outline-primary"
    @click="$emit('buka', a)"
  >
    <span class="flex w-14 shrink-0 flex-col items-center rounded-field bg-yellow-light py-1.5 text-yellow-dark">
      <span class="font-display text-xl font-bold leading-none num">{{ tgl.getDate() }}</span>
      <span class="text-[11px] font-semibold uppercase">{{ BLN[tgl.getMonth()] }}</span>
      <span class="text-[11px] text-muted">{{ HARI[tgl.getDay()]!.slice(0, 3) }}</span>
    </span>
    <span class="min-w-0 flex-1">
      <span class="block font-semibold text-highlighted">{{ a.judul }}</span>
      <span class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-muted">
        <span
          v-if="a.jam"
          class="inline-flex items-center gap-1 num"
        ><UIcon
          name="i-lucide-clock"
          class="size-3.5"
        />{{ a.jam }}{{ a.selesai ? `–${a.selesai}` : '' }}</span>
        <span
          v-if="a.tempat"
          class="inline-flex items-center gap-1"
        ><UIcon
          name="i-lucide-map-pin"
          class="size-3.5"
        />{{ a.tempat }}</span>
        <span
          v-if="a.pax"
          class="inline-flex items-center gap-1 num"
        ><UIcon
          name="i-lucide-users"
          class="size-3.5"
        />{{ a.pax }} pax{{ a.sumber === 'mkt' ? ' (kontrak)' : a.sumber === 'vip' ? ' (perkiraan atas)' : '' }}</span>
        <span v-if="a.jenis">{{ a.jenis }}</span>
      </span>
      <span class="mt-2 flex flex-wrap gap-1.5">
        <AppStatus
          :color="WARNA_SUMBER[a.sumber]"
          :icon="IKON_SUMBER[a.sumber]"
          size="sm"
        >{{ SUMBER_PENDEK[a.sumber] }}</AppStatus>
        <!-- The F&B format decides the kitchen's load: its own pill, readable at a glance. -->
        <AppStatus
          v-if="a.fb"
          color="info"
          icon="i-lucide-utensils"
          size="sm"
        >{{ a.fb }}</AppStatus>
        <AppStatus
          :color="dWarna(n)"
          icon="i-lucide-calendar-clock"
          size="sm"
        >{{ dLabel(n) }}</AppStatus>
        <AppStatus
          v-if="a.status"
          size="sm"
        >{{ a.status }}</AppStatus>
      </span>
    </span>
  </button>
</template>
