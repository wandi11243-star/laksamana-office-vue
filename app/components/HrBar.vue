<!--
  One score bar of the old People OS (`barHtml`, deploy/hr/index.html:1432):
  a track, its fill, and the number. The tone follows the same thresholds as
  the grade pill (≥85 success, ≥70 gold, ≥60 warning, else error).
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{ value: number | null, max?: number }>(), { max: 100 })

const persen = computed(() => (props.value == null ? 0 : Math.max(0, Math.min(100, (props.value / props.max) * 100))))
const tone = computed(() => (props.value == null ? 'bg-muted' : props.value >= 85 ? 'bg-success' : props.value >= 70 ? 'bg-primary-400' : props.value >= 60 ? 'bg-warning' : 'bg-error'))
</script>

<template>
  <div class="flex min-w-24 items-center gap-2">
    <div class="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
      <div
        class="h-full rounded-full"
        :class="tone"
        :style="{ width: `${persen}%` }"
      />
    </div>
    <span class="w-10 shrink-0 text-end text-xs font-semibold text-highlighted num">{{ value == null ? '—' : Math.round(value * 10) / 10 }}</span>
  </div>
</template>
