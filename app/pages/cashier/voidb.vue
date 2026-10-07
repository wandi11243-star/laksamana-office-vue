<!--
  Cashier › Void Menu (old `viewVoid`, deploy/cashier/index.html:2380-3014).

  One bill, many items: Nomor Bill, Siapa yang Menginput, Kesalahan dari Siapa
  and the chronology are typed ONCE; service & tax are typed ONCE for the whole
  bill (base = subtotals of the named items) and the server splits them over the
  items and computes every `nominal` — the total is never sent (cashier.md D.10).

  Own table (void_log), written row by row — never part of the kompas blob.
  Rows are CANCELLED (reason required), never deleted. The recap per person /
  per reason lives in Finance › Kas Kecil › Laporan Void.
-->
<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { VoidBaris, VoidItemForm, VoidKunci, VoidSetting } from '~/utils/cashier'
import {
  VOID_SALAH_OPSI, VOID_SETTING_BAWAAN, fmtRp, num, voidAktif, voidGrupBill, voidItemTerisi, voidKunciDariLabel,
  voidKurang, voidLabel, voidManualDari, voidPct, voidPersenDari, voidRentang, voidRingkas, voidSubtotal,
} from '~/utils/cashier'
import { batalVoidKasir, getVoidKasir, postVoidKasir, putVoidKasir, putVoidSettingKasir } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'
import CashierKonfirmasi from '~/widgets/cashier/CashierKonfirmasi.vue'

definePageMeta({ access: ['cashier'] })

const me = useMe()
const toast = useToast()
// The chosen date is ALSO the date of a new note — one control, not two (:2969).
const tanggal = ref(hariIni())
const bulan = computed(() => tanggal.value.slice(0, 7))

const { data, error, status, refresh } = useAsyncData(
  'cashier-void',
  () => {
    const r = voidRentang(bulan.value)
    return getVoidKasir(r.dari, r.sampai)
  },
  { watch: [bulan] },
)

const semua = computed<VoidBaris[]>(() => data.value?.baris ?? [])
// The percentages come in the SAME reply as the rows: a second request just for
// two numbers could open the form on defaults while the server uses others.
const set = computed<VoidSetting>(() => ({ ...VOID_SETTING_BAWAAN, ...(data.value?.setting ?? {}) }))
const potong = computed(() => Math.max(0, num(data.value?.total) - semua.value.length))
const hari = computed(() => semua.value.filter(r => r.tgl === tanggal.value))
const grupHari = computed(() => voidGrupBill(hari.value))
const rHari = computed(() => voidRingkas(hari.value))
const rBulan = computed(() => voidRingkas(semua.value))
const bisaSetel = computed(() => isAdminOf(me.value, 'cashier') || isAdminOf(me.value, 'finance'))

// ---------------------------------------------------------------- form
const itemKosong = (): VoidItemForm => ({ item: '', sub: 0 })
const f = reactive({
  bill: '', penginput: '', salah: '', alasan: '',
  items: [itemKosong()] as VoidItemForm[],
  svc: 0, tax: 0, svcManual: false, taxManual: false,
})
const editId = ref('')
const merah = ref<VoidKunci[]>([])
const pesan = ref<{ warna: 'error' | 'success', teks: string } | null>(null)

const subtotalForm = computed(() => voidSubtotal(f.items))
const totalForm = computed(() => subtotalForm.value + f.svc + f.tax)
const editBaris = computed(() => (editId.value ? semua.value.find(r => r.id === editId.value) ?? null : null))

// Service & tax follow the formula unless typed by hand. A keystroke in a
// subtotal must never undo an override (3 POS rows of Aug 2026 had tax 0).
watch([subtotalForm, () => set.value.service, () => set.value.tax], () => {
  if (!f.svcManual) f.svc = voidPersenDari(subtotalForm.value, set.value.service)
  if (!f.taxManual) f.tax = voidPersenDari(subtotalForm.value, set.value.tax)
}, { immediate: true })

function ketikSvc(v: number) {
  f.svc = v
  f.svcManual = true
}
function ketikTax(v: number) {
  f.tax = v
  f.taxManual = true
}
function kembaliOtomatis() {
  f.svcManual = false
  f.taxManual = false
  f.svc = voidPersenDari(subtotalForm.value, set.value.service)
  f.tax = voidPersenDari(subtotalForm.value, set.value.tax)
}

function lepasMerah(k: VoidKunci) {
  merah.value = merah.value.filter(x => x !== k)
}
function ketikItem() {
  if (voidItemTerisi(f.items).length) lepasMerah('item')
}
function tambahItem() {
  f.items.push(itemKosong())
  // The cursor moves to the row just born — otherwise the person hunts for it every time.
  nextTick(() => document.getElementById(`vd-item-${f.items.length - 1}`)?.focus())
}
function hapusItem(i: number) {
  if (f.items.length < 2) return
  f.items.splice(i, 1)
}

function kosongkan() {
  editId.value = ''
  Object.assign(f, { bill: '', penginput: '', salah: '', alasan: '', items: [itemKosong()], svcManual: false, taxManual: false })
  kembaliOtomatis()
  merah.value = []
}

function ubah(r: VoidBaris) {
  if (!voidAktif(r)) return
  const m = voidManualDari(r, set.value)
  editId.value = r.id
  tanggal.value = r.tgl
  Object.assign(f, {
    bill: r.bill || '', penginput: r.penginput || '', salah: r.salah || '', alasan: r.alasan || '',
    items: [{ item: r.item || '', sub: m.sub }],
    svcManual: m.svcManual, taxManual: m.taxManual,
  })
  f.svc = m.svc
  f.tax = m.tax
  merah.value = []
  pesan.value = null
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
// A row being edited can vanish (cancelled from another tab, list refreshed).
// A form pointing at a missing row would save as a NEW row without a sign.
watch(semua, () => {
  if (editId.value && !editBaris.value) kosongkan()
})

function tandai(keys: VoidKunci[]) {
  merah.value = keys
  const k = keys[0]
  if (k) nextTick(() => document.getElementById(k === 'item' ? 'vd-item-0' : `vd-${k}`)?.focus())
}

const menyimpan = ref(false)
async function simpan() {
  const kurang = voidKurang(f)
  if (kurang.length) {
    // HELD, not just warned: a red band while the row still goes out looks the same on screen.
    tandai(kurang)
    pesan.value = { warna: 'error', teks: `Belum lengkap. Masih kosong: ${kurang.map(voidLabel).join(', ')}. Catatan void yang tidak menyebut kronologinya tidak menjawab apa pun waktu angkanya dipertanyakan bulan depan.` }
    return
  }
  const its = voidItemTerisi(f.items).map(x => ({ item: x.item.trim(), subtotal: num(x.sub) }))
  const bersama = { tgl: tanggal.value, bill: f.bill.trim(), penginput: f.penginput.trim(), salah: f.salah.trim(), alasan: f.alasan.trim() }
  menyimpan.value = true
  pesan.value = null
  try {
    const lama = editBaris.value
    if (lama) {
      await putVoidKasir(lama.id, { ...bersama, item: its[0]!.item, subtotal: its[0]!.subtotal, service: f.svc, tax: f.tax }, Math.round(lama.diubah))
    }
    else {
      await postVoidKasir({ ...bersama, service: f.svc, tax: f.tax, items: its })
    }
    // Counted BEFORE the form is emptied — afterwards it always says "1 item".
    const jml = its.length
    kosongkan()
    await refresh()
    pesan.value = { warna: 'success', teks: lama ? 'Perubahan tersimpan di server.' : `Tersimpan di server — ${jml} item.` }
  }
  catch (e) {
    // The server names missing fields by LABEL; mark the same boxes.
    const kurangSrv = voidKunciDariLabel(((e as FetchError<ApiErrorBody>)?.data?.error?.details as { kurang?: unknown } | undefined)?.kurang)
    if (kurangSrv.length) tandai(kurangSrv)
    if (await tanganiKonflik(e, refresh)) return
    // A failure does NOT clear the form: what was just typed is still here.
    pesan.value = { warna: 'error', teks: `BELUM tersimpan ke server. ${apiErrorMessage(e)} Yang barusan diisi masih ada di layar ini — coba tekan simpan lagi.` }
  }
  finally {
    menyimpan.value = false
  }
}

// ---------------------------------------------------------------- cancel
const batalTarget = ref<VoidBaris | null>(null)
const alasanBatal = ref('')
const batalSalah = ref(false)
const batalBuka = computed({
  get: () => !!batalTarget.value,
  set: (v) => {
    if (!v) batalTarget.value = null
  },
})
function mintaBatal(r: VoidBaris) {
  batalTarget.value = r
  alasanBatal.value = ''
  batalSalah.value = false
}
async function batalkan() {
  const r = batalTarget.value
  if (!r) return
  if (!alasanBatal.value.trim()) {
    batalSalah.value = true
    return
  }
  menyimpan.value = true
  try {
    await batalVoidKasir(r.id, alasanBatal.value.trim(), Math.round(r.diubah))
    batalTarget.value = null
    if (editId.value === r.id) kosongkan()
    toast.add({ title: 'Catatan void dibatalkan', description: 'Barisnya tetap tercatat dan dicoret.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: 'Gagal membatalkan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

// ---------------------------------------------------------------- setting
const setelanBuka = ref(false)
const sTax = ref('')
const sSvc = ref('')
watch(set, (s) => {
  sTax.value = String(s.tax)
  sSvc.value = String(s.service)
}, { immediate: true })
const menyimpanSet = ref(false)
async function simpanSetelan() {
  menyimpanSet.value = true
  try {
    await putVoidSettingKasir({ tax: voidPct(sTax.value), service: voidPct(sSvc.value) }, Math.round(set.value.diubah))
    toast.add({ title: 'Setelan tersimpan', description: 'Catatan yang sudah tersimpan tidak ikut berubah.', color: 'success' })
    // The rows being typed follow the new percentages (except overrides) via the watcher.
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: 'Setelan belum tersimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpanSet.value = false
  }
}

const pctTeks = (v: number) => `${String(voidPct(v)).replace('.', ',')}%`
const rinci = (r: VoidBaris) => (r.rinci ? `${fmtRp(r.subtotal)} + svc ${fmtRp(r.service)} + tax ${fmtRp(r.tax)}` : 'rinciannya tidak dicatat')
const diubahTeks = (r: VoidBaris) => (r.diubahOleh && num(r.diubah) > num(r.dibuat) ? `diubah ${r.diubahOleh}` : '')
</script>

<template>
  <AppPage
    title="Catatan void menu"
    description="Tiap menu yang di-void wajib dicatat di sini berikut kronologinya."
  >
    <AppPanel
      title="Tanggal"
      description="Tanggalnya terisi hari ini dan boleh diubah — tanggal yang dipilih di sini juga menentukan tanggal catatan baru."
    >
      <template #actions>
        <UInput
          v-model="tanggal"
          type="date"
          aria-label="Tanggal"
        />
      </template>
    </AppPanel>

    <AppPanel
      :title="editBaris ? `Ubah catatan void — ${editBaris.item}` : 'Tambah catatan void — satu bill, berapa pun itemnya'"
      :icon="editBaris ? 'i-lucide-pencil' : 'i-lucide-plus'"
      :class="editBaris ? 'ring-2 ring-primary-400' : ''"
    >
      <div class="grid gap-3 lg:grid-cols-2">
        <UFormField
          label="Nomor bill"
          required
          :error="merah.includes('bill')"
          help="Wajib diisi."
        >
          <UInput
            id="vd-bill"
            v-model="f.bill"
            placeholder="cth. SLMCL202608020123"
            class="w-full"
            :ui="{ base: 'num' }"
            @update:model-value="lepasMerah('bill')"
          />
        </UFormField>
        <UFormField
          label="Siapa yang menginput"
          required
          :error="merah.includes('penginput')"
          help="Yang mengetik pesanannya di POS, bukan yang mengisi catatan ini (itu tercatat sendiri dari sesi Office)."
        >
          <UInput
            id="vd-penginput"
            v-model="f.penginput"
            placeholder="nama kru yang input pesanan ke POS"
            class="w-full"
            @update:model-value="lepasMerah('penginput')"
          />
        </UFormField>
        <UFormField
          label="Kesalahan dari siapa"
          required
          :error="merah.includes('salah')"
          help="Boleh diketik sendiri kalau tidak ada di pilihan — rekap di Kas Kecil dikelompokkan dari tulisan ini."
          class="lg:col-span-2"
        >
          <UInput
            id="vd-salah"
            v-model="f.salah"
            placeholder="cth. Kasir"
            class="w-full lg:max-w-md"
            @update:model-value="lepasMerah('salah')"
          />
          <div class="mt-2 flex flex-wrap gap-1.5">
            <UButton
              v-for="o in VOID_SALAH_OPSI"
              :key="o"
              :label="o"
              size="xs"
              :color="f.salah === o ? 'primary' : 'neutral'"
              :variant="f.salah === o ? 'solid' : 'outline'"
              @click="f.salah = o; lepasMerah('salah')"
            />
          </div>
        </UFormField>
      </div>

      <!-- Items: name + subtotal; service & tax ONCE for the whole bill below. -->
      <UFormField
        label="Item yang di-void"
        required
        :error="merah.includes('item')"
        class="mt-4"
      >
        <div class="space-y-2">
          <div class="hidden grid-cols-[1fr_12rem_2.5rem] gap-2 text-xs font-semibold text-muted lg:grid">
            <span>Nama item</span><span>Subtotal</span><span />
          </div>
          <div
            v-for="(x, i) in f.items"
            :key="i"
            class="grid grid-cols-[1fr_auto] gap-2 lg:grid-cols-[1fr_12rem_2.5rem]"
          >
            <UInput
              :id="`vd-item-${i}`"
              v-model="x.item"
              placeholder="Nama item — cth. Ice Kopi Laksamana"
              class="col-span-2 w-full lg:col-span-1"
              :color="merah.includes('item') && !x.item.trim() ? 'error' : undefined"
              :highlight="merah.includes('item') && !x.item.trim()"
              @update:model-value="ketikItem"
            />
            <RupiahInput
              v-model="x.sub"
              placeholder="Subtotal"
              aria-label="Subtotal"
            />
            <UButton
              v-if="!editBaris && f.items.length > 1"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              aria-label="Hapus baris ini"
              @click="hapusItem(i)"
            />
            <span v-else />
          </div>
          <UButton
            v-if="!editBaris"
            label="Tambah item"
            icon="i-lucide-plus"
            size="sm"
            color="neutral"
            variant="outline"
            @click="tambahItem"
          />
        </div>
      </UFormField>

      <div class="mt-3 space-y-2 rounded-field bg-muted p-3 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted">Subtotal seluruh item</span>
          <b class="num">{{ fmtRp(subtotalForm) }}</b>
        </div>
        <div class="grid grid-cols-[1fr_12rem] items-center gap-2">
          <span class="text-muted">Service <b class="text-default">{{ pctTeks(set.service) }}</b>
            <AppStatus
              v-if="f.svcManual"
              color="warning"
              size="sm"
              class="ml-1"
            >diketik tangan</AppStatus>
          </span>
          <RupiahInput
            :model-value="f.svc"
            aria-label="Service"
            @update:model-value="ketikSvc"
          />
        </div>
        <div class="grid grid-cols-[1fr_12rem] items-center gap-2">
          <span class="text-muted">Tax <b class="text-default">{{ pctTeks(set.tax) }}</b>
            <AppStatus
              v-if="f.taxManual"
              color="warning"
              size="sm"
              class="ml-1"
            >diketik tangan</AppStatus>
          </span>
          <RupiahInput
            :model-value="f.tax"
            aria-label="Tax"
            @update:model-value="ketikTax"
          />
        </div>
        <UButton
          v-if="f.svcManual || f.taxManual"
          label="Kembalikan ke hitungan otomatis"
          icon="i-lucide-rotate-ccw"
          size="xs"
          color="neutral"
          variant="outline"
          @click="kembaliOtomatis"
        />
        <div class="flex items-center justify-between gap-3 border-t border-default pt-2">
          <b>Total yang di-void</b>
          <b class="num text-base">{{ fmtRp(totalForm) }}</b>
        </div>
        <p
          v-if="editBaris"
          class="text-xs text-muted"
        >
          Menyunting SATU catatan — service &amp; tax di sini berlaku untuk baris ini saja. Untuk menambah item lain di bill ini, batalkan suntingan lalu isi form barunya.
        </p>
        <p
          v-else
          class="text-xs text-muted"
        >
          Service &amp; tax terisi sendiri dari <b>jumlah subtotal seluruh item</b> — ketik di kotaknya kalau bill itu memang tidak kena (compliment, sewa, dan sejenisnya). Server membaginya ke tiap item menurut subtotalnya. Nominal boleh Rp0 kalau barangnya belum sempat dibuat.
        </p>
      </div>

      <UFormField
        label="Alasan / kronologi"
        required
        :error="merah.includes('alasan')"
        help="Inilah yang dibaca finance waktu angkanya dipertanyakan bulan depan. Sebutkan kejadiannya, bukan cuma &quot;salah input&quot;."
        class="mt-4"
      >
        <UTextarea
          id="vd-alasan"
          v-model="f.alasan"
          :rows="3"
          placeholder="cth. Tamu batal pesan karena kelamaan, sudah dikonfirmasi ke SPV floor"
          class="w-full"
          @update:model-value="lepasMerah('alasan')"
        />
      </UFormField>

      <UAlert
        v-if="pesan"
        class="mt-3"
        :color="pesan.warna"
        variant="subtle"
        :icon="pesan.warna === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-circle-check'"
        :title="pesan.teks"
      />
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <UButton
          :label="editBaris ? 'Simpan perubahan' : 'Tambah catatan'"
          :icon="editBaris ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="menyimpan"
          :disabled="!data"
          @click="simpan"
        />
        <UButton
          v-if="editBaris"
          label="Batal"
          color="neutral"
          variant="outline"
          @click="kosongkan"
        />
        <span class="text-xs text-muted">Dicatat atas nama <b>{{ me?.name || '—' }}</b> — namanya diambil dari sesi Office, bukan diketik.</span>
      </div>
    </AppPanel>

    <!-- Shown to everyone, editable only by the module admin: a cashier who sees
         10% & 5% can check them against the receipt in hand. -->
    <AppPanel>
      <button
        type="button"
        class="flex w-full items-center gap-2 text-left text-sm text-muted"
        @click="setelanBuka = !setelanBuka"
      >
        <UIcon
          name="i-lucide-settings"
          class="size-4"
        />
        <span>Setelan tax &amp; service — <b class="text-default">Tax {{ pctTeks(set.tax) }}</b> · <b class="text-default">Service {{ pctTeks(set.service) }}</b><template v-if="set.oleh"> · terakhir diubah {{ set.oleh }}</template></span>
        <UIcon
          :name="setelanBuka ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="ml-auto size-4"
        />
      </button>
      <div
        v-if="setelanBuka"
        class="mt-3 space-y-3"
      >
        <p class="text-xs text-muted">
          Dipakai mengisi Service &amp; Tax otomatis dari <b>jumlah subtotal seluruh item</b> di satu bill. Keduanya dihitung dari subtotal — <b>bukan</b> tax di atas (subtotal + service) — dan itu yang cocok dengan berkas POS: 71 dari 74 baris void Agustus 2026 memenuhi tax = 10% × subtotal.
        </p>
        <template v-if="bisaSetel">
          <div class="grid gap-3 sm:grid-cols-2 lg:max-w-md">
            <UFormField label="Tax (%)">
              <UInput
                v-model="sTax"
                inputmode="decimal"
                class="w-full"
                :ui="{ base: 'num' }"
              />
            </UFormField>
            <UFormField label="Service (%)">
              <UInput
                v-model="sSvc"
                inputmode="decimal"
                class="w-full"
                :ui="{ base: 'num' }"
              />
            </UFormField>
          </div>
          <UButton
            label="Simpan setelan"
            icon="i-lucide-save"
            size="sm"
            :loading="menyimpanSet"
            :disabled="!data"
            @click="simpanSetelan"
          />
          <p class="text-xs text-muted">
            Catatan yang SUDAH tersimpan tidak ikut berubah — angkanya sudah terkunci di barisnya masing-masing.
          </p>
        </template>
        <p
          v-else
          class="text-xs text-muted"
        >
          Hanya admin modul Cashier atau Finance yang bisa mengubahnya.
        </p>
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        :label="`Void ${tglPanjang(tanggal)}`"
        icon="i-lucide-ban"
        :value="fmtRp(rHari.total)"
        :sub="`${rHari.item} item dari ${rHari.bill} bill${rHari.batal ? ` · ${rHari.batal} dibatalkan` : ''}`"
      />
      <AppStat
        label="Void bulan ini"
        icon="i-lucide-calendar-range"
        tone="info"
        :value="fmtRp(rBulan.total)"
        :sub="`${rBulan.item} item dari ${rBulan.bill} bill sepanjang ${bulan}`"
      />
      <AppStat
        label="Rekap lengkap"
        icon="i-lucide-chart-pie"
        tone="vip"
        value="Kas Kecil"
        sub="Di modul Finance: rekap per orang, per alasan, dan pembanding POS"
      />
    </AppStatGrid>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Daftar void tidak terbaca dari server."
      :description="`${apiErrorMessage(error)} Catatan yang sudah tersimpan tidak hilang — yang gagal cuma pembacaannya.`"
    />
    <UAlert
      v-if="potong > 0"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      :title="`Bulan ini punya lebih banyak catatan daripada yang bisa ditarik sekaligus — ${potong} baris tertua tidak ikut ditampilkan.`"
    />

    <AppPanel
      :title="`Void ${tglPanjang(tanggal)}`"
      description="Dikelompokkan per nomor bill — baris tebal adalah bill, penginput, pihak yang salah, dan kronologinya; di bawahnya item yang di-void."
      icon="i-lucide-list"
      :count="rHari.item"
      flush
    >
      <p
        v-if="status === 'pending' && !data"
        class="p-6 text-center text-sm text-muted"
      >
        Memuat dari server…
      </p>
      <p
        v-else-if="!hari.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada catatan void untuk tanggal ini.
      </p>
      <div
        v-else
        class="divide-y divide-default"
      >
        <section
          v-for="g in grupHari"
          :key="g.kunci"
        >
          <header class="flex flex-wrap items-start justify-between gap-2 bg-muted px-4 py-3">
            <div class="min-w-0">
              <b class="num text-highlighted">{{ g.bill }}</b>
              <span class="text-sm text-muted"> · diinput {{ g.baris[0]?.penginput || '—' }} · salah <b class="text-default">{{ g.baris[0]?.salah || '—' }}</b></span>
              <p class="mt-1 max-w-2xl whitespace-pre-wrap text-xs text-muted">
                {{ g.baris[0]?.alasan || '—' }}
              </p>
            </div>
            <div class="text-right">
              <b class="num">{{ fmtRp(g.total) }}</b>
              <span class="block text-xs text-muted">{{ g.hidup.length }} item<template v-if="g.baris.length - g.hidup.length"> · {{ g.baris.length - g.hidup.length }} dibatalkan</template> · oleh {{ g.baris[0]?.oleh || '—' }}</span>
            </div>
          </header>
          <div
            v-for="r in g.baris"
            :key="r.id"
            class="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 lg:pl-8"
            :class="voidAktif(r) ? '' : 'opacity-60'"
          >
            <div class="min-w-0 flex-1">
              <b
                class="text-highlighted"
                :class="voidAktif(r) ? '' : 'line-through'"
              >{{ r.item || '—' }}</b>
              <span
                v-if="!voidAktif(r)"
                class="block text-xs text-muted"
              >Dibatalkan {{ r.batalOleh }}<template v-if="r.batalAlasan"> — {{ r.batalAlasan }}</template></span>
              <span
                v-if="diubahTeks(r)"
                class="block text-xs text-muted"
              >{{ diubahTeks(r) }}</span>
            </div>
            <div class="text-right">
              <span class="num">{{ fmtRp(r.nominal) }}</span>
              <span class="block text-xs text-muted">{{ rinci(r) }}</span>
            </div>
            <div class="flex gap-1">
              <AppStatus
                v-if="!voidAktif(r)"
                size="sm"
              >
                dibatalkan
              </AppStatus>
              <template v-else>
                <UButton
                  label="Ubah"
                  icon="i-lucide-pencil"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="ubah(r)"
                />
                <UButton
                  label="Batalkan"
                  icon="i-lucide-ban"
                  size="xs"
                  color="error"
                  variant="soft"
                  @click="mintaBatal(r)"
                />
              </template>
            </div>
          </div>
        </section>
      </div>
    </AppPanel>

    <CashierKonfirmasi
      v-model:open="batalBuka"
      :title="`Batalkan catatan void “${batalTarget?.item || ''}” (bill ${batalTarget?.bill || '—'})?`"
      description="Barisnya TIDAK dihapus — ia tetap tercatat, dicoret, dan tidak ikut dijumlahkan."
      confirm-label="Batalkan catatan"
      :loading="menyimpan"
      @konfirmasi="batalkan"
    >
      <UFormField
        label="Alasan pembatalan"
        required
        :error="batalSalah ? 'Alasan pembatalan wajib diisi.' : false"
      >
        <UTextarea
          v-model="alasanBatal"
          :rows="3"
          class="w-full"
          @update:model-value="batalSalah = false"
        />
      </UFormField>
    </CashierKonfirmasi>
  </AppPage>
</template>
