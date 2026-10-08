<!--
  Stock › Purchasing › Database & Vendor (old `deploy/stock/purchasing/index.html:191-192,820-965`).

  Two blocks: Daftar Kontak Vendor and Aturan Distribusi Bahan Baku & Produk,
  plus Kustomisasi Format Chat. Categories must match SO_KATEGORI exactly
  (old `:1444-1453`); `caraBeli ''` = Diantar vendor (`:1498-1508`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProdukStock, VendorStock } from '~/composables/useStock'
import {
  createProduk,
  createVendor,
  deleteProduk,
  deleteVendor,
  getProducts,
  getStockSettings,
  importProducts,
  importVendors,
  listVendors,
  patchProduk,
  patchVendor,
  putStockSettings,
} from '~/composables/useStock'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { SATUAN_TERSEDIA, unduhCsvStock } from '~/utils/stock-catat'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()
const sub = ref<'vendor' | 'bahan' | 'chat'>('vendor')

const KATEGORI = ['DRY ITEM', 'CHILLER ITEM', 'FRESH', 'OPERATIONAL', 'STORE ITEM', 'Liquid/Syrup', 'Tea Section', 'Fresh Fruits', 'Cake', 'Kelapa', 'Buah Prep', 'Packaging', 'Powder', 'Powder Herbs']
const BANK = ['BCA', 'Mandiri', 'BRI', 'BNI', 'UOB', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'Lainnya']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const AREA = ['Kitchen', 'Bar', 'Floor']

// ---------------------------------------------------------------- vendors
const vendorQ = useAsyncData('stock-db-vendor', listVendors, {
  default: () => ({ rows: [] as VendorStock[], versions: {} as Record<string, Versi> }),
})
const versiVendor = computed(() => vendorQ.data.value?.versions ?? {})
const cariVendor = ref('')
const vendorTampil = computed(() => {
  const q = cariVendor.value.trim().toLowerCase()
  return (vendorQ.data.value?.rows ?? []).filter(v => !q || [v.nama, v.whatsapp, v.penerima].join(' ').toLowerCase().includes(q))
})

const sheetVendor = ref(false)
const vendorEdit = ref<VendorStock | null>(null)
const fv = ref({ nama: '', whatsapp: '', perluJadwalJemput: false, penerima: '', bank: '', norek: '', tutupHari: [] as number[] })
function bukaVendor(v?: VendorStock) {
  vendorEdit.value = v ?? null
  fv.value = v
    ? { nama: v.nama, whatsapp: v.whatsapp || '', perluJadwalJemput: !!v.perluJadwalJemput, penerima: v.penerima || '', bank: v.bank || '', norek: v.norek || '', tutupHari: [...(v.tutupHari ?? [])] }
    : { nama: '', whatsapp: '', perluJadwalJemput: false, penerima: '', bank: '', norek: '', tutupHari: [] }
  sheetVendor.value = true
}
const simpanVendor = ref(false)
async function simpanV() {
  if (!fv.value.nama.trim() || !fv.value.whatsapp.trim()) {
    toast.add({ title: 'Nama & WhatsApp wajib diisi', color: 'warning' })
    return
  }
  simpanVendor.value = true
  try {
    const body = {
      nama: fv.value.nama.trim(),
      whatsapp: fv.value.whatsapp.trim(),
      perluJadwalJemput: fv.value.perluJadwalJemput,
      penerima: fv.value.penerima.trim(),
      bank: fv.value.bank,
      norek: fv.value.norek.trim(),
      tutupHari: fv.value.tutupHari,
    }
    if (vendorEdit.value) await patchVendor(vendorEdit.value.nama, body, versiVendor.value[vendorEdit.value.nama])
    else await createVendor(body)
    sheetVendor.value = false
    await vendorQ.refresh()
    toast.add({ title: 'Vendor tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => vendorQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    simpanVendor.value = false
  }
}
async function hapusV(v: VendorStock) {
  try {
    await deleteVendor(v.nama, versiVendor.value[v.nama])
    await vendorQ.refresh()
    toast.add({ title: 'Vendor dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => vendorQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}

const kolomVendor: TableColumn<VendorStock>[] = [
  { accessorKey: 'nama', header: 'Nama vendor' },
  { accessorKey: 'whatsapp', header: 'WhatsApp' },
  { accessorKey: 'penerima', header: 'Penerima' },
  { accessorKey: 'bank', header: 'Bank' },
  { id: 'aksi', header: '' },
]

// ---------------------------------------------------------------- products
const produkQ = useAsyncData('stock-db-produk', getProducts, {
  default: () => ({ rows: [] as ProdukStock[], versions: {} as Record<string, Versi> }),
})
const versiProduk = computed(() => produkQ.data.value?.versions ?? {})
const cariProduk = ref('')
const produkTampil = computed(() => {
  const q = cariProduk.value.trim().toLowerCase()
  return (produkQ.data.value?.rows ?? []).filter(p => !q || p.nama.toLowerCase().includes(q))
})

const sheetProduk = ref(false)
const produkEdit = ref<ProdukStock | null>(null)
const fp = ref({
  nama: '',
  sumber: '',
  satuanDasar: '',
  packIsi: 1,
  diOutlet: false,
  utama: '',
  cadangan: [] as string[],
  satuan: [] as string[],
  isi: {} as Record<string, number>,
  kategori: '',
  area: [] as string[],
  caraBeli: '',
  aktif: true,
})
function bukaProduk(p?: ProdukStock) {
  produkEdit.value = p ?? null
  fp.value = p
    ? {
        nama: p.nama,
        sumber: (p.sumber as string) || '',
        satuanDasar: (p.satuanDasar as string) || '',
        packIsi: Number((p as unknown as Record<string, unknown>).packIsi) || 1,
        diOutlet: !!((p as unknown as Record<string, unknown>).diOutlet),
        utama: (p.utama as string) || '',
        cadangan: [...((p.cadangan as string[]) ?? [])],
        satuan: [...((p.satuan as string[]) ?? [])],
        isi: { ...((p.isi as Record<string, number>) ?? {}) },
        kategori: (p.kategori as string) || '',
        area: [...((p.area as string[]) ?? [])],
        caraBeli: (p.caraBeli as string) || '',
        aktif: p.aktif !== false,
      }
    : { nama: '', sumber: '', satuanDasar: '', packIsi: 1, diOutlet: false, utama: '', cadangan: [], satuan: [], isi: {}, kategori: '', area: [], caraBeli: '', aktif: true }
  sheetProduk.value = true
}
const namaVendorSemua = computed(() => (vendorQ.data.value?.rows ?? []).map(v => v.nama))
const simpanProduk = ref(false)
async function simpanP() {
  if (!fp.value.nama.trim()) {
    toast.add({ title: 'Nama bahan wajib diisi', color: 'warning' })
    return
  }
  simpanProduk.value = true
  try {
    const body: Record<string, unknown> = {
      nama: fp.value.nama.trim(),
      sumber: fp.value.sumber,
      satuanDasar: fp.value.satuanDasar,
      isi: fp.value.isi,
      diOutlet: fp.value.diOutlet,
      utama: fp.value.utama,
      cadangan: fp.value.cadangan,
      satuan: fp.value.satuan,
      kategori: fp.value.kategori,
      area: fp.value.area,
      caraBeli: fp.value.caraBeli,
      aktif: fp.value.aktif,
    }
    if (produkEdit.value) await patchProduk(produkEdit.value.nama, body, versiProduk.value[produkEdit.value.nama])
    else await createProduk(body as Partial<ProdukStock> & { nama: string })
    sheetProduk.value = false
    await produkQ.refresh()
    toast.add({ title: 'Aturan tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => produkQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    simpanProduk.value = false
  }
}
async function hapusP(p: ProdukStock) {
  try {
    await deleteProduk(p.nama, versiProduk.value[p.nama])
    await produkQ.refresh()
    toast.add({ title: 'Bahan dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => produkQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}

const labelSumber = (s: string) => (s === 'ck' ? 'Central Kitchen' : s === 'both' ? 'Vendor & CK' : 'Beli dari vendor')
const labelCara = (s: string) => (s === 'online' ? 'Online' : s === 'jemput' ? 'Jemput' : 'Diantar vendor')
const kolomProduk: TableColumn<ProdukStock>[] = [
  { accessorKey: 'nama', header: 'Nama bahan baku' },
  { accessorKey: 'sumber', header: 'Sumber' },
  { accessorKey: 'utama', header: 'Vendor utama' },
  { accessorKey: 'caraBeli', header: 'Cara beli' },
  { id: 'aksi', header: '' },
]

// ---------------------------------------------------------------- import / export
const sel = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
function unduhVendor() {
  unduhCsvStock(
    'vendor.csv',
    ['Nama,WhatsApp,Perlu jadwal jemput,Penerima,Bank,No. rekening,Hari tutup',
      ...vendorTampil.value.map(v => [v.nama, v.whatsapp || '', v.perluJadwalJemput ? 'Ya' : '', v.penerima || '', v.bank || '', v.norek || '', (v.tutupHari ?? []).join(' ')].map(sel).join(','))].join('\n'),
  )
}
function unduhProduk() {
  unduhCsvStock(
    'bahan.csv',
    ['Nama,Sumber,Vendor utama,Cara beli,Kategori,Aktif',
      ...produkTampil.value.map(p => [p.nama, labelSumber(String(p.sumber || '')), String(p.utama || ''), labelCara(String(p.caraBeli || '')), String(p.kategori || ''), p.aktif === false ? 'Tidak' : 'Ya'].map(sel).join(','))].join('\n'),
  )
}
const imporSibuk = ref(false)
async function impor(e: Event, jenis: 'vendor' | 'produk') {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imporSibuk.value = true
  try {
    const rows = await bacaBerkasTabel(file)
    const r = jenis === 'vendor' ? await importVendors(rows) : await importProducts(rows)
    await (jenis === 'vendor' ? vendorQ.refresh() : produkQ.refresh())
    toast.add({ title: 'Impor selesai', description: `${r.baru} baru, ${r.diubah} diubah, ${r.dilewati} dilewati.`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Impor gagal', description: apiErrorMessage(err), color: 'error' })
  }
  finally {
    imporSibuk.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

// ---------------------------------------------------------------- chat templates (server settings)
const setQ = useAsyncData('stock-db-set', () => getStockSettings('purchasing'), {
  default: () => ({ data: {} as { perms?: unknown, templates?: { item?: string, gabungan?: string } }, versi: undefined, tersedia: true }),
})
const tplItem = ref('')
const tplGabung = ref('')
watch(() => setQ.data.value?.data, (d) => {
  tplItem.value = d?.templates?.item || ''
  tplGabung.value = d?.templates?.gabungan || ''
}, { immediate: true })
const simpanTpl = ref(false)
async function simpanTemplate() {
  simpanTpl.value = true
  try {
    await putStockSettings('purchasing', { templates: { item: tplItem.value, gabungan: tplGabung.value } }, setQ.data.value?.versi)
    await setQ.refresh()
    toast.add({ title: 'Format chat tersimpan', color: 'success' })
  }
  catch (e) {
    if (apiErrorCode(e) === 'settings_unavailable') {
      toast.add({ title: 'Pengaturan belum tersedia', description: 'Tabel pengaturan belum dibuat saat cutover — format chat belum bisa disimpan.', color: 'warning' })
    }
    else toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    simpanTpl.value = false
  }
}
</script>

<template>
  <AppPage
    title="Database & Vendor"
    description="Kontak vendor & aturan distribusi bahan baku"
  >
    <AppPanel title="Database">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="[
            { value: 'vendor', label: 'Vendor', badge: vendorTampil.length },
            { value: 'bahan', label: 'Bahan baku', badge: produkTampil.length },
            { value: 'chat', label: 'Format chat' },
          ]"
        />
      </template>

      <div v-if="sub === 'vendor'">
        <AppFilterGrid>
          <UFormField label="Cari vendor">
            <UInput
              v-model="cariVendor"
              icon="i-lucide-search"
              placeholder="Nama / WA / penerima…"
            />
          </UFormField>
          <div class="flex items-end gap-2">
            <UButton
              label="Tambah vendor"
              icon="i-lucide-plus"
              @click="bukaVendor()"
            />
            <UButton
              label="Unduh CSV"
              icon="i-lucide-download"
              variant="outline"
              @click="unduhVendor"
            />
            <UButton
              label="Impor"
              icon="i-lucide-upload"
              variant="outline"
              :loading="imporSibuk"
              @click="($refs.imporVendor as HTMLInputElement)?.click()"
            />
            <input
              ref="imporVendor"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="hidden"
              @change="impor($event, 'vendor')"
            >
          </div>
        </AppFilterGrid>
        <div class="hidden lg:block">
          <UTable
            :columns="kolomVendor"
            :data="vendorTampil"
          >
            <template #penerima-cell="{ row }">
              {{ row.original.penerima || '—' }}
            </template>
            <template #bank-cell="{ row }">
              {{ row.original.bank ? `${row.original.bank} · ${row.original.norek || '—'}` : '—' }}
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Ubah ${row.original.nama}`"
                  @click="bukaVendor(row.original)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  size="sm"
                  color="error"
                  :aria-label="`Hapus ${row.original.nama}`"
                  @click="hapusV(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="v in vendorTampil.slice(0, 60)"
            :key="v.nama"
            class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
          >
            <div>
              <b class="text-highlighted">{{ v.nama }}</b>
              <p class="text-sm text-muted">
                {{ v.whatsapp }}{{ v.penerima ? ` · ${v.penerima}` : '' }}
              </p>
            </div>
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                :aria-label="`Ubah ${v.nama}`"
                @click="bukaVendor(v)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                :aria-label="`Hapus ${v.nama}`"
                @click="hapusV(v)"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="sub === 'bahan'">
        <AppFilterGrid>
          <UFormField label="Cari bahan">
            <UInput
              v-model="cariProduk"
              icon="i-lucide-search"
              placeholder="Nama bahan…"
            />
          </UFormField>
          <div class="flex items-end gap-2">
            <UButton
              label="Tambah aturan baru"
              icon="i-lucide-plus"
              @click="bukaProduk()"
            />
            <UButton
              label="Unduh CSV"
              icon="i-lucide-download"
              variant="outline"
              @click="unduhProduk"
            />
            <UButton
              label="Impor"
              icon="i-lucide-upload"
              variant="outline"
              :loading="imporSibuk"
              @click="($refs.imporProduk as HTMLInputElement)?.click()"
            />
            <input
              ref="imporProduk"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="hidden"
              @change="impor($event, 'produk')"
            >
          </div>
        </AppFilterGrid>
        <div class="hidden lg:block">
          <UTable
            :columns="kolomProduk"
            :data="produkTampil"
          >
            <template #sumber-cell="{ row }">
              {{ labelSumber(String(row.original.sumber || '')) }}
            </template>
            <template #utama-cell="{ row }">
              {{ row.original.utama || '—' }}
            </template>
            <template #caraBeli-cell="{ row }">
              {{ labelCara(String(row.original.caraBeli || '')) }}
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Ubah ${row.original.nama}`"
                  @click="bukaProduk(row.original)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  size="sm"
                  color="error"
                  :aria-label="`Hapus ${row.original.nama}`"
                  @click="hapusP(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="p in produkTampil.slice(0, 60)"
            :key="p.nama"
            class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
          >
            <div>
              <b class="text-highlighted">{{ p.nama }}</b>
              <p class="text-sm text-muted">
                {{ labelSumber(String(p.sumber || '')) }} · {{ p.utama || 'tanpa vendor' }} · {{ labelCara(String(p.caraBeli || '')) }}
              </p>
            </div>
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                :aria-label="`Ubah ${p.nama}`"
                @click="bukaProduk(p)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                :aria-label="`Hapus ${p.nama}`"
                @click="hapusP(p)"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="sub === 'chat'">
        <p
          v-if="!setQ.data.value?.tersedia"
          class="mb-3 rounded-field bg-warning/12 p-3 text-sm text-warning"
        >
          Tabel pengaturan belum ada — format yang disimpan belum bisa dimuat server. Isian di bawah hanya draf lokal.
        </p>
        <UFormField label="Format chat per item">
          <UTextarea
            v-model="tplItem"
            :rows="8"
            placeholder="Halo {vendor}, … {item} : {qty} {unit} …"
          />
        </UFormField>
        <UFormField
          label="Format chat gabungan"
          class="mt-3"
        >
          <UTextarea
            v-model="tplGabung"
            :rows="8"
            placeholder="Halo {vendor}, … {items_list} …"
          />
        </UFormField>
        <UButton
          label="Simpan format"
          class="mt-3"
          :loading="simpanTpl"
          @click="simpanTemplate"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetVendor"
      :title="vendorEdit ? 'Ubah vendor' : 'Tambah vendor baru'"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Nama vendor">
          <UInput
            v-model="fv.nama"
            :disabled="!!vendorEdit"
          />
        </UFormField>
        <UFormField label="Nomor WhatsApp">
          <UInput
            v-model="fv.whatsapp"
            placeholder="62…"
          />
        </UFormField>
        <UCheckbox
          v-model="fv.perluJadwalJemput"
          label="Barang tidak bisa dijemput di hari yang sama"
        />
        <UFormField label="Nama penerima (persis seperti di buku rekening)">
          <UInput v-model="fv.penerima" />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Bank">
            <USelect
              v-model="fv.bank"
              :items="BANK"
            />
          </UFormField>
          <UFormField label="No. rekening">
            <UInput v-model="fv.norek" />
          </UFormField>
        </div>
        <UFormField label="Hari tutup">
          <div class="flex flex-wrap gap-1">
            <UCheckbox
              v-for="(h, i) in HARI"
              :key="h"
              :model-value="fv.tutupHari.includes(i)"
              :label="h"
              @update:model-value="fv.tutupHari = $event ? [...fv.tutupHari, i] : fv.tutupHari.filter(x => x !== i)"
            />
          </div>
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheetVendor = false"
          />
          <UButton
            label="Simpan"
            :loading="simpanVendor"
            @click="simpanV"
          />
        </div>
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetProduk"
      title="Atur distribusi produk"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Nama bahan baku">
          <UInput
            v-model="fp.nama"
            :disabled="!!produkEdit"
          />
        </UFormField>
        <UFormField label="Sumber barang">
          <AppPilihan
            v-model="fp.sumber"
            name="produk-sumber"
            :options="[
              { value: '', label: 'Beli dari vendor' },
              { value: 'ck', label: 'Central Kitchen' },
              { value: 'both', label: 'Vendor & CK' },
            ]"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Satuan dasar">
            <USelect
              v-model="fp.satuanDasar"
              :items="SATUAN_TERSEDIA"
            />
          </UFormField>
          <UFormField label="1 pack = (satuan dasar)">
            <UInput
              v-model.number="fp.packIsi"
              type="number"
              min="1"
            />
          </UFormField>
        </div>
        <UFormField
          v-if="fp.sumber === 'ck'"
          label="Disimpan di"
        >
          <AppPilihan
            v-model="fp.diOutlet"
            name="produk-outlet"
            :options="[{ value: false, label: 'CK saja' }, { value: true, label: 'CK & outlet' }]"
          />
        </UFormField>
        <UFormField label="Vendor utama">
          <USelect
            v-model="fp.utama"
            :items="['', ...namaVendorSemua]"
          />
        </UFormField>
        <UFormField label="Vendor alternatif / cadangan">
          <div class="flex flex-wrap gap-1">
            <UCheckbox
              v-for="n in namaVendorSemua"
              :key="n"
              :model-value="fp.cadangan.includes(n)"
              :label="n"
              @update:model-value="fp.cadangan = $event ? [...fp.cadangan, n] : fp.cadangan.filter(x => x !== n)"
            />
          </div>
        </UFormField>
        <UFormField label="Satuan bahan ini">
          <div class="flex flex-wrap gap-1">
            <UCheckbox
              v-for="s in SATUAN_TERSEDIA"
              :key="s"
              :model-value="fp.satuan.includes(s)"
              :label="s"
              @update:model-value="fp.satuan = $event ? [...fp.satuan, s] : fp.satuan.filter(x => x !== s)"
            />
          </div>
        </UFormField>
        <UFormField label="Kategori (untuk Daily SO)">
          <UInput
            v-model="fp.kategori"
            list="stock-db-kategori"
          />
          <datalist id="stock-db-kategori">
            <option
              v-for="k in KATEGORI"
              :key="k"
              :value="k"
            />
          </datalist>
        </UFormField>
        <UFormField label="Area (kosong = umum)">
          <div class="flex flex-wrap gap-1">
            <UCheckbox
              v-for="a in AREA"
              :key="a"
              :model-value="fp.area.includes(a)"
              :label="a"
              @update:model-value="fp.area = $event ? [...fp.area, a] : fp.area.filter(x => x !== a)"
            />
          </div>
        </UFormField>
        <UFormField label="Cara beli">
          <USelect
            v-model="fp.caraBeli"
            :items="[
              { value: '', label: 'Diantar vendor' },
              { value: 'online', label: 'Online' },
              { value: 'jemput', label: 'Jemput' },
            ]"
          />
        </UFormField>
        <UCheckbox
          v-model="fp.aktif"
          label="Bahan ini masih dipakai"
        />
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheetProduk = false"
          />
          <UButton
            label="Simpan"
            :loading="simpanProduk"
            @click="simpanP"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
