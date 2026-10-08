// Marketing › Task Divisi + Template Task (issue #62): pure rules.
// No API, no Vue. Tested by tools/uji-marketing-tugas.mjs.
//
// Source: laksamana-office deploy/marketing/index.html
//   getCats :5241 · getFbFormats :5254 · fbSubs / subsOf / subDivTemplates :5272-5276
//   extraJobs / eventDivTemplates / eventCats / eventSubs :5278-5310
//   jobMeta / jobField / jobProg / divProgress / subProgress / eventItemCount :5359-5391
//   handoverEvents / taskEventList / taskBoard / freeBoard :12446-12695
//   tmplCard / kategoriLama / reorderSub :12728-12900 · pindahKategoriLama :12905
//   saveFbFormat / renameFbFormat / salinKategori / delFbFormat :12944-13075
//   newSubCat / renameSubCat / delSubCat :13077-13137 · saveTemplateTask :13160
//   remindWA :18871 · waLink :5051 · staffList / staffHp :18860-18867
import type { EventMkt, UserMkt } from '~/utils/marketing'
import { DIVISI_MKT } from '~/utils/marketing'

// ---------------------------------------------------------------- shapes

/** One standard to-do (a `taskTemplates` row). `div` = the category it belongs to. */
export interface TemplateTugasMkt {
  id: string
  div: string
  sub?: string
  task?: string
  pic?: string
  hminus?: number | null
  deadline?: string
  note?: string
  updatedAt?: number
}

/** A sub category (the flat `fbSubs` array, :5259-5270): {id, div, nama}. */
export interface SubKatMkt { id: string, div: string, nama: string }

/** An ad-hoc item owned by one event (`extraJobs[div][]`). */
export interface JobTambahanMkt {
  id: string
  div: string
  sub?: string
  task?: string
  pic?: string
  hminus?: number | null
  deadline?: string
  note?: string
  extra: true
}

/** The board reads both the same way. */
export type ItemTugasMkt = (TemplateTugasMkt & { extra?: false }) | JobTambahanMkt

/** Per-event store of the board (top-level fields of the event row). */
export interface PapanEventMkt {
  jobProgress?: Record<string, Record<string, number>>
  jobMeta?: Record<string, Record<string, Record<string, string>>>
  extraJobs?: Record<string, JobTambahanMkt[]>
}

/** Free tasks live under this key when the event has no F&B format (:5327). */
export const DIV_BEBAS_MKT = '_bebas'

const obj = <T>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, T> : {})
const papan = (e: EventMkt) => e as EventMkt & PapanEventMkt
/** A copy of o without key k (no dynamic delete). */
const tanpa = <T>(o: Record<string, T>, k: string): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([x]) => x !== k))

// ---------------------------------------------------------------- categories

const namaKat = (x: unknown) => (typeof x === 'string' ? x : String(obj<string>(x).nama ?? obj<string>(x).name ?? ''))

/**
 * Organisation divisions (getCats, :5241). An EMPTY list counts as unset —
 * the old normalizeState wrote [] on every load, so `!length` is required.
 * v1 returns only object rows, so string categories arrive empty and the
 * fallback (divisions + taskCategories) is what both apps actually show.
 */
export function kategoriOrgMkt(categories: unknown[], taskCategories: unknown[]): string[] {
  const dari = categories.map(namaKat).filter(Boolean)
  if (dari.length) return dari
  return [...DIVISI_MKT, ...taskCategories.map(namaKat).filter(Boolean)]
}

export const subsDariMkt = (subs: SubKatMkt[], div: string) => subs.filter(x => x && x.div === div)
export const templateDivMkt = (tpl: TemplateTugasMkt[], div: string) => tpl.filter(t => t.div === div)
export const templateSubMkt = (tpl: TemplateTugasMkt[], div: string, sub: string) => tpl.filter(t => t.div === div && (t.sub || '') === (sub || ''))

/** Old division categories that still hold templates or subs, waiting to be moved (:12863). */
export const kategoriLamaMkt = (org: string[], tpl: TemplateTugasMkt[], subs: SubKatMkt[]) =>
  org.filter(d => templateDivMkt(tpl, d).length || subsDariMkt(subs, d).length)

/** Category names: quotes/backslash stripped, trimmed (saveFbFormat, :12945). */
export const bersihNamaMkt = (s: string) => String(s ?? '').replace(/['"\\]/g, '').trim()

/**
 * A new or renamed F&B category must not collide with any format, any
 * division, or 'Lainnya' (the event form's free-text marker), case-insensitive.
 */
export function cekNamaKategoriMkt(nama: string, fbFormats: string[], org: string[], kecuali = ''): { judul: string, isi: string } | null {
  if (!nama) return { judul: 'Nama wajib', isi: 'Isi nama kategori dulu.' }
  const n = nama.toLowerCase()
  if ([...fbFormats, ...org, 'Lainnya'].some(c => String(c).toLowerCase() === n && c !== kecuali)) return { judul: 'Sudah ada', isi: 'Nama itu sudah dipakai.' }
  return null
}

// ---------------------------------------------------------------- per-event board

export const jobTambahanMkt = (e: EventMkt, div: string): JobTambahanMkt[] => {
  const xs = obj<JobTambahanMkt[]>(papan(e).extraJobs)[div]
  return Array.isArray(xs) ? xs : []
}

/** The event's to-do = the category's templates + its own extra items (:5300). */
export const itemEventMkt = (e: EventMkt, div: string, tpl: TemplateTugasMkt[]): ItemTugasMkt[] =>
  [...templateDivMkt(tpl, div), ...jobTambahanMkt(e, div)]

/** 0–100, clamped and rounded; missing = 0 (jobProg, :5390). */
export function jobProgMkt(e: EventMkt, div: string, id: string): number {
  const v = +(obj<Record<string, number>>(papan(e).jobProgress)[div]?.[id] ?? 0) || 0
  return Math.max(0, Math.min(100, Math.round(v)))
}
export const jobSelesaiMkt = (e: EventMkt, div: string, id: string) => jobProgMkt(e, div, id) >= 100

/** Per-event PIC/deadline/note override the template's (jobField, :5362). */
export function jobFieldMkt(e: EventMkt, div: string, item: ItemTugasMkt, field: 'pic' | 'deadline' | 'note'): string {
  if (item.extra) return String(item[field] ?? '')
  const o = obj<Record<string, string>>(obj<Record<string, Record<string, string>>>(papan(e).jobMeta)[div])[item.id] ?? {}
  return o[field] !== undefined && o[field] !== '' ? String(o[field]) : String(item[field] ?? '')
}

export function progresDivMkt(e: EventMkt, div: string, tpl: TemplateTugasMkt[]): number {
  const items = itemEventMkt(e, div, tpl)
  if (!items.length) return 0
  return Math.round(items.reduce((a, t) => a + jobProgMkt(e, div, t.id), 0) / items.length)
}
export function progresSubMkt(e: EventMkt, div: string, sub: string, tpl: TemplateTugasMkt[]): number {
  const items = itemEventMkt(e, div, tpl).filter(t => (t.sub || '') === (sub || ''))
  if (!items.length) return 0
  return Math.round(items.reduce((a, t) => a + jobProgMkt(e, div, t.id), 0) / items.length)
}

/** Total / done / % for one event — the card and the board header share it (:5383). */
export function hitungItemMkt(e: EventMkt, kat: string[], tpl: TemplateTugasMkt[]) {
  let total = 0
  let selesai = 0
  for (const div of kat) {
    for (const t of itemEventMkt(e, div, tpl)) {
      total++
      if (jobSelesaiMkt(e, div, t.id)) selesai++
    }
  }
  return { total, selesai, pct: total ? Math.round((selesai / total) * 100) : 0 }
}

const hariKe = (t: string) => Math.floor(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86400000)

/** Confirmed/Deal/Event Done from H+2 back, soonest first (handoverEvents, :12446). */
export const eventHandoverMkt = (events: EventMkt[], hari: string) => events
  .filter(e => ['Confirmed', 'Deal', 'Event Done'].includes(e.status) && !!e.tanggal && hariKe(e.tanggal) - hariKe(hari) >= -2)
  .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))

/** Sub categories that are fully done, of those the card counts (taskEventList, :12471). */
export function subSiapMkt(e: EventMkt, kat: string, namaSub: string[], tpl: TemplateTugasMkt[]): number {
  return kat ? namaSub.filter(n => progresSubMkt(e, kat, n, tpl) >= 100).length : 0
}

/**
 * Board order (taskBoard, :12633-12641): '' first, then the category's subs
 * in their saved order, then any sub no longer listed (kept, never dropped);
 * within a group template items before extra items, otherwise stable.
 */
export function urutPapanMkt(items: ItemTugasMkt[], subs: SubKatMkt[]): { sub: string, items: ItemTugasMkt[] }[] {
  const urut = ['']
  for (const d of new Set(items.map(t => t.div))) {
    for (const sc of subsDariMkt(subs, d)) if (!urut.includes(sc.nama)) urut.push(sc.nama)
  }
  for (const t of items) if (!urut.includes(t.sub || '')) urut.push(t.sub || '')
  return urut
    .map(sub => ({ sub, items: [...items.filter(t => !t.extra && (t.sub || '') === sub), ...items.filter(t => t.extra && (t.sub || '') === sub)] }))
    .filter(g => g.items.length)
}

/** Free board groups in first-seen order (freeBoard, :12547). */
export function urutBebasMkt(items: JobTambahanMkt[]): { sub: string, items: JobTambahanMkt[] }[] {
  const urut: string[] = []
  for (const j of items) if (!urut.includes(j.sub || '')) urut.push(j.sub || '')
  return urut.map(sub => ({ sub, items: items.filter(j => (j.sub || '') === sub) }))
}

// ---- board writes: each returns the top-level fields to PATCH on the event

/** Done = 100, not done = 0 — one number is the truth (toggleJobSelesai, :5376). */
export function toggleSelesaiMkt(e: EventMkt, div: string, id: string): Pick<PapanEventMkt, 'jobProgress'> {
  const jp = { ...obj<Record<string, number>>(papan(e).jobProgress) }
  jp[div] = { ...obj<number>(jp[div]), [id]: jobSelesaiMkt(e, div, id) ? 0 : 100 }
  return { jobProgress: jp }
}

export function setJobMetaMkt(e: EventMkt, div: string, id: string, field: 'pic' | 'deadline' | 'note', nilai: string): Pick<PapanEventMkt, 'jobMeta'> {
  const jm = { ...obj<Record<string, Record<string, string>>>(papan(e).jobMeta) }
  const d = { ...obj<Record<string, string>>(jm[div]) }
  d[id] = { ...obj<string>(d[id]), [field]: nilai }
  jm[div] = d
  return { jobMeta: jm }
}

/** H- from an input: '' → null, else a whole number ≥ 0 (setExtraJob, :5340). */
export const hminusDariMkt = (v: string | number | null | undefined) => (v === '' || v === null || v === undefined ? null : Math.max(0, Math.round(+v || 0)))

export function tambahJobMkt(e: EventMkt, div: string, sub: string, id: string): Pick<PapanEventMkt, 'extraJobs'> {
  const xj = { ...obj<JobTambahanMkt[]>(papan(e).extraJobs) }
  xj[div] = [...jobTambahanMkt(e, div), { id, div, sub: sub || '', task: '', pic: '', hminus: null, deadline: '', note: '', extra: true }]
  return { extraJobs: xj }
}

export function setJobTambahanMkt(e: EventMkt, div: string, id: string, field: 'task' | 'pic' | 'deadline' | 'note' | 'hminus', nilai: string): Pick<PapanEventMkt, 'extraJobs'> {
  const xj = { ...obj<JobTambahanMkt[]>(papan(e).extraJobs) }
  xj[div] = jobTambahanMkt(e, div).map(j => (j.id !== id ? j : { ...j, [field]: field === 'hminus' ? hminusDariMkt(nilai) : nilai }))
  return { extraJobs: xj }
}

/** Removing an extra item also drops its progress (delExtraJob, :5346). */
export function hapusJobMkt(e: EventMkt, div: string, id: string): Pick<PapanEventMkt, 'extraJobs' | 'jobProgress'> {
  const xj = { ...obj<JobTambahanMkt[]>(papan(e).extraJobs) }
  xj[div] = jobTambahanMkt(e, div).filter(j => j.id !== id)
  const jp = { ...obj<Record<string, number>>(papan(e).jobProgress) }
  if (jp[div]) {
    jp[div] = tanpa(jp[div], id)
  }
  return { extraJobs: xj, jobProgress: jp }
}

// ---- WhatsApp reminder (remindWA, :18871)

/** Active people with a name, by name (staffList, :18860). */
export const stafMkt = (users: UserMkt[]) => users.filter(x => x && x.active !== false && x.name).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))

/** HP of a PIC, matched by NAME case-insensitive (staffHp, :18863). */
export const hpStafMkt = (users: UserMkt[], nama: string) =>
  (nama ? users.find(x => String(x.name).toLowerCase() === nama.toLowerCase())?.hp ?? '' : '')

/** wa.me link: 0… becomes 62… (waLink, :5051). */
export function linkWaMkt(no: string, pesan: string): string {
  let n = String(no ?? '').replace(/\D/g, '')
  if (n.startsWith('0')) n = `62${n.slice(1)}`
  return `https://wa.me/${n}${pesan ? `?text=${encodeURIComponent(pesan)}` : ''}`
}

export function pesanTugasMkt(e: EventMkt, div: string, item: ItemTugasMkt, pic: string, deadline: string, note: string, tgl: (d?: string) => string): string {
  const kapan = deadline ? `Deadline: ${tgl(deadline)}` : (item.hminus != null ? `Deadline: H-${item.hminus}` : 'Deadline: secepatnya')
  const d = (e.detail ?? {}) as Record<string, unknown>
  const area = String((d.area === 'Lainnya' ? d.areaLain : d.area) ?? '')
  const bebas = div === DIV_BEBAS_MKT
  return `*Reminder Tugas — ${e.nama || 'Event'}*\n`
    + `Halo ${pic}, ada tugas untukmu:\n\n`
    + `• Tugas: ${item.task || '(tanpa nama)'}\n`
    + ((item.sub || !bebas) ? `• Kategori: ${bebas ? (item.sub || 'Tugas bebas') : div + (item.sub ? ` · ${item.sub}` : '')}\n` : '')
    + `• ${kapan}\n`
    + `• Event: ${e.nama || ''} (${tgl(e.tanggal)}${area ? ` · ${area}` : ''})\n`
    + (note ? `• Catatan: ${note}\n` : '')
    + '\nMohon diselesaikan ya. Terima kasih 🙏'
}

// ---------------------------------------------------------------- template edits (plans)
// Each returns what must change; the page writes it (documents + rows).

/** Event rows to patch when a category is renamed: fbFormat + the per-category keys. */
export interface UbahEventMkt { id: string, updatedAt?: number, fields: Record<string, unknown> }

/**
 * Rename an F&B category everywhere it is a KEY (renameFbFormat, :12974):
 * the format list, sub categories, templates, events' detail.fbFormat and
 * their jobProgress / jobMeta / tasks — else every event loses its list.
 */
export function rencanaUbahNamaMkt(lama: string, baru: string, fbFormats: string[], subs: SubKatMkt[], tpl: TemplateTugasMkt[], events: EventMkt[]) {
  const formats = fbFormats.map(f => (f === lama ? baru : f))
  const subsBaru = subs.map(x => (x.div === lama ? { ...x, div: baru } : x))
  const templates = tpl.filter(t => t.div === lama).map(t => ({ id: t.id, updatedAt: t.updatedAt, fields: { div: baru } }))
  const ev: UbahEventMkt[] = []
  for (const e of events) {
    const fields: Record<string, unknown> = {}
    const det = (e.detail ?? {}) as Record<string, unknown>
    if (det.fbFormat === lama) fields.detail = { ...det, fbFormat: baru }
    for (const k of ['jobProgress', 'jobMeta', 'tasks'] as const) {
      const kotak = (e as unknown as Record<string, unknown>)[k]
      if (!kotak || typeof kotak !== 'object' || Array.isArray(kotak) || !(lama in kotak)) continue
      const k0 = kotak as Record<string, unknown>
      fields[k] = { ...tanpa(k0, lama), [baru]: baru in k0 ? k0[baru] : k0[lama] }
    }
    if (Object.keys(fields).length) ev.push({ id: e.id, updatedAt: e.updatedAt, fields })
  }
  return { formats, subs: subsBaru, templates, events: ev, nEvent: events.filter(e => (e.detail as Record<string, unknown> | undefined)?.fbFormat === lama).length }
}

/**
 * Copy another category in (salinKategori, :13011): subs first (keep their
 * order), then items keyed by sub + task name — copying twice adds nothing.
 * Progress is never copied: the standard, not the work in flight.
 */
export function rencanaSalinMkt(target: string, sumber: string, subs: SubKatMkt[], tpl: TemplateTugasMkt[], idBaru: (awalan: string) => string) {
  const ada = subsDariMkt(subs, target).map(x => x.nama)
  const subsBaru: SubKatMkt[] = []
  for (const sc of subsDariMkt(subs, sumber)) {
    if (ada.includes(sc.nama)) continue
    subsBaru.push({ id: idBaru('sc'), div: target, nama: sc.nama })
    ada.push(sc.nama)
  }
  const sudah = new Set(templateDivMkt(tpl, target).map(t => `${t.sub || ''} ${t.task || ''}`))
  const itemBaru: TemplateTugasMkt[] = []
  let lewat = 0
  for (const t of templateDivMkt(tpl, sumber)) {
    const k = `${t.sub || ''} ${t.task || ''}`
    if (sudah.has(k)) {
      lewat++
      continue
    }
    sudah.add(k)
    itemBaru.push({ id: idBaru('tt'), div: target, sub: t.sub || '', task: t.task || '', pic: t.pic || '', hminus: t.hminus != null ? t.hminus : null, deadline: t.deadline || '', note: t.note || '' })
  }
  return { subsBaru, itemBaru, lewat }
}

/**
 * Move an old division category into a format as ONE sub category
 * (pindahKategoriLama, :12905): its own subs become "<div> — <sub>" so nothing
 * collides; progress/meta of events of THAT format move key div → format.
 */
export function rencanaPindahMkt(div: string, fmt: string, subs: SubKatMkt[], tpl: TemplateTugasMkt[], events: EventMkt[], idBaru: (awalan: string) => string) {
  const items = templateDivMkt(tpl, div)
  const peta: Record<string, string> = {}
  for (const sc of subsDariMkt(subs, div)) peta[sc.nama] = `${div} — ${sc.nama}`
  const ada = subsDariMkt(subs, fmt).map(x => x.nama)
  const tambah: SubKatMkt[] = []
  for (const nm of [div, ...Object.values(peta)]) {
    if (ada.includes(nm)) continue
    tambah.push({ id: idBaru('sc'), div: fmt, nama: nm })
    ada.push(nm)
  }
  const subsBaru = [...subs, ...tambah].filter(x => x.div !== div)
  const templates = items.map(t => ({ id: t.id, updatedAt: t.updatedAt, fields: { div: fmt, sub: peta[t.sub || ''] || div } }))
  const ids = items.map(t => t.id)
  const ev: UbahEventMkt[] = []
  for (const e of events) {
    if ((e.detail as Record<string, unknown> | undefined)?.fbFormat !== fmt) continue
    const fields: Record<string, unknown> = {}
    for (const k of ['jobProgress', 'jobMeta'] as const) {
      const kotak = (e as unknown as Record<string, unknown>)[k]
      const asal = kotak && typeof kotak === 'object' && !Array.isArray(kotak) ? (kotak as Record<string, unknown>)[div] : null
      if (!asal || typeof asal !== 'object' || Array.isArray(asal)) continue
      const o = { ...(kotak as Record<string, unknown>) }
      let src = { ...(asal as Record<string, unknown>) }
      const tuj = { ...obj<unknown>(o[fmt]) }
      let pindah = false
      for (const id of ids) {
        if (id in src && !(id in tuj)) {
          tuj[id] = src[id]
          src = tanpa(src, id)
          pindah = true
        }
      }
      if (!pindah) continue
      o[div] = src
      o[fmt] = tuj
      fields[k] = o
    }
    if (Object.keys(fields).length) ev.push({ id: e.id, updatedAt: e.updatedAt, fields })
  }
  return { subs: subsBaru, templates, events: ev, nItem: items.length, nSubLama: Object.keys(peta).length }
}

/**
 * Drag one sub onto another WITHIN one category (reorderSub, :12884): only
 * that category's slots move; down lands after the target, up before it.
 */
export function urutSubMkt(subs: SubKatMkt[], dragId: string, targetId: string): SubKatMkt[] {
  if (!dragId || dragId === targetId) return subs
  const a = subs.find(x => x.id === dragId)
  const b = subs.find(x => x.id === targetId)
  if (!a || !b || a.div !== b.div) return subs
  const slot: number[] = []
  subs.forEach((x, i) => {
    if (x.div === a.div) slot.push(i)
  })
  const urut = slot.map(i => subs[i]!)
  const ia = urut.indexOf(a)
  const ib = urut.indexOf(b)
  urut.splice(ia, 1)
  const ib2 = urut.indexOf(b)
  urut.splice(ia < ib ? ib2 + 1 : ib2, 0, a)
  const out = subs.slice()
  slot.forEach((gi, k) => {
    out[gi] = urut[k]!
  })
  return out
}

/** A sub category name, unique within its category (saveSubCat, :13086). */
export function cekNamaSubMkt(nama: string, subs: SubKatMkt[], div: string, kecualiId = ''): { judul: string, isi: string } | null {
  if (!nama) return { judul: 'Nama wajib', isi: 'Isi nama sub kategori dulu.' }
  if (subsDariMkt(subs, div).some(x => x.id !== kecualiId && x.nama.toLowerCase() === nama.toLowerCase())) return { judul: 'Sudah ada', isi: `Sub kategori "${nama}" sudah ada di ${div}.` }
  return null
}

/** The template form's fields → the row to save (saveTemplateTask, :13160). */
export function barisTemplateMkt(isi: { div: string, task: string, sub: string, pic: string, note: string, deadline: string, hminus: string }): Omit<TemplateTugasMkt, 'id'> {
  return {
    div: isi.div, task: isi.task.trim(), sub: isi.sub || '', pic: isi.pic.trim(), note: isi.note.trim(),
    deadline: isi.deadline || '', hminus: hminusDariMkt(isi.hminus),
  }
}

/** Event fields to clear when an OLD division category is deleted (delTaskCategory, :13213). */
export function rencanaHapusLamaMkt(div: string, events: EventMkt[]): UbahEventMkt[] {
  const out: UbahEventMkt[] = []
  for (const e of events) {
    const fields: Record<string, unknown> = {}
    for (const k of ['jobProgress', 'tasks'] as const) {
      const kotak = (e as unknown as Record<string, unknown>)[k]
      if (!kotak || typeof kotak !== 'object' || Array.isArray(kotak) || !(div in kotak)) continue
      fields[k] = tanpa(kotak as Record<string, unknown>, div)
    }
    if (Object.keys(fields).length) out.push({ id: e.id, updatedAt: e.updatedAt, fields })
  }
  return out
}
