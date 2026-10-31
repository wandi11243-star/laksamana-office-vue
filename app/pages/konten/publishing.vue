<!--
  Konten › Publishing tracker (old VIEWS.publishing,
  deploy/konten/index.html:4338-4366; konten.md D.10).

  Two columns: Terjadwal (status Scheduled, by publish date, no date last) and
  Sudah tayang (Posted with a publish record, newest first, max 10). A past
  publish date shows the date in red; otherwise "Hari ini / Besok / H-n".
  "Tayang" (only for who may edit `publish`) opens KontenTayangSheet.

  The old "Sudah tayang" row showed `metrics.reach`, a field nothing ever
  wrote; here the reach is summed from the per-platform figures
  (performa-konten.ts), old flat metrics included.
-->
<script setup lang="ts">
import type { KontenItem } from '~/utils/konten'
import { contentPlatforms, relHariKonten, sisaHariKonten } from '~/utils/konten'
import { pkBarisKonten } from '~/utils/performa-konten'
import { angka, fTglP } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()

const dasar = computed(() => saringBrand(st.value.content, brand.value))
const waktu = (v?: string | number) => new Date(String(v ?? '')).getTime()
const terjadwal = computed(() => dasar.value.filter(c => c.status === 'Scheduled')
  .sort((a, b) => (waktu(a.publishDate || '2099') || 0) - (waktu(b.publishDate || '2099') || 0)))
const tayang = computed(() => dasar.value.filter(c => c.status === 'Posted' && c.publishRecord)
  .sort((a, b) => (waktu(b.publishRecord?.at) || 0) - (waktu(a.publishRecord?.at) || 0)))

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const lewat = (c: KontenItem) => {
  const n = sisaHariKonten(c.publishDate)
  return n != null && n < 0
}
const reach = (c: KontenItem) => pkBarisKonten(c).reduce((s, r) => s + r.m.reach, 0)
const fWaktu = (v?: string | number) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')
const adaUrl = (u?: string) => !!u && u !== '-'

const tayangBuka = ref(false)
// by id, so the sheet always writes with the row's CURRENT version
const tayangId = ref('')
const tayangItem = computed(() => st.value.content.find(x => x.id === tayangId.value) ?? null)
function bukaTayang(c: KontenItem) {
  tayangId.value = c.id
  tayangBuka.value = true
}
</script>

<template>
  <KontenGerbang lihat="publishing">
    <AppPage
      title="Publishing"
      description="Catatan publikasi aktual"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />

      <KontenBrandBar :brands="st.brands" />

      <!-- Loading rows mirror the two schedule lists below. -->
      <div
        v-if="status === 'pending' && !st.content.length"
        class="grid items-start gap-4 lg:grid-cols-2"
      >
        <div
          v-for="i in 2"
          :key="i"
          class="space-y-2 rounded-panel border border-default bg-default p-4"
        >
          <USkeleton class="h-5 w-1/3" />
          <USkeleton
            v-for="j in 3"
            :key="j"
            class="h-12 w-full"
          />
        </div>
      </div>

      <div
        v-else
        class="grid items-start gap-4 lg:grid-cols-2"
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <AppPanel
          title="Terjadwal"
          icon="i-lucide-calendar-clock"
          :count="terjadwal.length"
          flush
        >
          <p
            v-if="!terjadwal.length"
            class="p-6 text-center text-sm text-muted"
          >
            Tidak ada yang terjadwal.
          </p>
          <ul
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="c in terjadwal"
              :key="c.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <NuxtLink
                :to="`/konten/detail/${c.id}`"
                class="min-w-0 flex-1"
              >
                <p class="truncate text-sm font-semibold text-highlighted">{{ c.title || '(tanpa judul)' }}</p>
                <p class="truncate text-xs text-muted">
                  {{ [namaBrand(c.brand), contentPlatforms(c).slice(0, 3).join(' · ')].filter(Boolean).join(' · ') }}
                  <template v-if="c.publishDate"> - {{ fTglP(c.publishDate) }} {{ c.publishTime || '' }}</template>
                </p>
              </NuxtLink>
              <span
                v-if="c.publishDate"
                class="num shrink-0 text-xs"
                :class="lewat(c) ? 'font-bold text-error' : 'text-primary-700'"
                :title="lewat(c) ? 'Lewat tanggal tayang' : undefined"
              >{{ lewat(c) ? fTglP(c.publishDate) : relHariKonten(c.publishDate) }}</span>
              <UButton
                v-if="can('publish')"
                label="Tayang"
                icon="i-lucide-check"
                size="sm"
                class="shrink-0"
                @click="bukaTayang(c)"
              />
            </li>
          </ul>
        </AppPanel>

        <AppPanel
          title="Sudah tayang"
          icon="i-lucide-circle-check"
          :count="tayang.length"
          flush
        >
          <p
            v-if="!tayang.length"
            class="p-6 text-center text-sm text-muted"
          >
            Belum ada yang tayang.
          </p>
          <ul
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="c in tayang.slice(0, 10)"
              :key="c.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <NuxtLink
                :to="`/konten/detail/${c.id}`"
                class="min-w-0 flex-1"
              >
                <p class="truncate text-sm font-semibold text-highlighted">{{ c.title || '(tanpa judul)' }}</p>
                <p class="truncate text-xs text-muted">
                  {{ [namaBrand(c.brand), contentPlatforms(c).slice(0, 3).join(' · ')].filter(Boolean).join(' · ') }} - {{ fWaktu(c.publishRecord?.at) }}
                </p>
              </NuxtLink>
              <span
                v-if="reach(c)"
                class="num shrink-0 text-xs text-primary-700"
              >{{ angka(reach(c)) }} reach</span>
              <UButton
                v-if="adaUrl(c.publishRecord?.url)"
                :to="c.publishRecord?.url"
                target="_blank"
                rel="noopener"
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Buka konten"
                class="shrink-0"
              />
            </li>
          </ul>
        </AppPanel>
      </div>

      <KontenTayangSheet
        v-model:open="tayangBuka"
        :item="tayangItem"
      />
    </AppPage>
  </KontenGerbang>
</template>
