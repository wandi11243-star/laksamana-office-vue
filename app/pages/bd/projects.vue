<!--
  BD OS › Projects (old `vProjects`, deploy/bd/index.html:1891-1946).

  A kanban of the five stages. Moving a card to Completed closes all its tasks,
  ONLY on that change; the filter narrows what is SHOWN, never what may be moved.
  On a phone the board scrolls sideways and each card has a "Pindah stage" sheet.
-->
<script setup lang="ts">
import type { BdProject } from '~/composables/useBd'
import { bdSimpan, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import { OWNER_DIVS, PROJ_STAGES, cariAku, lingkupIds, pics, saringLingkup, tasksPerluDitutup } from '~/utils/bd-rumus'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdProjCard from '~/widgets/bd/BdProjCard.vue'
import BdProjectSheet from '~/widgets/bd/BdProjectSheet.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const fPics = useState<string[]>('bd-fPics', () => [])
const f = useState('bd-proj-filter', () => ({ scope: 'tim', div: '' }))

const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (o: { pics?: string[], pic?: string }) => !fPics.value.length || pics(o).some(id => fPics.value.includes(id))

const base = computed(() => saringLingkup(state.value.projects, f.value.scope, lingkup.value, aku.value?.id)
  .filter(cocokPic)
  .filter(p => !f.value.div || p.div === f.value.div))
const diStage = (st: string) => base.value.filter(p => p.stage === st)

const skop = [
  { value: 'tim', label: 'Tim saya' },
  { value: 'saya', label: 'Ditugaskan ke saya' },
  { value: 'semua', label: 'Semua' },
]
const opsiDiv = [{ value: '', label: 'Semua divisi' }, ...OWNER_DIVS.map(d => ({ value: d, label: d }))]
const resetAktif = computed(() => fPics.value.length || f.value.div || f.value.scope !== 'tim')
function reset() {
  fPics.value = []
  f.value = { ...f.value, div: '', scope: 'tim' }
}

// ---- move stage ----
async function pindahStage(p: BdProject, st: string) {
  const dulu = p.stage
  if (st === dulu) return
  const ikut = (st === 'Completed' && dulu !== 'Completed') ? tasksPerluDitutup(state.value.tasks, p.id) : []
  const aksi = async () => {
    await tambalBd<BdProject>('projects', p.id, { stage: st }, versiBaris(p))
    for (const t of ikut) await tambalBd('tasks', t.id, { status: 'Done', progress: 100 }, versiBaris(t))
  }
  await bdSimpan(aksi, `Project dipindah ke ${st}` + (ikut.length ? ` — ${ikut.length} task ikut jadi Done` : ''))
}

let dragId: string | null = null
function dragMulai(e: DragEvent, p: BdProject) {
  dragId = p.id
  e.dataTransfer?.setData('text/plain', p.id)
}
function dropStage(st: string) {
  const p = state.value.projects.find(x => x.id === dragId)
  dragId = null
  if (p) pindahStage(p, st)
}

const stageSheet = ref(false)
const stagePilih = ref<BdProject | null>(null)
const stageBaru = ref('Idea')
function bukaStage(p: BdProject) {
  stagePilih.value = p
  stageBaru.value = p.stage
  stageSheet.value = true
}
async function simpanStage() {
  const p = stagePilih.value
  if (!p) return
  await pindahStage(p, stageBaru.value)
  stageSheet.value = false
}

// ---- sheet ----
const bukaProject = ref(false)
const projPilih = ref<BdProject | null>(null)
function baru() {
  projPilih.value = null
  bukaProject.value = true
}
function buka(p: BdProject) {
  navigateTo(`/bd/projects/${p.id}`)
}
</script>

<template>
  <AppPage
    title="Projects"
    description="Pekerjaan besar berjangka + milestone."
  >
    <template #actions>
      <UButton
        label="Project"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Lingkup">
          <USelect
            v-model="f.scope"
            :items="skop"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <BdPicFilter
          v-model="fPics"
          :people="people"
        />
        <div class="flex-1" />
        <span class="text-xs text-muted">{{ base.length }} dari {{ state.projects.length }} project</span>
        <UButton
          v-if="resetAktif"
          label="Reset"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          size="sm"
          @click="reset"
        />
      </div>
    </AppPanel>

    <div class="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
      <section
        v-for="st in PROJ_STAGES"
        :key="st"
        class="min-w-0 rounded-panel border border-default bg-muted/40"
        @dragover.prevent
        @drop="dropStage(st)"
      >
        <header class="flex items-center justify-between border-b border-default px-3 py-2">
          <span class="text-sm font-bold text-highlighted">{{ st }}</span>
          <span class="rounded-full bg-table-head px-2 py-0.5 text-xs font-bold text-table-head-text num">{{ diStage(st).length }}</span>
        </header>
        <div class="grid gap-2 p-2">
          <div
            v-for="p in diStage(st)"
            :key="p.id"
            draggable="true"
            @dragstart="dragMulai($event, p)"
          >
            <BdProjCard
              :project="p"
              :tasks="state.tasks"
              :people="people"
              @buka="buka(p)"
              @pindah="bukaStage(p)"
            />
          </div>
        </div>
      </section>
    </div>

    <AppPanel
      v-if="!base.length && state.projects.length"
      class="mt-4"
    >
      <p class="py-4 text-center text-sm text-muted">
        <b class="block text-highlighted">Tidak ada project pada penyaring ini</b>
        Ada {{ state.projects.length }} project di papan — coba ubah lingkupnya jadi "Semua".
      </p>
    </AppPanel>

    <BdProjectSheet
      v-model:open="bukaProject"
      :project="projPilih"
      :projects="state.projects"
      :tasks="state.tasks"
      :po="state.po"
      :coord="state.coord"
      :people="people"
      :aku="aku"
    />

    <ResponsiveSheet
      v-model:open="stageSheet"
      title="Pindah stage"
      :description="stagePilih?.name"
    >
      <UFormField label="Stage">
        <USelect
          v-model="stageBaru"
          :items="PROJ_STAGES"
          class="w-full"
        />
      </UFormField>
      <p class="mt-3 text-xs text-muted">
        Memindahkan ke <b>Completed</b> menutup semua task project ini (status Done, progress 100).
      </p>
      <template #footer>
        <UButton
          label="Simpan"
          @click="simpanStage"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="stageSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
