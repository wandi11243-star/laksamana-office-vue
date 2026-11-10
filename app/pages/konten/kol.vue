<!--
  Konten › KOL & Medpar Management (old VIEWS.kol, kolDatabaseView,
  kolVisitView, deploy/konten/index.html:3397-3700; konten.md D.14).

  Two sub-tabs, kept in ?tab= so Back returns to the same one:
  - Database KOL & Medpar: filters search / type / niche + Reset; table Nama,
    Tipe, WhatsApp, Instagram, TikTok, Rate Card, Starting Price (+ price
    history badge when it changed at least once), Niche. All brands — the old
    database had no brand.
  - Planning Kunjungan: follows the brand bar; filters search / status / KOL;
    table Event, Brand, Tanggal (past & not settled = red), Lokasi, PIC,
    Status Kehadiran (editable inline), Hari-H "Hadir"/"Tidak hadir".
  Opening the visit form without any KOL says "Tambahkan KOL / Medpar di
  Database dulu" and switches to the database, as before.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FilterKol, FilterVisit, KolKonten, VisitPenuh } from '~/utils/promosi-konten'
import {
  KOL_CATEGORIES, KOL_TYPES, filterKolBawaan, filterVisitBawaan, kolCats, kolType, linkWaKol, rateDelta, saringKol, saringVisit, tanpaAt,
  undanganVisit,
} from '~/utils/promosi-konten'
import { VISIT_STATUS, relHariKonten, sisaHariKonten } from '~/utils/konten'
import { fTglP, rupiah, ymdLokal } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data: st, error, status } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()

const tab = computed({
  get: () => (route.query.tab === 'visit' ? 'visit' : 'db'),
  set: (v: string) => router.replace({ query: { ...route.query, tab: v === 'visit' ? 'visit' : undefined } }),
})
const opsiTab = [{ value: 'db', label: 'Database KOL & Medpar', icon: 'i-lucide-contact' }, { value: 'visit', label: 'Planning kunjungan', icon: 'i-lucide-calendar-check' }]

const SEMUA = '__semua'
/** USelect cannot hold '' — '' (all) ↔ sentinel. Reads the filter through a getter: Reset replaces the object. */
const pilihan = (obj: () => object, k: string) => computed({
  get: () => (obj() as Record<string, string>)[k] || SEMUA,
  set: (v: string) => {
    (obj() as Record<string, string>)[k] = v === SEMUA ? '' : v
  },
})

// ---- database
const fk = useState<FilterKol>('konten-kol-filter', filterKolBawaan)
const halK = useState('konten-kol-hal', () => 1)
const perK = useState('konten-kol-per', () => 10)
const kols = computed(() => st.value.kols)
const listK = computed(() => saringKol(kols.value, fk.value))
watch(fk, () => {
  halK.value = 1
}, { deep: true })
const halamanK = computed(() => listK.value.slice((halK.value - 1) * perK.value, halK.value * perK.value))
const nKol = computed(() => kols.value.filter(k => kolType(k) === 'KOL').length)
const nMp = computed(() => kols.value.filter(k => kolType(k) === 'Media Partner').length)
const fTipe = pilihan(() => fk.value, 'type')
const fNiche = pilihan(() => fk.value, 'category')
const opsiTipe = [{ value: SEMUA, label: 'Semua tipe' }, ...KOL_TYPES.map(t => ({ value: t, label: t }))]
const opsiNiche = [{ value: SEMUA, label: 'Semua niche' }, ...KOL_CATEGORIES.map(c => ({ value: c, label: c }))]

const kolBuka = ref(false)
const kolId = ref('')
const kolItem = computed(() => kols.value.find(k => k.id === kolId.value) ?? null)
function bukaKol(k?: KolKonten) {
  kolId.value = k?.id ?? ''
  kolBuka.value = true
}
const gambar = ref<{ src: string, judul: string } | null>(null)
const memuatRate = ref<string | null>(null)
// Module-level rate card cache for this page
const rateCardCache = new Map<string, string>()

/** Fetch full rate card on demand when truncated in state. */
async function lihatRateCard(k: KolKonten) {
  const cached = rateCardCache.get(k.id)
  if (cached) {
    gambar.value = { src: cached, judul: `Rate card - ${k.name}` }
    return
  }
  memuatRate.value = k.id
  try {
    const res = await getKonten<KolKonten>('kols', k.id)
    const src = res?.data?.rateImage
    if (!src) {
      toast.add({ title: 'Rate card gagal dimuat', color: 'error' })
      return
    }
    rateCardCache.set(k.id, src)
    gambar.value = { src, judul: `Rate card - ${k.name}` }
  }
  catch {
    toast.add({ title: 'Rate card gagal dimuat', color: 'error' })
  }
  finally {
    memuatRate.value = null
  }
}
const riwayat = ref<KolKonten | null>(null)
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? (id || '')
const waktu = (v?: number) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')
const lencanaRate = (k: KolKonten) => {
  const h = k.rateHistory ?? []
  if (h.length < 2) return null
  return { naik: rateDelta(h[0]!) > 0, n: h.length, at: h[0]!.at }
}

const kolomK: TableColumn<KolKonten>[] = [
  { id: 'nama', header: 'Nama' },
  { id: 'tipe', header: 'Tipe' },
  { id: 'wa', header: 'WhatsApp' },
  { id: 'ig', header: 'Instagram' },
  { id: 'tt', header: 'TikTok' },
  { id: 'rate', header: 'Rate card' },
  { id: 'harga', header: 'Starting price' },
  { id: 'niche', header: 'Niche' },
  { id: 'aksi', header: '' },
]

// ---- visits
const fv = useState<FilterVisit>('konten-visit-filter', filterVisitBawaan)
const halV = useState('konten-visit-hal', () => 1)
const perV = useState('konten-visit-per', () => 10)
const namaKol = (id: string) => kols.value.find(k => k.id === id)?.name ?? ''
const visits = computed(() => st.value.visits)
const listV = computed(() => saringVisit(saringBrand(visits.value, brand.value), fv.value, namaKol))
watch([fv, brand], () => {
  halV.value = 1
}, { deep: true })
const halamanV = computed(() => listV.value.slice((halV.value - 1) * perV.value, halV.value * perV.value))
const fStatus = pilihan(() => fv.value, 'status')
const fKol = pilihan(() => fv.value, 'kol')
const opsiStatusV = Object.entries(VISIT_STATUS).map(([value, s]) => ({ value, label: s.label }))
const opsiStatusF = [{ value: SEMUA, label: 'Semua status' }, ...opsiStatusV]
const opsiKolF = computed(() => [{ value: SEMUA, label: 'Semua KOL / Medpar' }, ...kols.value.map(k => ({ value: k.id, label: k.name ?? k.id }))])
const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? '-'
const undangan = (v: VisitPenuh) => {
  const ids = undanganVisit(v)
  const nama = ids.map(namaKol).filter(Boolean).join(', ')
  return `${ids.length} undangan${nama ? `: ${nama}` : ''}`
}
const lewat = (v: VisitPenuh) => {
  const n = sisaHariKonten(v.date)
  return n != null && n < 0 && !['came', 'noshow', 'done'].includes(v.status ?? '')
}
const hariH = (v: VisitPenuh) => sisaHariKonten(v.date) === 0
const relTgl = (v: VisitPenuh) => {
  const n = sisaHariKonten(v.date)
  if (n == null) return '-'
  return n < 0 ? fTglP(v.date!) : relHariKonten(v.date)
}

const visitBuka = ref(false)
const visitId = ref('')
const visitItem = computed(() => visits.value.find(v => v.id === visitId.value) ?? null)
function bukaVisit(v?: VisitPenuh) {
  if (!v && !kols.value.length) {
    toast.add({ title: 'Tambahkan KOL / Medpar di Database dulu', color: 'error' })
    tab.value = 'db'
    return
  }
  visitId.value = v?.id ?? ''
  visitBuka.value = true
}
/** Deep link from the dashboard / calendar agenda (?tab=visit&buka=): open the visit form itself. */
watch([() => route.query.buka, () => visits.value.length], () => {
  if (tab.value !== 'visit') return
  const id = typeof route.query.buka === 'string' ? route.query.buka : ''
  if (!id) return
  const v = visits.value.find(x => x.id === id)
  if (!v) return
  visitId.value = v.id
  visitBuka.value = true
  router.replace({ query: { ...route.query, buka: undefined } })
}, { immediate: true })
async function setStatus(v: VisitPenuh, s: string) {
  if (!VISIT_STATUS[s] || s === v.status) return
  const judul = v.title || undanganVisit(v).map(namaKol)[0] || 'Event'
  const ok = await kontenSimpan(() => tambalKonten<VisitPenuh>('visits', v.id, { status: s }, v.updatedAt), undefined,
    { action: `update kehadiran → ${VISIT_STATUS[s]!.label}`, target: judul })
  if (ok) toast.add({ title: `${judul}: ${VISIT_STATUS[s]!.label}`, color: s === 'noshow' ? 'error' : 'success' })
}

const kolomV: TableColumn<VisitPenuh>[] = [
  { id: 'event', header: 'Event / Undangan' },
  { id: 'brand', header: 'Brand' },
  { id: 'tgl', header: 'Tanggal' },
  { accessorKey: 'location', header: 'Lokasi' },
  { id: 'pic', header: 'PIC' },
  { id: 'status', header: 'Status kehadiran' },
  { id: 'aksi', header: '' },
]
</script>

<template>
  <KontenGerbang lihat="kol">
    <AppPage
      title="KOL & Medpar Management"
      :description="tab === 'db' ? `${nKol} KOL - ${nMp} Media Partner - database talent & partner` : `${visits.length} event - kunjungan KOL & Medpar masuk ke Kalender`"
    >
      <template
        v-if="can('kol')"
        #actions
      >
        <UButton
          v-if="tab === 'db'"
          label="Tambah KOL / Medpar"
          icon="i-lucide-plus"
          @click="bukaKol()"
        />
        <UButton
          v-else
          label="Buat kunjungan (event)"
          icon="i-lucide-plus"
          @click="bukaVisit()"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />

      <AppSeg
        v-model="tab"
        :options="opsiTab"
        class="mb-5"
      />

      <!-- ===== Database ===== -->
      <template v-if="tab === 'db'">
        <AppPanel>
          <div class="flex flex-wrap items-center gap-3">
            <UInput
              v-model="fk.q"
              placeholder="Cari nama / IG / TikTok / WA / niche…"
              icon="i-lucide-search"
              class="w-full sm:w-64"
            />
            <USelect
              v-model="fTipe"
              :items="opsiTipe"
              class="w-full sm:w-40"
            />
            <USelect
              v-model="fNiche"
              :items="opsiNiche"
              class="w-full sm:w-52"
            />
            <UButton
              label="Reset"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              size="sm"
              @click="fk = filterKolBawaan()"
            />
            <span class="text-xs text-muted sm:ms-auto">{{ listK.length }} ditampilkan</span>
          </div>
        </AppPanel>

        <AppPanel
          flush
          :class="status === 'pending' ? 'opacity-60' : ''"
        >
          <!-- Loading rows mirror the KOL table below. -->
          <div
            v-if="status === 'pending' && !listK.length"
            class="space-y-2 p-4"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-12 w-full"
            />
          </div>
          <div
            v-else-if="!listK.length"
            class="p-8 text-center"
          >
            <UIcon
              name="i-lucide-contact"
              class="mx-auto size-7 text-dimmed"
            />
            <p class="mt-2 font-semibold">
              {{ kols.length ? 'Tidak ada yang cocok' : 'Belum ada KOL / Medpar' }}
            </p>
            <p class="text-sm text-muted">
              {{ kols.length ? 'Ubah / reset filter.' : 'Tambahkan KOL / Media Partner pertama ke database.' }}
            </p>
          </div>
          <template v-else>
            <UTable
              class="hidden lg:block"
              :data="halamanK"
              :columns="kolomK"
              :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
            >
              <template #nama-cell="{ row }">
                <button
                  type="button"
                  class="font-semibold text-highlighted hover:underline"
                  @click="bukaKol(row.original)"
                >
                  {{ row.original.name }}
                </button>
              </template>
              <template #tipe-cell="{ row }">
                <AppStatus
                  :color="kolType(row.original) === 'Media Partner' ? 'info' : 'gold'"
                  :icon="kolType(row.original) === 'Media Partner' ? 'i-lucide-newspaper' : 'i-lucide-mic'"
                  size="sm"
                >
                  {{ kolType(row.original) }}
                </AppStatus>
              </template>
              <template #wa-cell="{ row }">
                <a
                  v-if="row.original.whatsapp"
                  :href="linkWaKol(row.original.whatsapp)"
                  target="_blank"
                  rel="noopener"
                  class="font-semibold text-success"
                >{{ row.original.whatsapp }}</a>
                <span
                  v-else
                  class="text-dimmed"
                >-</span>
              </template>
              <template #ig-cell="{ row }">
                <a
                  v-if="row.original.instagram"
                  :href="`https://instagram.com/${tanpaAt(row.original.instagram)}`"
                  target="_blank"
                  rel="noopener"
                  class="text-info"
                >@{{ tanpaAt(row.original.instagram) }}</a>
                <span
                  v-else
                  class="text-dimmed"
                >-</span>
              </template>
              <template #tt-cell="{ row }">
                <a
                  v-if="row.original.tiktok"
                  :href="`https://tiktok.com/@${tanpaAt(row.original.tiktok)}`"
                  target="_blank"
                  rel="noopener"
                  class="text-info"
                >@{{ tanpaAt(row.original.tiktok) }}</a>
                <span
                  v-else
                  class="text-dimmed"
                >-</span>
              </template>
              <template #rate-cell="{ row }">
                <UButton
                  v-if="row.original.rateImageDipangkas"
                  size="xs"
                  variant="soft"
                  icon="i-lucide-image"
                  label="Lihat"
                  title="Lihat rate card"
                  :loading="memuatRate === row.original.id"
                  @click="lihatRateCard(row.original)"
                />
                <button
                  v-else-if="row.original.rateImage"
                  type="button"
                  title="Lihat rate card"
                  @click="gambar = { src: row.original.rateImage!, judul: `Rate card - ${row.original.name}` }"
                >
                  <img
                    :src="row.original.rateImage"
                    alt="Rate card"
                    class="h-8 w-11 cursor-zoom-in rounded-md border border-default object-cover"
                  >
                </button>
                <UButton
                  v-else-if="row.original.rateDrive"
                  :to="row.original.rateDrive"
                  target="_blank"
                  label="Drive"
                  icon="i-lucide-paperclip"
                  size="xs"
                  color="neutral"
                  variant="soft"
                />
                <span
                  v-else
                  class="text-dimmed"
                >-</span>
              </template>
              <template #harga-cell="{ row }">
                <span
                  v-if="row.original.rateValue"
                  class="num font-semibold"
                >{{ rupiah(row.original.rateValue) }}</span>
                <UBadge
                  v-else-if="row.original.rateTier"
                  :label="row.original.rateTier"
                  color="neutral"
                  variant="soft"
                  size="sm"
                />
                <span
                  v-else
                  class="text-dimmed"
                >-</span>
                <button
                  v-if="lencanaRate(row.original)"
                  type="button"
                  class="mt-0.5 block text-[11px] font-semibold"
                  :class="lencanaRate(row.original)!.naik ? 'text-error' : 'text-success'"
                  title="Lihat riwayat starting price"
                  @click="riwayat = row.original"
                >
                  {{ lencanaRate(row.original)!.naik ? '▲' : '▼' }} {{ lencanaRate(row.original)!.n }}x - {{ fTglP(ymdLokal(lencanaRate(row.original)!.at)) }}
                </button>
              </template>
              <template #niche-cell="{ row }">
                <span
                  v-if="kolCats(row.original).length"
                  class="flex flex-wrap gap-1"
                >
                  <UBadge
                    v-for="c in kolCats(row.original)"
                    :key="c"
                    :label="c"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                </span>
                <span
                  v-else
                  class="text-dimmed"
                >-</span>
              </template>
              <template #aksi-cell="{ row }">
                <UButton
                  v-if="can('kol')"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Ubah"
                  @click="bukaKol(row.original)"
                />
              </template>
            </UTable>
            <ul class="divide-y divide-default lg:hidden">
              <li
                v-for="k in halamanK"
                :key="k.id"
                class="flex items-start gap-3 p-4"
              >
                <button
                  type="button"
                  class="min-w-0 flex-1 text-left"
                  @click="bukaKol(k)"
                >
                  <b class="text-highlighted">{{ k.name }}</b>
                  <span class="ms-1 text-xs text-muted">{{ kolType(k) }}</span>
                  <span class="block text-xs text-muted">{{ [k.whatsapp, k.instagram && `@${tanpaAt(k.instagram)}`, k.tiktok && `TT @${tanpaAt(k.tiktok)}`].filter(Boolean).join(' · ') || '-' }}</span>
                  <span class="block text-xs text-muted">{{ kolCats(k).join(' · ') }}</span>
                </button>
                <span class="num shrink-0 text-sm font-semibold">{{ k.rateValue ? rupiah(k.rateValue) : '' }}</span>
              </li>
            </ul>
            <KontenPager
              v-model:hal="halK"
              v-model:per="perK"
              :total="listK.length"
              satuan="partner"
            />
          </template>
        </AppPanel>
      </template>

      <!-- ===== Planning kunjungan ===== -->
      <template v-else>
        <KontenBrandBar :brands="st.brands" />
        <AppPanel>
          <div class="flex flex-wrap items-center gap-3">
            <UInput
              v-model="fv.q"
              placeholder="Cari event / lokasi / undangan…"
              icon="i-lucide-search"
              class="w-full sm:w-64"
            />
            <USelect
              v-model="fStatus"
              :items="opsiStatusF"
              class="w-full sm:w-44"
            />
            <USelect
              v-model="fKol"
              :items="opsiKolF"
              class="w-full sm:w-48"
            />
            <UButton
              label="Reset"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              size="sm"
              @click="fv = filterVisitBawaan()"
            />
            <span class="text-xs text-muted sm:ms-auto">{{ listV.length }} ditampilkan</span>
          </div>
        </AppPanel>

        <AppPanel
          flush
          :class="status === 'pending' ? 'opacity-60' : ''"
        >
          <!-- Loading rows mirror the visit table below. -->
          <div
            v-if="status === 'pending' && !listV.length"
            class="space-y-2 p-4"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-12 w-full"
            />
          </div>
          <div
            v-else-if="!listV.length"
            class="p-8 text-center"
          >
            <UIcon
              name="i-lucide-calendar-check"
              class="mx-auto size-7 text-dimmed"
            />
            <p class="mt-2 font-semibold">
              {{ visits.length ? 'Tidak ada yang cocok' : 'Belum ada event kunjungan' }}
            </p>
            <p class="text-sm text-muted">
              {{ visits.length ? 'Ubah / reset filter.' : 'Buat event activity & undang KOL / Medpar - otomatis masuk Kalender.' }}
            </p>
          </div>
          <template v-else>
            <UTable
              class="hidden lg:block"
              :data="halamanV"
              :columns="kolomV"
              :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
            >
              <template #event-cell="{ row }">
                <button
                  type="button"
                  class="text-left"
                  @click="bukaVisit(row.original)"
                >
                  <b class="text-highlighted">{{ row.original.title || 'Event Activity' }}</b>
                  <span class="block text-xs text-muted">{{ undangan(row.original) }}</span>
                </button>
              </template>
              <template #brand-cell="{ row }">
                {{ namaBrand(row.original.brand) }}
              </template>
              <template #tgl-cell="{ row }">
                <span
                  class="num text-xs font-semibold"
                  :class="lewat(row.original) ? 'text-error' : 'text-default'"
                >{{ relTgl(row.original) }}</span>
                <span class="block text-[11px] text-muted">{{ row.original.date ? fTglP(row.original.date) : '' }}{{ row.original.time ? ` - ${row.original.time}` : '' }}</span>
              </template>
              <template #pic-cell="{ row }">
                {{ row.original.pic ? namaUser(row.original.pic).split(' ')[0] : '-' }}
              </template>
              <template #status-cell="{ row }">
                <USelect
                  v-if="can('kol')"
                  :model-value="row.original.status || 'planned'"
                  :items="opsiStatusV"
                  size="sm"
                  class="w-40"
                  :class="hariH(row.original) ? 'ring-2 ring-primary-300' : ''"
                  @update:model-value="setStatus(row.original, $event as string)"
                />
                <span v-else>{{ VISIT_STATUS[row.original.status || 'planned']?.label }}</span>
              </template>
              <template #aksi-cell="{ row }">
                <span
                  v-if="hariH(row.original) && can('kol')"
                  class="flex gap-1"
                >
                  <UButton
                    label="Hadir"
                    icon="i-lucide-check"
                    size="xs"
                    @click="setStatus(row.original, 'came')"
                  />
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    aria-label="Tandai tidak hadir"
                    @click="setStatus(row.original, 'noshow')"
                  />
                </span>
              </template>
            </UTable>
            <ul class="divide-y divide-default lg:hidden">
              <li
                v-for="v in halamanV"
                :key="v.id"
                class="p-4"
              >
                <button
                  type="button"
                  class="block w-full text-left"
                  @click="bukaVisit(v)"
                >
                  <b class="text-highlighted">{{ v.title || 'Event Activity' }}</b>
                  <span class="block text-xs text-muted">{{ undangan(v) }}</span>
                  <span
                    class="block text-xs"
                    :class="lewat(v) ? 'font-semibold text-error' : 'text-muted'"
                  >{{ relTgl(v) }}{{ v.time ? ` - ${v.time}` : '' }} · {{ namaBrand(v.brand) }}{{ v.location ? ` · ${v.location}` : '' }}</span>
                </button>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <USelect
                    v-if="can('kol')"
                    :model-value="v.status || 'planned'"
                    :items="opsiStatusV"
                    size="sm"
                    class="w-40"
                    @update:model-value="setStatus(v, $event as string)"
                  />
                  <template v-if="hariH(v) && can('kol')">
                    <UButton
                      label="Hadir"
                      icon="i-lucide-check"
                      size="xs"
                      @click="setStatus(v, 'came')"
                    />
                    <UButton
                      icon="i-lucide-x"
                      size="xs"
                      color="neutral"
                      variant="outline"
                      aria-label="Tandai tidak hadir"
                      @click="setStatus(v, 'noshow')"
                    />
                  </template>
                </div>
              </li>
            </ul>
            <KontenPager
              v-model:hal="halV"
              v-model:per="perV"
              :total="listV.length"
              satuan="event"
            />
          </template>
        </AppPanel>
      </template>

      <KontenKolForm
        v-model:open="kolBuka"
        :kol="kolItem"
      />
      <KontenVisitForm
        v-model:open="visitBuka"
        :visit="visitItem"
      />

      <UModal
        :open="!!gambar"
        :title="gambar?.judul"
        @update:open="gambar = $event ? gambar : null"
      >
        <template #body>
          <img
            v-if="gambar"
            :src="gambar.src"
            alt="Rate card"
            class="mx-auto max-w-full rounded-lg"
          >
        </template>
      </UModal>
      <ResponsiveSheet
        :open="!!riwayat"
        :title="`Riwayat starting price - ${riwayat?.name ?? ''}`"
        @update:open="riwayat = $event ? riwayat : null"
      >
        <p class="mb-2 text-xs text-muted">
          Berlaku sekarang: <b class="num text-default">{{ riwayat?.rateValue ? rupiah(riwayat.rateValue) : '-' }}</b>
        </p>
        <div
          v-for="(e, i) in riwayat?.rateHistory ?? []"
          :key="i"
          class="border-b border-default py-2 text-sm last:border-0"
        >
          <p class="num font-semibold">
            {{ rupiah(e.value) }}
            <span
              class="text-xs"
              :class="!e.prev ? 'text-muted' : rateDelta(e) > 0 ? 'text-error' : 'text-success'"
            >{{ !e.prev ? 'ditetapkan' : `${rateDelta(e) > 0 ? '▲' : '▼'} ${rupiah(Math.abs(rateDelta(e)))}` }}</span>
          </p>
          <p class="text-xs text-muted">
            {{ e.prev ? `sebelumnya ${rupiah(e.prev)} - ` : '' }}{{ waktu(e.at) }}{{ e.by ? ` - ${namaUser(e.by)}` : '' }}
          </p>
        </div>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
