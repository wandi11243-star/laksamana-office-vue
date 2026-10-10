<!--
  Task form (old `taskModal` + `fieldSubDep`, deploy/bd/index.html:1934-2017,
  2105-2173). PIC may be many; `pic` is always `pics[0]`. The Eisenhower
  quadrant is shown as a PREVIEW and never stored — it is derived from the two
  switches (`:1316-1322`).

  Sub-tasks and order live as LOCAL drafts and only enter the task on Save:
  editing `t.subtasks` directly would keep a cancelled edit alive into the
  next save. PUT sends the whole row (`ubahBd`), so reopening also drops
  `doneAt` — a PATCH merge could not remove it.
-->
<script setup lang="ts">
import type { BdPerson, BdProject, BdSubtask, BdTask } from '~/composables/useBd'
import { buatBd, bdSimpan, hapusTaskDenganUrutan, pesanHapusTask, ubahBd, versiBaris } from '~/composables/useBd'
import {
  OWNER_DIVS, PILIHAN_TANPA, PRIORITAS, STATUS_FLOW, TASK_TIPE, cekBolehDone, deps, kuadran,
  menungguTransitif, opsiProject as opsiProjectBd, pesanTunggu, segarkanProgress, selesai, setPics, subs, todayISO, uidBd,
} from '~/utils/bd-rumus'
import { WARNA_KUADRAN, WARNA_TASK } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicPicker from '~/widgets/bd/BdPicPicker.vue'

const props = defineProps<{
  task?: BdTask | null
  presetProject?: string | null
  /** All tasks: order candidates + the waiters named on delete. */
  tasks: BdTask[]
  projects: BdProject[]
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({
  name: '',
  desc: '',
  div: OWNER_DIVS[0]!,
  pics: [] as string[],
  status: 'To Do',
  priority: 'Medium',
  type: 'Ad-hoc',
  start: '',
  deadline: todayISO(),
  project: null as string | null,
  important: true,
  urgent: false,
})
/** Sub-task drafts (`_subDraft`): id kept, empty text dropped on save. */
const subDraf = ref<{ id: string, t: string, done: boolean, d: string }[]>([])
const subBaru = ref('')
/** Order drafts (`_depDraft`): waited-on ids, committed on save. */
const depDraf = ref<string[]>([])
const hapusMau = ref(false)

watch(open, (o) => {
  if (!o) return
  const t = props.task
  if (t) {
    f.name = t.name
    f.desc = t.desc || ''
    f.div = t.div || OWNER_DIVS[0]!
    f.pics = [...(t.pics || (t.pic ? [t.pic] : []))]
    f.status = t.status
    f.priority = t.priority
    f.type = t.type || 'Ad-hoc'
    f.start = t.start || ''
    f.deadline = t.deadline || ''
    f.project = t.project || null
    f.important = !!t.important
    f.urgent = !!t.urgent
    subDraf.value = subs(t).map(x => ({ id: String(x.id || uidBd('s')), t: String(x.t || ''), done: !!x.done, d: String(x.d || '') }))
    depDraf.value = deps(t).filter(d => d !== t.id && props.tasks.some(x => x.id === d))
  }
  else {
    const aku = props.aku
    f.name = ''
    f.desc = ''
    f.div = aku && OWNER_DIVS.includes(aku.div) ? aku.div : OWNER_DIVS[0]!
    f.pics = aku ? [aku.id] : []
    f.status = 'To Do'
    f.priority = 'Medium'
    f.type = 'Ad-hoc'
    f.start = ''
    f.deadline = todayISO()
    f.project = props.presetProject || null
    f.important = true
    f.urgent = false
    subDraf.value = []
    depDraf.value = []
  }
  subBaru.value = ''
})

const q = computed(() => kuadran(f))
const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))
const subHitung = computed(() => {
  const n = subDraf.value.length
  return { n, d: subDraf.value.filter(s => s.done).length }
})
/**
 * Order candidates (`depGambar`): same project, self excluded, circle-makers
 * hidden. Already-picked rows always stay, Done ones sink to the bottom.
 */
const depCalon = computed(() => {
  const self = props.task?.id
  const proj = f.project || null
  return props.tasks.filter((x) => {
    if (x.id === self) return false
    if (depDraf.value.includes(x.id)) return true
    if ((x.project || null) !== proj) return false
    if (self && menungguTransitif(props.tasks, x.id, self)) return false
    return true
  }).slice().sort((a, b) => ((selesai(a) ? 1 : 0) - (selesai(b) ? 1 : 0)) || String(a.name).localeCompare(String(b.name)))
})
const ditungguOleh = computed(() => (props.task ? props.tasks.filter(x => deps(x).includes(props.task!.id)) : []))
const pesanHapus = computed(() => (props.task ? pesanHapusTask(props.task, props.tasks) : ''))

function subTambah() {
  const v = subBaru.value.trim()
  if (!v) return
  subDraf.value.push({ id: uidBd('s'), t: v, done: false, d: '' })
  subBaru.value = ''
}

async function simpan() {
  if (!f.name.trim()) {
    toast.add({ title: 'Nama task wajib diisi.', color: 'error' })
    return
  }
  // A start past the deadline would draw the Timeline bar backwards — refused
  // here, never silently drawn as a diamond.
  if (f.start && f.deadline && f.start > f.deadline) {
    toast.add({ title: 'Tanggal mulai tidak boleh sesudah deadline.', color: 'error' })
    return
  }
  // Sub-tasks without text are dropped: empty rows keep x/y from ever balancing.
  const subtasks: BdSubtask[] = subDraf.value
    .map(s => ({ id: s.id, t: s.t.trim(), done: s.done, ...(s.d ? { d: s.d } : {}) }))
    .filter(s => s.t)
  const dependsOn = depDraf.value.filter(d => d !== props.task?.id && props.tasks.some(x => x.id === d))
  if (f.status === 'Done') {
    const cek = cekBolehDone({ id: props.task?.id, name: f.name }, dependsOn, props.tasks)
    if (!cek.boleh) {
      toast.add({ title: pesanTunggu({ name: f.name }, cek.nama), color: 'error' })
      return
    }
  }
  const body: Partial<BdTask> = {
    name: f.name.trim(),
    desc: f.desc.trim(),
    div: f.div,
    status: f.status,
    priority: f.priority,
    type: f.type,
    start: f.start || '',
    deadline: f.deadline,
    project: f.project || null,
    important: f.important,
    urgent: f.urgent,
    subtasks,
    dependsOn,
  }
  setPics(body, f.pics)
  const lama = props.task
  if (lama) {
    // The full row goes out (PUT replaces): `segarkanProgress` also drops a
    // stale `doneAt` when the task is reopened.
    const kirim: Partial<BdTask> = { ...lama, ...body }
    delete kirim.updatedAt
    segarkanProgress(kirim)
    const ok = await bdSimpan(() => ubahBd<BdTask>('tasks', lama.id, kirim, versiBaris(lama)), 'Task diperbarui')
    if (ok) open.value = false
  }
  else {
    const kirim: Partial<BdTask> = { progress: 0, ...body }
    segarkanProgress(kirim)
    const ok = await bdSimpan(() => buatBd<BdTask>('tasks', kirim), 'Task ditambahkan')
    if (ok) open.value = false
  }
}

async function hapus() {
  const lama = props.task
  if (!lama) return
  hapusMau.value = false
  const ok = await hapusTaskDenganUrutan(lama, props.tasks)
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="task ? 'Edit task' : 'Task baru'"
    description="Prioritas ala Eisenhower — penting × mendesak."
  >
    <div class="grid gap-4">
      <UFormField label="Nama task">
        <UInput
          v-model="f.name"
          placeholder="Apa yang harus dikerjakan?"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Deskripsi">
        <UTextarea
          v-model="f.desc"
          placeholder="Detail / catatan…"
          :rows="3"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Divisi">
        <USelect
          v-model="f.div"
          :items="OWNER_DIVS"
          class="w-full"
        />
      </UFormField>
      <UFormField label="PIC — boleh lebih dari satu">
        <BdPicPicker
          v-model="f.pics"
          :people="people"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Status">
          <USelect
            v-model="f.status"
            :items="STATUS_FLOW"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Prioritas">
          <USelect
            v-model="f.priority"
            :items="PRIORITAS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipe">
          <USelect
            v-model="f.type"
            :items="TASK_TIPE"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Mulai (opsional)">
          <UInput
            v-model="f.start"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Deadline">
          <UInput
            v-model="f.deadline"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Project (opsional)">
          <USelect
            :model-value="f.project ?? PILIHAN_TANPA"
            :items="opsiProject"
            class="w-full"
            @update:model-value="(v: string | undefined) => { f.project = !v || v === PILIHAN_TANPA ? null : v }"
          />
        </UFormField>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Sub-task{{ subHitung.n ? ` · ${subHitung.d}/${subHitung.n} selesai` : '' }}
        </p>
        <div
          v-if="subDraf.length"
          class="mb-2 divide-y divide-default rounded-field border border-default"
        >
          <div
            v-for="(s, ix) in subDraf"
            :key="s.id"
            class="flex items-center gap-2 px-2 py-1.5"
          >
            <UCheckbox
              :model-value="s.done"
              @update:model-value="(v: boolean | 'indeterminate') => s.done = v === true"
            />
            <UInput
              :model-value="s.t"
              placeholder="Sub-task…"
              size="sm"
              class="min-w-0 flex-1"
              :class="s.done ? 'opacity-60 line-through' : ''"
              @update:model-value="(v: string | number) => s.t = String(v)"
            />
            <UInput
              :model-value="s.d"
              type="date"
              size="sm"
              title="Deadline sub-task (opsional)"
              class="w-36 shrink-0"
              @update:model-value="(v: string | number) => s.d = String(v)"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Hapus sub-task"
              @click="subDraf.splice(ix, 1)"
            />
          </div>
        </div>
        <p
          v-else
          class="mb-2 text-xs text-muted"
        >
          Belum ada sub-task.
        </p>
        <div class="flex gap-2">
          <UInput
            v-model="subBaru"
            placeholder="Tambah sub-task, Enter…"
            size="sm"
            class="min-w-0 flex-1"
            @keydown.enter.prevent="subTambah"
          />
          <UButton
            label="Tambah"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="subTambah"
          />
        </div>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Baru bisa Done kalau task ini sudah Done
        </p>
        <div
          v-if="depCalon.length"
          class="grid max-h-44 gap-1 overflow-y-auto rounded-field border border-default p-2"
        >
          <label
            v-for="x in depCalon"
            :key="x.id"
            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50"
          >
            <UCheckbox
              :model-value="depDraf.includes(x.id)"
              @update:model-value="(v: boolean | 'indeterminate') => { const i = depDraf.indexOf(x.id); if (v === true && i < 0) depDraf.push(x.id); if (v !== true && i > -1) depDraf.splice(i, 1) }"
            />
            <span
              class="min-w-0 flex-1 truncate"
              :class="selesai(x) ? 'text-muted line-through' : 'text-highlighted'"
            >{{ x.name }}</span>
            <AppStatus
              size="sm"
              :color="WARNA_TASK[x.status] || 'neutral'"
            >{{ x.status }}</AppStatus>
          </label>
        </div>
        <p
          v-else
          class="text-xs text-muted"
        >
          {{ f.project ? 'Belum ada task lain di project ini.' : 'Pilih project dulu — urutan diatur antar task di project yang sama.' }}
        </p>
        <p
          v-if="ditungguOleh.length"
          class="mt-1 text-xs text-muted"
        >
          Ditunggu oleh: {{ ditungguOleh.map(x => x.name).join(', ') }}
        </p>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Prioritas Eisenhower
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <AppPilihan
            v-model="f.important"
            name="task-important"
            :options="[{ value: true, label: 'Penting: ya' }, { value: false, label: 'Tidak' }]"
          />
          <AppPilihan
            v-model="f.urgent"
            name="task-urgent"
            :options="[{ value: true, label: 'Mendesak: ya' }, { value: false, label: 'Tidak' }]"
          />
        </div>
        <div class="mt-2">
          <AppStatus
            :color="WARNA_KUADRAN[q.k]"
            size="sm"
          >
            {{ q.l }} — {{ q.d }}
          </AppStatus>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="task"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        @click="hapusMau = true"
      />
    </template>
  </ResponsiveSheet>

  <BdKonfirmasi
    v-model:open="hapusMau"
    title="Hapus task ini?"
    :description="pesanHapus"
    @konfirmasi="hapus"
  />
</template>
