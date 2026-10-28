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
import { bukaBerkasMkt } from '~/composables/useMarketing'
import { rupiah } from '~/utils/format'

export interface BarisOverview { k: string, l: string, t: string, raw: unknown, ringkas: string | null }

const props = defineProps<{ baris: BarisOverview[], ev: EventMkt, settings: SettingsMkt }>()

const RICH = ['rundown', 'files', 'menutbl', 'barangtbl', 'itemtbl', 'rincitbl']
const tampil = computed(() => props.baris.filter(b => adaIsiOverviewMkt(b.t, b.raw, b.ringkas)))
const kaya = (b: BarisOverview) => RICH.includes(b.t)

const tagihan = computed(() => rincianPenawaran(props.ev, props.settings))
const grand = computed(() => eventFinance(props.ev, props.settings).grand)
</script>

<template>
  <dl class="grid text-sm">
    <template
      v-for="b in tampil"
      :key="b.k"
    >
      <div
        v-if="!kaya(b)"
        class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3"
      >
        <dt class="text-muted">
          {{ b.l }}
        </dt>
        <dd class="whitespace-pre-line font-semibold text-highlighted">
          {{ b.ringkas }}
        </dd>
      </div>
      <div
        v-else
        class="mt-3"
      >
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {{ b.l }}
        </p>

        <!-- Rundown Acara -->
        <table
          v-if="b.t === 'rundown'"
          class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto"
        >
          <thead>
            <tr class="bg-muted text-left text-xs text-muted">
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Mulai</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Selesai</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Durasi</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Kegiatan</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">PIC / Catatan</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in barisRundownOv(b.raw)"
              :key="i"
              class="border-b border-default last:border-0"
            >
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.mulai }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.selesai }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.durasi }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.kegiatan }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.pic }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Lampiran / layout: images inline, others as links (all via Bearer blob) -->
        <div
          v-else-if="b.t === 'files'"
          class="grid gap-2"
        >
          <div
            v-for="f in berkasOv(b.raw)"
            :key="f.key"
          >
            <MarketingGambar
              v-if="berkasGambarOv(f.name)"
              :file-key="f.key"
              :alt="f.name"
              img-class="max-h-96 rounded border border-default"
            />
            <UButton
              v-else
              color="neutral"
              variant="link"
              size="xs"
              class="px-0 text-primary-700 underline"
              @click="bukaBerkasMkt(f.key)"
            >
              {{ f.name }}
            </UButton>
          </div>
        </div>

        <!-- Menu berkelompok (Menu Final) / daftar (Bar) -->
        <div v-else-if="b.t === 'menutbl'">
          <div
            v-for="g in grupMenuOv(b.raw)"
            :key="g.nama"
            class="mb-3"
          >
            <p
              v-if="g.nama"
              class="text-sm font-semibold text-highlighted"
            >
              {{ g.nama }}{{ g.jam ? ` · ${g.jam}` : '' }}{{ g.qty ? ` · ${g.qty}` : '' }}
            </p>
            <table class="mt-1 w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto">
              <thead>
                <tr class="bg-muted text-left text-xs text-muted">
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Jenis</th>
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Menu</th>
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Jumlah</th>
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Jam</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(r, i) in g.rows"
                  :key="i"
                  class="border-b border-default last:border-0"
                >
                  <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.kat }}</td>
                  <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.menu }}</td>
                  <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.qty }}</td>
                  <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.jam || g.jam }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Item / barang rows -->
        <table
          v-else-if="b.t === 'barangtbl' || b.t === 'itemtbl'"
          class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto"
        >
          <thead>
            <tr class="bg-muted text-left text-xs text-muted">
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Item</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Jumlah</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Jam</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Harga</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in menubarisMkt(b.raw)"
              :key="i"
              class="border-b border-default last:border-0"
            >
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.menu }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.jumlah }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.jam }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.harga }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Rincian Tagihan -->
        <table
          v-else-if="b.t === 'rincitbl'"
          class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto"
        >
          <thead>
            <tr class="bg-muted text-left text-xs text-muted">
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">No</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Deskripsi</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Qty</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Harga</th>
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in tagihan"
              :key="i"
              class="border-b border-default last:border-0"
            >
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ i + 1 }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.desc }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.qty ?? '–' }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.gratis || r.tbc ? (r.gratis ? 'FREE' : 'TBC') : rupiah(r.unit ?? 0) }}</td>
              <td class="break-words px-2 py-1.5 print:border print:border-default">{{ r.gratis ? 'FREE' : r.tbc ? 'TBC' : rupiah(r.total) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-default font-semibold">
              <td colspan="4" class="px-2 py-1.5 text-right print:border print:border-default">Total Ditagih</td>
              <td class="px-2 py-1.5 print:border print:border-default">{{ rupiah(grand) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </dl>
</template>
