<!--
  Konten › Ads Management (old VIEWS.ads, deploy/konten/index.html:3755-3883,
  forms :4152-4266; konten.md D.15).

  Order as the old page: brand bar → 4 cards (Iklan Aktif, Total Dana Masuk,
  Total Dana Keluar incl. PPN, Sisa Dana brand ini) → Sisa Dana Keseluruhan
  (all brands, all time) → Report per bulan (+ CSV export per month) → Dana
  Keluar (ads: filters, table, inline status) → Dana Masuk (funds).
  Money rules in promosi-konten.ts (start month, 11% VAT, no-date bucket).
  Statuses follow the dates once per session (useStatusIklanOtomatis).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { DanaIklan, FilterIklan, IklanKonten } from '~/utils/promosi-konten'
import {
  ADS_PLATFORMS, ADS_STATUS, ADS_TANPA_TGL, bulanIklan, csvBulanIklan, danaKeluarIklan, filterIklanBawaan, iklanPakaiCadangan, labelBulanIklan,
  platformVideo, rapikanVideo, rekapBulanIklan, saringIklan, tglDanaIklan,
} from '~/utils/promosi-konten'
import { angka, fTgl, fTglP, rupiah } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()
const toast = useToast()
useStatusIklanOtomatis()

const adsScope = computed(() => saringBrand(st.value.ads, brand.value))
const fundScope = computed(() => saringBrand(st.value.adFunds, brand.value))
const totIn = computed(() => fundScope.value.reduce((s, x) => s + (Number(x.amount) || 0), 0))
const totOut = computed(() => adsScope.value.reduce((s, a) => s + danaKeluarIklan(a), 0))
const aktif = computed(() => adsScope.value.filter(a => a.status === 'active').length)
const allIn = computed(() => st.value.adFunds.reduce((s, x) => s + (Number(x.amount) || 0), 0))
const allOut = computed(() => st.value.ads.reduce((s, a) => s + danaKeluarIklan(a), 0))

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? '-'

// ---- report per month
const bulan = computed(() => rekapBulanIklan(fundScope.value, adsScope.value))
const halB = useState('konten-ads-bln-hal', () => 1)
const perB = useState('konten-ads-bln-per', () => 10)
watch(brand, () => {
  halB.value = 1
})
const halamanB = computed(() => bulan.value.slice((halB.value - 1) * perB.value, halB.value * perB.value))
type BarisBulan = typeof bulan.value[number]
function ekspor(ym: string) {
  // the export uses ALL brands' rows of that month, like the old one
  const csv = csvBulanIklan(ym, st.value.adFunds, st.value.ads, namaBrand)
  if (!csv) return toast.add({ title: 'Tidak ada data pada bulan ini', color: 'error' })
  unduhKonten(`COMS_ads_${ym}.csv`, csv, 'text/csv')
  logKonten('ekspor laporan ads', labelBulanIklan(ym)).catch(() => {})
}
const R = { th: 'text-right', td: 'text-right' }
const kolomB: TableColumn<BarisBulan>[] = [
  { id: 'bulan', header: 'Bulan' },
  { id: 'in', header: 'Dana masuk', meta: { class: R } },
  { id: 'out', header: 'Dana keluar', meta: { class: R } },
  { id: 'sisa', header: 'Sisa (bulan)', meta: { class: R } },
  { id: 'aksi', header: 'Reporting', meta: { class: R } },
]

// ---- ads (dana keluar)
const f = useState<FilterIklan>('konten-ads-filter', filterIklanBawaan)
const halA = useState('konten-ads-hal', () => 1)
const perA = useState('konten-ads-per', () => 10)
const list = computed(() => saringIklan(adsScope.value, f.value))
watch([f, brand], () => {
  halA.value = 1
}, { deep: true })
const halamanA = computed(() => list.value.slice((halA.value - 1) * perA.value, halA.value * perA.value))
const SEMUA = '__semua'
const fPlat = computed({
  get: () => f.value.platform || SEMUA,
  set: (v: string) => {
    f.value.platform = v === SEMUA ? '' : v
  },
})
const fStatus = computed({
  get: () => f.value.status || SEMUA,
  set: (v: string) => {
    f.value.status = v === SEMUA ? '' : v
  },
})
const opsiPlat = [{ value: SEMUA, label: 'Semua platform' }, ...ADS_PLATFORMS.map(p => ({ value: p, label: p }))]
const opsiStatus = Object.entries(ADS_STATUS).map(([value, s]) => ({ value, label: s.label }))
const opsiStatusF = [{ value: SEMUA, label: 'Semua status' }, ...opsiStatus]
const warnaStatus = (s?: string) => (({ active: 'success', paused: 'warning', ended: 'neutral' }) as Record<string, 'success' | 'warning' | 'neutral'>)[s ?? ''] ?? 'info'
async function setStatus(a: IklanKonten, s: string) {
  if (!ADS_STATUS[s] || s === a.status) return
  await kontenSimpan(() => tambalKonten<IklanKonten>('ads', a.id, { status: s }, a.updatedAt), undefined, { action: `status iklan → ${ADS_STATUS[s]!.label}`, target: a.name })
}
const periode = (a: IklanKonten) => (a.startDate ? `${fTglP(a.startDate)} - ${a.endDate ? fTglP(a.endDate) : '?'}` : '')
const kolomA: TableColumn<IklanKonten>[] = [
  { id: 'nama', header: 'Nama iklan' },
  { id: 'brand', header: 'Brand' },
  { accessorKey: 'platform', header: 'Platform' },
  { id: 'target', header: 'Target' },
  { id: 'usia', header: 'Usia range' },
  { id: 'video', header: 'Video' },
  { id: 'chats', header: 'Hasil (chats)', meta: { class: R } },
  { id: 'dana', header: 'Dana keluar', meta: { class: R } },
  { id: 'periode', header: 'Periode' },
  { id: 'status', header: 'Status' },
]

const iklanBuka = ref(false)
const iklanId = ref('')
const iklanItem = computed(() => st.value.ads.find(a => a.id === iklanId.value) ?? null)
function bukaIklan(a?: IklanKonten) {
  iklanId.value = a?.id ?? ''
  iklanBuka.value = true
}

// ---- funds (dana masuk)
const funds = computed(() => fundScope.value.slice().sort((a, b) => String(b.date ?? '1970').localeCompare(String(a.date ?? '1970'))))
const halF = useState('konten-fund-hal', () => 1)
const perF = useState('konten-fund-per', () => 10)
watch(brand, () => {
  halF.value = 1
})
const halamanF = computed(() => funds.value.slice((halF.value - 1) * perF.value, halF.value * perF.value))
const kolomF: TableColumn<DanaIklan>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'brand', header: 'Brand' },
  { id: 'nominal', header: 'Nominal', meta: { class: R } },
  { id: 'note', header: 'Sumber / catatan' },
]
const danaBuka = ref(false)
const danaId = ref('')
const danaItem = computed(() => st.value.adFunds.find(x => x.id === danaId.value) ?? null)
function bukaDana(x?: DanaIklan) {
  danaId.value = x?.id ?? ''
  danaBuka.value = true
}
</script>

<template>
  <AppPage
    title="Ads Management"
    description="Dana masuk = budget - Buat iklan = rincian dana keluar (incl. PPN 11%)"
  >
    <template
      v-if="can('ads')"
      #actions
    >
      <UButton
        label="Tambah dana masuk"
        icon="i-lucide-wallet"
        color="neutral"
        variant="outline"
        @click="bukaDana()"
      />
      <UButton
        label="Buat iklan (dana keluar)"
        icon="i-lucide-plus"
        @click="bukaIklan()"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />

    <KontenBrandBar :brands="st.brands" />

    <AppStatGrid>
      <AppStat
        label="Iklan aktif"
        :value="angka(aktif)"
        tone="success"
      />
      <AppStat
        label="Total dana masuk"
        :value="rupiah(totIn)"
        tone="success"
      />
      <AppStat
        label="Total dana keluar"
        :value="rupiah(totOut)"
        sub="termasuk PPN 11%"
        tone="error"
      />
      <AppStat
        label="Sisa dana (brand ini)"
        :value="rupiah(totIn - totOut)"
        :tone="totIn - totOut < 0 ? 'error' : 'gold'"
      />
    </AppStatGrid>

    <AppPanel>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold text-muted">
            Sisa dana keseluruhan (akumulatif - semua brand)
          </p>
          <p class="mt-1 text-xs text-muted">
            Masuk <b class="num text-success">{{ rupiah(allIn) }}</b> − Keluar <b class="num text-error">{{ rupiah(allOut) }}</b>
          </p>
        </div>
        <p
          class="num font-display text-3xl font-bold"
          :class="allIn - allOut < 0 ? 'text-error' : 'text-primary-700'"
        >
          {{ rupiah(allIn - allOut) }}
        </p>
      </div>
    </AppPanel>

    <AppPanel
      title="Report dana masuk & keluar per bulan"
      icon="i-lucide-calendar-range"
      description="Dana keluar sudah termasuk PPN 11%. Sebuah iklan masuk ke bulan tanggal iklan itu mulai jalan - seluruh rinciannya sekaligus, berapa pun tanggal masing-masing rincian."
      flush
    >
      <p
        v-if="!bulan.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada data untuk direkap.
      </p>
      <template v-else>
        <UTable
          :data="halamanB"
          :columns="kolomB"
        >
          <template #bulan-cell="{ row }">
            <b :class="row.original.ym === ADS_TANPA_TGL ? 'text-warning' : ''">{{ labelBulanIklan(row.original.ym) }}</b>
          </template>
          <template #in-cell="{ row }">
            <span class="num text-success">{{ rupiah(row.original.in) }}</span>
          </template>
          <template #out-cell="{ row }">
            <span class="num text-error">{{ rupiah(row.original.out) }}</span>
          </template>
          <template #sisa-cell="{ row }">
            <b
              class="num"
              :class="row.original.in - row.original.out < 0 ? 'text-error' : ''"
            >{{ rupiah(row.original.in - row.original.out) }}</b>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              label="Export"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              size="xs"
              @click="ekspor(row.original.ym)"
            />
          </template>
        </UTable>
        <KontenPager
          v-model:hal="halB"
          v-model:per="perB"
          :total="bulan.length"
          satuan="bulan"
        />
      </template>
    </AppPanel>

    <AppPanel
      title="Dana keluar (buat iklan)"
      icon="i-lucide-trending-down"
      description="Rincian di balik kolom Dana keluar pada rekap di atas - sudah termasuk PPN 11%."
      :count="list.length"
      flush
      :class="status === 'pending' ? 'opacity-60' : ''"
    >
      <div class="flex flex-wrap items-center gap-3 border-b border-default p-4">
        <UInput
          v-model="f.q"
          placeholder="Cari nama iklan / objective / target…"
          icon="i-lucide-search"
          class="w-full sm:w-64"
        />
        <USelect
          v-model="fPlat"
          :items="opsiPlat"
          class="w-full sm:w-44"
        />
        <USelect
          v-model="fStatus"
          :items="opsiStatusF"
          class="w-full sm:w-40"
        />
        <UButton
          label="Reset"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          size="sm"
          @click="f = filterIklanBawaan()"
        />
        <span class="text-xs text-muted sm:ms-auto">{{ list.length }} iklan</span>
      </div>
      <div
        v-if="!list.length"
        class="p-8 text-center"
      >
        <UIcon
          name="i-lucide-megaphone"
          class="mx-auto size-7 text-dimmed"
        />
        <p class="mt-2 font-semibold">
          {{ adsScope.length ? 'Tidak ada yang cocok' : 'Belum ada iklan' }}
        </p>
        <p class="text-sm text-muted">
          {{ adsScope.length ? 'Ubah / reset filter.' : 'Klik "Buat iklan" untuk mencatat rincian dana keluar.' }}
        </p>
      </div>
      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="halamanA"
          :columns="kolomA"
        >
          <template #nama-cell="{ row }">
            <button
              type="button"
              class="text-left"
              @click="bukaIklan(row.original)"
            >
              <b class="text-highlighted">{{ row.original.name || '(tanpa nama)' }}</b>
              <span class="block text-xs text-muted">{{ row.original.objective }}{{ row.original.expenses?.length ? ` - ${row.original.expenses.length} rincian` : '' }}</span>
            </button>
          </template>
          <template #brand-cell="{ row }">
            {{ namaBrand(row.original.brand) }}
          </template>
          <template #target-cell="{ row }">
            <span class="text-xs">{{ row.original.target || '-' }}</span>
          </template>
          <template #usia-cell="{ row }">
            <span class="text-xs">{{ row.original.ageRange || '-' }}</span>
          </template>
          <template #video-cell="{ row }">
            <UButton
              v-if="platformVideo(row.original.videoUrl)"
              :to="rapikanVideo(row.original.videoUrl) || undefined"
              target="_blank"
              :label="platformVideo(row.original.videoUrl)!"
              icon="i-lucide-play"
              size="xs"
              color="neutral"
              variant="soft"
            />
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #chats-cell="{ row }">
            <span class="num font-semibold text-info">{{ angka(row.original.chats || 0) }}</span>
          </template>
          <template #dana-cell="{ row }">
            <span
              class="num font-semibold text-error"
              title="Termasuk PPN 11%"
            >{{ rupiah(danaKeluarIklan(row.original)) }}</span>
          </template>
          <template #periode-cell="{ row }">
            <span
              v-if="row.original.startDate"
              class="text-xs"
            >{{ periode(row.original) }}</span>
            <span
              v-else
              class="text-xs text-error"
              :title="`Tanggal mulai belum diisi - bulan pengeluarannya diambil dari ${iklanPakaiCadangan(row.original) ? fTgl(tglDanaIklan(row.original)) : 'tanggal lain yang ada'}`"
            >mulai belum diisi</span>
          </template>
          <template #status-cell="{ row }">
            <USelect
              v-if="can('ads')"
              :model-value="row.original.status || 'draft'"
              :items="opsiStatus"
              size="sm"
              class="w-28"
              @update:model-value="setStatus(row.original, $event as string)"
            />
            <AppStatus
              v-else
              :color="warnaStatus(row.original.status)"
              size="sm"
            >
              {{ ADS_STATUS[row.original.status || 'draft']?.label }}
            </AppStatus>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="a in halamanA"
            :key="a.id"
            class="p-4"
          >
            <button
              type="button"
              class="block w-full text-left"
              @click="bukaIklan(a)"
            >
              <span class="flex items-start justify-between gap-2">
                <b class="min-w-0 text-highlighted">{{ a.name || '(tanpa nama)' }}</b>
                <span class="num shrink-0 font-semibold text-error">{{ rupiah(danaKeluarIklan(a)) }}</span>
              </span>
              <span class="block text-xs text-muted">{{ [namaBrand(a.brand), a.platform, a.objective, a.target].filter(Boolean).join(' · ') }}</span>
              <span class="block text-xs text-muted">{{ a.chats || 0 }} chat · {{ a.startDate ? periode(a) : 'mulai belum diisi' }} · {{ labelBulanIklan(bulanIklan(a)) }}</span>
            </button>
            <USelect
              v-if="can('ads')"
              :model-value="a.status || 'draft'"
              :items="opsiStatus"
              size="sm"
              class="mt-2 w-32"
              @update:model-value="setStatus(a, $event as string)"
            />
          </li>
        </ul>
        <KontenPager
          v-model:hal="halA"
          v-model:per="perA"
          :total="list.length"
          satuan="iklan"
        />
      </template>
    </AppPanel>

    <AppPanel
      title="Dana masuk (budget)"
      icon="i-lucide-wallet"
      :description="`Total: ${rupiah(totIn)}`"
      flush
    >
      <p
        v-if="!funds.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada dana masuk. Klik "Tambah dana masuk" untuk mencatat budget.
      </p>
      <template v-else>
        <UTable
          :data="halamanF"
          :columns="kolomF"
          :ui="{ tr: can('ads') ? 'cursor-pointer' : '' }"
          @select="(_e: Event, row: { original: DanaIklan }) => can('ads') && bukaDana(row.original)"
        >
          <template #tgl-cell="{ row }">
            <span class="num text-xs">{{ row.original.date ? fTglP(row.original.date) : '-' }}</span>
          </template>
          <template #brand-cell="{ row }">
            {{ namaBrand(row.original.brand) }}
          </template>
          <template #nominal-cell="{ row }">
            <b class="num text-success">{{ rupiah(row.original.amount) }}</b>
          </template>
          <template #note-cell="{ row }">
            <span class="text-xs text-muted">{{ row.original.note || '-' }}</span>
          </template>
        </UTable>
        <KontenPager
          v-model:hal="halF"
          v-model:per="perF"
          :total="funds.length"
          satuan="dana masuk"
        />
      </template>
    </AppPanel>

    <KontenIklanForm
      v-model:open="iklanBuka"
      :iklan="iklanItem"
    />
    <KontenDanaForm
      v-model:open="danaBuka"
      :dana="danaItem"
    />
  </AppPage>
</template>
