<!--
  Analytics › Ringkasan. The month's headline figures from the uploaded POS
  summary (deploy/analytics/index.html:1466 vRingkasan): four stat cards, the
  conditional per-guest pair, the Susunan Penjualan breakdown, then the
  POS-vs-Rekap comparison and the bridge to the three Office figures.
-->
<script setup lang="ts">
import { useAnalyticsHarian } from '~/composables/useAnalyticsEsb'
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { BLN, angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const toast = useToast()
const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('ringkasan'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
// First-load skeleton for the stat cards: while the payload is absent the
// grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !isi.value && (status.value === 'pending' || status.value === 'idle'))
const laporan = computed(() => isi.value?.data.laporan ?? {})
const daftarBulan = computed(() => Object.keys(laporan.value).sort().reverse())
/** The active month: the chosen one when still present, else the newest. */
const blnPilih = useState<string | null>('analytics-bln', () => null)
// "Per hari": a picked date replaces the month on this page (HARIAN_VIEW)
const harian = useAnalyticsHarian()
const bulan = computed(() => {
  if (harian.hari.value) return harian.hari.value.slice(0, 7)
  const a = daftarBulan.value
  if (blnPilih.value && a.includes(blnPilih.value)) return blnPilih.value
  return a[0] ?? ''
})
const d = computed(() => (harian.hari.value ? harian.laporanHari.value : (bulan.value ? laporan.value[bulan.value] ?? null : null)))
const r = computed(() => d.value?.ringkas ?? null)

const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}
const ketLaporan = computed(() => {
  if (!d.value) return ''
  return `${d.value.jenis === 'menu' ? 'Menu Report' : 'Bill Report'} · diunggah ${d.value.diunggah}${d.value.oleh ? ` oleh ${d.value.oleh}` : ''}`
})

const nHari = computed(() => Object.keys(d.value?.hari ?? {}).length)
const nBill = computed(() => r.value?.bill ?? 0)
const grand = computed(() => r.value?.grand ?? 0)

/* Per-guest cards only when pax covers at least half the bills: dividing by
   guests recorded on a fraction of bills yields a believable-looking,
   many-times-too-large average. */
const isiPax = computed(() => r.value?.pax ?? 0)
const billPax = computed(() => r.value?.billPax ?? 0)
const paxCukup = computed(() => nBill.value > 0 && billPax.value >= nBill.value * 0.5 && isiPax.value > 0)

interface BarisSusunan { uraian: string, nilai: number, titik: boolean }
const susunan = computed<BarisSusunan[]>(() => {
  const v = r.value
  if (!v) return []
  const net = v.net ?? 0
  const svc = v.svc ?? 0
  const tax = v.tax ?? 0
  return [
    { uraian: 'Subtotal menu', nilai: v.sub ?? 0, titik: false },
    { uraian: 'Diskon menu', nilai: -(v.discMenu ?? 0) || 0, titik: false },
    { uraian: 'Diskon bill', nilai: -(v.discBill ?? 0) || 0, titik: false },
    { uraian: 'Diskon voucher', nilai: -(v.discVoucher ?? 0) || 0, titik: false },
    { uraian: 'Net Sales', nilai: net, titik: true },
    { uraian: 'Service charge', nilai: svc, titik: false },
    { uraian: 'Pajak', nilai: tax, titik: false },
    { uraian: 'Pembulatan & biaya lain', nilai: grand.value - net - svc - tax, titik: false },
    { uraian: 'Grand Total', nilai: grand.value, titik: true },
  ]
})
const kolomSusunan: TableColumn<BarisSusunan>[] = [
  { accessorKey: 'uraian', header: 'Uraian' },
  { accessorKey: 'nilai', header: 'Nilai' },
]

// --- POS vs Rekap Penjualan (kompas daily, read-only) ---
interface BarisDaily {
  date?: string
  food?: number
  bev?: number
  lainnya?: number
  discount?: number
  service_charge?: number
  service?: number
  tax?: number
  compliment?: number
  net?: number
  tagihan?: number
}
const daily = ref<BarisDaily[] | null>(null)
const dailyGagal = ref(false)
let seqDaily = 0
async function muatDaily() {
  const n = ++seqDaily
  daily.value = null
  dailyGagal.value = false
  if (!bulan.value) return
  try {
    const res = await useApi()<Envelope<BarisDaily[]>>('/kompas/daily', {
      query: { from: `${bulan.value}-01`, to: `${bulan.value}-${String(new Date(Number(bulan.value.slice(0, 4)), Number(bulan.value.slice(5, 7)), 0).getDate()).padStart(2, '0')}` },
    })
    if (n !== seqDaily) return
    daily.value = Array.isArray(res.data) ? res.data : []
  }
  catch {
    if (n !== seqDaily) return
    dailyGagal.value = true
  }
}
watch(bulan, muatDaily, { immediate: true })

const num = (v: unknown) => Number(v ?? 0) || 0
/** cocokPeriode (:1912): in daily mode only that day of the Rekap counts. */
const cocokPeriode = (t: string) => (harian.hari.value ? t === harian.hari.value : t.startsWith(bulan.value))
const rekap = computed(() => {
  const peta: Record<string, { net: number, svc: number, tax: number }> = {}
  for (const x of daily.value ?? []) {
    const t = String(x.date ?? '').slice(0, 10)
    if (!t || !cocokPeriode(t)) continue
    const o = peta[t] || (peta[t] = { net: 0, svc: 0, tax: 0 })
    o.net += x.net ?? (num(x.food) + num(x.bev) + num(x.lainnya) - num(x.discount))
    o.svc += x.service_charge ?? num(x.service)
    o.tax += num(x.tax)
  }
  return peta
})
const rekapHari = computed(() => Object.keys(rekap.value).length)
const rekapNet = computed(() => Object.values(rekap.value).reduce((a, x) => a + x.net, 0))
const rekapSvc = computed(() => Object.values(rekap.value).reduce((a, x) => a + x.svc, 0))
const rekapTax = computed(() => Object.values(rekap.value).reduce((a, x) => a + x.tax, 0))
const rekapTagihan = computed(() => rekapNet.value + rekapSvc.value + rekapTax.value)
const selisih = computed(() => grand.value - rekapTagihan.value)
const selisihBesar = computed(() => rekapTagihan.value ? Math.abs(selisih.value) / rekapTagihan.value : 0)
const compliment = computed(() => (daily.value ?? [])
  .filter(x => cocokPeriode(String(x.date ?? '').slice(0, 10)))
  .reduce((a, x) => a + num(x.compliment), 0))

interface BarisSelisih { t: string, pos: number | null, rek: number | null, s: number, letak: string, hanya: '' | 'pos' | 'rekap' }
const selisihBaris = computed<BarisSelisih[]>(() => {
  const hari = d.value?.hari ?? {}
  const semua = [...new Set([...Object.keys(hari), ...Object.keys(rekap.value)])].sort()
  return semua.map((t) => {
    const p = hari[t]
    const q = rekap.value[t]
    if (!p) return { t, pos: 0, rek: q!.net + q!.svc + q!.tax, s: -(q!.net + q!.svc + q!.tax), letak: '', hanya: 'rekap' as const }
    if (!q) return { t, pos: p.grand ?? 0, rek: 0, s: p.grand ?? 0, letak: '', hanya: 'pos' as const }
    const pos = p.grand ?? 0
    const rek = q.net + q.svc + q.tax
    let letak = ''
    if (typeof p.net === 'number' && (p.net > 0 || pos === 0)) {
      const bNet = p.net - q.net
      const bTs = (pos - p.net) - (q.svc + q.tax)
      const aNet = Math.abs(bNet) >= 1
      const aTs = Math.abs(bTs) >= 1
      letak = aNet && aTs ? 'net & tax/service' : aNet ? 'net (food/bev/lainnya/diskon)' : aTs ? 'tax & service' : ''
    }
    return { t, pos, rek, s: pos - rek, letak, hanya: '' as const }
  })
})
const selisihBeda = computed(() => selisihBaris.value
  .filter(x => Math.abs(x.s) >= 1)
  .sort((a, x) => Math.abs(x.s) - Math.abs(x.s)))
const selisihCocok = computed(() => selisihBaris.value.length - selisihBeda.value.length)
const kolomSelisih: TableColumn<BarisSelisih>[] = [
  { accessorKey: 't', header: 'Tanggal' },
  { accessorKey: 'pos', header: 'POS' },
  { accessorKey: 'rek', header: 'Rekap Penjualan' },
  { accessorKey: 's', header: 'Selisih' },
  { accessorKey: 'letak', header: 'Letak selisih' },
]

interface BarisJembatan { uraian: string, nilai: number | null, ket: string, titik: boolean }
const jembatan = computed<BarisJembatan[]>(() => {
  const out: BarisJembatan[] = [
    { uraian: 'POS · Grand Total', nilai: grand.value, ket: 'berkas yang diunggah di halaman ini', titik: true },
    { uraian: 'Selisih input manual', nilai: -selisih.value, ket: 'satu-satunya selisih di tabel ini', titik: false },
    { uraian: 'Dibayar Tamu', nilai: rekapTagihan.value, ket: 'Finance › Rekap Penjualan & Dashboard Omset', titik: true },
  ]
  if (!daily.value) {
    out.push({ uraian: 'Register compliment tidak terbaca', nilai: null, ket: 'Net Sales (Investor) tidak bisa dijabarkan di sini. Angkanya BUKAN nol — nol akan membuat Net Sales sama persis dengan Dibayar Tamu.', titik: false })
  }
  else {
    out.push({ uraian: 'Compliment', nilai: -compliment.value, ket: 'barangnya keluar, tamunya tidak membayar', titik: false })
    out.push({ uraian: 'Net Sales', nilai: rekapTagihan.value - compliment.value, ket: 'Investor › Laporan Keuangan', titik: true })
  }
  out.push(
    { uraian: 'Dibayar Tamu', nilai: rekapTagihan.value, ket: 'angka yang sama — titik tolak jalur kedua', titik: true },
    { uraian: 'Service charge', nilai: -rekapSvc.value, ket: 'titipan untuk kru, bukan penjualan', titik: false },
    { uraian: 'Pajak (PB 1)', nilai: -rekapTax.value, ket: 'titipan untuk negara, bukan penjualan', titik: false },
    { uraian: 'Omset net', nilai: rekapNet.value, ket: 'dasar Rasio Komposisi, ATV & Self Order', titik: true },
  )
  return out
})
const kolomJembatan: TableColumn<BarisJembatan>[] = [
  { accessorKey: 'uraian', header: 'Uraian' },
  { accessorKey: 'nilai', header: 'Nilai' },
  { accessorKey: 'ket', header: 'Keterangan' },
]

function segarkan() {
  refresh()
  muatDaily()
  toast.add({ title: 'Dimuat ulang.', color: 'success' })
}
</script>

<template>
  <AppPage
    title="Ringkasan"
    description="Angka pokok dari laporan POS yang diunggah"
  >
    <template #actions>
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="segarkan()"
      />
    </template>

    <AppPanel
      v-if="status === 'pending' && !isi"
      title="Memuat ringkasan"
    >
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !isi">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tidak bisa membaca data analytics"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
    </div>

    <UAlert
      v-else-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman &quot;Ringkasan&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <!-- kartuSinkronEsb(true) sits above the month picker (vRingkasan, :1646) -->
      <AnalyticsEsbSinkron ringkas />
      <div class="mb-4 flex flex-wrap items-center gap-2 rounded-panel bg-default px-5 py-3.5 shadow-panel">
        <span class="text-sm font-semibold">Bulan</span>
        <AppChips
          :model-value="blnPilih"
          :options="daftarBulan.map(b => ({ value: b, label: fmtBln(b) }))"
          @update:model-value="harian.pilihBulan"
        />
        <span class="flex-1" />
        <span class="text-xs text-muted">{{ ketLaporan }}</span>
      </div>

      <AnalyticsHarianPilih />

      <template v-if="harian.hari.value && !d" />
      <div
        v-else-if="!d"
        class="rounded-panel border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada laporan yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Sales Recapitulation</i> dari POS.
        </p>
      </div>

      <template v-else>
        <AppStatGrid
          :loading="statMemuat"
          :count="4"
        >
          <AppStat
            label="Total Penjualan"
            :value="rupiah(grand)"
            icon="i-lucide-banknote"
            tone="gold"
            :sub="`${angka(nBill)} bill · ${angka(nHari)} hari`"
          />
          <AppStat
            label="Rata-rata per Bill"
            :value="rupiah(nBill ? grand / nBill : 0)"
            icon="i-lucide-receipt"
            tone="info"
            sub="grand total ÷ jumlah bill"
          />
          <AppStat
            label="Rata-rata per Hari"
            :value="rupiah(nHari ? grand / nHari : 0)"
            icon="i-lucide-calendar-days"
            tone="info"
            sub="hari yang ada transaksinya saja"
          />
          <AppStat
            label="Bill per Hari"
            :value="angka(nHari ? Math.round(nBill / nHari) : 0)"
            icon="i-lucide-users"
            tone="info"
            sub="rata-rata"
          />
        </AppStatGrid>

        <AppStatGrid
          v-if="paxCukup"
          :loading="statMemuat"
          :count="2"
          class="mt-4"
        >
          <AppStat
            label="Rata-rata per Tamu"
            :value="rupiah(grand / isiPax)"
            icon="i-lucide-user"
            tone="success"
            :sub="`${angka(isiPax)} tamu tercatat`"
          />
          <AppStat
            label="Tamu per Bill"
            :value="(isiPax / nBill).toFixed(1)"
            icon="i-lucide-users"
            tone="success"
            sub="dari kolom Pax Total"
          />
        </AppStatGrid>
        <UAlert
          v-else-if="nBill"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Rata-rata per TAMU tidak ditampilkan"
          :description="`Kolom Pax cuma terisi di ${angka(billPax)} dari ${angka(nBill)} bill, jadi membaginya akan memberi angka belasan kali lipat dari kenyataan. Yang dipakai di sini rata-rata per bill.`"
        />

        <AppPanel
          title="Susunan Penjualan"
          description="Dijumlahkan dari kolom yang memang ada di berkasnya — tidak ada satu pun angka yang dihitung ulang di sini."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="susunan"
            :columns="kolomSusunan"
          >
            <template #uraian-cell="{ row }">
              <span :class="row.original.titik && 'font-bold'">{{ row.original.uraian }}</span>
            </template>
            <template #nilai-cell="{ row }">
              <span class="num font-medium">{{ rupiah(row.original.nilai) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="s in susunan"
              :key="s.uraian"
              class="flex items-baseline justify-between gap-3 px-4 py-2.5"
            >
              <span
                class="text-sm"
                :class="s.titik && 'font-bold'"
              >{{ s.uraian }}</span>
              <span class="num text-sm font-medium">{{ rupiah(s.nilai) }}</span>
            </div>
          </div>
        </AppPanel>

        <UAlert
          v-if="dailyGagal"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Rekap Penjualan tidak terbaca"
          description="Perbandingan dengan Rekap Penjualan belum bisa ditampilkan. Periksa koneksi, lalu tekan Refresh."
        />

        <template v-else-if="daily && rekapHari">
          <AppPanel
            title="Dibanding Rekap Penjualan"
            description="Rekap Penjualan diisi manual tiap hari; berkas POS ini keluaran mesin. Keduanya memang bisa berbeda — yang penting bedanya terlihat."
          >
            <AppStatGrid
              :loading="statMemuat"
              :count="3"
            >
              <AppStat
                label="POS (Grand Total)"
                :value="rupiah(grand)"
                icon="i-lucide-banknote"
                tone="gold"
                :sub="`${angka(nHari)} hari`"
              />
              <AppStat
                label="Rekap Penjualan"
                :value="rupiah(rekapTagihan)"
                icon="i-lucide-book-open"
                tone="info"
                :sub="`${angka(rekapHari)} hari terisi · net + service + pajak`"
              />
              <AppStat
                label="Selisih"
                :value="rupiah(selisih)"
                icon="i-lucide-scale"
                tone="info"
                :sub="rekapTagihan ? `${selisih >= 0 ? '+' : ''}${(selisihBesar * 100).toFixed(1)}% dari Rekap` : '—'"
              />
            </AppStatGrid>
            <UAlert
              v-if="selisihBesar > 0.02"
              class="mt-3"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Selisihnya lebih dari 2%"
              description="Yang paling sering jadi sebabnya: hari yang belum diinput di Rekap Penjualan, atau berkas POS yang periodenya tidak sebulan penuh."
            />
          </AppPanel>

          <AppPanel
            title="Selisihnya Ada di Hari Mana"
            description="Tiap tanggal dibandingkan sendiri-sendiri. Kolom letak menyebut bagian mana yang berbeda — net berarti food/beverage/lainnya/diskon, tax & service berarti dua kolom kecil di sebelahnya."
            flush
          >
            <UAlert
              v-if="!selisihBeda.length"
              class="m-4"
              color="success"
              variant="subtle"
              icon="i-lucide-check"
              :title="`Ke-${selisihCocok} hari cocok persis`"
              description="Selisih yang tersisa cuma pembulatan pecahan sen di berkas POS."
            />
            <template v-else>
              <UTable
                class="hidden lg:block"
                :data="selisihBeda.slice(0, 15)"
                :columns="kolomSelisih"
              >
                <template #t-cell="{ row }">
                  <span class="num">{{ tglPanjang(row.original.t) }}</span>
                </template>
                <template #pos-cell="{ row }">
                  <span class="num">{{ rupiah(row.original.pos) }}</span>
                </template>
                <template #rek-cell="{ row }">
                  <span class="num">{{ rupiah(row.original.rek) }}</span>
                </template>
                <template #s-cell="{ row }">
                  <b
                    class="num"
                    :class="row.original.s >= 0 ? 'text-success' : 'text-error'"
                  >{{ row.original.s >= 0 ? '+' : '−' }}{{ rupiah(Math.abs(row.original.s)) }}</b>
                </template>
                <template #letak-cell="{ row }">
                  <span
                    v-if="row.original.hanya === 'rekap'"
                    class="text-sm text-error"
                  >tidak ada di berkas POS</span>
                  <span
                    v-else-if="row.original.hanya === 'pos'"
                    class="text-sm text-error"
                  >belum diinput di Rekap Penjualan</span>
                  <span
                    v-else
                    class="text-xs text-muted"
                  >{{ row.original.letak || 'tidak bisa dipecah' }}</span>
                </template>
              </UTable>
              <div class="divide-y divide-default lg:hidden">
                <div
                  v-for="x in selisihBeda.slice(0, 15)"
                  :key="x.t"
                  class="px-4 py-2.5"
                >
                  <div class="flex items-baseline justify-between gap-2">
                    <b class="text-sm">{{ tglPanjang(x.t) }}</b>
                    <b
                      class="num text-sm"
                      :class="x.s >= 0 ? 'text-success' : 'text-error'"
                    >{{ x.s >= 0 ? '+' : '−' }}{{ rupiah(Math.abs(x.s)) }}</b>
                  </div>
                  <div class="mt-0.5 text-xs text-muted">
                    POS {{ rupiah(x.pos) }} · Rekap {{ rupiah(x.rek) }}{{ x.letak ? ` · ${x.letak}` : '' }}
                  </div>
                </div>
              </div>
              <p class="px-4 py-3 text-xs text-muted">
                {{ selisihCocok }} hari cocok persis. Jumlah seluruh selisih di atas = {{ rupiah(selisih) }}, sama dengan kartu Selisih.
              </p>
            </template>
          </AppPanel>

          <AppPanel
            title="Jembatan ke Tiga Layar Office"
            :description="`Penjualan ${fmtBln(bulan)} berbunyi berbeda di tiga layar, dan itu bukan karena ada yang hilang — tiap layar menjawab pertanyaan yang berbeda. Yang benar-benar selisih cuma baris yang merah.`"
            flush
          >
            <UTable
              class="hidden lg:block"
              :data="jembatan"
              :columns="kolomJembatan"
            >
              <template #uraian-cell="{ row }">
                <span :class="row.original.titik ? 'font-bold' : 'text-muted'">{{ row.original.uraian }}</span>
              </template>
              <template #nilai-cell="{ row }">
                <span
                  v-if="row.original.nilai === null"
                  class="text-sm text-error"
                >tidak terbaca</span>
                <b
                  v-else
                  class="num"
                >{{ rupiah(row.original.nilai) }}</b>
              </template>
              <template #ket-cell="{ row }">
                <span class="text-xs text-muted">{{ row.original.ket }}</span>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="j in jembatan"
                :key="j.uraian"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <span
                    class="text-sm"
                    :class="j.titik ? 'font-bold' : 'text-muted'"
                  >{{ j.uraian }}</span>
                  <b
                    v-if="j.nilai !== null"
                    class="num text-sm"
                  >{{ rupiah(j.nilai) }}</b>
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ j.ket }}
                </div>
              </div>
            </div>
            <p class="px-4 py-3 text-xs text-muted">
              <b>Dibayar Tamu dipakai dua kali sebagai titik tolak.</b> Net Sales dan Realisasi diturunkan dari angka yang sama, bukan berurutan — Realisasi <b>bukan</b> Net Sales dikurangi service dan pajak.
            </p>
          </AppPanel>
        </template>

        <UAlert
          v-else-if="daily && !rekapHari"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Rekap Penjualan belum punya datanya"
          :description="`Rekap Penjualan belum punya data ${fmtBln(bulan)}, jadi belum ada yang bisa dibandingkan.`"
        />
      </template>
    </template>
  </AppPage>
</template>
