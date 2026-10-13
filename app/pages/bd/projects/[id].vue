<!--
  Task Management › Project detail (old `vProjectDetail`, deploy/bd/index.html:2730+).
  Four numbers, task tabs (Kanban first — the 6 Oct 2026 request to open a
  project as a board was never withdrawn — then Task & sub-task), milestones
  (click to tick), description, coordination and the related purchase orders.
  Hidden from the menu — opened from a card.
-->
<script setup lang="ts">
import type { BdCoord, BdPo, BdProject, BdTask } from '~/composables/useBd'
import {
  bdSimpan, bdTulisDiam, centangSub, hapusBd, hapusTaskDenganUrutan, pesanHapusTask, tambalBd,
  toggleTask, useBdState, versiBaris,
} from '~/composables/useBd'
import {
  cariAku, fDue, fRp, inisial, pics, projProgress, projTasks, saringArsip, selesai, todayISO, urutDeadline,
  type ModeArsip,
} from '~/utils/bd-rumus'
import type { GZoom } from '~/utils/bd-gantt'
import { IKON_HEALTH, LABEL_HEALTH, WARNA_PO } from '~/utils/status-bd'
import BdCoordSheet from '~/widgets/bd/BdCoordSheet.vue'
import BdGantt from '~/widgets/bd/BdGantt.vue'
import BdKanban from '~/widgets/bd/BdKanban.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPoSheet from '~/widgets/bd/BdPoSheet.vue'
import BdProjectSheet from '~/widgets/bd/BdProjectSheet.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import BdTaskTree from '~/widgets/bd/BdTaskTree.vue'
import { fTglP } from '~/utils/format'

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
const coord = computed(() => state.value.coord.filter(c => c.project === id))
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
const taskPilih = ref<BdTask | null>(null)
const bukaCoord = ref(false)
const coordPilih = ref<BdCoord | null>(null)
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
// Hapus project: sama seperti legacy `hapusProj` (deploy/bd/index.html:2064) —
// task/PO/koordinasi hanya dilepas tautannya, tidak ikut terhapus.
const hapusProjectMau = ref(false)
async function hapusProject() {
  const pr = p.value
  if (!pr) return
  hapusProjectMau.value = false
  const aksi = async () => {
    for (const t of state.value.tasks.filter(x => x.project === pr.id)) await tambalBd<BdTask>('tasks', t.id, { project: null }, versiBaris(t))
    for (const o of state.value.po.filter(x => x.project === pr.id)) await tambalBd<BdPo>('purchase-orders', o.id, { project: null }, versiBaris(o))
    for (const c of state.value.coord.filter(x => x.project === pr.id)) await tambalBd<BdCoord>('coord-requests', c.id, { project: null }, versiBaris(c))
    await hapusBd('projects', pr.id, versiBaris(pr))
  }
  const ok = await bdSimpan(aksi, 'Project dihapus')
  if (ok) await navigateTo('/bd/projects')
}
function bukaCoordSheet(c: BdCoord) {
  coordPilih.value = c
  bukaCoord.value = true
}
function bukaPoSheet(o: BdPo) {
  poPilih.value = o
  bukaPo.value = true
}
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
        v-if="p"
        label="Task"
        icon="i-lucide-plus"
        @click="bukaTaskBaru"
      />
      <UButton
        v-if="p"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="outline"
        @click="hapusProjectMau = true"
      />
    </template>

    <AppPanel v-if="!p">
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Project tidak ditemukan</b>
        Mungkin sudah dihapus. Kembali ke daftar project.
      </p>
    </AppPanel>

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Health"
          :icon="IKON_HEALTH[p.health]"
          :tone="p.health === 'at-risk' ? 'warning' : p.health === 'off-track' ? 'error' : 'success'"
          :value="LABEL_HEALTH[p.health] || 'On track'"
          :sub="`${fTglP(p.start)} — ${fTglP(p.end)}`"
        />
        <AppStat
          label="Progress"
          icon="i-lucide-activity"
          :value="`${pg}%`"
          :sub="`${sel}/${tugas.length} task selesai`"
        />
        <AppStat
          label="Budget terpakai"
          icon="i-lucide-wallet"
          :tone="sisaBudget < 0 ? 'error' : 'success'"
          :value="fRp(p.spent)"
          :sub="`dari ${fRp(p.budget)}${sisaBudget < 0 ? ' — LEWAT' : ''}`"
        />
        <AppStat
          label="PIC"
          icon="i-lucide-users"
          tone="info"
          :value="dpakai.length"
          :sub="dpakai.length ? dpakai.map(x => x!.name.split(' ')[0]).join(', ') : 'belum ditentukan'"
        />
      </AppStatGrid>

      <div class="grid gap-5">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="pdTab"
            :options="[{ value: 'kanban', label: 'Kanban' }, { value: 'list', label: 'Task & sub-task' }, { value: 'timeline', label: 'Timeline' }]"
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

        <AppPanel
          v-if="p.desc"
          title="Deskripsi"
          icon="i-lucide-align-left"
        >
          <p class="whitespace-pre-wrap text-sm text-default">
            {{ p.desc }}
          </p>
        </AppPanel>

        <div class="grid gap-5 lg:grid-cols-2">
          <AppPanel
            title="Koordinasi divisi lain"
            icon="i-lucide-handshake"
            :count="coord.length"
          >
            <div class="divide-y divide-default">
              <button
                v-for="c in coord"
                :key="c.id"
                type="button"
                class="w-full px-1 py-2.5 text-start hover:bg-elevated/50"
                @click="bukaCoordSheet(c)"
              >
                <span class="block truncate font-semibold text-highlighted">{{ c.title }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-1.5">
                  <AppStatus size="sm">
                    {{ c.status }}
                  </AppStatus>
                  <AppStatus size="sm">
                    → {{ c.toDiv }}
                  </AppStatus>
                  <AppStatus
                    size="sm"
                    :color="c.status !== 'Selesai' && c.due && c.due < todayISO() ? 'error' : 'neutral'"
                  >
                    {{ fDue(c.due) }}
                  </AppStatus>
                </span>
              </button>
              <p
                v-if="!coord.length"
                class="py-4 text-center text-sm text-muted"
              >
                Tidak ada koordinasi
              </p>
            </div>
          </AppPanel>

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
            <div class="grid gap-2">
              <button
                v-for="(m, i) in p.milestones || []"
                :key="i"
                type="button"
                class="flex items-start gap-2 rounded-field border p-2.5 text-start transition-colors"
                :class="m.done ? 'border-success/40 bg-success/10' : 'border-default hover:border-accented'"
                @click="toggleMilestone(i)"
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

          <AppPanel
            title="PIC"
            icon="i-lucide-users"
          >
            <div class="flex flex-wrap gap-2">
              <span
                v-for="x in dpakai"
                :key="x!.id"
                class="inline-flex items-center gap-1.5 rounded-full border border-default px-2.5 py-1 text-[13px] font-semibold"
              >
                <span class="flex size-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-800">{{ inisial(x!.name) }}</span>
                {{ x!.name }}
              </span>
              <span
                v-if="!dpakai.length"
                class="text-sm text-muted"
              >Belum ditentukan.</span>
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
      <BdCoordSheet
        v-model:open="bukaCoord"
        :coord="coordPilih"
        :projects="state.projects"
        :people="people"
        :aku="aku"
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
      <BdKonfirmasi
        v-model:open="hapusProjectMau"
        title="Hapus project ini?"
        description="Task-nya TIDAK ikut terhapus — hanya dilepas dari project. Koordinasi dan PO terkait juga dilepas."
        @konfirmasi="hapusProject"
      />
    </template>
  </AppPage>
</template>
