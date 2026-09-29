<!--
  Riwayat Reservasi — the archive: past bookings, the CRM base, evaluation.
  Server paging (`halRecap`…) has no v1 endpoint (G-08), so the window loads
  and the page slices it in the browser. The default period is THIS MONTH, not
  "Semua": without server paging "Semua" pulls the whole table, and opening
  the screen should stay fast — "Semua" remains one tap away.

  Guest profiles come from the LOADED rows only (`ringkasTamu` is G-07); the
  card says so. Rows open the reservation's input page, the screen that
  already reads and edits one booking.
  Source: laksamana-office/deploy/reservasi/index.html:10041-10213.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi } from '~/composables/useReservasi'
import { useDaftarReservasi, useDenah } from '~/composables/useReservasi'
import { lantaiMap } from '~/utils/venue-layouts'
import { bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import { angka, hariIni, tglPendek } from '~/utils/format'
import {
  barisArsip, csvRiwayat, durasiDuduk, profilTamu, paxRiwayat, unduhCsv, urutArsip,
} from '~/utils/riwayat'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
const role = computed(() => roleReservasi(me.value))

// Reka UI forbids SelectItem value '' — "Semua" is the sentinel 'semua'.
const SEMUA = 'semua'
const cari = ref('')
const mode = ref<'all' | 'month' | 'year'>('month')
const bulan = ref(hariIni().slice(0, 7))
const tahun = ref(new Date().getFullYear())
const statusAkhir = ref(SEMUA)

const dari = computed(() => {
  if (mode.value === 'month') return `${bulan.value}-01`
  if (mode.value === 'year') return `${tahun.value}-01-01`
  return ''
})
const sampai = computed(() => {
  if (mode.value === 'month') {
    const [y, m] = bulan.value.split('-').map(Number)
    return `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
  }
  if (mode.value === 'year') return `${tahun.value}-12-31`
  return ''
})

const { data: semua, status } = useDaftarReservasi(dari, sampai, 'reservasi-riwayat')

const arsip = computed(() => urutArsip(barisArsip(semua.value ?? [], hariIni())))

const daftar = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return arsip.value.filter((r) => {
    if (statusAkhir.value !== SEMUA && r.status !== statusAkhir.value) return false
    if (q && !((r.name || '').toLowerCase().includes(q) || (r.phone || '').includes(q))) return false
    return true
  })
})

/** The CRM card reads the first FOUND row's phone, over the loaded rows. */
const profil = computed(() => {
  const pertama = cari.value.trim() && daftar.value.length ? daftar.value[0]! : null
  return pertama ? profilTamu(arsip.value, pertama.phone) : null
})

// --- client paging (G-08) ------------------------------------------------------

const hal = ref(1)
const perHal = ref(10)
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.length / perHal.value)))
const halaman = computed(() => daftar.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([daftar, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

// --- export --------------------------------------------------------------------

const { master } = useDenah()
const petaLantai = computed(() => lantaiMap(master.value))
const lantaiDari = (meja: string) => {
  const f = petaLantai.value.get(meja)
  return f || undefined
}

function ekspor() {
  if (!daftar.value.length) {
    toast.add({ title: 'Tidak ada baris untuk diekspor', color: 'error' })
    return
  }
  unduhCsv(`reservasi_laksamana_${hariIni()}.csv`, csvRiwayat(daftar.value, lantaiDari))
  toast.add({ title: 'CSV diunduh', color: 'success' })
}

// --- the table -------------------------------------------------------------------

const warnaStatus: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  'Pending': 'warning',
  'Confirmed': 'success',
  'Datang': 'success',
  'Cancelled': 'neutral',
  'No-show': 'neutral',
}

const kolom = computed<TableColumn<Reservasi>[]>(() => [
  { accessorKey: 'date', header: 'Tanggal' },
  { accessorKey: 'name', header: 'Tamu' },
  { accessorKey: 'pax', header: 'Pax' },
  { accessorKey: 'table', header: 'Meja' },
  { accessorKey: 'durasi', header: 'Durasi' },
  { accessorKey: 'dp', header: 'DP' },
  { accessorKey: 'status', header: 'Status' },
])
</script>

<template>
  <AppPage
    title="Riwayat reservasi"
    description="Arsip reservasi yang sudah lewat, basis CRM dan evaluasi. Cari nama/HP untuk lihat riwayat pelanggan."
    :back="{ label: 'Semua layar', to: '/reservasi' }"
  >
    <template v-if="bolehBuka('riwayat', role)">
      <div class="mb-7 max-w-xl">
        <AppFocus
          label="Arsip"
          :value="`${angka(daftar.length)} baris`"
          :hint="mode === 'month' ? `bulan ${bulan}` : mode === 'year' ? `tahun ${tahun}` : 'seluruh data yang dimuat'"
        />
      </div>

      <div class="mb-5 flex flex-wrap items-end gap-2">
        <UFormField
          label="Cari pelanggan"
          class="min-w-44 flex-1"
        >
          <UInput
            v-model="cari"
            placeholder="Nama / No HP"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Periode">
          <USelect
            v-model="mode"
            :items="[{ value: 'all', label: 'Semua' }, { value: 'month', label: 'Bulanan' }, { value: 'year', label: 'Tahunan' }]"
          />
        </UFormField>
        <UFormField
          v-if="mode === 'month'"
          label="Bulan"
        >
          <UInput
            v-model="bulan"
            type="month"
          />
        </UFormField>
        <UFormField
          v-if="mode === 'year'"
          label="Tahun"
        >
          <UInput
            v-model.number="tahun"
            type="number"
          />
        </UFormField>
        <UFormField label="Status akhir">
          <USelect
            v-model="statusAkhir"
            :items="[{ value: SEMUA, label: 'Semua' }, 'Datang', 'No-show', 'Cancelled']"
          />
        </UFormField>
        <UButton
          label="Export CSV"
          color="neutral"
          variant="soft"
          size="sm"
          @click="ekspor"
        />
      </div>

      <AppList
        v-if="profil"
        title="Pelanggan"
      >
        <AppListRow
          :title="profil.nama || '(tanpa nama)'"
          :description="`${profil.telepon}${profil.member ? `, member ${profil.memberNo}` : ''} · dihitung dari data yang dimuat (G-07)`"
          icon="i-lucide-user-round"
        />
        <AppListRow
          title="Total kunjungan"
          :description="`rata-rata ${profil.rataPax} pax`"
          icon="i-lucide-footprints"
        >
          <template #trailing>
            {{ angka(profil.kunjungan) }}
          </template>
        </AppListRow>
        <AppListRow
          title="No-show"
          :description="`dari ${angka(profil.totalBaris)} baris`"
          icon="i-lucide-user-x"
        >
          <template #trailing>
            {{ angka(profil.noShow) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Status"
          :description="profil.kunjunganTerakhir ? `terakhir ${tglPendek(profil.kunjunganTerakhir)}` : 'belum pernah datang'"
          icon="i-lucide-badge-check"
        >
          <template #trailing>
            <AppStatus :color="profil.blacklist ? 'error' : profil.vip ? 'success' : 'neutral'">
              {{ profil.blacklist ? 'Blacklist' : profil.vip ? 'VIP' : profil.tipe }}
            </AppStatus>
          </template>
        </AppListRow>
      </AppList>

      <div class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block">
        <UTable
          :data="halaman"
          :columns="kolom"
          :loading="status === 'pending'"
          empty="Belum ada riwayat."
        >
          <template #date-cell="{ row }">
            {{ tglPendek(row.original.date) }}
            <div class="text-muted">
              {{ row.original.time }}
            </div>
          </template>
          <template #name-cell="{ row }">
            <ULink
              :to="`/reservasi/input?id=${row.original.id}`"
              class="font-semibold text-highlighted underline-offset-4 hover:underline"
            >
              {{ row.original.name }}
            </ULink>
            <div class="text-muted">
              {{ row.original.phone }}
            </div>
          </template>
          <template #pax-cell="{ row }">
            <template v-if="paxRiwayat(row.original).datang !== null">
              <b class="num">{{ paxRiwayat(row.original).datang }}</b><span class="text-muted">/{{ paxRiwayat(row.original).dipesan }}</span>
            </template>
            <span
              v-else
              class="num"
            >{{ paxRiwayat(row.original).dipesan }}</span>
          </template>
          <template #table-cell="{ row }">
            {{ row.original.table || '-' }}
          </template>
          <template #durasi-cell="{ row }">
            <span class="text-muted">{{ durasiDuduk(row.original) !== null ? `${durasiDuduk(row.original)} m` : '-' }}</span>
          </template>
          <template #dp-cell="{ row }">
            <AppStatus :color="row.original.dpStatus === 'Sudah' ? 'success' : 'neutral'">
              {{ row.original.dpStatus === 'Sudah' ? 'Sudah' : '-' }}
            </AppStatus>
          </template>
          <template #status-cell="{ row }">
            <AppStatus :color="warnaStatus[row.original.status] ?? 'neutral'">
              {{ row.original.status }}
            </AppStatus>
          </template>
        </UTable>
      </div>

      <AppList
        title="Arsip"
        class="lg:hidden"
      >
        <AppListRow
          v-for="r in halaman"
          :key="r.id"
          :title="`${r.name} · ${r.pax} pax`"
          :description="`${tglPendek(r.date)} ${r.time} · ${r.table || 'tanpa meja'} · ${r.status}`"
          icon="i-lucide-history"
          :to="`/reservasi/input?id=${r.id}`"
        >
          <template #trailing>
            <AppStatus :color="warnaStatus[r.status] ?? 'neutral'">
              {{ r.status }}
            </AppStatus>
          </template>
        </AppListRow>
        <p
          v-if="!halaman.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada riwayat.
        </p>
      </AppList>

      <AppList title="Halaman">
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
      </AppList>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
