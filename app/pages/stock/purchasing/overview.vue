<!--
  Stock › Purchasing › Rekap Per Bulan (old `deploy/stock/purchasing/index.html:188-189,660-710`).

  Monthly KPIs, trend/vendor/team bars, and a recap table with a 4-month
  sparkline + Naik/Turun/Baru/Stabil badges — all kicked from the order list
  in the browser, like the old `renderRecapTable`.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { OrderStock, ProdukStock } from '~/composables/useStock'
import { getProducts, listOrders } from '~/composables/useStock'
import { angka, tglPendek } from '~/utils/format'

definePageMeta({ access: ['purchasing'] })

const bulan = ref(new Date().toISOString().slice(0, 7))
const pilihanBulan = computed(() => {
  const out: { value: string, label: string }[] = []
  const d = new Date()
  d.setDate(1)
  const nama = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  for (let i = 0; i < 12; i++) {
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ value: v, label: `${nama[d.getMonth()]} ${d.getFullYear()}` })
    d.setMonth(d.getMonth() - 1)
  }
  return out
})

const ordersQ = useAsyncData('stock-overview', () => listOrders(), {
  default: () => ({ rows: [] as OrderStock[], versions: {} }),
})
const produkQ = useAsyncData('stock-overview-produk', getProducts, {
  default: () => ({ rows: [] as ProdukStock[], versions: {} }),
})
const utamaOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.utama || ''

const bukanCk = (o: OrderStock) => (o.batchName || '') !== 'Central Kitchen'
const semua = computed(() => (ordersQ.data.value?.rows ?? []).filter(bukanCk))
const dalamBulan = (rows: OrderStock[], b: string) => rows.filter(o => (o.tglDatang || '').startsWith(b))
const bulanIni = computed(() => dalamBulan(semua.value, bulan.value))

const geserBulan = (b: string, n: number) => {
  const d = new Date(`${b}-01T00:00:00`)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const kpi = computed(() => {
  const rows = bulanIni.value
  return {
    qty: rows.reduce((a, o) => a + (Number(o.qty) || 0), 0),
    baris: rows.length,
    item: new Set(rows.map(o => o.item)).size,
    vendor: new Set(rows.map(o => utamaOf(o.item)).filter(Boolean)).size,
    perhatian: rows.filter(o => !utamaOf(o.item) || ((o.tglDatang || '') < new Date().toISOString().slice(0, 10) && (o.kedatangan || '') !== 'Datang')).length,
  }
})

const tren = computed(() => {
  const out = []
  for (let i = 5; i >= 0; i--) {
    const b = geserBulan(bulan.value, -i)
    out.push({ label: b, value: dalamBulan(semua.value, b).length })
  }
  const maks = Math.max(1, ...out.map(o => o.value))
  return out.map(o => ({ ...o, persen: Math.round(o.value / maks * 100) }))
})
const perVendor = computed(() => {
  const agg = new Map<string, number>()
  for (const o of bulanIni.value) {
    const v = utamaOf(o.item) || '(tanpa vendor)'
    agg.set(v, (agg.get(v) ?? 0) + 1)
  }
  const rows = [...agg.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  const maks = Math.max(1, ...rows.map(r => r.value))
  return rows.map(r => ({ ...r, persen: Math.round(r.value / maks * 100) }))
})
const perTim = computed(() => {
  const agg = new Map<string, number>()
  for (const o of bulanIni.value) agg.set(o.tim || '(tanpa tim)', (agg.get(o.tim || '(tanpa tim)') ?? 0) + 1)
  const rows = [...agg.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const maks = Math.max(1, ...rows.map(r => r.value))
  return rows.map(r => ({ ...r, persen: Math.round(r.value / maks * 100) }))
})

interface Rekap { item: string, qty: number, baris: number, spark: number[], badge: string }
const rekap = computed<Rekap[]>(() => {
  const agg = new Map<string, { qty: number, baris: number, perBulan: number[] }>()
  const rentang = [3, 2, 1, 0].map(i => geserBulan(bulan.value, -i))
  for (const o of semua.value) {
    const idx = rentang.indexOf((o.tglDatang || '').slice(0, 7))
    if (idx < 0) continue
    let r = agg.get(o.item)
    if (!r) {
      r = { qty: 0, baris: 0, perBulan: [0, 0, 0, 0] }
      agg.set(o.item, r)
    }
    r.qty += Number(o.qty) || 0
    r.baris += 1
    r.perBulan[idx] = (r.perBulan[idx] ?? 0) + 1
  }
  return [...agg.entries()]
    .filter(([, r]) => (r.perBulan[3] ?? 0) > 0)
    .map(([item, r]) => {
      const lalu = r.perBulan[2] ?? 0
      const kini = r.perBulan[3] ?? 0
      const badge = lalu === 0 ? 'Baru' : (kini > lalu ? 'Naik' : kini < lalu ? 'Turun' : 'Stabil')
      return { item, qty: r.qty, baris: r.baris, spark: r.perBulan, badge }
    })
    .sort((a, b) => b.qty - a.qty)
})

const warnaBadge = (b: string): 'success' | 'error' | 'info' | 'neutral' => (b === 'Naik' ? 'success' : b === 'Turun' ? 'error' : b === 'Baru' ? 'info' : 'neutral')

const kolom: TableColumn<Rekap>[] = [
  { accessorKey: 'item', header: 'Bahan' },
  { accessorKey: 'qty', header: 'Total qty' },
  { accessorKey: 'baris', header: 'Baris' },
  { accessorKey: 'spark', header: '4 bulan' },
  { accessorKey: 'badge', header: '' },
]
</script>

<template>
  <AppPage
    title="Rekap Per Bulan"
    description="Rekap & analitik order bulanan"
  >
    <template #actions>
      <USelect
        v-model="bulan"
        :items="pilihanBulan"
        aria-label="Pilih bulan"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Total qty"
        :value="angka(kpi.qty)"
        satuan="satuan"
        icon="i-lucide-boxes"
        tone="info"
      />
      <AppStat
        label="Baris order"
        :value="String(kpi.baris)"
        satuan="baris"
        icon="i-lucide-list"
        tone="gold"
      />
      <AppStat
        label="Item unik"
        :value="String(kpi.item)"
        satuan="item"
        icon="i-lucide-tags"
        tone="vip"
      />
      <AppStat
        label="Vendor aktif"
        :value="String(kpi.vendor)"
        satuan="vendor"
        icon="i-lucide-store"
        tone="success"
      />
      <AppStat
        label="Perhatian"
        :value="String(kpi.perhatian)"
        satuan="baris"
        icon="i-lucide-alert-triangle"
        tone="error"
      />
    </AppStatGrid>

    <div class="grid gap-4 lg:grid-cols-2">
      <AppPanel title="Tren bulanan">
        <div class="flex flex-col gap-2">
          <AppBar
            v-for="b in tren"
            :key="b.label"
            :label="tglPendek(`${b.label}-01`).slice(3)"
            :value="String(b.value)"
            :persen="b.persen"
          />
        </div>
      </AppPanel>
      <AppPanel title="Per vendor">
        <div class="flex flex-col gap-2">
          <AppBar
            v-for="b in perVendor"
            :key="b.label"
            :label="b.label"
            :value="String(b.value)"
            :persen="b.persen"
          />
          <p
            v-if="!perVendor.length"
            class="text-sm text-dimmed"
          >
            Belum ada order bulan ini.
          </p>
        </div>
      </AppPanel>
      <AppPanel
        title="Per tim"
        class="lg:col-span-2"
      >
        <div class="flex flex-col gap-2">
          <AppBar
            v-for="b in perTim"
            :key="b.label"
            :label="b.label"
            :value="String(b.value)"
            :persen="b.persen"
          />
        </div>
      </AppPanel>
    </div>

    <AppPanel
      title="Rekap bahan"
      flush
    >
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="rekap"
        >
          <template #spark-cell="{ row }">
            <span class="num text-sm text-muted">{{ row.original.spark.join(' · ') }}</span>
          </template>
          <template #badge-cell="{ row }">
            <AppStatus
              :color="warnaBadge(row.original.badge)"
              size="sm"
            >
              {{ row.original.badge }}
            </AppStatus>
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 p-3 lg:hidden">
        <div
          v-for="r in rekap.slice(0, 60)"
          :key="r.item"
          class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ r.item }}</b>
            <p class="text-sm text-muted">
              {{ angka(r.qty) }} · {{ r.baris }} baris · {{ r.spark.join(' · ') }}
            </p>
          </div>
          <AppStatus
            :color="warnaBadge(r.badge)"
            size="sm"
          >
            {{ r.badge }}
          </AppStatus>
        </div>
        <p
          v-if="!rekap.length"
          class="text-sm text-dimmed"
        >
          Belum ada order bulan ini.
        </p>
      </div>
    </AppPanel>
  </AppPage>
</template>
