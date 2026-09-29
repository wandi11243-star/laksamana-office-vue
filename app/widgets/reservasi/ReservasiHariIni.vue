<!-- Home widget: today's reservations. Read-only. -->
<script setup lang="ts">
import { listReservations } from '~/composables/useReservasi'
import { angka, hariIni } from '~/utils/format'

const hari = hariIni()
const { data, status } = useAsyncData(
  'widget-reservasi-hari-ini',
  () => listReservations(hari, hari).then(r => r.data),
  { default: () => [] },
)

const datang = computed(() => (data.value ?? []).filter(r => r.status === 'Datang').length)
const dipesan = computed(() => (data.value ?? []).filter(r => !['Cancelled', 'No-show'].includes(r.status)).length)
</script>

<template>
  <AppList
    title="Reservasi hari ini"
    :action="{ label: 'Dashboard', to: '/reservasi/dashboard' }"
  >
    <USkeleton
      v-if="status === 'pending'"
      class="m-4 h-6 w-40"
    />
    <template v-else>
      <AppListRow
        title="Tamu datang"
        :description="`${angka(dipesan)} reservasi berlaku`"
        icon="i-lucide-calendar-check"
      >
        <template #trailing>
          {{ angka(datang) }}
        </template>
      </AppListRow>
    </template>
  </AppList>
</template>
