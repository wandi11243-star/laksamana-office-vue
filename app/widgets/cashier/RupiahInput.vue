<!--
  A rupiah field as the cashier types it: digits only, shown with thousand
  dots while typing (old `.rp` + fmtRpInput, deploy/cashier/index.html:507).
  The model is a plain number; an empty field is 0.
-->
<script setup lang="ts">
import { rupiahVal } from '~/utils/format'

defineProps<{ placeholder?: string, size?: 'sm' | 'md', ariaLabel?: string }>()
const model = defineModel<number>({ default: 0 })

const tampil = computed(() => (model.value ? new Intl.NumberFormat('id-ID').format(model.value) : ''))
const ubah = (v: string | number) => {
  model.value = rupiahVal(v)
}
</script>

<template>
  <UInput
    :model-value="tampil"
    inputmode="numeric"
    :placeholder="placeholder ?? '0'"
    :size="size"
    :aria-label="ariaLabel"
    class="w-full"
    :ui="{ base: 'text-right num' }"
    @update:model-value="ubah"
  >
    <template #leading>
      <span class="text-xs text-dimmed">Rp</span>
    </template>
  </UInput>
</template>
