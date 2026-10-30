<!--
  Stock › Purchasing › Monitor Order (old `deploy/stock/purchasing/index.html:161-162,283-285`).

  Queue cards per PO number, sub-tabs Per Item / Gabung per Vendor / Arsip
  Selesai. CK requests are excluded here (`pesananCK`: batchName
  'Central Kitchen' or `sumber === 'ck'`, old `:2908-2926`). WA drafts follow
  the old templates (`DEFAULT_TEMPLATE*`, old `:1572-1574`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { OrderStock } from '~/composables/useStock'
import {
  archiveOrders,
  catatLog,
  listOrders,
  useVendorStock,
  patchOrder,
  useProdukStock,
} from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { tglPendek } from '~/utils/format'
import { unduhCsvStock } from '~/utils/stock-catat'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()

const KAFE = 'Laksamana Muda'
const TEMPLATE_ITEM = 'Halo {vendor},\nBerikut orderan resmi dari {cafe}:\n\nINFO PESANAN\n- No. Order: {no_order}\n- Tgl Kedatangan: {tgl_datang}\n- PIC Kitchen: {pic}\n\nRINCIAN BARANG\n- {item} : {qty} {unit}\n- Catatan: {note}\n\nMohon dikonfirmasi ya. Terima kasih!'
const TEMPLATE_GABUNG = 'Halo {vendor},\nBerikut orderan gabungan resmi dari {cafe}:\n\nINFO PESANAN\n- Tgl Kedatangan: {tgl_datang}\n- PIC Kitchen: {pic}\n\nRINCIAN BARANG\n{items_list}\nMohon dikonfirmasi ketersediaan barang dan total tagihannya ya. Terima kasih!'

const sub = ref<'item' | 'vendor' | 'arsip'>('item')
const cari = ref('')
const tglDatang = ref('')
const tim = ref('semua')

const ordersQ = useAsyncData('stock-purch-orders', () => listOrders(), {
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => ordersQ.data.value?.versions ?? {})
const produkQ = useProdukStock()
const vendorQ = useVendorStock()

const sumberOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.sumber
const utamaOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.utama || ''
const waOf = (nama: string) => vendorQ.data.value?.rows.find(v => v.nama === nama)?.whatsapp || ''

/** CK lines never appear in Monitor Order (old `pesananCK`). */
const bukanCk = (o: OrderStock) => (o.batchName || '') !== 'Central Kitchen' && sumberOf(o.item) !== 'ck'
const aktif = computed(() => (ordersQ.data.value?.rows ?? []).filter(o => bukanCk(o) && (o.status || 'Aktif') === 'Aktif' && !o.terarsip))
const arsip = computed(() => (ordersQ.data.value?.rows ?? []).filter(o => bukanCk(o) && ((o.status || '') === 'Arsip' || o.terarsip)))

const saring = (rows: OrderStock[]) => {
  const q = cari.value.trim().toLowerCase()
  return rows.filter(o =>
    (!q || [o.nomorOrder, o.item, o.batchName, utamaOf(o.item)].join(' ').toLowerCase().includes(q))
    && (!tglDatang.value || (o.tglDatang || '') === tglDatang.value)
    && (tim.value === 'semua' || (o.tim || '') === tim.value),
  )
}
const tims = computed(() => [...new Set(aktif.value.map(o => o.tim || '').filter(Boolean))].sort())

interface Po { kunci: string, nama: string, tgl: string, baris: OrderStock[] }
const poItem = computed<Po[]>(() => {
  const grup = new Map<string, Po>()
  for (const o of saring(aktif.value)) {
    const kunci = o.batchId || o.nomorOrder
    let po = grup.get(kunci)
    if (!po) {
      po = { kunci, nama: o.batchName || kunci, tgl: o.tglDatang || '', baris: [] }
      grup.set(kunci, po)
    }
    po.baris.push(o)
  }
  return [...grup.values()].sort((a, b) => (a.tgl < b.tgl ? 1 : -1))
})
const poArsip = computed<Po[]>(() => {
  const grup = new Map<string, Po>()
  for (const o of saring(arsip.value)) {
    const kunci = o.batchId || o.nomorOrder
    let po = grup.get(kunci)
    if (!po) {
      po = { kunci, nama: o.batchName || kunci, tgl: o.tglDatang || '', baris: [] }
      grup.set(kunci, po)
    }
    po.baris.push(o)
  }
  return [...grup.values()]
})
interface GrupVendor { vendor: string, tgl: string, baris: OrderStock[] }
const poVendor = computed<GrupVendor[]>(() => {
  const grup = new Map<string, GrupVendor>()
  for (const o of saring(aktif.value)) {
    const v = utamaOf(o.item) || '(tanpa vendor utama)'
    const kunci = `${v}|${o.tglDatang || ''}`
    let g = grup.get(kunci)
    if (!g) {
      g = { vendor: v, tgl: o.tglDatang || '', baris: [] }
      grup.set(kunci, g)
    }
    g.baris.push(o)
  }
  return [...grup.values()].sort((a, b) => (a.tgl < b.tgl ? 1 : -1))
})

// --- actions --------------------------------------------------------------------
const sibuk = ref(false)
async function segarkan(pesan?: string) {
  await ordersQ.refresh()
  if (pesan) toast.add({ title: pesan, color: 'success' })
}

async function arsipkanBatch(ids: string[], buka: boolean) {
  sibuk.value = true
  try {
    const r = await archiveOrders(ids, buka)
    await catatLog([{ modul: 'purchasing', aksi: buka ? 'buka_arsip' : 'arsip', ringkas: `${r.updated} baris` }])
    await segarkan(buka ? 'Arsip dibuka' : 'Batch diarsipkan')
  }
  catch (e) {
    toast.add({ title: 'Gagal mengarsipkan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const sheetJemput = ref(false)
const jemputNomor = ref('')
const jemputTgl = ref('')
function bukaJemput(o: OrderStock) {
  jemputNomor.value = o.nomorOrder
  jemputTgl.value = o.tglJemput || ''
  sheetJemput.value = true
}
async function simpanJemput() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jemputTgl.value)) {
    toast.add({ title: 'Format tanggal jemput harus YYYY-MM-DD', color: 'error' })
    return
  }
  try {
    await patchOrder(jemputNomor.value, { tglJemput: jemputTgl.value }, versi.value[jemputNomor.value])
    sheetJemput.value = false
    await segarkan('Tanggal jemput tersimpan')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
}

async function tandaiDatang(o: OrderStock) {
  try {
    await patchOrder(o.nomorOrder, { kedatangan: 'Datang' }, versi.value[o.nomorOrder])
    await segarkan('Ditandai datang')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) toast.add({ title: 'Gagal menandai', description: apiErrorMessage(e), color: 'error' })
  }
}

// --- WA drafts --------------------------------------------------------------------
const sheetWa = ref(false)
const waTeks = ref('')
const waLink = ref('')
function drafItem(o: OrderStock, vendor: string) {
  const no = waOf(vendor)
  if (!no) {
    toast.add({ title: 'Pengiriman gagal', description: `Nomor WhatsApp vendor "${vendor}" belum diatur di database.`, color: 'error' })
    return
  }
  const teks = TEMPLATE_ITEM
    .replaceAll('{vendor}', vendor).replaceAll('{cafe}', KAFE)
    .replaceAll('{no_order}', o.nomorOrder).replaceAll('{tgl_datang}', o.tglDatang || '-')
    .replaceAll('{pic}', o.pic || '-').replaceAll('{item}', o.item)
    .replaceAll('{qty}', String(o.qty)).replaceAll('{unit}', o.unit || '')
    .replaceAll('{note}', o.note || '-')
  waTeks.value = teks
  waLink.value = `https://api.whatsapp.com/send?phone=${no}&text=${encodeURIComponent(teks)}`
  sheetWa.value = true
}
function drafGabung(g: GrupVendor) {
  const no = waOf(g.vendor)
  if (!no) {
    toast.add({ title: 'Pengiriman gagal', description: `Nomor WhatsApp vendor "${g.vendor}" belum diatur di database.`, color: 'error' })
    return
  }
  const pics = [...new Set(g.baris.map(o => o.pic).filter(Boolean))].join(', ') || '-'
  const daftar = g.baris.map(o => `- ${o.item} : ${o.qty} ${o.unit || ''}`).join('\n')
  const teks = TEMPLATE_GABUNG
    .replaceAll('{vendor}', g.vendor).replaceAll('{cafe}', KAFE)
    .replaceAll('{tgl_datang}', g.tgl || '-').replaceAll('{pic}', pics)
    .replaceAll('{items_list}', daftar)
  waTeks.value = teks
  waLink.value = `https://api.whatsapp.com/send?phone=${no}&text=${encodeURIComponent(teks)}`
  sheetWa.value = true
}

const vendorPilih = ref<Record<string, string>>({})
const kolomArsip: TableColumn<OrderStock>[] = [
  { accessorKey: 'nomorOrder', header: 'No. order' },
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'qty', header: 'Jumlah' },
  { accessorKey: 'tglDatang', header: 'Datang' },
]

function unduhCsv() {
  const sel = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  const rows = sub.value === 'arsip' ? poArsip.value.flatMap(p => p.baris) : poItem.value.flatMap(p => p.baris)
  unduhCsvStock(
    'monitor-order.csv',
    ['No order,Batch,Barang,Jumlah,Satuan,Tgl datang,Kedatangan,Tim,PIC',
      ...rows.map(o => [o.nomorOrder, o.batchName || '', o.item, String(o.qty), o.unit || '', o.tglDatang || '', o.kedatangan || '', o.tim || '', o.pic || ''].map(sel).join(','))].join('\n'),
  )
}
</script>

<template>
  <AppPage
    title="Monitor Order"
    description="Antrean pesanan bahan baku"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="ordersQ.refresh()"
      />
      <UButton
        label="Unduh CSV"
        icon="i-lucide-download"
        variant="outline"
        @click="unduhCsv"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Antrean aktif"
        :value="String(aktif.length)"
        satuan="baris"
        icon="i-lucide-clipboard-list"
        tone="warning"
      />
      <AppStat
        label="PO terbuka"
        :value="String(poItem.length)"
        satuan="PO"
        icon="i-lucide-package"
        tone="info"
      />
      <AppStat
        label="Arsip selesai"
        :value="String(arsip.length)"
        satuan="baris"
        icon="i-lucide-archive"
        tone="success"
      />
    </AppStatGrid>

    <AppPanel title="Antrean">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="[
            { value: 'item', label: 'Per item', icon: 'i-lucide-list' },
            { value: 'vendor', label: 'Gabung per vendor', icon: 'i-lucide-store' },
            { value: 'arsip', label: 'Arsip selesai', icon: 'i-lucide-archive', badge: arsip.length },
          ]"
        />
      </template>
      <AppFilterGrid>
        <UFormField label="Cari (no. PO / vendor / barang)">
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Ketik…"
          />
        </UFormField>
        <UFormField label="Tanggal datang">
          <UInput
            v-model="tglDatang"
            type="date"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="tim"
            :items="[{ value: 'semua', label: 'Semua' }, ...tims.map(t => ({ value: t, label: t }))]"
          />
        </UFormField>
      </AppFilterGrid>

      <div
        v-if="sub !== 'arsip'"
        class="mt-3 flex flex-col gap-3"
      >
        <AppPanel
          v-for="po in (sub === 'item' ? poItem : [])"
          :key="po.kunci"
          :title="po.nama"
          :description="`Rencana datang ${po.tgl ? tglPendek(po.tgl) : '—'} · ${po.baris.length} baris`"
        >
          <template #head>
            <UButton
              label="Arsipkan"
              icon="i-lucide-archive"
              size="sm"
              variant="outline"
              :loading="sibuk"
              @click="arsipkanBatch(po.baris.map(b => b.nomorOrder), false)"
            />
          </template>
          <div class="flex flex-col gap-2">
            <div
              v-for="o in po.baris"
              :key="o.nomorOrder"
              class="rounded-panel border border-default p-2"
            >
              <div class="flex flex-wrap items-center gap-2">
                <b class="min-w-0 flex-1 text-highlighted">{{ o.item }} <span class="font-normal text-muted">— {{ o.qty }} {{ o.unit }}</span></b>
                <AppStatus
                  v-if="(o.kedatangan || '') === 'Datang'"
                  color="success"
                  size="sm"
                >
                  Datang
                </AppStatus>
                <AppStatus
                  v-else
                  color="warning"
                  size="sm"
                >
                  Menunggu
                </AppStatus>
              </div>
              <p
                v-if="o.tglJemput || o.pic || o.tim"
                class="mt-0.5 text-xs text-muted"
              >
                {{ [o.pic, o.tim, o.tglJemput ? `jemput ${tglPendek(o.tglJemput)}` : ''].filter(Boolean).join(' · ') }}
              </p>
              <div class="mt-2 flex flex-wrap gap-1">
                <USelect
                  v-model="vendorPilih[o.nomorOrder]"
                  :items="(vendorQ.data.value?.rows ?? []).map(v => ({ value: v.nama, label: v.nama }))"
                  :placeholder="utamaOf(o.item) || 'Pilih vendor'"
                  size="sm"
                  class="min-w-32"
                />
                <UButton
                  label="WA"
                  icon="i-lucide-message-circle"
                  size="sm"
                  color="success"
                  variant="soft"
                  @click="drafItem(o, vendorPilih[o.nomorOrder] || utamaOf(o.item))"
                />
                <UButton
                  label="Tgl jemput"
                  size="sm"
                  variant="outline"
                  @click="bukaJemput(o)"
                />
                <UButton
                  v-if="(o.kedatangan || '') !== 'Datang'"
                  label="Tandai datang"
                  size="sm"
                  variant="outline"
                  @click="tandaiDatang(o)"
                />
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          v-for="g in (sub === 'vendor' ? poVendor : [])"
          :key="`${g.vendor}|${g.tgl}`"
          :title="g.vendor"
          :description="`${g.tgl ? `Datang ${tglPendek(g.tgl)} · ` : ''}${g.baris.length} baris`"
        >
          <template #head>
            <UButton
              label="WA gabungan"
              icon="i-lucide-message-circle"
              size="sm"
              color="success"
              variant="soft"
              @click="drafGabung(g)"
            />
          </template>
          <ul class="flex flex-col gap-1 text-sm">
            <li
              v-for="o in g.baris"
              :key="o.nomorOrder"
              class="flex justify-between gap-2"
            >
              <span class="text-default">{{ o.item }} <span class="text-muted">({{ o.pic }})</span></span>
              <b class="num text-highlighted">{{ o.qty }} {{ o.unit }}</b>
            </li>
          </ul>
        </AppPanel>
        <p
          v-if="sub === 'item' && !poItem.length"
          class="text-sm text-dimmed"
        >
          Antrean kosong.
        </p>
        <p
          v-if="sub === 'vendor' && !poVendor.length"
          class="text-sm text-dimmed"
        >
          Antrean kosong.
        </p>
      </div>

      <div
        v-else
        class="mt-3"
      >
        <div class="hidden lg:block">
          <UTable
            :columns="kolomArsip"
            :data="poArsip.flatMap(p => p.baris)"
          />
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="o in poArsip.flatMap(p => p.baris).slice(0, 60)"
            :key="o.nomorOrder"
            class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
          >
            <div>
              <b class="text-highlighted">{{ o.item }}</b>
              <p class="text-sm text-muted">
                {{ o.nomorOrder }} · {{ o.qty }} {{ o.unit }}
              </p>
            </div>
            <UButton
              label="Buka arsip"
              size="sm"
              variant="outline"
              @click="arsipkanBatch([o.nomorOrder], true)"
            />
          </div>
        </div>
        <div class="mt-2 hidden lg:block">
          <UButton
            v-for="p in poArsip"
            :key="p.kunci"
            :label="`Buka arsip “${p.nama}”`"
            size="sm"
            variant="outline"
            class="mr-2 mt-2"
            @click="arsipkanBatch(p.baris.map(b => b.nomorOrder), true)"
          />
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetJemput"
      title="Tanggal jemput"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Tanggal jemput (YYYY-MM-DD)">
          <UInput
            v-model="jemputTgl"
            type="date"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheetJemput = false"
          />
          <UButton
            label="Simpan"
            @click="simpanJemput"
          />
        </div>
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetWa"
      title="Draf chat vendor"
    >
      <p class="whitespace-pre-wrap text-sm text-default">
        {{ waTeks }}
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <UButton
          label="Tutup"
          variant="outline"
          @click="sheetWa = false"
        />
        <UButton
          label="Buka WhatsApp"
          icon="i-lucide-message-circle"
          color="success"
          :href="waLink"
          target="_blank"
          rel="noopener"
        />
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
