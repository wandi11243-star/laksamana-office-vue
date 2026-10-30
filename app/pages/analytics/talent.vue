<!--
  Analytics › Performa Talent. Turnover inside each act's OWN performance
  hours (deploy/analytics/index.html:5313 vTalent). The schedule comes from
  the Event module (read-only); the turnover from the stored hariJam map.
  Post-midnight hours belong to the NEXT date — that is where the POS
  records them — so they are named on their row, never mixed into the
  same-date contribution.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { talKunci, talOmset, talSlot, type AgregatHariJam } from '~/utils/analytics-agregat'
import { getStateEvent } from '~/composables/useEvent'
import { BLN, HARI, angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('talent'))
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
const dowDari = (t: string) => new Date(`${t}T00:00:00`).getDay()

interface SlotTampil { tgl: string, nama: string, kategori: string, mulai: string, selesai: string, kunci: string[] }
const { data: eventState, status: eventStatus } = useAsyncData(
  'analytics-event-state',
  () => getStateEvent().then(r => r.data).catch(() => null),
)
const talErr = computed(() => eventStatus.value === 'error' || (eventStatus.value === 'success' && !eventState.value))
const jadwal = computed<SlotTampil[]>(() => {
  const st = eventState.value
  if (!st) return []
  const namaTalent: Record<string, string> = {}
  const katTalent: Record<string, string> = {}
  for (const t of st.talents ?? []) {
    namaTalent[t.id] = t.name
    katTalent[t.id] = t.category
  }
  return (st.schedules ?? [])
    .filter(s => String(s.date ?? '').startsWith(bulan.value))
    .map(s => ({
      tgl: String(s.date ?? ''),
      nama: namaTalent[s.talent_id] ?? '(talent terhapus)',
      kategori: String(s.type ?? '') || katTalent[s.talent_id] || '(tanpa kategori)',
      mulai: String(s.start_time ?? ''),
      selesai: String(s.end_time ?? ''),
      kunci: [] as string[],
    }))
})

interface BarisMalam {
  tgl: string
  hari: string
  n: string
  kel: string
  jam: string
  omset: number
  omsetLewat: number
  hariOmset: number
  pct: number | null
}
const olah = computed(() => {
  const lap = d.value
  if (!lap) return null
  const hj = lap.hariJam as Record<string, Record<string, AgregatHariJam>> | undefined
  if (!hj) return null
  const tanpaJam: SlotTampil[] = []
  const isi2: (SlotTampil & { kunci: string[] })[] = []
  for (const x of jadwal.value) {
    const sl = talSlot({ tgl: x.tgl, mulai: x.mulai, selesai: x.selesai })
    if (!sl) {
      tanpaJam.push(x)
      continue
    }
    isi2.push({ ...x, kunci: talKunci(sl) })
  }
  const malam: BarisMalam[] = isi2.map((x) => {
    const kSama = x.kunci.filter(k => k.slice(0, 10) === x.tgl)
    const kLewat = x.kunci.filter(k => k.slice(0, 10) !== x.tgl)
    const oSama = talOmset(hj, kSama)
    const oLewat = talOmset(hj, kLewat)
    const hariG = lap.hari?.[x.tgl]?.grand ?? 0
    return {
      tgl: x.tgl,
      hari: HARI[dowDari(x.tgl)] ?? '',
      n: x.nama,
      kel: x.kategori,
      jam: `${x.mulai || '?'}–${x.selesai || '?'}`,
      omset: oSama.omset + oLewat.omset,
      omsetLewat: oLewat.omset,
      hariOmset: hariG,
      // null = that date has no POS data at all. Told apart from 0%: zero
      // means nothing came in during the slot, a different answer.
      pct: hariG ? oSama.omset / hariG * 100 : null,
    }
  })
  // Per-hour: with performer vs without (only hour-days that truly have bills).
  const adaJam: Record<string, boolean> = {}
  isi2.forEach(x => x.kunci.forEach((k) => {
    adaJam[k] = true
  }))
  const perJam = Array.from({ length: 24 }, (_, j) => ({ j, adaG: 0, adaN: 0, takG: 0, takN: 0 }))
  for (const t of Object.keys(hj)) {
    for (const js of Object.keys(hj[t] ?? {})) {
      const j = +js
      const sel = hj[t]![js]!
      const p = perJam[j]!
      if (adaJam[`${t}|${j}`]) {
        p.adaG += sel.g ?? 0
        p.adaN++
      }
      else {
        p.takG += sel.g ?? 0
        p.takN++
      }
    }
  }
  let jamTalentKosong = 0
  for (const k of Object.keys(adaJam)) {
    const p = k.split('|')
    if (!(hj[p[0]!] ?? {})[+(p[1] ?? -1)]) jamTalentKosong++
  }
  // Per category: hours UNION inside one category.
  const kat: Record<string, { n: number, kunci: Record<string, boolean>, orang: Record<string, boolean> }> = {}
  isi2.forEach((x) => {
    const c = kat[x.kategori] || (kat[x.kategori] = { n: 0, kunci: {}, orang: {} })
    c.n++
    c.orang[x.nama] = true
    x.kunci.forEach((q) => {
      c.kunci[q] = true
    })
  })
  const totBulan = Object.values(lap.hari ?? {}).reduce((a, x) => a + (x.grand ?? 0), 0)
  const barisKat = Object.keys(kat).map((k) => {
    const kn = Object.keys(kat[k]!.kunci)
    const o = talOmset(hj, kn)
    return {
      n: k, tampil: kat[k]!.n, orang: Object.keys(kat[k]!.orang).length,
      jam: o.jamBerdata, omset: o.omset, perJam: o.jamBerdata ? o.omset / o.jamBerdata : null,
    }
  }).sort((a, x) => x.omset - a.omset)
  // DJ + MC DJ perform as a pair: UNION of their hours, never the sum.
  const knPas: Record<string, boolean> = {}
  for (const k of ['DJ', 'MC DJ']) for (const q of Object.keys(kat[k]?.kunci ?? {})) knPas[q] = true
  const adaPas = ['DJ', 'MC DJ'].some(k => kat[k])
  let pas: { n: string, tampil: number, orang: number, jam: number, omset: number, perJam: number | null, gabungan: boolean } | null = null
  if (adaPas) {
    const kn = Object.keys(knPas)
    const o = talOmset(hj, kn)
    const nTampil = ['DJ', 'MC DJ'].reduce((a, k) => a + (kat[k]?.n ?? 0), 0)
    const org: Record<string, boolean> = {}
    for (const k of ['DJ', 'MC DJ']) for (const x of Object.keys(kat[k]?.orang ?? {})) org[x] = true
    pas = { n: 'DJ + MC DJ', tampil: nTampil, orang: Object.keys(org).length, jam: o.jamBerdata, omset: o.omset, perJam: o.jamBerdata ? o.omset / o.jamBerdata : null, gabungan: true }
  }
  // Per performer.
  const org: Record<string, { kat: string, n: number, kunci: Record<string, boolean>, malam: Record<string, boolean> }> = {}
  isi2.forEach((x) => {
    const o = org[x.nama] || (org[x.nama] = { kat: x.kategori, n: 0, kunci: {}, malam: {} })
    o.n++
    o.malam[x.tgl] = true
    x.kunci.forEach((q) => {
      o.kunci[q] = true
    })
  })
  const barisOrg = Object.keys(org).map((nm) => {
    const kn = Object.keys(org[nm]!.kunci)
    const o = talOmset(hj, kn)
    // Average of the night's OWN portion, across its nights: one busy night
    // must not decide the whole figure.
    let porsi = 0
    let nP = 0
    for (const t of Object.keys(org[nm]!.malam)) {
      const hariG = lap.hari?.[t]?.grand ?? 0
      if (!hariG) continue
      const kt = kn.filter(k => k.split('|')[0] === t)
      porsi += talOmset(hj, kt).omset / hariG
      nP++
    }
    return {
      n: nm, kat: org[nm]!.kat, tampil: org[nm]!.n, malam: Object.keys(org[nm]!.malam).length,
      jam: o.jamBerdata, omset: o.omset, perJam: o.jamBerdata ? o.omset / o.jamBerdata : null,
      pctBulan: totBulan ? o.omset / totBulan * 100 : 0, pctMalam: nP ? porsi / nP * 100 : null,
    }
  }).sort((a, x) => (x.omset - a.omset) || (a.n < x.n ? -1 : 1))
  const totOmsetAda = perJam.reduce((a, p) => a + p.adaG, 0)
  return {
    malam, tanpaJam, jamTalentKosong, perJam, barisKat, pas, barisOrg, totBulan,
    totOmsetAda,
    malamAda: new Set(isi2.map(x => x.tgl)).size,
    nMalamData: Object.keys(hj).length,
  }
})

const cariMalam = ref('')
const malamTampil = computed(() => {
  const q = cariMalam.value.trim().toLowerCase()
  const list = olah.value?.malam ?? []
  const cocok = !q
    ? list
    : list.filter(x =>
        x.n.toLowerCase().includes(q) || x.kel.toLowerCase().includes(q) || x.hari.toLowerCase().includes(q),
      )
  return [...cocok].sort((a, x) => (a.tgl < x.tgl ? -1 : a.tgl > x.tgl ? 1 : a.n < x.n ? -1 : 1))
})
const cariOrg = ref('')
const orgTampil = computed(() => {
  const q = cariOrg.value.trim().toLowerCase()
  const list = olah.value?.barisOrg ?? []
  return (!q ? list : list.filter(x => x.n.toLowerCase().includes(q) || x.kat.toLowerCase().includes(q)))
    .sort((a, x) => (x.omset - a.omset) || (a.n < x.n ? -1 : 1))
})
const bukaOrg = ref('')
const malamOrg = computed(() => (olah.value?.malam ?? []).filter(x => x.n === bukaOrg.value)
  .sort((a, x) => (a.tgl < x.tgl ? -1 : 1)))

const kolomMalam: TableColumn<BarisMalam>[] = [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'n', header: 'Penampil' },
  { accessorKey: 'jam', header: 'Jam tampil' },
  { accessorKey: 'omset', header: 'Omset di jam tampil' },
  { accessorKey: 'pct', header: 'Kontribusi hari itu' },
]
</script>

<template>
  <AppPage
    title="Performa Talent"
    description="Kontribusi omset tiap penampil, dihitung dari jam tampilnya sendiri"
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
      title="Memuat talent"
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
      :description="`Hak akses kamu di halaman &quot;Performa Talent&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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
        class="rounded-panel border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada laporan yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Sales Recapitulation</i> dari POS.
        </p>
      </div>

      <UAlert
        v-else-if="talErr"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Jadwal talent tidak terbaca"
        description="Modul Event tidak menjawab, jadi halaman ini tidak tahu siapa tampil kapan. Omset per jamnya sendiri baik-baik saja — yang kurang jadwalnya."
      />
      <UAlert
        v-else-if="!d.hariJam"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Laporan ${fmtBln(bulan)} belum memuat omset per jam per tanggal`"
        description="Halaman ini membandingkan jam tampil tiap penampil dengan omset pada jam itu juga, dan itu butuh omset dipecah per tanggal DAN per jam — yang baru ikut disimpan sejak 11 September 2026. Unggah ulang berkas bulan itu; ringkasannya akan ditimpa dan sisanya tidak berubah."
      />
      <div
        v-else-if="!jadwal.length"
        class="rounded-panel border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada jadwal talent di {{ fmtBln(bulan) }}.
        </p>
        <p class="mt-1 text-sm text-muted">
          Jadwalnya disusun di modul <b>Event → Talent Schedule</b>. Begitu ada, halaman ini menghitung sendiri omset di jam tampilnya.
        </p>
      </div>

      <template v-else-if="olah">
        <AppStatGrid>
          <AppStat
            label="Malam Ada Penampil"
            :value="angka(olah.malamAda)"
            icon="i-lucide-music"
            tone="gold"
            :sub="`dari ${olah.nMalamData} hari yang ada datanya`"
          />
          <AppStat
            label="Jam Tampil"
            :value="angka(olah.perJam.reduce((a, p) => a + p.adaN, 0))"
            icon="i-lucide-clock"
            tone="info"
            sub="jam-hari yang ada penampilnya"
          />
          <AppStat
            label="Omset di Jam Tampil"
            :value="rupiah(olah.totOmsetAda)"
            icon="i-lucide-banknote"
            tone="success"
            :sub="`${olah.totBulan ? Math.round(olah.totOmsetAda / olah.totBulan * 100) : 0}% dari omset bulan ini`"
          />
          <AppStat
            label="Penampilan"
            :value="angka(olah.malam.length)"
            icon="i-lucide-calendar-days"
            tone="info"
            :sub="`${jadwal.length} jadwal bulan ini`"
          />
        </AppStatGrid>

        <UAlert
          v-if="olah.tanpaJam.length"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Sebagian penampilan tidak punya jam yang bisa dibaca"
          :description="`${olah.tanpaJam.length} penampilan tidak ikut dihitung sama sekali — menebak jamnya berarti menagihkan omset satu jam kepada penampil yang mungkin belum naik panggung. Betulkan jam mulai & selesainya di Event → Talent Schedule: ${olah.tanpaJam.slice(0, 6).map(x => `${x.nama} (${x.tgl})`).join(', ')}${olah.tanpaJam.length > 6 ? `, dan ${olah.tanpaJam.length - 6} lagi` : ''}.`"
        />
        <UAlert
          v-if="olah.jamTalentKosong"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="`${olah.jamTalentKosong} jam tampil tidak punya satu pun bill`"
          description="Entah karena jamnya di luar bulan ini, atau karena memang tidak ada transaksi di jam itu. Jam seperti itu tidak dihitung di kedua sisi."
        />

        <AppPanel
          title="Per Malam"
          description="Satu baris = satu penampilan. Kontribusi hari itu = omset yang masuk selama jam tampilnya, dibagi omset seluruh hari itu — jadi jamnya tetap yang menghitung, tapi yang dibaca tanggalnya."
          flush
        >
          <div class="px-4 pt-4">
            <UInput
              v-model="cariMalam"
              placeholder="Cari nama band, kategori, atau hari…"
              icon="i-lucide-search"
              size="sm"
            />
          </div>
          <UTable
            class="hidden lg:block"
            :data="malamTampil"
            :columns="kolomMalam"
          >
            <template #tgl-cell="{ row }">
              <b class="num">{{ tglPanjang(row.original.tgl) }}</b>
            </template>
            <template #n-cell="{ row }">
              <b>{{ row.original.n }}</b>
              <span class="block text-xs text-muted">{{ row.original.kel }} · {{ row.original.hari }}</span>
            </template>
            <template #jam-cell="{ row }">
              <span class="num">{{ row.original.jam }}</span>
            </template>
            <template #omset-cell="{ row }">
              <template v-if="!row.original.hariOmset">
                <span class="text-xs text-muted">belum ada data POS</span>
              </template>
              <template v-else>
                <span class="num">{{ rupiah(row.original.omset) }}</span>
                <span
                  v-if="row.original.omsetLewat"
                  class="block text-xs font-semibold text-muted"
                >{{ rupiah(row.original.omsetLewat) }} sesudah tengah malam</span>
              </template>
            </template>
            <template #pct-cell="{ row }">
              <template v-if="row.original.pct === null">
                <span class="text-xs text-muted">belum ada data POS</span>
              </template>
              <template v-else>
                <b class="num">{{ row.original.pct.toFixed(1) }}%</b>
                <span class="block text-xs text-muted">dari {{ rupiah(row.original.hariOmset) }} hari itu</span>
              </template>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in malamTampil"
              :key="`${x.tgl}-${x.n}`"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.n }}</b>
                <b
                  v-if="x.pct !== null"
                  class="num text-sm"
                >{{ x.pct.toFixed(1) }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ tglPanjang(x.tgl) }} · {{ x.jam }} · {{ rupiah(x.omset) }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            <b>Kolom Kontribusi tidak bisa dijumlahkan.</b> Dua penampil di malam yang sama bisa menempati jam yang beririsan, dan omset jam itu terhitung di kedua barisnya. Omset yang masuk <b>sesudah tengah malam</b> ikut di kolom Omset, tapi TIDAK ikut di kolom Kontribusi.
          </p>
        </AppPanel>

        <AppPanel
          title="Pembanding: Jam Tampil vs Jam Yang Sama Tanpa Penampil"
          description="Apakah omset naik karena ADA penampilnya, atau karena jamnya yang memang ramai? Yang dibandingkan jam yang sama, bukan rata-rata seluruh jam."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="olah.perJam.filter(p => p.adaN > 0)"
            :columns="[{ accessorKey: 'j', header: 'Jam' }, { accessorKey: 'adaN', header: 'Jam-hari ada penampil' }, { accessorKey: 'rA', header: 'Rp / jam saat ada' }, { accessorKey: 'takN', header: 'Jam-hari tanpa penampil' }, { accessorKey: 'rT', header: 'Rp / jam saat tanpa' }, { accessorKey: 'sel', header: 'Selisih' }]"
          >
            <template #j-cell="{ row }">
              <b class="num">{{ String(row.original.j).padStart(2, '0') }}:00</b>
            </template>
            <template #adaN-cell="{ row }">
              <span class="num">{{ angka(row.original.adaN) }}</span>
            </template>
            <template #rA-cell="{ row }">
              <span class="num">{{ row.original.adaN ? rupiah(row.original.adaG / row.original.adaN) : '—' }}</span>
            </template>
            <template #takN-cell="{ row }">
              <span class="num">{{ angka(row.original.takN) }}</span>
            </template>
            <template #rT-cell="{ row }">
              <span class="num">{{ row.original.takN ? rupiah(row.original.takG / row.original.takN) : '—' }}</span>
            </template>
            <template #sel-cell="{ row }">
              <template v-if="row.original.adaN && row.original.takN && row.original.takG > 0">
                <b
                  class="num"
                  :class="(row.original.adaG / row.original.adaN - row.original.takG / row.original.takN) >= 0 ? 'text-success' : 'text-error'"
                >{{ rupiah(row.original.adaG / row.original.adaN - row.original.takG / row.original.takN) }}</b>
              </template>
              <span
                v-else
                class="text-xs text-muted"
              >tidak ada pembandingnya</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="p in olah.perJam.filter(q => q.adaN > 0)"
              :key="p.j"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="num text-sm">{{ String(p.j).padStart(2, '0') }}:00</b>
                <span
                  v-if="p.adaN && p.takN && p.takG > 0"
                  class="num text-sm"
                >{{ rupiah(p.adaG / p.adaN - p.takG / p.takN) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ p.adaN }} jam-hari ada ({{ rupiah(p.adaG / p.adaN) }}/jam) · {{ p.takN }} tanpa ({{ p.takN ? rupiah(p.takG / p.takN) : '—' }}/jam)
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            Yang dihitung hanya <b>jam-hari yang benar-benar punya bill</b>, di kedua sisi. Selisih hanya digambar kalau kedua sisinya ada.
          </p>
        </AppPanel>

        <AppPanel
          title="Per Kategori Penampil"
          description="Jam di dalam satu kategori digabung, bukan dijumlahkan. Rp / jam yang paling adil dibandingkan: slot band tiga jam dan slot DJ satu setengah jam tidak bisa diadu lewat totalnya."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="olah.pas && olah.barisKat.length > 1 ? [...olah.barisKat, olah.pas] : olah.barisKat"
            :columns="[{ accessorKey: 'n', header: 'Kategori' }, { accessorKey: 'tampil', header: 'Penampilan' }, { accessorKey: 'orang', header: 'Orang' }, { accessorKey: 'jam', header: 'Jam' }, { accessorKey: 'omset', header: 'Omset di jamnya' }, { accessorKey: 'perJam', header: 'Rp / jam' }]"
          >
            <template #n-cell="{ row }">
              <b>{{ row.original.n }}</b>
              <span
                v-if="(row.original as { gabungan?: boolean }).gabungan"
                class="block text-xs text-muted"
              >gabungan — jangan dijumlahkan dengan dua baris di atasnya</span>
            </template>
            <template #tampil-cell="{ row }">
              <span class="num">{{ angka(row.original.tampil) }}</span>
            </template>
            <template #orang-cell="{ row }">
              <span class="num">{{ angka(row.original.orang) }}</span>
            </template>
            <template #jam-cell="{ row }">
              <span class="num">{{ angka(row.original.jam) }}</span>
            </template>
            <template #omset-cell="{ row }">
              <span class="num">{{ rupiah(row.original.omset) }}</span>
            </template>
            <template #perJam-cell="{ row }">
              <span class="num">{{ row.original.perJam === null ? '—' : rupiah(row.original.perJam) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in (olah.pas && olah.barisKat.length > 1 ? [...olah.barisKat, olah.pas] : olah.barisKat)"
              :key="x.n"
              class="px-4 py-2.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <b class="text-sm">{{ x.n }}</b>
                <span class="num text-sm font-medium">{{ rupiah(x.omset) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.tampil) }} penampilan · {{ angka(x.orang) }} orang · {{ x.perJam === null ? '—' : `${rupiah(x.perJam)}/jam` }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            <b>Kolomnya tidak bisa dijumlahkan.</b> Omset satu jam terhitung di tiap kategori yang menempatinya. Penyebut kolom persen adalah <b>omset seluruh bulan</b> ({{ rupiah(olah.totBulan) }}).
          </p>
        </AppPanel>

        <AppPanel
          title="Per Penampil"
          description="Tiap penampil dihitung dari jam tampilnya sendiri. % malam itu adalah rata-rata porsi omset yang jatuh di jamnya pada malam-malam ia tampil — dirata-rata antar malam, bukan dijumlahkan lalu dibagi."
          flush
        >
          <div class="px-4 pt-4">
            <UInput
              v-model="cariOrg"
              placeholder="Cari penampil…"
              icon="i-lucide-search"
              size="sm"
            />
          </div>
          <UTable
            class="hidden lg:block"
            :data="orgTampil"
            :columns="[{ accessorKey: 'n', header: 'Penampil' }, { accessorKey: 'tampil', header: 'Tampil' }, { accessorKey: 'jam', header: 'Jam' }, { accessorKey: 'omset', header: 'Omset di jamnya' }, { accessorKey: 'pctMalam', header: '% malam itu' }]"
          >
            <template #n-cell="{ row }">
              <button
                type="button"
                class="text-left"
                @click="bukaOrg = bukaOrg === row.original.n ? '' : row.original.n"
              >
                <b>{{ row.original.n }}</b>
                <span class="block text-xs text-muted">{{ row.original.kat }} · {{ angka(row.original.malam) }} malam</span>
              </button>
            </template>
            <template #tampil-cell="{ row }">
              <span class="num">{{ angka(row.original.tampil) }}</span>
            </template>
            <template #jam-cell="{ row }">
              <span class="num">{{ angka(row.original.jam) }}</span>
            </template>
            <template #omset-cell="{ row }">
              <span class="num">{{ rupiah(row.original.omset) }}</span>
            </template>
            <template #pctMalam-cell="{ row }">
              <b
                v-if="row.original.pctMalam !== null"
                class="num"
              >{{ row.original.pctMalam.toFixed(1) }}%</b>
              <span
                v-else
                class="text-xs text-muted"
              >—</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="x in orgTampil"
              :key="x.n"
              class="px-4 py-2.5"
            >
              <button
                type="button"
                class="flex w-full items-baseline justify-between gap-2 text-left"
                @click="bukaOrg = bukaOrg === x.n ? '' : x.n"
              >
                <b class="text-sm">{{ x.n }}</b>
                <span class="num text-sm font-medium">{{ rupiah(x.omset) }}</span>
              </button>
              <div class="mt-0.5 text-xs text-muted">
                {{ x.kat }} · {{ angka(x.tampil) }} tampil · {{ x.pctMalam !== null ? `${x.pctMalam.toFixed(1)}% malam itu` : '' }}
              </div>
              <div
                v-if="bukaOrg === x.n"
                class="mt-2 space-y-1 rounded-panel bg-muted p-2"
              >
                <div
                  v-for="m in malamOrg"
                  :key="m.tgl"
                  class="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span>{{ tglPanjang(m.tgl) }}</span>
                  <span class="num text-muted">{{ rupiah(m.omset) }}{{ m.pct !== null ? ` · ${m.pct.toFixed(1)}%` : '' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="bukaOrg"
            class="mx-4 mb-4 hidden rounded-panel bg-muted p-3 lg:block"
          >
            <p class="mb-2 text-xs font-semibold">
              Malam demi malam — {{ bukaOrg }}
            </p>
            <div class="space-y-1">
              <div
                v-for="m in malamOrg"
                :key="m.tgl"
                class="flex items-baseline justify-between gap-2 text-xs"
              >
                <span>{{ tglPanjang(m.tgl) }} · {{ m.jam }}</span>
                <span class="num text-muted">{{ rupiah(m.omset) }}{{ m.pct !== null ? ` · ${m.pct.toFixed(1)}% hari itu` : '' }}</span>
              </div>
            </div>
          </div>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
