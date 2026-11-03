<!--
  Event Dashboard — attention cards, period filter, status cards, 8 stat cards,
  insight cards, per-event money chart (COMPUTED from data via omzetPerBulan,
  never the old hard-coded demo numbers `:2405`, T-22) and the nearest-events
  table (`event/index.html:2293-2413`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Acara } from '~/composables/useEvent'
import { useStateEvent } from '~/composables/useEvent'
import { angkaEms, bulanAktif, eventTiket, fmtTglJamEms, geserPeriode, idCheckin, omzetPerBulan, paxAcara, petaOrder, rentangPeriodeEvent, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, hariIni, rupiah, tglPanjang } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'

definePageMeta({ access: ['event'] })

const { data: state, error, status } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

/** First-load skeleton for the stat grids below: skeleton cells stand in
 *  while the first state lands. Refetch keeps old numbers, so filter or
 *  period changes never blank the cards. */
const statMemuat = computed(() => !s.value && (status.value === 'pending' || status.value === 'idle'))

/** The dashboard opens on the current state, not the whole archive (`:2379-2383`).
 *  A picked `YYYY-MM` or `YYYY-MM-DD` is a period too, like the old band. */
const periode = ref('bulan')
const PILIHAN_PERIODE = [
  { value: '', label: 'Semua' },
  { value: 'hari', label: 'Hari ini' },
  { value: 'minggu', label: 'Minggu ini' },
  { value: 'bulan', label: 'Bulan ini' },
]
/** Stepping shifts the unit in use: a picked day steps a day, else a month. */
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
/** What the picked period means, written out: a percent without it cannot be acted on. */
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

const tglAcara = (e: Acara) => tglWIB(e.start_datetime)
/** Same range the event list uses, so two screens never disagree on one day. */
const dalamPeriode = (tgl: string) => {
  const r = rentangPeriodeEvent(periode.value)
  if (!r) return true
  return tgl >= r.a && tgl <= r.b
}

const acara = computed(() => (s.value?.events ?? []).filter(e => dalamPeriode(tglAcara(e))))
const kelas = computed(() => s.value?.ticketClasses ?? [])
const order = computed(() => s.value?.orders ?? [])
const tiket = computed(() => s.value?.tickets ?? [])
const jadwal = computed(() => s.value?.schedules ?? [])
const tagihan = computed(() => s.value?.talentPayments ?? [])
const talent = computed(() => s.value?.talents ?? [])

// --- the four status cards (Event Done deliberately excluded, `:2357`) ---
const STATUS_KARTU = ['Planning', 'Prospect', 'Approval', 'Upcoming'] as const
/** AppStat has no neutral tone: a plain count is gold. */
const toneKartu = (st: string) => STATUS_WARNA_EVENT[st] === 'neutral' ? 'gold' : STATUS_WARNA_EVENT[st]!

// --- the eight stat cards (`:2368-2383`) ---
// Global figures, like the old screen: only the status cards above follow the period.
const semuaAcara = computed(() => s.value?.events ?? [])
const upcomingSemua = computed(() => semuaAcara.value.filter(e => e.status === 'Upcoming'))
const upcoming = computed(() => upcomingSemua.value.length)
const todayEv = computed(() => upcomingSemua.value.filter(e => tglAcara(e) === hariIni()))
const hariIniN = computed(() => todayEv.value.length)
const talentHariIni = computed(() => jadwal.value.filter(j => j.date === hariIni()).length)
const talentAktifN = computed(() => talent.value.filter(t => t.status === 'Active').length)
const uangMasuk = computed(() => order.value.filter(o => o.payment_status === 'Paid').reduce((a, o) => a + (Number(o.total) || 0), 0))
// presence rule: newest row per ticket, cancellations excluded (not raw 'Valid' rows)
const idMasuk = computed(() => idCheckin(s.value?.checkins ?? []))
const orderById = computed(() => petaOrder(order.value))
const hadir = computed(() => idMasuk.value.size)
const tiketTerjual = computed(() => kelas.value.reduce((a, c) => a + (Number(c.sold) || 0), 0))
const keterisian = computed(() => {
  const laku = tiket.value.length
  return laku ? Math.round(hadir.value / laku * 100) : 0
})
const hargaRata = computed(() => (tiketTerjual.value ? Math.round(uangMasuk.value / tiketTerjual.value) : 0))

// --- insight cards (`:2313-2347`) ---
const perOmzet = computed(() => {
  const m = new Map<string, number>()
  for (const o of order.value) {
    if (o.payment_status !== 'Paid') continue
    m.set(o.event_id ?? '', (m.get(o.event_id ?? '') ?? 0) + (Number(o.total) || 0))
  }
  return m
})
const acaraTerlaris = computed(() => {
  let id = ''
  let rp = 0
  for (const [k, v] of perOmzet.value) {
    if (v > rp) {
      rp = v
      id = k
    }
  }
  return { acara: (s.value?.events ?? []).find(e => e.id === id) ?? null, rp }
})
const talentAktif = computed(() => {
  const m = new Map<string, number>()
  for (const j of jadwal.value) {
    if (j.status === 'Done') m.set(j.talent_id, (m.get(j.talent_id) ?? 0) + 1)
  }
  let id = ''
  let n = 0
  for (const [k, v] of m) {
    if (v > n) {
      n = v
      id = k
    }
  }
  return { talent: talent.value.find(t => t.id === id) ?? null, n }
})
const palingBanyakMasuk = computed(() => {
  const m = new Map<string, number>()
  for (const t of tiket.value) {
    if (!idMasuk.value.has(t.id)) continue
    const eid = eventTiket(t, orderById.value)
    m.set(eid, (m.get(eid) ?? 0) + 1)
  }
  let id = ''
  let n = 0
  for (const [k, v] of m) {
    if (v > n) {
      n = v
      id = k
    }
  }
  return { acara: (s.value?.events ?? []).find(e => e.id === id) ?? null, n }
})

// --- attention cards (`kartuPerhatian :2293`) ---
/** Days left count by WIB calendar date, never by millisecond rounding. */
const sisaHari = (iso?: string | null) => {
  if (!iso) return 999
  const a = tglWIB(iso)
  const h = hariIni()
  if (!a) return 999
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${h}T00:00:00Z`)) / 86400000)
}
const perhatian = computed(() => {
  const keluar: { tone: 'warning' | 'error', judul: string, desc: string, to: string }[] = []
  const h = hariIni()
  const detail = s.value?.eventDetails ?? {}
  for (const e of semuaAcara.value) {
    if (e.status !== 'Upcoming' || tglAcara(e) < h) continue
    const sisa = sisaHari(e.start_datetime)
    if (sisa <= 7 && !(e.pic || '').trim()) {
      keluar.push({ tone: 'error', judul: 'Event tanpa PIC', desc: `${e.title} tinggal ${sisa <= 0 ? 'hari ini' : `${sisa} hari lagi`}`, to: `/event/events/${e.id}` })
    }
    if (sisa <= 3) {
      const belum = (detail[e.id]?.tasks ?? []).filter(t => !t.done).length
      if (belum) keluar.push({ tone: 'warning', judul: `${belum} task belum selesai`, desc: `${e.title} — ${sisa <= 0 ? 'hari ini' : `${sisa} hari lagi`}`, to: `/event/events/${e.id}` })
    }
  }
  for (const e of semuaAcara.value) {
    if (!e.is_ticketed || e.status !== 'Upcoming') continue
    const ks = kelas.value.filter(c => c.event_id === e.id)
    const kuota = ks.reduce((a, c) => a + (Number(c.quota) || 0), 0)
    const laku = ks.reduce((a, c) => a + (Number(c.sold) || 0), 0)
    if (kuota > 0 && laku / kuota >= 0.9) {
      keluar.push({ tone: 'warning', judul: 'Tiket hampir habis', desc: `${e.title} — ${laku}/${kuota} terjual`, to: `/event/ticketing/${e.id}` })
    }
  }
  const belumBayar = tagihan.value.filter(p => p.status === 'Waiting').length
  if (belumBayar) keluar.push({ tone: 'warning', judul: `${belumBayar} pembayaran talent menunggu`, desc: 'Belum ditandai lunas', to: '/event/fee' })
  const tanpaRek = talent.value.filter(t => t.status === 'Active' && !(t.bank_account || '').trim()).length
  if (tanpaRek) keluar.push({ tone: 'warning', judul: `${tanpaRek} talent tanpa rekening`, desc: 'Fee tidak bisa ditransfer', to: '/event/talents' })
  return keluar
})

// --- money chart, computed from data (T-22) ---
const grafik = computed(() => omzetPerBulan(6, s.value?.events ?? [], order.value))
const maksGrafik = computed(() => Math.max(1, ...grafik.value.map(g => g.jt)))

// --- nearest-events table (`:2404-2413`) ---
const terdekat = computed(() => [...semuaAcara.value]
  .filter(e => e.status === 'Upcoming')
  .sort((a, b) => String(a.start_datetime ?? '').localeCompare(String(b.start_datetime ?? ''))))

const kolom: TableColumn<Acara>[] = [
  { id: 'acara', header: 'Event' },
  { id: 'tanggal', header: 'Tanggal' },
  { id: 'venue', header: 'Venue' },
  { id: 'pic', header: 'PIC' },
  { id: 'status', header: 'Status' },
  { id: 'tiket', header: 'Tiket' },
]

const ringkas = computed(() => angkaEms(s.value?.events ?? [], kelas.value, tiket.value, order.value))
</script>

<template>
  <EventGerbang lihat="dashboard">
    <AppPage
      title="Dashboard"
      :description="`Ringkasan operasional · ${tglPanjang(hariIni())}`"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />

      <AppPanel
        title="Perlu perhatian"
        icon="i-lucide-triangle-alert"
        class="mb-4"
      >
        <p
          v-if="!perhatian.length"
          class="text-sm text-muted"
        >
          Tidak ada yang perlu ditindak hari ini.
        </p>
        <ul
          v-else
          class="grid gap-2 lg:grid-cols-2"
        >
          <li
            v-for="(p, i) in perhatian"
            :key="i"
          >
            <ULink
              :to="p.to"
              class="flex items-center gap-3 rounded-field border border-default px-3 py-2 hover:border-primary"
            >
              <UIcon
                :name="p.tone === 'error' ? 'i-lucide-octagon-alert' : 'i-lucide-triangle-alert'"
                :class="p.tone === 'error' ? 'text-error' : 'text-warning'"
                class="size-5 shrink-0"
              />
              <span class="min-w-0">
                <b class="block truncate text-sm text-highlighted">{{ p.judul }}</b>
                <span class="block truncate text-xs text-muted">{{ p.desc }}</span>
              </span>
            </ULink>
          </li>
        </ul>
      </AppPanel>

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

      <AppSectionTitle title="Status event" />
      <AppStatGrid
        class="mb-5"
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          v-for="st in STATUS_KARTU"
          :key="st"
          :label="st"
          :value="acara.filter(e => e.status === st).length"
          sub="event"
          :icon="STATUS_IKON_EVENT[st]"
          :tone="toneKartu(st)"
        />
      </AppStatGrid>

      <AppStatGrid
        class="mb-5"
        :loading="statMemuat"
        :count="8"
      >
        <AppStat
          label="Upcoming events"
          :value="upcoming"
          sub="event akan datang"
          icon="i-lucide-party-popper"
          tone="vip"
        />
        <AppStat
          label="Event hari ini"
          :value="hariIniN"
          :sub="todayEv.map(e => e.title).join(', ') || '—'"
          icon="i-lucide-calendar-check"
          tone="info"
        />
        <AppStat
          label="Talent hari ini"
          :value="talentHariIni"
          :sub="talentHariIni ? 'terjadwal manggung' : 'tidak ada jadwal'"
          icon="i-lucide-mic-vocal"
          tone="info"
        />
        <AppStat
          label="Uang masuk tiket"
          :value="rupiah(uangMasuk)"
          :sub="`${angka(tiketTerjual)} tiket terjual`"
          icon="i-lucide-banknote"
          tone="gold"
        />
        <AppStat
          label="Attendance"
          :value="angka(hadir)"
          sub="sudah check-in"
          icon="i-lucide-scan-line"
          tone="success"
        />
        <AppStat
          label="Keterisian"
          :value="`${keterisian}%`"
          :sub="`dari ${angka(tiket.length)} tiket`"
          icon="i-lucide-armchair"
          tone="success"
        />
        <AppStat
          label="Avg ticket price"
          :value="rupiah(hargaRata)"
          sub="rata-rata"
          icon="i-lucide-tag"
          tone="gold"
        />
        <AppStat
          label="Total talent"
          :value="talentAktifN"
          sub="aktif"
          icon="i-lucide-users"
          tone="info"
        />
      </AppStatGrid>

      <AppSectionTitle title="Insight" />
      <AppStatGrid
        class="mb-5"
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Best selling event"
          :value="acaraTerlaris.acara?.title ?? '—'"
          :sub="acaraTerlaris.acara ? rupiah(acaraTerlaris.rp) : ''"
          icon="i-lucide-trophy"
          tone="gold"
          wrap
        />
        <AppStat
          label="Most active talent"
          :value="talentAktif.talent?.name ?? '—'"
          :sub="talentAktif.talent ? `${talentAktif.n} show` : ''"
          icon="i-lucide-star"
          tone="vip"
          wrap
        />
        <AppStat
          label="Event paling banyak masuk"
          :value="palingBanyakMasuk.acara?.title ?? '—'"
          :sub="palingBanyakMasuk.acara ? `${angka(palingBanyakMasuk.n)} check-in` : ''"
          icon="i-lucide-door-open"
          tone="success"
          wrap
        />
        <AppStat
          label="Tiket terjual yang hadir"
          :value="`${ringkas.hadirPct}%`"
          :sub="`${labelPeriode} · ${angka(ringkas.hadir)} hadir dari ${angka(ringkas.tiket)} tiket`"
          icon="i-lucide-ticket-check"
          tone="info"
        />
      </AppStatGrid>

      <AppPanel
        title="Uang masuk per event (6 bulan)"
        icon="i-lucide-chart-column"
        class="mb-4"
      >
        <p class="mb-3 text-xs text-muted">
          Pesanan lunas saja, dipetakan ke bulan mulai event, dalam juta rupiah.
        </p>
        <AppBar
          v-for="g in grafik"
          :key="g.label"
          :label="g.label"
          :value="`Rp ${g.jt} jt`"
          :persen="maksGrafik ? Math.round(g.jt / maksGrafik * 100) : 0"
        />
      </AppPanel>

      <AppPanel
        title="Event terdekat"
        icon="i-lucide-calendar-clock"
        flush
      >
        <UTable
          :columns="kolom"
          :data="terdekat"
          class="hidden lg:block"
        >
          <template #acara-cell="{ row }">
            <ULink
              :to="`/event/events/${row.original.id}`"
              class="font-semibold text-highlighted hover:text-primary-700"
            >
              {{ row.original.title }}
            </ULink>
          </template>
          <template #tanggal-cell="{ row }">
            {{ fmtTglJamEms(row.original.start_datetime) }}
          </template>
          <template #venue-cell="{ row }">
            {{ row.original.venue || '—' }}
          </template>
          <template #pic-cell="{ row }">
            {{ row.original.pic || '—' }}
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="STATUS_WARNA_EVENT[String(row.original.status)] ?? 'neutral'"
              :icon="STATUS_IKON_EVENT[String(row.original.status)]"
              size="sm"
            >
              {{ String(row.original.status) }}
            </AppStatus>
          </template>
          <template #tiket-cell="{ row }">
            {{ row.original.is_ticketed ? `${angka(paxAcara(row.original, kelas))} terjual` : '—' }}
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="e in terdekat"
            :key="e.id"
          >
            <ULink
              :to="`/event/events/${e.id}`"
              class="block px-4 py-3"
            >
              <b class="block truncate text-sm text-highlighted">{{ e.title }}</b>
              <span class="mt-0.5 block text-xs text-muted">{{ fmtTglJamEms(e.start_datetime) }} · {{ e.venue || '—' }} · {{ e.pic || '—' }}</span>
              <span class="mt-1.5 flex items-center gap-2">
                <AppStatus
                  :color="STATUS_WARNA_EVENT[String(e.status)] ?? 'neutral'"
                  :icon="STATUS_IKON_EVENT[String(e.status)]"
                  size="sm"
                >{{ String(e.status) }}</AppStatus>
                <span
                  v-if="e.is_ticketed"
                  class="text-xs text-muted num"
                >{{ angka(paxAcara(e, kelas)) }} terjual</span>
              </span>
            </ULink>
          </li>
        </ul>
        <p
          v-if="!terdekat.length"
          class="px-4 py-6 text-center text-sm text-dimmed"
        >
          Belum ada event upcoming.
        </p>
      </AppPanel>
    </AppPage>
  </EventGerbang>
</template>
