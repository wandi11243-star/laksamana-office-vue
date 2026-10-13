<!--
  Konten › Content Planning (old VIEWS.planning + renderPlanTable,
  deploy/konten/index.html:1886-1990; konten.md D.2).

  Filters live in useState so they survive leaving and coming back, like the
  old module-level `planFilters`. Typing in the search box only re-draws the
  table (computed), never the box — the old "paint only the table" rule.
  Clicking a row opens the content detail; "Konten baru" opens the form (D.21).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useMediaQuery } from '@vueuse/core'
import type { FilterPlanning, KontenItem } from '~/utils/konten'
import {
  PILLARS, PLATFORM_KONTEN, PRIORITY_KONTEN, STATUS_KONTEN, contentPlatforms, contentTypeLabel, filterPlanningBawaan,
  opsiPicKonten, picCocok, printTypes, saringPlanning, sudahArsip,
} from '~/utils/konten'
import { ikonStatusKonten, warnaPrioKonten, warnaStatusKonten } from '~/utils/status-konten'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const route = useRoute()
const router = useRouter()
const { data: st, error, status } = useStateKonten()
const { saya, can } = useAksesKonten()
const brand = useBrandKonten()
const f = useState<FilterPlanning>('konten-plan-filter', filterPlanningBawaan)
const hal = useState('konten-plan-hal', () => 1)
const per = useState('konten-plan-per', () => 10)

// The top-bar search lands here as ?q=… (modul-shell `cari`).
watch(() => route.query.q, (q) => {
  if (typeof q === 'string') f.value.q = q
}, { immediate: true })

const SEMUA = '__semua'
/** USelect cannot hold '' — map the stored '' (= all) to a sentinel and back. */
const pilih = (k: 'status' | 'platform' | 'pillar' | 'pic') => computed({
  get: () => f.value[k] || SEMUA,
  set: (v: string) => {
    f.value[k] = v === SEMUA ? '' : v
  },
})
const fStatus = pilih('status')
const fPlatform = pilih('platform')
const fPillar = pilih('pillar')
const fPic = pilih('pic')

const semua = computed(() => st.value.content)
const dasar = computed(() => saringBrand(semua.value, brand.value))
const list = computed(() => saringPlanning(dasar.value, f.value))
const tanpaPic = computed(() => saringPlanning(dasar.value, f.value, true))
const arsipN = computed(() => semua.value.filter(sudahArsip).length)
// A new filter goes back to page 1; data growing or shrinking keeps the page.
watch([f, brand], () => {
  hal.value = 1
}, { deep: true })
const halaman = computed(() => list.value.slice((hal.value - 1) * per.value, hal.value * per.value))

const opsiArsip = [
  { value: 'aktif', label: 'Aktif (belum tayang)' },
  { value: 'arsip', label: 'Arsip (tayang/batal)' },
  { value: SEMUA, label: 'Semua' },
]
const fArsip = computed({
  get: () => f.value.arsip || SEMUA,
  set: (v: string) => {
    f.value.arsip = (v === SEMUA ? '' : v) as FilterPlanning['arsip']
  },
})
const opsiStatus = [{ value: SEMUA, label: 'Semua Status' }, ...STATUS_KONTEN.map(s => ({ value: s, label: s }))]
const opsiPlatform = [{ value: SEMUA, label: 'Semua Platform' }, ...PLATFORM_KONTEN.map(p => ({ value: p, label: p }))]
const opsiPillar = [{ value: SEMUA, label: 'Semua Pillar' }, ...PILLARS.map(p => ({ value: p, label: p }))]
const opsiPic = computed(() => opsiPicKonten(
  st.value.users,
  id => (id == null ? tanpaPic.value.length : tanpaPic.value.filter(c => picCocok(id, c.pic)).length),
  saya.value?.user.id,
).map(o => ({ ...o, value: o.value || SEMUA })))

function reset() {
  f.value = filterPlanningBawaan()
}

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
const inisial = (n?: string) => String(n ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const buka = (c: KontenItem) => router.push(`/konten/detail/${c.id}`)

/** Below 1536px Tayang rides under Deadline, so all nine columns fit without
 *  a sideways scroll (DESIGN.md rule 6, same as Dashboard Reservasi). */
const lebar = useMediaQuery('(min-width: 1536px)')
const kolomTampil = computed(() => ({ tayang: lebar.value }))

const kolom: TableColumn<KontenItem>[] = [
  { id: 'konten', header: 'Konten' },
  { id: 'brand', header: 'Brand' },
  { id: 'platform', header: 'Platform' },
  { accessorKey: 'pillar', header: 'Pillar' },
  { id: 'pic', header: 'PIC' },
  { id: 'status', header: 'Status' },
  { id: 'prio', header: 'Prioritas' },
  { id: 'deadline', header: 'Deadline' },
  { id: 'tayang', header: 'Tayang' },
]
</script>

<template>
  <KontenGerbang lihat="planning">
    <AppPage
      title="Content Planning"
      :description="`${semua.length} total konten - ${semua.filter(c => c.status === 'Posted').length} tayang${f.arsip === 'aktif' && arsipN ? ` · ${arsipN} diarsipkan (tayang/batal)` : ''}`"
    >
      <template
        v-if="can('content')"
        #actions
      >
        <UButton
          label="Konten baru"
          icon="i-lucide-plus"
          to="/konten/detail/baru"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />

      <KontenBrandBar :brands="st.brands" />

      <AppPanel>
        <AppFilterGrid>
          <UFormField label="Cari">
            <UInput
              v-model="f.q"
              placeholder="Cari judul / caption…"
              icon="i-lucide-search"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Arsip">
            <USelect
              v-model="fArsip"
              :items="opsiArsip"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelect
              v-model="fStatus"
              :items="opsiStatus"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Platform">
            <USelect
              v-model="fPlatform"
              :items="opsiPlatform"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Pillar">
            <USelect
              v-model="fPillar"
              :items="opsiPillar"
              class="w-full"
            />
          </UFormField>
          <UFormField label="PIC">
            <USelect
              v-model="fPic"
              :items="opsiPic"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="mt-3">
          <UButton
            label="Reset"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            size="sm"
            @click="reset"
          />
        </div>
      </AppPanel>

      <AppPanel
        title="Daftar konten"
        icon="i-lucide-list"
        :count="list.length"
        flush
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <div
          v-if="!list.length"
          class="p-8 text-center"
        >
          <UIcon
            name="i-lucide-clipboard-list"
            class="mx-auto size-7 text-dimmed"
          />
          <p class="mt-2 font-semibold">
            Belum ada konten
          </p>
          <p class="text-sm text-muted">
            Mulai dengan membuat konten baru.
          </p>
        </div>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="halaman"
            :columns="kolom"
            :column-visibility="kolomTampil"
            :ui="{ tr: 'cursor-pointer', th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
            @select="(_e: Event, row: { original: KontenItem }) => buka(row.original)"
          >
            <template #konten-cell="{ row }">
              <b class="text-highlighted">{{ row.original.title || '(tanpa judul)' }}</b>
              <span class="block text-xs font-normal text-muted">{{ contentTypeLabel(row.original) }}<template v-if="printTypes(row.original).length"> - cetak {{ printTypes(row.original).join(' + ') }}</template></span>
            </template>
            <template #brand-cell="{ row }">
              {{ namaBrand(row.original.brand) || '-' }}
            </template>
            <template #platform-cell="{ row }">
              <span class="flex flex-wrap gap-1">
                <UBadge
                  v-for="p in contentPlatforms(row.original).slice(0, 3)"
                  :key="p"
                  :label="p"
                  color="neutral"
                  variant="soft"
                  size="sm"
                />
              </span>
            </template>
            <template #pillar-cell="{ row }">
              <AppStatus
                v-if="row.original.pillar"
                color="gold"
                size="sm"
              >
                {{ row.original.pillar }}
              </AppStatus>
              <span
                v-else
                class="text-dimmed"
              >-</span>
            </template>
            <template #pic-cell="{ row }">
              <span
                v-if="row.original.pic"
                class="inline-flex items-center gap-1.5"
              >
                <span class="flex size-6 flex-none items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">{{ inisial(namaUser(row.original.pic)) }}</span>
                <span>{{ namaUser(row.original.pic).split(' ')[0] || '-' }}</span>
              </span>
              <span
                v-else
                class="text-dimmed"
              >-</span>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="warnaStatusKonten(row.original.status)"
                :icon="ikonStatusKonten(row.original.status)"
                size="sm"
              >
                {{ row.original.status }}
              </AppStatus>
            </template>
            <template #prio-cell="{ row }">
              <AppStatus
                :color="warnaPrioKonten(row.original.priority)"
                size="sm"
              >
                {{ PRIORITY_KONTEN[row.original.priority || 'medium']?.label }}
              </AppStatus>
            </template>
            <template #deadline-cell="{ row }">
              <KontenDeadline
                :tgl="row.original.deadline"
                :selesai="sudahArsip(row.original)"
              />
              <span
                v-if="!lebar"
                class="mt-0.5 block text-xs text-muted num"
              >Tayang {{ row.original.publishDate ? fTglP(row.original.publishDate) : '-' }}</span>
            </template>
            <template #tayang-cell="{ row }">
              <span class="num text-xs">{{ row.original.publishDate ? fTglP(row.original.publishDate) : '-' }}</span>
            </template>
          </UTable>

          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="c in halaman"
              :key="c.id"
            >
              <NuxtLink
                :to="`/konten/detail/${c.id}`"
                class="block p-4 hover:bg-muted"
              >
                <div class="flex items-start justify-between gap-2">
                  <b class="min-w-0 text-highlighted">{{ c.title || '(tanpa judul)' }}</b>
                  <KontenDeadline
                    :tgl="c.deadline"
                    :selesai="sudahArsip(c)"
                  />
                </div>
                <p class="mt-0.5 text-xs text-muted">
                  {{ [namaBrand(c.brand), contentPlatforms(c).join(' · '), c.pillar, namaUser(c.pic).split(' ')[0]].filter(Boolean).join(' · ') }}
                </p>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <AppStatus
                    :color="warnaStatusKonten(c.status)"
                    :icon="ikonStatusKonten(c.status)"
                    size="sm"
                  >
                    {{ c.status }}
                  </AppStatus>
                  <AppStatus
                    :color="warnaPrioKonten(c.priority)"
                    size="sm"
                  >
                    {{ PRIORITY_KONTEN[c.priority || 'medium']?.label }}
                  </AppStatus>
                </div>
              </NuxtLink>
            </li>
          </ul>
          <KontenPager
            v-model:hal="hal"
            v-model:per="per"
            :total="list.length"
            satuan="konten"
          />
        </template>
      </AppPanel>
    </AppPage>
  </KontenGerbang>
</template>
