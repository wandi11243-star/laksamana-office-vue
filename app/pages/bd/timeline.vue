<!--
  Old address redirect (12 Okt 2026): Timeline left the menu, it lives as a
  view inside Projects (deploy/bd/index.html ALAMAT_LAMA). The file stays so a
  bookmarked /bd/timeline lands on Projects instead of a 404.
-->
<script setup lang="ts">
definePageMeta({ access: ['bd'] })

await navigateTo('/bd/projects', { replace: true })
</script>

<template>
  <div />
</template>
