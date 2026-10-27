<!--
  Status as the old Office drew it: a rounded pill tinted in the status colour,
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
  success: 'bg-teal-light text-moss-dark',
  warning: 'bg-yellow-light text-yellow-dark',
  error: 'bg-coral-light text-coral-dark',
  info: 'bg-accented text-blue-pressed',
  vip: 'bg-lilac-light text-ink-900',
  gold: 'bg-yellow-light text-yellow-dark',
  neutral: 'bg-muted text-ink-900',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold"
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
