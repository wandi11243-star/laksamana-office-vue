<!--
  Finance › Omset › Input Omset Harian (old `viewInput`, deploy/finance/omset/index.html:1317-1537).

  Layout as the old screen: left — the "Informasi & Pendapatan" form (Tanggal +
  Hari, then Pendapatan / Jumlah Item Terjual / Data Operasional with the old
  labels) and "Pencocokan dengan Report Daily" under it; right — Total Omset,
  Avg Spending + Service/Tax, and "Pencapaian Bulan Berjalan".

  The day is born here; Breakdown allocates it. Validation is the old
  `saveDaily` list (negatives, empty revenue, discount over gross, traffic ≥
  bills) — the Report Daily difference gate was REMOVED 4 Aug 2026: a day with a
  receivable is always off by the bon, and locking the save only makes people
  invent numbers. The difference is shown, with the bon correction, never
  enforced.

  Written as ONE day part: PUT /kompas/days/{date} with that day's version.
  Editing keeps every other field of the row (bd, bdValid) — the old editor
  merged too, and a replace would silently drop the allocation.
-->
<script setup lang="ts">
import type { BarisHarian } from '~/utils/kompas'
import { avgSpendOf, grossOf, kNum, monthKeyOf, netOf, tagihanOf, taxSvcOf, validasiHarian } from '~/utils/kompas'
import { PAYS, SELISIH_TOLERANSI, bonRingkasHari, fmtRp, fmtSel, jejakList, repPay, tambahJejak } from '~/utils/cashier'
import { getDay, getPiutang, getReport, putDay, useKompasState } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'

definePageMeta({ access: ['kompas'] })

const me = useMe()
const toast = useToast()
const route = useRoute()
const tanggal = ref(typeof route.query.tgl === 'string' && route.query.tgl ? route.query.tgl : hariIni())

const kp = useKompasState()
const { data, status: dayStatus, error: dayError, refresh } = useAsyncData(
  'omset-input',
  async () => {
    const [day, rep, bon] = await Promise.all([
      getDay(tanggal.value),
      getReport(tanggal.value),
      getPiutang(),
    ])
    return { day, rep, bon }
  },
  { watch: [tanggal] },
)
const status = computed(() => dayStatus.value === 'pending' || kp.status.value === 'pending' ? 'pending' : dayStatus.value)
const error = computed(() => dayError.value ?? kp.error.value)
const refreshSemua = async () => {
  await Promise.all([refresh(), kp.refresh()])
}

const rows = computed(() => data.value?.day.value.rows ?? [])
const rec = computed<BarisHarian | null>(() => rows.value.find(r => r.date === tanggal.value) ?? null)

type Kolom = 'food' | 'bev' | 'lainnya' | 'discount' | 'service_charge' | 'tax' | 'traffic' | 'bill' | 'qty_food' | 'qty_bev' | 'qty_others'
const KOSONG: Record<Kolom, number> = { food: 0, bev: 0, lainnya: 0, discount: 0, service_charge: 0, tax: 0, traffic: 0, bill: 0, qty_food: 0, qty_bev: 0, qty_others: 0 }
const form = reactive<Record<Kolom, number>>({ ...KOSONG })
const kotor = ref(false)
const ditolak = ref(false)

function isiDariServer() {
  const r = rec.value
  for (const k of Object.keys(KOSONG) as Kolom[]) form[k] = kNum(r?.[k])
  kotor.value = false
}
watch(rec, () => {
  if (kotor.value && ditolak.value) return
  isiDariServer()
}, { immediate: true })
watch(tanggal, () => {
  kotor.value = false
  ditolak.value = false
})

function ubah(k: Kolom, v: string | number) {
  form[k] = kNum(v)
  kotor.value = true
}

const net = computed(() => netOf(form))
const gross = computed(() => grossOf(form))
const taxSvc = computed(() => taxSvcOf(form))
const tagihan = computed(() => tagihanOf(form))
const avg = computed(() => avgSpendOf(form))

const rep = computed(() => data.value?.rep.value ?? null)
const setoran = computed(() => (rep.value ? PAYS.reduce((s, p) => s + repPay(rep.value, p.k).actual, 0) : null))
const bhIn = computed(() => bonRingkasHari(data.value?.bon.value ?? [], tanggal.value))
const koreksi = computed(() => bhIn.value.totLunas - bhIn.value.totBaru)
const selisih = computed(() => tagihan.value - (setoran.value ?? 0) + koreksi.value)
const lewat = computed(() => setoran.value !== null && Math.abs(selisih.value) > SELISIH_TOLERANSI)

const lainHari = computed(() => (kp.data.value?.value.daily ?? [])
  .filter(d => monthKeyOf(d.date) === monthKeyOf(tanggal.value) && d.date !== tanggal.value))
const bReal = computed(() => lainHari.value.reduce((s, d) => s + tagihanOf(d), 0) + tagihan.value)
const bHari = computed(() => lainHari.value.length + 1)
const bAvg = computed(() => (bHari.value ? bReal.value / bHari.value : 0))
const jejak = computed(() => jejakList(rec.value))

const labelBulan = computed(() => new Date(`${tanggal.value}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))
const hariNama = computed(() => {
  const d = new Date(`${tanggal.value}T00:00:00`)
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('id-ID', { weekday: 'long' })
})

const menyimpan = ref(false)
async function simpan() {
  const errs = validasiHarian(form)
  if (errs.length) {
    toast.add({ title: errs.join(' '), color: 'error' })
    return
  }
  if (!data.value || menyimpan.value) return
  menyimpan.value = true
  const lama = rec.value
  const baru: BarisHarian = lama
    ? { ...lama, ...form, date: tanggal.value, log: tambahJejak(lama, me.value?.name ?? '') }
    : {
        ...form,
        date: tanggal.value,
        bd: { marketing: [], event: [], kasir: [], self: { amount: 0, disc: 0 } },
        bdValid: false,
        log: tambahJejak(null, me.value?.name ?? ''),
      }
  const rowsBaru = [...rows.value.filter(r => r.date !== tanggal.value), baru]
  try {
    data.value.day = await putDay(tanggal.value, rowsBaru, data.value.day.version)
    // B2: real API 200 but the screen only updates after reload — re-read
    // (same finding as fix/api-cashier for the Kompas panels).
    await refreshSemua()
    kotor.value = false
    ditolak.value = false
    toast.add({
      title: lama ? `Data omset ${tglPanjang(tanggal.value)} diperbarui.` : `Data omset ${tglPanjang(tanggal.value)} tersimpan. Lanjut ke Breakdown untuk alokasi sumber omset.`,
      color: 'success',
    })
  }
  catch (e) {
    ditolak.value = true
    if (!(await tanganiKonflik(e, refreshSemua))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

const hapusOpen = ref(false)
async function jalanHapus() {
  if (!data.value || menyimpan.value) return
  menyimpan.value = true
  try {
    data.value.day = await putDay(tanggal.value, rows.value.filter(r => r.date !== tanggal.value), data.value.day.version)
    hapusOpen.value = false
    toast.add({ title: `Data omset ${tglPanjang(tanggal.value)} dihapus (breakdown ikut terhapus).`, color: 'success' })
    await refreshSemua()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshSemua))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <AppPage
    title="Input omset harian"
    description="Catat pendapatan, diskon, tax & service, dan trafik harian."
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
      class="mb-3"
    />
    <UAlert
      v-if="ditolak && kotor"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Belum tersimpan."
      description="Data di server berubah sejak halaman ini dibuka. Isian Anda masih di layar — periksa lalu tekan Simpan lagi."
      class="mb-3"
    />

    <div class="grid gap-5 lg:grid-cols-2 lg:items-start">
      <!-- left: the form, then the Report Daily match -->
      <div class="space-y-5">
        <AppPanel
          title="Informasi & Pendapatan"
          description="Tanggal menentukan periode. Hari terisi otomatis."
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Tanggal">
              <UInput
                v-model="tanggal"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Hari">
              <UInput
                :model-value="hariNama"
                readonly
                class="w-full"
              />
            </UFormField>
          </div>

          <AppSectionTitle
            title="Pendapatan"
            class="mt-5"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Food Sales">
              <RupiahInput
                :model-value="form.food"
                @update:model-value="(v: number) => ubah('food', v)"
              />
            </UFormField>
            <UFormField label="Beverage Sales">
              <RupiahInput
                :model-value="form.bev"
                @update:model-value="(v: number) => ubah('bev', v)"
              />
            </UFormField>
            <UFormField label="Pendapatan Lainnya">
              <RupiahInput
                :model-value="form.lainnya"
                @update:model-value="(v: number) => ubah('lainnya', v)"
              />
            </UFormField>
            <UFormField label="Discount diberikan (−)">
              <RupiahInput
                :model-value="form.discount"
                @update:model-value="(v: number) => ubah('discount', v)"
              />
              <template #help>
                Mengurangi total omset. Kasir yang memberikannya dirinci di <b>Breakdown</b>.
              </template>
            </UFormField>
          </div>

          <p class="mt-4 rounded-panel border border-dashed border-primary-300 bg-primary-50 px-3.5 py-3 text-sm text-primary-800">
            <b>Service Charge</b> dan <b>Tax</b> dicatat terpisah, tidak menambah/mengurangi omset. Keduanya tetap ditagihkan ke tamu,
            jadi ikut dijumlah saat dibandingkan dengan setoran kasir di <b>Report Daily</b>.
          </p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <UFormField label="Total Service Charge">
              <RupiahInput
                :model-value="form.service_charge"
                @update:model-value="(v: number) => ubah('service_charge', v)"
              />
            </UFormField>
            <UFormField label="Total Tax">
              <RupiahInput
                :model-value="form.tax"
                @update:model-value="(v: number) => ubah('tax', v)"
              />
            </UFormField>
          </div>

          <AppSectionTitle
            title="Jumlah Item Terjual (Qty)"
            class="mt-5"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Food Item Quantity">
              <UInput
                :model-value="String(form.qty_food)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('qty_food', v)"
              />
            </UFormField>
            <UFormField label="Beverage Item Quantity">
              <UInput
                :model-value="String(form.qty_bev)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('qty_bev', v)"
              />
            </UFormField>
            <UFormField
              label="Others Quantity"
              help="Item di luar food & beverage"
            >
              <UInput
                :model-value="String(form.qty_others)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('qty_others', v)"
              />
            </UFormField>
          </div>

          <AppSectionTitle
            title="Data Operasional"
            class="mt-5"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Traffic (customer datang)">
              <UInput
                :model-value="String(form.traffic)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('traffic', v)"
              />
            </UFormField>
            <UFormField label="Total Bill (jumlah transaksi)">
              <UInput
                :model-value="String(form.bill)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('bill', v)"
              />
            </UFormField>
          </div>

          <p
            v-if="jejak.length"
            class="mt-4 text-xs text-muted"
          >
            Diinput: {{ jejak.map(j => `${j.by || '—'} ${new Date(j.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ') }}
          </p>
          <p
            v-else-if="rec"
            class="mt-4 text-xs text-muted"
          >
            Hari ini diisi sebelum jejak penginput dicatat (7 September 2026), jadi namanya memang tidak ada. Menyimpan ulang akan mencatat
            siapa yang MENGUBAHNYA — bukan siapa yang pertama mengisinya.
          </p>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              :label="rec ? 'Update data' : 'Simpan omset'"
              :loading="menyimpan"
              @click="simpan"
            />
            <UButton
              v-if="rec"
              label="Hapus"
              color="error"
              variant="soft"
              @click="hapusOpen = true"
            />
            <UButton
              label="Ke breakdown"
              trailing-icon="i-lucide-arrow-right"
              color="neutral"
              variant="outline"
              :to="`/finance/omset/breakdown?tgl=${tanggal}`"
            />
          </div>
          <div
            v-if="status === 'pending'"
            class="mt-2 space-y-2"
          >
            <!-- Loading rows mirror the omset form above. -->
            <USkeleton
              v-for="i in 3"
              :key="i"
              class="h-10 w-full"
            />
            <p class="text-sm text-muted">
              Memuat…
            </p>
          </div>
        </AppPanel>

        <AppPanel
          title="Pencocokan dengan Report Daily"
          description="Setoran kasir adalah angka acuan. Omset yang diinput di sini harus menghasilkan tagihan yang sama."
        >
          <UAlert
            v-if="setoran === null"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`Report Daily tanggal ${tglPanjang(tanggal)} belum ada.`"
            description="Omset tetap bisa disimpan, tapi belum ada yang mencocokkan. Minta kasir mengisi Report Daily dulu kalau memungkinkan."
          />
          <template v-else>
            <div class="grid gap-3 sm:grid-cols-3">
              <AppStat
                label="Setoran kasir (Actual)"
                class="[&_p.num]:text-lg!"
                icon="i-lucide-wallet"
                :value="fmtRp(setoran)"
                :sub="rep?.by ? `${rep.by}` : '—'"
              />
              <AppStat
                label="Tagihan dari input ini"
                class="[&_p.num]:text-lg!"
                icon="i-lucide-receipt"
                :value="fmtRp(tagihan)"
                :sub="`omset ${fmtRp(net)} + service ${fmtRp(form.service_charge)} + tax ${fmtRp(form.tax)}`"
              />
              <AppStat
                label="Selisih"
                class="[&_p.num]:text-lg!"
                icon="i-lucide-scale"
                :value="fmtSel(selisih)"
                :sub="selisih === 0 ? 'cocok ✓' : lewat ? `lewat toleransi ${fmtRp(SELISIH_TOLERANSI)}` : `masih dalam toleransi ${fmtRp(SELISIH_TOLERANSI)} ✓`"
                :tone="selisih === 0 ? 'success' : lewat ? 'error' : 'warning'"
              />
            </div>
            <p
              v-if="bhIn.totBaru > 0 || bhIn.totLunas > 0"
              class="mt-2 text-sm text-muted"
            >
              Sudah memperhitungkan
              <template v-if="bhIn.totBaru > 0">
                bon belum dibayar <b class="text-highlighted num">{{ fmtRp(bhIn.totBaru) }}</b>
              </template>
              <template v-if="bhIn.totBaru > 0 && bhIn.totLunas > 0">
                dan
              </template>
              <template v-if="bhIn.totLunas > 0">
                pelunasan bon lama <b class="text-highlighted num">{{ fmtRp(bhIn.totLunas) }}</b>
              </template>
              pada tanggal ini — lihat halaman <ULink
                to="/finance/omset/piutang"
                class="font-semibold text-primary-700"
              >Piutang / Bon</ULink>.
            </p>
            <UAlert
              v-if="lewat"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="`Selisih ${fmtRp(Math.abs(selisih))} lewat toleransi ${fmtRp(SELISIH_TOLERANSI)}.`"
              :description="`Tagihan dari input ini lebih ${selisih > 0 ? 'besar' : 'kecil'} dari setoran kasir. Data tetap boleh disimpan, tapi selisihnya perlu ditelusuri${bhIn.totBaru > 0 || bhIn.totLunas > 0 ? '' : ' — kalau sebabnya ada tamu yang berhutang, catat dulu di halaman Piutang / Bon'}.`"
              class="mt-2"
            />
          </template>
        </AppPanel>
      </div>

      <!-- right: today's numbers and the month so far -->
      <div class="space-y-4">
        <AppStat
          label="Total omset hari ini (net)"
          icon="i-lucide-coins"
          :value="fmtRp(net)"
          :sub="`Gross ${fmtRp(gross)} − Diskon ${fmtRp(form.discount)}`"
          class="bg-primary-50"
        />
        <div class="grid grid-cols-2 gap-3">
          <AppStat
            label="Avg spending"
            icon="i-lucide-calculator"
            :value="fmtRp(avg)"
            sub="Omset ÷ Bill"
            tone="info"
          />
          <AppStat
            label="Service + tax"
            icon="i-lucide-receipt"
            :value="fmtRp(taxSvc)"
            :sub="`Service ${fmtRp(form.service_charge)} + Tax ${fmtRp(form.tax)} · tagihan ${fmtRp(tagihan)}`"
          />
        </div>

        <AppPanel
          title="Pencapaian Bulan Berjalan"
          icon="i-lucide-calendar"
        >
          <template #description>
            {{ labelBulan }} · {{ lainHari.length }} hari lain sudah diinput, ditambah angka yang sedang diketik di kiri. Angkanya
            <b>tagihan</b> — sudah termasuk service &amp; pajak, sama dasarnya dengan Dashboard Omset.
          </template>
          <div class="grid gap-3 sm:grid-cols-2">
            <AppStat
              label="Realisasi bulan ini"
              icon="i-lucide-calendar-check"
              :value="fmtRp(bReal)"
              :sub="`tagihan · ${lainHari.length} hari tersimpan + hari ini ${fmtRp(tagihan)}`"
              class="bg-primary-50"
            />
            <AppStat
              label="Rata-rata per hari"
              icon="i-lucide-trending-up"
              :value="fmtRp(bAvg)"
              sub="termasuk hari yang sedang diketik"
            />
          </div>
        </AppPanel>
      </div>
    </div>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="`Hapus data omset ${tglPanjang(tanggal)}?`"
    >
      <p class="text-sm">
        Barisnya dihapus dari server, <b>breakdown hari itu ikut terhapus</b> — alokasi sumber omsetnya tidak bisa dikembalikan dari layar ini.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          :loading="menyimpan"
          @click="jalanHapus"
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
