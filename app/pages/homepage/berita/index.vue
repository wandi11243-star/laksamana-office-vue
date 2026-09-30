<!--
  Berita — every article, drafts included (laksamana-api docs/api/news.md,
  Office). Newest first, like the website. The three the homepage rail shows
  right now carry "Di beranda", so nobody has to guess what a publish changes.
  The Terbit switch writes at once (no version); editing opens the editor.
-->
<script setup lang="ts">
import type { BeritaArtikel, BeritaKategori, KategoriBaris } from '~/composables/useHomepage'

definePageMeta({ access: ['news'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const office = useBeritaOffice()

const { data, status: muat, error, refresh } = useBeritaState()

const artikel = ref<BeritaArtikel[]>([])
const kategori = ref<BeritaKategori[]>([])
watch(data, (d) => {
  artikel.value = d?.artikel ? [...d.artikel] : []
  kategori.value = d?.kategori ? [...d.kategori] : []
}, { immediate: true })

function ganti(row: BeritaArtikel) {
  const i = artikel.value.findIndex(x => x.id === row.id)
  if (i >= 0) artikel.value.splice(i, 1, row)
}

const diBeranda = computed(() => beritaDiBeranda({ artikel: artikel.value, kategori: kategori.value }))

// ─────────────────────────── filters ──

type Tab = 'semua' | 'terbit' | 'draf'
const tab = ref<Tab>(route.query.tab === 'terbit' || route.query.tab === 'draf' ? route.query.tab : 'semua')
watch(tab, t => router.replace({ query: { ...route.query, tab: t === 'semua' ? undefined : t } }))
const q = ref('')
const kat = ref<string>('semua')

const opsiKategori = computed(() => [
  { label: 'Semua kategori', value: 'semua' },
  ...[...kategori.value].sort((a, b) => a.urutan - b.urutan).map(k => ({ label: k.nama, value: k.id })),
])

// Drafts that were never dated go first (they are being written), then newest.
const urut = computed(() => [...artikel.value].sort((a, b) => {
  if (!a.published_at !== !b.published_at) return a.published_at ? 1 : -1
  return (b.published_at ?? b.updated_at ?? '').localeCompare(a.published_at ?? a.updated_at ?? '')
}))

const cari = computed(() => q.value.trim().toLowerCase())
const tersaring = computed(() => urut.value.filter(a =>
  (tab.value === 'semua' || (tab.value === 'terbit') === a.tampil)
  && (kat.value === 'semua' || a.kategori_id === kat.value)
  && (!cari.value || `${a.title} ${a.excerpt ?? ''} ${a.author ?? ''}`.toLowerCase().includes(cari.value)),
))

const jumlah = computed(() => ({
  semua: artikel.value.length,
  terbit: artikel.value.filter(a => a.tampil).length,
  draf: artikel.value.filter(a => !a.tampil).length,
}))

// ─────────────────────────── writes ──

const sibuk = ref<Record<string, boolean>>({})

async function terbitkan(row: BeritaArtikel, tampil: boolean) {
  const lama = row.tampil
  ganti({ ...row, tampil })
  sibuk.value[row.id] = true
  try {
    const baru = await office.setTampil(row.id, tampil)
    ganti(baru)
    toast.add({ title: tampil ? 'Berita diterbitkan' : 'Berita dijadikan draf', color: 'success' })
  }
  catch (e) {
    ganti({ ...row, tampil: lama })
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value[row.id] = false
  }
}

const kategoriBuka = ref(false)
const kategoriBaris = computed<KategoriBaris[]>(() => kategori.value.map(k => ({
  ...k,
  jumlah: artikel.value.filter(a => a.kategori_id === k.id).length,
})))
const kategoriApi = {
  create: (nama: string) => office.createKategori({ nama }),
  update: office.updateKategori,
  remove: office.deleteKategori,
  urutan: office.urutan,
}

const tanggal = (a: BeritaArtikel) => a.date ? tglBerita(a.date) : 'Belum bertanggal'
</script>

<template>
  <AppPage
    title="Berita"
    description="Artikel untuk rail Kabar dari Laksamana di beranda dan halaman Berita website."
  >
    <template #actions>
      <UButton
        label="Kategori"
        icon="i-lucide-tags"
        color="neutral"
        variant="outline"
        @click="kategoriBuka = true"
      />
      <UButton
        label="Tulis berita"
        icon="i-lucide-pen-line"
        to="/homepage/berita/baru"
      />
    </template>

    <div
      v-if="error"
      class="rounded-panel border border-default bg-default p-6 text-center"
    >
      <p class="font-semibold text-highlighted">
        Berita tidak bisa dimuat.
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
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="tab"
          :options="[
            { value: 'semua', label: `Semua · ${jumlah.semua}` },
            { value: 'terbit', label: `Terbit · ${jumlah.terbit}` },
            { value: 'draf', label: `Draf · ${jumlah.draf}` },
          ]"
        />
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Cari judul atau penulis"
          class="min-w-48 flex-1 sm:max-w-72"
        />
        <USelect
          v-model="kat"
          :items="opsiKategori"
          value-key="value"
          class="w-44"
          aria-label="Saring kategori"
        />
      </div>

      <div
        v-if="muat === 'pending' && !artikel.length"
        class="space-y-2"
      >
        <USkeleton
          v-for="n in 4"
          :key="n"
          :ui="{ base: 'bg-accented/70' }"
          class="h-24 rounded-field"
        />
      </div>

      <div
        v-else-if="!artikel.length"
        class="rounded-panel border border-dashed border-accented bg-default px-6 py-12 text-center"
      >
        <UIcon
          name="i-lucide-newspaper"
          class="size-8 text-dimmed"
        />
        <p class="mt-3 font-semibold text-highlighted">
          Belum ada berita
        </p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted">
          Selama belum ada yang terbit, beranda menampilkan berita contoh dan halaman Berita kosong.
        </p>
        <UButton
          label="Tulis berita pertama"
          icon="i-lucide-pen-line"
          to="/homepage/berita/baru"
          class="mt-5"
        />
      </div>

      <p
        v-else-if="!tersaring.length"
        class="rounded-panel border border-default bg-default px-6 py-10 text-center text-sm text-muted"
      >
        Tidak ada berita yang cocok dengan saringan ini.
      </p>

      <ul
        v-else
        class="divide-y divide-default overflow-hidden rounded-panel border border-default bg-default"
      >
        <li
          v-for="a in tersaring"
          :key="a.id"
          class="flex gap-3 p-3 lg:items-center lg:gap-5 lg:px-4"
        >
          <NuxtLink
            :to="`/homepage/berita/${a.id}`"
            class="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-field bg-muted sm:w-32"
            :aria-label="`Ubah ${a.title}`"
          >
            <img
              v-if="a.cover"
              :src="apiFileUrl(a.cover)!"
              alt=""
              loading="lazy"
              class="size-full object-cover"
              :class="!a.tampil && 'opacity-50'"
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
          </NuxtLink>

          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/homepage/berita/${a.id}`"
              class="block"
            >
              <span
                class="line-clamp-2 font-semibold leading-snug hover:underline"
                :class="a.tampil ? 'text-highlighted' : 'text-muted'"
              >{{ a.title }}</span>
              <span
                v-if="a.excerpt"
                class="mt-0.5 hidden truncate text-sm text-muted sm:block"
              >{{ a.excerpt }}</span>
            </NuxtLink>
            <p class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
              <span class="font-semibold text-default">{{ a.category.nama }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ tanggal(a) }}</span>
              <template v-if="a.author">
                <span aria-hidden="true">·</span>
                <span>{{ a.author }}</span>
              </template>
              <UBadge
                v-if="diBeranda.has(a.id)"
                label="Di beranda"
                icon="i-lucide-house"
                color="primary"
                variant="soft"
                size="sm"
                class="ms-1"
              />
            </p>
            <label class="mt-2 flex w-max cursor-pointer items-center gap-2 text-sm lg:hidden">
              <USwitch
                :model-value="a.tampil"
                :disabled="sibuk[a.id]"
                color="success"
                @update:model-value="terbitkan(a, $event)"
              />
              <span :class="a.tampil ? 'font-semibold text-success' : 'text-muted'">{{ a.tampil ? 'Terbit' : 'Draf' }}</span>
            </label>
          </div>

          <label class="hidden w-28 shrink-0 cursor-pointer items-center gap-2 text-sm lg:flex">
            <USwitch
              :model-value="a.tampil"
              :disabled="sibuk[a.id]"
              color="success"
              @update:model-value="terbitkan(a, $event)"
            />
            <span :class="a.tampil ? 'font-semibold text-success' : 'text-muted'">{{ a.tampil ? 'Terbit' : 'Draf' }}</span>
          </label>
          <UButton
            v-if="a.tampil"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            size="sm"
            :to="websiteUrl(`/news/${a.slug}`)"
            target="_blank"
            :aria-label="`Buka ${a.title} di website`"
            class="hidden shrink-0 lg:inline-flex"
          />
          <span
            v-else
            class="hidden w-8 lg:block"
          />
        </li>
      </ul>
    </template>

    <HomepageKategori
      v-model:open="kategoriBuka"
      title="Kategori berita"
      description="Urutan di sini adalah urutan pilihan kategori di halaman Berita website."
      :rows="kategoriBaris"
      satuan="berita"
      :api="kategoriApi"
      :muat-ulang="refresh"
    />
  </AppPage>
</template>
