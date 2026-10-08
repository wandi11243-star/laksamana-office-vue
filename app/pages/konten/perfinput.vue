<!--
  Konten › Input Performa (old VIEWS.perfinput + gambarPerfTabel,
  deploy/konten/index.html:4417-4507; konten.md D.11).

  Only Posted items. Tabs Belum lengkap / Sudah lengkap / Semua (default
  Belum), counts computed BEFORE the tab filter; search on title + pillar;
  Reset back to Belum. "Lengkap" = every listed platform has figures (an old
  flat record does not count). "Isi / Ubah" (who may edit `analytics`) opens
  KontenPerfForm. Typing only re-draws the table (computed), never the box.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FilterPerf, PerfBaris } from '~/utils/performa-konten'
import { filterPerfBawaan, perfBaris, perfHitung, perfSaring } from '~/utils/performa-konten'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()
const f = useState<FilterPerf>('konten-perf-filter', filterPerfBawaan)
const hal = useState('konten-perf-hal', () => 1)
const per = useState('konten-perf-per', () => 10)

const rows = computed(() => perfBaris(saringBrand(st.value.content, brand.value)))
const h = computed(() => perfHitung(rows.value))
const list = computed(() => perfSaring(rows.value, f.value))
watch([f, brand], () => {
  hal.value = 1
}, { deep: true })
const halaman = computed(() => list.value.slice((hal.value - 1) * per.value, hal.value * per.value))

const tab = computed({
  get: () => f.value.isi || 'semua',
  set: (v: string) => {
    f.value.isi = (v === 'semua' ? '' : v) as FilterPerf['isi']
  },
})
const opsiTab = computed(() => [
  { value: 'belum', label: 'Belum lengkap', badge: h.value.belum },
  { value: 'lengkap', label: 'Sudah lengkap', badge: h.value.lengkap },
  { value: 'semua', label: 'Semua', badge: h.value.semua },
])
function reset() {
  f.value = filterPerfBawaan()
}

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const tglTayang = (r: PerfBaris) => {
  const v = r.c.publishRecord?.at || r.c.publishDate
  return v ? fTglP(String(v).slice(0, 10)) : '-'
}

const formBuka = ref(false)
// by id, so the form always reads the row's CURRENT figures
const formId = ref('')
const formItem = computed(() => st.value.content.find(x => x.id === formId.value) ?? null)
const toast = useToast()
function buka(r: PerfBaris) {
  if (!r.plats.length) {
    toast.add({ title: 'Konten ini belum punya platform', description: 'Isi Platform-nya dulu di detail konten.', color: 'error' })
    navigateTo(`/konten/detail/${r.c.id}`)
    return
  }
  formId.value = r.c.id
  formBuka.value = true
}

const kolom: TableColumn<PerfBaris>[] = [
  { id: 'konten', header: 'Konten' },
  { id: 'brand', header: 'Brand' },
  { id: 'platform', header: 'Platform' },
  { id: 'pillar', header: 'Content Pillar' },
  { id: 'tayang', header: 'Tayang' },
  { id: 'terisi', header: 'Terisi' },
  { id: 'aksi', header: '' },
]
</script>

<template>
  <AppPage
    title="Input Performa"
    description="Angka insight tiap platform — reach, impression, likes, komentar, share, save, dan klik CTA. Yang tampil hanya konten berstatus Posted: performa konten yang belum tayang tidak ada di platform mana pun."
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />

    <KontenBrandBar :brands="st.brands" />

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <AppSeg
          v-model="tab"
          :options="opsiTab"
          size="sm"
        />
        <UInput
          v-model="f.q"
          placeholder="Cari judul konten…"
          icon="i-lucide-search"
          class="w-full sm:w-60"
        />
        <UButton
          label="Reset"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          size="sm"
          @click="reset"
        />
        <span class="text-xs text-muted sm:ms-auto">{{ list.length }} konten</span>
      </div>
      <p
        v-if="h.tanpaPlat"
        class="mt-3 text-xs text-warning"
      >
        {{ h.tanpaPlat }} konten tayang belum punya satu pun platform, jadi angkanya tidak bisa dicatat per platform.
        Buka kontennya lalu isi <b>Platform</b>-nya dulu.
      </p>
    </AppPanel>

    <AppPanel
      flush
      :class="status === 'pending' ? 'opacity-60' : ''"
    >
      <div
        v-if="!list.length"
        class="p-8 text-center"
      >
        <UIcon
          name="i-lucide-chart-column"
          class="mx-auto size-7 text-dimmed"
        />
        <p class="mt-2 font-semibold">
          {{ f.q ? 'Tidak ada yang cocok' : 'Tidak ada konten di kategori ini' }}
        </p>
        <p class="text-sm text-muted">
          {{ f.q ? 'Ubah kata kunci atau tekan Reset.' : 'Tandai konten sudah tayang di halaman Publishing lebih dulu.' }}
        </p>
      </div>
      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="halaman"
          :columns="kolom"
        >
          <template #konten-cell="{ row }">
            <button
              type="button"
              class="text-left"
              @click="buka(row.original)"
            >
              <b class="text-highlighted">{{ row.original.c.title || '(tanpa judul)' }}</b>
              <span
                v-if="row.original.warisan"
                class="block text-xs text-muted"
              >punya catatan performa lama yang tidak per platform</span>
            </button>
          </template>
          <template #brand-cell="{ row }">
            {{ namaBrand(row.original.c.brand) }}
          </template>
          <template #platform-cell="{ row }">
            <span
              v-if="row.original.plats.length"
              class="flex flex-wrap gap-1"
            >
              <UBadge
                v-for="p in row.original.plats"
                :key="p"
                :label="p"
                color="neutral"
                variant="soft"
                size="sm"
              />
            </span>
            <span
              v-else
              class="text-xs text-warning"
            >belum ada platform</span>
          </template>
          <template #pillar-cell="{ row }">
            {{ row.original.c.pillar || '-' }}
          </template>
          <template #tayang-cell="{ row }">
            <span class="num text-xs text-muted">{{ tglTayang(row.original) }}</span>
          </template>
          <template #terisi-cell="{ row }">
            <AppStatus
              :color="row.original.lengkap ? 'success' : 'warning'"
              :icon="row.original.lengkap ? 'i-lucide-check' : 'i-lucide-hourglass'"
              size="sm"
            >
              {{ row.original.terisi }} / {{ row.original.plats.length }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              v-if="can('analytics')"
              :label="row.original.lengkap ? 'Ubah' : 'Isi'"
              :color="row.original.lengkap ? 'neutral' : 'primary'"
              :variant="row.original.lengkap ? 'outline' : 'solid'"
              size="sm"
              @click="buka(row.original)"
            />
          </template>
        </UTable>

        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="r in halaman"
            :key="r.c.id"
            class="flex items-start gap-3 p-4"
          >
            <div class="min-w-0 flex-1">
              <b class="text-highlighted">{{ r.c.title || '(tanpa judul)' }}</b>
              <p class="mt-0.5 text-xs text-muted">
                {{ [namaBrand(r.c.brand), r.plats.join(' · ') || 'belum ada platform', r.c.pillar, tglTayang(r)].filter(Boolean).join(' · ') }}
              </p>
              <p
                v-if="r.warisan"
                class="text-xs text-muted"
              >
                punya catatan performa lama yang tidak per platform
              </p>
              <AppStatus
                class="mt-1.5"
                :color="r.lengkap ? 'success' : 'warning'"
                :icon="r.lengkap ? 'i-lucide-check' : 'i-lucide-hourglass'"
                size="sm"
              >
                Terisi {{ r.terisi }} / {{ r.plats.length }}
              </AppStatus>
            </div>
            <UButton
              v-if="can('analytics')"
              :label="r.lengkap ? 'Ubah' : 'Isi'"
              :color="r.lengkap ? 'neutral' : 'primary'"
              :variant="r.lengkap ? 'outline' : 'solid'"
              size="sm"
              @click="buka(r)"
            />
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

    <KontenPerfForm
      v-model:open="formBuka"
      :item="formItem"
    />
  </AppPage>
</template>
