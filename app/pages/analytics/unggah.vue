<!--
  Analytics › Unggah Laporan. One box for the POS Sales Recapitulation
  (.xlsx/.csv): parsed IN THE BROWSER, only the summary is sent to the
  server (deploy/analytics/index.html:6438-6600, vUnggah/pratinjauUnggah).
  Preview carries the multi-month, overwrite, bill-less and menu-less
  warnings; an unsaved parse asks before it is lost (go(), :7989-7998 and
  beforeunload, :8359-8362). Saved months list below with per-month delete.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { cariBarisKepala, deteksiJenisBerkas } from '~/utils/analytics-pos'
import { uraiLaporanPos, type HasilUraiPos } from '~/utils/analytics-agregat'
import { laporanDariHasil, saveAnalytics, useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { BLN, angka, hariIni, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const me = useMe()
const toast = useToast()
const izin = useAnalyticsIzin()
const bolehUbah = computed(() => izin.ubah('unggah'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const laporan = computed(() => isi.value?.data.laporan ?? {})
const versi = computed(() => versiDari(balasan.value))

const membaca = ref(false)
const namaBerkas = ref('')
const galat = ref('')
const segera = ref<null | 'promo' | 'void'>(null)
const hasil = ref<(HasilUraiPos & { diunggah: string, oleh: string }) | null>(null)

/** '2026-08' -> 'Ags 2026'. */
const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}
const jenisLabel = (j: string) => j === 'menu' ? 'Menu / Detail' : 'Bill'

async function pilihBerkas(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (!bolehUbah.value) {
    toast.add({ title: 'Tidak bisa mengunggah', description: `Hak akses kamu di halaman "Unggah Laporan" cuma "${roleSaya.value}". Minta admin modul mengubahnya di Kelola Akses.`, color: 'error' })
    return
  }
  membaca.value = true
  galat.value = ''
  segera.value = null
  hasil.value = null
  namaBerkas.value = f.name
  try {
    const baris = await bacaBerkasTabel(f)
    const iH = cariBarisKepala(baris)
    if (iH < 0) throw new Error('Baris kepala kolom tidak ketemu. Pastikan berkasnya hasil ekspor POS, bukan berkas yang sudah disunting.')
    const jenis = deteksiJenisBerkas(baris[iH] ?? {})
    if (jenis !== 'pos') {
      segera.value = jenis
      return
    }
    const u = uraiLaporanPos(baris, f.name)
    hasil.value = { ...u, diunggah: hariIni(), oleh: me.value?.name ?? '' }
  }
  catch (err) {
    galat.value = (err as Error)?.message || 'penyebab tidak diketahui'
  }
  finally {
    membaca.value = false
  }
}

function batal() {
  hasil.value = null
  segera.value = null
  galat.value = ''
}

const adaLama = computed(() => !!hasil.value && !!laporan.value[hasil.value.bulan])

async function simpan() {
  const u = hasil.value
  if (!u || !isi.value) return
  if (!bolehUbah.value) {
    toast.add({ title: 'Tidak bisa dilakukan', description: `Hak akses kamu di halaman "Unggah Laporan" cuma "${roleSaya.value}". Minta admin modul mengubahnya di Kelola Akses.`, color: 'error' })
    return
  }
  const lama = laporan.value[u.bulan]
  if (lama && !confirm(`Ringkasan ${fmtBln(u.bulan)} sudah ada dan akan DITIMPA.\n\nYang sekarang: ${angka(lama.ringkas?.bill)} bill.\nYang baru   : ${angka(u.ringkas.bill)} bill.\n\nLanjut?`)) return
  const v = versi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu angka tersimpan dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  const data = {
    ...isi.value.data,
    laporan: { ...laporan.value, [u.bulan]: { ...laporanDariHasil(u), diunggah: u.diunggah, oleh: u.oleh } },
  }
  try {
    await saveAnalytics(data, v)
    hasil.value = null
    await refresh()
    toast.add({ title: `Ringkasan ${fmtBln(u.bulan)} tersimpan.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function hapus(bulan: string) {
  if (!bolehUbah.value || !isi.value) return
  if (!confirm(`Hapus ringkasan ${fmtBln(bulan)}?\n\nBerkas aslinya tidak ikut terhapus — bisa diunggah lagi kapan saja.`)) return
  const v = versi.value
  if (v === undefined) return
  const sisa: Record<string, LaporanBulan> = {}
  for (const k of Object.keys(laporan.value)) {
    if (k !== bulan) sisa[k] = laporan.value[k]!
  }
  try {
    await saveAnalytics({ ...isi.value.data, laporan: sisa }, v)
    await refresh()
    toast.add({ title: 'Dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// An unsaved parse lives in the browser only. Leaving the page (or closing
// the tab) drops it — ask first, like the old go() + beforeunload pair.
onBeforeRouteLeave(() => {
  if (hasil.value && !confirm('Hasil urai berkas belum disimpan dan akan hilang. Lanjut?')) return false
  return true
})
if (import.meta.client) {
  const sebelumTutup = (e: BeforeUnloadEvent) => {
    if (hasil.value) e.preventDefault()
  }
  onMounted(() => window.addEventListener('beforeunload', sebelumTutup))
  onUnmounted(() => window.removeEventListener('beforeunload', sebelumTutup))
}

interface BarisRiwayat { bulan: string, jenis: string, hari: number, bill: number, menu: number, total: number }
const riwayat = computed<BarisRiwayat[]>(() => Object.keys(laporan.value).sort().reverse().map(b => ({
  bulan: b,
  jenis: jenisLabel(laporan.value[b]?.jenis ?? ''),
  hari: Object.keys(laporan.value[b]?.hari ?? {}).length,
  bill: laporan.value[b]?.ringkas?.bill ?? 0,
  menu: Object.keys(laporan.value[b]?.menu ?? {}).length,
  total: laporan.value[b]?.ringkas?.grand ?? 0,
})))
const kolom: TableColumn<BarisRiwayat>[] = [
  { accessorKey: 'bulan', header: 'Bulan' },
  { accessorKey: 'jenis', header: 'Jenis' },
  { accessorKey: 'hari', header: 'Hari' },
  { accessorKey: 'bill', header: 'Bill' },
  { accessorKey: 'menu', header: 'Menu' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'actions', header: '' },
]
</script>

<template>
  <AppPage
    title="Unggah Laporan"
    description="Berkas Sales Recapitulation dari POS"
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

    <AppPanel
      v-if="status === 'pending' && !isi"
      title="Memuat laporan tersimpan"
    >
      <p class="text-sm text-muted">
        Mengambil data dari Laksamana Office…
      </p>
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !isi">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tidak bisa membaca data analytics"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
      <UButton
        label="Muat ulang"
        color="error"
        variant="soft"
        class="mt-3"
        @click="() => refresh()"
      />
    </div>

    <template v-else>
      <UAlert
        v-if="!bolehUbah"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        title="Hanya membaca"
        :description="`Hak akses kamu di halaman ini cuma &quot;${roleSaya}&quot;. Mengunggah dan menghapus bisa dilakukan pemegang peran Staf — minta admin modul mengubahnya di Kelola Akses.`"
      />

      <AppPanel
        title="Unggah Laporan POS"
        icon="i-lucide-upload"
        description="Berkas .xlsx atau .csv hasil ekspor POS — Sales Recapitulation (omset, menu, jam). Diurai di peramban ini — yang dikirim ke server cuma ringkasannya, bukan barisnya."
      >
        <label
          class="flex cursor-pointer items-start gap-3 rounded-field border-2 border-dashed border-default p-3 hover:border-primary-400"
          :class="!bolehUbah && 'pointer-events-none opacity-50'"
        >
          <UIcon
            name="i-lucide-folder-open"
            class="size-7 shrink-0 text-primary-700"
          />
          <span>
            <b>Pilih berkas laporan POS</b>
            <span class="mt-0.5 block text-muted">
              Kolom dicari menurut namanya, bukan posisinya — urutan kolom boleh beda antar versi POS.
            </span>
          </span>
          <input
            type="file"
            accept=".xlsx,.csv"
            class="sr-only"
            @change="pilihBerkas"
          >
        </label>
        <p
          v-if="membaca"
          class="mt-2 text-sm text-muted"
        >
          Membaca {{ namaBerkas }}…
        </p>
        <p
          v-if="galat"
          class="mt-2 rounded-field bg-error/12 px-3 py-2 text-sm text-error"
        >
          Gagal membaca berkasnya: {{ galat }}
        </p>
        <UAlert
          v-if="segera"
          class="mt-3"
          color="info"
          variant="subtle"
          icon="i-lucide-hourglass"
          title="Segera"
          :description="segera === 'promo'
            ? `Berkas ${namaBerkas} dikenali sebagai Promotion Report. Penguraiannya menyusul bersama layar Promo & Klaim di L2 — ringkasan penjualan di bawah tidak tersentuh.`
            : `Berkas ${namaBerkas} dikenali sebagai berkas Cancel/Void. Penguraiannya menyusul bersama layar Void & Cancel di L2 — halaman itu membaca /voids milik Kompas.`"
        />
      </AppPanel>

      <AppPanel
        v-if="hasil"
        title="Pratinjau hasil urai"
        icon="i-lucide-clipboard-check"
        :description="`Dari ${hasil.berkas} — periksa dulu, baru simpan.`"
      >
        <AppStatGrid>
          <AppStat
            label="Bulan"
            :value="fmtBln(hasil.bulan)"
            icon="i-lucide-calendar-days"
            tone="gold"
            :sub="`${hasil.tglAwal ? tglPanjang(hasil.tglAwal) : '—'} — ${hasil.tglAkhir ? tglPanjang(hasil.tglAkhir) : '—'}`"
          />
          <AppStat
            label="Bill"
            :value="angka(hasil.ringkas.bill)"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`${jenisLabel(hasil.jenis)} · ${angka(Object.keys(hasil.hari).length)} hari`"
          />
          <AppStat
            label="Total"
            :value="rupiah(hasil.ringkas.grand)"
            icon="i-lucide-banknote"
            tone="success"
            :sub="`${angka(hasil.nBaris)} baris terbaca${hasil.nLewat ? ` · ${angka(hasil.nLewat)} baris tanpa tanggal dilewati` : ''}`"
          />
        </AppStatGrid>

        <div class="mt-3 space-y-2.5">
          <UAlert
            v-if="hasil.blnLain.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Berkasnya memuat lebih dari satu bulan"
            :description="`${hasil.blnLain.map(x => `${fmtBln(x.b)} (${angka(x.n)} baris)`).join(', ')}. Yang disimpan cuma ${fmtBln(hasil.bulan)} — bulan yang barisnya paling banyak. Ekspor per bulan supaya tidak ada yang tertinggal.`"
          />
          <UAlert
            v-if="adaLama"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Bulan ini sudah ada"
            :description="`${fmtBln(hasil.bulan)} sudah tersimpan (${angka(laporan[hasil.bulan]?.ringkas?.bill)} bill). Menyimpan akan menimpanya.`"
          />
          <UAlert
            v-if="hasil.billDariBaris"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Berkasnya tidak punya kolom nomor bill"
            description="&quot;Jumlah bill&quot; di atas sebenarnya jumlah baris menu — satu bill berisi lima menu terhitung lima. Nilai omsetnya tetap benar; yang tidak bisa dipercaya cuma jumlah bill dan rata-rata per bill. Ekspor ulang dengan kolom Bill Number kalau kedua angka itu diperlukan."
          />
          <UAlert
            v-if="hasil.jenis === 'bill'"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="Ini Bill Report"
            description="Tidak berisi nama menu, jadi halaman Menu & Bahan Baku tetap kosong untuk bulan ini."
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            :label="`Simpan ke ${fmtBln(hasil.bulan)}`"
            icon="i-lucide-check"
            @click="simpan()"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            @click="batal()"
          />
        </div>
      </AppPanel>

      <AppPanel
        title="Laporan Tersimpan"
        icon="i-lucide-archive"
        :count="riwayat.length"
        flush
      >
        <div
          v-if="!riwayat.length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada laporan yang diunggah. Pilih berkas POS di atas — ringkasannya tersimpan per bulan.
        </div>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="riwayat"
            :columns="kolom"
          >
            <template #bulan-cell="{ row }">
              <b class="text-highlighted">{{ fmtBln(row.original.bulan) }}</b>
            </template>
            <template #jenis-cell="{ row }">
              <span class="text-muted">{{ row.original.jenis }}</span>
            </template>
            <template #hari-cell="{ row }">
              <span class="num">{{ angka(row.original.hari) }}</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #menu-cell="{ row }">
              <span class="num">{{ angka(row.original.menu) }}</span>
            </template>
            <template #total-cell="{ row }">
              <span class="num">{{ rupiah(row.original.total) }}</span>
            </template>
            <template #actions-cell="{ row }">
              <UButton
                v-if="bolehUbah"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :title="`Hapus ringkasan ${fmtBln(row.original.bulan)}`"
                @click="hapus(row.original.bulan)"
              />
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="r in riwayat"
              :key="r.bulan"
              class="flex items-start gap-3 p-4"
            >
              <div class="min-w-0 flex-1">
                <b class="block text-highlighted">{{ fmtBln(r.bulan) }}</b>
                <span class="block text-xs text-muted">{{ r.jenis }} · {{ angka(r.hari) }} hari · {{ angka(r.bill) }} bill · {{ angka(r.menu) }} menu</span>
                <span class="num mt-0.5 block text-sm font-semibold">{{ rupiah(r.total) }}</span>
              </div>
              <UButton
                v-if="bolehUbah"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :title="`Hapus ringkasan ${fmtBln(r.bulan)}`"
                @click="hapus(r.bulan)"
              />
            </div>
          </div>
        </template>
      </AppPanel>
    </template>
  </AppPage>
</template>
