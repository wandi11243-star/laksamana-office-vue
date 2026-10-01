<!--
  Project detail (hidden, opens from a card) — the old viewProjectDetail
  (howandi_life/index.html:654-665). PIC/Tim/Task selesai, progress automatic
  from the project's tasks, deadline with a Google Calendar link, and the task
  list of this project. New tasks open the Tasks screen prefilled (F.6).
-->
<script setup lang="ts">
import type { HlifeBusiness, HlifeProject, HlifeTask } from '~/composables/useHlife'
import {
  deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { PRIORITIES, STAGES, fmtDue, persenProject, stageAktif, tautanGcal } from '~/utils/hlife'
import { ikonStage, lencanaTugas } from '~/utils/status-hlife'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const route = useRoute()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))

const { data: projData, status, refresh: refreshProyek } = useHlifeResource<HlifeProject>('projects')
const { data: tasksData, refresh: refreshTasks } = useHlifeResource<HlifeTask>('tasks')
const { data: bizData } = useHlifeResource<HlifeBusiness>('businesses')

const proyek = computed(() => projData.value.rows.find(p => p.id === id.value) ?? null)
const semuaTugas = computed(() => tasksData.value.rows)
const tugas = computed(() => semuaTugas.value.filter(t => t.project === id.value))
const bisnis = computed(() => bizData.value.rows)
const selesai = computed(() => tugas.value.filter(t => t.done).length)

const progress = computed(() => (proyek.value ? persenProject(proyek.value, semuaTugas.value) : 0))
const hari = hariIni()

// --- edit project (`:875-885`) ----------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({
  id: '',
  name: '',
  desc: '',
  biz: '',
  priority: 'Med' as string,
  pic: '',
  team: '',
  stage: 'Idea' as string,
  due: '',
  progress: 0,
})

const opsiBisnis = computed(() => [{ value: '', label: '—' }, ...bisnis.value.map(b => ({ value: b.name, label: b.name }))])
const opsiStage = STAGES.map(s => ({ value: s as string, label: s }))
const opsiPrioritas = PRIORITIES.map(p => ({ value: p as string, label: p }))

function bukaEdit() {
  const p = proyek.value
  if (!p) return
  Object.assign(form, { id: p.id, name: p.name, desc: p.desc || '', biz: p.biz || '', priority: p.priority || 'Med', pic: p.pic || '', team: p.team || '', stage: stageAktif(p), due: p.due || '', progress: p.progress || 0 })
  sheet.value = true
}

function muatUlang() {
  return refreshProyek()
}

async function simpan() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ title: 'Nama wajib diisi.', color: 'error' })
    return
  }
  const versi = projData.value.versions[form.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi project belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await updateHlifeRecord('projects', form.id, {
      id: form.id,
      name,
      desc: form.desc,
      biz: form.biz,
      priority: form.priority,
      pic: form.pic,
      team: form.team,
      stage: form.stage,
      due: form.due,
      progress: Number(form.progress) || 0,
    }, versi)
    await refreshProyek()
    sheet.value = false
    toast.add({ title: 'Project diperbarui.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapusProject() {
  const p = proyek.value
  if (!p) return
  const versi = projData.value.versions[p.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi project belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('projects', p.id, versi)
    for (const t of tugas.value) {
      const v = tasksData.value.versions[t.id]
      if (v !== undefined) await updateHlifeRecord('tasks', t.id, { ...t, project: '' }, v)
    }
    await navigateTo('/hlife/projects')
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
    if (!(await tanganiKonflik(e, refreshTasks))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const hapusTaskSheet = ref(false)
const taskHapus = ref<HlifeTask | null>(null)
function tanyaHapusTask(t: HlifeTask) {
  taskHapus.value = t
  hapusTaskSheet.value = true
}
async function hapusTask() {
  const t = taskHapus.value
  hapusTaskSheet.value = false
  if (!t) return
  const versi = tasksData.value.versions[t.id]
  if (versi === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('tasks', t.id, versi)
    await refreshTasks()
    toast.add({ title: 'Task dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTasks))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    :title="proyek?.name ?? 'Project'"
    :back="{ label: 'Semua project', to: '/hlife/projects' }"
  >
    <p
      v-if="status === 'pending' && !proyek"
      class="text-sm text-muted"
    >
      Memuat project…
    </p>
    <div
      v-else-if="!proyek"
      class="rounded-panel border border-default bg-default p-6 text-center text-muted shadow-panel"
    >
      Project tidak ditemukan. Mungkin sudah dihapus.
    </div>

    <template v-else>
      <p class="-mt-3 mb-4 text-sm text-muted">
        {{ proyek.biz || '—' }} · Stage {{ stageAktif(proyek) }} · {{ proyek.priority }} priority{{ proyek.due ? ` · ${fmtDue(proyek.due)}` : '' }}
      </p>

      <div class="grid gap-5 lg:grid-cols-3">
        <AppPanel class="lg:col-span-2">
          <p
            v-if="proyek.desc"
            class="mb-4 whitespace-pre-line text-sm text-muted"
          >
            {{ proyek.desc }}
          </p>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
                PIC
              </p>
              <p class="font-semibold text-highlighted">
                {{ proyek.pic || '—' }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
                Tim
              </p>
              <p class="font-semibold text-highlighted">
                {{ proyek.team || '—' }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
                Task selesai
              </p>
              <p class="font-semibold text-highlighted num">
                {{ selesai }}/{{ tugas.length }}
              </p>
            </div>
          </div>
          <div class="mt-4 flex items-baseline justify-between text-sm">
            <span class="text-muted">Progress {{ tugas.length ? '(otomatis dari task)' : '(manual)' }}</span>
            <b class="text-primary-700 num">{{ progress }}%</b>
          </div>
          <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary-400"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </AppPanel>

        <AppPanel icon="i-lucide-calendar-clock">
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            Deadline
          </p>
          <p class="font-display text-xl font-semibold text-highlighted">
            {{ proyek.due ? new Date(`${proyek.due}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}
          </p>
          <UButton
            v-if="proyek.due"
            :to="tautanGcal(proyek.name, proyek.due, undefined, undefined, 'Project deadline')"
            target="_blank"
            rel="noopener"
            label="+ Google Calendar"
            icon="i-lucide-calendar-plus"
            color="neutral"
            variant="soft"
            class="mt-3"
          />
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              label="Edit"
              icon="i-lucide-pencil"
              color="neutral"
              variant="soft"
              @click="bukaEdit"
            />
            <UButton
              label="Task ke project ini"
              icon="i-lucide-plus"
              :to="{ path: '/hlife/tasks', query: { new: '1', project: proyek.id, biz: proyek.biz } }"
            />
          </div>
          <p
            v-if="proyek.due && proyek.due < hari && stageAktif(proyek) !== 'Done'"
            class="mt-3"
          >
            <AppStatus
              color="error"
              icon="i-lucide-alarm-clock"
            >
              {{ fmtDue(proyek.due) }}
            </AppStatus>
          </p>
        </AppPanel>

        <AppPanel
          title="Task di project ini"
          :icon="ikonStage(stageAktif(proyek))"
          :count="tugas.length"
          class="lg:col-span-3"
        >
          <div
            v-if="tugas.length"
            class="divide-y divide-default"
          >
            <div
              v-for="t in tugas"
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
                <div class="mt-1 flex flex-wrap gap-1">
                  <AppStatus
                    v-for="l in lencanaTugas(t, { hideProject: true, projects: projData.rows })"
                    :key="l.label"
                    size="sm"
                    :color="l.color"
                    :icon="l.icon"
                  >
                    {{ l.label }}
                  </AppStatus>
                </div>
              </div>
              <div class="flex shrink-0 gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Ubah task"
                  :to="{ path: '/hlife/tasks', query: { edit: t.id } }"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Hapus task"
                  @click="tanyaHapusTask(t)"
                />
              </div>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            <b class="text-highlighted">Belum ada task.</b> Tambahkan task pertama untuk project ini.
          </p>
        </AppPanel>
      </div>

      <!-- Edit project -->
      <ResponsiveSheet
        v-model:open="sheet"
        title="Edit project"
      >
        <div class="space-y-4">
          <UFormField
            label="Nama project"
            required
          >
            <UInput
              v-model="form.name"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Deskripsi singkat">
            <UTextarea
              v-model="form.desc"
              :rows="2"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Bisnis">
              <USelect
                v-model="form.biz"
                :items="opsiBisnis"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Prioritas">
              <USelect
                v-model="form.priority"
                :items="opsiPrioritas"
                size="xl"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="PIC">
              <UInput
                v-model="form.pic"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Tim terlibat">
              <UInput
                v-model="form.team"
                size="xl"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Stage">
              <USelect
                v-model="form.stage"
                :items="opsiStage"
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
          <UFormField :label="`Progress manual: ${form.progress}%`">
            <input
              v-model.number="form.progress"
              type="range"
              min="0"
              max="100"
              class="w-full accent-primary-600"
            >
          </UFormField>
          <UButton
            label="Hapus project"
            color="error"
            variant="soft"
            block
            @click="hapusSheet = true"
          />
        </div>
        <template #footer>
          <UButton
            label="Simpan"
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
        title="Hapus project?"
        description="Task tidak ikut terhapus; task-nya hanya dilepas dari project ini."
      >
        <p class="text-sm text-muted">
          Lanjutkan menghapus project ini? Tindakan ini tidak bisa dibatalkan.
        </p>
        <template #footer>
          <UButton
            label="Hapus"
            color="error"
            size="xl"
            :loading="sibuk"
            @click="hapusProject"
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

      <ResponsiveSheet
        v-model:open="hapusTaskSheet"
        title="Hapus task?"
        :description="taskHapus?.name"
      >
        <p class="text-sm text-muted">
          Task ini akan dihapus permanen.
        </p>
        <template #footer>
          <UButton
            label="Hapus"
            color="error"
            size="xl"
            :loading="sibuk"
            @click="hapusTask"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="hapusTaskSheet = false"
          />
        </template>
      </ResponsiveSheet>
    </template>
  </AppPage>
</template>
