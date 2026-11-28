<!--
  Konten › Pertumbuhan Akun (deploy/konten/analytics/index.html #tumbuh).
  Follower & activity per day from GET /analytics/growth, compared with the
  previous period, plus Instagram follower demographics (age, gender, city).
  Instagram: daily account insights (follower_baru only for the last 30 days).
  TikTok: a snapshot of follower & total likes per sync, so growth = the
  difference between snapshots.
-->
<script setup lang="ts">
import type { DataTumbuh, HarianAkun, BarisDemografi } from '~/composables/useCampaign'
import type { SeriTren } from '~/components/KontenGrafikTren.vue'

definePageMeta({ access: ['konten', 'campaign'] })

const route = useRoute()
const toast = useToast()
const demo = computed(() => import.meta.dev && route.query.demo === '1')

const platform = ref<'instagram' | 'tiktok'>('instagram')
const hari = ref(30)
const kelompok = ref<'hari' | 'minggu' | 'bulan'>('hari')
const mode = ref<'garis' | 'batang' | 'angka'>('garis')
const metrik = ref<string[]>(['views', 'reach', 'interaksi'])
const iklanTampil = ref(true)

const data = ref<DataTumbuh | null>(null)
const memuat = ref(false)
const galat = ref('')
const sinkron = ref(false)

function wib(offset = 0) {
  return new Date(Date.now() + 7 * 3600000 + offset * 86400000).toISOString().slice(0, 10)
}

function dataDemo(n: number): DataTumbuh {
  const harian: HarianAkun[] = []
  let fIg = 18200, fTt = 9400, lk = 210000
  for (let i = n * 2; i >= 0; i--) {
    const tgl = wib(-i)
    const s = Math.sin(i / 3) + 1.3
    const baru = Math.round(25 + s * 30 + (i % 7 === 5 ? 60 : 0))
    fIg += baru
    fTt += Math.round(12 + s * 15)
    lk += Math.round(900 + s * 700)
    harian.push({ platform: 'instagram', tgl, follower: fIg, follower_baru: i <= 30 ? baru : null, views: Math.round(9000 + s * 6000), reach: Math.round(5200 + s * 3100), likes: Math.round(420 + s * 200), comments: Math.round(30 + s * 20), shares: Math.round(20 + s * 15), saves: Math.round(25 + s * 10), interaksi: Math.round(520 + s * 260), likes_total: null, jml_post: null })
    harian.push({ platform: 'tiktok', tgl, follower: fTt, follower_baru: null, views: null, reach: null, likes: null, comments: null, shares: null, saves: null, interaksi: null, likes_total: lk, jml_post: 180 })
  }
  return {
    hari: n, kini: wib(0), harian, iklanAda: true,
    iklan: Array.from({ length: n * 2 }, (_, i) => ({ tgl: wib(-i), spend: i % 9 < 5 ? 75000 + (i % 4) * 20000 : 0, impresi: 12000, reach: 8000, klik: 120, video_view: 3000, interaksi: 400, chat: 6 })),
    akun: { instagram: { nama: 'laksamanamuda.id', follower: fIg, syncAt: Date.now() }, tiktok: { nama: 'laksamanamuda', follower: fTt, syncAt: Date.now() } },
    demografi: {
      at: Date.now(),
      umur: [{ label: '18-24', n: 7400 }, { label: '25-34', n: 6900 }, { label: '35-44', n: 2100 }, { label: '13-17', n: 900 }, { label: '45-54', n: 600 }, { label: '55-64', n: 180 }, { label: '65+', n: 60 }],
      gender: [{ label: 'F', n: 10400 }, { label: 'M', n: 7300 }, { label: 'U', n: 400 }],
      kota: [{ label: 'Pekanbaru, Riau', n: 11200 }, { label: 'Jakarta', n: 1300 }, { label: 'Kampar, Riau', n: 900 }, { label: 'Dumai, Riau', n: 480 }, { label: 'Medan', n: 400 }, { label: 'Padang', n: 350 }],
      negara: [{ label: 'ID', n: 17800 }, { label: 'MY', n: 160 }, { label: 'SG', n: 90 }],
    },
  }
}

let reqId = 0
async function muat() {
  const id = ++reqId
  memuat.value = true
  galat.value = ''
  try {
    const d = demo.value ? dataDemo(hari.value) : (await getTumbuh(hari.value)).data
    if (id === reqId) data.value = d
  }
  catch (e) {
    if (id === reqId) galat.value = apiErrorMessage(e)
  }
  finally {
    if (id === reqId) memuat.value = false
  }
}
onMounted(muat)
watch([hari, demo], muat)

async function sinkronkan() {
  if (demo.value) return
  sinkron.value = true
  try {
    for (const p of ['instagram', 'tiktok'] as const) {
      if (data.value?.akun[p]) await oauthSinkronCampaign(p).catch(() => {})
    }
    await muat()
    toast.add({ title: 'Data akun diperbarui', color: 'success' })
  }
  finally {
    sinkron.value = false
  }
}

// ---- rows of the chosen platform, split into this period and the one before
const batas = computed(() => wib(-hari.value))
const semua = computed(() => (data.value?.harian ?? []).filter(r => r.platform === platform.value).sort((a, b) => a.tgl.localeCompare(b.tgl)))
const kini = computed(() => semua.value.filter(r => r.tgl > batas.value))
const lalu = computed(() => semua.value.filter(r => r.tgl <= batas.value))

const jumlah = (rows: HarianAkun[], k: keyof HarianAkun) => {
  const v = rows.map(r => r[k]).filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) : null
}
const akhir = (rows: HarianAkun[], k: keyof HarianAkun) => {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i]![k]
    if (typeof v === 'number') return v
  }
  return null
}
const awal = (rows: HarianAkun[], k: keyof HarianAkun) => {
  for (const r of rows) {
    const v = r[k]
    if (typeof v === 'number') return v
  }
  return null
}
/** Growth of a running total (follower, total likes) inside a set of rows. */
const naik = (rows: HarianAkun[], k: keyof HarianAkun) => {
  const a = awal(rows, k), b = akhir(rows, k)
  return a == null || b == null ? null : b - a
}
const fmt = (n: number | null | undefined) => n == null ? '–' : n.toLocaleString('id-ID')
const selisih = (a: number | null, b: number | null) => {
  if (a == null || b == null || b === 0) return undefined
  const p = (a - b) / Math.abs(b) * 100
  return `${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
}
const nadaSelisih = (a: number | null, b: number | null) => a == null || b == null ? 'neutral' : a >= b ? 'success' : 'error'

const followerSekarang = computed(() => data.value?.akun[platform.value]?.follower ?? akhir(semua.value, 'follower'))
const kenaikan = computed(() => naik(kini.value, 'follower'))
const kenaikanLalu = computed(() => naik(lalu.value, 'follower'))

interface Kartu { label: string, value: string, icon: string, sub?: string, a: number | null, b: number | null }
const kartu = computed<Kartu[]>(() => {
  const k = kini.value, l = lalu.value
  const f: Kartu = { label: 'Follower', value: fmt(followerSekarang.value), icon: 'i-lucide-users', sub: kenaikan.value == null ? 'Belum ada potret' : `${kenaikan.value >= 0 ? '+' : ''}${fmt(kenaikan.value)} dalam ${hari.value} hari`, a: null, b: null }
  const kn: Kartu = { label: 'Kenaikan follower', value: kenaikan.value == null ? '–' : `${kenaikan.value >= 0 ? '+' : ''}${fmt(kenaikan.value)}`, icon: 'i-lucide-user-plus', sub: `per hari ± ${fmt(kenaikan.value == null ? null : Math.round(kenaikan.value / hari.value))}`, a: kenaikan.value, b: kenaikanLalu.value }
  if (platform.value === 'tiktok') {
    const lk = naik(k, 'likes_total'), lkL = naik(l, 'likes_total')
    return [f, kn,
      { label: 'Total likes akun', value: fmt(akhir(semua.value, 'likes_total')), icon: 'i-lucide-heart', sub: 'Akumulasi semua video', a: null, b: null },
      { label: 'Likes baru', value: lk == null ? '–' : `+${fmt(lk)}`, icon: 'i-lucide-heart-plus', a: lk, b: lkL }]
  }
  return [f, kn,
    { label: 'Views', value: fmt(jumlah(k, 'views')), icon: 'i-lucide-eye', a: jumlah(k, 'views'), b: jumlah(l, 'views') },
    { label: 'Reach', value: fmt(jumlah(k, 'reach')), icon: 'i-lucide-radio-tower', a: jumlah(k, 'reach'), b: jumlah(l, 'reach') },
    { label: 'Interaksi', value: fmt(jumlah(k, 'interaksi')), icon: 'i-lucide-messages-square', a: jumlah(k, 'interaksi'), b: jumlah(l, 'interaksi') },
    { label: 'Follower baru', value: fmt(jumlah(k, 'follower_baru')), icon: 'i-lucide-sparkles', sub: 'Maks. 30 hari terakhir', a: jumlah(k, 'follower_baru'), b: jumlah(l, 'follower_baru') }]
})

// ---- grouping per day / week / month
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
function kunci(tgl: string) {
  if (kelompok.value === 'bulan') return tgl.slice(0, 7)
  if (kelompok.value === 'minggu') {
    const d = new Date(tgl + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  }
  return tgl
}
function label(k: string) {
  if (kelompok.value === 'bulan') return `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`
  return `${Number(k.slice(8, 10))} ${BULAN[Number(k.slice(5, 7)) - 1]}`
}
const kunciUrut = computed(() => [...new Set(kini.value.map(r => kunci(r.tgl)))])
const kategori = computed(() => kunciUrut.value.map(k => (kelompok.value === 'minggu' ? 'Mg ' : '') + label(k)))
function deret(k: keyof HarianAkun, cara: 'jumlah' | 'akhir'): (number | null)[] {
  return kunciUrut.value.map((g) => {
    const rows = kini.value.filter(r => kunci(r.tgl) === g)
    return cara === 'akhir' ? akhir(rows, k) : jumlah(rows, k)
  })
}

const seriFollower = computed<SeriTren[]>(() => [{ nama: 'Follower', warna: 'var(--color-gold)', nilai: deret('follower', 'akhir') }])

const METRIK = [
  { value: 'views', label: 'Views', warna: 'var(--color-gold)' },
  { value: 'reach', label: 'Reach', warna: 'var(--ui-info)' },
  { value: 'interaksi', label: 'Interaksi', warna: 'var(--ui-success)' },
  { value: 'likes', label: 'Likes', warna: 'var(--color-vip)' },
  { value: 'comments', label: 'Komentar', warna: 'var(--color-brand-teal)' },
  { value: 'shares', label: 'Share', warna: 'var(--color-gold-deep)' },
  { value: 'saves', label: 'Saves', warna: 'var(--color-moss-dark)' },
  { value: 'follower_baru', label: 'Follower baru', warna: 'var(--ui-error)' },
]
const seriAktivitas = computed<SeriTren[]>(() => METRIK.filter(m => metrik.value.includes(m.value))
  .map(m => ({ nama: m.label, warna: m.warna, nilai: deret(m.value as keyof HarianAkun, 'jumlah') })))

const seriTiktok = computed<SeriTren[]>(() => {
  const nilai = deret('likes_total', 'akhir')
  return [{ nama: 'Total likes akun', warna: 'var(--color-vip)', nilai }]
})

const seriIklan = computed<SeriTren[]>(() => {
  const iklan = data.value?.iklan ?? []
  return [{ nama: 'Biaya iklan', warna: 'var(--ui-error)', nilai: kunciUrut.value.map((g) => {
    const v = iklan.filter(r => r.tgl > batas.value && kunci(r.tgl) === g).map(r => Number(r.spend))
    return v.length ? v.reduce((a, b) => a + b, 0) : null
  }) }]
})
const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

// ---- demographics (Instagram)
const demografi = computed(() => data.value?.demografi)
const totalDemo = (r: BarisDemografi[]) => r.reduce((a, b) => a + b.n, 0) || 1
const UMUR_URUT = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']
const umur = computed(() => [...(demografi.value?.umur ?? [])].sort((a, b) => UMUR_URUT.indexOf(a.label) - UMUR_URUT.indexOf(b.label)))
const NAMA_GENDER: Record<string, string> = { F: 'Perempuan', M: 'Laki-laki', U: 'Tidak disebut' }
const WARNA_GENDER: Record<string, string> = { F: 'var(--color-vip)', M: 'var(--ui-info)', U: 'var(--ui-text-dimmed)' }
const gender = computed(() => {
  const r = demografi.value?.gender ?? []
  const t = totalDemo(r)
  let jalan = 0
  return r.map((g) => {
    const p = g.n / t * 100
    const out = { ...g, nama: NAMA_GENDER[g.label] || g.label, warna: WARNA_GENDER[g.label] || 'var(--color-gold)', persen: p, mulai: jalan }
    jalan += p
    return out
  })
})
const persen = (n: number, r: BarisDemografi[]) => (n / totalDemo(r) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const umurTerbanyak = computed(() => [...umur.value].sort((a, b) => b.n - a.n)[0])

const rincianBuka = ref(false)
const rincian = computed(() => [...kini.value].reverse())
</script>

<template>
  <AppPage
    title="Pertumbuhan Akun"
    description="Kenaikan follower, views, reach & interaksi — plus siapa follower-mu"
  >
    <template #actions>
      <UButton
        label="Sinkronkan"
        icon="i-lucide-refresh-cw"
        color="primary"
        :loading="sinkron"
        :disabled="memuat"
        @click="sinkronkan"
      />
    </template>

    <div class="space-y-4">
      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <AppSeg
            v-model="platform"
            :options="[{ value: 'instagram', label: 'Instagram', icon: 'i-lucide-instagram' }, { value: 'tiktok', label: 'TikTok', icon: 'i-lucide-music-2' }]"
          />
          <AppSeg
            v-model="hari"
            :options="[{ value: 7, label: '7 hari' }, { value: 30, label: '30 hari' }, { value: 90, label: '90 hari' }, { value: 180, label: '6 bulan' }, { value: 365, label: '1 tahun' }]"
          />
          <AppSeg
            v-model="kelompok"
            :options="[{ value: 'hari', label: 'Harian' }, { value: 'minggu', label: 'Mingguan' }, { value: 'bulan', label: 'Bulanan' }]"
          />
          <AppSeg
            v-model="mode"
            class="ml-auto"
            :options="[{ value: 'garis', label: 'Garis', icon: 'i-lucide-chart-line' }, { value: 'batang', label: 'Batang', icon: 'i-lucide-chart-column' }, { value: 'angka', label: 'Angka', icon: 'i-lucide-table' }]"
          />
        </div>
      </AppPanel>

      <UAlert
        v-if="galat"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Data pertumbuhan tidak bisa dimuat: ${galat}`"
      >
        <template #actions>
          <UButton
            label="Coba lagi"
            color="neutral"
            variant="outline"
            size="xs"
            @click="muat"
          />
        </template>
      </UAlert>

      <AppStatGrid
        :loading="memuat && !data"
        :count="platform === 'tiktok' ? 4 : 6"
        satu-baris
      >
        <AppStat
          v-for="k in kartu"
          :key="k.label"
          :label="k.label"
          :value="k.value"
          :icon="k.icon"
          :sub="k.sub"
          :badge="selisih(k.a, k.b)"
          :badge-tone="nadaSelisih(k.a, k.b)"
        />
      </AppStatGrid>

      <div
        class="grid gap-4 transition-opacity"
        :class="memuat ? 'pointer-events-none opacity-60' : ''"
      >
        <AppPanel
          title="Jumlah follower"
          :description="platform === 'tiktok' ? 'Dipotret tiap sinkron — TikTok tidak memberi data harian, jadi grafik terisi sejak fitur ini aktif.' : 'Follower akun per hari.'"
        >
          <p
            v-if="!kunciUrut.length && !memuat"
            class="py-8 text-center text-sm text-muted"
          >
            Belum ada data pada periode ini. Tekan Sinkronkan.
          </p>
          <KontenGrafikTren
            v-else
            :kategori="kategori"
            :seri="seriFollower"
            :mode="mode"
            :nol="false"
          />
        </AppPanel>

        <AppPanel
          v-if="platform === 'instagram'"
          title="Aktivitas akun"
          description="Pilih angka yang ingin dibandingkan. Angka organik dari Instagram — interaksi dari iklan tidak ikut."
        >
          <div class="mb-4 flex flex-wrap gap-2">
            <UButton
              v-for="m in METRIK"
              :key="m.value"
              :label="m.label"
              size="xs"
              :color="metrik.includes(m.value) ? 'primary' : 'neutral'"
              :variant="metrik.includes(m.value) ? 'soft' : 'outline'"
              @click="metrik = metrik.includes(m.value) ? metrik.filter(x => x !== m.value) : [...metrik, m.value]"
            />
          </div>
          <KontenGrafikTren
            v-if="seriAktivitas.length && kunciUrut.length"
            :kategori="kategori"
            :seri="seriAktivitas"
            :mode="mode"
          />
          <p
            v-else
            class="py-8 text-center text-sm text-muted"
          >
            Pilih minimal satu angka.
          </p>
        </AppPanel>

        <AppPanel
          v-else
          title="Total likes akun"
          description="Akumulasi likes semua video, dipotret tiap sinkron."
        >
          <KontenGrafikTren
            :kategori="kategori"
            :seri="seriTiktok"
            :mode="mode"
            :nol="false"
          />
        </AppPanel>

        <AppPanel
          v-if="data?.iklanAda"
          title="Biaya iklan Meta"
          description="Belanja iklan per periode — bandingkan dengan kenaikan di atas untuk melihat pengaruh iklan."
        >
          <template #actions>
            <USwitch
              v-model="iklanTampil"
              label="Tampilkan"
            />
          </template>
          <KontenGrafikTren
            v-if="iklanTampil"
            :kategori="kategori"
            :seri="seriIklan"
            :mode="mode === 'garis' ? 'batang' : mode"
            :format="rupiah"
            :tinggi="160"
          />
        </AppPanel>

        <template v-if="platform === 'instagram'">
          <AppSectionTitle title="Siapa follower-mu" />
          <p class="-mt-2 text-sm text-muted">
            {{ demografi?.at ? `Data Instagram, diperbarui ${new Date(demografi.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Data Instagram' }}
          </p>
          <UAlert
            v-if="!umur.length && !gender.length"
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            :title="demografi?.galat ? `Instagram belum memberi data demografi: ${demografi.galat}` : 'Data demografi muncul setelah sinkron Instagram berikutnya (akun minimal 100 follower).'"
          />
          <div
            v-else
            class="grid gap-4 lg:grid-cols-3"
          >
            <AppPanel
              title="Umur"
              :description="umurTerbanyak ? `Terbanyak ${umurTerbanyak.label} tahun` : undefined"
            >
              <div class="space-y-2.5">
                <div
                  v-for="u in umur"
                  :key="u.label"
                  class="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 text-sm"
                >
                  <span class="text-muted">{{ u.label }}</span>
                  <span class="h-2.5 overflow-hidden rounded-full bg-elevated">
                    <span
                      class="block h-full rounded-full bg-primary"
                      :style="{ width: (u.n / (umurTerbanyak?.n || 1) * 100) + '%' }"
                    />
                  </span>
                  <b class="text-right tabular-nums">{{ persen(u.n, umur) }}</b>
                </div>
              </div>
            </AppPanel>
            <AppPanel title="Gender">
              <div class="flex flex-wrap items-center gap-6">
                <svg
                  viewBox="0 0 42 42"
                  class="size-36 -rotate-90"
                  role="img"
                  aria-label="Gender follower"
                >
                  <circle
                    v-for="g in gender"
                    :key="g.label"
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    :stroke="g.warna"
                    stroke-width="7"
                    :stroke-dasharray="`${g.persen} ${100 - g.persen}`"
                    :stroke-dashoffset="-g.mulai"
                  />
                </svg>
                <div class="space-y-2 text-sm">
                  <div
                    v-for="g in gender"
                    :key="g.label"
                    class="flex items-center gap-2"
                  >
                    <i
                      class="inline-block size-2.5 rounded-full"
                      :style="{ background: g.warna }"
                    />
                    <span>{{ g.nama }}</span>
                    <b class="tabular-nums">{{ g.persen.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}%</b>
                  </div>
                </div>
              </div>
            </AppPanel>
            <AppPanel title="Kota teratas">
              <ol class="space-y-2 text-sm">
                <li
                  v-for="(k, i) in demografi?.kota ?? []"
                  :key="k.label"
                  class="flex items-center gap-2"
                >
                  <span class="w-5 text-muted tabular-nums">{{ i + 1 }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ k.label }}</span>
                  <b class="tabular-nums">{{ persen(k.n, demografi?.kota ?? []) }}</b>
                </li>
              </ol>
            </AppPanel>
          </div>
        </template>

        <AppPanel
          title="Rincian per hari"
          :count="rincian.length"
        >
          <template #actions>
            <UButton
              :label="rincianBuka ? 'Tutup' : 'Lihat'"
              :icon="rincianBuka ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="rincianBuka = !rincianBuka"
            />
          </template>
          <div
            v-if="rincianBuka"
            class="overflow-x-auto"
          >
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-muted">
                  <th class="py-2 pr-3 font-medium">
                    Tanggal
                  </th>
                  <th class="py-2 pr-3 text-right font-medium">
                    Follower
                  </th>
                  <template v-if="platform === 'instagram'">
                    <th
                      v-for="m in METRIK"
                      :key="m.value"
                      class="py-2 pr-3 text-right font-medium"
                    >
                      {{ m.label }}
                    </th>
                  </template>
                  <th
                    v-else
                    class="py-2 pr-3 text-right font-medium"
                  >
                    Total likes
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in rincian"
                  :key="r.tgl"
                  class="border-t border-default"
                >
                  <td class="py-1.5 pr-3 whitespace-nowrap">
                    {{ label(r.tgl) }} {{ r.tgl.slice(0, 4) }}
                  </td>
                  <td class="py-1.5 pr-3 text-right tabular-nums">
                    {{ fmt(r.follower) }}
                  </td>
                  <template v-if="platform === 'instagram'">
                    <td
                      v-for="m in METRIK"
                      :key="m.value"
                      class="py-1.5 pr-3 text-right tabular-nums"
                    >
                      {{ fmt(r[m.value as keyof HarianAkun] as number | null) }}
                    </td>
                  </template>
                  <td
                    v-else
                    class="py-1.5 pr-3 text-right tabular-nums"
                  >
                    {{ fmt(r.likes_total) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </AppPanel>
      </div>
    </div>
  </AppPage>
</template>
