<!-- Beranda module card line: events running today. Read-only. -->
<script setup lang="ts">
import { angka, hariIni } from '~/utils/format'

const { data, status } = useAsyncData(
  'kartu-event-hari-ini',
  () => eventsOn(hariIni()).then(r => r.data),
  { default: () => [] },
)
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
    <template v-if="data?.length">
      <span class="font-display text-lg font-bold text-highlighted num">{{ angka(data.length) }}</span>
      event hari ini · {{ data[0]!.nama }}
    </template>
    <template v-else>
      Tidak ada event hari ini
    </template>
  </p>
</template>
