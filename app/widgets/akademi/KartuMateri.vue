<!--
  One material card, the old `.mat-card` (deploy/akademi/index.html:934-945):
  type icon + title, the type / Wajib / score / division pills, and a
  "Selesai" or "Mode Baca" badge when relevant. Clicking it opens the viewer.
-->
<script setup lang="ts">
import type { DivisiAkademi, MateriAkademi } from '~/composables/useAkademi'
import { ikonDivisi } from '~/utils/akademi-konstanta'
import { statusTipe } from '~/utils/status-akademi'

const props = defineProps<{
  materi: MateriAkademi
  selesai?: boolean
  modeBaca?: boolean
  skor?: number | null
  divisions?: DivisiAkademi[]
}>()

const emit = defineEmits<{ buka: [id: string] }>()

const tipe = computed(() => statusTipe(props.materi.type))
const divisi = computed(() => props.divisions ?? [])
</script>

<template>
  <button
    type="button"
    class="group relative flex w-full flex-col rounded-panel border border-default bg-default p-4 text-start shadow-panel transition-colors hover:border-accented focus-visible:outline-2 focus-visible:outline-primary"
    @click="emit('buka', materi.id)"
  >
    <span
      class="flex items-start justify-between gap-2"
    >
      <UIcon
        :name="tipe.icon"
        class="size-6 shrink-0"
        :class="tipe.tone === 'gold' ? 'text-primary-700' : 'text-muted'"
      />
      <AppStatus
        v-if="selesai"
        color="success"
        icon="i-lucide-circle-check"
        size="sm"
      >
        Selesai
      </AppStatus>
      <AppStatus
        v-else-if="modeBaca"
        color="info"
        icon="i-lucide-book-open"
        size="sm"
      >
        Mode Baca
      </AppStatus>
    </span>
    <span class="mt-2 line-clamp-2 min-h-10 font-semibold text-highlighted">{{ materi.title }}</span>
    <span class="mt-2 flex flex-wrap items-center gap-1.5">
      <AppStatus
        :color="tipe.tone"
        :icon="tipe.icon"
        size="sm"
      >
        {{ tipe.label }}
      </AppStatus>
      <AppStatus
        v-if="materi.mandatory"
        color="error"
        icon="i-lucide-flag"
        size="sm"
      >
        Wajib
      </AppStatus>
      <AppStatus
        v-if="skor != null"
        color="info"
        icon="i-lucide-target"
        size="sm"
      >
        Skor {{ skor }}%
      </AppStatus>
      <span
        v-for="d in materi.division"
        :key="d"
        class="inline-flex items-center"
        :title="d === 'all' ? 'Semua Divisi' : d"
      >
        <UIcon
          :name="ikonDivisi(divisi, d)"
          class="size-3.5 text-dimmed"
        />
      </span>
    </span>
  </button>
</template>
