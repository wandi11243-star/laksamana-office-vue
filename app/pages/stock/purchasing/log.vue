<!--
  Stock › Log Aktivitas (old `deploy/stock/purchasing/index.html:208-209,1000-…`).

  Admin only. One log for every Stock module (Ordering, Purchasing, Jadwal …):
  the module filter lists whatever the log holds (`meta.modul`). Paged on the
  server — `GET /stock/logs?page=&per_page=` + `meta.total` — like the
  Reservasi audit log; search waits 300 ms after the last key.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LogStock } from '~/composables/useStock'
import { listLogsHalaman } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { isAdminOf } from '~/composables/useMe'
import { angka, jam, tglPendek } from '~/utils/format'

definePageMeta({ access: ['purchasing'] })

const me = useMe()
const admin = computed(() => isAdminOf(me.value, 'purchasing'))

const dari = ref('')
const ke = ref('')
const modul = ref('semua')
const q = ref('')

const qTunda = ref('')
let tundaQ: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => {
  clearTimeout(tundaQ)
  tundaQ = setTimeout(() => {
    qTunda.value = v.trim()
  }, 300)
})

// --- server paging ----------------------------------------------------------------

const hal = ref(1)
const perHal = ref(25)
const kosong = { rows: [] as LogStock[], total: 0, page: 1, modul: [] as string[] }
// `GET /stock/logs` is admin-only on the server; non-admins see the notice instead.
const daftarQ = useAsyncData('stock-log-hal', () => !admin.value
  ? Promise.resolve(kosong)
  : listLogsHalaman({
      dari: dari.value || undefined,
      ke: ke.value || undefined,
      modul: modul.value === 'semua' ? undefined : modul.value,
      q: qTunda.value || undefined,
      page: hal.value,
      perPage: perHal.value,
    }), {
  watch: [dari, ke, modul, qTunda, hal, perHal, admin],
  default: () => kosong,
})
const daftar = computed(() => daftarQ.data.value?.rows ?? [])
const total = computed(() => daftarQ.data.value?.total ?? 0)
/** A new filter starts on page one; the server clamps a page past the end. */
watch([dari, ke, modul, qTunda, perHal], () => {
  hal.value = 1
})
watch(() => daftarQ.data.value?.page, (p) => {
  if (p && p !== hal.value) hal.value = p
})

const LABEL_MODUL: Record<string, string> = { ordering: 'Ordering', purchasing: 'Purchasing', jadwal: 'Jadwal jemput', usage: 'Pemakaian', hpp: 'HPP', breakloss: 'Break & Loss' }
const labelModul = (m?: string) => (m ? LABEL_MODUL[m] ?? m.charAt(0).toUpperCase() + m.slice(1) : '—')
const opsiModul = computed(() => [
  { value: 'semua', label: 'Semua bagian' },
  ...[...new Set([...(daftarQ.data.value?.modul ?? []), ...(modul.value !== 'semua' ? [modul.value] : [])])]
    .map(m => ({ value: m, label: labelModul(m) })),
])

const waktuOf = (l: LogStock) => (l.waktu ? `${tglPendek(l.waktu)} ${jam(l.waktu)}` : '—')

const kolom: TableColumn<LogStock>[] = [
  { accessorKey: 'waktu', header: 'Waktu' },
  { accessorKey: 'modul', header: 'Bagian' },
  { accessorKey: 'aktor', header: 'Aktor' },
  { accessorKey: 'tim', header: 'Tim' },
  { accessorKey: 'aksi', header: 'Aksi' },
  { accessorKey: 'ringkas', header: 'Ringkas' },
]

function reset() {
  dari.value = ''
  ke.value = ''
  modul.value = 'semua'
  q.value = ''
}
</script>

<template>
  <AppPage
    title="Log Aktivitas"
    description="Siapa mengubah apa di modul Stock — terbaru dulu"
  >
    <template
      v-if="admin"
      #actions
    >
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        variant="outline"
        :loading="daftarQ.status.value === 'pending'"
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

    <template v-else>
      <UAlert
        v-if="daftarQ.error.value"
        class="mb-5"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Log tidak terbaca"
        :description="apiErrorMessage(daftarQ.error.value)"
      />

      <AppPanel title="Filter">
        <template #actions>
          <UButton
            label="Reset"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="reset"
          />
        </template>
        <AppFilterGrid>
          <UFormField label="Dari">
            <UInput
              v-model="dari"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sampai">
            <UInput
              v-model="ke"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Bagian">
            <USelect
              v-model="modul"
              :items="opsiModul"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Cari">
            <UInput
              v-model="q"
              icon="i-lucide-search"
              placeholder="Ringkas / aktor / aksi / tim…"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <p class="mt-3 text-sm text-muted">
          <b class="text-highlighted num">{{ angka(total) }}</b> aktivitas
          <template v-if="qTunda">
            cocok dengan “{{ qTunda }}”
          </template>
        </p>
      </AppPanel>

      <AppPanel
        title="Aktivitas"
        flush
      >
        <div class="hidden lg:block">
          <UTable
            :columns="kolom"
            :data="daftar"
            :loading="daftarQ.status.value === 'pending'"
            empty="Belum ada aktivitas pada filter ini."
          >
            <template #waktu-cell="{ row }">
              <span class="whitespace-nowrap text-muted">{{ waktuOf(row.original) }}</span>
            </template>
            <template #modul-cell="{ row }">
              <AppStatus
                size="sm"
                :color="row.original.modul === 'purchasing' ? 'gold' : row.original.modul === 'ordering' ? 'info' : 'neutral'"
              >
                {{ labelModul(row.original.modul) }}
              </AppStatus>
            </template>
            <template #aktor-cell="{ row }">
              <span class="font-semibold text-highlighted">{{ row.original.aktor || '—' }}</span>
            </template>
            <template #tim-cell="{ row }">
              {{ row.original.tim || '—' }}
            </template>
            <template #ringkas-cell="{ row }">
              <span class="whitespace-normal">{{ row.original.ringkas || '—' }}</span>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 p-3 lg:hidden">
          <div
            v-for="(l, i) in daftar"
            :key="l.id || `${l.waktu}-${i}`"
            class="rounded-xl border border-default p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <b class="text-highlighted">{{ l.aksi }}</b>
              <AppStatus
                size="sm"
                :color="l.modul === 'purchasing' ? 'gold' : l.modul === 'ordering' ? 'info' : 'neutral'"
              >
                {{ labelModul(l.modul) }}
              </AppStatus>
            </div>
            <p class="mt-1 text-sm text-default">
              {{ l.ringkas || '—' }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ l.aktor }}{{ l.tim ? ` · ${l.tim}` : '' }} · {{ waktuOf(l) }}
            </p>
          </div>
          <p
            v-if="!daftar.length"
            class="text-sm text-dimmed"
          >
            Belum ada aktivitas pada filter ini.
          </p>
        </div>
        <div class="px-3 pb-3 lg:px-4">
          <AppPager
            v-model:page="hal"
            v-model:per="perHal"
            :total="total"
            satuan="aktivitas"
          />
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
