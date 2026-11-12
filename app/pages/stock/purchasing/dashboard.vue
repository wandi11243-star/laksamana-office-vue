<!--
  Stock › Purchasing › Monitor Order (old `deploy/stock/purchasing/index.html:161-162,283-285`).

  Queue cards per PO number, sub-tabs Per Item / Gabung per Vendor / Arsip
  Selesai. CK requests are excluded here (`pesananCK`: batchName
  'Central Kitchen' or `sumber === 'ck'`, old `:2908-2926`). WA drafts follow
  the old templates (`DEFAULT_TEMPLATE*`, old `:1572-1574`).
-->
<script setup lang="ts">
import { archiveOrders, catatLog, listOrders, useVendorStock, patchOrder, useProdukStock } from '~/composables/useStock'
import type { OrderStock, VendorStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { jam, tglLabel, tglPendek, ymdLokal } from '~/utils/format'
import { unduhCsvStock } from '~/utils/stock-catat'
import { warnaKategori } from '~/utils/kategori-warna'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['purchasing'] })

const toast = useToast()

const KAFE = 'Laksamana Muda'
const TEMPLATE_ITEM = 'Halo {vendor},\nBerikut orderan resmi dari {cafe}:\n\nINFO PESANAN\n- No. Order: {no_order}\n- Tgl Kedatangan: {tgl_datang}\n- PIC Kitchen: {pic}\n\nRINCIAN BARANG\n- {item} : {qty} {unit}\n- Catatan: {note}\n\nMohon dikonfirmasi ya. Terima kasih!'
const TEMPLATE_GABUNG = 'Halo {vendor},\nBerikut orderan gabungan resmi dari {cafe}:\n\nINFO PESANAN\n- Tgl Kedatangan: {tgl_datang}\n- PIC Kitchen: {pic}\n\nRINCIAN BARANG\n{items_list}\nMohon dikonfirmasi ketersediaan barang dan total tagihannya ya. Terima kasih!'

const sub = ref<'item' | 'vendor' | 'arsip'>('item')
const cari = ref('')
const tglDatang = ref('')
const tglSubmit = ref('')
const vendorAktif = ref('SEMUA')
const divisi = ref('SEMUA')
const laciFilter = ref(false)

/** Fixed divisions, like the old `DIVISI_RESMI` — never derived from data, so a
 *  typo on one old order cannot conjure a phantom filter button. */
const DIVISI = ['Kitchen', 'Bar', 'Floor']

/** Local "YYYY-MM-DD" N days from today — never UTC (`ymdLokal`, old `tglOffsetLokal`). */
const tglGeser = (hari: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + hari)
  return ymdLokal(d)
}
/** Quick chips fill the arrival-date filter (old `setQuickArrival`); pressing
 *  the active chip switches it back off. */
const qa = ref<number | null>(null)
function aturQa(hari?: number | null) {
  if (hari === null || hari === undefined) {
    tglDatang.value = ''
    return
  }
  const target = tglGeser(hari)
  tglDatang.value = tglDatang.value === target ? '' : target
}
watch(tglDatang, v => qa.value = [0, 1, 2].find(h => tglGeser(h) === v) ?? null, { immediate: true })

/** Old `normalizeDateToYYYYMMDD`: a "YYYY-MM-DD…" prefix wins, anything else is
 *  parsed as a date (submit stamps are full datetimes). */
const normalisasiTgl = (v?: string) => {
  if (!v) return ''
  const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return ymdLokal(new Date(String(v).trim()))
}
/** Submit time as ms; archive rows predate server-side archive stamps, so like
 *  the old fallback they sort by submit time (old `waktuArsip`). */
const waktuSubmit = (o: OrderStock) => Date.parse(o.timestamp || '') || 0
const labelSubmit = (ts?: string) => {
  if (!ts) return '—'
  const hari = normalisasiTgl(ts)
  return hari ? `${tglPendek(hari)} ${jam(ts)}` : '—'
}

/* Monitor Order reads only the active rows (±300) instead of every order
 *  ever (±4.300 in production); the archive tab pages on the server, and
 *  only its local-filter fallback (`arsipPenuhQ`) loads the whole archive. */
const ordersQ = useAsyncData('stock-purch-orders', () => listOrders({ status: 'Aktif' }), {
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const produkQ = useProdukStock()
const vendorQ = useVendorStock()

const sumberOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.sumber
const utamaOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.utama || ''
/** Product category for the coloured tag (empty → Lainnya). */
const katOf = (item: string) => (produkQ.data.value?.rows.find(p => p.nama === item)?.kategori || '').trim() || 'Lainnya'
const waOf = (nama: string) => vendorQ.data.value?.rows.find(v => v.nama === nama)?.whatsapp || ''

/** CK lines never appear in Monitor Order (old `pesananCK`). */
const bukanCk = (o: OrderStock) => (o.batchName || '') !== 'Central Kitchen' && sumberOf(o.item) !== 'ck'
const aktif = computed(() => (ordersQ.data.value?.rows ?? []).filter(o => bukanCk(o) && (o.status || 'Aktif') === 'Aktif' && !o.terarsip))
const arsip = computed(() => [...(ordersQ.data.value?.rows ?? []), ...(arsipPenuhQ.data.value?.rows ?? [])]
  .filter(o => bukanCk(o) && ((o.status || '') === 'Arsip' || o.terarsip)))

/* Archive tab reads its own server page (`GET /stock/orders` with paging):
 *  only server-supported filters travel (status/tim/tglDatang). The free-text
 *  search, the vendor-by-master dropdown and the submit-date filter have no
 *  server equivalent, so while any of them is active the tab falls back to
 *  the full fetch + local slice — never filtering silently inside one page. */
const arsipHal = ref(1)
const arsipPer = ref(50)
const arsipJatuhPenuh = computed(() => cari.value.trim() !== '' || tglSubmit.value !== '' || vendorAktif.value !== 'SEMUA')
const arsipPenuhQ = useAsyncData('stock-purch-arsip-penuh', () => (arsipJatuhPenuh.value
  ? listOrders({ status: 'Arsip' })
  : Promise.resolve({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> })), {
  watch: [arsipJatuhPenuh],
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi> }),
})
const arsipServerParams = computed(() => ({
  status: 'Arsip',
  tim: divisi.value !== 'SEMUA' ? divisi.value : undefined,
  tglDatang: tglDatang.value || undefined,
}))
/* Newest first (owner request, Nov 2026). The API orders by rowIndex, oldest
 *  first, and keeps no archive time — so page 1 here is the server's LAST page,
 *  reversed: the most recent orders lead. A 1-row probe reads the total. */
const arsipQ = useAsyncData('stock-purch-arsip', async () => {
  const intip = await listOrders({ ...arsipServerParams.value, page: 1, per_page: 1 })
  const halTerakhir = Math.max(1, Math.ceil((intip.total ?? 0) / arsipPer.value))
  const r = await listOrders({
    ...arsipServerParams.value,
    page: Math.max(1, halTerakhir - arsipHal.value + 1),
    per_page: arsipPer.value,
  })
  return { ...r, rows: [...r.rows].reverse() }
}, {
  watch: [arsipServerParams, arsipHal, arsipPer],
  default: () => ({ rows: [] as OrderStock[], versions: {} as Record<string, Versi>, total: undefined as number | undefined, page: undefined as number | undefined, perPage: undefined as number | undefined }),
})
/** Row versions from every list on screen (active, archive page, archive fallback). */
const versi = computed<Record<string, Versi>>(() => ({
  ...(arsipPenuhQ.data.value?.versions ?? {}),
  ...(arsipQ.data.value?.versions ?? {}),
  ...(ordersQ.data.value?.versions ?? {}),
}))
/* Back to page 1 whenever the archive tab is entered or its filters change —
 *  the server page numbering restarts from the new result set. */
watch([sub, divisi, tglDatang, vendorAktif, cari, tglSubmit], () => {
  arsipHal.value = 1
})
/* Tab count, badge and stat read the server total; the local fallback reads
 *  the filtered length instead, so both modes stay honest. */
const arsipTotal = computed(() => arsipJatuhPenuh.value
  ? saring(arsip.value, true).length
  : (arsipQ.data.value?.total ?? arsip.value.length))
/** Newer order first: higher rowIndex, then the later submit. */
const lebihBaru = (a: OrderStock, b: OrderStock) => ((b.rowIndex ?? -1) - (a.rowIndex ?? -1)) || (waktuSubmit(b) - waktuSubmit(a))
const arsipPotongLokal = computed(() => {
  const semua = saring(arsip.value, true).sort(lebihBaru)
  return semua.slice((arsipHal.value - 1) * arsipPer.value, arsipHal.value * arsipPer.value)
})

const saring = (rows: OrderStock[], pakaiDivisi: boolean) => {
  const q = cari.value.trim().toLowerCase()
  return rows.filter(o =>
    (!q || [o.nomorOrder, o.item, o.batchName, utamaOf(o.item)].join(' ').toLowerCase().includes(q))
    && (vendorAktif.value === 'SEMUA' || utamaOf(o.item) === vendorAktif.value)
    && (!pakaiDivisi || divisi.value === 'SEMUA' || (o.tim || '') === divisi.value)
    && (!tglDatang.value || (o.tglDatang || '') === tglDatang.value)
    && (!tglSubmit.value || normalisasiTgl(o.timestamp) === tglSubmit.value),
  )
}

/** Badge number on the Filter button: hidden while zero (old `hitungFilterAktif`). */
const hitungFilter = computed(() =>
  (vendorAktif.value !== 'SEMUA' ? 1 : 0)
  + (divisi.value !== 'SEMUA' ? 1 : 0)
  + (tglSubmit.value ? 1 : 0)
  + (tglDatang.value ? 1 : 0),
)
function resetSemuaFilter() {
  vendorAktif.value = 'SEMUA'
  divisi.value = 'SEMUA'
  tglSubmit.value = ''
  tglDatang.value = ''
  toast.add({ title: 'Filter direset', description: 'Menampilkan seluruh pesanan kembali.', color: 'info' })
}

/* Tab counts mirror the old sub-tab pills: Per Item counts rows, Gabung counts
 * unique vendor|arrival groups (unmapped vendors excluded, as old
 * `getActiveConsolidatedCount`), Arsip counts rows. Unfiltered, like old
 * `updateSubTabCounts`. */
const hitungItem = computed(() => aktif.value.length)
const hitungVendor = computed(() => {
  const grup = new Set<string>()
  for (const o of aktif.value) {
    const v = utamaOf(o.item)
    if (!v) continue
    grup.add(`${v}|${o.tglDatang || ''}`)
  }
  return grup.size
})
/** Active rows per main vendor, for the drawer dropdown (old `initFilters`). */
const jmlVendor = computed(() => {
  const m: Record<string, number> = {}
  for (const o of aktif.value) {
    const v = utamaOf(o.item)
    if (!v) continue
    m[v] = (m[v] || 0) + 1
  }
  return m
})
const daftarVendor = computed(() => [...new Set([
  ...(vendorQ.data.value?.rows ?? []).map(v => v.nama),
  ...Object.keys(jmlVendor.value),
])].sort((a, b) => a.localeCompare(b)))

interface Po { kunci: string, nama: string, tgl: string, baris: OrderStock[] }
const poItem = computed<Po[]>(() => {
  const grup = new Map<string, Po>()
  for (const o of saring(aktif.value, true)) {
    const kunci = o.batchId || o.nomorOrder
    let po = grup.get(kunci)
    if (!po) {
      po = { kunci, nama: o.batchName || kunci, tgl: o.tglDatang || '', baris: [] }
      grup.set(kunci, po)
    }
    po.baris.push(o)
  }
  return [...grup.values()].sort((a, b) => (a.tgl < b.tgl ? 1 : -1))
})
/* Archive reads as "what arrived each day": grouped by arrival date (submit
 *  date when that is missing), days newest-archived first, then one expandable
 *  card per batch inside each day — old `:3106-3162`. Expanding toggles
 *  visibility only (`v-show`), never redraws the list (old `toggleArsipBatch`). */
interface BatchArsip { kunci: string, nama: string, asli: boolean, pic: string, ts: string, divisi: string, baris: OrderStock[] }
interface HariArsip { hari: string, baris: OrderStock[], divisi: { nama: string, jumlah: number }[], batch: BatchArsip[] }
/* Archive grouping (day → batch) runs over one page of rows only: the
 *  server page in server mode, the local slice in full-fetch fallback. */
function kelompokArsip(rows: OrderStock[]): HariArsip[] {
  const perHari = new Map<string, OrderStock[]>()
  for (const o of rows) {
    const hari = normalisasiTgl(o.tglDatang) || normalisasiTgl(o.timestamp) || '-'
    const l = perHari.get(hari)
    if (l) l.push(o)
    else perHari.set(hari, [o])
  }
  const keluar: HariArsip[] = []
  for (const [hari, barisAsli] of perHari) {
    const baris = [...barisAsli].sort(lebihBaru)
    const hit: Record<string, number> = {}
    for (const o of baris) {
      const d = o.tim || '(Lainnya)'
      hit[d] = (hit[d] || 0) + 1
    }
    /* One batch = one send; old rows without a batchId fall back to PIC +
     * submit minute, the same grouping the Ordering page uses. */
    const perBatch = new Map<string, BatchArsip>()
    for (const o of baris) {
      const bid = (o.batchId || '').trim()
      const mentah = bid || `~${o.pic || ''}|${(o.timestamp || '').slice(0, 16)}`
      let b = perBatch.get(mentah)
      if (!b) {
        b = { kunci: `${hari}|${mentah}`, nama: o.batchName || '', asli: !!bid, pic: o.pic || '', ts: o.timestamp || '', divisi: o.tim || '', baris: [] }
        perBatch.set(mentah, b)
      }
      b.baris.push(o)
    }
    keluar.push({
      hari,
      baris,
      divisi: Object.entries(hit).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => a.nama.localeCompare(b.nama)),
      batch: [...perBatch.values()],
    })
  }
  // A day sits where its newest order sits, so the latest archive leads.
  const terbaru = (h: HariArsip) => h.baris.reduce((m, o) => Math.max(m, o.rowIndex ?? waktuSubmit(o)), -1)
  return keluar.sort((a, b) => (terbaru(b) - terbaru(a)) || (a.hari < b.hari ? 1 : -1))
}
const arsipHari = computed<HariArsip[]>(() => kelompokArsip(
  arsipJatuhPenuh.value
    ? arsipPotongLokal.value
    : saring((arsipQ.data.value?.rows ?? []).filter(bukanCk), true),
))
const arsipBuka = ref<Record<string, boolean>>({})
function tukarArsipBatch(kunci: string) {
  arsipBuka.value[kunci] = !arsipBuka.value[kunci]
}
interface GrupVendor { vendor: string, tgl: string, baris: OrderStock[] }
const poVendor = computed<GrupVendor[]>(() => {
  const grup = new Map<string, GrupVendor>()
  /* The division filter is deliberately ignored here: one message goes out per
   * vendor covering every division (old `:2998`). */
  for (const o of saring(aktif.value, false)) {
    const v = utamaOf(o.item) || '(tanpa vendor utama)'
    const kunci = `${v}|${o.tglDatang || ''}`
    let g = grup.get(kunci)
    if (!g) {
      g = { vendor: v, tgl: o.tglDatang || '', baris: [] }
      grup.set(kunci, g)
    }
    g.baris.push(o)
  }
  return [...grup.values()].sort((a, b) => (a.tgl < b.tgl ? 1 : -1))
})

// --- actions --------------------------------------------------------------------
const sibuk = ref(false)
async function segarkan(pesan?: string) {
  await Promise.all([ordersQ.refresh(), arsipQ.refresh(), ...(arsipJatuhPenuh.value ? [arsipPenuhQ.refresh()] : [])])
  if (pesan) toast.add({ title: pesan, color: 'success' })
}

async function arsipkanBatch(ids: string[], buka: boolean) {
  sibuk.value = true
  try {
    const r = await archiveOrders(ids, buka)
    await catatLog([{ modul: 'purchasing', aksi: buka ? 'buka_arsip' : 'arsip', ringkas: `${r.updated} baris` }])
    await segarkan(buka ? 'Arsip dibuka' : 'Batch diarsipkan')
  }
  catch (e) {
    toast.add({ title: 'Gagal mengarsipkan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const sheetJemput = ref(false)
const jemputNomor = ref('')
const jemputTgl = ref('')
function bukaJemput(o: OrderStock) {
  jemputNomor.value = o.nomorOrder
  jemputTgl.value = o.tglJemput || ''
  sheetJemput.value = true
}
async function simpanJemput() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jemputTgl.value)) {
    toast.add({ title: 'Format tanggal jemput harus YYYY-MM-DD', color: 'error' })
    return
  }
  try {
    await patchOrder(jemputNomor.value, { tglJemput: jemputTgl.value }, versi.value[jemputNomor.value])
    sheetJemput.value = false
    await segarkan('Tanggal jemput tersimpan')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
}

async function tandaiDatang(o: OrderStock) {
  try {
    await patchOrder(o.nomorOrder, { kedatangan: 'Datang' }, versi.value[o.nomorOrder])
    await segarkan('Ditandai datang')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => ordersQ.refresh()))) toast.add({ title: 'Gagal menandai', description: apiErrorMessage(e), color: 'error' })
  }
}

// --- WA drafts --------------------------------------------------------------------
const sheetWa = ref(false)
const waTeks = ref('')
const waLink = ref('')
function drafItem(o: OrderStock, vendor: string) {
  const no = waOf(vendor)
  if (!no) {
    toast.add({ title: 'Pengiriman gagal', description: `Nomor WhatsApp vendor "${vendor}" belum diatur di database.`, color: 'error' })
    return
  }
  const teks = TEMPLATE_ITEM
    .replaceAll('{vendor}', vendor).replaceAll('{cafe}', KAFE)
    .replaceAll('{no_order}', o.nomorOrder).replaceAll('{tgl_datang}', o.tglDatang || '-')
    .replaceAll('{pic}', o.pic || '-').replaceAll('{item}', o.item)
    .replaceAll('{qty}', String(o.qty)).replaceAll('{unit}', o.unit || '')
    .replaceAll('{note}', o.note || '-')
  waTeks.value = teks
  waLink.value = `https://api.whatsapp.com/send?phone=${no}&text=${encodeURIComponent(teks)}`
  sheetWa.value = true
}
function drafGabung(g: GrupVendor) {
  const no = waOf(g.vendor)
  if (!no) {
    toast.add({ title: 'Pengiriman gagal', description: `Nomor WhatsApp vendor "${g.vendor}" belum diatur di database.`, color: 'error' })
    return
  }
  const pics = [...new Set(g.baris.map(o => o.pic).filter(Boolean))].join(', ') || '-'
  const daftar = g.baris.map(o => `- ${o.item} : ${o.qty} ${o.unit || ''}`).join('\n')
  const teks = TEMPLATE_GABUNG
    .replaceAll('{vendor}', g.vendor).replaceAll('{cafe}', KAFE)
    .replaceAll('{tgl_datang}', g.tgl || '-').replaceAll('{pic}', pics)
    .replaceAll('{items_list}', daftar)
  waTeks.value = teks
  waLink.value = `https://api.whatsapp.com/send?phone=${no}&text=${encodeURIComponent(teks)}`
  sheetWa.value = true
}

const vendorPilih = ref<Record<string, string>>({})

/* Rich item cards (old `renderIndividualCard:3394-3524`, `pilihVendorHari:3302`,
 * `pitaVendorTutup`, `kotakJadwalJemput`). Everything reads the vendor + product
 * masters already loaded above — no new fetch. */

/** Day names share `Date.getDay()` numbering (0 Sunday), like the old `HARI_NAMA`. */
const HARI_NAMA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const vendorMap = computed<Record<string, VendorStock>>(() => {
  const m: Record<string, VendorStock> = {}
  for (const v of vendorQ.data.value?.rows ?? []) m[v.nama] = v
  return m
})

/** Closed days of a vendor, normalised to 0–6 (old `tutupHariOf`). */
const tutupHariOf = (nama: string) => {
  const raw = vendorMap.value[nama]?.tutupHari as unknown
  const l = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split(',') : [])
  const out: number[] = []
  for (const x of l) {
    const n = parseInt(String(x), 10)
    if (n >= 0 && n <= 6 && !out.includes(n)) out.push(n)
  }
  return out.sort()
}
/** Weekday of a date string, null when unreadable — never guessed as open (old `hariDari`). */
const hariDari = (tgl?: string) => {
  const s = normalisasiTgl(tgl)
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.getDay()
}
const vendorTutupPada = (nama: string, tgl?: string) => {
  const h = hariDari(tgl)
  if (h === null) return false
  return tutupHariOf(nama).includes(h)
}
/** Which vendor serves this arrival date: the main one while open, else the
 *  first open backup in purchasing's priority order (old `pilihVendorHari`). */
const pilihVendorHari = (utama: string, cadangan: string[], tgl?: string) => {
  if (!vendorTutupPada(utama, tgl)) return { pakai: utama, tutup: false, adaGanti: false }
  const ganti = (cadangan ?? []).find(v => vendorMap.value[v] && v !== utama && !vendorTutupPada(v, tgl))
  return { pakai: ganti || utama, tutup: true, adaGanti: !!ganti }
}
const hariNama = (tgl?: string) => {
  const h = hariDari(tgl)
  return h === null ? 'hari itu' : HARI_NAMA[h]
}

/* The old net always filtered CK lines out of Monitor Order; these stay as a
 * safety net for rows whose batch name went missing server-side (old `:3398-3411`). */
const produkOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)
const cadanganOf = (item: string) => produkOf(item)?.cadangan ?? []
const utamaVend = (o: OrderStock) => utamaOf(o.item)
const dariCk = (o: OrderStock) => (o.batchName || '') === 'Central Kitchen' || sumberOf(o.item) === 'ck'
const tanpaVendor = (o: OrderStock) => !utamaVend(o)
const onlineTanpaVendor = (o: OrderStock) => tanpaVendor(o) && (produkOf(o.item)?.caraBeli || '') === 'online'
const pilihanHari = (o: OrderStock) => pilihVendorHari(utamaVend(o), cadanganOf(o.item), o.tglDatang)
/** Dropdown options: closed vendors stay selectable, just labelled (old `opsiVendorHari`). */
const opsiVendor = (o: OrderStock) => {
  const utama = utamaVend(o)
  const ket = (v: string) => vendorTutupPada(v, o.tglDatang) ? ' — TUTUP hari ini' : ''
  const keluar = utama ? [{ value: utama, label: `Utama: ${utama}${ket(utama)}` }] : []
  for (const v of cadanganOf(o.item)) {
    if (!vendorMap.value[v] || v === utama) continue
    keluar.push({ value: v, label: `Alternatif: ${v}${ket(v)}` })
  }
  return keluar
}
/** Effective vendor: the shopper's pick, defaulting to the vendor open on the arrival date. */
const vendorEfektif = (o: OrderStock) => vendorPilih.value[o.nomorOrder] || pilihanHari(o).pakai || utamaVend(o)
/** The pickup date is judged on the MAIN vendor, never the dropdown pick (old `:3236-3249`). */
const perluJadwal = (o: OrderStock) => !dariCk(o) && !tanpaVendor(o) && !!vendorMap.value[utamaVend(o)]?.perluJadwalJemput
/** Rows blocking a batch archive: pickup-mandatory vendor, date still empty (old `:3470-3477`). */
const kunciArsip = (rows: OrderStock[]) => rows.filter(o => perluJadwal(o) && !o.tglJemput)
const ikonTim = (tim?: string) => tim === 'Kitchen' ? 'i-lucide-cooking-pot' : tim === 'Bar' ? 'i-lucide-martini' : tim === 'Floor' ? 'i-lucide-armchair' : 'i-lucide-tag'

function unduhCsv() {
  const sel = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  const rows = sub.value === 'arsip' ? arsipHari.value.flatMap(h => h.baris) : poItem.value.flatMap(p => p.baris)
  unduhCsvStock(
    'monitor-order.csv',
    ['No order,Batch,Barang,Jumlah,Satuan,Tgl datang,Kedatangan,Tim,PIC',
      ...rows.map(o => [o.nomorOrder, o.batchName || '', o.item, String(o.qty), o.unit || '', o.tglDatang || '', o.kedatangan || '', o.tim || '', o.pic || ''].map(sel).join(','))].join('\n'),
  )
}
</script>

<template>
  <AppPage
    title="Monitor Order"
    description="Antrean pesanan bahan baku"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="segarkan()"
      />
      <UButton
        label="Unduh CSV"
        icon="i-lucide-download"
        variant="outline"
        @click="unduhCsv"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Antrean aktif"
        :value="String(aktif.length)"
        satuan="baris"
        icon="i-lucide-clipboard-list"
        tone="warning"
      />
      <AppStat
        label="PO terbuka"
        :value="String(poItem.length)"
        satuan="PO"
        icon="i-lucide-package"
        tone="info"
      />
      <AppStat
        label="Arsip selesai"
        :value="String(arsipTotal)"
        satuan="baris"
        icon="i-lucide-archive"
        tone="success"
      />
    </AppStatGrid>

    <AppPanel title="Antrean">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="[
            { value: 'item', label: 'Per item', icon: 'i-lucide-list', jumlah: hitungItem },
            { value: 'vendor', label: 'Gabung per vendor', icon: 'i-lucide-store', jumlah: hitungVendor },
            { value: 'arsip', label: 'Arsip selesai', icon: 'i-lucide-archive', badge: arsipTotal },
          ]"
        />
      </template>
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari no. PO / vendor / barang…"
          class="min-w-45 flex-1"
        />
        <AppChips
          :model-value="qa"
          :options="[
            { value: 0, label: 'Hari Ini' },
            { value: 1, label: 'Besok' },
            { value: 2, label: 'Lusa' },
          ]"
          @update:model-value="aturQa"
        />
        <UButton
          icon="i-lucide-funnel"
          variant="outline"
          @click="laciFilter = !laciFilter"
        >
          Filter
          <span
            v-show="hitungFilter > 0"
            class="rounded-full bg-error px-1.5 text-[11px] font-bold text-white num"
          >{{ hitungFilter }}</span>
        </UButton>
      </div>

      <div
        v-show="laciFilter"
        class="mt-3 border-t border-default pt-3"
      >
        <AppFilterGrid>
          <UFormField label="Vendor">
            <template #label>
              <span class="inline-flex items-center gap-1"><UIcon
                name="i-lucide-store"
                class="size-3.5"
              />Vendor</span>
            </template>
            <USelect
              v-model="vendorAktif"
              :items="[{ value: 'SEMUA', label: `Semua Vendor (${aktif.length})` }, ...daftarVendor.map(v => ({ value: v, label: jmlVendor[v] ? `${v} (${jmlVendor[v]})` : v }))]"
            />
          </UFormField>
          <UFormField label="Divisi pemesan">
            <template #label>
              <span class="inline-flex items-center gap-1"><UIcon
                name="i-lucide-users"
                class="size-3.5"
              />Divisi pemesan</span>
            </template>
            <USelect
              v-model="divisi"
              :items="[{ value: 'SEMUA', label: 'Semua Divisi' }, ...DIVISI.map(d => ({ value: d, label: d }))]"
            />
          </UFormField>
          <UFormField label="Tgl submit">
            <template #label>
              <span class="inline-flex items-center gap-1"><UIcon
                name="i-lucide-send-horizontal"
                class="size-3.5"
              />Tgl submit</span>
            </template>
            <UInput
              v-model="tglSubmit"
              type="date"
            />
          </UFormField>
          <UFormField label="Tgl kedatangan">
            <template #label>
              <span class="inline-flex items-center gap-1"><UIcon
                name="i-lucide-calendar-days"
                class="size-3.5"
              />Tgl kedatangan</span>
            </template>
            <UInput
              v-model="tglDatang"
              type="date"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="mt-2.5 flex justify-end">
          <UButton
            label="Reset Semua Filter"
            icon="i-lucide-x"
            size="sm"
            variant="outline"
            @click="resetSemuaFilter"
          />
        </div>
      </div>

      <div
        v-if="sub !== 'arsip'"
        class="mt-3 flex flex-col gap-3"
      >
        <p
          v-if="sub === 'vendor' && divisi !== 'SEMUA'"
          class="rounded-xl border-l-4 border-warning bg-warning/10 px-4 py-2.5 text-xs font-semibold text-warning"
        >
          Filter divisi {{ divisi }} sengaja diabaikan di tampilan ini — pesanan dikirim satu pesan per vendor, mencakup semua divisi. Pakai tab Per item untuk melihat per divisi.
        </p>
        <AppPanel
          v-for="po in (sub === 'item' ? poItem : [])"
          :key="po.kunci"
          bersarang
          :title="po.nama"
          :description="`Rencana datang ${po.tgl ? tglPendek(po.tgl) : '—'} · ${po.baris.length} baris`"
        >
          <template #head>
            <UButton
              label="Arsipkan"
              icon="i-lucide-archive"
              size="sm"
              variant="outline"
              :loading="sibuk"
              :disabled="sibuk || kunciArsip(po.baris).length > 0"
              :title="kunciArsip(po.baris).length ? 'Isi tanggal jemput dulu' : ''"
              @click="arsipkanBatch(po.baris.map(b => b.nomorOrder), false)"
            />
          </template>
          <p
            v-if="kunciArsip(po.baris).length"
            class="mb-2 rounded-xl border-l-4 border-warning bg-warning/10 px-3 py-2 text-xs font-semibold text-warning"
          >
            Arsip terkunci — isi tanggal jemput dulu untuk: {{ kunciArsip(po.baris).map(o => o.item).join(', ') }}. Vendornya tidak bisa dijemput di hari yang sama.
          </p>
          <div class="flex flex-col gap-3">
            <!-- One order line, laid out sideways like the old Monitor Order:
                 what was asked on the left, what purchasing does on the right
                 (vendor + big buttons, easy to hit). -->
            <div
              v-for="o in po.baris"
              :key="o.nomorOrder"
              class="grid gap-4 rounded-xl border border-default border-l-4 bg-default p-4 shadow-panel lg:grid-cols-[minmax(0,1fr)_280px]"
              :class="tanpaVendor(o) && !dariCk(o) && !onlineTanpaVendor(o) ? 'border-l-error' : 'border-l-gold'"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted">{{ o.nomorOrder }}</span>
                  <span
                    class="text-[11px] font-extrabold uppercase tracking-wider"
                    :class="tanpaVendor(o) ? 'text-dimmed' : 'text-gold-deep'"
                  >{{ tanpaVendor(o) ? 'Tidak terdaftar' : utamaVend(o) }}</span>
                  <span
                    v-if="cadanganOf(o.item).length"
                    class="rounded-full bg-default px-2 py-0.5 text-[10px] font-bold text-muted"
                  >{{ cadanganOf(o.item).length }} vendor alternatif</span>
                  <span class="ml-auto">
                    <AppStatus
                      :color="(o.kedatangan || '') === 'Datang' ? 'success' : 'warning'"
                      size="sm"
                    >
                      {{ (o.kedatangan || '') === 'Datang' ? 'Datang' : 'Menunggu' }}
                    </AppStatus>
                  </span>
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-2">
                  <p class="text-lg font-bold text-highlighted">
                    {{ o.item }}
                  </p>
                  <span
                    class="rounded-md px-2 py-0.5 text-[11px] font-bold"
                    :class="warnaKategori(katOf(o.item))"
                  >{{ katOf(o.item) }}</span>
                </div>
                <p class="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Diminta kitchen
                </p>
                <p class="font-display text-3xl font-extrabold leading-none text-gold-deep num">
                  {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
                </p>
                <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-default pt-3 text-xs text-muted">
                  <span class="inline-flex items-center gap-1">
                    <UIcon
                      name="i-lucide-truck"
                      class="size-3.5"
                    />Kedatangan: <b class="text-highlighted">{{ o.tglDatang ? tglPendek(o.tglDatang) : '—' }}</b>
                  </span>
                  <span v-if="o.tglJemput">Dijemput: <b class="text-highlighted">{{ tglPendek(o.tglJemput) }}</b></span>
                  <span v-if="o.pic">PIC: <b class="text-highlighted">{{ o.pic }}</b></span>
                  <AppStatus
                    v-if="o.tim && o.tim !== '(Lainnya)'"
                    color="gold"
                    size="sm"
                    :icon="ikonTim(o.tim)"
                  >
                    Tim {{ o.tim }}
                  </AppStatus>
                </div>
                <p class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-[11px] font-bold text-warning">
                  <UIcon
                    name="i-lucide-calendar-clock"
                    class="size-3.5"
                  />
                  Submit: {{ labelSubmit(o.timestamp) }}
                </p>
                <p
                  v-if="o.note && o.note !== '-'"
                  class="mt-2 rounded-lg bg-muted px-2.5 py-2 text-xs italic text-muted"
                >
                  <b class="not-italic">Catatan kitchen:</b> "{{ o.note }}"
                </p>
              </div>

              <div class="flex flex-col gap-2 lg:border-l lg:border-default lg:pl-4">
                <div
                  v-if="dariCk(o)"
                  class="rounded-xl border-l-4 border-success bg-success/10 px-3 py-2 text-xs font-semibold leading-relaxed text-success"
                >
                  Barang Central Kitchen — diproduksi dapur sendiri, tidak dipesan ke vendor.
                </div>
                <template v-else-if="!tanpaVendor(o)">
                  <p
                    v-if="pilihanHari(o).tutup && pilihanHari(o).adaGanti"
                    class="rounded-xl border-l-4 border-warning bg-warning/10 px-3 py-2 text-xs font-semibold leading-relaxed text-warning"
                  >
                    {{ utamaVend(o) }} tutup hari {{ hariNama(o.tglDatang) }} — dialihkan ke {{ pilihanHari(o).pakai }} yang buka.
                  </p>
                  <p
                    v-else-if="pilihanHari(o).tutup"
                    class="rounded-xl border-l-4 border-error bg-error/10 px-3 py-2 text-xs font-semibold leading-relaxed text-error"
                  >
                    {{ utamaVend(o) }} tutup hari {{ hariNama(o.tglDatang) }}, tanpa vendor alternatif yang buka. Tambahkan alternatif di Database &amp; Vendor, atau geser tanggalnya.
                  </p>
                  <label class="text-[10px] font-bold uppercase tracking-wider text-muted">Kirim via vendor</label>
                  <USelect
                    :model-value="vendorPilih[o.nomorOrder] ?? pilihanHari(o).pakai"
                    :items="opsiVendor(o)"
                    class="w-full"
                    @update:model-value="vendorPilih[o.nomorOrder] = String($event)"
                  />
                  <UButton
                    label="Kirim draf WhatsApp"
                    icon="i-lucide-message-circle"
                    color="success"
                    size="lg"
                    block
                    @click="drafItem(o, vendorEfektif(o))"
                  />
                </template>
                <div
                  v-else-if="onlineTanpaVendor(o)"
                  class="rounded-xl border-l-4 border-info bg-info/10 px-3 py-2 text-xs font-semibold leading-relaxed text-info"
                >
                  Dibeli online — tidak perlu vendor tetap. Centang di tab Barang online begitu barangnya sampai.
                </div>
                <div
                  v-else
                  class="rounded-xl border-l-4 border-error bg-error/10 px-3 py-2 text-xs font-semibold leading-relaxed text-error"
                >
                  Bahan baku ini belum dipetakan ke vendor mana pun. Atur dulu di tab Database.
                </div>
                <div
                  v-if="perluJadwal(o)"
                  class="rounded-xl border-l-4 border-warning bg-warning/10 px-3 py-2 text-xs font-semibold leading-relaxed text-warning"
                >
                  Tidak bisa dijemput di hari yang sama. Jemput: <b>{{ o.tglJemput ? tglPendek(o.tglJemput) : 'belum diisi — arsip terkunci' }}</b>.
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <UButton
                    label="Tgl jemput"
                    icon="i-lucide-car"
                    color="neutral"
                    variant="soft"
                    size="lg"
                    block
                    @click="bukaJemput(o)"
                  />
                  <UButton
                    v-if="(o.kedatangan || '') !== 'Datang'"
                    label="Tandai datang"
                    icon="i-lucide-package-check"
                    color="neutral"
                    variant="soft"
                    size="lg"
                    block
                    @click="tandaiDatang(o)"
                  />
                </div>
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          v-for="g in (sub === 'vendor' ? poVendor : [])"
          :key="`${g.vendor}|${g.tgl}`"
          bersarang
          :title="g.vendor"
          :description="`${g.tgl ? `Datang ${tglPendek(g.tgl)} · ` : ''}${g.baris.length} baris`"
        >
          <ul class="flex flex-col divide-y divide-default rounded-xl bg-default px-4 shadow-panel">
            <li
              v-for="o in g.baris"
              :key="o.nomorOrder"
              class="flex flex-wrap items-center gap-2 py-2.5"
            >
              <span class="min-w-0 flex-1">
                <b class="text-sm text-highlighted">{{ o.item }}</b>
                <span class="text-xs text-muted"> · {{ o.pic || '—' }}</span>
              </span>
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-bold"
                :class="warnaKategori(katOf(o.item))"
              >{{ katOf(o.item) }}</span>
              <b class="w-20 text-right text-base text-gold-deep num">{{ o.qty }} {{ o.unit }}</b>
            </li>
          </ul>
          <UButton
            :label="`Kirim chat borongan (${g.baris.length} item)`"
            icon="i-lucide-message-circle"
            color="success"
            size="lg"
            block
            class="mt-3"
            @click="drafGabung(g)"
          />
        </AppPanel>
        <p
          v-if="sub === 'item' && !poItem.length"
          class="text-sm text-dimmed"
        >
          Antrean kosong.
        </p>
        <p
          v-if="sub === 'vendor' && !poVendor.length"
          class="text-sm text-dimmed"
        >
          Antrean kosong.
        </p>
      </div>

      <div
        v-else
        class="mt-3 flex flex-col gap-3"
      >
        <div
          v-for="h in arsipHari"
          :key="h.hari"
          class="flex flex-col gap-2"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-shell px-4 py-2.5">
            <p class="text-sm font-bold text-highlighted">
              {{ h.hari === '-' ? 'Tanpa tanggal' : tglLabel(h.hari) }}
              <span class="font-semibold text-muted">· {{ h.baris.length }} order</span>
            </p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="d in h.divisi"
                :key="d.nama"
                class="rounded-full border border-default bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted"
              >{{ d.nama }} {{ d.jumlah }}</span>
            </div>
          </div>

          <div
            v-for="b in h.batch"
            :key="b.kunci"
            class="overflow-hidden rounded-xl border border-default bg-muted"
          >
            <!-- The whole head is the toggle: a tall, easy target. -->
            <button
              type="button"
              class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gold-soft/30"
              :aria-expanded="!!arsipBuka[b.kunci]"
              @click="tukarArsipBatch(b.kunci)"
            >
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-deep">
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 transition-transform duration-200"
                  :class="arsipBuka[b.kunci] && 'rotate-90'"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-highlighted">{{ b.nama || `Order ${b.pic || '-'}` }}</span>
                <span class="block truncate text-[11px] font-semibold text-muted">{{ labelSubmit(b.ts) }}{{ b.asli ? '' : ' · dikelompokkan dari waktu submit' }}</span>
              </span>
              <span
                v-if="b.divisi && b.divisi !== '(Lainnya)'"
                class="hidden shrink-0 rounded-full border border-default px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted sm:inline"
              >{{ b.divisi }}</span>
              <span class="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted num">{{ b.baris.length }} item</span>
            </button>
            <div
              v-show="arsipBuka[b.kunci]"
              class="flex flex-col gap-2 border-t border-default p-3"
            >
              <!-- Archived line: category tag in its colour, the quantity big,
                   and a wide restore button. -->
              <div
                v-for="o in b.baris"
                :key="o.nomorOrder"
                class="grid items-center gap-3 rounded-lg bg-default p-3 shadow-panel sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <b class="text-highlighted">{{ o.item }}</b>
                    <span
                      class="rounded-md px-2 py-0.5 text-[11px] font-bold"
                      :class="warnaKategori(katOf(o.item))"
                    >{{ katOf(o.item) }}</span>
                  </div>
                  <p class="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {{ o.nomorOrder }}
                  </p>
                  <p
                    v-if="o.tglDatang || o.pic || o.tim"
                    class="text-xs text-muted"
                  >
                    {{ [o.tglDatang ? `datang ${tglPendek(o.tglDatang)}` : '', o.pic, o.tim].filter(Boolean).join(' · ') }}
                  </p>
                </div>
                <p class="font-display text-2xl font-extrabold leading-none text-gold-deep num sm:text-right">
                  {{ o.qty }} <span class="font-sans text-sm font-medium text-muted">{{ o.unit }}</span>
                </p>
                <UButton
                  label="Pulihkan arsip"
                  icon="i-lucide-history"
                  color="neutral"
                  variant="soft"
                  size="lg"
                  class="w-full justify-center sm:w-auto"
                  @click="arsipkanBatch([o.nomorOrder], true)"
                />
              </div>
            </div>
          </div>
        </div>
        <p
          v-if="arsipJatuhPenuh"
          class="rounded-xl border border-default bg-muted px-4 py-2.5 text-xs leading-relaxed text-muted"
        >
          Pencarian teks, filter vendor, atau tgl submit aktif — arsip dibaca penuh lalu disaring di sini supaya hasilnya tetap lengkap.
        </p>
        <p
          v-if="!arsipHari.length"
          class="text-sm text-dimmed"
        >
          Belum ada riwayat pesanan yang cocok dengan kriteria filter.
        </p>
        <KontenPager
          v-model:hal="arsipHal"
          v-model:per="arsipPer"
          :total="arsipTotal"
          satuan="order"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetJemput"
      title="Tanggal jemput"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Tanggal jemput">
          <AppTanggal v-model="jemputTgl" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheetJemput = false"
          />
          <UButton
            label="Simpan"
            @click="simpanJemput"
          />
        </div>
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetWa"
      title="Draf chat vendor"
    >
      <p class="whitespace-pre-wrap text-sm text-default">
        {{ waTeks }}
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <UButton
          label="Tutup"
          variant="outline"
          @click="sheetWa = false"
        />
        <UButton
          label="Buka WhatsApp"
          icon="i-lucide-message-circle"
          color="success"
          :href="waLink"
          target="_blank"
          rel="noopener"
        />
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
