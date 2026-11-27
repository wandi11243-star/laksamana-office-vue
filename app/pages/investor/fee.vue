<!--
  Investor Compass › Management Fee (Nov 2026). Deposits recorded in Finance ›
  Brankas › Pengembalian Modal (the "Management Fee" record and every return of
  kind management_fee), per month, split by the fee composition set in Kelola
  Akses. A recipient sees the total and only their own share; the full list is
  the investor admin's — the server filters, this page only draws.
-->
<script setup lang="ts">
import { getManagementFee, useInvestorIzin } from '~/composables/useInvestor'
import { BLN, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['investor'] })

const izin = useInvestorIzin()
const bolehLihat = computed(() => izin.lihat('fee'))

const { data, status, error, refresh } = useAsyncData('investor-fee', () => (bolehLihat.value ? getManagementFee() : Promise.resolve(null)), { watch: [bolehLihat] })

const bulan = computed(() => Object.keys(data.value?.perBulan ?? {}).sort())
const lblBulan = (b: string) => `${BLN[Number(b.slice(5)) - 1]} ${b.slice(2, 4)}`
const lblBulanPanjang = (b: string) => `${BLN[Number(b.slice(5)) - 1]} ${b.slice(0, 4)}`
const persenSaya = computed(() => data.value?.saya?.persen ?? null)
/** The chart shows the viewer's own share when they have one, else the whole fee (admin). */
const nilaiGrafik = computed(() => bulan.value.map(b => (data.value?.perBulan[b] ?? 0) * (persenSaya.value !== null && !data.value?.penerima ? persenSaya.value / 100 : 1)))
const modeGrafik = ref<'bar' | 'titik' | 'angka'>('bar')
const pilihanMode = [{ value: 'bar' as const, label: 'Bar', icon: 'i-lucide-chart-column' }, { value: 'titik' as const, label: 'Titik', icon: 'i-lucide-chart-scatter' }, { value: 'angka' as const, label: 'Angka', icon: 'i-lucide-table' }]
const fmtPersen = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`
</script>

<template>
  <AppPage
    title="Management Fee"
    description="Setoran management fee dan bagian tiap penerima"
  >
    <template #actions>
      <UButton
        label="Muat ulang"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="lg"
        :loading="status === 'pending'"
        :disabled="!bolehLihat"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      description="Management fee hanya untuk penerima yang terdaftar dan admin investor."
    />
    <AppPanel
      v-else-if="status === 'pending' && !data"
      title="Memuat management fee"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Management fee belum bisa dibaca"
      :description="apiErrorMessage(error)"
    />
    <template v-else-if="data">
      <UAlert
        v-if="data.gagal"
        class="mb-6"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Data Brankas tidak terbaca"
        description="Angka di bawah bisa kurang dari yang sebenarnya. Coba muat ulang sebentar lagi."
      />

      <AppStatGrid :count="3">
        <AppStat
          label="Total management fee"
          :value="rupiah(data.total)"
          icon="i-lucide-briefcase"
          tone="gold"
          :sub="`${data.riwayat.length} setoran tercatat di Brankas`"
        />
        <AppStat
          v-if="data.saya"
          label="Bagian saya"
          :value="rupiah(data.saya.nominal)"
          icon="i-lucide-user-check"
          tone="success"
          :sub="`${fmtPersen(data.saya.persen)} dari total`"
        />
        <AppStat
          label="Setoran terakhir"
          :value="data.riwayat[0] ? rupiah(data.riwayat[0].nominal) : '—'"
          icon="i-lucide-calendar-check"
          tone="info"
          :sub="data.riwayat[0] ? tglPanjang(data.riwayat[0].tgl) : 'Belum ada setoran'"
        />
      </AppStatGrid>

      <AppPanel
        :title="data.penerima || !data.saya ? 'Management fee per bulan' : 'Bagian saya per bulan'"
        class="mt-6"
      >
        <div class="mb-4">
          <AppSeg
            v-model="modeGrafik"
            size="sm"
            :options="pilihanMode"
          />
        </div>
        <AnalyticsGrafikBiaya
          :kategori="bulan.map(lblBulan)"
          :judul="bulan.map(lblBulanPanjang)"
          :nama="data.penerima || !data.saya ? 'Management fee' : 'Bagian saya'"
          warna="var(--color-gold)"
          :nilai="nilaiGrafik"
          :mode="modeGrafik"
          naik-baik
        />
      </AppPanel>

      <AppPanel
        v-if="data.penerima"
        title="Komposisi penerima"
        description="Hanya admin investor yang melihat daftar ini. Atur penerima dan persennya di Kelola Akses."
        class="mt-6"
      >
        <p
          v-if="!data.penerima.length"
          class="text-muted"
        >
          Belum ada penerima. Tambahkan di Kelola Akses.
        </p>
        <table
          v-else
          class="w-full text-base"
        >
          <thead class="text-left text-sm text-muted">
            <tr>
              <th class="px-3 py-3">
                Penerima
              </th>
              <th class="px-3 py-3 text-right">
                Persen
              </th>
              <th class="px-3 py-3 text-right">
                Bagian dari total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in data.penerima"
              :key="p.akunId"
              class="border-t border-default"
            >
              <td class="px-3 py-3.5 font-medium">
                {{ p.nama || p.akunId }}
              </td>
              <td class="px-3 py-3.5 text-right tabular-nums">
                {{ fmtPersen(p.persen) }}
              </td>
              <td class="px-3 py-3.5 text-right font-semibold tabular-nums">
                {{ rupiah(p.nominal) }}
              </td>
            </tr>
          </tbody>
        </table>
      </AppPanel>

      <AppPanel
        title="Riwayat setoran"
        class="mt-6"
      >
        <p
          v-if="!data.riwayat.length"
          class="text-muted"
        >
          Belum ada setoran management fee di Brankas.
        </p>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="(r, i) in data.riwayat"
            :key="i"
            class="flex items-center justify-between gap-4 py-3"
          >
            <span>{{ tglPanjang(r.tgl) }}</span>
            <span class="text-right">
              <b class="tabular-nums">{{ rupiah(r.nominal) }}</b>
              <span
                v-if="data.saya && !data.penerima"
                class="block text-xs text-muted tabular-nums"
              >bagian saya {{ rupiah(r.nominal * data.saya.persen / 100) }}</span>
            </span>
          </li>
        </ul>
      </AppPanel>
    </template>
  </AppPage>
</template>
