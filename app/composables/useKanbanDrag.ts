// Shared HTML5 drag-and-drop state for every kanban board (marketing pipeline,
// BD boards). One place owns the dragged id, the highlighted column and the
// click-vs-drag guard: a click fires right after a drop on the same card, so
// the board stamps every drop and callers swallow one click via swallowClick().
// The dataTransfer payload is required — Firefox never fires drop without one.
export function useKanbanDrag(opts?: { swallowMs?: number }) {
  const draggedId = ref<string | null>(null)
  const overColumn = ref<string | null>(null)
  const lastDropAt = ref(0)
  const swallowMs = opts?.swallowMs ?? 300

  function dragStart(ev: DragEvent, id: string) {
    draggedId.value = id
    overColumn.value = null
    ev.dataTransfer?.setData('text/plain', id)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
  }

  function dragEnd() {
    draggedId.value = null
    overColumn.value = null
  }

  function dragOver(colId: string) {
    overColumn.value = colId
  }

  function leaveColumn(ev: DragEvent, colId: string) {
    // dragleave also fires when moving onto a child card — only clear when the
    // pointer really left the column.
    const ke = ev.relatedTarget as Node | null
    if (ke && (ev.currentTarget as HTMLElement).contains(ke)) return
    if (overColumn.value === colId) overColumn.value = null
  }

  /** Returns the dragged id (or null when nothing was dragged). Stamps the
   *  time only for a real card drop so stray drops swallow no click. */
  function dropTo(ev: DragEvent): string | null {
    ev.preventDefault()
    const id = ev.dataTransfer?.getData('text/plain') || draggedId.value
    overColumn.value = null
    draggedId.value = null
    if (id) lastDropAt.value = Date.now()
    return id || null
  }

  /** True when a click arrives right after a drop — the caller skips it once. */
  function swallowClick(): boolean {
    return Date.now() - lastDropAt.value < swallowMs
  }

  return { draggedId, overColumn, dragStart, dragEnd, dragOver, leaveColumn, dropTo, swallowClick }
}
