// POS ESB -> rows the Excel parser already reads (deploy/analytics/index.html
// :7959 esbKeBaris, :8082 esbTarikRentang). There is no second parser: the
// bills are flattened into Detail Report columns and go through
// uraiLaporanPos, so every rule (unique bills, change, size rows, EVENT,
// neighbour months) applies unchanged. Pure, so tools/uji-analytics.mjs runs it.
//
// ESB field names that fail silently when swapped:
//   otherTax / otherTaxValue = SERVICE CHARGE (5%)
//   vat / vatValue           = PB1 TAX (10%)
import type { BarisTabel } from './xlsx-baca'

export const ESB_KOLOM = ['Sales Date', 'Order Time', 'Sales Number', 'Total After Bill Discount', 'Nett Sales',
  'Subtotal', 'Menu Discount', 'Service Charge', 'Tax', 'Pax Total', 'Visit Purpose', 'Table Name',
  'Payment Method', 'Waiter', 'Cashier', 'Additional Info', 'Menu Notes', 'Menu', 'Qty', 'Menu Total',
  'Menu Code', 'Menu Category', 'Menu Category Detail']
const ESB_BATAL_RE = /cancel|void|batal/i
const esbJam = (v: unknown) => String(v ?? '').match(/[T ](\d{2}:\d{2}(?::\d{2})?)/)?.[1] ?? ''
const num = (v: unknown) => Number(v) || 0

type Obj = Record<string, unknown>
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as Obj[] : [])

/** One method as is; a split payment as "QRIS (15.000),CASH (30.000)" — the shape pecahBayar reads. */
export function esbBayar(pays: unknown): string {
  const ps = arr(pays).filter(p => p.paymentMethodName)
  if (ps.length === 1) return String(ps[0]!.paymentMethodName).trim()
  return ps.map(p => `${String(p.paymentMethodName).trim()} (${Math.round(num(p.paymentAmount)).toLocaleString('id-ID')})`).join(',')
}

export interface EsbInfo { bill: number, billBatal: number, menuBatal: number }

/**
 * Bills -> header row + one row per menu (packages right under their menu as
 * "<NAME> (PACKAGE)", so the size-row rule works). The bill grand total is
 * spread over its rows by their totals, so rows sum to the bill exactly.
 * Cancelled/void bills and menus are dropped and counted.
 */
export function esbKeBaris(bills: unknown[]): { rows: BarisTabel[], info: EsbInfo } {
  const kepala: BarisTabel = {}
  ESB_KOLOM.forEach((k, i) => {
    kepala[`c${i}`] = k
  })
  const rows: BarisTabel[] = [kepala]
  const info: EsbInfo = { bill: 0, billBatal: 0, menuBatal: 0 }
  for (const B of bills as Obj[]) {
    if (!B || !B.salesNum) continue
    if (ESB_BATAL_RE.test(String(B.statusName ?? ''))) {
      info.billBatal++
      continue
    }
    info.bill++
    const mentah: { M: Obj, nama: string, qty: number, nilai: number, total: number, svc: number, tax: number, disc: number, kode: string, catatan: string, waiter: string, jam: string }[] = []
    for (const M of arr(B.salesMenus)) {
      if (ESB_BATAL_RE.test(String(M.statusName ?? ''))) {
        info.menuBatal++
        continue
      }
      const ex = arr(M.extras).reduce((a, x) => a + num(x.total), 0)
      const exNil = arr(M.extras).reduce((a, x) => a + num(x.price) * num(x.qty), 0)
      const jam = esbJam(M.createdDate) || esbJam(B.salesDateIn)
      mentah.push({
        M, nama: String(M.menuName ?? '').trim(), qty: num(M.qty),
        nilai: num(M.price) * num(M.qty) - num(M.discountValue) + exNil,
        total: num(M.total) + ex, svc: num(M.otherTaxValue), tax: num(M.vatValue),
        disc: num(M.discountValue), kode: String(M.menuCode ?? ''), catatan: String(M.notes ?? ''),
        waiter: String(M.createdBy ?? ''), jam,
      })
      for (const P of arr(M.packages)) {
        if (ESB_BATAL_RE.test(String(P.statusName ?? ''))) continue
        mentah.push({
          M, nama: `${String(P.menuName ?? '').trim()} (PACKAGE)`, qty: num(P.qty),
          nilai: num(P.price) * num(P.qty) - num(P.discountValue),
          total: num(P.total), svc: num(P.otherTaxValue), tax: num(P.vatValue),
          disc: num(P.discountValue), kode: String(P.menuCode ?? ''), catatan: String(P.notes ?? ''),
          waiter: String(M.createdBy ?? ''), jam,
        })
      }
    }
    const gBill = num(B.grandTotal)
    const jml = mentah.reduce((a, x) => a + x.total, 0)
    const pay = esbBayar(B.salesPayments)
    mentah.forEach((x, i) => {
      const g = jml > 0 ? gBill * x.total / jml : (i === 0 ? gBill : 0)
      const isi = [B.salesDate, x.jam, B.salesNum, g, g - x.svc - x.tax,
        x.nilai + x.disc, x.disc, x.svc, x.tax, i === 0 ? num(B.paxTotal) : '',
        B.visitPurposeName ?? '', B.tableName ?? '', pay, x.waiter, B.editedBy || B.createdBy || '',
        B.additionalInfo ?? '', x.catatan, x.nama, x.qty, x.nilai, x.kode,
        x.M.menuCategoryName ?? '', x.M.menuCategoryDetailName ?? '']
      const r: BarisTabel = {}
      isi.forEach((v, k) => {
        r[`c${k}`] = String(v ?? '')
      })
      rows.push(r)
    })
    // a bill without a single live menu still carries its money
    if (!mentah.length && gBill) {
      const r: BarisTabel = {}
      ESB_KOLOM.forEach((_, i) => {
        r[`c${i}`] = ''
      })
      Object.assign(r, { c0: String(B.salesDate ?? ''), c1: esbJam(B.salesDateIn), c2: String(B.salesNum), c3: String(gBill), c4: String(gBill), c10: String(B.visitPurposeName ?? ''), c11: String(B.tableName ?? ''), c12: pay })
      rows.push(r)
    }
  }
  return { rows, info }
}

export const esbAkhirBulan = (b: string): string => {
  const [th, bl] = b.split('-').map(Number)
  return `${b}-${String(new Date(th!, bl!, 0).getDate()).padStart(2, '0')}`
}

/**
 * Months the sync pulls: this month, plus earlier months whose last sync did
 * not reach their last day or that were synced before menus were stored per
 * visit channel. Months filled from Excel are left alone.
 */
export function esbBulanSinkron(laporan: Record<string, { esb?: { sampai?: string }, kanalMenu?: unknown } | undefined>, hariIni: string): string[] {
  const kini = hariIni.slice(0, 7)
  const out = Object.keys(laporan).sort().filter((b) => {
    const L = laporan[b]
    return b < kini && L?.esb && ((L.esb.sampai ?? '') < esbAkhirBulan(b) || !L.kanalMenu)
  })
  out.push(kini)
  return out
}

export interface HalamanEsb { bills?: unknown[], page?: number, pageCount?: number | null }
export class EsbGagal extends Error {}

/**
 * Pull every page of a date range through `ambil` (one ESB page per call).
 * With a page count: three workers in parallel. Without one: walk until an
 * empty or short page. A page failing 3x stops everything — a half month
 * that looks complete is worse than nothing. Duplicate bills across pages are
 * dropped by salesNum and counted.
 */
export async function esbTarikRentang(
  ambil: (page: number) => Promise<HalamanEsb>,
  lapor: (teks: string) => void,
  label: string,
  jeda = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
): Promise<{ bills: Obj[], ganda: number }> {
  const semua: Obj[] = []
  const satu = async (page: number): Promise<HalamanEsb> => {
    let e: unknown = null
    for (let c = 0; c < 3; c++) {
      try {
        return await ambil(page)
      }
      catch (x) {
        e = x
        // token / access problems do not get better by retrying
        if (/token|akses|access|not_granted|esb_not_configured/i.test(String((x as Error)?.message ?? x))) break
      }
      await jeda(800 * (c + 1))
    }
    throw new EsbGagal(`Halaman ${page}: ${String((e as Error)?.message ?? e)}`)
  }
  lapor(`${label}: menarik halaman 1…`)
  const p1 = await satu(1)
  semua.push(...arr(p1.bills))
  const total = p1.pageCount || null
  if (total) {
    let berikut = 2
    let selesai = 1
    const pekerja = async () => {
      while (berikut <= total) {
        const pg = berikut++
        const d = await satu(pg)
        semua.push(...arr(d.bills))
        selesai++
        lapor(`${label}: halaman ${selesai} dari ${total} · ${semua.length} bill`)
      }
    }
    await Promise.all([pekerja(), pekerja(), pekerja()])
  }
  else {
    let pg = 1
    let d = p1
    const perPg = arr(p1.bills).length
    while (arr(d.bills).length && pg < 2000 && !(perPg && arr(d.bills).length < perPg)) {
      pg++
      lapor(`${label}: halaman ${pg} · ${semua.length} bill`)
      d = await satu(pg)
      semua.push(...arr(d.bills))
    }
  }
  const unik: Record<string, Obj> = {}
  for (const b of semua) if (b.salesNum) unik[String(b.salesNum)] = b
  return { bills: Object.values(unik), ganda: semua.length - Object.keys(unik).length }
}
