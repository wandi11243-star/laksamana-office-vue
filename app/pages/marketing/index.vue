<!--
  The Marketing module opens on its Dashboard, like the old app: the screen
  menu is the sidebar (utils/modul-shell.ts), which also loads the matrix.
-->
<script setup lang="ts">
definePageMeta({ access: ['marketing'] })

await navigateTo('/marketing/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
