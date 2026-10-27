<!--
  Multi-PIC picker (task & project). Every PIC is equal — there is no "main PIC".
  A crew member whose access was revoked still shows when they are already a PIC
  of the open row, so editing an old row never silently drops them (`:1715-1727`).
-->
<script setup lang="ts">
import type { BdPerson } from '~/composables/useBd'
import { inisial } from '~/utils/bd-rumus'

const props = defineProps<{
  people: BdPerson[]
  modelValue: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const tersedia = computed(() => {
  const sudah = props.modelValue || []
  return props.people.filter(p => (p.active !== false && !p.tanpaAkses) || sudah.includes(p.id))
})

function toggle(id: string) {
  const s = new Set(props.modelValue || [])
  if (s.has(id)) s.delete(id)
  else s.add(id)
  emit('update:modelValue', [...s])
}
</script>

<template>
  <div>
    <p
      v-if="!tersedia.length"
      class="text-sm text-muted"
    >
      Belum ada kru dengan akses modul ini — beri akses lewat Office › Kelola Akses.
    </p>
    <div
      v-else
      class="flex flex-wrap gap-2"
    >
      <button
        v-for="p in tersedia"
        :key="p.id"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-semibold transition-colors"
        :class="(modelValue || []).includes(p.id)
          ? 'border-yellow-deep bg-yellow-light text-highlighted'
          : 'border-default bg-default text-muted hover:border-accented'"
        :aria-pressed="(modelValue || []).includes(p.id)"
        @click="toggle(p.id)"
      >
        <span class="flex size-5 items-center justify-center rounded-full bg-yellow-light text-[10px] font-bold text-yellow-dark">{{ inisial(p.name) }}</span>
        {{ p.name }}
        <span
          v-if="p.tanpaAkses"
          class="text-[10px] text-error"
        >dicabut</span>
      </button>
    </div>
  </div>
</template>
