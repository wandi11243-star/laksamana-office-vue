<!--
  Stock › HPP › Daftar Resep (old `deploy/stock/hpp/index.html:216`, JUDUL resep `:833`).

  Tabs Menu Jadi · Base & Olahan · Prasmanan (from `seksi`, T-17), separate
  pager per tab, Excel/CSV export + import, PDF via the browser's print.
  COGS = portion cost / selling price; the price is always for ONE yield (F.4).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ResepHppTulis } from '~/composables/useStock'
import {
  createRecipe,
  deleteRecipe,
  hppSettings,
  importRecipes,
  patchRecipe,
} from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { barisBerkolom } from '~/utils/stock-impor'
import { angka, persen, rupiah } from '~/utils/format'
import {
  buatKonteks,
  cogsOf,
  csvResep,
  kategoriResep,
  modalMenu,
  porsiYield,
  seksiTanpaPras,
  SET_DEFAULT,
  type KonteksHpp,
} from '~/utils/stock-hpp'
import { unduhCsvStock } from '~/utils/stock-catat'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['hpp'] })

const toast = useToast()

const bahanQ = useAsyncData('hpp-resep-bahan', getHppIngredients, { default: () => ({ rows: [] }) })
const resepQ = useAsyncData('hpp-resep', hppRecipes, {
  default: () => ({ rows: [] as ResepHppTulis[], versions: {} as Record<string, Versi> }),
})
const versiResep = computed(() => resepQ.data.value?.versions ?? {})
const setQ = useAsyncData('hpp-resep-set', hppSettings, { default: () => ({ data: SET_DEFAULT, versi: undefined }) })
const set = computed(() => ({ ...SET_DEFAULT, ...(setQ.data.value?.data ?? {}) }))

const ctx = computed<KonteksHpp>(() => buatKonteks(
  (bahanQ.data.value?.rows ?? []).map(b => ({
    nama: String(b.nama ?? ''),
    satuan: String(b.satuan ?? ''),
    qty_beli: Number(b.qty_beli ?? 0),
    harga_beli: Number(b.harga_beli ?? 0),
    produk: String(b.produk ?? ''),
    sisi_harga: String(b.sisi_harga ?? ''),
  })),
  (resepQ.data.value?.rows ?? []).map(r => ({
    id: String(r.id ?? ''),
    nama: String(r.nama ?? ''),
    jenis: String(r.jenis ?? ''),
    tipe: String(r.tipe ?? ''),
    seksi: String(r.seksi ?? ''),
    yield_qty: Number(r.yield_qty ?? 1),
    yield_unit: String(r.yield_unit ?? ''),
    harga_baru: Number(r.harga_baru ?? 0),
    modal_manual: Number(r.modal_manual ?? 0),
    bahan: (r.bahan ?? []).map(b => ({ nama: b.nama, qty: Number(b.qty ?? 0), satuan: b.satuan, ref: b.ref, catatan: b.catatan })),
  })),
))

const tab = ref<'dish' | 'base' | 'pras'>('dish')
const jenisTab = ref<'semua' | 'food' | 'drink'>('semua')
const statusTab = ref<'semua' | 'aktif' | 'nonaktif'>('semua')
const cari = ref('')
const hal = ref(1)
const per = 25
watch([tab, jenisTab, statusTab, cari], () => {
  hal.value = 1
})

/** Recipes of the active tab matching the search, before the Makanan/Minuman filter (feeds its counts). */
const saringTab = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return (resepQ.data.value?.rows ?? []).filter((r) => {
    if (kategoriResep({ nama: String(r.nama), tipe: String(r.tipe), seksi: String(r.seksi) }) !== tab.value) return false
    return !q || [r.nama, r.seksi].some(v => String(v ?? '').toLowerCase().includes(q))
  }).sort((a, b) => String(a.nama ?? '').localeCompare(String(b.nama ?? ''), 'id'))
})
const cocokJenis = (r: ResepHppTulis) => jenisTab.value === 'semua' || String(r.jenis ?? 'food') === jenisTab.value
const cocokStatus = (r: ResepHppTulis) => statusTab.value === 'semua' || aktifOf(r) === (statusTab.value === 'aktif')
const saring = computed(() => saringTab.value.filter(r => cocokJenis(r) && cocokStatus(r)))
const opsiStatus = computed(() => {
  const rows = saringTab.value.filter(cocokJenis)
  const nAktif = rows.filter(aktifOf).length
  return [
    { value: 'semua' as const, label: `Semua status (${rows.length})` },
    { value: 'aktif' as const, label: `Aktif (${nAktif})`, icon: 'i-lucide-circle-check' },
    { value: 'nonaktif' as const, label: `Nonaktif (${rows.length - nAktif})`, icon: 'i-lucide-circle-pause' },
  ]
})
const opsiJenis = computed(() => [
  { value: 'semua' as const, label: `Semua (${saringTab.value.length})` },
  { value: 'food' as const, label: `Makanan (${saringTab.value.filter(r => String(r.jenis ?? 'food') === 'food').length})`, icon: 'i-lucide-utensils' },
  { value: 'drink' as const, label: `Minuman (${saringTab.value.filter(r => String(r.jenis) === 'drink').length})`, icon: 'i-lucide-cup-soda' },
])
const aktifOf = (r: ResepHppTulis) => r.aktif !== 0 && r.aktif !== false
const nBahan = (r: ResepHppTulis) => (r.bahan ?? []).filter(b => (b.nama || '').trim()).length
const totalHal = computed(() => Math.max(1, Math.ceil(saring.value.length / per)))
const tampil = computed(() => saring.value.slice((hal.value - 1) * per, hal.value * per))

const keHitung = (r: ResepHppTulis) => ctx.value.PR.get(lowKey(r)) ?? null
const lowKey = (r: ResepHppTulis) => `${String(r.jenis ?? '').toLowerCase()}|${String(r.nama ?? '').toLowerCase()}`
const modalOf = (r: ResepHppTulis) => {
  const h = keHitung(r)
  return h ? modalMenu(ctx.value, h, set.value.buffer).total : 0
}
const cogs = (r: ResepHppTulis) => {
  const h = keHitung(r)
  return h ? cogsOf(ctx.value, h, set.value.buffer) : null
}

// Columns of the old Daftar Resep (owner request, Nov 2026), without Kode POS.
const kolom: TableColumn<ResepHppTulis>[] = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'jenis', header: 'Jenis' },
  { accessorKey: 'seksi', header: 'Seksi' },
  { accessorKey: 'yield_qty', header: 'Yield' },
  { id: 'bahan', header: 'Bahan', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'modal', header: 'Modal', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'perunit', header: 'Per unit', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'harga_baru', header: 'Harga jual', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'cogs', header: 'COGS%' },
  { accessorKey: 'aktif', header: 'Aktif' },
  { id: 'aksi', header: '' },
]

/** Flip Aktif straight from the list (partial PATCH, only `aktif` changes). */
const mengubahAktif = ref<string | null>(null)
async function ubahAktif(r: ResepHppTulis, aktif: boolean) {
  const id = String(r.id)
  mengubahAktif.value = id
  try {
    await patchRecipe(id, { aktif: aktif ? 1 : 0 }, versiResep.value[id])
    await resepQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => resepQ.refresh()))) toast.add({ title: 'Gagal mengubah status', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengubahAktif.value = null
  }
}

// --- editor -----------------------------------------------------------------------
const sheet = ref(false)
const editing = ref<ResepHppTulis | null>(null)
const f = ref({
  nama: '', jenis: 'food', tipe: 'dish', seksi: '', kode: '',
  yield_qty: 1, yield_unit: 'Porsi', harga_baru: 0, modal_manual: 0, aktif: true, catatan: '',
  bahan: [] as { nama: string, qty: number, satuan: string, ref: string, catatan: string }[],
})
function bukaTambah() {
  editing.value = null
  f.value = { nama: '', jenis: 'food', tipe: tab.value === 'base' ? 'base' : 'dish', seksi: tab.value === 'pras' ? 'PRASMANAN' : '', kode: '', yield_qty: 1, yield_unit: 'Porsi', harga_baru: 0, modal_manual: 0, aktif: true, catatan: '', bahan: [{ nama: '', qty: 1, satuan: '', ref: 'bahan', catatan: '' }] }
  sheet.value = true
}
function bukaUbah(r: ResepHppTulis) {
  editing.value = r
  f.value = {
    nama: String(r.nama ?? ''),
    jenis: String(r.jenis ?? 'food'),
    tipe: String(r.tipe ?? 'dish'),
    seksi: String(r.seksi ?? ''),
    kode: String(r.kode ?? ''),
    yield_qty: Number(r.yield_qty ?? 1),
    yield_unit: String(r.yield_unit ?? ''),
    harga_baru: Number(r.harga_baru ?? 0),
    modal_manual: Number(r.modal_manual ?? 0),
    aktif: r.aktif !== 0 && r.aktif !== false,
    catatan: String(r.catatan ?? ''),
    bahan: (r.bahan ?? []).map(b => ({ nama: b.nama || '', qty: Number(b.qty ?? 0), satuan: b.satuan || '', ref: b.ref || 'bahan', catatan: b.catatan || '' })),
  }
  if (!f.value.bahan.length) f.value.bahan = [{ nama: '', qty: 1, satuan: '', ref: 'bahan', catatan: '' }]
  sheet.value = true
}
const menyimpan = ref(false)
async function simpan() {
  if (!f.value.nama.trim()) {
    toast.add({ title: 'Nama resep wajib diisi', color: 'warning' })
    return
  }
  menyimpan.value = true
  try {
    const body: Record<string, unknown> = {
      nama: f.value.nama.trim(),
      jenis: f.value.jenis,
      tipe: f.value.tipe,
      seksi: f.value.seksi.trim(),
      kode: f.value.kode.trim().toUpperCase(),
      yield_qty: Number(f.value.yield_qty) || 1,
      yield_unit: f.value.yield_unit,
      harga_baru: Number(f.value.harga_baru) || 0,
      modal_manual: Number(f.value.modal_manual) || 0,
      aktif: f.value.aktif ? 1 : 0,
      catatan: f.value.catatan.trim(),
      bahan: f.value.bahan.filter(b => b.nama.trim() || b.catatan.trim()).map(b => ({
        nama: b.nama.trim() || undefined,
        qty: Number(b.qty) || 0,
        satuan: b.satuan.trim(),
        ref: b.ref === 'resep' ? 'resep' : undefined,
        catatan: b.catatan.trim() || undefined,
      })),
    }
    if (editing.value?.id != null) {
      await patchRecipe(String(editing.value.id), body, versiResep.value[String(editing.value.id)])
    }
    else {
      await createRecipe(body as { nama: string })
    }
    sheet.value = false
    await resepQ.refresh()
    toast.add({ title: 'Resep tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => resepQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
async function hapus(r: ResepHppTulis) {
  try {
    await deleteRecipe(String(r.id), versiResep.value[String(r.id)])
    await resepQ.refresh()
    toast.add({ title: 'Resep dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => resepQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}
// --- import / export ----------------------------------------------------------------
function unduhCsv() {
  unduhCsvStock(
    `resep-${tab.value}.csv`,
    csvResep(saring.value.map(r => ({
      nama: String(r.nama ?? ''),
      jenis: String(r.jenis ?? ''),
      tipe: String(r.tipe ?? ''),
      seksi: String(r.seksi ?? ''),
      kode: String(r.kode ?? ''),
      yield_qty: Number(r.yield_qty ?? 0),
      yield_unit: String(r.yield_unit ?? ''),
      harga_baru: Number(r.harga_baru ?? 0),
      modal_manual: Number(r.modal_manual ?? 0),
      aktif: r.aktif,
      bahan: (r.bahan ?? []).map(b => ({ nama: b.nama, qty: Number(b.qty ?? 0), satuan: b.satuan, ref: b.ref, catatan: b.catatan })),
    }))),
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
    const rows = barisBerkolom(tb)
    // One spreadsheet row = one ingredient line; the recipe columns repeat on
    // the first line of each recipe (F.8). Group by recipe name + kind.
    const grup = new Map<string, Record<string, unknown> & { bahan: Record<string, unknown>[] }>()
    let kunci = ''
    for (const r of rows) {
      const nm = String(r.Nama || r.nama || '').trim()
      if (nm) {
        kunci = `${r.Jenis || r.jenis || 'food'}|${nm}`
        if (!grup.has(kunci)) {
          const ambilResep = (k: string): string => String(r[k] ?? '').trim()
          const det: Record<string, unknown> & { bahan: Record<string, unknown>[] } = {
            nama: nm,
            jenis: String(r.Jenis || r.jenis || 'food'),
            tipe: String(r.Tipe || r.tipe || 'dish'),
            seksi: String(r.Seksi || r.seksi || ''),
            kode: String(r.Kode || r.kode || ''),
            bahan: [],
          }
          // The export repeats the recipe columns on the first line, so a
          // re-uploaded export restores them (unset cells keep the default).
          if (ambilResep('Yield') !== '') det.yield_qty = Number(ambilResep('Yield')) || 1
          if (ambilResep('Satuan yield') !== '') det.yield_unit = ambilResep('Satuan yield')
          if (ambilResep('Harga jual') !== '') det.harga_baru = Number(ambilResep('Harga jual')) || 0
          if (ambilResep('Modal manual') !== '') det.modal_manual = Number(ambilResep('Modal manual')) || 0
          if (ambilResep('Aktif') !== '') det.aktif = Number(ambilResep('Aktif')) ? 1 : 0
          grup.set(kunci, det)
        }
      }
      const g = grup.get(kunci)
      if (!g) continue
      const bn = String(r.Bahan || r.bahan || '').trim()
      const ct = String(r['Catatan baris'] || r.catatan || '').trim()
      if (bn || ct) {
        g.bahan.push({ nama: bn || undefined, qty: Number(r.Qty || r.qty || 0), satuan: String(r.Satuan || r.satuan || ''), ref: String(r.Ref || r.ref || ''), catatan: ct || undefined })
      }
    }
    const hasil = await importRecipes([...grup.values()])
    await resepQ.refresh()
    toast.add({ title: 'Impor selesai', description: `${hasil.baru} baru, ${hasil.diubah} diubah, ${hasil.lewat} lewat.`, color: 'success' })
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
    title="Daftar Resep"
    description="Semua resep base & menu jadi berikut modalnya"
  >
    <template #actions>
      <UButton
        label="Tambah resep"
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
        @click="($refs.imporResep as HTMLInputElement)?.click()"
      />
      <input
        ref="imporResep"
        type="file"
        accept=".xlsx,.xls,.csv"
        class="hidden"
        @change="impor"
      >
    </template>

    <AppStatGrid>
      <AppStat
        label="Menu jadi"
        :value="String((resepQ.data.value?.rows ?? []).filter(r => String(r.tipe) === 'dish').length)"
        satuan="resep"
        icon="i-lucide-utensils"
        tone="gold"
      />
      <AppStat
        label="Base & olahan"
        :value="String((resepQ.data.value?.rows ?? []).filter(r => String(r.tipe) === 'base').length)"
        satuan="resep"
        icon="i-lucide-cooking-pot"
        tone="info"
      />
      <AppStat
        label="Prasmanan"
        :value="String((resepQ.data.value?.rows ?? []).filter(r => kategoriResep({ nama: String(r.nama), tipe: String(r.tipe), seksi: String(r.seksi) }) === 'pras').length)"
        satuan="resep"
        icon="i-lucide-concierge-bell"
        tone="vip"
      />
    </AppStatGrid>

    <AppPanel title="Resep">
      <template #head>
        <div class="flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="tab"
            :options="[
              { value: 'dish', label: 'Menu jadi' },
              { value: 'base', label: 'Base & olahan' },
              { value: 'pras', label: 'Prasmanan' },
            ]"
          />
          <UInput
            v-model="cari"
            placeholder="Cari nama resep atau seksi…"
            icon="i-lucide-search"
          />
        </div>
      </template>
      <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <AppChips
          v-model="jenisTab"
          :options="opsiJenis"
        />
        <span
          class="hidden h-5 border-l border-default sm:block"
          aria-hidden="true"
        />
        <AppChips
          v-model="statusTab"
          :options="opsiStatus"
        />
      </div>
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="tampil"
        >
          <template #nama-cell="{ row }">
            <b class="text-highlighted">{{ row.original.nama }}</b>
          </template>
          <template #jenis-cell="{ row }">
            <AppStatus
              :color="String(row.original.jenis) === 'drink' ? 'info' : 'vip'"
              size="sm"
            >
              {{ String(row.original.jenis) === 'drink' ? 'Minuman' : 'Makanan' }}
            </AppStatus>
          </template>
          <template #seksi-cell="{ row }">
            <span class="text-muted">{{ row.original.seksi ? seksiTanpaPras(String(row.original.seksi)) : '—' }}</span>
          </template>
          <template #yield_qty-cell="{ row }">
            <span class="whitespace-nowrap">{{ angka(Number(row.original.yield_qty ?? 0)) }} {{ row.original.yield_unit || '' }}</span>
          </template>
          <template #bahan-cell="{ row }">
            <span class="num">{{ nBahan(row.original) }}</span>
          </template>
          <template #harga_baru-cell="{ row }">
            <span class="num whitespace-nowrap">{{ Number(row.original.harga_baru ?? 0) > 0 ? rupiah(Number(row.original.harga_baru)) : '—' }}</span>
          </template>
          <template #modal-cell="{ row }">
            <span class="num whitespace-nowrap">{{ rupiah(Math.round(modalOf(row.original))) }}</span>
          </template>
          <template #perunit-cell="{ row }">
            <span class="num whitespace-nowrap">{{ rupiah(Math.round(modalOf(row.original) / porsiYield({ nama: '', yield_qty: Number(row.original.yield_qty ?? 1) }))) }}</span>
          </template>
          <template #aktif-cell="{ row }">
            <USwitch
              :model-value="aktifOf(row.original)"
              :label="aktifOf(row.original) ? 'Aktif' : 'Nonaktif'"
              :loading="mengubahAktif === String(row.original.id)"
              size="sm"
              @update:model-value="ubahAktif(row.original, !!$event)"
            />
          </template>
          <template #cogs-cell="{ row }">
            <span
              v-if="cogs(row.original) == null"
              class="text-sm text-dimmed"
            >belum ada harga</span>
            <AppStatus
              v-else
              :color="cogs(row.original)! <= 0.25 ? 'success' : cogs(row.original)! <= 0.33 ? 'warning' : 'error'"
              size="sm"
            >
              {{ persen(cogs(row.original), 1) }}
            </AppStatus>
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
                loading-auto
                @click="hapus(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 lg:hidden">
        <div
          v-for="r in tampil"
          :key="String(r.id)"
          class="rounded-xl border border-default p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <b class="text-highlighted">{{ r.nama }}</b>
            <span
              v-if="cogs(r) == null"
              class="text-sm text-dimmed"
            >belum ada harga</span>
            <AppStatus
              v-else
              :color="cogs(r)! <= 0.25 ? 'success' : cogs(r)! <= 0.33 ? 'warning' : 'error'"
              size="sm"
            >
              {{ persen(cogs(r), 1) }}
            </AppStatus>
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ String(r.jenis) === 'drink' ? 'Minuman' : 'Makanan' }}{{ r.seksi ? ` · ${seksiTanpaPras(String(r.seksi))}` : '' }} · {{ nBahan(r) }} bahan
          </p>
          <p class="text-sm text-muted">
            Modal {{ rupiah(Math.round(modalOf(r))) }} · Harga jual {{ Number(r.harga_baru ?? 0) > 0 ? rupiah(Number(r.harga_baru)) : '—' }}
          </p>
          <div class="mt-2 flex items-center gap-1">
            <USwitch
              :model-value="aktifOf(r)"
              :label="aktifOf(r) ? 'Aktif' : 'Nonaktif'"
              :loading="mengubahAktif === String(r.id)"
              size="sm"
              class="mr-auto"
              @update:model-value="ubahAktif(r, !!$event)"
            />
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              size="sm"
              :aria-label="`Ubah ${r.nama}`"
              @click="bukaUbah(r)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              size="sm"
              color="error"
              :aria-label="`Hapus ${r.nama}`"
              loading-auto
              @click="hapus(r)"
            />
          </div>
        </div>
        <p
          v-if="!tampil.length"
          class="text-sm text-dimmed"
        >
          Tidak ada resep di tab ini.
        </p>
      </div>
      <div class="flex items-center justify-between p-3 text-sm text-muted">
        <span>{{ saring.length ? `${(hal - 1) * per + 1}–${Math.min(hal * per, saring.length)} dari ${saring.length}` : '0 dari 0' }} · 25 / hal</span>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-chevron-left"
            variant="outline"
            size="sm"
            aria-label="Halaman sebelumnya"
            :disabled="hal <= 1"
            @click="hal--"
          />
          <UButton
            icon="i-lucide-chevron-right"
            variant="outline"
            size="sm"
            aria-label="Halaman berikut"
            :disabled="hal >= totalHal"
            @click="hal++"
          />
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="editing ? 'Ubah resep' : 'Tambah resep'"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Nama resep">
          <UInput
            v-model="f.nama"
            :disabled="!!editing"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Jenis">
            <USelect
              v-model="f.jenis"
              :items="[{ value: 'food', label: 'Makanan' }, { value: 'drink', label: 'Minuman' }]"
            />
          </UFormField>
          <UFormField label="Tipe">
            <USelect
              v-model="f.tipe"
              :items="[{ value: 'dish', label: 'Menu jadi' }, { value: 'base', label: 'Base & olahan' }]"
            />
          </UFormField>
        </div>
        <!-- Kode POS is no longer shown (owner request, Nov 2026); the stored value rides along unchanged. -->
        <UFormField label="Seksi (PRASMANAN… = prasmanan)">
          <UInput
            v-model="f.seksi"
            placeholder="Mis. Dapur / PRASMANAN Pagi"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Yield">
            <UInput
              v-model.number="f.yield_qty"
              type="number"
              min="1"
            />
          </UFormField>
          <UFormField label="Satuan yield">
            <UInput v-model="f.yield_unit" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Harga jual">
            <UInput
              v-model.number="f.harga_baru"
              type="number"
              min="0"
            />
          </UFormField>
          <UFormField label="Modal ketikan tangan">
            <UInput
              v-model.number="f.modal_manual"
              type="number"
              min="0"
            />
          </UFormField>
        </div>
        <UCheckbox
          v-model="f.aktif"
          label="Resep aktif"
        />
        <AppSectionTitle title="Baris bahan" />
        <div
          v-for="(b, i) in f.bahan"
          :key="i"
          class="grid grid-cols-2 gap-2 rounded-xl border bg-muted border-default p-2"
        >
          <UFormField label="Nama">
            <UInput v-model="b.nama" />
          </UFormField>
          <UFormField label="Catatan tahap">
            <UInput
              v-model="b.catatan"
              placeholder="Kosongkan bila bahan"
            />
          </UFormField>
          <UFormField label="Qty">
            <UInput
              v-model.number="b.qty"
              type="number"
              min="0"
            />
          </UFormField>
          <UFormField label="Satuan">
            <UInput v-model="b.satuan" />
          </UFormField>
          <UFormField label="Dari resep?">
            <USelect
              v-model="b.ref"
              :items="[{ value: 'bahan', label: 'Dari bahan' }, { value: 'resep', label: 'Dari resep' }]"
            />
          </UFormField>
          <div class="flex items-end">
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              aria-label="Hapus baris"
              @click="f.bahan.splice(i, 1)"
            />
          </div>
        </div>
        <UButton
          label="Tambah baris"
          icon="i-lucide-plus"
          variant="outline"
          class="self-start"
          @click="f.bahan.push({ nama: '', qty: 1, satuan: '', ref: 'bahan', catatan: '' })"
        />
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
