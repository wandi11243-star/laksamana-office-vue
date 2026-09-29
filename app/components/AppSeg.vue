<!--
  Segmented tabs in a rounded track (the old Tabel / Kalender / Denah meja /
  Waiting list, Harian / Bulanan, Weekday / Weekend / Lantai 2). The chosen
  segment is a white chip with gold words.
-->
<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { value: T, label: string, icon?: string, badge?: number }[]
  size?: 'sm' | 'md'
}>()
const model = defineModel<T>()
</script>

<template>
  <div
    class="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-full border border-default bg-muted p-1"
    role="tablist"
  >
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="tab"
      :aria-selected="model === o.value"
      class="inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary"
      :class="[
        size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm',
        model === o.value
          ? 'bg-default text-primary-700 shadow-sm dark:text-primary-300'
          : 'text-muted hover:text-highlighted',
      ]"
      @click="model = o.value"
    >
      <UIcon
        v-if="o.icon"
        :name="o.icon"
        class="size-4"
      />
      {{ o.label }}
      <span
        v-if="o.badge"
        class="rounded-full bg-error px-1.5 text-[11px] font-bold text-white num"
      >{{ o.badge }}</span>
    </button>
  </div>
</template>
