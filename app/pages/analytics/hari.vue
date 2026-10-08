<!--
  Analytics › Hari & Jam. Turnover per weekday, the two shifts, the hourly
  spread and the per-date list (deploy/analytics/index.html:1816 vHari).
  Denominators come from the tables themselves, never from ringkas grand:
  ringkas covers the WHOLE file including the neighbouring month, while
  hari[] is cut to the stored month.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { batasShift, diRentang } from '~/utils/analytics-agregat'
import { BLN, HARI, angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('hari'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const laporan = computed(() => isi.value?.data.laporan ?? {})
const daftarBulan = computed(() => Object.keys(laporan.value).sort().reverse())
const blnPilih = useState<string | null>('analytics-bln', () => null)
const bulan = computed(() => {
  const a = daftarBulan.value
  if (blnPilih.value && a.includes(blnPilih.value)) return blnPilih.value
  return a[0] ?? ''
})
const d = computed(() => (bulan.value ? laporan.value[bulan.value] ?? null : null))

const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}
const ketLaporan = computed(() => {
  if (!d.value) return ''
  return `${d.value.jenis === 'menu' ? 'Menu Report' : 'Bill Report'} · diunggah ${d.value.diunggah}${d.value.oleh ? ` oleh ${d.value.oleh}` : ''}`
})
const dowDari = (t: string) => new Date(`${t}T00:00:00`).getDay()

interface BarisDow { i: number, nama: string, n: number, grand: number, bill: number }
const dow = computed<BarisDow[]>(() => {
  const agg = Array.from({ length: 7 }, () => ({ n: 0, grand: 0, bill: 0 }))
  for (const t of Object.keys(d.value?.hari ?? {})) {
    const k = agg[dowDari(t)]!
    const h = d.value!.hari[t]!
    k.n++
    k.grand += h.grand ?? 0
    k.bill += h.bill ?? 0
  }
  return [1, 2, 3, 4, 5, 6, 0].map(i => ({ i, nama: HARI[i] ?? '', n: agg[i]!.n, grand: agg[i]!.grand, bill: agg[i]!.bill }))
})
const totalHari = computed(() => Object.values(d.value?.hari ?? {}).reduce((a, x) => a + (x.grand ?? 0), 0))
const tglAda = computed(() => Object.keys(d.value?.hari ?? {}).length)
const puncakDow = computed(() => Math.max(...dow.value.map(x => x.grand), 1))
const kolomDow: TableColumn<BarisDow>[] = [
  { accessorKey: 'nama', header: 'Hari' },
  { accessorKey: 'n', header: 'Jumlah hari' },
  { accessorKey: 'rata', header: 'Rata-rata omset' },
  { accessorKey: 'rataBill', header: 'Rata-rata bill' },
  { accessorKey: 'grand', header: 'Total omset' },
  { accessorKey: 'kon', header: 'Kontribusi' },
]

// --- two shifts ---
const shift = computed(() => batasShift(isi.value?.data.setting?.shift))
const lblShift = (a: number, z: number) => `${String(a).padStart(2, '0')}:00–${String(z % 24).padStart(2, '0')}:00`
const shiftHitung = computed(() => {
  const s = shift.value
  let g1 = 0
  let g2 = 0
  let b1 = 0
  let b2 = 0
  let gLain = 0
  let bLain = 0
  const jam = Array.isArray(d.value?.jam) ? d.value!.jam : []
  jam.forEach((x, j) => {
    const g = x?.grand ?? 0
    const bl = x?.bill ?? 0
    if (diRentang(j, s.s1a, s.s1b)) {
      g1 += g
      b1 += bl
    }
    else if (diRentang(j, s.s2a, s.s2b % 24)) {
      g2 += g
      b2 += bl
    }
    else {
      gLain += g
      bLain += bl
    }
  })
  return { g1, g2, b1, b2, gLain, bLain, tot: g1 + g2 + gLain }
})
const pct = (x: number, t: number) => t ? Math.round(x / t * 100) : 0

// --- hourly spread: same denominator as the shift cards, never ringkas ---
interface BarisJam { j: number, bill: number, grand: number, shift: string }
const sebaran = computed<BarisJam[]>(() => {
  const s = shift.value
  const jam = Array.isArray(d.value?.jam) ? d.value!.jam : []
  return jam.map((x, j) => ({
    j,
    bill: x?.bill ?? 0,
    grand: x?.grand ?? 0,
    shift: diRentang(j, s.s1a, s.s1b) ? 'siang' : diRentang(j, s.s2a, s.s2b % 24) ? 'malam' : '',
  })).filter(x => x.bill)
})
const tanpaJam = computed(() => (d.value?.ringkas?.grand ?? 0) - shiftHitung.value.tot)
const puncakJam = computed(() => Math.max(...sebaran.value.map(x => x.grand), 1))
const kolomJam: TableColumn<BarisJam>[] = [
  { accessorKey: 'j', header: 'Jam' },
  { accessorKey: 'bill', header: 'Bill' },
  { accessorKey: 'grand', header: 'Omset' },
  { accessorKey: 'kon', header: 'Kontribusi' },
  { accessorKey: 'rata', header: 'Rata/bill' },
]

interface BarisTgl { t: string, hari: string, bill: number, grand: number }
const perTgl = computed<BarisTgl[]>(() => Object.keys(d.value?.hari ?? {}).sort().map(t => ({
  t,
  hari: HARI[dowDari(t)] ?? '',
  bill: d.value!.hari[t]!.bill ?? 0,
  grand: d.value!.hari[t]!.grand ?? 0,
})))
const kolomTgl: TableColumn<BarisTgl>[] = [
  { accessorKey: 't', header: 'Tanggal' },
  { accessorKey: 'hari', header: 'Hari' },
  { accessorKey: 'bill', header: 'Bill' },
  { accessorKey: 'grand', header: 'Omset' },
  { accessorKey: 'rata', header: 'Rata/bill' },
]
</script>

<template>
  <AppPage
    title="Hari & Jam"
    description="Omset per hari dalam seminggu, dan sebaran jamnya"
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

    <AppPanel
      v-if="status === 'pending' && !isi"
      title="Memuat sebaran hari"
    >
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !isi">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tidak bisa membaca data analytics"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
    </div>

    <UAlert
      v-else-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman &quot;Hari &amp; Jam&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <div class="mb-4 flex flex-wrap items-center gap-1.5">
        <span class="text-sm font-semibold">Bulan</span>
        <AppChips
          v-model="blnPilih"
          :options="daftarBulan.map(b => ({ value: b, label: fmtBln(b) }))"
        />
        <span class="flex-1" />
        <span class="text-xs text-muted">{{ ketLaporan }}</span>
      </div>

      <div
        v-if="!d"
        class="rounded-field border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada laporan yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Sales Recapitulation</i> dari POS.
        </p>
      </div>

      <template v-else>
        <AppPanel
          title="Omset per Hari dalam Seminggu"
          description="Rata-rata menjawab hari mana yang lebih ramai — dan itu memang harus rata-rata, karena bulan yang punya lima Sabtu dan empat Senin akan selalu menunjukkan Sabtu lebih besar kalau yang dibandingkan jumlahnya. Kontribusi menjawab pertanyaan yang lain: dari mana omset bulan ini datang."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="dow"
            :columns="kolomDow"
          >
            <template #nama-cell="{ row }">
              <b>{{ row.original.nama }}</b>
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ row.original.n }}</span>
            </template>
            <template #rata-cell="{ row }">
              <span class="num">{{ rupiah(row.original.n ? row.original.grand / row.original.n : 0) }}</span>
            </template>
            <template #rataBill-cell="{ row }">
              <span class="num">{{ row.original.n ? Math.round(row.original.bill / row.original.n) : 0 }}</span>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(row.original.grand) }}</span>
            </template>
            <template #kon-cell="{ row }">
              <b class="num">{{ totalHari ? (row.original.grand / totalHari * 100).toFixed(1) : '0.0' }}%</b>
              <div class="mt-1 h-2.5 rounded bg-primary-100">
                <div
                  class="h-2.5 rounded bg-primary-500"
                  :style="{ width: `${Math.round(row.original.grand / puncakDow * 100)}%` }"
                />
              </div>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in dow"
              :key="x.i"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.nama }}</b>
                <b class="num text-sm">{{ totalHari ? (x.grand / totalHari * 100).toFixed(1) : '0.0' }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ x.n }} hari · rata-rata {{ rupiah(x.n ? x.grand / x.n : 0) }} · total {{ rupiah(x.grand) }}
              </div>
              <div class="mt-1 h-2 rounded bg-primary-100">
                <div
                  class="h-2 rounded bg-primary-500"
                  :style="{ width: `${Math.round(x.grand / puncakDow * 100)}%` }"
                />
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Rata-rata seluruh hari: <b>{{ rupiah(tglAda ? totalHari / tglAda : 0) }}</b> · total {{ rupiah(totalHari) }} dari {{ tglAda }} hari. Kolom Kontribusi berjumlah 100%, dan batangnya menggambar kolom itu — bukan rata-ratanya.
          </p>
        </AppPanel>

        <AppPanel
          title="Dua Shift"
          description="Dikelompokkan menurut jam bill dibuka (Sales In Time). Batas jamnya disetel di Pengaturan."
        >
          <AppStatGrid>
            <AppStat
              :label="`Siang · ${lblShift(shift.s1a, shift.s1b)}`"
              :value="rupiah(shiftHitung.g1)"
              icon="i-lucide-sun"
              tone="gold"
              :sub="`${pct(shiftHitung.g1, shiftHitung.tot)}% omset · ${angka(shiftHitung.b1)} bill${shiftHitung.b1 ? ` · ${rupiah(shiftHitung.g1 / shiftHitung.b1)}/bill` : ''}`"
            />
            <AppStat
              :label="`Malam · ${lblShift(shift.s2a, shift.s2b)}`"
              :value="rupiah(shiftHitung.g2)"
              icon="i-lucide-moon"
              tone="info"
              :sub="`${pct(shiftHitung.g2, shiftHitung.tot)}% omset · ${angka(shiftHitung.b2)} bill${shiftHitung.b2 ? ` · ${rupiah(shiftHitung.g2 / shiftHitung.b2)}/bill` : ''}`"
            />
            <AppStat
              label="Di luar keduanya"
              :value="rupiah(shiftHitung.gLain)"
              icon="i-lucide-clock"
              tone="info"
              :sub="`${pct(shiftHitung.gLain, shiftHitung.tot)}% · ${angka(shiftHitung.bLain)} bill`"
            />
          </AppStatGrid>
          <p
            v-if="shiftHitung.gLain > 0"
            class="mt-2 text-xs text-muted"
          >
            Yang di luar keduanya tetap dihitung supaya jumlah ketiganya sama dengan total di Ringkasan.
          </p>
          <UAlert
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Walk In / Event / Marketing per shift belum bisa dihitung"
            description="Breakdown Sumber tidak terbaca — perincian asal omset per shift menyusul bersama layar Pengaruh Event & Marketing di L3."
          />
        </AppPanel>

        <AppPanel
          title="Sebaran per Jam"
          description="Sepanjang bulan, menurut jam bill dibuka. Kontribusi = berapa persen omset bulan ini masuk di jam itu."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="sebaran"
            :columns="kolomJam"
          >
            <template #j-cell="{ row }">
              <span class="num">{{ String(row.original.j).padStart(2, '0') }}:00</span>
              <span
                v-if="row.original.shift"
                class="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-800"
              >{{ row.original.shift }}</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(row.original.grand) }}</span>
            </template>
            <template #kon-cell="{ row }">
              <b class="num">{{ shiftHitung.tot ? (row.original.grand / shiftHitung.tot * 100).toFixed(1) : '0.0' }}%</b>
              <div class="mt-1 h-2.5 rounded bg-primary-100">
                <div
                  class="h-2.5 rounded bg-primary-500"
                  :style="{ width: `${Math.round(row.original.grand / puncakJam * 100)}%` }"
                />
              </div>
            </template>
            <template #rata-cell="{ row }">
              <span class="num">{{ rupiah(row.original.bill ? row.original.grand / row.original.bill : 0) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in sebaran"
              :key="x.j"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="num text-sm">{{ String(x.j).padStart(2, '0') }}:00{{ x.shift ? ` · ${x.shift}` : '' }}</b>
                <b class="num text-sm">{{ shiftHitung.tot ? (x.grand / shiftHitung.tot * 100).toFixed(1) : '0.0' }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.bill) }} bill · {{ rupiah(x.grand) }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Kontribusi dihitung dari <b>{{ rupiah(shiftHitung.tot) }}</b> — omset yang jamnya terbaca di berkas POS, penyebut yang sama dengan kartu Dua Shift di atas. Kolomnya berjumlah 100%.<template v-if="tanpaJam > 0">
              <b>{{ rupiah(tanpaJam) }}</b> tidak ada di tabel ini karena jamnya tidak terbaca, jadi jumlah kolom Omset memang lebih kecil daripada total di Ringkasan.
            </template>
          </p>
        </AppPanel>

        <AppPanel
          title="Per Tanggal"
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="perTgl"
            :columns="kolomTgl"
          >
            <template #t-cell="{ row }">
              <span class="num">{{ tglPanjang(row.original.t) }}</span>
            </template>
            <template #hari-cell="{ row }">
              {{ row.original.hari }}
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(row.original.grand) }}</span>
            </template>
            <template #rata-cell="{ row }">
              <span class="num">{{ rupiah(row.original.bill ? row.original.grand / row.original.bill : 0) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in perTgl"
              :key="x.t"
              class="flex items-baseline justify-between gap-2 px-4 py-2.5"
            >
              <div>
                <b class="block text-sm">{{ tglPanjang(x.t) }}</b>
                <span class="text-xs text-muted">{{ angka(x.bill) }} bill</span>
              </div>
              <span class="num text-sm font-medium">{{ rupiah(x.grand) }}</span>
            </div>
          </div>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
