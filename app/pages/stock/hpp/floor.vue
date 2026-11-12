<!--
  Stock › HPP › Barang Floor (old `deploy/stock/hpp/index.html:228`, JUDUL floor `:835`).

  "Barang berarea Floor di purchasing — dibeli & berharga, tapi tidak masuk
  resep." Same ingredient rows as Bahan & Harga, filtered to names paired with
  a Purchasing product whose area includes Floor.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BahanHpp } from '~/utils/pohon-resep'
import { deleteIngredient, patchIngredient, useBahanHpp, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { rupiah } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['hpp'] })

const toast = useToast()

const bahanQ = useBahanHpp()
const produkQ = useProdukStock()
const versi = computed(() => bahanQ.data.value?.versions ?? {})

const namaFloor = computed(() => {
  const cari = new Set<string>()
  for (const p of (produkQ.data.value?.rows ?? []) as { nama: string, area?: string[] }[]) {
    if ((p.area ?? []).some(a => String(a).toLowerCase() === 'floor')) cari.add(p.nama.toLowerCase())
  }
  return cari
})
const semua = computed(() => (bahanQ.data.value?.rows ?? []).filter((b) => {
  const n = String(b.nama ?? '').toLowerCase()
  const pasangan = String(b.produk ?? '').toLowerCase()
  return namaFloor.value.has(n) || (pasangan && pasangan !== '-' && namaFloor.value.has(pasangan))
}))

const cari = ref('')
const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return q ? semua.value.filter(b => String(b.nama ?? '').toLowerCase().includes(q)) : semua.value
})

const kolom: TableColumn<BahanHpp>[] = [
  { accessorKey: 'nama', header: 'Barang' },
  { accessorKey: 'harga_beli', header: 'Harga beli' },
  { accessorKey: 'vendor', header: 'Vendor' },
  { id: 'aksi', header: '' },
]

const sheet = ref(false)
const editing = ref<BahanHpp | null>(null)
const f = ref({ harga_beli: 0, qty_beli: 0, satuan: '', vendor: '' })
function bukaUbah(b: BahanHpp) {
  editing.value = b
  f.value = { harga_beli: Number(b.harga_beli ?? 0), qty_beli: Number(b.qty_beli ?? 0), satuan: String(b.satuan ?? ''), vendor: String(b.vendor ?? '') }
  sheet.value = true
}
const menyimpan = ref(false)
async function simpan() {
  if (!editing.value?.nama) return
  menyimpan.value = true
  try {
    await patchIngredient(String(editing.value.nama), {
      harga_beli: Number(f.value.harga_beli) || 0,
      qty_beli: Number(f.value.qty_beli) || 0,
      satuan: f.value.satuan.trim(),
      vendor: f.value.vendor.trim(),
    }, versi.value[String(editing.value.nama)])
    sheet.value = false
    await bahanQ.refresh()
    toast.add({ title: 'Harga tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => bahanQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
async function hapus(b: BahanHpp) {
  try {
    await deleteIngredient(String(b.nama), versi.value[String(b.nama ?? '')])
    await bahanQ.refresh()
    toast.add({ title: 'Barang dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => bahanQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Barang Floor"
    description="Barang berarea Floor di Purchasing — dibeli & berharga, tapi tidak masuk resep"
  >
    <AppStatGrid>
      <AppStat
        label="Barang floor"
        :value="String(semua.length)"
        satuan="barang"
        icon="i-lucide-armchair"
        tone="info"
      />
      <AppStat
        label="Tanpa harga"
        :value="String(semua.filter(b => !(Number(b.harga_beli ?? 0) > 0)).length)"
        satuan="barang"
        icon="i-lucide-alert-circle"
        tone="error"
      />
    </AppStatGrid>

    <AppPanel title="Barang floor">
      <template #head>
        <UInput
          v-model="cari"
          placeholder="Cari barang…"
          icon="i-lucide-search"
        />
      </template>
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="tampil"
        >
          <template #harga_beli-cell="{ row }">
            {{ Number(row.original.harga_beli ?? 0) > 0 ? rupiah(Number(row.original.harga_beli)) : '—' }}
          </template>
          <template #vendor-cell="{ row }">
            {{ row.original.vendor || '—' }}
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                size="sm"
                :aria-label="`Ubah ${row.original.nama}`"
                @click="bukaUbah(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                size="sm"
                color="error"
                :aria-label="`Hapus ${row.original.nama}`"
                @click="hapus(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 lg:hidden">
        <div
          v-for="b in tampil.slice(0, 80)"
          :key="String(b.nama)"
          class="flex items-center justify-between gap-2 rounded-xl border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ b.nama }}</b>
            <p class="text-sm text-muted">
              {{ Number(b.harga_beli ?? 0) > 0 ? rupiah(Number(b.harga_beli)) : 'tanpa harga' }}
            </p>
          </div>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              :aria-label="`Ubah ${b.nama}`"
              @click="bukaUbah(b)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              :aria-label="`Hapus ${b.nama}`"
              @click="hapus(b)"
            />
          </div>
        </div>
        <p
          v-if="!tampil.length"
          class="text-sm text-dimmed"
        >
          Tidak ada barang floor. Atur area di Purchasing › Database & Vendor.
        </p>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      title="Ubah harga"
    >
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-3 gap-2">
          <UFormField label="Satuan beli">
            <UInput v-model="f.satuan" />
          </UFormField>
          <UFormField label="Qty beli">
            <UInput
              v-model.number="f.qty_beli"
              type="number"
              min="0"
            />
          </UFormField>
          <UFormField label="Harga beli">
            <UInput
              v-model.number="f.harga_beli"
              type="number"
              min="0"
            />
          </UFormField>
        </div>
        <UFormField label="Vendor">
          <UInput v-model="f.vendor" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheet = false"
          />
          <UButton
            label="Simpan"
            :loading="menyimpan"
            @click="simpan"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
