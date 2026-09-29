<!--
  What the Denah's colours mean. Status is a dot + words, never a coloured box
  (DESIGN.md). The dots match the ones drawn inside the tables: yellow is
  "picked", green "confirmed", amber "pending / too close", red "arrived".
-->
<script setup lang="ts">
withDefaults(defineProps<{
  /** Hide the first row (the free table) when a screen only ever picks. */
  zona?: boolean
}>(), { zona: true })

interface Baris {
  /** A colour swatch for a zone, or a status dot. */
  dot: boolean
  kelas: string
  label: string
}

const baris: Baris[] = [
  { dot: false, kelas: 'bg-seat-wood', label: 'Kosong — klik untuk memilih' },
  { dot: false, kelas: 'ring-2 ring-primary', label: 'Terpilih' },
  { dot: true, kelas: 'text-highlighted', label: 'Sharing — bisa gabung' },
  { dot: true, kelas: 'text-warning', label: 'Pending' },
  { dot: true, kelas: 'text-success', label: 'Confirmed' },
  { dot: true, kelas: 'text-error', label: 'Datang — sedang diduduki' },
  { dot: true, kelas: 'text-muted', label: 'Terkunci — dipesan mepet, belum bisa dipakai' },
]
</script>

<template>
  <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
    <li
      v-for="b in baris.slice(zona ? 0 : 1)"
      :key="b.label"
      class="inline-flex items-center gap-1.5"
    >
      <span
        v-if="!b.dot"
        class="size-3 rounded-sm"
        :class="b.kelas"
        aria-hidden="true"
      />
      <span
        v-else
        class="size-2 rounded-full bg-current"
        :class="b.kelas"
        aria-hidden="true"
      />
      {{ b.label }}
    </li>
  </ul>
</template>
