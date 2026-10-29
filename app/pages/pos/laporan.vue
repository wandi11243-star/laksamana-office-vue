<!--
  POS › Laporan. Monthly omset & PB1 from paid server orders (no synthetic
  reconstruction: with the server, bills ARE the history). Click a date for
  its bill detail. The old month chart and KPI order are kept.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { hitungOrderPos, laporanHarianPos, rupiahPos } from '~/utils/pos'
import { mulaiPos, usePosDb, usePosSetting } from '~/composables/usePos'

definePageMeta({ access: ['pos'] })

const db = usePosDb()
const setting = usePosSetting()

onMounted(() => mulaiPos())

const kini = new Date()
const bulan = ref(kini.getMonth())
const TAHUN = 2026

const hari = computed(() => {
  const n = new Date(TAHUN, bulan.value + 1, 0).getDate()
  const out: { iso: string, omset: number, pajak: number, trx: number }[] = []
  for (let d = 1; d <= n; d++) {
    const iso = `${TAHUN}-${String(bulan.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (iso > kini.toISOString().slice(0, 10)) break
    const r = laporanHarianPos(db.value, iso, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10)
    out.push({ iso, omset: r.omset, pajak: r.pajak, trx: r.trx })
  }
  return out
})

const totOmset = computed(() => hari.value.reduce((s, r) => s + r.omset, 0))
const totPajak = computed(() => hari.value.reduce((s, r) => s + r.pajak, 0))
const totTrx = computed(() => hari.value.reduce((s, r) => s + r.trx, 0))
const maks = computed(() => Math.max(1, ...hari.value.map(r => r.omset)))

const lihatTgl = ref<string | null>(null)
const sheetBuka = ref(false)
const rincian = computed(() => lihatTgl.value
  ? laporanHarianPos(db.value, lihatTgl.value, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10)
  : null)

function lihat(iso: string): void {
  lihatTgl.value = iso
  sheetBuka.value = true
}

interface BarisHarian {
  no: number
  iso: string
  trx: number
  omset: string
  pajak: string
}

const baris = computed<BarisHarian[]>(() => hari.value.map((r, i) => ({
  no: i + 1, iso: r.iso, trx: r.trx, omset: rupiahPos(r.omset), pajak: rupiahPos(r.pajak),
})))

const kolomHarian: TableColumn<BarisHarian>[] = [
  { accessorKey: 'no', header: 'No' },
  { accessorKey: 'iso', header: 'Tanggal' },
  { accessorKey: 'trx', header: 'Transaksi' },
  { accessorKey: 'omset', header: 'Omset' },
  { accessorKey: 'pajak', header: 'PB1' },
]

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
</script>

<template>
  <AppPage
    title="Laporan"
    description="Omset & PB1 harian dari transaksi POS sungguhan."
  >
    <AppStatGrid>
      <AppStat
        label="Omset bulan ini"
        :value="rupiahPos(totOmset)"
        tone="info"
        icon="i-lucide-banknote"
      />
      <AppStat
        label="PB1 bulan ini"
        :value="rupiahPos(totPajak)"
        tone="success"
        icon="i-lucide-receipt-text"
      />
      <AppStat
        label="Transaksi bulan ini"
        :value="String(totTrx)"
        tone="gold"
        icon="i-lucide-hash"
      />
    </AppStatGrid>

    <AppPanel
      flush
      title="Harian"
      icon="i-lucide-calendar-days"
    >
      <template #head>
        <div class="flex items-center gap-2 px-4 py-3.5 lg:px-5">
          <USelect
            v-model="bulan"
            :items="NAMA_BULAN.map((b, i) => ({ label: `${b} ${TAHUN}`, value: i })).filter((_, i) => i <= kini.getMonth())"
          />
        </div>
      </template>
      <div class="flex h-28 items-end gap-1 px-4 pt-4">
        <button
          v-for="r in hari"
          :key="r.iso"
          type="button"
          :title="`${r.iso}: ${rupiahPos(r.omset)}`"
          class="min-w-2 flex-1 rounded-t bg-ink-900"
          :style="{ height: `${Math.max(2, r.omset / maks * 100)}%` }"
          @click="lihat(r.iso)"
        />
      </div>
      <UTable
        :columns="kolomHarian"
        :data="baris"
        class="hidden lg:block"
      />
      <AppList class="lg:hidden">
        <AppListRow
          v-for="r in hari"
          :key="r.iso"
          :title="r.iso"
          :description="`${r.trx} transaksi · PB1 ${rupiahPos(r.pajak)}`"
          @click="lihat(r.iso)"
        >
          <template #trailing>
            <span class="text-sm font-semibold num">{{ rupiahPos(r.omset) }}</span>
          </template>
        </AppListRow>
      </AppList>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetBuka"
      title="Rincian harian"
      :description="lihatTgl || ''"
    >
      <AppList v-if="rincian">
        <AppListRow
          v-for="o in rincian.orders"
          :key="o.id"
          :title="`${o.no || o.id.slice(-6)} · Meja ${o.meja}`"
          :description="`${o.kasir} · ${o.items.map(i => `${i.qty}x ${i.nama}`).join(', ')}`"
        >
          <template #trailing>
            <span class="text-sm font-semibold num">{{ rupiahPos(hitungOrderPos(o, setting?.sc ?? 5, setting?.pb1 ?? 10).grand) }}</span>
          </template>
        </AppListRow>
      </AppList>
      <p class="mt-2 text-sm text-muted">
        Total omset <b class="num">{{ rupiahPos(rincian?.omset || 0) }}</b> ·
        PB1 <b class="num">{{ rupiahPos(rincian?.pajak || 0) }}</b>
      </p>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="sheetBuka = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
