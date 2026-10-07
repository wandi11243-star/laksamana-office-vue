<!--
  The shared pager of the old Panel (pgSlice / pgBar, deploy/konten/index.html:1148-1200):
  "11–20 dari 32 konten", page numbers with gaps, rows per page 10/20/50/100.
  Not drawn while everything fits one page at the default size. The page is
  clamped to what exists: filtering 200 rows down to 5 while on page 8 must
  not show an empty table that looks like lost data.
-->
<script setup lang="ts">
const props = defineProps<{ total: number, satuan?: string }>()
const hal = defineModel<number>('hal', { default: 1 })
const per = defineModel<number>('per', { default: 10 })

const maks = computed(() => Math.max(1, Math.ceil(props.total / per.value)))
watch([maks, hal], () => {
  if (hal.value > maks.value) hal.value = maks.value
  if (hal.value < 1) hal.value = 1
}, { immediate: true })
const a = computed(() => (props.total ? (hal.value - 1) * per.value + 1 : 0))
const z = computed(() => Math.min(hal.value * per.value, props.total))
const nomor = computed(() => {
  const out: (number | '…')[] = []
  for (let i = 1; i <= maks.value; i++) {
    if (i === 1 || i === maks.value || Math.abs(i - hal.value) <= 1) out.push(i)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
})
const opsiPer = [10, 20, 50, 100].map(n => ({ label: `${n} / hal`, value: n }))
function ubahPer(n: number) {
  per.value = n
  hal.value = 1
}
</script>

<template>
  <div
    v-if="maks > 1 || total > 10"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-2.5 text-sm text-muted"
  >
    <span class="num">{{ a }}–{{ z }} dari {{ total }} {{ satuan ?? 'baris' }}</span>
    <div class="flex flex-wrap items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="hal <= 1"
        aria-label="Halaman sebelumnya"
        @click="hal = hal - 1"
      />
      <template
        v-for="(n, i) in nomor"
        :key="i"
      >
        <span
          v-if="n === '…'"
          class="px-1"
        >…</span>
        <UButton
          v-else
          :label="String(n)"
          size="sm"
          :color="n === hal ? 'primary' : 'neutral'"
          :variant="n === hal ? 'solid' : 'ghost'"
          @click="hal = n"
        />
      </template>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="hal >= maks"
        aria-label="Halaman berikutnya"
        @click="hal = hal + 1"
      />
      <USelect
        :model-value="per"
        :items="opsiPer"
        size="sm"
        class="ml-1 w-28"
        aria-label="Baris per halaman"
        @update:model-value="v => ubahPer(Number(v))"
      />
    </div>
  </div>
</template>
