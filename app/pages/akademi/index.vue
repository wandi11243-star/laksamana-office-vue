<!--
  Akademi opens on its Beranda, like the old Office: the screen menu becomes the
  module sidebar (utils/modul-shell.ts) once the module is registered there.
-->
<script setup lang="ts">
definePageMeta({ access: ['akademi'] })

await navigateTo('/akademi/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
