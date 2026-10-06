<!--
  Cashier › Dana Masuk (DP). The old page was an <iframe> of the Reservasi
  module (`deploy/cashier/index.html:3906-3947`); here the SAME panel is mounted
  (T-12, U5) instead of a copy. The old embed forced the role to `cashier`,
  i.e. Dana Masuk = Boleh Ubah: verify and reject, never delete and never the
  manager's direct receipt (G-14 has no DELETE for this door anyway).
-->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })
</script>

<template>
  <AppPage
    title="Dana masuk (DP)"
    description="Uang DP reservasi yang sudah masuk — dibaca dari modul Reservasi."
  >
    <DanaMasukPanel boleh-verifikasi />
  </AppPage>
</template>
