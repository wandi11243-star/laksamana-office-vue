<!--
  BD › My Task (old `vMyTask`, deploy/bd/index.html:2536-2573). Replaces Board &
  Tasks: "mine" = tasks whose PICs include me. A crew row that never matched
  the roster (AKU null) sees every visible task instead — and that is SAID, or
  an empty list reads as "no work".

  A BD admin or a boss can also open someone else's My Task, their whole team,
  or (admin) every task — the picker beside the search. Own tasks stay the default.

  List mode groups the open tasks the way the morning question goes: overdue,
  next 7 days, later, waiting on others — plus the projects I hold and the 6
  most recently done. Kanban mode is the four columns with an archive switch.
-->
<script setup lang="ts">
import type { BdTask } from '~/composables/useBd'
import { centangSub, geserTask, hapusTaskDenganUrutan, linkWaRekap, useNomorWaBd, pesanHapusTask, toggleTask, useBdState } from '~/composables/useBd'
import {
  bawahan, cariAku, lewat, lingkupIds, menungguReviewSaya, orangPantau, pelaksana, penghalang, pics, saringLingkup, selesai, sisaHari, tugasSaya, urutTask, OPSI_URUT,
  type ModeArsip, type ModeUrut,
} from '~/utils/bd-rumus'
import BdCari, { type HasilPilih } from '~/widgets/bd/BdCari.vue'
import BdKanban from '~/widgets/bd/BdKanban.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdProjCard from '~/widgets/bd/BdProjCard.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import BdTaskTree from '~/widgets/bd/BdTaskTree.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, status, refresh: muatBd } = useBdState()

/** First-load skeleton for the four recap cards below: skeleton cells stand
 *  in until the first state lands. Refetch keeps old numbers, so the cards
 *  never blank. */
const statMemuat = computed(() => !state.value.tasks.length && (status.value === 'pending' || status.value === 'idle'))
const f = useState('bd-mytask', () => ({ mode: 'list' as 'list' | 'kanban', arsip: 'aktif' as ModeArsip, urut: 'manual' as ModeUrut }))

// ---- whose tasks are shown ----
// Sentinels, not '': the select treats an empty value as "nothing chosen".
const SAYA = '__saya__'
const TIM = '__tim__'
const SEMUA = '__semua__'
const lihat = useState('bd-mytask-lihat', () => SAYA)

const people = computed(() => state.value.people)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))

/** `tugasSaya` — visible tasks I hold: my PICs AND my sub-task assignments AND tasks waiting on my review (old `tugasSaya`); the unmatched see everything, said out loud. Everyone sees every task & project (`tasksTerlihat`): scope only narrows what is SHOWN. */
const tampak = computed(() => saringLingkup(state.value.tasks, 'semua', lingkup.value, aku.value?.id))
const tampakProject = computed(() => saringLingkup(projects.value, 'semua', lingkup.value, aku.value?.id))
const admin = computed(() => isAdminOf(me.value, 'bd'))
const pantau = computed(() => orangPantau(people.value, aku.value?.id, admin.value))
const idTim = computed(() => (aku.value ? bawahan(people.value, aku.value.id) : []))
const tugasTim = computed(() => tampak.value.filter(t => pelaksana(t).some(id => idTim.value.includes(id))))
const nBuka = (daftar: BdTask[]) => daftar.filter(t => !selesai(t)).length
/** The picker: me, my reports together, everyone (admin), then one person at a time — with their open count. */
const opsiLihat = computed(() => [
  { value: SAYA, label: aku.value ? 'Task saya' : 'Semua task' },
  ...(idTim.value.length ? [{ value: TIM, label: `Tim saya (${nBuka(tugasTim.value)})` }] : []),
  ...(admin.value && aku.value ? [{ value: SEMUA, label: `Semua task (${nBuka(tampak.value)})` }] : []),
  ...pantau.value.map(p => ({ value: p.id, label: `${p.name || p.id} (${nBuka(tugasSaya(tampak.value, p.id))})` })),
])
/** A choice that is no longer offered (access or boss changed) falls back to my own tasks. */
const lihatSah = computed({
  get: () => (opsiLihat.value.some(o => o.value === lihat.value) ? lihat.value : SAYA),
  set: (v: string) => { lihat.value = v },
})
/** The one person on screen: me, the picked crew member, or null for a team / everyone. */
const orang = computed(() => {
  if (lihatSah.value === SAYA) return aku.value
  return pantau.value.find(p => p.id === lihatSah.value) || null
})
const sebut = computed(() => {
  if (lihatSah.value === TIM) return 'tim kamu'
  if (lihatSah.value === SEMUA || !orang.value) return 'semua kru'
  return lihatSah.value === SAYA ? 'kamu' : String(orang.value.name || '')
})
const semua = computed(() => {
  if (lihatSah.value === TIM) return tugasTim.value
  return tugasSaya(tampak.value, orang.value?.id)
})
const buka = computed(() => semua.value.filter(t => !selesai(t)).slice().sort(urutTask(f.value.urut ?? 'manual')))
// WhatsApp recap (owner request 28 Nov 2026): one message per person with ALL their open
// tasks on this screen, sent by hand. The n8n reminders are separate and untouched.
const nomorWaKru = useNomorWaBd()
const menuWa = computed(() => {
  const ids = [...new Set(buka.value.flatMap(t => pelaksana(t)))]
  return ids.map((id) => {
    const p = people.value.find(x => x.id === id)
    const daftar = buka.value.filter(t => pelaksana(t).includes(id))
    const url = p ? linkWaRekap(p.name, nomorWaKru.value?.[String(p.officeUserId || '')] || '', daftar) : ''
    return { label: `${p?.name || id} (${daftar.length} task)${url ? '' : ' · nomor belum ada'}`, icon: 'i-lucide-message-circle', to: url || undefined, target: '_blank', disabled: !url }
  }).sort((a, b) => Number(a.disabled) - Number(b.disabled))
})
const telat = computed(() => buka.value.filter(lewat))
const menunggu = computed(() => buka.value.filter(t => penghalang(t, state.value.tasks).length))
const nSelesai = computed(() => semua.value.length - buka.value.length)
const terkunci = (t: BdTask) => penghalang(t, state.value.tasks).length > 0

const grup = computed(() => {
  const review = menungguReviewSaya(buka.value, orang.value?.id)
  const reviewSajaIds = new Set(review.filter(t => !(orang.value && pelaksana(t).includes(orang.value.id))).map(t => t.id))
  const sisa = buka.value.filter(t => !reviewSajaIds.has(t.id))
  return [
    { judul: `Menunggu review ${sebut.value}`, items: review },
    { judul: 'Lewat deadline', items: sisa.filter(lewat) },
    { judul: '7 hari ke depan', items: sisa.filter(t => !lewat(t) && !terkunci(t) && t.deadline && sisaHari(t.deadline) <= 7) },
    { judul: 'Berikutnya', items: sisa.filter(t => !lewat(t) && !terkunci(t) && (!t.deadline || sisaHari(t.deadline) > 7)) },
    { judul: 'Menunggu task lain', items: sisa.filter(t => !lewat(t) && terkunci(t)) },
  ]
})
const proyekKu = computed(() => projects.value.filter(p => orang.value && pics(p).includes(orang.value.id) && p.stage !== 'Done'))
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

// ---- auto-refresh: fresh state about every 20 s, yielding to the crew ----
// The old client polled `getAll` on the same cadence
// (`deploy/bd/index.html:1364`), cancelling or deferring its tick while the
// crew typed or saved, so keystrokes were never lost and saves never queued
// behind a poll (`:1330-1362`, `:3119-3120`). Same rule here, like the
// reservasi dashboard poll (`app/pages/reservasi/dashboard.vue:1448-1470`):
// an open sheet or confirm, a focused field, an in-flight drag, or a fresh
// scroll skips this tick and the next tick tries again — never a forced redraw.
const POLL_JEDA = 20000
let pollTimer: ReturnType<typeof setInterval> | undefined
let sedangSeret = false
let akhirGulir = 0
function tandaiSeret(v: boolean) {
  sedangSeret = v
}
function tandaiGulir() {
  akhirGulir = Date.now()
}
/** True while the crew owns the screen — a refresh now would redraw under them. */
function pollDitunda() {
  // An open sheet or delete confirm owns the data (its save refreshes by itself).
  if (bukaTask.value || taskHapus.value) return true
  if (sedangSeret || Date.now() - akhirGulir < 2000) return true
  // Focus inside a field: the crew is typing (search, quick-add boxes, sheet inputs).
  const el = document.activeElement as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return true
  return document.visibilityState !== 'visible'
}
function tickPoll() {
  if (!pollDitunda()) void muatBd()
}
const seretMulai = () => tandaiSeret(true)
const seretSelesai = () => tandaiSeret(false)
onMounted(() => {
  window.addEventListener('dragstart', seretMulai)
  window.addEventListener('dragend', seretSelesai)
  window.addEventListener('drop', seretSelesai)
  window.addEventListener('scroll', tandaiGulir, { passive: true })
  pollTimer = setInterval(tickPoll, POLL_JEDA)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  window.removeEventListener('dragstart', seretMulai)
  window.removeEventListener('dragend', seretSelesai)
  window.removeEventListener('drop', seretSelesai)
  window.removeEventListener('scroll', tandaiGulir)
})
</script>

<template>
  <AppPage
    title="My Task"
    :description="`Task yang ${lihatSah === SAYA ? 'kamu' : sebut} pegang — yang telat, minggu ini, dan yang masih menunggu task lain.`"
  >
    <template #actions>
      <AppSeg
        v-model="f.mode"
        :options="[{ value: 'list', label: 'List' }, { value: 'kanban', label: 'Kanban' }]"
        size="sm"
      />
      <USelect
        v-model="f.urut"
        :items="OPSI_URUT"
        size="sm"
        icon="i-lucide-arrow-up-down"
        class="w-44"
        aria-label="Urutkan task"
      />
      <UDropdownMenu
        v-if="menuWa.length"
        :items="menuWa"
      >
        <UButton
          label="WhatsApp"
          icon="i-lucide-message-circle"
          color="success"
          variant="soft"
          aria-label="Kirim rekap task lewat WhatsApp"
        />
      </UDropdownMenu>
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

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
      <!-- Only for a BD admin or a boss: everyone else has a single choice. -->
      <USelectMenu
        v-if="opsiLihat.length > 1"
        v-model="lihatSah"
        :items="opsiLihat"
        value-key="value"
        icon="i-lucide-users"
        :search-input="{ placeholder: 'Cari kru…' }"
        class="w-full sm:w-60 sm:shrink-0"
        aria-label="Lihat task milik"
      />
      <BdCari
        :tasks="tampak"
        :projects="tampakProject"
        :po="state.po"
        :people="people"
        class="min-w-0 flex-1"
        @pilih="pilihCari"
      />
    </div>

    <AppStatGrid
      :loading="statMemuat"
      :count="4"
    >
      <AppStat
        label="Task terbuka"
        icon="i-lucide-list-todo"
        :value="String(buka.length)"
        :sub="lihatSah === SAYA ? 'yang kamu pegang' : `dipegang ${sebut}`"
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
        :urut="f.urut"
        :pic-default="(orang || aku)?.id"
        :div-default="(orang || aku)?.div"
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
        <AppSectionTitle :title="`Project yang ${sebut} pegang`" />
        <div class="mb-5 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
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
            :geser="f.urut === 'manual'"
            @geser="(t, arah) => geserTask(g.items, t, arah)"
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
          {{ lihatSah === SAYA ? 'Mantap. Task baru bisa ditambah lewat tombol di atas.' : `Belum ada task terbuka untuk ${sebut}.` }}
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
      :pic-awal="orang"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus task ini?"
      :description="pesanHapus"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
