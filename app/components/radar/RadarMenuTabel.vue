<!--
  Radar › Menu Final / Menu Bar as the grouped table of the Marketing event
  Overview (MarketingOverviewIsi): one table per component, columns Jenis,
  Menu, Jumlah, Jam. The group's time fills rows that have none.
-->
<script setup lang="ts">
import { grupMenuOv } from '~/utils/marketing-event'

const props = defineProps<{ nilai: unknown }>()

const grup = computed(() => grupMenuOv(props.nilai).filter(g => g.rows.length || g.jam || g.qty))
/** The free-text note stored beside the groups. */
const catatan = computed(() => {
  const v = props.nilai
  return v && typeof v === 'object' && !Array.isArray(v) ? String((v as Record<string, unknown>)._teks ?? '').trim() : ''
})
/** `__grup__` is the single unnamed group; it has no heading of its own. */
const judul = (g: { nama: string, jam: string, qty: string }) =>
  [g.nama === '__grup__' ? '' : g.nama, g.jam, g.qty].filter(Boolean).join(' · ')
const KOLOM = ['Jenis', 'Menu', 'Jumlah', 'Jam']
</script>

<template>
  <div>
    <p
      v-if="catatan"
      class="mb-2 whitespace-pre-line text-sm"
    >
      {{ catatan }}
    </p>
    <div
      v-for="g in grup"
      :key="g.nama"
      class="mb-3 last:mb-0"
    >
      <p
        v-if="judul(g)"
        class="text-sm font-semibold text-highlighted"
      >
        {{ judul(g) }}
      </p>
      <table
        v-if="g.rows.length"
        class="mt-1 w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto"
      >
        <thead>
          <tr class="bg-muted text-left text-xs text-muted">
            <th
              v-for="k in KOLOM"
              :key="k"
              class="border-b border-default px-2 py-1.5 print:border print:border-default"
            >
              {{ k }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in g.rows"
            :key="i"
            class="border-b border-default last:border-0"
          >
            <td class="break-words px-2 py-1.5 print:border print:border-default">
              {{ r.kat }}
            </td>
            <td class="break-words px-2 py-1.5 print:border print:border-default">
              {{ r.menu }}
            </td>
            <td class="break-words px-2 py-1.5 print:border print:border-default">
              {{ r.qty }}
            </td>
            <td class="break-words px-2 py-1.5 print:border print:border-default">
              {{ r.jam || g.jam }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
