<!--
  Finance › Pengaturan — ONE settings entry: the Kas Kecil lists (pos pembayaran
  & kategori belanja) and the Brankas settings (saldo awal, pemetaan metode,
  biaya bulanan). Each tab is the old page itself, so every rule and write
  stays where it was; only the tabs of the panels the person holds show.
-->
<script setup lang="ts">
import { hasAccess } from '~/composables/useMe'
import PengaturanPos from '~/pages/finance/kas/pos.vue'
import PengaturanBrankas from '~/pages/finance/brankas/pengaturan.vue'

definePageMeta({ access: ['finance', 'brankas'] })

const me = useMe()
const semua = [
  { value: 'pos', label: 'Pos & Kategori', kunci: 'finance', isi: PengaturanPos },
  { value: 'brankas', label: 'Brankas', kunci: 'brankas', isi: PengaturanBrankas },
]
const tabs = computed(() => semua.filter(t => hasAccess(me.value, [t.kunci])))
const pilih = ref('')
const aktif = computed(() => tabs.value.find(t => t.value === pilih.value) ?? tabs.value[0])
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Pos & kategori kas kecil, saldo awal, pemetaan metode pembayaran, dan biaya bulanan."
  >
    <div
      v-if="tabs.length > 1"
      class="mb-5"
    >
      <AppSeg
        :model-value="aktif?.value"
        :options="tabs.map(t => ({ value: t.value, label: t.label }))"
        @update:model-value="(v?: string) => { pilih = v ?? '' }"
      />
    </div>
    <PenyediaTanpaKepala v-if="aktif">
      <component
        :is="aktif.isi"
        :key="aktif.value"
      />
    </PenyediaTanpaKepala>
  </AppPage>
</template>
