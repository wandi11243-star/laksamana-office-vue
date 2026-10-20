<!-- Home widget: deposits waiting for verification. Read-only. -->
<script setup lang="ts">
import { dpsOf } from '~/utils/dp-reservasi'
import { angka, rupiah } from '~/utils/format'

const { data, status } = useReservasiHariIni()

const belum = computed(() => (data.value ?? []).flatMap(r => dpsOf(r).map(p => ({ r, p }))).filter(x => !x.p.tfStatus))
const nominal = computed(() => belum.value.reduce((a, x) => a + (Number(x.p.tfAmount) > 0 ? Number(x.p.tfAmount) : (Number(x.p.amount) || 0)), 0))
</script>

<template>
  <AppList
    title="DP perlu diverifikasi"
    :action="{ label: 'Dana masuk', to: '/reservasi/finance' }"
  >
    <USkeleton
      v-if="status === 'pending'"
      class="m-4 h-6 w-40"
    />
    <template v-else>
      <AppListRow
        title="Menunggu cek kasir"
        :description="nominal ? rupiah(nominal) : 'semua sudah dicek'"
        icon="i-lucide-banknote"
      >
        <template #trailing>
          {{ angka(belum.length) }} transfer
        </template>
      </AppListRow>
    </template>
  </AppList>
</template>
