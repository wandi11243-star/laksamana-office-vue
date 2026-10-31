<!--
  Cashier › Kelola Akses Kru (old `viewAkses`, deploy/cashier/index.html:4002-4062).
  Read-only: who holds the module comes from the Office; granting and revoking
  stays in the Office's own Kelola Akses. Deliberately NO level column — this
  module has no levels (cashier.md F.1, F.21), so such a column would lie.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ModulMember } from '~/composables/useRoster'

definePageMeta({ access: ['cashier'] })

const me = useMe()
const { data: anggota, status, error, refresh } = useModulMembers('cashier')

const baris = computed(() => [...anggota.value].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))))
const jumlahAdmin = computed(() => baris.value.filter(m => m.isModuleAdmin).length)
const saya = (m: ModulMember) => !!me.value?.name && String(m.name || '').toLowerCase() === me.value.name.toLowerCase()
const inisial = (n: string) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

const kolom: TableColumn<ModulMember>[] = [
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'keterangan', header: 'Tim / keterangan' },
  { accessorKey: 'active', header: 'Status akun' },
  { accessorKey: 'isModuleAdmin', header: 'Admin modul' },
]
</script>

<template>
  <AppPage
    title="Kelola akses kru"
    description="Siapa saja yang bisa membuka modul Cashier."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </template>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-lucide-key-round"
      title="Semua pemegang akses melihat halaman yang sama."
      description="Report Daily, Compliment, Performa Kasir, dan Dana Masuk — tidak ada level tampilan di modul ini. Kalau seseorang tidak boleh melihat salah satunya, yang benar adalah tidak memberinya modul ini sama sekali. Menambah dan menghapus akses dilakukan di Kelola Akses milik Office."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <AppPanel
        title="Pemegang akses modul Cashier"
        icon="i-lucide-users"
        :count="baris.length"
        flush
      >
        <div
          v-if="status === 'pending' && !baris.length"
          class="space-y-2 p-6"
        >
          <!-- Loading rows mirror the access table below. -->
          <USkeleton
            v-for="i in 5"
            :key="i"
            class="h-10 w-full"
          />
          <p class="pt-2 text-center text-sm text-muted">
            Memuat daftar akses dari Office…
          </p>
        </div>
        <div
          v-else-if="!baris.length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada kru dengan akses modul Cashier. Beri akses lewat Kelola Akses di Office.
        </div>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="baris"
            :columns="kolom"
          >
            <template #name-cell="{ row }">
              <span class="flex items-center gap-2.5">
                <span class="flex size-7 flex-none items-center justify-center rounded-md bg-primary-100 text-[11px] font-bold text-primary-800">{{ inisial(row.original.name) }}</span>
                <b class="text-highlighted">{{ row.original.name || '(tanpa nama)' }}</b>
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
            <template #active-cell="{ row }">
              <AppStatus
                :color="row.original.active === false ? 'warning' : 'success'"
                size="sm"
              >
                {{ row.original.active === false ? 'Nonaktif' : 'Aktif' }}
              </AppStatus>
            </template>
            <template #isModuleAdmin-cell="{ row }">
              <AppStatus
                v-if="row.original.isModuleAdmin"
                color="success"
                icon="i-lucide-shield-check"
                size="sm"
              >
                Admin modul
              </AppStatus>
              <span
                v-else
                class="text-dimmed"
              >—</span>
            </template>
          </UTable>

          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="m in baris"
              :key="m.id"
              class="flex items-start gap-3 p-4"
            >
              <span class="flex size-8 flex-none items-center justify-center rounded-md bg-primary-100 text-xs font-bold text-primary-800">{{ inisial(m.name) }}</span>
              <div class="min-w-0 flex-1">
                <b class="block text-highlighted">{{ m.name || '(tanpa nama)' }}</b>
                <span class="block text-xs text-muted">{{ m.keterangan || '—' }}</span>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <AppStatus
                    :color="m.active === false ? 'warning' : 'success'"
                    size="sm"
                  >
                    {{ m.active === false ? 'Nonaktif' : 'Aktif' }}
                  </AppStatus>
                  <AppStatus
                    v-if="m.isModuleAdmin"
                    color="success"
                    size="sm"
                  >
                    Admin modul
                  </AppStatus>
                  <AppStatus
                    v-if="saya(m)"
                    color="info"
                    size="sm"
                  >
                    kamu
                  </AppStatus>
                </div>
              </div>
            </div>
          </div>
        </template>
      </AppPanel>
      <p class="text-xs text-muted">
        {{ baris.length }} kru memegang akses Cashier · {{ jumlahAdmin }} di antaranya admin modul.
      </p>
    </template>
  </AppPage>
</template>
