<!--
  Analytics › Laba Rugi (was "Pengeluaran & EBITDA"; renamed Nov 2026). The report
  itself is LabaRugiLaporan, shared with Investor Compass › Laba Rugi; this page
  adds the access check and the action bar (Unduh CSV, Refresh).
-->
<script setup lang="ts">
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('pengeluaran'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)
const lap = useTemplateRef('lap')
</script>

<template>
  <AppPage
    title="Laba Rugi"
    description="Omset, dana keluar, EBITDA, dan depresiasi dari laporan Laba Rugi ESB"
  >
    <template #actions>
      <UButton
        label="Unduh CSV"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        size="lg"
        :disabled="!lap?.adaData || !lap?.rentang.length"
        @click="lap?.unduhCsv()"
      />
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="lg"
        :disabled="!bolehLihat"
        :loading="lap?.merefresh"
        @click="lap?.refreshEsb()"
      />
    </template>

    <UAlert
      v-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman &quot;Pengeluaran&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />
    <LabaRugiLaporan
      v-else
      ref="lap"
      kunci="analytics-pengeluaran"
    />
  </AppPage>
</template>
