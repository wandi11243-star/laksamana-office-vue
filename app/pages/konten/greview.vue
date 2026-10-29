<!--
  Konten › Google Review (deploy/konten/analytics/index.html #greview; D.24).
  Guest Google reviews: which need handling now, replied straight from here,
  and read by AI. No v1 contract yet (G-24), so the screen holds the "Segera"
  pattern (`idle/muat/ok/galat` + Coba lagi) and calls nothing else.
-->
<script setup lang="ts">
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
    if (saring.value === 'dibalas' && !r.balasan) return false
    if (saring.value === 'selesai' && Number(r.ditangani) !== 1) return false
    if (q && `${r.penulis} ${r.teks || ''} ${r.balasan || ''}`.toLowerCase().includes(q)) return true
    return !q
  })
  if (saring.value === 'tangani') out.sort((a, b) => (b.skor || 0) - (a.skor || 0))
  return out
})

const tempatPilih = ref('')
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

const segSegera = computed(() => (data.value?.review ?? []).filter(r => r.tingkat === 'segera').length)
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
          class="mb-4"
        />

        <AppPanel
          v-if="status !== 'ok'"
          title="Google Review"
        >
          <p
            v-if="status === 'muat' || status === 'idle'"
            class="py-6 text-center text-sm text-muted"
          >
            Memuat review…
          </p>
          <div v-else>
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-clock"
              title="Segera — menarik ulasan Google belum tersedia di sistem baru"
              description="Layar ini menunggu endpoint Google Review di API (G-24). Tidak ada data yang hilang: ulasan tetap tersimpan di Google."
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
                label="Sinkronkan"
                icon="i-lucide-refresh-cw"
                size="sm"
                :loading="sinkronJalan"
                @click="sinkronkan()"
              />
            </template>
            <p class="text-sm text-muted">
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
                class="rounded-field border border-default p-3"
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

          <AppPanel title="Review tamu">
            <template #head>
              <div class="flex w-full flex-wrap items-center gap-2">
                <AppSeg
                  v-model="saring"
                  size="sm"
                  :options="[
                    { value: 'tangani', label: `Perlu ditangani${segSegera ? ` (${segSegera} segera)` : ''}` },
                    { value: 'segera', label: 'Segera' },
                    { value: 'dibalas', label: 'Sudah dibalas' },
                    { value: 'selesai', label: 'Sudah ditangani' },
                    { value: 'semua', label: 'Semua' },
                  ]"
                />
                <USelect
                  v-if="tempat.length > 1"
                  v-model="tempatPilih"
                  :items="[{ value: '', label: 'Semua tempat' }, ...tempat.map(t => ({ value: t.id, label: t.nama || t.id }))]"
                  size="sm"
                  class="w-44"
                />
                <UInput
                  v-model="cari"
                  icon="i-lucide-search"
                  placeholder="Cari nama tamu atau isi review…"
                  size="sm"
                  class="min-w-44 flex-1"
                />
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
              class="border-b border-default py-3 last:border-0"
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
                    <span class="text-primary-700">{{ bintang(r.rating) }}</span>
                    · {{ r.waktuMs ? new Date(r.waktuMs).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}
                  </p>
                </div>
                <AppStatus
                  v-if="r.tingkat"
                  size="sm"
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
                class="mt-2 rounded-field bg-muted p-2.5 text-sm"
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
