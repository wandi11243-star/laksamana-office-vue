<!--
  Analytics › Pengeluaran & EBITDA. Reads the ESB Core Profit & Loss
  month-to-month report through GET /kompas/esb/profit-loss (credentials stay on
  the server) for the picked year AND the year before, so any month range can be
  compared with the range right before it or the same months last year.
  "Dana keluar" = HPP + beban operasional (cash out); EBITDA, penjualan bersih
  and EBIT are ESB's own subtotals; depresiasi & amortisasi is non-cash and
  shown apart, never added to dana keluar. Opening the page never calls ESB: it
  shows the report saved by the last Refresh (GET …/saved); only the Refresh
  button asks ESB again (POST …/refresh), and every attempt lands in the history.
-->
<script setup lang="ts">
import { getEsbProfitLossSaved, refreshEsbProfitLoss, type PlAngka, type ProfitLossEsb } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { BLN, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('pengeluaran'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const tahunIni = new Date().getFullYear()
const tahun = ref(tahunIni)
const pilihanTahun = [tahunIni, tahunIni - 1, tahunIni - 2].map(t => ({ value: t, label: String(t) }))

/** The saved reports of the picked year and the year before (its failure only hides the comparison). No ESB call. */
const { data, status, error, refresh: muatUlang } = useAsyncData(
  'analytics-pengeluaran',
  async () => {
    if (!bolehLihat.value) return null
    const [kini, lalu] = await Promise.all([
      getEsbProfitLossSaved(tahun.value),
      getEsbProfitLossSaved(tahun.value - 1).catch(() => null),
    ])
    return { kini, lalu }
  },
  { watch: [tahun, bolehLihat] },
)
const pl = computed<ProfitLossEsb | null>(() => data.value?.kini?.laporan ?? null)
const simpanan = computed(() => data.value?.kini ?? null)

// ─── Refresh: only on click; asks ESB for both years, then reloads the saved copies ──
const merefresh = ref(false)
const gagalRefresh = ref('')
const lihatRiwayat = ref(false)
async function refreshEsb() {
  merefresh.value = true
  gagalRefresh.value = ''
  const th = tahun.value
  try {
    const [kini] = await Promise.allSettled([refreshEsbProfitLoss(th), refreshEsbProfitLoss(th - 1)])
    if (kini.status === 'rejected') gagalRefresh.value = apiErrorMessage(kini.reason, 'ESB tidak bisa dihubungi.')
  }
  finally {
    await muatUlang()
    merefresh.value = false
  }
}
const waktu = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── periods: ESB keys them in English ("January 2026"); we use "YYYY-MM" ids ──
const BULAN_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const idDariKey = (k: string): string | null => {
  const [b, y] = k.trim().split(/\s+/)
  const i = BULAN_EN.indexOf(b?.toLowerCase() ?? '')
  return i >= 0 && /^\d{4}$/.test(y ?? '') ? `${y}-${String(i + 1).padStart(2, '0')}` : null
}
const geser = (id: string, n: number) => {
  const [y, m] = id.split('-').map(Number)
  const t = y! * 12 + (m! - 1) + n
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`
}
const lblBulan = (id: string) => BLN[Number(id.slice(5)) - 1] ?? id
const lblRentang = (ids: string[]) => {
  if (!ids.length) return '—'
  const a = ids[0]!
  const z = ids[ids.length - 1]!
  if (a === z) return `${lblBulan(a)} ${a.slice(0, 4)}`
  return a.slice(0, 4) === z.slice(0, 4) ? `${lblBulan(a)}–${lblBulan(z)} ${a.slice(0, 4)}` : `${lblBulan(a)} ${a.slice(0, 4)}–${lblBulan(z)} ${z.slice(0, 4)}`
}

// ─── one index over both years: figures per month, accounts per month ──
interface Akun { kunci: string, grup: 'HPP' | 'Operasional' | 'Depresiasi', kode: string, nama: string, v: Record<string, number> }
const GRUP: [string, Akun['grup']][] = [['cogs', 'HPP'], ['operationalExpenses', 'Operasional'], ['depreciationAmortizationExpenses', 'Depresiasi']]
const indeks = computed(() => {
  const angka: Record<string, PlAngka> = {}
  const akun = new Map<string, Akun>()
  for (const d of [data.value?.lalu?.laporan, data.value?.kini?.laporan]) {
    if (!d) continue
    for (const [k, a] of Object.entries(d.ringkasan.perPeriode)) {
      const id = idDariKey(k)
      if (id) angka[id] = a
    }
    for (const [sec, grup] of GRUP) {
      for (const a of d.sections[sec]?.accounts ?? []) {
        const kunci = `${grup}|${a.account || a.description}`
        const x = akun.get(kunci) ?? { kunci, grup, kode: a.account, nama: a.description || a.account || '(tanpa nama)', v: {} }
        for (const [k, n] of Object.entries(a.periods)) {
          const id = idDariKey(k)
          // ESB leaves rounding residue (Rp 0,40) on unused accounts: below Rp 1 is zero
          if (id) x.v[id] = Math.abs(n) < 1 ? 0 : Math.abs(n)
        }
        akun.set(kunci, x)
      }
    }
  }
  return { angka, akun: [...akun.values()] }
})
const bulanAda = computed(() => (pl.value?.periods ?? []).map(idDariKey).filter((x): x is string => !!x))

// ─── range + comparison ──
const dari = ref('')
const sampai = ref('')
watch(bulanAda, (b) => {
  dari.value = b[0] ?? ''
  sampai.value = b[b.length - 1] ?? ''
}, { immediate: true })
const rentang = computed(() => {
  const [a, z] = dari.value <= sampai.value ? [dari.value, sampai.value] : [sampai.value, dari.value]
  return bulanAda.value.filter(id => id >= a && id <= z)
})
type Cepat = 'setahun' | '3bln' | '1bln' | ''
const cepat = computed<Cepat>({
  get: () => {
    const b = bulanAda.value
    const r = rentang.value
    if (!b.length || r[r.length - 1] !== b[b.length - 1]) return ''
    if (r.length === b.length) return 'setahun'
    return r.length === 3 ? '3bln' : r.length === 1 ? '1bln' : ''
  },
  set: (v) => {
    const b = bulanAda.value
    if (!v || !b.length) return
    sampai.value = b[b.length - 1]!
    dari.value = v === 'setahun' ? b[0]! : b[Math.max(0, b.length - (v === '3bln' ? 3 : 1))]!
  },
})
const pilihanCepat = [{ value: 'setahun', label: 'Setahun' }, { value: '3bln', label: '3 bulan terakhir' }, { value: '1bln', label: 'Bulan terakhir' }]

const pembanding = ref<'tahunLalu' | 'sebelum'>('tahunLalu')
const pilihanPembanding = [{ value: 'tahunLalu', label: 'Tahun lalu (bulan yang sama)' }, { value: 'sebelum', label: 'Periode sebelumnya' }]
const rentangBanding = computed(() => {
  const r = rentang.value
  return pembanding.value === 'tahunLalu' ? r.map(id => geser(id, -12)) : r.map(id => geser(id, -r.length))
})
/** Comparison months ESB actually returned; a partial set is said out loud. */
const bandingAda = computed(() => rentangBanding.value.filter(id => indeks.value.angka[id]))
const bandingLengkap = computed(() => bandingAda.value.length === rentangBanding.value.length)

const NOL: PlAngka = { penjualanBersih: 0, danaKeluar: 0, hpp: 0, operasional: 0, ebitda: 0, depresiasi: 0, ebit: 0 }
const jumlahAngka = (ids: string[]) => ids.reduce<PlAngka>((s, id) => {
  const a = indeks.value.angka[id]
  if (!a) return s
  return Object.fromEntries(Object.keys(NOL).map(k => [k, s[k as keyof PlAngka] + a[k as keyof PlAngka]])) as unknown as PlAngka
}, { ...NOL })
const t = computed(() => jumlahAngka(rentang.value))
const tb = computed(() => (bandingAda.value.length ? jumlahAngka(bandingAda.value) : null))

const jumlahAkun = (a: Akun, ids: string[]) => ids.reduce((s, id) => s + (a.v[id] ?? 0), 0)

// ─── change badges ──
const pct = (x: number, total: number) => (total ? `${(x / total * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : '—')
const ubahPct = (kini: number, dulu: number): number | null => (dulu ? (kini - dulu) / Math.abs(dulu) * 100 : null)
/** For a cost a rise is bad (red); for EBITDA/EBIT/sales a rise is good. */
const lencana = (kini: number, dulu: number | null | undefined, naikBaik = false) => {
  if (dulu == null || (!dulu && !kini)) return null
  if (!dulu) return { teks: 'baru', warna: naikBaik ? 'success' : 'warning' } as const
  const v = ubahPct(kini, dulu)!
  if (Math.abs(v) < 0.05) return { teks: '0%', warna: 'neutral' } as const
  const naik = v > 0
  const angkaPct = Math.abs(v) >= 1000 ? '>999' : Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return { teks: `${naik ? '▲' : '▼'} ${angkaPct}%`, warna: naik === naikBaik ? 'success' : 'error' } as const
}
const subBanding = (dulu: number | undefined) => (tb.value && dulu !== undefined ? `${lblRentang(bandingAda.value)}: ${rupiah(dulu)}` : '')

// ─── per-month table (picked year) ──
const baris = computed(() => bulanAda.value.map(id => ({ id, ...indeks.value.angka[id]! })))
const pilihBulan = (id: string) => {
  dari.value = id
  sampai.value = id
}

// ─── accounts ──
const urutan = ref<'nilai' | 'naik'>('nilai')
const pilihanUrutan = [{ value: 'nilai', label: 'Nilai terbesar' }, { value: 'naik', label: 'Kenaikan terbesar (Rp)' }]
const semuaAkun = ref(false)
const barisAkun = (grup: Akun['grup'][]) => indeks.value.akun
  .filter(a => grup.includes(a.grup))
  .map(a => ({ ...a, nilai: jumlahAkun(a, rentang.value), dulu: tb.value ? jumlahAkun(a, bandingAda.value) : null }))
  .filter(a => a.nilai || a.dulu)
  .sort((a, b) => (urutan.value === 'naik' && tb.value ? (b.nilai - (b.dulu ?? 0)) - (a.nilai - (a.dulu ?? 0)) : b.nilai - a.nilai))
const akunKeluar = computed(() => barisAkun(['HPP', 'Operasional']))
const akunDepresiasi = computed(() => barisAkun(['Depresiasi']))

/** CSV of the range: every account with its months, the comparison and the change. */
function unduhCsv() {
  const r = rentang.value
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
  const kepala = ['Kelompok', 'Kode', 'Nama akun', ...r.map(id => `${lblBulan(id)} ${id.slice(0, 4)}`), `Total ${lblRentang(r)}`]
  if (tb.value) kepala.push(`Pembanding ${lblRentang(bandingAda.value)}`, 'Selisih', 'Perubahan %')
  const isi = [...akunKeluar.value, ...akunDepresiasi.value].map((a) => {
    const row: (string | number)[] = [a.grup, a.kode, a.nama, ...r.map(id => Math.round(a.v[id] ?? 0)), Math.round(a.nilai)]
    if (tb.value) {
      const p = ubahPct(a.nilai, a.dulu ?? 0)
      row.push(Math.round(a.dulu ?? 0), Math.round(a.nilai - (a.dulu ?? 0)), p === null ? '' : p.toFixed(1))
    }
    return row.map(q).join(';')
  })
  const blob = new Blob([String.fromCharCode(0xFEFF) + `${[kepala.map(q).join(';'), ...isi].join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url
  el.download = `pengeluaran-${r[0]}_${r[r.length - 1]}.csv`
  el.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <AppPage
    title="Pengeluaran & EBITDA"
    description="Dana keluar (HPP + operasional), EBITDA, dan depresiasi dari laporan Laba Rugi ESB"
  >
    <template #actions>
      <UButton
        label="Unduh CSV"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        size="lg"
        :disabled="!pl || !rentang.length"
        @click="unduhCsv"
      />
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="lg"
        :disabled="!bolehLihat"
        :loading="merefresh"
        @click="refreshEsb"
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
      <!-- filters -->
      <div class="flex flex-col gap-4 rounded-panel bg-default p-5 shadow-panel sm:p-6">
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-24 font-semibold">Tahun</span>
          <AppChips
            v-model="tahun"
            :options="pilihanTahun"
          />
          <span class="flex-1" />
          <span class="text-sm text-muted">Sumber: ESB Core · Laporan Laba Rugi bulan ke bulan</span>
        </div>
        <div
          v-if="simpanan"
          class="flex flex-wrap items-center gap-3"
        >
          <span class="w-24 font-semibold">Data</span>
          <span class="text-sm">
            <template v-if="simpanan.diambil">Terakhir di-refresh <b>{{ waktu(simpanan.diambil) }}</b> oleh {{ simpanan.oleh || '—' }}</template>
            <template v-else>Tahun {{ tahun }} belum pernah di-refresh dari ESB.</template>
          </span>
          <UButton
            v-if="simpanan.riwayat.length"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="lihatRiwayat ? 'i-lucide-chevron-up' : 'i-lucide-history'"
            :label="lihatRiwayat ? 'Tutup riwayat' : `Riwayat refresh (${simpanan.riwayat.length})`"
            @click="lihatRiwayat = !lihatRiwayat"
          />
        </div>
        <ol
          v-if="simpanan && lihatRiwayat"
          class="divide-y divide-default rounded-panel border border-default text-sm"
        >
          <li
            v-for="(r, i) in simpanan.riwayat"
            :key="i"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
          >
            <UIcon
              :name="r.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
              :class="r.ok ? 'text-success' : 'text-error'"
            />
            <span class="tabular-nums">{{ waktu(r.waktu) }}</span>
            <span class="text-muted">oleh {{ r.oleh || '—' }}</span>
            <span
              v-if="!r.ok"
              class="min-w-0 flex-1 truncate text-error"
              :title="r.pesan"
            >Gagal: {{ r.pesan }}</span>
          </li>
        </ol>
        <div
          v-if="bulanAda.length"
          class="flex flex-wrap items-center gap-3"
        >
          <span class="w-24 font-semibold">Periode</span>
          <AppChips
            v-model="cepat"
            :options="pilihanCepat"
          />
          <div class="flex items-center gap-2">
            <AppBulan
              v-model="dari"
              :min="bulanAda[0]"
              :max="bulanAda[bulanAda.length - 1]"
              class="w-44"
              aria-label="Dari bulan"
            />
            <span class="text-muted">sampai</span>
            <AppBulan
              v-model="sampai"
              :min="bulanAda[0]"
              :max="bulanAda[bulanAda.length - 1]"
              class="w-44"
              aria-label="Sampai bulan"
            />
          </div>
        </div>
        <div
          v-if="bulanAda.length"
          class="flex flex-wrap items-center gap-3"
        >
          <span class="w-24 font-semibold">Bandingkan</span>
          <AppChips
            v-model="pembanding"
            :options="pilihanPembanding"
          />
          <span class="text-sm text-muted">
            {{ lblRentang(rentang) }} vs {{ tb ? lblRentang(bandingAda) : 'tidak ada data pembanding' }}
            <template v-if="tb && !bandingLengkap"> (sebagian bulan pembanding tidak ada di ESB)</template>
          </span>
        </div>
      </div>

      <UAlert
        v-if="gagalRefresh"
        class="mt-6"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Refresh dari ESB gagal"
        :description="`${gagalRefresh}${pl ? ' Angka di bawah masih dari refresh terakhir.' : ''}`"
        :close="true"
        @update:open="gagalRefresh = ''"
      />
      <AppPanel
        v-if="(status === 'pending' || merefresh) && !pl"
        :title="merefresh ? 'Mengambil laporan dari ESB' : 'Memuat laporan tersimpan'"
        class="mt-6"
      >
        <USkeleton class="mt-3 h-24 w-full" />
      </AppPanel>
      <UAlert
        v-else-if="error"
        class="mt-6"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan tersimpan tidak bisa dibaca"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
      <AppPanel
        v-else-if="status === 'success' && !pl"
        title="Belum ada laporan"
        class="mt-6"
      >
        <p class="text-muted">
          Laporan Laba Rugi {{ tahun }} belum pernah diambil dari ESB. Tekan Refresh untuk mengambilnya; setelah itu halaman ini langsung menampilkannya tanpa menunggu ESB.
        </p>
        <UButton
          class="mt-4"
          label="Refresh dari ESB"
          icon="i-lucide-refresh-cw"
          :loading="merefresh"
          @click="refreshEsb"
        />
      </AppPanel>
      <template v-else-if="pl">
        <AppStatGrid
          :count="4"
          class="mt-6"
        >
          <AppStat
            label="Dana Keluar"
            :value="rupiah(t.danaKeluar)"
            icon="i-lucide-wallet"
            tone="error"
            :badge="lencana(t.danaKeluar, tb?.danaKeluar)?.teks"
            :badge-tone="lencana(t.danaKeluar, tb?.danaKeluar)?.warna === 'success' ? 'success' : lencana(t.danaKeluar, tb?.danaKeluar)?.warna === 'error' ? 'error' : 'neutral'"
            :sub="`HPP ${rupiah(t.hpp)} · Operasional ${rupiah(t.operasional)}${tb ? ` · ${subBanding(tb.danaKeluar)}` : ''}`"
          />
          <AppStat
            label="EBITDA"
            :value="rupiah(t.ebitda)"
            icon="i-lucide-trending-up"
            :tone="t.ebitda >= 0 ? 'success' : 'error'"
            :badge="lencana(t.ebitda, tb?.ebitda, true)?.teks"
            :badge-tone="lencana(t.ebitda, tb?.ebitda, true)?.warna === 'success' ? 'success' : lencana(t.ebitda, tb?.ebitda, true)?.warna === 'error' ? 'error' : 'neutral'"
            :sub="`Margin ${pct(t.ebitda, t.penjualanBersih)} dari penjualan bersih${tb ? ` · ${subBanding(tb.ebitda)}` : ''}`"
          />
          <AppStat
            label="Depresiasi & Amortisasi"
            :value="rupiah(t.depresiasi)"
            icon="i-lucide-building"
            tone="info"
            :badge="lencana(t.depresiasi, tb?.depresiasi)?.teks"
            :badge-tone="lencana(t.depresiasi, tb?.depresiasi)?.warna === 'success' ? 'success' : lencana(t.depresiasi, tb?.depresiasi)?.warna === 'error' ? 'error' : 'neutral'"
            :sub="`Beban non-tunai, tidak termasuk dana keluar${tb ? ` · ${subBanding(tb.depresiasi)}` : ''}`"
          />
          <AppStat
            label="EBIT (laba operasional)"
            :value="rupiah(t.ebit)"
            icon="i-lucide-calculator"
            tone="gold"
            :badge="lencana(t.ebit, tb?.ebit, true)?.teks"
            :badge-tone="lencana(t.ebit, tb?.ebit, true)?.warna === 'success' ? 'success' : lencana(t.ebit, tb?.ebit, true)?.warna === 'error' ? 'error' : 'neutral'"
            :sub="`EBITDA − depresiasi & amortisasi · penjualan bersih ${rupiah(t.penjualanBersih)}`"
          />
        </AppStatGrid>

        <AppPanel
          :title="`Per bulan ${tahun}`"
          class="mt-6"
        >
          <p
            v-if="!baris.length"
            class="text-muted"
          >
            ESB tidak mengirim data untuk tahun ini.
          </p>
          <div
            v-else
            class="mt-2 overflow-x-auto"
          >
            <table class="w-full text-base">
              <thead class="text-left text-sm text-muted">
                <tr>
                  <th class="px-3 py-3">
                    Bulan
                  </th>
                  <th class="px-3 py-3 text-right">
                    Penjualan bersih
                  </th>
                  <th class="px-3 py-3 text-right">
                    Dana keluar
                  </th>
                  <th class="px-3 py-3 text-right">
                    EBITDA
                  </th>
                  <th class="px-3 py-3 text-right">
                    Depresiasi
                  </th>
                  <th class="px-3 py-3 text-right">
                    EBIT
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in baris"
                  :key="b.id"
                  class="cursor-pointer border-t border-default hover:bg-elevated"
                  :class="rentang.includes(b.id) ? 'bg-elevated/60' : 'opacity-60'"
                  title="Klik untuk melihat bulan ini saja"
                  @click="pilihBulan(b.id)"
                >
                  <td class="px-3 py-3.5 font-medium">
                    {{ lblBulan(b.id) }}
                  </td>
                  <td class="px-3 py-3.5 text-right tabular-nums">
                    {{ rupiah(b.penjualanBersih) }}
                  </td>
                  <td class="px-3 py-3.5 text-right tabular-nums">
                    {{ rupiah(b.danaKeluar) }}
                    <UBadge
                      v-if="i > 0 && lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)"
                      class="ml-1.5"
                      variant="subtle"
                      :color="lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)!.warna"
                      :label="lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)!.teks"
                    />
                  </td>
                  <td
                    class="px-3 py-3.5 text-right font-semibold tabular-nums"
                    :class="b.ebitda < 0 ? 'text-error' : 'text-success'"
                  >
                    {{ rupiah(b.ebitda) }}
                    <UBadge
                      v-if="i > 0 && lencana(b.ebitda, baris[i - 1]!.ebitda, true)"
                      class="ml-1.5"
                      variant="subtle"
                      :color="lencana(b.ebitda, baris[i - 1]!.ebitda, true)!.warna"
                      :label="lencana(b.ebitda, baris[i - 1]!.ebitda, true)!.teks"
                    />
                  </td>
                  <td class="px-3 py-3.5 text-right tabular-nums text-muted">
                    {{ rupiah(b.depresiasi) }}
                  </td>
                  <td class="px-3 py-3.5 text-right tabular-nums">
                    {{ rupiah(b.ebit) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="mt-3 text-sm text-muted">
              Persen di samping angka = perubahan dibanding bulan sebelumnya. Baris yang redup ada di luar periode yang dipilih.
            </p>
          </div>
        </AppPanel>

        <div class="mt-6 grid gap-6">
          <AppPanel
            :title="`Akun dana keluar · ${lblRentang(rentang)}`"
          >
            <div
              v-if="tb"
              class="mt-1 mb-3 flex flex-wrap items-center gap-3"
            >
              <span class="text-sm text-muted">Urutkan</span>
              <AppChips
                v-model="urutan"
                :options="pilihanUrutan"
              />
            </div>
            <p
              v-if="!akunKeluar.length"
              class="text-muted"
            >
              Tidak ada beban HPP atau operasional.
            </p>
            <div
              v-else
              class="overflow-x-auto"
            >
              <table class="w-full min-w-[720px] table-fixed text-base">
                <thead class="text-left text-sm text-muted">
                  <tr>
                    <th class="w-32 px-3 py-3">
                      Kelompok
                    </th>
                    <th class="px-3 py-3">
                      Akun
                    </th>
                    <th class="w-44 px-3 py-3 text-right">
                      {{ lblRentang(rentang) }}
                    </th>
                    <th
                      v-if="tb"
                      class="w-44 px-3 py-3 text-right"
                    >
                      {{ lblRentang(bandingAda) }}
                    </th>
                    <th class="w-28 px-3 py-3 text-right">
                      Perubahan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="a in semuaAkun ? akunKeluar : akunKeluar.slice(0, 15)"
                    :key="a.kunci"
                    class="border-t border-default"
                  >
                    <td class="px-3 py-3.5">
                      <UBadge
                        :label="a.grup"
                        variant="subtle"
                        :color="a.grup === 'HPP' ? 'warning' : 'neutral'"
                      />
                    </td>
                    <td
                      class="truncate px-3 py-3.5"
                      :title="`${a.kode} ${a.nama} · ${pct(a.nilai, t.danaKeluar)} dari dana keluar`"
                    >
                      <span class="tabular-nums text-muted">{{ a.kode }}</span>&nbsp; {{ a.nama }}
                    </td>
                    <td class="px-3 py-3.5 text-right font-semibold tabular-nums">
                      {{ rupiah(a.nilai) }}
                    </td>
                    <td
                      v-if="tb"
                      class="px-3 py-3.5 text-right tabular-nums text-muted"
                    >
                      {{ rupiah(a.dulu ?? 0) }}
                    </td>
                    <td class="px-3 py-3.5 text-right">
                      <UBadge
                        v-if="lencana(a.nilai, a.dulu)"
                        variant="subtle"
                        :color="lencana(a.nilai, a.dulu)!.warna"
                        :label="lencana(a.nilai, a.dulu)!.teks"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UButton
              v-if="akunKeluar.length > 15"
              class="mt-3"
              color="neutral"
              variant="ghost"
              :label="semuaAkun ? 'Tampilkan 15 teratas' : `Tampilkan semua (${akunKeluar.length} akun)`"
              @click="semuaAkun = !semuaAkun"
            />
          </AppPanel>
          <AppPanel :title="`Depresiasi & amortisasi · ${lblRentang(rentang)}`">
            <p
              v-if="!akunDepresiasi.length"
              class="text-muted"
            >
              Tidak ada beban depresiasi di periode ini.
            </p>
            <ul
              v-else
              class="divide-y divide-default"
            >
              <li
                v-for="a in akunDepresiasi"
                :key="a.kunci"
                class="flex items-center gap-4 py-3.5"
              >
                <span
                  class="min-w-0 flex-1 truncate"
                  :title="`${a.kode} ${a.nama}${tb ? ` · sebelumnya ${rupiah(a.dulu ?? 0)}` : ''}`"
                >{{ a.nama }}</span>
                <span class="shrink-0 tabular-nums">{{ rupiah(a.nilai) }}</span>
                <UBadge
                  v-if="lencana(a.nilai, a.dulu)"
                  variant="subtle"
                  :color="lencana(a.nilai, a.dulu)!.warna"
                  :label="lencana(a.nilai, a.dulu)!.teks"
                />
              </li>
            </ul>
            <p class="mt-4 text-sm text-muted">
              Depresiasi bukan uang yang keluar dari kas; ia hanya menurunkan nilai aset di pembukuan.
            </p>
          </AppPanel>
        </div>
      </template>
    </template>
  </AppPage>
</template>
