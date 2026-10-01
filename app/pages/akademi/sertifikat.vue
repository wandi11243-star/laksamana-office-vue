<!--
  Progress & Sertifikat (deploy/akademi/index.html vSertifikat, :1135-1161): the
  certificate when all mandatory materials are done, otherwise the progress
  towards it, then the table of mandatory materials.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { muatAkademiKru, useAkademiData } from '~/composables/useAkademi'
import type { MateriAkademi } from '~/composables/useAkademi'
import { materiUntuk, namaDivisi, selesaiMateri, statKru, tanggalMs } from '~/utils/akademi-hitung'
import { statusTipe } from '~/utils/status-akademi'

definePageMeta({ access: ['akademi'] })

const { me, materials, progress, divisions, kru } = useAkademiData()
muatAkademiKru()

const st = computed(() => (kru.value ? statKru(kru.value, materials.value, progress.value) : null))
const matsWajib = computed(() => (kru.value ? materiUntuk(kru.value, materials.value).filter(m => m.mandatory) : []))
const divisiNama = computed(() => namaDivisi(divisions.value, kru.value?.division ?? 'all'))

const kolom: TableColumn<MateriAkademi>[] = [
  { id: 'materi', header: 'Materi Wajib' },
  { id: 'tipe', header: 'Tipe' },
  { id: 'status', header: 'Status' },
  { id: 'skor', header: 'Skor' },
  { id: 'selesai', header: 'Selesai' },
]

const progresMateri = (m: MateriAkademi) => progress.value[kru.value?.id ?? '']?.[m.id] ?? null
const tanggalSertifikat = tanggalMs(Date.now())
const cetak = () => window.print()
</script>

<template>
  <AppPage
    title="Progress & Sertifikat"
    description="Jejak trainingmu di Akademi Laksamana"
  >
    <template
      v-if="st?.certified"
      #actions
    >
      <UButton
        label="Cetak Sertifikat"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        @click="cetak"
      />
    </template>

    <!-- Certificate -->
    <div
      v-if="st?.certified"
      class="mb-5 rounded-panel border-2 border-primary-400 bg-default p-6 text-center shadow-panel"
    >
      <p class="text-[11px] font-bold uppercase tracking-widest text-muted">
        Akademi Laksamana, Sertifikat Standar Kru
      </p>
      <p class="mt-4 text-xs text-muted">
        Diberikan kepada
      </p>
      <p class="font-display text-3xl font-bold text-highlighted">
        {{ me?.name }}
      </p>
      <p class="text-[13px] font-bold text-primary-700">
        {{ kru?.title ? `${kru.title}, ` : '' }}{{ divisiNama }}
      </p>
      <p class="mx-auto mt-3 max-w-md text-[12.5px] text-muted">
        Telah menyelesaikan seluruh materi wajib ({{ st.mandTotal }} materi) dan memenuhi standar layanan Laksamana Muda Coffee & Live Space.
      </p>
      <p class="mt-4 text-xs font-bold">
        {{ tanggalSertifikat }}, Pekanbaru
      </p>
      <UIcon
        name="i-lucide-anchor"
        class="mt-2 size-6 text-primary-700"
      />
    </div>

    <!-- Progress towards it -->
    <AppPanel
      v-else-if="st"
      title="Menuju Sertifikasi"
      icon="i-lucide-award"
    >
      <div class="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          class="h-full rounded-full bg-primary-400"
          :style="{ width: `${st.mandPct}%` }"
        />
      </div>
      <p class="mt-3 text-[13px] text-muted">
        {{ st.mandDone }} dari {{ st.mandTotal }} materi wajib selesai. Selesaikan semua untuk mendapatkan sertifikat kru.
      </p>
    </AppPanel>

    <AppPanel
      title="Materi Wajib"
      icon="i-lucide-flag"
      :count="matsWajib.length"
      flush
    >
      <!-- Desktop table -->
      <div class="hidden lg:block">
        <UTable
          :data="matsWajib"
          :columns="kolom"
        >
          <template #materi-cell="{ row }">
            <span class="font-semibold">{{ row.original.title }}</span>
          </template>
          <template #tipe-cell="{ row }">
            <AppStatus
              :color="statusTipe(row.original.type).tone"
              :icon="statusTipe(row.original.type).icon"
              size="sm"
            >
              {{ statusTipe(row.original.type).label }}
            </AppStatus>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="selesaiMateri(kru?.id ?? '', row.original, progress) ? 'success' : 'warning'"
              :icon="selesaiMateri(kru?.id ?? '', row.original, progress) ? 'i-lucide-circle-check' : 'i-lucide-clock'"
              size="sm"
            >
              {{ selesaiMateri(kru?.id ?? '', row.original, progress) ? 'Selesai' : 'Belum' }}
            </AppStatus>
          </template>
          <template #skor-cell="{ row }">
            {{ progresMateri(row.original)?.score != null ? `${progresMateri(row.original)!.score}%` : '—' }}
          </template>
          <template #selesai-cell="{ row }">
            {{ tanggalMs(progresMateri(row.original)?.completedAt) }}
          </template>
        </UTable>
      </div>
      <!-- Phone cards -->
      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="m in matsWajib"
          :key="m.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ m.title }}
            </p>
            <p class="text-xs text-muted">
              {{ statusTipe(m.type).label }} · Skor {{ progresMateri(m)?.score ?? '—' }}{{ progresMateri(m)?.score != null ? '%' : '' }}
            </p>
          </div>
          <AppStatus
            :color="selesaiMateri(kru?.id ?? '', m, progress) ? 'success' : 'warning'"
            :icon="selesaiMateri(kru?.id ?? '', m, progress) ? 'i-lucide-circle-check' : 'i-lucide-clock'"
            size="sm"
          >
            {{ selesaiMateri(kru?.id ?? '', m, progress) ? 'Selesai' : 'Belum' }}
          </AppStatus>
        </div>
        <p
          v-if="!matsWajib.length"
          class="px-4 py-3 text-sm text-muted"
        >
          Belum ada materi wajib untuk divisimu.
        </p>
      </div>
    </AppPanel>
  </AppPage>
</template>
