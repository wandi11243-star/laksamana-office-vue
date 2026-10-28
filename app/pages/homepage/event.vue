<!--
  Event — reimagine (B): antrean Siap tayang.

  Dulu satu daftar kandidat dengan saringan. Versi ini mengangkat event yang
  sudah boleh tayang tapi saklarnya masih mati menjadi antrean aksinya
  sendiri di atas daftar — pekerjaan staf di layar ini memang itu: memilih
  apa yang tampil malam ini. Referensi: antrean tayang di panel banner
  (Bevy/vAMSYS) yang memisah "bisa tayang" dari arsip.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { EventWeb } from '~/composables/useHomepage'
import { jam, rupiah, tglPendek } from '~/utils/format'

definePageMeta({ access: ['homepage'] })

const toast = useToast()
const me = useMe()
const router = useRouter()
const office = useEventWebOffice()
// The Event module screen may not exist yet in this app: only offer the link
// when there really is a route for it (an unreachable link is worse than none).
const punyaLayarEvent = computed(() => router.getRoutes().some(r => r.path === '/event'))
const bolehEvent = computed(() => punyaLayarEvent.value && !!me.value?.modules.includes('event'))

const { data, status: muat, error, refresh } = useEventWeb()

// Local copy so a toggle can update one row without reloading the lot.
const events = ref<EventWeb[]>([])

function ganti(row: EventWeb) {
  const i = events.value.findIndex(x => x.id === row.id)
  if (i >= 0) events.value.splice(i, 1, row)
}

// ─────────────────────────── posters ──
// The office poster route is behind Sanctum, so an <img src> cannot fetch it:
// pull the bytes through the API and show a blob URL. A missing poster is fine.

const poster = ref<Record<string, string>>({})
async function muatPoster(e: EventWeb) {
  if (!e.poster || poster.value[e.id]) return
  try {
    const url = await officeGambarUrl(e.poster)
    if (url) poster.value[e.id] = url
  }
  catch { /* the thumbnail is optional; a failure just leaves the placeholder */ }
}

watch(data, (d) => {
  events.value = d ? [...d] : []
  events.value.forEach(muatPoster)
}, { immediate: true })

onBeforeUnmount(() => {
  Object.values(poster.value).forEach(URL.revokeObjectURL)
})

// ─────────────────────────── filters ──

const saring = ref<string>('semua')
const tersaring = computed(() => events.value.filter(e =>
  saring.value === 'semua' || (saring.value === 'tampil') === e.tampil,
))

const jumlah = computed(() => ({
  semua: events.value.length,
  tampil: events.value.filter(e => e.tampil).length,
  belum: events.value.filter(e => !e.tampil).length,
}))

/** Antrean aksi layar ini: boleh tayang tapi saklarnya masih mati. */
const siapTayang = computed(() => events.value.filter(e => e.eligible && !e.tampil))

const chip = computed(() => [
  { value: 'semua', label: `Semua · ${jumlah.value.semua}` },
  { value: 'tampil', label: `Tampil · ${jumlah.value.tampil}` },
  { value: 'belum', label: `Belum tampil · ${jumlah.value.belum}` },
])

// ─────────────────────────── display ──

// EMS statuses. The Event module will own this map once it is built; here it is
// only what this screen needs to show a colour and a word (DESIGN rule 4).
type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral'
const STATUS_EVENT: Record<string, { color: Tone, icon: string }> = {
  Upcoming: { color: 'info', icon: 'i-lucide-calendar-clock' },
  Today: { color: 'success', icon: 'i-lucide-calendar-check' },
  Finished: { color: 'neutral', icon: 'i-lucide-circle-check' },
  Cancelled: { color: 'error', icon: 'i-lucide-circle-x' },
  Planning: { color: 'warning', icon: 'i-lucide-pencil-ruler' },
  Draft: { color: 'warning', icon: 'i-lucide-file-pen-line' },
}
const statusMeta = (s: string) => STATUS_EVENT[s] ?? { color: 'neutral' as Tone, icon: 'i-lucide-circle' }

/** A switch may move when the event can go on (eligible) or is on and can go off. */
const bolehUbah = (e: EventWeb) => e.eligible || e.tampil

function alasan(e: EventWeb): string {
  if (e.alasan === 'belum_upcoming') return `Belum disetujui (status: ${e.status})`
  if (e.alasan === 'sudah_lewat') return 'Sudah lewat'
  return 'Tidak bisa tampil'
}
const alasanTone = (e: EventWeb): Tone => (e.alasan === 'sudah_lewat' ? 'neutral' : 'warning')
const alasanIcon = (e: EventWeb) => (e.alasan === 'sudah_lewat' ? 'i-lucide-history' : 'i-lucide-clock')

const tgl = (e: EventWeb) => (e.start ? tglPendek(e.start.slice(0, 10)) : 'Belum ada tanggal')
const jamMulai = (e: EventWeb) => (e.start ? `${jam(e.start)} WIB` : '')
const jadwal = (e: EventWeb) => (e.start ? `${tgl(e)} · ${jamMulai(e)}` : 'Belum ada tanggal')
const harga = (e: EventWeb) => (e.price_from > 0 ? `Mulai dari ${rupiah(e.price_from)}` : '—')

const kolom: TableColumn<EventWeb>[] = [
  { accessorKey: 'poster', header: 'Poster' },
  { accessorKey: 'title', header: 'Event' },
  { accessorKey: 'start', header: 'Jadwal' },
  { accessorKey: 'price_from', header: 'Harga' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'tampil', header: 'Di website' },
]

// ─────────────────────────── write ──

const sibuk = ref<Record<string, boolean>>({})

async function toggle(row: EventWeb, tampil: boolean) {
  const lama = row.tampil
  ganti({ ...row, tampil })
  sibuk.value[row.id] = true
  try {
    ganti(await office.setTampilEvent(row.id, tampil))
    toast.add({ title: tampil ? 'Event akan tampil di website' : 'Event dihapus dari website', color: 'success' })
  }
  catch (e) {
    ganti({ ...row, tampil: lama })
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value[row.id] = false
  }
}
</script>

<template>
  <AppPage
    title="Event"
    description="Pilih event mana yang tampil di halaman Malam website. Data event diatur di modul Event."
  >
    <template #actions>
      <UButton
        label="Lihat di website"
        icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
        :to="websiteUrl('/')"
        target="_blank"
      />
    </template>

    <div
      v-if="error"
      class="rounded-panel border border-default bg-default p-6 text-center"
    >
      <p class="font-semibold text-highlighted">
        Event tidak bisa dimuat.
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ apiErrorMessage(error) }}
      </p>
      <UButton
        label="Coba lagi"
        class="mt-4"
        @click="refresh()"
      />
    </div>

    <template v-else>
      <!-- Data ownership: this screen never edits the event itself. -->
      <div class="mb-5 flex flex-wrap items-start gap-3 rounded-panel border border-info/30 bg-info/10 p-4">
        <UIcon
          name="i-lucide-info"
          class="mt-0.5 size-5 shrink-0 text-info"
        />
        <p class="min-w-0 flex-1 text-sm text-default">
          Judul, tanggal, poster dan harga event berasal dari modul Event. Layar ini hanya menentukan mana yang tampil di website.
        </p>
        <UButton
          v-if="bolehEvent"
          label="Buka modul Event"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="outline"
          size="sm"
          to="/event"
        />
      </div>

      <AppPanel
        v-if="siapTayang.length"
        title="Siap tayang"
        icon="i-lucide-siren"
        description="Sudah boleh tampil tapi saklarnya masih mati. Nyalakan yang mau tampil malam ini."
      >
        <ul class="divide-y divide-default">
          <li
            v-for="e in siapTayang"
            :key="e.id"
            class="flex items-center gap-3 py-2.5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-highlighted">
                {{ e.title }}
              </p>
              <p class="text-xs text-muted num">
                {{ jadwal(e) }} · {{ harga(e) }}
              </p>
            </div>
            <label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
              <USwitch
                :model-value="e.tampil"
                :disabled="sibuk[e.id]"
                color="success"
                :aria-label="`Tampil di website: ${e.title}`"
                @update:model-value="toggle(e, $event)"
              />
              <span class="text-muted">Belum tampil</span>
            </label>
          </li>
        </ul>
      </AppPanel>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <AppChips
          v-model="saring"
          :options="chip"
        />
      </div>

      <div
        v-if="muat === 'pending' && !events.length"
        class="space-y-2"
      >
        <USkeleton
          v-for="n in 4"
          :key="n"
          :ui="{ base: 'bg-accented/70' }"
          class="h-20 rounded-field"
        />
      </div>

      <div
        v-else-if="!events.length"
        class="rounded-panel border border-dashed border-accented bg-default px-6 py-12 text-center"
      >
        <UIcon
          name="i-lucide-mic-vocal"
          class="size-8 text-dimmed"
        />
        <p class="mt-3 font-semibold text-highlighted">
          Belum ada event
        </p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted">
          Event dari modul Event yang belum lewat akan muncul di sini untuk dipilih tampil di website.
        </p>
      </div>

      <p
        v-else-if="!tersaring.length"
        class="rounded-panel border border-default bg-default px-6 py-10 text-center text-sm text-muted"
      >
        Tidak ada event yang cocok dengan saringan ini.
      </p>

      <AppPanel
        v-else
        flush
        title="Kandidat event"
        :count="tersaring.length"
      >
        <!-- Phone: one card per event. -->
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="e in tersaring"
            :key="e.id"
            class="flex gap-3 p-3"
          >
            <div class="size-16 shrink-0 overflow-hidden rounded-field bg-muted">
              <img
                v-if="poster[e.id]"
                :src="poster[e.id]"
                alt=""
                loading="lazy"
                class="size-full object-cover"
              >
              <span
                v-else
                class="flex size-full items-center justify-center"
              >
                <UIcon
                  name="i-lucide-image"
                  class="size-5 text-dimmed"
                />
              </span>
            </div>

            <div class="min-w-0 flex-1">
              <p
                class="font-semibold leading-snug"
                :class="e.tampil ? 'text-highlighted' : 'text-muted'"
              >
                {{ e.title }}
              </p>
              <p class="mt-0.5 text-xs text-muted">
                {{ e.category || 'Tanpa kategori' }} · {{ e.venue }}
              </p>
              <p class="mt-1 text-xs text-muted num">
                {{ jadwal(e) }}
              </p>
              <p class="mt-0.5 text-sm font-semibold text-default num">
                {{ harga(e) }}
              </p>

              <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                <AppStatus
                  :color="statusMeta(e.status).color"
                  :icon="statusMeta(e.status).icon"
                  size="sm"
                >
                  {{ e.status || '—' }}
                </AppStatus>
                <AppStatus
                  v-if="!e.eligible"
                  :color="alasanTone(e)"
                  :icon="alasanIcon(e)"
                  size="sm"
                >
                  {{ alasan(e) }}
                </AppStatus>
              </div>

              <label class="mt-2 flex w-max cursor-pointer items-center gap-2 text-sm">
                <USwitch
                  :model-value="e.tampil"
                  :disabled="sibuk[e.id] || !bolehUbah(e)"
                  color="success"
                  @update:model-value="toggle(e, $event)"
                />
                <span :class="e.tampil ? 'font-semibold text-success' : 'text-muted'">{{ e.tampil ? 'Tampil di website' : 'Belum tampil' }}</span>
              </label>
            </div>
          </li>
        </ul>

        <!-- Desktop: the same rows as a table. -->
        <UTable
          :data="tersaring"
          :columns="kolom"
          class="hidden lg:block"
        >
          <template #poster-cell="{ row }">
            <div class="size-12 overflow-hidden rounded-field bg-muted">
              <img
                v-if="poster[row.original.id]"
                :src="poster[row.original.id]"
                alt=""
                loading="lazy"
                class="size-full object-cover"
              >
              <span
                v-else
                class="flex size-full items-center justify-center"
              >
                <UIcon
                  name="i-lucide-image"
                  class="size-4 text-dimmed"
                />
              </span>
            </div>
          </template>

          <template #title-cell="{ row }">
            <p
              class="font-semibold"
              :class="row.original.tampil ? 'text-highlighted' : 'text-muted'"
            >
              {{ row.original.title }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ row.original.category || 'Tanpa kategori' }} · {{ row.original.venue }}
            </p>
          </template>

          <template #start-cell="{ row }">
            <span class="whitespace-nowrap">{{ tgl(row.original) }}</span>
            <span
              v-if="row.original.start"
              class="block text-xs text-muted num"
            >{{ jamMulai(row.original) }}</span>
          </template>

          <template #price_from-cell="{ row }">
            <span class="whitespace-nowrap num">{{ harga(row.original) }}</span>
          </template>

          <template #status-cell="{ row }">
            <AppStatus
              :color="statusMeta(row.original.status).color"
              :icon="statusMeta(row.original.status).icon"
              size="sm"
            >
              {{ row.original.status || '—' }}
            </AppStatus>
          </template>

          <template #tampil-cell="{ row }">
            <div class="flex flex-col items-start gap-1">
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <USwitch
                  :model-value="row.original.tampil"
                  :disabled="sibuk[row.original.id] || !bolehUbah(row.original)"
                  color="success"
                  :aria-label="`Tampil di website: ${row.original.title}`"
                  @update:model-value="toggle(row.original, $event)"
                />
                <span :class="row.original.tampil ? 'font-semibold text-success' : 'text-muted'">{{ row.original.tampil ? 'Tampil' : 'Belum' }}</span>
              </label>
              <AppStatus
                v-if="!row.original.eligible"
                :color="alasanTone(row.original)"
                :icon="alasanIcon(row.original)"
                size="sm"
              >
                {{ alasan(row.original) }}
              </AppStatus>
            </div>
          </template>
        </UTable>
      </AppPanel>
    </template>
  </AppPage>
</template>
