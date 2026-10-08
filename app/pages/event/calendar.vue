<!--
  Event Calendar — the unified multi-source month grid
  (`event/index.html:10925-11060`).

  Sources: EMS events (purple) + talent schedules (red) + calendarExtra
  (holidays/birthdays) from this module, Marketing events (gold) via
  `GET /marketing/events?from&to` dropping `Lost`, Reservasi (teal) via
  `GET /reservasi/reservations?from&to` dropping cancelled/no-show. The two
  cross-module reads fail CLOSED: a warning ribbon + "Coba lagi", never a
  blank screen (`:10825`, real-time note in D.2). Their popups are read-only,
  with a link to open the Reservasi module.
-->
<script setup lang="ts">
import type { Acara, JadwalTalent } from '~/composables/useEvent'
import { useStateEvent } from '~/composables/useEvent'
import { paxAcara } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, hariIni, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['event'] })

const { data: state, status, refresh, error } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

type TipeCal = 'all' | 'Event' | 'Entertainment' | 'Reservation' | 'Marketing' | 'Holiday' | 'Birthday'
const tipe = ref<TipeCal>('all')
const PILIHAN_TIPE = [
  { value: 'all', label: 'Semua' },
  { value: 'Event', label: 'Event' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Reservation', label: 'Reservation' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Holiday', label: 'Holiday' },
  { value: 'Birthday', label: 'Birthday' },
] as { value: TipeCal, label: string }[]

const bulan = ref(hariIni().slice(0, 7))
const labelBulan = computed(() => tglPanjang(`${bulan.value}-01`).replace(/^\d+ /, ''))
function geserBulan(n: number) {
  const [y, m] = bulan.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + n, 1)
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const bulanDari = computed(() => `${bulan.value}-01`)
const bulanSampai = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  return `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
})

// --- cross-module sources (read-only, fail-closed) ---
interface MktEvent { id: string, title?: string, nama?: string, tanggal?: string, date?: string, status?: string, pax?: number }
interface RsvRow { id: string, name: string, date: string, time?: string, pax: number, status: string }

const mkt = ref<MktEvent[]>([])
const rsv = ref<RsvRow[]>([])
const mktGagal = ref(false)
const rsvGagal = ref(false)
const memuatSilang = ref(false)

async function muatSilang() {
  memuatSilang.value = true
  mktGagal.value = false
  rsvGagal.value = false
  const api = useApi()
  try {
    const r = await api<Envelope<MktEvent[]>>('/marketing/events', { query: { from: bulanDari.value, to: bulanSampai.value } })
    mkt.value = (r.data ?? []).filter(e => (e.status ?? '') !== 'Lost')
  }
  catch {
    mktGagal.value = true
  }
  try {
    const r = await api<Envelope<RsvRow[]>>('/reservasi/reservations', { query: { from: bulanDari.value, to: bulanSampai.value } })
    rsv.value = (r.data ?? []).filter(r => !['Cancelled', 'No-show'].includes(r.status))
  }
  catch {
    rsvGagal.value = true
  }
  memuatSilang.value = false
}
watch([bulanDari, bulanSampai], muatSilang, { immediate: true })

interface ItemCal { tgl: string, tipe: TipeCal, judul: string, sub?: string, acara?: Acara, jadwal?: JadwalTalent, mkt?: MktEvent, rsv?: RsvRow }

const semuaItem = computed<ItemCal[]>(() => {
  const keluar: ItemCal[] = []
  for (const e of s.value?.events ?? []) {
    const tgl = String(e.start_datetime ?? '').slice(0, 10)
    if (tgl >= bulanDari.value && tgl <= bulanSampai.value) {
      keluar.push({ tgl, tipe: 'Event', judul: e.title, sub: String(e.venue ?? ''), acara: e })
    }
  }
  for (const j of s.value?.schedules ?? []) {
    if (j.date >= bulanDari.value && j.date <= bulanSampai.value && j.status !== 'Cancelled') {
      const t = (s.value?.talents ?? []).find(t => t.id === j.talent_id)
      keluar.push({ tgl: j.date, tipe: 'Entertainment', judul: t?.name ?? 'Talent', sub: `${j.start_time ?? ''}–${j.end_time ?? ''}`, jadwal: j })
    }
  }
  for (const x of s.value?.calendarExtra ?? []) {
    if (x.date >= bulanDari.value && x.date <= bulanSampai.value) {
      keluar.push({ tgl: x.date, tipe: (x.type === 'Birthday' ? 'Birthday' : 'Holiday'), judul: x.title })
    }
  }
  for (const e of mkt.value) {
    const tgl = String(e.tanggal ?? e.date ?? '').slice(0, 10)
    if (tgl) keluar.push({ tgl, tipe: 'Marketing', judul: e.title ?? e.nama ?? 'Marketing', mkt: e })
  }
  for (const r of rsv.value) keluar.push({ tgl: r.date, tipe: 'Reservation', judul: r.name, sub: `${r.time ?? ''} · ${r.pax} pax`, rsv: r })
  return tipe.value === 'all' ? keluar : keluar.filter(i => i.tipe === tipe.value)
})

const perTanggal = computed(() => {
  const m = new Map<string, ItemCal[]>()
  for (const i of semuaItem.value) {
    const l = m.get(i.tgl) ?? []
    l.push(i)
    m.set(i.tgl, l)
  }
  return m
})

// "N pax bulan ini" ribbon (`:11047`)
const paxBulan = computed(() => {
  const kelas = s.value?.ticketClasses ?? []
  let ems = 0
  for (const e of s.value?.events ?? []) {
    const tgl = String(e.start_datetime ?? '').slice(0, 10)
    if (tgl >= bulanDari.value && tgl <= bulanSampai.value) ems += paxAcara(e, kelas)
  }
  const mktPax = mkt.value.reduce((a, e) => a + (Number(e.pax) || 0), 0)
  const rsvPax = rsv.value.reduce((a, r) => a + (Number(r.pax) || 0), 0)
  return { ems, mkt: mktPax, rsv: rsvPax, total: ems + mktPax + rsvPax }
})

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const selBulan = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const pertama = new Date(y!, m! - 1, 1)
  const mundur = (pertama.getDay() + 6) % 7
  const jumlah = new Date(y!, m!, 0).getDate()
  const sel: { tgl: string, num: number, dalam: boolean }[] = []
  const tambah = (t: Date, dalam: boolean) => {
    sel.push({
      tgl: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
      num: t.getDate(),
      dalam,
    })
  }
  for (let i = mundur; i > 0; i--) {
    const d = new Date(y!, m! - 1, 0)
    d.setDate(d.getDate() - i + 1)
    tambah(d, false)
  }
  for (let d = 1; d <= jumlah; d++) tambah(new Date(y!, m! - 1, d), true)
  const sisa = (7 - (sel.length % 7)) % 7
  for (let d = 1; d <= sisa; d++) tambah(new Date(y!, m!, d), false)
  return sel
})

const WARNA_TIPE: Record<TipeCal, string> = {
  all: 'bg-muted text-muted',
  Event: 'bg-vip/12 text-vip',
  Entertainment: 'bg-error/12 text-error',
  Reservation: 'bg-info/12 text-info',
  Marketing: 'bg-primary-100 text-primary-800',
  Holiday: 'bg-success/12 text-success',
  Birthday: 'bg-warning/12 text-warning',
}

const sheet = ref(false)
const itemAktif = ref<ItemCal | null>(null)
function bukaItem(i: ItemCal) {
  itemAktif.value = i
  sheet.value = true
}
</script>

<template>
  <AppPage
    title="Event calendar"
    description="Kalender terpadu multi-sumber"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="status === 'pending' || memuatSilang"
        @click="() => { refresh(); muatSilang() }"
      >
        Muat ulang
      </UButton>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="apiErrorMessage(error)"
      class="mb-4"
    />
    <UAlert
      v-if="mktGagal || rsvGagal"
      color="warning"
      variant="soft"
      title="Sumber lintas modul tidak terbaca"
      :description="`Kalender menampilkan data event saja.${mktGagal ? ' Marketing gagal dimuat.' : ''}${rsvGagal ? ' Reservasi gagal dimuat.' : ''}`"
      class="mb-4"
      :actions="[{ label: 'Coba lagi', onClick: () => muatSilang() }]"
    />

    <AppPanel class="mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevron-left"
          @click="geserBulan(-1)"
        />
        <b class="min-w-28 text-center text-highlighted">{{ labelBulan }}</b>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevron-right"
          @click="geserBulan(1)"
        />
        <UButton
          color="neutral"
          variant="outline"
          @click="bulan = hariIni().slice(0, 7)"
        >
          Hari ini
        </UButton>
        <USelect
          v-model="tipe"
          :items="PILIHAN_TIPE"
          class="w-44"
        />
        <span
          class="ms-auto rounded-full bg-info/12 px-3 py-1 text-xs font-semibold text-info num"
          :title="`EMS ${angka(paxBulan.ems)} · Marketing ${angka(paxBulan.mkt)} · Reservasi ${angka(paxBulan.rsv)}`"
        >
          {{ angka(paxBulan.total) }} pax bulan ini
        </span>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span
          v-for="t in (['Event', 'Entertainment', 'Marketing', 'Reservation'] as TipeCal[])"
          :key="t"
          class="rounded-full px-2 py-0.5 font-semibold"
          :class="WARNA_TIPE[t]"
        >
          {{ t }}
        </span>
      </div>
    </AppPanel>

    <AppPanel flush>
      <div class="grid grid-cols-7 border-b border-default">
        <div
          v-for="d in DOW"
          :key="d"
          class="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
        >
          {{ d }}
        </div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="sel in selBulan"
          :key="sel.tgl"
          class="min-h-16 border-b border-e border-default p-1 align-top last:border-e-0 sm:min-h-24 sm:p-1.5"
          :class="sel.dalam ? '' : 'bg-muted/50'"
        >
          <span
            class="text-xs font-semibold num"
            :class="[
              sel.tgl === hariIni() ? 'rounded-full bg-primary px-1.5 py-0.5 text-white' : 'text-muted',
              sel.dalam ? '' : 'opacity-50',
            ]"
          >{{ sel.num }}</span>
          <ul class="mt-1 space-y-0.5">
            <li
              v-for="(it, i) in (perTanggal.get(sel.tgl) ?? []).slice(0, 4)"
              :key="i"
            >
              <button
                type="button"
                class="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                :class="WARNA_TIPE[it.tipe]"
                @click="bukaItem(it)"
              >
                {{ it.judul }}
              </button>
            </li>
            <li
              v-if="(perTanggal.get(sel.tgl) ?? []).length > 4"
              class="px-1 text-[11px] text-muted num"
            >
              +{{ (perTanggal.get(sel.tgl) ?? []).length - 4 }} lagi
            </li>
          </ul>
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="itemAktif?.judul ?? 'Detail'"
    >
      <div
        v-if="itemAktif"
        class="space-y-2 text-sm"
      >
        <p class="text-muted">
          {{ tglPanjang(itemAktif.tgl) }} · {{ itemAktif.tipe }}
        </p>
        <p v-if="itemAktif.sub">
          {{ itemAktif.sub }}
        </p>
        <template v-if="itemAktif.acara">
          <p>Venue: {{ itemAktif.acara.venue || '—' }} · PIC: {{ itemAktif.acara.pic || '—' }}</p>
          <UButton
            :to="`/event/events/${itemAktif.acara.id}`"
            color="primary"
            @click="sheet = false"
          >
            Buka event
          </UButton>
        </template>
        <template v-else-if="itemAktif.rsv">
          <p class="text-muted">
            Reservasi — read-only di sini.
          </p>
          <UButton
            to="/reservasi/dashboard"
            color="neutral"
            variant="outline"
            @click="sheet = false"
          >
            Buka modul reservasi
          </UButton>
        </template>
        <p
          v-else
          class="text-muted"
        >
          {{ itemAktif.tipe === 'Marketing' ? 'Event marketing — read-only di sini.' : itemAktif.tipe === 'Entertainment' ? `Jam ${itemAktif.jadwal?.start_time ?? ''}–${itemAktif.jadwal?.end_time ?? ''}` : 'Hari libur / ulang tahun.' }}
        </p>
        <UButton
          v-if="itemAktif.jadwal"
          :to="`/event/schedule`"
          color="neutral"
          variant="outline"
          @click="sheet = false"
        >
          Buka jadwal talent
        </UButton>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
