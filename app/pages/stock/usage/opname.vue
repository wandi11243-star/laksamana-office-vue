<!--
  Stock › Pemakaian Bahan Baku › Daily SO (old `deploy/stock/usage/index.html:376-419`
  + `:1837-2460`).

  The daily stock book: opening = yesterday's closing (same team), keluar is
  computed from usage + waste + handovers of the day, seharusnya = opening +
  masuk − keluar and selisih = fisik − seharusnya. The first count only sets the
  opening (no seharusnya yet); 0 and empty are different ("not counted" is null).
  Rules: docs/migrasi/stock.md F.10-12; contract: laksamana-api/docs/api/stock.md.
  "Tambah item baru" writes to the product database (POST /products), so it is
  only offered to purchasing/hpp holders — the API refuses usage-only accounts.
-->
<script setup lang="ts">
import type { OpnameCatatan } from '~/composables/useStock'
import {
  createOpname, createProduk, deleteOpname, listHandovers, listOpname, listUsage, listWaste, patchOpname, useProdukStock,
} from '~/composables/useStock'
import { hasAccess, isAdminOf } from '~/composables/useMe'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tglPanjang } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'
import {
  csvOpname, fmtQty, opsiTimCatat, pesanTimKosong, SATUAN_TERSEDIA, soAngka, soAreaCocok, soHitung, soKeluarHitung,
  soKemarin, soKelompok, soSelisihTeks, SO_KATEGORI, soUnit, TIM_OPSI, timBawaanCatat, timBelumDiisi, timCatatTerkunci,
  timDariKeterangan, unduhCsvStock, type InfoBahan, type SoHitungan,
} from '~/utils/stock-catat'

definePageMeta({ access: ['usage'] })

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'usage'))
const bolehTambahItem = computed(() => hasAccess(me.value, ['purchasing', 'hpp']))

// --- master products: sheet categories, areas, units, autocomplete ------------

const produkQ = useProdukStock()
const daftarNama = computed(() => produkQ.data.value?.rows.map(p => p.nama) ?? [])
const info = computed<InfoBahan>(() => Object.fromEntries((produkQ.data.value?.rows ?? []).map(p => [p.nama, p])))

// --- selection: date + team ---------------------------------------------------

const tanggal = ref(hariIni())
const tim = ref(timBawaanCatat(me.value?.keterangan))
const cari = ref('')
const opsiTim = computed(() => opsiTimCatat(me.value?.keterangan))
const terkunci = computed(() => timCatatTerkunci(me.value?.keterangan))
const belumAdaTim = computed(() => timBelumDiisi(me.value?.keterangan, admin.value))
watch(me, () => {
  if (!opsiTim.value.some(o => o.value === tim.value)) tim.value = timBawaanCatat(me.value?.keterangan)
})

/** Existing entries may carry a team outside the picker (legacy empty/unknown). */
const opsiTimTampil = computed(() => {
  const base = opsiTim.value
  if (tim.value && !base.some(o => o.value === tim.value)) return [...base, { value: tim.value, label: `${tim.value} (kode lama)` }]
  if (!tim.value && admin.value) return [...base, { value: KOSONG, label: '(belum ada tim)' }]
  return base
})
const pesanTim = computed(() => terkunci.value
  ? 'Tim Anda, ditetapkan di Kelola Akses.'
  : 'Anda melihat semua tim — pilih tim yang sesuai.')

// --- data: opname history + today's outward lines -----------------------------

const opnameQ = useAsyncData('stock-opname', () => listOpname(), { default: () => ({ rows: [] as OpnameCatatan[], versions: {} }) })
const soData = computed<OpnameCatatan[]>(() => opnameQ.data.value?.rows ?? [])
const versiOpname = computed<Record<string, Versi>>(() => opnameQ.data.value?.versions ?? {})

const keluarQ = useAsyncData('stock-so-keluar', async () => {
  const [p, w, s] = await Promise.all([
    listUsage(tanggal.value, tanggal.value),
    listWaste(tanggal.value, tanggal.value),
    listHandovers(tanggal.value, tanggal.value),
  ])
  return { pemakaian: p.rows, waste: w.rows, serah: s.rows }
}, { watch: [tanggal], default: () => ({ pemakaian: [], waste: [], serah: [] }) })

const keluarInfo = computed(() => soKeluarHitung({
  pemakaian: keluarQ.data.value?.pemakaian ?? [],
  waste: keluarQ.data.value?.waste ?? [],
  serah: keluarQ.data.value?.serah ?? [],
  tanggal: tanggal.value,
  tim: tim.value,
  info: info.value,
}))

// --- the sheet's own inputs (per item) ----------------------------------------

const soIsi = ref<Record<string, string>>({})
const soMasuk = ref<Record<string, string>>({})
const editId = ref('')
const statusEntri = ref('')

watch([soData, tanggal, tim], () => {
  soIsi.value = {}
  soMasuk.value = {}
  editId.value = ''
  statusEntri.value = ''
  const ada = soData.value.find(e => e.tanggal === tanggal.value && (tim.value === 'ALL' ? true : e.tim === tim.value))
  if (ada) {
    editId.value = ada.id
    statusEntri.value = ada.status || 'Selesai'
    ;(ada.items || []).forEach((it) => {
      const nama = String(it.item || '')
      if (it.fisik !== null && it.fisik !== undefined && it.fisik !== '') soIsi.value[nama] = String(it.fisik)
      if (it.masuk !== null && it.masuk !== undefined && it.masuk !== '' && Number(it.masuk)) soMasuk.value[nama] = String(it.masuk)
    })
  }
}, { immediate: true })

function hitung(nama: string): SoHitungan {
  return soHitung({
    opening: soKemarin(soData.value, nama, tanggal.value, tim.value),
    masuk: soMasuk.value[nama],
    keluar: keluarInfo.value.keluar[nama],
    fisik: soIsi.value[nama],
  })
}

interface BarisSo { nama: string, unit: string, hit: SoHitungan }
const grupTampil = computed(() => {
  const { grup, urut } = soKelompok(info.value, daftarNama.value, tim.value)
  const q = cari.value.trim().toLowerCase()
  return urut
    .map(kat => ({
      kat,
      items: (grup[kat] ?? []).filter(n => !q || n.toLowerCase().includes(q)).map<BarisSo>(nama => ({ nama, unit: soUnit(info.value, nama), hit: hitung(nama) })),
    }))
    .filter(g => g.items.length)
})

const ringkas = computed(() => {
  const daftar = daftarNama.value.filter(n => soAreaCocok(info.value, n, tim.value))
  const terisi = daftar.filter(n => soAngka(soIsi.value[n]) !== null).length
  let cocok = 0
  let selisih = 0
  let baru = 0
  daftar.forEach((nama) => {
    const h = hitung(nama)
    if (h.closing === null) return
    if (h.baru) {
      baru++
      return
    }
    if (h.selisih === 0) cocok++
    else selisih++
  })
  return { terisi, total: daftar.length, cocok, selisih, baru }
})

// --- save / delete ------------------------------------------------------------

const menyimpan = ref(false)
async function simpan() {
  if (!tanggal.value) {
    toast.add({ title: 'Tanggal kosong', description: 'Pilih tanggal opname.', color: 'error' })
    return
  }
  if (!tim.value || tim.value === 'ALL') {
    toast.add({ title: 'Pilih tim', description: 'Tentukan tim sebelum menyimpan.', color: 'error' })
    return
  }
  const kandidat = new Set([...Object.keys(soIsi.value), ...Object.keys(soMasuk.value)])
  const items = [...kandidat]
    .map((nama) => {
      const h = hitung(nama)
      return {
        item: nama,
        unit: soUnit(info.value, nama),
        opening: h.opening,
        masuk: h.masuk || null,
        sistem: h.seharusnya,
        fisik: h.closing,
        note: '',
      }
    })
    .filter(it => it.fisik !== null || it.masuk)
  if (!items.length) {
    toast.add({ title: 'Belum ada isian', description: 'Isi minimal satu stok item.', color: 'error' })
    return
  }
  const body = { tanggal: tanggal.value, tim: tim.value, status: 'Selesai', catatan: '', items }
  menyimpan.value = true
  try {
    if (editId.value) await patchOpname(editId.value, body, versiOpname.value[editId.value])
    else await createOpname(body)
    toast.add({ title: 'Tersimpan', description: `${items.length} item disimpan untuk ${tglPanjang(tanggal.value)}.`, color: 'success' })
    await Promise.all([opnameQ.refresh(), keluarQ.refresh()])
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => opnameQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

const sheetHapus = ref(false)
const hapusTarget = ref<{ id: string, tanggal: string } | null>(null)
async function hapusGo() {
  const t = hapusTarget.value
  sheetHapus.value = false
  if (!t) return
  try {
    await deleteOpname(t.id, versiOpname.value[t.id])
    toast.add({ title: 'Dihapus' })
    await Promise.all([opnameQ.refresh(), keluarQ.refresh()])
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => opnameQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const riwayat = computed(() => soData.value
  .slice()
  .sort((a, b) => String(b.tanggal + (b.waktu || '')).localeCompare(String(a.tanggal + (a.waktu || ''))))
  .slice(0, 30))
const jmlItem = (e: OpnameCatatan) => (e.items || []).filter(it => it.fisik !== null && it.fisik !== undefined && it.fisik !== '').length

function bukaRiwayat(e: OpnameCatatan) {
  tanggal.value = String(e.tanggal || '')
  const punya = opsiTim.value.map(o => o.value)
  if (punya.length) tim.value = punya.includes(String(e.tim)) ? String(e.tim) : punya[0]!
  else tim.value = String(e.tim || '')
}

// --- add a new product (purchasing/hpp only) ----------------------------------

const sheetItem = ref(false)
const itemBaru = ref({ nama: '', satuan: 'Kg', kategori: SO_KATEGORI[0]!, kategoriLain: '', area: [] as string[] })
const KATEGORI_LAIN = '(lainnya)'
const areaBawaan = computed(() => timDariKeterangan(me.value?.keterangan)[0] ?? '')
function bukaItemBaru() {
  itemBaru.value = { nama: '', satuan: 'Kg', kategori: SO_KATEGORI[0]!, kategoriLain: '', area: areaBawaan.value ? [areaBawaan.value] : [] }
  sheetItem.value = true
}
async function simpanItemBaru() {
  const b = itemBaru.value
  const nama = b.nama.trim()
  if (!nama) {
    toast.add({ title: 'Nama kosong', color: 'error' })
    return
  }
  if (info.value[nama]) {
    toast.add({ title: 'Sudah ada', description: `Item "${nama}" sudah terdaftar.`, color: 'error' })
    return
  }
  const kategori = b.kategori === KATEGORI_LAIN ? b.kategoriLain.trim() : b.kategori
  try {
    await createProduk({
      nama,
      utama: '',
      cadangan: [],
      satuan: [b.satuan],
      kategori,
      area: [...b.area],
      satuanDasar: '',
      isi: {},
    })
    await produkQ.refresh()
    sheetItem.value = false
    toast.add({ title: 'Ditambahkan', description: `${nama} masuk database.`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- export + refresh ---------------------------------------------------------

function ekspor() {
  const rows = daftarNama.value
    .filter(n => soAreaCocok(info.value, n, tim.value))
    .map((nama) => {
      const h = hitung(nama)
      return {
        item: nama,
        unit: soUnit(info.value, nama),
        opening: h.opening,
        masuk: h.masuk || null,
        keluar: h.keluar,
        seharusnya: h.seharusnya,
        fisik: h.closing,
        selisih: h.selisih,
      }
    })
  unduhCsvStock(`opname-${tanggal.value}-${tim.value || 'tanpa-tim'}.csv`, csvOpname(tanggal.value, tim.value, rows))
}

async function segarkan() {
  await Promise.all([produkQ.refresh(), opnameQ.refresh(), keluarQ.refresh()])
}
</script>

<template>
  <AppPage
    title="Daily SO"
    description="Buku stok harian: awal + masuk − keluar, lalu isi stok fisik hasil hitung."
  >
    <template #actions>
      <UButton
        label="Ekspor CSV"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        size="sm"
        @click="ekspor"
      />
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        loading-auto
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

    <AppPanel title="Daily stock opname">
      <template #actions>
        <AppStatus
          :color="editId ? 'success' : 'neutral'"
          size="sm"
        >
          {{ editId ? `Sudah disimpan (${statusEntri})` : 'Belum disimpan untuk tanggal & tim ini' }}
        </AppStatus>
      </template>

      <AppFilterGrid>
        <UFormField label="Tanggal">
          <AppTanggal
            v-model="tanggal"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tim">
          <USelect
            :model-value="tim || KOSONG"
            :items="opsiTimTampil"
            class="w-full"
            :class="terkunci && 'pointer-events-none'"
            @update:model-value="tim = dariKosong($event)"
          />
        </UFormField>
        <UFormField label="Cari item">
          <UInput
            v-model="cari"
            placeholder="ketik untuk menyaring…"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
      <p class="mt-2 text-[12px] text-muted">
        {{ pesanTim }}
      </p>

      <AppStatGrid class="mt-4">
        <AppStat
          label="Terisi"
          icon="i-lucide-check-circle"
          :value="`${ringkas.terisi}/${ringkas.total}`"
          :sub="ringkas.baru ? `${ringkas.baru} baru (stok awal)` : 'item dihitung'"
        />
        <AppStat
          label="Cocok"
          icon="i-lucide-check"
          :value="ringkas.cocok"
          sub="sesuai buku stok"
          tone="success"
        />
        <AppStat
          label="Selisih"
          icon="i-lucide-triangle-alert"
          :value="ringkas.selisih"
          sub="perlu dicek"
          :tone="ringkas.selisih ? 'error' : 'success'"
        />
      </AppStatGrid>

      <UAlert
        class="my-4"
        color="neutral"
        variant="subtle"
        icon="i-lucide-book-open"
        title="Buku stok harian"
        description="Stok Awal = closing kemarin (otomatis). + Masuk barang datang hari ini. − Keluar = pemakaian + waste + serah terima (otomatis). Seharusnya = Awal + Masuk − Keluar. Isi Stok fisik hasil hitung; Selisih = fisik − seharusnya. Closing hari ini jadi Awal besok. (0* = item belum pernah dihitung)"
      />

      <p
        v-if="!daftarNama.length"
        class="rounded-panel border border-dashed border-default px-4 py-10 text-center text-sm text-muted"
      >
        Database produk kosong. Tambahkan item dulu lewat Purchasing.
      </p>

      <div
        v-for="g in grupTampil"
        :key="g.kat"
        class="mb-4"
      >
        <div class="mb-2 flex items-center gap-2">
          <AppStatus
            :color="g.kat.startsWith('FLOOR · ') ? 'vip' : 'gold'"
            size="sm"
          >
            {{ g.kat }}
          </AppStatus>
          <span class="text-[11.5px] font-semibold text-dimmed">{{ g.items.length }} item</span>
          <div class="flex-1 border-t border-default" />
        </div>
        <div class="overflow-hidden rounded-xl border border-default bg-default">
          <div class="hidden items-center gap-2.5 bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:flex">
            <div class="flex-1">
              Item
            </div>
            <div class="w-[104px] shrink-0 text-center">
              Stok fisik
            </div>
            <div class="w-14 shrink-0 text-center">
              Selisih
            </div>
          </div>
          <div
            v-for="b in g.items"
            :key="b.nama"
            class="border-t border-default px-3 py-2 first:border-t-0"
          >
            <div class="flex items-center gap-2.5">
              <div class="min-w-0 flex-1">
                <div class="break-words text-[13.5px] font-semibold leading-snug text-highlighted">
                  {{ b.nama }}
                </div>
                <div
                  v-if="b.unit"
                  class="text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                >
                  satuan: {{ b.unit }}
                </div>
                <div
                  v-else
                  class="text-[11px] font-semibold text-warning"
                  title="Item ini belum punya satuan, jadi angka Keluar bisa salah kalau pemakaiannya bercampur Gram/Kg. Atur satuannya di Purchasing → editor produk."
                >
                  Belum ada satuan — atur di Purchasing
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <UInput
                  v-model="soIsi[b.nama]"
                  type="number"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="stok"
                  class="w-24"
                />
                <span class="w-6 truncate text-[11px] font-semibold text-dimmed">{{ b.unit }}</span>
              </div>
              <div
                class="w-14 shrink-0 text-center text-[13px] font-bold num"
                :class="{
                  'text-dimmed': b.hit.closing === null,
                  'text-warning': b.hit.closing !== null && b.hit.baru,
                  'text-success': b.hit.closing !== null && !b.hit.baru && b.hit.selisih === 0,
                  'text-error': b.hit.closing !== null && !b.hit.baru && b.hit.selisih !== 0,
                }"
              >
                {{ soSelisihTeks(b.hit).teks }}
              </div>
            </div>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] font-medium text-muted num">
              <span>Awal <b :class="b.hit.baru ? 'text-dimmed' : 'text-highlighted'">{{ b.hit.baru ? 'belum ada' : fmtQty(b.hit.opening) + (b.unit ? ' ' + b.unit : '') }}</b></span>
              <span class="flex items-center gap-1">+ Masuk
                <UInput
                  v-model="soMasuk[b.nama]"
                  type="number"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="0"
                  class="w-16"
                />{{ b.unit }}
              </span>
              <span>− Keluar <b :class="b.hit.keluar ? 'text-error' : 'text-dimmed'">{{ fmtQty(b.hit.keluar) }}</b>{{ b.unit }}<span
                v-if="keluarInfo.campur[b.nama] || (b.hit.keluar && !b.unit)"
                class="text-warning"
                title="Ada catatan keluar bersatuan berbeda yang tak bisa dikonversi otomatis. Samakan satuannya / atur satuan item agar angka ini tepat."
              > ⚠</span></span>
              <span class="text-dimmed">=</span>
              <span>Seharusnya <b class="text-primary-700 dark:text-primary-300">{{ b.hit.seharusnya === null ? '—' : fmtQty(b.hit.seharusnya) + (b.unit ? ' ' + b.unit : '') }}</b></span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <template v-if="bolehTambahItem">
          <UButton
            label="Tambah item baru"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="bukaItemBaru"
          />
          <span class="text-[11.5px] font-medium text-dimmed">Item baru ikut tersimpan ke database produk.</span>
        </template>
        <span
          v-else
          class="text-[11.5px] font-medium text-dimmed"
        >Item baru didaftarkan lewat Purchasing → Database barang.</span>
        <UButton
          class="ms-auto"
          :label="editId ? 'Simpan perubahan opname' : 'Simpan opname hari ini'"
          :loading="menyimpan"
          @click="simpan"
        />
      </div>
    </AppPanel>

    <AppPanel
      title="Riwayat opname"
      :count="riwayat.length"
    >
      <div
        v-if="!riwayat.length"
        class="px-4 py-6 text-center text-sm text-muted lg:px-5"
      >
        Belum ada opname tersimpan.
      </div>
      <div
        v-for="e in riwayat"
        :key="e.id"
        class="flex items-center gap-3 border-b border-default px-4 py-2 last:border-b-0 lg:px-5"
      >
        <button
          type="button"
          class="min-w-0 flex-1 py-0.5 text-start"
          @click="bukaRiwayat(e)"
        >
          <div class="text-[13.5px] font-semibold text-highlighted">
            {{ tglPanjang(String(e.tanggal || '')) }}
          </div>
          <div class="text-[11.5px] font-medium text-dimmed">
            {{ e.tim || '—' }} · {{ e.pic || '—' }} · {{ jmlItem(e) }} item
          </div>
        </button>
        <AppStatus
          :color="e.status === 'Selesai' ? 'success' : 'warning'"
          size="sm"
        >
          {{ e.status || '' }}
        </AppStatus>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          title="Hapus"
          aria-label="Hapus opname"
          @click="() => { hapusTarget = { id: e.id, tanggal: String(e.tanggal || '') }; sheetHapus = true }"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetItem"
      title="Item baru"
      description="Item ini disimpan ke database produk dan langsung muncul di lembar hitung."
      lebar="sedang"
    >
      <div class="space-y-3">
        <UFormField label="Nama item">
          <UInput
            v-model="itemBaru.nama"
            placeholder="cth: Syrup Caramel (Btl)"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Satuan">
            <USelect
              v-model="itemBaru.satuan"
              :items="SATUAN_TERSEDIA"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kategori">
            <USelect
              v-model="itemBaru.kategori"
              :items="[...SO_KATEGORI, KATEGORI_LAIN]"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          v-if="itemBaru.kategori === KATEGORI_LAIN"
          label="Nama kategori baru"
        >
          <UInput
            v-model="itemBaru.kategoriLain"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Area"
          help="Boleh lebih dari satu; kosong = Umum."
        >
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="t in TIM_OPSI"
              :key="t"
              class="flex cursor-pointer items-center gap-1.5 rounded-field border border-default px-2 py-1.5 text-[12.5px] font-semibold"
            >
              <input
                v-model="itemBaru.area"
                type="checkbox"
                :value="t"
                class="size-3.5 accent-primary"
              >
              <span>{{ t }}</span>
            </label>
          </div>
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Tambah ke database"
          loading-auto
          @click="simpanItemBaru"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          @click="sheetItem = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus opname"
    >
      <p class="text-sm text-muted">
        Hapus opname {{ hapusTarget ? tglPanjang(hapusTarget.tanggal) : '' }}? Angka selisih hari sesudahnya ikut berubah.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          loading-auto
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
