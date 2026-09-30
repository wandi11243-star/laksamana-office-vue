<!--
  A source that could not be read is NAMED, not hidden (pitaGagal): a board
  that silently lost one module is more dangerous than one that says so.
-->
<script setup lang="ts">
import type { RadarSumber } from '~/composables/useRadar'

const props = defineProps<{ sumber?: RadarSumber[] | null }>()
const gagal = computed(() => (props.sumber ?? []).filter(s => !s.ok))
</script>

<template>
  <p
    v-if="gagal.length"
    class="mb-4 flex items-start gap-2 rounded-field border border-error/30 bg-error/10 p-3 text-sm text-default"
  >
    <UIcon
      name="i-lucide-triangle-alert"
      class="mt-0.5 size-4 shrink-0 text-error"
    />
    <span>Tidak terhubung ke <b>{{ gagal.map(g => g.nama).join(' dan ') }}</b>. Angka di halaman ini belum lengkap — jangan dipakai untuk keputusan sampai tersambung lagi.</span>
  </p>
</template>
