<!--
  Konten › Insight Konten (deploy/konten/analytics/index.html #insight;
  #133). Akun terhubung (TikTok/Instagram/YouTube-segera), Konten terpopuler
  (satu halaman server + detail 9 angka), Insight otomatis AI, daftar insight.
-->
<script setup lang="ts">
import type { AkunCampaign, BarisTop, InsightCampaign, InsightInput, IgCommentPost } from '~/composables/useCampaign'

definePageMeta({ access: ['konten', 'campaign'] })

const route = useRoute()
const demo = computed(() => import.meta.dev && route.query.demo === '1')
const toast = useToast()
const { data: st, error, refresh } = useStateCampaign()

// OAuth landing (?tiktok=ok|gagal&pesan=…#insight, like legacy).
const pitaOauth = ref('')
onMounted(() => {
  const q = route.query
  if (q.tiktok === 'ok' || q.instagram === 'ok') {
    pitaOauth.value = 'Akun terhubung. Sinkron pertama sudah berjalan.'
    refresh()
  }
  else if (q.tiktok === 'gagal' || q.instagram === 'gagal') {
    pitaOauth.value = `Gagal menghubungkan: ${q.pesan || 'coba lagi dari tombol Hubungkan.'}`
  }
})

// Auto-sync diam-diam bila sinkron terakhir > 6 jam (like legacy).
onMounted(async () => {
  if (demo.value) return
  await nextTick()
  const akun = st.value?.akun ?? []
  for (const a of akun) {
    if (!a.terhubung || Date.now() - (a.sync_at || 0) <= 6 * 3600 * 1000) continue
    if (a.platform !== 'tiktok' && a.platform !== 'instagram') continue
    await oauthSinkronCampaign(a.platform as 'tiktok' | 'instagram').catch(() => {})
  }
  refresh()
})

const sinkronJalan = ref('')
async function sinkronkan(provider: 'tiktok' | 'instagram') {
  if (demo.value) return
  sinkronJalan.value = provider
  try {
    await oauthSinkronCampaign(provider)
    toast.add({ title: 'Sinkron selesai.', color: 'success' })
    await refresh()
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
  sinkronJalan.value = ''
}

async function hubungkan(provider: 'tiktok' | 'instagram') {
  if (demo.value) return
  try {
    const r = await oauthMulaiCampaign(provider)
    navigateTo(r.data.url, { external: true })
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
}

async function putuskan(a: { platform: string, nama: string }) {
  if (demo.value) return
  if (!confirm(`Putuskan akun ${a.platform}? Postingan yang sudah ditarik tetap tersimpan; sinkron otomatis berhenti sampai dihubungkan lagi.`)) return
  const ok = await campaignSimpan(
    () => oauthPutusCampaign(a.platform as 'tiktok' | 'instagram'), 'Akun diputus.')
  if (ok) refresh()
}

const igPosts = ref<IgCommentPost[] | null>(null)
const igLoading = ref(false)
const igError = ref('')
const igReply = ref<Record<string, string>>({})
async function muatKomentar() {
  igLoading.value = true
  igError.value = ''
  try {
    igPosts.value = (await getIgComments()).data.posts
  }
  catch (e) { igError.value = apiErrorMessage(e) }
  finally { igLoading.value = false }
}
async function ubahKomentar(id: string, aksi: 'reply' | 'hide' | 'delete', hidden = false) {
  if (demo.value) return
  if (aksi === 'delete' && !confirm('Hapus komentar ini dari Instagram?')) return
  if (aksi === 'reply' && !igReply.value[id]?.trim()) return
  igLoading.value = true
  try {
    if (aksi === 'reply') await replyIgComment(id, igReply.value[id]!.trim())
    else if (aksi === 'hide') await hideIgComment(id, !hidden)
    else await deleteIgComment(id)
    igReply.value[id] = ''
    await muatKomentar()
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
  finally { igLoading.value = false }
}

// ---------------------------------------------------------------- top
const platTop = ref<string[]>([])
const cariTop = ref('')
const urutTop = ref<'views' | 'likes' | 'comments' | 'shares' | 'er'>('views')
const labelMetrik = { views: 'Views', likes: 'Likes', comments: 'Komentar', shares: 'Share', er: 'Engagement rate' }
const nilaiMetrik = (b: BarisTop) => b[urutTop.value]
const rentangTop = ref('30 hari')
const dariTop = ref('')
const sampaiTop = ref('')
const halTop = ref(1)
const perTop = ref(10)
const semuaTop = ref<BarisTop[] | null>(null)
const sebelumnya = ref<BarisTop[] | null>(null)
const modeGrafik = ref('batang')
const intervalGrafik = ref('hari')
const titikDipilih = ref('')
const cocokFilter = (b: BarisTop) => (!platTop.value.length || platTop.value.includes(b.platform)) && (!cariTop.value.trim() || b.judul.toLocaleLowerCase().includes(cariTop.value.trim().toLocaleLowerCase()))
const terfilter = computed(() => (semuaTop.value ?? []).filter(cocokFilter))
const kpi = [{ label: 'Postingan', icon: 'i-lucide-files' }, { label: 'Total views', icon: 'i-lucide-eye' }, { label: 'Interaksi', icon: 'i-lucide-heart' }, { label: 'Rata-rata ER', icon: 'i-lucide-percent' }, { label: 'Postingan terbaik', icon: 'i-lucide-trophy' }]
const postinganTerbaik = computed(() => terfilter.value.reduce<BarisTop | undefined>((best, row) => {
  const nilai = nilaiMetrik(row)
  return nilai != null && (!best || nilai > (nilaiMetrik(best) ?? -1)) ? row : best
}, undefined))
function metrik(rows: BarisTop[]) {
  const views = rows.reduce((n, b) => n + b.views, 0)
  const interaksi = rows.reduce((n, b) => n + b.likes + b.comments + b.shares, 0)
  const er = rows.flatMap(b => b.er == null ? [] : [b.er])
  const terbaik = rows.reduce<number | null>((max, row) => {
    const nilai = nilaiMetrik(row)
    return nilai == null ? max : Math.max(max ?? nilai, nilai)
  }, null)
  return [rows.length, views, interaksi, er.length ? er.reduce((a, b) => a + b, 0) * 100 / er.length : null, terbaik]
}
const nilaiKpi = computed(() => metrik(terfilter.value))
function formatKpi(n: number | null | undefined, i: number) {
  return n == null ? '—' : i === 3 || (i === 4 && urutTop.value === 'er') ? (n * (i === 4 ? 100 : 1)).toFixed(1) + '%' : Math.round(n).toLocaleString('id-ID')
}
function bandingKpi(i: number) {
  if (!sebelumnya.value) return 'Periode pembanding tidak tersedia'
  const lalu = metrik(sebelumnya.value.filter(cocokFilter))[i], kini = nilaiKpi.value[i]
  if (lalu == null || kini == null) return 'Tidak cukup data pembanding'
  if (!lalu) return kini ? 'Periode sebelumnya: 0' : 'Sama dengan periode sebelumnya'
  const beda = (kini - lalu) / lalu * 100
  return (beda > 0 ? '+' : '') + beda.toFixed(1) + '% dibanding periode sebelumnya'
}
function kelompokTanggal(tanggal: string) {
  const d = new Date(tanggal.slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return ''
  if (intervalGrafik.value === 'bulan') return tanggal.slice(0, 7)
  if (intervalGrafik.value === 'minggu') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
  return d.toISOString().slice(0, 10)
}
const warnaPlatform: Record<string, string> = { TikTok: 'text-gold', Instagram: 'text-info', YouTube: 'text-success' }
// Colour tags so lists scan at a glance.
const tagPlatform: Record<string, string> = {
  TikTok: 'bg-neutral-900 text-white',
  Instagram: 'bg-pink-100 text-pink-800',
  YouTube: 'bg-red-100 text-red-800',
}
const TAG_PUTAR = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
]
const tagKategori = (k?: string) => TAG_PUTAR[[...(k ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_PUTAR.length]
const tagEr = (er: number | null) => er == null
  ? 'bg-muted text-muted'
  : er >= 0.08
    ? 'bg-emerald-100 text-emerald-800'
    : er >= 0.03
      ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-800'
const tren = computed(() => {
  const groups = new Map<string, Map<string, number[]>>()
  for (const row of terfilter.value) {
    const key = kelompokTanggal(row.tanggal)
    const value = nilaiMetrik(row)
    if (!key || value == null) continue
    if (!groups.has(key)) groups.set(key, new Map())
    const group = groups.get(key)!
    group.set(row.platform, [...(group.get(row.platform) ?? []), value])
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({ key, values: Object.fromEntries([...group].map(([platform, values]) => [platform, values.reduce((a, b) => a + b, 0) * (urutTop.value === 'er' ? 100 / values.length : 1)])) }))
})
const trenPlatform = computed(() => [...new Set(terfilter.value.map(row => row.platform))].sort())
const maxTren = computed(() => Math.max(1, ...tren.value.flatMap(t => Object.values(t.values))))
const formatTren = (value: number) => urutTop.value === 'er' ? value.toFixed(1) + '%' : Math.round(value).toLocaleString('id-ID')
const xTren = (i: number) => 40 + i * 80
const yTren = (value: number) => 155 - value / maxTren.value * 135
const platformShare = computed(() => {
  const groups = new Map<string, number>()
  for (const b of terfilter.value) groups.set(b.platform, (groups.get(b.platform) ?? 0) + b.views)
  let offset = 0
  const total = [...groups.values()].reduce((a, b) => a + b, 0)
  return [...groups].map(([name, value], i) => {
    const percent = total ? value / total * 100 : 0
    const item = { name, value, percent, offset, color: ['text-gold', 'text-info', 'text-success', 'text-muted'][i % 4] }
    offset += percent
    return item
  })
})
const hariShare = computed(() => {
  const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(label => ({ label, count: 0, views: 0 }))
  for (const b of terfilter.value) {
    const d = new Date(b.tanggal.slice(0, 10) + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) continue
    const baris = hari[d.getUTCDay()]!
    baris.count++
    baris.views += b.views
  }
  return [...hari.slice(1), hari[0]!].map(h => ({ ...h, rata: h.count ? Math.round(h.views / h.count) : null }))
})
const maxRataHari = computed(() => hariShare.value.reduce((max, h) => Math.max(max, h.rata ?? 0), 1))
let topRequest = 0
const top = computed(() => {
  if (!semuaTop.value) return null
  const baris = terfilter.value.filter(b => !titikDipilih.value || kelompokTanggal(b.tanggal) === titikDipilih.value)
    .sort((a, b) => (nilaiMetrik(b) ?? -1) - (nilaiMetrik(a) ?? -1))
  return { baris: baris.slice((halTop.value - 1) * perTop.value, halTop.value * perTop.value), total: baris.length, hal: halTop.value, halMaks: Math.max(1, Math.ceil(baris.length / perTop.value)) }
})
const topGalat = ref('')
const topJalan = ref(false)

function rentangTopHitung(): { dari?: string, sampai?: string } {
  const hari = (n: number) => {
    const d = new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000)
    return d.toISOString().slice(0, 10) // UTC on purpose: shifted +7 h above = WIB day
  }
  if (rentangTop.value === '7 hari') return { dari: hari(6), sampai: hari(0) }
  if (rentangTop.value === '30 hari') return { dari: hari(29), sampai: hari(0) }
  if (rentangTop.value === '90 hari') return { dari: hari(89), sampai: hari(0) }
  if (rentangTop.value === 'Bulan ini') return { dari: hari(0).slice(0, 7) + '-01' }
  if (rentangTop.value === 'Tahun ini') return { dari: hari(0).slice(0, 4) + '-01-01' }
  if (rentangTop.value === 'Rentang…' && dariTop.value) return { dari: dariTop.value, sampai: sampaiTop.value || undefined }
  return {}
}

function rentangPembanding(range: { dari?: string, sampai?: string }) {
  if (!range.dari) return null
  const hari = 86400000
  const akhir = range.sampai || new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  const start = Date.parse(range.dari + 'T00:00:00Z')
  const end = Date.parse(akhir + 'T00:00:00Z')
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return {
    dari: new Date(start - (end - start + hari)).toISOString().slice(0, 10),
    sampai: new Date(start - hari).toISOString().slice(0, 10),
  }
}

async function muatTop() {
  const request = ++topRequest
  topJalan.value = true
  topGalat.value = ''
  sebelumnya.value = null
  titikDipilih.value = ''
  const range = rentangTopHitung()
  const pembanding = rentangPembanding(range)
  try {
    if (demo.value) {
      const platforms = ['TikTok', 'Instagram', 'YouTube']
      const sekarang = Date.now() + 7 * 3600000
      const daftar = Array.from({ length: 180 }, (_, i): BarisTop => ({
        platform: platforms[i % platforms.length]!, judul: 'Konten contoh ' + (i + 1),
        url: '', tanggal: new Date(sekarang - i * 86400000).toISOString().slice(0, 10), views: 12000 - i * 51, likes: 600 - i * 3,
        comments: 50, shares: 20, er: (670 - i * 3) / (12000 - i * 51),
        sumber: 'Demo', tercatat: false, rinci: {},
      }))
      const pilihRentang = ({ dari = '', sampai = '9999' }: typeof range) =>
        daftar.filter(row => row.tanggal >= dari && row.tanggal <= sampai)
      semuaTop.value = pilihRentang(range)
      sebelumnya.value = pembanding ? pilihRentang(pembanding) : null
    }
    else {
      const query = { ...range, urut: 'views', per: 50 }
      const first = (await getTopCampaign({ ...query, hal: 1 })).data
      const baris = [...first.baris]
      for (let hal = 2; hal <= first.halMaks; hal++) {
        if (request !== topRequest) return
        baris.push(...(await getTopCampaign({ ...query, hal })).data.baris)
      }
      if (request === topRequest) semuaTop.value = baris
      if (pembanding && request === topRequest) {
        const previousQuery = { ...query, ...pembanding }
        try {
          const firstPrevious = (await getTopCampaign({ ...previousQuery, hal: 1 })).data
          const previousRows = [...firstPrevious.baris]
          for (let hal = 2; hal <= firstPrevious.halMaks; hal++) {
            if (request !== topRequest) return
            previousRows.push(...(await getTopCampaign({ ...previousQuery, hal })).data.baris)
          }
          if (request === topRequest) sebelumnya.value = previousRows
        }
        catch { /* Keep current results when comparison fails. */ }
      }
    }
  }
  catch (e) {
    if (request === topRequest) {
      semuaTop.value = null
      topGalat.value = 'Konten terpopuler tidak bisa dimuat: ' + apiErrorMessage(e)
    }
  }
  finally {
    if (request === topRequest) topJalan.value = false
  }
}
onMounted(muatTop)
watch([rentangTop, dariTop, sampaiTop, demo], () => {
  halTop.value = 1
  muatTop()
})
watch([platTop, cariTop, urutTop, intervalGrafik], () => {
  titikDipilih.value = ''
  halTop.value = 1
}, { deep: true })
watch(perTop, () => {
  halTop.value = 1
})
watch(halTop, () => {
  detailBuka.value = -1
})

const detailBuka = ref(-1)
const KOTAK_RINCI = [
  ['reach', 'Reach'], ['impr', 'Impression'], ['views', 'Views'], ['likes', 'Likes'],
  ['comments', 'Comment'], ['shares', 'Share'], ['saves', 'Saves'], ['cta', 'Klik CTA'], ['follow', 'Follower Baru'],
] as const

// ---------------------------------------------------------------- insight AI + daftar
const usulan = ref<Record<string, unknown>[]>([])
const usulanJalan = ref(false)
// Evidence window for the AI (tayang date, WIB) + team pilar filter,
// same contract as Riset.
const usulanPeriode = ref('semua')
const usulanDari = ref('')
const usulanSampai = ref('')
const FOKUS_SEMUA = '— semua pilar —'
const usulanFokus = ref(FOKUS_SEMUA)
const opsiUsulanPeriode = [
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
  { value: 'rentang', label: 'Rentang…' },
  { value: 'semua', label: 'Semua' },
]
async function temukanInsight() {
  if (demo.value) return
  if (usulanPeriode.value === 'rentang' && (!usulanDari.value || !usulanSampai.value)) {
    toast.add({ title: 'Rentang tanggal wajib diisi (dari & sampai).', color: 'error' })
    return
  }
  usulanJalan.value = true
  try {
    const r = await usulanInsightCampaign({
      periode: usulanPeriode.value,
      dari: usulanPeriode.value === 'rentang' ? usulanDari.value : undefined,
      sampai: usulanPeriode.value === 'rentang' ? usulanSampai.value : undefined,
      fokus: usulanFokus.value === FOKUS_SEMUA ? undefined : usulanFokus.value,
    })
    usulan.value = r.data.usulan
    if (!usulan.value.length) toast.add({ title: 'AI tidak menemukan pola baru.', color: 'neutral' })
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
  usulanJalan.value = false
}

const saringPlat = ref('Semua')
const saringArsip = ref(false)
const saringKat = ref('Semua kategori')
const daftarInsight = computed(() => (st.value?.insight ?? []).filter(i =>
  (saringPlat.value === 'Semua' || i.platform === saringPlat.value)
  && (!!i.arsip === saringArsip.value)
  && (saringKat.value === 'Semua kategori' || i.kategori === saringKat.value)))

const formBuka = ref(false)
const formKosong = (): InsightInput => ({ platform: 'TikTok', kategori: '', temuan: '', url: '', tglTayang: '', metrik: '', aksi: '' })
const form = ref<InsightInput>(formKosong())
function bukaForm(i?: unknown) {
  const r = (i ?? {}) as Record<string, string | undefined>
  form.value = {
    id: r.id,
    platform: r.platform ?? 'TikTok',
    kategori: r.kategori ?? '',
    temuan: r.temuan ?? '',
    url: r.url ?? '',
    tglTayang: r.tglTayang ?? r.tgl_tayang ?? r.tanggal ?? '',
    metrik: r.metrik ?? '',
    aksi: r.aksi ?? '',
  }
  formBuka.value = true
}
async function simpanForm() {
  if (demo.value) return
  const v = form.value
  const versi = v.id
    ? (st.value?.insight.find(x => x.id === v.id)?.diubah_at ?? st.value?.insight.find(x => x.id === v.id)?.dibuat_at)
    : undefined
  const ok = await campaignSimpan(() => simpanInsightCampaign(v, versi), 'Insight disimpan.')
  if (ok) {
    formBuka.value = false
    refresh()
  }
}
async function arsipkan(i: InsightCampaign, arsip: boolean) {
  if (demo.value) return
  const ok = await campaignSimpan(() => arsipInsightCampaign(i.id, arsip), arsip ? 'Insight diarsipkan.' : 'Insight dipulihkan.')
  if (ok) refresh()
}
</script>

<template>
  <KontenGerbang lihat="insight">
    <AppPage
      title="Insight Konten"
      description="Postingan terpopuler, akun terhubung & insight per platform"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Analytics: ${apiErrorMessage(error)}`"
      />
      <UAlert
        v-if="pitaOauth"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="pitaOauth"
      />

      <div class="sticky top-0 z-10 mb-4 space-y-3 rounded-xl border border-default bg-default p-3">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="platform in ['TikTok', 'Instagram', 'YouTube']"
            :key="platform"
            size="sm"
            color="neutral"
            :variant="platTop.includes(platform) ? 'solid' : 'soft'"
            :aria-pressed="platTop.includes(platform)"
            @click="platTop = platTop.includes(platform) ? platTop.filter(p => p !== platform) : [...platTop, platform]"
          >
            {{ platform }}
          </UButton>
          <UInput
            v-model="cariTop"
            placeholder="Cari judul konten"
            icon="i-lucide-search"
          />
          <USelect
            v-model="urutTop"
            size="sm"
            aria-label="Metrik"
            :items="Object.entries(labelMetrik).map(([value, label]) => ({ value, label }))"
          />
          <USelect
            v-model="rentangTop"
            size="sm"
            aria-label="Periode"
            :items="['Semua waktu', '7 hari', '30 hari', '90 hari', 'Bulan ini', 'Tahun ini', 'Rentang…']"
          />
        </div>
        <div
          v-if="rentangTop === 'Rentang…'"
          class="mt-2 flex gap-2"
        >
          <AppTanggal
            v-model="dariTop"
          />
          <AppTanggal
            v-model="sampaiTop"
          />
        </div>
      </div>
      <AppStatGrid
        :loading="topJalan && !top"
        :count="5"
      >
        <AppStat
          v-for="(item, i) in kpi"
          :key="item.label"
          :label="item.label"
          :icon="item.icon"
          :value="formatKpi(nilaiKpi[i], i)"
          :sub="i === 4 && postinganTerbaik ? `${postinganTerbaik.judul} · ${bandingKpi(i)}` : bandingKpi(i)"
        />
      </AppStatGrid>
      <AppPanel
        :title="`Tren ${labelMetrik[urutTop]}`"
        description="Berdasarkan tanggal tayang. Pilih tanggal untuk menyaring daftar konten."
      >
        <div class="mb-4 flex flex-wrap gap-2">
          <AppSeg
            v-model="intervalGrafik"
            size="sm"
            :options="[{ value: 'hari', label: 'Hari' }, { value: 'minggu', label: 'Minggu' }, { value: 'bulan', label: 'Bulan' }]"
          />
          <AppSeg
            v-model="modeGrafik"
            size="sm"
            :options="[{ value: 'garis', label: 'Garis' }, { value: 'batang', label: 'Batang' }, { value: 'angka', label: 'Angka' }]"
          />
          <UButton
            v-if="titikDipilih"
            size="xs"
            color="neutral"
            variant="soft"
            @click="titikDipilih = ''; halTop = 1"
          >
            Hapus pilihan {{ titikDipilih }}
          </UButton>
        </div>
        <p
          v-if="!tren.length"
          class="text-sm text-muted"
        >
          Belum ada data bertanggal untuk ditampilkan.
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <div class="mb-3 flex flex-wrap gap-4 text-sm font-medium">
            <span
              v-for="platform in trenPlatform"
              :key="platform"
            ><span :class="warnaPlatform[platform] || 'text-muted'">●</span> {{ platform }}</span>
          </div>
          <div :style="{ width: Math.max(320, tren.length * 80) + 'px' }">
            <svg
              v-if="modeGrafik === 'garis'"
              :viewBox="`0 0 ${Math.max(320, tren.length * 80)} 170`"
              class="h-44 w-full"
              role="img"
              aria-label="Tren per platform"
            >
              <template
                v-for="platform in trenPlatform"
                :key="platform"
              >
                <polyline
                  :points="tren.map((t, i) => t.values[platform] == null ? null : `${xTren(i)},${yTren(t.values[platform]!)}`).filter(Boolean).join(' ')"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  :class="warnaPlatform[platform] || 'text-muted'"
                />
                <circle
                  v-for="t in tren.filter(t => t.values[platform] != null)"
                  :key="t.key"
                  :cx="xTren(tren.indexOf(t))"
                  :cy="yTren(t.values[platform]!)"
                  r="4"
                  fill="currentColor"
                  :class="warnaPlatform[platform] || 'text-muted'"
                />
              </template>
            </svg>
            <div
              v-else
              class="flex items-end"
              :class="modeGrafik === 'batang' ? 'h-44' : ''"
            >
              <div
                v-for="t in tren"
                :key="t.key"
                class="flex w-20 shrink-0 items-end justify-center gap-1"
              >
                <template
                  v-for="platform in trenPlatform"
                  :key="platform"
                >
                  <span
                    v-if="t.values[platform] != null && modeGrafik === 'batang'"
                    class="w-4 rounded-t bg-current"
                    :class="warnaPlatform[platform] || 'text-muted'"
                    :style="{ height: Math.max(2, t.values[platform]! / maxTren * 150) + 'px' }"
                    :title="`${platform}: ${formatTren(t.values[platform]!)}`"
                  />
                  <span
                    v-else-if="t.values[platform] != null"
                    class="text-sm font-semibold"
                    :class="warnaPlatform[platform] || 'text-muted'"
                  >{{ formatTren(t.values[platform]!) }}</span>
                </template>
              </div>
            </div>
            <div class="flex">
              <button
                v-for="t in tren"
                :key="t.key"
                type="button"
                class="w-20 shrink-0 rounded p-1.5 text-sm hover:bg-muted aria-pressed:bg-primary/15 aria-pressed:font-semibold"
                :aria-pressed="titikDipilih === t.key"
                @click="titikDipilih = titikDipilih === t.key ? '' : t.key; halTop = 1"
              >
                {{ t.key }}
              </button>
            </div>
          </div>
        </div>
      </AppPanel>
      <div class="grid gap-4 lg:grid-cols-2">
        <AppPanel title="Porsi views per platform">
          <div
            v-if="platformShare.length"
            class="flex flex-wrap items-center gap-5"
          >
            <svg
              viewBox="0 0 42 42"
              class="size-36 -rotate-90"
              role="img"
              aria-label="Porsi views per platform"
            >
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke="currentColor"
                stroke-width="6"
                class="text-muted/20"
              />
              <circle
                v-for="p in platformShare"
                :key="p.name"
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke="currentColor"
                stroke-width="6"
                :class="p.color"
                :stroke-dasharray="p.percent + ' ' + (100 - p.percent)"
                :stroke-dashoffset="-p.offset"
              />
            </svg>
            <div class="space-y-3 text-base">
              <p
                v-for="p in platformShare"
                :key="p.name"
                class="flex items-center gap-2"
              >
                <span :class="p.color">&#9679;</span>
                <span
                  class="rounded-full px-2.5 py-0.5 text-sm font-semibold"
                  :class="tagPlatform[p.name] || 'bg-muted'"
                >{{ p.name }}</span>
                <b class="num">{{ p.value.toLocaleString('id-ID') }}</b>
                <span class="text-muted">({{ p.percent.toFixed(1) }}%)</span>
              </p>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Belum ada data platform.
          </p>
        </AppPanel>
        <AppPanel
          title="Aktivitas berdasarkan hari"
          description="Rata-rata views per postingan menurut hari tayang. Jam tayang tidak tersedia."
        >
          <div class="grid grid-cols-7 gap-2 text-center text-sm">
            <div
              v-for="h in hariShare"
              :key="h.label"
              class="space-y-2"
            >
              <div
                class="rounded-lg p-3 font-bold"
                :class="h.count ? 'bg-gold-soft text-gold-deep' : 'bg-muted text-muted'"
                :title="`${h.count} postingan`"
                :style="h.rata === null ? undefined : { backgroundColor: `color-mix(in srgb, currentColor ${8 + h.rata / maxRataHari * 20}%, transparent)` }"
              >
                {{ h.rata?.toLocaleString('id-ID') ?? '—' }}
              </div><span>{{ h.label }}</span>
            </div>
          </div>
        </AppPanel>
      </div>

      <UAlert
        v-if="demo"
        color="info"
        variant="subtle"
        title="Mode demo: data konten contoh, perubahan dinonaktifkan."
      />

      <!-- Konten terpopuler -->
      <AppPanel
        title="Konten terpopuler"
        description="Konten yang paling jalan dari semua sumber, menurut tanggal tayang. ER = (likes + komentar + share) dibagi views."
      >
        <UAlert
          v-if="topGalat"
          color="error"
          variant="subtle"
          :title="topGalat"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="soft"
              loading-auto
              @click="muatTop()"
            >
              Coba lagi
            </UButton>
          </template>
        </UAlert>
        <p
          v-else-if="!topJalan && !top?.baris.length"
          class="text-sm text-muted"
        >
          Tidak ada postingan TikTok/Instagram pada rentang ini.
        </p>
        <div
          v-if="topJalan"
          class="space-y-3"
          aria-label="Memuat konten"
        >
          <USkeleton
            v-for="n in 5"
            :key="n"
            class="h-12 w-full"
          />
        </div>
        <div
          v-for="(b, i) in topJalan ? [] : (top?.baris ?? [])"
          :key="`${b.sumber}-${b.url}-${i}`"
          class="border-b border-default py-4 last:border-0"
        >
          <div class="flex flex-wrap items-center gap-3">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              :class="((top?.hal ?? 1) - 1) * perTop + i < 3 ? 'bg-gold-soft text-gold-deep' : 'bg-muted text-muted'"
            >{{ ((top?.hal ?? 1) - 1) * perTop + i + 1 }}</span>
            <div class="min-w-0 flex-1 basis-60">
              <p class="line-clamp-2 text-base leading-snug font-semibold text-highlighted">
                {{ b.judul }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                <span
                  class="rounded-full px-2.5 py-0.5 font-medium"
                  :class="tagPlatform[b.platform] || 'bg-muted'"
                >{{ b.platform }}</span>
                <span class="rounded-full bg-muted px-2.5 py-0.5 text-muted">{{ b.tanggal || 'tanpa tanggal' }}</span>
                <span class="rounded-full bg-sky-100 px-2.5 py-0.5 font-medium text-sky-800">{{ b.views }} views</span>
                <span
                  class="rounded-full px-2.5 py-0.5 font-medium"
                  :class="tagEr(b.er)"
                >ER {{ b.er === null ? '—' : `${(b.er * 100).toFixed(1)}%` }}</span>
              </div>
              <div class="mt-2 h-1.5 w-full max-w-60 rounded bg-muted">
                <div
                  class="h-full rounded bg-gold"
                  :style="{ width: Math.max(1, (nilaiMetrik(b) ?? 0) / Math.max(0.000001, nilaiKpi[4] ?? 0) * 100) + '%' }"
                />
              </div>
            </div>
            <UButton
              v-if="b.url"
              icon="i-lucide-arrow-up-right"
              color="neutral"
              variant="ghost"
              :to="b.url"
              target="_blank"
            />
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              @click="detailBuka = detailBuka === i ? -1 : i"
            >
              {{ detailBuka === i ? 'Tutup ▴' : 'Detail ▾' }}
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              :disabled="demo"
              @click="bukaForm({ platform: b.platform, url: b.url, tglTayang: b.tanggal })"
            >
              + Jadikan insight
            </UButton>
          </div>
          <div
            v-if="detailBuka === i"
            class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            <div
              v-for="[k, label] in KOTAK_RINCI"
              :key="k"
              class="rounded-lg bg-muted p-3"
            >
              <p class="text-sm text-muted">
                {{ label }}
              </p>
              <p class="text-lg font-semibold">
                {{ b.rinci[k]?.v ?? '—' }}
              </p>
              <p class="text-xs text-muted">
                {{ b.rinci[k]?.s === 'api' ? `${b.sumber} API` : b.rinci[k]?.s === 'manual' ? 'Input Performa' : 'belum ada' }}
              </p>
            </div>
          </div>
        </div>
        <div
          v-if="top"
          class="mt-2 flex items-center justify-between text-sm text-muted"
        >
          <div class="flex items-center gap-2">
            <span>Menampilkan {{ top.baris.length }} dari {{ top.total }} konten</span><USelect
              v-model="perTop"
              :items="[10, 20, 50]"
              aria-label="Jumlah konten per halaman"
              size="xs"
            />
          </div>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              :disabled="halTop <= 1"
              @click="halTop--"
            />
            <span>Halaman {{ top.hal }} dari {{ top.halMaks }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              :disabled="halTop >= top.halMaks"
              @click="halTop++"
            />
          </div>
        </div>
        <p
          v-if="st && !st.postInfo.riwayatSelesai"
          class="mt-2 text-xs text-muted"
        >
          Riwayat video TikTok masih ditarik bertahap ({{ st.postInfo.total }} video sejauh ini, 100 video lama per sinkron). Tekan Sinkronkan.
        </p>
      </AppPanel>

      <!-- Akun terhubung -->
      <details
        v-if="!demo"
        class="rounded-panel bg-default shadow-panel"
      >
        <summary class="cursor-pointer p-5 font-bold">
          Komentar Instagram
        </summary>
        <AppPanel>
          <p class="mb-3 text-sm text-muted">
            Komentar dari postingan yang sudah disinkronkan. Hubungkan Instagram lagi untuk memberi izin kelola komentar.
          </p>
          <UButton
            :loading="igLoading"
            label="Muat komentar"
            icon="i-lucide-refresh-cw"
            @click="muatKomentar"
          />
          <p
            v-if="igError"
            class="mt-3 text-error"
          >
            {{ igError }}
          </p>
          <p
            v-if="igPosts && !igPosts.length"
            class="mt-3 text-muted"
          >
            Belum ada postingan dengan komentar. Sinkronkan akun Instagram untuk memperbarui daftar.
          </p>
          <div
            v-for="post in igPosts"
            :key="post.id"
            class="mt-4 rounded-xl border border-default p-4"
          >
            <a
              :href="post.url"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-gold-deep"
            >{{ post.judul || 'Postingan Instagram' }}</a>
            <p class="text-sm text-muted">
              {{ post.jumlah }} komentar
            </p>
            <p
              v-if="post.galat"
              class="text-error"
            >
              {{ post.galat }}
            </p>
            <p
              v-if="post.selanjutnya"
              class="text-muted"
            >
              Menampilkan 50 komentar pertama.
            </p>
            <div
              v-for="comment in post.komentar"
              :key="comment.id"
              class="mt-3 border-t border-default pt-3"
            >
              <div
                v-for="item in [comment, ...(comment.replies?.data || [])]"
                :key="item.id"
                class="mb-3"
              >
                <p>
                  <strong>{{ item.username || 'Instagram' }}</strong> <span
                    v-if="item.hidden"
                    class="text-muted"
                  >(disembunyikan)</span>
                </p>
                <p class="whitespace-pre-wrap">
                  {{ item.text }}
                </p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="soft"
                    :disabled="igLoading"
                    :label="item.hidden ? 'Tampilkan' : 'Sembunyikan'"
                    @click="ubahKomentar(item.id, 'hide', item.hidden)"
                  />
                  <UButton
                    size="sm"
                    color="error"
                    variant="ghost"
                    :disabled="igLoading"
                    label="Hapus"
                    @click="ubahKomentar(item.id, 'delete')"
                  />
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <UInput
                  v-model="igReply[comment.id]"
                  placeholder="Tulis balasan"
                  :maxlength="2200"
                  class="min-w-0 flex-1"
                />
                <UButton
                  label="Balas"
                  :disabled="igLoading || !igReply[comment.id]?.trim()"
                  @click="ubahKomentar(comment.id, 'reply')"
                />
              </div>
            </div>
          </div>
        </AppPanel>
      </details>
      <details
        v-if="!demo"
        class="rounded-panel bg-default shadow-panel"
      >
        <summary class="cursor-pointer p-5 font-bold">
          Akun terhubung
        </summary>
        <AppPanel>
          <div class="grid gap-3 md:grid-cols-3">
            <UCard
              v-for="slot in (['tiktok', 'instagram'] as const)"
              :key="slot"
            >
              <template #header>
                <span class="font-medium">{{ slot === 'tiktok' ? 'TikTok' : 'Instagram' }}</span>
              </template>
              <template
                v-if="st?.akun.find(a => a.platform === slot)"
                #default
              >
                <KontenAkunCard
                  :akun="(st?.akun.find(a => a.platform === slot) as AkunCampaign)"
                  :jenis="slot"
                  :sinkron-jalan="sinkronJalan === slot"
                  @hubungkan="hubungkan(slot)"
                  @sinkronkan="sinkronkan(slot)"
                  @putuskan="putuskan"
                />
              </template>
              <template
                v-else
                #default
              >
                <p class="text-sm text-muted">
                  {{ slot === 'tiktok'
                    ? 'Hubungkan akun TikTok brand untuk menarik postingan terbaru beserta views, likes, komentar, dan share-nya.'
                    : 'Hubungkan akun Instagram bisnis brand untuk menarik postingan beserta likes, komentar, views, reach, saves, dan share-nya.' }}
                </p>
                <p
                  v-if="!(slot === 'tiktok' ? st?.setting.tiktokSiap : st?.setting.igSiap)"
                  class="mt-1 text-xs text-muted"
                >
                  {{ slot === 'tiktok' ? 'Client key & secret TikTok belum diisi. Isi di Pengaturan.' : 'Instagram App ID & App Secret belum diisi. Isi di Pengaturan.' }}
                </p>
                <UButton
                  class="mt-2"
                  color="primary"
                  size="xs"
                  :disabled="!(slot === 'tiktok' ? st?.setting.tiktokSiap : st?.setting.igSiap)"
                  @click="hubungkan(slot)"
                >
                  Hubungkan
                </UButton>
              </template>
            </UCard>
            <UCard>
              <template #header>
                <span class="font-medium">YouTube</span>
              </template>
              <p class="text-sm text-muted">
                Segera hadir — angkanya lewat Input Performa modul Konten.
              </p>
            </UCard>
          </div>
        </AppPanel>
      </details>

      <!-- Insight otomatis -->
      <details
        v-if="!demo"
        class="rounded-panel bg-default shadow-panel"
      >
        <summary class="cursor-pointer p-5 font-bold">
          Insight otomatis (AI)
        </summary>
        <AppPanel
          description="AI membaca konten terpopuler di atas lalu mengusulkan pola. Usulan tidak tersimpan sampai kamu menekan Simpan."
        >
          <div class="grid gap-2 md:grid-cols-2">
            <UFormField
              label="Periode data bukti"
              help="Bukti dibaca dari tanggal tayang postingan (WIB)."
            >
              <AppSeg
                v-model="usulanPeriode"
                size="sm"
                :options="opsiUsulanPeriode"
              />
            </UFormField>
            <UFormField label="Fokus pilar (opsional)">
              <USelect
                v-model="usulanFokus"
                :items="[FOKUS_SEMUA, ...(st?.setting.kategori ?? [])]"
              />
            </UFormField>
          </div>
          <div
            v-if="usulanPeriode === 'rentang'"
            class="grid gap-2 md:grid-cols-2"
          >
            <UFormField label="Dari tanggal *">
              <AppTanggal
                v-model="usulanDari"
              />
            </UFormField>
            <UFormField label="Sampai tanggal *">
              <AppTanggal
                v-model="usulanSampai"
              />
            </UFormField>
          </div>
          <UButton
            color="primary"
            :loading="usulanJalan"
            :disabled="!st?.setting.aiSiap"
            @click="temukanInsight()"
          >
            Temukan insight
          </UButton>
          <p
            v-if="!st?.setting.aiSiap"
            class="mt-1 text-xs text-muted"
          >
            API key AI belum diisi. Minta admin modul mengisinya di Pengaturan.
          </p>
          <div
            v-for="(u, i) in usulan"
            :key="i"
            class="mt-3 rounded-xl border border-default p-4"
          >
            <p class="text-base leading-relaxed font-semibold text-highlighted">
              {{ String(u.temuan ?? '') }}
            </p>
            <p
              v-if="u.aksi"
              class="mt-2 flex gap-2 rounded-lg bg-amber-50 p-3 text-base leading-relaxed text-amber-900"
            >
              <UIcon
                name="i-lucide-lightbulb"
                class="size-4"
              /> {{ String(u.aksi) }}
            </p>
            <UButton
              class="mt-1"
              color="neutral"
              variant="soft"
              size="xs"
              @click="bukaForm(u)"
            >
              ✓ Simpan sebagai insight
            </UButton>
          </div>
        </AppPanel>
      </details>

      <!-- Daftar insight -->
      <details
        v-if="!demo"
        class="rounded-panel bg-default shadow-panel"
      >
        <summary class="cursor-pointer p-5 font-bold">
          Insight konten
        </summary>
        <AppPanel>
          <template #head>
            <div class="flex flex-wrap items-center gap-2">
              <AppSeg
                v-model="saringPlat"
                size="sm"
                :options="['Semua', 'TikTok', 'Instagram', 'YouTube'].map(v => ({ value: v, label: v }))"
              />
              <UButton
                color="neutral"
                :variant="saringArsip ? 'solid' : 'soft'"
                size="xs"
                @click="saringArsip = !saringArsip"
              >
                Arsip ({{ st?.insight.filter(i => !!i.arsip).length ?? 0 }})
              </UButton>
              <USelect
                v-model="saringKat"
                :items="['Semua kategori', ...(st?.setting.kategori ?? [])]"
                size="xs"
              />
              <UButton
                color="primary"
                size="xs"
                @click="bukaForm()"
              >
                + Catat insight
              </UButton>
            </div>
          </template>
          <p
            v-if="!daftarInsight.length"
            class="text-sm text-muted"
          >
            {{ (st?.insight.length ?? 0) ? 'Tidak ada insight yang cocok dengan saringan.' : 'Belum ada insight. Catat dari konten terpopuler di atas, atau minta usulan dari Insight otomatis (AI).' }}
          </p>
          <div
            v-for="i in daftarInsight"
            :key="i.id"
            class="border-b border-default py-4 last:border-0"
          >
            <div class="mb-2 flex flex-wrap gap-1.5 text-sm">
              <span
                class="rounded-full px-2.5 py-0.5 font-medium"
                :class="tagPlatform[i.platform] || 'bg-muted'"
              >{{ i.platform }}</span>
              <span
                v-if="i.kategori"
                class="rounded-full px-2.5 py-0.5 font-medium"
                :class="tagKategori(i.kategori)"
              >{{ i.kategori }}</span>
              <span class="rounded-full bg-muted px-2.5 py-0.5 text-muted">Tayang {{ i.tgl_tayang }}</span>
              <span
                v-if="i.metrik"
                class="rounded-full bg-sky-100 px-2.5 py-0.5 font-medium text-sky-800"
              >{{ i.metrik }}</span>
            </div>
            <p class="text-base leading-relaxed font-semibold text-highlighted">
              {{ i.temuan }}
            </p>
            <p
              v-if="i.aksi"
              class="mt-2 flex gap-2 rounded-lg bg-amber-50 p-3 text-base leading-relaxed text-amber-900"
            >
              <UIcon
                name="i-lucide-lightbulb"
                class="size-4"
              /> {{ i.aksi }}
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UButton
                v-if="i.url"
                icon="i-lucide-arrow-up-right"
                color="neutral"
                variant="ghost"
                size="xs"
                :to="i.url"
                target="_blank"
              >
                Lihat konten
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                @click="bukaForm(i)"
              >
                Sunting
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                loading-auto
                @click="arsipkan(i, !i.arsip)"
              >
                {{ i.arsip ? 'Pulihkan' : 'Arsipkan' }}
              </UButton>
            </div>
          </div>
        </AppPanel>
      </details>

      <ResponsiveSheet
        v-model="formBuka"
        :title="form.id ? 'Sunting insight' : 'Catat insight baru'"
      >
        <UFormField label="Platform">
          <USelect
            v-model="form.platform"
            :items="['TikTok', 'Instagram', 'YouTube']"
          />
        </UFormField>
        <UFormField label="Kategori">
          <USelect
            v-model="form.kategori"
            :items="st?.setting.kategori ?? []"
          />
        </UFormField>
        <UFormField
          label="Temuan *"
          help="Inti insight-nya"
        >
          <UTextarea
            v-model="form.temuan"
            :rows="3"
          />
        </UFormField>
        <UFormField label="Tautan konten (https) *">
          <UInput
            v-model="form.url"
            placeholder="https://…"
          />
        </UFormField>
        <UFormField label="Tanggal konten tayang *">
          <AppTanggal
            v-model="form.tglTayang"
          />
        </UFormField>
        <UFormField label="Metrik (opsional)">
          <UInput v-model="form.metrik" />
        </UFormField>
        <UFormField label="Rencana aksi (opsional)">
          <UTextarea
            v-model="form.aksi"
            :rows="2"
          />
        </UFormField>
        <template #actions>
          <UButton
            color="neutral"
            variant="soft"
            @click="formBuka = false"
          >
            Batal
          </UButton>
          <UButton
            color="primary"
            loading-auto
            @click="simpanForm()"
          >
            Simpan insight
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
