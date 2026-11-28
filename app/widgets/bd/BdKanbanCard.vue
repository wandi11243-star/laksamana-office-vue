<!--
  One Kanban card (old `boardCard`, deploy/bd/index.html). Built for a ~240px
  column: name, the "Menunggu: …" line, one meta row (project, PIC avatars,
  sub-task toggle, deadline), the sub-task dropdown and the progress bar.
  The whole card opens the task; there is no tick or delete button here — the
  list row (`BdTaskRow`) is too wide for a column and pushed its chips out of
  the card. Chips truncate instead of overflowing.
-->
<script setup lang="ts">
import type { BdPerson, BdTask } from '~/composables/useBd'
import { lampiranSah, linkWaTask, useNomorWaBd } from '~/composables/useBd'
import { fDue, inisial, kunciTag, labelUlang, lewat, penghalang, pics, reviewers, selesai, sisaHari, subHitung, subs, tagsOf } from '~/utils/bd-rumus'
import { fTglP } from '~/utils/format'
import BdTagChip from '~/widgets/bd/BdTagChip.vue'

const props = defineProps<{
  task: BdTask
  semua: BdTask[]
  people: BdPerson[]
  projectName?: string
  showDaily?: boolean
  dragging?: boolean
}>()
const emit = defineEmits<{ buka: [], subToggle: [ix: number, on: boolean] }>()

const sel = computed(() => selesai(props.task))
const od = computed(() => lewat(props.task))
// A Done task never reads as waiting (old `selesai(t)?[]:penghalang(t)`).
const hal = computed(() => (sel.value ? [] : penghalang(props.task, props.semua)))
const dipakai = computed(() => pics(props.task).map(id => props.people.find(p => p.id === id)).filter(Boolean) as BdPerson[])
const sub = computed(() => subHitung(props.task))
const progres = computed(() => Math.max(0, Math.min(100, Number(props.task.progress) || 0)))
/** Sub-task dropdown (`SUB_BUKA`): closed by default on the board, as in the old card. */
const subBuka = ref(false)
const nomor = useNomorWaBd()
const kontakWa = computed(() => dipakai.value
  .map(p => ({ nama: p.name, url: linkWaTask(props.task, p.name, nomor.value?.[String(p.officeUserId || '')] || '') }))
  .filter(x => x.url))
const dlSub = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)
/** The crew a sub-task is assigned to (`p`), by name — empty when unassigned. */
const namaSubPic = (id?: string) => (id ? (props.people.find(p => p.id === id)?.name || '') : '')
const namaReview = computed(() => reviewers(props.task).map(id => props.people.find(p => p.id === id)?.name || '—'))
</script>

<template>
  <div
    role="button"
    tabindex="0"
    title="Seret untuk pindah kolom"
    class="group block w-full min-w-0 cursor-grab overflow-hidden rounded-lg border border-l-[3px] bg-default px-4 py-3.5 text-start shadow-panel transition-[transform,box-shadow,border-color] duration-150 ease-laks hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
    :class="[
      hal.length ? 'border-lilac-light' : 'border-default',
      // The left edge tells the deadline at a glance: red overdue, gold due, green done.
      sel ? 'border-l-success' : od ? 'border-l-error' : task.deadline ? 'border-l-gold' : 'border-l-ink-300',
      dragging ? 'opacity-50' : '',
    ]"
    @click="emit('buka')"
    @keydown.enter.self="emit('buka')"
  >
    <span
      class="block min-w-0 break-words text-sm font-semibold leading-snug transition-colors"
      :class="sel ? 'text-muted line-through' : 'text-highlighted group-hover:text-gold-deep'"
    >{{ task.name }}</span>
    <span
      v-if="hal.length"
      class="mt-2 flex items-start gap-1 text-[11px] font-semibold text-ink-900"
    >
      <UIcon
        name="i-lucide-lock"
        class="mt-px size-3 shrink-0"
      />
      <span class="min-w-0 break-words">Menunggu: {{ hal.map(x => x.name).join(', ') }}</span>
    </span>
    <span
      v-if="namaReview.length"
      class="mt-2 flex items-start gap-1 text-[11px] font-semibold text-muted"
      :title="`Review oleh ${namaReview.join(', ')}`"
    >
      <UIcon
        name="i-lucide-eye"
        class="mt-px size-3 shrink-0"
      />
      <span class="min-w-0 break-words">Review: {{ namaReview.join(', ') }}</span>
    </span>

    <span class="mt-3 flex min-w-0 flex-wrap items-center gap-2">
      <AppStatus
        v-if="projectName"
        size="sm"
        color="vip"
        class="min-w-0 max-w-full"
        :title="projectName"
      >
        <span class="min-w-0 truncate">{{ projectName }}</span>
      </AppStatus>
      <AppStatus
        v-if="showDaily && task.daily"
        size="sm"
        color="vip"
      >
        Daily
      </AppStatus>
      <span
        v-if="dipakai.length"
        class="flex items-center -space-x-1.5"
        :title="dipakai.map(p => p.name).join(', ')"
      >
        <span
          v-for="p in dipakai.slice(0, 3)"
          :key="p.id"
          class="flex size-5 items-center justify-center rounded-full border border-default bg-yellow-light text-[9px] font-bold text-yellow-dark"
        >{{ inisial(p.name) }}</span>
        <span
          v-if="dipakai.length > 3"
          class="flex size-5 items-center justify-center rounded-full border border-default bg-muted text-[9px] font-bold text-muted"
        >+{{ dipakai.length - 3 }}</span>
      </span>
      <span
        v-else
        class="text-[11px] text-dimmed"
      >tanpa PIC</span>
      <a
        v-for="k in kontakWa"
        :key="k.url"
        :href="k.url"
        target="_blank"
        rel="noopener"
        draggable="false"
        class="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/20"
        :title="`WhatsApp ${k.nama}`"
        @click.stop
      >
        <UIcon
          name="i-lucide-message-circle"
          class="size-3"
        />{{ kontakWa.length > 1 ? k.nama.split(' ')[0] : 'WA' }}
      </a>
      <button
        v-if="sub.n"
        type="button"
        draggable="false"
        class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="sub.d === sub.n ? 'bg-success/12 text-success' : 'bg-muted text-muted'"
        :title="subBuka ? 'Tutup sub-task' : 'Lihat sub-task'"
        @click.stop="subBuka = !subBuka"
      >
        <UIcon
          name="i-lucide-list-checks"
          class="size-3"
        />
        {{ sub.d }}/{{ sub.n }}
        <UIcon
          :name="subBuka ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-3"
        />
      </button>
      <AppStatus
        v-if="sel && (task.deadline || task.doneAt)"
        size="sm"
        color="success"
        icon="i-lucide-check"
        :title="task.doneAt ? `Selesai ${fTglP(String(task.doneAt).slice(0, 10))}` : undefined"
      >
        {{ task.deadline ? fTglP(task.deadline) : 'Selesai' }}
      </AppStatus>
      <AppStatus
        v-else-if="task.deadline"
        size="sm"
        :color="od ? 'error' : 'neutral'"
        icon="i-lucide-calendar-clock"
      >
        {{ fDue(task.deadline) }}
      </AppStatus>
    </span>

    <span
      v-if="tagsOf(task).length || labelUlang(task.ulang, task.deadline)"
      class="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5"
    >
      <BdTagChip
        v-for="g in tagsOf(task)"
        :key="kunciTag(g)"
        :tag="g"
      />
      <span
        v-if="labelUlang(task.ulang, task.deadline)"
        :title="`Berulang: ${labelUlang(task.ulang, task.deadline)}`"
        class="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-muted px-2 py-px text-[10px] font-semibold text-muted"
      >
        <UIcon
          name="i-lucide-repeat"
          class="size-2.5"
        />
        {{ labelUlang(task.ulang, task.deadline) }}
      </span>
    </span>

    <span
      v-if="subBuka && subs(task).length"
      class="mt-3 grid gap-1.5 rounded-md bg-muted/50 p-2"
      @click.stop
    >
      <label
        v-for="(s, ix) in subs(task)"
        :key="`${task.id}-s${ix}`"
        class="flex min-w-0 items-center gap-2 text-xs"
      >
        <UCheckbox
          :model-value="!!s.done"
          size="sm"
          @update:model-value="(v: boolean | 'indeterminate') => emit('subToggle', ix, v === true)"
        />
        <span
          class="min-w-0 flex-1 truncate"
          :class="s.done ? 'text-muted line-through' : 'text-default'"
        >{{ s.t }}</span>
        <UIcon
          v-if="(s.note || '').trim()"
          name="i-lucide-message-square-text"
          class="size-3.5 shrink-0 text-gold-deep"
          :title="s.note"
          :aria-label="`Catatan: ${s.note}`"
        />
        <span
          v-if="lampiranSah(s.files).length"
          class="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-gold-deep"
          :title="lampiranSah(s.files).map(fl => fl.name).join(', ')"
        >
          <UIcon
            name="i-lucide-paperclip"
            class="size-3"
          />{{ lampiranSah(s.files).length }}
        </span>
        <span
          v-if="s.p && namaSubPic(s.p)"
          :title="`Di-assign ke ${namaSubPic(s.p)}`"
          class="flex size-4 shrink-0 items-center justify-center rounded-full bg-yellow-light text-[8px] font-bold text-yellow-dark"
        >{{ inisial(namaSubPic(s.p)) }}</span>
        <span
          v-if="dlSub(s.d)"
          class="shrink-0 text-[10px]"
          :class="!s.done && sisaHari(s.d) < 0 ? 'text-error' : 'text-muted'"
        >{{ s.done ? fTglP(s.d) : fDue(s.d) }}</span>
      </label>
    </span>

    <span
      v-if="sub.n"
      class="mt-3 flex items-center gap-2"
    >
      <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          class="block h-full rounded-full"
          :class="sel ? 'bg-success' : 'bar-emas'"
          :style="{ width: `${progres}%` }"
        />
      </span>
      <span class="text-[11px] font-semibold text-muted num">{{ progres }}%</span>
    </span>
  </div>
</template>
