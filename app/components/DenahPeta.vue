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

  A table's FILL is its STATUS, in the old Reservasi plan's colours (owner
  request, Nov 2026), with the free chairs written under each table ("4 - 5
  pax"). DenahLegenda names the colours with the old wording.

  Geometry is a fixed 1600x1160 canvas turned into percentages, so the plan
  follows any width without distorting — the same trick as the old
  seatMapMarkup(). Text uses clamp() for the same reason: a plan you can scale
  but not read is no use on a phone.
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import type { LayoutDenah, MasterDenah } from '~/utils/venue-layouts'
import { SEAT_W, SEAT_H, capMax, cariMeja } from '~/utils/venue-layouts'
import { normStatus } from '~/utils/riwayat'
import {
  absMin, arrivedPax, canAddArrival, fmtMenit, harihOccupancy, hhmm, isSeated,
  menitMenuju, occupiedMap, remainingPax, roomText, sedangDialihkan, statusMeja, toMin,
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
  /** Tables lit by the search box (the rest dim); null = no search. */
  sorot?: string[] | null
  /** `dineEstMin` & `clashLeadMin` from the master. */
  master?: MasterDenah & { dineEstMin?: number, clashLeadMin?: number }
  /** The "sitting since" counter under a seated guest's name. */
  timer?: boolean
  /** How many guests are on the waiting list (day-of map only). */
  nunggu?: number
  /** Show the colour legend under the plan. */
  legenda?: boolean
  /** Fit the complete plan to its available width without an inner scroll area. */
  fit?: boolean
  /**
   * The "4 - 5 pax" line under each table. On by default (owner request,
   * Nov 2026): the pax lives UNDER the table only, not inside the box too. A
   * table with no room below (another table right under it) keeps it inside.
   */
  catatan?: boolean
}>(), {
  catatan: true,
  reservasi: () => [],
  mode: 'tampil',
  terpilih: () => [],
  dipaksa: () => [],
  kecualiId: null,
  hariIni: false,
  saringAktif: false,
  sorot: null,
  timer: false,
  nunggu: 0,
  legenda: true,
  fit: false,
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
  /**
   * Day-of map: a free table booked for LATER (more than an hour away) was
   * clicked. The old app offers two ways out here (26 Sep 2026): open the
   * booker's reservation (they arrived early) or seat a new walk-in for a while.
   */
  dipesan: [p: { meja: string, res: Reservasi, lain: number }]
  /** Day-of map: a sharing table was clicked — manage its parties (old sharingTableAction). */
  sharing: [meja: string]
}>()

const rows = computed(() => props.reservasi.filter(r => r.date && r.time))
const dineEst = computed(() => (Number(props.master?.dineEstMin) > 0 ? Number(props.master?.dineEstMin) : 180))

/** A plan is never "no tables": if it is, the crew is looking at the wrong thing. */
const meja = computed(() => props.layout?.tables ?? [])
/** Background blocks switched off in the editor (`hidden`) are kept in the data but never drawn. */
const fix = computed(() => (props.layout?.fixed ?? []).filter(f => !f.hidden))

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

/**
 * A table's capacity by id. One booking may use tables from another floor or
 * plan, so a table that is not on THIS plan is looked up across every template
 * (old capOfTableId) — otherwise its share of a multi-table party is wrong.
 */
const capOf = (id: string) => {
  const t = meja.value.find(x => String(x.id) === String(id)) ?? cariMeja(props.master, id)?.t
  return capMax(t?.cap)
}

// --- search highlight (owner, Nov 2026) ----------------------------------------

const denahEl = ref<HTMLElement | null>(null)
const sorotSet = computed(() => (props.sorot ? new Set(props.sorot) : null))

/** Lit when the search matches the table, dimmed when a search is on and it does not. */
function kelasSorot(id: string) {
  if (!sorotSet.value) return ''
  return sorotSet.value.has(id) ? 'st-sorot' : 'st-redup'
}

/** Bring the first lit table into view, once the floor holding it is drawn. */
watch([() => props.sorot, () => props.layout], async () => {
  if (!sorotSet.value?.size) return
  await nextTick()
  const el = [...(denahEl.value?.querySelectorAll<HTMLElement>('.seat.st-sorot') ?? [])][0]
  el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
})

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
/** Today's map with a guest still to come: the late / follow-up flash must switch on by itself. */
const adaMenunggu = computed(() => props.mode === 'tampil' && props.hariIni && later.value.size > 0)
let jeda: ReturnType<typeof setInterval> | undefined
const nyalakan = () => {
  clearInterval(jeda)
  const detik = props.timer && adaDuduk.value
  // Every second: the sitting and late counters show seconds.
  jeda = detik || adaMenunggu.value ? setInterval(() => (now.value = Date.now()), 1000) : undefined
}
onMounted(nyalakan)
onBeforeUnmount(() => clearInterval(jeda))
watch([() => props.timer, adaDuduk, adaMenunggu], nyalakan)

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

/** A running clock "1:05:23" — hours, minutes, seconds (owner request, Nov 2026). */
const fmtJamDetik = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/** The booking's own moment on the local clock, for a seconds-exact late counter. */
const msPesan = (r: Reservasi) => new Date(`${r.date}T00:00:00`).getTime() + toMin(r.time) * 60000

/** Sitting time "1:05" — hours and minutes; the seconds were noise here (owner request, Nov 2026). */
const jamSitting = (cin: number) => {
  const m = Math.max(0, Math.floor((now.value - cin) / 60000))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** "4-5" -> "4 - 5 pax": a spaced range reads at a glance. */
const paxTeks = (cap: string) => `${String(cap).replace(/\s*-\s*/g, ' - ')} pax`

/** The line under the table number. The old markup's wording, kept (`:2286-2330`). */
function labelT(stat: ReturnType<typeof statusMeja>, cap: string, id: string) {
  const list = stat.list
  // The pax goes under the box when there is room for it there.
  const paxDiBawah = props.catatan && adaRuangCatatan.value.has(id)
  if (stat.state === 'terpilih') return paxDiBawah ? '' : paxTeks(cap)
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
  return paxDiBawah ? '' : paxTeks(cap)
}

/** The line under that: the time, or the sitting counter. */
function subT(stat: ReturnType<typeof statusMeja>) {
  const list = stat.list
  if (stat.state === 'terpilih' || stat.state === 'sharing') return ''
  if (list.length) {
    const r = list[0]!
    if (isSeated(r)) return r.checkinAt ? jamSitting(r.checkinAt) : ''
    return jamR(r)
  }
  // Booked for later: the padlock (open / shut) and the booking time, as the old
  // map. Lateness is its own tag below, so the time stays readable.
  if (stat.next) return jamR(stat.next)
  // The waiting count belongs in the tooltip only (`:2331`). Printed under every
  // empty table it repeats the same number across the whole plan and trains the
  // eye to skip the line.
  return ''
}

/** "telat 25 m" — the booker's time has passed and they have not arrived (old seat-telat, 26 Sep 2026). */
function telatT(stat: ReturnType<typeof statusMeja>): string {
  if (stat.list.length || !stat.next) return ''
  const lewat = now.value - msPesan(stat.next)
  return lewat > 0 && Number.isFinite(lewat) ? `telat ${fmtJamDetik(lewat)}` : ''
}

/**
 * The flash on today's map (old updateHarihTimers, fu-warn / fu-late): a booker
 * due within 10 minutes pulses gold ("follow up"), one whose time has passed and
 * who has not arrived turns yellow and blinks until they come, cancel or no-show.
 */
function fuT(stat: ReturnType<typeof statusMeja>): 'telat' | 'fu' | '' {
  if (props.mode !== 'tampil' || !props.hariIni || stat.list.length || !stat.next) return ''
  if (!['Pending', 'Confirmed'].includes(stat.next.status)) return ''
  const m = menitMenuju(stat.next, now.value)
  if (m < 0) return 'telat'
  return m <= 10 ? 'fu' : ''
}

/** Bookings still to come on a booked table: the ones after the first, plus those booked later (old `lain`). */
function lainT(id: string, stat: ReturnType<typeof statusMeja>): number {
  if (!stat.list.length || stat.state === 'sharing') return stat.lain
  return stat.list.length - 1 + (later.value.get(id)?.length ?? 0)
}

/** The guest at this table was moved here for now; their own table is another one (old 🔁 tag). */
const nebengT = (stat: ReturnType<typeof statusMeja>) =>
  stat.state !== 'sharing' && !!stat.list[0] && sedangDialihkan(stat.list[0])

/** Seated while the next booking on the table is close or late: someone has to move. */
const alihT = (stat: ReturnType<typeof statusMeja>) =>
  props.mode === 'tampil' && stat.alih.length > 0 && stat.list.some(isSeated)

/**
 * The table's fill is its STATUS, in the old Reservasi plan's colours (owner
 * request, Nov 2026 — deploy/reservasi .seat.*): cream free, yellow pending,
 * green confirmed, red arrived, blue seated with seats left, purple sharing,
 * dashed teal booked for later, solid green booked within the hour. The zone
 * keeps only its shape (round green tables). DenahLegenda names every colour.
 */
function kelasT(s: ReturnType<typeof statusMeja>) {
  const list = s.list
  const r0 = list[0]
  const k: string[] = []
  if (s.state === 'terpilih') k.push('st-kosong', 'st-terpilih')
  else if (s.state === 'sharing') k.push('st-sharing')
  else if (r0) {
    k.push(`st-${s.state}`)
    // Seated with chairs to spare (a 4-5 table holding 2): blue, room for more.
    if (props.mode === 'tampil' && s.fill.sisaMax > 0 && list.some(isSeated)) k.push('st-sisa')
    // A party arriving in waves, not complete yet: a gold ring inside.
    if (canAddArrival(r0) && remainingPax(r0) > 0) k.push('st-sebagian')
    // The form: a booked table is either refused (seated / too close) or asks first.
    if (props.mode === 'pilih') k.push(s.kunci ? 'st-mati' : 'st-tanya')
  }
  else {
    k.push(`st-${s.state}`)
    // Booked within the hour: the fill follows the booker's status, so a
    // Pending booking does not look Confirmed (owner, Nov 2026).
    if (s.state === 'mepet' && s.next && normStatus(s.next.status) === 'Pending') k.push('st-mepet-pending')
  }
  if (s.dipaksa) k.push('st-dipaksa')
  if (s.over) k.push('seat-duduk')
  if (alihT(s)) k.push('st-alih')
  const fu = fuT(s)
  if (fu) k.push(`st-fu-${fu}`)
  return k
}

/**
 * Tables with room under them for the free-chairs line. In a tight column
 * (M1–M10 on floor 2) the line would sit ON the next table, so it is left out
 * there — the tooltip still says it.
 */
const adaRuangCatatan = computed(() => {
  const ts = meja.value
  return new Set(ts.filter((t) => {
    const y0 = t.y + t.h
    const y1 = y0 + 30
    return !ts.some(o => o !== t && o.x < t.x + t.w && o.x + o.w > t.x && o.y < y1 && o.y + o.h > y0)
  }).map(t => String(t.id)))
})

/** The padlock in front of the time: open = may be used after a question, shut = not now. */
function gembok(s: ReturnType<typeof statusMeja>): string {
  if (s.state === 'dipesan') return 'i-lucide-lock-open'
  if (s.state === 'mepet') return 'i-lucide-lock'
  if (props.mode === 'pilih' && s.list.length && s.state !== 'sharing' && s.state !== 'terpilih') {
    return isSeated(s.list[0]!) ? 'i-lucide-utensils' : (s.kunci ? 'i-lucide-lock' : 'i-lucide-lock-open')
  }
  return ''
}

/**
 * The line UNDER each table (old seatNote, :1950): the chairs still free.
 * "4 - 5 pax" on a free table, "sisa 2 pax" on a shared one with room,
 * "kursi penuh" when full — and "meja dikunci" on a booked table that is not
 * shared, whose spare chairs nobody else may sell.
 */
function catatanT(t: { cap: string, w: number }, s: ReturnType<typeof statusMeja>): { txt: string, kls: string } | null {
  if (!s.fill.max) return null
  // Just the seats, no "bisa" (owner request, Nov 2026): "4-5" reads as "4 - 5 pax".
  if (!s.list.length) return { txt: paxTeks(t.cap), kls: '' }
  if (s.state !== 'sharing') return { txt: 'meja dikunci', kls: 'note-penuh' }
  if (s.fill.sisaMax > 0) return { txt: `sisa ${roomText(s.fill)} pax`, kls: 'note-sisa' }
  return { txt: 'kursi penuh', kls: 'note-penuh' }
}

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
  if (stat.list.length && stat.state !== 'sharing') {
    const nanti = [...stat.list.slice(1), ...(later.value.get(id) ?? [])]
    if (nanti.length) baris.push(`Berikutnya di meja ini: ${nanti.map(x => `${x.name} ${jamR(x)}`).join(', ')}`)
  }
  else if (stat.lain) baris.push(`Ada ${stat.lain} reservasi lain di meja ini.`)
  if (stat.next) {
    const m = menitMenuju(stat.next, now.value)
    baris.push(`Kosong sekarang. Dipesan ${stat.next.name} jam ${jamR(stat.next)} (${m > 0 ? `${fmtMenit(m)} lagi` : `jamnya sudah lewat ${fmtMenit(-m)}`}, ${stat.next.pax} pax).`)
  }
  if (!stat.list.length && !stat.next) {
    baris.push('Kosong. Klik untuk ' + (props.nunggu
      ? `pilih tamu dari waiting list (${props.nunggu} menunggu) atau catat walk-in.`
      : 'catat walk-in.'))
  }
  else if (!stat.list.length) {
    baris.push(props.mode === 'pilih'
      ? 'Klik kalau tetap mau memakainya — kamu akan ditanya dulu.'
      : stat.state === 'mepet'
        ? `TERKUNCI untuk walk-in — mejanya disiapkan untuk ${stat.next?.name}. Klik untuk mengubah status ${stat.next?.name} (Datang, Batal, No-show…).`
        : 'Masih boleh dipakai walk-in / duduk sementara. Klik untuk buka reservasi pemesan atau isi walk-in.')
  }
  if (nebengT(stat)) baris.push(`Dialihkan sementara dari meja ${stat.list[0]!.tableAsli} — kembalikan ke sana kalau sudah bebas.`)
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

  // Day-of map (old seatMapMarkup 'view' + seatEmptyClick):
  //   sharing table       -> manage its parties
  //   booked / seated     -> open that booking
  //   booked within 1 h   -> locked for walk-ins, opens the BOOKER (Datang, Batal, No-show)
  //   booked later        -> choose: open the booker, or a walk-in for a while
  //   free                -> walk-in (or the waiting list)
  if (stat.state === 'sharing') return emit('sharing', mejaId)
  if (stat.list.length) return emit('buka', stat.list[0]!.id)
  if (stat.next && stat.state === 'mepet') return emit('buka', stat.next.id)
  if (props.saringAktif) return
  if (stat.next) return emit('dipesan', { meja: mejaId, res: stat.next, lain: stat.lain })
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

    <div
      ref="denahEl"
      class="denah"
      :class="{ fit }"
    >
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
          :class="[kelasT(states.get(String(t.id))!), t.zone === 'green' ? 'bulat' : '', kelasSorot(String(t.id))]"
          :data-meja="String(t.id)"
          :style="[kotak(t), { '--n': String(t.id).length }]"
          :title="judul(states.get(String(t.id))!, t.cap)"
          :aria-label="judul(states.get(String(t.id))!, t.cap)"
          @click="klik(String(t.id))"
        >
          <span class="sn">{{ t.id }}</span>
          <span
            v-if="labelT(states.get(String(t.id))!, t.cap, String(t.id))"
            class="sp"
          >{{ labelT(states.get(String(t.id))!, t.cap, String(t.id)) }}</span>
          <span
            v-if="subT(states.get(String(t.id))!) || gembok(states.get(String(t.id))!)"
            class="sub"
          >
            <UIcon
              v-if="gembok(states.get(String(t.id))!)"
              :name="gembok(states.get(String(t.id))!)"
              class="ikon"
            />
            {{ subT(states.get(String(t.id))!) }}
          </span>
          <span
            v-if="telatT(states.get(String(t.id))!)"
            class="telat"
          >{{ telatT(states.get(String(t.id))!) }}</span>
          <span
            v-else-if="fuT(states.get(String(t.id))!) === 'fu'"
            class="telat telat-fu"
          >follow up</span>
          <span
            v-if="lainT(String(t.id), states.get(String(t.id))!)"
            class="multi"
          >+{{ lainT(String(t.id), states.get(String(t.id))!) }}</span>
          <span
            v-if="alihT(states.get(String(t.id))!)"
            class="tag tag-alih"
            title="Reservasi berikutnya sudah dekat tapi meja masih terisi — alihkan sementara"
          ><UIcon
            name="i-lucide-triangle-alert"
            class="ikon"
          /></span>
          <span
            v-else-if="mode === 'tampil' && nebengT(states.get(String(t.id))!)"
            class="tag tag-nebeng"
            :title="`Menumpang sementara, meja asli ${states.get(String(t.id))!.list[0]!.tableAsli}`"
          ><UIcon
            name="i-lucide-repeat"
            class="ikon"
          /></span>
        </button>

        <!-- Free chairs, written UNDER each table so they never cover the number or the guest. -->
        <template v-if="catatan">
          <div
            v-for="t in meja.filter(x => adaRuangCatatan.has(String(x.id)))"
            :key="`n${t.id}`"
            class="note"
            :class="catatanT(t, states.get(String(t.id))!)?.kls"
            :style="kotak({ x: t.x, y: t.y + t.h + 3, w: t.w, h: 30 })"
          >
            <span>{{ catatanT(t, states.get(String(t.id))!)?.txt }}</span>
          </div>
        </template>
      </div>
    </div>

    <DenahLegenda
      v-if="legenda"
      :mode="mode"
    />

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
  max-height: 78vh;
  overflow: auto;
  background: var(--color-seat-floor);
  border: 1px solid var(--color-seat-line);
  border-radius: 0.75rem;
  user-select: none;
  overscroll-behavior-x: contain;
}

.denah.fit {
  max-height: none;
  overflow: visible;
}

/*
  A phone cannot show the whole plan at a readable size, so the map becomes its
  own scroll window — both axes, inside the box. The page itself never scrolls
  sideways, which is the rule for 390px.
*/
@media (width < 64rem) {
  .denah {
    height: 62vh;
    aspect-ratio: auto;
  }

  .denah.fit {
    height: auto;
    aspect-ratio: 1600 / 1160;
  }
}

.denah-in {
  position: relative;
  width: 100%;
  min-width: 42rem;
  aspect-ratio: 1600 / 1160;
}

.denah.fit .denah-in {
  min-width: 0;
}

.fix {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  overflow: hidden;
  text-align: center;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
  color: var(--color-seat-ink);
  border-radius: 0.375rem;
  pointer-events: none;
}

.fix-stage {
  background: var(--color-seat-line);
  color: var(--color-seat-ink);
  font-size: clamp(0.7rem, 2.1vw, 1.6rem);
  letter-spacing: 0.06em;
}

.fix-videotron {
  background: var(--color-seat-dark);
  color: var(--color-seat-ink);
  font-size: clamp(0.6rem, 1.6vw, 1.2rem);
  letter-spacing: 0.08em;
}

.fix-floor2 {
  border: 1px solid var(--color-seat-line);
  font-size: clamp(0.7rem, 1.9vw, 1.4rem);
}

.fix-foh {
  background: var(--color-seat-dark);
  color: var(--color-seat-ink);
  font-size: clamp(0.6rem, 1.3vw, 0.95rem);
}

.fix-dj,
.fix-tangga {
  background: var(--color-laksamana-200);
  color: var(--color-laksamana-950);
  font-size: clamp(0.5rem, 1vw, 0.8rem);
}

.fix-viproom {
  border: 1px dashed var(--color-seat-line);
  color: var(--color-seat-ink);
  font-size: clamp(0.5rem, 1vw, 0.8rem);
}

/*
  The entrance block is 44 units wide, so its label is written along its height —
  printed across, "ENTRANCE IN / OUT" is clipped to "NTRANCE" on both 1366px and
  390px. `writing-mode` + the 180° turn reads bottom-to-top, the way the old plan
  did (deploy/reservasi/index.html:450).
*/
.fix-entrance {
  border: 1px dashed var(--color-seat-line);
  background: var(--color-seat-ext);
  color: var(--color-seat-ink);
  font-size: clamp(0.45rem, 0.8vw, 0.7rem);
  letter-spacing: 0.08em;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

/*
  A table: its fill is its STATUS (the old plan's .seat.* colours, tokens in
  main.css). Type follows the plan's width (clamp) like the old one — a plan
  you can scale but not read is no use.
*/
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
  color: white;
  background: var(--color-meja-lain);
  border: 1.5px solid rgb(0 0 0 / 0.16);
  border-radius: 0.4375rem;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  /* Type follows the table's own width too (cqw): a narrow 2-pax table in a
     tight row still shows its whole number instead of "M…". */
  container-type: size;
}

.seat:hover {
  transform: scale(1.06);
  box-shadow: 0 5px 14px rgb(50 42 28 / 0.22);
  z-index: 5;
}

.seat.bulat {
  border-radius: 9999px;
}

/* A round table clipped the corner badges ("+1" cut off, owner Nov 2026):
   it lets them hang outside the circle like a notification dot instead. The
   text lines keep their own max-width/clamp, so nothing else spills. */
.seat.bulat {
  overflow: visible;
}

.seat.bulat .multi {
  top: -5px;
  left: -5px;
  z-index: 1;
  background: rgb(20 14 0 / 0.75);
  box-shadow: 0 0 0 1.5px white;
}

.seat.bulat .tag {
  top: -5px;
  right: -5px;
  z-index: 1;
  box-shadow: 0 0 0 1.5px white;
}

/* Free: cream, gold outline on hover. */
.st-kosong {
  background: var(--color-meja-kosong);
  border-color: var(--color-meja-kosong-line);
  color: var(--color-meja-kosong-ink);
}

.st-kosong:hover {
  outline: 2px solid var(--color-gold);
  outline-offset: 1px;
}

.st-pending {
  background: var(--color-meja-pending);
  color: var(--color-meja-pending-ink);
}

.st-confirmed { background: var(--color-meja-confirmed); }
.st-datang { background: var(--color-meja-datang); }
.st-sharing { background: var(--color-meja-sharing); }

/* Seated with chairs left — after the status colours so it wins. */
.seat.st-sisa {
  background: var(--color-meja-sisa);
  color: white;
}

/* A party not complete yet: a gold ring inside. */
.st-sebagian {
  box-shadow: inset 0 0 0 2.5px var(--color-meja-pending);
}

/* Free now, booked later: may be used after a question (open padlock). */
.st-dipesan {
  background: var(--color-meja-dipesan);
  border: 2px dashed var(--color-meja-dipesan-line);
  color: var(--color-meja-dipesan-ink);
}

/* Booked within the hour: drawn like a confirmed table, solid edge, shut padlock. */
.st-mepet {
  background: var(--color-meja-confirmed);
  border: 2px solid var(--color-meja-confirmed-line);
}

/* Search: matches get a thick gold ring and stay on top, the rest fade. */
.seat.st-redup {
  opacity: 0.25;
}

.seat.st-sorot {
  z-index: 6;
  outline: 3px solid var(--color-gold);
  outline-offset: 2px;
}

.st-mepet.st-mepet-pending {
  background: var(--color-meja-pending);
  border-color: var(--color-meja-pending-ink);
  color: var(--color-meja-pending-ink);
}

/* The form: a booked table that asks first, and one that is refused outright. */
.st-tanya {
  opacity: 0.9;
}

.st-mati {
  cursor: not-allowed;
  filter: grayscale(0.75);
  opacity: 0.6;
}

.st-mati:hover,
.st-tanya:hover {
  transform: none;
  box-shadow: none;
}

/* Picked: a thick gold ring OUTSIDE the table (old .seat.sel). */
.st-terpilih {
  outline: 3px solid var(--color-gold);
  outline-offset: 1px;
  box-shadow: 0 0 0 5px rgb(169 121 31 / 0.22);
  z-index: 6;
}

/* Forced with approval: a thick red edge, so it reads apart from the rest. */
.st-dipaksa {
  outline: 3px solid var(--color-meja-datang);
  outline-offset: -3px;
  opacity: 1;
  filter: none;
}

/* The table number shrinks to fit its table (cqw) rather than ending in "…". */
.sn {
  font-weight: 800;
  /* A short number in a narrow box (M11 in the Lantai 2 strip) may grow past
     26cqw: --n is the id length, so a long "EXT 10" still fits on one line. */
  font-size: min(clamp(0.55rem, 1.5vw, 1rem), max(26cqw, calc(125cqw / var(--n, 5))));
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
}

.denah.fit .sn {
  font-size: min(clamp(0.65rem, 1.5vw, 1rem), max(26cqw, calc(125cqw / var(--n, 5))));
}

/*
  The guest line and the time line WRAP instead of ending in "…" (owner request,
  Nov 2026: a cut-off name is no name). Two lines at most, broken anywhere so a
  long single word still shows whole on a narrow table.
*/
.sp,
.sub {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: normal;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.sp {
  font-size: min(clamp(0.4rem, 0.85vw, 0.65rem), 17cqw);
  font-weight: 700;
  opacity: 0.85;
}

.denah.fit .sp {
  font-size: min(clamp(0.45rem, 0.85vw, 0.65rem), 17cqw);
}

.sub {
  margin-top: 1px;
  font-size: min(clamp(0.4rem, 1.05vw, 0.7rem), 17cqw);
  font-weight: 800;
}

.denah.fit .sub {
  font-size: min(clamp(0.45rem, 1.05vw, 0.7rem), 17cqw);
}

.ikon {
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-right: 0.15em;
  vertical-align: -0.12em;
}

/* More bookings on the same table: a count in the top-left corner. */
.multi {
  position: absolute;
  top: 2px;
  left: 3px;
  padding: 2px 4px;
  font-size: 0.5625rem;
  font-weight: 800;
  line-height: 1;
  color: white;
  background: rgb(20 14 0 / 0.45);
  border-radius: 6px;
}

/* The free-chairs line under each table (old .seat-note). */
.note {
  position: absolute;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 1px;
  text-align: center;
  font-size: clamp(0.4rem, 0.82vw, 0.625rem);
  font-weight: 700;
  line-height: 1.1;
  color: var(--ui-text-muted);
  pointer-events: none;
  white-space: nowrap;
  container-type: inline-size;
}

.note span {
  font-size: min(clamp(0.4rem, 0.82vw, 0.625rem), 22cqw);
}

.note-sisa { color: var(--color-meja-note-sisa); }
.note-penuh { color: var(--color-meja-note-penuh); }

/* The booker is late (old .seat-telat): a small red tag under the time. */
.telat {
  display: block;
  max-width: 100%;
  margin-top: 1px;
  padding: 0 4px;
  white-space: nowrap;
  font-size: min(clamp(0.4rem, 0.7vw, 0.625rem), 14cqw);
  font-weight: 800;
  line-height: 1.4;
  color: white;
  background: var(--color-meja-datang);
  border-radius: 4px;
}

.telat-fu {
  background: var(--color-meja-pending);
  color: var(--color-meja-pending-ink);
}

/*
  Today's map, a booker still to come (old .fu-warn / .fu-late): within 10
  minutes the table pulses gold; past the time and not arrived it turns yellow
  and blinks. After the status colours so it wins.
*/
.seat.st-fu-fu {
  z-index: 4;
  animation: fu-denyut 1.1s ease-in-out infinite;
}

.seat.st-fu-telat {
  z-index: 4;
  background: var(--color-meja-telat);
  border-color: var(--color-meja-pending);
  color: var(--color-meja-pending-ink);
  animation: telat-kedip 1.2s ease-in-out infinite;
}

@keyframes fu-denyut {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-meja-pending) 70%, transparent); }
  50% { box-shadow: 0 0 0 7px transparent; }
}

@keyframes telat-kedip {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-meja-telat) 80%, transparent); opacity: 1; }
  50% { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .seat.st-fu-fu,
  .seat.st-fu-telat {
    animation: none;
  }
}

/* Corner tag: someone has to move (alih), or a guest moved here for now (nebeng). */
.tag {
  position: absolute;
  top: 2px;
  right: 3px;
  display: inline-flex;
  padding: 2px 3px;
  font-size: 0.5625rem;
  line-height: 1;
  color: white;
  border-radius: 6px;
}

.tag-alih { background: var(--color-meja-sharing); }
.tag-nebeng { background: var(--color-meja-confirmed); }

/* Seated while the next booking is close (old .seat-alih): a pulsing ring. */
.seat.st-alih {
  z-index: 5;
  animation: alih-denyut 1.2s ease-in-out infinite;
}

@keyframes alih-denyut {
  0%, 100% { box-shadow: inset 0 0 0 2.5px var(--color-meja-sharing), 0 0 0 0 color-mix(in srgb, var(--color-meja-sharing) 85%, transparent); }
  50% { box-shadow: inset 0 0 0 2.5px var(--color-meja-sharing), 0 0 0 8px transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .seat.st-alih {
    animation: none;
    box-shadow: inset 0 0 0 2.5px var(--color-meja-sharing);
  }
}

/* Seated past the expected stay: a dashed edge. */
.seat-duduk {
  border-style: dashed;
  border-width: 2px;
}
</style>
