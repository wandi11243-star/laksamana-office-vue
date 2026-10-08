<!--
  Finance › Brankas › Pengembalian Modal (old `vModal`, deploy/finance/brankas/index.html:1632-1794).

  Capital progress per investor. Total capital = opening capital + every later
  top-up (`modalTotal`); repayments name their source wallet — rows hanging
  without one are REPORTED, never guessed, or the wallet balances read larger
  than reality. Investor records are written per record against the
  whole-blob version; conflicts reload, never retry.
-->
<script setup lang="ts">
import { createVaultRec, deleteVaultRec, getVault, updateVaultRec } from '~/composables/useFinance'
import { useBrankasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { fTgl, hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import type { InvestorBrankas } from '~/utils/brankas'
import { modalTanpaWadah, modalTotal, namaWallet, SEMUA_WADAH } from '~/utils/brankas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()
const toast = useToast()

const { data: vaultData, error, refresh } = useAsyncData('brankas-vault', () => getVault())
const daftar = computed<InvestorBrankas[]>(() => ((vault.value.investor ?? []) as InvestorBrankas[]).slice())
const vault = computed(() => vaultData.value?.vault ?? {})

const modal = computed(() => daftar.value.reduce((s, i) => s + modalTotal(i), 0))
const kembali = computed(() => daftar.value.reduce((s, i) => s + (i.returns ?? []).reduce((x, r) => x + num(r.amount), 0), 0))
const gantung = computed(() => modalTanpaWadah(daftar.value))
const gantungTotal = computed(() => gantung.value.reduce((s, x) => s + num(x.r.amount), 0))

const kembaliOf = (i: InvestorBrankas) => (i.returns ?? []).reduce((s, r) => s + num(r.amount), 0)
const persenOf = (i: InvestorBrankas) => {
  const t = modalTotal(i)
  return t > 0 ? Math.min(kembaliOf(i) / t * 100, 100) : 0
}
const retUrut = (i: InvestorBrankas) => (i.returns ?? []).slice().sort((a, b) => String(b.date) < String(a.date) ? -1 : 1)
const tmUrut = (i: InvestorBrankas) => (i.tambahan ?? []).slice().sort((a, b) => String(b.date) < String(a.date) ? -1 : 1)

// ---- investor form (same form edits) ----
const ivSunting = ref<string | null>(null)
const ivForm = reactive({ nama: '', modal: '', milik: '', target: '' })
function ivBaru() {
  ivSunting.value = null
  ivForm.nama = ''
  ivForm.modal = ''
  ivForm.milik = ''
  ivForm.target = ''
}
function ivMulaiSunting(i: InvestorBrankas) {
  if (!izin.ubah('modal')) return
  ivSunting.value = String(i.id)
  ivForm.nama = String(i.name || '')
  ivForm.modal = String(num(i.capital) || '')
  ivForm.milik = String(i.ownership ?? '')
  ivForm.target = String(i.targetDate || '')
}

// ---- per-investor drafts: return form + top-up form ----
interface Draf { rd: string, ra: string, rw: string, td: string, ta: string, tw: string, tk: string }
const draf = ref<Record<string, Draf>>({})
function d(id: string): Draf {
  return draf.value[id] ??= { rd: '', ra: '', rw: '', td: hariIni(), ta: '', tw: '', tk: '' }
}
const rvSunting = ref<{ iv: string, ix: number } | null>(null)
const tmSunting = ref<{ iv: string, id: string } | null>(null)

function rvMulaiSunting(i: InvestorBrankas, ix: number) {
  if (!izin.ubah('modal')) return
  const r = retUrut(i)[ix]
  if (!r) return
  rvSunting.value = { iv: String(i.id), ix }
  const dd = d(String(i.id))
  dd.rd = String(r.date || '')
  dd.ra = String(num(r.amount) || '')
  dd.rw = String(r.dari || '')
}
function tmMulaiSunting(i: InvestorBrankas, id: string) {
  if (!izin.ubah('modal')) return
  const t = (i.tambahan ?? []).find(x => String(x.id) === id)
  if (!t) return
  tmSunting.value = { iv: String(i.id), id }
  const dd = d(String(i.id))
  dd.td = String(t.date || '')
  dd.ta = String(num(t.amount) || '')
  dd.tw = String(t.ke || '')
  dd.tk = String(t.ket || '')
}

const sibuk = ref(false)
async function tulisInvestor(obj: InvestorBrankas, ada: boolean, pesan: string) {
  if (!vaultData.value || !izin.ubah('modal') || sibuk.value) return
  sibuk.value = true
  try {
    const versi = vaultData.value.version ?? ''
    if (ada) await updateVaultRec('investor', String(obj.id), obj as never, versi, 'PUT')
    else await createVaultRec('investor', obj as never, versi)
    toast.add({ title: pesan, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function ivSimpan() {
  if (!ivForm.nama.trim()) {
    toast.add({ title: 'Nama investor wajib diisi.', color: 'error' })
    return
  }
  if (ivSunting.value) {
    const lama = daftar.value.find(x => String(x.id) === ivSunting.value)
    if (!lama) {
      toast.add({ title: 'Investor yang disunting sudah tidak ada — muat ulang halaman.', color: 'error' })
      ivSunting.value = null
      return
    }
    const obj = { ...lama, name: ivForm.nama.trim(), capital: num(ivForm.modal), ownership: num(ivForm.milik), targetDate: ivForm.target }
    ivSunting.value = null
    ivBaru()
    await tulisInvestor(obj, true, 'Investor disimpan.')
    return
  }
  const obj: InvestorBrankas = {
    id: `iv-${Date.now().toString(36)}`,
    name: ivForm.nama.trim(),
    capital: num(ivForm.modal),
    ownership: num(ivForm.milik),
    targetDate: ivForm.target,
    returns: [],
  }
  ivBaru()
  await tulisInvestor(obj, false, 'Investor dicatat.')
}

async function rvSimpan(i: InvestorBrankas) {
  const dd = d(String(i.id))
  if (!dd.rd || !num(dd.ra)) {
    toast.add({ title: 'Tanggal dan nominal pengembalian wajib diisi.', color: 'error' })
    return
  }
  if (!dd.rw) {
    toast.add({ title: 'Pilih wallet asal uangnya — tanpa itu saldo rekening tidak berkurang.', color: 'error' })
    return
  }
  const obj = { ...i, returns: [...(i.returns ?? [])] }
  if (rvSunting.value && rvSunting.value.iv === String(i.id)) {
    const target = retUrut(i)[rvSunting.value.ix]
    if (!target) {
      toast.add({ title: 'Catatan yang disunting sudah tidak ada — muat ulang halaman.', color: 'error' })
      rvSunting.value = null
      return
    }
    // Overwrite its own row, not a new one: two rows for one transfer would
    // count the repayment twice on the investor page.
    const ixAsli = obj.returns.indexOf(target)
    obj.returns[ixAsli] = { ...target, date: dd.rd, amount: num(dd.ra), dari: dd.rw }
    rvSunting.value = null
  }
  else {
    obj.returns.push({ date: dd.rd, amount: num(dd.ra), dari: dd.rw })
  }
  dd.rd = ''
  dd.ra = ''
  await tulisInvestor(obj, true, 'Pengembalian dicatat.')
}

async function tmSimpan(i: InvestorBrankas) {
  const dd = d(String(i.id))
  if (!dd.td || !num(dd.ta)) {
    toast.add({ title: 'Tanggal dan nominal tambahan modal wajib diisi.', color: 'error' })
    return
  }
  if (!dd.tw) {
    toast.add({ title: 'Pilih wallet tempat uangnya masuk.', color: 'error' })
    return
  }
  const obj = { ...i, tambahan: [...(i.tambahan ?? [])] }
  if (tmSunting.value && tmSunting.value.iv === String(i.id)) {
    const ix = obj.tambahan.findIndex(x => String(x.id) === tmSunting.value!.id)
    if (ix < 0) {
      toast.add({ title: 'Catatan yang disunting sudah tidak ada — muat ulang halaman.', color: 'error' })
      tmSunting.value = null
      return
    }
    obj.tambahan[ix] = { ...obj.tambahan[ix], date: dd.td, amount: num(dd.ta), ke: dd.tw, ket: dd.tk.trim() }
    tmSunting.value = null
  }
  else {
    obj.tambahan.push({ id: `tm-${Date.now().toString(36)}`, date: dd.td, amount: num(dd.ta), ke: dd.tw, ket: dd.tk.trim() })
  }
  dd.ta = ''
  dd.tk = ''
  await tulisInvestor(obj, true, 'Tambahan modal dicatat.')
}

async function tmHapus(i: InvestorBrankas, id: string) {
  const obj = { ...i, tambahan: (i.tambahan ?? []).filter(x => String(x.id) !== id) }
  if (tmSunting.value?.id === id) tmSunting.value = null
  await tulisInvestor(obj, true, 'Tambahan modal dihapus. Saldo wallet tujuan ikut berkurang.')
}

async function rvHapus(i: InvestorBrankas, ix: number) {
  const target = retUrut(i)[ix]
  if (!target) return
  const obj = { ...i, returns: (i.returns ?? []).filter(r => r !== target) }
  if (rvSunting.value?.iv === String(i.id) && rvSunting.value.ix === ix) rvSunting.value = null
  await tulisInvestor(obj, true, 'Catatan pengembalian dihapus.')
}

// ---- delete investor ----
const ivHapusTarget = ref<InvestorBrankas | null>(null)
const ivHapusOpen = ref(false)
async function jalanHapusInvestor() {
  if (!vaultData.value || !ivHapusTarget.value || !izin.ubah('modal') || sibuk.value) return
  sibuk.value = true
  try {
    await deleteVaultRec('investor', String(ivHapusTarget.value.id), vaultData.value.version ?? '')
    toast.add({ title: 'Investor beserta riwayatnya dihapus.', color: 'success' })
    ivHapusOpen.value = false
    ivHapusTarget.value = null
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const opsiWallet = computed(() => [{ label: '— pilih wallet —', value: '__kosong' }, ...SEMUA_WADAH.map(k => ({ label: namaWallet(k), value: k }))])
const SEMUHAKAN_OK = SEMUA_WADAH
onMounted(() => ivBaru())
</script>

<template>
  <AppPage
    title="Pengembalian modal"
    description="Progres pengembalian modal per investor."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('modal')"
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
      <UAlert
        v-if="gantung.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        :title="`${gantung.length} catatan pengembalian belum menyebut keluar dari wallet mana. Uangnya sudah dibayarkan tapi saldo wallet belum berkurang, jadi saldo di halaman Saldo & Rekening lebih besar daripada kenyataan sebesar ${fmtRp(gantungTotal)}. Perbaiki lewat tombol Ubah di barisnya lalu pilih wallet asalnya.`"
      />

      <AppStatGrid>
        <AppStat
          label="Modal masuk"
          icon="i-lucide-hand-coins"
          :value="fmtRp(modal)"
          :sub="`${daftar.length} investor · termasuk tambahan modal`"
        />
        <AppStat
          label="Sudah dikembalikan"
          icon="i-lucide-check"
          :value="fmtRp(kembali)"
          :sub="modal > 0 ? `${(kembali / modal * 100).toFixed(1)}% dari modal` : '—'"
          tone="success"
        />
        <AppStat
          label="Sisa kewajiban"
          icon="i-lucide-hourglass"
          :value="fmtRp(Math.max(modal - kembali, 0))"
          sub="belum dikembalikan"
          :tone="modal - kembali > 0 ? 'warning' : undefined"
        />
      </AppStatGrid>

      <AppPanel
        v-if="izin.ubah('modal')"
        :title="ivSunting ? 'Ubah investor' : 'Catat investor'"
        :description="ivSunting ? 'Riwayat pengembaliannya tidak tersentuh.' : 'Modal yang masuk dan target pengembaliannya'"
        class="mb-5"
      >
        <AppFilterGrid>
          <UFormField label="Nama">
            <UInput
              v-model="ivForm.nama"
              placeholder="Nama investor"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="ivSunting ? 'Modal awal' : 'Modal'">
            <UInput
              v-model="ivForm.modal"
              inputmode="numeric"
              placeholder="0"
              class="w-full num"
            />
          </UFormField>
          <UFormField label="Kepemilikan (%)">
            <UInput
              v-model="ivForm.milik"
              inputmode="numeric"
              placeholder="0"
              class="w-full num"
            />
          </UFormField>
          <UFormField label="Target selesai">
            <UInput
              v-model="ivForm.target"
              type="date"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="ivSunting ? 'Simpan perubahan' : 'Simpan investor'"
            icon="i-lucide-save"
            :loading="sibuk"
            @click="ivSimpan"
          />
          <UButton
            v-if="ivSunting"
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="() => { ivSunting = null; ivBaru() }"
          />
        </div>
      </AppPanel>

      <AppPanel
        v-for="i in daftar"
        :key="String(i.id)"
        :title="String(i.name || '(tanpa nama)')"
        :description="`Modal ${fmtRp(modalTotal(i))} · kepemilikan ${i.ownership || 0}%${i.targetDate ? ` · target ${fTgl(i.targetDate)}` : ''} · tercatat juga di halaman investor sebagai riwayat dividen`"
        class="mb-5"
        flush
      >
        <div class="grid gap-4 px-4 py-3 sm:grid-cols-3 lg:px-5">
          <div class="text-sm">
            <span class="block text-[12px] font-bold uppercase tracking-wider text-muted">Dikembalikan</span>
            <b class="num text-highlighted">{{ fmtRp(kembaliOf(i)) }}</b>
            <span class="block text-[12px] text-muted">{{ persenOf(i).toFixed(1) }}% dari modal</span>
          </div>
          <div class="text-sm">
            <span class="block text-[12px] font-bold uppercase tracking-wider text-muted">Sisa</span>
            <b class="num text-highlighted">{{ fmtRp(Math.max(modalTotal(i) - kembaliOf(i), 0)) }}</b>
          </div>
          <div class="text-sm">
            <span class="block text-[12px] font-bold uppercase tracking-wider text-muted">Jumlah pembayaran</span>
            <b class="num text-highlighted">{{ (i.returns ?? []).length }}×</b>
          </div>
        </div>

        <div
          v-if="izin.ubah('modal')"
          class="border-t border-default px-4 py-3 lg:px-5"
        >
          <b class="text-sm text-highlighted">{{ tmSunting?.iv === String(i.id) ? 'Ubah tambahan modal' : 'Tambah modal' }}</b>
          <p class="mb-2 text-[12px] text-muted">
            Uang tambahan dari investor ini sesudah modal awal. Saldo wallet tujuannya ikut bertambah —
            <b>jangan dicatat lagi</b> sebagai Mutasi "uang masuk dari luar", nanti terhitung dua kali.
          </p>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="Tanggal masuk">
              <UInput
                :model-value="d(String(i.id)).td"
                type="date"
                class="w-full"
                @update:model-value="(v: string | number) => d(String(i.id)).td = String(v)"
              />
            </UFormField>
            <UFormField label="Nominal">
              <UInput
                :model-value="d(String(i.id)).ta"
                inputmode="numeric"
                placeholder="0"
                class="w-full num"
                @update:model-value="(v: string | number) => d(String(i.id)).ta = String(v)"
              />
            </UFormField>
            <UFormField label="Masuk ke wallet">
              <USelect
                :model-value="d(String(i.id)).tw || '__kosong'"
                :items="opsiWallet"
                class="w-full"
                @update:model-value="(v: string) => d(String(i.id)).tw = v === '__kosong' ? '' : v"
              />
            </UFormField>
            <UFormField label="Keterangan">
              <UInput
                :model-value="d(String(i.id)).tk"
                placeholder="mis. tambahan modal renovasi"
                class="w-full"
                @update:model-value="(v: string | number) => d(String(i.id)).tk = String(v)"
              />
            </UFormField>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <UButton
              :label="tmSunting?.iv === String(i.id) ? 'Simpan perubahan' : 'Catat tambahan modal'"
              size="sm"
              :loading="sibuk"
              @click="tmSimpan(i)"
            />
            <UButton
              v-if="tmSunting?.iv === String(i.id)"
              label="Batal"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="tmSunting = null"
            />
          </div>
          <div
            v-if="tmUrut(i).length"
            class="mt-2 divide-y divide-default rounded-field border border-default"
          >
            <div
              v-for="t in tmUrut(i)"
              :key="String(t.id)"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm"
            >
              <span class="min-w-0">{{ fTgl(t.date) }} · {{ namaWallet(t.ke) }} · {{ t.ket || '—' }}</span>
              <span class="flex items-center gap-2">
                <b class="num">{{ fmtRp(num(t.amount)) }}</b>
                <UButton
                  label="Ubah"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="tmMulaiSunting(i, String(t.id))"
                />
                <UButton
                  label="Hapus"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="tmHapus(i, String(t.id))"
                />
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="izin.ubah('modal')"
          class="border-t border-default px-4 py-3 lg:px-5"
        >
          <b class="text-sm text-highlighted">{{ rvSunting?.iv === String(i.id) ? 'Ubah pengembalian' : 'Catat pengembalian' }}</b>
          <div class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="Tanggal bayar">
              <UInput
                :model-value="d(String(i.id)).rd"
                type="date"
                class="w-full"
                @update:model-value="(v: string | number) => d(String(i.id)).rd = String(v)"
              />
            </UFormField>
            <UFormField label="Nominal">
              <UInput
                :model-value="d(String(i.id)).ra"
                inputmode="numeric"
                placeholder="0"
                class="w-full num"
                @update:model-value="(v: string | number) => d(String(i.id)).ra = String(v)"
              />
            </UFormField>
            <UFormField label="Dibayar dari">
              <USelect
                :model-value="d(String(i.id)).rw || '__kosong'"
                :items="opsiWallet"
                class="w-full"
                @update:model-value="(v: string) => d(String(i.id)).rw = v === '__kosong' ? '' : v"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <UButton
                :label="rvSunting?.iv === String(i.id) ? 'Simpan perubahan' : 'Catat pengembalian'"
                size="sm"
                :loading="sibuk"
                @click="rvSimpan(i)"
              />
              <UButton
                v-if="rvSunting?.iv === String(i.id)"
                label="Batal"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="rvSunting = null"
              />
            </div>
          </div>
        </div>

        <div
          v-if="retUrut(i).length"
          class="divide-y divide-default border-t border-default"
        >
          <div
            v-for="(r, ix) in retUrut(i)"
            :key="ix"
            class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm lg:px-5"
          >
            <span class="min-w-0">
              <b class="text-highlighted">{{ fTgl(r.date) }}</b>
              <AppStatus
                v-if="!r.dari || !SEMUHAKAN_OK.includes(String(r.dari))"
                color="warning"
                size="sm"
              >
                belum disebut
              </AppStatus>
              <span
                v-else
                class="ml-2 text-muted"
              >{{ namaWallet(r.dari) }}</span>
            </span>
            <span class="flex items-center gap-2">
              <b class="num">{{ fmtRp(num(r.amount)) }}</b>
              <template v-if="izin.ubah('modal')">
                <UButton
                  label="Ubah"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="rvMulaiSunting(i, ix)"
                />
                <UButton
                  label="Hapus"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="rvHapus(i, ix)"
                />
              </template>
            </span>
          </div>
        </div>

        <div
          v-if="izin.ubah('modal')"
          class="flex flex-wrap gap-2 border-t border-default px-4 py-3 lg:px-5"
        >
          <UButton
            label="Ubah investor"
            size="sm"
            color="neutral"
            variant="outline"
            @click="ivMulaiSunting(i)"
          />
          <UButton
            label="Hapus investor"
            size="sm"
            color="error"
            variant="outline"
            @click="() => { ivHapusTarget = i; ivHapusOpen = true }"
          />
        </div>
      </AppPanel>
      <p
        v-if="!daftar.length"
        class="px-4 py-6 text-center text-sm text-muted"
      >
        Belum ada investor yang dicatat.
      </p>

      <ResponsiveSheet
        v-model:open="ivHapusOpen"
        title="Hapus investor ini beserta riwayat pengembaliannya?"
      >
        <p class="text-sm">
          {{ ivHapusTarget?.name }} — riwayat dividen yang tampil di halaman investor ikut hilang.
        </p>
        <template #footer>
          <UButton
            label="Ya, hapus"
            color="error"
            :loading="sibuk"
            @click="jalanHapusInvestor"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="ivHapusOpen = false"
          />
        </template>
      </ResponsiveSheet>
    </template>
  </AppPage>
</template>
