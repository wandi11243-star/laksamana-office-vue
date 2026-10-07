<!--
  HR › Career & Succession (deploy/hr/index.html RENDER.career :2361-2388).
  Career tracks are transparent for every crew member; succession rows show the
  candidate's current People Score next to the readiness, answered from the
  engine (same month as the dashboard).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrCareerPath, HrSuccession } from '~/utils/hr'
import { canHr } from '~/utils/hr'
import { peopleScore } from '~/utils/people-score'
import { hrDelete, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const toast = useToast()
const { s, cu, officeAdmin, akademi, error, refresh } = useHrDasar()
const bisa = computed(() => canHr('manageCareer', cu.value, officeAdmin.value))
const mk = hariIni().slice(0, 7)

const tracks = computed(() => s.value.careerPaths)

interface BarisSuksesi { sc: HrSuccession, ps: ReturnType<typeof peopleScore> | null, nama: string, role: string }
const suksesi = computed<BarisSuksesi[]>(() => s.value.successions.map((sc) => {
  const e = s.value.employees.find(x => x.id === sc.empId)
  return {
    sc,
    ps: e ? peopleScore(s.value, e, mk, akademi.value) : null,
    nama: e?.name ?? '-',
    role: e?.role ?? '',
  }
}))

const kolom: TableColumn<BarisSuksesi>[] = [
  { id: 'pos', header: 'Posisi target' },
  { id: 'kandidat', header: 'Kandidat' },
  { id: 'readiness', header: 'Kesiapan' },
  { id: 'gap', header: 'Gap yang harus ditutup' },
  { id: 'score', header: 'People Score' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const careerOpen = ref(false)
const editTrack = ref<HrCareerPath | null>(null)
function bukaTrack(cp: HrCareerPath | null) {
  editTrack.value = cp
  careerOpen.value = true
}
const suksesiOpen = ref(false)
const editSc = ref<HrSuccession | null>(null)
function bukaSuksesi(sc: HrSuccession | null) {
  editSc.value = sc
  suksesiOpen.value = true
}

const hapusTrackOpen = ref(false)
async function jalanHapusTrack() {
  if (!editTrack.value) return
  try {
    await hrDelete('career-paths', editTrack.value.id)
    try {
      await hrPostAudit('CAREER_DEL', editTrack.value.track)
    }
    catch {
      // Audit is a bonus.
    }
    hapusTrackOpen.value = false
    careerOpen.value = false
    toast.add({ title: 'Track dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const hapusSc = ref<HrSuccession | null>(null)
const hapusScOpen = ref(false)
async function jalanHapusSc() {
  if (!hapusSc.value) return
  try {
    await hrDelete('successions', hapusSc.value.id)
    try {
      await hrPostAudit('SUCCESSION_DEL', hapusSc.value.position)
    }
    catch {
      // Audit is a bonus.
    }
    hapusScOpen.value = false
    toast.add({ title: 'Kandidat dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
async function sesudah() {
  await refresh()
}
const nadaReadiness = (r: string): 'success' | 'gold' | 'info' => (r === 'Ready Now' ? 'success' : r === '6 Bulan' ? 'gold' : 'info')
</script>

<template>
  <AppPage
    title="Career & succession"
    description="Jenjang karier & kandidat pengganti."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      title="Career path per track"
      icon="i-lucide-trending-up"
      description="Syarat naik level transparan, semua kru bisa lihat jalurnya."
    >
      <div class="grid gap-4 lg:grid-cols-3">
        <div
          v-for="cp in tracks"
          :key="cp.id"
          class="rounded-panel border border-default p-4"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="font-semibold text-highlighted">
              {{ cp.track }}
            </p>
            <UButton
              v-if="bisa"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Sunting track"
              @click="bukaTrack(cp)"
            />
          </div>
          <ol class="space-y-1.5">
            <li
              v-for="(st, i) in cp.steps"
              :key="st"
              class="flex items-center gap-2 text-sm"
            >
              <span class="size-1.5 shrink-0 rounded-full bg-primary-400" />
              <span>{{ st }}</span>
              <AppStatus
                v-if="i === cp.steps.length - 1"
                color="gold"
                size="sm"
              >
                puncak
              </AppStatus>
            </li>
          </ol>
          <p class="mt-2 text-xs text-muted">
            <b>Syarat naik:</b> {{ cp.req }}
          </p>
        </div>
        <button
          v-if="bisa"
          type="button"
          class="flex min-h-24 items-center justify-center rounded-panel border border-dashed border-default text-sm font-semibold text-muted hover:border-primary-400 hover:text-highlighted"
          @click="bukaTrack(null)"
        >
          Tambah track baru
        </button>
      </div>
    </AppPanel>

    <AppPanel
      title="Succession planning"
      icon="i-lucide-users"
      :count="suksesi.length"
      description="Siapa siap menggantikan siapa. Kunci buka outlet berikutnya."
      flush
    >
      <template
        v-if="bisa"
        #actions
      >
        <UButton
          label="Kandidat"
          icon="i-lucide-plus"
          size="sm"
          @click="bukaSuksesi(null)"
        />
      </template>

      <UTable
        class="hidden lg:block"
        :data="suksesi"
        :columns="kolom"
        empty="Belum ada kandidat suksesi. Mulai dari posisi kunci: Store Manager, Head Chef, Head Bar, Event Manager."
      >
        <template #pos-cell="{ row }">
          <span class="font-semibold text-highlighted">{{ row.original.sc.position }}</span>
        </template>
        <template #kandidat-cell="{ row }">
          {{ row.original.nama }}
          <p class="text-[13px] text-muted">
            {{ row.original.role }}
          </p>
        </template>
        <template #readiness-cell="{ row }">
          <AppStatus
            :color="nadaReadiness(row.original.sc.readiness)"
            size="sm"
          >
            {{ row.original.sc.readiness }}
          </AppStatus>
        </template>
        <template #gap-cell="{ row }">
          <span class="line-clamp-3 max-w-64 whitespace-normal">{{ row.original.sc.gap || '—' }}</span>
        </template>
        <template #score-cell="{ row }">
          <template v-if="row.original.ps">
            <span class="font-semibold num">{{ Math.round(row.original.ps.score * 10) / 10 }}</span>
            <HrGrade
              :s="s"
              :score="row.original.ps.score"
              :completeness="row.original.ps.completeness"
              class="ms-1"
            />
          </template>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #aksi-cell="{ row }">
          <div
            v-if="bisa"
            class="flex justify-end gap-1"
          >
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Sunting kandidat"
              @click="bukaSuksesi(row.original.sc)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              aria-label="Hapus kandidat"
              @click="hapusSc = row.original.sc; hapusScOpen = true"
            />
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="x in suksesi"
          :key="x.sc.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ x.sc.position }}
              </p>
              <p class="text-sm text-muted">
                {{ x.nama }} · {{ x.role || '—' }}
              </p>
            </div>
            <AppStatus
              :color="nadaReadiness(x.sc.readiness)"
              size="sm"
            >
              {{ x.sc.readiness }}
            </AppStatus>
          </div>
          <p
            v-if="x.sc.gap"
            class="rounded-field bg-muted px-3 py-2 text-sm"
          >
            Gap: {{ x.sc.gap }}
          </p>
          <div class="flex items-center justify-between gap-2">
            <span
              v-if="x.ps"
              class="flex items-center gap-1 text-sm"
            >
              <b class="num">{{ Math.round(x.ps.score * 10) / 10 }}</b>
              <HrGrade
                :s="s"
                :score="x.ps.score"
                :completeness="x.ps.completeness"
              />
            </span>
            <div
              v-if="bisa"
              class="flex gap-1"
            >
              <UButton
                label="Sunting"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaSuksesi(x.sc)"
              />
              <UButton
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusSc = x.sc; hapusScOpen = true"
              />
            </div>
          </div>
        </article>
      </div>
    </AppPanel>

    <HrCareerSheet
      v-model:open="careerOpen"
      :cp="editTrack"
      @saved="sesudah"
      @hapus="hapusTrackOpen = true"
    />
    <HrSuksesiSheet
      v-model:open="suksesiOpen"
      :sc="editSc"
      @saved="sesudah"
    />

    <ResponsiveSheet
      v-model:open="hapusTrackOpen"
      :title="editTrack ? `Hapus track ${editTrack.track}?` : 'Hapus track?'"
    >
      <p class="text-sm">
        Jenjang dan syaratnya ikut terhapus. Tidak bisa dikembalikan.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          @click="jalanHapusTrack"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusTrackOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusScOpen"
      title="Hapus kandidat ini?"
    >
      <p class="text-sm">
        Baris suksesi dihapus. Tidak bisa dikembalikan.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          @click="jalanHapusSc"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusScOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
