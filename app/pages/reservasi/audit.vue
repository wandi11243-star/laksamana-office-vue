<!--
  Audit Log — append-only and trimmed by the server (newest 500). Search
  across user, role, action and detail; paging on the server (G-08:
  `GET /audit` with q/page/perPage + meta.total). Only a trace CARRYING a
  reservation id links anywhere — a link that guesses by name could open
  someone else's booking (`:10728-10753`). Deleted rows keep their trace:
  the link goes to the input page, which reports a missing row itself.
  Source: laksamana-office/deploy/reservasi/index.html:10717-10773.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AuditRow } from '~/composables/useReservasi'
import { listAuditHalaman } from '~/composables/useReservasi'
import { ROLE_LABEL_RESERVASI, bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import { angka } from '~/utils/format'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const role = computed(() => roleReservasi(me.value))

const q = ref('')

/** Typing searches on the server, 300 ms after the last key. */
const qTunda = ref('')
let tundaQ: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => {
  clearTimeout(tundaQ)
  tundaQ = setTimeout(() => {
    qTunda.value = v.trim()
  }, 300)
}, { immediate: true })

// --- server paging (G-08) --------------------------------------------------------

const hal = ref(1)
const perHal = ref(10)
const { data: halAudit, status } = useAsyncData(
  'reservasi-audit-hal',
  () => listAuditHalaman(qTunda.value || undefined, hal.value, perHal.value),
  { watch: [qTunda, hal, perHal] },
)
const daftar = computed(() => halAudit.value?.data ?? [])
const total = computed(() => Number(halAudit.value?.meta?.total ?? daftar.value.length))
const maxHal = computed(() => Math.max(1, Math.ceil(total.value / perHal.value)))
/** A new search starts on page one; the server clamps a page past the end. */
watch([qTunda, perHal], () => {
  hal.value = 1
})
watch(() => halAudit.value?.meta?.page, (p) => {
  if (p && p !== hal.value) hal.value = p
})

const capWaktu = (ts: number) => ts
  ? new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-'

const kolom = computed<TableColumn<AuditRow>[]>(() => [
  { accessorKey: 'ts', header: 'Waktu' },
  { accessorKey: 'user', header: 'User' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'action', header: 'Aksi' },
  { accessorKey: 'detail', header: 'Detail' },
])
</script>

<template>
  <AppPage
    title="Log activity"
    description="Jejak seluruh aktivitas: siapa, kapan, apa yang diubah. Untuk akuntabilitas & kontrol data DP."
  >
    <template v-if="bolehBuka('audit', role)">
      <div class="mb-5 max-w-xl">
        <UFormField label="Cari nama tamu, kru, aksi, atau keterangan…">
          <UInput
            v-model="q"
            placeholder="Cari nama tamu, kru, aksi, atau keterangan…"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <p class="mt-1 text-sm text-muted">
          <template v-if="qTunda">
            <b>{{ angka(total) }}</b> baris cocok dengan “{{ qTunda }}”.
          </template>
          <template v-else>
            <b>{{ angka(total) }}</b> baris terakhir.
          </template>
          Reservasi yang <b>dibatalkan atau dihapus</b> tetap punya jejaknya di sini — cari namanya.
          Yang tersimpan <b>500 baris terakhir</b>.
        </p>
      </div>

      <div class="mb-7 hidden overflow-hidden rounded-panel border border-default bg-default shadow-panel lg:block">
        <UTable
          :data="daftar"
          :columns="kolom"
          :loading="status === 'pending'"
          empty="Belum ada aktivitas tercatat."
        >
          <template #ts-cell="{ row }">
            <span class="text-muted">{{ capWaktu(row.original.ts) }}</span>
          </template>
          <template #user-cell="{ row }">
            <span class="font-semibold">{{ row.original.user }}</span>
          </template>
          <template #role-cell="{ row }">
            <span class="text-muted">{{ ROLE_LABEL_RESERVASI[row.original.role as keyof typeof ROLE_LABEL_RESERVASI] || row.original.role }}</span>
          </template>
          <template #action-cell="{ row }">
            <ULink
              v-if="row.original.res"
              :to="`/reservasi/input?id=${row.original.res}`"
              class="underline-offset-4 hover:underline"
            >
              {{ row.original.action }}
            </ULink>
            <span v-else>{{ row.original.action }}</span>
          </template>
          <template #detail-cell="{ row }">
            {{ row.original.detail }}
          </template>
        </UTable>
      </div>

      <AppList
        title="Jejak"
        class="lg:hidden"
      >
        <AppListRow
          v-for="a in daftar"
          :key="a.id"
          :title="`${a.action} — ${a.user}`"
          :description="`${capWaktu(a.ts)}${a.detail ? ` · ${a.detail}` : ''}`"
          icon="i-lucide-shield"
          :to="a.res ? `/reservasi/input?id=${a.res}` : undefined"
        />
        <p
          v-if="!daftar.length"
          class="px-4 py-3 text-muted"
        >
          {{ qTunda ? `Tidak ada jejak yang cocok dengan “${qTunda}”.` : 'Belum ada aktivitas tercatat.' }}
        </p>
      </AppList>

      <AppList title="Halaman">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
          <div class="flex items-center gap-2 text-sm text-muted">
            <span>Baris per halaman</span>
            <USelect
              v-model.number="perHal"
              :items="[10, 25, 50]"
              class="w-20"
            />
          </div>
          <div class="flex items-center gap-2 text-sm text-muted">
            <UButton
              label="Sebelumnya"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="hal <= 1"
              @click="hal--"
            />
            <span class="num">Hal {{ hal }} dari {{ maxHal }}</span>
            <UButton
              label="Berikutnya"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="hal >= maxHal"
              @click="hal++"
            />
          </div>
        </div>
      </AppList>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
