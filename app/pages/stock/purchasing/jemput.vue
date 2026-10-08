<!--
  Stock › Purchasing › Jemput Hari Ini (old `deploy/stock/purchasing/index.html:168-169,380-424`).

  Goods with `caraBeli === 'jemput'` that have not been picked up yet.
  Closing one fills `tglJemput`; "Tandai semua" closes the visible list.
-->
<script setup lang="ts">
import type { OrderStock, ProdukStock } from '~/composables/useStock'
import { getProducts, listOrders, patchOrder } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tglPendek } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()

const ordersQ = useAsyncData('stock-jemput', () => listOrders({ status: 'Aktif' }), {
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => ordersQ.data.value?.versions ?? {})
const produkQ = useAsyncData('stock-jemput-produk', getProducts, {
  default: () => ({ rows: [] as ProdukStock[], versions: {} }),
})
const caraBeliOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.caraBeli || ''

const antre = computed(() => (ordersQ.data.value?.rows ?? []).filter(o =>
  caraBeliOf(o.item) === 'jemput' && !(o.tglJemput || '') && (o.status || 'Aktif') === 'Aktif' && !o.terarsip,
))

const menandai = ref(false)
async function tandai(semua: OrderStock[]) {
  if (!semua.length) return
  menandai.value = true
  let ok = 0
  try {
    for (const o of semua) {
      try {
        await patchOrder(o.nomorOrder, { tglJemput: hariIni() }, versi.value[o.nomorOrder])
        ok++
      }
      catch (e) {
        if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) {
          toast.add({ title: `Gagal menandai ${o.item}`, description: apiErrorMessage(e), color: 'error' })
        }
      }
    }
    await ordersQ.refresh()
    toast.add({ title: `${ok} barang ditandai dijemput`, color: 'success' })
  }
  finally {
    menandai.value = false
  }
}
</script>

<template>
  <AppPage
    title="Jemput Hari Ini"
    description="Barang yang dijemput sendiri — belum ada tanggal jemput"
  >
    <template #actions>
      <UButton
        label="Tandai semua"
        icon="i-lucide-check-check"
        :loading="menandai"
        :disabled="!antre.length"
        @click="tandai(antre)"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Menunggu dijemput"
        :value="String(antre.length)"
        satuan="baris"
        icon="i-lucide-car"
        tone="warning"
      />
    </AppStatGrid>

    <AppPanel title="Jemput sendiri">
      <div class="flex flex-col gap-2">
        <div
          v-for="o in antre"
          :key="o.nomorOrder"
          class="flex flex-wrap items-center gap-2 rounded-panel border border-default p-3"
        >
          <div class="min-w-0 flex-1">
            <b class="text-highlighted">{{ o.item }}</b>
            <p class="text-sm text-muted">
              {{ o.qty }} {{ o.unit }} · datang {{ o.tglDatang ? tglPendek(o.tglDatang) : '—' }}{{ o.pic ? ` · ${o.pic}` : '' }}
            </p>
          </div>
          <UButton
            label="Tandai dijemput"
            size="sm"
            icon="i-lucide-check"
            :loading="menandai"
            @click="tandai([o])"
          />
        </div>
        <p
          v-if="!antre.length"
          class="text-sm text-dimmed"
        >
          Tidak ada yang menunggu dijemput.
        </p>
      </div>
    </AppPanel>
  </AppPage>
</template>
