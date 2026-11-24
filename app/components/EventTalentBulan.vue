<!--
  Talent Schedule › Tabel › Bulan: the attendance table of the old page
  (`lembarTalentHTML :2848`), talent × day for the viewed month. Moved here
  as it was; the numbers (Tampil, Selesai, Fee, Penampil / hari) are the same
  sums over the SAVED rows (drafts are not counted until saved). Cancelled is
  drawn, never counted. A cell opens the row's editor.
-->
<script setup lang="ts">
import type { JadwalTalent, Talent } from '~/composables/useEvent'
import { feeAngka } from '~/utils/event-hitung'
import { BULAN, rupiah, tglPendek } from '~/utils/format'
import { rentangBulan, rentangHari } from '~/utils/kalender'
import { HARI_PENDEK, idxHariEms } from '~/utils/event-jadwal'

const props = defineProps<{
  /** `YYYY-MM`. */
  bulan: string
  /** Saved rows of the month (already narrowed by the category filter). */
  rows: JadwalTalent[]
  talents: Talent[]
}>()
const emit = defineEmits<{ pilih: [id: string] }>()

const judul = computed(() => `Kehadiran talent · ${BULAN[+props.bulan.slice(5, 7) - 1]} ${props.bulan.slice(0, 4)}`)

/** Rows: talents with shows this month (plus deleted ones), then day cells. */
const barisHadir = computed(() => {
  const r = rentangBulan(props.bulan)
  const tgls = rentangHari(r.a, r.b, 31)
  const perTalent = new Map<string, JadwalTalent[]>()
  for (const j of props.rows) {
    const l = perTalent.get(j.talent_id) ?? []
    l.push(j)
    perTalent.set(j.talent_id, l)
  }
  const baris: { id: string, nama: string, hapus: boolean, tampil: number, selesai: number, fee: number, sel: Map<string, JadwalTalent[]> }[] = []
  for (const [tid, rows] of perTalent) {
    const hidup = rows.filter(j => j.status !== 'Cancelled')
    const t = props.talents.find(x => x.id === tid)
    baris.push({
      id: tid,
      nama: t?.name ?? 'Talent terhapus',
      hapus: !t,
      tampil: hidup.length,
      selesai: hidup.filter(j => j.status === 'Done').length,
      fee: hidup.reduce((a, j) => a + feeAngka(j.fee), 0),
      sel: new Map(tgls.map(d => [d, rows.filter(j => j.date === d)] as [string, JadwalTalent[]])),
    })
  }
  // most shows first, then the latest show, then name
  const akhir = (b: typeof baris[number]) => [...b.sel.values()].flat().filter(j => j.status !== 'Cancelled').map(j => j.date).sort().pop() ?? ''
  baris.sort((a, b) => (b.tampil - a.tampil) || akhir(b).localeCompare(akhir(a)) || a.nama.localeCompare(b.nama))
  return { tgls, baris }
})
/** Shows per day (non-cancelled), and the month totals. */
const kaki = computed(() => barisHadir.value.tgls.map(d => props.rows.filter(j => j.date === d && j.status !== 'Cancelled').length))
const total = computed(() => {
  const sah = props.rows.filter(j => j.status !== 'Cancelled')
  return { tampil: sah.length, selesai: props.rows.filter(j => j.status === 'Done').length, fee: sah.reduce((a, j) => a + feeAngka(j.fee), 0) }
})
const HURUF_STATUS: Record<string, string> = { Scheduled: 'S', Confirmed: 'C', Done: '✓', Cancelled: '×' }
const WARNA_HURUF: Record<string, string> = { Scheduled: 'bg-primary-500 text-white', Confirmed: 'bg-info text-white', Done: 'bg-success text-white', Cancelled: 'bg-muted text-muted' }
const akhirPekan = (tgl: string) => idxHariEms(tgl) >= 5
</script>

<template>
  <AppPanel flush>
    <EventTalentKepala :judul="judul">
      <template #legenda>
        <span class="text-muted">S = terjadwal · C = dikonfirmasi · ✓ = selesai · × = batal. Klik selnya untuk membuka jadwalnya.</span>
      </template>
      <template #total>
        {{ rows.length }} jadwal
      </template>
    </EventTalentKepala>
    <p
      v-if="!rows.length"
      class="py-8 text-center text-sm text-muted"
    >
      Belum ada jadwal talent di bulan ini.
    </p>
    <div
      v-else
      class="overflow-x-auto"
    >
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr class="border-b border-default">
            <th class="sticky left-0 bg-default px-2 py-1.5 text-left font-bold text-highlighted">
              Talent
            </th>
            <th
              v-for="(d, i) in barisHadir.tgls"
              :key="d"
              class="min-w-7 px-0.5 py-1 text-center font-bold num"
              :class="akhirPekan(d) ? 'bg-muted/60' : ''"
            >
              <span class="block text-[9px] font-semibold text-muted uppercase">{{ HARI_PENDEK[idxHariEms(d)] }}</span>{{ i + 1 }}
            </th>
            <th class="px-2 py-1.5 text-right font-bold text-highlighted">
              Tampil
            </th>
            <th class="px-2 py-1.5 text-right font-bold text-highlighted">
              Selesai
            </th>
            <th class="px-2 py-1.5 text-right font-bold text-highlighted">
              Fee
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in barisHadir.baris"
            :key="b.id"
            class="border-b border-default"
          >
            <td class="sticky left-0 whitespace-nowrap bg-default px-2 py-1.5 font-semibold text-highlighted">
              {{ b.hapus ? '(talent terhapus)' : b.nama }}
            </td>
            <td
              v-for="d in barisHadir.tgls"
              :key="d"
              class="px-0.5 py-1 text-center"
              :class="akhirPekan(d) ? 'bg-muted/60' : ''"
            >
              <button
                v-for="j in (b.sel.get(d) ?? [])"
                :key="j.id"
                type="button"
                class="mx-auto block size-5 rounded text-[11px] font-bold leading-5"
                :class="WARNA_HURUF[j.status] ?? 'bg-muted text-muted'"
                :title="`${b.nama} · ${tglPendek(d)} · ${j.start_time ?? ''} · ${j.status}`"
                @click="emit('pilih', j.id)"
              >
                {{ HURUF_STATUS[j.status] ?? '?' }}
              </button>
            </td>
            <td class="px-2 py-1.5 text-right font-bold num">
              {{ b.tampil }}
            </td>
            <td class="px-2 py-1.5 text-right num">
              {{ b.selesai }}
            </td>
            <td class="whitespace-nowrap px-2 py-1.5 text-right num">
              {{ rupiah(b.fee) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="sticky left-0 bg-default px-2 py-1.5 font-bold text-highlighted">
              Penampil / hari
            </td>
            <td
              v-for="(k, i) in kaki"
              :key="i"
              class="px-0.5 py-1 text-center num"
              :class="akhirPekan(barisHadir.tgls[i]!) ? 'bg-muted/60' : ''"
            >
              {{ k || '' }}
            </td>
            <td class="px-2 py-1.5 text-right font-bold num">
              {{ total.tampil }}
            </td>
            <td class="px-2 py-1.5 text-right num">
              {{ total.selesai }}
            </td>
            <td class="whitespace-nowrap px-2 py-1.5 text-right font-bold num">
              {{ rupiah(total.fee) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </AppPanel>
</template>
