<!--
  Analytics › Error & Koreksi Bill. Bills flagged ERROR with their cause,
  value and handler (deploy/analytics/index.html:4155 vError). The marker is
  the "ERROR" PREFIX, never a closed list. What cannot be filled depends on
  the report shape — and the screen names which report holds it.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import type { ErrorBill } from '~/utils/analytics-agregat'
import { BLN, angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('error'))
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

const daftar = computed<ErrorBill[]>(() => d.value?.error ?? [])
const sumber = computed<string[]>(() => d.value?.ringkas?.errSumber ?? [])
const totN = computed(() => daftar.value.reduce((a, x) => a + (x.grand ?? 0), 0))
/* Grouped per LABEL — one bill may carry more than one, so the column must
   not be summed and that is said on screen. */
const perJenis = computed(() => {
  const m: Record<string, { n: number, nilai: number }> = {}
  for (const e of daftar.value) {
    for (const l of (e.label?.length ? e.label : ['(tanpa label)'])) {
      const o = m[l] || (m[l] = { n: 0, nilai: 0 })
      o.n++
      o.nilai += e.grand ?? 0
    }
  }
  return Object.keys(m).sort((a, x) => (m[x]!.n - m[a]!.n) || (a < x ? -1 : 1))
    .map(k => ({ k, ...m[k]! }))
})
/* Who tops the count — from the CASHIER when present, else the waiter. The
   card names which one; merging them would hide whether it is the processor
   or the order taker. */
const adaKasir = computed(() => daftar.value.some(e => e.kasir))
const orangTop = computed(() => {
  const orang: Record<string, number> = {}
  for (const e of daftar.value) {
    const nm = adaKasir.value ? (e.kasir || '') : (e.waiter ?? []).join(', ')
    if (nm) orang[nm] = (orang[nm] || 0) + 1
  }
  const urut = Object.keys(orang).sort((a, x) => orang[x]! - orang[a]!)
  return urut.length ? { n: urut[0]!, c: orang[urut[0]!]! } : null
})
const kurang = computed(() => {
  const out: string[] = []
  if (!adaKasir.value) out.push('Kasir (kolom Cashier)')
  if (!daftar.value.some(e => e.catatan)) out.push('Catatan bebas (kolom Additional Info)')
  if (!daftar.value.some(e => (e.menu ?? []).length)) out.push('Rincian menu')
  return out
})
const buka = ref('')
const kolom: TableColumn<ErrorBill>[] = [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'jam', header: 'Jam' },
  { accessorKey: 'bill', header: 'No. Bill' },
  { accessorKey: 'label', header: 'Jenis Error' },
  { accessorKey: 'grand', header: 'Nilai' },
  { accessorKey: 'kasir', header: 'Kasir' },
  { accessorKey: 'waiter', header: 'Waiter' },
  { accessorKey: 'catatan', header: 'Catatan' },
]
</script>

<template>
  <AppPage
    title="Error & Koreksi"
    description="Bill yang ditandai error — sebabnya, nilainya, dan siapa yang memegangnya"
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
      title="Memuat error"
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
      :description="`Hak akses kamu di halaman &quot;Error &amp; Koreksi&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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
        v-else-if="!Array.isArray(d.error)"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan bulan ini belum memuat catatan error"
        description="Bill yang ditandai error baru ikut dibaca sejak 15 September 2026, jadi ringkasan yang disimpan sebelum itu tidak menyimpannya. Unggah ulang berkas bulan itu — ringkasannya akan ditimpa, dan catatannya ikut terbaca."
      />
      <UAlert
        v-else-if="!daftar.length && sumber.length"
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        title="Tidak ada satu pun bill yang ditandai error bulan ini"
        :description="`Diperiksa dari kolom ${sumber.join(' dan ')}. Itu jawabannya, bukan data yang belum terbaca.`"
      />
      <UAlert
        v-else-if="!daftar.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Berkas bulan ini tidak punya kolom penanda error"
        description="Yang dibaca Payment Method (ada di Sales Recapitulation Detail Report) dan Additional Info (ada di Bill Report). Berkas yang diunggah tidak punya keduanya, jadi halaman ini tidak bisa menyimpulkan apa pun — bukan berarti tidak ada bill bermasalah."
      />

      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Bill Ditandai Error"
            :value="angka(daftar.length)"
            icon="i-lucide-triangle-alert"
            tone="gold"
            :sub="`${perJenis.length} jenis berbeda`"
          />
          <AppStat
            label="Nilai Total"
            :value="rupiah(totN)"
            icon="i-lucide-banknote"
            tone="info"
            sub="tagihan bill yang ditandai"
          />
          <AppStat
            label="Jenis Terbanyak"
            :value="perJenis.length ? perJenis[0]!.k : '—'"
            icon="i-lucide-tag"
            tone="info"
            :sub="perJenis.length ? `${perJenis[0]!.n} bill` : ''"
          />
          <AppStat
            :label="adaKasir ? 'Kasir Terbanyak' : 'Waiter Terbanyak'"
            :value="orangTop ? orangTop.n : '—'"
            icon="i-lucide-user"
            tone="info"
            :sub="orangTop ? `${orangTop.c} bill` : (adaKasir ? '' : 'kolom Cashier tidak ada di laporan ini')"
          />
        </AppStatGrid>

        <UAlert
          v-if="kurang.length"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="`Laporan bulan ini ${d.jenis === 'menu' ? 'Sales Recapitulation DETAIL Report' : 'Bill Report'}`"
          :description="`Bentuk itu tidak memuat ${kurang.join(', ')}. ${d.jenis === 'menu' ? 'Kasir dan catatan bebas hanya ada di Bill Report.' : 'Rincian menu hanya ada di Detail Report.'} Keduanya tidak bisa diunggah sekaligus — satu bulan menyimpan satu laporan — jadi pilih bentuk yang menjawab pertanyaan yang sedang dibawa.`"
        />

        <AppPanel
          title="Bill yang Ditandai Error"
          description="Diurut menurut waktu kejadiannya, bukan nilainya — yang dicari di sini urutan peristiwa, bukan mana yang terbesar. Tekan sebuah baris untuk melihat rinciannya."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="daftar"
            :columns="kolom"
          >
            <template #tgl-cell="{ row }">
              <span class="num">{{ tglPanjang(row.original.tgl) }}</span>
            </template>
            <template #jam-cell="{ row }">
              <span class="num">{{ row.original.jam >= 0 ? `${String(row.original.jam).padStart(2, '0')}:00` : '—' }}</span>
            </template>
            <template #bill-cell="{ row }">
              <button
                v-if="(row.original.menu ?? []).length"
                type="button"
                class="num text-left"
                @click="buka = buka === row.original.bill ? '' : row.original.bill"
              >
                {{ row.original.bill || '—' }} <span class="text-muted">▾</span>
              </button>
              <span
                v-else
                class="num"
              >{{ row.original.bill || '—' }}</span>
            </template>
            <template #label-cell="{ row }">
              <b>{{ (row.original.label ?? []).join(', ') || '(tanpa label)' }}</b>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(row.original.grand ?? 0) }}</span>
            </template>
            <template #kasir-cell="{ row }">
              {{ row.original.kasir || '—' }}
            </template>
            <template #waiter-cell="{ row }">
              {{ (row.original.waiter ?? []).join(', ') || '—' }}
            </template>
            <template #catatan-cell="{ row }">
              <template v-if="row.original.catatan">
                {{ row.original.catatan }}
              </template>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="e in daftar"
              :key="e.bill"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ (e.label ?? []).join(', ') || '(tanpa label)' }}</b>
                <span class="num text-sm font-medium">{{ rupiah(e.grand ?? 0) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ tglPanjang(e.tgl) }} · {{ e.bill || '—' }} · {{ e.kasir || (e.waiter ?? []).join(', ') || '—' }}
              </div>
              <div
                v-if="e.catatan"
                class="mt-0.5 text-xs"
              >
                {{ e.catatan }}
              </div>
            </div>
          </div>
          <p
            v-if="daftar.some(e => (e.menu ?? []).length)"
            class="px-4 py-3 text-xs text-muted"
          >
            Catatan di rincian menu adalah <b>catatan memasak</b> ("dadar", "less sugar"), bukan sebab bill dibatalkan. Sebabnya ada di kolom <b>Catatan</b> di tabel atas, dan kolom itu cuma terisi kalau laporannya <b>Bill Report</b>.
          </p>
          <UAlert
            v-if="d.ringkas?.errLewat"
            class="m-4"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`${angka(d.ringkas.errLewat)} bill ber-error lagi tidak ikut disimpan`"
            description="Daftarnya dipotong supaya ringkasan bulan ini tidak membengkak. Yang tampil di atas yang pertama terbaca."
          />
        </AppPanel>

        <div
          v-if="buka"
          class="rounded-field border border-default bg-elevated p-4"
        >
          <p class="mb-2 text-xs font-semibold">
            Menu di bill {{ buka }} — kolom Waiter-nya per baris, jadi satu bill bisa menyebut lebih dari satu nama.
          </p>
          <div class="space-y-1">
            <div
              v-for="m in (daftar.find(e => e.bill === buka)?.menu ?? [])"
              :key="m.n"
              class="flex items-baseline justify-between gap-2 text-xs"
            >
              <span>{{ m.n }}{{ m.c ? ` · ${m.c}` : '' }} · {{ m.w || '—' }}</span>
              <span class="num text-muted">{{ angka(m.q) }} · {{ rupiah(m.v) }}</span>
            </div>
          </div>
        </div>

        <AppPanel
          title="Per Jenis Error"
          description="Dari penanda yang benar-benar tertulis di berkas POS — bukan daftar tetap. Jenis yang tidak pernah dipakai bulan ini memang tidak muncul."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="perJenis"
            :columns="[{ id: 'no', header: '#' }, { accessorKey: 'k', header: 'Jenis Error' }, { accessorKey: 'n', header: 'Jumlah Bill' }, { accessorKey: 'pct', header: '% bill' }, { accessorKey: 'nilai', header: 'Nilai' }]"
          >
            <template #no-cell="{ row }">
              <span class="text-muted num">{{ row.index + 1 }}</span>
            </template>
            <template #k-cell="{ row }">
              <b>{{ row.original.k }}</b>
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ angka(row.original.n) }}</span>
            </template>
            <template #pct-cell="{ row }">
              <span class="num">{{ daftar.length ? Math.round(row.original.n / daftar.length * 100) : 0 }}%</span>
            </template>
            <template #nilai-cell="{ row }">
              <span class="num">{{ rupiah(row.original.nilai) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="j in perJenis"
              :key="j.k"
              class="flex items-baseline justify-between gap-2 px-4 py-2.5"
            >
              <div>
                <b class="block text-sm">{{ j.k }}</b>
                <span class="text-xs text-muted">{{ angka(j.n) }} bill</span>
              </div>
              <span class="num text-sm font-medium">{{ rupiah(j.nilai) }}</span>
            </div>
          </div>
          <UAlert
            v-if="perJenis.reduce((a, x) => a + x.n, 0) > daftar.length"
            class="m-4"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :title="`Jumlah kolom di atas ${perJenis.reduce((a, x) => a + x.n, 0)}, sementara bill yang ditandai ${daftar.length}`"
            description="Bedanya bill yang membawa lebih dari satu penanda — tiap penanda dihitung penuh di barisnya sendiri."
          />
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
