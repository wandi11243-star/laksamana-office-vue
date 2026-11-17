<!--
  BD › Recurring Task (old `vRecurring`, deploy/bd/index.html:3326-3399). One row
  per recurrence series: the running head plus its Done ancestry (`ulangDari`
  chains), never copied. Stats are over the ACTIVE series whose head is still
  open; the PIC filter narrows what is SHOWN, never what may be acted on.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BdTask } from '~/composables/useBd'
import { hentikanUlang, lanjutkanUlang, selesaiUlang, useBdState } from '~/composables/useBd'
import {
  cariAku, fDue, inisial, kunciTag, labelUlang, lewat, lingkupIds, orangById, pelaksana, pics, saringLingkup, selesai,
  seriUlang, tagsOf, todayISO, urutDeadline,
  type Seri,
} from '~/utils/bd-rumus'
import { tglLabel } from '~/utils/format'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import BdTagChip from '~/widgets/bd/BdTagChip.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state, status } = useBdState()
const f = useState('bd-recurring', () => ({ tab: 'aktif' as 'aktif' | 'henti' }))
const fPics = useState<string[]>('bd-recurring-pics', () => [])

const people = computed(() => state.value.people)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (t: BdTask) => !fPics.value.length || pelaksana(t).some(id => fPics.value.includes(id))

/** Series whose head is visible to me; the PIC filter only narrows the display. */
const semua = computed(() => seriUlang(saringLingkup(state.value.tasks, 'semua', lingkup.value, aku.value?.id)).filter(s => cocokPic(s.head)))

/** First-load skeleton for the four recap cards below: skeleton cells stand
 *  in until the first state lands. Refetch keeps old numbers, so the cards
 *  never blank. */
const statMemuat = computed(() => !state.value.tasks.length && (status.value === 'pending' || status.value === 'idle'))
const aktif = computed(() => semua.value.filter(s => s.aktif))
const henti = computed(() => semua.value.filter(s => !s.aktif))
const jalan = computed(() => aktif.value.filter(s => !selesai(s.head)))
const telat = computed(() => jalan.value.filter(s => lewat(s.head)))
const hariIni = computed(() => jalan.value.filter(s => s.head.deadline === todayISO()))
const selesaiBln = computed(() => {
  const bln = todayISO().slice(0, 7)
  return aktif.value.reduce((n, s) => n + s.rantai.filter(y => selesai(y) && String(y.doneAt || '').slice(0, 7) === bln).length, 0)
})
const daftar = computed(() => (f.value.tab === 'henti' ? henti.value : aktif.value).slice().sort((a, b) => urutDeadline(a.head, b.head)))

function namaProject(id: string | null): string {
  if (!id) return '—'
  return projects.value.find(p => p.id === id)?.name || '—'
}
function avatars(t: BdTask) {
  return pics(t).map(id => ({ id, nama: orangById(people.value, id).name || '—' }))
}
function polaLabel(s: Seri): string {
  return labelUlang(s.pola, s.head.deadline) || s.pola
}

const kolom: TableColumn<Seri>[] = [
  { accessorKey: 'task', header: 'Task' },
  { accessorKey: 'pola', header: 'Pola' },
  { accessorKey: 'deadline', header: 'Deadline' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'pic', header: 'PIC' },
  { accessorKey: 'tempat', header: 'Tempat' },
  { accessorKey: 'riwayat', header: 'Sudah selesai' },
  { id: 'aksi', header: '' },
]

// ---- sheets & row actions ----
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)
const hentiPilih = ref<BdTask | null>(null)
const hentiMau = computed({
  get: () => !!hentiPilih.value,
  set: (v) => {
    if (!v) hentiPilih.value = null
  },
})

function bukaSheet(t: BdTask) {
  taskPilih.value = t
  bukaTask.value = true
}
async function tandaiSelesai(s: Seri) {
  await selesaiUlang(s.head, state.value.tasks)
}
async function lanjutkan(s: Seri) {
  await lanjutkanUlang(s.head, state.value.tasks)
}
async function hentikan() {
  const t = hentiPilih.value
  if (!t) return
  hentiPilih.value = null
  await hentikanUlang(t)
}
</script>

<template>
  <AppPage
    title="Recurring Task"
    description="Semua task berulang — maju sendiri ke jadwal berikutnya, ditandai Done atau tidak."
  >
    <template #actions>
      <UButton
        label="Task Berulang"
        icon="i-lucide-plus"
        @click="taskPilih = null; bukaTask = true"
      />
    </template>

    <AppStatGrid
      :loading="statMemuat"
      :count="4"
    >
      <AppStat
        label="Seri aktif"
        icon="i-lucide-repeat"
        :value="String(aktif.length)"
        :sub="henti.length ? `${henti.length} dihentikan` : ''"
      />
      <AppStat
        label="Lewat deadline"
        icon="i-lucide-triangle-alert"
        :value="String(telat.length)"
        :sub="telat.length ? 'perlu ditindak' : 'aman'"
        :tone="telat.length ? 'error' : 'success'"
      />
      <AppStat
        label="Jatuh tempo hari ini"
        icon="i-lucide-calendar-check"
        :value="String(hariIni.length)"
        sub=""
      />
      <AppStat
        label="Selesai bulan ini"
        icon="i-lucide-circle-check"
        :value="String(selesaiBln)"
        sub="kejadian dari seri aktif"
      />
    </AppStatGrid>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="f.tab"
          :options="[{ value: 'aktif', label: `Aktif (${aktif.length})` }, { value: 'henti', label: `Dihentikan (${henti.length})` }]"
          size="sm"
        />
        <div class="flex-1" />
        <BdPicFilter
          v-model="fPics"
          :people="people"
          label="PIC"
        />
      </div>
    </AppPanel>

    <AppPanel
      v-if="!semua.length"
      title="Belum ada task berulang"
    >
      <p class="py-6 text-center text-sm text-muted">
        Buat lewat tombol Task Berulang, atau pilih "Berulang" di form task mana pun (Daily maupun project).
      </p>
    </AppPanel>
    <AppPanel
      v-else-if="!daftar.length"
      :title="f.tab === 'henti' ? 'Tidak ada seri yang dihentikan' : 'Tidak ada seri aktif'"
    >
      <p class="py-6 text-center text-sm text-muted">
        Ganti segmen untuk melihat yang lain.
      </p>
    </AppPanel>

    <template v-else>
      <div class="grid gap-3 lg:hidden">
        <div
          v-for="s in daftar"
          :key="s.head.id"
          class="rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel lg:px-5"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="min-w-0 flex-1 text-start"
              @click="bukaSheet(s.head)"
            >
              <span class="block font-semibold text-highlighted">{{ s.head.name }}</span>
              <span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span class="inline-flex items-center gap-1 font-semibold text-highlighted">
                  <UIcon
                    name="i-lucide-repeat"
                    class="size-3.5"
                  />
                  {{ polaLabel(s) }}
                </span>
                <span>·</span>
                <span>{{ s.head.daily ? 'Daily Task' : namaProject(s.head.project) }}</span>
              </span>
            </button>
            <AppStatus
              :color="s.aktif ? (lewat(s.head) ? 'error' : 'success') : 'neutral'"
              size="sm"
            >
              {{ s.aktif ? (selesai(s.head) ? 'Done' : s.head.status) : 'Dihentikan' }}
            </AppStatus>
          </div>
          <p
            class="mt-1 text-xs"
            :class="lewat(s.head) ? 'font-bold text-error' : 'text-muted'"
          >
            {{ s.head.deadline ? `${tglLabel(s.head.deadline)} · ${fDue(s.head.deadline)}` : 'Tanpa deadline' }}
          </p>
          <div
            v-if="tagsOf(s.head).length"
            class="mt-1 flex flex-wrap gap-1"
          >
            <BdTagChip
              v-for="g in tagsOf(s.head)"
              :key="kunciTag(g)"
              :tag="g"
            />
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              v-for="a in avatars(s.head)"
              :key="a.id"
              class="inline-flex items-center gap-1 rounded-full border border-default bg-muted px-2 py-0.5 text-xs font-semibold text-muted"
              :title="a.nama"
            >
              <span class="flex size-4 items-center justify-center rounded-full bg-yellow-light text-[8px] font-bold text-yellow-dark">{{ inisial(a.nama) }}</span>
              {{ a.nama.split(' ')[0] }}
            </span>
            <span class="text-xs text-muted">{{ s.nSelesai }}× selesai{{ s.terakhir ? ` · terakhir ${s.terakhir}` : '' }}</span>
            <span
              v-if="s.terlewat.length"
              class="text-xs text-warning"
              :title="s.terlewat.map(z => `${z.d}${z.sub ? ` (${z.sub} sub-task)` : ''}`).join(', ')"
            >
              terlewat {{ s.terlewat.length }}× · terakhir {{ s.terlewat[s.terlewat.length - 1]!.d }}
            </span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-if="!selesai(s.head)"
              label="Selesai"
              icon="i-lucide-check"
              size="xs"
              loading-auto
              @click="tandaiSelesai(s)"
            />
            <UButton
              v-if="s.aktif"
              label="Hentikan"
              color="neutral"
              variant="outline"
              size="xs"
              @click="hentiPilih = s.head"
            />
            <UButton
              v-else-if="!selesai(s.head)"
              label="Lanjutkan"
              color="neutral"
              variant="outline"
              size="xs"
              loading-auto
              @click="lanjutkan(s)"
            />
            <span
              v-else
              class="text-xs text-muted"
            >sudah Done — buat task baru untuk mulai lagi</span>
          </div>
        </div>
      </div>

      <AppPanel
        class="hidden lg:block"
        flush
      >
        <UTable
          :data="daftar"
          :columns="kolom"
          :meta="{ class: { tr: 'cursor-pointer' } }"
          @select="(_e: Event, row: { original: Seri }) => bukaSheet(row.original.head)"
        >
          <template #task-cell="{ row }">
            <b class="text-highlighted">{{ row.original.head.name }}</b>
            <span
              v-if="tagsOf(row.original.head).length"
              class="mt-1 flex flex-wrap gap-1"
            >
              <BdTagChip
                v-for="g in tagsOf(row.original.head)"
                :key="kunciTag(g)"
                :tag="g"
              />
            </span>
          </template>
          <template #pola-cell="{ row }">
            <AppStatus size="sm">
              <template #leading>
                <UIcon
                  name="i-lucide-repeat"
                  class="size-3.5"
                />
              </template>
              {{ polaLabel(row.original) }}
            </AppStatus>
          </template>
          <template #deadline-cell="{ row }">
            <template v-if="!selesai(row.original.head) && row.original.head.deadline">
              <b
                class="block whitespace-nowrap"
                :class="lewat(row.original.head) ? 'text-error' : 'text-highlighted'"
              >{{ tglLabel(row.original.head.deadline) }}</b>
              <AppStatus
                size="sm"
                :color="lewat(row.original.head) ? 'error' : 'neutral'"
                class="mt-1"
              >
                {{ fDue(row.original.head.deadline) }}
              </AppStatus>
            </template>
            <span
              v-else
              class="text-muted"
            >{{ row.original.head.deadline ? tglLabel(row.original.head.deadline) : '—' }}</span>
          </template>
          <template #status-cell="{ row }">
            <span v-if="!selesai(row.original.head)">{{ row.original.head.status }}</span>
            <span
              v-else
              class="text-muted"
            >Done{{ row.original.head.doneAt ? ` · ${row.original.head.doneAt}` : '' }}</span>
          </template>
          <template #pic-cell="{ row }">
            <span class="flex items-center">
              <span
                v-for="(a, ix) in avatars(row.original.head)"
                :key="a.id"
                class="flex size-6 items-center justify-center rounded-full border-2 border-default bg-yellow-light text-[9px] font-bold text-yellow-dark"
                :class="ix ? '-ml-2' : ''"
                :title="a.nama"
              >{{ inisial(a.nama) }}</span>
              <span
                v-if="!avatars(row.original.head).length"
                class="text-muted"
              >—</span>
            </span>
          </template>
          <template #tempat-cell="{ row }">
            <AppStatus
              v-if="row.original.head.daily || row.original.head.project"
              size="sm"
            >
              {{ row.original.head.daily ? 'Daily Task' : namaProject(row.original.head.project) }}
            </AppStatus>
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
          <template #riwayat-cell="{ row }">
            <b class="num">{{ row.original.nSelesai }}×</b>
            <div
              v-if="row.original.terakhir"
              class="text-xs text-muted"
            >
              terakhir {{ row.original.terakhir }}
            </div>
            <div
              v-if="row.original.terlewat.length"
              class="text-xs text-warning"
              :title="row.original.terlewat.map(z => `${z.d}${z.sub ? ` (${z.sub} sub-task)` : ''}`).join(', ')"
            >
              terlewat {{ row.original.terlewat.length }}× · terakhir {{ row.original.terlewat[row.original.terlewat.length - 1]!.d }}
            </div>
          </template>
          <template #aksi-cell="{ row }">
            <span
              class="flex items-center gap-1.5 whitespace-nowrap"
              @click.stop=""
            >
              <UButton
                v-if="!selesai(row.original.head)"
                label="Selesai"
                icon="i-lucide-check"
                size="xs"
                @click.stop="tandaiSelesai(row.original)"
              />
              <UButton
                v-if="row.original.aktif"
                label="Hentikan"
                color="neutral"
                variant="outline"
                size="xs"
                @click.stop="hentiPilih = row.original.head"
              />
              <UButton
                v-else-if="!selesai(row.original.head)"
                label="Lanjutkan"
                color="neutral"
                variant="outline"
                size="xs"
                @click.stop="lanjutkan(row.original)"
              />
              <span
                v-else
                class="text-xs text-muted"
              >sudah Done — buat task baru untuk mulai lagi</span>
            </span>
          </template>
        </UTable>
      </AppPanel>
    </template>

    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="state.tasks"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
    <BdKonfirmasi
      v-model:open="hentiMau"
      title="Hentikan pengulangan ini?"
      description="Task yang sedang berjalan tetap ada; hanya saja saat ditandai Done tidak ada kejadian berikutnya yang lahir. Bisa dilanjutkan lagi dari halaman ini."
      confirm-label="Hentikan"
      color="primary"
      @konfirmasi="hentikan"
    />
  </AppPage>
</template>
