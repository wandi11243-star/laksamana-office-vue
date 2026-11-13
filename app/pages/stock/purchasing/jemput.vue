<!--
  Stock › Purchasing › Jemput Hari Ini (old `deploy/stock/purchasing/index.html:168-169,380-424`).

  Goods with `caraBeli === 'jemput'` still to pick up; closing one fills
  `tglJemput`, "Tandai semua" closes the visible list. Below it, what was
  already picked up (newest first) stays visible, with "Batal" to clear a
  mistaken mark (`tglJemput: ''`). Requests to Gudang Bar (batch "Gudang Bar",
  old `ordering/index.html:2366`) come from our own store, so they never land
  here (owner request, Nov 2026). Central Kitchen requests have their own
  panel ("Ambil dari Central Kitchen"): ticking one marks it Datang, which
  lowers the CK stock, like the old CK group.
-->
<script setup lang="ts">
import type { OrderStock } from '~/composables/useStock'
import { gudangDariBatch, listOrders, patchOrder, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tglPendek } from '~/utils/format'
import { warnaKategori } from '~/utils/kategori-warna'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()

const ordersQ = useAsyncData('stock-jemput', () => listOrders({ status: 'Aktif' }), {
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => ordersQ.data.value?.versions ?? {})
const produkQ = useProdukStock()
const produkOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)
const katOf = (item: string) => (produkOf(item)?.kategori || '').trim() || 'Lainnya'

/** Picked up by us from a vendor: `jemput` goods, never a Gudang Bar request. */
const jemputSendiri = (o: OrderStock) =>
  (produkOf(o.item)?.caraBeli || '') === 'jemput'
  && (o.batchName || '') !== 'Gudang Bar'
  && (o.status || 'Aktif') === 'Aktif' && !o.terarsip

const antre = computed(() => (ordersQ.data.value?.rows ?? []).filter(o => jemputSendiri(o) && !(o.tglJemput || '')))
const sudah = computed(() => (ordersQ.data.value?.rows ?? [])
  .filter(o => jemputSendiri(o) && !!(o.tglJemput || ''))
  .sort((a, b) => ((b.tglJemput || '').localeCompare(a.tglJemput || '')) || ((b.rowIndex ?? 0) - (a.rowIndex ?? 0))))
const sudahHariIni = computed(() => sudah.value.filter(o => o.tglJemput === hariIni()).length)

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
async function tetapkan(semua: OrderStock[], tgl: string) {
  if (!semua.length) return
  menandai.value = true
  let ok = 0
  try {
    for (const o of semua) {
      try {
        await patchOrder(o.nomorOrder, { tglJemput: tgl }, versi.value[o.nomorOrder])
        ok++
      }
      catch (e) {
        if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) {
          toast.add({ title: `Gagal mengubah ${o.item}`, description: apiErrorMessage(e), color: 'error' })
        }
      }
    }
    await ordersQ.refresh()
    toast.add({ title: tgl ? `${ok} barang ditandai dijemput` : `${ok} tanda jemput dibatalkan`, color: 'success' })
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
    <template #actions>
      <UButton
        label="Tandai semua dijemput"
        icon="i-lucide-check-check"
        :loading="menandai"
        :disabled="!antre.length"
        @click="tetapkan(antre, hariIni())"
      />
    </template>

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
              {{ produkOf(o.item)?.utama || 'Tanpa vendor' }} · datang {{ o.tglDatang ? tglPendek(o.tglDatang) : '—' }}{{ o.pic ? ` · ${o.pic}` : '' }}
            </p>
          </div>
          <p class="font-display text-2xl font-extrabold leading-none text-gold-deep num sm:text-right">
            {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
          </p>
          <UButton
            label="Tandai dijemput"
            icon="i-lucide-check"
            size="lg"
            class="w-full justify-center sm:w-auto"
            :loading="menandai"
            @click="tetapkan([o], hariIni())"
          />
        </div>
        <p
          v-if="!antre.length"
          class="py-2 text-sm text-dimmed"
        >
          Tidak ada yang menunggu dijemput.
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
      description="Yang sudah ditandai dan belum diarsipkan, terbaru di atas."
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
              Dijemput <b class="text-success">{{ tglPendek(o.tglJemput!) }}</b> · {{ produkOf(o.item)?.utama || 'Tanpa vendor' }}{{ o.pic ? ` · ${o.pic}` : '' }}
            </p>
          </div>
          <p class="font-display text-xl font-extrabold leading-none text-highlighted num sm:text-right">
            {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
          </p>
          <UButton
            label="Batal"
            icon="i-lucide-undo-2"
            color="neutral"
            variant="soft"
            class="w-full justify-center sm:w-auto"
            :loading="menandai"
            @click="tetapkan([o], '')"
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
