<!--
  One task list as a Kanban board (old `kanbanHtml`, deploy/bd/index.html:2219).
  One column per status; in Aktif mode the Done column stays as a drop target
  but shows only the archived count — without it no card could be finished
  from the board. Dropping onto Done runs the one guard (`cekBolehDone`);
  "+ Tambah kartu" births a row with empty sub-tasks and no order.

  Cards are `BdKanbanCard` (old `boardCard`), not the list row: the row's
  tick, edit and delete buttons left ~100px for the text in a 240px column and
  pushed nowrap chips out of the card. While dragging, the dragged card fades
  and the target column is highlighted (old `.dragging` / `.drop`).

  Shared by My Task and the project detail Kanban tab.
-->
<script setup lang="ts">
import type { BdPerson, BdTask } from '~/composables/useBd'
import { bdTulisDiam, buatBd, lahirkanUlangSetelah, ubahBd, versiBaris } from '~/composables/useBd'
import {
  OWNER_DIVS, STATUS_FLOW, cekBolehDone, pesanTunggu, segarkanProgress, setPics, urutDeadline,
  type ModeArsip,
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
}>(), {
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
const isiKolom = (st: string) => {
  const l = props.tasks.filter(t => (t.status || 'To Do') === st).slice().sort(urutDeadline)
  return (st === 'Done' && props.arsip === 'aktif') ? [] : l
}
const arsipKolom = (st: string) => props.tasks.filter(t => (t.status || 'To Do') === st).length
const namaProject = (id?: string | null) => props.projects?.find(p => p.id === id)?.name

// ---- drag between columns (desktop) ----
const dragId = ref<string | null>(null)
const kolomSasaran = ref<string | null>(null)
function dragMulai(e: DragEvent, t: BdTask) {
  dragId.value = t.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer?.setData('text/plain', t.id)
}
function dragSelesai() {
  dragId.value = null
  kolomSasaran.value = null
}
function dragKeluar(e: DragEvent, st: string) {
  // dragleave also fires when moving onto a child card; only clear when the
  // pointer really left the column.
  const ke = e.relatedTarget as Node | null
  if (ke && (e.currentTarget as HTMLElement).contains(ke)) return
  if (kolomSasaran.value === st) kolomSasaran.value = null
}
async function dropKolom(st: string) {
  const t = bank.value.find(x => x.id === dragId.value)
  dragSelesai()
  if (!t || t.status === st) return
  if (st === 'Done') {
    const cek = cekBolehDone(t, t.dependsOn, bank.value)
    if (!cek.boleh) {
      toast.add({ title: pesanTunggu(t, cek.nama), color: 'error' })
      return
    }
  }
  // PUT carries the whole row: dragging OUT of Done must also drop `doneAt`.
  const { updatedAt: _buang, ...sisa } = t
  const body = { ...sisa, status: st }
  segarkanProgress(body)
  const ok = await bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
  if (ok && st === 'Done') await lahirkanUlangSetelah({ ...t, ...body, id: t.id }, bank.value)
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
    div: props.divDefault && OWNER_DIVS.includes(props.divDefault) ? props.divDefault : OWNER_DIVS[0]!,
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
  <div class="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
    <section
      v-for="st in kolom"
      :key="st"
      class="min-w-0 rounded-panel border bg-muted/40 transition-colors"
      :class="kolomSasaran === st ? 'border-primary-400 bg-primary-50' : 'border-default'"
      @dragover.prevent="kolomSasaran = st"
      @dragleave="dragKeluar($event, st)"
      @drop.prevent="dropKolom(st)"
    >
      <header class="flex items-center justify-between border-b border-default px-3 py-2">
        <span class="text-sm font-bold text-highlighted">{{ st }}</span>
        <span class="rounded-full bg-table-head px-2 py-0.5 text-xs font-bold text-table-head-text num">{{ arsipKolom(st) }}</span>
      </header>
      <div class="grid gap-2 p-2">
        <BdKanbanCard
          v-for="t in isiKolom(st)"
          :key="t.id"
          :task="t"
          :semua="bank"
          :people="people"
          :project-name="showProject ? namaProject(t.project) : undefined"
          :dragging="dragId === t.id"
          draggable="true"
          @dragstart="dragMulai($event, t)"
          @dragend="dragSelesai"
          @buka="emit('buka', t)"
          @sub-toggle="(ix: number, on: boolean) => emit('subToggle', t, ix, on)"
        />
        <div
          v-if="st === 'Done' && arsip === 'aktif'"
          class="rounded-field border border-dashed border-default px-3 py-4 text-center text-xs text-muted"
        >
          {{ arsipKolom(st) ? `${arsipKolom(st)} task Done diarsipkan` : 'Seret kartu ke sini kalau sudah selesai' }}
        </div>
        <div
          v-if="allowAdd && st !== 'Done'"
          class="px-1 pb-1"
        >
          <UInput
            :ref="(el) => { tambahInput[st] = el }"
            :model-value="tambah[st] || ''"
            :placeholder="`+ Tambah kartu, Enter…`"
            size="sm"
            class="w-full"
            @update:model-value="(v: string | number) => tambah[st] = String(v)"
            @keydown.enter="tambahKartu(st)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
