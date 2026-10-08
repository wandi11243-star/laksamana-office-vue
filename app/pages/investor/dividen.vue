<!--
  Investor Compass › Dividen. Capital returns recorded by the CFO in
  Finance → Brankas → Pengembalian Modal, summed server-side — the figures
  add up ALL investors, never one person's share.

  A backend that does not answer is NOT "never paid out": the two read very
  differently, and only the second one triggers phone calls.

    laksamana-office/investor/index.html:1383-1424  renderDividen
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useInvestorSummary } from '~/composables/useInvestor'
import { rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['investor'] })

const { data: balasan, status, error } = useInvestorSummary()
const dividen = computed(() => balasan.value?.data?.dividen ?? null)
const riwayat = computed(() => dividen.value?.riwayat ?? [])
const total = computed(() => Number(dividen.value?.total || 0))
const modal = computed(() => Number(dividen.value?.modal || 0))
const pct = computed(() => modal.value > 0 ? total.value / modal.value * 100 : null)
const terakhir = computed(() => riwayat.value[0] ?? null)

interface BarisDividen { tgl: string, investor: string, nominal: number }
const kolom = computed<TableColumn<BarisDividen>[]>(() => [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'investor', header: 'Investor' },
  { accessorKey: 'nominal', header: 'Nominal' },
])
</script>

<template>
  <AppPage
    title="Dividen"
    description="Riwayat dividen yang sudah dibagikan"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat dividen"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>

    <UAlert
      v-else-if="error || !dividen"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Riwayat dividen belum bisa dibaca"
      :description="apiErrorMessage(error, 'Servernya tidak menjawab.')"
    />

    <UAlert
      v-else-if="dividen.gagal"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Riwayat dividen belum bisa dibaca"
      description="Catatan pengembalian modal ada di panel Finance, dan panel itu sedang tidak menjawab. Ini bukan berarti belum ada pembagian — coba muat ulang halaman beberapa saat lagi."
    />

    <AppPanel
      v-else-if="!riwayat.length"
      title="Belum ada pembagian yang dicatat"
      icon="i-lucide-hand-coins"
    >
      <p class="text-sm text-muted">
        Pengembalian modal dicatat di <b>Finance → Brankas → Pengembalian Modal</b>. Begitu satu pembayaran dicatat, riwayatnya muncul di sini.
      </p>
    </AppPanel>

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Total dikembalikan"
          :value="rupiah(total)"
          icon="i-lucide-hand-coins"
          tone="success"
          :sub="`${riwayat.length} kali pembagian`"
        />
        <AppStat
          v-if="modal > 0"
          label="Dari modal masuk"
          :value="rupiah(modal)"
          icon="i-lucide-piggy-bank"
          tone="info"
          :sub="`${pct!.toFixed(1).replace('.', ',')}% sudah dikembalikan`"
        />
        <AppStat
          v-if="modal > 0"
          label="Sisa kewajiban"
          :value="rupiah(Math.max(modal - total, 0))"
          icon="i-lucide-scale"
          tone="warning"
          sub="belum dikembalikan"
        />
        <AppStat
          v-if="terakhir"
          label="Pembagian terakhir"
          :value="tglPanjang(terakhir.tgl)"
          icon="i-lucide-calendar-check"
          tone="gold"
          :sub="`${rupiah(terakhir.nominal)} · ${terakhir.investor || '—'}`"
        />
      </AppStatGrid>

      <UAlert
        v-if="pct !== null"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="`${pct.toFixed(1).replace('.', ',')}% dari modal sudah dikembalikan.`"
        description="Angka ini menjumlahkan SELURUH investor, bukan porsi satu orang — rincian per investor ada di catatan Finance."
        class="mb-5"
      />

      <AppPanel
        title="Riwayat pembagian"
        icon="i-lucide-history"
        description="Terbaru lebih dulu · sumber: Brankas Finance"
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="riwayat"
          :columns="kolom"
          empty="Belum ada pembagian."
        >
          <template #tgl-cell="{ row }">
            {{ tglPanjang(row.original.tgl) }}
          </template>
          <template #investor-cell="{ row }">
            <b>{{ row.original.investor || '—' }}</b>
          </template>
          <template #nominal-cell="{ row }">
            <span class="num">{{ rupiah(row.original.nominal) }}</span>
          </template>
        </UTable>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="(r, i) in riwayat"
            :key="i"
            class="flex items-start justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ r.investor || '—' }}
              </p>
              <p class="text-sm text-muted">
                {{ tglPanjang(r.tgl) }}
              </p>
            </div>
            <p class="shrink-0 font-semibold text-highlighted num">
              {{ rupiah(r.nominal) }}
            </p>
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
