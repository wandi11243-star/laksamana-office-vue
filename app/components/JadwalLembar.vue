<!--
  The schedule sheet (deploy/jadwal/index.html `table.sched` + selHtml :2442,
  blokDW :1545): one row per person, one column per day, the first three
  columns frozen (No · Nama · the slot `info`). In "Semua" mode every Divisi
  gets a header row. The DAILY WORKER block sits under each Divisi's crew,
  read-only, separated by its own labelled band — DW have no days off and no
  load numbers, so they never join the crew list (:1530).

  A cell opens the editor only where this person may write that Divisi; in
  "Semua" a head still edits only their own rows.

  Thirty-one day columns do not fit any screen, so the sheet scrolls inside
  its own box with the names frozen, exactly as the old `.tablewrap`; the
  page itself never scrolls sideways.
-->
<script setup lang="ts">
import type { DwJadwal } from '~/composables/useJadwal'
import type { KruJadwal, PetaSel, SettingJadwal } from '~/utils/jadwal'
import { HARI_SENIN, idxHari, jamSel, kelasTeksShift, kunciSel, labelSel, namaDivisiJadwal, shiftDef, tglSel } from '~/utils/jadwal'
import { fTglP } from '~/utils/format'

export interface GrupLembar {
  div: string
  kru: KruJadwal[]
  /** May this person write this Divisi? */
  bisa: boolean
  heads: string[]
}

const props = defineProps<{
  set: SettingJadwal
  peta: PetaSel
  hari: string[]
  grup: GrupLembar[]
  /** Draw the Divisi header rows ("Semua" mode). */
  judulDivisi?: boolean
  dw?: DwJadwal[]
  infoLabel: string
  infoSub?: string
}>()
const emit = defineEmits<{ pilih: [u: KruJadwal, tgl: string] }>()

const kolom = computed(() => 3 + props.hari.length)

function dwOrang(div: string) {
  const peta = new Map<string, { id: string, nama: string, posisi: string }>()
  for (const x of props.dw ?? []) {
    if (x.divisi !== div || x.tgl < props.hari[0]! || x.tgl > props.hari.at(-1)!) continue
    if (!peta.has(x.dwId)) peta.set(x.dwId, { id: x.dwId, nama: x.nama, posisi: x.posisi || '' })
  }
  return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama))
}
const dwSel = (dwId: string, tgl: string) => (props.dw ?? []).find(x => x.dwId === dwId && x.tgl === tgl) ?? null

const sel = (uid: string, tgl: string) => props.peta.get(kunciSel(uid, tgl)) ?? null
const jamTeks = (uid: string, tgl: string) => {
  const c = sel(uid, tgl)
  const j = jamSel(props.set, c)
  return j && !c?.n ? `${j.m}–${j.s}` : ''
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="lembar w-max min-w-full border-separate border-spacing-0 text-xs">
      <thead>
        <tr>
          <th class="beku left-0 w-9 bg-table-head text-table-head-text">
            No.
          </th>
          <th class="beku left-9 w-40 bg-table-head text-start text-table-head-text">
            Nama
          </th>
          <th class="beku left-49 w-32 bg-table-head text-start text-table-head-text">
            {{ infoLabel }}
          </th>
          <th
            v-for="d in hari"
            :key="d"
            class="min-w-16 bg-table-head px-1 py-2 text-table-head-text num"
            :class="idxHari(d) === 0 && 'border-s-2 border-s-primary-400'"
          >
            {{ tglSel(d) }}
          </th>
        </tr>
        <tr>
          <th class="beku left-0 bg-muted" />
          <th class="beku left-9 bg-muted" />
          <th class="beku left-49 bg-muted text-start text-[11px] font-semibold uppercase text-muted">
            {{ infoSub }}
          </th>
          <th
            v-for="d in hari"
            :key="d"
            class="bg-muted px-1 py-1 text-[11px] font-semibold"
            :class="[idxHari(d) >= 5 ? 'text-primary-700' : 'text-muted', idxHari(d) === 0 && 'border-s-2 border-s-primary-400']"
          >
            {{ HARI_SENIN[idxHari(d)]!.slice(0, 3) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template
          v-for="g in grup"
          :key="g.div"
        >
          <tr v-if="judulDivisi">
            <th
              :colspan="kolom"
              class="bg-primary-100 px-3 py-1.5 text-start text-sm font-bold text-primary-800"
            >
              <span class="sticky left-3">{{ namaDivisiJadwal(g.div) }} <span class="font-medium text-muted">{{ g.kru.length }} kru</span></span>
            </th>
          </tr>
          <tr
            v-for="(u, i) in g.kru"
            :key="u.id"
          >
            <td class="beku left-0 bg-default text-center text-muted num">
              {{ i + 1 }}
            </td>
            <td class="beku left-9 bg-default">
              <b class="block truncate text-highlighted">{{ u.name }}</b>
              <i
                v-if="g.heads.includes(u.id)"
                class="text-[11px] text-primary-700"
              >head divisi</i>
            </td>
            <td class="beku left-49 bg-default">
              <slot
                name="info"
                :u="u"
                :div="g.div"
              />
            </td>
            <td
              v-for="d in hari"
              :key="d"
              class="sel"
              :class="[idxHari(d) === 0 && 'border-s-2 border-s-primary-400', g.bisa && 'cursor-pointer hover:outline-2 hover:outline-primary-500']"
              :title="`${u.name} · ${fTglP(d)}`"
              @click="g.bisa && emit('pilih', u, d)"
            >
              <div
                v-if="sel(u.id, d)"
                class="flex h-full flex-col items-center justify-center rounded px-0.5 py-1 font-bold"
                :class="kelasTeksShift(shiftDef(set, sel(u.id, d)!.t).w)"
                :style="{ backgroundColor: shiftDef(set, sel(u.id, d)!.t).w }"
              >
                <span class="truncate">{{ labelSel(set, sel(u.id, d)) }}</span>
                <span
                  v-if="jamTeks(u.id, d)"
                  class="text-[10px] font-medium opacity-90 num"
                >{{ jamTeks(u.id, d) }}</span>
              </div>
              <span
                v-else
                class="block text-center text-dimmed"
              >·</span>
            </td>
          </tr>

          <template v-if="dwOrang(g.div).length">
            <tr>
              <th
                :colspan="kolom"
                class="bg-vip/12 px-3 py-1.5 text-start text-[11px] font-bold uppercase tracking-wide text-vip"
              >
                <span class="sticky left-3">Daily worker · {{ dwOrang(g.div).length }} orang
                  <span class="font-medium normal-case text-muted">{{ fTglP(hari[0]) }} – {{ fTglP(hari.at(-1)) }} · disetujui HR di modul Daily Worker</span>
                </span>
              </th>
            </tr>
            <tr
              v-for="(w, i) in dwOrang(g.div)"
              :key="w.id"
            >
              <td class="beku left-0 bg-default text-center text-muted num">
                {{ i + 1 }}
              </td>
              <td class="beku left-9 bg-default">
                <b class="block truncate text-highlighted">{{ w.nama }}</b>
                <i class="text-[11px] text-muted">daily worker</i>
              </td>
              <td class="beku left-49 bg-default text-muted">
                {{ w.posisi || 'DW' }}
              </td>
              <td
                v-for="d in hari"
                :key="d"
                class="sel"
                :class="idxHari(d) === 0 && 'border-s-2 border-s-primary-400'"
              >
                <div
                  v-if="dwSel(w.id, d)"
                  class="flex flex-col items-center rounded bg-vip/12 px-0.5 py-1 font-bold text-vip"
                >
                  <span class="truncate">{{ dwSel(w.id, d)!.posisi || 'DW' }}</span>
                  <span
                    v-if="dwSel(w.id, d)!.m && dwSel(w.id, d)!.s"
                    class="text-[10px] font-medium num"
                  >{{ dwSel(w.id, d)!.m }}–{{ dwSel(w.id, d)!.s }}</span>
                </div>
                <span
                  v-else
                  class="block text-center text-dimmed"
                >·</span>
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Geometry only; colours are tokens (DESIGN.md: no hex in components). */
.lembar th,
.lembar td {
  border-bottom: 1px solid var(--ui-border);
  border-right: 1px solid var(--ui-border);
}
.lembar td {
  padding: 0.25rem 0.375rem;
}
.beku {
  position: sticky;
  z-index: 10;
}
.lembar td.sel {
  height: 2.75rem;
  min-width: 4rem;
  padding: 0.125rem;
}
.left-49 {
  left: 12.25rem;
}
</style>
