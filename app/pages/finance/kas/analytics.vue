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

/** Kontribusi Marketing / Event: porsi PIC per person, in roster order (old per-divisi bar charts). */
function kontribusi(divi: 'marketing' | 'event') {
  const roster = data.value?.value.employees?.[divi] ?? []
  const nilai = new Map<string, number>()
  for (const d of hari.value) {
    for (const r of d.bd?.[divi] ?? []) {
      const id = String(r.picId ?? '')
      if (id) nilai.set(id, (nilai.get(id) ?? 0) + porsiPicKompas(r, divi))
    }
  }
  return roster.map(e => ({ nama: e.name, omset: nilai.get(String(e.id)) ?? 0 })).filter(x => x.omset > 0)
}
const byMarketing = computed(() => kontribusi('marketing'))
const byEvent = computed(() => kontribusi('event'))
const maxOf = (rows: { omset: number }[]) => Math.max(1, ...rows.map(r => r.omset))
/** Cashiers in roster order, as the old chart drew them. */
const kasirRoster = computed(() => kasirList.value.map(k => byKasir.value.find(x => x.nama === k.name) ?? { nama: k.name, omset: 0, disc: 0 }))
const labelBulan = computed(() => new Date(`${periode.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))
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

      <div class="mt-5 grid items-start gap-5 lg:grid-cols-3">
        <AppPanel
          title="Kontribusi Marketing"
          description="per marketing"
        >
          <AppBar
            v-for="k in byMarketing"
            :key="k.nama"
            :label="k.nama"
            :value="fmtRp(k.omset)"
            :persen="(k.omset / maxOf(byMarketing)) * 100"
            tone="info"
          />
          <p
            v-if="!byMarketing.length"
            class="py-6 text-center text-sm text-muted"
          >
            Belum ada data
          </p>
        </AppPanel>
        <AppPanel
          title="Kontribusi Event"
          description="per PIC event"
        >
          <AppBar
            v-for="k in byEvent"
            :key="k.nama"
            :label="k.nama"
            :value="fmtRp(k.omset)"
            :persen="(k.omset / maxOf(byEvent)) * 100"
            tone="vip"
          />
          <p
            v-if="!byEvent.length"
            class="py-6 text-center text-sm text-muted"
          >
            Belum ada data
          </p>
        </AppPanel>
        <AppPanel
          title="Kontribusi Kasir"
          description="per kasir"
        >
          <AppBar
            v-for="k in kasirRoster"
            :key="k.nama"
            :label="k.nama"
            :value="fmtRp(k.omset)"
            :persen="(k.omset / maxOmset) * 100"
            tone="success"
          />
          <p
            v-if="!kasirRoster.length"
            class="py-6 text-center text-sm text-muted"
          >
            Belum ada baris kasir bulan ini.
          </p>
        </AppPanel>
      </div>

      <AppPanel
        :title="`Self Order — ${labelBulan}`"
        icon="i-lucide-smartphone"
        class="mt-5"
      >
        <template #description>
          Tamu memesan sendiri lewat barcode, tanpa dilayani kasir. Nominalnya <b>bagian dari</b> omset net, bukan tambahan di atasnya —
          jadi persentase di bawah menunjukkan seberapa besar penjualan yang sudah berpindah ke jalur mandiri.
        </template>
        <div class="grid gap-3 sm:grid-cols-3">
          <AppStat
            label="Omset self order"
            :value="fmtRp(src.self)"
            sub="akumulasi periode ini"
            class="bg-primary-50"
          />
          <AppStat
            label="Porsi dari omset net"
            :value="`${(realTotal > 0 ? (src.self / realTotal) * 100 : 0).toFixed(1)}%`"
            :sub="`dari ${fmtRp(realTotal)} omset net`"
          />
          <AppStat
            label="Rata-rata per hari"
            :value="fmtRp(hari.length ? src.self / hari.length : 0)"
            :sub="`${hari.length} hari terinput`"
          />
        </div>
      </AppPanel>

      <AppPanel
        class="mt-5"
        title="Diskon Diberikan per Kasir"
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
          class="rounded-panel bg-muted px-3 py-6 text-center text-sm text-muted"
        >
          Tidak ada diskon yang diatribusikan bulan ini.
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
