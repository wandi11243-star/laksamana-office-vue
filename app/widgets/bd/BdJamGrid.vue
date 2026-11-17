<!--
  BD › hour grid (Hari/Minggu, LM Agenda 30 Okt 2026): timed agendas and timed
  tasks drawn as blocks on a 07:00–22:00 grid (grown to fit), timeless items in
  the "tanpa jam" strip above.

  Interactions, all snapped to 15 minutes:
  - drag an empty slot = a new timed agenda (emitted, the page opens the form);
  - drag a block = move its time/day (written straight through the blob API);
  - drag a block's bottom edge = change its end;
  - a timeless task chip can be dragged onto the grid to give it a time.
  A tap without moving still opens the row (agenda detail / task form).

  Only the organiser, a module admin, or (for team agendas) anyone may move or
  resize an agenda (`agBisaUbah`); everyone else gets the detail. A moved
  schedule drops every RSVP answer and stamps the invites again, so invitees
  are asked anew. Tasks keep the month view's rule: anyone with access may
  shift a deadline.

  Touch: a plain finger scrolls; a 450 ms hold starts the drag. While a drag
  runs, page scroll is held off so the finger owns the gesture.
-->
<script setup lang="ts">
import type { BdAgenda, BdTask } from '~/composables/useBd'
import { bdTulisDiam, tambalBd, versiBaris } from '~/composables/useBd'
import { isAdminOf } from '~/composables/useMe'
import {
  agBisaUbah, jamAgendaBerubah, labelJam, menitJam, menitKeJam, todayISO,
  type RsvpNilai,
} from '~/utils/bd-rumus'

const props = defineProps<{
  agenda: BdAgenda[]
  tasks: BdTask[]
  akuId?: string | null
  /** The drawn days, Monday-first for a week. */
  hari: string[]
  /** Read-only day chips from other modules (reservations, events, marketing), drawn in the timeless strip. */
  luar?: { date: string, title: string, tone: Tone }[]
}>()
const emit = defineEmits<{
  'buka-agenda': [e: BdAgenda]
  'buat-agenda': [awal: { date: string, start?: string, end?: string }]
  'buka-task': [t: BdTask]
}>()

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'bd'))

const HH = 44
const SNAP = 15

type Tone = 'error' | 'gold' | 'info' | 'vip' | 'warning'
interface Blok {
  key: string
  jenis: 'agenda' | 'task'
  ref: BdAgenda | BdTask
  s: number
  en: number
  judul: string
  sub: string
  tone: Tone
  boleh: boolean
  /** I am invited and have not answered yet. */
  pending: boolean
  tolak: boolean
  /** Overlap lane, assigned below. */
  l: number
  n: number
}

const TONE_AGENDA: Record<string, Tone> = { Meeting: 'gold', Vendor: 'info', Internal: 'vip', Deadline: 'warning' }

const blokHari = computed<Record<string, Blok[]>>(() => {
  const out: Record<string, Blok[]> = {}
  for (const d of props.hari) out[d] = []
  for (const e of props.agenda) {
    if (!e.date || !out[e.date]) continue
    const s = menitJam(e.start)
    if (s === null) continue
    let en = menitJam(e.end)
    if (en === null || en <= s) en = Math.min(s + 60, 24 * 60)
    const jawabku = props.akuId && e.owner !== props.akuId ? (e.resp || {})[props.akuId] : undefined
    out[e.date]!.push({
      key: `ag:${e.id}`, jenis: 'agenda', ref: e, s, en,
      judul: e.title,
      sub: `${e.start}${e.end ? `–${e.end}` : ''} · ${e.type || 'Agenda'}`,
      tone: TONE_AGENDA[e.type || ''] || 'gold',
      boleh: agBisaUbah(e, props.akuId, admin.value),
      pending: jawabku === undefined && !!props.akuId && e.owner !== props.akuId
        && Array.isArray(e.peserta) && e.peserta.includes(props.akuId),
      tolak: jawabku === 'tidak',
      l: 0,
      n: 1,
    })
  }
  for (const t of props.tasks) {
    if (!t.deadline || !out[t.deadline] || t.status === 'Done') continue
    const s = menitJam(t.jam)
    if (s === null) continue
    out[t.deadline]!.push({
      key: `t:${t.id}`, jenis: 'task', ref: t, s, en: Math.min(s + 60, 24 * 60),
      judul: t.name,
      sub: `Deadline${labelJam(t.jam)}`,
      tone: 'error',
      boleh: true,
      pending: false,
      tolak: false,
      l: 0,
      n: 1,
    })
  }
  // Overlap lanes: side by side, never covering each other.
  for (const d of props.hari) {
    const bs = out[d]!.sort((a, b) => a.s - b.s || b.en - a.en)
    const ujung: number[] = []
    let kel: { b: Blok, l: number }[] = []
    const tutup = () => {
      const n = Math.max(1, ujung.length)
      for (const x of kel) {
        x.b.l = x.l
        x.b.n = n
      }
      kel = []
      ujung.length = 0
    }
    for (const b of bs) {
      if (kel.length && b.s >= Math.max(...ujung)) tutup()
      let l = ujung.findIndex(e => e <= b.s)
      if (l < 0) {
        l = ujung.length
        ujung.push(b.en)
      }
      else ujung[l] = b.en
      kel.push({ b, l })
    }
    tutup()
  }
  return out
})

/** Timeless items per day: agendas without a start, tasks with a deadline but no time. */
const tanpaJam = computed<Record<string, { ag: BdAgenda[], task: BdTask[] }>>(() => {
  const out: Record<string, { ag: BdAgenda[], task: BdTask[] }> = {}
  for (const d of props.hari) out[d] = { ag: [], task: [] }
  for (const e of props.agenda) {
    if (e.date && out[e.date] && menitJam(e.start) === null) out[e.date]!.ag.push(e)
  }
  for (const t of props.tasks) {
    if (t.deadline && out[t.deadline] && t.status !== 'Done' && menitJam(t.jam) === null) out[t.deadline]!.task.push(t)
  }
  return out
})

const datar = computed(() => {
  let h0 = 7
  let h1 = 22
  for (const d of props.hari) {
    for (const b of blokHari.value[d] || []) {
      h0 = Math.min(h0, Math.floor(b.s / 60))
      h1 = Math.max(h1, Math.ceil(Math.min(b.en, 1440) / 60))
    }
  }
  return { h0, h1 }
})

const menitMin = computed(() => datar.value.h0 * 60)
const menitMaks = computed(() => datar.value.h1 * 60)

function gayaBlok(b: Blok): Record<string, string> {
  const s = Math.max(b.s, menitMin.value)
  const en = Math.max(Math.min(b.en, menitMaks.value), s + 15)
  const n = b.n || 1
  const l = b.l || 0
  return {
    top: `${((s - menitMin.value) / 60) * HH}px`,
    height: `${Math.max(22, ((en - s) / 60) * HH - 2)}px`,
    left: `calc(${(100 / n) * l}% + 2px)`,
    width: `calc(${100 / n}% - 4px)`,
  }
}

/** The other modules' chips per drawn day. */
const luarHari = computed(() => {
  const out: Record<string, { title: string, tone: Tone }[]> = {}
  for (const x of props.luar ?? []) (out[x.date] ??= []).push(x)
  return out
})

const KELAS_TONE: Record<Tone, string> = {
  error: 'border-l-error',
  gold: 'border-l-yellow-deep',
  info: 'border-l-info',
  vip: 'border-l-lilac-light',
  warning: 'border-l-warning',
}

// ---------------------------------------------------------------- drag state

interface Seret {
  kind: 'buat' | 'pindah' | 'tepi'
  boleh: boolean
  hariIx: number
  asalMin: number
  minKini: number
  hariKini: number
  ref?: BdAgenda | BdTask
  jenis?: 'agenda' | 'task'
  dur?: number
  /** From a timeless chip: a tap opens the form, only a real drag moves. */
  chip?: boolean
  aktif: boolean
}
const seret = ref<Seret | null>(null)
let tahanTimer: ReturnType<typeof setTimeout> | null = null
let gerakAwal: { x: number, y: number } | null = null
/** When a real drag just ended, the browser still fires click — ignore it. */
let lepasAktifAt = 0

function klikTanpaJam(t: BdTask) {
  if (Date.now() - lepasAktifAt < 350) return
  emit('buka-task', t)
}

function snap(m: number): number {
  return Math.max(menitMin.value, Math.min(menitMaks.value, Math.round(m / SNAP) * SNAP))
}

function menitDariTitik(clientX: number, clientY: number, hariIx: number): number | null {
  const el = document.querySelector(`[data-vgkol="${hariIx}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (clientX < r.left - 8 || clientX > r.right + 8) return null
  return snap(menitMin.value + ((clientY - r.top) / HH) * 60)
}

function hariDariTitik(clientX: number, clientY: number): number {
  const el = document.elementFromPoint(clientX, clientY)?.closest?.('[data-vgkol]')
  const ix = el ? Number((el as HTMLElement).dataset.vgkol) : NaN
  return Number.isInteger(ix) && ix >= 0 && ix < props.hari.length ? ix : (seret.value?.hariKini ?? seret.value?.hariIx ?? 0)
}

function mulaiTunggu(x: number, y: number, sentuh: boolean) {
  gerakAwal = { x, y }
  if (tahanTimer) clearTimeout(tahanTimer)
  tahanTimer = null
  if (sentuh && seret.value && !seret.value.aktif) {
    // A held finger starts the drag; a scrolling finger cancels it below.
    tahanTimer = setTimeout(() => {
      if (seret.value) {
        seret.value.aktif = true
        tahanTimer = null
      }
    }, 450)
  }
}

const klikKanan = (e: PointerEvent) => e.pointerType === 'mouse' && e.button !== 0

/** Empty slot pressed: a vertical drag draws the new agenda's span. */
function tekanKolom(e: PointerEvent, ix: number) {
  if (seret.value || klikKanan(e)) return
  if ((e.target as HTMLElement).closest('.blk, [data-tanpajam], .vg-tambah')) return
  const m = menitDariTitik(e.clientX, e.clientY, ix)
  if (m === null) return
  seret.value = { kind: 'buat', boleh: true, hariIx: ix, asalMin: m, minKini: m, hariKini: ix, aktif: e.pointerType === 'mouse' }
  mulaiTunggu(e.clientX, e.clientY, e.pointerType !== 'mouse')
}

/** A timed block pressed: dragging moves it (time and day). */
function tekanBlok(e: PointerEvent, b: Blok, ix: number) {
  e.stopPropagation()
  if (seret.value || klikKanan(e)) return
  const m = menitDariTitik(e.clientX, e.clientY, ix)
  seret.value = {
    kind: 'pindah', boleh: b.boleh, hariIx: ix, asalMin: m ?? b.s, minKini: m ?? b.s, hariKini: ix,
    ref: b.ref, jenis: b.jenis, dur: b.en - b.s, aktif: e.pointerType === 'mouse',
  }
  mulaiTunggu(e.clientX, e.clientY, e.pointerType !== 'mouse')
}

/** The block's bottom edge: dragging changes only the end. */
function tekanTepi(e: PointerEvent, b: Blok, ix: number) {
  e.stopPropagation()
  if (seret.value || klikKanan(e)) return
  seret.value = {
    kind: 'tepi', boleh: b.boleh, hariIx: ix, asalMin: b.en, minKini: b.en, hariKini: ix,
    ref: b.ref, jenis: b.jenis, dur: b.en - b.s, aktif: e.pointerType === 'mouse',
  }
  mulaiTunggu(e.clientX, e.clientY, e.pointerType !== 'mouse')
}

/** A timeless task chip: dragging it onto the grid gives it a time. */
function tekanTanpaJam(e: PointerEvent, t: BdTask, ix: number) {
  e.stopPropagation()
  if (seret.value || klikKanan(e)) return
  seret.value = {
    kind: 'pindah', boleh: true, hariIx: ix, asalMin: menitMin.value, minKini: menitMin.value, hariKini: ix,
    ref: t, jenis: 'task', dur: 60, chip: true, aktif: e.pointerType === 'mouse',
  }
  mulaiTunggu(e.clientX, e.clientY, e.pointerType !== 'mouse')
}

function batalTahan() {
  if (tahanTimer) {
    clearTimeout(tahanTimer)
    tahanTimer = null
  }
}

function gerak(e: PointerEvent) {
  const s = seret.value
  if (!s) return
  if (!s.aktif) {
    // Mouse: a small move starts the drag. Touch: the hold timer owns it —
    // a scrolling finger cancels instead.
    if (e.pointerType === 'mouse') {
      if (gerakAwal && Math.hypot(e.clientX - gerakAwal.x, e.clientY - gerakAwal.y) > 6) s.aktif = true
      else return
    }
    else if (gerakAwal && Math.hypot(e.clientX - gerakAwal.x, e.clientY - gerakAwal.y) > 10) {
      batalTahan()
      seret.value = null
      gerakAwal = null
      return
    }
    else return
  }
  e.preventDefault()
  if (s.kind === 'buat') {
    const m = menitDariTitik(e.clientX, e.clientY, s.hariIx)
    if (m !== null) s.minKini = m
  }
  else {
    s.hariKini = hariDariTitik(e.clientX, e.clientY)
    const m = menitDariTitik(e.clientX, e.clientY, s.hariKini)
    if (m !== null) s.minKini = m
  }
}

async function lepas() {
  batalTahan()
  const s = seret.value
  seret.value = null
  gerakAwal = null
  if (!s) return
  if (s.aktif) lepasAktifAt = Date.now()
  if (!s.aktif) {
    // A tap without moving: open the row — except a timeless chip, whose own
    // click opens the form (emitting twice would reopen a closed sheet).
    if (s.kind === 'pindah' && s.ref && !s.chip) {
      if (s.jenis === 'agenda') emit('buka-agenda', s.ref as BdAgenda)
      else emit('buka-task', s.ref as BdTask)
    }
    return
  }
  if (s.kind === 'buat') {
    const a = Math.min(s.asalMin, s.minKini)
    const b = Math.max(s.asalMin, s.minKini)
    if (b - a >= SNAP) {
      emit('buat-agenda', { date: props.hari[s.hariIx]!, start: menitKeJam(a), end: menitKeJam(b) })
    }
    return
  }
  if (!s.boleh || !s.ref) return
  if (s.kind === 'pindah' && s.jenis === 'agenda') {
    const e = s.ref as BdAgenda
    const baru = { date: props.hari[s.hariKini]!, start: menitKeJam(s.minKini), end: menitKeJam(s.minKini + (s.dur || 60)) }
    if (!jamAgendaBerubah(e, baru)) return
    const now = Date.now()
    const undang = { ...(e.undang || {}) }
    const resp: Record<string, RsvpNilai> = {}
    for (const p of e.peserta || []) {
      if (p in undang) {
        undang[p] = { at: now, ubah: 1 }
      }
    }
    const ok = await bdTulisDiam(() => tambalBd<BdAgenda>(
      'agenda', e.id,
      { date: baru.date, start: baru.start, end: baru.end, resp, undang },
      versiBaris(e),
    ))
    if (ok) toast.add({ title: 'Jadwal berubah — peserta diminta menjawab ulang', color: 'success' })
  }
  else if (s.kind === 'pindah' && s.jenis === 'task') {
    const t = s.ref as BdTask
    const jam = menitKeJam(s.minKini)
    const date = props.hari[s.hariKini]!
    if (t.deadline === date && t.jam === jam) return
    await bdTulisDiam(() => tambalBd<BdTask>('tasks', t.id, { deadline: date, jam }, versiBaris(t)))
  }
  else if (s.kind === 'tepi' && s.jenis === 'agenda') {
    const e = s.ref as BdAgenda
    const asal = menitJam(e.start) ?? 0
    const end = menitKeJam(Math.max(s.minKini, asal + SNAP))
    if ((e.end || '') === end) return
    const now = Date.now()
    const undang = { ...(e.undang || {}) }
    for (const p of e.peserta || []) {
      if (p in undang) undang[p] = { at: now, ubah: 1 }
    }
    const ok = await bdTulisDiam(() => tambalBd<BdAgenda>(
      'agenda', e.id,
      { date: e.date, start: e.start || '', end, resp: {}, undang },
      versiBaris(e),
    ))
    if (ok) toast.add({ title: 'Jam selesai berubah — peserta diminta menjawab ulang', color: 'success' })
  }
}

onMounted(() => {
  window.addEventListener('pointermove', gerak, { passive: false })
  window.addEventListener('pointerup', lepas)
  window.addEventListener('pointercancel', lepas)
  // While a drag runs, the page must not scroll under the finger.
  document.addEventListener('touchmove', tahanGulir, { passive: false })
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', gerak)
  window.removeEventListener('pointerup', lepas)
  window.removeEventListener('pointercancel', lepas)
  document.removeEventListener('touchmove', tahanGulir)
  batalTahan()
})

function tahanGulir(e: TouchEvent) {
  if (seret.value?.aktif) e.preventDefault()
}

/** Preview style for a block being moved or resized. */
const gayaPratinjau = computed<Record<string, string> | null>(() => {
  const s = seret.value
  // A block I may not move shows no preview: the drag dies on release.
  if (!s?.aktif || s.kind === 'buat' || !s.ref || !s.boleh) return null
  if (s.kind === 'pindah') {
    return {
      top: `${((s.minKini - menitMin.value) / 60) * HH}px`,
      height: `${Math.max(20, ((s.dur || 60) / 60) * HH)}px`,
    }
  }
  const awal = s.jenis === 'agenda' ? (menitJam((s.ref as BdAgenda).start) ?? menitMin.value) : menitMin.value
  const akhir = Math.max(s.minKini, awal + SNAP)
  return {
    top: `${((awal - menitMin.value) / 60) * HH}px`,
    height: `${Math.max(20, ((akhir - awal) / 60) * HH)}px`,
  }
})

const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
function namaHari(iso: string) {
  return HARI_PENDEK[(new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay() + 6) % 7] || ''
}
const hariIni = todayISO()
</script>

<template>
  <div class="overflow-x-auto rounded-panel border border-default bg-default">
    <!-- header -->
    <div
      class="grid min-w-max border-b border-default bg-default"
      :style="{ gridTemplateColumns: `54px repeat(${hari.length}, minmax(${hari.length > 1 ? 150 : 260}px, 1fr))` }"
    >
      <div />
      <div
        v-for="d in hari"
        :key="d"
        class="flex items-center justify-center gap-1.5 border-l border-default px-2 py-3 text-center first-of-type:border-l-0"
        :class="d === hariIni ? 'text-gold-deep' : 'text-muted'"
      >
        <span class="text-sm font-semibold">{{ namaHari(d) }}</span>
        <span
          class="num font-display text-lg font-bold leading-none"
          :class="d === hariIni ? 'rounded-full bg-primary px-2 py-1 text-white' : 'text-highlighted'"
        >{{ Number(d.slice(8, 10)) }}</span>
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Tambah agenda ${d}`"
          class="vg-tambah"
          @click="emit('buat-agenda', { date: d })"
        />
      </div>
    </div>
    <!-- timeless strip -->
    <div
      class="grid min-w-max border-b border-default bg-muted/50"
      :style="{ gridTemplateColumns: `54px repeat(${hari.length}, minmax(${hari.length > 1 ? 150 : 260}px, 1fr))` }"
    >
      <div class="px-1.5 py-2 text-right text-[10px] text-dimmed">
        tanpa jam
      </div>
      <!-- One chip style for every timeless item: white, a coloured left edge. -->
      <div
        v-for="(d, ix) in hari"
        :key="d"
        class="flex min-w-0 flex-col gap-1 border-l border-default px-1.5 py-1.5"
        data-tanpajam
      >
        <button
          v-for="t in tanpaJam[d]!.task"
          :key="t.id"
          type="button"
          class="block w-full cursor-grab truncate rounded-md border border-default border-l-[3px] border-l-error bg-default px-2 py-1 text-left text-[11px] font-medium text-highlighted shadow-xs hover:border-error/50"
          :title="`Deadline — seret ke grid untuk memberi jam — ${t.name}`"
          @pointerdown="tekanTanpaJam($event, t, ix)"
          @click="klikTanpaJam(t)"
        >
          ◆ {{ t.name }}
        </button>
        <button
          v-for="e in tanpaJam[d]!.ag"
          :key="e.id"
          type="button"
          class="block w-full truncate rounded-md border border-default border-l-[3px] border-l-yellow-deep bg-default px-2 py-1 text-left text-[11px] font-medium text-highlighted shadow-xs hover:border-accented"
          :title="`${e.type || 'Agenda'} — ${e.title}`"
          @click="emit('buka-agenda', e)"
        >
          {{ e.title }}
        </button>
        <span
          v-for="(x, i) in luarHari[d] || []"
          :key="`l${i}`"
          class="block w-full truncate rounded-md border border-default border-l-[3px] bg-default px-2 py-1 text-[11px] text-default shadow-xs"
          :class="KELAS_TONE[x.tone]"
          :title="x.title"
        >{{ x.title }}</span>
      </div>
    </div>
    <!-- hour columns -->
    <div
      class="grid min-w-max"
      :style="{ gridTemplateColumns: `54px repeat(${hari.length}, minmax(${hari.length > 1 ? 150 : 260}px, 1fr))` }"
    >
      <div>
        <div
          v-for="h in datar.h1 - datar.h0"
          :key="h"
          class="pr-1.5 text-right font-mono text-[10px] text-dimmed"
          :style="{ height: `${HH}px`, transform: 'translateY(-6px)' }"
        >
          {{ String(datar.h0 + h - 1).padStart(2, '0') }}:00
        </div>
      </div>
      <div
        v-for="(d, ix) in hari"
        :key="d"
        :data-vgkol="ix"
        class="relative border-l border-default"
        :class="seret?.aktif ? 'cursor-crosshair select-none' : ''"
        :style="{ height: `${(datar.h1 - datar.h0) * HH}px` }"
        @pointerdown="tekanKolom($event, ix)"
      >
        <div
          v-for="h in datar.h1 - datar.h0"
          :key="h"
          class="pointer-events-none absolute left-0 right-0 border-t border-default"
          :style="{ top: `${(h - 1) * HH}px` }"
        />
        <div
          v-if="d === hariIni && menitMin <= (new Date().getHours() * 60 + new Date().getMinutes()) && (new Date().getHours() * 60 + new Date().getMinutes()) <= menitMaks"
          class="pointer-events-none absolute left-0 right-0 z-10 h-0.5 bg-error"
          :style="{ top: `${((new Date().getHours() * 60 + new Date().getMinutes() - menitMin) / 60) * HH}px` }"
        />
        <div
          v-for="b in (blokHari[d] || [])"
          :key="b.key"
          class="blk absolute overflow-hidden rounded-md border border-default border-l-4 bg-default px-1.5 py-0.5 text-left shadow-sm hover:z-10 hover:shadow"
          :class="[KELAS_TONE[b.tone], b.boleh ? 'cursor-grab' : 'cursor-pointer', b.pending ? 'border-dashed bg-warning/10' : '']"
          :style="gayaBlok(b)"
          :title="`${b.sub} — ${b.judul}${b.boleh ? ' (seret untuk pindah, tepi bawah untuk ubah selesai)' : ''}`"
          @pointerdown="tekanBlok($event, b, ix)"
        >
          <p class="truncate font-mono text-[10px] text-muted">
            {{ b.sub }}
          </p>
          <p
            class="truncate text-[11px] font-semibold text-highlighted"
            :class="b.tolak ? 'line-through' : ''"
          >
            {{ b.judul }}
          </p>
          <span
            v-if="b.boleh && b.jenis === 'agenda'"
            class="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize"
            title="Seret untuk mengubah jam selesai"
            @pointerdown="tekanTepi($event, b, ix)"
          />
        </div>
        <!-- create ghost -->
        <div
          v-if="seret?.aktif && seret.kind === 'buat' && seret.hariIx === ix"
          class="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-md border border-dashed border-yellow-deep bg-yellow-light/70"
          :style="{ top: `${((Math.min(seret.asalMin, seret.minKini) - menitMin) / 60) * HH}px`, height: `${Math.max(20, ((Math.abs(seret.minKini - seret.asalMin)) / 60) * HH)}px` }"
        />
        <!-- move / resize preview -->
        <div
          v-if="gayaPratinjau && seret && seret.hariKini === ix"
          class="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-md border border-dashed border-ink-900 bg-muted/80 px-1.5 py-0.5"
          :style="gayaPratinjau"
        />
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-default px-3 py-2.5 text-xs text-muted">
      <span>Seret slot kosong untuk membuat agenda berjam · seret blok untuk pindah · seret tepi bawah untuk ubah selesai (snap 15 menit).</span>
      <span>Hanya penyelenggara, admin, atau agenda tim yang bisa menggeser agenda — jadwal bergeser = peserta menjawab ulang.</span>
    </div>
  </div>
</template>
