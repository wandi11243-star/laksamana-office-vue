<!--
  Analytics › Pengaruh Event. Event-day turnover vs plain days
  (deploy/analytics/index.html:5887 vDampak('Event')). The shows come from the
  Event module (read-only); the turnover from the stored POS month; the
  show's OWN value from Breakdown Sumber in the Kompas blob. Only "Event
  Done" counts — an Upcoming show never happened, so its day must not pose
  as an event day (nor as a plain day). Shared arithmetic lives in
  ~/utils/analytics-dampak (imported, like the old single painter).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { getStateEvent } from '~/composables/useEvent'
import {
  acaraSelesai, barisBdSumber, dowDari, hitungDampakPenuh, top3Acara,
  type AcaraDampak,
} from '~/utils/analytics-dampak'
import { BLN, HARI, angka, rupiah, tglPanjang } from '~/utils/format'
import { tglWIB } from '~/utils/event-hitung'

definePageMeta({ access: ['analytics'] })

const SUMBER = 'Event' as const
const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('event'))
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

/** WIB date of an EMS start_datetime — the module's one rule (event-hitung). */
const tglLokal = (v: unknown) => tglWIB(v)

const { data: eventState, status: eventStatus } = useAsyncData(
  'analytics-event-agenda',
  () => getStateEvent().then(r => r.data).catch(() => null),
)
const { data: kpState, status: kpStatus } = useAsyncData(
  'analytics-kompas-bd',
  () => useApi()<Envelope<{ daily?: { date?: unknown, bd?: Record<string, unknown> }[] }>>('/kompas/state').then(r => r.data).catch(() => null),
)
const evGagal = computed(() => eventStatus.value === 'error' || (eventStatus.value === 'success' && !eventState.value))
const kpGagal = computed(() => kpStatus.value === 'error' || (kpStatus.value === 'success' && !kpState.value))

// Read from the raw rows so the status check reads the row itself, not a name match.
const acaraBln = computed<AcaraDampak[]>(() => {
  const st = eventState.value
  if (!st) return []
  return (st.events ?? [])
    .filter(e => tglLokal(e.start_datetime).startsWith(bulan.value))
    .map(e => ({ tgl: tglLokal(e.start_datetime), judul: String(e.title ?? ''), sumber: SUMBER, kategori: String(e.category ?? '') || '(tanpa kategori)' }))
})
const acaraSelesaiList = computed(() => {
  const st = eventState.value
  if (!st) return []
  return (st.events ?? [])
    .filter(e => acaraSelesai(e.status) && tglLokal(e.start_datetime).startsWith(bulan.value))
    .map(e => ({ tgl: tglLokal(e.start_datetime), judul: String(e.title ?? ''), sumber: SUMBER, kategori: String(e.category ?? '') || '(tanpa kategori)' }) as AcaraDampak)
})
const acaraBelum = computed(() => acaraBln.value.filter((e) => {
  const st = eventState.value
  const row = (st?.events ?? []).find(x => x.title === e.judul && tglLokal(x.start_datetime) === e.tgl)
  return !acaraSelesai(row?.status)
}))

const katSet = computed(() => [...new Set(acaraSelesaiList.value.map(e => e.kategori))].sort())
const katPilih = ref('')
watch(bulan, () => {
  katPilih.value = ''
})
watch(katSet, (ops) => {
  if (katPilih.value && !ops.includes(katPilih.value)) katPilih.value = ''
})
const dipakai = computed(() => katPilih.value
  ? acaraSelesaiList.value.filter(e => e.kategori === katPilih.value)
  : acaraSelesaiList.value)

const bdRows = computed(() => barisBdSumber(kpState.value?.daily ?? [], SUMBER, bulan.value))
const hitung = computed(() => hitungDampakPenuh(
  (d.value?.hari ?? {}) as Record<string, { grand?: number }>,
  dipakai.value,
  acaraBelum.value,
  bdRows.value,
))
const petaAcara = computed(() => {
  const p: Record<string, AcaraDampak[]> = {}
  for (const e of dipakai.value) (p[e.tgl] ||= []).push(e)
  return p
})
const top3 = computed(() => top3Acara(bdRows.value))
const pBulan = (n: number) => hitung.value.totalBulan ? `${(n / hitung.value.totalBulan * 100).toFixed(1)}%` : '—'

/* Same-weekday comparison: a Saturday show is measured against plain Saturdays. */
const dowRata = computed(() => {
  const agg = Array.from({ length: 7 }, () => ({ n: 0, g: 0 }))
  for (const t of hitung.value.tanpa) {
    const k = agg[dowDari(t)]!
    k.n++
    k.g += d.value?.hari?.[t]?.grand ?? 0
  }
  return agg
})
interface BarisHari { t: string, dw: number, ev: number, bd: number | null }
const barisHari = computed<BarisHari[]>(() => hitung.value.adaEv.map(t => ({
  t, dw: dowDari(t), ev: d.value?.hari?.[t]?.grand ?? 0, bd: hitung.value.bdHari[t] ?? null,
})))
const kolomHari: TableColumn<BarisHari>[] = [
  { accessorKey: 't', header: 'Tanggal' },
  { accessorKey: 'ev', header: 'Omset hari itu' },
  { accessorKey: 'bd', header: 'Omset event saja' },
  { accessorKey: 'kon', header: 'Kontribusi hari itu' },
  { accessorKey: 'vs', header: 'Vs hari sama' },
]
</script>

<template>
  <AppPage
    title="Pengaruh Event"
    description="Omset hari berevent dibanding hari biasa"
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
      title="Memuat pengaruh event"
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
      :description="`Hak akses kamu di halaman &quot;Pengaruh Event&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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
        <UAlert
          v-if="evGagal"
          class="mb-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Modul Event tidak menjawab"
          description="Daftar acara di bawah belum lengkap, jadi perbandingannya belum bisa dipercaya."
        />
        <UAlert
          v-if="kpGagal || (kpStatus === 'success' && !kpState)"
          class="mb-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Breakdown Sumber tidak terbaca"
          description="Nilai acaranya sendiri (kolom Omset event saja dan tiga acara teratas) belum bisa ditampilkan. Isinya di panel Finance → Dashboard Omset → Breakdown Sumber."
        />

        <div
          v-if="katSet.length"
          class="mb-4 flex flex-wrap items-center gap-1.5"
        >
          <span class="text-sm font-semibold">Kategori</span>
          <AppChips
            v-model="katPilih"
            :options="[{ value: '', label: `Semua` }, ...katSet.map(k => ({ value: k, label: k }))]"
          />
        </div>

        <UAlert
          v-if="hitung.belum"
          class="mb-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="`Halaman ini hanya menghitung acara berstatus &quot;Event Done&quot;`"
          :description="`${angka(hitung.belum)} acara Event di ${fmtBln(bulan)} belum berstatus itu, jadi tidak ikut.${hitung.abuAbu.length ? ` ${angka(hitung.abuAbu.length)} hari yang acaranya belum selesai juga dikeluarkan dari pembanding &quot;hari tanpa acara&quot;.` : ''}`"
        />

        <AppStatGrid>
          <AppStat
            label="Hari Ada Acara"
            :value="angka(hitung.adaEv.length)"
            icon="i-lucide-star"
            tone="gold"
            :sub="`dari ${angka(Object.keys(d.hari ?? {}).length)} hari${katPilih ? ` · ${katPilih}` : ''}`"
          />
          <AppStat
            label="Omset Hari Itu"
            :value="rupiah(hitung.omsetEv)"
            icon="i-lucide-banknote"
            tone="gold"
            :sub="hitung.totalBulan ? `${pBulan(hitung.omsetEv)} dari omset ${fmtBln(bulan)} · seluruh tagihan hari itu` : 'belum ada omset'"
          />
          <AppStat
            label="Omset Event Saja"
            :value="kpState ? rupiah(hitung.omsetSaja) : '—'"
            icon="i-lucide-ticket"
            tone="info"
            :sub="!kpState ? 'Breakdown Sumber tidak terbaca' : hitung.omsetEv ? `${(hitung.omsetSaja / hitung.omsetEv * 100).toFixed(1)}% dari omset hari itu · ${pBulan(hitung.omsetSaja)} dari omset sebulan` : 'belum ada nilai acara'"
          />
          <AppStat
            label="Rata-rata Hari Ada Acara"
            :value="rupiah(hitung.rEv)"
            icon="i-lucide-scale"
            tone="info"
            :sub="`${angka(hitung.adaEv.length)} hari ada acara vs ${angka(hitung.tanpa.length)} hari biasa (rata-rata ${rupiah(hitung.rNo)})`"
          />
        </AppStatGrid>

        <AppPanel
          title="Tiga Acara Penyumbang Omset Terbesar"
          description="Nilai acaranya SENDIRI dari Breakdown Sumber — bukan omset satu hari penuh — dan berapa persennya dari seluruh omset bulan ini."
        >
          <UAlert
            v-if="!kpState"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Breakdown Sumber tidak terbaca"
            description="Daftar tiga acara terbesar belum bisa digambar."
          />
          <UAlert
            v-else-if="!top3.top.length"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="Belum ada baris Event bernilai"
            description="Isinya di panel Finance → Dashboard Omset → Breakdown Sumber."
          />
          <template v-else>
            <UTable
              class="hidden lg:block"
              :data="top3.top"
              :columns="[{ accessorKey: 'nama', header: 'Acara' }, { accessorKey: 'tgl', header: 'Tanggal' }, { accessorKey: 'omset', header: 'Omset event' }, { accessorKey: 'kon', header: 'Kontribusi' }]"
            >
              <template #nama-cell="{ row }">
                <b>{{ row.original.nama }}</b>
              </template>
              <template #tgl-cell="{ row }">
                <span class="num">{{ row.original.tgl.map((t: string) => tglPanjang(t)).join(', ') }}</span>
              </template>
              <template #omset-cell="{ row }">
                <span class="num">{{ rupiah(row.original.omset) }}</span>
              </template>
              <template #kon-cell="{ row }">
                <b class="num">{{ pBulan(row.original.omset) }}</b>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="(x, i) in top3.top"
                :key="x.nama"
                class="px-4 py-2.5"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <b class="text-sm">{{ i + 1 }}. {{ x.nama }}</b>
                  <b class="num text-sm">{{ pBulan(x.omset) }}</b>
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ rupiah(x.omset) }}
                </div>
              </div>
            </div>
            <p
              v-if="top3.sisa"
              class="px-4 py-3 text-xs text-muted"
            >
              {{ top3.sisa }} acara lain tidak ditampilkan · seluruh acara Event bulan ini {{ rupiah(top3.sisaOmset + top3.top.reduce((a, x) => a + x.omset, 0)) }}.
            </p>
            <UAlert
              v-if="top3.tanpaNama"
              class="m-4"
              color="info"
              variant="subtle"
              icon="i-lucide-info"
              :title="`${top3.tanpaNama} baris belum punya Nama Event`"
              description="Isi kolom Nama Event-nya di Breakdown Sumber."
            />
          </template>
        </AppPanel>

        <UAlert
          v-if="!hitung.adaEv.length"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Belum ada yang bisa dibandingkan"
          :description="`Tidak ada acara Event${katPilih ? ` berkategori ${katPilih}` : ''} yang tanggalnya punya data POS untuk ${fmtBln(bulan)}.`"
        />

        <AppPanel
          v-else
          title="Hari Ada Acara, Satu per Satu"
          description="Tiap hari dibandingkan dengan rata-rata hari yang sama tanpa acara di bulan ini. Sabtu berevent dibandingkan dengan Sabtu biasa, bukan dengan rata-rata seluruh hari."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="barisHari"
            :columns="kolomHari"
          >
            <template #t-cell="{ row }">
              <b class="num">{{ tglPanjang(row.original.t) }}</b>
              <span class="block text-xs text-muted">{{ HARI[row.original.dw] }} · {{ (petaAcara[row.original.t] ?? []).map(e => e.judul).join(', ') }}</span>
            </template>
            <template #ev-cell="{ row }">
              <span class="num">{{ rupiah(row.original.ev) }}</span>
            </template>
            <template #bd-cell="{ row }">
              <span
                v-if="row.original.bd === null"
                class="text-xs text-muted"
              >belum diisi</span>
              <span
                v-else
                class="num"
              >{{ rupiah(row.original.bd) }}</span>
            </template>
            <template #kon-cell="{ row }">
              <span
                v-if="row.original.bd === null || !row.original.ev"
                class="text-muted"
              >—</span>
              <b
                v-else
                class="num"
              >{{ (row.original.bd / row.original.ev * 100).toFixed(1) }}%</b>
            </template>
            <template #vs-cell="{ row }">
              <template v-if="dowRata[row.original.dw]!.n">
                <b
                  class="num"
                  :class="(row.original.ev - dowRata[row.original.dw]!.g / dowRata[row.original.dw]!.n) >= 0 ? 'text-success' : 'text-error'"
                >{{ ((row.original.ev - dowRata[row.original.dw]!.g / dowRata[row.original.dw]!.n) / (dowRata[row.original.dw]!.g / dowRata[row.original.dw]!.n) * 100 >= 0 ? '+' : '') }}{{ ((row.original.ev - dowRata[row.original.dw]!.g / dowRata[row.original.dw]!.n) / (dowRata[row.original.dw]!.g / dowRata[row.original.dw]!.n) * 100).toFixed(0) }}%</b>
                <span class="block text-xs text-muted">{{ dowRata[row.original.dw]!.n }} {{ HARI[row.original.dw] }} tanpa acara</span>
              </template>
              <span
                v-else
                class="text-xs text-muted"
              >tidak ada pembanding</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in barisHari"
              :key="x.t"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ tglPanjang(x.t) }}</b>
                <span class="num text-sm font-medium">{{ rupiah(x.ev) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ (petaAcara[x.t] ?? []).map(e => e.judul).join(', ') }}{{ x.bd !== null ? ` · acara ${rupiah(x.bd)}` : ' · nilai acara belum diisi' }}
              </div>
            </div>
          </div>
          <UAlert
            class="m-4"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Angka di atas bukan bukti sebab-akibat"
            description="Acara hampir selalu ditaruh di akhir pekan, dan akhir pekan memang lebih ramai tanpa acara apa pun. Kolom vs hari sama sudah membandingkan Sabtu dengan Sabtu, tapi ia tetap tidak bisa membuktikan acaranyalah yang menyebabkan selisihnya."
          />
          <p class="px-4 py-3 text-xs text-muted">
            Kolom Omset hari itu = seluruh tagihan hari itu menurut berkas POS. Kolom Omset event saja = nilai acaranya sendiri yang diketik finance di Breakdown Sumber. Keduanya dua sumber yang berbeda, jadi selisihnya bukan "omset non-event".
          </p>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
