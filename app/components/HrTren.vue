<!--
  Compact score sparkline (`sparkline`, deploy/hr/index.html:1437). Colour is
  currentColor so the component never carries a hex (DESIGN.md rule 7); nulls
  simply break the line, and fewer than two points says so.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{ values: (number | null)[], width?: number, height?: number }>(), { width: 120, height: 30 })

const titik = computed(() => {
  const vals = props.values
  const ada = vals.filter((v): v is number => v != null)
  if (ada.length < 2) return null
  const mn = Math.min(...ada) - 2
  const mx = Math.max(...ada) + 2
  const step = props.width / (vals.length - 1)
  return vals.map((v, i) => (v == null
    ? null
    : {
        x: i * step,
        y: props.height - ((v - mn) / (mx - mn || 1)) * props.height,
      }))
})
const d = computed(() => {
  if (!titik.value) return ''
  let out = ''
  let mulai = false
  for (const p of titik.value) {
    if (!p) continue
    out += `${mulai ? ' L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    mulai = true
  }
  return out
})
</script>

<template>
  <span
    v-if="!titik"
    class="text-xs text-muted"
  >data belum cukup</span>
  <svg
    v-else
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="text-primary-600 dark:text-primary-300"
    role="img"
    aria-label="Tren skor"
  >
    <path
      :d="d"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
</template>
