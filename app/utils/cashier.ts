// Cashier rules that are not screens: payment methods, the Daily Report
// difference, receivables (bon) per day, compliment vs Daily Report, the submit
// trail. Pure functions, no Vue, no API.
//
// Source: laksamana-office/deploy/cashier/index.html (line numbers per function).
// The Daily Report and the compliment list are the SAME objects Finance › Omset
// writes (the kompas blob), so PAYS must stay identical to the old Kompas list.

/** Old `num()`: digits and minus only; anything else is 0. (:497) */
export function num(v: unknown): number {
  const n = Number.parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** "+Rp1.000" / "−Rp1.000" / "Rp0" — the signed difference (:491). */
export function fmtSel(n: number): string {
  const r = Math.round(n || 0)
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}Rp${Math.abs(r).toLocaleString('id-ID')}`
}

/** "Rp1.000" as the old screens wrote it (no space), for messages that quote amounts. */
export const fmtRp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`

export interface Metode { k: string, n: string }

/**
 * Daily Report payment methods, alphabetical as on the POS (:611-634). MUST stay
 * identical to Kompas: both write DB.reports[date].pay. The "Error …" rows are
 * not payment methods but known, owned differences; they count in the totals.
 * `qris_esb` is labelled "QRIS POS" since 12 Aug 2026; the key never changes.
 */
export const PAYS: readonly Metode[] = [
  { k: 'cash', n: 'Cash' },
  { k: 'compliment', n: 'Compliment' },
  { k: 'edc_bca', n: 'EDC BCA' },
  { k: 'edc_bri', n: 'EDC BRI' },
  { k: 'edc_mandiri', n: 'EDC Mandiri' },
  { k: 'error_bar', n: 'Error Bar' },
  { k: 'error_customer', n: 'Error Customer' },
  { k: 'error_floor', n: 'Error Floor' },
  { k: 'error_kasir', n: 'Error Kasir' },
  { k: 'error_kitchen', n: 'Error Kitchen' },
  { k: 'gofood', n: 'Gofood' },
  { k: 'grabfood', n: 'Grabfood' },
  { k: 'member_dep', n: 'Member Deposit' },
  { k: 'qris_bca', n: 'QRIS BCA' },
  { k: 'qris_bri', n: 'QRIS BRI' },
  { k: 'qris_esb', n: 'QRIS POS' },
  { k: 'qris_mandiri', n: 'QRIS Mandiri' },
  { k: 'tiktokgo', n: 'TikTok Go' },
  { k: 'transfer_uob', n: 'Transfer UOB' },
  { k: 'voucher', n: 'Voucher' },
]

export const payName = (k?: string) => PAYS.find(p => p.k === k)?.n || k || '—'

/**
 * Only the TOTAL is judged, and Rp5.000 exactly is still fine (:635-649). The
 * submit is NEVER locked: locking makes cashiers invent an Actual to go home,
 * and a matching-but-invented report is worse than an honest difference.
 */
export const SELISIH_TOLERANSI = 5000

// ---- Daily Report -------------------------------------------------------------

export interface JejakEntri { by: string, at: number }

export interface DailyReport {
  pay?: Record<string, { pos?: number | string, actual?: number | string }>
  by?: string
  at?: number
  submitted?: boolean
  log?: JejakEntri[]
  // Rekap Penjualan marks (mdr, aktual, setor, …) live here too; never touch them.
  [k: string]: unknown
}

export function repPay(rec: DailyReport | null | undefined, k: string) {
  const p = rec?.pay?.[k] || {}
  return { pos: num(p.pos), actual: num(p.actual) }
}

/** Trail of everyone who submitted a date, newest last, max 20 (:1366-1371). */
export const JEJAK_MAKS = 20
export function tambahJejak(lama: { log?: JejakEntri[] } | null | undefined, nama: string, kini = Date.now()): JejakEntri[] {
  const log = Array.isArray(lama?.log) ? lama!.log.slice() : []
  log.push({ by: nama || '', at: kini })
  return log.slice(-JEJAK_MAKS)
}
/** Rows from before the trail existed read back their by/at (:1375-1378). */
export function jejakList(rec: { log?: JejakEntri[], by?: string, at?: number } | null | undefined): JejakEntri[] {
  if (rec && Array.isArray(rec.log) && rec.log.length) return rec.log
  return rec?.at ? [{ by: rec.by || '', at: rec.at }] : []
}

// ---- Receivables (Piutang / Bon) ----------------------------------------------

export const BON_TIPE: readonly Metode[] = [
  { k: 'tamu', n: 'Tamu' },
  { k: 'owner', n: 'Owner' },
  { k: 'staff', n: 'Staff' },
  { k: 'lain', n: 'Lainnya' },
]
export const bonTipeNama = (k?: string) => BON_TIPE.find(t => t.k === k)?.n || 'Lainnya'

export interface Bon {
  id: string
  date: string
  nama: string
  tipe: string
  bill?: string
  nominal: number | string
  payKey: string
  picName?: string
  picOfficeId?: string
  picDiv?: string
  status: string
  lunasDate?: string
  lunasPayKey?: string
  lunasBy?: string
  lunasAt?: number
  by?: string
  at?: number
  ubahBy?: string
  ubahAt?: number
}

export const bonBelum = (list: Bon[]) => list.filter(b => b.status !== 'lunas')

export interface RingkasBon {
  baru: Record<string, number>
  lunas: Record<string, number>
  totBaru: number
  totLunas: number
  listBaru: Bon[]
  listLunas: Bon[]
  ada: boolean
}

/**
 * One date, per payment method (:1561-1567). A bon created AND paid the same day
 * sits in both buckets on purpose: same method cancels out, different methods
 * must show. Payments are booked on the day the money arrived, never the bill day.
 */
export function bonRingkasHari(list: Bon[], date: string): RingkasBon {
  const baru: Record<string, number> = {}
  const lunas: Record<string, number> = {}
  let totBaru = 0
  let totLunas = 0
  const listBaru = list.filter(b => b.date === date)
  const listLunas = list.filter(b => b.status === 'lunas' && b.lunasDate === date)
  for (const b of listBaru) {
    const n = num(b.nominal)
    baru[b.payKey] = (baru[b.payKey] || 0) + n
    totBaru += n
  }
  for (const b of listLunas) {
    const n = num(b.nominal)
    const k = b.lunasPayKey || ''
    lunas[k] = (lunas[k] || 0) + n
    totLunas += n
  }
  return { baru, lunas, totBaru, totLunas, listBaru, listLunas, ada: listBaru.length > 0 || listLunas.length > 0 }
}

export interface PenjelasHari extends RingkasBon {
  /** Expected difference per method: payment − bon. */
  harus: Record<string, number>
  totHarus: number
}
export function penjelasHari(list: Bon[], date: string): PenjelasHari {
  const bh = bonRingkasHari(list, date)
  const harus: Record<string, number> = {}
  for (const p of PAYS) harus[p.k] = num(bh.lunas[p.k]) - num(bh.baru[p.k])
  return { ...bh, harus, totHarus: bh.totLunas - bh.totBaru }
}

export interface GrupBon { nama: string, tipe: string, items: Bon[], total: number }

/** Open bon per person: lower-cased trimmed name + type, biggest debt first (:1571-1582). */
export function bonGrupBelum(list: Bon[]): GrupBon[] {
  const map = new Map<string, GrupBon>()
  for (const b of bonBelum(list)) {
    const key = `${String(b.nama || '').trim().toLowerCase()}|${b.tipe}`
    if (!map.has(key)) map.set(key, { nama: b.nama, tipe: b.tipe, items: [], total: 0 })
    const g = map.get(key)!
    g.items.push(b)
    g.total += num(b.nominal)
  }
  const arr = [...map.values()]
  for (const g of arr) g.items.sort((a, b) => (a.date < b.date ? -1 : 1))
  arr.sort((a, b) => b.total - a.total)
  return arr
}

export interface BarisReport {
  k: string
  n: string
  pos: number
  act: number
  /** Actual − POS. */
  s: number
  /** Not filled yet (POS 0 and Actual 0): not judged, its bon left out of the total. */
  kosong: boolean
  bb: number
  bl: number
  /** Remaining after bon & payments; what the note lists. */
  z: number
}

export interface HitungReport {
  baris: BarisReport[]
  tp: number
  ta: number
  /** Total Actual − total POS. */
  tsel: number
  /** Expected total difference from bon & payments, empty rows excluded. */
  th: number
  /** The ONE number that is judged. */
  sisa: number
  aman: boolean
  /** Rows whose remaining difference is not zero, for the note under the table. */
  bermasalah: BarisReport[]
}

/**
 * The live Daily Report sums (:1249-1330). An unfilled row (POS 0 and Actual 0)
 * means the cashier has not reached it, so its bon is excluded from the expected
 * total too — otherwise the total warns about money no row on screen can show.
 */
export function hitungReport(pay: Record<string, { pos: number, actual: number }>, bh: PenjelasHari): HitungReport {
  let tp = 0
  let ta = 0
  let th = 0
  const baris: BarisReport[] = []
  for (const p of PAYS) {
    const pos = num(pay[p.k]?.pos)
    const act = num(pay[p.k]?.actual)
    tp += pos
    ta += act
    const s = act - pos
    const kosong = pos === 0 && act === 0
    const bb = kosong ? 0 : num(bh.baru[p.k])
    const bl = kosong ? 0 : num(bh.lunas[p.k])
    const hk = kosong ? 0 : num(bh.harus[p.k])
    th += hk
    baris.push({ k: p.k, n: p.n, pos, act, s, kosong, bb, bl, z: s - hk })
  }
  const tsel = ta - tp
  const sisa = tsel - th
  return {
    baris, tp, ta, tsel, th, sisa,
    aman: Math.abs(sisa) <= SELISIH_TOLERANSI,
    bermasalah: baris.filter(b => b.z !== 0),
  }
}

/** "A, B, C dkk" — at most three distinct names (:1455-1458). */
export function namaUnik(list: { nama?: string }[]): string {
  const s = [...new Set(list.map(b => String(b.nama || '').trim()).filter(Boolean))]
  return s.length > 3 ? `${s.slice(0, 3).join(', ')} dkk` : s.join(', ')
}

// ---- Compliment ---------------------------------------------------------------

/**
 * Office teams that may be a compliment PIC (:653-663). 'kasir' since 1 Aug 2026
 * (before that a cashier could never be charged), 'office' since 7 Aug 2026.
 */
export const COMP_DIV = ['marketing', 'office', 'event', 'kasir'] as const
export const PIC_TAMU = '__tamu__'

export interface OrangComp { id: string, name: string, div: string, divs: string[] }

/**
 * Office roster -> people who may be a compliment / bon PIC (:1914-1920): active,
 * named, and with at least one team word from COMP_DIV in their Keterangan.
 */
export function rosterComp(roster: { id: string, name: string, keterangan?: string, active?: boolean }[]): OrangComp[] {
  const out: OrangComp[] = []
  for (const u of roster) {
    if (u.active === false) continue
    const ket = String(u.keterangan || '').toLowerCase().split(/[\s,;/]+/)
    const divs = COMP_DIV.filter(dv => ket.includes(dv))
    const name = String(u.name || '').trim()
    if (!divs.length || !name) continue
    out.push({ id: String(u.id), name, div: divs[0]!, divs: [...divs] })
  }
  return out
}

/** The giver side: marketing first, then event, then office (:1932-1937). */
export function divPemberi(u: { div?: string, divs?: string[] } | null | undefined): string {
  const d = u?.divs || [u?.div || '']
  return d.includes('marketing') ? 'marketing' : d.includes('event') ? 'event' : d.includes('office') ? 'office' : ''
}

export interface ComplimentKasir {
  id: string
  date: string
  nama: string
  alasan?: string
  subTotal?: number | string | null
  tax?: number | string | null
  service?: number | string | null
  nominal: number | string
  picName?: string
  picOfficeId?: string
  picDiv?: string
  pemberiName?: string
  pemberiOfficeId?: string
  pemberiDiv?: string
  pemberiStatus?: string
  putusOleh?: string
  putusAt?: number
  by?: string
  at?: number
  ubahOleh?: string
  ubahAt?: number
}

/** The giver's cut is decided in Performa Marketing/Event; here it is only read. (:1942-1945) */
export function compStatusPemberi(c?: ComplimentKasir | null): 'potong' | 'tidak' | 'menunggu' {
  const s = String(c?.pemberiStatus || 'menunggu')
  return s === 'potong' || s === 'tidak' ? s : 'menunggu'
}

/**
 * Compliment total of a day vs the Daily Report (:1976-1983): POS Compliment +
 * POS Member Deposit must equal the notes exactly. POS, not Actual — a
 * compliment never had money, so Actual would always differ by its own value.
 */
export function angkaRD(rec: DailyReport | null | undefined, totalComp: number) {
  const comp = repPay(rec, 'compliment').pos
  const dep = repPay(rec, 'member_dep').pos
  const total = comp + dep
  const catat = num(totalComp)
  const selisih = catat - total
  return { ada: !!rec, comp, dep, total, catat, selisih, cocok: !!rec && selisih === 0 }
}

/**
 * Edit keeps id, recorder and time, and the giver's decision — unless the giver
 * changed: that decision was taken on someone else's behalf (:2129-2139).
 */
export function gantiPemberi(lama: ComplimentKasir, baru: Pick<ComplimentKasir, 'pemberiOfficeId' | 'pemberiName'>): boolean {
  return String(lama.pemberiOfficeId || '') !== String(baru.pemberiOfficeId || '')
    || String(lama.pemberiName || '') !== String(baru.pemberiName || '')
}

/** New id in the old shape ('pt…' bon, 'c…' compliment). */
export const idBaru = (awalan: string) => `${awalan}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

// ---------------------------------------------------------------- Void Menu
// Old `viewVoid` & helpers, deploy/cashier/index.html:2380-3014; contract
// laksamana-api/docs/api/kompas.md "Catatan Void". One bill, many items: the
// shared fields are typed once, service & tax are typed ONCE for the whole bill
// (base = sum of the subtotals of NAMED items) and the server splits them over
// the items cumulatively and computes `nominal`. The total is never sent.

/** Required fields, in the order the old screen named them (VOID_WAJIB, :2399-2403). */
export const VOID_WAJIB = [
  ['bill', 'Nomor Bill'],
  ['item', 'Nama Item'],
  ['penginput', 'Siapa yang Menginput'],
  ['salah', 'Kesalahan dari Siapa'],
  ['alasan', 'Alasan / Kronologi'],
] as const
export type VoidKunci = typeof VOID_WAJIB[number][0]

/** Datalist of "Kesalahan dari Siapa" — free text stays allowed (:2980). */
export const VOID_SALAH_OPSI = ['Kasir', 'Floor', 'Kitchen', 'Bar', 'Tamu', 'Sistem / POS'] as const

export interface VoidBaris {
  id: string
  tgl: string
  bill: string
  item: string
  penginput: string
  salah: string
  alasan: string
  nominal: number
  subtotal: number
  service: number
  tax: number
  /** False for rows from before subtotal/service/tax existed: 0 ≠ "no service". */
  rinci: boolean
  oleh: string
  olehId?: string
  dibuat: number
  /** Row version: If-Match for PUT and cancel. */
  diubah: number
  diubahOleh: string
  batalAt: number
  batalOleh: string
  batalAlasan: string
}

export interface VoidSetting { tax: number, service: number, diubah: number, oleh: string }
export const VOID_SETTING_BAWAAN: VoidSetting = { tax: 10, service: 5, diubah: 0, oleh: '' }

export interface VoidItemForm { item: string, sub: number }

/**
 * A percentage may be fractional (DECIMAL(6,3) on the server), with a comma.
 * Outside 0..100 or unreadable → 0: a negative percentage would LOWER a void.
 */
export function voidPct(v: unknown): number {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0
}

/** Service or tax of a bill: round(base × pct / 100). Tax is on the SUBTOTAL, not subtotal+service (71/74 POS rows). */
export const voidPersenDari = (sub: number, pct: unknown) => Math.round(num(sub) * voidPct(pct) / 100)

/** Item rows that carry a name; nameless rows are dropped, not refused (the server does the same). */
export const voidItemTerisi = (items: VoidItemForm[]) => items.filter(x => String(x.item || '').trim())

/** Base of service & tax: subtotals of NAMED items only — those are the only ones sent. */
export const voidSubtotal = (items: VoidItemForm[]) => voidItemTerisi(items).reduce((s, x) => s + num(x.sub), 0)

/** A cancelled row stays visible, struck through, and is never summed. */
export const voidAktif = (r: Pick<VoidBaris, 'batalAt'> | null | undefined) => !!r && !(num(r.batalAt) > 0)

export interface VoidFormIsi { bill: string, penginput: string, salah: string, alasan: string, items: VoidItemForm[] }

/** Keys still empty, in VOID_WAJIB order. `item` = not a single named item. */
export function voidKurang(f: VoidFormIsi): VoidKunci[] {
  const out: VoidKunci[] = []
  for (const [k] of VOID_WAJIB) {
    if (k === 'item') {
      if (!voidItemTerisi(f.items).length) out.push('item')
    }
    else if (!String(f[k] || '').trim()) {
      out.push(k)
    }
  }
  return out
}
export const voidLabel = (k: string) => VOID_WAJIB.find(([x]) => x === k)?.[1] ?? k

/**
 * The server's `details.kurang` holds LABELS; map them back to our keys so the
 * same boxes turn red. One list for both sides — a mismatch shows as a box
 * that is named in the message but never marked.
 */
export const voidKunciDariLabel = (labels: unknown): VoidKunci[] =>
  Array.isArray(labels) ? VOID_WAJIB.filter(([, l]) => labels.includes(l)).map(([k]) => k) : []

export interface GrupBill { kunci: string, bill: string, baris: VoidBaris[], hidup: VoidBaris[], total: number }

/**
 * Grouped per bill number WHEN DRAWN, keeping the server order. The key is
 * trimmed + upper-cased: bill numbers are typed, so "slmcl001 " and "SLMCL001"
 * are one bill — not two incidents.
 */
export function voidGrupBill(list: VoidBaris[]): GrupBill[] {
  const out: GrupBill[] = []
  const idx = new Map<string, number>()
  for (const r of list) {
    const k = String(r.bill || '').trim().toUpperCase() || '(tanpa bill)'
    let i = idx.get(k)
    if (i === undefined) {
      i = out.length
      idx.set(k, i)
      out.push({ kunci: k, bill: r.bill || '—', baris: [], hidup: [], total: 0 })
    }
    const g = out[i]!
    g.baris.push(r)
    if (voidAktif(r)) {
      g.hidup.push(r)
      g.total += num(r.nominal)
    }
  }
  return out
}

/** Live rows only: total, items, and DISTINCT bills (rows ≠ bills — 84 rows came from 17 bills). */
export function voidRingkas(list: VoidBaris[]) {
  const hidup = list.filter(voidAktif)
  return {
    total: hidup.reduce((s, r) => s + num(r.nominal), 0),
    item: hidup.length,
    bill: voidGrupBill(hidup).length,
    batal: list.length - hidup.length,
  }
}

/** First and last day of a month `YYYY-MM`. */
export function voidRentang(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const akhir = new Date(y!, m!, 0).getDate()
  return { dari: `${ym}-01`, sampai: `${ym}-${String(akhir).padStart(2, '0')}` }
}

/**
 * Editing a saved row: the "overridden" flag is DERIVED from its numbers. A row
 * whose service equals what the formula gives from its subtotal was formula-
 * made; old rows (no breakdown) read as overridden — editing their item name
 * must not silently add 15 %.
 */
export function voidManualDari(r: VoidBaris, set: Pick<VoidSetting, 'tax' | 'service'>) {
  const sub = num(r.rinci ? r.subtotal : r.nominal)
  return {
    sub,
    svc: num(r.service),
    tax: num(r.tax),
    svcManual: num(r.service) !== voidPersenDari(sub, set.service),
    taxManual: num(r.tax) !== voidPersenDari(sub, set.tax),
  }
}

// ---------------------------------------------------------------- Rokok (Stock)
// Old viewRokok / viewRokokRekap / viewRokokSet, deploy/cashier/index.html
// :3096-3409. `DB.rokok[date] = {items:{kunci:{in,out}}, by, at, log}` and
// `DB.rokok_items = [{k,n,lain}]`; both are sections of the kompas blob.

export interface RokokItem { k: string, n: string, lain?: boolean }

/**
 * Default item list (`ROKOK_BAWAAN`, :3096-3119). Only a STARTING POINT: once
 * the team ever saves the list, their list rules — later additions to this
 * default never sneak back in and change a sheet they already arranged.
 */
export const ROKOK_BAWAAN: readonly RokokItem[] = [
  { k: 'la_purple', n: 'LA Purple' },
  { k: 'la_mango', n: 'LA Mango' },
  { k: 'la_bold', n: 'LA Bold' },
  { k: 'la_ice', n: 'LA Ice' },
  { k: 'la_light', n: 'LA Light' },
  { k: 'djarum_super', n: 'Djarum Super' },
  { k: 'djarum_mild', n: 'Djarum Mild' },
  { k: 'insta', n: 'Insta' },
  { k: 'korek', n: 'Korek' },
  { k: 'dos_hermanos', n: 'Dos Hermanos' },
  { k: 'dos_h_rojo', n: 'Dos H. Rojo' },
  { k: 'dos_h_maduro', n: 'Dos H. Maduro' },
  { k: 'dos_h_corona', n: 'Dos H. Corona' },
  { k: 'dos_h_torito', n: 'Dos H. Torito' },
  { k: 'gold_seal_petit', n: 'Gold Seal Petit' },
  { k: 'gold_seal_senor', n: 'Gold Seal Senor' },
  { k: 'coin', n: 'Coin', lain: true },
  { k: 'eskrim', n: 'Eskrim', lain: true },
]

/** The list in force: stored when ever set, the default otherwise (`rokokItems`, :3132). */
export const daftarRokok = (items?: RokokItem[] | null): RokokItem[] =>
  (Array.isArray(items) && items.length ? items : ROKOK_BAWAAN.map(x => ({ ...x })))

/**
 * Key from a name (`rksKunci`, :3270): lowercase, non-alphanumeric → `_`, max
 * 40. Deliberately the same shape as the default keys, so a home-made list and
 * the default cannot be told apart by their keys.
 */
export function rksKunci(nama: unknown): string {
  return String(nama || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
}

export interface NilaiRokok { in: number, out: number }
export interface RokokHari {
  items?: Record<string, { in?: unknown, out?: unknown }>
  by?: string
  at?: number
  log?: JejakEntri[]
  [k: string]: unknown
}

/** `in`/`out` of one item, missing → 0 (`rokokItem`, :3142). */
export function rokokItem(rec: RokokHari | null | undefined, k: string): NilaiRokok {
  const x = rec?.items?.[k] || {}
  return { in: num(x.in), out: num(x.out) }
}

/**
 * Remaining stock BEFORE the chosen date (`rokokSisaAwal`, :3147): sums EVERY
 * earlier date, not just yesterday — recording is often skipped, and taking
 * only yesterday would read 0 after a blank day, as if stock ran out.
 */
export function rokokSisaAwal(rokok: Record<string, RokokHari> | null | undefined, items: RokokItem[], date: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of items) out[it.k] = 0
  for (const d of Object.keys(rokok || {}).filter(d => d < date)) {
    for (const it of items) {
      const v = rokokItem(rokok![d]!, it.k)
      out[it.k] = (out[it.k] ?? 0) + v.in - v.out
    }
  }
  return out
}

/**
 * Merge the sheet's inputs with what the day already holds (`:3233-3236`):
 * item keys that are NO LONGER in the list are kept as they are — a removed
 * item leaves numbers on earlier days, and building from scratch would erase
 * them silently the next time someone opens and saves that old date.
 */
export function rokokSimpanItems(items: RokokItem[], lama: RokokHari | null | undefined, nilai: Record<string, NilaiRokok>): Record<string, NilaiRokok> {
  const out: Record<string, NilaiRokok> = {}
  for (const k of Object.keys(lama?.items || {})) {
    if (!items.some(it => it.k === k)) out[k] = rokokItem(lama!, k)
  }
  for (const it of items) out[it.k] = nilai[it.k] ? { ...nilai[it.k]! } : { in: 0, out: 0 }
  return out
}

export interface BarisRekapRokok {
  k: string
  n: string
  lain: boolean
  awal: number
  masuk: number
  keluar: number
  akhir: number
  hariGerak: number
}

export interface RekapRokok {
  tgl: string[]
  baris: BarisRekapRokok[]
  tMasuk: number
  tKeluar: number
  tAkhir: number
  tAwal: number
}

/** One month per item (`rokokRekapBulan`, :3429-3445); `awal` reuses rokokSisaAwal. */
export function rokokRekapBulan(rokok: Record<string, RokokHari> | null | undefined, items: RokokItem[], mk: string): RekapRokok {
  const tgl = Object.keys(rokok || {}).filter(d => d.slice(0, 7) === mk).sort()
  const awal = rokokSisaAwal(rokok, items, `${mk}-01`)
  const baris: BarisRekapRokok[] = items.map((it) => {
    let masuk = 0
    let keluar = 0
    let hariGerak = 0
    for (const d of tgl) {
      const v = rokokItem(rokok![d]!, it.k)
      masuk += v.in
      keluar += v.out
      if (v.in || v.out) hariGerak++
    }
    return { k: it.k, n: it.n, lain: !!it.lain, awal: awal[it.k] ?? 0, masuk, keluar, akhir: (awal[it.k] ?? 0) + masuk - keluar, hariGerak }
  })
  return {
    tgl,
    baris,
    tMasuk: baris.reduce((s, b) => s + b.masuk, 0),
    tKeluar: baris.reduce((s, b) => s + b.keluar, 0),
    tAkhir: baris.reduce((s, b) => s + b.akhir, 0),
    tAwal: baris.reduce((s, b) => s + b.awal, 0),
  }
}

/** Days that hold a number for one item — for the "Buang" confirmation (:3307-3310). */
export function rokokHariItem(rokok: Record<string, RokokHari> | null | undefined, k: string): number {
  let hari = 0
  for (const d of Object.keys(rokok || {})) {
    const v = rokokItem(rokok![d]!, k)
    if (v.in || v.out) hari++
  }
  return hari
}
