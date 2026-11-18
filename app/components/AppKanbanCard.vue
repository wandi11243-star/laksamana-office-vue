<!--
  Generic kanban card shell: title / meta / actions slots. The whole card is
  the drag affordance (cursor-grab, never cursor-pointer, with a "drag to
  move" tooltip); when dragging is not allowed the reason shows as a tooltip
  instead of silently doing nothing. Clicks inside `actions` never bubble up
  to the card, so buttons there don't open the card.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  dragging?: boolean
  /** False when the signer may not move cards — the how, not a silent off. */
  canDrag?: boolean
  dragReason?: string
  /** Roomier card (old Marketing pipeline): more padding and a hover lift. */
  lega?: boolean
}>(), {
  dragging: false,
  canDrag: true,
  dragReason: '',
})

const emit = defineEmits<{
  cardClick: []
  dragstart: [ev: DragEvent]
  dragend: []
}>()

const hint = computed(() => props.canDrag
  ? 'Seret untuk pindah kolom'
  : (props.dragReason || 'Tidak bisa diseret'))
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :draggable="canDrag"
    :title="hint"
    class="kanban-card rounded-lg border bg-default shadow-panel transition-[transform,opacity,border-color,box-shadow] duration-150 ease-laks active:scale-[0.98]"
    :class="[lega ? 'rounded-xl px-4 py-3.5 hover:-translate-y-0.5 hover:shadow-lg' : 'p-2.5', dragging ? 'is-drag scale-[1.02] opacity-40' : '', canDrag ? 'cursor-grab hover:border-accented active:cursor-grabbing' : 'cursor-not-allowed opacity-70']"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
    @click="emit('cardClick')"
    @keydown.enter="emit('cardClick')"
  >
    <div class="min-w-0">
      <slot name="title" />
    </div>
    <slot name="meta" />
    <div
      v-if="$slots.actions"
      @click.stop
    >
      <slot name="actions" />
    </div>
  </div>
</template>
