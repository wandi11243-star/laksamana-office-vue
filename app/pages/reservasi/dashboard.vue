<!--
  Dashboard & Recap — one page, four tabs, one filter row (`:5205-5290`).
  The old screen split this into two pages (Dashboard + Recap) with the same
  filters and the same data, so filtering in one and switching lost it. Kept as
  one page here.

  Counting rules are the old ones, unchanged (`:5336-5355`):
    - No-show never counts towards pax — the guest did not come.
    - Pax that DID arrive is summed from the arrival waves, because a party may
      arrive in stages.
    - Capacity is always for ONE date (the map's date), never for the selected
      period: comparing a month of pax with a day's capacity produces "3400/512",
      which looks like a wildly overbooked venue.
    - Cancelled rows are dropped AFTER the other filters and their count is shown,
      because someone searching a name needs to be able to tell "not here" from
      "here but cancelled".

  No server paging exists (G-08), so the table pages in the browser.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi, Waitlist, WaTarget } from '~/composables/useReservasi'
import { createReservation, patchReservation, postAudit, putDenah, putSectionItem, useDaftarReservasi, useDenah, useSection, useSectionVersi } from '~/composables/useReservasi'
import { bolehAksi, roleReservasi } from '~/utils/layar/reservasi'
import { arrivedPax, buatIzinTumpang, fmtMenit, harihOccupancy, isSeated, remainingPax, sedangDialihkan, tablesOf } from '~/utils/kunci-meja'
import { dpTotal, normPhone, uid } from '~/utils/dp-reservasi'
import type { LayoutDenah } from '~/utils/venue-layouts'
import {
  adaDenahTanggal, allLayoutKeys, capDenah, capMax, cariMeja, dayTypeLayout,
  dayTypeLayout2, defaultDayTypeLt, denahTanggalBaru, getLayout, hasOverrideLt,
  keyTanggal, lantaiLayout, lantaiMap, layoutTanggal, kapasitasTanggal, layoutName, ltCfg,
  ovLantai, parseKeyTanggal,
} from '~/utils/venue-layouts'
import { angka, fmtRupiah, hariIni, normTime, rupiah, tglPendek, tambahHari } from '~/utils/format'
import { teksPanggilAntrean, waKirim, waSalin } from '~/utils/wa'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
const { master, versi: versiDenah, layouts: secLayouts, layoutOverrides: secOv1, layoutOverrides2: secOv2, layoutTanggal: secTgl } = useDenah()
const namaSaya = computed(() => me.value?.name ?? '')
const role = computed(() => roleReservasi(me.value))
const bolehEdit = computed(() => bolehAksi('input', role.value))

// --- the window ---------------------------------------------------------------
// The dashboard always draws the day-of map, so that date has to be inside the
// loaded window whatever period the table is filtered on.
const filter = reactive({
  mode: 'day' as 'day' | 'month' | 'year' | 'range' | 'all',
  date: hariIni(),
  month: hariIni().slice(0, 7),
  year: new Date().getFullYear(),
  from: hariIni(),
  to: hariIni(),
  fromHour: '',
  toHour: '',
  status: '',
  category: '',
  lantai: '',
  kursi: '',
  dp: '',
  pic: '',
  q: '',
})
const cari = ref('')
/** The map and the waiting list can only ever show ONE date. */
const tglDenah = ref(hariIni())
const tab = ref<'list' | 'calendar' | 'map' | 'wait'>('list')
const perTanggal = computed(() => tab.value === 'map' || tab.value === 'wait')

/** The calendar tab reads a whole month, so its first day joins the window while
 *  that tab is open — otherwise most of the grid would be empty (`:5296`). */
const dari = computed(() => {
  if (tab.value === 'calendar') return bulan.value ? `${bulan.value}-01` : hariIni()
  const dasar = filter.mode === 'month'
    ? `${filter.month}-01`
    : filter.mode === 'year'
      ? `${filter.year}-01-01`
      : filter.mode === 'range' && filter.from
        ? filter.from
        : filter.date
  return tambahHari(dasar, -1)
})
const sampai = computed(() => {
  if (tab.value === 'calendar') return bulan.value ? jumlahHariBulan(bulan.value) : hariIni()
  const akhir = filter.mode === 'month'
    ? `${filter.month}-31`
    : filter.mode === 'year'
      ? `${filter.year}-12-31`
      : filter.mode === 'range' && filter.to
        ? filter.to
        : filter.date
  return tambahHari(akhir, 1)
})

const { data: semua, refresh, status } = useDaftarReservasi(dari, sampai, 'reservasi-dashboard')

// --- filtering (`:5080-5104`, `:5793-5826`) ----------------------------------

const cariLower = computed(() => cari.value.trim().toLowerCase())

const saringan = computed(() => {
  const F = filter
  let r = [...(semua.value ?? [])]
  if (F.mode === 'day') r = r.filter(x => x.date === F.date)
  else if (F.mode === 'month') r = r.filter(x => x.date.slice(0, 7) === F.month)
  else if (F.mode === 'year') r = r.filter(x => x.date.slice(0, 4) === String(F.year))
  else if (F.mode === 'range' && F.from && F.to) r = r.filter(x => x.date >= F.from && x.date <= F.to)
  if (F.fromHour) r = r.filter(x => (x.time || '') >= F.fromHour)
  if (F.toHour) r = r.filter(x => (x.time || '') <= F.toHour)
  if (F.status) r = r.filter(x => x.status === F.status)
  if (F.category) r = r.filter(x => (x.category || '') === F.category)
  if (F.dp) r = r.filter(x => x.dpStatus === F.dp)
  if (F.pic) r = r.filter(x => (x.picName || '') === F.pic)
  if (F.q) {
    const q = F.q.toLowerCase()
    r = r.filter(x => x.name.toLowerCase().includes(q) || x.phone.includes(q))
  }
  // This tab's search also matches the TABLE NUMBER — on the floor that is what
  // gets typed most (`:5797-5801`).
  if (cariLower.value) {
    r = r.filter(x => x.name.toLowerCase().includes(cariLower.value)
      || x.phone.includes(cariLower.value)
      || tablesOf(x).some(t => t.toLowerCase().includes(cariLower.value)))
  }
  // Floor LAST: it is the only filter that has to look at the table->floor map,
  // so let the cheap field comparisons drop rows first. A booking with no table
  // (floor unknown) never passes — forcing it into a floor would show it in a
  // place that is not necessarily right.
  if (F.lantai) {
    const peta = lantaiMap()
    const mau = Number(F.lantai)
    r = r.filter((x) => {
      const lantais = new Set<number>()
      for (const id of tablesOf(x)) {
        const f = peta.get(id)
        if (f) lantais.add(f)
      }
      return lantais.has(mau)
    })
  }
  return r.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
})

/** Cancelled is dropped after the other filters, and counted (`:5807-5816`). */
const batal = computed(() => (filter.status !== 'Cancelled' ? saringan.value.filter(r => r.status === 'Cancelled').length : 0))
const list = computed(() => (filter.status !== 'Cancelled' ? saringan.value.filter(r => r.status !== 'Cancelled') : saringan.value))

/** The map and the queue only ever describe one day. */
const dayList = computed(() => (semua.value ?? []).filter(r => r.date === tglDenah.value && r.status !== 'Cancelled'))
const basis = computed(() => (perTanggal.value ? dayList.value : list.value))

// --- the six numbers (`:5336-5355`) ------------------------------------------

const totalPax = computed(() => basis.value.filter(r => r.status !== 'No-show').reduce((a, r) => a + (Number(r.pax) || 0), 0))
const paxDatang = computed(() => basis.value.filter(r => r.status === 'Datang').reduce((a, r) => a + arrivedPax(r), 0))
const dpYes = computed(() => basis.value.filter(r => r.dpStatus === 'Sudah').length)

/** Only unconfirmed bookings need chasing: once it is "Confirmed" (or the guest
 *  has arrived) the host has already spoken to them (`:3871-3876`). */
const perluFollowUp = computed(() => (semua.value ?? []).filter(r => r.date === hariIni() && r.status === 'Pending').length)

const { data: categories } = useSection<string[]>('categories')

const kap = computed(() => kapasitasTanggal(master.value, tglDenah.value))
const paxTgl = computed(() => (semua.value ?? [])
  .filter(r => r.date === tglDenah.value && !['Cancelled', 'No-show'].includes(r.status))
  .reduce((a, r) => a + (Number(r.pax) || 0), 0))
const pctKap = computed(() => (kap.value.pax ? Math.round(paxTgl.value / kap.value.pax * 100) : 0))

const namaPIC = computed(() => [...new Set((semua.value ?? []).map(r => r.picName).filter(Boolean))].sort((a, b) => a.localeCompare(b)))

const labelPeriode = computed(() => {
  if (filter.mode === 'day') return tglPendek(filter.date)
  if (filter.mode === 'month') return new Date(`${filter.month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  if (filter.mode === 'year') return String(filter.year)
  if (filter.mode === 'range') return `${tglPendek(filter.from)} – ${tglPendek(filter.to)}`
  return 'semua tanggal'
})

// --- pills (`:5458-5463`) ----------------------------------------------------

function setHari(n: number) {
  filter.mode = 'day'
  filter.date = tambahHari(hariIni(), n)
}
function set7Hari() {
  filter.mode = 'range'
  filter.from = hariIni()
  filter.to = tambahHari(hariIni(), 6)
}
function setBulanIni() {
  filter.mode = 'month'
  filter.month = hariIni().slice(0, 7)
}
const filterAktif = computed(() => filter.mode !== 'day' || filter.date !== hariIni() || !!filter.fromHour || !!filter.toHour
  || !!filter.status || !!filter.category || !!filter.lantai || !!filter.kursi || !!filter.dp || !!filter.pic || !!filter.q || !!cari.value)
function resetFilter() {
  Object.assign(filter, { mode: 'day', date: hariIni(), month: hariIni().slice(0, 7), year: new Date().getFullYear(), from: hariIni(), to: hariIni(), fromHour: '', toHour: '', status: '', category: '', lantai: '', kursi: '', dp: '', pic: '', q: '' })
  cari.value = ''
}

// --- the table (`:5467+`) -----------------------------------------------------

type Urut = keyof Reservasi | 'paxDatang' | 'dp'
const urut = ref<{ kolom: Urut, naik: boolean }>({ kolom: 'date', naik: true })
const hal = ref(1)
const perHal = ref(10)

const kolomUrut: { key: Urut, label: string, ambil: (r: Reservasi) => string | number }[] = [
  { key: 'date', label: 'Tanggal', ambil: r => `${r.date}${r.time}` },
  { key: 'name', label: 'Tamu', ambil: r => r.name },
  { key: 'pax', label: 'Pax', ambil: r => r.pax },
  { key: 'table', label: 'Meja', ambil: r => r.table },
  { key: 'dp', label: 'DP', ambil: r => dpTotal(r) },
  { key: 'status', label: 'Status', ambil: r => r.status },
]

const terurut = computed(() => {
  const k = kolomUrut.find(c => c.key === urut.value.kolom) ?? kolomUrut[0]!
  const arah = urut.value.naik ? 1 : -1
  return [...list.value].sort((a, b) => {
    const x = k.ambil(a)
    const y = k.ambil(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * arah
  })
})
const maxHal = computed(() => Math.max(1, Math.ceil(terurut.value.length / perHal.value)))
const halaman = computed(() => terurut.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([list, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

function urutkan(kolom: Urut) {
  urut.value = urut.value.kolom === kolom
    ? { kolom, naik: !urut.value.naik }
    : { kolom, naik: true }
}

const statusWarna: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  'Pending': 'warning',
  'Confirmed': 'success',
  'Datang': 'error',
  'Cancelled': 'neutral',
  'No-show': 'neutral',
}

/** The table and the phone list read the same rows (DESIGN.md). */
const kolom = computed<TableColumn<Reservasi>[]>(() => [
  { accessorKey: 'date', header: 'Tanggal', cell: ({ row }) => `${tglPendek(row.original.date)} ${row.original.time}` },
  { accessorKey: 'name', header: 'Tamu', cell: ({ row }) => row.original.name },
  { id: 'pax', header: 'Pax' },
  { accessorKey: 'table', header: 'Meja' },
  { id: 'dp', header: 'DP', cell: ({ row }) => rupiah(dpTotal(row.original)) },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
])

// --- the calendar (`:5573-5630`) ------------------------------------------------

/** "2026-09" -> "2026-09-30". Month arithmetic goes through Date because
 *  new Date('2026-02-30') silently rolls into March. */
function jumlahHariBulan(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
}

const bulan = ref(hariIni().slice(0, 7))
const kalenderStatus = ref('')

/** Left/right a month, without the Date rollover trap. */
function geserBulan(n: number) {
  const [y, m] = bulan.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + n, 1)
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const labelBulan = computed(() => new Date(`${bulan.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))

/** Reservations grouped by date, with the calendar's own status legend. Cancelled
 *  rows are left out when no status is chosen — the same as the table. */
const kalenderPerTanggal = computed(() => {
  const map = new Map<string, Reservasi[]>()
  for (const r of semua.value ?? []) {
    if (!r.date) continue
    if (kalenderStatus.value) {
      if (r.status !== kalenderStatus.value) continue
    }
    else if (r.status === 'Cancelled') continue
    const list = map.get(r.date) ?? []
    list.push(r)
    map.set(r.date, list)
  }
  for (const list of map.values()) list.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  return map
})

const kalenderDibatalkan = computed(() => (kalenderStatus.value ? 0 : (semua.value ?? []).filter(r => r.status === 'Cancelled').length))

/** The month's cells, Monday first, with the leading and trailing days of the
 *  neighbouring months greyed out (`:5578-5581`, `:5624-5628`). */
const selBulan = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const pertama = new Date(y!, m!, 1)
  const mundur = (pertama.getDay() + 6) % 7 // Monday is the first column
  const jumlah = new Date(y!, m!, 0).getDate()
  const sel: { tgl: string, num: number, dalam: boolean, list: Reservasi[] }[] = []
  const tambah = (t: Date, dalam: boolean) => {
    const tgl = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    sel.push({ tgl, num: t.getDate(), dalam, list: kalenderPerTanggal.value.get(tgl) ?? [] })
  }
  for (let i = mundur; i > 0; i--) {
    const d = new Date(y!, m! - 1, 0)
    d.setDate(d.getDate() - i + 1)
    tambah(d, false)
  }
  for (let d = 1; d <= jumlah; d++) tambah(new Date(y!, m!, d), true)
  const sisa = (7 - (sel.length % 7)) % 7
  for (let d = 1; d <= sisa; d++) tambah(new Date(y!, m! + 1, d), false)
  return sel
})

const paxHari = (list: Reservasi[]) => list.filter(r => r.status !== 'No-show').reduce((a, r) => a + (Number(r.pax) || 0), 0)

/** A click on a day switches to Daily for that date AND moves the map's date, so
 *  the map does not stay on the previous day (`:5608-5611`). */
function pilihTanggal(tgl: string) {
  filter.mode = 'day'
  filter.date = tgl
  tglDenah.value = tgl
  tab.value = 'list'
}

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

// --- the day-of map, its quick actions, and the poll (`:2045-2242`, `:3089-3156`) ---

const { data: dineEstMin } = useSection<number>('dineEstMin')
const { data: clashLeadMin } = useSection<number>('clashLeadMin')
// The envelope is kept, not just the value: a queue write needs the SECTION's
// own version, and a section write replaces the whole list.
const { data: waitlist, refresh: refreshWaitlist } = useSectionVersi<Waitlist[]>('waitlist')
const versiWaitlist = computed(() => versiDari(waitlist.value))

/** The master bits the seat rules need — never the 180/10 default by accident. */
const masterKunci = computed(() => ({
  ...master.value,
  dineEstMin: Number(dineEstMin.value) > 0 ? Number(dineEstMin.value) : undefined,
  clashLeadMin: Number(clashLeadMin.value) > 0 ? Number(clashLeadMin.value) : undefined,
}))
const dineEst = computed(() => (Number(dineEstMin.value) > 0 ? Number(dineEstMin.value) : 180))

const hariIniMap = computed(() => tglDenah.value === hariIni())
const layerMap = ref<1 | 2>(1)
const kunciL1 = computed(() => dayTypeLayout(master.value, tglDenah.value))
const kunciL2 = computed(() => dayTypeLayout2(master.value, tglDenah.value))
const denahTerpilih = computed(() => getLayout(master.value, layerMap.value === 2 ? kunciL2.value : kunciL1.value))
const namaDenah = computed(() => layoutName(master.value, layerMap.value === 2 ? kunciL2.value : kunciL1.value))

/** What is really taken now, and what is merely booked later (`:2129-2183`). */
const petaHari = computed(() => harihOccupancy(semua.value ?? [], { date: tglDenah.value, hariIni: hariIniMap.value, dineEst: dineEst.value }))
const antreanHari = computed(() => (waitlist.value?.data ?? [])
  .filter(w => w.status === 'waiting' && w.date === tglDenah.value)
  .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)))
const tunggu = (w: Waitlist) => Math.max(0, Math.round((Date.now() - (w.addedAt || 0)) / 60000))
const paxAntrean = computed(() => antreanHari.value.reduce((a, w) => a + (Number(w.pax) || 0), 0))

/** Queue entries on other dates, so a guest who is waiting tomorrow is not lost. */
const antreanLain = computed(() => (waitlist.value?.data ?? [])
  .filter(w => w.status === 'waiting' && w.date !== tglDenah.value)
  .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.addedAt || 0) - (b.addedAt || 0)))

// --- the queue (`:1921-1996`) --------------------------------------------------

const sheetAntrean = ref(false)
const antreanBaru = reactive({ nama: '', phone: '', pax: 1, note: '' })

function bukaAntrean() {
  Object.assign(antreanBaru, { nama: '', phone: '', pax: 1, note: '' })
  sheetAntrean.value = true
}

async function simpanAntrean() {
  const n = Number(antreanBaru.pax) || 0
  if (n < 1) {
    toast.add({ title: 'Jumlah orang wajib diisi', color: 'error' })
    return
  }
  const w: Waitlist = {
    id: uid(),
    // A nameless quick entry is all recorded as "Walkin" (:1944).
    name: antreanBaru.nama.trim() || 'Walkin',
    phone: normPhone(antreanBaru.phone),
    pax: n,
    note: antreanBaru.note.trim(),
    date: tglDenah.value,
    addedAt: Date.now(),
    by: namaSaya.value,
    status: 'waiting',
    seatedAt: 0,
    table: '',
    resId: '',
    calledAt: 0,
  }
  sheetAntrean.value = false
  try {
    await putSectionItem('waitlist', w.id, w, versiWaitlist.value)
    await refreshWaitlist()
    await catat(`${w.name} (${w.pax} pax) masuk antrean`, undefined, 'Waiting List')
    toast.add({ title: `${w.name} masuk waiting list`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshWaitlist))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetDudukkan = ref(false)
const dudukkanId = ref('')
const dudukkanMeja = ref('')
const dudukkanSharing = ref(false)
const calon = computed(() => (waitlist.value?.data ?? []).filter(w => w.status === 'waiting' && w.date === tglDenah.value))
const dudukkan = computed(() => calon.value.find(w => w.id === dudukkanId.value) ?? null)

/** Does the party fit? They are listed first when they do, but the host may
 *  still override it (`:1926-1929`). */
const kapasitasMeja = computed(() => {
  const me = cariMeja(master.value, dudukkanMeja.value)
  return me ? capMax(me.t.cap) : 0
})
const dudukkanMuat = computed(() => !kapasitasMeja.value || (dudukkan.value?.pax ?? 0) <= kapasitasMeja.value)

function bukaDudukkan(w: Waitlist) {
  dudukkanId.value = w.id
  dudukkanMeja.value = ''
  dudukkanSharing.value = false
  sheetDudukkan.value = true
}

/** Seat a queued guest: a walk-in booking first, then the queue entry is linked to
 *  it (`:1961-1992`). In that order, so a failed booking leaves the guest waiting
 *  rather than marked as seated with nothing to show. */
async function simpanDudukkan() {
  const w = dudukkan.value
  if (!w || !dudukkanMeja.value) return
  const now = Date.now()
  const jam = normTime(`${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`)
  const recId = uid()
  try {
    await createReservation({
      id: recId,
      name: w.name,
      phone: w.phone,
      date: tglDenah.value,
      time: jam,
      pax: w.pax,
      table: dudukkanMeja.value,
      sharing: dudukkanSharing.value,
      category: 'Tamu Umum',
      foodReq: '',
      drinkReq: '',
      dpStatus: 'Belum',
      dpMethod: '',
      dpAmount: 0,
      dpProofData: '',
      dpProofName: '',
      docReqData: '',
      docReqName: '',
      source: 'Walk-in',
      picType: 'Host/Captain',
      picName: namaSaya.value,
      member: false,
      memberNo: '',
      notes: `Dari waiting list${w.note ? ` — ${w.note}` : ''}`,
      vip: false,
      status: 'Datang',
      actualPax: w.pax,
      checkinAt: now,
      leftAt: 0,
      // A guest from the queue walks in complete: one wave, all of them.
      arrivals: [{ ts: now, pax: w.pax, by: namaSaya.value }],
      createdBy: namaSaya.value,
      createdAt: now,
      updatedAt: now,
      followups: [],
      _audit: { action: 'Waiting List', detail: `${w.name} (${w.pax} pax) didudukkan di ${dudukkanMeja.value}, menunggu ${fmtMenit(tunggu(w))}` },
    } as Partial<Reservasi> & { _audit: { action: string, detail: string } })

    const baru: Waitlist = { ...w, status: 'seated', seatedAt: now, table: dudukkanMeja.value, resId: recId, calledAt: w.calledAt }
    await putSectionItem('waitlist', w.id, baru, versiWaitlist.value)
    await Promise.all([refreshWaitlist(), refresh()])
    sheetDudukkan.value = false
    toast.add({ title: `${w.name} duduk di ${dudukkanMeja.value}`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshWaitlist))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** Leaving the queue keeps the row with status 'cancelled': the old client did the
 *  same, and a queue has no trace of its own to lose. */
async function batalkanAntrean(w: Waitlist) {
  try {
    await putSectionItem('waitlist', w.id, { ...w, status: 'cancelled' }, versiWaitlist.value)
    await refreshWaitlist()
    await catat(`${w.name} keluar dari antrean`, undefined, 'Waiting List')
    toast.add({ title: 'Dikeluarkan dari antrean' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshWaitlist))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function panggil(w: Waitlist) {
  if (!w.phone) {
    toast.add({ title: 'Nomor WhatsApp kosong — panggil manual', color: 'error' })
    return
  }
  try {
    await putSectionItem('waitlist', w.id, { ...w, calledAt: Date.now() }, versiWaitlist.value)
    await refreshWaitlist()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshWaitlist))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  await waKirim(w.phone, teksPanggilAntrean(w.name, w.pax))
}

/** A row's own version is its `updatedAt` (the list sends no meta.version). */
const versiBaris = (r: Reservasi) => r.updatedAt
const baris = (id: string) => (semua.value ?? []).find(r => r.id === id) ?? null

/** Every write from the map is a shallow merge of one row, with that row's version. */
async function patch(r: Reservasi, fields: Partial<Reservasi>, pesan: string) {
  try {
    await patchReservation(r.id, { ...fields, updatedAt: Date.now() }, versiBaris(r))
    await refresh()
    toast.add({ title: pesan, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}

// --- quick actions on one booking (`:6432-6465`) --------------------------------

const aksiId = ref('')
const sheetAksi = ref(false)
const aksi = computed(() => baris(aksiId.value))
const aksiDuduk = computed(() => !!aksi.value && isSeated(aksi.value))

/** Past the arrival time and not here yet — the shortcut to a follow-up message. */
const aksiTelat = computed(() => {
  const r = aksi.value
  if (!r || !['Pending', 'Confirmed'].includes(r.status)) return false
  return new Date(`${r.date}T${(r.time || '00:00')}:00`).getTime() < Date.now()
})

/** Free seats on one of this booking's tables — the old `sisaMeja` (`:6449`). */
const sisaMejaAksi = computed(() => {
  const r = aksi.value
  if (!r) return null
  let terbaik: { id: string, sisa: number } | null = null
  for (const id of tablesOf(r)) {
    const me = cariMeja(master.value, id)
    if (!me) continue
    const terisi = (petaHari.value.occ.get(id) ?? []).reduce((a, x) => a + (Number(x.pax) || 0), 0)
    const sisa = Math.max(0, capMax(me.t.cap) - terisi)
    if (sisa > 0 && (!terbaik || sisa > terbaik.sisa)) terbaik = { id, sisa }
  }
  return terbaik
})

function bukaAksi(r: Reservasi) {
  aksiId.value = r.id
  sheetAksi.value = true
}

/** Arrival waves. The upper bound sits ABOVE the whole venue (453 seats) on
 *  purpose: a number that high is never a big party, it is a mistyped phone
 *  number — and once it got through, the "pax datang" card read 81 billion (`:7448-7465`). */
const MAKS_PAX_GELOMBANG = 500
const sheetDatang = ref(false)
const datangPertama = ref(true)
const paxDatangBaru = ref(1)

function bukaDatang(r: Reservasi, pertama: boolean) {
  aksiId.value = r.id
  sheetAksi.value = false
  datangPertama.value = pertama
  paxDatangBaru.value = Math.max(1, remainingPax(r) || 1)
  sheetDatang.value = true
}

async function simpanDatang() {
  const target = baris(aksiId.value)
  if (!target) return
  const n = Number(paxDatangBaru.value) || 0
  if (n < 1) {
    toast.add({ title: 'Jumlah orang yang masuk minimal 1', color: 'error' })
    return
  }
  if (n > MAKS_PAX_GELOMBANG) {
    toast.add({
      title: String(n).length >= 8
        ? `${n} bukan jumlah orang — sepertinya nomor HP yang tertempel di kotak ini.`
        : `Jumlah orang maksimal ${MAKS_PAX_GELOMBANG} per catatan.`,
      color: 'error',
    })
    return
  }
  const now = Date.now()
  // A guest who had already gone home and is marked as arriving again is a NEW
  // visit: the new wave used to be stacked onto the old notes (so "5/4") and the
  // old leftAt was kept because the status was already "Datang" — the table then
  // read as free while the guest was sitting there (26 September 2026).
  const kunjunganBaru = !!target.leftAt
  const gelombang = kunjunganBaru ? [] : [...(target.arrivals ?? [])]
  const total = gelombang.reduce((a, x) => a + (Number(x.pax) || 0), 0) + n
  if (total > Number(target.pax || 0)
    && !window.confirm(`Total tamu yang masuk jadi ${total} orang, lebih banyak dari booking (${target.pax} pax).\nTetap catat?`)) {
    return
  }
  gelombang.push({ ts: now, pax: n, by: namaSaya.value })
  sheetDatang.value = false
  const sisa = Math.max(0, (Number(target.pax) || 0) - total)
  const ok = await patch(target, {
    arrivals: gelombang,
    actualPax: total,
    status: 'Datang',
    leftAt: 0,
    checkinAt: kunjunganBaru ? now : (target.checkinAt || now),
    datangDiasumsikan: kunjunganBaru ? 0 : target.datangDiasumsikan,
  }, `${target.name}: ${total}/${target.pax} pax masuk${sisa ? ` — sisa ${sisa} masih ditunggu` : ' — rombongan lengkap'}`)
  if (ok) await catat(`${target.name}, ${n} pax masuk (total ${total}/${target.pax})`, target.id, datangPertama.value ? 'Datang' : 'Datang Susulan')
}

async function selesai(r: Reservasi) {
  if (r.status !== 'Datang') {
    toast.add({ title: 'Hanya tamu yang sudah datang bisa ditandai selesai', color: 'error' })
    return
  }
  sheetAksi.value = false
  const durasi = r.checkinAt ? Math.round((Date.now() - r.checkinAt) / 60000) : null
  const ok = await patch(r, { checkinAt: r.checkinAt || Date.now(), leftAt: Date.now() },
    `${r.name} selesai${durasi != null ? ` — duduk ${fmtMenit(durasi)}` : ''}, meja bebas`)
  if (ok) await catat(`${r.name}${durasi != null ? `, duduk ${fmtMenit(durasi)}` : ''}`, r.id, 'Selesai Duduk')
}

async function toggleSharing(r: Reservasi) {
  const berikut = !r.sharing
  sheetAksi.value = false
  const ok = await patch(r, { sharing: berikut }, berikut ? 'Meja dijadikan sharing' : 'Sharing dibatalkan')
  if (ok) await catat(`${r.name}, meja ${r.table || '-'}`, r.id, berikut ? 'Set Sharing' : 'Batal Sharing')
}

/** Back to the table the guest was moved off, once it is free (`:6446`). */
async function kembaliKeAsli(r: Reservasi) {
  const asal = r.tableAsli || ''
  if (!asal) return
  sheetAksi.value = false
  const bentrok = petaHari.value.occ.get(asal)?.[0]
  if (bentrok) {
    toast.add({ title: `Meja ${asal} masih dipakai ${bentrok.name}`, color: 'error' })
    return
  }
  const ok = await patch(r, { table: asal, tableAsli: '' }, `Kembali ke meja ${asal}`)
  if (ok) await catat(`${r.name} dikembalikan ke meja ${asal}`, r.id, 'Kembali ke Meja Asli')
}

const sheetBatal = ref(false)
const alasanBatal = ref('')

function bukaBatal(r: Reservasi) {
  aksiId.value = r.id
  sheetAksi.value = false
  alasanBatal.value = ''
  sheetBatal.value = true
}

async function simpanBatal() {
  const r = baris(aksiId.value)
  if (!r) return
  sheetBatal.value = false
  const ok = await patch(r, { status: 'Cancelled', cancelReason: alasanBatal.value.trim() }, `${r.name} dibatalkan — meja kembali tersedia`)
  if (ok) await catat(`${r.name} dibatalkan${alasanBatal.value ? `: ${alasanBatal.value}` : ''}`, r.id, 'Batalkan Reservasi')
}

/** Audit is appended by the server for reservation writes; these lines are for
 *  the actions the row itself does not record. */
async function catat(detail: string, res: string | undefined, action: string) {
  try {
    await postAudit({ action, detail, res })
  }
  catch {
    // The action itself already succeeded; a missing audit line must not be
    // reported as a failure of the write.
  }
}

// --- moving or adding a table (`:6805-6823`) -----------------------------------

const sheetPindah = ref(false)
const pindahMode = ref<'move' | 'add'>('move')
const pindahSels = ref<string[]>([])
/** Approval lasts one opening of the picker only — it is not kept. */
const dipaksaPindah = ref<string[]>([])
const tanyaPindah = ref<{ meja: string, pesan: string, kunci: boolean } | null>(null)

function bukaPindah(r: Reservasi, mode: 'move' | 'add') {
  aksiId.value = r.id
  sheetAksi.value = false
  pindahMode.value = mode
  pindahSels.value = mode === 'add' ? tablesOf(r) : []
  dipaksaPindah.value = []
  sheetPindah.value = true
}

function onTumpangPindah(p: { meja: string, pesan: string, kunci: boolean }) {
  if (p.kunci) {
    toast.add({ title: p.pesan, color: 'error' })
    return
  }
  tanyaPindah.value = p
}

function closePindah() {
  sheetPindah.value = false
  tanyaPindah.value = null
}

function izinkanPindah() {
  const m = tanyaPindah.value?.meja
  tanyaPindah.value = null
  if (m && !dipaksaPindah.value.includes(m)) dipaksaPindah.value = [...dipaksaPindah.value, m]
  if (m) pilihPindah(m)
}

function pilihPindah(mejaId: string) {
  pindahSels.value = pindahSels.value.includes(mejaId)
    ? pindahSels.value.filter(m => m !== mejaId)
    : [...pindahSels.value, mejaId]
}

async function simpanPindah() {
  const r = baris(aksiId.value)
  if (!r || !pindahSels.value.length) return
  const meja = pindahSels.value.join(', ')
  // The crew's approval travels with the row and covers exactly this table,
  // date and time (F6).
  const izin = dipaksaPindah.value.length
    ? buatIzinTumpang(meja, r.date, normTime(r.time), null, namaSaya.value)
    : (r.izinTumpang ?? null)
  sheetPindah.value = false
  const ok = await patch(r, { table: meja, izinTumpang: izin }, `Meja ${r.name} → ${meja}`)
  if (ok) await catat(`${r.name}: meja ${r.table || '-'} → ${meja}`, r.id, pindahMode.value === 'add' ? 'Tambah Meja' : 'Pindah Meja')
}

// --- walk-in at a free table (`:1944-1975`) -------------------------------------

const sheetWalkin = ref(false)
const walkin = reactive({ meja: '', nama: '', phone: '', pax: 1, sharing: false })

function bukaWalkin(mejaId: string) {
  Object.assign(walkin, { meja: mejaId, nama: '', phone: '', pax: 1, sharing: false })
  sheetWalkin.value = true
}

async function simpanWalkin() {
  const n = Number(walkin.pax) || 0
  if (n < 1) {
    toast.add({ title: 'Jumlah orang wajib diisi', color: 'error' })
    return
  }
  const now = Date.now()
  const jam = normTime(`${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`)
  const nama = walkin.nama.trim() || 'Walkin' // a nameless quick entry is all called "Walkin"
  sheetWalkin.value = false
  try {
    await createReservation({
      id: uid(),
      name: nama,
      phone: normPhone(walkin.phone),
      date: tglDenah.value,
      time: jam,
      pax: n,
      table: walkin.meja,
      sharing: walkin.sharing,
      category: 'Tamu Umum',
      foodReq: '',
      drinkReq: '',
      dpStatus: 'Belum',
      dpMethod: '',
      dpAmount: 0,
      dpProofData: '',
      dpProofName: '',
      docReqData: '',
      docReqName: '',
      source: 'Walk-in',
      picType: 'Host/Captain',
      picName: namaSaya.value,
      member: false,
      memberNo: '',
      notes: '',
      vip: false,
      status: 'Datang',
      actualPax: n,
      checkinAt: now,
      leftAt: 0,
      arrivals: [{ ts: now, pax: n, by: namaSaya.value }],
      createdBy: namaSaya.value,
      createdAt: now,
      updatedAt: now,
      followups: [],
      _audit: { action: 'Walk-in', detail: `${nama} (${n} pax) di meja ${walkin.meja}` },
    } as Partial<Reservasi> & { _audit: { action: string, detail: string } })
    await refresh()
    toast.add({ title: `${nama} duduk di ${walkin.meja}`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- the plan for one date + the editor (`:5406-5416`, `:5938-6152`) ------------

const muatUlangDenah = () => Promise.all([
  secLayouts.refresh(),
  secOv1.refresh(),
  secOv2.refresh(),
  secTgl.refresh(),
])

const bolehDenah = computed(() => bolehAksi('master', role.value))
const adaOverride = computed(() => hasOverrideLt(master.value, tglDenah.value, 1) || hasOverrideLt(master.value, tglDenah.value, 2))
const jejakPlan = computed(() => jejakDenah(getLayout(master.value, layerMap.value === 2 ? kunciL2.value : kunciL1.value)))

/** Templates offered for a floor, grouped by floor — a second floor's plan here
 *  would draw the wrong tables for a whole evening, and the symptom is "my table
 *  disappeared", not an error (`:6205-6218`). */
const templateLt = computed(() => {
  const per = new Map<number, { key: string, label: string }[]>()
  for (const k of allLayoutKeys(master.value)) {
    const lt = lantaiLayout(master.value, k)
    per.set(lt, [...(per.get(lt) ?? []), { key: k, label: layoutName(master.value, k) }])
  }
  return [...per.entries()].sort((a, b) => a[0] - b[0])
})

const sheetLayout = ref(false)
/** The template chosen for the date, '' = follow the day. */
const pilihTemplate = ref('')
const tanggalTambah = ref(hariIni())

function bukaLayout() {
  pilihTemplate.value = (layerMap.value === 2 ? ovLt2.value : ovLt1.value)[tglDenah.value] ?? ''
  tanggalTambah.value = tglDenah.value
  sheetLayout.value = true
}

const ovLt1 = computed(() => ovLantai(master.value, 1))
const ovLt2 = computed(() => ovLantai(master.value, 2))

async function simpanLayoutTgl() {
  const lt = layerMap.value
  const key = lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'
  const ov = { ...(lt === 2 ? ovLt2.value : ovLt1.value) }
  if (pilihTemplate.value && getLayout(master.value, pilihTemplate.value)) ov[tglDenah.value] = pilihTemplate.value
  // A date with no template of its own goes back to the built-in of the day:
  // the key is removed rather than left pointing at nothing.
  const bersih = Object.fromEntries(Object.entries(ov).filter(([d]) => d !== tglDenah.value || !!ov[d]))
  try {
    await putDenah(key, bersih, versiDenah.value[key])
    await muatUlangDenah()
    sheetLayout.value = false
    await catat(`${ltCfg(lt).nama} · ${tglPendek(tglDenah.value)} → ${pilihTemplate.value ? layoutName(master.value, pilihTemplate.value) : 'bawaan'}`, undefined, pilihTemplate.value ? 'Set Denah Tanggal' : 'Reset Denah Tanggal')
    toast.add({ title: pilihTemplate.value ? `${ltCfg(lt).nama}: ${layoutName(master.value, pilihTemplate.value)} dipakai untuk ${tglPendek(tglDenah.value)}` : `${ltCfg(lt).nama} dikembalikan ke bawaan hari`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDenah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** "Terapkan ke banyak tanggal" — changes that can be planned weeks ahead. */
async function tambahTanggalLayout() {
  const d = tanggalTambah.value
  if (!d) {
    toast.add({ title: 'Pilih tanggalnya dulu', color: 'error' })
    return
  }
  if (!pilihTemplate.value || !getLayout(master.value, pilihTemplate.value)) {
    toast.add({ title: 'Pilih denahnya dulu (bukan bawaan hari)', color: 'error' })
    return
  }
  const lt = layerMap.value
  const key = lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'
  const ov = { ...(lt === 2 ? ovLt2.value : ovLt1.value), [d]: pilihTemplate.value }
  try {
    await putDenah(key, ov, versiDenah.value[key])
    await muatUlangDenah()
    await catat(`${ltCfg(lt).nama} · ${tglPendek(d)} → ${pilihTemplate.value}`, undefined, 'Set Denah Tanggal')
    toast.add({ title: `${tglPanjangLama(d)} memakai ${layoutName(master.value, pilihTemplate.value)}`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDenah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** "Kembalikan ke bawaan" clears BOTH forms of deviation — a scheduled template
 *  AND tables drawn for that date. From the crew's side they are one thing ("this
 *  day's plan is different"), and clearing only one leaves a flag nothing can
 *  remove (`:6093-6101`). */
async function bersihkanTanggal(d: string) {
  const lt = layerMap.value
  try {
    if (adaDenahTanggal(master.value, d, lt)) {
      const perTanggal = { ...layoutTanggal(master.value) }
      const { [keyTanggal(d, lt)]: dibuang, ...sisa } = perTanggal
      void dibuang
      await putDenah('layoutTanggal', sisa, versiDenah.value.layoutTanggal)
    }
    const ov = { ...(lt === 2 ? ovLt2.value : ovLt1.value) }
    if (ov[d]) {
      const { [d]: dibuang, ...sisa } = ov
      void dibuang
      await putDenah(lt === 2 ? 'layoutOverrides2' : 'layoutOverrides', sisa, versiDenah.value[lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'])
    }
    await muatUlangDenah()
    await catat(`${ltCfg(lt).nama} · ${tglPendek(d)} → bawaan`, undefined, 'Reset Denah Tanggal')
    toast.add({ title: `${ltCfg(lt).nama} dikembalikan ke bawaan hari`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDenah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** Dates from today on that deviate from their built-in plan: a scheduled template
 *  and tables drawn for that date are listed together, because splitting them
 *  into two lists only makes people check both before being sure (`:5981-5990`). */
const tanggalTercetak = computed(() => {
  const lt = layerMap.value
  const hariIniStr = hariIni()
  const keluar: { tgl: string, nama: string, khusus: boolean }[] = []
  const ov = lt === 2 ? ovLt2.value : ovLt1.value
  for (const [d, v] of Object.entries(ov)) {
    if (d >= hariIniStr && getLayout(master.value, v)) keluar.push({ tgl: d, nama: layoutName(master.value, v), khusus: false })
  }
  for (const key of Object.keys(secTgl.data.value?.data ?? {})) {
    const p = parseKeyTanggal(key)
    if (p && p.lt === lt && p.date >= hariIniStr) keluar.push({ tgl: p.date, nama: 'denah digeser sendiri', khusus: true })
  }
  return keluar.sort((a, b) => a.tgl.localeCompare(b.tgl))
})

// --- the editor (`:6109-6152`, `:6200-6390`) -------------------------------------

const sheetEditor = ref(false)
/** What the editor is editing: a template key, or a plan stored for this date. */
const editorKunci = ref('')
const editorSalinan = ref<LayoutDenah | null>(null)

function bukaEditor() {
  const lt = layerMap.value
  editorKunci.value = (lt === 2 ? kunciL2.value : kunciL1.value)
  editorSalinan.value = structuredClone(toRaw(getLayout(master.value, editorKunci.value) ?? getLayout(master.value, 'weekday')!))
  sheetLayout.value = false
  sheetEditor.value = true
}

const editorTanggal = computed(() => parseKeyTanggal(editorKunci.value))
/** The template that would cover this date if its own plan were not there. */
const editorTemplat = computed(() => {
  const p = editorTanggal.value
  if (!p) return editorKunci.value
  const ov = p.lt === 2 ? ovLt2.value : ovLt1.value
  const terjadwal = ov[p.date]
  return (terjadwal && getLayout(master.value, terjadwal)) ? terjadwal : defaultDayTypeLt(p.date, p.lt)
})

/** Save into the covering template: every date that uses it changes. */
async function simpanKeTemplat(data: LayoutDenah) {
  const key = editorTemplat.value
  if (!key || parseKeyTanggal(key)) return
  const cap = capDenah(data, namaSaya.value)
  try {
    await putDenah('layouts', { ...(secLayouts.data.value?.data ?? {}), [key]: cap }, versiDenah.value.layouts)
    await muatUlangDenah()
    editorSalinan.value = cap
    sheetEditor.value = false
    await catat(`${layoutName(master.value, key)} (${cap.tables.length} meja)`, undefined, 'Simpan Layout')
    toast.add({ title: `Template ${layoutName(master.value, key)} disimpan — berlaku untuk semua tanggal yang memakainya`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDenah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** Save for THIS DATE only: the template is not touched at all, and the next day
 *  goes back to normal by itself (`:6244-6250`). */
async function simpanUntukTanggal(data: LayoutDenah) {
  const key = editorKunci.value
  const p = editorTanggal.value
  if (!p) {
    await simpanKeTemplat(data)
    return
  }
  const cap = capDenah(denahTanggalBaru(data, p.date, p.lt), namaSaya.value)
  try {
    await putDenah('layoutTanggal', { ...(secTgl.data.value?.data ?? {}), [key]: cap }, versiDenah.value.layoutTanggal)
    await muatUlangDenah()
    editorSalinan.value = cap
    sheetEditor.value = false
    await catat(`${tglPendek(p.date)} Lt.${p.lt} (${cap.tables.length} meja)`, undefined, 'Simpan Denah Tanggal')
    toast.add({ title: `Denah ${tglPendek(p.date)} disimpan — template tidak ikut berubah`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDenah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- WA coordination (`:7640-7712`, `:7762-7770`) --------------------------------

const sheetWA = ref(false)
const coordDari = ref('')
const coordSampai = ref('')
const { data: waTargets } = useSection<WaTarget[]>('waTargets')

/** 30-minute steps, the old dropdown's granularity (`:4033-4036`). */
const opsiJam = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const jamOpsi = [{ value: '', label: 'Semua jam' }, ...opsiJam.map(j => ({ value: j, label: j }))]

const menitDari = (jam?: string) => {
  const [h, m] = String(jam || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** The day, minus cancelled and no-show, minus the chosen shift (`:7645-7656`).
 *  `semua` is the same list the map draws, so what is coordinated is what is seen. */
const daftarKoord = computed(() => {
  const lo = coordDari.value ? menitDari(coordDari.value) : null
  const hi = coordSampai.value ? menitDari(coordSampai.value) : null
  return (semua.value ?? [])
    .filter(r => r.date === tglDenah.value && !['Cancelled', 'No-show'].includes(r.status))
    .filter((r) => {
      const t = menitDari(r.time)
      return (lo === null || t >= lo) && (hi === null || t <= hi)
    })
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
})

const labelRentang = computed(() => {
  if (!coordDari.value && !coordSampai.value) return ''
  if (coordDari.value && coordSampai.value) return `Jam ${coordDari.value}–${coordSampai.value}`
  return coordDari.value ? `Jam ${coordDari.value} ke atas` : `Sampai jam ${coordSampai.value}`
})

const GARIS = '─────────────────'
const mejaTeks = (r: Reservasi) => (r.table && String(r.table).trim() ? String(r.table).trim() : 'belum diatur')

/**
 * One guest per LINE, not a three-line block, so a broadcast is not full of
 * gaps; the totals sit at the TOP, not below (`:7669-7671`).
 */
const teksKoordinasi = computed(() => {
  const list = daftarKoord.value
  const pax = list.reduce((a, r) => a + (Number(r.pax) || 0), 0)
  const meja = list.reduce((a, r) => a + tablesOf(r).length, 0)
  const baris = list.map((r, i) => {
    const dp = r.dpStatus === 'Sudah' && Number(r.dpAmount) > 0 ? `💰${fmtRupiah(Number(r.dpAmount))}` : '⭕ Belum DP'
    return `${i + 1}. *${(r.name || '-').toUpperCase()}* · ${r.time || '-'} · 🪑${mejaTeks(r)} · 👥${Number(r.pax) || 0} · ${dp}`
  })
  return [
    '⚓ *KOORDINASI KEDATANGAN*',
    `Laksamana Muda · ${tglPanjangLama(tglDenah.value)}${labelRentang.value ? ` · ${labelRentang.value}` : ''}`,
    `👥 Total: ${pax} pax · 📋 ${list.length} reservasi · 🪑 ${meja} meja`,
    GARIS,
    baris.length ? baris.join('\n') : '_(tidak ada reservasi)_',
  ].join('\n')
})

const teksKasir = computed(() => {
  const list = daftarKoord.value
  const bayar = list.filter(r => r.dpStatus === 'Sudah' && Number(r.dpAmount) > 0)
  const totalDP = bayar.reduce((a, r) => a + (Number(r.dpAmount) || 0), 0)
  const pax = list.reduce((a, r) => a + (Number(r.pax) || 0), 0)
  const baris = list.map((r, i) => {
    const dp = r.dpStatus === 'Sudah' && Number(r.dpAmount) > 0
      ? `💳 ${fmtRupiah(Number(r.dpAmount))}${dpMethodPendek(r) !== '-' ? ` (${dpMethodPendek(r)})` : ''}`
      : '⭕ Belum DP'
    return `${i + 1}. *${(r.name || '-').toUpperCase()}* · ${r.time || '-'} · 🪑${mejaTeks(r)} · 👥${Number(r.pax) || 0} · ${dp}`
  })
  return [
    '💰 *REKAP DP — KASIR*',
    `⚓ Laksamana Muda · ${tglPanjangLama(tglDenah.value)}${labelRentang.value ? ` · ${labelRentang.value}` : ''}`,
    `💰 Total DP: *${fmtRupiah(totalDP)}*  ·  ✅ ${bayar.length}  ⭕ ${list.length - bayar.length}  ·  👥 ${pax} pax (${list.length})`,
    GARIS,
    baris.length ? baris.join('\n') : '_(tidak ada reservasi)_',
  ].join('\n')
})

/** "Transfer UOB BRI" reads as "UOB BRI" in a 1-line message (`:7636-7639`). */
const dpMethodPendek = (r: Reservasi) =>
  (r.dpStatus !== 'Sudah' || !r.dpMethod ? '-' : r.dpMethod.replace(/^Transfer\s+/i, ''))

/** A target from `master.waTargets`: the DP flag decides which of the two
 *  formats the group receives — the old screen hard-coded both cards, the flag
 *  on the target said the same thing. */
const teksUntuk = (t: WaTarget) => (t.includeDP ? teksKasir.value : teksKoordinasi.value)

const tujuanKoord = computed(() => (waTargets.value ?? []).filter(t => t.type === 'group'))

async function kirimKoord(t: WaTarget) {
  await catat(`${t.name}${labelRentang.value ? `, ${labelRentang.value}` : ''}`, undefined, 'Kirim Koordinasi')
  // A group has no number: the text goes to the clipboard and wa.me opens so the
  // coordinator picks the group and pastes — the same limitation the old client
  // worked around with saved invite links (:7762-7770).
  await waKirim(t.type === 'group' ? null : t.detail, teksUntuk(t))
}

// --- the poll (`:3089-3156`) ------------------------------------------------------
// The map is the only tab that pulls on its own, and only while it is on screen:
// POLL_JEDA is 15 s and the pull is skipped while the browser tab is hidden, with
// an immediate refresh when it comes back. Auto-closing at 04:00 is deliberately
// NOT built (F9, AUTO_TUTUP_AKTIF=false since 26 September 2026).

const POLL_JEDA = 15000
let jeda: ReturnType<typeof setInterval> | undefined

function nyalakanJeda() {
  clearInterval(jeda)
  if (tab.value === 'map' && document.visibilityState === 'visible') {
    jeda = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_JEDA)
  }
}
onMounted(nyalakanJeda)
onBeforeUnmount(() => clearInterval(jeda))
watch(tab, nyalakanJeda)
function saatKembaliLayar() {
  if (document.visibilityState !== 'visible') return
  nyalakanJeda()
  if (tab.value === 'map') refresh()
}
onMounted(() => document.addEventListener('visibilitychange', saatKembaliLayar))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', saatKembaliLayar))

/** A filter that hides part of the rows must not be used to add guests or move tables. */
const saringBerlaku = computed(() => !!(filter.fromHour || filter.toHour || filter.status || filter.category
  || filter.lantai || filter.kursi || filter.dp || filter.pic || filter.q || cari.value || filter.mode !== 'day'))

const tglPanjangLama = (tgl: string) => new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

/** The queue count used in the map's header line. */
const ants = computed(() => antreanHari.value)

const statusPax = (r: Reservasi) => (r.status === 'Datang' ? `${arrivedPax(r)}/${r.pax} · sisa ${remainingPax(r)}` : String(r.pax || 0))
</script>

<template>
  <AppPage
    title="Dashboard & recap"
    description="Satu halaman: data reservasi, denah meja, dan antrean."
    :back="{ label: 'Semua layar', to: '/reservasi' }"
  >
    <div class="mb-5 flex flex-wrap gap-2">
      <UButton
        v-if="bolehEdit"
        label="Reservasi baru"
        to="/reservasi/input"
        size="xl"
      />
      <UButton
        v-if="bolehEdit"
        label="WA koordinasi"
        color="neutral"
        variant="soft"
        size="xl"
        @click="sheetWA = true"
      />
      <UButton
        v-if="bolehAksi('master', role)"
        label="Atur denah"
        color="neutral"
        variant="soft"
        size="xl"
        @click="bukaLayout"
      />
    </div>

    <!-- One AppFocus: the number the desk needs first, never a grid of big cards
         (DESIGN.md, and :5376-5380 — the old six cards filled two full rows and
         pushed the table off screen). -->
    <div class="mb-7 max-w-xl">
      <AppFocus
        label="Reservasi"
        :value="angka(basis.length)"
        :hint="`${labelPeriode} · ${angka(totalPax)} pax dipesan, ${angka(paxDatang)} datang`"
      />
    </div>

    <AppList title="Ringkasan">
      <AppListRow
        title="Pax datang / dipesan"
        :description="totalPax ? `${Math.round(paxDatang / totalPax * 100)}% realisasi` : 'Belum ada pax dipesan'"
        icon="i-lucide-users"
      >
        <template #trailing>
          {{ angka(paxDatang) }} / {{ angka(totalPax) }}
        </template>
      </AppListRow>
      <AppListRow
        title="Kapasitas terisi"
        :description="`${pctKap}% dari ${kap.meja} meja · ${tglPendek(tglDenah)}`"
        icon="i-lucide-armchair"
      >
        <template #trailing>
          {{ angka(paxTgl) }} / {{ angka(kap.pax) }}
        </template>
      </AppListRow>
      <AppListRow
        title="Sudah DP"
        :description="`${angka(basis.length - dpYes)} reservasi belum`"
        icon="i-lucide-wallet"
      >
        <template #trailing>
          {{ angka(dpYes) }} / {{ angka(basis.length) }}
        </template>
      </AppListRow>
      <AppListRow
        title="Perlu follow up"
        description="belum dikonfirmasi hari ini"
        icon="i-lucide-phone-call"
      >
        <template #trailing>
          <AppStatus
            :color="perluFollowUp ? 'warning' : 'neutral'"
          >
            {{ angka(perluFollowUp) }}
          </AppStatus>
        </template>
      </AppListRow>
    </AppList>

    <div class="mb-5 flex flex-wrap items-center gap-2">
      <UButton
        v-for="t in ([['list', 'Tabel'], ['calendar', 'Kalender'], ['map', 'Denah meja'], ['wait', 'Waiting list']] as const)"
        :key="t[0]"
        :label="t[1]"
        color="neutral"
        :variant="tab === t[0] ? 'soft' : 'ghost'"
        @click="tab = t[0]"
      />
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        placeholder="Cari nama tamu, nomor HP, atau meja…"
        class="max-w-xs"
      />
    </div>

    <AppList title="Filter">
      <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Periode">
          <USelect
            v-model="filter.mode"
            :items="[
              { value: 'day', label: 'Harian' },
              { value: 'month', label: 'Bulanan' },
              { value: 'year', label: 'Tahunan' },
              { value: 'range', label: 'Rentang' },
              { value: 'all', label: 'Semua' },
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="filter.mode === 'day'"
          label="Tanggal"
        >
          <UInput
            v-model="filter.date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="filter.mode === 'month'"
          label="Bulan"
        >
          <UInput
            v-model="filter.month"
            type="month"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="filter.mode === 'year'"
          label="Tahun"
        >
          <UInput
            v-model.number="filter.year"
            type="number"
            class="w-full"
          />
        </UFormField>
        <template v-if="filter.mode === 'range'">
          <UFormField label="Dari">
            <UInput
              v-model="filter.from"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sampai">
            <UInput
              v-model="filter.to"
              type="date"
              class="w-full"
            />
          </UFormField>
        </template>
        <!-- The map's date only appears when the period is more than one day. In
             Daily mode it is always the filter's date, and showing it invites
             the two to drift apart unnoticed. -->
        <UFormField
          v-if="filter.mode !== 'day'"
          label="Tanggal denah"
        >
          <UInput
            v-model="tglDenah"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam dari">
          <UInput
            v-model="filter.fromHour"
            placeholder="00:00"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam sampai">
          <UInput
            v-model="filter.toHour"
            placeholder="23:59"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="filter.status"
            :items="[{ value: '', label: 'Semua (tanpa cancelled)' }, 'Pending', 'Confirmed', 'Datang', 'Cancelled', 'No-show']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis reservasi">
          <USelect
            v-model="filter.category"
            :items="['', ...(categories ?? [])]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Lantai">
          <USelect
            v-model="filter.lantai"
            :items="[{ value: '', label: 'Semua' }, { value: '1', label: 'Lantai 1' }, { value: '2', label: 'Lantai 2' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="DP">
          <USelect
            v-model="filter.dp"
            :items="[{ value: '', label: 'Semua' }, 'Sudah', 'Belum']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="PIC">
          <USelect
            v-model="filter.pic"
            :items="[{ value: '', label: 'Semua' }, ...namaPIC]"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Tipe tamu"
          disabled
          help="Segera · G-07"
        >
          <p class="text-sm text-dimmed">
            Butuh riwayat kunjungan seluruh tamu, belum ada endpoint ringkas. <span class="text-dimmed">G-07</span>
          </p>
        </UFormField>
      </div>

      <div class="flex flex-wrap items-center gap-2 px-4 pb-4">
        <UButton
          label="Hari ini"
          color="neutral"
          :variant="filter.mode === 'day' && filter.date === hariIni() ? 'soft' : 'ghost'"
          size="sm"
          @click="setHari(0)"
        />
        <UButton
          label="Besok"
          color="neutral"
          :variant="filter.mode === 'day' && filter.date === tambahHari(hariIni(), 1) ? 'soft' : 'ghost'"
          size="sm"
          @click="setHari(1)"
        />
        <UButton
          label="Lusa"
          color="neutral"
          :variant="filter.mode === 'day' && filter.date === tambahHari(hariIni(), 2) ? 'soft' : 'ghost'"
          size="sm"
          @click="setHari(2)"
        />
        <UButton
          label="7 hari"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="set7Hari"
        />
        <UButton
          label="Bulan ini"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="setBulanIni"
        />
        <UButton
          v-if="filterAktif"
          label="Reset filter"
          color="error"
          variant="soft"
          size="sm"
          @click="resetFilter"
        />
        <span class="text-sm text-muted">
          {{ angka(list.length) }} reservasi · {{ labelPeriode }}
          <template v-if="batal">
            · <b>{{ angka(batal) }}</b> dibatalkan tidak ditampilkan
          </template>
        </span>
      </div>
    </AppList>

    <p
      v-if="status === 'pending'"
      class="mb-3 text-muted"
    >
      Memuat data…
    </p>

    <!-- Phone -->
    <AppList
      v-if="tab === 'list'"
      class="lg:hidden"
    >
      <AppListRow
        v-for="r in halaman"
        :key="r.id"
        :title="r.name"
        :description="`${tglPendek(r.date)} ${r.time} · meja ${r.table || '—'} · ${statusPax(r)} pax · ${rupiah(dpTotal(r))}`"
        icon="i-lucide-calendar-days"
        :to="`/reservasi/input?id=${r.id}`"
      >
        <template #trailing>
          <AppStatus :color="statusWarna[r.status]">
            {{ r.status }}
          </AppStatus>
        </template>
      </AppListRow>
      <p
        v-if="!halaman.length"
        class="px-4 py-3 text-muted"
      >
        Tidak ada reservasi di saringan ini.
      </p>
    </AppList>

    <!-- Desktop -->
    <div
      v-if="tab === 'list'"
      class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block"
    >
      <UTable
        :data="halaman"
        :columns="kolom"
        :loading="status === 'pending'"
        empty="Tidak ada reservasi di saringan ini."
      >
        <template #name-cell="{ row }">
          <ULink
            :to="`/reservasi/input?id=${row.original.id}`"
            class="font-semibold text-highlighted underline-offset-4 hover:underline"
          >
            {{ row.original.name }}
          </ULink>
        </template>
        <template #pax-cell="{ row }">
          {{ statusPax(row.original) }}
        </template>
        <template #status-cell="{ row }">
          <AppStatus :color="statusWarna[row.original.status]">
            {{ row.original.status }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <UButton
            label="Buka"
            color="neutral"
            variant="ghost"
            size="sm"
            :to="`/reservasi/input?id=${row.original.id}`"
          />
        </template>
      </UTable>
    </div>

    <AppList
      v-if="tab === 'list'"
      title="Urut & halaman"
    >
      <div class="flex flex-wrap items-center gap-2 p-4">
        <UButton
          v-for="c in kolomUrut"
          :key="c.key"
          :label="urut.kolom === c.key ? `${c.label} ${urut.naik ? '↑' : '↓'}` : c.label"
          color="neutral"
          :variant="urut.kolom === c.key ? 'soft' : 'ghost'"
          size="sm"
          @click="urutkan(c.key)"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
        <div class="flex items-center gap-2 text-sm text-muted">
          <span>Baris per halaman</span>
          <USelect
            v-model.number="perHal"
            :items="[10, 25, 50]"
            class="w-20"
          />
        </div>
        <div class="flex items-center gap-2 text-sm text-muted">
          <UButton
            label="Sebelumnya"
            color="neutral"
            variant="soft"
            size="sm"
            :disabled="hal <= 1"
            @click="hal--"
          />
          <span class="num">Hal {{ hal }} dari {{ maxHal }}</span>
          <UButton
            label="Berikutnya"
            color="neutral"
            variant="soft"
            size="sm"
            :disabled="hal >= maxHal"
            @click="hal++"
          />
        </div>
      </div>
      <p class="px-4 pb-4 text-sm text-dimmed">
        Paging di browser: server v1 belum menerima <code class="text-dimmed">page</code>/
        <code class="text-dimmed">perPage</code>. <span class="text-dimmed">G-08</span>
      </p>
    </AppList>

    <template v-if="tab === 'calendar'">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <UButton
          label="‹"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="geserBulan(-1)"
        />
        <span class="min-w-40 text-center text-lg font-bold text-highlighted">{{ labelBulan }}</span>
        <UButton
          label="›"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="geserBulan(1)"
        />
        <UButton
          label="Bulan ini"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="bulan = hariIni().slice(0, 7)"
        />
        <USelect
          v-model="kalenderStatus"
          :items="[{ value: '', label: 'Semua (kecuali dibatalkan)' }, 'Pending', 'Confirmed', 'Datang', 'Cancelled', 'No-show']"
          class="max-w-52"
        />
      </div>

      <p
        v-if="kalenderDibatalkan"
        class="mb-3 text-sm text-muted"
      >
        <b>{{ kalenderDibatalkan }} reservasi dibatalkan</b> tidak ikut digambar — sama seperti
        tabel. Pilih “Cancelled” di atas untuk melihatnya.
      </p>

      <!-- Desktop: the month grid. -->
      <div class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block">
        <div class="grid grid-cols-7 divide-x divide-y divide-default border-b border-default">
          <div
            v-for="d in DOW"
            :key="d"
            class="px-2 py-1.5 text-xs font-semibold text-muted"
          >
            {{ d }}
          </div>
        </div>
        <div class="grid grid-cols-7">
          <button
            v-for="c in selBulan"
            :key="c.tgl"
            type="button"
            class="min-h-24 border-r border-b border-default p-2 text-start align-top"
            :class="c.dalam ? 'hover:bg-elevated/60' : 'bg-muted'"
            :disabled="!c.dalam"
            @click="pilihTanggal(c.tgl)"
          >
            <span
              class="num text-sm font-semibold"
              :class="c.tgl === hariIni() ? 'text-highlighted underline' : (c.dalam ? '' : 'text-dimmed')"
            >{{ c.num }}</span>
            <span
              v-for="r in c.list.slice(0, 3)"
              :key="r.id"
              class="mt-1 block truncate rounded-sm bg-default px-1 py-0.5 text-xs"
            >
              <b class="num">{{ r.time }}</b> {{ r.name }}
            </span>
            <span
              v-if="c.list.length > 3"
              class="mt-1 block text-xs text-dimmed"
            >
              +{{ c.list.length - 3 }} lagi
            </span>
          </button>
        </div>
      </div>

      <!-- Phone: a list of the days that have bookings, so nothing is clipped. -->
      <AppList class="lg:hidden">
        <AppListRow
          v-for="c in selBulan.filter(x => x.dalam && x.list.length)"
          :key="c.tgl"
          :title="tglPanjangLama(c.tgl)"
          :description="`${c.list.length} reservasi · ${paxHari(c.list)} pax`"
          :icon="c.tgl === hariIni() ? 'i-lucide-calendar-check-2' : 'i-lucide-calendar-days'"
          @click="pilihTanggal(c.tgl)"
        />
        <p
          v-if="!selBulan.some(x => x.dalam && x.list.length)"
          class="px-4 py-3 text-muted"
        >
          Belum ada reservasi di bulan ini.
        </p>
      </AppList>
    </template>

    <template v-else-if="tab === 'map'">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <UButton
          v-for="l in ([1, 2] as const)"
          :key="l"
          :label="`Lantai ${l}`"
          color="neutral"
          :variant="layerMap === l ? 'soft' : 'ghost'"
          size="sm"
          @click="layerMap = l"
        />
        <span class="text-sm text-muted">
          {{ tglPanjangLama(tglDenah) }} · {{ namaDenah }} · {{ ants.length }} di antrean<template
            v-if="ants.length"
          >, terlama {{ fmtMenit(tunggu(ants[0]!)) }}</template>
        </span>
        <template v-if="bolehDenah">
          <UButton
            :label="`Layout: ${namaDenah}${adaOverride ? ' (berbeda)' : ''}`"
            color="neutral"
            :variant="adaOverride ? 'soft' : 'ghost'"
            size="sm"
            @click="bukaLayout"
          />
          <UButton
            :label="`Editor denah: ${namaDenah}`"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="bukaEditor"
          />
        </template>
      </div>
      <p
        v-if="jejakPlan"
        class="mb-2 text-sm text-muted"
      >
        {{ jejakPlan }}
      </p>
      <p
        v-if="saringBerlaku"
        class="mb-3 rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-search"
          class="mr-1 inline size-4 align-text-bottom"
        />Mode melihat — denah sedang disaring, jadi sebagian reservasi disembunyikan dan
        meja yang terpakai bisa terlihat kosong. Karena itu
        <b>input dikunci</b> selama filter aktif: bersihkan filter dulu untuk menambah tamu
        atau pindah meja.
      </p>
      <DenahPeta
        v-if="denahTerpilih"
        :layout="denahTerpilih"
        :reservasi="semua ?? []"
        :tanggal="tglDenah"
        :hari-ini="hariIniMap"
        :timer="true"
        :nunggu="ants.length"
        :saring-aktif="saringBerlaku"
        :master="masterKunci"
        @buka="(resId) => { const r = baris(resId); if (r) bukaAksi(r) }"
        @pilih="(mejaId) => { if (bolehEdit) bukaWalkin(mejaId) }"
      />
    </template>

    <template v-else>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <UButton
          v-if="bolehEdit"
          label="Tambah ke waiting list"
          size="xl"
          @click="bukaAntrean"
        />
        <span class="text-sm text-muted">
          {{ tglPanjangLama(tglDenah) }} · {{ ants.length }} orang menunggu · {{ angka(paxAntrean) }} pax
        </span>
      </div>

      <AppList title="Antrean">
        <AppListRow
          v-for="(w, i) in ants"
          :key="w.id"
          :title="`${i + 1}. ${w.name} — ${w.pax} orang`"
          :description="`menunggu ${fmtMenit(tunggu(w))}${w.phone ? ` · ${w.phone}` : ''}${w.note ? ` · ${w.note}` : ''}`"
          icon="i-lucide-hourglass"
        >
          <template #trailing>
            <AppStatus
              :color="w.calledAt ? 'success' : 'neutral'"
            >
              {{ w.calledAt ? 'Sudah diberi tahu' : 'Belum diberi tahu' }}
            </AppStatus>
          </template>
        </AppListRow>
        <div
          v-if="ants.length && bolehEdit"
          class="flex flex-wrap gap-2 p-4"
        >
          <UButton
            v-for="w in ants"
            :key="`a-${w.id}`"
            :label="`Dudukkan ${w.name}`"
            color="neutral"
            variant="soft"
            size="sm"
            @click="bukaDudukkan(w)"
          />
          <UButton
            v-for="w in ants.filter(x => x.phone)"
            :key="`b-${w.id}`"
            :label="`Kabari ${w.name}`"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="panggil(w)"
          />
          <UButton
            v-for="w in ants"
            :key="`c-${w.id}`"
            :label="`Keluarkan ${w.name}`"
            color="error"
            variant="ghost"
            size="sm"
            @click="batalkanAntrean(w)"
          />
        </div>
        <p
          v-if="!ants.length"
          class="px-4 py-3 text-muted"
        >
          Antrean kosong.
        </p>
      </AppList>

      <AppList
        v-if="antreanLain.length"
        title="Antrean tanggal lain"
      >
        <AppListRow
          v-for="w in antreanLain"
          :key="w.id"
          :title="`${w.name} — ${w.pax} orang`"
          :description="`${tglPendek(w.date)} · menunggu ${fmtMenit(tunggu(w))}`"
          icon="i-lucide-hourglass"
          dim
        />
      </AppList>
    </template>

    <ResponsiveSheet
      v-model:open="sheetAntrean"
      title="Tambah ke waiting list"
      :description="tglPanjangLama(tglDenah)"
    >
      <div class="grid gap-3">
        <UFormField
          label="Nama"
          help="Kosongkan untuk walk-in cepat — tercatat sebagai “Walkin”"
        >
          <UInput
            v-model="antreanBaru.nama"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. WhatsApp (opsional)">
          <UInput
            v-model="antreanBaru.phone"
            inputmode="numeric"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Jumlah orang"
          required
        >
          <UInput
            v-model.number="antreanBaru.pax"
            type="number"
            :min="1"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Catatan (opsional)">
          <UInput
            v-model="antreanBaru.note"
            size="xl"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan ke antrean"
          size="xl"
          @click="simpanAntrean"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetAntrean = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetDudukkan"
      :title="`Dudukkan ${dudukkan?.name ?? ''}`"
      :description="dudukkan ? `${dudukkan.pax} orang · menunggu ${fmtMenit(tunggu(dudukkan))}` : ''"
    >
      <div class="space-y-3">
        <p
          v-if="saringBerlaku"
          class="text-sm text-muted"
        >
          Bersihkan filter dulu: meja tujuan dipilih dari denah, dan denah tersaring bisa
          menampilkan meja terpakai sebagai kosong.
        </p>
        <p
          v-if="dudukkan && !dudukkanMuat && dudukkanMeja"
          class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
        >
          {{ dudukkan.name }} berjumlah {{ dudukkan.pax }} orang, sedangkan meja
          {{ dudukkanMeja }} kapasitasnya {{ kapasitasMeja }}. Tetap didudukkan?
        </p>
        <DenahPeta
          v-else-if="denahTerpilih"
          :layout="denahTerpilih"
          :reservasi="semua ?? []"
          :tanggal="tglDenah"
          mode="pilih"
          :terpilih="dudukkanMeja ? [dudukkanMeja] : []"
          :master="masterKunci"
          :legenda="false"
          @pilih="(m) => (dudukkanMeja = m)"
        />
        <label class="flex items-center gap-2 text-sm">
          <input
            v-model="dudukkanSharing"
            type="checkbox"
          > Sharing table
        </label>
      </div>
      <template #footer>
        <UButton
          label="Dudukkan"
          size="xl"
          :disabled="!dudukkanMeja"
          @click="simpanDudukkan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetDudukkan = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetWA"
      title="Kirim koordinasi kedatangan"
      :description="`${tglPanjangLama(tglDenah)} · ${daftarKoord.length} reservasi · ${angka(daftarKoord.reduce((a, r) => a + (Number(r.pax) || 0), 0))} pax`"
    >
      <div class="space-y-3">
        <div class="flex flex-wrap items-end gap-2 rounded-lg border border-default p-3">
          <UFormField
            label="Dari"
            class="max-w-28"
          >
            <USelect
              v-model="coordDari"
              :items="jamOpsi"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Sampai"
            class="max-w-28"
          >
            <USelect
              v-model="coordSampai"
              :items="jamOpsi"
              class="w-full"
            />
          </UFormField>
          <UButton
            v-if="coordDari || coordSampai"
            label="Semua jam"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="coordDari = ''; coordSampai = ''"
          />
        </div>
        <p class="text-sm text-muted">
          Kosongkan rentang untuk merekap seluruh hari. Pakai rentang kalau hanya mau rekap satu
          shift, misalnya 18:00–23:30.
        </p>
        <p
          v-if="!daftarKoord.length"
          class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
        >
          Tidak ada reservasi pada rentang jam ini — longgarkan rentangnya.
        </p>
        <div
          v-for="t in tujuanKoord"
          :key="t.id"
          class="rounded-lg border border-default p-3"
        >
          <p class="font-semibold text-highlighted">
            {{ t.name }}
            <AppStatus
              class="ms-1"
              :color="t.includeDP ? 'success' : 'neutral'"
            >
              {{ t.includeDP ? 'fokus DP' : 'tanpa DP' }}
            </AppStatus>
          </p>
          <p class="text-sm text-muted">
            {{ t.type === 'group' ? 'Grup — salin pesan lalu tempel di grupnya' : `Nomor: ${t.detail || 'belum diisi'}` }}
          </p>
          <pre class="my-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">{{ teksUntuk(t) }}</pre>
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Salin pesan"
              color="neutral"
              variant="soft"
              size="sm"
              @click="(async () => {
                const ok = await waSalin(teksUntuk(t))
                toast.add({ title: ok ? 'Pesan disalin' : 'Gagal menyalin — pakai “Buka WhatsApp”', color: ok ? 'success' : 'error' })
              })()"
            />
            <UButton
              label="Buka WhatsApp"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="!daftarKoord.length"
              @click="kirimKoord(t)"
            />
          </div>
        </div>
        <p
          v-if="!tujuanKoord.length"
          class="text-sm text-muted"
        >
          <code>master.waTargets</code> kosong — grup tidak ada yang bisa dituju. Pesannya tetap bisa disalin di bawah.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetWA = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetLayout"
      :title="`Denah ${ltCfg(layerMap).nama}, ${tglPanjangLama(tglDenah)}`"
      description="Berlaku hanya tanggal ini — tanggal lain otomatis kembali ke bawaan hari."
    >
      <div class="space-y-3">
        <p class="text-sm text-muted">
          Pilih denah {{ ltCfg(layerMap).nama }} untuk {{ tglPanjangLama(tglDenah) }}. Lantai 1 dan
          Lantai 2 dijadwalkan sendiri-sendiri.
        </p>
        <label class="flex items-start gap-2.5 text-sm">
          <input
            v-model="pilihTemplate"
            type="radio"
            value=""
            class="mt-1"
          >
          <span>
            <b>Bawaan hari</b>
            <span class="block text-muted">Ikuti aturan hari — {{ defaultDayTypeLt(tglDenah, layerMap) }} — tidak ada perubahan khusus.</span>
          </span>
        </label>
        <label
          v-for="[lt, templat] in templateLt"
          v-show="lt === layerMap"
          :key="`tpl-${lt}`"
          class="flex items-start gap-2.5 text-sm"
        >
          <input
            v-model="pilihTemplate"
            type="radio"
            :value="templat[0]?.key"
            class="mt-1"
          >
          <span v-if="templat.length">
            <b>Template lantai {{ lt }}</b>
            <span class="block text-muted">
              Pilih salah satu:
            </span>
            <select
              v-model="pilihTemplate"
              class="mt-1 w-full rounded-lg border border-default bg-default p-2 text-sm"
            >
              <option
                v-for="t in templat"
                :key="t.key"
                :value="t.key"
              >
                {{ t.label }}
              </option>
            </select>
          </span>
        </label>

        <div class="flex flex-wrap gap-2 border-t border-default pt-3">
          <UButton
            label="Ubah denah khusus tanggal ini"
            color="neutral"
            variant="soft"
            size="sm"
            @click="bukaEditor"
          />
        </div>

        <div class="border-t border-default pt-3">
          <p class="text-sm font-semibold text-highlighted">
            Terapkan ke banyak tanggal
          </p>
          <p class="text-sm text-muted">
            Untuk perubahan meja yang sudah bisa direncanakan jauh hari.
          </p>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <UFormField
              label="Tanggal"
              class="max-w-44"
            >
              <UInput
                v-model="tanggalTambah"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UButton
              label="Tambahkan tanggal"
              color="neutral"
              variant="soft"
              size="sm"
              @click="tambahTanggalLayout"
            />
          </div>
        </div>

        <div class="border-t border-default pt-3">
          <p class="text-sm font-semibold text-highlighted">
            Tanggal terjadwal {{ ltCfg(layerMap).nama }} (hari ini ke depan)
          </p>
          <p
            v-if="!tanggalTercetak.length"
            class="text-sm text-muted"
          >
            Belum ada jadwal khusus untuk {{ ltCfg(layerMap).nama }}.
          </p>
          <div
            v-for="t in tanggalTercetak"
            :key="t.tgl"
            class="flex items-center justify-between gap-2 py-1.5 text-sm"
          >
            <span>
              <b>{{ tglPendek(t.tgl) }}</b> → {{ t.nama }}<template v-if="t.tgl === tglDenah">
                (dipilih)
              </template>
            </span>
            <UButton
              label="Kembalikan ke bawaan"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="bersihkanTanggal(t.tgl)"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <UButton
          label="Terapkan"
          size="xl"
          @click="simpanLayoutTgl"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetLayout = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetEditor"
      title="Editor denah"
      :description="editorKunci ? layoutName(master, editorKunci) : ''"
    >
      <p
        v-if="editorTanggal"
        class="mb-3 text-sm text-muted"
      >
        Menyimpan untuk {{ tglPanjangLama(editorTanggal.date) }} saja tidak mengubah template
        {{ layoutName(master, editorTemplat) }} — tanggal lain tidak ikut bergeser.
      </p>
      <DenahEditor
        v-if="editorSalinan"
        :layout="editorSalinan"
        :konteks="editorTanggal ? tglPanjangLama(editorTanggal.date) : undefined"
        :template-tanggal="layoutName(master, editorTemplat)"
        :bisa-ubah="bolehDenah"
        :jejak="jejakPlan"
        @simpan-templat="simpanKeTemplat"
        @simpan-tanggal="simpanUntukTanggal"
      />
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetAksi"
      :title="aksi?.name ?? 'Detail reservasi'"
      :description="aksi ? `${aksi.date} ${aksi.time} · meja ${aksi.table || '—'} · ${aksi.pax} pax` : ''"
    >
      <div
        v-if="aksi"
        class="space-y-2"
      >
        <p class="text-sm text-muted">
          <AppStatus :color="statusWarna[aksi.status]">
            {{ aksi.status }}
          </AppStatus>
          <span v-if="aksiDuduk"> · sudah masuk {{ arrivedPax(aksi) }} dari {{ aksi.pax }} orang</span>
        </p>
        <div class="flex flex-col gap-2">
          <UButton
            v-if="bolehEdit && ['Pending', 'Confirmed'].includes(aksi.status)"
            label="Tandai datang"
            size="xl"
            @click="bukaDatang(aksi, true)"
          />
          <UButton
            v-if="bolehEdit && aksiTelat"
            label="Follow up tamu (telat)"
            color="neutral"
            variant="soft"
            size="xl"
            disabled
          />
          <UButton
            v-if="bolehEdit && canAddArrival(aksi)"
            :label="`Tamu datang lagi (sisa ${remainingPax(aksi)})`"
            color="neutral"
            variant="soft"
            size="xl"
            @click="bukaDatang(aksi, false)"
          />
          <UButton
            v-if="bolehEdit && sedangDialihkan(aksi)"
            :label="`Kembali ke meja asli (${aksi.tableAsli})`"
            color="neutral"
            variant="soft"
            size="xl"
            @click="kembaliKeAsli(aksi)"
          />
          <UButton
            v-if="bolehEdit && aksiDuduk"
            label="Selesai (tamu pulang)"
            color="neutral"
            variant="soft"
            size="xl"
            @click="selesai(aksi)"
          />
          <UButton
            v-if="bolehEdit"
            :label="aksi.sharing ? 'Batalkan sharing' : 'Jadikan sharing'"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="toggleSharing(aksi)"
          />
          <UButton
            v-if="bolehEdit && aksi.table"
            label="Pindah meja"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="bukaPindah(aksi, 'move')"
          />
          <UButton
            v-if="bolehEdit && aksi.table"
            label="Tambah meja"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="bukaPindah(aksi, 'add')"
          />
          <UButton
            v-if="bolehEdit && !['Datang', 'Cancelled', 'No-show'].includes(aksi.status)"
            label="Batalkan reservasi"
            color="error"
            variant="soft"
            size="xl"
            @click="bukaBatal(aksi)"
          />
          <UButton
            label="Buka & sunting"
            color="neutral"
            variant="outline"
            size="xl"
            :to="`/reservasi/input?id=${aksi.id}`"
          />
        </div>
        <p
          v-if="sisaMejaAksi"
          class="text-sm text-muted"
        >
          Meja {{ sisaMejaAksi.id }} masih punya {{ sisaMejaAksi.sisa }} kursi kosong.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetAksi = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetDatang"
      :title="datangPertama ? 'Tamu datang' : 'Tamu datang lagi'"
      :description="aksi ? `${aksi.name} — dipesan ${aksi.pax} pax, sudah masuk ${arrivedPax(aksi)}` : ''"
    >
      <UFormField
        label="Jumlah orang yang masuk"
        required
      >
        <UInput
          v-model.number="paxDatangBaru"
          type="number"
          :min="1"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <p class="mt-2 text-sm text-muted">
        Batas atas {{ MAKS_PAX_GELOMBANG }} per catatan. Di atas itu bukan rombongan besar,
        tapi nomor HP yang tertempel.
      </p>
      <template #footer>
        <UButton
          label="Catat kedatangan"
          size="xl"
          @click="simpanDatang"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetDatang = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetPindah"
      :title="pindahMode === 'add' ? 'Tambah meja' : 'Pindah meja'"
      :description="aksi ? `${aksi.name} — ${pindahSels.length ? pindahSels.join(', ') : 'pilih meja tujuan'}` : ''"
    >
      <div class="space-y-3">
        <p
          v-if="saringBerlaku"
          class="text-sm text-muted"
        >
          Bersihkan filter dulu: meja tujuan dipilih dari denah, dan denah tersaring bisa
          menampilkan meja terpakai sebagai kosong.
        </p>
        <DenahPeta
          v-else-if="denahTerpilih"
          :layout="denahTerpilih"
          :reservasi="semua ?? []"
          :tanggal="aksi?.date ?? tglDenah"
          :jam="normTime(aksi?.time ?? '')"
          mode="pilih"
          :terpilih="pindahSels"
          :dipaksa="dipaksaPindah"
          :kecuali-id="aksiId"
          :master="masterKunci"
          :legenda="false"
          @pilih="pilihPindah"
          @tumpang="onTumpangPindah"
        />
        <p
          v-if="tanyaPindah"
          class="rounded-lg border border-default bg-default p-3 text-sm whitespace-pre-line text-default"
        >
          {{ tanyaPindah.pesan }}
        </p>
      </div>
      <template #footer>
        <UButton
          v-if="tanyaPindah"
          label="Tetap pakai meja"
          size="xl"
          @click="izinkanPindah"
        />
        <UButton
          v-else
          label="Simpan"
          size="xl"
          :disabled="!pindahSels.length"
          @click="simpanPindah"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="closePindah"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetWalkin"
      :title="`Walk-in di meja ${walkin.meja}`"
      description="Tamu tanpa nama tetap dicatat sebagai “Walkin”."
    >
      <div class="grid gap-3">
        <UFormField label="Nama (opsional)">
          <UInput
            v-model="walkin.nama"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. WhatsApp (opsional)">
          <UInput
            v-model="walkin.phone"
            inputmode="numeric"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Jumlah orang"
          required
        >
          <UInput
            v-model.number="walkin.pax"
            type="number"
            :min="1"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <label class="flex items-center gap-2 text-sm">
          <input
            v-model="walkin.sharing"
            type="checkbox"
          > Sharing table
        </label>
      </div>
      <template #footer>
        <UButton
          label="Simpan walk-in"
          size="xl"
          @click="simpanWalkin"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetWalkin = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetBatal"
      title="Batalkan reservasi?"
      :description="aksi ? `${aksi.name} — ${aksi.date} ${aksi.time}. Meja kembali tersedia.` : ''"
    >
      <UFormField
        label="Alasan (opsional, tapi selalu dicatat)"
      >
        <UTextarea
          v-model="alasanBatal"
          class="w-full"
          :rows="2"
          placeholder="mis. tamu membatalkan"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Ya, batalkan"
          color="error"
          size="xl"
          @click="simpanBatal"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetBatal = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
