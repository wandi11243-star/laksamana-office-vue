<!-- Beranda module card line: today's reservations. Read-only. -->
<script setup lang="ts">
import { listReservations } from '~/composables/useReservasi'
import { angka, hariIni } from '~/utils/format'

const hari = hariIni()
const { data, status } = useAsyncData(
  'kartu-reservasi-hari-ini',
  () => listReservations(hari, hari).then(r => r.data),
  { default: () => [] },
)
const berlaku = computed(() => (data.value ?? []).filter(r => !['Cancelled', 'No-show'].includes(r.status)))
const datang = computed(() => berlaku.value.filter(r => r.status === 'Datang').length)
</script>

<template>
  <USkeleton
    v-if="status === 'pending'"
    class="h-5 w-32"
  />
  <p
    v-else-if="status === 'success'"
    class="text-sm text-muted"
  >
    <span class="font-display text-lg font-bold text-highlighted num">{{ angka(berlaku.length) }}</span>
    reservasi hari ini · {{ angka(datang) }} datang
  </p>
</template>
