<!--
  Marketing › Kalender (old renderCalendar, deploy/marketing/index.html:12326-12438;
  marketing.md D.6). Month grid starting Sunday like the old one; three bands:
  Marketing events (gold, multi-day events on every day they touch), EMS
  events from the Event module (violet, read-only) and Reservasi (teal, like the old calendar; one line per
  day: bookings · pax, cancelled/no-show left out). Status filter defaults to
  "everything except Lost"; the header shows the month's pax with the same
  filter.

  The EMS and Reservasi bands are read without waiting and may fail on their
  own (their module not held, offline): the Marketing events still draw, a
  warning with "Coba lagi" says what is missing — as before.
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import { eventPadaTgl, jenisEvent, tglMkt } from '~/utils/marketing'
import { dpLabel, eventFinance } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { BULAN, fTgl, hariIni, rupiah } from '~/utils/format'
import { listReservations } from '~/composables/useReservasi'

definePageMeta({ access: ['marketing'] })

const router = useRouter()
const { data: st, error } = useStateMkt()
const hari = hariIni()

const SEMUA = '__semua'
const status = useState('mkt-cal-status', () => '')
const fStatus = computed({ get: () => status.value || SEMUA, set: (v: string) => {
  status.value = v === SEMUA ? '' : v
} })
const opsiStatus = [{ value: SEMUA, label: 'Semua status' }, ...['Lead', 'Prospect', 'Quotation Terkirim', 'Deal', 'Event Done', 'Lost'].map(s => ({ value: s, label: s }))]
const bulan = useState('mkt-cal-bulan', () => hari.slice(0, 7))
const judul = computed(() => `${BULAN[+bulan.value.slice(5, 7) - 1]} ${bulan.value.slice(0, 4)}`)
function geser(n: number) {
  const d = new Date(+bulan.value.slice(0, 4), +bulan.value.slice(5, 7) - 1 + n, 1)
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
/** Cells as the old grid: leading/trailing days of other months are blank (:12359-12366). */
const sel = computed(() => {
  const y = +bulan.value.slice(0, 4)
  const m = +bulan.value.slice(5, 7) - 1
  const first = new Date(y, m, 1).getDay()
  const dim = new Date(y, m + 1, 0).getDate()
  const prevDim = new Date(y, m, 0).getDate()
  const out: { d: number, tgl: string }[] = []
  for (let i = first - 1; i >= 0; i--) out.push({ d: prevDim - i, tgl: '' })
  for (let i = 1; i <= dim; i++) out.push({ d: i, tgl: iso(y, m, i) })
  let n = 1
  while (out.length % 7) out.push({ d: n++, tgl: '' })
  return out
})
const rentang = computed(() => {
  const y = +bulan.value.slice(0, 4)
  const m = +bulan.value.slice(5, 7) - 1
  return { a: iso(y, m, 1), b: iso(y, m, new Date(y, m + 1, 0).getDate()) }
})

const lolos = (e: EventMkt) => (status.value ? e.status === status.value : e.status !== 'Lost')
const evTgl = (tgl: string) => (tgl ? st.value.events.filter(e => eventPadaTgl(e, tgl) && lolos(e)) : [])
/** Pax this month, same status filter (calTotalPax :12407-12413). */
const paxBulan = computed(() => st.value.events
  .filter(e => String(e.tanggal ?? '').slice(0, 7) === bulan.value && lolos(e))
  .reduce((a, e) => a + (+(e.pax ?? 0) || 0), 0))

// ---- EMS (read-only) ----
const { data: ems, error: emsErr, refresh: emsUlang } = useAsyncData('mkt-cal-ems', () => getAcaraEms(rentang.value.a, rentang.value.b), { watch: [rentang], default: () => [], server: false })
const emsTgl = (tgl: string) => (tgl ? ems.value.filter(x => x.tgl === tgl) : [])

// ---- Reservasi per day ----
type HariRsv = { jml: number, pax: number, baris: { nama: string, jam: string, pax: number, meja: string, status: string, vip: boolean }[] }
const BATAL = ['cancelled', 'no-show', 'noshow', 'batal']
const { data: rsv, error: rsvErr, refresh: rsvUlang } = useAsyncData('mkt-cal-rsv', async () => {
  const r = await listReservations(rentang.value.a, rentang.value.b)
  const peta: Record<string, HariRsv> = {}
  for (const x of r.data ?? []) {
    if (!x?.date || BATAL.includes(String(x.status || '').toLowerCase())) continue
    const k = String(x.date).slice(0, 10)
    const h = (peta[k] ??= { jml: 0, pax: 0, baris: [] })
    h.jml++
    h.pax += +x.pax || 0
    h.baris.push({ nama: x.name || '(tanpa nama)', jam: x.time || '', pax: +x.pax || 0, meja: x.table || '', status: x.status || '', vip: !!x.vip })
  }
  for (const h of Object.values(peta)) h.baris.sort((a, b) => a.jam.localeCompare(b.jam))
  return peta
}, { watch: [rentang], default: () => ({} as Record<string, HariRsv>), server: false })

// ---- popups ----
const evBuka = ref<EventMkt | null>(null)
const emsBuka = ref<AcaraEmsMkt | null>(null)
const rsvBuka = ref<string | null>(null)
const buka = (v: Ref<unknown>) => computed({ get: () => !!v.value, set: (x: boolean) => {
  if (!x) v.value = null
} })
const evSheet = buka(evBuka)
const emsSheet = buka(emsBuka)
const rsvSheet = buka(rsvBuka)
const uang = computed(() => (evBuka.value ? eventFinance(evBuka.value, st.value.settings) : null))
const pakaiDp = (e: EventMkt) => e.detail?.sistemBayar === 'DP' || +(e.detail?.depositNominal as number) > 0
const d = computed(() => (evBuka.value?.detail ?? {}) as Record<string, string>)
const jam = computed(() => [d.value.mulaiSetup ? `Setup ${d.value.mulaiSetup}` : '', d.value.tamuDatang ? `Mulai ${d.value.tamuDatang}` : '', d.value.selesai ? `Selesai ${d.value.selesai}` : ''].filter(Boolean).join(' · '))
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? '—'
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'
</script>

<template>
  <AppPage
    title="Kalender"
    description="Satu jadwal untuk seluruh venue — hindari dobel booking."
  >
    <template #actions>
      <USelect
        v-model="fStatus"
        :items="opsiStatus"
        class="w-48"
        aria-label="Status"
      />
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        size="sm"
        aria-label="Bulan sebelumnya"
        @click="geser(-1)"
      />
      <UButton
        label="Hari Ini"
        color="neutral"
        variant="outline"
        size="sm"
        @click="bulan = hari.slice(0, 7)"
      />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        size="sm"
        aria-label="Bulan berikutnya"
        @click="geser(1)"
      />
    </template>

    <MarketingGerbang layar="calendar">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Marketing: ${apiErrorMessage(error)}`"
        class="mb-3"
      />
      <UAlert
        v-if="emsErr"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Tidak bisa membaca event EMS: ${apiErrorMessage(emsErr)}`"
        description="Acara dari modul Event tidak ikut tergambar."
        :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => emsUlang() }]"
        class="mb-3"
      />
      <UAlert
        v-if="rsvErr"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Tidak bisa membaca modul Reservasi: ${apiErrorMessage(rsvErr)}`"
        description="Reservasi tidak ikut tergambar — event Marketing di bawah tetap benar."
        :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => rsvUlang() }]"
        class="mb-3"
      />

      <AppPanel flush>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default px-4 py-3 lg:px-5">
          <h2 class="font-display text-lg font-semibold">
            {{ judul }}
          </h2>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-primary-400" />Event Marketing</span>
            <span class="flex items-center gap-1.5"><span
              class="size-2.5 rounded-sm bg-vip"
              title="EMS = Event Management System (modul Event)"
            />Acara EMS{{ ems.length ? ` (${ems.length})` : '' }}</span>
            <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-success" />Reservasi{{ Object.keys(rsv).length ? ` (${Object.keys(rsv).length} hari)` : '' }}</span>
          </div>
          <span class="num ml-auto text-sm font-bold text-primary-700">{{ paxBulan.toLocaleString('id-ID') }} pax bulan ini</span>
        </div>
        <div class="grid grid-cols-7 border-b border-default text-center text-[11px] font-bold tracking-wide text-muted uppercase">
          <div
            v-for="x in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']"
            :key="x"
            class="py-2"
          >
            {{ x }}
          </div>
        </div>
        <!-- Month step replaces the grid, so it crossfades on one key. -->
        <Transition
          name="mkt-swap"
          mode="out-in"
        >
          <div
            :key="bulan"
            class="grid grid-cols-7"
          >
            <div
              v-for="(s, i) in sel"
              :key="i"
              class="min-h-20 min-w-0 border-r border-b border-default p-1 lg:min-h-28 lg:p-1.5"
              :class="[!s.tgl ? 'bg-muted/60' : '', s.tgl === hari ? 'bg-primary-50' : '']"
            >
              <p
                class="num mb-1 text-xs"
                :class="s.tgl === hari ? 'font-bold text-primary-700' : s.tgl ? 'font-semibold text-default' : 'text-dimmed'"
              >
                {{ s.d }}
              </p>
              <button
                v-for="e in evTgl(s.tgl)"
                :key="e.id"
                type="button"
                class="mb-0.5 block w-full truncate rounded border-l-2 border-primary-400 bg-primary-100 px-1 py-0.5 text-left text-[10.5px] font-semibold leading-tight text-primary-900 lg:text-[11px]"
                :title="`${e.nama} — ${jenisEvent(e)}${e.pax ? ` · ${e.pax} pax` : ''}`"
                @click="evBuka = e"
              >
                {{ e.nama }}<b
                  v-if="e.pax"
                  class="float-right ml-1 hidden lg:inline"
                >{{ e.pax }} pax</b>
              </button>
              <button
                v-for="x in emsTgl(s.tgl)"
                :key="x.id"
                type="button"
                class="mb-0.5 block w-full truncate rounded border-l-2 border-vip bg-vip/12 px-1 py-0.5 text-left text-[10.5px] font-semibold leading-tight text-vip lg:text-[11px]"
                :title="`Acara EMS: ${x.nama}`"
                @click="emsBuka = x"
              >
                {{ x.nama }}
              </button>
              <button
                v-if="s.tgl && rsv[s.tgl]"
                type="button"
                class="block w-full truncate rounded border-l-2 border-success bg-success/10 px-1 py-0.5 text-left text-[10.5px] font-semibold leading-tight text-success lg:text-[11px]"
                :title="`${rsv[s.tgl]!.jml} reservasi · ${rsv[s.tgl]!.pax} pax — klik untuk rinciannya`"
                @click="rsvBuka = s.tgl"
              >
                • {{ rsv[s.tgl]!.jml }} reservasi<span class="hidden lg:inline">{{ rsv[s.tgl]!.pax ? ` · ${rsv[s.tgl]!.pax} pax` : '' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </AppPanel>
    </MarketingGerbang>

    <ResponsiveSheet
      v-model:open="evSheet"
      :title="evBuka?.nama ?? ''"
      :description="evBuka ? `${evBuka.jenis || 'Event'} · ${fTgl(evBuka.tanggal)}` : ''"
    >
      <template v-if="evBuka && uang">
        <AppStatus
          :color="warnaStatusMkt(evBuka.status)"
          :icon="ikonStatusMkt(evBuka.status)"
          class="mb-3"
        >
          {{ evBuka.status }}
        </AppStatus>
        <dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt class="text-muted">
            Client
          </dt>
          <dd>{{ namaClient(evBuka.clientId) }}</dd>
          <dt class="text-muted">
            PIC Marketing
          </dt>
          <dd>{{ namaUser(evBuka.mktPIC) }}</dd>
          <dt class="text-muted">
            Jam
          </dt>
          <dd>{{ jam || '—' }}</dd>
          <dt class="text-muted">
            Estimasi Tamu
          </dt>
          <dd>{{ evBuka.pax || d.pax || '—' }} pax</dd>
          <template v-if="d.area">
            <dt class="text-muted">
              Lantai / Area
            </dt>
            <dd>{{ d.area }}</dd>
          </template>
          <template v-if="d.privacy">
            <dt class="text-muted">
              Sifat Acara
            </dt>
            <dd>{{ d.privacy }}</dd>
          </template>
          <dt class="text-muted">
            Grand Total
          </dt>
          <dd class="num">
            {{ rupiah(uang.grand) }}
          </dd>
          <template v-if="pakaiDp(evBuka) && uang.dp">
            <dt class="text-muted">
              {{ dpLabel(uang) }}
            </dt>
            <dd class="num">
              {{ rupiah(uang.dp) }}
            </dd>
          </template>
        </dl>
      </template>
      <template #footer>
        <UButton
          label="Buka Detail Event"
          icon="i-lucide-chevron-right"
          @click="router.push(`/marketing/event/${evBuka?.id}`)"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="outline"
          @click="evBuka = null"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="emsSheet"
      :title="emsBuka?.nama ?? ''"
      description="Acara dari modul Event (EMS) · hanya bisa dilihat di sini"
    >
      <dl
        v-if="emsBuka"
        class="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm"
      >
        <dt class="text-muted">
          Tanggal
        </dt>
        <dd>{{ tglMkt(emsBuka.tgl) }}</dd>
        <dt class="text-muted">
          Lokasi
        </dt>
        <dd>{{ emsBuka.venue || '—' }}</dd>
        <dt class="text-muted">
          Kategori
        </dt>
        <dd>{{ emsBuka.kategori || '—' }}</dd>
        <dt class="text-muted">
          Status
        </dt>
        <dd>{{ emsBuka.status || '—' }}</dd>
        <dt class="text-muted">
          PIC
        </dt>
        <dd>{{ emsBuka.pic || '—' }}</dd>
      </dl>
      <p class="mt-3 text-xs text-muted">
        Tanggal ini sudah dipakai acara internal. Untuk mengubahnya, buka modul Event.
      </p>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="outline"
          @click="emsBuka = null"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="rsvSheet"
      :title="rsvBuka ? fTgl(rsvBuka) : ''"
      :description="rsvBuka && rsv[rsvBuka] ? `Reservasi · ${rsv[rsvBuka]!.jml} booking · ${rsv[rsvBuka]!.pax} pax` : ''"
    >
      <ul
        v-if="rsvBuka && rsv[rsvBuka]"
        class="divide-y divide-default"
      >
        <li
          v-for="(r, i) in rsv[rsvBuka]!.baris"
          :key="i"
          class="flex items-center gap-3 py-2 text-sm"
        >
          <span class="num w-12 text-muted">{{ r.jam || '—' }}</span>
          <span class="min-w-0 flex-1">
            <b>{{ r.nama }}</b>
            <UBadge
              v-if="r.vip"
              label="VIP"
              size="sm"
              variant="soft"
              class="ml-1"
            />
            <span class="block text-xs text-muted">Meja {{ r.meja || '—' }} · {{ r.status || '—' }}</span>
          </span>
          <span class="num text-muted">{{ r.pax || '—' }} pax</span>
        </li>
      </ul>
      <template #footer>
        <UButton
          label="Buka Modul Reservasi"
          to="/reservasi/dashboard"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="outline"
          @click="rsvBuka = null"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
