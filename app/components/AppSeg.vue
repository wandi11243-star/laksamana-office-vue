<!--
  Segmented tabs in a rounded track (the old Tabel / Kalender / Denah meja /
  Waiting list, Harian / Bulanan, Weekday / Weekend / Lantai 2). The chosen
  segment is a white tile with deep-gold words (DESIGN.md › Komponen).
-->
<script setup lang="ts" generic="T extends string | number | boolean">
defineProps<{
  /** `badge` = red attention pill; `jumlah` = a quiet count after the label (old `opacity:.6` span). */
  options: { value: T, label: string, icon?: string, badge?: number, jumlah?: number, title?: string }[]
  size?: 'sm' | 'md'
}>()
const model = defineModel<T>()
</script>

<template>
  <div
    class="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-field border border-default bg-muted p-1"
    role="tablist"
  >
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="tab"
      :aria-selected="model === o.value"
      :title="o.title"
      class="seg-btn inline-flex items-center gap-1.5 rounded-[8px] font-semibold transition-[color,background-color,transform] duration-150 ease-laks active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary"
      :class="[
        size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm',
        model === o.value
          ? 'bg-default text-gold-deep shadow-sm ring-1 ring-default'
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
        v-if="o.jumlah"
        class="font-semibold num"
        :class="model === o.value ? 'text-gold-deep/75' : 'opacity-60'"
      >{{ o.jumlah }}</span>
      <span
        v-if="o.badge"
        class="rounded-full bg-error px-1.5 text-[11px] font-bold text-white num"
      >{{ o.badge }}</span>
    </button>
  </div>
</template>
