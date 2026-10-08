<!--
  The Event panel opens on its Dashboard, like the old Office (`#/dashboard` is
  the empty-hash route, `router :2114`). The screen menu is the sidebar now
  (utils/modul-shell.ts). `ideas` and `history` are tabs of Perencanaan, not
  menu items, but their routes stay (`:2036`).
-->
<script setup lang="ts">
definePageMeta({ access: ['event'] })

await navigateTo('/event/dashboard', { replace: true })
</script>

<template>
  <div />
</template>
