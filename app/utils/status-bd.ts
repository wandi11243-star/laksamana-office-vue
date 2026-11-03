// BD OS status pills — one colour and one icon per status, the word always
// beside them (DESIGN.md rule 4). The old Panel drew these with `p-*` classes
// (deploy/bd/index.html:719-741, 2361-2362); here they map to the semantic
// tones of `AppStatus`. One source for every BD screen.
export type WarnaStatusBd = 'success' | 'warning' | 'error' | 'info' | 'vip' | 'neutral' | 'gold'

/** `STATUS_COLOR` — the four columns (putaran keempat). Backlog/Waiting stay
 * as safety entries: reads normalise them away, but a row that somehow still
 * carries one must not lose its pill. */
export const WARNA_TASK: Record<string, WarnaStatusBd> = {
  'Backlog': 'neutral',
  'To Do': 'info',
  'Doing': 'warning',
  'Waiting': 'vip',
  'Review': 'vip',
  'Done': 'success',
}
export const IKON_TASK: Record<string, string> = {
  'Backlog': 'i-lucide-circle-dashed',
  'To Do': 'i-lucide-circle',
  'Doing': 'i-lucide-loader',
  'Waiting': 'i-lucide-hourglass',
  'Review': 'i-lucide-eye',
  'Done': 'i-lucide-circle-check',
}

/** `PRIO_COLOR`. */
export const WARNA_PRIO: Record<string, WarnaStatusBd> = {
  Urgent: 'error',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
}
export const IKON_PRIO: Record<string, string> = {
  Urgent: 'i-lucide-flame',
  High: 'i-lucide-arrow-up',
  Medium: 'i-lucide-minus',
  Low: 'i-lucide-arrow-down',
}

/** `COORD_COLOR`. */
export const WARNA_COORD: Record<string, WarnaStatusBd> = {
  Diminta: 'warning',
  Diproses: 'info',
  Review: 'vip',
  Selesai: 'success',
}
export const IKON_COORD: Record<string, string> = {
  Diminta: 'i-lucide-inbox',
  Diproses: 'i-lucide-loader',
  Review: 'i-lucide-eye',
  Selesai: 'i-lucide-circle-check',
}

/** `PO_COLOR`. */
export const WARNA_PO: Record<string, WarnaStatusBd> = {
  Draft: 'neutral',
  Diajukan: 'warning',
  Approved: 'info',
  Dibeli: 'vip',
  Diterima: 'success',
}
export const IKON_PO: Record<string, string> = {
  Draft: 'i-lucide-pencil',
  Diajukan: 'i-lucide-send',
  Approved: 'i-lucide-check',
  Dibeli: 'i-lucide-shopping-cart',
  Diterima: 'i-lucide-package-check',
}

/** `PR_COLOR`. */
export const WARNA_PR: Record<string, WarnaStatusBd> = {
  Draft: 'neutral',
  Diajukan: 'warning',
  Disetujui: 'info',
  Selesai: 'success',
}

/** `PROJ_HEALTH` — label + tone. */
export const WARNA_HEALTH: Record<string, WarnaStatusBd> = {
  'on-track': 'success',
  'at-risk': 'warning',
  'off-track': 'error',
}
export const LABEL_HEALTH: Record<string, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'off-track': 'Off track',
}
export const IKON_HEALTH: Record<string, string> = {
  'on-track': 'i-lucide-trending-up',
  'at-risk': 'i-lucide-triangle-alert',
  'off-track': 'i-lucide-trending-down',
}

/** Eisenhower quadrant tones (`kuadran()`); the word is the quadrant code. */
export const WARNA_KUADRAN: Record<string, WarnaStatusBd> = {
  do: 'error',
  schedule: 'info',
  delegate: 'warning',
  delete: 'neutral',
}

/**
 * Division colour for the compact tags on cards and tables. The old Panel used
 * a hard-coded hex per division (`DIV_COLOR`); hex is banned in components, so
 * a division maps to a semantic tone instead.
 */
const DIV_TONE: Record<string, WarnaStatusBd> = {
  'Business Development': 'gold',
  'Project': 'vip',
  'Purchasing': 'info',
  'Kitchen': 'error',
  'Bar': 'vip',
  'Marketing': 'warning',
  'Finance': 'info',
  'Event': 'success',
  'Floor': 'neutral',
  'HR': 'warning',
  'Cashier': 'gold',
  'Konten': 'vip',
  'BD': 'gold',
  'Manajemen': 'neutral',
}
export const divTone = (d?: string): WarnaStatusBd => DIV_TONE[d || ''] || 'neutral'
