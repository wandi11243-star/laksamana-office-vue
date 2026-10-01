<!--
  The Howandi Life OS panel opens on its Command Center, like the old Office.
  The screen menu is the sidebar (utils/layar/hlife.ts); until the lead wires it
  into utils/modul-shell.ts, the Command Center also lists the screens.
-->
<script setup lang="ts">
definePageMeta({ access: ['howandi_life'] })

await navigateTo('/hlife/home', { replace: true })
</script>

<template>
  <div />
</template>
