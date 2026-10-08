<!--
  Analytics › Promo & Klaim. From the stored Promotion Report
  (deploy/analytics/index.html:4595 vPromo): which promo is claimed most,
  which goods, and at which hours. The value is two different costs —
  discounts cut the bill, freebies never entered turnover — and the screen
  says so. The month picker is its own.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState, type PromoBulan } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('promo'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const promoSimpan = computed<Record<string, PromoBulan>>(() => isi.value?.data.promo ?? {})
const daftarBulan = computed(() => Object.keys(promoSimpan.value).sort().reverse())
const blnPilih = useState<string | null>('analytics-bln-promo', () => null)
const bulan = computed(() => {
  const a = daftarBulan.value
  if (blnPilih.value && a.includes(blnPilih.value)) return blnPilih.value
  return a[0] ?? ''
})
const d = computed(() => (bulan.value ? promoSimpan.value[bulan.value] ?? null : null))

const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}
const ketLaporan = computed(() => {
  if (!d.value) return ''
  return `Promotion Report · diunggah ${d.value.diunggah}${d.value.oleh ? ` oleh ${d.value.oleh}` : ''}`
})

interface BarisPromo { n: string, tipe: string[], baris: number, bill: number, qty: number, nilai: number, nilaiDisc: number, nilaiGratis: number }
const urutKunci = ref<'bill' | 'qty' | 'nilai'>('bill')
const daftar = computed<BarisPromo[]>(() => {
  const pr = d.value?.promo ?? {}
  const list = Object.keys(pr).map((n) => {
    const p = pr[n]!
    const tp = Object.keys(p.tipe ?? {}).sort((a, x) => ((p.tipe[x] ?? 0) - (p.tipe[a] ?? 0)) || (a < x ? -1 : 1))
    return {
      n, tipe: tp, baris: p.baris ?? 0, bill: p.bill ?? 0, qty: p.qty ?? 0,
      nilai: p.nilai ?? 0, nilaiDisc: p.nilaiDisc ?? 0, nilaiGratis: p.nilaiGratis ?? 0,
    }
  })
  const k = urutKunci.value
  // Ties split by NAME so the order never shuffles between renders.
  return list.sort((a, x) => (x[k] - a[k]) || (x.bill - a.bill) || (a.n < x.n ? -1 : 1))
})
const totB = computed(() => daftar.value.reduce((a, x) => a + x.bill, 0))
const totR = computed(() => daftar.value.reduce((a, x) => a + x.baris, 0))
const totQ = computed(() => daftar.value.reduce((a, x) => a + x.qty, 0))
const totN = computed(() => daftar.value.reduce((a, x) => a + x.nilai, 0))
const teratas = computed(() => daftar.value.reduce<BarisPromo | null>(
  (a, x) => (!a || x.bill > a.bill ? x : a), null,
))
const pct = (x: number, t: number) => t ? Math.round(x / t * 100) : 0
const punBar = computed(() => daftar.value.reduce((a, x) => Math.max(a, x[urutKunci.value]), 0) || 1)
const r = computed(() => d.value?.ringkas)
const jam = computed(() => d.value?.jam ?? [])
const jamPuncak = computed(() => jam.value.reduce<{ j: number, v: number }>(
  (a, x, i) => ((x?.bill ?? 0) > a.v ? { j: i, v: x?.bill ?? 0 } : a), { j: -1, v: 0 },
))
const totJB = computed(() => jam.value.reduce((a, x) => a + (x?.bill ?? 0), 0))
const punJam = computed(() => jam.value.reduce((a, x) => Math.max(a, x?.bill ?? 0), 0) || 1)
const menuList = computed(() => {
  const mn = d.value?.menu ?? {}
  return Object.keys(mn).map(n => ({ n, qty: mn[n]?.qty ?? 0, nilai: mn[n]?.nilai ?? 0, baris: mn[n]?.baris ?? 0 }))
    .sort((a, x) => (x.qty - a.qty) || (x.nilai - a.nilai) || (a.n < x.n ? -1 : 1))
})
const totMQ = computed(() => menuList.value.reduce((a, x) => a + x.qty, 0))
const totMN = computed(() => menuList.value.reduce((a, x) => a + x.nilai, 0))

const kolomPromo: TableColumn<BarisPromo>[] = [
  { accessorKey: 'n', header: 'Promo' },
  { accessorKey: 'tipe', header: 'Tipe' },
  { accessorKey: 'bill', header: 'Transaksi' },
  { accessorKey: 'pct', header: '% klaim' },
  { accessorKey: 'baris', header: 'Baris' },
  { accessorKey: 'qty', header: 'Item' },
  { accessorKey: 'nilai', header: 'Nilai' },
]
</script>

<template>
  <AppPage
    title="Promo & Klaim"
    description="Promo mana yang paling banyak diklaim, barang apa, dan jam berapa"
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
      title="Memuat promo"
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
      :description="`Hak akses kamu di halaman &quot;Promo &amp; Klaim&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
    />

    <template v-else>
      <div
        v-if="daftarBulan.length"
        class="mb-4 flex flex-wrap items-center gap-1.5"
      >
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
          Belum ada laporan promo yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Promotion Report</i> dari POS. Jenis berkasnya dikenali sendiri, jadi tidak ada kotak unggah yang perlu dipilih.
        </p>
      </div>

      <UAlert
        v-else-if="!daftar.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan promo bulan ini kosong"
        description="Tidak ada satu baris promo pun yang terbaca. Unggah ulang berkasnya."
      />

      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Paling Sering Diklaim"
            :value="teratas ? teratas.n : '—'"
            icon="i-lucide-badge-percent"
            tone="gold"
            :sub="teratas ? `${angka(teratas.bill)} transaksi · ${pct(teratas.bill, totB)}% dari seluruh klaim` : ''"
          />
          <AppStat
            label="Transaksi Berpromo"
            :value="angka(r?.bill ?? 0)"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`${r?.promoBeda} promo berbeda · ${angka(totR)} baris`"
          />
          <AppStat
            label="Jam Paling Ramai"
            :value="jamPuncak.j >= 0 ? `${String(jamPuncak.j).padStart(2, '0')}:00` : '—'"
            icon="i-lucide-clock"
            tone="info"
            :sub="jamPuncak.j >= 0 ? `${angka(jamPuncak.v)} transaksi diklaim di jam itu` : 'jam klaim tidak terbaca'"
          />
          <AppStat
            label="Nilai Promo"
            :value="rupiah(r?.nilai ?? 0)"
            icon="i-lucide-banknote"
            tone="success"
            :sub="`diskon ${rupiah(r?.nilaiDisc ?? 0)} + barang dilepas ${rupiah(r?.nilaiGratis ?? 0)}`"
          />
        </AppStatGrid>

        <UAlert
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Nilai promo di halaman ini dua jenis biaya yang berbeda"
          :description="`Diskon (${rupiah(r?.nilaiDisc ?? 0)}) adalah uang yang dipotong dari tagihan, jadi ia sudah ikut mengurangi omset di laporan penjualan. Barang dilepas (${rupiah(r?.nilaiGratis ?? 0)}) dihitung dari Original Price × Qty — POS mencatat barang gratis berharga nol, jadi nilai itu tidak pernah ada di dalam omset dan tidak boleh dikurangkan lagi darinya. Keduanya boleh dijumlahkan karena tidak ada satu baris pun yang masuk ke dua-duanya.`"
        />

        <AppPanel
          title="Promo yang Diklaim"
          :description="`Transaksi dihitung dari nomor bill yang berbeda, bukan dari jumlah baris — satu bill bisa punya belasan baris promo kalau diskonnya menempel di tiap menu. Diurut menurut ${urutKunci === 'bill' ? 'jumlah transaksi' : urutKunci === 'qty' ? 'jumlah item' : 'nilai'}.`"
          flush
        >
          <div class="flex flex-wrap items-center gap-1.5 px-4 pt-4">
            <span class="text-sm font-semibold">Urut</span>
            <AppSeg
              v-model="urutKunci"
              size="sm"
              :options="[{ value: 'bill', label: 'Transaksi' }, { value: 'qty', label: 'Jumlah item' }, { value: 'nilai', label: 'Nilai' }]"
            />
          </div>
          <UTable
            class="hidden lg:block"
            :data="daftar"
            :columns="kolomPromo"
          >
            <template #n-cell="{ row }">
              <b>{{ row.original.n }}</b>
            </template>
            <template #tipe-cell="{ row }">
              <span class="text-xs text-muted">{{ row.original.tipe.join(' · ') }}</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #pct-cell="{ row }">
              <span class="num">{{ pct(row.original.bill, totB) }}%</span>
              <div class="mt-1 h-2.5 rounded bg-primary-100">
                <div
                  class="h-2.5 rounded bg-primary-500"
                  :style="{ width: `${Math.round(row.original[urutKunci] / punBar * 100)}%` }"
                />
              </div>
            </template>
            <template #baris-cell="{ row }">
              <span class="num">{{ angka(row.original.baris) }}</span>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ angka(row.original.qty) }}</span>
            </template>
            <template #nilai-cell="{ row }">
              <span class="num">{{ rupiah(row.original.nilai) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in daftar"
              :key="x.n"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.n }}</b>
                <b class="num text-sm">{{ pct(x.bill, totB) }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.bill) }} transaksi · {{ angka(x.qty) }} item · {{ rupiah(x.nilai) }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Total {{ angka(totB) }} transaksi · {{ angka(totR) }} baris · {{ angka(totQ) }} item · {{ rupiah(totN) }}. Batangnya menggambarkan kolom yang sedang dipakai mengurutkan.
          </p>
          <UAlert
            v-if="(r?.bill ?? 0) && totB !== r!.bill"
            class="m-4"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :title="`Jumlah kolom Transaksi ${angka(totB)}, sementara transaksi berpromo ${angka(r!.bill)}`"
            description="Bedanya bukan data yang hilang: satu bill yang memakai lebih dari satu promo ikut dihitung di masing-masing promonya, sementara kartu di atas menghitungnya sekali."
          />
        </AppPanel>

        <AppPanel
          title="Jam Klaim"
          description="Menurut jam bill dibuka. Jam yang tidak punya satu klaim pun tidak digambar barisnya."
          flush
        >
          <UAlert
            v-if="!totJB"
            class="m-4"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Jam klaim tidak bisa dibaca dari berkas ini"
            description="Promotion Report tidak punya kolom jam, jadi jamnya diturunkan dari nomor bill — dan nomor bill di berkas ini bukan stempel waktu. Angka jam yang ditebak akan terisi rapi dan sepenuhnya karangan, jadi lebih baik tidak ditampilkan sama sekali."
          />
          <template v-else>
            <UTable
              class="hidden lg:block"
              :data="jam.map((x, j) => ({ ...x, j })).filter(x => x.bill)"
              :columns="[{ accessorKey: 'j', header: 'Jam' }, { accessorKey: 'bill', header: 'Transaksi' }, { accessorKey: 'pct', header: '% klaim' }, { accessorKey: 'baris', header: 'Baris' }, { accessorKey: 'qty', header: 'Item' }, { accessorKey: 'nilai', header: 'Nilai' }]"
            >
              <template #j-cell="{ row }">
                <span class="num">{{ String(row.original.j).padStart(2, '0') }}:00</span>
                <div class="mt-1 h-2.5 rounded bg-primary-100">
                  <div
                    class="h-2.5 rounded bg-primary-500"
                    :style="{ width: `${Math.round(row.original.bill / punJam * 100)}%` }"
                  />
                </div>
              </template>
              <template #bill-cell="{ row }">
                <span class="num">{{ angka(row.original.bill) }}</span>
              </template>
              <template #pct-cell="{ row }">
                <span class="num">{{ pct(row.original.bill, totJB) }}%</span>
              </template>
              <template #baris-cell="{ row }">
                <span class="num">{{ angka(row.original.baris) }}</span>
              </template>
              <template #qty-cell="{ row }">
                <span class="num">{{ angka(row.original.qty) }}</span>
              </template>
              <template #nilai-cell="{ row }">
                <span class="num">{{ rupiah(row.original.nilai) }}</span>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="(x, j) in jam"
                v-show="x.bill"
                :key="j"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <b class="num text-sm">{{ String(j).padStart(2, '0') }}:00</b>
                  <span class="num text-sm">{{ angka(x.bill) }} transaksi</span>
                </div>
              </div>
            </div>
            <UAlert
              v-if="r?.jamGelap"
              class="m-4"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="`${angka(r.jamGelap)} baris tidak terbaca jamnya`"
              description="Tidak ikut di tabel ini, jadi jumlahnya memang lebih kecil daripada tabel promo di atas. Jam diturunkan dari nomor bill, dan yang dipakai hanya kalau tanggal di dalam nomor itu cocok dengan tanggal barisnya — yang tidak cocok sengaja tidak ditebak."
            />
          </template>
        </AppPanel>

        <AppPanel
          title="Barang yang Diklaim"
          description="Menu yang digratiskan atau didiskon, diurut menurut jumlah item. Diskon tingkat bill tidak menempel di satu menu pun, jadi barisnya memang tidak ada di sini."
          flush
        >
          <div
            v-if="!menuList.length"
            class="p-4 text-sm text-muted"
          >
            Tidak ada promo yang menempel di sebuah menu bulan ini — seluruhnya diskon tingkat bill.
          </div>
          <template v-else>
            <UTable
              class="hidden lg:block"
              :data="menuList"
              :columns="[{ accessorKey: 'n', header: 'Menu' }, { accessorKey: 'qty', header: 'Item' }, { accessorKey: 'pct', header: '% item' }, { accessorKey: 'nilai', header: 'Nilai' }]"
            >
              <template #n-cell="{ row }">
                <b>{{ row.original.n }}</b>
                <div class="mt-1 h-2.5 rounded bg-primary-100">
                  <div
                    class="h-2.5 rounded bg-primary-500"
                    :style="{ width: `${menuList[0] ? Math.round(row.original.qty / (menuList[0].qty || 1) * 100) : 0}%` }"
                  />
                </div>
              </template>
              <template #qty-cell="{ row }">
                <span class="num">{{ angka(row.original.qty) }}</span>
              </template>
              <template #pct-cell="{ row }">
                <span class="num">{{ pct(row.original.qty, totMQ) }}%</span>
              </template>
              <template #nilai-cell="{ row }">
                <span class="num">{{ rupiah(row.original.nilai) }}</span>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="m in menuList"
                :key="m.n"
                class="flex items-baseline justify-between gap-2 px-4 py-2.5"
              >
                <div>
                  <b class="block text-sm">{{ m.n }}</b>
                  <span class="text-xs text-muted">{{ angka(m.qty) }} item</span>
                </div>
                <span class="num text-sm font-medium">{{ rupiah(m.nilai) }}</span>
              </div>
            </div>
            <p class="px-4 py-3 text-xs text-muted">
              Total {{ angka(totMQ) }} item · {{ rupiah(totMN) }}.
              <template v-if="r?.tanpaMenu">
                {{ angka(r.tanpaMenu) }} baris promo tidak menempel di satu menu pun (diskon tingkat bill), jadi jumlah di sini lebih kecil daripada tabel promo di atas.
              </template>
            </p>
          </template>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
