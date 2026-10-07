<!-- Finance › Omset › Report Daily — the panel is SHARED with Cashier (both
     write one `reports[date]` object; the old Office had two copies, doc F.19).
     The component lives in app/components/KompasReport.vue. -->
<script setup lang="ts">
definePageMeta({ access: ['kompas'] })
</script>

<template>
  <KompasReport kunci="omset-report" />
</template>
