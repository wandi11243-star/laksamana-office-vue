<!--
  Perpustakaan (deploy/akademi/index.html vPerpus, :1807-1845): every published
  material across divisions, with a live title search and division/type chips.
  A material outside the crew's division is marked "Mode Baca".
-->
<script setup lang="ts">
import { muatAkademiKru, useAkademiData, usePenontonMateri } from '~/composables/useAkademi'
import { LABEL_TIPE, TIPE_MATERI } from '~/utils/akademi-konstanta'
import { materiUntuk, selesaiMateri, terbaruDulu } from '~/utils/akademi-hitung'
import KartuMateri from '~/widgets/akademi/KartuMateri.vue'
import SheetKuis from '~/widgets/akademi/SheetKuis.vue'
import SheetMateri from '~/widgets/akademi/SheetMateri.vue'

definePageMeta({ access: ['akademi'] })

const { materials, progress, divisions, kru } = useAkademiData()
muatAkademiKru()

const viewer = usePenontonMateri()
const { buka, materi, dariProgram, dalamLingkup, selesai, progresMateri, passingDefault, bukaMateri, tandaiSelesai, simpanKuis } = viewer

const SEMUA = 'semua'
const q = ref('')
const div = ref<string>(SEMUA)
const tipe = ref<string>(SEMUA)

const opsiDivisi = computed(() => [
  { value: SEMUA, label: 'Semua Divisi' },
  ...divisions.value.map(d => ({ value: d.id, label: d.name })),
])
const opsiTipe = [{ value: SEMUA, label: 'Semua Tipe' }, ...TIPE_MATERI.map(t => ({ value: t, label: LABEL_TIPE[t] }))]

/** Ids the crew may count; everything else in the list is Mode Baca. */
const milikSaya = computed(() => new Set(kru.value ? materiUntuk(kru.value, materials.value).map(m => m.id) : []))

const tampil = computed(() => {
  const cari = q.value.trim().toLowerCase()
  return materials.value
    .filter(m => m.published)
    .filter(m => tipe.value === SEMUA || m.type === tipe.value)
    .filter((m) => {
      if (div.value === SEMUA) return true
      const list = Array.isArray(m.division) ? m.division : []
      return list.includes('all') || list.includes(div.value)
    })
    .filter(m => !cari || m.title.toLowerCase().includes(cari))
    .sort(terbaruDulu)
})

// Reimagine (B): search-first. The first hit is the focal start action, the
// rest stays as the browsable archive below.
const mulaiDari = computed(() => tampil.value[0] ?? null)
</script>

<template>
  <AppPage
    title="Perpustakaan Laksamana"
    description="Semua materi training lintas divisi, belajar apa pun, kapan pun. Materi di luar divisimu terbuka dalam Mode Baca."
  >
    <AppPanel
      v-if="mulaiDari && kru"
      title="Mulai dari sini"
      icon="i-lucide-play"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate font-semibold text-highlighted">
            {{ mulaiDari.title }}
          </p>
          <p class="mt-0.5 text-[12.5px] text-muted">
            {{ milikSaya.has(mulaiDari.id) ? 'Sesuai filtermu, kerjakan satu ini dulu.' : 'Mode Baca, di luar divisimu tapi boleh dipelajari.' }}
          </p>
        </div>
        <UButton
          label="Buka materi"
          icon="i-lucide-arrow-right"
          @click="bukaMateri(mulaiDari.id)"
        />
      </div>
    </AppPanel>

    <div class="mb-4 space-y-3">
      <UInput
        v-model="q"
        placeholder="Cari judul materi…"
        icon="i-lucide-search"
        class="max-w-md"
      />
      <AppChips
        v-model="div"
        :options="opsiDivisi"
      />
      <AppChips
        v-model="tipe"
        :options="opsiTipe"
      />
    </div>

    <p
      v-if="tampil.length"
      class="mb-2 text-xs text-muted"
    >
      {{ tampil.length }} materi ditemukan
    </p>
    <div
      v-if="tampil.length"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <KartuMateri
        v-for="m in tampil"
        :key="m.id"
        :materi="m"
        :divisions="divisions"
        :selesai="kru ? (milikSaya.has(m.id) && selesaiMateri(kru.id, m, progress)) : false"
        :mode-baca="!milikSaya.has(m.id)"
        :skor="milikSaya.has(m.id) ? (progress[kru?.id ?? '']?.[m.id]?.score ?? null) : null"
        @buka="bukaMateri"
      />
    </div>
    <AppPanel
      v-else
      title="Tidak ada materi yang cocok"
      icon="i-lucide-compass"
    >
      <p class="text-sm text-muted">
        Ubah kata kunci, divisi, atau tipe materi.
      </p>
    </AppPanel>

    <SheetMateri
      v-if="materi && materi.type !== 'quiz'"
      v-model:open="buka"
      :materi="materi"
      :dalam-lingkup="dalamLingkup"
      :selesai="selesai"
      :dari-program="dariProgram"
      :divisions="divisions"
      @selesai="tandaiSelesai"
    />
    <SheetKuis
      v-else-if="materi"
      v-model:open="buka"
      :materi="materi"
      :dalam-lingkup="dalamLingkup"
      :selesai="selesai"
      :dari-program="dariProgram"
      :entry="progresMateri"
      :passing-default="passingDefault"
      @simpan="simpanKuis"
    />
  </AppPage>
</template>
