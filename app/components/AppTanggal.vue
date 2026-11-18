<!--
  Date field with the app's own calendar instead of the browser's native
  picker (DESIGN.md › Komponen). Looks like an input (10px corners, white on
  the layer below), shows the day in Indonesian ("Kamis, 12 November 2026";
  "12 Nov 2026" at size xs/sm) and opens a UCalendar in a popover; picking a
  day closes it. The model is the same YYYY-MM-DD string a native
  <input type="date"> gives, so it drops in for one — every date field in the
  app uses it (owner request, Nov 2026):
    <AppTanggal v-model="tgl" :min="hariIni()" size="sm" class="w-40" />
  A filled, optional field can be emptied with the × (`clearable`, on by
  default; pass `:clearable="false"` where a date must always stay). class,
  title, aria-label and listeners such as @focus land on the field itself.
-->
<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Earliest pickable day, YYYY-MM-DD. */
  min?: string
  /** Latest pickable day, YYYY-MM-DD. */
  max?: string
  placeholder?: string
  disabled?: boolean
  /** Same scale as UInput; xs/sm also shorten the label. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show × to empty a filled field. */
  clearable?: boolean
}>(), { placeholder: 'Pilih tanggal', size: 'md', clearable: true })

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

const kecil = computed(() => props.size === 'xs' || props.size === 'sm')
const label = computed(() => {
  const d = keTanggal(model.value)
  if (!d) return ''
  return new Date(d.year, d.month - 1, d.day).toLocaleDateString('id-ID', kecil.value
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

const ukuran = computed(() => ({
  xs: 'min-h-7 gap-1.5 px-2 text-xs',
  sm: 'min-h-8 gap-1.5 px-2.5 text-xs',
  md: 'min-h-11 gap-2 px-3 text-sm lg:min-h-9',
  lg: 'min-h-11 gap-2 px-3 text-sm lg:min-h-10',
  xl: 'min-h-12 gap-2 px-3.5 text-base',
})[props.size])

function kosongkan() {
  model.value = ''
  buka.value = false
}
</script>

<template>
  <UPopover
    v-model:open="buka"
    :content="{ align: 'start', sideOffset: 6 }"
    :disabled="disabled"
  >
    <button
      type="button"
      v-bind="$attrs"
      class="flex w-full items-center rounded-field bg-default text-left ring-1 ring-inset ring-accented transition-colors hover:ring-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      :class="[ukuran, buka && 'ring-2 ring-gold']"
      :disabled="disabled"
      :aria-label="($attrs['aria-label'] as string | undefined) ?? (label ? `Tanggal: ${label}` : placeholder)"
    >
      <UIcon
        name="i-lucide-calendar-days"
        class="size-4 shrink-0 text-gold-deep"
      />
      <span
        class="min-w-0 flex-1 truncate"
        :class="label ? 'text-highlighted' : 'text-dimmed'"
      >{{ label || placeholder }}</span>
      <!-- A span, not a button: no button inside a button. -->
      <span
        v-if="clearable && model && !disabled"
        role="button"
        tabindex="-1"
        class="grid size-5 shrink-0 place-items-center rounded-full text-dimmed hover:bg-muted hover:text-highlighted"
        aria-label="Kosongkan tanggal"
        title="Kosongkan"
        @click.stop="kosongkan"
      >
        <UIcon
          name="i-lucide-x"
          class="size-3.5"
        />
      </span>
      <UIcon
        v-else
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
