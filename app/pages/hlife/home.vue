<!--
  Command Center (home) — the old viewHome (howandi_life/index.html:594-620).

  Everything here is read from GET /state; the four settings it can change
  (mood, energy, focus, weeklyTarget) and the brain dump go through
  PUT /settings/{key} with a version, and the habit toggles through
  PUT /habits/{id}. The old 400 ms `saveAll` debounce is gone: text fields save
  on blur, a dial saves on click (U4, hlife.md F.9).
-->
<script setup lang="ts">
import type { HlifeHabit, HlifeSettingKey, HlifeTask } from '~/composables/useHlife'
import {
  saveHlifeSetting, updateHlifeRecord, useHlifeResource, useHlifeSettings, useHlifeState,
} from '~/composables/useHlife'
import type { CalItem } from '~/utils/hlife'
import {
  bizRevTotal, bulanAgg, bulanLedger, calItems, fmtDue, netWorth, persenGoal, rupiahRingkas, terlambat, totalAssets,
} from '~/utils/hlife'
import { lencanaTugas } from '~/utils/status-hlife'
import { LAYAR_HLIFE } from '~/utils/layar/hlife'
import { angka, hariIni } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: state, status, error } = useHlifeState()
const { data: setelan, refresh: refreshSetelan } = useHlifeSettings()
const { data: habitsData, refresh: refreshHabits } = useHlifeResource<HlifeHabit>('habits')
// Tasks come from their own resource so the done/undone toggle sees the
// per-record version a write must echo (`GET /state` carries no versions).
const { data: tasksData, refresh: refreshTasks } = useHlifeResource<HlifeTask>('tasks')

const hari = hariIni()
const tahun = new Date().getFullYear()

const s = computed(() => state.value)
const tugas = computed(() => tasksData.value.rows)
const proyek = computed(() => s.value?.projects ?? [])
const bisnis = computed(() => s.value?.businesses ?? [])
const goals = computed(() => s.value?.goals ?? [])
const aset = computed(() => s.value?.assets ?? [])
const ledger = computed(() => s.value?.finance?.ledger ?? [])
const habits = computed(() => habitsData.value.rows)
const dump = computed<string[]>(() => (Array.isArray(setelan.value.values.dump) ? setelan.value.values.dump as string[] : []))

const mood = ref(3)
const energi = ref(3)
const fokus = ref('')
const targetMinggu = ref('')
watch(() => setelan.value.values, (v) => {
  mood.value = Number(v.mood) || 3
  energi.value = Number(v.energy) || 3
  fokus.value = String(v.focus ?? '')
  targetMinggu.value = String(v.weeklyTarget ?? '')
}, { immediate: true, deep: true })

/** The top 5 open tasks: overdue first, then importance, then the nearest deadline (`:597`). */
const top5 = computed(() => tugas.value.filter(t => !t.done).sort((a, b) => {
  const oa = terlambat(a) ? 1 : 0
  const ob = terlambat(b) ? 1 : 0
  if (oa !== ob) return ob - oa
  const qa = (a.important ? 2 : 0) + (a.urgent ? 1 : 0)
  const qb = (b.important ? 2 : 0) + (b.urgent ? 1 : 0)
  if (qa !== qb) return qb - qa
  return (a.due || '9999') < (b.due || '9999') ? -1 : 1
}).slice(0, 5))

const lewat = computed(() => tugas.value.filter(terlambat))
const selesai = computed(() => tugas.value.filter(t => t.done).length)

const hariIniItems = computed<CalItem[]>(() => calItems(hari, {
  events: s.value?.events ?? [],
  tasks: tugas.value,
  content: s.value?.content ?? [],
}))

const bulanTerakhir = computed(() => bulanLedger(ledger.value).slice(-1)[0])
const agg = computed(() => (bulanTerakhir.value ? bulanAgg(ledger.value, bulanTerakhir.value) : null))

const milestoneTahun = computed(() => (s.value?.roadmap ?? []).filter(r => r.year === tahun))
const milestoneSelesai = computed(() => milestoneTahun.value.filter(r => r.done).length)

const tanggalPanjang = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const el = computed(() => error.value ? apiErrorMessage(error.value) : '')

async function simpanSetelan(key: HlifeSettingKey, value: unknown) {
  const v = setelan.value.versions[key]
  if (v === undefined) {
    toast.add({ title: 'Versi setelan belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  try {
    await saveHlifeSetting(key, value, v)
    await refreshSetelan()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshSetelan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

function setDial(key: 'mood' | 'energy', v: number) {
  if (key === 'mood') mood.value = v
  else energi.value = v
  simpanSetelan(key, v)
}

let tundaFokus: ReturnType<typeof setTimeout> | null = null
function simpanFokus() {
  if (tundaFokus) clearTimeout(tundaFokus)
  tundaFokus = setTimeout(() => simpanSetelan('focus', fokus.value), 350)
}
let tundaTarget: ReturnType<typeof setTimeout> | null = null
function simpanTarget() {
  if (tundaTarget) clearTimeout(tundaTarget)
  tundaTarget = setTimeout(() => simpanSetelan('weeklyTarget', targetMinggu.value), 350)
}

const dumpBaru = ref('')
function tambahDump() {
  const v = dumpBaru.value.trim()
  if (!v) return
  dumpBaru.value = ''
  simpanSetelan('dump', [v, ...dump.value])
}
function hapusDump(i: number) {
  const next = dump.value.slice()
  next.splice(i, 1)
  simpanSetelan('dump', next)
}

async function toggleHabit(h: HlifeHabit) {
  const versi = habitsData.value.versions[h.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi habit belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  const ada = h.dates.includes(hari)
  const dates = ada ? h.dates.filter(d => d !== hari) : [...h.dates, hari]
  const streak = ada ? Math.max(0, (h.streak || 0) - 1) : (h.streak || 0) + 1
  try {
    await updateHlifeRecord('habits', h.id, { ...h, dates, streak }, versi)
    await refreshHabits()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshHabits))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function toggleTugas(t: HlifeTask) {
  const versi = tasksData.value.versions[t.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi task belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  try {
    await updateHlifeRecord('tasks', t.id, { ...t, done: !t.done }, versi)
    await refreshTasks()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTasks))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// Plain buttons that write: no double click while the write runs.
const { jalan, lagi } = useSibuk()
</script>

<template>
  <AppPage
    title="Command Center"
    description="Satu halaman. Semua kondisi hari ini."
  >
    <template #actions>
      <UButton
        label="Task baru"
        icon="i-lucide-plus"
        to="/hlife/tasks?new=1"
      />
    </template>

    <p
      v-if="el"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
      role="alert"
    >
      {{ el }}
    </p>

    <!-- Cockpit: date, focus, mood/energy dials (`:605-606`). -->
    <section class="mb-5 rounded-panel border border-default bg-default p-4 shadow-panel lg:p-5">
      <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-primary-700">
            {{ tanggalPanjang }}
          </p>
          <label class="mt-3 block text-[11px] font-bold uppercase tracking-wide text-muted">Fokus utama hari ini</label>
          <UTextarea
            v-model="fokus"
            :rows="2"
            placeholder="Apa satu hal terpenting hari ini?"
            class="mt-1 w-full"
            @blur="simpanFokus"
          />
        </div>
        <div class="flex gap-8 lg:justify-end">
          <div class="text-center">
            <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Mood
            </p>
            <div
              class="flex gap-1"
              role="group"
              aria-label="Mood"
            >
              <button
                v-for="i in 5"
                :key="i"
                type="button"
                class="h-7 w-3.5 rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                :class="i <= mood ? 'border-primary-400 bg-primary-500' : 'border-default bg-muted'"
                :aria-label="`Mood ${i}`"
                :aria-pressed="i <= mood"
                @click="setDial('mood', i)"
              />
            </div>
          </div>
          <div class="text-center">
            <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Energi
            </p>
            <div
              class="flex gap-1"
              role="group"
              aria-label="Energi"
            >
              <button
                v-for="i in 5"
                :key="i"
                type="button"
                class="h-7 w-3.5 rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                :class="i <= energi ? 'border-success bg-success' : 'border-default bg-muted'"
                :aria-label="`Energi ${i}`"
                :aria-pressed="i <= energi"
                @click="setDial('energy', i)"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="status === 'pending' && !state"
      class="mb-5 space-y-2"
    >
      <!-- Loading cards mirror the Command Center panels below. -->
      <div class="grid gap-5 lg:grid-cols-3">
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-28 rounded-panel"
        />
      </div>
      <p class="pt-1 text-sm text-muted">
        Memuat Command Center…
      </p>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <!-- Wealth snapshot (`:608`) -->
      <AppPanel
        title="Wealth snapshot"
        icon="i-lucide-landmark"
      >
        <template #actions>
          <UButton
            label="Detail"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hlife/finance"
          />
        </template>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Net worth
            </p>
            <p class="font-display text-lg font-bold text-primary-700 num">
              {{ rupiahRingkas(netWorth(aset)) }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Total aset
            </p>
            <p class="font-display text-lg font-bold text-highlighted num">
              {{ rupiahRingkas(totalAssets(aset)) }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Avg rev/thn
            </p>
            <p class="font-display text-lg font-bold text-highlighted num">
              {{ rupiahRingkas(bizRevTotal(bisnis)) }}
            </p>
          </div>
        </div>
        <p
          v-if="agg"
          class="mt-3 text-sm text-muted"
        >
          Surplus {{ bulanTerakhir }}: personal <b class="text-success">{{ rupiahRingkas((agg.pi - agg.pe) * 1e6) }}</b> · bisnis <b class="text-success">{{ rupiahRingkas((agg.bi - agg.be) * 1e6) }}</b>
        </p>
      </AppPanel>

      <!-- Today's calendar (`:609`) -->
      <AppPanel
        title="Today's calendar"
        icon="i-lucide-calendar-days"
      >
        <template #actions>
          <UButton
            label="Buka"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hlife/calendar"
          />
        </template>
        <ul
          v-if="hariIniItems.length"
          class="divide-y divide-default"
        >
          <li
            v-for="it in hariIniItems"
            :key="`${it.jenis}-${it.id}-${it.t}`"
            class="flex items-center gap-2.5 py-2"
          >
            <span class="w-10 shrink-0 text-xs font-semibold text-muted num">{{ it.time || '—' }}</span>
            <UIcon
              :name="it.jenis === 'event' ? 'i-lucide-calendar' : it.jenis === 'deadline' ? 'i-lucide-alarm-clock' : 'i-lucide-clapperboard'"
              class="size-4 shrink-0 text-muted"
            />
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">{{ it.t }}</span>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          <b class="text-highlighted">Kalender kosong hari ini.</b> Nikmati ruang kosongnya.
        </p>
      </AppPanel>

      <!-- Weekly target (`:610`) -->
      <AppPanel
        title="Target minggu ini"
        icon="i-lucide-flag"
      >
        <UTextarea
          v-model="targetMinggu"
          :rows="2"
          placeholder="Target besar minggu ini…"
          class="w-full"
          @blur="simpanTarget"
        />
        <AppBar
          class="mt-4"
          label="Task selesai"
          :value="`${selesai}/${tugas.length}`"
          :persen="tugas.length ? Math.round((selesai / tugas.length) * 100) : 0"
          tone="success"
        />
      </AppPanel>

      <!-- Top 5 tasks (`:611`) -->
      <AppPanel
        title="Top 5 task"
        icon="i-lucide-list-checks"
        class="lg:col-span-2"
      >
        <template #actions>
          <UButton
            label="Semua task"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hlife/tasks"
          />
        </template>
        <div
          v-if="top5.length"
          class="divide-y divide-default"
        >
          <div
            v-for="t in top5"
            :key="t.id"
            class="flex items-start gap-3 py-2.5"
          >
            <button
              type="button"
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="t.done ? 'border-success bg-success text-white' : 'border-default bg-default text-transparent hover:border-success'"
              :aria-label="t.done ? 'Tandai belum selesai' : 'Tandai selesai'"
              :disabled="lagi(t)"
              @click="jalan(t, () => toggleTugas(t))"
            >
              <UIcon
                name="i-lucide-check"
                class="size-3.5"
              />
            </button>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-highlighted">
                {{ t.name }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <AppStatus
                  v-for="l in lencanaTugas(t).slice(0, 4)"
                  :key="l.label"
                  size="sm"
                  :color="l.color"
                  :icon="l.icon"
                >
                  {{ l.label }}
                </AppStatus>
              </div>
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          Belum ada task.
        </p>
      </AppPanel>

      <!-- Overdue (`:612`) -->
      <AppPanel
        title="Overdue"
        icon="i-lucide-alarm-clock"
        :count="lewat.length || undefined"
      >
        <div
          v-if="lewat.length"
          class="divide-y divide-default"
        >
          <div
            v-for="t in lewat.slice(0, 5)"
            :key="t.id"
            class="py-2"
          >
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ t.name }}
            </p>
            <div class="mt-1 flex flex-wrap gap-1">
              <AppStatus
                size="sm"
                color="error"
                icon="i-lucide-alarm-clock"
              >
                {{ fmtDue(t.due) }}
              </AppStatus>
              <AppStatus
                v-if="t.biz"
                size="sm"
                color="gold"
                icon="i-lucide-building-2"
              >
                {{ t.biz }}
              </AppStatus>
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          Tidak ada yang lewat deadline. Kendali penuh.
        </p>
      </AppPanel>

      <!-- Goal progress (`:613`) -->
      <AppPanel
        title="Goal progress"
        icon="i-lucide-target"
      >
        <template #actions>
          <UButton
            label="Semua"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hlife/goals"
          />
        </template>
        <AppBar
          v-for="g in goals.slice(0, 4)"
          :key="g.id"
          :label="g.name"
          :value="`${persenGoal(g)}%`"
          :persen="persenGoal(g)"
          :tone="g.area === 'Health' || g.area === 'Learning' ? 'success' : 'gold'"
        />
        <p
          v-if="!goals.length"
          class="text-sm text-muted"
        >
          Belum ada goal.
        </p>
      </AppPanel>

      <!-- Brain dump (`:614`) -->
      <AppPanel
        title="Brain dump / quick note"
        icon="i-lucide-sticky-note"
      >
        <div class="flex gap-2">
          <UInput
            v-model="dumpBaru"
            placeholder="Tulis ide, lalu Enter…"
            class="flex-1"
            @keydown.enter="tambahDump"
          />
          <UButton
            label="Simpan"
            @click="tambahDump"
          />
        </div>
        <ul
          v-if="dump.length"
          class="mt-3 divide-y divide-default"
        >
          <li
            v-for="(d, i) in dump.slice(0, 6)"
            :key="`${i}-${d}`"
            class="flex items-start gap-2 py-1.5 text-sm"
          >
            <UIcon
              name="i-lucide-dot"
              class="mt-0.5 size-4 shrink-0 text-primary-600"
            />
            <span class="min-w-0 flex-1">{{ d }}</span>
            <button
              type="button"
              class="shrink-0 text-xs text-muted underline-offset-2 hover:text-error hover:underline"
              @click="hapusDump(i)"
            >
              hapus
            </button>
          </li>
        </ul>
        <p
          v-else
          class="mt-3 text-sm text-muted"
        >
          Tangkap ide dalam ≤2 tap. Triage nanti.
        </p>
      </AppPanel>

      <!-- Habits (`:615`) -->
      <AppPanel
        title="Habit hari ini"
        icon="i-lucide-repeat"
        class="lg:col-span-2"
      >
        <div
          v-if="habits.length"
          class="flex flex-wrap gap-2"
        >
          <button
            v-for="h in habits"
            :key="h.id"
            type="button"
            class="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="h.dates.includes(hari)
              ? 'border-success bg-success/12 text-success'
              : 'border-default bg-default text-muted hover:border-accented'"
            :aria-pressed="h.dates.includes(hari)"
            :disabled="lagi(h)"
            @click="jalan(h, () => toggleHabit(h))"
          >
            <UIcon
              v-if="h.dates.includes(hari)"
              name="i-lucide-check"
              class="size-4"
            />
            {{ h.name }}
            <span class="inline-flex items-center gap-0.5 text-xs text-muted num">
              <UIcon
                name="i-lucide-flame"
                class="size-3"
              />{{ h.streak || 0 }}
            </span>
          </button>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          Belum ada habit.
        </p>
      </AppPanel>

      <!-- Roadmap this year (`:616`) -->
      <AppPanel
        :title="`Roadmap ${tahun}`"
        icon="i-lucide-map"
      >
        <template #actions>
          <UButton
            label="Buka"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hlife/roadmap"
          />
        </template>
        <AppBar
          label="Milestone tahun ini"
          :value="`${milestoneSelesai}/${milestoneTahun.length}`"
          :persen="milestoneTahun.length ? Math.round((milestoneSelesai / milestoneTahun.length) * 100) : 0"
        />
        <ul class="mt-2 space-y-1 text-sm text-muted">
          <li
            v-for="r in milestoneTahun.slice(0, 3)"
            :key="r.id"
          >
            • {{ r.title }}
          </li>
        </ul>
      </AppPanel>
    </div>

    <!-- Screen menu: the sidebar entry for hlife is wired in utils/modul-shell.ts
         by its owner; until then this is how every screen is reachable. -->
    <AppPanel
      title="Semua layar"
      icon="i-lucide-layout-grid"
    >
      <ModulMenu :layar="LAYAR_HLIFE" />
    </AppPanel>

    <p class="text-center text-xs text-muted num">
      {{ angka(tugas.length) }} task · {{ angka(proyek.length) }} project · {{ angka(bisnis.length) }} bisnis
    </p>
  </AppPage>
</template>
