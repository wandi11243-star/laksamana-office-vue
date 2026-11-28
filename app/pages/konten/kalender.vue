<!--
  Konten › Kalender Posting now lives in the Calendar page (Rencana posting).
  The old address stays as a redirect, keeping its ?tanggal=.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten', 'campaign'] })
const route = useRoute()
await navigateTo({ path: '/konten/calendar', query: { ...route.query, tampil: 'posting' } }, { replace: true })
</script>

<template>
  <div />
</template>
