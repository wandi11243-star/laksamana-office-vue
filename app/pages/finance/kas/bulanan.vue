<!--
  Finance › Kas Kecil › Dashboard Omset (old `viewBulanan`, deploy/finance/kas/index.html:4001-4270).

  Realisation and its tagihan (what guests actually owed), the service/tax
  split, Self Order share, the three KPIs (UPT/ATV/APS) and the composition of
  the GROSS — gross so the three slices add up to 100%.
-->
<script setup lang="ts">
import type { BarisHarian } from '~/utils/kompas'
import { avgSpendOf, itemsOf, kNum, monthKeyOf, netOf, tagihanOf } from '~/utils/kompas'
import { getKompasState } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const periode = ref(hariIni().slice(0, 7))
const { data, status, error } = useAsyncData('kas-bulanan', () => getKompasState())

const hari = computed<BarisHarian[]>(() => (data.value?.value.daily ?? [])
  .filter(d => monthKeyOf(d.date) === periode.value)
  .sort((a, b) => (a.date < b.date ? -1 : 1)))
const komp = computed(() => (data.value?.value.compliments ?? []).filter(c => String(c.date).startsWith(periode.value)))

const real = computed(() => hari.value.reduce((s, d) => s + netOf(d), 0))
const realTagihan = computed(() => hari.value.reduce((s, d) => s + tagihanOf(d), 0))
const svcOnly = computed(() => hari.value.reduce((s, d) => s + kNum(d.service_charge), 0))
const taxOnly = computed(() => hari.value.reduce((s, d) => s + kNum(d.tax), 0))
const compBulan = computed(() => komp.value.reduce((s, c) => s + Number(c.nominal || 0), 0))
const disc = computed(() => hari.value.reduce((s, d) => s + kNum(d.discount), 0))
const selfOmset = computed(() => hari.value.reduce((s, d) => s + kNum(d.bd?.self?.amount) - kNum(d.bd?.self?.disc), 0))
const pctSelf = computed(() => (real.value > 0 ? (selfOmset.value / real.value) * 100 : 0))
const gross = computed(() => hari.value.reduce((s, d) => s + kNum(d.food) + kNum(d.bev) + kNum(d.lainnya), 0))
const kompo = computed(() => {
  const food = hari.value.reduce((s, d) => s + kNum(d.food), 0)
  const bev = hari.value.reduce((s, d) => s + kNum(d.bev), 0)
  const lain = hari.value.reduce((s, d) => s + kNum(d.lainnya), 0)
  const t = gross.value || 1
  return [
    { nama: 'Food', nilai: food, persen: (food / t) * 100 },
    { nama: 'Beverage', nilai: bev, persen: (bev / t) * 100 },
    { nama: 'Lainnya', nilai: lain, persen: (lain / t) * 100 },
  ]
})
const bills = computed(() => hari.value.reduce((s, d) => s + kNum(d.bill), 0))
const traffic = computed(() => hari.value.reduce((s, d) => s + kNum(d.traffic), 0))
const items = computed(() => hari.value.reduce((s, d) => s + itemsOf(d), 0))
const upt = computed(() => (bills.value > 0 ? items.value / bills.value : 0))
const atv = computed(() => (bills.value > 0 ? real.value / bills.value : 0))
const aps = computed(() => (bills.value > 0 ? traffic.value / bills.value : 0))
const maxHari = computed(() => Math.max(1, ...hari.value.map(d => netOf(d))))
const tanggalPendek = (t: string) => {
  const d = new Date(`${t}T00:00:00`)
  return Number.isNaN(+d) ? t : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <AppPage
    title="Dashboard omset"
    description="Pencapaian target bulan berjalan."
  >
    <template #actions>
      <UInput
        v-model="periode"
        type="month"
        size="sm"
        class="w-40"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('bulanan')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Realisasi (net)"
          icon="i-lucide-coins"
          :value="fmtRp(real)"
          :sub="`${hari.length} hari tercatat`"
        />
        <AppStat
          label="Realisasi sebagai tagihan"
          icon="i-lucide-receipt"
          :value="fmtRp(realTagihan)"
          sub="net + service + tax"
          tone="info"
        />
        <AppStat
          label="Service + tax"
          icon="i-lucide-landmark"
          :value="fmtRp(svcOnly + taxOnly)"
          :sub="`service ${fmtRp(svcOnly)} · tax ${fmtRp(taxOnly)}`"
        />
        <AppStat
          label="Self order"
          icon="i-lucide-smartphone"
          :value="fmtRp(selfOmset)"
          :sub="`${pctSelf.toFixed(1)}% dari realisasi`"
        />
      </AppStatGrid>

      <AppStatGrid>
        <AppStat
          label="UPT"
          icon="i-lucide-hash"
          :value="upt.toFixed(2)"
          sub="item ÷ bill"
        />
        <AppStat
          label="ATV"
          icon="i-lucide-wallet"
          :value="fmtRp(atv)"
          sub="net ÷ bill"
        />
        <AppStat
          label="APS"
          icon="i-lucide-users"
          :value="aps.toFixed(2)"
          sub="traffic ÷ bill"
        />
        <AppStat
          label="Diskon & compliment"
          icon="i-lucide-gift"
          :value="fmtRp(disc + compBulan)"
          :sub="`diskon ${fmtRp(disc)} · compliment ${fmtRp(compBulan)}`"
        />
      </AppStatGrid>

      <div class="grid gap-5 lg:grid-cols-2 lg:items-start">
        <AppPanel
          title="Rasio komposisi"
          description="Dari GROSS — supaya ketiganya berjumlah 100%."
        >
          <AppBar
            v-for="k in kompo"
            :key="k.nama"
            :label="`${k.nama} · ${fmtRp(k.nilai)}`"
            :value="`${k.persen.toFixed(1)}%`"
            :persen="k.persen"
          />
        </AppPanel>

        <AppPanel
          title="Realisasi per hari"
          description="Satu batang per tanggal tercatat."
        >
          <div class="max-h-80 space-y-1 overflow-y-auto pe-1">
            <AppBar
              v-for="d in hari"
              :key="d.date"
              :label="tanggalPendek(d.date)"
              :value="fmtRp(netOf(d))"
              :persen="(netOf(d) / maxHari) * 100"
            />
          </div>
          <p
            v-if="!hari.length"
            class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
          >
            Belum ada data omset untuk {{ periode }}.
          </p>
        </AppPanel>
      </div>

      <AppPanel
        title="Ringkasan per hari"
        flush
      >
        <table class="hidden w-full text-sm lg:table">
          <thead class="bg-table-head text-table-head-text">
            <tr>
              <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                Tanggal
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Net
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Tagihan
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Bill
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Traffic
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Avg spending
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="d in [...hari].reverse()"
              :key="d.date"
            >
              <td class="px-3 py-2">
                {{ d.date }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(netOf(d)) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(tagihanOf(d)) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ kNum(d.bill) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ kNum(d.traffic) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(avgSpendOf(d)) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="d in [...hari].reverse()"
            :key="d.date"
            class="flex items-center justify-between gap-3 px-4 py-2 text-sm"
          >
            <span>{{ d.date }}</span>
            <span class="num"><b>{{ fmtRp(netOf(d)) }}</b> · {{ kNum(d.bill) }} bill</span>
          </div>
        </div>
        <p
          v-if="status === 'pending'"
          class="px-4 py-4 text-center text-sm text-muted"
        >
          Memuat…
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
