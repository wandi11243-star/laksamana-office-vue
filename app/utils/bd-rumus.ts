// BD OS screen maths — pure functions, no Vue, no API.
//
// Faithful port of the browser-side calculations of the old Panel
// (laksamana-office/deploy/bd/index.html). They MUST stay client-side: the API
// stores rows and the old client derived every one of these while drawing. Each
// function names the old source line it comes from.
//
// Dates always go through the local helpers below, never `Date#toISOString()`:
// that is UTC and in WIB anything before 07:00 is reported as yesterday, which
// would mark tasks overdue every morning (deploy/bd/index.html:767-772).
import type { BdAgenda, BdApproverSet, BdMilestone, BdPo, BdPerson, BdPr, BdProject, BdSubtask, BdTask } from '~/composables/useBd'
import { BLN, fTglP, hariIni, tambahHari } from '~/utils/format'

// ─────────────────────────── organisation (deploy/bd/index.html:708-755) ──
/** `OWNER_DIVS` — the divisions whose work BD OS manages. */
export const OWNER_DIVS = ['Business Development', 'Project', 'Purchasing']
/** `COORD_DIVS` — the other divisions, the destinations of a coordination request. */
export const COORD_DIVS = ['Kitchen', 'Bar', 'Marketing', 'Finance', 'Event', 'Floor', 'HR']

/** One Office team (`Tim` column, laksamana-api `App\Support\Tim::TIM`). */
export interface TimOffice { key: string, label: string, words: string[] }
/**
 * `TIM_OFFICE` — every Office team, mirroring `App\Support\Tim::TIM` (key,
 * label AND match words). The division dropdowns are built from this plus the
 * divisions the crew actually uses, so the two lists can never drift apart
 * silently: when Office adds a team there, add it here too.
 */
export const TIM_OFFICE: TimOffice[] = [
  { key: 'kitchen', label: 'Kitchen', words: ['kitchen', 'dapur', 'cook', 'chef'] },
  { key: 'bar', label: 'Bar', words: ['bar', 'bartender', 'barista'] },
  { key: 'floor', label: 'Floor', words: ['floor', 'service', 'waiter', 'waitress', 'host', 'hostess', 'foh'] },
  { key: 'cashier', label: 'Cashier', words: ['cashier', 'kasir'] },
  { key: 'marketing', label: 'Marketing', words: ['marketing', 'sales', 'mkt'] },
  { key: 'konten', label: 'Konten', words: ['konten', 'content', 'creative', 'kreatif', 'desain', 'design', 'sosmed'] },
  { key: 'event', label: 'Event', words: ['event'] },
  { key: 'hr', label: 'HR', words: ['hr', 'hrd', 'people'] },
  { key: 'bd', label: 'BD', words: ['bd', 'bizdev', 'business'] },
  { key: 'finance', label: 'Finance', words: ['finance', 'keuangan', 'accounting', 'akunting'] },
  { key: 'manajemen', label: 'Manajemen', words: ['ceo', 'owner', 'manager', 'manajer', 'gm', 'direktur', 'management', 'manajemen', 'nahkoda'] },
]
/** Just the labels, for membership checks (`divisi lama` marking). */
export const LABEL_TIM = TIM_OFFICE.map(t => t.label)
/**
 * `timDariKet` — the Office teams named by a Tim/Keterangan text, whole-word
 * matched like the server (`App\Support\Tim::keys`). Empty when nobody
 * matches: callers keep the old division and mark it, never clear it.
 */
export function timDariKet(ket?: string | null): string[] {
  const kata = String(ket || '').toLowerCase().split(/[^a-z]+/).filter(Boolean)
  if (!kata.length) return []
  return TIM_OFFICE.filter(t => t.words.some(w => kata.includes(w))).map(t => t.label)
}
/** `divisiTerpakai` — distinct non-empty divisions in order of appearance. */
export function divisiTerpakai(rows: { div?: string | null }[]): string[] {
  const out: string[] = []
  const lihat = new Set<string>()
  for (const r of rows) {
    const d = String(r?.div || '').trim()
    if (d && !lihat.has(d.toLowerCase())) {
      lihat.add(d.toLowerCase())
      out.push(d)
    }
  }
  return out
}
/**
 * `opsiDivisi` — the form dropdown: divisions the crew actually uses FIRST
 * (legacy rows never drop out), then every Office Tim not already listed.
 * Filters deliberately do NOT use this — they stay on used-only
 * (`divisiTerpakai`), so an empty division never clutters them.
 */
export function opsiDivisi(rows: { div?: string | null }[]): string[] {
  const out = divisiTerpakai(rows)
  const lihat = new Set(out.map(d => d.toLowerCase()))
  for (const t of TIM_OFFICE) {
    if (!lihat.has(t.label.toLowerCase())) {
      lihat.add(t.label.toLowerCase())
      out.push(t.label)
    }
  }
  return out
}
/** `divisiBawaan` — the account's own division when offered, else the first option. */
export function divisiBawaan(akuDiv: unknown, opsi: string[]): string {
  const d = String(akuDiv || '')
  if (d && opsi.includes(d)) return d
  return opsi[0] || ''
}
/** `STATUS_FLOW` — the five Kanban columns (22 Okt 2026: Projects uses the same columns as tasks). */
export const STATUS_FLOW = ['To Do', 'Doing', 'Pending', 'Review', 'Done']
/** `STATUS_LAMA` — read mapping for rows written before the fourth round. */
export const STATUS_LAMA: Record<string, string> = { Backlog: 'To Do', Waiting: 'Doing' }
/**
 * `normalize` (status part) — an old or unknown status never leaves a card
 * column-less: unknown statuses fall to To Do, where they are seen.
 */
export function normalisasiStatus(status?: string): string {
  if (status && STATUS_LAMA[status]) return STATUS_LAMA[status]!
  if (status && STATUS_FLOW.includes(status)) return status
  return 'To Do'
}
/** `PRIORITAS`. */
export const PRIORITAS = ['Urgent', 'High', 'Medium', 'Low']
/** `PROJ_STAGES` — same columns as tasks (22 Okt 2026). */
export const PROJ_STAGES = STATUS_FLOW
/** `PROJ_HEALTH` keys. */
export const PROJ_HEALTH = ['on-track', 'at-risk', 'off-track']
/** `COORD_FLOW`. */
export const COORD_FLOW = ['Diminta', 'Diproses', 'Review', 'Selesai']
/** `PO_FLOW`. */
export const PO_FLOW = ['Draft', 'Diajukan', 'Approved', 'Dibeli', 'Diterima']

/**
 * USelect (Radix SelectItem) refuses an empty-string option value, so the old
 * "all / none" options use these sentinels in the UI. Filters compare against
 * `PILIHAN_SEMUA`; forms map `PILIHAN_TANPA` back to `''`/`null` before saving —
 * the API stores "no project / no division / no boss" exactly like the old client.
 */
export const PILIHAN_SEMUA = '__semua__'
export const PILIHAN_TANPA = '__tanpa__'
/** `PR_FLOW`. */
export const PR_FLOW = ['Draft', 'Diajukan', 'Disetujui', 'Selesai']
/** `PO_SELESAI` — the final stage, written once. */
export const PO_SELESAI = 'Diterima'
/** `TASK_TIPE`. */
export const TASK_TIPE = ['Ad-hoc', 'Rutin', 'Project']
/** `FREQ`. */
export const FREQ = ['Daily', 'Weekly', 'Monthly', 'Custom']
/** `AGENDA_TIPE`. */
export const AGENDA_TIPE = ['Meeting', 'Vendor', 'Internal', 'Deadline']
/** `PENYETUJU_BIBIT` — used ONCE, only while no signer set exists yet. */
export const PENYETUJU_BIBIT = ['Dina Mariana', 'Howandi Chandra', 'Wandi Pranata']

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** `isoOf` — a Date as a local "YYYY-MM-DD". */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** `todayISO`. */
export const todayISO = hariIni
/** `pDate` — "YYYY-MM-DD" as a local Date (never UTC). */
export function pDate(iso?: string): Date {
  const p = String(iso || '').split('-')
  return new Date(Number(p[0]) || 1970, (Number(p[1]) || 1) - 1, Number(p[2]) || 1)
}
/** `inDays`. */
export function inDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoOf(d)
}
/** `sisaHari` — days from today; 9999 when there is no date. */
export function sisaHari(iso?: string): number {
  if (!iso) return 9999
  const a = pDate(iso)
  a.setHours(0, 0, 0, 0)
  const b = new Date()
  b.setHours(0, 0, 0, 0)
  return Math.round((+a - +b) / 86400000)
}
/** `fDue` — "Hari ini", "Besok", "3h lewat", "5h lagi". */
export function fDue(iso?: string): string {
  if (!iso) return ''
  const n = sisaHari(iso)
  if (n === 0) return 'Hari ini'
  if (n === 1) return 'Besok'
  if (n === -1) return 'Kemarin'
  if (n < 0) return `${Math.abs(n)}h lewat`
  if (n <= 7) return `${n}h lagi`
  return fTglP(iso)
}

/** `ribuan` — a plain number with id-ID thousand separators. */
export const ribuan = (n: unknown) => (Number(n) || 0).toLocaleString('id-ID')
/** `fRp` — the abbreviated form ("Rp 5 jt"). Cards only, never the PR sheet. */
export function fRp(n: unknown): string {
  let v = Number(n) || 0
  const s = v < 0 ? '-' : ''
  v = Math.abs(v)
  if (v >= 1e9) return `${s}Rp ${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2).replace(/\.?0+$/, '')} M`
  if (v >= 1e6) return `${s}Rp ${Math.round(v / 1e6)} jt`
  if (v >= 1e3) return `${s}Rp ${Math.round(v / 1e3)}rb`
  return `${s}Rp ${v.toLocaleString('id-ID')}`
}
/** `fRpPenuh` — the full form, for the PR sheet and the item lists. */
export const fRpPenuh = (n: unknown) => `Rp ${ribuan(n)}`
/** `rzFormat` — a plain number to "1.985.000" for the realisation input. */
export function rzFormat(v: unknown): string {
  const d = String(v == null ? '' : v).replace(/[^0-9]/g, '')
  return d ? Number(d).toLocaleString('id-ID') : ''
}
/** `nowStamp` — "YYYY-MM-DD HH:MM", local device time. */
export function nowStamp(): string {
  const d = new Date()
  return `${isoOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** `fWaktu` — "27 Sep" or "27 Sep · 08:30". */
export function fWaktu(s?: string): string {
  const t = String(s || '')
  if (!t) return '—'
  const p = t.split(' ')
  return fTglP(p[0]) + (p[1] ? ` · ${p[1]}` : '')
}
/** `inisial` — up to two initials. */
export const inisial = (n?: string) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

// ─────────────────────────── Eisenhower & people ──

export type Kuadran = 'do' | 'schedule' | 'delegate' | 'delete'
export interface KuadranInfo { k: Kuadran, l: string, d: string }

/** `kuadran` — DERIVED from important+urgent, never stored (`:1316-1322`). */
export function kuadran(t: { important?: boolean, urgent?: boolean }): KuadranInfo {
  if (t.important && t.urgent) return { k: 'do', l: 'DO', d: 'Kerjakan sekarang' }
  if (t.important && !t.urgent) return { k: 'schedule', l: 'SCHEDULE', d: 'Jadwalkan' }
  if (!t.important && t.urgent) return { k: 'delegate', l: 'DELEGATE', d: 'Delegasikan / koordinasi' }
  return { k: 'delete', l: 'DELETE', d: 'Pertimbangkan hapus' }
}
/** `selesai`. */
export const selesai = (t: { status?: string }) => t.status === 'Done'
/** `lewat`. */
export const lewat = (t: { deadline?: string, status?: string }) => !!t.deadline && !selesai(t) && sisaHari(t.deadline) < 0

type BerPic = { pics?: string[], pic?: string }
/** `pics` — always an array, never null. */
export function pics(o?: BerPic | null): string[] {
  if (o && Array.isArray(o.pics)) return o.pics
  return o && o.pic ? [o.pic] : []
}
/** `punyaPic`. */
export const punyaPic = (o: BerPic | null | undefined, id: string) => pics(o).includes(id)
/** `tagsOf` — free-text tags on a task, always an array (empty when untagged). */
export function tagsOf(t: { tags?: unknown } | null | undefined): string[] {
  return t && Array.isArray(t.tags) ? t.tags.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []
}

// ─────────────────────────── Tag colours (delta BD, Okt 2026) ──
// Faithful port of the old client's tag colours
// (deploy/bd/index.html:2312-2360, `kunciTag/warnaTag/warnaAcak/gayaTag/semuaTag`).
// A colour belongs to the TAG, never the task: renaming #Andi's colour
// repaints every task wearing #Andi. The palette is closed so text stays
// readable on its own faded background — a free colour picker could paint
// light yellow on light yellow.

/** `TAG_PALET` — the 12 closed-palette colours, verbatim from the old client. */
export const TAG_PALET = ['#B7791F', '#C53030', '#D53F8C', '#805AD5', '#3182CE', '#00A3C4', '#2F855A', '#68A63A', '#DD6B20', '#718096', '#2C5282', '#975A16']
/** `kunciTag` — the settings key: lowercase, so "andi" and "Andi" never stand as two tags. */
export const kunciTag = (x: string) => String(x || '').trim().toLowerCase()
/** A stored colour is a `#rrggbb` hex. */
export const warnaSah = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
/**
 * `warnaTag` — the colour of one tag. A tag without a stored colour (old
 * rows, or a server not yet carrying `tagWarna`) falls back to its NAME hash
 * — stable, never random per render: a colour that reshuffles on every paint
 * cannot identify anything.
 */
export function warnaTag(x: string, peta?: Record<string, string> | null): string {
  const k = kunciTag(x)
  const c = peta?.[k]
  if (warnaSah(c)) return c
  let h = 0
  for (let i = 0; i < k.length; i++) h = ((h * 31 + k.charCodeAt(i)) >>> 0)
  return TAG_PALET[h % TAG_PALET.length]!
}
/**
 * `warnaAcak` — a colour for a brand-new tag, preferring one no other tag
 * uses yet: two tags sharing a colour on one card stop meaning anything.
 */
export function warnaAcakTag(terpakai: string[]): string {
  const ada = new Set(terpakai.map(c => String(c).toLowerCase()))
  const bebas = TAG_PALET.filter(c => !ada.has(c.toLowerCase()))
  const dari = bebas.length ? bebas : TAG_PALET
  return dari[Math.floor(Math.random() * dari.length)]!
}
/** `semuaTag` — every tag worn by any task, deduplicated case-insensitively keeping the stored spelling. */
export function semuaTag(semua: { tags?: unknown }[]): string[] {
  const peta: Record<string, string> = {}
  semua.forEach(t => tagsOf(t).forEach((x) => {
    const k = kunciTag(x)
    if (k && !peta[k]) peta[k] = x.trim()
  }))
  return Object.keys(peta).map(k => peta[k]!).sort((a, b) => a.localeCompare(b, 'id'))
}
/** `gayaTag` — the chip style for one colour: filled when on, outline when off. */
export function gayaTag(c: string, on = true): Record<string, string> {
  return on
    ? { backgroundColor: `${c}1f`, borderColor: c, color: c }
    : { borderColor: `${c}55`, color: c }
}
/** `ULANG` — recurrence options for a task (old `ULANG`, deploy/bd/index.html:2846). */
export const ULANG: [string, string][] = [
  ['', 'Tidak berulang'],
  ['harian', 'Setiap hari'],
  ['kerja', 'Hari kerja (Sen–Jum)'],
  ['mingguan', 'Setiap minggu'],
  ['bulanan', 'Setiap bulan'],
  ['bulanan_ke', 'Setiap bulan, hari ke-N'],
  ['bulanan_akhir', 'Setiap bulan, hari terakhir'],
  ['tahunan', 'Setiap tahun'],
]
/** `labelUlang` — the recurrence label, empty when not recurring. Custom
 * `k/…` patterns and the new presets read the weekday/date from the
 * deadline (`agent_label_ulang`); without a deadline they fall back to the
 * generic form. */
export function labelUlang(u?: string, iso?: string): string {
  if (!u) return ''
  const penuh = labelUlangPenuh(u, iso)
  if (penuh) return penuh
  const x = ULANG.find(y => y[0] === u)
  return x && u ? x[1] : ''
}
/** `tglSah` — real YYYY-MM-DD date (old `gSah`). */
export function tglSah(iso?: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}
/** `langkahUlang` — one recurrence step ahead (old :2852-2862). 'bulanan' clamps to month-end (31 Jan → 28/29 Feb). */
export function langkahUlang(iso: string, u?: string): string {
  const r = parseUlang(u)
  // Legacy presets keep their exact old behaviour.
  if (!r || r.preset) {
    if (u === 'bulanan') {
      const d = pDate(iso)
      const x = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const akhir = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
      x.setDate(Math.min(d.getDate(), akhir))
      return isoOf(x)
    }
    if (u === 'mingguan') return tambahHari(iso, 7)
    let n = tambahHari(iso, 1)
    if (u === 'kerja') {
      let aman = 0
      while ((pDate(n).getDay() === 0 || pDate(n).getDay() === 6) && aman++ < 10) n = tambahHari(n, 1)
    }
    return n
  }
  return langkahKustom(iso, r)
}
/** `deadlineBerikut` — first occurrence not in the past; a late completion skips ahead instead of spawning overdue twins (old :2863-2871). */
export function deadlineBerikut(t: { deadline?: string, ulang?: string }): string | null {
  if (!t.ulang || !labelUlang(t.ulang, t.deadline) || !tglSah(t.deadline)) return null
  const hari = todayISO()
  let n = langkahUlang(t.deadline as string, t.ulang)
  let aman = 0
  while (n < hari && aman++ < 400) n = langkahUlang(n, t.ulang)
  return n
}
/** `seriBerakhir` — a custom `sampai tanggal / N kali` series is spent:
 * `d:` past the next date, `x:` once chain length (+ missed dates) reaches
 * the quota. Ended series birth nothing and never roll. */
export function seriBerakhir(t: { ulang?: string }, berikut: string, rantai = 0, terlewat = 0): boolean {
  const r = parseUlang(t?.ulang)
  if (!r || !r.akhir.j) return false
  if (r.akhir.j === 'd') return berikut > (r.akhir.tgl || '')
  return (rantai + terlewat) >= (r.akhir.kali || 0)
}
/** Chain length of one series: the `ulangDari` ancestry plus missed dates. */
export function hitungSeri(t: { ulangDari?: string, terlewat?: { d?: string }[] | null }, semua: { id: string, ulangDari?: string }[]): { rantai: number, terlewat: number } {
  let rantai = 1
  let cur = t
  const lihat = new Set<string>()
  let aman = 0
  while (cur?.ulangDari && aman++ < 500) {
    const atas = semua.find(x => x.id === cur.ulangDari)
    if (!atas || lihat.has(atas.id)) break
    lihat.add(atas.id)
    rantai++
    cur = atas as typeof t
  }
  return { rantai, terlewat: Array.isArray(t.terlewat) ? t.terlewat.length : 0 }
}
/** `lahirkanUlang` — the next occurrence as a new-row body, or null. Never twins: Done → reopen → Done again is guarded by `ulangDari` (old :2872-2888). Ended custom series birth nothing. */
export function lahirkanUlang(t: BdTask, semua: BdTask[]): (Partial<BdTask> & { id: string }) | null {
  const nd = deadlineBerikut(t)
  if (!nd) return null
  if (semua.some(x => x.ulangDari === t.id)) return null
  const { rantai, terlewat } = hitungSeri(t, semua)
  if (seriBerakhir(t, nd, rantai, terlewat)) return null
  const geser = Math.round((+pDate(nd) - +pDate(t.deadline as string)) / 86400000)
  const g = (iso?: string) => (tglSah(iso) ? tambahHari(iso as string, geser) : iso)
  const b: Partial<BdTask> & { id: string } = {
    id: uidBd('t'),
    name: t.name, desc: t.desc || '', div: t.div,
    status: 'To Do', priority: t.priority || 'Medium',
    deadline: nd, important: !!t.important, urgent: !!t.urgent,
    type: t.type || 'Ad-hoc', project: t.project || null,
    ulang: t.ulang, ulangDari: t.id, progress: 0, dependsOn: [],
    subtasks: subs(t).map((x) => {
      const o: BdSubtask = { id: uidBd('s'), t: String(x.t || ''), done: false }
      const d = g(x.d)
      if (d) o.d = d
      // The step's keterangan carries over (it is how the step is done); the
      // attachments do not — they are the proof of the occurrence just closed.
      if (String(x.note || '').trim()) o.note = String(x.note)
      return o
    }),
  }
  if (t.daily) b.daily = true
  if (tagsOf(t).length) b.tags = tagsOf(t).slice()
  const st = g(t.start)
  if (st) b.start = st
  setPics(b, pics(t))
  return b
}
/** `reviewers` — crew ids asked to review a task (old `reviewers(t)`). Never guessed, never migrated: absent or non-array reads as none. */
export function reviewers(t: { reviewers?: unknown } | null | undefined): string[] {
  return t && Array.isArray(t.reviewers) ? t.reviewers.filter((x): x is string => !!x) : []
}
/** `menungguReviewSaya` — tasks in Review state asking me to review. */
export function menungguReviewSaya<T extends { status?: string, reviewers?: unknown }>(daftar: T[], akuId?: string | null): T[] {
  if (!akuId) return []
  return daftar.filter(t => t.status === 'Review' && reviewers(t).includes(akuId))
}
/**
 * `kanbanUrut(st)` — a card dragged into a column lands at its BOTTOM: rows
 * tagged with this column (`pindahKe = {st, at}`) stand AFTER every untagged
 * row, in drag-time order. A status change through the modal or a checkbox
 * drops the tag, so the card returns to deadline order in its new column.
 */
export function kanbanUrut(st: string): (a: BdTask, b: BdTask) => number {
  const geser = (t: BdTask) => !!(t.pindahKe && t.pindahKe.st === st)
  return (a, b) => {
    const ga = geser(a)
    const gb = geser(b)
    if (ga !== gb) return ga ? 1 : -1
    if (ga && gb) return (a.pindahKe?.at || 0) - (b.pindahKe?.at || 0)
    return urutDeadline(a, b)
  }
}

// ─────────────────────────── recurrence engine (27 Okt 2026) ──
// `t.ulang` stays one string. Old presets keep their meaning; new presets
// (`bulanan_ke`, `bulanan_akhir`, `tahunan`) read the weekday/date from the
// deadline on every computation. Custom = `k/<tiap>/<satuan>/<hari>/<mode>/<akhir>`.

export type UlangAkhir = { j: '', tgl?: string, kali?: number } | { j: 'd', tgl: string } | { j: 'x', kali: number }
export interface UlangRumus { tiap: number, satuan: 'hari' | 'minggu' | 'bulan' | 'tahun', hari: number[], mode: 'tgl' | 'ke' | 'akhir', akhir: UlangAkhir, preset: string }

const ULANG_PRESET: Record<string, Omit<UlangRumus, 'akhir' | 'preset'>> = {
  harian: { tiap: 1, satuan: 'hari', hari: [], mode: 'tgl' },
  kerja: { tiap: 1, satuan: 'minggu', hari: [1, 2, 3, 4, 5], mode: 'tgl' },
  mingguan: { tiap: 1, satuan: 'minggu', hari: [], mode: 'tgl' },
  bulanan: { tiap: 1, satuan: 'bulan', hari: [], mode: 'tgl' },
  bulanan_ke: { tiap: 1, satuan: 'bulan', hari: [], mode: 'ke' },
  bulanan_akhir: { tiap: 1, satuan: 'bulan', hari: [], mode: 'akhir' },
  tahunan: { tiap: 1, satuan: 'tahun', hari: [], mode: 'tgl' },
}
const HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** `parseUlang` — the single reader; an unreadable string is not recurring. */
export function parseUlang(u?: string): UlangRumus | null {
  const s = String(u || '')
  const p = ULANG_PRESET[s]
  if (p) return { ...p, hari: [...p.hari], akhir: { j: '' }, preset: s }
  if (!s.startsWith('k/')) return null
  const q = s.split('/')
  const tiap = Number.parseInt(q[1] || '', 10)
  const sat = q[2] || ''
  if (!(tiap >= 1 && tiap <= 99) || !['hari', 'minggu', 'bulan', 'tahun'].includes(sat)) return null
  const hari = String(q[3] || '').split(',').filter(x => /^[0-6]$/.test(x)).map(Number)
    .filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b)
  const mode = (['tgl', 'ke', 'akhir'].includes(q[4] || '') ? q[4] : 'tgl') as UlangRumus['mode']
  const ak = String(q[5] || '')
  let akhir: UlangAkhir = { j: '' }
  if (/^d:\d{4}-\d{2}-\d{2}$/.test(ak)) akhir = { j: 'd', tgl: ak.slice(2) }
  else if (/^x:\d+$/.test(ak) && Number(ak.slice(2)) >= 1) akhir = { j: 'x', kali: Number(ak.slice(2)) }
  return { tiap, satuan: sat as UlangRumus['satuan'], hari, mode, akhir, preset: '' }
}

/** `susunUlang` — a custom rule back to its string. */
export function susunUlang(r: UlangRumus): string {
  return `k/${r.tiap}/${r.satuan}/${r.satuan === 'minggu' ? r.hari.join(',') : ''}/${r.satuan === 'bulan' ? r.mode : ''}/`
    + (r.akhir.j === 'd' ? `d:${r.akhir.tgl}` : r.akhir.j === 'x' ? `x:${r.akhir.kali}` : '')
}

const keBerapa = (iso: string) => Math.ceil(pDate(iso).getDate() / 7)
function tambahBulan(iso: string, n: number): string {
  const d = pDate(iso)
  const tg = d.getDate()
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  x.setDate(Math.min(tg, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()))
  return isoOf(x)
}
function hariKeN(th: number, bl: number, dow: number, n: number): string | null {
  const x = new Date(th, bl, 1)
  const geser = (dow - x.getDay() + 7) % 7
  const tg = 1 + geser + (n - 1) * 7
  return tg <= new Date(th, bl + 1, 0).getDate() ? isoOf(new Date(th, bl, tg)) : null
}
function hariAkhirBulan(th: number, bl: number, dow: number): string {
  const x = new Date(th, bl + 1, 0)
  x.setDate(x.getDate() - ((x.getDay() - dow + 7) % 7))
  return isoOf(x)
}
function langkahKustom(iso: string, r: UlangRumus): string {
  const d = pDate(iso)
  const dow = d.getDay()
  if (r.satuan === 'hari') return tambahHari(iso, r.tiap)
  if (r.satuan === 'minggu') {
    if (!r.hari.length) return tambahHari(iso, 7 * r.tiap)
    for (let k = dow + 1; k <= 6; k++) if (r.hari.includes(k)) return tambahHari(iso, k - dow)
    return tambahHari(iso, 7 * r.tiap - dow + r.hari[0]!)
  }
  if (r.satuan === 'tahun') return tambahBulan(iso, 12 * r.tiap)
  if (r.mode === 'tgl') return tambahBulan(iso, r.tiap)
  const n = keBerapa(iso)
  let m = r.tiap
  let aman = 0
  while (aman++ < 60) {
    const x = new Date(d.getFullYear(), d.getMonth() + m, 1)
    const hasil = r.mode === 'akhir'
      ? hariAkhirBulan(x.getFullYear(), x.getMonth(), dow)
      : hariKeN(x.getFullYear(), x.getMonth(), dow, n)
    if (hasil) return hasil
    m += r.tiap
  }
  return tambahBulan(iso, r.tiap)
}

/** `labelUlang` full engine, read against the deadline (agent_label_ulang). */
export function labelUlangPenuh(u?: string, iso?: string): string {
  const r = parseUlang(u)
  if (!r) return ''
  const ok = tglSah(iso)
  const d = ok ? pDate(iso) : null
  const H = d ? HARI_PANJANG[d.getDay()]! : ''
  const ekor = r.akhir.j === 'd' ? `, sampai ${r.akhir.tgl}` : r.akhir.j === 'x' ? `, ${r.akhir.kali}× saja` : ''
  switch (r.preset) {
    case 'harian': return 'Setiap hari'
    case 'kerja': return 'Hari kerja (Sen–Jum)'
    case 'mingguan': return ok ? `Setiap minggu hari ${H}` : 'Setiap minggu'
    case 'bulanan': return ok ? `Setiap bulan tanggal ${d!.getDate()}` : 'Setiap bulan'
    case 'bulanan_ke': return ok ? `Setiap bulan, ${H} ke-${keBerapa(iso!)}` : 'Setiap bulan (hari ke-N)'
    case 'bulanan_akhir': return ok ? `Setiap bulan, ${H} terakhir` : 'Setiap bulan (hari terakhir)'
    case 'tahunan': return ok ? `Setiap tahun ${fTglP(iso!)}` : 'Setiap tahun'
  }
  const tiap = r.tiap > 1 ? `Setiap ${r.tiap} ${r.satuan}` : `Setiap ${r.satuan}`
  let isi = ''
  if (r.satuan === 'minggu') isi = r.hari.length ? `: ${r.hari.map(x => HARI_PENDEK[x]).join(', ')}` : (ok ? ` hari ${H}` : '')
  if (r.satuan === 'bulan' && ok) isi = r.mode === 'ke' ? `, ${H} ke-${keBerapa(iso!)}` : r.mode === 'akhir' ? `, ${H} terakhir` : ` tanggal ${d!.getDate()}`
  if (r.satuan === 'tahun' && ok) isi = ` ${fTglP(iso!)}`
  return tiap + isi + ekor
}
/** `kruTersedia` — crew that may be picked: still active with module access,
 * plus anyone already holding the row being opened, so saving never silently
 * drops an assignee (`:1944-1951`). */
export function kruTersedia(people: BdPerson[], sudah?: string | string[] | null): BdPerson[] {
  const s = Array.isArray(sudah) ? sudah : (sudah ? [sudah] : [])
  return people.filter(p => (p.active !== false && !p.tanpaAkses) || s.includes(p.id))
}
/** `pelaksana` — everyone working a task: its PICs AND the sub-task
 * assignees. Someone holding a single sub-task still finds their work in
 * My Task and the Projects › Task assignee filter. */
export function pelaksana(t: (BerPic & { subtasks?: { p?: string }[] | null }) | null | undefined): string[] {
  const a = pics(t)
  subs(t as { subtasks?: BdSubtask[] | null }).forEach((x) => {
    if (x && x.p && !a.includes(x.p)) a.push(x.p)
  })
  return a
}
/** `setPics` — the ONLY place `pic` and `pics` are written, so they never drift. */
export function setPics(o: BerPic, daftar: string[]): void {
  o.pics = (daftar || []).filter((v, i, a) => v && a.indexOf(v) === i)
  o.pic = o.pics[0] || ''
}
/** `P(id)` — a person by row id, with a safe placeholder. */
export const orangById = (people: BdPerson[], id?: string | null): BdPerson =>
  people.find(p => p.id === id) || { id: '', name: '—', role: '', div: '' } as BdPerson
/** `jabatanOrang` — Office `ket`, fallback `role`, then "—" (never invented). */
export function jabatanOrang(p?: Pick<BdPerson, 'ket' | 'role'> | null): string {
  const t = String((p && p.ket) || '').trim() || String((p && p.role) || '').trim()
  return t ? t.toUpperCase() : '—'
}
/** `bawahan` — all reports, direct and indirect. */
export function bawahan(people: BdPerson[], id: string): string[] {
  let out: string[] = []
  people.forEach((p) => {
    if (p.boss === id) {
      out.push(p.id)
      out = out.concat(bawahan(people, p.id))
    }
  })
  return out
}
/** `lingkup` — null means "everything" (admin or no matching row). */
export function lingkupIds(people: BdPerson[], akuId?: string, admin = false): string[] | null {
  if (!akuId || admin) return null
  return [akuId, ...bawahan(people, akuId)]
}
/**
 * Whose My Task this user may open besides their own: a BD admin every active
 * crew member, a boss their reports (direct and indirect), anyone else nobody.
 */
export function orangPantau(people: BdPerson[], akuId?: string, admin = false): BdPerson[] {
  const l = admin ? null : akuId ? bawahan(people, akuId) : []
  return people
    .filter(p => p.id !== akuId && p.active !== false && !p.tanpaAkses && (!l || l.includes(p.id)))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'))
}
/** `dalamLingkup` — visible when ANY of its PICs is in scope. */
export function dalamLingkup(o: BerPic, l: string[] | null): boolean {
  if (!l) return true
  return pics(o).some(id => l.includes(id))
}
/** `saringLingkup` — shared by Tasks, Projects and Calendar. */
export function saringLingkup<T extends BerPic>(daftar: T[], scope: string, l: string[] | null, akuId?: string): T[] {
  if (scope === 'semua') return daftar
  if (scope === 'saya') return akuId ? daftar.filter(o => punyaPic(o, akuId)) : daftar
  return daftar.filter(o => dalamLingkup(o, l))
}
/** `kenali` — the crew row of the signed-in user: officeUserId first, then name. */
export function cariAku(people: BdPerson[], me?: { id?: string, name?: string } | null): BdPerson | null {
  if (!me) return null
  return people.find(p => p.officeUserId && p.officeUserId === me.id)
    || people.find(p => String(p.name || '').toLowerCase() === String(me.name || '').toLowerCase())
    || null
}
/** `catIniAku` — the key of the daily-focus document. */
export function catIniAku(people: BdPerson[], meId?: string): string {
  const aku = people.find(p => p.officeUserId && p.officeUserId === meId)
  return aku ? aku.id : `office:${meId || '?'}`
}

// ─────────────────────────── Agenda peserta & RSVP ──

/** The three RSVP answers an invited crew member can give. */
export const RSVP_OPSI = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'mungkin', label: 'Mungkin' },
  { value: 'tidak', label: 'Tidak' },
] as const
export type RsvpNilai = 'hadir' | 'mungkin' | 'tidak'

/** `normResp` — defensive: an empty RSVP map reads back as `[]` from PHP. Unknown values are dropped, never drawn. */
export function normResp(resp: unknown): Record<string, RsvpNilai> {
  if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
    const out: Record<string, RsvpNilai> = {}
    for (const [k, v] of Object.entries(resp as Record<string, unknown>)) {
      if (v === 'hadir' || v === 'mungkin' || v === 'tidak') out[k] = v
    }
    return out
  }
  return {}
}

/** An outsider from the whole Tim, stored as `o:<officeUserId>` — never a BD people row, so they cannot answer. */
export const idOrangLuar = (id?: string | null) => String(id || '').startsWith('o:')
/** The Office user id behind an outsider peserta. */
export const officeIdDari = (id: string) => String(id).slice(2)

/** `namaPeserta` — the crew name, else the snapshot stored in `pesertaNama`. */
export function namaPeserta(people: BdPerson[], pesertaNama: Record<string, string> | undefined, id: string): string {
  const p = people.find(x => x.id === id)
  if (p) return p.name
  return String(pesertaNama?.[id] || '').trim() || '—'
}

/**
 * `bisaJawab` — only active crew WITH module access can answer. Outsiders
 * (`o:`) have no module access by definition, and revoked crew cannot open
 * the module either — both are invited as guests, never as answerers.
 */
export function bisaJawab(people: BdPerson[], id: string): boolean {
  if (idOrangLuar(id)) return false
  const p = people.find(x => x.id === id)
  return !!p && p.active !== false && !p.tanpaAkses
}
/** Why this peserta cannot answer. */
export const alasanTakBisaJawab = (id: string) => idOrangLuar(id)
  ? 'Tanpa akses modul — diundang sebagai tamu, tidak bisa menjawab.'
  : 'Aksesnya dicabut — tidak bisa menjawab.'

/** The roster row behind one crew member: officeUserId first, then name. */
export function rosterKru<T extends { id: string, name: string, keterangan?: string }>(
  roster: T[],
  p: Pick<BdPerson, 'officeUserId' | 'name'>,
): T | undefined {
  const nama = String(p.name || '').trim().toLowerCase()
  return roster.find(x => p.officeUserId && String(x.id) === String(p.officeUserId))
    || roster.find(x => String(x.name || '').trim().toLowerCase() === nama)
}

/**
 * `TIM_UNDANG` — the invite buttons: every Office team plus Office staff
 * (`office`/`kantor` words, laksamana-api `Divisi::OFFICE_WORDS`). Kept
 * separate from `TIM_OFFICE` so that list keeps mirroring `Tim::TIM` exactly.
 */
export const TIM_UNDANG: TimOffice[] = [
  ...TIM_OFFICE,
  { key: 'office', label: 'Office', words: ['office', 'kantor'] },
]
/** `timUndangDariKet` — like `timDariKet`, but Office staff is its own team. */
export function timUndangDariKet(ket?: string | null): string[] {
  const kata = String(ket || '').toLowerCase().split(/[^a-z]+/).filter(Boolean)
  if (!kata.length) return []
  return TIM_UNDANG.filter(t => t.words.some(w => kata.includes(w))).map(t => t.label)
}

export interface CalonPeserta { id: string, nama: string, luar: boolean, ket: string }
/**
 * `calonUndang` — everyone in one division: BD crew (by roster Tim match)
 * plus whole-Tim outsiders as `o:<officeUserId>`. A multi-Tim keterangan
 * matches every team it names, so "Kasir, Office" is invited with Cashier
 * AND with Office. Sorted by name.
 */
export function calonUndang<T extends { id: string, name: string, keterangan?: string, active?: boolean }>(
  div: string,
  people: BdPerson[],
  roster: T[],
): CalonPeserta[] {
  const cocok = (ket?: string | null) => timUndangDariKet(ket).includes(div)
  const namaRendah = (s: unknown) => String(s || '').trim().toLowerCase()
  const out: CalonPeserta[] = []
  const lihat = new Set<string>()
  for (const p of people) {
    const m = rosterKru(roster, p)
    if (!m || !cocok(m.keterangan)) continue
    if (lihat.has(p.id)) continue
    lihat.add(p.id)
    out.push({ id: p.id, nama: p.name, luar: false, ket: m.keterangan || '' })
  }
  for (const r of roster) {
    if (r.active === false || !cocok(r.keterangan)) continue
    const kru = people.find(p =>
      (p.officeUserId && String(p.officeUserId) === String(r.id)) || namaRendah(p.name) === namaRendah(r.name))
    const id = kru ? kru.id : `o:${r.id}`
    if (lihat.has(id)) continue
    lihat.add(id)
    out.push({ id, nama: kru ? kru.name : r.name, luar: !kru, ket: r.keterangan || '' })
  }
  return out.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

/** `ringkasRsvp` — "3 hadir · 1 mungkin" for the agenda display. */
export function ringkasRsvp(resp: Record<string, RsvpNilai> | undefined): string {
  const jawab = Object.values(resp || {})
  if (!jawab.length) return ''
  const n = (v: RsvpNilai) => jawab.filter(x => x === v).length
  return [
    n('hadir') ? `${n('hadir')} hadir` : '',
    n('mungkin') ? `${n('mungkin')} mungkin` : '',
    n('tidak') ? `${n('tidak')} tidak` : '',
  ].filter(Boolean).join(' · ')
}

// ─────────────────────────── Agenda berjam & inbox (LM Agenda, 30 Okt 2026) ──
// Shape notes: the Vue RSVP answer is the bare word ('hadir'|'mungkin'|
// 'tidak'), never the old `{s, at}` object — `normResp` guarantees it.
// Invite stamps ride in `undang {id: {at, ubah?}}` for notification timing.

/** `agTim` — a team agenda: no owner and no peserta. Visible to all, editable by all. */
export const agTim = (e: Pick<BdAgenda, 'owner' | 'peserta'> | null | undefined) =>
  !e?.owner && !(Array.isArray(e?.peserta) ? e.peserta.filter(Boolean).length : 0)
/** `agUntuk` — who sees this agenda: everyone for a team agenda, else owner + peserta. */
export function agUntuk(e: Pick<BdAgenda, 'owner' | 'peserta'> | null | undefined, id?: string | null): boolean {
  if (!e || agTim(e)) return true
  if (!id) return true
  return e.owner === id || (Array.isArray(e.peserta) && e.peserta.includes(id))
}
/** `agBisaUbah` — only the organiser, a module admin, or (for team agendas) anyone. */
export const agBisaUbah = (
  e: Pick<BdAgenda, 'owner' | 'peserta'> | null | undefined,
  akuId?: string | null,
  admin = false,
): boolean => !e || agTim(e) || admin || (!!akuId && e.owner === akuId)
/** `agendaHari` — my agendas for one date, timeless last, then by start time. */
export function agendaHari(daftar: BdAgenda[], date: string, akuId?: string | null): BdAgenda[] {
  return daftar
    .filter(e => e.date === date && agUntuk(e, akuId))
    .sort((a, b) => (a.start || '99') < (b.start || '99') ? -1 : 1)
}
/** `milestoneHari` — my projects' milestones for one date. */
export function milestoneHari(daftar: BdProject[], date: string, akuId?: string | null): { p: BdProject, ms: BdMilestone }[] {
  const out: { p: BdProject, ms: BdMilestone }[] = []
  for (const p of daftar) {
    if (akuId && !pics(p).includes(akuId)) continue
    for (const ms of p.milestones || []) {
      if (ms.date === date) out.push({ p, ms })
    }
  }
  return out
}
/** `tugasSaya` — tasks I hold: my PICs, my sub-task assignments, and tasks
 *  waiting on my review. The unmatched see everything, said out loud. */
export function tugasSaya(daftar: BdTask[], akuId?: string | null): BdTask[] {
  if (!akuId) return daftar
  return daftar.filter(t =>
    pelaksana(t).includes(akuId) || (t.status === 'Review' && reviewers(t).includes(akuId)))
}
/**
 * `undanganTertunda` — agendas still asking for MY answer: owned by someone
 * else, inviting me, dated today or later, unanswered. Past ones are never
 * nagged — answering "hadir" for yesterday means nothing.
 */
export function undanganTertunda(daftar: BdAgenda[], akuId?: string | null, hari?: string): BdAgenda[] {
  if (!akuId) return []
  const t0 = hari || todayISO()
  return daftar
    .filter(e => e.owner && e.owner !== akuId
      && Array.isArray(e.peserta) && e.peserta.includes(akuId)
      && e.date >= t0 && !(e.resp || {})[akuId])
    .sort((a, b) => (`${a.date}${a.start || ''}` < `${b.date}${b.start || ''}` ? -1 : 1))
}
/** `jamAgendaBerubah` — did the schedule move? A moved schedule drops every answer. */
export const jamAgendaBerubah = (
  lama: Pick<BdAgenda, 'date' | 'start' | 'end'>,
  baru: Pick<BdAgenda, 'date' | 'start' | 'end'>,
) => lama.date !== baru.date || (lama.start || '') !== (baru.start || '') || (lama.end || '') !== (baru.end || '')

// ─────────────────────────── Jam deadline ──

/** `jamValid` — "HH:MM" 24-hour; empty means "no time set", which is always fine. */
export const jamValid = (jam?: string | null) => !jam || /^([01]\d|2[0-3]):[0-5]\d$/.test(jam)
/** `labelJam` — the optional time attached to a due text (" · 14:00"), empty when unset. */
export const labelJam = (jam?: string | null) => jamValid(jam) && jam ? ` · ${jam}` : ''
/** `menitJam` — "HH:MM" as minutes past midnight; null when unset or invalid. */
export function menitJam(jam?: string | null): number | null {
  if (!jamValid(jam) || !jam) return null
  const [h, m] = String(jam).split(':').map(Number)
  return h! * 60 + m!
}
/** `menitKeJam` — minutes past midnight as "HH:MM", clamped to the day. */
export function menitKeJam(menit: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(menit)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** `rentangJamSah` — a start/end pair for one agenda: an end needs a start, and must be after it. */
export const rentangJamSah = (start?: string | null, end?: string | null) =>
  (!start && !end) || (!!start && (!end || (menitJam(end)! > menitJam(start)!)))

// ─────────────────────────── Projects ──

/** `projTasks`. */
export const projTasks = (tasks: BdTask[], pid: string) => tasks.filter(t => t.project === pid)
/** `projProgress` — from tasks, fallback milestones, else 0 (`:1883-1888`). */
export function projProgress(p: BdProject, tasks: BdTask[]): number {
  const ts = projTasks(tasks, p.id)
  if (ts.length) return Math.round((ts.filter(selesai).length / ts.length) * 100)
  const m = p.milestones || []
  if (m.length) return Math.round((m.filter(x => x.done).length / m.length) * 100)
  return 0
}
/** `opsiProject` — a finished project is not offered unless it is already linked. */
export function opsiProject(projects: BdProject[], terpilih?: string | null): { value: string, label: string }[] {
  const out: { value: string, label: string }[] = [{ value: PILIHAN_TANPA, label: '— tanpa project —' }]
  projects.forEach((p) => {
    const beres = p.stage === 'Done'
    if (beres && p.id !== terpilih) return
    out.push({ value: p.id, label: p.name + (beres ? ' (selesai)' : '') })
  })
  return out
}

// ─────────────────────────── Weekly helpers ──
// Monday is the first day, the same as the calendar (`:3119-3128`).

export function awalMinggu(iso?: string): string {
  const d = pDate(iso || todayISO())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoOf(d)
}
export function geserMinggu(iso: string, n: number): string {
  const d = pDate(iso)
  d.setDate(d.getDate() + n * 7)
  return isoOf(d)
}
export function akhirMinggu(iso?: string): string {
  const d = pDate(awalMinggu(iso))
  d.setDate(d.getDate() + 6)
  return isoOf(d)
}
export function labelMinggu(senin: string): string {
  const m = pDate(senin)
  const a = new Date(m)
  a.setDate(a.getDate() + 6)
  return `${m.getDate()} ${BLN[m.getMonth()]} — ${a.getDate()} ${BLN[a.getMonth()]} ${a.getFullYear()}`
}

// ─────────────────────────── Purchasing ──

/** `poRequester` — `by` first, then the free-text `byName`, then `pic`. */
export function poRequester(p: BdPo, people: BdPerson[]): string {
  if (p.by && orangById(people, p.by).id) return orangById(people, p.by).name
  if (p.byName) return p.byName
  return p.pic ? orangById(people, p.pic).name : '—'
}
/** `poBeres` — processed marker OR the final status. */
export const poBeres = (p: BdPo) => !!p.proses || p.status === 'Diterima'
/** `prItems` — items point back through `prId` (one item, one home). */
export const prItems = (prId: string, po: BdPo[]) => po.filter(p => p.prId === prId)
/** `prBeres` — computed; an empty sheet is NEVER complete (`:3379-3382`). */
export function prBeres(prId: string, po: BdPo[]): boolean {
  const items = prItems(prId, po)
  return items.length > 0 && items.every(poBeres)
}
/** `prTotal`. */
export function prTotal(prId: string, po: BdPo[]): { grand: number, belum: number } {
  let grand = 0
  let belum = 0
  prItems(prId, po).forEach((p) => {
    const a = Number(p.amount) || 0
    grand += a
    if (!a) belum++
  })
  return { grand, belum }
}
/** `prNoBerikut` — highest + 1, never reused (`:3392-3398`). */
export function prNoBerikut(pr: BdPr[]): string {
  let maks = 0
  pr.forEach((x) => {
    const n = Number.parseInt(String(x.no), 10)
    if (!Number.isNaN(n) && n > maks) maks = n
  })
  return String(maks + 1)
}
/** `realisasiNum` — empty is NOT 0 (`:3806-3808`). */
export function realisasiNum(p?: Pick<BdPo, 'realisasi'> | null): number | null {
  const v = p && p.realisasi
  return v === '' || v === null || v === undefined ? null : (Number(v) || 0)
}
/** `overbudget` — amount − realisation; positive = saving (`:3810-3812`). */
export function overbudget(p: Pick<BdPo, 'realisasi' | 'amount'>): number | null {
  const r = realisasiNum(p)
  return r === null ? null : (Number(p.amount) || 0) - r
}
/**
 * `togglePoProses` fields — the marker MOVES the status to `Diterima` and keeps
 * the previous one in `statusSebelum`; cancelling restores it (`:3222-3237`).
 */
export function fieldsProses(p: BdPo, on: boolean, nama: string): Partial<BdPo> {
  if (on) {
    const out: Partial<BdPo> = { proses: true, prosesAt: Date.now(), prosesBy: nama || '' }
    if (p.status !== 'Diterima') {
      out.statusSebelum = p.status
      out.status = 'Diterima'
    }
    return out
  }
  const out: Partial<BdPo> = { proses: false, prosesAt: null, prosesBy: null, statusSebelum: null }
  if (p.status === 'Diterima' && p.statusSebelum) out.status = p.statusSebelum
  return out
}

// ─────────────────────────── Routine compliance ──

/** `vRoutine` average compliance over ACTIVE routines (`:2197-2198`). */
export function kepatuhanRoutine(routines: { active?: boolean, done?: number, total?: number }[]): number {
  const aktif = routines.filter(r => r.active)
  if (!aktif.length) return 100
  return Math.round((aktif.reduce((s, r) => s + (r.total ? (Number(r.done) || 0) / r.total : 1), 0) / aktif.length) * 100)
}
/** One routine's compliance (`:2211`). */
export const kepatuhanBaris = (r: { done?: number, total?: number }) => (r.total ? Math.round(((Number(r.done) || 0) / r.total) * 100) : 100)

// ─────────────────────────── Signers ──

/** The set a PR uses (`setPr`): its own `setId`, else the default. */
export function setPr(pr: BdPr | null | undefined, sets: BdApproverSet[]): BdApproverSet | undefined {
  return (pr && pr.setId && sets.find(x => x.id === pr.setId)) || sets.find(x => x.bawaan) || sets[0]
}
export interface Penyetuju { k: string, l: string, nama: string, pid: string }
/** `penyetujuPr` — signers of one PR, keyed by person id. */
export function penyetujuPr(pr: BdPr | null | undefined, sets: BdApproverSet[], people: BdPerson[]): Penyetuju[] {
  const set = setPr(pr, sets)
  return ((set && set.orang) || [])
    .map((pid) => {
      const p = people.find(x => x.id === pid)
      if (!p) return null
      return { k: p.id, l: jabatanOrang(p), nama: p.name || '—', pid: p.id }
    })
    .filter((x): x is Penyetuju => x !== null)
}
/** A person is allowed to approve if they are the signer OR a BD admin (browser-checked trace, not authorisation). */
export function bolehSetuju(pid: string, people: BdPerson[], meId: string | null, admin: boolean): boolean {
  if (admin) return true
  const p = people.find(x => x.id === pid)
  if (p && meId && p.officeUserId && String(p.officeUserId) === String(meId)) return true
  const aku = people.find(x => x.officeUserId === meId)
  return !!aku && aku.id === pid
}
/** `alasanTakBolehSetuju`. */
export function alasanTakBolehSetuju(pid: string, people: BdPerson[]): string {
  const p = people.find(x => x.id === pid)
  return p
    ? `Hanya ${p.name} atau admin BD yang bisa menekan ini.`
    : 'Orang ini belum terdaftar di User Database Office — mintakan akunnya dibuat dulu.'
}
/** `tuntaskanTaskProject` — closing a project closes its tasks, ONLY on the stage change. */
export const tasksPerluDitutup = (tasks: BdTask[], pid: string) => projTasks(tasks, pid).filter(t => !selesai(t))

/** `uid` — the old client's id shape (`t…`, `p…`, `pr…`). Settings documents are not server-generated. */
export const uidBd = (prefix: string) => prefix + Math.random().toString(36).slice(2, 9)

/** `bacaMilestone` — one per line, "name | YYYY-MM-DD"; done is matched by NAME. */
export function bacaMilestone(teks: string, lama?: { t: string, done?: boolean }[]): { t: string, date: string, done: boolean }[] {
  return String(teks || '').split('\n').map(b => b.trim()).filter(Boolean).map((b) => {
    const q = b.split('|')
    const nama = (q[0] || '').trim()
    const tgl = (q[1] || '').trim()
    const sebelum = (lama || []).find(m => m.t === nama)
    return { t: nama, date: /^\d{4}-\d{2}-\d{2}$/.test(tgl) ? tgl : '', done: sebelum ? !!sebelum.done : false }
  })
}
/** Milestones back to the textarea shape (`projModal`). */
export const tulisMilestone = (m?: { t: string, date?: string }[]) => (m || []).map(x => `${x.t} | ${x.date || ''}`).join('\n')

// ─────────────────────────── Task management (putaran keempat, 7 Okt 2026) ──
// The module is no longer just a BD board: per project there are tasks, each
// task may carry sub-tasks, and a task may wait on others (`dependsOn`). Both
// ride INSIDE the task row (`subtasks`, `dependsOn`) — the API stores the
// whole row as JSON in `data`, so no new field ever needs a SQL migration.

/** `subs` — a task's sub-tasks, always an array. */
export function subs(t: { subtasks?: BdSubtask[] | null } | null | undefined): BdSubtask[] {
  return t && Array.isArray(t.subtasks) ? t.subtasks : []
}
/** `subHitung` — `{n, d}` = total / done. */
export function subHitung(t: { subtasks?: BdSubtask[] | null } | null | undefined): { n: number, d: number } {
  const s = subs(t)
  return { n: s.length, d: s.filter(x => x && x.done).length }
}
/** `deps` — waited-on task ids, always an array. */
export function deps(t: { dependsOn?: string[] | null } | null | undefined): string[] {
  return t && Array.isArray(t.dependsOn) ? t.dependsOn : []
}

interface PunyaIdNamaStatus { id: string, name?: string, status?: string }

/** `penghalang` — waited-on tasks that are still not Done. A prerequisite
 * that was DELETED never blocks: a task locked by something nobody can open
 * again would stay locked forever. */
export function penghalang<T extends PunyaIdNamaStatus>(
  t: { id?: string, dependsOn?: string[] | null } | null | undefined,
  semua: T[],
): T[] {
  if (!t) return []
  return deps(t)
    .map(id => semua.find(x => x.id === id))
    .filter((x): x is T => !!x && x.id !== t.id && x.status !== 'Done')
}
/** `penunggu` — tasks waiting on one id. Deleting a task releases them. */
export function penunggu<T extends { id: string, dependsOn?: string[] | null }>(semua: T[], id: string): T[] {
  return semua.filter(t => deps(t).includes(id))
}
/**
 * `menungguTransitif` — whether task a waits on b directly or through a
 * chain. Refuses circles: A waiting on B waiting on A means neither can ever
 * be Done, and no screen could explain why.
 */
export function menungguTransitif(
  semua: { id: string, dependsOn?: string[] | null }[],
  aId: string,
  bId: string,
  seen?: Record<string, boolean>,
): boolean {
  const s = seen || {}
  if (s[aId]) return false
  s[aId] = true
  return deps(semua.find(x => x.id === aId)).some(d => d === bId || menungguTransitif(semua, d, bId, s))
}

/** Short name for guard messages (`namaPendek`). */
export const namaPendekTask = (t: { name?: string } | null | undefined) =>
  `"${String(t?.name || '').slice(0, 40)}"`

export interface HasilCekDone { boleh: boolean, nama: string[] }
/**
 * `cekBolehDone` — THE ONE guard on the road to Done, used by all three
 * paths (the row checkbox, Save in the form, dropping a card). Only Done is
 * held: starting (Doing) a waiting task stays allowed — preparation often
 * runs in parallel. Returns the blockers; callers toast them with
 * `pesanTunggu`.
 */
export function cekBolehDone<T extends PunyaIdNamaStatus>(
  t: { id?: string, name?: string, dependsOn?: string[] | null } | null | undefined,
  daftarDeps: string[] | null | undefined,
  semua: T[],
): HasilCekDone {
  const h = (daftarDeps ?? deps(t))
    .map(id => semua.find(x => x.id === id))
    .filter((x): x is T => !!x && x.id !== t?.id && x.status !== 'Done')
  return { boleh: !h.length, nama: h.map(x => namaPendekTask(x)) }
}
/** The refusal sentence for a held Done. */
export const pesanTunggu = (t: { name?: string } | null | undefined, nama: string[]) =>
  `${namaPendekTask(t)} belum bisa Done — selesaikan dulu: ${nama.join(', ')}`

/**
 * `segarkanProgress` — Done stamps `progress = 100` and `doneAt` (once: the
 * deadline stops counting — "waktunya berhenti"); reopening drops `doneAt`.
 * A task with sub-tasks is COUNTED from them, never typed; a sub-task-less
 * task left at 100 by hand falls back to 0.
 *
 * Entering Review stamps `reviewAt` (the "waiting for your review"
 * notification); leaving Review drops it, so re-entering notifies again.
 */
export function segarkanProgress(t: { status?: string, progress?: number, doneAt?: string, subtasks?: BdSubtask[] | null, reviewAt?: number }): void {
  if (t.status === 'Review') {
    if (!t.reviewAt) t.reviewAt = Date.now()
  }
  else if (t.reviewAt) delete t.reviewAt
  if (t.status === 'Done') {
    t.progress = 100
    if (!t.doneAt) t.doneAt = todayISO()
    return
  }
  delete t.doneAt
  const h = subHitung(t)
  if (h.n) t.progress = Math.round((h.d / h.n) * 100)
  else if (t.progress === 100) t.progress = 0
}

/**
 * `urutDeadline` — THE ONE task order: nearest deadline on top, dateless at
 * the bottom (a dateless task is not the most urgent), then the name so the
 * order never reshuffles between renders.
 */
export function urutDeadline(a: { deadline?: string, name?: string }, b: { deadline?: string, name?: string }): number {
  const da = a.deadline || '9999-99-99'
  const db = b.deadline || '9999-99-99'
  if (da !== db) return da < db ? -1 : 1
  return String(a.name || '').localeCompare(String(b.name || ''))
}

export type ModeArsip = 'aktif' | 'arsip' | 'semua'
/**
 * `saringArsip` — Done IS the archive marker, not a new field: two markers
 * for one state would drift (a task reopened from Done but still flagged
 * archive vanishes from the board).
 */
export function saringArsip<T extends { status?: string }>(list: T[], mode: ModeArsip): T[] {
  if (mode === 'arsip') return list.filter(t => t.status === 'Done')
  if (mode === 'semua') return list
  return list.filter(t => t.status !== 'Done')
}

export type SehatProject = 'done' | 'over' | 'on-track' | 'at-risk' | 'off-track'
/** `projSehat` — attention state of one project. */
export function sehatProject(p: { stage?: string, end?: string, health?: string }): { k: SehatProject } {
  if (p.stage === 'Done') return { k: 'done' }
  if (p.end && sisaHari(p.end) < 0) return { k: 'over' }
  const h = p.health
  return { k: h === 'off-track' || h === 'at-risk' ? h : 'on-track' }
}
/**
 * Projects most needing attention first: overdue, off/at-risk, nearest
 * deadline (`vProjects` kartu view).
 */
export function urutProjectPerhatian<T extends { stage?: string, end?: string, health?: string }>(daftar: T[]): T[] {
  const bobot: Record<SehatProject, number> = { 'over': 0, 'off-track': 1, 'at-risk': 2, 'on-track': 3, 'done': 4 }
  return daftar.slice().sort((a, b) => {
    const x = bobot[sehatProject(a).k]
    const y = bobot[sehatProject(b).k]
    if (x !== y) return x - y
    return (a.end || '9999') < (b.end || '9999') ? -1 : 1
  })
}
/**
 * `waktuTerpakai` — how much of the start→deadline span has passed. Read
 * against progress, it answers "on track or not".
 */
export function waktuTerpakai(p: { stage?: string, start?: string, end?: string }): string {
  if (p.stage === 'Done') return 'Selesai'
  if (p.start && p.end && p.end > p.start) {
    const tot = Math.round((+pDate(p.end) - +pDate(p.start)) / 86400000)
    if (tot <= 0) return '—'
    const jl = Math.round((+pDate(todayISO()) - +pDate(p.start)) / 86400000)
    return `${Math.max(0, Math.min(100, Math.round((jl / tot) * 100)))}%`
  }
  return '—'
}

// ─────────────────────────── Recurrence series (delta BD, Okt 2026) ──
// Pure companions to `langkahUlang`/`lahirkanUlang` for the Recurring page:
// series are read from the `ulangDari` chains already stored, never copied.

/** One recurrence series: the running head plus its Done ancestry. */
export interface Seri {
  head: BdTask
  rantai: BdTask[]
  pola: string
  aktif: boolean
  nSelesai: number
  terakhir: string
  terlewat: { d: string, sub: string }[]
}

/** `rantaiUlang` — the `ulangDari` ancestry, oldest first (old `rantaiUlang`). */
export function rantaiUlang(t: BdTask, semua: BdTask[]): BdTask[] {
  const l: BdTask[] = [t]
  const lihat = new Set<string>([t.id])
  let x: BdTask | undefined = t
  let aman = 0
  while (x?.ulangDari && aman++ < 500) {
    const atas = semua.find(y => y.id === x!.ulangDari)
    if (!atas || lihat.has(atas.id)) break
    lihat.add(atas.id)
    l.unshift(atas)
    x = atas
  }
  return l
}

/**
 * `seriUlang` — one entry per chain head (a task nobody continues). The head
 * pattern wins when still valid; a stopped head parks its pattern in
 * `ulangBerhenti.u`; otherwise the newest valid pattern down the chain is
 * shown (old `seriUlang`, minus the screen's visibility filter).
 */
export function seriUlang(semua: BdTask[]): Seri[] {
  const penerus = new Set<string>()
  semua.forEach((x) => {
    if (x.ulangDari) penerus.add(x.ulangDari)
  })
  const out: Seri[] = []
  semua.forEach((t) => {
    if (penerus.has(t.id)) return
    const r = rantaiUlang(t, semua)
    const asal = r.slice().reverse().find(x => x.ulang && labelUlang(x.ulang))
    const pola = (t.ulang && labelUlang(t.ulang)) ? t.ulang : (t.ulangBerhenti?.u || asal?.ulang || '')
    if (!pola) return
    const done = r.filter(selesai)
    const akhir = done.map(x => x.doneAt || '').filter(Boolean).sort().pop() || ''
    const lewat: { d: string, sub: string }[] = []
    r.forEach((x) => {
      if (Array.isArray(x.terlewat)) lewat.push(...x.terlewat)
    })
    out.push({ head: t, rantai: r, pola, aktif: !!(t.ulang && labelUlang(t.ulang)), nSelesai: done.length, terakhir: akhir, terlewat: lewat })
  })
  return out
}

/**
 * `gulirPatch` — the self-roll of ONE overdue occurrence as a patch (old
 * `gulirUlang` loop body). The stepping reimplements `deadlineBerikut`
 * against the injected `hariIni` so the result stays deterministic; ended
 * custom series (`d:` past the date, `x:` quota spent) roll nothing.
 */
export function gulirPatch(t: BdTask, hariIni: string): Partial<BdTask> | null {
  if (!t || !t.ulang || !labelUlang(t.ulang) || selesai(t) || !tglSah(t.deadline) || !(t.deadline < hariIni)) return null
  let nd = langkahUlang(t.deadline, t.ulang)
  let aman = 0
  while (nd < hariIni && aman++ < 400) nd = langkahUlang(nd, t.ulang)
  const geser = Math.round((+pDate(nd) - +pDate(t.deadline)) / 86400000)
  if (geser <= 0) return null
  const { rantai, terlewat } = hitungSeri(t, [t])
  if (seriBerakhir(t, nd, rantai, terlewat)) return null
  const ss = subs(t)
  const h = ss.filter(x => x && x.done).length
  const catat = [...(Array.isArray(t.terlewat) ? t.terlewat : []), { d: t.deadline, sub: ss.length ? `${h}/${ss.length}` : '' }]
  const patch: Partial<BdTask> = {
    deadline: nd,
    terlewat: catat.length > 52 ? catat.slice(-52) : catat,
    status: 'To Do',
    progress: 0,
    subtasks: ss.map(x => ({ ...x, done: false, ...(tglSah(x.d) ? { d: tambahHari(x.d as string, geser) } : {}) })),
  }
  if (tglSah(t.start)) patch.start = tambahHari(t.start as string, geser)
  return patch
}

/** `tempatLabel` — where a task lives: Daily Task, its project id, or "—". */
export function tempatLabel(t: { daily?: boolean, project?: string | null }): string {
  if (t.daily) return 'Daily Task'
  return t.project || '—'
}
