<!--
  Quick-choice pills (Hari ini / Besok / Lusa / 7 hari / Bulan ini). The chosen
  one is a canary tint with a deep-yellow edge, like the old .pill.active.
-->
<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { value: T, label: string }[]
}>()
const model = defineModel<T | null>()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1.5"
    role="group"
  >
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      class="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary"
      :class="model === o.value
        ? 'border-yellow-deep bg-yellow-light text-yellow-dark'
        : 'border-default bg-muted text-muted hover:border-accented hover:text-highlighted'"
      :aria-pressed="model === o.value"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
    <slot />
  </div>
</template>
