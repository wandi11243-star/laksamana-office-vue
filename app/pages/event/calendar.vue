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
import { jamWIB, paxAcara, tglWIB } from '~/utils/event-hitung'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, hariIni, rupiah, tglPanjang } from '~/utils/format'

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
interface MktEvent { id: string, title?: string, nama?: string, tanggal?: string, date?: string, status?: string, pax?: number, client?: string, clientId?: string }
interface RsvRow { id: string, name: string, date: string, time?: string, pax: number, status: string, table?: string, vip?: boolean }

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
    // Cancelled/no-show come in several spellings — none of them will be seated.
    rsv.value = (r.data ?? []).filter(r => !['cancelled', 'no-show', 'noshow', 'batal'].includes(String(r.status ?? '').toLowerCase()))
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
    const tgl = tglWIB(e.start_datetime)
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

// "N pax bulan ini" ribbon (`:11047`): follows the type filter, like the old total.
const paxBulan = computed(() => {
  const kelas = s.value?.ticketClasses ?? []
  let ems = 0
  for (const e of s.value?.events ?? []) {
    const tgl = tglWIB(e.start_datetime)
    if (tgl >= bulanDari.value && tgl <= bulanSampai.value) ems += paxAcara(e, kelas)
  }
  const mktPax = mkt.value.reduce((a, e) => a + (Number(e.pax) || 0), 0)
  const rsvPax = rsv.value.reduce((a, r) => a + (Number(r.pax) || 0), 0)
  const total = tipe.value === 'all' ? ems + mktPax + rsvPax
    : tipe.value === 'Event' ? ems
      : tipe.value === 'Marketing' ? mktPax
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
const hitungJadwal = computed(() => (s.value?.schedules ?? [])
  .filter(j => j.date >= bulanDari.value && j.date <= bulanSampai.value && j.status !== 'Cancelled').length)
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
          class="rounded-full px-2 py-0.5 font-semibold"
          :class="WARNA_TIPE['Event']"
        >
          Event
        </span>
        <span
          class="rounded-full px-2 py-0.5 font-semibold"
          :class="WARNA_TIPE['Entertainment']"
        >
          Talent ({{ hitungJadwal }})
        </span>
        <span
          class="rounded-full px-2 py-0.5 font-semibold"
          :class="WARNA_TIPE['Marketing']"
        >
          Marketing ({{ hitungMkt }})
        </span>
        <span
          class="rounded-full px-2 py-0.5 font-semibold"
          :class="WARNA_TIPE['Reservation']"
        >
          Reservasi ({{ hitungHariRsv }} hari)
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
              v-for="(it, i) in biasaHari(sel.tgl).slice(0, 4)"
              :key="i"
            >
              <button
                v-if="it.tipe !== 'Holiday' && it.tipe !== 'Birthday'"
                type="button"
                class="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                :class="WARNA_TIPE[it.tipe]"
                @click="bukaItem(it)"
              >
                {{ it.judul }}<template v-if="it.tipe === 'Event'"> · <b class="num">{{ angka(lakuEv(it.acara?.id ?? '')) }} pax</b></template><template v-else-if="it.tipe === 'Marketing' && it.mkt?.pax"> · <b class="num">{{ angka(Number(it.mkt.pax) || 0) }} pax</b></template>
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
                :title="`${ringkasRsv(sel.tgl).n} reservasi hari ini`"
                @click="bukaHariRsv(sel.tgl)"
              >
                {{ ringkasRsv(sel.tgl).n }} reservasi · <b class="num">{{ angka(ringkasRsv(sel.tgl).pax) }} pax</b>
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
              <b>{{ jamWIB(itemAktif.acara.start_datetime) }}{{ itemAktif.acara.end_datetime ? `–${jamWIB(itemAktif.acara.end_datetime)}` : '' }} WIB</b>
            </div>
            <div class="flex justify-between gap-3 border-b border-default pb-1.5">
              <span class="text-muted">Lokasi</span>
              <span>{{ itemAktif.acara.venue || '—' }}</span>
            </div>
            <div class="flex justify-between gap-3 border-b border-default pb-1.5">
              <span class="text-muted">PIC</span>
              <span>{{ itemAktif.acara.pic || '—' }}</span>
            </div>
            <div class="flex justify-between gap-3 border-b border-default pb-1.5">
              <span class="text-muted">Tiket</span>
              <span class="num">{{ angka(lakuEv(itemAktif.acara.id)) }} / {{ angka(kuotaEv(itemAktif.acara.id)) }} terjual</span>
            </div>
            <div class="flex justify-between gap-3 border-b border-default pb-1.5">
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
              <span>{{ itemAktif.jadwal.type || '—' }}</span>
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
