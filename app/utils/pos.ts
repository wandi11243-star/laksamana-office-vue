// POS cashier math and receipt text — pure helpers, no API, no Vue.
// Ported from laksamana-office/deploy/pos/index.html (hitung, kolomStruk,
// strukTeks, omsetHari over paid server orders, rekapTgl omitted: the Vue
// Laporan reads real paid orders from the server, so no deterministic
// reconstruction of pre-POS days is needed).

/** One sellable menu row: the HPP snapshot (pos-menu.ts) plus server diffs. */
export interface MenuPos {
  id: string
  nama: string
  kat: string
  /** HPP `jenis` column: food | drink | other. */
  jenis: string
  harga: number
  kode: string
  aktif?: boolean
}

/** Top ESB-style group, read from the HPP `jenis` column (no second list). */
export type GrupPos = 'FOOD' | 'BEVERAGES' | 'OTHERS'

export const grupMenuPos = (m: Pick<MenuPos, 'jenis'>): GrupPos =>
  m.jenis === 'food' ? 'FOOD' : m.jenis === 'drink' ? 'BEVERAGES' : 'OTHERS'

/** The old order statuses: draft/open while served, paid, batal (kept, never deleted). */
export type StatusOrderPos = 'draft' | 'open' | 'paid' | 'batal' | 'void'

export interface ItemOrderPos {
  id: string
  nama: string
  harga: number
  qty: number
}

export interface BayarOrderPos {
  cara: string
  amount: number
}

export interface OrderPos {
  id: string
  no: string
  tgl: string
  status: StatusOrderPos
  items: ItemOrderPos[]
  meja: string
  notes: string
  pax: number
  mode: string
  diskon: number
  diskonRp: number
  payments: BayarOrderPos[]
  kasir: string
  at: number
  paidAt?: number
  voidAt?: number
  voidOleh?: string
  voidOlehId?: string
  voidSetuju?: string
  voidAlasan?: string
  /** Percents are COPIED onto the order: changing Pengaturan never shifts a paid bill. */
  scPct: number
  pb1Pct: number
  updatedAt: number
  /** Server version this copy was loaded at; sent back as `base`. */
  _base?: number
  /** False while the row still waits in the offline queue. Local only. */
  _naik?: boolean
}

export interface UserPos {
  id: string
  nama: string
  role: 'admin' | 'kasir'
  pin: string
  aktif?: boolean
}

export interface PrinterPos {
  lebar: 80 | 58
  otomatis: boolean
  salinan: number
  logo: boolean
  kaki: string
  mode: 'teks' | 'grafis'
  kolom: number
}

export interface SettingPos {
  users: UserPos[]
  menu: Record<string, Partial<MenuPos>>
  menuBaru: MenuPos[]
  sc: number
  pb1: number
  ts?: number
  printer?: PrinterPos
}

export const PRINTER_BAWAAN_POS: PrinterPos = {
  lebar: 80, otomatis: false, salinan: 1, logo: true,
  kaki: 'Terima kasih atas kunjungan Anda', mode: 'teks', kolom: 42,
}

/** Payment methods in the old order. */
export const CARA_BAYAR_POS = ['CASH', 'QRIS', 'EDC BCA', 'EDC MANDIRI', 'EDC BRI', 'TRANSFER', 'GOFOOD', 'GRABFOOD', 'OTHER VOUCHER']

/** The single place that totals a bill: order screen, pay sheet, receipt and report all read this. */
export function hitungOrderPos(o: Pick<OrderPos, 'items' | 'diskon' | 'diskonRp' | 'payments' | 'scPct' | 'pb1Pct'> & { scRp?: number, pb1Rp?: number }, scDflt: number, pb1Dflt: number) {
  const sub = o.items.reduce((s, x) => s + x.harga * x.qty, 0)
  const scPct = o.scPct ?? scDflt
  const pb1Pct = o.pb1Pct ?? pb1Dflt
  const disc = Math.round(sub * (o.diskon || 0) / 100) + (o.diskonRp || 0)
  const dasar = sub - disc
  const sc = o.scRp ?? Math.round(dasar * scPct / 100)
  const pb1 = o.pb1Rp ?? Math.round((dasar + sc) * pb1Pct / 100)
  const bill = dasar + sc + pb1
  // Round UP to 100 like the old till (bulatAtas).
  const grand = Math.ceil(bill / 100) * 100
  const bayar = (o.payments || []).reduce((s, p) => s + p.amount, 0)
  return {
    sub, disc, dasar, sc, pb1, bill,
    rounding: grand - bill, grand, bayar, scPct, pb1Pct,
    omset: dasar + sc,
    outstanding: Math.max(0, grand - bayar),
    kembali: Math.max(0, bayar - grand),
    qty: o.items.reduce((s, x) => s + x.qty, 0),
  }
}

/** Today clamped to 2026: this POS only shows 2026. */
export const TAHUN_POS = 2026

export const hariIniPos = (): string => {
  const d = new Date()
  if (d.getFullYear() < TAHUN_POS) return `${TAHUN_POS}-01-01`
  if (d.getFullYear() > TAHUN_POS) return `${TAHUN_POS}-12-31`
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Weekday = denah Lt.1 Weekday, Fri–Sun = Weekend, like Reservasi. */
export const weekendPos = (iso: string): boolean => {
  const g = new Date(`${iso}T00:00:00`).getDay()
  return g === 0 || g === 5 || g === 6
}

/** Paid orders of one date, oldest first, with their totals. */
export function laporanHarianPos(orders: OrderPos[], iso: string, scDflt: number, pb1Dflt: number) {
  const paid = orders
    .filter(o => o.status === 'paid' && o.tgl === iso)
    .sort((a, b) => (a.paidAt || 0) - (b.paidAt || 0))
  let omset = 0
  let pajak = 0
  const perCara: Record<string, number> = {}
  for (const o of paid) {
    const t = hitungOrderPos(o, scDflt, pb1Dflt)
    omset += t.dasar + t.sc
    pajak += t.pb1
    for (const p of o.payments) perCara[p.cara] = (perCara[p.cara] || 0) + p.amount
  }
  return { orders: paid, trx: paid.length, omset, pajak, perCara }
}

// ── 42-column text receipt ──────────────────────────────────────────────
// Column math mirrors kolomStruk/strukTeks: 80mm defaults to 42 columns,
// 58mm to 32. The graphic mode prints the same lines as HTML.

const garis = (c: number, ch = '-'): string => ch.repeat(Math.max(0, c))

const duaKolom = (kiri: string, kanan: string, lebar: number): string => {
  const k = kanan.padStart(Math.max(0, lebar - kiri.length))
  return (kiri + k).slice(0, lebar)
}

export const rupiahPos = (n: number): string => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`

export interface KepalaStruk {
  outlet: string
  station: string
  kasir: string
  kaki: string
}

/** Plain-text receipt, one line per row, exactly `kolom` wide. */
export function strukTeksPos(o: OrderPos, hitung: ReturnType<typeof hitungOrderPos>, kepala: KepalaStruk, kolom: number): string {
  const tgl = new Date(o.paidAt || o.at)
  const p = (n: number) => String(n).padStart(2, '0')
  const baris: string[] = [
    ...(o.status === 'void' ? ['*** VOID — TIDAK BERLAKU ***', `Alasan: ${o.voidAlasan || '-'}`, `Oleh: ${o.voidOleh || '-'}`, garis(kolom)] : []),
    kepala.outlet.toUpperCase(),
    `Station ${kepala.station} · ${o.no || o.id.slice(-6)}`,
    `${o.tgl} ${p(tgl.getHours())}:${p(tgl.getMinutes())} · Kasir ${kepala.kasir}`,
    `Meja ${o.meja} · ${o.mode} · ${o.pax} pax`,
    garis(kolom),
  ]
  for (const it of o.items) {
    baris.push(duaKolom(`${it.qty}x ${it.nama}`.slice(0, kolom - 12), rupiahPos(it.harga * it.qty), kolom))
  }
  baris.push(garis(kolom))
  baris.push(duaKolom('Subtotal', rupiahPos(hitung.sub), kolom))
  if (hitung.disc) baris.push(duaKolom('Diskon', `-${rupiahPos(hitung.disc)}`, kolom))
  baris.push(duaKolom(`SC (${hitung.scPct}%)`, rupiahPos(hitung.sc), kolom))
  baris.push(duaKolom(`PB1 (${hitung.pb1Pct}%)`, rupiahPos(hitung.pb1), kolom))
  baris.push(duaKolom('TOTAL', rupiahPos(hitung.grand), kolom))
  for (const pay of o.payments) baris.push(duaKolom(pay.cara, rupiahPos(pay.amount), kolom))
  if (hitung.kembali) baris.push(duaKolom('Kembali', rupiahPos(hitung.kembali), kolom))
  baris.push(garis(kolom))
  baris.push(kepala.kaki)
  baris.push('')
  baris.push('')
  return baris.join('\n')
}

/** Paper width for the graphic receipt: black logo at 70mm on 80mm paper, 48mm on 58mm. */
export const lebarLogoMm = (lebar: number): number => (lebar === 58 ? 48 : 70)
