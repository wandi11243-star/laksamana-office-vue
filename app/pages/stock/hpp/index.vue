<!--
  /stock/hpp lands on the Dashboard, the panel's first view
  (`hpp/index.html:212`, JUDUL dash `:832`).
-->
<script setup lang="ts">
definePageMeta({ access: ['hpp'] })
await navigateTo('/stock/hpp/dash', { replace: true })
</script>

<template>
  <div />
</template>
