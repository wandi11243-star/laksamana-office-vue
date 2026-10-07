// ONE source for the omset blob's day rows: the row shape, the derived numbers
// (gross/net/tagihan/avg/items) and the Input Omset Harian validation. The old
// Office repeated these in several files (`omset:1033-1041`, kas, brankas) and
// finance.md F.5/F.19 calls the twins out — import, never copy.
//
// Pure and import-free so `tools/uji-kompas.mjs` can import it with plain Node.

/** Same as the old `num()`: digits and minus only, anything else is 0. */
export function kNum(v: unknown): number {
  const n = Number.parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** One breakdown row inside `daily[].bd.{marketing,event,kasir}`. */
export interface BarisBd {
  kasirId?: string
  amount?: unknown
  disc?: unknown
  off?: boolean
  tiket?: boolean
  shift?: unknown
  dw?: unknown
  menuFix?: string
  payGroup?: boolean
  ob?: boolean
  obAmount?: unknown
  obTax?: unknown
  obService?: unknown
  obKasirId?: string
  eventName?: string
  picId?: string
  srcId?: string
  srcPic?: string
  tax?: unknown
  service?: unknown
  [k: string]: unknown
}

export interface BdB {
  marketing?: BarisBd[]
  event?: BarisBd[]
  kasir?: BarisBd[]
  self?: { amount?: unknown, disc?: unknown, [k: string]: unknown }
  abaikan?: string[]
  [k: string]: unknown
}

/** One trail row of a day (`log`) or of a breakdown (`bdLog`). */
export interface JejakHari {
  by: string
  at: number
}

/** One `daily[]` row of the kompas blob. */
export interface BarisHarian {
  date: string
  food?: unknown
  bev?: unknown
  lainnya?: unknown
  discount?: unknown
  service_charge?: unknown
  tax?: unknown
  traffic?: unknown
  bill?: unknown
  qty_food?: unknown
  qty_bev?: unknown
  qty_others?: unknown
  bd?: BdB
  bdValid?: boolean
  bdLog?: JejakHari[]
  log?: JejakHari[]
  [k: string]: unknown
}

/** `'2026-10-05'` → `'2026-10'`. */
export const monthKeyOf = (date: unknown) => String(date || '').slice(0, 7)

/** Σ food + bev + lainnya (:1033). */
export const grossOf = (d: Pick<BarisHarian, 'food' | 'bev' | 'lainnya'>) =>
  kNum(d.food) + kNum(d.bev) + kNum(d.lainnya)

/** Gross − discount (:1034). Tax & service sit OUTSIDE the omset. */
export const netOf = (d: Pick<BarisHarian, 'food' | 'bev' | 'lainnya' | 'discount'>) =>
  grossOf(d) - kNum(d.discount)

/** Service + tax, billed to the guest but never part of the omset (:1038). */
export const taxSvcOf = (d: Pick<BarisHarian, 'service_charge' | 'tax'>) =>
  kNum(d.service_charge) + kNum(d.tax)

/** What the guest actually pays: net + service + tax (:1039). */
export const tagihanOf = (d: Parameters<typeof netOf>[0] & Pick<BarisHarian, 'service_charge' | 'tax'>) =>
  netOf(d) + taxSvcOf(d)

/** Net ÷ bills; 0 when there are no bills (:1040). */
export const avgSpendOf = (d: Parameters<typeof netOf>[0] & Pick<BarisHarian, 'bill'>) => {
  const b = kNum(d.bill)
  return b > 0 ? netOf(d) / b : 0
}

/** Items sold (:1041). */
export const itemsOf = (d: Pick<BarisHarian, 'qty_food' | 'qty_bev' | 'qty_others'>) =>
  kNum(d.qty_food) + kNum(d.qty_bev) + kNum(d.qty_others)

const KOLOM_INPUT = ['food', 'bev', 'lainnya', 'discount', 'service_charge', 'tax', 'traffic', 'bill', 'qty_food', 'qty_bev', 'qty_others'] as const

/**
 * Input Omset Harian validation (`saveDaily`, omset :1490-1510). The Report
 * Daily difference gate was REMOVED 4 Aug 2026: a day with a receivable is
 * ALWAYS off by the bon, and locking the save only makes people invent numbers.
 * The difference is warned about, never enforced.
 */
export function validasiHarian(rec: Pick<BarisHarian, typeof KOLOM_INPUT[number]>): string[] {
  const errs: string[] = []
  for (const k of KOLOM_INPUT) if (kNum(rec[k]) < 0) errs.push('Nilai tidak boleh negatif.')
  if (grossOf(rec) === 0) errs.push('Pendapatan tidak boleh kosong.')
  if (kNum(rec.discount) > grossOf(rec)) errs.push('Diskon melebihi total pendapatan.')
  if (kNum(rec.traffic) < kNum(rec.bill)) errs.push('Traffic harus ≥ jumlah Bill.')
  return [...new Set(errs)]
}

// ---------------------------------------------------------------- Rekap Penjualan
// The payment groups and the day formula (`rkHitung`, kas :1868-2174). ONE
// source: Rekap Penjualan (Kas) and the Brankas balances both need it — the old
// Office had two copies (`RK_GRUP`, `aktGrup` ≡ `rkHitung`).

export interface GrupRekap { k: string, n: string, pos: string[], akt: string[], mdr?: string }

export const RK_GRUP: readonly GrupRekap[] = [
  { k: 'cash', n: 'Cash', pos: ['cash'], akt: ['cash'] },
  { k: 'qr_order', n: 'QR Order', pos: ['qris_esb'], akt: ['qris_esb'], mdr: 'qr_order' },
  { k: 'edc_bri', n: 'EDC BRI', pos: ['edc_bri'], akt: ['edc_bri'], mdr: 'edc_bri' },
  { k: 'qris_bri', n: 'QRIS BRI', pos: ['qris_bri'], akt: ['qris_bri'], mdr: 'qris_bri' },
  { k: 'edc_mandiri', n: 'EDC Mandiri', pos: ['edc_mandiri'], akt: ['edc_mandiri'], mdr: 'edc_mandiri' },
  { k: 'qris_mandiri', n: 'QRIS Mandiri', pos: ['qris_mandiri'], akt: ['qris_mandiri'], mdr: 'qris_mandiri' },
  { k: 'edc_bca', n: 'EDC BCA', pos: ['edc_bca'], akt: ['edc_bca'], mdr: 'edc_bca' },
  { k: 'qris_bca', n: 'QRIS BCA', pos: ['qris_bca'], akt: ['qris_bca'], mdr: 'qris_bca' },
  { k: 'transfer', n: 'Transfer', pos: ['transfer_uob'], akt: ['transfer_uob'] },
  { k: 'gofood', n: 'Gofood', pos: ['gofood'], akt: ['gofood'], mdr: 'gofood' },
  { k: 'grabfood', n: 'Grabfood', pos: ['grabfood'], akt: ['grabfood'], mdr: 'grabfood' },
  { k: 'tiktokgo', n: 'TikTok Go', pos: ['tiktokgo'], akt: ['tiktokgo'], mdr: 'tiktokgo' },
  { k: 'error', n: 'Error', pos: ['error_customer', 'error_floor', 'error_kasir', 'error_bar'], akt: ['error_customer', 'error_floor', 'error_kasir', 'error_bar'] },
]

/** Every method that sums into Rekap Aktual — the whole Report Daily, no exceptions. */
export const RK_PAY: readonly string[] = (() => {
  const out: string[] = []
  for (const g of RK_GRUP) for (const k of g.akt) if (!out.includes(k)) out.push(k)
  for (const k of ['compliment', 'member_dep', 'voucher', 'error_kitchen']) if (!out.includes(k)) out.push(k)
  return out
})()

export const rkPay = (rec: BarisHarian | null | undefined, k: string, f: 'pos' | 'actual') => {
  const tabel = (rec?.pay ?? {}) as Record<string, { pos?: unknown, actual?: unknown }>
  const p = tabel[k] ?? {}
  return kNum(p[f])
}

export interface RekapUbah {
  mdr?: Record<string, number | string>
  aktual?: Record<string, number | string>
  mdrman?: Record<string, number | string>
  setor?: boolean
  tanda?: Record<string, boolean>
}

export interface GrupHitung {
  pos: number
  kotor: number
  mdr: number
  akt: number
  diketik: boolean
  punyaPos: boolean
  lebih: number
  mdrMan: number | null
  berlebih: boolean
  selisih: number | null
  adjust: number
}

/**
 * One day of the sales recap (`rkHitung`, :2108-2174). Since 21 Aug 2026 the
 * typist's figure is the ACTUAL; MDR becomes the difference. When the actual is
 * ABOVE the gross, one of the two must be typed — the typed MDR wins and the
 * excess is computed (`akt − kotor + mdr`).
 */
export function hitungRekapHari(
  rec: BarisHarian | null | undefined,
  omset: BarisHarian | null | undefined,
  piutang: { date?: string, status?: string, lunasDate?: string, nominal?: unknown }[] | null | undefined,
  date: string,
  ubah?: RekapUbah | null,
) {
  const sisi = (keys: string[], f: 'pos' | 'actual') => keys.reduce((s, k) => s + rkPay(rec, k, f), 0)
  const g: Record<string, GrupHitung> = {}
  for (const x of RK_GRUP) {
    const pos = sisi(x.pos, 'pos')
    const kotor = sisi(x.akt, 'actual')
    let akt = kotor
    let mdr = 0
    let diketik = false
    let lebih = 0
    let mdrMan: number | null = null
    let berlebih = false
    if (x.mdr) {
      const ua = ubah?.aktual?.[x.mdr]
      let ketik: number | null = null
      if (ua !== undefined) ketik = ua === '' ? null : kNum(ua)
      else {
        const a = (rec?.aktual ?? {}) as Record<string, unknown>
        if (a[x.mdr] !== undefined && a[x.mdr] !== '') ketik = kNum(a[x.mdr])
      }
      diketik = ketik !== null
      const um = ubah?.mdrman?.[x.mdr]
      if (um !== undefined) mdrMan = um === '' ? null : kNum(um)
      else {
        const m = (rec?.mdrManual ?? {}) as Record<string, unknown>
        if (m[x.mdr] !== undefined && m[x.mdr] !== '') mdrMan = kNum(m[x.mdr])
      }
      const stored = (rec?.mdr ?? {}) as Record<string, unknown>
      const mdrLama = ubah?.mdr?.[x.mdr] !== undefined ? kNum(ubah.mdr[x.mdr]) : kNum(stored[x.mdr])
      akt = diketik ? ketik! : kotor - mdrLama
      berlebih = akt > kotor
      mdr = berlebih || mdrMan !== null ? (mdrMan ?? 0) : kotor - akt
      lebih = akt - kotor + mdr
    }
    g[x.k] = {
      pos,
      kotor,
      mdr,
      akt,
      diketik,
      punyaPos: x.pos.length > 0,
      lebih,
      mdrMan,
      berlebih,
      selisih: x.pos.length ? pos - akt : null,
      adjust: x.pos.length ? pos - akt : akt,
    }
  }
  const mdrTotal = RK_GRUP.reduce((s, x) => s + (x.mdr ? g[x.k]!.mdr : 0), 0)
  const kotorMdr = RK_GRUP.reduce((s, x) => s + (x.mdr ? g[x.k]!.kotor : 0), 0)
  const lebihTotal = RK_GRUP.reduce((s, x) => s + (x.mdr ? (g[x.k]!.lebih || 0) : 0), 0)
  const setoran = RK_PAY.reduce((s, k) => s + rkPay(rec, k, 'actual'), 0)
  const totPos = RK_PAY.reduce((s, k) => s + rkPay(rec, k, 'pos'), 0)
  const rekapAkt = setoran - mdrTotal + lebihTotal
  const j = omset
    ? { ada: true, net: netOf(omset), svc: kNum(omset.service_charge), tax: kNum(omset.tax), disc: kNum(omset.discount), tagihan: tagihanOf(omset) }
    : { ada: false, net: 0, svc: 0, tax: 0, disc: 0, tagihan: 0 }
  let baru = 0
  let lunas = 0
  for (const b of piutang || []) {
    if (!b) continue
    if (b.date === date) baru += kNum(b.nominal)
    if (b.status === 'lunas' && b.lunasDate === date) lunas += kNum(b.nominal)
  }
  const bon = { baru, lunas, koreksi: lunas - baru, ada: baru !== 0 || lunas !== 0 }
  const selisihTotal = j.tagihan - rekapAkt + bon.koreksi
  return {
    g,
    j,
    bon,
    mdrTotal,
    lebihTotal,
    kotorMdr,
    setoran,
    totPos,
    rekapAkt,
    jual: j.tagihan,
    selisihTotal,
    comp: rkPay(rec, 'compliment', 'actual'),
    mdep: rkPay(rec, 'member_dep', 'actual'),
    vou: rkPay(rec, 'voucher', 'actual'),
    errCust: rkPay(rec, 'error_customer', 'actual'),
    errKit: rkPay(rec, 'error_kitchen', 'actual'),
    adaData: !!rec || j.tagihan !== 0,
    /** Has cashier deposits, has omset, but service & tax are both zero. */
    tanpaSvcTax: setoran > 0 && j.ada && j.net > 0 && j.svc + j.tax === 0,
  }
}
