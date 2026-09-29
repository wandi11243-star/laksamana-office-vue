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
  updateReservation, useDaftarReservasi, useDenah, useSection,
} from '~/composables/useReservasi'
import type { LayoutDenah } from '~/utils/venue-layouts'
import { dayTypeLayoutLt, getLayout, parseKeyTanggal } from '~/utils/venue-layouts'
import { buatIzinTumpang, conflictCheck, tablesOf } from '~/utils/kunci-meja'
import { adaBuktiDp, dpBaru, dpMetodeBawaan, normPhone, pastikanDps, resetDpScan, syncDp, uid } from '~/utils/dp-reservasi'
import { fmtRupiah, hariIni, normTime, opsiJam, rupiahVal, tambahHari } from '~/utils/format'
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

// --- the rows around the date, and the row being edited ---------------------

const dari = computed(() => tambahHari(form.date, -1))
const sampai = computed(() => tambahHari(form.date, 1))
const { data: sekitar, refresh } = useDaftarReservasi(dari, sampai, 'reservasi-input')

const { data: ini } = useAsyncData(`reservasi-satu-${id.value}`, () => (id.value ? getReservation(id.value) : Promise.resolve(null)))

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

const dariInput = (e: Event) => (e.target as HTMLInputElement).files?.[0]

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

/** The guest directory from the loaded window — what the datalist offers, as in the windowed old client. */
const namaTamu = computed(() => [...new Set((sekitar.value ?? []).map(r => r.name).filter(Boolean))])
const nomorTamu = computed(() => [...new Set((sekitar.value ?? []).map(r => r.phone).filter(Boolean))])

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

/**
 * The record, field by field, exactly as the old builder (`:4850-4890`).
 * Its comment is worth keeping: a field not named here is GONE the moment the
 * booking is edited once, with no error at all — the panel simply stops
 * mentioning it. That is why `tableAsli`, `tfName`, `log` and `izinTumpang` are
 * all copied, and why nothing may be added without naming it here too.
 */
async function bangunRecord(now: number, recId: string): Promise<Reservasi> {
  const sebelum = lama.value
  const dpSudah = form.dpStatus === 'Sudah'
  const dataBuktiDp = buktiDpBaru.value ? await jadiDataUri(buktiDpBaru.value) : (sebelum?.dpProofData || '')
  const namaBuktiDp = buktiDpBaru.value ? buktiDpBaru.value.name : (sebelum?.dpProofName || '')
  const dataBuktiDoc = buktiDocBaru.value ? await jadiDataUri(buktiDocBaru.value) : (sebelum?.docReqData || '')
  const namaBuktiDoc = buktiDocBaru.value ? buktiDocBaru.value.name : (sebelum?.docReqName || '')

  const izin = (dipaksa.value.length && terpilih.value.some(m => dipaksa.value.includes(m)))
    ? buatIzinTumpang(terpilih.value.join(', '), form.date, normTime(form.time), null, namaSaya.value)
    : (sebelum?.izinTumpang ?? null)

  const rec: Reservasi = {
    id: recId,
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
    dpStatus: dpSudah ? 'Sudah' : 'Belum',
    dpMethod: dpSudah ? form.dpMethod : '',
    dpAmount: dpSudah ? rupiahVal(form.dpAmount) : 0,
    // The LUNAS mark only means something when there is a payment; "no deposit
    // yet" is never paid in full.
    lunas: dpSudah && form.lunas,
    dpProofData: dataBuktiDp,
    dpProofName: namaBuktiDp,
    dps: sebelum?.dps ?? [],
    docReqData: dataBuktiDoc,
    docReqName: namaBuktiDoc,
    source: form.source,
    picType: picType.value,
    picName: namaSaya.value,
    member: form.member === 'ya',
    memberNo: form.memberNo,
    notes: form.notes,
    vip: sebelum?.vip || false,
    status: sebelum ? sebelum.status : (dpSudah ? 'Confirmed' : 'Pending'),
    createdBy: sebelum ? sebelum.createdBy : namaSaya.value,
    createdAt: sebelum ? sebelum.createdAt : now,
    updatedAt: now,
    actualPax: sebelum?.actualPax ?? null,
    arrivals: pendingArrivals.value || sebelum?.arrivals || [],
    checkinAt: sebelum?.checkinAt ?? null,
    tableAsli: sebelum?.tableAsli,
    datangDiasumsikan: sebelum?.datangDiasumsikan || 0,
    leftAt: sebelum?.leftAt || 0,
    followups: sebelum?.followups ?? [],
    izinTumpang: izin,
    log: sebelum?.log ?? [],
    cancelReason: sebelum?.cancelReason || '',
    tfDate: sebelum?.tfDate ?? '',
    tfTime: sebelum?.tfTime ?? '',
    tfBank: sebelum?.tfBank ?? '',
    tfName: sebelum?.tfName ?? '',
    tfAmount: sebelum?.tfAmount ?? 0,
    tfStatus: sebelum?.tfStatus ?? '',
    tfNote: sebelum?.tfNote ?? '',
    tfSource: sebelum?.tfSource ?? '',
    tfBy: sebelum?.tfBy ?? '',
    tfAt: sebelum?.tfAt ?? 0,
    tfOcrAt: sebelum?.tfOcrAt ?? 0,
    tfOcrText: sebelum?.tfOcrText ?? '',
  }

  // actualPax is DERIVED from the waves, so it is recomputed rather than copied.
  if (pendingArrivals.value) rec.actualPax = paxDatang.value

  // The deposit in this form is the FIRST instalment. Later ones are added from
  // Dana Masuk, and are NOT overwritten here.
  pastikanDps(rec)
  if (dpSudah) {
    const p0 = rec.dps[0] ?? dpBaru(namaSaya.value, now)
    p0.amount = rupiahVal(form.dpAmount)
    p0.method = form.dpMethod
    if (buktiDpBaru.value) {
      p0.proofData = dataBuktiDp
      p0.proofName = namaBuktiDp
      resetDpScan(p0) // a new proof invalidates the old scan of it
    }
    if (!rec.dps.length) rec.dps.push(p0)
  }
  else if (rec.dps.length <= 1) {
    rec.dps = [] // the host says the money has not come in; safe, nothing was instalmented yet
  }
  syncDp(rec)
  return rec
}

async function simpan(paksaDP = false) {
  sheetDPKurang.value = false
  if (!validasi()) return
  if (!paksaDP && !cekDp()) return

  sibuk.value = true
  galat.value = ''
  const recId = id.value || uid()
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

    const rec = await bangunRecord(Date.now(), recId)
    if (modeEdit.value) {
      await updateReservation(rec.id, rec, versi.value)
      toast.add({ title: 'Reservasi diperbarui', color: 'success' })
    }
    else {
      await createReservation({ ...rec, _audit: { action: 'Buat Reservasi', detail: `lewat ${form.source || 'input'}` } })
      toast.add({ title: 'Reservasi tersimpan', color: 'success' })
    }
    await router.push('/reservasi/dashboard')
  }
  catch (e) {
    // The reload re-reads the saved row, so a retry carries its real version.
    const muatUlang = async () => {
      await refresh()
      if (id.value) {
        const { data } = await getReservation(id.value)
        versi.value = data.updatedAt
      }
    }
    if (!(await tanganiKonflik(e, muatUlang))) galat.value = apiErrorMessage(e)
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
    if (!(await tanganiKonflik(e, refresh))) galat.value = apiErrorMessage(e)
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    :title="modeEdit ? 'Edit reservasi' : 'Input reservasi'"
    :description="modeEdit ? 'Perubahan langsung berlaku di denah & Dana Masuk' : 'Isi data tamu. Field bertanda * wajib diisi.'"
    :back="{ label: 'Batal', to: '/reservasi/dashboard' }"
  >
    <p
      v-if="galat"
      class="mb-4 rounded-xl bg-default p-3 text-error"
      role="alert"
    >
      {{ galat }}
    </p>

    <AppList title="Tamu">
      <div class="grid gap-4 p-4 sm:grid-cols-2">
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
        <UFormField
          label="Nama tamu"
          required
        >
          <UInput
            v-model="form.name"
            list="nama-tamu"
            size="xl"
            class="w-full"
            placeholder="Nama tamu"
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
            placeholder="08xxxxxxxxxx"
          />
        </UFormField>
        <UFormField
          label="Jenis reservasi"
          required
        >
          <USelect
            v-model="form.category"
            :items="categories?.length ? categories : ['Tamu Umum']"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Sumber informasi">
          <USelect
            v-model="form.source"
            :items="infoSources ?? []"
            placeholder="Tau dari mana"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Menu makanan request">
          <UInput
            v-model="form.foodReq"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Menu minuman request">
          <UInput
            v-model="form.drinkReq"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status member">
          <div class="flex gap-4 pt-2">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="form.member"
                type="radio"
                value="tidak"
              > Tidak
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="form.member"
                type="radio"
                value="ya"
              > Member
            </label>
          </div>
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
      </div>

      <div class="px-4 pb-4 text-sm text-dimmed">
        <UIcon
          name="i-lucide-user-search"
          class="mr-1 inline size-4 align-text-bottom"
        />Profil tamu (loyal, daftar hitam, riwayat kunjungan) — Segera, butuh endpoint
        ringkasan tamu. <span class="text-dimmed">G-07</span>
      </div>
    </AppList>

    <AppList title="Kapan & berapa orang">
      <div class="grid gap-4 p-4 sm:grid-cols-2">
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
          help="24 jam, mis. 19:00"
        >
          <UInput
            v-model="form.time"
            list="opsi-jam"
            size="xl"
            class="w-full"
            @blur="form.time = normTime(form.time) || form.time"
          />
        </UFormField>
        <datalist id="opsi-jam">
          <option
            v-for="t in opsiJam(5)"
            :key="t"
            :value="t"
          />
        </datalist>
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
            @update:model-value="form.pax = Number($event) || 0"
          />
        </UFormField>
      </div>
      <p
        v-if="butuhApproval"
        class="mx-4 mb-4 rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-users"
          class="mr-1 inline size-4 align-text-bottom"
        />{{ form.pax }} pax · butuh approval manajer.
      </p>
      <p
        v-if="paxTidakLogis"
        class="mx-4 mb-4 rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        Tercatat <b>{{ paxDatang }}</b> orang sudah masuk — lebih banyak dari yang dipesan
        ({{ form.pax }} pax). Angka inilah yang tampil di daftar & dashboard.
        <UButton
          class="mt-2"
          label="Samakan dengan jumlah pax"
          color="neutral"
          variant="soft"
          size="sm"
          @click="samakanDenganPax"
        />
      </p>
      <p
        v-else-if="pendingArrivals"
        class="mx-4 mb-4 rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        Catatan kedatangan akan diperbaiki jadi <b>{{ paxDatang }} pax</b> begitu
        <b>Simpan</b> ditekan.
      </p>
    </AppList>

    <AppList title="Meja">
      <template #action>
        <span class="text-sm font-semibold text-muted">
          {{ form.table ? `Terpilih: ${form.table}` : 'Belum ada meja dipilih' }}
        </span>
      </template>
      <div class="space-y-3 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            label="Weekday"
            color="neutral"
            :variant="layoutKey === 'weekday' ? 'soft' : 'ghost'"
            @click="layoutKey = 'weekday'"
          />
          <UButton
            label="Weekend"
            color="neutral"
            :variant="layoutKey === 'weekend' ? 'soft' : 'ghost'"
            @click="layoutKey = 'weekend'"
          />
          <UButton
            label="Lantai 2"
            color="neutral"
            :variant="layer === 2 ? 'soft' : 'ghost'"
            @click="setLayer(2)"
          />
          <UButton
            v-if="layer === 2"
            label="Lantai 1"
            color="neutral"
            variant="ghost"
            @click="setLayer(1)"
          />
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="form.sharing"
              type="checkbox"
            > Sharing table
          </label>
        </div>
        <p
          v-if="denahTanggal"
          class="text-sm text-muted"
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
    </AppList>

    <AppList title="Down payment (DP)">
      <div class="grid gap-4 p-4 sm:grid-cols-2">
        <UFormField
          label="Status DP"
          required
        >
          <div class="flex gap-4 pt-2">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="form.dpStatus"
                type="radio"
                value="Sudah"
              > Sudah DP
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="form.dpStatus"
                type="radio"
                value="Belum"
              > Belum DP
            </label>
          </div>
        </UFormField>
        <UFormField label="Jenis pembayaran">
          <USelect
            v-model="form.dpMethod"
            :items="dpMethods ?? []"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nominal DP">
          <UInput
            :model-value="fmtRupiah(rupiahVal(form.dpAmount))"
            inputmode="numeric"
            size="xl"
            class="w-full"
            placeholder="Rp. 1.000.000"
            @update:model-value="form.dpAmount = String($event).replace(/\D/g, '')"
          />
        </UFormField>
        <UFormField label="Bukti transfer DP">
          <div class="space-y-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              class="block w-full text-sm"
              @change="pilihBukti(dariInput($event), 'dp')"
            >
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
                class="ml-2"
                label="Lihat"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="lihatBukti"
              />
            </div>
            <p
              v-else
              class="text-sm text-dimmed"
            >
              Belum ada bukti
            </p>
          </div>
        </UFormField>
        <UFormField label="Dokumen special request">
          <div class="space-y-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              class="block w-full text-sm"
              @change="pilihBukti(dariInput($event), 'doc')"
            >
            <p
              v-if="buktiDocBaru"
              class="text-sm text-muted"
            >
              {{ buktiDocBaru.name }} · {{ ukuran(buktiDocBaru.size) }}
            </p>
          </div>
        </UFormField>
      </div>
      <label
        v-if="form.dpStatus === 'Sudah'"
        class="mx-4 mb-4 flex items-center gap-2 text-sm"
      >
        <input
          v-model="form.lunas"
          type="checkbox"
        > Lunas (bayar penuh)
      </label>
    </AppList>

    <AppList title="Catatan">
      <div class="p-4">
        <UTextarea
          v-model="form.notes"
          class="w-full"
          :rows="3"
          placeholder="Catatan khusus untuk kru"
        />
      </div>
    </AppList>

    <div class="flex flex-wrap gap-2">
      <UButton
        :label="modeEdit ? 'Simpan perubahan' : 'Simpan reservasi'"
        size="xl"
        :loading="sibuk"
        @click="simpan()"
      />
      <UButton
        v-if="modeEdit && bolehHapus"
        label="Hapus reservasi"
        color="error"
        variant="soft"
        size="xl"
        @click="sheetHapus = true"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="soft"
        size="xl"
        to="/reservasi/dashboard"
      />
    </div>

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
