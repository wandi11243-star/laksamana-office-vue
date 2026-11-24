<!--
  One card of a month calendar (shared by Marketing, Event and Talent Schedule).
  The card keeps the colour of its SOURCE (`kalender-warna.ts`); a deal is
  marked only by the small green dot before the title (owner decision,
  Nov 2026), with a tooltip and screen-reader text. Phones show the dot too.

  Drag: the card is draggable only when the parent gives it `seretId` AND the
  surrounding KalenderBulan allows dragging. The drop is reported by
  KalenderBulan (`lepas`), the page decides and confirms.
-->
<script setup lang="ts">
import type { SumberKalender } from '~/utils/kalender-warna'
import { LABEL_DEAL, SUMBER_KALENDER } from '~/utils/kalender-warna'
import { kalenderKonteks } from '~/utils/kalender-konteks'

const props = withDefaults(defineProps<{
  /** The source colour (default: talent). */
  sumber?: SumberKalender
  /** Own colour classes instead of the source colour (e.g. a talent category, `gayaNada`). */
  gaya?: string
  /** A pending roster draft: dashed outline. */
  draf?: boolean
  judul?: string
  /** Show the green deal dot. */
  deal?: boolean
  /** Right-aligned text on wide screens (e.g. "40 pax"). */
  kanan?: string
  /** Strike the title through (cancelled). */
  dicoret?: boolean
  /** Not clickable: a plain label (holiday, birthday). */
  statis?: boolean
  /** Id carried by the drag; when set (and dragging is on) the card can be dragged. */
  seretId?: string
  /** The day this card is drawn on (needed for dragging). */
  tgl?: string
  title?: string
}>(), { sumber: 'talent', gaya: '', draf: false, judul: '', deal: false, kanan: '', dicoret: false, statis: false, seretId: '', tgl: '', title: '' })

const emit = defineEmits<{ klik: [ev: MouseEvent] }>()

const konteks = inject(kalenderKonteks, null)
const bisaSeret = computed(() => !!props.seretId && !!konteks?.bolehSeret.value && !!props.tgl)
const judulPenuh = computed(() => {
  const t = props.title || props.judul
  const geser = bisaSeret.value ? ' · geser ke tanggal lain untuk memindahkan' : ''
  return `${t}${props.deal ? ` · ${LABEL_DEAL}` : ''}${geser}`
})

function mulaiSeret(ev: DragEvent) {
  if (bisaSeret.value) konteks?.mulai(props.seretId, props.tgl, ev)
}
</script>

<template>
  <component
    :is="statis ? 'span' : 'button'"
    :type="statis ? undefined : 'button'"
    class="mb-0.5 block w-full truncate rounded border-l-2 px-1 py-0.5 text-left text-[10.5px] font-semibold leading-tight lg:text-[11px]"
    :class="[gaya || SUMBER_KALENDER[sumber].kartu, draf ? 'outline-1 -outline-offset-1 outline-dashed' : '', dicoret ? 'line-through opacity-60' : '', bisaSeret ? 'cursor-grab active:cursor-grabbing' : '']"
    :title="judulPenuh"
    :draggable="bisaSeret"
    @dragstart="mulaiSeret"
    @dragend="konteks?.selesai()"
    @click.stop="!statis && emit('klik', $event)"
  >
    <b
      v-if="kanan"
      class="float-right ml-1 hidden lg:inline"
    >{{ kanan }}</b>
    <template v-if="deal">
      <span
        class="mr-1 inline-block size-2 rounded-full bg-success align-middle"
        :title="LABEL_DEAL"
        aria-hidden="true"
      />
      <span class="sr-only">{{ LABEL_DEAL }}: </span>
    </template>
    <slot>{{ judul }}</slot>
  </component>
</template>
