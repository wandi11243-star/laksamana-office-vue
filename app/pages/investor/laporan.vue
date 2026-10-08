<!--
  Investor Compass › Laporan Laba Rugi. The layout is deliberately the CFO's
  Profit Loss Report, row order and names included: a look-alike of our own
  invention would force investors to reconcile two layouts every month.

  Only the Pendapatan block has a source in the Office. The COGS, Opex, Other
  and Depreciation rows are drawn marked "belum ada inputnya": deleting them
  reads as if Net Sales were profit, and zeroing them prints two convincing
  wrong numbers. What is empty must LOOK empty.

  Below it the monthly accounting PDFs: one month picked through a filter
  (not twelve stacked cards), one upload for both files, upload replaces
  (UNIQUE month+kind), per-file failures name their file.

    laksamana-office/investor/index.html:1503-1640  renderLaporan + PDF
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InvestorLabaRugi, JenisLapor } from '~/composables/useInvestor'
import { JENIS_LAPOR, deleteInvestorReport, getInvestorReportUrl, uploadInvestorReport, useInvestorCanUpload, useInvestorSummary } from '~/composables/useInvestor'
import { isAdminOf } from '~/composables/useMe'
import { rupiah } from '~/utils/format'
import { bacaBase64, blnPanjang, bulanLaluISO, fileBukanPdf, ukuranTeks } from '~/utils/investor'

definePageMeta({ access: ['investor'] })

const me = useMe()
const toast = useToast()
const { data: balasan, status, error } = useInvestorSummary()
const ringkas = computed(() => balasan.value?.data ?? null)
const canUpload = useInvestorCanUpload()
const admin = computed(() => isAdminOf(me.value, 'investor'))

// --- Laba Rugi --------------------------------------------------------------
const daftarLr = computed<InvestorLabaRugi[]>(() => ringkas.value?.labaRugi ?? [])
/** Missing entirely = the kompas backend is still the old version (the page
 *  and the backend ship through two separate deploys, so the gap is real). */
const backendLama = computed(() => !!ringkas.value && !Array.isArray(ringkas.value.labaRugi))
const lrBulan = ref<string>('')
watch(daftarLr, (d) => {
  if (d.length && !d.some(r => r.kunci === lrBulan.value)) lrBulan.value = d[0]!.kunci
}, { immediate: true })
const lr = computed(() => daftarLr.value.find(r => r.kunci === lrBulan.value) ?? daftarLr.value[0] ?? null)
const opsiBulan = computed(() => daftarLr.value.map(r => ({ value: r.kunci, label: blnPanjang(r.kunci) })))

/** A report row. `kosong` = no input anywhere: drawn marked, never zeroed. */
function baris(nama: string, nilai: number | null, opt: { tebal?: boolean, garis?: boolean, sorot?: boolean, kosong?: boolean, negatif?: boolean } = {}) {
  return { nama, nilai, ...opt }
}
const barisLr = computed(() => {
  if (!lr.value) return []
  const r = lr.value
  return [
    { judul: 'Pendapatan', mati: false },
    baris('Sales - Food', r.food),
    baris('Sales - Beverage', r.bev),
    baris('Sales - Other', r.lainnya),
    baris('Income PB 1', r.pb1),
    baris('Income Service Charge', r.service),
    baris('Total Sales', r.totalSales, { tebal: true, garis: true }),
    baris('Bill Discount', r.diskon, { negatif: true }),
    baris('Compliment', r.compliment, { negatif: true }),
    baris('Total Discount', r.totalDiskon, { tebal: true, garis: true, negatif: true }),
    baris('Net Sales', r.netSales, { tebal: true, sorot: true }),
    { judul: 'Beban & laba — dicatat di pembukuan Finance, belum masuk sistem Office', mati: true },
    baris('Total Cost of Goods Sold', null, { kosong: true }),
    baris('Gross Profit', null, { kosong: true, tebal: true, garis: true }),
    baris('Total Operational Expense', null, { kosong: true }),
    baris('Operational Profit/Loss', null, { kosong: true, tebal: true, garis: true }),
    baris('Total Other Income & Expense', null, { kosong: true }),
    baris('Earning Before Interest, Tax, Depreciation & Amortization', null, { kosong: true, tebal: true, garis: true }),
    baris('Total Depreciation & Amortization', null, { kosong: true }),
    baris('Earning Before Interest & Tax', null, { kosong: true, tebal: true, garis: true }),
    baris('Earning Before Tax', null, { kosong: true, tebal: true }),
    baris('Net Profit / (Net Loss)', null, { kosong: true, tebal: true, sorot: true }),
  ]
})
const fmtLr = (nilai: number | null, negatif?: boolean) => {
  if (nilai == null) return '—'
  const t = rupiah(Math.abs(nilai))
  return negatif ? `(${t})` : t
}

// --- PDF bulanan --------------------------------------------------------------
const lapor = computed(() => ringkas.value?.lapor ?? {})
const bulanTersimpan = computed(() => Object.keys(lapor.value).sort().reverse())
const pdfBulan = ref('')
watch(bulanTersimpan, (b) => {
  if (b.length && !b.includes(pdfBulan.value)) pdfBulan.value = b[0]!
}, { immediate: true })
const isiBulan = computed(() => (pdfBulan.value && lapor.value[pdfBulan.value]) || {})
const opsiPdf = computed(() => bulanTersimpan.value.map(b => ({ value: b, label: blnPanjang(b) })))

const membuka = ref<JenisLapor | null>(null)
async function bukaPdf(jenis: JenisLapor) {
  if (!pdfBulan.value || membuka.value) return
  membuka.value = jenis
  try {
    const url = await getInvestorReportUrl(pdfBulan.value, jenis)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  catch (e) {
    toast.add({ title: 'Laporan tidak bisa dibuka.', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    membuka.value = null
  }
}

const hapusTarget = ref<JenisLapor | null>(null)
const sheetHapus = ref(false)
const tanyaHapus = (jenis: JenisLapor) => {
  hapusTarget.value = jenis
  sheetHapus.value = true
}
async function jalankanHapus() {
  if (!hapusTarget.value || !pdfBulan.value) return
  try {
    const res = await deleteInvestorReport(pdfBulan.value, hapusTarget.value)
    if (balasan.value) balasan.value.data.lapor = res.data.lapor
    sheetHapus.value = false
    toast.add({ title: 'Berkas dihapus.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal menghapus.', description: apiErrorMessage(e), color: 'error' })
  }
}

// --- unggah -------------------------------------------------------------------
const BATAS = 12 * 1024 * 1024
const formBulan = ref(bulanLaluISO())
const fileBalance = ref<File | null>(null)
const fileLedger = ref<File | null>(null)
const pesan = ref('')
const pesanOk = ref(false)
const mengunggah = ref(false)
const ambilFile = (e: Event) => ((e.target as HTMLInputElement).files?.[0] ?? null)

async function kirimLapor() {
  pesan.value = ''
  if (!/^\d{4}-\d{2}$/.test(formBulan.value)) {
    pesan.value = 'Bulan laporan wajib diisi.'
    return
  }
  if (!fileBalance.value && !fileLedger.value) {
    pesan.value = 'Pilih minimal satu berkas.'
    return
  }
  for (const f of [fileBalance.value, fileLedger.value]) {
    if (!f) continue
    if (f.size > BATAS) {
      pesan.value = `${f.name} berukuran ${ukuranTeks(f.size)}, melebihi batas 12 MB.`
      return
    }
    if (await fileBukanPdf(f)) {
      pesan.value = `${f.name} bukan PDF.`
      return
    }
  }
  mengunggah.value = true
  pesan.value = 'Mengunggah…'
  try {
    const antre: [JenisLapor, File][] = []
    if (fileBalance.value) antre.push(['balance', fileBalance.value])
    if (fileLedger.value) antre.push(['ledger', fileLedger.value])
    const galat: string[] = []
    let peta = lapor.value
    for (const [jenis, f] of antre) {
      try {
        const res = await uploadInvestorReport(formBulan.value, jenis, await bacaBase64(f), f.name)
        peta = res.data.lapor
      }
      catch (e) {
        galat.push(`${f.name}: ${apiErrorMessage(e)}`)
      }
    }
    if (balasan.value) balasan.value.data.lapor = peta
    // The filter moves to the month just uploaded: without it the uploader
    // presses Unggah, sees nothing change, and concludes it failed.
    pdfBulan.value = formBulan.value
    fileBalance.value = null
    fileLedger.value = null
    pesanOk.value = galat.length === 0
    pesan.value = galat.length
      ? `Sebagian gagal: ${galat.join('; ')}. Yang berhasil sudah tersimpan.`
      : `Tersimpan untuk ${blnPanjang(formBulan.value)}.`
  }
  catch (e) {
    pesanOk.value = false
    pesan.value = apiErrorMessage(e)
  }
  finally {
    mengunggah.value = false
  }
}

// --- tabel riwayat bulan (desktop) ----------------------------------------------
interface BarisLapor { bulan: string, balance: string, ledger: string }
const tabelLapor = computed<BarisLapor[]>(() => bulanTersimpan.value.map(b => ({
  bulan: b,
  balance: lapor.value[b]?.balance ? `${lapor.value[b]!.balance!.nama} · ${ukuranTeks(lapor.value[b]!.balance!.ukuran)}` : 'belum diunggah',
  ledger: lapor.value[b]?.ledger ? `${lapor.value[b]!.ledger!.nama} · ${ukuranTeks(lapor.value[b]!.ledger!.ukuran)}` : 'belum diunggah',
})))
const kolomLapor = computed<TableColumn<BarisLapor>[]>(() => [
  { accessorKey: 'bulan', header: 'Bulan' },
  { accessorKey: 'balance', header: 'Balance Report' },
  { accessorKey: 'ledger', header: 'General Ledger Report' },
])
const namaHapus = computed(() => JENIS_LAPOR.find(j => j.key === hapusTarget.value)?.label ?? '')
</script>

<template>
  <AppPage
    title="Laporan laba rugi"
    description="Susunan yang sama dengan profit loss report bulanan"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat laporan"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>

    <UAlert
      v-else-if="error || !ringkas"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Laporan belum bisa disusun"
      :description="apiErrorMessage(error, 'Angka pendapatannya belum terbaca.')"
    />

    <template v-else>
      <AppPanel
        title="Laba rugi"
        icon="i-lucide-file-text"
      >
        <template
          v-if="opsiBulan.length > 1"
          #actions
        >
          <USelect
            v-model="lrBulan"
            :items="opsiBulan"
            value-key="value"
            class="w-44"
          />
        </template>

        <UAlert
          v-if="backendLama"
          color="warning"
          variant="subtle"
          icon="i-lucide-hourglass"
          title="Bagian server belum diperbarui"
          description="Halaman ini sudah versi baru, tapi API omsetnya belum. Keduanya naik lewat dua proses deploy terpisah — tunggu beberapa menit lalu muat ulang halaman."
        />
        <UAlert
          v-else-if="!lr"
          color="info"
          variant="subtle"
          icon="i-lucide-file-text"
          title="Belum ada omset yang bisa disusun"
          description="Blok Pendapatan disusun dari Input Omset Harian di modul Finance — Dashboard Omset. Begitu satu hari diisi, laporannya muncul di sini."
        />

        <template v-else>
          <div
            v-for="(b, i) in barisLr"
            :key="i"
          >
            <p
              v-if="'judul' in b"
              class="mt-4 text-xs font-bold tracking-wide text-primary-700 uppercase first:mt-0"
              :class="'mati' in b && b.mati && 'text-muted'"
            >
              {{ b.judul }}
            </p>
            <div
              v-else
              class="flex items-baseline justify-between gap-3 border-b border-default py-2"
              :class="[b.garis && 'border-b-2', b.sorot && 'bg-primary-100/60 -mx-2 px-2 rounded']"
            >
              <span
                class="text-sm"
                :class="b.tebal ? 'font-bold text-highlighted' : 'text-default'"
              >{{ b.nama }}</span>
              <span
                v-if="b.kosong"
                class="shrink-0 text-[13px] text-dimmed italic"
              >belum ada inputnya</span>
              <span
                v-else
                class="shrink-0 text-sm font-semibold text-highlighted num"
                :class="b.tebal && 'font-bold'"
              >{{ fmtLr(b.nilai, b.negatif) }}</span>
            </div>
          </div>
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Net Sales bukan laba."
            description="Ia pendapatan sebelum dipotong harga pokok, beban operasional, dan penyusutan — dan ketiganya belum ada inputnya di Office, jadi baris di bawahnya sengaja dibiarkan kosong. Laporan laba rugi yang berwenang tetap yang disiapkan Finance tiap bulan."
            class="mt-4"
          />
          <p class="mt-2 text-[13px] text-muted">
            Pendapatan disusun dari {{ lr.hariTerisi }} hari yang terisi di {{ blnPanjang(lr.kunci) }} · sumber: Input Omset Harian &amp; register Compliment
          </p>
        </template>
      </AppPanel>

      <AppPanel
        title="Laporan akuntansi bulanan"
        icon="i-lucide-folder-open"
        description="Balance report & general ledger report"
      >
        <template
          v-if="bulanTersimpan.length > 1"
          #actions
        >
          <USelect
            v-model="pdfBulan"
            :items="opsiPdf"
            value-key="value"
            class="w-44"
          />
        </template>

        <UAlert
          v-if="!bulanTersimpan.length"
          color="info"
          variant="subtle"
          icon="i-lucide-file-text"
          title="Belum ada laporan PDF"
          :description="canUpload ? 'Unggah Balance Report dan General Ledger Report bulanan lewat form di bawah.' : 'Balance Report dan General Ledger Report bulanan akan muncul di sini begitu diunggah.'"
        />

        <template v-else>
          <h3 class="text-base font-bold text-highlighted">
            {{ blnPanjang(pdfBulan) }}
          </h3>
          <div
            v-for="j in JENIS_LAPOR"
            :key="j.key"
            class="flex items-center gap-3 border-b border-default py-3 last:border-0"
          >
            <UIcon
              :name="j.icon"
              class="size-6 shrink-0 text-primary-700"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-highlighted">
                {{ j.label }}
              </p>
              <p
                v-if="isiBulan[j.key]"
                class="truncate text-[13px] text-muted"
              >
                {{ isiBulan[j.key]!.nama }} · {{ ukuranTeks(isiBulan[j.key]!.ukuran) }}<span v-if="isiBulan[j.key]!.oleh"> · diunggah {{ isiBulan[j.key]!.oleh }}</span>
              </p>
              <p
                v-else
                class="text-[13px] text-dimmed italic"
              >
                belum diunggah
              </p>
            </div>
            <template v-if="isiBulan[j.key]">
              <UButton
                label="Buka PDF"
                size="sm"
                :loading="membuka === j.key"
                @click="bukaPdf(j.key)"
              />
              <UButton
                v-if="canUpload"
                label="Hapus"
                size="sm"
                color="error"
                variant="soft"
                @click="tanyaHapus(j.key)"
              />
            </template>
          </div>
          <p
            v-if="bulanTersimpan.length > 1"
            class="mt-2 text-[13px] text-muted"
          >
            {{ bulanTersimpan.length }} bulan tersimpan · pilih di kotak sebelah judul
          </p>

          <div class="mt-4 hidden lg:block">
            <UTable
              :data="tabelLapor"
              :columns="kolomLapor"
              empty="Belum ada laporan."
            >
              <template #bulan-cell="{ row }">
                {{ blnPanjang(row.original.bulan) }}
              </template>
            </UTable>
          </div>
        </template>

        <div
          v-if="canUpload"
          class="mt-4 rounded-field border border-default p-4"
        >
          <AppSectionTitle title="Unggah laporan bulanan" />
          <p class="mb-3 text-[13px] text-muted">
            Pilih bulannya sekali, lalu kedua berkasnya. Boleh salah satu dulu — yang tidak dipilih dibiarkan seperti sebelumnya. Hanya PDF, maksimal 12 MB per berkas. Mengunggah untuk bulan yang sudah ada akan <b>mengganti</b> berkas lamanya.
          </p>
          <AppFilterGrid>
            <UFormField label="Bulan laporan">
              <UInput
                v-model="formBulan"
                type="month"
              />
            </UFormField>
            <UFormField label="Balance report (PDF)">
              <UInput
                type="file"
                accept="application/pdf,.pdf"
                @change="fileBalance = ambilFile($event)"
              />
            </UFormField>
            <UFormField label="General ledger report (PDF)">
              <UInput
                type="file"
                accept="application/pdf,.pdf"
                @change="fileLedger = ambilFile($event)"
              />
            </UFormField>
          </AppFilterGrid>
          <div class="mt-3 flex items-center gap-3">
            <UButton
              label="Unggah"
              :loading="mengunggah"
              @click="kirimLapor()"
            />
            <p
              v-if="pesan"
              class="text-sm"
              :class="pesanOk ? 'text-success' : 'text-error'"
            >
              {{ pesan }}
            </p>
          </div>
        </div>
        <p
          v-else-if="admin === false"
          class="mt-3 text-[13px] text-muted"
        >
          Hanya admin investor yang bisa mengunggah — hubungi admin bila ada berkas yang kurang.
        </p>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      :title="`Hapus ${namaHapus}`"
      :description="`${blnPanjang(pdfBulan)} — berkasnya ikut terhapus dari server.`"
    >
      <template #footer>
        <UButton
          label="Batal"
          variant="soft"
          @click="sheetHapus = false"
        />
        <UButton
          label="Hapus berkas"
          color="error"
          @click="jalankanHapus()"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
