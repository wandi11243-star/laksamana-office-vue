<!--
  Stock › Kelola Akses › tab Purchasing (page: pages/stock/akses.vue; old `deploy/stock/purchasing/index.html:202-203,1059-…`).

  Admin only. Permission matrix (`PERM_PAGES` × role, saved to
  `PUT /settings/purchasing`) + the purchasing crew list. The old
  `PERM_DEFAULT` row is the fallback; while `stock_settings` is missing the
  server refuses writes (503) and the matrix is shown read-only (F.21).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { KruStock } from '~/composables/useStock'
import {
  createKruStock,
  deleteKruStock,
  getStockSettings,
  listKruStock,
  patchKruStock,
  putStockSettings,
} from '~/composables/useStock'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { isAdminOf } from '~/composables/useMe'
import { tanganiKonflik, type Versi } from '~/utils/versi'

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'purchasing'))

const HALAMAN = [
  { id: 'dashboard', label: 'Monitor Order' },
  { id: 'jemput', label: 'Jemput Hari Ini' },
  { id: 'online', label: 'Barang Online' },
  { id: 'ck', label: 'Central Kitchen' },
  { id: 'overview', label: 'Rekap Per Bulan' },
  { id: 'database', label: 'Database & Vendor' },
  { id: 'users', label: 'Kelola Akses' },
]
const NILAI = [
  { value: 2, label: 'Boleh ubah' },
  { value: 1, label: 'Lihat' },
  { value: 0, label: 'Tak terlihat' },
]
const BAKU: Record<string, Record<string, number>> = {
  dashboard: { full: 2, view: 1 },
  jemput: { full: 2, view: 1 },
  ck: { full: 2, view: 1 },
  overview: { full: 1, view: 1 },
  database: { full: 2, view: 1 },
  users: { full: 0, view: 0 },
}

// Both reads are admin-only on the server; non-admins see the "Khusus admin" notice instead.
const setQ = useAsyncData('stock-pengaturan', () => (admin.value ? getStockSettings('purchasing') : Promise.resolve({ data: {}, versi: undefined, tersedia: true })), {
  watch: [admin],
  default: () => ({ data: {} as { perms?: Record<string, Record<string, number>> }, versi: undefined, tersedia: true }),
})
const draf = ref<Record<string, Record<string, number>>>({})
watch(() => setQ.data.value?.data, (d) => {
  const isi: Record<string, Record<string, number>> = {}
  for (const h of HALAMAN) {
    isi[h.id] = {
      full: d?.perms?.[h.id]?.full ?? BAKU[h.id]?.full ?? 0,
      view: d?.perms?.[h.id]?.view ?? BAKU[h.id]?.view ?? 0,
    }
  }
  draf.value = isi
}, { immediate: true })

const simpanIzin = ref(false)
async function simpanPerms() {
  simpanIzin.value = true
  try {
    await putStockSettings('purchasing', { perms: draf.value }, setQ.data.value?.versi)
    await setQ.refresh()
    toast.add({ title: 'Izin tersimpan', color: 'success' })
  }
  catch (e) {
    if (apiErrorCode(e) === 'settings_unavailable') {
      toast.add({ title: 'Pengaturan belum tersedia', description: 'Tabel pengaturan belum dibuat saat cutover — matriks di bawah hanya bawaan.', color: 'warning' })
    }
    else toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    simpanIzin.value = false
  }
}

// --- crew -----------------------------------------------------------------------
const daftarQ = useAsyncData('stock-purch-users', () => (admin.value ? listKruStock('users') : Promise.resolve({ rows: [] as KruStock[], versions: {} as Record<string, Versi> })), {
  watch: [admin],
  default: () => ({ rows: [] as KruStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => daftarQ.data.value?.versions ?? {})
const semua = computed(() => daftarQ.data.value?.rows ?? [])

const PERAN = [
  { value: 'admin', label: 'Admin' },
  { value: 'full', label: 'Full' },
  { value: 'view', label: 'Lihat' },
]
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
    toast.add({ title: 'Nama kosong', color: 'warning' })
    return
  }
  menyimpan.value = true
  try {
    const body: Record<string, unknown> = { name: form.value.name.trim(), role: form.value.role, keterangan: form.value.keterangan.trim() }
    if (form.value.pin.trim()) body.pin = form.value.pin.trim()
    if (editing.value) await patchKruStock('users', editing.value.id, body, versi.value[editing.value.id])
    else await createKruStock('users', body)
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
  try {
    await deleteKruStock('users', k.id, versi.value[k.id])
    await daftarQ.refresh()
    toast.add({ title: 'Kru dihapus', color: 'success' })
  }
  catch (e) {
    if (apiErrorCode(e) === 'last_admin') toast.add({ title: 'Admin terakhir tidak bisa dihapus', color: 'error' })
    else if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
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
  <div class="flex flex-col gap-6">
    <AppPanel
      v-if="!admin"
      title="Khusus admin"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Kelola Akses hanya untuk admin Purchasing.
      </p>
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Matriks izin"
      description="Admin selalu boleh ubah semua."
    >
      <p
        v-if="!setQ.data.value?.tersedia"
        class="mb-3 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
      >
        Tabel pengaturan belum ada — yang tampil matriks bawaan dan belum bisa disimpan.
      </p>
      <div class="hidden lg:block">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-muted text-muted">
              <th class="p-2 text-left font-semibold">
                Halaman
              </th>
              <th class="p-2 text-left font-semibold">
                Full
              </th>
              <th class="p-2 text-left font-semibold">
                Lihat
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="h in HALAMAN"
              :key="h.id"
              class="border-t border-default"
            >
              <td class="p-2 text-default">
                {{ h.label }}
              </td>
              <td class="p-2">
                <USelect
                  v-model="draf[h.id]!.full"
                  :items="NILAI"
                  :disabled="!setQ.data.value?.tersedia"
                  size="sm"
                />
              </td>
              <td class="p-2">
                <USelect
                  v-model="draf[h.id]!.view"
                  :items="NILAI"
                  :disabled="!setQ.data.value?.tersedia"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-col gap-3 lg:hidden">
        <div
          v-for="h in HALAMAN"
          :key="h.id"
          class="rounded-xl border bg-muted border-default p-3"
        >
          <b class="text-highlighted">{{ h.label }}</b>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <UFormField label="Full">
              <USelect
                v-model="draf[h.id]!.full"
                :items="NILAI"
                :disabled="!setQ.data.value?.tersedia"
              />
            </UFormField>
            <UFormField label="Lihat">
              <USelect
                v-model="draf[h.id]!.view"
                :items="NILAI"
                :disabled="!setQ.data.value?.tersedia"
              />
            </UFormField>
          </div>
        </div>
      </div>
      <UButton
        label="Simpan izin"
        class="mt-3"
        :loading="simpanIzin"
        :disabled="!setQ.data.value?.tersedia"
        @click="simpanPerms"
      />
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Kru purchasing"
      flush
    >
      <template #actions>
        <UButton
          label="Tambah kru"
          icon="i-lucide-plus"
          size="sm"
          @click="bukaTambah"
        />
      </template>
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="semua"
        >
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
                loading-auto
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
          class="flex items-center justify-between gap-2 rounded-xl border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ k.name }}</b>
            <p class="text-sm text-muted">
              {{ k.role }}{{ k.keterangan ? ` · ${k.keterangan}` : '' }}
            </p>
          </div>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              :aria-label="`Ubah ${k.name}`"
              @click="bukaUbah(k)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              :aria-label="`Hapus ${k.name}`"
              loading-auto
              @click="hapus(k)"
            />
          </div>
        </div>
        <p
          v-if="!semua.length"
          class="text-sm text-dimmed"
        >
          Belum ada kru.
        </p>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-if="admin"
      v-model:open="sheet"
      :title="editing ? 'Ubah kru' : 'Tambah kru'"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Nama">
          <UInput
            v-model="form.name"
            :disabled="!!editing"
          />
        </UFormField>
        <UFormField label="Peran">
          <USelect
            v-model="form.role"
            :items="PERAN"
          />
        </UFormField>
        <UFormField label="Keterangan (opsional)">
          <UInput v-model="form.keterangan" />
        </UFormField>
        <UFormField :label="editing ? 'PIN baru (kosongkan bila tidak diganti)' : 'PIN (opsional)'">
          <UInput
            v-model="form.pin"
            type="password"
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
  </div>
</template>
