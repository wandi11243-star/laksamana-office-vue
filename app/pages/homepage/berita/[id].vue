<!--
  Write or edit one article (`/homepage/berita/baru` creates). Writing on the
  left (title, summary, body), publishing on the right (status and date,
  category, author, address, cover) with a preview of the card the website
  will show. The body goes through the API's sanitizer on save, so the toolbar
  only offers what that allow-list keeps (docs/api/news.md › Write rules).
  Existing articles save with If-Match; leaving with unsaved edits asks first.
-->
<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { BeritaArtikel, BeritaBody } from '~/composables/useHomepage'

definePageMeta({ access: ['news'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const me = useMe()
const office = useBeritaOffice()

const id = computed(() => String(route.params.id))
const baru = computed(() => id.value === 'baru')

const { data: state, refresh: refreshState } = useBeritaState()
const kategori = computed(() => [...(state.value?.kategori ?? [])].sort((a, b) => a.urutan - b.urutan))
const opsiKategori = computed(() => kategori.value.map(k => ({ label: k.aktif ? k.nama : `${k.nama} (disembunyikan)`, value: k.id })))

const artikel = ref<BeritaArtikel | null>(null)
const memuat = ref(!baru.value)
const gagal = ref<unknown>(null)

// ─────────────────────────── form ──

interface Form {
  judul: string
  slug: string
  kategori_id: string
  ringkasan: string
  isi: string
  cover_key: string | null
  penulis: string
  tampil: boolean
  /** `YYYY-MM-DDTHH:mm`, WIB wall time (the API reads an offset-less value as WIB). */
  tanggal: string
}

const form = reactive<Form>({
  judul: '', slug: '', kategori_id: '', ringkasan: '', isi: '', cover_key: null, penulis: '', tampil: false, tanggal: '',
})
const asal = ref('')
const snapshot = () => JSON.stringify(form)
const berubah = computed(() => snapshot() !== asal.value)

function isi(a: BeritaArtikel | null) {
  Object.assign(form, a
    ? {
        judul: a.title,
        slug: a.slug,
        kategori_id: a.kategori_id,
        ringkasan: a.excerpt ?? '',
        isi: a.content ?? '',
        cover_key: a.cover_key,
        penulis: a.author ?? '',
        tampil: a.tampil,
        // The API sends WIB (+07:00): its first 16 characters are the wall time.
        tanggal: a.published_at?.slice(0, 16) ?? '',
      }
    : {
        judul: '', slug: '', kategori_id: kategori.value.find(k => k.aktif)?.id ?? '', ringkasan: '', isi: '',
        cover_key: null, penulis: me.value?.name ?? '', tampil: false, tanggal: '',
      })
  asal.value = snapshot()
}

async function muat() {
  gagal.value = null
  if (baru.value) {
    artikel.value = null
    isi(null)
    memuat.value = false
    return
  }
  memuat.value = true
  try {
    artikel.value = await office.getArtikel(id.value)
    isi(artikel.value)
  }
  catch (e) {
    gagal.value = e
  }
  finally {
    memuat.value = false
  }
}
watch(id, muat, { immediate: true })
// A new article waits for the categories to pick a default.
watch(kategori, (k) => {
  if (baru.value && !form.kategori_id && k.length) {
    form.kategori_id = k.find(x => x.aktif)?.id ?? ''
    asal.value = snapshot()
  }
})

const slugOtomatis = computed(() => form.judul.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 190))

// ─────────────────────────── editor ──

const toolbar: EditorToolbarItem[][] = [
  [
    { 'kind': 'undo', 'icon': 'i-lucide-undo-2', 'tooltip': { text: 'Urungkan' }, 'aria-label': 'Urungkan' },
    { 'kind': 'redo', 'icon': 'i-lucide-redo-2', 'tooltip': { text: 'Ulangi' }, 'aria-label': 'Ulangi' },
  ],
  [
    { 'kind': 'heading', 'level': 2, 'icon': 'i-lucide-heading-2', 'tooltip': { text: 'Subjudul' }, 'aria-label': 'Subjudul' },
    { 'kind': 'heading', 'level': 3, 'icon': 'i-lucide-heading-3', 'tooltip': { text: 'Subjudul kecil' }, 'aria-label': 'Subjudul kecil' },
  ],
  [
    { 'kind': 'mark', 'mark': 'bold', 'icon': 'i-lucide-bold', 'tooltip': { text: 'Tebal' }, 'aria-label': 'Tebal' },
    { 'kind': 'mark', 'mark': 'italic', 'icon': 'i-lucide-italic', 'tooltip': { text: 'Miring' }, 'aria-label': 'Miring' },
    { 'kind': 'mark', 'mark': 'underline', 'icon': 'i-lucide-underline', 'tooltip': { text: 'Garis bawah' }, 'aria-label': 'Garis bawah' },
    { 'kind': 'mark', 'mark': 'strike', 'icon': 'i-lucide-strikethrough', 'tooltip': { text: 'Coret' }, 'aria-label': 'Coret' },
  ],
  [
    { 'kind': 'bulletList', 'icon': 'i-lucide-list', 'tooltip': { text: 'Daftar' }, 'aria-label': 'Daftar' },
    { 'kind': 'orderedList', 'icon': 'i-lucide-list-ordered', 'tooltip': { text: 'Daftar bernomor' }, 'aria-label': 'Daftar bernomor' },
    { 'kind': 'blockquote', 'icon': 'i-lucide-text-quote', 'tooltip': { text: 'Kutipan' }, 'aria-label': 'Kutipan' },
    { 'kind': 'link', 'icon': 'i-lucide-link', 'tooltip': { text: 'Tautan' }, 'aria-label': 'Tautan' },
  ],
]

// ─────────────────────────── save ──

const menyimpan = ref(false)
const mengunggah = ref(false)
const yakinHapus = ref(false)
let lepas = false

function body(tampil: boolean): BeritaBody {
  const b: BeritaBody = {
    judul: form.judul.trim(),
    kategori_id: form.kategori_id,
    ringkasan: form.ringkasan.trim() || null,
    isi: form.isi.trim() && form.isi !== '<p></p>' ? form.isi : null,
    cover_key: form.cover_key,
    penulis: form.penulis.trim() || null,
    tampil,
    published_at: form.tanggal ? `${form.tanggal}:00` : null,
  }
  const slug = form.slug.trim()
  if (slug && slug !== artikel.value?.slug) b.slug = slug
  return b
}

async function simpan(tampil: boolean) {
  if (!form.judul.trim()) {
    toast.add({ title: 'Judul wajib diisi.', color: 'error' })
    return
  }
  if (!form.kategori_id) {
    toast.add({ title: 'Pilih kategori.', color: 'error' })
    return
  }
  const sudahTerbit = !!artikel.value?.tampil
  menyimpan.value = true
  try {
    const hasil = artikel.value
      ? await office.updateArtikel(artikel.value.id, body(tampil), ifMatch(artikel.value.version))
      : await office.createArtikel(body(tampil))
    artikel.value = hasil
    isi(hasil)
    refreshState()
    toast.add({
      title: hasil.tampil ? (sudahTerbit ? 'Berita disimpan' : 'Berita diterbitkan') : (sudahTerbit ? 'Berita dijadikan draf' : 'Draf disimpan'),
      color: 'success',
    })
    if (baru.value) {
      lepas = true
      await router.replace(`/homepage/berita/${hasil.id}`)
      lepas = false
    }
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muat))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

async function hapus() {
  if (!artikel.value) return
  if (!yakinHapus.value) {
    yakinHapus.value = true
    return
  }
  menyimpan.value = true
  try {
    await office.deleteArtikel(artikel.value.id, ifMatch(artikel.value.version))
    toast.add({ title: 'Berita dihapus', color: 'success' })
    refreshState()
    lepas = true
    await router.push('/homepage/berita')
  }
  catch (e) {
    yakinHapus.value = false
    if (!(await tanganiKonflik(e, muat))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

onBeforeRouteLeave(() => {
  if (!lepas && berubah.value && !window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')) return false
})

// ─────────────────────────── header ──

const diBeranda = computed(() => !!artikel.value && beritaDiBeranda(state.value).has(artikel.value.id))
const keterangan = computed(() => {
  const a = artikel.value
  if (!a) return 'Draf baru. Belum terlihat di website sampai diterbitkan.'
  if (!a.tampil) return a.published_at ? `Draf · bertanggal ${tglBerita(a.date)}` : 'Draf · belum pernah terbit'
  return `Terbit ${tglBerita(a.date)}${diBeranda.value ? ' · tampil di beranda' : ''}`
})
const kategoriNama = computed(() => kategori.value.find(k => k.id === form.kategori_id)?.nama ?? 'Kategori')
</script>

<template>
  <AppPage
    :title="baru ? 'Tulis berita' : 'Ubah berita'"
    :description="keterangan"
    :back="{ label: 'Berita', to: '/homepage/berita' }"
  >
    <template
      v-if="!memuat && !gagal"
      #actions
    >
      <UButton
        v-if="artikel?.tampil"
        label="Lihat di website"
        icon="i-lucide-external-link"
        color="neutral"
        variant="ghost"
        :to="websiteUrl(`/news/${artikel.slug}`)"
        target="_blank"
      />
      <template v-if="artikel?.tampil">
        <UButton
          label="Jadikan draf"
          color="neutral"
          variant="outline"
          :disabled="menyimpan || mengunggah"
          @click="simpan(false)"
        />
        <UButton
          label="Simpan"
          icon="i-lucide-check"
          :loading="menyimpan"
          :disabled="!berubah || mengunggah"
          @click="simpan(true)"
        />
      </template>
      <template v-else>
        <UButton
          :label="baru ? 'Simpan draf' : 'Simpan'"
          color="neutral"
          variant="outline"
          :loading="menyimpan"
          :disabled="(!berubah && !baru) || mengunggah"
          @click="simpan(false)"
        />
        <UButton
          label="Terbitkan"
          icon="i-lucide-send"
          :disabled="menyimpan || mengunggah"
          @click="simpan(true)"
        />
      </template>
    </template>

    <div
      v-if="memuat"
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <USkeleton
        :ui="{ base: 'bg-accented/70' }"
        class="h-96 rounded-panel"
      />
      <USkeleton
        :ui="{ base: 'bg-accented/70' }"
        class="h-72 rounded-panel"
      />
    </div>

    <div
      v-else-if="gagal"
      class="rounded-panel border border-default bg-default p-6 text-center"
    >
      <p class="font-semibold text-highlighted">
        Berita tidak bisa dimuat.
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ apiErrorMessage(gagal) }}
      </p>
      <UButton
        label="Kembali ke daftar"
        to="/homepage/berita"
        class="mt-4"
      />
    </div>

    <div
      v-else
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <!-- Writing -->
      <div class="min-w-0 rounded-panel border border-default bg-default">
        <div class="space-y-4 p-4 sm:p-6">
          <textarea
            v-model="form.judul"
            rows="1"
            placeholder="Judul berita"
            aria-label="Judul"
            class="block w-full resize-none bg-transparent font-display text-2xl font-bold leading-tight text-highlighted outline-none [field-sizing:content] placeholder:text-dimmed sm:text-3xl"
          />
          <UFormField
            label="Ringkasan"
            hint="Tampil di kartu beranda dan daftar berita"
          >
            <UTextarea
              v-model="form.ringkasan"
              :rows="2"
              autoresize
              placeholder="Satu-dua kalimat yang membuat orang ingin membaca."
              class="w-full"
            />
            <template #help>
              <span :class="form.ringkasan.length > 180 ? 'text-warning' : ''">{{ form.ringkasan.length }} karakter{{ form.ringkasan.length > 180 ? ' · terlalu panjang untuk kartu' : '' }}</span>
            </template>
          </UFormField>
        </div>

        <UEditor
          v-slot="{ editor }"
          v-model="form.isi"
          content-type="html"
          placeholder="Tulis isi berita…"
          :image="false"
          :mention="false"
          :starter-kit="{ code: false, codeBlock: false, heading: { levels: [2, 3] }, link: { openOnClick: false } }"
          class="border-t border-default"
          :ui="{ base: 'min-h-80 px-4 py-4 sm:px-6' }"
        >
          <UEditorToolbar
            :editor="editor"
            :items="toolbar"
            class="sticky top-[57px] z-[5] flex-wrap border-b border-default bg-default/95 px-2 py-1.5 backdrop-blur-sm sm:px-4 lg:top-[65px]"
          />
        </UEditor>
      </div>

      <!-- Publishing -->
      <aside class="space-y-4 lg:sticky lg:top-24">
        <section class="divide-y divide-default rounded-panel border border-default bg-default">
          <div class="flex items-center gap-3 p-4">
            <UIcon
              :name="artikel?.tampil ? 'i-lucide-globe' : 'i-lucide-file-pen-line'"
              class="size-5 shrink-0"
              :class="artikel?.tampil ? 'text-success' : 'text-muted'"
            />
            <span>
              <span
                class="block text-sm font-semibold"
                :class="artikel?.tampil ? 'text-success' : 'text-highlighted'"
              >{{ artikel?.tampil ? 'Terbit' : 'Draf' }}</span>
              <span class="block text-xs text-muted">{{ artikel?.tampil ? 'Terlihat di website' : 'Hanya terlihat di Office' }}</span>
            </span>
          </div>
          <div class="space-y-4 p-4">
            <UFormField
              label="Tanggal terbit"
              hint="WIB"
              help="Berita terbaru tampil paling depan. Kosongkan: diisi otomatis saat terbit."
            >
              <UInput
                v-model="form.tanggal"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Kategori"
              required
            >
              <USelect
                v-model="form.kategori_id"
                :items="opsiKategori"
                value-key="value"
                placeholder="Pilih kategori"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Penulis">
              <UInput
                v-model="form.penulis"
                placeholder="mis. Tim Laksamana"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Alamat"
              :help="artikel ? 'Mengubah alamat membuat tautan lama tidak berlaku.' : 'Kosongkan untuk dibuat dari judul.'"
            >
              <UInput
                v-model="form.slug"
                :placeholder="slugOtomatis || 'dibuat-dari-judul'"
                class="w-full"
                :ui="{ leading: 'pe-0', base: 'ps-[3.9rem]' }"
              >
                <template #leading>
                  <span class="text-sm text-dimmed">/news/</span>
                </template>
              </UInput>
            </UFormField>
          </div>
        </section>

        <section class="rounded-panel border border-default bg-default p-4">
          <HomepageFoto
            v-model="form.cover_key"
            :url="artikel?.cover ?? null"
            :upload="office.uploadCover"
            aspect="aspect-[16/10]"
            label="Gambar sampul"
            @sibuk="mengunggah = $event"
          />

          <p class="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-dimmed">
            Tampilan di kartu
          </p>
          <div class="overflow-hidden rounded-field border border-default">
            <div class="aspect-[16/10] bg-muted">
              <img
                v-if="form.cover_key"
                :src="apiFileUrl(`/api/v1/news/foto/${form.cover_key}`)!"
                alt=""
                class="size-full object-cover"
              >
            </div>
            <div class="p-3">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                {{ kategoriNama }}
              </p>
              <p class="mt-1 line-clamp-2 font-display font-bold leading-snug text-highlighted">
                {{ form.judul || 'Judul berita' }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs text-muted">
                {{ form.ringkasan || 'Ringkasan tampil di sini.' }}
              </p>
              <p class="mt-2 text-[11px] text-dimmed">
                {{ form.tanggal ? tglBerita(form.tanggal.slice(0, 10)) : 'Tanggal terbit' }}
              </p>
            </div>
          </div>
        </section>

        <UButton
          v-if="artikel"
          :label="yakinHapus ? 'Yakin hapus berita ini?' : 'Hapus berita'"
          icon="i-lucide-trash-2"
          color="error"
          :variant="yakinHapus ? 'solid' : 'ghost'"
          block
          :loading="menyimpan && yakinHapus"
          @click="hapus"
        />
      </aside>
    </div>
  </AppPage>
</template>
