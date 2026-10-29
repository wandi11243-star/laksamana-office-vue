<!-- POS opens on the till, like the old app (order is the first view). -->
<script setup lang="ts">
definePageMeta({ access: ['pos'] })

await navigateTo('/pos/kasir', { replace: true })
</script>

<template>
  <div />
</template>
