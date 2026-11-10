<!--
  One stat card of the old recap row (deploy/reservasi/index.html .recap):
  the whole card sits on a soft pastel tint, the label in small capitals
  with its icon, the number, an optional "/ total", and one line of
  context. Sit several in <AppStatGrid>. The tone names what the number
  means, not decoration: gold = neutral count, success = good,
  warning = needs a look, error = act now, info = capacity / people,
  vip = special guests. Every tint pairs with its dark text so the number
  (text-highlighted) and the label (text-muted) stay AA-readable.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  icon?: string
  /** Small text after the number, e.g. "/ 32". */
  satuan?: string
  sub?: string
  tone?: 'gold' | 'success' | 'warning' | 'error' | 'info' | 'vip'
  /** Let a long multi-unit value (stock totals) wrap instead of being clipped. */
  wrap?: boolean
}>(), { tone: 'gold' })

/** Long values (money) step down a size so they stay on one line. */
const ukuran = computed(() => {
  const n = String(props.value).length
  return n > 11 ? 'text-xl' : n > 7 ? 'text-2xl' : 'text-3xl'
})

/** Full-card pastel tint per tone (Miro brand pastels from main.css). */
const latar = {
  gold: 'bg-sand-light',
  success: 'bg-teal-light',
  warning: 'bg-yellow-light',
  error: 'bg-coral-light',
  info: 'bg-sky-light',
  vip: 'bg-lilac-light',
}
const ink = {
  gold: 'text-ink-900',
  success: 'text-moss-dark',
  warning: 'text-yellow-dark',
  error: 'text-coral-dark',
  info: 'text-blue-pressed',
  vip: 'text-vip',
}
</script>

<template>
  <div
    class="rounded-panel border border-default px-5 py-4 shadow-panel"
    :class="latar[tone]"
  >
    <p class="flex items-start gap-1.5 text-xs font-semibold uppercase leading-snug tracking-wide text-muted">
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-4 shrink-0"
        :class="ink[tone]"
      />
      <span>{{ label }}</span>
    </p>
    <p
      class="mt-2 font-display font-bold leading-none text-highlighted num"
      :class="[ukuran, wrap ? 'whitespace-normal' : 'whitespace-nowrap']"
    >
      {{ value }}<span
        v-if="satuan"
        class="ms-1 font-sans text-[14px] font-medium text-muted"
      >{{ satuan }}</span>
    </p>
    <p
      v-if="sub || $slots.default"
      class="mt-1.5 text-[13px] text-muted"
    >
      <slot>{{ sub }}</slot>
    </p>
  </div>
</template>
