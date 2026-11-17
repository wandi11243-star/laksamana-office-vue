<!--
  DanaMasukPanel — the money screen, owned by reservasi (PLAN.md §4, T-12 U5).
  No page assumptions: cashier and finance/kas mount this later instead of the
  old `<iframe …?embed=finance>`. The panel loads its own data; the host page
  only passes what its people may do.

  Props:
    bolehVerifikasi — verify / reject / edit transfers (old CAN.finance).
    bolehHapus       — delete one money record, System Admin alone
                       (old CAN.deleteDp, row `financeDelete`).
    bolehHapusDemo   — delete the built-in demo rows (admin; same gate).
                       Ignored for a caller without reservasi|service_excellent:
                       the API door for cashier/finance has no DELETE (G-14).
    sumberAwal       — which source tab opens first (default 'reservasi').

  No emits: the panel toasts and audits by itself.

  One row = one transfer (`{r, p, ke, dari}`); DP paid in instalments stands
  apart. Formulas live in app/utils/dp-reservasi.ts, never here.
  Source: laksamana-office/deploy/reservasi/index.html:9358-9584 (render),
          :8997-9213 (rows, filters), :9549-9584 (autoscan).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi, ReservasiDp } from '~/composables/useReservasi'
import {
  deleteReservation, getFile, getReservation, listReservations, patchReservation,
  postAudit, useSection,
} from '~/composables/useReservasi'
import { bukaBerkasMkt, getMarketingDp, kunciBerkasMkt, type DpEvent, type DpEventData } from '~/composables/useMarketing'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari, type Versi } from '~/utils/versi'
import {
  bankDariMetode, buktiAdalahGambar, cerminDp, cerminTfUtama, dpBaru, dpHitungTerverifikasi,
  dpMetodeBawaan, dpTotal, dpsTampilan, kurangDataTf, normPhone, opsiDpMetode, pastikanDps,
  ringkasDanaMasuk, saringDanaMasuk, tampilPhone, txBank,
  txBuktiGambar, txNama, txNominal, txSelisih, txSudahScan,
  type SaringDanaMasuk, type TxDanaMasuk,
} from '~/utils/dp-reservasi'
import { OCR_BANK, jam24, jamRagu, jamSeharusnya, tglSeharusnya } from '~/utils/ocr-transfer'
import { angka, fmtRupiah, hariIni, rupiahVal, tglPendek } from '~/utils/format'
import { usePollReservasi } from '~/composables/usePollReservasi'

const props = withDefaults(defineProps<{
  bolehVerifikasi?: boolean
  bolehHapus?: boolean
  bolehHapusDemo?: boolean
  /** Manager/admin direct-print path (old ROLE_KWI_LANGSUNG). The host page sets it from its role matrix. */
  bolehKwitansiLangsung?: boolean
  sumberAwal?: 'reservasi' | 'event'
  /** Pre-fill the search (and open the whole table): a detail sheet links here with `?q=`. */
  cariAwal?: string
}>(), {
  bolehVerifikasi: false,
  bolehHapus: false,
  bolehHapusDemo: false,
  bolehKwitansiLangsung: false,
  sumberAwal: 'reservasi',
  cariAwal: '',
})

const { bolehVerifikasi, bolehHapus, bolehHapusDemo, bolehKwitansiLangsung } = props
const me = useMe()
const toast = useToast()
const namaSaya = computed(() => me.value?.name ?? '')

/**
 * G-14: a cashier/finance holder without reservasi|service_excellent reaches this
 * panel through the API's narrow Dana Masuk door (laksamana-api
 * docs/api/reservasi.md): DP and transfer fields only, no DELETE. Deleting the
 * demo rows is a reservation DELETE, so the button would only ever answer 403 —
 * it is hidden instead, whatever the host page passes.
 */
const lewatPintuDanaMasuk = computed(() => !hasAccess(me.value, ['reservasi', 'service_excellent']))
const bolehHapusDemoEfektif = computed(() => bolehHapusDemo && !lewatPintuDanaMasuk.value)

// --- filters -----------------------------------------------------------------
// Default: TODAY on the booking date. "Hari Ini" means reservations scheduled
// today, not transfers that happened to move today — a DP is often paid weeks
// ahead (`:9176-9190`). The default stays 'reservasi' for the same reason.

// Reka UI forbids SelectItem value '' — "Semua bank" is the non-empty
// sentinel 'semua', mapped back to "no filter" in saringEfektif so the shared
// formula in dp-reservasi.ts stays untouched.
const SEMUA = 'semua'
const saring = reactive<SaringDanaMasuk>({
  basis: 'reservasi',
  // A pre-filled search means "find this booking": the whole table, not today.
  dari: props.cariAwal ? '' : hariIni(),
  sampai: props.cariAwal ? '' : hariIni(),
  bank: SEMUA,
  status: SEMUA,
  q: props.cariAwal,
  tab: 'perlu',
})
/** A later `?q=` (same page, another booking) re-aims the search the same way. */
watch(() => props.cariAwal, (q) => {
  if (q) {
    saring.q = q
    saring.dari = ''
    saring.sampai = ''
  }
})
const saringEfektif = computed(() => ({ ...saring, bank: saring.bank === SEMUA ? '' : saring.bank }))

const sumber = ref<'reservasi' | 'event'>(props.sumberAwal)

function pilihan(kind: 'today' | 'week' | 'month' | 'all') {
  const t = hariIni()
  if (kind === 'today') {
    saring.dari = t
    saring.sampai = t
  }
  else if (kind === 'week') {
    const d = new Date(`${t}T00:00:00`)
    d.setDate(d.getDate() - 6)
    saring.dari = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    saring.sampai = t
  }
  else if (kind === 'month') {
    saring.dari = `${t.slice(0, 8)}01`
    saring.sampai = t
  }
  else {
    // Empty bounds = the whole table. Heavy, and the only way the 'masuk'
    // basis sees transfers whose booking sits outside any range.
    saring.dari = ''
    saring.sampai = ''
  }
}

// --- the rows ----------------------------------------------------------------
// The window follows the filter on the BOOKING date — the only date the list
// endpoint filters on. In 'masuk' basis a transfer is still found through its
// booking, so a DP paid today for next month's party needs a wider range (or
// "Semua"). The banner below says how many rows ride on the fallback date.

const { data: semua, refresh, error: galatMuat, status } = useAsyncData(
  'dana-masuk',
  () => listReservations(saring.dari || undefined, saring.sampai || undefined).then(r => r.data),
  { watch: [() => saring.dari, () => saring.sampai], default: () => [] },
)

const aksiAktif = ref(0)
const { setel } = usePollReservasi(refresh, {
  jeda: 10000,
  tunda: () => aksiAktif.value > 0 || pindai.sibuk || sheetBukti.value || sheetTf.value
    || sheetVer.value || sheetTolak.value || sheetTambah.value || konfirmasi.buka,
})

watch([() => saring.dari, () => saring.sampai], () => setel())

const { data: dpMethods } = useSection<string[]>('dpMethods')

/**
 * 403 module_not_granted: the account holds none of reservasi, service_excellent,
 * cashier, finance — the four Modules the API opens Dana Masuk to (G-14).
 */
const tanpaAkses = computed(() => apiErrorCode(galatMuat.value) === 'module_not_granted')

const tx = computed(() => txSemua(semua.value ?? []))
const daftarSemua = computed(() => saringDanaMasuk(tx.value, saringEfektif.value, false))
const ringkas = computed(() => ringkasDanaMasuk(daftarSemua.value))
const daftar = computed(() => saringDanaMasuk(tx.value, saringEfektif.value, true))

// Two Total DP cards, one per date basis (old 4a2edc6). Both run through the
// same list + filters, only the basis differs; rejected transfers never count.
// The 'masuk' basis falls back to the booking date when the transfer date is
// still unread (txTanggal), and those fallback rows are named on its card.
const saringReservasi = computed(() => ({ ...saringEfektif.value, basis: 'reservasi' as const }))
const saringMasuk = computed(() => ({ ...saringEfektif.value, basis: 'masuk' as const }))
const perRes = computed(() => saringDanaMasuk(tx.value, saringReservasi.value, false).filter(x => x.p.tfStatus !== 'rejected'))
const perMasuk = computed(() => saringDanaMasuk(tx.value, saringMasuk.value, false).filter(x => x.p.tfStatus !== 'rejected'))
const totalPerRes = computed(() => perRes.value.reduce((a, x) => a + txNominal(x), 0))
const totalPerMasuk = computed(() => perMasuk.value.reduce((a, x) => a + txNominal(x), 0))
const cadMasuk = computed(() => perMasuk.value.filter(x => !x.p.tfDate).length)
const labRentang = computed(() => (saring.dari || saring.sampai
  ? `${saring.dari ? tglPendek(saring.dari) : 'awal'} – ${saring.sampai ? tglPendek(saring.sampai) : 'sekarang'}`
  : 'semua tanggal'))

const semuaBank = computed(() => [...new Set(tx.value.map(txBank).filter(Boolean))].sort())

/** Rows riding on the booking date because their transfer date is still unread (`:9383-9388`). */
const tglCadangan = computed(() => saring.basis === 'masuk' ? daftarSemua.value.filter(x => !x.p.tfDate) : [])

/** The built-in demo rows polluting the sums (`:10802-10808`). */
const DEMO_NAMA = ['Budi Santoso', 'Sarah Wijaya', 'Andre Kurniawan', 'Melati Putri', 'PT Nusantara Jaya', 'Rian Hidayat', 'Keluarga Tanjung', 'Fitri Amelia']
const demoTelepon = new Set(DEMO_NAMA.map((_, i) => normPhone(`08${1234500000 + i * 11111}`)))
const adalahDemo = (r: Reservasi) => DEMO_NAMA.includes(String(r?.name || '').trim()) && demoTelepon.has(normPhone(r?.phone))
const demo = computed(() => (semua.value ?? []).filter(adalahDemo))

// --- paging in the browser ---------------------------------------------------
// One row is one TRANSFER, so the reservation-level paging of the API (G-08)
// cannot page this table: a page of 10 reservations holds an unpredictable
// number of transfers, and the transfer filters (bank, scan state, tab) have
// no server twin either. The window stays the loader; the pager below never
// hides, like the old screen.

const hal = ref(1)
const perHal = ref(10)
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.length / perHal.value)))
const halaman = computed(() => daftar.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([daftar, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

// --- the table -----------------------------------------------------------------

const kolom = computed<TableColumn<TxDanaMasuk>[]>(() => [
  { accessorKey: 'tanggal', header: 'Tanggal TF' },
  { accessorKey: 'jam', header: 'Jam' },
  { accessorKey: 'bank', header: 'Bank' },
  { accessorKey: 'nama', header: 'Nama pengirim' },
  { accessorKey: 'nominal', header: 'Nominal' },
  { accessorKey: 'tamu', header: 'Tamu / reservasi' },
  { accessorKey: 'bukti', header: 'Bukti' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'aksi', header: 'Aksi' },
])

const rp = (n: number) => n ? `Rp. ${new Intl.NumberFormat('id-ID').format(n)}` : 'Rp. 0'
const bankOpsi = computed(() =>
  [...new Set([...OCR_BANK.map(b => b[0]), ...(dpMethods.value ?? []).map(bankDariMetode)])].filter(Boolean).sort())
const capWaktu = (ts: number) => ts
  ? new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-'
const jamTampil = (v: string) => v ? `${jam24(v)} WIB` : ''

// --- writes ------------------------------------------------------------------
// A money write sends the version the person SAW — the row's `updatedAt` as
// displayed when the sheet opened, never a fresh re-read. Re-reading right
// before writing makes 409 impossible, and the cashier could verify a
// nominal/proof the host replaced after the list loaded, without ever seeing
// it. The old client refused such saves (the `baseVer` guard).
//
// So: every sheet snapshots its row at open (`dasarDari`); the PATCH `dps`
// is built from that snapshot's COPY, never the list's objects. A change in
// between → 409 → `tanganiKonflik` → the list reloads AND the sheet
// re-snapshots from the newest row → the person checks again. Only the OCR
// scan (writing `tfOcr*` suggestions) uses a fresh version: suggestions never
// decide anything by themselves.
// (§2.6, and the "saveAll menimpa buta" lesson of input.vue 0.1).

/** The row as the person saw it: a copy, plus its `updatedAt` as displayed. */
interface DasarTampilan {
  r: Reservasi
  versi: Versi | undefined
}

const dasarDari = (x: TxDanaMasuk): DasarTampilan => ({
  // The instalment array is copied too: the snapshot must not share anything
  // mutable with the list.
  r: { ...x.r, dps: Array.isArray(x.r.dps) ? [...x.r.dps] : x.r.dps },
  versi: x.r.updatedAt,
})

/** Working instalments from the snapshot — lifted like pastikanDps(). */
const dpsKerja = (d: DasarTampilan): ReservasiDp[] => dpsTampilan(d.r).map(p => ({ ...p }))

const cariCicilan = (dps: ReservasiDp[], payId: string, ke: number) => {
  const i = dps.findIndex(p => p.id === payId)
  return i >= 0 ? i : ke - 1
}

/**
 * PATCH one transfer's row: `dps` from the freshest row, its flat mirrors,
 * and the first instalment's transfer fields only when instalment 0 is the
 * one touched. `tambahan` carries what the action owns beyond that (e.g. a
 * Pending -> Confirmed flip on new money).
 */
async function tulisTransfer(resId: string, idx: number, dps: ReservasiDp[], tambahan: Partial<Reservasi>, versi: Versi | undefined) {
  const fields: Partial<Reservasi> = { dps, ...cerminDp(dps), ...tambahan }
  if (idx === 0) Object.assign(fields, cerminTfUtama(dps))
  await patchReservation(resId, fields, versi)
}

const catatDp = (aksi: string, detail: string, resId: string) =>
  postAudit({ action: aksi, detail, res: resId })

/** Reload what a write touched: the list. Sheets re-snapshot their own row (below). */
const muatUlangDaftar = () => refresh()

/** A stored proof as a data URI: inline as-is, `@f:` read from the file endpoint. */
async function muatBukti(ref: string): Promise<string> {
  if (!ref) return ''
  if (!ref.startsWith('@f:')) return ref
  const { data } = await getFile(ref.replace(/^@f:/, ''))
  return data.data
}

// --- the proof viewer ----------------------------------------------------------
// Opened instantly in a "loading" state, filled when the file lands: a button
// that sits quiet for seconds gets pressed again and again (`:8075-8108).

const sheetBukti = ref(false)
const buktiJudul = ref('')
const buktiData = ref('')
const buktiPdf = ref(false)
const buktiMemuat = ref(false)
const buktiGalat = ref('')

async function lihatBukti(x: TxDanaMasuk) {
  sheetBukti.value = true
  buktiJudul.value = x.p.proofName || 'Bukti transfer'
  buktiData.value = ''
  buktiPdf.value = false
  buktiMemuat.value = true
  buktiGalat.value = ''
  try {
    const data = await muatBukti(x.p.proofData)
    if (!data) throw new Error('Bukti tidak ditemukan di database')
    buktiPdf.value = !buktiAdalahGambar(data, x.p.proofName)
    buktiData.value = data
  }
  catch (e) {
    buktiGalat.value = apiErrorMessage(e)
  }
  finally {
    buktiMemuat.value = false
  }
}

// --- Cek / Edit ----------------------------------------------------------------
// The correction form. Machine suggestions sit under their boxes with a
// "Pakai" button each — never filled in by themselves (`:9751-9834`).

const sheetTf = ref(false)
const tfForm = reactive({
  resId: '', payId: '', ke: 0, dari: 0,
  date: '', time: '', bank: '', name: '', amount: '', note: '',
})
const tfSimpan = ref<ReservasiDp | null>(null)
const tfRes = ref<Reservasi | null>(null)
/** The row as seen when this sheet opened — the version the save carries. */
const tfDasar = ref<DasarTampilan | null>(null)
const tfTampil = ref({ nama: '', info: '', hostNominal: 0, hostMetode: '', buktiAda: false, buktiGambar: false })

const KUNCI_SARAN: { kunci: KunciSaran, label: string }[] = [
  { kunci: 'date', label: 'Tanggal' },
  { kunci: 'time', label: 'Jam' },
  { kunci: 'bank', label: 'Bank' },
  { kunci: 'name', label: 'Nama' },
  { kunci: 'amount', label: 'Nominal' },
]

function bukaTfEdit(x: TxDanaMasuk) {
  tfSimpan.value = { ...x.p }
  tfRes.value = { ...x.r }
  tfDasar.value = dasarDari(x)
  Object.assign(tfForm, {
    resId: x.r.id, payId: x.p.id, ke: x.ke, dari: x.dari,
    date: x.p.tfDate || '', time: x.p.tfTime || '', bank: txBank(x),
    name: x.p.tfName || '', amount: fmtRupiah(txNominal(x)), note: x.p.tfNote || '',
  })
  tfTampil.value = {
    nama: x.r.name, info: `${tglPendek(x.r.date)} ${x.r.time}, ${x.r.pax} pax${x.r.table ? `, meja ${x.r.table}` : ''}`,
    hostNominal: Number(x.p.amount) || 0, hostMetode: x.p.method || '',
    buktiAda: !!x.p.proofData, buktiGambar: txBuktiGambar(x),
  }
  sheetTf.value = true
}

const saranTf = (kunci: KunciSaran) => (tfSimpan.value ? saranOcr(tfSimpan.value, kunci) : '')
const jumlahSaran = computed(() => KUNCI_SARAN.filter(k => saranTf(k.kunci) !== '').length)
const tglStempelTf = computed(() => tfSimpan.value ? tglSeharusnya(tfSimpan.value.tfOcrText, tfSimpan.value.tfTime, tfSimpan.value.tfDate) : '')

function pakaiSaran(kunci: KunciSaran) {
  const v = saranTf(kunci)
  if (v === '') return
  if (kunci === 'amount') tfForm.amount = fmtRupiah(Number(v))
  else if (kunci === 'date') tfForm.date = String(v)
  else if (kunci === 'time') tfForm.time = String(v)
  else if (kunci === 'bank') tfForm.bank = String(v)
  else tfForm.name = String(v)
}

function pakaiSemuaSaran() {
  let n = 0
  for (const k of KUNCI_SARAN) {
    if (saranTf(k.kunci) !== '') {
      pakaiSaran(k.kunci)
      n++
    }
  }
  if (n) toast.add({ title: `${n} kolom diisi dari hasil baca mesin — cocokkan dengan gambarnya, lalu Simpan` })
}

/** Read the boxes into an instalment (`:9835-9843`). `tfSource` becomes "manual": a person pressed Save. */
function terapkanFormTf(p: ReservasiDp) {
  p.tfDate = tfForm.date
  p.tfTime = tfForm.time
  p.tfBank = tfForm.bank.trim()
  p.tfName = tfForm.name.trim()
  p.tfAmount = rupiahVal(tfForm.amount)
  p.tfNote = tfForm.note.trim()
  p.tfSource = 'manual'
}

/** Reload the sheet's own row after a conflict — the form holds a copy (`input.vue` 0.1). */
async function muatUlangTf() {
  await refresh()
  if (!tfForm.resId) return
  try {
    const env = await getReservation(tfForm.resId)
    const segar = env.data
    const dps = dpsTampilan(segar).map(p => ({ ...p }))
    const p = dps[cariCicilan(dps, tfForm.payId, tfForm.ke)]
    if (p) {
      const x: TxDanaMasuk = { r: segar, p, ke: tfForm.ke, dari: dps.length }
      bukaTfEdit(x)
    }
  }
  catch {
    // The list already reloaded; the sheet keeps its copy.
  }
}

async function simpanTf(verifikasi: boolean) {
  if (!bolehVerifikasi) return
  if (verifikasi) {
    bukaVerifikasiDariForm()
    return
  }
  aksiAktif.value++
  try {
    const d = tfDasar.value
    if (!d || d.r.id !== tfForm.resId) {
      toast.add({ title: 'Data di layar berubah — daftar dimuat ulang', color: 'error' })
      await muatUlangTf()
      return
    }
    const dps = dpsKerja(d)
    const idx = cariCicilan(dps, tfForm.payId, tfForm.ke)
    const p = dps[idx]
    if (!p) {
      toast.add({ title: 'Barisnya tidak ketemu — daftar dimuat ulang', color: 'error' })
      await muatUlangTf()
      return
    }
    terapkanFormTf(p)
    await tulisTransfer(tfForm.resId, idx, dps, {}, d.versi)
    await catatDp('Koreksi Data Transfer', `${tfTampil.value.nama}: ${p.tfBank || '-'} ${p.tfName || '-'} ${p.tfDate || '-'} ${p.tfTime || ''} ${rp(txNominal({ r: tfRes.value!, p, ke: 0, dari: 0 }))}`, tfForm.resId)
    await refresh()
    sheetTf.value = false
    toast.add({ title: 'Data transfer disimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangTf))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aksiAktif.value--
  }
}

// --- Verifikasi ----------------------------------------------------------------
// A dialog, because "verified" states money that REALLY arrived — used by
// other screens as fact, recorded under the person's name (`:9894-9942`).
// Empty columns do NOT block: the person is looking at the proof, and a
// retyped number is no truer than admitting the data is unread. Unread
// columns ride along as `tfTanpaData` ("dari gambar").

const sheetVer = ref(false)
const ver = reactive({
  resId: '', payId: '', ke: 0, dari: 0, nama: '', sumber: 'manual',
  date: '', time: '', bank: '', name: '', nomBukti: 0, nomHost: 0, kurang: [] as string[],
  versi: undefined as Versi | undefined,
  dasarR: null as Reservasi | null,
})

function isiVerifikasi(resId: string, payId: string, ke: number, dari: number, nama: string, p: ReservasiDp, bank: string, sumber: string, dasar: DasarTampilan) {
  Object.assign(ver, {
    resId, payId, ke, dari, nama, sumber,
    date: p.tfDate || '', time: p.tfTime || '', bank, name: p.tfName || '',
    nomBukti: Number(p.tfAmount) || 0, nomHost: Number(p.amount) || 0,
    kurang: kurangDataTf(p, bank),
    versi: dasar.versi,
    dasarR: dasar.r,
  })
  sheetVer.value = true
}

function bukaVerifikasi(x: TxDanaMasuk) {
  isiVerifikasi(x.r.id, x.p.id, x.ke, x.dari, x.r.name, { ...x.p }, txBank(x), x.p.tfSource || 'manual', dasarDari(x))
}

/** From the edit sheet: the dialog states what was JUST typed, not what is stored (`:9846-9854`). The version stays the sheet's. */
function bukaVerifikasiDariForm() {
  const d = tfDasar.value
  if (!d || d.r.id !== tfForm.resId) {
    toast.add({ title: 'Data di layar berubah — daftar dimuat ulang', color: 'error' })
    muatUlangTf()
    return
  }
  const p = { ...(tfSimpan.value ?? {}), tfDate: tfForm.date, tfTime: tfForm.time, tfBank: tfForm.bank.trim(), tfName: tfForm.name.trim(), tfAmount: rupiahVal(tfForm.amount) } as ReservasiDp
  isiVerifikasi(tfForm.resId, tfForm.payId, tfForm.ke, tfForm.dari, tfTampil.value.nama, p, tfForm.bank.trim(), 'manual', d)
}

async function verifikasiGo() {
  if (!bolehVerifikasi) return
  sheetVer.value = false
  aksiAktif.value++
  try {
    const dasarR = ver.dasarR
    if (!dasarR || dasarR.id !== ver.resId) {
      toast.add({ title: 'Data di layar berubah — daftar dimuat ulang', color: 'error' })
      await refresh()
      return
    }
    const dps = dpsTampilan(dasarR).map(p => ({ ...p }))
    const idx = cariCicilan(dps, ver.payId, ver.ke)
    const p = dps[idx]
    if (!p) {
      toast.add({ title: 'Barisnya tidak ketemu — daftar dimuat ulang', color: 'error' })
      await refresh()
      return
    }
    if (ver.sumber === 'manual') {
      p.tfDate = ver.date
      p.tfTime = ver.time
      p.tfBank = ver.bank.trim()
      p.tfName = ver.name.trim()
      p.tfAmount = ver.nomBukti
      p.tfSource = 'manual'
    }
    const kurang = kurangDataTf(p, p.tfBank || bankDariMetode(p.method))
    if (!Number(p.tfAmount)) p.tfAmount = Number(p.amount) || 0
    if (!p.tfBank) p.tfBank = bankDariMetode(p.method)
    p.tfStatus = 'verified'
    p.tfBy = namaSaya.value
    p.tfAt = Date.now()
    p.tfTanpaData = kurang.length ? kurang.join(', ') : ''
    await tulisTransfer(ver.resId, idx, dps, {}, ver.versi)
    const x = { r: { name: ver.nama } as Reservasi, p, ke: 0, dari: 0 }
    await catatDp('Verifikasi Dana Masuk',
      `${ver.nama}: ${p.tfBank || '-'} ${p.tfName || '-'} ${p.tfDate || '(tanggal tidak terbaca)'} ${p.tfTime || ''} ${rp(txNominal(x))}`
      + (kurang.length ? ` — TANPA ${kurang.join(', ').toUpperCase()}, diverifikasi dari gambar bukti` : ''), ver.resId)
    await refresh()
    toast.add({ title: kurang.length ? 'Dana masuk terverifikasi (data tidak lengkap)' : 'Dana masuk terverifikasi', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDaftar))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aksiAktif.value--
  }
}

// --- Tolak ---------------------------------------------------------------------
// A reason, typed — refused money was checked and found absent (`:9963-9975`).

const sheetTolak = ref(false)
const tolak = reactive({
  resId: '', payId: '', ke: 0, nama: '', alasan: '', dariForm: false,
  versi: undefined as Versi | undefined,
  dasarR: null as Reservasi | null,
})

function bukaTolak(x: TxDanaMasuk, dariForm = false) {
  // From the edit sheet the version is the sheet's, not the table's.
  const d = dariForm && tfDasar.value ? tfDasar.value : dasarDari(x)
  Object.assign(tolak, {
    resId: x.r.id, payId: x.p.id, ke: x.ke, nama: x.r.name, alasan: x.p.tfNote || '', dariForm,
    versi: d.versi, dasarR: d.r,
  })
  sheetTolak.value = true
}

async function tolakGo() {
  if (!bolehVerifikasi) return
  sheetTolak.value = false
  aksiAktif.value++
  try {
    const dasarR = tolak.dasarR
    if (!dasarR || dasarR.id !== tolak.resId) {
      toast.add({ title: 'Data di layar berubah — daftar dimuat ulang', color: 'error' })
      await refresh()
      return
    }
    const dps = dpsTampilan(dasarR).map(p => ({ ...p }))
    const idx = cariCicilan(dps, tolak.payId, tolak.ke)
    const p = dps[idx]
    if (!p) {
      toast.add({ title: 'Barisnya tidak ketemu — daftar dimuat ulang', color: 'error' })
      await refresh()
      return
    }
    if (tolak.dariForm) terapkanFormTf(p) // called from the edit sheet: the boxes travel along (`:9969`)
    p.tfStatus = 'rejected'
    p.tfNote = tolak.alasan.trim()
    p.tfBy = namaSaya.value
    p.tfAt = Date.now()
    await tulisTransfer(tolak.resId, idx, dps, {}, tolak.versi)
    await catatDp('Tolak Bukti Transfer', `${tolak.nama}: ${tolak.alasan.trim() || 'tanpa alasan'}`, tolak.resId)
    if (tolak.dariForm) sheetTf.value = false
    await refresh()
    toast.add({ title: 'Bukti transfer ditolak' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, tolak.dariForm ? muatUlangTf : muatUlangDaftar))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aksiAktif.value--
  }
}

// --- Betulkan tanggal / jam ------------------------------------------------------
// Recomputed from the SAVED ocr text — never a fresh read of the same picture
// with the same machine. The fixer is always a person (`:8856-8924`).

const konfirmasi = reactive({
  buka: false, judul: '', pesan: '', label: '', bahaya: true, aksi: null as null | (() => Promise<void>),
})

function mintaKonfirmasi(judul: string, pesan: string, label: string, aksi: () => Promise<void>, bahaya = true) {
  Object.assign(konfirmasi, { buka: true, judul, pesan, label, bahaya, aksi })
}

async function jalankanKonfirmasi() {
  konfirmasi.buka = false
  aksiAktif.value++
  try {
    await konfirmasi.aksi?.()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDaftar))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aksiAktif.value--
  }
}

function betulkanTanggal(x: TxDanaMasuk) {
  const benar = tglSeharusnya(x.p.tfOcrText, x.p.tfTime, x.p.tfDate)
  if (!benar) {
    toast.add({ title: 'Tanggalnya sudah sesuai dengan bukti.' })
    return
  }
  const lama = x.p.tfDate || ''
  // Frozen now: the confirm box states this, and the write carries this version.
  const d = dasarDari(x)
  mintaKonfirmasi('Betulkan tanggal transfer',
    `${lama ? `Tanggal transfer dibetulkan dari ${tglPendek(lama)} jadi ${tglPendek(benar)}.` : `Tanggal transfer diisi ${tglPendek(benar)} (sebelumnya kosong).`} Angkanya dibaca dari stempel waktu di nomor Ref pada bukti yang sudah tersimpan, dan jam di stempel itu cocok — bukan ditebak.`,
    'Betulkan tanggal', async () => {
      const dps = dpsKerja(d)
      const idx = cariCicilan(dps, x.p.id, x.ke)
      const p = dps[idx]
      if (!p) throw new Error('Barisnya tidak ketemu')
      p.tfDate = benar
      await tulisTransfer(x.r.id, idx, dps, {}, d.versi)
      await catatDp('Betulkan Tanggal TF', `${d.r.name}: ${lama || '(kosong)'} → ${benar} (dari stempel Ref di bukti tersimpan)`, x.r.id)
      await refresh()
      toast.add({ title: `Tanggal transfer jadi ${tglPendek(benar)}.`, color: 'success' })
    }, false)
}

function betulkanJam(x: TxDanaMasuk) {
  const benar = jamSeharusnya(x.p.tfOcrText, x.p.tfTime)
  if (!benar) {
    toast.add({ title: 'Jamnya sudah sesuai dengan hasil scan.' })
    return
  }
  // Frozen now, like the date fix above.
  const dJam = dasarDari(x)
  mintaKonfirmasi('Betulkan jam transfer',
    `Jam transfer dibetulkan dari ${x.p.tfTime} jadi ${benar} WIB. Angkanya dihitung ulang dari teks bukti yang sudah tersimpan (di sana tertulis AM/PM), bukan ditebak.`,
    'Betulkan jam', async () => {
      const d = dJam
      const dps = dpsKerja(d)
      const idx = cariCicilan(dps, x.p.id, x.ke)
      const p = dps[idx]
      if (!p) throw new Error('Barisnya tidak ketemu')
      const lama = p.tfTime
      p.tfTime = benar
      await tulisTransfer(x.r.id, idx, dps, {}, d.versi)
      await catatDp('Betulkan Jam TF', `${d.r.name}: ${lama} → ${benar} (dari teks bukti tersimpan)`, x.r.id)
      await refresh()
      toast.add({ title: `Jam transfer dibetulkan jadi ${benar} WIB.`, color: 'success' })
    }, false)
}

// --- Tambah Bukti TF DP ------------------------------------------------------------
// A new instalment is born here — proof required with NO exception: whoever
// types the amount is holding the receipt (`:7977-8036`, F4).

const sheetTambah = ref(false)
const tambah = reactive({
  resId: '', nama: '', info: '', ke: 1, sudahMasuk: 0, nominal: '', metode: '',
  berkas: null as File | null, namaBerkas: '',
  versi: undefined as Versi | undefined,
  dasarR: null as Reservasi | null,
})

function isiTambah(r: Reservasi, simpanKetik: boolean) {
  const n = dpsTampilan(r).length
  const simpan = simpanKetik
    ? { nominal: tambah.nominal, metode: tambah.metode, berkas: tambah.berkas, namaBerkas: tambah.namaBerkas }
    : { nominal: '', metode: dpMetodeBawaan(dpMethods.value ?? []), berkas: null, namaBerkas: '' }
  Object.assign(tambah, {
    resId: r.id, nama: r.name, info: `${tglPendek(r.date)} ${r.time}, ${r.pax} pax${r.table ? `, meja ${r.table}` : ''}`,
    ke: n + 1, sudahMasuk: dpTotal(r),
    ...simpan,
    versi: r.updatedAt,
    dasarR: { ...r, dps: Array.isArray(r.dps) ? [...r.dps] : r.dps },
  })
}

function bukaTambah(resId: string) {
  const r = (semua.value ?? []).find(v => v.id === resId)
  if (!r) return
  isiTambah(r, false)
  sheetTambah.value = true
}

/** After a conflict: the list is newest; the sheet follows it but keeps what was typed. */
async function muatUlangTambah() {
  await refresh()
  if (!tambah.resId) return
  const r = (semua.value ?? []).find(v => v.id === tambah.resId)
  if (r) isiTambah(r, true)
}

function pilihBerkas(f: File | null | undefined) {
  // The 5 MB gate runs BEFORE reading (F1): a bigger file never becomes a data URI.
  if (f && f.size > 5 * 1024 * 1024) {
    toast.add({ title: 'Bukti melebihi 5 MB — kecilkan dulu', color: 'error' })
    tambah.berkas = null
    tambah.namaBerkas = ''
    return
  }
  tambah.berkas = f ?? null
  tambah.namaBerkas = f ? f.name : ''
}

const bacaBerkas = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})

async function simpanTambah() {
  if (!bolehVerifikasi) return
  const nominal = rupiahVal(tambah.nominal)
  if (!nominal) {
    toast.add({ title: 'Nominal DP wajib diisi', color: 'error' })
    return
  }
  if (!tambah.berkas) {
    toast.add({ title: 'Bukti transfer wajib diunggah untuk tiap DP', color: 'error' })
    return
  }
  aksiAktif.value++
  try {
    const dataUri = await bacaBerkas(tambah.berkas)
    const dasarR = tambah.dasarR
    if (!dasarR || dasarR.id !== tambah.resId) {
      toast.add({ title: 'Data di layar berubah — daftar dimuat ulang', color: 'error' })
      await muatUlangTambah()
      return
    }
    const dps = dpsTampilan(dasarR).map(p => ({ ...p }))
    pastikanDps({ ...dasarR, dps } as Reservasi)
    const p = {
      ...dpBaru(namaSaya.value),
      amount: nominal,
      method: tambah.metode,
      proofData: dataUri,
      proofName: tambah.berkas.name,
    }
    dps.push(p)
    // Money in flips a Pending booking to Confirmed — but only from Pending:
    // anything else (Datang, …) is someone else's state, not ours to move.
    const tambahan: Partial<Reservasi> = dasarR.status === 'Pending' ? { status: 'Confirmed' } : {}
    await tulisTransfer(tambah.resId, dps.length - 1, dps, tambahan, tambah.versi)
    await catatDp('Tambah DP', `${tambah.nama}: DP ke-${dps.length} ${rp(nominal)} (total ${rp(dpTotal({ ...dasarR, dps } as Reservasi))})`, tambah.resId)
    sheetTambah.value = false
    await refresh()
    toast.add({ title: `DP ${rp(nominal)} tercatat`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangTambah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aksiAktif.value--
  }
}

// --- Hapus catatan DP (admin) --------------------------------------------------------
// Erases the money trace, so it is the System Admin's alone on both the button
// and here. A cashier or manager rejects the proof instead (`:8037-8056`).

function hapusDp(x: TxDanaMasuk) {
  if (!props.bolehHapus) {
    toast.add({ title: 'Hanya Admin Sistem yang boleh menghapus transaksi dana masuk', color: 'error' })
    return
  }
  // Frozen now: the confirm box states this, and the write carries this version.
  const d = dasarDari(x)
  mintaKonfirmasi('Hapus transaksi dana masuk',
    `Hapus transaksi dana masuk ${rp(txNominal(x))} (${x.p.method || '-'}) milik "${x.r.name}"? Catatan uang masuk ini akan hilang. Tindakan ini tercatat di audit log.`,
    'Hapus', async () => {
      const dps = dpsKerja(d)
      const idx = cariCicilan(dps, x.p.id, x.ke)
      const sisa = dps.filter((_, i) => i !== idx)
      // Removing instalment 0 promotes the next one: the flat mirrors follow.
      await tulisTransfer(x.r.id, idx === 0 ? 0 : 1, sisa, {}, d.versi)
      await catatDp('Hapus Dana Masuk', `${d.r.name}: hapus ${rp(txNominal(x))} (${x.p.tfBank || x.p.method || '-'}${x.p.tfName ? `, a.n. ${x.p.tfName}` : ''}) — sisa total DP ${rp(sisa.reduce((a, p) => a + (Number(p.amount) || 0), 0))}`, x.r.id)
      await refresh()
      toast.add({ title: 'Transaksi dana masuk dihapus' })
    })
}

// --- Hapus Data Demo (admin) -----------------------------------------------------------

async function hapusDemo() {
  if (!bolehHapusDemoEfektif.value) return
  if (!demo.value.length) {
    toast.add({ title: 'Tidak ada data demo yang tersisa' })
    return
  }
  mintaKonfirmasi('Hapus data demo',
    `Hapus ${demo.value.length} data DEMO/contoh ini secara permanen? ${demo.value.slice(0, 3).map(r => r.name).join(', ')}${demo.value.length > 3 ? ', dll' : ''}. Data ini ikut hilang dari Dashboard, Riwayat & Analitik, bukan cuma dari Dana Masuk. Tindakan ini tercatat di audit log.`,
    `Hapus ${demo.value.length} data demo`, async () => {
      for (const r of demo.value) {
        await deleteReservation(r.id, r.updatedAt)
      }
      await postAudit({ action: 'Hapus Data Demo', detail: `${demo.value.length} reservasi contoh dihapus: ${demo.value.map(r => r.name).join(', ')}` })
      await refresh()
      toast.add({ title: `${demo.value.length} data demo dihapus`, color: 'success' })
    })
}

// --- Export CSV (browser, K-05: CSV dulu) ------------------------------------------------
// The basis rides in the filename: two exports of the same range with different
// bases hold different rows, and an identical name would overwrite (`:9976-10004`).
// Stays in the browser on purpose: the server export is reservation-level
// (Recap columns), while this table exports transfers.

function unduhCsv() {
  const list = daftar.value
  if (!list.length) {
    toast.add({ title: 'Tidak ada transaksi untuk diekspor', color: 'error' })
    return
  }
  const cols = ['Tanggal TF', 'Jam TF', 'Bank', 'Nama Pengirim', 'Nominal Bukti', 'Nominal Input Host', 'Selisih',
    'DP Ke', 'Dari Total DP', 'Total DP Reservasi', 'Status', 'Catatan Finance',
    'Tamu', 'No HP', 'Tanggal Reservasi', 'Jam', 'Meja', 'Pax', 'Ada Bukti', 'Sumber Data', 'Diverifikasi Oleh', 'Waktu Verifikasi']
  const rows = list.map((x) => {
    const r = x.r
    const p = x.p
    return [
      p.tfDate || '', p.tfTime || '', txBank(x), txNama(x), txNominal(x), Number(p.amount) || 0,
      (Number(p.tfAmount) || 0) && (Number(p.amount) || 0) ? (Number(p.tfAmount) - Number(p.amount)) : 0,
      x.ke, x.dari, dpTotal(r),
      p.tfStatus === 'verified'
        ? (`Terverifikasi${p.tfTanpaData ? ` (dari gambar, ${p.tfTanpaData} tidak terbaca)` : ''}`)
        : p.tfStatus === 'rejected' ? 'Ditolak' : 'Belum dicek',
      p.tfNote || '', r.name, r.phone, r.date, r.time, r.table, r.pax,
      p.proofData ? 'Ada' : 'Tidak ada', p.tfSource === 'ocr' ? 'OCR bukti' : p.tfSource === 'manual' ? 'Manual' : '-',
      p.tfBy || '', p.tfAt ? capWaktu(p.tfAt) : '',
    ]
  })
  const csv = [cols, ...rows].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `dana_masuk_laksamana_${saring.basis === 'masuk' ? 'tgluang' : 'tglreservasi'}_${saring.dari || 'awal'}_${saring.sampai || hariIni()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  toast.add({ title: 'CSV dana masuk diunduh', color: 'success' })
}

// --- Scan ----------------------------------------------------------------------
// Proofs are read only when asked: the "Ulangi scan" button above (opt-in).
// Auto-scanning on open downloaded the tesseract worker + model (MB) and fired
// N×4 requests on every visit, in every tab. Already scanned proofs are not
// re-read, and a failed proof is not retried in the same session (`:9549-9584`).

const pindai = reactive({ sibuk: false, sudah: 0, total: 0, coba: new Set<string>() })

/**
 * The ONE sanctioned fresh re-read: a scan writes only `tfOcrSaran` /
 * `tfOcrAt` / `tfOcrText` — suggestions nobody decides by. The scan works
 * from the list row it already holds (no GET per row); only a 409 from a
 * host edit landing mid-scan triggers one re-read and a single retry.
 */
async function pindaiSatu(x: TxDanaMasuk) {
  const dps = dpsTampilan(x.r).map(p => ({ ...p }))
  const idx = dps.findIndex(p => p.id === x.p.id)
  if (idx < 0) throw new Error('Barisnya tidak ketemu — daftar dimuat ulang')
  const p = dps[idx]!
  if (!buktiAdalahGambar(p.proofData, p.proofName)) throw new Error('Bukti bukan gambar (PDF tidak bisa dipindai otomatis)')
  const gambar = await muatBukti(p.proofData)
  if (!gambar) throw new Error('Bukti tidak ditemukan di database')
  const hasil = pakaiHasilOcr(p, await ocrBaca(gambar))
  try {
    await patchReservation(x.r.id, { dps }, x.r.updatedAt)
  }
  catch (e) {
    if (apiErrorCode(e) !== 'version_conflict') throw e
    const env = await getReservation(x.r.id)
    const segar = env.data
    const dps2 = dpsTampilan(segar).map(q => ({ ...q }))
    const idx2 = dps2.findIndex(q => q.id === x.p.id)
    if (idx2 < 0) throw new Error('Barisnya tidak ketemu — daftar dimuat ulang', { cause: e })
    dps2[idx2]!.tfOcrSaran = p.tfOcrSaran
    dps2[idx2]!.tfOcrAt = p.tfOcrAt
    dps2[idx2]!.tfOcrText = p.tfOcrText
    await patchReservation(x.r.id, { dps: dps2 }, versiDari(env) ?? segar.updatedAt)
  }
  return hasil
}

/** One queue runner for the auto-scan and the "Ulangi Scan" button. */
async function jalankanAntrean(todo: TxDanaMasuk[], aksiAudit: string) {
  pindai.sibuk = true
  pindai.sudah = 0
  pindai.total = todo.length
  let ok = 0
  let gagal = 0
  for (const x of todo) {
    pindai.coba.add(x.p.id)
    try {
      const h = await pindaiSatu(x)
      if (h && (h.date || h.amount || h.bank)) ok++
      else gagal++
    }
    catch {
      gagal++
    }
    pindai.sudah++
  }
  pindai.sibuk = false
  await postAudit({ action: 'Scan Bukti TF', detail: `${aksiAudit}: ${todo.length} bukti (${ok} terbaca, ${gagal} gagal)` })
  await refresh()
  return { ok, gagal }
}

const belumPindai = computed(() => tx.value.filter(x => !txSudahScan(x) && txBuktiGambar(x)))

async function pindaiBorongan() {
  if (pindai.sibuk || !belumPindai.value.length) return
  const { ok, gagal } = await jalankanAntrean([...belumPindai.value], 'Scan borongan')
  toast.add({ title: `Selesai: ${ok} bukti punya saran${gagal ? `, ${gagal} gagal dibaca` : ''}`, color: gagal ? 'warning' : 'success' })
}

async function pindaiBaris(x: TxDanaMasuk) {
  toast.add({ title: 'Membaca bukti transfer…' })
  try {
    const hasil = await pindaiSatu(x)
    const bank = hasil.bank || '?'
    await postAudit({ action: 'Scan Bukti TF', detail: `${x.r.name}: ${bank} ${hasil.name || '?'} ${hasil.date || '?'} ${hasil.time || '?'} ${hasil.amount ? rp(hasil.amount) : '?'}`, res: x.r.id })
    await refresh()
    const kurang = (['date', 'time', 'amount', 'bank', 'name'] as const).filter(k => !hasil[k])
    const segar = (semua.value ?? []).flatMap(r => txSemua([r])).find(t => t.r.id === x.r.id && t.p.id === x.p.id)
    if (segar) bukaTfEdit(segar)
    toast.add({
      title: kurang.length
        ? `Bukti terbaca sebagian — ${kurang.join(', ')} tidak terbaca, ketik sendiri`
        : 'Bukti terbaca — cocokkan dengan gambarnya lalu tekan Pakai',
      color: 'success',
    })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangDaftar))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- DP Event (Marketing), read-only -------------------------------------------------
// Payments the Marketing team recorded for events AND VIP reservations — DP or
// payoff. Verified there first; the cashier only checks the money really came
// in and how much. Filtered by EVENT date, never the pay date: a DP moves
// weeks before its party (F11, `:9259-9356`).

const dpev = reactive({
  memuat: false, galat: '', tanpaAkses: false,
  data: null as DpEventData | null, kunci: '', q: '',
})

/** The range sent to the server. The boxes may be empty ("Semua") while the
 *  backend demands real dates — clamped wide, not refused (`:9116-9122`). */
const rentangEv = (): [string, string] => [saring.dari || '2000-01-01', saring.sampai || '2100-12-31']

async function muatDpEvent() {
  const [dari, sampai] = rentangEv()
  const kunci = `${dari}|${sampai}`
  // 'galat' JOINS the cache guard: without it a failed fetch re-renders the
  // banner, the render refires the fetch, forever. Only "Coba lagi" clears it.
  if (dpev.memuat) return
  if (dpev.kunci === kunci && (dpev.data || dpev.galat)) return
  dpev.memuat = true
  dpev.kunci = kunci
  dpev.galat = ''
  dpev.tanpaAkses = false
  dpev.data = null
  try {
    const { data } = await getMarketingDp(dari, sampai)
    dpev.data = data ?? {
      baris: [], total: 0, tanpaTanggal: 0,
      vipTerkunci: { n: 0, total: 0 }, luar: { n: 0, total: 0, dari: '', sampai: '' }, dari, sampai,
    }
  }
  catch (e) {
    if (apiErrorCode(e) === 'module_not_granted') dpev.tanpaAkses = true
    else dpev.galat = apiErrorMessage(e)
  }
  finally {
    dpev.memuat = false
  }
}

function dpevCobaLagi() {
  dpev.kunci = ''
  dpev.galat = ''
  dpev.tanpaAkses = false
  dpev.data = null
  muatDpEvent()
}

watch([sumber, () => saring.dari, () => saring.sampai], () => {
  if (sumber.value === 'event') muatDpEvent()
})

/** The visible rows — matched against event, client, PIC, method and receipt number at once (`:9158-9164`). */
const barisEv = computed(() => {
  const semuaBaris = dpev.data?.baris ?? []
  const q = dpev.q.trim().toLowerCase()
  if (!q) return semuaBaris
  return semuaBaris.filter(b => [b.event, b.client, b.pic, b.method, b.no, b.type]
    .some(v => String(v == null ? '' : v).toLowerCase().includes(q)))
})

const nEvent = computed(() => new Set(barisEv.value.map(b => b.evId)).size)
const totalEv = computed(() => barisEv.value.reduce((a, b) => a + (Number(b.amount) || 0), 0))

/** Split by payment KIND: DP and payoff answer different questions (`:9265-9269`). */
const perJenis = computed(() => {
  const map = new Map<string, { n: number, sum: number }>()
  for (const b of barisEv.value) {
    const k = b.type || '(tanpa jenis)'
    const e = map.get(k) ?? { n: 0, sum: 0 }
    e.n++
    e.sum += Number(b.amount) || 0
    map.set(k, e)
  }
  return [...map.entries()].map(([jenis, v]) => ({ jenis, ...v })).sort((a, b) => b.sum - a.sum)
})

/** Jump to the range that really holds payments (`:9249-9257`). */
function pakaiRentangLuar() {
  const luar = dpev.data?.luar
  if (!luar?.dari || !luar?.sampai) return
  saring.dari = luar.dari
  saring.sampai = luar.sampai
}

/** A legacy `?action=receipt&key=` URL cannot open here; only real links leave the screen. */
const tautanBuktiEv = (b: DpEvent) => b.receiptUrl && /^https?:\/\//i.test(b.receiptUrl) ? b.receiptUrl : ''

const kolomEv = computed<TableColumn<DpEvent>[]>(() => [
  { accessorKey: 'tglEvent', header: 'Tgl acara' },
  { accessorKey: 'event', header: 'Event' },
  { accessorKey: 'type', header: 'Jenis' },
  { accessorKey: 'amount', header: 'Nominal' },
  { accessorKey: 'method', header: 'Metode' },
  { accessorKey: 'at', header: 'Tgl bayar' },
  { accessorKey: 'no', header: 'No. kwitansi' },
  { accessorKey: 'bukti', header: 'Bukti' },
])
</script>

<template>
  <div>
    <!-- The source switch stands on both tabs — one-sided, the other side has no way back (`:9215-9221`). -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <AppSeg
        :model-value="sumber"
        :options="[
          { value: 'reservasi', label: 'DP reservasi', icon: 'i-lucide-utensils' },
          { value: 'event', label: `DP event (Marketing)${dpev.data ? ` · ${dpev.data.baris.length}` : ''}`, icon: 'i-lucide-party-popper' },
        ]"
        @update:model-value="(v) => { sumber = v as typeof sumber; if (v === 'event') muatDpEvent() }"
      />
      <p class="text-sm text-muted">
        Dua daftar yang <b class="text-highlighted">tidak bisa dijumlahkan</b>: DP reservasi diverifikasi di sini,
        pembayaran event sudah diverifikasi lebih dulu di Marketing.
      </p>
    </div>

    <template v-if="sumber === 'reservasi'">
      <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
        <p
          v-if="pindai.sibuk"
          class="me-auto text-sm text-muted"
        >
          <UIcon
            name="i-lucide-scan-line"
            class="me-1 inline size-4 align-text-bottom"
          />{{ pindai.sudah }} / {{ pindai.total }} bukti dibaca…
        </p>
        <UButton
          v-if="demo.length && bolehHapusDemoEfektif"
          :label="`Hapus data demo (${demo.length})`"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          size="sm"
          loading-auto
          @click="hapusDemo"
        />
        <UButton
          v-if="belumPindai.length && !pindai.sibuk && bolehVerifikasi"
          :label="`Ulangi scan (${belumPindai.length})`"
          icon="i-lucide-scan-line"
          color="neutral"
          variant="outline"
          size="sm"
          loading-auto
          @click="pindaiBorongan"
        />
        <UButton
          label="Export CSV"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          size="sm"
          loading-auto
          @click="unduhCsv"
        />
      </div>

      <p
        v-if="tanpaAkses"
        class="mb-4 flex items-start gap-2 rounded-field border border-warning/30 bg-warning/10 p-3 text-sm"
      >
        <UIcon
          name="i-lucide-lock"
          class="mt-0.5 size-4 shrink-0 text-warning"
        />
        <span><b>Belum punya akses ke Dana Masuk.</b>
          Halaman ini terbuka untuk pemegang modul Reservasi, Cashier, atau Finance, dan akun ini tidak memegang satu pun. Minta aksesnya ke Admin Sistem.</span>
      </p>
      <p
        v-else-if="galatMuat"
        class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
      >
        <b>Daftar tidak terbaca:</b> {{ apiErrorMessage(galatMuat) }}
        <UButton
          label="Coba lagi"
          color="neutral"
          variant="outline"
          size="xs"
          class="ms-2"
          @click="refresh()"
        />
      </p>

      <!-- Two Total DP cards, one per date basis (old 4a2edc6). Above the recap. -->
      <AppStatGrid>
        <AppStat
          label="Total DP · menurut Tgl Reservasi"
          icon="i-lucide-calendar"
          :value="rp(totalPerRes)"
          :sub="`${angka(perRes.length)} transfer untuk reservasi yang jadwal makannya ${labRentang}`"
        />
        <AppStat
          label="Total DP · menurut Tgl Uang Masuk"
          icon="i-lucide-banknote"
          :value="rp(totalPerMasuk)"
          :sub="`${angka(perMasuk.length)} transfer yang uangnya masuk ${labRentang}${cadMasuk ? ` · ${angka(cadMasuk)} memakai tgl reservasi (tgl transfer belum terbaca)` : ''}`"
        />
      </AppStatGrid>

      <!-- The old six cards (:9428-9436). -->
      <AppStatGrid>
        <AppStat
          label="Total dana masuk"
          icon="i-lucide-wallet"
          :value="rp(ringkas.total)"
          :sub="`${angka(daftarSemua.length)} kali transfer${ringkas.cicilan ? ` · ${angka(ringkas.cicilan)} bertahap` : ''}`"
        />
        <AppStat
          label="Total terverifikasi"
          icon="i-lucide-badge-check"
          tone="success"
          :value="rp(ringkas.terverifikasi)"
          :sub="`${angka(ringkas.sudah)} transaksi, dana dipastikan masuk`"
        />
        <AppStat
          label="Belum terverifikasi"
          icon="i-lucide-hourglass"
          tone="warning"
          :value="rp(ringkas.belum)"
          :sub="`${angka(ringkas.perlu)} transaksi${ringkas.belumScan ? ` · ${angka(ringkas.belumScan)} belum discan` : ''}`"
        />
        <AppStat
          label="Dana tidak sama"
          icon="i-lucide-triangle-alert"
          :tone="ringkas.selisih ? 'error' : 'gold'"
          :value="angka(ringkas.selisih)"
          :sub="ringkas.selisih ? 'nominal bukti ≠ input host' : 'nominal bukti cocok semua'"
        />
        <AppStat
          label="Tanpa bukti"
          icon="i-lucide-paperclip"
          :tone="ringkas.tanpaBukti ? 'warning' : 'gold'"
          :value="angka(ringkas.tanpaBukti)"
          sub="DP tercatat, bukti kosong"
        />
        <AppStat
          label="Ditolak"
          icon="i-lucide-circle-x"
          :tone="ringkas.tolak ? 'error' : 'gold'"
          :value="angka(ringkas.tolak)"
          :sub="ringkas.tolak ? `${rp(ringkas.ditolak)} tidak dihitung` : 'tidak ada'"
        />
      </AppStatGrid>

      <AppPanel
        v-if="ringkas.perBank.length"
        title="Rekap per bank / metode"
        icon="i-lucide-landmark"
      >
        <div class="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          <div
            v-for="b in ringkas.perBank"
            :key="b.bank"
            class="rounded-field border border-default bg-muted px-3.5 py-2.5"
          >
            <p class="text-xs font-bold uppercase tracking-wide text-muted">
              {{ b.bank }}
            </p>
            <p class="mt-1 font-display text-lg font-bold text-highlighted num">
              {{ rp(b.sum) }}
            </p>
            <p class="text-xs text-muted">
              {{ angka(b.n) }} transaksi
            </p>
          </div>
        </div>
      </AppPanel>

      <p
        v-if="demo.length"
        class="mb-4 rounded-field border border-warning/30 bg-warning/10 p-3 text-sm text-default"
      >
        Ada <b>{{ angka(demo.length) }} reservasi contoh/demo</b> bawaan sistem yang ikut terhitung di sini
        ({{ demo.slice(0, 3).map(r => r.name).join(', ') }}{{ demo.length > 3 ? ', dll' : '' }}).
        Angka dana masuk belum bersih sampai data ini dihapus.
        {{ bolehHapusDemoEfektif ? 'Tekan “Hapus data demo” di atas.' : 'Minta Admin Sistem menghapusnya.' }}
      </p>

      <p
        v-if="tglCadangan.length"
        class="mb-4 rounded-field border border-info/25 bg-info/10 p-3 text-sm text-default"
      >
        <b>{{ angka(tglCadangan.length) }} baris di daftar ini dipakai tanggal reservasinya</b>, bukan tanggal
        uang masuk — tanggal transfernya belum terbaca dari bukti. Nominalnya
        <b>{{ rp(tglCadangan.reduce((a, x) => a + txNominal(x), 0)) }}</b>.
        Tekan <b>Scan</b> di barisnya (atau isi lewat <b>Cek / Edit</b>) supaya ia jatuh di tanggal yang benar.
      </p>

      <AppPanel>
        <template #head>
          <div class="flex w-full flex-wrap items-center gap-3">
            <span class="text-sm font-semibold text-muted">Saring tanggal menurut</span>
            <AppSeg
              v-model="saring.basis"
              size="sm"
              :options="[
                { value: 'reservasi', label: 'Tgl reservasi', icon: 'i-lucide-calendar' },
                { value: 'masuk', label: 'Tgl uang masuk', icon: 'i-lucide-banknote' },
              ]"
            />
          </div>
        </template>
        <AppFilterGrid>
          <UFormField label="Dari">
            <UInput
              v-model="saring.dari"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sampai">
            <UInput
              v-model="saring.sampai"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Bank">
            <USelect
              v-model="saring.bank"
              :items="[{ value: SEMUA, label: 'Semua bank' }, ...semuaBank.map(b => ({ value: b, label: b }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Saring">
            <USelect
              v-model="saring.status"
              :items="[{ value: SEMUA, label: 'Semua' }, { value: 'belumScan', label: 'Bukti belum discan' }, { value: 'selisih', label: 'Dana tidak sama' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Cari"
            class="col-span-2"
          >
            <UInput
              v-model="saring.q"
              icon="i-lucide-search"
              placeholder="Nama tamu / no. HP / bank…"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <AppChips
          class="mt-4"
          :model-value="null"
          :options="[
            { value: 'today', label: 'Hari ini' },
            { value: 'week', label: '7 hari' },
            { value: 'month', label: 'Bulan ini' },
            { value: 'all', label: 'Semua' },
          ]"
          @update:model-value="(v) => v && pilihan(v as 'today' | 'week' | 'month' | 'all')"
        />
      </AppPanel>

      <AppPanel flush>
        <template #head>
          <AppSeg
            v-model="saring.tab"
            :options="[
              { value: 'perlu', label: 'Perlu diverifikasi', icon: 'i-lucide-hourglass', badge: ringkas.perlu },
              { value: 'sudah', label: `Terverifikasi${ringkas.sudah ? ` · ${ringkas.sudah}` : ''}`, icon: 'i-lucide-check' },
              { value: 'tolak', label: `Ditolak${ringkas.tolak ? ` · ${ringkas.tolak}` : ''}`, icon: 'i-lucide-x' },
            ]"
          />
        </template>
        <div class="hidden lg:block">
          <UTable
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 text-[13px] whitespace-normal' }"
            :data="halaman"
            :columns="kolom"
            :loading="status === 'pending'"
            empty="Tidak ada transaksi pada saringan ini."
          >
            <template #tanggal-cell="{ row }">
              <b>{{ row.original.p.tfDate ? tglPendek(row.original.p.tfDate) : '' }}</b>
              <span
                v-if="!row.original.p.tfDate"
                class="text-muted"
              >{{ tglPendek(row.original.r.date) }}</span>
              <div
                v-if="!row.original.p.tfDate"
                class="text-xs text-dimmed"
              >
                dari tgl reservasi
              </div>
              <div
                v-if="tglSeharusnya(row.original.p.tfOcrText, row.original.p.tfTime, row.original.p.tfDate)"
                class="text-xs font-bold"
              >
                Seharusnya {{ tglPendek(tglSeharusnya(row.original.p.tfOcrText, row.original.p.tfTime, row.original.p.tfDate)) }}
                <div class="font-medium">
                  <UButton
                    v-if="bolehVerifikasi"
                    label="Betulkan"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="betulkanTanggal(row.original)"
                  />
                </div>
              </div>
            </template>
            <template #jam-cell="{ row }">
              <b v-if="row.original.p.tfTime">{{ jamTampil(row.original.p.tfTime) }}</b>
              <span
                v-else
                class="text-muted"
              >-</span>
              <div
                v-if="jamRagu(row.original.p.tfOcrText, row.original.p.tfTime)"
                class="text-xs text-dimmed"
              >
                bukti menulis {{ jamRagu(row.original.p.tfOcrText, row.original.p.tfTime) }}, tanpa AM/PM
              </div>
              <div
                v-if="jamSeharusnya(row.original.p.tfOcrText, row.original.p.tfTime)"
                class="text-xs font-bold"
              >
                Seharusnya {{ jamSeharusnya(row.original.p.tfOcrText, row.original.p.tfTime) }}
                <div class="font-medium">
                  <UButton
                    v-if="bolehVerifikasi"
                    label="Betulkan"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="betulkanJam(row.original)"
                  />
                </div>
              </div>
            </template>
            <template #bank-cell="{ row }">
              {{ txBank(row.original) || '-' }}
            </template>
            <template #nama-cell="{ row }">
              <b v-if="txNama(row.original)">{{ txNama(row.original) }}</b>
              <span
                v-else
                class="text-muted"
              >-</span>
              <div
                v-if="txNama(row.original) && txNama(row.original).toLowerCase() !== (row.original.r.name || '').toLowerCase()"
                class="text-xs text-dimmed"
              >
                beda dgn pemesan
              </div>
            </template>
            <template #nominal-cell="{ row }">
              <b class="num">{{ rp(txNominal(row.original)) }}</b>
              <div
                v-if="row.original.dari > 1"
                class="text-xs text-dimmed"
              >
                DP {{ row.original.ke }} dari {{ row.original.dari }} · total {{ rp(dpTotal(row.original.r)) }}
              </div>
              <div
                v-if="txSelisih(row.original)"
                class="text-xs font-bold"
              >
                Dana tidak sama
                <div class="font-medium text-muted">
                  input host {{ rp(Number(row.original.p.amount) || 0) }}
                </div>
              </div>
            </template>
            <template #tamu-cell="{ row }">
              <div class="font-semibold">
                {{ row.original.r.name }}
              </div>
              <div class="text-muted num">
                {{ tampilPhone(row.original.r.phone) }}
              </div>
              <div class="text-muted num">
                {{ tglPendek(row.original.r.date) }} {{ row.original.r.time }}{{ row.original.r.table ? ` · meja ${row.original.r.table}` : '' }}
              </div>
              <div
                v-if="row.original.dari > 1"
                class="text-xs text-dimmed"
              >
                reservasi ini: {{ dpHitungTerverifikasi(row.original.r) }} dari {{ row.original.dari }} DP terverifikasi
              </div>
            </template>
            <template #bukti-cell="{ row }">
              <UButton
                v-if="row.original.p.proofData"
                label="Lihat"
                color="neutral"
                variant="ghost"
                size="xs"
                loading-auto
                @click="lihatBukti(row.original)"
              />
              <AppStatus v-else>
                tanpa bukti
              </AppStatus>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="row.original.p.tfStatus === 'verified' ? 'success' : row.original.p.tfStatus === 'rejected' ? 'error' : 'warning'"
                :icon="row.original.p.tfStatus === 'verified' ? 'i-lucide-check' : row.original.p.tfStatus === 'rejected' ? 'i-lucide-x' : 'i-lucide-hourglass'"
              >
                {{ row.original.p.tfStatus === 'verified' ? 'Terverifikasi' : row.original.p.tfStatus === 'rejected' ? 'Ditolak' : 'Belum terverifikasi' }}
              </AppStatus>
              <span
                v-if="row.original.p.tfStatus === 'verified' && row.original.p.tfTanpaData"
                class="ms-1 text-xs text-muted"
              >(dari gambar)</span>
              <span
                v-if="!row.original.p.tfStatus && row.original.p.tfSource === 'ocr'"
                class="ms-1 text-xs"
              >(angka dari mesin)</span>
              <div
                v-if="row.original.p.tfNote"
                class="mt-0.5 text-xs text-muted"
              >
                {{ row.original.p.tfNote }}
              </div>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex w-[168px] flex-wrap gap-1">
                <UButton
                  v-if="txBuktiGambar(row.original) && bolehVerifikasi"
                  :label="txSudahScan(row.original) ? 'Scan ulang' : 'Scan'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  loading-auto
                  @click="pindaiBaris(row.original)"
                />
                <UButton
                  label="Cek / Edit"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaTfEdit(row.original)"
                />
                <UButton
                  v-if="row.original.p.tfStatus !== 'verified' && bolehVerifikasi"
                  label="Verifikasi"
                  icon="i-lucide-check"
                  color="success"
                  size="xs"
                  @click="bukaVerifikasi(row.original)"
                />
                <UButton
                  v-if="row.original.p.tfStatus !== 'rejected' && bolehVerifikasi"
                  label="Tolak"
                  icon="i-lucide-x"
                  color="error"
                  variant="soft"
                  size="xs"
                  @click="bukaTolak(row.original)"
                />
                <UButton
                  v-if="bolehHapus"
                  label="Hapus"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="hapusDp(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>

        <!-- Phone: the same rows, tapped open into Cek / Edit. -->
        <div class="divide-y divide-default lg:hidden">
          <button
            v-for="x in halaman"
            :key="`${x.r.id}#${x.ke}`"
            type="button"
            class="flex w-full items-start justify-between gap-3 px-4 py-3 text-start hover:bg-muted/60"
            @click="bukaTfEdit(x)"
          >
            <span class="min-w-0">
              <span class="block truncate font-semibold text-highlighted">{{ x.r.name }} · <span class="num">{{ rp(txNominal(x)) }}</span></span>
              <span class="block text-sm text-muted">{{ txBank(x) || 'tanpa bank' }} · {{ x.p.tfDate ? tglPendek(x.p.tfDate) : tglPendek(x.r.date) }}{{ x.dari > 1 ? ` · DP ${x.ke}/${x.dari}` : '' }}{{ txSelisih(x) ? ' · dana tidak sama' : '' }}{{ x.p.proofData ? '' : ' · tanpa bukti' }}</span>
            </span>
            <AppStatus
              :color="x.p.tfStatus === 'verified' ? 'success' : x.p.tfStatus === 'rejected' ? 'error' : 'warning'"
              :icon="x.p.tfStatus === 'verified' ? 'i-lucide-check' : x.p.tfStatus === 'rejected' ? 'i-lucide-x' : 'i-lucide-hourglass'"
            >
              {{ x.p.tfStatus === 'verified' ? 'Terverifikasi' : x.p.tfStatus === 'rejected' ? 'Ditolak' : 'Belum dicek' }}
            </AppStatus>
          </button>
          <p
            v-if="!halaman.length"
            class="px-4 py-6 text-center text-muted"
          >
            Tidak ada transaksi pada saringan ini.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-3 text-sm text-muted">
          <USelect
            v-model.number="perHal"
            :items="[{ value: 10, label: '10 / hal' }, { value: 25, label: '25 / hal' }, { value: 50, label: '50 / hal' }]"
            size="sm"
            class="w-28"
          />
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Halaman sebelumnya"
              :disabled="hal <= 1"
              @click="hal--"
            />
            <span class="num">Hal {{ hal }} / {{ maxHal }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Halaman berikutnya"
              :disabled="hal >= maxHal"
              @click="hal++"
            />
          </div>
        </div>
      </AppPanel>
    </template>
    <template v-else>
      <p class="mb-3 text-sm text-muted">
        Pembayaran yang dicatat tim Marketing untuk event <b>dan Reservasi VIP</b> — DP maupun pelunasan.
        Dipakai kasir memastikan dananya benar-benar masuk dan berapa. Daftar ini <b>hanya dibaca</b>;
        yang mengubahnya modul Marketing. Disaring menurut <b>tanggal acara</b>, bukan tanggal bayar.
      </p>

      <div
        v-if="dpev.memuat"
        class="rounded-lg border border-default p-3 text-sm text-muted"
      >
        Memuat pembayaran event dari modul Marketing…
      </div>
      <div
        v-else-if="dpev.tanpaAkses"
        class="rounded-lg border border-default p-3 text-sm"
      >
        <b>Belum punya akses.</b>
        Tab ini terbuka untuk pemegang modul Marketing, Reservasi, Cashier, atau Finance, dan akun ini tidak memegang satu pun. DP reservasi di tab sebelah tetap bisa dipakai.
      </div>
      <div
        v-else-if="dpev.galat"
        class="rounded-lg border border-default p-3 text-sm"
      >
        <b>Pembayaran event tidak terbaca.</b> {{ dpev.galat }}<br>
        Daftar ini datang dari modul <b>Marketing</b>. Kalau baru saja diperbarui, backend-nya mungkin belum ter-deploy;
        kalau modulnya sendiri sedang bermasalah, DP reservasi di tab sebelah tetap bisa dipakai.
        <UButton
          label="Coba lagi"
          color="neutral"
          variant="ghost"
          size="sm"
          class="ms-1"
          @click="dpevCobaLagi"
        />
      </div>
      <p
        v-else-if="!dpev.data"
        class="text-sm text-muted"
      >
        Belum dimuat.
      </p>
      <template v-else>
        <AppList title="Ringkasan DP event">
          <AppListRow
            title="Total DP event masuk"
            :description="`${angka(barisEv.length)} kali bayar · ${saring.dari ? tglPendek(saring.dari) : 'awal'} – ${saring.sampai ? tglPendek(saring.sampai) : 'sekarang'}`"
            icon="i-lucide-wallet"
          >
            <template #trailing>
              {{ rp(totalEv) }}
            </template>
          </AppListRow>
          <AppListRow
            title="Event"
            description="punya pembayaran di rentang ini"
            icon="i-lucide-party-popper"
          >
            <template #trailing>
              {{ angka(nEvent) }}
            </template>
          </AppListRow>
          <AppListRow
            v-for="j in perJenis.slice(0, 2)"
            :key="j.jenis"
            :title="j.jenis"
            :description="`${angka(j.n)} kali bayar`"
          >
            <template #trailing>
              {{ rp(j.sum) }}
            </template>
          </AppListRow>
        </AppList>

        <p
          v-if="(dpev.data.tanpaTanggal || 0) > 0"
          class="mb-5 rounded-lg border border-default p-3 text-sm text-muted"
        >
          <b>{{ dpev.data.tanpaTanggal }} pembayaran belum punya tanggal bayar.</b> Barisnya TETAP muncul —
          penyaring memakai tanggal <b>acara</b>, bukan tanggal bayar — dan kolom Tgl Bayar-nya ditandai
          <b>belum diisi</b>. Dilengkapi di modul <b>Marketing</b> → event terkait → tab Finance.
        </p>

        <p
          v-if="dpev.data.vipTerkunci && Number(dpev.data.vipTerkunci.n) > 0"
          class="mb-5 rounded-lg border border-default p-3 text-sm text-muted"
        >
          <b>{{ dpev.data.vipTerkunci.n }} DP Reservasi VIP</b> senilai
          <b>{{ rp(Number(dpev.data.vipTerkunci.total) || 0) }}</b> di daftar ini
          <b>juga berdiri di tab DP Reservasi</b> — mejanya sudah dikunci, jadi DP-nya ikut tersalin ke sana.
          <b>Jangan menjumlahkan kedua tab</b>. VIP yang mejanya <i>belum</i> dikunci hanya ada di sini.
        </p>

        <div class="mb-5 flex flex-wrap items-end gap-2">
          <UFormField
            label="Tanggal acara — Dari"
            class="max-w-44"
          >
            <UInput
              v-model="saring.dari"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Sampai"
            class="max-w-44"
          >
            <UInput
              v-model="saring.sampai"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Cari"
            class="min-w-44 flex-1"
          >
            <UInput
              v-model="dpev.q"
              placeholder="Nama event / client / PIC / no. kwitansi…"
              class="w-full"
            />
          </UFormField>
          <div class="flex gap-1">
            <UButton
              label="Hari ini"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="pilihan('today')"
            />
            <UButton
              label="7 hari"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="pilihan('week')"
            />
            <UButton
              label="Bulan ini"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="pilihan('month')"
            />
            <UButton
              label="Semua"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="pilihan('all')"
            />
          </div>
        </div>

        <div class="mb-7 hidden overflow-hidden rounded-panel border border-default bg-default shadow-panel lg:block">
          <UTable
            :data="barisEv"
            :columns="kolomEv"
            :loading="dpev.memuat"
            empty="Tidak ada pembayaran event pada rentang ini."
          >
            <template #tglEvent-cell="{ row }">
              <b>{{ row.original.tglEvent ? tglPendek(row.original.tglEvent) : '—' }}</b>
            </template>
            <template #event-cell="{ row }">
              <div class="font-semibold">
                {{ row.original.event || '(tanpa nama)' }}
              </div>
              <div class="text-muted">
                {{ row.original.client || 'tanpa client' }}{{ row.original.pic ? ` · PIC ${row.original.pic}` : '' }}
              </div>
              <div class="text-xs text-dimmed">
                {{ row.original.status }}{{ row.original.sumber === 'vip' ? ' · Reservasi VIP' : '' }}
              </div>
              <div
                v-if="row.original.sumber === 'vip' && row.original.resId"
                class="text-xs text-dimmed"
              >
                Juga ada di tab DP Reservasi — jangan dihitung dua kali
              </div>
            </template>
            <template #type-cell="{ row }">
              {{ row.original.type || '-' }}
            </template>
            <template #amount-cell="{ row }">
              <b class="num">{{ rp(Number(row.original.amount) || 0) }}</b>
            </template>
            <template #method-cell="{ row }">
              <span class="text-muted">{{ row.original.method || '-' }}</span>
            </template>
            <template #at-cell="{ row }">
              <span
                v-if="row.original.at"
                class="text-muted"
              >{{ tglPendek(row.original.at) }}</span>
              <AppStatus v-else>
                belum diisi
              </AppStatus>
            </template>
            <template #no-cell="{ row }">
              <span class="num text-muted">{{ row.original.no || '-' }}</span>
            </template>
            <template #bukti-cell="{ row }">
              <UButton
                v-if="tautanBuktiEv(row.original)"
                label="Bukti"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="bukaBerkasMkt(kunciBerkasMkt(tautanBuktiEv(row.original)))"
              />
              <span
                v-else-if="row.original.receipt"
                class="text-xs text-muted"
              >ada (di Marketing)</span>
              <AppStatus v-else>
                tanpa bukti
              </AppStatus>
            </template>
          </UTable>
        </div>

        <AppList
          title="Pembayaran event"
          class="lg:hidden"
        >
          <AppListRow
            v-for="b in barisEv"
            :key="`${b.evId}#${b.id}`"
            :title="`${b.event || '(tanpa nama)'} · ${rp(Number(b.amount) || 0)}`"
            :description="`${b.tglEvent ? tglPendek(b.tglEvent) : '—'} · ${b.type || '-'}${b.sumber === 'vip' && b.resId ? ' · juga di DP Reservasi' : ''}`"
            icon="i-lucide-party-popper"
            dim
          />
          <div
            v-if="!barisEv.length"
            class="px-4 py-3 text-sm text-muted"
          >
            <p v-if="dpev.q">
              Tidak ada pembayaran yang cocok dengan “{{ dpev.q }}”.
            </p>
            <p v-else>
              Tidak ada pembayaran untuk acara pada {{ saring.dari ? tglPendek(saring.dari) : 'awal' }} – {{ saring.sampai ? tglPendek(saring.sampai) : 'sekarang' }}.
            </p>
            <p
              v-if="dpev.data.luar && Number(dpev.data.luar.n) > 0"
              class="mt-2"
            >
              Di luar rentang ini ada <b>{{ dpev.data.luar.n }} pembayaran</b> senilai
              <b>{{ rp(Number(dpev.data.luar.total) || 0) }}</b>
              ({{ dpev.data.luar.dari ? tglPendek(dpev.data.luar.dari) : '' }} – {{ dpev.data.luar.sampai ? tglPendek(dpev.data.luar.sampai) : '' }}).
              <UButton
                label="Tampilkan"
                color="neutral"
                variant="soft"
                size="sm"
                class="ms-1"
                @click="pakaiRentangLuar"
              />
            </p>
          </div>
        </AppList>
      </template>
    </template>
    <ResponsiveSheet
      v-model:open="sheetBukti"
      :title="buktiJudul"
    >
      <p
        v-if="buktiMemuat"
        class="text-sm text-muted"
      >
        Memuat bukti…
      </p>
      <p
        v-else-if="buktiGalat"
        class="text-sm"
      >
        {{ buktiGalat }}
      </p>
      <img
        v-else-if="!buktiPdf && buktiData"
        :src="buktiData"
        :alt="buktiJudul"
        class="w-full rounded-lg border border-default"
      >
      <object
        v-else-if="buktiPdf && buktiData"
        :data="buktiData"
        type="application/pdf"
        class="h-96 w-full rounded-lg border border-default"
      />
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetBukti = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetTf"
      :title="`Cek dana masuk — ${tfTampil.nama}${tfForm.dari > 1 ? ` (DP ${tfForm.ke} dari ${tfForm.dari})` : ''}`"
      :description="tfTampil.info"
    >
      <div class="space-y-3">
        <p class="rounded-lg border border-default bg-default p-3 text-sm text-muted">
          Nominal transfer ini menurut host: <b>{{ rp(tfTampil.hostNominal) }}</b> ({{ tfTampil.hostMetode || '-' }})
          <template v-if="tfForm.dari > 1">
            <br>Total DP semua cicilan: <b>{{ rp(tfRes ? dpTotal(tfRes) : 0) }}</b> dari {{ tfForm.dari }} kali transfer.
          </template>
        </p>
        <div
          v-if="jumlahSaran && bolehVerifikasi"
          class="rounded-lg border border-default p-3 text-sm"
        >
          <b>{{ jumlahSaran }} kolom punya hasil baca mesin.</b> Angkanya <b>belum masuk</b> —
          cocokkan dulu dengan gambar di bawah, baru tekan <b>Pakai</b>.
          Mesin sering benar, tapi pernah membaca Rp200.000 jadi Rp20.000.000.
          <div class="mt-2">
            <UButton
              :label="`Pakai semua (${jumlahSaran})`"
              color="neutral"
              variant="soft"
              size="sm"
              @click="pakaiSemuaSaran"
            />
          </div>
        </div>
        <UFormField label="Tanggal transfer">
          <UInput
            v-model="tfForm.date"
            type="date"
            size="xl"
            class="w-full"
          />
          <p
            v-if="tglStempelTf"
            class="mt-1.5 text-xs font-bold"
          >
            Nomor Ref di bukti menyebut <b>{{ tglPendek(tglStempelTf) }}</b>, dan jamnya cocok dengan jam transfer ini.
            <UButton
              v-if="bolehVerifikasi"
              label="Pakai tanggal ini"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ms-1"
              @click="tfForm.date = tglStempelTf"
            />
          </p>
          <p
            v-for="k in KUNCI_SARAN.filter(k => k.kunci === 'date' && saranTf(k.kunci) !== '')"
            :key="k.kunci"
            class="mt-1.5 text-xs text-muted"
          >
            Hasil baca mesin: <b>{{ saranTampil(k.kunci, saranTf(k.kunci)) }}</b>
            <UButton
              v-if="bolehVerifikasi"
              label="Pakai"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ms-1"
              @click="pakaiSaran(k.kunci)"
            />
          </p>
        </UFormField>
        <UFormField label="Jam transfer (24 jam, WIB — ikut detik bila ada di bukti)">
          <UInput
            v-model="tfForm.time"
            type="time"
            step="1"
            size="xl"
            class="w-full"
          />
          <p
            v-for="k in KUNCI_SARAN.filter(k => k.kunci === 'time' && saranTf(k.kunci) !== '')"
            :key="k.kunci"
            class="mt-1.5 text-xs text-muted"
          >
            Hasil baca mesin: <b>{{ saranTampil(k.kunci, saranTf(k.kunci)) }}</b>
            <UButton
              v-if="bolehVerifikasi"
              label="Pakai"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ms-1"
              @click="pakaiSaran(k.kunci)"
            />
          </p>
        </UFormField>
        <UFormField label="Bank / metode">
          <UInput
            v-model="tfForm.bank"
            list="tfBanks"
            placeholder="mis. BCA"
            size="xl"
            class="w-full"
          />
          <datalist id="tfBanks">
            <option
              v-for="b in bankOpsi"
              :key="b"
              :value="b"
            />
          </datalist>
          <p
            v-for="k in KUNCI_SARAN.filter(k => k.kunci === 'bank' && saranTf(k.kunci) !== '')"
            :key="k.kunci"
            class="mt-1.5 text-xs text-muted"
          >
            Hasil baca mesin: <b>{{ saranTampil(k.kunci, saranTf(k.kunci)) }}</b>
            <UButton
              v-if="bolehVerifikasi"
              label="Pakai"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ms-1"
              @click="pakaiSaran(k.kunci)"
            />
          </p>
        </UFormField>
        <UFormField label="Nama pemilik rekening pengirim">
          <UInput
            v-model="tfForm.name"
            placeholder="mis. DODY IRWANDI"
            size="xl"
            class="w-full"
          />
          <p
            v-for="k in KUNCI_SARAN.filter(k => k.kunci === 'name' && saranTf(k.kunci) !== '')"
            :key="k.kunci"
            class="mt-1.5 text-xs text-muted"
          >
            Hasil baca mesin: <b>{{ saranTampil(k.kunci, saranTf(k.kunci)) }}</b>
            <UButton
              v-if="bolehVerifikasi"
              label="Pakai"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ms-1"
              @click="pakaiSaran(k.kunci)"
            />
          </p>
        </UFormField>
        <UFormField label="Nominal di bukti">
          <UInput
            :model-value="tfForm.amount"
            inputmode="numeric"
            placeholder="mis. 500.000"
            size="xl"
            class="w-full"
            @update:model-value="(v) => (tfForm.amount = fmtRupiah(rupiahVal(String(v))))"
          />
          <p
            v-for="k in KUNCI_SARAN.filter(k => k.kunci === 'amount' && saranTf(k.kunci) !== '')"
            :key="k.kunci"
            class="mt-1.5 text-xs text-muted"
          >
            Hasil baca mesin: <b>{{ saranTampil(k.kunci, saranTf(k.kunci)) }}</b>
            <UButton
              v-if="bolehVerifikasi"
              label="Pakai"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ms-1"
              @click="pakaiSaran(k.kunci)"
            />
          </p>
        </UFormField>
        <div>
          <p class="mb-1 text-xs font-semibold text-muted">
            Kwitansi
          </p>
          <KwitansiSlot
            v-if="tfRes"
            :res-id="tfForm.resId"
            :reservasi="tfRes"
            :boleh-minta="bolehVerifikasi"
            :boleh-langsung="bolehKwitansiLangsung"
          />
        </div>
        <div>
          <UButton
            v-if="bolehVerifikasi"
            label="Tamu bayar lagi? Tambah DP"
            color="neutral"
            variant="soft"
            size="sm"
            @click="sheetTf = false; bukaTambah(tfForm.resId)"
          />
        </div>
        <UFormField label="Catatan finance">
          <UInput
            v-model="tfForm.note"
            placeholder="mis. dana masuk rek. BCA 12:04"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="tfSimpan"
          class="text-xs text-muted"
        >
          {{ tfSimpan.tfOcrAt ? `Terakhir dibaca mesin ${capWaktu(tfSimpan.tfOcrAt)}${tfSimpan.tfSource === 'manual' ? ' · isian di atas sudah pernah disimpan orang' : tfSimpan.tfSource === 'ocr' ? ' · isian di atas berasal dari mesin dan belum pernah dicek orang' : ''}` : 'Belum pernah dibaca mesin.' }}
        </p>
        <details v-if="tfSimpan?.tfOcrText">
          <summary class="cursor-pointer text-xs text-muted">
            Lihat teks mentah hasil OCR
          </summary>
          <pre class="mt-1.5 max-h-40 overflow-auto rounded-lg border border-default bg-default p-2 text-xs whitespace-pre-wrap">{{ tfSimpan.tfOcrText }}</pre>
        </details>
        <div>
          <p class="mb-1 text-xs font-semibold text-muted">
            Bukti transfer
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="tfTampil.buktiAda"
              label="Lihat bukti"
              color="neutral"
              variant="soft"
              size="sm"
              loading-auto
              @click="tfSimpan && tfRes && lihatBukti({ r: tfRes, p: tfSimpan, ke: tfForm.ke, dari: tfForm.dari })"
            />
            <UButton
              v-if="tfTampil.buktiGambar && bolehVerifikasi"
              label="Scan ulang bukti ini"
              color="neutral"
              variant="soft"
              size="sm"
              loading-auto
              @click="tfSimpan && tfRes && pindaiBaris({ r: tfRes, p: tfSimpan, ke: tfForm.ke, dari: tfForm.dari })"
            />
            <span
              v-if="!tfTampil.buktiAda"
              class="text-sm text-muted"
            >Tidak ada bukti transfer yang di-upload.</span>
          </div>
        </div>
      </div>
      <template #footer>
        <UButton
          v-if="bolehVerifikasi"
          label="Simpan"
          size="xl"
          loading-auto
          @click="simpanTf(false)"
        />
        <UButton
          v-if="bolehVerifikasi"
          label="Simpan & verifikasi"
          color="neutral"
          variant="soft"
          size="xl"
          loading-auto
          @click="simpanTf(true)"
        />
        <UButton
          v-if="bolehVerifikasi"
          label="Tolak"
          color="error"
          variant="ghost"
          size="xl"
          @click="tfSimpan && tfRes && bukaTolak({ r: tfRes, p: tfSimpan, ke: tfForm.ke, dari: tfForm.dari }, true)"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetTf = false"
        />
      </template>
    </ResponsiveSheet>
    <ResponsiveSheet
      v-model:open="sheetVer"
      :title="`Verifikasi dana masuk — ${ver.nama}${ver.dari > 1 ? ` (DP ${ver.ke} dari ${ver.dari})` : ''}`"
    >
      <div class="space-y-2 text-sm">
        <p class="rounded-lg border border-default bg-default p-3 text-muted">
          Kamu menyatakan uang ini <b>benar-benar sudah masuk</b> ke rekening.
          Pernyataan ini dipakai halaman lain sebagai fakta dan tercatat atas namamu di audit log.
        </p>
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Tanggal transfer</span>
          <b>{{ ver.date ? `${tglPendek(ver.date)}${ver.time ? ` ${ver.time}` : ''}` : '— tidak terbaca —' }}</b>
        </div>
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Bank / metode</span>
          <span>{{ ver.bank || '— tidak terbaca —' }}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Nama pengirim</span>
          <span>{{ ver.name || '— tidak terbaca —' }}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Nominal di bukti</span>
          <b>{{ ver.nomBukti ? rp(ver.nomBukti) : '— tidak terbaca —' }}</b>
        </div>
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Nominal menurut host</span>
          <span>{{ rp(ver.nomHost) }}</span>
        </div>
        <p
          v-if="ver.nomBukti && ver.nomHost && ver.nomBukti !== ver.nomHost"
          class="rounded-lg border border-default p-3"
        >
          Selisih <b>{{ rp(Math.abs(ver.nomBukti - ver.nomHost)) }}</b> antara bukti dan angka yang diinput host.
          Yang dipakai sebagai dana masuk adalah <b>{{ rp(ver.nomBukti) }}</b> (angka di bukti).
        </p>
        <p
          v-if="ver.kurang.length"
          class="rounded-lg border border-default p-3"
        >
          <b>{{ ver.kurang.length }} data tidak terbaca:</b> {{ ver.kurang.join(', ') }}.<br>
          Ini wajar kalau gambar buktinya gelap, miring, atau berupa foto layar.
          <b>Kamu tetap boleh memverifikasi</b> berdasarkan gambar buktinya.
          Barisnya akan ditandai <i>“dari gambar”</i> supaya bedanya terlihat saat diaudit.
          <template v-if="!ver.nomBukti">
            <br>Nominal yang dicatat memakai angka host: <b>{{ rp(ver.nomHost) }}</b>.
          </template>
        </p>
      </div>
      <template #footer>
        <UButton
          :label="ver.kurang.length ? 'Ya, verifikasi tanpa data lengkap' : 'Ya, verifikasi'"
          size="xl"
          loading-auto
          @click="verifikasiGo"
        />
        <UButton
          label="Lengkapi dulu"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetVer = false; sheetTf = true"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetVer = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetTolak"
      :title="`Tolak bukti transfer — ${tolak.nama}`"
    >
      <UFormField label="Alasan (mis. bukti tidak terbaca / dana tidak masuk)">
        <UTextarea
          v-model="tolak.alasan"
          :rows="3"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tolak bukti"
          color="error"
          size="xl"
          loading-auto
          @click="tolakGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetTolak = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetTambah"
      :title="`Tambah bukti TF DP — ${tambah.nama}`"
      :description="tambah.info"
    >
      <div class="space-y-3">
        <p
          v-if="tambah.ke > 1"
          class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
        >
          Sudah masuk <b>{{ rp(tambah.sudahMasuk) }}</b> dari {{ tambah.ke - 1 }} kali transfer.
          Ini akan jadi <b>DP ke-{{ tambah.ke }}</b>.
        </p>
        <p
          v-else
          class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
        >
          Belum ada DP tercatat. Ini akan jadi <b>DP pertama</b>.
        </p>
        <UFormField
          label="Nominal DP"
          required
        >
          <UInput
            :model-value="tambah.nominal"
            inputmode="numeric"
            placeholder="mis. 300.000"
            size="xl"
            class="w-full"
            @update:model-value="(v) => (tambah.nominal = fmtRupiah(rupiahVal(String(v))))"
          />
        </UFormField>
        <UFormField label="Metode / tujuan transfer">
          <USelect
            v-model="tambah.metode"
            :items="opsiDpMetode(dpMethods, tambah.metode)"
            size="xl"
            class="w-full"
          />
          <p class="mt-1 text-xs text-muted">
            Tanggal, jam, nominal, bank &amp; nama pengirim akan dibaca otomatis dari bukti ini di halaman Dana Masuk.
          </p>
        </UFormField>
        <UFormField
          label="Upload bukti transfer (foto/pdf)"
          required
        >
          <UFileUpload
            :model-value="tambah.berkas"
            accept="image/*,application/pdf"
            label="Pilih bukti"
            description="Gambar atau PDF, maks 5 MB"
            @update:model-value="pilihBerkas"
          >
            <p
              v-if="tambah.namaBerkas"
              class="mt-1 text-xs text-muted"
            >
              {{ tambah.namaBerkas }}
            </p>
          </ufileupload>
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan DP"
          size="xl"
          loading-auto
          @click="simpanTambah"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetTambah = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="konfirmasi.buka"
      :title="konfirmasi.judul"
    >
      <p class="text-sm text-muted">
        {{ konfirmasi.pesan }}
      </p>
      <template #footer>
        <UButton
          :label="konfirmasi.label"
          :color="konfirmasi.bahaya ? 'error' : 'neutral'"
          :variant="konfirmasi.bahaya ? 'solid' : 'soft'"
          size="xl"
          loading-auto
          @click="jalankanKonfirmasi"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="konfirmasi.buka = false"
        />
      </template>
    </ResponsiveSheet>
  </div>
</template>
