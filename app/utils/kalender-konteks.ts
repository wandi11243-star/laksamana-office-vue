// The channel between KalenderBulan (owns the drag state and the drop cells)
// and KalenderKartu (the draggable card). Kept in a plain module so both
// components import the same key.
import type { InjectionKey, Ref } from 'vue'

export interface KalenderKonteks {
  /** Dragging is on for this calendar. */
  bolehSeret: Ref<boolean>
  /** A card starts a drag: its id and the day it was grabbed on. */
  mulai: (id: string, dari: string, ev: DragEvent) => void
  selesai: () => void
}

export const kalenderKonteks: InjectionKey<KalenderKonteks> = Symbol('kalender-konteks')
