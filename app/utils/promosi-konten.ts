// Konten › Promosi: KOL & Medpar, Ads Management, Report Percakapan — the pure
// rules. Source: laksamana-office/deploy/konten/index.html (constants
// :1213-1248, KOL :3334-3700, ads :3701-4270, chats :3884-3970); konten.md
// D.14–D.16, F.14–F.20.
//
// Money rules that fail silently (F.15–F.17):
//  - the AD's START date decides which month its spending lands in, with a
//    fallback chain (startDate → createdDate → createdAt → first expense) and
//    a "Belum ada tanggal mulai" bucket — never dropped;
//  - spending includes 11% VAT, one function for every screen;
//  - cost per chat is withheld (null) when chats OR spending is 0: an ad whose
//    spending was never typed would otherwise always win "cheapest".
import type { BrandKonten } from '~/utils/konten'

// ---------------------------------------------------------------- KOL & Medpar

export const KOL_CATEGORIES = ['Food & Beverage', 'DJ', 'Batak', 'Minang', 'Lifestyle', 'Beauty', 'Fashion', 'Travel', 'Tech / Gadget', 'Parenting', 'Comedy / Entertainment', 'Sport & Fitness', 'Gaming', 'Edukasi', 'Music', 'Automotive', 'Family / Vlog']
export const KOL_TYPES = ['KOL', 'Media Partner']
export const VISIT_LOCATIONS = ['Outlet Pusat', 'Kantor Laksamana Muda', 'Studio Produksi', 'Cafe / Resto Partner', 'Hotel / Ballroom', 'Event Venue', 'Online / Virtual', 'Lainnya']

export interface RateRiwayat { value: number, prev: number, at: number, by: string }
export interface KolKonten {
  id: string
  name?: string
  type?: string
  whatsapp?: string
  instagram?: string
  tiktok?: string
  categories?: string[]
  /** old single niche */
  category?: string
  rateImage?: string
  /** old: rate card as a Drive link / tier text — read, never written */
  rateDrive?: string
  rateTier?: string
  rateValue?: number
  rateHistory?: RateRiwayat[]
  note?: string
  createdAt?: number
  updatedAt?: number
}

/** Niches, reading the old single `category` too. */
export const kolCats = (k?: KolKonten | null) => (k ? (k.categories ?? (k.category ? [k.category] : [])) : [])
export const kolType = (k?: KolKonten | null) => k?.type || 'KOL'
/** Usernames are stored without "@". */
export const tanpaAt = (s?: string) => String(s ?? '').replace(/^@/, '')

/** WhatsApp digits for wa.me: "08…" → "628…" (old waDigits: only a leading 0 changes). */
export function nomorWaKol(n?: string) {
  let d = String(n ?? '').replace(/\D/g, '')
  if (d.startsWith('0')) d = `62${d.slice(1)}`
  return d
}
export const linkWaKol = (n?: string) => {
  const d = nomorWaKol(n)
  return d ? `https://wa.me/${d}` : ''
}

/**
 * Starting price history: a new entry only when the price CHANGES, newest
 * first, max 60. Computed BEFORE the record is overwritten (old rateHistUpdate).
 */
export function riwayatRate(k: KolKonten | null | undefined, baru: number, by: string, at = Date.now()): RateRiwayat[] {
  const lama = Number(k?.rateValue) || 0
  const h = Array.isArray(k?.rateHistory) ? k!.rateHistory!.slice() : []
  if ((Number(baru) || 0) === lama) return h
  h.unshift({ value: Number(baru) || 0, prev: lama, at, by })
  if (h.length > 60) h.pop()
  return h
}
export const rateDelta = (e: RateRiwayat) => (Number(e.value) || 0) - (Number(e.prev) || 0)

export interface FilterKol { q: string, type: string, category: string }
export const filterKolBawaan = (): FilterKol => ({ q: '', type: '', category: '' })
export function saringKol(list: KolKonten[], f: FilterKol): KolKonten[] {
  let out = list.slice()
  const q = f.q.trim().toLowerCase()
  if (q) out = out.filter(k => `${k.name ?? ''}${k.instagram ?? ''}${k.tiktok ?? ''}${k.whatsapp ?? ''}${kolCats(k).join(' ')}`.toLowerCase().includes(q))
  if (f.category) out = out.filter(k => kolCats(k).includes(f.category))
  if (f.type) out = out.filter(k => kolType(k) === f.type)
  return out.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

/** Niches actually used in the database, with counts (custom ones included) — the invite picker offers only these. */
export function nicheKol(kols: KolKonten[]) {
  const ada: Record<string, number> = {}
  for (const k of kols) for (const c of kolCats(k)) if (c) ada[c] = (ada[c] ?? 0) + 1
  return Object.keys(ada).sort((a, b) => a.localeCompare(b, 'id')).map(c => ({ c, n: ada[c]! }))
}

// ---------------------------------------------------------------- visits

export interface VisitPenuh {
  id: string
  title?: string
  date?: string
  time?: string
  location?: string
  brand?: string
  desc?: string
  note?: string
  invitees?: string[]
  kolId?: string
  pic?: string
  status?: string
  objective?: string
  createdAt?: number
  updatedAt?: number
}

/** Invitees, reading the old single `kolId`. */
export const undanganVisit = (v?: VisitPenuh | null) => (v ? (v.invitees?.length ? v.invitees : (v.kolId ? [v.kolId] : [])) : [])

export interface FilterVisit { q: string, status: string, kol: string }
export const filterVisitBawaan = (): FilterVisit => ({ q: '', status: '', kol: '' })
export function saringVisit(list: VisitPenuh[], f: FilterVisit, namaKol: (id: string) => string): VisitPenuh[] {
  let out = list.slice()
  const q = f.q.trim().toLowerCase()
  if (q) out = out.filter(v => `${v.title ?? ''}${undanganVisit(v).map(namaKol).join(' ')}${v.location ?? ''}${v.desc ?? ''}`.toLowerCase().includes(q))
  if (f.status) out = out.filter(v => v.status === f.status)
  if (f.kol) out = out.filter(v => undanganVisit(v).includes(f.kol))
  const t = (v: VisitPenuh) => new Date(v.date || '2099').getTime() || 0
  return out.sort((a, b) => t(a) - t(b))
}

/** The invitation template (old visitMsg). Emoji are part of the chat text. */
export function pesanUndangan(v: VisitPenuh, nama: string, tgl: string) {
  return `Halo ${nama}! 👋\nKami dari Laksamana Muda ingin mengundang kamu ke acara:\n\n📌 ${v.title || 'Event Activity'}\n🗓️ ${tgl}`
    + `${v.time ? `\n⏰ ${v.time} WIB` : ''}${v.location ? `\n📍 ${v.location}` : ''}${v.desc ? `\n\n${v.desc}` : ''}`
    + `\n\nDitunggu konfirmasi kehadirannya ya 🙏 Terima kasih!`
}

// ---------------------------------------------------------------- ads

export const ADS_PLATFORMS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'YouTube Ads', 'LinkedIn Ads', 'X Ads']
export const ADS_OBJECTIVES = ['Awareness', 'Traffic', 'Engagement', 'Leads', 'Conversion', 'Sales', 'App Install', 'Video Views']
export const ADS_STATUS: Record<string, { label: string }> = {
  draft: { label: 'Draft' },
  active: { label: 'Aktif' },
  paused: { label: 'Dijeda' },
  ended: { label: 'Selesai' },
}
/** VAT on ad spending (F.16). */
export const ADS_TAX = 0.11
export const ADS_TARGETS = ['Umum / Semua Audiens', 'Pembeli Sebelumnya', 'Lookalike Audience', 'Retargeting Website', 'Interest - Kuliner', 'Interest - Lifestyle', 'Lokal (Radius Outlet)', 'Followers Sosmed', 'New Customer']
export const ADS_AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', '18-35', '25-45', 'Semua Usia']
/** The bucket of ads without any date (F.15) — shown, never dropped. */
export const ADS_TANPA_TGL = '0000-00'

export interface RincianIklan { date?: string, purpose?: string, amount?: number | string }
export interface IklanKonten {
  id: string
  name?: string
  brand?: string
  platform?: string
  objective?: string
  status?: string
  target?: string
  ageRange?: string
  startDate?: string
  endDate?: string
  /** old: date typed under the previous rule — read as a fallback only */
  createdDate?: string
  createdAt?: number
  chats?: number
  videoUrl?: string
  expenses?: RincianIklan[]
  spendBase?: number
  tax?: number
  /** old flat spending, before itemised expenses */
  spend?: number
  budget?: number
  note?: string
  updatedAt?: number
}
export interface DanaIklan { id: string, brand?: string, date?: string, amount?: number, note?: string, createdAt?: number, updatedAt?: number }

/** Total spending incl. 11% VAT: itemised expenses, else the old flat `spend`. */
export function danaKeluarIklan(a?: IklanKonten | null): number {
  if (a?.expenses?.length) {
    const base = a.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    return base + Math.round(base * ADS_TAX)
  }
  return a ? Number(a.spend) || 0 : 0
}
export const pajakIklan = (base: number) => Math.round(base * ADS_TAX)

/** The date that decides the month of an ad's spending (fallback chain, F.15). */
export function tglDanaIklan(a?: IklanKonten | null): string {
  if (!a) return ''
  if (a.startDate) return String(a.startDate).slice(0, 10)
  if (a.createdDate) return String(a.createdDate).slice(0, 10)
  if (a.createdAt) {
    const d = new Date(Number(a.createdAt))
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const e = (a.expenses ?? []).find(x => x?.date)
  return e ? String(e.date).slice(0, 10) : ''
}
/** The month came from a fallback, not the start date — the table marks it. */
export const iklanPakaiCadangan = (a?: IklanKonten | null) => !!(a && !a.startDate && tglDanaIklan(a))
export const bulanIklan = (a?: IklanKonten | null) => tglDanaIklan(a).slice(0, 7) || ADS_TANPA_TGL

export function labelBulanIklan(ym: string) {
  if (ym === ADS_TANPA_TGL) return 'Belum ada tanggal mulai'
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

/** Money in & out per month: funds by their date, ALL of an ad's spending in its start month. Newest first. */
export function rekapBulanIklan(funds: DanaIklan[], ads: IklanKonten[]) {
  const m: Record<string, { in: number, out: number }> = {}
  const ke = (ym: string) => (m[ym] ??= { in: 0, out: 0 })
  for (const f of funds) {
    if (!f.date) continue
    ke(String(f.date).slice(0, 7)).in += Number(f.amount) || 0
  }
  for (const a of ads) {
    const t = danaKeluarIklan(a)
    if (t) ke(bulanIklan(a)).out += t
  }
  return Object.keys(m).sort().reverse().map(ym => ({ ym, ...m[ym]! }))
}

/**
 * Status from the dates (old autoUpdateStatuses): past end → ended, started →
 * active, not yet → draft. A manual "paused" is never touched. Returns the new
 * status, or null when nothing changes.
 */
export function statusIklanOtomatis(a: IklanKonten, hariIni: string): string | null {
  if (a.status === 'paused') return null
  let ns = a.status
  if (a.endDate && hariIni > a.endDate) ns = 'ended'
  else if (a.startDate && hariIni >= a.startDate) ns = 'active'
  else if (a.startDate && hariIni < a.startDate) ns = 'draft'
  return ns && ns !== a.status ? ns : null
}

export interface FilterIklan { q: string, platform: string, status: string }
export const filterIklanBawaan = (): FilterIklan => ({ q: '', platform: '', status: '' })
export function saringIklan(list: IklanKonten[], f: FilterIklan): IklanKonten[] {
  let out = list.slice()
  const q = f.q.trim().toLowerCase()
  if (q) out = out.filter(a => `${a.name ?? ''}${a.objective ?? ''}${a.target ?? ''}`.toLowerCase().includes(q))
  if (f.platform) out = out.filter(a => a.platform === f.platform)
  if (f.status) out = out.filter(a => a.status === f.status)
  const t = (a: IklanKonten) => new Date(a.startDate || '1970').getTime() || 0
  return out.sort((a, b) => t(b) - t(a))
}

/** One CSV cell (old csvSafe). */
export function csvSel(v: unknown) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * The month report export (old exportAdsMonth): funds of that month, then each
 * ad of that month (same rule as the screen) with one row per expense and its
 * own date. Null when the month has nothing.
 */
export function csvBulanIklan(ym: string, funds: DanaIklan[], ads: IklanKonten[], namaBrand: (id?: string) => string): string | null {
  const rows: (string | number)[][] = [['Tipe', 'Tanggal', 'Brand', 'Nama / Sumber', 'Keperluan', 'Nominal', 'Pajak 11%', 'Total']]
  funds.filter(x => String(x.date ?? '').slice(0, 7) === ym)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach(x => rows.push(['Dana Masuk', x.date ?? '', namaBrand(x.brand), x.note ?? '', '', x.amount ?? 0, 0, x.amount ?? 0]))
  for (const a of ads.filter(x => bulanIklan(x) === ym)) {
    const exps = (a.expenses ?? []).filter(e => Number(e.amount) > 0)
    if (exps.length) {
      for (const e of exps) {
        const base = Number(e.amount) || 0
        const tax = pajakIklan(base)
        rows.push(['Dana Keluar', e.date || tglDanaIklan(a) || '', namaBrand(a.brand), a.name ?? '', e.purpose ?? '', base, tax, base + tax])
      }
    }
    else if (Number(a.spend)) {
      rows.push(['Dana Keluar', tglDanaIklan(a) || '', namaBrand(a.brand), a.name ?? '', '', Number(a.spend), 0, Number(a.spend)])
    }
  }
  return rows.length > 1 ? rows.map(r => r.map(csvSel).join(',')).join('\n') : null
}

// ---------------------------------------------------------------- promoted video

/**
 * Promoted video link: missing protocol → https:// (else the browser reads it
 * as a RELATIVE path); not a link at all → null (rejected on save); empty → ''.
 */
export function rapikanVideo(u?: string | null): string | null {
  let s = String(u ?? '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) s = `https://${s}`
    else return null
  }
  return s
}
const VIDEO_PLAT = [
  { tes: /(^|\.)instagram\.com$/i, nama: 'Instagram' },
  { tes: /(^|\.)(facebook\.com|fb\.watch)$/i, nama: 'Facebook' },
  { tes: /(^|\.)tiktok\.com$/i, nama: 'TikTok' },
  { tes: /(^|\.)(youtube\.com|youtu\.be)$/i, nama: 'YouTube' },
]
/** The VIDEO's platform, read from its host (not from the ad platform). Unknown host = its own name. */
export function platformVideo(u?: string | null): string | null {
  const s = rapikanVideo(u)
  if (!s) return null
  let host = ''
  try {
    host = new URL(s).hostname
  }
  catch {
    return 'Tautan'
  }
  return VIDEO_PLAT.find(x => x.tes.test(host))?.nama ?? host.replace(/^www\./, '')
}

// ---------------------------------------------------------------- Report Percakapan

/** Spending (incl. VAT) ÷ chats; null when either is 0 (F.17). */
export function biayaChat(a: IklanKonten): number | null {
  const c = Number(a.chats) || 0
  const s = danaKeluarIklan(a)
  return c <= 0 || s <= 0 ? null : s / c
}

export const CHAT_URUT = {
  chats: { t: 'Chat Terbanyak', v: (a: IklanKonten) => (Number(a.chats) || 0) as number | null, naik: false },
  murah: { t: 'Biaya per Chat Termurah', v: biayaChat, naik: true },
  dana: { t: 'Dana Keluar Terbesar', v: (a: IklanKonten) => danaKeluarIklan(a) as number | null, naik: false },
} as const
export type UrutChat = keyof typeof CHAT_URUT

/** Sorted copy; no-value rows always sink. */
export function urutChat(list: IklanKonten[], kunci: UrutChat): IklanKonten[] {
  const f = CHAT_URUT[kunci] ?? CHAT_URUT.chats
  const nama = (x: IklanKonten) => String(x.name ?? '')
  return list.slice().sort((x, y) => {
    const a = f.v(x)
    const b = f.v(y)
    if (a == null && b == null) return nama(x).localeCompare(nama(y))
    if (a == null) return 1
    if (b == null) return -1
    return (f.naik ? a - b : b - a) || nama(x).localeCompare(nama(y))
  })
}

export interface GrupChat { key: string, url: string, n: number, chats: number, dana: number }

/** Everything the chats report shows for one set of ads (one month or all). */
export function rekapChat(list: IklanKonten[]) {
  const berchat = list.filter(a => Number(a.chats) > 0)
  const totChats = berchat.reduce((s, a) => s + (Number(a.chats) || 0), 0)
  // spending of the ads WITH chats only — awareness spend never measured in chats stays out
  const totDana = berchat.reduce((s, a) => s + danaKeluarIklan(a), 0)
  const bpc = totChats > 0 && totDana > 0 ? totDana / totChats : null
  const tanpaDana = berchat.filter(a => danaKeluarIklan(a) <= 0)
  const bisaMurah = berchat.filter(a => biayaChat(a) != null)
  // per video: the same link (once tidied) is ONE video, whatever ads pushed it
  const pv: Record<string, GrupChat> = {}
  for (const a of list) {
    const u = rapikanVideo(a.videoUrl) || ''
    const k = u || '(tanpa link video)'
    const e = (pv[k] ??= { key: k, url: u, n: 0, chats: 0, dana: 0 })
    e.n++
    e.chats += Number(a.chats) || 0
    e.dana += danaKeluarIklan(a)
  }
  const perVideo = Object.values(pv).sort((a, b) => (b.chats - a.chats) || (a.url ? (b.url ? a.key.localeCompare(b.key) : -1) : 1))
  const pp: Record<string, GrupChat> = {}
  for (const a of list) {
    const k = a.platform || '(tanpa platform)'
    const e = (pp[k] ??= { key: k, url: '', n: 0, chats: 0, dana: 0 })
    e.n++
    e.chats += Number(a.chats) || 0
    e.dana += danaKeluarIklan(a)
  }
  const perPlat = Object.values(pp).sort((a, b) => b.chats - a.chats)
  return {
    berchat, totChats, totDana, bpc, tanpaDana, bisaMurah, perVideo, perPlat,
    topChat: urutChat(berchat, 'chats')[0] ?? null,
    topMurah: urutChat(bisaMurah, 'murah')[0] ?? null,
    topVideo: perVideo.find(v => v.url && v.chats > 0) ?? null,
  }
}
export const biayaGrup = (g: GrupChat) => (g.chats > 0 && g.dana > 0 ? g.dana / g.chats : null)

export const namaBrandPendek = (brands: BrandKonten[], id?: string) => brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
