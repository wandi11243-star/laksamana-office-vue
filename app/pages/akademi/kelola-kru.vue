<!--
  Kelola Kru (deploy/akademi/index.html vKelolaKru, :1367-1408), admin only:
  the active crew (roster result), with an edit form for jabatan / divisi /
  peran. Name & login live in Office and are read-only here. There is no add
  mode — crew come from the Office roster (`:1382-1400`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { muatAkademiKru, sinkronRosterAkademi, updateAkademiRecord, useAkademiData } from '~/composables/useAkademi'
import type { KruAkademi } from '~/composables/useAkademi'
import { useModulMembers } from '~/composables/useRoster'
import { DIVISI_DEFAULT, LABEL_PERAN, LABEL_PERAN_PANJANG, PERAN_AKADEMI } from '~/utils/akademi-konstanta'
import { namaDivisi } from '~/utils/akademi-hitung'

definePageMeta({ access: ['akademi'] })

const toast = useToast()
const { users, divisions, isAdmin, refresh } = useAkademiData()
muatAkademiKru()

const daftarDivisi = computed(() => (divisions.value.length ? divisions.value : DIVISI_DEFAULT))
const aktif = computed(() => users.value.filter(k => k.active).sort((a, b) => a.name.localeCompare(b.name)))

const opsiDivisi = computed(() => [
  { value: 'all', label: 'Semua (manajemen)' },
  ...daftarDivisi.value.map(d => ({ value: d.id, label: d.name })),
])
const opsiPeran = PERAN_AKADEMI.map(p => ({ value: p, label: LABEL_PERAN_PANJANG[p] }))

const kolom: TableColumn<KruAkademi>[] = [
  { id: 'nama', header: 'Nama' },
  { id: 'jabatan', header: 'Jabatan' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'peran', header: 'Peran' },
  { id: 'aksi', header: '' },
]

const formOpen = ref(false)
const formId = ref<string | null>(null)
const formJabatan = ref('')
const formDivisi = ref('all')
const formPeran = ref<KruAkademi['role']>('staff')
const namaEdit = computed(() => users.value.find(u => u.id === formId.value)?.name ?? '')

function bukaForm(k: KruAkademi) {
  const ada = users.value.find(x => x.id === k.id)
  if (!ada) {
    toast.add({ title: 'Kru tidak ditemukan', color: 'error' })
    return
  }
  formId.value = k.id
  formJabatan.value = k.title ?? ''
  formDivisi.value = k.division
  formPeran.value = k.role
  formOpen.value = true
}

async function simpan() {
  const k = users.value.find(x => x.id === formId.value)
  if (!k) {
    toast.add({ title: 'Kru tidak ditemukan', color: 'error' })
    return
  }
  try {
    await updateAkademiRecord('users', k.id, {
      ...k,
      title: formJabatan.value.trim(),
      division: formDivisi.value,
      role: formPeran.value,
    })
    await refresh()
    formOpen.value = false
    toast.add({ title: 'Role kru tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// Manual roster sync (T-01): a convenience for admins, best-effort.
const { data: anggota } = useModulMembers('akademi')
const sibukSinkron = ref(false)
async function sinkron() {
  if (!anggota.value?.length) {
    toast.add({ title: 'Roster Office kosong, sinkron dilewati', color: 'warning' })
    return
  }
  sibukSinkron.value = true
  try {
    const ubah = await sinkronRosterAkademi(users.value, anggota.value)
    await refresh()
    toast.add({ title: ubah ? `${ubah} baris kru disinkronkan` : 'Roster sudah sinkron', color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibukSinkron.value = false
  }
}

const peranTone = (r: KruAkademi['role']): 'gold' | 'info' | 'neutral' => (r === 'admin' ? 'gold' : r === 'manager' ? 'info' : 'neutral')

// Reimagine (B): actionable queue. Crew without a title are the focal fix,
// the full roster stays as the archive.
const tanpaJabatan = computed(() => aktif.value.filter(k => !(k.title ?? '').trim()))
</script>

<template>
  <AppPage
    title="Kelola Kru"
    description="Divisi dan peran kru. Akun & login dikelola di Office."
  >
    <template
      v-if="isAdmin"
      #actions
    >
      <UButton
        label="Sinkronkan roster Office"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="sibukSinkron"
        @click="sinkron"
      />
    </template>

    <AppPanel
      v-if="!isAdmin"
      title="Khusus admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Kelola Kru hanya untuk admin modul Akademi.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Perlu dilengkapi"
        icon="i-lucide-play"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-highlighted">
              {{ tanpaJabatan.length ? `${tanpaJabatan.length} kru belum ada jabatan` : 'Semua kru sudah ada jabatan' }}
            </p>
            <p class="mt-0.5 text-[12.5px] text-muted">
              {{ tanpaJabatan.length ? `Mulai dari ${tanpaJabatan[0]?.name ?? '—'}, lengkapi satu per satu.` : 'Roster rapi, sinkron ulang bila ada kru baru di Office.' }}
            </p>
          </div>
          <UButton
            v-if="tanpaJabatan.length"
            label="Lengkapi sekarang"
            icon="i-lucide-arrow-right"
            color="neutral"
            variant="outline"
            @click="bukaForm(tanpaJabatan[0]!)"
          />
        </div>
      </AppPanel>

      <AppPanel
        title="Kru aktif"
        icon="i-lucide-anchor"
        :count="aktif.length"
        flush
      >
        <div class="hidden lg:block">
          <UTable
            :data="aktif"
            :columns="kolom"
          >
            <template #nama-cell="{ row }">
              <b>{{ row.original.name }}</b>
            </template>
            <template #jabatan-cell="{ row }">
              {{ row.original.title || '-' }}
            </template>
            <template #divisi-cell="{ row }">
              {{ namaDivisi(daftarDivisi, row.original.division) }}
            </template>
            <template #peran-cell="{ row }">
              <AppStatus
                :color="peranTone(row.original.role)"
                icon="i-lucide-user-round"
                size="sm"
              >
                {{ LABEL_PERAN[row.original.role] }}
              </AppStatus>
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                label="Atur"
                icon="i-lucide-pencil"
                size="sm"
                color="neutral"
                variant="outline"
                @click="bukaForm(row.original)"
              />
            </template>
          </UTable>
        </div>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="k in aktif"
            :key="k.id"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ k.name }}
              </p>
              <p class="text-xs text-muted">
                {{ k.title || '-' }} · {{ namaDivisi(daftarDivisi, k.division) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <AppStatus
                :color="peranTone(k.role)"
                icon="i-lucide-user-round"
                size="sm"
              >
                {{ LABEL_PERAN[k.role] }}
              </AppStatus>
              <UButton
                label="Atur"
                size="sm"
                color="neutral"
                variant="outline"
                @click="bukaForm(k)"
              />
            </div>
          </div>
          <p
            v-if="!aktif.length"
            class="px-4 py-3 text-sm text-muted"
          >
            Belum ada kru aktif. Coba "Sinkronkan roster Office".
          </p>
        </div>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="formOpen"
      title="Atur Role Kru"
    >
      <div class="space-y-3">
        <UFormField label="Nama Lengkap">
          <UInput
            :model-value="namaEdit"
            disabled
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jabatan">
          <UInput
            v-model="formJabatan"
            placeholder="Waiter / Cook / Barista..."
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Divisi">
            <USelect
              v-model="formDivisi"
              :items="opsiDivisi"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Peran">
            <USelect
              v-model="formPeran"
              :items="opsiPeran"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="text-[11.5px] text-muted">
          Peran & divisi menentukan materi dan menu yang dilihat kru. Nama & login diatur di Office.
        </p>
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
          loading-auto
          @click="simpan"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
