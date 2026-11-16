<!--
  Stock › HPP › Kalkulator HPP (old `deploy/stock/hpp/index.html:244`, JUDUL kalk `:837`).

  "Hitung modal & harga jual sebuah menu tanpa menyimpan apa pun." The modal
  is divided by the portion count BEFORE COGS (stock.md F.4); the buffer is
  shown as its own line (F.1–F.2).
-->
<script setup lang="ts">
import type { ProdukStock } from '~/composables/useStock'
import { getHppIngredients, hppSettings, useProdukStock } from '~/composables/useStock'
import { persen, rupiah } from '~/utils/format'
import {
  ambangOf,
  buatKonteks,
  konvSatuan,
  per1,
  SET_DEFAULT,
  spareModal,
  type KonteksHpp,
} from '~/utils/stock-hpp'

definePageMeta({ access: ['hpp'] })

const bahanQ = useAsyncData('hpp-kalk-bahan', getHppIngredients, { default: () => ({ rows: [] }) })
const produkQ = useProdukStock()
const setQ = useAsyncData('hpp-kalk-set', hppSettings, { default: () => ({ data: SET_DEFAULT, versi: undefined }) })
const set = computed(() => ({ ...SET_DEFAULT, ...(setQ.data.value?.data ?? {}) }))

const ctx = computed<KonteksHpp>(() => buatKonteks(
  (bahanQ.data.value?.rows ?? []).map(b => ({
    nama: String(b.nama ?? ''),
    satuan: String(b.satuan ?? ''),
    qty_beli: Number(b.qty_beli ?? 0),
    harga_beli: Number(b.harga_beli ?? 0),
    produk: String(b.produk ?? ''),
  })),
  [],
  (produkQ.data.value?.rows ?? []).map(p => ({
    nama: String(p.nama ?? ''),
    satuanDasar: String((p as unknown as Record<string, unknown>).satuanDasar ?? ''),
    isi: ((p as unknown as Record<string, unknown>).isi ?? {}) as Record<string, number>,
  })),
))

// --- ingredient choices, grouped by category like Form Order Belanja -----------------

const LAINNYA = 'Lainnya'
const produkOf = (nama: string, pasangan?: unknown) => {
  const rows = produkQ.data.value?.rows ?? []
  const low = nama.toLowerCase()
  const p = String(pasangan ?? '').trim().toLowerCase()
  return rows.find(x => x.nama.toLowerCase() === low)
    ?? (p && p !== '-' ? rows.find(x => x.nama.toLowerCase() === p) : undefined)
}
/**
 * The picker's rows: every priced ingredient, its category from HPP or else
 * from its Purchasing pair, its units = the purchase unit + the pair's units.
 */
const bahanPilih = computed<ProdukStock[]>(() => (bahanQ.data.value?.rows ?? [])
  .filter(b => String(b.nama ?? '').trim())
  .map((b) => {
    const nama = String(b.nama)
    const p = produkOf(nama, b.produk)
    const satuan = [...new Set([String(b.satuan ?? ''), ...(p?.satuan ?? []), String(p?.satuanDasar ?? '')].map(s => s.trim()).filter(Boolean))]
    return { nama, kategori: String(b.kategori ?? '').trim() || String(p?.kategori ?? '').trim(), satuan, aktif: true }
  }))
const bahanByNama = computed(() => new Map(bahanPilih.value.map(b => [b.nama.toLowerCase(), b])))
const opsiBahan = computed(() => {
  const grup = new Map<string, string[]>()
  for (const b of bahanPilih.value) {
    const k = b.kategori || LAINNYA
    grup.set(k, [...(grup.get(k) ?? []), b.nama])
  }
  return [...grup.entries()]
    .sort(([a], [b]) => (a === LAINNYA ? 1 : b === LAINNYA ? -1 : a.localeCompare(b, 'id')))
    .map(([k, nama]) => [{ type: 'label' as const, label: k, value: `kategori:${k}` }, ...nama.sort((a, b) => a.localeCompare(b, 'id')).map(n => ({ label: n, value: n }))])
})

interface BarisKalk { k: number, nama: string, qty: number, satuan: string }
let nomor = 0
const baris = ref<BarisKalk[]>([{ k: ++nomor, nama: '', qty: 1, satuan: '' }])
const porsi = ref(1)
const harga = ref(0)

/** Units for a row: the ingredient's own, plus whatever the row already holds. */
function opsiSatuan(b: BarisKalk) {
  const s = bahanByNama.value.get(b.nama.trim().toLowerCase())?.satuan as string[] | undefined ?? []
  const semua = b.satuan && !s.includes(b.satuan) ? [...s, b.satuan] : s
  return semua.map(x => ({ value: x, label: x }))
}
function pilihBahan(b: BarisKalk, nama: string) {
  b.nama = nama
  const s = opsiSatuan({ ...b, satuan: '' })
  if (!s.some(o => o.value === b.satuan)) b.satuan = s[0]?.value ?? ''
}
function tambahBaris(nama?: string) {
  const b: BarisKalk = { k: ++nomor, nama: '', qty: 1, satuan: '' }
  baris.value.push(b)
  if (nama) pilihBahan(baris.value[baris.value.length - 1]!, nama)
}
function hapusBaris(k: number) {
  if (baris.value.length <= 1) {
    const b = baris.value[0]
    if (b) Object.assign(b, { nama: '', qty: 1, satuan: '' })
    return
  }
  baris.value = baris.value.filter(b => b.k !== k)
}
function ubahQty(b: BarisKalk, d: number) {
  b.qty = Math.max(0, Math.round(((Number(b.qty) || 0) + d) * 100) / 100)
}
function kosongkan() {
  baris.value = [{ k: ++nomor, nama: '', qty: 1, satuan: '' }]
  porsi.value = 1
  harga.value = 0
}

// --- category picker (StockPilihBahan, same as Form Order Belanja) ---------------
const pemilih = ref<{ open: boolean, k: number | null }>({ open: false, k: null })
const namaDiForm = computed(() => baris.value.map(b => b.nama).filter(Boolean))
function bukaPemilih(k: number | null = null) {
  pemilih.value = { open: true, k }
}
function pakaiPilihan(nama: string[]) {
  const k = pemilih.value.k
  if (k !== null) {
    const b = baris.value.find(x => x.k === k)
    if (b && nama[0]) pilihBahan(b, nama[0])
    return
  }
  // Multi pick: unticked names leave the list, new names fill empty rows first.
  const pilih = new Set(nama)
  baris.value = baris.value.filter(b => !b.nama || pilih.has(b.nama))
  const ada = new Set(baris.value.map(b => b.nama).filter(Boolean))
  for (const n of nama) {
    if (ada.has(n)) continue
    const kosong = baris.value.find(b => !b.nama)
    if (kosong) pilihBahan(kosong, n)
    else tambahBaris(n)
  }
  if (!baris.value.length) tambahBaris()
}

const infoPur = (nama: string) => {
  const b = ctx.value.PB.get(nama.toLowerCase())
  if (!b) return null
  return ctx.value.PRODUK.get(nama.toLowerCase())
    ?? (b.produk && b.produk !== '-' ? ctx.value.PRODUK.get(b.produk.toLowerCase()) ?? null : null)
}
const biaya = (b: BarisKalk) => {
  const it = ctx.value.PB.get(b.nama.trim().toLowerCase())
  if (!it) return { biaya: 0, campur: false, hilang: true }
  const dari = b.satuan.trim() || String(it.satuan ?? '')
  const c = dari && it.satuan && dari.toLowerCase() !== String(it.satuan).toLowerCase()
    ? konvSatuan(Number(b.qty) || 0, dari, it.satuan, infoPur(b.nama.trim()))
    : (Number(b.qty) || 0)
  if (c == null) return { biaya: per1(it) * (Number(b.qty) || 0), campur: true, hilang: false }
  return { biaya: per1(it) * c, campur: false, hilang: false }
}

const modal = computed(() => baris.value.reduce((a, b) => a + biaya(b).biaya, 0))
const buffer = computed(() => spareModal(set.value.buffer))
const spare = computed(() => modal.value * buffer.value)
const total = computed(() => modal.value + spare.value)
const porsiBagi = computed(() => Math.max(1, Number(porsi.value) || 1))
const perPorsi = computed(() => total.value / porsiBagi.value)
const cogs = computed(() => (Number(harga.value) > 0 ? perPorsi.value / Number(harga.value) : null))
const hargaIdeal = computed(() => perPorsi.value / (Number(set.value.targetFood) || 0.33))
const warnaCogs = computed(() => {
  if (cogs.value == null) return 'neutral' as const
  const t = ambangOf(set.value, { nama: '', jenis: 'food' })
  return cogs.value <= t * 0.75 ? 'success' as const : cogs.value <= t ? 'warning' as const : 'error' as const
})
</script>

<template>
  <AppPage
    title="Kalkulator HPP"
    description="Hitung modal & harga jual sebuah menu tanpa menyimpan apa pun"
  >
    <div class="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <AppPanel title="Bahan menu">
        <template #actions>
          <UButton
            label="Kosongkan"
            icon="i-lucide-eraser"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="kosongkan"
          />
        </template>
        <!-- Same rows as Form Order Belanja: grouped search + category picker,
             stepper, add buttons under the last row. -->
        <div class="flex flex-col gap-3">
          <div
            v-for="b in baris"
            :key="b.k"
            class="rounded-xl border border-default bg-muted p-3"
          >
            <UFormField label="Bahan">
              <div class="flex items-center gap-2">
                <USelectMenu
                  :model-value="b.nama || undefined"
                  :items="opsiBahan"
                  value-key="value"
                  placeholder="Cari bahan…"
                  :search-input="{ placeholder: 'Ketik nama bahan…' }"
                  class="min-w-0 flex-1"
                  @update:model-value="pilihBahan(b, String($event ?? ''))"
                />
                <UButton
                  icon="i-lucide-layout-grid"
                  color="neutral"
                  variant="soft"
                  square
                  class="size-10 shrink-0 justify-center lg:size-8"
                  title="Pilih dari kategori"
                  aria-label="Pilih bahan dari kategori"
                  @click="bukaPemilih(b.k)"
                />
              </div>
            </UFormField>
            <div class="mt-2 flex flex-wrap items-end gap-2">
              <div
                class="flex items-center gap-1.5"
                role="group"
                aria-label="Jumlah"
              >
                <UButton
                  icon="i-lucide-minus"
                  variant="outline"
                  square
                  class="size-10 justify-center lg:size-8"
                  aria-label="Kurangi jumlah"
                  @click="ubahQty(b, -1)"
                />
                <UInput
                  v-model.number="b.qty"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-20"
                  :ui="{ base: 'text-center font-bold' }"
                  aria-label="Jumlah"
                />
                <UButton
                  icon="i-lucide-plus"
                  variant="outline"
                  square
                  class="size-10 justify-center lg:size-8"
                  aria-label="Tambah jumlah"
                  @click="ubahQty(b, 1)"
                />
              </div>
              <UFormField
                label="Satuan"
                class="min-w-28 flex-1"
              >
                <USelect
                  v-model="b.satuan"
                  :items="opsiSatuan(b)"
                  placeholder="Satuan beli"
                  class="w-full"
                />
              </UFormField>
              <div class="flex min-w-24 flex-1 flex-col items-end justify-end pb-1 text-right">
                <span class="text-[11px] text-muted">Biaya</span>
                <b
                  class="num text-sm"
                  :class="biaya(b).hilang && b.nama.trim() ? 'text-error' : 'text-highlighted'"
                >
                  {{ b.nama.trim() ? rupiah(Math.round(biaya(b).biaya)) : '—' }}{{ biaya(b).campur ? ' ⚠' : '' }}
                </b>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                square
                class="size-10 justify-center lg:size-8"
                aria-label="Hapus baris"
                @click="hapusBaris(b.k)"
              />
            </div>
          </div>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="() => tambahBaris()"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />
            Tambah baris bahan
          </button>
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
            @click="bukaPemilih()"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="size-4"
            />
            Pilih bahan dari kategori
          </button>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2 border-t border-default pt-4">
          <UFormField label="Jumlah porsi">
            <UInput
              v-model.number="porsi"
              type="number"
              min="1"
            />
          </UFormField>
          <UFormField label="Harga jual per porsi">
            <UInput
              v-model.number="harga"
              type="number"
              min="0"
            />
          </UFormField>
        </div>
      </AppPanel>

      <AppPanel title="Hasil">
        <div class="flex flex-col gap-2 text-sm">
          <div class="flex justify-between gap-2">
            <span class="text-muted">Modal bahan</span>
            <b class="num text-highlighted">{{ rupiah(Math.round(modal)) }}</b>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-muted">Spare ({{ Math.round(buffer * 1000) / 10 }}%)</span>
            <b class="num text-highlighted">{{ rupiah(Math.round(spare)) }}</b>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-muted">Modal + spare</span>
            <b class="num text-highlighted">{{ rupiah(Math.round(total)) }}</b>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-muted">Per porsi (÷ {{ porsiBagi }})</span>
            <b class="num text-highlighted">{{ rupiah(Math.round(perPorsi)) }}</b>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted">COGS</span>
            <span
              v-if="cogs == null"
              class="text-dimmed"
            >isi harga jual dulu</span>
            <AppStatus
              v-else
              :color="warnaCogs"
            >
              {{ persen(cogs, 1) }}
            </AppStatus>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-muted">Harga ideal (COGS {{ Math.round(Number(set.targetFood) * 100) }}%)</span>
            <b class="num text-primary-700">{{ rupiah(Math.round(hargaIdeal)) }}</b>
          </div>
        </div>
        <p
          v-if="baris.some(b => biaya(b).hilang && b.nama.trim())"
          class="mt-3 text-sm text-error"
        >
          Ada bahan yang tidak ada di daftar harga — diminta, bukan dihitung nol.
        </p>
        <p
          v-if="baris.some(b => biaya(b).campur)"
          class="mt-1 text-sm text-warning"
        >
          Ada satuan yang tidak bisa dikonversi (⚠) — angkanya dipakai apa adanya.
        </p>
      </AppPanel>
    </div>

    <StockPilihBahan
      v-model:open="pemilih.open"
      :produk="bahanPilih"
      :awal="namaDiForm"
      :tunggal="pemilih.k !== null"
      @pakai="pakaiPilihan"
    />
  </AppPage>
</template>
