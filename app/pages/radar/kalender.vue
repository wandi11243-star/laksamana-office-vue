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
import { BULAN, hariIni } from '~/utils/format'

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
const { data: board, error, refresh } = useRadarBoard('radar-cal-board', dari, sampai)

const agenda = computed(() => board.value?.agenda ?? [])
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
function paxSel(iso: string) {
  const ags = agendaTgl(agenda.value, iso)
  const m = fCal.value.mkt ? paxOf(ags.filter(a => a.sumber === 'mkt')) : 0
  const e = fCal.value.evt ? paxOf(ags.filter(a => a.sumber === 'evt')) : 0
  const r = fCal.value.rsv ? paxRes(resTgl(res.value, iso)) : 0
  const v = fCal.value.vip ? paxOf(ags.filter(a => a.sumber === 'vip')) : 0
  const rinci = [m && `${m} mkt`, e && `${e} evt`, r && `${r} rsv`, v && `${v} vip*`].filter(Boolean) as string[]
  return { total: m + e + r, rinci }
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
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan sebelumnya"
            @click="nav(-1)"
          />
          <span class="min-w-40 text-center font-display text-lg font-bold">{{ BULAN[cur.m] }} {{ cur.y }}</span>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan berikutnya"
            @click="nav(1)"
          />
          <UButton
            label="Hari ini"
            color="neutral"
            variant="outline"
            size="sm"
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
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
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
    <p
      v-if="semuaMati"
      class="mb-4 rounded-field border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
    >
      Semua sumber sedang dimatikan, jadi kalendernya kosong bukan karena tidak ada jadwal.
    </p>

    <AppStatGrid>
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

    <div class="overflow-x-auto rounded-panel border border-default bg-default shadow-panel">
      <div class="grid min-w-[720px] grid-cols-7">
        <div
          v-for="d in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']"
          :key="d"
          class="border-b border-default bg-muted px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
        >
          {{ d }}
        </div>
        <div
          v-for="c in sel"
          :key="c.iso"
          class="min-h-28 border-b border-r border-default p-1.5 [&:nth-child(7n)]:border-r-0"
          :class="[c.luar ? 'bg-muted/40 text-muted' : '', c.iso === hari ? 'ring-2 ring-inset ring-yellow-deep' : '']"
        >
          <div
            class="mb-1 text-xs font-bold num"
            :class="c.iso === hari ? 'text-ink-900' : ''"
          >
            {{ c.n }}
          </div>
          <button
            v-for="a in agSel(c.iso).slice(0, 3)"
            :key="`${a.sumber}-${a.id}`"
            type="button"
            class="mb-0.5 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold"
            :class="KELAS_EV[a.sumber]"
            :title="`${a.judul} — ${SUMBER_PENDEK[a.sumber]}${a.pax ? ` · ${a.pax} pax` : ''}`"
            @click="bukaAgenda(a)"
          >
            {{ a.judul }}
          </button>
          <p
            v-if="agSel(c.iso).length > 3"
            class="text-[11px] text-muted"
          >
            +{{ agSel(c.iso).length - 3 }} lagi
          </p>
          <NuxtLink
            v-if="fCal.rsv && resTgl(res, c.iso).length"
            :to="{ path: '/radar/reservasi', query: { tgl: c.iso } }"
            class="block text-[11px] text-info hover:underline"
          >
            {{ resTgl(res, c.iso).length }} rsv
          </NuxtLink>
          <p
            v-if="paxSel(c.iso).total"
            class="mt-1 text-[11px] font-semibold text-highlighted num"
            :title="`Pax event dan pax reservasi meja adalah rombongan berbeda. ${paxSel(c.iso).rinci.join(' + ')}`"
          >
            Total {{ paxSel(c.iso).total }} pax
            <span
              v-if="paxSel(c.iso).rinci.length > 1"
              class="block font-normal text-muted"
            >{{ paxSel(c.iso).rinci.join(' · ') }}</span>
          </p>
        </div>
      </div>
    </div>
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
