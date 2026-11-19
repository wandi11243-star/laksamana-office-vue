<!--
  Calendar — the old viewCalendar (howandi_life/index.html:715-743).
  The grid is assembled CLIENT-SIDE from events + open task deadlines +
  unfinished content (calItems, hlife.md D.2). Google Calendar stays the source
  of truth for time: one-click prefilled links and a full .ics export.
-->
<script setup lang="ts">
import type { HlifeContent, HlifeEvent, HlifeTask } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import type { CalItem } from '~/utils/hlife'
import { EVENT_TYPES, awalMingguHlife, calItems, icsDari, tautanGcal } from '~/utils/hlife'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: eventsData, refresh: refreshEvents } = useHlifeResource<HlifeEvent>('events')
const { data: tasksData } = useHlifeResource<HlifeTask>('tasks')
const { data: contentData } = useHlifeResource<HlifeContent>('content')

const events = computed(() => eventsData.value.rows)
const tasks = computed(() => tasksData.value.rows)
const content = computed(() => contentData.value.rows)

const sumber = computed(() => ({ events: events.value, tasks: tasks.value, content: content.value }))

// --- navigation state (`:490`, `:741-742`) ----------------------------------

type Mode = 'day' | 'few' | 'week' | 'month'
const mode = ref<Mode>('month')
const acuan = ref(new Date())

const MODES: { value: Mode, label: string }[] = [
  { value: 'day', label: '1 hari' },
  { value: 'few', label: '4 hari' },
  { value: 'week', label: 'Minggu' },
  { value: 'month', label: 'Bulan' },
]

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const p2 = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

function geser(dir: number) {
  const d = new Date(acuan.value)
  if (mode.value === 'month') d.setMonth(d.getMonth() + dir)
  else if (mode.value === 'week') d.setDate(d.getDate() + 7 * dir)
  else if (mode.value === 'few') d.setDate(d.getDate() + 4 * dir)
  else d.setDate(d.getDate() + dir)
  acuan.value = d
}

const label = computed(() => {
  if (mode.value === 'month') return acuan.value.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  if (mode.value === 'day') return acuan.value.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const mulai = mode.value === 'week' ? awalMingguHlife(acuan.value) : acuan.value
  const akhir = new Date(mulai)
  akhir.setDate(akhir.getDate() + (mode.value === 'week' ? 6 : 3))
  return `${mulai.getDate()} ${mulai.toLocaleDateString('id-ID', { month: 'short' })} – ${akhir.getDate()} ${akhir.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`
})

const hari = hariIni()

/** 42 cells of the month grid, Monday first (`monthCells`, `:743`). */
const selBulan = computed(() => {
  const y = acuan.value.getFullYear()
  const mo = acuan.value.getMonth()
  const first = new Date(y, mo, 1)
  const sd = (first.getDay() + 6) % 7
  const dim = new Date(y, mo + 1, 0).getDate()
  const pd = new Date(y, mo, 0).getDate()
  const out: { dn: number, iso: string, other: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    let dn: number
    let cd: Date
    let other = false
    if (i < sd) {
      dn = pd - sd + i + 1
      cd = new Date(y, mo - 1, dn)
      other = true
    }
    else if (i >= sd + dim) {
      dn = i - sd - dim + 1
      cd = new Date(y, mo + 1, dn)
      other = true
    }
    else {
      dn = i - sd + 1
      cd = new Date(y, mo, dn)
    }
    out.push({ dn, iso: toIso(cd), other })
  }
  return out
})

/** The columns for day/4-day/week (`calColumns`, `:728`). */
const kolomHari = computed(() => {
  const n = mode.value === 'week' ? 7 : mode.value === 'few' ? 4 : 1
  const start = mode.value === 'week' ? awalMingguHlife(acuan.value) : acuan.value
  const out: { iso: string, dow: string, dn: number }[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    out.push({ iso: toIso(d), dow: d.toLocaleDateString('id-ID', { weekday: 'short' }), dn: d.getDate() })
  }
  return out
})

const itemBulan = (iso: string) => calItems(iso, sumber.value)

// --- event sheet (`:940-943`) -----------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive<HlifeEvent>({ id: '', title: '', date: hari, start: '', end: '', type: 'event' })

function buka(e?: HlifeEvent, preset?: string) {
  Object.assign(form, e
    ? { ...e }
    : { id: '', title: '', date: preset || hari, start: '', end: '', type: 'event' })
  sheet.value = true
}

function muatUlang() {
  return refreshEvents()
}

async function simpan() {
  const title = form.title.trim()
  if (!title) {
    toast.add({ title: 'Judul wajib diisi.', color: 'error' })
    return
  }
  const body = { title, date: form.date, start: form.start, end: form.end, type: form.type }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = eventsData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi event belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('events', form.id, { ...body, id: form.id }, versi)
      toast.add({ title: 'Event diperbarui.', color: 'success' })
    }
    else {
      await createHlifeEvent(body)
      tawaranGcal.value = { ...body }
      bukaGcal.value = true
    }
    await refreshEvents()
    sheet.value = false
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapus() {
  if (!form.id) return
  const versi = eventsData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi event belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('events', form.id, versi)
    await refreshEvents()
    sheet.value = false
    toast.add({ title: 'Event dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

/** POST /events needs the API-generated id; the shared helper keeps types honest. */
function createHlifeEvent(body: Record<string, unknown>) {
  return createHlifeRecord<HlifeEvent>('events', body)
}

// Google Calendar offer after a new event (`:942`).
const bukaGcal = ref(false)
const tawaranGcal = ref<{ title: string, date: string, start: string, end: string } | null>(null)
function keGcal() {
  if (!tawaranGcal.value) return
  const t = tawaranGcal.value
  window.open(tautanGcal(t.title, t.date, t.start, t.end, 'Howandi Life OS'), '_blank')
  bukaGcal.value = false
}

const metaJenis = (jenis: CalItem['jenis']) =>
  jenis === 'event'
    ? { icon: 'i-lucide-calendar', class: 'bg-info/12 text-info' }
    : jenis === 'deadline'
      ? { icon: 'i-lucide-alarm-clock', class: 'bg-error/12 text-error' }
      : { icon: 'i-lucide-clapperboard', class: 'bg-vip/12 text-vip' }

// --- .ics export (`:574`) ---------------------------------------------------

function eksporIcs() {
  const ics = icsDari(sumber.value)
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'howandi-life-os.ics'
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'File .ics diunduh — import ke Google Calendar.', color: 'success' })
}

const opsiJenis = EVENT_TYPES.map(t => ({ value: t.value, label: t.label }))
</script>

<template>
  <AppPage
    title="Calendar"
    description="Google Calendar = single source of truth untuk waktu."
  >
    <template #actions>
      <UButton
        label="Event"
        icon="i-lucide-plus"
        @click="buka()"
      />
    </template>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <UIcon
          name="i-lucide-calendar-check"
          class="size-5 text-primary-600"
        />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-highlighted">
            Integrasi Google Calendar
          </p>
          <p class="text-sm text-muted">
            Event, deadline task & jadwal konten bisa dikirim 1-klik atau export .ics.
          </p>
        </div>
        <UButton
          label="Export .ics"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          loading-auto
          @click="eksporIcs"
        />
      </div>
    </AppPanel>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="outline"
          aria-label="Sebelumnya"
          @click="geser(-1)"
        />
        <span class="min-w-[190px] text-center font-display text-lg font-semibold text-highlighted">{{ label }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="outline"
          aria-label="Berikutnya"
          @click="geser(1)"
        />
        <UButton
          label="Hari ini"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="acuan = new Date()"
        />
      </div>
      <AppSeg
        v-model="mode"
        :options="MODES"
        size="sm"
      />
    </div>

    <!-- Month grid -->
    <div
      v-if="mode === 'month'"
      class="grid grid-cols-7 gap-px overflow-hidden rounded-panel border border-default bg-default"
    >
      <div
        v-for="d in DOW"
        :key="d"
        class="bg-muted px-1 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
      >
        {{ d }}
      </div>
      <div
        v-for="c in selBulan"
        :key="c.iso"
        class="min-h-24 border-t border-e border-default p-1.5"
        :class="c.other ? 'bg-muted/50' : 'bg-default'"
        @dblclick="buka(undefined, c.iso)"
      >
        <span
          class="inline-grid size-6 place-items-center rounded-full text-xs font-semibold num"
          :class="c.iso === hari ? 'bg-primary-600 text-white' : c.other ? 'text-dimmed' : 'text-highlighted'"
        >{{ c.dn }}</span>
        <button
          v-for="it in itemBulan(c.iso).slice(0, 3)"
          :key="`${it.jenis}-${it.id}-${it.t}`"
          type="button"
          class="mt-1 block w-full truncate rounded px-1 py-0.5 text-start text-[11px] font-semibold"
          :class="metaJenis(it.jenis).class"
          @click.stop="it.id && buka(events.find(e => e.id === it.id))"
        >
          {{ it.t }}
        </button>
        <p
          v-if="itemBulan(c.iso).length > 3"
          class="mt-0.5 px-1 text-[10px] text-muted num"
        >
          +{{ itemBulan(c.iso).length - 3 }} lagi
        </p>
      </div>
    </div>

    <!-- Day / 4-day / week columns -->
    <div
      v-else
      class="overflow-x-auto rounded-panel border border-default bg-default"
    >
      <div
        class="grid gap-px"
        :style="{ gridTemplateColumns: `repeat(${kolomHari.length}, minmax(180px, 1fr))` }"
      >
        <div
          v-for="k in kolomHari"
          :key="k.iso"
          class="min-w-0"
        >
          <div
            class="border-b border-default px-2 py-2 text-center"
            :class="k.iso === hari ? 'bg-primary-100' : 'bg-muted'"
          >
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              {{ k.dow }}
            </p>
            <p class="font-display text-lg font-semibold text-highlighted num">
              {{ k.dn }}
            </p>
          </div>
          <div
            class="min-h-40 space-y-1 p-2"
            @dblclick="buka(undefined, k.iso)"
          >
            <button
              v-for="it in calItems(k.iso, sumber)"
              :key="`${it.jenis}-${it.id}-${it.t}`"
              type="button"
              class="block w-full rounded px-2 py-1 text-start text-xs font-semibold"
              :class="metaJenis(it.jenis).class"
              @click="it.id && buka(events.find(e => e.id === it.id))"
            >
              <span
                v-if="it.time"
                class="num"
              >{{ it.time }}<template v-if="it.end">–{{ it.end }}</template> · </span>{{ it.t }}
            </button>
            <p
              v-if="!calItems(k.iso, sumber).length"
              class="py-3 text-center text-xs text-dimmed"
            >
              —
            </p>
          </div>
        </div>
      </div>
    </div>

    <p class="mt-2 text-xs text-muted">
      Klik ganda di tanggal kosong untuk menambah event. Deadline task dan konten belum posted ikut tampil.
    </p>

    <!-- Event form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit event' : 'Event baru'"
      lebar="sedang"
    >
      <div class="space-y-4">
        <UFormField
          label="Judul"
          required
        >
          <UInput
            v-model="form.title"
            placeholder="Judul event"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal">
            <AppTanggal
              v-model="form.date"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tipe">
            <USelect
              v-model="form.type"
              :items="opsiJenis"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Mulai">
            <AppJam
              v-model="form.start"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Selesai">
            <AppJam
              v-model="form.end"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UButton
          v-if="form.id && form.date"
          :to="tautanGcal(form.title, form.date, form.start, form.end, 'Howandi Life OS')"
          target="_blank"
          rel="noopener"
          label="Tambah ke Google Calendar"
          icon="i-lucide-calendar-plus"
          color="neutral"
          variant="soft"
          block
        />
        <UButton
          v-if="form.id"
          label="Hapus event"
          color="error"
          variant="soft"
          block
          @click="hapusSheet = true"
        />
      </div>
      <template #footer>
        <UButton
          :label="form.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSheet"
      title="Hapus event?"
    >
      <p class="text-sm text-muted">
        Event ini akan hilang dari kalender. Tindakan ini tidak bisa dibatalkan.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusSheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="bukaGcal"
      title="Event tersimpan"
      description="Tambahkan ke Google Calendar sekarang?"
    >
      <p class="text-sm text-muted">
        Google Calendar adalah sumber waktu utama. Membuka tautan akan mengisi detail event; kamu masih bisa mengubahnya di sana.
      </p>
      <template #footer>
        <UButton
          label="Buka Google Calendar"
          icon="i-lucide-calendar-plus"
          size="xl"
          @click="keGcal"
        />
        <UButton
          label="Nanti saja"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="bukaGcal = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
