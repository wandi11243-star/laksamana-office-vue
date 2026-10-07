<!--
  Finance › Kas Kecil › Dashboard Analytics (old `viewAnalytics`, deploy/finance/kas/index.html:4279-4372).

  Where the month's money came from: Marketing/Event (porsi PIC), Walk In
  (cashier revenue MINUS the event deductions), and Self Order which stays OUT
  of the pie because no cashier owns it. Discounts are attributed per cashier;
  the difference against `daily[].discount` is reported, never hidden.
-->
<script setup lang="ts">
import type { BarisHarian } from '~/utils/kompas'
import { kNum, monthKeyOf, netOf } from '~/utils/kompas'
import { omsetKasir, porsiPicKompas, potonganHariKompas } from '~/utils/porsi-pic'
import { getKompasState } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const periode = ref(hariIni().slice(0, 7))
const { data, error } = useAsyncData('kas-analytics', () => getKompasState())

const hari = computed<BarisHarian[]>(() => (data.value?.value.daily ?? []).filter(d => monthKeyOf(d.date) === periode.value))
const kasirList = computed(() => data.value?.value.employees?.kasir ?? [])
const namaKasir = (id: string) => kasirList.value.find(k => k.id === id)?.name ?? id

const src = computed(() => {
  let marketing = 0
  let event = 0
  let walkin = 0
  let self = 0
  for (const d of hari.value) {
    for (const r of d.bd?.marketing ?? []) marketing += porsiPicKompas(r, 'marketing')
    for (const r of d.bd?.event ?? []) event += porsiPicKompas(r, 'event')
    for (const r of d.bd?.kasir ?? []) {
      if (r.off) continue
      walkin += omsetKasir(r) - potonganHariKompas(d, String(r.kasirId))
    }
    self += kNum(d.bd?.self?.amount) - kNum(d.bd?.self?.disc)
  }
  return { marketing, event, walkin, self }
})
const totalSrc = computed(() => src.value.marketing + src.value.event + src.value.walkin || 1)

const byKasir = computed(() => {
  const map = new Map<string, { nama: string, omset: number, disc: number }>()
  for (const d of hari.value) {
    for (const r of d.bd?.kasir ?? []) {
      const id = String(r.kasirId)
      const g = map.get(id) ?? { nama: namaKasir(id), omset: 0, disc: 0 }
      g.omset += omsetKasir(r)
      if (!r.off) g.disc += kNum(r.disc)
      map.set(id, g)
    }
  }
  return [...map.values()].sort((a, b) => b.omset - a.omset)
})
const maxOmset = computed(() => Math.max(1, ...byKasir.value.map(k => k.omset)))
const totDisc = computed(() => byKasir.value.reduce((s, k) => s + k.disc, 0))
const discInput = computed(() => hari.value.reduce((s, d) => s + kNum(d.discount), 0))
const selDisc = computed(() => discInput.value - totDisc.value)

const kompo = computed(() => {
  const food = hari.value.reduce((s, d) => s + kNum(d.food), 0)
  const bev = hari.value.reduce((s, d) => s + kNum(d.bev), 0)
  const lain = hari.value.reduce((s, d) => s + kNum(d.lainnya), 0)
  const t = food + bev + lain || 1
  return [
    { nama: 'Food', nilai: food, persen: (food / t) * 100 },
    { nama: 'Beverage', nilai: bev, persen: (bev / t) * 100 },
    { nama: 'Lainnya', nilai: lain, persen: (lain / t) * 100 },
  ]
})
const realTotal = computed(() => hari.value.reduce((s, d) => s + netOf(d), 0))
</script>

<template>
  <AppPage
    title="Dashboard analytics"
    description="Komposisi & sumber pendapatan."
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
      v-if="!izin.lihat('analytics')"
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
      <div class="grid gap-5 lg:grid-cols-2 lg:items-start">
        <AppPanel
          title="Komposisi pendapatan"
          description="Dari gross bulan ini."
        >
          <AppBar
            v-for="k in kompo"
            :key="k.nama"
            :label="`${k.nama} · ${fmtRp(k.nilai)}`"
            :value="`${k.persen.toFixed(1)}%`"
            :persen="k.persen"
          />
          <p class="mt-2 text-sm text-muted">
            Realisasi net bulan ini: <b class="text-highlighted num">{{ fmtRp(realTotal) }}</b>
          </p>
        </AppPanel>

        <AppPanel
          title="Sumber omset"
          description="Marketing & Event menurut porsi PIC-nya; Walk In = omset kasir sesudah potongan event."
        >
          <AppBar
            label="Marketing"
            :value="fmtRp(src.marketing)"
            :persen="(src.marketing / totalSrc) * 100"
          />
          <AppBar
            label="Event"
            :value="fmtRp(src.event)"
            :persen="(src.event / totalSrc) * 100"
            tone="info"
          />
          <AppBar
            label="Walk In"
            :value="fmtRp(src.walkin)"
            :persen="(src.walkin / totalSrc) * 100"
            tone="success"
          />
          <p class="mt-2 text-sm text-muted">
            <b class="text-highlighted">Self Order</b> — {{ fmtRp(src.self) }} — sengaja di luar pie:
            tidak ada kasir yang melayaninya.
          </p>
        </AppPanel>
      </div>

      <AppPanel
        title="Kontribusi per kasir"
        description="Omset bruto (sebelum diskon) tiap kasir bulan ini."
      >
        <AppBar
          v-for="k in byKasir"
          :key="k.nama"
          :label="k.nama"
          :value="fmtRp(k.omset)"
          :persen="(k.omset / maxOmset) * 100"
        />
        <p
          v-if="!byKasir.length"
          class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
        >
          Belum ada baris kasir bulan ini.
        </p>
      </AppPanel>

      <AppPanel
        title="Diskon diberikan per kasir"
        :description="`Total diskon input ${fmtRp(discInput)} · tercatat per kasir ${fmtRp(totDisc)}${selDisc !== 0 ? ` — selisih ${fmtRp(Math.abs(selDisc))} ${selDisc > 0 ? 'belum ditulis atas nama kasir mana pun' : 'kelebihan atribusi'}` : ' — cocok'}.`"
      >
        <AppBar
          v-for="k in byKasir.filter(x => x.disc > 0)"
          :key="k.nama"
          :label="k.nama"
          :value="fmtRp(k.disc)"
          :persen="totDisc > 0 ? (k.disc / totDisc) * 100 : 0"
          tone="gold"
        />
        <p
          v-if="!byKasir.some(x => x.disc > 0)"
          class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
        >
          Tidak ada diskon yang diatribusikan bulan ini.
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
