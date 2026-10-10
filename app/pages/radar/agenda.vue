<!--
  Radar › Daftar Event (deploy/radar vAgendaList).

  Only events that will actually happen (the API filters the sales stages out).
  Weekly and monthly views split "Akan Datang" / "Sudah Lewat" by DATE, not by
  status: yesterday's event still marked Upcoming is past, and leaving it among
  the coming ones makes the crew prepare something that is over. The daily
  view is not split — one day is either all past or all ahead, so the switch
  would only ever offer an empty bucket.

  VIP pax is counted but NOT added to Total pax (the card says so): a VIP
  booking also locks tables in Reservasi, so its guests could be counted twice.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RadarAgenda, RadarPilihan, SumberAgenda } from '~/composables/useRadar'
import {
  IKON_SUMBER, SEMUA, SUMBER_PENDEK, TANPA_FB, WARNA_SUMBER, agSelesai, agSudahLewat, cocokFb, dDay,
  dLabel, dalamPeriode, fbOpsi, iris, labelPeriode, paxOf, periodeBaru, rentangPeriode, saringAktif,
  statusPasti,
} from '~/utils/radar'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const p = useState('radar-fAg', () => periodeBaru('minggu'))
const f = useState('radar-fAg-f', () => ({ q: '', sumber: SEMUA as string, status: SEMUA, fb: SEMUA, waktu: 'akan' as 'akan' | 'lewat', view: 'grid' as 'grid' | 'tabel' }))

const dari = computed(() => rentangPeriode(p.value).dari)
const sampai = computed(() => rentangPeriode(p.value).sampai)
const { data: board, status, error, refresh } = useRadarBoard('radar-ag-board', dari, sampai)
const agenda = computed(() => board.value?.agenda ?? [])

const dasar = computed(() => {
  const q = f.value.q.trim().toLowerCase()
  return agenda.value.filter(a => dalamPeriode(a.tgl, p.value)
    && (!saringAktif(f.value.sumber) || a.sumber === f.value.sumber)
    && (!saringAktif(f.value.status) || a.status === f.value.status)
    && cocokFb(a, f.value.fb)
    && (!q || `${a.judul} ${a.tempat} ${a.jenis}`.toLowerCase().includes(q)))
})
const dipisah = computed(() => p.value.mode !== 'hari')
const akan = computed(() => (dipisah.value ? dasar.value.filter(a => !agSudahLewat(a)) : dasar.value))
const lewat = computed(() => (dipisah.value ? dasar.value.filter(agSudahLewat) : []))
const list = computed(() => (!dipisah.value ? dasar.value : f.value.waktu === 'lewat' ? lewat.value : akan.value))
const bucketLain = computed(() => (f.value.waktu === 'lewat' ? akan.value : lewat.value))

const hal = ref(1)
watch([list], () => {
  hal.value = 1
})

const bySumber = (s: SumberAgenda) => list.value.filter(a => a.sumber === s)
const paxMkt = computed(() => paxOf(bySumber('mkt')))
const paxEvt = computed(() => paxOf(bySumber('evt')))
const paxVip = computed(() => paxOf(bySumber('vip')))

const opsiWaktu = computed(() => {
  const selesai = lewat.value.filter(agSelesai).length
  return [
    { value: 'akan' as const, label: `Akan Datang (${akan.value.length})` },
    { value: 'lewat' as const, label: `Sudah Lewat (${lewat.value.length}${selesai ? ` · ${selesai} selesai` : ''})` },
  ]
})
const OPSI_VIEW = [
  { value: 'grid' as const, label: 'Grid', icon: 'i-lucide-layout-grid' },
  { value: 'tabel' as const, label: 'Tabel', icon: 'i-lucide-table' },
]
const opsiSumber = [
  { value: SEMUA, label: 'Semua sumber' },
  { value: 'mkt', label: 'Marketing' },
  { value: 'evt', label: 'Event' },
  { value: 'vip', label: 'Reservasi VIP' },
]
const opsiStatus = computed(() => [{ value: SEMUA, label: 'Semua status' }, ...statusPasti(agenda.value).map(s => ({ value: s, label: s }))])
const opsiFb = computed(() => [
  { value: SEMUA, label: 'Semua format F&B' },
  ...fbOpsi(agenda.value, board.value?.fbFormats).map(x => ({ value: x, label: x })),
  { value: TANPA_FB, label: '(tanpa format F&B)' },
])

const kolom: TableColumn<RadarAgenda>[] = [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'jam', header: 'Jam' },
  { accessorKey: 'judul', header: 'Acara' },
  { accessorKey: 'sumber', header: 'Sumber' },
  { accessorKey: 'tempat', header: 'Tempat' },
  { accessorKey: 'fb', header: 'Format F&B' },
  { accessorKey: 'jenis', header: 'Jenis' },
  { accessorKey: 'pax', header: 'Pax' },
  { accessorKey: 'status', header: 'Status' },
]

const pilih = ref<RadarPilihan>(null)
const buka = ref(false)
const bukaAgenda = (a: RadarAgenda) => {
  pilih.value = { jenis: 'ag', a }
  buka.value = true
}
useSegarSenyap(refresh, () => buka.value)
</script>

<template>
  <AppPage
    title="Daftar Event"
    description="Marketing + Event + Reservasi VIP — hanya acara yang sudah pasti jalan."
  >
    <RadarPitaGagal :sumber="board?.sumber" />
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Daftar tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Periode</span>
        <RadarPeriode v-model="p" />
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Acara tampil"
        icon="i-lucide-calendar-days"
        :value="list.length"
        :sub="`${labelPeriode(p)}${dipisah ? (f.waktu === 'lewat' ? ' · sudah lewat' : ' · akan datang') : ''}`"
      />
      <AppStat
        label="Pax Marketing"
        icon="i-lucide-briefcase"
        :value="paxMkt"
        :sub="`${bySumber('mkt').length} event klien`"
      />
      <AppStat
        label="Pax Event"
        icon="i-lucide-mic-vocal"
        tone="vip"
        :value="paxEvt"
        :sub="`${bySumber('evt').length} acara modul Event`"
      />
      <AppStat
        label="Reservasi VIP"
        icon="i-lucide-crown"
        tone="info"
        :value="bySumber('vip').length"
        :sub="`${paxVip} pax (perkiraan atas) · tidak ikut Total`"
      />
      <AppStat
        label="Total pax"
        icon="i-lucide-users"
        tone="info"
        :value="paxMkt + paxEvt"
        sub="Marketing + Event"
      />
    </AppStatGrid>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Cari">
          <UInput
            v-model="f.q"
            placeholder="Nama, tempat, jenis…"
            icon="i-lucide-search"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Sumber">
          <USelect
            v-model="f.sumber"
            :items="opsiSumber"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="f.status"
            :items="opsiStatus"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Format F&B">
          <USelect
            v-model="f.fb"
            :items="opsiFb"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <AppSeg
          v-if="dipisah"
          v-model="f.waktu"
          :options="opsiWaktu"
          size="sm"
        />
        <div class="flex-1" />
        <AppSeg
          v-model="f.view"
          :options="OPSI_VIEW"
          size="sm"
        />
      </div>
      <p class="mt-3 text-xs text-muted">
        <template v-if="dipisah">
          Terbuka di <b>Akan Datang</b>. Acara yang tanggalnya sudah lewat pindah ke <b>Sudah Lewat</b>.
        </template>
        Hanya acara yang sudah pasti jalan — <b>Marketing:</b> Deal &amp; Event Done · <b>Event:</b> Approval, Upcoming &amp; Event Done ·
        <b>Reservasi VIP:</b> semua yang belum dibatalkan.
      </p>
    </AppPanel>

    <p
      v-if="status === 'pending' && !board"
      class="text-sm text-muted"
    >
      Memuat…
    </p>
    <AppPanel v-else-if="!list.length">
      <p class="text-center text-sm">
        <b class="block text-highlighted">
          {{ dipisah && bucketLain.length ? (f.waktu === 'lewat' ? 'Tidak ada acara yang sudah lewat' : 'Tidak ada acara yang akan datang') : 'Tidak ada acara yang cocok' }}
        </b>
        <template v-if="dipisah && bucketLain.length">
          Di {{ labelPeriode(p) }} ada <b>{{ bucketLain.length }}</b> acara di {{ f.waktu === 'lewat' ? 'Akan Datang' : 'Sudah Lewat' }}.
        </template>
        <template v-else>
          Ubah periode, filter, atau kata kuncinya.
        </template>
      </p>
      <div
        v-if="dipisah && bucketLain.length"
        class="mt-3 text-center"
      >
        <UButton
          :label="f.waktu === 'lewat' ? 'Lihat yang akan datang' : 'Lihat yang sudah lewat'"
          color="neutral"
          variant="outline"
          size="sm"
          @click="f.waktu = f.waktu === 'lewat' ? 'akan' : 'lewat'"
        />
      </div>
    </AppPanel>
    <template v-else>
      <!-- A table does not fit a phone: below lg the Tabel view falls back to cards. -->
      <div
        class="grid gap-3 lg:grid-cols-2"
        :class="f.view === 'tabel' ? 'lg:hidden' : ''"
      >
        <RadarAgendaKartu
          v-for="a in iris(list, hal)"
          :key="`${a.sumber}-${a.id}`"
          :a="a"
          @buka="bukaAgenda"
        />
      </div>
      <AppPanel
        v-if="f.view === 'tabel'"
        flush
        class="hidden lg:block"
      >
        <UTable
          :data="iris(list, hal)"
          :columns="kolom"
          :meta="{ class: { tr: 'cursor-pointer' } }"
          @select="(_e: Event, row: { original: RadarAgenda }) => bukaAgenda(row.original)"
        >
          <template #tgl-cell="{ row }">
            <span class="whitespace-nowrap">{{ fTglP(row.original.tgl) }}</span>
            <span class="block text-[11px] text-muted">{{ dLabel(dDay(row.original.tgl)) }}</span>
          </template>
          <template #jam-cell="{ row }">
            <span class="num">{{ row.original.jam || '—' }}</span>
          </template>
          <template #judul-cell="{ row }">
            <b class="text-highlighted">{{ row.original.judul }}</b>
          </template>
          <template #sumber-cell="{ row }">
            <AppStatus
              :color="WARNA_SUMBER[row.original.sumber]"
              :icon="IKON_SUMBER[row.original.sumber]"
              size="sm"
            >
              {{ SUMBER_PENDEK[row.original.sumber] }}
            </AppStatus>
          </template>
          <template #tempat-cell="{ row }">
            {{ row.original.tempat || '—' }}
          </template>
          <template #fb-cell="{ row }">
            <AppStatus
              v-if="row.original.fb"
              color="info"
              size="sm"
            >
              {{ row.original.fb }}
            </AppStatus>
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
          <template #jenis-cell="{ row }">
            {{ row.original.jenis || '—' }}
          </template>
          <template #pax-cell="{ row }">
            <b class="num">{{ Number(row.original.pax) || 0 }}</b>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              v-if="row.original.status"
              :color="agSelesai(row.original) ? 'info' : 'success'"
              size="sm"
            >
              {{ row.original.status }}
            </AppStatus>
            <span v-else>—</span>
          </template>
        </UTable>
      </AppPanel>
      <RadarPager
        v-model="hal"
        :total="list.length"
        satuan="acara"
        class="mt-3"
      />
    </template>

    <RadarDetailSheet
      v-model:open="buka"
      :pilih="pilih"
      :boleh-uang="board?.bolehUang"
    />
  </AppPage>
</template>
