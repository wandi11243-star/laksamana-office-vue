<!--
  Finance › Brankas › Ringkasan (old `vRingkasan`, deploy/finance/brankas/index.html:1142-1192).

  The company's cash position: liquid total, outstanding bon (read from the
  kompas blob, never typed here), obligations due within 30 days (from the
  `bayar` list this blob still owns) and the runway. Balances are computed by
  `saldoSemua` in `~/utils/brankas` — never typed by anyone.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getVault } from '~/composables/useFinance'
import { useKompasState } from '~/composables/useCashier'
import { useBrankasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { tglRingkas } from '~/utils/format'
import { namaWallet, saldoSemua, selisihHari, SEMUA_WADAH } from '~/utils/brankas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()

const { data: vaultData, status: statusVault, error: vaultError, refresh } = useAsyncData('brankas-vault', () => getVault())
const kp = useKompasState()
const kompasData = computed(() => kp.error.value
  ? { state: null, gagal: true as boolean }
  : kp.status.value === 'success' ? { state: kp.data.value.value, gagal: false as boolean } : undefined)
const statusKompas = computed(() => (kp.error.value ? 'success' : kp.status.value))

const vault = computed(() => vaultData.value?.vault ?? {})
const kompas = computed(() => kompasData.value?.state ?? null)
const kompasGagal = computed(() => kompasData.value?.gagal === true)

// Skeleton only for the first load: the cards need both blobs, and a refresh keeps the old numbers.
const statMemuat = computed(() => (!vaultData.value || !kompasData.value)
  && ((statusVault.value === 'pending' || statusVault.value === 'idle') || (statusKompas.value === 'pending' || statusKompas.value === 'idle')))

const saldo = computed(() => saldoSemua({
  reports: (kompas.value?.reports ?? {}) as never,
  daily: kompas.value?.daily ?? null,
  piutang: kompas.value?.piutang ?? null,
  setoran: (kompas.value?.rekap_setoran ?? []) as never,
  bayar: (vault.value.bayar ?? []) as never,
  mutasi: (vault.value.mutasi ?? []) as never,
  investor: (vault.value.investor ?? []) as never,
  setting: (vault.value.setting ?? {}) as never,
}))
const likuid = computed(() => SEMUA_WADAH.reduce((s, k) => s + (saldo.value[k]?.saldo ?? 0), 0))

const bon = computed(() => ((kompas.value?.piutang ?? []) as { status?: string, nominal?: unknown }[]).filter(b => b.status !== 'lunas'))
const piutang = computed(() => bon.value.reduce((s, b) => s + num(b.nominal), 0))

const jadwal = computed(() => ((vault.value.bayar ?? []) as { status?: string }[]).filter(p => p.status === 'scheduled'))
const wajib30 = computed(() => ((vault.value.bayar ?? []) as { status?: string, dueDate?: string, amount?: unknown }[])
  .filter((p) => {
    if (p.status !== 'scheduled') return false
    const d = selisihHari(p.dueDate)
    return d !== null && d >= 0 && d <= 30
  })
  .reduce((s, p) => s + num(p.amount), 0))

const burn = computed(() => num((vault.value.setting as Record<string, unknown> | undefined)?.burn))
const runway = computed(() => (burn.value > 0 ? likuid.value / burn.value : null))

const modalKeluar = computed(() => SEMUA_WADAH.reduce((s, k) => s + (saldo.value[k]?.modal ?? 0), 0))
const modalMasuk = computed(() => SEMUA_WADAH.reduce((s, k) => s + (saldo.value[k]?.modalMasuk ?? 0), 0))
const pindahAda = computed(() => ((vault.value.mutasi ?? []) as { jenis?: string }[]).filter(m => m.jenis === 'pindah').length)

const dekat = computed(() => ((vault.value.bayar ?? []) as { status?: string, dueDate?: string, name?: string, amount?: unknown }[])
  .filter(p => p.status === 'scheduled')
  .sort((a, b) => String(a.dueDate || '') < String(b.dueDate || '') ? -1 : 1)
  .slice(0, 6))

// The two tables of the old Ringkasan.
const KANAN = { class: { th: 'text-right', td: 'text-right' } }
const barisPosisi = computed(() => SEMUA_WADAH.map(k => ({ k, saldo: saldo.value[k]?.saldo ?? 0 })))
const kolomPosisi = computed<TableColumn<(typeof barisPosisi.value)[number]>[]>(() => [
  { id: 'wadah', header: 'Wadah', footer: 'Total' },
  { id: 'saldo', header: 'Saldo', footer: fmtRp(likuid.value), meta: KANAN },
])
const kolomDekat: TableColumn<(typeof dekat.value)[number]>[] = [
  { id: 'name', header: 'Kewajiban', meta: { class: { td: 'whitespace-normal' } } },
  { id: 'due', header: 'Jatuh tempo' },
  { id: 'amount', header: 'Nominal', meta: KANAN },
]

function jatuhTempo(due?: string): string {
  const d = selisihHari(due)
  if (d === null) return ''
  if (d < 0) return `lewat ${-d} hari`
  if (d === 0) return 'hari ini'
  return `${d} hari lagi`
}
</script>

<template>
  <AppPage
    title="Ringkasan brankas"
    description="Posisi kas perusahaan dan keputusan terdekat."
  >
    <template #actions>
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('ringkasan')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="vaultError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(vaultError)}`"
    />

    <template v-else>
      <UAlert
        v-if="kompasGagal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Data Rekap Penjualan tidak terbaca, jadi saldo rekening belum bisa dihitung."
        class="mb-4"
      />

      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Total kas likuid"
          icon="i-lucide-vault"
          :value="fmtRp(likuid)"
          sub="5 wadah (4 bank + brankas fisik)"
        />
        <AppStat
          label="Uang pending / piutang"
          icon="i-lucide-hourglass"
          :value="fmtRp(piutang)"
          :sub="kompas ? `${bon.length} bon belum dibayar` : 'Rekap Penjualan tak terbaca'"
          :tone="piutang ? 'warning' : undefined"
        />
        <AppStat
          label="Kewajiban 30 hari"
          icon="i-lucide-calendar-clock"
          :value="fmtRp(wajib30)"
          :sub="`${jadwal.length} pembayaran terjadwal`"
          :tone="wajib30 ? 'warning' : undefined"
        />
        <AppStat
          label="Runway"
          icon="i-lucide-trending-down"
          :value="runway === null ? '—' : `${runway.toFixed(1)} bulan`"
          :sub="burn > 0 ? `biaya bulanan ${fmtRp(burn)}` : 'isi biaya bulanan di Pengaturan'"
        />
      </AppStatGrid>

      <UAlert
        v-if="modalKeluar || modalMasuk || pindahAda"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        class="mb-4"
        :title="[
          modalMasuk ? `Sudah ${fmtRp(modalMasuk)} masuk sebagai tambahan modal investor.` : '',
          modalKeluar ? `Sudah ${fmtRp(modalKeluar)} keluar sebagai pengembalian modal investor.` : '',
          pindahAda ? `${pindahAda} pemindahan antar wallet tercatat — pemindahan tidak mengubah total kas, cuma letaknya.` : '',
        ].filter(Boolean).join(' ')"
      />

      <div class="grid gap-5 lg:grid-cols-2">
        <AppPanel
          title="Posisi per wadah"
          description="Saldo berjalan tiap bank dan brankas fisik"
          flush
        >
          <UTable
            :columns="kolomPosisi"
            :data="barisPosisi"
            class="hidden lg:block"
          >
            <template #wadah-cell="{ row }">
              {{ namaWallet(row.original.k) }}
            </template>
            <template #saldo-cell="{ row }">
              <b class="num text-highlighted">{{ fmtRp(row.original.saldo) }}</b>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="k in SEMUA_WADAH"
              :key="k"
              class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm lg:px-5"
            >
              <b class="text-highlighted">{{ namaWallet(k) }}</b>
              <span class="num">{{ fmtRp(saldo[k]?.saldo ?? 0) }}</span>
            </div>
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm lg:px-5">
              <b class="text-highlighted">Total</b>
              <b class="num">{{ fmtRp(likuid) }}</b>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Jatuh tempo terdekat"
          description="Enam kewajiban paling dekat"
          flush
        >
          <UTable
            v-if="dekat.length"
            :columns="kolomDekat"
            :data="dekat"
            class="hidden lg:block"
          >
            <template #name-cell="{ row }">
              {{ row.original.name || '(tanpa nama)' }}
            </template>
            <template #due-cell="{ row }">
              {{ tglRingkas(row.original.dueDate) }}
              <span class="block text-xs text-muted">{{ jatuhTempo(row.original.dueDate) }}</span>
            </template>
            <template #amount-cell="{ row }">
              <span class="num">{{ fmtRp(num(row.original.amount)) }}</span>
            </template>
          </UTable>
          <div
            v-if="dekat.length"
            class="divide-y divide-default lg:hidden"
          >
            <div
              v-for="p in dekat"
              :key="`${p.dueDate}-${p.name}`"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
            >
              <span class="min-w-0">
                <b class="text-highlighted">{{ p.name || '(tanpa nama)' }}</b>
                <span class="block text-[12px] text-muted">{{ tglRingkas(p.dueDate) }} · {{ jatuhTempo(p.dueDate) }}</span>
              </span>
              <b class="num">{{ fmtRp(num(p.amount)) }}</b>
            </div>
          </div>
          <p
            v-else
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Tidak ada pembayaran terjadwal.
          </p>
        </AppPanel>
      </div>
    </template>
  </AppPage>
</template>
