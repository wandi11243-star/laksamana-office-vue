<!--
  One shared kanban board (marketing pipeline, BD boards). Columns are pastel
  trays (bg-muted + border-default) sitting on the muted page, in
  the same family as AppPanel — white cards (AppKanbanCard) lift off the peach
  through their own border and shadow. The single highlight language while
  dragging stays (border-primary-400 + bg-primary-50), which reads clearly over
  the pastel. Drag & drop is the only way to move cards (touch users change
  the status from the detail page instead). Card visuals stay with the caller
  via the `card` slot; the board only owns drag state (useKanbanDrag) and
  emits `move` — props down, events up. Guards (marketing stage rules, BD Done
  check) live in the caller.
-->
<script setup lang="ts" generic="T extends { id: string }">
import { useKanbanDrag } from '~/composables/useKanbanDrag'

export interface AppKanbanColumn<T> {
  id: string
  title?: string
  count?: number
  items: T[]
}

const props = withDefaults(defineProps<{
  columns: AppKanbanColumn<T>[]
  /** False hides the drag affordance everywhere — the
   *  reason stays visible via tooltip, never a silent off. */
  canDrag?: boolean
  dragReason?: string
  layout?: 'grid' | 'scroll'
  emptyText?: string
  /** Text for the fallback card when the caller provides no `card` slot. */
  titleOf?: (item: T) => string
}>(), {
  canDrag: true,
  dragReason: '',
  layout: 'grid',
  emptyText: 'Kosong',
})

const emit = defineEmits<{
  move: [payload: { id: string, to: string }]
  cardClick: [payload: { id: string, column: string }]
}>()

const drag = useKanbanDrag()

const judul = (item: T) => props.titleOf?.(item)
  ?? String((item as Record<string, unknown>).nama ?? (item as Record<string, unknown>).name ?? item.id)

function onCardClick(itemId: string, colId: string) {
  if (drag.swallowClick()) return
  emit('cardClick', { id: itemId, column: colId })
}

const trackClass = computed(() => props.layout === 'scroll'
  ? 'grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2'
  : 'grid gap-3 lg:grid-cols-6')

function onDragOver(colId: string) {
  if (!props.canDrag) return
  drag.dragOver(colId)
}

function onDrop(ev: DragEvent, colId: string) {
  const id = drag.dropTo(ev)
  if (!id) return
  // Same-column drops only swallow the follow-up click, they move nothing.
  if (props.columns.find(c => c.id === colId)?.items.some(i => i.id === id)) return
  emit('move', { id, to: colId })
}

defineExpose({ swallowClick: drag.swallowClick })
</script>

<template>
  <div :class="trackClass">
    <section
      v-for="col in columns"
      :key="col.id"
      class="kanban-col flex min-w-0 flex-col rounded-xl border border-default bg-muted transition-[background-color,border-color] duration-200 ease-laks"
      :class="drag.overColumn.value === col.id ? 'border-primary-400 bg-primary-50' : 'border-default'"
      @dragover.prevent="onDragOver(col.id)"
      @dragleave="drag.leaveColumn($event, col.id)"
      @drop="onDrop($event, col.id)"
    >
      <header class="flex items-center gap-2 px-3 py-2.5">
        <slot
          name="header"
          :column="col"
        >
          <span class="text-sm font-bold text-highlighted">{{ col.title ?? col.id }}</span>
          <span class="num ml-auto rounded-full bg-muted px-2 text-xs font-bold">{{ col.count ?? col.items.length }}</span>
        </slot>
      </header>
      <div class="flex min-h-16 flex-1 flex-col gap-2 px-2 pb-2">
        <template
          v-for="item in col.items"
          :key="item.id"
        >
          <slot
            name="card"
            :item="item"
            :column="col"
            :dragging="drag.draggedId.value === item.id"
            :can-drag="canDrag"
            :drag-reason="dragReason"
            :drag-start="(ev: DragEvent) => drag.dragStart(ev, item.id)"
            :drag-end="drag.dragEnd"
            :swallow-click="drag.swallowClick"
          >
            <AppKanbanCard
              :dragging="drag.draggedId.value === item.id"
              :can-drag="canDrag"
              :drag-reason="dragReason"
              @dragstart="(ev: DragEvent) => drag.dragStart(ev, item.id)"
              @dragend="drag.dragEnd"
              @card-click="onCardClick(item.id, col.id)"
            >
              <template #title>
                <p class="text-sm font-semibold text-highlighted">
                  {{ judul(item) }}
                </p>
              </template>
            </AppKanbanCard>
          </slot>
        </template>
        <slot
          name="empty"
          :column="col"
        >
          <p
            v-if="!col.items.length"
            class="py-3 text-center text-xs text-dimmed"
          >
            {{ emptyText }}
          </p>
        </slot>
        <slot
          name="footer"
          :column="col"
        />
      </div>
    </section>
  </div>
</template>
