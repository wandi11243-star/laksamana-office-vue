<!--
  Finance › Brankas › Saldo & Rekening (old `vSaldo`, deploy/finance/brankas/index.html:1199-1275).

  READ-ONLY. The notice on top says it plainly: nobody types these balances.
  They come from Aktual Masuk per payment group in Rekap Penjualan (every
  recorded day summed), plus opening balances, shifted by cash deposits and
  paid plans. Groups without a wallet are REPORTED (petaBelum), and deposits
  to an unknown destination are reported, not forced into a bank.
-->
<script setup lang="ts">
import { getVault } from '~/composables/useFinance'
import { getKompasState } from '~/composables/useCashier'
import { useBrankasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { fTgl } from '~/utils/format'
import { aktualPerGrup, bankDariTujuan, grupBelumDipetakan, namaWallet, petaGrupWallet, saldoSemua, SEMUA_WADAH } from '~/utils/brankas'
import { RK_GRUP } from '~/utils/kompas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()

const { data: vaultData, error: vaultError, refresh } = useAsyncData('brankas-vault', () => getVault())
const { data: kompasData } = useAsyncData('brankas-kompas', async () => {
  try {
    return { state: (await getKompasState()).value, gagal: false as boolean }
  }
  catch {
    return { state: null, gagal: true as boolean }
  }
})

const vault = computed(() => vaultData.value?.vault ?? {})
const kompas = computed(() => kompasData.value?.state ?? null)

const setting = computed(() => (vault.value.setting ?? {}) as never)
const peta = computed(() => petaGrupWallet(setting.value))
const belum = computed(() => grupBelumDipetakan(setting.value))

const saldo = computed(() => saldoSemua({
  reports: (kompas.value?.reports ?? {}) as never,
  daily: kompas.value?.daily ?? null,
  piutang: kompas.value?.piutang ?? null,
  setoran: (kompas.value?.rekap_setoran ?? []) as never,
  bayar: (vault.value.bayar ?? []) as never,
  mutasi: (vault.value.mutasi ?? []) as never,
  investor: (vault.value.investor ?? []) as never,
  setting: setting.value,
}))
const likuid = computed(() => SEMUA_WADAH.reduce((s, k) => s + (saldo.value[k]?.saldo ?? 0), 0))
const nHari = computed(() => Object.keys(kompas.value?.reports ?? {}).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t)).length)

const aktualGrup = computed(() => aktualPerGrup({
  reports: (kompas.value?.reports ?? {}) as never,
  daily: kompas.value?.daily ?? null,
  piutang: kompas.value?.piutang ?? null,
}))

const setoran = computed(() => ((kompas.value?.rekap_setoran ?? []) as { id?: string, tgl?: string, tujuan?: string, nominal?: unknown, hari?: string[] }[])
  .slice()
  .sort((a, b) => String(b.tgl || '') < String(a.tgl || '') ? -1 : 1))
const setoranTakDikenal = computed(() => setoran.value.filter(x => !bankDariTujuan(x.tujuan)))

function garis(o: number | undefined, selalu = false): string {
  const v = o ?? 0
  return v || selalu ? fmtRp(v) : '—'
}
</script>

<template>
  <AppPage
    title="Saldo & rekening"
    description="Dihitung dari Aktual Masuk di Rekap Penjualan."
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
      v-if="!izin.lihat('saldo')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="vaultError || !kompas"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="vaultError ? `Gagal memuat: ${apiErrorMessage(vaultError)}` : 'Data Rekap Penjualan tidak terbaca, jadi saldo rekening belum bisa dihitung.'"
    />

    <template v-else>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        class="mb-4"
        :title="`Saldo di halaman ini tidak diketik siapa pun. Ia dihitung dari Aktual Masuk tiap metode pembayaran di Rekap Penjualan (${nHari} hari tercatat), ditambah saldo awal, lalu digeser oleh setoran cash ke bank dan pembayaran yang sudah dibayar. Aktual masuk untuk Cash memang sama dengan aktual kotor — cash tidak dipotong MDR.`"
      />

      <UAlert
        v-if="belum.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        :title="`${belum.length} metode pembayaran belum punya tujuan bank. Uangnya nyata tapi belum masuk ke wadah mana pun, jadi total di bawah lebih kecil daripada yang sebenarnya: ${belum.map(g => g.n).join(', ')}. Petakan di Pengaturan.`"
      />

      <AppPanel
        title="Saldo per wadah"
        description="Saldo awal + aktual masuk + setoran − keluar"
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="k in SEMUA_WADAH"
            :key="k"
            class="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-7 lg:px-5"
          >
            <b class="col-span-2 text-highlighted sm:col-span-3 lg:col-span-1">{{ namaWallet(k) }}</b>
            <span><span class="block text-[12px] text-muted">Awal</span><b class="num text-highlighted">{{ garis(saldo[k]?.awal, true) }}</b></span>
            <span><span class="block text-[12px] text-muted">Masuk</span><b class="num text-highlighted">{{ garis(saldo[k]?.masuk, true) }}</b></span>
            <span><span class="block text-[12px] text-muted">Setoran</span><b class="num text-highlighted">{{ garis((saldo[k]?.setorMasuk ?? 0) - (saldo[k]?.setorKeluar ?? 0)) }}</b></span>
            <span><span class="block text-[12px] text-muted">Mutasi</span><b class="num text-highlighted">{{ garis((saldo[k]?.mutMasuk ?? 0) - (saldo[k]?.mutKeluar ?? 0) + (saldo[k]?.modalMasuk ?? 0)) }}</b></span>
            <span><span class="block text-[12px] text-muted">Keluar</span><b class="num text-highlighted">{{ garis((saldo[k]?.keluar ?? 0) + (saldo[k]?.modal ?? 0)) }}</b></span>
            <b class="num text-highlighted">{{ fmtRp(saldo[k]?.saldo ?? 0) }}</b>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-3 text-sm lg:px-5">
            <b class="text-highlighted">Total</b>
            <b class="num">{{ fmtRp(likuid) }}</b>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Aktual masuk per metode"
        description="Seluruh hari yang tercatat di Rekap Penjualan, dijumlahkan — cocokkan dengan Rekap baris demi baris"
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="g in RK_GRUP.filter(x => x.k !== 'error')"
            :key="g.k"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
          >
            <span class="min-w-0">
              <b class="text-highlighted">{{ g.n }}</b>
              <span
                v-if="!g.mdr"
                class="block text-[12px] text-muted"
              >tanpa MDR — aktual masuk = aktual kotor</span>
              <span
                v-else-if="peta[g.k] && SEMUA_WADAH.includes(peta[g.k]!)"
                class="block text-[12px] text-muted"
              >masuk ke {{ namaWallet(peta[g.k]) }}</span>
              <AppStatus
                v-else
                color="warning"
                size="sm"
              >
                belum dipetakan
              </AppStatus>
            </span>
            <b class="num">{{ fmtRp(aktualGrup[g.k] ?? 0) }}</b>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Setoran cash ke bank"
        description="Dicatat di Rekap Penjualan. Bank bertambah, brankas fisik berkurang."
        flush
      >
        <UAlert
          v-if="setoranTakDikenal.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          class="mx-4 mt-4 lg:mx-5"
          :title="`${setoranTakDikenal.length} setoran tujuannya tidak dikenali sebagai BRI / Mandiri / BCA / UOB, jadi uangnya keluar dari brankas fisik tapi tidak masuk ke bank mana pun. Betulkan tujuannya di Rekap Penjualan → Setoran Cash.`"
        />
        <div
          v-if="setoran.length"
          class="divide-y divide-default"
        >
          <div
            v-for="x in setoran"
            :key="String(x.id)"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
          >
            <span class="min-w-0">
              <b class="text-highlighted">{{ fTgl(x.tgl) }}</b>
              <span class="block text-[12px] text-muted">
                {{ x.tujuan || '—' }}
                <template v-if="!bankDariTujuan(x.tujuan)"> · <span class="text-warning">tak dikenal</span></template>
                · {{ (x.hari ?? []).length }} hari
              </span>
            </span>
            <b class="num">{{ fmtRp(num(x.nominal)) }}</b>
          </div>
        </div>
        <p
          v-else
          class="px-4 py-6 text-center text-sm text-muted"
        >
          Belum ada setoran cash yang tercatat.
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
