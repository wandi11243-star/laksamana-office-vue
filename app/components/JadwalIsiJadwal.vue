<!--
  Isi Jadwal (deploy/jadwal/index.html isiSisa/gambarIsiSisa/isiSisaPilih
  :3702-3857, F.7). NO day is ticked when it opens: one tap must never touch a
  whole week of another head's work. Each day shows how many cells it will
  touch. "Timpa sel yang sudah terisi" is ON by default (the tool is named for
  what it does); every overwrite is still listed before saving. "Ikut minggu
  lalu" fills each cell with that person's shift on the same weekday last week
  (`shiftKruBawaan`), so the days-off pattern carries over.
-->
<script setup lang="ts">
import type { KruJadwal, PetaSel, SelJadwal, SettingJadwal } from '~/utils/jadwal'
import {
  HARI_SENIN, barisShift, kelasTeksShift, kunciSel, namaDivisiJadwal, shiftDef, shiftKruBawaan, shiftPilihan, tglSel, tujuhHari,
} from '~/utils/jadwal'

const props = defineProps<{
  set: SettingJadwal
  peta: PetaSel
  kru: KruJadwal[]
  div: string
  senin: string
}>()
const emit = defineEmits<{ pilih: [rows: SelJadwal[], nama: string] }>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const hari = ref([0, 0, 0, 0, 0, 0, 0])
const timpa = ref(true)
watch(open, (v) => {
  if (v) {
    hari.value = [0, 0, 0, 0, 0, 0, 0]
    timpa.value = true
  }
})

const tgl = computed(() => tujuhHari(props.senin))
const hitung = computed(() => tgl.value.map((d) => {
  let kosong = 0
  let terisi = 0
  for (const u of props.kru) {
    if (props.peta.get(kunciSel(u.id, d))) terisi++
    else kosong++
  }
  return kosong + (timpa.value ? terisi : 0)
}))
const total = computed(() => hitung.value.reduce((a, n, i) => a + (hari.value[i] ? n : 0), 0))
const adaHari = computed(() => hari.value.some(Boolean))
const shifts = computed(() => shiftPilihan(props.set, '').map(k => ({ k, def: shiftDef(props.set, k) })))

function pilih(k: string | null) {
  if (!adaHari.value) {
    toast.add({ title: 'Belum ada hari yang dicentang', color: 'warning' })
    return
  }
  const rows: SelJadwal[] = []
  for (const u of props.kru) {
    tgl.value.forEach((d, i) => {
      if (!hari.value[i]) return
      if (props.peta.get(kunciSel(u.id, d)) && !timpa.value) return
      rows.push(barisShift(props.set, u.id, d, k ?? shiftKruBawaan(props.set, props.peta, u.id, d)))
    })
  }
  if (!rows.length) {
    toast.add({ title: 'Tidak ada sel yang cocok dengan pilihan hari itu', color: 'info' })
    return
  }
  open.value = false
  emit('pilih', rows, k ? shiftDef(props.set, k).n : 'mengikuti minggu lalu')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Isi jadwal · ${total} sel`"
    lebar
  >
    <div class="space-y-3 text-sm">
      <p class="text-muted">
        Centang dulu hari yang mau diisi, lalu pilih shift-nya. Mis. centang <b>Selasa</b> saja lalu pilih
        <b>OFF</b> — seluruh kru divisi {{ namaDivisiJadwal(div) }} libur hari Selasa. Sel yang <b>sudah terisi
          ikut tertimpa</b>, dan yang tertimpa disebut satu per satu sebelum disimpan.
      </p>
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="(d, i) in tgl"
          :key="d"
          type="button"
          class="flex min-h-16 flex-col items-center justify-center rounded-field border px-0.5 py-1 text-[11px] focus-visible:outline-2 focus-visible:outline-primary"
          :class="hari[i] ? 'border-primary-500 bg-primary-100 text-primary-800' : 'border-default text-muted'"
          :aria-pressed="!!hari[i]"
          @click="hari[i] = hari[i] ? 0 : 1"
        >
          <UIcon
            :name="hari[i] ? 'i-lucide-square-check' : 'i-lucide-square'"
            class="size-4"
          />
          <b class="uppercase">{{ HARI_SENIN[i]!.slice(0, 3) }}</b>
          <span class="num">{{ tglSel(d).slice(0, 5) }}</span>
          <span class="num">{{ hitung[i] }} sel</span>
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          label="Semua hari"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="hari = [1, 1, 1, 1, 1, 1, 1]"
        />
        <UButton
          label="Kosongkan pilihan"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="hari = [0, 0, 0, 0, 0, 0, 0]"
        />
        <UCheckbox
          v-model="timpa"
          label="Timpa sel yang sudah terisi"
          class="ms-auto"
        />
      </div>
      <p
        v-if="!adaHari"
        class="rounded-field bg-muted px-3 py-2"
      >
        Centang dulu hari yang mau diisi di atas.
      </p>
      <p
        v-else-if="!total"
        class="rounded-field bg-warning/12 px-3 py-2"
      >
        Tidak ada sel yang akan tersentuh — divisi ini belum punya kru di lembar minggu itu.
      </p>
      <UButton
        label="Ikut minggu lalu"
        icon="i-lucide-star"
        block
        @click="pilih(null)"
      />
      <p class="text-muted">
        Tiap sel diisi shift orang itu pada <b>hari yang sama minggu lalu</b> — termasuk OFF-nya. Kru yang belum
        punya riwayat memakai shift kebiasaannya di Pengaturan. Atau pilih satu shift untuk semua:
      </p>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          v-for="p in shifts"
          :key="p.k"
          type="button"
          class="flex min-h-11 flex-col items-center justify-center rounded-field px-1 py-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary"
          :class="kelasTeksShift(p.def.w)"
          :style="{ backgroundColor: p.def.w }"
          @click="pilih(p.k)"
        >
          {{ p.def.n }}
          <small class="font-medium opacity-90">{{ p.def.libur ? '' : `${p.def.m}–${p.def.s}` }}</small>
        </button>
      </div>
    </div>
  </ResponsiveSheet>
</template>
