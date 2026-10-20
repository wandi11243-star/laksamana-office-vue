<!--
  Stock › HPP › Pemakaian & Selisih (old `deploy/stock/hpp/index.html:243`, JUDUL pakai `:836`).

  "Stok awal, belanja, pemakaian, dan opname — selisihnya jadi lampu."
  Formula (`hitungPakai`, hpp/index.html:3125): masuk = sa + beli;
  tercatat = resep + spoil + team + rnd + comp; aktual = masuk − opname;
  selisih = aktual − tercatat. Lamp thresholds come from Pengaturan.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getHppIngredients, hppSettings, hppUsage, patchHppUsage, type BarisPakai } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, hariIni, rupiah } from '~/utils/format'
import { buatKonteks, hitungPakai, SET_DEFAULT } from '~/utils/stock-hpp'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['hpp'] })

const toast = useToast()

const bulan = ref(hariIni().slice(0, 7))
const dataQ = useAsyncData('hpp-pakai', () => hppUsage(bulan.value), {
  watch: [bulan],
  default: () => ({ data: { bulan: '', baris: [] as BarisPakai[], penjualan: 0, catatan: '', daftarBulan: [] as string[] }, versi: undefined }),
})
const bahanQ = useAsyncData('hpp-pakai-bahan', getHppIngredients, { default: () => ({ rows: [] }) })
const setQ = useAsyncData('hpp-pakai-set', hppSettings, { default: () => ({ data: SET_DEFAULT, versi: undefined }) })
const set = computed(() => ({ ...SET_DEFAULT, ...(setQ.data.value?.data ?? {}) }))
const versi = computed(() => dataQ.data.value?.versi)

const ctx = computed(() => buatKonteks(
  (bahanQ.data.value?.rows ?? []).map(b => ({
    nama: String(b.nama ?? ''),
    satuan: String(b.satuan ?? ''),
    qty_beli: Number(b.qty_beli ?? 0),
    harga_beli: Number(b.harga_beli ?? 0),
  })),
  [],
))

const baris = computed(() => dataQ.data.value?.data.baris ?? [])
const hitung = (b: BarisPakai) => hitungPakai(ctx.value, b, set.value)
const tampil = computed(() => baris.value.filter(b => hitung(b).ada))

const cari = ref('')
const saring = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return q ? tampil.value.filter(b => b.bahan.toLowerCase().includes(q)) : tampil.value
})

const lampuWarna = (l: string): 'error' | 'warning' | 'success' => (l === 'merah' ? 'error' : l === 'kuning' ? 'warning' : 'success')
const hijau = computed(() => saring.value.filter(b => hitung(b).lampu === 'hijau').length)
const kuning = computed(() => saring.value.filter(b => hitung(b).lampu === 'kuning').length)
const merah = computed(() => saring.value.filter(b => hitung(b).lampu === 'merah').length)
const rugi = computed(() => saring.value.reduce((a, b) => {
  const c = hitung(b)
  return a + (c.selisih > 0 ? c.nilai : 0)
}, 0))
const nilaiAktual = computed(() => saring.value.reduce((a, b) => a + hitung(b).nilaiAktual, 0))
const penjualan = computed(() => Number(dataQ.data.value?.data.penjualan ?? 0) || 0)
const cogsAktual = computed(() => (penjualan.value > 0 ? nilaiAktual.value / penjualan.value : null))

const KOLOM_EDIT = ['sa', 'beli', 'resep', 'spoil', 'team', 'rnd', 'comp', 'opname'] as const
const kolom: TableColumn<BarisPakai>[] = [
  { accessorKey: 'bahan', header: 'Bahan' },
  { accessorKey: 'sa', header: 'Stok awal' },
  { accessorKey: 'beli', header: 'Belanja' },
  { accessorKey: 'resep', header: 'Resep' },
  { accessorKey: 'opname', header: 'Opname' },
  { accessorKey: 'selisih', header: 'Selisih' },
  { accessorKey: 'lampu', header: '' },
]

const sheet = ref(false)
const edit = ref<BarisPakai | null>(null)
const f = ref<Record<string, number>>({})
function bukaUbah(b: BarisPakai) {
  edit.value = b
  f.value = { sa: Number(b.sa ?? 0), beli: Number(b.beli ?? 0), resep: Number(b.resep ?? 0), spoil: Number(b.spoil ?? 0), team: Number(b.team ?? 0), rnd: Number(b.rnd ?? 0), comp: Number(b.comp ?? 0), opname: Number(b.opname ?? 0) }
  sheet.value = true
}

const penjualanF = ref(0)
const catatanF = ref('')
watch(() => dataQ.data.value?.data, (d) => {
  penjualanF.value = Number(d?.penjualan ?? 0) || 0
  catatanF.value = String(d?.catatan ?? '')
}, { immediate: true })

const menyimpan = ref(false)
async function simpan() {
  menyimpan.value = true
  try {
    const kirim: BarisPakai[] = []
    if (edit.value) {
      kirim.push({
        bahan: edit.value.bahan,
        sa: f.value.sa,
        beli: f.value.beli,
        resep: f.value.resep,
        spoil: f.value.spoil,
        team: f.value.team,
        rnd: f.value.rnd,
        comp: f.value.comp,
        opname: f.value.opname,
      })
    }
    await patchHppUsage(bulan.value, {
      ...(kirim.length ? { baris: kirim } : {}),
      penjualan: penjualanF.value,
      catatan: catatanF.value,
    }, versi.value)
    sheet.value = false
    edit.value = null
    await dataQ.refresh()
    toast.add({ title: 'Pemakaian tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => dataQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

const daftarBulan = computed(() => dataQ.data.value?.data.daftarBulan ?? [])
</script>

<template>
  <AppPage
    title="Pemakaian & Selisih"
    description="Stok awal, belanja, pemakaian, dan opname — selisihnya jadi lampu"
  >
    <template #actions>
      <USelect
        v-model="bulan"
        :items="(daftarBulan.length ? daftarBulan : [bulan]).map(b => ({ value: b, label: b }))"
        aria-label="Pilih bulan"
      />
      <UButton
        label="Simpan bulan"
        icon="i-lucide-save"
        :loading="menyimpan"
        @click="simpan"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Hijau"
        :value="String(hijau)"
        satuan="bahan"
        icon="i-lucide-check-circle-2"
        tone="success"
      />
      <AppStat
        label="Kuning"
        :value="String(kuning)"
        satuan="bahan"
        icon="i-lucide-alert-circle"
        tone="warning"
      />
      <AppStat
        label="Merah"
        :value="String(merah)"
        satuan="bahan"
        icon="i-lucide-alert-octagon"
        tone="error"
      />
      <AppStat
        label="Nilai kerugian"
        :value="rupiah(Math.round(rugi))"
        icon="i-lucide-banknote"
        tone="error"
      />
      <AppStat
        label="COGS aktual"
        :value="cogsAktual == null ? '—' : `${(Math.round(cogsAktual * 1000) / 10).toFixed(1)}%`"
        icon="i-lucide-gauge"
        tone="info"
      />
    </AppStatGrid>

    <AppPanel title="Catatan bulan">
      <AppFilterGrid>
        <UFormField label="Penjualan bulan ini">
          <UInput
            v-model.number="penjualanF"
            type="number"
            min="0"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UInput
            v-model="catatanF"
            placeholder="Catatan tutup bulan"
          />
        </UFormField>
      </AppFilterGrid>
      <p class="mt-2 text-sm text-muted">
        COGS aktual = nilai pakai aktual ÷ penjualan — selalu berbeda dari COGS teoretis di Dashboard, dan selisih
        keduanya persis yang dicari tiap tutup bulan. Nilai pakai aktual: {{ rupiah(Math.round(nilaiAktual)) }}.
      </p>
    </AppPanel>

    <AppPanel title="Baris bahan">
      <template #head>
        <UInput
          v-model="cari"
          placeholder="Cari bahan…"
          icon="i-lucide-search"
        />
      </template>
      <div class="hidden lg:block">
        <UTable
          :columns="kolom"
          :data="saring"
        >
          <template #sa-cell="{ row }">
            {{ angka(Number(row.original.sa ?? 0)) }}
          </template>
          <template #beli-cell="{ row }">
            {{ angka(Number(row.original.beli ?? 0)) }}
          </template>
          <template #resep-cell="{ row }">
            {{ angka(Number(row.original.resep ?? 0)) }}
          </template>
          <template #opname-cell="{ row }">
            {{ angka(Number(row.original.opname ?? 0)) }}
          </template>
          <template #selisih-cell="{ row }">
            <span :class="hitung(row.original).selisih > 0 ? 'text-error' : 'text-muted'">
              {{ hitung(row.original).selisih > 0 ? '+' : '' }}{{ Math.round(hitung(row.original).selisih * 100) / 100 }} · {{ (Math.round(hitung(row.original).p * 10) / 10).toFixed(1) }}%
            </span>
            <div
              v-if="hitung(row.original).nilai"
              class="text-xs"
              :class="hitung(row.original).selisih > 0 ? 'text-error' : 'text-dimmed'"
            >
              {{ rupiah(Math.round(hitung(row.original).nilai)) }}
            </div>
          </template>
          <template #lampu-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <AppStatus
                :color="lampuWarna(hitung(row.original).lampu)"
                size="sm"
              >
                {{ hitung(row.original).lampu }}
              </AppStatus>
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                size="sm"
                :aria-label="`Ubah ${row.original.bahan}`"
                @click="bukaUbah(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
      <div class="flex flex-col gap-2 lg:hidden">
        <div
          v-for="b in saring.slice(0, 80)"
          :key="b.bahan"
          class="flex items-center justify-between gap-2 rounded-panel border border-default p-3"
        >
          <div>
            <b class="text-highlighted">{{ b.bahan }}</b>
            <p class="text-sm text-muted">
              Selisih {{ hitung(b).selisih > 0 ? '+' : '' }}{{ Math.round(hitung(b).selisih * 100) / 100 }}
            </p>
          </div>
          <div class="flex items-center gap-1">
            <AppStatus
              :color="lampuWarna(hitung(b).lampu)"
              size="sm"
            >
              {{ hitung(b).lampu }}
            </AppStatus>
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              :aria-label="`Ubah ${b.bahan}`"
              @click="bukaUbah(b)"
            />
          </div>
        </div>
        <p
          v-if="!saring.length"
          class="text-sm text-dimmed"
        >
          Belum ada baris bulan ini.
        </p>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="edit ? `Ubah — ${edit.bahan}` : 'Ubah baris'"
    >
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-2">
          <UFormField
            v-for="k in KOLOM_EDIT"
            :key="k"
            :label="k === 'sa' ? 'Stok awal' : k === 'beli' ? 'Belanja' : k === 'resep' ? 'Pakai resep' : k === 'opname' ? 'Stok opname' : k"
          >
            <UInput
              v-model.number="f[k]"
              type="number"
            />
          </UFormField>
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="sheet = false"
          />
          <UButton
            label="Simpan"
            :loading="menyimpan"
            @click="simpan"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
