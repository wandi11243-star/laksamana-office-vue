<!--
  Finance › Brankas › Mutasi & Transfer (old `vMutasi`, deploy/finance/brankas/index.html:1441-1525).

  Three kinds with an important difference: `masuk` (money from OUTSIDE),
  `keluar` (money OUT) and `pindah` (ONE row touching two wallets — two rows
  for one move will double the balance when one is deleted). Cash deposits
  from Rekap Penjualan are READ here, never copied: cancelling one happens
  where it was recorded. Manual rows are created/edited/deleted per record
  against the whole-blob version (`If-Match`); conflicts reload, never retry.
-->
<script setup lang="ts">
import { createVaultRec, deleteVaultRec, getVault, updateVaultRec } from '~/composables/useFinance'
import { useKompasState } from '~/composables/useCashier'
import { useBrankasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { fTgl, hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import type { MutasiBrankas } from '~/utils/brankas'
import { bankDariTujuan, namaWallet, saldoSemua, SEMUA_WADAH } from '~/utils/brankas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()
const toast = useToast()

const MUT_JENIS = [
  { k: 'pindah', n: 'Pindah antar wallet' },
  { k: 'masuk', n: 'Uang masuk dari luar (di luar omset harian)' },
  { k: 'keluar', n: 'Uang keluar ke luar' },
]
const jenisNama = (k?: string) => MUT_JENIS.find(j => j.k === k)?.n ?? String(k ?? '—')

const { data: vaultData, status: statusVault, error: vaultError, refresh } = useAsyncData('brankas-vault', () => getVault())
const kp = useKompasState()
const kompasData = computed(() => kp.error.value
  ? { state: null, gagal: true as boolean }
  : kp.status.value === 'success' ? { state: kp.data.value.value, gagal: false as boolean } : undefined)
const statusKompas = computed(() => (kp.error.value ? 'success' : kp.status.value))

const vault = computed(() => vaultData.value?.vault ?? {})
const kompas = computed(() => kompasData.value?.state ?? null)
const kompasGagal = computed(() => kompasData.value?.gagal === true)

// Skeleton only for the first load: the balances need both blobs, and a save refetch must not blank the cards.
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

interface BarisAuto extends MutasiBrankas { auto: true, kenal: boolean, tujuanTeks: string, hari: number }
const barisAuto = computed<BarisAuto[]>(() => ((kompas.value?.rekap_setoran ?? []) as { id?: string, tgl?: string, tujuan?: string, nominal?: unknown, hari?: string[], catatan?: string }[])
  .map(st => ({
    id: `st-${st.id}`, tgl: st.tgl, jenis: 'pindah', dari: 'cash',
    ke: bankDariTujuan(st.tujuan), nominal: num(st.nominal),
    ket: `Setoran cash${st.catatan ? ` — ${st.catatan}` : ''}`,
    auto: true as const, kenal: !!bankDariTujuan(st.tujuan),
    tujuanTeks: st.tujuan || '', hari: (st.hari ?? []).length,
  })))
const semua = computed<(MutasiBrankas & { auto?: boolean, kenal?: boolean, tujuanTeks?: string, hari?: number })[]>(() =>
  ([...(vault.value.mutasi ?? []), ...barisAuto.value] as MutasiBrankas[])
    .slice()
    .sort((a, b) => String(b.tgl || '') < String(a.tgl || '') ? -1 : 1))
const totalAuto = computed(() => barisAuto.value.reduce((s, m) => s + num(m.nominal), 0))
const takKenal = computed(() => barisAuto.value.filter(m => !m.kenal))

// ---- form (the same form edits: MU_EDIT in the old page) ----
const suntingId = ref<string | null>(null)
const form = reactive({ jenis: 'pindah', tgl: hariIni(), nominal: '', dari: 'cash', ke: 'bri', ket: '' })
function mulaiTambah() {
  suntingId.value = null
  form.jenis = 'pindah'
  form.tgl = hariIni()
  form.nominal = ''
  form.dari = 'cash'
  form.ke = 'bri'
  form.ket = ''
}
function mulaiSunting(m: MutasiBrankas) {
  if (!izin.ubah('mutasi')) return
  suntingId.value = String(m.id)
  form.jenis = String(m.jenis || 'pindah')
  form.tgl = String(m.tgl || hariIni())
  form.nominal = String(num(m.nominal) || '')
  form.dari = String(m.dari || 'cash')
  form.ke = String(m.ke || 'bri')
  form.ket = String(m.ket || '')
}

const sibuk = ref(false)
async function simpan() {
  if (!vaultData.value || !izin.ubah('mutasi') || sibuk.value) return
  const n = num(form.nominal)
  if (!n) {
    toast.add({ title: 'Nominal wajib diisi.', color: 'error' })
    return
  }
  if (!form.tgl) {
    toast.add({ title: 'Tanggal wajib diisi.', color: 'error' })
    return
  }
  if (form.jenis === 'pindah' && form.dari === form.ke) {
    toast.add({ title: 'Wallet asal dan tujuan tidak boleh sama.', color: 'error' })
    return
  }
  const isi = {
    tgl: form.tgl,
    jenis: form.jenis,
    dari: form.jenis === 'masuk' ? '' : form.dari,
    ke: form.jenis === 'keluar' ? '' : form.ke,
    nominal: n,
    ket: form.ket.trim(),
  }
  sibuk.value = true
  try {
    const versi = vaultData.value.version ?? ''
    if (suntingId.value) {
      await updateVaultRec('mutasi', suntingId.value, isi, versi, 'PUT')
      toast.add({ title: 'Perubahan mutasi tersimpan.', color: 'success' })
    }
    else {
      await createVaultRec('mutasi', isi, versi)
      toast.add({ title: 'Mutasi tersimpan.', color: 'success' })
    }
    mulaiTambah()
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// ---- delete (manual rows only; auto rows live in Rekap Penjualan) ----
const hapusTarget = ref<MutasiBrankas | null>(null)
const hapusOpen = ref(false)
function tanyaHapus(m: MutasiBrankas) {
  hapusTarget.value = m
  hapusOpen.value = true
}
async function jalanHapus() {
  if (!vaultData.value || !hapusTarget.value || !izin.ubah('mutasi') || sibuk.value) return
  sibuk.value = true
  try {
    await deleteVaultRec('mutasi', String(hapusTarget.value.id), vaultData.value.version ?? '')
    toast.add({ title: 'Mutasi dihapus. Saldo wallet yang terlibat berubah.', color: 'success' })
    if (suntingId.value === String(hapusTarget.value.id)) mulaiTambah()
    hapusOpen.value = false
    hapusTarget.value = null
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

onMounted(() => mulaiTambah())

const opsiWallet = computed(() => SEMUA_WADAH.map(k => ({ label: namaWallet(k), value: k })))
</script>

<template>
  <AppPage
    title="Mutasi & transfer"
    description="Setor, tarik, dan pindah uang antar wallet."
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
      v-if="!izin.lihat('mutasi')"
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
      <AppStatGrid
        :loading="statMemuat"
        :count="SEMUA_WADAH.length"
      >
        <AppStat
          v-for="k in SEMUA_WADAH"
          :key="k"
          :label="namaWallet(k)"
          icon="i-lucide-wallet"
          :value="fmtRp(saldo[k]?.saldo ?? 0)"
          sub="saldo berjalan"
        />
      </AppStatGrid>

      <UAlert
        v-if="kompasGagal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Setoran cash dari Rekap Penjualan tidak terbaca. Daftar di bawah cuma memuat mutasi yang diketik di halaman ini, jadi belum lengkap."
        class="mb-4"
      />
      <UAlert
        v-if="barisAuto.length"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        class="mb-4"
        :title="`${barisAuto.length} setoran cash dari Rekap Penjualan ikut di daftar ini. Total ${fmtRp(totalAuto)} berpindah dari brankas fisik ke bank. Barisnya DIBACA dari Rekap Penjualan, tidak disalin — yang membatalkan setoran melakukannya di sana, dan daftar ini langsung ikut.`"
      />
      <UAlert
        v-if="takKenal.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        :title="`${takKenal.length} setoran tujuannya tidak dikenali sebagai BRI / Mandiri / BCA / UOB, jadi uangnya keluar dari brankas fisik tapi tidak masuk ke bank mana pun. Betulkan tujuannya di Rekap Penjualan → Setoran Cash.`"
      />

      <AppPanel
        v-if="izin.ubah('mutasi')"
        :title="suntingId ? 'Ubah mutasi' : 'Catat mutasi'"
        description="Pindah antar wallet dicatat SATU baris, bukan dua. Dua baris yang salah satunya terhapus membuat uang perusahaan bertambah atau hilang tanpa ada yang menyadarinya."
        class="mb-5"
      >
        <p
          v-if="suntingId"
          class="mb-3 text-sm text-muted"
        >
          Sedang menyunting mutasi. Saldo wallet yang terlibat ikut berubah begitu disimpan.
        </p>
        <AppFilterGrid>
          <UFormField label="Jenis">
            <USelect
              v-model="form.jenis"
              :items="MUT_JENIS.map(j => ({ label: j.n, value: j.k }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tanggal">
            <UInput
              v-model="form.tgl"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Nominal">
            <UInput
              v-model="form.nominal"
              inputmode="numeric"
              placeholder="0"
              class="w-full num"
            />
          </UFormField>
          <UFormField
            v-if="form.jenis !== 'masuk'"
            label="Dari wallet"
          >
            <USelect
              v-model="form.dari"
              :items="opsiWallet"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="form.jenis !== 'keluar'"
            label="Ke wallet"
          >
            <USelect
              v-model="form.ke"
              :items="opsiWallet"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Keterangan">
            <UInput
              v-model="form.ket"
              placeholder="mis. top-up kas operasional"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <p class="mb-3 text-sm text-muted">
          <b>Uang masuk dari luar</b> untuk pemasukan cash yang TIDAK lewat POS — sewa tempat, penjualan barang bekas,
          titipan yang dikembalikan. Yang sudah masuk omset harian jangan dicatat lagi di sini: ia sudah terhitung lewat
          <b>Aktual Masuk</b> di Rekap Penjualan, dan mencatatnya dua kali menaikkan saldo tanpa satu pun uang yang benar-benar datang.
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="suntingId ? 'Simpan perubahan' : 'Simpan mutasi'"
            icon="i-lucide-save"
            :loading="sibuk"
            @click="simpan"
          />
          <UButton
            v-if="suntingId"
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="mulaiTambah"
          />
        </div>
      </AppPanel>

      <AppPanel
        title="Riwayat mutasi"
        :description="`${semua.length} baris · manual + otomatis Rekap Penjualan, terbaru dulu`"
        flush
      >
        <div
          v-if="semua.length"
          class="divide-y divide-default"
        >
          <div
            v-for="m in semua"
            :key="String(m.id)"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm lg:px-5"
          >
            <span class="min-w-0">
              <b class="text-highlighted">{{ fTgl(m.tgl) }}</b>
              <span class="ml-2">{{ jenisNama(m.jenis) }}</span>
              <AppStatus
                v-if="m.auto"
                color="info"
                size="sm"
              >
                Rekap Penjualan
              </AppStatus>
              <span class="block text-[12px] text-muted">
                {{ m.jenis === 'masuk' ? 'luar brankas' : namaWallet(m.dari) }} → {{ m.jenis === 'keluar' ? 'luar brankas' : namaWallet(m.ke) }}
                <template v-if="m.auto && !m.kenal"> · <span class="text-warning">{{ m.tujuanTeks || 'tanpa tujuan' }}</span></template>
                · {{ m.ket || '—' }}
                <template v-if="m.auto && m.hari"> · mencakup {{ m.hari }} hari</template>
              </span>
            </span>
            <span class="flex items-center gap-2">
              <b class="num">{{ fmtRp(num(m.nominal)) }}</b>
              <template v-if="!m.auto && izin.ubah('mutasi')">
                <UButton
                  label="Ubah"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="mulaiSunting(m)"
                />
                <UButton
                  label="Hapus"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="tanyaHapus(m)"
                />
              </template>
              <span
                v-else-if="m.auto"
                class="text-[12px] text-muted"
              >dari Rekap Penjualan</span>
            </span>
          </div>
        </div>
        <p
          v-else
          class="px-4 py-6 text-center text-sm text-muted"
        >
          Belum ada mutasi yang dicatat.
        </p>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="hapusOpen"
        title="Hapus mutasi ini?"
      >
        <p class="text-sm">
          {{ hapusTarget ? `${fTgl(hapusTarget.tgl)} · ${fmtRp(num(hapusTarget.nominal))}` : '' }} — saldo wallet yang terlibat akan berubah.
          Baris otomatis dari Rekap Penjualan tidak bisa dihapus di sini.
        </p>
        <template #footer>
          <UButton
            label="Ya, hapus"
            color="error"
            :loading="sibuk"
            @click="jalanHapus"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="hapusOpen = false"
          />
        </template>
      </ResponsiveSheet>
    </template>
  </AppPage>
</template>
