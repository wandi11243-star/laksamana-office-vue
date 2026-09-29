<!--
  Service Excellent panel home — the second panel of the same Backend, under its
  own access key. Its levels are staff / manager / admin, kept in
  master.seCrew + master.sePerms (app/utils/layar/service_excellent.ts).
-->
<script setup lang="ts">
definePageMeta({ access: ['service_excellent'] })

muatPeranSE()
</script>

<template>
  <AppPage
    title="Service Excellent"
    description="Google review, feedback tamu, dan pencapaian tim"
  >
    <ModulMenu :layar="LAYAR_SERVICE_EXCELLENT" />
  </AppPage>
</template>
