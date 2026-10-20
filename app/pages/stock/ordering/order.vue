<!--
  Stock › Ordering › Form Order Belanja (old `deploy/stock/ordering/index.html:164-166,262-329`).

  "Pengajuan Order Barang Baru" (Tahap 1): PIC from the session (read-only),
  arrival date (tomorrow by default + Hari Ini/Besok/Lusa shortcuts), material
  lines, "N Item siap dikirim". Batch mode Baru vs Gabung (`:894-899`).
  Pre-submit shows the duplicate count ("sudah X, akan jadi Y", old `:4653`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { catatLog, createBatch, joinableBatches, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari } from '~/utils/format'
import { SATUAN_TERSEDIA, unduhCsvStock } from '~/utils/stock-catat'

definePageMeta({ access: ['ordering'] })

const me = useMe()
const toast = useToast()

const produkQ = useProdukStock()
const daftarNama = computed(() => produkQ.data.value?.rows.map(p => p.nama) ?? [])
const satuanOf = (nama: string) => {
  const p = produkQ.data.value?.rows.find(x => x.nama === nama)
  const daftar = (p?.satuan as string[] | undefined)?.length ? (p!.satuan as string[]) : SATUAN_TERSEDIA
  return daftar
}

const tgl = ref(tambahHari(hariIni(), 1))
const pintas = [
  { label: 'Hari ini', value: hariIni() },
  { label: 'Besok', value: tambahHari(hariIni(), 1) },
  { label: 'Lusa', value: tambahHari(hariIni(), 2) },
]

interface BarisOrder { k: number, item: string, qty: number, unit: string, note: string }
let nomor = 0
const baris = ref<BarisOrder[]>([])
function tambahBaris() {
  baris.value.push({ k: ++nomor, item: '', qty: 1, unit: SATUAN_TERSEDIA[0]!, note: '' })
}
function hapusBaris(k: number) {
  if (baris.value.length <= 1) {
    toast.add({ title: 'Minimal satu baris', description: 'Kosongkan isinya kalau tidak dipakai.', color: 'warning' })
    return
  }
  baris.value = baris.value.filter(b => b.k !== k)
}
function aturSatuan(b: BarisOrder) {
  const daftar = satuanOf(b.item)
  if (!daftar.includes(b.unit)) b.unit = daftar[0] ?? ''
}
// Like the old `enforceSelection`: a name outside the master is cleared on the
// spot, with the legacy message — it must be picked from the suggestions.
function paksaDaftar(b: BarisOrder) {
  const nama = b.item.trim()
  if (nama && daftarNama.value.length > 0 && !daftarNama.value.includes(nama)) {
    b.item = ''
    toast.add({ title: 'Input Ditolak', description: 'Harus pilih bahan dari list!', color: 'error' })
  }
  aturSatuan(b)
}
tambahBaris()

const siap = computed(() => baris.value.filter(b => b.item.trim() && (Number(b.qty) || 0) > 0))

// --- batch mode ---------------------------------------------------------------
const mode = ref<'baru' | 'gabung'>('baru')
const namaBatch = ref('')
const batchQ = useAsyncData('stock-order-batch', () => joinableBatches(), {
  default: () => ({ rows: [] }),
})
const batchPilih = ref('')
const batchTerpilih = computed(() => batchQ.data.value?.rows.find(b => b.batchId === batchPilih.value))

// --- draft --------------------------------------------------------------------
const KUNCI_DRAF = 'stock-order-draf'
function simpanDraf() {
  try {
    localStorage.setItem(KUNCI_DRAF, JSON.stringify({ tgl: tgl.value, baris: baris.value }))
    toast.add({ title: 'Draf tersimpan', description: 'Draf order belanja tersimpan di perangkat ini.', color: 'success' })
  }
  catch {
    toast.add({ title: 'Draf gagal tersimpan', color: 'error' })
  }
}
onMounted(() => {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_DRAF) || 'null')
    if (d && Array.isArray(d.baris) && d.baris.length) {
      tgl.value = d.tgl || tgl.value
      baris.value = d.baris.map((b: BarisOrder) => ({ k: ++nomor, item: b.item || '', qty: Number(b.qty) || 1, unit: b.unit || SATUAN_TERSEDIA[0]!, note: b.note || '' }))
    }
  }
  catch { /* no draft */ }
})

// --- pre-submit & kirim ----------------------------------------------------------
const sheet = ref(false)
const mengirim = ref(false)
const hasil = ref<{ created: number, merged: number, batchId: string, batchName: string, mergedItems: string[] } | null>(null)

function cekSubmit() {
  if (siap.value.length === 0) {
    toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu bahan dengan jumlah.', color: 'warning' })
    return
  }
  // Like the old screen (`ordering/index.html` Tahap 1 + `enforceSelection`):
  // the item must be picked from the master list, not typed freely — a free
  // name is stored as an order no vendor mapping can fulfil, so chat vendor
  // never fires for it. Duplicates in the form are refused the same way.
  const master = daftarNama.value
  if (master.length > 0) {
    const asing = siap.value.map(b => b.item.trim()).filter(n => !master.includes(n))
    if (asing.length > 0) {
      toast.add({ title: 'Data Tidak Valid', description: 'Ada baris kosong atau tidak terdaftar.', color: 'error' })
      return
    }
  }
  const terlihat = new Set<string>()
  const ganda = siap.value.some((b) => {
    const k = b.item.trim().toLowerCase()
    if (terlihat.has(k)) return true
    terlihat.add(k)
    return false
  })
  if (ganda) {
    toast.add({ title: 'Terdapat Duplikat Input', description: 'Gabungkan quantity bahan yang sama pada formulir.', color: 'error' })
    return
  }
  if (mode.value === 'gabung' && !batchPilih.value) {
    toast.add({ title: 'Batch belum dipilih', description: 'Pilih batch tujuan, atau kirim sebagai batch baru.', color: 'warning' })
    return
  }
  hasil.value = null
  sheet.value = true
}

async function kirim() {
  mengirim.value = true
  try {
    const r = await createBatch({
      orders: siap.value.map(b => ({
        item: b.item.trim(),
        qty: Math.max(1, Number(b.qty) || 1),
        unit: b.unit,
        note: b.note.trim() || '-',
        tglDatang: tgl.value,
      })),
      batchId: mode.value === 'gabung' ? batchPilih.value : undefined,
      batchName: mode.value === 'baru' ? (namaBatch.value.trim() || undefined) : undefined,
    })
    hasil.value = r
    await catatLog([{ modul: 'ordering', aksi: 'order_baru', ringkas: `${r.created} baris baru, ${r.merged} gabung (${r.batchName})` }])
    try {
      localStorage.removeItem(KUNCI_DRAF)
    }
    catch { /* keep going */ }
    baris.value = []
    tambahBaris()
    await batchQ.refresh()
  }
  catch (e) {
    toast.add({ title: 'Pengiriman gagal', description: `${apiErrorMessage(e)} Pastikan internet stabil & coba lagi.`, color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}

const kolom: TableColumn<BarisOrder>[] = [
  { accessorKey: 'item', header: 'Bahan' },
  { accessorKey: 'qty', header: 'Jumlah' },
  { accessorKey: 'unit', header: 'Satuan' },
  { accessorKey: 'note', header: 'Catatan' },
]

function unduhDraf() {
  const isi = siap.value.map(b => [b.item.trim(), String(Math.max(1, Number(b.qty) || 1)), b.unit, b.note.trim() || '-'])
  const sel = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  unduhCsvStock(`draf-order-${tgl.value}.csv`, ['Bahan,Jumlah,Satuan,Catatan', ...isi.map(r => r.map(sel).join(','))].join('\n'))
}
</script>

<template>
  <AppPage
    title="Form Order Belanja"
    description="Pengajuan order barang baru — tahap 1"
  >
    <template #actions>
      <UButton
        label="Unduh draf (CSV)"
        icon="i-lucide-download"
        variant="outline"
        :disabled="siap.length === 0"
        @click="unduhDraf"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Item siap dikirim"
        :value="String(siap.length)"
        satuan="item"
        icon="i-lucide-shopping-cart"
        tone="info"
      />
      <AppStat
        label="Rencana datang"
        :value="tgl"
        icon="i-lucide-calendar"
      />
      <AppStat
        label="Batch gabungan"
        :value="String(batchQ.data.value?.rows.length ?? 0)"
        satuan="terbuka"
        icon="i-lucide-boxes"
      />
    </AppStatGrid>

    <AppPanel title="Pengajuan order barang baru">
      <AppFilterGrid>
        <UFormField label="PIC pemesan">
          <UInput
            :model-value="me?.name ?? ''"
            disabled
          />
        </UFormField>
        <UFormField label="Tanggal rencana kedatangan">
          <UInput
            v-model="tgl"
            type="date"
          />
        </UFormField>
        <UFormField label="Pintasan tanggal">
          <AppChips
            v-model="tgl"
            :options="pintas.map(p => ({ value: p.value, label: p.label }))"
          />
        </UFormField>
      </AppFilterGrid>

      <AppSectionTitle title="Batch" />
      <AppSeg
        v-model="mode"
        :options="[{ value: 'baru', label: 'Batch baru' }, { value: 'gabung', label: 'Gabung ke batch' }]"
      />
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <UFormField
          v-if="mode === 'baru'"
          label="Nama batch (opsional, maks 60)"
        >
          <UInput
            v-model="namaBatch"
            maxlength="60"
            placeholder="Mis. Belanja 9 Okt"
          />
        </UFormField>
        <UFormField
          v-else
          label="Batch tujuan"
        >
          <USelect
            v-model="batchPilih"
            :items="(batchQ.data.value?.rows ?? []).map(b => ({ value: b.batchId, label: `${b.batchName || b.batchId}${b.terarsip ? ' (arsip)' : ''}` }))"
            placeholder="Pilih batch yang masih terbuka"
          />
        </UFormField>
      </div>
      <p
        v-if="mode === 'gabung' && batchTerpilih"
        class="mt-2 text-sm text-muted"
      >
        Tanggal batch yang menang dipakai; item + satuan yang sama digabung ke baris lama (kembali aktif).
      </p>

      <AppSectionTitle title="Baris bahan" />
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="siap"
        />
      </div>
      <div class="flex flex-col gap-3">
        <div
          v-for="b in baris"
          :key="b.k"
          class="rounded-panel border border-default p-3"
        >
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_2fr_auto]">
            <UFormField label="Bahan">
              <UInput
                v-model="b.item"
                list="stock-order-produk"
                placeholder="Ketik nama bahan"
                @change="paksaDaftar(b)"
              />
            </UFormField>
            <UFormField label="Jumlah">
              <UInput
                v-model.number="b.qty"
                type="number"
                min="1"
              />
            </UFormField>
            <UFormField label="Satuan">
              <USelect
                v-model="b.unit"
                :items="satuanOf(b.item)"
              />
            </UFormField>
            <UFormField label="Catatan (opsional)">
              <UInput
                v-model="b.note"
                placeholder="Kosongkan bila tidak ada"
              />
            </UFormField>
            <div class="flex items-end">
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                aria-label="Hapus baris"
                @click="hapusBaris(b.k)"
              />
            </div>
          </div>
        </div>
      </div>
      <datalist id="stock-order-produk">
        <option
          v-for="n in daftarNama"
          :key="n"
          :value="n"
        />
      </datalist>

      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          label="Tambah baris bahan"
          icon="i-lucide-plus"
          variant="outline"
          @click="tambahBaris"
        />
        <UButton
          label="Simpan draft"
          icon="i-lucide-save"
          variant="outline"
          @click="simpanDraf"
        />
        <UButton
          label="Cek & submit pesanan"
          icon="i-lucide-send"
          @click="cekSubmit"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      title="Kirim pesanan"
    >
      <div
        v-if="hasil"
        class="flex flex-col gap-2"
      >
        <p class="text-sm text-default">
          Terkirim: {{ hasil.created }} baris baru, {{ hasil.merged }} digabung ke batch “{{ hasil.batchName }}”.
        </p>
        <p
          v-if="hasil.mergedItems.length"
          class="text-sm text-muted"
        >
          Digabung: {{ hasil.mergedItems.join(', ') }}
        </p>
        <UButton
          label="Tutup"
          class="self-end"
          @click="sheet = false"
        />
      </div>
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <p class="text-sm text-default">
          {{ siap.length }} item siap dikirim, rencana datang {{ tgl }}{{
            mode === 'gabung' && batchTerpilih ? ` — gabung ke “${batchTerpilih.batchName || batchTerpilih.batchId}”` : ''
          }}.
        </p>
        <ul class="text-sm text-muted">
          <li
            v-for="b in siap"
            :key="b.k"
          >
            {{ b.item.trim() }} — {{ Math.max(1, Number(b.qty) || 1) }} {{ b.unit }}
          </li>
        </ul>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheet = false"
          />
          <UButton
            label="Kirim"
            icon="i-lucide-send"
            :loading="mengirim"
            @click="kirim"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
