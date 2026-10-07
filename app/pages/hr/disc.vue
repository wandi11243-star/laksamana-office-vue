<!--
  HR › Disiplin (deploy/hr/index.html RENDER.disc :2262-2306).

  The escalation table is a SUGGESTION (F.8): SP1 → SP2 → SP3 inside the
  validity window; HRD/CEO decides. Violations deduct the Disiplin component of
  People Score by severity. Visibility matches the old page: HRD/CEO, the
  person, or their manager.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrViolation } from '~/utils/hr'
import { canHr } from '~/utils/hr'
import { activeSP, suggestSP } from '~/utils/people-score'
import { useHrDasar } from '~/composables/useHr'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const bisaCatat = computed(() => canHr('manageDiscipline', cu.value, officeAdmin.value) || canHr('coach', cu.value, officeAdmin.value))
const bisaSP = computed(() => canHr('manageDiscipline', cu.value, officeAdmin.value))

const daftar = computed(() => s.value.violations
  .filter(v => canHr('manageDiscipline', cu.value, officeAdmin.value)
    || v.empId === cu.value?.id
    || (cu.value?.appRole === 'manager' && s.value.employees.find(e => e.id === v.empId)?.divId === cu.value?.divId))
  .sort((a, b) => b.date.localeCompare(a.date)))

const denganSP = computed(() => (bisaSP.value
  ? s.value.employees
      .filter(e => e.status === 'Aktif' && (activeSP(s.value, e.id) || suggestSP(s.value, e.id)))
      .map(e => ({ e, aktif: activeSP(s.value, e.id), saran: suggestSP(s.value, e.id) }))
  : []))

const kolom: TableColumn<HrViolation>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'kru', header: 'Kru' },
  { id: 'jenis', header: 'Jenis' },
  { id: 'tingkat', header: 'Tingkat' },
  { id: 'sp', header: 'SP' },
  { id: 'catatan', header: 'Catatan' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const sheetOpen = ref(false)
const edit = ref<HrViolation | null>(null)
function buka(v: HrViolation | null) {
  edit.value = v
  sheetOpen.value = true
}
async function sesudah() {
  await refresh()
}
const nama = (id: string) => s.value.employees.find(e => e.id === id)?.name ?? '-'
const nadaSev = (x: string): 'error' | 'warning' | 'neutral' => (x === 'Berat' ? 'error' : x === 'Sedang' ? 'warning' : 'neutral')
const nadaStatus = (x: string): 'neutral' | 'info' | 'success' => (x === 'Dibatalkan' ? 'neutral' : x === 'Selesai' ? 'success' : 'info')
const bobotDenda = computed(() => s.value.settings.violationDeduct)
</script>

<template>
  <AppPage
    title="Disiplin"
    description="Pelanggaran & saran SP."
  >
    <template
      v-if="bisaCatat"
      #actions
    >
      <UButton
        label="Catat pelanggaran"
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

    <AppPanel>
      <p class="rounded-field bg-muted px-3 py-2 text-sm text-muted">
        Eskalasi otomatis (masa berlaku SP {{ s.settings.spRules.spValidMonths }} bulan):
        {{ s.settings.spRules.ringanToSP1 }}× ringan atau 2× sedang → <b>SP1</b> → SP2 → SP3 → Review HR. Sistem
        hanya <b>menyarankan</b> SP; keputusan tetap di HRD/CEO. Pelanggaran memotong komponen Disiplin di People
        Score (Ringan −{{ bobotDenda.Ringan }}, Sedang −{{ bobotDenda.Sedang }}, Berat −{{ bobotDenda.Berat }}).
      </p>
    </AppPanel>

    <AppPanel
      v-if="denganSP.length"
      title="SP aktif & saran eskalasi"
      icon="i-lucide-shield-alert"
      :count="denganSP.length"
    >
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="x in denganSP"
          :key="x.e.id"
          class="rounded-field border border-default px-3 py-2"
        >
          <p class="font-semibold text-highlighted">
            {{ x.e.name }}
          </p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <AppStatus
              v-if="x.aktif"
              color="error"
              icon="i-lucide-gavel"
              size="sm"
            >
              {{ x.aktif }} aktif
            </AppStatus>
            <AppStatus
              v-if="x.saran && x.saran !== x.aktif"
              color="warning"
              icon="i-lucide-arrow-up-circle"
              size="sm"
            >
              Saran: {{ x.saran }}
            </AppStatus>
          </div>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Pelanggaran tercatat"
      icon="i-lucide-clipboard-list"
      :count="daftar.length"
      flush
    >
      <UTable
        class="hidden lg:block"
        :data="daftar"
        :columns="kolom"
        empty="Tidak ada pelanggaran tercatat."
      >
        <template #tgl-cell="{ row }">
          <span class="text-muted num">{{ fTglP(row.original.date) }}</span>
        </template>
        <template #kru-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ nama(row.original.empId) }}
          </p>
        </template>
        <template #jenis-cell="{ row }">
          <span class="text-sm">{{ row.original.type }}</span>
        </template>
        <template #tingkat-cell="{ row }">
          <AppStatus
            :color="nadaSev(row.original.severity)"
            size="sm"
          >
            {{ row.original.severity }}
          </AppStatus>
        </template>
        <template #sp-cell="{ row }">
          <AppStatus
            v-if="row.original.sp"
            color="error"
            size="sm"
          >
            {{ row.original.sp }}
          </AppStatus>
          <span
            v-else
            class="text-muted"
          >–</span>
        </template>
        <template #catatan-cell="{ row }">
          <span class="line-clamp-3 max-w-56 whitespace-normal">{{ row.original.note || '' }}</span>
        </template>
        <template #status-cell="{ row }">
          <AppStatus
            :color="nadaStatus(row.original.status || 'Tercatat')"
            size="sm"
          >
            {{ row.original.status || 'Tercatat' }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              v-if="bisaSP"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Sunting pelanggaran"
              @click="buka(row.original)"
            />
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="v in daftar"
          :key="v.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ nama(v.empId) }}
              </p>
              <p class="text-sm text-muted">
                <span class="num">{{ fTglP(v.date) }}</span> · {{ v.type }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap justify-end gap-1">
              <AppStatus
                :color="nadaSev(v.severity)"
                size="sm"
              >
                {{ v.severity }}
              </AppStatus>
              <AppStatus
                v-if="v.sp"
                color="error"
                size="sm"
              >
                {{ v.sp }}
              </AppStatus>
            </div>
          </div>
          <p
            v-if="v.note"
            class="rounded-field bg-muted px-3 py-2 text-sm"
          >
            {{ v.note }}
          </p>
          <div class="flex items-center justify-between gap-2">
            <AppStatus
              :color="nadaStatus(v.status || 'Tercatat')"
              size="sm"
            >
              {{ v.status || 'Tercatat' }}
            </AppStatus>
            <UButton
              v-if="bisaSP"
              label="Sunting"
              color="neutral"
              variant="outline"
              size="xs"
              @click="buka(v)"
            />
          </div>
        </article>
        <p
          v-if="!daftar.length"
          class="px-4 py-8 text-center text-muted"
        >
          Tidak ada pelanggaran tercatat.
        </p>
      </div>
    </AppPanel>

    <HrDiscSheet
      v-model:open="sheetOpen"
      :v="edit"
      @saved="sesudah"
    />
  </AppPage>
</template>
