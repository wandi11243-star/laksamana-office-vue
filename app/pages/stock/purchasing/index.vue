<!--
  /stock/purchasing lands on Monitor Order, the panel's first tab
  (`purchasing/index.html:161-162,283-285`).
-->
<script setup lang="ts">
definePageMeta({ access: ['purchasing'] })
await navigateTo('/stock/purchasing/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
