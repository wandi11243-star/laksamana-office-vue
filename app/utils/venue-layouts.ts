// Denah venue Laksamana Muda — the single source of the table plan, shared by
// Reservasi (day-of map, seat picking, lock rules) and Marketing (VIP booking,
// which locks tables across modules).
//
// This used to live inside deploy/reservasi/index.html, and when Marketing
// needed the same drawing the only other option was to COPY it — two copies of
// the same coordinates drift apart, a table moved in one module stays put in the
// other, and the crew argues about which one is right. So it became
// deploy/assets/venue-layouts.js, and here it is as plain data.
//
// Coordinates use a fixed 1600 x 1160 canvas; the renderer turns them into
// percentages, so the plan follows any width without distorting.
//
// Pure: no Vue, no API, no state of its own. Every function that needs the
// saved overrides takes them as an argument (`MasterDenah`), because Marketing
// holds the same master blob under its own record.

/** The fixed canvas the coordinates are written against. */
export const SEAT_W = 1600
export const SEAT_H = 1160

export type ZonaMeja = 'green' | 'blue' | 'wood' | 'vip' | 'ext' | 'dark' | 'diamond'

export const ZONA_MEJA: ZonaMeja[] = ['green', 'blue', 'wood', 'vip', 'ext', 'dark', 'diamond']

/** The label the Editor Denah shows per zone (`deploy/reservasi/index.html:6194`). */
export const LABEL_ZONA: Record<ZonaMeja, string> = {
  green: 'Hijau (bulat)',
  blue: 'Biru',
  wood: 'Kayu',
  vip: 'VIP',
  dark: 'Gelap',
  diamond: 'Diamond',
  ext: 'Extension',
}

export interface MejaDenah {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Free text: "4", "4-5", "10-12". The LARGEST number in it is what fits. */
  cap: string
  zone: ZonaMeja
}

export interface FixDenah {
  /** 'stage' | 'entrance' | 'dj' | 'tangga' | 'foh' | 'floor2' — a label block, not a table. */
  t: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutDenah {
  name: string
  fixed?: FixDenah[]
  tables: MejaDenah[]
  /**
   * Who touched this plan last, and when (`:6123-6126`). It lives ON the plan
   * object, not inferred from the audit: audit is trimmed to 500 rows, so an
   * old edit is exactly the one that has lost its trace. The names start with
   * `_` because they are not part of the plan — the renderer only reads
   * `tables` & `fixed`.
   */
  _editBy?: string
  _editAt?: number
}

/** The four master sections the plan lives in. */
export interface MasterDenah {
  layouts?: Record<string, LayoutDenah>
  /** { "YYYY-MM-DD": "<layoutKey>" } for Lantai 1 */
  layoutOverrides?: Record<string, string>
  /** ...and for Lantai 2, kept apart so old Lantai 1 data needs no migration. */
  layoutOverrides2?: Record<string, string>
  /** { "tgl:<date>:<lt>": <whole plan> } — a plan stored for ONE date. */
  layoutTanggal?: Record<string, LayoutDenah>
}

const row = (ids: (number | string)[], x0: number, y: number, w: number, h: number, gap: number, cap: string, zone: ZonaMeja): MejaDenah[] =>
  ids.map((id, i) => ({ id: String(id), x: x0 + i * (w + gap), y, w, h, cap, zone }))

const col = (ids: (number | string)[], x: number, y0: number, w: number, h: number, gap: number, cap: string, zone: ZonaMeja): MejaDenah[] =>
  ids.map((id, i) => ({ id: String(id), x, y: y0 + i * (h + gap), w, h, cap, zone }))

const seq = (pre: string, a: number, b: number): string[] => {
  const out: string[] = []
  for (let i = a; i <= b; i++) out.push(pre + i)
  return out
}

// Source: laksamana-office/deploy/assets/venue-layouts.js:26-144 (ported as is).
const uBlock: MejaDenah[] = [
  { id: 'U1', x: 190, y: 20, w: 180, h: 150, cap: '7', zone: 'dark' },
  { id: 'U2', x: 190, y: 185, w: 180, h: 165, cap: '8', zone: 'dark' },
  { id: 'U3', x: 190, y: 365, w: 180, h: 160, cap: '9', zone: 'dark' },
]

const vip: MejaDenah[] = [
  { id: 'VIP 4', x: 1480, y: 20, w: 110, h: 112, cap: '6', zone: 'vip' },
  { id: 'VIP 3', x: 1480, y: 150, w: 110, h: 112, cap: '6', zone: 'vip' },
  { id: 'VIP 2', x: 1480, y: 280, w: 110, h: 112, cap: '6', zone: 'vip' },
  { id: 'VIP 1', x: 1480, y: 410, w: 110, h: 112, cap: '6', zone: 'vip' },
]

/** The four plans the venue ships with. */
export const VENUE_LAYOUTS: Record<string, LayoutDenah> = {
  weekday: {
    name: 'Weekday',
    fixed: [
      { t: 'stage', label: 'STAGE', x: 630, y: 10, w: 380, h: 210 },
      { t: 'entrance', label: 'ENTRANCE IN / OUT', x: 18, y: 470, w: 44, h: 180 },
    ],
    tables: [
      ...uBlock,
      ...row([21, 22], 395, 25, 80, 80, 25, '4', 'green'),
      ...row([23, 24], 395, 150, 80, 80, 25, '4', 'green'),
      { id: '41', x: 1180, y: 150, w: 85, h: 85, cap: '4', zone: 'green' },
      { id: '42', x: 1345, y: 55, w: 90, h: 90, cap: '4', zone: 'diamond' },
      { id: '43', x: 1345, y: 185, w: 90, h: 90, cap: '4', zone: 'diamond' },
      { id: '44', x: 1345, y: 315, w: 90, h: 90, cap: '4', zone: 'diamond' },
      { id: '45', x: 1345, y: 445, w: 90, h: 90, cap: '4', zone: 'diamond' },
      ...vip,
      ...row([31, 32, 33, 34, 35], 470, 360, 110, 155, 30, '7', 'wood'),
      { id: 'R1', x: 300, y: 625, w: 200, h: 85, cap: '10-12', zone: 'wood' },
      { id: 'R2', x: 545, y: 628, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: 'R3', x: 675, y: 625, w: 200, h: 85, cap: '10-12', zone: 'wood' },
      { id: 'R4', x: 920, y: 628, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: 'R5', x: 1050, y: 625, w: 200, h: 85, cap: '10-12', zone: 'wood' },
      { id: 'R6', x: 1295, y: 628, w: 80, h: 80, cap: '4', zone: 'green' },
      ...row([11, 12, 13, 14, 15, 16, 17, 18, 19], 120, 815, 130, 80, 25, '4-5', 'blue'),
      ...row([1, 2, 3, 4, 5, 6, 7, 8, 9], 120, 985, 130, 80, 25, '4-5', 'blue'),
    ],
  },
  weekend: {
    name: 'Weekend',
    fixed: [
      { t: 'stage', label: 'STAGE', x: 590, y: 10, w: 380, h: 200 },
      { t: 'dj', label: 'MEJA DJ', x: 775, y: 250, w: 150, h: 70 },
      { t: 'entrance', label: 'ENTRANCE IN / OUT', x: 18, y: 470, w: 44, h: 180 },
    ],
    tables: [
      ...uBlock,
      { id: 'EXT 1', x: 390, y: 25, w: 75, h: 95, cap: '4', zone: 'ext' },
      { id: 'EXT 2', x: 500, y: 25, w: 75, h: 95, cap: '4', zone: 'ext' },
      { id: 'EXT 3', x: 390, y: 140, w: 75, h: 95, cap: '4', zone: 'ext' },
      { id: 'EXT 4', x: 500, y: 140, w: 75, h: 95, cap: '4', zone: 'ext' },
      { id: 'EXT 5', x: 390, y: 250, w: 75, h: 58, cap: '4', zone: 'ext' },
      { id: 'EXT 6', x: 120, y: 180, w: 70, h: 90, cap: '4', zone: 'ext' },
      { id: 'EXT 7', x: 120, y: 290, w: 70, h: 90, cap: '4', zone: 'ext' },
      { id: 'EXT 8', x: 120, y: 400, w: 70, h: 90, cap: '4', zone: 'ext' },
      { id: 'EXT 9', x: 230, y: 532, w: 110, h: 55, cap: '4', zone: 'ext' },
      { id: 'EXT 10', x: 80, y: 760, w: 70, h: 110, cap: '4', zone: 'ext' },
      { id: 'EXT 11', x: 80, y: 960, w: 70, h: 110, cap: '4', zone: 'ext' },
      { id: 'EXT 14', x: 1300, y: 30, w: 75, h: 110, cap: '4', zone: 'ext' },
      { id: 'EXT 15', x: 1400, y: 30, w: 75, h: 110, cap: '4', zone: 'ext' },
      { id: '31', x: 470, y: 250, w: 110, h: 150, cap: '7', zone: 'wood' },
      { id: '32', x: 470, y: 420, w: 110, h: 150, cap: '7', zone: 'wood' },
      { id: '33', x: 1120, y: 250, w: 110, h: 150, cap: '7', zone: 'wood' },
      { id: '34', x: 1120, y: 420, w: 110, h: 150, cap: '7', zone: 'wood' },
      { id: '22', x: 625, y: 290, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: '21', x: 625, y: 430, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: '24', x: 1000, y: 290, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: '23', x: 1000, y: 430, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: '42', x: 1290, y: 205, w: 70, h: 70, cap: '4', zone: 'wood' },
      { id: '43', x: 1365, y: 205, w: 70, h: 70, cap: '4', zone: 'wood' },
      { id: '44', x: 1345, y: 340, w: 90, h: 90, cap: '4', zone: 'diamond' },
      { id: '45', x: 1345, y: 465, w: 90, h: 90, cap: '4', zone: 'diamond' },
      ...vip,
      { id: 'R1', x: 300, y: 690, w: 200, h: 85, cap: '10-12', zone: 'wood' },
      { id: 'R2', x: 545, y: 693, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: 'R3', x: 675, y: 690, w: 200, h: 85, cap: '10-12', zone: 'wood' },
      { id: 'R5', x: 920, y: 690, w: 200, h: 85, cap: '10-12', zone: 'wood' },
      { id: 'R4', x: 1160, y: 693, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: 'R6', x: 1270, y: 693, w: 80, h: 80, cap: '4', zone: 'green' },
      { id: '41', x: 1380, y: 693, w: 80, h: 80, cap: '4', zone: 'green' },
      ...row([11, 12, 13, 14, 15, 16, 17, 18, 19], 170, 865, 128, 78, 22, '4-5', 'blue'),
      ...row([1, 2, 3, 4, 5, 6, 7, 8, 9], 170, 1005, 128, 78, 22, '4-5', 'blue'),
    ],
  },
  lantai2: {
    name: 'Lantai 2 (Weekday)',
    fixed: [
      { t: 'stage', label: 'VIDEOTRON', x: 340, y: 35, w: 820, h: 70 },
      { t: 'floor2', label: 'LAYOUT LANTAI 2', x: 340, y: 120, w: 820, h: 475 },
      { t: 'tangga', label: 'TANGGA MASUK', x: 25, y: 600, w: 120, h: 78 },
      { t: 'tangga', label: 'TANGGA KELUAR', x: 1455, y: 600, w: 120, h: 78 },
      { t: 'foh', label: 'FOH', x: 560, y: 895, w: 180, h: 150 },
    ],
    tables: [
      ...col([51, 52, 53, 54, 55], 25, 40, 95, 90, 22, '4', 'vip'),
      ...col(seq('M', 1, 10), 175, 40, 125, 46, 12, '2', 'blue'),
      ...col(seq('M', 31, 40), 1175, 40, 125, 46, 12, '2', 'blue'),
      ...col([71, 72, 73, 74, 75], 1430, 40, 95, 90, 22, '4', 'vip'),
      ...row(seq('M', 11, 27), 175, 680, 68, 70, 9, '2', 'blue'),
      { id: '61', x: 30, y: 780, w: 120, h: 85, cap: '4', zone: 'blue' },
      { id: '87', x: 1345, y: 800, w: 70, h: 70, cap: '2', zone: 'blue' },
      { id: '62', x: 30, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '63', x: 30, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '64', x: 150, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '65', x: 150, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '66', x: 270, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '67', x: 270, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '68', x: 390, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '69', x: 390, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      ...row([81, 82, 83, 84, 85, 86], 770, 910, 120, 100, 15, '4', 'diamond'),
    ],
  },
  // Source: laksamana-office/deploy/assets/venue-layouts.js:134-141. Lantai 2 has
  // two built-in plans like Lantai 1, and its weekend one starts IDENTICAL to the
  // weekday one on purpose: inventing an end-of-week arrangement nobody ever
  // installed would only produce a wrong plan that looks official. The crew
  // moves the tables themselves in the Editor, and from then on the two live
  // apart.
  lantai2_weekend: {
    name: 'Lantai 2 (Weekend)',
    fixed: [
      { t: 'stage', label: 'VIDEOTRON', x: 340, y: 35, w: 820, h: 70 },
      { t: 'floor2', label: 'LAYOUT LANTAI 2', x: 340, y: 120, w: 820, h: 475 },
      { t: 'tangga', label: 'TANGGA MASUK', x: 25, y: 600, w: 120, h: 78 },
      { t: 'tangga', label: 'TANGGA KELUAR', x: 1455, y: 600, w: 120, h: 78 },
      { t: 'foh', label: 'FOH', x: 560, y: 895, w: 180, h: 150 },
    ],
    tables: [
      ...col([51, 52, 53, 54, 55], 25, 40, 95, 90, 22, '4', 'vip'),
      ...col(seq('M', 1, 10), 175, 40, 125, 46, 12, '2', 'blue'),
      ...col(seq('M', 31, 40), 1175, 40, 125, 46, 12, '2', 'blue'),
      ...col([71, 72, 73, 74, 75], 1430, 40, 95, 90, 22, '4', 'vip'),
      ...row(seq('M', 11, 27), 175, 680, 68, 70, 9, '2', 'blue'),
      { id: '61', x: 30, y: 780, w: 120, h: 85, cap: '4', zone: 'blue' },
      { id: '87', x: 1345, y: 800, w: 70, h: 70, cap: '2', zone: 'blue' },
      { id: '62', x: 30, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '63', x: 30, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '64', x: 150, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '65', x: 150, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '66', x: 270, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '67', x: 270, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '68', x: 390, y: 895, w: 100, h: 70, cap: '4', zone: 'blue' },
      { id: '69', x: 390, y: 975, w: 100, h: 70, cap: '4', zone: 'blue' },
      ...row([81, 82, 83, 84, 85, 86], 770, 910, 120, 100, 15, '4', 'diamond'),
    ],
  },
}

export const BUILTIN_LAYOUT_KEYS = ['weekday', 'weekend', 'lantai2', 'lantai2_weekend']

/** The short label the layout switcher used (`:1234`). */
export const LAYOUT_LABEL: Record<string, string> = {
  weekday: 'Weekday, Lt.1',
  weekend: 'Weekend, Lt.1',
  lantai2: 'Weekday, Lt.2',
  lantai2_weekend: 'Weekend, Lt.2',
}

/** Lantai 1 and Lantai 2 run the same engine: two built-in plans + a per-date schedule + custom templates. Only the storage key and the built-ins differ. */
export const LT_CFG: Record<1 | 2, { ovKey: keyof MasterDenah, wd: string, we: string, nama: string }> = {
  1: { ovKey: 'layoutOverrides', wd: 'weekday', we: 'weekend', nama: 'Lantai 1' },
  2: { ovKey: 'layoutOverrides2', wd: 'lantai2', we: 'lantai2_weekend', nama: 'Lantai 2' },
}

export const ltCfg = (lt: number) => LT_CFG[(lt === 2 ? 2 : 1)]

// --- reading the master -----------------------------------------------------
// An empty object comes back from the API as `[]`, not `{}` — and `[]['date']`
// silently returns undefined, so an override written onto an array is dropped by
// JSON.stringify and the schedule vanishes. Every reader below treats an array
// as empty (`:1262-1266`).

/** `master.layouts`, the edited built-ins and custom templates. */
export function customLayouts(master?: MasterDenah): Record<string, LayoutDenah> {
  const l = master?.layouts
  return l && !Array.isArray(l) ? l : {}
}

/** `master.layoutTanggal`, keyed "tgl:<date>:<lt>". */
export function layoutTanggal(master?: MasterDenah): Record<string, LayoutDenah> {
  const l = master?.layoutTanggal
  return l && !Array.isArray(l) ? l : {}
}

/** The per-date schedule of one floor: { date: layoutKey }. */
export function ovLantai(master: MasterDenah | undefined, lt: number): Record<string, string> {
  const o = master?.[ltCfg(lt).ovKey]
  return o && !Array.isArray(o) ? o as Record<string, string> : {}
}

/** The synthetic key of a plan stored for one date (`:1208`). Marketing builds the same string. */
export const keyTanggal = (date: string, lt: number) => `tgl:${date}:${lt === 2 ? 2 : 1}`

/** `{date, lt}` when the key is a date key, null when it is not. The pattern is checked, not just the prefix: a template with an odd name must not slip through as a "date" and then be looked for in the wrong place (`:1211-1215`). */
export function parseKeyTanggal(key: string): { date: string, lt: 1 | 2 } | null {
  const m = /^tgl:(\d{4}-\d{2}-\d{2}):([12])$/.exec(String(key ?? ''))
  return m ? { date: m[1]!, lt: Number(m[2]) as 1 | 2 } : null
}

export const adaDenahTanggal = (master: MasterDenah | undefined, date: string, lt: number) =>
  !!layoutTanggal(master)[keyTanggal(date, lt)]

/** The plan in force for a key: date plan > edited/custom template > built-in. */
export function getLayout(master: MasterDenah | undefined, key: string): LayoutDenah | null {
  if (parseKeyTanggal(key)) return layoutTanggal(master)[key] ?? null
  return customLayouts(master)[key] ?? VENUE_LAYOUTS[key] ?? null
}

export function layoutName(master: MasterDenah | undefined, key: string): string {
  const l = getLayout(master, key)
  if (l?.name) return l.name
  const p = parseKeyTanggal(key)
  return p ? `Denah ${p.date} · Lt.${p.lt}` : key
}

export const isBuiltinLayout = (key: string) => BUILTIN_LAYOUT_KEYS.includes(key)

/** Every template available: built-in plus custom, in that order. */
export function allLayoutKeys(master?: MasterDenah): string[] {
  const keys = [...BUILTIN_LAYOUT_KEYS]
  for (const k of Object.keys(customLayouts(master))) if (!keys.includes(k)) keys.push(k)
  return keys
}

/** Which floor a template belongs to (`:1809-1821`).
 *
 * A date plan carries its floor inside its own key and is checked first: its
 * NAME ("Denah 5 Agu · Lt.2") must not be the only source, because a name can
 * be retyped by hand and a key cannot. A custom template has no key of its own,
 * so its floor is guessed from the name — "Lantai 2", "Lt 2", "Floor 2". Not
 * named means Lantai 1: the likely case, and one that hides no table from any
 * filter.
 */
export function lantaiLayout(master: MasterDenah | undefined, key: string): 1 | 2 {
  const p = parseKeyTanggal(key)
  if (p) return p.lt
  if (key === 'weekday' || key === 'weekend') return 1
  if (key === 'lantai2' || key === 'lantai2_weekend') return 2
  const m = layoutName(master, key).toLowerCase().match(/(?:lantai|lt\.?|floor)\s*(\d+)/)
  return m ? (Number(m[1]) === 2 ? 2 : 1) : 1
}

/** table id -> floor. 0 = the table appears on TWO floors, so its floor cannot be pinned down; better to admit it than guess wrong (`:1834-1843`). */
export function lantaiMap(master?: MasterDenah): Map<string, 0 | 1 | 2> {
  const m = new Map<string, 0 | 1 | 2>()
  for (const k of allLayoutKeys(master)) {
    const lt = lantaiLayout(master, k)
    for (const t of getLayout(master, k)?.tables ?? []) {
      const id = String(t.id)
      if (!m.has(id)) m.set(id, lt)
      else if (m.get(id) !== lt) m.set(id, 0)
    }
  }
  return m
}

// --- which plan applies on a date ------------------------------------------

/** JUMAT, SABTU, MINGGU count as weekend (`:1282-1285`). Friday was added on 21 July 2026: Friday night is already busy and the plan is set up like an end of week. This is only the DEFAULT; a date can still be overridden, and an already-overridden date never changes because of it. */
export const hariAkhirPekan = (date: string) => {
  const dg = new Date(`${date}T00:00:00`).getDay()
  return dg === 0 || dg === 5 || dg === 6
}

/** The built-in plan of a floor on a date, before any schedule. */
export function defaultDayTypeLt(date: string, lt: number): string {
  const c = ltCfg(lt)
  return hariAkhirPekan(date) ? c.we : c.wd
}

export const defaultDayType = (date: string) => defaultDayTypeLt(date, 1)

/** The plan in force: a plan stored for that date wins over everything, then the date's schedule, then the built-in of the day. The ONLY function allowed to answer "which plan applies" (`:1289-1297`). */
export function dayTypeLayoutLt(master: MasterDenah | undefined, date: string, lt: number): string {
  const kt = keyTanggal(date, lt)
  if (layoutTanggal(master)[kt]) return kt
  const ov = ovLantai(master, lt)[date]
  return (ov && getLayout(master, ov)) ? ov : defaultDayTypeLt(date, lt)
}

export const dayTypeLayout = (master: MasterDenah | undefined, date: string) => dayTypeLayoutLt(master, date, 1)
export const dayTypeLayout2 = (master: MasterDenah | undefined, date: string) => dayTypeLayoutLt(master, date, 2)

/** "This date does not use its built-in plan" — either another template is scheduled, or its tables were moved for that date. Both deserve a flag, because the consequence for the crew is the same (`:1300-1304`). */
export function hasOverrideLt(master: MasterDenah | undefined, date: string, lt: number): boolean {
  if (adaDenahTanggal(master, date, lt)) return true
  const ov = ovLantai(master, lt)[date]
  return !!(ov && getLayout(master, ov))
}

export const hasLayoutOverride = (master: MasterDenah | undefined, date: string) => hasOverrideLt(master, date, 1)

// --- capacity ---------------------------------------------------------------

/** The LARGEST number in a capacity label ("4", "4-5", "10-12" -> 4/5/12). */
export function capMax(cap: unknown): number {
  const nums = String(cap ?? '').match(/\d+/g)
  return nums?.length ? Math.max(...nums.map(Number)) : 0
}

export function capMin(cap: unknown): number {
  const nums = String(cap ?? '').match(/\d+/g)
  return nums?.length ? Math.min(...nums.map(Number)) : 0
}

/** Total capacity of one plan — the Editor shows it, because changing one table's number means nothing if the effect on the whole is invisible. */
export const kapasitasLayout = (data?: LayoutDenah) =>
  (data?.tables ?? []).reduce((a, t) => a + capMax(t.cap), 0)

/**
 * Seating capacity on a date (`:5858-5871`): Lantai 1's plan plus Lantai 2's.
 * Weekday and Weekend share many table numbers, but only ONE of them applies per
 * date, so nothing is counted twice. A duplicate id INSIDE one plan is bad data
 * and is skipped rather than counted twice.
 */
export function kapasitasTanggal(master: MasterDenah | undefined, date: string): { pax: number, meja: number } {
  let pax = 0
  let meja = 0
  for (const k of [dayTypeLayout(master, date), dayTypeLayout2(master, date)]) {
    const seen = new Set<string>()
    for (const t of getLayout(master, k)?.tables ?? []) {
      const id = String(t.id)
      if (seen.has(id)) continue
      seen.add(id)
      pax += capMax(t.cap)
      meja++
    }
  }
  return { pax, meja }
}

/** The table object behind an id, searched across every template (`:1757-1760`). */
export function cariMeja(master: MasterDenah | undefined, id: string): { t: MejaDenah, key: string } | null {
  for (const k of allLayoutKeys(master)) {
    const t = getLayout(master, k)?.tables.find(x => String(x.id) === String(id))
    if (t) return { t, key: k }
  }
  return null
}
