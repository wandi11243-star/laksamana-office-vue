<!--
  Finance › Kas Kecil › Laporan Void (old `viewVoidLap`, deploy/finance/kas/index.html:1757-1850).

  READ-ONLY (T-14/U1, as before): void rows are typed in Cashier › Void Menu,
  and this report only aggregates them. Only LIVE rows are summed; cancelled
  ones are counted and stay visible. The POS comparator card uses `analytics`,
  a module a finance user may not hold (T-15) — it is hidden without it.
-->
<script setup lang="ts">
import type { VoidBaris } from '~/utils/cashier'
import { getVoidKasir } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { hasAccess } from '~/composables/useMe'

definePageMeta({ access: ['finance'] })

const me = useMe()
const izin = useKasIzin()
const periode = ref(hariIni().slice(0, 7))
const cari = ref('')

const bulanRentang = computed(() => {
  const [y, m] = periode.value.split('-').map(Number)
  const akhir = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  return { dari: `${periode.value}-01`, sampai: `${periode.value}-${String(akhir).padStart(2, '0')}` }
})

const { data, status, error, refresh } = useAsyncData(
  'kas-voidb',
  async () => {
    const voids = await getVoidKasir(bulanRentang.value.dari, bulanRentang.value.sampai)
    return { voids }
  },
  { watch: [periode] },
)

const baris = computed<VoidBaris[]>(() => data.value?.voids.baris ?? [])
const hidup = computed(() => baris.value.filter(v => !(Number(v.batalAt) > 0)))
const mati = computed(() => baris.value.filter(v => Number(v.batalAt) > 0))
const total = computed(() => hidup.value.reduce((s, v) => s + Number(v.nominal || 0), 0))
/** `vlKelompok`: grouped ignoring case; the first spelling met is the one shown. */
function kelompok(ambil: (v: VoidBaris) => string) {
  const map = new Map<string, { nama: string, n: number, total: number }>()
  for (const v of hidup.value) {
    const nama = ambil(v).trim() || '(kosong)'
    const k = nama.toLowerCase()
    const g = map.get(k) ?? { nama, n: 0, total: 0 }
    g.n++
    g.total += Number(v.nominal || 0)
    map.set(k, g)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}
// the SESSION name (`oleh`), not the typed `penginput` — old perOrang = vlKelompok(hidup, r => r.oleh)
const perOrang = computed(() => kelompok(v => String(v.oleh || '')))
const perAlasan = computed(() => kelompok(v => String(v.alasan || '')))
const perSalah = computed(() => kelompok(v => String(v.salah || '')))

const grup = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const list = baris.value
    .filter(v => !q || [v.item, v.bill, v.penginput, v.salah, v.alasan, v.oleh, v.tgl].join(' ').toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : String(b.bill).localeCompare(String(a.bill))))
  const map = new Map<string, { kunci: string, tgl: string, bill: string, rows: VoidBaris[] }>()
  for (const v of list) {
    const k = `${v.tgl}|${String(v.bill || '').trim().toUpperCase() || '(tanpa bill)'}`
    const g = map.get(k) ?? { kunci: k, tgl: v.tgl, bill: v.bill, rows: [] }
    g.rows.push(v)
    map.set(k, g)
  }
  return [...map.values()]
})

// POS comparator — only for holders of `analytics` (T-15). The card is hidden,
// not an error, when the module is absent.
const punyaAnalitik = computed(() => hasAccess(me.value, ['analytics']))
const nPos = ref<number | null>(null)
watch([periode, punyaAnalitik], async () => {
  nPos.value = null
  if (!punyaAnalitik.value) return
  try {
    const r = await useApi()<Envelope<Record<string, unknown>>>('/kompas/analytics')
    const v = (r.data as { voidb?: Record<string, { ringkas?: { nBaris?: number } }> }).voidb?.[periode.value]
    nPos.value = typeof v?.ringkas?.nBaris === 'number' ? v.ringkas.nBaris : null
  }
  catch {
    nPos.value = null
  }
}, { immediate: true })
const jumlahBill = computed(() => new Set(hidup.value.map(v => `${v.tgl}|${String(v.bill || '').trim().toUpperCase()}`)).size)
const persenDari = (n: number) => (total.value > 0 ? `${((n / total.value) * 100).toFixed(1)}%` : '—')
const TABEL: { judul: string, sub: string, kolom: string, rows: () => { nama: string, n: number, total: number }[] }[] = [
  { judul: 'Siapa yang Mencatat', sub: 'Diurut dari yang paling banyak. Namanya diambil dari sesi Office yang sudah diverifikasi, bukan diketik.', kolom: 'Nama', rows: () => perOrang.value },
  { judul: 'Alasan Void', sub: 'Dikelompokkan tanpa memandang huruf besar-kecil. Isinya teks bebas, jadi kalimat yang berbeda tetap berdiri sebagai barisnya sendiri.', kolom: 'Alasan / Kronologi', rows: () => perAlasan.value },
]
const selisihPos = computed(() => (nPos.value === null ? null : Math.max(0, nPos.value - hidup.value.length)))
</script>

<template>
  <AppPage
    title="Laporan void"
    description="Menu yang di-void berikut kronologinya — dicatat kasir di modul Cashier."
  >
    <template #actions>
      <UInput
        v-model="periode"
        type="month"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Muat ulang"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('voidb')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <div
      v-else
      class="space-y-4"
    >
      <AppPanel :title="`Laporan Void — ${periode}`">
        <template #description>
          Dicatat kasir di <b>modul Cashier &gt; Void Menu</b>. Halaman ini <b>baca saja</b>: yang memegang catatannya kasir yang ada di lapangan
          waktu kejadiannya, dan angka yang bisa diketik di dua tempat akan berbeda suatu hari. Ganti bulan lewat kotak periode di kanan atas.
        </template>
      </AppPanel>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AppStat
          label="Total nominal void"
          icon="i-lucide-ban"
          :value="fmtRp(total)"
          :sub="`${hidup.length} item dari ${jumlahBill} bill sepanjang ${periode}`"
          class="bg-primary-50"
        />
        <AppStat
          label="Orang yang mencatat"
          icon="i-lucide-users"
          :value="perOrang.length"
          :sub="perOrang.length ? `${perOrang[0]!.nama} paling banyak (${perOrang[0]!.n})` : 'belum ada'"
        />
        <AppStat
          label="Dibatalkan"
          icon="i-lucide-undo-2"
          :value="mati.length"
          :sub="mati.length ? 'tetap tercatat, tidak ikut dijumlahkan' : 'tidak ada'"
        />
        <AppStat
          v-if="punyaAnalitik"
          label="Pembanding POS"
          icon="i-lucide-monitor-check"
          :value="nPos === null ? 'belum ada' : `${selisihPos} selisih`"
          :sub="nPos === null ? 'Laporan Cancel Menu Detail bulan ini belum diunggah di modul Analytics > Void & Cancel' : `${nPos} baris di mesin, ${hidup.length} dicatat manusia`"
          tone="info"
        />
      </div>

      <p
        v-if="status === 'pending' && !baris.length"
        class="text-sm text-muted"
      >
        Memuat catatan void dari server…
      </p>

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <AppPanel
          v-for="t in TABEL"
          :key="t.judul"
          :title="t.judul"
          :description="t.sub"
          flush
        >
          <table class="w-full text-sm">
            <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
              <tr>
                <th class="px-3 py-2.5 text-start">
                  {{ t.kolom }}
                </th>
                <th class="px-3 py-2.5 text-end">
                  Catatan
                </th>
                <th class="px-3 py-2.5 text-end">
                  Nominal
                </th>
                <th class="px-3 py-2.5 text-end">
                  % nominal
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="g in t.rows()"
                :key="g.nama"
              >
                <td class="px-3 py-2.5 font-semibold text-highlighted">
                  {{ g.nama }}
                </td>
                <td class="px-3 py-2.5 text-end num">
                  {{ g.n }}
                </td>
                <td class="px-3 py-2.5 text-end num">
                  {{ fmtRp(g.total) }}
                </td>
                <td class="px-3 py-2.5 text-end num">
                  {{ persenDari(g.total) }}
                </td>
              </tr>
              <tr v-if="!t.rows().length">
                <td
                  colspan="4"
                  class="px-3 py-5 text-center text-muted"
                >
                  Belum ada catatan.
                </td>
              </tr>
            </tbody>
          </table>
        </AppPanel>
      </div>

      <AppPanel
        title="Kesalahan dari Siapa"
        flush
      >
        <template #description>
          Diisi kasir di form Void modul Cashier, dan <b>bukan</b> orang yang mencatatnya — yang mencatat ada di kartu <b>Siapa yang Mencatat</b>
          di atas. Isinya teks bebas dengan pilihan siap pakai, jadi ejaan yang berbeda tetap berdiri sebagai barisnya sendiri.
        </template>
        <table class="w-full text-sm">
          <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
            <tr>
              <th class="px-3 py-2.5 text-start">
                Pihak
              </th>
              <th class="px-3 py-2.5 text-end">
                Catatan
              </th>
              <th class="px-3 py-2.5 text-end">
                Nominal
              </th>
              <th class="px-3 py-2.5 text-end">
                % nominal
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="g in perSalah"
              :key="g.nama"
            >
              <td class="px-3 py-2.5 font-semibold text-highlighted">
                {{ g.nama }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ g.n }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ fmtRp(g.total) }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ persenDari(g.total) }}
              </td>
            </tr>
            <tr v-if="!perSalah.length">
              <td
                colspan="4"
                class="px-3 py-5 text-center text-muted"
              >
                Belum ada catatan.
              </td>
            </tr>
          </tbody>
        </table>
      </AppPanel>

      <AppPanel title="Rincian Catatan">
        <template #description>
          Dikelompokkan per tanggal + nomor bill: baris tebal adalah bill, penginput, pihak yang salah, dan kronologinya; barisnya di bawah adalah
          item yang di-void. Service &amp; tax diisi SEKALI per bill lalu dibagi server ke tiap item menurut subtotalnya — jumlah barisnya karena
          itu selalu sama persis dengan yang diketik kasir. Termasuk yang sudah dibatalkan — yang dibatalkan dicoret dan tidak ikut dijumlahkan
          di kartu mana pun.
        </template>
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari item, nomor bill, penginput, pihak yang salah, atau alasan"
          class="mb-3 w-full sm:w-[28rem]"
        />
        <div class="overflow-x-auto">
          <table class="w-full min-w-[40rem] text-sm">
            <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
              <tr>
                <th class="px-3 py-2.5 text-start">
                  Tanggal
                </th>
                <th class="px-3 py-2.5 text-start">
                  Bill &amp; item
                </th>
                <th class="px-3 py-2.5 text-end">
                  Nominal
                </th>
                <th class="px-3 py-2.5 text-start">
                  Dicatat oleh
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="g in grup"
                :key="g.kunci"
              >
                <tr class="border-t border-default bg-muted">
                  <td class="px-3 py-2.5 align-top num">
                    {{ g.tgl }}
                  </td>
                  <td class="px-3 py-2.5">
                    <b class="num">{{ g.bill || '—' }}</b> · diinput {{ g.rows[0]?.penginput || '—' }} · salah <b>{{ g.rows[0]?.salah || '—' }}</b>
                    <span class="mt-0.5 block max-w-[30rem] whitespace-pre-wrap text-xs text-muted">{{ g.rows[0]?.alasan || '—' }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-end align-top num">
                    <b>{{ fmtRp(g.rows.filter(v => !(Number(v.batalAt) > 0)).reduce((x, v) => x + Number(v.nominal || 0), 0)) }}</b>
                    <span class="block text-xs font-normal text-muted">
                      {{ g.rows.filter(v => !(Number(v.batalAt) > 0)).length }} item<template v-if="g.rows.some(v => Number(v.batalAt) > 0)">
                        · {{ g.rows.filter(v => Number(v.batalAt) > 0).length }} dibatalkan
                      </template>
                    </span>
                  </td>
                  <td class="px-3 py-2.5 align-top">
                    {{ g.rows[0]?.oleh || '—' }}
                  </td>
                </tr>
                <tr
                  v-for="v in g.rows"
                  :key="v.id"
                  class="border-t border-default"
                  :class="Number(v.batalAt) > 0 ? 'opacity-55' : ''"
                >
                  <td />
                  <td class="py-2 pe-3 ps-7">
                    <b :class="Number(v.batalAt) > 0 ? 'line-through' : ''">{{ v.item || '—' }}</b>
                    <span
                      v-if="Number(v.batalAt) > 0"
                      class="block text-xs text-muted"
                    >Dibatalkan {{ v.batalOleh }}{{ v.batalAlasan ? ` — ${v.batalAlasan}` : '' }}</span>
                  </td>
                  <td class="px-3 py-2 text-end num">
                    {{ fmtRp(Number(v.nominal || 0)) }}
                  </td>
                  <td />
                </tr>
              </template>
              <tr v-if="!grup.length">
                <td
                  colspan="4"
                  class="px-3 py-6 text-center text-muted"
                >
                  {{ cari ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan void bulan ini.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>
    </div>
  </AppPage>
</template>
