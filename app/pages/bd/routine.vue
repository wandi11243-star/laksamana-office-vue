<!--
  BD OS › Routine (old `vRoutine`, deploy/bd/index.html:2196-2274). Three numbers,
  then a table. Average compliance is over ACTIVE routines; one routine with no
  `total` counts as fully compliant, exactly like the old client.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BdRoutine } from '~/composables/useBd'
import { bdSimpan, hapusBd, useBdState, versiBaris } from '~/composables/useBd'
import { cariAku, inisial, kepatuhanBaris, kepatuhanRoutine, kuadran, orangById } from '~/utils/bd-rumus'
import { WARNA_KUADRAN } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdRoutineSheet from '~/widgets/bd/BdRoutineSheet.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, status } = useBdState()
const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))

const aktif = computed(() => state.value.routines.filter(r => r.active))
const rate = computed(() => kepatuhanRoutine(state.value.routines))
const lewatTotal = computed(() => aktif.value.reduce((s, r) => s + (Number(r.missed) || 0), 0))

/** First-load skeleton for the three recap cards below: skeleton cells stand
 *  in until the first state lands. Refetch keeps old numbers, so the cards
 *  never blank. */
const statMemuat = computed(() => !state.value.routines.length && (status.value === 'pending' || status.value === 'idle'))

const kolom: TableColumn<BdRoutine>[] = [
  { accessorKey: 'name', header: 'Routine' },
  { accessorKey: 'div', header: 'Divisi' },
  { accessorKey: 'freq', header: 'Frekuensi' },
  { accessorKey: 'pic', header: 'PIC' },
  { id: 'eisenhower', header: 'Eisenhower' },
  { id: 'kepatuhan', header: 'Kepatuhan' },
  { accessorKey: 'active', header: 'Status' },
  { id: 'aksi', header: '' },
]

const bukaRoutine = ref(false)
const routinePilih = ref<BdRoutine | null>(null)
const routineHapus = ref<BdRoutine | null>(null)
const hapusMau = computed({
  get: () => !!routineHapus.value,
  set: (v) => {
    if (!v) routineHapus.value = null
  },
})

function baru() {
  routinePilih.value = null
  bukaRoutine.value = true
}
function buka(r: BdRoutine) {
  routinePilih.value = r
  bukaRoutine.value = true
}
async function hapus() {
  const r = routineHapus.value
  if (!r) return
  routineHapus.value = null
  await bdSimpan(() => hapusBd('routines', r.id, versiBaris(r)), 'Routine dihapus')
}
</script>

<template>
  <AppPage
    title="Routine"
    description="Task berulang & kepatuhannya."
  >
    <template #actions>
      <UButton
        label="Routine"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>

    <AppStatGrid
      :loading="statMemuat"
      :count="3"
    >
      <AppStat
        label="Routine aktif"
        icon="i-lucide-repeat"
        :value="aktif.length"
        :sub="`${state.routines.length - aktif.length} nonaktif`"
      />
      <AppStat
        label="Kepatuhan"
        icon="i-lucide-percent"
        :tone="rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'error'"
        :value="`${rate}%`"
        sub="rata-rata periode ini"
      />
      <AppStat
        label="Terlewat"
        icon="i-lucide-triangle-alert"
        :tone="lewatTotal ? 'warning' : 'success'"
        :value="lewatTotal"
        sub="total periode ini"
      />
    </AppStatGrid>

    <AppPanel
      v-if="!state.routines.length"
    >
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Belum ada routine</b>
        Task berulang seperti rekap mingguan atau cek stok harian didaftarkan di sini.
      </p>
    </AppPanel>

    <template v-else>
      <div class="grid gap-3 lg:hidden">
        <div
          v-for="r in state.routines"
          :key="r.id"
          class="rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel lg:px-5"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="min-w-0 flex-1 text-start"
              @click="buka(r)"
            >
              <span class="block font-semibold text-highlighted">{{ r.name }}</span>
              <span class="mt-1 block text-xs text-muted">
                {{ r.div }} · {{ r.freq }}{{ r.time ? ` · ${r.time}` : '' }} · {{ orangById(people, r.pic).name }}
              </span>
            </button>
            <AppStatus
              :color="r.active ? 'success' : 'neutral'"
              size="sm"
            >
              {{ r.active ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <AppStatus
              :color="WARNA_KUADRAN[kuadran(r).k]"
              size="sm"
            >
              {{ kuadran(r).l }}
            </AppStatus>
            <AppStatus size="sm">
              {{ kepatuhanBaris(r) }}%
            </AppStatus>
            <AppStatus
              v-if="Number(r.missed)"
              color="error"
              size="sm"
            >
              {{ r.missed }} lewat
            </AppStatus>
            <UButton
              label="Hapus"
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              size="xs"
              @click="routineHapus = r"
            />
          </div>
        </div>
      </div>

      <AppPanel
        class="hidden lg:block"
        flush
      >
        <UTable
          :data="state.routines"
          :columns="kolom"
          :meta="{ class: { tr: 'cursor-pointer' } }"
          @select="(_e: Event, row: { original: BdRoutine }) => buka(row.original)"
        >
          <template #name-cell="{ row }">
            <b class="text-highlighted">{{ row.original.name }}</b>
          </template>
          <template #div-cell="{ row }">
            <AppStatus size="sm">
              {{ row.original.div }}
            </AppStatus>
          </template>
          <template #freq-cell="{ row }">
            <span class="text-muted">{{ row.original.freq }}{{ row.original.time ? ` · ${row.original.time}` : '' }}</span>
          </template>
          <template #pic-cell="{ row }">
            <span class="flex items-center gap-1.5">
              <span class="flex size-5 items-center justify-center rounded-full bg-yellow-light text-[9px] font-bold text-yellow-dark">{{ inisial(orangById(people, row.original.pic).name) }}</span>
              {{ orangById(people, row.original.pic).name }}
            </span>
          </template>
          <template #eisenhower-cell="{ row }">
            <AppStatus
              :color="WARNA_KUADRAN[kuadran(row.original).k]"
              size="sm"
            >
              {{ kuadran(row.original).l }}
            </AppStatus>
          </template>
          <template #kepatuhan-cell="{ row }">
            <span class="flex items-center gap-2">
              <span class="h-2 w-20 overflow-hidden rounded-full bg-muted">
                <span
                  class="block h-full rounded-full"
                  :class="kepatuhanBaris(row.original) >= 90 ? 'bg-success' : 'bg-ink-900'"
                  :style="{ width: `${kepatuhanBaris(row.original)}%` }"
                />
              </span>
              <span class="text-xs font-semibold text-muted num">{{ kepatuhanBaris(row.original) }}%</span>
              <span
                v-if="Number(row.original.missed)"
                class="text-xs text-error"
              >· {{ row.original.missed }} lewat</span>
            </span>
          </template>
          <template #active-cell="{ row }">
            <AppStatus
              :color="row.original.active ? 'success' : 'neutral'"
              size="sm"
            >
              {{ row.original.active ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Hapus"
              @click.stop="routineHapus = row.original"
            />
          </template>
        </UTable>
      </AppPanel>
    </template>

    <BdRoutineSheet
      v-model:open="bukaRoutine"
      :routine="routinePilih"
      :people="people"
      :aku="aku"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus routine ini beserta catatan kepatuhannya?"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
