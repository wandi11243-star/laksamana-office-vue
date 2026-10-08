<!--
  Stock › Ordering › Central Kitchen (old `deploy/stock/ordering/index.html:173-175,344-487`).

  Sub-tabs: Stok CK Sekarang / Minta dari CK / Kirim ke CK / Riwayat Kiriman.
  Requests and outlet deliveries share the same `batchOrder` mechanism as the
  shopping form (stock.md F.14); requests always start a new batch
  (`batchName: 'Central Kitchen'`). Big number = pack count, small = base unit.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CkMutasi, CkSaldo, ProdukStock } from '~/composables/useStock'
import { catatLog, ckBalance, ckMovements, createBatch, deliverToCk, getProducts } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari, tglPendek } from '~/utils/format'
import { SATUAN_TERSEDIA, unduhCsvStock } from '~/utils/stock-catat'
import type { Versi } from '~/utils/versi'

definePageMeta({ access: ['ordering'] })

const toast = useToast()
const me = useMe()
const sub = ref<'stok' | 'minta' | 'kirim' | 'riwayat'>('stok')

const produkQ = useAsyncData('stock-ck-produk', getProducts, {
  default: () => ({ rows: [] as ProdukStock[], versions: {} }),
})
const produkCk = computed(() => produkQ.data.value?.rows.filter(p => p.sumber === 'ck' || p.sumber === 'both') ?? [])
const namaCk = computed(() => produkCk.value.map(p => p.nama))
const produkOutlet = computed(() => produkQ.data.value?.rows.filter(p => (p as unknown as Record<string, unknown>).diOutlet) ?? [])

const saldoQ = useAsyncData('stock-ck-saldo', ckBalance, { default: () => ({ rows: [] as CkSaldo[] }) })
const saldo = computed(() => saldoQ.data.value?.rows ?? [])

const gerakQ = useAsyncData('stock-ck-gerak', () => ckMovements(), {
  default: () => ({ rows: [] as CkMutasi[], versions: {} as Record<string, Versi> }),
})
const kiriman = computed(() => gerakQ.data.value?.rows.filter(m => m.sebab === 'kiriman') ?? [])

const kolomStok: TableColumn<CkSaldo>[] = [
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'saldo', header: 'Sisa' },
  { accessorKey: 'masuk', header: 'Masuk' },
  { accessorKey: 'keluar', header: 'Keluar' },
  { accessorKey: 'terakhir', header: 'Terakhir' },
]

interface BarisCk { k: number, item: string, qty: number, unit: string }
let nomor = 0
const barisMinta = ref<BarisCk[]>([{ k: ++nomor, item: '', qty: 1, unit: 'Pack' }])
const barisKirim = ref<BarisCk[]>([{ k: ++nomor, item: '', qty: 1, unit: 'Pack' }])
const tglButuh = ref(tambahHari(hariIni(), 1))
const tglKirim = ref(hariIni())
const mengirim = ref(false)

function tambahBaris(ke: 'minta' | 'kirim') {
  const daftar = ke === 'minta' ? barisMinta : barisKirim
  daftar.value.push({ k: ++nomor, item: '', qty: 1, unit: 'Pack' })
}
function hapusBaris(ke: 'minta' | 'kirim', k: number) {
  const daftar = ke === 'minta' ? barisMinta : barisKirim
  if (daftar.value.length <= 1) {
    toast.add({ title: 'Minimal satu baris', color: 'warning' })
    return
  }
  daftar.value = daftar.value.filter(b => b.k !== k)
}

const sisaOf = (nama: string) => saldo.value.find(s => s.item === nama)?.saldo

async function kirimMinta() {
  const isi = barisMinta.value.filter(b => b.item.trim() && (Number(b.qty) || 0) > 0)
  if (!isi.length) {
    toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu barang.', color: 'warning' })
    return
  }
  mengirim.value = true
  try {
    const r = await createBatch({
      orders: isi.map(b => ({ item: b.item.trim(), qty: Number(b.qty) || 1, unit: b.unit, note: '-', tglDatang: tglButuh.value })),
      batchName: 'Central Kitchen',
    })
    await catatLog([{ modul: 'ordering', aksi: 'ck_minta', ringkas: `${r.created} baris diminta dari CK (${r.batchName})` }])
    barisMinta.value = [{ k: ++nomor, item: '', qty: 1, unit: 'Pack' }]
    toast.add({ title: 'Pengajuan terkirim', description: `${r.created} baris masuk batch Central Kitchen.`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Pengiriman gagal', description: `${apiErrorMessage(e)} Pastikan internet stabil & coba lagi.`, color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}

async function catatKirim() {
  const isi = barisKirim.value.filter(b => b.item.trim() && (Number(b.qty) || 0) > 0)
  if (!isi.length) {
    toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu barang.', color: 'warning' })
    return
  }
  mengirim.value = true
  try {
    for (const b of isi) {
      await deliverToCk({ item: b.item.trim(), qtyInput: Number(b.qty) || 1, unitInput: b.unit, tanggal: tglKirim.value })
    }
    await catatLog([{ modul: 'ordering', aksi: 'ck_kirim', ringkas: `${isi.length} baris dikirim ke CK` }])
    barisKirim.value = [{ k: ++nomor, item: '', qty: 1, unit: 'Pack' }]
    await Promise.all([saldoQ.refresh(), gerakQ.refresh()])
    toast.add({ title: 'Kiriman tercatat', description: 'Stok CK langsung bertambah begitu dicatat di sini.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Pencatatan gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}

const kolomKirim: TableColumn<CkMutasi>[] = [
  { accessorKey: 'tanggal', header: 'Tanggal' },
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'qtyInput', header: 'Jumlah' },
  { accessorKey: 'pic', header: 'Pencatat' },
]

function unduhStok() {
  const sel = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  unduhCsvStock(
    `stok-ck-${hariIni()}.csv`,
    ['Barang,Saldo,Masuk,Keluar,Terakhir', ...saldo.value.map(s => [s.item, String(s.saldo), String(s.masuk), String(s.keluar), s.terakhir ?? ''].map(sel).join(','))].join('\n'),
  )
}
</script>

<template>
  <AppPage
    title="Central Kitchen"
    description="Pengajuan ke Central Kitchen"
  >
    <template #actions>
      <UButton
        label="Segarkan stok"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="saldoQ.refresh(); gerakQ.refresh()"
      />
      <UButton
        label="Unduh stok (CSV)"
        icon="i-lucide-download"
        variant="outline"
        @click="unduhStok"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Barang CK"
        :value="String(saldo.length)"
        satuan="barang"
        icon="i-lucide-warehouse"
        tone="info"
      />
      <AppStat
        label="Saldo negatif"
        :value="String(saldo.filter(s => s.saldo < 0).length)"
        satuan="barang"
        icon="i-lucide-alert-triangle"
        tone="error"
      />
      <AppStat
        label="Kiriman tercatat"
        :value="String(kiriman.length)"
        satuan="baris"
        icon="i-lucide-package"
      />
    </AppStatGrid>

    <AppPanel title="Central Kitchen">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="[
            { value: 'stok', label: 'Stok CK sekarang', icon: 'i-lucide-box' },
            { value: 'minta', label: 'Minta dari CK', icon: 'i-lucide-download' },
            { value: 'kirim', label: 'Kirim ke CK', icon: 'i-lucide-upload' },
            { value: 'riwayat', label: 'Riwayat kiriman', icon: 'i-lucide-receipt' },
          ]"
        />
      </template>

      <div v-if="sub === 'stok'">
        <p class="mb-3 text-sm text-muted">
          Angka besar = jumlah pack, angka kecil = satuan dasarnya.
        </p>
        <div class="hidden lg:block">
          <UTable
            :columns="kolomStok"
            :data="saldo"
          />
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="s in saldo"
            :key="s.item"
            class="flex items-center justify-between rounded-panel border border-default p-3"
          >
            <div>
              <b class="text-highlighted">{{ s.item }}</b>
              <p class="text-sm text-muted">
                Masuk {{ s.masuk }} · Keluar {{ s.keluar }}
              </p>
            </div>
            <b
              class="num text-lg"
              :class="s.saldo < 0 ? 'text-error' : 'text-highlighted'"
            >{{ s.saldo }}</b>
          </div>
          <p
            v-if="!saldo.length"
            class="text-sm text-dimmed"
          >
            Belum ada stok CK.
          </p>
        </div>
      </div>

      <div v-if="sub === 'minta'">
        <AppFilterGrid>
          <UFormField label="PIC pemohon">
            <UInput
              :model-value="me?.name ?? ''"
              disabled
            />
          </UFormField>
          <UFormField label="Tanggal dibutuhkan">
            <UInput
              v-model="tglButuh"
              type="date"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="flex flex-col gap-3">
          <div
            v-for="b in barisMinta"
            :key="b.k"
            class="grid gap-2 rounded-panel border border-default p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <UFormField label="Barang">
              <UInput
                v-model="b.item"
                list="stock-ck-barang"
                placeholder="Ketik nama barang CK"
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
                :items="SATUAN_TERSEDIA"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <span
                v-if="b.item && sisaOf(b.item) !== undefined"
                class="pb-2 text-sm text-muted"
              >Sisa {{ sisaOf(b.item) }}</span>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                aria-label="Hapus baris"
                @click="hapusBaris('minta', b.k)"
              />
            </div>
          </div>
        </div>
        <datalist id="stock-ck-barang">
          <option
            v-for="n in namaCk"
            :key="n"
            :value="n"
          />
        </datalist>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            label="Tambah baris"
            icon="i-lucide-plus"
            variant="outline"
            @click="tambahBaris('minta')"
          />
          <UButton
            label="Kirim pengajuan"
            icon="i-lucide-send"
            :loading="mengirim"
            @click="kirimMinta"
          />
        </div>
      </div>

      <div v-if="sub === 'kirim'">
        <p class="mb-3 text-sm text-muted">
          Stok CK langsung bertambah begitu dicatat di sini. Hanya barang yang juga disimpan di outlet.
        </p>
        <AppFilterGrid>
          <UFormField label="Tanggal kirim">
            <UInput
              v-model="tglKirim"
              type="date"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="flex flex-col gap-3">
          <div
            v-for="b in barisKirim"
            :key="b.k"
            class="grid gap-2 rounded-panel border border-default p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <UFormField label="Barang">
              <UInput
                v-model="b.item"
                list="stock-ck-outlet"
                placeholder="Ketik nama barang"
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
                :items="SATUAN_TERSEDIA"
              />
            </UFormField>
            <div class="flex items-end">
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                aria-label="Hapus baris"
                @click="hapusBaris('kirim', b.k)"
              />
            </div>
          </div>
        </div>
        <datalist id="stock-ck-outlet">
          <option
            v-for="p in produkOutlet"
            :key="p.nama"
            :value="p.nama"
          />
        </datalist>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            label="Tambah item"
            icon="i-lucide-plus"
            variant="outline"
            @click="tambahBaris('kirim')"
          />
          <UButton
            label="Catat kiriman"
            icon="i-lucide-check"
            :loading="mengirim"
            @click="catatKirim"
          />
        </div>
      </div>

      <div v-if="sub === 'riwayat'">
        <div class="hidden lg:block">
          <UTable
            :columns="kolomKirim"
            :data="kiriman"
          />
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="m in kiriman"
            :key="m.id"
            class="rounded-panel border border-default p-3"
          >
            <b class="text-highlighted">{{ m.item }}</b>
            <p class="text-sm text-muted">
              {{ tglPendek(m.tanggal) }} · {{ m.qtyInput }} {{ m.unitInput }} · {{ m.pic }}
            </p>
          </div>
          <p
            v-if="!kiriman.length"
            class="text-sm text-dimmed"
          >
            Belum ada kiriman.
          </p>
        </div>
      </div>
    </AppPanel>
  </AppPage>
</template>
