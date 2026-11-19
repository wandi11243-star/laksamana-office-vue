<!--
  Full purchase-order form (old `poModal`, deploy/bd/index.html:4240-4299).
  Request and PO are the SAME row; purchasing completes it here.

  Vendor (G-02): typed against the Purchasing master (`GET /stock/vendors`,
  open to `bd`), never selected from a dropdown — a PO for a new vendor is
  often written before the vendor is registered. Unknown names stay allowed
  and are marked; a dead master only takes the suggestions away, never the
  form (bd:2417-2445).
-->
<script setup lang="ts">
import type { BdPerson, BdPo, BdProject } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, ubahBd, versiBaris } from '~/composables/useBd'
import { listVendors, type VendorStock } from '~/composables/useStock'
import {
  OWNER_DIVS, PILIHAN_TANPA, PO_FLOW, inDays, opsiProject as opsiProjectBd, orangById, sisaHari,
} from '~/utils/bd-rumus'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import { fTgl } from '~/utils/format'

const props = defineProps<{
  po?: BdPo | null
  projects: BdProject[]
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({
  item: '',
  vendor: '',
  amount: 0,
  qty: 1,
  unit: 'unit',
  needBy: inDays(7),
  div: 'Purchasing',
  pic: '',
  status: 'Draft',
  project: null as string | null,
  note: '',
})
const hapusMau = ref(false)

// Purchasing vendor master (G-02): suggestions only. Null = not loaded yet
// or failed — the form keeps working and says so.
const { data: vendorData } = useAsyncData('bd-vendor-master', async () => {
  try {
    const r = await listVendors()
    return { rows: r.rows, gagal: false as boolean }
  }
  catch {
    return { rows: [] as VendorStock[], gagal: true as boolean }
  }
})
const vendorRows = computed<VendorStock[]>(() => vendorData.value?.rows ?? [])
const vendorGagal = computed(() => vendorData.value?.gagal === true)
const vendorDikenal = computed(() => {
  const t = f.vendor.trim().toLowerCase()
  if (!t) return false
  return vendorRows.value.some(v => String(v.nama || '').trim().toLowerCase() === t)
})

const kru = computed(() => props.people.filter(p => (p.active !== false && !p.tanpaAkses) || p.id === f.pic))
const opsiPic = computed(() => kru.value.map(p => ({ value: p.id, label: p.name })))
const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))
const peminta = computed(() => {
  const p = props.po
  if (!p) return null
  if (p.by && orangById(props.people, p.by).id) return orangById(props.people, p.by).name
  return p.byName || null
})
const sejak = computed(() => {
  const p = props.po
  if (!p || !p.at) return ''
  const n = Math.max(0, -sisaHari(String(p.at).split(' ')[0]))
  return `pada ${fTgl(String(p.at).split(' ')[0])} · ${n} hari lalu`
})

watch(open, (o) => {
  if (!o) return
  const p = props.po
  if (p) {
    f.item = p.item
    f.vendor = p.vendor || ''
    f.amount = Number(p.amount) || 0
    f.qty = Number(p.qty) || 1
    f.unit = p.unit || 'unit'
    f.needBy = p.needBy || ''
    f.div = p.div || 'Purchasing'
    f.pic = p.pic || ''
    f.status = p.status || 'Draft'
    f.project = p.project || null
    f.note = p.note || ''
  }
  else {
    f.item = ''
    f.vendor = ''
    f.amount = 0
    f.qty = 1
    f.unit = 'unit'
    f.needBy = inDays(7)
    f.div = 'Purchasing'
    f.pic = props.aku?.id || props.people[0]?.id || ''
    f.status = 'Draft'
    f.project = null
    f.note = ''
  }
})

async function simpan() {
  if (!f.item.trim()) {
    toast.add({ title: 'Nama item wajib diisi.', color: 'error' })
    return
  }
  const body: Partial<BdPo> = {
    item: f.item.trim(),
    vendor: f.vendor.trim(),
    amount: Number(f.amount) || 0,
    qty: Number(f.qty) || 1,
    unit: f.unit.trim() || 'unit',
    needBy: f.needBy,
    div: f.div,
    pic: f.pic,
    status: f.status,
    project: f.project || null,
    note: f.note.trim(),
  }
  const lama = props.po
  const ok = lama
    ? await bdSimpan(() => ubahBd<BdPo>('purchase-orders', lama.id, { ...body, id: lama.id }, versiBaris(lama)), 'PO diperbarui')
    : await bdSimpan(() => buatBd<BdPo>('purchase-orders', { ...body, prId: null }), 'PO ditambahkan')
  if (ok) open.value = false
}

async function hapus() {
  const lama = props.po
  if (!lama) return
  hapusMau.value = false
  const ok = await bdSimpan(() => hapusBd('purchase-orders', lama.id, versiBaris(lama)), 'PO dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="po ? 'Edit purchase order' : 'Purchase order baru'"
    lebar
  >
    <div class="grid grid-cols-1 gap-4">
      <p
        v-if="peminta"
        class="rounded-panel border border-info/30 bg-info/10 p-3 text-sm"
      >
        Diajukan oleh <b>{{ peminta }}</b> {{ sejak }}
      </p>
      <UFormField label="Item / barang">
        <UInput
          v-model="f.item"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Vendor">
          <UInput
            v-model="f.vendor"
            list="bd-vendor-list"
            autocomplete="off"
            placeholder="Ketik nama vendor…"
            class="w-full"
          />
          <template #hint>
            <span v-if="vendorGagal">Daftar vendor Purchasing belum terbaca — namanya tetap bisa diketik.</span>
            <span v-else-if="!f.vendor.trim()">Ketik namanya — daftarnya dari <b>Purchasing → Database &amp; Vendor</b>.</span>
            <span v-else-if="vendorDikenal">Ada di master Purchasing.</span>
            <span
              v-else
              class="text-warning"
            ><b>{{ f.vendor.trim() }}</b> belum ada di master Purchasing. Tetap bisa disimpan.</span>
          </template>
        </UFormField>
        <UFormField label="Nilai total">
          <UInput
            v-model.number="f.amount"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Qty">
          <UInput
            v-model.number="f.qty"
            type="number"
            min="1"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Satuan">
          <UInput
            v-model="f.unit"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Butuh tgl">
          <AppTanggal
            v-model="f.needBy"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Divisi peminta">
          <USelect
            v-model="f.div"
            :items="OWNER_DIVS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="PIC">
          <USelect
            v-model="f.pic"
            :items="opsiPic"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="f.status"
            :items="PO_FLOW"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Project">
          <USelect
            :model-value="f.project ?? PILIHAN_TANPA"
            :items="opsiProject"
            class="w-full"
            @update:model-value="(v: string | undefined) => { f.project = !v || v === PILIHAN_TANPA ? null : v }"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UInput
            v-model="f.note"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <datalist id="bd-vendor-list">
      <option
        v-for="v in vendorRows"
        :key="v.nama"
        :value="v.nama"
      />
    </datalist>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        loading-auto
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="po"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        @click="hapusMau = true"
      />
    </template>
  </ResponsiveSheet>

  <BdKonfirmasi
    v-model:open="hapusMau"
    title="Hapus purchase order ini?"
    @konfirmasi="hapus"
  />
</template>
