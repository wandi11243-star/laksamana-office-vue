<!--
  Stock › Purchasing › Jemput Hari Ini (old `deploy/stock/purchasing/index.html:168-169,380-424`).

  The pick-up list of one day (old `daftarJemput`, purchasing `:4933-5045`):
  goods bought `caraBeli === 'jemput'`, plus any order given a pickup date
  (`tglJemput`) in Monitor Order because its vendor cannot be picked up the
  same day. A line sits on its pickup date (`tglJemput`, else the arrival
  date) and rides along up to 14 days late until it is marked Datang — the
  same mark as Check-in, so archiving an order never drops it. "Tandai
  dijemput" sets Datang; "Batal" clears it. Requests to Gudang Bar (batch "Gudang Bar",
  old `ordering/index.html:2366`) come from our own store, so they never land
  here (owner request, Nov 2026). Central Kitchen requests have their own
  panel ("Ambil dari Central Kitchen"): ticking one marks it Datang, which
  lowers the CK stock, like the old CK group.
-->
<script setup lang="ts">
import type { OrderStock } from '~/composables/useStock'
import { bolehUbahPurchasing, catatLog, gudangDariBatch, listOrders, patchOrder, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari, tglPendek } from '~/utils/format'
import { warnaKategori } from '~/utils/kategori-warna'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()
// Purchasing `view` role (old PERM_DEFAULT): look, never change — the server refuses too.
const bisaUbah = computed(() => bolehUbahPurchasing('jemput'))

const ordersQ = useAsyncData('stock-jemput', () => listOrders({ status: 'Aktif' }), {
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const produkQ = useProdukStock()
const produkOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)
const katOf = (item: string) => (produkOf(item)?.kategori || '').trim() || 'Lainnya'

/** Late pick-ups ride along at most this many days (old `JEMPUT_TELAT_MAKS_HARI`). */
const TELAT_MAKS_HARI = 14
const tgl = ref(hariIni())
// Every status (archived included) by arrival date up to a month back: a
// scheduled pickup lies on or after its arrival, and archiving means
// "forwarded to the vendor", never "picked up" (old `:4988-5030`).
const jemputQ = useAsyncData('stock-jemput-hari', () => listOrders({ from: tambahHari(tgl.value, -30), to: tgl.value }), {
  watch: [tgl],
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed<Record<string, Versi>>(() => ({ ...(ordersQ.data.value?.versions ?? {}), ...(jemputQ.data.value?.versions ?? {}) }))

/** The day a line is to be picked up: the scheduled date, else the arrival date (old `tglJemputEfektif`). */
const tglEfektif = (o: OrderStock) => (o.tglJemput || o.tglDatang || '').slice(0, 10)
function hariTelat(o: OrderStock): number {
  const d = tglEfektif(o)
  if (!d || d >= tgl.value) return 0
  return Math.round((Date.parse(`${tgl.value}T00:00:00`) - Date.parse(`${d}T00:00:00`)) / 86_400_000)
}
/** Picked up by us: `jemput` goods or a scheduled pickup — never a warehouse request (own panel below). */
const diJemput = (o: OrderStock) =>
  ((produkOf(o.item)?.caraBeli || '') === 'jemput' || !!o.tglJemput)
  && !gudangDariBatch(o.batchName)
/** On this day's list: due that day, or up to 14 days late. */
const dalamHari = (o: OrderStock) => {
  const d = tglEfektif(o)
  return !!d && d <= tgl.value && hariTelat(o) <= TELAT_MAKS_HARI
}

const antre = computed(() => (jemputQ.data.value?.rows ?? [])
  .filter(o => diJemput(o) && dalamHari(o) && (o.kedatangan || '') !== 'Datang')
  .sort((a, b) => tglEfektif(a).localeCompare(tglEfektif(b)) || ((a.rowIndex ?? 0) - (b.rowIndex ?? 0))))
const sudah = computed(() => (jemputQ.data.value?.rows ?? [])
  .filter(o => diJemput(o) && dalamHari(o) && (o.kedatangan || '') === 'Datang')
  .sort((a, b) => ((b.tglTerima || '').localeCompare(a.tglTerima || '')) || ((b.rowIndex ?? 0) - (a.rowIndex ?? 0))))
const sudahHariIni = computed(() => sudah.value.filter(o => (o.tglTerima || '').slice(0, 10) === hariIni()).length)

/**
 * Central Kitchen pick-ups (old JEMPUT_GRUP_CK, `:4919,5131-5135`): requests
 * from the CK form not yet taken. Ticking one marks it Datang — the same
 * door as Check-in — and that is what lowers the CK stock on the server.
 * Judged by the batch (how it was requested), never by the kind of goods.
 */
const ambilCk = computed(() => (ordersQ.data.value?.rows ?? [])
  .filter(o => gudangDariBatch(o.batchName) === 'ck' && (o.kedatangan || '') !== 'Datang' && (o.status || 'Aktif') === 'Aktif' && !o.terarsip)
  .sort((a, b) => (a.tglDatang || '').localeCompare(b.tglDatang || '') || ((a.rowIndex ?? 0) - (b.rowIndex ?? 0))))

async function ambilDariCk(semua: OrderStock[]) {
  if (!semua.length) return
  menandai.value = true
  let ok = 0
  try {
    for (const o of semua) {
      try {
        await patchOrder(o.nomorOrder, { kedatangan: 'Datang', catatanAktual: String(o.qty ?? ''), tglTerima: hariIni() }, versi.value[o.nomorOrder])
        ok++
      }
      catch (e) {
        if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) {
          toast.add({ title: `Gagal menandai ${o.item}`, description: apiErrorMessage(e), color: 'error' })
        }
      }
    }
    await ordersQ.refresh()
    toast.add({ title: `${ok} barang diambil dari Central Kitchen`, description: 'Stok CK langsung berkurang. Check-in Penerimaan ikut tercentang.', color: 'success' })
  }
  finally {
    menandai.value = false
  }
}

const menandai = ref(false)
/**
 * Picked up = Datang (old `jemput_simpan`), the same mark Check-in uses; the
 * scheduled `tglJemput` stays as it was. `batal` clears the mark.
 */
async function tetapkan(semua: OrderStock[], batal = false) {
  if (!semua.length) return
  menandai.value = true
  let ok = 0
  try {
    for (const o of semua) {
      try {
        await patchOrder(o.nomorOrder, batal
          ? { kedatangan: '' }
          : { kedatangan: 'Datang', catatanAktual: String(o.qty ?? ''), tglTerima: hariIni() }, versi.value[o.nomorOrder])
        ok++
      }
      catch (e) {
        if (!(await tanganiKonflik(e, () => jemputQ.refresh()))) {
          toast.add({ title: `Gagal mengubah ${o.item}`, description: apiErrorMessage(e), color: 'error' })
        }
      }
    }
    await catatLog([{ modul: 'purchasing', aksi: batal ? 'jemput_batal' : 'jemput_simpan', ringkas: `${ok} barang ${batal ? 'batal dijemput' : 'selesai dijemput'}` }])
    await jemputQ.refresh()
    toast.add({ title: batal ? `${ok} tanda jemput dibatalkan` : `${ok} barang ditandai dijemput`, description: batal ? undefined : 'Check-in Penerimaan ikut tercentang.', color: 'success' })
  }
  finally {
    menandai.value = false
  }
}
</script>

<template>
  <AppPage
    title="Jemput Hari Ini"
    description="Barang yang dijemput sendiri dari vendor"
  >
    <p
      v-if="!bisaUbah"
      class="mb-4 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
    >
      Peran Purchasing kamu hanya boleh <b>melihat</b> halaman ini.
    </p>
    <template #actions>
      <UButton
        v-if="bisaUbah"
        label="Tandai semua dijemput"
        icon="i-lucide-check-check"
        :loading="menandai"
        :disabled="!antre.length"
        @click="tetapkan(antre)"
      />
    </template>

    <AppFilterGrid class="mb-4">
      <UFormField label="Tanggal jemput">
        <AppTanggal v-model="tgl" />
      </UFormField>
    </AppFilterGrid>

    <AppStatGrid>
      <AppStat
        label="Menunggu dijemput"
        :value="String(antre.length)"
        satuan="barang"
        icon="i-lucide-car"
        tone="warning"
      />
      <AppStat
        label="Dijemput hari ini"
        :value="String(sudahHariIni)"
        satuan="barang"
        icon="i-lucide-package-check"
        tone="success"
      />
    </AppStatGrid>

    <AppPanel
      title="Menunggu dijemput"
      icon="i-lucide-car"
      :count="antre.length"
    >
      <div class="flex flex-col gap-2">
        <div
          v-for="o in antre"
          :key="o.nomorOrder"
          class="grid items-center gap-3 rounded-xl border border-default bg-muted p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <b class="text-highlighted">{{ o.item }}</b>
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-bold"
                :class="warnaKategori(katOf(o.item))"
              >{{ katOf(o.item) }}</span>
            </div>
            <p class="mt-0.5 text-xs text-muted">
              {{ produkOf(o.item)?.utama || 'Tanpa vendor' }} · {{ o.tglJemput ? 'jadwal jemput' : 'datang' }} {{ tglEfektif(o) ? tglPendek(tglEfektif(o)) : '—' }}{{ o.pic ? ` · ${o.pic}` : '' }}
            </p>
            <p
              v-if="hariTelat(o) > 0"
              class="mt-1 inline-flex rounded-md bg-error/10 px-2 py-0.5 text-[11px] font-bold text-error"
            >
              Tertunda {{ hariTelat(o) }} hari
            </p>
          </div>
          <p class="font-display text-2xl font-extrabold leading-none text-gold-deep num sm:text-right">
            {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
          </p>
          <UButton
            v-if="bisaUbah"
            label="Tandai dijemput"
            icon="i-lucide-check"
            size="lg"
            class="w-full justify-center sm:w-auto"
            :loading="menandai"
            @click="tetapkan([o])"
          />
        </div>
        <p
          v-if="!antre.length"
          class="py-2 text-sm text-dimmed"
        >
          Tidak ada yang menunggu dijemput pada tanggal ini.
        </p>
      </div>
    </AppPanel>

    <AppPanel
      title="Ambil dari Central Kitchen"
      icon="i-lucide-chef-hat"
      :count="ambilCk.length"
      description="Permintaan dari menu Central Kitchen. Menandai diambil langsung memotong stok CK."
    >
      <template
        v-if="ambilCk.length"
        #actions
      >
        <UButton
          v-if="bisaUbah"
          label="Tandai semua diambil"
          icon="i-lucide-check-check"
          size="sm"
          variant="soft"
          :loading="menandai"
          @click="ambilDariCk(ambilCk)"
        />
      </template>
      <div class="flex flex-col gap-2">
        <div
          v-for="o in ambilCk"
          :key="o.nomorOrder"
          class="grid items-center gap-3 rounded-xl border border-default bg-muted p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <b class="text-highlighted">{{ o.item }}</b>
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-bold"
                :class="warnaKategori(katOf(o.item))"
              >{{ katOf(o.item) }}</span>
            </div>
            <p class="mt-0.5 text-xs text-muted">
              Dibutuhkan {{ o.tglDatang ? tglPendek(o.tglDatang) : '—' }}{{ o.tim ? ` · ${o.tim}` : '' }}{{ o.pic ? ` · ${o.pic}` : '' }}
            </p>
          </div>
          <p class="font-display text-2xl font-extrabold leading-none text-gold-deep num sm:text-right">
            {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
          </p>
          <UButton
            v-if="bisaUbah"
            label="Tandai diambil"
            icon="i-lucide-check"
            size="lg"
            class="w-full justify-center sm:w-auto"
            :loading="menandai"
            @click="ambilDariCk([o])"
          />
        </div>
        <p
          v-if="!ambilCk.length"
          class="py-2 text-sm text-dimmed"
        >
          Tidak ada permintaan Central Kitchen yang menunggu diambil.
        </p>
      </div>
    </AppPanel>

    <AppPanel
      title="Sudah dijemput"
      icon="i-lucide-package-check"
      :count="sudah.length"
      description="Jemputan tanggal ini dan 14 hari sebelumnya yang sudah ditandai, terbaru di atas."
    >
      <div class="flex flex-col gap-2">
        <div
          v-for="o in sudah"
          :key="o.nomorOrder"
          class="grid items-center gap-3 rounded-xl border border-default bg-muted p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UIcon
                name="i-lucide-circle-check"
                class="size-4 shrink-0 text-success"
              />
              <b class="text-highlighted">{{ o.item }}</b>
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-bold"
                :class="warnaKategori(katOf(o.item))"
              >{{ katOf(o.item) }}</span>
            </div>
            <p class="mt-0.5 text-xs text-muted">
              Dijemput <b class="text-success">{{ o.tglTerima ? tglPendek(o.tglTerima.slice(0, 10)) : '—' }}</b> · {{ produkOf(o.item)?.utama || 'Tanpa vendor' }}{{ o.pic ? ` · ${o.pic}` : '' }}
            </p>
          </div>
          <p class="font-display text-xl font-extrabold leading-none text-highlighted num sm:text-right">
            {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
          </p>
          <UButton
            v-if="bisaUbah"
            label="Batal"
            icon="i-lucide-undo-2"
            color="neutral"
            variant="soft"
            class="w-full justify-center sm:w-auto"
            :loading="menandai"
            @click="tetapkan([o], true)"
          />
        </div>
        <p
          v-if="!sudah.length"
          class="py-2 text-sm text-dimmed"
        >
          Belum ada barang yang ditandai dijemput.
        </p>
      </div>
    </AppPanel>
  </AppPage>
</template>
