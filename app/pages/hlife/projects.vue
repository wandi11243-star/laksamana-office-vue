<!--
  Project Center — the old viewProjects (howandi_life/index.html:637-652).
  Eight Kanban columns (Archive was merged into Done, F.5). The board scrolls
  sideways on a phone, where HTML5 drag-and-drop is unreliable, so every card
  also has a "Pindah stage" sheet. Dropping on Done sets progress to 100 (`:652`).
-->
<script setup lang="ts">
import type { HlifeBusiness, HlifeProject, HlifeTask } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { PRIORITIES, STAGES, fmtDue, persenProject, stageAktif } from '~/utils/hlife'
import { PILIHAN_TANPA } from '~/utils/bd-rumus'
import { ikonPrioritas, ikonStage, tonePrioritas, toneStage } from '~/utils/status-hlife'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()
const router = useRouter()

const { data: projData, status, refresh: refreshProyek } = useHlifeResource<HlifeProject>('projects')
const { data: tasksData } = useHlifeResource<HlifeTask>('tasks')
const { data: bizData } = useHlifeResource<HlifeBusiness>('businesses')

const proyek = computed(() => projData.value.rows)
const tugas = computed(() => tasksData.value.rows)
const bisnis = computed(() => bizData.value.rows)

const kolom = computed(() => STAGES.map(st => ({
  stage: st,
  items: proyek.value.filter(p => stageAktif(p) === st),
})))

const jmlTugas = (p: HlifeProject) => tugas.value.filter(t => t.project === p.id).length

// --- drag and drop (`:650-652`) ---------------------------------------------

let dragId = ''
let baruSajaDrag = false
const dropAktif = ref('')

function mulaiDrag(e: DragEvent, p: HlifeProject) {
  dragId = p.id
  baruSajaDrag = true
  e.dataTransfer?.setData('text/plain', p.id)
}

async function jatuhkan(stage: string) {
  dropAktif.value = ''
  const p = proyek.value.find(x => x.id === dragId)
  if (!p || stageAktif(p) === stage) return
  await gantiStage(p, stage)
}

async function gantiStage(p: HlifeProject, stage: string) {
  const versi = projData.value.versions[p.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi project belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  const body = { ...p, stage, progress: stage === 'Done' ? 100 : p.progress }
  try {
    await updateHlifeRecord('projects', p.id, body, versi)
    await refreshProyek()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshProyek))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

function bukaDetail(p: HlifeProject) {
  if (baruSajaDrag) return
  router.push(`/hlife/projects/${p.id}`)
}

// --- move-stage sheet (touch) ------------------------------------------------

const sheetPindah = ref(false)
const pindah = ref<HlifeProject | null>(null)
function bukaPindah(p: HlifeProject) {
  pindah.value = p
  sheetPindah.value = true
}
async function pilihStage(stage: string) {
  if (pindah.value) await gantiStage(pindah.value, stage)
  sheetPindah.value = false
}

// --- project sheet (`:875-884`) ---------------------------------------------

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

const opsiBisnis = computed(() => [
  { value: PILIHAN_TANPA, label: '—' },
  ...bisnis.value.map(b => ({ value: b.name, label: b.name })),
])
const opsiStage = STAGES.map(s => ({ value: s as string, label: s }))
const opsiPrioritas = PRIORITIES.map(p => ({ value: p as string, label: p }))

function buka(p?: HlifeProject) {
  Object.assign(form, p
    ? { id: p.id, name: p.name, desc: p.desc || '', biz: p.biz || PILIHAN_TANPA, priority: p.priority || 'Med', pic: p.pic || '', team: p.team || '', stage: stageAktif(p), due: p.due || '', progress: p.progress || 0 }
    : { id: '', name: '', desc: '', biz: PILIHAN_TANPA, priority: 'Med', pic: '', team: '', stage: 'Idea', due: '', progress: 0 })
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
  const body = {
    name,
    desc: form.desc,
    biz: form.biz === PILIHAN_TANPA ? '' : form.biz,
    priority: form.priority,
    pic: form.pic,
    team: form.team,
    stage: form.stage,
    due: form.due,
    progress: Number(form.progress) || 0,
  }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = projData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi project belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('projects', form.id, { ...body, id: form.id }, versi)
      toast.add({ title: 'Project diperbarui.', color: 'success' })
    }
    else {
      await createHlifeRecord<HlifeProject>('projects', body)
      toast.add({ title: 'Project ditambahkan.', color: 'success' })
    }
    await refreshProyek()
    sheet.value = false
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapus() {
  if (!form.id) return
  const versi = projData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi project belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeProject(form.id, versi)
    await refreshProyek()
    sheet.value = false
    toast.add({ title: 'Project dihapus. Task tidak ikut terhapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

/**
 * Deleting a project detaches its tasks in the old client (`:885`). v1 has no
 * bulk endpoint, so the project is deleted and its tasks are unlinked one by
 * one, each with its own version.
 */
async function deleteHlifeProject(id: string, versi: Parameters<typeof deleteHlifeRecord>[2]) {
  const terkait = tugas.value.filter(t => t.project === id)
  await deleteHlifeRecord('projects', id, versi)
  for (const t of terkait) {
    const v = tasksData.value.versions[t.id]
    if (v !== undefined) await updateHlifeRecord('tasks', t.id, { ...t, project: '' }, v)
  }
}

const hari = hariIni()
const lewat = (p: HlifeProject) => !!p.due && p.due < hari && stageAktif(p) !== 'Done'
</script>

<template>
  <NuxtPage v-if="$route.params.id" />
  <AppPage
    v-else
    title="Project Center"
    description="Klik project untuk lihat detail & task-nya. Drag kartu antar kolom, atau pakai tombol pindah stage di HP."
  >
    <template #actions>
      <UButton
        label="Project"
        icon="i-lucide-plus"
        @click="buka()"
      />
    </template>

    <p
      v-if="status === 'pending' && !proyek.length"
      class="mb-4 text-sm text-muted"
    >
      Memuat project…
    </p>

    <div class="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
      <div class="flex min-w-max gap-3">
        <section
          v-for="k in kolom"
          :key="k.stage"
          class="w-64 shrink-0"
          @dragover.prevent="dropAktif = k.stage"
          @dragleave="dropAktif = ''"
          @drop.prevent="jatuhkan(k.stage)"
        >
          <div
            class="mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
            :class="dropAktif === k.stage ? 'border-primary-400 bg-primary-100' : 'border-default bg-muted'"
          >
            <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-highlighted">
              <AppStatus
                size="sm"
                :color="toneStage(k.stage)"
                :icon="ikonStage(k.stage)"
              >
                {{ k.stage }}
              </AppStatus>
            </span>
            <span class="rounded-full bg-table-head px-2 py-0.5 text-xs font-bold text-table-head-text num">{{ k.items.length }}</span>
          </div>

          <div class="space-y-2">
            <article
              v-for="p in k.items"
              :key="p.id"
              class="cursor-pointer rounded-lg border border-default bg-default p-3 shadow-panel transition-colors hover:border-accented"
              draggable="true"
              @dragstart="mulaiDrag($event, p)"
              @dragend="baruSajaDrag = false"
              @click="bukaDetail(p)"
            >
              <div class="flex items-start justify-between gap-2">
                <h3 class="min-w-0 flex-1 font-semibold text-highlighted">
                  {{ p.name }}
                </h3>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="mt-0.5 size-4 shrink-0 text-dimmed"
                />
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <AppStatus
                  v-if="p.biz"
                  size="sm"
                  color="gold"
                  icon="i-lucide-building-2"
                >
                  {{ p.biz }}
                </AppStatus>
                <AppStatus
                  v-if="p.priority"
                  size="sm"
                  :color="tonePrioritas(p.priority)"
                  :icon="ikonPrioritas(p.priority)"
                >
                  {{ p.priority }}
                </AppStatus>
                <AppStatus
                  v-if="p.due"
                  size="sm"
                  :color="lewat(p) ? 'error' : 'info'"
                  :icon="lewat(p) ? 'i-lucide-alarm-clock' : 'i-lucide-calendar'"
                >
                  {{ fmtDue(p.due) }}
                </AppStatus>
                <AppStatus
                  v-if="jmlTugas(p)"
                  size="sm"
                  color="vip"
                  icon="i-lucide-list-checks"
                >
                  {{ jmlTugas(p) }} task
                </AppStatus>
              </div>
              <p
                v-if="p.pic"
                class="mt-2 text-xs text-muted"
              >
                PIC {{ p.pic }}
              </p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary-400"
                  :style="{ width: `${persenProject(p, tugas)}%` }"
                />
              </div>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-muted num">{{ persenProject(p, tugas) }}%</span>
                <UButton
                  label="Pindah stage"
                  icon="i-lucide-move-right"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click.stop="bukaPindah(p)"
                />
              </div>
            </article>
            <p
              v-if="!k.items.length"
              class="rounded-field border border-dashed border-default px-3 py-4 text-center text-xs text-dimmed"
            >
              —
            </p>
          </div>
        </section>
      </div>
    </div>

    <!-- Move-stage sheet for touch -->
    <ResponsiveSheet
      v-model:open="sheetPindah"
      :title="pindah ? `Pindah: ${pindah.name}` : 'Pindah stage'"
      description="Pilih kolom baru untuk project ini."
    >
      <div class="grid gap-2">
        <UButton
          v-for="s in STAGES"
          :key="s"
          :label="s"
          :icon="ikonStage(s)"
          :color="pindah && stageAktif(pindah) === s ? 'primary' : 'neutral'"
          :variant="pindah && stageAktif(pindah) === s ? 'soft' : 'outline'"
          block
          class="justify-start"
          @click="pilihStage(s)"
        />
      </div>
    </ResponsiveSheet>

    <!-- Project form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit project' : 'Project baru'"
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
            placeholder="Tujuan & konteks project…"
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
          <UFormField label="PIC (penanggung jawab)">
            <UInput
              v-model="form.pic"
              placeholder="Saya / nama"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tim terlibat">
            <UInput
              v-model="form.team"
              placeholder="Ops, marketing…"
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
        <UFormField :label="`Progress manual: ${form.progress}% (otomatis dari task jika ada)`">
          <input
            v-model.number="form.progress"
            type="range"
            min="0"
            max="100"
            class="w-full accent-primary-600"
          >
        </UFormField>
        <UButton
          v-if="form.id"
          label="Hapus project"
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
      title="Hapus project?"
      description="Task & project yang terhubung tidak ikut terhapus; task-nya hanya dilepas dari project ini."
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
