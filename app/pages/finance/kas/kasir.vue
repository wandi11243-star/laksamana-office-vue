<!--
  Finance › Kas Kecil › Performa Kasir. The panel is SHARED with Cashier (same
  blob, old Office had two copies; D.19). Unlike the cashier screen, everyone
  who may open it sees EVERY name — the cashier's "only yourself" restriction
  did not exist here.
-->
<script setup lang="ts">
definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
</script>

<template>
  <AppPage
    v-if="!izin.lihat('kasir')"
    title="Performa kasir"
  >
    <UAlert
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
  </AppPage>
  <PerformaKasir
    v-else
    kunci="kas-kasir"
    :boleh-semua="true"
  />
</template>
