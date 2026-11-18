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
  const bawaan = String((aksi === 'buat' ? setting.value.penandaDefaultInvoice || setting.value.penandaDefault : setting.value.penandaDefault) || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  putusPenanda.value = bawaan
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
        cap: b.cap || '', logo: '', materai: !!b.materai,
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
const ringkasDp = (r: InvoiceReq) => {
  const x = r.ringkas as { dpKurang?: number, dpAda?: number, dpTotal?: number, pax?: number, tgl?: string } | null | undefined
  return x && typeof x === 'object' ? x : null
}

// ---- Pengaturan
const setForm = reactive({ prefix: '', prefixInvoice: '', penandaDefault: '', penandaDefaultInvoice: '' })
watch(setting, () => {
  setForm.prefix = String(setting.value.prefix || '')
  setForm.prefixInvoice = String(setting.value.prefixInvoice || '')
  setForm.penandaDefault = String(setting.value.penandaDefault || '')
  setForm.penandaDefaultInvoice = String(setting.value.penandaDefaultInvoice || '')
}, { immediate: true })
const simpanSetting = () => jalankan(
  () => putInvoiceSettings({ ...setForm }, data.value?.setting.version ?? ''),
  'Pengaturan invoice disimpan.',
)

// ---- Penanda tangan
const penandaOpen = ref(false)
const penandaForm = reactive({ nama: '', jabatan: '', urut: '' })
function bukaPenanda() {
  penandaForm.nama = ''
  penandaForm.jabatan = ''
  penandaForm.urut = ''
  penandaOpen.value = true
}
const simpanPenanda = () => jalankan(
  () => createPenanda({ nama: penandaForm.nama.trim(), jabatan: penandaForm.jabatan.trim() || undefined, urut: Number(penandaForm.urut) || undefined }),
  'Penanda tangan ditambahkan.',
).then(() => {
  penandaOpen.value = false
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
            class="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-5"
          >
            <div class="min-w-0 flex-1">
              <b class="text-highlighted">{{ r.resId }}</b>
              <span class="ms-2 text-sm text-muted">{{ namaJenis(r.jenis) }}</span>
              <p class="text-xs text-muted">
                diminta {{ r.mintaOleh || '—' }}{{ r.mintaAt ? ` · ${new Date(r.mintaAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '' }}
              </p>
            </div>
            <div
              v-if="ringkasDp(r)"
              class="text-xs text-muted"
            >
              <span
                v-if="typeof ringkasDp(r)!.dpKurang === 'number' && ringkasDp(r)!.dpKurang! > 0"
                class="text-warning"
              >
                DP kurang {{ fmtRp(ringkasDp(r)!.dpKurang!) }}
              </span>
              <span v-else>DP terverifikasi</span>
            </div>
            <div class="flex gap-1.5">
              <UButton
                label="Terbitkan"
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
              label="Penanda bawaan (kwitansi)"
              help="Isi id penanda, dipisah koma."
            >
              <UInput
                v-model="setForm.penandaDefault"
                class="w-full"
                :disabled="!izin.ubah('invoice')"
              />
            </UFormField>
            <UFormField
              label="Penanda bawaan (invoice)"
              help="Isi id penanda, dipisah koma."
            >
              <UInput
                v-model="setForm.penandaDefaultInvoice"
                class="w-full"
                :disabled="!izin.ubah('invoice')"
              />
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
              <div class="min-w-0 flex-1">
                <b class="text-highlighted">{{ p.nama }}</b>
                <span class="block text-xs text-muted">{{ p.jabatan || '—' }} · id {{ p.id }}{{ (p.ttdAda ?? p.ttd) ? ' · ada tanda tangan' : '' }}</span>
              </div>
              <div class="flex gap-1.5">
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
      </template>
    </template>

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
        <UFormField label="Urut">
          <UInput
            v-model="penandaForm.urut"
            inputmode="numeric"
            class="w-full"
          />
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
