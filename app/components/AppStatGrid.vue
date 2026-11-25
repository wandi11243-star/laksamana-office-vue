<!-- The KPI row: as many stat cards as fit, at least 170px each.
  While `loading`, skeleton cells with the same card shape stand in for the
  slot, so the page never flashes "0" before the first fetch resolves. -->
<script setup lang="ts">
withDefaults(defineProps<{
  /** Show pulsing skeleton cells instead of the slot (first load). */
  loading?: boolean
  /** How many skeleton cells to render while loading. */
  count?: number
  /**
   * Keep all 6-7 cards on ONE row from 1280px up, with a tighter card, instead
   * of wrapping the last one onto its own line (owner request, Nov 2026).
   * Narrower screens use four per row (two on a phone).
   */
  satuBaris?: boolean
}>(), { loading: false, count: 4, satuBaris: false })
</script>

<template>
  <div
    class="mb-6 grid grid-cols-2 gap-3"
    :class="satuBaris ? 'sm:grid-cols-4 xl:grid-flow-col xl:auto-cols-fr xl:grid-cols-none xl:*:p-4' : 'sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] lg:gap-6'"
  >
    <template v-if="loading">
      <div
        v-for="i in count"
        :key="i"
        role="status"
        aria-label="Memuat statistik"
        class="animate-pulse rounded-panel bg-default p-5 shadow-panel"
      >
        <div class="mb-4 size-10 rounded-lg bg-muted" />
        <div class="h-3 w-24 rounded bg-muted" />
        <div class="mt-2 h-9 w-20 rounded bg-muted" />
        <div class="mt-1.5 h-4 w-32 max-w-full rounded bg-muted" />
      </div>
    </template>
    <slot v-else />
  </div>
</template>
