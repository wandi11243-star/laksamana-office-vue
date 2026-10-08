<!--
  Stock › HPP › Kalkulator HPP (old `deploy/stock/hpp/index.html:244`, JUDUL kalk `:837`).

  "Hitung modal & harga jual sebuah menu tanpa menyimpan apa pun." The modal
  is divided by the portion count BEFORE COGS (stock.md F.4); the buffer is
  shown as its own line (F.1–F.2).
-->
<script setup lang="ts">
import { getHppIngredients, getProducts, hppSettings } from '~/composables/useStock'
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
const produkQ = useAsyncData('hpp-kalk-produk', getProducts, { default: () => ({ rows: [], versions: {} }) })
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

const namaSemua = computed(() => (bahanQ.data.value?.rows ?? []).map(b => String(b.nama ?? '')))

interface BarisKalk { k: number, nama: string, qty: number, satuan: string }
let nomor = 0
const baris = ref<BarisKalk[]>([{ k: ++nomor, nama: '', qty: 1, satuan: '' }])
const porsi = ref(1)
const harga = ref(0)

function tambahBaris() {
  baris.value.push({ k: ++nomor, nama: '', qty: 1, satuan: '' })
}
function hapusBaris(k: number) {
  if (baris.value.length <= 1) return
  baris.value = baris.value.filter(b => b.k !== k)
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
        <div class="flex flex-col gap-2">
          <div
            v-for="b in baris"
            :key="b.k"
            class="grid gap-2 rounded-field border border-default p-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <UFormField label="Bahan">
              <UInput
                v-model="b.nama"
                list="hpp-kalk-nama"
                placeholder="Ketik nama bahan"
              />
            </UFormField>
            <UFormField label="Qty">
              <UInput
                v-model.number="b.qty"
                type="number"
                min="0"
              />
            </UFormField>
            <UFormField label="Satuan">
              <UInput
                v-model="b.satuan"
                placeholder="Sama dengan satuan beli bila kosong"
              />
            </UFormField>
            <div class="flex items-end">
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                aria-label="Hapus baris"
                @click="hapusBaris(b.k)"
              />
            </div>
          </div>
        </div>
        <datalist id="hpp-kalk-nama">
          <option
            v-for="n in namaSemua"
            :key="n"
            :value="n"
          />
        </datalist>
        <UButton
          label="Tambah baris"
          icon="i-lucide-plus"
          variant="outline"
          class="mt-3"
          @click="tambahBaris"
        />
        <div class="mt-3 grid grid-cols-2 gap-2">
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
  </AppPage>
</template>
