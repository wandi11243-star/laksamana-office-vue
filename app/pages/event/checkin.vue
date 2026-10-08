<!--
  Check-In (Hari H) — event picker, three stat cards, live seat summary,
  QR token check and the guest list (`event/index.html:10086-10728`).

  Camera decoding needs a QR library (new dependency) — the camera buttons
  show "Segera"; token paste + "Cek token ini" and list check-in work fully.
  Cancelling a check-in is "Segera (G-10)": legacy DELETED the row
  (`:10717`), v1 is append-only without delete, and the correction row
  (K-09 = C) waits on the API. Occupancy = masuk/tickets (`:10374`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Acara, KelasTiket, Kursi, Tiket } from '~/composables/useEvent'
import { listCheckins, postCheckin, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, persen } from '~/utils/format'
import { CHECKIN_IKON, CHECKIN_WARNA } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('checkin', peranEvent(me.value)))

const { data: daftarAcara } = useDaftarEvent<Acara>('events', {}, 'event-checkin-events')
const berTiket = computed(() => daftarAcara.value.rows.filter(e => e.is_ticketed))
const eventId = ref('')

watch(berTiket, (l) => {
  if (!eventId.value && l.length) eventId.value = l[0]!.id
}, { immediate: true })

const qTiket = computed<Record<string, string>>(() => (eventId.value ? { event_id: eventId.value } : { event_id: '__kosong__' }))
const { data: daftarTiket, status, refresh: refreshTiket } = useDaftarEvent<Tiket>('tickets', qTiket, 'event-checkin-tickets')
const { data: daftarKursi, refresh: refreshKursi } = useDaftarEvent<Kursi>('seats', qTiket, 'event-checkin-seats')
const { data: daftarKelas } = useDaftarEvent<KelasTiket>('ticket-classes', qTiket, 'event-checkin-classes')

const checkins = ref<Awaited<ReturnType<typeof listCheckins>>['data']>([])
async function muatCheckin() {
  try {
    checkins.value = await listCheckins().then(r => r.data)
  }
  catch {
    // A failed poll must not blank the page; the manual reload shows the error.
  }
}
watch(eventId, muatCheckin, { immediate: true })

// Partial refresh every 20s so an open camera/scroll position survives (`:1623`)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      muatCheckin()
      refreshTiket()
      refreshKursi()
    }
  }, 20000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const tiket = computed(() => daftarTiket.value.rows.filter(t => !eventId.value || t.event_id === eventId.value))
const idCheckin = computed(() => new Set(checkins.value.filter(c => (c.result ?? 'Valid') === 'Valid').map(c => c.ticket_id)))
const masuk = computed(() => tiket.value.filter(t => idCheckin.value.has(t.id)).length)
const keterisian = computed(() => (tiket.value.length ? Math.round(masuk.value / tiket.value.length * 100) : 0))

// Live seat summary (the live map, as a list)
const kursiTerisi = computed(() => {
  const m = new Map<string, number>()
  for (const t of tiket.value) {
    if (t.seat_id && idCheckin.value.has(t.id)) m.set(t.seat_id, (m.get(t.seat_id) ?? 0) + 1)
  }
  return m
})

// --- guest list (`:10146`): chips, category filter, search, pager 10 ---
const chip = ref<'belum' | 'sudah' | 'semua'>('belum')
const CHIPS = [
  { value: 'belum', label: 'Belum datang' },
  { value: 'sudah', label: 'Sudah datang' },
  { value: 'semua', label: 'Semua' },
] as { value: 'belum' | 'sudah' | 'semua', label: string }[]
const fKelas = ref('semua')
const cari = ref('')
const hal = ref(1)
const PER_HAL = 10

const namaKelas = (id?: string) => daftarKelas.value.rows.find(c => c.id === id)?.name ?? '—'
const daftar = computed(() => {
  const cariL = cari.value.trim().toLowerCase()
  return tiket.value.filter((t) => {
    const sudah = idCheckin.value.has(t.id)
    if (chip.value === 'belum' && sudah) return false
    if (chip.value === 'sudah' && !sudah) return false
    if (fKelas.value !== 'semua' && t.ticket_class_id !== fKelas.value) return false
    if (cariL && !(String((t as Record<string, unknown>).buyer_name ?? t.qr_token ?? '').toLowerCase().includes(cariL) || String(t.qr_token ?? '').toLowerCase().includes(cariL))) return false
    return true
  })
})
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.length / PER_HAL)))
const halaman = computed(() => daftar.value.slice((hal.value - 1) * PER_HAL, hal.value * PER_HAL))
watch([daftar, chip, fKelas, cari], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

const kolom: TableColumn<Tiket>[] = [
  { id: 'tamu', header: 'Tamu' },
  { id: 'kelas', header: 'Kelas' },
  { id: 'kursi', header: 'Kursi' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: 'Aksi' },
]
const namaTamu = (t: Tiket) => String((t as Record<string, unknown>).buyer_name ?? (t as Record<string, unknown>).name ?? t.qr_token ?? '—')

async function checkin(t: Tiket) {
  try {
    await postCheckin({ ticket_id: t.id, result: 'Valid' })
    toast.add({ title: `${namaTamu(t)} check-in`, color: 'success' })
    await Promise.all([muatCheckin(), refreshTiket()])
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatCheckin))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- token check (`doScan`: paste token + "Cek token ini") ---
const token = ref('')
const hasilToken = ref<Tiket | null | undefined>(undefined)
function cekToken() {
  const v = token.value.trim()
  if (!v) {
    toast.add({ title: 'Tempel token dulu.', color: 'error' })
    return
  }
  hasilToken.value = tiket.value.find(t => t.qr_token === v) ?? null
}
</script>

<template>
  <AppPage
    title="Check-in"
    description="Scan QR · kursi terisi langsung"
  >
    <template #actions>
      <USelect
        v-model="eventId"
        :items="berTiket.map(e => ({ value: e.id, label: e.title }))"
        placeholder="Pilih event"
        class="w-56"
      />
    </template>

    <AppStatGrid class="mb-4">
      <AppStat
        label="Total tiket"
        :value="angka(tiket.length)"
        icon="i-lucide-ticket"
        tone="info"
      />
      <AppStat
        label="Checked-in"
        :value="angka(masuk)"
        icon="i-lucide-scan-line"
        tone="success"
      />
      <AppStat
        label="Keterisian"
        :value="persen(keterisian / 100)"
        icon="i-lucide-armchair"
        tone="gold"
      />
    </AppStatGrid>

    <div class="grid gap-4 lg:grid-cols-2">
      <AppPanel
        title="Kursi terisi langsung"
        icon="i-lucide-armchair"
      >
        <p class="mb-2 text-xs text-muted num">
          {{ angka(kursiTerisi.size) }} kursi terisi dari {{ angka(daftarKursi.rows.length) }} titik denah
        </p>
        <ul
          v-if="kursiTerisi.size"
          class="max-h-56 space-y-1 overflow-y-auto text-sm"
        >
          <li
            v-for="[sid, n] in [...kursiTerisi.entries()].slice(0, 30)"
            :key="sid"
            class="flex justify-between rounded-field bg-success/12 px-2.5 py-1"
          >
            <b class="text-success">{{ sid }}</b>
            <span class="text-muted num">{{ n }} masuk</span>
          </li>
        </ul>
        <p
          v-else
          class="py-4 text-center text-sm text-dimmed"
        >
          Belum ada kursi terisi.
        </p>
      </AppPanel>

      <AppPanel
        title="Scanner QR"
        icon="i-lucide-scan-line"
      >
        <div class="flex gap-2">
          <UInput
            v-model="token"
            placeholder="Tempel token QR…"
            icon="i-lucide-clipboard-paste"
            class="flex-1"
          />
          <UButton
            color="primary"
            @click="cekToken()"
          >
            Cek token ini
          </UButton>
        </div>
        <div
          v-if="hasilToken !== undefined"
          class="mt-3"
        >
          <UAlert
            v-if="hasilToken === null"
            color="error"
            variant="soft"
            title="Token tidak dikenal di event ini"
          />
          <div
            v-else-if="hasilToken"
            class="flex items-center justify-between gap-2 rounded-field border border-default px-3 py-2 text-sm"
          >
            <span><b class="text-highlighted">{{ namaTamu(hasilToken) }}</b> · {{ namaKelas(hasilToken.ticket_class_id) }}</span>
            <UButton
              v-if="bolehUbah && !idCheckin.has(hasilToken.id)"
              color="success"
              size="sm"
              @click="checkin(hasilToken!)"
            >
              Check-in
            </UButton>
            <AppStatus
              v-else-if="idCheckin.has(hasilToken.id)"
              color="success"
              icon="i-lucide-check"
              size="sm"
            >
              Sudah datang
            </AppStatus>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted">
          Pindai kamera <span class="text-dimmed">Segera</span> — butuh pustaka QR. Tempel token manual bisa dipakai sekarang.
        </p>
      </AppPanel>
    </div>

    <AppPanel
      title="Daftar tamu"
      icon="i-lucide-clipboard-list"
      flush
      class="mt-4"
    >
      <template #head>
        <div class="flex flex-wrap items-center gap-2 px-4 pt-3">
          <AppChips
            v-model="chip"
            :options="CHIPS"
          />
          <USelect
            v-model="fKelas"
            :items="[{ value: 'semua', label: 'Semua kelas' }, ...daftarKelas.rows.map(c => ({ value: c.id, label: c.name }))]"
            class="w-44"
          />
          <UInput
            v-model="cari"
            placeholder="Cari nama / token…"
            icon="i-lucide-search"
            class="min-w-44 flex-1"
          />
        </div>
      </template>
      <UTable
        :columns="kolom"
        :data="halaman"
        :loading="status === 'pending'"
        class="mt-3 hidden lg:block"
      >
        <template #tamu-cell="{ row }">
          <b class="text-highlighted">{{ namaTamu(row.original) }}</b>
        </template>
        <template #kelas-cell="{ row }">
          {{ namaKelas(row.original.ticket_class_id) }}
        </template>
        <template #kursi-cell="{ row }">
          {{ row.original.seat_id || '—' }}
        </template>
        <template #status-cell="{ row }">
          <AppStatus
            :color="idCheckin.has(row.original.id) ? CHECKIN_WARNA['Valid']! : CHECKIN_WARNA['Belum datang']!"
            :icon="idCheckin.has(row.original.id) ? CHECKIN_IKON['Valid'] : CHECKIN_IKON['Belum datang']"
            size="sm"
          >
            {{ idCheckin.has(row.original.id) ? 'Sudah datang' : 'Belum datang' }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <span class="flex gap-1">
            <UButton
              v-if="bolehUbah && !idCheckin.has(row.original.id)"
              color="success"
              variant="outline"
              size="sm"
              @click="checkin(row.original)"
            >
              Check-in
            </UButton>
            <UButton
              v-if="bolehUbah && idCheckin.has(row.original.id)"
              color="neutral"
              variant="ghost"
              size="sm"
              disabled
              title="Segera (G-10): pembatalan menunggu baris koreksi di API"
            >
              Batalkan
            </UButton>
          </span>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="t in halaman"
          :key="t.id"
          class="flex items-center gap-2 px-4 py-2.5"
        >
          <span class="min-w-0 flex-1">
            <b class="block truncate text-sm text-highlighted">{{ namaTamu(t) }}</b>
            <span class="block truncate text-xs text-muted">{{ namaKelas(t.ticket_class_id) }}{{ t.seat_id ? ` · ${t.seat_id}` : '' }}</span>
          </span>
          <UButton
            v-if="bolehUbah && !idCheckin.has(t.id)"
            color="success"
            variant="outline"
            size="sm"
            @click="checkin(t)"
          >
            Check-in
          </UButton>
          <AppStatus
            v-else-if="idCheckin.has(t.id)"
            color="success"
            icon="i-lucide-check"
            size="sm"
          >
            Sudah datang
          </AppStatus>
        </li>
      </ul>
      <div class="flex items-center justify-between px-4 py-3 text-xs text-muted">
        <span class="num">{{ daftar.length ? `${(hal - 1) * PER_HAL + 1}–${Math.min(hal * PER_HAL, daftar.length)} dari ${angka(daftar.length)}` : '0 dari 0' }}</span>
        <span class="flex gap-1">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-left"
            :disabled="hal <= 1"
            @click="hal--"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-right"
            :disabled="hal >= maxHal"
            @click="hal++"
          />
        </span>
      </div>
    </AppPanel>
  </AppPage>
</template>
