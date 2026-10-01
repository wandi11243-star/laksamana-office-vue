<!--
  Business detail (hidden, opens from a card) — the old viewBizDetail
  (howandi_life/index.html:798-808). Description, average revenue, its projects
  with progress, and its active tasks.
-->
<script setup lang="ts">
import type { HlifeBusiness, HlifeProject, HlifeTask } from '~/composables/useHlife'
import {
  deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { BIZ_AREAS, persenProject, stageAktif } from '~/utils/hlife'
import { lencanaTugas } from '~/utils/status-hlife'
import { rupiah } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const route = useRoute()
const toast = useToast()
const tahun = new Date().getFullYear()

const id = computed(() => String(route.params.id ?? ''))

const { data: bizData, status, refresh: refreshBiz } = useHlifeResource<HlifeBusiness>('businesses')
const { data: taskData, refresh: refreshTasks } = useHlifeResource<HlifeTask>('tasks')
const { data: projData } = useHlifeResource<HlifeProject>('projects')

const bisnis = computed(() => bizData.value.rows.find(b => b.id === id.value) ?? null)
const semuaTugas = computed(() => taskData.value.rows)
const proyek = computed(() => projData.value.rows.filter(p => bisnis.value && p.biz === bisnis.value.name))
const tugas = computed(() => semuaTugas.value.filter(t => bisnis.value && t.biz === bisnis.value.name && !t.done))

const opsiArea = BIZ_AREAS.map(a => ({ value: a as string, label: a }))
const umur = computed(() => (bisnis.value?.founded ? tahun - Number(bisnis.value.founded) + 1 : 0))

// --- edit (`:946-949`) ------------------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({ id: '', name: '', field: '', founded: '', desc: '', revenue: 0, area: 'Business' })

function muatUlang() {
  return refreshBiz()
}

function bukaEdit() {
  const b = bisnis.value
  if (!b) return
  Object.assign(form, { id: b.id, name: b.name, field: b.field || '', founded: b.founded ? String(b.founded) : '', desc: b.desc || '', revenue: b.revenue || 0, area: b.area || 'Business' })
  sheet.value = true
}

async function simpan() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ title: 'Nama wajib diisi.', color: 'error' })
    return
  }
  const versi = bizData.value.versions[form.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi bisnis belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await updateHlifeRecord('businesses', form.id, {
      id: form.id,
      name,
      field: form.field,
      founded: Number(form.founded) || '',
      desc: form.desc,
      revenue: Number(form.revenue) || 0,
      area: form.area,
    }, versi)
    await refreshBiz()
    sheet.value = false
    toast.add({ title: 'Bisnis tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapusBisnis() {
  const b = bisnis.value
  if (!b) return
  const versi = bizData.value.versions[b.id]
  hapusSheet.value = false
  if (versi === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('businesses', b.id, versi)
    await navigateTo('/hlife/business')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function toggle(t: HlifeTask) {
  const versi = taskData.value.versions[t.id]
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
  const versi = taskData.value.versions[t.id]
  if (versi === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('tasks', t.id, versi)
    await refreshTasks()
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
    :title="bisnis?.name ?? 'Bisnis'"
    :back="{ label: 'Semua bisnis', to: '/hlife/business' }"
  >
    <p
      v-if="status === 'pending' && !bisnis"
      class="text-sm text-muted"
    >
      Memuat bisnis…
    </p>
    <div
      v-else-if="!bisnis"
      class="rounded-panel border border-default bg-default p-6 text-center text-muted shadow-panel"
    >
      Bisnis tidak ditemukan. Mungkin sudah dihapus.
    </div>

    <template v-else>
      <p class="-mt-3 mb-4 text-sm text-muted">
        {{ bisnis.field || bisnis.area }}{{ bisnis.founded ? ` · berdiri ${bisnis.founded}${umur ? ` (${umur} thn)` : ''}` : '' }}
      </p>

      <div class="grid gap-5 lg:grid-cols-3">
        <AppPanel class="lg:col-span-2">
          <p
            v-if="bisnis.desc"
            class="whitespace-pre-line text-sm text-muted"
          >
            {{ bisnis.desc }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            Belum ada deskripsi. Klik Edit untuk menambah.
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              label="Edit bisnis"
              icon="i-lucide-pencil"
              color="neutral"
              variant="soft"
              @click="bukaEdit"
            />
            <UButton
              label="Hapus"
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              @click="hapusSheet = true"
            />
          </div>
        </AppPanel>

        <AppPanel icon="i-lucide-trending-up">
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            Avg revenue / tahun
          </p>
          <p class="font-display text-xl font-bold text-primary-700 num">
            {{ rupiah(bisnis.revenue || 0) }}
          </p>
          <p class="mt-1 text-xs text-muted">
            rata-rata sejak berdiri
          </p>
        </AppPanel>

        <AppPanel
          title="Project"
          icon="i-lucide-kanban"
          :count="proyek.length"
        >
          <div
            v-if="proyek.length"
            class="divide-y divide-default"
          >
            <NuxtLink
              v-for="p in proyek"
              :key="p.id"
              :to="`/hlife/projects/${p.id}`"
              class="flex items-center gap-3 py-2.5 hover:bg-elevated/60"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-highlighted">
                  {{ p.name }}
                </p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <AppStatus
                    size="sm"
                    :color="stageAktif(p) === 'Done' ? 'success' : 'info'"
                    icon="i-lucide-circle"
                  >
                    {{ stageAktif(p) }}
                  </AppStatus>
                  <AppStatus
                    size="sm"
                    color="vip"
                    icon="i-lucide-trending-up"
                  >
                    {{ persenProject(p, semuaTugas) }}%
                  </AppStatus>
                </div>
              </div>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-dimmed"
              />
            </NuxtLink>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Belum ada project.
          </p>
        </AppPanel>

        <AppPanel
          title="Task aktif"
          icon="i-lucide-list-checks"
          :count="tugas.length"
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
                <div class="mt-1 flex flex-wrap gap-1">
                  <AppStatus
                    v-for="l in lencanaTugas(t, { hideProject: true, projects: projData.rows }).slice(0, 3)"
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
            Tidak ada task aktif.
          </p>
        </AppPanel>
      </div>

      <!-- Edit form -->
      <ResponsiveSheet
        v-model:open="sheet"
        title="Edit bisnis"
      >
        <div class="space-y-4">
          <UFormField
            label="Nama bisnis"
            required
          >
            <UInput
              v-model="form.name"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Bidang / bergerak di">
              <UInput
                v-model="form.field"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Tahun berdiri">
              <UInput
                v-model="form.founded"
                type="number"
                size="xl"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Deskripsi singkat">
            <UTextarea
              v-model="form.desc"
              :rows="3"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Avg revenue / tahun (Rp)">
              <UInput
                v-model.number="form.revenue"
                type="number"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Life area">
              <USelect
                v-model="form.area"
                :items="opsiArea"
                size="xl"
                class="w-full"
              />
            </UFormField>
          </div>
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
        title="Hapus bisnis?"
        :description="bisnis.name"
      >
        <p class="text-sm text-muted">
          Task & project yang terhubung tidak ikut terhapus.
        </p>
        <template #footer>
          <UButton
            label="Hapus"
            color="error"
            size="xl"
            :loading="sibuk"
            @click="hapusBisnis"
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
