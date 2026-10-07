<!--
  /stock/usage lands on the first screen of the panel, as the old page opened
  Daily SO (`usage/index.html:1021-1023`). Deep links inside the panel use the
  screen routes directly.
-->
<script setup lang="ts">
definePageMeta({ access: ['usage'] })
await navigateTo('/stock/usage/opname', { replace: true })
</script>

<template>
  <div />
</template>
