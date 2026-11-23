<!--
  Log Aktivitas (deploy/akademi/index.html vLog, :1235-1243), admin only: the
  newest 120 audit entries from the state's activity trail.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { muatAkademiKru, useAkademiData } from '~/composables/useAkademi'
import type { AktivitasAkademi } from '~/composables/useAkademi'
import { tanggalJamMs } from '~/utils/akademi-hitung'

definePageMeta({ access: ['akademi'] })

const { activity, users, isAdmin } = useAkademiData()
muatAkademiKru()

const baris = computed(() => activity.value.slice(0, 120))
const namaKru = (userId: string) => users.value.find(u => u.id === userId)?.name ?? '-'

// Reimagine (B): timeline first with quick filter. Table stays for desktop
// parity, cards stay linear on phone.
const filterAksi = ref<string>('semua')
const opsiAksi = computed(() => {
  const unik = [...new Set(baris.value.map(a => a.action))]
  return [{ value: 'semua', label: 'Semua Aksi' }, ...unik.map(a => ({ value: a, label: a }))]
})
const barisTampil = computed(() => baris.value.filter(a => filterAksi.value === 'semua' || a.action === filterAksi.value))
const terakhir = computed(() => barisTampil.value[0] ?? null)

const kolom: TableColumn<AktivitasAkademi>[] = [
  { accessorKey: 'ts', id: 'waktu', header: 'Waktu' },
  { id: 'kru', header: 'Kru' },
  { accessorKey: 'action', id: 'aksi', header: 'Aksi' },
  { accessorKey: 'detail', id: 'detail', header: 'Detail' },
]
</script>

<template>
  <AppPage
    title="Log activity"
    description="Jejak audit training (500 terakhir)"
  >
    <AppPanel
      v-if="!isAdmin"
      title="Khusus admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Log hanya untuk admin modul Akademi.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Terakhir terjadi"
        icon="i-lucide-play"
      >
        <p
          v-if="terakhir"
          class="text-[13px] text-muted"
        >
          {{ tanggalJamMs(terakhir.ts) }} · {{ namaKru(terakhir.userId) }} · {{ terakhir.action }}{{ terakhir.detail ? `, ${terakhir.detail}` : '' }}
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Belum ada aktivitas pada filter ini.
        </p>
        <AppChips
          v-model="filterAksi"
          :options="opsiAksi"
          class="mt-3"
        />
      </AppPanel>

      <AppPanel
        title="Aktivitas"
        icon="i-lucide-clock"
        :count="barisTampil.length"
        flush
      >
        <div class="hidden lg:block">
          <UTable
            :data="barisTampil"
            :columns="kolom"
          >
            <template #waktu-cell="{ row }">
              <span class="whitespace-nowrap">{{ tanggalJamMs(row.original.ts) }}</span>
            </template>
            <template #kru-cell="{ row }">
              {{ namaKru(row.original.userId) }}
            </template>
            <template #aksi-cell="{ row }">
              <AppStatus
                color="neutral"
                icon="i-lucide-activity"
                size="sm"
              >
                {{ row.original.action }}
              </AppStatus>
            </template>
          </UTable>
        </div>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="(a, i) in barisTampil"
            :key="i"
            class="px-4 py-3"
          >
            <p class="text-xs text-muted">
              {{ tanggalJamMs(a.ts) }} · {{ namaKru(a.userId) }}
            </p>
            <p class="mt-0.5 font-semibold text-highlighted">
              {{ a.action }}
            </p>
            <p class="text-sm text-muted">
              {{ a.detail }}
            </p>
          </div>
          <p
            v-if="!barisTampil.length"
            class="px-4 py-3 text-sm text-muted"
          >
            Belum ada aktivitas.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
