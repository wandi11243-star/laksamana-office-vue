<!--
  Marketing › Finance tab of the event detail (D.8 Kasir rows live in the
  schema form; this is D.9 + money): Rincian table, ketentuan, DP tick with
  its live note, payment history, Catat Pembayaran (verify_payment), Kirim
  Invoice + Reminder DP over WhatsApp, and the invoice preview.
  Edits the page draft; the page saves with a versioned PATCH.
-->
<script setup lang="ts">
import type { EventMkt, PembayaranMkt, SettingsMkt } from '~/utils/marketing'
import type { DrafEventMkt } from '~/utils/marketing-event'
import {
  JENIS_BAYAR_MKT, MAKS_BERKAS_MKT, REKENING_MKT,
  bayarBaruSahMkt, bawaanBayarMkt, dpFormKurangMkt, finPakaiDpMkt,
  noKwitansiMkt, pesanInvoiceWaMkt, pesanReminderWaMkt,
  sisaSesudahMkt, tujuanWaMkt,
} from '~/utils/marketing-event'
import { dpLabel, eventFinance, invStatus, rinciSeedRows, ynBool } from '~/utils/marketing-uang'
import { berkasKeBase64, bukaBerkasMkt, kunciBerkasMkt, unggahBerkasMkt, urlBerkasMkt } from '~/composables/useMarketing'
// Invoice pill reuses the page's invoice-status colours (Draft/Sent/Pending/Paid/Overdue).
import { ikonInvoiceMkt, warnaInvoiceMkt } from '~/utils/status-marketing'
import { berkasKwitansi, statusKwitansi, updateInvoiceText, type BerkasKwitansi, type StatusKwitansi } from '~/composables/useFinance'
import { adaBuktiSheet, invoiceHtml } from '~/utils/invoice-sheet'
import { resIdInvMkt } from '~/utils/marketing-keuangan'
import { hariIni, rupiah } from '~/utils/format'

const props = defineProps<{
  ev: EventMkt
  namaClient: string
  clientHp: string
  settings: SettingsMkt
  bisaUbah: boolean
  bisaVerif: boolean
  sayaNama: string
}>()

const draft = defineModel<DrafEventMkt>('draft', { required: true })
const toast = useToast()

const evGabung = computed(() => ({ ...props.ev, ...draft.value.atas, detail: draft.value.detail, payments: draft.value.payments ?? props.ev.payments ?? [] }) as EventMkt & { payments: PembayaranMkt[] })
const uang = computed(() => eventFinance(evGabung.value, props.settings))
const inv = computed(() => invStatus(evGabung.value, props.settings, hariIni()))
const pakaiDp = computed(() => finPakaiDpMkt(evGabung.value))
const kurangDp = computed(() => dpFormKurangMkt(evGabung.value))
const dpCentang = computed(() => ynBool(draft.value.detail.dpPaid))
const kelebihan = computed(() => Math.max(0, uang.value.paid - uang.value.grand))

type BarisRinci = { desc?: string, jumlah?: number | string, harga?: number | string, jenis?: string }
const rinci = computed<BarisRinci[]>(() => (Array.isArray(draft.value.detail.rincianItem) ? draft.value.detail.rincianItem : []) as BarisRinci[])
function setRinci(rows: BarisRinci[]) {
  draft.value.detail.rincianItem = rows.filter(r => String(r.desc ?? '').trim() || +(r.harga ?? 0))
}
function tambahRinci() {
  setRinci([...rinci.value, { desc: '', jumlah: '', harga: '', jenis: 'bayar' }])
}
function hapusRinci(i: number) {
  setRinci(rinci.value.filter((_, j) => j !== i))
}
function ubahRinci(i: number, k: string, v: string) {
  setRinci(rinci.value.map((r, j) => (j === i ? { ...r, [k]: k === 'desc' || k === 'jenis' ? v : v.replace(/\D/g, '') } : r)))
}
const totalBaris = (r: BarisRinci) => ((r.jenis || 'bayar') === 'bayar' ? (+(r.jumlah || 0) || 1) * (+(r.harga || 0) || 0) : 0)

/** Fill FREE + TBC template lines like the old "Sisipkan FREE & TBC". */
function sisipkanTemplate() {
  const seed: BarisRinci[] = rinciSeedRows(evGabung.value, props.settings).map(s => ({
    desc: String(s.desc ?? ''),
    jumlah: (s.jumlah ?? '') as number | string,
    harga: (s.harga ?? '') as number | string,
    jenis: String(s.jenis ?? 'bayar'),
  }))
  const ada = new Set(rinci.value.map(r => `${r.jenis}:${String(r.desc ?? '').trim()}`))
  setRinci([...rinci.value, ...seed.filter(s => (s.jenis === 'free' || s.jenis === 'tbc') && !ada.has(`${s.jenis}:${String(s.desc ?? '').trim()}`))])
}

// ---- DP proof: uploaded at once (dpBuktiPilih) ----
const mengunggahDp = ref(false)
async function pilihBuktiDp(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  if (f.size > MAKS_BERKAS_MKT) {
    toast.add({ title: 'File terlalu besar', description: 'Bukti transfer maksimal 8MB.', color: 'error' })
    return
  }
  mengunggahDp.value = true
  try {
    const b64 = await berkasKeBase64(f)
    const r = await unggahBerkasMkt({ dataBase64: b64, fileName: f.name, mimeType: f.type || 'application/octet-stream' })
    if (r.data?.key) {
      draft.value.detail.dpBuktiUrl = urlBerkasMkt(r.data.key)
      draft.value.detail.dpBuktiNama = r.data.name || f.name
    }
  }
  catch (e) {
    toast.add({ title: 'Gagal mengunggah bukti', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengunggahDp.value = false
  }
}

function toggleDp(v: boolean) {
  if (v && kurangDp.value.length) {
    toast.add({ title: 'Belum lengkap', description: `Lengkapi dulu: ${kurangDp.value.join(', ')}.`, color: 'error' })
    return
  }
  if (!v) {
    const baris = (draft.value.payments ?? []).find(p => (p as { dariDpForm?: boolean }).dariDpForm)
    if (baris && !confirm('Centang "DP sudah dibayar" dimatikan — baris pembayaran yang lahir darinya ikut dibuang. Lanjut?')) return
    if (baris) draft.value.payments = (draft.value.payments ?? []).filter(p => p !== baris)
  }
  draft.value.detail.dpPaid = v
}

// ---- payment sheet ----
const bayarBuka = ref(false)
const bayarId = ref<string | null>(null)
const bayar = ref({ type: 'DP', amount: '', method: 'Transfer', at: hariIni(), note: '' })
const bayarBerkas = ref<File | null>(null)
const bayarSibuk = ref(false)
function bukaBayar(id?: string) {
  const p = id ? (draft.value.payments ?? []).find(x => x.id === id) : null
  const bawaan = bawaanBayarMkt(uang.value, pakaiDp.value)
  bayarId.value = id ?? null
  bayar.value = {
    type: String(p?.type ?? bawaan.type),
    amount: String(p?.amount ?? bawaan.amount ?? ''),
    method: String(p?.method ?? 'Transfer'),
    at: String(p?.at ?? hariIni()),
    note: String(p?.receipt ?? ''),
  }
  bayarBerkas.value = null
  bayarBuka.value = true
}
const bayarLama = computed(() => {
  const p = bayarId.value ? (draft.value.payments ?? []).find(x => x.id === bayarId.value) : null
  return +(p?.amount ?? 0) || 0
})
const sisaLive = computed(() => sisaSesudahMkt(uang.value, bayarLama.value, +bayar.value.amount.replace(/\D/g, '') || 0))
const buktiLama = computed(() => {
  const p = bayarId.value ? (draft.value.payments ?? []).find(x => x.id === bayarId.value) : null
  return !!p?.receiptUrl
})
async function simpanBayar() {
  const amt = +bayar.value.amount.replace(/\D/g, '') || 0
  if (!amt) {
    toast.add({ title: 'Isi jumlah', description: 'Jumlah pembayaran wajib.', color: 'error' })
    return
  }
  const sah = bayarBaruSahMkt(!!bayarBerkas.value, buktiLama.value, !bayarId.value)
  if (sah === 'wajib') {
    toast.add({ title: 'Bukti transfer wajib', description: 'Unggah foto struk atau PDF-nya. Untuk Cash, foto kwitansinya.', color: 'error' })
    return
  }
  if (sah === 'tanya' && !confirm('Pembayaran ini tercatat tanpa bukti transfer — dari sebelum buktinya diwajibkan.\n\nSebaiknya dilengkapi sekarang selagi formnya terbuka. Simpan tanpa bukti?')) return
  bayarSibuk.value = true
  try {
    let receiptUrl = ''
    let receiptName = bayar.value.note.trim()
    const lama = bayarId.value ? (draft.value.payments ?? []).find(x => x.id === bayarId.value) : null
    if (lama?.receiptUrl) receiptUrl = String(lama.receiptUrl ?? '')
    if (bayarBerkas.value) {
      const f = bayarBerkas.value
      if (f.size > MAKS_BERKAS_MKT) {
        toast.add({ title: 'File terlalu besar', description: 'Bukti transfer maksimal 8MB.', color: 'error' })
        bayarSibuk.value = false
        return
      }
      const r = await unggahBerkasMkt({ dataBase64: await berkasKeBase64(f), fileName: f.name, mimeType: f.type || 'application/octet-stream' })
      if (!r.data?.key) throw new Error('unggah gagal')
      receiptUrl = urlBerkasMkt(r.data.key)
      if (!receiptName) receiptName = r.data.name || f.name
    }
    const semua = [...(draft.value.payments ?? [])]
    if (lama) {
      Object.assign(lama, { type: bayar.value.type, amount: amt, method: bayar.value.method, at: bayar.value.at, receipt: receiptName, receiptUrl })
    }
    else {
      semua.push({
        id: `p${Date.now().toString(36)}`, no: noKwitansiMkt(props.settings),
        type: bayar.value.type, amount: amt, method: bayar.value.method, at: bayar.value.at,
        receipt: receiptName, receiptUrl, verified: true, by: props.sayaNama,
      })
    }
    draft.value.payments = semua
    bayarBuka.value = false
    toast.add({ title: lama ? 'Pembayaran diperbarui' : 'Pembayaran tercatat di draf', description: 'Tekan Simpan Finance supaya tersimpan.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal menyimpan pembayaran', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    bayarSibuk.value = false
  }
}
function hapusBayar(id: string) {
  const p = (draft.value.payments ?? []).find(x => x.id === id)
  if (!p) return
  if (!confirm(`Hapus pembayaran ${p.no ?? ''} · ${p.type} ${rupiah(+(p.amount ?? 0))}? Tindakan ini tidak bisa dibatalkan.${(p as { dariDpForm?: boolean }).dariDpForm ? '\n\nBaris ini lahir dari centang "DP sudah dibayar" — centangnya ikut dilepas.' : ''}`)) return
  draft.value.payments = (draft.value.payments ?? []).filter(x => x.id !== id)
  if ((p as { dariDpForm?: boolean }).dariDpForm) draft.value.detail.dpPaid = false
}

// ---- WA ----
function kirimInvoice() {
  const no = tujuanWaMkt(props.clientHp, draft.value.detail.refundPIC)
  if (!no) {
    toast.add({ title: 'Nomor WA tidak ada', description: 'Client belum punya nomor HP dan PIC pembayaran belum diisi.', color: 'error' })
    return
  }
  window.open(`https://wa.me/${no}?text=${encodeURIComponent(pesanInvoiceWaMkt(evGabung.value, props.namaClient, props.settings))}`, '_blank')
}
function reminderDp() {
  const no = tujuanWaMkt(props.clientHp, draft.value.detail.refundPIC)
  if (!no) {
    toast.add({ title: 'Nomor WA tidak ada', description: 'Client belum punya nomor HP dan PIC pembayaran belum diisi.', color: 'error' })
    return
  }
  window.open(`https://wa.me/${no}?text=${encodeURIComponent(pesanReminderWaMkt(evGabung.value, props.namaClient, props.settings))}`, '_blank')
}

// ---- invoice preview ----
const pratinjau = ref(false)
const cetak = () => cetakPdf(namaBerkas('Tagihan', evGabung.value.nama, props.namaClient))
const barisTagih = computed(() => {
  const rows = rinci.value.filter(r => String(r.desc ?? '').trim())
  return rows.map(r => ({ ...r, total: totalBaris(r) }))
})

// ---- invoice resmi (diterbitkan Finance): pratinjau + ubah teks ----
const invStat = ref<Record<string, StatusKwitansi | null>>({})
const invVersi = ref<Record<string, string>>({})
async function muatInvResmi() {
  const ids = (['dp', 'lunas'] as const).map(j => resIdInvMkt(props.ev.id, j))
  try {
    const r = await statusKwitansi(ids)
    for (const id of ids) invStat.value[id] = (r.data ?? {})[id] ?? null
    Object.assign(invVersi.value, r.meta?.versions ?? {})
  }
  catch { /* lembar internal tetap bisa dicetak tanpa nomor resmi */ }
}
watch(() => props.ev.id, () => void muatInvResmi(), { immediate: true })

const invResmiAda = computed(() => (['dp', 'lunas'] as const).some(j => invStat.value[resIdInvMkt(props.ev.id, j)]?.status === 'DIBUAT'))

const invPdf = ref<{ jenis: 'INV_DP' | 'INV_LUNAS', berkas: BerkasKwitansi } | null>(null)
const invPdfBuka = computed({
  get: () => !!invPdf.value,
  set: (v) => {
    if (!v) {
      invPdf.value = null
      invUbahMode.value = false
    }
  },
})
async function bukaInvPdf(jenis: 'INV_DP' | 'INV_LUNAS') {
  try {
    const r = await berkasKwitansi(resIdInvMkt(props.ev.id, jenis === 'INV_LUNAS' ? 'lunas' : 'dp'))
    if (!r.data) throw new Error('not_issued')
    invPdf.value = { jenis, berkas: r.data }
  }
  catch (e) {
    toast.add({ title: 'Belum terbit', description: apiErrorMessage(e), color: 'error' })
  }
}

const invLembar = computed(() => {
  const p = invPdf.value
  if (!p) return null
  const lunas = p.jenis === 'INV_LUNAS'
  const u = (p.berkas.ubah ?? {}) as { kepada?: string, up?: string, ket?: { asal?: string, teks?: string }[] }
  const totals: { label: string, nilai: number, tebal?: boolean }[] = [
    { label: 'Subtotal', nilai: uang.value.sub },
  ]
  if (uang.value.disc) totals.push({ label: 'Diskon', nilai: -uang.value.disc })
  if (uang.value.svcOn && uang.value.service) totals.push({ label: 'Service charge', nilai: uang.value.service })
  if (uang.value.tax) totals.push({ label: `PB1 ${uang.value.taxPct}%${uang.value.taxInc ? ' (termasuk harga)' : ''}`, nilai: uang.value.tax })
  totals.push({ label: 'Grand Total', nilai: uang.value.grand, tebal: true })
  if (lunas) {
    for (const pay of (evGabung.value.payments ?? []).filter(x => String(x.type ?? '') === 'DP')) {
      totals.push({ label: `Dikurangi pembayaran ${pay.type}${pay.at ? ` · ${pay.at}` : ''}`, nilai: -(+(pay.amount ?? 0) || 0) })
    }
    totals.push({ label: 'SISA PEMBAYARAN', nilai: uang.value.remaining, tebal: true })
  }
  else {
    totals.push({ label: `${dpLabel(uang.value)} yang ditagih`, nilai: uang.value.dp, tebal: true })
    if (uang.value.paid > 0) totals.push({ label: 'Sudah diterima', nilai: uang.value.paid })
  }
  return {
    no: p.berkas.no, resmi: true, lunas,
    tanggalTerbit: hariIni(),
    kepada: String(u.kepada || '').trim() || props.namaClient,
    up: String(u.up || '').trim() || props.namaClient,
    acara: props.ev.nama, tanggalAcara: String(props.ev.tanggal ?? ''),
    jenisAcara: String(props.ev.jenis ?? ''), pax: String(props.ev.pax ?? ''),
    items: rinci.value.filter(r => (r.jenis || 'bayar') === 'bayar' && String(r.desc ?? '').trim())
      .map(r => ({ desc: String(r.desc ?? ''), qty: (+(r.jumlah || 0)) || 1, harga: +(r.harga || 0) || 0 })),
    ket: Array.isArray(u.ket) ? u.ket : [],
    totals,
    penanda: p.berkas.penanda,
    cap: adaBuktiSheet((evGabung.value.payments ?? []).map(x => ({ jenis: String(x.type ?? ''), adaBukti: !!x.receiptUrl })), p.jenis) ? (p.berkas.cap || '') : '',
    kaki: `Dicetak ${hariIni()} oleh ${props.sayaNama}`,
  }
})
const invLembarHtml = computed(() => (invLembar.value ? invoiceHtml(invLembar.value) : ''))

// Form ubah: hanya teks — Kepada, U.P, Keterangan tiap baris.
const invUbahMode = ref(false)
const invUbahKepada = ref('')
const invUbahUp = ref('')
const invUbahKet = ref<string[]>([])
const invUbahSibuk = ref(false)
watch(invPdf, (p) => {
  const u = (p?.berkas.ubah ?? {}) as { kepada?: string, up?: string, ket?: { teks?: string }[] }
  invUbahKepada.value = String(u.kepada ?? '')
  invUbahUp.value = String(u.up ?? '')
  invUbahKet.value = (invLembar.value?.items ?? []).map((_, i) => String(u.ket?.[i]?.teks ?? ''))
})
async function simpanInvUbah() {
  const p = invPdf.value
  if (!p) return
  const rid = resIdInvMkt(props.ev.id, p.jenis === 'INV_LUNAS' ? 'lunas' : 'dp')
  const st_ = invStat.value[rid]
  if (!st_?.id) {
    toast.add({ title: 'Status belum terbaca', description: 'Tutup lalu buka lagi panel ini.', color: 'error' })
    return
  }
  invUbahSibuk.value = true
  try {
    const items = invLembar.value?.items ?? []
    await updateInvoiceText(st_.id, {
      ubah: {
        kepada: invUbahKepada.value.trim(), up: invUbahUp.value.trim(),
        ket: items.map((it, i) => ({ asal: String(it.desc ?? ''), teks: invUbahKet.value[i]?.trim() ?? '' })),
      },
    }, invVersi.value[rid] ?? '')
    const b = (await berkasKwitansi(rid)).data
    if (b) invPdf.value = { ...p, berkas: b }
    await muatInvResmi()
    invUbahMode.value = false
    toast.add({ title: 'Invoice diperbarui', description: 'Lembar di Finance ikut berubah.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    invUbahSibuk.value = false
  }
}
</script>

<template>
  <div class="grid grid-cols-1 gap-5">
    <AppPanel
      title="Rincian Tagihan"
      description="Seluruh yang ditagih ada di sini — konsumsi, sewa venue, sound & lighting, sampai lain-lain. Persis kolom lembar tagihan yang dicetak."
    >
      <div class="hidden overflow-x-auto lg:block">
        <table class="w-full min-w-[760px] text-sm">
          <thead class="bg-muted text-left text-xs text-muted">
            <tr>
              <th class="w-10 px-2 py-2">
                No
              </th>
              <th class="px-2 py-2">
                Deskripsi
              </th>
              <th class="w-20 px-2 py-2">
                Qty
              </th>
              <th class="w-36 px-2 py-2">
                Harga
              </th>
              <th class="w-32 px-2 py-2">
                Jenis
              </th>
              <th class="w-32 px-2 py-2 text-right">
                Total
              </th>
              <th
                v-if="bisaUbah"
                class="w-10 px-2 py-2"
              />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in rinci"
              :key="i"
              class="border-b border-default last:border-0"
            >
              <td class="px-2 py-2 text-muted num">
                {{ i + 1 }}
              </td>
              <td class="px-2 py-2">
                <UInput
                  :model-value="String(r.desc ?? '')"
                  placeholder="mis. Biaya konsumsi event"
                  :disabled="!bisaUbah"
                  class="w-full"
                  @update:model-value="ubahRinci(i, 'desc', String($event))"
                />
              </td>
              <td class="px-2 py-2">
                <UInput
                  :model-value="String(r.jumlah ?? '')"
                  inputmode="numeric"
                  :disabled="!bisaUbah || (r.jenis || 'bayar') !== 'bayar'"
                  class="w-full"
                  @update:model-value="ubahRinci(i, 'jumlah', String($event))"
                />
              </td>
              <td class="px-2 py-2">
                <AppNominal
                  :model-value="String(r.harga ?? '')"
                  :disabled="!bisaUbah || (r.jenis || 'bayar') !== 'bayar'"
                  class="w-full"
                  @update:model-value="ubahRinci(i, 'harga', String($event))"
                />
              </td>
              <td class="px-2 py-2">
                <USelect
                  :model-value="String(r.jenis || 'bayar')"
                  :items="[{ value: 'bayar', label: 'Ditagih' }, { value: 'free', label: 'FREE' }, { value: 'tbc', label: 'Belum pasti' }]"
                  value-key="value"
                  label-key="label"
                  :disabled="!bisaUbah"
                  class="w-full"
                  @update:model-value="ubahRinci(i, 'jenis', String($event))"
                />
              </td>
              <td class="px-2 py-2 text-right num">
                {{ (r.jenis || 'bayar') === 'bayar' ? rupiah(totalBaris(r)) : r.jenis === 'free' ? 'FREE' : 'TBC' }}
              </td>
              <td
                v-if="bisaUbah"
                class="px-1 py-2 text-right"
              >
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  aria-label="Hapus baris"
                  @click="hapusRinci(i)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="grid gap-2 lg:hidden">
        <div
          v-for="(r, i) in rinci"
          :key="i"
          class="grid gap-2 rounded-xl border border-default p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-muted">Baris {{ i + 1 }}</span>
            <UButton
              v-if="bisaUbah"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              aria-label="Hapus baris"
              @click="hapusRinci(i)"
            />
          </div>
          <UFormField label="Deskripsi">
            <UInput
              size="lg"
              :model-value="String(r.desc ?? '')"
              placeholder="mis. Biaya konsumsi event"
              :disabled="!bisaUbah"
              class="w-full"
              @update:model-value="ubahRinci(i, 'desc', String($event))"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Qty">
              <UInput
                size="lg"
                :model-value="String(r.jumlah ?? '')"
                inputmode="numeric"
                :disabled="!bisaUbah || (r.jenis || 'bayar') !== 'bayar'"
                class="w-full"
                @update:model-value="ubahRinci(i, 'jumlah', String($event))"
              />
            </UFormField>
            <UFormField label="Harga">
              <AppNominal
                size="lg"
                :model-value="String(r.harga ?? '')"
                :disabled="!bisaUbah || (r.jenis || 'bayar') !== 'bayar'"
                class="w-full"
                @update:model-value="ubahRinci(i, 'harga', String($event))"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 items-end gap-2">
            <UFormField label="Jenis">
              <USelect
                size="lg"
                :model-value="String(r.jenis || 'bayar')"
                :items="[{ value: 'bayar', label: 'Ditagih' }, { value: 'free', label: 'FREE' }, { value: 'tbc', label: 'Belum pasti' }]"
                value-key="value"
                label-key="label"
                :disabled="!bisaUbah"
                class="w-full"
                @update:model-value="ubahRinci(i, 'jenis', String($event))"
              />
            </UFormField>
            <p class="text-right text-sm">
              <span class="text-muted">Total </span>
              <b class="num">{{ (r.jenis || 'bayar') === 'bayar' ? rupiah(totalBaris(r)) : r.jenis === 'free' ? 'FREE' : 'TBC' }}</b>
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="bisaUbah"
        class="mt-3 flex flex-wrap gap-2"
      >
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          label="Tambah baris"
          @click="tambahRinci"
        />
        <UButton
          icon="i-lucide-list-plus"
          color="neutral"
          variant="ghost"
          size="sm"
          label="Sisipkan FREE & TBC"
          @click="sisipkanTemplate"
        />
      </div>
    </AppPanel>

    <div class="grid gap-5 lg:grid-cols-2">
      <div class="min-w-0">
        <AppPanel
          title="Ketentuan"
          class="min-w-0"
        >
          <div class="grid grid-cols-1 gap-4">
            <UFormField label="Discount (Rp)">
              <AppNominal
                size="lg"
                :model-value="String(draft.detail.diskon ?? '')"
                :disabled="!bisaUbah"
                class="w-full"
                @update:model-value="draft.detail.diskon = String($event).replace(/\D/g, '') === '' ? '' : +String($event).replace(/\D/g, '')"
              />
            </UFormField>
            <UFormField label="Kena biaya service?">
              <AppPilihan
                :model-value="draft.detail.svcApply === undefined ? undefined : !!draft.detail.svcApply"
                :options="[{ value: true, label: `Ya (${settings.serviceCharge}%)` }, { value: false, label: 'Tidak' }]"
                name="svc"
                @update:model-value="draft.detail.svcApply = $event"
              />
            </UFormField>
            <UFormField label="Harga sudah termasuk pajak?">
              <AppPilihan
                :model-value="draft.detail.taxInclude === undefined ? undefined : !!draft.detail.taxInclude"
                :options="[{ value: true, label: `Ya (${settings.pb1}%)` }, { value: false, label: 'Tidak' }]"
                name="tax"
                @update:model-value="draft.detail.taxInclude = $event"
              />
            </UFormField>
            <UFormField label="DP / Uang Muka (Rp)">
              <AppNominal
                size="lg"
                :model-value="String(draft.detail.depositNominal ?? '')"
                :disabled="!bisaUbah"
                class="w-full"
                @update:model-value="draft.detail.depositNominal = String($event).replace(/\D/g, '') === '' ? '' : +String($event).replace(/\D/g, '')"
              />
            </UFormField>
            <UFormField label="Masuk ke rekening">
              <USelect
                size="lg"
                :model-value="String(draft.detail.dpRek ?? '')"
                :items="REKENING_MKT"
                :disabled="!bisaUbah"
                placeholder="Pilih…"
                class="w-full"
                @update:model-value="draft.detail.dpRek = String($event)"
              />
            </UFormField>
            <UFormField label="Tanggal transfer">
              <AppTanggal
                size="lg"
                :model-value="String(draft.detail.dpTgl ?? '')"
                :disabled="!bisaUbah"
                class="w-full"
                @update:model-value="draft.detail.dpTgl = String($event)"
              />
            </UFormField>
            <div class="lg:col-span-2">
              <UFormField label="Bukti transfer">
                <div class="grid grid-cols-1 gap-2">
                  <UButton
                    v-if="draft.detail.dpBuktiUrl"
                    color="neutral"
                    variant="link"
                    size="xs"
                    class="px-0 text-sm text-primary-700 underline"
                    @click="bukaBerkasMkt(kunciBerkasMkt(String(draft.detail.dpBuktiUrl)))"
                  >
                    {{ String(draft.detail.dpBuktiNama || 'Lihat bukti') }}
                  </UButton>
                  <UInput
                    v-if="bisaUbah"
                    size="lg"
                    type="file"
                    accept="image/*,application/pdf"
                    :disabled="mengunggahDp"
                    class="w-full"
                    @change="pilihBuktiDp(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
                  />
                </div>
              </UFormField>
            </div>
            <div class="lg:col-span-2">
              <USwitch
                :model-value="dpCentang"
                label="DP sudah dibayar"
                :disabled="!bisaUbah"
                @update:model-value="toggleDp($event)"
              />
              <p class="mt-1 text-xs text-muted">
                <template v-if="!kurangDp.length">
                  Centang ini melahirkan baris pembayaran DP di bawah — menghapus baris itu ikut melepas centang ini.
                </template>
                <template v-else>
                  Belum bisa dicentang — kurang: {{ kurangDp.join(', ') }}.
                </template>
              </p>
            </div>
            <UFormField
              label="Fasilitas termasuk (FREE)"
              class="lg:col-span-2"
            >
              <UTextarea
                size="lg"
                :model-value="String(draft.detail.itemFree ?? '')"
                :disabled="!bisaUbah"
                autoresize
                class="w-full"
                @update:model-value="draft.detail.itemFree = String($event)"
              />
            </UFormField>
            <UFormField
              label="Item belum pasti harganya (TBC)"
              class="lg:col-span-2"
            >
              <UTextarea
                size="lg"
                :model-value="String(draft.detail.itemTbc ?? '')"
                :disabled="!bisaUbah"
                autoresize
                class="w-full"
                @update:model-value="draft.detail.itemTbc = String($event)"
              />
            </UFormField>
            <UFormField
              label="Data perusahaan untuk invoice + NPWP"
              class="lg:col-span-2"
            >
              <UTextarea
                size="lg"
                :model-value="String(draft.detail.npwp ?? '')"
                :disabled="!bisaUbah"
                autoresize
                class="w-full"
                @update:model-value="draft.detail.npwp = String($event)"
              />
            </UFormField>
            <UFormField label="Materai / kwitansi panjang">
              <AppPilihan
                :model-value="draft.detail.materai === undefined ? undefined : !!draft.detail.materai"
                :options="[{ value: true, label: 'Ya' }, { value: false, label: 'Tidak' }]"
                name="materai"
                @update:model-value="draft.detail.materai = $event"
              />
            </UFormField>
          </div>
        </AppPanel>
      </div>

      <div class="grid min-w-0 content-start gap-5">
        <AppPanel
          title="Riwayat Pembayaran"
          class="order-2 min-w-0"
        >
          <div
            v-if="!(draft.payments ?? []).length"
            class="py-4 text-center text-sm text-muted"
          >
            Belum ada pembayaran tercatat.
          </div>
          <ul
            v-else
            class="grid grid-cols-1 gap-2"
          >
            <li
              v-for="p in (draft.payments ?? [])"
              :key="String(p.id)"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-default p-2.5 text-sm"
            >
              <div class="min-w-0 flex-1">
                <p class="font-semibold">
                  {{ p.no }} · {{ p.type }} · {{ rupiah(+(p.amount ?? 0)) }}
                </p>
                <p class="text-xs text-muted">
                  {{ p.at }} · {{ p.method }}{{ p.receiptUrl ? ' · ada bukti' : ' · tanpa bukti' }}
                </p>
              </div>
              <UButton
                v-if="p.receiptUrl"
                color="neutral"
                variant="link"
                size="xs"
                class="px-0 text-xs text-primary-700 underline"
                @click="bukaBerkasMkt(kunciBerkasMkt(String(p.receiptUrl)))"
              >
                Bukti
              </UButton>
              <UButton
                v-if="bisaVerif"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah pembayaran"
                @click="bukaBayar(String(p.id))"
              />
              <UButton
                v-if="bisaVerif"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Hapus pembayaran"
                @click="hapusBayar(String(p.id))"
              />
            </li>
          </ul>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-if="bisaVerif"
              icon="i-lucide-banknote"
              label="Catat Pembayaran"
              @click="bukaBayar()"
            />
            <UButton
              icon="i-lucide-message-circle"
              color="neutral"
              variant="outline"
              label="Kirim Invoice"
              @click="kirimInvoice"
            />
            <UButton
              v-if="pakaiDp && uang.dp && uang.paid < uang.dp"
              icon="i-lucide-bell-ring"
              color="neutral"
              variant="outline"
              label="Reminder DP"
              @click="reminderDp"
            />
          </div>
          <UAlert
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="Perlu konfirmasi"
            :description="`Tarif PB1 ${settings.pb1}% + service ${settings.serviceCharge}% belum final.`"
            class="mt-3"
          />
        </AppPanel>
        <AppPanel
          title="Hitungan"
          class="order-1 min-w-0"
        >
          <!-- Money colours carry meaning (same tones as the stat cards above):
            green = money in or settled, coral = still owed, amber = overpaid,
            and the invoice pill reuses the page's invoice-status colours. -->
          <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-muted">
              Baris ditagih
            </dt>
            <dd class="num text-right">
              {{ rupiah(uang.sub) }}
            </dd>
            <template v-if="uang.disc">
              <dt class="text-muted">
                Discount
              </dt>
              <dd class="num text-right text-success">
                − {{ rupiah(uang.disc) }}
              </dd>
            </template>
            <dt class="text-muted">
              Service Charge
            </dt>
            <dd class="num text-right">
              {{ rupiah(uang.service) }}
            </dd>
            <dt class="text-muted">
              PB1 {{ uang.taxPct }}%{{ uang.taxInc ? ' (termasuk)' : '' }}
            </dt>
            <dd class="num text-right">
              {{ rupiah(uang.tax) }}
            </dd>
            <dt class="font-semibold">
              Grand total
            </dt>
            <dd class="num text-right font-bold">
              {{ rupiah(uang.grand) }}
            </dd>
            <dt class="text-muted">
              {{ dpLabel(uang) }}
            </dt>
            <dd class="num text-right">
              {{ rupiah(uang.dp) }}
            </dd>
            <dt class="text-muted">
              Terbayar
            </dt>
            <dd class="num text-right font-medium text-success">
              {{ rupiah(uang.paid) }}
            </dd>
            <dt class="text-muted">
              Sisa
            </dt>
            <dd
              class="num text-right font-semibold"
              :class="uang.remaining > 0 ? 'text-error' : 'text-success'"
            >
              {{ rupiah(uang.remaining) }}
            </dd>
            <template v-if="kelebihan">
              <dt class="text-muted">
                Kelebihan
              </dt>
              <dd class="num text-right text-warning">
                {{ rupiah(kelebihan) }}
              </dd>
            </template>
            <dt class="text-muted">
              Status invoice
            </dt>
            <dd class="text-right">
              <AppStatus
                :color="warnaInvoiceMkt(inv)"
                :icon="ikonInvoiceMkt(inv)"
                size="sm"
              >
                {{ inv }}
              </AppStatus>
            </dd>
          </dl>
          <UButton
            label="Pratinjau lembar tagihan"
            color="neutral"
            variant="outline"
            size="sm"
            class="mt-3 w-full"
            @click="pratinjau = true"
          />
        </AppPanel>
      </div>

      <AppPanel
        title="Invoice resmi"
        description="Nomor & lembar resmi diterbitkan Finance. Teks Kepada, U.P, dan Keterangan bisa diubah di sini."
      >
        <div
          v-if="!invResmiAda"
          class="text-sm text-muted"
        >
          Belum ada invoice resmi yang terbit untuk event ini — minta dulu dari layar Invoice &amp; Payment.
        </div>
        <div
          v-else
          class="flex flex-wrap gap-2"
        >
          <UButton
            v-if="invStat[resIdInvMkt(props.ev.id, 'dp')]?.status === 'DIBUAT'"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-file-text"
            label="PDF Invoice DP"
            loading-auto
            @click="bukaInvPdf('INV_DP')"
          />
          <UButton
            v-if="invStat[resIdInvMkt(props.ev.id, 'lunas')]?.status === 'DIBUAT'"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-file-text"
            label="PDF Pelunasan"
            loading-auto
            @click="bukaInvPdf('INV_LUNAS')"
          />
        </div>
      </AppPanel>
    </div>

    <ResponsiveSheet
      v-model:open="bayarBuka"
      :title="bayarId ? 'Ubah Pembayaran' : 'Catat Pembayaran'"
      :description="`${ev.nama} · ${namaClient}`"
    >
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jenis">
          <USelect
            v-model="bayar.type"
            size="lg"
            :items="JENIS_BAYAR_MKT"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jumlah (Rp)">
          <AppNominal
            v-model="bayar.amount"
            size="lg"
          />
        </UFormField>
        <UFormField label="Metode">
          <USelect
            v-model="bayar.method"
            size="lg"
            :items="['Transfer', 'Cash', 'QRIS', 'Card']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal">
          <AppTanggal
            v-model="bayar.at"
            size="lg"
          />
        </UFormField>
      </div>
      <dl class="mt-3 grid grid-cols-[1fr_auto] gap-1 text-sm">
        <dt class="text-muted">
          Grand total
        </dt>
        <dd class="num text-right">
          {{ rupiah(uang.grand) }}
        </dd>
        <dt class="text-muted">
          Sudah terbayar
        </dt>
        <dd class="num text-right">
          {{ rupiah(uang.paid) }}
        </dd>
        <dt class="font-semibold">
          Sisa sesudah pembayaran ini
        </dt>
        <dd
          class="num text-right font-bold"
          :class="sisaLive === 0 ? 'text-success' : ''"
        >
          {{ rupiah(sisaLive) }}
        </dd>
      </dl>
      <UFormField
        label="Bukti transfer (foto/PDF)"
        required
        class="mt-3"
      >
        <UInput
          size="lg"
          type="file"
          accept="image/*,application/pdf"
          @change="bayarBerkas = ($event.target as HTMLInputElement).files?.[0] ?? null"
        />
        <template #hint>
          <span v-if="buktiLama && !bayarBerkas">Sudah ada bukti tersimpan. Unggah berkas baru untuk mengganti.</span>
          <span v-else>Wajib — pembayaran ini muncul di halaman Dana Masuk milik kasir, dan yang tanpa lampiran tidak bisa dicocokkan dengan mutasi bank. Untuk Cash, foto kwitansi atau struknya. Maks 8MB.</span>
        </template>
      </UFormField>
      <UFormField
        label="Catatan"
        class="mt-3"
      >
        <UInput
          v-model="bayar.note"
          size="lg"
          placeholder="mis. transfer dari rek. BCA a.n. …"
        />
      </UFormField>
      <div class="mt-4 flex justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="bayarBuka = false"
        />
        <UButton
          :label="bayarId ? 'Simpan Perubahan' : 'Verifikasi & Simpan'"
          :loading="bayarSibuk"
          @click="simpanBayar"
        />
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="pratinjau"
      title="Pratinjau Lembar Tagihan"
      :description="`${ev.nama} · ${namaClient}`"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs tracking-wide text-muted uppercase">
            <th class="py-1 pr-2">
              Deskripsi
            </th>
            <th class="py-1 pr-2 text-right">
              Jumlah
            </th>
            <th class="py-1 pr-2 text-right">
              Harga
            </th>
            <th class="py-1 text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in barisTagih"
            :key="i"
            class="border-t border-default"
          >
            <td class="py-1 pr-2">
              {{ r.desc }}{{ (r.jenis || 'bayar') === 'free' ? ' (FREE)' : (r.jenis || 'bayar') === 'tbc' ? ' (TBC)' : '' }}
            </td>
            <td class="py-1 pr-2 text-right">
              {{ r.jumlah || '' }}
            </td>
            <td class="py-1 pr-2 text-right">
              {{ r.harga ? rupiah(+(r.harga || 0)) : '' }}
            </td>
            <td class="num py-1 text-right">
              {{ (r.jenis || 'bayar') === 'bayar' ? rupiah(totalBaris(r)) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
      <dl class="mt-2 grid grid-cols-[1fr_auto] gap-1 text-sm">
        <dt class="text-muted">
          Subtotal
        </dt>
        <dd class="num text-right">
          {{ rupiah(uang.sub) }}
        </dd>
        <dt class="font-semibold">
          Grand total
        </dt>
        <dd class="num text-right font-bold">
          {{ rupiah(uang.grand) }}
        </dd>
        <dt class="text-muted">
          Terbayar
        </dt>
        <dd class="num text-right">
          {{ rupiah(uang.paid) }}
        </dd>
        <dt class="text-muted">
          Sisa
        </dt>
        <dd class="num text-right">
          {{ rupiah(uang.remaining) }}
        </dd>
      </dl>
      <div class="mt-4 flex justify-end">
        <UButton
          icon="i-lucide-printer"
          label="Cetak"
          color="neutral"
          variant="outline"
          @click="cetak"
        />
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="invPdfBuka"
      title="Invoice resmi"
      :description="invPdf ? `${ev.nama} · ${invPdf.berkas.no}` : ''"
    >
      <template v-if="invPdf">
        <UAlert
          v-if="invPdf.berkas.materai"
          color="warning"
          variant="subtle"
          title="Bermaterai — lembar polos"
          description="Tanpa tanda tangan & cap digital; ditandatangani basah di atas materai."
          class="mb-3"
        />
        <div
          v-if="!invUbahMode"
          class="overflow-x-auto rounded-lg border border-default bg-white p-2"
        >
          <!-- eslint-disable vue/no-v-html -- lembar dibangun sendiri oleh invoiceHtml(), semua field di-escape di escSheet -->
          <div v-html="invLembarHtml" />
          <!-- eslint-enable vue/no-v-html -->
        </div>
        <div
          v-else
          class="grid grid-cols-1 gap-3"
        >
          <p class="text-sm text-muted">
            Yang bisa diubah cuma <b>teks</b> — Kepada, U.P, dan Keterangan tiap baris.
            Angka tetap dari rincian event. Kosongkan kotak untuk kembali ke isi bawaan.
          </p>
          <UFormField label="Kepada">
            <UInput
              v-model="invUbahKepada"
              size="lg"
              class="w-full"
              :placeholder="namaClient"
            />
          </UFormField>
          <UFormField label="U.P">
            <UInput
              v-model="invUbahUp"
              size="lg"
              class="w-full"
              :placeholder="namaClient"
            />
          </UFormField>
          <div v-if="(invLembar?.items ?? []).length">
            <p class="mb-1 text-sm font-semibold">
              Keterangan per baris
            </p>
            <div
              v-for="(it, i) in (invLembar?.items ?? [])"
              :key="i"
              class="mb-2 grid gap-1"
            >
              <UTextarea
                v-model="invUbahKet[i]"
                size="lg"
                :rows="1"
                class="w-full"
                :placeholder="String(it.desc ?? '')"
              />
              <p class="num text-right text-xs text-muted">
                {{ rupiah((Number(it.qty) || 1) * (Number(it.harga) || 0)) }}
              </p>
            </div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <UButton
            v-if="!invUbahMode && bisaUbah"
            icon="i-lucide-pen-line"
            label="Ubah Kepada / U.P / Keterangan"
            color="neutral"
            variant="outline"
            @click="invUbahMode = true"
          />
          <UButton
            v-if="invUbahMode"
            label="Simpan perubahan"
            :loading="invUbahSibuk"
            @click="simpanInvUbah"
          />
          <UButton
            v-if="invUbahMode"
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="invUbahMode = false"
          />
          <UButton
            v-if="!invUbahMode"
            icon="i-lucide-printer"
            label="Cetak"
            color="neutral"
            variant="outline"
            @click="cetak"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </div>
</template>
