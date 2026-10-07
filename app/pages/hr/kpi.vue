<!--
  HR › KPI Divisi (deploy/hr/index.html renderKpi :1856-1879).

  One card per division template, for one month: indicator, weight, target,
  actual, and the item score. `dir` decides which way is good (down = cost/
  waste). The indicator score caps at 120 and the division score is its
  weighted average (people-score.ts). Weight/target changes apply to every
  month — the template sheet says so.
-->
<script setup lang="ts">
import { canHr, kpiTemplateFor } from '~/utils/hr'
import { divKpiScore, kpiItemScore } from '~/utils/people-score'
import { useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const mk = useState('hr-kpi-mk', () => hariIni().slice(0, 7))

const adaInput = computed(() => canHr('inputKpi', cu.value, officeAdmin.value))
const adaTemplate = computed(() => canHr('manageSettings', cu.value, officeAdmin.value))
const divisi = computed(() => s.value.divisions.filter(d => s.value.kpiTemplates.some(t => t.divId === d.id)))

const inputOpen = ref(false)
const inputDiv = ref('')
function bukaInput(divId: string) {
  inputDiv.value = divId
  inputOpen.value = true
}
const templateOpen = ref(false)

const skorDiv = (divId: string) => divKpiScore(s.value, divId, mk.value)
const aktual = (divId: string, itemId: string) => s.value.kpiActuals[divId]?.[mk.value]?.[itemId] ?? null
const nilaiItem = (divId: string, it: { id: string, dir: string, target: number }) => kpiItemScore(it, aktual(divId, it.id))
const nadaSkor = (score: number): 'success' | 'gold' | 'warning' | 'error' => (score >= 100 ? 'success' : score >= 85 ? 'gold' : score >= 60 ? 'warning' : 'error')
const ikonSkor = (score: number): string => (score >= 100 ? 'i-lucide-check' : score >= 85 ? 'i-lucide-thumbs-up' : 'i-lucide-alert-triangle')
async function sesudah() {
  await refresh()
}
</script>

<template>
  <AppPage
    title="KPI Divisi"
    description="Target indikator & aktualnya."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <template #head>
        <HrBulan v-model="mk" />
        <UButton
          v-if="adaTemplate"
          label="Edit template KPI"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          size="sm"
          @click="templateOpen = true"
        />
      </template>

      <p
        v-if="!divisi.length"
        class="rounded-field bg-muted px-3 py-3 text-sm text-muted"
      >
        Belum ada template KPI.
      </p>

      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="d in divisi"
          :key="d.id"
          class="rounded-panel border border-default p-4"
        >
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold text-highlighted">
              {{ d.name }}
            </p>
            <div class="flex items-center gap-2">
              <AppStatus
                v-if="skorDiv(d.id)"
                :color="nadaSkor(skorDiv(d.id)!.score)"
                :icon="ikonSkor(skorDiv(d.id)!.score)"
                size="sm"
              >
                {{ Math.round(skorDiv(d.id)!.score * 10) / 10 }} · {{ skorDiv(d.id)!.filled }}/{{ skorDiv(d.id)!.total }} item
              </AppStatus>
              <AppStatus
                v-else
                size="sm"
              >
                belum diinput
              </AppStatus>
              <UButton
                v-if="adaInput"
                label="Input"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaInput(d.id)"
              />
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-80 text-sm">
              <thead>
                <tr>
                  <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                    Indikator
                  </th>
                  <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                    Bobot
                  </th>
                  <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                    Target
                  </th>
                  <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                    Aktual
                  </th>
                  <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                    Skor
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="it in kpiTemplateFor(s, d.id)?.items ?? []"
                  :key="it.id"
                >
                  <td class="py-1.5">
                    {{ it.name }}
                    <span class="text-xs text-muted">{{ it.dir === 'down' ? '↓ rendah baik' : '↑ tinggi baik' }}</span>
                  </td>
                  <td class="py-1.5 text-end text-muted num">
                    {{ it.weight }}%
                  </td>
                  <td class="py-1.5 text-end num">
                    {{ it.target }} {{ it.unit }}
                  </td>
                  <td class="py-1.5 text-end num">
                    <template v-if="aktual(d.id, it.id) != null">
                      {{ aktual(d.id, it.id) }}
                    </template>
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                  <td class="py-1.5 text-end num">
                    <template v-if="nilaiItem(d.id, it) != null">
                      {{ Math.round((nilaiItem(d.id, it) ?? 0) * 10) / 10 }}
                    </template>
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppPanel>

    <HrKpiInput
      v-model:open="inputOpen"
      :div-id="inputDiv"
      :mk="mk"
      @saved="sesudah"
    />
    <HrKpiTemplate
      v-model:open="templateOpen"
      @saved="sesudah"
    />
  </AppPage>
</template>
