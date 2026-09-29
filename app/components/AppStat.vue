<!--
  One stat card of the old recap row (deploy/reservasi/index.html .recap):
  a coloured bar on the left, the label in small capitals with its icon, the
  number, an optional "/ total", and one line of context. Sit several in
  <AppStatGrid>. The tone names what the number means, not decoration:
  gold = neutral count, success = good, warning = needs a look, error = act now,
  info = capacity / people, vip = special guests.
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
}>(), { tone: 'gold' })

/** Long values (money) step down a size so they stay on one line. */
const ukuran = computed(() => {
  const n = String(props.value).length
  return n > 11 ? 'text-xl' : n > 7 ? 'text-2xl' : 'text-3xl'
})

const bar = {
  gold: 'before:bg-primary-400',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  error: 'before:bg-error',
  info: 'before:bg-info',
  vip: 'before:bg-vip',
}
const ink = {
  gold: 'text-primary-700 dark:text-primary-300',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
  vip: 'text-vip',
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-panel border border-default bg-default py-4 pe-4 ps-5 shadow-panel before:absolute before:inset-y-0 before:start-0 before:w-1"
    :class="bar[tone]"
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
      class="mt-2 whitespace-nowrap font-display font-bold leading-none text-highlighted num"
      :class="ukuran"
    >
      {{ value }}<span
        v-if="satuan"
        class="ms-1 font-sans text-[15px] font-medium text-muted"
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
