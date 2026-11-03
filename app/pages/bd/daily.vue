<!--
  BD › Daily Task (old `vDaily`, deploy/bd/index.html:2889-3008). The "fixed
  project": one board for recurring daily work, with the same List / Kanban /
  Timeline modes as a project detail. A task belongs here via `daily:true` —
  never inside a project at the same time. Recurring tasks (`ulang`) birth
  their successor the moment they are marked Done.
-->
<script setup lang="ts">
import type { BdTask } from '~/composables/useBd'
import { centangSub, hapusTaskDenganUrutan, pesanHapusTask, toggleTask, useBdState } from '~/composables/useBd'
import {
  cariAku, lewat, lingkupIds, pelaksana, saringArsip, saringLingkup, selesai, todayISO, urutDeadline,
  type ModeArsip,
} from '~/utils/bd-rumus'
import type { GZoom } from '~/utils/bd-gantt'
import BdGantt from '~/widgets/bd/BdGantt.vue'
import BdKanban from '~/widgets/bd/BdKanban.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import BdTaskTree from '~/widgets/bd/BdTaskTree.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, status } = useBdState()

/** First-load skeleton for the four recap cards below: skeleton cells stand
 *  in until the first state lands. Refetch keeps old numbers, so filter
 *  changes never blank the cards. */
const statMemuat = computed(() => !state.value.tasks.length && (status.value === 'pending' || status.value === 'idle'))
const f = useState('bd-daily', () => ({ mode: 'list' as 'list' | 'kanban' | 'timeline', arsip: 'aktif' as ModeArsip, zoom: 'week' as GZoom }))
const fPics = useState<string[]>('bd-daily-pics', () => [])

const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (t: BdTask) => !fPics.value.length || pelaksana(t).some(id => fPics.value.includes(id))

/** Daily board: every daily task is visible (`dailyTasks`); the PIC filter only narrows what is shown. */
const harian = computed(() => saringLingkup(state.value.tasks, 'semua', lingkup.value, aku.value?.id).filter(t => t.daily).filter(cocokPic))
const buka = computed(() => harian.value.filter(t => !selesai(t)).slice().sort(urutDeadline))
const hariIni = computed(() => todayISO())
const iniHari = computed(() => buka.value.filter(t => t.deadline === hariIni.value))
const telat = computed(() => buka.value.filter(lewat))
const berulang = computed(() => buka.value.filter(t => t.ulang))
const selesaiHariIni = computed(() => harian.value.filter(t => selesai(t) && t.doneAt === hariIni.value))

const grup = computed(() => [
  { judul: 'Lewat deadline', items: buka.value.filter(lewat) },
  { judul: 'Hari ini', items: iniHari.value },
  { judul: 'Mendatang', items: buka.value.filter(t => !lewat(t) && t.deadline && t.deadline > hariIni.value) },
  { judul: 'Tanpa deadline', items: buka.value.filter(t => !lewat(t) && !t.deadline) },
])
const daftar = computed(() => (f.value.arsip === 'aktif' ? buka.value : saringArsip(harian.value, f.value.arsip).slice().sort(urutDeadline)))
const grupProyek = computed(() => [{ id: '__daily__', name: 'Daily Task' }])
const tugasGantt = computed(() => daftar.value.map(t => ({ ...t, project: '__daily__' })))

const nAktif = computed(() => harian.value.filter(t => !selesai(t)).length)
const nArsip = computed(() => harian.value.length - nAktif.value)

// ---- sheets & row actions ----
const gantt = ref<InstanceType<typeof BdGantt> | null>(null)
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
const taskHapus = ref<BdTask | null>(null)
const hapusMau = computed({
  get: () => !!taskHapus.value,
  set: (v) => {
    if (!v) taskHapus.value = null
  },
})
const pesanHapus = computed(() => (taskHapus.value ? pesanHapusTask(taskHapus.value, state.value.tasks) : ''))

function baru() {
  taskPilih.value = null
  bukaTask.value = true
}
function bukaSheet(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function toggle(t: BdTask) {
  toggleTask(t, state.value.tasks)
}
async function hapus() {
  const t = taskHapus.value
  if (!t) return
  taskHapus.value = null
  await hapusTaskDenganUrutan(t, state.value.tasks)
}
function subToggle(t: BdTask, ix: number, on: boolean) {
  centangSub(t, ix, on)
}
</script>

<template>
  <AppPage
    title="Daily Task"
    description="Pekerjaan harian tim — bisa berulang otomatis (harian, hari kerja, mingguan, bulanan)."
  >
    <template #actions>
      <AppSeg
        v-model="f.mode"
        :options="[{ value: 'list', label: 'List' }, { value: 'kanban', label: 'Kanban' }, { value: 'timeline', label: 'Timeline' }]"
        size="sm"
      />
      <UButton
        label="Task"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>

    <AppStatGrid
      :loading="statMemuat"
      :count="4"
    >
      <AppStat
        label="Hari ini"
        icon="i-lucide-calendar-check"
        :value="String(iniHari.length)"
        sub="deadline hari ini"
      />
      <AppStat
        label="Lewat deadline"
        icon="i-lucide-triangle-alert"
        :value="String(telat.length)"
        :sub="telat.length ? 'perlu ditindak' : 'aman'"
        :tone="telat.length ? 'error' : 'success'"
      />
      <AppStat
        label="Berulang"
        icon="i-lucide-repeat"
        :value="String(berulang.length)"
        sub="otomatis lahir lagi saat Done"
        tone="info"
      />
      <AppStat
        label="Selesai hari ini"
        icon="i-lucide-circle-check"
        :value="String(selesaiHariIni.length)"
        sub=""
      />
    </AppStatGrid>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-2">
        <BdPicFilter
          v-model="fPics"
          :people="people"
          label="Assign"
        />
        <div class="flex-1" />
        <AppSeg
          v-model="f.arsip"
          :options="[{ value: 'aktif', label: `Aktif (${nAktif})` }, { value: 'arsip', label: `Arsip (${nArsip})` }, { value: 'semua', label: `Semua (${harian.length})` }]"
          size="sm"
        />
      </div>
    </AppPanel>

    <template v-if="f.mode === 'kanban'">
      <BdKanban
        :tasks="daftar"
        :semua="state.tasks"
        :people="people"
        :arsip="f.arsip"
        daily-default
        :pic-default="aku?.id"
        :div-default="aku?.div"
        @buka="bukaSheet"
        @sub-toggle="subToggle"
      />
      <p
        v-if="!daftar.length"
        class="py-6 text-center text-sm text-muted"
      >
        <b class="block text-highlighted">Belum ada Daily Task</b>
        Tambahkan lewat tombol Task. Pilih "Berulang" supaya task berikutnya lahir sendiri setiap kali yang ini Done.
      </p>
    </template>

    <template v-else-if="f.mode === 'timeline'">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="f.zoom"
          :options="[{ value: 'day', label: 'Hari' }, { value: 'week', label: 'Minggu' }, { value: 'month', label: 'Bulan' }]"
          size="sm"
        />
        <div class="flex-1" />
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
      </div>
      <BdGantt
        ref="gantt"
        :projects="grupProyek as never"
        :tasks="tugasGantt"
        :people="people"
        scoped
        :zoom="f.zoom"
        @buka-task="bukaSheet"
        @sub-toggle="subToggle"
      />
    </template>

    <template v-else>
      <template v-if="f.arsip === 'aktif'">
        <template
          v-for="g in grup"
          :key="g.judul"
        >
          <AppPanel
            v-if="g.items.length"
            :title="g.judul"
            :count="g.items.length"
            class="mb-5"
            flush
          >
            <BdTaskTree
              :tasks="g.items"
              :semua="state.tasks"
              :people="people"
              @buka="bukaSheet"
              @toggle="toggle"
              @hapus="taskHapus = $event"
              @sub-toggle="subToggle"
            />
          </AppPanel>
        </template>
        <AppPanel
          v-if="!buka.length"
          title="Semua Daily Task selesai"
          class="mb-5"
        >
          <p class="py-6 text-center text-sm text-muted">
            Task berulang berikutnya sudah lahir di tanggalnya.
          </p>
        </AppPanel>
      </template>
      <AppPanel
        v-else
        title="Daily Task"
        icon="i-lucide-list-todo"
        :count="daftar.length"
        class="mb-5"
        flush
      >
        <BdTaskTree
          v-if="daftar.length"
          :tasks="daftar"
          :semua="state.tasks"
          :people="people"
          @buka="bukaSheet"
          @toggle="toggle"
          @hapus="taskHapus = $event"
          @sub-toggle="subToggle"
        />
        <p
          v-else
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada task di tampilan ini</b>
          Ganti ke "Aktif" untuk melihat yang berjalan.
        </p>
      </AppPanel>
    </template>

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="state.tasks"
      :projects="state.projects"
      :people="people"
      :aku="aku"
      preset-daily
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus task ini?"
      :description="pesanHapus"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
