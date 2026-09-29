<!--
  The Reservasi panel opens on its Dashboard, like the old Office: the screen
  menu is the sidebar now (utils/modul-shell.ts), which also loads the in-module
  role matrix. `hariH` and the ghost `review` are not screens: review belongs to
  Service Excellent (T-21).
-->
<script setup lang="ts">
definePageMeta({ access: ['reservasi'] })

await navigateTo('/reservasi/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
