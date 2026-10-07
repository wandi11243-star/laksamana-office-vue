<!--
  Finance › Kas Kecil › Planning Pembayaran (old `viewBayar`, deploy/finance/kas/index.html:7057-7400).

  Weekly transfer sheets per paying account. The `bayar` list lives in the
  VAULT blob but this panel writes it narrowly (`bayarSave` → PUT payment-plan);
  the rest of the vault is untouched. DEFERRED & noted: the wallet balances
  (G-06 — the endpoint is gated `brankas`), the vendor datalist (stock module)
  and proof uploads. Rows are typed by hand for now.
-->
<script setup lang="ts">
import type { RencanaBayar } from '~/composables/useFinance'
import { getBayar, putBayar } from '~/composables/useFinance'
import { useKasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()

const BAYAR_KAT = ['Bahan baku', 'Minuman', 'Rokok', 'Gas & Utilitas', 'Jasa & Langganan', 'Sewa', 'Gaji', 'Pajak', 'Cicilan', 'Bagi hasil', 'Kas kecil', 'Lainnya']

const { data, error, refresh } = useAsyncData('kas-bayar', () => getBayar())

const rows = ref<RencanaBayar[]>([])
const kotor = ref(false)
watch(data, () => {
  rows.value = (data.value?.bayar ?? []).map(r => ({ ...r }))
  kotor.value = false
}, { immediate: true })

const batchTerpilih = ref('berjalan')
const batches = computed(() => [...new Set(rows.value.map(r => String(r.batch || '')).filter(Boolean))].sort())
const batchAktif = computed(() => (batchTerpilih.value === 'berjalan' ? hariIni() : batchTerpilih.value))
const tampil = computed(() => rows.value.filter(r => String(r.batch || '') === batchAktif.value))
const tanpaBatch = computed(() => rows.value.filter(r => !r.batch))

const totBatch = computed(() => tampil.value.reduce((s, r) => s + num(r.amount), 0))
const sudah = computed(() => tampil.value.filter(r => r.status === 'paid').reduce((s, r) => s + num(r.amount), 0))
const buktiAda = computed(() => tampil.value.filter(r => r.bukti?.ok).length)

function barisBaru() {
  rows.value.push({ id: `baru-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`, batch: batchAktif.value, kategori: BAYAR_KAT[0], status: 'scheduled', amount: 0, vendor: '', keterangan: '', dari: '' })
  kotor.value = true
}
function buang(r: RencanaBayar) {
  rows.value = rows.value.filter(x => x.id !== r.id)
  kotor.value = true
}
const set = (r: RencanaBayar, k: string, v: unknown) => {
  r[k] = v
  kotor.value = true
}

const sibuk = ref(false)
async function simpan() {
  if (!data.value || !izin.ubah('bayar') || sibuk.value) return
  sibuk.value = true
  try {
    await putBayar(rows.value.map(r => ({ ...r, amount: num(r.amount) })), data.value.version ?? '')
    kotor.value = false
    toast.add({ title: 'Lembar pembayaran disimpan.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Planning pembayaran"
    description="Lembar transfer mingguan per rekening pembayar — pindah dari panel Brankas."
  >
    <UAlert
      v-if="!izin.lihat('bayar')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Nilai batch"
          icon="i-lucide-banknote"
          :value="fmtRp(totBatch)"
          :sub="`${tampil.length} baris di lembar ${batchAktif}`"
        />
        <AppStat
          label="Sudah dibayar"
          icon="i-lucide-check"
          :value="fmtRp(sudah)"
          :sub="`${tampil.filter(r => r.status === 'paid').length} baris`"
          tone="success"
        />
        <AppStat
          label="Bukti TF"
          icon="i-lucide-paperclip"
          :value="`${buktiAda} / ${tampil.length}`"
          sub="baris ber-bukti"
        />
        <AppStat
          label="Belum masuk batch"
          icon="i-lucide-inbox"
          :value="tanpaBatch.length"
          sub="baris tanpa tanggal lembar"
          :tone="tanpaBatch.length ? 'warning' : undefined"
        />
      </AppStatGrid>

      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Saldo wallet belum ditampilkan (G-06), dan daftar vendor dibaca dari modul Stock (belum dibawa)."
        description="Nominal & penerima diketik tangan dulu; endpoint saldo ringkas ber-modul finance masih menunggu keputusan API (laksamana-api#181)."
        class="mb-4"
      />

      <AppPanel
        title="Lembar pembayaran"
        :description="`${tampil.length} baris · total ${fmtRp(totBatch)}. Pilih lembar per tanggal; arsip lembar lain tetap tersimpan.`"
        flush
      >
        <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3 lg:px-5">
          <USelect
            v-model="batchTerpilih"
            :items="[{ label: `Lembar ${hariIni()} (berjalan)`, value: 'berjalan' }, ...batches.filter(b => b !== hariIni()).map(b => ({ label: `Lembar ${b}`, value: b }))]"
            size="sm"
            class="w-56"
          />
          <UButton
            v-if="izin.ubah('bayar')"
            label="+ Baris"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="barisBaru"
          />
          <div class="flex-1" />
          <UButton
            v-if="izin.ubah('bayar')"
            label="Simpan lembar"
            icon="i-lucide-save"
            size="sm"
            :disabled="!kotor"
            :loading="sibuk"
            @click="simpan"
          />
        </div>

        <div class="divide-y divide-default">
          <div
            v-for="r in tampil"
            :key="r.id"
            class="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end lg:px-5"
          >
            <UFormField label="Vendor / penerima">
              <UInput
                :model-value="String(r.vendor || '')"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'vendor', v)"
              />
            </UFormField>
            <UFormField
              label="Keterangan"
              class="lg:col-span-2"
            >
              <UInput
                :model-value="String(r.keterangan || '')"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'keterangan', v)"
              />
            </UFormField>
            <UFormField label="Kategori">
              <USelect
                :model-value="String(r.kategori || BAYAR_KAT[0])"
                :items="BAYAR_KAT.map(k => ({ label: k, value: k }))"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string) => set(r, 'kategori', v)"
              />
            </UFormField>
            <UFormField label="Dibayar dari">
              <UInput
                :model-value="String(r.dari || '')"
                placeholder="cth: BRI"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'dari', v)"
              />
            </UFormField>
            <UFormField label="Nominal">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <div class="flex flex-wrap items-center gap-3 pb-1">
              <UCheckbox
                :model-value="r.status === 'paid'"
                label="Sudah dibayar"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'status', v === true ? 'paid' : 'scheduled')"
              />
              <UCheckbox
                :model-value="!!r.bukti?.ok"
                label="Bukti TF"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'bukti', { ok: v === true })"
              />
              <UButton
                v-if="izin.ubah('bayar')"
                label="Buang"
                color="error"
                variant="ghost"
                size="xs"
                @click="buang(r)"
              />
            </div>
          </div>
          <p
            v-if="!tampil.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada baris di lembar ini. Tambah baris lewat tombol di atas.
          </p>
        </div>
      </AppPanel>

      <AppPanel
        v-if="tanpaBatch.length"
        title="Baris tanpa lembar"
        :count="tanpaBatch.length"
        description="Baris lama yang belum punya tanggal batch — pindahkan dengan mengisi batch-nya sebelum menyimpan."
      >
        <div class="divide-y divide-default">
          <div
            v-for="r in tanpaBatch"
            :key="r.id"
            class="flex flex-wrap items-center gap-3 py-2 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">{{ r.vendor || '(tanpa penerima)' }} — {{ r.keterangan || '—' }}</span>
            <b class="num">{{ fmtRp(num(r.amount)) }}</b>
            <UButton
              v-if="izin.ubah('bayar')"
              label="Masukkan lembar ini"
              size="xs"
              color="neutral"
              variant="outline"
              @click="set(r, 'batch', batchAktif)"
            />
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
