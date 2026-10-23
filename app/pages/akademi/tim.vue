<!--
  Progress Tim (deploy/akademi/index.html vTim, :1164-1194) for manager+:
  module admins see the whole ship, a PIC sees their division. The Detail sheet
  opens one crew's material-by-material trail.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { muatAkademiKru, useAkademiData } from '~/composables/useAkademi'
import type { KruAkademi, MateriAkademi } from '~/composables/useAkademi'
import { materiUntuk, namaDivisi, selesaiMateri, statKru, tanggalJamMs } from '~/utils/akademi-hitung'
import { ikonDivisi } from '~/utils/akademi-konstanta'
import { statusKru, statusTipe } from '~/utils/status-akademi'

definePageMeta({ access: ['akademi'] })

const { materials, progress, divisions, kru, isAdmin, isManager } = useAkademiData()
muatAkademiKru()

const scope = computed(() => {
  if (!isManager.value) return []
  const dasar = isAdmin.value
    ? usersAktif()
    : usersAktif().filter(k => k.division === kru.value?.division)
  return dasar.sort((a, b) => a.name.localeCompare(b.name))
})

function usersAktif(): KruAkademi[] {
  const list = useAkademiKru().value
  return list.filter(k => k.active)
}

const stat = (k: KruAkademi) => statKru(k, materials.value, progress.value)
const judul = computed(() => (isAdmin.value ? 'Seluruh kru kapal' : namaDivisi(divisions.value, kru.value?.division ?? 'all')))

const kolom: TableColumn<KruAkademi>[] = [
  { id: 'kru', header: 'Kru' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'wajib', header: 'Wajib' },
  { id: 'progress', header: 'Progress' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
]

// Detail sheet
const bukaDetail = ref(false)
const dipilih = ref<KruAkademi | null>(null)
function detail(k: KruAkademi) {
  dipilih.value = k
  bukaDetail.value = true
}
const materiKru = computed(() => (dipilih.value ? materiUntuk(dipilih.value, materials.value) : []))
const progresKru = (m: MateriAkademi) => progress.value[dipilih.value?.id ?? '']?.[m.id] ?? null
const itemSelesai = (m: MateriAkademi) => (dipilih.value ? selesaiMateri(dipilih.value.id, m, progress.value) : false)

// Reimagine (B): actionable queue. The three lowest-progress crew are the
// focal nudge list, the full table stays as the archive.
const dorongTiga = computed(() => [...scope.value]
  .map(k => ({ k, s: stat(k) }))
  .filter(x => x.s.mandTotal > 0)
  .sort((a, b) => a.s.mandPct - b.s.mandPct)
  .slice(0, 3))

const kolomDetail: TableColumn<MateriAkademi>[] = [
  { id: 'materi', header: 'Materi' },
  { id: 'wajib', header: 'Wajib' },
  { id: 'status', header: 'Status' },
  { id: 'skor', header: 'Skor' },
  { id: 'waktu', header: 'Waktu' },
]
</script>

<template>
  <AppPage
    title="Progress Tim"
    :description="judul"
  >
    <AppPanel
      v-if="isManager && dorongTiga.length"
      title="Perlu didorong dulu"
      icon="i-lucide-trending-down"
      :count="dorongTiga.length"
    >
      <div class="divide-y divide-default">
        <div
          v-for="x in dorongTiga"
          :key="x.k.id"
          class="flex flex-wrap items-center justify-between gap-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ x.k.name }}
            </p>
            <p class="text-[11px] text-muted">
              {{ namaDivisi(divisions, x.k.division) }} · {{ x.s.mandDone }}/{{ x.s.mandTotal }} wajib · {{ x.s.mandPct }}%
            </p>
          </div>
          <UButton
            label="Lihat detail"
            size="sm"
            @click="detail(x.k)"
          />
        </div>
      </div>
    </AppPanel>

    <AppPanel
      v-if="!isManager"
      title="Khusus PIC divisi & manajemen"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Halaman ini untuk PIC divisi (peran manager) dan admin modul Akademi.
      </p>
    </AppPanel>

    <AppPanel
      v-else
      :title="`Kru aktif (${scope.length})`"
      icon="i-lucide-users"
      flush
    >
      <div class="hidden lg:block">
        <UTable
          :data="scope"
          :columns="kolom"
        >
          <template #kru-cell="{ row }">
            <b>{{ row.original.name }}</b>
            <div class="text-[11px] text-muted">
              {{ row.original.title || '' }}
            </div>
          </template>
          <template #divisi-cell="{ row }">
            <span class="inline-flex items-center gap-1">
              <UIcon
                :name="ikonDivisi(divisions, row.original.division)"
                class="size-4 text-muted"
              />
              {{ namaDivisi(divisions, row.original.division) }}
            </span>
          </template>
          <template #wajib-cell="{ row }">
            {{ stat(row.original).mandDone }}/{{ stat(row.original).mandTotal }}
          </template>
          <template #progress-cell="{ row }">
            <div class="min-w-[130px]">
              <div class="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary-400"
                  :style="{ width: `${stat(row.original).mandPct}%` }"
                />
              </div>
              <div class="mt-1 text-[11px] text-muted">
                {{ stat(row.original).mandPct }}%
              </div>
            </div>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="statusKru(stat(row.original)).tone"
              :icon="statusKru(stat(row.original)).icon"
              size="sm"
            >
              {{ statusKru(stat(row.original)).label }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              label="Detail"
              size="sm"
              color="neutral"
              variant="outline"
              @click="detail(row.original)"
            />
          </template>
        </UTable>
      </div>
      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="k in scope"
          :key="k.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ k.name }}
            </p>
            <p class="text-xs text-muted">
              {{ namaDivisi(divisions, k.division) }} · {{ stat(k).mandDone }}/{{ stat(k).mandTotal }} wajib · {{ stat(k).mandPct }}%
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <AppStatus
              :color="statusKru(stat(k)).tone"
              :icon="statusKru(stat(k)).icon"
              size="sm"
            >
              {{ statusKru(stat(k)).label }}
            </AppStatus>
            <UButton
              label="Detail"
              size="sm"
              color="neutral"
              variant="outline"
              @click="detail(k)"
            />
          </div>
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="bukaDetail"
      :title="dipilih?.name ?? 'Detail kru'"
      :description="dipilih ? `${dipilih.title || ''}${dipilih.title ? ', ' : ''}${namaDivisi(divisions, dipilih.division)}` : undefined"
    >
      <div class="hidden lg:block">
        <UTable
          :data="materiKru"
          :columns="kolomDetail"
        >
          <template #materi-cell="{ row }">
            <span class="inline-flex items-center gap-1.5 font-semibold">
              <UIcon
                :name="statusTipe(row.original.type).icon"
                class="size-4 text-muted"
              />
              {{ row.original.title }}
            </span>
          </template>
          <template #wajib-cell="{ row }">
            <UIcon
              v-if="row.original.mandatory"
              name="i-lucide-circle-check"
              class="size-4 text-success"
            />
            <span v-else>—</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              v-if="itemSelesai(row.original)"
              color="success"
              icon="i-lucide-circle-check"
              size="sm"
            >
              Selesai
            </AppStatus>
            <AppStatus
              v-else-if="progresKru(row.original)?.attempts"
              color="warning"
              icon="i-lucide-repeat"
              size="sm"
            >
              {{ progresKru(row.original)!.attempts }}× coba
            </AppStatus>
            <AppStatus
              v-else
              color="neutral"
              icon="i-lucide-circle"
              size="sm"
            >
              Belum
            </AppStatus>
          </template>
          <template #skor-cell="{ row }">
            {{ progresKru(row.original)?.score != null ? `${progresKru(row.original)!.score}%` : '—' }}
          </template>
          <template #waktu-cell="{ row }">
            {{ tanggalJamMs(progresKru(row.original)?.completedAt ?? progresKru(row.original)?.lastAt) }}
          </template>
        </UTable>
      </div>
      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="m in materiKru"
          :key="m.id"
          class="flex items-center justify-between gap-2 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">
              {{ m.title }}
            </p>
            <p class="text-[11px] text-muted">
              {{ statusTipe(m.type).label }} · {{ progresKru(m)?.score != null ? `Skor ${progresKru(m)!.score}%` : 'belum ada skor' }}
            </p>
          </div>
          <AppStatus
            :color="itemSelesai(m) ? 'success' : 'neutral'"
            :icon="itemSelesai(m) ? 'i-lucide-circle-check' : 'i-lucide-circle'"
            size="sm"
          >
            {{ itemSelesai(m) ? 'Selesai' : 'Belum' }}
          </AppStatus>
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
