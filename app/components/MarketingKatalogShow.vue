<!--
  Katalog presentation (katShow / katPaint / katKey, deploy/marketing/
  index.html:9001-9110): full screen, one slide at a time, the same list the
  page edits. ← → / Space move (wrapping), C hides the text, P runs 6 s per
  slide, F toggles full screen, Esc closes. Leaving full screen with the
  browser's own Esc also closes it — no black overlay left behind. The next
  slide's picture is fetched in the background so "next" never shows black.
  Dots only up to 20 slides (beyond that they are too dense to aim at).
-->
<script setup lang="ts">
import type { SlideKatalogMkt } from '~/utils/marketing-operasional'
import { indeksSlideMkt } from '~/utils/marketing-operasional'

const props = defineProps<{ slides: SlideKatalogMkt[], mulai?: number }>()
const buka = defineModel<boolean>('open', { default: false })
// Local, not a v-model: two key presses in one tick must both count.
const idx = ref(0)

const kotak = ref<HTMLElement | null>(null)
const tanpaTeks = ref(false)
const otomatis = ref<ReturnType<typeof setInterval> | null>(null)
const sepi = ref(false)
let pewaktuSepi: ReturnType<typeof setTimeout> | null = null
const potret = reactive<Record<string, boolean>>({})

const it = computed(() => props.slides[indeksSlideMkt(idx.value, props.slides.length)] ?? null)
const adaTeks = computed(() => !!(it.value && (it.value.judul || it.value.sub || it.value.desc)))

function ke(i: number) {
  idx.value = indeksSlideMkt(i, props.slides.length)
  bangun()
}
const maju = () => ke(idx.value + 1)
const mundur = () => ke(idx.value - 1)
function balikOtomatis() {
  if (otomatis.value) {
    clearInterval(otomatis.value)
    otomatis.value = null
  }
  else {
    otomatis.value = setInterval(maju, 6000)
  }
}
function layarPenuh() {
  if (document.fullscreenElement) void document.exitFullscreen?.()
  else void kotak.value?.requestFullscreen?.().catch(() => {}) // sengaja: fullscreen may be refused, the overlay keeps running
}
function tutup() {
  if (otomatis.value) clearInterval(otomatis.value)
  otomatis.value = null
  if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}) // sengaja: exiting fullscreen may fail silently
  buka.value = false
}
// Controls fade after 3 s without the pointer moving (katSepiMulai).
function bangun() {
  sepi.value = false
  if (pewaktuSepi) clearTimeout(pewaktuSepi)
  pewaktuSepi = setTimeout(() => (sepi.value = true), 3000)
}

function tombol(e: KeyboardEvent) {
  if (!buka.value) return
  const k = e.key
  if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') maju()
  else if (k === 'ArrowLeft' || k === 'PageUp') mundur()
  else if (k === 'Escape') tutup()
  else if (k === 'c' || k === 'C') tanpaTeks.value = !tanpaTeks.value
  else if (k === 'p' || k === 'P') balikOtomatis()
  else if (k === 'f' || k === 'F') layarPenuh()
  else return
  e.preventDefault()
}
// The browser's own Esc leaves full screen first; closing then follows it.
let pernahPenuh = false
function gantiPenuh() {
  if (document.fullscreenElement) pernahPenuh = true
  else if (pernahPenuh && buka.value) tutup()
}

watch(buka, async (b) => {
  if (b) {
    pernahPenuh = false
    idx.value = indeksSlideMkt(props.mulai ?? 0, props.slides.length)
    tanpaTeks.value = false
    document.addEventListener('keydown', tombol, true)
    document.addEventListener('fullscreenchange', gantiPenuh)
    await nextTick()
    // Called from a click, so the request is a legitimate user gesture; a refusal
    // leaves the overlay running — it is not a failure to report.
    void kotak.value?.requestFullscreen?.().catch(() => {})
    bangun()
  }
  else {
    document.removeEventListener('keydown', tombol, true)
    document.removeEventListener('fullscreenchange', gantiPenuh)
  }
})
watch([it, buka], () => {
  const nx = props.slides[indeksSlideMkt(idx.value + 1, props.slides.length)]
  if (buka.value && nx?.key) void gambarBerkasMkt(nx.key).catch(() => {}) // sengaja: preload of the next slide, a miss loads on open instead
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', tombol, true)
  document.removeEventListener('fullscreenchange', gantiPenuh)
  if (otomatis.value) clearInterval(otomatis.value)
  if (pewaktuSepi) clearTimeout(pewaktuSepi)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="buka && it"
      ref="kotak"
      class="fixed inset-0 z-[100] flex bg-black text-white"
      :class="[potret[it.id] ? 'flex-col lg:flex-row' : 'flex-col', sepi ? 'cursor-none' : '']"
      role="dialog"
      aria-label="Presentasi katalog"
      @mousemove="bangun"
      @touchstart.passive="bangun"
    >
      <div class="relative flex min-h-0 flex-1 items-center justify-center">
        <!-- Slide change crossfades the picture; controls and text stay put. -->
        <Transition
          name="mkt-fade"
          mode="out-in"
        >
          <MarketingGambar
            :key="it.id"
            :file-key="it.key"
            :alt="it.judul ?? ''"
            img-class="max-h-full max-w-full object-contain"
            @ukur="potret[it.id] = $event"
          />
        </Transition>
        <button
          type="button"
          class="absolute inset-y-0 left-0 w-1/4"
          aria-label="Slide sebelumnya"
          @click="mundur"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 w-1/4"
          aria-label="Slide berikutnya"
          @click="maju"
        />
      </div>
      <div
        v-if="adaTeks && !tanpaTeks"
        class="shrink-0 bg-black/80 px-6 py-5"
        :class="potret[it.id] ? 'lg:w-96 lg:self-center' : ''"
      >
        <h2
          v-if="it.judul"
          class="font-display text-2xl font-semibold"
        >
          {{ it.judul }}
        </h2>
        <p
          v-if="it.sub"
          class="mt-1 text-primary-300"
        >
          {{ it.sub }}
        </p>
        <p
          v-if="it.desc"
          class="mt-2 text-sm whitespace-pre-line text-white/80"
        >
          {{ it.desc }}
        </p>
      </div>

      <div
        class="absolute top-3 right-3 left-3 flex items-center gap-1 transition-opacity"
        :class="sepi ? 'pointer-events-none opacity-0' : 'opacity-100'"
      >
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="soft"
          aria-label="Sebelumnya (←)"
          @click="mundur"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="soft"
          aria-label="Berikutnya (→ / Spasi)"
          @click="maju"
        />
        <span class="num ms-2 text-sm">{{ indeksSlideMkt(idx, slides.length) + 1 }} / {{ slides.length }}</span>
        <span class="flex-1" />
        <UButton
          :icon="otomatis ? 'i-lucide-pause' : 'i-lucide-play'"
          color="neutral"
          :variant="otomatis ? 'solid' : 'soft'"
          aria-label="Jalan otomatis 6 detik per slide (P)"
          @click="balikOtomatis"
        />
        <UButton
          :icon="tanpaTeks ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="soft"
          aria-label="Sembunyikan / tampilkan teks (C)"
          @click="tanpaTeks = !tanpaTeks"
        />
        <UButton
          icon="i-lucide-maximize"
          color="neutral"
          variant="soft"
          aria-label="Layar penuh (F)"
          @click="layarPenuh"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="soft"
          aria-label="Tutup presentasi (Esc)"
          @click="tutup"
        />
      </div>
      <div
        v-if="slides.length > 1 && slides.length <= 20"
        class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 transition-opacity"
        :class="sepi ? 'opacity-0' : 'opacity-100'"
      >
        <button
          v-for="(_, k) in slides"
          :key="k"
          type="button"
          class="size-2.5 rounded-full"
          :class="k === indeksSlideMkt(idx, slides.length) ? 'bg-white' : 'bg-white/40'"
          :aria-label="`Slide ${k + 1}`"
          @click="ke(k)"
        />
      </div>
      <p
        class="absolute right-3 bottom-3 hidden text-xs text-white/50 transition-opacity lg:block"
        :class="sepi ? 'opacity-0' : 'opacity-100'"
      >
        ← → pindah · C teks · P otomatis · Esc keluar
      </p>
    </div>
  </Teleport>
</template>
