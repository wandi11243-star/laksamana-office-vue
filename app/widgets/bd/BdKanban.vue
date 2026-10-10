<!--
  One task list as a Kanban board (old `kanbanHtml`, deploy/bd/index.html:2219).
  One column per status; in Aktif mode the Done column stays as a drop target
  but shows only the archived count — without it no card could be finished
  from the board. Dropping onto Done runs the one guard (`cekBolehDone`);
  "+ Tambah kartu" births a row with empty sub-tasks and no order.

  Shared by My Task and the project detail Kanban tab.
-->
<script setup lang="ts">
import type { BdPerson, BdTask } from '~/composables/useBd'
import { bdTulisDiam, buatBd, ubahBd, versiBaris } from '~/composables/useBd'
import {
  OWNER_DIVS, STATUS_FLOW, cekBolehDone, penghalang, pesanTunggu, segarkanProgress, setPics, urutDeadline,
  type ModeArsip,
} from '~/utils/bd-rumus'
import BdTaskRow from '~/widgets/bd/BdTaskRow.vue'

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
}>(), {
  arsip: 'aktif',
  allowAdd: true,
})
const emit = defineEmits<{
  buka: [t: BdTask]
  toggle: [t: BdTask]
  hapus: [t: BdTask]
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
const hal = (t: BdTask) => penghalang(t, bank.value)

// ---- drag between columns (desktop) ----
let dragId: string | null = null
function dragMulai(e: DragEvent, t: BdTask) {
  dragId = t.id
  e.dataTransfer?.setData('text/plain', t.id)
}
function dropKolom(st: string) {
  const t = bank.value.find(x => x.id === dragId)
  dragId = null
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
  bdTulisDiam(() => ubahBd<BdTask>('tasks', t.id, body, versiBaris(t)))
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
    project: props.projectPreset || null,
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
      class="min-w-0 rounded-panel border border-default bg-muted/40"
      @dragover.prevent
      @drop="dropKolom(st)"
    >
      <header class="flex items-center justify-between border-b border-default px-3 py-2">
        <span class="text-sm font-bold text-highlighted">{{ st }}</span>
        <span class="rounded-full bg-table-head px-2 py-0.5 text-xs font-bold text-table-head-text num">{{ arsipKolom(st) }}</span>
      </header>
      <div class="grid gap-2 p-2">
        <div
          v-for="t in isiKolom(st)"
          :key="t.id"
          draggable="true"
          @dragstart="dragMulai($event, t)"
        >
          <div
            class="rounded-field border border-default bg-default"
            :class="hal(t).length ? 'border-vip/50' : ''"
          >
            <p
              v-if="hal(t).length"
              class="flex items-center gap-1 px-3 pt-2 text-[11px] font-semibold text-vip"
              :title="`Menunggu: ${hal(t).map(x => x.name).join(', ')}`"
            >
              <UIcon
                name="i-lucide-lock"
                class="size-3"
              />
              Menunggu {{ hal(t).length }}
            </p>
            <BdTaskRow
              :task="t"
              :people="people"
              :project-name="showProject ? namaProject(t.project) : undefined"
              :hide-proj="!showProject"
              hide-quad
              @buka="emit('buka', t)"
              @toggle="emit('toggle', t)"
              @hapus="emit('hapus', t)"
            />
          </div>
        </div>
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
