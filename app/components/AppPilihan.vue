<!--
  Two or three big choice buttons side by side (old .toggle-row: Sudah DP / Belum
  DP, Ya / Tidak). The chosen one is gold-soft with a gold edge. A radio group
  underneath, so keyboard and screen readers get the real semantics.
-->
<script setup lang="ts" generic="T extends string | number | boolean">
defineProps<{
  options: { value: T, label: string, icon?: string }[]
  name: string
}>()
const model = defineModel<T>()
</script>

<template>
  <div
    class="grid auto-cols-fr grid-flow-col gap-2.5"
    role="radiogroup"
  >
    <label
      v-for="o in options"
      :key="String(o.value)"
      class="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-field border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-primary"
      :class="model === o.value
        ? 'border-primary-400 bg-primary-100 text-highlighted dark:bg-primary-950'
        : 'border-default bg-default text-muted hover:border-accented'"
    >
      <input
        v-model="model"
        type="radio"
        :name="name"
        :value="o.value"
        class="sr-only"
      >
      <UIcon
        v-if="o.icon"
        :name="o.icon"
        class="size-4"
      />
      {{ o.label }}
    </label>
  </div>
</template>
