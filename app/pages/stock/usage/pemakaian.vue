<!--
  Stock › Pemakaian Bahan Baku › Pemakaian Bahan (old `deploy/stock/usage/index.html:427-588`
  + `:1079-1545`).

  Two sub-tabs: Catat (form with material lines, saved as Rencana or Selesai) and
  Report (stats, distributions, recap per material, one-by-one list). Lines
  without a name are dropped by the API; a record without any line is refused.
  "Pemakaian bahan", never "Event": training and RND are not events (old
  `:421-426`). Team is picked explicitly and recorded at write time (stock.md F.17).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BarisItemUsage, UsageCatatan } from '~/composables/useStock'
import { createUsage, deleteUsage, listUsage, patchUsage, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { isAdminOf } from '~/composables/useMe'
import { hariIni, tglPendek, tambahHari } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'
import {
  barisPemakaian, bulanIni, csvPemakaian, daftarBulanPilih, dataBar, fmtQty, JENIS_OPSI, opsiSatuanBahan,
  opsiTimCatat, pesanTimKosong, rekapBaris, rentangBulanCatat, teksTotal, timBawaanCatat, timBelumDiisi, timCatatTerkunci,
  totalPerSatuan, unduhCsvStock, type InfoBahan, type RekapBahan,
} from '~/utils/stock-catat'

definePageMeta({ access: ['usage'] })

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'usage'))
const belumAdaTim = computed(() => timBelumDiisi(me.value?.keterangan, admin.value))

const produkQ = useProdukStock()
const produk = computed(() => produkQ.data.value?.rows ?? [])
// Row search: one list grouped under category labels, like Form Order Belanja.
const opsiBahan = computed(() => {
  const grup = new Map<string, string[]>()
  for (const p of produk.value) {
    if (p.aktif === false) continue
    const k = (p.kategori || '').trim() || 'Lainnya'
    grup.set(k, [...(grup.get(k) ?? []), p.nama])
  }
  return [...grup.entries()]
    .sort(([a], [b]) => (a === 'Lainnya' ? 1 : b === 'Lainnya' ? -1 : a.localeCompare(b, 'id')))
    .map(([k, nama]) => [{ type: 'label' as const, label: k, value: `kategori:${k}` }, ...nama.sort((a, b) => a.localeCompare(b, 'id')).map(n => ({ label: n, value: n }))])
})
const info = computed<InfoBahan>(() => Object.fromEntries((produkQ.data.value?.rows ?? []).map(p => [p.nama, p])))

// --- sub-tab + form -----------------------------------------------------------

const sub = ref<'catat' | 'report'>('catat')

interface BarisForm { k: number, item: string, qty: number, unit: string, note: string }
let nomorBaris = 0
const baris = ref<BarisForm[]>([])
const form = ref({
  id: '',
  tanggal: hariIni(),
  jenis: JENIS_OPSI[0] as string,
  tim: timBawaanCatat(me.value?.keterangan),
  namaEvent: '',
  catatan: '',
})
const opsiTim = computed(() => opsiTimCatat(me.value?.keterangan))
const terkunci = computed(() => timCatatTerkunci(me.value?.keterangan))
const opsiTimTampil = computed(() => {
  const base = opsiTim.value
  if (form.value.tim && !base.some(o => o.value === form.value.tim)) return [...base, { value: form.value.tim, label: `${form.value.tim} (kode lama)` }]
  return base
})
watch(me, () => {
  if (!opsiTim.value.some(o => o.value === form.value.tim)) form.value.tim = timBawaanCatat(me.value?.keterangan)
})

const opsiUnit = (item: string) => opsiSatuanBahan(info.value, item)
function perbaruiSatuan(b: BarisForm) {
  const opts = opsiUnit(b.item)
  if (!opts.some(o => o.value === b.unit)) b.unit = opts[0]?.value ?? ''
}
function tambahBaris(isi?: Partial<BarisItemUsage>) {
  const opts = opsiSatuanBahan(info.value, isi?.item || '')
  baris.value.push({
    k: ++nomorBaris,
    item: isi?.item || '',
    qty: Number(isi?.qty ?? 1) || 1,
    unit: isi?.unit || opts[0]?.value || '',
    note: isi?.note || '',
  })
}
function pilihBahan(b: BarisForm, nama: string) {
  b.item = nama
  perbaruiSatuan(b)
}
// Stepper like the order form; usage may be fractional, so it never goes below 0.
function ubahQty(b: BarisForm, d: number) {
  b.qty = Math.max(0, Math.round(((Number(b.qty) || 0) + d) * 100) / 100)
}

// --- category picker (StockPilihBahan, same as Form Order Belanja) ---------------
const pemilih = ref<{ open: boolean, k: number | null }>({ open: false, k: null })
const namaDiForm = computed(() => baris.value.map(b => b.item).filter(Boolean))
function bukaPemilih(k: number | null = null) {
  pemilih.value = { open: true, k }
}
function pakaiPilihan(nama: string[]) {
  const k = pemilih.value.k
  if (k !== null) {
    const b = baris.value.find(x => x.k === k)
    if (b && nama[0]) pilihBahan(b, nama[0])
    return
  }
  // Multi pick: unticked names leave the form, new names fill empty rows first.
  const pilih = new Set(nama)
  baris.value = baris.value.filter(b => !b.item || pilih.has(b.item))
  const ada = new Set(baris.value.map(b => b.item).filter(Boolean))
  for (const n of nama) {
    if (ada.has(n)) continue
    const kosong = baris.value.find(b => !b.item)
    if (kosong) pilihBahan(kosong, n)
    else tambahBaris({ item: n })
  }
  if (!baris.value.length) tambahBaris()
}

function hapusBaris(k: number) {
  if (baris.value.length <= 1) {
    toast.add({ title: 'Minimal satu baris', description: 'Kosongkan isinya kalau tidak dipakai.', color: 'warning' })
    return
  }
  baris.value = baris.value.filter(b => b.k !== k)
}
function resetForm() {
  form.value = { id: '', tanggal: hariIni(), jenis: JENIS_OPSI[0]!, tim: timBawaanCatat(me.value?.keterangan), namaEvent: '', catatan: '' }
  baris.value = []
  tambahBaris()
}
resetForm()

function bacaBaris() {
  return baris.value
    .map(b => ({ item: b.item.trim(), qty: Number(b.qty) || 0, unit: b.unit, note: b.note.trim() }))
    .filter(b => b.item)
}

// --- period (report) ----------------------------------------------------------

const periode = ref<'hari' | 'minggu' | 'bulan' | 'semua' | 'pilih'>('bulan')
const bulanPilih = ref(bulanIni())
const pilihanBulan = daftarBulanPilih()
const rentang = computed(() => {
  const hari = hariIni()
  if (periode.value === 'hari') return { dari: hari, ke: hari }
  if (periode.value === 'minggu') return { dari: tambahHari(hari, -6), ke: hari }
  if (periode.value === 'pilih') return rentangBulanCatat(bulanPilih.value)
  if (periode.value === 'semua') return {} as { dari?: string, ke?: string }
  const d = new Date()
  return { dari: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, ke: hari }
})
watch(periode, () => {
  if (periode.value !== 'pilih') bulanPilih.value = bulanIni()
})

const daftarQ = useAsyncData('stock-pemakaian', () => listUsage(rentang.value.dari, rentang.value.ke), {
  watch: [rentang],
  default: () => ({ rows: [] as UsageCatatan[], versions: {} }),
})
const versi = computed<Record<string, Versi>>(() => daftarQ.data.value?.versions ?? {})
const semua = computed<UsageCatatan[]>(() => daftarQ.data.value?.rows ?? [])

const menyimpan = ref(false)
async function simpan(status: 'Rencana' | 'Selesai') {
  const items = bacaBaris()
  if (!items.length) {
    toast.add({ title: 'Bahan kosong', description: 'Isi minimal satu bahan yang dipakai.', color: 'error' })
    return
  }
  const body = {
    tanggal: form.value.tanggal,
    jenis: form.value.jenis,
    namaEvent: form.value.namaEvent.trim(),
    catatan: form.value.catatan.trim(),
    status,
    tim: form.value.tim,
    items,
  }
  menyimpan.value = true
  try {
    if (form.value.id) await patchUsage(form.value.id, body, versi.value[form.value.id])
    else await createUsage(body)
    toast.add({ title: 'Tersimpan', description: `${items.length} bahan tercatat sebagai ${status === 'Selesai' ? 'sudah dipakai' : 'rencana'}.`, color: 'success' })
    resetForm()
    await daftarQ.refresh()
    sub.value = 'report'
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

function edit(r: UsageCatatan) {
  form.value = {
    id: r.id,
    tanggal: r.tanggal || hariIni(),
    jenis: r.jenis || JENIS_OPSI[0]!,
    tim: r.tim || timBawaanCatat(me.value?.keterangan),
    namaEvent: r.namaEvent || '',
    catatan: r.catatan || '',
  }
  baris.value = []
  ;(r.items || []).forEach(i => tambahBaris(i))
  if (!baris.value.length) tambahBaris()
  sub.value = 'catat'
}

async function ubahStatus(r: UsageCatatan) {
  const status = r.status === 'Selesai' ? 'Rencana' : 'Selesai'
  try {
    await patchUsage(r.id, { status }, versi.value[r.id])
    toast.add({ title: 'Status diperbarui' })
    await daftarQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetHapus = ref(false)
const hapusTarget = ref<UsageCatatan | null>(null)
async function hapusGo() {
  const r = hapusTarget.value
  sheetHapus.value = false
  if (!r) return
  try {
    await deleteUsage(r.id, versi.value[r.id])
    toast.add({ title: 'Dihapus' })
    await daftarQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- report filters -----------------------------------------------------------

const cari = ref('')
const jenisFilter = ref('ALL')
const timFilter = ref('ALL')
const laciBuka = ref(false)

const jumlahFilter = computed(() => (periode.value === 'pilih' ? 1 : 0) + (jenisFilter.value !== 'ALL' ? 1 : 0) + (admin.value && timFilter.value !== 'ALL' ? 1 : 0))

const daftarTampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return semua.value
    .filter(r => jenisFilter.value === 'ALL' || r.jenis === jenisFilter.value)
    .filter(r => timFilter.value === 'ALL' || (r.tim || '') === timFilter.value)
    .filter(r => !q || [r.namaEvent, r.pic, r.catatan, r.jenis, r.tim]
      .concat((r.items || []).map(i => i.item))
      .some(v => String(v || '').toLowerCase().includes(q)))
})

const PER_HALAMAN = 20
const tampil = ref(PER_HALAMAN)
watch([cari, jenisFilter, timFilter, periode, bulanPilih], () => {
  tampil.value = PER_HALAMAN
})
const dimuat = computed(() => daftarTampil.value.slice(0, tampil.value))
const sisa = computed(() => daftarTampil.value.length - dimuat.value.length)

const ringkas = computed(() => {
  const list = daftarTampil.value
  const totalItem = list.reduce((a, r) => a + (r.items || []).length, 0)
  const rencana = list.filter(r => r.status !== 'Selesai').length
  const perJenis: Record<string, number> = {}
  list.forEach((r) => {
    const k = r.jenis || 'Lainnya'
    perJenis[k] = (perJenis[k] || 0) + 1
  })
  const teratas = Object.entries(perJenis).sort((a, b) => b[1] - a[1])[0]
  const barisSudah = barisPemakaian(list).filter(b => !b.rencana)
  const totQty = totalPerSatuan(barisSudah)
  return { list, totalItem, rencana, teratas, totQty }
})

/** Distributions by activity type / team, measured in material lines (old `:1450-1459`). */
function sebaran(kunci: (r: UsageCatatan) => string) {
  const p: Record<string, number> = {}
  daftarTampil.value.forEach((r) => {
    const k = kunci(r)
    p[k] = (p[k] || 0) + (r.items || []).length
  })
  const total = Object.values(p).reduce((a, b) => a + b, 0)
  return { data: dataBar(p), sub: `${fmtQty(total)} baris bahan` }
}
const sebaranJenis = computed(() => sebaran(r => r.jenis || 'Lainnya'))
const sebaranTim = computed(() => sebaran(r => r.tim || '(belum ada tim)'))

const rekap = computed(() => rekapBaris(info.value, barisPemakaian(daftarTampil.value)))
const adaRencana = computed(() => rekap.value.some(b => b.rencana > 0))
const kolomRekap = computed<TableColumn<RekapBahan>[]>(() => {
  const kol: TableColumn<RekapBahan>[] = [
    { accessorKey: 'item', header: 'Bahan' },
    { accessorKey: 'selesai', header: 'Sudah Dipakai' },
  ]
  if (adaRencana.value) kol.push({ accessorKey: 'rencana', header: 'Rencana' })
  kol.push({ accessorKey: 'total', header: 'Total' }, { accessorKey: 'dipakai', header: 'Dipakai di' })
  return kol
})

const kolomItem: TableColumn<BarisItemUsage>[] = [
  { accessorKey: 'item', header: 'Bahan' },
  { accessorKey: 'qty', header: 'Jumlah' },
  { accessorKey: 'note', header: 'Catatan' },
]

function ekspor() {
  unduhCsvStock(`pemakaian-${bulanIni()}.csv`, csvPemakaian(daftarTampil.value))
}

async function segarkan() {
  await Promise.all([produkQ.refresh(), daftarQ.refresh()])
}
</script>

<template>
  <AppPage
    title="Pemakaian bahan"
    description="Catat bahan yang dipakai untuk prasmanan, training, dan RND."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="segarkan"
      />
    </template>

    <UAlert
      v-if="belumAdaTim"
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      title="Tim belum diisi"
      :description="pesanTimKosong"
    />

    <AppSeg
      v-model="sub"
      class="mb-5"
      size="sm"
      :options="[
        { value: 'catat', label: 'Catat Pemakaian' },
        { value: 'report', label: 'Report Pemakaian' },
      ]"
    />

    <template v-if="sub === 'catat'">
      <AppPanel :title="form.id ? 'Ubah catatan pemakaian' : 'Catat pemakaian baru'">
        <template
          v-if="form.id"
          #actions
        >
          <UButton
            label="Batal edit"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="resetForm"
          />
        </template>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UFormField label="Tanggal pakai">
            <AppTanggal v-model="form.tanggal" />
          </UFormField>
          <UFormField label="Jenis kegiatan">
            <USelect
              v-model="form.jenis"
              :items="JENIS_OPSI.map(j => ({ value: j as string, label: j }))"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Tim"
            :help="terkunci ? 'Tim Anda, ditetapkan di Kelola Akses.' : 'Anda melihat semua tim — pilih tim yang sesuai.'"
          >
            <USelect
              v-model="form.tim"
              :items="opsiTimTampil"
              class="w-full"
              :class="terkunci && 'pointer-events-none'"
            />
          </UFormField>
        </div>
        <UFormField
          class="mt-4"
          label="Nama / keterangan kegiatan"
        >
          <UInput
            v-model="form.namaEvent"
            placeholder="cth: Prasmanan PT Bahari 80 pax · Training barista batch 3 · RND sambal Agustus"
            class="w-full"
          />
        </UFormField>
        <UFormField
          class="mt-4"
          label="Catatan — ini untuk apa"
        >
          <UTextarea
            v-model="form.catatan"
            :rows="2"
            placeholder="cth: uji resep sambal baru untuk menu Agustus; bahan diambil dari gudang utama"
            class="w-full"
          />
        </UFormField>

        <p class="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Bahan yang dipakai
        </p>
        <!-- Same rows as Form Order Belanja: grouped search + category picker,
             stepper, add buttons under the last row. -->
        <div class="flex flex-col gap-3">
          <div
            v-for="b in baris"
            :key="b.k"
            class="rounded-xl border border-default bg-muted p-3"
          >
            <UFormField label="Bahan">
              <div class="flex items-center gap-2">
                <USelectMenu
                  :model-value="b.item || undefined"
                  :items="opsiBahan"
                  value-key="value"
                  placeholder="Cari bahan…"
                  :search-input="{ placeholder: 'Ketik nama bahan…' }"
                  class="min-w-0 flex-1"
                  @update:model-value="pilihBahan(b, String($event ?? ''))"
                />
                <UButton
                  icon="i-lucide-layout-grid"
                  color="neutral"
                  variant="soft"
                  square
                  class="size-10 shrink-0 justify-center lg:size-8"
                  title="Pilih dari kategori"
                  aria-label="Pilih bahan dari kategori"
                  @click="bukaPemilih(b.k)"
                />
              </div>
            </UFormField>
            <div class="mt-2 flex flex-wrap items-end gap-2">
              <div
                class="flex items-center gap-1.5"
                role="group"
                aria-label="Jumlah"
              >
                <UButton
                  icon="i-lucide-minus"
                  variant="outline"
                  square
                  class="size-10 justify-center lg:size-8"
                  aria-label="Kurangi jumlah"
                  @click="ubahQty(b, -1)"
                />
                <UInput
                  v-model.number="b.qty"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-20"
                  :ui="{ base: 'text-center font-bold' }"
                  aria-label="Jumlah"
                />
                <UButton
                  icon="i-lucide-plus"
                  variant="outline"
                  square
                  class="size-10 justify-center lg:size-8"
                  aria-label="Tambah jumlah"
                  @click="ubahQty(b, 1)"
                />
              </div>
              <UFormField
                label="Satuan"
                class="min-w-28 flex-1"
              >
                <USelect
                  v-model="b.unit"
                  :items="opsiUnit(b.item)"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Catatan (opsional)"
                class="min-w-40 flex-[2]"
              >
                <UInput
                  v-model="b.note"
                  placeholder="Kosongkan bila tidak ada"
                  class="w-full"
                />
              </UFormField>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                square
                class="size-10 justify-center lg:size-8"
                aria-label="Hapus baris"
                @click="hapusBaris(b.k)"
              />
            </div>
          </div>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="() => tambahBaris()"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />
            Tambah baris bahan
          </button>
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="bukaPemilih()"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="size-4"
            />
            Pilih bahan dari kategori
          </button>
        </div>

        <div class="mt-5 flex flex-col gap-2 border-t border-default pt-4 sm:flex-row">
          <UButton
            label="Simpan sebagai rencana"
            icon="i-lucide-save"
            color="neutral"
            variant="soft"
            block
            :loading="menyimpan"
            @click="simpan('Rencana')"
          />
          <UButton
            label="Simpan & tandai sudah dipakai"
            icon="i-lucide-check"
            block
            :loading="menyimpan"
            @click="simpan('Selesai')"
          />
        </div>
        <p class="mt-3 text-[12px] leading-relaxed text-muted">
          <b class="text-highlighted">Rencana</b> = bahannya belum diambil dari gudang.
          <b class="text-highlighted">Sudah dipakai</b> = bahannya benar-benar sudah keluar.
          Statusnya bisa diubah kapan saja lewat sub-tab <b class="text-highlighted">Report pemakaian</b>.
        </p>
      </AppPanel>
    </template>

    <template v-else>
      <AppPanel title="Report pemakaian">
        <template #actions>
          <UButton
            label="Ekspor CSV"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            size="sm"
            @click="ekspor"
          />
        </template>

        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari kegiatan, bahan, atau PIC…"
            class="min-w-44 flex-1"
          />
          <AppChips
            v-model="periode"
            :options="[
              { value: 'hari', label: 'Hari Ini' },
              { value: 'minggu', label: '7 Hari' },
              { value: 'bulan', label: 'Bulan Ini' },
              { value: 'semua', label: 'Semua' },
            ]"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :class="jumlahFilter && 'text-primary-700'"
            @click="laciBuka = !laciBuka"
          >
            <UIcon
              name="i-lucide-sliders-horizontal"
              class="size-4"
            />
            Filter
            <UBadge
              v-if="jumlahFilter"
              color="primary"
              size="sm"
            >
              {{ jumlahFilter }}
            </UBadge>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 transition-transform"
              :class="laciBuka && 'rotate-180'"
            />
          </UButton>
        </div>

        <div
          v-if="laciBuka"
          class="mt-3 grid grid-cols-1 gap-3 border-t border-default pt-3 sm:grid-cols-3"
        >
          <UFormField label="Bulan tertentu">
            <USelect
              v-model="bulanPilih"
              :items="pilihanBulan"
              class="w-full"
              @update:model-value="periode = 'pilih'"
            />
          </UFormField>
          <UFormField label="Jenis kegiatan">
            <USelect
              v-model="jenisFilter"
              :items="[{ value: 'ALL', label: 'Semua jenis' }, ...JENIS_OPSI.map(j => ({ value: j, label: j }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="admin"
            label="Divisi"
          >
            <USelect
              v-model="timFilter"
              :items="[{ value: 'ALL', label: 'Semua divisi' }, ...opsiTimCatat(me?.keterangan)]"
              class="w-full"
            />
          </UFormField>
        </div>

        <AppStatGrid class="mt-4">
          <AppStat
            label="Total bahan keluar"
            icon="i-lucide-package"
            :value="teksTotal(ringkas.totQty)"
            :sub="ringkas.rencana ? `${ringkas.totalItem} baris bahan · rencana belum dihitung` : `${ringkas.totalItem} baris bahan`"
            tone="info"
            wrap
          />
          <AppStat
            label="Total catatan"
            icon="i-lucide-clipboard-list"
            :value="ringkas.list.length"
            sub="kegiatan tercatat"
          />
          <AppStat
            label="Masih rencana"
            icon="i-lucide-hourglass"
            :value="ringkas.rencana"
            :sub="ringkas.rencana ? 'belum diambil dari gudang' : 'semua sudah keluar'"
            :tone="ringkas.rencana ? 'warning' : 'success'"
          />
          <AppStat
            label="Terbanyak"
            icon="i-lucide-flame"
            :value="ringkas.teratas ? ringkas.teratas[0] : '—'"
            :sub="ringkas.teratas ? `${ringkas.teratas[1]} catatan` : 'belum ada'"
            tone="vip"
          />
        </AppStatGrid>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AppPanel
            bersarang
            title="Sebaran per jenis kegiatan"
            :description="sebaranJenis.sub"
          >
            <div
              v-if="!sebaranJenis.data.length"
              class="text-[13px] text-dimmed"
            >
              Belum ada data pada periode ini.
            </div>
            <AppBar
              v-for="b in sebaranJenis.data"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
            />
          </AppPanel>
          <AppPanel
            bersarang
            title="Sebaran per tim"
            :description="sebaranTim.sub"
          >
            <div
              v-if="!sebaranTim.data.length"
              class="text-[13px] text-dimmed"
            >
              Belum ada data pada periode ini.
            </div>
            <AppBar
              v-for="b in sebaranTim.data"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
              tone="info"
            />
          </AppPanel>
        </div>

        <AppPanel
          v-if="rekap.length"
          bersarang
          class="mt-5"
          title="Total pemakaian per bahan"
          :description="`${rekap.length} bahan`"
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="rekap"
            :columns="kolomRekap"
          >
            <template #selesai-cell="{ row }">
              <span class="text-success num">{{ fmtQty(row.original.selesai) }} {{ row.original.unit }}</span>
            </template>
            <template #rencana-cell="{ row }">
              <span class="text-warning num">{{ row.original.rencana ? `${fmtQty(row.original.rencana)} ${row.original.unit}` : '—' }}</span>
            </template>
            <template #total-cell="{ row }">
              <span class="num">{{ fmtQty(row.original.total) }} {{ row.original.unit }}</span>
            </template>
            <template #dipakai-cell="{ row }">
              <span class="num text-muted">{{ row.original.dipakai }} catatan</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="b in rekap"
              :key="b.item + b.unit"
              class="px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <b class="min-w-0 truncate text-sm text-highlighted">{{ b.item }}</b>
                <span class="num text-sm">{{ fmtQty(b.total) }} {{ b.unit }}</span>
              </div>
              <p class="text-[12px] text-muted">
                Sudah dipakai <span class="text-success">{{ fmtQty(b.selesai) }} {{ b.unit }}</span>
                <template v-if="adaRencana">
                  · Rencana <span class="text-warning">{{ fmtQty(b.rencana) }} {{ b.unit }}</span>
                </template>
                · {{ b.dipakai }} catatan
              </p>
            </div>
          </div>
          <p class="border-t border-default px-4 py-2.5 text-[11.5px] leading-relaxed text-dimmed">
            Dihitung dari catatan yang sedang tampil — ubah periode, jenis, atau pencarian di atas untuk mempersempitnya.
            Satuan sekeluarga (Gram+Kg, ML+Liter) digabung otomatis; satuan yang tak bisa dikonversi (Pcs, Dus, dll) tetap dipisah barisnya.
          </p>
        </AppPanel>

        <div class="mt-5">
          <UAlert
            v-if="!daftarTampil.length"
            color="neutral"
            variant="subtle"
            icon="i-lucide-inbox"
            :title="belumAdaTim ? 'Tim belum diisi' : (cari || jenisFilter !== 'ALL' || timFilter !== 'ALL' ? 'Tidak ada yang cocok dengan penyaring yang dipasang.' : 'Belum ada catatan pemakaian pada periode ini.')"
            :description="belumAdaTim ? pesanTimKosong : undefined"
          />
          <div
            v-for="r in dimuat"
            :key="r.id"
            class="mb-3 overflow-hidden rounded-panel bg-default shadow-panel"
          >
            <div class="flex flex-wrap items-start gap-3 border-b border-default p-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <b class="font-display text-[14px] font-bold text-highlighted">{{ r.namaEvent || '(tanpa nama)' }}</b>
                  <AppStatus
                    :color="r.status === 'Selesai' ? 'success' : 'warning'"
                    size="sm"
                  >
                    {{ r.status === 'Selesai' ? 'Sudah dipakai' : 'Rencana' }}
                  </AppStatus>
                  <AppStatus
                    color="neutral"
                    size="sm"
                  >
                    {{ r.jenis || '—' }}
                  </AppStatus>
                  <AppStatus
                    v-if="r.tim"
                    color="gold"
                    size="sm"
                  >
                    {{ r.tim }}
                  </AppStatus>
                </div>
                <div class="mt-1.5 text-[12px] text-muted">
                  {{ tglPendek(String(r.tanggal || '')) }} · {{ r.pic || '-' }} · dicatat {{ r.waktu || '-' }}
                </div>
                <div
                  v-if="r.catatan"
                  class="mt-2 rounded-xl border border-default bg-muted px-3 py-2 text-[13px] leading-relaxed"
                >
                  {{ r.catatan }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <UButton
                  :icon="r.status === 'Selesai' ? 'i-lucide-undo-2' : 'i-lucide-check'"
                  :color="r.status === 'Selesai' ? 'neutral' : 'success'"
                  variant="ghost"
                  size="sm"
                  :title="r.status === 'Selesai' ? 'Kembalikan ke rencana' : 'Tandai sudah dipakai'"
                  :aria-label="r.status === 'Selesai' ? 'Kembalikan ke rencana' : 'Tandai sudah dipakai'"
                  @click="ubahStatus(r)"
                />
                <UButton
                  icon="i-lucide-pen"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  title="Ubah"
                  aria-label="Ubah"
                  @click="edit(r)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  title="Hapus"
                  aria-label="Hapus"
                  @click="() => { hapusTarget = r; sheetHapus = true }"
                />
              </div>
            </div>
            <details class="group">
              <summary class="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-muted">
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-3.5 transition-transform group-open:rotate-90"
                />
                {{ (r.items || []).length }} bahan <span class="text-dimmed group-open:hidden">— klik untuk melihat rinciannya</span>
              </summary>
              <div class="border-t border-default">
                <UTable
                  class="hidden lg:block"
                  :data="r.items || []"
                  :columns="kolomItem"
                >
                  <template #qty-cell="{ row }">
                    <span class="num">{{ fmtQty(row.original.qty) }} {{ row.original.unit }}</span>
                  </template>
                  <template #note-cell="{ row }">
                    <span class="text-muted">{{ row.original.note || '—' }}</span>
                  </template>
                </UTable>
                <div class="divide-y divide-default lg:hidden">
                  <div
                    v-for="(i, idx) in r.items || []"
                    :key="idx"
                    class="flex items-center justify-between gap-3 px-4 py-2"
                  >
                    <span class="min-w-0 truncate text-sm text-highlighted">{{ i.item }}</span>
                    <b class="num shrink-0 text-sm">{{ fmtQty(i.qty) }} {{ i.unit }}</b>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <UButton
            v-if="sisa > 0"
            :label="`Muat ${Math.min(PER_HALAMAN, sisa)} lagi — masih ada ${sisa} catatan`"
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            block
            @click="tampil += PER_HALAMAN"
          />
        </div>
      </AppPanel>
    </template>

    <StockPilihBahan
      v-model:open="pemilih.open"
      :produk="produk"
      :awal="namaDiForm"
      :tunggal="pemilih.k !== null"
      @pakai="pakaiPilihan"
    />

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus catatan pemakaian"
    >
      <p class="text-sm text-muted">
        Hapus catatan pemakaian "{{ hapusTarget?.namaEvent || hapusTarget?.id }}"? Tindakan ini tidak bisa dibatalkan.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          @click="hapusGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          @click="sheetHapus = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
