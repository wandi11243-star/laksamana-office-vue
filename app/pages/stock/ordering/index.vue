<!--
  /stock/ordering lands on the first screen of the panel, as the old page
  opened the order form (`ordering/index.html`, tab order `:164-166`).
-->
<script setup lang="ts">
definePageMeta({ access: ['ordering'] })
await navigateTo('/stock/ordering/order', { replace: true })
</script>

<template>
  <div />
</template>
