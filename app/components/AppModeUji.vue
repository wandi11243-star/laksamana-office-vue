<script setup lang="ts">
// Marks a build that talks to dev-api, so nobody mistakes dev data for the real thing.
// The API base is baked in at build (Dockerfile build-arg), so this never flips at runtime.
// Fixed and pointer-events-none: it never shifts the layout or blocks a tap.
const { apiBase } = useRuntimeConfig().public
const ujiCoba = String(apiBase).includes('//dev-api.')
</script>

<template>
  <div
    v-if="ujiCoba"
    class="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-warning px-3 py-1 text-xs font-semibold text-inverted shadow-md"
    role="status"
  >
    Mode uji · data dev
  </div>
</template>
