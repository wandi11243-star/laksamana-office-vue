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
import { createEvent, feeAngka, patchEvent, uploadFileEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, hariIni, rupiah, tambahHari, tglPendek } from '~/utils/format'
import { BAYAR_IKON, BAYAR_WARNA } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const bolehUbah = computed(() => bolehUbahEvent('fee', peranEvent(me.value)))

type Mode = 'minggu' | 'bulan' | 'rentang'
const mode = ref<Mode>('minggu')
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
  else {
    acuan.value = tambahHari(acuan.value, n * 7)
  }
}

const qJadwal = computed<Record<string, string>>(() => ({ from: periode.value.dari, to: periode.value.sampai }))
const { data: daftarJadwal, status, refresh } = useDaftarEvent<JadwalTalent>('schedules', qJadwal, 'event-fee-sched')
const { data: daftarTalent } = useDaftarEvent<Talent>('talents', {}, 'event-fee-talents')
const { data: daftarTagihan, refresh: refreshTagihan } = useDaftarEvent<TagihanTalent>('talent-payments', {}, 'event-fee-bills')

const namaTalent = (id: string) => daftarTalent.value.rows.find(t => t.id === id)?.name ?? '—'
const bankTalent = (id: string) => {
  const t = daftarTalent.value.rows.find(t => t.id === id)
  return [t?.bank_name, t?.bank_account].filter(Boolean).join(' ') || '—'
}

// --- recap: Σ fee of Done schedules per talent (`:4045`) ---
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
  for (const b of m.values()) {
    b.tagihan = daftarTagihan.value.rows.find(p => p.talent_id === b.talent_id && p.period_month === periode.value.kunci) ?? null
  }
  return [...m.values()].sort((a, b) => namaTalent(a.talent_id).localeCompare(namaTalent(b.talent_id)))
})
const totalHari = computed(() => rekap.value.reduce((a, b) => a + b.hari, 0))
const totalFee = computed(() => rekap.value.reduce((a, b) => a + b.fee, 0))

const kolom: TableColumn<BarisFee>[] = [
  { id: 'talent', header: 'Talent' },
  { id: 'bank', header: 'Bank' },
  { id: 'hari', header: 'Hari tampil' },
  { id: 'fee', header: 'Total fee' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: 'Aksi' },
]

// --- generate payment (`genPayment :4097`) ---
async function generate(b: BarisFee) {
  if (b.tagihan) return
  try {
    await createEvent('talent-payments', {
      talent_id: b.talent_id,
      period_month: periode.value.kunci,
      amount: b.fee,
      status: 'Waiting',
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

function bukaBayar(b: BarisFee) {
  bayarUntuk.value = b
  bayar.value = { bank: bankTalent(b.talent_id), nominal: b.fee, pic: namaSaya.value }
  berkasBukti.value = null
  sheetBayar.value = true
}
async function simpanBayar() {
  const b = bayarUntuk.value
  if (!b) return
  try {
    membayar.value = true
    let proofKey = ''
    if (berkasBukti.value) {
      const buf = await berkasBukti.value.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
      const up = await uploadFileEvent({ dataBase64: btoa(bin), fileName: berkasBukti.value.name, mimeType: berkasBukti.value.type || 'application/octet-stream' })
      proofKey = up.data.key
    }
    const ada = b.tagihan
    const versi = ada ? daftarTagihan.value.versions[ada.id] : undefined
    const body = {
      talent_id: b.talent_id,
      period_month: periode.value.kunci,
      amount: bayar.value.nominal,
      status: 'Waiting',
      proof_key: proofKey,
      pic_finance: bayar.value.pic,
      bank_tujuan: bayar.value.bank,
      updatedAt: Date.now(),
    }
    if (ada) await patchEvent('talent-payments', ada.id, body, versi)
    else await createEvent('talent-payments', { ...body, createdAt: Date.now() })
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
  try {
    await patchEvent('talent-payments', p.id, { status: 'Paid', updatedAt: Date.now() }, daftarTagihan.value.versions[p.id])
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
  try {
    await patchEvent('talent-payments', p.id, { status: 'Rejected', updatedAt: Date.now() }, daftarTagihan.value.versions[p.id])
    toast.add({ title: 'Pembayaran ditolak', color: 'success' })
    await refreshTagihan()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshTagihan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- detail history (`payHistory`) ---
const detailId = ref('')
const detail = computed(() => rekap.value.find(b => b.talent_id === detailId.value) ?? null)
const sheetDetail = computed({ get: () => detailId.value !== '', set: v => (detailId.value = v ? detailId.value : '') })
const jadwalTalent = computed(() => daftarJadwal.value.rows
  .filter(j => j.talent_id === detailId.value && j.status === 'Done' && j.date >= periode.value.dari && j.date <= periode.value.sampai)
  .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''))))
</script>

<template>
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
          <UInput
            v-model="rentangDari"
            type="date"
          />
          <span class="text-muted">–</span>
          <UInput
            v-model="rentangSampai"
            type="date"
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
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          :loading="status === 'pending'"
          @click="() => { refresh(); refreshTagihan() }"
        >
          Muat ulang
        </UButton>
        <span class="ms-auto flex gap-2">
          <span class="rounded-full bg-info/12 px-3 py-1 text-xs font-semibold text-info num">{{ angka(totalHari) }} hari tampil</span>
          <span class="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800 num">{{ rupiah(totalFee) }}</span>
        </span>
      </div>
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
        class="hidden lg:block"
      >
        <template #talent-cell="{ row }">
          <b class="text-highlighted">{{ namaTalent(row.original.talent_id) }}</b>
        </template>
        <template #bank-cell="{ row }">
          {{ bankTalent(row.original.talent_id) }}
        </template>
        <template #hari-cell="{ row }">
          <span class="num">{{ angka(row.original.hari) }}</span>
        </template>
        <template #fee-cell="{ row }">
          <span class="num">{{ rupiah(row.original.fee) }}</span>
        </template>
        <template #status-cell="{ row }">
          <AppStatus
            :color="BAYAR_WARNA[String(row.original.tagihan?.status ?? 'Waiting')] ?? 'neutral'"
            :icon="BAYAR_IKON[String(row.original.tagihan?.status ?? 'Waiting')]"
            size="sm"
          >
            {{ row.original.tagihan?.status ?? 'Belum ditagih' }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <span class="flex flex-wrap gap-1">
            <UButton
              v-if="bolehUbah && !row.original.tagihan"
              color="neutral"
              variant="outline"
              size="sm"
              @click="generate(row.original)"
            >
              Generate payment
            </UButton>
            <UButton
              v-if="bolehUbah"
              color="primary"
              variant="outline"
              size="sm"
              @click="bukaBayar(row.original)"
            >
              Bayar
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="detailId = row.original.talent_id"
            >
              Detail
            </UButton>
            <UButton
              v-if="bolehUbah && row.original.tagihan && String(row.original.tagihan.status) !== 'Paid'"
              color="success"
              variant="ghost"
              size="sm"
              @click="setLunas(row.original)"
            >
              Set paid
            </UButton>
            <UButton
              v-if="bolehUbah && row.original.tagihan && String(row.original.tagihan.status) !== 'Paid'"
              color="error"
              variant="ghost"
              size="sm"
              @click="tolak(row.original)"
            >
              Reject
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
          <span class="mt-0.5 block text-xs text-muted num">{{ b.hari }} hari · {{ rupiah(b.fee) }} · {{ b.tagihan?.status ?? 'Belum ditagih' }}</span>
          <span class="mt-1.5 flex flex-wrap gap-1.5">
            <UButton
              v-if="bolehUbah && !b.tagihan"
              color="neutral"
              variant="outline"
              size="sm"
              @click="generate(b)"
            >
              Generate payment
            </UButton>
            <UButton
              v-if="bolehUbah"
              color="primary"
              variant="outline"
              size="sm"
              @click="bukaBayar(b)"
            >
              Bayar
            </UButton>
            <UButton
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

    <p class="mt-3 text-xs text-muted">
      Pemeriksaan bukti transfer otomatis (OCR) <span class="text-dimmed">Segera</span> — verifikasi dilakukan manual lewat Set paid / Reject.
    </p>

    <ResponsiveSheet
      v-model:open="sheetBayar"
      title="Proses pembayaran"
    >
      <div
        v-if="bayarUntuk"
        class="grid gap-3"
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
        </UFormField>
      </div>
      <template #footer>
        <UButton
          color="primary"
          :loading="membayar"
          @click="simpanBayar()"
        >
          Simpan pembayaran
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
      <ul
        v-if="detail"
        class="divide-y divide-default"
      >
        <li
          v-for="j in jadwalTalent"
          :key="j.id"
          class="flex justify-between py-2 text-sm"
        >
          <span class="text-highlighted">{{ tglPendek(j.date) }} · {{ j.type }}</span>
          <span class="num">{{ rupiah(Number(j.fee) || 0) }}</span>
        </li>
      </ul>
      <p
        v-if="detail"
        class="mt-2 text-right text-sm font-bold text-highlighted num"
      >
        Total {{ rupiah(detail.fee) }}
      </p>
    </ResponsiveSheet>
  </AppPage>
</template>
