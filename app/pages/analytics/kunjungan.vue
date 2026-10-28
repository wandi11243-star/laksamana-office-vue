<!--
  Analytics › Metode Kunjungan. One table: Rekap Kanal — visit purposes with
  ONLINE split into its ordering channels (deploy/analytics/index.html:3957
  vKunjungan, rekapKanal :3900). Cards count the table below, never another
  source: splitting ONLINE shrinks the ONLINE row, so "top channel" and "top
  purpose" are not always the same answer.
-->
<script setup lang="ts">
import { useAnalyticsHarian } from '~/composables/useAnalyticsEsb'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { dineInKah, rekapKanal, type KanalBaris } from '~/utils/analytics-agregat'
import { BLN, angka, rupiah } from '~/utils/format'
import { barisBdJam, hariBelumBd, jumlahAcaraBd, petaJamAcara } from '~/utils/analytics-dampak'
import { getStateEvent } from '~/composables/useEvent'
import { getStateMkt } from '~/composables/useMarketing'
import { tglWIB } from '~/utils/event-hitung'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('kunjungan'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const laporan = computed(() => isi.value?.data.laporan ?? {})
const daftarBulan = computed(() => Object.keys(laporan.value).sort().reverse())
const blnPilih = useState<string | null>('analytics-bln', () => null)
// "Per hari": a picked date replaces the month on this page (HARIAN_VIEW)
const harian = useAnalyticsHarian()
const bulan = computed(() => {
  if (harian.hari.value) return harian.hari.value.slice(0, 7)
  const a = daftarBulan.value
  if (blnPilih.value && a.includes(blnPilih.value)) return blnPilih.value
  return a[0] ?? ''
})
const d = computed(() => (harian.hari.value ? harian.laporanHari.value : (bulan.value ? laporan.value[bulan.value] ?? null : null)))

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
// DINE IN split into Walk In / Event / Marketing (rincianDineIn, :4069):
// drawn as detail rows UNDER the DINE IN row, never as sibling rows — the
// split comes from the Breakdown Sumber, not from POS.
const { data: kpState, status: kpStatus } = useAsyncData(
  'analytics-kompas-bd',
  () => useApi()<Envelope<{ daily?: { date?: unknown, bd?: Record<string, unknown> }[] }>>('/kompas/state').then(r => r.data).catch(() => null),
)
const { data: evState } = useAsyncData('analytics-event-agenda', () => getStateEvent().then(r => r.data).catch(() => null))
const { data: mkState } = useAsyncData('analytics-mkt-jam', () => getStateMkt().then(r => r.data).catch(() => null))
const kpAda = computed(() => kpStatus.value === 'success' && !!kpState.value)
type BarisAcara = Record<string, unknown>
const rincian = computed(() => {
  const daily = Array.isArray(kpState.value?.daily) ? kpState.value!.daily : []
  const jam = petaJamAcara(evState.value, mkState.value)
  const ev = barisBdJam(daily, 'Event', bulan.value, jam)
  const mk = barisBdJam(daily, 'Marketing', bulan.value, jam)
  const evG = ev.reduce((a, r) => a + r.omset, 0)
  const mkG = mk.reduce((a, r) => a + r.omset, 0)
  const dine = rk.value.baris.find(x => dineInKah(x.n))?.grand ?? 0
  const wiMentah = dine - evG - mkG
  const acara = [
    ...((evState.value as { events?: BarisAcara[] } | null)?.events ?? [])
      .map(e => ({ tgl: tglWIB(e.start_datetime ?? e.tanggal), sumber: 'Event' as const, status: e.status })),
    ...((mkState.value as { events?: BarisAcara[] } | null)?.events ?? [])
      .map(e => ({ tgl: String(e.tanggal ?? '').slice(0, 10), sumber: 'Marketing' as const, status: e.status })),
  ]
  return {
    dine,
    baris: [
      { nama: 'Walk In', cat: 'DINE IN dikurangi acara', g: Math.max(0, wiMentah), trx: '—' },
      { nama: 'Event', cat: 'Breakdown Sumber', g: evG, trx: `${jumlahAcaraBd(ev)} acara` },
      { nama: 'Marketing', cat: 'Breakdown Sumber, termasuk Reservasi VIP', g: mkG, trx: `${jumlahAcaraBd(mk)} acara` },
    ],
    lebih: wiMentah < -0.5 ? -wiMentah : 0,
    belum: hariBelumBd(acara, ev, mk, bulan.value),
  }
})
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
          :model-value="blnPilih"
          :options="daftarBulan.map(b => ({ value: b, label: fmtBln(b) }))"
          @update:model-value="harian.pilihBulan"
        />
        <span class="flex-1" />
        <span class="text-xs text-muted">{{ ketLaporan }}</span>
      </div>

      <AnalyticsHarianPilih />

      <template v-if="harian.hari.value && !d" />
      <div
        v-else-if="!d"
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
          <table class="hidden w-full text-sm lg:table">
            <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
              <tr>
                <th class="w-10 px-4 py-2">
                  #
                </th>
                <th class="px-4 py-2">
                  Kanal
                </th>
                <th class="px-4 py-2 text-end">
                  Jumlah transaksi
                </th>
                <th class="px-4 py-2 text-end">
                  % transaksi
                </th>
                <th class="px-4 py-2 text-end">
                  Jumlah omset
                </th>
                <th class="px-4 py-2 text-end">
                  % omset
                </th>
                <th class="px-4 py-2 text-end">
                  Rata-rata per transaksi
                </th>
                <th class="w-40 px-4 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <template
                v-for="(x, i) in rk.baris"
                :key="x.n"
              >
                <tr>
                  <td class="px-4 py-2 text-muted num">
                    {{ i + 1 }}
                  </td>
                  <td class="px-4 py-2">
                    <b>{{ x.n }}</b>
                    <span
                      v-if="x.dari.length"
                      class="text-xs text-muted"
                    > · dari {{ x.dari.join(', ') }}</span>
                  </td>
                  <td class="px-4 py-2 text-end num">
                    {{ angka(x.bill) }}
                  </td>
                  <td class="px-4 py-2 text-end num">
                    {{ pct(x.bill, rkB) }}%
                  </td>
                  <td class="px-4 py-2 text-end num">
                    {{ rupiah(x.grand) }}
                  </td>
                  <td class="px-4 py-2 text-end num">
                    {{ pct(x.grand, rkG) }}%
                  </td>
                  <td class="px-4 py-2 text-end num">
                    {{ x.bill ? rupiah(x.grand / x.bill) : '—' }}
                  </td>
                  <td class="px-4 py-2">
                    <div class="h-2.5 rounded bg-primary-100">
                      <div
                        class="h-2.5 rounded bg-primary-500"
                        :style="{ width: `${Math.round(x.bill / punBar * 100)}%` }"
                      />
                    </div>
                  </td>
                </tr>
                <template v-if="dineInKah(x.n)">
                  <tr
                    v-if="!kpAda"
                    class="bg-primary-50 text-xs"
                  >
                    <td />
                    <td
                      colspan="7"
                      class="px-4 py-1.5 text-muted"
                    >
                      ↳ Walk In / Event / Marketing belum bisa dipecah — Breakdown Sumber tidak terbaca.
                    </td>
                  </tr>
                  <template v-else>
                    <tr
                      v-for="r in rincian.baris"
                      :key="r.nama"
                      class="bg-primary-50 text-xs"
                    >
                      <td />
                      <td class="px-4 py-1.5">
                        ↳ {{ r.nama }} <span class="text-muted">· {{ r.cat }}</span>
                      </td>
                      <td class="px-4 py-1.5 text-end num">
                        {{ r.trx }}
                      </td>
                      <td class="px-4 py-1.5 text-end text-muted num">
                        {{ pct(r.g, x.grand) }}% dari DINE IN
                      </td>
                      <td class="px-4 py-1.5 text-end num">
                        {{ rupiah(r.g) }}
                      </td>
                      <td class="px-4 py-1.5 text-end num">
                        {{ pct(r.g, rkG) }}%
                      </td>
                      <td />
                      <td />
                    </tr>
                    <tr
                      v-if="rincian.lebih || rincian.belum"
                      class="bg-primary-50 text-xs"
                    >
                      <td />
                      <td
                        colspan="7"
                        class="px-4 py-1.5 text-muted"
                      >
                        <template v-if="rincian.lebih">
                          Omset acara di Breakdown Sumber <b>{{ rupiah(rincian.lebih) }} lebih besar</b> daripada DINE IN — Walk In ditulis Rp0. Sebagian acaranya mungkin tercatat di POS bukan sebagai DINE IN.
                        </template>
                        <template v-if="rincian.belum">
                          <b>{{ rincian.belum }} hari</b> ada acara Event Done tapi Breakdown Sumber-nya belum diisi — omsetnya masih terhitung Walk In.
                        </template>
                      </td>
                    </tr>
                  </template>
                </template>
              </template>
            </tbody>
          </table>
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
