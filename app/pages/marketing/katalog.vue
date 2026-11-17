<!--
  Marketing › Katalog (docs/migrasi/marketing.md D.15, issue #62): venue
  presentation material. Two faces of ONE list (the `katalog` document): the
  card page where marketing arranges it, and the full-screen presentation
  shown to the client — so what is presented is always what was edited.
  Card order = slide order (↑/↓, not drag: the whole picture is already a
  click target). Upload: images only, 8 MB, title guessed from the file name.
-->
<script setup lang="ts">
import type { SlideKatalogMkt } from '~/utils/marketing-operasional'
import { cekGambarKatalogMkt, geserSlideMkt, tebakJudulMkt } from '~/utils/marketing-operasional'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st, status } = useStateMkt()
const { can, saya } = useAksesMkt()
const bisaUbah = computed(() => can('edit_katalog'))
const slides = computed(() => (st.value.katalog ?? []) as unknown as SlideKatalogMkt[])

const sibuk = ref(false)
const tulis = (ubah: (k: SlideKatalogMkt[]) => SlideKatalogMkt[]) =>
  ubahDokumenMkt<SlideKatalogMkt[] | null>('katalog', k => ubah(Array.isArray(k) ? k : []))
const idBaru = () => `kat${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

async function unggahSatu(f: File): Promise<{ key: string, name: string } | null> {
  const salah = cekGambarKatalogMkt(f.name, f.size)
  if (salah) {
    toast.add({ title: salah.judul, description: salah.isi, color: 'error' })
    return null
  }
  try {
    const r = await unggahBerkasMkt({ dataBase64: await berkasKeBase64(f), fileName: f.name, mimeType: f.type || 'image/jpeg' })
    return { key: r.data.key, name: f.name }
  }
  catch (e) {
    toast.add({ title: 'Gagal unggah', description: `${f.name}: ${apiErrorMessage(e)}`, color: 'error' })
    return null
  }
}

async function tambah(files: FileList | null) {
  const daftar = [...(files ?? [])]
  if (!daftar.length) return
  sibuk.value = true
  const baru: SlideKatalogMkt[] = []
  for (const f of daftar) {
    const b = await unggahSatu(f)
    if (b) baru.push({ id: idBaru(), judul: tebakJudulMkt(f.name), sub: '', desc: '', key: b.key, name: b.name, at: new Date().toISOString(), by: saya.value?.user.name ?? '' })
  }
  if (baru.length) {
    await mktSimpan(() => tulis(k => [...k, ...baru]), `${baru.length} gambar masuk katalog. Rapikan judul & deskripsinya lewat tombol Edit.`, { refType: 'katalog', refId: '-', action: `${baru.length} slide katalog ditambahkan`, detail: '' })
  }
  sibuk.value = false
}

// ---- edit
const edit = reactive({ buka: false, id: '', judul: '', sub: '', desc: '', file: null as File | null })
const slideEdit = computed(() => slides.value.find(x => x.id === edit.id) ?? null)
function bukaEdit(s: SlideKatalogMkt) {
  Object.assign(edit, { buka: true, id: s.id, judul: s.judul ?? '', sub: s.sub ?? '', desc: s.desc ?? '', file: null })
}
async function simpanEdit() {
  const s = slideEdit.value
  if (!s) return
  sibuk.value = true
  let gambar: { key: string, name: string } | null = null
  if (edit.file) {
    gambar = await unggahSatu(edit.file)
    if (!gambar) {
      sibuk.value = false
      return
    }
  }
  const isi = { judul: edit.judul.trim(), sub: edit.sub.trim(), desc: edit.desc, ...(gambar ?? {}) }
  const ok = await mktSimpan(() => tulis(k => k.map(x => (x.id === s.id ? { ...x, ...isi } : x))), 'Slide tersimpan', { refType: 'katalog', refId: s.id, action: 'Slide katalog disimpan', detail: isi.judul || '(tanpa judul)' })
  sibuk.value = false
  if (ok) edit.buka = false
}
async function hapus(s: SlideKatalogMkt) {
  if (!confirm(`Hapus slide katalog "${s.judul || s.name || '(tanpa judul)'}"?\n\nSlide ini akan hilang dari halaman Katalog dan dari presentasi.`)) return
  await mktSimpan(() => tulis(k => k.filter(x => x.id !== s.id)), 'Slide dihapus', { refType: 'katalog', refId: s.id, action: 'Slide katalog dihapus', detail: s.judul ?? '' })
}
async function geser(i: number, arah: -1 | 1) {
  sibuk.value = true
  // Swap by id inside the CURRENT document, so a concurrent edit is not undone.
  const a = slides.value[i]?.id
  await mktSimpan(() => tulis((k) => {
    const j = k.findIndex(x => x.id === a)
    return j < 0 ? k : geserSlideMkt(k, j, arah)
  }))
  sibuk.value = false
}

// ---- presentation
const tampil = ref(false)
const mulaiDari = ref(0)
function presentasi(i: number) {
  if (!slides.value.length) return toast.add({ title: 'Katalog kosong', description: 'Tambahkan slide dulu sebelum presentasi.', color: 'error' })
  mulaiDari.value = i
  tampil.value = true
}
</script>

<template>
  <AppPage
    title="Katalog"
    description="Kumpulan materi presentasi venue — gambar, judul & deskripsi. Tekan Mulai Presentasi untuk menjalankannya layar penuh seperti PPT."
  >
    <template #actions>
      <UButton
        v-if="slides.length"
        icon="i-lucide-presentation"
        label="Mulai Presentasi"
        @click="presentasi(0)"
      />
      <label v-if="bisaUbah">
        <UButton
          as="span"
          icon="i-lucide-plus"
          label="Tambah Slide"
          color="neutral"
          variant="outline"
          :loading="sibuk"
          class="cursor-pointer"
        />
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="tambah(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
        >
      </label>
    </template>
    <MarketingGerbang layar="katalog">
      <div
        v-if="status === 'pending' && !slides.length"
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="overflow-hidden rounded-xl border border-default bg-default"
        >
          <USkeleton class="aspect-video w-full rounded-none" />
          <div class="space-y-2 p-4">
            <USkeleton class="h-4 w-2/3" />
            <USkeleton class="h-3 w-full" />
          </div>
        </div>
      </div>
      <AppPanel v-else-if="!slides.length">
        <div class="py-8 text-center">
          <UIcon
            name="i-lucide-presentation"
            class="size-8 text-dimmed"
          />
          <p class="mt-2 font-semibold text-highlighted">
            Katalog masih kosong
          </p>
          <p class="text-sm text-muted">
            {{ bisaUbah ? 'Tekan Tambah Slide untuk mengunggah gambar, lalu isi judul & deskripsinya. Urutan kartu di sini adalah urutan slide saat presentasi.' : 'Belum ada materi katalog. Tim marketing yang mengisinya.' }}
          </p>
        </div>
      </AppPanel>
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <figure
          v-for="(s, i) in slides"
          :key="s.id"
          class="flex flex-col overflow-hidden rounded-xl border border-default bg-default"
        >
          <button
            v-if="s.key"
            type="button"
            class="relative block"
            title="Presentasikan dari slide ini"
            @click="presentasi(i)"
          >
            <MarketingGambar
              :file-key="s.key"
              :alt="s.judul || s.name || 'slide'"
              img-class="aspect-video w-full object-cover"
            />
            <span class="num absolute top-2 left-2 rounded-md bg-default/90 px-1.5 text-xs font-semibold">{{ i + 1 }}</span>
          </button>
          <div
            v-else
            class="flex aspect-video items-center justify-center bg-muted text-xs text-muted"
          >
            Tanpa gambar · slide teks
          </div>
          <figcaption class="flex-1 p-4">
            <h3
              class="font-semibold"
              :class="s.judul ? 'text-highlighted' : 'text-dimmed italic'"
            >
              {{ s.judul || 'Belum ada judul' }}
            </h3>
            <p
              v-if="s.sub"
              class="text-sm text-primary-700"
            >
              {{ s.sub }}
            </p>
            <p
              v-if="s.desc"
              class="mt-1 line-clamp-3 text-sm text-muted"
            >
              {{ s.desc }}
            </p>
          </figcaption>
          <div
            v-if="bisaUbah"
            class="flex items-center gap-1 border-t border-default p-2"
          >
            <UButton
              icon="i-lucide-arrow-up"
              size="sm"
              color="neutral"
              variant="ghost"
              aria-label="Naikkan urutan"
              :disabled="i === 0 || sibuk"
              @click="geser(i, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              size="sm"
              color="neutral"
              variant="ghost"
              aria-label="Turunkan urutan"
              :disabled="i === slides.length - 1 || sibuk"
              @click="geser(i, 1)"
            />
            <span class="flex-1" />
            <UButton
              icon="i-lucide-pencil"
              label="Edit"
              size="sm"
              color="neutral"
              variant="outline"
              @click="bukaEdit(s)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="ghost"
              aria-label="Hapus slide"
              @click="hapus(s)"
            />
          </div>
        </figure>
      </div>

      <ResponsiveSheet
        v-model:open="edit.buka"
        title="Slide Katalog"
        description="Judul, subjudul & deskripsi yang tampil saat presentasi"
      >
        <MarketingGambar
          v-if="slideEdit?.key"
          :file-key="slideEdit.key"
          img-class="mb-4 h-40 w-full rounded-lg border border-default object-cover"
        />
        <div class="grid grid-cols-1 gap-4">
          <UFormField label="Judul">
            <UInput
              v-model="edit.judul"
              placeholder="mis. Area Indoor Full AC"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Subjudul"
            help="Satu baris penegas di bawah judul. Boleh dikosongkan."
          >
            <UInput
              v-model="edit.sub"
              placeholder="mis. Sepenuhnya ber-AC"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Deskripsi">
            <UTextarea
              v-model="edit.desc"
              :rows="4"
              placeholder="Penjelasan singkat yang dibacakan ke client…"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Ganti Gambar"
            help="Biarkan kosong kalau gambarnya tidak diubah. Maks 8MB."
          >
            <UInput
              type="file"
              accept="image/*"
              class="w-full"
              @change="edit.file = ($event.target as HTMLInputElement).files?.[0] ?? null"
            />
          </UFormField>
        </div>
        <template #footer>
          <UButton
            label="Simpan"
            :loading="sibuk"
            @click="simpanEdit"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            @click="edit.buka = false"
          />
        </template>
      </ResponsiveSheet>

      <MarketingKatalogShow
        v-model:open="tampil"
        :mulai="mulaiDari"
        :slides="slides"
      />
    </MarketingGerbang>
  </AppPage>
</template>
