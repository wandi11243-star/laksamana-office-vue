<!--
  The BD OS panel opens on its Dashboard, like the old Office: the screen menu
  is the sidebar now (utils/modul-shell.ts), which also loads the crew list.
-->
<script setup lang="ts">
definePageMeta({ access: ['bd'] })

await navigateTo('/bd/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
