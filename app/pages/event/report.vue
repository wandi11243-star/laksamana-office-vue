<!--
  Report & Analytics — the legacy report (`renderReportEms`,
  `event/index.html:5683-5717`): period band over the whole screen, four
  cards, the six-month turnover bars, per-category table and the per-event
  breakdown with the best-selling class.

  Only result statuses count (Approval and up — plans never sold a ticket),
  and every money figure below is scoped to the events in the picked period,
  like the old `angkaEms(r)`. The bars stand upright like the old chart; the
  horizontal AppBar stays where the design system puts lists.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useStateEvent } from '~/composables/useEvent'
import { EVT_STATUS_HASIL, bulanAktif, geserPeriode, omzetPerBulan, rentangPeriodeEvent, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const { data: state, status, refresh, error } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

// --- period band: the whole screen follows it (`pitaPeriodeEms`, default Semua) ---
const periode = ref('')
const PILIHAN_PERIODE = [
  { value: '', label: 'Semua' },
  { value: 'hari', label: 'Hari ini' },
  { value: 'minggu', label: 'Minggu ini' },
  { value: 'bulan', label: 'Bulan ini' },
]
const geser = (arah: -1 | 1) => {
  periode.value = geserPeriode(periode.value, arah)
}
const bulanPick = computed({
  get: () => bulanAktif(periode.value),
  set: (v: string) => {
    if (v) periode.value = v
  },
})
const tglPick = computed({
  get: () => (/^\d{4}-\d{2}-\d{2}$/.test(periode.value) ? periode.value : ''),
  set: (v: string) => {
    if (v) periode.value = v
  },
})
const labelPeriode = computed(() => {
  const m = periode.value
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) {
    return new Date(`${m}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (/^\d{4}-\d{2}$/.test(m)) {
    return new Date(`${m}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }
  return (PILIHAN_PERIODE.find(p => p.value === m) ?? PILIHAN_PERIODE[0]!).label
})

// --- scoped aggregates (`angkaEms(r) :5004`): result statuses in range, everything else joins them ---
const tglAcara = (start?: string) => tglWIB(start ?? '')
const acara = computed(() => {
  const r = rentangPeriodeEvent(periode.value)
  return (s.value?.events ?? []).filter(e => (EVT_STATUS_HASIL as string[]).includes(String(e.status))
    && (!r || (tglAcara(e.start_datetime) >= r.a && tglAcara(e.start_datetime) <= r.b)))
})
const idAcara = computed(() => new Set(acara.value.map(e => e.id)))
const kelas = computed(() => (s.value?.ticketClasses ?? []).filter(c => idAcara.value.has(String(c.event_id ?? ''))))
const tiket = computed(() => {
  const idKelas = new Set(kelas.value.map(c => c.id))
  return (s.value?.tickets ?? []).filter(t => idKelas.has(String(t.ticket_class_id ?? '')))
})
const orderLunas = computed(() => (s.value?.orders ?? []).filter(o => o.payment_status === 'Paid' && idAcara.value.has(String(o.event_id ?? ''))))
const omzet = computed(() => orderLunas.value.reduce((a, o) => a + (Number(o.total) || 0), 0))
const terjual = computed(() => kelas.value.reduce((a, c) => a + (Number(c.sold) || 0), 0))
const hadir = computed(() => tiket.value.filter(t => (t.status ?? '') === 'Checked-In').length)
const hadirPct = computed(() => (tiket.value.length ? Math.round(hadir.value / tiket.value.length * 100) : 0))
const avgHarga = computed(() => (terjual.value ? Math.round(omzet.value / terjual.value) : 0))

// --- six-month turnover bars, upright like the old chart (`:5694`) ---
const grafik = computed(() => omzetPerBulan(6, s.value?.events ?? [], s.value?.orders ?? [])
  .map(g => ({ label: g.label, jt: Math.round(g.jt) })))
const maksGrafik = computed(() => Math.max(1, ...grafik.value.map(g => g.jt)))

// --- per event category: which kind of show makes the money (`:5697`) ---
const perKategori = computed(() => {
  const m = new Map<string, { n: number, v: number }>()
  for (const e of acara.value) {
    const k = (e.category || 'Lainnya').trim() || 'Lainnya'
    const g = m.get(k) ?? { n: 0, v: 0 }
    g.n += 1
    g.v += orderLunas.value.filter(o => String(o.event_id ?? '') === e.id).reduce((a, o) => a + (Number(o.total) || 0), 0)
    m.set(k, g)
  }
  return [...m.entries()].map(([nama, g]) => ({ nama, ...g })).sort((a, b) => b.v - a.v)
})

// --- per-event breakdown: best-selling class and day-H arrivals (`:5642`) ---
interface BarisRincian {
  id: string
  judul: string
  tanggal: string
  top: string
  terjual: number
  tiket: number
  hadir: number
  hadirPct: number
  omzet: number
}
const rincian = computed<BarisRincian[]>(() => acara.value.map((e) => {
  const ks = kelas.value.filter(c => String(c.event_id ?? '') === e.id)
  const tk = tiket.value.filter(t => ks.some(c => c.id === t.ticket_class_id))
  const hd = tk.filter(t => (t.status ?? '') === 'Checked-In').length
  const tj = ks.reduce((a, c) => a + (Number(c.sold) || 0), 0)
  const top = [...ks].sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0))[0]
  return {
    id: e.id,
    judul: e.title,
    tanggal: tglAcara(e.start_datetime),
    top: top && Number(top.sold) ? `${top.name} ${angka(Number(top.sold) || 0)} terjual` : '—',
    terjual: tj,
    tiket: tk.length,
    hadir: hd,
    hadirPct: tk.length ? Math.round(hd / tk.length * 100) : 0,
    omzet: orderLunas.value.filter(o => String(o.event_id ?? '') === e.id).reduce((a, o) => a + (Number(o.total) || 0), 0),
  }
}).sort((a, b) => b.terjual - a.terjual))
const kolomRincian: TableColumn<BarisRincian>[] = [
  { id: 'acara', header: 'Event' },
  { id: 'top', header: 'Kategori paling laku' },
  { id: 'terjual', header: 'Tiket terjual' },
  { id: 'hadir', header: 'Hadir hari-H' },
  { id: 'omzet', header: 'Omzet' },
]
const fmtTgl = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(+d) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <EventGerbang lihat="report">
  <AppPage
    title="Report & analytics"
    description="Laporan omzet, tiket & kehadiran"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="status === 'pending'"
        @click="refresh()"
      >
        Muat ulang
      </UButton>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="apiErrorMessage(error)"
      class="mb-4"
    />

    <AppPanel
      title="Periode"
      icon="i-lucide-calendar"
      class="mb-4"
    >
      <div class="flex flex-wrap items-center gap-2">
        <AppChips
          v-model="periode"
          :options="PILIHAN_PERIODE"
        />
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="outline"
          size="sm"
          aria-label="Periode sebelumnya"
          title="Geser mundur"
          @click="geser(-1)"
        />
        <UInput
          v-model="bulanPick"
          type="month"
          size="sm"
          title="Pilih bulan"
          class="w-40"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="outline"
          size="sm"
          aria-label="Periode berikutnya"
          title="Geser maju"
          @click="geser(1)"
        />
        <UInput
          v-model="tglPick"
          type="date"
          size="sm"
          title="Atau pilih satu tanggal"
          class="w-40"
        />
        <AppStatus size="sm">
          {{ acara.length }} event
        </AppStatus>
        <AppStatus size="sm">
          {{ labelPeriode }}
        </AppStatus>
      </div>
    </AppPanel>

    <AppStatGrid class="mb-5">
      <AppStat
        label="Total omzet"
        :value="rupiah(omzet)"
        sub="pesanan lunas"
        icon="i-lucide-banknote"
        tone="gold"
      />
      <AppStat
        label="Tiket terbit"
        :value="angka(tiket.length)"
        sub="e-ticket dibuat"
        icon="i-lucide-ticket"
        tone="info"
      />
      <AppStat
        label="Hadir"
        :value="angka(hadir)"
        :sub="`${hadirPct}% dari tiket terbit`"
        icon="i-lucide-scan-line"
        tone="success"
      />
      <AppStat
        label="Avg harga tiket"
        :value="rupiah(avgHarga)"
        sub="per tiket terjual"
        icon="i-lucide-tag"
        tone="info"
      />
    </AppStatGrid>

    <AppPanel
      title="Omzet 6 bulan (juta)"
      icon="i-lucide-chart-column"
      class="mb-4"
    >
      <div class="flex h-56 items-end gap-3 sm:gap-4">
        <div
          v-for="g in grafik"
          :key="g.label"
          class="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch"
        >
          <b class="text-xs num sm:text-sm">{{ g.jt }}jt</b>
          <div
            class="w-full max-w-24 rounded-t-lg bg-primary"
            :style="{ height: `${Math.round(g.jt / maksGrafik * 100)}%` }"
            :title="`Rp ${angka(g.jt)} jt`"
          />
          <span class="text-xs text-muted">{{ g.label }}</span>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Per kategori event"
      icon="i-lucide-tags"
      class="mb-4"
      flush
    >
      <p
        v-if="!perKategori.length"
        class="px-4 py-6 text-center text-sm text-dimmed"
      >
        Belum ada event pada periode ini.
      </p>
      <UTable
        v-else
        :columns="[{ id: 'nama', header: 'Kategori' }, { id: 'n', header: 'Event' }, { id: 'v', header: 'Omzet' }]"
        :data="perKategori"
        :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
        class="hidden lg:block"
      >
        <template #n-cell="{ row }">
          <span class="num">{{ angka(row.original.n) }}</span>
        </template>
        <template #v-cell="{ row }">
          <b class="num">{{ rupiah(row.original.v) }}</b>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="k in perKategori"
          :key="k.nama"
          class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
        >
          <span><b class="text-highlighted">{{ k.nama }}</b> <span class="text-muted num">· {{ k.n }} event</span></span>
          <b class="num">{{ rupiah(k.v) }}</b>
        </li>
      </ul>
    </AppPanel>

    <AppPanel
      title="Rincian per event"
      icon="i-lucide-list"
      flush
    >
      <p
        v-if="!rincian.length"
        class="px-4 py-6 text-center text-sm text-dimmed"
      >
        Belum ada event pada periode ini.
      </p>
      <UTable
        v-else
        :columns="kolomRincian"
        :data="rincian"
        :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
        class="hidden lg:block"
      >
        <template #acara-cell="{ row }">
          <ULink
            :to="`/event/ticketing/${row.original.id}`"
            class="font-semibold text-highlighted hover:text-primary-700"
          >
            {{ row.original.judul }}
          </ULink>
          <span class="block text-xs text-muted">{{ fmtTgl(row.original.tanggal) }}</span>
        </template>
        <template #top-cell="{ row }">
          <b
            v-if="row.original.top !== '—'"
            class="text-highlighted"
          >{{ row.original.top }}</b>
          <span
            v-else
            class="text-dimmed"
          >—</span>
        </template>
        <template #terjual-cell="{ row }">
          <b class="num">{{ angka(row.original.terjual) }}</b>
        </template>
        <template #hadir-cell="{ row }">
          <span class="num">{{ angka(row.original.hadir) }} dari {{ angka(row.original.tiket) }} e-ticket · {{ row.original.hadirPct }}%</span>
        </template>
        <template #omzet-cell="{ row }">
          <b class="num">{{ rupiah(row.original.omzet) }}</b>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="r in rincian"
          :key="r.id"
          class="px-4 py-2.5 text-sm"
        >
          <ULink
            :to="`/event/ticketing/${r.id}`"
            class="font-semibold text-highlighted"
          >
            {{ r.judul }}
          </ULink>
          <span class="mt-0.5 block text-xs text-muted num">{{ fmtTgl(r.tanggal) }} · {{ r.top }} · {{ r.terjual }} terjual · {{ r.hadir }}/{{ r.tiket }} hadir · {{ rupiah(r.omzet) }}</span>
        </li>
      </ul>
    </AppPanel>
  </AppPage>
  </EventGerbang>
</template>
