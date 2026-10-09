<!--
  Finance › Kas Kecil › Planning Pembayaran (old `viewBayar`, deploy/finance/kas/index.html:7057-7400).

  Weekly transfer sheets per paying account. The `bayar` list lives in the
  VAULT blob but this panel writes it narrowly (`bayarSave` → PUT payment-plan);
  the rest of the vault is untouched.

  Balances (G-06): vault-side saldo per wallet comes from
  `GET /finance/petty-cash/wallet-balances`; kompas sales are added
  client-side from kompas state with the same engine as the Brankas panel,
  as the old page does (`saldoSemua`, kas:6985-7060).

  Vendors (G-02): the Vendor box types against the Purchasing master
  (`GET /stock/vendors`, also open to `bd`/`brankas`); unknown names stay
  allowed and are marked, and a dead master never kills the page — only the
  payee name & account number depend on it (kas:7065-7073, brankas:898-908).
  Proof uploads stay out of this screen.
-->
<script setup lang="ts">
import type { RencanaBayar } from '~/composables/useFinance'
import { getBayar, getWalletBalances, putBayar } from '~/composables/useFinance'
import { getKompasState } from '~/composables/useCashier'
import { listVendors, type VendorStock } from '~/composables/useStock'
import { useKasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import {
  aktualPerGrup, bankDariTujuan, namaWallet, petaGrupWallet, SEMUA_WADAH, WADAH,
} from '~/utils/brankas'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()

const BAYAR_KAT = ['Bahan baku', 'Minuman', 'Rokok', 'Gas & Utilitas', 'Jasa & Langganan', 'Sewa', 'Gaji', 'Pajak', 'Cicilan', 'Bagi hasil', 'Kas kecil', 'Lainnya']

const { data, error, refresh } = useAsyncData('kas-bayar', () => getBayar())

// Vault-side wallet balances (G-06). A failure never kills the page: the
// plan still edits and saves, only the balances stay hidden.
const { data: saldoData } = useAsyncData('kas-bayar-saldo', async () => {
  try {
    const r = await getWalletBalances()
    return { saldo: r.saldo, gagal: '' }
  }
  catch (e) {
    return { saldo: null, gagal: apiErrorMessage(e) }
  }
})

// Kompas sales are added client-side, as the old page does. Without them the
// balances below read vault-only, and that is said on the screen.
const { data: kompasData } = useAsyncData('kas-bayar-kompas', async () => {
  try {
    return { state: (await getKompasState()).value, gagal: false as boolean }
  }
  catch {
    return { state: null, gagal: true as boolean }
  }
})

// Purchasing vendor master (G-02). Null = not loaded yet or failed; the page
// keeps working and says so — only payee names & account numbers need it.
const { data: vendorData } = useAsyncData('kas-bayar-vendor', async () => {
  try {
    const r = await listVendors()
    return { rows: r.rows, gagal: false as boolean }
  }
  catch {
    return { rows: [] as VendorStock[], gagal: true as boolean }
  }
})

const rows = ref<RencanaBayar[]>([])
const kotor = ref(false)
watch(data, () => {
  rows.value = (data.value?.bayar ?? []).map(r => ({ ...r }))
  kotor.value = false
}, { immediate: true })

const batchTerpilih = ref('berjalan')
const batches = computed(() => [...new Set(rows.value.map(r => String(r.batch || '')).filter(Boolean))].sort())
const batchAktif = computed(() => (batchTerpilih.value === 'berjalan' ? hariIni() : batchTerpilih.value))
const tampil = computed(() => rows.value.filter(r => String(r.batch || '') === batchAktif.value))
const tanpaBatch = computed(() => rows.value.filter(r => !r.batch))

const totBatch = computed(() => tampil.value.reduce((s, r) => s + num(r.amount), 0))
const sudah = computed(() => tampil.value.filter(r => r.status === 'paid').reduce((s, r) => s + num(r.amount), 0))
const buktiAda = computed(() => tampil.value.filter(r => r.bukti?.ok).length)

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

// ---- wallet select follows the old sheet: five wallets, no free text ----
// Reka UI rejects `value: ''` (SelectItem setup crash), so the placeholder
// uses a sentinel mapped back to `''` on write.
const DARI_KOSONG = '__pilih'
const opsiDariDasar = WADAH.map(w => ({ label: w.n, value: w.k as string }))
/** Existing custom text is kept as its own option so saving never drops it. */
function opsiDariUntuk(dari: unknown) {
  const s = String(dari || '')
  if (!s || opsiDariDasar.some(o => o.value === s)) return opsiDariDasar
  return [...opsiDariDasar, { label: `${s} (lama)`, value: s }]
}
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
const totalSaldo = computed(() => SEMUA_WADAH.reduce((s, k) => s + (saldoAkhir.value[k] ?? 0), 0))
const nHariKompas = computed(() => Object.keys(kompas.value?.reports ?? {}).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t)).length)

const grupRingkasan = computed(() => SEMUA_WADAH.map((k) => {
  const baris = tampil.value.filter(r => kunciDari(r.dari) === k)
  const sub = baris.reduce((s, r) => s + num(r.amount), 0)
  const belum = baris.filter(r => r.status !== 'paid').length
  return { k, baris, sub, belum, saldo: saldoAkhir.value[k] ?? 0 }
}))
const lainBaris = computed(() => tampil.value.filter(r => !(SEMUA_WADAH as readonly string[]).includes(kunciDari(r.dari))))

function barisBaru() {
  rows.value.push({ id: `baru-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`, batch: batchAktif.value, kategori: BAYAR_KAT[0], status: 'scheduled', amount: 0, vendor: '', keterangan: '', dari: '' })
  kotor.value = true
}
function buang(r: RencanaBayar) {
  rows.value = rows.value.filter(x => x.id !== r.id)
  kotor.value = true
}
const set = (r: RencanaBayar, k: string, v: unknown) => {
  r[k] = v
  kotor.value = true
}

const sibuk = ref(false)
async function simpan() {
  if (!data.value || !izin.ubah('bayar') || sibuk.value) return
  sibuk.value = true
  try {
    await putBayar(rows.value.map(r => ({ ...r, amount: num(r.amount) })), data.value.version ?? '')
    kotor.value = false
    toast.add({ title: 'Lembar pembayaran disimpan.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
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
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Nilai batch"
          icon="i-lucide-banknote"
          :value="fmtRp(totBatch)"
          :sub="`${tampil.length} baris di lembar ${batchAktif}`"
        />
        <AppStat
          label="Sudah dibayar"
          icon="i-lucide-check"
          :value="fmtRp(sudah)"
          :sub="`${tampil.filter(r => r.status === 'paid').length} baris`"
          tone="success"
        />
        <AppStat
          label="Bukti TF"
          icon="i-lucide-paperclip"
          :value="`${buktiAda} / ${tampil.length}`"
          sub="baris ber-bukti"
        />
        <AppStat
          label="Belum masuk batch"
          icon="i-lucide-inbox"
          :value="tanpaBatch.length"
          sub="baris tanpa tanggal lembar"
          :tone="tanpaBatch.length ? 'warning' : undefined"
        />
      </AppStatGrid>

      <UAlert
        v-if="vendorGagal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        title="Master vendor dari Purchasing tidak terbaca."
        description="Baris tetap bisa dicatat, tapi nama penerima dan nomor rekeningnya tidak akan tampil."
      />
      <UAlert
        v-if="saldoGagal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        :title="`Saldo wallet tidak terbaca: ${saldoData?.gagal}`"
        description="Lembar tetap bisa diisi dan disimpan; saldonya menyusul setelah server bisa dihubungi."
      />

      <AppPanel
        title="Saldo wallet"
        :description="kompas && !kompasGagal
          ? `Vault + penjualan kompas (${nHariKompas} hari tercatat). Yang terjadwal belum mengurangi — hanya yang sudah dibayar.`
          : 'Penjualan kompas belum terbaca, jadi saldo di bawah hanya sisi vault.'"
        flush
      >
        <div
          v-if="saldoGagal"
          class="px-4 py-6 text-center text-sm text-muted lg:px-5"
        >
          Saldo belum bisa dihitung.
        </div>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="k in SEMUA_WADAH"
            :key="k"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
          >
            <b class="text-highlighted">{{ namaWallet(k) }}</b>
            <b class="num">{{ fmtRp(saldoAkhir[k] ?? 0) }}</b>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm lg:px-5">
            <b class="text-highlighted">Total</b>
            <b class="num">{{ fmtRp(totalSaldo) }}</b>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Lembar pembayaran"
        :description="`${tampil.length} baris · total ${fmtRp(totBatch)}. Pilih lembar per tanggal; arsip lembar lain tetap tersimpan.`"
        flush
      >
        <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3 lg:px-5">
          <USelect
            v-model="batchTerpilih"
            :items="[{ label: `Lembar ${hariIni()} (berjalan)`, value: 'berjalan' }, ...batches.filter(b => b !== hariIni()).map(b => ({ label: `Lembar ${b}`, value: b }))]"
            size="sm"
            class="w-56"
          />
          <UButton
            v-if="izin.ubah('bayar')"
            label="+ Baris"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="barisBaru"
          />
          <div class="flex-1" />
          <UButton
            v-if="izin.ubah('bayar')"
            label="Simpan lembar"
            icon="i-lucide-save"
            size="sm"
            :disabled="!kotor"
            :loading="sibuk"
            @click="simpan"
          />
        </div>

        <datalist id="bayar-vendor-list">
          <option
            v-for="v in vendorRows"
            :key="v.nama"
            :value="v.nama"
          >
            {{ v.bank || '' }} {{ v.norek || '' }}
          </option>
        </datalist>

        <div class="divide-y divide-default">
          <div
            v-for="r in tampil"
            :key="r.id"
            class="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end lg:px-5"
          >
            <UFormField label="Vendor / penerima">
              <UInput
                :model-value="String(vendorBaris(r))"
                list="bayar-vendor-list"
                autocomplete="off"
                placeholder="ketik nama vendor…"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'vendor', v)"
              />
              <template #hint>
                <span v-if="vendorGagal">Daftar vendor belum terbaca — namanya tetap bisa diketik.</span>
                <span v-else-if="!String(vendorBaris(r)).trim()">Tanpa vendor — mis. isi kas kecil atau biaya admin.</span>
                <span v-else-if="vendorByNama(vendorBaris(r))">
                  {{ vendorPenerima(vendorByNama(vendorBaris(r))!) }}{{ vendorByNama(vendorBaris(r))!.bank ? ` · ${vendorByNama(vendorBaris(r))!.bank}` : '' }}{{ vendorByNama(vendorBaris(r))!.norek ? ` ${vendorByNama(vendorBaris(r))!.norek}` : ' · belum ada rekening' }}
                </span>
                <span
                  v-else
                  class="text-warning"
                >{{ String(vendorBaris(r)).trim() }} belum ada di master Purchasing. Tetap bisa disimpan.</span>
              </template>
            </UFormField>
            <UFormField
              label="Keterangan"
              class="lg:col-span-2"
            >
              <UInput
                :model-value="String(r.keterangan || '')"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'keterangan', v)"
              />
            </UFormField>
            <UFormField label="Kategori">
              <USelect
                :model-value="String(r.kategori || BAYAR_KAT[0])"
                :items="BAYAR_KAT.map(k => ({ label: k, value: k }))"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string) => set(r, 'kategori', v)"
              />
            </UFormField>
            <UFormField label="Dibayar dari">
              <USelect
                :model-value="String(r.dari || DARI_KOSONG)"
                :items="[{ label: 'Pilih wallet…', value: DARI_KOSONG }, ...opsiDariUntuk(r.dari)]"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string) => set(r, 'dari', v === DARI_KOSONG ? '' : v)"
              />
            </UFormField>
            <UFormField label="Nominal">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-full"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <div class="flex flex-wrap items-center gap-3 pb-1">
              <UCheckbox
                :model-value="r.status === 'paid'"
                label="Sudah dibayar"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'status', v === true ? 'paid' : 'scheduled')"
              />
              <UCheckbox
                :model-value="!!r.bukti?.ok"
                label="Bukti TF"
                :disabled="!izin.ubah('bayar')"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'bukti', { ok: v === true })"
              />
              <UButton
                v-if="izin.ubah('bayar')"
                label="Buang"
                color="error"
                variant="ghost"
                size="xs"
                @click="buang(r)"
              />
            </div>
            <div
              v-if="String(vendorBaris(r)).trim() && !vendorByNama(vendorBaris(r)) && !vendorGagal"
              class="sm:col-span-2 lg:col-span-6"
            >
              <AppStatus
                color="warning"
                size="sm"
              >
                tak ada di master
              </AppStatus>
            </div>
          </div>
          <p
            v-if="!tampil.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada baris di lembar ini. Tambah baris lewat tombol di atas.
          </p>
        </div>
      </AppPanel>

      <AppPanel
        title="Per rekening"
        description="Dikelompokkan menurut rekening yang membayar, seperti lembar lama — kelompoknya dihitung dari kolom Dibayar dari."
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="g in grupRingkasan"
            :key="g.k"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
          >
            <span class="min-w-0">
              <b class="text-highlighted">Rekening {{ namaWallet(g.k) }}</b>
              <span class="block text-[12px] text-muted">{{ g.baris.length }} baris · saldo {{ fmtRp(g.saldo) }}</span>
            </span>
            <b class="num">{{ fmtRp(g.sub) }}</b>
          </div>
          <div
            v-if="lainBaris.length"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
          >
            <span class="min-w-0">
              <b class="text-highlighted">Tanpa wallet jelas</b>
              <span class="block text-[12px] text-muted">{{ lainBaris.length }} baris · pilih walletnya di lembar</span>
            </span>
            <b class="num">{{ fmtRp(lainBaris.reduce((s, r) => s + num(r.amount), 0)) }}</b>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        v-if="tanpaBatch.length"
        title="Baris tanpa lembar"
        :count="tanpaBatch.length"
        description="Baris lama yang belum punya tanggal batch — pindahkan dengan mengisi batch-nya sebelum menyimpan."
      >
        <div class="divide-y divide-default">
          <div
            v-for="r in tanpaBatch"
            :key="r.id"
            class="flex flex-wrap items-center gap-3 py-2 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">{{ vendorBaris(r) || '(tanpa penerima)' }} — {{ r.keterangan || '—' }}</span>
            <b class="num">{{ fmtRp(num(r.amount)) }}</b>
            <UButton
              v-if="izin.ubah('bayar')"
              label="Masukkan lembar ini"
              size="xs"
              color="neutral"
              variant="outline"
              @click="set(r, 'batch', batchAktif)"
            />
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
