<!--
  Task Management › Projects (old `vProjects`, deploy/bd/index.html:2653-2703).

  Cards by default, most-attention first (overdue, off/at-risk, nearest
  deadline); the stage Kanban and the Timeline stay as switches. Moving a card
  to Done closes all its tasks, ONLY on that change; the filter narrows what is
  SHOWN, never what may be moved. On a phone the board scrolls sideways and
  each card has a "Pindah stage" sheet.
-->
<script setup lang="ts">
import BdProjectGroup from '~/widgets/bd/BdProjectGroup.vue'
import type { BdProject, BdTask } from '~/composables/useBd'
import {
  bdSimpan, centangSub, hapusTaskDenganUrutan, pesanHapusTask, tambalBd, toggleTask, useBdState, versiBaris,
} from '~/composables/useBd'
import {
  PILIHAN_SEMUA, PROJ_STAGES, cariAku, divisiTerpakai, lingkupIds, pelaksana, pics, saringArsip, saringLingkup,
  subs, tasksPerluDitutup, todayISO, urutDeadline, urutProjectPerhatian, type ModeArsip,
} from '~/utils/bd-rumus'
import type { GZoom } from '~/utils/bd-gantt'
import BdGantt from '~/widgets/bd/BdGantt.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdProjCard from '~/widgets/bd/BdProjCard.vue'
import BdProjectSheet from '~/widgets/bd/BdProjectSheet.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import BdTaskTree from '~/widgets/bd/BdTaskTree.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const fPics = useState<string[]>('bd-fPics', () => [])
const f = useState('bd-proj-filter', () => ({ scope: 'semua', div: PILIHAN_SEMUA, st: 'aktif', view: 'kartu' as 'kartu' | 'kanban' | 'task' | 'timeline', zoom: 'week' as GZoom }))
/** Projects › Task view state: archive switch + keyword (the box redraws only its own list). */
const pTaskArsip = ref<ModeArsip>('aktif')
const pTaskQ = ref('')

const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (o: { pics?: string[], pic?: string }) => !fPics.value.length || pics(o).some(id => fPics.value.includes(id))
/** In the Task view the PIC filter means TASK ASSIGN, not project PIC: work
 * assigned to Wandi inside someone else's project must still surface. */
const cocokAssign = (t: BdTask) => !fPics.value.length || pelaksana(t).some(id => fPics.value.includes(id))

const base = computed(() => saringLingkup(state.value.projects, f.value.scope, lingkup.value, aku.value?.id)
  .filter(f.value.view === 'task' ? () => true : cocokPic)
  .filter(p => f.value.div === PILIHAN_SEMUA || p.div === f.value.div)
  .filter(p => f.value.st === 'semua' || (f.value.st === 'selesai' ? p.stage === 'Done' : p.stage !== 'Done')))
const diStage = (st: string) => base.value.filter(p => p.stage === st)
/** Cards, most-attention first (`vProjects` kartu view). */
const kartu = computed(() => urutProjectPerhatian(base.value))

/** Projects › Task: every task of the filtered projects, narrowed by assign
 * + keyword, then by the archive switch (`projTaskData`). */
const tugasTampil = computed(() => {
  const ids = new Set(base.value.map(p => p.id))
  const q = pTaskQ.value.trim().toLowerCase()
  const semua = state.value.tasks
    .filter(t => t.project && ids.has(t.project))
    .filter(cocokAssign)
    .filter(t => !q || String(t.name || '').toLowerCase().includes(q) || subs(t).some(x => String(x.t || '').toLowerCase().includes(q)))
  return saringArsip(semua, pTaskArsip.value).slice().sort(urutDeadline)
})
/** Grouped per project, in first-appearance order. */
const tugasPerProject = computed(() => {
  const urut: string[] = []
  const per = new Map<string, BdTask[]>()
  for (const t of tugasTampil.value) {
    const pid = t.project || ''
    if (!per.has(pid)) {
      per.set(pid, [])
      urut.push(pid)
    }
    per.get(pid)!.push(t)
  }
  return urut.map(pid => ({
    project: state.value.projects.find(p => p.id === pid),
    items: per.get(pid)!,
  }))
})
const namaAssign = computed(() => fPics.value.map(id => people.value.find(p => p.id === id)?.name).filter(Boolean).join(', '))

const skop = [
  { value: 'tim', label: 'Tim saya' },
  { value: 'saya', label: 'Ditugaskan ke saya' },
  { value: 'semua', label: 'Semua' },
]
/** Division filter stays on used-only. */
const opsiDiv = computed(() => [
  { value: PILIHAN_SEMUA, label: 'Semua divisi' },
  ...divisiTerpakai(state.value.projects).map(d => ({ value: d, label: d })),
])
const resetAktif = computed(() => fPics.value.length || f.value.div !== PILIHAN_SEMUA || f.value.scope !== 'semua' || f.value.st !== 'aktif')
function reset() {
  fPics.value = []
  f.value = { ...f.value, div: PILIHAN_SEMUA, scope: 'semua', st: 'aktif' }
}

// ---- move stage ----
async function pindahStage(p: BdProject, st: string) {
  const dulu = p.stage
  if (st === dulu) return
  const ikut = (st === 'Done' && dulu !== 'Done') ? tasksPerluDitutup(state.value.tasks, p.id) : []
  const aksi = async () => {
    await tambalBd<BdProject>('projects', p.id, { stage: st }, versiBaris(p))
    // Closing stamps Done + doneAt (old `tuntaskanTaskProject`): the deadline
    // stops counting. ONLY on this change — a task reopened later is never
    // closed again by itself.
    for (const t of ikut) await tambalBd('tasks', t.id, { status: 'Done', progress: 100, doneAt: todayISO() }, versiBaris(t))
  }
  await bdSimpan(aksi, `Project dipindah ke ${st}` + (ikut.length ? ` — ${ikut.length} task ikut jadi Done` : ''))
}

let dragId: string | null = null
function dragMulai(e: DragEvent, p: BdProject) {
  dragId = p.id
  e.dataTransfer?.setData('text/plain', p.id)
}
function dropStage(st: string) {
  const p = state.value.projects.find(x => x.id === dragId)
  dragId = null
  if (p) pindahStage(p, st)
}

const stageSheet = ref(false)
const stagePilih = ref<BdProject | null>(null)
const stageBaru = ref('Idea')
function bukaStage(p: BdProject) {
  stagePilih.value = p
  stageBaru.value = p.stage
  stageSheet.value = true
}
async function simpanStage() {
  const p = stagePilih.value
  if (!p) return
  await pindahStage(p, stageBaru.value)
  stageSheet.value = false
}

// ---- sheet ----
const bukaProject = ref(false)
const projPilih = ref<BdProject | null>(null)
function baru() {
  projPilih.value = null
  bukaProject.value = true
}
function buka(p: BdProject) {
  navigateTo(`/bd/projects/${p.id}`)
}

// ---- task rows (Task view) ----
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
const taskHapus = ref<BdTask | null>(null)
const hapusMau = computed({
  get: () => !!taskHapus.value,
  set: (v) => {
    if (!v) taskHapus.value = null
  },
})
const pesanHapus = computed(() => (taskHapus.value ? pesanHapusTask(taskHapus.value, state.value.tasks) : ''))
function bukaTaskSheet(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function toggle(t: BdTask) {
  toggleTask(t, state.value.tasks)
}
async function hapus() {
  const t = taskHapus.value
  if (!t) return
  taskHapus.value = null
  await hapusTaskDenganUrutan(t, state.value.tasks)
}
function subToggle(t: BdTask, ix: number, on: boolean) {
  centangSub(t, ix, on)
}
const gantt = ref<InstanceType<typeof BdGantt> | null>(null)
</script>

<template>
  <NuxtPage v-if="$route.params.id" />
  <AppPage
    v-else
    title="Projects"
    description="Pekerjaan besar berjangka + milestone."
  >
    <template #actions>
      <AppSeg
        v-model="f.view"
        :options="[{ value: 'kartu', label: 'Kartu' }, { value: 'kanban', label: 'Kanban stage' }, { value: 'task', label: 'Task' }, { value: 'timeline', label: 'Timeline' }]"
        size="sm"
      />
      <UButton
        label="Project"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Status">
          <USelect
            v-model="f.st"
            :items="[{ value: 'aktif', label: 'Aktif' }, { value: 'selesai', label: 'Selesai' }, { value: 'semua', label: 'Semua' }]"
            class="w-full"
          />
        </UFormField>
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
          :label="f.view === 'task' ? 'Assign' : 'PIC'"
        />
        <div class="flex-1" />
        <span
          v-if="f.view !== 'task'"
          class="text-xs text-muted"
        >{{ base.length }} dari {{ state.projects.length }} project</span>
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

    <div
      v-if="f.view === 'task'"
      class="mt-4"
    >
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <UInput
          v-model="pTaskQ"
          icon="i-lucide-search"
          placeholder="Cari task di project ini…"
          autocomplete="off"
          class="min-w-52 flex-1 sm:max-w-xs"
        />
        <AppSeg
          v-model="pTaskArsip"
          :options="[{ value: 'aktif', label: 'Aktif' }, { value: 'arsip', label: 'Arsip' }, { value: 'semua', label: 'Semua' }]"
          size="sm"
        />
      </div>
      <p
        v-if="tugasTampil.length"
        class="mb-2.5 text-xs text-muted"
      >
        {{ tugasTampil.length }} task di {{ tugasPerProject.length }} project<template v-if="namaAssign">
          · assign: {{ namaAssign }}
        </template>
      </p>
      <template
        v-for="g in tugasPerProject"
        :key="g.project?.id || 'tanpa'"
      >
        <button
          type="button"
          class="mb-1 mt-3 text-start text-sm font-bold text-highlighted hover:underline"
          @click="g.project && buka(g.project)"
        >
          {{ g.project?.name || '(project tidak ada)' }} ({{ g.items.length }})
          <BdProjectGroup
            class="ms-1 align-middle"
            :nama="g.project?.businessGroup"
            :warna="g.project?.businessGroupColor"
          />
        </button>
        <AppPanel
          class="mb-2"
          flush
        >
          <BdTaskTree
            :tasks="g.items"
            :semua="state.tasks"
            :people="people"
            @buka="bukaTaskSheet"
            @toggle="toggle"
            @hapus="taskHapus = $event"
            @sub-toggle="subToggle"
          />
        </AppPanel>
      </template>
      <AppPanel
        v-if="!tugasTampil.length"
        class="mt-2"
      >
        <p class="py-4 text-center text-sm text-muted">
          <b class="block text-highlighted">Tidak ada task pada penyaring ini</b>
          {{ fPics.length ? 'Assign yang dipilih tidak memegang task di project ini. ' : '' }}{{ pTaskQ ? 'Coba kata kunci lain. ' : '' }}{{ pTaskArsip === 'aktif' ? 'Task yang sudah Done ada di "Arsip".' : '' }}
        </p>
      </AppPanel>
    </div>

    <div
      v-else-if="f.view === 'kartu'"
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <BdProjCard
        v-for="p in kartu"
        :key="p.id"
        :project="p"
        :tasks="state.tasks"
        :people="people"
        @buka="buka(p)"
        @pindah="bukaStage(p)"
      />
    </div>

    <div
      v-else-if="f.view === 'timeline'"
      class="mt-4"
    >
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="f.zoom"
          :options="[{ value: 'day', label: 'Hari' }, { value: 'week', label: 'Minggu' }, { value: 'month', label: 'Bulan' }]"
          size="sm"
        />
        <div class="flex-1" />
        <UButton
          label="Buka semua"
          color="neutral"
          variant="outline"
          size="sm"
          @click="gantt?.bukaSemua()"
        />
        <UButton
          label="Tutup semua"
          color="neutral"
          variant="outline"
          size="sm"
          @click="gantt?.tutupSemua()"
        />
        <UButton
          label="Ke hari ini"
          color="neutral"
          variant="outline"
          size="sm"
          @click="gantt?.keHariIni()"
        />
      </div>
      <BdGantt
        ref="gantt"
        :projects="base"
        :tasks="state.tasks"
        :people="people"
        :zoom="f.zoom"
        @buka-project="navigateTo(`/bd/projects/${$event}`)"
        @buka-task="bukaTaskSheet"
        @sub-toggle="subToggle"
      />
      <p class="mt-2 text-xs text-muted">
        Klik bar project untuk membukanya, klik task untuk mengubahnya.
      </p>
    </div>

    <AppPapan
      v-else
      class="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4"
    >
      <section
        v-for="st in PROJ_STAGES"
        :key="st"
        class="min-w-0 rounded-panel border border-default bg-muted/40"
        @dragover.prevent
        @drop="dropStage(st)"
      >
        <header class="flex items-center justify-between border-b border-default px-3 py-2">
          <span class="text-sm font-bold text-highlighted">{{ st }}</span>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-ink-900 num">{{ diStage(st).length }}</span>
        </header>
        <div class="grid content-start gap-2 p-2 lg:max-h-[min(68dvh,640px)] lg:overflow-y-auto [scrollbar-width:thin]">
          <div
            v-for="p in diStage(st)"
            :key="p.id"
            draggable="true"
            @dragstart="dragMulai($event, p)"
          >
            <BdProjCard
              :project="p"
              :tasks="state.tasks"
              :people="people"
              @buka="buka(p)"
              @pindah="bukaStage(p)"
            />
          </div>
        </div>
      </section>
    </AppPapan>

    <AppPanel
      v-if="f.view !== 'task' && !base.length && state.projects.length"
      class="mt-4"
    >
      <p class="py-4 text-center text-sm text-muted">
        <b class="block text-highlighted">Tidak ada project pada penyaring ini</b>
        Ada {{ state.projects.length }} project di papan — coba ubah lingkupnya jadi "Semua".
      </p>
    </AppPanel>

    <BdProjectSheet
      v-model:open="bukaProject"
      :project="projPilih"
      :projects="state.projects"
      :tasks="state.tasks"
      :po="state.po"
      :coord="state.coord"
      :people="people"
      :aku="aku"
    />
    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="state.tasks"
      :projects="state.projects"
      :people="people"
      :aku="aku"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus task ini?"
      :description="pesanHapus"
      @konfirmasi="hapus"
    />

    <ResponsiveSheet
      v-model:open="stageSheet"
      title="Pindah stage"
      :description="stagePilih?.name"
    >
      <UFormField label="Stage">
        <USelect
          v-model="stageBaru"
          :items="PROJ_STAGES"
          class="w-full"
        />
      </UFormField>
      <p class="mt-3 text-xs text-muted">
        Memindahkan ke <b>Done</b> menutup semua task project ini (status Done, progress 100).
      </p>
      <template #footer>
        <UButton
          label="Simpan"
          loading-auto
          @click="simpanStage"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="stageSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
