<!--
  Struktur Organisasi (deploy/akademi/index.html vStruktur, :1567-1640): the
  command line, one column per division with its PIC and crew, and — for admins —
  the division create/edit/delete form. A division with crew or materials cannot
  be deleted (:1632-1635).
-->
<script setup lang="ts">
import { createAkademiRecord, deleteAkademiRecord, muatAkademiKru, updateAkademiRecord, useAkademiData } from '~/composables/useAkademi'
import type { DivisiAkademi, KruAkademi } from '~/composables/useAkademi'
import { DIVISI_DEFAULT, IKON_DIVISI, ikonDariKunci, ikonDivisi } from '~/utils/akademi-konstanta'
import { namaDivisi, statKru } from '~/utils/akademi-hitung'

definePageMeta({ access: ['akademi'] })

const toast = useToast()
const { materials, users, divisions, progress, isAdmin, refresh } = useAkademiData()
muatAkademiKru()

const dibagi = computed(() => (divisions.value.length ? divisions.value : DIVISI_DEFAULT))
const aktif = computed(() => users.value.filter(k => k.active))
const manajemen = computed(() => aktif.value.filter(k => k.role === 'admin' || k.division === 'all'))
const timDivisi = (id: string) => aktif.value.filter(k => k.division === id)
const picDivisi = (id: string) => timDivisi(id).filter(k => k.role === 'manager')
const stafDivisi = (id: string) => timDivisi(id).filter(k => k.role === 'staff')
const materiDivisi = (id: string) => materials.value.filter(m => m.published && (Array.isArray(m.division) ? m.division : []).some(d => d === 'all' || d === id)).length
const stat = (k: KruAkademi) => statKru(k, materials.value, progress.value)

// --- division form ---
const formOpen = ref(false)
const formId = ref<string | null>(null)
const formNama = ref('')
const formIc = ref('compass')

function bukaForm(d?: DivisiAkademi) {
  formId.value = d?.id ?? null
  formNama.value = d?.name ?? ''
  formIc.value = d?.ic ?? 'compass'
  formOpen.value = true
}

async function simpanDivisi() {
  const name = formNama.value.trim()
  if (!name) {
    toast.add({ title: 'Nama divisi wajib diisi', color: 'error' })
    return
  }
  try {
    if (formId.value) await updateAkademiRecord('divisions', formId.value, { id: formId.value, name, ic: formIc.value })
    else await createAkademiRecord('divisions', { name, ic: formIc.value })
    await refresh()
    formOpen.value = false
    toast.add({ title: 'Divisi tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- delete (confirmation sheet, not window.confirm) ---
const hapusOpen = ref(false)
const hapusTarget = ref<DivisiAkademi | null>(null)
const hapusSibuk = ref(false)
const deskripsiHapus = computed(() => (hapusTarget.value ? `Divisi "${hapusTarget.value.name}" akan dihapus.` : undefined))

function mintaHapus(d: DivisiAkademi) {
  const kru = users.value.filter(k => k.division === d.id).length
  const materi = materials.value.filter(m => (Array.isArray(m.division) ? m.division : []).includes(d.id)).length
  if (kru || materi) {
    toast.add({ title: `Tidak bisa dihapus: masih ada ${kru} kru & ${materi} materi di divisi ini. Pindahkan dulu.`, color: 'error' })
    return
  }
  hapusTarget.value = d
  hapusOpen.value = true
}

async function konfirmasiHapus() {
  const d = hapusTarget.value
  if (!d) return
  hapusSibuk.value = true
  try {
    await deleteAkademiRecord('divisions', d.id)
    await refresh()
    hapusOpen.value = false
    toast.add({ title: 'Divisi dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    hapusSibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Struktur Organisasi"
    :description="isAdmin
      ? 'Susun divisi & jalur komando, materi training otomatis mengikuti divisi yang dibuat di sini'
      : 'Kenali jalur komando kapal & PIC divisimu'"
  >
    <template
      v-if="isAdmin"
      #actions
    >
      <UButton
        label="Tambah Divisi"
        icon="i-lucide-plus"
        @click="bukaForm()"
      />
    </template>

    <AppPanel
      title="Nahkoda & Manajemen Pusat"
      icon="i-lucide-anchor"
      :count="manajemen.length"
    >
      <div class="flex flex-wrap gap-2">
        <span
          v-for="k in manajemen"
          :key="k.id"
          class="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1.5 text-[13px] font-semibold text-primary-800"
        >
          {{ k.name }}<span class="font-normal">{{ k.title ? `, ${k.title}` : '' }}</span>
        </span>
        <p
          v-if="!manajemen.length"
          class="text-sm text-muted"
        >
          Belum ada manajemen terdaftar.
        </p>
      </div>
    </AppPanel>

    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="d in dibagi"
        :key="d.id"
        class="rounded-panel border border-default bg-default shadow-panel"
      >
        <div class="flex items-center justify-between gap-2 border-b border-default px-4 py-3">
          <p class="flex items-center gap-2 font-semibold text-highlighted">
            <UIcon
              :name="ikonDivisi(dibagi, d.id)"
              class="size-4 text-primary-700"
            />
            {{ d.name }}
          </p>
          <div
            v-if="isAdmin"
            class="flex items-center gap-1"
          >
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Ubah divisi"
              @click="bukaForm(d)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Hapus divisi"
              @click="mintaHapus(d)"
            />
          </div>
        </div>
        <p class="border-b border-default px-4 py-2 text-[11px] text-muted">
          {{ timDivisi(d.id).length }} orang, {{ materiDivisi(d.id) }} materi training
        </p>
        <div class="divide-y divide-default">
          <div
            v-for="k in picDivisi(d.id)"
            :key="k.id"
            class="flex items-center justify-between gap-2 px-4 py-2.5"
          >
            <div>
              <p class="text-sm font-semibold">
                {{ k.name }}
              </p>
              <p class="text-[11px] font-bold text-primary-700">
                PIC, {{ k.title || namaDivisi(dibagi, d.id) }}
              </p>
            </div>
            <AppStatus
              :color="stat(k).certified ? 'success' : 'warning'"
              :icon="stat(k).certified ? 'i-lucide-medal' : 'i-lucide-hourglass'"
              size="sm"
            >
              {{ stat(k).mandPct }}%
            </AppStatus>
          </div>
          <div
            v-for="k in stafDivisi(d.id)"
            :key="k.id"
            class="flex items-center justify-between gap-2 px-4 py-2.5"
          >
            <div>
              <p class="text-sm">
                {{ k.name }}
              </p>
              <p class="text-[11px] text-muted">
                {{ k.title || '' }}
              </p>
            </div>
            <AppStatus
              :color="stat(k).certified ? 'success' : 'neutral'"
              :icon="stat(k).certified ? 'i-lucide-medal' : 'i-lucide-circle'"
              size="sm"
            >
              {{ stat(k).mandPct }}%
            </AppStatus>
          </div>
          <p
            v-if="!picDivisi(d.id).length && !stafDivisi(d.id).length"
            class="px-4 py-3 text-[12.5px] text-muted"
          >
            Belum ada kru. Tetapkan lewat Kelola Kru.
          </p>
        </div>
      </div>
    </div>

    <AppPanel
      v-if="isAdmin"
      title="Catatan"
      icon="i-lucide-info"
    >
      <p class="text-[13px] leading-relaxed text-muted">
        Divisi yang dibuat di sini langsung muncul sebagai pilihan target di Kelola Materi, Kelola Program, dan Kelola Kru. Tetapkan satu PIC per divisi (ubah peran kru jadi "PIC Divisi" di Kelola Kru) supaya dia bisa memantau progress timnya sendiri. Divisi hanya bisa dihapus jika sudah tidak ada kru maupun materi yang menempel padanya.
      </p>
    </AppPanel>

    <!-- Division form -->
    <ResponsiveSheet
      v-model:open="formOpen"
      :title="formId ? 'Edit Divisi' : 'Tambah Divisi'"
    >
      <div class="space-y-3">
        <UFormField label="Nama Divisi">
          <UInput
            v-model="formNama"
            placeholder="cth: Security & Parkir"
            class="w-full"
          />
        </UFormField>
        <div>
          <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Ikon
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="k in IKON_DIVISI"
              :key="k"
              type="button"
              class="flex size-10 items-center justify-center rounded-field border transition-colors"
              :class="formIc === k ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default bg-muted text-muted hover:border-accented'"
              :aria-pressed="formIc === k"
              @click="formIc = k"
            >
              <UIcon
                :name="ikonDariKunci(k)"
                class="size-5"
              />
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="formOpen = false"
        />
        <UButton
          label="Simpan"
          icon="i-lucide-save"
          @click="simpanDivisi"
        />
      </template>
    </ResponsiveSheet>

    <!-- Delete confirmation -->
    <ResponsiveSheet
      v-model:open="hapusOpen"
      title="Hapus divisi?"
      :description="deskripsiHapus"
    >
      <p class="text-sm text-muted">
        Divisi ini tidak punya kru maupun materi. Tindakan ini tidak bisa dibatalkan.
      </p>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="hapusOpen = false"
        />
        <UButton
          label="Hapus divisi"
          color="error"
          :loading="hapusSibuk"
          @click="konfirmasiHapus"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
