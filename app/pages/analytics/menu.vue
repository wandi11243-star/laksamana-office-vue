<!--
  Analytics › Menu & Bahan Baku (deploy/analytics/index.html:3443 vMenu).
  Section order as the old page: month comparison, four stat cards, size and
  package-code notes, the unpaired-code table, Penjualan Menu (sortable,
  paged 20/50/100, a row opens that menu's ingredients), Perkiraan Bahan Baku
  Keluar (raw / prep), Menu yang belum ada di HPP (+ copy / CSV). The merging
  engine lives in ~/utils/analytics-menu (menuNormal port).
-->
<script setup lang="ts">
import { useAnalyticsHarian } from '~/composables/useAnalyticsEsb'
import type { ResepHpp } from '~/utils/pohon-resep'
import { saveAnalytics, useAnalyticsState } from '~/composables/useAnalytics'
import { getHppRecipes } from '~/composables/useStock'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import {
  bahanSatuMenu, hppNamaMenu, kodeCatatan, menuNormal, mnBulat, petaKode, resepPeta,
  saranKode, ukuranPaket, uraiBaru, uraiResep, type GabMenu, type LaporanMenu,
} from '~/utils/analytics-menu'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const toast = useToast()
const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('menu'))
const bolehPasang = computed(() => izin.ubah('pengaturan'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
// First-load skeleton for the stat cards: while the payload is absent the
// grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !isi.value && (status.value === 'pending' || status.value === 'idle'))
const versi = computed(() => versiDari(balasan.value))
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
const ketLaporan = computed(() => d.value
  ? `${d.value.jenis === 'menu' ? 'Menu Report' : 'Bill Report'} · diunggah ${d.value.diunggah}${d.value.oleh ? ` oleh ${d.value.oleh}` : ''}`
  : '')

// ---- HPP recipes (Stock › HPP & Resep). Read once; a failure says WHY. ----
const { data: hpp, status: hppStatus, error: hppError } = useAsyncData('analytics-hpp-resep', () => getHppRecipes().then(r => r.rows))
const resep = computed<ResepHpp[] | null>(() => (hppStatus.value === 'success' ? hpp.value ?? [] : null))
const hppErr = computed(() => (hppError.value ? apiErrorMessage(hppError.value) : ''))
const peta = computed(() => (resep.value ? resepPeta(resep.value) : null))

const setting = computed(() => isi.value?.data.setting ?? {})
const pk = computed(() => petaKode(setting.value.petaKode, resep.value))
const catKode = computed(() => kodeCatatan(setting.value.petaKode, resep.value))

// ---- month comparison (shared with Kategori: one control) ----
const blnBanding = useState<string>('analytics-banding', () => '')
// daily mode has no comparison (blnBandingAktif, :2752)
const bandingAktif = computed(() => (!harian.hari.value && blnBanding.value && blnBanding.value !== bulan.value && laporan.value[blnBanding.value] ? blnBanding.value : ''))
const opsiBanding = computed(() => daftarBulan.value.filter(b => b !== bulan.value))

interface BarisMenu { n: string, qty: number, nilai: number, kel: string, bqty: number, bnilai: number, dnilai: number, ada: boolean }
const NM = computed(() => (d.value && Object.keys(d.value.menu ?? {}).length ? menuNormal(d.value as LaporanMenu, pk.value) : null))
const dB = computed(() => (bandingAktif.value ? laporan.value[bandingAktif.value] ?? null : null))
const bPunyaMenu = computed(() => !!(dB.value && Object.keys(dB.value.menu ?? {}).length))
const NB = computed(() => (bPunyaMenu.value ? menuNormal(dB.value as LaporanMenu, pk.value) : null))

/** gabungBanding: rows of BOTH months — a menu that vanished this month is the question. */
const semua = computed<BarisMenu[]>(() => {
  if (!NM.value) return []
  const peta: Record<string, BarisMenu> = {}
  const out: BarisMenu[] = Object.entries(NM.value.gab).map(([n, g]) => (peta[n] = { n, qty: g.qty, nilai: g.nilai, kel: g.kel, bqty: 0, bnilai: 0, dnilai: 0, ada: true }))
  const gb: Record<string, GabMenu> = NB.value?.gab ?? {}
  for (const [n, g] of Object.entries(gb)) {
    let r = peta[n]
    if (!r) {
      r = peta[n] = { n, qty: 0, nilai: 0, kel: g.kel, bqty: 0, bnilai: 0, dnilai: 0, ada: false }
      out.push(r)
    }
    r.bqty += g.qty
    r.bnilai += g.nilai
    if (!r.kel && g.kel) r.kel = g.kel
  }
  for (const r of out) r.dnilai = r.nilai - r.bnilai
  return out
})

// ---- group filter (FOOD / BEVERAGES), computed from the data ----
const tapisKel = ref('')
const kelOps = computed(() => {
  const t: Record<string, number> = {}
  for (const x of semua.value) if (x.kel) t[x.kel] = (t[x.kel] ?? 0) + x.nilai
  return Object.keys(t).sort((a, b) => t[b]! - t[a]!)
})
watch(kelOps, (ops) => {
  if (tapisKel.value && !ops.includes(tapisKel.value)) tapisKel.value = ''
})
const baris = computed(() => (tapisKel.value ? semua.value.filter(x => x.kel === tapisKel.value) : semua.value))
/** This month only: cards, % divisor and ingredients never move with the comparison. */
const urut = computed(() => baris.value.filter(x => x.ada))
const nTanpaKel = computed(() => semua.value.filter(x => !x.kel).length)
const totQty = computed(() => urut.value.reduce((a, x) => a + x.qty, 0))
const totNilai = computed(() => urut.value.reduce((a, x) => a + x.nilai, 0))
const kenal = (n: string) => !!peta.value?.[String(n).trim().toLowerCase()]
const tanpaResep = computed(() => (peta.value ? urut.value.filter(x => !kenal(x.n)) : []))
// the old page rounds to whole percent (pct, :1638)
const pct = (a: number, b: number) => (b ? Math.round(a / b * 100) : 0)

// ---- table: sort, search, paging, open row ----
type Kolom = 'n' | 'qty' | 'nilai' | 'bqty' | 'bnilai' | 'dnilai'
const sort = ref<{ k: Kolom, turun: boolean }>({ k: 'nilai', turun: true })
const cari = ref('')
const perHal = ref(20)
const hal = ref(1)
const buka = ref('')
function sortKlik(k: Kolom) {
  if (sort.value.k === k) sort.value = { k, turun: !sort.value.turun }
  else sort.value = { k, turun: k !== 'n' } // numbers start from the largest
  hal.value = 1
}
watch([bulan, tapisKel, cari, perHal, bandingAktif], () => {
  hal.value = 1
})
watch([bulan, tapisKel], () => {
  buka.value = ''
})
/** urutKolom: empties always last, ties split by name (rows never jump between renders). */
const cocok = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const { k, turun } = sort.value
  const t = turun ? -1 : 1
  const nm = (a: BarisMenu, b: BarisMenu) => a.n.localeCompare(b.n, 'id')
  return baris.value.filter(x => !q || x.n.toLowerCase().includes(q)).sort((a, b) => {
    if (k === 'n') return t * nm(a, b)
    return (t * ((a[k] as number) - (b[k] as number))) || nm(a, b)
  })
})
const nHal = computed(() => Math.max(1, Math.ceil(cocok.value.length / perHal.value)))
const halAman = computed(() => Math.min(Math.max(1, hal.value), nHal.value))
const mulai = computed(() => (halAman.value - 1) * perHal.value)
const tampil = computed(() => cocok.value.slice(mulai.value, mulai.value + perHal.value))
const nomorHal = computed(() => {
  const dari = Math.max(1, Math.min(halAman.value - 2, nHal.value - 4))
  const out: number[] = []
  for (let i = dari; i <= Math.min(nHal.value, dari + 4); i++) out.push(i)
  return out
})
/** The bar follows the sorted column when it is qty or value. */
const kolBar = computed<'qty' | 'nilai'>(() => (sort.value.k === 'qty' ? 'qty' : 'nilai'))
const punBar = computed(() => baris.value.reduce((a, x) => Math.max(a, x[kolBar.value] || 0), 0) || 1)
const NAMA_KOL: Record<Kolom, string> = { n: 'nama menu', qty: 'jumlah porsi', nilai: 'nilai', bqty: 'porsi bulan pembanding', bnilai: 'nilai bulan pembanding', dnilai: 'selisih nilai' }
const nLuar = computed(() => (bandingAktif.value ? baris.value.filter(x => !x.ada).length : 0))
const rincian = computed(() => {
  const x = baris.value.find(r => r.n === buka.value)
  return x && peta.value && kenal(x.n) ? { x, r: bahanSatuMenu(x.n, x.qty, peta.value) } : x ? { x, r: null } : null
})
const urutObj = (o: Record<string, number>) => Object.keys(o).sort((a, b) => o[b]! - o[a]!)

// ---- ingredients ----
const jenisBahan = ref<'mentah' | 'prep'>('mentah')
const cariBahan = ref('')
const bahan = computed(() => {
  if (!peta.value) return null
  const U = uraiBaru()
  for (const x of urut.value) if (kenal(x.n)) uraiResep(x.n, x.qty, peta.value, U)
  const sik = Object.keys(U.putar).filter(k => U.putar[k] === 'siklus')
  const dlm = Object.keys(U.putar).filter(k => U.putar[k] === 'dalam')
  return { ...U, sik, dlm }
})
const daftarBahan = computed(() => {
  if (!bahan.value) return { semua: [] as string[], tampil: [] as string[], isi: {} as Record<string, number> }
  const o = jenisBahan.value === 'prep' ? bahan.value.prep : bahan.value.keluar
  const semuaB = urutObj(o)
  const q = cariBahan.value.trim().toLowerCase()
  return { semua: semuaB, tampil: semuaB.filter(k => !q || k.toLowerCase().includes(q)), isi: o }
})

// ---- menus without a recipe ----
const cariResep = ref('')
const tanpaResepTampil = computed(() => {
  const q = cariResep.value.trim().toLowerCase()
  return tanpaResep.value.filter(x => !q || x.n.toLowerCase().includes(q))
})
const nilaiTanpa = computed(() => tanpaResep.value.reduce((a, x) => a + x.nilai, 0))
/** The copy box always holds the FULL list, never the search result. */
const teksSalin = computed(() => tanpaResep.value.map(x => `${x.n}\t${x.qty}\t${Math.round(x.nilai)}`).join('\n'))
const ketSalin = ref('')
async function salin() {
  try {
    await navigator.clipboard.writeText(teksSalin.value)
    ketSalin.value = 'Tersalin.'
  }
  catch {
    ketSalin.value = 'Tidak bisa menyalin — blok teksnya lalu Ctrl+C.'
  }
}
function unduhCsv() {
  const rows = ['Nama Menu POS,Qty,Nilai', ...tanpaResep.value.map(x => `"${x.n.replace(/"/g, '""')}",${x.qty},${Math.round(x.nilai)}`)]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  a.download = `menu_belum_ada_resep_${bulan.value}.csv`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 800)
}

// ---- unpaired package codes + pairing ----
const takKenal = computed(() => {
  const t = NM.value?.takKenal ?? {}
  return Object.keys(t).sort((a, b) => t[b]!.qty - t[a]!.qty).map((k) => {
    const x = t[k]!
    const uk = ukuranPaket(x.dari)
    return { k, ...x, uk, s: saranKode(k, Object.keys(NM.value!.gab), peta.value ? hppNamaMenu(peta.value) : [], uk) }
  })
})
const totTakKenal = computed(() => takKenal.value.reduce((a, x) => a + x.qty, 0))
const memasang = ref('')
async function pasang(kode: string, menu: string) {
  if (!bolehPasang.value || !isi.value) return
  const v = versi.value
  if (v === undefined) return
  memasang.value = kode
  try {
    const lama = (setting.value.petaKode ?? {}) as Record<string, string>
    await saveAnalytics({ ...isi.value.data, setting: { ...setting.value, petaKode: { ...lama, [kode.toUpperCase()]: menu } } }, v)
    await refresh()
    toast.add({ title: `Dipasangkan: ${kode} → ${menu}`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    memasang.value = ''
  }
}
</script>

<template>
  <AppPage
    title="Menu & Bahan Baku"
    description="Menu terlaris dan perkiraan bahan yang seharusnya keluar"
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
      title="Memuat menu"
    >
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <UAlert
      v-else-if="error || !isi"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Tidak bisa membaca data analytics"
      :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
    />

    <UAlert
      v-else-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      :description="`Hak akses kamu di halaman Menu & Bahan Baku cuma ${roleSaya}. Minta admin modul mengubahnya di Kelola Akses.`"
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
        class="rounded-panel border border-default bg-elevated p-8 text-center"
      >
        <p class="font-semibold">
          Belum ada laporan yang diunggah.
        </p>
        <p class="mt-1 text-sm text-muted">
          Buka <b>Unggah Laporan</b> lalu pilih berkas <i>Sales Recapitulation</i> dari POS.
        </p>
      </div>

      <template v-else-if="!NM">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Laporan bulan ini tidak memuat nama menu"
          description="Yang diunggah adalah Bill Report — satu baris per bill, berisi nilai dan jamnya, tapi tidak berisi apa saja yang dipesan."
        />
        <AppPanel
          title="Yang perlu diunggah"
          description="Di layar ekspor POS yang sama, ganti Sales Report Type dari Bill Report ke jenis laporan yang merinci menu — biasanya bernama Menu Report, Item Sales, atau Product Sales. Berkasnya diunggah di halaman Unggah Laporan seperti biasa; halaman ini mengenali sendiri bentuknya dari nama kolomnya."
        >
          <UAlert
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            title="Begitu laporan menu masuk"
            description="Halaman ini menghitung menu terlaris, bahan mentah dan bahan prep yang seharusnya keluar — dikalikan dari resep di modul HPP, jadi bisa dibandingkan dengan stok fisik di lapangan."
          />
        </AppPanel>
      </template>

      <template v-else>
        <!-- pilihBanding -->
        <div
          v-if="opsiBanding.length && !harian.hari.value"
          class="mb-4 flex flex-wrap items-center gap-2.5 rounded-panel border border-default bg-default px-4 py-3"
        >
          <b class="text-sm">Bandingkan dengan</b>
          <USelect
            v-model="blnBanding"
            :items="[{ value: '', label: '— tidak dibandingkan —' }, ...opsiBanding.map(b => ({ value: b, label: fmtBln(b) }))]"
            value-key="value"
            size="sm"
            class="min-w-48"
          />
          <span class="text-xs text-muted">Tiap baris menu dapat kolom porsi & nilai bulan pembanding, berikut selisihnya.</span>
        </div>
        <UAlert
          v-if="bandingAktif && !bPunyaMenu"
          class="mb-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${fmtBln(bandingAktif)} tidak bisa dibandingkan di halaman ini.`"
          :description="`Laporan bulan itu Bill Report — satu baris per bill, tanpa satu pun nama menu. Yang memuat nama menu Sales Recapitulation Detail Report; unggah berkas itu untuk ${fmtBln(bandingAktif)}, lalu pembandingnya jalan sendiri.`"
        />

        <AppStatGrid :loading="statMemuat" :count="4">
          <AppStat
            label="Menu Berbeda"
            :value="angka(urut.length)"
            icon="i-lucide-list"
            tone="gold"
            :sub="`yang pernah terjual bulan ini${tapisKel ? ` · ${tapisKel}` : ''}`"
          />
          <AppStat
            label="Porsi Terjual"
            :value="angka(totQty)"
            icon="i-lucide-utensils"
            tone="info"
            :sub="`jumlah seluruh qty${tapisKel ? ` · ${tapisKel}` : ''}`"
          />
          <AppStat
            label="Nilai Menu"
            :value="rupiah(totNilai)"
            icon="i-lucide-banknote"
            tone="success"
            :sub="`sebelum service & pajak${tapisKel ? ` · ${tapisKel}` : ''}`"
          />
          <AppStat
            label="Belum Ada Resep"
            :value="peta ? angka(tanpaResep.length) : '—'"
            icon="i-lucide-book-open"
            tone="info"
            :sub="peta ? `dari ${urut.length} menu` : (hppStatus === 'pending' ? 'memuat resep HPP…' : 'HPP tidak terbaca')"
          />
        </AppStatGrid>

        <!-- ukCatatanHtml -->
        <UAlert
          v-if="NM.ukLama.qty > 0"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Laporan bulan ini diunggah sebelum ukuran bisa dipisahkan."
          :description="`${angka(NM.ukLama.qty)} porsi baris LARGE/REGULAR (PACKAGE) tidak ikut dihitung di halaman ini. Baris itu mengulang qty minuman tepat di atasnya, jadi menjumlahkannya menghitung minuman yang sama dua kali — dan memisahkannya butuh URUTAN BARIS yang sudah tidak ada di ringkasan tersimpan. Unggah ulang berkas bulan itu supaya porsi large berdiri sebagai barisnya sendiri.`"
        />
        <UAlert
          v-if="NM.ukTotal.minus > 0"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${angka(NM.ukTotal.minus)} porsi berukuran tidak bisa dipisahkan dari menu induknya`"
          description="Induknya tidak punya cukup porsi untuk dikurangi. Porsinya dibiarkan di baris induknya; memaksanya membuat baris induk minus, angka yang tidak akan pernah bisa dijelaskan."
        />
        <!-- kodeCatatanHtml -->
        <UAlert
          v-if="Object.keys(catKode.dobel).length"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${Object.keys(catKode.dobel).length} kode dipakai lebih dari satu resep`"
        >
          <template #description>
            Di HPP, jadi porsinya <b>tidak dipasangkan ke mana pun</b> — memilih salah satunya berarti menebak resep mana yang dapat porsinya.
            Porsinya tetap dihitung, berdiri sebagai barisnya sendiri. Betulkan di <b>HPP &amp; Resep → Daftar Resep</b>:
            <span
              v-for="(nm, k) in catKode.dobel"
              :key="k"
              class="block"
            ><b class="font-mono">{{ k }}</b> → {{ nm.join(' · ') }}</span>
          </template>
        </UAlert>
        <UAlert
          v-if="catKode.bentrok.length"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${catKode.bentrok.length} kode punya dua pasangan yang berbeda.`"
        >
          <template #description>
            Yang dipakai <b>yang dari HPP</b>; pasangan di Pengaturan modul ini tidak berlaku lagi untuk kode itu dan sebaiknya dihapus:
            <span
              v-for="x in catKode.bentrok"
              :key="x.kode"
              class="block"
            ><b class="font-mono">{{ x.kode }}</b> → HPP: <b>{{ x.hpp }}</b> · Pengaturan: {{ x.manual }}</span>
          </template>
        </UAlert>

        <!-- mnPaketHtml -->
        <AppPanel
          v-if="takKenal.length"
          title="Kode paket yang belum dipasangkan"
          description="Baris paket yang namanya cuma menyebut ukuran (LARGE (PACKAGE), REGULAR (PACKAGE)) tidak memberi tahu minumannya. Yang memberi tahu kode-nya, dan pasangan kode → menu diisi sekali di Pengaturan; sesudah itu berlaku untuk seluruh bulan yang pernah diunggah. Yang ditawarkan diambil dari menu di laporan ini dan dari HPP & Resep → Daftar Resep, dan dijepit ke ukuran barisnya: kode LARGE hanya ditawari resep yang namanya memuat kata LARGE, supaya porsinya tidak melebur ke menu regular dan bahan bakunya tidak terhitung dengan takaran yang salah."
          flush
        >
          <div class="space-y-3 px-4 pt-4">
            <UAlert
              color="info"
              variant="subtle"
              icon="i-lucide-info"
              title="Cara yang lebih tahan lama: isi Kode menu di POS di resepnya sendiri"
              description="HPP & Resep → Daftar Resep, kotaknya ada di tiap resep Menu Jadi. Begitu kodenya cocok, porsinya masuk sendiri ke menu itu di seluruh bulan tanpa perlu dipasangkan di sini, dan resep ukuran large cukup memegang kode large-nya. Pasangan yang diisi di Pengaturan modul ini tetap berlaku sebagai cadangan untuk kode yang belum diisi di HPP."
            />
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :description="`${takKenal.length} kode senilai ${angka(totTakKenal)} porsi belum punya pasangan. Porsinya tetap dihitung (berdiri sendiri dengan nama berkodenya), tapi belum masuk ke menu aslinya dan bahan bakunya belum ikut terhitung.`"
            />
          </div>
          <div class="overflow-x-auto">
            <table class="mt-3 w-full text-sm">
              <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
                <tr>
                  <th class="px-4 py-2">
                    Kode
                  </th>
                  <th class="px-4 py-2">
                    Muncul sebagai
                  </th>
                  <th class="px-4 py-2 text-end">
                    Porsi
                  </th>
                  <th class="px-4 py-2">
                    Kemungkinan menunya
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="x in takKenal"
                  :key="x.k"
                >
                  <td class="px-4 py-2 align-top">
                    <b class="font-mono">{{ x.k }}</b>
                  </td>
                  <td class="px-4 py-2 align-top text-xs text-muted">
                    {{ x.dari }}<span
                      v-if="x.induk"
                      class="block"
                    >di <b>{{ x.induk }}</b></span>
                  </td>
                  <td class="px-4 py-2 text-end align-top num">
                    {{ angka(x.qty) }}
                  </td>
                  <td class="px-4 py-2">
                    <div
                      v-if="x.s.utama.length"
                      class="flex flex-wrap gap-1"
                    >
                      <UButton
                        v-for="nm in x.s.utama"
                        :key="nm"
                        :label="nm"
                        size="xs"
                        color="neutral"
                        variant="outline"
                        :disabled="!bolehPasang"
                        :loading="memasang === x.k"
                        @click="pasang(x.k, nm)"
                      />
                    </div>
                    <template v-else-if="x.uk && x.uk !== 'REGULAR'">
                      <p class="text-xs text-muted">
                        <template v-if="!peta">
                          Daftar resep HPP tidak terbaca, jadi menu ukuran <b>{{ x.uk }}</b> tidak bisa ditawarkan di sini. {{ hppErr }}
                        </template>
                        <template v-else>
                          Belum ada resep yang namanya memuat kata <b>{{ x.uk }}</b> dan cocok dengan kode ini. Buat resepnya di <b>HPP &amp; Resep → Daftar Resep</b>
                          (mis. <i>{{ x.uk }} {{ x.s.cadangan[0] || 'NAMA MENU' }}</i>) — tombolnya muncul sendiri di sini begitu resepnya ada.
                        </template>
                      </p>
                      <div
                        v-if="x.s.cadangan.length"
                        class="mt-2"
                      >
                        <p class="text-xs text-muted">
                          Atau gabungkan ke menu regular — porsinya melebur jadi satu baris dan bahan bakunya terhitung sebagai <b>regular</b>:
                        </p>
                        <div class="mt-1 flex flex-wrap gap-1">
                          <UButton
                            v-for="nm in x.s.cadangan"
                            :key="nm"
                            :label="nm"
                            size="xs"
                            color="neutral"
                            variant="outline"
                            :disabled="!bolehPasang"
                            :loading="memasang === x.k"
                            @click="pasang(x.k, nm)"
                          />
                        </div>
                      </div>
                    </template>
                    <span
                      v-else
                      class="text-xs text-muted"
                    >tidak ada nama yang mirip — isi manual di Pengaturan</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="!bolehPasang"
            class="px-4 py-3 text-xs text-muted"
          >
            Memasangkan kode butuh hak Ubah di halaman Pengaturan.
          </p>
        </AppPanel>

        <!-- Penjualan Menu -->
        <AppPanel
          title="Penjualan Menu"
          description="Bisa diurut menurut nilai atau jumlah porsi — keduanya menjawab hal yang berbeda: menu murah yang terjual ratusan porsi menghabiskan paling banyak bahan, sementara menu mahal menyumbang paling banyak omset, dan yang terlaris menurut salah satunya sering bukan yang terlaris menurut yang lain. Kolom lain diurut dengan menekan kepala kolomnya."
          flush
        >
          <div class="flex flex-wrap items-center gap-2 px-4 pt-4">
            <AppSeg
              :model-value="sort.k === 'qty' ? 'qty' : 'nilai'"
              size="sm"
              :options="[{ value: 'nilai', label: 'Menurut Nilai' }, { value: 'qty', label: 'Menurut Porsi' }]"
              @update:model-value="(v) => { sort = { k: v as Kolom, turun: true }; hal = 1 }"
            />
            <AppSeg
              v-if="kelOps.length >= 2"
              v-model="tapisKel"
              size="sm"
              :options="[{ value: '', label: 'Semua' }, ...kelOps.map(k => ({ value: k, label: k }))]"
            />
            <UInput
              v-model="cari"
              placeholder="Cari menu…"
              icon="i-lucide-search"
              size="sm"
              class="min-w-40 flex-1"
            />
            <span class="hidden text-xs text-muted lg:inline">Klik satu baris untuk melihat bahan bakunya sendiri</span>
          </div>
          <UAlert
            v-if="tapisKel"
            class="mx-4 mt-3"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :description="`Seluruh halaman ini sedang disaring ke kelompok ${tapisKel} — kartu di atas, perkiraan bahan baku, dan daftar menu tanpa resep ikut. Tekan Semua untuk melepasnya.${nTanpaKel ? ` ${nTanpaKel} menu tidak punya keterangan kelompok di laporan bulan ini, jadi ia hanya muncul di Semua.` : ''}`"
          />
          <p
            v-else-if="kelOps.length < 2 && !NM.adaKel"
            class="px-4 pt-3 text-xs text-muted"
          >
            Laporan bulan ini belum memuat kategori menu, jadi tapis food/beverage belum bisa digambar. Unggah ulang berkas bulan itu.
          </p>

          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
                <tr>
                  <th class="w-10 px-3 py-2">
                    #
                  </th>
                  <th
                    v-for="c in ([['n', 'Menu', ''], ['qty', 'Qty', 'text-end'], ['nilai', 'Nilai', 'text-end']] as const)"
                    :key="c[0]"
                    class="cursor-pointer select-none px-3 py-2"
                    :class="[c[2], sort.k === c[0] ? 'text-primary-700' : '']"
                    @click="sortKlik(c[0])"
                  >
                    {{ c[1] }} <UIcon
                      :name="sort.k === c[0] ? (sort.turun ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up') : 'i-lucide-arrow-up-down'"
                      class="size-3 align-middle"
                    />
                  </th>
                  <th class="hidden px-3 py-2 text-end sm:table-cell">
                    % dari nilai menu
                  </th>
                  <template v-if="NB">
                    <th
                      v-for="c in ([['bqty', `Qty ${fmtBln(bandingAktif)}`], ['bnilai', `Nilai ${fmtBln(bandingAktif)}`], ['dnilai', 'Selisih nilai']] as const)"
                      :key="c[0]"
                      class="cursor-pointer select-none px-3 py-2 text-end"
                      :class="sort.k === c[0] ? 'text-primary-700' : ''"
                      @click="sortKlik(c[0])"
                    >
                      {{ c[1] }} <UIcon
                        :name="sort.k === c[0] ? (sort.turun ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up') : 'i-lucide-arrow-up-down'"
                        class="size-3 align-middle"
                      />
                    </th>
                  </template>
                  <th class="hidden w-[18%] px-3 py-2 lg:table-cell" />
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-if="!tampil.length">
                  <td
                    :colspan="NB ? 9 : 6"
                    class="px-3 py-6 text-center text-muted"
                  >
                    {{ cari ? `Tidak ada menu yang namanya memuat "${cari}".` : (tapisKel ? `Tidak ada menu berkelompok ${tapisKel} bulan ini.` : 'Belum ada menu yang bisa ditampilkan.') }}
                  </td>
                </tr>
                <template
                  v-for="(x, i) in tampil"
                  :key="x.n"
                >
                  <tr
                    class="cursor-pointer hover:bg-elevated"
                    @click="buka = buka === x.n ? '' : x.n"
                  >
                    <td class="px-3 py-2 text-muted num">
                      {{ mulai + i + 1 }}
                    </td>
                    <td class="px-3 py-2">
                      <b>{{ x.n }}</b>
                      <AppStatus
                        v-if="peta && !kenal(x.n)"
                        size="sm"
                        color="warning"
                        class="ms-1.5"
                      >
                        belum ada resep
                      </AppStatus>
                      <AppStatus
                        v-if="!x.ada"
                        size="sm"
                        color="neutral"
                        class="ms-1.5"
                      >
                        tidak ada bulan ini
                      </AppStatus>
                    </td>
                    <td class="px-3 py-2 text-end num">
                      {{ angka(x.qty) }}
                    </td>
                    <td class="px-3 py-2 text-end num">
                      {{ rupiah(x.nilai) }}
                    </td>
                    <td class="hidden px-3 py-2 text-end num sm:table-cell">
                      {{ pct(x.nilai, totNilai) }}%
                    </td>
                    <template v-if="NB">
                      <td class="px-3 py-2 text-end num">
                        {{ angka(x.bqty) }}
                      </td>
                      <td class="px-3 py-2 text-end num">
                        {{ rupiah(x.bnilai) }}
                      </td>
                      <td
                        class="px-3 py-2 text-end num"
                        :class="x.dnilai > 0 ? 'text-success' : x.dnilai < 0 ? 'text-error' : ''"
                      >
                        {{ x.dnilai ? `${x.dnilai > 0 ? '+' : '−'}${rupiah(Math.abs(x.dnilai))}` : '—' }}
                        <span
                          v-if="x.dnilai && x.bnilai"
                          class="block text-xs"
                        >{{ x.dnilai > 0 ? '+' : '' }}{{ Math.round(x.dnilai / x.bnilai * 100) }}%</span>
                      </td>
                    </template>
                    <td class="hidden px-3 py-2 lg:table-cell">
                      <div class="h-2.5 rounded bg-primary-100">
                        <div
                          class="h-2.5 rounded bg-primary-500"
                          :style="{ width: `${Math.round((x[kolBar] || 0) / punBar * 100)}%` }"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr v-if="buka === x.n && rincian">
                    <td
                      :colspan="NB ? 9 : 6"
                      class="bg-elevated px-4 py-3"
                    >
                      <p
                        v-if="!peta"
                        class="text-xs text-muted"
                      >
                        Resep dari modul HPP tidak terbaca, jadi bahan per menu belum bisa dirinci.
                      </p>
                      <UAlert
                        v-else-if="!rincian.r"
                        color="warning"
                        variant="subtle"
                        icon="i-lucide-triangle-alert"
                        :description="`${x.n} belum punya resep di HPP, jadi bahan bakunya tidak bisa dihitung. Tambahkan resepnya di Stock → HPP & Resep dengan nama yang sama persis, atau petakan namanya di halaman Pengaturan.`"
                      />
                      <template v-else>
                        <p class="mb-2 text-xs text-muted">
                          Untuk <b>{{ angka(x.qty) }}</b> porsi {{ x.n }} yang terjual bulan ini.<template v-if="NB">
                            Bulan {{ fmtBln(bandingAktif) }}: <b>{{ angka(x.bqty) }}</b> porsi. Bahan di bawah dihitung dari porsi bulan ini saja.
                          </template>
                        </p>
                        <div class="grid gap-4 sm:grid-cols-2">
                          <div
                            v-for="kol in ([['Bahan mentah', rincian.r.mentah, 'Resepnya tidak menyebut satu bahan mentah pun.'], ['Bahan prep / base', rincian.r.prep, 'Menu ini tidak memakai base — seluruhnya bahan mentah.']] as const)"
                            :key="kol[0]"
                          >
                            <p class="mb-1 text-xs font-bold">
                              {{ kol[0] }}
                            </p>
                            <table
                              v-if="Object.keys(kol[1]).length"
                              class="w-full text-xs"
                            >
                              <tbody>
                                <tr
                                  v-for="n in urutObj(kol[1])"
                                  :key="n"
                                >
                                  <td class="py-0.5">
                                    {{ n }}
                                  </td>
                                  <td class="py-0.5 text-end num">
                                    {{ mnBulat(kol[1][n]!) }}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            <p
                              v-else
                              class="text-xs text-muted"
                            >
                              {{ kol[2] }}
                            </p>
                          </div>
                        </div>
                      </template>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <!-- mnPagerHtml -->
          <div class="flex flex-wrap items-center gap-2.5 px-4 pt-3">
            <span class="text-xs text-muted">Tampilkan</span>
            <AppSeg
              v-model="perHal"
              size="sm"
              :options="[20, 50, 100].map(v => ({ value: v, label: String(v) }))"
            />
            <span class="text-xs text-muted">baris per halaman</span>
            <div
              v-if="nHal > 1"
              class="ms-auto flex items-center gap-1"
            >
              <UButton
                icon="i-lucide-chevron-left"
                size="xs"
                color="neutral"
                variant="outline"
                :disabled="halAman <= 1"
                @click="hal = halAman - 1"
              />
              <UButton
                v-for="n in nomorHal"
                :key="n"
                :label="String(n)"
                size="xs"
                :color="n === halAman ? 'primary' : 'neutral'"
                :variant="n === halAman ? 'solid' : 'outline'"
                @click="hal = n"
              />
              <UButton
                icon="i-lucide-chevron-right"
                size="xs"
                color="neutral"
                variant="outline"
                :disabled="halAman >= nHal"
                @click="hal = halAman + 1"
              />
            </div>
          </div>
          <p class="px-4 pt-2 text-xs text-muted">
            <template v-if="!cocok.length">
              {{ cari ? `Tidak ada satu pun menu yang cocok dengan "${cari}".` : 'Belum ada menu.' }}
            </template>
            <template v-else>
              Menampilkan {{ mulai + 1 }}–{{ mulai + tampil.length }} dari {{ cocok.length }}
              {{ cari ? `menu yang cocok dengan "${cari}" — dari ${baris.length} menu bulan ini. Pencariannya menyapu seluruh menu, bukan halaman yang sedang terbuka.` : 'menu.' }}
              <template v-if="nLuar">
                <b>{{ nLuar }}</b> di antaranya tidak ada bulan ini dan ikut karena dibandingkan — itu sebabnya angkanya lebih besar daripada kartu Menu Berbeda di atas.
              </template>
              Diurut menurut <b>{{ NAMA_KOL[sort.k] }}</b> {{ sort.turun ? 'dari yang terbesar' : 'dari yang terkecil' }} — tekan kepala kolom untuk mengubahnya.
            </template>
          </p>
          <p class="px-4 py-3 text-xs text-muted">
            <b>% dari nilai menu</b> = nilai menu itu dibagi <b>{{ rupiah(totNilai) }}</b>, yaitu jumlah nilai SELURUH {{ urut.length }} menu bulan ini<template v-if="tapisKel">
              <b> yang berkelompok {{ tapisKel }}</b>
            </template>
            (sebelum service &amp; pajak, dan tanpa memandang halaman yang sedang terbuka). Kolomnya berjumlah 100%. Ini BUKAN persen terhadap omset — omset memuat service &amp; pajak yang tidak pernah masuk nilai menu.
            <template v-if="NB">
              Baris yang <b>tidak ada bulan ini</b> berbunyi 0% — penyebutnya memang nilai menu bulan ini.
            </template>
          </p>
        </AppPanel>

        <!-- bahanBakuHtml -->
        <UAlert
          v-if="!peta && hppStatus !== 'pending'"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Resep dari modul HPP tidak terbaca."
          :description="`Penjualan menu di atas tetap terbaca, tapi perkiraan bahan baku belum bisa dihitung.${hppErr ? ` Sebabnya: ${hppErr}` : ''} Coba buka modul Stock → HPP & Resep — kalau di sana daftarnya juga kosong, yang mati backend-nya, bukan halaman ini.`"
        />
        <AppPanel
          v-else-if="bahan"
          title="Perkiraan Bahan Baku Keluar"
          description="Jumlah menu terjual dikalikan resepnya di modul HPP. Inilah yang seharusnya keluar — bandingkan dengan stok fisik untuk melihat selisihnya."
        >
          <AppSeg
            v-model="jenisBahan"
            size="sm"
            :options="[{ value: 'mentah', label: `Bahan Mentah (${Object.keys(bahan.keluar).length})` }, { value: 'prep', label: `Bahan Prep / Base (${Object.keys(bahan.prep).length})` }]"
          />
          <UAlert
            class="mt-3"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :description="`${jenisBahan === 'prep' ? 'Bahan prep = base yang harus DIPRODUKSI dapur bulan itu (sambal, saus, kaldu, syrup). Angkanya dalam satuan yang ditulis di baris resep yang memakainya, bukan satuan yield-nya.' : 'Bahan mentah = yang benar-benar dibeli dan keluar dari gudang. Base sudah DIURAI sampai ke bahan mentahnya, jadi daftar ini sudah mencakup isi seluruh prep.'} Kedua daftar tidak boleh dijumlahkan — bahan penyusun base ada di keduanya, dan menjumlahkannya menghitung barang yang sama dua kali.`"
          />
          <UAlert
            v-if="Object.keys(bahan.hilang).length"
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="`Ada baris resep yang bahannya tidak terdaftar di HPP: ${Object.keys(bahan.hilang).slice(0, 8).join(', ')}. Baris itu dilewati.`"
          />
          <UAlert
            v-if="bahan.sik.length"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`${bahan.sik.length} resep menunjuk dirinya sendiri (langsung, atau lewat base lain). Bahannya TIDAK ikut terhitung di halaman ini.`"
            :description="`Yang kena: ${bahan.sik.slice(0, 12).join(', ')}${bahan.sik.length > 12 ? `, dan ${bahan.sik.length - 12} lagi` : ''}. Sebab tersering: resepnya memakai bahan yang NAMANYA SAMA PERSIS dengan nama resep itu sendiri — biasanya barang jadi yang dibeli (roti, dimsum, sate). Betulkan di HPP & Resep: ganti nama salah satunya supaya tidak kembar.`"
          />
          <UAlert
            v-if="bahan.dlm.length"
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`${bahan.dlm.length} resep rantainya lebih dalam dari 6 tingkat`"
            :description="`Penguraiannya berhenti dan sebagian bahan tidak terhitung. Ini bukan salah data — rantainya memang panjang. Yang kena: ${bahan.dlm.slice(0, 12).join(', ')}${bahan.dlm.length > 12 ? `, dan ${bahan.dlm.length - 12} lagi` : ''}.`"
          />
          <div class="mt-3 flex flex-wrap items-center gap-2.5">
            <UInput
              v-model="cariBahan"
              placeholder="Cari bahan…"
              icon="i-lucide-search"
              size="sm"
              class="min-w-40"
            />
            <span class="text-xs text-muted">Angka di kedua tombol di atas tetap menghitung seluruhnya</span>
          </div>
          <p
            v-if="!daftarBahan.tampil.length"
            class="mt-3 rounded-panel border border-default p-6 text-center text-sm text-muted"
          >
            {{ cariBahan ? `Tidak ada bahan yang namanya memuat "${cariBahan}".` : (jenisBahan === 'prep' ? 'Tidak ada menu terjual yang memakai base — seluruh resepnya langsung dari bahan mentah.' : 'Belum ada bahan yang bisa dihitung.') }}
          </p>
          <table
            v-else
            class="mt-3 w-full text-sm"
          >
            <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
              <tr>
                <th class="w-10 px-3 py-2">
                  #
                </th>
                <th class="px-3 py-2">
                  {{ jenisBahan === 'prep' ? 'Base / bahan prep' : 'Bahan mentah' }}
                </th>
                <th class="px-3 py-2 text-end">
                  Perkiraan keluar
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(k, i) in daftarBahan.tampil.slice(0, 200)"
                :key="k"
              >
                <td class="px-3 py-1.5 text-muted num">
                  {{ i + 1 }}
                </td>
                <td class="px-3 py-1.5">
                  {{ k }}
                </td>
                <td class="px-3 py-1.5 text-end num">
                  {{ mnBulat(daftarBahan.isi[k]!) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-2 text-xs text-muted">
            <template v-if="cariBahan">
              {{ daftarBahan.tampil.length }} dari {{ daftarBahan.semua.length }} bahan cocok dengan "{{ cariBahan }}".
            </template>
            <template v-else-if="daftarBahan.semua.length > 200">
              200 teratas dari {{ daftarBahan.semua.length }} bahan.
            </template>
            Satuannya mengikuti satuan yang ditulis di baris resep HPP — bukan satuan beli. Bahan yang dibeli per Kg tapi ditakar per Gram akan muncul dalam Gram.
          </p>
        </AppPanel>

        <!-- mnTakDikenalHtml -->
        <AppPanel
          v-if="peta"
          title="Menu yang belum ada di HPP"
        >
          <UAlert
            v-if="!tanpaResep.length"
            color="success"
            variant="subtle"
            icon="i-lucide-check"
            description="Seluruh menu yang terjual bulan ini sudah punya resep. Perkiraan bahan baku di atas mencakup semuanya."
          />
          <template v-else>
            <p class="text-sm text-muted">
              <b>{{ tanpaResep.length }} menu</b> terjual bulan ini tapi namanya tidak ada di Daftar Resep — senilai {{ rupiah(nilaiTanpa) }}
              ({{ pct(nilaiTanpa, totNilai) }}% dari nilai penjualan menu). Bahan bakunya <b>tidak ikut</b> di perkiraan di atas, jadi angka di sana lebih kecil daripada yang sebenarnya keluar.
            </p>
            <UInput
              v-model="cariResep"
              placeholder="Cari menu…"
              icon="i-lucide-search"
              size="sm"
              class="mt-3 min-w-40"
            />
            <table class="mt-3 w-full text-sm">
              <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
                <tr>
                  <th class="w-10 px-3 py-2">
                    #
                  </th>
                  <th class="px-3 py-2">
                    Nama menu di POS
                  </th>
                  <th class="px-3 py-2 text-end">
                    Qty
                  </th>
                  <th class="px-3 py-2 text-end">
                    Nilai
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-if="!tanpaResepTampil.length">
                  <td
                    colspan="4"
                    class="px-3 py-6 text-center text-muted"
                  >
                    Tidak ada menu yang namanya memuat "{{ cariResep }}".
                  </td>
                </tr>
                <tr
                  v-for="(x, i) in tanpaResepTampil"
                  :key="x.n"
                >
                  <td class="px-3 py-1.5 text-muted num">
                    {{ i + 1 }}
                  </td>
                  <td class="px-3 py-1.5">
                    <b>{{ x.n }}</b>
                  </td>
                  <td class="px-3 py-1.5 text-end num">
                    {{ angka(x.qty) }}
                  </td>
                  <td class="px-3 py-1.5 text-end num">
                    {{ rupiah(x.nilai) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              v-if="cariResep"
              class="mt-2 text-xs text-muted"
            >
              {{ tanpaResepTampil.length }} dari {{ tanpaResep.length }} menu cocok dengan "{{ cariResep }}". Kotak salin di bawah tetap memuat seluruhnya.
            </p>
            <p class="mt-4 text-sm font-bold">
              Salin daftarnya
            </p>
            <p class="mt-1 text-xs text-muted">
              Satu baris = satu menu, dipisah TAB (nama · qty · nilai) — bisa ditempel langsung ke Excel. Nama harus <b>sama persis</b> saat dibuat resepnya di HPP; kalau ejaannya memang berbeda, petakan di <b>Pengaturan</b> daripada mengganti nama menunya di POS.
            </p>
            <UTextarea
              :model-value="teksSalin"
              readonly
              :rows="Math.min(14, Math.max(3, tanpaResep.length))"
              class="mt-2 w-full font-mono text-xs"
              @focus="(e: FocusEvent) => (e.target as HTMLTextAreaElement).select()"
            />
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <UButton
                label="Salin ke clipboard"
                icon="i-lucide-clipboard"
                size="sm"
                color="neutral"
                variant="outline"
                @click="salin"
              />
              <UButton
                label="Unduh CSV"
                icon="i-lucide-download"
                size="sm"
                color="neutral"
                variant="outline"
                @click="unduhCsv"
              />
              <span class="text-xs text-muted">{{ ketSalin }}</span>
            </div>
          </template>
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
