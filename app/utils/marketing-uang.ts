// Marketing — the money of an event, ported AS IS from the old client
// (docs/migrasi/marketing.md H: "Rumus uang JANGAN ditulis ulang dari nol").
//
// Source: laksamana-office deploy/marketing/index.html
//   :4457-4600  ynBool, paxDariTeks … eventFinance, dpLabel, invStatus
//   :8470-8494  rinciTotalBayar, rinciAktif
//   :8192-8210  rinciSeedRows
//   :11440-11520 FREE_TEMPLATE_BAWAAN, bacaTemplateBaris, rincianPenawaran
//   :2338-2595  normalizeState — the event migrations that change a total
//   :5160-5215  pendapatanPerBulan, papanClosing
//
// Pure: no API, no Vue. `settings` = SETTING_MKT_BAWAAN merged under the stored
// document, as normalizeState did.
import type { EventMkt, SettingsMkt } from '~/utils/marketing'
import { STATUS_OMSET_MKT, hariAntaraMkt } from '~/utils/marketing'

type Baris = { desc?: unknown, jumlah?: unknown, harga?: unknown, jenis?: string }
type Detail = Record<string, unknown>

const dt = (ev: EventMkt): Detail => (ev.detail ?? {}) as Detail
const n = (v: unknown) => +(v as number) || 0

/** Yes/No value → boolean, with a default when never answered (:4459). */
export function ynBool(val: unknown, def?: boolean): boolean {
  if (val && typeof val === 'object' && 'v' in val) return (val as { v: unknown }).v === true
  if (typeof val === 'boolean') return val
  return def === true
}

/** Free-text guest count: every number in it is added ("150 + 2 OTS" = 152) (:4482-4485). */
export function paxDariTeks(v: unknown): number {
  const angka = String(v ?? '').match(/\d+/g)
  return angka ? angka.reduce((a, x) => a + (+x || 0), 0) : 0
}

/** F&B pax: Kasir's estimate + OTS first, then D.1 pax, then the list pax (:4486). */
export const fbPax = (ev: EventMkt) => paxDariTeks(dt(ev).estimasiOTS) || n(dt(ev).pax) || n(ev.pax)
/** F&B price per pax: the deal price first, then the budget (:4487). */
export const fbHargaPax = (ev: EventMkt) => n(dt(ev).dealPax) || n(dt(ev).budgetPax)
export const fbOtomatis = (ev: EventMkt) => Math.round(fbPax(ev) * fbHargaPax(ev))

/** fbManual = typed override; empty means "follow the formula", a typed 0 is kept (:4504). */
export function fbDitimpa(ev: EventMkt): boolean {
  const v = dt(ev).fbManual
  return v !== '' && v != null && !Number.isNaN(+(v as number))
}

/** Sum of the deal-price table, Jumlah × Harga (:4506-4510). */
export function fbDealTotal(ev: EventMkt): number {
  const rows = dt(ev).fbDeal
  if (!Array.isArray(rows)) return 0
  return rows.reduce((a: number, r: Baris) => a + n(r.jumlah) * n(r.harga), 0)
}
export const fbDealAktif = (ev: EventMkt) => ynBool(dt(ev).fbDealOn, false) && fbDealTotal(ev) > 0

/** F&B cost, most deliberate first: typed → deal table → pax × price → old biayaFB (:4515-4529). */
export function eventFbCost(ev: EventMkt): number {
  const d = dt(ev)
  if (fbDitimpa(ev)) return n(d.fbManual)
  if (fbDealAktif(ev)) return fbDealTotal(ev)
  const pax = fbPax(ev)
  const bp = fbHargaPax(ev)
  return bp > 0 ? Math.round(pax * bp) : n(d.biayaFB)
}

/** What the Rincian table bills: (jumlah || 1) × harga on 'bayar' rows (:8470-8478). */
export function rinciTotalBayar(ev: EventMkt): number {
  const rows = dt(ev).rincianItem
  if (!Array.isArray(rows)) return 0
  return rows.reduce((a: number, r: Baris) => a + ((r.jenis || 'bayar') === 'bayar' ? (n(r.jumlah) || 1) * n(r.harga) : 0), 0)
}
/** Only the presence of rows decides now — `rincianOn` no longer does (:8491-8494). */
export function rinciAktif(ev: EventMkt): boolean {
  const r = dt(ev).rincianItem
  return Array.isArray(r) && r.length > 0
}

/** Billed lines: the Rincian table, else the old boxes as a safety net (:4530-4548). */
export function eventSubtotal(ev: EventMkt): number {
  const d = dt(ev)
  if (rinciAktif(ev)) return rinciTotalBayar(ev)
  return eventFbCost(ev) + n(d.sewaVenue) + n(d.biayaTeknis) + n(d.biayaLain)
}

export interface UangEventMkt {
  sub: number
  fb: number
  disc: number
  afterDisc: number
  svcOn: boolean
  service: number
  taxPct: number
  taxInc: boolean
  tax: number
  grand: number
  dpPct: number
  dp: number
  dpDariNominal: boolean
  bayarTercatat: number
  dpCentang: boolean
  dpDiakui: number
  dpTertutupBayar: boolean
  paid: number
  remaining: number
}

/**
 * The money of an event (:4549-4597, marketing.md D.4):
 * discount → service (optional) → PB1 (inclusive or on top) → DP (nominal
 * first, else % of grand) → paid = recorded payments + the "DP sudah dibayar"
 * tick counted only as the part not yet recorded (so it can never double).
 */
export function eventFinance(ev: EventMkt, st: SettingsMkt): UangEventMkt {
  const d = dt(ev)
  const fb = eventFbCost(ev)
  const sub = eventSubtotal(ev)
  const disc = n(d.diskon)
  const afterDisc = Math.max(0, sub - disc)
  const svcOn = ynBool(d.svcApply, true)
  const service = svcOn ? Math.round(afterDisc * st.serviceCharge / 100) : 0
  const taxPct = +st.pb1 || 0
  const taxInc = ynBool(d.taxInclude, false)
  let tax: number
  let grand: number
  if (taxInc) {
    grand = afterDisc + service
    tax = Math.round(grand * taxPct / (100 + taxPct))
  }
  else {
    tax = Math.round((afterDisc + service) * taxPct / 100)
    grand = afterDisc + service + tax
  }
  const dpNom = n(d.depositNominal)
  const dpPct = ev.dpPercent || st.dpPercent
  const dp = dpNom > 0 ? dpNom : Math.round(grand * dpPct / 100)
  const dpDariNominal = dpNom > 0
  const bayarTercatat = (ev.payments ?? []).reduce((a, p) => a + n(p.amount), 0)
  const dpCentang = ynBool(d.dpPaid, false)
  const dpDiakui = dpCentang ? Math.max(0, dp - bayarTercatat) : 0
  const paid = bayarTercatat + dpDiakui
  const remaining = Math.max(0, grand - paid)
  const dpTertutupBayar = dpCentang && dp > 0 && dpDiakui === 0 && bayarTercatat >= dp
  return { sub, fb, disc, afterDisc, svcOn, service, taxPct, taxInc, tax, grand, dpPct, dp, dpDariNominal, bayarTercatat, dpCentang, dpDiakui, dpTertutupBayar, paid, remaining }
}

/** "DP" when it came from a nominal, "DP 50%" only when the % really made it (:4599). */
export const dpLabel = (f?: UangEventMkt | null) => (f?.dpDariNominal ? 'DP' : `DP ${f?.dpPct ?? 0}%`)

export const STATUS_INVOICE_MKT = ['Draft', 'Sent', 'Pending', 'Paid', 'Overdue'] as const

/** Invoice status (:4625-4632): no payment within H-7 of a Confirmed/Deal event = Overdue. */
export function invStatus(ev: EventMkt, st: SettingsMkt, hari: string): string {
  const f = eventFinance(ev, st)
  if (f.grand === 0) return 'Draft'
  if (f.remaining <= 0) return 'Paid'
  if (f.paid > 0) return 'Pending'
  if (ev.tanggal && hariAntaraMkt(hari, ev.tanggal) < 7 && ['Confirmed', 'Deal'].includes(ev.status)) return 'Overdue'
  return ev.invoiceSent ? 'Sent' : 'Draft'
}

// ---------------------------------------------------------------- offer lines

/** The general FREE template (:11440-11446). `{jika-…}` markers skip a line when that item is billed. */
export const FREE_TEMPLATE_BAWAAN = [
  'Biaya Sewa Venue (AC & Listrik) {jika-sewa-gratis}',
  'Videotron (6 x 3 meter, Lighting, Soundsystem, Panggung, dll) {jika-teknis-gratis}',
  'Penyesuaian Layout',
  'Operator Teknis (Audio & Multimedia)',
  'Koordinasi Full Event (Before – During – After)',
].join('\n')

/** Multi-line text → lines, blanks dropped, trimmed (:11450-11455). */
export function bacaTemplateBaris(v: unknown): string[] {
  const s = Array.isArray(v) ? v.join('\n') : String(v ?? '')
  return s.split(/\r?\n/).map(x => x.trim()).filter(x => x.length > 0)
}

export interface BarisRincianMkt { desc: string, qty: number | null, unit: number | null, total: number, gratis?: boolean, tbc?: boolean, fnb?: boolean }

/** The lines of the offer / invoice (:11461-11530). The Rincian table, when filled, is the only source. */
export function rincianPenawaran(ev: EventMkt, st: Partial<SettingsMkt> = {}): BarisRincianMkt[] {
  const d = dt(ev)
  const out: BarisRincianMkt[] = []
  const pax = n(ev.pax)
  if (rinciAktif(ev)) {
    for (const r of d.rincianItem as Baris[]) {
      const jenis = r.jenis || 'bayar'
      const desc = String(r.desc ?? '').trim()
      if (!desc) continue
      if (jenis === 'free') {
        out.push({ desc, qty: null, unit: null, total: 0, gratis: true })
        continue
      }
      if (jenis === 'tbc') {
        out.push({ desc, qty: null, unit: null, total: 0, tbc: true })
        continue
      }
      const jml = n(r.jumlah)
      const hrg = n(r.harga)
      out.push({ desc, qty: jml || null, unit: jml ? (hrg || null) : null, total: (jml || 1) * hrg })
    }
    return out
  }
  if (!fbDitimpa(ev) && fbDealAktif(ev)) {
    for (const r of d.fbDeal as (Baris & { nama?: string })[]) {
      const jml = n(r.jumlah)
      const hrg = n(r.harga)
      if (!jml && !hrg) continue
      out.push({ desc: `Biaya Konsumsi Event: ${r.nama || '—'}`, qty: jml || null, unit: hrg || null, total: jml * hrg, fnb: true })
    }
  }
  else {
    const fb = eventFbCost(ev)
    if (fb) {
      const hp = fbHargaPax(ev)
      const px = fbPax(ev)
      const cocok = !fbDitimpa(ev) && hp > 0 && px > 0 && Math.round(px * hp) === fb
      out.push({ desc: `Biaya Konsumsi Event${pax ? ` (${pax} pax)` : ''}`, qty: cocok ? px : null, unit: cocok ? hp : null, total: fb, fnb: true })
    }
  }
  if (n(d.sewaVenue)) out.push({ desc: 'Biaya Sewa Venue', qty: null, unit: null, total: n(d.sewaVenue) })
  if (n(d.biayaTeknis)) out.push({ desc: 'Sound, Lighting & Kebutuhan Teknis', qty: null, unit: null, total: n(d.biayaTeknis) })
  if (n(d.biayaLain)) out.push({ desc: String(d.biayaLainKet || 'Biaya Lain-lain'), qty: null, unit: null, total: n(d.biayaLain) })
  for (const t of bacaTemplateBaris(d.itemTbc)) out.push({ desc: t, qty: null, unit: null, total: 0, tbc: true })
  const milik = bacaTemplateBaris(d.itemFree)
  const dipakai = milik.length ? milik : bacaTemplateBaris(st.freeTemplate || FREE_TEMPLATE_BAWAAN)
  for (const t of dipakai) {
    let lewati = false
    const teks = t
      .replace(/\{jika-sewa-gratis\}/gi, () => {
        if (n(d.sewaVenue)) lewati = true
        return ''
      })
      .replace(/\{jika-teknis-gratis\}/gi, () => {
        if (n(d.biayaTeknis)) lewati = true
        return ''
      })
      .trim()
    if (lewati || !teks) continue
    out.push({ desc: teks, qty: null, unit: null, total: 0, gratis: true })
  }
  return out
}

/** Offer lines → Rincian rows with the SAME total ("qty empty means one", :8192-8210). */
export function rinciSeedRows(ev: EventMkt, st: Partial<SettingsMkt> = {}): Baris[] {
  const bayangan: EventMkt = { ...ev, detail: { ...dt(ev), rincianOn: false, rincianItem: [] } }
  return rincianPenawaran(bayangan, st).map((it) => {
    if (it.gratis) return { desc: it.desc, jumlah: 0, harga: 0, jenis: 'free' }
    if (it.tbc) return { desc: it.desc, jumlah: 0, harga: 0, jenis: 'tbc' }
    const pakaiQty = it.qty && it.unit
    return { desc: it.desc, jumlah: pakaiQty ? it.qty : 0, harga: pakaiQty ? it.unit : (it.total || 0), jenis: 'bayar' }
  })
}

// ---------------------------------------------------------------- reading an event as the old app did

/** Retired PIC boxes and where their name went (:2378-2400). */
const LEBUR_PIC: [string, string][] = [['bPIC', 'kPIC'], ['picKonsumsi', 'kPIC'], ['picBayar', 'refundPIC'], ['picTamu', 'fPIC'], ['picRegis', 'fPIC']]

/**
 * An event as normalizeState shaped it on every load (:2357-2595), IN MEMORY
 * only — the row on the server is untouched until someone saves it. Events
 * never re-saved since a migration would otherwise show a different Grand
 * Total here than in the old app:
 *   - Negotiation → Quotation Terkirim
 *   - retired PIC boxes merged into kPIC / refundPIC / fPIC
 *   - the deal-price table moved into Rincian (total unchanged)
 *   - a Rincian table without the F&B line gets "Biaya Konsumsi Event" on top
 *   - Rincian seeded from the old boxes; boxes win when the two disagree
 */
export function normEventMkt(e: EventMkt, st: Partial<SettingsMkt>): EventMkt {
  const ev: EventMkt = structuredClone(e)
  if (ev.pipeCol === 'Negotiation') ev.pipeCol = 'Quotation Terkirim'
  if (ev.status === 'Negotiation') ev.status = 'Quotation Terkirim'
  if (!ev.detail || typeof ev.detail !== 'object') ev.detail = {}
  const d = ev.detail as Detail
  for (const [lama, baru] of LEBUR_PIC) {
    const a = String(d[lama] ?? '').trim()
    if (!a) continue
    const b = String(d[baru] ?? '').trim()
    if (!b) d[baru] = a
    else if (b !== a && !b.includes(a)) d[baru] = `${b} / ${a}`
  }
  if (ynBool(d.fbDealOn, false)) {
    if (!(Array.isArray(d.rincianItem) && d.rincianItem.length)) {
      const baris = rincianPenawaran(ev).map((it) => {
        if (it.gratis) return { desc: it.desc, jumlah: 0, harga: 0, jenis: 'free' }
        if (it.tbc) return { desc: it.desc, jumlah: 0, harga: 0, jenis: 'tbc' }
        const pakaiQty = it.qty && it.unit
        return { desc: it.desc, jumlah: pakaiQty ? it.qty : 0, harga: pakaiQty ? it.unit : (it.total || 0), jenis: 'bayar' }
      })
      if (baris.length) {
        d.rincianItem = baris
        d.rincianOn = true
      }
    }
    d.fbDealOn = false
  }
  if (ynBool(d.rincianOn, false) && Array.isArray(d.rincianItem) && d.rincianItem.length
    && !(d.rincianItem as Baris[]).some(r => /konsumsi/i.test(String(r?.desc ?? '')))) {
    const fb = eventFbCost(ev)
    if (fb) {
      const hp = fbHargaPax(ev)
      const px = fbPax(ev)
      const cocok = !fbDitimpa(ev) && hp > 0 && px > 0 && Math.round(px * hp) === fb
      ;(d.rincianItem as Baris[]).unshift({ desc: `Biaya Konsumsi Event${n(ev.pax) ? ` (${n(ev.pax)} pax)` : ''}`, jumlah: cocok ? px : 0, harga: cocok ? hp : fb, jenis: 'bayar' })
    }
  }
  const punyaBaris = Array.isArray(d.rincianItem) && d.rincianItem.length > 0
  if (!(punyaBaris && ynBool(d.rincianOn, false))) {
    const seed = rinciSeedRows(ev, st)
    if (punyaBaris) {
      const totalKotak = eventFbCost(ev) + n(d.sewaVenue) + n(d.biayaTeknis) + n(d.biayaLain)
      if (rinciTotalBayar(ev) !== totalKotak) {
        d.rincianItemDraft = d.rincianItem
        d.rincianItem = seed
      }
      d.rincianOn = true
    }
    else if (seed.length) {
      d.rincianItem = seed
      d.rincianOn = true
    }
  }
  return ev
}

// ---------------------------------------------------------------- dashboard sums

/** Revenue per month for the last `jumlah` months incl. this one (:5164-5176). */
export function pendapatanPerBulan(events: EventMkt[], st: SettingsMkt, hari: string, jumlah = 6) {
  const out: { kunci: string, nilai: number, kini: boolean }[] = []
  const y = +hari.slice(0, 4)
  const m = +hari.slice(5, 7) - 1
  for (let i = jumlah - 1; i >= 0; i--) {
    const x = new Date(y, m - i, 1)
    const kunci = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
    const nilai = events
      .filter(e => STATUS_OMSET_MKT.includes(e.status) && String(e.tanggal ?? '').slice(0, 7) === kunci)
      .reduce((a, e) => a + eventFinance(e, st).grand, 0)
    out.push({ kunci, nilai, kini: i === 0 })
  }
  return out
}

/** Who closed how much this month, biggest first (:5180-5199). PIC '-' = no PIC. */
export function papanClosing(events: EventMkt[], st: SettingsMkt, bulan: string) {
  const per = new Map<string, { n: number, v: number }>()
  for (const e of events) {
    if (!STATUS_OMSET_MKT.includes(e.status) || String(e.tanggal ?? '').slice(0, 7) !== bulan) continue
    const k = e.mktPIC || '-'
    const x = per.get(k) ?? { n: 0, v: 0 }
    x.n++
    x.v += eventFinance(e, st).grand
    per.set(k, x)
  }
  return [...per.entries()].map(([id, x]) => ({ id, ...x })).sort((a, b) => b.v - a.v)
}

/** Total spending of a client = grand of its FINISHED events (:5596). */
export const belanjaClientMkt = (events: EventMkt[], st: SettingsMkt, id: string) =>
  events.filter(e => e.clientId === id && e.status === 'Event Done').reduce((a, e) => a + eventFinance(e, st).grand, 0)
