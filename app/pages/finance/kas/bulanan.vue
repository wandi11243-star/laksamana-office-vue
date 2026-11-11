<!--
  Finance › Kas Kecil › Dashboard Omset (old `viewBulanan` + `waDashboardOmset`, deploy/finance/kas/index.html:3867-4210).

  Layout as the old screen: Harian/Bulanan switch, the "Laporan" panel (Kirim
  WhatsApp / Simpan PDF), Realisasi + Rata-rata per hari, the info strip saying
  Realisasi is TAGIHAN, Rasio Komposisi (three cards), Tax & Service / Discount,
  Self Order / Lewat Kasir, UPT / ATV / APS, the daily chart, twelve total cards
  and the daily table.

  Two omset numbers live here on purpose: TAGIHAN (net + service + tax, what the
  guest paid — same as Dibayar Tamu in Rekap Penjualan) on the top cards, and NET
  for Rasio Komposisi, ATV and the Self Order share. The info strip says so.
  Rasio Komposisi divides by Food + Beverage + Lainnya (gross), so the three
  always add to 100% even with discounts.

  The old line + bar charts (Chart.js) are one AppBar list here (DESIGN.md
  "Analitik"); the PDF is the browser print dialog (the app chrome is print:hidden).
-->
<script setup lang="ts">
import type { BarisHarian } from '~/utils/kompas'
import { itemsOf, kNum, monthKeyOf, netOf, tagihanOf, taxSvcOf } from '~/utils/kompas'
import { useKompasState } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni, tglLabel } from '~/utils/format'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const mode = ref<'hari' | 'bulan'>('bulan')
const periode = ref(hariIni().slice(0, 7))
const tanggal = ref(hariIni())
const { data, status, error } = useKompasState()

const semuaHari = computed<BarisHarian[]>(() => (data.value?.value.daily ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1)))
const harian = computed(() => mode.value === 'hari')
/** `rentangAktif`: one day in Harian, the month in Bulanan. */
const hari = computed(() => semuaHari.value.filter(d => (harian.value ? d.date === tanggal.value : monthKeyOf(d.date) === periode.value)))
const labelBulan = (mk: string) => new Date(`${mk}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
const labelRentang = computed(() => (harian.value ? tglLabel(tanggal.value) : labelBulan(periode.value)))

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)
const angka = (n: number) => n.toLocaleString('id-ID')
const desimal = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const r = computed(() => {
  const days = hari.value
  const real = days.reduce((s, d) => s + netOf(d), 0)
  const realTagihan = days.reduce((s, d) => s + tagihanOf(d), 0)
  const tax = days.reduce((s, d) => s + taxSvcOf(d), 0)
  const svcOnly = days.reduce((s, d) => s + kNum(d.service_charge), 0)
  const taxOnly = days.reduce((s, d) => s + kNum(d.tax), 0)
  const disc = days.reduce((s, d) => s + kNum(d.discount), 0)
  const self = days.reduce((s, d) => s + kNum(d.bd?.self?.amount) - kNum(d.bd?.self?.disc), 0)
  const kompHari = new Set(days.map(d => d.date))
  const compBulan = (data.value?.value.compliments ?? []).filter(c => kompHari.has(String(c.date))).reduce((s, c) => s + Number(c.nominal || 0), 0)
  const T = { food: 0, bev: 0, lainnya: 0, traffic: 0, bill: 0, qfood: 0, qbev: 0, qothers: 0 }
  for (const d of days) {
    T.food += kNum(d.food)
    T.bev += kNum(d.bev)
    T.lainnya += kNum(d.lainnya)
    T.traffic += kNum(d.traffic)
    T.bill += kNum(d.bill)
    T.qfood += kNum(d.qty_food)
    T.qbev += kNum(d.qty_bev)
    T.qothers += kNum(d.qty_others)
  }
  const totalItem = days.reduce((s, d) => s + itemsOf(d), 0)
  const kompo = T.food + T.bev + T.lainnya
  return {
    real, realTagihan, tax, svcOnly, taxOnly, disc, self, compBulan, T, totalItem, kompo,
    selfPct: pct(self, real),
    upt: T.bill > 0 ? totalItem / T.bill : 0,
    atv: T.bill > 0 ? real / T.bill : 0,
    aps: T.bill > 0 ? T.traffic / T.bill : 0,
    rFood: pct(T.food, kompo),
    rBev: pct(T.bev, kompo),
    rLain: pct(T.lainnya, kompo),
  }
})
/** The month around the chosen day — only the WhatsApp report uses it in Harian (old `bulan`). */
const bulanBerjalan = computed(() => {
  const key = harian.value ? monthKeyOf(tanggal.value) : periode.value
  const days = semuaHari.value.filter(d => monthKeyOf(d.date) === key)
  return { label: labelBulan(key), real: days.reduce((s, d) => s + netOf(d), 0), tagihan: days.reduce((s, d) => s + tagihanOf(d), 0), hari: days.length }
})
const maxHari = computed(() => Math.max(1, ...hari.value.map(d => netOf(d))))
const labelHari = (t: string) => {
  const d = new Date(`${t}T00:00:00`)
  return `${t.slice(8)} ${d.toLocaleDateString('id-ID', { weekday: 'short' })}`
}

const cetak = () => window.print()

function kirimWhatsApp() {
  const x = r.value
  const b = bulanBerjalan.value
  const n = hari.value.length
  const t = [
    `*DASHBOARD OMSET — ${labelRentang.value.toUpperCase()}*`,
    `_Laksamana Muda · ${harian.value ? 'laporan harian' : `${n} hari terinput`}_`,
    '',
    `💰 Omset ${harian.value ? 'Harian ' : 'Bulanan'}  : ${fmtRp(x.realTagihan)}`,
    `   _(net ${fmtRp(x.real)} + tax & service ${fmtRp(x.tax)})_`,
    `📅 Hari terinput  : ${n} hari`,
    `📊 Rata per hari  : ${fmtRp(n ? x.realTagihan / n : 0)}`,
    '',
    ...(harian.value
      ? [
          `*Bulan Berjalan — ${b.label}*`,
          `💰 Realisasi      : ${fmtRp(b.tagihan)} (${b.hari} hari)`,
          `   _(net ${fmtRp(b.real)})_`,
          `📈 Rata per hari  : ${fmtRp(b.hari ? b.tagihan / b.hari : 0)}`,
          '',
        ]
      : []),
    '*Komposisi & Rasio*',
    `• Food     : ${fmtRp(x.T.food)} (${x.rFood.toFixed(1)}%)`,
    `• Beverage : ${fmtRp(x.T.bev)} (${x.rBev.toFixed(1)}%)`,
    `• Lainnya  : ${fmtRp(x.T.lainnya)} (${x.rLain.toFixed(1)}%)`,
    `_Rasio dihitung dari Food+Bev+Lainnya ${fmtRp(x.kompo)}, sebelum diskon._`,
    '',
    '*Jumlah Item Terjual (Qty)*',
    `• Qty Food     : ${angka(x.T.qfood)}`,
    `• Qty Beverage : ${angka(x.T.qbev)}`,
    `• Qty Lainnya  : ${angka(x.T.qothers)}`,
    `• Total Item   : ${angka(x.totalItem)}`,
    '',
    '*Jalur Pemesanan*',
    `📱 Self Order  : ${fmtRp(x.self)} (${x.selfPct.toFixed(1)}%)`,
    `🧑‍💼 Lewat Kasir : ${fmtRp(x.real - x.self)}`,
    '',
    '*Indikator*',
    `• UPT : ${desimal(x.upt)}`,
    `• ATV : ${fmtRp(x.atv)}`,
    `• APS : ${desimal(x.aps)}`,
    `• Total Bill    : ${angka(x.T.bill)}`,
    `• Total Traffic : ${angka(x.T.traffic)}`,
    '',
    `🏷️ Discount   : ${fmtRp(x.disc)}`,
    `🎁 Compliment : ${fmtRp(x.compBulan)}`,
    `💳 Tax & Service : ${fmtRp(x.tax)}`,
    '',
    harian.value ? '' : '_Rincian harian ada di laporan PDF._',
  ].join('\n').trim()
  window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener')
}
</script>

<template>
  <AppPage
    title="Dashboard omset"
    description="Pencapaian target bulan berjalan."
  >
    <template #actions>
      <AppSeg
        v-model="mode"
        size="sm"
        :options="[{ value: 'hari', label: 'Harian' }, { value: 'bulan', label: 'Bulanan' }]"
        class="print:hidden"
      />
      <UInput
        v-if="harian"
        v-model="tanggal"
        type="date"
        size="sm"
        class="w-40 print:hidden"
      />
      <UInput
        v-else
        v-model="periode"
        type="month"
        size="sm"
        class="w-40 print:hidden"
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
    <div
      v-else-if="status === 'pending' && !data"
      class="space-y-2"
    >
      <!-- Loading rows mirror the monthly report below. -->
      <USkeleton class="h-20 rounded-xl" />
      <USkeleton
        v-for="i in 4"
        :key="i"
        class="h-10 w-full"
      />
      <p class="pt-1 text-sm text-muted">
        Memuat…
      </p>
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <AppPanel
        :title="`Laporan ${labelRentang}`"
        description="Simpan sebagai PDF, atau kirim ringkasannya lewat WhatsApp"
      >
        <template #actions>
          <div class="flex gap-2 print:hidden">
            <UButton
              label="Kirim WhatsApp"
              icon="i-lucide-message-circle"
              color="neutral"
              variant="outline"
              size="sm"
              @click="kirimWhatsApp"
            />
            <UButton
              label="Simpan PDF"
              icon="i-lucide-file-down"
              size="sm"
              @click="cetak"
            />
          </div>
        </template>
      </AppPanel>

      <div class="grid gap-3 sm:grid-cols-2">
        <AppStat
          :label="harian ? 'Realisasi hari ini' : 'Realisasi bulan ini'"
          icon="i-lucide-coins"
          :value="fmtRp(r.realTagihan)"
          class="bg-primary-50"
        >
          <template v-if="harian">
            {{ hari.length ? 'data hari ini sudah diinput' : 'belum ada data hari ini' }}
          </template>
          <template v-else>
            {{ hari.length }} hari terinput
          </template>
        </AppStat>
        <AppStat
          label="Rata-rata per hari"
          icon="i-lucide-trending-up"
          :value="fmtRp(hari.length ? r.realTagihan / hari.length : 0)"
          :sub="`dari ${hari.length} hari terinput`"
        />
      </div>

      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
      >
        <template #description>
          <b>Angka Realisasi di atas adalah TAGIHAN</b> — sudah termasuk service charge dan pajak (PB 1), jadi sama persis dengan
          <b>Dibayar Tamu</b> di Rekap Penjualan. Omset <b>net</b>-nya {{ fmtRp(r.real) }} (tagihan − tax &amp; service {{ fmtRp(r.tax) }}),
          dan angka net itulah yang dipakai Rasio Komposisi, Average Transaction Value, serta persentase Self Order di bawah.
        </template>
      </UAlert>

      <AppPanel
        title="Rasio Komposisi Omset"
        icon="i-lucide-utensils"
        :description="`Porsi tiap komponen terhadap Food + Beverage + Lainnya (${fmtRp(r.kompo)}) — bukan terhadap omset net, supaya ketiganya selalu tepat 100% walau ada diskon.`"
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <AppStat
            label="Rasio food"
            :value="`${r.rFood.toFixed(1)}%`"
            :sub="fmtRp(r.T.food)"
            class="bg-primary-50"
          />
          <AppStat
            label="Rasio beverage"
            :value="`${r.rBev.toFixed(1)}%`"
            :sub="fmtRp(r.T.bev)"
            tone="info"
            class="bg-info/8"
          />
          <AppStat
            label="Rasio lainnya"
            :value="`${r.rLain.toFixed(1)}%`"
            :sub="fmtRp(r.T.lainnya)"
          />
        </div>
      </AppPanel>

      <div class="grid gap-3 sm:grid-cols-2">
        <AppStat
          label="Tax & service bulanan"
          icon="i-lucide-landmark"
          :value="fmtRp(r.tax)"
          sub="di luar omset, akumulasi harian"
          tone="warning"
          class="bg-warning/8"
        />
        <AppStat
          label="Total discount bulanan"
          icon="i-lucide-tag"
          :value="fmtRp(r.disc)"
          sub="total potongan diberikan"
          tone="error"
          class="bg-error/6"
        />
        <AppStat
          label="Omset self order"
          icon="i-lucide-smartphone"
          :value="fmtRp(r.self)"
          :sub="`tamu order sendiri lewat barcode · ${r.selfPct.toFixed(1)}% dari omset net`"
          class="bg-primary-50"
        />
        <AppStat
          label="Omset lewat kasir"
          icon="i-lucide-user-round"
          :value="fmtRp(r.real - r.self)"
          :sub="`sisanya, dilayani kasir · ${pct(r.real - r.self, r.real).toFixed(1)}% dari omset net`"
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <AppStat
          label="Unit per transaction (UPT)"
          icon="i-lucide-receipt"
          :value="desimal(r.upt)"
          :sub="`${angka(r.totalItem)} item ÷ ${angka(r.T.bill)} bill`"
          tone="info"
          class="bg-info/8"
        />
        <AppStat
          label="Average transaction value (ATV)"
          icon="i-lucide-credit-card"
          :value="fmtRp(r.atv)"
          sub="total sales ÷ total bill"
          tone="info"
          class="bg-info/8"
        />
        <AppStat
          label="Average party size (APS)"
          icon="i-lucide-users"
          :value="desimal(r.aps)"
          :sub="`${angka(r.T.traffic)} traffic ÷ ${angka(r.T.bill)} bill`"
          tone="info"
          class="bg-info/8"
        />
      </div>

      <AppPanel
        title="Omset Harian"
        description="Realisasi net per hari"
      >
        <p
          v-if="!hari.length"
          class="py-6 text-center text-sm text-muted"
        >
          Belum ada data.
        </p>
        <div
          v-else
          class="space-y-2.5"
        >
          <AppBar
            v-for="d in hari"
            :key="d.date"
            :label="labelHari(d.date)"
            :value="fmtRp(netOf(d))"
            :persen="(netOf(d) / maxHari) * 100"
          />
        </div>
      </AppPanel>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AppStat
          label="Total food"
          :value="fmtRp(r.T.food)"
        />
        <AppStat
          label="Total beverage"
          :value="fmtRp(r.T.bev)"
        />
        <AppStat
          label="Total lainnya"
          :value="fmtRp(r.T.lainnya)"
        />
        <AppStat
          label="Total service charge"
          :value="fmtRp(r.svcOnly)"
        />
        <AppStat
          label="Total tax"
          :value="fmtRp(r.taxOnly)"
        />
        <AppStat
          label="Total compliment"
          icon="i-lucide-gift"
          :value="fmtRp(r.compBulan)"
        />
        <AppStat
          label="Total traffic"
          :value="angka(r.T.traffic)"
        />
        <AppStat
          label="Total bill"
          :value="angka(r.T.bill)"
        />
        <AppStat
          label="Qty item food"
          :value="angka(r.T.qfood)"
        />
        <AppStat
          label="Qty item beverage"
          :value="angka(r.T.qbev)"
        />
        <AppStat
          label="Qty item lainnya"
          :value="angka(r.T.qothers)"
        />
        <AppStat
          label="Total item terjual"
          :value="angka(r.totalItem)"
        />
      </div>

      <AppPanel
        title="Omset Harian (Tabel)"
        description="Realisasi net per tanggal"
        flush
      >
        <table class="w-full text-sm">
          <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
            <tr>
              <th class="px-4 py-2.5 text-start">
                Tanggal
              </th>
              <th class="px-4 py-2.5 text-end">
                Omset (net)
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="d in hari"
              :key="d.date"
            >
              <td class="px-4 py-2.5">
                {{ labelHari(d.date) }}
              </td>
              <td class="px-4 py-2.5 text-end num">
                {{ fmtRp(netOf(d)) }}
              </td>
            </tr>
            <tr v-if="!hari.length">
              <td
                colspan="2"
                class="px-4 py-6 text-center text-muted"
              >
                Belum ada data.
              </td>
            </tr>
          </tbody>
        </table>
      </AppPanel>
    </div>
  </AppPage>
</template>
