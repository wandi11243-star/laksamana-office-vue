<!--
  Analytics › Tren Bulanan. Month-to-month turnover plus a free two-month
  comparison (deploy/analytics/index.html:6288 vTren). The old Chart.js graph
  is drawn as AppBar rows (no new dependency): bars carry Grand Total, the
  per-day average is named on each row. Menu Report months carry no per-bill
  value, so they are listed, not charted as zero.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('tren'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
// First-load skeleton for the stat cards: while the payload is absent the
// grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !isi.value && (status.value === 'pending' || status.value === 'idle'))
const laporan = computed(() => isi.value?.data.laporan ?? {})

const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}

interface BarisTren { b: string, jenis: string, grand: number, bill: number, hari: number, perBill: number, perHari: number }
const semua = computed<BarisTren[]>(() => Object.keys(laporan.value).sort().map((b) => {
  const lap = laporan.value[b]!
  const r = lap.ringkas ?? { bill: 0, grand: 0 }
  const nHari = Object.keys(lap.hari ?? {}).length
  const grand = r.grand ?? 0
  const bill = r.bill ?? 0
  return {
    b, jenis: lap.jenis ?? 'bill', grand, bill, hari: nHari,
    perBill: bill ? grand / bill : 0, perHari: nHari ? grand / nHari : 0,
  }
}))
const pakai = computed(() => semua.value.filter(x => x.grand > 0))
const kosong = computed(() => semua.value.filter(x => !(x.grand > 0)))
const totalSemua = computed(() => pakai.value.reduce((a, x) => a + x.grand, 0))
const terbaik = computed(() => pakai.value.slice().sort((a, x) => x.grand - a.grand)[0] ?? null)
const akhir = computed(() => pakai.value[pakai.value.length - 1] ?? null)
const sebelum = computed(() => pakai.value[pakai.value.length - 2] ?? null)
const tumbuh = computed(() => {
  const a = akhir.value
  const s = sebelum.value
  if (!a || !s || !s.grand) return null
  return (a.grand - s.grand) / s.grand * 100
})
const punTren = computed(() => Math.max(...pakai.value.map(x => x.grand), 1))

interface BarisTabel extends BarisTren { delta: number | null }
const tabel = computed<BarisTabel[]>(() => {
  const urut = semua.value.slice().reverse()
  return urut.map((x, i) => {
    const sb = urut[i + 1]
    const dlt = sb && sb.grand ? (x.grand - sb.grand) / sb.grand * 100 : null
    return { ...x, delta: dlt }
  })
})
const kolomTabel: TableColumn<BarisTabel>[] = [
  { accessorKey: 'b', header: 'Bulan' },
  { accessorKey: 'grand', header: 'Grand Total' },
  { accessorKey: 'delta', header: 'Δ bulan sebelumnya' },
  { accessorKey: 'bill', header: 'Bill' },
  { accessorKey: 'hari', header: 'Hari' },
  { accessorKey: 'perBill', header: 'Rata-rata/bill' },
  { accessorKey: 'perHari', header: 'Rata-rata/hari' },
]

/* Free comparison of any two months (old TREN_A/TREN_B). Defaults: the two
   newest stored months; selecting the same month twice is allowed and says so. */
const bandingA = ref('')
const bandingB = ref('')
watch(semua, (list) => {
  const opsi = list.map(x => x.b)
  if (opsi.length && !opsi.includes(bandingA.value)) bandingA.value = opsi[opsi.length - 1] ?? ''
  if (opsi.length > 1 && !opsi.includes(bandingB.value)) bandingB.value = opsi[opsi.length - 2] ?? ''
}, { immediate: true })
const ra = computed(() => semua.value.find(x => x.b === bandingA.value) ?? null)
const rb = computed(() => semua.value.find(x => x.b === bandingB.value) ?? null)
interface BarisBanding { uraian: string, a: number, b: number, uang: boolean }
const barisBanding = computed<BarisBanding[]>(() => {
  if (!ra.value || !rb.value) return []
  return [
    { uraian: 'Grand Total', a: ra.value.grand, b: rb.value.grand, uang: true },
    { uraian: 'Jumlah bill', a: ra.value.bill, b: rb.value.bill, uang: false },
    { uraian: 'Hari ada transaksi', a: ra.value.hari, b: rb.value.hari, uang: false },
    { uraian: 'Rata-rata per bill', a: ra.value.perBill, b: rb.value.perBill, uang: true },
    { uraian: 'Rata-rata per hari', a: ra.value.perHari, b: rb.value.perHari, uang: true },
  ]
})
const fmtNilai = (v: number, uang: boolean) => uang ? rupiah(v) : angka(Math.round(v))
const pctBanding = (a: number, b: number) => b ? (a - b) / b * 100 : null
</script>

<template>
  <AppPage
    title="Tren Bulanan"
    description="Total omset bulan ke bulan, dan perbandingan dua bulan"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </template>

    <AppPanel
      v-if="status === 'pending' && !isi"
      title="Memuat tren"
    >
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !isi">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tidak bisa membaca data analytics"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
    </div>

    <UAlert
      v-else-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman &quot;Tren Bulanan&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <div
        v-if="!semua.length"
        class="rounded-panel border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada laporan yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Sales Recapitulation</i> dari POS.
        </p>
      </div>

      <UAlert
        v-else-if="semua.length === 1"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Baru satu bulan yang diunggah"
        :description="`Tren bulan ke bulan baru bisa digambar mulai bulan kedua — unggah laporan bulan lain lewat Unggah Laporan. Bulan yang ada: ${fmtBln(semua[0]!.b)}.`"
      />

      <template v-else>
        <AppStatGrid :loading="statMemuat" :count="4">
          <AppStat
            label="Bulan Terunggah"
            :value="angka(semua.length)"
            icon="i-lucide-calendar-days"
            tone="gold"
            :sub="`${angka(pakai.length)} punya omset`"
          />
          <AppStat
            label="Rata-rata per Bulan"
            :value="rupiah(pakai.length ? totalSemua / pakai.length : 0)"
            icon="i-lucide-chart-line"
            tone="info"
            :sub="`dari ${angka(pakai.length)} bulan`"
          />
          <AppStat
            label="Bulan Tertinggi"
            :value="terbaik ? rupiah(terbaik.grand) : '—'"
            icon="i-lucide-trophy"
            tone="success"
            :sub="terbaik ? fmtBln(terbaik.b) : 'belum ada'"
          />
          <AppStat
            label="Bulan Terakhir vs Sebelumnya"
            :value="tumbuh === null ? '—' : `${tumbuh >= 0 ? '+' : ''}${tumbuh.toFixed(1)}%`"
            icon="i-lucide-scale"
            tone="info"
            :sub="sebelum && akhir ? `${fmtBln(akhir.b)} vs ${fmtBln(sebelum.b)}` : 'belum ada pembanding'"
          />
        </AppStatGrid>

        <AppPanel
          title="Total Omset Bulan ke Bulan"
          description="Grand Total dari berkas POS tiap bulan. Angka kecil di tiap barisnya rata-rata per hari — bulan yang harinya lebih sedikit (bulan berjalan, atau berkas yang tidak sebulan penuh) terlihat rendah di batangnya padahal tidak di garisnya."
        >
          <AppBar
            v-for="x in pakai"
            :key="x.b"
            :label="fmtBln(x.b)"
            :value="`${rupiah(x.grand)} · ${rupiah(x.perHari)}/hari`"
            :persen="Math.round(x.grand / punTren * 100)"
            tone="gold"
          />
          <p
            v-if="kosong.length"
            class="mt-2 text-xs text-muted"
          >
            {{ kosong.length }} bulan tidak punya Grand Total ({{ kosong.map(x => fmtBln(x.b)).join(', ') }}) — laporannya Menu Report, yang memang tidak memuat nilai per bill. Bulan itu tidak ikut di grafik.
          </p>
        </AppPanel>

        <AppPanel
          title="Perbandingan Bulan ke Bulan"
          description="Tiap bulan dibandingkan dengan bulan tepat sebelumnya."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="tabel"
            :columns="kolomTabel"
          >
            <template #b-cell="{ row }">
              <b>{{ fmtBln(row.original.b) }}</b>
              <span
                v-if="row.original.jenis === 'menu'"
                class="block text-xs text-muted"
              >Menu Report</span>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(row.original.grand) }}</span>
            </template>
            <template #delta-cell="{ row }">
              <b
                v-if="row.original.delta !== null"
                class="num"
                :class="row.original.delta >= 0 ? 'text-success' : 'text-error'"
              >{{ row.original.delta >= 0 ? '+' : '' }}{{ row.original.delta.toFixed(1) }}%</b>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #hari-cell="{ row }">
              <span class="num">{{ angka(row.original.hari) }}</span>
            </template>
            <template #perBill-cell="{ row }">
              <span class="num">{{ rupiah(row.original.perBill) }}</span>
            </template>
            <template #perHari-cell="{ row }">
              <span class="num">{{ rupiah(row.original.perHari) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in tabel"
              :key="x.b"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ fmtBln(x.b) }}</b>
                <b
                  v-if="x.delta !== null"
                  class="num text-sm"
                  :class="x.delta >= 0 ? 'text-success' : 'text-error'"
                >{{ x.delta >= 0 ? '+' : '' }}{{ x.delta.toFixed(1) }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ rupiah(x.grand) }} · {{ angka(x.bill) }} bill · {{ angka(x.hari) }} hari
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Bandingkan Dua Bulan"
          description="Tabel di atas membandingkan dengan bulan tepat sebelumnya. Yang ini bebas — mis. bulan yang sama tahun lalu."
        >
          <AppFilterGrid>
            <UFormField label="Bulan A">
              <USelect
                v-model="bandingA"
                :items="semua.map(x => ({ label: fmtBln(x.b), value: x.b }))"
              />
            </UFormField>
            <UFormField label="Bulan B (pembanding)">
              <USelect
                v-model="bandingB"
                :items="semua.map(x => ({ label: fmtBln(x.b), value: x.b }))"
              />
            </UFormField>
          </AppFilterGrid>
          <UAlert
            v-if="bandingA === bandingB"
            class="mt-3"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="Kedua kotaknya bulan yang sama"
            description="Selisihnya nol. Pilih bulan yang berbeda."
          />
          <template v-else-if="ra && rb">
            <UTable
              class="mt-3 hidden lg:block"
              :data="barisBanding"
              :columns="[{ accessorKey: 'uraian', header: '' }, { accessorKey: 'a', header: fmtBln(ra.b) }, { accessorKey: 'b', header: fmtBln(rb.b) }, { accessorKey: 's', header: 'Selisih' }, { accessorKey: 'p', header: '%' }]"
            >
              <template #uraian-cell="{ row }">
                {{ row.original.uraian }}
              </template>
              <template #a-cell="{ row }">
                <span class="num">{{ fmtNilai(row.original.a, row.original.uang) }}</span>
              </template>
              <template #b-cell="{ row }">
                <span class="num">{{ fmtNilai(row.original.b, row.original.uang) }}</span>
              </template>
              <template #s-cell="{ row }">
                <span class="num">{{ (row.original.a - row.original.b >= 0 ? '+' : '−') }}{{ fmtNilai(Math.abs(row.original.a - row.original.b), row.original.uang) }}</span>
              </template>
              <template #p-cell="{ row }">
                <b
                  v-if="pctBanding(row.original.a, row.original.b) !== null"
                  class="num"
                  :class="pctBanding(row.original.a, row.original.b)! >= 0 ? 'text-success' : 'text-error'"
                >{{ pctBanding(row.original.a, row.original.b)! >= 0 ? '+' : '' }}{{ pctBanding(row.original.a, row.original.b)!.toFixed(1) }}%</b>
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </template>
            </UTable>
            <div class="mt-3 divide-y divide-default rounded-panel border border-default lg:hidden">
              <div
                v-for="r in barisBanding"
                :key="r.uraian"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-sm">{{ r.uraian }}</span>
                  <b
                    v-if="pctBanding(r.a, r.b) !== null"
                    class="num text-sm"
                    :class="pctBanding(r.a, r.b)! >= 0 ? 'text-success' : 'text-error'"
                  >{{ pctBanding(r.a, r.b)! >= 0 ? '+' : '' }}{{ pctBanding(r.a, r.b)!.toFixed(1) }}%</b>
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ fmtNilai(r.a, r.uang) }} vs {{ fmtNilai(r.b, r.uang) }}
                </div>
              </div>
            </div>
          </template>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
