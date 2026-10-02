<!--
  Materi Saya (deploy/akademi/index.html vMateri, :950-971): a type chip row and
  a category chip row over a grid of the crew's own materials.
-->
<script setup lang="ts">
import { muatAkademiKru, useAkademiData, usePenontonMateri } from '~/composables/useAkademi'
import { KATEGORI_MATERI, LABEL_TIPE, TIPE_MATERI } from '~/utils/akademi-konstanta'
import { materiUntuk, namaDivisi, selesaiMateri } from '~/utils/akademi-hitung'
import KartuMateri from '~/widgets/akademi/KartuMateri.vue'
import SheetKuis from '~/widgets/akademi/SheetKuis.vue'
import SheetMateri from '~/widgets/akademi/SheetMateri.vue'

definePageMeta({ access: ['akademi'] })

const { materials, progress, divisions, kru } = useAkademiData()
muatAkademiKru()

const viewer = usePenontonMateri()
const { buka, materi, dariProgram, dalamLingkup, selesai, progresMateri, passingDefault, bukaMateri, tandaiSelesai, simpanKuis } = viewer

const SEMUA = 'semua'
const tipe = ref<string>(SEMUA)
const kategori = ref<string>(SEMUA)

const opsiTipe = [{ value: SEMUA, label: 'Semua Tipe' }, ...TIPE_MATERI.map(t => ({ value: t, label: LABEL_TIPE[t] }))]
const opsiKategori = [{ value: SEMUA, label: 'Semua Kategori' }, ...KATEGORI_MATERI.map(c => ({ value: c.id, label: c.name }))]

const tampil = computed(() => (kru.value ? materiUntuk(kru.value, materials.value) : [])
  .filter(m => tipe.value === SEMUA || m.type === tipe.value)
  .filter(m => kategori.value === SEMUA || m.cat === kategori.value))

const divisiNama = computed(() => namaDivisi(divisions.value, kru.value?.division ?? 'all'))
</script>

<template>
  <AppPage
    title="Materi Saya"
    :description="`Materi training untuk ${divisiNama} + materi semua divisi`"
  >
    <div class="mb-4 space-y-3">
      <AppChips
        v-model="tipe"
        :options="opsiTipe"
      />
      <AppChips
        v-model="kategori"
        :options="opsiKategori"
      />
    </div>

    <div
      v-if="tampil.length"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <KartuMateri
        v-for="m in tampil"
        :key="m.id"
        :materi="m"
        :divisions="divisions"
        :selesai="kru ? selesaiMateri(kru.id, m, progress) : false"
        :skor="progress[kru?.id ?? '']?.[m.id]?.score ?? null"
        @buka="bukaMateri"
      />
    </div>
    <AppPanel
      v-else
      title="Belum ada materi di filter ini"
      icon="i-lucide-compass"
    >
      <p class="text-sm text-muted">
        Coba ganti tipe atau kategori, atau tunggu pengumuman materi baru dari manajemen.
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
