<!--
  Multi-series trend chart for Konten (Pertumbuhan, Iklan). Line, bar or
  plain numbers; hover/tap a column for its values. Drawn 1:1 in pixels and
  scrolls sideways when there are many columns, like the Laba Rugi chart.
-->
<script setup lang="ts">
export interface SeriTren { nama: string, warna: string, nilai: (number | null)[] }

const props = withDefaults(defineProps<{
  kategori: string[]
  seri: SeriTren[]
  mode?: 'garis' | 'batang' | 'angka'
  format?: (n: number) => string
  tinggi?: number
  /** false = the axis starts near the lowest value (running totals like follower). */
  nol?: boolean
}>(), { nol: true, mode: 'garis', tinggi: 220, format: (n: number) => n.toLocaleString('id-ID') })

const KIRI = 56
const ATAS = 12
const BAWAH = 28
const lebarKolom = computed(() => props.mode === 'batang' ? Math.max(28, props.seri.length * 14 + 14) : 44)
const lebar = computed(() => KIRI + Math.max(1, props.kategori.length) * lebarKolom.value + 12)
const semuaNilai = computed(() => props.seri.flatMap(s => s.nilai.filter((v): v is number => v != null)))
const minim = computed(() => {
  const m = Math.min(0, ...semuaNilai.value)
  if (props.nol || !semuaNilai.value.length) return m
  const lo = Math.min(...semuaNilai.value), hi = Math.max(...semuaNilai.value)
  const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, hi - lo))))
  return Math.max(0, Math.floor(lo / p) * p - p)
})
const maks = computed(() => {
  const m = Math.max(0, ...semuaNilai.value)
  if (m <= 0) return 1
  if (!props.nol) {
    const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, m - minim.value))))
    return Math.ceil(m / p) * p + p
  }
  const p = 10 ** Math.floor(Math.log10(m))
  return Math.ceil(m / p) * p
})
const tinggiPlot = computed(() => props.tinggi - ATAS - BAWAH)
const y = (v: number) => ATAS + tinggiPlot.value * (1 - (Math.max(v, minim.value) - minim.value) / (maks.value - minim.value || 1))
const x = (i: number) => KIRI + lebarKolom.value * (i + 0.5)
const garisBantu = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => minim.value + (maks.value - minim.value) * f))
const pendek = (n: number) => {
  const a = Math.abs(n)
  const f = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: v < 10 ? 1 : 0 })
  if (a >= 1e9) return `${n < 0 ? '-' : ''}${f(a / 1e9)} M`
  if (a >= 1e6) return `${n < 0 ? '-' : ''}${f(a / 1e6)} jt`
  if (a >= 1e3) return `${n < 0 ? '-' : ''}${f(a / 1e3)} rb`
  return f(n)
}
const titik = (s: SeriTren) => {
  // a null breaks the line instead of being drawn as zero
  const out: string[][] = [[]]
  s.nilai.forEach((v, i) => {
    if (v == null) {
      if (out.at(-1)!.length) out.push([])
    }
    else { out.at(-1)!.push(`${x(i)},${y(v)}`) }
  })
  return out.filter(p => p.length).map(p => p.join(' '))
}
const labelTiap = computed(() => Math.max(1, Math.ceil(props.kategori.length / Math.max(1, Math.floor(lebar.value / 64)))))
const sorot = ref(-1)
</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span
        v-for="s in seri"
        :key="s.nama"
        class="inline-flex items-center gap-1.5"
      ><i
        class="inline-block size-2.5 rounded-full"
        :style="{ background: s.warna }"
      />{{ s.nama }}</span>
    </div>
    <div
      v-if="mode === 'angka'"
      class="overflow-x-auto"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-muted">
            <th class="py-1.5 pr-3 font-medium">
              Periode
            </th>
            <th
              v-for="s in seri"
              :key="s.nama"
              class="py-1.5 pr-3 text-right font-medium"
            >
              {{ s.nama }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(k, i) in kategori"
            :key="k"
            class="border-t border-default"
          >
            <td class="py-1.5 pr-3 whitespace-nowrap">
              {{ k }}
            </td>
            <td
              v-for="s in seri"
              :key="s.nama"
              class="py-1.5 pr-3 text-right tabular-nums"
            >
              {{ s.nilai[i] == null ? '–' : format(s.nilai[i]!) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-else
      class="relative overflow-x-auto"
    >
      <svg
        :width="lebar"
        :height="tinggi"
        class="block max-w-none"
        role="img"
        :aria-label="seri.map(s => s.nama).join(', ')"
        @mouseleave="sorot = -1"
      >
        <g class="text-muted">
          <template
            v-for="g in garisBantu"
            :key="g"
          >
            <line
              :x1="KIRI"
              :x2="lebar - 8"
              :y1="y(g)"
              :y2="y(g)"
              stroke="currentColor"
              stroke-opacity=".15"
            />
            <text
              :x="KIRI - 6"
              :y="y(g) + 4"
              text-anchor="end"
              font-size="11"
              fill="currentColor"
            >{{ pendek(g) }}</text>
          </template>
          <template
            v-for="(k, i) in kategori"
            :key="k"
          >
            <text
              v-if="i % labelTiap === 0"
              :x="x(i)"
              :y="tinggi - 8"
              text-anchor="middle"
              font-size="11"
              fill="currentColor"
            >{{ k }}</text>
          </template>
        </g>
        <rect
          v-if="sorot >= 0"
          :x="x(sorot) - lebarKolom / 2"
          :y="ATAS"
          :width="lebarKolom"
          :height="tinggiPlot"
          class="fill-current text-primary"
          fill-opacity=".08"
        />
        <template v-if="mode === 'garis'">
          <g
            v-for="s in seri"
            :key="s.nama"
          >
            <polyline
              v-for="(p, j) in titik(s)"
              :key="j"
              :points="p"
              fill="none"
              :stroke="s.warna"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <template
              v-for="(v, i) in s.nilai"
              :key="i"
            >
              <circle
                v-if="v != null && (sorot === i || kategori.length <= 31)"
                :cx="x(i)"
                :cy="y(v)"
                :r="sorot === i ? 5 : 3"
                :fill="s.warna"
              />
            </template>
          </g>
        </template>
        <template v-else>
          <template
            v-for="(s, si) in seri"
            :key="s.nama"
          >
            <template
              v-for="(v, i) in s.nilai"
              :key="i"
            >
              <rect
                v-if="v != null"
                :x="x(i) - (seri.length * 12) / 2 + si * 12 + 1"
                :y="Math.min(y(v), y(0))"
                width="10"
                :height="Math.max(1, Math.abs(y(0) - y(v)))"
                rx="2"
                :fill="s.warna"
              />
            </template>
          </template>
        </template>
        <rect
          v-for="(k, i) in kategori"
          :key="'h' + k"
          :x="x(i) - lebarKolom / 2"
          :y="0"
          :width="lebarKolom"
          :height="tinggi"
          fill="transparent"
          @mouseenter="sorot = i"
          @click="sorot = i"
        />
      </svg>
      <div
        v-if="sorot >= 0"
        class="pointer-events-none absolute top-2 z-10 rounded-lg border border-default bg-default px-3 py-2 text-xs shadow-lg"
        :style="{ left: Math.min(x(sorot) + 12, lebar - 180) + 'px' }"
      >
        <b class="mb-1 block text-highlighted">{{ kategori[sorot] }}</b>
        <span
          v-for="s in seri"
          :key="s.nama"
          class="flex items-center justify-between gap-4"
        >
          <span class="inline-flex items-center gap-1.5"><i
            class="inline-block size-2 rounded-full"
            :style="{ background: s.warna }"
          />{{ s.nama }}</span>
          <b class="tabular-nums">{{ s.nilai[sorot] == null ? '–' : format(s.nilai[sorot]!) }}</b>
        </span>
      </div>
    </div>
  </div>
</template>
