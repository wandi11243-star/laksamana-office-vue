<!--
  Radar › Kalender Terpadu (deploy/radar vKalender).

  Three modules, one schedule. The source chips are the filter AND the legend
  (their colour is the source colour), so there is no second row to match by
  eye. All four are on by default — the calendar exists to show them together.

  The month summary sits ABOVE the grid: in a full month the grid is a screen
  tall, and "total pax this month" is the number people look for first.

  A cell's total adds event pax and table-booking pax. They are different
  crowds; the sum answers only "roughly how many people are in the building
  that night", and the per-source split is written under it. VIP pax is shown
  separately (marked *) and never added: a VIP booking also locks tables in
  Reservasi, so its guests could be counted twice.
-->
<script setup lang="ts">
import type { RadarAgenda, RadarPilihan, SumberAgenda } from '~/composables/useRadar'
import { SUMBER_PENDEK, agendaTgl, paxOf, paxRes, resAktif, resTgl } from '~/utils/radar'
import { BULAN, fTgl, hariIni } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const hari = hariIni()
const cur = useState('radar-cal', () => ({ y: Number(hari.slice(0, 4)), m: Number(hari.slice(5, 7)) - 1 }))
const fCal = useState('radar-cal-f', () => ({ mkt: true, evt: true, rsv: true, vip: true }))

const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// The grid spans 6 weeks from the Sunday before the 1st; fetch exactly that.
const sel = computed(() => {
  const first = new Date(cur.value.y, cur.value.m, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { iso: isoOf(d), n: d.getDate(), luar: d.getMonth() !== cur.value.m }
  })
})
const dari = computed(() => sel.value[0]!.iso)
const sampai = computed(() => sel.value[41]!.iso)
const { data: board, status, error, refresh } = useRadarBoard('radar-cal-board', dari, sampai)

const agenda = computed(() => board.value?.agenda ?? [])
// First-load skeleton for the stat cards: while the board is absent the
// grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !board.value && (status.value === 'pending' || status.value === 'idle'))
const res = computed(() => board.value?.reservations ?? [])

const nav = (n: number) => {
  const d = new Date(cur.value.y, cur.value.m + n, 1)
  cur.value = { y: d.getFullYear(), m: d.getMonth() }
}
const sekarang = () => {
  cur.value = { y: Number(hari.slice(0, 4)), m: Number(hari.slice(5, 7)) - 1 }
}

const blnIso = computed(() => `${cur.value.y}-${pad(cur.value.m + 1)}`)
const agBln = computed(() => agenda.value.filter(a => a.tgl.startsWith(blnIso.value)))
const rsBln = computed(() => resAktif(res.value).filter(r => r.date.startsWith(blnIso.value)))
const paxBln = (s: SumberAgenda) => paxOf(agBln.value.filter(a => a.sumber === s))
const nBln = (s: SumberAgenda) => agBln.value.filter(a => a.sumber === s).length
const dobel = computed(() => {
  const n: Record<string, number> = {}
  for (const a of agBln.value) n[a.tgl] = (n[a.tgl] || 0) + 1
  return Object.values(n).filter(v => v > 1).length
})

// Mapped through the object, never a two-way ternary: that sends every source
// that is not 'mkt' to the Event filter, so unticking Event hides VIP too.
const agSel = (iso: string) => agendaTgl(agenda.value, iso).filter(a => fCal.value[a.sumber] !== false)
const hariBerisi = computed(() => sel.value
  .map(c => ({ ...c, agenda: agSel(c.iso), reservasi: fCal.value.rsv ? resTgl(res.value, c.iso) : [] }))
  .filter(c => c.agenda.length || c.reservasi.length || c.iso === hari))
const adaAgendaDiDaftar = computed(() => hariBerisi.value.some(c => c.agenda.length || c.reservasi.length))
function paxSel(iso: string) {
  const ags = agendaTgl(agenda.value, iso)
  const m = fCal.value.mkt ? paxOf(ags.filter(a => a.sumber === 'mkt')) : 0
  const e = fCal.value.evt ? paxOf(ags.filter(a => a.sumber === 'evt')) : 0
  const r = fCal.value.rsv ? paxRes(resTgl(res.value, iso)) : 0
  const v = fCal.value.vip ? paxOf(ags.filter(a => a.sumber === 'vip')) : 0
  const rinci = [m && `${m} mkt`, e && `${e} evt`, r && `${r} rsv`, v && `${v} vip*`].filter(Boolean) as string[]
  return { total: m + e + r, vip: v, rinci }
}

const CHIP: { k: keyof typeof fCal.value, label: string, warna: string }[] = [
  { k: 'mkt', label: 'Marketing', warna: 'bg-brand-yellow' },
  { k: 'evt', label: 'Event', warna: 'bg-lilac-light' },
  { k: 'rsv', label: 'Reservasi', warna: 'bg-info' },
  { k: 'vip', label: 'Reservasi VIP', warna: 'bg-success' },
]
const KELAS_EV: Record<SumberAgenda, string> = {
  mkt: 'bg-yellow-light text-yellow-dark',
  evt: 'bg-lilac-light text-ink-900',
  vip: 'bg-teal-light text-moss-dark',
}
// Left stripe of an event pill, in the source colour (same family as CHIP:
// evt uses vip, the dark pair of its lilac tint, so the bar stays visible
// on the tint). Token classes only, no hex.
const GARIS_EV: Record<SumberAgenda, string> = {
  mkt: 'bg-brand-yellow',
  evt: 'bg-vip',
  vip: 'bg-success',
}
const semuaMati = computed(() => !fCal.value.mkt && !fCal.value.evt && !fCal.value.rsv && !fCal.value.vip)

const pilih = ref<RadarPilihan>(null)
const buka = ref(false)
const bukaAgenda = (a: RadarAgenda) => {
  pilih.value = { jenis: 'ag', a }
  buka.value = true
}
useSegarSenyap(refresh, () => buka.value)
</script>

<template>
  <AppPage
    title="Kalender Terpadu"
    description="Tiga modul, satu jadwal: Marketing, Event, Reservasi, dan Reservasi VIP."
  >
    <RadarPitaGagal :sumber="board?.sumber" />
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Kalender tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            class="min-h-11 min-w-11 justify-center lg:min-h-9 lg:min-w-9"
            aria-label="Bulan sebelumnya"
            @click="nav(-1)"
          />
          <span class="min-w-40 text-center font-display text-lg font-bold">{{ BULAN[cur.m] }} {{ cur.y }}</span>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            class="min-h-11 min-w-11 justify-center lg:min-h-9 lg:min-w-9"
            aria-label="Bulan berikutnya"
            @click="nav(1)"
          />
          <UButton
            label="Hari ini"
            color="neutral"
            variant="outline"
            class="min-h-11 lg:min-h-9"
            @click="sekarang"
          />
        </div>
        <div class="flex-1" />
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Tampilkan</span>
          <button
            v-for="c in CHIP"
            :key="c.k"
            type="button"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:border-gold lg:min-h-8"
            :class="fCal[c.k] ? 'border-default bg-default text-highlighted' : 'border-dashed border-default text-muted line-through'"
            :aria-pressed="fCal[c.k]"
            @click="fCal = { ...fCal, [c.k]: !fCal[c.k] }"
          >
            <i
              class="size-2.5 rounded-full"
              :class="c.warna"
            />{{ c.label }}
          </button>
        </div>
      </div>
    </AppPanel>
    <div
      v-if="status === 'pending' && !board"
      class="mb-4 space-y-2"
      role="status"
    >
      <!-- Loading rows mirror the calendar below. -->
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-16 w-full rounded-xl"
      />
      <p class="pt-1 text-sm text-muted">
        Memuat kalender…
      </p>
    </div>
    <p
      v-if="semuaMati"
      class="mb-4 rounded-field border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
    >
      Semua sumber sedang dimatikan, jadi kalendernya kosong bukan karena tidak ada jadwal.
    </p>

    <AppStatGrid
      :loading="statMemuat"
      :count="4"
    >
      <AppStat
        :label="`Total pax ${BULAN[cur.m]}`"
        icon="i-lucide-users"
        tone="info"
        :value="paxBln('mkt') + paxBln('evt') + paxRes(rsBln)"
        :sub="`${paxBln('mkt')} mkt · ${paxBln('evt')} evt · ${paxRes(rsBln)} rsv`"
      />
      <AppStat
        label="Agenda bulan ini"
        icon="i-lucide-calendar-days"
        :value="agBln.length"
        :sub="`${nBln('mkt')} Marketing · ${nBln('evt')} Event · ${nBln('vip')} VIP`"
      />
      <AppStat
        label="Reservasi bulan ini"
        icon="i-lucide-book-open"
        tone="info"
        :value="rsBln.length"
        :sub="`${paxRes(rsBln)} pax meja`"
      />
      <AppStat
        label="Hari dobel agenda"
        icon="i-lucide-triangle-alert"
        :tone="dobel ? 'warning' : 'gold'"
        :value="dobel"
        sub="perlu dicek bentroknya"
      />
    </AppStatGrid>

    <div class="hidden overflow-hidden rounded-panel border border-default bg-default shadow-panel lg:block">
      <div class="grid grid-cols-7">
        <div
          v-for="d in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']"
          :key="d"
          class="border-b border-default bg-muted px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
        >
          {{ d }}
        </div>
      </div>
      <!-- auto-rows-fr: every week row takes the height of the fullest one, so
           all date cells are the same size whether they hold agenda or not. -->
      <div class="grid auto-rows-fr grid-cols-7">
        <div
          v-for="c in sel"
          :key="c.iso"
          class="flex min-h-36 flex-col border-b border-r border-default p-1.5 transition-colors hover:bg-gold-soft/40 [&:nth-child(7n)]:border-r-0"
          :class="[c.luar ? 'bg-muted/40 text-muted' : '', c.iso === hari ? 'bg-gold-soft/60 ring-2 ring-inset ring-gold' : '']"
        >
          <div
            class="mb-1 text-xs font-bold num"
          >
            <span :class="c.iso === hari ? 'tgl-bulat' : ''">{{ c.n }}</span>
          </div>
          <button
            v-for="a in agSel(c.iso).slice(0, 3)"
            :key="`${a.sumber}-${a.id}`"
            type="button"
            class="relative mb-1 block w-full overflow-hidden rounded-[4px] py-1 pl-2.5 pr-1.5 text-left text-[11px] font-semibold leading-tight transition hover:brightness-95 hover:ring-1 hover:ring-gold/50"
            :class="[KELAS_EV[a.sumber], c.luar ? 'opacity-60' : '']"
            :title="`${a.judul} — ${SUMBER_PENDEK[a.sumber]}${a.pax ? ` · ${a.pax} pax` : ''}`"
            @click="bukaAgenda(a)"
          >
            <i
              class="absolute inset-y-0 left-0 w-1"
              :class="GARIS_EV[a.sumber]"
              aria-hidden="true"
            />
            <span class="block truncate">{{ a.judul }}</span>
          </button>
          <p
            v-if="agSel(c.iso).length > 3"
            class="px-1 text-[11px] text-muted"
          >
            +{{ agSel(c.iso).length - 3 }} lagi
          </p>
          <NuxtLink
            v-if="fCal.rsv && resTgl(res, c.iso).length"
            :to="{ path: '/radar/reservasi', query: { tgl: c.iso } }"
            class="block px-1 text-[11px] text-info hover:underline"
            :class="c.luar ? 'opacity-60' : ''"
          >
            {{ resTgl(res, c.iso).length }} rsv
          </NuxtLink>
          <!-- Only the total sits in the cell; the breakdown (and VIP pax kept
               out of it) lives in the tooltip so cells stay one size. -->
          <p
            v-if="paxSel(c.iso).total"
            class="mt-auto border-t border-default px-1 pt-1 text-[11px] font-semibold text-highlighted num"
            :class="c.luar ? 'opacity-60' : ''"
            :title="`Pax event dan pax reservasi meja adalah rombongan berbeda. ${paxSel(c.iso).rinci.join(' + ')}${paxSel(c.iso).vip ? ` · ${paxSel(c.iso).vip} pax VIP di luar total` : ''}`"
          >
            Total {{ paxSel(c.iso).total }} pax
          </p>
        </div>
      </div>
    </div>
    <AppList
      title="Agenda bulan ini"
      class="lg:hidden"
    >
      <div
        v-for="c in hariBerisi"
        :key="c.iso"
        class="border-b border-default px-4 py-3 last:border-b-0"
        :class="c.iso === hari ? 'bg-primary-50' : ''"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0 font-semibold text-highlighted">
            {{ fTgl(c.iso) }}<span
              v-if="c.iso === hari"
              class="ml-1 text-primary-700"
            >· Hari ini</span>
          </div>
          <span
            v-if="paxSel(c.iso).total || paxSel(c.iso).vip"
            class="text-right text-xs font-semibold text-muted num"
          >
            {{ paxSel(c.iso).total ? `Total ${paxSel(c.iso).total} pax` : '' }}{{ paxSel(c.iso).total && paxSel(c.iso).vip ? ' · ' : '' }}{{ paxSel(c.iso).vip ? `${paxSel(c.iso).vip} VIP di luar total` : '' }}
          </span>
        </div>
        <div class="grid grid-cols-1 gap-1.5">
          <button
            v-for="a in c.agenda"
            :key="`${a.sumber}-${a.id}`"
            type="button"
            class="relative flex min-h-11 min-w-0 items-center gap-2 overflow-hidden rounded-md py-2 pl-4 pr-2.5 text-left text-sm"
            :class="KELAS_EV[a.sumber]"
            @click="bukaAgenda(a)"
          >
            <span
              class="absolute inset-y-0 left-0 w-1.5"
              :class="GARIS_EV[a.sumber]"
              aria-hidden="true"
            />
            <span class="shrink-0 text-xs text-muted">{{ SUMBER_PENDEK[a.sumber] }}</span>
            <span class="min-w-0 flex-1 truncate font-semibold">{{ a.judul }}</span>
            <span
              v-if="a.jam"
              class="shrink-0 text-xs text-muted num"
            >{{ a.jam }}</span>
          </button>
          <NuxtLink
            v-if="c.reservasi.length"
            :to="{ path: '/radar/reservasi', query: { tgl: c.iso } }"
            class="flex min-h-11 items-center gap-2 rounded-field border border-default bg-default px-2.5 py-2 text-sm text-info"
          >
            <UIcon
              name="i-lucide-book-open"
              class="size-4 shrink-0"
            />{{ c.reservasi.length }} reservasi · {{ paxRes(c.reservasi) }} pax
            <UIcon
              name="i-lucide-chevron-right"
              class="ml-auto size-4 shrink-0"
            />
          </NuxtLink>
        </div>
        <p
          v-if="paxSel(c.iso).rinci.length"
          class="mt-1.5 border-t border-default pt-1.5 text-[11px] text-muted num"
        >
          {{ paxSel(c.iso).rinci.join(' · ') }}<span v-if="paxSel(c.iso).vip"> · pax VIP (*) di luar total</span>
        </p>
      </div>
      <p
        v-if="status !== 'pending' && !error && board && !adaAgendaDiDaftar"
        class="px-4 py-3 text-sm text-muted"
      >
        Tidak ada agenda atau reservasi pada sumber yang dipilih.
      </p>
    </AppList>
    <p class="mt-2 text-xs text-muted">
      Total pax menjumlahkan pax event dan pax reservasi meja — rombongan berbeda, jadi angkanya hanya perkiraan isi gedung malam itu.
      Pax VIP (*) tidak ikut dijumlahkan karena tamunya juga mengunci meja di Reservasi.
    </p>

    <RadarDetailSheet
      v-model:open="buka"
      :pilih="pilih"
      :boleh-uang="board?.bolehUang"
    />
  </AppPage>
</template>
