<!--
  Stock › Ordering › Gudang Bar (old `deploy/stock/ordering/index.html:193-198,2346-2410`,
  10 Oct – 4 Nov 2026): the Central Kitchen screen on the second warehouse.
  Requests skip Check-in (the stock drops at once); history per batch.
-->
<script setup lang="ts">
definePageMeta({ access: ['ordering'] })
</script>

<template>
  <StockGudangOrdering gudang="bar" />
</template>
