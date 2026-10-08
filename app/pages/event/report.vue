<!--
  Report & Analytics — period ribbon, monthly Paid-order turnover (in millions,
  mapped to the event's start month) and the shared aggregates
  (`event/index.html:5605`, `omzetPerBulanEms :4975`).
-->
<script setup lang="ts">
import { useStateEvent } from '~/composables/useEvent'
import { angkaEms, omzetPerBulan } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const { data: state, status, refresh, error } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

const periode = ref<'3' | '6' | '12'>('6')
const grafik = computed(() => omzetPerBulan(Number(periode.value), s.value?.events ?? [], s.value?.orders ?? []))
const maks = computed(() => Math.max(1, ...grafik.value.map(g => g.jt)))
const totalPeriode = computed(() => grafik.value.reduce((a, g) => a + g.jt, 0))

const ringkas = computed(() => angkaEms(s.value?.events ?? [], s.value?.ticketClasses ?? [], s.value?.tickets ?? [], s.value?.orders ?? []))
</script>

<template>
  <AppPage
    title="Report & analytics"
    description="Laporan omzet, tiket & kehadiran"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="status === 'pending'"
        @click="refresh()"
      >
        Muat ulang
      </UButton>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="apiErrorMessage(error)"
      class="mb-4"
    />

    <AppPanel
      title="Omzet per bulan"
      icon="i-lucide-chart-column"
      class="mb-4"
    >
      <template #actions>
        <AppSeg
          v-model="periode"
          :options="[{ value: '3', label: '3 bulan' }, { value: '6', label: '6 bulan' }, { value: '12', label: '12 bulan' }]"
          size="sm"
        />
      </template>
      <p class="mb-3 text-xs text-muted">
        Pesanan lunas saja, dipetakan ke bulan mulai event, dalam juta rupiah. Total periode: <b class="text-highlighted num">Rp {{ angka(totalPeriode) }} jt</b>
      </p>
      <AppBar
        v-for="g in grafik"
        :key="g.label"
        :label="g.label"
        :value="`Rp ${g.jt} jt`"
        :persen="maks ? Math.round(g.jt / maks * 100) : 0"
      />
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Total omzet"
        :value="rupiah(ringkas.omzet)"
        icon="i-lucide-banknote"
        tone="gold"
      />
      <AppStat
        label="Tiket terjual"
        :value="angka(ringkas.terjual)"
        icon="i-lucide-ticket"
        tone="info"
      />
      <AppStat
        label="Kehadiran"
        :value="`${angka(ringkas.hadir)} / ${angka(ringkas.tiket)}`"
        icon="i-lucide-scan-line"
        tone="success"
      />
      <AppStat
        label="Keterisian"
        :value="`${ringkas.hadirPct}%`"
        icon="i-lucide-armchair"
        tone="success"
      />
    </AppStatGrid>
  </AppPage>
</template>
