<!--
  The scrolling frame of every kanban board (owner request, Nov 2026).

  Wheel: over a column long enough to scroll, only that column moves — the
  page behind stays put, also once the column reaches its end. Anywhere else
  (short or empty columns, headers, gaps) the page scrolls as usual.

  Sideways, when the columns do not fit: the arrow buttons, dragging an empty
  part of the board with the mouse, Shift + wheel, or a trackpad swipe.
  Column lists must not set `overscroll-behavior`: it would swallow the
  sideways swipe, and some browsers then hold the page over short columns too.

  `class` and `style` land on the track, so the caller lays out the columns.
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const trek = ref<HTMLElement | null>(null)
const bisaKiri = ref(false)
const bisaKanan = ref(false)
const bisaGeser = computed(() => bisaKiri.value || bisaKanan.value)

function ukur() {
  const el = trek.value
  if (!el) return
  bisaKiri.value = el.scrollLeft > 1
  bisaKanan.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function geser(arah: 1 | -1) {
  const el = trek.value
  el?.scrollBy({ left: arah * Math.max(240, el.clientWidth * 0.6), behavior: 'smooth' })
}

function roda(ev: WheelEvent) {
  // Zoom and sideways gestures stay native.
  if (ev.ctrlKey || ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || !ev.deltaY) return
  const turun = ev.deltaY > 0
  let adaDaftarPanjang = false
  for (let el = ev.target as HTMLElement | null; el && el !== trek.value; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue
    if (!/auto|scroll/.test(getComputedStyle(el).overflowY)) continue
    // It can still move this way: the browser scrolls it.
    if (turun ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return
    adaDaftarPanjang = true
  }
  // At the end of a long list the page stays; with nothing to scroll here, it moves as usual.
  if (adaDaftarPanjang) ev.preventDefault()
}

// ---- drag an empty part of the board to pan it (mouse only; touch already swipes) ----
const menarik = ref(false)
let awalX = 0
let awalScroll = 0
const BUKAN_AREA_KOSONG = '[draggable="true"], .kanban-card, article, button, a, input, textarea, select, label, [role="button"]'

function tekan(ev: PointerEvent) {
  if (ev.pointerType !== 'mouse' || ev.button !== 0 || !bisaGeser.value) return
  if ((ev.target as HTMLElement).closest(BUKAN_AREA_KOSONG)) return
  ev.preventDefault() // no text selection while panning
  menarik.value = true
  awalX = ev.clientX
  awalScroll = trek.value!.scrollLeft
  window.addEventListener('pointermove', tarik)
  window.addEventListener('pointerup', lepas)
  window.addEventListener('pointercancel', lepas)
}
function tarik(ev: PointerEvent) {
  if (trek.value) trek.value.scrollLeft = awalScroll - (ev.clientX - awalX)
}
function lepas() {
  menarik.value = false
  window.removeEventListener('pointermove', tarik)
  window.removeEventListener('pointerup', lepas)
  window.removeEventListener('pointercancel', lepas)
}

let pengamat: ResizeObserver | undefined
function amati() {
  const el = trek.value
  if (!el || !pengamat) return
  pengamat.disconnect()
  pengamat.observe(el)
  for (const anak of el.children) pengamat.observe(anak)
}
onMounted(() => {
  // `passive: false`, so the handler may keep the page from scrolling.
  trek.value?.addEventListener('wheel', roda, { passive: false })
  pengamat = new ResizeObserver(ukur)
  amati()
  ukur()
})
onUpdated(() => {
  amati()
  ukur()
})
onBeforeUnmount(() => {
  trek.value?.removeEventListener('wheel', roda)
  pengamat?.disconnect()
  lepas()
})
</script>

<template>
  <div class="min-w-0">
    <div
      v-if="bisaGeser"
      class="mb-2 flex items-center justify-end gap-1.5"
    >
      <span class="me-auto hidden text-xs text-muted lg:inline">
        Geser ke samping: tombol panah, tarik area kosong, atau Shift + scroll
      </span>
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="!bisaKiri"
        aria-label="Geser papan ke kiri"
        @click="geser(-1)"
      />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="!bisaKanan"
        aria-label="Geser papan ke kanan"
        @click="geser(1)"
      />
    </div>
    <div
      ref="trek"
      v-bind="$attrs"
      class="overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]"
      :class="[bisaGeser && 'lg:cursor-grab', menarik && '!cursor-grabbing select-none']"
      @scroll.passive="ukur"
      @pointerdown="tekan"
    >
      <slot />
    </div>
  </div>
</template>
