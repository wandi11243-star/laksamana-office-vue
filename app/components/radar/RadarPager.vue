<!--
  The one pager of Radar (pager): 20 per page, "Menampilkan 21–40 dari 57".
  The page is clamped by the caller's list length, so a list that shrinks on
  the silent refresh never leaves an empty page behind.
-->
<script setup lang="ts">
const props = defineProps<{ total: number, satuan?: string }>()
const hal = defineModel<number>({ default: 1 })
const PER = 20
const maks = computed(() => Math.max(1, Math.ceil(props.total / PER)))
watch(maks, (m) => {
  if (hal.value > m) hal.value = m
})
</script>

<template>
  <div
    v-if="total > PER"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-3 text-sm text-muted"
  >
    <span class="num">Menampilkan {{ (hal - 1) * PER + 1 }}–{{ Math.min(total, hal * PER) }} dari {{ total }} {{ satuan || 'baris' }}</span>
    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        size="sm"
        class="min-h-11 min-w-11 justify-center"
        aria-label="Halaman sebelumnya"
        :disabled="hal <= 1"
        @click="hal--"
      />
      <span class="num">Hal {{ hal }} / {{ maks }}</span>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        size="sm"
        class="min-h-11 min-w-11 justify-center"
        aria-label="Halaman berikutnya"
        :disabled="hal >= maks"
        @click="hal++"
      />
    </div>
  </div>
</template>
