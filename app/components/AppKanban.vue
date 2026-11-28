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
  /** Cap each column's card list (e.g. `max-h-[70dvh]`): the cards scroll inside
   *  the column instead of stretching the page. Empty = grow with the cards. */
  listClass?: string
  /** Narrowest column width (px) in the `scroll` layout; columns share any extra room. */
  colMin?: number
}>(), {
  colMin: 240,
  canDrag: true,
  dragReason: '',
  layout: 'grid',
  emptyText: 'Kosong',
})

const emit = defineEmits<{
  /** `sebelum`: the card it was dropped above (null = end of the column). */
  move: [payload: { id: string, to: string, sebelum?: string | null }]
  /** A drop inside the same column, for boards with a manual order. */
  reorder: [payload: { id: string, column: string, sebelum: string | null }]
  cardClick: [payload: { id: string, column: string }]
}>()

const drag = useKanbanDrag()

const judul = (item: T) => props.titleOf?.(item)
  ?? String((item as Record<string, unknown>).nama ?? (item as Record<string, unknown>).name ?? item.id)

function onCardClick(itemId: string, colId: string) {
  if (drag.swallowClick()) return
  emit('cardClick', { id: itemId, column: colId })
}

// `grid` stacks the columns on a phone; on desktop they keep a readable width
// and the board scrolls sideways. `scroll` is sideways at every width.
const trackClass = computed(() => props.layout === 'scroll'
  ? 'grid grid-flow-col gap-4'
  : 'grid gap-3 lg:grid-flow-col lg:auto-cols-[minmax(270px,1fr)]')

function onDragOver(colId: string) {
  if (!props.canDrag) return
  drag.dragOver(colId)
}

// Insert marker while dragging: the card the pointer is above (null = end).
const sisip = ref<{ col: string, sebelum: string | null } | null>(null)
function onCardOver(ev: DragEvent, colId: string, items: T[], i: number) {
  if (!props.canDrag || !drag.draggedId.value) return
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  const atas = ev.clientY < r.top + r.height / 2
  sisip.value = { col: colId, sebelum: atas ? items[i]!.id : (items[i + 1]?.id ?? null) }
}
watch(() => drag.draggedId.value, (v) => {
  if (!v) sisip.value = null
})

function onDrop(ev: DragEvent, colId: string) {
  const s = sisip.value?.col === colId ? sisip.value.sebelum : null
  sisip.value = null
  const id = drag.dropTo(ev)
  if (!id) return
  // A drop in its own column is a reorder (boards without a manual order ignore it).
  if (props.columns.find(c => c.id === colId)?.items.some(i => i.id === id)) {
    emit('reorder', { id, column: colId, sebelum: s })
    return
  }
  emit('move', { id, to: colId, sebelum: s })
}

defineExpose({ swallowClick: drag.swallowClick })
</script>

<template>
  <AppPapan
    :class="trackClass"
    :style="layout === 'scroll' ? { gridAutoColumns: `minmax(${colMin}px, 1fr)` } : undefined"
  >
    <section
      v-for="col in columns"
      :key="col.id"
      class="kanban-col flex min-w-0 flex-col rounded-xl border bg-shell transition-[background-color,border-color] duration-200 ease-laks"
      :class="drag.overColumn.value === col.id ? 'border-primary-400 bg-primary-50' : 'border-default'"
      @dragover.prevent="onDragOver(col.id)"
      @dragleave="drag.leaveColumn($event, col.id)"
      @drop="onDrop($event, col.id)"
    >
      <header class="flex items-center gap-2 border-b border-default px-3 py-2.5">
        <slot
          name="header"
          :column="col"
        >
          <span class="text-sm font-bold text-highlighted">{{ col.title ?? col.id }}</span>
          <span class="num ml-auto rounded-full bg-default px-2 text-xs font-bold ring-1 ring-default">{{ col.count ?? col.items.length }}</span>
        </slot>
      </header>
      <div
        class="flex min-h-16 flex-1 flex-col p-2"
        :class="listClass ? `${listClass} gap-3 overflow-y-auto [scrollbar-width:thin] *:shrink-0` : 'gap-2'"
      >
        <div
          v-for="(item, i) in col.items"
          :key="item.id"
          class="relative"
          @dragover="onCardOver($event, col.id, col.items, i)"
        >
          <span
            v-if="sisip?.col === col.id && sisip.sebelum === item.id && drag.draggedId.value !== item.id"
            class="pointer-events-none absolute inset-x-1 -top-2 h-1 rounded-full bg-primary"
            aria-hidden="true"
          />
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
        </div>
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
          v-if="!listClass"
          name="footer"
          :column="col"
        />
      </div>
      <!-- A capped list scrolls on its own; the footer (quick add) stays pinned below it. -->
      <div
        v-if="listClass && $slots.footer"
        class="border-t border-default p-2"
      >
        <slot
          name="footer"
          :column="col"
        />
      </div>
    </section>
  </AppPapan>
</template>
