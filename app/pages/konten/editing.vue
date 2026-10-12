<!--
  Konten › Editing Queue (old VIEWS.editing → prodQueue('edit'), deploy/konten/index.html:3314-3320;
  konten.md D.7). The queue itself is KontenAntrian.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten'] })
const { data: st, error } = useStateKonten()
</script>

<template>
  <KontenGerbang lihat="editing">
  <AppPage
    title="Editing Queue"
    description="Antrian video - konten yang ditandai butuh editing. Tandai selesai bila video final siap."
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />
    <KontenBrandBar :brands="st.brands" />
    <KontenAntrian kind="edit" />
  </AppPage>
  </KontenGerbang>
</template>
