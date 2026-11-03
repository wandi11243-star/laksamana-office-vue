<!--
  Stock › Purchasing › Rekap Per Bulan (old `deploy/stock/purchasing/index.html:188-189,660-710`).

  Pixel parity with the old "Rekap & Analitik Order Bulanan":
  month picker (`:2534-2546`), 5 KPIs + MoM deltas (`:2611-2663`),
  6-month trend SVG (`:2666-2696`), per-day pattern (`:2699-2727`),
  vendor concentration (`:2730-2755`), team donut (`:2758-2798`), and the
  recap table with 4-month sparklines + movers (`:2801-2905`).

  Old gold/blue/grey fills → token bridge (no hex is allowed in components,
  so every SVG shape uses fill/stroke="currentColor" with a token text
  class): old dark gold → yellow-deep, old pale gold → sand-light, old
  weekend gold → brand-yellow, old blue → info, old grey → dimmed/ink-300,
  old sparkline red → error, old sparkline green → success.

  Still client-side over `listOrders()` + `useProdukStock`, filtered by the
  `timestamp` YYYY-MM substring (never `tglDatang`). K-06: the forecast
  payload does not exist yet, so the attention KPI is 0 and every stock
  badge waits for it (neutral "menunggu data prakiraan"), ready to be
  filled in later without touching the layout.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { KruStock, OrderStock } from '~/composables/useStock'
import { listKruStock, listOrders, useProdukStock } from '~/composables/useStock'
import { angka, BULAN, hariIni } from '~/utils/format'

definePageMeta({ access: ['purchasing'] })

const bulan = ref(hariIni().slice(0, 7))
const pilihanBulan = computed(() => {
  const out: { value: string, label: string }[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < 12; i++) {
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${BULAN[d.getMonth()]} ${d.getFullYear()}`,
    })
    d.setMonth(d.getMonth() - 1)
  }
  return out
})

const ordersQ = useAsyncData('stock-overview', () => listOrders(), {
  default: () => ({ rows: [] as OrderStock[], versions: {} }),
})
const produkQ = useProdukStock()
const kruQ = useAsyncData('stock-overview-kru', () => listKruStock('users'), {
  default: () => ({ rows: [] as KruStock[], versions: {} }),
})
const memuat = computed(() => ordersQ.pending.value || produkQ.pending.value || kruQ.pending.value)

const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const geserBulan = (b: string, n: number) => {
  const d = new Date(`${b}-01T00:00:00`)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** Old `recapMonthStr`: the recap reads the submit stamp, not the arrival date. */
const blnOf = (o: OrderStock) => (o.timestamp || '').slice(0, 7)
const utamaOf = (item: string) => produkQ.data.value?.rows.find(p => p.nama === item)?.utama || ''
const vendorOf = (item: string) => utamaOf(item) || 'Tak Terdaftar'

const bukanCk = (o: OrderStock) => (o.batchName || '') !== 'Central Kitchen'
const semua = computed(() => (ordersQ.data.value?.rows ?? []).filter(bukanCk))
const dalamBulan = (rows: OrderStock[], b: string) => rows.filter(o => blnOf(o) === b)
const bulanIni = computed(() => dalamBulan(semua.value, bulan.value))
const bulanLalu = computed(() => dalamBulan(semua.value, geserBulan(bulan.value, -1)))
const jmlQty = (list: OrderStock[]) => list.reduce((a, o) => a + (Number(o.qty) || 0), 0)

interface Ringkas { qty: number, unit: string, freq: number }
/** Old `summarizeOrders`: one row per item with summed qty, first unit, order count. */
const ringkasOrders = (list: OrderStock[]) => {
  const peta: Record<string, Ringkas> = {}
  for (const o of list) {
    let r = peta[o.item]
    if (!r) {
      r = { qty: 0, unit: o.unit, freq: 0 }
      peta[o.item] = r
    }
    r.qty += Number(o.qty) || 0
    r.freq += 1
  }
  return peta
}

/** Old `recapUnitShort`: short unit so cards and tables stay compact. */
const unitRingkas = (u?: string) => {
  const s = String(u || '').toLowerCase()
  if (s.includes('gram') && !s.includes('kilo')) return 'gr'
  if (s.includes('kg') || s.includes('kilo')) return 'kg'
  if (s.includes('ml') || s.includes('mili')) return 'ml'
  if (s.includes('liter') || s === 'l') return 'L'
  if (s.includes('pcs') || s.includes('buah')) return 'pcs'
  return u || ''
}

/**
 * Old `recapDeltaChip`. The colour language is deliberately inverted:
 * up = red (buying more = cost up), down = green (saving). Same red/green
 * the table badges use below.
 */
const deltaInfo = (kini: number, lalu: number) => {
  if (lalu === 0 && kini === 0) return { teks: 'Belum ada data', cls: 'text-dimmed' }
  if (lalu === 0) return { teks: 'Baru bulan ini', cls: 'text-muted' }
  const selisih = kini - lalu
  if (selisih === 0) return { teks: '= Stabil', cls: 'text-muted' }
  const persen = Math.round(selisih / lalu * 100)
  return selisih > 0
    ? { teks: `↗ +${persen}% vs bln lalu`, cls: 'text-error' }
    : { teks: `↘ ${persen}% vs bln lalu`, cls: 'text-success' }
}

const kpi = computed(() => {
  const kini = ringkasOrders(bulanIni.value)
  const lalu = ringkasOrders(bulanLalu.value)
  const qtyKini = jmlQty(bulanIni.value)
  const qtyLalu = jmlQty(bulanLalu.value)
  const unikKini = Object.keys(kini).length
  const unikLalu = Object.keys(lalu).length
  const vendKini = new Set(bulanIni.value.map(o => utamaOf(o.item)).filter(Boolean)).size
  const vendLalu = new Set(bulanLalu.value.map(o => utamaOf(o.item)).filter(Boolean)).size
  return {
    qty: { nilai: Math.round(qtyKini), delta: deltaInfo(qtyKini, qtyLalu) },
    baris: { nilai: bulanIni.value.length, delta: deltaInfo(bulanIni.value.length, bulanLalu.value.length) },
    unik: { nilai: unikKini, delta: deltaInfo(unikKini, unikLalu) },
    vendor: { nilai: vendKini, delta: deltaInfo(vendKini, vendLalu) },
  }
})
/**
 * Old attention KPI counted items whose forecast status key is 'order' or
 * 'soon'. The forecast payload (K-06) is not in the new API yet, so this
 * stays 0/"aman" and the table badges wait below — no new list is built.
 */
const perhatianSub = 'Semua bahan bulan ini stoknya aman.'

/** Old `renderTrendChart`: summed qty per month over [selected-5 … selected]. */
const tren = computed(() => {
  const daftar = []
  for (let i = 5; i >= 0; i--) {
    const b = geserBulan(bulan.value, -i)
    daftar.push({ bulan: b, total: jmlQty(dalamBulan(semua.value, b)) })
  }
  return daftar
})
const trenGrafik = computed(() => {
  const W = 480
  const H = 220
  const padB = 30
  const padT = 12
  const padL = 8
  const padR = 8
  const plotH = H - padB - padT
  const plotW = W - padL - padR
  const bw = plotW / 6
  const maks = Math.max(1, ...tren.value.map(t => t.total))
  const batang = tren.value.map((t, i) => {
    const thn = t.bulan.slice(0, 4)
    const bln = Number(t.bulan.slice(5, 7))
    const bh = t.total / maks * plotH
    const cx = padL + i * bw + bw * 0.5
    return {
      bulan: t.bulan,
      total: t.total,
      judul: `${NAMA_BLN[bln - 1]} ${thn}: ${Math.round(t.total).toLocaleString('id-ID')}`,
      blnSingkat: NAMA_BLN[bln - 1],
      x: padL + i * bw + bw * 0.18,
      y: padT + plotH - bh,
      lebar: bw * 0.64,
      tinggi: bh,
      cx,
      cy: padT + plotH - (t.total / maks) * plotH,
      aktif: t.bulan === bulan.value,
      nilai: t.total >= 1000 ? `${(t.total / 1000).toFixed(1)}k` : String(Math.round(t.total)),
    }
  })
  return {
    W,
    H,
    batang,
    titik: batang.map(b => `${b.cx.toFixed(1)},${b.cy.toFixed(1)}`).join(' '),
    kosong: tren.value.every(t => t.total === 0),
  }
})

/** Old `renderDowChart`: AVERAGE qty per order (not total), weekend highlighted. */
const dow = computed(() => {
  const total = [0, 0, 0, 0, 0, 0, 0]
  const cacah = [0, 0, 0, 0, 0, 0, 0]
  for (const o of bulanIni.value) {
    const norm = (o.timestamp || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(norm)) continue
    const d = new Date(`${norm}T00:00:00`)
    if (Number.isNaN(+d)) continue
    const idx = (d.getDay() + 6) % 7 // 0 = Senin
    total[idx] = (total[idx] ?? 0) + (Number(o.qty) || 0)
    cacah[idx] = (cacah[idx] ?? 0) + 1
  }
  const rata = total.map((s, i) => ((cacah[i] ?? 0) ? s / (cacah[i] ?? 1) : 0))
  const maks = Math.max(1, ...rata)
  const W = 480
  const H = 200
  const padB = 26
  const padT = 14
  const plotH = H - padB - padT
  const bw = (W - 16) / 7
  const batang = rata.map((v, i) => {
    const bh = v / maks * plotH
    const x = 8 + i * bw + bw * 0.2
    return {
      nama: NAMA_HARI[i],
      rata: v,
      n: cacah[i] ?? 0,
      akhirPekan: i >= 5,
      judul: `${NAMA_HARI[i]}: rata-rata ${Math.round(v).toLocaleString('id-ID')} / order (${cacah[i] ?? 0} order)`,
      x,
      y: padT + plotH - bh,
      lebar: bw * 0.6,
      tinggi: bh,
      cx: x + bw * 0.3,
      labelY: padT + plotH - bh - 5,
      nilai: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)),
    }
  })
  return { W, H, batang, kosong: cacah.every(c => c === 0) }
})

/**
 * Old vendor palette → token: dark gold → yellow-deep, gold → brand-yellow,
 * deep gold → yellow-dark, tan → sand-light, blue → info,
 * purple → vip, grey → ink-300. 'Tak Terdaftar' stays muted like the old page.
 */
const PALET_VENDOR = ['bg-yellow-deep', 'bg-brand-yellow', 'bg-yellow-dark', 'bg-sand-light', 'bg-info', 'bg-vip', 'bg-ink-300']
const vendor = computed(() => {
  const agg = new Map<string, number>()
  for (const o of bulanIni.value) {
    const v = vendorOf(o.item)
    agg.set(v, (agg.get(v) ?? 0) + (Number(o.qty) || 0))
  }
  const total = [...agg.values()].reduce((a, b) => a + b, 0)
  const baris = [...agg.entries()]
    .map(([nama, qty]) => ({
      nama,
      qty,
      pangsa: total ? Math.round(qty / total * 100) : 0,
      bisu: nama === 'Tak Terdaftar',
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 7)
  const maks = Math.max(1, ...baris.map(r => r.qty))
  return {
    total,
    kosong: baris.length === 0 || total === 0,
    baris: baris.map((r, i) => ({
      ...r,
      lebar: Math.max(3, r.qty / maks * 100),
      warna: PALET_VENDOR[i % PALET_VENDOR.length] ?? 'bg-ink-300',
    })),
  }
})

/** Old `ketOf`: PIC → keterangan from the crew list (Kitchen/Bar/Floor/Lainnya). */
const ketOf = (pic?: string) => {
  if (!pic) return 'Lainnya'
  const kru = (kruQ.data.value?.rows ?? []).find(k => k.name.toLowerCase() === pic.toLowerCase())
  return kru?.keterangan || 'Lainnya'
}
/** Old team colours → token: Kitchen gold → yellow-deep, Bar gold → brand-yellow, Floor blue → info, Lainnya grey → dimmed/ink-300. */
const WARNA_TIM: Record<string, { teks: string, latar: string }> = {
  Kitchen: { teks: 'text-yellow-deep', latar: 'bg-yellow-deep' },
  Bar: { teks: 'text-brand-yellow', latar: 'bg-brand-yellow' },
  Floor: { teks: 'text-info', latar: 'bg-info' },
  Lainnya: { teks: 'text-dimmed', latar: 'bg-ink-300' },
}
const CADANGAN_TIM = [
  { teks: 'text-vip', latar: 'bg-vip' },
  { teks: 'text-moss-dark', latar: 'bg-teal-light' },
  { teks: 'text-coral-dark', latar: 'bg-coral-light' },
  { teks: 'text-blue-pressed', latar: 'bg-sky-light' },
]
const warnaTim = (nama: string, i: number) =>
  WARNA_TIM[nama] ?? CADANGAN_TIM[i % CADANGAN_TIM.length] ?? { teks: 'text-dimmed', latar: 'bg-ink-300' }

/** Old `renderTeamChart`: summed qty per team; drawn as SVG stroke-dasharray segments with an HTML centre label. */
const timGrafik = computed(() => {
  const agg = new Map<string, number>()
  for (const o of bulanIni.value) {
    const t = ketOf(o.pic)
    agg.set(t, (agg.get(t) ?? 0) + (Number(o.qty) || 0))
  }
  const baris = [...agg.entries()]
    .map(([nama, qty]) => ({ nama, qty }))
    .sort((a, b) => b.qty - a.qty)
  const total = baris.reduce((a, r) => a + r.qty, 0)
  let awal = 0
  const segmen = baris.map((r, i) => {
    const persen = total ? r.qty / total * 100 : 0
    const s = { ...r, persen, awal, ...warnaTim(r.nama, i) }
    awal += persen
    return s
  })
  return { segmen, total, kosong: baris.length === 0 || total === 0 }
})
const timTotalRingkas = computed(() => {
  const t = timGrafik.value.total
  return t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(Math.round(t))
})

/**
 * Old `recapSparkline`: qty polyline over 4 points; the end dot follows the
 * table language — old red up → error token, old green down → success token,
 * old grey flat → dimmed token.
 */
const sparkGaris = (seri: number[]) => {
  const maks = Math.max(1, ...seri)
  const W = 64
  const H = 20
  const langkah = seri.length > 1 ? W / (seri.length - 1) : 0
  const xy = seri.map((v, i) => ({
    x: i * langkah,
    y: H - v / maks * (H - 3) - 1.5,
  }))
  const akhir = seri[seri.length - 1] ?? 0
  const sblm = seri[seri.length - 2] ?? 0
  return {
    titik: xy.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    warna: akhir > sblm ? 'text-error' : akhir < sblm ? 'text-success' : 'text-dimmed',
    lx: xy[xy.length - 1]?.x ?? 0,
    ly: xy[xy.length - 1]?.y ?? 0,
  }
}

interface BarisRekap {
  item: string
  freq: number
  spark: number[]
  qty: number
  unit: string
  selisih: number
  badge: 'Baru' | 'Naik' | 'Turun' | 'Stabil'
}
/** Old `renderRecapTable`: qty-desc rows, absolute diff, Naik/Turun/Baru/Stabil badges. */
const rekap = computed<BarisRekap[]>(() => {
  const kini = ringkasOrders(bulanIni.value)
  const lalu = ringkasOrders(bulanLalu.value)
  const rentang = [3, 2, 1, 0].map(i => geserBulan(bulan.value, -i))
  const seri: Record<string, Record<string, number>> = {}
  for (const m of rentang) {
    for (const o of dalamBulan(semua.value, m)) {
      let per = seri[o.item]
      if (!per) {
        per = {}
        seri[o.item] = per
      }
      per[m] = (per[m] ?? 0) + (Number(o.qty) || 0)
    }
  }
  return Object.entries(kini)
    .map(([item, r]) => {
      const qtyLalu = lalu[item]?.qty ?? 0
      const d = r.qty - qtyLalu
      return {
        item,
        freq: r.freq,
        spark: rentang.map(m => seri[item]?.[m] ?? 0),
        qty: r.qty,
        unit: unitRingkas(r.unit),
        selisih: d,
        badge: (qtyLalu === 0 ? 'Baru' : d > 0 ? 'Naik' : d < 0 ? 'Turun' : 'Stabil') as BarisRekap['badge'],
      }
    })
    .sort((a, b) => b.qty - a.qty)
})

const teksSelisih = (r: BarisRekap) => {
  if (r.badge === 'Baru') return `+${angka(Math.round(r.qty))} ${r.unit} (Baru)`.trim()
  if (r.badge === 'Naik') return `+${angka(Math.round(r.selisih))} ${r.unit} (Naik)`.trim()
  if (r.badge === 'Turun') return `-${angka(Math.round(Math.abs(r.selisih)))} ${r.unit} (Turun)`.trim()
  return '= Stabil'
}
const warnaSelisih = (b: BarisRekap['badge']): 'success' | 'error' | 'neutral' =>
  b === 'Turun' ? 'success' : b === 'Stabil' ? 'neutral' : 'error'

/** Old movers: the biggest absolute qty rise that has a previous month to compare. */
const penggerak = computed(() => {
  let top: { nama: string, selisih: number, unit: string } | null = null
  for (const r of rekap.value) {
    if (r.badge === 'Baru') continue
    if (!top || r.selisih > top.selisih) top = { nama: r.item, selisih: r.selisih, unit: r.unit }
  }
  return top && top.selisih > 0 ? top : null
})

const kolom: TableColumn<BarisRekap>[] = [
  { accessorKey: 'item', header: 'Bahan' },
  { accessorKey: 'freq', header: 'Frek' },
  { accessorKey: 'spark', header: 'Tren 4 bln' },
  { accessorKey: 'qty', header: 'Total qty' },
  { accessorKey: 'selisih', header: 'Selisih' },
  { accessorKey: 'badge', header: 'Status stok' },
]
</script>

<template>
  <AppPage
    title="Rekap Per Bulan"
    description="Rekap & analitik order bulanan"
  >
    <template #actions>
      <USelect
        v-model="bulan"
        :items="pilihanBulan"
        aria-label="Pilih bulan"
      />
    </template>

    <div
      v-if="memuat"
      class="flex flex-col gap-4"
    >
      <USkeleton class="h-28 w-full" />
      <div class="grid gap-4 lg:grid-cols-2">
        <USkeleton class="h-64 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>
    </div>

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Total qty"
          :value="angka(kpi.qty.nilai)"
          icon="i-lucide-boxes"
          tone="info"
        >
          <span
            class="text-[11px] font-bold"
            :class="kpi.qty.delta.cls"
          >{{ kpi.qty.delta.teks }}</span>
        </AppStat>
        <AppStat
          label="Baris order"
          :value="String(kpi.baris.nilai)"
          satuan="baris"
          icon="i-lucide-list"
          tone="gold"
        >
          <span
            class="text-[11px] font-bold"
            :class="kpi.baris.delta.cls"
          >{{ kpi.baris.delta.teks }}</span>
        </AppStat>
        <AppStat
          label="Bahan unik"
          :value="String(kpi.unik.nilai)"
          satuan="bahan"
          icon="i-lucide-tags"
          tone="vip"
        >
          <span
            class="text-[11px] font-bold"
            :class="kpi.unik.delta.cls"
          >{{ kpi.unik.delta.teks }}</span>
        </AppStat>
        <AppStat
          label="Vendor aktif"
          :value="String(kpi.vendor.nilai)"
          satuan="vendor"
          icon="i-lucide-store"
          tone="success"
        >
          <span
            class="text-[11px] font-bold"
            :class="kpi.vendor.delta.cls"
          >{{ kpi.vendor.delta.teks }}</span>
        </AppStat>
        <AppStat
          label="Perlu perhatian stok"
          value="0"
          satuan="bahan"
          icon="i-lucide-alert-triangle"
          tone="error"
        >
          <span>{{ perhatianSub }}</span>
        </AppStat>
      </AppStatGrid>

      <div class="grid gap-4 lg:grid-cols-2">
        <AppPanel title="Tren 6 bulan">
          <svg
            v-if="!trenGrafik.kosong"
            :viewBox="`0 0 ${trenGrafik.W} ${trenGrafik.H}`"
            class="w-full"
            role="img"
            aria-label="Tren qty order 6 bulan"
          >
            <g
              v-for="b in trenGrafik.batang"
              :key="b.bulan"
              :class="b.aktif ? 'text-yellow-deep' : 'text-sand-light'"
            >
              <rect
                :x="b.x"
                :y="b.y"
                :width="b.lebar"
                :height="b.tinggi"
                rx="4"
                fill="currentColor"
              >
                <title>{{ b.judul }}</title>
              </rect>
            </g>
            <polyline
              :points="trenGrafik.titik"
              fill="none"
              stroke="currentColor"
              class="text-yellow-deep"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
              opacity="0.85"
            />
            <g class="text-yellow-deep">
              <circle
                v-for="b in trenGrafik.batang"
                :key="b.bulan"
                :cx="b.cx"
                :cy="b.cy"
                r="3"
                fill="currentColor"
              />
            </g>
            <text
              v-for="b in trenGrafik.batang"
              :key="`v-${b.bulan}`"
              :x="b.cx"
              :y="b.cy - 6"
              text-anchor="middle"
              font-size="9"
              font-weight="800"
              fill="currentColor"
              :class="b.aktif ? 'text-yellow-dark' : 'text-dimmed'"
            >
              {{ b.nilai }}
            </text>
            <text
              v-for="b in trenGrafik.batang"
              :key="`m-${b.bulan}`"
              :x="b.cx"
              :y="trenGrafik.H - 10"
              text-anchor="middle"
              font-size="10"
              font-weight="700"
              fill="currentColor"
              class="text-dimmed"
            >
              {{ b.blnSingkat }}
            </text>
          </svg>
          <p
            v-else
            class="py-10 text-center text-xs font-medium text-dimmed italic"
          >
            Belum ada data order di rentang ini.
          </p>
        </AppPanel>

        <AppPanel title="Pola order per hari">
          <svg
            v-if="!dow.kosong"
            :viewBox="`0 0 ${dow.W} ${dow.H}`"
            class="w-full"
            role="img"
            aria-label="Rata-rata qty per order per hari"
          >
            <g
              v-for="b in dow.batang"
              :key="b.nama"
              :class="b.akhirPekan ? 'text-brand-yellow' : 'text-yellow-deep'"
            >
              <rect
                :x="b.x"
                :y="b.y"
                :width="b.lebar"
                :height="b.tinggi"
                rx="4"
                fill="currentColor"
              >
                <title>{{ b.judul }}</title>
              </rect>
            </g>
            <text
              v-for="b in dow.batang"
              :key="`n-${b.nama}`"
              :x="b.cx"
              :y="b.labelY"
              text-anchor="middle"
              font-size="9"
              font-weight="800"
              fill="currentColor"
              class="text-muted"
            >
              {{ b.nilai }}
            </text>
            <text
              v-for="b in dow.batang"
              :key="`d-${b.nama}`"
              :x="b.cx"
              :y="dow.H - 8"
              text-anchor="middle"
              font-size="10"
              font-weight="700"
              fill="currentColor"
              :class="b.akhirPekan ? 'text-yellow-deep' : 'text-dimmed'"
            >
              {{ b.nama }}
            </text>
          </svg>
          <div
            v-if="!dow.kosong"
            class="mt-1 flex justify-end gap-3 text-[10px] font-bold"
          >
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-sm bg-yellow-deep" />Hari kerja
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-sm bg-brand-yellow" />Akhir pekan
            </span>
          </div>
          <p
            v-else
            class="py-10 text-center text-xs font-medium text-dimmed italic"
          >
            Belum ada data order bulan ini.
          </p>
        </AppPanel>

        <AppPanel title="Konsentrasi vendor">
          <div v-if="!vendor.kosong">
            <div
              v-for="v in vendor.baris"
              :key="v.nama"
              class="mb-3"
            >
              <div class="mb-1 flex items-baseline justify-between gap-3 text-[11px]">
                <span
                  class="min-w-0 truncate font-bold"
                  :class="v.bisu ? 'text-dimmed italic' : 'text-default'"
                >{{ v.nama }}</span>
                <span class="num shrink-0 font-black text-muted">{{ angka(Math.round(v.qty)) }} <span class="font-bold text-dimmed">- {{ v.pangsa }}%</span></span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full"
                  :class="v.bisu ? 'bg-ink-300' : v.warna"
                  :style="{ width: `${v.lebar}%` }"
                />
              </div>
            </div>
          </div>
          <p
            v-else
            class="py-10 text-center text-xs font-medium text-dimmed italic"
          >
            Belum ada order bulan ini.
          </p>
        </AppPanel>

        <AppPanel title="Kontribusi tim">
          <div v-if="!timGrafik.kosong">
            <div class="flex flex-col items-center gap-4 sm:flex-row">
              <div
                class="relative shrink-0"
                style="width:120px;height:120px"
              >
                <svg
                  viewBox="0 0 120 120"
                  class="size-[120px]"
                  role="img"
                  aria-label="Donat kontribusi tim"
                >
                  <circle
                    v-for="s in timGrafik.segmen"
                    :key="s.nama"
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="currentColor"
                    :class="s.teks"
                    stroke-width="18"
                    pathLength="100"
                    :stroke-dasharray="`${s.persen} ${100 - s.persen}`"
                    :stroke-dashoffset="-s.awal"
                    transform="rotate(-90 60 60)"
                  >
                    <title>{{ s.nama }}: {{ angka(Math.round(s.qty)) }} ({{ Math.round(s.persen) }}%)</title>
                  </circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-[9px] font-bold text-dimmed uppercase">Total</span>
                  <span class="num text-sm leading-none font-black text-highlighted">{{ timTotalRingkas }}</span>
                </div>
              </div>
              <div class="w-full flex-1 space-y-1.5">
                <div
                  v-for="s in timGrafik.segmen"
                  :key="s.nama"
                  class="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span class="flex items-center gap-1.5 font-bold text-default">
                    <span
                      class="size-2.5 rounded-sm"
                      :class="s.latar"
                    />{{ s.nama }}
                  </span>
                  <span class="num font-black text-muted">{{ angka(Math.round(s.qty)) }} <span class="font-bold text-dimmed">- {{ Math.round(s.persen) }}%</span></span>
                </div>
              </div>
            </div>
          </div>
          <p
            v-else
            class="py-10 text-center text-xs font-medium text-dimmed italic"
          >
            Belum ada order bulan ini.
          </p>
        </AppPanel>
      </div>

      <AppPanel
        title="Rincian per bahan"
        :count="rekap.length"
        flush
      >
        <template #description>
          <span
            v-if="penggerak"
            class="inline-flex items-center gap-1.5"
          >
            <UIcon
              name="i-lucide-trending-up"
              class="size-4 text-error"
            />
            Kenaikan terbesar: <b class="text-error">{{ penggerak.nama }}</b>
            <span class="num">(+{{ angka(Math.round(penggerak.selisih)) }} {{ penggerak.unit }})</span>
          </span>
          <span v-else>Belum ada kenaikan menonjol vs bulan lalu.</span>
        </template>

        <div class="hidden lg:block">
          <UTable
            :columns="kolom"
            :data="rekap"
          >
            <template #freq-cell="{ row }">
              <span class="font-semibold text-muted">{{ row.original.freq }}x</span>
            </template>
            <template #spark-cell="{ row }">
              <svg
                viewBox="0 0 64 20"
                width="64"
                height="20"
                class="inline-block align-middle"
                :class="sparkGaris(row.original.spark).warna"
                role="img"
                aria-label="Tren qty 4 bulan"
              >
                <polyline
                  :points="sparkGaris(row.original.spark).titik"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <circle
                  :cx="sparkGaris(row.original.spark).lx"
                  :cy="sparkGaris(row.original.spark).ly"
                  r="1.8"
                  fill="currentColor"
                />
              </svg>
            </template>
            <template #qty-cell="{ row }">
              <span class="num text-base font-black text-highlighted">
                {{ angka(Math.round(row.original.qty)) }}
                <span class="text-[10px] font-bold text-dimmed uppercase">{{ row.original.unit }}</span>
              </span>
            </template>
            <template #selisih-cell="{ row }">
              <AppStatus
                :color="warnaSelisih(row.original.badge)"
                size="sm"
              >
                {{ teksSelisih(row.original) }}
              </AppStatus>
            </template>
            <template #badge-cell>
              <AppStatus
                color="neutral"
                size="sm"
              >
                menunggu data prakiraan
              </AppStatus>
            </template>
          </UTable>
          <p
            v-if="!rekap.length"
            class="py-10 text-center text-sm font-medium text-dimmed italic"
          >
            Tidak ada data order pada bulan ini.
          </p>
        </div>

        <div class="flex flex-col gap-2 p-3 lg:hidden">
          <div
            v-for="r in rekap.slice(0, 60)"
            :key="r.item"
            class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
          >
            <div class="min-w-0">
              <b class="text-highlighted">{{ r.item }}</b>
              <p class="num text-sm text-muted">
                {{ angka(Math.round(r.qty)) }} {{ r.unit }} · {{ r.freq }}x
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-1.5">
                <AppStatus
                  :color="warnaSelisih(r.badge)"
                  size="sm"
                >
                  {{ teksSelisih(r) }}
                </AppStatus>
                <AppStatus
                  color="neutral"
                  size="sm"
                >
                  menunggu data prakiraan
                </AppStatus>
              </div>
            </div>
            <svg
              viewBox="0 0 64 20"
              width="64"
              height="20"
              class="shrink-0"
              :class="sparkGaris(r.spark).warna"
              role="img"
              aria-label="Tren qty 4 bulan"
            >
              <polyline
                :points="sparkGaris(r.spark).titik"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <circle
                :cx="sparkGaris(r.spark).lx"
                :cy="sparkGaris(r.spark).ly"
                r="1.8"
                fill="currentColor"
              />
            </svg>
          </div>
          <p
            v-if="!rekap.length"
            class="text-sm text-dimmed"
          >
            Tidak ada data order pada bulan ini.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
