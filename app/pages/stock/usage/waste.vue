<!--
  Stock › Pemakaian Bahan Baku › Waste Produk (old `deploy/stock/usage/index.html:595-721`
  + `:1547-1813`, `:3008-3089`).

  Catat: date, cause, team, amount + unit (with "+ Satuan lain…" for units that are
  not in any list), product with autocomplete (names outside the product master
  are allowed), note and an optional photo. Report: stats, top causes, top
  products, recap and the one-by-one list. Photos are only sent when changed;
  `""` removes, absent keeps (contract stock.md:106).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProdukStock, WasteCatatan } from '~/composables/useStock'
import { createWaste, deleteWaste, getProducts, listWaste, patchWaste } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { isAdminOf } from '~/composables/useMe'
import { hariIni, tglPendek, tambahHari } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'
import {
  barisWaste, bulanIni, csvWaste, daftarBulanPilih, dataBar, dataBarQty, fmtQty, fotoKeData, opsiSatuanWaste,
  opsiTimCatat, pesanTimKosong, rekapBaris, rentangBulan, SATUAN_TERSEDIA, SEBAB_OPSI, subBarQty, teksTotal,
  timBawaanCatat, timBelumDiisi, timCatatTerkunci, totalPerSatuan, unduhCsvStock, type InfoBahan, type RekapBahan,
} from '~/utils/stock-catat'

definePageMeta({ access: ['usage'] })

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'usage'))
const belumAdaTim = computed(() => timBelumDiisi(me.value?.keterangan, admin.value))

const produkQ = useAsyncData('stock-produk', getProducts, { default: () => ({ rows: [] as ProdukStock[], versions: {} }) })
const daftarNama = computed(() => produkQ.data.value?.rows.map(p => p.nama) ?? [])
const info = computed<InfoBahan>(() => Object.fromEntries((produkQ.data.value?.rows ?? []).map(p => [p.nama, p])))

// --- sub-tab + form -----------------------------------------------------------

const sub = ref<'catat' | 'report'>('catat')
const SATUAN_LAIN = '__lain__'

const form = ref({
  id: '',
  tanggal: hariIni(),
  sebab: SEBAB_OPSI[0] as string,
  tim: timBawaanCatat(me.value?.keterangan),
  item: '',
  qty: 1,
  catatan: '',
})
const unitSel = ref(SATUAN_TERSEDIA[0]!)
const unitLain = ref('')
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

/** Unit options follow every keystroke; an unknown custom unit rides "+ Satuan lain…" (old `perbaruiSatuanWaste`). */
const unitOptions = computed(() => {
  const r = opsiSatuanWaste(info.value, form.value.item, unitSel.value === SATUAN_LAIN ? unitLain.value : unitSel.value)
  return [...r.options.map(u => ({ value: u, label: u })), { value: SATUAN_LAIN, label: '+ Satuan lain…' }]
})
watch(() => form.value.item, () => {
  if (unitSel.value === SATUAN_LAIN) {
    const r = opsiSatuanWaste(info.value, form.value.item, unitLain.value)
    if (r.kustom) return
    unitSel.value = r.terpilih
    return
  }
  const r = opsiSatuanWaste(info.value, form.value.item, unitSel.value)
  if (r.kustom) {
    unitSel.value = SATUAN_LAIN
    unitLain.value = r.kustom
  }
  else unitSel.value = r.terpilih
})

const itemTerdaftar = computed(() => semuaNamaAda(form.value.item))
function semuaNamaAda(nama: string) {
  const n = nama.trim().toLowerCase()
  return !!n && daftarNama.value.some(x => x.toLowerCase() === n)
}

const fotoInput = ref<HTMLInputElement | null>(null)
const fotoBaru = ref<string | null>(null)
const fotoNama = ref('')
const fotoInfo = ref('')
function pilihFoto(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (!f) {
    fotoBaru.value = null
    fotoInfo.value = ''
    return
  }
  fotoKeData(f).then((data) => {
    fotoBaru.value = data
    fotoNama.value = f.name
    fotoInfo.value = 'Foto siap diunggah.'
  }).catch((e: Error) => toast.add({ title: e.message, color: 'error' }))
}

function resetForm() {
  form.value = { id: '', tanggal: hariIni(), sebab: SEBAB_OPSI[0]!, tim: timBawaanCatat(me.value?.keterangan), item: '', qty: 1, catatan: '' }
  unitSel.value = SATUAN_TERSEDIA[0]!
  unitLain.value = ''
  fotoBaru.value = null
  fotoNama.value = ''
  fotoInfo.value = ''
  formFotoAda.value = false
  if (fotoInput.value) fotoInput.value.value = ''
}

const fotoSheet = ref(false)
const fotoId = ref('')
const fotoJudul = ref('')
const formFotoAda = ref(false)
function lihatFoto(id: string, judul: string) {
  fotoId.value = id
  fotoJudul.value = judul
  fotoSheet.value = true
}
// Call it only after every ref it touches exists (the photo refs above).
resetForm()

function edit(r: WasteCatatan) {
  form.value = {
    id: r.id,
    tanggal: r.tanggal || hariIni(),
    sebab: SEBAB_OPSI.includes(r.sebab as typeof SEBAB_OPSI[number]) ? r.sebab : SEBAB_OPSI[0]!,
    tim: r.tim || timBawaanCatat(me.value?.keterangan),
    item: r.item || '',
    qty: r.qty || 0,
    catatan: r.catatan || '',
  }
  const opsi = opsiSatuanWaste(info.value, r.item, r.unit)
  if (opsi.kustom) {
    unitSel.value = SATUAN_LAIN
    unitLain.value = opsi.kustom
  }
  else {
    unitSel.value = opsi.terpilih
    unitLain.value = ''
  }
  fotoBaru.value = null
  fotoNama.value = ''
  fotoInfo.value = r.adaFoto ? 'Sudah ada foto — pilih berkas baru untuk menggantinya.' : ''
  formFotoAda.value = !!r.adaFoto
  if (fotoInput.value) fotoInput.value.value = ''
  sub.value = 'catat'
}

// --- period (report) ----------------------------------------------------------

const periode = ref<'minggu' | 'bulan' | 'semua' | 'pilih'>('bulan')
const bulanPilih = ref(bulanIni())
const pilihanBulan = daftarBulanPilih()
const rentang = computed(() => {
  const hari = hariIni()
  if (periode.value === 'minggu') return { dari: tambahHari(hari, -6), ke: hari }
  if (periode.value === 'pilih') return rentangBulan(bulanPilih.value)
  if (periode.value === 'semua') return {} as { dari?: string, ke?: string }
  return { dari: `${bulanIni()}-01`, ke: hari }
})
watch(periode, () => {
  if (periode.value !== 'pilih') bulanPilih.value = bulanIni()
})

const daftarQ = useAsyncData('stock-waste', () => listWaste(rentang.value.dari, rentang.value.ke), {
  watch: [rentang],
  default: () => ({ rows: [] as WasteCatatan[], versions: {} }),
})
const versi = computed<Record<string, Versi>>(() => daftarQ.data.value?.versions ?? {})
const semua = computed<WasteCatatan[]>(() => daftarQ.data.value?.rows ?? [])

const menyimpan = ref(false)
async function simpan() {
  const item = form.value.item.trim()
  if (!item) {
    toast.add({ title: 'Produk kosong', description: 'Isi nama produk atau bahan yang terbuang.', color: 'error' })
    return
  }
  const qty = Number(form.value.qty) || 0
  if (qty <= 0) {
    toast.add({ title: 'Jumlah kosong', description: 'Isi jumlah yang terbuang.', color: 'error' })
    return
  }
  const unit = unitSel.value === SATUAN_LAIN ? unitLain.value.trim() : unitSel.value
  if (!unit) {
    toast.add({ title: 'Satuan kosong', description: 'Tulis satuannya, atau pilih dari daftar.', color: 'error' })
    return
  }
  const body: Record<string, unknown> = {
    tanggal: form.value.tanggal,
    item,
    qty,
    unit,
    sebab: form.value.sebab,
    tim: form.value.tim,
    catatan: form.value.catatan.trim(),
  }
  if (fotoBaru.value !== null) {
    body.foto = fotoBaru.value
    body.fotoNama = fotoNama.value
  }
  menyimpan.value = true
  try {
    if (form.value.id) await patchWaste(form.value.id, body, versi.value[form.value.id])
    else await createWaste(body)
    toast.add({ title: 'Tersimpan', description: `${item} tercatat sebagai waste.`, color: 'success' })
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

const sheetHapus = ref(false)
const hapusTarget = ref<WasteCatatan | null>(null)
async function hapusGo() {
  const r = hapusTarget.value
  sheetHapus.value = false
  if (!r) return
  try {
    await deleteWaste(r.id, versi.value[r.id])
    toast.add({ title: 'Dihapus' })
    await daftarQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- report filters -----------------------------------------------------------

const cari = ref('')
const sebabFilter = ref('ALL')
const timFilter = ref('ALL')

const daftarTampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return semua.value
    .filter(r => sebabFilter.value === 'ALL' || (r.sebab || '') === sebabFilter.value)
    .filter(r => timFilter.value === 'ALL' || (r.tim || '') === timFilter.value)
    .filter(r => !q || [r.item, r.sebab, r.pic, r.catatan, r.tim].some(v => String(v || '').toLowerCase().includes(q)))
})

const ringkas = computed(() => {
  const list = daftarTampil.value
  const perSebab: Record<string, number> = {}
  list.forEach((r) => {
    const sb = r.sebab || 'Lainnya'
    perSebab[sb] = (perSebab[sb] || 0) + 1
  })
  const teratas = Object.entries(perSebab).sort((a, b) => b[1] - a[1])[0]
  const berfoto = list.filter(r => r.adaFoto).length
  const baris = barisWaste(list)
  return { list, perSebab, teratas, berfoto, rekap: rekapBaris(info.value, baris), totQty: totalPerSatuan(baris) }
})
const barsSebab = computed(() => dataBar(ringkas.value.perSebab))
const barsProduk = computed(() => dataBarQty(ringkas.value.rekap, 8))
const kolomRekap: TableColumn<RekapBahan>[] = [
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'total', header: 'Total Keluar' },
  { accessorKey: 'dipakai', header: 'Berapa kejadian' },
]

function ekspor() {
  unduhCsvStock(`waste-${bulanIni()}.csv`, csvWaste(daftarTampil.value))
}

async function segarkan() {
  await Promise.all([produkQ.refresh(), daftarQ.refresh()])
}
</script>

<template>
  <AppPage
    title="Waste produk"
    description="Catat produk dan bahan yang terbuang, beserta sebabnya."
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
        { value: 'catat', label: 'Catat Waste' },
        { value: 'report', label: 'Report Waste' },
      ]"
    />

    <template v-if="sub === 'catat'">
      <AppPanel :title="form.id ? 'Ubah catatan waste' : 'Catat waste baru'">
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
          <UFormField label="Sebab">
            <USelect
              v-model="form.sebab"
              :items="SEBAB_OPSI.map(s => ({ value: s as string, label: s }))"
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
          <UFormField label="Jumlah">
            <div class="flex gap-2">
              <UInput
                v-model.number="form.qty"
                type="number"
                min="0"
                step="0.01"
                class="w-20"
              />
              <USelect
                v-model="unitSel"
                :items="unitOptions"
                class="min-w-0 flex-1"
              />
            </div>
            <UInput
              v-if="unitSel === SATUAN_LAIN"
              v-model="unitLain"
              placeholder="Tulis satuannya, mis. Toples"
              class="mt-2 w-full"
            />
          </UFormField>
        </div>

        <UFormField
          class="mt-4"
          label="Produk / bahan yang terbuang"
        >
          <StockBahanInput
            v-model="form.item"
            :daftar="daftarNama"
            placeholder="Nama produk atau bahan…"
          />
          <p
            v-if="form.item.trim()"
            class="mt-1 text-[12px] text-muted"
          >
            <template v-if="itemTerdaftar">
              ✓ Terdaftar — satuannya mengikuti data Purchasing.
            </template>
            <template v-else>
              ⊕ <b class="text-highlighted">{{ form.item.trim() }}</b> belum terdaftar. Tetap bisa dicatat apa adanya, dan <b>semua satuan</b> bisa dipilih.
            </template>
          </p>
        </UFormField>

        <UFormField
          class="mt-4"
          label="Catatan — kenapa sampai terbuang"
        >
          <UTextarea
            v-model="form.catatan"
            :rows="2"
            placeholder="cth: chiller mati semalam, produk tidak layak jual"
            class="w-full"
          />
        </UFormField>

        <UFormField
          class="mt-4"
          label="Foto (opsional)"
        >
          <div class="flex flex-wrap items-center gap-2.5">
            <input
              ref="fotoInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="pilihFoto"
            >
            <UButton
              label="Pilih foto"
              icon="i-lucide-image-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="fotoInput?.click()"
            />
            <img
              v-if="fotoBaru"
              :src="fotoBaru"
              alt="Pratinjau foto waste"
              class="size-14 rounded-field border border-default object-cover"
            >
            <UButton
              v-if="form.id && formFotoAda"
              label="Lihat foto lama"
              icon="i-lucide-image"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="lihatFoto(form.id, `Waste — ${form.item}`)"
            />
            <span class="text-[12px] text-muted">{{ fotoInfo }}</span>
          </div>
        </UFormField>

        <UButton
          class="mt-5 w-full"
          label="Simpan catatan waste"
          icon="i-lucide-save"
          :loading="menyimpan"
          @click="simpan"
        />
      </AppPanel>
    </template>

    <template v-else>
      <AppPanel title="Report waste">
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
              placeholder="Cari produk, sebab, atau PIC…"
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
          <UFormField label="Sebab">
            <USelect
              v-model="sebabFilter"
              :items="[{ value: 'ALL', label: 'Semua sebab' }, ...SEBAB_OPSI.map(s => ({ value: s, label: s }))]"
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
        </AppFilterGrid>

        <AppStatGrid class="mt-4">
          <AppStat
            label="Total catatan"
            icon="i-lucide-trash-2"
            :value="ringkas.list.length"
            sub="kejadian waste"
            :tone="ringkas.list.length ? 'error' : 'success'"
          />
          <AppStat
            label="Total terbuang"
            icon="i-lucide-package"
            :value="teksTotal(ringkas.totQty)"
            :sub="`${ringkas.rekap.length} jenis barang`"
            tone="error"
            wrap
          />
          <AppStat
            label="Sebab terbanyak"
            icon="i-lucide-flame"
            :value="ringkas.teratas ? ringkas.teratas[0] : '—'"
            :sub="ringkas.teratas ? `${ringkas.teratas[1]} kejadian` : 'belum ada'"
            tone="warning"
          />
          <AppStat
            label="Berfoto"
            icon="i-lucide-camera"
            :value="ringkas.list.length ? `${ringkas.berfoto}/${ringkas.list.length}` : '—'"
            :sub="ringkas.list.length ? 'ada buktinya' : 'belum ada catatan'"
            tone="vip"
          />
        </AppStatGrid>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AppPanel
            title="Sebab terbanyak"
            :description="`${fmtQty(ringkas.list.length)} kejadian`"
          >
            <div
              v-if="!barsSebab.length"
              class="text-[13px] text-dimmed"
            >
              Belum ada data pada periode ini.
            </div>
            <AppBar
              v-for="b in barsSebab"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
              tone="error"
            />
          </AppPanel>
          <AppPanel
            title="Produk terbanyak terbuang"
            :description="subBarQty(ringkas.rekap)"
          >
            <div
              v-if="!barsProduk.length"
              class="text-[13px] text-dimmed"
            >
              Belum ada data pada periode ini.
            </div>
            <AppBar
              v-for="b in barsProduk"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
              tone="gold"
            />
          </AppPanel>
        </div>

        <AppPanel
          v-if="ringkas.rekap.length"
          class="mt-5"
          title="Total waste per produk"
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
            icon="i-lucide-sparkles"
            :title="belumAdaTim ? 'Tim belum diisi' : (cari || sebabFilter !== 'ALL' || timFilter !== 'ALL' ? 'Tidak ada yang cocok dengan penyaring yang dipasang.' : 'Belum ada waste tercatat pada periode ini.')"
            :description="belumAdaTim ? pesanTimKosong : undefined"
          />
          <div
            v-for="r in daftarTampil"
            :key="r.id"
            class="mb-3 flex flex-wrap items-start gap-3 rounded-panel border border-default bg-default p-4 shadow-panel"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <b class="font-display text-[15px] font-bold text-highlighted">{{ r.item }}</b>
                <AppStatus
                  color="error"
                  size="sm"
                >
                  {{ fmtQty(r.qty) }} {{ r.unit }}
                </AppStatus>
                <AppStatus
                  color="neutral"
                  size="sm"
                >
                  {{ r.sebab || '-' }}
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
                class="mt-2 rounded-field border border-default bg-muted px-3 py-2 text-[13px] leading-relaxed"
              >
                {{ r.catatan }}
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <UButton
                v-if="r.adaFoto"
                icon="i-lucide-image"
                color="neutral"
                variant="ghost"
                size="sm"
                title="Lihat foto"
                aria-label="Lihat foto"
                @click="() => lihatFoto(r.id, `${r.item} — ${tglPendek(String(r.tanggal || ''))}`)"
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
        </div>
      </AppPanel>
    </template>

    <StockFotoSheet
      :id="fotoId"
      v-model:open="fotoSheet"
      kind="waste"
      :judul="fotoJudul"
    />

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus catatan waste"
    >
      <p class="text-sm text-muted">
        Hapus catatan waste "{{ hapusTarget?.item || hapusTarget?.id }}"? Tindakan ini tidak bisa dibatalkan.
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
