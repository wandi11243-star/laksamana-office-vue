<!--
  Kelola Akses › Daftar kru (old Tab User, deploy/index.html:706-897).

  Superadmin only, but no single module key fits — so there is NO
  meta.access here. The guard below throws the standard 403 instead (same
  wording as the middleware). U2 builds the shell + user list; the write
  forms (U3/U4) hook into #actions and `sheet`.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAccountUsers, type AccountUser } from '~/composables/useAccount'
import { isAdminOf } from '~/composables/useMe'

const me = useMe()
if (!isAdminOf(me.value, '*')) {
  throw createError({ statusCode: 403, statusMessage: 'Anda belum punya akses ke modul ini. Minta admin membukanya di Kelola Akses.' })
}

const { data: akun, status, error, refresh } = useAccountUsers()
const users = computed(() => akun.value.users)

const nAktif = computed(() => users.value.filter(u => u.active).length)
const nNonaktif = computed(() => users.value.length - nAktif.value)
const nSuper = computed(() => users.value.filter(u => u.adminModules.includes('*')).length)

type Tapis = 'semua' | 'aktif' | 'nonaktif'
const cari = ref('')
const tapis = ref<Tapis>('aktif')

const kandidat = computed(() => {
  const k = cari.value.trim().toLowerCase()
  if (!k) return users.value
  return users.value.filter(u =>
    u.name.toLowerCase().includes(k) || u.username.toLowerCase().includes(k))
})
const tampil = computed(() => tapis.value === 'semua'
  ? kandidat.value
  : kandidat.value.filter(u => tapis.value === 'aktif' ? u.active : !u.active))

const opsiTapis = computed(() => [
  { value: 'semua' as Tapis, label: `Semua · ${kandidat.value.length}` },
  { value: 'aktif' as Tapis, label: `Aktif · ${kandidat.value.filter(u => u.active).length}` },
  { value: 'nonaktif' as Tapis, label: `Nonaktif · ${kandidat.value.filter(u => !u.active).length}` },
])

// Friendly module names for the grant chips; raw keys stay readable.
const labelModul = (key: string): string =>
  MODUL.find(m => m.access.includes(key))?.label ?? key

const superadmin = (u: AccountUser): boolean => u.adminModules.includes('*')
const saya = (u: AccountUser): boolean =>
  !!me.value && String(u.name || '').toLowerCase() === me.value.name.toLowerCase()
const inisial = (n: string): string =>
  String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

const kolom: TableColumn<AccountUser>[] = [
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'keterangan', header: 'Tim' },
  { accessorKey: 'modules', header: 'Modul' },
  { accessorKey: 'adminModules', header: 'Akses admin' },
  { accessorKey: 'active', header: 'Status' },
  { id: 'aksi', header: '' },
]

// U3 owns this sheet: the add/edit kru form goes inside, driven by `pilih`.
const sheet = ref(false)
const pilih = ref<AccountUser | null>(null)
function bukaUbah(u: AccountUser) {
  pilih.value = u
  sheet.value = true
}
</script>

<template>
  <AppPage
    title="Kelola Akses"
    description="Akun dan modul yang boleh dibuka. Tidak ada role: akses diberikan langsung per modul."
  >
    <template #actions>
      <!-- TODO(U3/U4): tombol Tambah kru, Impor/ekspor Excel, dan tab Modul masuk sini. -->
    </template>

    <AppStatGrid>
      <AppStat
        label="Total kru"
        :value="users.length"
        icon="i-lucide-users"
        tone="gold"
        sub="Terdaftar di Office"
      />
      <AppStat
        label="Aktif"
        :value="nAktif"
        icon="i-lucide-user-check"
        tone="success"
        sub="Bisa login"
      />
      <AppStat
        label="Nonaktif"
        :value="nNonaktif"
        icon="i-lucide-user-x"
        tone="warning"
        sub="Tidak bisa login"
      />
      <AppStat
        label="Superadmin"
        :value="nSuper"
        icon="i-lucide-shield-check"
        tone="info"
        sub="Kelola semua modul"
      />
    </AppStatGrid>

    <AppPanel
      title="Daftar kru"
      icon="i-lucide-users"
      :count="tampil.length"
      flush
    >
      <div class="flex flex-wrap items-center gap-2 px-4 pt-4 lg:px-5">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari nama atau username"
          class="min-w-48 flex-1 sm:max-w-72"
        />
        <AppSeg
          v-model="tapis"
          size="sm"
          :options="opsiTapis"
        />
      </div>

      <div
        v-if="status === 'pending' && !tampil.length"
        class="p-6 text-center text-sm text-muted"
      >
        Memuat daftar kru dari Office…
      </div>

      <div
        v-else-if="error"
        class="p-4 lg:p-5"
      >
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Tidak bisa memuat daftar kru"
          :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
        />
        <UButton
          label="Coba lagi"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          class="mt-3"
          @click="refresh()"
        />
      </div>

      <div
        v-else-if="!tampil.length"
        class="p-6 text-center text-sm text-muted"
      >
        <b class="block text-highlighted">Tidak ada kru yang cocok</b>
        <template v-if="cari">
          Tidak ada kru{{ tapis === 'semua' ? '' : ` ${tapis}` }} yang cocok dengan “{{ cari.trim() }}”.{{ tapis === 'semua' ? '' : ' Coba tapis Semua.' }}
        </template>
        <template v-else>
          {{ tapis === 'semua' ? 'Belum ada kru terdaftar.' : `Tidak ada kru ${tapis}.` }}
        </template>
      </div>

      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="tampil"
          :columns="kolom"
        >
          <template #name-cell="{ row }">
            <span class="flex items-center gap-2">
              <span class="flex size-7 flex-none items-center justify-center rounded-md bg-yellow-light text-[11px] font-bold text-yellow-dark">{{ inisial(row.original.name) }}</span>
              <span class="min-w-0">
                <b class="block truncate text-highlighted">{{ row.original.name || '(tanpa nama)' }}</b>
                <span
                  v-if="row.original.username"
                  class="block truncate text-xs text-muted"
                >@{{ row.original.username }}</span>
              </span>
              <AppStatus
                v-if="saya(row.original)"
                color="info"
                size="sm"
              >kamu</AppStatus>
            </span>
          </template>
          <template #keterangan-cell="{ row }">
            <span class="text-muted">{{ row.original.keterangan || '—' }}</span>
          </template>
          <template #modules-cell="{ row }">
            <div
              v-if="row.original.modules.length"
              class="flex flex-wrap gap-1"
            >
              <span
                v-for="m in row.original.modules.slice(0, 3)"
                :key="m"
                class="rounded-full border border-default px-2 py-0.5 text-[11px] text-muted"
              >{{ labelModul(m) }}</span>
              <span
                v-if="row.original.modules.length > 3"
                class="rounded-full border border-default px-2 py-0.5 text-[11px] font-semibold text-muted"
              >+{{ row.original.modules.length - 3 }}</span>
            </div>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #adminModules-cell="{ row }">
            <AppStatus
              v-if="superadmin(row.original)"
              color="gold"
              icon="i-lucide-shield-check"
              size="sm"
            >
              Superadmin
            </AppStatus>
            <span
              v-else-if="row.original.adminModules.length"
              class="text-xs text-muted"
            >Admin: {{ row.original.adminModules.map(labelModul).join(', ') }}</span>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #active-cell="{ row }">
            <AppStatus
              :color="row.original.active ? 'success' : 'neutral'"
              :icon="row.original.active ? 'i-lucide-check' : 'i-lucide-minus'"
              size="sm"
            >
              {{ row.original.active ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                :aria-label="`Ubah ${row.original.name}`"
                @click="bukaUbah(row.original)"
              />
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="u in tampil"
            :key="u.id"
            class="flex items-start gap-3 p-4"
          >
            <span class="flex size-8 flex-none items-center justify-center rounded-md bg-yellow-light text-xs font-bold text-yellow-dark">{{ inisial(u.name) }}</span>
            <div class="min-w-0 flex-1">
              <b class="block truncate text-highlighted">{{ u.name || '(tanpa nama)' }}</b>
              <span class="block truncate text-xs text-muted">
                <template v-if="u.username">@{{ u.username }}</template>
                <template v-if="u.username && u.keterangan"> · </template>
                <template v-if="u.keterangan">{{ u.keterangan }}</template>
                <template v-if="!u.username && !u.keterangan">—</template>
              </span>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <AppStatus
                  :color="u.active ? 'success' : 'neutral'"
                  :icon="u.active ? 'i-lucide-check' : 'i-lucide-minus'"
                  size="sm"
                >
                  {{ u.active ? 'Aktif' : 'Nonaktif' }}
                </AppStatus>
                <AppStatus
                  v-if="superadmin(u)"
                  color="gold"
                  icon="i-lucide-shield-check"
                  size="sm"
                >
                  Superadmin
                </AppStatus>
                <AppStatus
                  v-else-if="u.adminModules.length"
                  color="neutral"
                  size="sm"
                >
                  Admin: {{ u.adminModules.map(labelModul).join(', ') }}
                </AppStatus>
                <AppStatus
                  v-if="saya(u)"
                  color="info"
                  size="sm"
                >
                  kamu
                </AppStatus>
              </div>
              <div
                v-if="u.modules.length"
                class="mt-1.5 flex flex-wrap gap-1"
              >
                <span
                  v-for="m in u.modules.slice(0, 3)"
                  :key="m"
                  class="rounded-full border border-default px-2 py-0.5 text-[11px] text-muted"
                >{{ labelModul(m) }}</span>
                <span
                  v-if="u.modules.length > 3"
                  class="rounded-full border border-default px-2 py-0.5 text-[11px] font-semibold text-muted"
                >+{{ u.modules.length - 3 }}</span>
              </div>
            </div>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              size="xs"
              :aria-label="`Ubah ${u.name}`"
              @click="bukaUbah(u)"
            />
          </div>
        </div>
      </template>
    </AppPanel>

    <!-- TODO(U3): form tambah/ubah kru masuk sini, memakai `pilih`. -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="pilih ? `Ubah ${pilih.name}` : 'Kru'"
    />
  </AppPage>
</template>
