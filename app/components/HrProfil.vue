<!--
  Profil kru + rincian skor (deploy/hr/index.html openEmpDetail :2489-2519).
  Used from People Score (everyone may open their own / scoped crew) and from
  the Kru page. Read-only: the monthly inputs live in their own sheet.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { activeSP, bulanTerakhir, peopleScore, trainingDariAkademi } from '~/utils/people-score'
import { divName } from '~/utils/hr'
import { useHrDasar } from '~/composables/useHr'
import { fTgl, hariIni } from '~/utils/format'
import { labelBulanJadwal } from '~/utils/jadwal'

const props = defineProps<{ e: HrEmployee | null }>()
const open = defineModel<boolean>('open', { default: false })

const { s, akademi } = useHrDasar()
const mk = ref(hariIni().slice(0, 7))

watch(open, (v) => {
  if (v) mk.value = hariIni().slice(0, 7)
})

const ps = computed(() => (props.e ? peopleScore(s.value, props.e, mk.value, akademi.value) : null))
const tren = computed(() => bulanTerakhir(6, mk.value).map((m) => {
  if (!props.e) return null
  const p = peopleScore(s.value, props.e, m, akademi.value)
  return p.completeness > 0 ? p.score : null
}))
const komp = computed(() => [
  { k: 'attendance', l: 'Attendance (Talenta)' },
  { k: 'kpi', l: 'KPI' },
  { k: 'training', l: 'Training' },
  { k: 'review', l: 'Customer Review' },
  { k: 'discipline', l: 'Disiplin' },
  { k: 'teamwork', l: 'Teamwork' },
  { k: 'initiative', l: 'Inisiatif' },
])
const kompetensi = computed(() => (props.e ? s.value.competencies.find(x => x.empId === props.e!.id) : null))
const badges = computed(() => (props.e ? s.value.badges.filter(b => b.empId === props.e!.id) : []))
const poin = computed(() => (props.e
  ? s.value.rewards.filter(r => r.empId === props.e!.id).reduce((a, r) => a + (r.type === 'earn' ? r.points : -r.points), 0)
  : 0))
const sertifikat = computed(() => (props.e ? s.value.trainingRecords.filter(r => r.empId === props.e!.id && r.status === 'Lulus').length : 0))
const coachings = computed(() => (props.e ? s.value.coachings.filter(x => x.empId === props.e!.id).sort((a, b) => b.date.localeCompare(a.date)) : []))
const vios = computed(() => (props.e ? s.value.violations.filter(v => v.empId === props.e!.id && v.status !== 'Dibatalkan') : []))
const sp = computed(() => (props.e ? activeSP(s.value, props.e.id) : ''))
const dariAkademi = computed(() => (props.e ? trainingDariAkademi(akademi.value, props.e.id) : false))
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="e?.name ?? 'Profil kru'"
    :description="e ? `${e.role || 'Kru'}, ${divName(s, e.divId)}, sejak ${e.joinDate ? fTgl(e.joinDate) : '—'}` : ''"
  >
    <div
      v-if="e && ps"
      class="space-y-4"
    >
      <div class="flex items-center justify-between gap-3">
        <HrBulan v-model="mk" />
        <div class="text-end">
          <p class="font-display text-2xl font-bold text-highlighted num">
            {{ Math.round(ps.score * 10) / 10 }}
          </p>
          <HrGrade
            :s="s"
            :score="ps.score"
            :completeness="ps.completeness"
          />
        </div>
      </div>

      <div>
        <HrTren
          :values="tren"
          :width="300"
          :height="40"
        />
        <p class="text-xs text-muted">
          Tren People Score 6 bulan · kelengkapan data bulan ini {{ ps.completeness }}%
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Komponen
              </th>
              <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                Bobot
              </th>
              <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                Skor
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="x in komp"
              :key="x.k"
            >
              <td class="py-1.5">
                {{ x.l }}
                <ULink
                  v-if="x.k === 'training' && dariAkademi"
                  to="/akademi"
                  class="ms-1 text-xs text-primary-700"
                >(dari Akademi)</ULink>
              </td>
              <td class="py-1.5 text-end text-muted num">
                {{ s.settings.scoreWeights[x.k] }}%
              </td>
              <td class="py-1.5 text-end num">
                <template v-if="ps.comp[x.k] != null">
                  {{ Math.round((ps.comp[x.k] ?? 0) * 10) / 10 }}
                </template>
                <span
                  v-else
                  class="text-muted"
                >default {{ s.settings.defaultComponentScore }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="badges.length"
        class="flex flex-wrap gap-1.5"
      >
        <AppStatus
          v-for="b in badges"
          :key="b.id"
          color="gold"
          icon="i-lucide-award"
          size="sm"
        >
          {{ b.badge }}, {{ labelBulanJadwal(b.month) }}
        </AppStatus>
      </div>

      <p class="rounded-field bg-muted px-3 py-2 text-sm">
        <b>{{ poin }}</b> poin reward · <b>{{ sertifikat }}</b> sertifikat ·
        <b>{{ coachings.length }}</b> sesi coaching · <b>{{ vios.length }}</b> pelanggaran
        <span
          v-if="sp"
          class="ms-1 inline-flex items-center rounded-full bg-error/12 px-2 py-0.5 text-xs font-semibold text-error"
        >{{ sp }} aktif</span>
      </p>

      <div v-if="kompetensi?.skills.length">
        <p class="mb-1 text-sm font-semibold text-highlighted">
          Kompetensi
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="sk in kompetensi.skills"
            :key="sk.name"
            class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
          >{{ sk.name }} · {{ sk.level }}/5</span>
        </div>
      </div>

      <div v-if="coachings.length">
        <p class="mb-1 text-sm font-semibold text-highlighted">
          Coaching terakhir
        </p>
        <div class="space-y-2">
          <div
            v-for="c in coachings.slice(0, 3)"
            :key="c.id"
            class="rounded-field border border-default px-3 py-2 text-sm"
          >
            <b class="text-highlighted num">{{ fTgl(c.date) }}</b> · {{ c.problem }}
            <p class="text-[13px] text-muted">
              Plan: {{ c.actionPlan || '—' }} · {{ c.status }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </ResponsiveSheet>
</template>
