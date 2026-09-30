<!-- A label / value grid row set (kvRow): empty values read "—". -->
<script setup lang="ts">
defineProps<{ rows: [string, string | number | null | undefined][] }>()
</script>

<template>
  <dl class="mb-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
    <div
      v-for="[l, v] in rows"
      :key="l"
      class="min-w-0"
    >
      <dt class="text-[11px] font-bold uppercase tracking-wide text-muted">
        {{ l }}
      </dt>
      <dd class="break-words text-highlighted">
        {{ v === null || v === undefined || v === '' ? '—' : v }}
      </dd>
    </div>
  </dl>
</template>
