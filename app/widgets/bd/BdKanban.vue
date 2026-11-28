<!--
  One task list as a Kanban board (old `kanbanHtml`, deploy/bd/index.html:2219).
  A thin wrapper over AppKanban: the board owns drag state, this file only maps
  BD columns/cards and keeps the two BD behaviours — the Done guard
  (`cekBolehDone`) and "+ Tambah kartu" birthing a row with no order (new cards
  sort at the bottom through `kanbanUrut`). Cards are `BdKanbanCard` (old
  `boardCard`), not the list row. Moving a card is drag & drop only.

  Shared by My Task, Daily and the project detail Kanban tab.
-->
<script setup lang="ts">
import type { BdPerson, BdTask } from '~/composables/useBd'
import { bdTulisDiam, buatBd, sisipTask, ubahBd, versiBaris } from '~/composables/useBd'
import {
  STATUS_FLOW, cekBolehDone, divisiBawaan, kanbanUrut, opsiDivisi, urutTask, urutanSisip, pesanTunggu, segarkanProgress, setPics,
  type ModeArsip, type ModeUrut,
} from '~/utils/bd-rumus'
import BdKanbanCard from '~/widgets/bd/BdKanbanCard.vue'

const props = withDefaults(defineProps<{
  tasks: BdTask[]
  semua?: BdTask[]
  people: BdPerson[]
  projects?: { id: string, name: string }[]
  showProject?: boolean
  arsip?: ModeArsip
  allowAdd?: boolean
  /** Preset project for cards added here (`boardTambah` proj). */
  projectPreset?: string | null
  /** Default PIC for cards added here (the signed-in crew). */
  picDefault?: string
  divDefault?: string
  /** Daily board: cards added here are Daily Tasks, never in a project. */
  dailyDefault?: boolean
  /** Card order; deadline keeps the old "dragged cards at the bottom" rule. */
  urut?: ModeUrut
}>(), {
  urut: 'manual',
  arsip: 'aktif',
  allowAdd: true,
})

const emit = defineEmits<{
  buka: [t: BdTask]
  subToggle: [t: BdTask, ix: number, on: boolean]
}>()

const toast = useToast()
const bank = computed(() => props.semua ?? props.tasks)
const kolom = computed(() => (props.arsip === 'arsip' ? ['Done'] : STATUS_FLOW))
const kolomKanban = computed(() => kolom.value.map(st => ({
  id: st,
  title: st,
  count: arsipKolom(st),
  items: isiKolom(st),
})))
const isiKolom = (st: string) => {
  const l = props.tasks.filter(t => (t.status || 'To Do') === st).slice().sort(props.urut === 'deadline' ? kanbanUrut(st) : urutTask(props.urut))
  return (st === 'Done' && props.arsip === 'aktif') ? [] : l
}
const arsipKolom = (st: string) => props.tasks.filter(t => (t.status || 'To Do') === st).length
const namaProject = (id?: string | null) => props.projects?.find(p => p.id === id)?.name

// Dropping onto Done runs the one guard (`cekBolehDone`); a dragged card
// lands at the bottom of its new column (`pindahKe` + `kanbanUrut`).
/** Same-column drop: new place in the manual order (other orders ignore it). */
function urutKartu(p: { id: string, column: string, sebelum: string | null }) {
  if (props.urut !== 'manual') return
  const t = bank.value.find(x => x.id === p.id)
  if (t) sisipTask(isiKolom(p.column), t, p.sebelum)
}

async function pindahKartu(p: { id: string, to: string, sebelum?: string | null }) {
  const t = bank.value.find(x => x.id === p.id)
  if (!t || t.status === p.to) return
  if (p.to === 'Done') {
    const cek = cekBolehDone(t, t.dependsOn, bank.value)
    if (!cek.boleh) {
      toast.add({ title: pesanTunggu(t, cek.nama), color: 'error' })
      return
    }
  }
  // PUT carries the whole row: dragging OUT of Done must also drop `doneAt`.
  // Dragged cards land at the bottom of their new column (`pindahKe`).
  const { updatedAt: _buang, ...sisa } = t
  const body = { ...sisa, status: p.to, pindahKe: { st: p.to, at: Date.now() }, urutan: urutanSisip([...isiKolom(p.to), t], t.id, p.sebelum ?? null) ?? Date.now() }
  segarkanProgress(body)
  await bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
}

// ---- "+ Tambah kartu" (boardTambah) ----
const tambah = ref<Record<string, string>>({})
const tambahInput = ref<Record<string, unknown>>({})
async function tambahKartu(st: string) {
  const nama = (tambah.value[st] || '').trim()
  if (!nama) return
  const body: Partial<BdTask> = {
    name: nama,
    desc: '',
    // Upstream resolves the default (account div, or the open project's div);
    // empty falls back to the first division option, never a hardcoded one.
    div: divisiBawaan(props.divDefault, opsiDivisi(props.people)),
    status: st,
    priority: 'Medium',
    deadline: '',
    type: props.projectPreset ? 'Project' : 'Ad-hoc',
    project: props.dailyDefault ? null : (props.projectPreset || null),
    daily: !!props.dailyDefault,
    important: true,
    urgent: false,
    progress: 0,
    subtasks: [],
    dependsOn: [],
  }
  setPics(body, props.picDefault ? [props.picDefault] : [])
  tambah.value[st] = ''
  const ok = await bdTulisDiam(() => buatBd<BdTask>('tasks', body))
  if (ok) {
    const el = tambahInput.value[st] as { focus?: () => void } | undefined
    el?.focus?.()
  }
}
</script>

<template>
  <AppKanban
    :columns="kolomKanban"
    layout="scroll"
    list-class="max-h-[min(68dvh,640px)]"
    :col-min="300"
    @move="pindahKartu"
    @reorder="urutKartu"
  >
    <template #header="{ column }">
      <span class="text-xs font-bold uppercase tracking-wider text-highlighted">{{ column.title }}</span>
      <span class="ml-auto rounded-full bg-default px-2 py-0.5 text-xs font-bold text-ink-900 ring-1 ring-default num">{{ column.count }}</span>
    </template>
    <template #card="{ item, dragging, dragStart, dragEnd }">
      <BdKanbanCard
        :task="item"
        :semua="bank"
        :people="people"
        :project-name="showProject ? namaProject(item.project) : undefined"
        :show-daily="showProject"
        :dragging="dragging"
        draggable="true"
        @dragstart="dragStart"
        @dragend="dragEnd"
        @buka="emit('buka', item)"
        @sub-toggle="(ix: number, on: boolean) => emit('subToggle', item, ix, on)"
      />
    </template>
    <template #empty="{ column }">
      <div
        v-if="column.id === 'Done' && arsip === 'aktif'"
        class="rounded-panel border border-dashed border-default px-3 py-4 text-center text-xs text-muted"
      >
        {{ arsipKolom(column.id) ? `${arsipKolom(column.id)} task Done diarsipkan` : 'Seret kartu ke sini kalau sudah selesai' }}
      </div>
    </template>
    <template #footer="{ column }">
      <div
        v-if="allowAdd && column.id !== 'Done'"
        class="px-1 pb-1"
      >
        <UInput
          :ref="(el) => { tambahInput[column.id] = el }"
          :model-value="tambah[column.id] || ''"
          :placeholder="`+ Tambah kartu, Enter…`"
          size="sm"
          class="w-full"
          @update:model-value="(v: string | number) => tambah[column.id] = String(v)"
          @keydown.enter="tambahKartu(column.id)"
        />
      </div>
    </template>
  </AppKanban>
</template>
