<!--
  Menu Kalkulator › picker: category boxes first, then the category's menus
  with ticks (old kalkBukaPilih / kalkGambarPilih, deploy/marketing/index.html
  ~19210-19400). Menus already counted start ticked, so this sheet is also the
  place to REMOVE a menu. Single-row mode (`tunggal`) replaces one row's menu
  and closes on the first pick.
-->
<script setup lang="ts">
import type { MenuKalkMkt } from '~/utils/marketing-kalk'
import { idxWarnaKatKalkMkt, kategoriKalkMkt, refKalkMkt, WARNA_KAT_KALK_MKT } from '~/utils/marketing-kalk'
import { angka, rupiah } from '~/utils/format'

const props = defineProps<{ items: Record<string, MenuKalkMkt[]>, awal: string[], tunggal: boolean }>()
const emit = defineEmits<{ pakai: [refs: string[]] }>()
const open = defineModel<boolean>('open', { default: false })

const kat = ref<string | null>(null)
const cari = ref('')
const dipilih = ref<Set<string>>(new Set())

watch(open, (o) => {
  if (!o) return
  kat.value = null
  cari.value = ''
  dipilih.value = new Set(props.tunggal ? [] : props.awal)
})

const kategori = computed(() => kategoriKalkMkt(props.items))
const warna = (k: string) => WARNA_KAT_KALK_MKT[idxWarnaKatKalkMkt(k)]
const daftar = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const it = kat.value ? props.items[kat.value] ?? [] : []
  return q ? it.filter(m => m.n.toLowerCase().includes(q)) : it
})
const rentang = (min: number, max: number) => (!min ? 'harga belum diisi' : min === max ? rupiah(min) : `${rupiah(min)} – ${rupiah(max)}`)

function tandai(m: MenuKalkMkt, on: boolean) {
  const ref = refKalkMkt(m)
  if (props.tunggal) {
    emit('pakai', [ref])
    open.value = false
    return
  }
  const s = new Set(dipilih.value)
  if (on) s.add(ref)
  else s.delete(ref)
  dipilih.value = s
}
function semua(on: boolean) {
  const s = new Set(dipilih.value)
  for (const m of daftar.value) {
    if (on) s.add(refKalkMkt(m))
    else s.delete(refKalkMkt(m))
  }
  dipilih.value = s
}
function cabut(ref: string) {
  const s = new Set(dipilih.value)
  s.delete(ref)
  dipilih.value = s
}
function pakai() {
  emit('pakai', [...dipilih.value])
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="tunggal ? 'Pilih menu untuk baris ini' : 'Pilih menu dari kategori'"
    description="Menu & harga dari kategori Prasmanan di HPP & Resep."
  >
    <div class="space-y-3">
      <div
        v-if="!tunggal && dipilih.size"
        class="flex flex-wrap gap-1.5"
      >
        <span class="text-xs font-semibold text-muted">{{ angka(dipilih.size) }} dipilih:</span>
        <UBadge
          v-for="r in [...dipilih]"
          :key="r"
          color="neutral"
          variant="soft"
          class="gap-1"
        >
          {{ r.slice(r.indexOf('|') + 1) }}
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="link"
            :aria-label="`Cabut ${r}`"
            @click="cabut(r)"
          />
        </UBadge>
      </div>

      <div
        v-if="!kat"
        class="grid grid-cols-2 gap-2"
      >
        <button
          v-for="k in kategori"
          :key="k.kat"
          type="button"
          class="min-h-11 rounded-field border border-default p-3 text-left hover:bg-elevated"
          @click="kat = k.kat"
        >
          <span class="flex items-center gap-2 font-semibold text-highlighted">
            <span
              class="size-2.5 shrink-0 rounded-full"
              :class="warna(k.kat)"
            />
            {{ k.kat }}
          </span>
          <span class="mt-1 block text-xs text-muted">{{ angka(k.jml) }} menu · {{ rentang(k.min, k.max) }}</span>
        </button>
      </div>

      <template v-else>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            label="Kategori"
            @click="kat = null"
          />
          <b class="truncate text-highlighted">{{ kat }}</b>
        </div>
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari menu…"
          class="w-full"
        />
        <div
          v-if="!tunggal"
          class="flex gap-2"
        >
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            label="Pilih semua"
            @click="semua(true)"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            label="Kosongkan"
            @click="semua(false)"
          />
        </div>
        <ul class="max-h-80 divide-y divide-default overflow-y-auto rounded-field border border-default">
          <li
            v-for="m in daftar"
            :key="m.n"
          >
            <button
              v-if="tunggal"
              type="button"
              class="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-elevated"
              @click="tandai(m, true)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-highlighted">{{ m.n }}</span>
                <span class="block text-xs text-muted">{{ m.h == null ? 'harga belum diisi' : `${rupiah(m.h)} / ${m.u}` }}</span>
              </span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-dimmed"
              />
            </button>
            <label
              v-else
              class="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2"
            >
              <UCheckbox
                :model-value="dipilih.has(refKalkMkt(m))"
                @update:model-value="tandai(m, !!$event)"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-highlighted">{{ m.n }}</span>
                <span class="block text-xs text-muted">{{ m.h == null ? 'harga belum diisi' : `${rupiah(m.h)} / ${m.u}` }}</span>
              </span>
            </label>
          </li>
          <li
            v-if="!daftar.length"
            class="px-3 py-6 text-center text-sm text-dimmed"
          >
            Tidak ada menu yang cocok.
          </li>
        </ul>
      </template>
    </div>
    <template
      v-if="!tunggal"
      #footer
    >
      <UButton
        color="neutral"
        variant="outline"
        label="Batal"
        @click="open = false"
      />
      <UButton
        icon="i-lucide-check"
        :label="`Pakai pilihan (${angka(dipilih.size)})`"
        @click="pakai"
      />
    </template>
  </ResponsiveSheet>
</template>
