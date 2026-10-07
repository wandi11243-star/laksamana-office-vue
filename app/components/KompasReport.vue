<!--
  Report Daily — THE SAME panel in Cashier and Finance › Omset (the old Office
  had two copies writing one `reports[date]` object; doc F.19). Extracted
  2026-10-07 so the two modules cannot drift; each page passes its own
  `useAsyncData` key via the `kunci` prop.

  POS vs Actual per payment method. Only the TOTAL is judged (tolerance
  Rp5.000) and the submit is never locked (cashier.md F.4). Bon and payments of
  the day explain the expected difference; those columns and the explanation
  card appear only on days that have them.

  Written as ONE part: PUT /kompas/reports/{date} with that report's version
  (T-03). Deliberate change from the old screen: the other marks of the same
  report (mdr, aktual, setor … written by Finance › Rekap Penjualan) are KEPT.
  The old submit replaced the whole object and dropped them.
-->
<script setup lang="ts">
import type { DailyReport } from '~/utils/cashier'
import {
  PAYS, SELISIH_TOLERANSI, bonGrupBelum, bonTipeNama, fmtRp, fmtSel, hitungReport, jejakList,
  namaUnik, payName, penjelasHari, repPay, tambahJejak,
} from '~/utils/cashier'
import { getPiutang, getReport, putReport } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'

const props = defineProps<{ kunci?: string }>()

const me = useMe()
const toast = useToast()
const tanggal = ref(hariIni())

const { data, status, error, refresh } = useAsyncData(
  props.kunci ?? 'cashier-report',
  async () => {
    const [rep, bon] = await Promise.all([getReport(tanggal.value), getPiutang()])
    return { rep, bon }
  },
  { watch: [tanggal] },
)

const rec = computed<DailyReport | null>(() => data.value?.rep.value ?? null)
const bh = computed(() => penjelasHari(data.value?.bon.value ?? [], tanggal.value))

// The form lives outside the data: a reload after a refused save must not wipe
// what the cashier typed (old "catat dulu, jangan dibuang", F.5).
type Isian = Record<string, { pos: number, actual: number }>
const form = reactive<Isian>({})
const kotor = ref(false)
const ditolak = ref(false)

function isiDariServer() {
  for (const p of PAYS) form[p.k] = { ...repPay(rec.value, p.k) }
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

const h = computed(() => hitungReport(form, bh.value))
const jejak = computed(() => jejakList(rec.value))
const jejakAkhir = computed(() => jejak.value[jejak.value.length - 1])
const jejakSebelum = computed(() => jejak.value.slice(0, -1).reverse())
const grupBelum = computed(() => bonGrupBelum(data.value?.bon.value ?? []))
const totOpen = computed(() => grupBelum.value.reduce((s, g) => s + g.total, 0))

const fmtWaktu = (ts: number) => {
  const d = new Date(ts)
  return Number.isNaN(+d) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const warnaSel = (s: number) => (s === 0 ? 'text-muted' : s > 0 ? 'text-success font-bold' : 'text-error font-bold')
const perMetode = (obj: Record<string, number>) =>
  Object.keys(obj).filter(k => obj[k]! > 0).map(k => `${payName(k)} ${fmtRp(obj[k]!)}`).join(' + ')

const sisaTone = computed(() => (h.value.sisa === 0 ? 'success' : h.value.aman ? 'warning' : 'error'))
const sisaFoot = computed(() => {
  if (h.value.sisa === 0) return bh.value.ada ? 'cocok setelah bon & pelunasan diperhitungkan' : 'POS dan Actual cocok'
  if (h.value.aman) return `masih dalam toleransi ${fmtRp(SELISIH_TOLERANSI)}`
  return `melebihi toleransi ${fmtRp(SELISIH_TOLERANSI)} — uang ${h.value.sisa > 0 ? 'lebih' : 'kurang'}, perlu ditelusuri`
})

function ubahAngka(k: string, f: 'pos' | 'actual', v: number) {
  form[k]![f] = v
  kotor.value = true
}

const menyimpan = ref(false)
async function submit() {
  if (!data.value) return
  menyimpan.value = true
  const lama = rec.value
  const pay: Record<string, { pos: number, actual: number }> = {}
  for (const p of PAYS) pay[p.k] = { pos: form[p.k]!.pos, actual: form[p.k]!.actual }
  const nama = me.value?.name ?? ''
  const value: DailyReport = { ...(lama ?? {}), pay, by: nama, at: Date.now(), submitted: true, log: tambahJejak(lama, nama) }
  const abs = Math.abs(h.value.sisa)
  try {
    const out = await putReport(tanggal.value, value, data.value.rep.version)
    data.value.rep = out
    kotor.value = false
    ditolak.value = false
    toast.add({
      title: `Report ${tglPanjang(tanggal.value)} tersimpan di server`,
      description: abs ? `Dengan ${bh.value.ada ? 'sisa selisih' : 'selisih POS vs Actual'} ${fmtRp(abs)}.` : undefined,
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
</script>

<template>
  <AppPage
    title="Report daily kasir"
    description="Setoran per metode pembayaran: POS vs Actual."
  >
    <AppPanel
      title="Setoran per metode pembayaran"
      description="Isi POS dan Actual tiap metode. Boleh disubmit kapan saja."
    >
      <template #actions>
        <UFormField label="Tanggal">
          <UInput
            v-model="tanggal"
            type="date"
          />
        </UFormField>
      </template>
    </AppPanel>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Report tanggal ini gagal dimuat: ${apiErrorMessage(error)}`"
    />

    <UAlert
      v-if="ditolak && kotor"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Belum tersimpan."
      description="Data di server berubah sejak halaman ini dibuka. Isian Anda masih di layar — periksa lalu tekan Update Report lagi."
    />

    <UAlert
      v-if="jejakAkhir"
      color="info"
      variant="subtle"
      icon="i-lucide-file-pen-line"
    >
      <template #title>
        Disubmit oleh <b>{{ jejakAkhir.by || '—' }}</b> · <b>{{ fmtWaktu(jejakAkhir.at) }}</b>
      </template>
      <template
        v-if="jejakSebelum.length"
        #description
      >
        Sebelumnya diisi/diubah oleh {{ jejakSebelum.map(x => `${x.by || '—'} (${fmtWaktu(x.at)})`).join(' · ') }}
      </template>
    </UAlert>

    <AppPanel
      flush
      :class="status === 'pending' ? 'opacity-60' : ''"
    >
      <!-- Desktop: the old table, same four (+1) columns. -->
      <table class="hidden w-full text-sm lg:table">
        <thead class="bg-table-head text-table-head-text">
          <tr class="text-left text-[11px] uppercase tracking-wider">
            <th class="px-4 py-2.5">
              Metode pembayaran
            </th>
            <th class="px-4 py-2.5 text-right">
              POS
            </th>
            <th class="px-4 py-2.5 text-right">
              Actual
            </th>
            <th class="px-4 py-2.5 text-right">
              Selisih
            </th>
            <th
              v-if="bh.ada"
              class="px-4 py-2.5 text-right"
            >
              Sisa selisih
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="b in h.baris"
            :key="b.k"
          >
            <td class="px-4 py-2 font-semibold text-highlighted">
              {{ b.n }}
            </td>
            <td class="w-44 px-4 py-1.5">
              <RupiahInput
                :model-value="form[b.k]!.pos"
                size="sm"
                :aria-label="`POS ${b.n}`"
                @update:model-value="v => ubahAngka(b.k, 'pos', v)"
              />
            </td>
            <td class="w-44 px-4 py-1.5">
              <RupiahInput
                :model-value="form[b.k]!.actual"
                size="sm"
                :aria-label="`Actual ${b.n}`"
                @update:model-value="v => ubahAngka(b.k, 'actual', v)"
              />
            </td>
            <td
              class="px-4 py-2 text-right num"
              :class="warnaSel(b.s)"
            >
              {{ fmtSel(b.s) }}
            </td>
            <td
              v-if="bh.ada"
              class="px-4 py-2 text-right num"
              :class="b.kosong || b.z === 0 ? 'text-muted' : 'font-bold text-warning'"
            >
              {{ b.kosong ? '—' : fmtSel(b.z) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-default font-extrabold">
            <td class="px-4 py-2.5">
              TOTAL
            </td>
            <td class="px-4 py-2.5 text-right num">
              {{ fmtRp(h.tp) }}
            </td>
            <td class="px-4 py-2.5 text-right num">
              {{ fmtRp(h.ta) }}
            </td>
            <td
              class="px-4 py-2.5 text-right num"
              :class="warnaSel(h.tsel)"
            >
              {{ fmtSel(h.tsel) }}
            </td>
            <td
              v-if="bh.ada"
              class="px-4 py-2.5 text-right num"
              :class="h.sisa === 0 ? 'text-muted' : h.aman ? 'text-warning' : 'text-error'"
            >
              {{ fmtSel(h.sisa) }}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Phone: one card per method. -->
      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="b in h.baris"
          :key="b.k"
          class="p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <b class="text-highlighted">{{ b.n }}</b>
            <span
              class="text-sm num"
              :class="warnaSel(b.s)"
            >{{ fmtSel(b.s) }}<template v-if="bh.ada && !b.kosong && b.z !== b.s"> · sisa {{ fmtSel(b.z) }}</template></span>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <UFormField label="POS">
              <RupiahInput
                :model-value="form[b.k]!.pos"
                @update:model-value="v => ubahAngka(b.k, 'pos', v)"
              />
            </UFormField>
            <UFormField label="Actual">
              <RupiahInput
                :model-value="form[b.k]!.actual"
                @update:model-value="v => ubahAngka(b.k, 'actual', v)"
              />
            </UFormField>
          </div>
        </div>
        <div class="flex justify-between p-3 font-extrabold">
          <span>TOTAL</span>
          <span class="num">{{ fmtRp(h.tp) }} / {{ fmtRp(h.ta) }}</span>
        </div>
      </div>

      <!-- Note: only the TOTAL decides (old catatanMetode, :1423-1444). -->
      <div class="border-t border-default p-4">
        <UAlert
          v-if="!h.bermasalah.length"
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          :title="`Semua metode pembayaran cocok antara POS dan Actual${bh.ada ? ', setelah bon & pelunasan hari ini diperhitungkan' : ''}.`"
        />
        <UAlert
          v-else
          :color="h.aman ? 'success' : 'error'"
          variant="subtle"
          :icon="h.aman ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
          :title="h.aman
            ? `Selisih antar metode saling menutup — total ${fmtSel(h.sisa)}, masih dalam toleransi ${fmtRp(SELISIH_TOLERANSI)}.`
            : `Total selisih ${fmtSel(h.sisa)} — lewat toleransi ${fmtRp(SELISIH_TOLERANSI)}, perlu ditelusuri.`"
        >
          <template #description>
            <ul class="mt-1 space-y-0.5">
              <li
                v-for="r in h.bermasalah"
                :key="r.k"
              >
                · <b>{{ r.n }}</b> — POS {{ fmtRp(r.pos) }}, Actual {{ fmtRp(r.act) }}, selisih <b>{{ fmtSel(r.s) }}</b>
                <template v-if="r.bb || r.bl">
                  ({{ [r.bb ? `bon ${fmtRp(r.bb)}` : '', r.bl ? `pelunasan ${fmtRp(r.bl)}` : ''].filter(Boolean).join(' + ') }} → sisa <b>{{ fmtSel(r.z) }}</b>)
                </template>
              </li>
            </ul>
          </template>
        </UAlert>
      </div>
    </AppPanel>

    <!-- Bon & payments of the day (old kartuPenjelasan, :1477-1522). -->
    <AppPanel
      v-if="bh.ada"
      title="Penjelasan selisih hari ini"
      icon="i-lucide-info"
      description="Bon & pelunasan yang jatuh pada tanggal ini."
    >
      <template #actions>
        <UButton
          label="Buka halaman Piutang"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="outline"
          size="sm"
          to="/cashier/piutang"
        />
      </template>
      <UAlert
        :color="h.th === 0 ? 'info' : 'warning'"
        variant="subtle"
        icon="i-lucide-pin"
      >
        <template #title>
          <span v-if="bh.totBaru > 0"><b>{{ bh.listBaru.length }} bon belum dibayar {{ fmtRp(bh.totBaru) }}</b> ({{ namaUnik(bh.listBaru) }}) lewat {{ perMetode(bh.baru) }}</span>
          <span v-if="bh.totBaru > 0 && bh.totLunas > 0"> · </span>
          <span v-if="bh.totLunas > 0"><b>{{ bh.listLunas.length }} pelunasan bon lama {{ fmtRp(bh.totLunas) }}</b> ({{ namaUnik(bh.listLunas) }}) lewat {{ perMetode(bh.lunas) }}</span>
          → selisih seharusnya <b>{{ fmtSel(h.th) }}</b>.
        </template>
      </UAlert>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <table class="w-full text-sm">
            <tbody class="divide-y divide-default">
              <tr>
                <td class="py-1.5">
                  Bon baru hari ini (uang belum diterima)
                </td>
                <td class="py-1.5 text-right text-error num">
                  {{ fmtSel(-bh.totBaru) }}
                </td>
              </tr>
              <tr>
                <td class="py-1.5">
                  Pelunasan bon hari lain, diterima hari ini
                </td>
                <td class="py-1.5 text-right text-success num">
                  {{ fmtSel(bh.totLunas) }}
                </td>
              </tr>
              <tr class="border-t-2 font-extrabold">
                <td class="py-1.5">
                  Selisih yang <u>seharusnya</u> terjadi
                </td>
                <td class="py-1.5 text-right num">
                  {{ fmtSel(h.th) }}
                </td>
              </tr>
              <tr>
                <td class="py-1.5">
                  Selisih sebenarnya (Actual − POS)
                </td>
                <td class="py-1.5 text-right num">
                  {{ fmtSel(h.tsel) }}
                </td>
              </tr>
              <tr class="border-t-2 font-extrabold">
                <td class="py-1.5">
                  = Sisa yang belum terjelaskan
                </td>
                <td class="py-1.5 text-right num">
                  {{ fmtSel(h.sisa) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-2 text-xs text-muted">
            Total piutang belum lunas seluruh tanggal: <b>{{ fmtRp(totOpen) }}</b> dari {{ grupBelum.length }} orang.
          </p>
        </div>
        <div class="grid gap-3">
          <div>
            <AppSectionTitle title="Bon baru hari ini" />
            <p
              v-if="!bh.listBaru.length"
              class="text-sm text-muted"
            >
              Tidak ada bon baru pada tanggal ini.
            </p>
            <div
              v-for="b in bh.listBaru"
              :key="b.id"
              class="flex items-start justify-between gap-2 border-b border-default py-1.5 text-sm"
            >
              <div>
                <b>{{ b.nama }}</b> <AppStatus size="sm">
                  {{ bonTipeNama(b.tipe) }}
                </AppStatus>
                <span
                  v-if="b.bill || b.picName"
                  class="block text-xs text-muted"
                >{{ [b.bill, b.picName ? `PIC ${b.picName}` : ''].filter(Boolean).join(' · ') }}</span>
              </div>
              <span class="text-xs text-muted">POS: {{ payName(b.payKey) }}</span>
              <span class="text-error num">{{ fmtSel(-Number(b.nominal)) }}</span>
            </div>
          </div>
          <div>
            <AppSectionTitle title="Pelunasan diterima hari ini" />
            <p
              v-if="!bh.listLunas.length"
              class="text-sm text-muted"
            >
              Tidak ada pelunasan pada tanggal ini.
            </p>
            <div
              v-for="b in bh.listLunas"
              :key="b.id"
              class="flex items-start justify-between gap-2 border-b border-default py-1.5 text-sm"
            >
              <div>
                <b>{{ b.nama }}</b>
                <span
                  v-if="b.bill"
                  class="block text-xs text-muted"
                >{{ b.bill }}</span>
              </div>
              <span class="text-xs text-muted">bill {{ b.date }} · {{ payName(b.lunasPayKey) }}</span>
              <span class="text-success num">{{ fmtSel(Number(b.nominal)) }}</span>
            </div>
          </div>
        </div>
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Total POS"
        icon="i-lucide-monitor"
        :value="fmtRp(h.tp)"
        sub="angka dari mesin kasir"
      />
      <AppStat
        label="Total Actual"
        icon="i-lucide-banknote"
        tone="info"
        :value="fmtRp(h.ta)"
        sub="uang & mutasi yang benar-benar ada"
      />
      <AppStat
        label="Selisih POS vs Actual"
        icon="i-lucide-scale"
        :tone="bh.ada ? 'gold' : sisaTone"
        :value="fmtSel(h.tsel)"
        :sub="bh.ada ? `seharusnya ${fmtSel(h.th)}` : sisaFoot"
      />
      <AppStat
        v-if="bh.ada"
        label="Sisa selisih"
        icon="i-lucide-circle-alert"
        :tone="sisaTone"
        :value="fmtSel(h.sisa)"
        :sub="sisaFoot"
      />
    </AppStatGrid>

    <div class="flex flex-wrap items-center gap-3">
      <UButton
        :label="rec?.submitted ? 'Update report' : 'Submit report'"
        icon="i-lucide-send"
        :loading="menyimpan"
        :disabled="!data"
        @click="submit"
      />
      <span class="text-sm text-muted">Submit atas nama <b>{{ me?.name || '—' }}</b> — nama dan jamnya ikut tercatat di laporan ini.</span>
    </div>
  </AppPage>
</template>
