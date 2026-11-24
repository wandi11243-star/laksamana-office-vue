<!--
  Task Management › Project detail (old `vProjectDetail`, deploy/bd/index.html:2730+).
  Four numbers, task tabs (Kanban first — the 6 Oct 2026 request to open a
  project as a board was never withdrawn — then Task & sub-task), milestones
  (click to tick), description, coordination and the related purchase orders.
  Hidden from the menu — opened from a card.
-->
<script setup lang="ts">
import BdProjectGroup from '~/widgets/bd/BdProjectGroup.vue'
import type { BdPo, BdProject, BdTask } from '~/composables/useBd'
import {
  bdTulisDiam, centangSub, hapusTaskDenganUrutan, pesanHapusTask, tambalBd,
  toggleTask, useBdState, versiBaris,
} from '~/composables/useBd'
import {
  cariAku, fDue, fRp, inisial, pics, projProgress, projTasks, saringArsip, selesai, sisaHari,
  urutDeadline, waktuTerpakai,
  type ModeArsip,
} from '~/utils/bd-rumus'
import type { GZoom } from '~/utils/bd-gantt'
import { WARNA_PO } from '~/utils/status-bd'
import BdGantt from '~/widgets/bd/BdGantt.vue'
import BdKanban from '~/widgets/bd/BdKanban.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPindahTask from '~/widgets/bd/BdPindahTask.vue'
import BdPoSheet from '~/widgets/bd/BdPoSheet.vue'
import BdProjectSheet from '~/widgets/bd/BdProjectSheet.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import BdTaskTree from '~/widgets/bd/BdTaskTree.vue'
import { fTgl, fTglP } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const route = useRoute()
const me = useMe()
const { data: state } = useBdState()
const id = String(route.params.id || '')

const p = computed<BdProject | undefined>(() => state.value.projects.find(x => x.id === id))
const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const tugas = computed(() => (p.value ? projTasks(state.value.tasks, p.value.id) : []))
/** Detail tabs: Kanban first (the 6 Oct 2026 request was never withdrawn), then the tree and the Timeline. */
const pdTab = ref<'kanban' | 'list' | 'timeline'>('kanban')
const pdArsip = ref<ModeArsip>('aktif')
const pdZoom = ref<GZoom>('week')
const tugasArsip = computed(() => saringArsip(tugas.value, pdArsip.value).slice().sort(urutDeadline))
const pg = computed(() => (p.value ? projProgress(p.value, state.value.tasks) : 0))
const sel = computed(() => tugas.value.filter(selesai).length)
const sisaBudget = computed(() => (Number(p.value?.budget) || 0) - (Number(p.value?.spent) || 0))
const po = computed(() => state.value.po.filter(o => o.project === id))
const dpakai = computed(() => pics(p.value).map(pid => people.value.find(x => x.id === pid)).filter(Boolean))

async function toggleMilestone(i: number) {
  const pr = p.value
  if (!pr) return
  const ms = (pr.milestones || []).map((m, k) => (k === i ? { ...m, done: !m.done } : m))
  await bdTulisDiam(() => tambalBd<BdProject>('projects', pr.id, { milestones: ms }, versiBaris(pr)))
}

// ---- sheets ----
const bukaProject = ref(false)
const bukaTask = ref(false)
const bukaPindah = ref(false)
const taskPilih = ref<BdTask | null>(null)
const bukaPo = ref(false)
const poPilih = ref<BdPo | null>(null)
const taskHapus = ref<BdTask | null>(null)
const hapusMau = computed({
  get: () => !!taskHapus.value,
  set: (v) => {
    if (!v) taskHapus.value = null
  },
})

function bukaTaskBaru() {
  taskPilih.value = null
  bukaTask.value = true
}
function bukaTaskSheet(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function toggle(t: BdTask) {
  toggleTask(t, state.value.tasks)
}
function subToggle(t: BdTask, ix: number, on: boolean) {
  centangSub(t, ix, on)
}
const pesanHapus = computed(() => (taskHapus.value ? pesanHapusTask(taskHapus.value, state.value.tasks) : ''))
async function hapusTask() {
  const t = taskHapus.value
  if (!t) return
  taskHapus.value = null
  await hapusTaskDenganUrutan(t, state.value.tasks)
}
function bukaPoSheet(o: BdPo) {
  poPilih.value = o
  bukaPo.value = true
}

// Plain buttons that write: no double click while the write runs.
const { jalan, lagi } = useSibuk()
</script>

<template>
  <AppPage
    :title="p?.name || 'Project'"
    :description="p ? `${p.div} · ${p.type} · Stage: ${p.stage}` : undefined"
    :back="{ label: 'Semua project', to: '/bd/projects' }"
  >
    <template #actions>
      <UButton
        v-if="p"
        label="Edit"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        @click="bukaProject = true"
      />
      <UButton
        v-if="p && tugas.length"
        label="Pindahkan Task"
        icon="i-lucide-arrow-right-left"
        color="neutral"
        variant="outline"
        @click="bukaPindah = true"
      />
      <UButton
        v-if="p"
        label="Task"
        icon="i-lucide-plus"
        @click="bukaTaskBaru"
      />
    </template>

    <AppPanel v-if="!p">
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Project tidak ditemukan</b>
        Mungkin sudah dihapus. Kembali ke daftar project.
      </p>
    </AppPanel>

    <template v-else>
      <BdProjectGroup
        class="mb-4"
        :nama="p.businessGroup"
        :warna="p.businessGroupColor"
      />
      <p
        v-if="p.desc"
        class="mb-4 text-sm text-muted"
      >
        {{ p.desc }}
      </p>
      <div class="mb-5 grid gap-x-6 gap-y-4 rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel sm:grid-cols-2 lg:grid-cols-3 lg:px-5">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            PIC project
          </p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <span
              v-for="x in dpakai"
              :key="x!.id"
              :title="x!.name"
              class="flex size-7 items-center justify-center rounded-full bg-yellow-light text-[11px] font-bold text-yellow-dark"
            >{{ inisial(x!.name) }}</span>
            <span
              v-if="!dpakai.length"
              class="text-sm text-muted"
            >Belum ditentukan.</span>
          </div>
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            Mulai
          </p>
          <p class="mt-1 text-sm font-semibold text-highlighted">
            {{ fTgl(p.start) }}
          </p>
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            Deadline
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-highlighted">
            {{ fTgl(p.end) }}
            <AppStatus
              v-if="p.end && p.stage !== 'Done' && sisaHari(p.end) < 14"
              size="sm"
              :color="sisaHari(p.end) < 0 ? 'error' : 'warning'"
            >
              {{ fDue(p.end) }}
            </AppStatus>
          </p>
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            Progress
          </p>
          <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full"
              :class="pg >= 100 ? 'bg-success' : 'bar-emas'"
              :style="{ width: `${pg}%` }"
            />
          </div>
          <p class="mt-1 text-xs text-muted">
            {{ sel }}/{{ tugas.length }} task selesai
          </p>
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            Waktu terpakai
          </p>
          <p class="mt-1 text-sm font-semibold text-highlighted">
            {{ waktuTerpakai(p) }}
          </p>
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            Budget terpakai
          </p>
          <p class="mt-1 text-sm font-semibold text-highlighted">
            {{ fRp(p.spent) }}
          </p>
          <p
            class="text-xs text-muted"
            :class="sisaBudget < 0 ? 'font-semibold text-error' : ''"
          >
            dari {{ fRp(p.budget) }}{{ sisaBudget < 0 ? ' — LEWAT' : '' }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="pdTab"
            :options="[{ value: 'list', label: 'Task & sub-task' }, { value: 'kanban', label: 'Kanban' }, { value: 'timeline', label: 'Timeline' }]"
            size="sm"
          />
          <div class="flex-1" />
          <AppSeg
            v-if="pdTab === 'timeline'"
            v-model="pdZoom"
            :options="[{ value: 'day', label: 'Hari' }, { value: 'week', label: 'Minggu' }, { value: 'month', label: 'Bulan' }]"
            size="sm"
          />
          <AppSeg
            v-else
            v-model="pdArsip"
            :options="[{ value: 'aktif', label: `Aktif (${tugas.filter(t => !selesai(t)).length})` }, { value: 'arsip', label: `Arsip (${tugas.filter(selesai).length})` }, { value: 'semua', label: `Semua (${tugas.length})` }]"
            size="sm"
          />
        </div>

        <BdGantt
          v-if="pdTab === 'timeline'"
          :projects="[p]"
          :tasks="state.tasks"
          :people="people"
          scoped
          :zoom="pdZoom"
          @buka-task="bukaTaskSheet"
          @sub-toggle="subToggle"
        />

        <BdKanban
          v-else-if="pdTab === 'kanban'"
          :tasks="tugasArsip"
          :semua="state.tasks"
          :people="people"
          :arsip="pdArsip"
          :project-preset="p.id"
          :pic-default="aku?.id"
          :div-default="p.div"
          @buka="bukaTaskSheet"
          @sub-toggle="subToggle"
        />

        <AppPanel
          v-else
          title="Task & sub-task"
          icon="i-lucide-list-todo"
          :count="tugasArsip.length"
          flush
        >
          <BdTaskTree
            :tasks="tugasArsip"
            :semua="state.tasks"
            :people="people"
            @buka="bukaTaskSheet"
            @toggle="toggle"
            @hapus="taskHapus = $event"
            @sub-toggle="subToggle"
          />
          <p
            v-if="!tugasArsip.length"
            class="py-6 text-center text-sm text-muted"
          >
            <b class="block text-highlighted">{{ tugas.length ? 'Tidak ada task di tampilan ini' : 'Belum ada task' }}</b>
            {{ tugas.length ? 'Ganti ke "Semua" untuk melihat task yang sudah Done.' : 'Tambahkan task pertama lewat tombol + Task.' }}
          </p>
        </AppPanel>

        <div class="grid gap-5 lg:grid-cols-2">
          <AppPanel
            title="Purchase order terkait"
            icon="i-lucide-shopping-cart"
            :count="po.length"
          >
            <div class="divide-y divide-default">
              <button
                v-for="o in po"
                :key="o.id"
                type="button"
                class="w-full px-1 py-2.5 text-start hover:bg-elevated/50"
                @click="bukaPoSheet(o)"
              >
                <span class="block truncate font-semibold text-highlighted">{{ o.item }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-1.5">
                  <AppStatus
                    size="sm"
                    :color="WARNA_PO[o.status] || 'neutral'"
                  >
                    {{ o.status }}
                  </AppStatus>
                  <AppStatus size="sm">{{ fRp(o.amount) }}</AppStatus>
                </span>
              </button>
              <p
                v-if="!po.length"
                class="py-4 text-center text-sm text-muted"
              >
                Tidak ada PO
              </p>
            </div>
          </AppPanel>

          <AppPanel
            title="Milestone"
            icon="i-lucide-flag"
            :count="(p.milestones || []).length"
          >
            <div class="grid grid-cols-1 gap-2">
              <button
                v-for="(m, i) in p.milestones || []"
                :key="i"
                type="button"
                class="flex items-start gap-2 rounded-xl border p-2.5 text-start transition-colors"
                :class="m.done ? 'border-success/40 bg-success/10' : 'border-default hover:border-accented'"
                :disabled="lagi(i)"
                @click="jalan(i, () => toggleMilestone(i))"
              >
                <span
                  class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border"
                  :class="m.done ? 'border-success bg-success text-white' : 'border-default bg-default'"
                >
                  <UIcon
                    v-if="m.done"
                    name="i-lucide-check"
                    class="size-3"
                  />
                </span>
                <span>
                  <span class="block font-semibold text-highlighted">{{ m.t }}</span>
                  <span class="text-xs text-muted">{{ fTglP(m.date) }}</span>
                </span>
              </button>
              <p
                v-if="!(p.milestones || []).length"
                class="py-4 text-center text-sm text-muted"
              >
                Belum ada milestone — tambahkan lewat tombol Edit.
              </p>
            </div>
          </AppPanel>
        </div>
      </div>

      <BdProjectSheet
        v-model:open="bukaProject"
        :project="p"
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
        :preset-project="p.id"
        :projects="state.projects"
        :people="people"
        :aku="aku"
      />
      <BdPindahTask
        v-model:open="bukaPindah"
        :asal="p"
        :tasks="state.tasks"
        :projects="state.projects"
      />
      <BdPoSheet
        v-model:open="bukaPo"
        :po="poPilih"
        :projects="state.projects"
        :people="people"
        :aku="aku"
      />
      <BdKonfirmasi
        v-model:open="hapusMau"
        title="Hapus task ini?"
        :description="pesanHapus"
        @konfirmasi="hapusTask"
      />
    </template>
  </AppPage>
</template>
