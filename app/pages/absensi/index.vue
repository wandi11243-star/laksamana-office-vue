<!--
  Example module page: Absensi > Riwayat. Shows the three patterns every module reuses:
  1. AppFocus  - the one loud block (today)
  2. list on phone, UTable on desktop, from the same rows
  3. module API calls live in composables/useAbsensi.ts
  Punching in (face + GPS) stays in the Absensi PWA for now.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ access: ['absensi'] })

const iso = (d: Date) => d.toLocaleDateString('sv-SE') // YYYY-MM-DD, local
const to = ref(iso(new Date()))
const from = ref(iso(new Date(Date.now() - 13 * 864e5)))

const { data: ctx } = useAbsensiContext()
const { data: hari, status, error } = useAbsensiRecap(from, to)
const me = useMe()
const rows = computed(() => [...hari.value].reverse())
// HR sees everyone's rows (the API decides); crew only their own.
const others = computed(() => rows.value.some(h => h.uid !== me.value?.id))

const today = computed(() => {
  const h = ctx.value?.hariIni
  if (!h?.masuk) return { value: 'Belum absen', hint: 'Absen masuk lewat aplikasi Absensi.' }
  if (!h.pulang) return { value: `Masuk ${h.masuk.jam}`, hint: `Shift ${h.shift || '—'}` }
  return { value: `${h.masuk.jam} – ${h.pulang.jam}`, hint: `Durasi ${menit(h.hitung.durasi)}` }
})

const columns = computed<TableColumn<AbsensiHari>[]>(() => [
  { accessorKey: 'tgl', header: 'Tanggal', cell: ({ row }) => tglPendek(row.original.tgl) },
  ...(others.value ? [{ accessorKey: 'nama', header: 'Nama' }] : []),
  { accessorKey: 'shift', header: 'Shift', cell: ({ row }) => row.original.shift || '—' },
  { id: 'masuk', header: 'Masuk', cell: ({ row }) => row.original.masuk?.jam ?? '—' },
  { id: 'pulang', header: 'Pulang', cell: ({ row }) => row.original.pulang?.jam ?? '—' },
  { id: 'durasi', header: 'Durasi', cell: ({ row }) => menit(row.original.hitung.durasi) },
  { id: 'status', header: 'Status' },
])
</script>

<template>
  <AppPage
    title="Absensi"
    description="Riwayat 14 hari terakhir"
  >
    <div class="mb-7 max-w-xl">
      <AppFocus
        label="Hari ini"
        :value="today.value"
        :hint="today.hint"
      />
    </div>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <!-- Phone: grouped list -->
    <AppList
      title="Riwayat"
      class="lg:hidden"
    >
      <USkeleton
        v-if="status === 'pending'"
        class="m-4 h-10"
      />
      <AppListRow
        v-for="h in rows"
        :key="h.uid + h.tgl"
        :title="others ? `${tglPendek(h.tgl)} · ${h.nama}` : tglPendek(h.tgl)"
        :description="`${h.masuk?.jam ?? '—'} – ${h.pulang?.jam ?? '—'} · ${menit(h.hitung.durasi)}`"
      >
        <template #trailing>
          <AppStatus :color="statusHari(h).color">
            {{ statusHari(h).label }}
          </AppStatus>
        </template>
      </AppListRow>
      <p
        v-if="status === 'success' && !rows.length"
        class="px-4 py-3 text-muted"
      >
        Belum ada absen di rentang ini.
      </p>
    </AppList>

    <!-- Desktop: table -->
    <div class="hidden overflow-hidden rounded-panel border border-default bg-default shadow-panel lg:block">
      <UTable
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
        empty="Belum ada absen di rentang ini."
      >
        <template #status-cell="{ row }">
          <AppStatus :color="statusHari(row.original).color">
            {{ statusHari(row.original).label }}
          </AppStatus>
        </template>
      </UTable>
    </div>
  </AppPage>
</template>
