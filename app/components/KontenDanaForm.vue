<!--
  Tambah / Edit Dana Masuk iklan (old openFundForm + saveFund + delFund,
  deploy/konten/index.html:4152-4175; konten.md D.15). Nominal required
  ("Nominal dana masuk wajib diisi"); date defaults to today (local).
-->
<script setup lang="ts">
import type { DanaIklan } from '~/utils/promosi-konten'
import { hariIni, rupiah } from '~/utils/format'

const props = defineProps<{ dana?: DanaIklan | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { can } = useAksesKonten()
const brandPilih = useBrandKonten()

const f = reactive({ brand: '', date: '', amount: '', note: '' })
const sibuk = ref(false)
const salah = ref(false)
const hapusBuka = ref(false)
const opsiBrand = computed(() => st.value.brands.map(b => ({ value: b.id, label: b.name })))

watch(open, (o) => {
  if (!o) return
  const x = props.dana
  salah.value = false
  Object.assign(f, {
    brand: x?.brand || (brandPilih.value !== 'all' ? brandPilih.value : st.value.brands[0]?.id ?? ''),
    date: x?.date || hariIni(), amount: x?.amount ? String(x.amount) : '', note: x?.note ?? '',
  })
}, { immediate: true })

async function simpan() {
  const amount = Number(f.amount) || 0
  if (amount <= 0) {
    salah.value = true
    return
  }
  const data = { brand: f.brand, date: f.date, amount, note: f.note.trim() }
  const x = props.dana
  sibuk.value = true
  const ok = x
    ? await kontenSimpan(() => ubahKonten<DanaIklan>('ad-funds', x.id, { ...x, ...data }, x.updatedAt), 'Dana masuk diperbarui', { action: 'mengubah dana masuk', target: rupiah(amount) })
    : await kontenSimpan(() => buatKonten<DanaIklan>('ad-funds', { createdAt: Date.now(), ...data }), 'Dana masuk dicatat', { action: 'menambah dana masuk', target: rupiah(amount) })
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const x = props.dana
  if (!x) return
  sibuk.value = true
  const ok = await kontenSimpan(() => hapusKonten('ad-funds', x.id, x.updatedAt), 'Dana masuk dihapus', { action: 'menghapus dana masuk', target: rupiah(x.amount ?? 0) })
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="dana ? 'Edit dana masuk' : 'Tambah dana masuk'"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Brand">
        <USelect
          v-model="f.brand"
          :items="opsiBrand"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Tanggal">
        <AppTanggal
          v-model="f.date"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Nominal dana masuk (Rp)"
        required
        class="sm:col-span-2"
        :error="salah ? 'Nominal dana masuk wajib diisi' : false"
      >
        <UInput
          v-model="f.amount"
          type="number"
          min="0"
          placeholder="mis. 5000000"
          class="w-full"
          @update:model-value="salah = false"
        />
      </UFormField>
      <UFormField
        label="Sumber / catatan"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.note"
          placeholder="mis. Top-up budget dari klien / termin 1"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can('ads')"
        :label="dana ? 'Simpan perubahan' : 'Simpan dana masuk'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="dana && can('ads')"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    title="Hapus catatan dana masuk ini?"
    confirm-label="Hapus"
    color="error"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
