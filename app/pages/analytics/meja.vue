<!--
  Analytics › Performa Meja. Turnover per table with the Reservasi floor
  plan's seats and zones (deploy/analytics/index.html:5198 vMeja, mjHitung
  :4994). The divisor is the PLAN's SEAT COUNT, never Pax Total (which reads
  1 on nearly every bill). Quick Service joins as a seat-less row.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { MEJA_ZONA_TANPA, kursiDari, mejaBukanKah, mejaNorm } from '~/utils/analytics-agregat'
import { MEJA_TANPA } from '~/utils/analytics-pos'
import { LABEL_ZONA, VENUE_LAYOUTS } from '~/utils/venue-layouts'
import { BLN, angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('meja'))
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

interface DenahMeja { id: string, cap: string, zona: string }
const denah = computed<Record<string, DenahMeja> | null>(() => {
  try {
    const out: Record<string, DenahMeja> = {}
    for (const k of Object.keys(VENUE_LAYOUTS)) {
      for (const t of VENUE_LAYOUTS[k]?.tables ?? []) {
        const id = String(t?.id ?? '').trim()
        // First plan wins; capacities match across plans.
        if (id && !out[id]) out[id] = { id, cap: String(t.cap ?? ''), zona: LABEL_ZONA[t.zone] ?? String(t.zone ?? '') }
      }
    }
    return Object.keys(out).length ? out : null
  }
  catch {
    return null
  }
})

interface BarisMeja {
  n: string
  pos: string
  zona: string
  cap: string
  kursi: number
  tanpaMeja: boolean
  b: number
  g: number
  atv: number | null
  perKursi: number | null
  perOrang: number | null
}
const hitung = computed(() => {
  const lap = d.value
  const D = denah.value
  const petaId: Record<string, string> = {}
  if (D) for (const id of Object.keys(D)) petaId[mejaNorm(id)] = id
  const baris: BarisMeja[] = []
  const takKenal: { n: string, g: number, b: number }[] = []
  const bukan: BarisMeja[] = []
  let gMeja = 0
  let gBukan = 0
  let gTanpa = 0
  let bMeja = 0
  let gTotal = 0
  let orangVisit = 0
  let kursiPakai = 0
  for (const nm of Object.keys(lap?.meja ?? {})) {
    const v = lap!.meja[nm]!
    const g = v.grand ?? 0
    const b = v.bill ?? 0
    gTotal += g
    if (nm === MEJA_TANPA) {
      gTanpa += g
      continue
    }
    if (mejaBukanKah(nm)) {
      const r: BarisMeja = { n: nm, pos: nm, zona: MEJA_ZONA_TANPA, cap: '', kursi: 0, tanpaMeja: true, b, g, atv: b ? g / b : null, perKursi: null, perOrang: null }
      baris.push(r)
      bukan.push(r)
      gBukan += g
      continue
    }
    const id = petaId[mejaNorm(nm)]
    if (!id || !D) {
      takKenal.push({ n: nm, g, b })
      continue
    }
    const m = D[id]!
    const kursi = kursiDari(m.cap)
    gMeja += g
    bMeja += b
    orangVisit += kursi * b
    if (kursi) kursiPakai += kursi
    baris.push({
      n: id, pos: nm, zona: m.zona, cap: m.cap, kursi, tanpaMeja: false, b, g,
      atv: b ? g / b : null,
      perKursi: kursi ? g / kursi : null,
      perOrang: kursi && b ? g / (b * kursi) : null,
    })
  }
  const dipakai: Record<string, boolean> = {}
  baris.forEach((x) => {
    if (!x.tanpaMeja) dipakai[mejaNorm(x.n)] = true
  })
  const nganggur = D ? Object.keys(D).filter(id => !dipakai[mejaNorm(id)]) : []
  return { baris, takKenal, bukan, gMeja, gBukan, gTanpa, bMeja, gTotal, orangVisit, kursiPakai, nganggur }
})
/* The % denominator from hari[], never ringkas grand (which covers the whole
   file including the neighbouring month); the table's own sum as fallback. */
const grand = computed(() => Object.values(d.value?.hari ?? {}).reduce((a, x) => a + (x.grand ?? 0), 0) || hitung.value.gTotal)
const pct1 = (x: number, t: number) => t ? `${(x / t * 100).toFixed(1)}%` : '—'
const mejaPakai = computed(() => hitung.value.baris.filter(x => !x.tanpaMeja).length)

const cari = ref('')
const urutKunci = ref('g')
const urutTurun = ref(true)
watch(bulan, () => {
  cari.value = ''
})
const daftar = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const list = hitung.value.baris.filter(x =>
    !q || x.n.toLowerCase().includes(q) || x.zona.toLowerCase().includes(q) || String(x.kursi).includes(q),
  )
  const k = urutKunci.value
  const amb = (x: BarisMeja): number | string => {
    if (k === 'b') return x.b
    if (k === 'atv') return x.atv ?? -1
    if (k === 'perKursi') return x.perKursi ?? -1
    if (k === 'perOrang') return x.perOrang ?? -1
    if (k === 'n') return x.n
    return x.g
  }
  const dir = urutTurun.value ? -1 : 1
  return list.sort((a, x) => {
    const va = amb(a)
    const vb = amb(x)
    if (typeof va === 'string' || typeof vb === 'string') return String(va) < String(vb) ? dir : -dir
    return (va - vb) * -dir || (a.n < x.n ? -1 : 1)
  })
})
function tekanKolom(k: string) {
  if (urutKunci.value === k) urutTurun.value = !urutTurun.value
  else {
    urutKunci.value = k
    urutTurun.value = true
  }
}
const panah = (k: string) => urutKunci.value !== k ? '' : urutTurun.value ? ' ▼' : ' ▲'
const kolom: TableColumn<BarisMeja>[] = [
  { accessorKey: 'n', header: 'Meja' },
  { accessorKey: 'zona', header: 'Zona' },
  { accessorKey: 'cap', header: 'Kursi' },
  { accessorKey: 'b', header: 'Transaksi' },
  { accessorKey: 'g', header: 'Omset' },
  { accessorKey: 'pct', header: '% omset' },
  { accessorKey: 'atv', header: 'Rata-rata' },
  { accessorKey: 'perKursi', header: 'Rp per kursi' },
  { accessorKey: 'perOrang', header: 'Rp per orang' },
]
const zonaAgregat = computed(() => {
  const m: Record<string, { meja: number, g: number, b: number }> = {}
  for (const x of hitung.value.baris.filter(y => !y.tanpaMeja)) {
    const o = m[x.zona] || (m[x.zona] = { meja: 0, g: 0, b: 0 })
    o.meja++
    o.g += x.g
    o.b += x.b
  }
  return Object.keys(m).sort((a, b) => m[b]!.g - m[a]!.g).map(z => ({ z, ...m[z]! }))
})
</script>

<template>
  <AppPage
    title="Performa Meja"
    description="Omset tiap meja, kapasitasnya di denah Reservasi, dan omset per kursinya"
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
      title="Memuat meja"
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
      :description="`Hak akses kamu di halaman &quot;Performa Meja&quot; cuma &quot;${roleSaya}&quot;. Minta admin modul mengubahnya di Kelola Akses.`"
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
        v-else-if="!d.meja"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Laporan bulan ini belum memuat data meja"
        description="Kolom meja (Table di Bill Report, Table Name di Detail Report) baru ikut dibaca sejak 17 September 2026, jadi ringkasan yang disimpan sebelum itu tidak menyimpannya. Unggah ulang berkas bulan itu; ringkasannya akan ditimpa, dan mejanya ikut terbaca."
      />
      <UAlert
        v-else-if="!Object.keys(d.meja).length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="d.ringkas?.mejaKolom ? 'Tidak ada satu pun transaksi bermeja bulan ini' : 'Berkas bulan ini tidak punya kolom meja'"
        :description="d.ringkas?.mejaKolom
          ? 'Berkasnya punya kolom mejanya dan kolomnya terbaca, tapi tidak satu pun barisnya terisi. Itu jawaban, bukan kesalahan.'
          : 'Ekspor ulang dari POS dengan kolom Table (Bill Report) atau Table Name (Detail Report) ikut dicentang, lalu unggah lagi.'"
      />

      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Omset dari Meja"
            :value="rupiah(hitung.gMeja)"
            icon="i-lucide-armchair"
            tone="gold"
            :sub="`${pct1(hitung.gMeja, grand)} dari omset sebulan · ${mejaPakai} meja terpakai`"
          />
          <AppStat
            label="Rata-rata per Transaksi"
            :value="hitung.bMeja ? rupiah(hitung.gMeja / hitung.bMeja) : '—'"
            icon="i-lucide-receipt"
            tone="info"
            :sub="`${angka(hitung.bMeja)} transaksi bermeja`"
          />
          <AppStat
            label="Rp per Kursi"
            :value="hitung.kursiPakai ? rupiah(hitung.gMeja / hitung.kursiPakai) : '—'"
            icon="i-lucide-users"
            tone="info"
            :sub="hitung.kursiPakai ? `${hitung.kursiPakai} kursi di meja yang terpakai · sebulan` : 'kapasitas tidak terbaca'"
          />
          <AppStat
            label="Rp per Orang"
            :value="hitung.orangVisit ? rupiah(hitung.gMeja / hitung.orangVisit) : '—'"
            icon="i-lucide-user"
            tone="info"
            :sub="hitung.orangVisit ? 'bila mejanya terisi penuh · batas bawah' : 'kapasitas tidak terbaca'"
          />
          <AppStat
            label="Tanpa Meja"
            :value="rupiah(hitung.gBukan + hitung.gTanpa)"
            icon="i-lucide-cloud-off"
            tone="info"
            :sub="`${pct1(hitung.gBukan + hitung.gTanpa, grand)} — tidak ikut hitungan per kursi`"
          />
        </AppStatGrid>

        <UAlert
          v-if="!denah"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Denah venue tidak termuat"
          description="Kapasitas dan zona tiap meja tidak bisa dibaca — yang tersisa cuma omset per nama meja. Muat ulang halaman ini."
        />
        <UAlert
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Pembaginya kapasitas kursi di denah Reservasi"
          description="Bukan jumlah tamu di berkas POS. Kolom Pax Total memang terisi, tapi isinya 1 di hampir semua bill — dibagi dengannya, omset per tamu cuma mengulang kolom Rata-rata / transaksi dengan nama lain. Rp per orang itu BATAS BAWAH: ia menghitung seolah tiap meja terisi penuh; meja berkursi 4 yang diduduki 2 orang membuat belanja per orang yang sebenarnya dua kali lipat angka di kolom itu."
        />

        <AppPanel
          title="Per Zona"
          description="Omset sebulan per zona denah."
          flush
        >
          <UTable
            class="hidden lg:block"
            :data="zonaAgregat"
            :columns="[{ accessorKey: 'z', header: 'Zona' }, { accessorKey: 'meja', header: 'Meja' }, { accessorKey: 'b', header: 'Transaksi' }, { accessorKey: 'g', header: 'Omset' }]"
          >
            <template #z-cell="{ row }">
              <b>{{ row.original.z }}</b>
            </template>
            <template #meja-cell="{ row }">
              <span class="num">{{ angka(row.original.meja) }}</span>
            </template>
            <template #b-cell="{ row }">
              <span class="num">{{ angka(row.original.b) }}</span>
            </template>
            <template #g-cell="{ row }">
              <span class="num">{{ rupiah(row.original.g) }}</span>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="z in zonaAgregat"
              :key="z.z"
              class="flex items-baseline justify-between gap-2 px-4 py-2.5"
            >
              <div>
                <b class="block text-sm">{{ z.z }}</b>
                <span class="text-xs text-muted">{{ angka(z.meja) }} meja · {{ angka(z.b) }} transaksi</span>
              </div>
              <span class="num text-sm font-medium">{{ rupiah(z.g) }}</span>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Per Meja"
          description="Omset sebulan tiap meja, kapasitasnya di denah, omset per kursinya, dan perkiraan belanja per orang tiap bill. Transaksi yang tidak menempati meja ikut sebagai baris tanpa meja, tanpa kapasitas — kedua kolom per-kursinya ditahan."
          flush
        >
          <div class="px-4 pt-4">
            <UInput
              v-model="cari"
              placeholder="Cari nomor meja, zona, kapasitas…"
              icon="i-lucide-search"
              size="sm"
            />
          </div>
          <UTable
            class="hidden lg:block"
            :data="daftar"
            :columns="kolom"
          >
            <template #n-cell="{ row }">
              <b>{{ row.original.n }}</b>
              <span
                v-if="row.original.pos !== row.original.n"
                class="block text-xs text-muted"
              >di POS: {{ row.original.pos }}</span>
            </template>
            <template #zona-cell="{ row }">
              <span class="text-xs">{{ row.original.zona || '—' }}</span>
            </template>
            <template #cap-cell="{ row }">
              <span class="num">{{ row.original.cap || '—' }}</span>
            </template>
            <template #b-cell="{ row }">
              <span class="num">{{ angka(row.original.b) }}</span>
            </template>
            <template #g-cell="{ row }">
              <span class="num">{{ rupiah(row.original.g) }}</span>
            </template>
            <template #pct-cell="{ row }">
              <span class="num">{{ pct1(row.original.g, grand) }}</span>
            </template>
            <template #atv-cell="{ row }">
              <span class="num">{{ row.original.atv === null ? '—' : rupiah(row.original.atv) }}</span>
            </template>
            <template #perKursi-cell="{ row }">
              <span class="num">{{ row.original.perKursi === null ? '—' : rupiah(row.original.perKursi) }}</span>
            </template>
            <template #perOrang-cell="{ row }">
              <span class="num">{{ row.original.perOrang === null ? '—' : rupiah(row.original.perOrang) }}</span>
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
                <span class="num text-sm font-medium">{{ rupiah(x.g) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-muted">
                {{ angka(x.b) }} transaksi · {{ x.zona || 'tanpa zona' }}{{ x.kursi ? ` · ${x.cap} kursi` : '' }}{{ x.perOrang !== null ? ` · ${rupiah(x.perOrang)}/orang` : '' }}
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5 px-4 py-3">
            <span class="text-xs text-muted">Urut:</span>
            <button
              v-for="k in [['g', 'Omset'], ['b', 'Transaksi'], ['atv', 'Rata-rata'], ['perKursi', 'Rp/kursi'], ['perOrang', 'Rp/orang'], ['n', 'Nama']]"
              :key="k[0]"
              type="button"
              class="rounded-full border border-default px-2.5 py-1 text-xs font-medium"
              :class="urutKunci === k[0] && 'border-primary-400 bg-primary-100 text-primary-800'"
              @click="tekanKolom(k[0]!)"
            >
              {{ k[1] }}{{ panah(k[0]!) }}
            </button>
          </div>
        </AppPanel>

        <UAlert
          v-if="hitung.bukan.length"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Ikut di tabel sebagai baris tanpa meja"
          :description="`${hitung.bukan.map(x => `${x.n} ${rupiah(x.g)} (${angka(x.b)} transaksi)`).join(' · ')}. Itu transaksi yang memang tidak menempati meja — pesanan online, ESB Order, dan take away — jadi mejanya tidak diketahui dan kedua kolom per-kursinya ditahan.`"
        />
        <UAlert
          v-if="hitung.takKenal.length"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Ada di berkas POS tapi tidak ada di denah Reservasi"
          :description="`${hitung.takKenal.map(x => `${x.n} ${rupiah(x.g)} (${angka(x.b)} transaksi)`).join(' · ')}. Mejanya nyata — tamunya duduk di sana dan uangnya masuk — tapi denah di modul Reservasi belum mengenalnya. Yang perlu dibetulkan denahnya, bukan berkas POS-nya.`"
        />
        <UAlert
          v-if="hitung.nganggur.length"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="`${hitung.nganggur.length} meja ada di denah tapi tidak sekali pun dipakai bulan ini`"
          :description="`${hitung.nganggur.slice(0, 25).join(', ')}${hitung.nganggur.length > 25 ? `, dan ${hitung.nganggur.length - 25} lagi` : ''}. Bukan galat — justru ini yang biasanya dicari saat menata ulang denah.`"
        />
      </template>
    </template>
  </AppPage>
</template>
