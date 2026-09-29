<!--
  Dashboard & Recap — one page, four tabs, one filter row (`:5205-5290`).
  The old screen split this into two pages (Dashboard + Recap) with the same
  filters and the same data, so filtering in one and switching lost it. Kept as
  one page here.

  Counting rules are the old ones, unchanged (`:5336-5355`):
    - No-show never counts towards pax — the guest did not come.
    - Pax that DID arrive is summed from the arrival waves, because a party may
      arrive in stages.
    - Capacity is always for ONE date (the map's date), never for the selected
      period: comparing a month of pax with a day's capacity produces "3400/512",
      which looks like a wildly overbooked venue.
    - Cancelled rows are dropped AFTER the other filters and their count is shown,
      because someone searching a name needs to be able to tell "not here" from
      "here but cancelled".

  No server paging exists (G-08), so the table pages in the browser.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi } from '~/composables/useReservasi'
import { useDaftarReservasi, useDenah, useSection } from '~/composables/useReservasi'
import { bolehAksi, roleReservasi } from '~/utils/layar/reservasi'
import { arrivedPax, remainingPax, tablesOf } from '~/utils/kunci-meja'
import { dpTotal } from '~/utils/dp-reservasi'
import { lantaiMap, kapasitasTanggal } from '~/utils/venue-layouts'
import { hariIni, rupiah, tglPendek, tambahHari, angka } from '~/utils/format'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const role = computed(() => roleReservasi(me.value))
const bolehEdit = computed(() => bolehAksi('input', role.value))

// --- the window ---------------------------------------------------------------
// The dashboard always draws the day-of map, so that date has to be inside the
// loaded window whatever period the table is filtered on.
const filter = reactive({
  mode: 'day' as 'day' | 'month' | 'year' | 'range' | 'all',
  date: hariIni(),
  month: hariIni().slice(0, 7),
  year: new Date().getFullYear(),
  from: hariIni(),
  to: hariIni(),
  fromHour: '',
  toHour: '',
  status: '',
  category: '',
  lantai: '',
  kursi: '',
  dp: '',
  pic: '',
  q: '',
})
const cari = ref('')
/** The map and the waiting list can only ever show ONE date. */
const tglDenah = ref(hariIni())
const tab = ref<'list' | 'calendar' | 'map' | 'wait'>('list')
const perTanggal = computed(() => tab.value === 'map' || tab.value === 'wait')

const dari = computed(() => {
  const dasar = filter.mode === 'month'
    ? `${filter.month}-01`
    : filter.mode === 'year'
      ? `${filter.year}-01-01`
      : filter.mode === 'range' && filter.from
        ? filter.from
        : filter.date
  return tambahHari(dasar, -1)
})
const sampai = computed(() => {
  const akhir = filter.mode === 'month'
    ? `${filter.month}-31`
    : filter.mode === 'year'
      ? `${filter.year}-12-31`
      : filter.mode === 'range' && filter.to
        ? filter.to
        : filter.date
  return tambahHari(akhir, 1)
})

const { data: semua, status } = useDaftarReservasi(dari, sampai, 'reservasi-dashboard')

// --- filtering (`:5080-5104`, `:5793-5826`) ----------------------------------

const cariLower = computed(() => cari.value.trim().toLowerCase())

const saringan = computed(() => {
  const F = filter
  let r = [...(semua.value ?? [])]
  if (F.mode === 'day') r = r.filter(x => x.date === F.date)
  else if (F.mode === 'month') r = r.filter(x => x.date.slice(0, 7) === F.month)
  else if (F.mode === 'year') r = r.filter(x => x.date.slice(0, 4) === String(F.year))
  else if (F.mode === 'range' && F.from && F.to) r = r.filter(x => x.date >= F.from && x.date <= F.to)
  if (F.fromHour) r = r.filter(x => (x.time || '') >= F.fromHour)
  if (F.toHour) r = r.filter(x => (x.time || '') <= F.toHour)
  if (F.status) r = r.filter(x => x.status === F.status)
  if (F.category) r = r.filter(x => (x.category || '') === F.category)
  if (F.dp) r = r.filter(x => x.dpStatus === F.dp)
  if (F.pic) r = r.filter(x => (x.picName || '') === F.pic)
  if (F.q) {
    const q = F.q.toLowerCase()
    r = r.filter(x => x.name.toLowerCase().includes(q) || x.phone.includes(q))
  }
  // This tab's search also matches the TABLE NUMBER — on the floor that is what
  // gets typed most (`:5797-5801`).
  if (cariLower.value) {
    r = r.filter(x => x.name.toLowerCase().includes(cariLower.value)
      || x.phone.includes(cariLower.value)
      || tablesOf(x).some(t => t.toLowerCase().includes(cariLower.value)))
  }
  // Floor LAST: it is the only filter that has to look at the table->floor map,
  // so let the cheap field comparisons drop rows first. A booking with no table
  // (floor unknown) never passes — forcing it into a floor would show it in a
  // place that is not necessarily right.
  if (F.lantai) {
    const peta = lantaiMap()
    const mau = Number(F.lantai)
    r = r.filter((x) => {
      const lantais = new Set<number>()
      for (const id of tablesOf(x)) {
        const f = peta.get(id)
        if (f) lantais.add(f)
      }
      return lantais.has(mau)
    })
  }
  return r.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
})

/** Cancelled is dropped after the other filters, and counted (`:5807-5816`). */
const batal = computed(() => (filter.status !== 'Cancelled' ? saringan.value.filter(r => r.status === 'Cancelled').length : 0))
const list = computed(() => (filter.status !== 'Cancelled' ? saringan.value.filter(r => r.status !== 'Cancelled') : saringan.value))

/** The map and the queue only ever describe one day. */
const dayList = computed(() => (semua.value ?? []).filter(r => r.date === tglDenah.value && r.status !== 'Cancelled'))
const basis = computed(() => (perTanggal.value ? dayList.value : list.value))

// --- the six numbers (`:5336-5355`) ------------------------------------------

const totalPax = computed(() => basis.value.filter(r => r.status !== 'No-show').reduce((a, r) => a + (Number(r.pax) || 0), 0))
const paxDatang = computed(() => basis.value.filter(r => r.status === 'Datang').reduce((a, r) => a + arrivedPax(r), 0))
const dpYes = computed(() => basis.value.filter(r => r.dpStatus === 'Sudah').length)

/** Only unconfirmed bookings need chasing: once it is "Confirmed" (or the guest
 *  has arrived) the host has already spoken to them (`:3871-3876`). */
const perluFollowUp = computed(() => (semua.value ?? []).filter(r => r.date === hariIni() && r.status === 'Pending').length)

const { master } = useDenah()
const { data: categories } = useSection<string[]>('categories')

const kap = computed(() => kapasitasTanggal(master.value, tglDenah.value))
const paxTgl = computed(() => (semua.value ?? [])
  .filter(r => r.date === tglDenah.value && !['Cancelled', 'No-show'].includes(r.status))
  .reduce((a, r) => a + (Number(r.pax) || 0), 0))
const pctKap = computed(() => (kap.value.pax ? Math.round(paxTgl.value / kap.value.pax * 100) : 0))

const namaPIC = computed(() => [...new Set((semua.value ?? []).map(r => r.picName).filter(Boolean))].sort((a, b) => a.localeCompare(b)))

const labelPeriode = computed(() => {
  if (filter.mode === 'day') return tglPendek(filter.date)
  if (filter.mode === 'month') return new Date(`${filter.month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  if (filter.mode === 'year') return String(filter.year)
  if (filter.mode === 'range') return `${tglPendek(filter.from)} – ${tglPendek(filter.to)}`
  return 'semua tanggal'
})

// --- pills (`:5458-5463`) ----------------------------------------------------

function setHari(n: number) {
  filter.mode = 'day'
  filter.date = tambahHari(hariIni(), n)
}
function set7Hari() {
  filter.mode = 'range'
  filter.from = hariIni()
  filter.to = tambahHari(hariIni(), 6)
}
function setBulanIni() {
  filter.mode = 'month'
  filter.month = hariIni().slice(0, 7)
}
const filterAktif = computed(() => filter.mode !== 'day' || filter.date !== hariIni() || !!filter.fromHour || !!filter.toHour
  || !!filter.status || !!filter.category || !!filter.lantai || !!filter.kursi || !!filter.dp || !!filter.pic || !!filter.q || !!cari.value)
function resetFilter() {
  Object.assign(filter, { mode: 'day', date: hariIni(), month: hariIni().slice(0, 7), year: new Date().getFullYear(), from: hariIni(), to: hariIni(), fromHour: '', toHour: '', status: '', category: '', lantai: '', kursi: '', dp: '', pic: '', q: '' })
  cari.value = ''
}

// --- the table (`:5467+`) -----------------------------------------------------

type Urut = keyof Reservasi | 'paxDatang' | 'dp'
const urut = ref<{ kolom: Urut, naik: boolean }>({ kolom: 'date', naik: true })
const hal = ref(1)
const perHal = ref(10)

const kolomUrut: { key: Urut, label: string, ambil: (r: Reservasi) => string | number }[] = [
  { key: 'date', label: 'Tanggal', ambil: r => `${r.date}${r.time}` },
  { key: 'name', label: 'Tamu', ambil: r => r.name },
  { key: 'pax', label: 'Pax', ambil: r => r.pax },
  { key: 'table', label: 'Meja', ambil: r => r.table },
  { key: 'dp', label: 'DP', ambil: r => dpTotal(r) },
  { key: 'status', label: 'Status', ambil: r => r.status },
]

const terurut = computed(() => {
  const k = kolomUrut.find(c => c.key === urut.value.kolom) ?? kolomUrut[0]!
  const arah = urut.value.naik ? 1 : -1
  return [...list.value].sort((a, b) => {
    const x = k.ambil(a)
    const y = k.ambil(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * arah
  })
})
const maxHal = computed(() => Math.max(1, Math.ceil(terurut.value.length / perHal.value)))
const halaman = computed(() => terurut.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([list, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

function urutkan(kolom: Urut) {
  urut.value = urut.value.kolom === kolom
    ? { kolom, naik: !urut.value.naik }
    : { kolom, naik: true }
}

const statusWarna: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  'Pending': 'warning',
  'Confirmed': 'success',
  'Datang': 'error',
  'Cancelled': 'neutral',
  'No-show': 'neutral',
}

/** The table and the phone list read the same rows (DESIGN.md). */
const kolom = computed<TableColumn<Reservasi>[]>(() => [
  { accessorKey: 'date', header: 'Tanggal', cell: ({ row }) => `${tglPendek(row.original.date)} ${row.original.time}` },
  { accessorKey: 'name', header: 'Tamu', cell: ({ row }) => row.original.name },
  { id: 'pax', header: 'Pax' },
  { accessorKey: 'table', header: 'Meja' },
  { id: 'dp', header: 'DP', cell: ({ row }) => rupiah(dpTotal(row.original)) },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
])

const statusPax = (r: Reservasi) => (r.status === 'Datang' ? `${arrivedPax(r)}/${r.pax} · sisa ${remainingPax(r)}` : String(r.pax || 0))
</script>

<template>
  <AppPage
    title="Dashboard & recap"
    description="Satu halaman: data reservasi, denah meja, dan antrean."
    :back="{ label: 'Semua layar', to: '/reservasi' }"
  >
    <div class="mb-5 flex flex-wrap gap-2">
      <UButton
        v-if="bolehEdit"
        label="Reservasi baru"
        to="/reservasi/input"
        size="xl"
      />
      <UButton
        label="WA koordinasi"
        color="neutral"
        variant="soft"
        size="xl"
        disabled
      />
      <UButton
        v-if="bolehAksi('master', role)"
        label="Atur denah"
        color="neutral"
        variant="soft"
        size="xl"
        disabled
      />
    </div>

    <!-- One AppFocus: the number the desk needs first, never a grid of big cards
         (DESIGN.md, and :5376-5380 — the old six cards filled two full rows and
         pushed the table off screen). -->
    <div class="mb-7 max-w-xl">
      <AppFocus
        label="Reservasi"
        :value="angka(basis.length)"
        :hint="`${labelPeriode} · ${angka(totalPax)} pax dipesan, ${angka(paxDatang)} datang`"
      />
    </div>

    <AppList title="Ringkasan">
      <AppListRow
        title="Pax datang / dipesan"
        :description="totalPax ? `${Math.round(paxDatang / totalPax * 100)}% realisasi` : 'Belum ada pax dipesan'"
        icon="i-lucide-users"
      >
        <template #trailing>
          {{ angka(paxDatang) }} / {{ angka(totalPax) }}
        </template>
      </AppListRow>
      <AppListRow
        title="Kapasitas terisi"
        :description="`${pctKap}% dari ${kap.meja} meja · ${tglPendek(tglDenah)}`"
        icon="i-lucide-armchair"
      >
        <template #trailing>
          {{ angka(paxTgl) }} / {{ angka(kap.pax) }}
        </template>
      </AppListRow>
      <AppListRow
        title="Sudah DP"
        :description="`${angka(basis.length - dpYes)} reservasi belum`"
        icon="i-lucide-wallet"
      >
        <template #trailing>
          {{ angka(dpYes) }} / {{ angka(basis.length) }}
        </template>
      </AppListRow>
      <AppListRow
        title="Perlu follow up"
        description="belum dikonfirmasi hari ini"
        icon="i-lucide-phone-call"
      >
        <template #trailing>
          <AppStatus
            :color="perluFollowUp ? 'warning' : 'neutral'"
          >
            {{ angka(perluFollowUp) }}
          </AppStatus>
        </template>
      </AppListRow>
    </AppList>

    <div class="mb-5 flex flex-wrap items-center gap-2">
      <UButton
        v-for="t in ([['list', 'Tabel'], ['calendar', 'Kalender'], ['map', 'Denah meja'], ['wait', 'Waiting list']] as const)"
        :key="t[0]"
        :label="t[1]"
        color="neutral"
        :variant="tab === t[0] ? 'soft' : 'ghost'"
        @click="tab = t[0]"
      />
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        placeholder="Cari nama tamu, nomor HP, atau meja…"
        class="max-w-xs"
      />
    </div>

    <AppList title="Filter">
      <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Periode">
          <USelect
            v-model="filter.mode"
            :items="[
              { value: 'day', label: 'Harian' },
              { value: 'month', label: 'Bulanan' },
              { value: 'year', label: 'Tahunan' },
              { value: 'range', label: 'Rentang' },
              { value: 'all', label: 'Semua' },
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="filter.mode === 'day'"
          label="Tanggal"
        >
          <UInput
            v-model="filter.date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="filter.mode === 'month'"
          label="Bulan"
        >
          <UInput
            v-model="filter.month"
            type="month"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="filter.mode === 'year'"
          label="Tahun"
        >
          <UInput
            v-model.number="filter.year"
            type="number"
            class="w-full"
          />
        </UFormField>
        <template v-if="filter.mode === 'range'">
          <UFormField label="Dari">
            <UInput
              v-model="filter.from"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sampai">
            <UInput
              v-model="filter.to"
              type="date"
              class="w-full"
            />
          </UFormField>
        </template>
        <!-- The map's date only appears when the period is more than one day. In
             Daily mode it is always the filter's date, and showing it invites
             the two to drift apart unnoticed. -->
        <UFormField
          v-if="filter.mode !== 'day'"
          label="Tanggal denah"
        >
          <UInput
            v-model="tglDenah"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam dari">
          <UInput
            v-model="filter.fromHour"
            placeholder="00:00"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam sampai">
          <UInput
            v-model="filter.toHour"
            placeholder="23:59"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="filter.status"
            :items="[{ value: '', label: 'Semua (tanpa cancelled)' }, 'Pending', 'Confirmed', 'Datang', 'Cancelled', 'No-show']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis reservasi">
          <USelect
            v-model="filter.category"
            :items="['', ...(categories ?? [])]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Lantai">
          <USelect
            v-model="filter.lantai"
            :items="[{ value: '', label: 'Semua' }, { value: '1', label: 'Lantai 1' }, { value: '2', label: 'Lantai 2' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="DP">
          <USelect
            v-model="filter.dp"
            :items="[{ value: '', label: 'Semua' }, 'Sudah', 'Belum']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="PIC">
          <USelect
            v-model="filter.pic"
            :items="[{ value: '', label: 'Semua' }, ...namaPIC]"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Tipe tamu"
          disabled
          help="Segera · G-07"
        >
          <p class="text-sm text-dimmed">
            Butuh riwayat kunjungan seluruh tamu, belum ada endpoint ringkas. <span class="text-dimmed">G-07</span>
          </p>
        </UFormField>
      </div>

      <div class="flex flex-wrap items-center gap-2 px-4 pb-4">
        <UButton
          label="Hari ini"
          color="neutral"
          :variant="filter.mode === 'day' && filter.date === hariIni() ? 'soft' : 'ghost'"
          size="sm"
          @click="setHari(0)"
        />
        <UButton
          label="Besok"
          color="neutral"
          :variant="filter.mode === 'day' && filter.date === tambahHari(hariIni(), 1) ? 'soft' : 'ghost'"
          size="sm"
          @click="setHari(1)"
        />
        <UButton
          label="Lusa"
          color="neutral"
          :variant="filter.mode === 'day' && filter.date === tambahHari(hariIni(), 2) ? 'soft' : 'ghost'"
          size="sm"
          @click="setHari(2)"
        />
        <UButton
          label="7 hari"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="set7Hari"
        />
        <UButton
          label="Bulan ini"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="setBulanIni"
        />
        <UButton
          v-if="filterAktif"
          label="Reset filter"
          color="error"
          variant="soft"
          size="sm"
          @click="resetFilter"
        />
        <span class="text-sm text-muted">
          {{ angka(list.length) }} reservasi · {{ labelPeriode }}
          <template v-if="batal">
            · <b>{{ angka(batal) }}</b> dibatalkan tidak ditampilkan
          </template>
        </span>
      </div>
    </AppList>

    <p
      v-if="status === 'pending'"
      class="mb-3 text-muted"
    >
      Memuat data…
    </p>

    <!-- Phone -->
    <AppList
      v-if="tab === 'list'"
      class="lg:hidden"
    >
      <AppListRow
        v-for="r in halaman"
        :key="r.id"
        :title="r.name"
        :description="`${tglPendek(r.date)} ${r.time} · meja ${r.table || '—'} · ${statusPax(r)} pax · ${rupiah(dpTotal(r))}`"
        icon="i-lucide-calendar-days"
        :to="`/reservasi/input?id=${r.id}`"
      >
        <template #trailing>
          <AppStatus :color="statusWarna[r.status]">
            {{ r.status }}
          </AppStatus>
        </template>
      </AppListRow>
      <p
        v-if="!halaman.length"
        class="px-4 py-3 text-muted"
      >
        Tidak ada reservasi di saringan ini.
      </p>
    </AppList>

    <!-- Desktop -->
    <div
      v-if="tab === 'list'"
      class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block"
    >
      <UTable
        :data="halaman"
        :columns="kolom"
        :loading="status === 'pending'"
        empty="Tidak ada reservasi di saringan ini."
      >
        <template #name-cell="{ row }">
          <ULink
            :to="`/reservasi/input?id=${row.original.id}`"
            class="font-semibold text-highlighted underline-offset-4 hover:underline"
          >
            {{ row.original.name }}
          </ULink>
        </template>
        <template #pax-cell="{ row }">
          {{ statusPax(row.original) }}
        </template>
        <template #status-cell="{ row }">
          <AppStatus :color="statusWarna[row.original.status]">
            {{ row.original.status }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <UButton
            label="Buka"
            color="neutral"
            variant="ghost"
            size="sm"
            :to="`/reservasi/input?id=${row.original.id}`"
          />
        </template>
      </UTable>
    </div>

    <AppList
      v-if="tab === 'list'"
      title="Urut & halaman"
    >
      <div class="flex flex-wrap items-center gap-2 p-4">
        <UButton
          v-for="c in kolomUrut"
          :key="c.key"
          :label="urut.kolom === c.key ? `${c.label} ${urut.naik ? '↑' : '↓'}` : c.label"
          color="neutral"
          :variant="urut.kolom === c.key ? 'soft' : 'ghost'"
          size="sm"
          @click="urutkan(c.key)"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
        <div class="flex items-center gap-2 text-sm text-muted">
          <span>Baris per halaman</span>
          <USelect
            v-model.number="perHal"
            :items="[10, 25, 50]"
            class="w-20"
          />
        </div>
        <div class="flex items-center gap-2 text-sm text-muted">
          <UButton
            label="Sebelumnya"
            color="neutral"
            variant="soft"
            size="sm"
            :disabled="hal <= 1"
            @click="hal--"
          />
          <span class="num">Hal {{ hal }} dari {{ maxHal }}</span>
          <UButton
            label="Berikutnya"
            color="neutral"
            variant="soft"
            size="sm"
            :disabled="hal >= maxHal"
            @click="hal++"
          />
        </div>
      </div>
      <p class="px-4 pb-4 text-sm text-dimmed">
        Paging di browser: server v1 belum menerima <code class="text-dimmed">page</code>/
        <code class="text-dimmed">perPage</code>. <span class="text-dimmed">G-08</span>
      </p>
    </AppList>

    <p
      v-else
      class="text-muted"
    >
      Tab {{ tab === 'calendar' ? 'Kalender' : tab === 'map' ? 'Denah meja' : 'Waiting list' }} sedang
      dibangun — lanjut di sesi berikutnya.
    </p>
  </AppPage>
</template>
