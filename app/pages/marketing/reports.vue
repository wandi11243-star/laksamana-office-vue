<!--
  Marketing › Reporting (docs/migrasi/marketing.md D.16, issue #60): omset &
  event count per category for one month, from closing events — plus Export
  CSV of all events, Excel id-ID friendly.
-->
<script setup lang="ts">
import { barisCsvMkt, csvMkt, laporanMkt, namaBerkasCsvMkt } from '~/utils/marketing-keuangan'
import { useStateMkt } from '~/composables/useMarketing'
import { hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st, status } = useStateMkt()

const bulan = useState('mkt-rep-bulan', () => hariIni().slice(0, 7))
const labelBulan = computed(() => new Date(`${bulan.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))
const lap = computed(() => laporanMkt(st.value.events, st.value.settings, bulan.value))
// First-load skeleton for the stat cards: while the module state is empty
// the grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !st.value.events.length && (status.value === 'pending' || status.value === 'idle'))
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? '—'
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'

function ekspor() {
  const teks = csvMkt(barisCsvMkt(st.value.events, namaClient, namaUser, st.value.settings))
  const blob = new Blob([teks], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = namaBerkasCsvMkt(hariIni())
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  toast.add({ title: 'Export selesai', description: 'Data event diunduh sebagai CSV.', color: 'success' })
}
</script>

<template>
  <AppPage
    title="Reporting"
    description="Omset & jumlah event per kategori, beserta totalnya sebulan. Dihitung dari event yang sudah closing."
  >
    <template #actions>
      <UButton
        icon="i-lucide-download"
        label="Export CSV"
        color="neutral"
        variant="outline"
        loading-auto
        @click="ekspor"
      />
    </template>
    <MarketingGerbang layar="reports">
      <AppPanel>
        <UFormField label="Periode">
          <AppBulan
            v-model="bulan"
            class="max-w-56"
          />
        </UFormField>
        <p class="mt-2 text-xs text-muted">
          Bulannya dari tanggal acaranya, bukan tanggal input — dan hanya event berstatus Confirmed, Deal, atau Event Done.
        </p>
      </AppPanel>

      <AppStatGrid
        :loading="statMemuat"
        :count="3"
      >
        <AppStat
          :label="`Total omset ${labelBulan}`"
          :value="rupiah(lap.total)"
          :sub="`${lap.n} event closing`"
          tone="success"
          icon="i-lucide-banknote"
        />
        <AppStat
          label="Jumlah event"
          :value="String(lap.n)"
          :sub="`${lap.baris.length} kategori`"
          tone="info"
          icon="i-lucide-calendar-check"
        />
        <AppStat
          label="Rata-rata per event"
          :value="rupiah(lap.rata)"
          sub="omset ÷ jumlah event"
          tone="gold"
          icon="i-lucide-scale"
        />
      </AppStatGrid>

      <AppPanel flush>
        <div
          v-if="!lap.baris.length"
          class="p-8 text-center text-sm text-muted"
        >
          Belum ada event closing bulan ini.
        </div>
        <template v-else>
          <UTable
            :data="[...lap.baris, { jenis: `TOTAL ${labelBulan.toUpperCase()}`, n: lap.n, total: lap.total }]"
            :columns="[
              { accessorKey: 'jenis', header: 'Kategori' },
              { accessorKey: 'n', header: 'Jumlah Event' },
              { accessorKey: 'total', header: 'Total Omset' },
            ]"
            class="hidden lg:block"
          >
            <template #n-cell="{ row }">
              <span class="num">{{ row.original.n }}</span>
            </template>
            <template #total-cell="{ row }">
              <b class="num">{{ rupiah(row.original.total) }}</b>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="b in lap.baris"
              :key="b.jenis"
              class="flex items-center justify-between gap-3 p-4"
            >
              <span class="min-w-0">
                <b class="block text-highlighted">{{ b.jenis }}</b>
                <span class="text-xs text-muted">{{ b.n }} event</span>
              </span>
              <b class="num shrink-0">{{ rupiah(b.total) }}</b>
            </li>
            <li class="flex items-center justify-between gap-3 bg-muted p-4">
              <b class="text-highlighted">TOTAL ({{ lap.n }} event)</b>
              <b class="num">{{ rupiah(lap.total) }}</b>
            </li>
          </ul>
        </template>
      </AppPanel>
    </MarketingGerbang>
  </AppPage>
</template>
