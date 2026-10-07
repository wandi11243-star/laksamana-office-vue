<!--
  The Cashier panel opens on its Daily Report, like the old Office: the screen
  menu is the sidebar (utils/modul-shell.ts).
-->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })

await navigateTo('/cashier/report', { replace: true })
</script>

<template>
  <div />
</template>
