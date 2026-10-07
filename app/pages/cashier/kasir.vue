<!-- Cashier › Performa Kasir. The panel is shared with Finance › Kas Kecil —
     see app/components/PerformaKasir.vue. -->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })
</script>

<template>
  <PerformaKasir />
</template>
