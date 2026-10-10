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
import { angkaEms, omzetPerBulan, paxAcara, statusPengajuan, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, hariIni, rupiah, tambahHari, tglPanjang } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'

definePageMeta({ access: ['event'] })

const { data: state, status, refresh, error } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

type Periode = '' | 'hari' | 'minggu' | 'bulan'
const periode = ref<Periode>('')
const PILIHAN_PERIODE = [
  { value: '', label: 'Semua' },
  { value: 'hari', label: 'Hari ini' },
  { value: 'minggu', label: 'Minggu ini' },
  { value: 'bulan', label: 'Bulan ini' },
] as { value: Periode, label: string }[]

const tglAcara = (e: Acara) => tglWIB(e.start_datetime)
const dalamPeriode = (tgl: string) => {
  const h = hariIni()
  if (periode.value === 'hari') return tgl === h
  if (periode.value === 'minggu') return tgl >= h && tgl <= tambahHari(h, 6)
  if (periode.value === 'bulan') return tgl.slice(0, 7) === h.slice(0, 7)
  return true
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
const upcoming = computed(() => acara.value.filter(e => e.status === 'Upcoming').length)
const hariIniN = computed(() => (s.value?.events ?? []).filter(e => tglAcara(e) === hariIni()).length)
const talentHariIni = computed(() => jadwal.value.filter(j => j.date === hariIni()).length)
const uangMasuk = computed(() => order.value.filter(o => o.payment_status === 'Paid').reduce((a, o) => a + (Number(o.total) || 0), 0))
const hadir = computed(() => (s.value?.checkins ?? []).filter(c => (c.result ?? 'Valid') === 'Valid').length)
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
  for (const c of s.value?.checkins ?? []) {
    const t = tiket.value.find(t => t.id === c.ticket_id)
    if (t) m.set(t.event_id ?? '', (m.get(t.event_id ?? '') ?? 0) + 1)
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
const perhatian = computed(() => {
  const keluar: { tone: 'warning' | 'error', judul: string, desc: string, to: string }[] = []
  const h = hariIni()
  for (const e of s.value?.events ?? []) {
    if (e.status === 'Upcoming' && tglAcara(e) >= h && !(e.pic || '').trim()) {
      keluar.push({ tone: 'error', judul: 'Event tanpa PIC', desc: `${e.title} — PIC wajib diisi sebelum jalan`, to: `/event/events/${e.id}` })
    }
    const ks = kelas.value.filter(c => c.event_id === e.id)
    const kuota = ks.reduce((a, c) => a + (Number(c.quota) || 0), 0)
    const laku = ks.reduce((a, c) => a + (Number(c.sold) || 0), 0)
    if (kuota > 0 && laku / kuota >= 0.9 && e.status === 'Upcoming') {
      keluar.push({ tone: 'warning', judul: 'Tiket hampir habis', desc: `${e.title} — ${laku}/${kuota} terjual`, to: `/event/ticketing/${e.id}` })
    }
  }
  const belumBayar = tagihan.value.filter(p => (p.status ?? '') !== 'Paid').length
  if (belumBayar) keluar.push({ tone: 'warning', judul: `${belumBayar} pembayaran talent menunggu`, desc: 'Belum ditandai lunas', to: '/event/fee' })
  const tanpaRek = talent.value.filter(t => t.status === 'Active' && !(t.bank_account || '').trim()).length
  if (tanpaRek) keluar.push({ tone: 'warning', judul: `${tanpaRek} talent tanpa rekening`, desc: 'Fee tidak bisa ditransfer', to: '/event/talents' })
  const menunggu = (s.value?.events ?? []).filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu').length
  if (menunggu) keluar.push({ tone: 'warning', judul: `${menunggu} rencana menunggu keputusan`, desc: 'Perlu putusan manajemen', to: '/event/approval' })
  return keluar
})

// --- money chart, computed from data (T-22) ---
const grafik = computed(() => omzetPerBulan(6, s.value?.events ?? [], order.value))
const maksGrafik = computed(() => Math.max(1, ...grafik.value.map(g => g.jt)))

// --- nearest-events table (`:2404-2413`) ---
const terdekat = computed(() => [...(s.value?.events ?? [])]
  .filter(e => e.status === 'Upcoming')
  .sort((a, b) => String(a.start_datetime ?? '').localeCompare(String(b.start_datetime ?? '')))
  .slice(0, 10))

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
  <AppPage
    title="Dashboard"
    :description="`Ringkasan operasional · ${tglPanjang(hariIni())}`"
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
      v-if="perhatian.length"
      title="Perlu perhatian"
      icon="i-lucide-triangle-alert"
      class="mb-4"
    >
      <ul class="grid gap-2 lg:grid-cols-2">
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

    <AppPanel
      title="Periode"
      icon="i-lucide-calendar"
      class="mb-4"
    >
      <AppChips
        v-model="periode"
        :options="PILIHAN_PERIODE"
      />
    </AppPanel>

    <AppSectionTitle title="Status event" />
    <AppStatGrid class="mb-5">
      <AppStat
        v-for="st in STATUS_KARTU"
        :key="st"
        :label="st"
        :value="acara.filter(e => e.status === st).length"
        :icon="STATUS_IKON_EVENT[st]"
        :tone="toneKartu(st)"
      />
    </AppStatGrid>

    <AppSectionTitle title="Angka utama" />
    <AppStatGrid class="mb-5">
      <AppStat
        label="Upcoming events"
        :value="upcoming"
        icon="i-lucide-party-popper"
        tone="vip"
      />
      <AppStat
        label="Event hari ini"
        :value="hariIniN"
        icon="i-lucide-calendar-check"
        tone="info"
      />
      <AppStat
        label="Talent hari ini"
        :value="talentHariIni"
        icon="i-lucide-mic-vocal"
        tone="info"
      />
      <AppStat
        label="Uang masuk tiket"
        :value="rupiah(uangMasuk)"
        icon="i-lucide-banknote"
        tone="gold"
      />
      <AppStat
        label="Attendance"
        :value="angka(hadir)"
        icon="i-lucide-scan-line"
        tone="success"
      />
      <AppStat
        label="Keterisian"
        :value="`${keterisian}%`"
        icon="i-lucide-armchair"
        tone="success"
      />
      <AppStat
        label="Avg ticket price"
        :value="rupiah(hargaRata)"
        icon="i-lucide-tag"
        tone="gold"
      />
      <AppStat
        label="Total talent"
        :value="talent.length"
        icon="i-lucide-users"
        tone="info"
      />
    </AppStatGrid>

    <AppSectionTitle title="Insight" />
    <AppStatGrid class="mb-5">
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
        :sub="talentAktif.talent ? `${talentAktif.n} show selesai` : ''"
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
        :sub="`${angka(ringkas.hadir)} dari ${angka(ringkas.tiket)} tiket`"
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
          {{ tglPanjang(tglWIB(row.original.start_datetime)) }}
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
            <span class="mt-0.5 block text-xs text-muted">{{ tglPanjang(tglAcara(e)) }} · {{ e.venue || '—' }} · {{ e.pic || '—' }}</span>
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
</template>
