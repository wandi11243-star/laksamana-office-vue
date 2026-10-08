<!--
  Event Management — approved events with status tabs, period toggle, search
  and the event form (`event/index.html:6077-6367`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Acara } from '~/composables/useEvent'
import { createEvent, removeEvent, updateEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, hariIni, rupiah, tambahHari, tglPendek } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const bolehUbah = computed(() => bolehUbahEvent('events', peranEvent(me.value)))

const tabStatus = ref('Semua')
const TABS = ['Approval', 'Upcoming', 'Event Done', 'Semua']
const modePeriode = ref<'semua' | 'hari' | 'minggu' | 'bulan'>('semua')
const cari = ref('')

const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-events')
const { data: daftarOrder } = useDaftarEvent('orders', {}, 'event-events-orders')

const omzet = (id: string) => daftarOrder.value.rows
  .filter(o => (o.event_id as string) === id && (o.payment_status as string) === 'Paid')
  .reduce((a, o) => a + (Number(o.total) || 0), 0)

const list = computed(() => {
  const h = hariIni()
  const cariL = cari.value.trim().toLowerCase()
  return daftar.value.rows.filter((e) => {
    if (tabStatus.value !== 'Semua' && String(e.status) !== tabStatus.value) return false
    const tgl = String(e.start_datetime ?? '').slice(0, 10)
    if (modePeriode.value === 'hari' && tgl !== h) return false
    if (modePeriode.value === 'minggu' && (tgl < h || tgl > tambahHari(h, 6))) return false
    if (modePeriode.value === 'bulan' && tgl.slice(0, 7) !== h.slice(0, 7)) return false
    if (cariL && !`${e.title} ${e.venue} ${e.pic}`.toLowerCase().includes(cariL)) return false
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
  { id: 'aksi', header: 'Hapus' },
]

// --- edit uses the same form; PIC stays as stored (`:6352`) ---
const sheet = ref(false)
const sunting = ref<Acara | null>(null)
function bukaBaru() {
  sunting.value = null
  sheet.value = true
}
function bukaSunting(e: Acara) {
  sunting.value = e
  sheet.value = true
}
async function simpan(body: Record<string, unknown>) {
  sheet.value = false
  try {
    if (sunting.value) {
      await updateEvent('events', sunting.value.id, { ...sunting.value, ...body }, daftar.value.versions[sunting.value.id])
      toast.add({ title: 'Event disimpan', color: 'success' })
    }
    else {
      await createEvent('events', {
        ...body,
        status: 'Planning',
        createdBy: namaSaya.value,
        createdById: me.value?.id ?? '',
        createdAt: Date.now(),
      })
      toast.add({ title: 'Event baru dibuat', color: 'success' })
    }
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const hapusId = ref('')
const sheetHapus = computed({ get: () => hapusId.value !== '', set: v => (hapusId.value = v ? hapusId.value : '') })
async function hapus() {
  const id = hapusId.value
  sheetHapus.value = false
  if (!id) return
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
  <AppPage
    title="Event management"
    description="Event yang sudah disetujui manajemen"
  >
    <template #actions>
      <UButton
        v-if="bolehUbah"
        color="primary"
        icon="i-lucide-plus"
        @click="bukaBaru()"
      >
        Event baru
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
            { value: 'semua', label: 'Semua' },
            { value: 'hari', label: 'Hari ini' },
            { value: 'minggu', label: 'Minggu ini' },
            { value: 'bulan', label: 'Bulan ini' },
          ]"
          size="sm"
        />
      </div>
      <div class="mt-2 flex items-center gap-2">
        <UInput
          v-model="cari"
          placeholder="Cari event, venue, atau PIC…"
          icon="i-lucide-search"
          class="max-w-md flex-1"
        />
        <span class="ms-auto text-xs text-muted num">{{ angka(list.length) }} dari {{ angka(daftar.rows.length) }} event</span>
      </div>
    </AppPanel>

    <AppPanel
      title="Daftar event"
      icon="i-lucide-party-popper"
      flush
    >
      <UTable
        :columns="kolom"
        :data="list"
        :loading="status === 'pending'"
        class="hidden lg:block"
      >
        <template #acara-cell="{ row }">
          <ULink
            :to="`/event/events/${row.original.id}`"
            class="flex items-center gap-2"
          >
            <b class="text-highlighted">{{ row.original.title }}</b>
            <span class="text-xs text-muted">{{ row.original.category }}</span>
          </ULink>
        </template>
        <template #tanggal-cell="{ row }">
          {{ tglPendek(String(row.original.start_datetime ?? '').slice(0, 10)) }}
        </template>
        <template #venue-cell="{ row }">
          {{ row.original.venue || '—' }}
        </template>
        <template #pic-cell="{ row }">
          {{ row.original.pic || '—' }}
        </template>
        <template #tiket-cell="{ row }">
          <ULink
            v-if="row.original.is_ticketed"
            :to="`/event/ticketing/${row.original.id}`"
            class="text-primary-700 num"
          >
            Kelola
          </ULink>
          <span v-else>—</span>
        </template>
        <template #omzet-cell="{ row }">
          <span class="num">{{ rupiah(omzet(row.original.id)) }}</span>
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
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              @click="bukaSunting(row.original)"
            />
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
            <span class="mt-0.5 block text-xs text-muted">{{ tglPendek(String(e.start_datetime ?? '').slice(0, 10)) }} · {{ e.venue || '—' }} · {{ e.pic || '—' }}</span>
            <span class="mt-1.5 flex items-center gap-2">
              <AppStatus
                :color="STATUS_WARNA_EVENT[String(e.status)] ?? 'neutral'"
                :icon="STATUS_IKON_EVENT[String(e.status)]"
                size="sm"
              >
                {{ e.status }}
              </AppStatus>
              <span class="text-xs text-muted num">{{ rupiah(omzet(e.id)) }}</span>
            </span>
          </ULink>
        </li>
      </ul>
      <p
        v-if="!list.length && status !== 'pending'"
        class="px-4 py-6 text-center text-sm text-dimmed"
      >
        Tidak ada event yang cocok.
      </p>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="sunting ? 'Edit event' : 'Event baru'"
    >
      <EventForm
        :awal="sunting ?? undefined"
        :pic-terkunci="namaSaya"
        @simpan="simpan($event)"
        @batal="sheet = false"
      />
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus event?"
    >
      <p class="text-sm text-muted">
        Event ini dihapus. Jadwal, tiket & penjualan yang sudah ada tidak ikut terhapus otomatis.
      </p>
      <template #footer>
        <UButton
          color="error"
          @click="hapus()"
        >
          Ya, hapus
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="sheetHapus = false"
        >
          Batal
        </UButton>
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
