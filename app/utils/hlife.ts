// Pure Howandi Life OS helpers — no API, no Vue. One place for the old client's
// formulas, constants and calendar/ICS builders, so two screens cannot disagree.
//
// Source: laksamana-office/deploy/howandi_life/index.html (lines inline).
import type {
  HlifeAsset, HlifeBusiness, HlifeContent, HlifeEvent, HlifeGoal, HlifeLedger,
  HlifeMilestone, HlifeProject, HlifeTask,
} from '~/composables/useHlife'
import { hariIni, tambahHari } from '~/utils/format'

/** Project Center columns. 'Archive' was removed 19 Aug 2026 and merged into 'Done' (`:638-644`). */
export const STAGES = ['Idea', 'Planning', 'Research', 'Ready', 'Doing', 'Waiting', 'Review', 'Done'] as const

/** Content Pipeline columns (`:668`). */
export const CSTAGES = ['Idea', 'Script', 'Shoot', 'Editing', 'Scheduled', 'Posted'] as const

export const PRIORITIES = ['High', 'Med', 'Low'] as const

export const GOAL_AREAS = ['Finance', 'Health', 'Content', 'Learning', 'Business', 'Family', 'Spiritual', 'Travel', 'Relationship'] as const

export const BIZ_AREAS = ['Business', 'Content', 'Finance', 'Investment', 'CEO', 'Social', 'Travel'] as const

export const ASSET_CATS = ['Properti', 'Kendaraan', 'Kas/Bank', 'Crypto', 'Saham', 'Emas', 'Bisnis/Equity', 'Piutang', 'Lainnya', 'Utang'] as const

export const UNIT_LIST = ['gram', 'kg', 'hektar', 'm²', 'unit', '% saham', 'lot', 'lembar', 'koin'] as const

export const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Threads', 'Newsletter', 'Podcast'] as const

export const LEARN_TYPES = ['Buku', 'Video', 'Film', 'Podcast', 'Artikel', 'Course'] as const

export const LEARN_STATUS = ['Sedang', 'Selesai'] as const

export const DREAM_STATUS = ['Someday', 'Planning', 'Done'] as const

/** Dream categories with their Lucide icon and AppStatus tone (`:689`). */
export const DREAM_CAT: Record<string, { label: string, icon: string, tone: 'info' | 'warning' | 'success' | 'vip' | 'neutral' | 'gold' }> = {
  Travel: { label: 'Travel — negara & tempat', icon: 'i-lucide-plane', tone: 'info' },
  Education: { label: 'Pendidikan — kuliah & kursus', icon: 'i-lucide-graduation-cap', tone: 'gold' },
  Career: { label: 'Karir & bisnis', icon: 'i-lucide-briefcase', tone: 'success' },
  Experience: { label: 'Pengalaman', icon: 'i-lucide-sparkles', tone: 'vip' },
  Other: { label: 'Lainnya', icon: 'i-lucide-star', tone: 'neutral' },
}

/** The AppStatus tones hlife uses (DESIGN.md rule 4). */
export type WarnaHlife = 'success' | 'warning' | 'error' | 'info' | 'vip' | 'neutral' | 'gold'

/** Event types (`:941`): value, label, Lucide icon, AppStatus tone. */
export const EVENT_TYPES: { value: string, label: string, icon: string, tone: WarnaHlife }[] = [
  { value: 'meeting', label: 'Meeting', icon: 'i-lucide-users', tone: 'info' },
  { value: 'deadline', label: 'Deadline', icon: 'i-lucide-alarm-clock', tone: 'error' },
  { value: 'personal', label: 'Personal / gym', icon: 'i-lucide-dumbbell', tone: 'success' },
  { value: 'content', label: 'Content shoot', icon: 'i-lucide-video', tone: 'vip' },
  { value: 'event', label: 'Event / lainnya', icon: 'i-lucide-calendar-days', tone: 'gold' },
]

// ---------------------------------------------------------------- formulas

export type KuadranHlife = 'do' | 'schedule' | 'delegate' | 'delete'

/** `quadrant()` (`:553`). */
export function kuadranHlife(t: Pick<HlifeTask, 'important' | 'urgent'>): KuadranHlife {
  if (t.important && t.urgent) return 'do'
  if (t.important && !t.urgent) return 'schedule'
  if (!t.important && t.urgent) return 'delegate'
  return 'delete'
}

/** `isOverdue()` (`:554`). */
export const terlambat = (t: Pick<HlifeTask, 'due' | 'done'>) => !!t.due && !t.done && t.due < hariIni()

/** `fmtDue()` (`:555`). */
export function fmtDue(d: string): string {
  if (!d) return ''
  const t = hariIni()
  if (d === t) return 'Hari ini'
  if (d === tambahHari(t, 1)) return 'Besok'
  if (d === tambahHari(t, -1)) return 'Kemarin'
  if (d < t) {
    const hari = Math.round((Date.parse(`${t}T00:00`) - Date.parse(`${d}T00:00`)) / 864e5)
    return `${hari}h lewat`
  }
  return tanggalSingkat(d)
}

/** "2026-09-27" -> "27 Sep". */
export const tanggalSingkat = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

/** "2026-09-27" -> "27 Sep 2026". */
export const tanggalMenengah = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

/** `fmtRp()` (`:556`): "Rp 2,4 M" / "Rp 500 jt" / "Rp 12 rb" / "Rp 900". */
export function rupiahRingkas(n: number | null | undefined): string {
  let v = Number(n) || 0
  const tanda = v < 0 ? '-' : ''
  v = Math.abs(v)
  const potong = (x: string) => x.replace(/\.?0+$/, '')
  if (v >= 1e9) return `${tanda}Rp ${potong((v / 1e9).toFixed(v >= 1e10 ? 1 : 2))} M`
  if (v >= 1e6) return `${tanda}Rp ${potong((v / 1e6).toFixed(0))} jt`
  if (v >= 1e3) return `${tanda}Rp ${potong((v / 1e3).toFixed(0))} rb`
  return `${tanda}Rp ${v.toLocaleString('id-ID')}`
}

/** `goalPct()` (`:557`), including the legacy inverted goal. */
export function persenGoal(g: Pick<HlifeGoal, 'cur' | 'target' | 'invert' | 'start'>): number {
  if (g.invert) {
    const st = g.start != null ? g.start : g.cur
    if (st === g.target) return 100
    return Math.max(0, Math.min(100, Math.round(((st - g.cur) / (st - g.target)) * 100)))
  }
  return Math.max(0, Math.min(100, Math.round((((g.cur || 0) / (g.target || 1)) * 100) || 0)))
}

/** `projProgress()` (`:565`): automatic from tasks when any, else the manual value. */
export function persenProject(p: Pick<HlifeProject, 'id' | 'progress'>, tasks: Pick<HlifeTask, 'project' | 'done'>[]): number {
  const ts = tasks.filter(t => t.project === p.id)
  if (ts.length) return Math.round((ts.filter(t => t.done).length / ts.length) * 100)
  return p.progress || 0
}

/** `milestoneProgress()` (`:724`): average of the linked goals, else done ? 100 : 0. */
export function persenMilestone(r: Pick<HlifeMilestone, 'id' | 'done'>, goals: HlifeGoal[]): number {
  const gs = goals.filter(g => g.milestone === r.id)
  if (gs.length) return Math.round(gs.reduce((s, g) => s + persenGoal(g), 0) / gs.length)
  return r.done ? 100 : 0
}

/** `netWorth()` (`:560`). */
export const netWorth = (assets: Pick<HlifeAsset, 'liab' | 'value'>[]) =>
  assets.reduce((a, x) => a + (x.liab ? -1 : 1) * (+x.value || 0), 0)

/** `totalAssets()` (`:561`). */
export const totalAssets = (assets: Pick<HlifeAsset, 'liab' | 'value'>[]) =>
  assets.filter(a => !a.liab).reduce((s, a) => s + (+a.value || 0), 0)

/** `totalLiab()` (`:562`). */
export const totalLiab = (assets: Pick<HlifeAsset, 'liab' | 'value'>[]) =>
  assets.filter(a => a.liab).reduce((s, a) => s + (+a.value || 0), 0)

/** `bizRevTotal()` (`:563`). */
export const bizRevTotal = (businesses: Pick<HlifeBusiness, 'revenue'>[]) =>
  businesses.reduce((s, b) => s + (+b.revenue || 0), 0)

/** `ledgerMonths()` (`:752`): unique months, oldest first. */
export const bulanLedger = (ledger: HlifeLedger[]) => [...new Set(ledger.map(e => e.month))].sort()

/** `monthAgg()` (`:754`): personal vs everything else. */
export function bulanAgg(ledger: HlifeLedger[], mk: string) {
  let pi = 0
  let pe = 0
  let bi = 0
  let be = 0
  ledger.filter(e => e.month === mk).forEach((e) => {
    if (e.scope === 'personal') {
      pi += +e.income || 0
      pe += +e.expense || 0
    }
    else {
      bi += +e.income || 0
      be += +e.expense || 0
    }
  })
  return { pi, pe, bi, be }
}

/** `scopeLabel()` (`:753`). */
export function labelScope(scope: string, businesses: Pick<HlifeBusiness, 'id' | 'name'>[]): string {
  if (scope === 'personal') return 'Personal'
  if (scope === '__umum') return 'Bisnis (umum)'
  const b = businesses.find(x => x.id === scope)
  return b ? b.name : '—'
}

// ---------------------------------------------------------------- weeks

/** `weekStart()` (`:717`): the Monday of that week, midnight. */
export function awalMingguHlife(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(`${d}T00:00:00`) : new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

/** `weekKey()` (`:718`): the Monday as "YYYY-MM-DD" (local, never UTC). */
export const kunciMinggu = (d: Date | string) => {
  const x = awalMingguHlife(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

/** `monthOfWeek()` (`:719`). */
export const bulanMinggu = (ws: string) => ws.slice(0, 7)

/** `fmtWeek()` (`:720`): "6 Okt – 12 Okt 2026". */
export function fmtMinggu(ws: string): string {
  const a = new Date(`${ws}T00:00:00`)
  const b = new Date(a)
  b.setDate(b.getDate() + 6)
  return `${a.getDate()} ${a.toLocaleDateString('id-ID', { month: 'short' })} – ${b.getDate()} ${b.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`
}

// ---------------------------------------------------------------- Google Calendar / ICS

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** `gcalDates()` (`:570`). */
function gcalDates(date: string, start?: string, end?: string): string {
  if (start) {
    const s = `${date.replace(/-/g, '')}T${start.replace(':', '')}00`
    let e: string
    if (end) {
      e = `${date.replace(/-/g, '')}T${end.replace(':', '')}00`
    }
    else {
      const p = start.split(':')
      e = `${date.replace(/-/g, '')}T${pad((+p[0]! + 1) % 24)}${p[1]}00`
    }
    return `${s}/${e}`
  }
  return `${date.replace(/-/g, '')}/${tambahHari(date, 1).replace(/-/g, '')}`
}

/** `gcalLink()` (`:571`): a prefilled Google Calendar event. */
export function tautanGcal(title: string, date: string, start?: string, end?: string, details?: string): string {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: gcalDates(date, start, end) })
  if (details) p.set('details', details)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function icsBlock(title: string, date: string, start: string | null, end: string | null, desc: string): string {
  const dt = (d: string, tm?: string | null) => d.replace(/-/g, '') + (tm ? `T${tm.replace(':', '')}00` : '')
  let o = `BEGIN:VEVENT\r\nUID:${Math.random().toString(36).slice(2, 11)}@howandi-los\r\nSUMMARY:${title.replace(/[,;]/g, ' ')}\r\n`
  if (start) {
    o += `DTSTART:${dt(date, start)}\r\nDTEND:${dt(date, end || start)}\r\n`
  }
  else {
    o += `DTSTART;VALUE=DATE:${dt(date)}\r\nDTEND;VALUE=DATE:${dt(tambahHari(date, 1))}\r\n`
  }
  if (desc) o += `DESCRIPTION:${desc.replace(/[,;]/g, ' ')}\r\n`
  return `${o}END:VEVENT\r\n`
}

/**
 * `exportICS()` (`:574`): the events, open task deadlines and unfinished
 * content as one .ics file. The old emoji prefixes become plain words, since
 * emoji are reserved for WhatsApp message text (DESIGN.md rule 2).
 */
export function icsDari(data: { events: HlifeEvent[], tasks: HlifeTask[], content: HlifeContent[] }): string {
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Howandi Life OS//ID\r\nCALSCALE:GREGORIAN\r\n'
  data.events.forEach((e) => {
    ics += icsBlock(e.title, e.date, e.start, e.end, e.type)
  })
  data.tasks.filter(t => t.due && !t.done).forEach((t) => {
    ics += icsBlock(`Deadline: ${t.name}${t.biz ? ` [${t.biz}]` : ''}`, t.due, null, null, 'Deadline task')
  })
  data.content.filter(c => c.date && c.stage !== 'Posted').forEach((c) => {
    ics += icsBlock(`Konten: ${c.title}`, c.date, null, null, `Content ${c.stage}`)
  })
  return `${ics}END:VCALENDAR`
}

/** One calendar cell item, from `calItems()` (`:727`): no emoji, a `jenis` for the icon. */
export interface CalItem {
  t: string
  jenis: 'event' | 'deadline' | 'content'
  time: string
  end: string
  id: string
}

/** `calItems()` (`:727`): events + open task deadlines + unfinished content for one day. */
export function calItems(iso: string, data: { events: HlifeEvent[], tasks: HlifeTask[], content: HlifeContent[] }): CalItem[] {
  const out: CalItem[] = []
  data.events.filter(e => e.date === iso).forEach(e => out.push({ t: e.title, jenis: 'event', time: e.start || '', end: e.end || '', id: e.id }))
  data.tasks.filter(t => t.due === iso && !t.done).forEach(t => out.push({ t: t.name, jenis: 'deadline', time: '', end: '', id: '' }))
  data.content.filter(c => c.date === iso && c.stage !== 'Posted').forEach(c => out.push({ t: c.title, jenis: 'content', time: '', end: '', id: '' }))
  return out.sort((a, b) => ((a.time || '99') < (b.time || '99') ? -1 : 1))
}

/** Which column of the Kanban a project sits in, after the 'Archive' → 'Done' merge (`:525`). */
export const stageAktif = (p: Pick<HlifeProject, 'stage'>) => (p.stage === 'Archive' ? 'Done' : p.stage)
