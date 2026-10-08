<!--
  Analytics › Performa Desain. Virality of designed content vs the rest, plus
  finished design jobs per category (deploy/analytics/index.html:8121
  vKontenPerf('desain')). Same lazy Konten blob as Performa Konten (one key,
  'analytics-konten-state'), same shared month choice; the category mode
  (pillar/jenis/cetak) is this page's own. Formulas from
  ~/utils/performa-konten, never copied.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsIzin, ROLE_LABEL_ANALYTICS } from '~/utils/layar/analytics'
import { getStateKonten, normStateKonten, useKeadaanPk } from '~/composables/useKonten'
import {
  pkAggViral, pkBandingDesain, pkBulanDesain, pkBulanIni, pkDesainKategori, pkDesainRows,
  pkKumpul, pkPersen,
  type KatPk,
} from '~/utils/performa-konten'
import { angka } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('desain'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const keadaan = useKeadaanPk('analytics-pk')
if (!keadaan.value.bulan) keadaan.value.bulan = pkBulanIni()

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

const kumpul = computed(() => pkKumpul(stKonten.value?.content ?? [], { bulan: keadaan.value.bulan }))
const banding = computed(() => pkBandingDesain(kumpul.value))
const fmtPersen = (v: number | null) => v === null ? '—' : `${pkPersen(v)}%`

const semuaDesain = computed(() => pkDesainRows(stKonten.value?.content ?? [], stKonten.value?.prodTasks ?? []))
const desainBulan = computed(() => {
  if (!keadaan.value.bulan) return semuaDesain.value
  return semuaDesain.value.filter(r => pkBulanDesain(r) === keadaan.value.bulan)
})
const katMode = ref<KatPk>('pillar')
const katHasil = computed(() => pkDesainKategori(desainBulan.value, katMode.value))
const bulanOps = computed(() => {
  const ada = new Set<string>()
  for (const r of semuaDesain.value) {
    const b = pkBulanDesain(r)
    if (b) ada.add(b)
  }
  for (const b of Object.keys(kumpul.value.bulanAda)) ada.add(b)
  return [...ada].sort().reverse()
})

interface BarisKat { nama: string, n: number, konten: number, mandiri: number }
const kolomKat: TableColumn<BarisKat>[] = [
  { accessorKey: 'nama', header: 'Kategori' },
  { accessorKey: 'n', header: 'Selesai' },
  { accessorKey: 'konten', header: 'Dari konten' },
  { accessorKey: 'mandiri', header: 'Mandiri' },
]
</script>

<template>
  <AppPage
    title="Performa Desain"
    description="Virality konten berdesain, dan jumlah desain selesai per kategori"
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
      :description="`Hak akses kamu di halaman &quot;Performa Desain&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <AppPanel
        v-if="fase === 'idle' || fase === 'muat'"
        title="Memuat data modul Konten"
      >
        <p class="text-sm text-muted">
          Desain yang selesai dibaca dari modul Konten — langsung dari sana, tanpa salinan di modul ini.
        </p>
        <USkeleton class="mt-3 h-24 w-full" />
      </AppPanel>

      <UAlert
        v-else-if="fase === 'galat'"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Data modul Konten tidak terbaca"
        :description="galatPesan"
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
        </div>

        <AppPanel
          title="Virality: Berdesain vs Tanpa Desain"
          description="Perbandingannya harus ada — kalau seluruh konten bulan ini berdesain (atau tidak satu pun), sisi yang kosong mengatakannya, bukan nol."
        >
          <AppStatGrid>
            <AppStat
              label="Berdesain"
              :value="fmtPersen(pkAggViral(banding.pakai))"
              icon="i-lucide-palette"
              tone="gold"
              :sub="`${angka(banding.pakai.n)} konten · ${angka(banding.pakai.dasar)} reach`"
            />
            <AppStat
              label="Tanpa Desain"
              :value="fmtPersen(pkAggViral(banding.tanpa))"
              icon="i-lucide-file"
              tone="info"
              :sub="`${angka(banding.tanpa.n)} konten · ${angka(banding.tanpa.dasar)} reach`"
            />
          </AppStatGrid>
          <UAlert
            v-if="!banding.pakai.n || !banding.tanpa.n"
            class="mt-3"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="Satu sisinya kosong"
            :description="!banding.pakai.n ? 'Tidak satu pun konten bulan ini memakai desain — sisi berdesain memang tidak ada, bukan nol.' : 'Seluruh konten bulan ini memakai desain — sisi tanpa desain memang tidak ada, bukan nol.'"
          />
        </AppPanel>

        <AppPanel
          title="Desain Selesai per Kategori"
          description="Pekerjaan desain yang selesai — dari konten yang butuh desain maupun tugas mandiri. Satu pekerjaan berjenis ganda dihitung di tiap jenisnya."
          flush
        >
          <div class="flex flex-wrap items-center gap-2 px-4 pt-4">
            <AppSeg
              v-model="katMode"
              size="sm"
              :options="[{ value: 'pillar', label: 'Content Pillar' }, { value: 'tipe', label: 'Jenis Konten' }, { value: 'cetak', label: 'Jenis Cetak' }]"
            />
          </div>
          <div
            v-if="!katHasil.list.length"
            class="p-4 text-sm text-muted"
          >
            Belum ada desain selesai di {{ keadaan.bulan || 'semua bulan' }}.
          </div>
          <template v-else>
            <UTable
              class="hidden lg:block"
              :data="katHasil.list"
              :columns="kolomKat"
            >
              <template #nama-cell="{ row }">
                <b>{{ row.original.nama }}</b>
              </template>
              <template #n-cell="{ row }">
                <span class="num">{{ angka(row.original.n) }}</span>
              </template>
              <template #konten-cell="{ row }">
                <span class="num">{{ angka(row.original.konten) }}</span>
              </template>
              <template #mandiri-cell="{ row }">
                <span class="num">{{ angka(row.original.mandiri) }}</span>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="x in katHasil.list"
                :key="x.nama"
                class="flex items-baseline justify-between gap-2 px-4 py-2.5"
              >
                <div>
                  <b class="block text-sm">{{ x.nama }}</b>
                  <span class="text-xs text-muted">{{ angka(x.konten) }} dari konten · {{ angka(x.mandiri) }} mandiri</span>
                </div>
                <span class="num text-sm font-medium">{{ angka(x.n) }}</span>
              </div>
            </div>
            <p
              v-if="katHasil.ganda"
              class="px-4 py-3 text-xs text-muted"
            >
              {{ angka(katHasil.ganda) }} pekerjaan punya lebih dari satu jenis, jadi kolomnya tidak bisa dijumlahkan.
            </p>
          </template>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
