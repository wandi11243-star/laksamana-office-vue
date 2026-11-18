<!--
  Time field in the app's own look (owner request, Nov 2026), the twin of
  AppTanggal: an input-like button showing "14:30", a popover with an hour
  column (00–23), a minute column (every `langkah` minutes, 5 by default) and
  a box to type an exact time. The model is the same "HH:MM" string a native
  <input type="time"> gives, so it drops in for one:
    <AppJam v-model="f.jam" size="sm" class="w-32" />
  Picking an hour keeps the minute (00 when empty); picking a minute closes it.
  A filled field can be emptied with × (`clearable`). class, title, aria-label
  and listeners land on the field itself.
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  clearable?: boolean
  /** Minute step of the minute column. */
  langkah?: number
}>(), { placeholder: '--:--', size: 'md', clearable: true, langkah: 5 })

const model = defineModel<string>({ default: '' })
const buka = ref(false)

const pad = (n: number) => String(n).padStart(2, '0')
/** "7:5", "0705", "07.05" → "07:05"; anything unreadable → ''. */
function rapikan(v: string): string {
  const m = String(v ?? '').trim().match(/^(\d{1,2})[:.]?(\d{2})?/)
  if (!m) return ''
  const h = Number(m[1])
  const mm = Number(m[2] ?? 0)
  return h <= 23 && mm <= 59 ? `${pad(h)}:${pad(mm)}` : ''
}
const jam = computed(() => (model.value ? Number(model.value.slice(0, 2)) : null))
const menit = computed(() => (model.value ? Number(model.value.slice(3, 5)) : null))

const daftarJam = Array.from({ length: 24 }, (_, i) => i)
const daftarMenit = computed(() => {
  const s = Math.max(1, Math.min(30, props.langkah))
  const l = Array.from({ length: Math.ceil(60 / s) }, (_, i) => i * s)
  // An off-step saved minute (07:07) still shows as chosen.
  if (menit.value !== null && !l.includes(menit.value)) l.push(menit.value)
  return l.sort((a, b) => a - b)
})

function pilihJam(h: number) {
  model.value = `${pad(h)}:${pad(menit.value ?? 0)}`
}
function pilihMenit(m: number) {
  model.value = `${pad(jam.value ?? 0)}:${pad(m)}`
  buka.value = false
}
const ketik = ref('')
watch(buka, (o) => {
  if (!o) return
  ketik.value = model.value
  // Bring the chosen hour/minute into view once the lists are drawn.
  // Scroll only the list itself — scrollIntoView would move the page too.
  nextTick(() => document.querySelectorAll<HTMLElement>('[data-jam-aktif]').forEach((el) => {
    const daftar = el.parentElement
    if (daftar) daftar.scrollTop = el.offsetTop - daftar.offsetTop - daftar.clientHeight / 2 + el.clientHeight / 2
  }))
})
function terapkan() {
  const r = rapikan(ketik.value)
  if (r) {
    model.value = r
    buka.value = false
  }
}
function kosongkan() {
  model.value = ''
  buka.value = false
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
      :aria-label="($attrs['aria-label'] as string | undefined) ?? (model ? `Jam: ${model}` : 'Pilih jam')"
    >
      <UIcon
        name="i-lucide-clock"
        class="size-4 shrink-0 text-gold-deep"
      />
      <span
        class="num min-w-0 flex-1 truncate"
        :class="model ? 'font-semibold text-highlighted' : 'text-dimmed'"
      >{{ model || placeholder }}</span>
      <span
        v-if="clearable && model && !disabled"
        role="button"
        tabindex="-1"
        class="grid size-5 shrink-0 place-items-center rounded-full text-dimmed hover:bg-muted hover:text-highlighted"
        aria-label="Kosongkan jam"
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
      <div class="w-52 p-2">
        <form
          class="mb-2 flex gap-1.5"
          @submit.prevent="terapkan"
        >
          <UInput
            v-model="ketik"
            placeholder="HH:MM"
            size="sm"
            class="min-w-0 flex-1"
            :ui="{ base: 'num text-center' }"
            aria-label="Ketik jam"
          />
          <UButton
            type="submit"
            icon="i-lucide-check"
            size="sm"
            aria-label="Pakai jam ini"
          />
        </form>
        <div class="grid grid-cols-2 gap-1.5">
          <div>
            <p class="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
              Jam
            </p>
            <div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto overscroll-contain pe-0.5 [scrollbar-width:thin]">
              <button
                v-for="h in daftarJam"
                :key="h"
                type="button"
                class="num rounded-md py-1.5 text-sm transition-colors"
                :class="jam === h ? 'bg-gold-deep font-bold text-white' : 'text-default hover:bg-gold-soft/60'"
                :data-jam-aktif="jam === h ? '' : undefined"
                @click="pilihJam(h)"
              >
                {{ pad(h) }}
              </button>
            </div>
          </div>
          <div>
            <p class="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
              Menit
            </p>
            <div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto overscroll-contain pe-0.5 [scrollbar-width:thin]">
              <button
                v-for="m in daftarMenit"
                :key="m"
                type="button"
                class="num rounded-md py-1.5 text-sm transition-colors"
                :class="menit === m ? 'bg-gold-deep font-bold text-white' : 'text-default hover:bg-gold-soft/60'"
                :data-jam-aktif="menit === m ? '' : undefined"
                @click="pilihMenit(m)"
              >
                {{ pad(m) }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
