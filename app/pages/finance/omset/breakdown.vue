<!--
  Finance › Omset › Breakdown Sumber Omset (old `viewBreakdown`, deploy/finance/omset/index.html:3258-4160).

  Section A: omset per kasir (BRUTO − the bill discount they gave). Self Order
  never belongs to a cashier. Section B (marketing) DEDUCTS the cashier shift by
  the FULL amount column (porsi-pic.ts `potonganBarisKompas`, the Kompas twin of
  K-04); Section C (event) deducts nobody. Marketing/event do NOT add to the
  total — the cashiers alone must equal the day's net.

  The save gate is the old one: balance AND every marketing row with an amount
  has a shift. A row without a shift would leave the deduction uncharged, making
  the same money count twice (PIC recognition + full cashier revenue), and the
  difference only surfaces days later in Performa Kasir. PIC-less rows do NOT
  block, but are warned about: their money is recognised for nobody.

  DEFERRED (needs the Marketing/Event modules): the auto-absorbed rows (deal
  events, Assisted VIP reservations, internal events from the Event module) and
  the `abaikan` edit of them. Rows are added manually here; `abaikan` is carried
  through untouched.
-->
<script setup lang="ts">
import type { BarisBd, BarisHarian } from '~/utils/kompas'
import { kNum, netOf, taxSvcOf, tagihanOf } from '~/utils/kompas'
import type { PicKompas } from '~/utils/porsi-pic'
import { obAktif, obTotal, potonganBarisKompas, potongKasirAktif } from '~/utils/porsi-pic'
import { fmtRp, fmtSel, jejakList, tambahJejak } from '~/utils/cashier'
import { getDay, getKompasState, putDay } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['kompas'] })

const me = useMe()
const toast = useToast()
const route = useRoute()
const tanggal = ref(typeof route.query.tgl === 'string' && route.query.tgl ? route.query.tgl : hariIni())

const { data, status, error, refresh } = useAsyncData(
  'omset-breakdown',
  async () => {
    const [day, state] = await Promise.all([getDay(tanggal.value), getKompasState()])
    return { day, state }
  },
  { watch: [tanggal] },
)

const rows = computed(() => data.value?.day.value.rows ?? [])
const rec = computed<BarisHarian | null>(() => rows.value.find(r => r.date === tanggal.value) ?? null)
const net = computed(() => (rec.value ? netOf(rec.value) : 0))
const employees = computed(() => data.value?.state.value.employees ?? {})
const kasirList = computed<PicKompas[]>(() => employees.value.kasir ?? [])
const mkList = computed<PicKompas[]>(() => employees.value.marketing ?? [])
const evList = computed<PicKompas[]>(() => employees.value.event ?? [])

const mk = ref<BarisBd[]>([])
const ev = ref<BarisBd[]>([])
const ks = ref<BarisBd[]>([])
const so = ref<{ amount: number | string, disc: number | string }>({ amount: 0, disc: 0 })

function barisBaru(): BarisBd {
  return { amount: 0, disc: 0, off: false, shift: [], menuFix: '', payGroup: true, ob: false, obAmount: 0, obTax: 0, obService: 0, obKasirId: '', eventName: '', picId: '', tax: 0, service: 0 }
}
function isiDariServer() {
  const d = rec.value
  const bd = (d?.bd ?? {}) as { marketing?: BarisBd[], event?: BarisBd[], kasir?: BarisBd[], self?: { amount?: unknown, disc?: unknown } }
  mk.value = (bd.marketing ?? []).map(r => ({ ...r }))
  ev.value = (bd.event ?? []).map(r => ({ ...r }))
  so.value = { amount: kNum(bd.self?.amount), disc: kNum(bd.self?.disc) }
  const lama: BarisBd[] = bd.kasir ?? []
  ks.value = kasirList.value.map((k) => {
    const ex = lama.find(r => r.kasirId === k.id)
    return ex ? { ...ex } : { kasirId: k.id, amount: 0, disc: 0, off: false }
  })
  // Baris marketing yang shift-nya memuat kasir OFF dirapikan di layar saja;
  // perubahannya baru mengikat kalau disimpan (legacy :3340-3343).
  for (const r of ks.value) if (r.off) buangDariShift(String(r.kasirId))
}
watch([rec, kasirList], () => {
  isiDariServer()
}, { immediate: true })

function buangDariShift(id: string) {
  for (const r of [...mk.value, ...ev.value]) {
    if (Array.isArray(r.shift)) r.shift = r.shift.filter(x => x !== id)
  }
}
function set(r: BarisBd, k: string, v: unknown) {
  r[k] = v
}
function ubahOff(r: BarisBd, off: boolean) {
  r.off = off
  if (off) buangDariShift(String(r.kasirId))
}
function tambahMk() {
  mk.value.push(barisBaru())
}
function tambahEv() {
  ev.value.push(barisBaru())
}
function hapusMk(i: number) {
  const r = mk.value[i]
  if (r?.srcId) abaikanSementara.push(String(r.srcId))
  mk.value.splice(i, 1)
}
function hapusEv(i: number) {
  const r = ev.value[i]
  if (r?.srcId) abaikanSementara.push(String(r.srcId))
  ev.value.splice(i, 1)
}
const abaikanSementara: string[] = []
function isiSisa(i: number) {
  const r = ks.value[i]
  if (!r || r.off) return
  const cur = kNum(r.amount) - kNum(r.disc)
  r.amount = Math.max(0, net.value - (sumDiakui.value - cur)) + kNum(r.disc)
}

const sumKasir = computed(() => ks.value.reduce((s, r) => s + (r.off ? 0 : kNum(r.amount) - kNum(r.disc)), 0))
const selfOmset = computed(() => kNum(so.value.amount) - kNum(so.value.disc))
const sumDiakui = computed(() => sumKasir.value + selfOmset.value)
const diff = computed(() => net.value - sumDiakui.value)
const balance = computed(() => Math.abs(diff.value) < 1)
const belum = computed(() => mk.value.filter(r => potongKasirAktif(r) && kNum(r.amount) > 0 && potonganBarisKompas(r).pembagi <= 0))
const ok = computed(() => balance.value && belum.value.length === 0)
const dHari = computed(() => kNum(rec.value?.discount))
const dTot = computed(() => ks.value.reduce((s, r) => s + (r.off ? 0 : kNum(r.disc)), 0) + kNum(so.value.disc))
const dSel = computed(() => dHari.value - dTot.value)
const lebihan = computed(() => {
  const l = ks.value.filter(r => !r.off && kNum(r.disc) > kNum(r.amount))
  if (kNum(so.value.disc) > kNum(so.value.amount)) l.push({ kasirId: '', self: true } as BarisBd)
  return l
})
const tanpaPic = computed(() => [
  ...mk.value.filter(r => !mkList.value.some(e => e.id === r.picId)).map(r => ({ r, divi: 'Marketing' })),
  ...ev.value.filter(r => !evList.value.some(e => e.id === r.picId)).map(r => ({ r, divi: 'Event' })),
])
const nilaiTanpaPic = computed(() => tanpaPic.value.reduce((s, x) => s + kNum(x.r.amount), 0))
const potongUntuk = (id: string) => mk.value.reduce((s, r) => {
  const b = potonganBarisKompas(r)
  return s + (b.ids.includes(id) ? b.per : 0)
}, 0)
const obUntuk = (id: string) => [...mk.value, ...ev.value]
  .filter(r => obAktif(r) && String(r.obKasirId || '') === id)
  .reduce((s, r) => s + obTotal(r), 0)
const efek = computed(() => ks.value.filter(r => !r.off).map((r) => {
  const id = String(r.kasirId)
  const bruto = kNum(r.amount)
  const disc = kNum(r.disc)
  const potong = potongUntuk(id)
  return { id, nama: kasirList.value.find(k => k.id === id)?.name ?? '—', bruto, disc, potong, real: bruto - disc - potong, ob: obUntuk(id) }
}))
const compHari = computed(() => (data.value?.state.value.compliments ?? [])
  .filter(c => c.date === tanggal.value && c.picDiv !== 'tamu'))

const jejak = computed(() => jejakList(rec.value))

const shiftOpen = ref(false)
const shiftRow = ref<BarisBd | null>(null)
const namaKasir = (id: string) => kasirList.value.find(k => k.id === id)?.name ?? id
function bukaShift(r: BarisBd) {
  if (!Array.isArray(r.shift)) r.shift = []
  shiftRow.value = r
  shiftOpen.value = true
}
function toggleShift(id: string) {
  const r = shiftRow.value
  if (!r) return
  const s = Array.isArray(r.shift) ? r.shift.slice() : []
  const i = s.indexOf(id)
  if (i >= 0) s.splice(i, 1)
  else s.push(id)
  r.shift = s
}

const simpanOpen = ref(false)
const menyimpan = ref(false)
async function jalanSimpan() {
  const d = rec.value
  if (!d || !data.value || menyimpan.value) return
  menyimpan.value = true
  const bd = {
    ...(d.bd ?? {}),
    marketing: mk.value,
    event: ev.value,
    kasir: ks.value,
    self: { amount: kNum(so.value.amount), disc: kNum(so.value.disc) },
    abaikan: [...new Set([...(((d.bd ?? {}) as { abaikan?: string[] }).abaikan ?? []), ...abaikanSementara])],
  }
  const baru: BarisHarian = { ...d, bd, bdValid: true, bdLog: tambahJejak({ log: d.bdLog }, me.value?.name ?? '') }
  const rowsBaru = [...rows.value.filter(r => r.date !== tanggal.value), baru]
  try {
    data.value.day = await putDay(tanggal.value, rowsBaru, data.value.day.version)
    // B2: real API 200 but the screen only updates after reload — re-read
    // (same finding as fix/api-cashier for the Kompas panels).
    await refresh()
    simpanOpen.value = false
    toast.add({ title: `Breakdown ${tglPanjang(tanggal.value)} tersimpan.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

const labelKasirShift = (r: BarisBd) => {
  const s = Array.isArray(r.shift) ? r.shift.filter(Boolean) as string[] : []
  return s.length ? s.map(namaKasir).join(', ') : '— belum dipilih —'
}

// Reka UI's SelectItem refuses an EMPTY value, so "not chosen yet" travels as a
// sentinel and is mapped back to '' on write. The stored value stays '' — the
// missing PIC is a real state, never the first name in the list (:3345-3360).
const KOSONG = '__kosong'
const opsiPic = (list: PicKompas[]) => [{ label: '— pilih PIC —', value: KOSONG }, ...list.map(e => ({ label: e.name, value: e.id }))]
const pilihPic = (r: BarisBd, v: string) => set(r, 'picId', v === KOSONG ? '' : v)
const opsiMenu = [
  { label: '— belum ditentukan —', value: KOSONG },
  { label: 'Menu ditetapkan (kasir dipotong)', value: 'tetap' },
  { label: 'Menu dipilih di tempat (tidak memotong)', value: 'ditempat' },
]
const pilihMenu = (r: BarisBd, v: string) => set(r, 'menuFix', v === KOSONG ? '' : v)
const opsiKasir = (list: PicKompas[]) => [{ label: '— pilih kasir —', value: KOSONG }, ...list.map(e => ({ label: e.name, value: e.id }))]
const pilihKasirOb = (r: BarisBd, v: string) => set(r, 'obKasirId', v === KOSONG ? '' : v)
</script>

<template>
  <AppPage
    title="Breakdown sumber omset"
    description="Isi omset per kasir, lalu potong untuk event marketing, Reservasi VIP & event internal."
  >
    <template #actions>
      <UInput
        v-model="tanggal"
        type="date"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Ke input omset"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="outline"
        size="sm"
        :to="`/finance/omset/input?tgl=${tanggal}`"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <AppPanel v-if="!rec && status !== 'pending'">
      <p class="py-4 text-center text-sm text-muted">
        Belum ada omset untuk <b>{{ tglPanjang(tanggal) }}</b>.<br>
        Input omsetnya dulu di menu <ULink
          :to="`/finance/omset/input?tgl=${tanggal}`"
          class="font-semibold text-primary-700"
        >Input Omset Harian</ULink>, atau pilih tanggal lain di atas.
      </p>
    </AppPanel>

    <template v-else-if="rec">
      <AppPanel
        :description="`Total omset net ${fmtRp(net)}${kNum(rec.discount) > 0 ? ` (sesudah diskon ${fmtRp(kNum(rec.discount))})` : ''}. Service charge + tax ${fmtRp(taxSvcOf(rec))} tidak masuk breakdown. Tagihan hari itu ${fmtRp(tagihanOf(rec))}.`"
      >
        <UAlert
          v-if="compHari.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-gift"
          :title="`Ada ${compHari.length} compliment hari ini yang membebani PIC, total ${fmtRp(compHari.reduce((s, c) => s + kNum(c.subTotal ?? c.nominal), 0))} menurut Sub Total-nya.`"
          description="Angka ini memotong realisasi PIC bersangkutan di Performa & Ranking — alokasi breakdown di bawah tidak perlu dikurangi sendiri."
        />
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Baris otomatis dari modul Marketing/Event belum dibawa (modulnya belum bermigrasi)."
          description="Deal event, Reservasi VIP, dan event internal ditambahkan manual dulu di Section B/C. Baris yang tersimpan dari alur lama tetap termuat dan bisa disunting seperti biasa."
          class="mt-2"
        />
      </AppPanel>

      <AppPanel
        title="Section A — omset per kasir"
        description="Semua uang lewat meja kasir, termasuk tiket event dan tagihan gathering. Omset diisi BRUTO (sebelum diskon); yang diakui = bruto − diskon. Total yang diakui harus sama dengan omset net — Section B & C di bawah TIDAK menambah total, tapi memotong dari kasir yang kena shift-nya. Centang OFF jika kasir libur."
      >
        <div class="divide-y divide-default">
          <div
            v-for="(r, i) in ks"
            :key="String(r.kasirId)"
            class="flex flex-wrap items-end gap-3 py-3"
            :class="r.off ? 'opacity-60' : ''"
          >
            <div class="min-w-40 flex-1">
              <p class="font-semibold text-highlighted">
                {{ namaKasir(String(r.kasirId)) }}
              </p>
              <UCheckbox
                :model-value="!!r.off"
                label="OFF (libur)"
                class="mt-1"
                @update:model-value="(v: boolean | 'indeterminate') => ubahOff(r, v === true)"
              />
            </div>
            <UFormField label="Omset bruto">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-32"
                :disabled="!!r.off"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <UFormField label="Diskon diberikan">
              <UInput
                :model-value="String(r.disc ?? 0)"
                inputmode="numeric"
                class="w-32"
                :disabled="!!r.off"
                @update:model-value="(v: string | number) => set(r, 'disc', v)"
              />
            </UFormField>
            <div class="pb-2 text-sm">
              <span class="text-muted">Diakui</span>
              <b class="ms-1 text-highlighted num">{{ fmtRp(r.off ? 0 : kNum(r.amount) - kNum(r.disc)) }}</b>
            </div>
            <UButton
              v-if="!r.off"
              label="Isi sisa"
              color="neutral"
              variant="ghost"
              size="xs"
              class="mb-2"
              @click="isiSisa(i)"
            />
          </div>
        </div>
        <p class="mt-2 text-sm text-muted">
          Total diakui kasir: <b class="text-highlighted num">{{ fmtRp(sumKasir) }}</b> · target net <b class="text-highlighted num">{{ fmtRp(net) }}</b>
          <span
            v-if="Math.abs(net - sumKasir) >= 1"
            class="text-error"
          > · selisih {{ fmtSel(net - sumKasir) }}</span>
        </p>
      </AppPanel>

      <AppPanel
        title="Self order"
        description="Tamu memesan sendiri lewat barcode di meja — tidak ada kasir yang melayani, jadi nominalnya bukan omset kasir mana pun: tidak masuk Performa Kasir, tidak kena potongan event, tidak ikut menghitung bonus. Uangnya tetap dialokasikan di sini supaya harian ini balance."
      >
        <div class="flex flex-wrap gap-4">
          <UFormField label="Omset bruto (self)">
            <UInput
              :model-value="String(so.amount ?? 0)"
              inputmode="numeric"
              class="w-36"
              @update:model-value="(v: string | number) => { so.amount = v }"
            />
          </UFormField>
          <UFormField label="Diskon diberikan">
            <UInput
              :model-value="String(so.disc ?? 0)"
              inputmode="numeric"
              class="w-36"
              @update:model-value="(v: string | number) => { so.disc = v }"
            />
          </UFormField>
          <div class="self-end pb-1 text-sm text-muted">
            Diakui: <b class="text-highlighted num">{{ fmtRp(selfOmset) }}</b>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Section B — marketing (memotong kasir shift)"
        description="Nilai event dipecah Omset, Tax, dan Service. Realisasi PIC = ketiganya; yang dipotong dari kasir shift HANYA kolom Omset. Menu ditetapkan → kasir yang menginput dipotong; menu dipilih di tempat → tidak ada potongan. Tanpa PIC, nominalnya tidak diakui untuk siapa pun di Performa Marketing."
      >
        <div
          v-for="(r, i) in mk"
          :key="`mk${i}`"
          class="mb-4 rounded-field border border-default p-3"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="PIC">
              <USelect
                :model-value="String(r.picId || KOSONG)"
                :items="opsiPic(mkList)"
                class="w-full"
                @update:model-value="(v: string) => pilihPic(r, v)"
              />
            </UFormField>
            <UFormField label="Nama event">
              <UInput
                :model-value="String(r.eventName || '')"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'eventName', v)"
              />
            </UFormField>
            <UFormField label="Omset">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <UFormField label="Tax">
              <UInput
                :model-value="String(r.tax ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'tax', v)"
              />
            </UFormField>
            <UFormField label="Service">
              <UInput
                :model-value="String(r.service ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'service', v)"
              />
            </UFormField>
            <UFormField label="Menu">
              <USelect
                :model-value="String(r.menuFix || KOSONG)"
                :items="opsiMenu"
                class="w-full"
                @update:model-value="(v: string) => pilihMenu(r, v)"
              />
            </UFormField>
            <UFormField label="Payment group">
              <UCheckbox
                :model-value="r.payGroup !== false"
                label="Wajib potong (bayar per grup)"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'payGroup', v === true)"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <UButton
                :label="`Atur kasir shift`"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaShift(r)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Buang baris"
                @click="hapusMk(i)"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <AppStatus
              :color="potongKasirAktif(r) ? 'warning' : 'success'"
              size="sm"
            >
              {{ potongKasirAktif(r) ? `memotong kasir · ${fmtRp(potonganBarisKompas(r).total)}` : 'tidak memotong kasir' }}
            </AppStatus>
            <span>Shift: <b class="text-highlighted">{{ labelKasirShift(r) }}</b></span>
            <span>Diakui PIC: <b class="text-highlighted num">{{ fmtRp(kNum(r.amount) + kNum(r.tax) + kNum(r.service) + obTotal(r)) }}</b></span>
            <UTooltip text="Open Bill: pesanan tambahan tamu event di luar paket; diakui PENUH untuk PIC dan TIDAK dipotong dari kasir.">
              <UCheckbox
                :model-value="!!r.ob"
                label="Open bill"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'ob', v === true)"
              />
            </UTooltip>
          </div>
          <div
            v-if="r.ob"
            class="mt-2 grid gap-3 sm:grid-cols-4"
          >
            <UFormField label="OB amount">
              <UInput
                :model-value="String(r.obAmount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obAmount', v)"
              />
            </UFormField>
            <UFormField label="OB tax">
              <UInput
                :model-value="String(r.obTax ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obTax', v)"
              />
            </UFormField>
            <UFormField label="OB service">
              <UInput
                :model-value="String(r.obService ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obService', v)"
              />
            </UFormField>
            <UFormField
              label="Kasir pelayan OB"
              help="Keterangan pengakuan; tidak menambah omsetnya."
            >
              <USelect
                :model-value="String(r.obKasirId || KOSONG)"
                :items="opsiKasir(kasirList)"
                class="w-full"
                @update:model-value="(v: string) => pilihKasirOb(r, v)"
              />
            </UFormField>
          </div>
        </div>
        <UButton
          label="+ Tambah data marketing"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahMk"
        />
      </AppPanel>

      <AppPanel
        title="Section C — event internal (diakui 50%, kasir tidak dipotong)"
        description="Yang diakui untuk target PIC event separuh nominalnya, dihitung otomatis. Kasir tidak dipotong sama sekali. Open Bill diakui penuh, tidak ikut dibagi dua."
      >
        <div
          v-for="(r, i) in ev"
          :key="`ev${i}`"
          class="mb-4 rounded-field border border-default p-3"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="PIC">
              <USelect
                :model-value="String(r.picId || KOSONG)"
                :items="opsiPic(evList)"
                class="w-full"
                @update:model-value="(v: string) => pilihPic(r, v)"
              />
            </UFormField>
            <UFormField label="Nama event">
              <UInput
                :model-value="String(r.eventName || '')"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'eventName', v)"
              />
            </UFormField>
            <UFormField label="Nilai event">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Buang baris"
                @click="hapusEv(i)"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Diakui PIC: <b class="text-highlighted num">{{ fmtRp(Math.round(kNum(r.amount) / 2) + obTotal(r)) }}</b> (50% + open bill)</span>
            <UTooltip text="Open Bill diakui PENUH untuk PIC event dan tidak dipotong dari kasir mana pun.">
              <UCheckbox
                :model-value="!!r.ob"
                label="Open bill"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'ob', v === true)"
              />
            </UTooltip>
          </div>
          <div
            v-if="r.ob"
            class="mt-2 grid gap-3 sm:grid-cols-4"
          >
            <UFormField label="OB amount">
              <UInput
                :model-value="String(r.obAmount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obAmount', v)"
              />
            </UFormField>
            <UFormField label="OB tax">
              <UInput
                :model-value="String(r.obTax ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obTax', v)"
              />
            </UFormField>
            <UFormField label="OB service">
              <UInput
                :model-value="String(r.obService ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obService', v)"
              />
            </UFormField>
            <UFormField label="Kasir pelayan OB">
              <USelect
                :model-value="String(r.obKasirId || KOSONG)"
                :items="opsiKasir(kasirList)"
                class="w-full"
                @update:model-value="(v: string) => pilihKasirOb(r, v)"
              />
            </UFormField>
          </div>
        </div>
        <UButton
          label="+ Tambah data event"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahEv"
        />
      </AppPanel>

      <AppPanel
        v-if="efek.length"
        title="Efek ke realisasi kasir"
        description="Rincian lengkap ada di sini, bukan di halaman Performa Kasir — di sana yang tampil hanya angka finalnya. Diskon yang diberikan seorang kasir tidak pernah jadi omsetnya."
      >
        <table class="w-full text-sm">
          <thead class="bg-table-head text-table-head-text">
            <tr>
              <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                Kasir
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Omset bruto
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Diskon
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Potongan event
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Realisasi
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Open bill
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="e in efek"
              :key="e.id"
            >
              <td class="px-3 py-2">
                {{ e.nama }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(e.bruto) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.disc ? `−${fmtRp(e.disc)}` : '—' }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.potong ? `−${fmtRp(e.potong)}` : '—' }}
              </td>
              <td class="px-3 py-2 text-end font-semibold num">
                {{ fmtRp(e.real) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.ob ? fmtRp(e.ob) : 'Rp0' }}
              </td>
            </tr>
          </tbody>
        </table>
      </AppPanel>

      <AppPanel title="Peringatan & simpan">
        <UAlert
          v-if="lebihan.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${lebihan.map(r => r.self ? 'Self Order' : namaKasir(String(r.kasirId))).join(', ')} diberi diskon lebih besar daripada omset brutonya sendiri.`"
          description="Kolom omset harus diisi BRUTO (sebelum diskon), bukan setoran bersihnya."
        />
        <UAlert
          v-else-if="dHari !== dTot"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Diskon yang sudah diatribusikan ${fmtRp(dTot)}, sedangkan Discount di Input Omset Harian ${fmtRp(dHari)} — ${dSel > 0 ? `masih ada ${fmtRp(dSel)} yang belum ditulis atas nama kasir mana pun (atau Self Order)` : `kelebihan ${fmtRp(-dSel)}`}.`"
          description="Selama belum cocok, tidak ada catatan siapa yang memberi diskon itu — meski total omsetnya tetap benar."
        />
        <UAlert
          v-else-if="dHari > 0"
          color="success"
          variant="subtle"
          icon="i-lucide-check"
          :title="`Seluruh diskon ${fmtRp(dHari)} sudah tercatat atas nama pemberinya.`"
        />
        <UAlert
          v-if="tanpaPic.length"
          color="error"
          variant="subtle"
          icon="i-lucide-user-x"
          :title="`${tanpaPic.length} baris belum dipilih PIC-nya${nilaiTanpaPic ? ` (total ${fmtRp(nilaiTanpaPic)})` : ''}.`"
          :description="`Nominalnya tidak akan muncul di Performa Marketing/Event — tidak diakui untuk siapa pun. ${tanpaPic.map(x => `${x.divi}: ${x.r.eventName || '(tanpa nama)'}`).join(' · ')}`"
          class="mt-2"
        />
        <UAlert
          v-if="belum.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Belum bisa disimpan. ${belum.length} baris marketing belum ditentukan kasir shift-nya${belum.some(r => r.eventName) ? ` (${belum.map(r => r.eventName).join(', ')})` : ''}.`"
          :description="`Potongan ${fmtRp(belum.reduce((s, r) => s + potonganBarisKompas(r).total, 0))} tidak dibebankan ke kasir mana pun, jadi omset itu terhitung dua kali — sekali di realisasi PIC, sekali di realisasi kasir. Klik tombol Atur kasir shift pada barisnya.`"
          class="mt-2"
        />

        <div class="mt-4 flex flex-wrap items-center gap-4">
          <div class="flex flex-wrap gap-4 text-sm">
            <span class="text-muted">Total diakui <b class="text-highlighted num">{{ fmtRp(sumDiakui) }}</b></span>
            <span class="text-muted">Net <b class="text-highlighted num">{{ fmtRp(net) }}</b></span>
            <span class="text-muted">Diskon tercatat <b class="text-highlighted num">{{ fmtRp(dTot) }} / {{ fmtRp(dHari) }}</b></span>
            <span class="text-muted">Selisih <b :class="ok ? 'text-success' : 'text-error'">{{ diff === 0 ? 'Rp0' : (diff > 0 ? `Kurang ${fmtRp(diff)}` : `Lebih ${fmtRp(-diff)}`) }}</b></span>
          </div>
          <div class="flex-1" />
          <AppStatus
            :color="ok ? 'success' : 'error'"
            size="md"
          >
            {{ ok ? 'Valid, siap disimpan' : (!balance ? 'Belum balance' : `${belum.length} baris belum ada kasir shift-nya`) }}
          </AppStatus>
          <UButton
            label="Simpan breakdown"
            icon="i-lucide-save"
            :disabled="!ok"
            @click="simpanOpen = true"
          />
        </div>
        <div
          v-if="jejak.length"
          class="mt-3 text-xs text-muted"
        >
          Jejak atur: {{ jejak.map(j => `${j.by || '—'} ${new Date(j.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ') }}
        </div>
        <p
          v-else
          class="mt-3 text-xs text-muted"
        >
          Breakdown hari ini belum pernah disimpan, atau diatur sebelum jejaknya dicatat.
        </p>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="shiftOpen"
      :title="shiftRow?.eventName ? `Kasir shift — ${shiftRow.eventName}` : 'Kasir shift'"
    >
      <p class="mb-3 text-sm text-muted">
        Yang dicentang saja yang ikut menanggung potongan baris ini. Kasir yang masuk tapi tidak kebagian shift event tidak dipotong.
      </p>
      <div class="space-y-2">
        <UCheckbox
          v-for="k in kasirList"
          :key="k.id"
          :model-value="Array.isArray(shiftRow?.shift) && (shiftRow!.shift as string[]).includes(k.id)"
          :label="k.name"
          @update:model-value="() => toggleShift(k.id)"
        />
      </div>
      <template #footer>
        <UButton
          label="Selesai"
          @click="shiftOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="simpanOpen"
      :title="`Simpan breakdown ${tglPanjang(tanggal)}?`"
    >
      <ul class="space-y-1 text-sm">
        <li>Total omset diakui: <b class="num">{{ fmtRp(sumDiakui) }}</b></li>
        <li>Total omset (net): <b class="num">{{ fmtRp(net) }}</b></li>
        <li>Selisih: <b class="num">{{ diff === 0 ? 'Rp0' : (diff > 0 ? `Kurang ${fmtRp(diff)}` : `Lebih ${fmtRp(-diff)}`) }}</b></li>
        <li>Baris: {{ mk.length }} marketing, {{ ev.length }} event</li>
      </ul>
      <p class="mt-3 text-sm text-muted">
        Datanya dikirim ke server sekarang. Tunggu sampai muncul pesan tersimpan sebelum menutup halaman.
      </p>
      <template #footer>
        <UButton
          label="Simpan"
          :loading="menyimpan"
          @click="jalanSimpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="simpanOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
