<!--
  Analytics › Performa Konten. Reach, Engagement Rate, Virality Index, CTA
  Click Rate & Content Pillar, all platforms
  (deploy/analytics/index.html:8091 vKontenPerf('konten')). The formulas live
  in ~/utils/performa-konten (imported, never copied — the same file the
  Konten module uses). The Konten blob is loaded LAZILY when this page opens
  (idle/muat/ok/galat + "Coba lagi"); the month/platform/sort/search choice
  is shared with Performa Desain through useKeadaanPk('analytics-pk'), like
  the old shared PK_ST_AN.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsIzin, ROLE_LABEL_ANALYTICS } from '~/utils/layar/analytics'
import { getStateKonten, normStateKonten, useKeadaanPk } from '~/composables/useKonten'
import {
  pkAdaData, pkAggCTR, pkAggER, pkAggViral, pkBulanIni, pkKumpul, pkPerPillar,
  pkPerPlatform, pkPersen, pkTotal, pkUrutKonten,
  type KontenPk, type UrutPk,
} from '~/utils/performa-konten'
import { angka } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('konten'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const keadaan = useKeadaanPk('analytics-pk')
if (!keadaan.value.bulan) keadaan.value.bulan = pkBulanIni()

/* Lazy Konten blob, shared with the Desain page under one key: opening the
   second page reuses the first page's fetch. A failure parks in 'galat' and
   stays there until "Coba lagi" — without that the page would refetch,
   fail, render, refetch forever. */
const { data: stKonten, status: stStatus, error: stError, refresh: stRefresh } = useAsyncData(
  'analytics-konten-state',
  () => getStateKonten().then(r => normStateKonten(r.data)),
  { server: false },
)
const fase = computed(() => {
  if (stStatus.value === 'pending' && !stKonten.value) return 'muat'
  if (stStatus.value === 'error' || (stStatus.value === 'success' && !stKonten.value)) return 'galat'
  if (stKonten.value) return 'ok'
  return 'idle'
})
const galatPesan = computed(() => apiErrorMessage(stError.value, 'Modul Konten tidak menjawab.'))

const kumpul = computed(() => pkKumpul(stKonten.value?.content ?? [], {
  bulan: keadaan.value.bulan,
  plat: keadaan.value.plat,
  cari: keadaan.value.cari,
}))
const total = computed(() => pkTotal(kumpul.value))
const perPlat = computed(() => pkPerPlatform(kumpul.value.baris))
const perPilar = computed(() => pkPerPillar(kumpul.value.konten))
const urutList = computed<KontenPk[]>(() => pkUrutKonten(kumpul.value.konten, keadaan.value.urut as UrutPk))
const bulanOps = computed(() => Object.keys(kumpul.value.bulanAda).sort().reverse())
const platOps = computed(() => [...new Set(kumpul.value.baris.filter(r => !r.warisan).map(r => r.plat))].sort())

const fmtPersen = (v: number | null) => v === null ? '—' : `${pkPersen(v)}%`
const kolomPlat: TableColumn<{ nama: string, a: typeof total.value }>[] = [
  { accessorKey: 'nama', header: 'Platform' },
  { accessorKey: 'reach', header: 'Reach' },
  { accessorKey: 'er', header: 'Engagement Rate' },
  { accessorKey: 'viral', header: 'Virality Index' },
  { accessorKey: 'cta', header: 'CTA Click Rate' },
]
const kolomPilar = kolomPlat
</script>

<template>
  <AppPage
    title="Performa Konten"
    description="Reach, Engagement Rate, Virality Index, CTA Click Rate & Content Pillar — semua platform"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="stStatus === 'pending'"
        @click="() => stRefresh()"
      />
    </template>

    <UAlert
      v-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman &quot;Performa Konten&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <AppPanel
        v-if="fase === 'idle' || fase === 'muat'"
        title="Memuat data modul Konten"
      >
        <p class="text-sm text-muted">
          Angka performanya diisi tim konten di modul Konten → Input Performa, dan dibaca dari sana apa adanya. Tidak ada salinannya di modul ini.
        </p>
        <USkeleton class="mt-3 h-24 w-full" />
      </AppPanel>

      <UAlert
        v-else-if="fase === 'galat'"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Data modul Konten tidak terbaca"
        :description="`${galatPesan} Angka performanya diisi tim konten di modul Konten → Input Performa, dan dibaca dari sana apa adanya.`"
      >
        <template #actions>
          <UButton
            label="Coba lagi"
            color="error"
            variant="soft"
            size="xs"
            @click="() => stRefresh()"
          />
        </template>
      </UAlert>

      <template v-else>
        <div class="mb-4 flex flex-wrap items-center gap-1.5">
          <span class="text-sm font-semibold">Bulan</span>
          <AppChips
            v-model="keadaan.bulan"
            :options="[{ value: '', label: 'Semua' }, ...bulanOps.map(b => ({ value: b, label: b }))]"
          />
          <span class="text-sm font-semibold">Platform</span>
          <AppChips
            v-model="keadaan.plat"
            :options="[{ value: '', label: 'Semua' }, ...platOps.map(p => ({ value: p, label: p }))]"
          />
        </div>
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <UInput
            v-model="keadaan.cari"
            placeholder="Cari judul atau pillar…"
            icon="i-lucide-search"
            size="sm"
            class="min-w-40 flex-1"
          />
          <AppSeg
            v-model="keadaan.urut"
            size="sm"
            :options="[{ value: 'reach', label: 'Reach' }, { value: 'er', label: 'Engagement Rate' }, { value: 'viral', label: 'Virality' }, { value: 'cta', label: 'CTA' }]"
          />
        </div>

        <UAlert
          v-if="!kumpul.konten.length"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Belum ada konten tayang yang punya angka performa"
          description="Konten yang tayang tapi belum diisi angkanya tidak ikut dihitung — mengisinya di modul Konten → Input Performa."
        />

        <template v-else>
          <AppStatGrid>
            <AppStat
              label="Reach"
              :value="angka(total.dasar)"
              icon="i-lucide-eye"
              tone="gold"
              :sub="`${angka(total.n)} konten tayang`"
            />
            <AppStat
              label="Engagement Rate"
              :value="fmtPersen(pkAggER(total))"
              icon="i-lucide-heart"
              tone="info"
              sub="likes + komentar + shares + saves ÷ reach"
            />
            <AppStat
              label="Virality Index"
              :value="fmtPersen(pkAggViral(total))"
              icon="i-lucide-trending-up"
              tone="success"
              sub="shares + saves ÷ reach"
            />
            <AppStat
              label="CTA Click Rate"
              :value="fmtPersen(pkAggCTR(total))"
              icon="i-lucide-mouse-pointer-click"
              tone="info"
              sub="klik ajakan ÷ reach"
            />
          </AppStatGrid>
          <p
            v-if="kumpul.tanpaData"
            class="mt-2 text-xs text-muted"
          >
            {{ angka(kumpul.tanpaData) }} konten tayang belum punya angka performa, jadi tidak ikut di kartu di atas.
          </p>

          <AppPanel
            title="Per Platform"
            description="Satu konten yang tayang di dua platform dihitung di dua barisnya."
            flush
          >
            <UTable
              class="hidden lg:block"
              :data="perPlat"
              :columns="kolomPlat"
            >
              <template #nama-cell="{ row }">
                <b>{{ row.original.nama }}</b>
              </template>
              <template #reach-cell="{ row }">
                <span class="num">{{ angka(row.original.a.dasar) }}</span>
              </template>
              <template #er-cell="{ row }">
                <b class="num">{{ fmtPersen(pkAggER(row.original.a)) }}</b>
              </template>
              <template #viral-cell="{ row }">
                <b class="num">{{ fmtPersen(pkAggViral(row.original.a)) }}</b>
              </template>
              <template #cta-cell="{ row }">
                <b class="num">{{ fmtPersen(pkAggCTR(row.original.a)) }}</b>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="x in perPlat"
                :key="x.nama"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <b class="text-sm">{{ x.nama }}</b>
                  <b class="num text-sm">{{ fmtPersen(pkAggER(x.a)) }}</b>
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ angka(x.a.dasar) }} reach · virality {{ fmtPersen(pkAggViral(x.a)) }} · CTA {{ fmtPersen(pkAggCTR(x.a)) }}
                </div>
              </div>
            </div>
          </AppPanel>

          <AppPanel
            title="Per Content Pillar"
            description="Konten tiga platform tetap satu konten — dijumlahkan dari agregat per kontennya."
            flush
          >
            <UTable
              class="hidden lg:block"
              :data="perPilar"
              :columns="kolomPilar"
            >
              <template #nama-cell="{ row }">
                <b>{{ row.original.nama }}</b>
              </template>
              <template #reach-cell="{ row }">
                <span class="num">{{ angka(row.original.a.dasar) }}</span>
              </template>
              <template #er-cell="{ row }">
                <b class="num">{{ fmtPersen(pkAggER(row.original.a)) }}</b>
              </template>
              <template #viral-cell="{ row }">
                <b class="num">{{ fmtPersen(pkAggViral(row.original.a)) }}</b>
              </template>
              <template #cta-cell="{ row }">
                <b class="num">{{ fmtPersen(pkAggCTR(row.original.a)) }}</b>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="x in perPilar"
                :key="x.nama"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <b class="text-sm">{{ x.nama }}</b>
                  <b class="num text-sm">{{ fmtPersen(pkAggER(x.a)) }}</b>
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ angka(x.a.n) }} konten · {{ angka(x.a.dasar) }} reach
                </div>
              </div>
            </div>
          </AppPanel>

          <AppPanel
            title="Per Konten"
            :description="`Diurut menurut ${keadaan.urut === 'reach' ? 'reach' : keadaan.urut === 'er' ? 'engagement rate' : keadaan.urut === 'viral' ? 'virality index' : 'CTA click rate'}. Yang tidak punya penyebut (tanpa reach maupun impression) selalu di bawah.`"
            flush
          >
            <div class="divide-y divide-default">
              <div
                v-for="x in urutList"
                :key="x.c.id"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <b class="text-sm">{{ x.c.title || '(tanpa judul)' }}</b>
                  <span
                    v-if="!pkAdaData(x.c)"
                    class="text-xs text-muted"
                  >tanpa angka</span>
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ x.plat.join(' · ') }} · {{ angka(x.agg.dasar) }} reach · ER {{ fmtPersen(pkAggER(x.agg)) }} · virality {{ fmtPersen(pkAggViral(x.agg)) }} · CTA {{ fmtPersen(pkAggCTR(x.agg)) }}
                </div>
              </div>
            </div>
          </AppPanel>
        </template>
      </template>
    </template>
  </AppPage>
</template>
