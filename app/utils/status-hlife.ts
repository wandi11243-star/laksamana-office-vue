// Every Howandi Life status in one place (DESIGN.md rule 5), the same shape as
// app/utils/status-absensi.ts: a colour, an icon and the word, never colour
// alone.
//
// Colour meanings (DESIGN.md rule 4): warning = waiting / needs a look,
// info = confirmed-neutral, error = act now, success = good, vip = special,
// gold = neutral count.
//
// Source: laksamana-office/deploy/howandi_life/index.html (lines inline).
import type { HlifeTask } from '~/composables/useHlife'
import type { Kuadran, WarnaHlife } from '~/utils/hlife'
import { fmtDue, kuadran, terlambat } from '~/utils/hlife'

export type { WarnaHlife } from '~/utils/hlife'

export interface Lencana {
  label: string
  color: WarnaHlife
  icon: string
}

/** The Eisenhower cells (`:633`). */
export const KUADRAN_META: Record<Kuadran, { label: string, desc: string, tone: WarnaHlife, icon: string }> = {
  do: { label: 'DO', desc: 'Penting + mendesak', tone: 'error', icon: 'i-lucide-flame' },
  schedule: { label: 'SCHEDULE', desc: 'Penting + tidak mendesak', tone: 'info', icon: 'i-lucide-calendar-clock' },
  delegate: { label: 'DELEGATE', desc: 'Tidak penting + mendesak', tone: 'warning', icon: 'i-lucide-users' },
  delete: { label: 'DELETE', desc: 'Tidak penting + tidak mendesak', tone: 'neutral', icon: 'i-lucide-trash-2' },
}

/** Project stage → tone/icon (`STAGES`). */
const STAGE_META: Record<string, { tone: WarnaHlife, icon: string }> = {
  Idea: { tone: 'neutral', icon: 'i-lucide-lightbulb' },
  Planning: { tone: 'info', icon: 'i-lucide-clipboard-list' },
  Research: { tone: 'info', icon: 'i-lucide-search' },
  Ready: { tone: 'gold', icon: 'i-lucide-rocket' },
  Doing: { tone: 'warning', icon: 'i-lucide-loader' },
  Waiting: { tone: 'warning', icon: 'i-lucide-hourglass' },
  Review: { tone: 'vip', icon: 'i-lucide-eye' },
  Done: { tone: 'success', icon: 'i-lucide-circle-check' },
}

export const toneStage = (stage: string): WarnaHlife => STAGE_META[stage === 'Archive' ? 'Done' : stage]?.tone ?? 'neutral'
export const ikonStage = (stage: string) => STAGE_META[stage === 'Archive' ? 'Done' : stage]?.icon ?? 'i-lucide-circle'

const PRIORITY_META: Record<string, { tone: WarnaHlife, icon: string }> = {
  High: { tone: 'error', icon: 'i-lucide-chevrons-up' },
  Med: { tone: 'warning', icon: 'i-lucide-equal' },
  Low: { tone: 'neutral', icon: 'i-lucide-chevrons-down' },
}

export const tonePrioritas = (p: string): WarnaHlife => PRIORITY_META[p]?.tone ?? 'neutral'
export const ikonPrioritas = (p: string) => PRIORITY_META[p]?.icon ?? 'i-lucide-equal'

/** Learning status → badge (`:702`). */
export const lencanaBelajar = (status: string): Lencana =>
  status === 'Selesai'
    ? { label: 'Selesai', color: 'success', icon: 'i-lucide-circle-check' }
    : { label: status || 'Sedang', color: 'warning', icon: 'i-lucide-book-open' }

/** Dream status → badge (`:696`). */
export function lencanaMimpi(status: string): Lencana {
  if (status === 'Done') return { label: 'Done', color: 'success', icon: 'i-lucide-circle-check' }
  if (status === 'Planning') return { label: 'Planning', color: 'info', icon: 'i-lucide-calendar-clock' }
  return { label: status || 'Someday', color: 'neutral', icon: 'i-lucide-cloud' }
}

/** The tags under a task name (`taskRow`, `:590`), in the old order. */
export function lencanaTugas(t: HlifeTask, opts: { hideProject?: boolean, projects?: { id: string, name: string }[] } = {}): Lencana[] {
  const q = kuadran(t)
  const meta = KUADRAN_META[q]
  const out: Lencana[] = [{ label: meta.label, color: meta.tone, icon: meta.icon }]
  if (t.biz) out.push({ label: t.biz, color: 'gold', icon: 'i-lucide-building-2' })
  const proj = t.project ? opts.projects?.find(p => p.id === t.project) : undefined
  if (proj && !opts.hideProject) out.push({ label: proj.name, color: 'vip', icon: 'i-lucide-folder' })
  if (t.owner) out.push({ label: t.owner, color: 'neutral', icon: 'i-lucide-user' })
  if (t.due) out.push(terlambat(t)
    ? { label: fmtDue(t.due), color: 'error', icon: 'i-lucide-alarm-clock' }
    : { label: fmtDue(t.due), color: 'info', icon: 'i-lucide-calendar' })
  if (t.est) out.push({ label: `${t.est}m`, color: 'neutral', icon: 'i-lucide-timer' })
  return out
}
