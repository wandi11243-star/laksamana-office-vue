<!--
  Input Reservasi — the whole booking form, new and edit (?id=).

  The table is picked on the map, not typed, and the map follows the date: which
  plan applies is decided by app/utils/venue-layouts.ts, and who holds a table is
  decided by app/utils/kunci-meja.ts. Neither rule is re-implemented here.

  Three things this screen is strict about, all of them about money:
    - a deposit with no proof and no amount is refused (F1, F2);
    - a booking written before that rule existed is ASKED once, not locked (F3);
    - the table is re-checked against fresh server data before saving, because
      two people can pick the same table from two devices (`:4637`).

  The record builder copies every field the old client wrote, including the two
  the old builder forgot — `tableAsli` and `tfName` (noted in reservasi.md J.1).
-->
<script setup lang="ts">
import type { Reservasi, ReservasiArrival } from '~/composables/useReservasi'
import {
  createReservation, deleteReservation, getReservation, listReservations,
  patchReservation, useDaftarReservasi, useDenah, useRingkasanTamu, useSection,
} from '~/composables/useReservasi'
import type { LayoutDenah } from '~/utils/venue-layouts'
import { dayTypeLayoutLt, getLayout, parseKeyTanggal } from '~/utils/venue-layouts'
import { buatIzinTumpang, conflictCheck, tablesOf } from '~/utils/kunci-meja'
import { adaBuktiDp, dpBaru, dpMetodeBawaan, normPhone, pastikanDps, resetDpScan, syncDp, tampilPhone, uid } from '~/utils/dp-reservasi'
import { cariTamuLewatNama, cariTamuLewatNomor, direktoriTamu, profilTamuGabung } from '~/utils/riwayat'
import { fmtRupiah, hariIni, normTime, opsiJam, rupiahVal, tambahHari, tglPendek } from '~/utils/format'
import { bolehAksi, roleReservasi } from '~/utils/layar/reservasi'

definePageMeta({ access: ['reservasi'] })

const route = useRoute()
const router = useRouter()
const me = useMe()
const toast = useToast()

const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''))
const modeEdit = computed(() => !!id.value)
const namaSaya = computed(() => me.value?.name ?? '')
const picType = computed(() => (roleReservasi(me.value) === 'marketing' ? 'Marketing' : 'Host/Captain'))
const bolehHapus = computed(() => bolehAksi('deleteReservation', roleReservasi(me.value)))

// --- the plan and its saved overrides ---------------------------------------
const { master } = useDenah()
const { data: categories } = useSection<string[]>('categories')
const { data: dpMethods } = useSection<string[]>('dpMethods')
const { data: infoSources } = useSection<string[]>('infoSources')
const { data: dineEstMin } = useSection<number>('dineEstMin')
const { data: clashLeadMin } = useSection<number>('clashLeadMin')

/** The master bits the seat rules need. `dineEstMin` / `clashLeadMin` are passed everywhere, never left to the 180/10 default. */
const masterKunci = computed(() => ({
  ...master.value,
  dineEstMin: Number(dineEstMin.value) > 0 ? Number(dineEstMin.value) : undefined,
  clashLeadMin: Number(clashLeadMin.value) > 0 ? Number(clashLeadMin.value) : undefined,
}))
const dineEst = computed(() => (Number(dineEstMin.value) > 0 ? Number(dineEstMin.value) : 180))

// --- the form ---------------------------------------------------------------

const form = reactive({
  name: '',
  phone: '',
  date: hariIni(),
  time: '00:00',
  pax: 1,
  table: '',
  sharing: false,
  category: '',
  foodReq: '',
  drinkReq: '',
  dpStatus: 'Belum' as 'Sudah' | 'Belum',
  lunas: false,
  dpMethod: '',
  dpAmount: '',
  source: '',
  member: 'tidak' as 'ya' | 'tidak',
  memberNo: '',
  notes: '',
})

/** Which floor is drawn, and which plan on it. The three buttons are the old ones: they change what is DRAWN, never what is stored — the date decides the stored one. */
const layer = ref<1 | 2>(1)
const layoutKey = ref('')

const denah = computed<LayoutDenah | null>(() => getLayout(master.value, layoutKey.value) ?? getLayout(master.value, 'weekday'))
const denahTanggal = computed(() => parseKeyTanggal(layoutKey.value) !== null)

watch([() => form.date, () => master.value, layer], () => {
  layoutKey.value = dayTypeLayoutLt(master.value, form.date, layer.value)
}, { immediate: true })

function setLayer(l: 1 | 2) {
  layer.value = l
}

/** The three plan buttons (Weekday / Weekend / Lantai 2). Leaving floor 2 first
 *  lets the date watcher settle, then draws the chosen floor-1 plan. */
async function pilihDenah(v?: string) {
  if (!v) return
  if (v === 'lt2') return setLayer(2)
  if (layer.value !== 1) {
    setLayer(1)
    await nextTick()
  }
  layoutKey.value = v
}

// --- the rows around the date, and the row being edited ---------------------

const dari = computed(() => tambahHari(form.date, -1))
const sampai = computed(() => tambahHari(form.date, 1))
const { data: sekitar, refresh } = useDaftarReservasi(dari, sampai, 'reservasi-input')

const { data: ini, refresh: refreshIni } = useAsyncData(`reservasi-satu-${id.value}`, () => (id.value ? getReservation(id.value) : Promise.resolve(null)))

const versi = ref<string | number | undefined>()
const lama = ref<Reservasi | null>(null)

function isiForm(r: Reservasi) {
  lama.value = r
  Object.assign(form, {
    name: r.name,
    phone: r.phone,
    date: r.date,
    time: r.time || '00:00',
    pax: r.pax || 1,
    table: r.table,
    sharing: !!r.sharing,
    category: r.category,
    foodReq: r.foodReq ?? '',
    drinkReq: r.drinkReq ?? '',
    dpStatus: r.dpStatus === 'Sudah' ? 'Sudah' : 'Belum',
    lunas: !!r.lunas,
    dpMethod: r.dpMethod ?? '',
    dpAmount: r.dpAmount ? String(r.dpAmount) : '',
    source: r.source ?? '',
    member: r.member ? 'ya' : 'tidak',
    memberNo: r.memberNo ?? '',
    notes: r.notes ?? '',
  })
  terpilih.value = tablesOf(r)
}

watch(ini, (res) => {
  if (res?.data) {
    isiForm(res.data)
    versi.value = versiDari(res) ?? res.data.updatedAt
  }
}, { immediate: true })

watch([categories, () => form.category], ([cats, c]) => {
  if (!c && cats?.length) form.category = cats[0]!
}, { immediate: true })
watch([dpMethods, () => form.dpMethod], ([list, m]) => {
  if (!m && list?.length) form.dpMethod = dpMetodeBawaan(list)
}, { immediate: true })

// --- proof files --------------------------------------------------------------

const buktiDpBaru = ref<File | null>(null)
const buktiDocBaru = ref<File | null>(null)
const MAKS_BUKTI = 5 * 1024 * 1024

const ukuran = (n: number) => (n >= 1024 * 1024 ? `${Math.round(n / 1024 / 1024)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** 5 MB is a hard limit: a bigger photo cannot be matched against a bank row. */
function pilihBukti(f: File | null | undefined, ke: 'dp' | 'doc') {
  if (!f) return
  if (f.size > MAKS_BUKTI) {
    toast.add({ title: 'File terlalu besar (maks 5MB)', color: 'error' })
    return
  }
  if (ke === 'dp') buktiDpBaru.value = f
  else buktiDocBaru.value = f
}

const jadiDataUri = (f: File) => new Promise<string>((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})

/** What is stored for a deposit proof right now: the new upload, or the one already in the row. */
const buktiTersimpan = computed(() => !!buktiDpBaru.value || adaBuktiDp(lama.value))

/** Open a stored proof: a `data:` row as it is, an `@f:` reference read from the file endpoint. */
async function lihatBukti() {
  const ref = lama.value?.dpProofData || ''
  if (!ref) return
  if (!ref.startsWith('@f:')) {
    window.open(ref, '_blank', 'noopener')
    return
  }
  try {
    const { data } = await getFile(ref.replace(/^@f:/, ''))
    window.open(data.data, '_blank', 'noopener')
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- the table, its approval, and the collision check -----------------------

const terpilih = ref<string[]>([])
/** Tables the crew forced for THIS date + time. It expires on its own the moment either changes (F6). */
const dipaksa = ref<string[]>([])
watch(() => `${form.date}|${form.time}`, () => {
  dipaksa.value = []
})

function pilihMeja(mejaId: string) {
  terpilih.value = terpilih.value.includes(mejaId) ? terpilih.value.filter(m => m !== mejaId) : [...terpilih.value, mejaId]
  form.table = terpilih.value.join(', ')
  if (!terpilih.value.includes(mejaId)) dipaksa.value = dipaksa.value.filter(m => m !== mejaId)
}

const tanyaTumpang = ref<{ meja: string, pesan: string, kunci: boolean } | null>(null)
const sheetTumpang = ref(false)

function onTumpang(p: { meja: string, pesan: string, kunci: boolean }) {
  if (p.kunci) {
    toast.add({ title: p.pesan, color: 'error' })
    return
  }
  tanyaTumpang.value = { meja: p.meja, pesan: p.pesan, kunci: false }
  sheetTumpang.value = true
}

/** The crew says yes: the table joins the picked ones and is marked as forced. The approval travels with the record, so it is written on save. */
function izinkanTumpang() {
  const mejaId = tanyaTumpang.value?.meja
  sheetTumpang.value = false
  if (!mejaId) return
  if (!dipaksa.value.includes(mejaId)) dipaksa.value = [...dipaksa.value, mejaId]
  pilihMeja(mejaId)
}

// --- the arrival correction (`:4689-4703`) ------------------------------------
// Arrival waves are real operational data, so they are NOT overwritten every time
// Pax is edited: that would erase "5 came at 18.00, 3 more at 19.15" the moment
// somebody fixes a typo. Only offered when the numbers are impossible (more
// recorded as arrived than booked), and held until Save is pressed.
const pendingArrivals = ref<ReservasiArrival[] | null>(null)

const paxDatang = computed(() => (pendingArrivals.value
  ? pendingArrivals.value.reduce((s, a) => s + (Number(a.pax) || 0), 0)
  : arrivedPax(lama.value)))

const paxTidakLogis = computed(() => !!lama.value && !pendingArrivals.value && paxDatang.value > (Number(form.pax) || 0))

function samakanDenganPax() {
  const n = Number(form.pax) || 0
  if (n <= 0) {
    toast.add({ title: 'Isi Jumlah Pax dulu', color: 'error' })
    return
  }
  const a = lama.value?.arrivals ?? []
  // The FIRST wave's stamp and recorder are kept: it is what the sitting time in
  // the list is counted from, and replacing it with "now" makes a guest who has
  // been at the table for two hours read as just arrived.
  pendingArrivals.value = [{ ts: (a[0]?.ts ?? lama.value?.checkinAt) || Date.now(), pax: n, by: a[0]?.by ?? namaSaya.value }]
}

// --- warnings ------------------------------------------------------------------

/** 20+ pax needs a manager's nod (`:4628`). A warning, never a block. */
const butuhApproval = computed(() => (Number(form.pax) || 0) >= 20)

/** The guest directory from the whole history: the server summary (before the
 *  window) first, then the loaded rows — what the datalists offer and what
 *  the autofill reads, as in the old client (`guestDirectory`). */
const { data: ringkasan } = useRingkasanTamu(dari, 'reservasi-tamu-input')
const direktori = computed(() => direktoriTamu(ringkasan.value ?? new Map(), sekitar.value ?? [], dari.value))
const namaTamu = computed(() => [...new Set(direktori.value.map(g => g.name).filter(Boolean))])
const nomorTamu = computed(() => [...new Set(direktori.value.map(g => tampilPhone(g.phone)).filter(Boolean))])

/**
 * The typed number's whole-history profile (Loyal / blacklist / member), for
 * the hint under the form. Null until enough digits are typed.
 */
const profilNomor = computed(() =>
  normPhone(form.phone).length >= 8
    ? profilTamuGabung(ringkasan.value ?? new Map(), sekitar.value ?? [], form.phone, dari.value)
    : null,
)

/** Autofill note under the name field, set by the two handlers below. */
const petunjukNama = ref('')

/** Typed NAME → the phone joins it from the directory, when the phone field is still empty. */
function isiOtomatisDariNama() {
  petunjukNama.value = ''
  if (form.phone.trim()) return
  const g = cariTamuLewatNama(direktori.value, form.name)
  if (g) {
    form.phone = tampilPhone(g.phone)
    petunjukNama.value = `Nomor HP terisi otomatis dari data tamu "${g.name}".`
  }
}

/** Typed PHONE → the name joins it from the directory, when the name field is still empty. */
function isiOtomatisDariNomor() {
  if (!form.name.trim()) {
    const g = cariTamuLewatNomor(direktori.value, form.phone)
    if (g) {
      form.name = g.name
      petunjukNama.value = `Nama terisi otomatis dari data tamu nomor ${tampilPhone(g.phone)}.`
    }
  }
}

// --- saving --------------------------------------------------------------------

const sibuk = ref(false)
const galat = ref('')
const sheetHapus = ref(false)
const sheetDPKurang = ref(false)
const kurang = ref<string[]>([])

const WAJIB: [string, string][] = [['name', 'Nama Tamu'], ['phone', 'No. HP'], ['date', 'Tanggal'], ['time', 'Jam Datang'], ['pax', 'Jumlah Pax']]

function validasi(): boolean {
  galat.value = ''
  for (const [n, label] of WAJIB) {
    const v = (form as unknown as Record<string, unknown>)[n]
    if (v === '' || v === null || v === undefined || (typeof v === 'string' && !v.trim())) {
      galat.value = `Lengkapi field wajib: ${label}`
      return false
    }
  }
  if (!normTime(form.time)) {
    galat.value = 'Jam Datang tidak valid — pakai format 24 jam, mis. 19:00'
    return false
  }
  if (!modeEdit.value && form.date < hariIni()) {
    galat.value = 'Tanggal reservasi tidak boleh sebelum hari ini'
    return false
  }
  if (!form.table) {
    galat.value = 'Meja wajib dipilih — klik meja pada denah'
    return false
  }
  return true
}

/** The deposit guard (F1, F2, F3). True when the save may go on. */
function cekDp(): boolean {
  if (form.dpStatus !== 'Sudah') return true
  const nominal = rupiahVal(form.dpAmount)
  const bolong: string[] = []
  if (!(nominal > 0)) bolong.push('nominal DP')
  if (!buktiTersimpan.value) bolong.push('bukti transfer')
  if (!bolong.length) return true

  // Both are checked in ONE place: a row missing both would otherwise ask two
  // consecutive questions about one problem, and the second is the one people
  // press through without reading.
  const dpLama = !!lama.value && lama.value.dpStatus === 'Sudah'
  if (!dpLama) {
    galat.value = `DP sudah masuk tapi ${bolong.join(' & ')} belum diisi — dua-duanya wajib`
    return false
  }
  // A booking written before the rule existed is not locked: locking it would mean
  // nobody could ever fix it, including a guest's misspelled name — and
  // completeness is exactly what is being worked towards. Asked ONCE.
  kurang.value = bolong
  sheetDPKurang.value = true
  return false
}

/** The freshest rows for the date, then the collision check on the tables we send. */
async function cekMejaServer(): Promise<Reservasi | null> {
  const { data } = await listReservations(dari.value, sampai.value)
  return conflictCheck(data, {
    date: form.date,
    table: form.table,
    time: normTime(form.time),
    exceptId: id.value || null,
    sharing: form.sharing,
    // The approval the crew just gave counts here. Without it the answer is
    // thrown away: the strict rule refuses first, and the booking could never be
    // saved however many times the button is pressed. A SEATED guest is never
    // relaxed — tanyaTumpang never allows it.
    loose: dipaksa.value.length > 0,
    dineEst: dineEst.value,
  })
}

/** The uploaded proofs, read once per save. A data URI travels inline in the body;
 *  the server moves it to the file store and leaves an `@f:` reference behind. */
interface Bukti {
  dp?: { data: string, name: string }
  doc?: { data: string, name: string }
}

const bacaBukti = (): Promise<Bukti> => Promise.all([
  buktiDpBaru.value ? jadiDataUri(buktiDpBaru.value) : Promise.resolve(undefined),
  buktiDocBaru.value ? jadiDataUri(buktiDocBaru.value) : Promise.resolve(undefined),
]).then(([dp, doc]) => ({
  dp: dp ? { data: dp, name: buktiDpBaru.value!.name } : undefined,
  doc: doc ? { data: doc, name: buktiDocBaru.value!.name } : undefined,
}))

/** Everything the form owns EXCEPT the deposit: who, when, which table, the notes. */
type FieldForm = Pick<Reservasi,
  'name' | 'phone' | 'date' | 'time' | 'pax' | 'table' | 'sharing' | 'category'
  | 'foodReq' | 'drinkReq' | 'source' | 'member' | 'memberNo' | 'notes'>

function fieldForm(): FieldForm {
  return {
    name: form.name.trim(),
    phone: normPhone(form.phone),
    date: form.date,
    time: normTime(form.time),
    pax: Number(form.pax) || 0,
    table: form.table,
    sharing: form.sharing,
    category: form.category,
    foodReq: form.foodReq,
    drinkReq: form.drinkReq,
    source: form.source,
    member: form.member === 'ya',
    memberNo: form.memberNo,
    notes: form.notes,
  }
}

/** The instalments, as a copy: the form owns instalment 0 and must never reach
 *  into the row the screen is showing. */
const salinDps = (r?: Reservasi | null): ReservasiDp[] => dpsOf(r).map(d => ({ ...d }))

/**
 * The deposit, computed exactly as the old `syncDp()` did (`:4915-4924`) but on a
 * COPY of the row. Instalment 0 is this form's; the later ones and their
 * verification state are carried over untouched.
 */
function fieldDP(asal: Reservasi | null, bukti: Bukti, now: number) {
  const kerja: Reservasi = { ...(asal ?? {} as Reservasi), dps: salinDps(asal) }
  pastikanDps(kerja)
  const dpSudah = form.dpStatus === 'Sudah'
  if (dpSudah) {
    const p0 = kerja.dps[0] ?? dpBaru(namaSaya.value, now)
    p0.amount = rupiahVal(form.dpAmount)
    p0.method = form.dpMethod
    if (bukti.dp) {
      p0.proofData = bukti.dp.data
      p0.proofName = bukti.dp.name
      resetDpScan(p0) // a new proof invalidates the old scan of it
    }
    if (!kerja.dps.length) kerja.dps.push(p0)
  }
  else if (kerja.dps.length <= 1) {
    kerja.dps = [] // the host says the money has not come in; safe, nothing was instalmented yet
  }
  syncDp(kerja)
  return {
    dpStatus: kerja.dpStatus,
    dpMethod: kerja.dpMethod,
    dpAmount: kerja.dpAmount,
    // The LUNAS mark only means something when there is a payment; "no deposit
    // yet" is never paid in full.
    lunas: dpSudah && form.lunas,
    dpProofData: bukti.dp ? bukti.dp.data : kerja.dpProofData,
    dpProofName: bukti.dp ? bukti.dp.name : kerja.dpProofName,
    dps: kerja.dps,
  }
}

/** A fresh approval, or null when this save does not carry one. */
function izinBaru(): IzinTumpang | null {
  if (!dipaksa.value.length || !terpilih.value.some(m => dipaksa.value.includes(m))) return null
  return buatIzinTumpang(terpilih.value.join(', '), form.date, normTime(form.time), null, namaSaya.value)
}

/** Only what actually changed. PATCH is a SHALLOW merge, so a field that IS sent
 *  replaces the stored one — sending the whole row back would silently undo
 *  whatever another screen wrote in between (a cashier verifying a deposit, a
 *  host checking a guest in), with no error anywhere. */
function bedakan(baru: Partial<Reservasi>, asal: Reservasi): Partial<Reservasi> {
  const keluar: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(baru)) {
    if (JSON.stringify(v) !== JSON.stringify((asal as unknown as Record<string, unknown>)[k])) keluar[k] = v
  }
  return keluar as Partial<Reservasi>
}

/** Instalment 0 is the form's; the rest of the list belongs to Dana Masuk. The
 *  whole array travels (a shallow merge cannot replace one element), so it is
 *  only sent when instalment 0 really changed — and it is built from the freshest
 *  row, never from a stale copy. */
const cicilanDepanBerubah = (baru: ReservasiDp[], asal: ReservasiDp[]) =>
  JSON.stringify(baru[0] ?? null) !== JSON.stringify(asal[0] ?? null)

/**
 * A NEW reservation: the whole row, field by field, as the old builder wrote it
 * (`:4850-4890`). Its comment is worth keeping: a field not named here is GONE
 * the moment the booking is edited once, with no error at all — the panel simply
 * stops mentioning it. That is why `tableAsli`, `tfName`, `log` and `izinTumpang`
 * are all written here, and why nothing may be added without naming it too.
 */
async function bangunRecord(now: number, recId: string, bukti: Bukti): Promise<Reservasi> {
  const sebelum = lama.value
  const dp = fieldDP(sebelum, bukti, now)
  const dpSudah = dp.dpStatus === 'Sudah'

  const rec: Reservasi = {
    id: recId,
    ...fieldForm(),
    ...dp,
    docReqData: bukti.doc?.data ?? (sebelum?.docReqData ?? ''),
    docReqName: bukti.doc?.name ?? (sebelum?.docReqName ?? ''),
    picType: picType.value,
    picName: namaSaya.value,
    vip: sebelum?.vip || false,
    status: dpSudah ? 'Confirmed' : 'Pending',
    createdBy: namaSaya.value,
    createdAt: now,
    updatedAt: now,
    actualPax: sebelum?.actualPax ?? null,
    arrivals: pendingArrivals.value || sebelum?.arrivals || [],
    checkinAt: sebelum?.checkinAt ?? null,
    tableAsli: sebelum?.tableAsli,
    datangDiasumsikan: sebelum?.datangDiasumsikan || 0,
    leftAt: sebelum?.leftAt || 0,
    followups: sebelum?.followups ?? [],
    izinTumpang: izinBaru() ?? (sebelum?.izinTumpang ?? null),
    log: [],
    cancelReason: '',
    tfDate: '',
    tfTime: '',
    tfBank: '',
    tfName: '',
    tfAmount: 0,
    tfStatus: '',
    tfNote: '',
    tfSource: '',
    tfBy: '',
    tfAt: 0,
    tfOcrAt: 0,
    tfOcrText: '',
  }

  // actualPax is DERIVED from the waves, so it is recomputed rather than copied.
  if (pendingArrivals.value) rec.actualPax = paxDatang.value
  return rec
}

/** What an EDIT sends: the form's own fields, and nothing else. */
function bidangEdit(asal: Reservasi, bukti: Bukti, now: number): Partial<Reservasi> {
  const dp = fieldDP(asal, bukti, now)
  const { dps, ...dpLain } = dp
  const kirim = bedakan({ ...fieldForm(), ...dpLain }, asal)
  if (bukti.doc) {
    kirim.docReqData = bukti.doc.data
    kirim.docReqName = bukti.doc.name
  }
  const izin = izinBaru()
  if (izin) kirim.izinTumpang = izin
  if (pendingArrivals.value) {
    kirim.arrivals = pendingArrivals.value
    kirim.actualPax = paxDatang.value
  }
  if (cicilanDepanBerubah(dps, dpsOf(asal))) kirim.dps = dps
  return kirim
}

/**
 * Reload what a write actually touched.
 *
 * `refresh()` alone is NOT enough: the row being edited lives in its own
 * `useAsyncData`, and the form is filled from it. Reloading only the list around
 * it leaves the form holding a STALE copy — and a second save would then carry
 * that stale `dps`/`tf*`/`status` back over whatever the cashier or the host
 * wrote in between, with no error anywhere. This is the same shape of incident as
 * the old "saveAll menimpa buta" (CLAUDE.md §0, 2 September 2026).
 *
 * So: reload the row itself first — which also refills the form and takes the new
 * version through the `watch(ini)` — and then the window around it. The toast
 * promises "tampilan dimuat ulang dengan versi terbaru, periksa lalu simpan
 * lagi"; this is what makes that true.
 */
async function muatUlangReservasi() {
  if (id.value) {
    await refreshIni()
  }
  await refresh()
}

async function simpan(paksaDP = false) {
  sheetDPKurang.value = false
  if (!validasi()) return
  if (!paksaDP && !cekDp()) return

  sibuk.value = true
  galat.value = ''
  const now = Date.now()
  try {
    // Re-check the table against fresh data: two devices can pick the same table.
    const bentrok = await cekMejaServer()
    if (bentrok) {
      const dipakai = tablesOf(bentrok)
      terpilih.value = terpilih.value.filter(t => !dipakai.includes(t))
      form.table = terpilih.value.join(', ')
      dipaksa.value = dipaksa.value.filter(t => !dipakai.includes(t))
      await refresh()
      galat.value = `Meja ${bentrok.table} sudah diambil ${bentrok.name} — pilih meja lain`
      return
    }

    const bukti = await bacaBukti()
    const asal = lama.value
    if (modeEdit.value && asal) {
      // PATCH, not PUT: only the fields this form owns, and only those that
      // really changed. The rest of the row (`status`, `arrivals`, `checkinAt`,
      // `leftAt`, `tf*`, `log`, `followups`, `datangDiasumsikan`) belongs to other
      // screens and is never sent from here.
      const kirim = bidangEdit(asal, bukti, now)
      await patchReservation(asal.id, kirim, versi.value)
      toast.add({ title: 'Reservasi diperbarui', color: 'success' })
    }
    else {
      const rec = await bangunRecord(now, id.value || uid(), bukti)
      await createReservation({
        ...rec,
        _audit: { action: 'Buat Reservasi', detail: `lewat ${form.source || 'input'}` },
      } as Partial<Reservasi> & { _audit: { action: string, detail: string } })
      toast.add({ title: 'Reservasi tersimpan', color: 'success' })
    }
    await router.push('/reservasi/dashboard')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangReservasi))) galat.value = apiErrorMessage(e)
  }
  finally {
    sibuk.value = false
  }
}

async function hapus() {
  if (!id.value) return
  sheetHapus.value = false
  sibuk.value = true
  try {
    await deleteReservation(id.value, versi.value)
    toast.add({ title: 'Reservasi dihapus', color: 'success' })
    await router.push('/reservasi/dashboard')
  }
  catch (e) {
    // Same reload as saving: without the new version the delete would keep
    // answering 409 for ever.
    if (!(await tanganiKonflik(e, muatUlangReservasi))) galat.value = apiErrorMessage(e)
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    :title="modeEdit ? 'Edit reservasi' : 'Input reservasi baru'"
    :description="modeEdit ? 'Perubahan langsung berlaku di denah & Dana Masuk.' : 'Isi data tamu. Field bertanda * wajib diisi. Target: selesai < 2 menit.'"
  >
    <p
      v-if="galat"
      class="mb-4 flex items-start gap-2 rounded-field border border-error/30 bg-error/10 p-3 text-sm font-semibold text-error"
      role="alert"
    >
      <UIcon
        name="i-lucide-circle-alert"
        class="mt-0.5 size-4 shrink-0"
      />{{ galat }}
    </p>

    <datalist id="nama-tamu">
      <option
        v-for="n in namaTamu"
        :key="n"
        :value="n"
      />
    </datalist>
    <datalist id="nomor-tamu">
      <option
        v-for="n in nomorTamu"
        :key="n"
        :value="n"
      />
    </datalist>
    <datalist id="opsi-jam">
      <option
        v-for="t in opsiJam(5)"
        :key="t"
        :value="t"
      />
    </datalist>

    <!-- One panel, two columns, in the old form's order (:4330-4497). -->
    <AppPanel>
      <div class="grid gap-x-4 gap-y-4 lg:grid-cols-2">
        <UFormField
          label="Nama tamu"
          required
        >
          <UInput
            v-model="form.name"
            list="nama-tamu"
            size="xl"
            class="w-full"
            placeholder="Nama pemesan / PJ"
            @input="isiOtomatisDariNama"
          />
        </UFormField>
        <UFormField
          label="No. HP / WhatsApp"
          required
          help="Boleh 08xx atau 62xx, disimpan jadi 62…"
        >
          <UInput
            v-model="form.phone"
            list="nomor-tamu"
            inputmode="numeric"
            size="xl"
            class="w-full"
            placeholder="08xxxx"
            @input="isiOtomatisDariNomor"
          />
        </UFormField>
        <UFormField
          label="Tanggal reservasi"
          required
        >
          <UInput
            v-model="form.date"
            type="date"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Jam datang"
          required
          help="Format 24 jam, mis. 19:00"
        >
          <UInput
            v-model="form.time"
            list="opsi-jam"
            icon="i-lucide-clock"
            size="xl"
            class="w-full"
            @blur="form.time = normTime(form.time) || form.time"
          />
        </UFormField>
        <UFormField
          label="Jumlah pax"
          required
        >
          <UInput
            :model-value="form.pax"
            type="number"
            :min="1"
            size="xl"
            class="w-full"
            placeholder="mis. 4"
            @update:model-value="form.pax = Number($event) || 0"
          />
        </UFormField>
        <UFormField
          label="Jenis reservasi"
          required
        >
          <USelect
            v-model="form.category"
            :items="(categories ?? []).filter(c => c).length ? (categories ?? []).filter(c => c) : ['Tamu Umum']"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Menu makanan request">
          <UInput
            v-model="form.foodReq"
            size="xl"
            class="w-full"
            placeholder="Opsional, mis. Nasi Goreng Kapal"
          />
        </UFormField>
        <UFormField label="Menu minuman request">
          <UInput
            v-model="form.drinkReq"
            size="xl"
            class="w-full"
            placeholder="Opsional"
          />
        </UFormField>

        <p
          v-if="butuhApproval"
          class="col-span-full flex items-center gap-2 rounded-field bg-warning/10 p-3 text-sm font-semibold text-warning"
        >
          <UIcon
            name="i-lucide-users"
            class="size-4"
          />{{ form.pax }} pax · butuh approval manajer.
        </p>
        <div
          v-if="paxTidakLogis"
          class="col-span-full rounded-field bg-warning/10 p-3 text-sm text-default"
        >
          Tercatat <b>{{ paxDatang }}</b> orang sudah masuk — lebih banyak dari yang dipesan
          ({{ form.pax }} pax). Angka inilah yang tampil di daftar & dashboard.
          <UButton
            class="ms-2"
            label="Samakan dengan jumlah pax"
            color="neutral"
            variant="outline"
            size="sm"
            @click="samakanDenganPax"
          />
        </div>
        <p
          v-else-if="pendingArrivals"
          class="col-span-full rounded-field bg-info/10 p-3 text-sm text-default"
        >
          Catatan kedatangan akan diperbaiki jadi <b>{{ paxDatang }} pax</b> begitu
          <b>Simpan</b> ditekan.
        </p>

        <!-- Table picker -->
        <div class="col-span-full">
          <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="text-sm font-semibold text-highlighted">
              Posisi duduk / meja <span class="text-error">*</span>
              <span class="font-normal text-muted">(wajib, klik meja pada denah)</span>
            </span>
            <AppSeg
              :model-value="layer === 2 ? 'lt2' : layoutKey"
              size="sm"
              :options="[
                { value: 'weekday', label: 'Weekday' },
                { value: 'weekend', label: 'Weekend' },
                { value: 'lt2', label: 'Lantai 2' },
              ]"
              @update:model-value="pilihDenah"
            />
            <span class="text-sm text-muted">
              {{ form.table ? `Terpilih: ${form.table}` : 'Belum ada meja dipilih' }}
            </span>
            <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-vip/30 bg-vip/10 px-3 py-1.5 text-sm font-semibold text-vip">
              <UCheckbox
                v-model="form.sharing"
                :ui="{ base: 'ring-vip' }"
              />
              <UIcon
                name="i-lucide-handshake"
                class="size-4"
              />
              Sharing table <span class="font-normal">(boleh digabung tamu lain)</span>
            </label>
          </div>
          <p
            v-if="denahTanggal"
            class="mb-2 text-sm text-muted"
          >
            Meja untuk tanggal ini digeser khusus (denah tanggal sendiri). Ubah lewat dashboard.
          </p>
          <DenahPeta
            v-if="denah"
            :layout="denah"
            :reservasi="sekitar ?? []"
            :tanggal="form.date"
            :jam="normTime(form.time)"
            mode="pilih"
            :terpilih="terpilih"
            :dipaksa="dipaksa"
            :kecuali-id="id || null"
            :master="masterKunci"
            @pilih="pilihMeja"
            @tumpang="onTumpang"
            @buka="(resId) => router.push({ path: '/reservasi/dashboard', query: { fokus: resId } })"
          />
        </div>

        <AppSectionTitle
          title="Down payment (DP)"
          icon="i-lucide-wallet"
        />
        <UFormField
          label="Status DP"
          required
        >
          <AppPilihan
            v-model="form.dpStatus"
            name="dp-status"
            :options="[
              { value: 'Sudah', label: 'Sudah DP', icon: 'i-lucide-check' },
              { value: 'Belum', label: 'Belum DP' },
            ]"
          />
          <label
            v-if="form.dpStatus === 'Sudah'"
            class="mt-2.5 flex items-center gap-2 text-sm font-semibold text-highlighted"
          >
            <UCheckbox v-model="form.lunas" />
            Lunas (bayar penuh) — kwitansi jadi pelunasan
          </label>
        </UFormField>
        <template v-if="form.dpStatus === 'Sudah'">
          <UFormField label="Metode / tujuan pembayaran">
            <USelect
              v-model="form.dpMethod"
              :items="(dpMethods ?? []).filter(c => c)"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Nominal DP"
            required
          >
            <UInput
              :model-value="fmtRupiah(rupiahVal(form.dpAmount))"
              inputmode="numeric"
              size="xl"
              class="w-full"
              placeholder="Rp. 1.000.000"
              @update:model-value="form.dpAmount = String($event).replace(/\D/g, '')"
            />
          </UFormField>
          <UFormField
            label="Upload bukti DP (foto/pdf)"
            required
          >
            <div class="space-y-2">
              <UFileUpload
                :model-value="buktiDpBaru"
                accept="image/*,application/pdf"
                label="Pilih bukti transfer"
                description="Gambar atau PDF, maks 5 MB"
                @update:model-value="(f) => pilihBukti(f, 'dp')"
              />
              <p
                v-if="buktiDpBaru"
                class="text-sm text-muted"
              >
                {{ buktiDpBaru.name }} · {{ ukuran(buktiDpBaru.size) }}
              </p>
              <div
                v-else-if="buktiTersimpan"
                class="text-sm text-muted"
              >
                Bukti sudah tersimpan
                <UButton
                  class="ms-2"
                  label="Lihat"
                  icon="i-lucide-eye"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="lihatBukti"
                />
              </div>
            </div>
          </UFormField>
        </template>

        <AppSectionTitle
          title="Detail tamu & penanganan"
          icon="i-lucide-clipboard-list"
        />
        <UFormField label="Sumber informasi (tau dari mana)">
          <USelect
            v-model="form.source"
            :items="(infoSources ?? []).filter(c => c)"
            placeholder="Tau dari mana"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="PIC penanganan"
          :help="`Otomatis diisi kru yang login: ${namaSaya}`"
        >
          <UInput
            :model-value="namaSaya"
            size="xl"
            class="w-full"
            disabled
          />
        </UFormField>
        <UFormField label="Status member">
          <AppPilihan
            v-model="form.member"
            name="member"
            :options="[
              { value: 'ya', label: 'Ya' },
              { value: 'tidak', label: 'Tidak' },
            ]"
          />
        </UFormField>
        <UFormField
          v-if="form.member === 'ya'"
          label="No. member"
        >
          <UInput
            v-model="form.memberNo"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div
          v-else
          class="hidden lg:block"
        />
        <div
          v-if="profilNomor && profilNomor.totalBaris > 0"
          class="col-span-full flex items-start gap-2 rounded-field bg-info/10 p-3 text-sm text-default"
        >
          <UIcon
            name="i-lucide-user-round"
            class="mt-0.5 size-4 shrink-0"
          />
          <div class="min-w-0">
            <p>
              Tamu dikenal: <b>{{ profilNomor.nama || form.name }}</b>
              <AppStatus
                :color="profilNomor.blacklist ? 'error' : profilNomor.vip ? 'vip' : profilNomor.tipe === 'Baru' ? 'info' : 'gold'"
                size="sm"
                :icon="profilNomor.blacklist ? 'i-lucide-shield-alert' : profilNomor.vip ? 'i-lucide-crown' : profilNomor.tipe === 'Loyal' ? 'i-lucide-star' : 'i-lucide-repeat'"
                class="ms-1.5"
              >
                {{ profilNomor.blacklist ? 'Blacklist' : profilNomor.vip ? 'VIP' : profilNomor.tipe }}
              </AppStatus>
            </p>
            <p class="mt-0.5 text-muted">
              {{ profilNomor.kunjungan }}× kunjungan<span v-if="profilNomor.kunjunganTerakhir">, terakhir {{ tglPendek(profilNomor.kunjunganTerakhir) }}</span><span v-if="profilNomor.member"> · member {{ profilNomor.memberNo }}</span><span v-if="profilNomor.blacklist"> · {{ profilNomor.noShow }}× no-show, disarankan wajib DP</span>
            </p>
          </div>
        </div>
        <p
          v-else-if="profilNomor"
          class="col-span-full flex items-center gap-1.5 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="size-4"
          />Nomor baru, tamu pertama kali.
        </p>
        <p
          v-if="petunjukNama"
          class="col-span-full flex items-center gap-1.5 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-history"
            class="size-4"
          />{{ petunjukNama }}
        </p>
        <UFormField
          label="Upload dokumen special request (opsional)"
          class="col-span-full"
        >
          <UFileUpload
            :model-value="buktiDocBaru"
            accept="image/*,application/pdf"
            label="Pilih dokumen"
            description="Gambar atau PDF, maks 5 MB"
            layout="list"
            @update:model-value="(f) => pilihBukti(f, 'doc')"
          />
        </UFormField>
        <UFormField
          label="Catatan khusus / special notes"
          class="col-span-full"
        >
          <UTextarea
            v-model="form.notes"
            class="w-full"
            :rows="3"
            placeholder="mis. alergi seafood, kursi bayi, dekorasi ulang tahun…"
          />
        </UFormField>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-2 border-t border-default pt-4">
        <UButton
          :label="modeEdit ? 'Simpan perubahan' : 'Simpan reservasi'"
          icon="i-lucide-save"
          size="xl"
          :loading="sibuk"
          @click="simpan()"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          size="xl"
          to="/reservasi/dashboard"
        />
        <div class="flex-1" />
        <UButton
          v-if="modeEdit && bolehHapus"
          label="Hapus reservasi"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          size="xl"
          @click="sheetHapus = true"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetTumpang"
      title="Meja sudah dipesan"
      description="Persetujuan ini tercatat atas namamu dan hanya berlaku untuk meja, tanggal & jam ini."
    >
      <p class="text-sm whitespace-pre-line text-default">
        {{ tanyaTumpang?.pesan }}
      </p>
      <template #footer>
        <UButton
          label="Tetap pakai meja"
          size="xl"
          @click="izinkanTumpang"
        />
        <UButton
          label="Pilih meja lain"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetTumpang = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetDPKurang"
      title="DP belum lengkap"
      :description="`Reservasi ini punya DP tanpa ${kurang.join(' & ')} — dicatat sebelum keduanya diwajibkan.`"
    >
      <p class="text-sm text-default">
        Sebaiknya dilengkapi sekarang selagi formulirnya terbuka. Simpan apa adanya?
      </p>
      <template #footer>
        <UButton
          label="Simpan apa adanya"
          size="xl"
          @click="simpan(true)"
        />
        <UButton
          label="Lengkapi dulu"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetDPKurang = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus reservasi ini?"
      :description="lama ? `${lama.name} — ${lama.date} ${lama.time}. Berkas bukti ikut terhapus.` : ''"
    >
      <p class="text-sm text-default">
        Meja kembali kosong untuk tanggal itu. Tindakan ini tidak bisa dibatalkan.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetHapus = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
