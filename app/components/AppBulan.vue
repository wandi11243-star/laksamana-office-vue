<!--
  Month field with the app's own picker instead of the browser's native
  <input type="month"> (owner request, Nov 2026) — the month sibling of
  AppTanggal: same field look (10px corners, gold hover, calendar icon), shows
  "November 2026" ("Nov 2026" at size xs/sm) and opens a popover with a year
  stepper and a 12-month grid; picking a month closes it. The model is the
  same YYYY-MM string the native input gives, so it drops in for one:
    <AppBulan v-model="bulan" size="sm" class="w-40" />
  `min` / `max` (YYYY-MM) grey out months outside the range. `clearable`
  (off by default — a period filter always has a month) shows × to empty it.
  class, title, aria-label land on the field itself; @change fires after a pick.
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Earliest pickable month, YYYY-MM. */
  min?: string
  /** Latest pickable month, YYYY-MM. */
  max?: string
  placeholder?: string
  disabled?: boolean
  /** Same scale as UInput; xs/sm also shorten the label. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show × to empty a filled field. */
  clearable?: boolean
}>(), { placeholder: 'Pilih bulan', size: 'md', clearable: false })

const emit = defineEmits<{ change: [value: string] }>()
const model = defineModel<string | null>({ default: '' })
const buka = ref(false)

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const kini = new Date()
const bulanIni = `${kini.getFullYear()}-${String(kini.getMonth() + 1).padStart(2, '0')}`

/** YYYY-MM → { y, m (1-12) }, or null when empty / malformed. */
function urai(v?: string | null) {
  const m = /^(\d{4})-(\d{2})/.exec(v ?? '')
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null
}
const kunci = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

const kecil = computed(() => props.size === 'xs' || props.size === 'sm')
const label = computed(() => {
  const d = urai(model.value)
  if (!d) return ''
  const nama = BULAN[d.m - 1] ?? ''
  return `${kecil.value ? nama.slice(0, 3) : nama} ${d.y}`
})

// The year shown in the popover; reset to the chosen month's year on open.
const tahun = ref(kini.getFullYear())
watch(buka, (v) => {
  if (v) tahun.value = urai(model.value)?.y ?? kini.getFullYear()
})

const diLuar = (y: number, m: number) => {
  const k = kunci(y, m)
  return (!!props.min && k < props.min.slice(0, 7)) || (!!props.max && k > props.max.slice(0, 7))
}

function pilih(m: number) {
  if (diLuar(tahun.value, m)) return
  const v = kunci(tahun.value, m)
  model.value = v
  buka.value = false
  emit('change', v)
}
function kosongkan() {
  model.value = ''
  buka.value = false
  emit('change', '')
}

const ukuran = computed(() => ({
  xs: 'min-h-7 gap-1.5 px-2 text-xs',
  sm: 'min-h-8 gap-1.5 px-2.5 text-xs',
  md: 'min-h-11 gap-2 px-3 text-sm lg:min-h-9',
  lg: 'min-h-11 gap-2 px-3 text-sm lg:min-h-10',
  xl: 'min-h-12 gap-2 px-3.5 text-base',
})[props.size])
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
      :aria-label="($attrs['aria-label'] as string | undefined) ?? (label ? `Bulan: ${label}` : placeholder)"
    >
      <UIcon
        name="i-lucide-calendar-range"
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
        aria-label="Kosongkan bulan"
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
      <div class="w-64 p-3">
        <div class="mb-2 flex items-center justify-between">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Tahun sebelumnya"
            @click="tahun--"
          />
          <b class="num font-display text-sm text-highlighted">{{ tahun }}</b>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Tahun berikutnya"
            @click="tahun++"
          />
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="(nama, i) in BULAN"
            :key="nama"
            type="button"
            class="rounded-field px-2 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            :class="model?.slice(0, 7) === kunci(tahun, i + 1)
              ? 'bg-primary font-semibold text-white'
              : kunci(tahun, i + 1) === bulanIni
                ? 'font-semibold text-gold-deep ring-1 ring-inset ring-gold hover:bg-gold-soft'
                : 'text-default hover:bg-gold-soft hover:text-gold-deep'"
            :disabled="diLuar(tahun, i + 1)"
            @click="pilih(i + 1)"
          >
            {{ nama.slice(0, 3) }}
          </button>
        </div>
        <div class="mt-2 flex justify-end">
          <UButton
            label="Bulan ini"
            color="neutral"
            variant="link"
            size="xs"
            :disabled="diLuar(kini.getFullYear(), kini.getMonth() + 1)"
            @click="tahun = kini.getFullYear(); pilih(kini.getMonth() + 1)"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
