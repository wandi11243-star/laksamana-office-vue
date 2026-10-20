<!--
  Stock › Pemakaian Bahan Baku › Serah Terima (old `deploy/stock/usage/index.html:726-853`
  + `:2462-2720`, `:2885-3006`).

  Stock goes out to Kitchen/Bar and MUST carry a photo for a new record. The
  destination is derived from the sending team (Bar → Kitchen, Kitchen → Bar);
  any other team picks freely. Photo entry has two doors — camera and gallery —
  because a single `capture` input hides the gallery on phones (old `:2471-2481`).
  In Daily SO this counts as stock out for the same date + team (stock.md F.10).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HandoverCatatan } from '~/composables/useStock'
import { createHandover, deleteHandover, listHandovers, patchHandover, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { isAdminOf } from '~/composables/useMe'
import { hariIni, tglPendek, tambahHari } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'
import {
  barisSerah, bulanIni, csvSerah, daftarBulanPilih, dataBar, dataBarQty, fmtQty, fotoKeData, opsiSatuanBahan,
  opsiTimCatat, pesanTimKosong, rekapBaris, rentangBulanCatat, SRH_LAWAN, subBarQty, teksTotal, timDariKeterangan,
  timBawaanCatat, timBelumDiisi, timCatatTerkunci, totalPerSatuan, unduhCsvStock, type InfoBahan, type RekapBahan,
} from '~/utils/stock-catat'

definePageMeta({ access: ['usage'] })

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'usage'))
const belumAdaTim = computed(() => timBelumDiisi(me.value?.keterangan, admin.value))

const produkQ = useProdukStock()
const daftarNama = computed(() => produkQ.data.value?.rows.map(p => p.nama) ?? [])
const info = computed<InfoBahan>(() => Object.fromEntries((produkQ.data.value?.rows ?? []).map(p => [p.nama, p])))

// --- sub-tab + form -----------------------------------------------------------

const sub = ref<'catat' | 'report'>('catat')

interface BarisForm { k: number, item: string, qty: number, unit: string }
let nomorBaris = 0
const baris = ref<BarisForm[]>([])
const form = ref({
  id: '',
  tanggal: hariIni(),
  tujuan: 'Kitchen',
  tim: timBawaanCatat(me.value?.keterangan),
  penerima: '',
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

/** Bar ↔ Kitchen have a fixed counterpart; other teams pick freely (old `srhAturTujuan`). */
const tujuanPaksa = computed(() => SRH_LAWAN[form.value.tim] || '')
watch(tujuanPaksa, (lawan) => {
  if (lawan) form.value.tujuan = lawan
}, { immediate: true })

const opsiUnit = (item: string) => opsiSatuanBahan(info.value, item)
function perbaruiSatuan(b: BarisForm) {
  const opts = opsiUnit(b.item)
  if (!opts.some(o => o.value === b.unit)) b.unit = opts[0]?.value ?? ''
}
function tambahBaris(isi?: { item?: string, qty?: unknown, unit?: string }) {
  const opts = opsiSatuanBahan(info.value, isi?.item || '')
  baris.value.push({
    k: ++nomorBaris,
    item: isi?.item || '',
    qty: Number(isi?.qty ?? 1) || 1,
    unit: isi?.unit || opts[0]?.value || '',
  })
}
function hapusBaris(k: number) {
  if (baris.value.length <= 1) {
    const b = baris.value[0]
    if (b) {
      b.item = ''
      b.qty = 1
    }
    return
  }
  baris.value = baris.value.filter(b => b.k !== k)
}
function resetForm() {
  form.value = { id: '', tanggal: hariIni(), tujuan: 'Kitchen', tim: timBawaanCatat(me.value?.keterangan), penerima: '', catatan: '' }
  if (tujuanPaksa.value) form.value.tujuan = tujuanPaksa.value
  baris.value = []
  tambahBaris()
  tambahBaris()
  fotoBaru.value = null
  fotoNama.value = ''
  fotoInfo.value = ''
  editAdaFoto.value = false
  if (fotoCam.value) fotoCam.value.value = ''
  if (fotoFile.value) fotoFile.value.value = ''
}

function bacaBaris() {
  return baris.value
    .map(b => ({ item: b.item.trim(), qty: Number(b.qty) || 0, unit: b.unit }))
    .filter(b => b.item && b.qty > 0)
}

// --- photo: two doors, one destination (old `siapkanSerah`) --------------------

const fotoCam = ref<HTMLInputElement | null>(null)
const fotoFile = ref<HTMLInputElement | null>(null)
const fotoBaru = ref<string | null>(null)
const fotoNama = ref('')
const fotoInfo = ref('')
const editAdaFoto = ref(false)

function pilihFoto(ev: Event, sumber: 'cam' | 'file') {
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (!f) return
  fotoKeData(f).then((data) => {
    fotoBaru.value = data
    fotoNama.value = f.name
    fotoInfo.value = sumber === 'cam' ? 'Foto kamera siap.' : 'Foto unggahan siap.'
    // The other input is cleared: a later pick from it must win, not the older file.
    if (sumber === 'cam' && fotoFile.value) fotoFile.value.value = ''
    if (sumber === 'file' && fotoCam.value) fotoCam.value.value = ''
  }).catch((e: Error) => toast.add({ title: e.message, color: 'error' }))
}

const fotoSheet = ref(false)
const fotoId = ref('')
const fotoJudul = ref('')
function lihatFoto(id: string, judul: string) {
  fotoId.value = id
  fotoJudul.value = judul
  fotoSheet.value = true
}
// Call it only after every ref it touches exists (the photo refs above).
resetForm()

// --- period (report) ----------------------------------------------------------

const periode = ref<'minggu' | 'bulan' | 'semua' | 'pilih'>('minggu')
const bulanPilih = ref(bulanIni())
const pilihanBulan = daftarBulanPilih()
const rentang = computed(() => {
  const hari = hariIni()
  if (periode.value === 'minggu') return { dari: tambahHari(hari, -6), ke: hari }
  if (periode.value === 'pilih') return rentangBulanCatat(bulanPilih.value)
  if (periode.value === 'semua') return {} as { dari?: string, ke?: string }
  return { dari: `${bulanIni()}-01`, ke: hari }
})
watch(periode, () => {
  if (periode.value !== 'pilih') bulanPilih.value = bulanIni()
})

const daftarQ = useAsyncData('stock-serah', () => listHandovers(rentang.value.dari, rentang.value.ke), {
  watch: [rentang],
  default: () => ({ rows: [] as HandoverCatatan[], versions: {} }),
})
const versi = computed<Record<string, Versi>>(() => daftarQ.data.value?.versions ?? {})
const semua = computed<HandoverCatatan[]>(() => daftarQ.data.value?.rows ?? [])

const menyimpan = ref(false)
async function simpan() {
  if (!form.value.tanggal) {
    toast.add({ title: 'Tanggal kosong', color: 'error' })
    return
  }
  if (!form.value.tim || form.value.tim === 'ALL') {
    toast.add({ title: 'Pilih tim', description: 'Tentukan tim stok asalnya.', color: 'error' })
    return
  }
  const items = bacaBaris()
  if (!items.length) {
    toast.add({ title: 'Belum ada barang', description: 'Isi minimal satu item + jumlah.', color: 'error' })
    return
  }
  if (!form.value.id && (fotoBaru.value === null || fotoBaru.value === '')) {
    toast.add({ title: 'Foto wajib', description: 'Buka kamera atau upload foto bukti dulu.', color: 'error' })
    return
  }
  const body: Record<string, unknown> = {
    tanggal: form.value.tanggal,
    tujuan: form.value.tujuan,
    tim: form.value.tim,
    penerima: form.value.penerima.trim(),
    catatan: form.value.catatan.trim(),
    items,
  }
  if (fotoBaru.value !== null) {
    body.foto = fotoBaru.value
    body.fotoNama = fotoNama.value
  }
  menyimpan.value = true
  try {
    if (form.value.id) await patchHandover(form.value.id, body, versi.value[form.value.id])
    else await createHandover(body)
    toast.add({ title: 'Tersimpan', description: `${items.length} item diserahkan ke ${form.value.tujuan}.`, color: 'success' })
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

function edit(s: HandoverCatatan) {
  form.value = {
    id: s.id,
    tanggal: s.tanggal || hariIni(),
    tujuan: s.tujuan || 'Kitchen',
    tim: s.tim || timBawaanCatat(me.value?.keterangan),
    penerima: s.penerima || '',
    catatan: s.catatan || '',
  }
  // The old destination is restored after the team; a fixed counterpart wins so
  // a legacy record with the arrow reversed is corrected while editing.
  if (tujuanPaksa.value) form.value.tujuan = tujuanPaksa.value
  baris.value = []
  ;(s.items || []).forEach(i => tambahBaris(i))
  if (!baris.value.length) {
    tambahBaris()
    tambahBaris()
  }
  fotoBaru.value = null
  fotoNama.value = ''
  editAdaFoto.value = !!s.adaFoto
  fotoInfo.value = s.adaFoto ? 'Foto lama dipertahankan (pilih baru untuk ganti).' : ''
  if (fotoCam.value) fotoCam.value.value = ''
  if (fotoFile.value) fotoFile.value.value = ''
  sub.value = 'catat'
}

const sheetHapus = ref(false)
const hapusTarget = ref<HandoverCatatan | null>(null)
async function hapusGo() {
  const s = hapusTarget.value
  sheetHapus.value = false
  if (!s) return
  try {
    await deleteHandover(s.id, versi.value[s.id])
    toast.add({ title: 'Dihapus' })
    await daftarQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- report -------------------------------------------------------------------

const cari = ref('')
const daftarTampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return semua.value.filter(s => !q || [s.tujuan, s.tim, s.penerima, s.pic, s.catatan]
    .concat((s.items || []).map(i => i.item))
    .some(v => String(v || '').toLowerCase().includes(q)))
})

const timSaya = computed(() => timDariKeterangan(me.value?.keterangan)[0] || '')

const ringkas = computed(() => {
  const list = daftarTampil.value
  const totalItem = list.reduce((a, s) => a + (s.items || []).length, 0)
  const rekap = rekapBaris(info.value, barisSerah(list))
  const totQty = totalPerSatuan(barisSerah(list))
  const berfoto = list.filter(s => s.adaFoto).length
  const perTujuan: Record<string, number> = {}
  list.forEach((s) => {
    const k = s.tujuan || '—'
    perTujuan[k] = (perTujuan[k] || 0) + 1
  })
  const teratas = Object.entries(perTujuan).sort((a, b) => b[1] - a[1])[0]
  return { list, totalItem, rekap, totQty, berfoto, teratas }
})

/** Direction: a team sees its own out/in; an admin without a team sees pairs (old `:2923-2937`). */
const barsArah = computed(() => {
  const saya = timSaya.value
  const peta: Record<string, number> = {}
  if (saya) {
    peta[`Keluar dari ${saya}`] = ringkas.value.list.filter(s => s.tim === saya).length
    peta[`Masuk ke ${saya}`] = ringkas.value.list.filter(s => s.tujuan === saya && s.tim !== saya).length
  }
  else {
    ringkas.value.list.forEach((s) => {
      const k = `${s.tim || '—'} → ${s.tujuan || '—'}`
      peta[k] = (peta[k] || 0) + 1
    })
  }
  return { data: dataBar(peta), sub: `${fmtQty(ringkas.value.list.length)} catatan` }
})

const barsBarang = computed(() => dataBarQty(ringkas.value.rekap, 8))
const kolomRekap: TableColumn<RekapBahan>[] = [
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'total', header: 'Total Keluar' },
  { accessorKey: 'dipakai', header: 'Berapa catatan' },
]

const blokSerah = computed(() => {
  const saya = timSaya.value
  if (!saya) return [{ judul: '', sub: '', arah: '', list: daftarTampil.value }]
  return [
    { judul: 'Barang yang diserahkan', sub: `dari ${saya} ke tim lain`, arah: 'kirim', list: daftarTampil.value.filter(s => s.tim === saya) },
    { judul: 'Barang yang diterima', sub: `dari tim lain ke ${saya}`, arah: 'terima', list: daftarTampil.value.filter(s => s.tujuan === saya && s.tim !== saya) },
  ]
})

function ekspor() {
  unduhCsvStock(`serah-terima-${bulanIni()}.csv`, csvSerah(daftarTampil.value))
}

async function segarkan() {
  await Promise.all([produkQ.refresh(), daftarQ.refresh()])
}
</script>

<template>
  <AppPage
    title="Serah terima"
    description="Pengeluaran stok ke Kitchen/Bar — tercatat sebagai barang keluar di Daily SO."
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
        { value: 'catat', label: 'Catat Serah Terima' },
        { value: 'report', label: 'Report Serah Terima' },
      ]"
    />

    <template v-if="sub === 'catat'">
      <AppPanel :title="form.id ? 'Ubah serah terima' : 'Serah terima barang'">
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

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UFormField label="Tanggal">
            <UInput
              v-model="form.tanggal"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Diserahkan ke"
            :help="tujuanPaksa ? `Otomatis: ${form.tim} → ${tujuanPaksa}` : ''"
          >
            <USelect
              v-model="form.tujuan"
              :items="['Kitchen', 'Bar']"
              class="w-full"
              :class="tujuanPaksa && 'pointer-events-none'"
              :tabindex="tujuanPaksa ? -1 : undefined"
            />
          </UFormField>
          <UFormField
            label="Dari tim (stok)"
            :help="terkunci ? 'Tim Anda, ditetapkan di Kelola Akses.' : 'Anda melihat semua tim — pilih tim yang sesuai.'"
          >
            <USelect
              v-model="form.tim"
              :items="opsiTimTampil"
              class="w-full"
              :class="terkunci && 'pointer-events-none'"
            />
          </UFormField>
          <UFormField label="Penerima">
            <UInput
              v-model="form.penerima"
              placeholder="nama orang"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          class="mt-4"
          label="Foto bukti *wajib"
        >
          <div class="flex flex-wrap items-center gap-2.5">
            <input
              ref="fotoCam"
              type="file"
              accept="image/*"
              capture="environment"
              class="hidden"
              @change="pilihFoto($event, 'cam')"
            >
            <input
              ref="fotoFile"
              type="file"
              accept="image/*"
              class="hidden"
              @change="pilihFoto($event, 'file')"
            >
            <UButton
              label="Buka kamera"
              icon="i-lucide-camera"
              color="neutral"
              variant="outline"
              size="sm"
              @click="fotoCam?.click()"
            />
            <UButton
              label="Upload foto"
              icon="i-lucide-upload"
              color="neutral"
              variant="outline"
              size="sm"
              @click="fotoFile?.click()"
            />
            <img
              v-if="fotoBaru"
              :src="fotoBaru"
              alt="Pratinjau foto bukti"
              class="size-14 rounded-field border border-default object-cover"
            >
            <UButton
              v-if="form.id && editAdaFoto"
              label="Lihat foto lama"
              icon="i-lucide-image"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="lihatFoto(form.id, `Serah terima ${tglPendek(form.tanggal)} → ${form.tujuan}`)"
            />
            <span class="text-[12px] text-muted">{{ fotoInfo }}</span>
          </div>
        </UFormField>

        <div class="mb-2 mt-5 flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-muted">Barang yang diserahkan</span>
          <UButton
            label="Tambah item"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="() => tambahBaris()"
          />
        </div>
        <div class="space-y-2">
          <div
            v-for="b in baris"
            :key="b.k"
            class="rounded-field border border-default p-3"
          >
            <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div class="min-w-0 flex-1">
                <StockBahanInput
                  v-model="b.item"
                  :daftar="daftarNama"
                  @pilih="perbaruiSatuan(b)"
                />
              </div>
              <div class="flex items-center gap-2">
                <UInput
                  v-model.number="b.qty"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-24"
                />
                <USelect
                  v-model="b.unit"
                  :items="opsiUnit(b.item)"
                  class="w-36"
                />
              </div>
              <UButton
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="sm"
                title="Hapus baris"
                aria-label="Hapus baris"
                @click="hapusBaris(b.k)"
              />
            </div>
          </div>
        </div>

        <UFormField
          class="mt-4"
          label="Catatan (opsional)"
        >
          <UInput
            v-model="form.catatan"
            placeholder="cth: untuk persiapan acara malam"
            class="w-full"
          />
        </UFormField>

        <UButton
          class="mt-5 w-full"
          label="Simpan serah terima"
          icon="i-lucide-save"
          :loading="menyimpan"
          @click="simpan"
        />
      </AppPanel>
    </template>

    <template v-else>
      <AppPanel title="Report serah terima">
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

        <AppFilterGrid>
          <UFormField label="Cari">
            <UInput
              v-model="cari"
              icon="i-lucide-search"
              placeholder="Cari barang, penerima, atau tim…"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Periode">
            <AppChips
              v-model="periode"
              :options="[
                { value: 'minggu', label: '7 Hari' },
                { value: 'bulan', label: 'Bulan Ini' },
                { value: 'semua', label: 'Semua' },
              ]"
            />
          </UFormField>
          <UFormField label="Bulan tertentu">
            <USelect
              v-model="bulanPilih"
              :items="pilihanBulan"
              class="w-full"
              @update:model-value="periode = 'pilih'"
            />
          </UFormField>
        </AppFilterGrid>

        <AppStatGrid class="mt-4">
          <AppStat
            label="Total serah terima"
            icon="i-lucide-handshake"
            :value="ringkas.list.length"
            sub="catatan pada periode ini"
          />
          <AppStat
            label="Total barang diserahkan"
            icon="i-lucide-package"
            :value="teksTotal(ringkas.totQty)"
            :sub="`${ringkas.totalItem} baris · ${ringkas.rekap.length} jenis barang`"
            tone="info"
            wrap
          />
          <AppStat
            label="Berfoto"
            icon="i-lucide-camera"
            :value="ringkas.list.length ? `${ringkas.berfoto}/${ringkas.list.length}` : '—'"
            :sub="!ringkas.list.length ? 'belum ada catatan' : (ringkas.berfoto === ringkas.list.length ? 'semua ada buktinya' : 'sisanya tanpa bukti')"
            :tone="!ringkas.list.length ? 'gold' : (ringkas.berfoto === ringkas.list.length ? 'success' : 'warning')"
          />
          <AppStat
            label="Tujuan terbanyak"
            icon="i-lucide-target"
            :value="ringkas.teratas ? ringkas.teratas[0] : '—'"
            :sub="ringkas.teratas ? `${ringkas.teratas[1]} catatan` : 'belum ada'"
            tone="vip"
          />
        </AppStatGrid>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AppPanel
            title="Arah perpindahan"
            :description="barsArah.sub"
          >
            <div
              v-if="!barsArah.data.length"
              class="text-[13px] text-dimmed"
            >
              Belum ada data pada periode ini.
            </div>
            <AppBar
              v-for="b in barsArah.data"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
            />
          </AppPanel>
          <AppPanel
            title="Barang terbanyak diserahkan"
            :description="subBarQty(ringkas.rekap)"
          >
            <div
              v-if="!barsBarang.length"
              class="text-[13px] text-dimmed"
            >
              Belum ada data pada periode ini.
            </div>
            <AppBar
              v-for="b in barsBarang"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
              tone="vip"
            />
          </AppPanel>
        </div>

        <AppPanel
          v-if="ringkas.rekap.length"
          class="mt-5"
          title="Total barang yang diserahkan"
          :description="`${ringkas.rekap.length} barang · ${teksTotal(ringkas.totQty)}`"
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="ringkas.rekap"
            :columns="kolomRekap"
          >
            <template #total-cell="{ row }">
              <span class="num">{{ fmtQty(row.original.total) }} {{ row.original.unit }}</span>
            </template>
            <template #dipakai-cell="{ row }">
              <span class="num text-muted">{{ row.original.dipakai }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="b in ringkas.rekap"
              :key="b.item + b.unit"
              class="flex items-center justify-between gap-3 px-4 py-3"
            >
              <b class="min-w-0 truncate text-sm text-highlighted">{{ b.item }}</b>
              <span class="num shrink-0 text-sm">{{ fmtQty(b.total) }} {{ b.unit }} · {{ b.dipakai }}x</span>
            </div>
          </div>
          <p class="border-t border-default px-4 py-2.5 text-[11.5px] leading-relaxed text-dimmed">
            Dihitung dari catatan yang sedang tampil — ubah periode atau penyaring di atas untuk mempersempitnya.
            Satuan sekeluarga (Gram+Kg, ML+Liter) digabung otomatis; satuan yang tak bisa dikonversi (Pcs, Dus, dll) tetap dipisah barisnya.
          </p>
        </AppPanel>

        <div class="mt-5">
          <UAlert
            v-if="!daftarTampil.length"
            color="neutral"
            variant="subtle"
            icon="i-lucide-handshake"
            :title="belumAdaTim ? 'Tim belum diisi' : (cari ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada serah terima pada periode ini.')"
            :description="belumAdaTim ? pesanTimKosong : undefined"
          />
          <div
            v-for="blk in blokSerah"
            :key="blk.judul || 'semua'"
            class="mb-5"
          >
            <div
              v-if="blk.judul"
              class="mb-2 flex flex-wrap items-baseline gap-2"
            >
              <span
                class="text-[12px] font-bold uppercase tracking-wider"
                :class="blk.arah === 'kirim' ? 'text-error' : 'text-success'"
              >{{ blk.judul }}</span>
              <span class="text-[12px] text-dimmed">{{ blk.sub }} · {{ blk.list.length }} catatan</span>
            </div>
            <div
              v-if="!blk.list.length && blk.judul"
              class="rounded-panel border border-dashed border-default px-4 py-6 text-center text-[12.5px] font-medium text-dimmed"
            >
              Tidak ada pada periode ini.
            </div>
            <div
              v-for="s in blk.list"
              :key="s.id"
              class="mb-3 flex flex-wrap items-start gap-3 rounded-panel border border-default bg-default p-4 shadow-panel"
            >
              <AppStatus
                :color="s.tujuan === 'Bar' ? 'vip' : 'warning'"
                size="sm"
              >
                → {{ s.tujuan || '—' }}
              </AppStatus>
              <div class="min-w-0 flex-1">
                <div class="text-[13.5px] font-semibold text-highlighted">
                  {{ tglPendek(String(s.tanggal || '')) }} · {{ s.tim || '—' }}{{ s.penerima ? ` · ke ${s.penerima}` : '' }}
                </div>
                <div class="mt-1 text-[12.5px] leading-relaxed text-muted">
                  <template v-if="(s.items || []).length">
                    <span
                      v-for="(i, idx) in s.items"
                      :key="idx"
                    >{{ idx ? ' · ' : '' }}{{ i.item }} <b class="text-highlighted">{{ fmtQty(i.qty) }}</b> {{ i.unit }}</span>
                  </template>
                  <span
                    v-else
                    class="text-dimmed"
                  >tanpa item</span>
                </div>
                <div
                  v-if="s.catatan"
                  class="mt-1 text-[12px] text-dimmed"
                >
                  {{ s.catatan }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <UButton
                  v-if="s.adaFoto"
                  icon="i-lucide-image"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  title="Lihat foto"
                  aria-label="Lihat foto"
                  @click="() => lihatFoto(s.id, `Serah terima ${tglPendek(String(s.tanggal || ''))} → ${s.tujuan || '—'}`)"
                />
                <UButton
                  icon="i-lucide-pen"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  title="Ubah"
                  aria-label="Ubah"
                  @click="edit(s)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  title="Hapus"
                  aria-label="Hapus"
                  @click="() => { hapusTarget = s; sheetHapus = true }"
                />
              </div>
            </div>
          </div>
        </div>
      </AppPanel>
    </template>

    <StockFotoSheet
      :id="fotoId"
      v-model:open="fotoSheet"
      kind="handovers"
      :judul="fotoJudul"
    />

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus serah terima"
    >
      <p class="text-sm text-muted">
        Hapus catatan serah terima ini? Barang keluar di Daily SO hari itu ikut berkurang.
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
