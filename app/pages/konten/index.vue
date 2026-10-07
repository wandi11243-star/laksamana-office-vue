<!--
  The Konten panel opens on its Dashboard, like the old Office: the screen menu
  is the sidebar (utils/modul-shell.ts), which also loads the role matrix.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten'] })

await navigateTo('/konten/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
