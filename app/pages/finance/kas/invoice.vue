<!--
  Finance › Kas Kecil › Invoice & Kwitansi (old `viewInvoice`, deploy/finance/kas/index.html:6633-6760).

  One request per reservation or marketing deal. A decision moves the SAME row
  from MENUNGGU to DIBUAT or DITOLAK — nothing is deleted, a number is never
  reused. Issuing warns louder when the DP money is not fully verified yet: a
  kwitansi is the company's acknowledgement that the money WAS received.
  Signatory images (`ttd`) are uploaded elsewhere; this screen writes
  name/title/order/active only and says so.
-->
<script setup lang="ts">
import type { InvoiceReq, Penanda } from '~/composables/useFinance'
import {
  berkasKwitansi, createPenanda, decideInvoice, deletePenanda, getInvoices, getInvoiceSettings, getPenanda,
  patchPenanda, putInvoiceSettings,
} from '~/composables/useFinance'
import { adaBuktiSheet, invoiceHalaman } from '~/utils/invoice-sheet'
import { kwitansiHtml } from '~/utils/kwitansi'
import { getFile, getReservation } from '~/composables/useReservasi'
import { buktiAdalahGambar, dpsTampilan } from '~/utils/dp-reservasi'
import { hariIni } from '~/utils/format'
import { useKasIzin } from '~/utils/layar/finance'
import { fmtRp } from '~/utils/cashier'
import { tanganiKonflik, type Versi } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()
const tab = ref<'antrean' | 'riwayat' | 'pengaturan'>('antrean')

const { data, error, refresh } = useAsyncData('kas-invoice', async () => {
  const [antre, riwayat, setting, penanda] = await Promise.all([
    getInvoices('MENUNGGU'),
    getInvoices(),
    getInvoiceSettings(),
    getPenanda(),
  ])
  return { antre, riwayat, setting, penanda }
})

const antre = computed(() => data.value?.antre.rows ?? [])
const riwayat = computed(() => (data.value?.riwayat.rows ?? []).filter(r => r.status !== 'MENUNGGU'))
const penanda = computed<Penanda[]>(() => data.value?.penanda.rows ?? [])
const setting = computed(() => data.value?.setting.setting ?? {})
const versiRiw = (id: string): Versi => data.value?.riwayat.versions[id] ?? data.value?.antre.versions[id] ?? ''
const namaJenis = (j?: string) => (j === 'KWITANSI' ? 'Kwitansi' : j === 'INV_DP' ? 'Invoice DP' : j === 'INV_LUNAS' ? 'Invoice Lunas' : (j || 'Kwitansi'))

const sibuk = ref(false)
async function jalankan(fn: () => Promise<unknown>, pesan: string, muat = true) {
  if (!izin.ubah('invoice') || sibuk.value) return
  sibuk.value = true
  try {
    await fn()
    toast.add({ title: pesan, color: 'success' })
    if (muat) await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// ---- Keputusan (buat / tolak / batal)
const putusOpen = ref(false)
const putusRow = ref<InvoiceReq | null>(null)
const putusAksi = ref<'buat' | 'tolak' | 'batal'>('buat')
const putusCatatan = ref('')
const putusPenanda = ref<string[]>([])
// Kwitansi: null = BELUM dijawab; Finance DITANYAI dulu, bukan diberi jawaban
// bawaan yang bisa terlewat dibaca. Invoice tidak memakai materai.
const putusMaterai = ref<boolean | undefined>(undefined)
const perluMaterai = (r: InvoiceReq | null) => r?.jenis === 'KWITANSI' && putusAksi.value === 'buat'
function bukaPutus(r: InvoiceReq, aksi: 'buat' | 'tolak' | 'batal') {
  putusRow.value = r
  putusAksi.value = aksi
  putusCatatan.value = ''
  putusMaterai.value = undefined
  // Two defaults, one per document kind (old invKunciBawaan): the Marketing invoice is
  // signed by Direktur + Finance, a Reservasi kwitansi by Finance. Never fall back to the
  // other list, and only ACTIVE signatories — an inactive one has no checkbox to untick.
  const kunci = isInvoice(r) ? 'penandaDefaultInvoice' : 'penandaDefault'
  const aktif = new Set(penanda.value.filter(x => x.aktif !== false).map(x => x.id))
  putusPenanda.value = String(setting.value[kunci] || '').split(',').map(s => s.trim()).filter(id => id && aktif.has(id))
  putusOpen.value = true
}
async function jalanPutus() {
  const r = putusRow.value
  if (!r) return
  if (putusAksi.value === 'tolak' && !putusCatatan.value.trim()) {
    toast.add({ title: 'Catatan penolakan wajib diisi.', color: 'error' })
    return
  }
  if (perluMaterai(r) && putusMaterai.value === undefined) {
    toast.add({ title: 'Pilih dulu apakah kwitansi ini perlu materai.', color: 'error' })
    return
  }
  await jalankan(
    () => decideInvoice(r.id, {
      aksi: putusAksi.value,
      catatan: putusCatatan.value.trim() || undefined,
      penanda: putusAksi.value === 'buat' ? putusPenanda.value : [],
      ...(perluMaterai(r) ? { materai: putusMaterai.value === true } : {}),
    }, versiRiw(r.id)),
    putusAksi.value === 'buat' ? `Kwitansi ${r.resId} diterbitkan.` : putusAksi.value === 'tolak' ? `Permintaan ${r.resId} ditolak.` : 'Penerbitan dibatalkan.',
  )
  putusOpen.value = false
}

const logoAbsolut = () => `${window.location.origin}/mark.png`

// ---- Lihat PDF: lembar yang diterbitkan, sama dengan yang dicetak peminta.
// Jendela dibuka SINKRON sebelum satu pun await — kalau sesudah, peramban
// memblokirnya sebagai popup dan yang terlihat cuma tidak terjadi apa-apa.
const pdfSibuk = ref('')
async function lihatPdf(r: InvoiceReq) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) {
    toast.add({ title: 'Popup diblokir', description: 'Izinkan popup untuk melihat PDF.', color: 'error' })
    return
  }
  pdfSibuk.value = r.id
  try {
    const b = (await berkasKwitansi(String(r.resId))).data
    if (!b) throw new Error('Dokumen ini belum berstatus terbit di server — segarkan halamannya.')
    const g = (r.ringkas ?? {}) as Record<string, unknown>
    const items = (Array.isArray(g.items) ? g.items : []) as { desc?: string, qty?: number, harga?: number }[]
    const bayar = (Array.isArray(g.bayar) ? g.bayar : []) as { jenis?: string, nominal?: number, tanggal?: string, metode?: string, adaBukti?: boolean }[]
    const u = (b.ubah ?? {}) as { kepada?: string, up?: string, ket?: { asal?: string, teks?: string }[] }
    let isi: string
    if (r.jenis === 'INV_DP' || r.jenis === 'INV_LUNAS') {
      const jenis = String(r.jenis)
      const lunas = jenis === 'INV_LUNAS'
      const totals: { label: string, nilai: number, tebal?: boolean }[] = [
        { label: 'Subtotal', nilai: Number(g.sub) || 0 },
      ]
      if (Number(g.disc)) totals.push({ label: 'Diskon', nilai: -(Number(g.disc) || 0) })
      if (Number(g.service)) totals.push({ label: 'Service charge', nilai: Number(g.service) || 0 })
      if (Number(g.tax)) totals.push({ label: `PB1${g.taxPct ? ` ${g.taxPct}%` : ''}`, nilai: Number(g.tax) || 0 })
      totals.push({ label: 'Grand Total', nilai: Number(g.grand) || 0, tebal: true })
      if (lunas) {
        let dpJml = 0
        for (const p of bayar.filter(p => String(p.jenis || '') === 'DP')) {
          dpJml += Number(p.nominal) || 0
          totals.push({ label: `Dikurangi pembayaran DP${p.tanggal ? ` · ${String(p.tanggal).slice(0, 10)}` : ''}`, nilai: -(Number(p.nominal) || 0) })
        }
        const sisaPra = (Number(g.praBayar) || 0) - dpJml
        if (sisaPra > 0) totals.push({ label: 'Dikurangi DP & pembayaran lain yang sudah diterima', nilai: -sisaPra })
        totals.push({ label: 'SISA PEMBAYARAN', nilai: Number(g.tagih) || 0, tebal: true })
      }
      else {
        totals.push({ label: 'DP yang ditagih', nilai: Number(g.tagih ?? g.dp) || 0, tebal: true })
        if (Number(g.paid) > 0) totals.push({ label: 'Sudah diterima', nilai: Number(g.paid) || 0 })
      }
      isi = invoiceHalaman({
        no: b.no, resmi: true, lunas,
        tanggalTerbit: hariIni(),
        kepada: String(u.kepada || '').trim() || String(g.perusahaan || g.client || ''),
        up: String(u.up || '').trim() || String(g.picClient || g.client || ''),
        acara: String(g.event || ''), tanggalAcara: String(g.tanggal || ''),
        jenisAcara: String(g.jenisAcara || ''), pax: String(g.pax ?? ''),
        items: items.map(it => ({ desc: String(it.desc || ''), qty: Number(it.qty) || 1, harga: Number(it.harga) || 0 })),
        ket: Array.isArray(u.ket) ? u.ket : [],
        totals,
        logo: logoAbsolut(),
        penanda: b.penanda, cap: adaBuktiSheet(bayar.map(p => ({ jenis: p.jenis, adaBukti: p.adaBukti })), jenis) ? (b.cap || '') : '',
        kaki: `Salinan Finance (data saat disetujui) · dilihat ${hariIni()}`,
      })
    }
    else {
      const dp = bayar
      isi = kwitansiHtml({
        no: b.no, resmi: true, lunas: !!g.lunas, nama: String(g.nama || g.client || ''),
        hp: '', metode: String(dp[0]?.metode || ''),
        tanggalTerbit: hariIni(),
        keterangan: String(r.resId || '').startsWith('vip-') ? 'Reservasi VIP' : 'Reservasi',
        subKeterangan: `${String(g.tanggal || '')}${g.jam ? ` · ${g.jam}` : ''}${g.meja ? ` · Meja ${g.meja}` : ''}`,
        pax: String(g.pax ?? ''), total: Number(g.dpTotal) || 0,
        penanda: (Array.isArray(b.penanda) && b.penanda.length) ? b.penanda : null,
        cap: b.cap || '', logo: logoAbsolut(), materai: !!b.materai,
      })
    }
    w.document.open()
    w.document.write(isi)
    w.document.close()
  }
  catch (e) {
    w.document.open()
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Gagal</title></head><body style="font:14px sans-serif;padding:40px"><b>Lembar gagal disiapkan</b><br>${apiErrorMessage(e)}</body></html>`)
    w.document.close()
  }
  finally {
    pdfSibuk.value = ''
  }
}
// ---- What Finance needs to see before deciding (old invRing / invSelNilai / invSelDana / invPenuh)
type Ring = Record<string, unknown>
interface BayarMkt { jenis?: string, nominal?: number, tanggal?: string, metode?: string, adaBukti?: boolean, no?: string, catatan?: string }
interface DpRes { nominal?: number, tanggal?: string, jam?: string, bank?: string, metode?: string, pengirim?: string, status?: string, adaBukti?: boolean, tanpaData?: string }
const ring = (r: InvoiceReq): Ring => ((r.ringkas && typeof r.ringkas === 'object') ? r.ringkas : {}) as Ring
const nilaiAngka = (v: unknown) => Number(v) || 0
const isInvoice = (r: InvoiceReq | null) => r?.jenis === 'INV_DP' || r?.jenis === 'INV_LUNAS'
const daftarBayar = (r: InvoiceReq) => (Array.isArray(ring(r).bayar) ? ring(r).bayar : []) as BayarMkt[]
const daftarDp = (r: InvoiceReq) => (Array.isArray(ring(r).dp) ? ring(r).dp : []) as DpRes[]
const daftarItem = (r: InvoiceReq) => (Array.isArray(ring(r).items) ? ring(r).items : []) as { desc?: string, qty?: number, harga?: number, total?: number }[]
/** Money already received BEFORE this sheet — pairs with `nilaiPokok` for a settlement invoice. */
const praBayar = (r: InvoiceReq) => (ring(r).praBayar != null ? nilaiAngka(ring(r).praBayar) : nilaiAngka(ring(r).paid))
/** The figure actually printed on the sheet (old invNilaiPokok). */
function nilaiPokok(r: InvoiceReq): number {
  const g = ring(r)
  if (r.jenis === 'INV_LUNAS') return g.tagih != null ? nilaiAngka(g.tagih) : nilaiAngka(g.remaining)
  if (r.jenis === 'INV_DP') return nilaiAngka(g.dp) || nilaiAngka(g.grand)
  return nilaiAngka(g.dpTotal)
}
/** Marketing: how many payments carry a transfer proof. Reservasi: how many DP are verified. */
function danaInfo(r: InvoiceReq): { ada: number, total: number, penuh: boolean, masuk: number, sisa: number } {
  const g = ring(r)
  if (isInvoice(r)) {
    const b = daftarBayar(r)
    const ada = b.filter(p => p.adaBukti).length
    return { ada, total: b.length, penuh: b.length > 0 && ada === b.length, masuk: nilaiAngka(g.paid), sisa: nilaiAngka(g.remaining) }
  }
  const total = nilaiAngka(g.dpCount)
  const ada = nilaiAngka(g.dpVerifiedCount)
  return { ada, total, penuh: total > 0 && ada >= total, masuk: nilaiAngka(g.dpVerified), sisa: 0 }
}
const namaDokumen = (r: InvoiceReq) => (isInvoice(r) ? String(ring(r).client || ring(r).nama || '(tanpa nama)') : String(ring(r).nama || '(tanpa nama)'))
const subDokumen = (r: InvoiceReq) => {
  const g = ring(r)
  const bagian = isInvoice(r)
    ? [g.event, g.tanggal, g.pax ? `${g.pax} pax` : '']
    : [g.tanggal, g.jam, g.pax ? `${g.pax} pax` : '', g.meja ? `meja ${g.meja}` : '']
  return bagian.filter(Boolean).join(' · ')
}
const waktu = (ms?: number) => (ms ? new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
/** The sentence shown above the Terbitkan button when the money is not fully proven yet. */
function peringatanDana(r: InvoiceReq | null): string {
  if (!r || danaInfo(r).penuh) return ''
  const d = danaInfo(r)
  return isInvoice(r)
    ? `Baru ${d.ada} dari ${d.total} pembayaran yang membawa bukti transfer di modul Marketing.`
    : `Baru ${d.ada} dari ${d.total} transfer yang terverifikasi di halaman Dana Masuk. Kwitansi yang terbit adalah pengakuan perusahaan bahwa uangnya sudah diterima.`
}
const bukaRincian = ref<string | null>(null)

// ---- Pengaturan
const setForm = reactive({ prefix: '', prefixInvoice: '', penandaDefault: '', penandaDefaultInvoice: '' })
watch(setting, () => {
  setForm.prefix = String(setting.value.prefix || '')
  setForm.prefixInvoice = String(setting.value.prefixInvoice || '')
  setForm.penandaDefault = String(setting.value.penandaDefault || '')
  setForm.penandaDefaultInvoice = String(setting.value.penandaDefaultInvoice || '')
}, { immediate: true })
function ubahBawaan(kunci: 'penandaDefault' | 'penandaDefaultInvoice', id: string, pilih: boolean) {
  const kini = setForm[kunci].split(',').map(x => x.trim()).filter(Boolean)
  setForm[kunci] = (pilih ? [...new Set([...kini, id])] : kini.filter(x => x !== id)).join(',')
}
const simpanSetting = () => jalankan(
  () => putInvoiceSettings({ ...setForm }, data.value?.setting.version ?? ''),
  'Pengaturan invoice disimpan.',
)

// ---- Gambar tanda tangan & cap (dibaca penuh hanya di tab Pengaturan)
const { data: gambar, refresh: muatGambar, execute: bukaGambar } = useAsyncData('kas-invoice-gambar', async () => {
  const [pen, set] = await Promise.all([getPenanda(false), getInvoiceSettings(false)])
  return { ttd: Object.fromEntries(pen.rows.map(x => [x.id, String(x.ttd || '')])), cap: String(set.setting.cap || '') }
}, { immediate: false })
watch(tab, (t) => {
  if (t === 'pengaturan' && !gambar.value) void bukaGambar()
}, { immediate: true })
const fotoPenanda = (id: string) => gambar.value?.ttd[id] || ''

/** Read an image file as a data URI. Signatures/stamps are tiny; a big file is refused up front (the host answers 413 as HTML otherwise). */
function bacaGambar(f: File): Promise<string> {
  return new Promise((ok, gagal) => {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return gagal(new Error('Pakai gambar PNG, JPG, atau WebP.'))
    if (f.size > 1_200_000) return gagal(new Error(`Gambar terlalu besar (${Math.round(f.size / 1024)} KB). Kecilkan dulu sampai di bawah 1 MB.`))
    const fr = new FileReader()
    fr.onload = () => ok(String(fr.result || ''))
    fr.onerror = () => gagal(new Error('Gambar gagal dibaca.'))
    fr.readAsDataURL(f)
  })
}
async function pilihBerkas(e: Event, aksi: (uri: string) => Promise<unknown>) {
  const el = e.target as HTMLInputElement
  const f = el.files?.[0]
  el.value = ''
  if (!f) return
  try {
    const uri = await bacaGambar(f)
    await aksi(uri)
  }
  catch (err) {
    toast.add({ title: (err as Error).message || 'Gagal.', color: 'error' })
  }
}
const gantiGambarPenanda = (e: Event, p: Penanda) => pilihBerkas(e, uri => jalankan(
  () => patchPenanda(p.id, { ttd: uri }, data.value?.penanda.versions[p.id] ?? ''),
  `Gambar tanda tangan ${p.nama} disimpan.`,
).then(() => muatGambar()))
const gantiCap = (e: Event) => pilihBerkas(e, uri => jalankan(
  () => putInvoiceSettings({ cap: uri }, data.value?.setting.version ?? ''),
  'Cap perusahaan disimpan.',
).then(() => muatGambar()))
const hapusCap = () => jalankan(() => putInvoiceSettings({ cap: '' }, data.value?.setting.version ?? ''), 'Cap perusahaan dihapus.').then(() => muatGambar())

// ---- Bukti transfer (Reservasi): the host's own proof, opened from the DP list
const buktiOpen = ref(false)
const buktiMuat = ref(false)
const buktiGalat = ref('')
const buktiData = ref('')
const buktiGambarOk = ref(true)
const buktiJudul = ref('')
async function lihatBukti(r: InvoiceReq, i: number) {
  buktiOpen.value = true
  buktiMuat.value = true
  buktiGalat.value = ''
  buktiData.value = ''
  buktiJudul.value = `Bukti transfer — ${namaDokumen(r)}`
  try {
    const res = (await getReservation(String(r.resId))).data
    const dp = dpsTampilan(res)[i]
    if (!dp?.proofData) throw new Error('Bukti untuk transfer ini tidak ditemukan di data Reservasi.')
    buktiGambarOk.value = buktiAdalahGambar(dp.proofData, dp.proofName)
    buktiData.value = dp.proofData.startsWith('@f:') ? (await getFile(dp.proofData.replace(/^@f:/, ''))).data.data : dp.proofData
  }
  catch (e) {
    buktiGalat.value = apiErrorMessage(e)
  }
  finally {
    buktiMuat.value = false
  }
}

// ---- Penanda tangan
const penandaOpen = ref(false)
const penandaForm = reactive({ nama: '', jabatan: '', ttd: '' })
function bukaPenanda() {
  penandaForm.nama = ''
  penandaForm.jabatan = ''
  penandaForm.ttd = ''
  penandaOpen.value = true
}
const simpanPenanda = () => jalankan(
  () => createPenanda({ nama: penandaForm.nama.trim(), jabatan: penandaForm.jabatan.trim() || undefined, urut: penanda.value.length + 1, ttd: penandaForm.ttd || undefined }),
  'Penanda tangan ditambahkan.',
).then(() => {
  penandaOpen.value = false
  return muatGambar()
})
const togglePenanda = (p: Penanda) => jalankan(
  () => patchPenanda(p.id, { aktif: p.aktif === false }, data.value?.penanda.versions[p.id] ?? ''),
  p.aktif === false ? `${p.nama} diaktifkan.` : `${p.nama} dinonaktifkan.`,
)
const hapusOpen = ref(false)
const hapusP = ref<Penanda | null>(null)
const jalanHapusP = () => {
  const p = hapusP.value
  if (!p) return
  return jalankan(() => deletePenanda(p.id, data.value?.penanda.versions[p.id] ?? ''), `${p.nama} dihapus.`).then(() => {
    hapusOpen.value = false
  })
}
</script>

<template>
  <AppPage
    title="Invoice & kwitansi"
    description="Permintaan kwitansi dari Reservasi — periksa dana masuknya, lalu terbitkan."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="sibuk"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('invoice')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <div class="mb-4">
        <AppSeg
          v-model="tab"
          size="sm"
          :options="[
            { value: 'antrean', label: `Antrean (${antre.length})` },
            { value: 'riwayat', label: `Riwayat (${riwayat.length})` },
            { value: 'pengaturan', label: 'Pengaturan' },
          ]"
        />
      </div>

      <AppPanel
        v-if="tab === 'antrean'"
        title="Menunggu keputusan"
        description="Periksa dana masuknya di halaman Dana Masuk (DP) sebelum menerbitkan."
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="r in antre"
            :key="r.id"
            class="px-4 py-3 lg:px-5"
          >
            <div class="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div class="min-w-0 flex-1 basis-60">
                <b class="text-highlighted">{{ namaDokumen(r) }}</b>
                <AppStatus
                  size="sm"
                  class="ms-2"
                >
                  {{ namaJenis(r.jenis) }}
                </AppStatus>
                <p class="text-xs text-muted">
                  {{ subDokumen(r) || r.resId }}
                </p>
                <p class="text-xs text-muted">
                  diminta {{ r.mintaOleh || '—' }} · {{ waktu(r.mintaAt) }}
                </p>
              </div>
              <div class="text-sm">
                <span class="block text-[11px] font-bold uppercase tracking-wider text-muted">Nilai ditagih</span>
                <b class="num text-highlighted">{{ fmtRp(nilaiPokok(r)) }}</b>
                <span
                  v-if="r.jenis === 'INV_LUNAS'"
                  class="block text-xs text-muted"
                >sisa dari {{ fmtRp(nilaiAngka(ring(r).grand)) }} · DP {{ fmtRp(praBayar(r)) }}</span>
                <span
                  v-else-if="r.jenis === 'INV_DP'"
                  class="block text-xs text-muted"
                >dari total {{ fmtRp(nilaiAngka(ring(r).grand)) }}</span>
              </div>
              <div class="text-sm">
                <span class="block text-[11px] font-bold uppercase tracking-wider text-muted">Dana masuk</span>
                <AppStatus
                  :color="danaInfo(r).penuh ? 'success' : 'warning'"
                  size="sm"
                >
                  {{ danaInfo(r).ada }}/{{ danaInfo(r).total }} {{ isInvoice(r) ? 'berbukti transfer' : 'terverifikasi' }}
                </AppStatus>
                <span class="block text-xs text-muted">{{ fmtRp(danaInfo(r).masuk) }} {{ isInvoice(r) ? 'tercatat masuk' : 'dipastikan masuk' }}{{ danaInfo(r).sisa > 0 ? ' · sisa ' + fmtRp(danaInfo(r).sisa) : '' }}</span>
              </div>
              <div class="flex gap-1.5">
                <UButton
                  :label="isInvoice(r) ? 'Terbitkan invoice' : 'Buat kwitansi'"
                  size="xs"
                  :disabled="!izin.ubah('invoice')"
                  @click="bukaPutus(r, 'buat')"
                />
                <UButton
                  label="Tolak"
                  color="error"
                  variant="outline"
                  size="xs"
                  :disabled="!izin.ubah('invoice')"
                  @click="bukaPutus(r, 'tolak')"
                />
              </div>
            </div>
            <UButton
              :label="bukaRincian === r.id ? 'Tutup rincian' : (isInvoice(r) ? 'Rincian tagihan & pembayaran' : 'Rincian transfer')"
              :trailing-icon="bukaRincian === r.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              color="neutral"
              variant="link"
              size="xs"
              class="mt-1 px-0"
              @click="bukaRincian = bukaRincian === r.id ? null : r.id"
            />
            <div
              v-if="bukaRincian === r.id"
              class="mt-2 space-y-3 overflow-x-auto rounded-xl border border-default bg-muted p-3 text-sm"
            >
              <template v-if="isInvoice(r)">
                <table
                  v-if="daftarItem(r).length"
                  class="w-full min-w-[28rem] text-sm [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1"
                >
                  <thead class="text-left text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th>Item tagihan</th>
                      <th class="text-right">
                        Qty
                      </th>
                      <th class="text-right">
                        Harga
                      </th>
                      <th class="text-right">
                        Jumlah
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr
                      v-for="(it, i) in daftarItem(r)"
                      :key="i"
                    >
                      <td>{{ it.desc || '—' }}</td>
                      <td class="text-right num">
                        {{ it.qty || 1 }}
                      </td>
                      <td class="text-right num">
                        {{ fmtRp(nilaiAngka(it.harga)) }}
                      </td>
                      <td class="text-right num">
                        {{ fmtRp(nilaiAngka(it.total)) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  v-else
                  class="text-muted"
                >
                  Tidak ada rincian tagihan yang ikut dikirim.
                </p>
                <p class="text-xs text-muted">
                  Subtotal {{ fmtRp(nilaiAngka(ring(r).sub)) }}{{ nilaiAngka(ring(r).disc) ? ' · diskon ' + fmtRp(nilaiAngka(ring(r).disc)) : '' }}{{ nilaiAngka(ring(r).service) ? ' · service ' + fmtRp(nilaiAngka(ring(r).service)) : '' }}{{ nilaiAngka(ring(r).tax) ? ' · pajak ' + fmtRp(nilaiAngka(ring(r).tax)) : '' }}
                  · <b>Grand total {{ fmtRp(nilaiAngka(ring(r).grand)) }}</b>
                </p>
                <table
                  v-if="daftarBayar(r).length"
                  class="w-full min-w-[28rem] text-sm [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1"
                >
                  <thead class="text-left text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th>Pembayaran</th>
                      <th>Metode</th>
                      <th class="text-right">
                        Nominal
                      </th>
                      <th>Bukti</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr
                      v-for="(p, i) in daftarBayar(r)"
                      :key="i"
                    >
                      <td>{{ p.jenis || '—' }}<span class="block text-xs text-muted">{{ p.tanggal || '—' }}{{ p.no ? ' · ' + p.no : '' }}</span></td>
                      <td>{{ p.metode || '—' }}</td>
                      <td class="text-right num">
                        {{ fmtRp(nilaiAngka(p.nominal)) }}
                      </td>
                      <td>
                        <AppStatus
                          :color="p.adaBukti ? 'success' : 'warning'"
                          size="sm"
                        >
                          {{ p.adaBukti ? 'ada bukti' : 'tanpa bukti' }}
                        </AppStatus>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  v-else
                  class="text-muted"
                >
                  Belum ada pembayaran yang tercatat.
                </p>
                <p class="text-xs text-muted">
                  PIC Marketing {{ ring(r).pic || '—' }}
                </p>
              </template>
              <template v-else>
                <table
                  v-if="daftarDp(r).length"
                  class="w-full min-w-[28rem] text-sm [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1"
                >
                  <thead class="text-left text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th>Transfer</th>
                      <th>Pengirim</th>
                      <th class="text-right">
                        Nominal
                      </th>
                      <th>Status</th>
                      <th>Bukti</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr
                      v-for="(t, i) in daftarDp(r)"
                      :key="i"
                    >
                      <td>{{ t.tanggal || '—' }}{{ t.jam ? ' ' + t.jam : '' }}<span class="block text-xs text-muted">{{ t.bank || t.metode || '—' }}{{ t.adaBukti ? '' : ' · tanpa bukti' }}</span></td>
                      <td>{{ t.pengirim || '—' }}</td>
                      <td class="text-right num">
                        {{ fmtRp(nilaiAngka(t.nominal)) }}
                      </td>
                      <td>
                        <AppStatus
                          :color="t.status === 'verified' ? 'success' : t.status === 'rejected' ? 'error' : 'warning'"
                          size="sm"
                        >
                          {{ t.status === 'verified' ? 'terverifikasi' : t.status === 'rejected' ? 'ditolak' : 'belum dicek' }}
                        </AppStatus>
                        <span
                          v-if="t.tanpaData"
                          class="block text-xs text-muted"
                        >dari gambar — {{ t.tanpaData }} tidak terbaca</span>
                      </td>
                      <td>
                        <UButton
                          v-if="t.adaBukti"
                          label="Lihat bukti"
                          icon="i-lucide-image"
                          color="neutral"
                          variant="outline"
                          size="xs"
                          @click="lihatBukti(r, i)"
                        />
                        <span
                          v-else
                          class="text-xs text-muted"
                        >tanpa bukti</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  v-else
                  class="text-muted"
                >
                  Tidak ada rincian transfer yang ikut dikirim.
                </p>
                <p class="text-xs text-muted">
                  Diinput oleh {{ ring(r).diinputOleh || '—' }} · No. kwitansi internal {{ ring(r).noKwitansi || '—' }}
                </p>
              </template>
            </div>
          </div>
          <p
            v-if="!antre.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Tidak ada permintaan yang menunggu.
          </p>
        </div>
      </AppPanel>

      <AppPanel
        v-else-if="tab === 'riwayat'"
        title="Riwayat"
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="r in riwayat"
            :key="r.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-5"
          >
            <div class="min-w-0 flex-1">
              <b class="text-highlighted">{{ r.no || r.resId }}</b>
              <span class="ms-2 text-sm text-muted">{{ namaJenis(r.jenis) }} · {{ r.resId }}</span>
              <p class="text-xs text-muted">
                {{ r.putusOleh || '—' }}{{ r.putusAt ? ` · ${new Date(r.putusAt).toLocaleString('id-ID', { day: 'numeric', month: 'short' })}` : '' }}
                <template v-if="r.catatan">
                  · {{ r.catatan }}
                </template>
              </p>
              <p
                v-if="r.status === 'DIBUAT' && r.materai"
                class="mt-1 text-xs text-muted"
              >
                Bermaterai — dicetak polos tanpa tanda tangan &amp; cap digital
              </p>
              <p
                v-if="r.ubah && (r.ubah.kepada || r.ubah.up || (r.ubah.ket ?? []).some(k => k && k.teks))"
                class="mt-1 text-xs text-muted"
              >
                Isi diubah Marketing{{ r.ubah.oleh ? ` (${r.ubah.oleh})` : '' }}
              </p>
            </div>
            <AppStatus
              :color="r.status === 'DIBUAT' ? 'success' : 'error'"
              size="sm"
            >
              {{ r.status === 'DIBUAT' ? 'Dibuat' : 'Ditolak' }}
            </AppStatus>
            <UButton
              v-if="r.status === 'DIBUAT'"
              label="Lihat PDF"
              icon="i-lucide-file-text"
              color="neutral"
              variant="outline"
              size="xs"
              :loading="pdfSibuk === r.id"
              @click="lihatPdf(r)"
            />
            <UButton
              v-if="r.status === 'DIBUAT' && izin.ubah('invoice')"
              label="Batalkan"
              color="error"
              variant="ghost"
              size="xs"
              @click="bukaPutus(r, 'batal')"
            />
          </div>
          <p
            v-if="!riwayat.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada keputusan.
          </p>
        </div>
      </AppPanel>

      <template v-else>
        <AppPanel
          title="Penomoran & bawaan"
          description="Nomor: PREFIX/YYYY/MM/NNNN — nomor yang sudah diberikan tidak pernah dipakai ulang."
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Prefix kwitansi">
              <UInput
                v-model="setForm.prefix"
                class="w-full"
                :disabled="!izin.ubah('invoice')"
              />
            </UFormField>
            <UFormField label="Prefix invoice">
              <UInput
                v-model="setForm.prefixInvoice"
                class="w-full"
                :disabled="!izin.ubah('invoice')"
              />
            </UFormField>
            <UFormField
              v-for="k in [
                { key: 'penandaDefault', label: 'Penanda bawaan — kwitansi Reservasi' },
                { key: 'penandaDefaultInvoice', label: 'Penanda bawaan — invoice Marketing' },
              ] as const"
              :key="k.key"
              :label="k.label"
              help="Tercentang sendiri saat menerbitkan; tiap lembar tetap bisa disetel."
            >
              <div class="space-y-1.5">
                <UCheckbox
                  v-for="pn in penanda.filter(x => x.aktif !== false)"
                  :id="'cb-bawaan-' + k.key + '-' + String(pn.id)"
                  :key="pn.id"
                  :model-value="setForm[k.key].split(',').map(x => x.trim()).includes(pn.id)"
                  :label="pn.nama + (pn.jabatan ? ' — ' + pn.jabatan : '')"
                  :disabled="!izin.ubah('invoice')"
                  @update:model-value="(v: boolean | 'indeterminate') => ubahBawaan(k.key, pn.id, v === true)"
                />
                <p
                  v-if="!penanda.some(x => x.aktif !== false)"
                  class="text-sm text-muted"
                >
                  Belum ada penanda tangan aktif.
                </p>
              </div>
            </UFormField>
          </div>
          <p class="mt-3 text-sm text-muted">
            Stempel (cap) dan gambar tanda tangan diunggah di tempat lain; layar ini tidak mengubah berkasnya.
          </p>
          <UButton
            v-if="izin.ubah('invoice')"
            label="Simpan pengaturan"
            icon="i-lucide-save"
            class="mt-3"
            :loading="sibuk"
            @click="simpanSetting"
          />
        </AppPanel>

        <AppPanel
          title="Penanda tangan"
          :count="penanda.length"
          description="Nama & jabatan disalin ke baris saat diterbitkan; berkas tanda tangannya dibaca saat dicetak."
          flush
        >
          <div class="divide-y divide-default">
            <div
              v-for="p in penanda"
              :key="p.id"
              class="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-5"
              :class="p.aktif === false ? 'opacity-60' : ''"
            >
              <div class="flex h-14 w-28 shrink-0 items-center justify-center rounded-lg border border-default bg-white p-1">
                <img
                  v-if="fotoPenanda(p.id)"
                  :src="fotoPenanda(p.id)"
                  :alt="'Tanda tangan ' + p.nama"
                  class="max-h-full max-w-full object-contain"
                >
                <span
                  v-else
                  class="text-center text-[11px] text-muted"
                >{{ gambar ? 'belum ada gambar' : 'memuat…' }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <b class="text-highlighted">{{ p.nama }}</b>
                <span class="block text-xs text-muted">{{ p.jabatan || '—' }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <label
                  v-if="izin.ubah('invoice')"
                  class="inline-flex cursor-pointer items-center rounded-md border border-default px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                >
                  {{ fotoPenanda(p.id) ? 'Ganti gambar' : 'Unggah gambar' }}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="e => gantiGambarPenanda(e, p)"
                  >
                </label>
                <UButton
                  :label="p.aktif === false ? 'Aktifkan' : 'Nonaktifkan'"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :disabled="!izin.ubah('invoice')"
                  @click="togglePenanda(p)"
                />
                <UButton
                  label="Hapus"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :disabled="!izin.ubah('invoice')"
                  @click="hapusP = p; hapusOpen = true"
                />
              </div>
            </div>
            <p
              v-if="!penanda.length"
              class="px-4 py-6 text-center text-sm text-muted"
            >
              Belum ada penanda tangan. Tanpa penanda, lembar keluar tanpa tanda tangan.
            </p>
          </div>
          <div
            v-if="izin.ubah('invoice')"
            class="border-t border-default px-4 py-3 lg:px-5"
          >
            <UButton
              label="Tambah penanda"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="bukaPenanda"
            />
          </div>
        </AppPanel>
        <AppPanel
          title="Cap perusahaan"
          description="Ditempel miring di belakang tanda tangan pada lembar yang terbit."
        >
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-default bg-white p-2">
              <img
                v-if="gambar?.cap"
                :src="gambar.cap"
                alt="Cap perusahaan"
                class="max-h-full max-w-full object-contain"
              >
              <span
                v-else
                class="text-xs text-muted"
              >{{ gambar ? 'Belum ada gambar' : 'memuat…' }}</span>
            </div>
            <div
              v-if="izin.ubah('invoice')"
              class="flex flex-wrap gap-2"
            >
              <label class="inline-flex cursor-pointer items-center rounded-md border border-default px-3 py-1.5 text-sm font-semibold hover:bg-muted">
                {{ gambar?.cap ? 'Ganti gambar' : 'Unggah gambar' }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  @change="gantiCap"
                >
              </label>
              <UButton
                v-if="gambar?.cap"
                label="Hapus"
                color="error"
                variant="ghost"
                size="sm"
                @click="hapusCap"
              />
            </div>
          </div>
        </AppPanel>
      </template>
    </template>

    <ResponsiveSheet
      v-model:open="buktiOpen"
      :title="buktiJudul"
    >
      <p
        v-if="buktiMuat"
        class="py-8 text-center text-sm text-muted"
      >
        Memuat bukti…
      </p>
      <UAlert
        v-else-if="buktiGalat"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="buktiGalat"
      />
      <template v-else-if="buktiData">
        <img
          v-if="buktiGambarOk"
          :src="buktiData"
          alt="Bukti transfer"
          class="mx-auto max-h-[70vh] max-w-full rounded-lg border border-default object-contain"
        >
        <iframe
          v-else
          :src="buktiData"
          title="Bukti transfer (PDF)"
          class="h-[70vh] w-full rounded-lg border border-default"
        />
        <a
          :href="buktiData"
          target="_blank"
          rel="noopener"
          class="mt-3 inline-block text-sm font-semibold text-primary underline"
        >Buka di tab baru</a>
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="putusOpen"
      :title="putusRow ? `${putusAksi === 'buat' ? 'Terbitkan' : putusAksi === 'tolak' ? 'Tolak' : 'Batalkan'} ${namaJenis(putusRow.jenis)} — ${putusRow.resId}` : 'Keputusan'"
    >
      <p
        v-if="putusAksi === 'buat'"
        class="mb-3 text-sm"
      >
        Nomor diberikan sekali dan tidak bisa dipakai ulang. Kwitansi yang terbit adalah pengakuan perusahaan bahwa
        uangnya sudah diterima — periksa dulu Dana Masuk (DP)-nya.
      </p>
      <UAlert
        v-if="putusAksi === 'buat' && peringatanDana(putusRow)"
        class="mb-3"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Perhatian: dananya belum lengkap terbukti."
        :description="peringatanDana(putusRow)"
      />
      <div
        v-if="putusAksi === 'buat'"
        class="mb-3 space-y-1"
      >
        <p class="text-sm text-muted">
          Penanda tangan (kosongkan untuk sengaja tanpa tanda tangan):
        </p>
        <UCheckbox
          v-for="p in penanda.filter(x => x.aktif !== false)"
          :id="`cb-invoice-538-${String(p.id).replace(/\s+/g, '-')}`"
          :key="p.id"
          :model-value="putusPenanda.includes(p.id)"
          :label="`${p.nama}${p.jabatan ? ` — ${p.jabatan}` : ''}`"
          @update:model-value="(v: boolean | 'indeterminate') => { putusPenanda = v === true ? [...putusPenanda, p.id] : putusPenanda.filter(x => x !== p.id) }"
        />
      </div>
      <div
        v-if="perluMaterai(putusRow)"
        class="mb-3 border-t border-default pt-3"
      >
        <p class="text-sm font-semibold">
          Kwitansi ini perlu materai?
        </p>
        <div class="mt-2">
          <AppPilihan
            v-model="putusMaterai"
            name="inv_materai"
            :options="[
              { value: false, label: 'Tidak — terbit bertanda tangan & cap digital' },
              { value: true, label: 'Ya — cetak polos untuk materai' },
            ]"
          />
        </div>
        <p
          v-if="putusMaterai === true"
          class="mt-2 text-xs text-muted"
        >
          Lembar keluar dengan kotak materai dan kolom tanda tangan kosong — tanpa gambar tanda tangan &amp; cap.
          Nama penanda yang dicentang tetap tercetak di bawah garisnya, untuk ditandatangani basah di atas materai.
        </p>
      </div>
      <UFormField
        v-if="putusAksi !== 'buat'"
        label="Catatan (wajib untuk penolakan)"
      >
        <UInput
          v-model="putusCatatan"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          :label="putusAksi === 'buat' ? 'Terbitkan' : putusAksi === 'tolak' ? 'Tolak' : 'Batalkan penerbitan'"
          :color="putusAksi === 'buat' ? 'primary' : 'error'"
          :loading="sibuk"
          @click="jalanPutus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="putusOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="penandaOpen"
      title="Tambah penanda tangan"
    >
      <div class="space-y-3">
        <UFormField label="Nama *">
          <UInput
            v-model="penandaForm.nama"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jabatan">
          <UInput
            v-model="penandaForm.jabatan"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Gambar tanda tangan"
          help="PNG berlatar transparan paling baik, di bawah 1 MB. Boleh diisi belakangan."
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-semibold"
            @change="e => pilihBerkas(e, async (uri) => { penandaForm.ttd = uri })"
          >
          <img
            v-if="penandaForm.ttd"
            :src="penandaForm.ttd"
            alt="Pratinjau tanda tangan"
            class="mt-2 max-h-20 rounded border border-default bg-white p-1"
          >
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Tambah"
          :disabled="!penandaForm.nama.trim()"
          :loading="sibuk"
          @click="simpanPenanda"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="penandaOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapusP ? `Hapus penanda ${hapusP.nama}?` : 'Hapus penanda?'"
    >
      <p class="text-sm">
        Penanda yang sudah dipakai pada lembar terbit ditolak server — nonaktifkan saja supaya riwayat tetap utuh.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          :loading="sibuk"
          @click="jalanHapusP"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
