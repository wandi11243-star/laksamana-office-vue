<!--
  Analitik & Laporan — business insight from the reservations. Two blocks:
  daily/monthly operational performance, then the whole-range summary with
  bar lists. Peak hour and peak day count PAX, never rows. Bars are plain
  divs (no chart library, §2.8); numbers stay in list rows, never big cards.
  Source: laksamana-office/deploy/reservasi/index.html:10349-10482.
-->
<script setup lang="ts">
import { useDaftarReservasi } from '~/composables/useReservasi'
import { bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import { angka, hariIni, tglPendek } from '~/utils/format'
import { fmtMenit } from '~/utils/kunci-meja'
import { performaPeriode, ringkasKeseluruhan } from '~/utils/analitik'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const role = computed(() => roleReservasi(me.value))

const mode = ref<'harian' | 'bulanan'>('harian')
const tanggal = ref(hariIni())
const bulan = ref(hariIni().slice(0, 7))

// The whole range for the summary. Without server paging this pulls the full
// table (G-08); the performance block filters it back down to the period.
const kosong = computed(() => '')
const { data: semua, status } = useDaftarReservasi(kosong, kosong, 'reservasi-analitik')

const periode = computed(() => (semua.value ?? []).filter(r =>
  mode.value === 'bulanan' ? r.date.slice(0, 7) === bulan.value : r.date === tanggal.value))

const labelPeriode = computed(() => mode.value === 'bulanan'
  ? new Date(`${bulan.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  : tglPendek(tanggal.value))

const perf = computed(() => performaPeriode(periode.value, labelPeriode.value, mode.value === 'bulanan'))
const ring = computed(() => ringkasKeseluruhan(semua.value ?? []))

const maksTren = computed(() => Math.max(1, ...perf.value.trenHarian.map(t => t.total)))
// Each bar list is scaled to its own largest value, like the old .bar-fill.
const maksDuduk = computed(() => Math.max(1, ...perf.value.dudukTerlama.map(d => d.durasi)))
const maksSumber = computed(() => Math.max(1, ...ring.value.perSumber.map(x => x.n)))
const maksPic = computed(() => Math.max(1, ...ring.value.perPic.map(x => x.total)))
const maksJam = computed(() => Math.max(1, ...ring.value.perJam.map(x => x.pax)))
const maksHari = computed(() => Math.max(1, ...ring.value.perHari.map(x => x.pax)))
const maksBulan = computed(() => Math.max(1, ...ring.value.perBulan.map(x => x.n)))
const jamCapWaktu = (ts: number) => ts
  ? new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-'
</script>

<template>
  <AppPage
    title="Analitik & laporan"
    description="Insight bisnis dari seluruh data reservasi. Angka menyesuaikan seiring data bertambah."
  >
    <template v-if="bolehBuka('analitik', role)">
      <AppPanel
        :title="`Performa ${mode === 'bulanan' ? 'bulanan' : 'harian'}`"
        icon="i-lucide-chart-column"
      >
        <template #actions>
          <AppSeg
            v-model="mode"
            size="sm"
            :options="[
              { value: 'harian', label: 'Harian', icon: 'i-lucide-calendar' },
              { value: 'bulanan', label: 'Bulanan', icon: 'i-lucide-calendar-range' },
            ]"
          />
          <UInput
            v-if="mode === 'harian'"
            v-model="tanggal"
            type="date"
            class="w-40"
          />
          <UInput
            v-else
            v-model="bulan"
            type="month"
            class="w-40"
          />
        </template>

        <p class="mb-4 rounded-field border border-info/25 bg-info/10 px-3.5 py-2.5 text-sm text-default">
          Penilaian operasional <b class="text-info">{{ labelPeriode }}</b> —
          {{ angka(perf.reservasi) }} reservasi<template v-if="perf.walkin">
            + {{ angka(perf.walkin) }} walk-in
          </template><template v-if="mode === 'bulanan'">
            dalam {{ angka(perf.hariAktif) }} hari aktif
          </template>.
          <b
            v-if="perf.masihDuduk"
            class="text-info"
          >{{ angka(perf.masihDuduk) }} tamu masih duduk</b><template v-if="perf.masihDuduk">
            sekarang.
          </template>
        </p>

        <p
          v-if="status === 'pending' && !periode.length"
          class="mb-4 text-sm text-muted"
        >
          Memuat…
        </p>
        <p
          v-else-if="!periode.length"
          class="mb-4 text-sm text-muted"
        >
          Belum ada data pada {{ mode === 'bulanan' ? 'bulan' : 'tanggal' }} ini.
        </p>

        <AppStatGrid>
          <AppStat
            label="Tingkat kehadiran"
            icon="i-lucide-user-check"
            tone="success"
            :value="angka(perf.kehadiran)"
            satuan="%"
            :sub="`${angka(perf.hadir)} hadir / ${angka(perf.diharapkan)} diharapkan`"
          />
          <AppStat
            label="Tepat waktu"
            icon="i-lucide-timer"
            :tone="perf.telat > perf.tepat ? 'error' : 'success'"
            :value="angka(perf.tepatPersen)"
            satuan="%"
            :sub="`${angka(perf.tepat)} tepat, ${angka(perf.telat)} telat${perf.telatRata ? `, rata² +${fmtMenit(perf.telatRata)}` : ''}`"
          />
          <AppStat
            label="Rata² durasi duduk"
            icon="i-lucide-utensils"
            tone="info"
            :value="perf.durasiRata !== null ? fmtMenit(perf.durasiRata) : '—'"
            :sub="`${angka(perf.durasiN)} tamu selesai${perf.masihDuduk ? `, ${angka(perf.masihDuduk)} masih duduk` : ''}`"
          />
          <AppStat
            label="Realisasi pax"
            icon="i-lucide-users"
            tone="vip"
            :value="angka(perf.paxRealisasi)"
            satuan="%"
            :sub="`${angka(perf.paxDatang)} datang / ${angka(perf.paxPesan)} dipesan`"
          />
          <AppStat
            label="No-show"
            icon="i-lucide-user-x"
            :tone="perf.noShow ? 'error' : 'success'"
            :value="angka(perf.noShow)"
            :sub="`${angka(perf.batal)} batal`"
          />
          <AppStat
            label="Walk-in"
            icon="i-lucide-footprints"
            :value="angka(perf.walkin)"
            sub="tamu tanpa reservasi"
          />
          <AppStat
            v-if="mode === 'bulanan'"
            label="Hari tersibuk"
            icon="i-lucide-trending-up"
            tone="info"
            :value="perf.tersibuk ? tglPendek(perf.tersibuk.tgl) : '—'"
            :sub="perf.tersibuk ? `${angka(perf.tersibuk.total)} tamu` : 'belum ada'"
          />
        </AppStatGrid>

        <div class="grid gap-x-8 gap-y-2 lg:grid-cols-2">
          <div>
            <h3 class="mb-3 font-sans text-xs font-bold uppercase tracking-wider text-muted">
              Ketepatan kedatangan
            </h3>
            <AppBar
              label="Tepat waktu (≤10m)"
              :value="angka(perf.tepat)"
              :persen="perf.tepat + perf.telat ? perf.tepat / (perf.tepat + perf.telat) * 100 : 0"
              tone="success"
            />
            <AppBar
              label="Telat (>10m)"
              :value="angka(perf.telat)"
              :persen="perf.tepat + perf.telat ? perf.telat / (perf.tepat + perf.telat) * 100 : 0"
              tone="error"
            />
            <template v-if="perf.palingTelat.length">
              <h3 class="mb-2 mt-5 font-sans text-xs font-bold uppercase tracking-wider text-muted">
                Tamu paling telat
              </h3>
              <div
                v-for="t in perf.palingTelat"
                :key="`${t.nama}${t.datang}`"
                class="mb-2 border-s-2 border-primary-400 ps-3"
              >
                <p class="text-sm text-highlighted">
                  {{ t.nama }} — <b>telat {{ fmtMenit(t.telat) }}</b>
                </p>
                <p class="text-xs text-muted">
                  booking {{ t.booking }}{{ mode === 'bulanan' ? `, ${tglPendek(t.tgl)}` : '' }}, datang {{ jamCapWaktu(t.datang) }}
                </p>
              </div>
            </template>
          </div>
          <div>
            <h3 class="mb-3 font-sans text-xs font-bold uppercase tracking-wider text-muted">
              Durasi duduk terlama
            </h3>
            <AppBar
              v-for="d in perf.dudukTerlama"
              :key="`${d.nama}${d.durasi}`"
              :label="`${d.nama} (${d.meja})`"
              :value="fmtMenit(d.durasi)"
              :persen="d.durasi / maksDuduk * 100"
              tone="info"
            />
            <p
              v-if="!perf.dudukTerlama.length"
              class="text-sm text-muted"
            >
              Belum ada tamu yang selesai duduk. Tandai <b>Selesai</b> saat tamu pulang untuk mencatat durasi.
            </p>
          </div>
        </div>

        <template v-if="mode === 'bulanan' && perf.trenHarian.length">
          <h3 class="mb-3 mt-5 font-sans text-xs font-bold uppercase tracking-wider text-muted">
            Tren harian
          </h3>
          <AppBar
            v-for="t in perf.trenHarian"
            :key="t.tgl"
            :label="`${tglPendek(t.tgl)} — ${angka(t.hadir)} hadir`"
            :value="angka(t.total)"
            :persen="t.total / maksTren * 100"
            tone="info"
          />
        </template>
      </AppPanel>

      <AppSectionTitle
        title="Ringkasan keseluruhan"
        icon="i-lucide-trending-up"
      />
      <AppStatGrid>
        <AppStat
          label="Total reservasi"
          :value="angka(ring.total)"
        />
        <AppStat
          label="Total pax"
          icon="i-lucide-users"
          tone="info"
          :value="angka(ring.totalPax)"
          sub="seluruh orang dipesan"
        />
        <AppStat
          label="Rata-rata pax"
          tone="info"
          :value="ring.rataPax"
          sub="per reservasi"
        />
        <AppStat
          label="Rasio no-show"
          :tone="ring.rasioNoShow ? 'error' : 'success'"
          :value="angka(ring.rasioNoShow)"
          satuan="%"
          :sub="`${angka(ring.noShow)} dari ${angka(ring.dinilai)} tamu`"
        />
        <AppStat
          label="Pelanggan unik"
          tone="vip"
          :value="angka(ring.unik)"
        />
      </AppStatGrid>

      <div class="grid gap-x-5 lg:grid-cols-2">
        <AppPanel
          title="Sumber reservasi terefektif"
          icon="i-lucide-megaphone"
        >
          <AppBar
            v-for="x in ring.perSumber"
            :key="x.label"
            :label="x.label"
            :value="angka(x.n)"
            :persen="x.n / maksSumber * 100"
          />
          <p
            v-if="!ring.perSumber.length"
            class="text-sm text-muted"
          >
            Belum ada data.
          </p>
        </AppPanel>
        <AppPanel
          title="Performa PIC"
          icon="i-lucide-compass"
        >
          <AppBar
            v-for="x in ring.perPic"
            :key="x.nama"
            :label="`${x.nama} (${angka(x.hadirPersen)}% hadir)`"
            :value="angka(x.total)"
            :persen="x.total / maksPic * 100"
            tone="info"
          />
          <p
            v-if="!ring.perPic.length"
            class="text-sm text-muted"
          >
            Belum ada data.
          </p>
        </AppPanel>
        <AppPanel
          title="Jam paling ramai (peak hour)"
          icon="i-lucide-clock"
          description="jumlah pax"
        >
          <AppBar
            v-for="x in ring.perJam"
            :key="x.jam"
            :label="`${x.jam}:00 WIB`"
            :value="angka(x.pax)"
            :persen="x.pax / maksJam * 100"
          />
          <p
            v-if="!ring.perJam.length"
            class="text-sm text-muted"
          >
            Belum ada data.
          </p>
        </AppPanel>
        <AppPanel
          title="Hari paling ramai"
          icon="i-lucide-calendar-range"
          description="jumlah pax"
        >
          <AppBar
            v-for="x in ring.perHari"
            :key="x.hari"
            :label="x.hari"
            :value="angka(x.pax)"
            :persen="x.pax / maksHari * 100"
            tone="success"
          />
        </AppPanel>
      </div>
      <AppPanel
        title="Tren reservasi per bulan"
        icon="i-lucide-chart-column"
      >
        <AppBar
          v-for="x in ring.perBulan"
          :key="x.bulan"
          :label="x.bulan"
          :value="angka(x.n)"
          :persen="x.n / maksBulan * 100"
          tone="info"
        />
        <p
          v-if="!ring.perBulan.length"
          class="text-sm text-muted"
        >
          Belum ada data.
        </p>
      </AppPanel>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
