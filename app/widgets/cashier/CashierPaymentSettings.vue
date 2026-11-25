<script setup lang="ts">
import type { MetodeCashier } from '~/utils/cashier'
import { daftarPayment, rksKunci } from '~/utils/cashier'
import { getPaymentCashier, putPaymentCashier } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'

const toast = useToast()
const { data, status, error, refresh } = useAsyncData('cashier-payment-settings', getPaymentCashier)
const metode = computed(() => daftarPayment(data.value?.value ?? []))
const jumlahAktif = computed(() => metode.value.filter(p => !p.nonaktif).length)
const nama = ref('')
const menyimpan = ref(false)

async function simpan(p: MetodeCashier): Promise<boolean> {
  if (!data.value || menyimpan.value) return false
  menyimpan.value = true
  try {
    const baru = [...data.value.value.filter(x => x.k !== p.k), p]
    data.value = await putPaymentCashier(baru, data.value.version)
    toast.add({ title: 'Metode pembayaran diperbarui', color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    menyimpan.value = false
  }
}

async function tambah() {
  const n = nama.value.trim()
  const k = rksKunci(n)
  if (!k) return toast.add({ title: 'Masukkan nama metode yang mengandung huruf atau angka.', color: 'error' })
  if (Object.hasOwn(Object.prototype, k)) return toast.add({ title: 'Nama metode ini tidak dapat digunakan.', color: 'error' })
  if (metode.value.some(p => p.k === k || p.n.toLowerCase() === n.toLowerCase())) {
    return toast.add({ title: 'Metode itu sudah ada. Aktifkan kembali dari daftar jika diperlukan.', color: 'warning' })
  }
  if (await simpan({ k, n })) nama.value = ''
}

async function gantiStatus(p: MetodeCashier) {
  if (!p.nonaktif && jumlahAktif.value <= 1) return
  await simpan({ ...p, nonaktif: !p.nonaktif })
}
</script>

<template>
  <AppPanel
    title="Metode pembayaran"
    description="Metode aktif tersedia di Report Daily, pencatatan bon, dan pelunasan. Metode nonaktif tetap terlihat pada riwayat yang menggunakannya."
    icon="i-lucide-credit-card"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="apiErrorMessage(error)"
    />
    <USkeleton
      v-else-if="status === 'pending'"
      class="h-12 w-full"
    />
    <template v-else-if="data">
      <form
        class="mb-4 flex flex-wrap items-end gap-2"
        @submit.prevent="tambah"
      >
        <UFormField label="Nama metode baru">
          <UInput
            v-model="nama"
            maxlength="80"
            placeholder="Contoh: Transfer BNI"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Tambah metode"
          icon="i-lucide-plus"
          :loading="menyimpan"
          :disabled="!nama.trim()"
        />
      </form>
      <ul class="divide-y divide-default border-y border-default">
        <li
          v-for="p in metode"
          :key="p.k"
          class="flex items-center justify-between gap-3 py-2"
        >
          <span class="text-sm font-semibold text-highlighted">{{ p.n }}</span>
          <USwitch
            :model-value="!p.nonaktif"
            :disabled="menyimpan || (!p.nonaktif && jumlahAktif <= 1)"
            :aria-label="`Aktifkan ${p.n}`"
            :label="p.nonaktif ? 'Nonaktif' : 'Aktif'"
            @update:model-value="gantiStatus(p)"
          />
        </li>
      </ul>
    </template>
  </AppPanel>
</template>
