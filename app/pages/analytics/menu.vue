<!--
  Analytics › Menu & Bahan Baku. Best-selling menus with the EVENT/OTHERS
  exclusion, package-row merging and the food/beverage filter
  (deploy/analytics/index.html:3253 vMenu). Estimates from HPP recipes need
  the Stock module (E.6): without it the estimate section says so instead of
  guessing.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { katEventKah, kelLewatKah } from '~/utils/analytics-agregat'
import { paketGenerik, paketNamaAsli } from '~/utils/analytics-pos'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('menu'))
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

/** Manual package-code pairs (POS code -> menu), upper-cased in one place. */
const petaKodeManual = computed(() => {
  const p = isi.value?.data.setting?.petaKode
  const out: Record<string, string> = {}
  if (p && typeof p === 'object') {
    for (const k of Object.keys(p)) {
      const v = String((p as Record<string, unknown>)[k] ?? '').trim()
      if (v) out[String(k).toUpperCase()] = v
    }
  }
  return out
})

interface BarisMenu { n: string, qty: number, nilai: number, kel: string }
/**
 * Raw stored menus -> the merged list. Package rows with a known code join
 * their parent (menuNormal, draw-time so a fixed map heals every month);
 * EVENT/OTHERS stay out here but stand on the Kategori page.
 */
const olah = computed(() => {
  const lap = d.value
  if (!lap) return null
  const pk = petaKodeManual.value
  const gab: Record<string, { qty: number, nilai: number }> = {}
  const takKenal: Record<string, { qty: number, nilai: number }> = {}
  let digabung = 0
  const tambah = (nama: string, q: number, v: number) => {
    const k = String(nama || '').trim().toUpperCase()
    if (!k) return
    const o = gab[k] || (gab[k] = { qty: 0, nilai: 0 })
    o.qty += q
    o.nilai += v
  }
  for (const nm of Object.keys(lap.menu ?? {})) {
    const m = lap.menu[nm]!
    if (/\(PACKAGE\)\s*$/i.test(nm)) {
      for (const kd of Object.keys(lap.paket?.[nm] ?? {})) {
        const tgt = pk[String(kd).toUpperCase()]
        const r = lap.paket[nm]![kd]!
        if (tgt) {
          tambah(tgt, r.qty ?? 0, r.nilai ?? 0)
          digabung += r.qty ?? 0
        }
        else {
          tambah(nm, r.qty ?? 0, r.nilai ?? 0)
          const t = takKenal[String(kd).toUpperCase() || '(tanpa kode)'] || (takKenal[String(kd).toUpperCase() || '(tanpa kode)'] = { qty: 0, nilai: 0 })
          t.qty += r.qty ?? 0
          t.nilai += r.nilai ?? 0
        }
      }
      // A package row without a code breakdown merges as its own row.
      if (!Object.keys(lap.paket?.[nm] ?? {}).length) tambah(nm, m.qty ?? 0, m.nilai ?? 0)
    }
    else tambah(nm, m.qty ?? 0, m.nilai ?? 0)
  }
  // Exclusion by DETAIL category (EVENT name or OTHERS top group).
  const kat = lap.kategori ?? {}
  const km = lap.katMenu ?? {}
  const lewat: Record<string, boolean> = {}
  for (const k of Object.keys(km)) {
    if (!katEventKah(k) && !kelLewatKah((kat[k] as { kat?: string } | undefined)?.kat)) continue
    for (const n of Object.keys(km[k] ?? {})) lewat[String(n).trim().toUpperCase()] = true
  }
  const ev = { nama: [] as string[], qty: 0, nilai: 0 }
  // Top group per menu (menu -> detail -> group), first wins.
  const kel: Record<string, string> = {}
  for (const k of Object.keys(km)) {
    const ka = String((kat[k] as { kat?: string } | undefined)?.kat ?? '').trim().toUpperCase()
    if (!ka || ka === '(TANPA KATEGORI)') continue
    for (const n of Object.keys(km[k] ?? {})) {
      const ku = String(n).trim().toUpperCase()
      if (!kel[ku]) kel[ku] = ka
    }
  }
  const kini: BarisMenu[] = []
  for (const n of Object.keys(gab)) {
    if (lewat[n]) {
      ev.nama.push(n)
      ev.qty += gab[n]!.qty
      ev.nilai += gab[n]!.nilai
      continue
    }
    kini.push({ n, qty: gab[n]!.qty, nilai: gab[n]!.nilai, kel: kel[n] ?? '' })
  }
  return { kini, takKenal, digabung, ev, adaKel: Object.keys(km).length > 0 }
})

const kelOps = computed(() => [...new Set((olah.value?.kini ?? []).map(x => x.kel).filter(Boolean))].sort())
const tapisKel = ref('')
const cari = ref('')
const urut = ref<'nilai' | 'qty'>('nilai')
watch(bulan, () => {
  tapisKel.value = ''
  cari.value = ''
})
watch(kelOps, (ops) => {
  if (tapisKel.value && !ops.includes(tapisKel.value)) tapisKel.value = ''
})

const daftar = computed<BarisMenu[]>(() => {
  const o = olah.value
  if (!o) return []
  const q = cari.value.trim().toLowerCase()
  const list = o.kini.filter(x =>
    (!tapisKel.value || x.kel === tapisKel.value)
    && (!q || x.n.toLowerCase().includes(q)),
  )
  return list.sort((a, x) => urut.value === 'qty'
    ? (x.qty - a.qty) || (x.nilai - a.nilai) || (a.n < x.n ? -1 : 1)
    : (x.nilai - a.nilai) || (x.qty - a.qty) || (a.n < x.n ? -1 : 1))
})
const totQty = computed(() => daftar.value.reduce((a, x) => a + x.qty, 0))
const totNilai = computed(() => daftar.value.reduce((a, x) => a + x.nilai, 0))
const kolom: TableColumn<BarisMenu>[] = [
  { accessorKey: 'n', header: 'Menu' },
  { accessorKey: 'qty', header: 'Porsi' },
  { accessorKey: 'nilai', header: 'Nilai' },
  { accessorKey: 'persen', header: '% nilai menu' },
]
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
      :description="`Hak akses kamu di halaman &quot;Menu &amp; Bahan Baku&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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

      <template v-else-if="!Object.keys(d.menu ?? {}).length">
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

      <template v-else-if="olah">
        <AppStatGrid>
          <AppStat
            label="Menu Berbeda"
            :value="angka(daftar.length)"
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
            value="—"
            icon="i-lucide-book-open"
            tone="info"
            sub="HPP tidak terbaca"
          />
        </AppStatGrid>

        <UAlert
          v-if="Object.keys(olah.takKenal).length"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Sebagian kode paket belum punya pasangan"
          :description="`${Object.entries(olah.takKenal).map(([k, v]) => `${k} (${angka(v.qty)} porsi)`).join(', ')}. Porsinya tetap dihitung, berdiri sebagai barisnya sendiri. Pasangkan di Pengaturan modul ini atau isi kode menunya di HPP & Resep.`"
        />
        <UAlert
          v-if="olah.ev.nama.length"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Menu acara tidak ikut di sini"
          :description="`${angka(olah.ev.qty)} porsi (${rupiah(olah.ev.nilai)}) berkategori EVENT/OTHERS dikeluarkan dari halaman ini — dijual per orang tanpa resep HPP. Semuanya tetap berdiri di halaman Kategori Menu.`"
        />

        <AppPanel
          title="Penjualan Menu"
          description="Bisa diurut menurut nilai atau jumlah porsi — keduanya menjawab hal yang berbeda: menu murah yang terjual ratusan porsi menghabiskan paling banyak bahan, sementara menu mahal menyumbang paling banyak omset."
          flush
        >
          <div class="flex flex-wrap items-center gap-2 px-4 pt-4">
            <AppSeg
              v-model="urut"
              size="sm"
              :options="[{ value: 'nilai', label: 'Nilai' }, { value: 'qty', label: 'Porsi' }]"
            />
            <AppChips
              v-model="tapisKel"
              :options="[{ value: '', label: 'Semua' }, ...kelOps.map(k => ({ value: k, label: k }))]"
            />
            <UInput
              v-model="cari"
              placeholder="Cari menu…"
              icon="i-lucide-search"
              size="sm"
              class="min-w-40 flex-1"
            />
          </div>
          <UAlert
            v-if="tapisKel"
            class="m-4 mb-0"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :title="`Seluruh halaman ini disaring ke ${tapisKel}`"
            description="Kartu di atas ikut. Tekan Semua untuk melepasnya."
          />
          <p
            v-else-if="olah && !olah.adaKel"
            class="px-4 pt-3 text-xs text-muted"
          >
            Laporan bulan ini belum memuat kategori menu, jadi tapis food/beverage belum bisa digambar. Unggah ulang berkas bulan itu.
          </p>
          <UTable
            class="hidden lg:block"
            :data="daftar"
            :columns="kolom"
          >
            <template #n-cell="{ row }">
              <b>{{ row.original.n }}</b>
              <span
                v-if="paketGenerik(row.original.n)"
                class="block text-xs text-muted"
              >ukuran {{ paketNamaAsli(row.original.n) }} — induknya tidak ketemu</span>
              <span
                v-else-if="row.original.kel"
                class="block text-xs text-muted"
              >{{ row.original.kel }}</span>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ angka(row.original.qty) }}</span>
            </template>
            <template #nilai-cell="{ row }">
              <span class="num">{{ rupiah(row.original.nilai) }}</span>
            </template>
            <template #persen-cell="{ row }">
              <b class="num">{{ totNilai ? (row.original.nilai / totNilai * 100).toFixed(1) : '0.0' }}%</b>
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
                <b class="num text-sm">{{ totNilai ? (x.nilai / totNilai * 100).toFixed(1) : '0.0' }}%</b>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.qty) }} porsi · {{ rupiah(x.nilai) }}{{ x.kel ? ` · ${x.kel}` : '' }}
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-xs text-muted">
            <b>% dari nilai menu</b> = nilai menu itu dibagi <b>{{ rupiah(totNilai) }}</b>, yaitu jumlah nilai SELURUH {{ daftar.length }} menu bulan ini (sebelum service &amp; pajak). Kolomnya berjumlah 100%. Ini BUKAN persen terhadap omset.
          </p>
        </AppPanel>

        <AppPanel
          title="Perkiraan Bahan Baku"
          description="Bahan mentah dan bahan prep yang seharusnya keluar — dikalikan dari resep di modul HPP."
        >
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Resep HPP belum terbaca"
            description="Perkiraan bahan baku dihitung dari resep di modul Stock › HPP & Resep. Sambungkan modul itu (atau unggah ulang berkas bulan ini sesudah kodenya dipasangkan), lalu angkanya tampil di sini untuk dibandingkan dengan stok fisik di lapangan."
          />
        </AppPanel>
      </template>
    </template>
  </AppPage>
</template>
