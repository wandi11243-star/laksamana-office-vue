<!--
  The head of the two Talent Schedule tables, in the look of KalenderBulan's
  head: title, legend, and the figure at the right.
-->
<script setup lang="ts">
defineProps<{ judul: string }>()
defineSlots<{ legenda?: () => unknown, total?: () => unknown }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default px-4 py-3 lg:px-5">
    <h2 class="font-display text-lg font-semibold">
      {{ judul }}
    </h2>
    <div class="flex flex-wrap items-center gap-3 text-xs">
      <slot name="legenda" />
    </div>
    <span class="num ml-auto text-sm font-bold text-primary-700"><slot name="total" /></span>
  </div>
</template>
