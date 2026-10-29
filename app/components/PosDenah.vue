<!--
  The POS table plan. Draws one venue layout (geometry from
  app/utils/venue-layouts.ts, the same source Reservasi and Marketing draw)
  with POS occupancy on top: a table holding an open order gets a thick ring
  and the cashier's name. Clicking picks the table for the current order.
  The full plan editor lives in the Reservasi module (DenahEditor); POS never
  edits plans.
-->
<script setup lang="ts">
import type { LayoutDenah } from '~/utils/venue-layouts'
import { SEAT_H, SEAT_W } from '~/utils/venue-layouts'

const props = withDefaults(defineProps<{
  layout: LayoutDenah
  /** Table ids holding an open order right now. */
  terisi?: string[]
  /** The table picked for the current order. */
  terpilih?: string | null
}>(), {
  terisi: () => [],
  terpilih: null,
})

const emit = defineEmits<{ pilih: [meja: string] }>()

const persen = (n: number, total: number): string => `${(n / total) * 100}%`
</script>

<template>
  <div
    class="seat-floor relative w-full overflow-hidden rounded-panel border border-default"
    role="group"
    aria-label="Denah meja"
  >
    <div
      class="relative w-full"
      style="aspect-ratio: 1600 / 1160"
    >
      <button
        v-for="t in props.layout.tables"
        :key="t.id"
        type="button"
        :title="`Meja ${t.id}`"
        :aria-pressed="props.terpilih === t.id"
        :class="['seat-tbl', `seat-${t.zone}`, { 'seat-isi': props.terisi.includes(t.id), 'seat-pilih': props.terpilih === t.id }]"
        :style="{ left: persen(t.x, SEAT_W), top: persen(t.y, SEAT_H), width: persen(t.w, SEAT_W), height: persen(t.h, SEAT_H) }"
        @click="emit('pilih', t.id)"
      >
        {{ t.id }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.seat-floor {
  background: var(--color-seat-floor);
}
.seat-tbl {
  position: absolute;
  border: 1px solid var(--color-seat-line);
  border-radius: 8px;
  color: var(--color-seat-ink);
  font-size: clamp(10px, 1.6vw, 15px);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  cursor: pointer;
}
.seat-green { background: var(--color-seat-green); }
.seat-blue { background: var(--color-seat-blue); }
.seat-wood { background: var(--color-seat-wood); }
.seat-vip { background: var(--color-seat-vip); }
.seat-dark { background: var(--color-seat-dark); }
.seat-diamond { background: var(--color-seat-diamond); }
.seat-ext { background: var(--color-seat-ext); }
.seat-isi {
  outline: 3px solid var(--ui-error);
  outline-offset: -3px;
}
.seat-pilih {
  outline: 3px solid var(--ui-warning);
  outline-offset: 2px;
}
</style>
