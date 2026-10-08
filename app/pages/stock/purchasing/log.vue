<!--
  Stock › Purchasing › Log Aktivitas (old `deploy/stock/purchasing/index.html:208-209,1000-…`).

  Admin only. Newest first; filters dari/ke/modul/q/limit (default 300, max 2000).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LogStock } from '~/composables/useStock'
import { listLogs } from '~/composables/useStock'
import { isAdminOf } from '~/composables/useMe'
import { jam, tglPendek } from '~/utils/format'

definePageMeta({ access: ['purchasing'] })

const me = useMe()
const admin = computed(() => isAdminOf(me.value, 'purchasing'))

const dari = ref('')
const ke = ref('')
const modul = ref('semua')
const q = ref('')
const limit = ref(300)

const daftarQ = useAsyncData('stock-log', () => listLogs({
  dari: dari.value || undefined,
  ke: ke.value || undefined,
  modul: modul.value === 'semua' ? undefined : modul.value,
  q: q.value.trim() || undefined,
  limit: limit.value,
}), {
  watch: [dari, ke, modul, limit],
  default: () => ({ rows: [] as LogStock[] }),
})
const semua = computed(() => {
  const s = q.value.trim().toLowerCase()
  const rows = daftarQ.data.value?.rows ?? []
  return s ? rows.filter(l => [l.ringkas, l.aktor, l.aksi].join(' ').toLowerCase().includes(s)) : rows
})
let tunda: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(tunda)
  tunda = setTimeout(() => daftarQ.refresh(), 400)
})

const kolom: TableColumn<LogStock>[] = [
  { accessorKey: 'waktu', header: 'Waktu' },
  { accessorKey: 'aktor', header: 'Aktor' },
  { accessorKey: 'aksi', header: 'Aksi' },
  { accessorKey: 'ringkas', header: 'Ringkas' },
]
</script>

<template>
  <AppPage
    title="Log Aktivitas"
    description="Siapa mengubah apa di stock — terbaru dulu"
  >
    <template
      v-if="admin"
      #actions
    >
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="daftarQ.refresh()"
      />
    </template>

    <AppPanel
      v-if="!admin"
      title="Khusus admin"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Log Aktivitas hanya untuk admin Purchasing.
      </p>
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Filter"
    >
      <AppFilterGrid>
        <UFormField label="Dari">
          <UInput
            v-model="dari"
            type="date"
          />
        </UFormField>
        <UFormField label="Sampai">
          <UInput
            v-model="ke"
            type="date"
          />
        </UFormField>
        <UFormField label="Modul">
          <USelect
            v-model="modul"
            :items="[
              { value: 'semua', label: 'Semua' },
              { value: 'ordering', label: 'Ordering' },
              { value: 'purchasing', label: 'Purchasing' },
            ]"
          />
        </UFormField>
        <UFormField label="Cari">
          <UInput
            v-model="q"
            icon="i-lucide-search"
            placeholder="Ringkas / aktor / aksi…"
          />
        </UFormField>
        <UFormField label="Batas">
          <USelect
            v-model="limit"
            :items="[100, 300, 1000, 2000].map(n => ({ value: n, label: String(n) }))"
          />
        </UFormField>
      </AppFilterGrid>
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Aktivitas"
      flush
    >
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="semua"
        >
          <template #waktu-cell="{ row }">
            {{ row.original.waktu ? `${tglPendek(row.original.waktu)} ${jam(row.original.waktu)}` : '—' }}
          </template>
          <template #ringkas-cell="{ row }">
            <span class="whitespace-normal">{{ row.original.ringkas || '—' }}</span>
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 p-3 lg:hidden">
        <div
          v-for="(l, i) in semua.slice(0, 100)"
          :key="`${l.waktu}-${i}`"
          class="rounded-panel border border-default p-3"
        >
          <b class="text-highlighted">{{ l.aksi }}</b>
          <p class="text-sm text-default">
            {{ l.ringkas || '—' }}
          </p>
          <p class="text-sm text-muted">
            {{ l.aktor }}{{ l.waktu ? ` · ${tglPendek(l.waktu)} ${jam(l.waktu)}` : '' }}
          </p>
        </div>
        <p
          v-if="!semua.length"
          class="text-sm text-dimmed"
        >
          Belum ada aktivitas pada filter ini.
        </p>
      </div>
    </AppPanel>
  </AppPage>
</template>
