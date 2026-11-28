<!--
  Konten › Google Review (deploy/konten/analytics/index.html #greview; D.24).
  Guest reviews, follow-up, replies and AI analysis.
-->
<script setup lang="ts">
import type { Envelope } from '~/composables/useApi'
import {
  balasGoogleReview, tanganiGoogleReview, nomorResmiGreview, NOMOR_RESERVASI_GREVIEW,
  useGoogleReviewState, LABEL_TINGKAT_GREVIEW,
  type ReviewGoogle, type SaringGreview,
} from '~/composables/useGoogleReview'

definePageMeta({ access: ['konten', 'campaign'] })

const toast = useToast()
const route = useRoute()
const { status, data, galat, sinkronJalan, muat, sinkronkan } = useGoogleReviewState()

// OAuth landing (?google=ok|gagal&pesan=…#greview, like legacy).
const pitaOauth = ref('')
onMounted(() => {
  const q = route.query
  if (q.google === 'ok') {
    pitaOauth.value = String(q.pesan || 'Google Business Profile terhubung.')
    muat()
  }
  else if (q.google === 'gagal') {
    pitaOauth.value = `Gagal menghubungkan: ${q.pesan || 'coba lagi dari tombol Hubungkan.'}`
  }
  else {
    muat()
  }
})

const saring = ref<SaringGreview>('tangani')
const cari = ref('')
const buka = ref('')
const draf = ref<Record<string, string | undefined>>({})
const kirimJalan = ref('')

const daftar = computed<ReviewGoogle[]>(() => {
  const semua = (data.value?.review ?? []).filter(r =>
    (!tempatPilih.value || r.tempatId === tempatPilih.value),
  )
  const q = cari.value.trim().toLowerCase()
  const out = semua.filter((r) => {
    if (saring.value === 'tangani' && !r.tingkat) return false
    if (saring.value === 'segera' && r.tingkat !== 'segera') return false
    if (saring.value === 'belum' && r.balasan) return false
    if (saring.value === 'rendah' && Number(r.rating) > 3) return false
    if (saring.value === 'dibalas' && !r.balasan) return false
    if (saring.value === 'selesai' && Number(r.ditangani) !== 1) return false
    if (topikPilih.value && !topikReview(r).some(k => k.id === topikPilih.value)) return false
    if (q && `${r.penulis} ${r.teks || ''} ${r.balasan || ''}`.toLowerCase().includes(q)) return true
    return !q
  })
  if (saring.value === 'tangani') out.sort((a, b) => (b.skor || 0) - (a.skor || 0))
  return out
})

const tempatPilih = ref('')

// Colour topic tags (like the Google Maps "menu" chips), read from the review
// text by keyword — reviews carry no topic data of their own.
const TOPIK = [
  { id: 'makanan', label: 'Makanan', kelas: 'bg-orange-500 text-white ring-orange-700', kata: /makan|food|menu|rasa|enak|lezat|steak|ayam|ikan|nasi|mie|pasta|pizza|dessert|porsi|sambal|seafood|daging/ },
  { id: 'minuman', label: 'Minuman', kelas: 'bg-sky-500 text-white ring-sky-700', kata: /minum|kopi|coffee|jus|juice|teh |tea|mocktail|cocktail|drink|es / },
  { id: 'pelayanan', label: 'Pelayanan', kelas: 'bg-emerald-500 text-white ring-emerald-700', kata: /layan|service|staf|staff|pelayan|waiter|ramah|friendly|sopan|lama|lambat|cepat|tunggu/ },
  { id: 'suasana', label: 'Suasana', kelas: 'bg-violet-500 text-white ring-violet-700', kata: /suasana|tempat|nyaman|cozy|view|pemandangan|musik|music|live|dekor|interior|ambience|atmosph|instagramable|aesthetic/ },
  { id: 'harga', label: 'Harga', kelas: 'bg-amber-500 text-white ring-amber-700', kata: /harga|price|mahal|murah|worth|terjangkau|pricey|bayar|tagihan|bill/ },
  { id: 'kebersihan', label: 'Kebersihan', kelas: 'bg-teal-500 text-white ring-teal-700', kata: /bersih|kotor|clean|dirty|toilet|wc|bau|lalat|kecoa/ },
  { id: 'lokasi', label: 'Lokasi & Parkir', kelas: 'bg-rose-500 text-white ring-rose-700', kata: /parkir|parking|lokasi|location|akses|jalan|macet|strategis/ },
  { id: 'reservasi', label: 'Reservasi & Acara', kelas: 'bg-indigo-500 text-white ring-indigo-700', kata: /reserv|booking|book |acara|event|ulang tahun|birthday|meeting|rombongan|wedding/ },
] as const
type IdTopik = typeof TOPIK[number]['id']
const topikReview = (r: ReviewGoogle) => {
  const t = ` ${(r.teks || '').toLowerCase()} `
  return TOPIK.filter(k => k.kata.test(t))
}
const topikPilih = ref<IdTopik | ''>('')
const hitungTopik = computed(() => TOPIK.map(k => ({ ...k, jumlah: ulasanTempat.value.filter(r => k.kata.test(` ${(r.teks || '').toLowerCase()} `)).length })).filter(k => k.jumlah))
const kartuRating = (n: number) => Number(n) <= 2
  ? 'border-red-500 bg-red-50'
  : Number(n) === 3
    ? 'border-amber-400 bg-amber-50'
    : 'border-emerald-500 bg-emerald-50'
const WARNA_SARING: Record<string, string> = { tangani: 'bg-orange-500', segera: 'bg-red-500', belum: 'bg-amber-500', rendah: 'bg-rose-500', dibalas: 'bg-sky-500', selesai: 'bg-emerald-500', semua: 'bg-neutral-400' }
const tempat = computed(() => data.value?.tempat ?? [])

const bintang = (n: number) => '★★★★★'.slice(0, Math.max(0, Math.min(5, Math.round(Number(n) || 0)))) || '—'

async function kirim(r: ReviewGoogle) {
  const isi = nomorResmiGreview((draf.value[r.id] ?? r.balasan ?? '').trim())
  if (!isi) {
    toast.add({ title: 'Tulis balasannya dulu.', color: 'error' })
    return
  }
  // The reply goes PUBLIC on Google Maps — the question names the guest, so a
  // content-free OK cannot send it by accident.
  if (!confirm(`Kirim balasan ke ulasan ${r.penulis || 'tamu'} (${r.rating}★)?\n\nBalasan langsung terbit publik di Google Maps atas nama bisnis.`)) return
  kirimJalan.value = r.id
  try {
    await balasGoogleReview(r.id, isi)
    draf.value[r.id] = undefined
    buka.value = ''
    toast.add({ title: 'Balasan terkirim ke Google.', color: 'success' })
    await muat()
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
  kirimJalan.value = ''
}

async function tandai(r: ReviewGoogle, ya: boolean) {
  let cat = ''
  if (ya) {
    const jawab = prompt('Catatan tindak lanjut (opsional) — mis. "tamu sudah dihubungi, voucher diberikan":', '')
    if (jawab === null) return
    cat = jawab
  }
  try {
    await tanganiGoogleReview(r.id, ya, cat)
    toast.add({ title: ya ? 'Ditandai sudah ditangani.' : 'Tanda ditangani dibatalkan.', color: 'success' })
    await muat()
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
}

const hubungkanSibuk = ref(false)
async function hubungkanGoogle() {
  hubungkanSibuk.value = true
  try {
    const res = await useApi()<Envelope<{ url: string }>>('/konten/analytics/google/start', { method: 'POST' })
    await navigateTo(res.data.url, { external: true })
  }
  catch (e) { toast.add({ title: apiErrorMessage(e), color: 'error' }) }
  finally { hubungkanSibuk.value = false }
}

const periodeAi = ref('90')
const aiSibuk = ref(false)
const aiGalat = ref('')
const ulasanTempat = computed(() => (data.value?.review ?? []).filter(r => !tempatPilih.value || r.tempatId === tempatPilih.value))
const ulasan30 = computed(() => ulasanTempat.value.filter(r => r.waktuMs >= Date.now() - 30 * 86400e3))
const rata30 = computed(() => ulasan30.value.length
  ? (ulasan30.value.reduce((total, r) => total + Number(r.rating), 0) / ulasan30.value.length).toFixed(1)
  : '-')
const belumBalas = computed(() => ulasanTempat.value.filter(r => !r.balasan && Number(r.rating) <= 3).length)
const distribusi = computed(() => [5, 4, 3, 2, 1].map(bintang => ({
  bintang,
  jumlah: ulasanTempat.value.filter(r => Number(r.rating) === bintang).length,
})))
async function analisa() {
  if (aiSibuk.value) return
  aiSibuk.value = true
  aiGalat.value = ''
  try {
    await useApi()('/konten/analytics/google/ai', { method: 'POST', body: { hari: Number(periodeAi.value), tempat: tempatPilih.value || undefined } })
    await muat()
  }
  catch (e) { aiGalat.value = apiErrorMessage(e) }
  finally { aiSibuk.value = false }
}

const segSegera = computed(() => ulasanTempat.value.filter(r => r.tingkat === 'segera').length)
</script>

<template>
  <KontenGerbang lihat="greview">
    <AppPage
      title="Google Review"
      description="Ulasan Google tamu: yang perlu ditangani, dibalas langsung, dan dianalisa AI"
    >
      <div id="greview">
        <UAlert
          v-if="pitaOauth"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="pitaOauth"
          class="mb-5"
        />

        <AppPanel
          v-if="status !== 'ok'"
          title="Google Review"
        >
          <div
            v-if="status === 'muat' || status === 'idle'"
            class="space-y-2 py-6"
          >
            <!-- Loading rows mirror the review list below. -->
            <USkeleton
              v-for="i in 3"
              :key="i"
              class="h-12 w-full"
            />
            <p class="pt-1 text-center text-sm text-muted">
              Memuat review…
            </p>
          </div>
          <div v-else>
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Gagal memuat Google Review"
              class="mb-3"
            />
            <p
              v-if="galat"
              class="mb-3 text-sm text-muted"
            >
              {{ galat }}
            </p>
            <UButton
              label="Coba lagi"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              @click="muat()"
            />
          </div>
        </AppPanel>

        <template v-else>
          <AppPanel title="Sumber review">
            <template #actions>
              <UButton
                v-if="!data?.akun?.terhubung"
                label="Hubungkan Google"
                icon="i-lucide-link"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="hubungkanSibuk"
                @click="hubungkanGoogle()"
              />
              <UButton
                label="Sinkronkan"
                icon="i-lucide-refresh-cw"
                size="sm"
                :loading="sinkronJalan"
                @click="sinkronkan()"
              />
            </template>
            <AppStatus :color="data?.akun?.terhubung ? 'success' : 'neutral'">
              {{ data?.akun?.terhubung ? 'Google Business terhubung' : 'Google Business belum terhubung' }}
            </AppStatus>
            <p class="mt-2 text-sm text-muted">
              {{ data?.review.length || 0 }} review tersimpan · sinkron terakhir
              {{ data?.syncAt ? new Date(data.syncAt).toLocaleString('id-ID') : 'belum pernah' }}.
            </p>
            <div
              v-if="tempat.length"
              class="mt-3 grid gap-3 md:grid-cols-3"
            >
              <div
                v-for="t in tempat"
                :key="t.id"
                class="rounded-panel border border-default p-3"
              >
                <p class="font-semibold text-highlighted">
                  {{ t.nama || t.id }}
                </p>
                <p
                  v-if="t.alamat"
                  class="text-xs text-muted"
                >
                  {{ t.alamat }}
                </p>
                <p class="mt-1 text-sm">
                  <span class="text-primary-700">{{ bintang(t.rating ?? 0) }}</span>
                  <b class="num">{{ t.rating ?? '—' }}</b>
                  <span class="text-muted">· {{ t.total ?? '—' }} ulasan · {{ t.sumber === 'gbp' ? 'Business Profile' : 'Places API' }}</span>
                </p>
              </div>
            </div>
          </AppPanel>

          <AppStatGrid :count="3">
            <AppStat
              label="Perlu segera"
              :value="segSegera"
              icon="i-lucide-alarm-clock"
              tone="warning"
            />
            <AppStat
              label="Keluhan belum dibalas"
              :value="belumBalas"
              icon="i-lucide-message-circle"
            />
            <AppStat
              label="Rata-rata 30 hari"
              :value="rata30"
              icon="i-lucide-star"
            />
          </AppStatGrid>

          <AppPanel title="Sebaran bintang">
            <ul class="space-y-2">
              <li
                v-for="bar in distribusi"
                :key="bar.bintang"
                class="flex items-center gap-3 text-sm"
              >
                <span class="w-8 shrink-0">{{ bar.bintang }} ★</span>
                <progress
                  :value="bar.jumlah"
                  :max="ulasanTempat.length || 1"
                  :aria-label="'Jumlah ulasan bintang ' + bar.bintang"
                  class="h-2 min-w-0 flex-1 accent-primary"
                />
                <span class="num w-12 text-right">{{ bar.jumlah }}</span>
              </li>
            </ul>
          </AppPanel>

          <AppPanel title="Analisa AI">
            <template #actions>
              <USelect
                v-model="periodeAi"
                :items="[{ value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }, { value: '180', label: '180 hari' }, { value: '365', label: '1 tahun' }]"
                aria-label="Periode analisa"
              />
              <UButton
                label="Analisa"
                icon="i-lucide-sparkles"
                :loading="aiSibuk"
                :disabled="!ulasanTempat.length"
                @click="analisa()"
              />
            </template>
            <UAlert
              v-if="aiGalat"
              color="error"
              variant="subtle"
              :title="aiGalat"
            />
            <div
              v-if="data?.ai"
              class="space-y-4 text-sm"
            >
              <p>{{ data.ai.ringkasan }}</p>
              <div
                v-if="data.ai.sentimen"
                class="flex flex-wrap gap-2"
              >
                <AppStatus
                  v-for="(jumlah, label) in data.ai.sentimen"
                  :key="label"
                >
                  {{ label }} {{ jumlah }}
                </AppStatus>
              </div>
              <h3 class="font-semibold">
                Yang harus ditingkatkan
              </h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left">
                  <thead><tr><th>Prioritas</th><th>Area</th><th>Masalah</th><th>Saran</th></tr></thead>
                  <tbody>
                    <tr
                      v-for="(baris, i) in data.ai.perbaikan"
                      :key="i"
                      class="border-t border-default align-top [&>td]:px-2 [&>td]:py-2"
                    >
                      <td>{{ baris.prioritas }}</td><td>{{ baris.area }}</td><td>{{ baris.masalah }}</td><td>{{ baris.saran }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <h3 class="font-semibold">
                Yang disukai tamu
              </h3>
              <ul class="space-y-1">
                <li
                  v-for="(item, i) in data.ai.kekuatan"
                  :key="i"
                >
                  <b>{{ item.tema }}</b> {{ item.penjelasan }}
                </li>
              </ul>
              <UAlert
                v-if="data.ai.tangani.length"
                color="warning"
                variant="subtle"
                :title="data.ai.tangani.length + ' ulasan ditandai AI untuk ditangani'"
              />
            </div>
            <p
              v-else-if="!aiGalat"
              class="text-sm text-muted"
            >
              Pilih periode untuk menganalisa ulasan.
            </p>
          </AppPanel>

          <AppPanel title="Review tamu">
            <template #head>
              <div class="flex w-full flex-wrap items-center gap-2">
                <div
                  class="flex flex-wrap gap-1.5"
                  role="radiogroup"
                  aria-label="Saring review"
                >
                  <button
                    v-for="o in [
                      { value: 'tangani', label: `Perlu ditangani${segSegera ? ` (${segSegera} segera)` : ''}` },
                      { value: 'segera', label: 'Segera' },
                      { value: 'belum', label: 'Belum dibalas' },
                      { value: 'rendah', label: 'Bintang 1-3' },
                      { value: 'dibalas', label: 'Sudah dibalas' },
                      { value: 'selesai', label: 'Sudah ditangani' },
                      { value: 'semua', label: 'Semua' },
                    ]"
                    :key="o.value"
                    type="button"
                    role="radio"
                    :aria-checked="saring === o.value"
                    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
                    :class="saring === o.value ? 'border-transparent bg-inverted text-inverted' : 'border-default bg-default text-default hover:bg-elevated'"
                    @click="saring = o.value as SaringGreview"
                  >
                    <i
                      class="inline-block size-2 rounded-full"
                      :class="WARNA_SARING[o.value]"
                    />{{ o.label }}
                  </button>
                </div>
                <USelect
                  v-if="tempat.length > 1"
                  :model-value="tempatPilih || KOSONG"
                  :items="[{ value: KOSONG, label: 'Semua tempat' }, ...tempat.map(t => ({ value: t.id, label: t.nama || t.id }))]"
                  size="sm"
                  class="w-44"
                  @update:model-value="tempatPilih = dariKosong($event)"
                />
                <UInput
                  v-model="cari"
                  icon="i-lucide-search"
                  placeholder="Cari nama tamu atau isi review…"
                  size="sm"
                  class="min-w-44 flex-1"
                />
                <div
                  v-if="hitungTopik.length"
                  class="mt-2 flex w-full flex-wrap gap-1.5"
                  aria-label="Topik ulasan"
                >
                  <button
                    v-for="k in hitungTopik"
                    :key="k.id"
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ring-1 transition"
                    :class="[k.kelas, topikPilih === k.id ? 'ring-2 ring-offset-1' : 'ring-transparent opacity-90 hover:opacity-100']"
                    :aria-pressed="topikPilih === k.id"
                    @click="topikPilih = topikPilih === k.id ? '' : k.id"
                  >
                    {{ k.label }} <span class="num opacity-70">{{ k.jumlah }}</span>
                  </button>
                </div>
              </div>
            </template>
            <p
              v-if="!daftar.length"
              class="py-6 text-center text-sm text-muted"
            >
              {{ cari ? `Tidak ada review yang cocok dengan "${cari}".` : 'Tidak ada review pada saringan ini.' }}
            </p>
            <div
              v-for="r in daftar"
              :key="r.id"
              class="mb-3 rounded-xl border-l-8 p-4 last:mb-0"
              :class="kartuRating(r.rating)"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted">
                  {{ String(r.penulis || '?').charAt(0).toUpperCase() }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-highlighted">
                    {{ r.penulis || 'Pengguna Google' }}
                  </p>
                  <p class="text-xs text-muted">
                    <span
                      class="rounded-full px-2 py-0.5 text-sm font-bold text-white"
                      :class="Number(r.rating) <= 2 ? 'bg-red-600' : Number(r.rating) === 3 ? 'bg-amber-500' : 'bg-emerald-600'"
                    >{{ r.rating }} ★</span>
                    · {{ r.waktuMs ? new Date(r.waktuMs).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}
                  </p>
                </div>
                <AppStatus
                  v-if="r.tingkat"
                  size="sm"
                  class="ring-1 ring-inset ring-current/40"
                  :color="r.tingkat === 'segera' ? 'error' : r.tingkat === 'tinggi' ? 'warning' : 'info'"
                >
                  {{ LABEL_TINGKAT_GREVIEW[r.tingkat] }}
                </AppStatus>
                <AppStatus
                  v-if="Number(r.ditangani) === 1"
                  size="sm"
                  color="success"
                >
                  Sudah ditangani
                </AppStatus>
                <AppStatus
                  v-else-if="r.balasan"
                  size="sm"
                  color="success"
                >
                  Dibalas
                </AppStatus>
                <AppStatus
                  v-if="r.sumber !== 'gbp'"
                  size="sm"
                  color="neutral"
                >
                  Places
                </AppStatus>
              </div>
              <div
                v-if="topikReview(r).length"
                class="mt-2 flex flex-wrap gap-1"
              >
                <span
                  v-for="k in topikReview(r)"
                  :key="k.id"
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="k.kelas"
                >{{ k.label }}</span>
              </div>
              <p
                v-if="r.teks"
                class="mt-2 whitespace-pre-wrap text-sm"
              >
                {{ r.teks }}
              </p>
              <p
                v-else
                class="mt-2 text-sm text-muted"
              >
                (hanya memberi bintang, tanpa tulisan)
              </p>
              <div
                v-if="r.balasan"
                class="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-sm"
              >
                <p class="mb-1 text-[11px] text-muted">
                  Balasan bisnis<template v-if="r.balasanAt > 0">
                    · {{ new Date(r.balasanAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                  </template><template v-if="r.balasanOleh">
                    · dikirim {{ r.balasanOleh }} dari sistem
                  </template>
                </p>
                {{ r.balasan }}
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <UButton
                  v-if="r.sumber === 'gbp'"
                  :label="buka === r.id ? 'Tutup' : r.balasan ? 'Ubah balasan' : 'Balas'"
                  :color="r.balasan ? 'neutral' : 'primary'"
                  :variant="r.balasan ? 'outline' : 'solid'"
                  size="xs"
                  @click="buka = buka === r.id ? '' : r.id"
                />
                <UButton
                  v-else-if="r.url"
                  label="Balas di Google"
                  icon="i-lucide-arrow-up-right"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :to="r.url"
                  target="_blank"
                />
                <UButton
                  :label="Number(r.ditangani) === 1 ? 'Batalkan tanda ditangani' : 'Tandai sudah ditangani'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  loading-auto
                  @click="tandai(r, Number(r.ditangani) !== 1)"
                />
              </div>
              <div
                v-if="buka === r.id && r.sumber === 'gbp'"
                class="mt-2 border-t border-dashed border-default pt-2"
              >
                <UTextarea
                  :model-value="draf[r.id] ?? r.balasan ?? ''"
                  :rows="4"
                  maxlength="4000"
                  placeholder="Tulis balasan… terbit publik di Google Maps atas nama bisnis."
                  class="w-full"
                  @update:model-value="(v: string | number) => draf[r.id] = String(v)"
                />
                <div class="mt-2 flex justify-end">
                  <UButton
                    label="Kirim ke Google"
                    size="sm"
                    :loading="kirimJalan === r.id"
                    @click="kirim(r)"
                  />
                </div>
                <p class="mt-1 text-xs text-muted">
                  Nomor reservasi resmi {{ NOMOR_RESERVASI_GREVIEW }} disisipkan otomatis bila balasan menyebut nomor lain.
                </p>
              </div>
            </div>
          </AppPanel>
        </template>
      </div>
    </AppPage>
  </KontenGerbang>
</template>
