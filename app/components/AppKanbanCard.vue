<!--
  Generic kanban card shell: a grip handle plus title / meta / actions slots.
  The drag affordance is always visible (cursor-grab on the card and the grip,
  never cursor-pointer); when dragging is not allowed the reason shows as a
  tooltip instead of silently doing nothing. Clicks inside `actions` never
  bubble up to the card, so buttons and pickers there don't open the card.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  dragging?: boolean
  /** False when the signer may not move cards — the how, not a silent off. */
  canDrag?: boolean
  dragReason?: string
  showGrip?: boolean
}>(), {
  dragging: false,
  canDrag: true,
  dragReason: '',
  showGrip: true,
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
    class="kanban-card rounded-lg border bg-default p-2.5 shadow-panel transition-[transform,opacity,border-color,box-shadow] duration-150 ease-laks active:scale-[0.98]"
    :class="[dragging ? 'is-drag scale-[1.02] opacity-40' : '', canDrag ? 'cursor-grab hover:border-accented active:cursor-grabbing' : 'cursor-not-allowed opacity-70']"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
    @click="emit('cardClick')"
    @keydown.enter="emit('cardClick')"
  >
    <div class="flex items-start gap-1.5">
      <UIcon
        v-if="showGrip"
        name="i-lucide-grip-vertical"
        class="mt-0.5 size-4 shrink-0 text-dimmed"
        :class="canDrag ? 'cursor-grab' : 'cursor-not-allowed'"
      />
      <div class="min-w-0 flex-1">
        <slot name="title" />
      </div>
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
