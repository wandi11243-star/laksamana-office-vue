<!--
  Analytics › Kategori Menu. Turnover per menu category including EVENT,
  separate from the menu ranking (deploy/analytics/index.html:2644
  vKategori). The group cards always count ALL groups; only the table below
  follows the filter.
-->
<script setup lang="ts">
import { useAnalyticsHarian } from '~/composables/useAnalyticsEsb'
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { KAT_TANPA } from '~/utils/analytics-pos'
import { katEventKah } from '~/utils/analytics-agregat'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('kategori'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
// First-load skeleton for the stat cards: while the payload is absent the
// grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !isi.value && (status.value === 'pending' || status.value === 'idle'))
const laporan = computed(() => isi.value?.data.laporan ?? {})
const daftarBulan = computed(() => Object.keys(laporan.value).sort().reverse())
const blnPilih = useState<string | null>('analytics-bln', () => null)
// "Per hari": a picked date replaces the month on this page (HARIAN_VIEW)
const harian = useAnalyticsHarian()
const bulan = computed(() => {
  if (harian.hari.value) return harian.hari.value.slice(0, 7)
  const a = daftarBulan.value
  if (blnPilih.value && a.includes(blnPilih.value)) return blnPilih.value
  return a[0] ?? ''
})
const d = computed(() => (harian.hari.value ? harian.laporanHari.value : (bulan.value ? laporan.value[bulan.value] ?? null : null)))

const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}
const ketLaporan = computed(() => {
  if (!d.value) return ''
  return `${d.value.jenis === 'menu' ? 'Menu Report' : 'Bill Report'} · diunggah ${d.value.diunggah}${d.value.oleh ? ` oleh ${d.value.oleh}` : ''}`
})

interface BarisKat { n: string, qty: number, nilai: number, kel: string, nMenu: number | null }
const semua = computed<BarisKat[]>(() => {
  const lap = d.value
  if (!lap) return []
  const km = lap.katMenu ?? null
  return Object.keys(lap.kategori ?? {}).map(n => ({
    n,
    qty: lap.kategori[n]?.qty ?? 0,
    nilai: lap.kategori[n]?.nilai ?? 0,
    kel: lap.kategori[n]?.kat || KAT_TANPA,
    // Menu count from katMenu, never a stored number of its own. Old months
    // without katMenu show —, NOT 0: zero would claim the category is empty.
    nMenu: km ? Object.keys(km[n] ?? {}).length : null,
  }))
})
const kelOps = computed(() => [...new Set(semua.value.map(x => x.kel))].sort())
const tapisKel = ref('')
const urutKunci = ref('nilai')
watch(bulan, () => {
  tapisKel.value = ''
})
watch(kelOps, (ops) => {
  if (tapisKel.value && !ops.includes(tapisKel.value)) tapisKel.value = ''
})
const daftar = computed(() => {
  const list = (tapisKel.value ? semua.value.filter(x => x.kel === tapisKel.value) : [...semua.value])
  const k = urutKunci.value
  return list.sort((a, x) => k === 'qty'
    ? (x.qty - a.qty) || (x.nilai - a.nilai) || (a.n < x.n ? -1 : 1)
    : k === 'n'
      ? (a.n < x.n ? -1 : 1)
      : (x.nilai - a.nilai) || (x.qty - a.qty) || (a.n < x.n ? -1 : 1))
})
const tot = computed(() => daftar.value.reduce((a, x) => a + x.nilai, 0))
const totQ = computed(() => daftar.value.reduce((a, x) => a + x.qty, 0))
// Group cards count the WHOLE month, never the filtered table.
const atas = computed(() => {
  const m: Record<string, { qty: number, nilai: number, n: number }> = {}
  for (const x of semua.value) {
    const o = m[x.kel] || (m[x.kel] = { qty: 0, nilai: 0, n: 0 })
    o.qty += x.qty
    o.nilai += x.nilai
    o.n++
  }
  const totSemua = semua.value.reduce((a, x) => a + x.nilai, 0)
  return Object.keys(m).sort((a, b) => m[b]!.nilai - m[a]!.nilai).slice(0, 3)
    .map(k => ({ k, ...m[k]!, totSemua }))
})
const kolom: TableColumn<BarisKat>[] = [
  { id: 'no', header: '#' },
  { accessorKey: 'n', header: 'Kategori' },
  { accessorKey: 'kel', header: 'Kelompok' },
  { accessorKey: 'nMenu', header: 'Jumlah Menu' },
  { accessorKey: 'qty', header: 'Porsi' },
  { accessorKey: 'nilai', header: 'Nilai' },
  { accessorKey: 'persen', header: '% omset menu' },
]
const buka = ref('')
const menuKat = computed(() => {
  if (!buka.value || !d.value?.katMenu?.[buka.value]) return []
  const mm = d.value.katMenu[buka.value]!
  return Object.keys(mm).map(n => ({ n, qty: mm[n]!.qty ?? 0, nilai: mm[n]!.nilai ?? 0 }))
    .sort((a, x) => (x.nilai - a.nilai) || (a.n < x.n ? -1 : 1))
})
</script>

<template>
  <AppPage
    title="Kategori Menu"
    description="Omset per kategori menu — termasuk EVENT, terpisah dari peringkat menu"
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
      title="Memuat kategori"
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
      :description="`Hak akses kamu di halaman &quot;Kategori Menu&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <div class="mb-4 flex flex-wrap items-center gap-1.5">
        <span class="text-sm font-semibold">Bulan</span>
        <AppChips
          :model-value="blnPilih"
          :options="daftarBulan.map(b => ({ value: b, label: fmtBln(b) }))"
          @update:model-value="harian.pilihBulan"
        />
        <span class="flex-1" />
        <span class="text-xs text-muted">{{ ketLaporan }}</span>
      </div>

      <AnalyticsHarianPilih />

      <template v-if="harian.hari.value && !d" />
      <div
        v-else-if="!d"
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
        v-else-if="!semua.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan bulan ini belum memuat kategori menu"
        :description="d.jenis === 'menu'
          ? 'Berkasnya memang laporan menu, tapi diunggah sebelum kolom Menu Category Detail ikut dibaca (4 September 2026). Unggah ulang berkas bulan itu — ringkasannya akan ditimpa, dan kategorinya ikut terbaca.'
          : 'Yang diunggah Bill Report, yang tidak memuat nama menu maupun kategorinya. Yang memuat keduanya Sales Recapitulation Detail Report.'"
      />

      <template v-else>
        <AppStatGrid :loading="statMemuat" :count="3">
          <AppStat
            v-for="a in atas"
            :key="a.k"
            :label="a.k"
            :value="rupiah(a.nilai)"
            icon="i-lucide-layout-grid"
            tone="gold"
            :sub="`${a.totSemua ? Math.round(a.nilai / a.totSemua * 100) : 0}% · ${a.n} kategori · ${angka(a.qty)} porsi`"
          />
        </AppStatGrid>

        <AppPanel
          title="Per Kategori"
          description="Dari kolom Menu Category Detail di laporan POS. Tekan kepala kolom untuk mengurutkannya. Klik satu baris untuk melihat menu apa saja yang ada di dalamnya."
          flush
        >
          <div
            v-if="kelOps.length > 1"
            class="flex flex-wrap items-center gap-2 px-4 pt-4"
          >
            <AppSeg
              v-model="urutKunci"
              size="sm"
              :options="[{ value: 'nilai', label: 'Nilai' }, { value: 'qty', label: 'Porsi' }, { value: 'n', label: 'Nama' }]"
            />
            <span class="text-sm font-semibold">Kelompok</span>
            <AppChips
              v-model="tapisKel"
              :options="[{ value: '', label: 'Semua' }, ...kelOps.map(k => ({ value: k, label: k }))]"
            />
          </div>
          <p
            v-if="tapisKel"
            class="px-4 pt-3 text-xs text-muted"
          >
            Tapis kelompok menyaring <b>tabel ini saja</b> — ketiga kartu di atas tetap menghitung seluruh kelompok.
          </p>
          <UTable
            class="hidden lg:block"
            :data="daftar"
            :columns="kolom"
          >
            <template #no-cell="{ row }">
              <span class="text-muted num">{{ row.index + 1 }}</span>
            </template>
            <template #n-cell="{ row }">
              <button
                type="button"
                class="text-left"
                @click="buka = buka === row.original.n ? '' : row.original.n"
              >
                <b>{{ row.original.n }}</b>
                <span
                  v-if="katEventKah(row.original.n)"
                  class="block text-xs text-muted"
                >tidak ikut di Menu &amp; Bahan Baku</span>
              </button>
            </template>
            <template #kel-cell="{ row }">
              <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{{ row.original.kel }}</span>
            </template>
            <template #nMenu-cell="{ row }">
              <span
                v-if="row.original.nMenu === null"
                class="text-muted"
              >—</span>
              <span
                v-else
                class="num"
              >{{ angka(row.original.nMenu) }}</span>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ angka(row.original.qty) }}</span>
            </template>
            <template #nilai-cell="{ row }">
              <span class="num">{{ rupiah(row.original.nilai) }}</span>
            </template>
            <template #persen-cell="{ row }">
              <b class="num">{{ tot ? (row.original.nilai / tot * 100).toFixed(1) : '0.0' }}%</b>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in daftar"
              :key="x.n"
              class="px-4 py-2.5"
            >
              <button
                type="button"
                class="flex w-full items-baseline justify-between gap-2 text-left"
                @click="buka = buka === x.n ? '' : x.n"
              >
                <b class="text-sm">{{ x.n }}</b>
                <b class="num text-sm">{{ tot ? (x.nilai / tot * 100).toFixed(1) : '0.0' }}%</b>
              </button>
              <div class="mt-0.5 text-xs text-muted">
                {{ x.kel }} · {{ x.nMenu === null ? '—' : `${angka(x.nMenu)} menu` }} · {{ angka(x.qty) }} porsi · {{ rupiah(x.nilai) }}
              </div>
              <div
                v-if="buka === x.n && menuKat.length"
                class="mt-2 space-y-1 rounded-panel bg-muted p-2"
              >
                <div
                  v-for="m in menuKat"
                  :key="m.n"
                  class="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span>{{ m.n }}</span>
                  <span class="num text-muted">{{ angka(m.qty) }} · {{ rupiah(m.nilai) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="hidden lg:block">
            <div
              v-if="buka && menuKat.length"
              class="mx-4 mb-4 rounded-panel bg-muted p-3"
            >
              <p class="mb-2 text-xs font-semibold">
                Menu di {{ buka }}
              </p>
              <div class="space-y-1">
                <div
                  v-for="m in menuKat"
                  :key="m.n"
                  class="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span>{{ m.n }}</span>
                  <span class="num text-muted">{{ angka(m.qty) }} porsi · {{ rupiah(m.nilai) }}</span>
                </div>
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Total {{ rupiah(tot) }} dari {{ angka(totQ) }} porsi. Kolom persen berjumlah 100%.
          </p>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
