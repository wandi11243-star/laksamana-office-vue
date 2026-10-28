<!-- A section inside a long form: ink small capitals over a line (old .section-title). -->
<script setup lang="ts">
defineProps<{ title: string, icon?: string }>()
</script>

<template>
  <h3 class="col-span-full mb-3 mt-6 flex items-center gap-2 border-b border-default pb-1.5 font-sans text-xs font-bold uppercase tracking-wider text-ink-900 first:mt-0">
    <UIcon
      v-if="icon"
      :name="icon"
      class="size-4"
    />
    {{ title }}
  </h3>
</template>
