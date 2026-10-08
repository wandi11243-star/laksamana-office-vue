<!--
  Analytics › Metode Kunjungan. One table: Rekap Kanal — visit purposes with
  ONLINE split into its ordering channels (deploy/analytics/index.html:3957
  vKunjungan, rekapKanal :3900). Cards count the table below, never another
  source: splitting ONLINE shrinks the ONLINE row, so "top channel" and "top
  purpose" are not always the same answer.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { dineInKah, rekapKanal, type KanalBaris } from '~/utils/analytics-agregat'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('kunjungan'))
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

const rk = computed(() => rekapKanal(d.value?.kunjung ?? {}, d.value?.kunjungBayar ?? {}))
const rkG = computed(() => rk.value.baris.reduce((a, x) => a + x.grand, 0))
const rkB = computed(() => rk.value.baris.reduce((a, x) => a + x.bill, 0))
const teratas = computed<KanalBaris>(() => rk.value.baris[0] ?? { n: '—', grand: 0, bill: 0, dari: [] })
const adaBayar = computed(() => Object.keys(d.value?.kunjungBayar ?? {}).length > 0)
const billRingkas = computed(() => d.value?.ringkas?.bill ?? 0)
const pct = (x: number, t: number) => t ? Math.round(x / t * 100) : 0
const punBar = computed(() => rk.value.baris.reduce((a, x) => Math.max(a, x.bill), 0) || 1)
const kolom: TableColumn<KanalBaris>[] = [
  { accessorKey: 'n', header: 'Kanal' },
  { accessorKey: 'bill', header: 'Jumlah Transaksi' },
  { accessorKey: 'pctBill', header: '% transaksi' },
  { accessorKey: 'grand', header: 'Jumlah Omset' },
  { accessorKey: 'pctGrand', header: '% omset' },
  { accessorKey: 'rata', header: 'Rata-rata per transaksi' },
]
</script>

<template>
  <AppPage
    title="Metode Kunjungan"
    description="Rekap kanal, cara tamu datang, dan cara mereka membayar"
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
      title="Memuat kanal"
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
      :description="`Hak akses kamu di halaman &quot;Metode Kunjungan&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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

      <UAlert
        v-else-if="!Object.keys(d.kunjung ?? {}).length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan bulan ini belum memuat metode kunjungan"
        description="Kolom Visit Purpose baru ikut dibaca sejak 10 September 2026, jadi ringkasan yang disimpan sebelum itu tidak menyimpannya. Unggah ulang berkas bulan itu — ringkasannya akan ditimpa, dan metodenya ikut terbaca. Kalau sesudah diunggah ulang halaman ini tetap kosong, berkas POS-nya memang tidak punya kolom itu — ekspor ulang dari POS dengan kolom Visit Purpose ikut dicentang."
      />

      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Kanal Terbanyak"
            :value="teratas.n"
            icon="i-lucide-log-in"
            tone="gold"
            :sub="`${angka(teratas.bill)} transaksi · ${pct(teratas.bill, rkB)}% dari seluruh transaksi`"
          />
          <AppStat
            label="Jumlah Transaksi"
            :value="angka(rkB)"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`${rk.baris.length} kanal berbeda`"
          />
          <AppStat
            label="Jumlah Omset"
            :value="rupiah(rkG)"
            icon="i-lucide-banknote"
            tone="success"
            sub="seluruh kanal digabung"
          />
          <AppStat
            label="Rata-rata per Transaksi"
            :value="rkB ? rupiah(rkG / rkB) : '—'"
            icon="i-lucide-calculator"
            tone="info"
            sub="omset dibagi jumlah transaksi"
          />
        </AppStatGrid>

        <AppPanel
          title="Rekap Kanal"
          description="Cara tamu datang, dengan ONLINE dipecah jadi kanalnya masing-masing — GrabFood dan GoFood tidak pernah berdiri sendiri di kolom Visit Purpose; POS menulis keduanya ONLINE, dan bedanya cuma terbaca di kolom Payment Method. Diurut menurut jumlah transaksi."
          flush
        >
          <UAlert
            v-if="!adaBayar"
            class="m-4 mb-0"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Bulan ini belum bisa dipecah"
            :description="d.jenis === 'bill'
              ? 'Metode bayarnya belum terbaca, jadi yang tampil masih cara datang apa adanya: ONLINE berdiri sebagai satu baris, bukan sebagai GrabFood dan GoFood. Laporan bulan ini Bill Report, dan bentuk itu memang tidak punya kolom Payment Method sama sekali — mencentang kolomnya saat ekspor tidak akan menolong. Yang memuatnya Sales Recapitulation DETAIL Report; unggah berkas itu untuk bulan yang sama.'
              : 'Metode bayarnya belum terbaca, jadi yang tampil masih cara datang apa adanya. Kolom Payment Method baru ikut dibaca sejak 13 September 2026, jadi ringkasan yang disimpan sebelum itu tidak menyimpannya. Unggah ulang berkas bulan itu — ringkasannya akan ditimpa, dan metodenya ikut terbaca.'"
          />
          <UTable
            class="hidden lg:block"
            :data="rk.baris"
            :columns="kolom"
          >
            <template #n-cell="{ row }">
              <b>{{ row.original.n }}</b>
              <span
                v-if="row.original.dari.length"
                class="text-xs text-muted"
              > · dari {{ row.original.dari.join(', ') }}</span>
              <div
                v-if="dineInKah(row.original.n)"
                class="mt-1 rounded-field bg-primary-100 px-2 py-1 text-[11px] text-muted"
              >
                ↳ Walk In / Event / Marketing belum bisa dipecah — Breakdown Sumber tidak terbaca.
              </div>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #pctBill-cell="{ row }">
              <span class="num">{{ pct(row.original.bill, rkB) }}%</span>
              <div class="mt-1 h-2.5 rounded bg-primary-100">
                <div
                  class="h-2.5 rounded bg-primary-500"
                  :style="{ width: `${Math.round(row.original.bill / punBar * 100)}%` }"
                />
              </div>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(row.original.grand) }}</span>
            </template>
            <template #pctGrand-cell="{ row }">
              <span class="num">{{ pct(row.original.grand, rkG) }}%</span>
            </template>
            <template #rata-cell="{ row }">
              <span class="num">{{ row.original.bill ? rupiah(row.original.grand / row.original.bill) : '—' }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in rk.baris"
              :key="x.n"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.n }}</b>
                <b class="num text-sm">{{ pct(x.bill, rkB) }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.bill) }} transaksi · {{ rupiah(x.grand) }}{{ x.dari.length ? ` · dari ${x.dari.join(', ')}` : '' }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Batangnya menggambarkan <b>jumlah transaksi</b>, bukan omset. Kolom omsetnya berjumlah pas ke omset sebulan: tiap bill dibagi menurut nominal yang benar-benar dibayar lewat tiap metode, dan porsinya selalu berjumlah satu.
          </p>
          <p
            v-if="rk.baris.some(x => dineInKah(x.n))"
            class="px-4 pb-3 text-xs text-muted"
          >
            <b>Rincian DINE IN</b> (Walk In / Event / Marketing) tidak dari POS — POS tidak menandai bill mana yang milik acara. Event dan Marketing dibaca dari <b>Breakdown Sumber</b> yang diisi finance, dan Walk In adalah sisa DINE IN sesudah keduanya dikurangkan. Anggapannya: acara tercatat di POS sebagai DINE IN.
          </p>
        </AppPanel>

        <UAlert
          v-if="billRingkas && rkB !== billRingkas"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Kolom transaksi tidak bisa dijumlahkan"
          :description="`Jumlah transaksi di tabel ini ${angka(rkB)}, sementara Ringkasan menyebut ${angka(billRingkas)}. Bedanya bukan omset yang hilang: satu bill yang dibayar lewat lebih dari satu kanal dihitung penuh di masing-masing barisnya, sementara Ringkasan menghitungnya sekali. Kolom omsetnya bisa dijumlahkan.`"
        />
        <UAlert
          v-if="Object.keys(rk.takKanal).length"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Metode yang tersisa disebut namanya"
          :description="`${Object.entries(rk.takKanal).map(([vp, ms]) => `${vp} masih menyisakan transaksi yang metode bayarnya bukan kanal pemesanan: ${ms.join(', ')}`).join(' ')} Barisnya tetap berdiri dengan nama induknya. Kalau salah satu nama di atas sebenarnya kanal pemesanan baru, ia perlu didaftarkan supaya ikut dipecah.`"
        />
        <UAlert
          v-if="d.ringkas?.bayarRata"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="`${angka(d.ringkas.bayarRata)} transaksi dibagi rata`"
          description="Ditulis POS dengan beberapa metode tapi tanpa nominal, jadi omsetnya dibagi rata ke tiap metodenya. Itu perkiraan — jumlah totalnya tetap benar, pembagiannya yang tidak bisa dipastikan."
        />
        <p
          v-if="adaBayar"
          class="mt-4 text-xs text-muted"
        >
          Untuk bill yang dibayar sebagian tunai, nominal tunai yang dicatat POS adalah <b>uang yang diserahkan</b> — kembaliannya sudah dipotong dari komponen tunainya, bukan dibagi rata ke metode lain.
        </p>
        <p
          v-if="d.jenis === 'menu'"
          class="mt-2 text-xs text-muted"
        >
          Berkasnya laporan per menu, jadi satu transaksi punya beberapa baris. Yang dihitung di sini <b>nomor bill yang berbeda</b>, bukan jumlah barisnya.
        </p>
      </template>
    </template>
  </AppPage>
</template>
