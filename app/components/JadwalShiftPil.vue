<!--
  A shift as the old sheet drew it: a pill in the shift's own colour (PAGI blue,
  SIANG orange, OFF red — the Excel colours the crew read from the board,
  deploy/jadwal/index.html:806). The colour is admin-editable DATA from the
  setting blob, not a constant here; the text colour is picked from its
  brightness (`kelasTeksShift`). The word is always there, so the colour is
  never the only signal.
-->
<script setup lang="ts">
import type { ShiftDef } from '~/utils/jadwal'
import { kelasTeksShift } from '~/utils/jadwal'

const props = withDefaults(defineProps<{
  def: ShiftDef
  /** Shown instead of the shift name (a free note in the cell). */
  label?: string
  size?: 'sm' | 'md'
}>(), { size: 'md' })

const gaya = computed(() => ({ backgroundColor: props.def.w }))
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-full font-bold"
    :class="[kelasTeksShift(def.w), size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs']"
    :style="gaya"
  >{{ label || def.n }}</span>
</template>
