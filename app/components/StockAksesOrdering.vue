<!--
  Stock › Kelola Akses › tab Ordering (page: pages/stock/akses.vue; old `deploy/stock/ordering/index.html:204-206,827-893`).

  Admin only. Kitchen crew list with roles: Admin / Order + Check-in /
  Check-in Saja. The roster seed fills an empty list (`ordering-users-import`).
  Guards: cannot demote yourself, at least one admin stays.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { KruStock } from '~/composables/useStock'
import {
  createKruStock, deleteKruStock, getStockSettings, importOrderingUsers, listKruStock, muatPeranStock, patchKruStock, putStockSettings,
} from '~/composables/useStock'
import { isAdminOf } from '~/composables/useMe'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, type Versi } from '~/utils/versi'

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'ordering'))

const daftarQ = useAsyncData('stock-ordering-users', () => (admin.value ? listKruStock('ordering-users') : Promise.resolve({ rows: [] as KruStock[], versions: {} as Record<string, Versi> })), {
  watch: [admin],
  default: () => ({ rows: [] as KruStock[], versions: {} as Record<string, Versi> }),
})
const versi = computed(() => daftarQ.data.value?.versions ?? {})
const semua = computed(() => daftarQ.data.value?.rows ?? [])

// --- page matrix (which Ordering screens each role sees) ---------------------------
// Saved to `PUT /stock/settings/ordering` as {perms: {page: {full, checkin}}};
// `GET /stock/me` hands each crew member their row, which hides the sidebar
// screens and guards the writes (StockPeran). Admin always edits everything.
const HALAMAN = [
  { id: 'order', label: 'Form Order Belanja', icon: 'i-lucide-shopping-cart' },
  { id: 'ck', label: 'Central Kitchen', icon: 'i-lucide-chef-hat' },
  { id: 'gb', label: 'Gudang Bar', icon: 'i-lucide-wine' },
  { id: 'checkin', label: 'Check-in Penerimaan', icon: 'i-lucide-package-check' },
]
const PERAN_MATRIKS = [
  { id: 'full', label: 'Order + Check-in' },
  { id: 'checkin', label: 'Check-in Saja' },
] as const
const NILAI = [
  { value: 2, label: 'Boleh ubah' },
  { value: 1, label: 'Lihat saja' },
  { value: 0, label: 'Tak terlihat' },
]
// The server's ORDERING_DEFAULT (old ORD_PERM_DEFAULT).
const BAKU: Record<string, Record<string, number>> = {
  order: { full: 2, checkin: 0 },
  ck: { full: 2, checkin: 0 },
  gb: { full: 2, checkin: 1 },
  checkin: { full: 2, checkin: 2 },
}

const setQ = useAsyncData('stock-pengaturan-ordering', () => (admin.value ? getStockSettings('ordering') : Promise.resolve({ data: {}, versi: undefined, tersedia: true })), {
  watch: [admin],
  default: () => ({ data: {} as { perms?: Record<string, Record<string, number>> }, versi: undefined, tersedia: true }),
})
const draf = ref<Record<string, Record<string, number>>>({})
function isiDraf() {
  const d = setQ.data.value?.data
  const isi: Record<string, Record<string, number>> = {}
  for (const h of HALAMAN) {
    isi[h.id] = Object.fromEntries(PERAN_MATRIKS.map(p => [p.id, d?.perms?.[h.id]?.[p.id] ?? BAKU[h.id]?.[p.id] ?? 0]))
  }
  draf.value = isi
}
watch(() => setQ.data.value?.data, isiDraf, { immediate: true })
const drafBerubah = computed(() => HALAMAN.some(h => PERAN_MATRIKS.some(p =>
  draf.value[h.id]?.[p.id] !== (setQ.data.value?.data?.perms?.[h.id]?.[p.id] ?? BAKU[h.id]?.[p.id] ?? 0))))

const simpanIzin = ref(false)
async function simpanPerms() {
  simpanIzin.value = true
  try {
    // Keep pages this screen does not edit (restock, forecast) as they were.
    await putStockSettings('ordering', { perms: { ...(setQ.data.value?.data?.perms ?? {}), ...draf.value } }, setQ.data.value?.versi)
    await Promise.all([setQ.refresh(), muatPeranStock()])
    toast.add({ title: 'Izin halaman tersimpan', description: 'Berlaku saat kru membuka ulang modul Stock.', color: 'success' })
  }
  catch (e) {
    if (apiErrorCode(e) === 'settings_unavailable') {
      toast.add({ title: 'Pengaturan belum tersedia', description: 'Tabel pengaturan belum ada — matriks di bawah hanya bawaan.', color: 'warning' })
    }
    else if (!(await tanganiKonflik(e, () => setQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    simpanIzin.value = false
  }
}

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
  <div class="flex flex-col gap-6">
    <AppPanel
      v-if="!admin"
      title="Khusus admin"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Kelola Akses hanya untuk admin Ordering.
      </p>
    </AppPanel>

    <AppStatGrid v-if="admin">
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
      v-if="admin"
      title="Halaman yang tampil"
      description="Atur halaman Ordering yang terlihat dan boleh diubah tiap peran. Admin selalu bisa semuanya."
    >
      <template #actions>
        <UButton
          v-if="drafBerubah"
          label="Batalkan"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="isiDraf"
        />
      </template>
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
              <th
                v-for="p in PERAN_MATRIKS"
                :key="p.id"
                class="p-2 text-left font-semibold"
              >
                {{ p.label }}
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
                <span class="inline-flex items-center gap-2">
                  <UIcon
                    :name="h.icon"
                    class="size-4 text-gold-deep"
                  />
                  {{ h.label }}
                </span>
              </td>
              <td
                v-for="p in PERAN_MATRIKS"
                :key="p.id"
                class="p-2"
              >
                <USelect
                  v-model="draf[h.id]![p.id]"
                  :items="NILAI"
                  :disabled="!setQ.data.value?.tersedia"
                  size="sm"
                  class="w-40"
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
          class="rounded-xl border border-default bg-muted p-3"
        >
          <b class="inline-flex items-center gap-2 text-highlighted">
            <UIcon
              :name="h.icon"
              class="size-4 text-gold-deep"
            />
            {{ h.label }}
          </b>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <UFormField
              v-for="p in PERAN_MATRIKS"
              :key="p.id"
              :label="p.label"
            >
              <USelect
                v-model="draf[h.id]![p.id]"
                :items="NILAI"
                :disabled="!setQ.data.value?.tersedia"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </div>
      <p class="mt-3 text-xs text-dimmed">
        "Tak terlihat" menyembunyikan halaman dari menu kru dengan peran itu; "Lihat saja" menampilkan tanpa tombol simpan. Approval Order tidak diatur di sini.
      </p>
      <UButton
        label="Simpan izin halaman"
        icon="i-lucide-save"
        class="mt-3"
        :loading="simpanIzin"
        :disabled="!setQ.data.value?.tersedia || !drafBerubah"
        @click="simpanPerms"
      />
    </AppPanel>

    <AppPanel
      v-if="admin && !semua.length"
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
      v-else-if="admin"
      title="Kru ordering"
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
              loading-auto
              @click="hapus(k)"
            />
          </div>
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-if="admin"
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
  </div>
</template>
