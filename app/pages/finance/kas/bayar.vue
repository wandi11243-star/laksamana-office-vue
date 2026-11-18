<!--
  Finance › Kas Kecil › Planning Pembayaran (old `viewBayar` / `vBayar`, deploy/finance/kas/index.html:7550-7900).

  Layout as the old screen: four cards; the "Lembar pembayaran" panel — sheet
  date, "lembar berjalan" / "arsip" chips, the archive bar — with ONE entry row
  (Vendor · Keterangan · Kategori · Dibayar dari · Nominal · + Baris). Rows typed
  there are DRAFTS until "Simpan N baris" (one write for the whole stack, as the
  old sheet). Then the sheet grouped per paying account: a 9-column table,
  "Tandai N baris terbayar" per group, subtotal and the sheet total.

  The `bayar` list lives in the VAULT blob and is written narrowly
  (PUT /finance/petty-cash/payment-plan, one blob version). Rows are written in
  the OLD shape — {id, name, cat, amount, dari, vendor, batch, dueDate, note,
  status, bukti{ok, at, by}} — because the old Office and the Brankas panel
  (Jatuh Tempo reads `dueDate`) read these same rows. Rows an earlier Vue build
  wrote with `keterangan`/`kategori` are still read.

  The newest sheet date is the running one; older dates are archives (a sheet
  is never "closed" by a flag that can be forgotten). Adding to an archive asks
  first. Balances (G-06): vault saldo per wallet + kompas sales, as before.
  Vendors (G-02): typed against the Purchasing master; unknown names allowed and said.
-->
<script setup lang="ts">
import type { RencanaBayar } from '~/composables/useFinance'
import { getBayar, getWalletBalances, putBayar } from '~/composables/useFinance'
import { useKompasState } from '~/composables/useCashier'
import { listVendors, type VendorStock } from '~/composables/useStock'
import { useKasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { hariIni, tglLabel } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import {
  aktualPerGrup, bankDariTujuan, namaWallet, petaGrupWallet, SEMUA_WADAH, WADAH,
} from '~/utils/brankas'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'

definePageMeta({ access: ['finance'] })

const me = useMe()
const izin = useKasIzin()
const toast = useToast()

const BAYAR_KAT = ['Bahan baku', 'Minuman', 'Rokok', 'Gas & Utilitas', 'Jasa & Langganan', 'Sewa', 'Gaji', 'Pajak', 'Cicilan', 'Bagi hasil', 'Kas kecil', 'Lainnya']

const { data, status, error, refresh } = useAsyncData('kas-bayar', () => getBayar())

const { data: saldoData } = useAsyncData('kas-bayar-saldo', async () => {
  try {
    const r = await getWalletBalances()
    return { saldo: r.saldo, gagal: '' }
  }
  catch (e) {
    return { saldo: null, gagal: apiErrorMessage(e) }
  }
})
const kp = useKompasState()
const kompasData = computed(() => kp.error.value
  ? { state: null, gagal: true as boolean }
  : kp.status.value === 'success' ? { state: kp.data.value.value, gagal: false as boolean } : undefined)
const { data: vendorData } = useAsyncData('kas-bayar-vendor', async () => {
  try {
    const r = await listVendors()
    return { rows: r.rows, gagal: false as boolean }
  }
  catch {
    return { rows: [] as VendorStock[], gagal: true as boolean }
  }
})

const semua = computed<RencanaBayar[]>(() => data.value?.bayar ?? [])
const namaBaris = (p: RencanaBayar) => String(p.name ?? p.keterangan ?? '')
const katBaris = (p: RencanaBayar) => String(p.cat ?? p.kategori ?? '')

// ---- vendors (G-02): key is the NAME, never an id ----
const vendorGagal = computed(() => vendorData.value?.gagal === true)
const vendorRows = computed<VendorStock[]>(() => vendorData.value?.rows ?? [])
function vendorByNama(nama: unknown): VendorStock | null {
  const t = String(nama || '').trim().toLowerCase()
  if (!t) return null
  return vendorRows.value.find(v => String(v.nama || '').trim().toLowerCase() === t) ?? null
}
/** Empty payee means "same as the vendor name" — as printed on the old sheet. */
function vendorPenerima(v: VendorStock): string {
  return v.penerima || v.nama
}
function vendorBaris(p: RencanaBayar): string {
  return String((p.vendor ?? (p as Record<string, unknown>).vendorId) || '')
}

const OPSI_DARI = WADAH.map(w => ({ label: w.n, value: w.k as string }))
/** Group key for the per-rekening summary; empty counts as cash, as legacy. */
function kunciDari(dari: unknown): string {
  const s = String(dari || '').trim()
  if (!s) return 'cash'
  const kecil = s.toLowerCase()
  if ((SEMUA_WADAH as readonly string[]).includes(kecil)) return kecil
  const temu = WADAH.find(w => w.n.toLowerCase() === kecil)
  return temu ? (temu.k as string) : s
}

// ---- balances (G-06): vault half + kompas sales, same engine as Brankas ----
const vaultSaldo = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  for (const w of SEMUA_WADAH) out[w] = 0
  for (const b of saldoData.value?.saldo?.wallets ?? []) out[b.wallet] = num(b.saldo)
  return out
})
const saldoGagal = computed(() => !!saldoData.value?.gagal)
const kompas = computed(() => kompasData.value?.state ?? null)
const kompasGagal = computed(() => kompasData.value?.gagal === true)
const petaEfektif = computed(() => petaGrupWallet({ peta: (saldoData.value?.saldo?.peta ?? {}) as Record<string, unknown> }))
const aktualGrup = computed(() => aktualPerGrup({
  reports: (kompas.value?.reports ?? {}) as never,
  daily: (kompas.value?.daily ?? []) as never,
  piutang: (kompas.value?.piutang ?? []) as never,
}))
const masukWallet = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  for (const w of SEMUA_WADAH) out[w] = 0
  for (const g of Object.keys(aktualGrup.value)) {
    const w = petaEfektif.value[g]
    if (w && out[w] !== undefined) out[w]! += aktualGrup.value[g] ?? 0
  }
  return out
})
const setorWallet = computed<{ masuk: Record<string, number>, keluarCash: number }>(() => {
  const masuk: Record<string, number> = {}
  for (const w of SEMUA_WADAH) masuk[w] = 0
  let keluarCash = 0
  for (const st of ((kompas.value?.rekap_setoran ?? []) as { tujuan?: string, nominal?: unknown }[])) {
    const n = num(st.nominal)
    if (!n) continue
    const b = bankDariTujuan(st.tujuan)
    if (b && masuk[b] !== undefined) masuk[b]! += n
    keluarCash += n
  }
  return { masuk, keluarCash }
})
/** Final balance per wallet: vault half + kompas sales + cash deposits. */
const saldoAkhir = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  for (const w of SEMUA_WADAH) {
    out[w] = (vaultSaldo.value[w] ?? 0)
      + (masukWallet.value[w] ?? 0)
      + (setorWallet.value.masuk[w] ?? 0)
      - (w === 'cash' ? setorWallet.value.keluarCash : 0)
  }
  return out
})

// ---- sheets: newest date = running sheet, older = archive (`batchTgl`) ----
const tglAda = computed(() => [...new Set(semua.value.map(p => String(p.batch || '')).filter(Boolean))].sort((a, b) => (a < b ? 1 : -1)))
const lembarBaru = computed(() => tglAda.value[0] ?? '')
const arsip = computed(() => tglAda.value.slice(1))
const pilihan = ref<string | null>(null)
/** '' = the "belum masuk batch" list; a date = that sheet. */
const batchAktif = computed(() => (pilihan.value ?? lembarBaru.value))
const tglLembar = computed(() => batchAktif.value || lembarBaru.value || hariIni())
const diArsip = computed(() => !!batchAktif.value && batchAktif.value !== lembarBaru.value)
const paksaArsip = ref(false)
watch(batchAktif, () => {
  paksaArsip.value = false
})
const lepas = computed(() => semua.value.filter(p => !p.batch))
const isi = computed(() => semua.value.filter(p => p.batch === batchAktif.value))
const sisaLembar = (t: string) => semua.value.filter(p => p.batch === t && p.status !== 'paid').length
const pilihLembar = (t: string) => {
  pilihan.value = t
}

const totBatch = computed(() => isi.value.reduce((s, p) => s + num(p.amount), 0))
const sudah = computed(() => isi.value.filter(p => p.status === 'paid').reduce((s, p) => s + num(p.amount), 0))
const buktiAda = computed(() => isi.value.filter(p => p.bukti?.ok).length)

const judulDaftar = computed(() => (batchAktif.value ? `Pembayaran tgl ${tglLabel(batchAktif.value)}` : 'Belum Masuk Batch'))
const daftar = computed(() => (batchAktif.value ? isi.value : lepas.value))
const grup = computed(() => SEMUA_WADAH.map((w) => {
  const g = daftar.value.filter(p => kunciDari(p.dari) === w)
  return { w, g, sub: g.reduce((s, p) => s + num(p.amount), 0), belum: g.filter(p => p.status !== 'paid').length, saldo: saldoAkhir.value[w] ?? 0 }
}).filter(x => x.g.length))
const grandTotal = computed(() => grup.value.reduce((s, x) => s + x.sub, 0))
const lain = computed(() => daftar.value.filter(p => !SEMUA_WADAH.includes(kunciDari(p.dari))))

// ---- entry row + drafts (old QA + DRAF) ----
const qa = reactive({ vendor: '', name: '', cat: BAYAR_KAT[0]!, dari: 'cash', amount: 0 })
interface Draf { vendor: string, name: string, cat: string, dari: string, amount: number }
const draf = ref<Draf[]>([])
const drafTotal = computed(() => draf.value.reduce((s, r) => s + r.amount, 0))
const infoVendor = computed(() => {
  const t = qa.vendor.trim()
  if (!t) return { warn: false, teks: 'Tanpa vendor — mis. isi kas kecil atau biaya admin.' }
  const v = vendorByNama(t)
  if (!v) return { warn: true, teks: `${t} belum ada di master Purchasing. Barisnya tetap bisa dicatat, tapi yang mentransfer harus mencari rekeningnya sendiri.` }
  if (!v.norek) return { warn: true, teks: `${v.nama} belum punya nomor rekening. Lengkapi di Purchasing → Database & Vendor.` }
  return { warn: false, teks: `${vendorPenerima(v)} · ${v.bank || '—'} ${v.norek}` }
})
function tambahDraf() {
  if (!qa.name.trim()) {
    toast.add({ title: 'Keterangan wajib diisi.', color: 'error' })
    return
  }
  if (!qa.amount) {
    toast.add({ title: 'Nominal wajib diisi.', color: 'error' })
    return
  }
  // vendor kept AS TYPED: a near-miss is said above, never silently replaced
  draf.value.push({ vendor: qa.vendor.trim(), name: qa.name.trim(), cat: qa.cat, dari: qa.dari || 'cash', amount: qa.amount })
  qa.vendor = ''
  qa.name = ''
  qa.amount = 0
}

// ---- writes: the whole list, with the blob version ----
const sibuk = ref(false)
async function tulis(baru: RencanaBayar[], pesan: string): Promise<boolean> {
  if (!data.value || !izin.ubah('bayar') || sibuk.value) return false
  sibuk.value = true
  try {
    await putBayar(baru, data.value.version ?? '')
    toast.add({ title: pesan, color: 'success' })
    await refresh()
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
    return false
  }
  finally {
    sibuk.value = false
  }
}
const uid = () => `by${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
async function simpanDraf() {
  const b = tglLembar.value
  const baris: RencanaBayar[] = draf.value.map(r => ({
    id: uid(), name: r.name, cat: r.cat, amount: r.amount, dari: r.dari,
    vendor: r.vendor, batch: b, dueDate: b, note: '', status: 'scheduled', bukti: null as never,
  }))
  if (await tulis([...semua.value, ...baris], `${baris.length} baris masuk lembar ${tglLabel(b)}.`)) {
    draf.value = []
    pilihan.value = b
  }
}
const ganti = (id: string, ubah: (p: RencanaBayar) => RencanaBayar) => semua.value.map(p => (p.id === id ? ubah({ ...p }) : p))
const toggleBayar = (p: RencanaBayar) =>
  tulis(ganti(p.id, x => ({ ...x, status: x.status === 'paid' ? 'scheduled' : 'paid' })), 'Tersimpan.')
const tandaiBukti = (p: RencanaBayar) =>
  tulis(ganti(p.id, x => ({ ...x, bukti: { ok: true, at: hariIni(), by: me.value?.name ?? '' } })), 'Tersimpan.')

// one confirm sheet for delete / pay-a-group
const konfirm = ref<{ judul: string, isi: string, label: string, jalan: () => Promise<boolean> } | null>(null)
const konfirmOpen = ref(false)
function tanyaHapus(p: RencanaBayar) {
  konfirm.value = {
    judul: 'Hapus baris pembayaran ini?',
    isi: `${namaBaris(p)} · ${fmtRp(num(p.amount))}`,
    label: 'Ya, hapus',
    jalan: () => tulis(semua.value.filter(x => x.id !== p.id), 'Baris dihapus.'),
  }
  konfirmOpen.value = true
}
function tanyaBayarGrup(w: string) {
  const g = daftar.value.filter(p => kunciDari(p.dari) === w && p.status !== 'paid')
  if (!g.length) return
  const jml = g.reduce((s, p) => s + num(p.amount), 0)
  const sisa = (saldoAkhir.value[w] ?? 0) - jml
  const ids = new Set(g.map(p => p.id))
  konfirm.value = {
    judul: `Tandai ${g.length} baris di rekening ${namaWallet(w)} sebagai terbayar?`,
    isi: `Nilai: ${fmtRp(jml)} · Saldo sesudahnya: ${fmtRp(sisa)}${sisa < 0 ? ' — PERHATIAN: saldo jadi minus, uangnya tidak cukup.' : ''}`,
    label: 'Ya, tandai terbayar',
    jalan: () => tulis(semua.value.map(p => (ids.has(p.id) ? { ...p, status: 'paid' } : p)), `${g.length} baris ditandai terbayar.`),
  }
  konfirmOpen.value = true
}
async function jalanKonfirm() {
  if (konfirm.value && (await konfirm.value.jalan())) konfirmOpen.value = false
}
</script>

<template>
  <AppPage
    title="Planning pembayaran"
    description="Lembar transfer mingguan per rekening pembayar — pindah dari panel Brankas."
  >
    <UAlert
      v-if="!izin.lihat('bayar')"
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
      :title="`Lembar pembayaran tidak bisa dibaca: ${apiErrorMessage(error)}`"
      :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => refresh() }]"
    />
    <div
      v-else-if="status === 'pending' && !data"
      class="space-y-2"
    >
      <!-- Loading rows mirror the payment sheet below. -->
      <USkeleton
        v-for="i in 4"
        :key="i"
        class="h-12 w-full"
      />
      <p class="pt-1 text-sm text-muted">
        Memuat lembar pembayaran…
      </p>
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <UAlert
        v-if="vendorGagal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Master vendor dari Purchasing tidak terbaca."
        description="Baris tetap bisa dicatat, tapi nama penerima dan nomor rekeningnya tidak akan tampil."
      />
      <UAlert
        v-if="saldoGagal || kompasGagal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="saldoGagal ? `Saldo wallet tidak terbaca: ${saldoData?.gagal}` : 'Penjualan Kompas tidak terbaca — saldo per rekening di bawah hanya sisi brankas.'"
      />

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AppStat
          label="Nilai batch"
          :value="fmtRp(totBatch)"
          :sub="`${isi.length} baris pembayaran`"
        />
        <AppStat
          label="Sudah dibayar"
          :value="fmtRp(sudah)"
          :sub="`${totBatch ? Math.round((sudah / totBatch) * 100) : 0}% dari batch`"
          tone="success"
        />
        <AppStat
          label="Bukti TF"
          :value="`${buktiAda} / ${isi.length}`"
          sub="sudah ada buktinya"
        />
        <AppStat
          label="Belum masuk batch"
          :value="lepas.length"
          :sub="lepas.length ? 'perlu dijadwalkan' : 'semua sudah terjadwal'"
          :tone="lepas.length ? 'warning' : 'gold'"
        />
      </div>

      <!-- sheet picker + entry row + drafts -->
      <AppPanel>
        <div class="flex flex-wrap items-center gap-2.5">
          <b class="text-sm text-highlighted">Lembar pembayaran</b>
          <AppTanggal
            :model-value="tglLembar"
            size="sm"
            class="w-44"
            @update:model-value="(v: string) => pilihLembar(v)"
          />
          <AppStatus
            v-if="batchAktif && batchAktif === lembarBaru"
            color="success"
            size="sm"
          >
            lembar berjalan
          </AppStatus>
          <AppStatus
            v-if="diArsip"
            color="warning"
            size="sm"
          >
            arsip
          </AppStatus>
          <UButton
            v-if="lepas.length"
            :label="`belum masuk batch (${lepas.length})`"
            size="xs"
            :color="batchAktif === '' ? 'primary' : 'neutral'"
            :variant="batchAktif === '' ? 'solid' : 'outline'"
            @click="pilihLembar('')"
          />
        </div>
        <div
          v-if="arsip.length"
          class="mt-2.5 flex flex-wrap items-center gap-1.5"
        >
          <span class="me-1 text-xs text-muted">Arsip</span>
          <UButton
            v-for="t in arsip.slice(0, 8)"
            :key="t"
            :label="`${tglLabel(t)}${sisaLembar(t) ? ` · ${sisaLembar(t)} belum` : ''}`"
            size="xs"
            :color="t === batchAktif ? 'primary' : 'neutral'"
            :variant="t === batchAktif ? 'solid' : 'outline'"
            @click="pilihLembar(t)"
          />
          <span
            v-if="arsip.length > 8"
            class="text-xs text-muted"
          >+{{ arsip.length - 8 }} lagi</span>
        </div>

        <template v-if="izin.ubah('bayar')">
          <UAlert
            v-if="diArsip && !paksaArsip"
            color="info"
            variant="subtle"
            icon="i-lucide-archive"
            title="Lembar ini sudah diarsipkan."
            :description="`Baris baru dibuat di lembar berjalan ${tglLabel(lembarBaru)}. Bukti TF dan status bayar di lembar ini tetap bisa diubah.`"
            :actions="[
              { label: 'Buka lembar berjalan', color: 'neutral', variant: 'outline', onClick: () => pilihLembar(lembarBaru) },
              { label: 'Tetap tambah ke lembar ini', color: 'neutral', variant: 'ghost', onClick: () => { paksaArsip = true } },
            ]"
            class="mt-3"
          />
          <template v-else>
            <UAlert
              v-if="diArsip"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="`Baris berikutnya masuk ke lembar arsip ${tglLabel(batchAktif)}, bukan lembar berjalan.`"
              class="mt-3"
            />
            <datalist id="bayar-vendor-list">
              <option
                v-for="v in vendorRows"
                :key="v.nama"
                :value="v.nama"
              >
                {{ v.norek ? `${v.bank || ''} ${v.norek}` : 'belum ada rekening' }}
              </option>
            </datalist>
            <div class="mt-3 overflow-x-auto rounded-panel border border-default">
              <div class="grid min-w-[52rem] grid-cols-[1.3fr_2fr_1fr_1.2fr_1fr_auto] items-center text-sm">
                <div
                  v-for="h in ['Vendor', 'Keterangan', 'Kategori', 'Dibayar dari', 'Nominal', '']"
                  :key="h"
                  class="border-b border-default bg-muted px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted"
                  :class="h === 'Nominal' ? 'text-right' : ''"
                >
                  {{ h }}
                </div>
                <div class="px-2 py-2">
                  <UInput
                    v-model="qa.vendor"
                    list="bayar-vendor-list"
                    autocomplete="off"
                    placeholder="ketik nama vendor…"
                    class="w-full"
                    @keyup.enter="tambahDraf"
                  />
                </div>
                <div class="px-2 py-2">
                  <UInput
                    v-model="qa.name"
                    placeholder="mis. bahan baku 21 Agu"
                    class="w-full"
                    @keyup.enter="tambahDraf"
                  />
                </div>
                <div class="px-2 py-2">
                  <USelect
                    v-model="qa.cat"
                    :items="BAYAR_KAT"
                    class="w-full"
                  />
                </div>
                <div class="px-2 py-2">
                  <USelect
                    v-model="qa.dari"
                    :items="OPSI_DARI"
                    class="w-full"
                  />
                </div>
                <div
                  class="px-2 py-2"
                  @keyup.enter="tambahDraf"
                >
                  <RupiahInput v-model="qa.amount" />
                </div>
                <div class="px-2 py-2">
                  <UButton
                    label="Baris"
                    icon="i-lucide-plus"
                    @click="tambahDraf"
                  />
                </div>
                <div
                  class="col-span-6 border-t border-default px-3 py-2 text-xs"
                  :class="infoVendor.warn ? 'bg-warning/10 text-warning' : 'text-muted'"
                >
                  {{ infoVendor.teks }}
                </div>
                <template
                  v-for="(r, i) in draf"
                  :key="i"
                >
                  <div class="border-t border-default px-3 py-2">
                    <template v-if="r.vendor">
                      {{ r.vendor }}
                      <AppStatus
                        v-if="!vendorByNama(r.vendor) && !vendorGagal"
                        color="warning"
                        size="sm"
                      >
                        baru
                      </AppStatus>
                    </template>
                    <span
                      v-else
                      class="text-muted"
                    >tanpa vendor</span>
                  </div>
                  <div class="border-t border-default px-3 py-2">
                    {{ r.name }}
                  </div>
                  <div class="border-t border-default px-3 py-2 text-muted">
                    {{ r.cat }}
                  </div>
                  <div class="border-t border-default px-3 py-2">
                    {{ namaWallet(r.dari) }}
                  </div>
                  <div class="border-t border-default px-3 py-2 text-right num">
                    {{ fmtRp(r.amount) }}
                  </div>
                  <div class="border-t border-default px-3 py-2">
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Buang baris ini"
                      @click="draf.splice(i, 1)"
                    />
                  </div>
                </template>
              </div>
            </div>
            <template v-if="draf.length">
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <b class="text-sm">{{ draf.length }} baris belum disimpan</b>
                <span class="text-xs text-muted">total {{ fmtRp(drafTotal) }}</span>
                <div class="flex-1" />
                <UButton
                  label="Buang semua"
                  color="neutral"
                  variant="outline"
                  @click="draf = []"
                />
                <UButton
                  :label="`Simpan ${draf.length} baris ke lembar ${tglLabel(tglLembar)}`"
                  :loading="sibuk"
                  @click="simpanDraf"
                />
              </div>
              <p class="mt-1.5 text-xs text-muted">
                Baris di atas belum terkirim ke server — baru tersimpan setelah tombol <b>Simpan</b> ditekan.
              </p>
            </template>
          </template>
        </template>
      </AppPanel>

      <!-- the sheet, grouped per paying account -->
      <AppPanel
        :title="judulDaftar"
        description="Dikelompokkan menurut rekening yang membayar. Kelompoknya dihitung dari kolom Dibayar dari, bukan diketik — jadi baris tidak bisa nyasar ke kelompok yang salah."
      >
        <div
          v-if="!daftar.length"
          class="py-10 text-center text-sm text-muted"
        >
          <UIcon
            name="i-lucide-columns-2"
            class="mb-2 size-8 text-dimmed"
          />
          <p>Belum ada baris di {{ judulDaftar.toLowerCase() }}.</p>
        </div>
        <template v-else>
          <div
            v-for="x in grup"
            :key="x.w"
            class="mt-4 first:mt-0"
          >
            <div class="mb-2 flex flex-wrap items-baseline gap-2.5">
              <b class="text-sm text-highlighted">Rekening {{ namaWallet(x.w) }}</b>
              <span class="text-xs text-muted">{{ x.g.length }} baris · saldo {{ fmtRp(x.saldo) }}</span>
              <div class="flex-1" />
              <UButton
                v-if="x.belum && izin.ubah('bayar')"
                :label="`Tandai ${x.belum} baris terbayar`"
                size="xs"
                @click="tanyaBayarGrup(x.w)"
              />
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[58rem] text-sm">
                <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
                  <tr>
                    <th class="px-3 py-2 text-start">
                      #
                    </th>
                    <th class="px-3 py-2 text-start">
                      Keterangan
                    </th>
                    <th class="px-3 py-2 text-start">
                      Vendor
                    </th>
                    <th class="px-3 py-2 text-end">
                      Nominal
                    </th>
                    <th class="px-3 py-2 text-start">
                      Penerima
                    </th>
                    <th class="px-3 py-2 text-start">
                      Bank
                    </th>
                    <th class="px-3 py-2 text-start">
                      No. rekening
                    </th>
                    <th class="px-3 py-2 text-start">
                      Bukti TF
                    </th>
                    <th class="px-3 py-2" />
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="(p, i) in x.g"
                    :key="p.id"
                    :class="p.status === 'paid' ? 'opacity-60' : ''"
                  >
                    <td class="px-3 py-2 num">
                      {{ i + 1 }}
                    </td>
                    <td class="px-3 py-2">
                      <b class="text-highlighted">{{ namaBaris(p) }}</b>
                      <span
                        v-if="katBaris(p)"
                        class="block text-xs text-muted"
                      >{{ katBaris(p) }}</span>
                    </td>
                    <td class="px-3 py-2">
                      <template v-if="vendorBaris(p)">
                        {{ vendorBaris(p) }}
                        <AppStatus
                          v-if="!vendorByNama(vendorBaris(p)) && !vendorGagal"
                          color="warning"
                          size="sm"
                        >
                          tak ada di master
                        </AppStatus>
                      </template>
                      <span
                        v-else
                        class="text-dimmed"
                      >—</span>
                    </td>
                    <td class="px-3 py-2 text-end num">
                      {{ fmtRp(num(p.amount)) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ vendorByNama(vendorBaris(p)) ? vendorPenerima(vendorByNama(vendorBaris(p))!) : (p.penerima ? String(p.penerima) : '—') }}
                    </td>
                    <td class="px-3 py-2">
                      {{ vendorByNama(vendorBaris(p))?.bank || '—' }}
                    </td>
                    <td class="px-3 py-2 num">
                      <template v-if="vendorByNama(vendorBaris(p))?.norek">
                        {{ vendorByNama(vendorBaris(p))!.norek }}
                      </template>
                      <AppStatus
                        v-else
                        color="warning"
                        size="sm"
                      >
                        belum ada
                      </AppStatus>
                    </td>
                    <td class="px-3 py-2">
                      <template v-if="p.bukti?.ok">
                        <AppStatus
                          color="success"
                          icon="i-lucide-check"
                          size="sm"
                        >
                          ada
                        </AppStatus>
                        <span class="block text-[11px] text-muted">{{ p.bukti.by || '—' }} · {{ p.bukti.at ? tglLabel(String(p.bukti.at)) : '—' }}</span>
                      </template>
                      <UButton
                        v-else-if="izin.ubah('bayar')"
                        label="Tandai"
                        color="neutral"
                        variant="outline"
                        size="xs"
                        @click="tandaiBukti(p)"
                      />
                    </td>
                    <td class="px-3 py-2">
                      <div
                        v-if="izin.ubah('bayar')"
                        class="flex justify-end gap-1 whitespace-nowrap"
                      >
                        <UButton
                          :label="p.status === 'paid' ? 'Batal bayar' : 'Bayar'"
                          color="neutral"
                          variant="outline"
                          size="xs"
                          @click="toggleBayar(p)"
                        />
                        <UButton
                          label="Hapus"
                          color="error"
                          variant="soft"
                          size="xs"
                          @click="tanyaHapus(p)"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr class="font-semibold">
                    <td
                      colspan="3"
                      class="px-3 py-2"
                    >
                      Subtotal {{ namaWallet(x.w) }}
                    </td>
                    <td class="px-3 py-2 text-end num">
                      {{ fmtRp(x.sub) }}
                    </td>
                    <td colspan="5" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <UAlert
            v-if="lain.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`${lain.length} baris punya kolom Dibayar dari yang tidak dikenali (${[...new Set(lain.map(p => String(p.dari)))].join(', ')}).`"
            description="Barisnya tidak masuk kelompok rekening mana pun — betulkan Dibayar dari-nya di Office lama."
            class="mt-4"
          />
          <div class="mt-4 flex items-baseline justify-between border-t border-default pt-3">
            <b>Total lembar ini</b>
            <b class="text-lg num">{{ fmtRp(grandTotal) }}</b>
          </div>
        </template>
      </AppPanel>
    </div>

    <ResponsiveSheet
      v-model:open="konfirmOpen"
      :title="konfirm?.judul ?? ''"
    >
      <p class="text-sm">
        {{ konfirm?.isi }}
      </p>
      <template #footer>
        <UButton
          :label="konfirm?.label ?? 'Ya'"
          :color="konfirm?.label === 'Ya, hapus' ? 'error' : 'primary'"
          :loading="sibuk"
          @click="jalanKonfirm"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="konfirmOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
