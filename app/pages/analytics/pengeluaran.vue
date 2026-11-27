<!--
  Analytics › Pengeluaran & EBITDA. Reads the ESB Core Profit & Loss
  month-to-month report through GET /kompas/esb/profit-loss (credentials stay on
  the server). "Dana keluar" = HPP + beban operasional (cash out); EBITDA =
  penjualan bersih − dana keluar; depresiasi & amortisasi is non-cash and shown
  apart, never added to dana keluar. Nothing is saved: every visit asks ESB.
-->
<script setup lang="ts">
import { getEsbProfitLoss, type PlAkun, type ProfitLossEsb } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { BLN, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('pengeluaran'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const tahunIni = new Date().getFullYear()
const tahun = ref(tahunIni)
const pilihanTahun = [tahunIni, tahunIni - 1, tahunIni - 2].map(t => ({ value: t, label: String(t) }))

const { data, status, error, refresh } = useAsyncData(
  'analytics-pengeluaran',
  () => (bolehLihat.value ? getEsbProfitLoss(tahun.value) : Promise.resolve(null)),
  { watch: [tahun, bolehLihat] },
)
const pl = computed<ProfitLossEsb | null>(() => data.value ?? null)
const t = computed(() => pl.value?.ringkasan.total ?? null)

/** ESB keys periods in English ("January 2026"); show the Indonesian short month. */
const BULAN_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const labelPeriode = (k: string) => {
  const i = BULAN_EN.indexOf(k.trim().split(/\s+/)[0]?.toLowerCase() ?? '')
  return (i >= 0 ? BLN[i] : undefined) ?? k
}
const pct = (x: number, total: number) => (total ? `${(x / total * 100).toFixed(1)}%` : '—')

const baris = computed(() => (pl.value?.periods ?? []).map(k => ({ k, ...pl.value!.ringkasan.perPeriode[k]! })))
const maks = computed(() => Math.max(1, ...baris.value.map(b => Math.max(b.danaKeluar, Math.abs(b.ebitda)))))

/** Account lists: '' = the whole year, otherwise one ESB period key. */
const bulanPilih = ref('')
watch(tahun, () => {
  bulanPilih.value = ''
})
const pilihanBulan = computed(() => [{ value: '', label: 'Setahun' }, ...(pl.value?.periods ?? []).map(k => ({ value: k, label: labelPeriode(k) }))])
const nilai = (a: PlAkun) => Math.abs(bulanPilih.value ? a.periods[bulanPilih.value] ?? 0 : a.total)
const dasarKeluar = computed(() => (bulanPilih.value ? pl.value?.ringkasan.perPeriode[bulanPilih.value]?.danaKeluar ?? 0 : t.value?.danaKeluar ?? 0))
const semuaAkun = ref(false)
const namaAkun = (a: PlAkun) => a.description || a.account || '(tanpa nama)'

const akunKeluarSetahun = computed<(PlAkun & { grup: string })[]>(() => {
  const s = pl.value?.sections
  if (!s) return []
  return [
    ...(s.cogs?.accounts ?? []).map(a => ({ ...a, grup: 'HPP' })),
    ...(s.operationalExpenses?.accounts ?? []).map(a => ({ ...a, grup: 'Operasional' })),
  ]
})
/** Month before the picked one (month-on-month comparison); none for "Setahun" or January. */
const bulanSebelum = computed(() => {
  const ks = pl.value?.periods ?? []
  const i = ks.indexOf(bulanPilih.value)
  return i > 0 ? ks[i - 1]! : ''
})
const nilaiSebelum = (a: PlAkun) => Math.abs(a.periods[bulanSebelum.value] ?? 0)
/** Change in percent vs the previous value; null = nothing to compare (both zero or no previous month). */
const ubahPct = (kini: number, dulu: number): number | null => (dulu ? (kini - dulu) / Math.abs(dulu) * 100 : null)
/**
 * Badge for a change. For a cost a rise is bad (red); for EBITDA a rise is good.
 * A cost with no value last month is "baru".
 */
const lencana = (kini: number, dulu: number, naikBaik = false) => {
  if (!dulu && !kini) return null
  if (!dulu) return { teks: 'baru', warna: naikBaik ? 'success' : 'warning' } as const
  const v = ubahPct(kini, dulu)!
  if (Math.abs(v) < 0.05) return { teks: '0%', warna: 'neutral' } as const
  const naik = v > 0
  return { teks: `${naik ? '▲' : '▼'} ${Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, warna: naik === naikBaik ? 'success' : 'error' } as const
}
const urutan = ref<'nilai' | 'naik'>('nilai')
const pilihanUrutan = [{ value: 'nilai', label: 'Nilai terbesar' }, { value: 'naik', label: 'Kenaikan terbesar (Rp)' }]
const kunciUrut = (a: PlAkun) => (urutan.value === 'naik' && bulanSebelum.value ? nilai(a) - nilaiSebelum(a) : nilai(a))
const akunKeluar = computed(() => akunKeluarSetahun.value.filter(a => nilai(a) || (bulanSebelum.value && nilaiSebelum(a))).sort((a, b) => kunciUrut(b) - kunciUrut(a)))
const akunDepresiasi = computed(() => (pl.value?.sections.depreciationAmortizationExpenses?.accounts ?? []).filter(a => nilai(a)).sort((a, b) => nilai(b) - nilai(a)))
</script>

<template>
  <AppPage
    title="Pengeluaran & EBITDA"
    description="Dana keluar (HPP + operasional), EBITDA, dan depresiasi dari laporan Laba Rugi ESB"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman &quot;Pengeluaran&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-center gap-2 rounded-panel bg-default px-5 py-3.5 shadow-panel">
        <span class="text-sm font-semibold">Tahun</span>
        <AppChips
          v-model="tahun"
          :options="pilihanTahun"
        />
        <span class="flex-1" />
        <span class="text-xs text-muted">Sumber: ESB Core · Laporan Laba Rugi bulan ke bulan</span>
      </div>

      <AppPanel
        v-if="status === 'pending' && !pl"
        title="Mengambil laporan dari ESB"
      >
        <USkeleton class="mt-3 h-24 w-full" />
      </AppPanel>
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan ESB tidak bisa dibaca"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu coba Segarkan.')"
      />
      <template v-else-if="pl && t">
        <AppStatGrid :count="4">
          <AppStat
            label="Dana Keluar"
            :value="rupiah(t.danaKeluar)"
            icon="i-lucide-wallet"
            tone="error"
            :sub="`HPP ${rupiah(t.hpp)} · Operasional ${rupiah(t.operasional)}`"
          />
          <AppStat
            label="EBITDA"
            :value="rupiah(t.ebitda)"
            icon="i-lucide-trending-up"
            :tone="t.ebitda >= 0 ? 'success' : 'error'"
            :sub="`Margin ${pct(t.ebitda, t.penjualanBersih)} dari penjualan bersih`"
          />
          <AppStat
            label="Depresiasi & Amortisasi"
            :value="rupiah(t.depresiasi)"
            icon="i-lucide-building"
            tone="info"
            sub="Beban non-tunai, tidak termasuk dana keluar"
          />
          <AppStat
            label="EBIT"
            :value="rupiah(t.ebit)"
            icon="i-lucide-calculator"
            tone="gold"
            :sub="`Penjualan bersih ${rupiah(t.penjualanBersih)}`"
          />
        </AppStatGrid>

        <AppPanel
          title="Per bulan"
          class="mt-4"
        >
          <p
            v-if="!baris.length"
            class="text-sm text-muted"
          >
            ESB tidak mengirim data untuk tahun ini.
          </p>
          <div
            v-else
            class="overflow-x-auto"
          >
            <table class="w-full text-sm">
              <thead class="text-left text-xs text-muted">
                <tr>
                  <th class="py-2 pr-3">
                    Bulan
                  </th>
                  <th class="py-2 pr-3 text-right">
                    Penjualan bersih
                  </th>
                  <th class="py-2 pr-3 text-right">
                    Dana keluar
                  </th>
                  <th class="py-2 pr-3 text-right">
                    EBITDA
                  </th>
                  <th class="py-2 pr-3 text-right">
                    Depresiasi
                  </th>
                  <th class="py-2 pr-3 text-right">
                    EBIT
                  </th>
                  <th class="w-1/4 py-2" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in baris"
                  :key="b.k"
                  class="cursor-pointer border-t border-default hover:bg-elevated"
                  :class="bulanPilih === b.k ? 'bg-elevated' : ''"
                  title="Lihat rincian akun bulan ini"
                  @click="bulanPilih = bulanPilih === b.k ? '' : b.k"
                >
                  <td class="py-2 pr-3 font-medium">
                    {{ labelPeriode(b.k) }}
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums">
                    {{ rupiah(b.penjualanBersih) }}
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums">
                    {{ rupiah(b.danaKeluar) }}
                    <UBadge
                      v-if="i > 0 && lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)"
                      class="ml-1"
                      size="sm"
                      variant="subtle"
                      :color="lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)!.warna"
                      :label="lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)!.teks"
                    />
                  </td>
                  <td
                    class="py-2 pr-3 text-right font-semibold tabular-nums"
                    :class="b.ebitda < 0 ? 'text-error' : 'text-success'"
                  >
                    {{ rupiah(b.ebitda) }}
                    <UBadge
                      v-if="i > 0 && lencana(b.ebitda, baris[i - 1]!.ebitda, true)"
                      class="ml-1"
                      size="sm"
                      variant="subtle"
                      :color="lencana(b.ebitda, baris[i - 1]!.ebitda, true)!.warna"
                      :label="lencana(b.ebitda, baris[i - 1]!.ebitda, true)!.teks"
                    />
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums text-muted">
                    {{ rupiah(b.depresiasi) }}
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums">
                    {{ rupiah(b.ebit) }}
                  </td>
                  <td class="py-2">
                    <div class="flex flex-col gap-1">
                      <div
                        class="h-1.5 rounded-full bg-error/70"
                        :style="{ width: `${b.danaKeluar / maks * 100}%` }"
                        :title="`Dana keluar ${rupiah(b.danaKeluar)}`"
                      />
                      <div
                        class="h-1.5 rounded-full"
                        :class="b.ebitda < 0 ? 'bg-error' : 'bg-success'"
                        :style="{ width: `${Math.abs(b.ebitda) / maks * 100}%` }"
                        :title="`EBITDA ${rupiah(b.ebitda)}`"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </AppPanel>

        <div class="mt-4 flex flex-wrap items-center gap-2 rounded-panel bg-default px-5 py-3.5 shadow-panel">
          <span class="text-sm font-semibold">Rincian akun</span>
          <AppChips
            v-model="bulanPilih"
            :options="pilihanBulan"
          />
          <span class="flex-1" />
          <AppChips
            v-if="bulanSebelum"
            v-model="urutan"
            :options="pilihanUrutan"
          />
          <span
            v-else
            class="text-xs text-muted"
          >Pilih satu bulan (Feb ke atas) untuk melihat kenaikan dibanding bulan sebelumnya</span>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <AppPanel
            :title="`Akun dana keluar · ${bulanPilih ? labelPeriode(bulanPilih) : 'setahun'}`"
            class="lg:col-span-2"
          >
            <p
              v-if="!akunKeluar.length"
              class="text-sm text-muted"
            >
              Tidak ada beban HPP atau operasional.
            </p>
            <ul
              v-else
              class="divide-y divide-default text-sm"
            >
              <li
                v-for="a in semuaAkun ? akunKeluar : akunKeluar.slice(0, 15)"
                :key="a.grup + a.account"
                class="flex items-center gap-3 py-2"
              >
                <UBadge
                  :label="a.grup"
                  size="sm"
                  variant="subtle"
                  :color="a.grup === 'HPP' ? 'warning' : 'neutral'"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ namaAkun(a) }}</span>
                  <span class="block text-xs text-muted tabular-nums">{{ a.account }}</span>
                </span>
                <span class="hidden text-xs text-muted sm:inline">{{ pct(nilai(a), dasarKeluar) }}</span>
                <span class="w-36 text-right">
                  <span class="block tabular-nums">{{ rupiah(nilai(a)) }}</span>
                  <span
                    v-if="bulanSebelum"
                    class="block text-xs text-muted tabular-nums"
                  >{{ labelPeriode(bulanSebelum) }}: {{ rupiah(nilaiSebelum(a)) }}</span>
                </span>
                <UBadge
                  v-if="bulanSebelum && lencana(nilai(a), nilaiSebelum(a))"
                  class="w-16 justify-center"
                  size="sm"
                  variant="subtle"
                  :color="lencana(nilai(a), nilaiSebelum(a))!.warna"
                  :label="lencana(nilai(a), nilaiSebelum(a))!.teks"
                />
              </li>
            </ul>
            <UButton
              v-if="akunKeluar.length > 15"
              class="mt-2"
              size="sm"
              color="neutral"
              variant="ghost"
              :label="semuaAkun ? 'Tampilkan 15 teratas' : `Tampilkan semua (${akunKeluar.length} akun)`"
              @click="semuaAkun = !semuaAkun"
            />
          </AppPanel>
          <AppPanel title="Depresiasi & amortisasi">
            <p
              v-if="!akunDepresiasi.length"
              class="text-sm text-muted"
            >
              Tidak ada beban depresiasi di periode ini.
            </p>
            <ul
              v-else
              class="divide-y divide-default text-sm"
            >
              <li
                v-for="a in akunDepresiasi"
                :key="a.account"
                class="flex items-center gap-3 py-2"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ namaAkun(a) }}</span>
                  <span class="block text-xs text-muted tabular-nums">{{ a.account }}</span>
                </span>
                <span class="tabular-nums">{{ rupiah(nilai(a)) }}</span>
                <UBadge
                  v-if="bulanSebelum && lencana(nilai(a), nilaiSebelum(a))"
                  size="sm"
                  variant="subtle"
                  :color="lencana(nilai(a), nilaiSebelum(a))!.warna"
                  :label="lencana(nilai(a), nilaiSebelum(a))!.teks"
                />
              </li>
            </ul>
            <p class="mt-3 text-xs text-muted">
              Depresiasi bukan uang yang keluar dari kas; ia hanya menurunkan nilai aset di pembukuan.
            </p>
          </AppPanel>
        </div>
      </template>
    </template>
  </AppPage>
</template>
