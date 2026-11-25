<!--
  Finance › Kelola Akses — ONE entry for the three panels' access screens
  (Panel Omset roster, Kas Kecil matrix, Brankas matrix). Each tab is the old
  page itself, so every rule and write stays exactly where it was; the person
  only sees the tabs for the panels they hold.
-->
<script setup lang="ts">
import { hasAccess } from '~/composables/useMe'
import AksesOmset from '~/pages/finance/omset/akses.vue'
import AksesKas from '~/pages/finance/kas/akses.vue'
import AksesBrankas from '~/pages/finance/brankas/akses.vue'

definePageMeta({ access: ['kompas', 'finance', 'brankas'] })

const me = useMe()
const semua = [
  { value: 'kas', label: 'Kas Kecil', kunci: 'finance', isi: AksesKas },
  { value: 'brankas', label: 'Brankas', kunci: 'brankas', isi: AksesBrankas },
  { value: 'omset', label: 'Panel Omset', kunci: 'kompas', isi: AksesOmset },
]
const tabs = computed(() => semua.filter(t => hasAccess(me.value, [t.kunci])))
const pilih = ref('')
const aktif = computed(() => tabs.value.find(t => t.value === pilih.value) ?? tabs.value[0])
</script>

<template>
  <AppPage
    title="Kelola akses"
    description="Siapa yang boleh membuka modul Finance, dan halaman mana saja yang boleh diubah."
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
