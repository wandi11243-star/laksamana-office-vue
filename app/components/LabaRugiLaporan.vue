<!--
  The Laba Rugi report (ESB Core Profit & Loss, saved by the last Refresh), shared
  by Analytics › Laba Rugi and Investor Compass › Laba Rugi (owner, Nov 2026:
  "buat persis"). Opening it never calls ESB; Refresh (refreshEsb, exposed for
  the page's action bar) asks ESB again for the years the range touches.
  "Dana keluar" = HPP + beban operasional (cash out); EBITDA, penjualan bersih
  and EBIT are ESB's own subtotals; depresiasi & amortisasi is non-cash and
  shown apart, never added to dana keluar.
  Filter: plain-word presets + from/to + per month / per year; the comparison is
  always the same months a year earlier. Operating accounts are grouped
  (KELOMPOK); each group opens to its accounts.
-->
<script setup lang="ts">
import { getEsbProfitLossSaved, refreshEsbProfitLoss, type PlAngka, type PlSimpanan } from '~/composables/useAnalytics'
import { BLN, BULAN, rupiah } from '~/utils/format'

const props = withDefaults(defineProps<{
  /** useAsyncData key: each module keeps its own copy. */
  kunci: string
  /** May this viewer ask ESB again (Refresh)? */
  bolehRefresh?: boolean
  /** Viewing is allowed: false = nothing is fetched. */
  aktif?: boolean
}>(), { bolehRefresh: true, aktif: true })
const bolehLihat = computed(() => props.aktif)

const tahunIni = new Date().getFullYear()
const TAHUN = [tahunIni - 2, tahunIni - 1, tahunIni]

/** The saved reports of the three years (a missing older year only shortens the slider). No ESB call. */
const { data, status, error, refresh: muatUlang } = useAsyncData(
  props.kunci,
  async () => {
    if (!bolehLihat.value) return null
    const [kini, ...lama] = await Promise.all([
      getEsbProfitLossSaved(tahunIni),
      ...TAHUN.slice(0, -1).map(t => getEsbProfitLossSaved(t).catch(() => null)),
    ])
    const out: Record<number, PlSimpanan | null> = { [tahunIni]: kini }
    TAHUN.slice(0, -1).forEach((t, i) => {
      out[t] = lama[i] ?? null
    })
    return out
  },
  { watch: [bolehLihat] },
)
const laporan = computed(() => TAHUN.map(t => data.value?.[t]?.laporan).filter(x => !!x))
const adaData = computed(() => laporan.value.length > 0)

/** Newest successful refresh over all years, and one history list with the year on each line. */
const terakhir = computed(() => TAHUN.map(t => data.value?.[t]).filter(s => s?.diambil).sort((a, b) => b!.diambil!.localeCompare(a!.diambil!))[0] ?? null)
const riwayat = computed(() => TAHUN.flatMap(t => (data.value?.[t]?.riwayat ?? []).map(r => ({ ...r, tahun: t })))
  .sort((a, b) => b.waktu.localeCompare(a.waktu)).slice(0, 20))

// ─── Refresh: only on click; asks ESB for the years the range (and its comparison) touches ──
const merefresh = ref(false)
const gagalRefresh = ref('')
const lihatRiwayat = ref(false)
async function refreshEsb() {
  merefresh.value = true
  gagalRefresh.value = ''
  const perlu = new Set<number>()
  for (const id of [...rentang.value, ...rentang.value.map(x => geser(x, -12))]) perlu.add(Number(id.slice(0, 4)))
  const th = [...perlu].filter(t => TAHUN.includes(t))
  if (!th.length) th.push(tahunIni, tahunIni - 1)
  try {
    const hasil = await Promise.allSettled(th.map(t => refreshEsbProfitLoss(t)))
    const gagal = hasil.find(h => h.status === 'rejected') as PromiseRejectedResult | undefined
    if (gagal) gagalRefresh.value = apiErrorMessage(gagal.reason, 'ESB tidak bisa dihubungi.')
  }
  finally {
    await muatUlang()
    merefresh.value = false
  }
}
const waktu = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── periods: ESB keys them in English ("January 2026"); we use "YYYY-MM" ids ──
const BULAN_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const idDariKey = (k: string): string | null => {
  const [b, y] = k.trim().split(/\s+/)
  const i = BULAN_EN.indexOf(b?.toLowerCase() ?? '')
  return i >= 0 && /^\d{4}$/.test(y ?? '') ? `${y}-${String(i + 1).padStart(2, '0')}` : null
}
const geser = (id: string, n: number) => {
  const [y, m] = id.split('-').map(Number)
  const t = y! * 12 + (m! - 1) + n
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`
}
const lblBulan = (id: string) => BLN[Number(id.slice(5)) - 1] ?? id
const lblBulanTh = (id: string) => `${lblBulan(id)} ${id.slice(0, 4)}`
const lblRentang = (ids: string[]) => {
  if (!ids.length) return '—'
  const a = ids[0]!
  const z = ids[ids.length - 1]!
  if (a === z) return lblBulanTh(a)
  return a.slice(0, 4) === z.slice(0, 4) ? `${lblBulan(a)}–${lblBulan(z)} ${a.slice(0, 4)}` : `${lblBulanTh(a)} – ${lblBulanTh(z)}`
}

// ─── operating-expense groups: by ESB account code, a few accounts moved by hand ──
interface Kelompok { nama: string, warna: string }
const KELOMPOK: Record<string, Kelompok> = {
  hpp: { nama: 'HPP (bahan baku)', warna: 'var(--color-gold)' },
  sdm: { nama: 'Gaji & karyawan', warna: 'var(--color-brand-blue)' },
  event: { nama: 'Event & hiburan', warna: 'var(--color-vip)' },
  gedung: { nama: 'Gedung & utilitas', warna: 'var(--color-brand-teal)' },
  pajak: { nama: 'Pajak', warna: 'var(--color-brand-coral)' },
  promosi: { nama: 'Marketing & promosi', warna: 'var(--color-brand-pink)' },
  rawat: { nama: 'Perbaikan & perawatan', warna: 'var(--color-yellow-dark)' },
  teknologi: { nama: 'Teknologi & aplikasi', warna: 'var(--color-moss-dark)' },
  bank: { nama: 'Biaya bank & pembayaran', warna: 'var(--color-gold-deep)' },
  lain: { nama: 'Lain-lain', warna: 'var(--ui-text-muted)' },
}
const PER_AKUN: Record<string, keyof typeof KELOMPOK> = {
  '6 1 07 12': 'event', '6 1 01 03': 'event', '6 1 07 07': 'event',
  '6 1 07 15': 'pajak', '6 1 07 16': 'pajak',
  '6 1 01 02': 'bank', '6 1 07 09': 'bank',
}
const PER_AWALAN: [string, keyof typeof KELOMPOK][] = [
  ['6 1 02', 'sdm'], ['6 1 03', 'gedung'], ['6 1 01', 'promosi'], ['6 1 06', 'rawat'], ['6 1 05', 'teknologi'],
]
function kelompokDari(grup: Akun['grup'], kode: string, nama: string): keyof typeof KELOMPOK {
  if (grup === 'HPP') return 'hpp'
  const k = kode.replace(/\s+/g, ' ').trim()
  if (PER_AKUN[k]) return PER_AKUN[k]
  const a = PER_AWALAN.find(([p]) => k.startsWith(p))
  if (a) return a[1]
  // accounts without the usual code: guess from the name
  const n = nama.toLowerCase()
  if (/salary|gaji|thr|bonus|bpjs|staff|partime/.test(n)) return 'sdm'
  if (/event|decoration/.test(n)) return 'event'
  if (/tax|pajak|pb ?1/.test(n)) return 'pajak'
  if (/utilit|rental|sewa|cleaning/.test(n)) return 'gedung'
  return 'lain'
}

// ─── one index over all years: figures per month, accounts per month ──
interface Akun { kunci: string, grup: 'HPP' | 'Operasional' | 'Depresiasi', kel: keyof typeof KELOMPOK, kode: string, nama: string, v: Record<string, number> }
const GRUP: [string, Akun['grup']][] = [['cogs', 'HPP'], ['operationalExpenses', 'Operasional'], ['depreciationAmortizationExpenses', 'Depresiasi']]
const indeks = computed(() => {
  const angka: Record<string, PlAngka> = {}
  const akun = new Map<string, Akun>()
  for (const d of laporan.value) {
    for (const [k, a] of Object.entries(d!.ringkasan.perPeriode)) {
      const id = idDariKey(k)
      if (id) angka[id] = a
    }
    for (const [sec, grup] of GRUP) {
      for (const a of d!.sections[sec]?.accounts ?? []) {
        const kunci = `${grup}|${a.account || a.description}`
        const nama = a.description || a.account || '(tanpa nama)'
        const x = akun.get(kunci) ?? { kunci, grup, kel: kelompokDari(grup, a.account, nama), kode: a.account, nama, v: {} }
        for (const [k, n] of Object.entries(a.periods)) {
          const id = idDariKey(k)
          // ESB leaves rounding residue (Rp 0,40) on unused accounts: below Rp 1 is zero
          if (id) x.v[id] = Math.abs(n) < 1 ? 0 : Math.abs(n)
        }
        akun.set(kunci, x)
      }
    }
  }
  return { angka, akun: [...akun.values()] }
})
const bulanAda = computed(() => Object.keys(indeks.value.angka).sort())

// ─── range: one slider over every month we have; view per month or per year ──
const geserIdx = ref<number[]>([0, 0])
watch(bulanAda, (b) => {
  if (!b.length) return
  const akhir = b[b.length - 1]!
  const awal = b.findIndex(id => id.slice(0, 4) === akhir.slice(0, 4))
  geserIdx.value = [Math.max(0, awal), b.length - 1]
}, { immediate: true })
const rentang = computed(() => {
  const [a = 0, z = 0] = [...geserIdx.value].sort((x, y) => x - y)
  return bulanAda.value.slice(a, z + 1)
})
/** Plain-word presets (owner request: easy for anyone): each is a [from, to] month pair. */
const presetRentang = computed(() => {
  const b = bulanAda.value
  if (!b.length) return []
  const z = b[b.length - 1]!
  const th = Number(z.slice(0, 4))
  const ada = (ids: string[]) => ids.filter(id => b.includes(id))
  const tahun = (y: number) => ada(b.filter(id => id.startsWith(`${y}-`)))
  const out = [
    { value: 'bulan', label: `Bulan terakhir (${lblBulanTh(z)})`, ids: [z] },
    { value: '3bln', label: '3 bulan terakhir', ids: ada([geser(z, -2), geser(z, -1), z]) },
    { value: 'thIni', label: `Tahun ${th}`, ids: tahun(th) },
    { value: 'thLalu', label: `Tahun ${th - 1}`, ids: tahun(th - 1) },
    { value: 'semua', label: 'Semua data', ids: b },
  ]
  return out.filter(p => p.ids.length)
})
const presetAktif = computed({
  get: () => presetRentang.value.find(p => p.ids.join() === rentang.value.join())?.value ?? '',
  set: (v: string) => {
    const p = presetRentang.value.find(x => x.value === v)
    if (p) geserIdx.value = [bulanAda.value.indexOf(p.ids[0]!), bulanAda.value.indexOf(p.ids[p.ids.length - 1]!)]
  },
})
/** "Dari" / "Sampai" dropdowns, for any other range. */
const opsiBulan = computed(() => bulanAda.value.map(id => ({ value: id, label: `${BULAN[Number(id.slice(5)) - 1]} ${id.slice(0, 4)}` })))
const dariBulan = computed({
  get: () => rentang.value[0] ?? '',
  set: (v: string) => {
    const i = bulanAda.value.indexOf(v)
    geserIdx.value = [i, Math.max(i, geserIdx.value[1] ?? i)]
  },
})
const sampaiBulan = computed({
  get: () => rentang.value[rentang.value.length - 1] ?? '',
  set: (v: string) => {
    const i = bulanAda.value.indexOf(v)
    geserIdx.value = [Math.min(i, geserIdx.value[0] ?? i), i]
  },
})
const tampilan = ref<'bulan' | 'tahun'>('bulan')
const pilihanTampilan = [{ value: 'bulan' as const, label: 'Per bulan', icon: 'i-lucide-calendar-days' }, { value: 'tahun' as const, label: 'Per tahun', icon: 'i-lucide-calendar-range' }]

/** Columns of the chart and the table: one month each, or one year (only the months inside the range). */
const periode = computed(() => {
  const r = rentang.value
  const banyakTahun = new Set(r.map(id => id.slice(0, 4))).size > 1
  if (tampilan.value === 'bulan') return r.map(id => ({ id, label: banyakTahun ? `${lblBulan(id)} ${id.slice(2, 4)}` : lblBulan(id), judul: lblBulanTh(id), ids: [id] }))
  const per = new Map<string, string[]>()
  for (const id of r) per.set(id.slice(0, 4), [...(per.get(id.slice(0, 4)) ?? []), id])
  return [...per.entries()].map(([th, ids]) => ({ id: th, label: ids.length === 12 ? th : `${th} (${lblRentang(ids).replace(` ${th}`, '')})`, judul: lblRentang(ids), ids }))
})

// ─── comparison: always the same months one year earlier ──
const rentangBanding = computed(() => rentang.value.map(id => geser(id, -12)))
const bandingAda = computed(() => rentangBanding.value.filter(id => indeks.value.angka[id]))
const bandingLengkap = computed(() => bandingAda.value.length === rentangBanding.value.length)

const NOL: PlAngka = { penjualanBersih: 0, danaKeluar: 0, hpp: 0, operasional: 0, ebitda: 0, depresiasi: 0, ebit: 0 }
const jumlahAngka = (ids: string[]) => ids.reduce<PlAngka>((s, id) => {
  const a = indeks.value.angka[id]
  if (!a) return s
  return Object.fromEntries(Object.keys(NOL).map(k => [k, s[k as keyof PlAngka] + a[k as keyof PlAngka]])) as unknown as PlAngka
}, { ...NOL })
const t = computed(() => jumlahAngka(rentang.value))
const tb = computed(() => (bandingAda.value.length ? jumlahAngka(bandingAda.value) : null))
const jumlahAkun = (a: Akun, ids: string[]) => ids.reduce((s, id) => s + (a.v[id] ?? 0), 0)

// ─── change badges ──
const pct = (x: number, total: number) => (total ? `${(x / total * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : '—')
const ubahPct = (kini: number, dulu: number): number | null => (dulu ? (kini - dulu) / Math.abs(dulu) * 100 : null)
/** For a cost a rise is bad (red); for EBITDA/EBIT/sales a rise is good. */
const lencana = (kini: number, dulu: number | null | undefined, naikBaik = false) => {
  if (dulu == null || (!dulu && !kini)) return null
  if (!dulu) return { teks: 'baru', warna: naikBaik ? 'success' : 'warning' } as const
  const v = ubahPct(kini, dulu)!
  if (Math.abs(v) < 0.05) return { teks: '0%', warna: 'neutral' } as const
  const naik = v > 0
  const angkaPct = Math.abs(v) >= 1000 ? '>999' : Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return { teks: `${naik ? '▲' : '▼'} ${angkaPct}%`, warna: naik === naikBaik ? 'success' : 'error' } as const
}
const nadaLencana = (l: ReturnType<typeof lencana>) => (l?.warna === 'success' ? 'success' : l?.warna === 'error' ? 'error' : 'neutral')
const subBanding = (dulu: number | undefined) => (tb.value && dulu !== undefined ? `${lblRentang(bandingAda.value)}: ${rupiah(dulu)}` : '')

// ─── per-period table ──
const baris = computed(() => periode.value.map(p => ({ ...p, ...jumlahAngka(p.ids) })))

// ─── cost chart ──
const modeGrafik = ref<'bar' | 'titik' | 'angka'>('bar')
const pilihanMode = [{ value: 'bar' as const, label: 'Bar', icon: 'i-lucide-chart-column' }, { value: 'titik' as const, label: 'Titik', icon: 'i-lucide-chart-scatter' }, { value: 'angka' as const, label: 'Angka', icon: 'i-lucide-table' }]
/** One cost line at a time (owner: stacked bars were hard to read). */
interface SeriGrafik { value: string, label: string, warna: string, nilai: (ids: string[]) => number, naikBaik?: boolean, kel?: string }
const opsiSeri = computed<SeriGrafik[]>(() => [
  { value: 'jual', label: 'Penjualan bersih', warna: 'var(--ui-success)', naikBaik: true, kel: 'Pendapatan & laba', nilai: ids => jumlahAngka(ids).penjualanBersih },
  { value: 'ebitda', label: 'EBITDA', warna: 'var(--color-brand-teal)', naikBaik: true, kel: 'Pendapatan & laba', nilai: ids => jumlahAngka(ids).ebitda },
  { value: 'ebit', label: 'EBIT (laba operasional)', warna: 'var(--color-gold-deep)', naikBaik: true, kel: 'Pendapatan & laba', nilai: ids => jumlahAngka(ids).ebit },
  { value: 'dana', label: 'Total dana keluar', warna: 'var(--ui-error)', nilai: ids => jumlahAngka(ids).danaKeluar },
  { value: 'hpp', label: 'HPP', warna: 'var(--color-gold)', nilai: ids => jumlahAngka(ids).hpp },
  { value: 'ops', label: 'Operasional', warna: 'var(--color-brand-blue)', nilai: ids => jumlahAngka(ids).operasional },
  { value: 'dep', label: 'Depresiasi', warna: 'var(--ui-text-muted)', nilai: ids => jumlahAngka(ids).depresiasi },
  ...kelompokKeluar.value.filter(k => k.kel !== 'hpp').map(k => ({
    value: `k:${k.kel}`, label: k.nama, warna: k.warna,
    nilai: (ids: string[]) => k.akun.reduce((s, a) => s + jumlahAkun(a, ids), 0),
  })),
])
const seriPilih = ref('jual')
/** Dropdown items with a heading per kind (Nuxt UI: an array of groups). */
const itemSeri = computed(() => {
  const laba = opsiSeri.value.filter(s => s.naikBaik)
  const biaya = opsiSeri.value.filter(s => !s.naikBaik)
  return [
    [{ type: 'label' as const, label: 'Pendapatan & laba' }, ...laba.map(s => ({ value: s.value, label: s.label }))],
    [{ type: 'label' as const, label: 'Biaya' }, ...biaya.map(s => ({ value: s.value, label: s.label }))],
  ]
})
const seri = computed(() => opsiSeri.value.find(s => s.value === seriPilih.value) ?? opsiSeri.value[0]!)
const nilaiGrafik = computed(() => periode.value.map(p => seri.value.nilai(p.ids)))

// ─── grouped accounts ──
const urutan = ref<'nilai' | 'naik'>('nilai')
const urut = <X extends { nilai: number, dulu: number | null }>(xs: X[]) =>
  xs.sort((a, b) => (urutan.value === 'naik' && tb.value ? (b.nilai - (b.dulu ?? 0)) - (a.nilai - (a.dulu ?? 0)) : b.nilai - a.nilai))
const barisAkun = (grup: Akun['grup'][]) => urut(indeks.value.akun
  .filter(a => grup.includes(a.grup))
  .map(a => ({ ...a, nilai: jumlahAkun(a, rentang.value), dulu: tb.value ? jumlahAkun(a, bandingAda.value) : null }))
  .filter(a => a.nilai || a.dulu))
const kelompokKeluar = computed(() => {
  const akun = barisAkun(['HPP', 'Operasional'])
  const per = new Map<string, typeof akun>()
  for (const a of akun) per.set(a.kel, [...(per.get(a.kel) ?? []), a])
  return urut([...per.entries()].map(([kel, xs]) => ({
    kel, ...KELOMPOK[kel]!, akun: xs,
    nilai: xs.reduce((s, a) => s + a.nilai, 0),
    dulu: tb.value ? xs.reduce((s, a) => s + (a.dulu ?? 0), 0) : null,
  })))
})
const akunDepresiasi = computed(() => barisAkun(['Depresiasi']))
const terbuka = ref<Set<string>>(new Set())
function bukaKelompok(k: string) {
  const s = new Set(terbuka.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  terbuka.value = s
}
const nilaiKel = (k: { akun: Akun[] }, ids: string[]) => k.akun.reduce((s, a) => s + jumlahAkun(a, ids), 0)
/** '▲ 12%' under a cell; nothing when there is nothing to compare. */
const ubahKecil = (kini: number, dulu: number) => {
  if (!dulu) return ''
  const v = (kini - dulu) / Math.abs(dulu) * 100
  if (Math.abs(v) < 0.5) return ''
  return `${v > 0 ? '▲' : '▼'} ${Math.abs(v) >= 1000 ? '>999' : Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%`
}

/** CSV of the range: every account with its group, months, the comparison and the change. */
function unduhCsv() {
  const r = rentang.value
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
  const kepala = ['Kelompok', 'Jenis', 'Kode', 'Nama akun', ...r.map(lblBulanTh), `Total ${lblRentang(r)}`]
  if (tb.value) kepala.push(`Pembanding ${lblRentang(bandingAda.value)}`, 'Selisih', 'Perubahan %')
  const semua = [...kelompokKeluar.value.flatMap(k => k.akun), ...akunDepresiasi.value]
  const isi = semua.map((a) => {
    const row: (string | number)[] = [a.grup === 'Depresiasi' ? 'Depresiasi' : KELOMPOK[a.kel]!.nama, a.grup, a.kode, a.nama, ...r.map(id => Math.round(a.v[id] ?? 0)), Math.round(a.nilai)]
    if (tb.value) {
      const p = ubahPct(a.nilai, a.dulu ?? 0)
      row.push(Math.round(a.dulu ?? 0), Math.round(a.nilai - (a.dulu ?? 0)), p === null ? '' : p.toFixed(1))
    }
    return row.map(q).join(';')
  })
  const blob = new Blob([String.fromCharCode(0xFEFF) + `${[kepala.map(q).join(';'), ...isi].join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url
  el.download = `pengeluaran-${r[0]}_${r[r.length - 1]}.csv`
  el.click()
  URL.revokeObjectURL(url)
}

defineExpose({ refreshEsb, unduhCsv, merefresh, adaData, rentang })
</script>

<template>
  <div>
    <!-- filter in plain words: 1) what period, 2) show per month or per year -->
    <div class="flex flex-col gap-5 rounded-panel bg-default p-5 shadow-panel sm:p-6">
      <div
        v-if="bulanAda.length"
        class="flex flex-col gap-5"
      >
        <div>
          <p class="mb-2 font-semibold">
            1. Mau lihat periode apa?
          </p>
          <AppChips
            v-model="presetAktif"
            :options="presetRentang.map(p => ({ value: p.value, label: p.label }))"
          />
          <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span class="text-muted">atau pilih sendiri: dari</span>
            <USelect
              v-model="dariBulan"
              :items="opsiBulan"
              class="w-44"
              aria-label="Dari bulan"
            />
            <span class="text-muted">sampai</span>
            <USelect
              v-model="sampaiBulan"
              :items="opsiBulan"
              class="w-44"
              aria-label="Sampai bulan"
            />
          </div>
        </div>
        <div>
          <p class="mb-2 font-semibold">
            2. Tampilkan angkanya
          </p>
          <AppSeg
            v-model="tampilan"
            :options="pilihanTampilan"
          />
        </div>
        <div class="rounded-field bg-muted px-4 py-3 text-sm">
          Kamu sedang melihat <b>{{ lblRentang(rentang) }}</b> ({{ rentang.length }} bulan),
          {{ tampilan === 'bulan' ? 'dirinci per bulan' : 'dijumlah per tahun' }}.
          <template v-if="tb">
            Angka naik/turun dibandingkan dengan <b>{{ lblRentang(bandingAda) }}</b><template v-if="!bandingLengkap">
              (sebagian bulan saja)
            </template>.
          </template>
          <template v-else>
            Tidak ada data tahun lalu untuk dibandingkan.
          </template>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span class="text-muted">Sumber: ESB Core · Laba Rugi bulan ke bulan</span>
        <span class="flex-1" />
        <span v-if="terakhir">Terakhir di-refresh <b>{{ waktu(terakhir.diambil) }}</b> oleh {{ terakhir.oleh || '—' }}</span>
        <span
          v-else-if="status === 'success'"
          class="text-muted"
        >Belum pernah di-refresh dari ESB.</span>
        <UButton
          v-if="riwayat.length"
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="lihatRiwayat ? 'i-lucide-chevron-up' : 'i-lucide-history'"
          :label="lihatRiwayat ? 'Tutup riwayat' : `Riwayat refresh (${riwayat.length})`"
          @click="lihatRiwayat = !lihatRiwayat"
        />
      </div>
      <ol
        v-if="lihatRiwayat"
        class="divide-y divide-default rounded-panel border border-default text-sm"
      >
        <li
          v-for="(r, i) in riwayat"
          :key="i"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
        >
          <UIcon
            :name="r.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
            :class="r.ok ? 'text-success' : 'text-error'"
          />
          <span class="tabular-nums">{{ waktu(r.waktu) }}</span>
          <UBadge
            :label="String(r.tahun)"
            variant="subtle"
            color="neutral"
          />
          <span class="text-muted">oleh {{ r.oleh || '—' }}</span>
          <span
            v-if="!r.ok"
            class="min-w-0 flex-1 truncate text-error"
            :title="r.pesan"
          >Gagal: {{ r.pesan }}</span>
        </li>
      </ol>
    </div>

    <UAlert
      v-if="gagalRefresh"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Refresh dari ESB gagal"
      :description="`${gagalRefresh}${adaData ? ' Angka di bawah masih dari refresh terakhir.' : ''}`"
      :close="true"
      @update:open="gagalRefresh = ''"
    />
    <AppPanel
      v-if="(status === 'pending' || merefresh) && !adaData"
      :title="merefresh ? 'Mengambil laporan dari ESB' : 'Memuat laporan tersimpan'"
      class="mt-6"
    >
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>
    <UAlert
      v-else-if="error"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Laporan tersimpan tidak bisa dibaca"
      :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
    />
    <AppPanel
      v-else-if="status === 'success' && !adaData"
      title="Belum ada laporan"
      class="mt-6"
    >
      <p
        v-if="bolehRefresh"
        class="text-muted"
      >
        Laporan Laba Rugi belum pernah diambil dari ESB. Tekan Refresh untuk mengambilnya; setelah itu halaman ini langsung menampilkannya tanpa menunggu ESB.
      </p>
      <p
        v-else
        class="text-muted"
      >
        Laporan Laba Rugi belum diambil dari ESB. Laporan ini di-refresh dari modul Analytics › Laba Rugi; setelah itu muncul di sini.
      </p>
      <UButton
        v-if="bolehRefresh"
        class="mt-4"
        label="Refresh dari ESB"
        icon="i-lucide-refresh-cw"
        :loading="merefresh"
        @click="refreshEsb"
      />
    </AppPanel>
    <template v-else-if="adaData">
      <AppStatGrid
        :count="5"
        class="mt-6"
      >
        <AppStat
          label="Omset"
          :value="rupiah(t.penjualanBersih)"
          icon="i-lucide-banknote"
          tone="success"
          :badge="lencana(t.penjualanBersih, tb?.penjualanBersih, true)?.teks"
          :badge-tone="nadaLencana(lencana(t.penjualanBersih, tb?.penjualanBersih, true))"
          :sub="`Penjualan bersih (setelah diskon)${tb ? ` · ${subBanding(tb.penjualanBersih)}` : ''}`"
        />
        <AppStat
          label="Dana Keluar"
          :value="rupiah(t.danaKeluar)"
          icon="i-lucide-wallet"
          tone="error"
          :badge="lencana(t.danaKeluar, tb?.danaKeluar)?.teks"
          :badge-tone="nadaLencana(lencana(t.danaKeluar, tb?.danaKeluar))"
          :sub="`HPP ${rupiah(t.hpp)} · Operasional ${rupiah(t.operasional)}${tb ? ` · ${subBanding(tb.danaKeluar)}` : ''}`"
        />
        <AppStat
          label="EBITDA"
          :value="rupiah(t.ebitda)"
          icon="i-lucide-trending-up"
          :tone="t.ebitda >= 0 ? 'success' : 'error'"
          :badge="lencana(t.ebitda, tb?.ebitda, true)?.teks"
          :badge-tone="nadaLencana(lencana(t.ebitda, tb?.ebitda, true))"
          :sub="`Margin ${pct(t.ebitda, t.penjualanBersih)} dari penjualan bersih${tb ? ` · ${subBanding(tb.ebitda)}` : ''}`"
        />
        <AppStat
          label="Depresiasi & Amortisasi"
          :value="rupiah(t.depresiasi)"
          icon="i-lucide-building"
          tone="info"
          :badge="lencana(t.depresiasi, tb?.depresiasi)?.teks"
          :badge-tone="nadaLencana(lencana(t.depresiasi, tb?.depresiasi))"
          :sub="`Beban non-tunai, tidak termasuk dana keluar${tb ? ` · ${subBanding(tb.depresiasi)}` : ''}`"
        />
        <AppStat
          label="EBIT (laba operasional)"
          :value="rupiah(t.ebit)"
          icon="i-lucide-calculator"
          tone="gold"
          :badge="lencana(t.ebit, tb?.ebit, true)?.teks"
          :badge-tone="nadaLencana(lencana(t.ebit, tb?.ebit, true))"
          :sub="`EBITDA − depresiasi & amortisasi · penjualan bersih ${rupiah(t.penjualanBersih)}`"
        />
      </AppStatGrid>

      <!-- one chart for every figure: sales, EBITDA, EBIT and the costs -->
      <AppPanel
        :title="`Grafik keuangan · ${tampilan === 'bulan' ? 'bulanan' : 'tahunan'}`"
        class="mt-6"
      >
        <div class="mb-5 flex flex-wrap items-end gap-4">
          <label class="flex flex-col gap-1.5 text-sm">
            <span class="font-semibold">Yang mau dilihat</span>
            <USelect
              v-model="seriPilih"
              :items="itemSeri"
              class="w-64"
            />
          </label>
          <div class="flex flex-col gap-1.5 text-sm">
            <span class="font-semibold">Bentuk</span>
            <AppSeg
              v-model="modeGrafik"
              size="sm"
              :options="pilihanMode"
            />
          </div>
        </div>
        <AnalyticsGrafikBiaya
          :kategori="periode.map(p => p.label)"
          :judul="periode.map(p => p.judul)"
          :nama="seri.label"
          :warna="seri.warna"
          :nilai="nilaiGrafik"
          :mode="modeGrafik"
          :naik-baik="seri.naikBaik"
        />
        <p class="mt-3 text-sm text-muted">
          Arahkan kursor (atau ketuk) ke {{ tampilan === 'bulan' ? 'bulan' : 'tahun' }} mana saja untuk melihat angka dan perubahannya. Kalau periodenya panjang, geser grafik ke samping.
        </p>
      </AppPanel>

      <AppPanel
        :title="`Per ${tampilan === 'bulan' ? 'bulan' : 'tahun'} · ${lblRentang(rentang)}`"
        class="mt-6"
      >
        <div class="mt-2 overflow-x-auto">
          <table class="w-full text-base">
            <thead class="text-left text-sm text-muted">
              <tr>
                <th class="px-3 py-3">
                  {{ tampilan === 'bulan' ? 'Bulan' : 'Tahun' }}
                </th>
                <th class="px-3 py-3 text-right">
                  Penjualan bersih
                </th>
                <th class="px-3 py-3 text-right">
                  Dana keluar
                </th>
                <th class="px-3 py-3 text-right">
                  EBITDA
                </th>
                <th class="px-3 py-3 text-right">
                  Depresiasi
                </th>
                <th class="px-3 py-3 text-right">
                  EBIT
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(b, i) in baris"
                :key="b.id"
                class="border-t border-default"
              >
                <td class="px-3 py-3.5 font-medium">
                  {{ b.judul }}
                </td>
                <td class="px-3 py-3.5 text-right tabular-nums">
                  {{ rupiah(b.penjualanBersih) }}
                </td>
                <td class="px-3 py-3.5 text-right tabular-nums">
                  {{ rupiah(b.danaKeluar) }}
                  <UBadge
                    v-if="i > 0 && lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)"
                    class="ml-1.5"
                    variant="subtle"
                    :color="lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)!.warna"
                    :label="lencana(b.danaKeluar, baris[i - 1]!.danaKeluar)!.teks"
                  />
                </td>
                <td
                  class="px-3 py-3.5 text-right font-semibold tabular-nums"
                  :class="b.ebitda < 0 ? 'text-error' : 'text-success'"
                >
                  {{ rupiah(b.ebitda) }}
                  <UBadge
                    v-if="i > 0 && lencana(b.ebitda, baris[i - 1]!.ebitda, true)"
                    class="ml-1.5"
                    variant="subtle"
                    :color="lencana(b.ebitda, baris[i - 1]!.ebitda, true)!.warna"
                    :label="lencana(b.ebitda, baris[i - 1]!.ebitda, true)!.teks"
                  />
                </td>
                <td class="px-3 py-3.5 text-right tabular-nums text-muted">
                  {{ rupiah(b.depresiasi) }}
                </td>
                <td class="px-3 py-3.5 text-right tabular-nums">
                  {{ rupiah(b.ebit) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-3 text-sm text-muted">
            Persen di samping angka = perubahan dibanding {{ tampilan === 'bulan' ? 'bulan' : 'tahun' }} sebelumnya.
          </p>
        </div>
      </AppPanel>

      <div class="mt-6 grid gap-6">
        <AppPanel
          :title="`Dana keluar per kelompok · ${tampilan === 'bulan' ? 'per bulan' : 'per tahun'}`"
          :description="`${lblRentang(rentang)}. Klik kelompok untuk melihat akun di dalamnya.`"
        >
          <p
            v-if="!kelompokKeluar.length"
            class="text-muted"
          >
            Tidak ada beban HPP atau operasional.
          </p>
          <div
            v-else
            class="overflow-x-auto"
          >
            <table class="w-full border-separate border-spacing-0 text-sm">
              <thead class="text-muted">
                <tr>
                  <th class="sticky left-0 z-10 min-w-56 bg-default px-3 py-3 text-left">
                    Kelompok
                  </th>
                  <th
                    v-for="p in periode"
                    :key="p.id"
                    class="min-w-36 px-4 py-3 text-right whitespace-nowrap"
                  >
                    {{ p.judul }}
                  </th>
                  <th
                    v-if="periode.length > 1"
                    class="min-w-40 px-4 py-3 text-right"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <template
                  v-for="k in kelompokKeluar"
                  :key="k.kel"
                >
                  <tr
                    class="cursor-pointer hover:bg-elevated/60"
                    :aria-expanded="terbuka.has(k.kel)"
                    @click="bukaKelompok(k.kel)"
                  >
                    <td class="sticky left-0 z-10 border-t border-default bg-default px-3 py-3.5">
                      <span class="flex items-center gap-2.5">
                        <UIcon
                          :name="terbuka.has(k.kel) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                          class="shrink-0 text-muted"
                        />
                        <span
                          class="size-3 shrink-0 rounded-sm"
                          :style="{ background: k.warna }"
                        />
                        <span class="font-semibold">{{ k.nama }}</span>
                        <span class="text-xs text-muted">{{ pct(k.nilai, t.danaKeluar) }}</span>
                      </span>
                    </td>
                    <td
                      v-for="(p, i) in periode"
                      :key="p.id"
                      class="border-t border-default px-4 py-3.5 text-right tabular-nums"
                    >
                      {{ rupiah(nilaiKel(k, p.ids)) }}
                      <span
                        v-if="i > 0 && ubahKecil(nilaiKel(k, p.ids), nilaiKel(k, periode[i - 1]!.ids))"
                        class="block text-xs"
                        :class="nilaiKel(k, p.ids) > nilaiKel(k, periode[i - 1]!.ids) ? 'text-error' : 'text-success'"
                      >{{ ubahKecil(nilaiKel(k, p.ids), nilaiKel(k, periode[i - 1]!.ids)) }}</span>
                    </td>
                    <td
                      v-if="periode.length > 1"
                      class="border-t border-default px-4 py-3.5 text-right font-semibold tabular-nums"
                    >
                      {{ rupiah(k.nilai) }}
                    </td>
                  </tr>
                  <template v-if="terbuka.has(k.kel)">
                    <tr
                      v-for="a in k.akun"
                      :key="a.kunci"
                      class="text-muted"
                    >
                      <td
                        class="sticky left-0 z-10 max-w-72 truncate border-t border-default bg-default py-2.5 pr-3 pl-12"
                        :title="`${a.kode} ${a.nama}`"
                      >
                        {{ a.nama }}
                      </td>
                      <td
                        v-for="p in periode"
                        :key="p.id"
                        class="border-t border-default px-4 py-2.5 text-right tabular-nums"
                      >
                        {{ rupiah(jumlahAkun(a, p.ids)) }}
                      </td>
                      <td
                        v-if="periode.length > 1"
                        class="border-t border-default px-4 py-2.5 text-right tabular-nums"
                      >
                        {{ rupiah(a.nilai) }}
                      </td>
                    </tr>
                  </template>
                </template>
                <tr class="font-semibold">
                  <td class="sticky left-0 z-10 border-t-2 border-default bg-default px-3 py-3.5">
                    Total dana keluar
                  </td>
                  <td
                    v-for="p in periode"
                    :key="p.id"
                    class="border-t-2 border-default px-4 py-3.5 text-right tabular-nums"
                  >
                    {{ rupiah(jumlahAngka(p.ids).danaKeluar) }}
                  </td>
                  <td
                    v-if="periode.length > 1"
                    class="border-t-2 border-default px-4 py-3.5 text-right tabular-nums"
                  >
                    {{ rupiah(t.danaKeluar) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-3 text-sm text-muted">
            Angka kecil merah/hijau = naik/turun dibanding {{ tampilan === 'bulan' ? 'bulan' : 'tahun' }} sebelumnya. Kolom pertama tetap di tempat saat tabel digeser.
          </p>
        </AppPanel>
        <AppPanel :title="`Depresiasi & amortisasi · ${lblRentang(rentang)}`">
          <p
            v-if="!akunDepresiasi.length"
            class="text-muted"
          >
            Tidak ada beban depresiasi di periode ini.
          </p>
          <ul
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="a in akunDepresiasi"
              :key="a.kunci"
              class="flex items-center gap-4 py-3.5"
            >
              <span
                class="min-w-0 flex-1 truncate"
                :title="`${a.kode} ${a.nama}${tb ? ` · sebelumnya ${rupiah(a.dulu ?? 0)}` : ''}`"
              >{{ a.nama }}</span>
              <span class="shrink-0 tabular-nums">{{ rupiah(a.nilai) }}</span>
              <UBadge
                v-if="lencana(a.nilai, a.dulu)"
                variant="subtle"
                :color="lencana(a.nilai, a.dulu)!.warna"
                :label="lencana(a.nilai, a.dulu)!.teks"
              />
            </li>
          </ul>
          <p class="mt-4 text-sm text-muted">
            Depresiasi bukan uang yang keluar dari kas; ia hanya menurunkan nilai aset di pembukuan.
          </p>
        </AppPanel>
      </div>
    </template>
  </div>
</template>
