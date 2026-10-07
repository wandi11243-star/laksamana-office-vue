<!--
  The old Jadwal pager: "11–20 dari 32 orang" with ‹ / › (deploy/jadwal
  pagerDash :2620, ajuPagerHTML :4580). Hidden when everything fits one page.
-->
<script setup lang="ts">
const props = defineProps<{
  total: number
  per: number
  satuan: string
}>()
const hal = defineModel<number>({ default: 1 })

const maks = computed(() => Math.max(1, Math.ceil(props.total / props.per)))
const kini = computed(() => Math.min(Math.max(1, hal.value), maks.value))
const a = computed(() => (kini.value - 1) * props.per + 1)
const z = computed(() => Math.min(kini.value * props.per, props.total))
</script>

<template>
  <div
    v-if="maks > 1"
    class="flex items-center justify-between gap-3 border-t border-default px-4 py-2.5 text-sm text-muted lg:px-5"
  >
    <span class="num">{{ a }}–{{ z }} dari {{ total }} {{ satuan }}</span>
    <div class="flex items-center gap-1.5">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="kini <= 1"
        aria-label="Halaman sebelumnya"
        @click="hal = kini - 1"
      />
      <b class="px-1.5 text-highlighted num">{{ kini }} / {{ maks }}</b>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="kini >= maks"
        aria-label="Halaman berikutnya"
        @click="hal = kini + 1"
      />
    </div>
  </div>
</template>
