<!--
  BD OS › Calendar (old `vCalendar`, deploy/bd/index.html). Month keeps the
  old grid (only a TASK deadline can be dragged to another day). Hari & Minggu
  are an hour grid (`BdJamGrid`): timed agendas and timed tasks are blocks on
  a 07:00–22:00 grid, everything timeless sits in the "tanpa jam" strip.

  Hour-grid gestures (snap 15 minutes): drag an empty slot to draft a timed
  agenda, drag a block to move its time/day, drag a block's bottom edge to
  change its end, drag a timeless task chip onto the grid to give it a time.
  Only the organiser, a module admin, or (for team agendas) anyone may move
  an agenda — a moved schedule drops every RSVP answer. The grid is
  horizontally scrollable on a phone; a tap still opens the row.
-->
<script setup lang="ts">
import type { BdAgenda, BdTask } from '~/composables/useBd'
import { bdTulisDiam, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import { listReservations } from '~/composables/useReservasi'
import {
  PILIHAN_SEMUA, awalMinggu, cariAku, divisiTerpakai, isoOf, labelJam, lingkupIds, pics, saringLingkup, selesai, todayISO,
} from '~/utils/bd-rumus'
import BdAgendaSheet from '~/widgets/bd/BdAgendaSheet.vue'
import BdJamGrid from '~/widgets/bd/BdJamGrid.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import { BULAN, tambahHari } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, refresh: muatBd } = useBdState()
const fPics = useState<string[]>('bd-fPics', () => [])
const f = useState('bd-proj-filter', () => ({ scope: 'semua', div: PILIHAN_SEMUA }))

const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (o: { pics?: string[], pic?: string }) => !fPics.value.length || pics(o).some(id => fPics.value.includes(id))

/** Hour-grid mode (Hari/Minggu) plus the old month grid. Week is the default, like the old panel. */
const mode = useState<'hari' | 'minggu' | 'bulan'>('bd-cal-mode', () => 'minggu')
const jangkar = ref(todayISO())
const hariList = computed(() => {
  if (mode.value === 'hari') return [jangkar.value]
  const senin = awalMinggu(jangkar.value)
  return Array.from({ length: 7 }, (_, i) => tambahHari(senin, i))
})
function geser(n: number) {
  if (mode.value === 'hari') jangkar.value = tambahHari(jangkar.value, n)
  else if (mode.value === 'minggu') jangkar.value = tambahHari(jangkar.value, n * 7)
  else geserBulan(n)
}
function keHariIni() {
  jangkar.value = todayISO()
  bulanIni()
}
const labelJangkar = computed(() => {
  if (mode.value === 'hari') return hariList.value[0]!
  if (mode.value === 'minggu') return `${hariList.value[0]} – ${hariList.value[6]}`
  return label.value
})

/** Tasks drawn on the hour grid: same scope/division/pic filter as the month grid. */
const tasksKal = computed(() => saringLingkup(state.value.tasks, f.value.scope, lingkup.value, aku.value?.id)
  .filter(cocokPic)
  .filter(t => (f.value.div === PILIHAN_SEMUA || t.div === f.value.div) && t.deadline && !selesai(t)))

interface CalItem { date: string, title: string, jenis: string, tone: 'error' | 'vip' | 'info' | 'warning' | 'gold', id?: string, geser?: boolean }

const items = computed<CalItem[]>(() => {
  const out: CalItem[] = []
  // Deadline — unfinished BD tasks (the only kind that can be dragged).
  saringLingkup(state.value.tasks, f.value.scope, lingkup.value, aku.value?.id).filter(cocokPic)
    .filter(t => (f.value.div === PILIHAN_SEMUA || t.div === f.value.div) && t.deadline && !selesai(t))
    .forEach(t => out.push({ date: t.deadline, title: `${t.name}${labelJam(t.jam)}`, jenis: 'Deadline', tone: 'error', id: t.id, geser: true }))
  // Meeting — BD's own agenda.
  state.value.agenda.forEach((e) => {
    if (e.date) out.push({ date: e.date, title: e.title, jenis: 'Meeting', tone: 'gold', id: e.id })
  })
  // Event — the venue's own nights (Event module range, read-only).
  for (const it of kalEvent.value) {
    if (it.tanggal) out.push({ date: it.tanggal, title: it.judul, jenis: 'Event', tone: 'vip' })
  }
  // Marketing — Deal acara + Assisted VIP (range, no money). Multi-day acara
  // are drawn on every day they cover.
  for (const it of kalMkt.value) {
    if (!it.tanggal) continue
    const akhir = it.selesai && it.selesai > it.tanggal ? it.selesai : it.tanggal
    for (let d = it.tanggal; d <= akhir; d = tambahHari(d, 1)) out.push({ date: d, title: it.judul, jenis: 'Marketing', tone: 'info' })
  }
  // Reservasi — booked guests in the same span (read-only).
  for (const r of kalRsv.value) {
    const tgl = String(r.date || '').slice(0, 10)
    if (tgl) out.push({ date: tgl, title: String(r.name || 'Reservasi'), jenis: 'Reservasi', tone: 'warning' })
  }
  return out
})

const awal = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const label = computed(() => `${BULAN[awal.value.getMonth()]} ${awal.value.getFullYear()}`)
function geserBulan(n: number) {
  awal.value = new Date(awal.value.getFullYear(), awal.value.getMonth() + n, 1)
}
function bulanIni() {
  const d = new Date()
  awal.value = new Date(d.getFullYear(), d.getMonth(), 1)
}

const hariIni = todayISO()
const sel = computed(() => {
  const y = awal.value.getFullYear()
  const mo = awal.value.getMonth()
  const mulaiDow = (new Date(y, mo, 1).getDay() + 6) % 7
  const jml = new Date(y, mo + 1, 0).getDate()
  const out: { iso: string, hari: number, luar: boolean, items: CalItem[] }[] = []
  const push = (d: Date, luar: boolean) => {
    const iso = isoOf(d)
    out.push({ iso, hari: d.getDate(), luar, items: items.value.filter(x => x.date === iso) })
  }
  for (let i = 0; i < mulaiDow; i++) push(new Date(y, mo, 1 - mulaiDow + i), true)
  for (let d = 1; d <= jml; d++) push(new Date(y, mo, d), false)
  const total = mulaiDow + jml
  for (let k = total; k < Math.ceil(total / 7) * 7; k++) push(new Date(y, mo, jml + (k - total) + 1), true)
  return out
})
/** Phone: one row per day of the month that has something. */
const hariBerisi = computed(() => sel.value.filter(c => !c.luar && c.items.length))

/** One range row from the Event / Marketing calendar bands (no money fields). */
interface BandLuar { tanggal: string, judul: string, selesai?: string }

/**
 * The month grid's visible span, leading/trailing days included. Derived
 * from `awal` alone — not from `sel`, which depends on the fetched bands, or
 * every band response would change the key and refetch the bands again.
 */
const rentangBulan = computed(() => {
  const y = awal.value.getFullYear()
  const mo = awal.value.getMonth()
  const mulaiDow = (new Date(y, mo, 1).getDay() + 6) % 7
  const total = mulaiDow + new Date(y, mo + 1, 0).getDate()
  return {
    dari: isoOf(new Date(y, mo, 1 - mulaiDow)),
    sampai: isoOf(new Date(y, mo, 1 - mulaiDow + Math.ceil(total / 7) * 7 - 1)),
  }
})
const kunciRentang = computed(() => `${rentangBulan.value.dari}_${rentangBulan.value.sampai}`)

// External bands: read-only ranges from the sibling modules, drawn on the
// month grid only (the hour grid keeps BD's own agenda + tasks). A module
// that errors — or is not granted to this user — is named in the ribbon.
const { data: kalEvent, error: kalEventGagal, refresh: muatKalEvent } = useAsyncData('bd-kal-event',
  () => useApi()<Envelope<{ items: BandLuar[] }>>('/event/events-range', { query: { ...rentangBulan.value } }).then(r => r.data.items),
  { watch: [kunciRentang], default: () => [] })
const { data: kalMkt, error: kalMktGagal, refresh: muatKalMkt } = useAsyncData('bd-kal-marketing',
  () => useApi()<Envelope<{ items: BandLuar[] }>>('/marketing/agenda-range', { query: { ...rentangBulan.value } }).then(r => r.data.items),
  { watch: [kunciRentang], default: () => [] })
const { data: kalRsv, error: kalRsvGagal, refresh: muatKalRsv } = useAsyncData('bd-kal-reservasi',
  () => listReservations(rentangBulan.value.dari, rentangBulan.value.sampai).then(r => r.data),
  { watch: [kunciRentang], default: () => [] })
const pitaLuar = computed(() => [
  kalEventGagal.value ? 'Event' : '',
  kalMktGagal.value ? 'Marketing' : '',
  kalRsvGagal.value ? 'Reservasi' : '',
].filter(Boolean))

const skop = [
  { value: 'tim', label: 'Tim saya' },
  { value: 'saya', label: 'Ditugaskan ke saya' },
  { value: 'semua', label: 'Semua' },
]
/** Division filter stays on used-only: tasks, projects, POs and agenda share it. */
const opsiDiv = computed(() => [
  { value: PILIHAN_SEMUA, label: 'Semua divisi' },
  ...divisiTerpakai([
    ...state.value.tasks, ...state.value.projects, ...state.value.po, ...state.value.agenda,
  ]).map(d => ({ value: d, label: d })),
])
const resetAktif = computed(() => fPics.value.length || f.value.div !== PILIHAN_SEMUA || f.value.scope !== 'semua')
function reset() {
  fPics.value = []
  f.value = { ...f.value, div: PILIHAN_SEMUA, scope: 'semua' }
}

// ---- agenda & task sheets ----
const bukaAgenda = ref(false)
const agendaPilih = ref<BdAgenda | null>(null)
const agendaAwal = ref<{ date?: string, start?: string, end?: string } | null>(null)
function bukaAgendaSheet(e?: BdAgenda, awal?: { date?: string, start?: string, end?: string } | null) {
  agendaPilih.value = e || null
  agendaAwal.value = awal || null
  bukaAgenda.value = true
}
/** Open a drawn agenda for RSVP/peserta editing — deadlines have their own task form. */
function bukaAgendaId(id?: string) {
  if (!id) return
  bukaAgendaSheet(state.value.agenda.find(x => x.id === id) || undefined)
}
/** A slot drawn on the hour grid becomes a timed agenda draft. */
function buatAgendaSlot(awal: { date: string, start?: string, end?: string }) {
  bukaAgendaSheet(undefined, awal)
}
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
function bukaTaskSheet(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}

let dragId: string | null = null
function dragMulai(ev: DragEvent, id: string) {
  dragId = id
  ev.dataTransfer?.setData('text/plain', id)
}
function dropHari(iso: string) {
  const t = state.value.tasks.find(x => x.id === dragId) as BdTask | undefined
  dragId = null
  if (!t || t.deadline === iso) return
  bdTulisDiam(() => tambalBd<BdTask>('tasks', t.id, { deadline: iso }, versiBaris(t)))
}

// ---- auto-refresh: fresh state about every 20 s, yielding to the crew ----
// The old client polled `getAll` on the same cadence
// (`deploy/bd/index.html:1364`), cancelling or deferring its tick while the
// crew typed or saved, so keystrokes were never lost and saves never queued
// behind a poll (`:1330-1362`, `:3119-3120`). Same rule here, like the
// reservasi dashboard poll (`app/pages/reservasi/dashboard.vue:1448-1470`):
// an open sheet, a focused field, an in-flight drag, or a fresh scroll skips
// this tick and the next tick tries again — never a forced redraw.
const POLL_JEDA = 20000
let pollTimer: ReturnType<typeof setInterval> | undefined
let sedangSeret = false
let akhirGulir = 0
function tandaiSeret(v: boolean) {
  sedangSeret = v
}
function tandaiGulir() {
  akhirGulir = Date.now()
}
/** True while the crew owns the screen — a refresh now would redraw under them. */
function pollDitunda() {
  // An open sheet owns the data (the save it fires refreshes by itself).
  if (bukaAgenda.value || bukaTask.value) return true
  // A month-grid deadline drag still in the crew's hands.
  if (dragId || sedangSeret || Date.now() - akhirGulir < 2000) return true
  // Focus inside a field: the crew is typing (sheet inputs, quick-add boxes).
  const el = document.activeElement as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return true
  return document.visibilityState !== 'visible'
}
function tickPoll() {
  if (pollDitunda()) return
  void muatBd()
  void muatKalEvent()
  void muatKalMkt()
  void muatKalRsv()
}
const seretMulai = () => tandaiSeret(true)
const seretSelesai = () => tandaiSeret(false)
onMounted(() => {
  window.addEventListener('dragstart', seretMulai)
  window.addEventListener('dragend', seretSelesai)
  window.addEventListener('drop', seretSelesai)
  window.addEventListener('scroll', tandaiGulir, { passive: true })
  pollTimer = setInterval(tickPoll, POLL_JEDA)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  window.removeEventListener('dragstart', seretMulai)
  window.removeEventListener('dragend', seretSelesai)
  window.removeEventListener('drop', seretSelesai)
  window.removeEventListener('scroll', tandaiGulir)
})
</script>

<template>
  <AppPage
    title="Calendar"
    description="Deadline, meeting, event, marketing & reservasi."
  >
    <template #actions>
      <AppSeg
        v-model="mode"
        :options="[
          { value: 'hari', label: 'Hari' },
          { value: 'minggu', label: 'Minggu' },
          { value: 'bulan', label: 'Bulan' },
        ]"
        size="sm"
      />
      <div class="inline-flex items-center overflow-hidden rounded-full border border-default">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Sebelumnya"
          @click="geser(-1)"
        />
        <span class="px-2 text-sm font-semibold text-highlighted">{{ labelJangkar }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Berikutnya"
          @click="geser(1)"
        />
      </div>
      <UButton
        label="Hari ini"
        color="neutral"
        variant="outline"
        size="sm"
        @click="keHariIni"
      />
      <UButton
        label="Agenda"
        icon="i-lucide-plus"
        @click="bukaAgendaSheet(undefined, { date: mode === 'bulan' ? todayISO() : jangkar })"
      />
    </template>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Lingkup">
          <USelect
            v-model="f.scope"
            :items="skop"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <BdPicFilter
          v-model="fPics"
          :people="people"
        />
        <div class="flex-1" />
        <UButton
          v-if="resetAktif"
          label="Reset"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          size="sm"
          @click="reset"
        />
      </div>
    </AppPanel>

    <UAlert
      v-if="pitaLuar.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Kalender ${pitaLuar.join(', ')} tak menjawab — hanya jadwal BD yang digambar.`"
      class="mb-4"
    />

    <AppPanel
      title="Kalender"
      icon="i-lucide-calendar-days"
      :description="labelJangkar"
    >
      <BdJamGrid
        v-if="mode !== 'bulan'"
        :agenda="state.agenda"
        :tasks="tasksKal"
        :aku-id="aku?.id"
        :hari="hariList"
        @buka-agenda="bukaAgendaSheet($event)"
        @buat-agenda="buatAgendaSlot"
        @buka-task="bukaTaskSheet"
      />
      <div
        v-else
        class="hidden lg:block"
      >
        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="d in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']"
            :key="d"
            class="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted"
          >
            {{ d }}
          </div>
          <div
            v-for="c in sel"
            :key="c.iso"
            class="min-h-24 rounded-md border p-1.5"
            :class="[c.luar ? 'border-default bg-muted/40 opacity-60' : 'border-default bg-default', c.iso === hariIni ? 'ring-2 ring-yellow-deep' : '']"
            @dragover.prevent
            @drop="dropHari(c.iso)"
          >
            <span
              class="text-xs font-semibold"
              :class="c.iso === hariIni ? 'text-ink-900' : 'text-muted'"
            >{{ c.hari }}</span>
            <div class="mt-1 grid gap-1">
              <span
                v-for="(e, i) in c.items.slice(0, 4)"
                :key="i"
                class="block truncate rounded border px-1 py-0.5 text-[10.5px] font-semibold"
                :class="[
                  e.tone === 'error' ? 'border-error/40 bg-error/10 text-error'
                  : e.tone === 'vip' ? 'border-lilac-light bg-lilac-light text-ink-900'
                    : e.tone === 'info' ? 'border-info/40 bg-info/10 text-info'
                      : e.tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning'
                        : 'border-yellow-deep bg-yellow-light text-yellow-dark',
                  e.geser ? 'cursor-grab' : (e.id ? 'cursor-pointer' : ''),
                ]"
                :title="`${e.jenis} — ${e.title}`"
                :draggable="e.geser ? 'true' : 'false'"
                @dragstart="e.geser && e.id && dragMulai($event, e.id)"
                @click="!e.geser && e.id && bukaAgendaId(e.id)"
              >{{ e.title }}</span>
              <span
                v-if="c.items.length > 4"
                class="text-[10px] text-dimmed"
              >+{{ c.items.length - 4 }} lagi</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="mode === 'bulan'"
        class="grid gap-3 lg:hidden"
      >
        <div
          v-for="c in hariBerisi"
          :key="c.iso"
          class="rounded-panel border border-default p-3"
          :class="c.iso === hariIni ? 'ring-2 ring-yellow-deep' : ''"
        >
          <p
            class="text-sm font-semibold"
            :class="c.iso === hariIni ? 'text-ink-900' : 'text-highlighted'"
          >
            {{ c.hari }} — {{ c.items.length }} agenda
          </p>
          <div class="mt-2 grid gap-1.5">
            <span
              v-for="(e, i) in c.items"
              :key="i"
              class="block rounded border px-2 py-1 text-xs font-semibold"
              :class="[e.tone === 'error' ? 'border-error/40 bg-error/10 text-error'
                         : e.tone === 'vip' ? 'border-lilac-light bg-lilac-light text-ink-900'
                           : e.tone === 'info' ? 'border-info/40 bg-info/10 text-info'
                             : e.tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning'
                               : 'border-yellow-deep bg-yellow-light text-yellow-dark',
                       !e.geser && e.id ? 'cursor-pointer' : '']"
              :title="`${e.jenis} — ${e.title}`"
              @click="!e.geser && e.id && bukaAgendaId(e.id)"
            >{{ e.jenis }} — {{ e.title }}</span>
          </div>
        </div>
        <p
          v-if="!hariBerisi.length"
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada agenda bulan ini</b>
        </p>
      </div>

      <div
        v-if="mode === 'bulan'"
        class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-default pt-3 text-xs text-muted"
      >
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-error" /> Deadline task</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-brand-yellow" /> Meeting</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-lilac-light" /> Event</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-info" /> Marketing</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-warning" /> Reservasi</span>
        <span class="text-ink-900">Seret <b>deadline task</b> ke kotak lain untuk memindahkan tanggalnya (di HP: buka task dan ubah deadlinenya).</span>
      </div>
    </AppPanel>

    <BdAgendaSheet
      v-model:open="bukaAgenda"
      :agenda="agendaPilih"
      :people="people"
      :aku="aku"
      :awal="agendaAwal"
    />
    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="state.tasks"
      :projects="state.projects"
      :people="people"
      :aku="aku"
    />
  </AppPage>
</template>
