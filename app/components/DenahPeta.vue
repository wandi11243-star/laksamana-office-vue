<!--
  The table plan. Draws one layout and, on top of it, what is happening at each
  table right now. No fetch and no state of its own: the rows and the plan come
  in as props, the rules come from app/utils/kunci-meja.ts, and every decision
  goes back out as an event. Marketing's VIP booking uses the same component
  against the same helpers (PLAN.md §4).

  Two modes:
    'tampil'  the day-of map — clicking a table opens its booking, clicking a
              free one asks the host what to do (Tahap 3 handles the dialogs).
    'pilih'   the booking form — clicking picks a table, and a table that is
              locked but overridable asks first.

  A table's FILL is its zone, not its status: the zone is how the crew names a
  table on the floor ("yang di area kayu"). Status rides on top as a dot, and
  DenahLegenda names the colours.

  Geometry is a fixed 1600x1160 canvas turned into percentages, so the plan
  follows any width without distorting — the same trick as the old
  seatMapMarkup(). Text uses clamp() for the same reason: a plan you can scale
  but not read is no use on a phone.
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import type { LayoutDenah, MasterDenah } from '~/utils/venue-layouts'
import { SEAT_W, SEAT_H, capMax } from '~/utils/venue-layouts'
import {
  absMin, arrivedPax, canAddArrival, fmtMenit, harihOccupancy, hhmm, isSeated,
  menitMenuju, occupiedMap, remainingPax, roomText, statusMeja, type StateMeja,
} from '~/utils/kunci-meja'

const props = withDefaults(defineProps<{
  /** The plan to draw. A missing plan is a real error, not an empty map. */
  layout: LayoutDenah
  /** The rows to show. Both panels read the same rows. */
  reservasi?: Reservasi[]
  /** The date being drawn. Also decides the weekday/weekend plan upstream. */
  tanggal: string
  /** The form's time. Without it the map uses the loose rule (seated guests only). */
  jam?: string
  mode?: 'tampil' | 'pilih'
  /** Tables already picked in the form. */
  terpilih?: string[]
  /** Tables the crew forced with approval, for this date + time. */
  dipaksa?: string[]
  /** The booking being edited — it does not block its own tables. */
  kecualiId?: string | null
  /** Today: a seated guest really occupies the table, and walk-ins may sit. */
  hariIni?: boolean
  /** A filter is hiding part of the rows, so the map may not be used to pick. */
  saringAktif?: boolean
  /** `dineEstMin` & `clashLeadMin` from the master. */
  master?: MasterDenah & { dineEstMin?: number, clashLeadMin?: number }
  /** The "sitting since" counter under a seated guest's name. */
  timer?: boolean
  /** How many guests are on the waiting list (day-of map only). */
  nunggu?: number
  /** Show the colour legend under the plan. */
  legenda?: boolean
}>(), {
  reservasi: () => [],
  mode: 'tampil',
  terpilih: () => [],
  dipaksa: () => [],
  kecualiId: null,
  hariIni: false,
  saringAktif: false,
  timer: false,
  nunggu: 0,
  legenda: true,
})

export interface PermintaanTumpang {
  meja: string
  tanggal: string
  jam: string
  lawan: Reservasi
  /** Locked outright: no question, nothing the crew can answer. */
  kunci: boolean
  /** Within 2 hours: the party will practically meet at the same table. */
  mepet: boolean
  pesan: string
}

const emit = defineEmits<{
  /** A table was clicked while picking. */
  pilih: [meja: string]
  /** A table with a booking on it was clicked: open that booking. */
  buka: [resId: string]
  /** A locked table was clicked: the caller shows `pesan` and answers. */
  tumpang: [p: PermintaanTumpang]
}>()

const rows = computed(() => props.reservasi.filter(r => r.date && r.time))
const dineEst = computed(() => (Number(props.master?.dineEstMin) > 0 ? Number(props.master?.dineEstMin) : 180))

/** A plan is never "no tables": if it is, the crew is looking at the wrong thing. */
const meja = computed(() => props.layout?.tables ?? [])
const fix = computed(() => props.layout?.fixed ?? [])

const peta = computed(() => {
  if (props.mode === 'pilih') {
    return {
      occ: occupiedMap(rows.value, { date: props.tanggal, time: props.jam, exceptId: props.kecualiId, dineEst: dineEst.value }),
      later: new Map<string, Reservasi[]>(),
    }
  }
  return harihOccupancy(rows.value, { date: props.tanggal, hariIni: props.hariIni, dineEst: dineEst.value })
})
const occ = computed(() => peta.value.occ)
const later = computed(() => peta.value.later)

const capOf = (id: string) => capMax(meja.value.find(t => String(t.id) === String(id))?.cap)

const states = computed(() => new Map(meja.value.map(t => [
  String(t.id),
  statusMeja(t, {
    occ: occ.value,
    later: later.value,
    mode: props.mode,
    date: props.tanggal,
    time: props.jam,
    terpilih: props.terpilih,
    dipaksa: props.dipaksa,
    capOf,
    master: props.master,
    dineEst: dineEst.value,
  }),
])))

// The clock only ticks while something is actually counting.
const now = ref(Date.now())
const adaDuduk = computed(() => [...occ.value.values()].some(l => l.some(isSeated)))
let jeda: ReturnType<typeof setInterval> | undefined
const nyalakan = () => {
  clearInterval(jeda)
  jeda = props.timer && adaDuduk.value ? setInterval(() => (now.value = Date.now()), 1000) : undefined
}
onMounted(nyalakan)
onBeforeUnmount(() => clearInterval(jeda))
watch([() => props.timer, adaDuduk], nyalakan)

// --- geometry ---------------------------------------------------------------

const pc = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`
const kotak = (o: { x: number, y: number, w: number, h: number }) => ({
  left: pc(o.x, SEAT_W),
  top: pc(o.y, SEAT_H),
  width: pc(o.w, SEAT_W),
  height: pc(o.h, SEAT_H),
})

// --- what a table says -------------------------------------------------------

const namaDepan = (r?: Reservasi | null) => String(r?.name ?? '').split(' ')[0] || '—'

const jamR = (r: Reservasi) => (r.date === props.tanggal ? r.time : `${hhmm(absMin(r.date, r.time))} (${r.date.slice(8, 10)})`)

const jamSitting = (cin: number) => {
  const m = Math.floor((now.value - cin) / 60000)
  return m < 1 ? 'baru saja' : `${fmtMenit(m)}`
}

/** The line under the table number. The old markup's wording, kept (`:2286-2330`). */
function labelT(stat: ReturnType<typeof statusMeja>, cap: string) {
  const list = stat.list
  if (stat.state === 'terpilih') return `${cap} pax`
  if (stat.state === 'sharing') return `Gabung · ${list.length} grup`
  if (list.length) {
    const r = list[0]!
    const sisa = canAddArrival(r) ? remainingPax(r) : 0
    const partial = stat.fill.sisaMax > 0 && list.some(isSeated)
    if (partial) return `${namaDepan(r)} ${stat.fill.terisi}/${cap}`
    if (sisa) return `${namaDepan(r)} ${arrivedPax(r)}/${r.pax}`
    return namaDepan(r)
  }
  if (stat.next) return namaDepan(stat.next)
  return `${cap} pax`
}

/** The line under that: the time, or the sitting counter. */
function subT(stat: ReturnType<typeof statusMeja>) {
  const list = stat.list
  if (stat.state === 'terpilih' || stat.state === 'sharing') return ''
  if (list.length) {
    const r = list[0]!
    if (isSeated(r)) return r.checkinAt ? `Duduk ${jamSitting(r.checkinAt)}` : 'Sedang duduk'
    return jamR(r)
  }
  if (stat.next) {
    const m = menitMenuju(stat.next, now.value)
    if (m < 0) return `Telat ${fmtMenit(-m)}`
    return stat.state === 'mepet' ? `Mepet · ${jamR(stat.next)}` : jamR(stat.next)
  }
  return props.nunggu ? `${props.nunggu} menunggu` : ''
}

/** The dot in the corner: status as a colour, the words are in the legend. */
const WARNA_STATUS: Record<string, string> = {
  kosong: 'text-muted',
  terpilih: 'text-highlighted',
  sharing: 'text-highlighted',
  pending: 'text-warning',
  confirmed: 'text-success',
  datang: 'text-error',
  mepet: 'text-warning',
  dipesan: 'text-muted',
  terkunci: 'text-muted',
}

/** Locked tables are dimmed rather than recoloured: a locked table is still in its zone. */
const kelasT = (s: StateMeja, dipaksa: boolean) => [
  `seat-${s}`,
  s === 'terkunci' || s === 'mepet' ? 'seat-mati' : '',
  s === 'terpilih' ? 'seat-terpilih' : '',
  dipaksa ? 'seat-dipaksa' : '',
]

/** The tooltip carries everything the box is too small for. */
function judul(stat: ReturnType<typeof statusMeja>, cap: string) {
  const id = [...states.value.entries()].find(([, v]) => v === stat)?.[0] ?? ''
  const baris = [`Meja ${id}, ${cap} pax`]
  if (stat.list.length) {
    const r = stat.list[0]!
    baris.push(isSeated(r)
      ? `${r.name}, sedang duduk sejak ${jamSitting(r.checkinAt || 0)} (${arrivedPax(r)} dari ${r.pax} pax)`
      : `${r.name}, ${jamR(r)}, ${r.status}, ${r.pax} pax`)
  }
  if (stat.fill.sisaMax > 0) baris.push(`Kursi: terisi ${stat.fill.terisi} dari ${cap} pax, masih muat ${roomText(stat.fill)} orang lagi.`)
  if (stat.lain) baris.push(`Ada ${stat.lain} reservasi lain di meja ini.`)
  if (stat.next) baris.push(`Dipesan ${stat.next.name} jam ${jamR(stat.next)}.`)
  if (stat.over) baris.push('Sudah duduk melewati estimasi — meja tetap terisi sampai ditandai Selesai.')
  if (stat.alih.length) baris.push(`${stat.alih.map(x => `${x.name} jam ${x.time}`).join(', ')} sudah dekat — meja masih terisi, alihkan sementara ke meja lain.`)
  return baris.join('\n')
}

// --- clicking ---------------------------------------------------------------

function klik(mejaId: string) {
  const stat = states.value.get(mejaId)
  if (!stat) return
  if (props.saringAktif && !stat.list.length) return

  if (props.mode === 'pilih') {
    if (stat.state === 'terpilih') return emit('pilih', mejaId)
    const r0 = stat.list[0]
    if (r0) {
      // Locked tables are refused, and overridable ones ask first. A button that
      // does nothing at all reads as a broken screen — that is the old behaviour
      // here too, so the caller gets the message either way.
      const kunci = stat.kunci
      const beda = Math.abs(absMin(r0.date, r0.time) - absMin(props.tanggal, props.jam ?? ''))
      return emit('tumpang', {
        meja: mejaId,
        tanggal: props.tanggal,
        jam: props.jam ?? '',
        lawan: r0,
        kunci,
        mepet: !kunci && beda <= 120,
        pesan: kunci
          ? (isSeated(r0)
              ? `Meja ${mejaId} sedang diduduki ${r0.name} — tandai "Selesai" dulu kalau tamunya sudah pulang.`
              : `Meja ${mejaId} terkunci — ${r0.name} jam ${r0.time}, tinggal ${fmtMenit(beda)} lagi.`)
          : `Meja ${mejaId} sudah dipesan ${r0.name} jam ${r0.time}. Kalau tetap dipakai, kamu yang memastikan mejanya kosong tepat waktu.`,
      })
    }
    return emit('pilih', mejaId)
  }

  if (stat.list.length) return emit('buka', stat.list[0]!.id)
  if (props.saringAktif) return
  emit('pilih', mejaId)
}
</script>

<template>
  <div>
    <p
      v-if="saringAktif"
      class="mb-2 text-sm text-muted"
    >
      Saringan dashboard aktif — meja yang tidak tampil masih bisa dipesan. Pilih meja dari daftar, bukan dari denah.
    </p>

    <div class="denah">
      <div class="denah-in">
        <div
          v-for="(f, i) in fix"
          :key="`f${i}`"
          class="fix"
          :class="`fix-${f.t}`"
          :style="kotak(f)"
        >
          {{ f.label }}
        </div>

        <button
          v-for="t in meja"
          :key="String(t.id)"
          type="button"
          class="seat"
          :class="[kelasT(states.get(String(t.id))!.state, states.get(String(t.id))!.dipaksa), `seat-${t.zone}`, { 'seat-duduk': states.get(String(t.id))!.over }]"
          :style="kotak(t)"
          :title="judul(states.get(String(t.id))!, t.cap)"
          @click="klik(String(t.id))"
        >
          <span class="sn">{{ t.id }}</span>
          <span class="sp">{{ labelT(states.get(String(t.id))!, t.cap) }}</span>
          <span
            v-if="subT(states.get(String(t.id))!)"
            class="sub"
          >{{ subT(states.get(String(t.id))!) }}</span>
          <span
            v-if="states.get(String(t.id))!.over"
            class="titik"
            :class="WARNA_STATUS.datang"
            aria-hidden="true"
          />
          <span
            v-else-if="states.get(String(t.id))!.state !== 'kosong'"
            class="titik"
            :class="WARNA_STATUS[states.get(String(t.id))!.state]"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <DenahLegenda v-if="legenda" />

    <p
      v-if="adaDuduk && !timer"
      class="mt-2 text-sm text-muted"
    >
      Kursi sedang terisi — tandai "Selesai" begitu tamunya pulang supaya mejanya bisa dipakai lagi.
    </p>
    <p
      v-else-if="adaDuduk"
      class="mt-2 text-sm text-muted"
    >
      Seumur {{ fmtMenit(dineEst) }} sejak mulai duduk, mejanya dilepas sendiri.
    </p>
  </div>
</template>

<style scoped>
/*
  Geometry and type only; every colour is a token from app/assets/css/main.css
  (DESIGN.md: no hex in components).
*/
.denah {
  position: relative;
  width: 100%;
  aspect-ratio: 1600 / 1160;
  overflow: auto;
  background: var(--color-ink-100);
  border: 1px solid var(--color-ink-200);
  border-radius: 0.75rem;
  user-select: none;
  overscroll-behavior-x: contain;
}

.denah-in {
  position: relative;
  width: 100%;
  min-width: 42rem;
  aspect-ratio: 1600 / 1160;
}

.fix {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  text-align: center;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-ink-500);
  border-radius: 0.375rem;
  pointer-events: none;
}

.fix-stage {
  background: var(--color-ink-300);
  color: var(--color-ink-100);
  font-size: clamp(0.7rem, 2.1vw, 1.6rem);
  letter-spacing: 0.06em;
}

.fix-floor2 {
  border: 1px solid var(--color-ink-300);
  font-size: clamp(0.7rem, 1.9vw, 1.4rem);
}

.fix-foh {
  background: var(--color-ink-800);
  color: var(--color-ink-100);
  font-size: clamp(0.6rem, 1.3vw, 0.95rem);
}

.fix-dj,
.fix-tangga {
  background: var(--color-laksamana-200);
  color: var(--color-laksamana-950);
  font-size: clamp(0.5rem, 1vw, 0.8rem);
}

.fix-viproom,
.fix-entrance {
  border: 1px dashed var(--color-ink-300);
  font-size: clamp(0.5rem, 1vw, 0.8rem);
}

.seat {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.125rem;
  overflow: hidden;
  line-height: 1.05;
  color: var(--color-ink-900);
  border: 1.5px solid var(--color-ink-300);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: transform 0.1s;
}

.seat:hover {
  transform: scale(1.05);
  z-index: 5;
}

.seat-green {
  background: var(--color-seat-green);
  border-radius: 9999px;
}

.seat-blue { background: var(--color-seat-blue); }
.seat-wood { background: var(--color-seat-wood); }
.seat-vip { background: var(--color-seat-vip); }
.seat-dark { background: var(--color-seat-dark); }
.seat-diamond { background: var(--color-seat-diamond); }
.seat-ext { background: var(--color-seat-ext); }

.sn {
  font-weight: 700;
  font-size: clamp(0.5rem, 1.4vw, 0.95rem);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp {
  font-size: clamp(0.4rem, 0.85vw, 0.65rem);
  font-weight: 600;
  opacity: 0.8;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  font-size: clamp(0.35rem, 0.75vw, 0.6rem);
  opacity: 0.7;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.titik {
  position: absolute;
  top: 0.2rem;
  right: 0.2rem;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: currentcolor;
}

/* Locked and too close: dimmed, not recoloured — the zone must stay readable. */
.seat-mati {
  cursor: not-allowed;
  opacity: 0.55;
}

.seat-mati:hover {
  transform: none;
}

/* Picked: a thick yellow ring AROUND the table. The zone has to stay readable —
   filling it yellow hides exactly the thing being checked before saving. */
.seat-terpilih {
  box-shadow: 0 0 0 3px var(--ui-primary);
  opacity: 1;
  z-index: 6;
}

.seat-dipaksa {
  box-shadow: 0 0 0 3px var(--color-laksamana-600);
}

.seat-duduk {
  border-color: var(--color-error);
}
</style>
