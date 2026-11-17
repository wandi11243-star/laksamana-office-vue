<!--
  Task rows as a tree: task, then its sub-tasks beneath (old `taskTreeRow`,
  deploy/bd/index.html:2496-2525). A caret opens the sub-tasks like a dropdown;
  sub-tasks are ticked right there without opening the form. Open state lives
  here (outside the DOM data), so a re-render never steals it.

  Shared by My Task groups and the project detail "Task & sub-task" tab.
-->
<script setup lang="ts">
import type { BdPerson, BdTask } from '~/composables/useBd'
import { fDue, inisial, kunciTag, lewat, penghalang, pics, selesai, sisaHari, subHitung, subs, tagsOf } from '~/utils/bd-rumus'
import { IKON_TASK, WARNA_TASK } from '~/utils/status-bd'
import { fTgl } from '~/utils/format'
import BdLampiranChip from '~/widgets/bd/BdLampiranChip.vue'
import BdTagChip from '~/widgets/bd/BdTagChip.vue'

const props = defineProps<{
  tasks: BdTask[]
  semua: BdTask[]
  people: BdPerson[]
  projects?: { id: string, name: string }[]
  showProject?: boolean
}>()
const emit = defineEmits<{
  buka: [t: BdTask]
  toggle: [t: BdTask]
  hapus: [t: BdTask]
  subToggle: [t: BdTask, ix: number, on: boolean]
}>()

/** Open sub-task dropdowns (`SUB_BUKA`): open by default, outside the row data. */
const buka = ref<Record<string, boolean>>({})
const terbuka = (t: BdTask) => buka.value[t.id] ?? true

const namaProject = (id?: string | null) => props.projects?.find(p => p.id === id)?.name
const dipakai = (t: BdTask) => pics(t).map(id => props.people.find(p => p.id === id)).filter(Boolean) as BdPerson[]
/** The crew a sub-task is assigned to (`p`), by name — empty when unassigned. */
const namaSubPic = (id?: string) => (id ? (props.people.find(p => p.id === id)?.name || '') : '')
const hal = (t: BdTask) => (selesai(t) ? [] : penghalang(t, props.semua))
const dlSub = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)
</script>

<template>
  <div class="divide-y divide-default">
    <template
      v-for="t in tasks"
      :key="t.id"
    >
      <div class="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
        <button
          v-if="subs(t).length"
          type="button"
          class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-elevated"
          :title="terbuka(t) ? 'Tutup sub-task' : 'Lihat sub-task'"
          @click="buka[t.id] = !terbuka(t)"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 transition-transform"
            :class="terbuka(t) ? 'rotate-90' : ''"
          />
        </button>
        <span
          v-else
          class="mt-0.5 size-6 shrink-0"
        />
        <button
          type="button"
          class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors"
          :class="selesai(t) ? 'border-success bg-success text-white' : 'border-default bg-default text-dimmed hover:border-accented'"
          :title="selesai(t) ? 'Tandai belum selesai' : 'Tandai selesai'"
          :aria-pressed="selesai(t)"
          @click="emit('toggle', t)"
        >
          <UIcon
            v-if="selesai(t)"
            name="i-lucide-check"
            class="size-3.5"
          />
        </button>
        <button
          type="button"
          class="min-w-0 flex-1 basis-48 text-start"
          @click="emit('buka', t)"
        >
          <span
            class="block font-semibold leading-snug"
            :class="selesai(t) ? 'text-muted line-through' : 'text-highlighted'"
          >{{ t.name }}</span>
          <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <AppStatus
              size="sm"
              :color="WARNA_TASK[t.status] || 'neutral'"
              :icon="IKON_TASK[t.status]"
            >{{ t.status || 'To Do' }}</AppStatus>
            <AppStatus
              v-if="showProject && t.project && namaProject(t.project)"
              size="sm"
              color="vip"
            >{{ namaProject(t.project) }}</AppStatus>
            <AppStatus
              v-if="showProject && t.daily"
              size="sm"
              color="vip"
            >Daily</AppStatus>
            <button
              v-if="subHitung(t).n"
              type="button"
              class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted"
              :title="terbuka(t) ? 'Tutup sub-task' : 'Lihat sub-task'"
              @click.stop="buka[t.id] = !terbuka(t)"
            >
              <UIcon
                name="i-lucide-list-checks"
                class="size-3"
              />
              {{ subHitung(t).d }}/{{ subHitung(t).n }} sub-task
            </button>
            <AppStatus
              v-if="hal(t).length"
              size="sm"
              color="vip"
              icon="i-lucide-lock"
              :title="`Menunggu: ${hal(t).map(x => x.name).join(', ')}`"
            >
              Menunggu {{ hal(t).length }}
            </AppStatus>
            <AppStatus
              v-if="t.start"
              size="sm"
            >
              Mulai {{ fTgl(t.start) }}
            </AppStatus>
          </span>
          <span
            v-if="tagsOf(t).length"
            class="mt-1.5 flex flex-wrap items-center gap-1"
          >
            <BdTagChip
              v-for="g in tagsOf(t)"
              :key="kunciTag(g)"
              :tag="g"
            />
          </span>
        </button>
        <span class="flex shrink-0 items-center gap-1">
          <span
            v-for="p in dipakai(t).slice(0, 3)"
            :key="p.id"
            :title="dipakai(t).map(x => x.name).join(', ')"
            class="flex size-5 items-center justify-center rounded-full border border-default bg-yellow-light text-[9px] font-bold text-yellow-dark"
          >{{ inisial(p.name) }}</span>
          <span
            v-if="dipakai(t).length > 3"
            class="flex size-5 items-center justify-center rounded-full border border-default bg-muted text-[9px] font-bold text-muted"
          >+{{ dipakai(t).length - 3 }}</span>
          <span
            v-if="!dipakai(t).length"
            class="text-[11px] text-dimmed"
          >tanpa PIC</span>
        </span>
        <span class="ms-auto shrink-0">
          <AppStatus
            v-if="selesai(t)"
            size="sm"
            color="success"
            icon="i-lucide-check"
            :title="t.doneAt ? `Selesai ${fTgl(t.doneAt)}${t.deadline ? ` · deadline ${fTgl(t.deadline)}` : ''}` : undefined"
          >
            {{ t.deadline ? fTgl(t.deadline) : (t.doneAt ? `Selesai ${fTgl(t.doneAt)}` : 'Done') }}
          </AppStatus>
          <AppStatus
            v-else-if="t.deadline"
            size="sm"
            :color="lewat(t) ? 'error' : 'neutral'"
            icon="i-lucide-calendar-clock"
          >
            {{ fDue(t.deadline) }}
          </AppStatus>
        </span>
        <span class="flex w-full items-center gap-2">
          <span class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              class="block h-full rounded-full"
              :class="selesai(t) ? 'bg-success' : 'bg-ink-900'"
              :style="{ width: `${Math.max(0, Math.min(100, Number(t.progress) || 0))}%` }"
            />
          </span>
          <span class="text-[11px] font-semibold text-muted num">{{ Math.max(0, Math.min(100, Number(t.progress) || 0)) }}%</span>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Edit"
            @click="emit('buka', t)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Hapus"
            @click="emit('hapus', t)"
          />
        </span>
      </div>
      <template v-if="subs(t).length && terbuka(t)">
        <div
          v-for="(s, ix) in subs(t)"
          :key="`${t.id}-s${ix}`"
          class="bg-muted/40 px-4 py-2 ps-16"
        >
          <div class="flex items-center gap-3">
            <UCheckbox
              :model-value="!!s.done"
              @update:model-value="(v: boolean | 'indeterminate') => emit('subToggle', t, ix, v === true)"
            />
            <span
              class="min-w-0 flex-1 truncate text-sm"
              :class="s.done ? 'text-muted line-through' : 'text-default'"
            >{{ s.t }}</span>
            <span
              v-if="s.p && namaSubPic(s.p)"
              :title="`Di-assign ke ${namaSubPic(s.p)}`"
              class="flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow-light text-[9px] font-bold text-yellow-dark"
            >{{ inisial(namaSubPic(s.p)) }}</span>
            <AppStatus
              v-if="dlSub(s.d)"
              size="sm"
              :color="s.done ? 'success' : (!s.done && sisaHari(s.d) < 0 ? 'error' : 'neutral')"
              :icon="s.done ? 'i-lucide-check' : undefined"
            >
              {{ s.done ? fTgl(s.d) : fDue(s.d) }}
            </AppStatus>
          </div>
          <!-- The step's keterangan + attachments (Nov 2026). -->
          <div
            v-if="(s.note || '').trim() || (s.files || []).length"
            class="mt-1.5 flex flex-col gap-1.5 ps-8"
          >
            <p
              v-if="(s.note || '').trim()"
              class="whitespace-pre-line text-xs text-muted"
            >
              {{ s.note }}
            </p>
            <div
              v-if="(s.files || []).length"
              class="flex flex-wrap gap-1.5"
            >
              <BdLampiranChip
                v-for="fl in s.files"
                :key="fl.key"
                :file="fl"
              />
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
