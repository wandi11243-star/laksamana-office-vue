<!--
  Task Management › Timeline (old `vTimeline`, deploy/bd/index.html:2477-2493).
  The Gantt of every project: bars for dated work, diamonds for dateless
  deadlines, violet arrows for order. Filters narrow what is SHOWN; opening a
  project/task happens on the chart itself.
-->
<script setup lang="ts">
import type { BdTask } from '~/composables/useBd'
import { centangSub, useBdState } from '~/composables/useBd'
import {
  OWNER_DIVS, PILIHAN_SEMUA, cariAku, lingkupIds, pics, saringLingkup,
} from '~/utils/bd-rumus'
import type { GZoom } from '~/utils/bd-gantt'
import BdGantt from '~/widgets/bd/BdGantt.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const fPics = useState<string[]>('bd-fPics', () => [])
const f = useState('bd-timeline-filter', () => ({ st: 'aktif', div: PILIHAN_SEMUA, scope: 'tim', zoom: 'week' as GZoom }))

const people = computed(() => state.value.people)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (o: { pics?: string[], pic?: string }) => !fPics.value.length || pics(o).some(id => fPics.value.includes(id))

const daftar = computed(() => saringLingkup(projects.value, f.value.scope, lingkup.value, aku.value?.id)
  .filter(cocokPic)
  .filter(p => (f.value.st === 'semua' || p.stage !== 'Completed') && (f.value.div === PILIHAN_SEMUA || p.div === f.value.div))
  .slice()
  .sort((a, b) => {
    const x = a.start || a.end || '9999'
    const y = b.start || b.end || '9999'
    return x < y ? -1 : x > y ? 1 : 0
  }))

const skop = [
  { value: 'tim', label: 'Tim saya' },
  { value: 'saya', label: 'Ditugaskan ke saya' },
  { value: 'semua', label: 'Semua' },
]
const opsiDiv = [{ value: PILIHAN_SEMUA, label: 'Semua divisi' }, ...OWNER_DIVS.map(d => ({ value: d, label: d }))]
const resetAktif = computed(() => fPics.value.length || f.value.div !== PILIHAN_SEMUA || f.value.scope !== 'tim' || f.value.st !== 'aktif')
function reset() {
  fPics.value = []
  f.value = { ...f.value, div: PILIHAN_SEMUA, scope: 'tim', st: 'aktif' }
}

const gantt = ref<InstanceType<typeof BdGantt> | null>(null)
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
function bukaSheet(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function subToggle(t: BdTask, ix: number, on: boolean) {
  centangSub(t, ix, on)
}
</script>

<template>
  <AppPage
    title="Timeline"
    description="Gantt semua project — buka project untuk melihat task, sub-task & urutannya."
  >
    <template #actions>
      <AppSeg
        v-model="f.zoom"
        :options="[{ value: 'day', label: 'Hari' }, { value: 'week', label: 'Minggu' }, { value: 'month', label: 'Bulan' }]"
        size="sm"
      />
      <UButton
        label="Buka semua"
        color="neutral"
        variant="outline"
        size="sm"
        @click="gantt?.bukaSemua()"
      />
      <UButton
        label="Tutup semua"
        color="neutral"
        variant="outline"
        size="sm"
        @click="gantt?.tutupSemua()"
      />
      <UButton
        label="Ke hari ini"
        color="neutral"
        variant="outline"
        size="sm"
        @click="gantt?.keHariIni()"
      />
    </template>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Status">
          <USelect
            v-model="f.st"
            :items="[{ value: 'aktif', label: 'Aktif' }, { value: 'semua', label: 'Semua' }]"
            class="w-full"
          />
        </UFormField>
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
        <span class="text-xs text-muted">{{ daftar.length }} dari {{ projects.length }} project</span>
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

    <BdGantt
      ref="gantt"
      :projects="daftar"
      :tasks="state.tasks"
      :people="people"
      :zoom="f.zoom"
      @buka-project="navigateTo(`/bd/projects/${$event}`)"
      @buka-task="bukaSheet"
      @sub-toggle="subToggle"
    />

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="state.tasks"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
  </AppPage>
</template>
