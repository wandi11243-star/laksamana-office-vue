<!--
  Stock › Purchasing › Central Kitchen (old `deploy/stock/purchasing/index.html:184-185,484-…`).

  CK stock (`ck/balance`), movements, and the CK dashboard, computed from the
  movement list like the old `hitungRekapCK`. Manual movements (produksi /
  penyesuaian / rusak) are purchasing writes; check-in rows can only change
  through check-in (422).

  Two warehouses, one page (old `:485-490`, 10 Oct 2026): the switch at the
  top picks Central Kitchen or Gudang Bar; stock, movements and the manual
  form all follow it (`gudang` on every call).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CkMutasi, CkSaldo, Gudang } from '~/composables/useStock'
import {
  bolehUbahPurchasing,
  GUDANG_INFO,
  ckBalance,
  ckMovements,
  createMovement,
  deleteMovement,
  infoStokGudang,
  patchMovement,
  saringMutasiGudang,
  saringSaldoGudang,
  useProdukStock,
} from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { tglPendek } from '~/utils/format'
import { tampilStokCk, type TampilStok } from '~/utils/stock-catat'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()
// Purchasing `view` role (old PERM_DEFAULT): look, never change — the server refuses too.
const bisaUbah = computed(() => bolehUbahPurchasing('ck'))

const sub = ref<'stok' | 'mutasi' | 'dash'>('stok')
const gudang = ref<Gudang>('ck')
const info = computed(() => GUDANG_INFO[gudang.value])

const produkQ = useProdukStock()
const namaCk = computed(() => produkQ.data.value?.rows.filter(p => info.value.sumber.includes(p.sumber ?? '')).map(p => p.nama) ?? [])

const saldoQ = useAsyncData(() => `stock-pck-saldo-${gudang.value}`, () => ckBalance(gudang.value), {
  default: () => ({ rows: [] as CkSaldo[] }),
  watch: [gudang],
})
// Only this warehouse's goods, even when the ledger still holds a moved product's old rows.
const saldo = computed(() => saringSaldoGudang(saldoQ.data.value?.rows ?? [], produkQ.data.value?.rows ?? [], gudang.value))

const gerakQ = useAsyncData(() => `stock-pck-gerak-${gudang.value}`, () => ckMovements(undefined, undefined, gudang.value), {
  default: () => ({ rows: [] as CkMutasi[], versions: {} as Record<string, Versi> }),
  watch: [gudang],
})
const versi = computed(() => gerakQ.data.value?.versions ?? {})
// Only this warehouse's movements: never the other warehouse's, nor old rows of goods moved away.
const gerak = computed(() => saringMutasiGudang(gerakQ.data.value?.rows ?? [], gudang.value, produkQ.data.value?.rows ?? []))

/**
 * Quantities written like Ordering › Central Kitchen: big = pack (or the
 * chosen display unit), small = the base unit — never a bare base number.
 */
function tampil(item: string, n: number): TampilStok {
  return tampilStokCk(n, infoStokGudang(item, produkQ.data.value?.rows ?? [], saldo.value))
}

// --- dashboard: most-taken items + daily activity, from the movement list --------
// Items differ in unit, so bars compare one item's own total and print it in
// that item's units; the daily trend counts movements (units cannot be summed).
const rekap = computed(() => {
  const keluar = new Map<string, number>()
  const masuk = new Map<string, number>()
  const nKeluar = new Map<string, number>()
  const nMasuk = new Map<string, number>()
  const harian = new Map<string, { masuk: number, keluar: number }>()
  for (const m of gerak.value) {
    const qty = Number(m.qty) || 0
    const ke = m.arah === 'keluar'
    const k = ke ? keluar : masuk
    const n = ke ? nKeluar : nMasuk
    k.set(m.item, (k.get(m.item) ?? 0) + qty)
    n.set(m.item, (n.get(m.item) ?? 0) + 1)
    const h = harian.get(m.tanggal) ?? { masuk: 0, keluar: 0 }
    if (ke) h.keluar++
    else h.masuk++
    harian.set(m.tanggal, h)
  }
  // Ranked by how often the item moved; the bar shows that count's share.
  const atas = (p: Map<string, number>, n: Map<string, number>) => {
    const rows = [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    const maks = Math.max(1, ...rows.map(r => r[1]))
    return rows.map(([item, kali]) => {
      const t = tampil(item, p.get(item) ?? 0)
      return { label: item, value: `${t.utama} · ${kali}×`, persen: Math.round(kali / maks * 100) }
    })
  }
  const hari = [...harian.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14)
  const maksHari = Math.max(1, ...hari.map(([, v]) => v.masuk + v.keluar))
  return {
    sering: atas(keluar, nKeluar),
    masukTeratas: atas(masuk, nMasuk),
    harian: hari.map(([label, v]) => ({
      label: tglPendek(label),
      value: `${v.masuk} masuk · ${v.keluar} keluar`,
      persen: Math.round((v.masuk + v.keluar) / maksHari * 100),
    })),
  }
})

// --- manual movement form --------------------------------------------------------
// 'terima' = received from a purchase: Gudang Bar produces nothing, so that is
// its usual "in"; both reasons are valid in both warehouses (as the old one).
const SEBAB = [
  { value: 'produksi', label: 'Produksi' },
  { value: 'terima', label: 'Terima (pembelian)' },
  { value: 'penyesuaian', label: 'Penyesuaian' },
  { value: 'rusak', label: 'Rusak' },
]
const sebabMasuk = () => (gudang.value === 'bar' ? 'terima' : 'produksi')
const form = ref({ id: '', item: '', arah: 'masuk', qtyInput: 1, unitInput: 'Pack', sebab: 'produksi', tanggal: '', catatan: '' })
const sheet = ref(false)
function bukaTambah() {
  form.value = { id: '', item: '', arah: 'masuk', qtyInput: 1, unitInput: 'Pack', sebab: sebabMasuk(), tanggal: '', catatan: '' }
  sheet.value = true
}
function bukaUbah(m: CkMutasi) {
  if (m.ref) {
    toast.add({ title: 'Mutasi dari pengajuan hanya berubah lewat check-in', color: 'warning' })
    return
  }
  form.value = {
    id: m.id,
    item: m.item,
    arah: m.arah,
    qtyInput: Number(m.qtyInput ?? m.qty) || 1,
    unitInput: m.unitInput || 'Pack',
    sebab: m.sebab || 'penyesuaian',
    tanggal: m.tanggal || '',
    catatan: m.catatan || '',
  }
  sheet.value = true
}
const menyimpan = ref(false)
async function simpan() {
  if (!form.value.item.trim() || !(Number(form.value.qtyInput) > 0)) {
    toast.add({ title: 'Barang & jumlah wajib diisi', color: 'warning' })
    return
  }
  menyimpan.value = true
  try {
    const body: Record<string, unknown> = {
      item: form.value.item.trim(),
      arah: form.value.arah,
      qtyInput: Number(form.value.qtyInput),
      unitInput: form.value.unitInput,
      sebab: form.value.sebab,
      tanggal: form.value.tanggal || undefined,
      catatan: form.value.catatan.trim() || undefined,
      gudang: gudang.value,
    }
    if (form.value.id) await patchMovement(form.value.id, body, versi.value[form.value.id])
    else await createMovement(body)
    sheet.value = false
    await Promise.all([saldoQ.refresh(), gerakQ.refresh()])
    toast.add({ title: 'Mutasi tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => gerakQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
async function hapus(m: CkMutasi) {
  try {
    await deleteMovement(m.id, versi.value[m.id])
    await Promise.all([saldoQ.refresh(), gerakQ.refresh()])
    toast.add({ title: 'Mutasi dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => gerakQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}

const kolomStok: TableColumn<CkSaldo>[] = [
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'saldo', header: 'Saldo' },
  { accessorKey: 'masuk', header: 'Masuk' },
  { accessorKey: 'keluar', header: 'Keluar' },
  { accessorKey: 'terakhir', header: 'Terakhir' },
]
const kolomGerak: TableColumn<CkMutasi>[] = [
  { accessorKey: 'tanggal', header: 'Tanggal' },
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'arah', header: 'Arah' },
  { accessorKey: 'qty', header: 'Jumlah' },
  { accessorKey: 'sebab', header: 'Sebab' },
  { accessorKey: 'pic', header: 'PIC' },
  { id: 'aksi', header: '' },
]
</script>

<template>
  <AppPage
    :title="info.nama"
    :description="`Stok, mutasi & dashboard ${info.nama}`"
  >
    <p
      v-if="!bisaUbah"
      class="mb-4 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
    >
      Peran Purchasing kamu hanya boleh <b>melihat</b> halaman ini.
    </p>
    <template #actions>
      <AppSeg
        v-model="gudang"
        :options="[
          { value: 'ck', label: 'Central Kitchen', icon: 'i-lucide-chef-hat' },
          { value: 'bar', label: 'Gudang Bar', icon: 'i-lucide-wine' },
        ]"
      />
      <UButton
        v-if="bisaUbah"
        label="Catat mutasi"
        icon="i-lucide-plus"
        @click="bukaTambah"
      />
    </template>

    <AppStatGrid>
      <AppStat
        :label="`Barang ${info.singkat}`"
        :value="String(saldo.length)"
        satuan="barang"
        icon="i-lucide-warehouse"
        tone="info"
      />
      <AppStat
        label="Mutasi tercatat"
        :value="String(gerak.length)"
        satuan="baris"
        icon="i-lucide-arrow-left-right"
        tone="gold"
      />
      <AppStat
        label="Saldo negatif"
        :value="String(saldo.filter(s => s.saldo < 0).length)"
        satuan="barang"
        icon="i-lucide-alert-triangle"
        tone="error"
      />
    </AppStatGrid>

    <AppPanel :title="info.nama">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="[
            { value: 'stok', label: 'Stok', icon: 'i-lucide-box' },
            { value: 'mutasi', label: 'Mutasi', icon: 'i-lucide-arrow-left-right' },
            { value: 'dash', label: 'Dashboard', icon: 'i-lucide-bar-chart-3' },
          ]"
        />
      </template>

      <div v-if="sub === 'stok'">
        <p class="mb-3 text-sm text-muted">
          Angka besar = pack (atau satuan beli terkecil), angka kecil = satuan dasarnya.
        </p>
        <div class="hidden lg:block">
          <UTable
            :columns="kolomStok"
            :data="saldo"
          >
            <template #item-cell="{ row }">
              <div>
                <b class="text-highlighted">{{ row.original.item }}</b>
                <p
                  v-if="tampil(row.original.item, row.original.saldo).ket"
                  class="text-xs text-dimmed"
                >
                  {{ tampil(row.original.item, row.original.saldo).ket }}
                </p>
              </div>
            </template>
            <template #saldo-cell="{ row }">
              <div>
                <b
                  class="num text-base"
                  :class="row.original.saldo < 0 ? 'text-error' : 'text-highlighted'"
                >{{ tampil(row.original.item, row.original.saldo).utama }}</b>
                <p
                  v-if="tampil(row.original.item, row.original.saldo).kecil"
                  class="text-xs text-dimmed"
                >
                  {{ tampil(row.original.item, row.original.saldo).kecil }}
                </p>
              </div>
            </template>
            <template #masuk-cell="{ row }">
              <span class="num">{{ tampil(row.original.item, row.original.masuk).utama }}</span>
            </template>
            <template #keluar-cell="{ row }">
              <span class="num">{{ tampil(row.original.item, row.original.keluar).utama }}</span>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="s in saldo"
            :key="s.item"
            class="flex items-center justify-between gap-3 rounded-xl border border-default p-3"
          >
            <div class="min-w-0">
              <b class="text-highlighted">{{ s.item }}</b>
              <p class="text-sm text-muted">
                Masuk {{ tampil(s.item, s.masuk).utama }} · Keluar {{ tampil(s.item, s.keluar).utama }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <b
                class="num text-lg"
                :class="s.saldo < 0 ? 'text-error' : 'text-highlighted'"
              >{{ tampil(s.item, s.saldo).utama }}</b>
              <p
                v-if="tampil(s.item, s.saldo).kecil"
                class="text-xs text-dimmed"
              >
                {{ tampil(s.item, s.saldo).kecil }}
              </p>
            </div>
          </div>
          <p
            v-if="!saldo.length"
            class="text-sm text-dimmed"
          >
            Belum ada stok {{ info.singkat }}.
          </p>
        </div>
      </div>

      <div v-if="sub === 'mutasi'">
        <div class="hidden lg:block">
          <UTable
            :columns="kolomGerak"
            :data="gerak"
          >
            <template #tanggal-cell="{ row }">
              {{ tglPendek(row.original.tanggal) }}
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ tampil(row.original.item, Number(row.original.qty) || 0).utama }}</span>
            </template>
            <template #arah-cell="{ row }">
              <AppStatus
                :color="row.original.arah === 'masuk' ? 'success' : 'info'"
                size="sm"
              >
                {{ row.original.arah === 'masuk' ? 'Masuk' : 'Keluar' }}
              </AppStatus>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end gap-1">
                <UButton
                  v-if="bisaUbah"
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Ubah mutasi ${row.original.item}`"
                  @click="bukaUbah(row.original)"
                />
                <UButton
                  v-if="bisaUbah"
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  size="sm"
                  color="error"
                  :aria-label="`Hapus mutasi ${row.original.item}`"
                  @click="hapus(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="m in gerak.slice(0, 60)"
            :key="m.id"
            class="rounded-xl border border-default p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <b class="text-highlighted">{{ m.item }}</b>
              <AppStatus
                :color="m.arah === 'masuk' ? 'success' : 'info'"
                size="sm"
              >
                {{ m.arah === 'masuk' ? 'Masuk' : 'Keluar' }}
              </AppStatus>
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ tglPendek(m.tanggal) }} · {{ tampil(m.item, Number(m.qty) || 0).utama }} · {{ m.sebab || '—' }} · {{ m.pic }}
            </p>
          </div>
          <p
            v-if="!gerak.length"
            class="text-sm text-dimmed"
          >
            Belum ada mutasi.
          </p>
        </div>
      </div>

      <div
        v-if="sub === 'dash'"
        class="grid gap-4 lg:grid-cols-2"
      >
        <AppPanel
          bersarang
          title="Sering diambil"
        >
          <div class="flex flex-col gap-2">
            <AppBar
              v-for="b in rekap.sering"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
            />
            <p
              v-if="!rekap.sering.length"
              class="text-sm text-dimmed"
            >
              Belum ada mutasi keluar.
            </p>
          </div>
        </AppPanel>
        <AppPanel
          bersarang
          title="Sering masuk"
        >
          <div class="flex flex-col gap-2">
            <AppBar
              v-for="b in rekap.masukTeratas"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
            />
            <p
              v-if="!rekap.masukTeratas.length"
              class="text-sm text-dimmed"
            >
              Belum ada mutasi masuk.
            </p>
          </div>
        </AppPanel>
        <AppPanel
          bersarang
          title="Aktivitas harian"
          description="Jumlah mutasi per hari"
          class="lg:col-span-2"
        >
          <div class="flex flex-col gap-2">
            <AppBar
              v-for="b in rekap.harian"
              :key="b.label"
              :label="b.label"
              :value="b.value"
              :persen="b.persen"
            />
          </div>
        </AppPanel>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Ubah mutasi' : 'Catat mutasi manual'"
    >
      <div class="flex flex-col gap-3">
        <UFormField :label="`Barang ${info.singkat}`">
          <UInput
            v-model="form.item"
            list="stock-pck-barang"
            placeholder="Ketik nama barang"
            :disabled="!!form.id"
          />
        </UFormField>
        <datalist id="stock-pck-barang">
          <option
            v-for="n in namaCk"
            :key="n"
            :value="n"
          />
        </datalist>
        <UFormField label="Arah">
          <AppPilihan
            v-model="form.arah"
            name="ck-arah"
            :options="[{ value: 'masuk', label: 'Masuk' }, { value: 'keluar', label: 'Keluar' }]"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Jumlah">
            <UInput
              v-model.number="form.qtyInput"
              type="number"
              min="1"
            />
          </UFormField>
          <UFormField label="Satuan">
            <UInput
              v-model="form.unitInput"
              placeholder="Pack"
            />
          </UFormField>
        </div>
        <UFormField label="Sebab">
          <USelect
            v-model="form.sebab"
            :items="SEBAB"
          />
        </UFormField>
        <UFormField label="Tanggal (opsional)">
          <UInput
            v-model="form.tanggal"
            type="date"
          />
        </UFormField>
        <UFormField label="Catatan (opsional)">
          <UInput
            v-model="form.catatan"
            placeholder="Keterangan mutasi"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheet = false"
          />
          <UButton
            v-if="bisaUbah"
            label="Simpan"
            :loading="menyimpan"
            @click="simpan"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
