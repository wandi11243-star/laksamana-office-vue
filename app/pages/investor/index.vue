<!--
  Investor Compass › Laba Rugi (Nov 2026: Ringkasan + Laporan Laba Rugi merged).
  Exactly Analytics › Laba Rugi, nothing added (owner): the shared
  LabaRugiLaporan component. The monthly accounting PDFs were dropped (owner).
  Refresh from ESB is for "Ubah" on this page.
-->
<script setup lang="ts">
import { useInvestorIzin } from '~/composables/useInvestor'

definePageMeta({ access: ['investor'] })

const izin = useInvestorIzin()
const bolehLihat = computed(() => izin.lihat('labarugi'))
const bolehRefresh = computed(() => izin.ubah('labarugi'))
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
        v-if="bolehRefresh"
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="lg"
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
      description="Minta admin investor membuka akses Laba Rugi untukmu di Kelola Akses."
    />
    <template v-else>
      <LabaRugiLaporan
        ref="lap"
        kunci="investor-labarugi"
        :boleh-refresh="bolehRefresh"
      />
    </template>
  </AppPage>
</template>
