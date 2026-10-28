<!--
  Investor Compass › Ringkasan. Monthly and daily omset, target reach, and the
  year-over-year comparison — all in `netSales`, the same convention as the
  Laba Rugi tab (investor/index.html:600-615, CLAUDE.md:11244-11247).

  Layout follows the old tab (:470-503): KPI cards + source note, the monthly
  chart with its year toggle, then Sorotan full-width. The "Omset Harian"
  chart was removed 29 Aug 2026 — its numbers still feed Sorotan, so `harian`
  is read but never drawn as a chart.
-->
<script setup lang="ts">
import { useInvestorSummary } from '~/composables/useInvestor'
import { BLN, angka, rupiah, tglPanjang } from '~/utils/format'
import { blnPanjang, deltaPersen, ketPajak, rpSumbu } from '~/utils/investor'

definePageMeta({ access: ['investor'] })

const { data: balasan, status, error, refresh } = useInvestorSummary()
const ringkas = computed(() => balasan.value?.data ?? null)

const bi = computed(() => ringkas.value?.bulanIni ?? null)
const bl = computed(() => ringkas.value?.bulanLalu ?? null)
const adaData = computed(() => !!ringkas.value?.adaData)

/** This month against last month by average per filled day, never by totals:
 *  the 3rd against a full month always reads "down 90%". Last month only
 *  counts when it is full enough to be called a month (7 filled days): a
 *  single Rp 70 jt test row must never become a "▼ 70%" on this screen. */
const AMBANG_HARI = 7
const rataIni = computed(() => bi.value?.hariTerisi ? Number(bi.value.netSales || 0) / bi.value.hariTerisi : null)
const rataLalu = computed(() => (bl.value?.hariTerisi ?? 0) >= AMBANG_HARI ? Number(bl.value?.netSales || 0) / (bl.value?.hariTerisi || 1) : null)
const delta = computed(() => deltaPersen(rataIni.value, rataLalu.value))
const target = computed(() => Number(bi.value?.target || 0))
const pctTarget = computed(() => target.value > 0 ? Math.round(Number(bi.value?.netSales || 0) / target.value * 100) : null)
const trx = computed(() => Number(bi.value?.transaksi || 0))
const ket = computed(() => ketPajak(bi.value, rupiah))
const terakhirTeks = computed(() => ringkas.value?.terakhir ? tglPanjang(ringkas.value.terakhir) : '—')

// --- year-over-year chart -------------------------------------------------
// One SVG line per year (no chart dependency): points carry <title> with the
// full rupiah figure; the Y axis alone uses the short form (rpSumbu).
const tahunSemua = computed(() => Object.keys(ringkas.value?.tahunan ?? {}).sort())
const tahunAktif = ref<Set<string>>(new Set())
watch(tahunSemua, v => (tahunAktif.value = new Set(v)), { immediate: true })
const alihTahun = (y: string) => {
  const s = new Set(tahunAktif.value)
  if (s.has(y)) {
    if (s.size > 1) s.delete(y)
  }
  else s.add(y)
  tahunAktif.value = s
}
// The last visible year stays locked: switching everything off would draw
// an empty chart. The pill is disabled with its reason (see template) so a
// tap that does nothing never reads as broken.
// Line colours from the token palette (no hex in components).
const WARNA_TAHUN = ['text-ink-900', 'text-success', 'text-info', 'text-ink-900', 'text-warning', 'text-error']
const warnaTahun = (y: string) => WARNA_TAHUN[Math.max(0, tahunSemua.value.indexOf(y)) % WARNA_TAHUN.length]

const W = 600
const H = 230
const KIRI = 52
const BAWAH = 24
const ATAS = 10
const maksY = computed(() => {
  let m = 0
  for (const y of tahunAktif.value) for (const v of ringkas.value?.tahunan[y] ?? []) if (v != null && v > m) m = v
  return m > 0 ? m : 1
})
const xBulan = (i: number) => KIRI + (i * (W - KIRI - 8)) / 11
const yNilai = (v: number) => ATAS + (1 - v / maksY.value) * (H - ATAS - BAWAH)
/** Split a year into drawn segments so months without data leave a gap. */
const segmen = (y: string): { x1: number, y1: number, x2: number, y2: number }[][] => {
  const arr = ringkas.value?.tahunan[y] ?? []
  const out: { x1: number, y1: number, x2: number, y2: number }[][] = []
  let jalan: { x: number, y: number }[] = []
  const siram = () => {
    if (jalan.length > 1) {
      const seg: { x1: number, y1: number, x2: number, y2: number }[] = []
      for (let i = 1; i < jalan.length; i++) seg.push({ x1: jalan[i - 1]!.x, y1: jalan[i - 1]!.y, x2: jalan[i]!.x, y2: jalan[i]!.y })
      out.push(seg)
    }
    jalan = []
  }
  arr.forEach((v, i) => {
    if (v == null) siram()
    else jalan.push({ x: xBulan(i), y: yNilai(v) })
  })
  siram()
  return out
}
const garisY = computed(() => [0, 1, 2, 3].map(i => maksY.value * i / 3))

// --- Sorotan ----------------------------------------------------------------
// Best day and average of the RUNNING month (not all-time, not a 30-day
// window: neither can be matched against the cards beside it), the target
// gap, and how many years the chart can compare.
const sorotan = computed(() => {
  const items: { icon: string, t: string, s: string }[] = []
  const kunci = bi.value?.kunci ?? ''
  const isi = (ringkas.value?.harian ?? []).filter(h => h.omset != null && String(h.tgl).slice(0, 7) === kunci)
  if (isi.length) {
    const best = isi.reduce((a, b) => ((b.omset ?? 0) > (a.omset ?? 0) ? b : a))
    items.push({ icon: 'i-lucide-trophy', t: `Hari terbaik ${rupiah(best.omset)}`, s: `${tglPanjang(best.tgl)} · ${blnPanjang(kunci)}` })
    const rata = isi.reduce((a, b) => a + (b.omset ?? 0), 0) / isi.length
    items.push({ icon: 'i-lucide-chart-column', t: `Rata-rata ${rupiah(rata)} / hari`, s: `${isi.length} hari terisi di ${blnPanjang(kunci)}` })
  }
  const nilai = Number(bi.value?.netSales || 0)
  if (target.value > 0) {
    const sisa = target.value - nilai
    items.push(sisa > 0
      ? { icon: 'i-lucide-target', t: `Kurang ${rupiah(sisa)} dari target`, s: `target ${blnPanjang(bi.value?.kunci)} ${rupiah(target.value)}` }
      : { icon: 'i-lucide-party-popper', t: `Target ${blnPanjang(bi.value?.kunci)} tercapai`, s: `lebih ${rupiah(-sisa)} dari target` })
  }
  else {
    items.push({ icon: 'i-lucide-target', t: 'Target bulanan belum disetel', s: 'disetel di Finance — Dashboard Omset' })
  }
  const th = Object.keys(ringkas.value?.tahunan ?? {})
  if (th.length > 1) items.push({ icon: 'i-lucide-trending-up', t: `Data ${th.length} tahun tersedia`, s: `${th.sort().join(' · ')} — lihat grafik omset per bulan` })
  return items
})
</script>

<template>
  <AppPage
    title="Ringkasan"
    description="Omset harian dan bulanan, capaian target, dan perbandingan tahun ke tahun"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat angka omset"
    >
      <p class="text-sm text-muted">
        Mengambil data dari Laksamana Office…
      </p>
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !ringkas">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tidak bisa membaca angka omset"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
      <UButton
        label="Muat ulang"
        color="error"
        variant="soft"
        class="mt-3"
        @click="() => refresh()"
      />
    </div>

    <AppPanel
      v-else-if="!adaData"
      title="Belum ada omset yang tercatat"
    >
      <p class="text-sm text-muted">
        Angka di halaman ini datang dari <b>Input Omset Harian</b> di modul Finance — Dashboard Omset. Begitu satu hari diisi, angkanya muncul di sini.
      </p>
    </AppPanel>

    <template v-else>
      <AppStatGrid>
        <AppStat
          :label="`Omset ${blnPanjang(bi?.kunci)}`"
          :value="rupiah(bi?.netSales)"
          icon="i-lucide-banknote"
          tone="gold"
        >
          <span
            v-if="delta !== null"
            class="block font-semibold"
            :class="delta >= 0 ? 'text-success' : 'text-error'"
          >
            {{ delta >= 0 ? '▲' : '▼' }} {{ Math.abs(delta).toFixed(1).replace('.', ',') }}%
            <span class="font-normal text-muted">rata-rata/hari vs {{ blnPanjang(bl?.kunci) }}</span>
          </span>
          <span
            v-if="target > 0"
            class="block"
          >{{ pctTarget }}% dari target {{ rupiah(target) }}</span>
          <span
            v-else
            class="block"
          >Target bulanan belum disetel</span>
          <span
            v-if="ket"
            class="block"
          >{{ ket }}</span>
        </AppStat>
        <AppStat
          :label="`Transaksi ${blnPanjang(bi?.kunci)}`"
          :value="trx ? angka(trx) : '—'"
          icon="i-lucide-receipt"
          tone="info"
          :sub="trx ? 'struk terhitung' : 'Jumlah bill belum diisi'"
        />
        <AppStat
          label="Rata-rata / Transaksi"
          :value="trx > 0 ? rupiah(Number(bi?.netSales || 0) / trx) : '—'"
          icon="i-lucide-calculator"
          tone="success"
          :sub="trx > 0 ? 'bulan berjalan' : 'butuh jumlah bill'"
        />
      </AppStatGrid>
      <p class="mb-5 text-[13px] text-muted">
        Angka <b>Net Sales</b> (after tax &amp; service, sesudah compliment) — sama dengan tab Laporan Laba Rugi · data terakhir diisi <b>{{ terakhirTeks }}</b>
      </p>

      <AppPanel
        title="Omset per bulan"
        icon="i-lucide-chart-line"
        description="Perbandingan tahun ke tahun"
      >
        <template #actions>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="y in tahunSemua"
              :key="y"
              :label="y"
              size="xs"
              :variant="tahunAktif.has(y) ? 'solid' : 'soft'"
              :disabled="tahunAktif.size === 1 && tahunAktif.has(y)"
              :title="tahunAktif.size === 1 && tahunAktif.has(y) ? 'Satu-satunya tahun yang tampil — mematikannya akan mengosongkan grafik' : `Tampilkan atau sembunyikan tahun ${y}`"
              @click="alihTahun(y)"
            />
          </div>
        </template>
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          class="w-full"
          role="img"
          aria-label="Grafik omset per bulan"
        >
          <g class="text-muted">
            <g
              v-for="(g, i) in garisY"
              :key="i"
            >
              <line
                :x1="KIRI"
                :x2="W"
                :y1="yNilai(g)"
                :y2="yNilai(g)"
                stroke="currentColor"
                stroke-width="1"
                opacity="0.35"
              />
              <text
                :x="KIRI - 6"
                :y="yNilai(g) + 4"
                text-anchor="end"
                font-size="10"
                fill="currentColor"
              >
                {{ rpSumbu(g) }}
              </text>
            </g>
            <text
              v-for="(_, i) in BLN"
              :key="i"
              :x="xBulan(i)"
              :y="H - 6"
              text-anchor="middle"
              font-size="10"
              fill="currentColor"
            >
              {{ BLN[i] }}
            </text>
          </g>
          <g
            v-for="y in tahunSemua.filter(t => tahunAktif.has(t))"
            :key="y"
            :class="warnaTahun(y)"
          >
            <g
              v-for="(seg, s) in segmen(y)"
              :key="s"
            >
              <line
                v-for="(l, k) in seg"
                :key="k"
                :x1="l.x1"
                :y1="l.y1"
                :x2="l.x2"
                :y2="l.y2"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </g>
            <circle
              v-for="(v, i) in (ringkas?.tahunan[y] ?? [])"
              :key="i"
              :cx="xBulan(i)"
              :cy="v == null ? 0 : yNilai(v)"
              r="3.5"
              fill="currentColor"
              :opacity="v == null ? 0 : 1"
            >
              <title v-if="v != null">{{ y }} · {{ BLN[i] }}: {{ rupiah(v) }}</title>
            </circle>
          </g>
        </svg>
        <p class="mt-1 text-[13px] text-muted">
          Arahkan ke titik untuk angka pastinya. Bentuk singkat hanya untuk sumbu — angka uang selalu penuh.
        </p>
        <p
          v-if="tahunSemua.length < 2"
          class="mt-1 text-[13px] text-muted"
        >
          Hanya tahun {{ tahunSemua[0] }} yang ada datanya — pil tahun dikunci sampai ada data tahun lain.
        </p>
      </AppPanel>

      <AppPanel
        title="Sorotan"
        icon="i-lucide-sparkles"
      >
        <AppList>
          <AppListRow
            v-for="(x, i) in sorotan"
            :key="i"
            :icon="x.icon"
            :title="x.t"
            :description="x.s"
          />
        </AppList>
      </AppPanel>
    </template>
  </AppPage>
</template>
