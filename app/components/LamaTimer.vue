<!--
  A ticking "late by …" label with its own 1-second interval, so the parent
  page can tick at minute resolution (issue #146): only the visible late
  chips re-render every second, not the whole table.
-->
<script setup lang="ts">
const props = defineProps<{ sejak: number }>()

const kini = ref(Date.now())
let t: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  t = setInterval(() => {
    kini.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => clearInterval(t))

const teks = computed(() => {
  const ms = kini.value - props.sejak
  if (!Number.isFinite(ms)) return '—'
  const m = Math.max(0, Math.floor(ms / 60000))
  const d = Math.max(0, Math.floor(ms / 1000) % 60)
  return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}:${String(d).padStart(2, '0')}`
})
</script>

<template>
  <span>{{ teks }}</span>
</template>
