<!--
  HR › Kru (deploy/hr/index.html RENDER.emp :2428-2462).

  PERFORMANCE data only — KTP, NPWP, contract and payroll stay in Talenta.
  Crew rows appear here by themselves when someone opens the module through
  Office (the composable serves the session an incomplete record; the roster
  sync stores it); "lengkapi data" marks a row that still lacks
  division/job/join date, because KPI and Career Path read those.

  Roster sync note (docs/migrasi/hr.md §I): the legacy app pulled Office's hr
  roster and rewrote the WHOLE document. v1 writes per record, and this screen
  deliberately does the SAFE subset — create missing rows, refresh
  name/talentaId/role/status, report leftovers. It never deletes a ghost and
  never claims an id, so no history can be orphaned by a background sync.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrEmployee } from '~/utils/hr'
import { activeSP, peopleScore } from '~/utils/people-score'
import { canHr, cariKruSesi, divName, needsSetup, scopeEmps } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

interface Baris { e: HrEmployee, score: ReturnType<typeof peopleScore> | null, sp: string }

const toast = useToast()
const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const { data: members } = useModulMembers('hr')
const admin = computed(() => canHr('manageOps', cu.value, officeAdmin.value))

const q = ref('')
const daftar = computed<Baris[]>(() => {
  const kata = q.value.trim().toLowerCase()
  return scopeEmps(s.value, cu.value, officeAdmin.value)
    .filter(e => !kata || `${e.name} ${e.role}`.toLowerCase().includes(kata))
    .map(e => ({
      e,
      score: e.appRole === 'ceo' ? null : peopleScore(s.value, e, hariIni().slice(0, 7)),
      sp: activeSP(s.value, e.id),
    }))
})
const belumLengkap = computed(() => scopeEmps(s.value, cu.value, officeAdmin.value).filter(needsSetup))

const kolom: TableColumn<Baris>[] = [
  { id: 'nama', header: 'Nama' },
  { id: 'jabatan', header: 'Jabatan' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'level', header: 'Level' },
  { id: 'join', header: 'Bergabung' },
  { id: 'sp', header: 'SP aktif' },
  { id: 'score', header: 'Score' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const inisial = (n: string) => String(n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase()
const namaDiv = (e: HrEmployee) => (e.divId ? divName(s.value, e.divId) : 'belum diisi')

const formOpen = ref(false)
const formE = ref<HrEmployee | null>(null)
function bukaForm(e: HrEmployee | null) {
  formE.value = e
  formOpen.value = true
}
const profilOpen = ref(false)
const profilE = ref<HrEmployee | null>(null)
function bukaProfil(e: HrEmployee) {
  profilE.value = e
  profilOpen.value = true
}
async function sesudah() {
  await refresh()
}

// ---- safe roster sync (admin only, once per session)
const sinkronSelesai = useState('hr-sinkron-selesai', () => false)
async function sinkronRoster() {
  if (!admin.value || sinkronSelesai.value) return
  const list = members.value ?? []
  if (!list.length) return
  sinkronSelesai.value = true
  let dibuat = 0
  let diubah = 0
  for (const m of list) {
    if (!m?.id) continue
    const appRole = m.isModuleAdmin ? 'hr' : 'staff'
    const u = cariKruSesi(s.value, { userId: m.id, name: m.name, talentaId: m.talentaId })
    if (!u) {
      try {
        await hrCreate('employees', {
          id: m.id,
          name: m.name || '(tanpa nama)',
          role: '',
          divId: '',
          level: 'Staff',
          appRole,
          joinDate: '',
          birthDate: '',
          status: m.active === false ? 'Nonaktif' : 'Aktif',
          phone: '',
          email: '',
          notes: '',
          probationEnd: '',
          contractEnd: '',
          talentaId: String(m.talentaId || ''),
        })
        dibuat++
      }
      catch {
        // Already exists server-side (409) or refused; the next read settles it.
      }
      continue
    }
    const patch: Record<string, string> = {}
    if (m.name && u.name !== m.name) patch.name = m.name
    if (m.isModuleAdmin && u.appRole !== 'hr') patch.appRole = 'hr'
    if (m.active === false && u.status === 'Aktif') patch.status = 'Nonaktif'
    const tid = String(m.talentaId || '')
    if (tid && u.talentaId !== tid) patch.talentaId = tid
    if (Object.keys(patch).length) {
      try {
        await hrUpdate('employees', u.id, { ...u, ...patch })
        diubah++
      }
      catch {
        // Leave it for the next sync.
      }
    }
  }
  const diOffice = new Set(list.map(m => m.id))
  const yatim = s.value.employees.filter(e => !diOffice.has(e.id) && needsSetup(e)).length
  if (dibuat || diubah || yatim) {
    try {
      await hrPostAudit('ROSTER_SYNC', `dibuat ${dibuat}, diubah ${diubah}, tanpa akun ${yatim}`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({
      title: `Sinkron roster: ${dibuat} kru baru, ${diubah} diperbarui${yatim ? `, ${yatim} baris tanpa akun Office dibiarkan` : ''}`,
      color: 'info',
    })
  }
  await refresh()
}
onMounted(() => {
  sinkronRoster()
})
async function jalanSinkron() {
  sinkronSelesai.value = false
  await sinkronRoster()
}
</script>

<template>
  <AppPage
    title="Kru"
    description="Data kru & profil kinerja."
  >
    <template
      v-if="admin"
      #actions
    >
      <UButton
        label="Kru baru"
        icon="i-lucide-plus"
        @click="bukaForm(null)"
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
      v-if="!admin"
      title="Halaman ini untuk admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Data kru diatur admin modul <b>hr</b> (dari Kelola Akses Office).
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="q"
            icon="i-lucide-search"
            placeholder="Cari nama / jabatan…"
            class="w-full max-w-64"
          />
          <UButton
            label="Sinkron roster Office"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="jalanSinkron"
          />
        </div>
        <p class="mt-3 rounded-field bg-muted px-3 py-2 text-sm text-muted">
          Staff Performance menyimpan data <b>performa</b>. Dokumen administratif (KTP, NPWP, kontrak, payroll)
          tetap di Talenta. Jangan duplikasi data sensitif di sini.
        </p>
        <p
          v-if="belumLengkap.length"
          class="mt-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>{{ belumLengkap.length }} kru baru muncul dari login Office tapi datanya belum lengkap</b>
          ({{ belumLengkap.map(e => e.name).join(', ') }}). Lengkapi divisi, jabatan, dan tanggal gabung lewat tombol
          sunting, karena KPI divisi dan syarat naik level dihitung dari data itu.
        </p>
        <p
          v-if="members && members.length && s.employees.length >= members.length"
          class="mt-2 text-xs text-muted"
        >
          Sinkron tidak pernah menghapus baris yang tidak ada di Office — baris begitu dilaporkan, keputusan ada di
          HRD.
        </p>
      </AppPanel>

      <AppPanel
        title="Daftar kru"
        icon="i-lucide-users"
        :count="daftar.length"
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="daftar"
          :columns="kolom"
          :loading="!s.employees.length"
          empty="Belum ada kru. Kru muncul otomatis begitu mereka membuka modul ini lewat Office."
        >
          <template #nama-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-field bg-primary-600 text-[11px] font-bold text-white">{{ inisial(row.original.e.name) }}</span>
              <b class="text-highlighted">{{ row.original.e.name }}</b>
              <AppStatus
                v-if="needsSetup(row.original.e)"
                color="warning"
                size="sm"
              >
                lengkapi data
              </AppStatus>
            </div>
          </template>
          <template #jabatan-cell="{ row }">
            <span
              v-if="row.original.e.role"
              class="text-sm"
            >{{ row.original.e.role }}</span>
            <span
              v-else
              class="text-muted"
            >belum diisi</span>
          </template>
          <template #divisi-cell="{ row }">
            <span class="text-sm">{{ namaDiv(row.original.e) }}</span>
          </template>
          <template #level-cell="{ row }">
            <AppStatus size="sm">
              {{ row.original.e.level }}
            </AppStatus>
          </template>
          <template #join-cell="{ row }">
            <span class="text-muted num">{{ row.original.e.joinDate || '–' }}</span>
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
          <template #score-cell="{ row }">
            <template v-if="row.original.score">
              <span class="font-semibold num">{{ Math.round(row.original.score.score * 10) / 10 }}</span>
              <HrGrade
                :s="s"
                :score="row.original.score.score"
                :completeness="row.original.score.completeness"
                class="ms-1"
              />
            </template>
            <span
              v-else
              class="text-muted"
            >–</span>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                label="Profil"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaProfil(row.original.e)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Sunting kru"
                @click="bukaForm(row.original.e)"
              />
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="x in daftar"
            :key="x.e.id"
            class="space-y-2 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ x.e.name }}
                  <AppStatus
                    v-if="needsSetup(x.e)"
                    color="warning"
                    size="sm"
                    class="ms-1"
                  >
                    lengkapi data
                  </AppStatus>
                </p>
                <p class="text-sm text-muted">
                  {{ x.e.role || 'belum diisi' }} · {{ namaDiv(x.e) }} · {{ x.e.level }}
                </p>
              </div>
              <span
                v-if="x.score"
                class="shrink-0 text-end"
              >
                <span class="font-display text-lg font-bold text-highlighted num">{{ Math.round(x.score.score * 10) / 10 }}</span>
                <HrGrade
                  :s="s"
                  :score="x.score.score"
                  :completeness="x.score.completeness"
                />
              </span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted num">Gabung {{ x.e.joinDate || '–' }} · SP {{ x.sp || '–' }}</span>
              <div class="flex gap-1">
                <UButton
                  label="Profil"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaProfil(x.e)"
                />
                <UButton
                  label="Sunting"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="bukaForm(x.e)"
                />
              </div>
            </div>
          </article>
          <p
            v-if="!daftar.length"
            class="px-4 py-8 text-center text-muted"
          >
            Belum ada kru. Kru muncul otomatis begitu mereka membuka modul ini lewat Office.
          </p>
        </div>
      </AppPanel>
    </template>

    <HrEmpSheet
      v-model:open="formOpen"
      :e="formE"
      @saved="sesudah"
    />
    <HrProfil
      v-model:open="profilOpen"
      :e="profilE"
    />
  </AppPage>
</template>
