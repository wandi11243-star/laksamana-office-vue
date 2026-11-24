<!--
  Move tasks to another project (owner request, 24 Nov 2026: "ticket di dalam
  project, kalau mau pindah project tinggal move aja"). Opens from a project's
  detail page: tick the tasks, choose where they go, confirm. Sub-tasks travel
  inside the task row. Nothing is ticked at first and the destination is never
  pre-chosen, so one tap can never move a whole project by accident; "Pilih
  semua" is one tap away for the "move everything" case.

  Orders between tasks (`dependsOn`) only make sense inside one project, so the
  sheet says how many will be released before it asks for the confirmation
  (rules and sums: app/utils/bd-pindah.ts).
-->
<script setup lang="ts">
import type { BdProject, BdTask } from '~/composables/useBd'
import { pindahkanTask } from '~/composables/useBd'
import { fDue, saringArsip, selesai, subHitung, urutDeadline } from '~/utils/bd-rumus'
import type { ModeArsip } from '~/utils/bd-rumus'
import { rencanaPindah } from '~/utils/bd-pindah'
import { WARNA_TASK } from '~/utils/status-bd'

const props = defineProps<{
  /** The project the tasks leave. */
  asal: BdProject
  /** Every task of the board (the clash of orders is read from all of them). */
  tasks: BdTask[]
  projects: BdProject[]
}>()
const open = defineModel<boolean>('open', { default: false })

const TANPA = '__tanpa__'
const tujuan = ref<string>('')
const dipilih = ref<string[]>([])
const tampil = ref<ModeArsip>('aktif')

watch(open, (v) => {
  if (!v) return
  tujuan.value = ''
  dipilih.value = []
  tampil.value = 'aktif'
})

const milik = computed(() => props.tasks.filter(t => t.project === props.asal.id && !t.daily))
const daftar = computed(() => saringArsip(milik.value, tampil.value).slice().sort(urutDeadline))
const jumlahAktif = computed(() => milik.value.filter(t => !selesai(t)).length)

/** Projects that can receive tasks: not this one, not finished. */
const opsiTujuan = computed(() => [
  { value: TANPA, label: 'Tanpa project (lepas dari project ini)' },
  ...props.projects.filter(p => p.id !== props.asal.id && p.stage !== 'Done').map(p => ({ value: p.id, label: p.name })),
])
const idTujuan = computed<string | null | undefined>(() => (!tujuan.value ? undefined : tujuan.value === TANPA ? null : tujuan.value))
const namaTujuan = computed(() => (idTujuan.value === null ? 'tanpa project' : props.projects.find(p => p.id === idTujuan.value)?.name ?? ''))

const rencana = computed(() => rencanaPindah(props.tasks, dipilih.value, idTujuan.value ?? null))
const semuaTerpilih = computed(() => daftar.value.length > 0 && daftar.value.every(t => dipilih.value.includes(t.id)))
const sebagian = computed(() => !semuaTerpilih.value && daftar.value.some(t => dipilih.value.includes(t.id)))

function pilihSemua(on: boolean) {
  const lihat = new Set(daftar.value.map(t => t.id))
  dipilih.value = on
    ? [...new Set([...dipilih.value, ...lihat])]
    : dipilih.value.filter(id => !lihat.has(id))
}
function toggle(id: string, on: boolean) {
  dipilih.value = on ? [...dipilih.value, id] : dipilih.value.filter(x => x !== id)
}

const { jalan, lagi } = useSibuk()
const bisa = computed(() => idTujuan.value !== undefined && rencana.value.dipindah.length > 0)
async function pindah() {
  if (!bisa.value) return
  const ok = await pindahkanTask(rencana.value, props.tasks, namaTujuan.value)
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Pindahkan task"
    :description="`Dari project ${asal.name}`"
    lebar="sedang"
  >
    <div class="grid grid-cols-1 gap-4">
      <UFormField
        label="Pindah ke project"
        help="Project yang sudah selesai tidak muncul di sini."
      >
        <USelect
          v-model="tujuan"
          :items="opsiTujuan"
          placeholder="Pilih project tujuan"
          class="w-full"
        />
      </UFormField>

      <div>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-highlighted">
            <UCheckbox
              :model-value="semuaTerpilih ? true : sebagian ? 'indeterminate' : false"
              :disabled="!daftar.length"
              @update:model-value="(v: boolean | 'indeterminate') => pilihSemua(v === true)"
            />
            Pilih semua{{ tampil === 'aktif' ? ' yang aktif' : '' }}
          </label>
          <div class="flex-1" />
          <AppSeg
            v-model="tampil"
            size="sm"
            :options="[{ value: 'aktif', label: `Aktif (${jumlahAktif})` }, { value: 'semua', label: `Semua (${milik.length})` }]"
          />
        </div>

        <ul class="max-h-[46vh] divide-y divide-default overflow-y-auto rounded-panel border border-default">
          <li
            v-for="t in daftar"
            :key="t.id"
          >
            <label class="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-elevated/50">
              <UCheckbox
                class="mt-0.5"
                :model-value="dipilih.includes(t.id)"
                @update:model-value="(v: boolean | 'indeterminate') => toggle(t.id, v === true)"
              />
              <span class="min-w-0 flex-1">
                <span
                  class="block font-semibold leading-snug"
                  :class="selesai(t) ? 'text-muted line-through' : 'text-highlighted'"
                >{{ t.name }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-1.5">
                  <AppStatus
                    size="sm"
                    :color="WARNA_TASK[t.status] || 'neutral'"
                  >
                    {{ t.status }}
                  </AppStatus>
                  <AppStatus
                    v-if="t.deadline && !selesai(t)"
                    size="sm"
                  >
                    {{ fDue(t.deadline) }}
                  </AppStatus>
                  <span
                    v-if="subHitung(t).n"
                    class="text-xs text-muted"
                  >{{ subHitung(t).d }}/{{ subHitung(t).n }} sub-task ikut pindah</span>
                </span>
              </span>
            </label>
          </li>
          <li
            v-if="!daftar.length"
            class="px-3 py-6 text-center text-sm text-muted"
          >
            {{ milik.length ? 'Tidak ada task aktif. Ganti ke "Semua" untuk melihat yang sudah Done.' : 'Project ini belum punya task.' }}
          </li>
        </ul>
      </div>

      <p
        v-if="rencana.dilepas"
        class="rounded-panel bg-warning/10 px-3 py-2 text-sm text-warning"
      >
        {{ rencana.dilepas }} urutan antar task akan dilepas, karena task yang ditunggu tidak ikut pindah ke project yang sama.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="rencana.dipindah.length ? `Pindahkan ${rencana.dipindah.length} task${idTujuan === undefined ? '' : ` ke ${namaTujuan}`}` : 'Pindahkan'"
        icon="i-lucide-arrow-right-left"
        :disabled="!bisa || lagi('pindah')"
        :loading="lagi('pindah')"
        @click="jalan('pindah', pindah)"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
