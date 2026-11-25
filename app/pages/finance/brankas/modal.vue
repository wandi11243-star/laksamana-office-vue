<!--
  Finance › Brankas › Pengembalian Modal (old `vModal`, deploy/finance/brankas/index.html:1632-1794).

  Capital progress per investor. Total capital = opening capital + every later
  top-up (`modalTotal`); repayments name their source wallet — rows hanging
  without one are REPORTED, never guessed, or the wallet balances read larger
  than reality. Investor records are written per record against the
  whole-blob version; conflicts reload, never retry.

  ACCOUNT LINK (VUE-7b, old `akunHtml`): each card can link an Office account
  (`akunId`/`akunNama` on the record, `POST /account/investor-akun` for
  create-or-link). Unlinking drops only the link — the grant stays (its
  business lives in Kelola Akses). Buttons need module admin of investor,
  brankas or finance; the server checks again.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { buatAkunInvestor, createVaultRec, deleteVaultRec, getVault, updateVaultRec } from '~/composables/useFinance'
import { getRoster } from '~/composables/useCashier'
import { isAdminOf } from '~/composables/useMe'
import type { RosterUser } from '~/composables/useRoster'
import { useBrankasIzin } from '~/utils/layar/finance'
import { fmtRp, num } from '~/utils/cashier'
import { hariIni, tglRingkas } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import type { InvestorBrankas, KembaliModal, TambahanModal } from '~/utils/brankas'
import { modalTanpaWadah, modalTotal, namaWallet, SEMUA_WADAH } from '~/utils/brankas'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()
const me = useMe()
const toast = useToast()

/** Linking an account is the bigger right (old `sayaAdmin`): module admin of
 * investor, brankas or finance. The server checks again. */
const akunBoleh = computed(() => isAdminOf(me.value, 'investor') || isAdminOf(me.value, 'brankas') || isAdminOf(me.value, 'finance'))

const { data: vaultData, status, error, refresh } = useAsyncData('brankas-vault', () => getVault())
const daftar = computed<InvestorBrankas[]>(() => ((vault.value.investor ?? []) as InvestorBrankas[]).slice())
const vault = computed(() => vaultData.value?.vault ?? {})

// Skeleton only for the first load: saving a row refetches in place, so a refetch must not blank the cards.
const statMemuat = computed(() => !vaultData.value && (status.value === 'pending' || status.value === 'idle'))

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

// ---- per-card header, stat boxes and tables (old `vModal` card) ----
function keterangan(i: InvestorBrankas): string {
  const tm = i.tambahan ?? []
  const total = modalTotal(i)
  const modalTeks = tm.length
    ? `${fmtRp(total)} (awal ${fmtRp(num(i.capital))} + ${tm.length}× tambahan ${fmtRp(total - num(i.capital))})`
    : fmtRp(num(i.capital))
  return `Tercatat juga di halaman investor sebagai riwayat dividen. Modal ${modalTeks} · kepemilikan ${i.ownership || 0}%${i.targetDate ? ` · target ${tglRingkas(i.targetDate)}` : ''}`
}
const ringkasan = (i: InvestorBrankas) => [
  { label: 'Dikembalikan', nilai: fmtRp(kembaliOf(i)), sub: `${persenOf(i).toFixed(1)}% dari modal` },
  { label: 'Sisa', nilai: fmtRp(Math.max(modalTotal(i) - kembaliOf(i), 0)), sub: '' },
  { label: 'Jumlah pembayaran', nilai: `${(i.returns ?? []).length}×`, sub: '' },
]
const KANAN = { class: { th: 'text-right', td: 'text-right' } }
const kolomTambahan = (i: InvestorBrankas): TableColumn<TambahanModal>[] => [
  { id: 'date', header: 'Tanggal masuk', footer: 'Total tambahan' },
  { id: 'ke', header: 'Masuk ke' },
  { id: 'amount', header: 'Tambahan modal', footer: fmtRp(modalTotal(i) - num(i.capital)), meta: KANAN },
  { id: 'ket', header: 'Keterangan' },
  { id: 'aksi', header: '' },
]
const kolomKembali: TableColumn<KembaliModal>[] = [
  { id: 'date', header: 'Tanggal' },
  { id: 'dari', header: 'Dibayar dari' },
  { id: 'amount', header: 'Nominal', meta: KANAN },
  { id: 'aksi', header: '' },
]

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

// Cancelling must empty the fields too: left filled, the button turns back into
// "Catat" and one more press records the old row a second time.
function rvBatal(i: InvestorBrankas) {
  rvSunting.value = null
  Object.assign(d(String(i.id)), { rd: '', ra: '', rw: '' })
}
function tmBatal(i: InvestorBrankas) {
  tmSunting.value = null
  Object.assign(d(String(i.id)), { td: hariIni(), ta: '', tw: '', tk: '' })
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
  const t = (i.tambahan ?? []).find(x => String(x.id) === id)
  if (!t || !confirm(`Hapus tambahan modal ${fmtRp(num(t.amount))} (${tglRingkas(t.date)})? Saldo ${namaWallet(t.ke)} ikut berkurang.`)) return
  const obj = { ...i, tambahan: (i.tambahan ?? []).filter(x => String(x.id) !== id) }
  if (tmSunting.value?.id === id) tmSunting.value = null
  await tulisInvestor(obj, true, 'Tambahan modal dihapus. Saldo wallet tujuan ikut berkurang.')
}

async function rvHapus(i: InvestorBrankas, ix: number) {
  const target = retUrut(i)[ix]
  if (!target || !confirm('Hapus catatan pengembalian ini?')) return
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
onMounted(() => ivBaru())

// ---- investor → Office account link (VUE-7b, old `akunHtml`/`akBuka`/`akKirim`) ----
// Only the LINK (`akunId`/`akunNama`) is stored on the investor record, through
// the same versioned vault write as everything else on this page. The grant
// itself lives in the account module: linking grants `investor` (never admin),
// unlinking only drops the link (never the grant).

/** Which investor card has its account box open (one at a time, like `AK_EDIT`). */
const akBuka = ref<{ iv: string, mode: 'pilih' | 'buat' } | null>(null)
const akDraf = reactive({ nama: '', hp: '', pin: '', userId: '' })
/** Roster for the "link existing" picker: lazy-loaded once, active only (old `akMuatUsers`). */
const akUsers = ref<RosterUser[] | null>(null)
const akUsersErr = ref('')
const akMemuat = ref(false)

const opsiAkun = computed(() => [
  { label: '— pilih akun —', value: '__kosong' },
  ...(akUsers.value ?? []).map(u => ({ label: String(u.name || '(tanpa nama)'), value: String(u.id) })),
])

function akPilihOtomatis(i: InvestorBrankas) {
  const sama = (akUsers.value ?? []).find(u => String(u.name || '').trim().toLowerCase() === String(i.name || '').trim().toLowerCase())
  akDraf.userId = sama ? String(sama.id) : ''
}

async function akBukaForm(i: InvestorBrankas, mode: 'pilih' | 'buat') {
  if (!akunBoleh.value) return
  akDraf.nama = String(i.name || '')
  akDraf.hp = ''
  akDraf.pin = ''
  akDraf.userId = ''
  akBuka.value = { iv: String(i.id), mode }
  if (mode !== 'pilih') return
  if (akUsers.value) {
    akPilihOtomatis(i)
    return
  }
  if (akMemuat.value) return
  akMemuat.value = true
  akUsersErr.value = ''
  try {
    const rows = await getRoster()
    akUsers.value = rows
      .filter(u => u.active !== false)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    akPilihOtomatis(i)
  }
  catch (e) {
    akUsersErr.value = apiErrorMessage(e)
  }
  finally {
    akMemuat.value = false
  }
}

/** `bad_pin` / `name_taken` in plain words (old `AK_PESAN`). */
function pesanAkun(e: unknown): string {
  const kode = apiErrorCode(e)
  if (kode === 'bad_pin') return 'PIN harus 4–6 angka.'
  if (kode === 'name_taken') return 'Nama itu sudah dipakai akun lain — pilih "Hubungkan akun yang sudah ada", atau pakai nama lain.'
  return apiErrorMessage(e)
}

async function akKirim(i: InvestorBrankas) {
  if (!vaultData.value || !akunBoleh.value || sibuk.value) return
  const mode = akBuka.value?.iv === String(i.id) ? akBuka.value.mode : null
  if (!mode) return
  let badan: { userId: string } | { name: string, noHp?: string, pin: string }
  if (mode === 'pilih') {
    if (!akDraf.userId) {
      toast.add({ title: 'Pilih dulu akun yang mau dihubungkan.', color: 'error' })
      return
    }
    // Linking changes not one column of the account; the name/PIN stay.
    badan = { userId: akDraf.userId }
  }
  else {
    if (!akDraf.nama.trim()) {
      toast.add({ title: 'Nama akun baru wajib diisi.', color: 'error' })
      return
    }
    if (!/^[0-9]{4,6}$/.test(akDraf.pin)) {
      toast.add({ title: 'PIN harus 4–6 angka.', color: 'error' })
      return
    }
    badan = { name: akDraf.nama.trim(), pin: akDraf.pin, ...(akDraf.hp.trim() ? { noHp: akDraf.hp.trim() } : {}) }
  }
  sibuk.value = true
  try {
    let akun
    try {
      akun = await buatAkunInvestor(badan)
    }
    catch (e) {
      // Unversioned call: no conflict to reload, only the plain reason.
      toast.add({ title: `Gagal menyiapkan akun: ${pesanAkun(e)}`, color: 'error' })
      return
    }
    if (!akun) {
      toast.add({ title: 'Server tidak mengembalikan akun.', color: 'error' })
      return
    }
    const obj = { ...i, akunId: String(akun.id), akunNama: String(akun.name) }
    try {
      await updateVaultRec('investor', String(i.id), obj as never, vaultData.value.version ?? '', 'PUT')
      toast.add({ title: `Akun ${akun.name} terhubung.`, color: 'success' })
      akBuka.value = null
      await refresh()
    }
    catch (e2) {
      const ditangani = await tanganiKonflik(e2, refresh)
      if (mode === 'buat') {
        // The account is already born (with the grant) — the link is what
        // failed, conflict or not. A second create would birth a twin: link
        // instead (old `akKirim` rollback).
        toast.add({
          title: `Akun "${akun.name}" SUDAH dibuat dan diberi hak investor, tapi tautannya belum tersimpan. Pakai "Hubungkan akun yang sudah ada" lalu pilih akun itu — jangan buat akun kedua.`,
          color: 'error',
        })
      }
      else if (!ditangani) {
        toast.add({ title: `Gagal menyimpan tautan: ${apiErrorMessage(e2)}`, color: 'error' })
      }
    }
  }
  finally {
    sibuk.value = false
  }
}

async function akLepas(i: InvestorBrankas) {
  if (!akunBoleh.value) return
  if (!confirm(`Lepas tautan akun "${String(i.akunNama || i.akunId)}" dari investor ${String(i.name)}?\n\nAkun Office-nya TIDAK dihapus dan akses modul Investor-nya TIDAK dicabut (itu lewat Kelola Akses). Sesudah dilepas, akun itu cuma melihat "belum terhubung" di Investor Compass.`)) return
  const obj = { ...i }
  delete obj.akunId
  delete obj.akunNama
  await tulisInvestor(obj, true, 'Tautan akun dilepas.')
}
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
        :title="`${gantung.length} catatan pengembalian belum menyebut keluar dari wallet mana. Uangnya sudah dibayarkan tapi saldo wallet belum berkurang, jadi saldo di halaman Saldo & Rekening lebih besar daripada kenyataan sebesar ${fmtRp(gantungTotal)}. Tekan Edit di barisnya lalu pilih wallet asalnya.`"
      />

      <AppStatGrid
        :loading="statMemuat"
        :count="3"
      >
        <AppStat
          label="Modal masuk"
          :value="fmtRp(modal)"
          :sub="`${daftar.length} investor · termasuk tambahan modal`"
        />
        <AppStat
          label="Sudah dikembalikan"
          :value="fmtRp(kembali)"
          :sub="modal > 0 ? `${(kembali / modal * 100).toFixed(1)}% dari modal` : '—'"
        />
        <AppStat
          label="Sisa kewajiban"
          :value="fmtRp(Math.max(modal - kembali, 0))"
          sub="belum dikembalikan"
        />
      </AppStatGrid>

      <AppPanel
        v-if="izin.ubah('modal')"
        :title="ivSunting ? 'Ubah investor' : 'Catat investor'"
        :description="ivSunting ? 'Riwayat pengembaliannya tidak tersentuh.' : 'Modal yang masuk dan target pengembaliannya'"
        class="mb-5"
      >
        <AppFilterGrid class="mb-4">
          <UFormField label="Nama">
            <UInput
              v-model="ivForm.nama"
              placeholder="Nama investor"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="ivSunting ? 'Modal awal' : 'Modal'">
            <AppNominal
              v-model="ivForm.modal"
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
            <AppTanggal
              v-model="ivForm.target"
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
        :description="keterangan(i)"
        class="mb-5"
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            v-for="k in ringkasan(i)"
            :key="k.label"
            class="rounded-xl border border-t-[3px] border-default border-t-gold bg-muted p-4"
          >
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
              {{ k.label }}
            </p>
            <p class="num mt-1 font-display text-2xl font-extrabold text-highlighted">
              {{ k.nilai }}
            </p>
            <p
              v-if="k.sub"
              class="mt-1 text-[13px] text-muted"
            >
              {{ k.sub }}
            </p>
          </div>
        </div>

        <!-- ── Tambah modal ── -->
        <div
          v-if="izin.ubah('modal')"
          class="mt-4 rounded-xl border border-dashed border-accented bg-muted p-4"
        >
          <b class="text-sm text-highlighted">{{ tmSunting?.iv === String(i.id) ? 'Edit tambahan modal' : 'Tambah modal' }}</b>
          <p class="mb-3 text-[12px] text-muted">
            Uang tambahan dari investor ini sesudah modal awal. Saldo wallet tujuannya ikut bertambah —
            <b>jangan dicatat lagi</b> sebagai Mutasi "uang masuk dari luar", nanti terhitung dua kali.
          </p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="Tanggal masuk">
              <AppTanggal
                :model-value="d(String(i.id)).td"
                class="w-full"
                @update:model-value="(v: string | number) => d(String(i.id)).td = String(v)"
              />
            </UFormField>
            <UFormField label="Nominal">
              <AppNominal
                :model-value="d(String(i.id)).ta"
                placeholder="0"
                class="num w-full"
                @update:model-value="(v: string) => d(String(i.id)).ta = v"
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
          <div class="mt-3 flex flex-wrap gap-2">
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
              @click="tmBatal(i)"
            />
          </div>
        </div>

        <!-- The top-up history stays visible to view-only roles, as before. -->
        <div
          v-if="tmUrut(i).length"
          class="mt-4 overflow-hidden rounded-xl border border-default"
        >
          <UTable
            :columns="kolomTambahan(i)"
            :data="tmUrut(i)"
            class="hidden lg:block"
          >
            <template #date-cell="{ row }">
              {{ tglRingkas(row.original.date) }}
            </template>
            <template #ke-cell="{ row }">
              {{ namaWallet(row.original.ke) }}
            </template>
            <template #amount-cell="{ row }">
              <span class="num">{{ fmtRp(num(row.original.amount)) }}</span>
            </template>
            <template #ket-cell="{ row }">
              {{ row.original.ket || '—' }}
            </template>
            <template #aksi-cell="{ row }">
              <div
                v-if="izin.ubah('modal')"
                class="flex justify-end gap-1 whitespace-nowrap"
              >
                <UButton
                  label="Edit"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  @click="tmMulaiSunting(i, String(row.original.id))"
                />
                <UButton
                  label="Hapus"
                  size="xs"
                  color="error"
                  variant="soft"
                  loading-auto
                  @click="tmHapus(i, String(row.original.id))"
                />
              </div>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="t in tmUrut(i)"
              :key="String(t.id)"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm"
            >
              <span class="min-w-0">{{ tglRingkas(t.date) }} · {{ namaWallet(t.ke) }} · {{ t.ket || '—' }}</span>
              <span class="flex items-center gap-2">
                <b class="num">{{ fmtRp(num(t.amount)) }}</b>
                <template v-if="izin.ubah('modal')">
                  <UButton
                    label="Edit"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    @click="tmMulaiSunting(i, String(t.id))"
                  />
                  <UButton
                    label="Hapus"
                    size="xs"
                    color="error"
                    variant="soft"
                    loading-auto
                    @click="tmHapus(i, String(t.id))"
                  />
                </template>
              </span>
            </div>
            <div class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <b class="text-highlighted">Total tambahan</b>
              <b class="num">{{ fmtRp(modalTotal(i) - num(i.capital)) }}</b>
            </div>
          </div>
        </div>

        <!-- ── Catat pengembalian ── -->
        <template v-if="izin.ubah('modal')">
          <UAlert
            v-if="rvSunting?.iv === String(i.id)"
            color="info"
            variant="subtle"
            icon="i-lucide-pencil"
            class="mt-4"
            title="Sedang menyunting catatan pengembalian. Saldo wallet asalnya ikut berubah begitu disimpan."
          />
          <div class="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="Tanggal bayar">
              <AppTanggal
                :model-value="d(String(i.id)).rd"
                class="w-full"
                @update:model-value="(v: string | number) => d(String(i.id)).rd = String(v)"
              />
            </UFormField>
            <UFormField label="Nominal">
              <AppNominal
                :model-value="d(String(i.id)).ra"
                placeholder="0"
                class="num w-full"
                @update:model-value="(v: string) => d(String(i.id)).ra = v"
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
            <div class="flex gap-2">
              <UButton
                :label="rvSunting?.iv === String(i.id) ? 'Simpan perubahan' : 'Catat pengembalian'"
                block
                class="flex-1"
                :loading="sibuk"
                @click="rvSimpan(i)"
              />
              <UButton
                v-if="rvSunting?.iv === String(i.id)"
                label="Batal"
                color="neutral"
                variant="ghost"
                @click="rvBatal(i)"
              />
            </div>
          </div>
        </template>

        <div
          v-if="retUrut(i).length"
          class="mt-4 overflow-hidden rounded-xl border border-default"
        >
          <UTable
            :columns="kolomKembali"
            :data="retUrut(i)"
            class="hidden lg:block"
          >
            <template #date-cell="{ row }">
              {{ tglRingkas(row.original.date) }}
            </template>
            <template #dari-cell="{ row }">
              <AppStatus
                v-if="!row.original.dari || !SEMUA_WADAH.includes(row.original.dari)"
                color="warning"
                icon="i-lucide-triangle-alert"
                size="sm"
              >
                belum disebut
              </AppStatus>
              <template v-else>
                {{ namaWallet(row.original.dari) }}
              </template>
            </template>
            <template #amount-cell="{ row }">
              <span class="num">{{ fmtRp(num(row.original.amount)) }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <div
                v-if="izin.ubah('modal')"
                class="flex justify-end gap-1 whitespace-nowrap"
              >
                <UButton
                  label="Edit"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  @click="rvMulaiSunting(i, row.index)"
                />
                <UButton
                  label="Hapus"
                  size="xs"
                  color="error"
                  variant="soft"
                  loading-auto
                  @click="rvHapus(i, row.index)"
                />
              </div>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="(r, ix) in retUrut(i)"
              :key="ix"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm"
            >
              <span class="min-w-0">
                <b class="text-highlighted">{{ tglRingkas(r.date) }}</b>
                <AppStatus
                  v-if="!r.dari || !SEMUA_WADAH.includes(r.dari)"
                  color="warning"
                  size="sm"
                  class="ml-2"
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
                    label="Edit"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    @click="rvMulaiSunting(i, ix)"
                  />
                  <UButton
                    label="Hapus"
                    size="xs"
                    color="error"
                    variant="soft"
                    loading-auto
                    @click="rvHapus(i, ix)"
                  />
                </template>
              </span>
            </div>
          </div>
        </div>

        <!-- ── Akun Office (below the repayments, as in the old card) ── -->
        <div class="mt-4">
          <template v-if="i.akunId">
            <UAlert
              color="info"
              variant="subtle"
              icon="i-lucide-link"
              :title="`Akun Office: ${String(i.akunNama || i.akunId)} — investor ini bisa masuk ke Investor Compass dan hanya melihat modal & dividennya sendiri.`"
            />
            <div
              v-if="akunBoleh"
              class="mt-2"
            >
              <UButton
                label="Lepas tautan"
                size="xs"
                color="neutral"
                variant="outline"
                :loading="sibuk"
                @click="akLepas(i)"
              />
            </div>
          </template>
          <div
            v-else-if="akunBoleh"
            class="rounded-xl border border-dashed border-accented bg-muted p-4"
          >
            <b class="text-sm text-highlighted">Akun Office</b>
            <p
              v-if="akBuka?.iv !== String(i.id)"
              class="mb-2 text-[12px] text-muted"
            >
              Belum terhubung. Tautkan supaya <b>{{ String(i.name) }}</b> bisa masuk ke Investor Compass dan hanya melihat modal & dividennya sendiri.
            </p>
            <div
              v-if="akBuka?.iv !== String(i.id)"
              class="flex flex-wrap gap-2"
            >
              <UButton
                label="Hubungkan akun yang sudah ada"
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-link"
                loading-auto
                @click="akBukaForm(i, 'pilih')"
              />
              <UButton
                label="Buat akun baru"
                size="sm"
                icon="i-lucide-user-plus"
                loading-auto
                @click="akBukaForm(i, 'buat')"
              />
            </div>
            <template v-else-if="akBuka.mode === 'pilih'">
              <p class="mb-2 text-[12px] text-muted">
                Akun yang dipilih diberi hak modul investor (tidak pernah admin); nama dan PIN-nya tidak diubah.
              </p>
              <div
                v-if="akMemuat"
                class="space-y-2"
              >
                <!-- Loading rows mirror the account picker below. -->
                <USkeleton class="h-10 w-full" />
                <USkeleton class="h-10 w-full" />
                <p class="pt-1 text-sm text-muted">
                  Memuat daftar akun…
                </p>
              </div>
              <UAlert
                v-else-if="akUsersErr"
                color="error"
                variant="subtle"
                icon="i-lucide-triangle-alert"
                :title="`Daftar akun gagal dimuat: ${akUsersErr}`"
              />
              <div
                v-else
                class="grid gap-2 sm:grid-cols-2"
              >
                <UFormField label="Akun Office">
                  <USelect
                    :model-value="akDraf.userId || '__kosong'"
                    :items="opsiAkun"
                    class="w-full"
                    @update:model-value="(v: string) => akDraf.userId = v === '__kosong' ? '' : v"
                  />
                </UFormField>
                <div class="flex items-end gap-2">
                  <UButton
                    label="Hubungkan"
                    size="sm"
                    :loading="sibuk"
                    @click="akKirim(i)"
                  />
                  <UButton
                    label="Batal"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    @click="akBuka = null"
                  />
                </div>
              </div>
            </template>
            <template v-else>
              <p class="mb-2 text-[12px] text-muted">
                Investor masuk ke Investor Compass dengan nama akun + PIN ini. Sampaikan PIN-nya langsung ke orangnya — layar ini tidak menyimpannya.
              </p>
              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <UFormField label="Nama akun">
                  <UInput
                    v-model="akDraf.nama"
                    placeholder="Nama akun"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="No. HP">
                  <UInput
                    v-model="akDraf.hp"
                    inputmode="tel"
                    placeholder="08…"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="PIN (4–6 angka)">
                  <UInput
                    v-model="akDraf.pin"
                    inputmode="numeric"
                    maxlength="6"
                    placeholder="mis. 482913"
                    class="w-full"
                  />
                </UFormField>
                <div class="flex items-end gap-2">
                  <UButton
                    label="Buat Akun"
                    size="sm"
                    :loading="sibuk"
                    @click="akKirim(i)"
                  />
                  <UButton
                    label="Batal"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    @click="akBuka = null"
                  />
                </div>
              </div>
            </template>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Belum terhubung ke akun Office — investor ini belum bisa masuk ke Investor Compass. Yang bisa menautkan admin modul investor, brankas, atau finance.
          </p>
        </div>

        <div
          v-if="izin.ubah('modal')"
          class="mt-4 flex flex-wrap gap-2"
        >
          <UButton
            label="Edit investor"
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
