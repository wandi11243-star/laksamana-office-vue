<!--
  Marketing › rich read-only blocks for the event Overview tab (old
  renderOverview): rundown tables, file images, grouped menu tables and the
  Rincian Tagihan table. Simple fields stay a label–value list.
-->
<script setup lang="ts">
import type { EventMkt, SettingsMkt } from '~/utils/marketing'
import {
  adaIsiOverviewMkt, barisRundownOv, berkasGambarOv, berkasOv, grupMenuOv, menubarisMkt,
} from '~/utils/marketing-event'
import { eventFinance, rincianPenawaran } from '~/utils/marketing-uang'
import { urlBerkasMkt } from '~/composables/useMarketing'
import { rupiah } from '~/utils/format'

export interface BarisOverview { k: string, l: string, t: string, raw: unknown, ringkas: string | null }

const props = defineProps<{ baris: BarisOverview[], ev: EventMkt, settings: SettingsMkt }>()

const RICH = ['rundown', 'files', 'menutbl', 'barangtbl', 'itemtbl', 'rincitbl']
const sederhana = computed(() => props.baris.filter(b => !RICH.includes(b.t) && adaIsiOverviewMkt(b.t, b.raw, b.ringkas)))
const kaya = computed(() => props.baris.filter(b => RICH.includes(b.t) && adaIsiOverviewMkt(b.t, b.raw, b.ringkas)))

const tagihan = computed(() => rincianPenawaran(props.ev, props.settings))
const grand = computed(() => eventFinance(props.ev, props.settings).grand)
</script>

<template>
  <dl class="grid gap-y-1.5 text-sm">
    <div
      v-for="b in sederhana"
      :key="b.k"
      class="grid gap-1 sm:grid-cols-[14rem_1fr] sm:gap-3"
    >
      <dt class="text-muted">
        {{ b.l }}
      </dt>
      <dd class="whitespace-pre-line">
        {{ b.ringkas }}
      </dd>
    </div>
  </dl>

  <div
    v-for="b in kaya"
    :key="b.k"
    class="mt-3"
  >
    <p class="mb-1 text-sm text-muted">
      {{ b.l }}
    </p>

    <!-- Rundown Acara -->
    <table
      v-if="b.t === 'rundown'"
      class="w-full border-collapse text-sm"
    >
      <thead>
        <tr class="bg-muted text-left text-xs text-muted">
          <th class="border border-default px-2 py-1">
            Mulai
          </th>
          <th class="border border-default px-2 py-1">
            Selesai
          </th>
          <th class="border border-default px-2 py-1">
            Durasi
          </th>
          <th class="border border-default px-2 py-1">
            Kegiatan
          </th>
          <th class="border border-default px-2 py-1">
            PIC / Catatan
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in barisRundownOv(b.raw)"
          :key="i"
        >
          <td class="border border-default px-2 py-1">
            {{ r.mulai }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.selesai }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.durasi }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.kegiatan }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.pic }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Lampiran / layout: images inline, others as links -->
    <div
      v-else-if="b.t === 'files'"
      class="grid gap-2"
    >
      <a
        v-for="f in berkasOv(b.raw)"
        :key="f.key"
        :href="urlBerkasMkt(f.key)"
        target="_blank"
        rel="noopener"
        class="block"
      >
        <img
          v-if="berkasGambarOv(f.name)"
          :src="urlBerkasMkt(f.key)"
          :alt="f.name"
          class="max-h-96 rounded border border-default"
          loading="lazy"
        >
        <span
          v-else
          class="text-sm text-primary-700 underline"
        >{{ f.name }}</span>
      </a>
    </div>

    <!-- Menu berkelompok (Menu Final) / daftar (Bar) -->
    <div v-else-if="b.t === 'menutbl'">
      <div
        v-for="g in grupMenuOv(b.raw)"
        :key="g.nama"
        class="mb-2"
      >
        <p
          v-if="g.nama"
          class="text-sm font-medium"
        >
          {{ g.nama }}{{ g.jam ? ` · ${g.jam}` : '' }}{{ g.qty ? ` · ${g.qty}` : '' }}
        </p>
        <table class="mt-1 w-full border-collapse text-sm">
          <thead>
            <tr class="bg-muted text-left text-xs text-muted">
              <th class="border border-default px-2 py-1">
                Jenis
              </th>
              <th class="border border-default px-2 py-1">
                Menu
              </th>
              <th class="border border-default px-2 py-1">
                Jumlah
              </th>
              <th class="border border-default px-2 py-1">
                Jam
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in g.rows"
              :key="i"
            >
              <td class="border border-default px-2 py-1">
                {{ r.kat }}
              </td>
              <td class="border border-default px-2 py-1">
                {{ r.menu }}
              </td>
              <td class="border border-default px-2 py-1">
                {{ r.qty }}
              </td>
              <td class="border border-default px-2 py-1">
                {{ r.jam || g.jam }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Item / barang rows -->
    <table
      v-else-if="b.t === 'barangtbl' || b.t === 'itemtbl'"
      class="w-full border-collapse text-sm"
    >
      <thead>
        <tr class="bg-muted text-left text-xs text-muted">
          <th class="border border-default px-2 py-1">
            Item
          </th>
          <th class="border border-default px-2 py-1">
            Jumlah
          </th>
          <th class="border border-default px-2 py-1">
            Jam
          </th>
          <th class="border border-default px-2 py-1">
            Harga
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in menubarisMkt(b.raw)"
          :key="i"
        >
          <td class="border border-default px-2 py-1">
            {{ r.menu }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.jumlah }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.jam }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.harga }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Rincian Tagihan -->
    <table
      v-else-if="b.t === 'rincitbl'"
      class="w-full border-collapse text-sm"
    >
      <thead>
        <tr class="bg-muted text-left text-xs text-muted">
          <th class="border border-default px-2 py-1">
            No
          </th>
          <th class="border border-default px-2 py-1">
            Deskripsi
          </th>
          <th class="border border-default px-2 py-1">
            Qty
          </th>
          <th class="border border-default px-2 py-1">
            Harga
          </th>
          <th class="border border-default px-2 py-1">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in tagihan"
          :key="i"
        >
          <td class="border border-default px-2 py-1">
            {{ i + 1 }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.desc }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.qty ?? '–' }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.gratis || r.tbc ? (r.gratis ? 'FREE' : 'TBC') : rupiah(r.unit ?? 0) }}
          </td>
          <td class="border border-default px-2 py-1">
            {{ r.gratis ? 'FREE' : r.tbc ? 'TBC' : rupiah(r.total) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td
            colspan="4"
            class="border border-default px-2 py-1 text-right font-medium"
          >
            Total Ditagih
          </td>
          <td class="border border-default px-2 py-1 font-medium">
            {{ rupiah(grand) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
