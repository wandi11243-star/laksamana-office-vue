<!--
  Cost chart of Analytics › Pengeluaran: ONE cost line at a time (the page picks
  it), one column per period. Bar or Titik (dot chart), or Angka (a table).
  Hovering (or tapping) a column shows a tooltip with the period, the amount and
  the change from the previous column. Every column keeps at least MIN_KOLOM px,
  so a long range scrolls sideways instead of squeezing the bars together.
  Plain SVG, no chart library.
-->
<script setup lang="ts">
import { rupiah } from '~/utils/format'

const props = defineProps<{
  kategori: string[]
  /** Full period name for the tooltip ("Oktober 2026"). */
  judul: string[]
  nama: string
  warna: string
  nilai: number[]
  mode: 'angka' | 'bar' | 'titik'
  /** Profit lines: a rise is good (green). Costs: a rise is bad (red). */
  naikBaik?: boolean
}>()

/** "Rp 1,2 M" / "Rp 345 jt": axis labels must stay short. */
const pendek = (n: number) => {
  const a = Math.abs(n)
  const f = (x: number) => x.toLocaleString('id-ID', { maximumFractionDigits: x < 10 ? 1 : 0 })
  if (a >= 1e9) return `${n < 0 ? '-' : ''}${f(a / 1e9)} M`
  if (a >= 1e6) return `${n < 0 ? '-' : ''}${f(a / 1e6)} jt`
  if (a >= 1e3) return `${n < 0 ? '-' : ''}${f(a / 1e3)} rb`
  return String(Math.round(n))
}

// ─── geometry ──
const MIN_KOLOM = 72
const H = 300
const KIRI = 64
const KANAN = 16
const ATAS = 28
const BAWAH = 36
const n = computed(() => props.kategori.length)
/** Drawn 1:1 in pixels (never scaled down, so the text keeps its size): as wide as the
 *  panel, or wider when the columns need it; the wrapper then scrolls sideways. */
const gulung = ref<HTMLElement | null>(null)
const lebarWadah = ref(760)
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => {
    if (gulung.value) lebarWadah.value = gulung.value.clientWidth || 760
  })
  watch(gulung, (el, lama) => {
    if (lama) ro?.unobserve(lama)
    if (el) ro?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => ro?.disconnect())
const W = computed(() => Math.max(lebarWadah.value, KIRI + KANAN + n.value * MIN_KOLOM))
const tinggiDalam = H - ATAS - BAWAH
const pita = computed(() => (W.value - KIRI - KANAN) / Math.max(1, n.value))
const xTengah = (i: number) => KIRI + pita.value * (i + 0.5)
/** Scale from a "nice" step; below zero only when a value is negative (EBIT, EBITDA). */
const skala = computed(() => {
  const maks = Math.max(0, ...props.nilai)
  const min = Math.min(0, ...props.nilai)
  const span = maks - min || 1
  const p = 10 ** Math.floor(Math.log10(span))
  const langkah = [1, 2, 2.5, 5, 10].find(k => k * p * 4 >= span)! * p
  const bawah = Math.floor(min / langkah) * langkah
  const atas = Math.max(bawah + langkah * 4, Math.ceil(maks / langkah) * langkah)
  return { bawah, atas, langkah }
})
const y = (v: number) => ATAS + tinggiDalam * (skala.value.atas - v) / (skala.value.atas - skala.value.bawah || 1)
const garis = computed(() => {
  const out: number[] = []
  for (let v = skala.value.bawah; v <= skala.value.atas + 1e-6; v += skala.value.langkah) out.push(v)
  return out
})
const lebarBatang = computed(() => Math.min(44, pita.value * 0.5))
/** Value labels on top only while they have room. */
const labelDiAtas = computed(() => pita.value >= 70)
const jalur = computed(() => props.nilai.map((v, i) => `${xTengah(i)},${y(v)}`).join(' '))

// ─── tooltip ──
const aktif = ref<number | null>(null)
const ubah = (i: number) => {
  if (i === 0) return null
  const a = props.nilai[i - 1] ?? 0
  const b = props.nilai[i] ?? 0
  if (!a) return null
  const p = (b - a) / Math.abs(a) * 100
  return { naik: p > 0, teks: `${p > 0 ? '▲' : '▼'} ${Math.abs(p).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` }
}
/** Tooltip box, kept inside the VISIBLE part of the chart (also when scrolled sideways). */
const LEBAR_TIP = 240
const TINGGI_TIP = 96
const geserX = ref(0)
const posTip = computed(() => {
  const i = aktif.value
  if (i === null) return null
  const kiriTampak = geserX.value + 8
  const kananTampak = geserX.value + lebarWadah.value - LEBAR_TIP - 8
  let x = xTengah(i) + 14
  if (x > kananTampak) x = xTengah(i) - LEBAR_TIP - 14
  x = Math.min(Math.max(x, kiriTampak), Math.max(kiriTampak, kananTampak))
  const yt = y(props.nilai[i] ?? 0)
  const atas = yt - TINGGI_TIP - 10 >= 0 ? yt - TINGGI_TIP - 10 : Math.min(yt + 14, H - TINGGI_TIP)
  return { kiri: `${x}px`, atas: `${atas}px` }
})
</script>

<template>
  <div>
    <p
      v-if="!n"
      class="text-muted"
    >
      Tidak ada data di rentang ini.
    </p>

    <div
      v-else-if="mode === 'angka'"
      class="overflow-x-auto"
    >
      <table class="w-full text-sm">
        <thead class="text-left text-muted">
          <tr>
            <th class="px-3 py-2">
              Periode
            </th>
            <th class="px-3 py-2 text-right">
              {{ nama }}
            </th>
            <th class="px-3 py-2 text-right">
              Dibanding sebelumnya
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(k, i) in judul"
            :key="k"
            class="border-t border-default"
          >
            <td class="px-3 py-2.5 font-medium">
              {{ k }}
            </td>
            <td class="px-3 py-2.5 text-right font-semibold tabular-nums">
              {{ rupiah(nilai[i] ?? 0) }}
            </td>
            <td
              class="px-3 py-2.5 text-right tabular-nums"
              :class="!!ubah(i)?.naik !== !!naikBaik ? 'text-error' : 'text-success'"
            >
              {{ ubah(i)?.teks ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-else
      ref="gulung"
      class="overflow-x-auto overflow-y-hidden"
      @scroll="geserX = ($event.target as HTMLElement).scrollLeft"
    >
      <div
        class="relative"
        :style="{ width: `${W}px`, height: `${H}px` }"
        @mouseleave="aktif = null"
      >
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          :width="W"
          :height="H"
          class="block"
          role="img"
          :aria-label="`Grafik ${nama} per periode`"
        >
          <g class="text-muted">
            <template
              v-for="g in garis"
              :key="g"
            >
              <line
                :x1="KIRI"
                :x2="W - KANAN"
                :y1="y(g)"
                :y2="y(g)"
                stroke="currentColor"
                stroke-opacity="0.15"
              />
              <text
                :x="KIRI - 10"
                :y="y(g) + 4"
                text-anchor="end"
                font-size="12"
                fill="currentColor"
              >{{ pendek(g) }}</text>
            </template>
          </g>

          <!-- hover column -->
          <rect
            v-if="aktif !== null"
            :x="KIRI + pita * aktif"
            :y="ATAS - 8"
            :width="pita"
            :height="tinggiDalam + 8"
            class="fill-current text-gold"
            fill-opacity="0.08"
            rx="6"
          />

          <template v-if="mode === 'bar'">
            <rect
              v-for="(v, i) in nilai"
              :key="i"
              :x="xTengah(i) - lebarBatang / 2"
              :y="Math.min(y(v), y(0))"
              :width="lebarBatang"
              :height="Math.abs(y(0) - y(v))"
              :fill="v < 0 ? 'var(--ui-error)' : warna"
              :fill-opacity="aktif === null || aktif === i ? 1 : 0.45"
              rx="4"
            />
          </template>
          <template v-else>
            <polyline
              :points="jalur"
              fill="none"
              :stroke="warna"
              stroke-width="2.5"
              stroke-opacity="0.5"
            />
            <circle
              v-for="(v, i) in nilai"
              :key="i"
              :cx="xTengah(i)"
              :cy="y(v)"
              :r="aktif === i ? 7 : 5"
              :fill="warna"
              stroke="white"
              stroke-width="2"
            />
          </template>

          <template v-if="labelDiAtas">
            <text
              v-for="(v, i) in nilai"
              :key="`l${i}`"
              :x="xTengah(i)"
              :y="v < 0 ? y(v) + 16 : y(v) - 8"
              text-anchor="middle"
              font-size="11"
              font-weight="600"
              class="fill-current text-muted"
            >{{ pendek(v) }}</text>
          </template>

          <g class="text-muted">
            <text
              v-for="(k, i) in kategori"
              :key="k"
              :x="xTengah(i)"
              :y="H - BAWAH + 22"
              text-anchor="middle"
              font-size="12"
              :font-weight="aktif === i ? 700 : 400"
              fill="currentColor"
            >{{ k }}</text>
          </g>

          <!-- hit areas: a whole column per period, easy to hover or tap -->
          <rect
            v-for="(_, i) in nilai"
            :key="`h${i}`"
            :x="KIRI + pita * i"
            :y="0"
            :width="pita"
            :height="H"
            fill="transparent"
            class="cursor-pointer"
            @mouseenter="aktif = i"
            @click="aktif = i"
          />
        </svg>

        <div
          v-if="posTip && aktif !== null"
          class="pointer-events-none absolute z-10 w-60 rounded-field bg-default px-3.5 py-2.5 text-sm shadow-panel ring-1 ring-default"
          :style="{ left: posTip.kiri, top: posTip.atas }"
        >
          <p class="font-semibold">
            {{ judul[aktif] }}
          </p>
          <p class="mt-1 flex items-center gap-2">
            <span
              class="size-2.5 rounded-sm"
              :style="{ background: warna }"
            />
            {{ nama }}: <b class="tabular-nums">{{ rupiah(nilai[aktif] ?? 0) }}</b>
          </p>
          <p
            v-if="ubah(aktif)"
            class="mt-1 text-xs"
            :class="ubah(aktif)!.naik !== !!naikBaik ? 'text-error' : 'text-success'"
          >
            {{ ubah(aktif)!.teks }} dibanding {{ judul[aktif - 1] }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
