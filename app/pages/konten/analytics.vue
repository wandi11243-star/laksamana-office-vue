<!--
  Konten › Performa Konten (old VIEWS.analytics → pkPanelKonten,
  deploy/konten/index.html:4397-4401; konten.md D.12). The panel and every
  formula are shared with the Analytics module (KontenPerformaPanel +
  app/utils/performa-konten.ts); this page only feeds it the posts of the
  chosen brand, like the old pkDataModul().
-->
<script setup lang="ts">
definePageMeta({ access: ['konten'] })

const { data: st, error } = useStateKonten()
const brand = useBrandKonten()
const content = computed(() => saringBrand(st.value.content, brand.value))
</script>

<template>
  <KontenGerbang lihat="analytics">
    <AppPage
      title="Performa Konten"
      description="Reach, Engagement Rate, Virality Index, CTA Click Rate & Content Pillar"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <KontenBrandBar :brands="st.brands" />
      <KontenPerformaPanel :content="content" />
    </AppPage>
  </KontenGerbang>
</template>
