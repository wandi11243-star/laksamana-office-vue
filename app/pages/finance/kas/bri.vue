<!--
  Finance › Kas Kecil › Pencocokan QRIS BRI. The panel is SHARED with Cashier
  (old Office ran one `assets/cocok-bri.js`; docs F.20). The page matrix can
  make it read-only for viewers (`bri`: viewer Lihat, staf/manajemen Ubah).
-->
<script setup lang="ts">
definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
</script>

<template>
  <AppPage
    v-if="!izin.lihat('bri')"
    title="Pencocokan QRIS BRI"
  >
    <UAlert
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
  </AppPage>
  <KompasBri
    v-else
    kunci="kas-bri"
    :boleh-ubah="izin.ubah('bri')"
  />
</template>
