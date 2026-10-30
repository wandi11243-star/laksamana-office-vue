<!--
  Analytics › Void & Cancel Menu. One row per CANCELLED ITEM from the stored
  Cancel Menu Detail Report (deploy/analytics/index.html:4410 vVoid). Cancel
  and void keep SEPARATE figures: in August 2026 cancel carried 68% of the
  value on a fifth of the rows. The month picker is its own — promo and sales
  months need not exist here.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState, type VoidBulan } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { vdKelompok, type VoidSimpan } from '~/utils/analytics-agregat'
import { BLN, angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('voidb'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const voidb = computed<Record<string, VoidBulan>>(() => isi.value?.data.voidb ?? {})
const daftarBulan = computed(() => Object.keys(voidb.value).sort().reverse())
const blnPilih = useState<string | null>('analytics-bln-void', () => null)
const bulan = computed(() => {
  const a = daftarBulan.value
  if (blnPilih.value && a.includes(blnPilih.value)) return blnPilih.value
  return a[0] ?? ''
})
const d = computed(() => (bulan.value ? voidb.value[bulan.value] ?? null : null))

const fmtBln = (b: string) => {
  const p = String(b || '').split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : (b || '—')
}
const ketLaporan = computed(() => {
  if (!d.value) return ''
  return `Cancel Menu Detail Report · diunggah ${d.value.diunggah}${d.value.oleh ? ` oleh ${d.value.oleh}` : ''}`
})

const baris = computed<VoidSimpan[]>(() => d.value?.baris ?? [])
const jenisNya = (x: VoidSimpan) => (x.jenis || '').trim().toUpperCase()
const vd = computed(() => baris.value.filter(x => jenisNya(x) === 'VOID'))
const cn = computed(() => baris.value.filter(x => jenisNya(x) && jenisNya(x) !== 'VOID'))
const jml = (a: VoidSimpan[]) => a.reduce((n, x) => n + x.total, 0)
const billBeda = (a: VoidSimpan[]) => new Set(a.map(x => x.bill).filter(Boolean)).size
const orang = computed(() => vdKelompok(baris.value, x => x.by || '(tanpa nama)'))
const alasan = computed(() => vdKelompok(baris.value, x => x.nota || '(tanpa alasan)'))
const teratas = computed(() => orang.value[0] ?? null)
const pct = (x: number, t: number) => t ? Math.round(x / t * 100) : 0

const perJam = computed(() => {
  const m: Record<number, number> = {}
  let tanpaJam = 0
  for (const x of baris.value) {
    if (x.jam >= 0 && x.jam <= 23) m[x.jam] = (m[x.jam] ?? 0) + 1
    else tanpaJam++
  }
  const jamAda = Object.keys(m).map(Number).sort((a, b) => a - b)
  const maks = jamAda.reduce((a, j) => Math.max(a, m[j] ?? 0), 0)
  return { jamAda, m, maks, tanpaJam }
})

const cari = ref('')
const detail = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const list = !q
    ? baris.value
    : baris.value.filter(x =>
        (x.menu || '').toLowerCase().includes(q)
        || (x.nota || '').toLowerCase().includes(q)
        || (x.bill || '').toLowerCase().includes(q)
        || (x.by || '').toLowerCase().includes(q)
        || (x.orderBy || '').toLowerCase().includes(q),
      )
  return [...list].sort((a, x) => (a.tgl < x.tgl ? 1 : a.tgl > x.tgl ? -1 : 0) || (x.jam - a.jam))
})
const kolomOrang: TableColumn<{ nama: string, baris: number, bill: number, qty: number, total: number }>[] = [
  { accessorKey: 'nama', header: 'Nama / Akun' },
  { accessorKey: 'baris', header: 'Baris' },
  { accessorKey: 'bill', header: 'Bill' },
  { accessorKey: 'qty', header: 'Qty' },
  { accessorKey: 'pct', header: '% baris' },
  { accessorKey: 'total', header: 'Nilai' },
]
const kolomDetail: TableColumn<VoidSimpan>[] = [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'jam', header: 'Jam' },
  { accessorKey: 'bill', header: 'Bill' },
  { accessorKey: 'menu', header: 'Item' },
  { accessorKey: 'qty', header: 'Qty' },
  { accessorKey: 'total', header: 'Nilai' },
  { accessorKey: 'jenis', header: 'Jenis' },
  { accessorKey: 'by', header: 'Dibatalkan oleh' },
  { accessorKey: 'orderBy', header: 'Dipesan oleh' },
  { accessorKey: 'nota', header: 'Alasan' },
]
</script>

<template>
  <AppPage
    title="Void & Cancel"
    description="Siapa yang membatalkan, alasannya, itemnya, nilainya, dan jamnya"
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
      title="Memuat pembatalan"
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
      :description="`Hak akses kamu di halaman &quot;Void &amp; Cancel&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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
        class="rounded-panel border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada laporan Void/Cancel yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Cancel Menu Detail Report</i> dari POS. Jenis berkasnya dikenali sendiri, jadi tidak ada kotak unggah yang perlu dipilih.
        </p>
      </div>

      <UAlert
        v-else-if="!baris.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan bulan ini kosong"
        description="Tidak ada satu baris pembatalan pun yang terbaca. Unggah ulang berkasnya."
      />

      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Nilai Dibatalkan"
            :value="rupiah(jml(baris))"
            icon="i-lucide-ban"
            tone="gold"
            :sub="`Void ${rupiah(jml(vd))} · Cancel ${rupiah(jml(cn))}`"
          />
          <AppStat
            label="Bill Tersentuh"
            :value="angka(billBeda(baris))"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`${angka(baris.length)} baris item`"
          />
          <AppStat
            label="Item Dibatalkan"
            :value="angka(d.ringkas?.qty ?? baris.reduce((a, x) => a + x.qty, 0))"
            icon="i-lucide-list"
            tone="info"
            sub="jumlah qty, bukan jumlah baris"
          />
          <AppStat
            label="Paling Sering"
            :value="teratas ? teratas.nama : '—'"
            icon="i-lucide-user"
            tone="info"
            :sub="teratas ? `${teratas.baris} baris · ${teratas.bill} bill` : ''"
          />
        </AppStatGrid>

        <UAlert
          v-if="baris.length > billBeda(baris)"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="`${baris.length} baris item dari ${billBeda(baris)} bill`"
          description="Satu bill bisa membatalkan banyak item sekaligus, jadi jumlah baris BUKAN jumlah kejadian pembatalan."
        />

        <AppPanel
          title="Siapa yang Membatalkan"
          description="Dari kolom Cancel / Void By di berkas POS. Diurut menurut jumlah baris item."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="orang"
            :columns="kolomOrang"
          >
            <template #nama-cell="{ row }">
              <b>{{ row.original.nama }}</b>
            </template>
            <template #baris-cell="{ row }">
              <span class="num">{{ angka(row.original.baris) }}</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ angka(row.original.qty) }}</span>
            </template>
            <template #pct-cell="{ row }">
              <span class="num">{{ pct(row.original.baris, baris.length) }}%</span>
            </template>
            <template #total-cell="{ row }">
              <span class="num">{{ rupiah(row.original.total) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in orang"
              :key="x.nama"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.nama }}</b>
                <span class="num text-sm font-medium">{{ rupiah(x.total) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.baris) }} baris · {{ angka(x.bill) }} bill · {{ angka(x.qty) }} item
              </div>
            </div>
          </div>
          <UAlert
            class="m-4"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Isinya akun yang menekan tombolnya"
            description="Sebagian adalah nama JABATAN yang dipakai bersama (mis. SPV, OPERATIONAL MANAGER) — bukan satu orang. Untuk menelusuri sampai ke orangnya, yang perlu diubah cara login di POS, bukan halaman ini."
          />
        </AppPanel>

        <AppPanel
          title="Alasan Pembatalan"
          description="Dari kolom Cancel Notes — teks bebas yang diketik saat membatalkan. Ejaan berbeda huruf besar-kecil digabung; yang tampil ejaan pertama."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="alasan"
            :columns="kolomOrang"
          >
            <template #nama-cell="{ row }">
              {{ row.original.nama }}
            </template>
            <template #baris-cell="{ row }">
              <span class="num">{{ angka(row.original.baris) }}</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num">{{ angka(row.original.bill) }}</span>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ angka(row.original.qty) }}</span>
            </template>
            <template #pct-cell="{ row }">
              <span class="num">{{ pct(row.original.baris, baris.length) }}%</span>
            </template>
            <template #total-cell="{ row }">
              <span class="num">{{ rupiah(row.original.total) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in alasan"
              :key="x.nama"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm">{{ x.nama }}</span>
                <span class="num text-sm font-medium">{{ rupiah(x.total) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.baris) }} baris · {{ angka(x.bill) }} bill
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Jam Pembatalan"
          description="Dari kolom Cancel / Void Time, dibaca sebagai jam WIB apa adanya. Jam yang tidak pernah ada pembatalannya memang tidak digambar."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="perJam.jamAda"
            :columns="[{ accessorKey: 'j', header: 'Jam' }, { accessorKey: 'n', header: 'Baris' }, { accessorKey: 'pct', header: '% baris' }]"
          >
            <template #j-cell="{ row }">
              <b class="num">{{ String(row.original).padStart(2, '0') }}:00</b>
              <div class="mt-1 h-2.5 rounded bg-primary-100">
                <div
                  class="h-2.5 rounded bg-primary-500"
                  :style="{ width: `${perJam.maks ? Math.round((perJam.m[row.original] ?? 0) / perJam.maks * 100) : 0}%` }"
                />
              </div>
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ angka(perJam.m[row.original]) }}</span>
            </template>
            <template #pct-cell="{ row }">
              <span class="num">{{ pct(perJam.m[row.original] ?? 0, baris.length) }}%</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="j in perJam.jamAda"
              :key="j"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="num text-sm">{{ String(j).padStart(2, '0') }}:00</b>
                <span class="num text-sm">{{ angka(perJam.m[j]) }} baris</span>
              </div>
            </div>
          </div>
          <p
            v-if="perJam.tanpaJam"
            class="px-4 py-3 text-xs text-muted"
          >
            {{ perJam.tanpaJam }} baris jamnya tidak terbaca, jadi tidak ikut di tabel ini.
          </p>
        </AppPanel>

        <AppPanel
          title="Detail Tiap Item yang Dibatalkan"
          description="Satu baris = satu item. Cari di nama menu, alasan, nomor bill, atau nama yang membatalkan."
          flush
        >
          <div class="px-4 pt-4">
            <UInput
              v-model="cari"
              placeholder="Cari menu / alasan / bill / nama…"
              icon="i-lucide-search"
              size="sm"
            />
          </div>
          <div
            v-if="!detail.length"
            class="p-4 text-sm text-muted"
          >
            Tidak ada baris yang cocok dengan “{{ cari }}”.
          </div>
          <UTable
            v-else
            class="hidden lg:block"
            :data="detail"
            :columns="kolomDetail"
          >
            <template #tgl-cell="{ row }">
              <span class="num">{{ tglPanjang(row.original.tgl) }}</span>
            </template>
            <template #jam-cell="{ row }">
              <span class="num">{{ row.original.jam >= 0 ? `${String(row.original.jam).padStart(2, '0')}:00` : '—' }}</span>
            </template>
            <template #bill-cell="{ row }">
              <span class="num text-xs">{{ row.original.bill || '—' }}</span>
            </template>
            <template #menu-cell="{ row }">
              <b>{{ row.original.menu || '—' }}</b>
              <span
                v-if="row.original.kat"
                class="block text-xs text-muted"
              >{{ row.original.kat }}</span>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ angka(row.original.qty) }}</span>
            </template>
            <template #total-cell="{ row }">
              <span class="num">{{ rupiah(row.original.total) }}</span>
            </template>
            <template #jenis-cell="{ row }">
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="jenisNya(row.original) === 'VOID' ? 'bg-muted' : 'bg-warning/15 text-warning'"
              >{{ row.original.jenis || '—' }}</span>
            </template>
            <template #by-cell="{ row }">
              {{ row.original.by || '—' }}
            </template>
            <template #orderBy-cell="{ row }">
              {{ row.original.orderBy || '—' }}
            </template>
            <template #nota-cell="{ row }">
              {{ row.original.nota || '—' }}
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in detail"
              :key="`${x.tgl}-${x.bill}-${x.menu}`"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.menu || '—' }}</b>
                <span class="num text-sm font-medium">{{ rupiah(x.total) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ tglPanjang(x.tgl) }} · {{ x.bill || '—' }} · {{ x.jenis || '—' }} · {{ x.by || '—' }}{{ x.nota ? ` · ${x.nota}` : '' }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Menampilkan {{ detail.length }} dari {{ baris.length }} baris{{ cari ? ' (tersaring)' : '' }}.
          </p>
        </AppPanel>

        <p
          v-if="d.ringkas?.blnLain"
          class="mt-4 text-xs text-muted"
        >
          {{ d.ringkas.blnLain }} baris bertanggal di luar {{ fmtBln(bulan) }} tidak ikut — aturan yang sama dengan halaman lain, supaya satu bulan tidak memajang data bulan sebelah.
        </p>
        <UAlert
          v-if="d.ringkas?.terpotong"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${angka(d.ringkas.terpotong)} baris tidak ikut tersimpan`"
          description="Batas 800 baris per bulan. Angka di halaman ini karena itu lebih kecil daripada berkasnya."
        />
        <p
          v-if="d.ringkas?.takTerbaca"
          class="mt-4 text-xs text-muted"
        >
          {{ angka(d.ringkas.takTerbaca) }} baris waktunya tidak terbaca dan dilewati.
        </p>
      </template>
    </template>
  </AppPage>
</template>
