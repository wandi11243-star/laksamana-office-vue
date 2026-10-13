<!--
  Konten › Design Queue (old VIEWS.design → prodQueue('design'), deploy/konten/index.html:3314-3320;
  konten.md D.6). The queue itself is KontenAntrian.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten'] })
const { data: st, error } = useStateKonten()
</script>

<template>
  <KontenGerbang lihat="design">
    <AppPage
      title="Design Queue"
      description="Antrian desain - konten yang ditandai butuh desain. Tandai selesai bila sudah dikerjakan."
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <KontenBrandBar :brands="st.brands" />
      <KontenAntrian kind="design" />
    </AppPage>
  </KontenGerbang>
</template>
