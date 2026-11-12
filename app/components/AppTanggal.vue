<!--
  Date field with the app's own calendar instead of the browser's native
  picker (DESIGN.md › Komponen). Looks like an input (10px corners, white on
  the layer below), shows the day in Indonesian ("Kamis, 12 November 2026")
  and opens a UCalendar in a popover; picking a day closes it. The model is
  the same YYYY-MM-DD string a native <input type="date"> gives, so it drops
  in for one.
    <AppTanggal v-model="tgl" :min="hariIni()" />
-->
<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'

const props = withDefaults(defineProps<{
  /** Earliest pickable day, YYYY-MM-DD. */
  min?: string
  /** Latest pickable day, YYYY-MM-DD. */
  max?: string
  placeholder?: string
  disabled?: boolean
}>(), { placeholder: 'Pilih tanggal' })

const model = defineModel<string>({ default: '' })
const buka = ref(false)

function keTanggal(iso?: string): DateValue | undefined {
  if (!iso) return undefined
  try {
    return parseDate(iso)
  }
  catch {
    return undefined
  }
}

const pilihan = computed<DateValue | undefined>({
  get: () => keTanggal(model.value),
  set: (v) => {
    if (!v) return
    model.value = v.toString()
    buka.value = false
  },
})

const label = computed(() => {
  const d = keTanggal(model.value)
  if (!d) return ''
  return new Date(d.year, d.month - 1, d.day)
    .toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})
</script>

<template>
  <UPopover
    v-model:open="buka"
    :content="{ align: 'start', sideOffset: 6 }"
    :disabled="disabled"
  >
    <button
      type="button"
      class="flex min-h-11 w-full items-center gap-2 rounded-field bg-default px-3 text-left text-sm ring-1 ring-inset ring-accented transition-colors hover:ring-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9"
      :disabled="disabled"
      :aria-label="label ? `Tanggal: ${label}` : placeholder"
    >
      <UIcon
        name="i-lucide-calendar-days"
        class="size-4 shrink-0 text-gold-deep"
      />
      <span
        class="min-w-0 flex-1 truncate"
        :class="label ? 'text-highlighted' : 'text-dimmed'"
      >{{ label || placeholder }}</span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 shrink-0 text-dimmed transition-transform"
        :class="buka && 'rotate-180'"
      />
    </button>
    <template #content>
      <!-- Remounted on every open so the grid starts on the chosen month
           (reka-ui seeds the visible month from defaultValue). -->
      <UCalendar
        :key="String(buka)"
        v-model="pilihan"
        :default-value="pilihan"
        :min-value="keTanggal(props.min)"
        :max-value="keTanggal(props.max)"
        locale="id"
        class="p-2"
      />
    </template>
  </UPopover>
</template>
