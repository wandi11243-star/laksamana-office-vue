<!--
  Tasks — the old viewTasks (howandi_life/index.html:622-635) with its four
  sub-views (Matrix / Today / Minggu ini / Per bisnis) and the biz+project
  filters. The Eisenhower quadrant decides the cell (hlife.md D.3).

  The project dropdown follows F.6: a Done project is hidden, EXCEPT the one
  currently attached to the task being edited, marked "· selesai" — without it,
  opening an old task silently drops its project (old projOptions, :848-851).
-->
<script setup lang="ts">
import type { HlifeBusiness, HlifeProject, HlifeTask } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import type { KuadranHlife } from '~/utils/hlife'
import { PILIHAN_SEMUA, PILIHAN_TANPA, kuadranHlife, tautanGcal, terlambat } from '~/utils/hlife'
import { KUADRAN_META, lencanaTugas } from '~/utils/status-hlife'
import { angka, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const route = useRoute()
const toast = useToast()

const { data: tasksData, status, refresh: refreshTasks } = useHlifeResource<HlifeTask>('tasks')
const { data: bizData } = useHlifeResource<HlifeBusiness>('businesses')
const { data: projData } = useHlifeResource<HlifeProject>('projects')

const tasks = computed(() => tasksData.value.rows)
const bisnis = computed(() => bizData.value.rows)
const proyek = computed(() => projData.value.rows)

type Tampilan = 'matrix' | 'today' | 'week' | 'biz'
const tampilan = ref<Tampilan>('matrix')
const filterBiz = ref(PILIHAN_SEMUA)
const filterProyek = ref(PILIHAN_SEMUA)

const TAMPILAN: { value: Tampilan, label: string }[] = [
  { value: 'matrix', label: 'Matrix' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'biz', label: 'Per bisnis' },
]

const hari = hariIni()

const tersaring = computed(() => tasks.value.filter(t =>
  (filterBiz.value === PILIHAN_SEMUA || t.biz === filterBiz.value)
  && (filterProyek.value === PILIHAN_SEMUA || t.project === filterProyek.value)))

interface Grup {
  judul: string
  desc?: string
  kuadran?: KuadranHlife
  items: HlifeTask[]
}

/** All four sub-views flattened to groups, so one row markup serves them all. */
const grup = computed<Grup[]>(() => {
  const dasar = tersaring.value
  if (tampilan.value === 'matrix') {
    const pesan: KuadranHlife[] = ['do', 'schedule', 'delegate', 'delete']
    return pesan.map((k) => {
      const meta = KUADRAN_META[k]
      return { judul: meta.label, desc: meta.desc, kuadran: k, items: dasar.filter(t => !t.done && kuadranHlife(t) === k) }
    })
  }
  if (tampilan.value === 'today') {
    return [{ judul: 'Hari ini & overdue', items: dasar.filter(t => t.due === hari || terlambat(t)) }]
  }
  if (tampilan.value === 'week') {
    return [{ judul: '7 hari ke depan', items: dasar.filter(t => t.due && t.due <= tambahHari(hari, 7) && !t.done).slice().sort((a, b) => (a.due < b.due ? -1 : 1)) }]
  }
  const peta = new Map<string, HlifeTask[]>()
  dasar.filter(t => !t.done).forEach((t) => {
    const k = t.biz || 'Tanpa bisnis'
    peta.set(k, [...(peta.get(k) ?? []), t])
  })
  return [...peta].map(([judul, items]) => ({ judul, items }))
})

const adaFilter = computed(() => filterBiz.value !== PILIHAN_SEMUA || filterProyek.value !== PILIHAN_SEMUA)
function resetFilter() {
  filterBiz.value = PILIHAN_SEMUA
  filterProyek.value = PILIHAN_SEMUA
}

const opsiBisnis = computed(() => [
  { value: PILIHAN_SEMUA, label: 'Semua bisnis' },
  ...bisnis.value.map(b => ({ value: b.name, label: b.name })),
])
const opsiProyekFilter = computed(() => [
  { value: PILIHAN_SEMUA, label: 'Semua project' },
  ...proyek.value.map(p => ({ value: p.id, label: p.name })),
])

// --- task sheet (`:859-871`) ------------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({
  id: '',
  name: '',
  desc: '',
  biz: '',
  project: '',
  owner: '',
  due: '',
  est: 0,
  important: true,
  urgent: false,
})

const opsiBisnisForm = computed(() => [
  { value: PILIHAN_TANPA, label: '— Tanpa bisnis —' },
  ...bisnis.value.map(b => ({ value: b.name, label: b.name })),
])

/** `projOptions()` (`:848-851`). */
const opsiProyekForm = computed(() => [
  { value: PILIHAN_TANPA, label: '— Tanpa project —' },
  ...proyek.value
    .filter(p => p.stage !== 'Done' || p.id === form.project)
    .map(p => ({ value: p.id, label: `${p.name}${p.stage === 'Done' ? ' · selesai' : ''}` })),
])

const metaForm = computed(() => KUADRAN_META[kuadranHlife({ important: form.important, urgent: form.urgent })])

function buka(t?: HlifeTask, prefill: { biz?: string, project?: string } = {}) {
  Object.assign(form, t
    ? { id: t.id, name: t.name, desc: t.desc || '', biz: t.biz || PILIHAN_TANPA, project: t.project || PILIHAN_TANPA, owner: t.owner || '', due: t.due || '', est: t.est || 0, important: !!t.important, urgent: !!t.urgent }
    : { id: '', name: '', desc: '', biz: prefill.biz || PILIHAN_TANPA, project: prefill.project || PILIHAN_TANPA, owner: '', due: '', est: 0, important: true, urgent: false })
  sheet.value = true
}

function muatUlang() {
  return refreshTasks()
}

async function simpan() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ title: 'Nama task wajib diisi.', color: 'error' })
    return
  }
  const body = {
    name,
    desc: form.desc,
    biz: form.biz === PILIHAN_TANPA ? '' : form.biz,
    project: form.project === PILIHAN_TANPA ? '' : form.project,
    owner: form.owner,
    due: form.due,
    est: Number(form.est) || 0,
    important: !!form.important,
    urgent: !!form.urgent,
  }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = tasksData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi task belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('tasks', form.id, { ...body, id: form.id, done: tasks.value.find(t => t.id === form.id)?.done ?? false }, versi)
      toast.add({ title: 'Task diperbarui.', color: 'success' })
    }
    else {
      await createHlifeRecord<HlifeTask>('tasks', { ...body, done: false })
      toast.add({ title: 'Task ditambahkan.', color: 'success' })
    }
    await refreshTasks()
    sheet.value = false
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function toggle(t: HlifeTask) {
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
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function hapus() {
  if (!form.id) return
  const versi = tasksData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi task belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('tasks', form.id, versi)
    await refreshTasks()
    sheet.value = false
    toast.add({ title: 'Task dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function keGcal(t: HlifeTask) {
  window.open(tautanGcal(t.name, t.due, undefined, undefined, 'Task'), '_blank')
}

// Prefill from the Command Center / detail screens: /hlife/tasks?new=1&biz=…&project=…
// or ?edit=<id>. The list may still be loading at mount, so wait for it once.
let sudahBukaQuery = false
watch(tasks, (list) => {
  if (sudahBukaQuery) return
  const q = route.query
  if (q.edit && typeof q.edit === 'string') {
    const t = list.find(x => x.id === q.edit)
    if (!t) return
    sudahBukaQuery = true
    buka(t)
  }
  else if (q.new) {
    sudahBukaQuery = true
    buka(undefined, {
      biz: typeof q.biz === 'string' ? q.biz : '',
      project: typeof q.project === 'string' ? q.project : '',
    })
  }
}, { immediate: true })
</script>

<template>
  <AppPage
    title="Tasks"
    description="Task & project tersambung — task yang sama, view berbeda. Filter per bisnis/project."
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="tampilan"
          :options="TAMPILAN"
          size="sm"
        />
        <UButton
          label="Task"
          icon="i-lucide-plus"
          @click="buka()"
        />
      </div>
    </template>

    <AppPanel>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField
          label="Filter bisnis"
          class="w-48"
        >
          <USelect
            v-model="filterBiz"
            :items="opsiBisnis"
            size="sm"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Filter project"
          class="w-52"
        >
          <USelect
            v-model="filterProyek"
            :items="opsiProyekFilter"
            size="sm"
            class="w-full"
          />
        </UFormField>
        <UButton
          v-if="adaFilter"
          label="Reset filter"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="resetFilter"
        />
      </div>
    </AppPanel>

    <p
      v-if="status === 'pending' && !tasks.length"
      class="mb-4 text-sm text-muted"
    >
      Memuat task…
    </p>

    <!-- Eisenhower matrix: two columns on phone, four on desktop -->
    <div
      v-if="tampilan === 'matrix'"
      class="grid gap-4 md:grid-cols-2"
    >
      <AppPanel
        v-for="g in grup"
        :key="g.judul"
        :count="g.items.length"
      >
        <template #head>
          <div class="min-w-0">
            <AppStatus
              :color="KUADRAN_META[g.kuadran!].tone"
              :icon="KUADRAN_META[g.kuadran!].icon"
            >
              {{ g.judul }}
            </AppStatus>
            <p class="mt-1 text-xs text-muted">
              {{ g.desc }}
            </p>
          </div>
        </template>
        <div
          v-if="g.items.length"
          class="divide-y divide-default"
        >
          <div
            v-for="t in g.items"
            :key="t.id"
            class="flex items-start gap-3 py-2.5"
          >
            <button
              type="button"
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-default bg-default text-transparent transition-colors hover:border-success focus-visible:outline-2 focus-visible:outline-primary"
              aria-label="Tandai selesai"
              @click="toggle(t)"
            >
              <UIcon
                name="i-lucide-check"
                class="size-3.5"
              />
            </button>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-highlighted">
                {{ t.name }}
              </p>
              <p
                v-if="t.desc"
                class="text-xs text-muted"
              >
                {{ t.desc }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <AppStatus
                  v-for="l in lencanaTugas(t, { projects: proyek })"
                  :key="l.label"
                  size="sm"
                  :color="l.color"
                  :icon="l.icon"
                >
                  {{ l.label }}
                </AppStatus>
              </div>
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <UButton
                v-if="t.due"
                icon="i-lucide-calendar-plus"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Google Calendar"
                @click="keGcal(t)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah task"
                @click="buka(t)"
              />
            </div>
          </div>
        </div>
        <p
          v-else
          class="py-2 text-sm text-dimmed"
        >
          Kosong.
        </p>
      </AppPanel>
    </div>

    <!-- Today / week / per-business lists -->
    <template v-else>
      <AppPanel
        v-for="g in grup"
        :key="g.judul"
        :title="g.judul"
        :count="g.items.length"
      >
        <div
          v-if="g.items.length"
          class="divide-y divide-default"
        >
          <div
            v-for="t in g.items"
            :key="t.id"
            class="flex items-start gap-3 py-2.5"
          >
            <button
              type="button"
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="t.done ? 'border-success bg-success text-white' : 'border-default bg-default text-transparent hover:border-success'"
              :aria-label="t.done ? 'Tandai belum selesai' : 'Tandai selesai'"
              @click="toggle(t)"
            >
              <UIcon
                name="i-lucide-check"
                class="size-3.5"
              />
            </button>
            <div class="min-w-0 flex-1">
              <p
                class="text-sm font-semibold"
                :class="t.done ? 'text-dimmed line-through' : 'text-highlighted'"
              >
                {{ t.name }}
              </p>
              <p
                v-if="t.desc"
                class="text-xs text-muted"
              >
                {{ t.desc }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <AppStatus
                  v-for="l in lencanaTugas(t, { projects: proyek })"
                  :key="l.label"
                  size="sm"
                  :color="l.color"
                  :icon="l.icon"
                >
                  {{ l.label }}
                </AppStatus>
              </div>
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <UButton
                v-if="t.due"
                icon="i-lucide-calendar-plus"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Google Calendar"
                @click="keGcal(t)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah task"
                @click="buka(t)"
              />
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          Tidak ada task.
        </p>
      </AppPanel>
      <p
        v-if="tampilan === 'biz' && !grup.length"
        class="text-sm text-muted"
      >
        Belum ada task aktif.
      </p>
    </template>

    <p
      v-if="tampilan === 'today' || tampilan === 'week'"
      class="text-xs text-muted"
    >
      {{ angka(tasks.length) }} task total · {{ angka(tasks.filter(t => t.done).length) }} selesai
    </p>

    <!-- Task form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit task' : 'Task baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Nama task"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="Apa yang harus dikerjakan?"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Detail / keterangan (opsional)">
          <UTextarea
            v-model="form.desc"
            :rows="2"
            placeholder="Konteks, checklist singkat, catatan…"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Bisnis">
            <USelect
              v-model="form.biz"
              :items="opsiBisnisForm"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Project">
            <USelect
              v-model="form.project"
              :items="opsiProyekForm"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Owner / PIC">
            <UInput
              v-model="form.owner"
              placeholder="Saya / nama tim"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Deadline">
            <UInput
              v-model="form.due"
              type="date"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Estimasi (menit)">
            <UInput
              v-model.number="form.est"
              type="number"
              min="0"
              placeholder="mis. 30"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <div>
            <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              Prioritas
            </p>
            <AppStatus
              :color="metaForm.tone"
              :icon="metaForm.icon"
            >
              {{ metaForm.label }}
            </AppStatus>
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Prioritas (Eisenhower)
          </p>
          <div class="grid grid-cols-2 gap-2.5">
            <USwitch
              v-model="form.important"
              label="Penting"
            />
            <USwitch
              v-model="form.urgent"
              label="Mendesak"
            />
          </div>
        </div>
        <UButton
          v-if="form.id"
          label="Hapus task"
          color="error"
          variant="soft"
          block
          @click="hapusSheet = true"
        />
      </div>
      <template #footer>
        <UButton
          :label="form.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSheet"
      title="Hapus task?"
    >
      <p class="text-sm text-muted">
        Task ini akan dihapus permanen. Project dan bisnisnya tidak ikut terhapus.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
