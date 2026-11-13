<!--
  Stock › Ordering › Central Kitchen (old `deploy/stock/ordering/index.html:173-175,344-487`).
  The screen lives in StockGudangOrdering — the same one serves Gudang Bar (gb.vue).
-->
<script setup lang="ts">
definePageMeta({ access: ['ordering'] })
</script>

<template>
  <StockGudangOrdering gudang="ck" />
</template>
