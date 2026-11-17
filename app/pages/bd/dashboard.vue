<!--
  BD OS › Dashboard (old `vDashboard` LM Agenda, Okt 2026).

  Morning flow: a greeting, action-demanding strips, three day columns, then
  the side cards. Every column answers "what is mine to do today": tasks are
  mine (`tugasSaya`), agendas are the ones that involve me (team agendas plus
  my invites), milestones are my projects'. The unmatched (no crew row) see
  everything, said out loud.

  Overdue reads as its own "Lewat deadline" card grid (old `.od-card`), longest overdue first, with a
  "Lihat semua" shortcut to My Task. The daily focus box stays removed: its
  setting document (`DB.focus`) is left stored, untouched — the shape changed,
  the data did not.
-->
<script setup lang="ts">
import type { BdAgenda, BdTask } from '~/composables/useBd'
import {
  hapusTaskDenganUrutan, pesanHapusTask, toggleTask, useBdState,
} from '~/composables/useBd'
import {
  agendaHari, cariAku, lewat, menungguReviewSaya, milestoneHari, pics, selesai,
  sisaHari, tugasSaya, todayISO, undanganTertunda, urutDeadline,
} from '~/utils/bd-rumus'
import BdAgendaSheet from '~/widgets/bd/BdAgendaSheet.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdProjMini from '~/widgets/bd/BdProjMini.vue'
import BdTaskRow from '~/widgets/bd/BdTaskRow.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import { fTgl, tambahHari, tglPanjang, tglPendek } from '~/utils/format'
import { IKON_TASK, WARNA_TASK } from '~/utils/status-bd'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, error } = useBdState()

const people = computed(() => state.value.people)
const tasks = computed(() => state.value.tasks)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))

const hari = todayISO()
// Greeting name: first word of the session user, fallback when not loaded yet.
const namaDepan = computed(() => (me.value?.name ?? 'Kru').split(' ')[0])

/** Mine: my PICs, my sub-task assignments, and tasks waiting on my review.
 *  Everyone sees every task (`tasksTerlihat`); scope only narrows what is
 *  shown, and the dashboard narrows to me. The unmatched see everything,
 *  said out loud above. */
const saya = computed(() => tugasSaya(tasks.value, aku.value?.id))
const aktif = computed(() => saya.value.filter(t => !selesai(t)))
const od = computed(() => aktif.value.filter(lewat))
const undangan = computed(() => undanganTertunda(state.value.agenda, aku.value?.id, hari))
const review = computed(() => menungguReviewSaya(tasks.value, aku.value?.id))
const jalan = computed(() => projects.value.filter(p =>
  p.stage !== 'Done' && p.stage !== 'To Do' && (!aku.value || pics(p).includes(aku.value.id))))

// ---- three-day columns: today / tomorrow / day after ----
// Invalid dates never equal a computed ISO, so broken rows are ignored.
const isoBesok = computed(() => tambahHari(hari, 1))
const isoLusa = computed(() => tambahHari(hari, 2))
const kolomHari = computed(() => [
  { label: 'Hari ini', iso: hari },
  { label: 'Besok', iso: isoBesok.value },
  { label: 'Lusa', iso: isoLusa.value },
].map(k => ({
  ...k,
  agenda: agendaHari(state.value.agenda, k.iso, aku.value?.id),
  deadline: aktif.value.filter(t => t.deadline === k.iso).sort(urutDeadline),
  milestone: milestoneHari(projects.value, k.iso, aku.value?.id),
})))
const tanpaDeadline = computed(() => aktif.value.filter(t => !t.deadline).sort(urutDeadline))
/** Lewat deadline, longest overdue first: an empty deadline never sorts above a real one. */
const odUrut = computed(() => od.value.slice().sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1))
/** Old OD_MAKS = 8: the rest is counted, with a link to My Task. */
const odTampil = computed(() => odUrut.value.slice(0, 8))
const namaProject = (id?: string | null) => projects.value.find(p => p.id === id)?.name
const namaOrang = (id?: string | null) => people.value.find(p => p.id === id)?.name || '—'
/** Am I invited to this agenda and still silent? Team agendas invite no one. */
const belumJawab = (e: BdAgenda) => !!aku.value && !!e.owner && e.owner !== aku.value.id
  && (e.peserta || []).includes(aku.value.id) && !(e.resp || {})[aku.value.id]

// ---- sheets & quick actions ----
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
const bukaAgenda = ref(false)
const agendaPilih = ref<BdAgenda | null>(null)
const agendaAwal = ref<{ date?: string, start?: string, end?: string } | null>(null)
const taskHapus = ref<BdTask | null>(null)
const hapusMau = computed({
  get: () => !!taskHapus.value,
  set: (v) => { if (!v) taskHapus.value = null },
})

function baru() {
  taskPilih.value = null
  bukaTask.value = true
}
function baruAgenda(iso?: string) {
  agendaPilih.value = null
  agendaAwal.value = iso ? { date: iso } : null
  bukaAgenda.value = true
}
function buka(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
function bukaAgendaSheet(e: BdAgenda) {
  agendaPilih.value = e
  agendaAwal.value = null
  bukaAgenda.value = true
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
    :kicker="tglPanjang(hari)"
  >
    <!-- Old `.hello`: Task (secondary) then Agenda (the gold action, rightmost). -->
    <template #actions>
      <UButton
        label="Task"
        icon="i-lucide-check"
        color="neutral"
        variant="outline"
        @click="baru"
      />
      <UButton
        label="Agenda"
        icon="i-lucide-plus"
        @click="baruAgenda(hari)"
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
      Divisi kamu belum diatur, jadi task barumu jatuh ke divisi bawaan. Divisi mengikuti kolom Tim di
      Office › Kelola User — setelah cocok, tekan Segarkan dari Office di
      <NuxtLink
        to="/bd/tim"
        class="font-semibold text-ink-900 underline"
      >Kru BD</NuxtLink>
      — sekalian isi atasanmu, karena itu yang menentukan siapa melihat task siapa.
    </p>

    <!-- Strips that demand an action, each with its way out. -->
    <div
      v-if="undangan.length"
      class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
    >
      <UIcon
        name="i-lucide-bell"
        class="size-5 shrink-0 text-warning"
      />
      <p class="min-w-0 flex-1">
        <b>{{ undangan.length }}</b> undangan agenda menunggu jawabanmu.
      </p>
      <UButton
        label="Lihat"
        color="neutral"
        variant="outline"
        size="sm"
        to="/bd/inbox"
      />
    </div>
    <div
      v-if="review.length"
      class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-default bg-default p-3 text-sm"
    >
      <UIcon
        name="i-lucide-eye"
        class="size-5 shrink-0 text-ink-900"
      />
      <p class="min-w-0 flex-1">
        <b>{{ review.length }}</b> task menunggu review kamu.
      </p>
      <UButton
        label="Review"
        color="neutral"
        variant="outline"
        size="sm"
        to="/bd/inbox"
      />
    </div>
    <!-- Overdue laid out on the board itself (old `.od-card`, 30 Okt 2026): a grid of
         cards, longest overdue first, cut at OD_MAKS with the rest counted. -->
    <AppPanel
      v-if="od.length"
      title="Lewat deadline"
      icon="i-lucide-clock"
      :count="od.length"
      class="mb-5"
    >
      <template #actions>
        <UButton
          label="Lihat semua di My Task"
          trailing-icon="i-lucide-chevron-right"
          color="neutral"
          variant="outline"
          size="sm"
          to="/bd/mytask"
        />
      </template>
      <!-- Compact tickets: a thin red edge and a hairline border, small corners,
           the date as a small caption over the name (owner request, 17 Nov 2026). -->
      <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          v-for="t in odTampil"
          :key="t.id"
          type="button"
          class="group flex min-w-0 flex-col gap-1.5 rounded-lg border border-error/30 border-l-[3px] border-l-error bg-default px-3 py-2.5 text-left shadow-sm transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-px hover:border-error/60 hover:shadow-md"
          @click="buka(t)"
        >
          <span class="flex items-center justify-between gap-2 text-[11px]">
            <span class="num inline-flex items-center gap-1 font-semibold text-error">
              <UIcon
                name="i-lucide-calendar-x"
                class="size-3.5"
              />
              {{ t.deadline ? tglPendek(t.deadline) : '—' }} · telat {{ -sisaHari(t.deadline) }} hari
            </span>
            <AppStatus
              :color="WARNA_TASK[t.status] ?? 'neutral'"
              :icon="IKON_TASK[t.status]"
              size="sm"
            >{{ t.status }}</AppStatus>
          </span>
          <span class="line-clamp-2 text-sm font-semibold leading-snug text-highlighted group-hover:text-gold-deep">{{ t.name }}</span>
          <span
            v-if="namaProject(t.project) || t.daily"
            class="truncate text-[11px] text-muted"
          >{{ namaProject(t.project) || 'Daily' }}</span>
        </button>
      </div>
      <p
        v-if="od.length > odTampil.length"
        class="mt-3 text-sm text-muted"
      >
        +{{ od.length - odTampil.length }} task lain lewat deadline —
        <NuxtLink
          to="/bd/mytask"
          class="font-semibold text-gold-deep hover:underline"
        >lihat semua di My Task</NuxtLink>
      </p>
    </AppPanel>

    <!-- Three day cards (old `.days3`): today ringed in gold. Each lists the agendas
         that involve me, my deadlines and my project milestones. -->
    <div class="grid gap-5 lg:grid-cols-3">
      <AppPanel
        v-for="(k, i) in kolomHari"
        :key="k.iso"
        :title="k.label"
        :description="fTgl(k.iso)"
        :class="i === 0 ? 'ring-2 ring-gold' : ''"
      >
        <template #actions>
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Tambah agenda ${k.label}`"
            title="Tambah agenda tanggal ini"
            @click="baruAgenda(k.iso)"
          />
        </template>
        <section :aria-label="k.label">
          <div class="divide-y divide-default">
            <p class="px-2 pb-0 pt-2 text-[10px] font-bold uppercase tracking-wider text-dimmed">
              Agenda
            </p>
            <button
              v-for="e in k.agenda"
              :key="e.id"
              type="button"
              class="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-muted/60"
              @click="bukaAgendaSheet(e)"
            >
              <span class="min-w-10 pt-0.5 font-mono text-[11px] text-muted">{{ e.start || '—' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-highlighted">{{ e.title }}</span>
                <span class="text-xs text-muted">
                  {{ e.type }} · {{ e.div }}{{ e.lokasi ? ` · ${e.lokasi}` : '' }}
                </span>
                <span
                  v-if="belumJawab(e)"
                  class="mt-0.5 inline-block rounded-full border border-warning/40 bg-warning/10 px-1.5 py-px text-[10px] font-bold text-warning"
                >Belum dijawab</span>
              </span>
            </button>
            <p
              v-if="!k.agenda.length"
              class="px-2 py-2 text-xs text-muted"
            >
              Tidak ada agenda.
            </p>
            <template v-if="k.deadline.length">
              <p class="px-2 pb-0 pt-2 text-[10px] font-bold uppercase tracking-wider text-dimmed">
                Tenggat
              </p>
              <BdTaskRow
                v-for="t in k.deadline"
                :key="t.id"
                :task="t"
                :people="people"
                :project-name="namaProject(t.project)"
                hide-quad
                @buka="buka(t)"
                @toggle="toggle(t)"
                @hapus="taskHapus = t"
              />
            </template>
            <template v-if="k.milestone.length">
              <p class="px-2 pb-0 pt-2 text-[10px] font-bold uppercase tracking-wider text-dimmed">
                Milestone
              </p>
              <button
                v-for="m in k.milestone"
                :key="m.p.id + m.ms.t"
                type="button"
                class="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-muted/60"
                :title="`${m.ms.t} — ${m.p.name}`"
                @click="navigateTo(`/bd/projects/${m.p.id}`)"
              >
                <span class="min-w-10 pt-0.5 font-mono text-[11px] text-muted">◇</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold text-highlighted">{{ m.ms.t }}</span>
                  <span class="text-xs text-muted">{{ m.p.name }}{{ m.ms.done ? ' · selesai' : '' }}</span>
                </span>
              </button>
            </template>
            <p
              v-if="!k.deadline.length && !k.milestone.length"
              class="px-2 py-2 text-xs text-muted"
            >
              Tidak ada deadline.
            </p>
          </div>
        </section>
      </AppPanel>
    </div>

    <!-- Action lists -->
    <div class="mt-5 grid gap-5 lg:grid-cols-3">
      <AppPanel
        title="Belum ada deadline"
        icon="i-lucide-calendar-x"
        :count="tanpaDeadline.length"
      >
        <!-- One tidy line per task: name + where it lives on the left, one
             "Atur deadline" action on the right (no second row of buttons). -->
        <div class="flex flex-col gap-2">
          <div
            v-for="t in tanpaDeadline.slice(0, 6)"
            :key="t.id"
            class="flex items-center gap-3 rounded-lg border border-dashed border-accented bg-default px-3 py-2 transition-colors hover:border-gold"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="buka(t)"
            >
              <span class="block truncate text-sm font-semibold text-highlighted">{{ t.name }}</span>
              <span class="block truncate text-[11px] text-muted">
                {{ namaProject(t.project) || (t.daily ? 'Daily' : t.div || 'Tanpa project') }} · {{ t.status }}
              </span>
            </button>
            <UButton
              label="Atur"
              icon="i-lucide-calendar-plus"
              color="neutral"
              variant="outline"
              size="xs"
              class="shrink-0"
              :aria-label="`Atur deadline ${t.name}`"
              @click="buka(t)"
            />
          </div>
          <p
            v-if="!tanpaDeadline.length"
            class="py-6 text-center text-sm text-muted"
          >
            <b class="block text-highlighted">Semua task sudah berdeadline</b>Bagus, tidak ada yang menggantung.
          </p>
          <div
            v-else-if="tanpaDeadline.length > 6"
            class="px-2 py-2"
          >
            <UButton
              label="Lihat semua di My Task"
              trailing-icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              size="sm"
              to="/bd/mytask"
            />
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Menunggu respons"
        icon="i-lucide-inbox"
        :count="undangan.length + review.length"
      >
        <template #actions>
          <UButton
            label="Semua"
            trailing-icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            to="/bd/inbox"
          />
        </template>
        <div class="divide-y divide-default">
          <button
            v-for="e in undangan.slice(0, 3)"
            :key="e.id"
            type="button"
            class="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-muted/60"
            @click="bukaAgendaSheet(e)"
          >
            <UIcon
              name="i-lucide-calendar"
              class="mt-0.5 size-4 shrink-0 text-ink-900"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold text-highlighted">{{ e.title }}</span>
              <span class="text-xs text-muted">Undangan dari {{ namaOrang(e.owner) }} · {{ fTgl(e.date) }}</span>
            </span>
          </button>
          <button
            v-for="t in review.slice(0, 3)"
            :key="t.id"
            type="button"
            class="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-muted/60"
            @click="navigateTo('/bd/inbox')"
          >
            <UIcon
              name="i-lucide-eye"
              class="mt-0.5 size-4 shrink-0 text-ink-900"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold text-highlighted">{{ t.name }}</span>
              <span class="text-xs text-muted">Menunggu review kamu{{ t.deadline ? ` · ${fTgl(t.deadline)}` : '' }}</span>
            </span>
          </button>
          <p
            v-if="!undangan.length && !review.length"
            class="py-6 text-center text-sm text-muted"
          >
            <b class="block text-highlighted">Tidak ada yang menunggu jawabanmu</b>
          </p>
        </div>
      </AppPanel>

      <AppPanel
        title="Project berjalan"
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
            v-for="p in jalan.slice(0, 4)"
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
          <div
            v-else-if="jalan.length > 4"
            class="px-2 py-2"
          >
            <UButton
              label="Lihat semua project"
              trailing-icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              size="sm"
              to="/bd/projects"
            />
          </div>
        </div>
      </AppPanel>
    </div>

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="tasks"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
    <BdAgendaSheet
      v-model:open="bukaAgenda"
      :agenda="agendaPilih"
      :people="people"
      :aku="aku"
      :awal="agendaAwal"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus task ini?"
      :description="pesanHapus"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
