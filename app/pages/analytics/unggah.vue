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
import { uraiLaporanPos, uraiLaporanPromo, uraiLaporanVoid, type HasilUraiPos, type HasilUraiPromo, type HasilUraiVoid } from '~/utils/analytics-agregat'
import { laporanDariHasil, promoDariHasil, voidDariHasil, saveAnalytics, useAnalyticsState, type LaporanBulan, type PromoBulan, type VoidBulan } from '~/composables/useAnalytics'
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
const hasil = ref<(HasilUraiPos & { diunggah: string, oleh: string }) | null>(null)
const hasilPromo = ref<(HasilUraiPromo & { diunggah: string, oleh: string }) | null>(null)
const hasilVoid = ref<(HasilUraiVoid & { diunggah: string, oleh: string }) | null>(null)
/** A parse result lives in the browser until it is saved. */
const adaHasil = computed(() => !!(hasil.value || hasilPromo.value || hasilVoid.value))

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
  hasil.value = null
  hasilPromo.value = null
  hasilVoid.value = null
  namaBerkas.value = f.name
  try {
    const baris = await bacaBerkasTabel(f)
    const iH = cariBarisKepala(baris)
    if (iH < 0) throw new Error('Baris kepala kolom tidak ketemu. Pastikan berkasnya hasil ekspor POS, bukan berkas yang sudah disunting.')
    // One box for all three reports: the kind is read from the COLUMNS,
    // never from the file name (a name is typed by a person).
    const jenis = deteksiJenisBerkas(baris[iH] ?? {})
    const oleh = me.value?.name ?? ''
    if (jenis === 'promo') {
      hasilPromo.value = { ...uraiLaporanPromo(baris, f.name), diunggah: hariIni(), oleh }
      return
    }
    if (jenis === 'void') {
      hasilVoid.value = { ...uraiLaporanVoid(baris, f.name), diunggah: hariIni(), oleh }
      return
    }
    const u = uraiLaporanPos(baris, f.name)
    hasil.value = { ...u, diunggah: hariIni(), oleh }
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
  hasilPromo.value = null
  hasilVoid.value = null
  galat.value = ''
}

const adaLama = computed(() => !!hasil.value && !!laporan.value[hasil.value.bulan])
const promoTersimpan = computed(() => isi.value?.data.promo ?? {})
const voidTersimpan = computed(() => isi.value?.data.voidb ?? {})
const adaLamaPromo = computed(() => !!hasilPromo.value && !!promoTersimpan.value[hasilPromo.value.bulan])
const adaLamaVoid = computed(() => !!hasilVoid.value && !!voidTersimpan.value[hasilVoid.value.bulan])

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

async function simpanPromo() {
  const u = hasilPromo.value
  if (!u || !isi.value) return
  if (!bolehUbah.value) {
    toast.add({ title: 'Tidak bisa dilakukan', description: `Hak akses kamu di halaman "Unggah Laporan" cuma "${roleSaya.value}". Minta admin modul mengubahnya di Kelola Akses.`, color: 'error' })
    return
  }
  const lama = promoTersimpan.value[u.bulan]
  if (lama && !confirm(`Laporan promo ${fmtBln(u.bulan)} sudah ada dan akan DITIMPA.\n\nYang sekarang: ${angka(lama.ringkas?.bill)} transaksi.\nYang baru   : ${angka(u.ringkas.bill)} transaksi.\n\nLanjut?`)) return
  const v = versi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu angka tersimpan dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  try {
    await saveAnalytics({
      ...isi.value.data,
      promo: { ...promoTersimpan.value, [u.bulan]: { ...promoDariHasil(u), diunggah: u.diunggah, oleh: u.oleh } },
    }, v)
    hasilPromo.value = null
    await refresh()
    toast.add({ title: `Laporan promo ${fmtBln(u.bulan)} tersimpan.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function simpanVoid() {
  const u = hasilVoid.value
  if (!u || !isi.value) return
  if (!bolehUbah.value) {
    toast.add({ title: 'Tidak bisa dilakukan', description: `Hak akses kamu di halaman "Unggah Laporan" cuma "${roleSaya.value}". Minta admin modul mengubahnya di Kelola Akses.`, color: 'error' })
    return
  }
  const lama = voidTersimpan.value[u.bulan]
  if (lama && !confirm(`Laporan Void/Cancel ${fmtBln(u.bulan)} sudah ada dan akan DITIMPA.\n\nYang sekarang: ${angka(lama.ringkas?.nBaris)} baris.\nYang baru   : ${angka(u.ringkas.nBaris)} baris.\n\nLanjut?`)) return
  const v = versi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu angka tersimpan dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  try {
    await saveAnalytics({
      ...isi.value.data,
      voidb: { ...voidTersimpan.value, [u.bulan]: { ...voidDariHasil(u), diunggah: u.diunggah, oleh: u.oleh } },
    }, v)
    hasilVoid.value = null
    await refresh()
    toast.add({ title: `Laporan Void/Cancel ${fmtBln(u.bulan)} tersimpan.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function hapusPromo(bulan: string) {
  if (!bolehUbah.value || !isi.value) return
  if (!confirm(`Hapus laporan promo ${fmtBln(bulan)}?\n\nBerkas aslinya tidak ikut terhapus — bisa diunggah lagi kapan saja.`)) return
  const v = versi.value
  if (v === undefined) return
  const sisa: Record<string, PromoBulan> = {}
  for (const k of Object.keys(promoTersimpan.value)) {
    if (k !== bulan) sisa[k] = promoTersimpan.value[k]!
  }
  try {
    await saveAnalytics({ ...isi.value.data, promo: sisa }, v)
    await refresh()
    toast.add({ title: 'Dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function hapusVoid(bulan: string) {
  if (!bolehUbah.value || !isi.value) return
  if (!confirm(`Hapus laporan Void/Cancel ${fmtBln(bulan)}?\n\nBerkas aslinya tidak ikut terhapus — bisa diunggah lagi kapan saja.`)) return
  const v = versi.value
  if (v === undefined) return
  const sisa: Record<string, VoidBulan> = {}
  for (const k of Object.keys(voidTersimpan.value)) {
    if (k !== bulan) sisa[k] = voidTersimpan.value[k]!
  }
  try {
    await saveAnalytics({ ...isi.value.data, voidb: sisa }, v)
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
  if (adaHasil.value && !confirm('Hasil urai berkas belum disimpan dan akan hilang. Lanjut?')) return false
  return true
})
if (import.meta.client) {
  const sebelumTutup = (e: BeforeUnloadEvent) => {
    if (adaHasil.value) e.preventDefault()
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
          class="relative flex cursor-pointer items-start gap-3 rounded-panel border-2 border-dashed border-default p-3 hover:border-primary-400"
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
          v-if="hasilPromo"
          class="mt-3"
          color="info"
          variant="subtle"
          icon="i-lucide-badge-percent"
          title="Promotion Report dikenali"
          :description="`Berkas ${namaBerkas} berisi laporan promo — ringkasannya tersimpan terpisah dan tidak menyentuh ringkasan penjualan.`"
        />
        <UAlert
          v-if="hasilVoid"
          class="mt-3"
          color="info"
          variant="subtle"
          icon="i-lucide-ban"
          title="Berkas Cancel/Void dikenali"
          :description="`Berkas ${namaBerkas} berisi laporan pembatalan — ringkasannya tersimpan terpisah dan tidak menyentuh ringkasan penjualan.`"
        />
      </AppPanel>

      <!-- kartuSinkronEsb() after the upload card (vUnggah, :6663) -->
      <AnalyticsEsbSinkron />

      <AppPanel
        v-if="hasilPromo"
        title="Pratinjau laporan promo"
        icon="i-lucide-badge-percent"
        :description="`Dari ${hasilPromo.berkas} — periksa dulu, baru simpan.`"
      >
        <AppStatGrid>
          <AppStat
            label="Bulan"
            :value="fmtBln(hasilPromo.bulan)"
            icon="i-lucide-calendar-days"
            tone="gold"
            :sub="`${hasilPromo.tglAwal ? tglPanjang(hasilPromo.tglAwal) : '—'} — ${hasilPromo.tglAkhir ? tglPanjang(hasilPromo.tglAkhir) : '—'}`"
          />
          <AppStat
            label="Transaksi berpromo"
            :value="angka(hasilPromo.ringkas.bill)"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`${angka(hasilPromo.ringkas.promoBeda)} promo · ${angka(hasilPromo.ringkas.baris)} baris`"
          />
          <AppStat
            label="Nilai promo"
            :value="rupiah(hasilPromo.ringkas.nilai)"
            icon="i-lucide-banknote"
            tone="success"
            :sub="`diskon ${rupiah(hasilPromo.ringkas.nilaiDisc)} + dilepas ${rupiah(hasilPromo.ringkas.nilaiGratis)}`"
          />
        </AppStatGrid>

        <div class="mt-3 space-y-2.5">
          <UAlert
            v-if="hasilPromo.blnLain.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Berkasnya memuat lebih dari satu bulan"
            :description="`${hasilPromo.blnLain.map(x => `${fmtBln(x.b)} (${angka(x.n)} baris)`).join(', ')}. Yang disimpan cuma ${fmtBln(hasilPromo.bulan)} — bulan yang barisnya paling banyak.`"
          />
          <UAlert
            v-if="adaLamaPromo"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Bulan ini sudah ada"
            :description="`${fmtBln(hasilPromo.bulan)} sudah tersimpan (${angka(promoTersimpan[hasilPromo.bulan]?.ringkas?.bill)} transaksi). Menyimpan akan menimpanya.`"
          />
          <UAlert
            v-if="hasilPromo.ringkas.jamGelap"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Sebagian klaim tidak terbaca jamnya"
            :description="`${angka(hasilPromo.ringkas.jamGelap)} baris jamnya tidak bisa diturunkan dari nomor bill dan tidak ikut di tabel jam halaman Promo.`"
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            :label="`Simpan ke ${fmtBln(hasilPromo.bulan)}`"
            icon="i-lucide-check"
            loading-auto
            @click="simpanPromo()"
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
        v-if="hasilVoid"
        title="Pratinjau laporan Void/Cancel"
        icon="i-lucide-ban"
        :description="`Dari ${hasilVoid.berkas} — periksa dulu, baru simpan.`"
      >
        <AppStatGrid>
          <AppStat
            label="Bulan"
            :value="fmtBln(hasilVoid.bulan)"
            icon="i-lucide-calendar-days"
            tone="gold"
            :sub="`${angka(hasilVoid.baris.length)} baris item terbaca`"
          />
          <AppStat
            label="Bill tersentuh"
            :value="angka(hasilVoid.ringkas.nBill)"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`satu bill bisa membawa belasan baris item`"
          />
          <AppStat
            label="Nilai dibatalkan"
            :value="rupiah(hasilVoid.ringkas.total)"
            icon="i-lucide-banknote"
            tone="success"
            :sub="`${angka(hasilVoid.ringkas.qty)} item dibatalkan`"
          />
        </AppStatGrid>

        <div class="mt-3 space-y-2.5">
          <UAlert
            v-if="hasilVoid.blnLain.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Berkasnya memuat lebih dari satu bulan"
            :description="`${hasilVoid.blnLain.map(x => `${fmtBln(x.b)} (${angka(x.n)} baris)`).join(', ')}. Yang disimpan cuma ${fmtBln(hasilVoid.bulan)} — bulan yang barisnya paling banyak.`"
          />
          <UAlert
            v-if="adaLamaVoid"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Bulan ini sudah ada"
            :description="`${fmtBln(hasilVoid.bulan)} sudah tersimpan (${angka(voidTersimpan[hasilVoid.bulan]?.ringkas?.nBaris)} baris). Menyimpan akan menimpanya.`"
          />
          <UAlert
            v-if="hasilVoid.ringkas.takTerbaca"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Sebagian baris waktunya tidak terbaca"
            :description="`${angka(hasilVoid.ringkas.takTerbaca)} baris dilewati dan tidak ikut tersimpan.`"
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            :label="`Simpan ke ${fmtBln(hasilVoid.bulan)}`"
            icon="i-lucide-check"
            loading-auto
            @click="simpanVoid()"
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
            loading-auto
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
                loading-auto
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
                loading-auto
                @click="hapus(r.bulan)"
              />
            </div>
          </div>
        </template>
      </AppPanel>
      <AppPanel
        title="Laporan Promo Tersimpan"
        icon="i-lucide-badge-percent"
        :count="Object.keys(promoTersimpan).length"
      >
        <div
          v-if="!Object.keys(promoTersimpan).length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada laporan promo yang diunggah. Pilih berkas Promotion Report di atas — jenisnya dikenali sendiri.
        </div>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="b in Object.keys(promoTersimpan).sort().reverse()"
            :key="b"
            class="flex items-start gap-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <b class="block text-highlighted">{{ fmtBln(b) }}</b>
              <span class="block text-xs text-muted">{{ angka(promoTersimpan[b]?.ringkas?.bill) }} transaksi · {{ angka(promoTersimpan[b]?.ringkas?.promoBeda) }} promo</span>
              <span class="num mt-0.5 block text-sm font-semibold">{{ rupiah(promoTersimpan[b]?.ringkas?.nilai) }}</span>
            </div>
            <UButton
              v-if="bolehUbah"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :title="`Hapus laporan promo ${fmtBln(b)}`"
              loading-auto
              @click="hapusPromo(b)"
            />
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Laporan Void/Cancel Tersimpan"
        icon="i-lucide-ban"
        :count="Object.keys(voidTersimpan).length"
      >
        <div
          v-if="!Object.keys(voidTersimpan).length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada laporan Void/Cancel yang diunggah. Pilih berkas Cancel Menu Detail Report di atas — jenisnya dikenali sendiri.
        </div>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="b in Object.keys(voidTersimpan).sort().reverse()"
            :key="b"
            class="flex items-start gap-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <b class="block text-highlighted">{{ fmtBln(b) }}</b>
              <span class="block text-xs text-muted">{{ angka(voidTersimpan[b]?.ringkas?.nBaris) }} baris · {{ angka(voidTersimpan[b]?.ringkas?.nBill) }} bill</span>
              <span class="num mt-0.5 block text-sm font-semibold">{{ rupiah(voidTersimpan[b]?.ringkas?.total) }}</span>
            </div>
            <UButton
              v-if="bolehUbah"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :title="`Hapus laporan Void/Cancel ${fmtBln(b)}`"
              loading-auto
              @click="hapusVoid(b)"
            />
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
