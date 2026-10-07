<!--
  HR › People Score (deploy/hr/index.html renderScore :1558-1602).

  Weighted seven components per worker; ranking and grade only for rows whose
  data completeness passes the threshold (F.5) — a default-heavy score must
  never beat a measured one. Talenta wins over manual attendance, Akademi over
  manual training (F.6/F.7). The breakdown opens from the row (all roles may
  see their scoped crew; the admin Kru page uses the same sheet).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrEmployee } from '~/utils/hr'
import { SCORE_MIN_COMPLETENESS, canHr, divName, scopeEmps } from '~/utils/hr'
import { bulanTerakhir, peopleScore } from '~/utils/people-score'
import type { HasilScore } from '~/utils/people-score'
import { useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

interface Baris { e: HrEmployee, ps: HasilScore }

const { s, akademi, cu, officeAdmin, pending, error, refresh } = useHrDasar()
const mk = useState('hr-score-mk', () => hariIni().slice(0, 7))

const emps = computed(() => scopeEmps(s.value, cu.value, officeAdmin.value).filter(e => e.appRole !== 'ceo'))
const all = computed<Baris[]>(() => emps.value.map(e => ({ e, ps: peopleScore(s.value, e, mk.value, akademi.value) })))
const rows = computed(() => all.value.filter(r => r.ps.completeness >= SCORE_MIN_COMPLETENESS).sort((a, b) => b.ps.score - a.ps.score))
const unrank = computed(() => all.value.filter(r => r.ps.completeness < SCORE_MIN_COMPLETENESS))
const adaInput = computed(() => canHr('inputKpi', cu.value, officeAdmin.value))
const tren = (r: Baris) => bulanTerakhir(6, mk.value).map((m) => {
  const p = peopleScore(s.value, r.e, m, akademi.value)
  return p.completeness >= SCORE_MIN_COMPLETENESS ? p.score : null
})

const kolom: TableColumn<Baris>[] = [
  { id: 'no', header: '#' },
  { id: 'kru', header: 'Kru' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'attend', header: () => h('span', { class: 'block text-end' }, 'Attend') },
  { id: 'kpi', header: () => h('span', { class: 'block text-end' }, 'KPI') },
  { id: 'training', header: () => h('span', { class: 'block text-end' }, 'Training') },
  { id: 'review', header: () => h('span', { class: 'block text-end' }, 'Review') },
  { id: 'disiplin', header: () => h('span', { class: 'block text-end' }, 'Disiplin') },
  { id: 'score', header: 'Score' },
  { id: 'grade', header: 'Grade' },
  { id: 'tren', header: 'Tren 6 bln' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const inputOpen = ref(false)
const profilOpen = ref(false)
const profilE = ref<HrEmployee | null>(null)
function detail(e: HrEmployee) {
  profilE.value = e
  profilOpen.value = true
}
async function sesudahSimpan() {
  await refresh()
}
const bobot = computed(() => s.value.settings.scoreWeights)
</script>

<template>
  <AppPage
    title="People Score"
    description="Skor tujuh komponen & ranking."
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
          v-if="adaInput"
          label="Input data bulanan"
          icon="i-lucide-plus"
          size="sm"
          @click="inputOpen = true"
        />
      </template>

      <p class="mb-3 rounded-field bg-muted px-3 py-2 text-sm text-muted">
        Bobot: Attendance {{ bobot.attendance }}% (dari report Talenta di halaman Kehadiran), KPI {{ bobot.kpi }}%,
        Training {{ bobot.training }}%, Customer Review {{ bobot.review }}%, Disiplin {{ bobot.discipline }}%,
        Teamwork {{ bobot.teamwork }}%, Inisiatif {{ bobot.initiative }}%. Komponen kosong memakai nilai default
        {{ s.settings.defaultComponentScore }}. Ubah di Pengaturan.
      </p>
      <p
        v-if="unrank.length"
        class="mb-4 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <b>{{ unrank.length }} kru belum masuk ranking</b> karena kelengkapan datanya di bawah
        {{ SCORE_MIN_COMPLETENESS }}% ({{ unrank.map(r => r.e.name).join(', ') }}). Skornya masih sebagian besar
        nilai default, jadi belum menggambarkan kinerja. Isi Data Bulanan dan KPI divisinya dulu.
      </p>

      <div
        v-if="rows.length >= 3"
        class="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <div
          v-for="r in [rows[1], rows[0], rows[2]]"
          :key="r!.e.id"
          class="rounded-panel border border-default p-4 text-center"
          :class="r === rows[0] && 'border-primary-400 bg-primary-100/40'"
        >
          <p class="text-xs font-bold uppercase tracking-wider text-primary-700">
            {{ r === rows[0] ? 'Juara 1' : `Peringkat ${r === rows[1] ? 2 : 3}` }}
          </p>
          <p class="mt-1 font-display text-lg font-bold text-highlighted">
            {{ r!.e.name }}
          </p>
          <p class="text-[13px] text-muted">
            {{ divName(s, r!.e.divId) }}
          </p>
          <p class="mt-1 font-display text-2xl font-bold text-highlighted num">
            {{ Math.round(r!.ps.score * 10) / 10 }}
          </p>
          <HrGrade
            :s="s"
            :score="r!.ps.score"
            :completeness="r!.ps.completeness"
          />
        </div>
      </div>

      <UTable
        class="hidden lg:block"
        :data="[...rows, ...unrank]"
        :columns="kolom"
        :loading="pending"
        empty="Belum ada kru."
      >
        <template #no-cell="{ row }">
          <span class="text-muted num">{{ rows.indexOf(row.original) > -1 ? rows.indexOf(row.original) + 1 : '–' }}</span>
        </template>
        <template #kru-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ row.original.e.name }}
          </p>
          <p class="text-[13px] text-muted">
            {{ row.original.e.role }}
          </p>
        </template>
        <template #divisi-cell="{ row }">
          <span class="text-sm">{{ divName(s, row.original.e.divId) }}</span>
        </template>
        <template #attend-cell="{ row }">
          <HrNilai :v="row.original.ps.comp.attendance" />
        </template>
        <template #kpi-cell="{ row }">
          <HrNilai :v="row.original.ps.comp.kpi" />
        </template>
        <template #training-cell="{ row }">
          <HrNilai :v="row.original.ps.comp.training" />
        </template>
        <template #review-cell="{ row }">
          <HrNilai :v="row.original.ps.comp.review" />
        </template>
        <template #disiplin-cell="{ row }">
          <HrNilai :v="row.original.ps.comp.discipline" />
        </template>
        <template #score-cell="{ row }">
          <span
            v-if="row.original.ps.completeness < SCORE_MIN_COMPLETENESS"
            class="text-xs text-muted"
          >belum cukup data</span>
          <HrBar
            v-else
            :value="row.original.ps.score"
            class="w-32"
          />
        </template>
        <template #grade-cell="{ row }">
          <HrGrade
            :s="s"
            :score="row.original.ps.score"
            :completeness="row.original.ps.completeness"
          />
        </template>
        <template #tren-cell="{ row }">
          <HrTren :values="tren(row.original)" />
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              label="Detail"
              color="neutral"
              variant="outline"
              size="xs"
              @click="detail(row.original.e)"
            />
          </div>
        </template>
      </UTable>

      <div class="space-y-2 lg:hidden">
        <article
          v-for="(r, i) in [...rows, ...unrank]"
          :key="r.e.id"
          class="rounded-field border border-default p-3"
          :class="r.ps.completeness < SCORE_MIN_COMPLETENESS && 'opacity-70'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                <span class="me-1.5 text-muted num">{{ rows.indexOf(r) > -1 ? rows.indexOf(r) + 1 : i + 1 }}</span>{{ r.e.name }}
              </p>
              <p class="text-[13px] text-muted">
                {{ divName(s, r.e.divId) }} · Attend {{ r.ps.comp.attendance == null ? '—' : Math.round(r.ps.comp.attendance) }}
                · KPI {{ r.ps.comp.kpi == null ? '—' : Math.round(r.ps.comp.kpi) }}
              </p>
            </div>
            <div class="shrink-0 text-end">
              <p class="font-display text-lg font-bold text-highlighted num">
                {{ Math.round(r.ps.score * 10) / 10 }}
              </p>
              <HrGrade
                :s="s"
                :score="r.ps.score"
                :completeness="r.ps.completeness"
              />
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between gap-2">
            <HrTren :values="tren(r)" />
            <UButton
              label="Detail"
              color="neutral"
              variant="outline"
              size="xs"
              @click="detail(r.e)"
            />
          </div>
        </article>
        <p
          v-if="!all.length"
          class="text-sm text-muted"
        >
          Belum ada kru.
        </p>
      </div>

      <p class="mt-3 text-sm text-muted">
        Skor komponen "—" berarti belum ada data, jadi nilai default dipakai. Kru dengan kelengkapan di bawah
        {{ SCORE_MIN_COMPLETENESS }}% tidak diberi ranking dan grade.
      </p>
    </AppPanel>

    <HrInputBulanan
      v-model:open="inputOpen"
      :mk="mk"
      :employees="emps"
      @saved="sesudahSimpan"
    />
    <HrProfil
      v-model:open="profilOpen"
      :e="profilE"
    />
  </AppPage>
</template>
