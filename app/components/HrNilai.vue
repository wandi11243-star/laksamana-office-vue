<!--
  One numeric component cell of People Score: the value, or a muted dash when
  the component has no data (the default value is used, not shown).
-->
<script setup lang="ts">
const props = defineProps<{ v: number | null | undefined }>()
const teks = computed(() => (props.v == null ? '—' : String(Math.round(props.v * 10) / 10)))
</script>

<template>
  <span
    class="block text-end num"
    :class="v == null ? 'text-muted' : ''"
  >{{ teks }}</span>
</template>
