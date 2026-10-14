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
const cetak = () => window.print()
const barisTagih = computed(() => {
  const rows = rinci.value.filter(r => String(r.desc ?? '').trim())
  return rows.map(r => ({ ...r, total: totalBaris(r) }))
})
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[1fr_22rem]">
    <div class="grid min-w-0 gap-5">
      <AppPanel title="Rincian Tagihan">
        <div class="grid gap-2">
          <div
            v-for="(r, i) in rinci"
            :key="i"
            class="grid gap-2 rounded-field border border-default p-2.5"
          >
            <UFormField label="Deskripsi">
              <UInput
                :model-value="String(r.desc ?? '')"
                :disabled="!bisaUbah"
                @update:model-value="ubahRinci(i, 'desc', String($event))"
              />
            </UFormField>
            <div class="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              <UFormField label="Jenis">
                <USelect
                  :model-value="String(r.jenis || 'bayar')"
                  :items="[{ value: 'bayar', label: 'Bayar' }, { value: 'free', label: 'Free' }, { value: 'tbc', label: 'TBC' }]"
                  value-key="value"
                  label-key="label"
                  :disabled="!bisaUbah"
                  @update:model-value="ubahRinci(i, 'jenis', String($event))"
                />
              </UFormField>
              <UFormField label="Jumlah">
                <UInput
                  :model-value="String(r.jumlah ?? '')"
                  inputmode="numeric"
                  :disabled="!bisaUbah || (r.jenis || 'bayar') !== 'bayar'"
                  @update:model-value="ubahRinci(i, 'jumlah', String($event))"
                />
              </UFormField>
              <UFormField label="Harga">
                <UInput
                  :model-value="String(r.harga ?? '')"
                  inputmode="numeric"
                  :disabled="!bisaUbah || (r.jenis || 'bayar') !== 'bayar'"
                  @update:model-value="ubahRinci(i, 'harga', String($event))"
                />
              </UFormField>
              <UButton
                v-if="bisaUbah"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                aria-label="Hapus baris"
                @click="hapusRinci(i)"
              />
            </div>
            <p class="text-right text-sm">
              <span class="text-muted">Total </span>
              <b class="num">{{ (r.jenis || 'bayar') === 'bayar' ? rupiah(totalBaris(r)) : r.jenis === 'free' ? 'FREE' : 'TBC' }}</b>
            </p>
          </div>
          <div
            v-if="bisaUbah"
            class="flex flex-wrap gap-2"
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
        </div>
      </AppPanel>

      <AppPanel title="Ketentuan">
        <div class="grid gap-3 lg:grid-cols-2">
          <UFormField label="Discount (Rp)">
            <UInput
              :model-value="String(draft.detail.diskon ?? '')"
              inputmode="numeric"
              :disabled="!bisaUbah"
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
            <UInput
              :model-value="String(draft.detail.depositNominal ?? '')"
              inputmode="numeric"
              :disabled="!bisaUbah"
              @update:model-value="draft.detail.depositNominal = String($event).replace(/\D/g, '') === '' ? '' : +String($event).replace(/\D/g, '')"
            />
          </UFormField>
          <UFormField label="Masuk ke rekening">
            <USelect
              :model-value="String(draft.detail.dpRek ?? '')"
              :items="REKENING_MKT"
              :disabled="!bisaUbah"
              placeholder="Pilih…"
              class="w-full"
              @update:model-value="draft.detail.dpRek = String($event)"
            />
          </UFormField>
          <UFormField label="Tanggal transfer">
            <UInput
              :model-value="String(draft.detail.dpTgl ?? '')"
              type="date"
              :disabled="!bisaUbah"
              @update:model-value="draft.detail.dpTgl = String($event)"
            />
          </UFormField>
          <div class="lg:col-span-2">
            <UFormField label="Bukti transfer">
              <div class="grid gap-2">
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
                  type="file"
                  accept="image/*,application/pdf"
                  :disabled="mengunggahDp"
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
              :model-value="String(draft.detail.itemFree ?? '')"
              :disabled="!bisaUbah"
              autoresize
              @update:model-value="draft.detail.itemFree = String($event)"
            />
          </UFormField>
          <UFormField
            label="Item belum pasti harganya (TBC)"
            class="lg:col-span-2"
          >
            <UTextarea
              :model-value="String(draft.detail.itemTbc ?? '')"
              :disabled="!bisaUbah"
              autoresize
              @update:model-value="draft.detail.itemTbc = String($event)"
            />
          </UFormField>
          <UFormField
            label="Data perusahaan untuk invoice + NPWP"
            class="lg:col-span-2"
          >
            <UTextarea
              :model-value="String(draft.detail.npwp ?? '')"
              :disabled="!bisaUbah"
              autoresize
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

      <AppPanel title="Riwayat Pembayaran">
        <div
          v-if="!(draft.payments ?? []).length"
          class="py-4 text-center text-sm text-muted"
        >
          Belum ada pembayaran tercatat.
        </div>
        <ul
          v-else
          class="grid gap-2"
        >
          <li
            v-for="p in (draft.payments ?? [])"
            :key="String(p.id)"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field border border-default p-2.5 text-sm"
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
    </div>

    <div class="grid min-w-0 content-start gap-5">
      <AppPanel title="Hitungan">
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
            <dd class="num text-right">
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
          <dd class="num text-right">
            {{ rupiah(uang.paid) }}
          </dd>
          <dt class="text-muted">
            Sisa
          </dt>
          <dd class="num text-right font-semibold">
            {{ rupiah(uang.remaining) }}
          </dd>
          <template v-if="kelebihan">
            <dt class="text-muted">
              Kelebihan
            </dt>
            <dd class="num text-right">
              {{ rupiah(kelebihan) }}
            </dd>
          </template>
          <dt class="text-muted">
            Status invoice
          </dt>
          <dd class="text-right">
            {{ inv }}
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

    <ResponsiveSheet
      v-model:open="bayarBuka"
      :title="bayarId ? 'Ubah Pembayaran' : 'Catat Pembayaran'"
      :description="`${ev.nama} · ${namaClient}`"
    >
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jenis">
          <USelect
            v-model="bayar.type"
            :items="JENIS_BAYAR_MKT"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jumlah (Rp)">
          <UInput
            v-model="bayar.amount"
            inputmode="numeric"
          />
        </UFormField>
        <UFormField label="Metode">
          <USelect
            v-model="bayar.method"
            :items="['Transfer', 'Cash', 'QRIS', 'Card']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal">
          <UInput
            v-model="bayar.at"
            type="date"
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
  </div>
</template>
