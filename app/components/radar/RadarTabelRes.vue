<!--
  Reservation list of Radar (tabelRes / the Reservasi table): a table on
  desktop, cards on a phone, 20 per page. `tanggal` adds the date column (the
  Reservasi screen spans days); the DP column only exists when the API sent
  money (a Head). Rows open the read-only panel.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RadarReservasi } from '~/composables/useRadar'
import { dpTeks, iris, warnaStatusRes } from '~/utils/radar'
import { fTglP } from '~/utils/format'

const props = defineProps<{
  list: RadarReservasi[]
  tanggal?: boolean
  bolehUang?: boolean
  kosong?: string
}>()
const emit = defineEmits<{ buka: [r: RadarReservasi] }>()

const hal = ref(1)
watch(() => props.list, () => {
  hal.value = 1
})
const halaman = computed(() => iris(props.list, hal.value))

const kolom = computed<TableColumn<RadarReservasi>[]>(() => [
  ...(props.tanggal ? [{ accessorKey: 'date', header: 'Tanggal' }] : []),
  { accessorKey: 'time', header: 'Jam' },
  { accessorKey: 'name', header: 'Tamu' },
  { accessorKey: 'pax', header: 'Pax' },
  { accessorKey: 'table', header: 'Meja' },
  { accessorKey: 'category', header: 'Kategori' },
  ...(props.bolehUang ? [{ accessorKey: 'dp', header: 'DP' }] : []),
  { accessorKey: 'status', header: 'Status' },
])
</script>

<template>
  <div>
    <UTable
      class="hidden lg:block"
      :data="halaman"
      :columns="kolom"
      :meta="{ class: { tr: 'cursor-pointer' } }"
      :empty="kosong || 'Belum ada reservasi.'"
      @select="(_e: Event, row: { original: RadarReservasi }) => emit('buka', row.original)"
    >
      <template #date-cell="{ row }">
        {{ fTglP(row.original.date) }}
      </template>
      <template #time-cell="{ row }">
        <span class="num">{{ row.original.time || '—' }}</span>
      </template>
      <template #name-cell="{ row }">
        <p class="font-semibold text-highlighted">
          {{ row.original.name || '—' }}
          <AppStatus
            v-if="row.original.vip"
            color="vip"
            icon="i-lucide-crown"
            size="sm"
          >
            VIP
          </AppStatus>
        </p>
        <p
          v-if="row.original.notes"
          class="max-w-72 truncate text-[13px] text-muted"
        >
          {{ row.original.notes }}
        </p>
      </template>
      <template #pax-cell="{ row }">
        <b class="num">{{ Number(row.original.pax) || 0 }}</b>
      </template>
      <template #table-cell="{ row }">
        {{ row.original.table || '—' }}
      </template>
      <template #category-cell="{ row }">
        {{ row.original.category || '—' }}
      </template>
      <template #dp-cell="{ row }">
        <AppStatus
          :color="dpTeks(row.original).ada ? 'success' : 'neutral'"
          size="sm"
        >
          {{ dpTeks(row.original).teks }}
        </AppStatus>
      </template>
      <template #status-cell="{ row }">
        <AppStatus
          :color="warnaStatusRes(row.original)"
          size="sm"
        >
          {{ row.original.status || '—' }}
        </AppStatus>
      </template>
    </UTable>

    <div class="divide-y divide-default lg:hidden">
      <button
        v-for="r in halaman"
        :key="r.id"
        type="button"
        class="flex min-h-11 w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/60"
        @click="emit('buka', r)"
      >
        <span class="min-w-0">
          <span class="block truncate font-semibold text-highlighted">{{ r.name || '—' }}</span>
          <span class="block text-sm text-muted num">{{ tanggal ? `${fTglP(r.date)} · ` : '' }}{{ r.time || '--:--' }} · {{ Number(r.pax) || 0 }} pax{{ r.table ? ` · ${r.table}` : '' }}</span>
          <span
            v-if="bolehUang"
            class="mt-1 block"
          >
            <AppStatus
              :color="dpTeks(r).ada ? 'success' : 'neutral'"
              size="sm"
            >DP {{ dpTeks(r).teks }}</AppStatus>
          </span>
        </span>
        <AppStatus
          :color="warnaStatusRes(r)"
          size="sm"
        >
          {{ r.status || '—' }}
        </AppStatus>
      </button>
      <p
        v-if="!halaman.length"
        class="px-4 py-6 text-center text-muted"
      >
        {{ kosong || 'Belum ada reservasi.' }}
      </p>
    </div>
    <RadarPager
      v-model="hal"
      :total="list.length"
      satuan="booking"
    />
  </div>
</template>
