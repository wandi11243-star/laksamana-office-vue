<script setup lang="ts">
definePageMeta({
  access: ['event'],
  middleware: [to => navigateTo({
    path: '/event/events',
    query: { ...to.query, tab: 'kanban' },
    hash: to.hash,
  }, { replace: true })],
})
</script>

<template>
  <div />
</template>
