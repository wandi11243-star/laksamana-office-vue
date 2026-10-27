<!--
  One task row (old `taskRow`, deploy/bd/index.html:1430-1451), shared by the
  Dashboard, Tasks, the project detail and the "due today" list. The quadrant is
  always DERIVED from important+urgent, so it is drawn here, never stored.
-->
<script setup lang="ts">
import type { BdPerson, BdTask } from '~/composables/useBd'
import { fDue, inisial, kuadran, lewat, pics, selesai } from '~/utils/bd-rumus'
import { WARNA_KUADRAN } from '~/utils/status-bd'

const props = defineProps<{
  task: BdTask
  people: BdPerson[]
  projectName?: string
  hideQuad?: boolean
  hideDiv?: boolean
  hideProj?: boolean
}>()
const emit = defineEmits<{ buka: [], toggle: [], hapus: [] }>()

const q = computed(() => kuadran(props.task))
const od = computed(() => lewat(props.task))
const sel = computed(() => selesai(props.task))
const dipakai = computed(() => pics(props.task).map(id => props.people.find(p => p.id === id)).filter(Boolean) as BdPerson[])
const tampil = computed(() => dipakai.value.slice(0, 3))
const sisa = computed(() => dipakai.value.length - tampil.value.length)
</script>

<template>
  <div class="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated/50">
    <button
      type="button"
      class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors"
      :class="sel ? 'border-success bg-success text-white' : 'border-default bg-default text-dimmed hover:border-accented'"
      :title="sel ? 'Tandai belum selesai' : 'Tandai selesai'"
      :aria-pressed="sel"
      @click="emit('toggle')"
    >
      <UIcon
        v-if="sel"
        name="i-lucide-check"
        class="size-3.5"
      />
    </button>
    <button
      type="button"
      class="min-w-0 flex-1 text-start"
      @click="emit('buka')"
    >
      <span
        class="block font-semibold leading-snug"
        :class="sel ? 'text-muted line-through' : 'text-highlighted'"
      >{{ task.name }}</span>
      <span
        v-if="task.desc"
        class="mt-0.5 block truncate text-xs text-muted"
      >{{ task.desc }}</span>
      <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
        <AppStatus
          v-if="!hideQuad"
          :color="WARNA_KUADRAN[q.k]"
          size="sm"
        >
          {{ q.l }}
        </AppStatus>
        <AppStatus
          v-if="!hideDiv && task.div"
          size="sm"
        >
          {{ task.div }}
        </AppStatus>
        <AppStatus
          v-if="!hideProj && projectName"
          size="sm"
          color="vip"
        >
          {{ projectName }}
        </AppStatus>
        <span
          v-if="tampil.length"
          class="flex items-center -space-x-1.5"
          :title="dipakai.map(p => p.name).join(', ')"
        >
          <span
            v-for="p in tampil"
            :key="p.id"
            class="flex size-5 items-center justify-center rounded-full border border-default bg-yellow-light text-[9px] font-bold text-yellow-dark"
          >{{ inisial(p.name) }}</span>
          <span
            v-if="sisa"
            class="flex size-5 items-center justify-center rounded-full border border-default bg-muted text-[9px] font-bold text-muted"
          >+{{ sisa }}</span>
        </span>
        <span
          v-else
          class="text-[11px] text-dimmed"
        >tanpa PIC</span>
        <AppStatus
          v-if="task.type && task.type !== 'Ad-hoc'"
          size="sm"
        >
          {{ task.type }}
        </AppStatus>
        <AppStatus
          v-if="task.deadline"
          :color="od ? 'error' : 'neutral'"
          icon="i-lucide-calendar-clock"
          size="sm"
        >
          {{ fDue(task.deadline) }}
        </AppStatus>
      </span>
    </button>
    <div class="flex shrink-0 items-center gap-1">
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Edit"
        @click="emit('buka')"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Hapus"
        @click="emit('hapus')"
      />
    </div>
  </div>
</template>
