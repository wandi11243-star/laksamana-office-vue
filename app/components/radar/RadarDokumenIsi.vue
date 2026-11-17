<!--
  Radar › shared document rows for Detail Lengkap (mkt, vip and evt use it).

  Simple values stay a label–value list, like MarketingOverviewIsi. Shaped
  values draw print-friendly blocks: rundown arrays become a table, menu-like
  objects become grouped menu tables, attachment lists become centred images
  (other files stay plain links). The raw shapes come from `mentah` (the
  untouched detail object); `baris` gives the order, labels and fallback text,
  so an unknown shape still reads as text, never as JSON.
-->
<script setup lang="ts">
import type { BarisDetail, Lampiran } from '~/utils/radar'
import { lampiranGambar } from '~/utils/radar'
import { barisRundownOv, grupMenuOv } from '~/utils/marketing-event'
import { rupiah } from '~/utils/format'

const props = defineProps<{
  baris: BarisDetail[]
  mentah?: Record<string, unknown>
  urlOf: (l: Lampiran) => string
  sedangMemuat: (l: Lampiran) => boolean
}>()

type Kaya = 'teks' | 'lampiran' | 'rundown' | 'menu' | 'barang'

interface BarisBarang { nama: string, info: string }

/** Which block a row draws, by its SHAPE — never by a Marketing field type. */
function jenis(r: BarisDetail): Kaya {
  if (r.lampiran?.length) return 'lampiran'
  const v = props.mentah?.[r.k]
  if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] !== null) {
    const o = v[0] as Record<string, unknown>
    if ('kegiatan' in o || 'mulai' in o) return barisRundownOv(v).length ? 'rundown' : 'teks'
    if ('barang' in o || 'nama' in o) return 'barang'
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    if ('rows' in o || '_teks' in o) {
      const teks = String(o._teks ?? '').trim()
      return grupMenuOv(v).length || teks ? 'menu' : 'teks'
    }
  }
  return 'teks'
}

const mentahOf = (r: BarisDetail): unknown => props.mentah?.[r.k]

/** Item / goods rows: {barang, tgl, jam} or {nama, nominal}. */
function barisBarang(v: unknown): BarisBarang[] {
  if (!Array.isArray(v)) return []
  return (v as Record<string, unknown>[])
    .filter(r => r && typeof r === 'object')
    .map((r) => {
      if ('barang' in r) {
        const kapan = [r.tgl, r.jam].filter(x => x !== undefined && x !== null && String(x) !== '').map(String).join(' ')
        return { nama: String(r.barang ?? ''), info: kapan }
      }
      const nom = r.nominal
      return {
        nama: String(r.nama ?? ''),
        info: nom !== null && nom !== undefined && String(nom) !== '' ? rupiah(Number(nom) || 0) : '',
      }
    })
    .filter(r => r.nama || r.info)
}

/** Menu intro line above the grouped tables ({group: {rows, jam, qty}} + _teks). */
const teksMenu = (v: unknown): string => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ''
  return String((v as Record<string, unknown>)._teks ?? '').trim()
}

/** Rundown columns that actually have data — empty ones are not drawn. */
function kolomRundown(rows: { mulai: string, selesai: string, durasi: string, kegiatan: string, pic: string }[]): { k: 'mulai' | 'selesai' | 'durasi' | 'kegiatan' | 'pic', l: string }[] {
  const semua: { k: 'mulai' | 'selesai' | 'durasi' | 'kegiatan' | 'pic', l: string }[] = [
    { k: 'mulai', l: 'Mulai' },
    { k: 'selesai', l: 'Selesai' },
    { k: 'durasi', l: 'Durasi' },
    { k: 'kegiatan', l: 'Kegiatan' },
    { k: 'pic', l: 'PIC / Catatan' },
  ]
  return semua.filter(c => rows.some(r => r[c.k].trim()))
}
</script>

<template>
  <dl class="grid text-sm">
    <template
      v-for="r in baris"
      :key="r.k"
    >
      <div
        v-if="jenis(r) === 'teks'"
        class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3"
      >
        <dt class="text-muted">
          {{ r.label }}
        </dt>
        <dd class="whitespace-pre-line font-semibold text-highlighted">
          {{ r.teks }}
        </dd>
      </div>

      <div
        v-else
        class="mt-3"
      >
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {{ r.label }}
        </p>

        <!-- Attachment list: images centred, other files as links -->
        <div
          v-if="jenis(r) === 'lampiran'"
          class="grid grid-cols-1 gap-3"
        >
          <div
            v-for="l in r.lampiran ?? []"
            :key="l.key"
            :class="lampiranGambar(l.name) ? 'flex justify-center' : ''"
          >
            <template v-if="lampiranGambar(l.name)">
              <span
                v-if="sedangMemuat(l)"
                class="text-xs text-muted"
              >Memuat {{ l.name }}…</span>
              <span
                v-else-if="!urlOf(l)"
                class="text-xs text-muted"
              >{{ l.name }} — berkas tidak ada</span>
              <a
                v-else
                :href="urlOf(l)"
                target="_blank"
                rel="noopener"
              >
                <img
                  :src="urlOf(l)"
                  :alt="l.name"
                  class="mx-auto max-h-96 max-w-full rounded border border-default"
                >
              </a>
            </template>
            <a
              v-else
              :href="urlOf(l)"
              :download="sedangMemuat(l) || !urlOf(l) ? undefined : l.name"
              class="inline-flex items-center gap-1 text-sm text-ink-900 hover:underline"
            ><UIcon
              name="i-lucide-paperclip"
              class="size-4"
            />{{ sedangMemuat(l) ? `Memuat ${l.name}…` : (!urlOf(l) ? `${l.name} — berkas tidak ada` : l.name) }}</a>
          </div>
        </div>

        <!-- Rundown table -->
        <table
          v-else-if="jenis(r) === 'rundown'"
          class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto"
        >
          <thead>
            <tr class="bg-muted text-left text-xs text-muted">
              <th
                v-for="c in kolomRundown(barisRundownOv(mentahOf(r)))"
                :key="c.k"
                class="border-b border-default px-2 py-1.5 print:border print:border-default"
              >
                {{ c.l }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in barisRundownOv(mentahOf(r))"
              :key="i"
              class="border-b border-default last:border-0"
            >
              <td
                v-for="c in kolomRundown(barisRundownOv(mentahOf(r)))"
                :key="c.k"
                class="break-words px-2 py-1.5 print:border print:border-default"
              >
                {{ row[c.k] }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Grouped menu tables -->
        <div v-else-if="jenis(r) === 'menu'">
          <p
            v-if="teksMenu(mentahOf(r))"
            class="mb-2 whitespace-pre-line text-sm"
          >
            {{ teksMenu(mentahOf(r)) }}
          </p>
          <div
            v-for="g in grupMenuOv(mentahOf(r))"
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
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                    Jenis
                  </th>
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                    Menu
                  </th>
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                    Jumlah
                  </th>
                  <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                    Jam
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, i) in g.rows"
                  :key="i"
                  class="border-b border-default last:border-0"
                >
                  <td class="break-words px-2 py-1.5 print:border print:border-default">
                    {{ row.kat }}
                  </td>
                  <td class="break-words px-2 py-1.5 print:border print:border-default">
                    {{ row.menu }}
                  </td>
                  <td class="break-words px-2 py-1.5 print:border print:border-default">
                    {{ row.qty }}
                  </td>
                  <td class="break-words px-2 py-1.5 print:border print:border-default">
                    {{ row.jam || g.jam }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Item / goods table -->
        <table
          v-else
          class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto"
        >
          <thead>
            <tr class="bg-muted text-left text-xs text-muted">
              <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                Item
              </th>
              <th
                v-if="barisBarang(mentahOf(r)).some(b => b.info)"
                class="border-b border-default px-2 py-1.5 print:border print:border-default"
              >
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(b, i) in barisBarang(mentahOf(r))"
              :key="i"
              class="border-b border-default last:border-0"
            >
              <td class="break-words px-2 py-1.5 print:border print:border-default">
                {{ b.nama }}
              </td>
              <td
                v-if="barisBarang(mentahOf(r)).some(x => x.info)"
                class="break-words px-2 py-1.5 print:border print:border-default"
              >
                {{ b.info }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </dl>
</template>
