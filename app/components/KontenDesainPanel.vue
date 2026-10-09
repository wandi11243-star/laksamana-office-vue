<!--
  Performa Desain (old pkPanelDesain + pkKartuMkt, deploy/assets/
  performa-konten.js:785-987; konten.md D.13). Numbers from
  app/utils/performa-konten.ts. Pass content + stand-alone tasks already
  filtered by brand; the month is shared with Performa Konten (useKeadaanPk).

  "Desain selesai" = content whose design need is done + stand-alone design
  tasks done + Marketing DESIGN requests finished (since 26 Sep 2026, counted
  SEPARATELY in their own card; videos are named but never added to design).
  The Marketing list is read lazily from GET /marketing/design-queue (all, with
  doneAt; G-16 / laksamana-api#190 opens it to `marketing|konten`); a failure
  (API down) says so with "Coba lagi" and the rest still works.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { KatPk } from '~/utils/performa-konten'
import type { KontenItem, ProdTask } from '~/utils/konten'
import {
  PK_KAT, PK_TANPA_KAT, pkAggER, pkAggViral, pkBandingDesain, pkBulanDesain, pkBulanMkt, pkDesainKategori, pkDesainRows,
  pkKumpul, pkNamaBulan, pkPersen,
} from '~/utils/performa-konten'
import { angka } from '~/utils/format'

const props = withDefaults(defineProps<{ content: KontenItem[], tasks: ProdTask[], kunci?: string }>(), { kunci: 'konten-pk' })
const st = useKeadaanPk(props.kunci)

// ---- Marketing requests (all, incl. finished)
const mkt = useReqDesainMktSemua()
const mktOk = computed(() => mkt.status.value === 'success' && !mkt.error.value)
const mktMuat = computed(() => mkt.status.value === 'pending' || mkt.status.value === 'idle')
const mktSelesai = (bulan: string) => (mkt.data.value ?? []).filter(r => r.status === 'done' && (!bulan || pkBulanMkt(r) === bulan))
const mktBulan = computed(() => mktSelesai(st.value.bulan))
const mktDesain = computed(() => mktBulan.value.filter(r => r.jenis !== 'edit').length)
const mktVideo = computed(() => mktBulan.value.length - mktDesain.value)
const mktAntri = computed(() => (mkt.data.value ?? []).filter(r => r.status !== 'done').length)
const perPemohon = computed(() => {
  const peta: Record<string, { nama: string, d: number, v: number }> = {}
  for (const r of mktBulan.value) {
    const n = String(r.pemohon ?? '').trim() || '(tanpa nama)'
    const e = (peta[n] ??= { nama: n, d: 0, v: 0 })
    if (r.jenis === 'edit') e.v++
    else e.d++
  }
  return Object.values(peta).sort((a, b) => (b.d + b.v) - (a.d + a.v) || a.nama.localeCompare(b.nama))
})

// ---- Konten's own design jobs
const rowsSemua = computed(() => pkDesainRows(props.content, props.tasks))
const rows = computed(() => rowsSemua.value.filter(r => !st.value.bulan || pkBulanDesain(r) === st.value.bulan))
const dariKonten = computed(() => rows.value.filter(r => r.src === 'konten').length)
const mandiri = computed(() => rows.value.length - dariKonten.value)
const tanpaCap = computed(() => rows.value.filter(r => !r.doneAt).length)

// ---- month picker: design months + finished Marketing months
const SEMUA = '__semua'
const opsiBulan = computed(() => {
  const ada = new Set<string>()
  for (const r of rowsSemua.value) {
    const b = pkBulanDesain(r)
    if (b) ada.add(b)
  }
  for (const r of mktSelesai('')) {
    const b = pkBulanMkt(r)
    if (b) ada.add(b)
  }
  const l = [...ada].sort().reverse()
  const out = [{ value: SEMUA, label: 'Semua bulan' }, ...l.map(b => ({ value: b, label: pkNamaBulan(b) }))]
  if (st.value.bulan && !l.includes(st.value.bulan)) out.push({ value: st.value.bulan, label: `${pkNamaBulan(st.value.bulan)} — tidak ada data` })
  return out
})
const bulan = computed({
  get: () => st.value.bulan || SEMUA,
  set: (v: string) => {
    st.value.bulan = v === SEMUA ? '' : v
  },
})

// ---- virality with vs without design
const banding = computed(() => pkBandingDesain(pkKumpul(props.content, { bulan: st.value.bulan })))
const vp = computed(() => pkAggViral(banding.value.pakai))
const vt = computed(() => pkAggViral(banding.value.tanpa))
const pct = (v: number | null) => (v == null ? '—' : `${pkPersen(v)}%`)
const selisih = computed(() => (vp.value == null || vt.value == null ? '—' : `${vp.value - vt.value >= 0 ? '+' : '−'}${pkPersen(Math.abs(vp.value - vt.value))} poin`))

// ---- per category
const opsiKat = (Object.keys(PK_KAT) as KatPk[]).map(k => ({ value: k, label: PK_KAT[k].t }))
const kat = computed({
  get: () => st.value.kat,
  set: (v: KatPk) => {
    st.value.kat = v
  },
})
const hasil = computed(() => pkDesainKategori(rows.value, st.value.kat))
const namaKat = computed(() => PK_KAT[st.value.kat].t)
const totalBaris = computed(() => hasil.value.list.reduce((s, r) => s + r.n, 0))
type BarisKat = ReturnType<typeof pkDesainKategori>['list'][number]
const R = { th: 'text-right', td: 'text-right' }
const kolomKat = computed<TableColumn<BarisKat>[]>(() => [
  { id: 'nama', header: namaKat.value },
  { id: 'n', header: 'Desain selesai', meta: { class: R } },
  { id: 'konten', header: 'Dari konten', meta: { class: R } },
  { id: 'mandiri', header: 'Tugas mandiri', meta: { class: R } },
])
</script>

<template>
  <div>
    <AppPanel>
      <USelect
        v-model="bulan"
        :items="opsiBulan"
        aria-label="Pilih bulan"
        class="w-full sm:w-56"
      />
      <p class="mt-3 text-sm text-muted">
        Yang dihitung pekerjaan desain yang sudah ditandai <b>Selesai</b> di Design Queue — dari konten, tugas mandiri,
        <b>dan request dari modul Marketing</b>. Request Marketing dihitung <b>terpisah</b> di kartunya sendiri (dan di
        kartu di bawah), jadi jumlah ketiganya bisa dicocokkan satu per satu.
      </p>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Desain selesai"
        :value="angka(rows.length + (mktOk ? mktDesain : 0))"
        :sub="`${st.bulan ? `Pada ${pkNamaBulan(st.bulan)}` : 'Seluruh periode'} · ${mktOk ? 'termasuk request Marketing' : 'request Marketing belum terbaca'}`"
      />
      <AppStat
        label="Dari konten"
        :value="angka(dariKonten)"
        sub="Konten yang ditandai butuh desain"
        tone="info"
      />
      <AppStat
        label="Tugas mandiri"
        :value="angka(mandiri)"
        sub="Pekerjaan desain di luar konten"
        tone="info"
      />
      <AppStat
        label="Request Marketing"
        :value="mktOk ? angka(mktDesain) : '—'"
        :sub="mktOk ? 'Request desain dari modul Marketing (video tidak ikut)' : 'sedang dimuat / belum terbaca'"
        tone="vip"
      />
    </AppStatGrid>

    <!-- Marketing requests -->
    <AppPanel
      title="Request dari modul Marketing"
      description="Request Design & Video yang diajukan tim Marketing lalu ditandai Selesai di Design Queue / Editing Queue. Dihitung terpisah dari desain konten & tugas mandiri; yang dibatalkan Marketing tidak ikut."
    >
      <p
        v-if="mktMuat"
        class="text-sm text-muted"
      >
        Memuat request dari modul Marketing…
      </p>
      <UAlert
        v-else-if="!mktOk"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Request dari modul Marketing tidak terbaca"
        :description="`${apiErrorMessage(mkt.error.value)}. Angka di kartu atas karena itu belum memuatnya.`"
        :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => mkt.refresh() }]"
      />
      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Desain dari Marketing"
            :value="angka(mktDesain)"
            sub="ikut dihitung di total desain selesai"
          />
          <AppStat
            label="Video dari Marketing"
            :value="angka(mktVideo)"
            sub="Editing Queue — tidak ikut total desain"
            tone="info"
          />
          <AppStat
            label="Total request selesai"
            :value="angka(mktBulan.length)"
            :sub="st.bulan ? `Pada ${pkNamaBulan(st.bulan)}` : 'Seluruh periode'"
            tone="success"
          />
          <AppStat
            label="Masih di antrian"
            :value="angka(mktAntri)"
            sub="request Marketing yang belum selesai (semua bulan)"
            tone="warning"
          />
        </AppStatGrid>
        <p
          v-if="!mktBulan.length"
          class="text-sm text-muted"
        >
          Belum ada request Marketing yang selesai pada periode ini.
        </p>
        <table
          v-else
          class="w-full text-sm"
        >
          <thead>
            <tr class="border-b border-default text-left text-xs text-muted">
              <th class="py-2 pe-3 font-semibold">
                Pemohon (Marketing)
              </th>
              <th class="px-3 py-2 text-right font-semibold">
                Desain
              </th>
              <th class="px-3 py-2 text-right font-semibold">
                Video
              </th>
              <th class="ps-3 py-2 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="p in perPemohon"
              :key="p.nama"
            >
              <td class="py-2 pe-3 font-semibold">
                {{ p.nama }}
              </td>
              <td class="num px-3 py-2 text-right">
                {{ p.d }}
              </td>
              <td class="num px-3 py-2 text-right">
                {{ p.v }}
              </td>
              <td class="num ps-3 py-2 text-right font-semibold">
                {{ p.d + p.v }}
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </AppPanel>

    <UAlert
      v-if="tanpaCap"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      :description="`${tanpaCap} pekerjaan tidak punya tanggal selesai. Jejak itu baru mulai dicatat 18 September 2026; yang ditandai selesai sebelum itu dihitung memakai tanggal deadline desainnya — bulan yang tertera bisa berbeda dari bulan ia benar-benar dikerjakan. Yang ditandai selesai mulai sekarang tidak lagi begitu.`"
      class="mb-5"
    />

    <!-- Virality: with vs without design -->
    <AppPanel
      title="Virality index — konten berdesain vs tanpa desain"
      description="(share + save) ÷ reach. Angka konten berdesain yang berdiri sendirian tidak menjawab apa pun — bagus atau biasa saja baru terbaca setelah ada pembandingnya."
    >
      <UAlert
        v-if="!banding.pakai.n && !banding.tanpa.n"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Belum ada angka performa pada periode ini"
        description="Jadi virality-nya belum bisa dihitung. Isi lewat halaman Input Performa."
      />
      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Pakai desain"
            :value="pct(vp)"
            :sub="`${banding.pakai.n} konten · reach ${angka(banding.pakai.dasar)}`"
            tone="vip"
          />
          <AppStat
            label="Tanpa desain"
            :value="pct(vt)"
            :sub="`${banding.tanpa.n} konten · reach ${angka(banding.tanpa.dasar)}`"
          />
          <AppStat
            label="Selisih"
            :value="selisih"
            :sub="vp == null || vt == null ? 'Salah satu sisi belum punya reach, jadi tidak ada yang bisa dibandingkan' : 'Selisih poin persen, bukan persen dari persen'"
            tone="info"
          />
          <AppStat
            label="Engagement rate berdesain"
            :value="pct(pkAggER(banding.pakai))"
            :sub="`Pembandingnya ${pct(pkAggER(banding.tanpa))} tanpa desain`"
            tone="success"
          />
        </AppStatGrid>
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Ini bukan sebab-akibat."
          description="Desain dipakai justru untuk konten yang sejak awal dianggap penting — promo, event, pengumuman — dan konten seperti itu memang lebih banyak dibagikan tanpa desain apa pun. Selisihnya menunjukkan ke mana harus melihat, bukan membuktikan desainnya yang menyebabkan."
        />
        <UAlert
          v-if="!banding.tanpa.n"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          description="Seluruh konten pada periode ini memakai desain, jadi tidak ada pembandingnya. Angka di sebelah kiri tetap benar; yang tidak ada cuma sisi kanannya."
          class="mt-3"
        />
      </template>
    </AppPanel>

    <!-- Per category -->
    <AppPanel
      title="Desain selesai per kategori"
      description="Kategori diambil dari kontennya sendiri: Content Pillar, jenis kontennya (Reel / Feed / Story), atau jenis cetaknya (A4 / X Banner / Voucher). Request Marketing tidak punya kategori itu, jadi ia tidak ikut di tabel ini — jumlahnya ada di kartu Request dari modul Marketing."
      flush
    >
      <div class="border-b border-default p-4">
        <AppSeg
          v-model="kat"
          :options="opsiKat"
          size="sm"
        />
      </div>
      <p
        v-if="!hasil.list.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada pekerjaan desain yang ditandai selesai pada periode ini.
      </p>
      <template v-else>
        <UTable
          :data="hasil.list"
          :columns="kolomKat"
        >
          <template #nama-cell="{ row }">
            <b>{{ row.original.nama }}</b>
            <span
              v-if="row.original.nama === PK_TANPA_KAT"
              class="block text-[11px] text-muted"
            >tugas desain mandiri &amp; konten yang jenisnya belum diisi — tidak ditebak</span>
          </template>
          <template #n-cell="{ row }">
            <b class="num">{{ row.original.n }}</b>
          </template>
          <template #konten-cell="{ row }">
            <span class="num">{{ row.original.konten }}</span>
          </template>
          <template #mandiri-cell="{ row }">
            <span class="num">{{ row.original.mandiri }}</span>
          </template>
        </UTable>
        <p class="border-t border-default px-4 py-3 text-xs text-muted">
          Total baris tabel ini <b>{{ totalBaris }}</b> untuk <b>{{ rows.length }}</b> pekerjaan desain.
          <template v-if="hasil.ganda">
            <b>Kolomnya tidak bisa dijumlahkan</b>: {{ hasil.ganda }} pekerjaan punya lebih dari satu {{ namaKat.toLowerCase() }}
            dan dihitung di tiap-tiapnya — dijepit ke yang pertama saja, sisanya lenyap dari daftar tanpa satu pun tanda.
          </template>
        </p>
      </template>
    </AppPanel>
  </div>
</template>
