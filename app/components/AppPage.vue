<!--
  Every page starts with this (DESIGN.md, the WattVision overview head): a big
  display title with one line under it on the left, the page's own buttons on
  the right (#actions) — secondary first, the gold action last.
-->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  back?: { label: string, to: string }
  // A narrower column for launcher-style pages (Beranda) that read better
  // with breathing room left and right on wide screens.
  narrow?: boolean
}>()
</script>

<template>
  <div
    class="mx-auto w-full"
    :class="narrow ? 'max-w-6xl' : 'max-w-[1400px]'"
  >
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
    <header class="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-8">
      <div class="min-w-0">
        <h1 class="text-balance text-2xl font-extrabold text-highlighted lg:text-[2rem] lg:leading-tight">
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-1 text-[15px] text-muted"
        >
          {{ description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2 lg:gap-3"
      >
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>
