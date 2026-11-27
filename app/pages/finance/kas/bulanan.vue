<!--
  Finance › Kas Kecil › Dashboard Omset (old `viewBulanan` + `waDashboardOmset`, deploy/finance/kas/index.html:3867-4210).

  Compact layout (owner request, Nov 2026): four headline cards, then Rasio
  Komposisi, the indicators and the totals side by side, then one daily list in
  columns. WhatsApp and PDF sit in the page actions. It shares one menu row and
  the chosen period with Dashboard Analytics.

  Two omset numbers live here on purpose: TAGIHAN (net + service + tax, what the
  guest paid — same as Dibayar Tamu in Rekap Penjualan) on the top cards, and NET
  for Rasio Komposisi, ATV and the Self Order share. The info strip says so.
  Rasio Komposisi divides by Food + Beverage + Lainnya (gross), so the three
  always add to 100% even with discounts.

  The PDF is the browser print dialog (the app chrome is print:hidden).
-->
<script setup lang="ts">
import type { BarisHarian } from '~/utils/kompas'
import { itemsOf, kNum, monthKeyOf, netOf, tagihanOf, taxSvcOf } from '~/utils/kompas'
import { useKompasState } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { tglLabel } from '~/utils/format'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const { mode, periode, tanggal } = useDashboardPeriode()
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
const periodeKata = computed(() => (harian.value ? 'harian' : 'bulanan'))
const indikator = computed(() => {
  const x = r.value
  return [
    { l: 'Unit per transaction (UPT)', v: desimal(x.upt), ket: `${angka(x.totalItem)} item ÷ ${angka(x.T.bill)} bill` },
    { l: 'Average transaction value (ATV)', v: fmtRp(x.atv), ket: 'total sales ÷ total bill' },
    { l: 'Average party size (APS)', v: desimal(x.aps), ket: `${angka(x.T.traffic)} traffic ÷ ${angka(x.T.bill)} bill` },
    { l: `Tax & service ${periodeKata.value}`, v: fmtRp(x.tax), ket: 'di luar omset, akumulasi harian' },
    { l: 'Service charge', v: fmtRp(x.svcOnly), ket: '' },
    { l: 'Tax', v: fmtRp(x.taxOnly), ket: '' },
    { l: `Total discount ${periodeKata.value}`, v: fmtRp(x.disc), ket: 'total potongan diberikan' },
    { l: 'Total compliment', v: fmtRp(x.compBulan), ket: '' },
  ]
})
const totalan = computed(() => {
  const x = r.value
  return [
    { l: 'Total food', v: fmtRp(x.T.food) },
    { l: 'Total beverage', v: fmtRp(x.T.bev) },
    { l: 'Total lainnya', v: fmtRp(x.T.lainnya) },
    { l: 'Total traffic', v: angka(x.T.traffic) },
    { l: 'Total bill', v: angka(x.T.bill) },
    { l: 'Qty item food', v: angka(x.T.qfood) },
    { l: 'Qty item beverage', v: angka(x.T.qbev) },
    { l: 'Qty item lainnya', v: angka(x.T.qothers) },
    { l: 'Total item terjual', v: angka(x.totalItem) },
  ]
})
const rasio = computed(() => {
  const x = r.value
  return [
    { l: 'Food', persen: x.rFood, v: x.T.food, tone: 'gold' as const },
    { l: 'Beverage', persen: x.rBev, v: x.T.bev, tone: 'info' as const },
    { l: 'Lainnya', persen: x.rLain, v: x.T.lainnya, tone: 'success' as const },
  ]
})
const labelHari = (t: string) => {
  const d = new Date(`${t}T00:00:00`)
  return `${t.slice(8)} ${d.toLocaleDateString('id-ID', { weekday: 'short' })}`
}

const cetak = () => cetakPdf(namaBerkas('Laporan omset', labelRentang.value))

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
      <AppTanggal
        v-if="harian"
        v-model="tanggal"
        class="w-40 print:hidden"
      />
      <AppBulan
        v-else
        v-model="periode"
        class="w-48 print:hidden"
      />
      <UButton
        label="Kirim WhatsApp"
        icon="i-lucide-message-circle"
        color="neutral"
        variant="outline"
        size="sm"
        class="print:hidden"
        :disabled="!data || !izin.lihat('bulanan')"
        @click="kirimWhatsApp"
      />
      <UButton
        label="Simpan PDF"
        icon="i-lucide-file-down"
        size="sm"
        class="print:hidden"
        :disabled="!data || !izin.lihat('bulanan')"
        @click="cetak"
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
      class="space-y-3"
    >
      <p class="hidden text-sm font-semibold print:block">
        Laporan {{ labelRentang }}
      </p>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="k in [
            { l: harian ? 'Realisasi hari ini' : 'Realisasi bulan ini', v: fmtRp(r.realTagihan), s: harian ? (hari.length ? 'data hari ini sudah diinput' : 'belum ada data hari ini') : `${hari.length} hari terinput · ${labelRentang}`, aksen: true },
            { l: 'Rata-rata per hari', v: fmtRp(hari.length ? r.realTagihan / hari.length : 0), s: `dari ${hari.length} hari terinput` },
            { l: 'Omset self order', v: fmtRp(r.self), s: `${r.selfPct.toFixed(1)}% dari omset net · order lewat barcode` },
            { l: 'Omset lewat kasir', v: fmtRp(r.real - r.self), s: `${pct(r.real - r.self, r.real).toFixed(1)}% dari omset net` },
          ]"
          :key="k.l"
          class="@container min-w-0 rounded-panel p-4 shadow-panel"
          :class="'aksen' in k ? 'bg-primary-50' : 'bg-default'"
        >
          <p class="truncate text-xs font-semibold text-muted">
            {{ k.l }}
          </p>
          <p class="mt-1 whitespace-nowrap font-display text-[min(1.5rem,10cqi)] font-extrabold leading-tight text-highlighted num">
            {{ k.v }}
          </p>
          <p
            class="mt-0.5 truncate text-xs text-muted"
            :title="k.s"
          >
            {{ k.s }}
          </p>
        </div>
      </div>

      <p class="flex items-start gap-2 text-xs text-muted">
        <UIcon
          name="i-lucide-info"
          class="mt-0.5 size-3.5 shrink-0"
        />
        <span>
          Realisasi = <b>tagihan</b> (termasuk service &amp; PB 1), sama dengan <b>Dibayar Tamu</b> di Rekap Penjualan.
          Omset <b>net</b> {{ fmtRp(r.real) }} dipakai untuk rasio, ATV dan persentase Self Order.
        </span>
      </p>

      <div class="grid gap-3 lg:grid-cols-3 lg:items-start print:grid-cols-3">
        <AppPanel title="Rasio Komposisi Omset">
          <AppBar
            v-for="x in rasio"
            :key="x.l"
            :label="`${x.l} · ${fmtRp(x.v)}`"
            :value="`${x.persen.toFixed(1)}%`"
            :persen="x.persen"
            :tone="x.tone"
          />
          <p
            class="text-xs text-muted"
            title="Dibagi Food + Beverage + Lainnya, bukan omset net, supaya ketiganya selalu tepat 100% walau ada diskon."
          >
            Dari Food + Beverage + Lainnya ({{ fmtRp(r.kompo) }}), sebelum diskon.
          </p>
        </AppPanel>

        <AppPanel title="Indikator">
          <dl class="divide-y divide-default text-sm">
            <div
              v-for="x in indikator"
              :key="x.l"
              class="flex items-baseline justify-between gap-3 py-1.5"
              :title="x.ket || undefined"
            >
              <dt class="min-w-0 truncate text-muted">
                {{ x.l }}
              </dt>
              <dd class="shrink-0 font-semibold text-highlighted num">
                {{ x.v }}
              </dd>
            </div>
          </dl>
        </AppPanel>

        <AppPanel title="Total &amp; Qty">
          <dl class="divide-y divide-default text-sm">
            <div
              v-for="x in totalan"
              :key="x.l"
              class="flex items-baseline justify-between gap-3 py-1.5"
            >
              <dt class="min-w-0 truncate text-muted">
                {{ x.l }}
              </dt>
              <dd class="shrink-0 font-semibold text-highlighted num">
                {{ x.v }}
              </dd>
            </div>
          </dl>
        </AppPanel>
      </div>

      <!-- One daily list (the old chart and table showed the same numbers):
        dates read down each column, the tint shows the size of the day. -->
      <AppPanel
        title="Omset Harian"
        description="Realisasi net per tanggal"
      >
        <p
          v-if="!hari.length"
          class="py-6 text-center text-sm text-muted"
        >
          Belum ada data.
        </p>
        <ul
          v-else
          class="gap-x-5 sm:columns-2 lg:columns-3 2xl:columns-4 print:columns-3"
        >
          <li
            v-for="d in hari"
            :key="d.date"
            class="relative mb-1 break-inside-avoid overflow-hidden rounded-md"
          >
            <span
              class="absolute inset-y-0 start-0 bg-gold-soft print:hidden"
              :style="{ width: `${Math.max(0, (netOf(d) / maxHari) * 100)}%` }"
              aria-hidden="true"
            />
            <span class="relative flex items-baseline justify-between gap-3 px-2 py-1 text-sm">
              <span class="whitespace-nowrap text-default">{{ labelHari(d.date) }}</span>
              <b class="whitespace-nowrap font-semibold text-highlighted num">{{ fmtRp(netOf(d)) }}</b>
            </span>
          </li>
        </ul>
      </AppPanel>
    </div>
  </AppPage>
</template>
