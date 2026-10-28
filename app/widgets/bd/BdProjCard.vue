<!--
  One card of the Projects kanban (old `projCard`, deploy/bd/index.html:1922-1932).
  Progress is COMPUTED from the project's tasks; the end date shows overdue in red.
-->
<script setup lang="ts">
import type { BdPerson, BdProject, BdTask } from '~/composables/useBd'
import { inisial, pics, projProgress, sisaHari } from '~/utils/bd-rumus'
import { IKON_HEALTH, LABEL_HEALTH, WARNA_HEALTH, divTone } from '~/utils/status-bd'
import { fTglP } from '~/utils/format'

const props = withDefaults(defineProps<{
  project: BdProject
  tasks: BdTask[]
  people: BdPerson[]
  tampilkanPindah?: boolean
}>(), { tampilkanPindah: true })
const emit = defineEmits<{ buka: [], pindah: [] }>()

const pg = computed(() => projProgress(props.project, props.tasks))
const nt = computed(() => props.tasks.filter(t => t.project === props.project.id).length)
const dl = computed(() => sisaHari(props.project.end))
const dpakai = computed(() => pics(props.project).map(id => props.people.find(p => p.id === id)).filter(Boolean) as BdPerson[])
</script>

<template>
  <div class="rounded-panel border border-default bg-default p-3 shadow-panel">
    <button
      type="button"
      class="w-full text-start"
      @click="emit('buka')"
    >
      <span class="block font-semibold leading-snug text-highlighted">{{ project.name }}</span>
      <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
        <AppStatus
          size="sm"
          :color="divTone(project.div)"
        >{{ project.div }}</AppStatus>
        <AppStatus
          :color="WARNA_HEALTH[project.health] || 'success'"
          :icon="IKON_HEALTH[project.health]"
          size="sm"
        >{{ LABEL_HEALTH[project.health] || 'On track' }}</AppStatus>
      </span>
      <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          v-for="p in dpakai.slice(0, 3)"
          :key="p.id"
          class="flex size-5 items-center justify-center rounded-full border border-default bg-yellow-light text-[9px] font-bold text-yellow-dark"
        >{{ inisial(p.name) }}</span>
        <span
          v-if="nt"
          class="text-[11px] text-muted"
        >{{ nt }} task</span>
        <AppStatus
          size="sm"
          :color="dl < 0 ? 'error' : 'neutral'"
        >{{ dl < 0 ? `${Math.abs(dl)}h lewat` : fTglP(project.end) }}</AppStatus>
      </span>
      <span class="mt-2 flex items-center gap-2">
        <span class="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            class="block h-full rounded-full"
            :class="pg >= 100 ? 'bg-success' : 'bg-ink-900'"
            :style="{ width: `${pg}%` }"
          />
        </span>
        <span class="text-xs font-semibold text-muted num">{{ pg }}%</span>
      </span>
    </button>
    <UButton
      v-if="tampilkanPindah"
      label="Pindah stage"
      icon="i-lucide-arrow-right-left"
      color="neutral"
      variant="ghost"
      size="xs"
      class="mt-1"
      @click="emit('pindah')"
    />
  </div>
</template>
