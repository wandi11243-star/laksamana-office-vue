<!--
  A Monday-first 42-box month grid (deploy/dw/index.html `.kt` — viewTamu
  :5356 and viewRekap :7099 draw the same thing). Each box is a button that
  calls back with its date; the content comes from the `hari` slot, so Kalender
  Tamu and Rekap Pegawai share one geometry. Boxes outside the month are drawn
  but marked, because the DW calendar truly covers them (linking a shift from
  a neighbouring month must keep its row visible).
-->
<script setup lang="ts">
import { HARI_SENIN, idxHari } from '~/utils/jadwal'
import { akhirBulanDw, mulaiKisi } from '~/utils/dw'
import { hariIni, tambahHari } from '~/utils/format'

const props = withDefaults(defineProps<{
  mk: string
  /** May this box be clicked? Default: every day. */
  bisa?: (tgl: string) => boolean
}>(), { bisa: () => true })

defineEmits<{ pilih: [tgl: string] }>()

const ini = hariIni()
const tanggal = computed(() => {
  const mulai = mulaiKisi(props.mk)
  return Array.from({ length: 42 }, (_, i) => tambahHari(mulai, i))
})
const luar = (d: string) => d < `${props.mk}-01` || d > akhirBulanDw(props.mk)
</script>

<template>
  <div class="grid grid-cols-7 gap-0.5 sm:gap-1">
    <div
      v-for="(h, i) in HARI_SENIN"
      :key="h"
      class="pb-1 text-center text-[11px] font-bold uppercase"
      :class="i >= 5 ? 'text-primary-700' : 'text-muted'"
    >
      {{ h.slice(0, 3) }}
    </div>
    <component
      :is="bisa(d) ? 'button' : 'div'"
      v-for="d in tanggal"
      :key="d"
      :type="bisa(d) ? 'button' : undefined"
      class="flex min-h-16 flex-col items-stretch gap-0.5 rounded-field border p-1 text-start focus-visible:outline-2 focus-visible:outline-primary sm:min-h-24 sm:p-1.5"
      :class="[
        d === ini ? 'border-primary-500 ring-1 ring-primary-400' : 'border-default',
        luar(d) ? 'bg-muted opacity-60' : 'bg-default',
        bisa(d) && 'hover:border-primary-400',
      ]"
      @click="bisa(d) && $emit('pilih', d)"
    >
      <span class="flex items-center gap-1 text-xs font-bold text-highlighted num">
        {{ Number(d.slice(8)) }}
        <em
          v-if="d === ini"
          class="text-[10px] font-semibold not-italic text-primary-700"
        >hari ini</em>
        <em
          v-else-if="idxHari(d) >= 5"
          class="text-[10px] font-semibold not-italic text-primary-700"
        >{{ HARI_SENIN[idxHari(d)]!.slice(0, 3) }}</em>
      </span>
      <slot
        name="hari"
        :tgl="d"
        :luar="luar(d)"
      />
    </component>
  </div>
</template>
