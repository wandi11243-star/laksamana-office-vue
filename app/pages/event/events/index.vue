<!--
  Event Management — approved events with status tabs, period toggle, search
  and the event form (`event/index.html:6077-6367`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Acara, KelasTiket, OrderTiket, Refund } from '~/composables/useEvent'
import { removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { refundGantung } from '~/utils/event-refund'
import { bulanAktif, fmtTglJamEms, geserPeriode, rentangPeriodeEvent, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehBukaEvent, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('events', peranEvent(me.value)))
const bolehPlanning = computed(() => bolehBukaEvent('planning', peranEvent(me.value)))

// Upcoming by default, like evtFilter (`:4536`)
const tabStatus = ref('Upcoming')
const TABS = ['Approval', 'Upcoming', 'Event Done', 'Semua']
// '' | 'hari' | 'minggu' | 'bulan' | 'YYYY-MM' | 'YYYY-MM-DD' (`evtPeriode`).
const modePeriode = ref('')
const cari = ref('')

function aturPeriode(k: string) {
  modePeriode.value = k
  // A picked month or day opens the Semua tab: last month's shows are already
  // Event Done, and the other tabs would answer with an empty list — reading
  // as "that month had no shows" (`evtSetPeriode`).
  if (/^\d{4}-\d{2}/.test(k)) tabStatus.value = 'Semua'
}
function geserBulan(arah: -1 | 1) {
  aturPeriode(geserPeriode(modePeriode.value, arah))
}

const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-events')
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', {}, 'event-events-orders')
const { data: daftarRefund } = useDaftarEvent<Refund>('refunds', {}, 'event-events-refunds')
const { data: daftarKelas } = useDaftarEvent<KelasTiket>('ticket-classes', {}, 'event-events-kelas')
const tiket = (id: string) => {
  const k = daftarKelas.value.rows.filter(c => c.event_id === id)
  return { sold: k.reduce((a, c) => a + (Number(c.sold) || 0), 0), kuota: k.reduce((a, c) => a + (Number(c.quota) || 0), 0) }
}

const omzet = (id: string) => daftarOrder.value.rows
  .filter(o => (o.event_id as string) === id && (o.payment_status as string) === 'Paid')
  .reduce((a, o) => a + (Number(o.total) || 0), 0)

/** Approved events only — Planning & Prospect live on Perencanaan (`renderEvents` :6198). The period filters first, so "x dari y" means "in this period". Dates are WIB. */
const semua = computed(() => {
  const r = rentangPeriodeEvent(modePeriode.value)
  return daftar.value.rows.filter((e) => {
    if (e.status === 'Planning' || e.status === 'Prospect') return false
    const tgl = tglWIB(e.start_datetime)
    return !r || (!!tgl && tgl >= r.a && tgl <= r.b)
  })
})
const list = computed(() => {
  const cariL = cari.value.trim().toLowerCase()
  return semua.value.filter((e) => {
    if (tabStatus.value !== 'Semua' && String(e.status) !== tabStatus.value) return false
    if (cariL && ![e.title, e.venue, e.pic, e.category].filter(Boolean).join(' ').toLowerCase().includes(cariL)) return false
    return true
  }).sort((a, b) => String(b.start_datetime ?? '').localeCompare(String(a.start_datetime ?? '')))
})

const kolom: TableColumn<Acara>[] = [
  { id: 'acara', header: 'Event' },
  { id: 'tanggal', header: 'Tanggal' },
  { id: 'venue', header: 'Venue' },
  { id: 'pic', header: 'PIC' },
  { id: 'tiket', header: 'Tiket' },
  { id: 'omzet', header: 'Omzet' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
]

const hapusId = ref('')
const sheetHapus = computed({ get: () => hapusId.value !== '', set: v => (hapusId.value = v ? hapusId.value : '') })
// Paid orders block deletion (`hapusEvent :3024`): removing them would erase
// the trail of money that really came in. A hanging refund is named when it
// is the reason.
const infoHapus = computed(() => {
  const lunas = daftarOrder.value.rows.filter(o => o.event_id === hapusId.value && o.payment_status === 'Paid')
  const gantungN = lunas.filter(o => daftarRefund.value.rows.some(r => r.order_id === o.id && refundGantung(r, o))).length
  return {
    judul: daftar.value.rows.find(e => e.id === hapusId.value)?.title ?? '',
    lunas: lunas.length,
    gantung: gantungN,
  }
})
async function hapus() {
  const id = hapusId.value
  sheetHapus.value = false
  if (!id || infoHapus.value.lunas) return
  try {
    await removeEvent('events', id, daftar.value.versions[id])
    toast.add({ title: 'Event dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <EventGerbang lihat="events">
    <AppPage
      title="Event management"
      description="Event yang sudah disetujui manajemen"
    >
      <template #actions>
        <UButton
          v-if="bolehPlanning"
          color="neutral"
          variant="outline"
          to="/event/planning"
        >
          Lihat Perencanaan
        </UButton>
      </template>

      <AppPanel class="mb-4">
        <div class="flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="tabStatus"
            :options="TABS.map(t => ({ value: t, label: t }))"
          />
          <AppSeg
            v-model="modePeriode"
            :options="[
              { value: '', label: 'Semua' },
              { value: 'hari', label: 'Hari ini' },
              { value: 'minggu', label: 'Minggu ini' },
              { value: 'bulan', label: 'Bulan ini' },
            ]"
            size="sm"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-left"
            title="Bulan sebelumnya"
            @click="geserBulan(-1)"
          />
          <AppBulan
            :model-value="bulanAktif(modePeriode)"
            title="Pilih bulan"
            class="w-44"
            @update:model-value="(v) => { if (v) aturPeriode(String(v)) }"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-right"
            title="Bulan berikutnya"
            @click="geserBulan(1)"
          />
        </div>
        <div class="mt-2 flex items-center gap-2">
          <UInput
            v-model="cari"
            placeholder="Cari event, venue, atau PIC…"
            icon="i-lucide-search"
            class="max-w-md flex-1"
          />
          <span class="ms-auto text-xs text-muted num">{{ angka(list.length) }} dari {{ angka(semua.length) }} event</span>
        </div>
      </AppPanel>

      <AppPanel flush>
        <UTable
          :columns="kolom"
          :data="list"
          :loading="status === 'pending'"
          class="hidden lg:block"
        >
          <template #acara-cell="{ row }">
            <ULink
              :to="`/event/events/${row.original.id}`"
              class="flex items-center gap-2.5"
            >
              <EventPosterMini :poster="row.original.poster_img" />
              <span>
                <b class="block text-highlighted">{{ row.original.title || '(tanpa judul)' }}</b>
                <span class="block text-xs text-muted">{{ row.original.category }}</span>
              </span>
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
          <template #tiket-cell="{ row }">
            <span
              v-if="row.original.is_ticketed"
              class="num"
            >{{ tiket(row.original.id).sold }}{{ tiket(row.original.id).kuota ? ` / ${tiket(row.original.id).kuota}` : '' }}</span>
            <span
              v-else
              class="text-xs text-muted"
            >—</span>
          </template>
          <template #omzet-cell="{ row }">
            <span
              v-if="omzet(row.original.id)"
              class="num"
            >{{ rupiah(omzet(row.original.id)) }}</span>
            <span
              v-else
              class="text-xs text-muted"
            >—</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="STATUS_WARNA_EVENT[String(row.original.status)] ?? 'neutral'"
              :icon="STATUS_IKON_EVENT[String(row.original.status)]"
              size="sm"
            >
              {{ row.original.status }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <span class="flex gap-1">
              <UButton
                v-if="bolehUbah"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="hapusId = row.original.id"
              />
            </span>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="e in list"
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
                >
                  {{ e.status }}
                </AppStatus>
                <span class="text-xs text-muted num">{{ omzet(e.id) ? rupiah(omzet(e.id)) : '—' }}</span>
              </span>
            </ULink>
          </li>
        </ul>
        <p
          v-if="!list.length && status !== 'pending'"
          class="px-4 py-6 text-center text-sm text-dimmed"
        >
          {{ cari || modePeriode ? 'Tidak ada yang cocok dengan saringan ini.' : 'Belum ada event.' }}
        </p>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="sheetHapus"
        title="Hapus event?"
      >
        <p
          v-if="infoHapus.lunas"
          class="text-sm text-muted"
        >
          Event <b class="text-highlighted">{{ infoHapus.judul }}</b> sudah punya
          <b class="text-highlighted num">{{ angka(infoHapus.lunas) }} pesanan lunas</b>.
          Menghapusnya berarti menghapus jejak uang yang benar-benar masuk.
        </p>
        <p
          v-if="infoHapus.gantung"
          class="mt-2 text-sm text-muted"
        >
          <b class="text-highlighted num">{{ angka(infoHapus.gantung) }}</b> di antaranya refundnya sudah
          disetujui tapi belum diselesaikan — buka Ticketing › Penjualan lalu tekan Selesaikan refund (manajemen).
        </p>
        <p
          v-if="infoHapus.lunas"
          class="mt-2 text-sm text-muted"
        >
          Kalau acaranya batal, selesaikan lewat refund pada pesanan itu dulu. Kalau cuma ingin
          menyembunyikannya dari daftar aktif, ubah statusnya jadi Event Done.
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Event ini dihapus. Jadwal, tiket & penjualan yang sudah ada tidak ikut terhapus otomatis.
        </p>
        <template #footer>
          <UButton
            v-if="!infoHapus.lunas"
            color="error"
            loading-auto
            @click="hapus()"
          >
            Ya, hapus
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetHapus = false"
          >
            {{ infoHapus.lunas ? 'Tutup' : 'Batal' }}
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
