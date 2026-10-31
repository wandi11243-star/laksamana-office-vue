<!--
  Stock › Ordering › Daftar Restock (old `deploy/stock/ordering/index.html:193-200,648-707`).

  Admin only. The payload comes from Google Apps Script, like the old page
  (K-06: the one exception to "only /api/v1", PLAN.md §1); the stock map from
  `GET /stock/stock-today`. Math lives in `app/utils/stock-forecast.ts`
  (status thresholds, pack-rounded suggestions, name matching).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getStockToday, putStockToday } from '~/composables/useStock'
import { isAdminOf } from '~/composables/useMe'
import { apiErrorMessage } from '~/composables/useApi'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { barisBerkolom } from '~/utils/stock-impor'
import {
  BukuForecast,
  LABEL_STATUS,
  LABEL_TIER,
  RESTOCK_LIMIT,
  type PayloadForecast,
  type PenilaianRestock,
  type StokKas,
} from '~/utils/stock-forecast'
import { unduhCsvStock } from '~/utils/stock-catat'
import type { Versi } from '~/utils/versi'

definePageMeta({ access: ['ordering'] })

const toast = useToast()
const me = useMe()
const admin = computed(() => isAdminOf(me.value, 'ordering'))

/** The Apps Script URL ships in the old page (`ordering/index.html:1049`); editable + remembered. */
const URL_BAWAAN = 'https://script.google.com/macros/s/AKfycbykGmdR7mGiCQUXlJQv2QwHhkNatj6GeCL8JnbZ1WXeoOCWA5m_b7cMdiuPHge0s6rH/exec'
const KUNCI_URL = 'stock-forecast-url'
const urlScript = ref(URL_BAWAAN)
onMounted(() => {
  urlScript.value = localStorage.getItem(KUNCI_URL) || URL_BAWAAN
})

const payload = ref<PayloadForecast | null>(null)
const memuat = ref(false)
const galatMuat = ref('')

const stokQ = useAsyncData('stock-today', getStockToday, {
  default: () => ({ data: { stock: {} as Record<string, StokKas> }, versi: undefined as Versi | undefined }),
})
const stokMap = computed(() => stokQ.data.value?.data.stock ?? {})

const buku = computed(() => new BukuForecast(payload.value, stokMap.value))

async function muatPrakiraan() {
  if (!urlScript.value) {
    galatMuat.value = 'Isi dulu tautan Apps Script prakiraan.'
    return
  }
  memuat.value = true
  galatMuat.value = ''
  try {
    localStorage.setItem(KUNCI_URL, urlScript.value)
  }
  catch { /* keep going */ }
  try {
    payload.value = await $fetch<PayloadForecast>(urlScript.value)
  }
  catch (e) {
    galatMuat.value = `Prakiraan tidak termuat: ${e instanceof Error ? e.message : 'jaringan gagal'}`
  }
  finally {
    memuat.value = false
  }
}
onMounted(muatPrakiraan)

const cari = ref('')
const hanyaAksi = ref(true)
// Full assessment (the summary cards count THIS); the visible list filters it.
const penilaian = computed<PenilaianRestock[]>(() =>
  Object.keys(payload.value?.items ?? {}).map(n => buku.value.assess(n)),
)
const semua = computed<PenilaianRestock[]>(() => {
  const q = cari.value.trim().toUpperCase()
  return penilaian.value
    .filter(a => (!q || a.nama.toUpperCase().includes(q)) && (!hanyaAksi.value || a.status === 'order' || a.status === 'soon' || a.status === 'check'))
})
const tampil = computed(() => semua.value.slice(0, RESTOCK_LIMIT))

const hitung = (s: PenilaianRestock['status']) => penilaian.value.filter(a => a.status === s).length

const fmtStok = (a: PenilaianRestock) => {
  if (a.stockNow == null) return '—'
  const s = Math.round(a.stockNow * 10) / 10
  return `${s.toLocaleString('id-ID')} ${a.unit}`
}
const fmtSaran = (a: PenilaianRestock) => {
  if (a.suggestOrderPacks == null) return '—'
  if (a.suggestOrderPacks <= 0) return 'Cukup'
  return `${a.suggestOrderPacks.toLocaleString('id-ID')} ${a.purchaseUnit || 'pack'}`
}
const fmtCukup = (a: PenilaianRestock) => {
  if (a.daysCover == null) return '—'
  return a.daysCover >= 10 ? `${Math.round(a.daysCover)} hari` : `${Math.round(a.daysCover * 10) / 10} hari`
}

const warnaStatus = (s: PenilaianRestock['status']) =>
  s === 'order' ? 'error' as const : s === 'soon' ? 'warning' as const : s === 'safe' ? 'success' as const : 'neutral' as const

const kolom: TableColumn<PenilaianRestock>[] = [
  { accessorKey: 'nama', header: 'Bahan' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'stockNow', header: 'Stok sekarang' },
  { accessorKey: 'reorderPoint', header: 'Reorder point' },
  { accessorKey: 'suggestOrderPacks', header: 'Saran pesan' },
  { accessorKey: 'daysCover', header: 'Cukup' },
]

function unduhRestockCsv() {
  const sel = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  unduhCsvStock(
    'restock.csv',
    ['Bahan,Tier,Status,Stok sekarang,Reorder point,Saran pesan,Cukup',
      ...semua.value.map(a => [
        a.nama,
        LABEL_TIER[a.tier] ?? a.tier,
        LABEL_STATUS[a.status],
        fmtStok(a),
        `${a.reorderPoint.toLocaleString('id-ID')} ${a.unit}`,
        fmtSaran(a),
        fmtCukup(a),
      ].map(sel).join(','))].join('\n'),
  )
}

// --- Stock Today upload (xlsx → PUT /stock/stock-today) -------------------------
const mengunggah = ref(false)
async function unggahStok(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  mengunggah.value = true
  try {
    const tb = await bacaBerkasTabel(file)
    // Letter-keyed rows -> header-keyed rows (the header is the first row, so
    // `Object.keys` of row 0 used to be letters and no header ever matched).
    const baris = barisBerkolom(tb)
    const kepala = Object.keys(baris[0] ?? {})
    const cNama = kepala.find(k => k.trim() === 'Product Name')
    const cStok = kepala.find(k => k.trim() === 'Stock Qty') ?? kepala.find(k => k.trim() === 'Effective Stock')
    const cSat = kepala.find(k => k.trim() === 'Default Unit') ?? kepala.find(k => k.trim() === 'Unit')
    if (!cNama || !cStok) {
      toast.add({ title: 'Kolom stok tidak lengkap', description: 'Berkas harus punya kolom Product Name & Stock Qty.', color: 'error' })
      return
    }
    const stock: Record<string, StokKas> = {}
    for (const r of baris) {
      const nm = String(r[cNama] ?? '').trim()
      const q = Number.parseFloat(String(r[cStok] ?? ''))
      if (!nm || Number.isNaN(q)) continue
      const u = cSat ? String(r[cSat] ?? '').trim() : ''
      stock[nm] = { stock_now: (stock[nm]?.stock_now ?? 0) + q, stock_unit: u }
    }
    await putStockToday({ stock }, stokQ.data.value?.versi)
    await stokQ.refresh()
    toast.add({ title: 'Stok hari ini tersimpan', description: `${Object.keys(stock).length} bahan.`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Unggah gagal', description: apiErrorMessage(err), color: 'error' })
  }
  finally {
    mengunggah.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <AppPage
    title="Daftar Restock"
    description="Bahan yang perlu dipesan, dari data prakiraan"
  >
    <template
      v-if="admin"
      #actions
    >
      <UButton
        label="Muat prakiraan"
        icon="i-lucide-refresh-cw"
        variant="outline"
        :loading="memuat"
        @click="muatPrakiraan"
      />
      <UButton
        label="Unduh CSV"
        icon="i-lucide-download"
        variant="outline"
        :disabled="!semua.length"
        @click="unduhRestockCsv"
      />
    </template>

    <AppPanel
      v-if="!admin"
      title="Khusus admin"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Daftar Restock hanya untuk admin Ordering.
      </p>
    </AppPanel>

    <AppStatGrid v-if="admin">
      <AppStat
        label="Pesan sekarang"
        :value="String(hitung('order'))"
        satuan="bahan"
        icon="i-lucide-alert-octagon"
        tone="error"
      />
      <AppStat
        label="Segera siapkan"
        :value="String(hitung('soon'))"
        satuan="bahan"
        icon="i-lucide-clock"
        tone="warning"
      />
      <AppStat
        label="Aman"
        :value="String(hitung('safe'))"
        satuan="bahan"
        icon="i-lucide-check-circle-2"
        tone="success"
      />
      <AppStat
        label="Belum ada stok"
        :value="String(hitung('nostk'))"
        satuan="bahan"
        icon="i-lucide-help-circle"
        tone="info"
      />
    </AppStatGrid>

    <AppPanel
      v-if="admin"
      title="Sumber data"
    >
      <AppFilterGrid>
        <UFormField label="Tautan Apps Script prakiraan">
          <UInput
            v-model="urlScript"
            placeholder="https://script.google.com/…"
          />
        </UFormField>
        <UFormField label="Stok hari ini (xlsx)">
          <UInput
            type="file"
            accept=".xlsx,.xls,.csv"
            :disabled="mengunggah"
            @change="unggahStok"
          />
        </UFormField>
      </AppFilterGrid>
      <p
        v-if="galatMuat"
        class="mt-2 text-sm text-error"
      >
        {{ galatMuat }}
      </p>
      <p
        v-else
        class="mt-2 text-sm text-muted"
      >
        {{ payload ? `Data prakiraan termuat — ${Object.keys(payload.items ?? {}).length} bahan` : 'Memuat prakiraan…' }} ·
        Stok hari ini termuat — {{ Object.keys(stokMap).length }} bahan
      </p>
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Restock"
      flush
    >
      <template #head>
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="cari"
            placeholder="Cari bahan…"
            icon="i-lucide-search"
          />
          <UCheckbox
            v-model="hanyaAksi"
            label="Hanya yang perlu ditindak"
          />
        </div>
      </template>
      <!-- Loading rows mirror the restock table below. -->
      <div
        v-if="memuat && !payload"
        class="space-y-2 p-4"
      >
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="h-12 w-full"
        />
      </div>
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="tampil"
        >
          <template #nama-cell="{ row }">
            <b class="text-highlighted">{{ row.original.nama }}</b>
            <span class="ml-1 text-xs text-muted">{{ LABEL_TIER[row.original.tier] ?? row.original.tier }}</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="warnaStatus(row.original.status)"
              size="sm"
            >
              {{ LABEL_STATUS[row.original.status] }}
            </AppStatus>
          </template>
          <template #stockNow-cell="{ row }">
            {{ fmtStok(row.original) }}
          </template>
          <template #reorderPoint-cell="{ row }">
            {{ row.original.reorderPoint.toLocaleString('id-ID') }} {{ row.original.unit }}
          </template>
          <template #suggestOrderPacks-cell="{ row }">
            {{ fmtSaran(row.original) }}
          </template>
          <template #daysCover-cell="{ row }">
            {{ fmtCukup(row.original) }}
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 p-3 lg:hidden">
        <div
          v-for="a in tampil"
          :key="a.nama"
          class="rounded-panel border border-default p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <b class="text-highlighted">{{ a.nama }}</b>
            <AppStatus
              :color="warnaStatus(a.status)"
              size="sm"
            >
              {{ LABEL_STATUS[a.status] }}
            </AppStatus>
          </div>
          <p class="mt-1 text-sm text-muted">
            Stok {{ fmtStok(a) }} · Saran {{ fmtSaran(a) }} · Cukup {{ fmtCukup(a) }}
          </p>
        </div>
        <p
          v-if="!tampil.length"
          class="text-sm text-dimmed"
        >
          {{ payload ? 'Tidak ada yang perlu ditindak.' : 'Prakiraan belum termuat.' }}
        </p>
      </div>
      <p
        v-if="payload && semua.length > RESTOCK_LIMIT"
        class="p-3 text-sm text-muted"
      >
        Menampilkan {{ RESTOCK_LIMIT }} dari {{ semua.length }} bahan. Pakai kolom cari untuk bahan tertentu.
      </p>
    </AppPanel>
  </AppPage>
</template>
