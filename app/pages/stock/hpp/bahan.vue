<!--
  Stock › HPP › Bahan & Harga (old `deploy/stock/hpp/index.html:220`, JUDUL bahan `:834`).

  "Harga beli tiap bahan — sumber semua angka modal di modul ini." Price side
  (`sisi_harga`), shadow flags, and the tidy-up actions: merge, pull from
  Purchasing, align names, remove shadows. Imports never delete or rename (F.9).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BahanHpp } from '~/utils/pohon-resep'
import {
  createIngredient,
  deleteIngredient,
  useBahanHpp,
  hppRapikanBahan,
  importIngredients,
  mergeIngredients,
  patchIngredient,
} from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { barisBerkolom } from '~/utils/stock-impor'
import { rupiah } from '~/utils/format'
import { buatKonteks, dipakaiOleh, sisiHarga } from '~/utils/stock-hpp'
import { unduhCsvStock } from '~/utils/stock-catat'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['hpp'] })

const toast = useToast()

const bahanQ = useBahanHpp()
const resepQ = useAsyncData('hpp-bahan-resep', () => import('~/composables/useStock').then(m => m.getHppRecipes()), {
  default: () => ({ rows: [], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => bahanQ.data.value?.versions ?? {})

const cari = ref('')
const semua = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const rows = bahanQ.data.value?.rows ?? []
  return q ? rows.filter(b => String(b.nama ?? '').toLowerCase().includes(q)) : rows
})

const ctx = computed(() => buatKonteks(
  semua.value.map(b => ({ nama: String(b.nama ?? ''), sisi_harga: String(b.sisi_harga ?? '') })),
  (resepQ.data.value?.rows ?? []).map(r => ({ id: String(r.id ?? ''), nama: String(r.nama ?? ''), jenis: String(r.jenis ?? ''), tipe: String(r.tipe ?? '') })),
))
const sisiOf = (nama: string) => sisiHarga(ctx.value, { nama }) || '—'
const dipakai = (nama: string) => dipakaiOleh(
  (resepQ.data.value?.rows ?? []).map(r => ({ nama: String(r.nama ?? ''), bahan: (r.bahan ?? []).map(b => ({ nama: b.nama })) })),
  nama,
).length

const kolom: TableColumn<BahanHpp>[] = [
  { accessorKey: 'nama', header: 'Bahan' },
  { accessorKey: 'harga_beli', header: 'Harga beli' },
  { accessorKey: 'per1', header: 'Per 1' },
  { accessorKey: 'vendor', header: 'Vendor' },
  { accessorKey: 'kategori', header: 'Kategori' },
  { accessorKey: 'sisi_harga', header: 'Sisi' },
  { id: 'aksi', header: '' },
]

// --- editor -----------------------------------------------------------------------
const sheet = ref(false)
const editing = ref<BahanHpp | null>(null)
const f = ref({ nama: '', satuan: '', qty_beli: 0, harga_beli: 0, vendor: '', produk: '', kategori: '', catatan: '', sisi_harga: 'auto', di_purchasing: true })
function bukaTambah() {
  editing.value = null
  f.value = { nama: '', satuan: '', qty_beli: 0, harga_beli: 0, vendor: '', produk: '', kategori: '', catatan: '', sisi_harga: 'auto', di_purchasing: true }
  sheet.value = true
}
function bukaUbah(b: BahanHpp) {
  editing.value = b
  f.value = {
    nama: String(b.nama ?? ''),
    satuan: String(b.satuan ?? ''),
    qty_beli: Number(b.qty_beli ?? 0),
    harga_beli: Number(b.harga_beli ?? 0),
    vendor: String(b.vendor ?? ''),
    produk: String(b.produk ?? ''),
    kategori: String(b.kategori ?? ''),
    catatan: String(b.catatan ?? ''),
    sisi_harga: String(b.sisi_harga ?? '') || 'auto',
    di_purchasing: b.di_purchasing !== false,
  }
  sheet.value = true
}
const menyimpan = ref(false)
async function simpan() {
  if (!f.value.nama.trim()) {
    toast.add({ title: 'Nama bahan wajib diisi', color: 'warning' })
    return
  }
  menyimpan.value = true
  try {
    const body = {
      nama: f.value.nama.trim(),
      satuan: f.value.satuan.trim(),
      qty_beli: Number(f.value.qty_beli) || 0,
      harga_beli: Number(f.value.harga_beli) || 0,
      vendor: f.value.vendor.trim(),
      produk: f.value.produk.trim(),
      kategori: f.value.kategori.trim(),
      catatan: f.value.catatan.trim(),
      sisi_harga: f.value.sisi_harga === 'auto' ? '' : f.value.sisi_harga,
      di_purchasing: f.value.di_purchasing,
    }
    if (editing.value?.nama) await patchIngredient(String(editing.value.nama), body, versi.value[String(editing.value.nama)])
    else await createIngredient(body)
    sheet.value = false
    await bahanQ.refresh()
    toast.add({ title: 'Bahan tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => bahanQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
async function hapus(b: BahanHpp) {
  const n = dipakai(String(b.nama ?? ''))
  if (n > 0) {
    toast.add({ title: `${n} resep memakai bahan ini`, description: 'Baris resep yang menyebutnya dibiarkan apa adanya — periksa dulu sebelum menghapus.', color: 'warning' })
    return
  }
  try {
    await deleteIngredient(String(b.nama), versi.value[String(b.nama ?? '')])
    await bahanQ.refresh()
    toast.add({ title: 'Bahan dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => bahanQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}

// --- tidy-up actions ----------------------------------------------------------------
const rapiSibuk = ref('')
async function rapikan(aksi: 'pull-products' | 'remove-shadows' | 'align-names', label: string) {
  rapiSibuk.value = aksi
  try {
    const r = await hppRapikanBahan(aksi)
    await bahanQ.refresh()
    toast.add({ title: label, description: JSON.stringify(r), color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    rapiSibuk.value = ''
  }
}
const sheetGabung = ref(false)
const gabung = ref({ dari: '', ke: '' })
const menggabung = ref(false)
async function gabungkan() {
  if (!gabung.value.dari.trim() || !gabung.value.ke.trim()) {
    toast.add({ title: 'Isi bahan asal & tujuan', color: 'warning' })
    return
  }
  menggabung.value = true
  try {
    await mergeIngredients(gabung.value.dari.trim(), gabung.value.ke.trim(), versi.value[gabung.value.dari.trim()])
    sheetGabung.value = false
    await bahanQ.refresh()
    toast.add({ title: 'Bahan digabungkan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => bahanQ.refresh()))) toast.add({ title: 'Gagal menggabungkan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menggabung.value = false
  }
}

// --- import / export ------------------------------------------------------------------
function unduhCsv() {
  const sel = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  unduhCsvStock(
    'bahan.csv',
    ['Nama,Satuan,Qty beli,Harga beli,Vendor,Produk,Kategori,Sisi harga,Catatan',
      ...semua.value.map(b => [String(b.nama ?? ''), String(b.satuan ?? ''), String(b.qty_beli ?? ''), String(b.harga_beli ?? ''), String(b.vendor ?? ''), String(b.produk ?? ''), String(b.kategori ?? ''), String(b.sisi_harga ?? ''), String(b.catatan ?? '')].map(sel).join(','))].join('\n'),
  )
}
const imporSibuk = ref(false)
async function impor(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imporSibuk.value = true
  try {
    const tb = await bacaBerkasTabel(file)
    // Letter-keyed rows -> header-keyed rows (the header is the first row).
    const rows = barisBerkolom(tb).map(r => ({
      nama: String(r.Nama || r.nama || '').trim(),
      satuan: String(r.Satuan || r.satuan || ''),
      qty_beli: Number(r['Qty beli'] || r.qty_beli || 0),
      harga_beli: Number(r['Harga beli'] || r.harga_beli || 0),
      vendor: String(r.Vendor || r.vendor || ''),
      produk: String(r.Produk || r.produk || ''),
      kategori: String(r.Kategori || r.kategori || ''),
      sisi_harga: String(r['Sisi harga'] || r.sisi_harga || ''),
      catatan: String(r.Catatan || r.catatan || ''),
    })).filter(r => r.nama)
    const hasil = await importIngredients(rows)
    await bahanQ.refresh()
    toast.add({ title: 'Impor selesai', description: `${hasil.baru} baru, ${hasil.diubah} diubah, ${hasil.dilewati} dilewati.`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Impor gagal', description: apiErrorMessage(err), color: 'error' })
  }
  finally {
    imporSibuk.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <AppPage
    title="Bahan & Harga"
    description="Harga beli tiap bahan — sumber semua angka modal di modul ini"
  >
    <template #actions>
      <UButton
        label="Tambah bahan"
        icon="i-lucide-plus"
        @click="bukaTambah"
      />
      <UButton
        label="Unduh CSV"
        icon="i-lucide-download"
        variant="outline"
        @click="unduhCsv"
      />
      <UButton
        label="Impor"
        icon="i-lucide-upload"
        variant="outline"
        :loading="imporSibuk"
        @click="($refs.imporBahan as HTMLInputElement)?.click()"
      />
      <input
        ref="imporBahan"
        type="file"
        accept=".xlsx,.xls,.csv"
        class="hidden"
        @change="impor"
      >
    </template>

    <AppStatGrid>
      <AppStat
        label="Bahan"
        :value="String(semua.length)"
        satuan="bahan"
        icon="i-lucide-tags"
        tone="gold"
      />
      <AppStat
        label="Tanpa harga"
        :value="String(semua.filter(b => !(Number(b.harga_beli ?? 0) > 0)).length)"
        satuan="bahan"
        icon="i-lucide-alert-circle"
        tone="error"
      />
      <AppStat
        label="Sisi resep"
        :value="String(semua.filter(b => sisiOf(String(b.nama ?? '')) === 'resep').length)"
        satuan="bahan"
        icon="i-lucide-book-open"
        tone="info"
      />
    </AppStatGrid>

    <AppPanel title="Bahan">
      <template #head>
        <UInput
          v-model="cari"
          placeholder="Cari bahan…"
          icon="i-lucide-search"
        />
      </template>
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="semua"
        >
          <template #harga_beli-cell="{ row }">
            {{ Number(row.original.harga_beli ?? 0) > 0 ? rupiah(Number(row.original.harga_beli)) : '—' }}
          </template>
          <template #per1-cell="{ row }">
            {{ Number(row.original.qty_beli ?? 0) > 0 ? rupiah(Math.round(Number(row.original.harga_beli ?? 0) / Number(row.original.qty_beli))) : '—' }}
          </template>
          <template #vendor-cell="{ row }">
            {{ row.original.vendor || '—' }}
          </template>
          <template #kategori-cell="{ row }">
            {{ row.original.kategori || '—' }}
          </template>
          <template #sisi_harga-cell="{ row }">
            {{ sisiOf(String(row.original.nama ?? '')) }}
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
          v-for="b in semua.slice(0, 80)"
          :key="String(b.nama)"
          class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ b.nama }}</b>
            <p class="text-sm text-muted">
              {{ Number(b.harga_beli ?? 0) > 0 ? rupiah(Number(b.harga_beli)) : 'tanpa harga' }} · sisi {{ sisiOf(String(b.nama ?? '')) }}
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
      </div>
    </AppPanel>

    <AppPanel title="Rapikan">
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Tarik bahan dari Purchasing"
          icon="i-lucide-arrow-down-to-line"
          variant="outline"
          :loading="rapiSibuk === 'pull-products'"
          @click="rapikan('pull-products', 'Bahan ditarik')"
        />
        <UButton
          label="Samakan nama dengan Purchasing"
          icon="i-lucide-case-sensitive"
          variant="outline"
          :loading="rapiSibuk === 'align-names'"
          @click="rapikan('align-names', 'Nama disamakan')"
        />
        <UButton
          label="Hapus bahan bayangan"
          icon="i-lucide-ghost"
          variant="outline"
          :loading="rapiSibuk === 'remove-shadows'"
          @click="rapikan('remove-shadows', 'Bayangan dihapus')"
        />
        <UButton
          label="Gabungkan…"
          icon="i-lucide-merge"
          variant="outline"
          @click="sheetGabung = true"
        />
      </div>
      <p class="mt-2 text-sm text-muted">
        Impor tidak pernah menghapus & tidak pernah mengganti nama; baris yang tidak ada di berkas dibiarkan.
      </p>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="editing ? 'Ubah bahan' : 'Tambah bahan'"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Nama bahan">
          <UInput
            v-model="f.nama"
            :disabled="!!editing"
          />
        </UFormField>
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
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Vendor">
            <UInput v-model="f.vendor" />
          </UFormField>
          <UFormField label="Pasangan Purchasing">
            <UInput v-model="f.produk" />
          </UFormField>
        </div>
        <UFormField label="Kategori">
          <UInput v-model="f.kategori" />
        </UFormField>
        <UFormField label="Sisi harga">
          <USelect
            v-model="f.sisi_harga"
            :items="[
              { value: 'auto', label: 'Ikut aturan (base → resep)' },
              { value: 'beli', label: 'Beli' },
              { value: 'resep', label: 'Resep' },
            ]"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UInput v-model="f.catatan" />
        </UFormField>
        <UCheckbox
          v-model="f.di_purchasing"
          label="Daftarkan juga di Purchasing"
        />
        <p
          v-if="editing"
          class="text-sm text-muted"
        >
          Dipakai {{ dipakai(String(editing.nama ?? '')) }} resep.
        </p>
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

    <ResponsiveSheet
      v-model:open="sheetGabung"
      title="Gabungkan bahan"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-muted">
          Baris resep & pemakaian bahan asal pindah ke tujuan, lalu bahan asal dihapus. Harga tujuan tidak berubah.
        </p>
        <UFormField label="Dari (dihapus)">
          <UInput v-model="gabung.dari" />
        </UFormField>
        <UFormField label="Ke (dipertahankan)">
          <UInput v-model="gabung.ke" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheetGabung = false"
          />
          <UButton
            label="Gabungkan"
            :loading="menggabung"
            @click="gabungkan"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
