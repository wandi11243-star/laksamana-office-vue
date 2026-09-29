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

// --- Denah (Tahap 2): the table plan, on invented rows, no API --------------
// A fixed date and time so the example always shows the same thing: one guest
// sitting, one booking about to start, one far away, one free but booked, one
// shared, one no-show.
const DENAH_HARI_INI = '2026-09-29'

const res = (o: Partial<Reservasi> & { id: string, name: string, table: string }): Reservasi => ({
  phone: '6281234567890',
  date: DENAH_HARI_INI,
  time: '19:00',
  pax: 2,
  dpStatus: 'Belum',
  dpMethod: '',
  dpAmount: 0,
  status: 'Confirmed',
  arrivals: [],
  dps: [],
  ...o,
} as Reservasi)

const barisDenah: Reservasi[] = [
  res({ id: 'a', name: 'Dimas Pratama', table: '12', time: '18:30', pax: 6, status: 'Datang', checkinAt: new Date(`${DENAH_HARI_INI}T18:40:00`).getTime(), actualPax: 4, arrivals: [{ pax: 4 }] }),
  res({ id: 'b', name: 'Rani Andriani', table: '12', time: '23:00', pax: 2, status: 'Pending' }),
  res({ id: 'c', name: 'Budi Santoso', table: 'R3', time: '20:00', pax: 8, status: 'Confirmed' }),
  res({ id: 'd', name: 'Sari Wijaya', table: 'VIP 2', time: '21:30', pax: 4, status: 'Confirmed' }),
  res({ id: 'e', name: 'Eka &Friends', table: '5, 6', time: '20:00', pax: 8, status: 'Confirmed', sharing: true }),
  res({ id: 'f', name: 'Tomi', table: '21', time: '14:00', pax: 2, status: 'No-show' }),
]

const denahHariIni = computed(() => getLayout(undefined, dayTypeLayoutLt(undefined, DENAH_HARI_INI, 1))!)
const denahLantai2 = computed(() => getLayout(undefined, 'lantai2')!)

const modeDenah = ref<'tampil' | 'pilih'>('tampil')
const lapisDenah = ref<1 | 2>(1)
const terpilihDenah = ref<string[]>(['5'])
const pesanTumpang = ref('')
const edgyTumpang = ref<{ kunci: boolean } | null>(null)
const tumpangSheet = ref(false)

const denah = computed(() => (lapisDenah.value === 1 ? denahHariIni.value : denahLantai2.value))

// The editor's copy, so "save" can show what would be written without writing it.
const salinanDenah = ref(denahHariIni.value)
watch(denahHariIni, l => (salinanDenah.value = structuredClone(toRaw(l))))
const hasilSimpan = ref('')

function onTumpang(p: { meja: string, pesan: string, kunci: boolean }) {
  pesanTumpang.value = p.pesan
  edgyTumpang.value = { kunci: p.kunci }
  tumpangSheet.value = true
}

function onPilih(meja: string) {
  terpilihDenah.value = terpilihDenah.value.includes(meja)
    ? terpilihDenah.value.filter(m => m !== meja)
    : [...terpilihDenah.value, meja]
}

const contohRingkas = computed(() => {
  const m = harihOccupancy(barisDenah, { date: DENAH_HARI_INI, hariIni: true })
  return {
    terisi: [...m.occ.keys()].sort(),
    dipesan: [...m.later.keys()].sort(),
    kapasitas: kapasitasTanggal(undefined, DENAH_HARI_INI),
    denah: dayTypeLayoutLt(undefined, DENAH_HARI_INI, 1),
    l2: dayTypeLayoutLt(undefined, DENAH_HARI_INI, 2),
  }
})

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

      <AppList title="Denah · mode tampil (peta hari ini)">
        <div class="space-y-3 p-4">
          <p class="text-sm text-muted">
            Satu komponen untuk denah hari ini dan untuk memilih meja di form. Isinya warna
            <b>zona</b> (biru/hi hijau/kayu/VIP/gelap/diamond/extension) — itulah yang kru sebut di
            lapangan — dan statusnya berupa titik + kata, sesuai DESIGN.md. Data di sini tiruan; tidak
            ada panggilan API.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="m in (['tampil', 'pilih'] as const)"
              :key="m"
              :label="m === 'tampil' ? 'Mode tampil' : 'Mode pilih'"
              color="neutral"
              :variant="modeDenah === m ? 'soft' : 'ghost'"
              @click="modeDenah = m"
            />
            <UButton
              v-for="l in ([1, 2] as const)"
              :key="l"
              :label="`Lantai ${l}`"
              color="neutral"
              :variant="lapisDenah === l ? 'soft' : 'ghost'"
              @click="lapisDenah = l"
            />
          </div>
          <p class="text-sm text-muted">
            Terpilih: <b>{{ terpilihDenah.join(', ') || '—' }}</b>
          </p>
        </div>
        <div class="px-4 pb-4">
          <DenahPeta
            :layout="denah"
            :reservasi="barisDenah"
            :tanggal="DENAH_HARI_INI"
            :jam="modeDenah === 'pilih' ? '20:00' : undefined"
            :mode="modeDenah"
            :terpilih="terpilihDenah"
            :hari-ini="true"
            :timer="modeDenah === 'tampil'"
            :nunggu="2"
            @pilih="onPilih"
            @buka="(id) => toast.add({ title: 'Klik meja', description: `Booking ${id} — di layar nyata ini membuka detail reservasi.` })"
            @tumpang="onTumpang"
          />
        </div>
      </AppList>

      <ResponsiveSheet
        v-model:open="tumpangSheet"
        :title="edgyTumpang?.kunci ? 'Meja terkunci' : 'Meja sudah dipesan'"
        description="Di form yang asli, pesan ini berasal dari periksaTumpang() dan jawabannya decides izin tumpang"
      >
        <p class="text-sm text-default whitespace-pre-line">
          {{ pesanTumpang }}
        </p>
        <template #footer>
          <UButton
            v-if="!edgyTumpang?.kunci"
            label="Tetap pakai meja"
            size="xl"
            @click="tumpangSheet = false"
          />
          <UButton
            label="Tutup"
            color="neutral"
            variant="soft"
            size="xl"
            @click="tumpangSheet = false"
          />
        </template>
      </ResponsiveSheet>

      <AppList title="Denah · Editor (tidak memanggil API)">
        <div class="space-y-3 p-4">
          <p class="text-sm text-muted">
            Geser, tambah, hapus, ubah nama/kapasitas/zona/ukuran. Di HP editor ini read-only
            dengan alasannya — denah yang tidak sengaja bergeser dari jari lebih buruk daripada tidak
            bisa diedit. Tombol simpan hanya mengembalikan isi ke pemanggil; menulis ke
            <code class="text-default">PUT /master/layouts</code> atau
            <code class="text-default">/master/layoutTanggal</code> tetap tugas layar.
          </p>
          <p
            v-if="hasilSimpan"
            class="text-sm text-muted"
          >
            {{ hasilSimpan }}
          </p>
        </div>
        <div class="px-4 pb-4">
          <DenahEditor
            :layout="salinanDenah"
            :jejak="jejakDenah({ ...salinanDenah, _editBy: 'Andry', _editAt: new Date(`${DENAH_HARI_INI}T14:05:00`).getTime() })"
            @simpan-templat="(d) => toast.add({ title: 'Akan dikirim ke /master/layouts', description: `${d.name} · ${d.tables.length} meja · total ${kapasitasLayout(d)} pax. Tulisannya belum dikirim ke server.` })"
            @simpan-tanggal="(d) => toast.add({ title: `Akan dikirim ke /master/layoutTanggal (${keyTanggal(DENAH_HARI_INI, 1)})`, description: `${d.name}. Template tidak ikut berubah.` })"
          />
        </div>
      </AppList>

      <AppList title="Denah · rumus denah & kunci meja">
        <div class="px-4 pt-4 text-sm text-muted">
          Dihitung dari baris tiruan di atas, tanpa jaringan.
        </div>
        <AppListRow
          title="Denah Lt.1 hari ini (Senin → Weekday)"
          :description="`dayTypeLayoutLt() = ${contohRingkas.denah}`"
        />
        <AppListRow
          title="Denah Lt.2 hari ini"
          :description="`dayTypeLayoutLt() = ${contohRingkas.l2}`"
        />
        <AppListRow
          title="Kapasitas venue"
          :description="`kapasitasTanggal() = ${contohRingkas.kapasitas.meja} meja, ${contohRingkas.kapasitas.pax} pax`"
        />
        <AppListRow
          title="Meja yang sedang terisi"
          :description="`harihOccupancy().occ = ${contohRingkas.terisi.join(', ') || '—'}`"
        />
        <AppListRow
          title="Meja kosong tapi sudah dipesan"
          :description="`harihOccupancy().later = ${contohRingkas.dipesan.join(', ') || '—'}`"
        />
        <AppListRow
          title="Bentrok ketat vs walk-in"
          :description="`conflictCheck() ketat jam 20:00 → ${conflictCheck(barisDenah, { date: DENAH_HARI_INI, table: '12', time: '20:00' })?.name ?? 'bebas'} · walk-in jam 20:00 → ${conflictCheck(barisDenah, { date: DENAH_HARI_INI, table: '12', time: '20:00', loose: true })?.name ?? 'bebas'}`"
        />
        <AppListRow
          title="Ambang"
          :description="`LOCK_LEAD_MIN = ${LOCK_LEAD_MIN} · MEPET_MIN = ${MEPET_MIN} · TUMPANG_MEPET_MIN = ${TUMPANG_MEPET_MIN}`"
        />
      </AppList>
    </AppPage>
  </div>
</template>
