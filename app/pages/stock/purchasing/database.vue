<!--
  Stock › Purchasing › Database & Vendor (old `deploy/stock/purchasing/index.html:191-192,820-965`).

  Two blocks: Daftar Kontak Vendor and Aturan Distribusi Bahan Baku & Produk,
  plus Kustomisasi Format Chat. Categories must match SO_KATEGORI exactly
  (old `:1444-1453`); `caraBeli ''` = Diantar vendor (`:1498-1508`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { isAdminOf } from '~/composables/useMe'
import type { ProdukStock, VendorStock } from '~/composables/useStock'
import {
  bolehUbahPurchasing,
  createProduk,
  createVendor,
  deleteProduk,
  deleteVendor,
  getStockSettings,
  importProducts,
  importVendors,
  useVendorStock,
  patchProduk,
  patchVendor,
  putStockSettings,
  useProdukStock,
} from '~/composables/useStock'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { barisBerkolom, barisKeProduk, barisKeVendor } from '~/utils/stock-impor'
import { SATUAN_TERSEDIA, unduhCsvStock } from '~/utils/stock-catat'
import { tanganiKonflik } from '~/utils/versi'
import { warnaKategori } from '~/utils/kategori-warna'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()
// Purchasing `view` role (old PERM_DEFAULT): look, never change — the server refuses too.
const bisaUbah = computed(() => bolehUbahPurchasing('database'))
const sub = ref<'vendor' | 'bahan' | 'chat'>('vendor')

const KATEGORI = ['DRY ITEM', 'CHILLER ITEM', 'FRESH', 'OPERATIONAL', 'STORE ITEM', 'Liquid/Syrup', 'Tea Section', 'Fresh Fruits', 'Cake', 'Kelapa', 'Buah Prep', 'Packaging', 'Powder', 'Powder Herbs']
const BANK = ['BCA', 'Mandiri', 'BRI', 'BNI', 'UOB', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'Lainnya']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const AREA = ['Kitchen', 'Bar', 'Floor']

// ---------------------------------------------------------------- vendors
const vendorQ = useVendorStock()
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
  { accessorKey: 'perluJadwalJemput', header: 'Jemput' },
  { accessorKey: 'tutupHari', header: 'Hari tutup' },
  { id: 'jumlahBahan', header: 'Bahan' },
  { id: 'aksi', header: '' },
]
/** How many products name this vendor as main or backup. */
const bahanVendor = computed(() => {
  const m = new Map<string, number>()
  for (const p of produkQ.data.value?.rows ?? []) {
    for (const v of new Set([p.utama, ...(((p as unknown as Record<string, unknown>).cadangan as string[] | undefined) ?? [])].filter(Boolean) as string[])) {
      m.set(v, (m.get(v) ?? 0) + 1)
    }
  }
  return m
})

// ---------------------------------------------------------------- products
const produkQ = useProdukStock()
const versiProduk = computed(() => produkQ.data.value?.versions ?? {})
const cariProduk = ref('')
/* Where a product lives decides who handles it (owner request, Nov 2026): the
 *  list is split by `sumber`, each warehouse's goods under their own heading,
 *  with a chip filter per source. '' / unknown = bought from a vendor. */
type SumberKey = 'vendor' | 'ck' | 'both' | 'bar'
const KELOMPOK_SUMBER: { key: SumberKey, label: string, icon: string, ket: string }[] = [
  { key: 'vendor', label: 'Beli dari vendor', icon: 'i-lucide-truck', ket: 'Dipesan ke vendor, langsung dipakai outlet.' },
  { key: 'ck', label: 'Central Kitchen', icon: 'i-lucide-chef-hat', ket: 'Diproduksi dapur sendiri, disimpan di Central Kitchen.' },
  { key: 'both', label: 'Vendor & CK', icon: 'i-lucide-warehouse', ket: 'Dibeli ke vendor, disimpan di Central Kitchen.' },
  { key: 'bar', label: 'Vendor & Gudang Bar', icon: 'i-lucide-wine', ket: 'Dibeli ke vendor, disimpan di Gudang Bar dan diminta tim bar.' },
]
const sumberKey = (p: ProdukStock): SumberKey => (['ck', 'both', 'bar'].includes(p.sumber ?? '') ? p.sumber as SumberKey : 'vendor')
const filterSumber = ref<'semua' | SumberKey>('semua')
const produkCari = computed(() => {
  const q = cariProduk.value.trim().toLowerCase()
  return (produkQ.data.value?.rows ?? []).filter(p => !q || p.nama.toLowerCase().includes(q))
})
const produkTampil = computed(() => produkCari.value.filter(p => filterSumber.value === 'semua' || sumberKey(p) === filterSumber.value))
const opsiFilterSumber = computed(() => [
  { value: 'semua' as const, label: `Semua (${produkCari.value.length})` },
  ...KELOMPOK_SUMBER.map(k => ({ value: k.key, label: `${k.label} (${produkCari.value.filter(p => sumberKey(p) === k.key).length})` })),
])
const kelompokProduk = computed(() => KELOMPOK_SUMBER
  .map(k => ({ ...k, rows: produkTampil.value.filter(p => sumberKey(p) === k.key) }))
  .filter(k => k.rows.length))

const sheetProduk = ref(false)
const produkEdit = ref<ProdukStock | null>(null)
const fp = ref({
  nama: '',
  sumber: 'vendor',
  satuanDasar: '',
  packIsi: 1,
  satuanTampil: '',
  diOutlet: false,
  utama: '',
  cadangan: [] as string[],
  satuan: [] as string[],
  isi: {} as Record<string, number>,
  kategori: '',
  area: [] as string[],
  caraBeli: 'antar',
  aktif: true,
})
function bukaProduk(p?: ProdukStock) {
  produkEdit.value = p ?? null
  fp.value = p
    ? {
        nama: p.nama,
        sumber: (p.sumber as string) || 'vendor',
        satuanDasar: (p.satuanDasar as string) || '',
        packIsi: Number((p as unknown as Record<string, unknown>).packIsi) || 1,
        satuanTampil: String((p as unknown as Record<string, unknown>).satuanTampil ?? ''),
        diOutlet: !!((p as unknown as Record<string, unknown>).diOutlet),
        utama: (p.utama as string) || '',
        cadangan: [...((p.cadangan as string[]) ?? [])],
        satuan: [...((p.satuan as string[]) ?? [])],
        isi: { ...((p.isi as Record<string, number>) ?? {}) },
        kategori: (p.kategori as string) || '',
        area: [...((p.area as string[]) ?? [])],
        caraBeli: (p.caraBeli as string) || 'antar',
        aktif: p.aktif !== false,
      }
    : { nama: '', sumber: 'vendor', satuanDasar: '', packIsi: 1, satuanTampil: '', diOutlet: false, utama: '', cadangan: [], satuan: [], isi: {}, kategori: '', area: [], caraBeli: 'antar', aktif: true }
  sheetProduk.value = true
  // Pack cannot be its own base unit ("1 Pack = N Pack" means nothing). This form
  // has no separate Bentuk Simpanan field — packed-ness is packIsi > 0 alone —
  // so zeroing packIsi IS the move to Curah/Eceran. Dropped on load too.
  if (String(fp.value.satuanDasar).trim().toLowerCase() === 'pack') fp.value.packIsi = 0
}
const namaVendorSemua = computed(() => (vendorQ.data.value?.rows ?? []).map(v => v.nama))

/**
 * Pack as the base unit means the product is NOT packed: "1 Pack = N Pack"
 * cannot be measured in itself. Picking Pack clears and locks the pack-size
 * field. There is no separate Bentuk Simpanan control in this form (the old
 * client had one); packed-ness here is packIsi > 0 alone, so clearing the
 * field is the whole auto-move to Curah/Eceran.
 */
const dasarPack = computed(() => String(fp.value.satuanDasar).trim().toLowerCase() === 'pack')
watch(dasarPack, (aktif) => {
  if (aktif) fp.value.packIsi = 0
})
/**
 * "Satuan Tampilan Stok" options (CK goods only): Otomatis (`''`) plus every
 * unit the crew could mean — the checked units, Pack, the base unit, measured
 * sizes and the standard list. The display falls back to automatic when the
 * chosen unit does not convert, so offering broadly here is safe.
 */
const opsiTampil = computed(() => {
  const ada: string[] = []
  const tambah = (x: unknown) => {
    const s = String(x ?? '').trim()
    if (s && !ada.some(y => y.toLowerCase() === s.toLowerCase())) ada.push(s)
  }
  fp.value.satuan.forEach(tambah)
  if (Number(fp.value.packIsi) > 0) tambah('Pack')
  tambah(fp.value.satuanDasar)
  Object.keys(fp.value.isi ?? {}).forEach(tambah)
  tambah(fp.value.satuanTampil)
  SATUAN_TERSEDIA.forEach(tambah)
  return [{ value: '', label: 'Otomatis' }, ...ada.map(u => ({ value: u, label: u }))]
})
const simpanProduk = ref(false)
async function simpanP() {
  if (!fp.value.nama.trim()) {
    toast.add({ title: 'Nama bahan wajib diisi', color: 'warning' })
    return
  }
  // Backstop for the auto-clear above: Dipack + Pack can never be saved.
  if (dasarPack.value && Number(fp.value.packIsi) > 0) {
    toast.add({ title: 'Isi pack tidak berlaku bila satuan dasarnya Pack', description: 'Kosongkan dulu isi pack, atau ganti satuan dasarnya.', color: 'error' })
    return
  }
  simpanProduk.value = true
  try {
    const body: Record<string, unknown> = {
      nama: fp.value.nama.trim(),
      sumber: fp.value.sumber === 'vendor' ? '' : fp.value.sumber,
      satuanDasar: fp.value.satuanDasar,
      isi: fp.value.isi,
      // `''` = automatic display (the server's preserve-if-null keeps the old
      // value when the key is absent; sending `''` resets to automatic).
      satuanTampil: fp.value.satuanTampil,
      diOutlet: fp.value.diOutlet,
      utama: fp.value.utama,
      cadangan: fp.value.cadangan,
      satuan: fp.value.satuan,
      kategori: fp.value.kategori,
      area: fp.value.area,
      caraBeli: fp.value.caraBeli === 'antar' ? '' : fp.value.caraBeli,
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

const labelSumber = (s: string) => (s === 'ck' ? 'Central Kitchen' : s === 'both' ? 'Vendor & CK' : s === 'bar' ? 'Vendor & Gudang Bar' : 'Beli dari vendor')
const labelCara = (s: string) => (s === 'online' ? 'Online' : s === 'jemput' ? 'Jemput' : 'Diantar vendor')
// The old Database columns (owner request, Nov 2026).
const kolomProduk: TableColumn<ProdukStock>[] = [
  { accessorKey: 'nama', header: 'Nama bahan baku' },
  { accessorKey: 'kategori', header: 'Kategori' },
  { accessorKey: 'area', header: 'Area' },
  { accessorKey: 'utama', header: 'Vendor utama' },
  { accessorKey: 'cadangan', header: 'Vendor alternatif' },
  { accessorKey: 'satuan', header: 'Satuan' },
  { accessorKey: 'caraBeli', header: 'Cara beli' },
  { id: 'pack', header: 'Pack' },
  { accessorKey: 'aktif', header: 'Aktif' },
  { id: 'aksi', header: '' },
]
const rec = (p: ProdukStock) => p as unknown as Record<string, unknown>
const daftarOf = (p: ProdukStock, k: string) => ((rec(p)[k] as string[] | undefined) ?? []).filter(Boolean)
/** One unit chip per checked unit, with its size in the base unit when measured ("Liter · 1000"). */
function satuanChip(p: ProdukStock) {
  const isi = (rec(p).isi as Record<string, number> | undefined) ?? {}
  const dasar = String(rec(p).satuanDasar ?? '').trim()
  return daftarOf(p, 'satuan').map(s => ({
    nama: s,
    ket: s.toLowerCase() === dasar.toLowerCase() ? 'terkecil' : (Number(isi[s]) > 0 ? String(isi[s]) : ''),
  }))
}
function packOf(p: ProdukStock) {
  const n = Number(rec(p).packIsi) || 0
  const dasar = String(rec(p).satuanDasar ?? '').trim()
  return n > 0 ? `1 Pack = ${n}${dasar ? ` ${dasar}` : ''}` : ''
}
const iconCara = (s: string) => (s === 'online' ? 'i-lucide-globe' : s === 'jemput' ? 'i-lucide-car' : 'i-lucide-truck')

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
    const tb = await bacaBerkasTabel(file)
    // Letter-keyed rows -> header-keyed rows, then export labels -> API keys
    // (the API reads lowercase `nama`, `whatsapp`, ... — letters arrive as
    // nameless rows and are all skipped).
    const mapped = barisBerkolom(tb)
    const r = jenis === 'vendor'
      ? await importVendors(mapped.map(barisKeVendor).filter(x => x.nama))
      : await importProducts(mapped.map(barisKeProduk).filter(x => x.nama))
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
// `GET /stock/settings/purchasing` is admin-only; others keep the built-in templates.
const me = useMe()
const admin = computed(() => isAdminOf(me.value, 'purchasing'))
const setQ = useAsyncData('stock-db-set', () => (admin.value ? getStockSettings('purchasing') : Promise.resolve({ data: {}, versi: undefined, tersedia: true })), {
  watch: [admin],
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
    <p
      v-if="!bisaUbah"
      class="mb-4 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
    >
      Peran Purchasing kamu hanya boleh <b>melihat</b> halaman ini.
    </p>
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
              v-if="bisaUbah"
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
              v-if="bisaUbah"
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
        <div class="mt-4 hidden lg:block">
          <UTable
            :columns="kolomVendor"
            :data="vendorTampil"
          >
            <template #penerima-cell="{ row }">
              {{ row.original.penerima || '—' }}
            </template>
            <template #nama-cell="{ row }">
              <b class="text-highlighted">{{ row.original.nama }}</b>
            </template>
            <template #bank-cell="{ row }">
              {{ row.original.bank ? `${row.original.bank} · ${row.original.norek || '—'}` : '—' }}
            </template>
            <template #perluJadwalJemput-cell="{ row }">
              <span class="text-sm">{{ row.original.perluJadwalJemput ? 'Tidak bisa hari yang sama' : 'Hari yang sama' }}</span>
            </template>
            <template #tutupHari-cell="{ row }">
              <span class="text-sm">{{ (row.original.tutupHari ?? []).map(i => HARI[i]).filter(Boolean).join(', ') || '—' }}</span>
            </template>
            <template #jumlahBahan-cell="{ row }">
              <span class="num">{{ bahanVendor.get(row.original.nama) ?? 0 }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end gap-1">
                <UButton
                  v-if="bisaUbah"
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Ubah ${row.original.nama}`"
                  @click="bukaVendor(row.original)"
                />
                <UButton
                  v-if="bisaUbah"
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
            class="flex items-center justify-between gap-2 rounded-xl border border-default p-3"
          >
            <div>
              <b class="text-highlighted">{{ v.nama }}</b>
              <p class="text-sm text-muted">
                {{ v.whatsapp }}{{ v.penerima ? ` · ${v.penerima}` : '' }}
              </p>
            </div>
            <div class="flex gap-1">
              <UButton
                v-if="bisaUbah"
                icon="i-lucide-pencil"
                variant="ghost"
                :aria-label="`Ubah ${v.nama}`"
                @click="bukaVendor(v)"
              />
              <UButton
                v-if="bisaUbah"
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
              v-if="bisaUbah"
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
              v-if="bisaUbah"
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
        <AppChips
          v-model="filterSumber"
          :options="opsiFilterSumber"
          class="mt-3"
        />

        <!-- One section per source (where the goods live), each its own layer-3 box. -->
        <section
          v-for="k in kelompokProduk"
          :key="k.key"
          class="mt-4 overflow-hidden rounded-xl border border-default bg-muted"
        >
          <header class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-deep">
              <UIcon
                :name="k.icon"
                class="size-4"
              />
            </span>
            <h3 class="text-sm font-bold text-highlighted">
              {{ k.label }}
            </h3>
            <span class="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-deep num">{{ k.rows.length }}</span>
            <p class="w-full text-xs text-muted sm:w-auto sm:flex-1">
              {{ k.ket }}
            </p>
          </header>
          <div class="hidden bg-default lg:block">
            <UTable
              :columns="kolomProduk"
              :data="k.rows"
            >
              <template #nama-cell="{ row }">
                <b class="text-highlighted">{{ row.original.nama }}</b>
              </template>
              <template #kategori-cell="{ row }">
                <span
                  v-if="row.original.kategori"
                  class="whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold"
                  :class="warnaKategori(String(row.original.kategori))"
                >{{ row.original.kategori }}</span>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </template>
              <template #area-cell="{ row }">
                <div
                  v-if="daftarOf(row.original, 'area').length"
                  class="flex flex-col items-start gap-1"
                >
                  <span
                    v-for="a in daftarOf(row.original, 'area')"
                    :key="a"
                    class="rounded-md border border-info/30 px-2 py-0.5 text-[11px] font-semibold text-info"
                  >{{ a }}</span>
                </div>
                <span
                  v-else
                  class="text-xs text-dimmed"
                >Umum</span>
              </template>
              <template #utama-cell="{ row }">
                <span
                  v-if="row.original.utama"
                  class="whitespace-nowrap rounded-md border border-success/30 px-2 py-0.5 text-xs font-semibold text-success"
                >{{ row.original.utama }}</span>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </template>
              <template #cadangan-cell="{ row }">
                <div
                  v-if="daftarOf(row.original, 'cadangan').length"
                  class="flex flex-col items-start gap-1"
                >
                  <span
                    v-for="v in daftarOf(row.original, 'cadangan')"
                    :key="v"
                    class="whitespace-nowrap rounded-md border border-warning/30 px-2 py-0.5 text-[11px] font-semibold text-warning"
                  >{{ v }}</span>
                </div>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </template>
              <template #satuan-cell="{ row }">
                <div
                  v-if="satuanChip(row.original).length"
                  class="flex flex-col items-start gap-1"
                >
                  <span
                    v-for="s in satuanChip(row.original)"
                    :key="s.nama"
                    class="whitespace-nowrap rounded-md border border-default px-2 py-0.5 text-[11px] font-semibold text-highlighted"
                  >{{ s.nama }}<span
                    v-if="s.ket"
                    class="font-normal text-muted"
                  > · {{ s.ket }}</span></span>
                </div>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </template>
              <template #caraBeli-cell="{ row }">
                <span class="inline-flex items-center gap-1 whitespace-nowrap text-sm">
                  <UIcon
                    :name="iconCara(String(row.original.caraBeli || ''))"
                    class="size-3.5 text-muted"
                  />
                  {{ labelCara(String(row.original.caraBeli || '')) }}
                </span>
              </template>
              <template #pack-cell="{ row }">
                <span class="num whitespace-nowrap text-sm">{{ packOf(row.original) || '—' }}</span>
              </template>
              <template #aktif-cell="{ row }">
                <AppStatus
                  :color="row.original.aktif === false ? 'neutral' : 'success'"
                  size="sm"
                >
                  {{ row.original.aktif === false ? 'Nonaktif' : 'Aktif' }}
                </AppStatus>
              </template>
              <template #aksi-cell="{ row }">
                <div class="flex justify-end gap-1">
                  <UButton
                    v-if="bisaUbah"
                    icon="i-lucide-pencil"
                    variant="ghost"
                    size="sm"
                    :aria-label="`Ubah ${row.original.nama}`"
                    @click="bukaProduk(row.original)"
                  />
                  <UButton
                    v-if="bisaUbah"
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
          <div class="flex flex-col gap-2 p-3 pt-0 lg:hidden">
            <div
              v-for="p in k.rows.slice(0, 60)"
              :key="p.nama"
              class="flex items-center justify-between gap-2 rounded-lg bg-default p-3 shadow-panel"
            >
              <div>
                <b class="text-highlighted">{{ p.nama }}</b>
                <p class="text-sm text-muted">
                  {{ p.utama || 'tanpa vendor' }} · {{ labelCara(String(p.caraBeli || '')) }}
                </p>
                <p class="text-xs text-dimmed">
                  {{ [p.kategori, daftarOf(p, 'area').join('/') || 'Umum', daftarOf(p, 'satuan').join(', '), packOf(p), p.aktif === false ? 'Nonaktif' : ''].filter(Boolean).join(' · ') }}
                </p>
              </div>
              <div class="flex gap-1">
                <UButton
                  v-if="bisaUbah"
                  icon="i-lucide-pencil"
                  variant="ghost"
                  :aria-label="`Ubah ${p.nama}`"
                  @click="bukaProduk(p)"
                />
                <UButton
                  v-if="bisaUbah"
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  :aria-label="`Hapus ${p.nama}`"
                  @click="hapusP(p)"
                />
              </div>
            </div>
          </div>
        </section>
        <p
          v-if="!kelompokProduk.length"
          class="mt-4 text-sm text-dimmed"
        >
          Tidak ada bahan yang cocok.
        </p>
      </div>

      <div v-if="sub === 'chat'">
        <p
          v-if="!setQ.data.value?.tersedia"
          class="mb-3 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
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
          v-if="bisaUbah"
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
            v-if="bisaUbah"
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
              { value: 'vendor', label: 'Beli dari vendor' },
              { value: 'ck', label: 'Central Kitchen' },
              { value: 'both', label: 'Vendor & CK' },
              { value: 'bar', label: 'Vendor & Gudang Bar' },
            ]"
          />
          <!-- Old `:1276-1286`: 'bar' is the 'both' of the second warehouse. -->
          <p class="mt-1 text-xs text-muted">
            <b>Vendor &amp; CK</b> = dibeli ke vendor, disimpan di Central Kitchen.
            <b>Vendor &amp; Gudang Bar</b> = sama, tapi disimpan di Gudang Bar dan diminta tim bar.
          </p>
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
              :disabled="dasarPack"
            />
            <p
              v-if="dasarPack"
              class="mt-1 text-xs text-muted"
            >
              Satuan dasar Pack tidak memakai isi pack — otomatis curah.
            </p>
          </UFormField>
        </div>
        <UFormField
          v-if="fp.sumber === 'ck' || fp.sumber === 'both' || fp.sumber === 'bar'"
          label="Satuan Tampilan Stok"
        >
          <USelect
            v-model="fp.satuanTampil"
            :items="opsiTampil"
          />
          <p class="mt-1 text-xs text-muted">
            Otomatis mengikuti bentuk simpanan; pilih satuan bila saldo harus selalu tampil dalam satuan itu.
          </p>
        </UFormField>
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
            :items="namaVendorSemua"
            placeholder="Tanpa vendor"
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
              { value: 'antar', label: 'Diantar vendor' },
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
            v-if="bisaUbah"
            label="Simpan"
            :loading="simpanProduk"
            @click="simpanP"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
