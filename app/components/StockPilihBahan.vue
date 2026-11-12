<!--
  Form Order Belanja › bahan picker, built like the Marketing Menu Kalkulator
  picker (MarketingKalkPilih): category tiles first, then that category's
  materials with a search box. Multi mode ticks several materials and adds
  them as rows; single mode (`tunggal`) fills one row and closes on the first
  pick. Materials come from the stock master (`kategori`, empty → "Lainnya").
-->
<script setup lang="ts">
import type { ProdukStock } from '~/composables/useStock'
import { angka } from '~/utils/format'

const props = defineProps<{
  produk: ProdukStock[]
  /** Names already on the form: shown ticked in multi mode. */
  awal: string[]
  tunggal: boolean
}>()
const emit = defineEmits<{ pakai: [nama: string[]] }>()
const open = defineModel<boolean>('open', { default: false })

const LAINNYA = 'Lainnya'
const katOf = (p: ProdukStock) => (p.kategori || '').trim() || LAINNYA

const kat = ref<string | null>(null)
const cari = ref('')
const dipilih = ref<Set<string>>(new Set())

watch(open, (o) => {
  if (!o) return
  kat.value = null
  cari.value = ''
  dipilih.value = new Set(props.tunggal ? [] : props.awal)
})

const aktif = computed(() => props.produk.filter(p => p.aktif !== false))
const kategori = computed(() => {
  const m = new Map<string, number>()
  for (const p of aktif.value) m.set(katOf(p), (m.get(katOf(p)) ?? 0) + 1)
  return [...m.entries()]
    .map(([nama, jml]) => ({ nama, jml }))
    .sort((a, b) => (a.nama === LAINNYA ? 1 : b.nama === LAINNYA ? -1 : a.nama.localeCompare(b.nama, 'id')))
})
// Typing in the category view searches every category at once.
const daftar = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const it = kat.value ? aktif.value.filter(p => katOf(p) === kat.value) : (q ? aktif.value : [])
  return (q ? it.filter(p => p.nama.toLowerCase().includes(q)) : it)
    .slice()
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
})

function tandai(nama: string, on: boolean) {
  if (props.tunggal) {
    emit('pakai', [nama])
    open.value = false
    return
  }
  const s = new Set(dipilih.value)
  if (on) s.add(nama)
  else s.delete(nama)
  dipilih.value = s
}
function cabut(nama: string) {
  tandai(nama, false)
}
function pakai() {
  emit('pakai', [...dipilih.value])
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="tunggal ? 'Pilih bahan untuk baris ini' : 'Pilih bahan dari kategori'"
    description="Bahan dari master Stock, dikelompokkan per kategori."
  >
    <div class="space-y-3">
      <div
        v-if="!tunggal && dipilih.size"
        class="flex flex-wrap items-center gap-1.5"
      >
        <span class="text-xs font-semibold text-muted">{{ angka(dipilih.size) }} dipilih:</span>
        <UBadge
          v-for="n in [...dipilih]"
          :key="n"
          color="neutral"
          variant="soft"
          class="gap-1"
        >
          {{ n }}
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="link"
            :aria-label="`Cabut ${n}`"
            @click="cabut(n)"
          />
        </UBadge>
      </div>

      <div
        v-if="kat"
        class="flex items-center gap-2"
      >
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="soft"
          label="Kategori"
          @click="kat = null; cari = ''"
        />
        <b class="truncate text-highlighted">{{ kat }}</b>
      </div>
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        :placeholder="kat ? `Cari di ${kat}…` : 'Cari bahan di semua kategori…'"
        class="w-full"
      />

      <!-- Category tiles (layer 3 on the sheet): name + how many materials. -->
      <div
        v-if="!kat && !cari.trim()"
        class="grid grid-cols-2 gap-2"
      >
        <button
          v-for="k in kategori"
          :key="k.nama"
          type="button"
          class="min-h-11 rounded-xl border border-default bg-muted p-3 text-left transition-colors hover:border-gold hover:bg-gold-soft/40"
          @click="kat = k.nama"
        >
          <span class="flex items-center gap-2 font-semibold text-highlighted">
            <UIcon
              name="i-lucide-folder"
              class="size-4 shrink-0 text-gold-deep"
            />
            <span class="truncate">{{ k.nama }}</span>
          </span>
          <span class="mt-1 block text-xs text-muted">{{ angka(k.jml) }} bahan</span>
        </button>
        <p
          v-if="!kategori.length"
          class="col-span-2 py-6 text-center text-sm text-dimmed"
        >
          Master bahan masih kosong.
        </p>
      </div>

      <ul
        v-else
        class="max-h-80 divide-y divide-default overflow-y-auto rounded-xl border border-default bg-default"
      >
        <li
          v-for="p in daftar"
          :key="p.nama"
        >
          <button
            v-if="tunggal"
            type="button"
            class="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
            @click="tandai(p.nama, true)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-highlighted">{{ p.nama }}</span>
              <span class="block text-xs text-muted">{{ kat ? (p.satuan as string[] | undefined)?.join(' · ') || '—' : katOf(p) }}</span>
            </span>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 text-dimmed"
            />
          </button>
          <label
            v-else
            class="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted"
          >
            <UCheckbox
              :model-value="dipilih.has(p.nama)"
              @update:model-value="tandai(p.nama, !!$event)"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-highlighted">{{ p.nama }}</span>
              <span class="block text-xs text-muted">{{ kat ? (p.satuan as string[] | undefined)?.join(' · ') || '—' : katOf(p) }}</span>
            </span>
          </label>
        </li>
        <li
          v-if="!daftar.length"
          class="px-3 py-6 text-center text-sm text-dimmed"
        >
          Tidak ada bahan yang cocok.
        </li>
      </ul>
    </div>
    <template
      v-if="!tunggal"
      #footer
    >
      <UButton
        color="neutral"
        variant="soft"
        label="Batal"
        @click="open = false"
      />
      <UButton
        icon="i-lucide-check"
        :label="`Pakai pilihan (${angka(dipilih.size)})`"
        :disabled="!dipilih.size"
        @click="pakai"
      />
    </template>
  </ResponsiveSheet>
</template>
