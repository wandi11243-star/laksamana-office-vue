<!--
  One KPI card (DESIGN.md, the WattVision overview cards): a white card with
  no outline and a soft shadow. Top row: a tinted icon tile on the left and an
  optional trend badge on the right (`badge`, coloured by `badgeTone`); then
  the label, the number in the display face with its unit (`satuan`), and one
  line of context. Sit several in <AppStatGrid>. The tone names what the
  number means: gold = neutral count, success = good, warning = needs a look,
  error = act now, info = capacity / people, vip = special guests. It colours
  only the icon tile; the number stays text-highlighted.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  icon?: string
  /** Small text after the number, e.g. "/ 32" or "pax". */
  satuan?: string
  sub?: string
  tone?: 'gold' | 'success' | 'warning' | 'error' | 'info' | 'vip'
  /** Short tag at the top right, e.g. "4,2%" or "Stabil". */
  badge?: string
  badgeTone?: 'success' | 'error' | 'neutral'
  badgeIcon?: string
  /** Let a long multi-unit value (stock totals) wrap instead of being clipped. */
  wrap?: boolean
}>(), { tone: 'gold', badgeTone: 'neutral' })

const teks = computed(() => String(props.value))
/** A name (a promo, a menu, a talent), not a figure: it wraps to two lines. */
const berupaNama = computed(() => teks.value.length > 14 && /[A-Za-z]{3,}/.test(teks.value))
/**
 * A figure stays on one line: it steps down a size when long, and shrinks
 * further when the card itself is narrow (`cqi` = the card's inner width), so
 * nothing ever leaves the card (owner request, Nov 2026).
 */
const ukuranAngka = computed(() => {
  const n = teks.value.length
  return n > 11 ? 1.25 : n > 7 ? 1.5 : 2
})
const gaya = computed(() => {
  if (berupaNama.value) return { fontSize: '1.0625rem' }
  if (props.wrap) return { fontSize: `${ukuranAngka.value}rem` }
  const huruf = teks.value.length + (props.satuan ? props.satuan.length * 0.6 + 1 : 0)
  return { fontSize: `min(${ukuranAngka.value}rem, ${(100 / (Math.max(huruf, 1) * 0.62)).toFixed(1)}cqi)` }
})

const ubin = {
  gold: 'bg-gold-soft text-gold-deep',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
  vip: 'bg-vip/10 text-vip',
}
const tag = {
  success: 'bg-success/10 text-success',
  error: 'bg-error/10 text-error',
  neutral: 'bg-muted text-muted',
}
</script>

<template>
  <div class="@container min-w-0 rounded-panel bg-default p-5 shadow-panel">
    <div
      v-if="icon || badge"
      class="mb-4 flex items-start justify-between gap-2"
    >
      <span
        v-if="icon"
        class="grid size-10 shrink-0 place-items-center rounded-lg"
        :class="ubin[tone]"
      >
        <UIcon
          :name="icon"
          class="size-5"
        />
      </span>
      <span
        v-if="badge"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
        :class="tag[badgeTone]"
      >
        <UIcon
          v-if="badgeIcon"
          :name="badgeIcon"
          class="size-3.5"
        />{{ badge }}
      </span>
    </div>
    <p class="text-sm font-medium leading-snug text-muted">
      {{ label }}
    </p>
    <p
      class="mt-1 font-display font-extrabold leading-tight tracking-tight text-highlighted num"
      :class="berupaNama ? 'line-clamp-2 break-words' : wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'"
      :style="gaya"
      :title="berupaNama ? teks : undefined"
    >
      {{ value }}<span
        v-if="satuan"
        class="ms-1.5 font-sans text-sm font-medium tracking-normal text-muted"
      >{{ satuan }}</span>
    </p>
    <p
      v-if="sub || $slots.default"
      class="mt-1 text-[13px] text-muted"
    >
      <slot>{{ sub }}</slot>
    </p>
  </div>
</template>
