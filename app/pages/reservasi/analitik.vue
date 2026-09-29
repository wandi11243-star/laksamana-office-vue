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
const jamCapWaktu = (ts: number) => ts
  ? new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-'
</script>

<template>
  <AppPage
    title="Analitik & laporan"
    description="Insight bisnis dari seluruh data reservasi. Angka menyesuaikan seiring data bertambah."
    :back="{ label: 'Semua layar', to: '/reservasi' }"
  >
    <template v-if="bolehBuka('analitik', role)">
      <div class="mb-5 flex flex-wrap items-end gap-2">
        <div class="flex gap-2">
          <UButton
            label="Harian"
            color="neutral"
            :variant="mode === 'harian' ? 'soft' : 'ghost'"
            size="sm"
            @click="mode = 'harian'"
          />
          <UButton
            label="Bulanan"
            color="neutral"
            :variant="mode === 'bulanan' ? 'soft' : 'ghost'"
            size="sm"
            @click="mode = 'bulanan'"
          />
        </div>
        <UFormField
          v-if="mode === 'harian'"
          label="Tanggal"
          class="max-w-44"
        >
          <UInput
            v-model="tanggal"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-else
          label="Bulan"
          class="max-w-44"
        >
          <UInput
            v-model="bulan"
            type="month"
            class="w-full"
          />
        </UFormField>
      </div>

      <div class="mb-7 max-w-xl">
        <AppFocus
          label="Kehadiran"
          :value="`${angka(perf.kehadiran)}%`"
          :hint="`${labelPeriode} · ${angka(perf.hadir)} hadir dari ${angka(perf.diharapkan)} diharapkan`"
        />
      </div>

      <AppList :title="`Performa ${mode === 'bulanan' ? 'bulanan' : 'harian'} — ${labelPeriode}`">
        <AppListRow
          title="Penilaian operasional"
          :description="`${angka(perf.reservasi)} reservasi${perf.walkin ? ` + ${angka(perf.walkin)} walk-in` : ''}${mode === 'bulanan' ? ` dalam ${angka(perf.hariAktif)} hari aktif` : ''}${perf.masihDuduk ? ` · ${angka(perf.masihDuduk)} tamu masih duduk` : ''}`"
          icon="i-lucide-gauge"
        />
        <AppListRow
          title="Tingkat kehadiran"
          :description="`${angka(perf.hadir)} hadir / ${angka(perf.diharapkan)} diharapkan`"
          icon="i-lucide-user-check"
        >
          <template #trailing>
            {{ angka(perf.kehadiran) }}%
          </template>
        </AppListRow>
        <AppListRow
          title="Tepat waktu"
          :description="`${angka(perf.tepat)} tepat, ${angka(perf.telat)} telat${perf.telatRata ? `, rata-rata +${fmtMenit(perf.telatRata)}` : ''}`"
          icon="i-lucide-timer"
        >
          <template #trailing>
            {{ angka(perf.tepatPersen) }}%
          </template>
        </AppListRow>
        <AppListRow
          title="Rata-rata durasi duduk"
          :description="`${angka(perf.durasiN)} tamu selesai${perf.masihDuduk ? `, ${angka(perf.masihDuduk)} masih duduk` : ''}`"
          icon="i-lucide-armchair"
        >
          <template #trailing>
            {{ perf.durasiRata !== null ? fmtMenit(perf.durasiRata) : '—' }}
          </template>
        </AppListRow>
        <AppListRow
          title="Realisasi pax"
          :description="`${angka(perf.paxDatang)} datang / ${angka(perf.paxPesan)} dipesan`"
          icon="i-lucide-users"
        >
          <template #trailing>
            {{ angka(perf.paxRealisasi) }}%
          </template>
        </AppListRow>
        <AppListRow
          title="No-show"
          :description="`${angka(perf.batal)} batal`"
          icon="i-lucide-user-x"
        >
          <template #trailing>
            {{ angka(perf.noShow) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Walk-in"
          description="tamu tanpa reservasi"
          icon="i-lucide-footprints"
        >
          <template #trailing>
            {{ angka(perf.walkin) }}
          </template>
        </AppListRow>
        <AppListRow
          v-if="mode === 'bulanan'"
          title="Hari tersibuk"
          :description="perf.tersibuk ? `${angka(perf.tersibuk.total)} tamu` : 'belum ada'"
          icon="i-lucide-trending-up"
        >
          <template #trailing>
            {{ perf.tersibuk ? tglPendek(perf.tersibuk.tgl) : '—' }}
          </template>
        </AppListRow>
      </AppList>

      <AppList
        v-if="mode === 'bulanan' && perf.trenHarian.length"
        :title="`Tren harian — ${labelPeriode}`"
      >
        <div class="space-y-2 px-4 py-3">
          <div
            v-for="t in perf.trenHarian"
            :key="t.tgl"
          >
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span>{{ tglPendek(t.tgl) }} — {{ angka(t.hadir) }} hadir</span>
              <b class="num">{{ angka(t.total) }}</b>
            </div>
            <div class="mt-0.5 h-2 overflow-hidden rounded bg-muted">
              <div
                class="h-full rounded bg-info"
                :style="{ width: `${Math.round(t.total / maksTren * 100)}%` }"
              />
            </div>
          </div>
        </div>
      </AppList>

      <div
        v-if="status === 'pending' && !periode.length"
        class="mb-5 text-sm text-muted"
      >
        Memuat…
      </div>
      <p
        v-else-if="!periode.length"
        class="mb-5 text-sm text-muted"
      >
        Belum ada data pada {{ mode === 'bulanan' ? 'bulan' : 'tanggal' }} ini.
      </p>

      <AppList
        v-if="perf.palingTelat.length"
        title="Tamu paling telat"
      >
        <AppListRow
          v-for="t in perf.palingTelat"
          :key="`${t.nama}${t.datang}`"
          :title="`${t.nama} — telat ${fmtMenit(t.telat)}`"
          :description="`booking ${t.booking}${mode === 'bulanan' ? `, ${tglPendek(t.tgl)}` : ''}, datang ${jamCapWaktu(t.datang)}`"
          icon="i-lucide-alarm-clock"
        />
      </AppList>

      <AppList
        v-if="perf.dudukTerlama.length"
        title="Durasi duduk terlama"
      >
        <AppListRow
          v-for="d in perf.dudukTerlama"
          :key="`${d.nama}${d.durasi}`"
          :title="`${d.nama} (${d.meja})`"
          :description="`${fmtMenit(d.durasi)}${perf.durasiRata !== null ? ` · rata-rata ${fmtMenit(perf.durasiRata)}` : ''}`"
          icon="i-lucide-armchair"
        >
          <template #trailing>
            {{ fmtMenit(d.durasi) }}
          </template>
        </AppListRow>
      </AppList>

      <AppList title="Ringkasan keseluruhan">
        <AppListRow
          title="Total reservasi"
          icon="i-lucide-calendar-days"
        >
          <template #trailing>
            {{ angka(ring.total) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Total pax"
          description="seluruh orang dipesan"
          icon="i-lucide-users"
        >
          <template #trailing>
            {{ angka(ring.totalPax) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Rata-rata pax"
          description="per reservasi"
          icon="i-lucide-scale"
        >
          <template #trailing>
            {{ ring.rataPax }}
          </template>
        </AppListRow>
        <AppListRow
          title="Rasio no-show"
          :description="`${angka(ring.noShow)} dari ${angka(ring.dinilai)} tamu`"
          icon="i-lucide-user-x"
        >
          <template #trailing>
            {{ angka(ring.rasioNoShow) }}%
          </template>
        </AppListRow>
        <AppListRow
          title="Pelanggan unik"
          icon="i-lucide-fingerprint"
        >
          <template #trailing>
            {{ angka(ring.unik) }}
          </template>
        </AppListRow>
      </AppList>

      <AppList title="Sumber reservasi terefektif">
        <AppListRow
          v-for="s in ring.perSumber"
          :key="s.label"
          :title="s.label"
          icon="i-lucide-megaphone"
        >
          <template #trailing>
            {{ angka(s.n) }}
          </template>
        </AppListRow>
        <p
          v-if="!ring.perSumber.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada data.
        </p>
      </AppList>

      <AppList title="Performa PIC">
        <AppListRow
          v-for="p in ring.perPic"
          :key="p.nama"
          :title="`${p.nama} (${angka(p.hadirPersen)}% hadir)`"
          icon="i-lucide-compass"
        >
          <template #trailing>
            {{ angka(p.total) }}
          </template>
        </AppListRow>
        <p
          v-if="!ring.perPic.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada data.
        </p>
      </AppList>

      <AppList title="Jam paling ramai (jumlah pax)">
        <AppListRow
          v-for="h in ring.perJam"
          :key="h.jam"
          :title="`${h.jam}:00 WIB`"
          icon="i-lucide-clock"
        >
          <template #trailing>
            {{ angka(h.pax) }} pax
          </template>
        </AppListRow>
        <p
          v-if="!ring.perJam.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada data.
        </p>
      </AppList>

      <AppList title="Hari paling ramai (jumlah pax)">
        <AppListRow
          v-for="h in ring.perHari"
          :key="h.hari"
          :title="h.hari"
          icon="i-lucide-calendar-range"
        >
          <template #trailing>
            {{ angka(h.pax) }} pax
          </template>
        </AppListRow>
      </AppList>

      <AppList title="Tren reservasi per bulan">
        <AppListRow
          v-for="m in ring.perBulan"
          :key="m.bulan"
          :title="m.bulan"
          icon="i-lucide-chart-column"
        >
          <template #trailing>
            {{ angka(m.n) }}
          </template>
        </AppListRow>
        <p
          v-if="!ring.perBulan.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada data.
        </p>
      </AppList>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
