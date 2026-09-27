<!-- Status = a coloured dot + words. Never a coloured box. (DESIGN.md) -->
<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'success' | 'warning' | 'error' | 'neutral'
}>(), { color: 'neutral' })

const tone = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  neutral: 'text-muted',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold"
    :class="tone[color]"
  >
    <span
      class="size-1.5 rounded-full bg-current"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>
