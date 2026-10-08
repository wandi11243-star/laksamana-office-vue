<!--
  Stock › Ordering › Check-in Penerimaan (old `deploy/stock/ordering/index.html:176-178,492-646`).

  Cards per PO number; date mode 1 Hari / Rentang; PO status filter
  (all/progress/partial/complete) and team filter. Pending POs carry over with
  all their lines, up to CHECKIN_TERTUNDA_MAKS_HARI = 14 days, only when the
  range touches today or later (stock.md F.16). Checking a CK line cuts CK
  stock server-side.
-->
<script setup lang="ts">
import type { OrderStock } from '~/composables/useStock'
import { catatLog, listOrders, patchOrder } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari, tglPendek } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['ordering'] })

const toast = useToast()

/** Pending POs ride along whole, at most this many days back (F.16). */
const TERTUNDA_MAKS_HARI = 14

const mode = ref<'hari' | 'rentang'>('hari')
const tanggal = ref(hariIni())
const dari = ref(tambahHari(hariIni(), -6))
const ke = ref(hariIni())
const poFilter = ref<'all' | 'progress' | 'partial' | 'complete'>('all')
const timFilter = ref('semua')

const mulai = computed(() => (mode.value === 'hari' ? tanggal.value : dari.value))
const sampai = computed(() => (mode.value === 'hari' ? tanggal.value : ke.value))
// Carry-over window: pending lines up to 14 days before the range start.
const ambilDari = computed(() => tambahHari(mulai.value, -TERTUNDA_MAKS_HARI))

const daftarQ = useAsyncData('stock-checkin', () => listOrders({ from: ambilDari.value, to: sampai.value, status: 'Aktif' }), {
  watch: [ambilDari, sampai],
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => daftarQ.data.value?.versions ?? {})

interface Po { kunci: string, nama: string, tgl: string, tim: string, baris: OrderStock[] }
const semuaPo = computed<Po[]>(() => {
  const grup = new Map<string, Po>()
  for (const o of daftarQ.data.value?.rows ?? []) {
    // Central Kitchen requests are checked in from the CK tab, not here.
    if ((o.batchName || '') === 'Central Kitchen') continue
    const kunci = o.batchId || o.nomorOrder
    let po = grup.get(kunci)
    if (!po) {
      po = { kunci, nama: o.batchName || kunci, tgl: o.tglDatang || '', tim: o.tim || '', baris: [] }
      grup.set(kunci, po)
    }
    po.baris.push(o)
  }
  return [...grup.values()].sort((a, b) => (a.tgl < b.tgl ? 1 : -1))
})

// Pending carry-over only when the range touches today or later (F.16).
const rentangMenyentuhDepan = computed(() => sampai.value >= hariIni())
const poTampil = computed(() => {
  const hari = hariIni()
  return semuaPo.value.filter((po) => {
    const dalamRentang = po.tgl >= mulai.value && po.tgl <= sampai.value
    const tertunda = rentangMenyentuhDepan.value
      && (po.tgl || '') >= tambahHari(hari, -TERTUNDA_MAKS_HARI)
      && (po.tgl || '') < mulai.value
      && po.baris.some(b => (b.kedatangan || '') !== 'Datang')
    if (!dalamRentang && !tertunda) return false
    if (timFilter.value !== 'semua' && po.tim !== timFilter.value) return false
    const datang = po.baris.filter(b => (b.kedatangan || '') === 'Datang').length
    const status = datang === 0 ? 'progress' : (datang === po.baris.length ? 'complete' : 'partial')
    return poFilter.value === 'all' || poFilter.value === status
  })
})

const statusPo = (po: Po) => {
  const datang = po.baris.filter(b => (b.kedatangan || '') === 'Datang').length
  if (datang === 0) return { label: 'Belum datang', color: 'warning' as const }
  if (datang === po.baris.length) return { label: 'Lengkap', color: 'success' as const }
  return { label: `Sebagian ${datang}/${po.baris.length}`, color: 'info' as const }
}

const tims = computed(() => [...new Set(semuaPo.value.map(p => p.tim).filter(Boolean))].sort())

// Local edits: datang flag + actual note per order number.
const datang = ref<Record<string, boolean>>({})
const aktual = ref<Record<string, string>>({})
const kotor = computed(() => Object.keys(datang.value).length > 0 || Object.keys(aktual.value).length > 0)

function cekDatang(o: OrderStock): boolean {
  return datang.value[o.nomorOrder] ?? (o.kedatangan || '') === 'Datang'
}
function catatan(o: OrderStock): string {
  return aktual.value[o.nomorOrder] ?? o.catatanAktual ?? ''
}

const menyimpan = ref(false)
async function simpan() {
  const semua = daftarQ.data.value?.rows ?? []
  const ubah = semua.filter(o => o.nomorOrder in datang.value || o.nomorOrder in aktual.value)
  if (!ubah.length) {
    toast.add({ title: 'Tidak ada perubahan', color: 'warning' })
    return
  }
  menyimpan.value = true
  let ok = 0
  try {
    for (const o of ubah) {
      const body: Record<string, unknown> = {
        kedatangan: (datang.value[o.nomorOrder] ?? (o.kedatangan || '') === 'Datang') ? 'Datang' : '',
        catatanAktual: aktual.value[o.nomorOrder] ?? o.catatanAktual ?? '',
      }
      try {
        await patchOrder(o.nomorOrder, body, versi.value[o.nomorOrder])
        ok++
      }
      catch (e) {
        if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) {
          toast.add({ title: `Gagal menyimpan ${o.item}`, description: apiErrorMessage(e), color: 'error' })
        }
      }
    }
    await catatLog([{ modul: 'ordering', aksi: 'checkin', ringkas: `${ok} baris check-in` }])
    datang.value = {}
    aktual.value = {}
    await daftarQ.refresh()
    toast.add({ title: 'Check-in tersimpan', description: `${ok} baris dicatat.`, color: 'success' })
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <AppPage
    title="Check-in Penerimaan"
    description="Tandai barang yang datang, per nomor PO"
  >
    <template #actions>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        :loading="menyimpan"
        :disabled="!kotor"
        @click="simpan"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="PO tampil"
        :value="String(poTampil.length)"
        satuan="PO"
        icon="i-lucide-package"
        tone="info"
      />
      <AppStat
        label="Baris belum datang"
        :value="String(poTampil.flatMap(p => p.baris).filter(b => !cekDatang(b)).length)"
        satuan="baris"
        icon="i-lucide-clock"
        tone="warning"
      />
    </AppStatGrid>

    <AppPanel title="Filter">
      <AppFilterGrid>
        <UFormField label="Mode tanggal">
          <AppSeg
            v-model="mode"
            :options="[{ value: 'hari', label: '1 hari' }, { value: 'rentang', label: 'Rentang' }]"
          />
        </UFormField>
        <UFormField
          v-if="mode === 'hari'"
          label="Tanggal"
        >
          <UInput
            v-model="tanggal"
            type="date"
          />
        </UFormField>
        <UFormField
          v-if="mode === 'rentang'"
          label="Dari"
        >
          <UInput
            v-model="dari"
            type="date"
          />
        </UFormField>
        <UFormField
          v-if="mode === 'rentang'"
          label="Sampai"
        >
          <UInput
            v-model="ke"
            type="date"
          />
        </UFormField>
        <UFormField label="Status PO">
          <USelect
            v-model="poFilter"
            :items="[
              { value: 'all', label: 'Semua' },
              { value: 'progress', label: 'Belum datang' },
              { value: 'partial', label: 'Sebagian' },
              { value: 'complete', label: 'Lengkap' },
            ]"
          />
        </UFormField>
        <UFormField label="Tim">
          <USelect
            v-model="timFilter"
            :items="[{ value: 'semua', label: 'Semua tim' }, ...tims.map(t => ({ value: t, label: t }))]"
          />
        </UFormField>
      </AppFilterGrid>
    </AppPanel>

    <div class="flex flex-col gap-3">
      <AppPanel
        v-for="po in poTampil"
        :key="po.kunci"
        :title="po.nama"
        :description="`Rencana datang ${po.tgl ? tglPendek(po.tgl) : '—'}${po.tim ? ` · ${po.tim}` : ''}`"
      >
        <template #head>
          <AppStatus :color="statusPo(po).color">
            {{ statusPo(po).label }}
          </AppStatus>
        </template>
        <div class="flex flex-col gap-2">
          <label
            v-for="o in po.baris"
            :key="o.nomorOrder"
            class="flex flex-wrap items-center gap-2 rounded-field border border-default p-2"
          >
            <UCheckbox
              :model-value="cekDatang(o)"
              @update:model-value="datang[o.nomorOrder] = Boolean($event)"
            />
            <span class="min-w-0 flex-1">
              <b class="text-highlighted">{{ o.item }}</b>
              <span class="text-sm text-muted"> — {{ o.qty }} {{ o.unit }}</span>
              <span
                v-if="o.pic"
                class="text-sm text-dimmed"
              > · {{ o.pic }}</span>
            </span>
            <UInput
              :model-value="catatan(o)"
              placeholder="Kosongkan jika pas (qty)"
              class="w-40"
              @update:model-value="aktual[o.nomorOrder] = String($event)"
            />
          </label>
        </div>
      </AppPanel>
      <p
        v-if="!poTampil.length"
        class="text-sm text-dimmed"
      >
        Tidak ada PO pada rentang ini.
      </p>
    </div>
  </AppPage>
</template>
