<!--
  The month calendar shared by Marketing › Kalender, Event › Kalender and
  (later) Talent Schedule. The look is the Marketing calendar: panel with a
  header (month title, legend, total at the right), a Sunday-first grid and the
  `mkt-swap` crossfade when the month steps.

  It draws the frame only; what goes in a day comes from the `sel` slot (use
  `KalenderKartu` for the cards). Interaction is generic and reported, never
  decided here:
    - `klik-tgl`  an empty spot of a day was clicked (only when `bolehKlik`);
    - `lepas`     a draggable card was dropped on another day (only when
                  `bolehSeret`); the page confirms and writes.
-->
<script setup lang="ts">
import { BULAN, hariIni } from '~/utils/format'
import { selBulan } from '~/utils/kalender'
import { kalenderKonteks } from '~/utils/kalender-konteks'
import { LABEL_DEAL } from '~/utils/kalender-warna'

const props = withDefaults(defineProps<{
  /** `YYYY-MM`. */
  bulan: string
  /** Clicking an empty spot of a day emits `klik-tgl`. */
  bolehKlik?: boolean
  /** Cards that carry a `seretId` can be dragged to another day. */
  bolehSeret?: boolean
  /** Tooltip of a clickable day. */
  judulKlik?: string
  /** Add "Deal / pasti jalan" (with its dot) to the legend. */
  legendaDeal?: boolean
}>(), { bolehKlik: false, bolehSeret: false, judulKlik: 'Klik untuk menambah di tanggal ini', legendaDeal: false })

const emit = defineEmits<{
  'klik-tgl': [tgl: string]
  'lepas': [lepas: { id: string, dari: string, ke: string }]
}>()

defineSlots<{
  /** Legend entries (the deal entry is added by `legendaDeal`). */
  legenda?: () => unknown
  /** The figure at the right of the header. */
  total?: () => unknown
  /** The content of a day. */
  sel?: (p: { tgl: string, hari: boolean }) => unknown
}>()

const hari = hariIni()
const judul = computed(() => `${BULAN[+props.bulan.slice(5, 7) - 1]} ${props.bulan.slice(0, 4)}`)
const sel = computed(() => selBulan(props.bulan))

const seret = ref<{ id: string, dari: string } | null>(null)
const sasaran = ref('')
function selesai() {
  seret.value = null
  sasaran.value = ''
}
provide(kalenderKonteks, {
  bolehSeret: computed(() => props.bolehSeret),
  mulai(id, dari, ev) {
    seret.value = { id, dari }
    ev.dataTransfer?.setData('text/plain', id)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
  },
  selesai,
})
function lepasDi(tgl: string) {
  const s = seret.value
  selesai()
  if (!s || !tgl || tgl === s.dari) return
  emit('lepas', { id: s.id, dari: s.dari, ke: tgl })
}
function klikSel(tgl: string) {
  if (tgl && props.bolehKlik) emit('klik-tgl', tgl)
}
</script>

<template>
  <AppPanel flush>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default px-4 py-3 lg:px-5">
      <h2 class="font-display text-lg font-semibold">
        {{ judul }}
      </h2>
      <div class="flex flex-wrap items-center gap-3 text-xs">
        <slot name="legenda" />
        <span
          v-if="legendaDeal"
          class="flex items-center gap-1.5"
        ><span class="size-2 rounded-full bg-success" />{{ LABEL_DEAL }}</span>
      </div>
      <span class="num ml-auto text-sm font-bold text-primary-700"><slot name="total" /></span>
    </div>
    <div class="grid grid-cols-7 border-b border-default text-center text-[11px] font-bold tracking-wide text-muted uppercase">
      <div
        v-for="x in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']"
        :key="x"
        class="py-2"
      >
        {{ x }}
      </div>
    </div>
    <!-- Month step replaces the grid, so it crossfades on one key. -->
    <Transition
      name="mkt-swap"
      mode="out-in"
    >
      <div
        :key="bulan"
        class="grid grid-cols-7"
      >
        <div
          v-for="(s, i) in sel"
          :key="i"
          class="min-h-20 min-w-0 border-r border-b border-default p-1 lg:min-h-28 lg:p-1.5"
          :class="[!s.tgl ? 'bg-muted/60' : '', s.tgl === hari ? 'bg-primary-50' : '', s.tgl && bolehKlik ? 'cursor-pointer hover:bg-elevated/50' : '', s.tgl && s.tgl === sasaran ? 'ring-2 ring-inset ring-primary-400' : '']"
          :title="s.tgl && bolehKlik ? judulKlik : undefined"
          @click="klikSel(s.tgl)"
          @dragover="(ev: DragEvent) => { if (seret && s.tgl) { ev.preventDefault(); sasaran = s.tgl } }"
          @dragleave="sasaran === s.tgl && (sasaran = '')"
          @drop.prevent="lepasDi(s.tgl)"
        >
          <p
            class="num mb-1 text-xs"
            :class="s.tgl === hari ? 'font-bold text-primary-700' : s.tgl ? 'font-semibold text-default' : 'text-dimmed'"
          >
            {{ s.d }}
          </p>
          <slot
            v-if="s.tgl"
            name="sel"
            :tgl="s.tgl"
            :hari="s.tgl === hari"
          />
        </div>
      </div>
    </Transition>
  </AppPanel>
</template>
