<!--
  Status as the old Office drew it: a small tag tinted 10% in the status colour,
  an icon and the word (Pending, Confirmed, Datang, Belum, Lunas …). The word is
  always there, so colour is never the only signal.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'success' | 'warning' | 'error' | 'info' | 'vip' | 'neutral' | 'gold'
  icon?: string
  /** lg: the headline status of a detail sheet, readable at a glance. */
  size?: 'sm' | 'md' | 'lg'
}>(), { color: 'neutral', size: 'md' })

const tone = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
  vip: 'bg-vip/10 text-vip',
  gold: 'bg-gold-soft text-gold-deep',
  neutral: 'bg-muted text-ink-900',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-md font-semibold"
    :class="[tone[color], { sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-1 text-xs', lg: 'px-3 py-1.5 text-base font-bold ring-1 ring-inset ring-current/30' }[size]]"
  >
    <UIcon
      v-if="icon"
      :name="icon"
      :class="{ sm: 'size-3', md: 'size-3.5', lg: 'size-4.5' }[size]"
    />
    <slot />
  </span>
</template>
