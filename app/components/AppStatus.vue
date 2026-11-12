<!--
  Status as the old Office drew it: a small tag tinted 10% in the status colour,
  an icon and the word (Pending, Confirmed, Datang, Belum, Lunas …). The word is
  always there, so colour is never the only signal.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'success' | 'warning' | 'error' | 'info' | 'vip' | 'neutral' | 'gold'
  icon?: string
  size?: 'sm' | 'md'
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
    :class="[tone[color], size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs']"
  >
    <UIcon
      v-if="icon"
      :name="icon"
      :class="size === 'sm' ? 'size-3' : 'size-3.5'"
    />
    <slot />
  </span>
</template>
