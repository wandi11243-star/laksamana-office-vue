// Talent Schedule, roster style: the pure logic. No Vue, no API; importable
// from plain node for tools/uji-event-jadwal.mjs.
//
// What lives here:
//   - ONE weekday helper (Monday = 0 … Sunday = 6) used by every screen. The
//     old page mixed `getDay()` (Sunday = 0) with a Monday-based picker and
//     wrote Saturday for "Jum";
//   - the `jamTalent` setting document and the default-hours order
//     (talent override → category slot for that weekday → category slot for
//     all days → none);
//   - the DRAFT model: everything a person does on the roster is a draft until
//     "Simpan jadwal". A draft is a new row, a change to a saved row, or a
//     deletion of a saved row;
//   - clash detection over saved rows + drafts (every loaded day, so weeks that
//     cross a month are checked as a whole);
//   - the batch payload for `POST /event/schedules/batch`, "Salin minggu lalu"
//     and "Isi otomatis".
import type { JadwalTalent } from '~/composables/useEvent'
import { feeAngka, tumpangTindih } from '~/utils/event-hitung'
import { geserTgl, hariKe, rentangHari } from '~/utils/kalender'
import type { Versi } from '~/utils/versi'

// ------------------------------------------------------------------ weekdays

export const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
export const HARI_PANJANG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

/** 0 = Monday … 6 = Sunday for a `YYYY-MM-DD` (1970-01-01 was a Thursday). The ONE weekday helper. */
export const idxHariEms = (tgl: string) => (((hariKe(tgl) % 7) + 7) % 7 + 3) % 7

/** The Monday of the week holding `tgl`. */
export const seninEms = (tgl: string) => geserTgl(tgl, -idxHariEms(tgl))
/** Monday … Sunday starting at `senin`. */
export const tujuhHariEms = (senin: string) => Array.from({ length: 7 }, (_, i) => geserTgl(senin, i))

// ------------------------------------------------------------------ hours

/** End time stays at most 23:59 (the old Event app checks clashes with that rule). */
export const JAM_AKHIR = '23:59'
/** `HH:MM` of a stored time (the column may hold `HH:MM:SS`). */
export const jam5 = (v: unknown) => String(v ?? '').slice(0, 5)

/** Indonesian message for a bad pair of hours, or '' when fine. */
export function pesanJam(mulai: string, selesai: string): string {
  if (!mulai || !selesai) return 'Jam mulai dan jam selesai wajib diisi.'
  const re = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!re.test(mulai) || !re.test(selesai)) return 'Format jam harus JJ:MM, mis. 19:45.'
  if (selesai > JAM_AKHIR) return `Jam selesai paling akhir ${JAM_AKHIR}.`
  if (mulai >= selesai) return `Jam selesai harus lebih besar dari jam mulai (paling akhir ${JAM_AKHIR}).`
  return ''
}

// ------------------------------------------------------------------ jamTalent setting

export interface SlotJam {
  id: string
  nama: string
  mulai: string
  selesai: string
  /** 0 = Monday … 6 = Sunday; [] = every day. */
  hari: number[]
  bawaan: boolean
}
export interface JamTalentDoc {
  kategori: Record<string, SlotJam[]>
  talent: Record<string, { mulai: string, selesai: string }>
}

export const dokumenKosong = (): JamTalentDoc => ({ kategori: {}, talent: {} })

/** The owner's November 2026 hours, offered as a suggestion only (never used for scheduling until saved). */
export const JAM_USULAN: JamTalentDoc = {
  kategori: {
    'Band': [{ id: 'band-utama', nama: 'Utama', mulai: '19:45', selesai: '22:30', hari: [], bawaan: true }],
    'DJ': [{ id: 'dj-utama', nama: 'Utama', mulai: '22:30', selesai: '23:59', hari: [], bawaan: true }],
    'MC DJ': [{ id: 'mcdj-utama', nama: 'Utama', mulai: '22:30', selesai: '23:59', hari: [], bawaan: true }],
  },
  talent: {},
}
export const salinDokumen = (d: JamTalentDoc): JamTalentDoc => JSON.parse(JSON.stringify(d))

const adalahObjek = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Tolerant reader of the stored value (an empty PHP array may arrive as `[]`). */
export function rapikanDokumen(mentah: unknown): JamTalentDoc {
  const out = dokumenKosong()
  if (!adalahObjek(mentah)) return out
  if (adalahObjek(mentah.kategori)) {
    for (const [kat, daftar] of Object.entries(mentah.kategori)) {
      if (!Array.isArray(daftar)) continue
      const slot: SlotJam[] = []
      for (const s of daftar) {
        if (!adalahObjek(s)) continue
        slot.push({
          id: String(s.id ?? ''),
          nama: String(s.nama ?? ''),
          mulai: jam5(s.mulai),
          selesai: jam5(s.selesai),
          hari: Array.isArray(s.hari) ? [...new Set((s.hari as unknown[]).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [],
          bawaan: s.bawaan === true,
        })
      }
      out.kategori[kat] = slot
    }
  }
  if (adalahObjek(mentah.talent)) {
    for (const [id, j] of Object.entries(mentah.talent)) {
      if (adalahObjek(j)) out.talent[id] = { mulai: jam5(j.mulai), selesai: jam5(j.selesai) }
    }
  }
  return out
}

/** Does the document hold anything at all? (Empty = nothing saved yet.) */
export const dokumenAdaIsi = (d: JamTalentDoc) =>
  Object.values(d.kategori).some(l => l.length > 0) || Object.keys(d.talent).length > 0

/** Problems of a document before it is sent (the server checks again). */
export function galatDokumen(d: JamTalentDoc): string[] {
  const out: string[] = []
  for (const [kat, slots] of Object.entries(d.kategori)) {
    const ids = new Set<string>()
    for (const s of slots) {
      const nama = s.nama.trim() || '(tanpa nama)'
      const p = pesanJam(s.mulai, s.selesai)
      if (p) out.push(`${kat} · ${nama}: ${p}`)
      if (!s.id || ids.has(s.id)) out.push(`${kat} · ${nama}: kode slot kembar.`)
      ids.add(s.id)
    }
  }
  for (const [id, j] of Object.entries(d.talent)) {
    const p = pesanJam(j.mulai, j.selesai)
    if (p) out.push(`Jam khusus talent ${id}: ${p}`)
  }
  return out
}

export interface JamBawaan {
  mulai: string
  selesai: string
  asal: 'talent' | 'hari' | 'semua'
  slotId?: string
}

/** The slot that wins among several: the one marked `bawaan`, else the first. */
const pilihSlot = (l: SlotJam[]) => l.find(s => s.bawaan) ?? l[0]

/**
 * Default hours for a talent on a date:
 * talent override → category slot for that weekday → category slot for all days → null.
 */
export function jamBawaan(doc: JamTalentDoc, talentId: string, kategori: string, tgl: string): JamBawaan | null {
  const khusus = doc.talent[talentId]
  if (khusus && !pesanJam(khusus.mulai, khusus.selesai)) return { mulai: khusus.mulai, selesai: khusus.selesai, asal: 'talent' }
  const slots = (doc.kategori[kategori] ?? []).filter(s => !pesanJam(s.mulai, s.selesai))
  const hariIni = pilihSlot(slots.filter(s => s.hari.includes(idxHariEms(tgl))))
  if (hariIni) return { mulai: hariIni.mulai, selesai: hariIni.selesai, asal: 'hari', slotId: hariIni.id }
  const semua = pilihSlot(slots.filter(s => s.hari.length === 0))
  if (semua) return { mulai: semua.mulai, selesai: semua.selesai, asal: 'semua', slotId: semua.id }
  return null
}

/** Every slot of a category (the chips in the editor). */
export const slotKategori = (doc: JamTalentDoc, kategori: string): SlotJam[] => doc.kategori[kategori] ?? []

/** Hours a slot offers on `tgl`, or null when it does not apply that weekday. */
export const slotBerlaku = (s: SlotJam, tgl: string) => s.hari.length === 0 || s.hari.includes(idxHariEms(tgl))

/** Does a row differ from the default hours? (A dot in the cell; no default = no dot.) */
export function bedaDariBawaan(doc: JamTalentDoc, talentId: string, kategori: string, tgl: string, mulai: string, selesai: string): boolean {
  const b = jamBawaan(doc, talentId, kategori, tgl)
  return !!b && (b.mulai !== jam5(mulai) || b.selesai !== jam5(selesai))
}

// ------------------------------------------------------------------ talents and groups

export interface TalentRingkas {
  id: string
  name: string
  category: string
  default_fee?: unknown
  status: string
}

/** Categories: the fixed list plus any category found on a talent. */
export function daftarKategori(dasar: string[], talents: Pick<TalentRingkas, 'category'>[]): string[] {
  const lebih = [...new Set(talents.map(t => t.category).filter(k => k && !dasar.includes(k)))].sort((a, b) => a.localeCompare(b))
  return [...dasar, ...lebih]
}

// ------------------------------------------------------------------ rows and drafts

/** What a schedule row holds in the editor. */
export interface NilaiJadwal {
  talent_id: string
  date: string
  start_time: string
  end_time: string
  performance_type: string
  fee: number
  status: string
  event_id: string | null
  notes: string
}
const KUNCI_NILAI: (keyof NilaiJadwal)[] = ['talent_id', 'date', 'start_time', 'end_time', 'performance_type', 'fee', 'status', 'event_id', 'notes']
/** A change in any of these can create a double booking (the server checks the same set). */
const KUNCI_BENTROK: (keyof NilaiJadwal)[] = ['talent_id', 'date', 'start_time', 'end_time', 'status']

export const STATUS_JADWAL = ['Scheduled', 'Confirmed', 'Done', 'Cancelled']
/** Done and Cancelled rows are locked against drag-to-move. */
export const STATUS_TERKUNCI = ['Done', 'Cancelled']

export function nilaiDariBaris(j: Pick<JadwalTalent, 'talent_id' | 'date' | 'start_time' | 'end_time' | 'performance_type' | 'fee' | 'status'> & { event_id?: unknown, notes?: unknown }): NilaiJadwal {
  return {
    talent_id: String(j.talent_id),
    date: String(j.date),
    start_time: jam5(j.start_time),
    end_time: jam5(j.end_time),
    performance_type: String(j.performance_type ?? ''),
    fee: feeAngka(j.fee),
    status: String(j.status ?? 'Scheduled'),
    event_id: j.event_id ? String(j.event_id) : null,
    notes: String(j.notes ?? ''),
  }
}

/** The keys (and new values) in which `b` differs from `a`. */
export function bedaNilai(a: NilaiJadwal, b: NilaiJadwal): Partial<NilaiJadwal> {
  const out: Record<string, unknown> = {}
  for (const k of KUNCI_NILAI) if (a[k] !== b[k]) out[k] = b[k]
  return out as Partial<NilaiJadwal>
}

export interface Draf {
  /** Saved row: its id. New row: the id it will be created with. */
  kunci: string
  /** The saved row this draft changes or deletes; absent for a new row. */
  asli?: NilaiJadwal
  /** Version of the saved row when the draft was made (sent back as `version`). */
  versi?: Versi
  /** `source` of the saved row (kept), for display. */
  sumber?: string
  nilai: NilaiJadwal
  hapus?: boolean
  /** Someone else changed the saved row after this draft was made; apply it again to confirm. */
  basi?: boolean
}

export type JenisDraf = 'baru' | 'ubah' | 'hapus'
export const jenisDraf = (d: Draf): JenisDraf => (!d.asli ? 'baru' : d.hapus ? 'hapus' : 'ubah')

export function hitungDraf(draf: Draf[]) {
  const n = { baru: 0, ubah: 0, hapus: 0 }
  for (const d of draf) n[jenisDraf(d)]++
  return n
}

export const ringkasDraf = (draf: Draf[]) => {
  const n = hitungDraf(draf)
  return `${n.baru} baru · ${n.ubah} diubah · ${n.hapus} dihapus`
}

/** A random id for a new row (also what the server stores: ≤ 64 characters). */
export const idBarisEms = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const sama = (a: NilaiJadwal, b: NilaiJadwal) => Object.keys(bedaNilai(a, b)).length === 0

/** A new row's value: type = talent category, fee = talent default fee, status Scheduled. */
export function nilaiBaru(t: Pick<TalentRingkas, 'id' | 'category' | 'default_fee'>, tgl: string, mulai: string, selesai: string): NilaiJadwal {
  return {
    talent_id: t.id,
    date: tgl,
    start_time: mulai,
    end_time: selesai,
    performance_type: t.category,
    fee: feeAngka(t.default_fee),
    status: 'Scheduled',
    event_id: null,
    notes: '',
  }
}

/** Add a new row. */
export const tambahBaru = (draf: Draf[], nilai: NilaiJadwal, kunci: string): Draf[] => [...draf, { kunci, nilai }]

/** Set the value of a draft by key (new row) or of a saved row (creating its draft). Back to the original = no draft. */
export function setNilai(draf: Draf[], kunci: string, nilai: NilaiJadwal, saved?: { baris: JadwalTalent, versi?: Versi }): Draf[] {
  const ada = draf.find(d => d.kunci === kunci)
  if (ada) {
    if (ada.asli && sama(ada.asli, nilai)) return draf.filter(d => d.kunci !== kunci)
    return draf.map(d => (d.kunci === kunci ? { ...d, nilai, hapus: false, basi: false } : d))
  }
  if (!saved) return draf
  const asli = nilaiDariBaris(saved.baris)
  if (sama(asli, nilai)) return draf
  return [...draf, { kunci, asli, versi: saved.versi, sumber: String(saved.baris.source ?? ''), nilai }]
}

/** Delete: a new row just disappears, a saved row becomes a deletion draft. */
export function hapusBaris(draf: Draf[], kunci: string, saved?: { baris: JadwalTalent, versi?: Versi }): Draf[] {
  const ada = draf.find(d => d.kunci === kunci)
  if (ada) return ada.asli ? draf.map(d => (d.kunci === kunci ? { ...d, hapus: true, basi: false } : d)) : draf.filter(d => d.kunci !== kunci)
  if (!saved) return draf
  const asli = nilaiDariBaris(saved.baris)
  return [...draf, { kunci, asli, versi: saved.versi, sumber: String(saved.baris.source ?? ''), nilai: asli, hapus: true }]
}

/** Drop one draft (undo a change or a deletion). */
export const buangSatu = (draf: Draf[], kunci: string): Draf[] => draf.filter(d => d.kunci !== kunci)

/** After a 409: keep the person's values, base them on the fresh row, and ask for a second look. */
export function tandaiBasi(draf: Draf[], kunci: string, segar: { baris: JadwalTalent, versi?: Versi } | null): Draf[] {
  if (!segar) return draf.filter(d => d.kunci !== kunci)
  const asli = nilaiDariBaris(segar.baris)
  return draf.map(d => (d.kunci === kunci ? { ...d, asli, versi: segar.versi, basi: true } : d))
}

/** A row as shown: saved, or with its draft laid over it. */
export interface BarisEf extends NilaiJadwal {
  kunci: string
  /** null = a plain saved row. */
  draf: JenisDraf | null
  sumber: string
  basi: boolean
}

/** Saved rows with the drafts laid over them. Deleted ones stay in (marked) so the sheet can show them struck through. */
export function barisEfektif(tersimpan: JadwalTalent[], draf: Draf[]): BarisEf[] {
  const peta = new Map(draf.map(d => [d.kunci, d]))
  const out: BarisEf[] = []
  for (const j of tersimpan) {
    if (peta.has(String(j.id))) continue
    out.push({ ...nilaiDariBaris(j), kunci: String(j.id), draf: null, sumber: String(j.source ?? ''), basi: false })
  }
  for (const d of draf) {
    out.push({ ...d.nilai, kunci: d.kunci, draf: jenisDraf(d), sumber: d.sumber ?? 'roster', basi: !!d.basi })
  }
  return out
}

/** Rows that really exist on the roster: not a pending deletion. */
export const barisHidup = (rows: BarisEf[]) => rows.filter(r => r.draf !== 'hapus')
/** Rows that block a slot: alive and not cancelled. */
export const barisAktif = (rows: BarisEf[]) => rows.filter(r => r.draf !== 'hapus' && r.status !== 'Cancelled')

// ------------------------------------------------------------------ clashes

const kunciGrup = (r: Pick<NilaiJadwal, 'talent_id' | 'date'>) => `${r.talent_id}|${r.date}`

/** Does this draft change anything the clash rule looks at? (Only then is it blocked, like the server.) */
function menggeserBentrok(d: Draf): boolean {
  if (!d.asli) return true
  return KUNCI_BENTROK.some(k => d.asli![k] !== d.nilai[k])
}

/**
 * Keys of rows that double-book: same talent, same date, overlapping hours,
 * neither cancelled. A pair counts only when at least one of them is a draft
 * that changed talent/date/time/status (an old clash between two untouched
 * saved rows is not the roster's business). Both rows of a pair are returned.
 */
export function bentrokEf(rows: BarisEf[], draf: Draf[]): Set<string> {
  const peta = new Map(draf.map(d => [d.kunci, d]))
  const relevan = (r: BarisEf) => {
    const d = peta.get(r.kunci)
    return !!d && menggeserBentrok(d)
  }
  const grup = new Map<string, BarisEf[]>()
  for (const r of barisAktif(rows)) {
    const k = kunciGrup(r)
    const l = grup.get(k) ?? []
    l.push(r)
    grup.set(k, l)
  }
  const out = new Set<string>()
  for (const l of grup.values()) {
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) {
        const a = l[i]!
        const b = l[j]!
        if ((relevan(a) || relevan(b)) && tumpangTindih(a.start_time, a.end_time, b.start_time, b.end_time)) {
          out.add(a.kunci)
          out.add(b.kunci)
        }
      }
    }
  }
  return out
}

/** Would hours on a day overlap another live, non-cancelled row of the same talent? (`abaikan` = the row being edited.) */
export function bentrokDengan(rows: BarisEf[], talentId: string, tgl: string, mulai: string, selesai: string, abaikan?: string): BarisEf | null {
  return barisAktif(rows).find(r => r.kunci !== abaikan && r.talent_id === talentId && r.date === tgl && tumpangTindih(r.start_time, r.end_time, mulai, selesai)) ?? null
}

/** Drafts whose hours are missing or wrong (blocks saving). */
export function draftBerjam(rows: BarisEf[]): { kunci: string, pesan: string }[] {
  const out: { kunci: string, pesan: string }[] = []
  for (const r of rows) {
    if (!r.draf || r.draf === 'hapus') continue
    const p = pesanJam(r.start_time, r.end_time)
    if (p) out.push({ kunci: r.kunci, pesan: p })
  }
  return out
}

// ------------------------------------------------------------------ second slot

/**
 * Hours for a second show of the same talent on a day: the first slot of the
 * category for that weekday that does not overlap what the talent already has;
 * null when none fits (the editor opens with empty hours).
 */
export function jamSlotKedua(doc: JamTalentDoc, talentId: string, kategori: string, tgl: string, rows: BarisEf[]): { mulai: string, selesai: string } | null {
  const slots = slotKategori(doc, kategori).filter(s => slotBerlaku(s, tgl) && !pesanJam(s.mulai, s.selesai))
  for (const s of slots) {
    if (!bentrokDengan(rows, talentId, tgl, s.mulai, s.selesai)) return { mulai: s.mulai, selesai: s.selesai }
  }
  return null
}

// ------------------------------------------------------------------ batch payload

export const BATAS_BATCH = 300

export interface SusunanBatch {
  create: Record<string, unknown>[]
  update: { id: string, version: Versi, fields: Record<string, unknown> }[]
  delete: { id: string, version: Versi }[]
  total: number
  /** Key of the draft behind each operation, by index in its own list. */
  kunci: { create: string[], update: string[], delete: string[] }
}

/**
 * The body of `POST /event/schedules/batch`. A new row is the record the old
 * page wrote (talent_id, event_id, date, performance_type, start/end, fee,
 * status, recurring_rule_id, source, createdAt/updatedAt) with `source:
 * 'roster'`, and carries its own id so the server's per-row answers (clashes,
 * bad rows) can be pinned to a cell. A changed saved row sends only the keys
 * that changed; `updatedAt` is stamped by the server. `notes` is written only
 * when it holds text (or was cleared on a saved row).
 */
export function susunBatch(draf: Draf[], sekarang: number): SusunanBatch {
  const out: SusunanBatch = { create: [], update: [], delete: [], total: 0, kunci: { create: [], update: [], delete: [] } }
  for (const d of draf) {
    const jenis = jenisDraf(d)
    if (jenis === 'baru') {
      const n = d.nilai
      out.create.push({
        id: d.kunci,
        talent_id: n.talent_id,
        event_id: n.event_id,
        date: n.date,
        performance_type: n.performance_type,
        start_time: n.start_time,
        end_time: n.end_time,
        fee: n.fee,
        status: n.status,
        recurring_rule_id: null,
        source: 'roster',
        ...(n.notes ? { notes: n.notes } : {}),
        createdAt: sekarang,
        updatedAt: sekarang,
      })
      out.kunci.create.push(d.kunci)
    }
    else if (jenis === 'hapus') {
      out.delete.push({ id: d.kunci, version: d.versi as Versi })
      out.kunci.delete.push(d.kunci)
    }
    else {
      const fields = bedaNilai(d.asli!, d.nilai)
      if (!Object.keys(fields).length) continue
      out.update.push({ id: d.kunci, version: d.versi as Versi, fields })
      out.kunci.update.push(d.kunci)
    }
  }
  out.total = out.create.length + out.update.length + out.delete.length
  return out
}

/** Why the batch cannot go out as it is (too big, or a saved row has no version), or ''. */
export function pesanBatch(s: SusunanBatch): string {
  if (s.total === 0) return 'Belum ada perubahan untuk disimpan.'
  if (s.total > BATAS_BATCH) {
    return `Ada ${s.total} perubahan; sekali simpan paling banyak ${BATAS_BATCH}. Buang sebagian draf, simpan, lalu lanjutkan sisanya.`
  }
  if ([...s.update, ...s.delete].some(o => o.version === undefined || o.version === null || o.version === '')) {
    return 'Ada baris tersimpan tanpa versi. Muat ulang halaman lalu ulangi.'
  }
  return ''
}

// ------------------------------------------------------------------ server answers

export interface GalatBatch {
  kode: string
  /** Keys (row ids) to mark red. */
  tanda: string[]
  /** `version_conflict` / `not_found`: the saved row concerned. */
  id?: string
  /** Bad rows: per row, the key of its draft and the reason. */
  baris: { kunci: string, operasi: string, alasan: string }[]
}

/** Read a failed batch call (`error.code` + `error.details`) into what the screen needs. */
export function bacaGalatBatch(e: unknown, s?: SusunanBatch): GalatBatch {
  const err = ((e as { data?: { error?: { code?: string, details?: unknown } } })?.data?.error) ?? {}
  const det = (adalahObjek(err.details) ? err.details : {}) as Record<string, unknown>
  const out: GalatBatch = { kode: String(err.code ?? ''), tanda: [], baris: [] }
  if (out.kode === 'jadwal_bentrok' && Array.isArray(det.bentrok)) {
    for (const b of det.bentrok) {
      if (!adalahObjek(b)) continue
      if (b.id) out.tanda.push(String(b.id))
      if (adalahObjek(b.dengan) && b.dengan.id) out.tanda.push(String(b.dengan.id))
    }
  }
  if (typeof det.id === 'string') out.id = det.id
  if (out.kode === 'validation_failed' && Array.isArray(det.baris)) {
    for (const b of det.baris) {
      if (!adalahObjek(b)) continue
      const op = String(b.operation ?? '') as 'create' | 'update' | 'delete'
      const kunci = s?.kunci[op]?.[Number(b.index)] ?? ''
      out.baris.push({ kunci, operasi: op, alasan: String(b.reason ?? '') })
      if (kunci) out.tanda.push(kunci)
    }
  }
  return out
}

// ------------------------------------------------------------------ loaded ranges

export interface RentangTgl { a: string, b: string }

/** Add `[a, b]` to a list of loaded ranges, merging overlapping or adjacent ones. */
export function gabungRentang(list: RentangTgl[], a: string, b: string): RentangTgl[] {
  const semua = [...list, { a, b }].sort((x, y) => x.a.localeCompare(y.a))
  const out: RentangTgl[] = []
  for (const r of semua) {
    const akhir = out[out.length - 1]
    if (akhir && hariKe(r.a) <= hariKe(akhir.b) + 1) {
      if (r.b > akhir.b) akhir.b = r.b
    }
    else {
      out.push({ ...r })
    }
  }
  return out
}

/** Is every day of `[a, b]` inside one loaded range? */
export const rentangTercakup = (list: RentangTgl[], a: string, b: string) => list.some(r => r.a <= a && r.b >= b)

// ------------------------------------------------------------------ roster groups

export interface BarisTalent {
  id: string
  nama: string
  /** The talent is inactive or gone, but has rows in the window. */
  nonaktif: boolean
  hilang: boolean
}
export interface GrupKategori {
  kategori: string
  talents: BarisTalent[]
}

/**
 * Rows of the weekly sheet: active talents grouped by category (in
 * `urutKategori` order, names A-Z), plus inactive or deleted talents that have
 * a live row in `hari`. A category with nobody in it is left out.
 */
export function susunGrup(talents: TalentRingkas[], rows: BarisEf[], hari: string[], urutKategori: string[]): GrupKategori[] {
  const awal = hari[0] ?? ''
  const akhir = hari[hari.length - 1] ?? ''
  const punyaBaris = new Map<string, string>()
  for (const r of barisHidup(rows)) {
    if (r.date >= awal && r.date <= akhir && !punyaBaris.has(r.talent_id)) punyaBaris.set(r.talent_id, r.performance_type)
  }
  const peta = new Map<string, BarisTalent[]>()
  const taruh = (kat: string, b: BarisTalent) => {
    const l = peta.get(kat) ?? []
    l.push(b)
    peta.set(kat, l)
  }
  const dikenal = new Set<string>()
  for (const t of talents) {
    dikenal.add(t.id)
    const aktif = t.status === 'Active'
    if (aktif || punyaBaris.has(t.id)) taruh(t.category || 'Lainnya', { id: t.id, nama: t.name, nonaktif: !aktif, hilang: false })
  }
  for (const [id, tipe] of punyaBaris) {
    if (!dikenal.has(id)) taruh(tipe || 'Lainnya', { id, nama: '(talent terhapus)', nonaktif: true, hilang: true })
  }
  const urut = [...urutKategori, ...[...peta.keys()].filter(k => !urutKategori.includes(k)).sort()]
  return urut
    .filter(k => peta.has(k))
    .map(k => ({ kategori: k, talents: peta.get(k)!.sort((a, b) => a.nama.localeCompare(b.nama)) }))
}

// ------------------------------------------------------------------ copy last week, auto-fill

/** Is there a live, non-cancelled row for this talent on this date? (The "cell" of the roster.) */
export const sudahAdaSel = (rows: BarisEf[], talentId: string, tgl: string) =>
  barisAktif(rows).some(r => r.talent_id === talentId && r.date === tgl)

export interface HasilIsi {
  baru: NilaiJadwal[]
  /** Cells (copy: rows) skipped because the talent already had a schedule there. */
  dilewati: number
  /** Cells skipped because the talent has no default hours. */
  tanpaJam: number
  /** Rows skipped because the talent is not active (copy only). */
  nonaktif: number
}

/**
 * "Salin minggu lalu": every live, non-cancelled row of the week before
 * `senin` becomes a draft one week later, same hours, type = the talent's
 * category, fee = the talent's default fee (the old fee when the talent has
 * none). A cell that already has a non-cancelled schedule is skipped; two
 * rows of one source cell both copy when the target cell is empty. With
 * `kategori` only talents of that category are copied.
 */
export function salinMingguLalu(rows: BarisEf[], talents: TalentRingkas[], senin: string, kategori = ''): HasilIsi {
  const lalu = geserTgl(senin, -7)
  const akhirLalu = geserTgl(senin, -1)
  const out: HasilIsi = { baru: [], dilewati: 0, tanpaJam: 0, nonaktif: 0 }
  const sumber = barisAktif(rows)
    .filter(r => r.date >= lalu && r.date <= akhirLalu)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
  for (const r of sumber) {
    const t = talents.find(x => x.id === r.talent_id)
    if (kategori && t && t.category !== kategori) continue
    if (!t || t.status !== 'Active') {
      out.nonaktif++
      continue
    }
    const tgl = geserTgl(r.date, 7)
    if (sudahAdaSel(rows, r.talent_id, tgl)) {
      out.dilewati++
      continue
    }
    const n = nilaiBaru(t, tgl, r.start_time, r.end_time)
    if (!n.fee) n.fee = r.fee
    out.baru.push(n)
  }
  return out
}

export interface OpsiIsiOtomatis {
  talents: TalentRingkas[]
  /** Weekdays, 0 = Monday. */
  hari: number[]
  dari: string
  sampai: string
  rows: BarisEf[]
  doc: JamTalentDoc
  /** Longest range accepted, in days. */
  maks?: number
}

/** Longest "Isi otomatis" range, in days. */
export const MAKS_HARI_ISI = 93

/**
 * "Isi otomatis": for each chosen talent and weekday between the two dates, a
 * draft with the talent's default hours. Cells that already have a
 * non-cancelled schedule are skipped (counted), as are cells where the talent
 * has no default hours (counted, nothing guessed).
 */
export function isiOtomatis(o: OpsiIsiOtomatis): HasilIsi {
  const out: HasilIsi = { baru: [], dilewati: 0, tanpaJam: 0, nonaktif: 0 }
  if (!o.dari || !o.sampai || o.sampai < o.dari) return out
  const tanggal = rentangHari(o.dari, o.sampai, o.maks ?? MAKS_HARI_ISI).filter(t => o.hari.includes(idxHariEms(t)))
  for (const t of o.talents) {
    for (const tgl of tanggal) {
      if (sudahAdaSel(o.rows, t.id, tgl)) {
        out.dilewati++
        continue
      }
      const j = jamBawaan(o.doc, t.id, t.category, tgl)
      if (!j) {
        out.tanpaJam++
        continue
      }
      out.baru.push(nilaiBaru(t, tgl, j.mulai, j.selesai))
    }
  }
  return out
}

/** Rows per date, by start time. */
export function perTanggal(rows: BarisEf[]): Map<string, BarisEf[]> {
  const m = new Map<string, BarisEf[]>()
  for (const r of rows) {
    const l = m.get(r.date) ?? []
    l.push(r)
    m.set(r.date, l)
  }
  for (const l of m.values()) l.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.talent_id.localeCompare(b.talent_id))
  return m
}
