<script setup lang="ts">
definePageMeta({ access: ['reservasi'] })
</script>

<template>
  <AppPage title="Cek panel">
    <DanaMasukPanel :boleh-verifikasi="true" :boleh-hapus="true" :boleh-hapus-demo="true" :boleh-kwitansi-langsung="true" />
  </AppPage>
</template>
