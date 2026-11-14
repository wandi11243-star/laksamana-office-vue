<!--
  Stock › Ordering › Check-in Penerimaan (old `deploy/stock/ordering/index.html:176-178,492-646`).

  One card per batch, grouped under its arrival day (old Search PO Code list):
  status, team, "tertunda N hari", items arrived and PIC; "Cek barang datang"
  opens that batch's lines in a sheet and saves only that batch. Date mode 1 Hari / Rentang; PO status filter
  (all/progress/partial/complete) and team filter. Pending POs carry over with
  all their lines, up to CHECKIN_TERTUNDA_MAKS_HARI = 14 days, only when the
  range touches today or later (stock.md F.16). Checking a CK line cuts CK
  stock server-side.

  Central Kitchen requests are checked in HERE too (old `:5710,6103-6110`):
  marking them Datang is what lowers the CK stock, and no other screen can.
  The source filter (Semua / Belanja vendor / Central Kitchen & Gudang Bar)
  judges how a line was requested (its batch), never the kind of goods.
-->
<script setup lang="ts">
import type { OrderStock } from '~/composables/useStock'
import { catatLog, gudangDariBatch, listOrders, patchOrder } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari, tglPanjang, tglPendek } from '~/utils/format'
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
const sumberFilter = ref<'all' | 'belanja' | 'ck'>('all')

const mulai = computed(() => (mode.value === 'hari' ? tanggal.value : dari.value))
const sampai = computed(() => (mode.value === 'hari' ? tanggal.value : ke.value))
// Carry-over window: pending lines up to 14 days before the range start.
const ambilDari = computed(() => tambahHari(mulai.value, -TERTUNDA_MAKS_HARI))

// Also read up to 14 days ahead, only to point at batches on other days when
// the chosen day is empty (the list itself still shows the chosen range).
const ambilSampai = computed(() => {
  const depan = tambahHari(hariIni(), TERTUNDA_MAKS_HARI)
  return sampai.value > depan ? sampai.value : depan
})
const daftarQ = useAsyncData('stock-checkin', () => listOrders({ from: ambilDari.value, to: ambilSampai.value, status: 'Aktif' }), {
  watch: [ambilDari, ambilSampai],
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => daftarQ.data.value?.versions ?? {})

interface Po { kunci: string, nama: string, tgl: string, tim: string, baris: OrderStock[] }
const semuaPo = computed<Po[]>(() => {
  const grup = new Map<string, Po>()
  for (const o of daftarQ.data.value?.rows ?? []) {
    const gd = gudangDariBatch(o.batchName)
    // Gudang Bar requests are taken at once (no check-in); only an old batch
    // still waiting stays here, or nothing could ever finish it (old `:5837-5842`).
    if (gd === 'bar' && o.kedatangan === 'Datang') continue
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
    if (sumberFilter.value !== 'all') {
      const gudang = po.baris.some(b => !!gudangDariBatch(b.batchName))
      if ((sumberFilter.value === 'ck') !== gudang) return false
    }
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

/** Warehouse of a batch card ('' = a shopping batch). */
const gudangPo = (po: Po) => gudangDariBatch(po.baris[0]?.batchName)

/** Arrival days outside the range that still hold batches, nearest first (empty-state shortcut). */
const tanggalLain = computed(() => {
  const m = new Map<string, number>()
  for (const po of semuaPo.value) {
    if (!po.tgl || (po.tgl >= mulai.value && po.tgl <= sampai.value)) continue
    // Past days only when something there still waits; upcoming days always.
    if (po.tgl < hariIni() && po.baris.every(b => (b.kedatangan || '') === 'Datang')) continue
    m.set(po.tgl, (m.get(po.tgl) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([tgl, n]) => ({ tgl, n }))
    .sort((a, b) => Math.abs(+new Date(a.tgl) - +new Date(hariIni())) - Math.abs(+new Date(b.tgl) - +new Date(hariIni())))
    .slice(0, 6)
})
function lompatKe(tgl: string) {
  mode.value = 'hari'
  tanggal.value = tgl
}

const tims = computed(() => [...new Set(semuaPo.value.map(p => p.tim).filter(Boolean))].sort())

// Batches under their arrival day, newest day first (old date headers).
const perHari = computed(() => {
  const m = new Map<string, Po[]>()
  for (const po of poTampil.value) m.set(po.tgl, [...(m.get(po.tgl) ?? []), po])
  return [...m.entries()].map(([tgl, daftar]) => ({ tgl, daftar, item: daftar.reduce((s, p) => s + p.baris.length, 0) }))
})
const jumlahDatang = (po: Po) => po.baris.filter(b => cekDatang(b)).length
/** Days a not-yet-complete batch is past its arrival date (old "Tertunda N hari"). */
function tertunda(po: Po): number {
  if (!po.tgl || po.tgl >= hariIni() || jumlahDatang(po) === po.baris.length) return 0
  return Math.round((+new Date(`${hariIni()}T00:00:00`) - +new Date(`${po.tgl}T00:00:00`)) / 86_400_000)
}
const picPo = (po: Po) => [...new Set(po.baris.map(b => b.pic).filter(Boolean))].join(', ')

// The sheet holding one batch's lines.
const bukaKunci = ref<string | null>(null)
const poBuka = computed(() => semuaPo.value.find(p => p.kunci === bukaKunci.value) ?? null)
const sheetBuka = computed({
  get: () => bukaKunci.value !== null,
  set: (v) => {
    if (!v) bukaKunci.value = null
  },
})
function tandaiSemua(po: Po, on: boolean) {
  for (const o of po.baris) datang.value[o.nomorOrder] = on
}

// Local edits: datang flag + actual note per order number.
const datang = ref<Record<string, boolean>>({})
const aktual = ref<Record<string, string>>({})

function cekDatang(o: OrderStock): boolean {
  return datang.value[o.nomorOrder] ?? (o.kedatangan || '') === 'Datang'
}
function catatan(o: OrderStock): string {
  return aktual.value[o.nomorOrder] ?? o.catatanAktual ?? ''
}

const menyimpan = ref(false)
async function simpan(po?: Po | null) {
  const semua = po ? po.baris : daftarQ.data.value?.rows ?? []
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
    await catatLog([{ modul: 'ordering', aksi: 'checkin', ringkas: `${ok} baris check-in${po ? ` (${po.nama})` : ''}` }])
    // Forget only the saved lines; edits in other batches stay pending.
    const tersimpan = new Set(ubah.map(o => o.nomorOrder))
    datang.value = Object.fromEntries(Object.entries(datang.value).filter(([k]) => !tersimpan.has(k)))
    aktual.value = Object.fromEntries(Object.entries(aktual.value).filter(([k]) => !tersimpan.has(k)))
    await daftarQ.refresh()
    if (po) bukaKunci.value = null
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
    description="Tandai barang yang datang, per batch"
  >
    <AppStatGrid>
      <AppStat
        label="Batch tampil"
        :value="String(poTampil.length)"
        satuan="batch"
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
          label="Tanggal kedatangan"
        >
          <AppTanggal v-model="tanggal" />
        </UFormField>
        <UFormField
          v-if="mode === 'rentang'"
          label="Dari"
        >
          <AppTanggal
            v-model="dari"
            :max="ke"
          />
        </UFormField>
        <UFormField
          v-if="mode === 'rentang'"
          label="Sampai"
        >
          <AppTanggal
            v-model="ke"
            :min="dari"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="poFilter"
            :items="[
              { value: 'all', label: 'Semua status' },
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
        <UFormField label="Sumber">
          <USelect
            v-model="sumberFilter"
            :items="[
              { value: 'all', label: 'Semua sumber' },
              { value: 'belanja', label: 'Belanja vendor' },
              { value: 'ck', label: 'Central Kitchen / Gudang Bar' },
            ]"
          />
        </UFormField>
      </AppFilterGrid>
    </AppPanel>

    <!-- One section per arrival day, one card per batch (old Search PO Code list). -->
    <section
      v-for="h in perHari"
      :key="h.tgl"
      class="mb-6"
    >
      <header class="mb-3 flex items-center justify-between gap-3 rounded-xl bg-shell px-4 py-2.5">
        <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-deep">
          <UIcon
            name="i-lucide-calendar-days"
            class="size-4"
          />
          {{ h.tgl ? tglPanjang(h.tgl) : 'Tanpa tanggal' }}
        </h2>
        <span class="text-xs font-semibold text-muted num">{{ h.daftar.length }} batch, {{ h.item }} item</span>
      </header>

      <div class="grid gap-4 lg:grid-cols-2">
        <article
          v-for="po in h.daftar"
          :key="po.kunci"
          class="flex flex-col overflow-hidden rounded-panel bg-default shadow-panel"
        >
          <div class="flex-1 p-5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <h3 class="min-w-0 text-lg font-bold text-highlighted">
                {{ po.nama }}
              </h3>
              <div class="flex flex-wrap justify-end gap-1.5">
                <AppStatus
                  :color="statusPo(po).color"
                  size="sm"
                >
                  {{ statusPo(po).label }}
                </AppStatus>
                <AppStatus
                  v-if="po.tim"
                  color="vip"
                  icon="i-lucide-users"
                  size="sm"
                >
                  {{ po.tim }}
                </AppStatus>
                <AppStatus
                  v-if="tertunda(po)"
                  color="error"
                  icon="i-lucide-clock-alert"
                  size="sm"
                >
                  Tertunda {{ tertunda(po) }} hari
                </AppStatus>
                <AppStatus
                  v-if="gudangPo(po) === 'ck'"
                  color="success"
                  icon="i-lucide-chef-hat"
                  size="sm"
                >
                  Central Kitchen
                </AppStatus>
                <AppStatus
                  v-if="gudangPo(po) === 'bar'"
                  color="vip"
                  icon="i-lucide-wine"
                  size="sm"
                >
                  Gudang Bar
                </AppStatus>
              </div>
            </div>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <UIcon
                name="i-lucide-calendar"
                class="size-4"
              />
              Rencana datang <b class="text-highlighted">{{ po.tgl ? tglPendek(po.tgl) : '—' }}</b>
            </p>

            <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-default pt-4">
              <div>
                <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Total item
                </dt>
                <dd class="mt-1 text-sm">
                  <b class="text-lg text-highlighted num">{{ po.baris.length }}</b>
                  <span class="text-muted num"> ({{ jumlahDatang(po) }}/{{ po.baris.length }} datang)</span>
                </dd>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-gold transition-[width] duration-500"
                    :style="{ width: `${po.baris.length ? jumlahDatang(po) / po.baris.length * 100 : 0}%` }"
                  />
                </div>
              </div>
              <div class="min-w-0">
                <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">
                  PIC (pemesan)
                </dt>
                <dd class="mt-1 truncate text-sm font-semibold text-highlighted">
                  {{ picPo(po) || '—' }}
                </dd>
              </div>
            </dl>
          </div>
          <UButton
            label="Cek barang datang"
            icon="i-lucide-clipboard-check"
            size="lg"
            class="w-full justify-center rounded-none"
            @click="bukaKunci = po.kunci"
          />
        </article>
      </div>
    </section>
    <div
      v-if="!poTampil.length"
      class="rounded-panel bg-default p-5 text-sm text-muted shadow-panel"
    >
      <p>Tidak ada batch pada tanggal ini.</p>
      <!-- New orders default to tomorrow's arrival, so an empty "today" often
           just means the batches sit on another day: offer those days. -->
      <div
        v-if="tanggalLain.length"
        class="mt-3"
      >
        <p class="mb-2 font-semibold text-highlighted">
          Ada batch di tanggal kedatangan lain:
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="t in tanggalLain"
            :key="t.tgl"
            :label="`${tglPendek(t.tgl)} · ${t.n} batch`"
            icon="i-lucide-calendar"
            color="neutral"
            variant="outline"
            size="sm"
            @click="lompatKe(t.tgl)"
          />
        </div>
      </div>
    </div>

    <ResponsiveSheet
      v-model:open="sheetBuka"
      :title="poBuka?.nama ?? 'Batch'"
      :description="poBuka ? `Rencana datang ${poBuka.tgl ? tglPendek(poBuka.tgl) : '—'} · ${jumlahDatang(poBuka)}/${poBuka.baris.length} datang` : undefined"
    >
      <template v-if="poBuka">
        <p
          v-if="gudangPo(poBuka)"
          class="mb-3 rounded-xl border-l-4 border-success bg-success/10 p-3 text-sm text-success"
        >
          Menandai datang di sini langsung memotong stok {{ gudangPo(poBuka) === 'bar' ? 'Gudang Bar' : 'Central Kitchen' }}.
        </p>
        <div class="mb-3 flex flex-wrap gap-2">
          <UButton
            label="Tandai semua datang"
            icon="i-lucide-check-check"
            size="sm"
            color="neutral"
            variant="soft"
            @click="tandaiSemua(poBuka, true)"
          />
          <UButton
            label="Kosongkan"
            size="sm"
            color="neutral"
            variant="soft"
            @click="tandaiSemua(poBuka, false)"
          />
        </div>
        <ul class="flex flex-col gap-2 rounded-xl border border-default bg-muted p-2">
          <li
            v-for="o in poBuka.baris"
            :key="o.nomorOrder"
            class="flex flex-wrap items-center gap-3 rounded-lg bg-default p-3 shadow-panel"
          >
            <UCheckbox
              :model-value="cekDatang(o)"
              :aria-label="`${o.item} datang`"
              @update:model-value="datang[o.nomorOrder] = Boolean($event)"
            />
            <span class="min-w-0 flex-1">
              <b
                class="block truncate text-sm"
                :class="cekDatang(o) ? 'text-success' : 'text-highlighted'"
              >{{ o.item }}</b>
              <span class="text-xs text-muted">{{ o.pic || '—' }}</span>
            </span>
            <span class="shrink-0 rounded-md bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-deep num">{{ o.qty }} {{ o.unit }}</span>
            <UInput
              :model-value="catatan(o)"
              placeholder="Kosongkan jika pas"
              size="sm"
              class="w-full sm:w-44"
              :aria-label="`Catatan aktual ${o.item}`"
              @update:model-value="aktual[o.nomorOrder] = String($event)"
            />
          </li>
        </ul>
      </template>
      <template #footer>
        <div class="grid w-full grid-cols-2 gap-2">
          <UButton
            label="Tutup"
            color="neutral"
            variant="soft"
            class="justify-center"
            @click="bukaKunci = null"
          />
          <UButton
            label="Simpan check-in"
            icon="i-lucide-check"
            :loading="menyimpan"
            class="justify-center"
            @click="simpan(poBuka)"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
