<!--
  Konten › Shooting Schedule (old VIEWS.shooting → prodQueue('shoot'), deploy/konten/index.html:3314-3320;
  konten.md D.5). The queue itself is KontenAntrian.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten'] })
const { data: st, error } = useStateKonten()
</script>

<template>
  <KontenGerbang lihat="shooting">
    <AppPage
      title="Shooting Schedule"
      description="Jadwal rekam - dari kebutuhan konten & jadwal mandiri. Tandai selesai bila sudah dieksekusi."
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <KontenBrandBar :brands="st.brands" />
      <KontenAntrian kind="shoot" />
    </AppPage>
  </KontenGerbang>
</template>
