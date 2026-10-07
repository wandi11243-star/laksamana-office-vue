<!--
  HR › Competency Matrix (deploy/hr/index.html RENDER.comp :2032-2050). Level
  1–5 per competency; "Perlu training" lists level ≤2, and an average ≥4★ is one
  of the Career Path requirements. A manager (or the person themself) may edit.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { canHr, divName, scopeEmps } from '~/utils/hr'
import { useHrDasar } from '~/composables/useHr'

definePageMeta({ access: ['hr'] })

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const emps = computed(() => scopeEmps(s.value, cu.value, officeAdmin.value).filter(e => e.appRole !== 'ceo'))
const bolehEdit = (e: HrEmployee) => canHr('manageTraining', cu.value, officeAdmin.value) || cu.value?.id === e.id
const kompetensi = (e: HrEmployee) => s.value.competencies.find(x => x.empId === e.id)
const skillsKru = (e: HrEmployee) => kompetensi(e)?.skills ?? []

const sheetOpen = ref(false)
const pilih = ref<HrEmployee | null>(null)
function buka(e: HrEmployee) {
  pilih.value = e
  sheetOpen.value = true
}
async function sesudah() {
  await refresh()
}
</script>

<template>
  <AppPage
    title="Competency matrix"
    description="Kompetensi per kru."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <p class="mb-3 rounded-field bg-muted px-3 py-2 text-sm text-muted">
        Level kompetensi 1–5. Manager melihat langsung siapa yang butuh training apa. Kompetensi rata-rata ≥4★ jadi
        salah satu syarat naik level di Career Path.
      </p>

      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="e in emps"
          :key="e.id"
          class="rounded-panel border border-default p-4"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ e.name }}
              </p>
              <p class="text-[13px] text-muted">
                {{ e.role }}, {{ divName(s, e.divId) }}
              </p>
            </div>
            <UButton
              v-if="bolehEdit(e)"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Sunting kompetensi"
              @click="buka(e)"
            />
          </div>

          <template v-if="skillsKru(e).length">
            <div class="space-y-1.5">
              <div
                v-for="sk in skillsKru(e)"
                :key="sk.name"
                class="flex items-center justify-between gap-2 text-sm"
              >
                <span>{{ sk.name }}</span>
                <span class="flex shrink-0 items-center gap-0.5">
                  <UIcon
                    v-for="n in 5"
                    :key="n"
                    name="i-lucide-star"
                    class="size-3.5"
                    :class="n <= sk.level ? 'text-primary-600' : 'text-dimmed'"
                  />
                  <span class="ms-1 text-xs text-muted num">{{ sk.level }}/5</span>
                </span>
              </div>
            </div>
            <p
              v-if="skillsKru(e).some(x => x.level <= 2)"
              class="mt-2 text-xs text-warning"
            >
              Perlu training: {{ skillsKru(e).filter(x => x.level <= 2).map(x => x.name).join(', ') }}
            </p>
          </template>
          <p
            v-else
            class="text-sm text-muted"
          >
            Belum dipetakan.
          </p>
        </div>
        <p
          v-if="!emps.length"
          class="text-sm text-muted"
        >
          Belum ada kru dalam jangkauan Anda.
        </p>
      </div>
    </AppPanel>

    <HrCompSheet
      v-model:open="sheetOpen"
      :e="pilih"
      @saved="sesudah"
    />
  </AppPage>
</template>
