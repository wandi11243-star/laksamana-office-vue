<!--
  The old Marketing table pager (tblPagerHtml, deploy/marketing/index.html:5473-5484):
  "11–20 dari 32", ‹ 1 … 4 5 6 … 9 ›. Hidden when everything fits one page.
-->
<script setup lang="ts">
import { PER_HAL_MKT } from '~/utils/marketing'

const props = defineProps<{ total: number }>()
const hal = defineModel<number>({ default: 1 })

const maks = computed(() => Math.max(1, Math.ceil(props.total / PER_HAL_MKT)))
const kini = computed(() => Math.min(Math.max(1, hal.value), maks.value))
const nomor = computed(() => {
  const out: (number | '…')[] = []
  for (let i = 1; i <= maks.value; i++) {
    if (i === 1 || i === maks.value || Math.abs(i - kini.value) <= 1) out.push(i)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
})
</script>

<template>
  <div
    v-if="maks > 1"
    class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2.5 text-sm text-muted lg:px-5"
  >
    <span class="num">{{ (kini - 1) * PER_HAL_MKT + 1 }}–{{ Math.min(kini * PER_HAL_MKT, total) }} dari {{ total }}</span>
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        size="xs"
        aria-label="Halaman sebelumnya"
        :disabled="kini <= 1"
        @click="hal = kini - 1"
      />
      <template
        v-for="(x, i) in nomor"
        :key="i"
      >
        <span
          v-if="x === '…'"
          class="px-1"
        >…</span>
        <UButton
          v-else
          :label="String(x)"
          :color="x === kini ? 'primary' : 'neutral'"
          :variant="x === kini ? 'solid' : 'outline'"
          size="xs"
          class="num min-w-7 justify-center"
          @click="hal = x"
        />
      </template>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        size="xs"
        aria-label="Halaman berikutnya"
        :disabled="kini >= maks"
        @click="hal = kini + 1"
      />
    </div>
  </div>
</template>
