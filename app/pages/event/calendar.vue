<!--
  Event › Kalender — the unified multi-source month grid
  (`event/index.html:10925-11060`), built on the same KalenderBulan /
  KalenderKartu / kalender-warna as Marketing › Kalender.

  Sources: EMS events (violet, clickable; multi-day events on every WIB day),
  talent schedules (red, ONE summary line per day -> list sheet), calendarExtra
  (holidays/birthdays) from this module, Marketing events (gold) via
  `GET /marketing/events`, Reservasi (green) via `GET /reservasi/reservations`
  dropping cancelled/no-show. The two cross-module reads fail on their own: a
  warning ribbon + "Coba lagi", never a blank screen (`:10825`). Their popups are
  read-only. A deal (Marketing Deal/Confirmed, EMS Upcoming/Today) gets only a
  green dot — cards keep the colour of their source.

  Interaction: a click on an empty day opens "Rencana baru" with that day at
  19:00 (planning access); an EMS event can be dragged to another day (events
  access) — only start/end move, time and length stay; Done/Finished/Cancelled
  are locked.
-->
<script setup lang="ts">
import type { Acara, JadwalTalent } from '~/composables/useEvent'
import { patchEvent, useDaftarEvent, useStateEvent } from '~/composables/useEvent'
import { fmtTglJamEms, geserStempelHari, hariAcaraWIB, tglWIB } from '~/utils/event-hitung'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, fTgl, hariIni, rupiah, tglPanjang } from '~/utils/format'
import { hariKe, rentangBulan, rentangHari } from '~/utils/kalender'
import { SUMBER_KALENDER, adalahDeal, lolosSaringStatus } from '~/utils/kalender-warna'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const peran = computed(() => peranEvent(me.value))
const namaSaya = computed(() => me.value?.name ?? '')
const bolehRencana = computed(() => bolehUbahEvent('planning', peran.value))
const bolehGeser = computed(() => bolehUbahEvent('events', peran.value))

const { data: state, error, refresh: ulangState } = useStateEvent()
const s = computed(() => state.value?.data ?? null)
// The events come from their own list: it carries the version each PATCH needs.
const { data: daftar, error: errDaftar, refresh: ulangDaftar } = useDaftarEvent<Acara>('events', {}, 'event-kalender-events')
const muatUlang = () => Promise.all([ulangState(), ulangDaftar()])

// ---- filters (status applies to EMS + Marketing, source to everything) ----
type Sumber = 'semua' | 'ems' | 'marketing' | 'reservasi' | 'talent' | 'libur' | 'ulangtahun'
const SEMUA = '__semua'
const status = useState('ev-cal-status', () => '')
const fStatus = computed({ get: () => status.value || SEMUA, set: (v: string) => {
  status.value = v === SEMUA ? '' : v
} })
const OPSI_STATUS = [
  { value: SEMUA, label: 'Semua status' },
  ...['Planning', 'Prospect', 'Approval', 'Upcoming', 'Event Done', 'Finished', 'Cancelled', 'Lead', 'Quotation Terkirim', 'Confirmed', 'Deal', 'Lost']
    .map(v => ({ value: v, label: v })),
]
const sumber = useState<Sumber>('ev-cal-sumber', () => 'semua')
const OPSI_SUMBER: { value: Sumber, label: string }[] = [
  { value: 'semua', label: 'Semua sumber' },
  { value: 'ems', label: 'Event EMS' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'reservasi', label: 'Reservasi' },
  { value: 'talent', label: 'Talent' },
  { value: 'libur', label: 'Libur' },
  { value: 'ulangtahun', label: 'Ulang tahun' },
]
const tampil = (k: Exclude<Sumber, 'semua'>) => sumber.value === 'semua' || sumber.value === k

const bulan = useState('ev-cal-bulan', () => hariIni().slice(0, 7))
const rentang = computed(() => rentangBulan(bulan.value))
const bulanDari = computed(() => rentang.value.a)
const bulanSampai = computed(() => rentang.value.b)
const dalamBulan = (tgl: string) => tgl >= bulanDari.value && tgl <= bulanSampai.value

// ---- cross-module sources (read-only, each may fail on its own) ----
interface MktEvent { id: string, title?: string, nama?: string, tanggal?: string, tanggalSelesai?: string, date?: string, status?: string, pax?: number | string, client?: string, clientId?: string }
interface RsvRow { id: string, name: string, date: string, time?: string, pax: number, status: string, table?: string, vip?: boolean }

const mkt = ref<MktEvent[]>([])
const rsv = ref<RsvRow[]>([])
const mktGagal = ref(false)
const rsvGagal = ref(false)
let seqSilang = 0

async function muatSilang() {
  const n = ++seqSilang
  mktGagal.value = false
  rsvGagal.value = false
  const api = useApi()
  try {
    // One page is 100 rows by default — a whole month needs the max page.
    // `from` filters on the START date, so look 31 days back for multi-day events running into this month.
    const r = await api<Envelope<MktEvent[]>>('/marketing/events', { query: { from: geserStempelHari(bulanDari.value, -31), to: bulanSampai.value, perPage: 1000 } })
    if (n !== seqSilang) return
    mkt.value = r.data ?? []
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
}
watch([bulanDari, bulanSampai], muatSilang, { immediate: true })

// ---- what each day holds ----
const TERKUNCI = ['Event Done', 'Finished', 'Cancelled']
const talentById = (id?: string) => (s.value?.talents ?? []).find(t => t.id === id) ?? null

/** paxEventEms (:10978): sold tickets when any sold, else the planned capacity. */
function paxEms(e: Acara) {
  const laku = (s.value?.ticketClasses ?? []).filter(c => c.event_id === e.id).reduce((a, c) => a + (Number(c.sold) || 0), 0)
  return laku ? { n: laku, dari: 'tiket terjual' } : { n: Number(e.capacity) || 0, dari: 'kapasitas rencana' }
}

const emsLolos = (e: Acara) => tampil('ems') && lolosSaringStatus(String(e.status), status.value)
const mktLolos = (e: MktEvent) => tampil('marketing') && lolosSaringStatus(e.status, status.value)

/** day -> EMS events touching it (WIB, every day of a multi-day event), by start time. */
const emsPerHari = computed(() => {
  const m = new Map<string, Acara[]>()
  for (const e of daftar.value.rows) {
    if (!emsLolos(e)) continue
    for (const tgl of hariAcaraWIB(e.start_datetime, e.end_datetime)) {
      if (!dalamBulan(tgl)) continue
      const l = m.get(tgl) ?? []
      l.push(e)
      m.set(tgl, l)
    }
  }
  for (const l of m.values()) l.sort((a, b) => String(a.start_datetime).localeCompare(String(b.start_datetime)))
  return m
})
const mktPerHari = computed(() => {
  const m = new Map<string, MktEvent[]>()
  for (const e of mkt.value) {
    if (!mktLolos(e)) continue
    const a = String(e.tanggal ?? e.date ?? '').slice(0, 10)
    for (const tgl of rentangHari(a, String(e.tanggalSelesai ?? '').slice(0, 10))) {
      if (!dalamBulan(tgl)) continue
      const l = m.get(tgl) ?? []
      l.push(e)
      m.set(tgl, l)
    }
  }
  return m
})
interface KartuHari { id: string, ems?: Acara, mkt?: MktEvent }
const kartuHari = (tgl: string): KartuHari[] => [
  ...(emsPerHari.value.get(tgl) ?? []).map(e => ({ id: `ems-${e.id}`, ems: e })),
  ...(mktPerHari.value.get(tgl) ?? []).map(e => ({ id: `mkt-${e.id}`, mkt: e })),
]
const MAKS_KARTU = 4

// renderCalendar (:11185) draws every schedule, cancelled ones too — the list shows the status
const talentHari = (tgl: string): JadwalTalent[] => tampil('talent')
  ? (s.value?.schedules ?? []).filter(j => j.date === tgl).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
  : []
function ringkasTalent(tgl: string) {
  const semua = talentHari(tgl)
  const aktif = semua.filter(j => j.status !== 'Cancelled')
  const mulai = aktif.map(j => String(j.start_time ?? '')).filter(Boolean).sort()[0]
  const selesai = aktif.map(j => String(j.end_time ?? '')).filter(Boolean).sort().at(-1)
  const jam = mulai && selesai ? `${mulai}–${selesai}` : ''
  if (!semua.length) return null
  return aktif.length
    ? `${aktif.length} talent${jam ? ` · ${jam}` : ''}`
    : `${semua.length} talent batal`
}
const extraHari = (tgl: string) => (s.value?.calendarExtra ?? []).filter((x) => {
  // A `Reservation` row here would double-count the real bookings read from the Reservasi module.
  const tipe = String(x.type ?? '').toLowerCase()
  if (x.date !== tgl || tipe === 'reservation') return false
  return tampil(tipe === 'birthday' ? 'ulangtahun' : 'libur')
})
const rsvHari = (tgl: string) => tampil('reservasi')
  ? rsv.value.filter(r => r.date === tgl).sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')))
  : []
const ringkasRsv = (tgl: string) => {
  const rows = rsvHari(tgl)
  return { n: rows.length, pax: rows.reduce((a, r) => a + (Number(r.pax) || 0), 0) }
}

// "N pax bulan ini" (`:11047`): follows the filters, like the old total.
const paxBulan = computed(() => {
  let ems = 0
  for (const e of daftar.value.rows) {
    if (emsLolos(e) && dalamBulan(tglWIB(e.start_datetime))) ems += paxEms(e).n
  }
  const mktPax = mkt.value
    .filter(e => mktLolos(e) && String(e.tanggal ?? e.date ?? '').slice(0, 7) === bulan.value)
    .reduce((a, e) => a + (Number(e.pax) || 0), 0)
  const rsvPax = tampil('reservasi') ? rsv.value.reduce((a, r) => a + (Number(r.pax) || 0), 0) : 0
  return { ems, mkt: mktPax, rsv: rsvPax, total: ems + mktPax + rsvPax }
})

/** Legend counts, unfiltered: schedules on record, this month's marketing events, days holding reservations. */
// the old legend counts every schedule on record, not just this month's
const hitungJadwal = computed(() => (s.value?.schedules ?? []).length)
const hitungMkt = computed(() => mkt.value.filter(e => String(e.tanggal ?? e.date ?? '').slice(0, 7) === bulan.value).length)
const hitungHariRsv = computed(() => new Set(rsv.value.map(r => r.date)).size)

// ---- rich popups (`:11229-11285`, `:11047-11065`) ----
const kelas = computed(() => s.value?.ticketClasses ?? [])
const lunasSemua = computed(() => (s.value?.orders ?? []).filter(o => o.payment_status === 'Paid'))
const tiketEv = (id: string) => kelas.value.filter(c => c.event_id === id)
const lakuEv = (id: string) => tiketEv(id).reduce((a, c) => a + (Number(c.sold) || 0), 0)
const kuotaEv = (id: string) => tiketEv(id).reduce((a, c) => a + (Number(c.quota) || 0), 0)
const omzetEv = (id: string) => lunasSemua.value.filter(o => o.event_id === id).reduce((a, o) => a + (Number(o.total) || 0), 0)
const waNo = (p?: string | null) => {
  let x = String(p ?? '').replace(/\D/g, '')
  if (x.startsWith('0')) x = `62${x.slice(1)}`
  return x
}
const waTalent = (talentId?: string) => talentById(talentId)?.whatsapp || talentById(talentId)?.phone || ''

const detail = ref<{ tgl: string, ems?: Acara, mkt?: MktEvent } | null>(null)
const sheetDetail = computed({ get: () => detail.value !== null, set: (v: boolean) => {
  if (!v) detail.value = null
} })
function judulEms(e: Acara) {
  const p = paxEms(e)
  return `${e.title}${p.n ? ` — ${p.n} pax (${p.dari})` : ''}`
}
const namaMkt = (e: MktEvent) => e.title ?? e.nama ?? 'Marketing'
const judulMkt = (e: MktEvent) => `Acara Marketing: ${namaMkt(e)}${e.client ? ` — ${e.client}` : ''}${e.pax ? ` · ${e.pax} pax` : ''}`

/** One summary line per day opens that day's talent list / bookings. */
const talentTgl = ref<string | null>(null)
const sheetTalent = computed({ get: () => talentTgl.value !== null, set: (v: boolean) => {
  if (!v) talentTgl.value = null
} })
const rsvTgl = ref<string | null>(null)
const sheetRsv = computed({ get: () => rsvTgl.value !== null, set: (v: boolean) => {
  if (!v) rsvTgl.value = null
} })

// ---- click an empty day: new plan ----
const rencanaBaru = useRencanaBaru(muatUlang)
const sheetBaru = ref(false)
const tglBaru = ref('')
function rencanaDi(tgl: string) {
  if (!bolehRencana.value) return
  tglBaru.value = tgl
  sheetBaru.value = true
}
async function simpanBaru(body: Record<string, unknown>) {
  sheetBaru.value = false
  await rencanaBaru.simpan(body)
}

// ---- drag an EMS event to another day ----
const bisaDigeser = (e: Acara) => bolehGeser.value && !TERKUNCI.includes(String(e.status))
async function lepasDi({ id, dari, ke }: { id: string, dari: string, ke: string }) {
  const e = daftar.value.rows.find(x => x.id === id)
  if (!e || ke === dari || !bisaDigeser(e)) return
  const geser = hariKe(ke) - hariKe(dari)
  const mulai = geserStempelHari(String(e.start_datetime), geser)
  const selesai = e.end_datetime ? geserStempelHari(String(e.end_datetime), geser) : ''
  const tglMulai = tglWIB(mulai)
  const tglAkhir = selesai ? tglWIB(selesai) : ''
  const laku = lakuEv(e.id)
  const tanya = `Pindahkan "${e.title}" ke ${fTgl(tglMulai)}${tglAkhir && tglAkhir !== tglMulai ? ` – ${fTgl(tglAkhir)}` : ''}? Jam dan lamanya tidak berubah.`
    + (e.is_ticketed || laku
      ? `\n\nEvent ini bertiket: ${angka(laku)} tiket sudah terjual untuk tanggal lama. Pastikan pembeli diberi tahu.`
      : '')
  if (!confirm(tanya)) return
  try {
    await patchEvent('events', e.id, { start_datetime: mulai, ...(selesai ? { end_datetime: selesai } : {}) }, daftar.value.versions[e.id])
    toast.add({ title: 'Tanggal event dipindah', color: 'success' })
    await muatUlang()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, muatUlang))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <EventGerbang lihat="calendar">
    <AppPage
      title="Kalender"
      description="Kalender terpadu multi-sumber"
    >
      <template #actions>
        <USelect
          v-model="fStatus"
          :items="OPSI_STATUS"
          class="w-44"
          aria-label="Status"
        />
        <USelect
          v-model="sumber"
          :items="OPSI_SUMBER"
          class="w-40"
          aria-label="Sumber"
        />
        <KalenderNav v-model="bulan" />
      </template>

      <UAlert
        v-if="error || errDaftar"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error || errDaftar)"
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

      <KalenderBulan
        v-model:bulan="bulan"
        :boleh-klik="bolehRencana"
        :boleh-seret="bolehGeser"
        judul-klik="Klik untuk membuat rencana baru di tanggal ini"
        legenda-deal
        @klik-tgl="rencanaDi"
        @lepas="lepasDi"
      >
        <template #legenda>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.ems.swatch"
          />Event EMS</span>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.talent.swatch"
          />Talent{{ hitungJadwal ? ` (${hitungJadwal})` : '' }}</span>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.marketing.swatch"
          />Marketing{{ hitungMkt ? ` (${hitungMkt})` : '' }}</span>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.reservasi.swatch"
          />Reservasi{{ hitungHariRsv ? ` (${hitungHariRsv} hari)` : '' }}</span>
        </template>
        <template #total>
          <span :title="`EMS ${angka(paxBulan.ems)} · Marketing ${angka(paxBulan.mkt)} · Reservasi ${angka(paxBulan.rsv)} pax`">
            {{ angka(paxBulan.total) }} pax bulan ini
          </span>
        </template>
        <template #sel="{ tgl }">
          <template
            v-for="k in kartuHari(tgl).slice(0, MAKS_KARTU)"
            :key="k.id"
          >
            <KalenderKartu
              v-if="k.ems"
              sumber="ems"
              :judul="k.ems.title"
              :deal="adalahDeal('ems', String(k.ems.status))"
              :dicoret="k.ems.status === 'Cancelled'"
              :kanan="paxEms(k.ems).n ? `${angka(paxEms(k.ems).n)} pax` : ''"
              :title="judulEms(k.ems)"
              :seret-id="bisaDigeser(k.ems) ? k.ems.id : ''"
              :tgl="tgl"
              @klik="detail = { tgl, ems: k.ems }"
            />
            <KalenderKartu
              v-else-if="k.mkt"
              sumber="marketing"
              :judul="namaMkt(k.mkt)"
              :deal="adalahDeal('marketing', k.mkt.status)"
              :kanan="Number(k.mkt.pax) ? `${angka(Number(k.mkt.pax))} pax` : ''"
              :title="judulMkt(k.mkt)"
              @klik="detail = { tgl, mkt: k.mkt }"
            />
          </template>
          <p
            v-if="kartuHari(tgl).length > MAKS_KARTU"
            class="px-1 text-[11px] text-muted num"
          >
            +{{ kartuHari(tgl).length - MAKS_KARTU }} lagi
          </p>
          <KalenderKartu
            v-if="ringkasTalent(tgl)"
            sumber="talent"
            :title="`${ringkasTalent(tgl)} — klik untuk daftarnya`"
            @klik="talentTgl = tgl"
          >
            <UIcon
              name="i-lucide-mic"
              class="me-0.5 size-3 align-[-2px]"
            />{{ ringkasTalent(tgl) }}
          </KalenderKartu>
          <KalenderKartu
            v-for="x in extraHari(tgl)"
            :key="x.id"
            :sumber="String(x.type).toLowerCase() === 'birthday' ? 'ulangtahun' : 'libur'"
            :judul="x.title"
            statis
          />
          <KalenderKartu
            v-if="ringkasRsv(tgl).n"
            sumber="reservasi"
            :title="`${ringkasRsv(tgl).n} reservasi · ${ringkasRsv(tgl).pax} pax — klik untuk rinciannya`"
            @klik="rsvTgl = tgl"
          >
            {{ ringkasRsv(tgl).n }} reservasi<span class="hidden lg:inline">{{ ringkasRsv(tgl).pax ? ` · ${angka(ringkasRsv(tgl).pax)} pax` : '' }}</span>
          </KalenderKartu>
        </template>
      </KalenderBulan>

      <ResponsiveSheet
        v-model:open="sheetDetail"
        :title="detail?.ems?.title ?? (detail?.mkt ? namaMkt(detail.mkt) : 'Detail')"
      >
        <div
          v-if="detail"
          class="space-y-2 text-sm"
        >
          <p class="text-muted">
            {{ tglPanjang(detail.tgl) }} · {{ detail.ems ? 'Event' : 'Marketing' }}
          </p>
          <template v-if="detail.ems">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Waktu</span>
                <b class="text-end">{{ fmtTglJamEms(detail.ems.start_datetime) }}{{ detail.ems.end_datetime ? ` – ${fmtTglJamEms(detail.ems.end_datetime)}` : '' }}</b>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Lokasi</span>
                <span>{{ detail.ems.venue || '—' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">PIC</span>
                <span>{{ detail.ems.pic || '—' }}</span>
              </div>
              <div
                v-if="tiketEv(detail.ems.id).length"
                class="flex justify-between gap-3 border-b border-default pb-1.5"
              >
                <span class="text-muted">Tiket</span>
                <span class="num">{{ angka(lakuEv(detail.ems.id)) }} / {{ angka(kuotaEv(detail.ems.id)) }} terjual</span>
              </div>
              <div
                v-if="omzetEv(detail.ems.id)"
                class="flex justify-between gap-3 border-b border-default pb-1.5"
              >
                <span class="text-muted">Omzet lunas</span>
                <b class="num">{{ rupiah(omzetEv(detail.ems.id)) }}</b>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <AppStatus
                  v-if="detail.ems.category"
                  color="gold"
                  size="sm"
                >
                  {{ detail.ems.category }}
                </AppStatus>
                <AppStatus
                  :color="STATUS_WARNA_EVENT[String(detail.ems.status)] ?? 'neutral'"
                  :icon="STATUS_IKON_EVENT[String(detail.ems.status)]"
                  size="sm"
                >
                  {{ String(detail.ems.status) }}
                </AppStatus>
              </div>
            </div>
            <UButton
              :to="`/event/events/${detail.ems.id}`"
              color="primary"
              @click="sheetDetail = false"
            >
              Buka detail event
            </UButton>
          </template>
          <template v-else-if="detail.mkt">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Tanggal</span>
                <b>{{ tglPanjang(detail.tgl) }}</b>
              </div>
              <div
                v-if="detail.mkt.client"
                class="flex justify-between gap-3 border-b border-default pb-1.5"
              >
                <span class="text-muted">Klien</span>
                <span>{{ detail.mkt.client }}</span>
              </div>
              <div class="flex items-center justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Status</span>
                <AppStatus
                  v-if="detail.mkt.status"
                  :color="warnaStatusMkt(detail.mkt.status)"
                  :icon="ikonStatusMkt(detail.mkt.status)"
                  size="sm"
                >
                  {{ detail.mkt.status }}
                </AppStatus>
                <span v-else>—</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Estimasi tamu</span>
                <b class="num">{{ angka(Number(detail.mkt.pax) || 0) }} pax</b>
              </div>
            </div>
            <p class="text-xs text-dimmed">
              Event marketing — read-only di sini.
            </p>
          </template>
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetTalent"
        :title="`Talent · ${talentTgl ? tglPanjang(talentTgl) : ''}`"
      >
        <div
          v-if="talentTgl"
          class="space-y-1.5 text-sm"
        >
          <div
            v-for="j in talentHari(talentTgl)"
            :key="j.id"
            class="space-y-0.5 border-b border-default py-1.5"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <b class="num">{{ j.start_time || '—' }}–{{ j.end_time || '—' }}</b>
              <b class="min-w-0 flex-1 text-highlighted">{{ talentById(j.talent_id)?.name ?? 'Talent' }}</b>
              <AppStatus
                size="sm"
                :color="STATUS_WARNA_EVENT[j.status] ?? 'neutral'"
              >
                {{ j.status || '—' }}
              </AppStatus>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 text-xs text-muted">
              <span>{{ j.performance_type || '—' }}</span>
              <span class="num">Fee {{ rupiah(Number(j.fee) || 0) }}</span>
              <a
                v-if="waNo(waTalent(j.talent_id))"
                :href="`https://wa.me/${waNo(waTalent(j.talent_id))}`"
                target="_blank"
                rel="noopener"
                class="font-semibold text-primary-700 underline"
              >{{ waTalent(j.talent_id) }}</a>
            </div>
          </div>
          <UButton
            :to="`/event/schedule?tgl=${talentTgl}`"
            color="neutral"
            variant="outline"
            @click="talentTgl = null"
          >
            Atur jadwal
          </UButton>
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetRsv"
        :title="`Reservasi · ${rsvTgl ? tglPanjang(rsvTgl) : ''}`"
      >
        <div
          v-if="rsvTgl"
          class="space-y-1.5 text-sm"
        >
          <div
            v-for="r in rsvHari(rsvTgl)"
            :key="r.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-default py-1.5"
          >
            <b class="num">{{ r.time || '—' }}</b>
            <b class="min-w-0 flex-1 text-highlighted">{{ r.name }}</b>
            <span class="num">{{ r.pax }} pax</span>
            <span class="text-muted">{{ r.table || '—' }}</span>
            <span class="text-muted">{{ r.status }}</span>
            <AppStatus
              v-if="r.vip"
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

      <ResponsiveSheet
        v-model:open="sheetBaru"
        title="Rencana baru"
      >
        <EventForm
          :key="tglBaru"
          :tanggal-awal="tglBaru"
          :pic-terkunci="namaSaya"
          @simpan="simpanBaru($event)"
          @batal="sheetBaru = false"
        />
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
