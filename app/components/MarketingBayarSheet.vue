<!--
  Marketing › payments of one event, opened from the Invoice & Payment list
  (old addPayment / invBayarModal, deploy/marketing :10894 & :11140). Two
  views in one sheet: the payment history (edit / delete per row) and the
  Catat Pembayaran form. Unlike the event's Finance tab, which edits a draft,
  every action here is stored at once — like the old modal — with a
  versioned PATCH of the event's `payments` (409 reloads through mktSimpan).
  A third view adds an open-bill extra charge (detail.openBillTambah): it
  raises the grand total — the omset — and the balance owed, and is then
  paid through Catat Pembayaran like any other bill (owner request, Nov 2026).
-->
<script setup lang="ts">
import type { EventMkt, PembayaranMkt, SettingsMkt } from '~/utils/marketing'
import {
  JENIS_BAYAR_MKT, MAKS_BERKAS_MKT, bawaanBayarMkt, bayarBaruSahMkt, finPakaiDpMkt, noKwitansiMkt, seqBerikutMkt,
} from '~/utils/marketing-event'
import { eventFinance, tambahanOpenBillMkt, type TambahanOpenBillMkt } from '~/utils/marketing-uang'
import {
  berkasKeBase64, bukaBerkasMkt, getDokumenMkt, kunciBerkasMkt, mktSimpan, simpanDokumenMkt, tambalMkt,
  unggahBerkasMkt, urlBerkasMkt, versiDokumenMkt,
} from '~/composables/useMarketing'
import { hariIni, rupiah } from '~/utils/format'

const props = defineProps<{
  /** The event; null = closed. Pass the live row so its version stays current. */
  ev: EventMkt | null
  /** Which view the sheet opens on. */
  mode: 'catat' | 'riwayat' | 'tambahan'
  namaClient: string
  settings: SettingsMkt
  bisaVerif: boolean
  sayaNama: string
}>()
const emit = defineEmits<{ tutup: [] }>()
const toast = useToast()

const buka = computed({
  get: () => !!props.ev,
  set: (v) => {
    if (!v) emit('tutup')
  },
})
const uang = computed(() => (props.ev ? eventFinance(props.ev, props.settings) : null))
const daftar = computed<PembayaranMkt[]>(() => props.ev?.payments ?? [])

// ---- views ----
const tampilan = ref<'riwayat' | 'form' | 'tambahan'>('riwayat')
const ubahId = ref<string | null>(null)
const isian = ref({ type: 'DP', amount: '', method: 'Transfer', at: hariIni(), note: '' })
const berkas = ref<File | null>(null)
const sibuk = ref(false)

function bukaForm(id?: string) {
  const p = id ? daftar.value.find(x => x.id === id) : null
  const u = uang.value
  const bawaan = u
    ? bawaanBayarMkt(u, finPakaiDpMkt(props.ev as EventMkt))
    : { type: 'DP', amount: 0 }
  ubahId.value = id ?? null
  isian.value = {
    type: String(p?.type ?? bawaan.type),
    amount: String(p?.amount ?? (bawaan.amount || '')),
    method: String(p?.method ?? 'Transfer'),
    at: String(p?.at ?? hariIni()),
    note: String(p?.receipt ?? ''),
  }
  berkas.value = null
  tampilan.value = 'form'
}
watch(() => props.ev?.id, (id, lama) => {
  if (!id || id === lama) return
  if (props.mode === 'catat') bukaForm()
  else if (props.mode === 'tambahan') bukaTambahan()
  else tampilan.value = 'riwayat'
}, { immediate: true })

const lama = computed(() => (ubahId.value ? daftar.value.find(x => x.id === ubahId.value) ?? null : null))
const nominal = computed(() => +isian.value.amount.replace(/\D/g, '') || 0)
/** Balance after this payment, live while typing (old paySisaLive). */
const sisaLive = computed(() => {
  const u = uang.value
  if (!u) return 0
  const lamaNom = +(lama.value?.amount ?? 0) || 0
  return Math.max(0, u.grand - (u.paid - lamaNom) - nominal.value)
})

// ---- open-bill extras ----
const tambahan = computed(() => (props.ev ? tambahanOpenBillMkt(props.ev) : []))
const isiTambah = ref({ desc: '', nominal: '', at: hariIni() })
function bukaTambahan() {
  isiTambah.value = { desc: '', nominal: '', at: hariIni() }
  tampilan.value = 'tambahan'
}
async function simpanTambahan(daftarBaru: TambahanOpenBillMkt[], pesan: string, aksi: string, rinci: string) {
  const e = props.ev
  if (!e) return false
  return mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, { detail: { ...(e.detail ?? {}), openBillTambah: daftarBaru } }, e.updatedAt),
    pesan,
    { refType: 'event', refId: e.id, action: aksi, detail: rinci },
  )
}
async function tambahOpenBill() {
  const nom = +isiTambah.value.nominal.replace(/\D/g, '') || 0
  const desc = isiTambah.value.desc.trim()
  if (!desc || !nom) {
    toast.add({ title: 'Lengkapi tambahan', description: 'Keterangan dan nominal wajib diisi.', color: 'error' })
    return
  }
  const baris: TambahanOpenBillMkt = { id: `ob${Date.now().toString(36)}`, desc, nominal: nom, at: isiTambah.value.at || hariIni(), by: props.sayaNama }
  const ok = await simpanTambahan([...tambahan.value, baris], 'Tambahan open bill tercatat', 'Tambahan open bill', `${desc} · ${rupiah(nom)}`)
  if (!ok) return
  if (props.mode === 'tambahan') emit('tutup')
  else tampilan.value = 'riwayat'
}
async function hapusTambahan(t: TambahanOpenBillMkt) {
  if (!confirm(`Hapus tambahan open bill "${t.desc}" ${rupiah(+t.nominal || 0)}? Grand Total event ikut turun.`)) return
  await simpanTambahan(tambahan.value.filter(x => x.id !== t.id), 'Tambahan open bill dihapus', 'Tambahan open bill dihapus', `${t.desc} · ${rupiah(+t.nominal || 0)}`)
}

/** Hand the kwitansi number out: bump the shared counter (same as the event page). */
async function majukanNomor() {
  try {
    const dok = await getDokumenMkt('settings')
    const kini = (dok.data ?? {}) as SettingsMkt
    await simpanDokumenMkt('settings', { ...kini, kwSeq: seqBerikutMkt(kini) }, versiDokumenMkt(dok))
  }
  catch {
    // Number already handed out; a repeated sequence is a cutover check, not a blocker.
  }
}

async function simpan() {
  const e = props.ev
  if (!e || !props.bisaVerif) return
  const amt = nominal.value
  if (!amt) {
    toast.add({ title: 'Isi jumlah', description: 'Jumlah pembayaran wajib.', color: 'error' })
    return
  }
  const sah = bayarBaruSahMkt(!!berkas.value, !!lama.value?.receiptUrl, !lama.value)
  if (sah === 'wajib') {
    toast.add({ title: 'Bukti transfer wajib', description: 'Unggah foto struk atau PDF-nya. Untuk Cash, foto kwitansinya.', color: 'error' })
    return
  }
  if (sah === 'tanya' && !confirm('Pembayaran ini tercatat tanpa bukti transfer — dari sebelum buktinya diwajibkan.\n\nSebaiknya dilengkapi sekarang selagi formnya terbuka. Simpan tanpa bukti?')) return
  sibuk.value = true
  try {
    let receiptUrl = String(lama.value?.receiptUrl ?? '')
    let receiptName = isian.value.note.trim()
    if (berkas.value) {
      const f = berkas.value
      if (f.size > MAKS_BERKAS_MKT) {
        toast.add({ title: 'File terlalu besar', description: 'Bukti transfer maksimal 8MB.', color: 'error' })
        return
      }
      const r = await unggahBerkasMkt({ dataBase64: await berkasKeBase64(f), fileName: f.name, mimeType: f.type || 'application/octet-stream' })
      if (!r.data?.key) throw new Error('Bukti transfer gagal diunggah')
      receiptUrl = urlBerkasMkt(r.data.key)
      if (!receiptName) receiptName = r.data.name || f.name
    }
    const isi = { type: isian.value.type, amount: amt, method: isian.value.method, at: isian.value.at, receipt: receiptName, receiptUrl }
    const baru: PembayaranMkt | null = lama.value
      ? null
      : { id: `p${Date.now().toString(36)}`, no: noKwitansiMkt(props.settings), ...isi, verified: true, by: props.sayaNama }
    const semua = baru
      ? [...daftar.value, baru]
      : daftar.value.map(x => (x.id === ubahId.value ? { ...x, ...isi } : x))
    const no = baru?.no ?? lama.value?.no ?? ''
    const ok = await mktSimpan(
      () => tambalMkt<EventMkt>('events', e.id, { payments: semua }, e.updatedAt),
      baru ? 'Pembayaran tercatat' : 'Pembayaran diperbarui',
      { refType: 'event', refId: e.id, action: baru ? 'Pembayaran diverifikasi' : 'Pembayaran diedit', detail: `${no} · ${isi.type} ${rupiah(amt)}` },
    )
    if (!ok) return
    if (baru) await majukanNomor()
    if (props.mode === 'catat' && baru) emit('tutup')
    else tampilan.value = 'riwayat'
  }
  catch (err) {
    toast.add({ title: 'Gagal menyimpan pembayaran', description: apiErrorMessage(err), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapus(p: PembayaranMkt) {
  const e = props.ev
  if (!e || !props.bisaVerif) return
  if (!confirm(`Hapus pembayaran ${p.no ?? ''} · ${p.type} ${rupiah(+(p.amount ?? 0))}? Tindakan ini tidak bisa dibatalkan.${p.dariDpForm ? '\n\nBaris ini lahir dari centang "DP sudah dibayar" di tab Finance — centangnya ikut dilepas.' : ''}`)) return
  const patch: Partial<EventMkt> = { payments: daftar.value.filter(x => x.id !== p.id) }
  // The tick goes too, or the next Finance save would give the row back a new number.
  if (p.dariDpForm) patch.detail = { ...(e.detail ?? {}), dpPaid: false }
  await mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, patch, e.updatedAt),
    'Pembayaran dihapus',
    { refType: 'event', refId: e.id, action: 'Pembayaran dihapus', detail: `${p.no ?? ''} · ${p.type} ${rupiah(+(p.amount ?? 0))}` },
  )
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="buka"
    :title="tampilan === 'form' ? (ubahId ? 'Ubah Pembayaran' : 'Catat Pembayaran') : tampilan === 'tambahan' ? 'Tambahan Open Bill' : 'Pembayaran'"
    :description="ev ? `${ev.nama} · ${namaClient}` : ''"
    lebar="sedang"
  >
    <template v-if="ev && uang">
      <!-- ---- history ---- -->
      <template v-if="tampilan === 'riwayat'">
        <dl class="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-sm">
          <div>
            <dt class="text-xs text-muted">
              Grand total
            </dt>
            <dd class="num font-semibold">
              {{ rupiah(uang.grand) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Terbayar
            </dt>
            <dd class="num font-semibold text-success">
              {{ rupiah(uang.paid) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Sisa
            </dt>
            <dd
              class="num font-semibold"
              :class="uang.remaining ? 'text-warning' : 'text-success'"
            >
              {{ rupiah(uang.remaining) }}
            </dd>
          </div>
        </dl>
        <!-- Open-bill extras: billed on top of the offer, paid like the rest. -->
        <div class="mt-4 flex items-center gap-2">
          <h4 class="flex-1 text-sm font-semibold text-highlighted">
            Tambahan open bill
          </h4>
          <UButton
            v-if="bisaVerif"
            icon="i-lucide-plus"
            size="xs"
            color="neutral"
            variant="outline"
            label="Tambah"
            @click="bukaTambahan"
          />
        </div>
        <p
          v-if="!tambahan.length"
          class="mt-1 text-xs text-muted"
        >
          Belum ada tambahan di luar penawaran.
        </p>
        <ul
          v-else
          class="mt-2 grid grid-cols-1 gap-2"
        >
          <li
            v-for="t in tambahan"
            :key="t.id"
            class="flex items-center gap-3 rounded-xl border border-default p-3 text-sm"
          >
            <div class="min-w-0 flex-1">
              <p class="font-semibold break-words">
                {{ t.desc }} · <span class="num">{{ rupiah(+t.nominal || 0) }}</span>
              </p>
              <p class="text-xs text-muted">
                {{ t.at }}{{ t.by ? ` · ${t.by}` : '' }}
              </p>
            </div>
            <UTooltip
              v-if="bisaVerif"
              text="Hapus tambahan"
              :delay-duration="0"
            >
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                aria-label="Hapus tambahan"
                loading-auto
                @click="hapusTambahan(t)"
              />
            </UTooltip>
          </li>
        </ul>

        <h4 class="mt-4 text-sm font-semibold text-highlighted">
          Riwayat pembayaran
        </h4>
        <div
          v-if="!daftar.length"
          class="py-6 text-center text-sm text-muted"
        >
          Belum ada pembayaran tercatat.
        </div>
        <ul
          v-else
          class="mt-3 grid grid-cols-1 gap-2"
        >
          <li
            v-for="p in daftar"
            :key="String(p.id)"
            class="flex items-center gap-3 rounded-xl border border-default p-3 text-sm"
          >
            <div class="min-w-0 flex-1">
              <p class="font-semibold">
                {{ p.type }} · <span class="num">{{ rupiah(+(p.amount ?? 0)) }}</span>
              </p>
              <p class="text-xs text-muted">
                <span class="num">{{ p.no }}</span> · {{ p.at }} · {{ p.method }}{{ p.receiptUrl ? '' : ' · tanpa bukti' }}
              </p>
            </div>
            <UTooltip
              v-if="p.receiptUrl"
              text="Lihat bukti transfer"
              :delay-duration="0"
            >
              <UButton
                icon="i-lucide-paperclip"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Lihat bukti transfer"
                loading-auto
                @click="bukaBerkasMkt(kunciBerkasMkt(String(p.receiptUrl)))"
              />
            </UTooltip>
            <template v-if="bisaVerif">
              <UTooltip
                text="Ubah pembayaran"
                :delay-duration="0"
              >
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Ubah pembayaran"
                  @click="bukaForm(String(p.id))"
                />
              </UTooltip>
              <UTooltip
                text="Hapus pembayaran"
                :delay-duration="0"
              >
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  aria-label="Hapus pembayaran"
                  loading-auto
                  @click="hapus(p)"
                />
              </UTooltip>
            </template>
          </li>
        </ul>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Tutup"
            color="neutral"
            variant="ghost"
            @click="emit('tutup')"
          />
          <UButton
            v-if="bisaVerif"
            icon="i-lucide-banknote"
            label="Catat Pembayaran"
            @click="bukaForm()"
          />
        </div>
      </template>

      <!-- ---- open-bill extra ---- -->
      <template v-else-if="tampilan === 'tambahan'">
        <p class="text-sm text-muted">
          Pesanan di luar penawaran saat hari-H (open bill). Nominalnya menambah Grand Total — omset event — dan sisa tagihan; pembayarannya dicatat lewat Catat Pembayaran.
        </p>
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField
            label="Keterangan"
            required
            class="sm:col-span-2"
          >
            <UInput
              v-model="isiTambah.desc"
              size="lg"
              class="w-full"
              placeholder="mis. tambahan minuman 20 gelas"
            />
          </UFormField>
          <UFormField
            label="Nominal (Rp)"
            required
            hint="Nominal akhir, sudah termasuk pajak & service"
          >
            <AppNominal
              v-model="isiTambah.nominal"
              size="lg"
            />
          </UFormField>
          <UFormField label="Tanggal">
            <AppTanggal
              v-model="isiTambah.at"
              size="lg"
              :clearable="false"
            />
          </UFormField>
        </div>
        <dl class="mt-3 grid grid-cols-[1fr_auto] gap-1 rounded-xl bg-muted p-3 text-sm">
          <dt class="text-muted">
            Grand total sekarang
          </dt>
          <dd class="num text-right">
            {{ rupiah(uang.grand) }}
          </dd>
          <dt class="font-semibold">
            Grand total sesudah tambahan
          </dt>
          <dd class="num text-right font-bold">
            {{ rupiah(uang.grand + (+isiTambah.nominal.replace(/\D/g, '') || 0)) }}
          </dd>
          <dt class="text-muted">
            Sisa tagihan sesudah tambahan
          </dt>
          <dd class="num text-right">
            {{ rupiah(uang.remaining + (+isiTambah.nominal.replace(/\D/g, '') || 0)) }}
          </dd>
        </dl>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            :label="mode === 'tambahan' ? 'Batal' : 'Kembali'"
            color="neutral"
            variant="ghost"
            @click="mode === 'tambahan' ? emit('tutup') : (tampilan = 'riwayat')"
          />
          <UButton
            label="Simpan tambahan"
            loading-auto
            @click="tambahOpenBill"
          />
        </div>
      </template>

      <!-- ---- form ---- -->
      <template v-else>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Jenis">
            <USelect
              v-model="isian.type"
              size="lg"
              :items="JENIS_BAYAR_MKT"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jumlah (Rp)">
            <AppNominal
              v-model="isian.amount"
              size="lg"
            />
          </UFormField>
          <UFormField label="Metode">
            <USelect
              v-model="isian.method"
              size="lg"
              :items="['Transfer', 'Cash', 'QRIS', 'Card']"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tanggal">
            <AppTanggal
              v-model="isian.at"
              size="lg"
              :clearable="false"
            />
          </UFormField>
        </div>
        <dl class="mt-3 grid grid-cols-[1fr_auto] gap-1 rounded-xl bg-muted p-3 text-sm">
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
            {{ rupiah(uang.paid - (+(lama?.amount ?? 0) || 0)) }}
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
          :required="!lama?.receiptUrl"
          class="mt-3"
        >
          <UInput
            size="lg"
            type="file"
            accept="image/*,application/pdf"
            class="w-full"
            @change="berkas = ($event.target as HTMLInputElement).files?.[0] ?? null"
          />
          <template #hint>
            <span v-if="lama?.receiptUrl && !berkas">Sudah ada bukti tersimpan. Unggah berkas baru untuk mengganti.</span>
            <span v-else>Wajib — pembayaran ini muncul di Dana Masuk milik kasir. Untuk Cash, foto kwitansi atau struknya. Maks 8MB.</span>
          </template>
        </UFormField>
        <UFormField
          label="Catatan"
          class="mt-3"
        >
          <UInput
            v-model="isian.note"
            size="lg"
            class="w-full"
            placeholder="mis. transfer dari rek. BCA a.n. …"
          />
        </UFormField>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            :label="mode === 'riwayat' || ubahId ? 'Kembali' : 'Batal'"
            color="neutral"
            variant="ghost"
            @click="mode === 'riwayat' || ubahId ? (tampilan = 'riwayat') : emit('tutup')"
          />
          <UButton
            :label="ubahId ? 'Simpan perubahan' : 'Verifikasi & simpan'"
            :loading="sibuk"
            @click="simpan"
          />
        </div>
      </template>
    </template>
  </ResponsiveSheet>
</template>
