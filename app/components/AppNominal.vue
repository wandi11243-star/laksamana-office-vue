<!--
  Money field: shows thousands separators while typing ("1.500.000", owner
  request Nov 2026) with a quiet "Rp" in front, and hands the parent the bare
  digits ("1500000", or "" when emptied) — the same string a plain numeric
  UInput gave, so callers keep their own parsing. A number model (an amount
  already saved) is rounded to whole rupiah for display.
    <AppNominal v-model="f.nominal" size="lg" class="w-full" />
  Every other attribute (size, class, placeholder, disabled, :ui) and listener
  passes through to the UInput.
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{ modelValue?: string | number | null }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const digit = (v: unknown) => (typeof v === 'number'
  ? (Number.isFinite(v) ? String(Math.round(v)) : '')
  : String(v ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, ''))

const tampil = computed(() => {
  const d = digit(props.modelValue)
  return d ? Number(d).toLocaleString('id-ID') : ''
})

function ketik(v: unknown) {
  emit('update:modelValue', digit(String(v ?? '')))
}
</script>

<template>
  <UInput
    v-bind="$attrs"
    :model-value="tampil"
    inputmode="numeric"
    autocomplete="off"
    @update:model-value="ketik"
  >
    <template #leading>
      <span class="text-xs font-semibold text-muted">Rp</span>
    </template>
  </UInput>
</template>
