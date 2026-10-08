<!--
  Performance figures on the content detail page (old renderPerfBlock,
  deploy/konten/index.html:4586-4605): one row per platform from
  performa-konten.ts, the old flat `metrics` as one "catatan lama" row.
  Nothing to show → nothing drawn. Figures are typed on Input Performa.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BarisPk } from '~/utils/performa-konten'
import type { KontenItem } from '~/utils/konten'
import { pkBarisKonten, pkCTR, pkER, pkEngagement, pkPersen, pkViral } from '~/utils/performa-konten'
import { angka } from '~/utils/format'

const props = defineProps<{ item: KontenItem }>()
const baris = computed(() => pkBarisKonten(props.item))
const pct = (v: number | null) => (v == null ? '—' : `${pkPersen(v)}%`)

const kolom: TableColumn<BarisPk>[] = [
  { id: 'plat', header: 'Platform' },
  { id: 'reach', header: 'Reach', meta: { class: { th: 'text-right', td: 'text-right num' } } },
  { id: 'impr', header: 'Impr.', meta: { class: { th: 'text-right', td: 'text-right num' } } },
  { id: 'eng', header: 'Eng.', meta: { class: { th: 'text-right', td: 'text-right num' } } },
  { id: 'er', header: 'ER', meta: { class: { th: 'text-right', td: 'text-right num' } } },
  { id: 'viral', header: 'Viral', meta: { class: { th: 'text-right', td: 'text-right num' } } },
  { id: 'cta', header: 'CTA', meta: { class: { th: 'text-right', td: 'text-right num' } } },
]
</script>

<template>
  <AppPanel
    v-if="baris.length"
    title="Performa konten"
    icon="i-lucide-chart-column"
    description="Angka per platform, diisi di halaman Input Performa."
    flush
  >
    <UTable
      class="hidden sm:block"
      :data="baris"
      :columns="kolom"
    >
      <template #plat-cell="{ row }">
        <UBadge
          :label="row.original.warisan ? 'catatan lama' : row.original.plat"
          color="neutral"
          variant="soft"
          size="sm"
        />
      </template>
      <template #reach-cell="{ row }">
        {{ angka(row.original.m.reach) }}
      </template>
      <template #impr-cell="{ row }">
        {{ angka(row.original.m.impr) }}
      </template>
      <template #eng-cell="{ row }">
        {{ angka(pkEngagement(row.original.m)) }}
      </template>
      <template #er-cell="{ row }">
        {{ pct(pkER(row.original.m)) }}
      </template>
      <template #viral-cell="{ row }">
        {{ pct(pkViral(row.original.m)) }}
      </template>
      <template #cta-cell="{ row }">
        {{ pct(pkCTR(row.original.m)) }}
      </template>
    </UTable>
    <ul class="divide-y divide-default sm:hidden">
      <li
        v-for="r in baris"
        :key="r.plat"
        class="px-4 py-3 text-sm"
      >
        <UBadge
          :label="r.warisan ? 'catatan lama' : r.plat"
          color="neutral"
          variant="soft"
          size="sm"
        />
        <p class="mt-1 num">
          Reach {{ angka(r.m.reach) }} · Impr. {{ angka(r.m.impr) }} · Eng. {{ angka(pkEngagement(r.m)) }}
        </p>
        <p class="text-xs text-muted num">
          ER {{ pct(pkER(r.m)) }} · Viral {{ pct(pkViral(r.m)) }} · CTA {{ pct(pkCTR(r.m)) }}
        </p>
      </li>
    </ul>
  </AppPanel>
</template>
