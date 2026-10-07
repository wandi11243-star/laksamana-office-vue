<!--
  Finance › Brankas › Pengaturan (old `vPengaturan`, deploy/finance/brankas/index.html:1798-1836).

  Three settings in one save: opening balances (money already there BEFORE
  the first recorded recap day — without them the vault starts at zero),
  which wallet each payment method flows into (an empty one keeps its money
  out of every wallet, and that is reported on Saldo, not silenced) and the
  monthly burn (empty = the runway is hidden, not shown as zero).
-->
<script setup lang="ts">
import { getVault, putVaultSetting } from '~/composables/useFinance'
import { useBrankasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { tanganiKonflik } from '~/utils/versi'
import { namaWallet, petaGrupWallet, SEMUA_WADAH } from '~/utils/brankas'
import { RK_GRUP } from '~/utils/kompas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()
const toast = useToast()

const { data, error, refresh } = useAsyncData('brankas-vault', () => getVault())
const vault = computed(() => data.value?.vault ?? {})

const awal = ref<Record<string, string>>({})
const peta = ref<Record<string, string>>({})
const burn = ref('')
const kotor = ref(false)
watch(data, () => {
  const s = (vault.value.setting ?? {}) as { awal?: Record<string, unknown>, peta?: Record<string, unknown>, burn?: unknown }
  const a: Record<string, string> = {}
  for (const k of SEMUA_WADAH) {
    const v = num(s.awal?.[k])
    a[k] = v ? String(v) : ''
  }
  awal.value = a
  peta.value = { ...petaGrupWallet(s as never) }
  burn.value = num(s.burn) ? String(num(s.burn)) : ''
  kotor.value = false
}, { immediate: true })

const opsiWallet = computed(() => [
  { label: '— belum dipetakan —', value: '__kosong' },
  ...SEMUA_WADAH.map(k => ({ label: namaWallet(k), value: k })),
])

const sibuk = ref(false)
async function simpan() {
  if (!data.value || !izin.ubah('pengaturan') || sibuk.value) return
  sibuk.value = true
  try {
    const awalBaru: Record<string, number> = {}
    for (const k of SEMUA_WADAH) awalBaru[k] = num(awal.value[k])
    const petaBaru: Record<string, string> = {}
    for (const g of RK_GRUP) {
      if (g.k === 'error') continue
      petaBaru[g.k] = peta.value[g.k] || ''
    }
    await putVaultSetting({ ...((vault.value.setting ?? {}) as object), awal: awalBaru, peta: petaBaru, burn: num(burn.value) }, data.value.version ?? '')
    kotor.value = false
    toast.add({ title: 'Pengaturan tersimpan.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function fmtInput(v: string): string {
  const n = num(v)
  return n ? n.toLocaleString('id-ID') : ''
}
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Saldo awal, pemetaan metode pembayaran, dan biaya bulanan."
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
      v-if="!izin.lihat('pengaturan')"
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
      <AppPanel
        title="Saldo awal tiap wadah"
        description="Uang yang sudah ada SEBELUM hari pertama yang tercatat di Rekap Penjualan. Tanpa ini saldo brankas dimulai dari nol dan selalu lebih kecil daripada kenyataan."
      >
        <AppFilterGrid>
          <UFormField
            v-for="k in SEMUA_WADAH"
            :key="k"
            :label="namaWallet(k)"
          >
            <UInput
              :model-value="fmtInput(awal[k] ?? '')"
              inputmode="numeric"
              placeholder="0"
              class="w-full num"
              :disabled="!izin.ubah('pengaturan')"
              @update:model-value="(v: string | number) => { awal[k] = String(v).replace(/[^0-9]/g, ''); kotor = true }"
            />
          </UFormField>
        </AppFilterGrid>
      </AppPanel>

      <AppPanel
        title="Metode pembayaran masuk ke bank mana"
        description="Menentukan ke wadah mana Aktual Masuk tiap metode dijumlahkan. Yang dibiarkan kosong uangnya tidak masuk ke wadah mana pun — dan itu dilaporkan di halaman Saldo, bukan didiamkan. QR Order, Gofood, dan Grabfood bawaannya UOB, sama dengan Transfer."
      >
        <AppFilterGrid>
          <UFormField
            v-for="g in RK_GRUP.filter(x => x.k !== 'error')"
            :key="g.k"
            :label="g.n"
          >
            <USelect
              :model-value="peta[g.k] || '__kosong'"
              :items="opsiWallet"
              class="w-full"
              :disabled="!izin.ubah('pengaturan')"
              @update:model-value="(v: string) => { peta[g.k] = v === '__kosong' ? '' : v; kotor = true }"
            />
          </UFormField>
        </AppFilterGrid>
      </AppPanel>

      <AppPanel
        title="Biaya operasional bulanan"
        description="Dipakai menghitung runway di Ringkasan. Kosong = runway tidak ditampilkan, bukan ditampilkan nol."
      >
        <AppFilterGrid>
          <UFormField label="Biaya per bulan">
            <UInput
              :model-value="fmtInput(burn)"
              inputmode="numeric"
              placeholder="0"
              class="w-full num"
              :disabled="!izin.ubah('pengaturan')"
              @update:model-value="(v: string | number) => { burn = String(v).replace(/[^0-9]/g, ''); kotor = true }"
            />
          </UFormField>
        </AppFilterGrid>
        <p class="mt-3 text-sm text-muted">
          Contoh: {{ fmtRp(num(burn)) || '—' }}
        </p>
      </AppPanel>

      <div v-if="izin.ubah('pengaturan')">
        <UButton
          label="Simpan pengaturan"
          icon="i-lucide-save"
          :disabled="!kotor"
          :loading="sibuk"
          @click="simpan"
        />
      </div>
    </template>
  </AppPage>
</template>
