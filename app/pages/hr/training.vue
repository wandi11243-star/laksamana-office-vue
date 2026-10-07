<!--
  HR › Training Center (deploy/hr/index.html RENDER.training :2102-2133).

  This page RECORDS results; it is not where training runs. When Akademi is
  connected its completion feeds the People Score training component (F.6), and
  the page says so — what stays here is the offline part (briefing, practice).
  A pass mints `LM-CERT-<year>-NNN` and adds points (see HrTrainingCatat).
-->
<script setup lang="ts">
import type { HrTraining } from '~/utils/hr'
import { activeEmps, canHr, divName } from '~/utils/hr'
import { useHrDasar, useHrTrainingStats } from '~/composables/useHr'
import { angka, fTglP } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const { data: akademi } = useHrTrainingStats()
const akademiOn = computed(() => Object.keys(akademi.value ?? {}).length > 0)
const bisa = computed(() => canHr('manageTraining', cu.value, officeAdmin.value))

const program = computed(() => s.value.trainings)
function target(t: HrTraining): number {
  const aktif = activeEmps(s.value).filter(e => e.appRole !== 'ceo')
  return t.divId === 'all' ? aktif.length : aktif.filter(e => e.divId === t.divId).length
}
const recs = (t: HrTraining) => s.value.trainingRecords.filter(r => r.trainingId === t.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
const lulus = (t: HrTraining) => recs(t).filter(r => r.status === 'Lulus').length
const namaKru = (id: string) => s.value.employees.find(e => e.id === id)?.name ?? '-'

const formOpen = ref(false)
const edit = ref<HrTraining | null>(null)
function buka(t: HrTraining | null) {
  edit.value = t
  formOpen.value = true
}
const catatOpen = ref(false)
const catatT = ref<HrTraining | null>(null)
function bukaCatat(t: HrTraining) {
  catatT.value = t
  catatOpen.value = true
}
async function sesudah() {
  await refresh()
}
const nadaStatus = (st: string): 'success' | 'error' | 'info' => (st === 'Lulus' ? 'success' : st === 'Gagal' ? 'error' : 'info')
</script>

<template>
  <AppPage
    title="Training center"
    description="Program, hasil & sertifikat."
  >
    <template
      v-if="bisa"
      #actions
    >
      <UButton
        label="Program training"
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
      <p class="mb-3 rounded-field bg-muted px-3 py-2 text-sm text-muted">
        <template v-if="akademiOn">
          Komponen <b>Training</b> di People Score dibaca langsung dari modul <b>Akademi</b> (materi + kuis asli),
          per kru. Halaman ini hanya untuk mencatat training di luar Akademi (briefing, praktek offline) yang tidak
          punya materinya di sana. Kelola materi dan kuis di Akademi.
        </template>
        <template v-else>
          Halaman ini <b>mencatat hasil</b> training, bukan tempat menjalankannya. Materi dan kuis ada di modul
          <b>Akademi</b>. Di sini HRD/manager mendaftarkan program lalu memasukkan nilai tiap kru: nilai ≥ passing
          grade dihitung Lulus, dapat nomor sertifikat internal dan poin reward. Training wajib mempengaruhi
          komponen Training di People Score dan jadi gerbang naik level.
        </template>
      </p>

      <p
        v-if="!program.length"
        class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
      >
        Belum ada program. Contoh: Product Knowledge Menu, Opening SOP, Hygiene Test, Coffee Knowledge,
        Service Excellence.
      </p>

      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="t in program"
          :key="t.id"
          class="rounded-panel border border-default p-4"
        >
          <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ t.title }}
                <AppStatus
                  :color="t.mandatory ? 'gold' : 'neutral'"
                  :icon="t.mandatory ? 'i-lucide-star' : 'i-lucide-circle'"
                  size="sm"
                >
                  {{ t.mandatory ? 'Wajib' : 'Opsional' }}
                </AppStatus>
              </p>
              <p class="text-[13px] text-muted">
                {{ t.type }}, {{ t.divId === 'all' ? 'Semua divisi' : divName(s, t.divId) }}, passing grade {{ t.passingGrade }}
              </p>
            </div>
            <div
              v-if="bisa"
              class="flex shrink-0 items-center gap-1"
            >
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Sunting program"
                @click="buka(t)"
              />
              <UButton
                label="Catat hasil"
                size="xs"
                @click="bukaCatat(t)"
              />
            </div>
          </div>

          <p
            v-if="t.desc"
            class="mb-2 text-sm text-muted"
          >
            {{ t.desc }}
          </p>

          <HrBar :value="target(t) ? (lulus(t) / target(t)) * 100 : 0" />
          <p class="mt-1 text-xs text-muted">
            {{ lulus(t) }} dari {{ target(t) }} kru lulus
          </p>

          <div
            v-if="recs(t).length"
            class="mt-3 overflow-x-auto"
          >
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th class="py-1 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                    Kru
                  </th>
                  <th class="py-1 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                    Nilai
                  </th>
                  <th class="py-1 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                    Status
                  </th>
                  <th class="py-1 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                    Sertifikat
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="r in recs(t).slice(0, 6)"
                  :key="r.id"
                >
                  <td class="py-1">
                    {{ namaKru(r.empId) }}
                  </td>
                  <td class="py-1 text-end num">
                    {{ r.score != null ? angka(r.score) : '-' }}
                  </td>
                  <td class="py-1">
                    <AppStatus
                      :color="nadaStatus(r.status)"
                      size="sm"
                    >
                      {{ r.status }}
                    </AppStatus>
                  </td>
                  <td class="py-1 text-xs text-muted">
                    {{ r.certNo || '' }}
                    <span class="ms-1">{{ r.date ? fTglP(r.date) : '' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppPanel>

    <HrTrainingForm
      v-model:open="formOpen"
      :t="edit"
      @saved="sesudah"
    />
    <HrTrainingCatat
      v-model:open="catatOpen"
      :t="catatT"
      @saved="sesudah"
    />
  </AppPage>
</template>
