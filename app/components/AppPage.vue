<!--
  Every page starts with this, like the old Office's page head: the title and one
  line under it on the left, the page's own buttons on the right (#actions).
-->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  back?: { label: string, to: string }
}>()
</script>

<template>
  <div class="mx-auto w-full max-w-[1400px]">
    <ULink
      v-if="back"
      :to="back.to"
      class="-ms-1 mb-1 inline-flex items-center gap-0.5 py-1 text-sm font-semibold text-muted hover:text-highlighted"
    >
      <UIcon
        name="i-lucide-chevron-left"
        class="size-4"
      />{{ back.label }}
    </ULink>
    <header class="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div class="min-w-0">
        <h1 class="text-balance text-2xl font-bold text-highlighted lg:text-[28px]">
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-1 text-sm text-muted"
        >
          {{ description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>
