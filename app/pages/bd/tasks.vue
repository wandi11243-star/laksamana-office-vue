<!--
  BD OS › Tasks (old `vTasks`, deploy/bd/index.html:1615-1688).

  Four views of the same work: the Eisenhower Matrix, today & overdue, the next
  seven days, and per division. The quadrant is DERIVED from important+urgent;
  dragging a card only flips those two switches, never stores a quadrant.
-->
<script setup lang="ts">
import type { BdTask } from '~/composables/useBd'
import { bdSimpan, bdTulisDiam, hapusBd, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import { OWNER_DIVS, TASK_TIPE, cariAku, lewat, lingkupIds, pics, saringLingkup, selesai, sisaHari, todayISO } from '~/utils/bd-rumus'
import { WARNA_KUADRAN } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdTaskRow from '~/widgets/bd/BdTaskRow.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const fPics = useState<string[]>('bd-fPics', () => [])
const f = useState('bd-task-filter', () => ({ mode: 'matrix', div: '', proj: '', type: '', scope: 'tim' }))

const people = computed(() => state.value.people)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))

const cocokPic = (o: { pics?: string[], pic?: string }) => !fPics.value.length || pics(o).some(id => fPics.value.includes(id))
const base = computed(() => saringLingkup(state.value.tasks, f.value.scope, lingkup.value, aku.value?.id)
  .filter(cocokPic)
  .filter(t => (!f.value.div || t.div === f.value.div) && (!f.value.proj || t.project === f.value.proj) && (!f.value.type || t.type === f.value.type)))

const namaProject = (id?: string | null) => projects.value.find(p => p.id === id)?.name
const skop = [
  { value: 'tim', label: 'Tim saya' },
  { value: 'saya', label: 'Ditugaskan ke saya' },
  { value: 'semua', label: 'Semua' },
]
const mode = [
  { value: 'matrix', label: 'Matrix', icon: 'i-lucide-layout-grid' },
  { value: 'today', label: 'Hari ini', icon: 'i-lucide-sun' },
  { value: 'week', label: 'Minggu ini', icon: 'i-lucide-calendar-days' },
  { value: 'div', label: 'Per divisi', icon: 'i-lucide-layers' },
]
const opsiProject = computed(() => [{ value: '', label: 'Semua project' }, ...projects.value.map(p => ({ value: p.id, label: p.name }))])
const opsiDiv = [{ value: '', label: 'Semua divisi' }, ...OWNER_DIVS.map(d => ({ value: d, label: d }))]
const opsiType = [{ value: '', label: 'Semua tipe' }, ...TASK_TIPE.map(t => ({ value: t, label: t }))]

const kuadranKotak = [
  { imp: true, urg: true, k: 'do', l: 'DO', d: 'Penting + Mendesak' },
  { imp: true, urg: false, k: 'schedule', l: 'SCHEDULE', d: 'Penting + Tidak Mendesak' },
  { imp: false, urg: true, k: 'delegate', l: 'DELEGATE', d: 'Tidak Penting + Mendesak' },
  { imp: false, urg: false, k: 'delete', l: 'DELETE', d: 'Tidak Penting + Tidak Mendesak' },
]
const isiKotak = (imp: boolean, urg: boolean) =>
  base.value.filter(t => !selesai(t) && !!t.important === imp && !!t.urgent === urg)

const hariIni = computed(() => base.value
  .filter(t => !selesai(t) && (t.deadline === todayISO() || lewat(t)))
  .slice()
  .sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1))
const minggu = computed(() => base.value.filter(t => !selesai(t) && t.deadline && sisaHari(t.deadline) <= 7)
  .slice().sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1))
const perDiv = computed(() => OWNER_DIVS
  .map(d => ({ div: d, items: base.value.filter(t => !selesai(t) && t.div === d) }))
  .filter(g => g.items.length))

const resetAktif = computed(() => fPics.value.length || f.value.div || f.value.proj || f.value.type || f.value.scope !== 'tim')
function reset() {
  fPics.value = []
  f.value = { ...f.value, div: '', proj: '', type: '', scope: 'tim' }
}

// ---- sheet & row actions ----
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
const taskPilihProject = ref<string | null>(null)
const taskHapus = ref<BdTask | null>(null)
const hapusMau = computed({
  get: () => !!taskHapus.value,
  set: (v) => {
    if (!v) taskHapus.value = null
  },
})

function baru() {
  taskPilih.value = null
  taskPilihProject.value = null
  bukaTask.value = true
}
function buka(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function toggle(t: BdTask) {
  const patch = selesai(t)
    ? { status: 'To Do', progress: t.progress === 100 ? 0 : t.progress }
    : { status: 'Done', progress: 100 }
  bdTulisDiam(() => tambalBd<BdTask>('tasks', t.id, patch, versiBaris(t)))
}
async function hapus() {
  const t = taskHapus.value
  if (!t) return
  taskHapus.value = null
  await bdSimpan(() => hapusBd('tasks', t.id, versiBaris(t)), 'Task dihapus')
}

// ---- drag between quadrants (desktop) ----
let dragId: string | null = null
function dragMulai(e: DragEvent, t: BdTask) {
  dragId = t.id
  e.dataTransfer?.setData('text/plain', t.id)
}
function dropKotak(imp: boolean, urg: boolean) {
  const t = state.value.tasks.find(x => x.id === dragId)
  dragId = null
  if (!t || (!!t.important === imp && !!t.urgent === urg)) return
  bdTulisDiam(() => tambalBd<BdTask>('tasks', t.id, { important: imp, urgent: urg }, versiBaris(t)))
}
</script>

<template>
  <AppPage
    title="Tasks"
    description="Prioritas ala Eisenhower — penting × mendesak."
  >
    <template #actions>
      <AppSeg
        v-model="f.mode"
        :options="mode"
        size="sm"
      />
      <UButton
        label="Task"
        icon="i-lucide-plus"
        @click="baru"
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
        <UFormField label="Project">
          <USelect
            v-model="f.proj"
            :items="opsiProject"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipe">
          <USelect
            v-model="f.type"
            :items="opsiType"
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

    <template v-if="f.mode === 'matrix'">
      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="k in kuadranKotak"
          :key="k.k"
          class="rounded-panel border border-default bg-default shadow-panel"
          @dragover.prevent
          @drop="dropKotak(k.imp, k.urg)"
        >
          <header class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
            <AppStatus
              :color="WARNA_KUADRAN[k.k]"
              size="sm"
            >
              {{ k.l }}
            </AppStatus>
            <span class="text-xs text-muted">{{ k.d }}</span>
            <span class="ms-auto rounded-full bg-table-head px-2 py-0.5 text-xs font-bold text-table-head-text num">{{ isiKotak(k.imp, k.urg).length }}</span>
          </header>
          <div class="divide-y divide-default">
            <div
              v-for="t in isiKotak(k.imp, k.urg)"
              :key="t.id"
              draggable="true"
              @dragstart="dragMulai($event, t)"
            >
              <BdTaskRow
                :task="t"
                :people="people"
                :project-name="namaProject(t.project)"
                hide-quad
                @buka="buka(t)"
                @toggle="toggle(t)"
                @hapus="taskHapus = t"
              />
            </div>
            <p
              v-if="!isiKotak(k.imp, k.urg).length"
              class="px-4 py-5 text-center text-sm text-dimmed"
            >
              Kosong
            </p>
          </div>
        </div>
      </div>
      <p class="mt-3 text-xs text-muted">
        Geser kartu antar kotak untuk mengubah prioritasnya (di HP: buka task dan ubah Penting / Mendesak).
      </p>
    </template>

    <AppPanel
      v-else-if="f.mode === 'today'"
      title="Hari ini & overdue"
      icon="i-lucide-sun"
      :count="hariIni.length"
    >
      <div class="divide-y divide-default">
        <BdTaskRow
          v-for="t in hariIni"
          :key="t.id"
          :task="t"
          :people="people"
          :project-name="namaProject(t.project)"
          @buka="buka(t)"
          @toggle="toggle(t)"
          @hapus="taskHapus = t"
        />
        <p
          v-if="!hariIni.length"
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada task untuk hari ini</b>
        </p>
      </div>
    </AppPanel>

    <AppPanel
      v-else-if="f.mode === 'week'"
      title="7 hari ke depan"
      icon="i-lucide-calendar-days"
      :count="minggu.length"
    >
      <div class="divide-y divide-default">
        <BdTaskRow
          v-for="t in minggu"
          :key="t.id"
          :task="t"
          :people="people"
          :project-name="namaProject(t.project)"
          @buka="buka(t)"
          @toggle="toggle(t)"
          @hapus="taskHapus = t"
        />
        <p
          v-if="!minggu.length"
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada task</b>
        </p>
      </div>
    </AppPanel>

    <template v-else>
      <AppPanel
        v-for="g in perDiv"
        :key="g.div"
        :title="g.div"
        icon="i-lucide-layers"
        :count="g.items.length"
      >
        <div class="divide-y divide-default">
          <BdTaskRow
            v-for="t in g.items"
            :key="t.id"
            :task="t"
            :people="people"
            :project-name="namaProject(t.project)"
            hide-div
            @buka="buka(t)"
            @toggle="toggle(t)"
            @hapus="taskHapus = t"
          />
        </div>
      </AppPanel>
      <AppPanel v-if="!perDiv.length">
        <p class="py-6 text-center text-sm text-muted">
          <b class="block text-highlighted">Belum ada task aktif</b>
        </p>
      </AppPanel>
    </template>

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :preset-project="taskPilihProject"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus task ini?"
      description="Semua kru ikut kehilangan datanya."
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
