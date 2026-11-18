<!--
  Event Performance — the legacy `renderPerformanceEms` (event/index.html:5617):
  the same period band as the report, four cards (ticket turnover, sold vs
  quota, fill rate, finished events), the most active talents next to the
  biggest-turnover events, and the per-event breakdown. Everything is scoped to
  the result-status events of the period, like `angkaEms(r)`.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useStateEvent } from '~/composables/useEvent'
import { EVT_STATUS_HASIL, bulanAktif, geserPeriode, rentangPeriodeEvent, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const { data: state, error, status } = useStateEvent()

/** First-load skeleton for the stat grid below: skeleton cells stand in while
 *  the first state lands. Refetch keeps old numbers, so period changes never
 *  blank the cards. */
const statMemuat = computed(() => !state.value && (status.value === 'pending' || status.value === 'idle'))
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

const kuota = computed(() => kelas.value.reduce((a, c) => a + (Number(c.quota) || 0), 0))
const isi = computed(() => (kuota.value ? Math.round(terjual.value / kuota.value * 100) : 0))
const selesai = computed(() => acara.value.filter(e => e.status === 'Event Done').length)

// --- most active talents: Done shows in the period, top 8 (`:5632`) ---
const talentAktif = computed(() => {
  const r = rentangPeriodeEvent(periode.value)
  const per = new Map<string, { n: number, fee: number }>()
  for (const j of s.value?.schedules ?? []) {
    if (j.status !== 'Done' || (r && (j.date < r.a || j.date > r.b))) continue
    const g = per.get(j.talent_id) ?? { n: 0, fee: 0 }
    g.n += 1
    g.fee += Number(j.fee) || 0
    per.set(j.talent_id, g)
  }
  return [...per.entries()].map(([id, g]) => ({ nama: (s.value?.talents ?? []).find(t => t.id === id)?.name ?? '(talent dihapus)', ...g }))
    .sort((a, b) => b.n - a.n).slice(0, 8)
})
// --- biggest turnover: paid orders per event, top 8 (`:5650`) ---
const eventTerbesar = computed(() => {
  const per = new Map<string, number>()
  for (const o of orderLunas.value) per.set(String(o.event_id), (per.get(String(o.event_id)) ?? 0) + (Number(o.total) || 0))
  return [...per.entries()].map(([id, v]) => ({ nama: (s.value?.events ?? []).find(e => e.id === id)?.title ?? '(event dihapus)', v }))
    .sort((a, b) => b.v - a.v).slice(0, 8)
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
    top: top && Number(top.sold) ? `${top.name} ${angka(Number(top.sold) || 0)} terjual` : '',
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
  <EventGerbang lihat="performa">
    <AppPage
      title="Event performance"
      description="Ukur hasil event & talent secara objektif"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />

      <AppPanel class="mb-4">
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
          <AppTanggal
            v-model="tglPick"
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

      <AppStatGrid
        class="mb-5"
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Omzet tiket"
          :value="rupiah(omzet)"
          :sub="`${angka(orderLunas.length)} pesanan lunas`"
          icon="i-lucide-banknote"
          tone="gold"
        />
        <AppStat
          label="Tiket terjual"
          :value="angka(terjual)"
          :sub="kuota ? `dari ${angka(kuota)} kuota` : 'belum ada kuota'"
          icon="i-lucide-ticket"
          tone="info"
        />
        <AppStat
          label="Keterisian"
          :value="`${isi}%`"
          sub="terjual dibanding kuota"
          icon="i-lucide-armchair"
          tone="success"
        />
        <AppStat
          label="Event selesai"
          :value="angka(selesai)"
          :sub="`dari ${angka(acara.length)} event`"
          icon="i-lucide-flag"
          tone="info"
        />
      </AppStatGrid>

      <div class="mb-4 grid items-start gap-4 lg:grid-cols-2">
        <AppPanel
          title="Talent paling aktif"
          icon="i-lucide-mic"
          flush
        >
          <p
            v-if="!talentAktif.length"
            class="px-4 py-6 text-center text-sm text-dimmed"
          >
            Belum ada show berstatus Done pada periode ini.
          </p>
          <UTable
            v-else
            :columns="[{ id: 'nama', header: 'Talent' }, { id: 'n', header: 'Show' }, { id: 'fee', header: 'Total fee' }]"
            :data="talentAktif"
          >
            <template #nama-cell="{ row }">
              <b class="text-highlighted">{{ row.original.nama }}</b>
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ angka(row.original.n) }}</span>
            </template>
            <template #fee-cell="{ row }">
              <span class="num">{{ rupiah(row.original.fee) }}</span>
            </template>
          </UTable>
        </AppPanel>
        <AppPanel
          title="Event omzet terbesar"
          icon="i-lucide-trophy"
          flush
        >
          <p
            v-if="!eventTerbesar.length"
            class="px-4 py-6 text-center text-sm text-dimmed"
          >
            Belum ada pesanan lunas pada periode ini.
          </p>
          <UTable
            v-else
            :columns="[{ id: 'nama', header: 'Event' }, { id: 'v', header: 'Omzet' }]"
            :data="eventTerbesar"
          >
            <template #nama-cell="{ row }">
              <b class="text-highlighted">{{ row.original.nama }}</b>
            </template>
            <template #v-cell="{ row }">
              <span class="num">{{ rupiah(row.original.v) }}</span>
            </template>
          </UTable>
        </AppPanel>
      </div>

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
              v-if="row.original.top"
              class="text-highlighted"
            >{{ row.original.top }}</b>
            <span
              v-else
              class="text-xs text-muted"
            >belum ada penjualan</span>
          </template>
          <template #terjual-cell="{ row }">
            <b class="num">{{ angka(row.original.terjual) }}</b>
          </template>
          <template #hadir-cell="{ row }">
            <b class="num">{{ angka(row.original.hadir) }}</b>
            <span
              v-if="row.original.tiket"
              class="block text-xs text-muted num"
            >dari {{ angka(row.original.tiket) }} e-ticket · {{ row.original.hadirPct }}%</span>
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
            <span class="mt-0.5 block text-xs text-muted num">{{ fmtTgl(r.tanggal) }} · {{ r.top || 'belum ada penjualan' }} · {{ r.terjual }} terjual · {{ r.hadir }}/{{ r.tiket }} hadir · {{ rupiah(r.omzet) }}</span>
          </li>
        </ul>
      </AppPanel>
    </AppPage>
  </EventGerbang>
</template>
