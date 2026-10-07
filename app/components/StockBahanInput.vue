<!--
  Material name input with suggestions from the Purchasing product list.

  Free text is always allowed (waste may be a ready product that was never
  ordered as a raw material), so this is deliberately NOT a closed picker:
  typing keeps the value, the list only makes registered names quicker to pick
  and tells the parent when a name was actually chosen so it can refresh the
  unit options (`catat-common.js:220` `pasangAutocomplete`).
-->
<script setup lang="ts">
const props = defineProps<{
  daftar: string[]
  placeholder?: string
}>()
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ pilih: [nama: string] }>()

const buka = ref(false)
const cocok = computed(() => {
  const q = model.value.trim().toLowerCase()
  if (!q) return []
  return props.daftar.filter(x => x.toLowerCase().includes(q)).slice(0, 8)
})

function pilih(nama: string) {
  model.value = nama
  buka.value = false
  emit('pilih', nama)
}
function tutupNanti() {
  setTimeout(() => {
    buka.value = false
  }, 150)
}
</script>

<template>
  <div class="relative">
    <UInput
      v-model="model"
      :placeholder="placeholder ?? 'Nama bahan…'"
      autocomplete="off"
      class="w-full"
      @focus="buka = true"
      @update:model-value="buka = true"
      @blur="tutupNanti"
      @keydown.escape="buka = false"
    />
    <div
      v-if="buka && cocok.length"
      class="absolute inset-x-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-field border border-default bg-default py-1 shadow-panel"
    >
      <button
        v-for="n in cocok"
        :key="n"
        type="button"
        class="block w-full px-3 py-1.5 text-start text-[13px] font-medium text-highlighted hover:bg-elevated/60"
        @mousedown.prevent="pilih(n)"
        @click="pilih(n)"
      >
        {{ n }}
      </button>
    </div>
  </div>
</template>
