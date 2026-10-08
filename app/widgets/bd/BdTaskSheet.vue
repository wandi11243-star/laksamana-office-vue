<!--
  Task form (old `taskModal`, deploy/bd/index.html:1770-1838). PIC may be many;
  `pic` is always `pics[0]`. The Eisenhower quadrant is shown as a PREVIEW and
  never stored — it is derived from the two switches (`:1316-1322`).
-->
<script setup lang="ts">
import type { BdPerson, BdProject, BdTask } from '~/composables/useBd'
import { buatBd, bdSimpan, hapusBd, ubahBd, versiBaris } from '~/composables/useBd'
import { OWNER_DIVS, PILIHAN_TANPA, PRIORITAS, STATUS_FLOW, TASK_TIPE, kuadran, opsiProject as opsiProjectBd, setPics, todayISO } from '~/utils/bd-rumus'
import { WARNA_KUADRAN } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicPicker from '~/widgets/bd/BdPicPicker.vue'

const props = defineProps<{
  task?: BdTask | null
  presetProject?: string | null
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
  deadline: todayISO(),
  project: null as string | null,
  important: true,
  urgent: false,
})
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
    f.deadline = t.deadline || ''
    f.project = t.project || null
    f.important = !!t.important
    f.urgent = !!t.urgent
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
    f.deadline = todayISO()
    f.project = props.presetProject || null
    f.important = true
    f.urgent = false
  }
})

const q = computed(() => kuadran(f))
const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))

async function simpan() {
  if (!f.name.trim()) {
    toast.add({ title: 'Nama task wajib diisi.', color: 'error' })
    return
  }
  const body: Partial<BdTask> = {
    name: f.name.trim(),
    desc: f.desc.trim(),
    div: f.div,
    status: f.status,
    priority: f.priority,
    type: f.type,
    deadline: f.deadline,
    project: f.project || null,
    important: f.important,
    urgent: f.urgent,
  }
  setPics(body, f.pics)
  const lama = props.task
  if (lama) {
    body.progress = f.status === 'Done' ? 100 : (lama.progress || 0)
    const ok = await bdSimpan(() => ubahBd<BdTask>('tasks', lama.id, { ...body, id: lama.id }, versiBaris(lama)), 'Task diperbarui')
    if (ok) open.value = false
  }
  else {
    body.progress = f.status === 'Done' ? 100 : 0
    const ok = await bdSimpan(() => buatBd<BdTask>('tasks', body), 'Task ditambahkan')
    if (ok) open.value = false
  }
}

async function hapus() {
  const lama = props.task
  if (!lama) return
  hapusMau.value = false
  const ok = await bdSimpan(() => hapusBd('tasks', lama.id, versiBaris(lama)), 'Task dihapus')
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
      <div class="grid gap-4 sm:grid-cols-2">
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
    description="Semua kru ikut kehilangan datanya."
    @konfirmasi="hapus"
  />
</template>
