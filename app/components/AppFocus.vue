<!--
  The ONE loud block of a screen (DESIGN.md): what this person should do now.
  A small label, a big value, a line of context, and at most one yellow button.
-->
<script setup lang="ts">
defineProps<{
  label: string
  value: string
  hint?: string
}>()
</script>

<template>
  <div class="rounded-2xl bg-default p-4 lg:p-6">
    <p class="text-sm font-semibold text-muted">
      {{ label }}
    </p>
    <p class="mt-1.5 text-3xl font-extrabold tracking-tight text-highlighted num lg:text-4xl">
      {{ value }}
    </p>
    <p
      v-if="hint"
      class="mt-1 text-muted"
    >
      {{ hint }}
    </p>
    <div
      v-if="$slots.default"
      class="mt-4 [&>*]:w-full lg:[&>*]:w-auto"
    >
      <slot />
    </div>
  </div>
</template>
