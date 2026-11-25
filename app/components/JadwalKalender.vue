<!--
  One person's month as a Monday-first calendar (deploy/jadwal/index.html
  viewSaya :4398 and viewRekap :3215 draw the same grid). An empty day reads
  "belum diatur" on a grey box, never as a day off. `bisa` decides whether a
  day is clickable; `tanda` marks days with a waiting request.
-->
<script setup lang="ts">
import type { PetaSel, SettingJadwal } from '~/utils/jadwal'
import { HARI_SENIN, akhirBulan, awalBulan, idxHari, jamSel, kunciSel, labelSel, shiftDef } from '~/utils/jadwal'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

const props = defineProps<{
  set: SettingJadwal
  peta: PetaSel
  uid: string
  mk: string
  bisa: boolean
  judulKlik?: string
  tanda?: Record<string, string>
}>()
const emit = defineEmits<{ pilih: [tgl: string] }>()

const dari = computed(() => awalBulan(props.mk))
const tanggal = computed(() => {
  const out: string[] = []
  for (let d = dari.value; d <= akhirBulan(props.mk); d = tambahHari(d, 1)) out.push(d)
  return out
})
const sel = (d: string) => props.peta.get(kunciSel(props.uid, d)) ?? null
const jam = (d: string) => jamSel(props.set, sel(d))
</script>

<template>
  <div class="grid grid-cols-7 gap-1 sm:gap-1.5">
    <div
      v-for="(h, i) in HARI_SENIN"
      :key="h"
      class="pb-1 text-center text-[11px] font-bold uppercase"
      :class="i >= 5 ? 'text-primary-700' : 'text-muted'"
    >
      {{ h.slice(0, 3) }}
    </div>
    <div
      v-for="n in idxHari(dari)"
      :key="`k${n}`"
    />
    <component
      :is="bisa ? 'button' : 'div'"
      v-for="d in tanggal"
      :key="d"
      type="button"
      class="flex min-h-16 flex-col items-stretch gap-0.5 rounded-md border p-1 text-start focus-visible:outline-2 focus-visible:outline-primary sm:min-h-20 sm:p-1.5"
      :class="[
        d === hariIni() ? 'border-primary-500 ring-1 ring-primary-400' : 'border-default',
        sel(d) ? 'bg-default' : 'bg-muted',
        bisa && 'hover:border-primary-400',
      ]"
      :title="`${fTgl(d)}${bisa && judulKlik ? ` — ${judulKlik}` : ''}`"
      @click="bisa && emit('pilih', d)"
    >
      <span class="flex items-center gap-1 text-xs font-bold text-highlighted num">
        <span :class="d === hariIni() ? 'tgl-bulat' : ''">{{ Number(d.slice(8)) }}</span>
        <span
          v-if="tanda?.[d] === 'MENUNGGU'"
          class="size-1.5 rounded-full bg-warning"
          title="pengajuan menunggu"
        />
      </span>
      <template v-if="sel(d)">
        <JadwalShiftPil
          :def="shiftDef(set, sel(d)!.t)"
          :label="labelSel(set, sel(d))"
          size="sm"
          class="justify-center truncate"
        />
        <span
          v-if="jam(d)"
          class="hidden text-center text-[10px] text-muted num sm:block"
        >{{ jam(d)!.m }}–{{ jam(d)!.s }}</span>
      </template>
      <span
        v-else
        class="text-[10px] italic text-dimmed"
      >belum diatur</span>
    </component>
  </div>
</template>
