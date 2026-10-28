<!--
  Promo — the website homepage slider: BD OS promos that have a poster, and
  banners uploaded right here (laksamana-api docs/api/homepage.md, Office ›
  Promos). One ordered list of both kinds. This screen owns the switch, the alt
  override, the link and the manual order; a BD promo's poster and period stay
  in BD and are never edited here. Switching ON requires the row to be eligible
  (a running BD promo with a poster, an upload inside its window); switching OFF
  is always allowed, so a promo that fell off the website can still be cleared.
  Order moves write PUT /urutan; a BD candidate has no row yet, so it only joins
  the order once it is switched on.
-->
<script setup lang="ts">
import type { PromoWeb, PromoBody } from '~/composables/useHomepage'
import { hariIni, tglPendek } from '~/utils/format'

definePageMeta({ access: ['homepage'] })

const toast = useToast()
const me = useMe()
const router = useRouter()
const office = usePromoOffice()

// The BD screen may not exist yet in this app: only offer the link when there
// really is a route for it (an unreachable link is worse than none).
const punyaLayarBd = computed(() => router.getRoutes().some(r => r.path === '/bd'))
const bolehBd = computed(() => punyaLayarBd.value && !!me.value?.modules.includes('bd'))

const { data, status: muat, error, refresh } = usePromoWeb()

// Local copy so a toggle can update one row without reloading the lot.
const items = ref<PromoWeb[]>([])
const bdGagal = ref(false)
watch(data, (d) => {
  items.value = d ? [...d.items] : []
  bdGagal.value = d?.bd_gagal ?? false
}, { immediate: true })

function ganti(row: PromoWeb) {
  // A candidate answers with its new stored row (new `id`, same `promo_id`), so
  // matching by id alone would miss it and leave the stale candidate in place.
  const i = items.value.findIndex(x =>
    (!!row.id && x.id === row.id) || (!!row.promo_id && x.promo_id === row.promo_id),
  )
  if (i >= 0) items.value.splice(i, 1, row)
}

// ─────────────────────────── thumbnails ──
// The office image route is behind Sanctum, so an <img src> cannot fetch it:
// pull the bytes through the API and show a blob URL. A missing image is fine.
// Keyed by the API's `gambar` URL, which carries `v=<hash>`: a replaced image is
// a new URL, so it is fetched again instead of showing the old blob.

const gambar = ref<Record<string, string>>({})

async function muatGambar(row: PromoWeb) {
  if (!row.gambar || gambar.value[row.gambar]) return
  try {
    const url = await officeGambarUrl(row.gambar)
    if (url) gambar.value[row.gambar] = url
  }
  catch { /* the thumbnail is optional; a failure just leaves the placeholder */ }
}

watch(items, (list) => {
  // Release the blobs of images no row points at any more (replaced or deleted).
  const dipakai = new Set(list.map(row => row.gambar).filter(Boolean))
  const tetap: Record<string, string> = {}
  for (const [src, blob] of Object.entries(gambar.value)) {
    if (dipakai.has(src)) tetap[src] = blob
    else URL.revokeObjectURL(blob)
  }
  gambar.value = tetap
  list.forEach(muatGambar)
}, { immediate: true })

onBeforeUnmount(() => {
  Object.values(gambar.value).forEach(URL.revokeObjectURL)
})

// ─────────────────────────── filters ──

type Saring = 'semua' | 'tampil' | 'belum'
const saring = ref<Saring>('semua')
const tersaring = computed(() => items.value.filter(p =>
  saring.value === 'semua' || (saring.value === 'tampil') === p.tampil,
))

const jumlah = computed(() => ({
  semua: items.value.length,
  tampil: items.value.filter(p => p.tampil).length,
  belum: items.value.filter(p => !p.tampil).length,
}))

const chip = computed(() => [
  { value: 'semua', label: `Semua · ${jumlah.value.semua}` },
  { value: 'tampil', label: `Tampil · ${jumlah.value.tampil}` },
  { value: 'belum', label: `Belum tampil · ${jumlah.value.belum}` },
])

// ─────────────────────────── display ──

type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral'

const judul = (p: PromoWeb) => p.bd?.nama || p.alt || 'Banner tanpa judul'
const sumberLabel = (p: PromoWeb) => (p.sumber === 'bd' ? 'BD OS' : 'Unggahan')

const STATUS_BD: Record<string, { color: Tone, icon: string, label: string }> = {
  running: { color: 'success', icon: 'i-lucide-play', label: 'Berjalan di BD' },
  upcoming: { color: 'info', icon: 'i-lucide-calendar-clock', label: 'Akan mulai' },
  paused: { color: 'warning', icon: 'i-lucide-pause', label: 'Dijeda di BD' },
  ended: { color: 'neutral', icon: 'i-lucide-circle-check', label: 'Berakhir di BD' },
}
const statusBd = (p: PromoWeb) =>
  p.bd ? STATUS_BD[p.bd.status] ?? { color: 'neutral' as Tone, icon: 'i-lucide-circle', label: p.bd.status } : null

/** BD's own period for a BD promo, the row's window for an upload. */
function periode(p: PromoWeb): string {
  const mulai = (p.sumber === 'bd' ? p.bd?.mulai : p.mulai) || ''
  const selesai = (p.sumber === 'bd' ? p.bd?.selesai : p.selesai) || ''
  if (!mulai && !selesai) return 'Tanpa batas periode'
  if (mulai && selesai) return `${tglPendek(mulai)} – ${tglPendek(selesai)}`
  return mulai ? `Mulai ${tglPendek(mulai)}` : `Sampai ${tglPendek(selesai)}`
}

const ALASAN: Record<string, { label: string, icon: string, color: Tone }> = {
  bd_belum_mulai: { label: 'Belum mulai', icon: 'i-lucide-clock', color: 'info' },
  bd_berakhir: { label: 'Sudah berakhir', icon: 'i-lucide-history', color: 'neutral' },
  bd_dijeda: { label: 'Dijeda di BD', icon: 'i-lucide-pause', color: 'warning' },
  bd_tanpa_poster: { label: 'Belum ada poster di BD', icon: 'i-lucide-image-off', color: 'warning' },
  bd_hilang: { label: 'Promo dihapus di BD', icon: 'i-lucide-circle-slash', color: 'neutral' },
  di_luar_periode: { label: 'Di luar periode tayang', icon: 'i-lucide-calendar-x', color: 'warning' },
}

function alasanMeta(p: PromoWeb) {
  // With BD unreachable every BD row loses its `bd` payload, so `bd_hilang`
  // there only means "cannot read it right now", not "deleted in BD".
  if (bdGagal.value && p.sumber === 'bd' && !p.bd) {
    return { label: 'BD OS tidak terhubung', icon: 'i-lucide-unplug', color: 'warning' as Tone }
  }
  // A missing upload file is the one "not eligible" the API reports without a
  // reason (the file vanished from disk).
  const dasar = ALASAN[p.alasan ?? ''] ?? (p.sumber === 'unggah'
    ? { label: 'Gambar tidak ada di server', icon: 'i-lucide-image-off', color: 'warning' as Tone }
    : { label: 'Tidak bisa tampil', icon: 'i-lucide-circle-alert', color: 'warning' as Tone })
  // "Belum mulai (mulai 3 Okt)" whenever BD knows the start date.
  if (p.alasan === 'bd_belum_mulai' && p.bd?.mulai) {
    return { ...dasar, label: `Belum mulai (mulai ${tglPendek(p.bd.mulai)})` }
  }
  return dasar
}

/** A switch may move when the row can go on (eligible) or is on and can go off. */
const bolehUbah = (p: PromoWeb) => p.eligible || p.tampil

// ─────────────────────────── writes ──

const sibuk = ref<Record<string, boolean>>({})
const sibukUrut = ref(false)

async function gantiTampil(p: PromoWeb, tampil: boolean) {
  const k = promoGambarKey(p)
  const lama = p
  ganti({ ...p, tampil })
  sibuk.value[k] = true
  try {
    // A candidate has no row yet: its own endpoint upserts one.
    const hasil = p.id
      ? await office.setTampil(p.id, tampil)
      : await office.setTampilBd(p.promo_id!, tampil)
    ganti(hasil)
    muatGambar(hasil)
    toast.add({ title: tampil ? 'Promo akan tampil di website' : 'Promo dihapus dari website', color: 'success' })
  }
  catch (e) {
    ganti(lama)
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value[k] = false
  }
}

/** Stored rows only: a candidate has no `urutan` until it is switched on. */
const berurutan = computed(() => items.value.filter(p => p.id))

function bisaGeser(p: PromoWeb, arah: -1 | 1): boolean {
  if (!p.id) return false
  const i = berurutan.value.findIndex(x => x.id === p.id)
  const j = i + arah
  return i >= 0 && j >= 0 && j < berurutan.value.length
}

async function geser(p: PromoWeb, arah: -1 | 1) {
  if (!bisaGeser(p, arah)) return
  const list = [...berurutan.value]
  const i = list.findIndex(x => x.id === p.id)
  const j = i + arah
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  const semula = items.value
  items.value = [...list, ...items.value.filter(x => !x.id)]
  sibukUrut.value = true
  try {
    await office.urutan(list.map((row, n) => ({ id: row.id!, urutan: (n + 1) * 10 })))
    // PUT /urutan bumps every row's version, so the local copies would 409 on
    // the next edit/delete. Reload and let the fresh list be the final order.
    await refresh()
  }
  catch (e) {
    items.value = semula
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibukUrut.value = false
  }
}

// ─────────────────────────── add / edit sheet ──

const sheet = ref(false)
/** The row being edited; null = a new upload banner. */
const diubah = ref<PromoWeb | null>(null)

interface FormPromo {
  gambar_key: string | null
  alt: string
  href: string
  mulai: string
  selesai: string
  tampil: boolean
}

const form = reactive<FormPromo>({ gambar_key: null, alt: '', href: '', mulai: '', selesai: '', tampil: true })

const pratinjauAsli = ref<string | null>(null) // the stored row's image, from the list thumbnails
const pratinjauLokal = ref<string | null>(null) // the picked file, before it is saved
const pratinjau = computed(() => pratinjauLokal.value ?? pratinjauAsli.value)
const inputGambar = ref<HTMLInputElement>()
const mengunggah = ref(false)
const menyimpan = ref(false)
const yakinHapus = ref(false)

const isBd = computed(() => diubah.value?.sumber === 'bd')
const judulSheet = computed(() => (!diubah.value ? 'Tambah banner' : (isBd.value ? 'Atur promo BD' : 'Ubah banner')))
const deskripsiSheet = computed(() => {
  if (!diubah.value) return 'Banner unggahan untuk poster yang tidak ada di BD OS.'
  if (isBd.value) return 'Hanya teks alternatif dan tautan yang bisa diubah di sini.'
  return 'Perubahan banner unggahan.'
})

function bersihLokal() {
  if (pratinjauLokal.value) URL.revokeObjectURL(pratinjauLokal.value)
  pratinjauLokal.value = null
}

function buka(row: PromoWeb | null) {
  bersihLokal()
  diubah.value = row
  yakinHapus.value = false
  form.gambar_key = null
  form.alt = row?.alt ?? ''
  form.href = row?.href ?? ''
  form.mulai = row?.mulai ?? ''
  form.selesai = row?.selesai ?? ''
  form.tampil = row ? row.tampil : true
  // An upload row's stored image is already a blob URL in the list.
  pratinjauAsli.value = row?.sumber === 'unggah' ? (row.gambar ? gambar.value[row.gambar] : undefined) ?? null : null
  sheet.value = true
}

const MAKS = 8 * 1024 * 1024
const JENIS = ['image/jpeg', 'image/png', 'image/webp']

async function pilihGambar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (inputGambar.value) inputGambar.value.value = ''
  if (!file) return
  if (!JENIS.includes(file.type)) {
    toast.add({ title: 'Pilih gambar JPG, PNG, atau WebP.', color: 'error' })
    return
  }
  if (file.size > MAKS) {
    toast.add({ title: 'Ukuran gambar maksimal 8 MB.', color: 'error' })
    return
  }
  mengunggah.value = true
  try {
    // The upload endpoint only hands back the key (url is always null): the
    // bytes are served later by row id, so the local file is the preview.
    const hasil = await office.uploadFoto(file)
    form.gambar_key = hasil.key
    bersihLokal()
    pratinjauLokal.value = URL.createObjectURL(file)
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, 'Gagal mengunggah gambar.'), color: 'error' })
  }
  finally {
    mengunggah.value = false
  }
}

function hapusGambar() {
  bersihLokal()
  form.gambar_key = null // an existing upload keeps its stored file
}

async function simpan() {
  const bd = isBd.value
  // Only a NEW banner needs a picture: an existing upload keeps its stored file.
  if (!bd && !diubah.value && !form.gambar_key) {
    toast.add({ title: 'Pilih gambar dulu.', color: 'error' })
    return
  }
  if (!bd && !form.alt.trim()) {
    toast.add({ title: 'Isi teks alternatif gambar.', color: 'error' })
    return
  }
  const href = form.href.trim()
  if (href && !href.startsWith('https://') && !(href.startsWith('/') && !href.startsWith('//'))) {
    toast.add({ title: 'Tautan hanya boleh https://… atau path yang diawali /.' })
    return
  }
  if (!bd && form.mulai && form.selesai && form.mulai > form.selesai) {
    toast.add({ title: 'Tanggal mulai tidak boleh melewati selesai.' })
    return
  }

  const body: PromoBody = { alt: form.alt.trim() || null, href: href || null }
  if (!bd) {
    body.mulai = form.mulai || null
    body.selesai = form.selesai || null
    if (form.gambar_key) body.gambar_key = form.gambar_key
  }

  if (!diubah.value && form.tampil) {
    // A new banner may only go live inside its window (the API refuses too).
    const hari = hariIni()
    if ((form.mulai && hari < form.mulai) || (form.selesai && hari > form.selesai)) {
      toast.add({
        title: 'Periode di luar hari ini',
        description: 'Banner belum bisa ditampilkan sebelum periodenya. Matikan "Tampil di website" dulu, lalu nyalakan lewat saklar saat periodenya mulai.',
        color: 'warning',
      })
      return
    }
  }

  menyimpan.value = true
  try {
    if (diubah.value?.id) {
      await office.update(diubah.value.id, body, ifMatch(diubah.value.version))
      toast.add({ title: 'Promo disimpan', color: 'success' })
    }
    else {
      await office.create({ ...body, gambar_key: form.gambar_key!, tampil: form.tampil })
      toast.add({ title: 'Banner ditambahkan', color: 'success' })
    }
    sheet.value = false
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

/** After a version conflict: reload the list and point the sheet at the fresh row. */
async function muatUlang() {
  await refresh()
  const terbaru = items.value.find(x => x.id === diubah.value?.id)
  if (terbaru) diubah.value = terbaru
}

async function hapus() {
  const row = diubah.value
  if (!row?.id) return
  if (!yakinHapus.value) {
    yakinHapus.value = true
    return
  }
  menyimpan.value = true
  try {
    await office.remove(row.id, ifMatch(row.version))
    toast.add({ title: 'Banner dihapus', color: 'success' })
    sheet.value = false
    await refresh()
  }
  catch (e) {
    yakinHapus.value = false
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <AppPage
    title="Promo"
    description="Slider promo di beranda website: promo BD OS yang berjalan dan banner unggahan."
  >
    <template #actions>
      <UButton
        label="Lihat di website"
        icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
        :to="websiteUrl('/')"
        target="_blank"
      />
      <UButton
        label="Tambah banner"
        icon="i-lucide-image-plus"
        @click="buka(null)"
      />
    </template>

    <div
      v-if="error"
      class="rounded-panel border border-default bg-default p-6 text-center"
    >
      <p class="font-semibold text-highlighted">
        Promo tidak bisa dimuat.
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ apiErrorMessage(error) }}
      </p>
      <UButton
        label="Coba lagi"
        class="mt-4"
        @click="refresh()"
      />
    </div>

    <template v-else>
      <!-- Data ownership: this screen never edits the BD promo itself. -->
      <div class="mb-4 flex flex-wrap items-start gap-3 rounded-panel border border-info/30 bg-info/10 p-4">
        <UIcon
          name="i-lucide-info"
          class="mt-0.5 size-5 shrink-0 text-info"
        />
        <p class="min-w-0 flex-1 text-sm text-default">
          Poster &amp; periode promo BD diubah di BD OS. Layar ini hanya menentukan mana yang tampil, urutannya, dan banner unggahannya.
        </p>
        <UButton
          v-if="bolehBd"
          label="Buka modul BD"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="outline"
          size="sm"
          to="/bd"
        />
      </div>

      <div
        v-if="bdGagal"
        class="mb-4 flex items-start gap-3 rounded-panel border border-warning/30 bg-warning/10 p-4"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="mt-0.5 size-5 shrink-0 text-warning"
        />
        <p class="min-w-0 flex-1 text-sm text-default">
          BD OS tidak terhubung — hanya banner unggahan yang tampil.
        </p>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <AppChips
          v-model="saring"
          :options="chip"
        />
      </div>

      <div
        v-if="muat === 'pending' && !items.length"
        class="space-y-2"
      >
        <USkeleton
          v-for="n in 4"
          :key="n"
          :ui="{ base: 'bg-accented/70' }"
          class="h-24 rounded-md"
        />
      </div>

      <div
        v-else-if="!items.length"
        class="rounded-panel border border-dashed border-accented bg-default px-6 py-12 text-center"
      >
        <UIcon
          name="i-lucide-images"
          class="size-8 text-dimmed"
        />
        <p class="mt-3 font-semibold text-highlighted">
          Belum ada promo di slider
        </p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted">
          Promo BD OS yang berjalan dan punya poster muncul di sini sebagai kandidat. Tambahkan banner unggahan kalau posternya belum ada di BD.
        </p>
        <UButton
          label="Tambah banner"
          icon="i-lucide-image-plus"
          class="mt-5"
          @click="buka(null)"
        />
      </div>

      <p
        v-else-if="!tersaring.length"
        class="rounded-panel border border-default bg-default px-6 py-10 text-center text-sm text-muted"
      >
        Tidak ada promo yang cocok dengan saringan ini.
      </p>

      <AppPanel
        v-else
        flush
        title="Slider website"
        :count="tersaring.length"
        description="Urutan di sini sama dengan urutan slide di beranda website."
      >
        <ul class="divide-y divide-default">
          <li
            v-for="p in tersaring"
            :key="promoGambarKey(p)"
            class="flex flex-wrap gap-3 p-3 lg:flex-nowrap lg:items-center lg:gap-4 lg:px-4"
          >
            <div class="aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36 lg:w-44">
              <img
                v-if="p.gambar && gambar[p.gambar]"
                :src="gambar[p.gambar]"
                alt=""
                loading="lazy"
                class="size-full object-cover"
                :class="!p.tampil && 'opacity-50'"
              >
              <span
                v-else
                class="flex size-full items-center justify-center"
              >
                <UIcon
                  name="i-lucide-image"
                  class="size-5 text-dimmed"
                />
              </span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <UBadge
                  :label="sumberLabel(p)"
                  :color="p.sumber === 'bd' ? 'primary' : 'neutral'"
                  variant="soft"
                  size="sm"
                />
                <!-- When it cannot show, the reason already names the BD state
                     ("Dijeda di BD", "Sudah berakhir"), so the status pill would
                     only repeat it. -->
                <AppStatus
                  v-if="statusBd(p) && p.eligible"
                  :color="statusBd(p)!.color"
                  :icon="statusBd(p)!.icon"
                  size="sm"
                >
                  {{ statusBd(p)!.label }}
                </AppStatus>
                <AppStatus
                  v-if="!p.eligible"
                  :color="alasanMeta(p).color"
                  :icon="alasanMeta(p).icon"
                  size="sm"
                >
                  {{ alasanMeta(p).label }}
                </AppStatus>
              </div>

              <p
                class="mt-1 font-semibold leading-snug"
                :class="p.tampil ? 'text-highlighted' : 'text-muted'"
              >
                {{ judul(p) }}
              </p>
              <p class="mt-0.5 text-xs text-muted">
                <span class="num">{{ periode(p) }}</span>
                <template v-if="p.bd?.benefit">
                  <span aria-hidden="true"> · </span>{{ p.bd.benefit }}
                </template>
              </p>
            </div>

            <!-- One controls block: a full line under the card on phones, a
                 column on the right from lg up. -->
            <div class="flex w-full items-center justify-between gap-2 border-t border-default pt-2.5 lg:w-auto lg:flex-col lg:items-end lg:gap-1.5 lg:border-0 lg:pt-0">
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <USwitch
                  :model-value="p.tampil"
                  :disabled="sibuk[promoGambarKey(p)] || !bolehUbah(p)"
                  color="success"
                  :aria-label="`Tampil di website: ${judul(p)}`"
                  @update:model-value="gantiTampil(p, $event)"
                />
                <span :class="p.tampil ? 'font-semibold text-success' : 'text-muted'">
                  {{ p.tampil ? 'Tampil di website' : 'Belum tampil' }}
                </span>
              </label>

              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-chevron-up"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="!bisaGeser(p, -1) || sibukUrut"
                  :aria-label="`Naikkan ${judul(p)}`"
                  @click="geser(p, -1)"
                />
                <UButton
                  icon="i-lucide-chevron-down"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="!bisaGeser(p, 1) || sibukUrut"
                  :aria-label="`Turunkan ${judul(p)}`"
                  @click="geser(p, 1)"
                />
                <UButton
                  v-if="p.id"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :aria-label="`Atur ${judul(p)}`"
                  @click="buka(p)"
                />
              </div>
            </div>
          </li>
        </ul>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="judulSheet"
      :description="deskripsiSheet"
    >
      <div class="space-y-4">
        <div v-if="!isBd">
          <p class="mb-1.5 text-sm font-semibold text-highlighted">
            Gambar <span class="text-error">*</span>
          </p>
          <div class="relative aspect-video overflow-hidden rounded-panel border border-default bg-muted">
            <img
              v-if="pratinjau"
              :src="pratinjau"
              alt=""
              class="size-full object-cover"
            >
            <button
              v-else
              type="button"
              class="flex size-full flex-col items-center justify-center gap-1.5 text-muted hover:text-highlighted"
              @click="inputGambar?.click()"
            >
              <UIcon
                name="i-lucide-image-plus"
                class="size-7"
              />
              <span class="text-sm font-semibold">Pilih gambar</span>
              <span class="text-xs text-dimmed">Saran 16:9 · JPG, PNG, WebP · maks. 8 MB</span>
            </button>
            <div
              v-if="mengunggah"
              class="absolute inset-0 flex items-center justify-center bg-default/70"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="size-6 animate-spin text-primary"
              />
            </div>
          </div>
          <div
            v-if="pratinjau"
            class="mt-2 flex gap-2"
          >
            <UButton
              label="Ganti"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="mengunggah"
              @click="inputGambar?.click()"
            />
            <!-- Clearing only makes sense for a freshly picked file: an
                 existing row cannot lose its image (PATCH keeps the stored key). -->
            <UButton
              v-if="form.gambar_key"
              :label="diubah ? 'Batalkan ganti' : 'Hapus'"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="mengunggah"
              @click="hapusGambar"
            />
          </div>
          <input
            ref="inputGambar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="pilihGambar"
          >
        </div>

        <div
          v-else
          class="flex flex-wrap items-start gap-3 rounded-panel border border-info/30 bg-info/10 p-3"
        >
          <UIcon
            name="i-lucide-info"
            class="mt-0.5 size-5 shrink-0 text-info"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-default">
              Poster &amp; periode diubah di BD OS.
            </p>
            <UButton
              v-if="bolehBd"
              label="Buka modul BD"
              trailing-icon="i-lucide-arrow-right"
              color="neutral"
              variant="outline"
              size="sm"
              to="/bd"
              class="mt-2"
            />
          </div>
        </div>

        <UFormField
          label="Teks alternatif"
          :required="!isBd"
          :help="isBd ? 'Kosongkan untuk memakai nama promo dari BD.' : 'Jelaskan isi gambar untuk pembaca layar.'"
        >
          <UInput
            v-model="form.alt"
            :placeholder="diubah?.bd?.nama ?? 'mis. Promo kopi 1+1 bulan Oktober'"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Tautan"
          hint="opsional"
          help="https://… atau path di website, mis. /reservasi"
        >
          <UInput
            v-model="form.href"
            placeholder="https://…"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <template v-if="!isBd">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Mulai"
              hint="opsional"
            >
              <UInput
                v-model="form.mulai"
                type="date"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Selesai"
              hint="opsional"
            >
              <UInput
                v-model="form.selesai"
                type="date"
                size="xl"
                class="w-full"
              />
            </UFormField>
          </div>
          <p class="text-xs text-muted">
            Kosongkan keduanya untuk tayang tanpa batas periode.
          </p>
          <label
            v-if="!diubah"
            class="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-default p-3"
          >
            <span>
              <span class="block text-sm font-semibold text-highlighted">Tampil di website</span>
              <span class="block text-xs text-muted">Bisa diubah kapan saja lewat saklar di daftar.</span>
            </span>
            <USwitch
              v-model="form.tampil"
              color="success"
            />
          </label>
        </template>
      </div>

      <template #footer>
        <UButton
          :label="diubah ? 'Simpan' : 'Tambah banner'"
          icon="i-lucide-check"
          size="xl"
          :loading="menyimpan"
          :disabled="mengunggah"
          @click="simpan"
        />
        <UButton
          v-if="diubah?.sumber === 'unggah'"
          :label="yakinHapus ? 'Yakin hapus banner ini?' : 'Hapus banner'"
          icon="i-lucide-trash-2"
          color="error"
          :variant="yakinHapus ? 'solid' : 'ghost'"
          size="xl"
          :loading="menyimpan && yakinHapus"
          :disabled="menyimpan || mengunggah"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          :disabled="menyimpan"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
