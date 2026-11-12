<!--
  Grouped list: the main building block (DESIGN.md). White rows on the grey page,
  hairline separators, an optional section title with one action on the right.
    <AppList title="Event minggu ini" :action="{ label: 'Semua', to: '/event' }">
      <AppListRow ... />
    </AppList>
-->
<script setup lang="ts">
defineProps<{
  title?: string
  action?: { label: string, to: string }
}>()
</script>

<template>
  <section class="mb-7">
    <div
      v-if="title || action"
      class="flex items-baseline justify-between px-1 pb-2 text-sm font-semibold text-muted"
    >
      <h2>{{ title }}</h2>
      <ULink
        v-if="action"
        :to="action.to"
        class="text-highlighted underline-offset-4 hover:underline"
      >
        {{ action.label }}
      </ULink>
    </div>
    <div class="divide-y divide-default overflow-hidden rounded-panel bg-default shadow-panel">
      <slot />
    </div>
  </section>
</template>
