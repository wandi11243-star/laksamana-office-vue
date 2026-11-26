<!--
  BD OS › Koordinasi (old `vCoord`, deploy/bd/index.html:2085-2193). A board and a
  table of the SAME rows. This records OUR requests to other divisions, not the
  tasks of the destination division. On a phone the board scrolls and each card
  can be moved with a status sheet.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BdCoord } from '~/composables/useBd'
import { bdSimpan, bdTulisDiam, hapusBd, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import { COORD_FLOW, cariAku, fDue, sisaHari } from '~/utils/bd-rumus'
import { IKON_COORD, IKON_PRIO, WARNA_COORD, WARNA_PRIO } from '~/utils/status-bd'
import BdCoordSheet from '~/widgets/bd/BdCoordSheet.vue'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const mode = useState<'board' | 'tabel'>('bd-coord-mode', () => 'board')

const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const namaProject = (id?: string | null) => state.value.projects.find(p => p.id === id)?.name
const diKolom = (st: string) => state.value.coord.filter(c => c.status === st)

const kolom: TableColumn<BdCoord>[] = [
  { accessorKey: 'title', header: 'Request' },
  { accessorKey: 'fromDiv', header: 'Dari' },
  { accessorKey: 'toDiv', header: 'Ke' },
  { accessorKey: 'to', header: 'PIC tujuan' },
  { accessorKey: 'priority', header: 'Prioritas' },
  { accessorKey: 'due', header: 'Due' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
]

// ---- move status ----
async function pindahStatus(c: BdCoord, st: string) {
  if (c.status === st) return
  await bdTulisDiam(() => tambalBd<BdCoord>('coord-requests', c.id, { status: st }, versiBaris(c)))
}

let dragId: string | null = null
function dragMulai(e: DragEvent, c: BdCoord) {
  dragId = c.id
  e.dataTransfer?.setData('text/plain', c.id)
}
function dropKolom(st: string) {
  const c = state.value.coord.find(x => x.id === dragId)
  dragId = null
  if (c) pindahStatus(c, st)
}

const statusSheet = ref(false)
const statusPilih = ref<BdCoord | null>(null)
const statusBaru = ref('Diminta')
function bukaStatus(c: BdCoord) {
  statusPilih.value = c
  statusBaru.value = c.status
  statusSheet.value = true
}
async function simpanStatus() {
  const c = statusPilih.value
  if (!c) return
  await pindahStatus(c, statusBaru.value)
  statusSheet.value = false
}

// ---- sheet & delete ----
const bukaCoord = ref(false)
const coordPilih = ref<BdCoord | null>(null)
const coordHapus = ref<BdCoord | null>(null)
const hapusMau = computed({
  get: () => !!coordHapus.value,
  set: (v) => {
    if (!v) coordHapus.value = null
  },
})

function baru() {
  coordPilih.value = null
  bukaCoord.value = true
}
function buka(c: BdCoord) {
  coordPilih.value = c
  bukaCoord.value = true
}
async function hapus() {
  const c = coordHapus.value
  if (!c) return
  coordHapus.value = null
  await bdSimpan(() => hapusBd('coord-requests', c.id, versiBaris(c)), 'Request dihapus')
}
</script>

<template>
  <AppPage
    title="Koordinasi Antar-Divisi"
    description="Request & follow-up ke divisi lain."
  >
    <template #actions>
      <AppSeg
        v-model="mode"
        :options="[{ value: 'board', label: 'Board', icon: 'i-lucide-columns-3' }, { value: 'tabel', label: 'Tabel', icon: 'i-lucide-table' }]"
        size="sm"
      />
      <UButton
        label="Request"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>

    <p class="mb-5 rounded-xl border border-info/30 bg-info/10 p-3 text-sm">
      Tim BD/Project/Purchasing meminta pekerjaan ke divisi lain (Kitchen, Bar, Marketing, dll) — lacak dari
      <b>Diminta → Diproses → Review → Selesai</b>. Ini catatan permintaan kita, bukan task divisi tujuan:
      mereka mengerjakannya di modulnya masing-masing.
    </p>

    <template v-if="mode === 'board'">
      <AppPapan
        class="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-4"
      >
        <section
          v-for="st in COORD_FLOW"
          :key="st"
          class="min-w-0 rounded-panel border border-default bg-muted/40"
          @dragover.prevent
          @drop="dropKolom(st)"
        >
          <header class="flex items-center justify-between border-b border-default px-3 py-2">
            <span class="text-sm font-bold text-highlighted">{{ st }}</span>
            <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-ink-900 num">{{ diKolom(st).length }}</span>
          </header>
          <div class="grid content-start gap-2 p-2 lg:max-h-[min(68dvh,640px)] lg:overflow-y-auto [scrollbar-width:thin]">
            <div
              v-for="c in diKolom(st)"
              :key="c.id"
              draggable="true"
              class="rounded-panel border border-default bg-default p-3 shadow-panel"
              @dragstart="dragMulai($event, c)"
            >
              <button
                type="button"
                class="w-full text-start"
                @click="buka(c)"
              >
                <span class="block font-semibold leading-snug text-highlighted">{{ c.title }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-1.5">
                  <AppStatus size="sm">{{ c.fromDiv?.split(' ')[0] }}</AppStatus>
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="size-3 text-dimmed"
                  />
                  <AppStatus size="sm">{{ c.toDiv }}</AppStatus>
                </span>
                <span class="mt-1 flex flex-wrap items-center gap-1.5">
                  <AppStatus
                    :color="WARNA_PRIO[c.priority] || 'neutral'"
                    :icon="IKON_PRIO[c.priority]"
                    size="sm"
                  >{{ c.priority }}</AppStatus>
                  <AppStatus
                    v-if="c.to"
                    size="sm"
                  >{{ c.to }}</AppStatus>
                  <AppStatus
                    size="sm"
                    :color="c.status !== 'Selesai' && sisaHari(c.due) < 0 ? 'error' : 'neutral'"
                  >{{ fDue(c.due) }}</AppStatus>
                </span>
                <span
                  v-if="namaProject(c.project)"
                  class="mt-1 flex"
                >
                  <AppStatus
                    color="vip"
                    size="sm"
                  >{{ namaProject(c.project) }}</AppStatus>
                </span>
              </button>
              <UButton
                label="Pindah status"
                icon="i-lucide-arrow-right-left"
                color="neutral"
                variant="ghost"
                size="xs"
                class="mt-1"
                @click="bukaStatus(c)"
              />
            </div>
          </div>
        </section>
      </AppPapan>
    </template>

    <AppPanel
      v-else-if="!state.coord.length"
    >
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Belum ada request</b>
      </p>
    </AppPanel>

    <template v-else>
      <div class="grid gap-3 lg:hidden">
        <div
          v-for="c in state.coord"
          :key="c.id"
          class="rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel lg:px-5"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="min-w-0 flex-1 text-start"
              @click="buka(c)"
            >
              <span class="block font-semibold text-highlighted">{{ c.title }}</span>
              <span class="mt-1 block text-xs text-muted">{{ c.fromDiv }} → {{ c.toDiv }} · {{ c.to || '—' }}</span>
            </button>
            <AppStatus
              :color="WARNA_COORD[c.status] || 'neutral'"
              :icon="IKON_COORD[c.status]"
              size="sm"
            >
              {{ c.status }}
            </AppStatus>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <AppStatus
              :color="WARNA_PRIO[c.priority] || 'neutral'"
              size="sm"
            >
              {{ c.priority }}
            </AppStatus>
            <AppStatus
              size="sm"
              :color="c.status !== 'Selesai' && sisaHari(c.due) < 0 ? 'error' : 'neutral'"
            >
              {{ fDue(c.due) }}
            </AppStatus>
            <UButton
              label="Hapus"
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              size="xs"
              @click="coordHapus = c"
            />
          </div>
        </div>
      </div>

      <AppPanel
        class="hidden lg:block"
        flush
      >
        <UTable
          :data="state.coord"
          :columns="kolom"
          :meta="{ class: { tr: 'cursor-pointer' } }"
          @select="(_e: Event, row: { original: BdCoord }) => buka(row.original)"
        >
          <template #title-cell="{ row }">
            <b class="text-highlighted">{{ row.original.title }}</b>
          </template>
          <template #fromDiv-cell="{ row }">
            <AppStatus size="sm">
              {{ String(row.original.fromDiv || '').split(' ')[0] }}
            </AppStatus>
          </template>
          <template #toDiv-cell="{ row }">
            <AppStatus size="sm">
              {{ row.original.toDiv }}
            </AppStatus>
          </template>
          <template #to-cell="{ row }">
            <span class="text-muted">{{ row.original.to || '—' }}</span>
          </template>
          <template #priority-cell="{ row }">
            <AppStatus
              :color="WARNA_PRIO[row.original.priority] || 'neutral'"
              :icon="IKON_PRIO[row.original.priority]"
              size="sm"
            >
              {{ row.original.priority }}
            </AppStatus>
          </template>
          <template #due-cell="{ row }">
            <span
              class="text-muted"
              :class="row.original.status !== 'Selesai' && sisaHari(row.original.due) < 0 ? 'font-semibold text-error' : ''"
            >{{ fDue(row.original.due) }}</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="WARNA_COORD[row.original.status] || 'neutral'"
              :icon="IKON_COORD[row.original.status]"
              size="sm"
            >
              {{ row.original.status }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Hapus"
              @click.stop="coordHapus = row.original"
            />
          </template>
        </UTable>
      </AppPanel>
    </template>

    <BdCoordSheet
      v-model:open="bukaCoord"
      :coord="coordPilih"
      :projects="state.projects"
      :people="people"
      :aku="aku"
    />

    <ResponsiveSheet
      v-model:open="statusSheet"
      title="Pindah status"
      :description="statusPilih?.title"
    >
      <UFormField label="Status">
        <USelect
          v-model="statusBaru"
          :items="COORD_FLOW"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Simpan"
          loading-auto
          @click="simpanStatus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="statusSheet = false"
        />
      </template>
    </ResponsiveSheet>

    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus request koordinasi ini?"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
