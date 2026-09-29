<!--
  Audit Log — the newest 500 rows, newest first, append-only and trimmed by
  the server. Search across user, role, action and detail; paging in the
  browser (G-08). Only a trace CARRYING a reservation id links anywhere — a
  link that guesses by name could open someone else's booking
  (`:10728-10753`). Deleted rows keep their trace: the link goes to the input
  page, which reports a missing row itself.
  Source: laksamana-office/deploy/reservasi/index.html:10717-10773.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AuditRow } from '~/composables/useReservasi'
import { useAudit } from '~/composables/useReservasi'
import { ROLE_LABEL_RESERVASI, bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import { angka } from '~/utils/format'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const role = computed(() => roleReservasi(me.value))

const { data: semua, status } = useAudit()

const q = ref('')

const cocok = (a: AuditRow, kata: string) => {
  if (!kata) return true
  return [a.user, ROLE_LABEL_RESERVASI[a.role as keyof typeof ROLE_LABEL_RESERVASI] || a.role, a.action, a.detail]
    .some(v => String(v == null ? '' : v).toLowerCase().includes(kata))
}

const daftar = computed(() => {
  const kata = q.value.trim().toLowerCase()
  return (semua.value ?? []).filter(a => cocok(a, kata))
})

// --- client paging (G-08) ------------------------------------------------------

const hal = ref(1)
const perHal = ref(10)
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.length / perHal.value)))
const halaman = computed(() => daftar.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([daftar, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
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
    title="Audit log"
    description="Jejak seluruh aktivitas: siapa, kapan, apa yang diubah. Untuk akuntabilitas & kontrol data DP."
    :back="{ label: 'Semua layar', to: '/reservasi' }"
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
          <template v-if="q">
            <b>{{ angka(daftar.length) }}</b> dari {{ angka((semua ?? []).length) }} baris cocok dengan “{{ q }}”.
          </template>
          Reservasi yang <b>dibatalkan atau dihapus</b> tetap punya jejaknya di sini — cari namanya.
          Yang tersimpan <b>500 baris terakhir</b>.
        </p>
      </div>

      <div class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block">
        <UTable
          :data="halaman"
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
          v-for="a in halaman"
          :key="a.id"
          :title="`${a.action} — ${a.user}`"
          :description="`${capWaktu(a.ts)}${a.detail ? ` · ${a.detail}` : ''}`"
          icon="i-lucide-shield"
          :to="a.res ? `/reservasi/input?id=${a.res}` : undefined"
        />
        <p
          v-if="!halaman.length"
          class="px-4 py-3 text-muted"
        >
          {{ q ? `Tidak ada jejak yang cocok dengan “${q}”.` : 'Belum ada aktivitas tercatat.' }}
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
