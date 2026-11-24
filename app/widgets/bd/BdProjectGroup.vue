<script setup lang="ts">
import { warnaKategori } from '~/utils/kategori-warna'

defineProps<{
  nama?: string
  warna?: string
}>()
</script>

<template>
  <span
    v-if="nama?.trim()"
    class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold"
    :class="warnaKategori(nama, warna)"
    :title="'Grup bisnis: ' + nama"
  >
    <UIcon
      name="i-lucide-building-2"
      class="size-3 shrink-0"
    />
    <span class="truncate">{{ nama }}</span>
  </span>
</template>
