<!--
  Wajah — absensi/index.html viewWajah, :1578-1638. Only the INFORMATION half is
  built here: whether your own face is enrolled and, for HR, who has one. Face
  enrolment and deletion need the camera and are K-02 / task #15, so they stay
  in the Absensi PWA; this screen links there.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AbsensiWajah } from '~/composables/useAbsensi'
import { useAbsensiContext, useAbsensiFaces, useAbsensiHr } from '~/composables/useAbsensi'
import { PWA_ABSENSI } from '~/utils/layar/absensi'

definePageMeta({ access: ['absensi'] })

const PWA = PWA_ABSENSI
const hr = useAbsensiHr()

const { data: ctx, error: errCtx } = useAbsensiContext()
const terdaftar = computed(() => ctx.value?.wajahTerdaftar === 1)
const wajib = computed(() => ctx.value?.setting?.wajahWajib === true)

// HR only read; no needless 403 for crew.
const { data: faces, status, error, refresh } = useAbsensiFaces()
watch(hr, (v) => {
  if (v) {
    refresh()
  }
}, { immediate: true })

const rows = computed(() => faces.value ?? [])
const tipeTeks = (x: AbsensiWajah) => (x.tipe === 'DW' ? 'Pekerja harian' : 'Kru')
const adaTeks = (x: AbsensiWajah) => (x.aktif && x.ada ? 'Terdaftar' : 'Kosong')

const kolom = computed<TableColumn<AbsensiWajah>[]>(() => [
  { id: 'nama', header: 'Nama', cell: ({ row }) => row.original.nama || row.original.id },
  { id: 'tipe', header: 'Tipe', cell: ({ row }) => tipeTeks(row.original) },
  { id: 'oleh', header: 'Didaftarkan', cell: ({ row }) => row.original.oleh || '—' },
  { id: 'status', header: 'Status' },
])
</script>

<template>
  <AppPage
    title="Wajah"
    description="Yang disimpan bukan foto, melainkan 128 angka yang tidak bisa dibalik jadi wajah. Pencocokannya dikerjakan server."
  >
    <p
      v-if="errCtx"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(errCtx) }}
    </p>

    <AppPanel
      title="Wajahmu"
      icon="i-lucide-scan-face"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex size-11 shrink-0 items-center justify-center rounded-field"
          :class="terdaftar ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning'"
        >
          <UIcon
            name="i-lucide-scan-face"
            class="size-6"
          />
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-highlighted">
            {{ terdaftar ? 'Wajahmu sudah terdaftar' : 'Wajahmu belum terdaftar' }}
          </p>
          <p class="text-sm text-muted">
            {{ terdaftar
              ? 'Daftarkan ulang kalau penampilanmu banyak berubah.'
              : wajib
                ? 'Wajah wajib cocok, tapi wajahmu belum didaftarkan. Daftarkan dulu sebelum absen.'
                : 'Belum wajib, tapi daftar sekali supaya absenmu lebih kuat buktinya.' }}
          </p>
        </div>
      </div>
      <div class="mt-3">
        <UButton
          :to="PWA"
          target="_blank"
          rel="noopener"
          icon="i-lucide-external-link"
          :label="terdaftar ? 'Daftarkan ulang di aplikasi absen' : 'Daftarkan di aplikasi absen'"
        />
      </div>
      <p class="mt-3 text-sm text-muted">
        Pendaftaran langsung di Office Vue menyusul di tugas terakhir (K-02); sementara ini lewat
        aplikasi Absensi.
      </p>
    </AppPanel>

    <template v-if="hr">
      <p
        v-if="error"
        class="mb-4 text-error"
        role="alert"
      >
        {{ apiErrorMessage(error) }}
      </p>

      <AppPanel
        title="Daftar Kru"
        :count="rows.length"
        description="Siapa saja yang sudah punya sidik wajah."
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="rows"
          :columns="kolom"
          :loading="status === 'pending'"
          empty="Belum ada yang mendaftarkan wajah."
        >
          <template #status-cell="{ row }">
            <AppStatus
              size="sm"
              :color="row.original.aktif && row.original.ada ? 'success' : 'neutral'"
            >
              {{ adaTeks(row.original) }}
            </AppStatus>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="x in rows"
            :key="`${x.tipe}-${x.id}`"
            class="flex items-start justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ x.nama || x.id }}
              </p>
              <p class="text-sm text-muted">
                {{ tipeTeks(x) }} · didaftarkan {{ x.oleh || '—' }}
              </p>
            </div>
            <AppStatus
              size="sm"
              :color="x.aktif && x.ada ? 'success' : 'neutral'"
            >
              {{ adaTeks(x) }}
            </AppStatus>
          </div>
          <p
            v-if="status !== 'pending' && !rows.length"
            class="px-4 py-6 text-center text-muted"
          >
            Belum ada yang mendaftarkan wajah.
          </p>
        </div>

        <p class="border-t border-default px-4 py-2 text-xs text-dimmed">
          Hanya untuk dilihat. Pendaftaran & penghapusan wajah belum dibangun di Office Vue (K-02).
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
