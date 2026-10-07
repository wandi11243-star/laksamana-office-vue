<!--
  One table of the Jadwal dashboard (Masuk / Tidak masuk): UTable on desktop,
  cards below `lg`. A row opens the cell editor only where this person may
  write that Divisi (`bolehUbah`).
-->
<script setup lang="ts" generic="R extends { u: KruJadwal, c: SelJadwal, no: number }">
import type { TableColumn } from '@nuxt/ui'
import type { KruJadwal, PeranJadwal, SelJadwal, SettingJadwal } from '~/utils/jadwal'
import { bolehUbah, jamSel, labelSel, namaDivisiJadwal, shiftDef } from '~/utils/jadwal'

const props = defineProps<{
  rows: R[]
  columns: TableColumn<R>[]
  set: SettingJadwal
  peran: PeranJadwal
  tgl: string
  jabatan: (u: KruJadwal) => string
  loading?: boolean
  empty: string
}>()
const emit = defineEmits<{ pilih: [r: R] }>()

const klik = (r: R) => bolehUbah(props.peran, r.u.divisi)
const jam = (r: R) => {
  const j = jamSel(props.set, r.c)
  return j ? `${j.m} – ${j.s}` : '—'
}
</script>

<template>
  <UTable
    class="hidden lg:block"
    :data="rows"
    :columns="columns"
    :loading="loading"
    :empty="empty"
    :meta="{ class: { tr: (row: { original: R }) => (klik(row.original) ? 'cursor-pointer' : '') } }"
    @select="(_e: Event, row: { original: R }) => klik(row.original) && emit('pilih', row.original)"
  >
    <template #no-cell="{ row }">
      <span class="text-muted num">{{ row.original.no }}</span>
    </template>
    <template #nama-cell="{ row }">
      <p class="font-semibold text-highlighted">
        {{ row.original.u.name }}
      </p>
      <p class="text-[13px] text-muted">
        {{ jabatan(row.original.u) }}
      </p>
    </template>
    <template #divisi-cell="{ row }">
      {{ namaDivisiJadwal(row.original.u.divisi) }}
    </template>
    <template #shift-cell="{ row }">
      <JadwalShiftPil
        :def="shiftDef(set, row.original.c.t)"
        :label="labelSel(set, row.original.c)"
        size="sm"
      />
    </template>
    <template #jam-cell="{ row }">
      <span class="num">{{ jam(row.original) }}</span>
    </template>
  </UTable>

  <div class="divide-y divide-default lg:hidden">
    <component
      :is="klik(r) ? 'button' : 'div'"
      v-for="r in rows"
      :key="r.u.id"
      type="button"
      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      :class="klik(r) && 'hover:bg-muted/60'"
      @click="klik(r) && emit('pilih', r)"
    >
      <div class="min-w-0">
        <p class="truncate font-semibold text-highlighted">
          <span class="me-2 text-muted num">{{ r.no }}</span>{{ r.u.name }}
        </p>
        <p class="text-sm text-muted">
          {{ namaDivisiJadwal(r.u.divisi) }}<template v-if="columns.some(c => c.id === 'jam')">
            · <span class="num">{{ jam(r) }}</span>
          </template>
        </p>
      </div>
      <JadwalShiftPil
        :def="shiftDef(set, r.c.t)"
        :label="labelSel(set, r.c)"
        size="sm"
      />
    </component>
    <p
      v-if="!rows.length"
      class="px-4 py-8 text-center text-muted"
    >
      {{ empty }}
    </p>
  </div>
</template>
