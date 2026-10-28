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
import { fmtTglJamEms, tglWIB } from '~/utils/event-hitung'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, hariIni, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['event'] })

const { data: state, error } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

type TipeCal = 'all' | 'Event' | 'Entertainment' | 'Reservation' | 'Marketing' | 'Holiday' | 'Birthday'
const tipe = ref<TipeCal>('all')
const PILIHAN_TIPE = [
  { value: 'all', label: 'Semua tipe' },
  { value: 'Event', label: 'Event' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Reservation', label: 'Reservation' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Holiday', label: 'Holiday' },
  { value: 'Birthday', label: 'Birthday' },
] as { value: TipeCal, label: string }[]

const bulan = ref(hariIni().slice(0, 7))
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const labelBulan = computed(() => `${BULAN_PENDEK[Number(bulan.value.slice(5, 7)) - 1]} ${bulan.value.slice(0, 4)}`)
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
interface MktEvent { id: string, title?: string, nama?: string, tanggal?: string, date?: string, status?: string, pax?: number, client?: string, clientId?: string }
interface RsvRow { id: string, name: string, date: string, time?: string, pax: number, status: string, table?: string, vip?: boolean }

const mkt = ref<MktEvent[]>([])
const rsv = ref<RsvRow[]>([])
const mktGagal = ref(false)
const rsvGagal = ref(false)
const memuatSilang = ref(false)
let seqSilang = 0

async function muatSilang() {
  const n = ++seqSilang
  memuatSilang.value = true
  mktGagal.value = false
  rsvGagal.value = false
  const api = useApi()
  try {
    // One page is 100 rows by default — a whole month needs the max page.
    const r = await api<Envelope<MktEvent[]>>('/marketing/events', { query: { from: bulanDari.value, to: bulanSampai.value, perPage: 1000 } })
    if (n !== seqSilang) return
    mkt.value = (r.data ?? []).filter(e => (e.status ?? '') !== 'Lost')
  }
  catch {
    if (n !== seqSilang) return
    mktGagal.value = true
  }
  try {
    const r = await api<Envelope<RsvRow[]>>('/reservasi/reservations', { query: { from: bulanDari.value, to: bulanSampai.value } })
    if (n !== seqSilang) return
    // Cancelled/no-show come in several spellings — none of them will be seated.
    rsv.value = (r.data ?? []).filter(r => !['cancelled', 'no-show', 'noshow', 'batal'].includes(String(r.status ?? '').toLowerCase()))
  }
  catch {
    if (n !== seqSilang) return
    rsvGagal.value = true
  }
  if (n !== seqSilang) return
  memuatSilang.value = false
}
watch([bulanDari, bulanSampai], muatSilang, { immediate: true })

interface ItemCal { tgl: string, tipe: TipeCal, judul: string, sub?: string, acara?: Acara, jadwal?: JadwalTalent, mkt?: MktEvent, rsv?: RsvRow }

const semuaItem = computed<ItemCal[]>(() => {
  const keluar: ItemCal[] = []
  for (const e of s.value?.events ?? []) {
    const tgl = tglWIB(e.start_datetime)
    if (tgl >= bulanDari.value && tgl <= bulanSampai.value) {
      keluar.push({ tgl, tipe: 'Event', judul: e.title, sub: String(e.venue ?? ''), acara: e })
    }
  }
  // renderCalendar (:11185) draws every schedule, cancelled ones too — the popup shows the status
  for (const j of s.value?.schedules ?? []) {
    if (j.date >= bulanDari.value && j.date <= bulanSampai.value) {
      const t = (s.value?.talents ?? []).find(t => t.id === j.talent_id)
      keluar.push({ tgl: j.date, tipe: 'Entertainment', judul: t?.name ?? 'Talent', sub: `${j.start_time ?? ''}–${j.end_time ?? ''}`, jadwal: j })
    }
  }
  for (const x of s.value?.calendarExtra ?? []) {
    // A `Reservation` row here would double-count the real bookings read from
    // the Reservasi module — drop it on purpose.
    if (String(x.type ?? '').toLowerCase() === 'reservation') continue
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

/** paxEventEms (:10978): sold tickets when any sold, else the planned capacity. */
function paxEms(e: Acara) {
  const laku = (s.value?.ticketClasses ?? []).filter(c => c.event_id === e.id).reduce((a, c) => a + (Number(c.sold) || 0), 0)
  return laku ? { n: laku, dari: 'tiket terjual' } : { n: Number(e.capacity) || 0, dari: 'kapasitas rencana' }
}

// "N pax bulan ini" ribbon (`:11047`): follows the type filter, like the old total.
const paxBulan = computed(() => {
  let ems = 0
  for (const e of s.value?.events ?? []) {
    const tgl = tglWIB(e.start_datetime)
    if (tgl >= bulanDari.value && tgl <= bulanSampai.value) ems += paxEms(e).n
  }
  const mktPax = mkt.value.reduce((a, e) => a + (Number(e.pax) || 0), 0)
  const rsvPax = rsv.value.reduce((a, r) => a + (Number(r.pax) || 0), 0)
  const total = tipe.value === 'all'
    ? ems + mktPax + rsvPax
    : tipe.value === 'Event'
      ? ems
      : tipe.value === 'Marketing'
        ? mktPax
        : tipe.value === 'Reservation' ? rsvPax : 0
  return { ems, mkt: mktPax, rsv: rsvPax, total }
})

/** Non-booking rows share the 4-cut; bookings collapse into one summary row below them. */
const biasaHari = (tgl: string) => (perTanggal.value.get(tgl) ?? []).filter(i => i.tipe !== 'Reservation')
const rsvHari = (tgl: string) => (perTanggal.value.get(tgl) ?? [])
  .filter(i => i.tipe === 'Reservation')
  .sort((a, b) => String(a.rsv?.time ?? '').localeCompare(String(b.rsv?.time ?? '')))
const ringkasRsv = (tgl: string) => {
  const rows = rsvHari(tgl)
  return { n: rows.length, pax: rows.reduce((a, i) => a + (Number(i.rsv?.pax) || 0), 0) }
}
/** Legend counts, unfiltered by the type dropdown: schedules, marketing events, days holding reservations. */
// the old legend counts every schedule on record, not just this month's
const hitungJadwal = computed(() => (s.value?.schedules ?? []).length)
const hitungMkt = computed(() => mkt.value.length)
const hitungHariRsv = computed(() => new Set(rsv.value.map(r => r.date)).size)

// --- rich popups (`:11229-11285`, `:11047-11065`) ---
const kelas = computed(() => s.value?.ticketClasses ?? [])
const lunasSemua = computed(() => (s.value?.orders ?? []).filter(o => o.payment_status === 'Paid'))
const tiketEv = (id: string) => kelas.value.filter(c => c.event_id === id)
const lakuEv = (id: string) => tiketEv(id).reduce((a, c) => a + (Number(c.sold) || 0), 0)
const kuotaEv = (id: string) => tiketEv(id).reduce((a, c) => a + (Number(c.quota) || 0), 0)
const omzetEv = (id: string) => lunasSemua.value.filter(o => o.event_id === id).reduce((a, o) => a + (Number(o.total) || 0), 0)
const talentJadwal = (talentId?: string) => (s.value?.talents ?? []).find(t => t.id === talentId) ?? null
const waNo = (p?: string | null) => {
  let x = String(p ?? '').replace(/\D/g, '')
  if (x.startsWith('0')) x = `62${x.slice(1)}`
  return x
}

const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const selBulan = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const pertama = new Date(y!, m! - 1, 1)
  const mundur = pertama.getDay()
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
const paxItem = (it: ItemCal) => it.acara ? paxEms(it.acara).n : it.mkt ? Number(it.mkt.pax) || 0 : 0
function judulItem(it: ItemCal) {
  if (it.acara) {
    const p = paxEms(it.acara)
    return `${it.judul}${p.n ? ` — ${p.n} pax (${p.dari})` : ''}`
  }
  if (it.jadwal) return `${it.judul} — ${it.jadwal.start_time ?? ''} ${it.jadwal.performance_type ?? ''}`
  if (it.mkt) return `Acara Marketing: ${it.judul}${it.mkt.client ? ` — ${it.mkt.client}` : ''}${it.mkt.pax ? ` · ${it.mkt.pax} pax` : ''}`
  return it.judul
}
function bukaItem(i: ItemCal) {
  itemAktif.value = i
  sheet.value = true
}

/** One summary row per day opens that day's bookings (`rsvHariPopupEms`). */
const rsvTgl = ref<string | null>(null)
const rsvSheet = computed({
  get: () => rsvTgl.value !== null,
  set: (v: boolean) => {
    if (!v) rsvTgl.value = null
  },
})
function bukaHariRsv(tgl: string) {
  rsvTgl.value = tgl
}
</script>

<template>
  <EventGerbang lihat="calendar">
    <AppPage
      title="Event calendar"
      description="Kalender terpadu multi-sumber"
    >
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
            class="ms-auto text-sm font-bold text-primary-700 num"
            :title="`EMS ${angka(paxBulan.ems)} · Marketing ${angka(paxBulan.mkt)} · Reservasi ${angka(paxBulan.rsv)} pax`"
          >
            {{ angka(paxBulan.total) }} pax bulan ini
          </span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <span
            class="rounded-full px-2 py-0.5 font-semibold"
            :class="WARNA_TIPE['Event']"
          >
            Event EMS
          </span>
          <span
            class="rounded-full px-2 py-0.5 font-semibold"
            :class="WARNA_TIPE['Entertainment']"
          >
            Talent{{ hitungJadwal ? ` (${hitungJadwal})` : '' }}
          </span>
          <span
            class="rounded-full px-2 py-0.5 font-semibold"
            :class="WARNA_TIPE['Marketing']"
          >
            Marketing{{ hitungMkt ? ` (${hitungMkt})` : '' }}
          </span>
          <span
            class="rounded-full px-2 py-0.5 font-semibold"
            :class="WARNA_TIPE['Reservation']"
          >
            Reservasi{{ hitungHariRsv ? ` (${hitungHariRsv} hari)` : '' }}
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
            <!-- cells outside the month stay empty (`cell other`) -->
            <span
              v-if="sel.dalam"
              class="text-xs font-semibold num"
              :class="sel.tgl === hariIni() ? 'rounded-full bg-primary px-1.5 py-0.5 text-white' : 'text-muted'"
            >{{ sel.num }}</span>
            <ul
              v-if="sel.dalam"
              class="mt-1 space-y-0.5"
            >
              <li
                v-for="(it, i) in biasaHari(sel.tgl).slice(0, 4)"
                :key="i"
              >
                <button
                  v-if="it.tipe !== 'Holiday' && it.tipe !== 'Birthday'"
                  type="button"
                  class="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                  :class="WARNA_TIPE[it.tipe]"
                  :title="judulItem(it)"
                  @click="bukaItem(it)"
                >
                  <b
                    v-if="paxItem(it)"
                    class="float-end ms-1.5 hidden num sm:inline"
                  >{{ angka(paxItem(it)) }} pax</b>
                  <UIcon
                    v-if="it.tipe === 'Entertainment'"
                    name="i-lucide-mic"
                    class="me-0.5 size-3 align-[-2px]"
                  />{{ it.judul }}
                </button>
                <span
                  v-else
                  class="block truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                  :class="WARNA_TIPE[it.tipe]"
                >{{ it.judul }}</span>
              </li>
              <li
                v-if="biasaHari(sel.tgl).length > 4"
                class="px-1 text-[11px] text-muted num"
              >
                +{{ biasaHari(sel.tgl).length - 4 }} lagi
              </li>
              <li v-if="ringkasRsv(sel.tgl).n">
                <button
                  type="button"
                  class="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                  :class="WARNA_TIPE['Reservation']"
                  :title="`${ringkasRsv(sel.tgl).n} reservasi · ${ringkasRsv(sel.tgl).pax} pax — klik untuk rinciannya`"
                  @click="bukaHariRsv(sel.tgl)"
                >
                  <b
                    v-if="ringkasRsv(sel.tgl).pax"
                    class="float-end ms-1.5 hidden num sm:inline"
                  >{{ angka(ringkasRsv(sel.tgl).pax) }} pax</b>● {{ ringkasRsv(sel.tgl).n }} reservasi
                </button>
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
          <template v-if="itemAktif.acara">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Waktu</span>
                <b class="text-end">{{ fmtTglJamEms(itemAktif.acara.start_datetime) }}{{ itemAktif.acara.end_datetime ? ` – ${fmtTglJamEms(itemAktif.acara.end_datetime)}` : '' }}</b>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Lokasi</span>
                <span>{{ itemAktif.acara.venue || '—' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">PIC</span>
                <span>{{ itemAktif.acara.pic || '—' }}</span>
              </div>
              <div
                v-if="tiketEv(itemAktif.acara.id).length"
                class="flex justify-between gap-3 border-b border-default pb-1.5"
              >
                <span class="text-muted">Tiket</span>
                <span class="num">{{ angka(lakuEv(itemAktif.acara.id)) }} / {{ angka(kuotaEv(itemAktif.acara.id)) }} terjual</span>
              </div>
              <div
                v-if="omzetEv(itemAktif.acara.id)"
                class="flex justify-between gap-3 border-b border-default pb-1.5"
              >
                <span class="text-muted">Omzet lunas</span>
                <b class="num">{{ rupiah(omzetEv(itemAktif.acara.id)) }}</b>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <AppStatus
                  v-if="itemAktif.acara.category"
                  color="gold"
                  size="sm"
                >
                  {{ itemAktif.acara.category }}
                </AppStatus>
                <AppStatus
                  :color="STATUS_WARNA_EVENT[String(itemAktif.acara.status)] ?? 'neutral'"
                  :icon="STATUS_IKON_EVENT[String(itemAktif.acara.status)]"
                  size="sm"
                >
                  {{ String(itemAktif.acara.status) }}
                </AppStatus>
              </div>
            </div>
            <UButton
              :to="`/event/events/${itemAktif.acara.id}`"
              color="primary"
              @click="sheet = false"
            >
              Buka detail event
            </UButton>
          </template>
          <template v-else-if="itemAktif.jadwal">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Tanggal</span>
                <b>{{ tglPanjang(itemAktif.jadwal.date) }}</b>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Jam</span>
                <span>{{ itemAktif.jadwal.start_time || '—' }}–{{ itemAktif.jadwal.end_time || '—' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Jenis</span>
                <span>{{ itemAktif.jadwal.performance_type || '—' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Fee</span>
                <b class="num">{{ rupiah(Number(itemAktif.jadwal.fee) || 0) }}</b>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Kontak WA</span>
                <a
                  v-if="waNo(talentJadwal(itemAktif.jadwal.talent_id)?.whatsapp || talentJadwal(itemAktif.jadwal.talent_id)?.phone)"
                  :href="`https://wa.me/${waNo(talentJadwal(itemAktif.jadwal.talent_id)?.whatsapp || talentJadwal(itemAktif.jadwal.talent_id)?.phone)}`"
                  target="_blank"
                  rel="noopener"
                  class="font-semibold text-primary-700 underline"
                >{{ talentJadwal(itemAktif.jadwal.talent_id)?.whatsapp || talentJadwal(itemAktif.jadwal.talent_id)?.phone }}</a>
                <span v-else>—</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Status</span>
                <AppStatus size="sm">
                  {{ itemAktif.jadwal.status || '—' }}
                </AppStatus>
              </div>
            </div>
            <UButton
              to="/event/schedule"
              color="neutral"
              variant="outline"
              @click="sheet = false"
            >
              Buka talent schedule
            </UButton>
          </template>
          <template v-else-if="itemAktif.mkt">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Tanggal</span>
                <b>{{ tglPanjang(itemAktif.tgl) }}</b>
              </div>
              <div
                v-if="itemAktif.mkt.client"
                class="flex justify-between gap-3 border-b border-default pb-1.5"
              >
                <span class="text-muted">Klien</span>
                <span>{{ itemAktif.mkt.client }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Status</span>
                <span>{{ itemAktif.mkt.status || '—' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Estimasi tamu</span>
                <b class="num">{{ angka(Number(itemAktif.mkt.pax) || 0) }} pax</b>
              </div>
            </div>
            <p class="text-xs text-dimmed">
              Event marketing — read-only di sini.
            </p>
          </template>
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="rsvSheet"
        :title="`Reservasi · ${rsvTgl ? tglPanjang(rsvTgl) : ''}`"
      >
        <div
          v-if="rsvTgl"
          class="space-y-1.5 text-sm"
        >
          <div
            v-for="i in rsvHari(rsvTgl)"
            :key="i.rsv?.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-default py-1.5"
          >
            <b class="num">{{ i.rsv?.time || '—' }}</b>
            <b class="min-w-0 flex-1 text-highlighted">{{ i.rsv?.name }}</b>
            <span class="num">{{ i.rsv?.pax }} pax</span>
            <span class="text-muted">{{ i.rsv?.table || '—' }}</span>
            <span class="text-muted">{{ i.rsv?.status }}</span>
            <AppStatus
              v-if="i.rsv?.vip"
              color="vip"
              icon="i-lucide-crown"
              size="sm"
            >
              VIP
            </AppStatus>
          </div>
          <p class="pt-1 text-xs text-muted num">
            Total {{ angka(ringkasRsv(rsvTgl).pax) }} pax dari {{ ringkasRsv(rsvTgl).n }} reservasi
          </p>
          <UButton
            to="/reservasi/dashboard"
            target="_blank"
            color="neutral"
            variant="outline"
            @click="rsvTgl = null"
          >
            Buka modul reservasi
          </UButton>
        </div>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
