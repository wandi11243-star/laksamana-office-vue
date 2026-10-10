<!--
  Old address redirect (7 Okt 2026): Board & Tasks left the menu, replaced by
  My Task (deploy/bd/index.html ALAMAT_LAMA). The file stays so a bookmarked
  /bd/tasks lands on My Task instead of a 404.
-->
<script setup lang="ts">
definePageMeta({ access: ['bd'] })

await navigateTo('/bd/mytask', { replace: true })
</script>

<template>
  <div />
</template>
