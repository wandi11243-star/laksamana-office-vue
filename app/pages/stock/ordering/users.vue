<!--
  Stock › Ordering › Kelola Akses (old `deploy/stock/ordering/index.html:204-206,827-893`).

  Admin only. Kitchen crew list with roles: Admin / Order + Check-in /
  Check-in Saja. The roster seed fills an empty list (`ordering-users-import`).
  Guards: cannot demote yourself, at least one admin stays.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { KruStock } from '~/composables/useStock'
import { createKruStock, deleteKruStock, importOrderingUsers, listKruStock, patchKruStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['ordering'] })

const me = useMe()
const toast = useToast()

const daftarQ = useAsyncData('stock-ordering-users', () => listKruStock('ordering-users'), {
  default: () => ({ rows: [] as KruStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => daftarQ.data.value?.versions ?? {})
const semua = computed(() => daftarQ.data.value?.rows ?? [])

const PERAN = [
  { value: 'admin', label: 'Admin' },
  { value: 'full', label: 'Order + Check-in' },
  { value: 'checkin', label: 'Check-in Saja' },
]
const labelPeran = (r: string) => PERAN.find(p => p.value === r)?.label ?? r

const sheet = ref(false)
const editing = ref<KruStock | null>(null)
const form = ref({ name: '', role: 'full', keterangan: '', pin: '' })

function bukaTambah() {
  editing.value = null
  form.value = { name: '', role: 'full', keterangan: '', pin: '' }
  sheet.value = true
}
function bukaUbah(k: KruStock) {
  editing.value = k
  form.value = { name: k.name, role: k.role || 'full', keterangan: k.keterangan || '', pin: '' }
  sheet.value = true
}

const menyimpan = ref(false)
async function simpan() {
  if (!form.value.name.trim()) {
    toast.add({ title: 'Nama kosong', description: 'Isi nama kru dulu.', color: 'warning' })
    return
  }
  if (editing.value && editing.value.name === me.value?.name && form.value.role !== 'admin' && editing.value.role === 'admin') {
    toast.add({ title: 'Tidak bisa menurunkan akun sendiri', color: 'error' })
    return
  }
  if (!editing.value && semua.value.length === 0 && form.value.role !== 'admin') {
    toast.add({ title: 'Kru pertama harus Admin', color: 'warning' })
    return
  }
  menyimpan.value = true
  try {
    const body: Record<string, unknown> = { name: form.value.name.trim(), role: form.value.role, keterangan: form.value.keterangan.trim() }
    if (form.value.pin.trim()) body.pin = form.value.pin.trim()
    if (editing.value) await patchKruStock('ordering-users', editing.value.id, body, versi.value[editing.value.id])
    else await createKruStock('ordering-users', body)
    sheet.value = false
    await daftarQ.refresh()
    toast.add({ title: 'Kru tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

async function hapus(k: KruStock) {
  if (k.name === me.value?.name) {
    toast.add({ title: 'Tidak bisa menghapus akun sendiri', color: 'error' })
    return
  }
  if (k.role === 'admin' && semua.value.filter(x => x.role === 'admin').length <= 1) {
    toast.add({ title: 'Minimal 1 Admin', description: 'Angkat admin lain dulu sebelum menghapus ini.', color: 'error' })
    return
  }
  try {
    await deleteKruStock('ordering-users', k.id, versi.value[k.id])
    await daftarQ.refresh()
    toast.add({ title: 'Kru dihapus', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
}

const seeding = ref(false)
async function seedAwal() {
  const nama = (me.value?.name || '').trim()
  if (!nama) return
  seeding.value = true
  try {
    await importOrderingUsers([{ name: nama, role: 'admin' }])
    await daftarQ.refresh()
    toast.add({ title: 'Daftar diisi', description: 'Akunmu tercatat sebagai Admin.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal mengisi', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    seeding.value = false
  }
}

const kolom: TableColumn<KruStock>[] = [
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'role', header: 'Peran' },
  { accessorKey: 'keterangan', header: 'Keterangan' },
  { id: 'aksi', header: '' },
]
</script>

<template>
  <AppPage
    title="Kelola Akses"
    description="Kru dapur yang boleh order & check-in, beserta perannya"
  >
    <template #actions>
      <UButton
        label="Tambah kru"
        icon="i-lucide-plus"
        @click="bukaTambah"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Admin"
        :value="String(semua.filter(k => k.role === 'admin').length)"
        satuan="kru"
        icon="i-lucide-shield"
        tone="gold"
      />
      <AppStat
        label="Order + Check-in"
        :value="String(semua.filter(k => k.role === 'full').length)"
        satuan="kru"
        icon="i-lucide-shopping-cart"
        tone="info"
      />
      <AppStat
        label="Check-in saja"
        :value="String(semua.filter(k => k.role === 'checkin').length)"
        satuan="kru"
        icon="i-lucide-package-check"
        tone="success"
      />
    </AppStatGrid>

    <AppPanel
      v-if="!semua.length"
      title="Daftar masih kosong"
      description="Isi daftar awal dari akunmu sendiri sebagai Admin."
    >
      <UButton
        label="Isi daftar awal"
        icon="i-lucide-sparkles"
        :loading="seeding"
        @click="seedAwal"
      />
    </AppPanel>

    <AppPanel
      v-else
      title="Kru"
      flush
    >
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="semua"
        >
          <template #role-cell="{ row }">
            {{ labelPeran(row.original.role) }}
          </template>
          <template #keterangan-cell="{ row }">
            {{ row.original.keterangan || '—' }}
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                size="sm"
                :aria-label="`Ubah ${row.original.name}`"
                @click="bukaUbah(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                size="sm"
                color="error"
                :aria-label="`Hapus ${row.original.name}`"
                @click="hapus(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 p-3 lg:hidden">
        <div
          v-for="k in semua"
          :key="k.id"
          class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ k.name }}</b>
            <p class="text-sm text-muted">
              {{ labelPeran(k.role) }}{{ k.keterangan ? ` · ${k.keterangan}` : '' }}
            </p>
          </div>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              aria-label="Ubah peran"
              @click="bukaUbah(k)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              aria-label="Hapus kru"
              @click="hapus(k)"
            />
          </div>
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="editing ? 'Ubah peran kru' : 'Tambah kru'"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Nama">
          <UInput
            v-model="form.name"
            :disabled="!!editing"
            placeholder="Nama kru"
          />
        </UFormField>
        <UFormField label="Peran">
          <USelect
            v-model="form.role"
            :items="PERAN"
          />
        </UFormField>
        <UFormField label="Keterangan (opsional)">
          <UInput
            v-model="form.keterangan"
            placeholder="Mis. tim Kitchen"
          />
        </UFormField>
        <UFormField :label="editing ? 'PIN baru (kosongkan bila tidak diganti)' : 'PIN (opsional)'">
          <UInput
            v-model="form.pin"
            type="password"
            placeholder="PIN kru"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheet = false"
          />
          <UButton
            label="Simpan"
            :loading="menyimpan"
            @click="simpan"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
