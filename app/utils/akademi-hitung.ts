// Akademi progress maths — the certification and program formulas, ported line
// by line from the old client. Pure functions: no Vue, no API. Screens pass the
// state in, so two screens can never disagree on a percentage.
//
// Source: laksamana-office/deploy/akademi/index.html:729-761 (progress helpers,
// matsForUser, isDone, userStats), :1419-1449 (month + program helpers). The
// server mirrors the same rules in AkademiStats::trainingStats()
// (laksamana-api/app/Modules/Akademi/Services/AkademiStats.php).
import type { KruAkademi, MateriAkademi, PetaProgres, PetaProgProg, ProgramAkademi, ProgresEntry } from '~/composables/useAkademi'
import { jam, tglPendek } from '~/utils/format'

/** `matsForUser(u)` (`:739-745`): only published materials aimed at the crew's division. */
export function materiUntuk(kru: KruAkademi | null, materials: MateriAkademi[]): MateriAkademi[] {
  const division = kru?.division ?? 'all'
  return materials.filter((m) => {
    if (!m.published) return false
    if (division === 'all') return true
    const div = Array.isArray(m.division) ? m.division : []
    return div.includes('all') || div.includes(division)
  })
}

/**
 * `isDone(u, m)` (`:746-751`): a quiz is done only when `passed === true`; every
 * other type when `status === 'done'`.
 */
export function selesaiMateri(kruId: string, m: MateriAkademi, progres: PetaProgres): boolean {
  const p = progres?.[kruId]?.[m.id]
  if (!p) return false
  if (m.type === 'quiz') return p.passed === true
  return p.status === 'done'
}

export interface StatKru {
  total: number
  done: number
  mandTotal: number
  mandDone: number
  pct: number
  mandPct: number
  certified: boolean
}

/** `userStats(u)` (`:752-761`). Always include the crew's own progress map. */
export function statKru(kru: KruAkademi, materials: MateriAkademi[], progres: PetaProgres): StatKru {
  const mats = materiUntuk(kru, materials)
  const mand = mats.filter(m => m.mandatory)
  const doneAll = mats.filter(m => selesaiMateri(kru.id, m, progres)).length
  const doneMand = mand.filter(m => selesaiMateri(kru.id, m, progres)).length
  return {
    total: mats.length,
    done: doneAll,
    mandTotal: mand.length,
    mandDone: doneMand,
    pct: mats.length ? Math.round(doneAll / mats.length * 100) : 0,
    // No mandatory material => 100 %, but certified stays false (mandTotal > 0).
    mandPct: mand.length ? Math.round(doneMand / mand.length * 100) : 100,
    certified: mand.length > 0 && doneMand === mand.length,
  }
}

// ---------------------------------------------------------------- programs

/** `progMats(p)` (`:1426`): the program's published materials, in selection order. */
export function materiProgram(p: ProgramAkademi, materials: MateriAkademi[]): MateriAkademi[] {
  return (p.materialIds ?? [])
    .map(id => materials.find(m => m.id === id))
    .filter((m): m is MateriAkademi => !!m && m.published)
}

/** `progMatsForUser(u, p)` (`:1427-1432`). */
export function materiProgramUntuk(kru: KruAkademi, p: ProgramAkademi, materials: MateriAkademi[]): MateriAkademi[] {
  return materiProgram(p, materials).filter((m) => {
    if (kru.division === 'all') return true
    const div = Array.isArray(m.division) ? m.division : []
    return div.includes('all') || div.includes(kru.division)
  })
}

/** `progItemDone(u, progId, matId)` (`:1433`). Program progress is separate from normal progress. */
export function itemProgramSelesai(kruId: string, progId: string, matId: string, progProg: PetaProgProg): boolean {
  return !!progProg?.[kruId]?.[progId]?.[matId]?.done
}

/** `programUserStats(u, p)` (`:1440-1444`). No item => 100 %. */
export function statProgram(kru: KruAkademi, p: ProgramAkademi, materials: MateriAkademi[], progProg: PetaProgProg): StatKru & { total: number, done: number, pct: number } {
  const mats = materiProgramUntuk(kru, p, materials)
  const done = mats.filter(m => itemProgramSelesai(kru.id, p.id, m.id, progProg)).length
  return {
    total: mats.length,
    done,
    pct: mats.length ? Math.round(done / mats.length * 100) : 100,
    mandTotal: 0,
    mandDone: 0,
    mandPct: 0,
    certified: false,
  }
}

/** `programAvg(p)` (`:1445-1449`): active non-admin crew that actually have items. */
export function rataRataProgram(p: ProgramAkademi, users: KruAkademi[], materials: MateriAkademi[], progProg: PetaProgProg): number {
  const kru = users.filter(k => k.active && k.role !== 'admin')
  const vals = kru
    .map(k => statProgram(k, p, materials, progProg))
    .filter(s => s.total > 0)
    .map(s => s.pct)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
}

/** A crew member's own quiz progress entry, for the score badge and detail tables. */
export const progresSel = (kruId: string, matId: string, progres: PetaProgres): ProgresEntry | null =>
  progres?.[kruId]?.[matId] ?? null

// ---------------------------------------------------------------- months

/** `currentMonthKey()` (`:1421`). */
export function kunciBulanIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** `nextMonthKey(mk)` (`:1422`). */
export function bulanBerikut(mk: string): string {
  const d = new Date(`${mk}-01T00:00:00`)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** `lastDayOf(mk)` (`:1423`). */
export function hariTerakhir(mk: string): string {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y!, m!, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `bulanLabel(mk)` (`:1420`). */
export function labelBulan(mk: string): string {
  if (!mk) return '—'
  return new Date(`${mk}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

// ---------------------------------------------------------------- misc

/** `ytId(url)` (`:979-983`): the YouTube id, or null for a plain link. */
export function ytId(url?: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return m ? m[1]! : null
}

/** `divName(id)` (`:325`) plus the division's icon from the loaded list. */
export function namaDivisi(divisions: { id: string, name: string }[], id: string): string {
  if (id === 'all') return 'Semua Divisi'
  return divisions.find(x => x.id === id)?.name ?? id
}

/** A stable, sortable key for the newest-first material list (`createdAt`). */
export const terbaruDulu = (a: { createdAt?: number }, b: { createdAt?: number }) => (b.createdAt ?? 0) - (a.createdAt ?? 0)

/** A local "YYYY-MM-DD" from a ms stamp, for the shared date formatters. */
function tglDariMs(ms: number): string {
  const d = new Date(ms)
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

/** A ms stamp as the old `fmtDate`: "27 Sep 2026", or "—". */
export function tanggalMs(ms?: number | null): string {
  if (!ms) return '—'
  return `${tglPendek(tglDariMs(ms))} ${new Date(ms).getFullYear()}`
}

/** A ms stamp as the old `fmtDT`: "27 Sep 19.00", or "—". */
export function tanggalJamMs(ms?: number | null): string {
  if (!ms) return '—'
  return `${tglPendek(tglDariMs(ms))} ${jam(new Date(ms).toISOString())}`
}
