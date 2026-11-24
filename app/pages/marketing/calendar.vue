<!--
  Marketing › Kalender (old renderCalendar, deploy/marketing/index.html:12326-12438;
  marketing.md D.6). Month grid starting Sunday like the old one; three bands:
  Marketing events (gold, multi-day events on every day they touch), EMS
  events from the Event module (violet, read-only) and Reservasi (green; one
  line per day: bookings · pax, cancelled/no-show left out). The frame, cards
  and colours are the shared KalenderBulan / KalenderKartu / kalender-warna;
  a deal (Marketing Deal/Confirmed, EMS Upcoming/Today) only gets a green dot. Status filter defaults to
  "everything except Lost"; the header shows the month's pax with the same
  filter.

  Clicking an empty spot of a day opens Event Baru on that date, and a
  Marketing event can be dragged to another day (desktop; owner request,
  Nov 2026). A multi-day event keeps its length; locked tables stay on the
  old date until they are locked again, so the move asks first.

  The EMS and Reservasi bands are read without waiting and may fail on their
  own (their module not held, offline): the Marketing events still draw, a
  warning with "Coba lagi" says what is missing — as before.
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import { eventPadaTgl, jenisEvent, tglMkt } from '~/utils/marketing'
import { dpLabel, eventFinance } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { fTgl, hariIni, rupiah } from '~/utils/format'
import { geserTgl, hariKe, rentangBulan } from '~/utils/kalender'
import { SUMBER_KALENDER, adalahDeal } from '~/utils/kalender-warna'
import { listReservations } from '~/composables/useReservasi'
import { mejaTerkunciMkt } from '~/utils/marketing-event'

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
const rentang = computed(() => rentangBulan(bulan.value))

const lolos = (e: EventMkt) => (status.value ? e.status === status.value : e.status !== 'Lost')
const evTgl = (tgl: string) => (tgl ? st.value.events.filter(e => eventPadaTgl(e, tgl) && lolos(e)) : [])
/** Pax this month, same status filter (calTotalPax :12407-12413). */
const paxBulan = computed(() => st.value.events
  .filter(e => String(e.tanggal ?? '').slice(0, 7) === bulan.value && lolos(e))
  .reduce((a, e) => a + (+(e.pax ?? 0) || 0), 0))

// ---- EMS (read-only) ----
const { data: ems, error: emsErr, refresh: emsUlang } = useAsyncData('mkt-cal-ems', () => getAcaraEms(geserTgl(rentang.value.a, -31), rentang.value.b).then(l => l.filter(x => x.hari.some(t => t >= rentang.value.a && t <= rentang.value.b))), { watch: [rentang], default: () => [], server: false })
const emsTgl = (tgl: string) => (tgl ? ems.value.filter(x => x.hari.includes(tgl)) : [])

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

// ---- create on a day, drag to another day ----
const { can } = useAksesMkt()
const bolehUbah = computed(() => can('edit_event'))
const baruBuka = ref(false)
const baruTgl = ref('')
function buatDi(tgl: string) {
  if (!tgl || !bolehUbah.value) return
  baruTgl.value = tgl
  baruBuka.value = true
}

// KalenderBulan reports the drop; the confirmation and the write are decided here.
async function lepasDi({ id, dari, ke: tgl }: { id: string, dari: string, ke: string }) {
  const e = st.value.events.find(x => x.id === id)
  if (!e || !tgl || tgl === dari) return
  const geserHari = hariKe(tgl) - hariKe(dari)
  const mulai = geserTgl(String(e.tanggal), geserHari)
  const selesai = e.tanggalSelesai ? geserTgl(e.tanggalSelesai, geserHari) : ''
  const kunci = mejaTerkunciMkt(e).length
  const tanya = `Pindahkan "${e.nama}" ke ${fTgl(mulai)}${selesai && selesai !== mulai ? ` – ${fTgl(selesai)}` : ''}?`
    + (kunci
      ? `

Meja yang sudah dikunci di Reservasi masih di tanggal lama. Kunci ulang dari detail event setelah pindah.`
      : '')
  if (!confirm(tanya)) return
  const patch: Partial<EventMkt> = { tanggal: mulai }
  if (e.tanggalSelesai) patch.tanggalSelesai = selesai
  if (e.detail && 'tanggal' in e.detail) patch.detail = { ...e.detail, tanggal: mulai, ...(e.tanggalSelesai && 'tanggalSelesai' in e.detail ? { tanggalSelesai: selesai } : {}) }
  await mktSimpan(() => tambalMkt<EventMkt>('events', e.id, patch, e.updatedAt), 'Tanggal event dipindah',
    { refType: 'event', refId: e.id, action: 'Tanggal event dipindah (kalender)', detail: `${e.tanggal} → ${mulai}` })
}
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
      <KalenderNav v-model="bulan" />
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

      <KalenderBulan
        v-model:bulan="bulan"
        :boleh-klik="bolehUbah"
        :boleh-seret="bolehUbah"
        judul-klik="Klik untuk buat event di tanggal ini"
        legenda-deal
        @klik-tgl="buatDi"
        @lepas="lepasDi"
      >
        <template #legenda>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.marketing.swatch"
          />Event Marketing</span>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.ems.swatch"
            title="EMS = Event Management System (modul Event)"
          />Acara EMS{{ ems.length ? ` (${ems.length})` : '' }}</span>
          <span class="flex items-center gap-1.5"><span
            class="h-3 w-1 rounded-none"
            :class="SUMBER_KALENDER.reservasi.swatch"
          />Reservasi{{ Object.keys(rsv).length ? ` (${Object.keys(rsv).length} hari)` : '' }}</span>
        </template>
        <template #total>
          {{ paxBulan.toLocaleString('id-ID') }} pax bulan ini
        </template>
        <template #sel="{ tgl }">
          <KalenderKartu
            v-for="e in evTgl(tgl)"
            :key="e.id"
            sumber="marketing"
            :judul="e.nama"
            :deal="adalahDeal('marketing', e.status)"
            :kanan="e.pax ? `${e.pax} pax` : ''"
            :title="`${e.nama} — ${jenisEvent(e)}${e.pax ? ` · ${e.pax} pax` : ''}`"
            :seret-id="e.id"
            :tgl="tgl"
            @klik="evBuka = e"
          />
          <KalenderKartu
            v-for="x in emsTgl(tgl)"
            :key="x.id"
            sumber="ems"
            :judul="x.nama"
            :deal="adalahDeal('ems', x.status)"
            :title="`Acara EMS: ${x.nama}`"
            @klik="emsBuka = x"
          />
          <KalenderKartu
            v-if="rsv[tgl]"
            sumber="reservasi"
            :title="`${rsv[tgl]!.jml} reservasi · ${rsv[tgl]!.pax} pax — klik untuk rinciannya`"
            @klik="rsvBuka = tgl"
          >
            {{ rsv[tgl]!.jml }} reservasi<span class="hidden lg:inline">{{ rsv[tgl]!.pax ? ` · ${rsv[tgl]!.pax} pax` : '' }}</span>
          </KalenderKartu>
        </template>
      </KalenderBulan>
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
        <dd>{{ tglMkt(emsBuka.tgl) }}{{ emsBuka.hari.length > 1 ? ` – ${tglMkt(emsBuka.hari.at(-1)!)}` : '' }}</dd>
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
    <MarketingEventBaru
      v-model:open="baruBuka"
      :tanggal-awal="baruTgl"
    />
  </AppPage>
</template>
