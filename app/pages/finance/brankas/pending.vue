<!--
  Finance › Brankas › Uang Pending / Piutang (old `vPending`, deploy/finance/brankas/index.html:1307-1340).

  READ-ONLY on purpose: guest bon are recorded and settled by the cashier in
  Cashier → Piutang / Bon — the blob is the SAME kompas blob, so the data is
  already here with no extra request. Something typed in two places will have
  two different numbers one day.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useKompasState } from '~/composables/useCashier'
import { bonTipeNama, fmtRp, num } from '~/utils/cashier'
import { useBrankasIzin } from '~/utils/layar/finance'
import { tglRingkas } from '~/utils/format'
import { selisihHari } from '~/utils/brankas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()

const kp = useKompasState()
const kompasData = computed(() => {
  if (kp.error.value) return { state: null, gagal: true as boolean, sebab: kp.error.value }
  if (kp.status.value !== 'success') return undefined
  return { state: kp.data.value.value, gagal: false as boolean }
})
const status = computed(() => (kp.error.value ? 'success' : kp.status.value))
const error = computed(() => null)
const refresh = () => kp.refresh()

const semuaBon = computed(() => ((kompasData.value?.state?.piutang ?? []) as { status?: string, nominal?: unknown }[]))
const belum = computed(() => semuaBon.value.filter(b => b.status !== 'lunas'))
const total = computed(() => belum.value.reduce((s, b) => s + num(b.nominal), 0))
const lunasTotal = computed(() => semuaBon.value.filter(b => b.status === 'lunas').reduce((s, b) => s + num(b.nominal), 0))

interface OrangBon { nama: string, tipe: string, n: number, jml: number, lama: string }
const orang = computed<OrangBon[]>(() => {
  const peta = new Map<string, OrangBon>()
  for (const b of belum.value as { nama?: string, tipe?: string, date?: string, nominal?: unknown }[]) {
    const k = `${b.nama || '(tanpa nama)'}|${b.tipe || 'lain'}`
    const o = peta.get(k) ?? { nama: b.nama || '(tanpa nama)', tipe: b.tipe || 'lain', n: 0, jml: 0, lama: '' }
    o.n++
    o.jml += num(b.nominal)
    if (!o.lama || String(b.date) < o.lama) o.lama = String(b.date)
    peta.set(k, o)
  }
  return [...peta.values()].sort((x, y) => y.jml - x.jml)
})
const tertua = computed(() => belum.value.reduce((a: string, b) => {
  const d = String((b as { date?: string }).date || '')
  return (!a || (d && d < a)) ? d : a
}, ''))
const umurTertua = computed(() => (tertua.value ? -(selisihHari(tertua.value) ?? 0) : 0))

interface BarisBon { date?: string, nama?: string, tipe?: string, bill?: string, nominal?: unknown }
const rincian = computed(() => (belum.value as BarisBon[])
  .slice()
  .sort((a, b) => String(a.date) < String(b.date) ? -1 : 1))

// The two tables of the old page, same columns in the same order.
const KANAN = { class: { th: 'text-right', td: 'text-right' } }
const kolomOrang = computed<TableColumn<OrangBon>[]>(() => [
  { id: 'nama', header: 'Nama', footer: 'Total' },
  { id: 'tipe', header: 'Tipe' },
  { id: 'n', header: 'Jumlah bon', meta: KANAN },
  { id: 'lama', header: 'Bon tertua' },
  { id: 'jml', header: 'Nominal', footer: fmtRp(total.value), meta: KANAN },
])
const kolomRincian: TableColumn<BarisBon>[] = [
  { id: 'date', header: 'Tanggal' },
  { id: 'nama', header: 'Nama' },
  { id: 'tipe', header: 'Tipe' },
  { id: 'bill', header: 'No. bill' },
  { id: 'nominal', header: 'Nominal', meta: KANAN },
]

// Skeleton only for the first load: this page only reads the shared kompas blob.
const statMemuat = computed(() => !kompasData.value && (status.value === 'pending' || status.value === 'idle'))
</script>

<template>
  <AppPage
    title="Uang pending / piutang"
    description="Bon yang dicatat kasir dan belum dibayar tamu."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('pending')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error || kompasData?.gagal"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="error ? `Gagal memuat: ${apiErrorMessage(error)}` : 'Data piutang tidak terbaca.'"
    />

    <template v-else>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Halaman ini hanya membaca."
        description="Bon dicatat dan dilunaskan kasir di modul Cashier → Piutang / Bon. Yang bisa diketik di dua tempat akan punya dua angka berbeda suatu hari, dan yang mencocokkannya tidak punya cara tahu mana yang benar."
        class="mb-4"
      />

      <AppStatGrid
        :loading="statMemuat"
        :count="3"
      >
        <AppStat
          label="Belum dibayar"
          :value="fmtRp(total)"
          :sub="`${belum.length} bon dari ${orang.length} orang`"
        />
        <AppStat
          label="Bon tertua"
          :value="tertua ? tglRingkas(tertua) : '—'"
          :sub="tertua ? (umurTertua > 0 ? `${umurTertua} hari menggantung` : 'hari ini') : 'tidak ada bon terbuka'"
        />
        <AppStat
          label="Sudah lunas"
          :value="fmtRp(lunasTotal)"
          sub="sepanjang catatan"
        />
      </AppStatGrid>

      <AppPanel
        title="Per orang"
        description="Yang ditagih adalah orangnya, bukan barisnya"
        flush
      >
        <template v-if="orang.length">
          <UTable
            :columns="kolomOrang"
            :data="orang"
            class="hidden lg:block"
          >
            <template #nama-cell="{ row }">
              <b class="text-highlighted">{{ row.original.nama }}</b>
            </template>
            <template #tipe-cell="{ row }">
              <AppStatus
                color="neutral"
                size="sm"
              >
                {{ bonTipeNama(row.original.tipe) }}
              </AppStatus>
            </template>
            <template #n-cell="{ row }">
              {{ row.original.n }}
            </template>
            <template #lama-cell="{ row }">
              {{ tglRingkas(row.original.lama) }}
            </template>
            <template #jml-cell="{ row }">
              <b class="num text-highlighted">{{ fmtRp(row.original.jml) }}</b>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="o in orang"
              :key="`${o.nama}|${o.tipe}`"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm"
            >
              <span class="min-w-0">
                <b class="text-highlighted">{{ o.nama }}</b>
                <AppStatus
                  color="neutral"
                  size="sm"
                  class="ml-2"
                >
                  {{ bonTipeNama(o.tipe) }}
                </AppStatus>
                <span class="block text-[12px] text-muted">{{ o.n }} bon · tertua {{ tglRingkas(o.lama) }}</span>
              </span>
              <b class="num">{{ fmtRp(o.jml) }}</b>
            </div>
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <b class="text-highlighted">Total</b>
              <b class="num">{{ fmtRp(total) }}</b>
            </div>
          </div>
        </template>
        <p
          v-else
          class="px-4 py-6 text-center text-sm text-muted"
        >
          Tidak ada bon yang belum dibayar.
        </p>
      </AppPanel>

      <AppPanel
        title="Rincian bon belum dibayar"
        flush
      >
        <template v-if="rincian.length">
          <UTable
            :columns="kolomRincian"
            :data="rincian"
            class="hidden lg:block"
          >
            <template #date-cell="{ row }">
              {{ tglRingkas(row.original.date) }}
            </template>
            <template #nama-cell="{ row }">
              {{ row.original.nama || '—' }}
            </template>
            <template #tipe-cell="{ row }">
              {{ bonTipeNama(row.original.tipe) }}
            </template>
            <template #bill-cell="{ row }">
              {{ row.original.bill || '—' }}
            </template>
            <template #nominal-cell="{ row }">
              <span class="num">{{ fmtRp(num(row.original.nominal)) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="(b, i) in rincian"
              :key="`${b.date}-${b.bill}-${i}`"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm"
            >
              <span class="min-w-0">
                <b class="text-highlighted">{{ b.nama || '—' }}</b>
                <span class="ml-2 text-muted">{{ bonTipeNama(b.tipe) }}</span>
                <span class="block text-[12px] text-muted">{{ tglRingkas(b.date) }} · Bill {{ b.bill || '—' }}</span>
              </span>
              <b class="num">{{ fmtRp(num(b.nominal)) }}</b>
            </div>
          </div>
        </template>
        <p
          v-else
          class="px-4 py-6 text-center text-sm text-muted"
        >
          Tidak ada bon terbuka.
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
