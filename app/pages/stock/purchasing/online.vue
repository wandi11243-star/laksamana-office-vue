<!--
  Stock › Purchasing › Barang Online (old `deploy/stock/purchasing/index.html:181-182,425-483`).

  Admin-only in practice: the old `PERM_DEFAULT` has no `online` entry, so
  non-admins never see it (T-16). Goods with `caraBeli === 'online'`;
  "Tandai semua" marks the visible list arrived (`tglTerima` + `catatanTerima`).
-->
<script setup lang="ts">
import type { OrderStock, ProdukStock } from '~/composables/useStock'
import { getProducts, listOrders, patchOrder } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tglPendek } from '~/utils/format'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()

const ordersQ = useAsyncData('stock-online', () => listOrders({ status: 'Aktif' }), {
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => ordersQ.data.value?.versions ?? {})
const produkQ = useAsyncData('stock-online-produk', getProducts, {
  default: () => ({ rows: [] as ProdukStock[], versions: {} }),
})
const caraBeliOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.caraBeli || ''

const sub = ref<'tunggu' | 'riwayat'>('tunggu')
const menunggu = computed(() => (ordersQ.data.value?.rows ?? []).filter(o =>
  caraBeliOf(o.item) === 'online' && (o.kedatangan || '') !== 'Datang' && (o.status || 'Aktif') === 'Aktif' && !o.terarsip,
))
const riwayat = computed(() => (ordersQ.data.value?.rows ?? []).filter(o =>
  caraBeliOf(o.item) === 'online' && (o.kedatangan || '') === 'Datang',
))

const sheet = ref(false)
const target = ref<OrderStock[]>([])
const catatan = ref('')
function bukaTandai(semua: OrderStock[]) {
  if (!semua.length) return
  target.value = semua
  catatan.value = ''
  sheet.value = true
}

const menandai = ref(false)
async function tandai() {
  menandai.value = true
  let ok = 0
  try {
    for (const o of target.value) {
      try {
        await patchOrder(
          o.nomorOrder,
          { kedatangan: 'Datang', tglTerima: hariIni(), catatanTerima: catatan.value.slice(0, 300) },
          versi.value[o.nomorOrder],
        )
        ok++
      }
      catch (e) {
        if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) {
          toast.add({ title: `Gagal menandai ${o.item}`, description: apiErrorMessage(e), color: 'error' })
        }
      }
    }
    sheet.value = false
    await ordersQ.refresh()
    toast.add({ title: `${ok} barang ditandai datang`, color: 'success' })
  }
  finally {
    menandai.value = false
  }
}
</script>

<template>
  <AppPage
    title="Barang Online"
    description="Pesanan daring — yang belum datang & riwayatnya"
  >
    <template #actions>
      <UButton
        label="Tandai semua"
        icon="i-lucide-check-check"
        :disabled="!menunggu.length"
        @click="bukaTandai(menunggu)"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Belum datang"
        :value="String(menunggu.length)"
        satuan="baris"
        icon="i-lucide-globe"
        tone="warning"
      />
      <AppStat
        label="Sudah datang"
        :value="String(riwayat.length)"
        satuan="baris"
        icon="i-lucide-package-check"
        tone="success"
      />
    </AppStatGrid>

    <AppPanel title="Barang online">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="[
            { value: 'tunggu', label: 'Belum datang', badge: menunggu.length },
            { value: 'riwayat', label: 'Riwayat' },
          ]"
        />
      </template>
      <div class="flex flex-col gap-2">
        <div
          v-for="o in (sub === 'tunggu' ? menunggu : riwayat)"
          :key="o.nomorOrder"
          class="flex flex-wrap items-center gap-2 rounded-panel border border-default p-3"
        >
          <div class="min-w-0 flex-1">
            <b class="text-highlighted">{{ o.item }}</b>
            <p class="text-sm text-muted">
              {{ o.qty }} {{ o.unit }} · datang {{ o.tglDatang ? tglPendek(o.tglDatang) : '—' }}{{
                sub === 'riwayat' && o.tglTerima ? ` · diterima ${tglPendek(o.tglTerima)}` : ''
              }}{{ o.catatanTerima ? ` · ${o.catatanTerima}` : '' }}
            </p>
          </div>
          <UButton
            v-if="sub === 'tunggu'"
            label="Tandai datang"
            size="sm"
            icon="i-lucide-check"
            @click="bukaTandai([o])"
          />
        </div>
        <p
          v-if="!(sub === 'tunggu' ? menunggu : riwayat).length"
          class="text-sm text-dimmed"
        >
          Tidak ada barang di sini.
        </p>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      title="Tandai datang"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-default">
          {{ target.length }} barang ditandai datang hari ini.
        </p>
        <UFormField label="Catatan terima (opsional, maks 300)">
          <UInput
            v-model="catatan"
            maxlength="300"
            placeholder="Mis. paket lengkap, dus penyok"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheet = false"
          />
          <UButton
            label="Tandai datang"
            :loading="menandai"
            @click="tandai"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
