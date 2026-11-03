<!--
  Konten › Ads Management (old VIEWS.ads, deploy/konten/index.html:3755-3883,
  forms :4152-4266; konten.md D.15).

  Order as the old page: brand bar → 4 cards (Iklan Aktif, Total Dana Masuk,
  Total Dana Keluar incl. PPN, Sisa Dana brand ini) → Sisa Dana Keseluruhan
  (all brands, all time) → Iklan Meta yang sedang berjalan (live Graph:
  per-akun + per-kampanye, Kelola jeda/lanjut/budget) → Report per bulan
  (+ CSV export per month) → Dana Keluar (ads: filters, table, inline
  status) → Dana Masuk (funds).
  Money rules in promosi-konten.ts (start month, 11% VAT, no-date bucket).
  Statuses follow the dates once per session (useStatusIklanOtomatis).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { DanaIklan, FilterIklan, IklanKonten } from '~/utils/promosi-konten'
import type { InfoAdsObjek, KampanyeAdsJalan } from '~/composables/useCampaign'
import {
  ADS_PLATFORMS, ADS_STATUS, ADS_TANPA_TGL, bulanIklan, csvBulanIklan, danaKeluarIklan, filterIklanBawaan, iklanPakaiCadangan, labelBulanIklan,
  platformVideo, rapikanVideo, rekapBulanIklan, saringIklan, tglDanaIklan,
} from '~/utils/promosi-konten'
import { angka, fTgl, fTglP, hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()
const toast = useToast()
// Date-bound statuses are corrected on every visit (old ran on each VIEWS.ads
// render), not once per session: an ad dating out mid-session would stay stale.
watch(status, (s) => {
  if (s === 'success' && can('ads')) void perbaruiStatusIklanOtomatis()
}, { immediate: true })

const adsScope = computed(() => saringBrand(st.value.ads, brand.value))
const fundScope = computed(() => saringBrand(st.value.adFunds, brand.value))

/** First-load skeleton for the four fund cards below: skeleton cells stand in
 *  until the first state lands. Refetch keeps old numbers, so brand switches
 *  never blank the cards. */
const statMemuat = computed(() => !st.value.ads.length && !st.value.adFunds.length && (status.value === 'pending' || status.value === 'idle'))
const totIn = computed(() => fundScope.value.reduce((s, x) => s + (Number(x.amount) || 0), 0))
const totOut = computed(() => adsScope.value.reduce((s, a) => s + danaKeluarIklan(a), 0))
const aktif = computed(() => adsScope.value.filter(a => a.status === 'active').length)
const allIn = computed(() => st.value.adFunds.reduce((s, x) => s + (Number(x.amount) || 0), 0))
const allOut = computed(() => st.value.ads.reduce((s, a) => s + danaKeluarIklan(a), 0))

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? '-'

// ---- report per month
const bulan = computed(() => rekapBulanIklan(fundScope.value, adsScope.value))
const halB = useState('konten-ads-bln-hal', () => 1)
const perB = useState('konten-ads-bln-per', () => 10)
watch(brand, () => {
  halB.value = 1
})
const halamanB = computed(() => bulan.value.slice((halB.value - 1) * perB.value, halB.value * perB.value))
type BarisBulan = typeof bulan.value[number]
function ekspor(ym: string) {
  // the export uses ALL brands' rows of that month, like the old one
  const csv = csvBulanIklan(ym, st.value.adFunds, st.value.ads, namaBrand)
  if (!csv) return toast.add({ title: 'Tidak ada data pada bulan ini', color: 'error' })
  unduhKonten(`COMS_ads_${ym}.csv`, csv, 'text/csv')
  logKonten('ekspor laporan ads', labelBulanIklan(ym)).catch(() => {})
}
const R = { th: 'text-right', td: 'text-right' }
const kolomB: TableColumn<BarisBulan>[] = [
  { id: 'bulan', header: 'Bulan' },
  { id: 'in', header: 'Dana masuk', meta: { class: R } },
  { id: 'out', header: 'Dana keluar', meta: { class: R } },
  { id: 'sisa', header: 'Sisa (bulan)', meta: { class: R } },
  { id: 'aksi', header: 'Reporting', meta: { class: R } },
]

// ---- ads (dana keluar)
const f = useState<FilterIklan>('konten-ads-filter', filterIklanBawaan)
const halA = useState('konten-ads-hal', () => 1)
const perA = useState('konten-ads-per', () => 10)
const list = computed(() => saringIklan(adsScope.value, f.value))
watch([f, brand], () => {
  halA.value = 1
}, { deep: true })
const halamanA = computed(() => list.value.slice((halA.value - 1) * perA.value, halA.value * perA.value))
const SEMUA = '__semua'
const fPlat = computed({
  get: () => f.value.platform || SEMUA,
  set: (v: string) => {
    f.value.platform = v === SEMUA ? '' : v
  },
})
const fStatus = computed({
  get: () => f.value.status || SEMUA,
  set: (v: string) => {
    f.value.status = v === SEMUA ? '' : v
  },
})
const opsiPlat = [{ value: SEMUA, label: 'Semua platform' }, ...ADS_PLATFORMS.map(p => ({ value: p, label: p }))]
const opsiStatus = Object.entries(ADS_STATUS).map(([value, s]) => ({ value, label: s.label }))
const opsiStatusF = [{ value: SEMUA, label: 'Semua status' }, ...opsiStatus]
const warnaStatus = (s?: string) => (({ active: 'success', paused: 'warning', ended: 'neutral' }) as Record<string, 'success' | 'warning' | 'neutral'>)[s ?? ''] ?? 'info'
async function setStatus(a: IklanKonten, s: string) {
  if (!ADS_STATUS[s] || s === a.status) return
  await kontenSimpan(() => tambalKonten<IklanKonten>('ads', a.id, { status: s }, a.updatedAt), undefined, { action: `status iklan → ${ADS_STATUS[s]!.label}`, target: a.name })
}
const periode = (a: IklanKonten) => (a.startDate ? `${fTglP(a.startDate)} - ${a.endDate ? fTglP(a.endDate) : '?'}` : '')
const kolomA: TableColumn<IklanKonten>[] = [
  { id: 'nama', header: 'Nama iklan' },
  { id: 'brand', header: 'Brand' },
  { accessorKey: 'platform', header: 'Platform' },
  { id: 'target', header: 'Target' },
  { id: 'usia', header: 'Usia range' },
  { id: 'video', header: 'Video' },
  { id: 'chats', header: 'Hasil (chats)', meta: { class: R } },
  { id: 'dana', header: 'Dana keluar', meta: { class: R } },
  { id: 'periode', header: 'Periode' },
  { id: 'status', header: 'Status' },
]

const iklanBuka = ref(false)
const iklanId = ref('')
const iklanItem = computed(() => st.value.ads.find(a => a.id === iklanId.value) ?? null)
function bukaIklan(a?: IklanKonten) {
  iklanId.value = a?.id ?? ''
  iklanBuka.value = true
}

// ---- funds (dana masuk)
const funds = computed(() => fundScope.value.slice().sort((a, b) => String(b.date ?? '1970').localeCompare(String(a.date ?? '1970'))))
const halF = useState('konten-fund-hal', () => 1)
const perF = useState('konten-fund-per', () => 10)
watch(brand, () => {
  halF.value = 1
})
const halamanF = computed(() => funds.value.slice((halF.value - 1) * perF.value, halF.value * perF.value))
const kolomF: TableColumn<DanaIklan>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'brand', header: 'Brand' },
  { id: 'nominal', header: 'Nominal', meta: { class: R } },
  { id: 'note', header: 'Sumber / catatan' },
]

// ---- Iklan Meta yang jalan (live Graph, bukan dana internal di atas) ----
const { data: jalan, error: jalanGalat, status: jalanStatus, refresh: jalanSegar } = useAsyncData(
  'konten-ads-jalan',
  () => getAdsJalan({ status: 'semua', urut: 'belanja' }).then(r => r.data),
  { server: false },
)
const HARI_INI = hariIni()
/** The "not connected" refusal shares one sentence on every ads endpoint. */
const BELUM_SAMBUNG = 'belum diisi di Pengaturan'
const jalanBelumSambung = computed(() => !!jalanGalat.value && apiErrorMessage(jalanGalat.value).includes(BELUM_SAMBUNG))

const akunJalan = computed(() => jalan.value?.akun ?? [])
const kampanyeSemua = computed(() => jalan.value?.kampanye ?? [])
const namaAkunJalan = (id: string) => akunJalan.value.find(a => a.id === id)?.nama || id || '—'

/** An ended campaign no longer runs, even when Meta still reports ACTIVE. */
const lewatSelesai = (k: KampanyeAdsJalan) => !!k.selesai && k.selesai < HARI_INI
const kampanyeAktif = computed(() => kampanyeSemua.value.filter(k => k.status === 'ACTIVE' && !lewatSelesai(k)))
const kampanyeBerhenti = computed(() => kampanyeSemua.value.filter(k => k.status !== 'ACTIVE' || lewatSelesai(k)))

/** "Iklan yang jalan sekarang" comes from the same list — never a separate call. */
const iklanJalanSekarang = computed(() => kampanyeAktif.value.reduce((s, k) => s + (k.iklanAktif || 0), 0))
const belanjaHariJalan = computed(() => kampanyeAktif.value.reduce((s, k) => s + (k.belanjaHariIni || 0), 0))
const belanjaBulanJalan = computed(() => kampanyeAktif.value.reduce((s, k) => s + (k.belanjaBulanIni || 0), 0))
const belanjaAkunJalan = computed(() => akunJalan.value.reduce((s, a) => s + (a.totalBelanja || 0), 0))

type FilterJalan = 'semua' | 'aktif' | 'berhenti'
const jalanFilter = ref<FilterJalan>('semua')
const jalanUrut = ref('mulai')
const opsiUrutJalan = [
  { value: 'mulai', label: 'Mulai terbaru' },
  { value: 'belanja', label: 'Belanja bulan ini' },
  { value: 'nama', label: 'Nama' },
]
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86400000)

/** Newest start first, dateless last, ties by today's spend then name. */
function urutJalan(list: KampanyeAdsJalan[]) {
  const by = jalanUrut.value
  return [...list].sort((x, y) => {
    if (by === 'nama') return x.nama.localeCompare(y.nama, 'id')
    if (by === 'belanja') return (y.belanjaBulanIni - x.belanjaBulanIni) || x.nama.localeCompare(y.nama, 'id')
    if (!x.mulai && !y.mulai) return (y.belanjaHariIni - x.belanjaHariIni) || x.nama.localeCompare(y.nama, 'id')
    if (!x.mulai) return 1
    if (!y.mulai) return -1
    return y.mulai.localeCompare(x.mulai) || (y.belanjaHariIni - x.belanjaHariIni) || x.nama.localeCompare(y.nama, 'id')
  })
}
const jalanAktifTampil = computed(() => urutJalan(kampanyeAktif.value))
const jalanBerhentiTampil = computed(() => urutJalan(kampanyeBerhenti.value))

const labelStatusJalan = (k: KampanyeAdsJalan) => {
  if (lewatSelesai(k)) return 'Sudah selesai'
  return k.status === 'ACTIVE' ? 'Aktif' : k.status === 'PAUSED' ? 'Dijeda' : (k.status || '—')
}
const warnaStatusJalan = (k: KampanyeAdsJalan): 'success' | 'warning' | 'neutral' =>
  (k.status === 'ACTIVE' && !lewatSelesai(k) ? 'success' : k.status === 'PAUSED' ? 'warning' : 'neutral')
const lamaJalan = (k: KampanyeAdsJalan) => {
  if (!k.mulai) return 'Tanggal mulai tidak ada'
  const d = selisihHari(k.mulai, HARI_INI)
  if (d < 0) return `Mulai ${fTglP(k.mulai)}`
  if (d === 0) return 'Mulai hari ini'
  return `Jalan ${d} hari`
}
const sisaJalan = (k: KampanyeAdsJalan) => {
  if (k.jalanTerus || !k.selesai) return 'Jalan terus'
  const d = selisihHari(HARI_INI, k.selesai)
  if (d < 0) return 'Sudah selesai'
  if (d === 0) return 'Berakhir hari ini'
  return `Sisa ${d} hari`
}
/** Which level owns the budget — the "penjelasan tingkat" of the old card. */
const penjelasanTingkat = (k: KampanyeAdsJalan) =>
  k.sumberBudget === 'harian'
    ? 'Budget harian di tingkat kampanye'
    : k.sumberBudget === 'total'
      ? 'Budget total di tingkat kampanye'
      : 'Budget diatur di tingkat set iklan atau iklan'
const budgetUtamaJalan = (k: KampanyeAdsJalan) => (k.sumberBudget === 'total' ? k.budgetTotal : k.budgetHarian)
/** Projected total vs the total budget, at the current daily pace. */
const perkiraanJalan = (k: KampanyeAdsJalan): number | null => {
  if (k.sumberBudget === 'harian' && k.budgetHarian) {
    if (k.jalanTerus || !k.selesai || selisihHari(HARI_INI, k.selesai) < 0) return null
    return k.sejakMulai + k.budgetHarian * selisihHari(HARI_INI, k.selesai)
  }
  if (k.sumberBudget === 'total' && k.budgetTotal) {
    const lama = k.mulai ? Math.max(selisihHari(k.mulai, HARI_INI), 0) : 0
    if (lama < 1) return null
    const totalHari = (k.jalanTerus || !k.selesai) ? lama : lama + Math.max(selisihHari(HARI_INI, k.selesai), 0)
    return (k.sejakMulai / lama) * totalHari
  }
  return null
}

// ---- Kelola: jeda / lanjutkan (3 tingkat) + ubah budget ----
type JenisKelola = 'campaign' | 'adset' | 'ad'
const JENIS_KELOLA: { value: JenisKelola, label: string }[] = [
  { value: 'campaign', label: 'Kampanye' },
  { value: 'adset', label: 'Set iklan' },
  { value: 'ad', label: 'Iklan' },
]
const kelolaBuka = ref(false)
const kelolaJenis = ref<JenisKelola>('campaign')
const kelolaId = ref('')
const kelolaInfo = ref<InfoAdsObjek | null>(null)
const kelolaFase = ref<'idle' | 'muat' | 'ok' | 'galat'>('idle')
const kelolaPesan = ref('')
const kelolaBudget = ref('')
const kelolaBudgetPesan = ref('')
const kelolaSibuk = ref<'tidak' | 'aksi' | 'budget'>('tidak')
const labelJenisKelola = (jenis: string) => JENIS_KELOLA.find(j => j.value === jenis)?.label ?? jenis

function bukaKelola(jenis?: JenisKelola, id?: string) {
  if (jenis) kelolaJenis.value = jenis
  kelolaId.value = id ?? ''
  kelolaInfo.value = null
  kelolaFase.value = 'idle'
  kelolaPesan.value = ''
  kelolaBudget.value = ''
  kelolaBudgetPesan.value = ''
  kelolaBuka.value = true
  if (id) void muatKelola()
}
async function muatKelola() {
  const id = kelolaId.value.trim()
  if (!/^\d+$/.test(id)) {
    kelolaFase.value = 'galat'
    kelolaInfo.value = null
    kelolaPesan.value = 'ID objek iklan harus angka.'
    return
  }
  kelolaFase.value = 'muat'
  kelolaPesan.value = ''
  try {
    kelolaInfo.value = (await getAdsObjek(kelolaJenis.value, id)).data
    kelolaFase.value = 'ok'
  }
  catch (e) {
    kelolaFase.value = 'galat'
    kelolaInfo.value = null
    kelolaPesan.value = apiErrorMessage(e).includes(BELUM_SAMBUNG)
      ? 'Meta Ads belum disambungkan — minta admin mengisi token & ID akun iklan di Pengaturan → kartu Meta Ads.'
      : apiErrorMessage(e)
  }
}
async function kelolaUbahAksi(aksi: 'jeda' | 'lanjutkan') {
  if (kelolaSibuk.value !== 'tidak') return
  kelolaSibuk.value = 'aksi'
  kelolaPesan.value = ''
  try {
    await ubahAdsCampaign({ jenis: kelolaJenis.value, id: kelolaId.value.trim(), aksi })
    toast.add({ title: aksi === 'jeda' ? 'Iklan dijeda di Meta' : 'Iklan dilanjutkan di Meta', color: 'success' })
    await jalanSegar()
    await muatKelola()
  }
  catch (e) {
    kelolaPesan.value = apiErrorMessage(e)
  }
  kelolaSibuk.value = 'tidak'
}
async function kelolaUbahBudget() {
  const v = kelolaBudget.value.trim()
  if (!/^\d+$/.test(v) || Number(v) <= 0) {
    kelolaBudgetPesan.value = 'Budget harus bilangan bulat lebih dari Rp0.'
    return
  }
  if (kelolaSibuk.value !== 'tidak') return
  kelolaSibuk.value = 'budget'
  kelolaBudgetPesan.value = ''
  try {
    await ubahAdsCampaign({ jenis: kelolaJenis.value, id: kelolaId.value.trim(), budget: v })
    toast.add({ title: 'Budget diubah di Meta', color: 'success' })
    kelolaBudget.value = ''
    await jalanSegar()
    await muatKelola()
  }
  catch (e) {
    // The > 5× refusal lands here — show the server sentence, not a toast.
    kelolaBudgetPesan.value = apiErrorMessage(e)
  }
  kelolaSibuk.value = 'tidak'
}
const danaBuka = ref(false)
const danaId = ref('')
const danaItem = computed(() => st.value.adFunds.find(x => x.id === danaId.value) ?? null)
function bukaDana(x?: DanaIklan) {
  danaId.value = x?.id ?? ''
  danaBuka.value = true
}
</script>

<template>
  <KontenGerbang lihat="ads">
    <AppPage
      title="Ads Management"
      description="Dana masuk = budget - Buat iklan = rincian dana keluar (incl. PPN 11%)"
    >
      <template
        v-if="can('ads')"
        #actions
      >
        <UButton
          label="Tambah dana masuk"
          icon="i-lucide-wallet"
          color="neutral"
          variant="outline"
          @click="bukaDana()"
        />
        <UButton
          label="Buat iklan (dana keluar)"
          icon="i-lucide-plus"
          @click="bukaIklan()"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />

      <KontenBrandBar :brands="st.brands" />

      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Iklan aktif"
          :value="angka(aktif)"
          tone="success"
        />
        <AppStat
          label="Total dana masuk"
          :value="rupiah(totIn)"
          tone="success"
        />
        <AppStat
          label="Total dana keluar"
          :value="rupiah(totOut)"
          sub="termasuk PPN 11%"
          tone="error"
        />
        <AppStat
          label="Sisa dana (brand ini)"
          :value="rupiah(totIn - totOut)"
          :tone="totIn - totOut < 0 ? 'error' : 'gold'"
        />
      </AppStatGrid>

      <AppPanel>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-muted">
              Sisa dana keseluruhan (akumulatif - semua brand)
            </p>
            <p class="mt-1 text-xs text-muted">
              Masuk <b class="num text-success">{{ rupiah(allIn) }}</b> − Keluar <b class="num text-error">{{ rupiah(allOut) }}</b>
            </p>
          </div>
          <p
            class="num font-display text-3xl font-bold"
            :class="allIn - allOut < 0 ? 'text-error' : 'text-primary-700'"
          >
            {{ rupiah(allIn - allOut) }}
          </p>
        </div>
      </AppPanel>

      <AppPanel
        title="Iklan Meta yang sedang berjalan"
        icon="i-lucide-megaphone"
        description="Live dari Meta Ads — bukan dana internal di atas. Uang sudah Rupiah."
      >
        <template #actions>
          <UButton
            v-if="can('ads')"
            label="Kelola"
            icon="i-lucide-settings-2"
            color="neutral"
            variant="outline"
            size="sm"
            @click="bukaKelola()"
          />
          <UButton
            label="Segarkan"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="jalanStatus === 'pending'"
            @click="() => jalanSegar()"
          />
        </template>

        <div
          v-if="jalanStatus === 'pending' && !jalan"
          class="space-y-2"
        >
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-24 w-full"
          />
        </div>

        <UAlert
          v-else-if="jalanBelumSambung"
          color="warning"
          variant="subtle"
          icon="i-lucide-unplug"
          title="Meta Ads belum disambungkan"
          description="Kartu ini membaca langsung dari Meta Ads. Minta admin mengisi token & ID akun iklan di Pengaturan → kartu Meta Ads, lalu tekan Segarkan."
        >
          <template #actions>
            <UButton
              label="Segarkan"
              color="warning"
              variant="soft"
              size="xs"
              :loading="jalanStatus === 'pending'"
              @click="() => jalanSegar()"
            />
          </template>
        </UAlert>

        <UAlert
          v-else-if="jalanGalat"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Iklan Meta tidak terbaca"
          :description="apiErrorMessage(jalanGalat)"
        >
          <template #actions>
            <UButton
              label="Coba lagi"
              color="error"
              variant="soft"
              size="xs"
              :loading="jalanStatus === 'pending'"
              @click="() => jalanSegar()"
            />
          </template>
        </UAlert>

        <template v-else>
          <div
            v-if="akunJalan.length"
            class="mb-4 grid gap-3 md:grid-cols-2"
          >
            <div
              v-for="a in akunJalan"
              :key="a.id"
              class="rounded-xl border border-default p-3"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="min-w-0 truncate text-sm text-highlighted">{{ a.nama || a.id }}</b>
                <span class="shrink-0 text-xs text-muted num">{{ a.mataUang }}{{ a.mataUang ? ' · ' : '' }}{{ a.id }}</span>
              </div>
              <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <dt class="text-muted">
                    Total belanja
                  </dt>
                  <dd class="font-semibold num">
                    {{ rupiah(a.totalBelanja) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Tagihan
                  </dt>
                  <dd class="font-semibold num">
                    {{ (a.tagihan ?? '') === '' ? '—' : rupiah(a.tagihan) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Spend cap
                  </dt>
                  <dd class="font-semibold num">
                    {{ (a.spendCap ?? '') === '' ? 'Tanpa batas' : rupiah(a.spendCap) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Sisa spend cap
                  </dt>
                  <dd class="font-semibold num">
                    {{ (a.sisaSpendCap ?? '') === '' ? '—' : rupiah(a.sisaSpendCap) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <AppStatGrid :count="4">
            <AppStat
              label="Iklan yang jalan sekarang"
              :value="angka(iklanJalanSekarang)"
              icon="i-lucide-play"
              tone="success"
              :sub="`${kampanyeAktif.length} kampanye aktif`"
            />
            <AppStat
              label="Belanja hari ini"
              :value="rupiah(belanjaHariJalan)"
              icon="i-lucide-flame"
              tone="gold"
              sub="kampanye yang jalan"
            />
            <AppStat
              label="Belanja bulan ini"
              :value="rupiah(belanjaBulanJalan)"
              icon="i-lucide-calendar-days"
              tone="info"
              sub="kampanye yang jalan"
            />
            <AppStat
              label="Akun iklan"
              :value="angka(akunJalan.length)"
              icon="i-lucide-wallet"
              tone="info"
              :sub="`total belanja ${rupiah(belanjaAkunJalan)}`"
            />
          </AppStatGrid>

          <div class="mb-3 flex flex-wrap items-center gap-2">
            <AppSeg
              v-model="jalanFilter"
              size="sm"
              :options="[
                { value: 'semua', label: 'Semua', jumlah: kampanyeAktif.length + kampanyeBerhenti.length },
                { value: 'aktif', label: 'Aktif', jumlah: kampanyeAktif.length },
                { value: 'berhenti', label: 'Berhenti', jumlah: kampanyeBerhenti.length },
              ]"
            />
            <USelect
              v-model="jalanUrut"
              :items="opsiUrutJalan"
              size="sm"
              class="ms-auto w-44"
              aria-label="Urutkan kampanye"
            />
          </div>

          <p
            v-if="jalanFilter === 'semua' && !jalanAktifTampil.length"
            class="rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted"
          >
            Tidak ada kampanye yang jalan.
          </p>
          <p
            v-if="jalanFilter === 'aktif' && !jalanAktifTampil.length"
            class="rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted"
          >
            Tidak ada kampanye aktif.
          </p>

          <div
            v-if="jalanFilter !== 'berhenti' && jalanAktifTampil.length"
            class="grid gap-3 lg:grid-cols-2"
          >
            <article
              v-for="k in jalanAktifTampil"
              :key="k.id"
              class="rounded-xl border border-default p-4"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <b class="text-highlighted">{{ k.nama || '(tanpa nama)' }}</b>
                  <p class="mt-0.5 text-xs text-muted">
                    {{ namaAkunJalan(k.akun) }} · {{ k.iklanAktif }} iklan aktif
                  </p>
                </div>
                <AppStatus
                  color="success"
                  size="sm"
                >
                  Aktif
                </AppStatus>
              </div>
              <p class="mt-2 text-xs text-muted">
                {{ k.mulai ? fTglP(k.mulai) : 'Tanpa tanggal mulai' }}{{ k.jalanTerus || !k.selesai ? '' : ` – ${fTglP(k.selesai ?? undefined)}` }} · {{ lamaJalan(k) }} · {{ sisaJalan(k) }}
              </p>
              <div class="mt-2 space-y-1 text-sm">
                <p>
                  <b class="num">{{ budgetUtamaJalan(k) === null ? '—' : rupiah(budgetUtamaJalan(k)) }}{{ k.sumberBudget === 'harian' ? ' / hari' : k.sumberBudget === 'total' ? ' total' : '' }}</b>
                  <span class="text-xs text-muted">({{ penjelasanTingkat(k) }})</span>
                </p>
                <p
                  v-if="perkiraanJalan(k) !== null && k.sumberBudget === 'total' && k.budgetTotal"
                  class="text-xs"
                  :class="(perkiraanJalan(k) ?? 0) > (k.budgetTotal ?? 0) ? 'text-error' : 'text-muted'"
                >
                  Perkiraan total {{ rupiah(perkiraanJalan(k)) }} dari {{ rupiah(k.budgetTotal) }}
                </p>
                <p
                  v-if="perkiraanJalan(k) !== null && k.sumberBudget === 'harian'"
                  class="text-xs text-muted"
                >
                  Perkiraan total {{ rupiah(perkiraanJalan(k)) }}
                </p>
                <p class="text-xs text-muted">
                  Hari ini <b class="num text-highlighted">{{ rupiah(k.belanjaHariIni) }}</b>
                  · Bulan ini <b class="num text-highlighted">{{ rupiah(k.belanjaBulanIni) }}</b>
                  · Sejak mulai <b class="num text-highlighted">{{ rupiah(k.sejakMulai) }}</b>
                </p>
              </div>
              <div
                v-if="can('ads')"
                class="mt-3 flex justify-end"
              >
                <UButton
                  label="Atur"
                  icon="i-lucide-sliders-horizontal"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaKelola('campaign', k.id)"
                />
              </div>
            </article>
          </div>

          <template v-if="jalanFilter !== 'aktif' && jalanBerhentiTampil.length">
            <AppSectionTitle
              title="Berhenti terbaru"
              icon="i-lucide-pause"
            />
            <ul class="divide-y divide-default rounded-xl border border-default">
              <li
                v-for="k in jalanBerhentiTampil"
                :key="k.id"
                class="flex items-center justify-between gap-3 p-3"
              >
                <div class="min-w-0">
                  <b class="block truncate text-sm text-highlighted">{{ k.nama || '(tanpa nama)' }}</b>
                  <span class="block truncate text-xs text-muted">
                    {{ k.mulai ? fTglP(k.mulai) : 'tanpa tanggal' }}{{ k.selesai ? ` – ${fTglP(k.selesai)}` : '' }} · sejak mulai {{ rupiah(k.sejakMulai) }}
                  </span>
                </div>
                <AppStatus
                  :color="warnaStatusJalan(k)"
                  size="sm"
                  class="shrink-0"
                >
                  {{ labelStatusJalan(k) }}
                </AppStatus>
                <UButton
                  v-if="can('ads')"
                  label="Atur"
                  icon="i-lucide-sliders-horizontal"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  class="shrink-0"
                  @click="bukaKelola('campaign', k.id)"
                />
              </li>
            </ul>
          </template>
          <p
            v-if="jalanFilter === 'berhenti' && !jalanBerhentiTampil.length"
            class="rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted"
          >
            Tidak ada kampanye yang berhenti.
          </p>
        </template>
      </AppPanel>

      <AppPanel
        title="Report dana masuk & keluar per bulan"
        icon="i-lucide-calendar-range"
        description="Dana keluar sudah termasuk PPN 11%. Sebuah iklan masuk ke bulan tanggal iklan itu mulai jalan - seluruh rinciannya sekaligus, berapa pun tanggal masing-masing rincian."
        flush
      >
        <p
          v-if="!bulan.length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada data untuk direkap.
        </p>
        <template v-else>
          <UTable
            :data="halamanB"
            :columns="kolomB"
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
          >
            <template #bulan-cell="{ row }">
              <b :class="row.original.ym === ADS_TANPA_TGL ? 'text-warning' : ''">{{ labelBulanIklan(row.original.ym) }}</b>
            </template>
            <template #in-cell="{ row }">
              <span class="num text-success">{{ rupiah(row.original.in) }}</span>
            </template>
            <template #out-cell="{ row }">
              <span class="num text-error">{{ rupiah(row.original.out) }}</span>
            </template>
            <template #sisa-cell="{ row }">
              <b
                class="num"
                :class="row.original.in - row.original.out < 0 ? 'text-error' : ''"
              >{{ rupiah(row.original.in - row.original.out) }}</b>
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                label="Export"
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                size="xs"
                @click="ekspor(row.original.ym)"
              />
            </template>
          </UTable>
          <KontenPager
            v-model:hal="halB"
            v-model:per="perB"
            :total="bulan.length"
            satuan="bulan"
          />
        </template>
      </AppPanel>

      <AppPanel
        title="Dana keluar (buat iklan)"
        icon="i-lucide-trending-down"
        description="Rincian di balik kolom Dana keluar pada rekap di atas - sudah termasuk PPN 11%."
        :count="list.length"
        flush
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <div class="flex flex-wrap items-center gap-3 border-b border-default p-4">
          <UInput
            v-model="f.q"
            placeholder="Cari nama iklan / objective / target…"
            icon="i-lucide-search"
            class="w-full sm:w-64"
          />
          <USelect
            v-model="fPlat"
            :items="opsiPlat"
            class="w-full sm:w-44"
          />
          <USelect
            v-model="fStatus"
            :items="opsiStatusF"
            class="w-full sm:w-40"
          />
          <UButton
            label="Reset"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            size="sm"
            @click="f = filterIklanBawaan()"
          />
          <span class="text-xs text-muted sm:ms-auto">{{ list.length }} iklan</span>
        </div>
        <!-- Loading rows mirror the ads table below. -->
        <div
          v-if="status === 'pending' && !list.length"
          class="space-y-2 p-4"
        >
          <USkeleton
            v-for="i in 5"
            :key="i"
            class="h-12 w-full"
          />
        </div>
        <div
          v-else-if="!list.length"
          class="p-8 text-center"
        >
          <UIcon
            name="i-lucide-megaphone"
            class="mx-auto size-7 text-dimmed"
          />
          <p class="mt-2 font-semibold">
            {{ adsScope.length ? 'Tidak ada yang cocok' : 'Belum ada iklan' }}
          </p>
          <p class="text-sm text-muted">
            {{ adsScope.length ? 'Ubah / reset filter.' : 'Klik "Buat iklan" untuk mencatat rincian dana keluar.' }}
          </p>
        </div>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="halamanA"
            :columns="kolomA"
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
          >
            <template #nama-cell="{ row }">
              <button
                type="button"
                class="text-left"
                @click="bukaIklan(row.original)"
              >
                <b class="text-highlighted">{{ row.original.name || '(tanpa nama)' }}</b>
                <span class="block text-xs text-muted">{{ row.original.objective }}{{ row.original.expenses?.length ? ` - ${row.original.expenses.length} rincian` : '' }}</span>
              </button>
            </template>
            <template #brand-cell="{ row }">
              {{ namaBrand(row.original.brand) }}
            </template>
            <template #target-cell="{ row }">
              <span class="text-xs">{{ row.original.target || '-' }}</span>
            </template>
            <template #usia-cell="{ row }">
              <span class="text-xs">{{ row.original.ageRange || '-' }}</span>
            </template>
            <template #video-cell="{ row }">
              <UButton
                v-if="platformVideo(row.original.videoUrl)"
                :to="rapikanVideo(row.original.videoUrl) || undefined"
                target="_blank"
                :label="platformVideo(row.original.videoUrl)!"
                icon="i-lucide-play"
                size="xs"
                color="neutral"
                variant="soft"
              />
              <span
                v-else
                class="text-dimmed"
              >—</span>
            </template>
            <template #chats-cell="{ row }">
              <span class="num font-semibold text-info">{{ angka(row.original.chats || 0) }}</span>
            </template>
            <template #dana-cell="{ row }">
              <span
                class="num font-semibold text-error"
                title="Termasuk PPN 11%"
              >{{ rupiah(danaKeluarIklan(row.original)) }}</span>
            </template>
            <template #periode-cell="{ row }">
              <span
                v-if="row.original.startDate"
                class="text-xs"
              >{{ periode(row.original) }}</span>
              <span
                v-else
                class="text-xs text-error"
                :title="`Tanggal mulai belum diisi - bulan pengeluarannya diambil dari ${iklanPakaiCadangan(row.original) ? fTgl(tglDanaIklan(row.original)) : 'tanggal lain yang ada'}`"
              >mulai belum diisi</span>
            </template>
            <template #status-cell="{ row }">
              <USelect
                v-if="can('ads')"
                :model-value="row.original.status || 'draft'"
                :items="opsiStatus"
                size="sm"
                class="w-28"
                @update:model-value="setStatus(row.original, $event as string)"
              />
              <AppStatus
                v-else
                :color="warnaStatus(row.original.status)"
                size="sm"
              >
                {{ ADS_STATUS[row.original.status || 'draft']?.label }}
              </AppStatus>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="a in halamanA"
              :key="a.id"
              class="p-4"
            >
              <button
                type="button"
                class="block w-full text-left"
                @click="bukaIklan(a)"
              >
                <span class="flex items-start justify-between gap-2">
                  <b class="min-w-0 text-highlighted">{{ a.name || '(tanpa nama)' }}</b>
                  <span class="num shrink-0 font-semibold text-error">{{ rupiah(danaKeluarIklan(a)) }}</span>
                </span>
                <span class="block text-xs text-muted">{{ [namaBrand(a.brand), a.platform, a.objective, a.target].filter(Boolean).join(' · ') }}</span>
                <span class="block text-xs text-muted">{{ a.chats || 0 }} chat · {{ a.startDate ? periode(a) : 'mulai belum diisi' }} · {{ labelBulanIklan(bulanIklan(a)) }}</span>
              </button>
              <USelect
                v-if="can('ads')"
                :model-value="a.status || 'draft'"
                :items="opsiStatus"
                size="sm"
                class="mt-2 w-32"
                @update:model-value="setStatus(a, $event as string)"
              />
            </li>
          </ul>
          <KontenPager
            v-model:hal="halA"
            v-model:per="perA"
            :total="list.length"
            satuan="iklan"
          />
        </template>
      </AppPanel>

      <AppPanel
        title="Dana masuk (budget)"
        icon="i-lucide-wallet"
        :description="`Total: ${rupiah(totIn)}`"
        flush
      >
        <p
          v-if="!funds.length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada dana masuk. Klik "Tambah dana masuk" untuk mencatat budget.
        </p>
        <template v-else>
          <UTable
            :data="halamanF"
            :columns="kolomF"
            :ui="{ tr: can('ads') ? 'cursor-pointer' : '', th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
            @select="(_e: Event, row: { original: DanaIklan }) => can('ads') && bukaDana(row.original)"
          >
            <template #tgl-cell="{ row }">
              <span class="num text-xs">{{ row.original.date ? fTglP(row.original.date) : '-' }}</span>
            </template>
            <template #brand-cell="{ row }">
              {{ namaBrand(row.original.brand) }}
            </template>
            <template #nominal-cell="{ row }">
              <b class="num text-success">{{ rupiah(row.original.amount) }}</b>
            </template>
            <template #note-cell="{ row }">
              <span class="text-xs text-muted">{{ row.original.note || '-' }}</span>
            </template>
          </UTable>
          <KontenPager
            v-model:hal="halF"
            v-model:per="perF"
            :total="funds.length"
            satuan="dana masuk"
          />
        </template>
      </AppPanel>

      <KontenIklanForm
        v-model:open="iklanBuka"
        :iklan="iklanItem"
      />
      <KontenDanaForm
        v-model:open="danaBuka"
        :dana="danaItem"
      />

      <ResponsiveSheet
        v-model:open="kelolaBuka"
        title="Kelola iklan Meta"
        description="Jeda, lanjutkan, atau ubah budget langsung di Meta — 3 tingkat: kampanye, set iklan, iklan."
      >
        <div class="flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="kelolaJenis"
            size="sm"
            :options="JENIS_KELOLA"
            @update:model-value="() => { kelolaInfo = null; kelolaFase = 'idle'; kelolaPesan = '' }"
          />
        </div>
        <div class="mt-3 flex gap-2">
          <UInput
            v-model="kelolaId"
            placeholder="ID angka, mis. 1234567890"
            inputmode="numeric"
            class="min-w-0 flex-1"
            @keyup.enter="muatKelola()"
          />
          <UButton
            label="Tampilkan"
            icon="i-lucide-search"
            :loading="kelolaFase === 'muat'"
            @click="muatKelola()"
          />
        </div>

        <USkeleton
          v-if="kelolaFase === 'muat'"
          class="mt-3 h-28 w-full"
        />
        <UAlert
          v-else-if="kelolaFase === 'galat'"
          class="mt-3"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Info iklan tidak terbaca"
          :description="kelolaPesan"
        />
        <div
          v-else-if="kelolaFase === 'ok' && kelolaInfo"
          class="mt-3 rounded-xl border border-default p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <b class="text-highlighted">{{ kelolaInfo.nama || '(tanpa nama)' }}</b>
              <p class="mt-0.5 text-xs text-muted">
                {{ labelJenisKelola(kelolaInfo.jenis) }} · {{ kelolaInfo.id }}
              </p>
            </div>
            <AppStatus
              :color="kelolaInfo.status === 'ACTIVE' ? 'success' : kelolaInfo.status === 'PAUSED' ? 'warning' : 'neutral'"
              size="sm"
            >
              {{ kelolaInfo.status === 'ACTIVE' ? 'Aktif' : kelolaInfo.status === 'PAUSED' ? 'Dijeda' : (kelolaInfo.status || '—') }}
            </AppStatus>
          </div>
          <p class="mt-1.5 text-xs text-muted">
            {{ kelolaInfo.sumberBudget === 'harian' && kelolaInfo.budgetHarian !== null ? `Budget harian ${rupiah(kelolaInfo.budgetHarian)}`
              : kelolaInfo.sumberBudget === 'total' && kelolaInfo.budgetTotal !== null ? `Budget total ${rupiah(kelolaInfo.budgetTotal)}`
                : 'Budget diatur di tingkat lain — ubah budget di tingkat yang memilikinya' }}
            {{ kelolaInfo.mulai || kelolaInfo.selesai ? ` · ${kelolaInfo.mulai ? fTglP(kelolaInfo.mulai) : '?'} – ${kelolaInfo.selesai ? fTglP(kelolaInfo.selesai) : 'jalan terus'}` : '' }}
          </p>

          <div class="mt-3">
            <UButton
              v-if="kelolaInfo.status === 'ACTIVE'"
              label="Jeda"
              icon="i-lucide-pause"
              color="warning"
              :loading="kelolaSibuk === 'aksi'"
              :disabled="kelolaSibuk !== 'tidak'"
              @click="kelolaUbahAksi('jeda')"
            />
            <UButton
              v-else
              label="Lanjutkan"
              icon="i-lucide-play"
              :loading="kelolaSibuk === 'aksi'"
              :disabled="kelolaSibuk !== 'tidak'"
              @click="kelolaUbahAksi('lanjutkan')"
            />
          </div>
          <UAlert
            v-if="kelolaPesan"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Perubahan tidak tersimpan"
            :description="kelolaPesan"
          />

          <div class="mt-4 border-t border-default pt-3">
            <label
              for="kelola-budget"
              class="text-sm font-semibold"
            >Budget baru (Rupiah)</label>
            <div class="mt-1.5 flex gap-2">
              <UInput
                id="kelola-budget"
                v-model="kelolaBudget"
                placeholder="mis. 100000"
                inputmode="numeric"
                class="min-w-0 flex-1"
                @keyup.enter="kelolaUbahBudget()"
              />
              <UButton
                label="Simpan budget"
                icon="i-lucide-wallet"
                :loading="kelolaSibuk === 'budget'"
                :disabled="kelolaSibuk !== 'tidak'"
                @click="kelolaUbahBudget()"
              />
            </div>
            <p
              v-if="kelolaBudgetPesan"
              class="mt-1.5 text-xs text-error"
            >
              {{ kelolaBudgetPesan }}
            </p>
            <p class="mt-1.5 text-xs text-muted">
              Bilangan bulat lebih dari Rp0. Ditolak server kalau lebih dari 5× budget sekarang. Jeda, lanjutkan, dan ubah budget butuh akses admin Campaign.
            </p>
          </div>
        </div>
        <p
          v-else
          class="mt-3 text-sm text-muted"
        >
          Pilih tingkat, isi ID objeknya, lalu tekan Tampilkan. Dari kartu kampanye, tombol Atur mengisi otomatis.
        </p>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
