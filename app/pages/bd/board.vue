<!--
  Old address redirect: Board left the menu (deploy/bd/index.html ALAMAT_LAMA),
  replaced by Projects. The file stays so a bookmarked /bd/board lands on
  Projects instead of a 404.
-->
<script setup lang="ts">
definePageMeta({ access: ['bd'] })

await navigateTo('/bd/projects', { replace: true })
</script>

<template>
  <div />
</template>
