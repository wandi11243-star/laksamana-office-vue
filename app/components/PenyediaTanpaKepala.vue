<!-- Makes every AppPage below it skip its title block (used for pages shown as a tab inside another page). -->
<script setup lang="ts">
provide('tanpaKepalaPage', true)
</script>

<template>
  <slot />
</template>
