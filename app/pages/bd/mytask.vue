<!--
  BD › My Task (old `vMyTask`, deploy/bd/index.html:2536-2573). Replaces Board &
  Tasks: "mine" = tasks whose PICs include me. A crew row that never matched
  the roster (AKU null) sees every visible task instead — and that is SAID, or
  an empty list reads as "no work".

  List mode groups the open tasks the way the morning question goes: overdue,
  next 7 days, later, waiting on others — plus the projects I hold and the 6
  most recently done. Kanban mode is the four columns with an archive switch.
-->
<script setup lang="ts">
import type { BdTask } from '~/composables/useBd'
import { centangSub, hapusTaskDenganUrutan, pesanHapusTask, toggleTask, useBdState } from '~/composables/useBd'
import {
  cariAku, lewat, lingkupIds, menungguReviewSaya, pelaksana, penghalang, pics, reviewers, saringLingkup, selesai, sisaHari, urutDeadline,
  type ModeArsip,
} from '~/utils/bd-rumus'
import BdCari, { type HasilPilih } from '~/widgets/bd/BdCari.vue'
import BdKanban from '~/widgets/bd/BdKanban.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdProjCard from '~/widgets/bd/BdProjCard.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import BdTaskTree from '~/widgets/bd/BdTaskTree.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const f = useState('bd-mytask', () => ({ mode: 'list' as 'list' | 'kanban', arsip: 'aktif' as ModeArsip }))

const people = computed(() => state.value.people)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))

/** `tugasSaya` — visible tasks I hold: my PICs AND my sub-task assignments AND tasks waiting on my review (old `tugasSaya`); the unmatched see everything, said out loud. Everyone sees every task & project (`tasksTerlihat`): scope only narrows what is SHOWN. */
const tampak = computed(() => saringLingkup(state.value.tasks, 'semua', lingkup.value, aku.value?.id))
const tampakProject = computed(() => saringLingkup(projects.value, 'semua', lingkup.value, aku.value?.id))
const reviewSaya = (t: BdTask) => !!aku.value && t.status === 'Review' && reviewers(t).includes(aku.value.id)
const semua = computed(() => {
  const vt = tampak.value
  return aku.value ? vt.filter(t => pelaksana(t).includes(aku.value!.id) || reviewSaya(t)) : vt
})
const buka = computed(() => semua.value.filter(t => !selesai(t)).slice().sort(urutDeadline))
const telat = computed(() => buka.value.filter(lewat))
const menunggu = computed(() => buka.value.filter(t => penghalang(t, state.value.tasks).length))
const nSelesai = computed(() => semua.value.length - buka.value.length)
const terkunci = (t: BdTask) => penghalang(t, state.value.tasks).length > 0

const grup = computed(() => {
  const review = menungguReviewSaya(buka.value, aku.value?.id)
  const reviewSajaIds = new Set(review.filter(t => !(aku.value && pelaksana(t).includes(aku.value.id))).map(t => t.id))
  const sisa = buka.value.filter(t => !reviewSajaIds.has(t.id))
  return [
    { judul: 'Menunggu review kamu', items: review },
    { judul: 'Lewat deadline', items: sisa.filter(lewat) },
    { judul: '7 hari ke depan', items: sisa.filter(t => !lewat(t) && !terkunci(t) && t.deadline && sisaHari(t.deadline) <= 7) },
    { judul: 'Berikutnya', items: sisa.filter(t => !lewat(t) && !terkunci(t) && (!t.deadline || sisaHari(t.deadline) > 7)) },
    { judul: 'Menunggu task lain', items: sisa.filter(t => !lewat(t) && terkunci(t)) },
  ]
})
const proyekKu = computed(() => projects.value.filter(p => aku.value && pics(p).includes(aku.value.id) && p.stage !== 'Done'))
const baruSelesai = computed(() => semua.value.filter(selesai)
  .slice().sort((a, b) => (a.doneAt || '') < (b.doneAt || '') ? 1 : -1).slice(0, 6))

const nAktif = computed(() => semua.value.filter(t => !selesai(t)).length)
const nArsip = computed(() => semua.value.length - nAktif.value)

// ---- sheets & row actions ----
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
/** Search result: open the task sheet, the project, or the purchasing board. */
function pilihCari(r: HasilPilih) {
  if (r.jenis === 'task') {
    const t = state.value.tasks.find(x => x.id === r.id)
    if (t) bukaSheet(t)
  }
  else if (r.jenis === 'project') navigateTo(`/bd/projects/${r.id}`)
  else navigateTo('/bd/purchasing')
}
</script>

<template>
  <AppPage
    title="My Task"
    description="Task yang kamu pegang — yang telat, minggu ini, dan yang masih menunggu task lain."
  >
    <template #actions>
      <AppSeg
        v-model="f.mode"
        :options="[{ value: 'list', label: 'List' }, { value: 'kanban', label: 'Kanban' }]"
        size="sm"
      />
      <UButton
        label="Task"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>

    <UAlert
      v-if="!aku && people.length"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Akunmu belum tercocokkan ke daftar kru, jadi halaman ini menampilkan seluruh task yang terlihat — bukan hanya milikmu."
      class="mb-4"
    />

    <BdCari
      :tasks="tampak"
      :projects="tampakProject"
      :po="state.po"
      :people="people"
      class="mb-4"
      @pilih="pilihCari"
    />

    <AppStatGrid>
      <AppStat
        label="Task terbuka"
        icon="i-lucide-list-todo"
        :value="String(buka.length)"
        sub="yang kamu pegang"
      />
      <AppStat
        label="Lewat deadline"
        icon="i-lucide-triangle-alert"
        :value="String(telat.length)"
        :sub="telat.length ? 'perlu ditindak' : 'aman'"
        :tone="telat.length ? 'error' : 'success'"
      />
      <AppStat
        label="Menunggu task lain"
        icon="i-lucide-lock"
        :value="String(menunggu.length)"
        sub="belum bisa Done"
        tone="info"
      />
      <AppStat
        label="Selesai"
        icon="i-lucide-check"
        :value="String(nSelesai)"
        sub="diarsipkan"
      />
    </AppStatGrid>

    <template v-if="f.mode === 'kanban'">
      <div class="mb-3">
        <AppSeg
          v-model="f.arsip"
          :options="[{ value: 'aktif', label: `Aktif (${nAktif})` }, { value: 'arsip', label: `Arsip (Done) (${nArsip})` }, { value: 'semua', label: `Semua (${semua.length})` }]"
          size="sm"
        />
      </div>
      <BdKanban
        :tasks="semua"
        :semua="state.tasks"
        :people="people"
        :projects="projects"
        show-project
        :arsip="f.arsip"
        :pic-default="aku?.id"
        :div-default="aku?.div"
        @buka="bukaSheet"
        @sub-toggle="subToggle"
      />
      <p
        v-if="!semua.length"
        class="py-6 text-center text-sm text-muted"
      >
        <b class="block text-highlighted">Belum ada task di sini</b>
        Ketik nama task di kotak "+ Tambah kartu" pada kolom mana pun.
      </p>
    </template>

    <template v-else>
      <template v-if="proyekKu.length">
        <AppSectionTitle title="Project yang kamu pegang" />
        <div class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <BdProjCard
            v-for="p in proyekKu"
            :key="p.id"
            :project="p"
            :tasks="state.tasks"
            :people="people"
            :tampilkan-pindah="false"
            @buka="navigateTo(`/bd/projects/${p.id}`)"
          />
        </div>
      </template>

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
            :projects="projects"
            show-project
            @buka="bukaSheet"
            @toggle="toggle"
            @hapus="taskHapus = $event"
            @sub-toggle="subToggle"
          />
        </AppPanel>
      </template>

      <AppPanel
        v-if="!buka.length"
        title="Tidak ada task terbuka"
        class="mb-5"
      >
        <p class="py-6 text-center text-sm text-muted">
          Mantap. Task baru bisa ditambah lewat tombol di atas.
        </p>
      </AppPanel>

      <AppPanel
        v-if="baruSelesai.length"
        title="Baru diselesaikan"
        :count="baruSelesai.length"
        class="mb-5"
        flush
      >
        <BdTaskTree
          :tasks="baruSelesai"
          :semua="state.tasks"
          :people="people"
          :projects="projects"
          show-project
          @buka="bukaSheet"
          @toggle="toggle"
          @hapus="taskHapus = $event"
          @sub-toggle="subToggle"
        />
      </AppPanel>
    </template>

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="state.tasks"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus task ini?"
      :description="pesanHapus"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
