<!--
  Finance › Omset › Input Omset Harian (old `viewInput`, deploy/finance/omset/index.html:1378-1537).

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
import { avgSpendOf, grossOf, itemsOf, kNum, monthKeyOf, netOf, tagihanOf, taxSvcOf, validasiHarian } from '~/utils/kompas'
import { PAYS, SELISIH_TOLERANSI, bonRingkasHari, fmtRp, fmtSel, jejakList, repPay, tambahJejak } from '~/utils/cashier'
import { getDay, getKompasState, getPiutang, getReport, putDay } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['kompas'] })

const me = useMe()
const toast = useToast()
const route = useRoute()
const tanggal = ref(typeof route.query.tgl === 'string' && route.query.tgl ? route.query.tgl : hariIni())

const { data, status, error, refresh } = useAsyncData(
  'omset-input',
  async () => {
    const [day, rep, bon, state] = await Promise.all([
      getDay(tanggal.value),
      getReport(tanggal.value),
      getPiutang(),
      getKompasState(),
    ])
    return { day, rep, bon, state }
  },
  { watch: [tanggal] },
)

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

const lainHari = computed(() => (data.value?.state.value.daily ?? [])
  .filter(d => monthKeyOf(d.date) === monthKeyOf(tanggal.value) && d.date !== tanggal.value))
const bReal = computed(() => lainHari.value.reduce((s, d) => s + tagihanOf(d), 0) + tagihan.value)
const bHari = computed(() => lainHari.value.length + 1)
const bAvg = computed(() => (bHari.value ? bReal.value / bHari.value : 0))
const jejak = computed(() => jejakList(rec.value))

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
    kotor.value = false
    ditolak.value = false
    toast.add({
      title: lama ? `Data omset ${tglPanjang(tanggal.value)} diperbarui.` : `Data omset ${tglPanjang(tanggal.value)} tersimpan. Lanjut ke Breakdown untuk alokasi sumber omset.`,
      color: 'success',
    })
  }
  catch (e) {
    ditolak.value = true
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
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
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
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
    <template #actions>
      <UInput
        v-model="tanggal"
        type="date"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Ke breakdown"
        icon="i-lucide-arrow-right"
        color="neutral"
        variant="outline"
        size="sm"
        :to="`/finance/omset/breakdown?tgl=${tanggal}`"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
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

    <div class="grid gap-5 lg:grid-cols-3 lg:items-start">
      <div class="space-y-5 lg:col-span-2">
        <AppPanel
          title="Informasi & pendapatan"
          :description="`${tglPanjang(tanggal)}${hariNama ? ` · ${hariNama}` : ''}`"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Food sales">
              <UInput
                :model-value="String(form.food)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('food', v)"
              />
            </UFormField>
            <UFormField label="Beverage sales">
              <UInput
                :model-value="String(form.bev)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('bev', v)"
              />
            </UFormField>
            <UFormField label="Pendapatan lainnya">
              <UInput
                :model-value="String(form.lainnya)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('lainnya', v)"
              />
            </UFormField>
            <UFormField label="Discount diberikan (−)">
              <UInput
                :model-value="String(form.discount)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('discount', v)"
              />
            </UFormField>
            <UFormField label="Service charge">
              <UInput
                :model-value="String(form.service_charge)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('service_charge', v)"
              />
            </UFormField>
            <UFormField label="Tax">
              <UInput
                :model-value="String(form.tax)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('tax', v)"
              />
            </UFormField>
          </div>
          <p class="mt-3 text-sm text-muted">
            Service charge dan tax dicatat terpisah — keduanya tidak menambah/mengurangi omset.
            Yang ditagihkan ke tamu: <b class="text-highlighted num">{{ fmtRp(tagihan) }}</b>.
          </p>
        </AppPanel>

        <AppPanel title="Qty & data operasional">
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="Qty food">
              <UInput
                :model-value="String(form.qty_food)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('qty_food', v)"
              />
            </UFormField>
            <UFormField label="Qty beverage">
              <UInput
                :model-value="String(form.qty_bev)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('qty_bev', v)"
              />
            </UFormField>
            <UFormField label="Qty lainnya">
              <UInput
                :model-value="String(form.qty_others)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('qty_others', v)"
              />
            </UFormField>
            <UFormField label="Traffic (tamu)">
              <UInput
                :model-value="String(form.traffic)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('traffic', v)"
              />
            </UFormField>
            <UFormField label="Total bill">
              <UInput
                :model-value="String(form.bill)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah('bill', v)"
              />
            </UFormField>
            <div class="self-end text-sm text-muted">
              Item terjual: <b class="text-highlighted num">{{ itemsOf(form) }}</b>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              :label="rec ? 'Update data' : 'Simpan omset'"
              icon="i-lucide-save"
              :loading="menyimpan"
              @click="simpan"
            />
            <UButton
              v-if="rec"
              label="Hapus"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="hapusOpen = true"
            />
            <UButton
              label="Ke breakdown"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="outline"
              :to="`/finance/omset/breakdown?tgl=${tanggal}`"
            />
          </div>
          <p
            v-if="status === 'pending'"
            class="mt-2 text-sm text-muted"
          >
            Memuat…
          </p>
          <div
            v-if="jejak.length"
            class="mt-3 text-xs text-muted"
          >
            Jejak input: {{ jejak.map(j => `${j.by || '—'} ${new Date(j.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ') }}
          </div>
        </AppPanel>
      </div>

      <div class="space-y-5">
        <AppStatGrid>
          <AppStat
            label="Total omset hari ini (net)"
            icon="i-lucide-coins"
            :value="fmtRp(net)"
            :sub="`gross ${fmtRp(gross)} − diskon ${fmtRp(form.discount)}`"
          />
          <AppStat
            label="Avg spending"
            icon="i-lucide-calculator"
            :value="fmtRp(avg)"
            sub="omset ÷ bill"
            tone="info"
          />
          <AppStat
            label="Service + tax"
            icon="i-lucide-receipt"
            :value="fmtRp(taxSvc)"
            :sub="`di luar omset · tagihan ${fmtRp(tagihan)}`"
          />
        </AppStatGrid>

        <AppPanel
          title="Pencapaian bulan berjalan"
          :description="`${bHari} hari (${lainHari.length} tersimpan + hari ini). Angkanya tagihan — sudah termasuk service & pajak, sama dasarnya dengan Dashboard Omset.`"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <AppStat
              label="Realisasi bulan ini"
              icon="i-lucide-calendar-check"
              :value="fmtRp(bReal)"
              :sub="`tagihan · hari ini ${fmtRp(tagihan)}`"
            />
            <AppStat
              label="Rata-rata per hari"
              icon="i-lucide-trending-up"
              :value="fmtRp(bAvg)"
              sub="termasuk hari yang sedang diketik"
            />
          </div>
        </AppPanel>

        <AppPanel title="Pencocokan dengan Report Daily">
          <p class="mb-3 text-sm text-muted">
            Setoran kasir adalah angka acuan. Omset yang diinput di sini harus menghasilkan tagihan yang sama.
          </p>
          <UAlert
            v-if="setoran === null"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`Report Daily tanggal ${tglPanjang(tanggal)} belum ada.`"
            description="Omset tetap bisa disimpan, tapi belum ada yang mencocokkan. Minta kasir mengisi Report Daily dulu kalau memungkinkan."
          />
          <template v-else>
            <div class="grid gap-4 sm:grid-cols-3">
              <AppStat
                label="Setoran kasir (Actual)"
                icon="i-lucide-wallet"
                :value="fmtRp(setoran)"
                :sub="rep?.by ? `${rep.by}` : '—'"
              />
              <AppStat
                label="Tagihan dari input ini"
                icon="i-lucide-receipt"
                :value="fmtRp(tagihan)"
                :sub="`omset ${fmtRp(net)} + service ${fmtRp(form.service_charge)} + tax ${fmtRp(form.tax)}`"
              />
              <AppStat
                label="Selisih"
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
