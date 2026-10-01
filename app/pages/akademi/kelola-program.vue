<!--
  Kelola Program (deploy/akademi/index.html vKelolaProgram, :1486-1564), admin
  only: the monthly programs, the create/edit form, duplicate-to-next-month,
  per-crew compliance, and delete (which also clears the program's progress, F8).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { createAkademiRecord, deleteAkademiRecord, hapusProgProgProgram, muatAkademiKru, updateAkademiRecord, useAkademiData } from '~/composables/useAkademi'
import type { KruAkademi, ProgramAkademi } from '~/composables/useAkademi'
import { bulanBerikut, hariTerakhir, kunciBulanIni, labelBulan, materiProgram, namaDivisi, rataRataProgram, statProgram } from '~/utils/akademi-hitung'
import { statusTipe } from '~/utils/status-akademi'

definePageMeta({ access: ['akademi'] })

const toast = useToast()
const { materials, programs, progProg, divisions, users, isAdmin, refresh } = useAkademiData()
muatAkademiKru()

const daftar = computed(() => [...programs.value].sort((a, b) => b.bulan.localeCompare(a.bulan)))

const kolom: TableColumn<ProgramAkademi>[] = [
  { id: 'bulan', header: 'Bulan' },
  { id: 'program', header: 'Program' },
  { id: 'item', header: 'Item' },
  { id: 'deadline', header: 'Deadline' },
  { id: 'kepatuhan', header: 'Kepatuhan Kru' },
  { id: 'aksi', header: '' },
]

// --- form ---
const formOpen = ref(false)
const formId = ref<string | null>(null)
const formBulan = ref(kunciBulanIni())
const formJudul = ref('')
const formDeadline = ref(hariTerakhir(kunciBulanIni()))
const formCatatan = ref('')
const pilihMateri = ref<string[]>([])
const judulDisentuh = ref(false)

function bukaForm(p?: ProgramAkademi) {
  if (p) {
    formId.value = p.id
    formBulan.value = p.bulan
    formJudul.value = p.title
    formDeadline.value = p.deadline
    formCatatan.value = p.note ?? ''
    pilihMateri.value = [...(p.materialIds ?? [])]
    judulDisentuh.value = true
  }
  else {
    const b = kunciBulanIni()
    formId.value = null
    formBulan.value = b
    formJudul.value = `Program ${labelBulan(b)}`
    formDeadline.value = hariTerakhir(b)
    formCatatan.value = ''
    pilihMateri.value = []
    judulDisentuh.value = false
  }
  formOpen.value = true
}

function onBulan() {
  if (formId.value) return
  if (!judulDisentuh.value) formJudul.value = `Program ${labelBulan(formBulan.value)}`
  formDeadline.value = hariTerakhir(formBulan.value)
}

function toggleMateri(id: string) {
  const s = new Set(pilihMateri.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  pilihMateri.value = [...s]
}

const materiTerbit = computed(() => materials.value
  .filter(m => m.published)
  .slice()
  .sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)))

async function simpan() {
  const bulan = formBulan.value
  const title = formJudul.value.trim()
  const deadline = formDeadline.value
  if (!bulan || !title || !deadline) {
    toast.add({ title: 'Bulan, nama, dan deadline wajib diisi', color: 'error' })
    return
  }
  if (!pilihMateri.value.length) {
    toast.add({ title: 'Pilih minimal satu materi', color: 'error' })
    return
  }
  const body = { bulan, title, deadline, note: formCatatan.value, materialIds: [...pilihMateri.value] }
  try {
    if (formId.value) await updateAkademiRecord('programs', formId.value, body)
    else await createAkademiRecord('programs', body)
    await refresh()
    formOpen.value = false
    toast.add({ title: 'Program tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- duplicate ---
async function duplikat(p: ProgramAkademi) {
  const nb = bulanBerikut(p.bulan)
  if (programs.value.some(x => x.bulan === nb)) {
    toast.add({ title: `Program ${labelBulan(nb)} sudah ada`, color: 'warning' })
    return
  }
  try {
    await createAkademiRecord('programs', {
      bulan: nb,
      title: `Program ${labelBulan(nb)}`,
      deadline: hariTerakhir(nb),
      note: p.note ?? '',
      materialIds: [...(p.materialIds ?? [])],
    })
    await refresh()
    toast.add({ title: `Program ${labelBulan(nb)} dibuat, silakan edit isinya`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- compliance ---
const patuhOpen = ref(false)
const patuhProgram = ref<ProgramAkademi | null>(null)
function kepatuhan(p: ProgramAkademi) {
  patuhProgram.value = p
  patuhOpen.value = true
}
const barisPatuh = computed(() => {
  const p = patuhProgram.value
  if (!p) return [] as { k: KruAkademi, s: { done: number, total: number, pct: number } }[]
  return users.value
    .filter(k => k.active)
    .map(k => ({ k, s: statProgram(k, p, materials.value, progProg.value) }))
    .filter(x => x.s.total > 0)
    .sort((a, b) => a.k.name.localeCompare(b.k.name))
})

// --- delete ---
const hapusOpen = ref(false)
const hapusTarget = ref<ProgramAkademi | null>(null)
const hapusSibuk = ref(false)
const deskripsiHapus = computed(() => (hapusTarget.value ? `Hapus program "${hapusTarget.value.title}"?` : undefined))
function mintaHapus(p: ProgramAkademi) {
  hapusTarget.value = p
  hapusOpen.value = true
}
async function konfirmasiHapus() {
  const p = hapusTarget.value
  if (!p) return
  hapusSibuk.value = true
  try {
    await hapusProgProgProgram(p.id)
    await deleteAkademiRecord('programs', p.id)
    await refresh()
    hapusOpen.value = false
    toast.add({ title: 'Program dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    hapusSibuk.value = false
  }
}

const rata = (p: ProgramAkademi) => rataRataProgram(p, users.value, materials.value, progProg.value)
const itemCount = (p: ProgramAkademi) => materiProgram(p, materials.value).length
</script>

<template>
  <AppPage
    title="Kelola Program"
    description="Susun training bulanan: materi baru + refresher lama. Kru wajib kerjakan ulang item program walau dulu sudah lulus."
  >
    <template
      v-if="isAdmin"
      #actions
    >
      <UButton
        label="Buat Program"
        icon="i-lucide-plus"
        @click="bukaForm()"
      />
    </template>

    <AppPanel
      v-if="!isAdmin"
      title="Khusus admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Kelola Program hanya untuk admin modul Akademi.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Program bulanan"
        icon="i-lucide-calendar-cog"
        :count="daftar.length"
        flush
      >
        <div class="hidden lg:block">
          <UTable
            :data="daftar"
            :columns="kolom"
          >
            <template #bulan-cell="{ row }">
              <b>{{ labelBulan(row.original.bulan) }}</b>
              <AppStatus
                v-if="row.original.bulan === kunciBulanIni()"
                color="gold"
                icon="i-lucide-play"
                size="sm"
                class="ms-2"
              >
                Aktif
              </AppStatus>
            </template>
            <template #program-cell="{ row }">
              <span class="font-semibold">{{ row.original.title }}</span>
            </template>
            <template #item-cell="{ row }">
              {{ itemCount(row.original) }} materi
            </template>
            <template #kepatuhan-cell="{ row }">
              <div class="min-w-[120px]">
                <div class="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-primary-400"
                    :style="{ width: `${rata(row.original)}%` }"
                  />
                </div>
                <div class="mt-1 text-[11px] text-muted">
                  {{ rata(row.original) }}% rata-rata
                </div>
              </div>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-users"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Kepatuhan kru"
                  @click="kepatuhan(row.original)"
                />
                <UButton
                  icon="i-lucide-repeat"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Duplikat ke bulan berikutnya"
                  @click="duplikat(row.original)"
                />
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Ubah program"
                  @click="bukaForm(row.original)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Hapus program"
                  @click="mintaHapus(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="p in daftar"
            :key="p.id"
            class="px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ p.title }}
                </p>
                <p class="text-xs text-muted">
                  {{ labelBulan(p.bulan) }} · {{ itemCount(p) }} materi · deadline {{ p.deadline }}
                </p>
              </div>
              <AppStatus
                v-if="p.bulan === kunciBulanIni()"
                color="gold"
                icon="i-lucide-play"
                size="sm"
              >
                Aktif
              </AppStatus>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary-400"
                :style="{ width: `${rata(p)}%` }"
              />
            </div>
            <p class="mt-1 text-[11px] text-muted">
              {{ rata(p) }}% rata-rata
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <UButton
                label="Kepatuhan"
                size="xs"
                color="neutral"
                variant="outline"
                @click="kepatuhan(p)"
              />
              <UButton
                label="Duplikat"
                size="xs"
                color="neutral"
                variant="outline"
                @click="duplikat(p)"
              />
              <UButton
                label="Edit"
                size="xs"
                color="neutral"
                variant="outline"
                @click="bukaForm(p)"
              />
              <UButton
                label="Hapus"
                size="xs"
                color="neutral"
                variant="outline"
                @click="mintaHapus(p)"
              />
            </div>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Cara pakai siklus bulanan"
        icon="i-lucide-info"
      >
        <p class="text-[13.5px] leading-relaxed text-muted">
          Setiap akhir bulan, klik tombol Duplikat pada program berjalan untuk membuat kerangka bulan berikutnya, lalu edit: ganti 1 sampai 2 materi refresher & tambahkan materi/menu/kuis baru. Item program dihitung terpisah dari progress biasa, kru harus mengerjakan ulang item refresher, jadi standar tidak luntur. Pantau kepatuhan dari kolom di atas atau tombol Kepatuhan.
        </p>
      </AppPanel>
    </template>

    <!-- Program form -->
    <ResponsiveSheet
      v-model:open="formOpen"
      :title="formId ? 'Edit Program Bulanan' : 'Buat Program Bulanan'"
    >
      <div class="space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Bulan">
            <UInput
              v-model="formBulan"
              type="month"
              class="w-full"
              @change="onBulan"
            />
          </UFormField>
          <UFormField label="Deadline">
            <UInput
              v-model="formDeadline"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Nama Program">
          <UInput
            v-model="formJudul"
            class="w-full"
            @change="judulDisentuh = true"
          />
        </UFormField>
        <UFormField label="Catatan / Fokus Bulan Ini">
          <UTextarea
            v-model="formCatatan"
            :rows="2"
            placeholder="cth: Fokus product knowledge menu baru + refresher SOP service"
            class="w-full"
          />
        </UFormField>
        <div>
          <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Pilih Materi (baru maupun lama, yang lama otomatis jadi refresher)
          </p>
          <div class="max-h-72 space-y-1.5 overflow-y-auto pe-1">
            <label
              v-for="m in materiTerbit"
              :key="m.id"
              class="flex cursor-pointer items-start gap-2 rounded-field border border-default p-2.5"
            >
              <input
                type="checkbox"
                class="mt-0.5 size-4 shrink-0 accent-primary-600"
                :checked="pilihMateri.includes(m.id)"
                @change="toggleMateri(m.id)"
              >
              <span class="min-w-0">
                <span class="flex items-center gap-1.5 text-sm font-semibold">
                  <UIcon
                    :name="statusTipe(m.type).icon"
                    class="size-4 text-muted"
                  />
                  {{ m.title }}
                </span>
                <span class="mt-0.5 block text-[11px] text-muted">
                  {{ statusTipe(m.type).label }}, {{ m.division.map(d => namaDivisi(divisions, d)).join(', ') }}
                </span>
              </span>
            </label>
            <p
              v-if="!materiTerbit.length"
              class="text-sm text-muted"
            >
              Belum ada materi terbit.
            </p>
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
          label="Simpan Program"
          icon="i-lucide-save"
          @click="simpan"
        />
      </template>
    </ResponsiveSheet>

    <!-- Compliance -->
    <ResponsiveSheet
      v-model:open="patuhOpen"
      :title="patuhProgram ? `Kepatuhan: ${patuhProgram.title}` : 'Kepatuhan'"
      :description="patuhProgram ? `Deadline ${patuhProgram.deadline}` : undefined"
    >
      <div class="divide-y divide-default">
        <div
          v-for="x in barisPatuh"
          :key="x.k.id"
          class="flex items-center justify-between gap-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ x.k.name }}
            </p>
            <p class="text-[11px] text-muted">
              {{ namaDivisi(divisions, x.k.division) }}
            </p>
          </div>
          <div class="w-32 shrink-0">
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary-400"
                :style="{ width: `${x.s.pct}%` }"
              />
            </div>
            <p class="mt-0.5 text-end text-[11px] text-muted">
              {{ x.s.done }}/{{ x.s.total }} · {{ x.s.pct }}%
            </p>
          </div>
        </div>
        <p
          v-if="!barisPatuh.length"
          class="py-3 text-sm text-muted"
        >
          Tidak ada kru dengan item di program ini.
        </p>
      </div>
    </ResponsiveSheet>

    <!-- Delete confirmation -->
    <ResponsiveSheet
      v-model:open="hapusOpen"
      title="Hapus program?"
      :description="deskripsiHapus"
    >
      <p class="text-sm text-muted">
        Catatan pengerjaan program ini ikut terhapus.
      </p>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="hapusOpen = false"
        />
        <UButton
          label="Hapus program"
          color="error"
          :loading="hapusSibuk"
          @click="konfirmasiHapus"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
