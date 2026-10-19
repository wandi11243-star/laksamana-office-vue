<!--
  PIC filter chips (old `filterPic`, deploy/bd/index.html:1601-1613). One state
  shared by Tasks, Projects and Calendar, so setting "only Wandi" on one screen
  still holds on the next. Empty = every PIC.
-->
<script setup lang="ts">
import type { BdPerson } from '~/composables/useBd'
import { inisial } from '~/utils/bd-rumus'

const props = defineProps<{
  people: BdPerson[]
  modelValue: string[]
  /** Filter caption (`filterPic(label)`): "PIC" on project rows, "Assign" on task rows. */
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const kru = computed(() => props.people.filter(p => p.active !== false && !p.tanpaAkses))

function toggle(id: string) {
  const s = new Set(props.modelValue || [])
  if (s.has(id)) s.delete(id)
  else s.add(id)
  emit('update:modelValue', [...s])
}
</script>

<template>
  <div
    v-if="kru.length"
    class="flex flex-wrap items-center gap-1.5"
  >
    <span class="text-[11px] font-bold uppercase tracking-wider text-muted">{{ label || 'PIC' }}</span>
    <button
      v-for="p in kru"
      :key="p.id"
      type="button"
      class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition-colors"
      :class="(modelValue || []).includes(p.id)
        ? 'border-primary-400 bg-primary-100 text-primary-800'
        : 'border-default bg-muted text-muted hover:border-accented'"
      :aria-pressed="(modelValue || []).includes(p.id)"
      @click="toggle(p.id)"
    >
      <span class="flex size-4 items-center justify-center rounded-full bg-primary-100 text-[8px] font-bold text-primary-800">{{ inisial(p.name) }}</span>
      {{ p.name.split(' ')[0] }}
    </button>
    <UButton
      v-if="(modelValue || []).length"
      label="Semua PIC"
      icon="i-lucide-x"
      color="neutral"
      variant="outline"
      size="xs"
      @click="emit('update:modelValue', [])"
    />
  </div>
</template>
