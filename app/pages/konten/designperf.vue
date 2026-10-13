<!--
  Konten › Performa Desain (old VIEWS.designperf → pkPanelDesain,
  deploy/konten/index.html:4402-4406; konten.md D.13). The panel and every
  formula are shared (KontenDesainPanel + app/utils/performa-konten.ts); this
  page feeds it the posts and stand-alone tasks of the chosen brand.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten'] })

const { data: st, error } = useStateKonten()
const brand = useBrandKonten()
const content = computed(() => saringBrand(st.value.content, brand.value))
const tasks = computed(() => saringBrand(st.value.prodTasks, brand.value))
</script>

<template>
  <KontenGerbang lihat="designperf">
    <AppPage
      title="Performa Desain"
      description="Virality konten berdesain & jumlah desain selesai per kategori"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <KontenBrandBar :brands="st.brands" />
      <KontenDesainPanel
        :content="content"
        :tasks="tasks"
      />
    </AppPage>
  </KontenGerbang>
</template>
