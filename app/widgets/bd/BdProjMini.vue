<!--
  The compact project row of the Dashboard (old `projMini`, deploy/bd/index.html:1552-1562).
  Progress is COMPUTED from the project's tasks (fallback milestones).
-->
<script setup lang="ts">
import type { BdPerson, BdProject, BdTask } from '~/composables/useBd'
import { inisial, pics, projProgress, sisaHari } from '~/utils/bd-rumus'
import { IKON_HEALTH, LABEL_HEALTH, WARNA_HEALTH, divTone } from '~/utils/status-bd'
import { fTglP } from '~/utils/format'

const props = defineProps<{
  project: BdProject
  tasks: BdTask[]
  people: BdPerson[]
}>()
const emit = defineEmits<{ buka: [] }>()

const pg = computed(() => projProgress(props.project, props.tasks))
const dl = computed(() => sisaHari(props.project.end))
const dpakai = computed(() => pics(props.project).map(id => props.people.find(p => p.id === id)).filter(Boolean) as BdPerson[])
</script>

<template>
  <button
    type="button"
    class="w-full px-4 py-3 text-start transition-colors hover:bg-elevated/50"
    @click="emit('buka')"
  >
    <span class="flex flex-wrap items-center gap-2">
      <span class="font-semibold text-highlighted">{{ project.name }}</span>
      <AppStatus
        :color="WARNA_HEALTH[project.health] || 'success'"
        :icon="IKON_HEALTH[project.health]"
        size="sm"
      >
        {{ LABEL_HEALTH[project.health] || 'On track' }}
      </AppStatus>
    </span>
    <span class="mt-1.5 flex items-center gap-2">
      <span class="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          class="block h-full rounded-full"
          :class="pg >= 100 ? 'bg-success' : 'bg-ink-900'"
          :style="{ width: `${pg}%` }"
        />
      </span>
      <span class="text-xs font-semibold text-muted num">{{ pg }}%</span>
    </span>
    <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span
        v-for="p in dpakai.slice(0, 3)"
        :key="p.id"
        class="flex size-5 items-center justify-center rounded-full border border-default bg-yellow-light text-[9px] font-bold text-yellow-dark"
      >{{ inisial(p.name) }}</span>
      <AppStatus
        size="sm"
        :color="divTone(project.div)"
      >
        {{ project.stage }}
      </AppStatus>
      <AppStatus
        size="sm"
        :color="dl < 0 ? 'error' : 'neutral'"
      >
        {{ dl < 0 ? `${Math.abs(dl)}h lewat` : `${dl}h lagi` }} · {{ fTglP(project.end) }}
      </AppStatus>
    </span>
  </button>
</template>
