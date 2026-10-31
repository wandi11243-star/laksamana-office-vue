<!--
  BD OS › Dashboard (old `vDashboard`, deploy/bd/index.html:1472-1551).

  Five numbers, the daily focus, then four panels. The scope is the same as
  Tasks ("what is mine to do today"), while Coord and PO are counted globally —
  they belong to no single PIC (`:1472-1479`).
-->
<script setup lang="ts">
import type { BdTask } from '~/composables/useBd'
import {
  bdTulisDiam, hapusTaskDenganUrutan, pesanHapusTask, putSetelan, toggleTask, useBdSettings, useBdState, versiSetelan,
} from '~/composables/useBd'
import { catIniAku, cariAku, dalamLingkup, fRp, lewat, lingkupIds, selesai, todayISO } from '~/utils/bd-rumus'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdProjMini from '~/widgets/bd/BdProjMini.vue'
import BdTaskRow from '~/widgets/bd/BdTaskRow.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import { fTgl, tambahHari } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, error } = useBdState()
const { data: setelan } = useBdSettings()

const people = computed(() => state.value.people)
const tasks = computed(() => state.value.tasks)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))

const hari = todayISO()
// Greeting name: first word of the session user, fallback when not loaded yet.
const namaDepan = computed(() => (me.value?.name ?? 'Kru').split(' ')[0])
const vt = computed(() => tasks.value.filter(t => dalamLingkup(t, lingkup.value)))
const aktif = computed(() => vt.value.filter(t => !selesai(t)))
const od = computed(() => vt.value.filter(lewat))
const jalan = computed(() => projects.value.filter(p => dalamLingkup(p, lingkup.value) && p.stage !== 'Done' && p.stage !== 'To Do'))
const coordP = computed(() => state.value.coord.filter(c => c.status !== 'Selesai'))
const poP = computed(() => state.value.po.filter(p => p.status !== 'Diterima'))
// ---- three-day columns: today / tomorrow / day after (Task 2) ----
// Invalid dates never equal a computed ISO, so broken rows are ignored.
const isoBesok = computed(() => tambahHari(hari, 1))
const isoLusa = computed(() => tambahHari(hari, 2))
const kolomHari = computed(() => [
  { label: 'Hari ini', iso: hari, agenda: state.value.agenda.filter(e => e.date === hari), deadline: aktif.value.filter(t => t.deadline === hari) },
  { label: 'Besok', iso: isoBesok.value, agenda: state.value.agenda.filter(e => e.date === isoBesok.value), deadline: aktif.value.filter(t => t.deadline === isoBesok.value) },
  { label: 'Lusa', iso: isoLusa.value, agenda: state.value.agenda.filter(e => e.date === isoLusa.value), deadline: aktif.value.filter(t => t.deadline === isoLusa.value) },
])
const top = computed(() => [...aktif.value].sort((a, b) => {
  const oa = lewat(a)
  const ob = lewat(b)
  if (oa !== ob) return oa ? -1 : 1
  const qa = (a.important ? 2 : 0) + (a.urgent ? 1 : 0)
  const qb = (b.important ? 2 : 0) + (b.urgent ? 1 : 0)
  if (qa !== qb) return qb - qa
  return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1
}).slice(0, 6))

const namaProject = (id?: string | null) => projects.value.find(p => p.id === id)?.name

// ---- daily focus: auto-saved WITH its date (`:1542-1551`) ----
const fokus = ref('')
const suntingFokus = ref(false)
function syncFokus() {
  const f = setelan.value?.data.focus?.[catIniAku(people.value, me.value?.id)]
  fokus.value = f && f.tgl === hari ? (f.teks || '') : ''
}
watch(setelan, () => {
  if (!suntingFokus.value) syncFokus()
}, { immediate: true })

let fokusTimer: ReturnType<typeof setTimeout> | null = null
function fokusUbah() {
  if (fokusTimer) clearTimeout(fokusTimer)
  fokusTimer = setTimeout(() => {
    const key = catIniAku(people.value, me.value?.id)
    const nilai = { ...(setelan.value?.data.focus || {}), [key]: { teks: fokus.value, tgl: todayISO() } }
    bdTulisDiam(() => putSetelan('focus', nilai, versiSetelan(setelan.value, 'focus')))
  }, 800)
}

// ---- task sheet & quick actions ----
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
const taskHapus = ref<BdTask | null>(null)
const hapusMau = computed({
  get: () => !!taskHapus.value,
  set: (v) => { if (!v) taskHapus.value = null },
})

function baru() {
  taskPilih.value = null
  bukaTask.value = true
}
function buka(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function toggle(t: BdTask) {
  toggleTask(t, tasks.value)
}
const pesanHapus = computed(() => (taskHapus.value ? pesanHapusTask(taskHapus.value, tasks.value) : ''))
async function hapus() {
  const t = taskHapus.value
  if (!t) return
  taskHapus.value = null
  await hapusTaskDenganUrutan(t, tasks.value)
}
</script>

<template>
  <AppPage
    :title="`Halo, ${namaDepan}`"
    :description="`${fTgl(hari)} · Kondisi hari ini — task, project & purchasing`"
  >
    <template #actions>
      <UButton
        label="Tugas Baru"
        icon="i-lucide-plus"
        @click="baru"
      />
      <UButton
        label="Agenda"
        icon="i-lucide-calendar-days"
        color="neutral"
        variant="outline"
        to="/bd/calendar"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 rounded-xl border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Papan tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <p
      v-if="!aku && people.length"
      class="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
    >
      Kamu punya akses modul ini, tapi belum muncul di daftar kru — biasanya karena akses baru diberikan dan
      daftarnya masih lama. Tekan Segarkan dari Office di <NuxtLink
        to="/bd/tim"
        class="font-semibold text-ink-900 underline"
      >Kru BD</NuxtLink>.
      Sementara itu papan menampilkan pekerjaan semua orang.
    </p>
    <p
      v-else-if="aku && !aku.div"
      class="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
    >
      Divisi kamu belum diatur, jadi task barumu jatuh ke divisi bawaan. Atur di
      <NuxtLink
        to="/bd/tim"
        class="font-semibold text-ink-900 underline"
      >Kru BD</NuxtLink>
      — sekalian isi atasanmu, karena itu yang menentukan siapa melihat task siapa.
    </p>

    <AppStatGrid>
      <AppStat
        label="Task aktif"
        icon="i-lucide-list-todo"
        :value="aktif.length"
        :sub="`${vt.filter(selesai).length} selesai tercatat`"
      />
      <AppStat
        label="Overdue"
        icon="i-lucide-triangle-alert"
        :tone="od.length ? 'error' : 'success'"
        :value="od.length"
        :sub="od.length ? 'Perlu perhatian' : 'Semua terkendali'"
      />
      <AppStat
        label="Project jalan"
        icon="i-lucide-folder-kanban"
        tone="vip"
        :value="jalan.length"
        :sub="`${projects.filter(p => p.health === 'at-risk').length} at-risk`"
      />
      <AppStat
        label="Koordinasi pending"
        icon="i-lucide-handshake"
        tone="warning"
        :value="coordP.length"
        sub="ke divisi lain"
      />
      <AppStat
        label="PO berjalan"
        icon="i-lucide-shopping-cart"
        :value="poP.length"
        :sub="fRp(poP.reduce((s, p) => s + (Number(p.amount) || 0), 0))"
      />
    </AppStatGrid>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <span class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-900"><UIcon
          name="i-lucide-star"
          class="size-3.5"
        /> Fokus utama hari ini</span>
        <UInput
          v-model="fokus"
          placeholder="Apa satu hal terpenting hari ini?"
          class="min-w-0 flex-1"
          @focus="suntingFokus = true"
          @blur="suntingFokus = false"
          @input="fokusUbah"
        />
      </div>
    </AppPanel>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="min-w-0">
        <AppPanel
          title="Prioritas teratas"
          icon="i-lucide-target"
          :count="top.length"
        >
          <template #actions>
            <UButton
              label="My Task"
              trailing-icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              to="/bd/mytask"
            />
          </template>
          <div class="divide-y divide-default">
            <BdTaskRow
              v-for="t in top"
              :key="t.id"
              :task="t"
              :people="people"
              :project-name="namaProject(t.project)"
              @buka="buka(t)"
              @toggle="toggle(t)"
              @hapus="taskHapus = t"
            />
            <p
              v-if="!top.length"
              class="py-6 text-center text-sm text-muted"
            >
              <b class="block text-highlighted">Tidak ada task aktif</b>Papan bersih.
            </p>
          </div>
        </AppPanel>

        <AppPanel
          title="Kesehatan project"
          icon="i-lucide-activity"
          :count="jalan.length"
        >
          <template #actions>
            <UButton
              label="Buka"
              trailing-icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              to="/bd/projects"
            />
          </template>
          <div class="divide-y divide-default">
            <BdProjMini
              v-for="p in jalan"
              :key="p.id"
              :project="p"
              :tasks="tasks"
              :people="people"
              @buka="navigateTo(`/bd/projects/${p.id}`)"
            />
            <p
              v-if="!jalan.length"
              class="py-6 text-center text-sm text-muted"
            >
              <b class="block text-highlighted">Belum ada project berjalan</b>
            </p>
          </div>
        </AppPanel>
      </div>

      <div class="min-w-0">
        <AppPanel
          title="Overdue"
          icon="i-lucide-alarm-clock"
          :count="od.length"
        >
          <div class="divide-y divide-default">
            <BdTaskRow
              v-for="t in od.slice(0, 6)"
              :key="t.id"
              :task="t"
              :people="people"
              :project-name="namaProject(t.project)"
              hide-quad
              @buka="buka(t)"
              @toggle="toggle(t)"
              @hapus="taskHapus = t"
            />
            <p
              v-if="!od.length"
              class="py-6 text-center text-sm text-muted"
            >
              <b class="block text-highlighted">Tidak ada yang lewat deadline</b>Pertahankan.
            </p>
          </div>
        </AppPanel>

        <AppPanel
          title="Tiga hari ke depan"
          icon="i-lucide-calendar-check"
          :count="kolomHari.reduce((s, k) => s + k.agenda.length + k.deadline.length, 0)"
        >
          <div class="grid gap-5 md:grid-cols-3">
            <section
              v-for="k in kolomHari"
              :key="k.iso"
              :aria-label="k.label"
            >
              <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-900">
                {{ k.label }}
              </p>
              <p class="mb-2 text-xs text-muted">
                {{ fTgl(k.iso) }}
              </p>
              <div class="divide-y divide-default rounded-xl border border-default">
                <NuxtLink
                  v-for="e in k.agenda.slice(0, 6)"
                  :key="e.id"
                  to="/bd/calendar"
                  class="flex items-start gap-2 px-2 py-2"
                >
                  <UIcon
                    name="i-lucide-calendar"
                    class="mt-0.5 size-4 shrink-0 text-ink-900"
                  />
                  <span>
                    <span class="block font-semibold text-highlighted">{{ e.title }}</span>
                    <span class="text-xs text-muted">{{ e.type }} · {{ e.div }}</span>
                  </span>
                </NuxtLink>
                <BdTaskRow
                  v-for="t in k.deadline.slice(0, 6)"
                  :key="t.id"
                  :task="t"
                  :people="people"
                  :project-name="namaProject(t.project)"
                  hide-quad
                  @buka="buka(t)"
                  @toggle="toggle(t)"
                  @hapus="taskHapus = t"
                />
                <p
                  v-if="!k.agenda.length && !k.deadline.length"
                  class="py-6 text-center text-sm text-muted"
                >
                  <b class="block text-highlighted">Tidak ada agenda/deadline</b>
                </p>
                <div
                  v-else-if="k.agenda.length > 6 || k.deadline.length > 6"
                  class="flex gap-2 px-2 py-2"
                >
                  <UButton
                    v-if="k.deadline.length > 6"
                    label="My Task"
                    trailing-icon="i-lucide-chevron-right"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    to="/bd/mytask"
                  />
                  <UButton
                    v-if="k.agenda.length > 6"
                    label="Kalender"
                    trailing-icon="i-lucide-chevron-right"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    to="/bd/calendar"
                  />
                </div>
              </div>
            </section>
          </div>
        </AppPanel>
      </div>
    </div>

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="tasks"
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
