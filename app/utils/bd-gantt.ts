// BD Timeline geometry — pure functions, no Vue, no API.
//
// Faithful port of `ganttHtml` (deploy/bd/index.html:2337-2471, putaran
// keempat). It returns render-ready data (rows, header cells, arrows); the
// widget (`BdGantt.vue`) only draws it. One deliberate deviation: colours map
// to the app tokens (no hex, no gradients — the violet lock STRIPE becomes a
// solid violet bar, said in the legend).

import type { BdProject, BdSubtask, BdTask } from '~/composables/useBd'
import { isoOf, pDate, penghalang, projProgress, selesai, sisaHari, todayISO } from '~/utils/bd-rumus'
import { BLN, fTgl } from '~/utils/format'

export type GZoom = 'day' | 'week' | 'month'

/** Pixels per day, label width, row height, header height (`ganttHtml`). */
export const G_PX: Record<GZoom, number> = { day: 30, week: 13, month: 4 }
export const G_LW = 270
export const G_RH = 36
export const G_HH = 46

/** `gSah` — a plottable date, nothing else. */
export const gSah = (x: unknown): boolean => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''))

/** `gAdd` — shift a date by n days, local (never UTC). */
export function gAdd(iso: string, n: number): string {
  const d = pDate(iso)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

/** `gDiff` — whole days from a to b. */
export function gDiff(a: string, b: string): number {
  return Math.round((+pDate(b) - +pDate(a)) / 86400000)
}

/** Bar colour class kind (`gKls`). */
export type GKls = 'done' | 'over' | 'lock' | 'doing' | 'todo'

export function gKls(t: BdTask, semua: BdTask[]): GKls {
  if (selesai(t)) return 'done'
  if (t.deadline && sisaHari(t.deadline) < 0) return 'over'
  if (penghalang(t, semua).length) return 'lock'
  if (t.status === 'Doing' || t.status === 'Review') return 'doing'
  return 'todo'
}

/** `gUrut` — start (else deadline), then the name. */
export function gUrut(
  a: { start?: string, deadline?: string, name?: string },
  b: { start?: string, deadline?: string, name?: string },
): number {
  const x = a.start || a.deadline || '9999'
  const y = b.start || b.deadline || '9999'
  if (x !== y) return x < y ? -1 : 1
  return String(a.name || '').localeCompare(String(b.name || ''))
}

export interface GFigBar {
  kind: 'bar'
  x: number
  w: number
  kls: GKls | 'proj'
  /** Name inside the bar when it fits (`w > 70`). */
  namaDalam: boolean
  /** Progress fill, only for `doing` bars. */
  maju?: number
  judul: string
}
export interface GFigDia {
  kind: 'dia'
  x: number
  kecil: boolean
  kls: '' | 'done' | 'over'
  judul: string
}
export interface GFigKosong { kind: 'kosong' }
export type GFig = GFigBar | GFigDia | GFigKosong

export interface GBarisP {
  k: 'p'
  p: BdProject
  buka: boolean
  adaTask: boolean
  persen: number
  batang: { x: number, w: number, maju: number, judul: string } | null
  ketupat: { x: number, kls: '' | 'done' | 'over', judul: string } | null
}
export interface GBarisT {
  k: 't'
  t: BdTask
  dalam: number
  adaSub: boolean
  subTutup: boolean
  fig: GFig
  geo: { x0: number, x1: number } | null
}
export interface GBarisS {
  k: 's'
  s: BdSubtask
  t: BdTask
  ix: number
  dalam: number
  fig: { x: number, kls: '' | 'done' | 'over', judul: string } | null
}
export type GBaris = GBarisP | GBarisT | GBarisS

export interface GSel { x: number, w: number, teks: string, cls: string }

export interface GanttModel {
  px: number
  W: number
  H: number
  atas: GSel[]
  bawah: GSel[]
  akhirPekan: { x: number, w: number }[]
  baris: GBaris[]
  panah: string[]
  kunci: string
  hariIniX: number
  kosong?: { judul: string, sub: string }
}

export interface GanttMasukan {
  projects: BdProject[]
  tasks: BdTask[]
  scoped?: boolean
  bukaProj: Record<string, boolean>
  tutupSub: Record<string, boolean>
  zoom: GZoom
  hariIni?: string
}

/**
 * The whole chart as data. The range comes from EVERY item of the drawn
 * projects (not just the open rows), so the scale never jumps when one
 * project opens; one mistyped deadline (2099) is clamped to two years.
 */
export function ganttModel(m: GanttMasukan): GanttModel {
  const zoom = m.zoom
  const px = G_PX[zoom]
  const T = m.hariIni || todayISO()
  const scoped = !!m.scoped
  const tugasProj = (pid: string) => m.tasks.filter(t => t.project === pid)

  const baris: GBaris[] = []
  for (const p of m.projects) {
    if (!scoped) baris.push({ k: 'p', p, buka: !!m.bukaProj[p.id], adaTask: false, persen: 0, batang: null, ketupat: null })
    if (scoped || m.bukaProj[p.id]) {
      for (const t of tugasProj(p.id).slice().sort(gUrut)) {
        baris.push({ k: 't', t, dalam: scoped ? 0 : 1, adaSub: false, subTutup: false, fig: { kind: 'kosong' }, geo: null })
        const sb = Array.isArray(t.subtasks) ? t.subtasks : []
        if (sb.length && !m.tutupSub[t.id]) {
          sb.forEach((s, i) => baris.push({ k: 's', s, t, ix: i, dalam: scoped ? 1 : 2, fig: null }))
        }
      }
    }
  }
  if (!baris.length) {
    return {
      px, W: 0, H: 0, atas: [], bawah: [], akhirPekan: [], baris: [], panah: [],
      kunci: `${scoped ? 'p' : 'all'}:${zoom}`, hariIniX: 0,
      kosong: {
        judul: scoped ? 'Belum ada task untuk timeline' : 'Tidak ada project pada penyaring ini',
        sub: scoped ? 'Tambahkan task, isi tanggal mulai & deadline-nya.' : '',
      },
    }
  }

  const ds = [T]
  for (const p of m.projects) {
    for (const x of [p.start, p.end]) if (gSah(x)) ds.push(String(x))
    for (const t of tugasProj(p.id)) {
      for (const x of [t.start, t.deadline]) if (gSah(x)) ds.push(String(x))
      for (const s of Array.isArray(t.subtasks) ? t.subtasks : []) if (gSah(s.d)) ds.push(String(s.d))
    }
  }
  ds.sort()
  const awal = ds[0] ?? T
  const akhir = ds[ds.length - 1] ?? T
  let R0 = gAdd(awal, -7)
  let R1 = gAdd(akhir, 10)
  if (gDiff(R0, R1) > 730) R1 = gAdd(R0, 730)
  if (zoom === 'week') R0 = gAdd(R0, -((pDate(R0).getDay() + 6) % 7))
  if (zoom === 'month') R0 = `${R0.slice(0, 8)}01`
  const days = gDiff(R0, R1) + 1
  const W = days * px
  const X = (s: string) => gDiff(R0, s) * px

  const atas: GSel[] = []
  const bawah: GSel[] = []
  for (let i = 0; i < days; i++) {
    const s = gAdd(R0, i)
    const d = pDate(s)
    const dd = d.getDate()
    if (zoom === 'month') {
      if (i === 0 || (dd === 1 && d.getMonth() === 0)) {
        const yEnd = Math.min(days, i + gDiff(s, `${d.getFullYear() + 1}-01-01`))
        atas.push({ x: i * px, w: (yEnd - i) * px, teks: String(d.getFullYear()), cls: '' })
      }
      if (i === 0 || dd === 1) {
        const len = Math.min(days - i, gDiff(s, isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1))))
        bawah.push({ x: i * px, w: len * px, teks: BLN[d.getMonth()] || '', cls: '' })
      }
    }
    else {
      if (i === 0 || dd === 1) {
        const len = Math.min(days - i, gDiff(s, isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1))))
        atas.push({ x: i * px, w: len * px, teks: `${BLN[d.getMonth()]} ${d.getFullYear()}`, cls: '' })
      }
      if (zoom === 'day') {
        bawah.push({ x: i * px, w: px, teks: String(dd), cls: `${d.getDay() % 6 === 0 ? 'we' : ''}${s === T ? ' td' : ''}` })
      }
      else if (d.getDay() === 1) {
        bawah.push({ x: i * px, w: 7 * px, teks: `${dd} ${BLN[d.getMonth()]}`, cls: 'kiri' })
      }
    }
  }

  const geo: Record<string, { idx: number, x0: number, x1: number }> = {}
  baris.forEach((r, idx) => {
    if (r.k === 'p') {
      const p = r.p
      const pg = projProgress(p, m.tasks)
      r.adaTask = tugasProj(p.id).length > 0
      r.persen = pg
      const beres = p.stage === 'Done'
      const st = gSah(p.start) ? String(p.start) : (gSah(p.end) ? String(p.end) : '')
      if (st && gSah(p.end)) {
        const x = X(st)
        const w = Math.max(px, (gDiff(st, String(p.end)) + 1) * px)
        const lewat = !beres && sisaHari(p.end) < 0
        r.batang = { x, w, maju: pg, judul: `${p.name} — ${fTgl(p.start)} s/d ${fTgl(p.end)}` }
        r.ketupat = { x: X(String(p.end)) + px / 2 - 6, kls: beres ? 'done' : lewat ? 'over' : '', judul: `Deadline ${fTgl(p.end)}` }
      }
    }
    else if (r.k === 't') {
      const t = r.t
      const kl = gKls(t, m.tasks)
      const sb = Array.isArray(t.subtasks) ? t.subtasks : []
      r.adaSub = sb.length > 0
      r.subTutup = !!m.tutupSub[t.id]
      const tip = `${t.name} — ${t.start ? `${fTgl(t.start)} s/d ` : 'deadline '}${fTgl(t.deadline)} · ${t.status}`
      if (gSah(t.start) && gSah(t.deadline) && String(t.start) <= String(t.deadline)) {
        const x = X(String(t.start))
        const w = Math.max(px, (gDiff(String(t.start), String(t.deadline)) + 1) * px)
        geo[t.id] = { idx, x0: x, x1: x + w }
        r.geo = { x0: x, x1: x + w }
        r.fig = { kind: 'bar', x, w, kls: kl, namaDalam: w > 70, maju: kl === 'doing' ? Number(t.progress) || 0 : undefined, judul: tip }
      }
      else {
        const titik = gSah(t.deadline) ? String(t.deadline) : (gSah(t.start) ? String(t.start) : '')
        if (titik) {
          const x = X(titik) + px / 2 - 6
          geo[t.id] = { idx, x0: x, x1: x + 12 }
          r.geo = { x0: x, x1: x + 12 }
          r.fig = { kind: 'dia', x, kecil: false, kls: kl === 'done' ? 'done' : kl === 'over' ? 'over' : '', judul: tip }
        }
        else {
          r.fig = { kind: 'kosong' }
        }
      }
    }
    else {
      const s = r.s
      const telat = !s.done && gSah(s.d) && sisaHari(String(s.d)) < 0
      r.fig = gSah(s.d)
        ? { x: X(String(s.d)) + px / 2 - 5, kls: s.done ? 'done' : telat ? 'over' : '', judul: `${s.t} — ${fTgl(String(s.d))}` }
        : null
    }
  })

  // Order arrows: prerequisite → waiter, only when BOTH rows show.
  const panah: string[] = []
  baris.forEach((r) => {
    if (r.k !== 't') return
    const g = geo[r.t.id]
    if (!g) return
    for (const b of Array.isArray(r.t.dependsOn) ? r.t.dependsOn : []) {
      const gb = geo[b]
      if (!gb) continue
      const x1 = gb.x1
      const y1 = gb.idx * G_RH + G_RH / 2
      const x2 = g.x0
      const y2 = g.idx * G_RH + G_RH / 2
      panah.push(`M${x1} ${y1} H${x1 + 8} V${y2} H${x2 - 1}`)
    }
  })

  const akhirPekan: { x: number, w: number }[] = []
  if (zoom === 'day') {
    for (let j = 0; j < days; j++) {
      if (pDate(gAdd(R0, j)).getDay() === 6) akhirPekan.push({ x: j * px, w: 2 * px })
    }
  }

  return {
    px, W, H: baris.length * G_RH, atas, bawah, akhirPekan, baris, panah,
    kunci: `${scoped ? `p:${m.projects[0]?.id}` : 'all'}:${zoom}`,
    hariIniX: X(T) + px / 2,
  }
}
