<!-- Cashier › Report Daily. The panel is shared with Finance › Omset — see
     app/components/KompasReport.vue (extracted so the two cannot drift). -->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })
</script>

<template>
  <KompasReport esb-enabled />
</template>
