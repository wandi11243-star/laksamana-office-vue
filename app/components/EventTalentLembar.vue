<!--
  Talent Schedule › Tabel › Minggu: the roster sheet (the look of
  `JadwalLembar`): rows = talents grouped by category, columns = Monday to
  Sunday, the name column frozen. The page never scrolls sideways: the sheet
  scrolls inside its own box. On a phone the sheet becomes one card per day
  (a 7-column table cannot be read at 390px).

  Cells (only `bolehUbah` makes them clickable):
    empty        click = fill with the default hours at once (the page decides);
    filled       click = open the row's editor; `+` adds a second show that day;
    draft        dashed outline (new, changed) or struck through (deleted);
    amber dot    the hours differ from the default hours;
    red          double booking (blocks saving).
-->
<script setup lang="ts">
import type { BarisEf, GrupKategori, JamTalentDoc } from '~/utils/event-jadwal'
import { HARI_PENDEK, bedaDariBawaan, perTanggal } from '~/utils/event-jadwal'
import { BLN, hariIni } from '~/utils/format'
import { gayaNada } from '~/utils/kalender-warna'
import { nadaKategori } from '~/utils/status-event'

const props = defineProps<{
  hari: string[]
  grup: GrupKategori[]
  /** Every row of the week (saved + drafts), already narrowed by the category filter. */
  rows: BarisEf[]
  doc: JamTalentDoc
  /** Keys of rows to paint red. */
  bentrok: Set<string>
  urutKategori: string[]
  bolehUbah: boolean
  /** Head: title, and the figure at the right. */
  judul: string
  jumlah: number
}>()
const emit = defineEmits<{
  kosong: [talentId: string, tgl: string]
  pilih: [kunci: string]
  tambah: [talentId: string, tgl: string]
  hari: [tgl: string]
}>()

const sekarang = hariIni()
const gaya = (kat: string) => gayaNada(nadaKategori(kat, props.urutKategori)).kartu

const sel = computed(() => {
  const m = new Map<string, BarisEf[]>()
  for (const r of props.rows) {
    const k = `${r.talent_id}|${r.date}`
    const l = m.get(k) ?? []
    l.push(r)
    m.set(k, l)
  }
  for (const l of m.values()) l.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return m
})
const isi = (talentId: string, tgl: string) => sel.value.get(`${talentId}|${tgl}`) ?? []
const hariRows = computed(() => perTanggal(props.rows))
const namaTalent = computed(() => {
  const m = new Map<string, string>()
  for (const g of props.grup) for (const t of g.talents) m.set(t.id, t.nama)
  return m
})
const katTalent = computed(() => {
  const m = new Map<string, string>()
  for (const g of props.grup) for (const t of g.talents) m.set(t.id, g.kategori)
  return m
})

const tglKolom = (tgl: string) => `${+tgl.slice(8, 10)} ${BLN[+tgl.slice(5, 7) - 1]}`
const beda = (r: BarisEf, kat: string) => bedaDariBawaan(props.doc, r.talent_id, kat, r.date, r.start_time, r.end_time)

/** Classes of one row chip: category colour, then the draft / clash states. */
function kelasChip(r: BarisEf, kat: string) {
  if (r.draf === 'hapus') return 'border-default bg-muted text-muted line-through opacity-60'
  const dasar = props.bentrok.has(r.kunci) ? 'border-error bg-error/12 text-error ring-1 ring-error' : gaya(kat)
  return [dasar, r.draf ? 'outline-1 -outline-offset-1 outline-dashed' : '', r.status === 'Cancelled' ? 'line-through opacity-60' : ''].join(' ')
}
const jamTeks = (r: BarisEf) => (r.start_time && r.end_time ? `${r.start_time}–${r.end_time}` : 'isi jam')
const judulChip = (r: BarisEf, kat: string) => [
  `${namaTalent.value.get(r.talent_id) ?? ''} · ${jamTeks(r)}`,
  r.draf === 'baru' ? 'draf baru' : r.draf === 'ubah' ? 'draf diubah' : r.draf === 'hapus' ? 'draf dihapus: klik untuk membatalkan' : '',
  r.basi ? 'diubah orang lain: periksa lagi' : '',
  props.bentrok.has(r.kunci) ? 'bentrok dengan jadwal lain' : '',
  beda(r, kat) ? 'jam berbeda dari bawaan' : '',
].filter(Boolean).join(' · ')
</script>

<template>
  <AppPanel flush>
    <EventTalentKepala :judul="judul">
      <template #legenda>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm outline-1 -outline-offset-1 outline-dashed outline-muted" />Draf</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-warning" />Jam beda dari bawaan</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-error/12 ring-1 ring-error" />Bentrok</span>
      </template>
      <template #total>
        {{ jumlah }} jadwal
      </template>
    </EventTalentKepala>

    <!-- desktop: the sheet -->
    <div class="hidden overflow-x-auto lg:block">
      <table class="w-max min-w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th class="sticky left-0 z-10 w-44 border-b border-e border-default bg-table-head px-3 py-2 text-start font-bold text-table-head-text uppercase">
              Talent
            </th>
            <th
              v-for="(d, i) in hari"
              :key="d"
              class="min-w-32 border-b border-e border-default px-1 py-2 text-center font-bold uppercase"
              :class="d === sekarang ? 'bg-primary-100 text-primary-800' : 'bg-table-head text-table-head-text'"
            >
              <button
                type="button"
                class="w-full"
                title="Buka jadwal hari ini"
                @click="emit('hari', d)"
              >
                {{ HARI_PENDEK[i] }} <span class="num">{{ tglKolom(d) }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="g in grup"
            :key="g.kategori"
          >
            <tr>
              <th
                :colspan="8"
                class="border-b border-default bg-primary-100 px-3 py-1.5 text-start text-sm font-bold text-primary-800"
              >
                <span class="sticky left-3">{{ g.kategori }} <span class="font-medium text-muted">{{ g.talents.length }} talent</span></span>
              </th>
            </tr>
            <tr
              v-for="t in g.talents"
              :key="t.id"
            >
              <td class="sticky left-0 z-10 w-44 max-w-44 border-b border-e border-default bg-default px-3 py-2">
                <b class="block truncate text-highlighted">{{ t.nama }}</b>
                <i
                  v-if="t.nonaktif"
                  class="text-[11px] text-muted"
                >{{ t.hilang ? 'talent terhapus' : 'nonaktif' }}</i>
              </td>
              <td
                v-for="d in hari"
                :key="d"
                class="group min-w-32 border-b border-e border-default p-1 align-top"
                :class="d === sekarang ? 'bg-primary-50' : ''"
              >
                <div class="space-y-1">
                  <button
                    v-for="r in isi(t.id, d)"
                    :key="r.kunci"
                    type="button"
                    class="flex w-full min-w-0 flex-col rounded border-l-2 px-1.5 py-1 text-left font-semibold leading-tight"
                    :class="kelasChip(r, g.kategori)"
                    :title="judulChip(r, g.kategori)"
                    @click="emit('pilih', r.kunci)"
                  >
                    <span class="flex items-center gap-1 num">
                      {{ jamTeks(r) }}
                      <span
                        v-if="beda(r, g.kategori)"
                        class="size-1.5 shrink-0 rounded-full bg-warning"
                        aria-hidden="true"
                      />
                      <span
                        v-if="r.basi"
                        class="text-[10px]"
                      >!</span>
                    </span>
                    <span class="truncate text-[10px] font-medium opacity-80">{{ r.performance_type }}<template v-if="r.status !== 'Scheduled'"> · {{ r.status }}</template></span>
                  </button>
                  <button
                    v-if="bolehUbah && isi(t.id, d).length"
                    type="button"
                    class="flex w-full items-center justify-center rounded text-muted opacity-0 hover:bg-elevated focus-visible:opacity-100 group-hover:opacity-100"
                    title="Tambah show kedua di hari ini"
                    aria-label="Tambah show kedua di hari ini"
                    @click="emit('tambah', t.id, d)"
                  >
                    <UIcon
                      name="i-lucide-plus"
                      class="size-3.5"
                    />
                  </button>
                  <button
                    v-else-if="bolehUbah && !isi(t.id, d).length"
                    type="button"
                    class="flex h-9 w-full items-center justify-center rounded text-dimmed hover:bg-elevated hover:text-default"
                    :title="`Isi ${t.nama} · ${tglKolom(d)} dengan jam bawaan`"
                    :aria-label="`Isi ${t.nama} pada ${tglKolom(d)}`"
                    @click="emit('kosong', t.id, d)"
                  >
                    <UIcon
                      name="i-lucide-plus"
                      class="size-4 opacity-40"
                    />
                  </button>
                  <span
                    v-else-if="!isi(t.id, d).length"
                    class="block h-9 text-center leading-9 text-dimmed"
                  >·</span>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!grup.length">
            <td
              colspan="8"
              class="py-8 text-center text-sm text-muted"
            >
              Belum ada talent aktif di kategori ini.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- phone: one card per day -->
    <div class="divide-y divide-default lg:hidden">
      <section
        v-for="(d, i) in hari"
        :key="d"
        class="p-3"
        :class="d === sekarang ? 'bg-primary-50' : ''"
      >
        <header class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-bold text-highlighted normal-case">
            {{ HARI_PENDEK[i] }}, <span class="num">{{ tglKolom(d) }}</span>
          </h3>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            :icon="bolehUbah ? 'i-lucide-pencil' : 'i-lucide-eye'"
            @click="emit('hari', d)"
          >
            {{ bolehUbah ? 'Atur hari ini' : 'Lihat' }}
          </UButton>
        </header>
        <p
          v-if="!(hariRows.get(d) ?? []).length"
          class="text-xs text-muted"
        >
          Belum ada jadwal.
        </p>
        <ul class="space-y-1">
          <li
            v-for="r in (hariRows.get(d) ?? [])"
            :key="r.kunci"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded border-l-2 px-2 py-1.5 text-left text-xs font-semibold"
              :class="kelasChip(r, katTalent.get(r.talent_id) ?? r.performance_type)"
              :title="judulChip(r, katTalent.get(r.talent_id) ?? r.performance_type)"
              @click="emit('pilih', r.kunci)"
            >
              <span class="num shrink-0">{{ jamTeks(r) }}</span>
              <span
                v-if="beda(r, katTalent.get(r.talent_id) ?? r.performance_type)"
                class="size-1.5 shrink-0 rounded-full bg-warning"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate">{{ namaTalent.get(r.talent_id) ?? 'Talent' }}</span>
              <span class="shrink-0 text-[10px] font-medium opacity-80">{{ r.performance_type }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </AppPanel>
</template>
