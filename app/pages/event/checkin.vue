<!--
  Check-In (Hari H) — event picker, three stat cards, live seat summary,
  QR token check and the guest list (`event/index.html:10086-10728`).

  Camera scanning uses the browser's own BarcodeDetector (no library), as the
  old `toggleKamera` did; without it the token is pasted.
  Cancelling posts a correction row `{batalDari}` (G-10, append-only — the old
  "Batalkan" deleted the row instead); presence is newest-wins per ticket_id,
  so a ticket whose latest row is a cancellation counts as not checked in.
  Occupancy = masuk/tickets (`:10374`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Acara, Checkin, KelasTiket, Kursi, OrderTiket, Tiket } from '~/composables/useEvent'
import { batalCheckin, listCheckins, postCheckin, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka } from '~/utils/format'

import { checkinTerbaru as terbaruPerTiket, eventTiket as eventDariTiket, fmtTglJamEms, idCheckin as idHadir } from '~/utils/event-hitung'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('checkin', peranEvent(me.value)))

const { data: daftarAcara } = useDaftarEvent<Acara>('events', {}, 'event-checkin-events')
const berTiket = computed(() => daftarAcara.value.rows.filter(e => e.is_ticketed))
const eventId = ref('')

watch(berTiket, (l) => {
  if (!eventId.value && l.length) eventId.value = l[0]!.id
}, { immediate: true })

const qTiket = computed<Record<string, string>>(() => (eventId.value ? { event_id: eventId.value } : { event_id: '__kosong__' }))
const { data: daftarTiket, status, refresh: refreshTiket } = useDaftarEvent<Tiket>('tickets', qTiket, 'event-checkin-tickets')
const { data: daftarKursi, refresh: refreshKursi } = useDaftarEvent<Kursi>('seats', qTiket, 'event-checkin-seats')
const { data: daftarKelas } = useDaftarEvent<KelasTiket>('ticket-classes', qTiket, 'event-checkin-classes')

/** First-load skeleton for the three check-in cards below: skeleton cells
 *  stand in until the first ticket list lands. Refetch keeps old numbers,
 *  so scanning never blanks the cards. */
const statMemuat = computed(() => !daftarTiket.value.rows.length && (status.value === 'pending' || status.value === 'idle'))

// The server ignores `event_id` on GET /tickets (API-side bug, see the Fase-3
// report): legacy rows carry no `event_id`, only `order_item_id`. Resolve the
// event through the order exactly like legacy `ciTiket` (`:10379-10382`),
// which also drops Cancelled tickets.
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', qTiket, 'event-checkin-orders')
const orderDariId = computed(() => new Map(daftarOrder.value.rows.map(o => [o.id, o])))
const eventTiket = (t: Tiket) => eventDariTiket(t, orderDariId.value)
const namaTamu = (t: Tiket) => String(
  (t as Record<string, unknown>).buyer_name
  ?? orderDariId.value.get(t.order_item_id ?? '')?.buyer_name
  ?? (t as Record<string, unknown>).name
  ?? t.qr_token
  ?? '—',
)

const checkins = ref<Awaited<ReturnType<typeof listCheckins>>['data']>([])
async function muatCheckin() {
  try {
    checkins.value = await listCheckins().then(r => r.data)
  }
  catch {
    // A failed poll must not blank the page; the manual reload shows the error.
  }
}
watch(eventId, muatCheckin, { immediate: true })

// Partial refresh every 20s so an open camera/scroll position survives (`:1623`)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      muatCheckin()
      refreshTiket()
      refreshKursi()
    }
  }, 20000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const tiket = computed(() => daftarTiket.value.rows.filter(t => (t.status ?? '') !== 'Cancelled' && (!eventId.value || eventTiket(t) === eventId.value)))
// Presence rule (contract `docs/api/event.md`, Check-ins): group the rows by
// ticket_id; the newest row wins (`checked_in_at`, then `id`). The ticket
// counts as checked in only when that row has NO `batalDari` — a ticket whose
// latest row is a cancellation counts as not checked in, even though the
// cancelled rows are still listed.
const checkinTerbaru = computed<Map<string, Checkin>>(() => terbaruPerTiket(checkins.value))
const idCheckin = computed(() => idHadir(checkins.value))
const masuk = computed(() => tiket.value.filter(t => idCheckin.value.has(t.id)).length)
const keterisian = computed(() => (tiket.value.length ? Math.round(masuk.value / tiket.value.length * 100) : 0))

// Live seat summary (the live map, as a list)
const kursiTerisi = computed(() => {
  const m = new Map<string, number>()
  for (const t of tiket.value) {
    if (t.seat_id && idCheckin.value.has(t.id)) m.set(t.seat_id, (m.get(t.seat_id) ?? 0) + 1)
  }
  return m
})

// --- guest rows (`ciBaris` :10403): class of THIS event, seat text, arrival time ---
const kelasEvent = computed(() => daftarKelas.value.rows.filter(c => c.event_id === eventId.value))
const kursiDariId = computed(() => new Map(daftarKursi.value.rows.map(k => [k.id, k])))
const namaKelas = (t: Tiket) => {
  const c = kelasEvent.value.find(x => x.id === t.ticket_class_id)
  if (c) return c.name
  return daftarKelas.value.rows.some(x => x.id === t.ticket_class_id) ? '(kategori event lain)' : '(kategori terhapus)'
}
/** seatTeks (:10842) */
function tempat(t: Tiket) {
  const s = t.seat_id ? kursiDariId.value.get(t.seat_id) : undefined
  if (!s) return 'Tanpa nomor tempat'
  const r = s as Record<string, unknown>
  const pax = Number((t as Record<string, unknown>).pax_total) || 0
  return `${String(r.seat_no || r.table_no || '')}${r.zone === 'Lantai 1' ? ` (Meja ${String(r.table_no ?? '')})` : ''}${pax > 1 ? ` · tamu ${Number((t as Record<string, unknown>).pax_no) || 0} dari ${pax}` : ''}`
}
const hpTamu = (t: Tiket) => String(orderDariId.value.get(t.order_item_id ?? '')?.phone ?? '')
const jamMasuk = (t: Tiket) => {
  const c = checkinTerbaru.value.get(t.id)
  return c && !c.batalDari ? fmtTglJamEms(c.checked_in_at) : ''
}
const nomorTiket = (t: Tiket) => String((t as Record<string, unknown>).ticket_number ?? '')

// --- guest list (`ciTabelHTML` :10424): chips with counts, category filter, search, pager 10 ---
const chip = ref<'belum' | 'sudah' | 'semua'>('belum')
// Reka's SelectItem refuses an empty value, so "all categories" is a sentinel
const SEMUA = '__semua__'
const fKelas = ref(SEMUA)
const cari = ref('')
const hal = ref(1)
const PER_HAL = 10
const nBelum = computed(() => tiket.value.filter(t => !idCheckin.value.has(t.id)).length)
const nSudah = computed(() => tiket.value.length - nBelum.value)
const CHIPS = computed(() => [
  { value: 'belum', label: `Belum datang ${nBelum.value}` },
  { value: 'sudah', label: `Sudah datang ${nSudah.value}` },
  { value: 'semua', label: `Semua ${tiket.value.length}` },
] as { value: 'belum' | 'sudah' | 'semua', label: string }[])
const lolosChip = (t: Tiket) => chip.value === 'semua' || (chip.value === 'sudah') === idCheckin.value.has(t.id)
/** ciPilihKelasHTML (:10443): only with 2+ categories, counts follow the chip */
const pilihanKelas = computed(() => {
  const semua = [...new Set(tiket.value.map(namaKelas))].sort()
  if (semua.length < 2) return []
  const src = tiket.value.filter(lolosChip)
  return [
    { value: SEMUA, label: `Semua kategori (${src.length})` },
    ...semua.map(k => ({ value: k, label: `${k} (${src.filter(t => namaKelas(t) === k).length})` })),
  ]
})
const daftar = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return tiket.value.filter(t => lolosChip(t)
    && (fKelas.value === SEMUA || namaKelas(t) === fKelas.value)
    && (!q || `${namaTamu(t)} ${nomorTiket(t)} ${tempat(t)} ${hpTamu(t)}`.toLowerCase().includes(q)))
})
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.length / PER_HAL)))
const halaman = computed(() => daftar.value.slice((hal.value - 1) * PER_HAL, hal.value * PER_HAL))
watch([chip, fKelas, cari], () => {
  hal.value = 1
})
watch(maxHal, (m) => {
  hal.value = Math.min(hal.value, m)
})
const kosongDaftar = computed(() => {
  const kls = fKelas.value !== SEMUA ? ` di kategori ${fKelas.value}` : ''
  if (cari.value.trim()) return `Tidak ada yang cocok dengan "${cari.value.trim()}"${kls}.`
  return chip.value === 'belum' ? `Semua tamu${kls} sudah datang. 🎉` : `Belum ada yang check-in${kls}.`
})
/** ciHitungSemuaHTML / ciHitungKelasHTML (:10487, :10530): arrived vs waiting, per category */
const hitungKat = computed(() => {
  const per = new Map<string, { n: number, masuk: number }>()
  for (const t of tiket.value) {
    const k = namaKelas(t)
    const v = per.get(k) ?? { n: 0, masuk: 0 }
    v.n++
    if (idCheckin.value.has(t.id)) v.masuk++
    per.set(k, v)
  }
  const baris = [...per.entries()].map(([nama, v]) => ({ nama, ...v, pct: v.n ? Math.round(v.masuk / v.n * 100) : 0 }))
    .sort((a, b) => b.n - a.n)
  return { baris, total: tiket.value.length, masuk: masuk.value, pct: keterisian.value }
})
const katAktif = computed(() => hitungKat.value.baris.find(b => b.nama === fKelas.value) ?? null)

const kolom: TableColumn<Tiket>[] = [
  { id: 'tamu', header: 'Tamu' },
  { id: 'tiket', header: 'Tiket' },
  { id: 'tempat', header: 'Tempat' },
  { id: 'kelas', header: 'Kelas' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
]
async function checkin(t: Tiket) {
  try {
    await postCheckin({ ticket_id: t.id, result: 'Valid' })
    toast.add({ title: `✓ ${namaTamu(t)} masuk`, color: 'success' })
    await Promise.all([muatCheckin(), refreshTiket()])
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatCheckin))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}

// --- cancellation (`batalCheckin :10707`, confirm `batalCheckinYakin :10717`).
// Legacy deleted the row; v1 appends a correction row, so confirm first —
// a wrong tap revokes a real guest's arrival proof. Afterwards the ticket
// status is re-read (presence recomputes newest-wins). ---
const batalTarget = ref<Tiket | null>(null)
const batalSedang = ref(false)
function mintaBatal(t: Tiket) {
  batalTarget.value = t
}
async function batalkan() {
  const t = batalTarget.value
  if (!t) return
  const terbaru = checkinTerbaru.value.get(t.id)
  if (!terbaru || terbaru.batalDari) {
    toast.add({ title: 'Tiket ini memang belum check-in.', color: 'error' })
    batalTarget.value = null
    return
  }
  batalSedang.value = true
  try {
    await batalCheckin({ batalDari: terbaru.id, ticket_id: t.id })
    toast.add({ title: `Check-in ${namaTamu(t)} dibatalkan.`, color: 'success' })
    batalTarget.value = null
    await Promise.all([muatCheckin(), refreshTiket()])
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatCheckin))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    batalSedang.value = false
  }
}

// --- scan (`konfirmasiScan` :10811): three answers, only one runs on its own.
// Unknown → red; already in → amber with the arrival time; valid → checked in
// at once (scanning IS the gate keeper's decision), green card, scanning resumes.
const token = ref('')
type HasilScan = { jenis: 'asing' } | { jenis: 'sudah', t: Tiket } | { jenis: 'masuk', t: Tiket, jam: string }
const hasilScan = ref<HasilScan | null>(null)
async function prosesToken(v: string) {
  const tk = daftarTiket.value.rows.find(t => t.qr_token === v)
  if (!tk || (tk.status ?? '') === 'Cancelled' || eventTiket(tk) !== eventId.value) {
    hasilScan.value = { jenis: 'asing' }
    return false
  }
  if (idCheckin.value.has(tk.id)) {
    hasilScan.value = { jenis: 'sudah', t: tk }
    return false
  }
  if (!bolehUbah.value) {
    toast.add({ title: 'Peran ini hanya bisa melihat — check-in dicatat petugas.', color: 'error' })
    return false
  }
  const ok = await checkin(tk)
  if (ok) {
    hasilScan.value = { jenis: 'masuk', t: tk, jam: fmtTglJamEms(new Date().toISOString()) }
    if (navigator.vibrate) navigator.vibrate([40, 40, 80])
  }
  return ok
}
function cekToken() {
  const v = token.value.trim()
  if (!v) {
    toast.add({ title: 'Tempel token dulu.', color: 'error' })
    return
  }
  prosesToken(v)
}

// --- camera (`toggleKamera` :10757): the browser's own BarcodeDetector, no library.
// Without it the camera still runs as an aiming aid and the token is typed.
const video = ref<HTMLVideoElement | null>(null)
const kameraNyala = ref(false)
let stream: MediaStream | null = null
let loop: ReturnType<typeof setInterval> | null = null
let detektor: { detect: (v: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } | null = null
let terakhir = ''
let sibuk = false
async function toggleKamera() {
  if (stream) return matikanKamera()
  if (!navigator.mediaDevices?.getUserMedia) {
    toast.add({ title: 'Browser ini tidak mendukung akses kamera.', color: 'error' })
    return
  }
  if (!window.isSecureContext) {
    toast.add({ title: 'Kamera hanya bisa lewat HTTPS. Buka situsnya dengan https://', color: 'error' })
    return
  }
  try {
    // facingMode environment = the back camera on phones; ignored on laptops
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  }
  catch (e) {
    const n = (e as Error).name
    toast.add({
      title: n === 'NotAllowedError'
        ? 'Izin kamera ditolak. Aktifkan lewat ikon gembok di address bar.'
        : n === 'NotFoundError' ? 'Tidak ada kamera yang terdeteksi.' : `Kamera gagal dibuka: ${(e as Error).message}`,
      color: 'error',
    })
    return
  }
  kameraNyala.value = true
  await nextTick()
  if (video.value) {
    video.value.srcObject = stream
    await video.value.play().catch(() => {})
  }
  const BD = (window as unknown as { BarcodeDetector?: new (o?: unknown) => typeof detektor }).BarcodeDetector
  if (BD) {
    // QR and 1D barcodes both — unsupported formats are ignored by the browser
    try {
      detektor = new BD({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'codabar', 'itf', 'upc_a', 'upc_e'] })
    }
    catch {
      try {
        detektor = new BD()
      }
      catch {
        detektor = null
      }
    }
  }
  if (!detektor) toast.add({ title: 'Kamera menyala. Browser ini belum bisa membaca QR sendiri — ketik tokennya di bawah.', color: 'warning' })
  else loop = setInterval(bacaFrame, 350)
}
function matikanKamera() {
  if (loop) clearInterval(loop)
  loop = null
  detektor = null
  terakhir = ''
  stream?.getTracks().forEach(t => t.stop())
  stream = null
  kameraNyala.value = false
}
async function bacaFrame() {
  const v = video.value
  // one read at a time: detect() can take longer than the interval on mid-range phones
  if (!v || !detektor || v.readyState < 2 || sibuk) return
  sibuk = true
  let hasil: { rawValue?: string }[] = []
  try {
    hasil = await detektor.detect(v)
  }
  catch {
    return
  }
  finally {
    sibuk = false
  }
  const tok = String(hasil[0]?.rawValue ?? '').trim()
  if (!tok || tok === terakhir) return
  terakhir = tok
  if (navigator.vibrate) navigator.vibrate(60)
  if (loop) clearInterval(loop)
  loop = null
  await prosesToken(tok)
  // pause while the answer is read, then scan on
  setTimeout(() => {
    terakhir = ''
    if (stream && detektor && !loop) loop = setInterval(bacaFrame, 350)
  }, 1200)
}
onBeforeUnmount(matikanKamera)
</script>

<template>
  <EventGerbang lihat="checkin">
    <AppPage
      title="Check-in (hari H)"
      description="Scan QR · kursi terisi langsung"
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-muted">Event:</span>
        <USelect
          v-model="eventId"
          :items="berTiket.map(e => ({ value: e.id, label: e.title }))"
          placeholder="Pilih event"
          class="w-64"
        />
      </div>

      <AppStatGrid
        class="mb-4"
        :loading="statMemuat"
        :count="3"
      >
        <AppStat
          label="Total Tiket"
          :value="angka(tiket.length)"
          sub="valid"
          icon="i-lucide-ticket"
          tone="info"
        />
        <AppStat
          label="Checked-In"
          :value="angka(masuk)"
          sub="sudah datang"
          icon="i-lucide-scan-line"
          tone="success"
        />
        <AppStat
          label="Keterisian"
          :value="`${keterisian}%`"
          sub="live"
          icon="i-lucide-armchair"
          tone="gold"
        />
      </AppStatGrid>

      <AppPanel
        title="Kursi terisi langsung"
        icon="i-lucide-armchair"
        class="mb-4"
      >
        <p
          v-if="!daftarKursi.rows.length"
          class="py-3 text-center text-sm text-muted"
        >
          Event ini standing (tanpa seat map).
        </p>
        <template v-else>
          <p class="mb-2 text-xs text-muted num">
            {{ angka(kursiTerisi.size) }} kursi terisi dari {{ angka(daftarKursi.rows.length) }} titik denah
          </p>
          <ul
            v-if="kursiTerisi.size"
            class="max-h-56 space-y-1 overflow-y-auto text-sm"
          >
            <li
              v-for="[sid, n] in [...kursiTerisi.entries()].slice(0, 30)"
              :key="sid"
              class="flex justify-between rounded-field bg-success/12 px-2.5 py-1"
            >
              <b class="text-success">{{ String((kursiDariId.get(sid) as Record<string, unknown> | undefined)?.table_no ?? sid) }}</b>
              <span class="text-muted num">{{ n }} masuk</span>
            </li>
          </ul>
          <p
            v-else
            class="py-4 text-center text-sm text-dimmed"
          >
            Belum ada kursi terisi.
          </p>
        </template>
      </AppPanel>

      <AppPanel
        title="Scanner QR"
        icon="i-lucide-scan-line"
      >
        <p class="mb-3 text-xs text-muted">
          Nyalakan kamera lalu arahkan ke QR tamu — di HP otomatis memakai kamera belakang. QR yang sah langsung dicatat masuk. Kalau QR-nya rusak atau layar tamu mati, tokennya bisa ditempel di bawah.
        </p>
        <div
          v-if="kameraNyala"
          class="relative mb-3 overflow-hidden rounded-field bg-black"
        >
          <video
            ref="video"
            playsinline
            muted
            class="mx-auto max-h-80 w-full object-cover"
          />
          <div class="pointer-events-none absolute inset-[18%] rounded-field border-2 border-primary-300" />
        </div>
        <UButton
          color="primary"
          :icon="kameraNyala ? 'i-lucide-square' : 'i-lucide-camera'"
          class="mb-3"
          @click="toggleKamera()"
        >
          {{ kameraNyala ? 'Matikan kamera' : 'Nyalakan kamera' }}
        </UButton>
        <UInput
          v-model="token"
          placeholder="…atau tempel QR token di sini"
          class="mb-2 w-full"
        />
        <UButton
          color="neutral"
          variant="outline"
          @click="cekToken()"
        >
          Cek token ini
        </UButton>

        <div
          v-if="hasilScan"
          class="mt-4"
        >
          <UAlert
            v-if="hasilScan.jenis === 'asing'"
            color="error"
            variant="soft"
            icon="i-lucide-x"
            title="Tiket tidak valid"
            description="QR tidak dikenal atau tiketnya sudah dibatalkan."
          />
          <div
            v-else
            class="rounded-panel border p-3 text-sm"
            :class="hasilScan.jenis === 'masuk' ? 'border-success' : 'border-warning'"
          >
            <h3
              class="mb-2 font-bold"
              :class="hasilScan.jenis === 'masuk' ? 'text-success' : 'text-warning'"
            >
              {{ hasilScan.jenis === 'masuk' ? `✓ ${namaTamu(hasilScan.t)} masuk` : '⚠ Sudah check-in sebelumnya' }}
            </h3>
            <dl class="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1">
              <template v-if="hasilScan.jenis === 'sudah'">
                <dt class="text-muted">
                  Nama
                </dt>
                <dd><b>{{ namaTamu(hasilScan.t) }}</b></dd>
              </template>
              <dt class="text-muted">
                Tiket
              </dt>
              <dd>{{ nomorTiket(hasilScan.t) || '—' }}</dd>
              <dt class="text-muted">
                Class
              </dt>
              <dd>{{ namaKelas(hasilScan.t) }}</dd>
              <dt class="text-muted">
                Tempat
              </dt>
              <dd>{{ tempat(hasilScan.t) }}</dd>
              <dt class="text-muted">
                Jam
              </dt>
              <dd>{{ hasilScan.jenis === 'masuk' ? hasilScan.jam : (jamMasuk(hasilScan.t) || '—') }}</dd>
            </dl>
            <p
              v-if="hasilScan.jenis === 'sudah'"
              class="mt-2 text-xs text-muted"
            >
              QR ini sudah dipakai masuk. Jangan diloloskan lagi tanpa pengecekan — bisa jadi tiketnya diteruskan ke orang lain.
            </p>
            <UButton
              v-if="bolehUbah"
              color="neutral"
              variant="outline"
              size="sm"
              class="mt-2"
              @click="mintaBatal(hasilScan.t)"
            >
              {{ hasilScan.jenis === 'masuk' ? 'Salah orang — batalkan' : 'Tadi salah pindai — batalkan' }}
            </UButton>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Daftar tamu"
        icon="i-lucide-clipboard-list"
        flush
        class="mt-4"
      >
        <div class="flex flex-wrap items-center gap-2 px-4 pt-3">
          <AppChips
            v-model="chip"
            :options="CHIPS"
          />
          <USelect
            v-if="pilihanKelas.length"
            v-model="fKelas"
            :items="pilihanKelas"
            class="w-52"
          />
          <UInput
            v-model="cari"
            placeholder="Cari nama / no. tiket / kursi…"
            icon="i-lucide-search"
            class="min-w-44 flex-1"
          />
        </div>

        <div
          v-if="katAktif || hitungKat.baris.length > 1"
          class="mx-4 mt-3 rounded-panel border border-default p-3 text-sm"
        >
          <template v-if="katAktif">
            <div class="flex flex-wrap items-center gap-3">
              <b>{{ katAktif.nama }}</b>
              <span class="text-success"><b class="num">{{ katAktif.masuk }}</b> sudah masuk</span>
              <span class="text-warning"><b class="num">{{ katAktif.n - katAktif.masuk }}</b> belum datang</span>
              <span class="text-xs text-muted">dari {{ katAktif.n }} tiket · {{ katAktif.pct }}%</span>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full bg-success"
                :style="{ width: `${katAktif.pct}%` }"
              />
            </div>
          </template>
          <template v-else>
            <div class="flex flex-wrap items-center gap-3">
              <b>Semua kategori</b>
              <span class="text-success"><b class="num">{{ hitungKat.masuk }}</b> sudah masuk</span>
              <span class="text-warning"><b class="num">{{ hitungKat.total - hitungKat.masuk }}</b> belum datang</span>
              <span class="text-xs text-muted">dari {{ hitungKat.total }} tiket · {{ hitungKat.pct }}%</span>
            </div>
            <button
              v-for="b in hitungKat.baris"
              :key="b.nama"
              type="button"
              class="mt-2 block w-full text-left"
              :title="`Klik untuk menyaring ke ${b.nama}`"
              @click="fKelas = b.nama"
            >
              <span class="flex flex-wrap items-center gap-3 text-xs">
                <span class="min-w-24 font-semibold">{{ b.nama }}</span>
                <span><b class="text-success num">{{ b.masuk }}</b> masuk</span>
                <span><b class="text-warning num">{{ b.n - b.masuk }}</b> belum</span>
                <span class="ms-auto text-muted">{{ b.pct }}% dari {{ b.n }}</span>
              </span>
              <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  class="block h-full bg-success"
                  :style="{ width: `${b.pct}%` }"
                />
              </span>
            </button>
          </template>
        </div>

        <p
          v-if="!daftar.length && status !== 'pending'"
          class="px-4 py-8 text-center text-sm text-muted"
        >
          {{ kosongDaftar }}
        </p>
        <template v-else>
          <UTable
            :columns="kolom"
            :data="halaman"
            :loading="status === 'pending'"
            class="mt-3 hidden lg:block"
          >
            <template #tamu-cell="{ row }">
              <b class="block text-highlighted">{{ namaTamu(row.original) }}</b>
              <span
                v-if="hpTamu(row.original)"
                class="block text-xs text-muted"
              >{{ hpTamu(row.original) }}</span>
            </template>
            <template #tiket-cell="{ row }">
              <span class="font-mono text-xs">{{ nomorTiket(row.original) }}</span>
            </template>
            <template #tempat-cell="{ row }">
              <span class="text-xs">{{ tempat(row.original) }}</span>
            </template>
            <template #kelas-cell="{ row }">
              <span class="text-xs">{{ namaKelas(row.original) }}</span>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="idCheckin.has(row.original.id) ? 'success' : 'neutral'"
                :icon="idCheckin.has(row.original.id) ? 'i-lucide-check' : 'i-lucide-clock'"
                size="sm"
              >
                {{ idCheckin.has(row.original.id) ? 'Sudah datang' : 'Belum datang' }}
              </AppStatus>
              <span
                v-if="jamMasuk(row.original)"
                class="block text-xs text-muted"
              >{{ jamMasuk(row.original) }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                v-if="bolehUbah && !idCheckin.has(row.original.id)"
                color="primary"
                size="sm"
                @click="checkin(row.original)"
              >
                Check-in
              </UButton>
              <UButton
                v-else-if="bolehUbah"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="mintaBatal(row.original)"
              >
                Batalkan
              </UButton>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="t in halaman"
              :key="t.id"
              class="flex items-center gap-2 px-4 py-2.5"
            >
              <span class="min-w-0 flex-1">
                <b class="block truncate text-sm text-highlighted">{{ namaTamu(t) }}</b>
                <span class="block truncate text-xs text-muted">{{ namaKelas(t) }} · {{ tempat(t) }}</span>
                <span
                  v-if="jamMasuk(t)"
                  class="block text-xs text-success"
                >Masuk {{ jamMasuk(t) }}</span>
              </span>
              <UButton
                v-if="bolehUbah && !idCheckin.has(t.id)"
                color="primary"
                size="sm"
                @click="checkin(t)"
              >
                Check-in
              </UButton>
              <UButton
                v-else-if="bolehUbah"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="mintaBatal(t)"
              >
                Batalkan
              </UButton>
            </li>
          </ul>
          <div
            v-if="maxHal > 1"
            class="flex items-center justify-between px-4 py-3 text-xs text-muted"
          >
            <span class="num">{{ (hal - 1) * PER_HAL + 1 }}–{{ Math.min(hal * PER_HAL, daftar.length) }} dari {{ angka(daftar.length) }}</span>
            <span class="flex gap-1">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-chevron-left"
                :disabled="hal <= 1"
                @click="hal--"
              />
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-chevron-right"
                :disabled="hal >= maxHal"
                @click="hal++"
              />
            </span>
          </div>
        </template>
      </AppPanel>

      <ResponsiveSheet
        :open="batalTarget !== null"
        title="Batalkan check-in?"
        @update:open="(v: boolean) => { if (!v) batalTarget = null }"
      >
        <p class="text-sm text-muted">
          Kedatangan <b class="text-highlighted">{{ batalTarget ? namaTamu(batalTarget) : '' }}</b>
          dibatalkan, dan tiketnya kembali berlaku seperti belum dipakai.
          Jejak check-in tetap tersimpan.
        </p>
        <p class="mt-2 text-xs text-muted">
          Pakai ini kalau tadi salah orang atau salah pindai.
        </p>
        <template #footer>
          <UButton
            color="error"
            :loading="batalSedang"
            @click="batalkan()"
          >
            Ya, batalkan
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="batalTarget = null"
          >
            Tidak jadi
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
