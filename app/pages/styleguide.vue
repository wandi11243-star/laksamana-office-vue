<!--
  Living style guide (dev only: `npm run dev`, then /styleguide). Every building
  block in the Laksamana look, light and dark, plus the shared helpers every
  module starts from (fondasi F1 version & conflict, F3 format, F4 ModulMenu).
  If it is not here, check DESIGN.md before inventing it.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ public: true, layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Halaman tidak ditemukan.' })

const colorMode = useColorMode()
const sheet = ref(false)
const toast = useToast()

// --- Fondasi F1: version & conflict, shown without calling the API -----------
const envelopeContoh = { data: {}, meta: { version: 1789823400000 } }
const contohVersi = versiDari(envelopeContoh)
const contohIfMatch = ifMatch(contohVersi!)
const hasilKonflik = ref('')

/** A 409 shaped like the real envelope, so apiErrorCode() finds the code. */
const err = (code: string, status: number, message: string) => ({
  statusCode: status,
  data: { error: { code, message } },
})

const cobaKonflik = async () => {
  hasilKonflik.value = await tanganiKonflik(
    err('version_conflict', 409, 'Data sudah diubah orang lain.'),
    () => Promise.resolve(),
  )
    ? 'tanganiKonflik() mengembalikan true: toast konflik + muat ulang. Tidak ada penimpaan otomatis, tidak ada tulisan yang diulang diam-diam.'
    : 'tanganiKonflik() mengembalikan false: pemanggil yang menampilkan pesan error.'
}

const cobaErrorBiasa = async () => {
  const e = err('validation_failed', 422, 'Jumlah Pax minimal 1.')
  const ditangani = await tanganiKonflik(e, () => Promise.resolve())
  hasilKonflik.value = ditangani
    ? 'Ditangani sebagai konflik.'
    : `tanganiKonflik() mengembalikan false, jadi layar ini menampilkan apa adanya: "${apiErrorMessage(e)}"`
}

// --- Fondasi F3: format ----------------------------------------------------
const contohFormat = computed(() => [
  { label: 'Rupiah', code: 'rupiah(1250000)', nilai: rupiah(1250000) },
  { label: 'Rupiah kosong', code: 'rupiah(null)', nilai: rupiah(null) },
  { label: 'Angka', code: 'angka(1250000)', nilai: angka(1250000) },
  { label: 'Persen (pecahan)', code: 'persen(0.125)', nilai: persen(0.125) },
  { label: 'Persen sudah persen', code: 'persen(12.5 / 100)', nilai: persen(12.5 / 100) },
  { label: 'Tanggal pendek', code: 'tglPendek("2026-09-27")', nilai: tglPendek('2026-09-27') },
  { label: 'Tanggal panjang', code: 'tglPanjang("2026-09-27")', nilai: tglPanjang('2026-09-27') },
  { label: 'Jam', code: 'jam("19:05")', nilai: jam('19:05') },
  { label: 'Hari ini', code: 'hariIni()', nilai: hariIni() },
  { label: 'Tambah hari', code: 'tambahHari("2026-09-27", 1)', nilai: tambahHari('2026-09-27', 1) },
])

// --- Fondasi F4: ModulMenu ------------------------------------------------
const contohLayar: Layar[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Halaman depan modul', icon: 'i-lucide-layout-dashboard', to: '/styleguide' },
  { key: 'riwayat', label: 'Riwayat', desc: 'Halaman yang belum dibuat → Segera', icon: 'i-lucide-history', to: '/styleguide/riwayat' },
  { key: 'master', label: 'Master data', desc: 'Kelola pilihan & pengaturan', icon: 'i-lucide-sliders-horizontal', to: '/styleguide/master', grup: 'Pengaturan' },
]

const yellow = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const ink = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const rows = [
  { item: 'Susu full cream', sisa: '6 L', min: '20 L', s: 'error' as const, label: 'Kritis' },
  { item: 'Biji kopi house blend', sisa: '3 kg', min: '5 kg', s: 'warning' as const, label: 'Rendah' },
  { item: 'Gula aren cair', sisa: '14 L', min: '5 L', s: 'success' as const, label: 'Aman' },
]
type Row = typeof rows[number]
const columns: TableColumn<Row>[] = [
  { accessorKey: 'item', header: 'Bahan' },
  { accessorKey: 'sisa', header: 'Sisa' },
  { accessorKey: 'min', header: 'Minimum' },
  { id: 'status', header: 'Status' },
]
</script>

<template>
  <div class="min-h-dvh bg-muted px-4 py-8 lg:px-10">
    <AppPage
      title="Style guide"
      description="Blok bangunan Laksamana Office. Aturan dan alasannya: DESIGN.md."
    >
      <div class="mb-8 flex flex-wrap gap-2">
        <UButton
          label="Terang"
          color="neutral"
          :variant="colorMode.value === 'light' ? 'solid' : 'soft'"
          @click="colorMode.preference = 'light'"
        />
        <UButton
          label="Gelap"
          color="neutral"
          :variant="colorMode.value === 'dark' ? 'solid' : 'soft'"
          @click="colorMode.preference = 'dark'"
        />
      </div>

      <AppList title="Warna · kuning (primary) hanya untuk isian: tombol utama, penanda aktif">
        <div class="grid grid-cols-11">
          <div
            v-for="n in yellow"
            :key="n"
            class="h-14"
            :style="{ background: `var(--color-laksamana-${n})` }"
            :title="`laksamana-${n}`"
          />
        </div>
      </AppList>
      <AppList title="Warna · ink (neutral) untuk semua yang lain">
        <div class="grid grid-cols-11">
          <div
            v-for="n in ink"
            :key="n"
            class="h-14"
            :style="{ background: `var(--color-ink-${n})` }"
            :title="`ink-${n}`"
          />
        </div>
      </AppList>

      <AppList title="Tipografi · Geist">
        <div class="space-y-2 p-4">
          <p class="text-4xl font-extrabold tracking-tight text-highlighted">
            Judul halaman
          </p>
          <p class="text-3xl font-extrabold tracking-tight text-highlighted num">
            Rp 18.450.000
          </p>
          <p class="font-semibold text-highlighted">
            Judul baris
          </p>
          <p class="text-default">
            Teks biasa. Kalimat pendek, bahasa sehari-hari, huruf besar hanya di awal kalimat.
          </p>
          <p class="text-sm text-muted">
            Keterangan dan label bagian
          </p>
        </div>
      </AppList>

      <div class="grid gap-x-8 lg:grid-cols-2">
        <div>
          <p class="px-1 pb-2 text-sm font-semibold text-muted">
            AppFocus · satu per layar
          </p>
          <AppFocus
            label="Setoran belum dicocokkan"
            value="Rp 18.450.000"
            hint="2 setoran · 1 selisih Rp 35.000"
            class="mb-7"
          >
            <UButton
              label="Cocokkan"
              size="xl"
              @click="toast.add({ title: 'Contoh toast', color: 'success' })"
            />
          </AppFocus>
        </div>

        <AppList
          title="AppList + AppListRow + AppStatus"
          :action="{ label: 'Aksi', to: '/styleguide' }"
        >
          <AppListRow
            title="Baris dengan tautan"
            description="Keterangan singkat"
            icon="i-lucide-mic-vocal"
            to="/styleguide"
          >
            <template #trailing>
              <AppStatus color="success">
                Siap
              </AppStatus>
            </template>
          </AppListRow>
          <AppListRow
            title="Baris dengan angka"
            description="Angka rata kanan, tabular"
            icon="i-lucide-wallet"
          >
            <template #trailing>
              Rp 2.340.000
            </template>
          </AppListRow>
          <AppListRow
            title="Baris yang membuka sheet"
            icon="i-lucide-square-pen"
            @click="sheet = true"
          />
        </AppList>
      </div>

      <AppList title="Tombol">
        <div class="flex flex-wrap items-center gap-2 p-4">
          <UButton label="Utama (kuning)" />
          <UButton
            label="Sekunder"
            color="neutral"
            variant="soft"
          />
          <UButton
            label="Garis"
            color="neutral"
            variant="outline"
          />
          <UButton
            label="Ghost"
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
          />
          <UButton
            label="Hapus"
            color="error"
            variant="soft"
          />
          <UButton
            label="Memuat"
            loading
          />
        </div>
      </AppList>

      <AppList title="Form">
        <div class="grid gap-4 p-4 sm:grid-cols-2">
          <UFormField
            label="Nama tamu"
            help="Sesuai KTP"
          >
            <UInput
              placeholder="Contoh: Dimas"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Area">
            <USelect
              :items="['Indoor', 'Outdoor', 'Bar']"
              placeholder="Pilih area"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="PIN"
            error="PIN harus 4–8 angka."
          >
            <UInput
              type="password"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Catatan">
            <UTextarea class="w-full" />
          </UFormField>
        </div>
      </AppList>

      <p class="px-1 pb-2 text-sm font-semibold text-muted">
        Tabel (desktop) · di HP, data yang sama tampil sebagai AppList
      </p>
      <div class="mb-7 overflow-hidden rounded-2xl bg-default">
        <UTable
          :data="rows"
          :columns="columns"
        >
          <template #status-cell="{ row }">
            <AppStatus :color="row.original.s">
              {{ row.original.label }}
            </AppStatus>
          </template>
        </UTable>
      </div>

      <ResponsiveSheet
        v-model:open="sheet"
        title="Setujui pengajuan?"
        description="Tukar shift Sabtu · Rani → Dimas"
      >
        <template #footer>
          <UButton
            label="Setujui"
            size="xl"
            @click="sheet = false"
          />
          <UButton
            label="Nanti"
            color="neutral"
            variant="soft"
            size="xl"
            @click="sheet = false"
          />
        </template>
      </ResponsiveSheet>

      <AppList title="Fondasi · versi & konflik (F1)">
        <div class="space-y-3 p-4">
          <p class="text-sm text-muted">
            ifMatch() + tanganiKonflik(): setiap tulisan berversi memakai keduanya. Bacaan
            <code class="text-default">meta.version</code> =
            <code class="text-default">{{ contohVersi }}</code>, tulisan <code class="text-default">If-Match</code> =
            <code class="text-default">{{ contohIfMatch }}</code>. Versi bersifat buta: apa adanya dikirim balik, tidak dihitung.
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Coba konflik versi (409)"
              @click="cobaKonflik"
            />
            <UButton
              label="Coba error biasa (422)"
              color="neutral"
              variant="soft"
              @click="cobaErrorBiasa"
            />
          </div>
          <p
            v-if="hasilKonflik"
            class="text-sm text-muted"
          >
            {{ hasilKonflik }}
          </p>
        </div>
      </AppList>

      <AppList title="Fondasi · format (F3)">
        <div class="px-4 pt-4 text-sm text-muted">
          Satu sumber untuk semua modul. Angka rata kanan memakai class <code class="text-default">num</code>.
        </div>
        <AppListRow
          v-for="f in contohFormat"
          :key="f.label"
          :title="f.label"
          :description="f.code"
        >
          <template #trailing>
            {{ f.nilai }}
          </template>
        </AppListRow>
      </AppList>

      <ModulMenu :layar="contohLayar" />
    </AppPage>
  </div>
</template>
