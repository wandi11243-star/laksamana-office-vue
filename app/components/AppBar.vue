<!--
  One bar of the old analytics lists (.bar-item): the label and value above, a
  rounded track with the fill below. Solid fills (no gradient); the tone names
  the series, and the label always carries the number.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  /** 0–100 */
  persen: number
  tone?: 'gold' | 'success' | 'error' | 'info' | 'vip'
}>(), { tone: 'gold' })

const fill = {
  gold: 'bg-gold',
  success: 'bg-success',
  error: 'bg-error',
  info: 'bg-info',
  vip: 'bg-vip',
}
const lebar = computed(() => `${Math.max(0, Math.min(100, props.persen))}%`)
</script>

<template>
  <div class="mb-4">
    <div class="mb-2 flex items-baseline justify-between gap-3 text-sm">
      <span class="min-w-0 truncate text-default">{{ label }}</span>
      <b class="shrink-0 font-semibold text-gold-deep num">{{ value }}</b>
    </div>
    <div class="h-2.5 overflow-hidden rounded-full bg-muted">
      <div
        class="h-full rounded-full transition-[width] duration-500 ease-out"
        :class="fill[tone]"
        :style="{ width: lebar }"
      />
    </div>
  </div>
</template>
