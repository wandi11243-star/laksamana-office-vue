<!--
  Kelola Materi (deploy/akademi/index.html vKelolaMateri, :1246-1270), admin
  only: one "+ <type>" button per type, the material table, and the edit/delete
  actions. Deleting a material also deletes the crew's progress for it (F8).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { createAkademiRecord, deleteAkademiRecord, hapusProgresMateri, muatAkademiKru, updateAkademiRecord, useAkademiData } from '~/composables/useAkademi'
import type { MateriAkademi, TipeMateri } from '~/composables/useAkademi'
import { LABEL_TIPE, namaKategori, TIPE_MATERI } from '~/utils/akademi-konstanta'
import { namaDivisi, terbaruDulu } from '~/utils/akademi-hitung'
import { statusTerbit, statusTipe } from '~/utils/status-akademi'
import FormMateri from '~/widgets/akademi/FormMateri.vue'

definePageMeta({ access: ['akademi'] })

const toast = useToast()
const { materials, divisions, passingDefault, isAdmin, refresh } = useAkademiData()
muatAkademiKru()

const daftar = computed(() => [...materials.value].sort(terbaruDulu))

const kolom: TableColumn<MateriAkademi>[] = [
  { id: 'materi', header: 'Materi' },
  { id: 'tipe', header: 'Tipe' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'kategori', header: 'Kategori' },
  { id: 'wajib', header: 'Wajib' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
]

const formOpen = ref(false)
const formMateri = ref<MateriAkademi | null>(null)
const formTipe = ref<TipeMateri | null>(null)

function tambah(t: TipeMateri) {
  formMateri.value = null
  formTipe.value = t
  formOpen.value = true
}
function ubah(m: MateriAkademi) {
  formMateri.value = m
  formTipe.value = m.type
  formOpen.value = true
}

async function simpan(body: Record<string, unknown>) {
  try {
    if (formMateri.value) await updateAkademiRecord('materials', formMateri.value.id, body)
    else await createAkademiRecord('materials', body)
    await refresh()
    formOpen.value = false
    toast.add({ title: 'Materi tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// Delete + cascade the progress cells (F8).
const hapusOpen = ref(false)
const hapusTarget = ref<MateriAkademi | null>(null)
const hapusSibuk = ref(false)
const deskripsiHapus = computed(() => (hapusTarget.value ? `Hapus materi "${hapusTarget.value.title}"?` : undefined))
function mintaHapus(m: MateriAkademi) {
  hapusTarget.value = m
  hapusOpen.value = true
}
async function konfirmasiHapus() {
  const m = hapusTarget.value
  if (!m) return
  hapusSibuk.value = true
  try {
    await hapusProgresMateri(m.id)
    await deleteAkademiRecord('materials', m.id)
    await refresh()
    hapusOpen.value = false
    toast.add({ title: 'Materi dihapus', color: 'success' })
  }
  catch (e) {
    // G-17: the cascade stopped partway. Show why, then reload so the screen
    // reflects the cells that were already deleted instead of a stale list.
    if (!(await tanganiKonflik(e, refresh))) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
      await refresh()
    }
  }
  finally {
    hapusSibuk.value = false
  }
}

const divLabel = (m: MateriAkademi) => (Array.isArray(m.division) ? m.division : []).map(d => namaDivisi(divisions.value, d)).join(', ')
</script>

<template>
  <AppPage
    title="Kelola Materi"
    description="Tambah / edit video, modul, SOP, menu baru, dan kuis."
  >
    <template
      v-if="isAdmin"
      #actions
    >
      <UButton
        v-for="t in TIPE_MATERI"
        :key="t"
        :label="`+ ${LABEL_TIPE[t]}`"
        :icon="statusTipe(t).icon"
        color="neutral"
        variant="outline"
        size="sm"
        @click="tambah(t)"
      />
    </template>

    <AppPanel
      v-if="!isAdmin"
      title="Khusus admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Kelola Materi hanya untuk admin modul Akademi.
      </p>
    </AppPanel>

    <AppPanel
      v-else
      title="Materi"
      icon="i-lucide-folder-cog"
      :count="daftar.length"
      flush
    >
      <div class="hidden lg:block">
        <UTable
          :data="daftar"
          :columns="kolom"
        >
          <template #materi-cell="{ row }">
            <span class="font-semibold">{{ row.original.title }}</span>
          </template>
          <template #tipe-cell="{ row }">
            <AppStatus
              :color="statusTipe(row.original.type).tone"
              :icon="statusTipe(row.original.type).icon"
              size="sm"
            >
              {{ statusTipe(row.original.type).label }}
            </AppStatus>
          </template>
          <template #divisi-cell="{ row }">
            <span class="text-[12px]">{{ divLabel(row.original) }}</span>
          </template>
          <template #kategori-cell="{ row }">
            <span class="text-[12px]">{{ namaKategori(row.original.cat) }}</span>
          </template>
          <template #wajib-cell="{ row }">
            <UIcon
              v-if="row.original.mandatory"
              name="i-lucide-circle-check"
              class="size-4 text-success"
            />
            <span v-else>—</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="statusTerbit(row.original.published).tone"
              :icon="statusTerbit(row.original.published).icon"
              size="sm"
            >
              {{ statusTerbit(row.original.published).label }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex items-center gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah materi"
                @click="ubah(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus materi"
                @click="mintaHapus(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="m in daftar"
          :key="m.id"
          class="px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ m.title }}
              </p>
              <p class="text-xs text-muted">
                {{ divLabel(m) }} · {{ namaKategori(m.cat) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah materi"
                @click="ubah(m)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus materi"
                @click="mintaHapus(m)"
              />
            </div>
          </div>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <AppStatus
              :color="statusTipe(m.type).tone"
              :icon="statusTipe(m.type).icon"
              size="sm"
            >
              {{ statusTipe(m.type).label }}
            </AppStatus>
            <AppStatus
              v-if="m.mandatory"
              color="error"
              icon="i-lucide-flag"
              size="sm"
            >
              Wajib
            </AppStatus>
            <AppStatus
              :color="statusTerbit(m.published).tone"
              :icon="statusTerbit(m.published).icon"
              size="sm"
            >
              {{ statusTerbit(m.published).label }}
            </AppStatus>
          </div>
        </div>
      </div>
    </AppPanel>

    <FormMateri
      v-model:open="formOpen"
      :materi="formMateri"
      :tipe-baru="formTipe"
      :divisions="divisions"
      :passing-default="passingDefault"
      @simpan="simpan"
    />

    <ResponsiveSheet
      v-model:open="hapusOpen"
      title="Hapus materi?"
      :description="deskripsiHapus"
    >
      <p class="text-sm text-muted">
        Progress kru untuk materi ini juga akan hilang.
      </p>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="hapusOpen = false"
        />
        <UButton
          label="Hapus materi"
          color="error"
          :loading="hapusSibuk"
          @click="konfirmasiHapus"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
