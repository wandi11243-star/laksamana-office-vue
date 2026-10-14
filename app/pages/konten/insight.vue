<!--
  Konten › Insight Konten (deploy/konten/analytics/index.html #insight;
  #133). Akun terhubung (TikTok/Instagram/YouTube-segera), Konten terpopuler
  (satu halaman server + detail 9 angka), Insight otomatis AI, daftar insight.
-->
<script setup lang="ts">
import type { AkunCampaign, BarisTop, InsightCampaign, InsightInput } from '~/composables/useCampaign'

definePageMeta({ access: ['konten', 'campaign'] })

const route = useRoute()
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
  try {
    const r = await oauthMulaiCampaign(provider)
    navigateTo(r.data.url, { external: true })
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
}

async function putuskan(a: { platform: string, nama: string }) {
  if (!confirm(`Putuskan akun ${a.platform}? Postingan yang sudah ditarik tetap tersimpan; sinkron otomatis berhenti sampai dihubungkan lagi.`)) return
  const ok = await campaignSimpan(
    () => oauthPutusCampaign(a.platform as 'tiktok' | 'instagram'), 'Akun diputus.')
  if (ok) refresh()
}

// ---------------------------------------------------------------- top
const platTop = ref('Semua')
const urutTop = ref('views')
const rentangTop = ref('30 hari')
const dariTop = ref('')
const sampaiTop = ref('')
const halTop = ref(1)
const top = ref<{ baris: BarisTop[], total: number, hal: number, per: number, halMaks: number } | null>(null)
const topGalat = ref('')
const topJalan = ref(false)

function rentangTopHitung(): { dari?: string, sampai?: string } {
  const hari = (n: number) => {
    const d = new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000)
    return d.toISOString().slice(0, 10)
  }
  if (rentangTop.value === '7 hari') return { dari: hari(7) }
  if (rentangTop.value === '30 hari') return { dari: hari(30) }
  if (rentangTop.value === '90 hari') return { dari: hari(90) }
  if (rentangTop.value === 'Bulan ini') return { dari: hari(0).slice(0, 7) + '-01' }
  if (rentangTop.value === 'Rentang…' && dariTop.value) return { dari: dariTop.value, sampai: sampaiTop.value || undefined }
  return {}
}

async function muatTop() {
  topJalan.value = true
  topGalat.value = ''
  try {
    const r = await getTopCampaign({
      platform: platTop.value === 'Semua' ? '' : platTop.value,
      urut: urutTop.value, ...rentangTopHitung(), hal: halTop.value, per: 10,
    })
    top.value = r.data
  }
  catch (e) { topGalat.value = `Konten terpopuler tidak bisa dimuat: ${apiErrorMessage(e)}` }
  topJalan.value = false
}
onMounted(muatTop)
watch([platTop, urutTop, rentangTop, dariTop, sampaiTop], () => {
  halTop.value = 1
  muatTop()
})

const detailBuka = ref(-1)
const KOTAK_RINCI = [
  ['reach', 'Reach'], ['impr', 'Impression'], ['views', 'Views'], ['likes', 'Likes'],
  ['comments', 'Comment'], ['shares', 'Share'], ['saves', 'Saves'], ['cta', 'Klik CTA'], ['follow', 'Follower Baru'],
] as const

// ---------------------------------------------------------------- insight AI + daftar
const usulan = ref<Record<string, unknown>[]>([])
const usulanJalan = ref(false)
async function temukanInsight() {
  usulanJalan.value = true
  try {
    const r = await usulanInsightCampaign()
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

      <!-- Akun terhubung -->
      <AppPanel title="Akun terhubung">
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

      <!-- Konten terpopuler -->
      <AppPanel
        title="Konten terpopuler"
        description="Konten yang paling jalan dari semua sumber, menurut tanggal tayang. ER = (likes + komentar + share) dibagi views."
      >
        <template #head>
          <div class="flex flex-wrap gap-2">
            <AppSeg
              v-model="platTop"
              size="sm"
              :options="['Semua', 'TikTok', 'Instagram', 'YouTube'].map(v => ({ value: v, label: v }))"
            />
            <AppSeg
              v-model="urutTop"
              size="sm"
              :options="[{ value: 'views', label: 'Paling banyak ditonton' }, { value: 'er', label: 'Engagement tertinggi' }]"
            />
            <AppSeg
              v-model="rentangTop"
              size="sm"
              :options="['Semua waktu', '7 hari', '30 hari', '90 hari', 'Bulan ini', 'Rentang…'].map(v => ({ value: v, label: v }))"
            />
          </div>
          <div
            v-if="rentangTop === 'Rentang…'"
            class="mt-2 flex gap-2"
          >
            <UInput
              v-model="dariTop"
              type="date"
            />
            <UInput
              v-model="sampaiTop"
              type="date"
            />
          </div>
        </template>
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
          v-for="(b, i) in top?.baris ?? []"
          :key="`${b.sumber}-${b.url}-${i}`"
          class="border-b border-default py-2"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">{{ ((top?.hal ?? 1) - 1) * 10 + i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ b.judul }}
              </p>
              <p class="text-xs text-muted">
                {{ b.platform }} · {{ b.tanggal || 'tanpa tanggal' }} · {{ b.views }} views · ER {{ b.er === null ? '—' : `${(b.er * 100).toFixed(1)}%` }}
              </p>
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
              @click="bukaForm({ platform: b.platform, url: b.url, tglTayang: b.tanggal })"
            >
              + Jadikan insight
            </UButton>
          </div>
          <div
            v-if="detailBuka === i"
            class="mt-2 grid grid-cols-3 gap-2"
          >
            <div
              v-for="[k, label] in KOTAK_RINCI"
              :key="k"
              class="rounded bg-muted p-2"
            >
              <p class="text-xs text-muted">
                {{ label }}
              </p>
              <p class="text-sm font-medium">
                {{ b.rinci[k]?.v ?? '—' }}
              </p>
              <p class="text-[11px] text-muted">
                {{ b.rinci[k]?.s === 'api' ? `${b.sumber} API` : b.rinci[k]?.s === 'manual' ? 'Input Performa' : 'belum ada' }}
              </p>
            </div>
          </div>
        </div>
        <div
          v-if="top"
          class="mt-2 flex items-center justify-between text-sm text-muted"
        >
          <span>Menampilkan {{ top.baris.length }} dari {{ top.total }} konten</span>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              :disabled="halTop <= 1"
              @click="halTop--; muatTop()"
            />
            <span>Halaman {{ top.hal }} dari {{ top.halMaks }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              :disabled="halTop >= top.halMaks"
              @click="halTop++; muatTop()"
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

      <!-- Insight otomatis -->
      <AppPanel
        title="Insight otomatis (AI)"
        description="AI membaca konten terpopuler di atas lalu mengusulkan pola. Usulan tidak tersimpan sampai kamu menekan Simpan."
      >
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
          class="mt-2 rounded border border-default p-2"
        >
          <p class="text-sm font-medium">
            {{ String(u.temuan ?? '') }}
          </p>
          <p
            v-if="u.aksi"
            class="text-sm text-muted"
          >
            💡 {{ String(u.aksi) }}
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

      <!-- Daftar insight -->
      <AppPanel title="Insight konten">
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
          class="border-b border-default py-2"
        >
          <p class="text-sm font-medium">
            {{ i.temuan }}
          </p>
          <p class="text-xs text-muted">
            {{ i.platform }} · Tayang {{ i.tgl_tayang }} · {{ i.kategori }} {{ i.metrik ? `· ${i.metrik}` : '' }}
          </p>
          <p
            v-if="i.aksi"
            class="text-sm text-muted"
          >
            💡 {{ i.aksi }}
          </p>
          <div class="mt-1 flex gap-2">
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
              @click="arsipkan(i, !i.arsip)"
            >
              {{ i.arsip ? 'Pulihkan' : 'Arsipkan' }}
            </UButton>
          </div>
        </div>
      </AppPanel>

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
          <UInput
            v-model="form.tglTayang"
            type="date"
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
            @click="simpanForm()"
          >
            Simpan insight
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
