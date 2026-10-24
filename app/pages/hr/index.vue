<!--
  HR › Anjungan — reimagine (B): decision-first.

  Dulu halaman ini meniru susunan lama (sapaan, 4 kartu, insight, top 5, KPI,
  agenda). Versi ini membalik urutannya mengikuti pertanyaan yang dijawab:
  "apa yang perlu saya tindak hari ini" dulu (antrean aksi), baru angkanya.
  Panel sapaan tetap jadi satu-satunya titik fokus; sisanya menunduk.
  Referensi: dasbor people-analytics yang question-first (AIHR), panduan
  visual HR yang menuntut konteks tiap angka (Udder).
-->
<script setup lang="ts">
import {
  buildInsights, peopleScore, rataRata, trainingScore, divKpiScore, calendarItemsHr,
} from '~/utils/people-score'
import { SCORE_MIN_COMPLETENESS, divName, scopeEmps } from '~/utils/hr'
import type { HrEmployee } from '~/utils/hr'
import { useHrDasar } from '~/composables/useHr'
import { LAYAR_HR, bolehLayarHr } from '~/utils/layar/hr'
import { fTglP, hariIni } from '~/utils/format'
import { labelBulanJadwal } from '~/utils/jadwal'

definePageMeta({ access: ['hr'] })

const { me, s, akademi, cu, officeAdmin, pending, error } = useHrDasar()
const mk = hariIni().slice(0, 7)

const sapaan = computed(() => me.value?.username || cu.value?.name?.split(' ')[0] || me.value?.name || '')

const emps = computed(() => scopeEmps(s.value, cu.value, officeAdmin.value).filter(e => e.appRole !== 'ceo'))
const scored = computed(() => emps.value
  .map(e => ({ e, ps: peopleScore(s.value, e, mk, akademi.value) }))
  .filter(x => x.ps.completeness >= SCORE_MIN_COMPLETENESS)
  .sort((a, b) => b.ps.score - a.ps.score))
const avgScore = computed(() => rataRata(scored.value.map(x => x.ps.score)))
const trainAvg = computed(() => rataRata(emps.value.map(e => trainingScore(s.value, e.id, akademi.value)).filter((v): v is number => v != null)))
const vioCount = computed(() => s.value.violations.filter(v => v.date.slice(0, 7) === mk && v.status !== 'Dibatalkan').length)
const moodsMk = computed(() => s.value.moods.filter(m => m.date.slice(0, 7) === mk))
const moodAvg = computed(() => rataRata(moodsMk.value.map(m => Number(m.mood)).filter(n => Number.isFinite(n))))
const insights = computed(() => buildInsights(s.value, mk, scopeEmps(s.value, cu.value, officeAdmin.value), akademi.value, hariIni()))
const my = computed(() => (cu.value ? peopleScore(s.value, cu.value, mk, akademi.value) : null))
const agenda = computed(() => calendarItemsHr(s.value).filter(ev => ev.date >= hariIni()).slice(0, 6))

const kpiDivisi = computed(() => s.value.divisions
  .map(d => ({ d, ks: divKpiScore(s.value, d.id, mk) }))
  .filter(x => s.value.kpiTemplates.some(t => t.divId === x.d.id)))

const divSaya = computed(() => (cu.value ? divName(s.value, cu.value.divId) : '—'))

function bolehHalaman(key: string): boolean {
  return bolehLayarHr(key, me.value)
}
function keHalaman(key: string): string {
  return key === 'dash' ? '/hr' : `/hr/${key}`
}
function labelHalaman(key: string): string {
  return LAYAR_HR.find(l => l.key === key)?.label ?? key
}
function nadaInsight(sev: string): 'error' | 'warning' | 'info' {
  return sev === 'bad' ? 'error' : sev === 'warn' ? 'warning' : 'info'
}
const ikonInsight = (sev: string) => (sev === 'bad' ? 'i-lucide-triangle-alert' : sev === 'warn' ? 'i-lucide-alert-circle' : 'i-lucide-info')
const namaDiv = (e: HrEmployee) => divName(s.value, e.divId)
</script>

<template>
  <AppPage
    title="Anjungan"
    description="Ringkasan kinerja bulan ini."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel flush>
      <div class="flex flex-wrap items-start justify-between gap-4 bg-table-head px-5 py-4 text-table-head-text">
        <div class="min-w-0">
          <p class="font-display text-xl font-bold">
            Halo, {{ sapaan }}
          </p>
          <p class="mt-0.5 text-sm opacity-80">
            {{ divSaya }}, {{ labelBulanJadwal(mk) }}
          </p>
        </div>
        <div
          v-if="my && cu?.appRole !== 'ceo'"
          class="text-end"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider opacity-80">
            People Score bulan ini
          </p>
          <template v-if="my.completeness < SCORE_MIN_COMPLETENESS">
            <p class="font-display text-lg font-bold">
              Belum bisa dinilai
            </p>
            <p class="text-xs opacity-70">
              data baru {{ my.completeness }}%, minimal {{ SCORE_MIN_COMPLETENESS }}% supaya skor berarti
            </p>
          </template>
          <template v-else>
            <p class="font-display text-3xl font-bold text-primary-300">
              {{ Math.round(my.score * 10) / 10 }}
            </p>
            <p class="text-xs opacity-70">
              kelengkapan data {{ my.completeness }}%
            </p>
          </template>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Perlu tindakan"
      icon="i-lucide-siren"
      description="Dihitung dari data bulan ini. Selesaikan satu per satu."
    >
      <p
        v-if="!insights.length"
        class="rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        Tidak ada yang perlu ditindak bulan ini.
      </p>
      <div
        v-else
        class="space-y-2"
      >
        <div
          v-for="(i, n) in insights"
          :key="n"
          class="flex flex-wrap items-center gap-2 rounded-field px-3 py-2 text-sm"
          :class="nadaInsight(i.sev) === 'error' ? 'bg-error/12' : nadaInsight(i.sev) === 'warning' ? 'bg-warning/12' : 'bg-info/10'"
        >
          <UIcon
            :name="ikonInsight(i.sev)"
            class="size-4 shrink-0"
            :class="nadaInsight(i.sev) === 'error' ? 'text-error' : nadaInsight(i.sev) === 'warning' ? 'text-warning' : 'text-info'"
          />
          <span class="min-w-0 flex-1">{{ i.text }}</span>
          <UButton
            v-if="bolehHalaman(i.act)"
            :label="`Buka ${labelHalaman(i.act)}`"
            color="neutral"
            variant="outline"
            size="xs"
            :to="keHalaman(i.act)"
          />
        </div>
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Rata-rata People Score"
        icon="i-lucide-star"
        :value="avgScore == null ? '—' : Math.round(avgScore * 10) / 10"
        :sub="scored.length ? `${scored.length} kru terukur` : 'belum ada kru dengan data cukup'"
        tone="gold"
      />
      <AppStat
        label="Training wajib selesai"
        icon="i-lucide-graduation-cap"
        :value="trainAvg == null ? '—' : `${Math.round(trainAvg)}%`"
        sub="rata-rata tim"
        tone="info"
      />
      <AppStat
        label="Pelanggaran bulan ini"
        icon="i-lucide-triangle-alert"
        :value="vioCount"
        :sub="vioCount ? 'perlu tindak lanjut' : 'bersih'"
        :tone="vioCount ? 'error' : 'success'"
      />
      <AppStat
        label="Mood tim"
        icon="i-lucide-smile"
        :value="moodAvg ? `${Math.round(moodAvg * 10) / 10} / 5` : '—'"
        :sub="`${moodsMk.length} check-in`"
        tone="vip"
      />
    </AppStatGrid>

    <div class="grid gap-0 lg:grid-cols-2 lg:gap-5">
      <AppPanel
        title="Top 5 People Score"
        icon="i-lucide-trophy"
      >
        <p
          v-if="!scored.length"
          class="text-sm text-muted"
        >
          Belum ada kru dengan data yang cukup dinilai.
        </p>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="(x, i) in scored.slice(0, 5)"
            :key="x.e.id"
            class="flex items-center gap-3 py-2.5"
          >
            <span class="w-5 shrink-0 text-center font-bold text-muted num">{{ i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-highlighted">
                {{ x.e.name }}
              </p>
              <p class="text-[13px] text-muted">
                {{ namaDiv(x.e) }}
              </p>
            </div>
            <HrBar
              :value="x.ps.score"
              class="w-32 shrink-0"
            />
            <HrGrade
              :s="s"
              :score="x.ps.score"
              :completeness="x.ps.completeness"
            />
          </div>
        </div>
        <template #actions>
          <UButton
            label="Lihat semua"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hr/score"
          />
        </template>
      </AppPanel>

      <AppPanel
        title="KPI per divisi"
        icon="i-lucide-bar-chart-3"
      >
        <p
          v-if="!kpiDivisi.length"
          class="text-sm text-muted"
        >
          Belum ada template KPI.
        </p>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="x in kpiDivisi"
            :key="x.d.id"
            class="flex items-center gap-3 py-2.5"
          >
            <span class="min-w-0 flex-1 font-semibold text-highlighted">{{ x.d.name }}</span>
            <HrBar
              v-if="x.ks"
              :value="x.ks.score"
              :max="120"
              class="w-40 shrink-0"
            />
            <span
              v-else
              class="text-sm text-muted"
            >belum diinput</span>
            <span
              v-if="x.ks"
              class="w-14 shrink-0 text-end text-xs text-muted num"
            >{{ x.ks.filled }}/{{ x.ks.total }} item</span>
          </div>
        </div>
        <template #actions>
          <UButton
            label="Input KPI"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/hr/kpi"
          />
        </template>
      </AppPanel>
    </div>

    <AppPanel
      title="Agenda terdekat"
      icon="i-lucide-calendar-days"
    >
      <p
        v-if="!agenda.length"
        class="text-sm text-muted"
      >
        Belum ada agenda.
      </p>
      <div
        v-else
        class="divide-y divide-default"
      >
        <div
          v-for="(ev, i) in agenda"
          :key="i"
          class="flex items-center gap-3 py-2.5"
        >
          <span class="w-24 shrink-0 text-sm text-muted num">{{ fTglP(ev.date) }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-highlighted">
              {{ ev.title }}
            </p>
            <p
              v-if="ev.note"
              class="text-[13px] text-muted"
            >
              {{ ev.note }}
            </p>
          </div>
          <AppStatus size="sm">
            {{ ev.kind }}
          </AppStatus>
        </div>
      </div>
      <template #actions>
        <UButton
          v-if="bolehHalaman('cal')"
          label="Kalender HR"
          color="neutral"
          variant="ghost"
          size="sm"
          to="/hr/cal"
        />
      </template>
    </AppPanel>

    <p
      v-if="pending"
      class="text-sm text-muted"
    >
      Memuat data…
    </p>
  </AppPage>
</template>
