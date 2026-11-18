<!--
  Fee & Pembayaran Talent — recap of Done shows × per-row fee, bill generation
  and payment verification (`event/index.html:4044-4403`).

  Fee is per show day, stored per schedule row (F.15). Period key follows the
  old rule (F.16): 'YYYY-MM' for monthly, else 'YYYY-MM-DD..YYYY-MM-DD'.
  Transfer-proof OCR (Tesseract.js, K-05) is not wired yet — verification is
  manual (Set Paid / Reject); the automatic re-check button shows "Segera".
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { JadwalTalent, TagihanTalent, Talent } from '~/composables/useEvent'
import { createEvent, fileEventUrl, patchEvent, uploadFileEvent, useDaftarEvent } from '~/composables/useEvent'
import { feeAngka } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, hariIni, rupiah, tambahHari, tglPendek } from '~/utils/format'
import { ocrBaca } from '~/utils/ocr'
import { parseTeksTransfer, type HasilParseTransfer } from '~/utils/ocr-transfer'
import { BAYAR_IKON, BAYAR_WARNA } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('fee', peranEvent(me.value)))

type Mode = 'minggu' | 'bulan' | 'rentang'
const mode = ref<Mode>('bulan')
const MODES = [
  { value: 'minggu', label: 'Mingguan' },
  { value: 'bulan', label: 'Bulanan' },
  { value: 'rentang', label: 'Rentang' },
] as { value: Mode, label: string }[]

// --- period (`feeRentang :3876`, `feeKunci :3901`) ---
function seninDari(tgl: string) {
  const d = new Date(`${tgl}T00:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const acuan = ref(hariIni())
const rentangDari = ref(hariIni())
const rentangSampai = ref(hariIni())

const periode = computed(() => {
  if (mode.value === 'bulan') {
    const ym = acuan.value.slice(0, 7)
    const [y, m] = ym.split('-').map(Number)
    return { dari: `${ym}-01`, sampai: `${ym}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`, kunci: ym, label: new Date(`${ym}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }
  }
  if (mode.value === 'rentang') {
    return { dari: rentangDari.value, sampai: rentangSampai.value, kunci: `${rentangDari.value}..${rentangSampai.value}`, label: `${tglPendek(rentangDari.value)} – ${tglPendek(rentangSampai.value)}` }
  }
  const s = seninDari(acuan.value)
  return { dari: s, sampai: tambahHari(s, 6), kunci: `${s}..${tambahHari(s, 6)}`, label: `${tglPendek(s)} – ${tglPendek(tambahHari(s, 6))}` }
})
function geser(n: number) {
  if (mode.value === 'bulan') {
    const [y, m] = acuan.value.slice(0, 7).split('-').map(Number)
    const d = new Date(y!, m! - 1 + n, 1)
    acuan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }
  else if (mode.value === 'rentang') {
    // Shift by the range's own length, so ‹ › walk whole periods.
    const lama = Math.max(1, Math.round((Date.parse(`${rentangSampai.value}T00:00:00`) - Date.parse(`${rentangDari.value}T00:00:00`)) / 86400000) + 1)
    rentangDari.value = tambahHari(rentangDari.value, n * lama)
    rentangSampai.value = tambahHari(rentangSampai.value, n * lama)
  }
  else {
    acuan.value = tambahHari(acuan.value, n * 7)
  }
}

const qJadwal = computed<Record<string, string>>(() => ({ from: periode.value.dari, to: periode.value.sampai }))
const { data: daftarJadwal, status } = useDaftarEvent<JadwalTalent>('schedules', qJadwal, 'event-fee-sched')
const { data: daftarTalent } = useDaftarEvent<Talent>('talents', {}, 'event-fee-talents')
const { data: daftarTagihan, refresh: refreshTagihan } = useDaftarEvent<TagihanTalent>('talent-payments', {}, 'event-fee-bills')

const namaTalent = (id: string) => daftarTalent.value.rows.find(t => t.id === id)?.name ?? '—'
const bankTalentNama = (id: string) => String(daftarTalent.value.rows.find(t => t.id === id)?.bank_name ?? '')
const bankTalentNo = (id: string) => String(daftarTalent.value.rows.find(t => t.id === id)?.bank_account ?? '')
const katTalent = (id: string) => String(daftarTalent.value.rows.find(t => t.id === id)?.category ?? '')
/** renderFee bank cell: "BCA · 1234567890" */
const bankBaris = (id: string) => [bankTalentNama(id) || '—', bankTalentNo(id)].filter(Boolean).join(' · ')
/** Done shows with no fee in a talent's row (they pay out Rp0) */
const tanpaFeeTalent = (id: string) => daftarJadwal.value.rows.filter(j => j.talent_id === id && j.status === 'Done'
  && j.date >= periode.value.dari && j.date <= periode.value.sampai && !feeAngka(j.fee)).length
// the Bayar sheet carries Set Paid / Reject like `payAction` (:4255): save first, then decide
async function setLunasDariForm() {
  const tid = bayarUntuk.value?.talent_id
  await simpanBayar()
  const r = rekap.value.find(x => x.talent_id === tid)
  if (r) await setLunas(r)
}
async function tolakDariForm() {
  const r = bayarUntuk.value
  if (!r) return
  sheetBayar.value = false
  await tolak(r)
}
const bankTalent = (id: string) => {
  const t = daftarTalent.value.rows.find(t => t.id === id)
  return [t?.bank_name, t?.bank_account].filter(Boolean).join(' ') || '—'
}

// --- recap: Σ fee of Done schedules per talent (`:4045`) ---
// Active talents with no show stay listed dimmed; an Inactive talent with
// shows still counts — fee already earned does not vanish with the status.
interface BarisFee { talent_id: string, hari: number, fee: number, tagihan: TagihanTalent | null }
const rekap = computed<BarisFee[]>(() => {
  const m = new Map<string, BarisFee>()
  for (const j of daftarJadwal.value.rows) {
    if (j.status !== 'Done') continue
    if (j.date < periode.value.dari || j.date > periode.value.sampai) continue
    const b = m.get(j.talent_id) ?? { talent_id: j.talent_id, hari: 0, fee: 0, tagihan: null }
    b.hari += 1
    b.fee += feeAngka(j.fee)
    m.set(j.talent_id, b)
  }
  for (const t of daftarTalent.value.rows) {
    if (t.status === 'Active' && !m.has(t.id)) m.set(t.id, { talent_id: t.id, hari: 0, fee: 0, tagihan: null })
  }
  for (const b of m.values()) {
    b.tagihan = daftarTagihan.value.rows.find(p => p.talent_id === b.talent_id && p.period_month === periode.value.kunci) ?? null
  }
  return [...m.values()].sort((a, b) => (b.hari - a.hari) || (b.fee - a.fee) || namaTalent(a.talent_id).localeCompare(namaTalent(b.talent_id)))
})
const totalHari = computed(() => rekap.value.reduce((a, b) => a + b.hari, 0))
const totalFee = computed(() => rekap.value.reduce((a, b) => a + b.fee, 0))
/** Done shows in the period with no fee written — they would pay out Rp0. */
const tanpaFeeN = computed(() => daftarJadwal.value.rows.filter(j =>
  j.status === 'Done' && j.date >= periode.value.dari && j.date <= periode.value.sampai && !feeAngka(j.fee)).length)

const kolom: TableColumn<BarisFee>[] = [
  { id: 'talent', header: 'Talent' },
  { id: 'bank', header: 'Bank' },
  { id: 'hari', header: 'Hari tampil' },
  { id: 'fee', header: 'Total fee' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: 'Aksi' },
]

// --- generate payment (`genPayment :4097`): recap first, then `Proses Pembayaran` ---
const genBuka = ref<BarisFee | null>(null)
const sheetGen = computed({ get: () => genBuka.value !== null, set: (v: boolean) => {
  if (!v) genBuka.value = null
} })
const genTanpaFee = computed(() => (genBuka.value
  ? daftarJadwal.value.rows.filter(j => j.talent_id === genBuka.value!.talent_id && j.status === 'Done'
    && j.date >= periode.value.dari && j.date <= periode.value.sampai && !feeAngka(j.fee)).length
  : 0))
const genRekening = computed(() => (genBuka.value ? bankTalent(genBuka.value.talent_id) : '—'))
function generate(b: BarisFee) {
  if (b.tagihan) return
  genBuka.value = b
}
async function prosesGenerate() {
  const b = genBuka.value
  if (!b || b.tagihan) return
  genBuka.value = null
  try {
    // recounted here from the schedule itself — the stored total is what gets transferred
    const shows = daftarJadwal.value.rows.filter(j => j.talent_id === b.talent_id && j.status === 'Done'
      && j.date >= periode.value.dari && j.date <= periode.value.sampai)
    await createEvent('talent-payments', {
      talent_id: b.talent_id,
      period_month: periode.value.kunci,
      show_count: shows.length,
      total_amount: shows.reduce((a, j) => a + feeAngka(j.fee), 0),
      status: 'Waiting',
      bank: '',
      transfer_proof: null,
      pic_finance: '',
      paid_at: null,
      created_at: new Date().toISOString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    toast.add({ title: `Tagihan ${namaTalent(b.talent_id)} dibuat`, color: 'success' })
    await refreshTagihan()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTagihan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- payment form (`:4131`): bank tujuan, bukti transfer, nominal, PIC finance ---
const sheetBayar = ref(false)
const bayarUntuk = ref<BarisFee | null>(null)
const bayar = ref({ bank: '', nominal: 0, pic: '' })
const berkasBukti = ref<File | null>(null)
const inputBukti = ref<HTMLInputElement | null>(null)
const membayar = ref(false)
/** Machine reading of the proof: suggestions only, never filled in by itself. */
const saran = ref<HasilParseTransfer | null>(null)
const memindai = ref(false)
const urlPilih = ref('')

function bukaBayar(b: BarisFee) {
  bayarUntuk.value = b
  const p = b.tagihan
  bayar.value = {
    bank: String(p?.bank || [bankTalentNama(b.talent_id), bankTalentNo(b.talent_id)].filter(Boolean).join(' - ')),
    nominal: Number(p?.proof_amount) || 0,
    pic: String(p?.pic_finance || 'Finance'),
  }
  berkasBukti.value = null
  saran.value = null
  sheetBayar.value = true
}
watch(berkasBukti, (f) => {
  if (urlPilih.value) URL.revokeObjectURL(urlPilih.value)
  urlPilih.value = f && f.type.startsWith('image/') ? URL.createObjectURL(f) : ''
  saran.value = null
})
const bacaBerkasUrl = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})
async function pindaiBukti() {
  const f = berkasBukti.value
  if (!f || memindai.value) return
  if (!f.type.startsWith('image/')) {
    toast.add({ title: 'Hanya gambar yang bisa dipindai — PDF dibaca manual.', color: 'error' })
    return
  }
  memindai.value = true
  try {
    const teks = await ocrBaca(await bacaBerkasUrl(f))
    const hasil = parseTeksTransfer(teks)
    saran.value = hasil
    if (!hasil.amount && !hasil.bank && !hasil.name) {
      toast.add({ title: 'Mesin tidak menemukan angka — isi manual.', color: 'warning' })
    }
  }
  catch {
    toast.add({ title: 'Gagal memindai — butuh internet untuk memuat mesin.', color: 'error' })
  }
  finally {
    memindai.value = false
  }
}
async function simpanBayar() {
  const b = bayarUntuk.value
  const ada = b?.tagihan
  // a payment always belongs to a generated bill (payAction only opens from one)
  if (!b || !ada) return
  try {
    membayar.value = true
    const body: Record<string, unknown> = {
      bank: bayar.value.bank,
      pic_finance: bayar.value.pic,
      proof_amount: Number(bayar.value.nominal) || 0,
      updatedAt: Date.now(),
    }
    if (berkasBukti.value) {
      const f = berkasBukti.value
      const buf = await f.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
      const up = await uploadFileEvent({ dataBase64: btoa(bin), fileName: f.name, mimeType: f.type || 'application/octet-stream' })
      // transfer_proof is a file object {key,name,size,type}; the old check result goes with the old proof
      body.transfer_proof = { key: up.data.key, name: f.name, size: f.size, type: f.type }
      Object.assign(body, { proof_bank: '', proof_skor: 0, proof_bukti: false, proof_ocr_at: '' })
    }
    await patchEvent('talent-payments', ada.id, body, daftarTagihan.value.versions[ada.id])
    sheetBayar.value = false
    toast.add({ title: 'Pembayaran dicatat — menunggu verifikasi', color: 'success' })
    await refreshTagihan()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTagihan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    membayar.value = false
  }
}

async function setLunas(b: BarisFee) {
  const p = b.tagihan
  if (!p) return
  if (!p.transfer_proof) {
    toast.add({ title: 'Unggah bukti transfer dulu sebelum Set Paid.', color: 'error' })
    return
  }
  if (!window.confirm(`Tandai lunas ${namaTalent(b.talent_id)} ${rupiah(Number(p.total_amount) || 0)}? Tidak bisa dibatalkan.`)) return
  try {
    await patchEvent('talent-payments', p.id, { status: 'Paid', paid_at: new Date().toISOString(), updatedAt: Date.now() }, daftarTagihan.value.versions[p.id])
    toast.add({ title: 'Ditandai lunas', color: 'success' })
    await refreshTagihan()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTagihan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
async function tolak(b: BarisFee) {
  const p = b.tagihan
  if (!p) return
  if (!window.confirm(`Tolak (Reject) pembayaran ini?\n\nTalent: ${namaTalent(b.talent_id)}\nTotal: ${rupiah(Number(p.total_amount) || 0)}`)) return
  try {
    await patchEvent('talent-payments', p.id, { status: 'Rejected', updatedAt: Date.now() }, daftarTagihan.value.versions[p.id])
    toast.add({ title: 'Pembayaran ditolak', color: 'success' })
    await refreshTagihan()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTagihan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** The proof's file key — legacy rows may hold a bare file name string (no file stored). */
const buktiKey = (p?: TagihanTalent | null) => {
  const b = p?.transfer_proof
  return b && typeof b === 'object' ? String((b as { key?: string }).key ?? '') : ''
}

// --- detail history (`payHistory`) ---
const detailId = ref('')
const detail = computed(() => rekap.value.find(b => b.talent_id === detailId.value) ?? null)
const sheetDetail = computed({ get: () => detailId.value !== '', set: v => (detailId.value = v ? detailId.value : '') })
const jadwalTalent = computed(() => daftarJadwal.value.rows
  .filter(j => j.talent_id === detailId.value && j.date >= periode.value.dari && j.date <= periode.value.sampai)
  .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''))))
const feeBelum = computed(() => jadwalTalent.value.filter(j => j.status !== 'Done').reduce((a, j) => a + feeAngka(j.fee), 0))
const namaHari = (tgl: string) => new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short' })
</script>

<template>
  <EventGerbang lihat="fee">
    <AppPage
      title="Fee & pembayaran"
      description="Rekap otomatis show done × fee"
    >
      <AppPanel class="mb-4">
        <div class="flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="mode"
            :options="MODES"
          />
          <template v-if="mode === 'rentang'">
            <AppTanggal
              v-model="rentangDari"
            />
            <span class="text-muted">–</span>
            <AppTanggal
              v-model="rentangSampai"
            />
          </template>
          <template v-else>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-chevron-left"
              @click="geser(-1)"
            />
            <b class="text-highlighted">{{ periode.label }}</b>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-chevron-right"
              @click="geser(1)"
            />
          </template>
          <span class="flex flex-wrap gap-2">
            <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold num">Total hari tampil: {{ angka(totalHari) }}</span>
            <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold num">Total fee: {{ rupiah(totalFee) }}</span>
            <span
              v-if="tanpaFeeN"
              class="rounded-full bg-error/12 px-3 py-1 text-xs font-semibold text-error num"
              title="Show done yang fee-nya belum diisi — rekapnya kurang dari seharusnya"
            >{{ tanpaFeeN }} tanpa fee</span>
          </span>
        </div>
        <p class="mt-2 text-xs text-muted">
          Fee di profil talent adalah <b>fee per hari tampil</b>. Total di bawah = jumlah hari berstatus Done pada periode ini × fee hari itu. Klik nama talent untuk membuka rinciannya.
        </p>
      </AppPanel>

      <AppPanel
        title="Rekap fee"
        icon="i-lucide-banknote"
        flush
      >
        <UTable
          :columns="kolom"
          :data="rekap"
          :loading="status === 'pending'"
          :meta="{ class: { tr: (row: { original: BarisFee }) => (row.original.hari ? '' : 'opacity-60') } }"
          class="hidden lg:block"
        >
          <template #talent-cell="{ row }">
            <button
              type="button"
              class="text-left"
              title="Lihat rincian hari tampilnya"
              @click="detailId = row.original.talent_id"
            >
              <b class="block text-highlighted">{{ namaTalent(row.original.talent_id) }}</b>
              <span class="block text-xs text-muted">{{ katTalent(row.original.talent_id) }}</span>
            </button>
          </template>
          <template #bank-cell="{ row }">
            {{ bankBaris(row.original.talent_id) }}
          </template>
          <template #hari-cell="{ row }">
            <span class="num">{{ angka(row.original.hari) }} hari</span>
            <span
              v-if="tanpaFeeTalent(row.original.talent_id)"
              class="block text-xs text-error"
            >{{ tanpaFeeTalent(row.original.talent_id) }} tanpa fee</span>
          </template>
          <template #fee-cell="{ row }">
            <span class="num">{{ rupiah(row.original.fee) }}</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              v-if="row.original.tagihan"
              :color="BAYAR_WARNA[String(row.original.tagihan.status)] ?? 'neutral'"
              :icon="BAYAR_IKON[String(row.original.tagihan.status)]"
              size="sm"
            >
              {{ row.original.tagihan.status }}
            </AppStatus>
            <span
              v-else
              class="text-xs text-muted"
            >{{ row.original.hari ? 'belum di-generate' : 'tidak tampil di periode ini' }}</span>
          </template>
          <template #aksi-cell="{ row }">
            <span class="flex flex-wrap gap-1">
              <UButton
                v-if="bolehUbah && !row.original.tagihan && row.original.hari"
                color="info"
                size="sm"
                @click="generate(row.original)"
              >
                Generate payment
              </UButton>
              <span
                v-if="!row.original.tagihan && !row.original.hari"
                class="text-muted"
              >—</span>
              <UButton
                v-if="bolehUbah && row.original.tagihan && String(row.original.tagihan.status) === 'Waiting'"
                color="primary"
                variant="outline"
                size="sm"
                @click="bukaBayar(row.original)"
              >
                Bayar
              </UButton>
              <UButton
                v-if="row.original.tagihan"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="detailId = row.original.talent_id"
              >
                Detail
              </UButton>
            </span>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="b in rekap"
            :key="b.talent_id"
            class="px-4 py-3"
          >
            <b class="block text-sm text-highlighted">{{ namaTalent(b.talent_id) }}</b>
            <span class="mt-0.5 block text-xs text-muted num">{{ b.hari }} hari · {{ rupiah(b.fee) }} · {{ b.tagihan?.status ?? (b.hari ? 'belum di-generate' : 'tidak tampil di periode ini') }}</span>
            <span class="mt-1.5 flex flex-wrap gap-1.5">
              <UButton
                v-if="bolehUbah && !b.tagihan && b.hari"
                color="info"
                size="sm"
                @click="generate(b)"
              >
                Generate payment
              </UButton>
              <UButton
                v-if="bolehUbah && b.tagihan && String(b.tagihan.status) === 'Waiting'"
                color="primary"
                variant="outline"
                size="sm"
                @click="bukaBayar(b)"
              >
                Bayar
              </UButton>
              <UButton
                v-if="b.tagihan"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="detailId = b.talent_id"
              >
                Detail
              </UButton>
            </span>
          </li>
        </ul>
        <p
          v-if="!rekap.length && status !== 'pending'"
          class="px-4 py-6 text-center text-sm text-dimmed"
        >
          Belum ada show done di periode ini.
        </p>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="sheetGen"
        title="Buat tagihan pembayaran"
      >
        <div
          v-if="genBuka"
          class="space-y-2 text-sm"
        >
          <div class="flex justify-between gap-3 border-b border-default py-1.5">
            <span class="text-muted">Talent</span>
            <b class="text-highlighted">{{ namaTalent(genBuka.talent_id) }}</b>
          </div>
          <div class="flex justify-between gap-3 border-b border-default py-1.5">
            <span class="text-muted">Periode</span>
            <span>{{ periode.label }}</span>
          </div>
          <div class="flex justify-between gap-3 border-b border-default py-1.5">
            <span class="text-muted">Hari tampil</span>
            <b class="num">{{ genBuka.hari }} hari</b>
          </div>
          <div class="flex justify-between gap-3 border-b border-default py-1.5">
            <span class="text-muted">Total</span>
            <b class="text-highlighted num">{{ rupiah(genBuka.fee) }}</b>
          </div>
          <div class="flex justify-between gap-3 border-b border-default py-1.5">
            <span class="text-muted">Rekening</span>
            <span>{{ genRekening }}</span>
          </div>
          <p
            v-if="genTanpaFee"
            class="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-warning"
          >
            {{ genTanpaFee }} show belum ada fee-nya — isi dulu di Talent Schedule, kalau tidak tagihan ini kurang bayar.
          </p>
          <p
            v-if="genRekening === '—'"
            class="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-warning"
          >
            Rekening talent kosong — fee tidak bisa ditransfer. Isi di Talent Management.
          </p>
        </div>
        <template #footer>
          <UButton
            label="Nanti"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="sheetGen = false"
          />
          <UButton
            label="Proses pembayaran"
            size="xl"
            loading-auto
            @click="prosesGenerate"
          />
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetBayar"
        title="Proses pembayaran"
      >
        <div
          v-if="bayarUntuk"
          class="grid grid-cols-1 gap-3"
        >
          <p class="text-sm text-muted">
            {{ namaTalent(bayarUntuk.talent_id) }} · {{ periode.label }} · <b class="text-highlighted num">{{ rupiah(bayarUntuk.fee) }}</b>
          </p>
          <UFormField label="Bank tujuan">
            <UInput
              v-model="bayar.bank"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Nominal pada bukti">
            <UInput
              v-model.number="bayar.nominal"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="PIC finance">
            <UInput
              v-model="bayar.pic"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Bukti transfer">
            <input
              ref="inputBukti"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
              class="text-sm"
              @change="berkasBukti = ($event.target as HTMLInputElement).files?.[0] ?? null"
            >
            <img
              v-if="urlPilih"
              :src="urlPilih"
              alt="Pratinjau bukti"
              class="mt-2 max-h-48 rounded-lg border border-default"
            >
            <div
              v-if="berkasBukti"
              class="mt-2"
            >
              <UButton
                label="Scan bukti"
                icon="i-lucide-scan-line"
                color="neutral"
                variant="soft"
                size="sm"
                :loading="memindai"
                :disabled="memindai"
                @click="pindaiBukti"
              />
            </div>
            <div
              v-if="saran"
              class="mt-2 space-y-1.5 rounded-lg border border-default bg-default p-2.5 text-xs"
            >
              <p class="font-semibold text-highlighted">
                Hasil baca mesin — cek ulang, bukan isian:
              </p>
              <p
                v-if="saran.amount > 0"
                class="flex flex-wrap items-center gap-2"
              >
                <span>Nominal: <b class="num">{{ rupiah(saran.amount) }}</b></span>
                <UButton
                  label="Pakai"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="bayar.nominal = saran!.amount"
                />
                <span
                  v-if="Number(bayar.nominal) !== saran.amount"
                  class="font-semibold text-error"
                >selisih dengan isian {{ rupiah(Number(bayar.nominal) || 0) }}</span>
                <span
                  v-else
                  class="font-semibold text-success"
                >cocok dengan isian</span>
              </p>
              <p
                v-if="saran.bank"
                class="flex flex-wrap items-center gap-2"
              >
                <span>Bank: <b>{{ saran.bank }}</b></span>
                <UButton
                  label="Pakai"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="bayar.bank = saran!.bank"
                />
              </p>
              <p v-if="saran.name">
                Nama pengirim: <b>{{ saran.name }}</b>
              </p>
              <p
                v-if="!saran.amount && !saran.bank && !saran.name"
                class="text-muted"
              >
                Tidak ada yang terbaca.
              </p>
            </div>
            <a
              v-if="buktiKey(bayarUntuk?.tagihan)"
              :href="fileEventUrl(buktiKey(bayarUntuk?.tagihan))"
              target="_blank"
              rel="noopener"
              class="mt-2 inline-block text-xs font-semibold text-primary-700 underline"
            >Lihat bukti tersimpan</a>
          </UFormField>
        </div>
        <template #footer>
          <UButton
            color="primary"
            :loading="membayar"
            @click="setLunasDariForm()"
          >
            Set paid
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :loading="membayar"
            @click="simpanBayar()"
          >
            Simpan dulu
          </UButton>
          <UButton
            color="error"
            variant="outline"
            loading-auto
            @click="tolakDariForm()"
          >
            Reject
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetBayar = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetDetail"
        :title="detail ? `Riwayat ${namaTalent(detail.talent_id)}` : 'Riwayat'"
      >
        <div
          v-if="detail"
          class="grid grid-cols-2 gap-2 text-sm"
        >
          <div class="rounded-panel border border-default p-2.5">
            <p class="text-xs text-muted">
              Hari tampil
            </p>
            <b class="num">{{ detail.hari }}</b>
          </div>
          <div class="rounded-panel border border-default p-2.5">
            <p class="text-xs text-muted">
              Total (rata-rata/hari)
            </p>
            <b class="num">{{ rupiah(detail.fee) }}</b>
            <p class="text-xs text-muted num">
              {{ detail.hari ? rupiah(Math.round(detail.fee / detail.hari)) : rupiah(0) }}/hari
            </p>
          </div>
          <div class="rounded-panel border border-default p-2.5">
            <p class="text-xs text-muted">
              Belum (tidak done)
            </p>
            <b class="num">{{ rupiah(feeBelum) }}</b>
          </div>
          <div class="rounded-panel border border-default p-2.5">
            <p class="text-xs text-muted">
              Status tagihan
            </p>
            <b>{{ detail.tagihan?.status ?? 'Belum ditagih' }}</b>
          </div>
        </div>
        <div
          v-if="detail?.tagihan"
          class="mt-3 space-y-1.5 rounded-panel border border-default p-3 text-sm"
        >
          <div class="flex justify-between gap-3">
            <span class="text-muted">Nominal tagihan</span>
            <b class="num">{{ rupiah(Number(detail.tagihan.total_amount) || 0) }}</b>
          </div>
          <div
            v-if="detail.tagihan.bank"
            class="flex justify-between gap-3"
          >
            <span class="text-muted">Bank tujuan</span>
            <span>{{ detail.tagihan.bank }}</span>
          </div>
          <div
            v-if="detail.tagihan.pic_finance"
            class="flex justify-between gap-3"
          >
            <span class="text-muted">PIC finance</span>
            <span>{{ detail.tagihan.pic_finance }}</span>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <a
              v-if="buktiKey(detail.tagihan)"
              :href="fileEventUrl(buktiKey(detail.tagihan))"
              target="_blank"
              rel="noopener"
              class="text-xs font-semibold text-primary-700 underline"
            >Lihat bukti transfer</a>
            <UButton
              v-if="bolehUbah && String(detail.tagihan.status) === 'Waiting'"
              label="Bayar / proses"
              color="primary"
              variant="outline"
              size="sm"
              @click="sheetDetail = false; bukaBayar(detail)"
            />
          </div>
        </div>
        <ul
          v-if="detail"
          class="mt-3 divide-y divide-default"
        >
          <li
            v-for="j in jadwalTalent"
            :key="j.id"
            class="flex items-center justify-between gap-2 py-2 text-sm"
          >
            <span>
              <b class="text-highlighted">{{ tglPendek(j.date) }}</b>
              <span class="text-muted"> {{ namaHari(j.date) }} · {{ j.start_time }} · {{ j.performance_type || '—' }}</span>
            </span>
            <span class="flex items-center gap-2">
              <AppStatus
                :color="j.status === 'Done' ? 'success' : j.status === 'Cancelled' ? 'neutral' : 'warning'"
                size="sm"
              >
                {{ j.status }}
              </AppStatus>
              <span class="num">{{ rupiah(Number(j.fee) || 0) }}</span>
            </span>
          </li>
        </ul>
        <div
          v-if="detail"
          class="mt-2 flex flex-wrap items-center justify-between gap-2"
        >
          <UButton
            label="Buka schedule"
            icon="i-lucide-calendar-days"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/event/schedule"
          />
          <p class="text-sm font-bold text-highlighted num">
            Total {{ rupiah(detail.fee) }}
          </p>
        </div>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
