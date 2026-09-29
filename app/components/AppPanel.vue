<!--
  The old Office panel: a white surface with a line and a soft shadow, a head
  (title, an optional dark count pill, buttons on the right) and a body.
  `flush` drops the body padding, for a table that runs edge to edge.
-->
<script setup lang="ts">
defineProps<{
  title?: string
  icon?: string
  count?: number | string
  description?: string
  flush?: boolean
}>()
</script>

<template>
  <section class="mb-5 overflow-hidden rounded-panel border border-default bg-default shadow-panel">
    <header
      v-if="title || $slots.head || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3.5 lg:px-5"
    >
      <slot name="head">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
            <UIcon
              v-if="icon"
              :name="icon"
              class="size-5 text-primary-600 dark:text-primary-300"
            />
            {{ title }}
            <span
              v-if="count !== undefined"
              class="rounded-full bg-table-head px-2 py-0.5 font-sans text-xs font-bold text-table-head-text num"
            >{{ count }}</span>
          </h2>
          <p
            v-if="description"
            class="mt-0.5 text-sm text-muted"
          >
            {{ description }}
          </p>
        </div>
      </slot>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>
    <div :class="flush ? '' : 'p-4 lg:p-5'">
      <slot />
    </div>
  </section>
</template>
