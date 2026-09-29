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
import type { Reservasi, Waitlist } from '~/composables/useReservasi'
import { createReservation, patchReservation, postAudit, useDaftarReservasi, useDenah, useSection } from '~/composables/useReservasi'
import { bolehAksi, roleReservasi } from '~/utils/layar/reservasi'
import { arrivedPax, buatIzinTumpang, fmtMenit, harihOccupancy, isSeated, remainingPax, sedangDialihkan, tablesOf } from '~/utils/kunci-meja'
import { dpTotal, normPhone, uid } from '~/utils/dp-reservasi'
import { capMax, cariMeja, dayTypeLayout, dayTypeLayout2, getLayout, lantaiMap, kapasitasTanggal, layoutName } from '~/utils/venue-layouts'
import { angka, hariIni, normTime, rupiah, tglPendek, tambahHari } from '~/utils/format'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
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

const dari = computed(() => {
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

const { master } = useDenah()
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

// --- the day-of map, its quick actions, and the poll (`:2045-2242`, `:3089-3156`) ---

const { data: dineEstMin } = useSection<number>('dineEstMin')
const { data: clashLeadMin } = useSection<number>('clashLeadMin')
const { data: waitlist } = useSection<Waitlist[]>('waitlist')

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
const antreanHari = computed(() => (waitlist.value ?? [])
  .filter(w => w.status === 'waiting' && w.date === tglDenah.value)
  .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)))
const tunggu = (w: Waitlist) => Math.max(0, Math.round((Date.now() - (w.addedAt || 0)) / 60000))

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
async function catat(detail: string, res: string, action: string) {
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

const tglPanjangLama = computed(() => new Date(`${tglDenah.value}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))

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
        label="WA koordinasi"
        color="neutral"
        variant="soft"
        size="xl"
        disabled
      />
      <UButton
        v-if="bolehAksi('master', role)"
        label="Atur denah"
        color="neutral"
        variant="soft"
        size="xl"
        disabled
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

    <template v-if="tab === 'map'">
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
          {{ tglPanjangLama }} · {{ namaDenah }} · {{ ants.length }} di antrean<template
            v-if="ants.length"
          >, terlama {{ fmtMenit(tunggu(ants[0]!)) }}</template>
        </span>
      </div>
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

    <p
      v-else
      class="text-muted"
    >
      Tab {{ tab === 'calendar' ? 'Kalender' : 'Waiting list' }} sedang dibangun — lanjut di
      sesi berikutnya.
    </p>

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
