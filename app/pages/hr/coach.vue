<!--
  HR › Coaching Log (deploy/hr/index.html RENDER.coach :2067-2082). Documenting
  progress is part of every supervisor's job; customer complaints are coaching
  material, not only punishment. Visibility: seeAll, the person, their coach,
  or their manager. A deadline that passed and is not Selesai is tagged "lewat".
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrCoaching } from '~/utils/hr'
import { canHr } from '~/utils/hr'
import { useHrDasar } from '~/composables/useHr'
import { fTglP, hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const bisa = computed(() => canHr('coach', cu.value, officeAdmin.value))

const daftar = computed(() => s.value.coachings
  .filter(x => canHr('seeAll', cu.value, officeAdmin.value)
    || x.empId === cu.value?.id
    || x.coachId === cu.value?.id
    || (cu.value?.appRole === 'manager' && s.value.employees.find(e => e.id === x.empId)?.divId === cu.value?.divId))
  .sort((a, b) => b.date.localeCompare(a.date)))

const nama = (id: string) => s.value.employees.find(e => e.id === id)?.name ?? '-'
const lewat = (x: HrCoaching) => x.status !== 'Selesai' && !!x.deadline && x.deadline < hariIni()

const kolom: TableColumn<HrCoaching>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'kru', header: 'Kru' },
  { id: 'coach', header: 'Coach' },
  { id: 'problem', header: 'Problem' },
  { id: 'plan', header: 'Action plan' },
  { id: 'deadline', header: 'Deadline' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const sheetOpen = ref(false)
const edit = ref<HrCoaching | null>(null)
function buka(c: HrCoaching | null) {
  edit.value = c
  sheetOpen.value = true
}
async function sesudah() {
  await refresh()
}
const nadaStatus = (st: string): 'success' | 'info' | 'neutral' => (st === 'Selesai' ? 'success' : st === 'Berjalan' ? 'info' : 'neutral')
</script>

<template>
  <AppPage
    title="Coaching log"
    description="Sesi coaching & action plan."
  >
    <template
      v-if="bisa"
      #actions
    >
      <UButton
        label="Sesi coaching"
        icon="i-lucide-plus"
        @click="buka(null)"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      title="Sesi coaching"
      icon="i-lucide-message-square-text"
      :count="daftar.length"
      flush
    >
      <p class="px-4 pt-4 text-sm text-muted lg:px-5">
        Setiap supervisor/manager wajib coaching rutin. Perkembangan orang harus terdokumentasi. Komplain pelanggan
        jadi bahan coaching, bukan cuma hukuman.
      </p>

      <UTable
        class="hidden lg:block"
        :data="daftar"
        :columns="kolom"
        empty="Belum ada sesi coaching tercatat."
      >
        <template #tgl-cell="{ row }">
          <span class="text-muted num">{{ fTglP(row.original.date) }}</span>
        </template>
        <template #kru-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ nama(row.original.empId) }}
          </p>
        </template>
        <template #coach-cell="{ row }">
          <span class="text-sm">{{ nama(row.original.coachId) }}</span>
        </template>
        <template #problem-cell="{ row }">
          <span class="line-clamp-3 max-w-56 whitespace-normal">{{ row.original.problem }}</span>
        </template>
        <template #plan-cell="{ row }">
          <span class="line-clamp-3 max-w-56 whitespace-normal">{{ row.original.actionPlan || '—' }}</span>
        </template>
        <template #deadline-cell="{ row }">
          <span class="text-muted num">{{ row.original.deadline ? fTglP(row.original.deadline) : '—' }}</span>
          <AppStatus
            v-if="lewat(row.original)"
            color="error"
            size="sm"
            class="ms-1"
          >
            lewat
          </AppStatus>
        </template>
        <template #status-cell="{ row }">
          <AppStatus
            :color="nadaStatus(row.original.status)"
            size="sm"
          >
            {{ row.original.status }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              v-if="bisa"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Sunting coaching"
              @click="buka(row.original)"
            />
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="x in daftar"
          :key="x.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ nama(x.empId) }}
              </p>
              <p class="text-sm text-muted">
                <span class="num">{{ fTglP(x.date) }}</span> · coach {{ nama(x.coachId) }}
              </p>
            </div>
            <AppStatus
              :color="nadaStatus(x.status)"
              size="sm"
            >
              {{ x.status }}
            </AppStatus>
          </div>
          <p class="rounded-field bg-muted px-3 py-2 text-sm">
            {{ x.problem }}
          </p>
          <p
            v-if="x.actionPlan"
            class="text-sm text-muted"
          >
            Plan: {{ x.actionPlan }}
          </p>
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm text-muted">
              Deadline {{ x.deadline ? fTglP(x.deadline) : '—' }}
              <AppStatus
                v-if="lewat(x)"
                color="error"
                size="sm"
                class="ms-1"
              >
                lewat
              </AppStatus>
            </span>
            <UButton
              v-if="bisa"
              label="Sunting"
              color="neutral"
              variant="outline"
              size="xs"
              @click="buka(x)"
            />
          </div>
        </article>
        <p
          v-if="!daftar.length"
          class="px-4 py-8 text-center text-muted"
        >
          Belum ada sesi coaching tercatat.
        </p>
      </div>
    </AppPanel>

    <HrCoachSheet
      v-model:open="sheetOpen"
      :c="edit"
      @saved="sesudah"
    />
  </AppPage>
</template>
