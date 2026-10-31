<!--
  Stock › Ordering › Data Forecast (old `deploy/stock/ordering/index.html:201-202,708-826`).

  Admin only. Reliability table (tier + WAPE) from the same Apps Script payload
  as Restock (K-06); training-data upload to the server archive
  (`POST /stock/training`, `.xlsx`/`.xls` ≤ 12 MB).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { listTraining, trainingStatus, uploadTraining } from '~/composables/useStock'
import { isAdminOf } from '~/composables/useMe'
import { apiErrorMessage } from '~/composables/useApi'
import {
  LABEL_TIER,
  healthRows,
  healthTally,
  healthView,
  type BarisHealth,
  type PayloadForecast,
  type UrutHealth,
} from '~/utils/stock-forecast'

definePageMeta({ access: ['ordering'] })

const toast = useToast()
const me = useMe()
const admin = computed(() => isAdminOf(me.value, 'ordering'))

const KUNCI_URL = 'stock-forecast-url'
const URL_BAWAAN = 'https://script.google.com/macros/s/AKfycbykGmdR7mGiCQUXlJQv2QwHhkNatj6GeCL8JnbZ1WXeoOCWA5m_b7cMdiuPHge0s6rH/exec'
const urlScript = ref(URL_BAWAAN)
const payload = ref<PayloadForecast | null>(null)
const memuat = ref(false)
onMounted(async () => {
  urlScript.value = localStorage.getItem(KUNCI_URL) || URL_BAWAAN
  memuat.value = true
  try {
    payload.value = await $fetch<PayloadForecast>(urlScript.value)
  }
  catch { /* shown below */ }
  finally {
    memuat.value = false
  }
})

const barisSemua = computed(() => healthRows(payload.value))
const tally = computed(() => healthTally(barisSemua.value))
const cari = ref('')
const urut = ref<UrutHealth>('wape_desc')
const tampil = computed(() => healthView(barisSemua.value, { search: cari.value, sort: urut.value, limit: 200 }))

const fmtWape = (w: number | null) => (w == null ? 'Belum diuji' : `${Math.round(w * 1000) / 10}%`)

const kolom: TableColumn<BarisHealth>[] = [
  { accessorKey: 'nama', header: 'Bahan' },
  { accessorKey: 'tier', header: 'Tier' },
  { accessorKey: 'wape', header: 'WAPE' },
  { accessorKey: 'avgDaily', header: 'Pakai harian' },
]

// --- training archive -----------------------------------------------------------
const arsipQ = useAsyncData('stock-training', trainingStatus, {
  default: () => ({ usage: { files: 0 }, sales_detail: { files: 0 } }),
})
const target = ref<'usage' | 'sales_detail'>('usage')
const daftarQ = useAsyncData('stock-training-daftar', () => listTraining(target.value), {
  watch: [target],
  default: () => ({ rows: [] as { name: string, size: number, mtime: string }[], total: 0 }),
})
const mengunggah = ref(false)
async function unggahLatih(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!/\.xlsx?$/i.test(file.name)) {
    toast.add({ title: 'Hanya berkas .xlsx/.xls', color: 'error' })
    return
  }
  if (file.size > 12 * 1024 * 1024) {
    toast.add({ title: 'Berkas terlalu besar', description: 'Maksimal 12MB.', color: 'error' })
    return
  }
  mengunggah.value = true
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    let b64 = ''
    for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    const r = await uploadTraining(target.value, file.name, btoa(b64))
    await Promise.all([arsipQ.refresh(), daftarQ.refresh()])
    toast.add({ title: 'Data latih tersimpan', description: `${r.name} (${r.size} B).`, color: 'success' })
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
    title="Data Forecast"
    description="Keandalan prakiraan & arsip data latih"
  >
    <AppPanel
      v-if="!admin"
      title="Khusus admin"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Data Forecast hanya untuk admin Ordering.
      </p>
    </AppPanel>

    <AppStatGrid v-if="admin">
      <AppStat
        label="Tier andal"
        :value="String(tally.A ?? 0)"
        satuan="bahan"
        icon="i-lucide-badge-check"
        tone="success"
      />
      <AppStat
        label="Tier cukup"
        :value="String(tally.B ?? 0)"
        satuan="bahan"
        icon="i-lucide-minus-circle"
        tone="warning"
      />
      <AppStat
        label="Tier perlu dicek"
        :value="String(tally.C ?? 0)"
        satuan="bahan"
        icon="i-lucide-alert-circle"
        tone="error"
      />
      <AppStat
        label="Arsip data latih"
        :value="String((arsipQ.data.value?.usage.files ?? 0) + (arsipQ.data.value?.sales_detail.files ?? 0))"
        satuan="berkas"
        icon="i-lucide-archive"
        tone="info"
      />
    </AppStatGrid>

    <AppPanel
      v-if="admin"
      title="Keandalan prakiraan"
      :description="payload ? `Data prakiraan termuat — ${barisSemua.length} bahan` : (memuat ? 'Memuat prakiraan…' : 'Prakiraan belum termuat — buka Daftar Restock untuk memuat.')"
      flush
    >
      <template #head>
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="cari"
            placeholder="Cari bahan…"
            icon="i-lucide-search"
          />
          <USelect
            v-model="urut"
            :items="[
              { value: 'wape_desc', label: 'WAPE terbesar' },
              { value: 'wape_asc', label: 'WAPE terkecil' },
              { value: 'usage_desc', label: 'Pemakaian terbesar' },
              { value: 'name', label: 'Nama' },
            ]"
          />
        </div>
      </template>
      <!-- Loading rows mirror the forecast table below. -->
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
          :data="tampil.rows"
        >
          <template #tier-cell="{ row }">
            <AppStatus
              :color="row.original.tier === 'A' ? 'success' : row.original.tier === 'B' ? 'warning' : 'error'"
              size="sm"
            >
              {{ row.original.tier }} · {{ LABEL_TIER[row.original.tier] ?? '' }}
            </AppStatus>
          </template>
          <template #wape-cell="{ row }">
            {{ fmtWape(row.original.wape) }}
          </template>
          <template #avgDaily-cell="{ row }">
            {{ row.original.avgDaily.toLocaleString('id-ID') }} {{ row.original.unit }}
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 p-3 lg:hidden">
        <div
          v-for="r in tampil.rows"
          :key="r.nama"
          class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ r.nama }}</b>
            <p class="text-sm text-muted">
              Tier {{ r.tier }} · WAPE {{ fmtWape(r.wape) }}
            </p>
          </div>
        </div>
        <p
          v-if="!tampil.rows.length"
          class="text-sm text-dimmed"
        >
          Belum ada data.
        </p>
      </div>
      <p
        v-if="tampil.total"
        class="p-3 text-sm text-muted"
      >
        Menampilkan {{ tampil.rows.length }} dari {{ tampil.total }} bahan.
      </p>
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Unggah data latih"
    >
      <AppFilterGrid>
        <UFormField label="Arsip tujuan">
          <USelect
            v-model="target"
            :items="[
              { value: 'usage', label: `Pemakaian (${arsipQ.data.value?.usage.files ?? 0} berkas)` },
              { value: 'sales_detail', label: `Detail penjualan (${arsipQ.data.value?.sales_detail.files ?? 0} berkas)` },
            ]"
          />
        </UFormField>
        <UFormField label="Berkas POS (.xlsx/.xls, maks 12MB)">
          <UInput
            type="file"
            accept=".xlsx,.xls"
            :disabled="mengunggah"
            @change="unggahLatih"
          />
        </UFormField>
      </AppFilterGrid>
      <ul class="mt-3 flex flex-col gap-1 text-sm text-muted">
        <li
          v-for="f in daftarQ.data.value?.rows ?? []"
          :key="f.name"
        >
          {{ f.name }} · {{ (f.size / 1024).toFixed(0) }} KB
        </li>
      </ul>
      <p
        v-if="!(daftarQ.data.value?.rows ?? []).length"
        class="mt-3 text-sm text-dimmed"
      >
        Arsip {{ target === 'usage' ? 'pemakaian' : 'detail penjualan' }} masih kosong.
      </p>
    </AppPanel>
  </AppPage>
</template>
