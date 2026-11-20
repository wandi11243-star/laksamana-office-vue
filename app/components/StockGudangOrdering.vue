<!--
  Stock › Ordering › Central Kitchen / Gudang Bar — one screen, two warehouses
  (old `deploy/stock/ordering/index.html:173-197,344-487,2346-2410`: "Gudang
  Bar konsepnya samakan dengan Central Kitchen" — the same page with
  GUDANG='bar').

  Sub-tabs: Stok sekarang / Minta dari … / Kirim ke … / Riwayat.
  Requests share the `batchOrder` mechanism of the shopping form (stock.md
  F.14) and always start a new batch named after the warehouse
  ("Central Kitchen" / "Gudang Bar"). A Gudang Bar request skips Check-in:
  the server takes the batch at once and lowers the stock (old 3 Nov 2026),
  so its history is shown per batch — pick-ups and deliveries alike
  (old `:3826-3900`). Big number = pack count, small = base unit.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CkMutasi, CkSaldo, Gudang } from '~/composables/useStock'
import { GUDANG_INFO, bolehUbahOrdering, catatLog, ckBalance, ckMovements, createBatch, deliverToCk, patchDelivery, saringMutasiGudang, saringSaldoGudang, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari, tglPendek } from '~/utils/format'
import { SATUAN_TERSEDIA, ckKeDasar, fmtQty, opsiSatuanKirimCk, tampilStokCk, unduhCsvStock } from '~/utils/stock-catat'
import type { TampilStok } from '~/utils/stock-catat'
import { tanganiKonflik, type Versi } from '~/utils/versi'

const props = defineProps<{ gudang: Gudang }>()

const toast = useToast()
const me = useMe()
const sub = ref<'stok' | 'minta' | 'kirim' | 'riwayat'>('stok')

const info = computed(() => GUDANG_INFO[props.gudang])
const bar = computed(() => props.gudang === 'bar')
/** "Lihat saja" for a role that may only view this warehouse (old ORD_PERM_DEFAULT, e.g. Check-in saja on Gudang Bar). */
const bisaUbah = computed(() => bolehUbahOrdering(bar.value ? 'gb' : 'ck'))
watch(bisaUbah, (v) => {
  if (!v && (sub.value === 'minta' || sub.value === 'kirim')) sub.value = 'stok'
})

const produkQ = useProdukStock()
/** Goods of this warehouse (CK: sumber ck/both · Gudang Bar: sumber bar). */
const produkGudang = computed(() => produkQ.data.value?.rows.filter(p => info.value.sumber.includes(p.sumber ?? '')) ?? [])
/** Goods the outlet can send back: this warehouse's goods that are also kept at the outlet. */
const produkOutlet = computed(() => produkGudang.value.filter(p => (p as unknown as Record<string, unknown>).diOutlet || p.sumber === 'both' || p.sumber === 'bar'))

const saldoQ = useAsyncData(`stock-gudang-saldo-${props.gudang}`, () => ckBalance(props.gudang), { default: () => ({ rows: [] as CkSaldo[] }) })
/** Stock tab search: item name or its category, case-insensitive. */
const cariStok = ref('')
const kategoriOf = (item: string) => String(produkQ.data.value?.rows.find(p => p.nama === item)?.kategori ?? '')
// Minus first, then empty, then the rest A–Z (owner request, Nov 2026: what
// ran out must be the first thing the crew sees, to be checked).
const urutanStok = (n: number) => (n < 0 ? 0 : n === 0 ? 1 : 2)
const saldoTampil = computed(() => {
  const q = cariStok.value.trim().toLowerCase()
  const rows = q ? saldo.value.filter(s => `${s.item} ${kategoriOf(s.item)}`.toLowerCase().includes(q)) : saldo.value
  return rows.slice().sort((a, b) => urutanStok(a.saldo) - urutanStok(b.saldo)
    || (a.saldo < 0 && b.saldo < 0 ? a.saldo - b.saldo : 0)
    || a.item.localeCompare(b.item, 'id'))
})
const jumlahMinus = computed(() => saldoTampil.value.filter(s => s.saldo < 0).length)
const jumlahHabis = computed(() => saldoTampil.value.filter(s => s.saldo === 0).length)
// Only this warehouse's goods, even when the ledger still holds a moved product's old rows.
const saldo = computed(() => saringSaldoGudang(saldoQ.data.value?.rows ?? [], produkQ.data.value?.rows ?? [], props.gudang))

/**
 * Display facts for one balance row: the pack snapshot rides on the balance
 * row itself, the base unit and measured sizes come from the product master.
 * `satuanTampil` prefers the master's setting, falling back to the balance
 * row's (both come from the same contract).
 */
function infoStok(item: string) {
  const p = produkQ.data.value?.rows.find(r => r.nama === item) as unknown as Record<string, unknown> | undefined
  const s = saldo.value.find(r => r.item === item)
  return {
    // packSatuan is the item's non-Pack unit (docs/migrasi/stock.md F.15), the
    // same unit the balance is stored in — sound fallback when the master row is gone.
    satuanDasar: (p?.satuanDasar as string) || s?.packSatuan || '',
    isi: (p?.isi as Record<string, number>) || {},
    packIsi: Number(p?.packIsi ?? s?.packIsi) || 0,
    satuanTampil: (p?.satuanTampil as string) || (s as unknown as Record<string, unknown> | undefined)?.satuanTampil as string || '',
  }
}

/** Every balance row written the way the crew says it: big unit, exact base below. */
const stokTampil = computed<Record<string, TampilStok>>(() => {
  const out: Record<string, TampilStok> = {}
  for (const s of saldo.value) out[s.item] = tampilStokCk(s.saldo, infoStok(s.item))
  return out
})

/** Any base-unit quantity of one item written the same way (Masuk/Keluar cells, CSV). */
function tampilStok(item: string, n: number): TampilStok {
  return tampilStokCk(n, infoStok(item))
}

const gerakQ = useAsyncData(`stock-gudang-gerak-${props.gudang}`, () => ckMovements(undefined, undefined, props.gudang), {
  default: () => ({ rows: [] as CkMutasi[], versions: {} as Record<string, Versi> }),
})
const gerakGudang = computed(() => saringMutasiGudang(gerakQ.data.value?.rows ?? [], props.gudang, produkQ.data.value?.rows ?? []))
const kiriman = computed(() => gerakGudang.value.filter(m => m.sebab === 'kiriman'))
const versiKirim = computed(() => gerakQ.data.value?.versions ?? {})

/**
 * Gudang Bar history per batch: one card = one "Minta" (pick-up rows written
 * by the server, `sebab: pengajuan`) or one "Catat kiriman" (`sebab:
 * kiriman`). Rows from before batches were recorded stand alone.
 */
interface BatchRiwayat { kunci: string, jenis: 'ambil' | 'kirim', tanggal: string, waktu: string, pic: string, tim: string, baris: CkMutasi[] }
const riwayatBatch = computed<BatchRiwayat[]>(() => {
  const grup = new Map<string, BatchRiwayat>()
  for (const m of gerakGudang.value) {
    const jenis = m.sebab === 'kiriman' ? 'kirim' : (m.sebab === 'pengajuan' && m.arah === 'keluar' ? 'ambil' : null)
    if (!jenis) continue
    const kunci = `${jenis}:${m.batchId || m.id}`
    let g = grup.get(kunci)
    if (!g) {
      g = { kunci, jenis, tanggal: m.tanggal || '', waktu: m.waktu || '', pic: m.pic || '', tim: m.tim || '', baris: [] }
      grup.set(kunci, g)
    }
    g.baris.push(m)
    if ((m.tanggal || '') > g.tanggal) g.tanggal = m.tanggal || ''
    if ((m.waktu || '') > g.waktu) g.waktu = m.waktu || ''
  }
  return [...grup.values()].sort((a, b) => (b.tanggal + b.waktu).localeCompare(a.tanggal + a.waktu))
})

/**
 * Unit options for one row, from the product master: the product's own units
 * + Pack + the base unit + measured sizes + the warehouse stock unit — never
 * the generic list. A unit the server would refuse (422, not convertible) is
 * not offered. Shared by Minta, Kirim and the Ubah modal (old 3 Nov 2026:
 * "satuan Minta persis form Kirim").
 */
function produkRow(nama: string) {
  return produkQ.data.value?.rows.find(r => r.nama === nama) as unknown as Record<string, unknown> | undefined
}
function opsiSatuan(nama: string): { value: string, label: string }[] {
  if (!nama.trim()) return SATUAN_TERSEDIA.map(u => ({ value: u, label: u }))
  const p = produkRow(nama.trim())
  const s = saldo.value.find(r => r.item === nama.trim())
  return opsiSatuanKirimCk(
    p ? { satuan: p.satuan, satuanDasar: p.satuanDasar, isi: p.isi, packIsi: p.packIsi } : undefined,
    String(p?.packSatuan ?? s?.packSatuan ?? ''),
  )
}
/** Keep the row's unit inside its options (picking another item narrows them). */
function rapikanSatuan(b: BarisGudang) {
  if (!b.item.trim()) return
  const opsi = opsiSatuan(b.item)
  if (!opsi.some(o => o.value === b.unit)) b.unit = opsi[0]?.value ?? 'Pack'
}

const kolomStok: TableColumn<CkSaldo>[] = [
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'saldo', header: 'Sisa' },
  { accessorKey: 'masuk', header: 'Masuk' },
  { accessorKey: 'keluar', header: 'Keluar' },
  { accessorKey: 'terakhir', header: 'Terakhir' },
]

interface BarisGudang { k: number, item: string, qty: number, unit: string }
let nomor = 0
const barisBaru = (): BarisGudang => ({ k: ++nomor, item: '', qty: 1, unit: 'Pack' })
const barisMinta = ref<BarisGudang[]>([barisBaru()])
const barisKirim = ref<BarisGudang[]>([barisBaru()])
const tglButuh = ref(bar.value ? hariIni() : tambahHari(hariIni(), 1))
const tglKirim = ref(hariIni())
const mengirim = ref(false)

function tambahBaris(ke: 'minta' | 'kirim') {
  const daftar = ke === 'minta' ? barisMinta : barisKirim
  daftar.value.push(barisBaru())
}
function hapusBaris(ke: 'minta' | 'kirim', k: number) {
  const daftar = ke === 'minta' ? barisMinta : barisKirim
  if (daftar.value.length <= 1) {
    toast.add({ title: 'Minimal satu baris', color: 'warning' })
    return
  }
  daftar.value = daftar.value.filter(b => b.k !== k)
}

const sisaOf = (nama: string) => (saldo.value.some(s => s.item === nama) ? stokTampil.value[nama]?.utama : undefined)

// --- picking goods (like Form Order: search grouped by category, or tiles) ---
const daftarDari = (ke: 'minta' | 'kirim') => (ke === 'minta' ? produkGudang.value : produkOutlet.value)
function opsiGrup(ke: 'minta' | 'kirim') {
  const grup = new Map<string, string[]>()
  for (const p of daftarDari(ke)) {
    if (p.aktif === false) continue
    const k = (p.kategori || '').trim() || 'Lainnya'
    grup.set(k, [...(grup.get(k) ?? []), p.nama])
  }
  return [...grup.entries()]
    .sort(([a], [b]) => (a === 'Lainnya' ? 1 : b === 'Lainnya' ? -1 : a.localeCompare(b, 'id')))
    .map(([k, nama]) => [{ type: 'label' as const, label: k, value: `kategori:${k}` }, ...nama.sort((a, b) => a.localeCompare(b, 'id')).map(n => ({ label: n, value: n }))])
}
const opsiMinta = computed(() => opsiGrup('minta'))
const opsiKirimBarang = computed(() => opsiGrup('kirim'))

function isiBarang(b: BarisGudang, nama: string) {
  b.item = nama
  rapikanSatuan(b)
}

const pemilih = ref<{ open: boolean, ke: 'minta' | 'kirim', k: number | null }>({ open: false, ke: 'minta', k: null })
const barisPemilih = computed(() => (pemilih.value.ke === 'minta' ? barisMinta : barisKirim))
const namaDiPemilih = computed(() => barisPemilih.value.value.map(b => b.item).filter(Boolean))
function bukaPemilih(ke: 'minta' | 'kirim', k: number | null = null) {
  pemilih.value = { open: true, ke, k }
}
function pakaiPilihan(nama: string[]) {
  const { k } = pemilih.value
  const daftar = barisPemilih.value
  if (k !== null) {
    const b = daftar.value.find(x => x.k === k)
    if (b && nama[0]) isiBarang(b, nama[0])
    return
  }
  // Multi pick: unticked goods leave the form, new ones fill empty rows first.
  const pilih = new Set(nama)
  let sisa = daftar.value.filter(b => !b.item || pilih.has(b.item))
  const ada = new Set(sisa.map(b => b.item).filter(Boolean))
  for (const n of nama) {
    if (ada.has(n)) continue
    const kosong = sisa.find(b => !b.item)
    if (kosong) {
      isiBarang(kosong, n)
      continue
    }
    const baru = barisBaru()
    isiBarang(baru, n)
    sisa = [...sisa, baru]
  }
  daftar.value = sisa.length ? sisa : [barisBaru()]
}

async function kirimMinta() {
  const isi = barisMinta.value.filter(b => b.item.trim() && (Number(b.qty) || 0) > 0)
  if (!isi.length) {
    toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu barang.', color: 'warning' })
    return
  }
  for (const b of isi) rapikanSatuan(b)
  mengirim.value = true
  try {
    const r = await createBatch({
      orders: isi.map(b => ({ item: b.item.trim(), qty: Number(b.qty) || 1, unit: b.unit, note: '-', tglDatang: tglButuh.value })),
      batchName: info.value.batch,
    })
    await catatLog([{ modul: 'ordering', aksi: bar.value ? 'gb_minta' : 'ck_minta', ringkas: `${r.created} baris diminta dari ${info.value.singkat} (${r.batchName})` }])
    barisMinta.value = [barisBaru()]
    if (bar.value) {
      // Taken at once by the server: the stock already dropped (or the sync
      // failed and the batch still stands — fixed through a Penyesuaian).
      await Promise.all([saldoQ.refresh(), gerakQ.refresh()])
      if (r.langsung?.ck?.error) {
        toast.add({ title: 'Batch tercatat', description: 'Stok Gudang Bar gagal dipotong — betulkan lewat Penyesuaian di Purchasing.', color: 'warning' })
      }
      else {
        toast.add({ title: 'Pengambilan tercatat', description: `${r.created} barang tercatat & stok Gudang Bar langsung berkurang. Riwayatnya di tab Riwayat batch.`, color: 'success' })
      }
    }
    else {
      toast.add({ title: 'Pengajuan terkirim', description: `${r.created} baris masuk batch Central Kitchen.`, color: 'success' })
    }
  }
  catch (e) {
    toast.add({ title: 'Pengiriman gagal', description: `${apiErrorMessage(e)} Pastikan internet stabil & coba lagi.`, color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}

async function catatKirim() {
  const isi = barisKirim.value.filter(b => b.item.trim() && (Number(b.qty) || 0) > 0)
  if (!isi.length) {
    toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu barang.', color: 'warning' })
    return
  }
  // Snap rows whose unit fell out so the server never sees a unit it would refuse (422).
  for (const b of isi) rapikanSatuan(b)
  mengirim.value = true
  // One "Catat kiriman" = one delivery batch, so the history groups it (old 4 Nov 2026).
  const batchId = `KRM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  try {
    for (const b of isi) {
      await deliverToCk({ item: b.item.trim(), qtyInput: Number(b.qty) || 1, unitInput: b.unit, tanggal: tglKirim.value, gudang: props.gudang, batchId })
    }
    await catatLog([{ modul: 'ordering', aksi: bar.value ? 'gb_kirim' : 'ck_kirim', ringkas: `${isi.length} baris dikirim ke ${info.value.singkat}` }])
    barisKirim.value = [barisBaru()]
    await Promise.all([saldoQ.refresh(), gerakQ.refresh()])
    toast.add({ title: 'Kiriman tercatat', description: `Stok ${info.value.singkat} langsung bertambah begitu dicatat di sini.`, color: 'success' })
  }
  catch (e) {
    // A 422 names the refusing unit ("satuan X tidak bisa dikonversi…") —
    // show it as-is so the crew knows which row to fix, never silently.
    toast.add({ title: 'Pencatatan gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}

const kolomKirim: TableColumn<CkMutasi>[] = [
  { accessorKey: 'tanggal', header: 'Tanggal' },
  { accessorKey: 'item', header: 'Barang' },
  { accessorKey: 'qtyInput', header: 'Jumlah' },
  { accessorKey: 'pic', header: 'Pencatat' },
  { id: 'aksi', header: '' },
]

// --- Ubah kiriman (pensil per baris riwayat → modal tanggal/jumlah/satuan)
const sheetUbah = ref(false)
const ubah = ref({ id: '', item: '', tanggal: '', qty: 1, unit: 'Pack' })
function bukaUbah(m: CkMutasi) {
  if (!bisaUbah.value) {
    toast.add({ title: 'Hanya bisa dilihat', description: 'Peran Ordering kamu tidak boleh mengubah kiriman gudang ini.', color: 'warning' })
    return
  }
  if (m.sebab !== 'kiriman' || m.ref) {
    toast.add({ title: 'Baris ini tidak bisa diubah di sini', description: 'Mutasi dari pengajuan hanya berubah lewat check-in; salah barang dicatat lewat penyesuaian.', color: 'warning' })
    return
  }
  ubah.value = {
    id: m.id,
    item: m.item,
    tanggal: m.tanggal || '',
    qty: Number(m.qtyInput ?? m.qty) || 1,
    unit: m.unitInput || 'Pack',
  }
  sheetUbah.value = true
}
/** Same option builder as form Kirim — the item itself is fixed. */
const opsiUbah = computed(() => opsiSatuan(ubah.value.item))
/**
 * Stale-master ribbon: the stored qty was computed with the master of that
 * day; the modal recomputes with today's. When they differ the ribbon says
 * so ("Tercatat X → akan jadi Y") — and saving stays allowed, identical
 * numbers included (the server keeps them under the stale-master rule).
 */
const basiUbah = computed(() => {
  const m = kiriman.value.find(x => x.id === ubah.value.id)
  if (!m) return null
  const p = produkRow(m.item)
  const hitung = ckKeDasar(Number(ubah.value.qty) || 0, ubah.value.unit, p
    ? { satuanDasar: p.satuanDasar, isi: p.isi, packIsi: p.packIsi }
    : undefined)
  if (hitung === null) return null
  if (Math.abs(hitung - m.qty) <= 0.0001) return null
  const unitStok = String(p?.satuanDasar ?? m.packSatuan ?? '').trim()
  const t = (n: number) => (unitStok ? `${fmtQty(n)} ${unitStok}` : fmtQty(n))
  return `Tercatat ${t(m.qty)} → akan jadi ${t(hitung)}`
})
const menyimpanUbah = ref(false)
async function simpanUbah() {
  if (!(Number(ubah.value.qty) > 0)) {
    toast.add({ title: 'Jumlah harus lebih dari 0', color: 'warning' })
    return
  }
  menyimpanUbah.value = true
  try {
    await patchDelivery(ubah.value.id, {
      tanggal: ubah.value.tanggal || undefined,
      qtyInput: Number(ubah.value.qty),
      unitInput: ubah.value.unit,
      gudang: props.gudang,
    }, versiKirim.value[ubah.value.id])
    sheetUbah.value = false
    await Promise.all([saldoQ.refresh(), gerakQ.refresh()])
    toast.add({ title: 'Kiriman diubah', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => gerakQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpanUbah.value = false
  }
}

function unduhStok() {
  const sel = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  unduhCsvStock(
    `stok-${bar.value ? 'gudang-bar' : 'ck'}-${hariIni()}.csv`,
    // Same strings as on screen, so the file matches what the crew just read.
    ['Barang,Saldo,Masuk,Keluar,Terakhir', ...saldo.value.map(s => [s.item, tampilStok(s.item, s.saldo).utama, tampilStok(s.item, s.masuk).utama, tampilStok(s.item, s.keluar).utama, s.terakhir ?? ''].map(sel).join(','))].join('\n'),
  )
}

const opsiSub = computed(() => [
  { value: 'stok' as const, label: `Stok ${info.value.singkat} sekarang`, icon: 'i-lucide-box' },
  ...(bisaUbah.value
    ? [
        { value: 'minta' as const, label: `Minta dari ${info.value.singkat}`, icon: 'i-lucide-download' },
        { value: 'kirim' as const, label: `Kirim ke ${info.value.singkat}`, icon: 'i-lucide-upload' },
      ]
    : []),
  { value: 'riwayat' as const, label: bar.value ? 'Riwayat batch' : 'Riwayat kiriman', icon: 'i-lucide-receipt' },
])
</script>

<template>
  <AppPage
    :title="info.nama"
    :description="bar ? 'Stok Gudang Bar — diminta tim bar' : 'Pengajuan ke Central Kitchen'"
  >
    <template #actions>
      <UButton
        label="Segarkan stok"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="saldoQ.refresh(); gerakQ.refresh()"
      />
      <UButton
        label="Unduh stok (CSV)"
        icon="i-lucide-download"
        variant="outline"
        @click="unduhStok"
      />
    </template>

    <AppStatGrid>
      <AppStat
        :label="`Barang ${info.singkat}`"
        :value="String(saldo.length)"
        satuan="barang"
        :icon="bar ? 'i-lucide-wine' : 'i-lucide-warehouse'"
        :tone="bar ? 'vip' : 'info'"
      />
      <AppStat
        label="Saldo negatif"
        :value="String(saldo.filter(s => s.saldo < 0).length)"
        satuan="barang"
        icon="i-lucide-alert-triangle"
        tone="error"
      />
      <AppStat
        :label="bar ? 'Batch tercatat' : 'Kiriman tercatat'"
        :value="String(bar ? riwayatBatch.length : kiriman.length)"
        :satuan="bar ? 'batch' : 'baris'"
        icon="i-lucide-package"
      />
    </AppStatGrid>

    <AppPanel :title="info.nama">
      <template #head>
        <AppSeg
          v-model="sub"
          :options="opsiSub"
        />
      </template>

      <div v-if="sub === 'stok'">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <UInput
            v-model="cariStok"
            icon="i-lucide-search"
            placeholder="Cari barang atau kategori…"
            class="w-full sm:max-w-xs"
          >
            <template
              v-if="cariStok"
              #trailing
            >
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="link"
                size="xs"
                aria-label="Hapus pencarian"
                @click="cariStok = ''"
              />
            </template>
          </UInput>
          <p class="text-sm text-muted">
            Angka besar = pack (atau satuan beli terkecil), angka kecil = satuan dasarnya.
            <template v-if="jumlahMinus || jumlahHabis">
              ·
              <b
                v-if="jumlahMinus"
                class="text-error"
              >{{ jumlahMinus }} minus</b><template v-if="jumlahMinus && jumlahHabis">
                ,
              </template><b
                v-if="jumlahHabis"
                class="text-error"
              >{{ jumlahHabis }} habis</b> — ditaruh paling atas.
            </template>
          </p>
        </div>
        <div class="hidden lg:block">
          <UTable
            :columns="kolomStok"
            :data="saldoTampil"
            :empty="cariStok ? `Tidak ada barang yang cocok dengan “${cariStok}”.` : `Belum ada stok ${info.singkat}.`"
          >
            <template #item-cell="{ row }">
              <div>
                <b class="text-highlighted">{{ row.original.item }}</b>
                <AppStatus
                  v-if="row.original.saldo <= 0"
                  color="error"
                  :icon="row.original.saldo < 0 ? 'i-lucide-circle-minus' : 'i-lucide-package-x'"
                  size="sm"
                  class="ms-2"
                >
                  {{ row.original.saldo < 0 ? 'Minus' : 'Habis' }}
                </AppStatus>
                <p
                  v-if="stokTampil[row.original.item]?.ket"
                  class="text-xs text-dimmed"
                >
                  {{ stokTampil[row.original.item]?.ket }}
                </p>
              </div>
            </template>
            <template #saldo-cell="{ row }">
              <div class="text-right">
                <b
                  class="num text-base"
                  :class="row.original.saldo <= 0 ? 'text-error' : 'text-highlighted'"
                >{{ stokTampil[row.original.item]?.utama }}</b>
                <p
                  v-if="stokTampil[row.original.item]?.kecil"
                  class="text-xs text-dimmed"
                >
                  {{ stokTampil[row.original.item]?.kecil }}
                </p>
              </div>
            </template>
            <template #masuk-cell="{ row }">
              <span class="num">{{ tampilStok(row.original.item, row.original.masuk).utama }}</span>
            </template>
            <template #keluar-cell="{ row }">
              <span class="num">{{ tampilStok(row.original.item, row.original.keluar).utama }}</span>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="s in saldoTampil"
            :key="s.item"
            class="flex items-center justify-between rounded-xl border border-default p-3"
          >
            <div>
              <b class="text-highlighted">{{ s.item }}</b>
              <AppStatus
                v-if="s.saldo <= 0"
                color="error"
                :icon="s.saldo < 0 ? 'i-lucide-circle-minus' : 'i-lucide-package-x'"
                size="sm"
                class="ms-2"
              >
                {{ s.saldo < 0 ? 'Minus' : 'Habis' }}
              </AppStatus>
              <p
                v-if="stokTampil[s.item]?.ket"
                class="text-xs text-dimmed"
              >
                {{ stokTampil[s.item]?.ket }}
              </p>
              <p class="text-sm text-muted">
                Masuk {{ tampilStok(s.item, s.masuk).utama }} · Keluar {{ tampilStok(s.item, s.keluar).utama }}
              </p>
            </div>
            <div class="text-right">
              <b
                class="num text-lg"
                :class="s.saldo <= 0 ? 'text-error' : 'text-highlighted'"
              >{{ stokTampil[s.item]?.utama }}</b>
              <p
                v-if="stokTampil[s.item]?.kecil"
                class="text-xs text-dimmed"
              >
                {{ stokTampil[s.item]?.kecil }}
              </p>
            </div>
          </div>
          <p
            v-if="!saldoTampil.length"
            class="text-sm text-dimmed"
          >
            {{ cariStok ? `Tidak ada barang yang cocok dengan “${cariStok}”.` : `Belum ada stok ${info.singkat}.` }}
          </p>
        </div>
      </div>

      <!-- Minta and Kirim each get their own tint (owner request, Nov 2026) so a
           glance tells which form is open; rows inside sit on white. -->
      <div
        v-if="sub === 'minta'"
        class="rounded-xl border border-info/25 bg-info/5 p-3 sm:p-4"
      >
        <p class="mb-3 flex items-center gap-2 text-sm font-bold text-info">
          <UIcon
            name="i-lucide-download"
            class="size-4"
          />
          Minta dari {{ info.singkat }}
        </p>
        <p
          v-if="bar"
          class="mb-3 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
        >
          Stok Gudang Bar langsung berkurang sebanyak daftar di bawah — tidak lewat Check-in Penerimaan. Pastikan jumlahnya benar.
        </p>
        <AppFilterGrid>
          <UFormField label="PIC pemohon">
            <UInput
              :model-value="me?.name ?? ''"
              disabled
            />
          </UFormField>
          <UFormField :label="bar ? 'Tanggal ambil' : 'Tanggal dibutuhkan'">
            <AppTanggal
              v-model="tglButuh"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="flex flex-col gap-3">
          <div
            v-for="b in barisMinta"
            :key="b.k"
            class="grid gap-2 rounded-xl border border-default bg-default p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <UFormField label="Barang">
              <div class="flex items-center gap-2">
                <USelectMenu
                  :model-value="b.item || undefined"
                  :items="opsiMinta"
                  value-key="value"
                  :placeholder="`Cari barang ${info.singkat}…`"
                  :search-input="{ placeholder: 'Ketik nama barang…' }"
                  class="min-w-0 flex-1"
                  @update:model-value="isiBarang(b, String($event ?? ''))"
                />
                <UButton
                  icon="i-lucide-layout-grid"
                  color="neutral"
                  variant="soft"
                  square
                  class="size-10 shrink-0 justify-center lg:size-8"
                  title="Pilih dari kategori"
                  aria-label="Pilih barang dari kategori"
                  @click="bukaPemilih('minta', b.k)"
                />
              </div>
            </UFormField>
            <UFormField label="Jumlah">
              <UInput
                v-model.number="b.qty"
                type="number"
                min="1"
              />
            </UFormField>
            <UFormField label="Satuan">
              <USelect
                v-model="b.unit"
                :items="opsiSatuan(b.item)"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <span
                v-if="b.item && sisaOf(b.item) !== undefined"
                class="pb-2 text-sm text-muted"
              >Sisa {{ sisaOf(b.item) }}</span>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                square
                class="size-10 justify-center lg:size-8"
                aria-label="Hapus baris"
                @click="hapusBaris('minta', b.k)"
              />
            </div>
          </div>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="tambahBaris('minta')"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />
            Tambah barang
          </button>
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="bukaPemilih('minta')"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="size-4"
            />
            Pilih barang dari kategori
          </button>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <UButton
            :label="bar ? 'Catat pengambilan' : 'Kirim pengajuan'"
            icon="i-lucide-send"
            :loading="mengirim"
            @click="kirimMinta"
          />
        </div>
      </div>

      <div
        v-if="sub === 'kirim'"
        class="rounded-xl border border-success/25 bg-success/5 p-3 sm:p-4"
      >
        <p class="mb-3 flex items-center gap-2 text-sm font-bold text-success">
          <UIcon
            name="i-lucide-upload"
            class="size-4"
          />
          Kirim ke {{ info.singkat }}
        </p>
        <p class="mb-3 text-sm text-muted">
          Stok {{ info.singkat }} langsung bertambah begitu dicatat di sini. Hanya barang yang juga disimpan di outlet.
        </p>
        <AppFilterGrid>
          <UFormField label="Tanggal kirim">
            <AppTanggal
              v-model="tglKirim"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="flex flex-col gap-3">
          <div
            v-for="b in barisKirim"
            :key="b.k"
            class="grid gap-2 rounded-xl border border-default bg-default p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <UFormField label="Barang">
              <div class="flex items-center gap-2">
                <USelectMenu
                  :model-value="b.item || undefined"
                  :items="opsiKirimBarang"
                  value-key="value"
                  placeholder="Cari barang…"
                  :search-input="{ placeholder: 'Ketik nama barang…' }"
                  class="min-w-0 flex-1"
                  @update:model-value="isiBarang(b, String($event ?? ''))"
                />
                <UButton
                  icon="i-lucide-layout-grid"
                  color="neutral"
                  variant="soft"
                  square
                  class="size-10 shrink-0 justify-center lg:size-8"
                  title="Pilih dari kategori"
                  aria-label="Pilih barang dari kategori"
                  @click="bukaPemilih('kirim', b.k)"
                />
              </div>
            </UFormField>
            <UFormField label="Jumlah">
              <UInput
                v-model.number="b.qty"
                type="number"
                min="1"
              />
            </UFormField>
            <UFormField label="Satuan">
              <USelect
                v-model="b.unit"
                :items="opsiSatuan(b.item)"
              />
            </UFormField>
            <div class="flex items-end">
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                square
                class="size-10 justify-center lg:size-8"
                aria-label="Hapus baris"
                @click="hapusBaris('kirim', b.k)"
              />
            </div>
          </div>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="tambahBaris('kirim')"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />
            Tambah item
          </button>
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="bukaPemilih('kirim')"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="size-4"
            />
            Pilih item dari kategori
          </button>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <UButton
            label="Catat kiriman"
            icon="i-lucide-check"
            :loading="mengirim"
            @click="catatKirim"
          />
        </div>
      </div>

      <!-- Gudang Bar: per batch, pick-ups and deliveries together. -->
      <div
        v-if="sub === 'riwayat' && bar"
        class="flex flex-col gap-3"
      >
        <div
          v-for="g in riwayatBatch"
          :key="g.kunci"
          class="rounded-xl border p-3"
          :class="g.jenis === 'ambil' ? 'border-info/25 bg-info/5' : 'border-success/25 bg-success/5'"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <AppStatus
                :color="g.jenis === 'ambil' ? 'info' : 'success'"
                size="sm"
              >
                {{ g.jenis === 'ambil' ? 'Pengambilan' : 'Kiriman' }}
              </AppStatus>
              <b class="text-highlighted">{{ tglPendek(g.tanggal) }}</b>
            </div>
            <span class="text-sm text-muted">{{ g.baris.length }} barang · {{ g.pic || '—' }}{{ g.tim ? ` · ${g.tim}` : '' }}</span>
          </div>
          <ul class="mt-2 flex flex-col divide-y divide-default">
            <li
              v-for="m in g.baris"
              :key="m.id"
              class="flex items-center justify-between gap-2 py-1.5"
            >
              <div>
                <span class="text-highlighted">{{ m.item }}</span>
                <p
                  v-if="(m.nUbah ?? 0) > 0"
                  class="text-xs text-dimmed"
                >
                  diubah {{ m.diubahOleh || '—' }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <span class="num text-sm">{{ fmtQty(Number(m.qtyInput ?? m.qty) || 0) }} {{ m.unitInput }}</span>
                <UButton
                  v-if="g.jenis === 'kirim' && bisaUbah"
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Ubah kiriman ${m.item}`"
                  @click="bukaUbah(m)"
                />
              </div>
            </li>
          </ul>
        </div>
        <p
          v-if="!riwayatBatch.length"
          class="text-sm text-dimmed"
        >
          Pengambilan dan kiriman Gudang Bar akan muncul di sini.
        </p>
      </div>

      <div v-if="sub === 'riwayat' && !bar">
        <div class="hidden lg:block">
          <UTable
            :columns="kolomKirim"
            :data="kiriman"
          >
            <template #item-cell="{ row }">
              <div>
                <b class="text-highlighted">{{ row.original.item }}</b>
                <p
                  v-if="(row.original.nUbah ?? 0) > 0"
                  class="text-xs text-dimmed"
                >
                  diubah {{ row.original.diubahOleh || '—' }}
                </p>
              </div>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Ubah kiriman ${row.original.item}`"
                  @click="bukaUbah(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
        <div class="flex flex-col gap-2 lg:hidden">
          <div
            v-for="m in kiriman"
            :key="m.id"
            class="rounded-xl border border-default p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <b class="text-highlighted">{{ m.item }}</b>
                <p class="text-sm text-muted">
                  {{ tglPendek(m.tanggal) }} · {{ m.qtyInput }} {{ m.unitInput }} · {{ m.pic }}
                </p>
                <p
                  v-if="(m.nUbah ?? 0) > 0"
                  class="text-xs text-dimmed"
                >
                  diubah {{ m.diubahOleh || '—' }}
                </p>
              </div>
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                :aria-label="`Ubah kiriman ${m.item}`"
                @click="bukaUbah(m)"
              />
            </div>
          </div>
          <p
            v-if="!kiriman.length"
            class="text-sm text-dimmed"
          >
            Belum ada kiriman.
          </p>
        </div>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheetUbah"
      title="Ubah kiriman"
      lebar="sedang"
    >
      <div class="flex flex-col gap-3">
        <UFormField label="Barang">
          <UInput
            :model-value="ubah.item"
            disabled
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Tanggal kirim">
            <AppTanggal v-model="ubah.tanggal" />
          </UFormField>
          <UFormField label="Jumlah">
            <UInput
              v-model.number="ubah.qty"
              type="number"
              min="0"
              step="any"
            />
          </UFormField>
        </div>
        <UFormField label="Satuan">
          <USelect
            v-model="ubah.unit"
            :items="opsiUbah"
          />
        </UFormField>
        <p
          v-if="basiUbah"
          class="rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
        >
          {{ basiUbah }}. Satuan stok berubah setelah kiriman ini dicatat — menyimpan tetap diizinkan.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheetUbah = false"
          />
          <UButton
            label="Simpan"
            :loading="menyimpanUbah"
            @click="simpanUbah"
          />
        </div>
      </div>
    </ResponsiveSheet>

    <StockPilihBahan
      v-model:open="pemilih.open"
      :produk="daftarDari(pemilih.ke)"
      :awal="namaDiPemilih"
      :tunggal="pemilih.k !== null"
      @pakai="pakaiPilihan"
    />
  </AppPage>
</template>
