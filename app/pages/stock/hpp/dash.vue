<!--
  Stock › HPP › Dashboard HPP (old `deploy/stock/hpp/index.html:212`, JUDUL dash `:832`).

  COGS summary, the most wasteful menus, the ingredients moving the modal most
  (`kontribusiBahan`), and a per-line breakdown (`uraiBahan`) of one menu.
  Costs cascade client-side (stock.md F.1–F.4); the buffer applies once, on
  finished menus only.
-->
<script setup lang="ts">
import type { BahanHpp, ResepHpp } from '~/utils/pohon-resep'
import { getHppIngredients, getHppRecipes, hppSettings } from '~/composables/useStock'
import { angka, persen, rupiah } from '~/utils/format'
import {
  ambangOf,
  biayaBaris,
  buatKonteks,
  cogsOf,
  kontribusiBahan,
  modalMenu,
  modalPorsi,
  SET_DEFAULT,
  tanpaBahan,
  type KonteksHpp,
} from '~/utils/stock-hpp'

definePageMeta({ access: ['hpp'] })

const bahanQ = useAsyncData('hpp-dash-bahan', getHppIngredients, { default: () => ({ rows: [] as BahanHpp[] }) })
const resepQ = useAsyncData('hpp-dash-resep', getHppRecipes, { default: () => ({ rows: [] as ResepHpp[] }) })
const setQ = useAsyncData('hpp-dash-set', hppSettings, { default: () => ({ data: SET_DEFAULT, versi: undefined }) })

const set = computed(() => ({ ...SET_DEFAULT, ...(setQ.data.value?.data ?? {}) }))
const ctx = computed<KonteksHpp>(() => buatKonteks(
  (bahanQ.data.value?.rows ?? []).map(b => ({
    nama: String(b.nama ?? ''),
    satuan: String(b.satuan ?? ''),
    qty_beli: Number(b.qty_beli ?? 0),
    harga_beli: Number(b.harga_beli ?? 0),
    produk: String(b.produk ?? ''),
    sisi_harga: String(b.sisi_harga ?? ''),
  })),
  (resepQ.data.value?.rows ?? []).map(r => ({
    id: String(r.id ?? ''),
    nama: String(r.nama ?? ''),
    jenis: String(r.jenis ?? ''),
    tipe: String(r.tipe ?? ''),
    seksi: String(r.seksi ?? ''),
    yield_qty: Number(r.yield_qty ?? 1),
    yield_unit: String(r.yield_unit ?? ''),
    harga_baru: Number(r.harga_baru ?? 0),
    modal_manual: Number(r.modal_manual ?? 0),
    bahan: (r.bahan ?? []).map(b => ({ nama: b.nama, qty: Number(b.qty ?? 0), satuan: b.satuan, ref: b.ref, catatan: b.catatan })),
  })),
))

const dish = computed(() => (resepQ.data.value?.rows ?? []).filter(r => r.tipe === 'dish'))
const cogs = (nama: string, jenis: string) => {
  const r = ctx.value.PR.get(`${jenis}|${nama.toLowerCase()}`) ?? ctx.value.PR.get(nama.toLowerCase())
  return r ? cogsOf(ctx.value, r, set.value.buffer) : null
}
const dishCogs = computed(() => dish.value
  .map(r => ({ nama: String(r.nama ?? ''), jenis: String(r.jenis ?? ''), c: cogs(String(r.nama ?? ''), String(r.jenis ?? '')) }))
  .filter(x => x.c != null) as { nama: string, jenis: string, c: number }[],
)
const rataFood = computed(() => {
  const v = dishCogs.value.filter(x => x.jenis !== 'drink').map(x => x.c)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
})
const rataDrink = computed(() => {
  const v = dishCogs.value.filter(x => x.jenis === 'drink').map(x => x.c)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
})
const boros = computed(() => [...dishCogs.value].sort((a, b) => b.c - a.c).slice(0, 10))
const diAtas = computed(() => dishCogs.value.filter((x) => {
  const r = ctx.value.PR.get(x.nama.toLowerCase())
  return x.c > ambangOf(set.value, r ?? undefined)
}).length)
const gerak = computed(() => kontribusiBahan(
  ctx.value,
  [...ctx.value.PR.values()].filter((r, i, a) => a.indexOf(r) === i),
  set.value.buffer,
).slice(0, 10))
const maksGerak = computed(() => Math.max(1, ...gerak.value.map(g => g.total)))

// --- uraian satu menu ------------------------------------------------------------
const pilihMenu = ref('')
const menuPilih = computed(() => {
  const r = ctx.value.PR.get(pilihMenu.value.toLowerCase())
  return r ?? null
})
const uraian = computed(() => {
  const r = menuPilih.value
  if (!r) return []
  return (r.bahan ?? []).filter(b => b?.nama).map(b => ({ baris: b, ...biayaBaris(ctx.value, b, r.jenis) }))
})
const modalPilih = computed(() => (menuPilih.value ? modalMenu(ctx.value, menuPilih.value, set.value.buffer) : null))
const warnaCogs = (c: number | null, jenis: string) => {
  if (c == null) return 'neutral' as const
  const t = jenis === 'drink' ? Number(set.value.targetDrink) : Number(set.value.targetFood)
  return c <= t * 0.75 ? 'success' as const : c <= t ? 'warning' as const : 'error' as const
}
</script>

<template>
  <AppPage
    title="Dashboard HPP"
    description="COGS, menu paling boros, dan bahan yang paling menggerakkan modal"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="bahanQ.refresh(); resepQ.refresh(); setQ.refresh()"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="COGS makanan"
        :value="rataFood == null ? '—' : persen(rataFood, 1)"
        icon="i-lucide-utensils"
        tone="gold"
      />
      <AppStat
        label="COGS minuman"
        :value="rataDrink == null ? '—' : persen(rataDrink, 1)"
        icon="i-lucide-cup-soda"
        tone="info"
      />
      <AppStat
        label="Menu di atas target"
        :value="String(diAtas)"
        satuan="menu"
        icon="i-lucide-trending-up"
        tone="error"
      />
      <AppStat
        label="Menu jadi"
        :value="String(dish.length)"
        satuan="menu"
        icon="i-lucide-book-open"
        tone="success"
      />
    </AppStatGrid>

    <div class="grid gap-4 lg:grid-cols-2">
      <AppPanel title="Menu paling boros">
        <div class="flex flex-col gap-2">
          <div
            v-for="m in boros"
            :key="`${m.jenis}|${m.nama}`"
            class="flex items-center justify-between gap-2"
          >
            <span class="min-w-0 flex-1 truncate text-sm text-default">{{ m.nama }}</span>
            <AppStatus
              :color="warnaCogs(m.c, m.jenis)"
              size="sm"
            >
              {{ persen(m.c, 1) }}
            </AppStatus>
          </div>
          <p
            v-if="!boros.length"
            class="text-sm text-dimmed"
          >
            Belum ada menu berharga.
          </p>
        </div>
      </AppPanel>
      <AppPanel title="Bahan penggerak modal">
        <div class="flex flex-col gap-2">
          <AppBar
            v-for="g in gerak"
            :key="g.nama"
            :label="g.nama"
            :value="rupiah(Math.round(g.total))"
            :persen="Math.round(g.total / maksGerak * 100)"
          />
          <p
            v-if="!gerak.length"
            class="text-sm text-dimmed"
          >
            Belum ada resep.
          </p>
        </div>
      </AppPanel>
    </div>

    <AppPanel title="Uraian bahan satu menu">
      <AppFilterGrid>
        <UFormField label="Menu">
          <USelect
            v-model="pilihMenu"
            :items="dish.map(r => ({ value: String(r.nama ?? ''), label: String(r.nama ?? '') }))"
            placeholder="Pilih menu jadi"
          />
        </UFormField>
      </AppFilterGrid>
      <div v-if="menuPilih && modalPilih">
        <p class="mb-2 text-sm text-muted">
          Modal {{ rupiah(Math.round(modalPilih.total)) }} (bahan {{ rupiah(Math.round(modalPilih.bahan)) }}{{
            modalPilih.spare > 0 ? ` + spare ${rupiah(Math.round(modalPilih.spare))}` : ''
          }}) · per porsi {{ rupiah(Math.round(modalPorsi(ctx, menuPilih, set.buffer))) }}{{
            tanpaBahan(menuPilih) && modalPilih.manual ? ' · modal ketikan tangan' : ''
          }}
        </p>
        <ul class="flex flex-col gap-1 text-sm">
          <li
            v-for="u in uraian"
            :key="u.baris.nama"
            class="flex justify-between gap-2"
          >
            <span class="text-default">
              {{ u.baris.nama }} <span class="text-muted">({{ u.baris.qty }} {{ u.baris.satuan }})</span>
              <span
                v-if="u.hilang"
                class="text-error"
              > · hilang</span>
              <span
                v-if="u.campur"
                class="text-warning"
              > · ⚠ satuan campur</span>
            </span>
            <b class="num text-highlighted">{{ rupiah(Math.round(u.biaya)) }}</b>
          </li>
        </ul>
        <p
          v-if="modalPilih.hilang.length"
          class="mt-2 text-sm text-error"
        >
          Bahan hilang: {{ modalPilih.hilang.join(', ') }} — dilaporkan, bukan dihitung nol.
        </p>
      </div>
      <p
        v-else
        class="text-sm text-dimmed"
      >
        Pilih menu untuk melihat rincian barisnya.
      </p>
      <p class="mt-2 text-sm text-muted">
        Angka: {{ angka(dishCogs.length) }} menu ber-COGS dari {{ angka(dish.length) }} menu jadi.
      </p>
    </AppPanel>
  </AppPage>
</template>
