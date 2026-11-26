// Radar's screen rules — pure functions, no Vue, no API. Port of
// laksamana-office deploy/radar/index.html; the server-side half (joining the
// sources, "only what will happen", the money filter) lives in laksamana-api
// RadarRules. Each rule here names the old function it comes from.
import type { RadarAgenda, RadarReservasi, SumberAgenda } from '~/composables/useRadar'
import { BLN, BULAN, fTgl, fTglP, hariIni, rupiah, tambahHari } from '~/utils/format'
import { grupMenuOv } from '~/utils/marketing-event'

/** Seed only; Marketing sends the live list with the board (fbFormats). */
export const FB_FORMATS_DEFAULT = ['Prasmanan', 'Set Menu', 'Coffee Break', 'Nasi Kotak']

const tanggal = (iso: string) => {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

/** Days from today (dDay): 0 = today, negative = past. */
export function dDay(iso: string): number {
  return Math.round((+tanggal(iso) - +tanggal(hariIni())) / 86400000)
}
/** "HARI-H" / "H-3" / "H+2" (dLabel). */
export const dLabel = (n: number) => (n === 0 ? 'HARI-H' : n > 0 ? `H-${n}` : `H+${Math.abs(n)}`)
/** Colour of the countdown pill: ≤1 day red, ≤3 amber, else neutral. */
export const dWarna = (n: number): 'error' | 'warning' | 'neutral' => (n <= 1 ? 'error' : n <= 3 ? 'warning' : 'neutral')

// ─────────────────────────── period (kendaliPeriode) ──

export type ModePeriodeRadar = 'hari' | 'minggu' | 'bulan'

/**
 * Both the day and the month are kept, not one value re-read: switching to
 * Bulanan and back must return to the day that was picked, not jump to today.
 * A week is stored as its MONDAY (work weeks start Monday; getDay() says 0 =
 * Sunday and would push Sunday events into the next week).
 */
export interface Periode {
  mode: ModePeriodeRadar
  tgl: string
  mgg: string
  bln: string
}

export function seninMinggu(iso: string): string {
  const d = tanggal(iso || hariIni())
  const g = d.getDay()
  return tambahHari(iso || hariIni(), -(g === 0 ? 6 : g - 1))
}

export const periodeBaru = (mode: ModePeriodeRadar): Periode =>
  ({ mode, tgl: hariIni(), mgg: seninMinggu(hariIni()), bln: hariIni().slice(0, 7) })

/** First and last date of a period, for the board request. */
export function rentangPeriode(p: Periode): { dari: string, sampai: string } {
  if (p.mode === 'hari') return { dari: p.tgl, sampai: p.tgl }
  if (p.mode === 'minggu') return { dari: p.mgg, sampai: tambahHari(p.mgg, 6) }
  const [y, m] = p.bln.split('-').map(Number)
  const akhir = new Date(y!, m!, 0).getDate()
  return { dari: `${p.bln}-01`, sampai: `${p.bln}-${String(akhir).padStart(2, '0')}` }
}

export function dalamPeriode(iso: string, p: Periode): boolean {
  if (!iso) return false
  const { dari, sampai } = rentangPeriode(p)
  return iso >= dari && iso <= sampai
}

export function labelPeriode(p: Periode): string {
  if (p.mode === 'hari') return fTgl(p.tgl)
  if (p.mode === 'minggu') {
    const s = tanggal(p.mgg)
    const e = tanggal(tambahHari(p.mgg, 6))
    // The month is written twice only when the week crosses months.
    return s.getMonth() === e.getMonth()
      ? `${s.getDate()} – ${e.getDate()} ${BLN[e.getMonth()]} ${e.getFullYear()}`
      : `${fTglP(p.mgg)} – ${fTglP(tambahHari(p.mgg, 6))} ${e.getFullYear()}`
  }
  const [y, m] = p.bln.split('-')
  return `${BULAN[(Number(m) || 1) - 1]} ${y}`
}

export const OPSI_MODE = [
  { value: 'hari' as const, label: 'Harian' },
  { value: 'minggu' as const, label: 'Mingguan' },
  { value: 'bulan' as const, label: 'Bulanan' },
]

// ─────────────────────────── sources ──

export const LABEL_SUMBER: Record<SumberAgenda, string> = {
  mkt: 'Marketing · Event Klien',
  evt: 'Event · Jadwal Acara',
  vip: 'Marketing · Reservasi VIP',
}
export const SUMBER_PENDEK: Record<SumberAgenda, string> = { mkt: 'Marketing', evt: 'Event', vip: 'Reservasi VIP' }
/** Source pill colours as the old badgeSumber (mkt amber, evt violet, vip sea). */
export const WARNA_SUMBER: Record<SumberAgenda, 'gold' | 'vip' | 'info'> = { mkt: 'gold', evt: 'vip', vip: 'info' }
export const IKON_SUMBER: Record<SumberAgenda, string> = { mkt: 'i-lucide-briefcase', evt: 'i-lucide-mic-vocal', vip: 'i-lucide-crown' }

// ─────────────────────────── reservations ──

/** "batal" kept for old data; the vocabulary is Cancelled (resBatal). */
export const resBatal = (r: { status?: string }) => /cancel|batal/i.test(String(r.status || ''))
export const resNoShow = (r: { status?: string }) => /no.?show/i.test(String(r.status || ''))
/** Live = neither cancelled nor no-show: both will not come (resHidup). */
export const resHidup = (r: { status?: string }) => !resBatal(r) && !resNoShow(r)
/** Not cancelled (resAktif). No-show rows stay in tables so the trace is not lost. */
export const resAktif = (list: RadarReservasi[]) => list.filter(r => r.date && !resBatal(r))
export const resTgl = (list: RadarReservasi[], iso: string) => resAktif(list).filter(r => r.date === iso)
/** Pax of bookings, no-show excluded: they did not come (paxRes). */
export const paxRes = (list: RadarReservasi[]) => list.reduce((a, r) => a + (resNoShow(r) ? 0 : Number(r.pax) || 0), 0)
/** Status pill colour: arrived green, cancelled / no-show red, else amber. */
export const warnaStatusRes = (r: RadarReservasi): 'success' | 'error' | 'warning' =>
  /datang|seat|duduk/i.test(String(r.status || '')) ? 'success' : (resBatal(r) || resNoShow(r) ? 'error' : 'warning')
export const urutJam = (list: RadarReservasi[]) =>
  [...list].sort((a, b) => (a.date === b.date ? String(a.time || '').localeCompare(String(b.time || '')) : a.date < b.date ? -1 : 1))

/** DP cell for a Head: the amount, "Lunas", or "Belum" (resCard / tabel Reservasi). */
export function dpTeks(r: RadarReservasi): { teks: string, ada: boolean } {
  const dp = Number(r.dpAmount) || 0
  if (dp) return { teks: rupiah(dp), ada: true }
  return /lunas/i.test(String(r.dpStatus || '')) ? { teks: 'Lunas', ada: true } : { teks: 'Belum', ada: false }
}

// ─────────────────────────── agenda ──

export const paxOf = (list: RadarAgenda[]) => list.reduce((s, a) => s + (Number(a.pax) || 0), 0)
export const agendaTgl = (agenda: RadarAgenda[], iso: string) => agenda.filter(a => a.tgl === iso)
/** Past is decided by the DATE, not the status: yesterday's "Upcoming" is still past (agSudahLewat). */
export const agSudahLewat = (a: RadarAgenda) => dDay(a.tgl) < 0
export const agSelesai = (a: RadarAgenda) => /done|finish/i.test(String(a.status || ''))

/** Status options from the data that is actually on the board (statusPasti). */
export const statusPasti = (agenda: RadarAgenda[]) => [...new Set(agenda.map(a => a.status).filter(Boolean))].sort()

/** Official formats + formats in use (an old event may use one removed from the list) — fbOpsi. */
export function fbOpsi(agenda: RadarAgenda[], fbFormats: string[] | null | undefined): string[] {
  return [...new Set([...(fbFormats ?? FB_FORMATS_DEFAULT), ...agenda.map(a => a.fb)].filter(Boolean))].sort()
}
/** '__none' = events without an F&B format (Event-module events never have one). */
export const TANPA_FB = '__none'
/** Reka UI forbids a SelectItem value of '' — "Semua" in every Radar filter is this sentinel. */
export const SEMUA = '__semua'
export const saringAktif = (v: string) => !!v && v !== SEMUA
export function cocokFb(a: RadarAgenda, nilai: string): boolean {
  if (!saringAktif(nilai)) return true
  if (nilai === TANPA_FB) return !a.fb
  return a.fb === nilai
}

/** VIP guest range as the old paxVipTeks: "8–12 orang", "12 orang", or "". */
export function paxVipTeks(a: { paxMin?: number, paxMax?: number }): string {
  const lo = Number(a.paxMin) || 0
  const hi = Number(a.paxMax) || 0
  if (lo && hi && hi !== lo) return `${lo}–${hi} orang`
  return hi || lo ? `${hi || lo} orang` : ''
}

// ─────────────────────────── detail (Detail Lengkap) ──

/** Labels copied from Marketing's EVENT_SCHEMA (MKT_LABEL). Unknown keys still show, humanised. */
export const MKT_LABEL: Record<string, string> = {
  nama: 'Nama Event',
  jenis: 'Jenis Event',
  tanggal: 'Tanggal Event',
  mulaiSetup: 'Mulai Setup',
  tamuDatang: 'Tamu Datang / Jam Mulai',
  selesai: 'Estimasi Selesai',
  pax: 'Estimasi Jumlah Tamu (Pax)',
  budgetPax: 'Budget per Pax (F&B)',
  vipDetail: 'Detail Tamu VIP/VVIP/Umum',
  privacy: 'Sifat Acara',
  area: 'Lantai / Area',
  highlight: 'Poin Penting',
  rundown: 'Rundown Acara',
  rundownFiles: 'Lampiran Rundown',
  loadDekorTgl: 'Loading Dekorasi — Tanggal',
  loadDekorJam: 'Loading Dekorasi — Waktu',
  loadDekorNote: 'Catatan Loading Dekorasi',
  loadInTgl: 'Loading In — Tanggal',
  loadInJam: 'Loading In — Waktu',
  loadInNote: 'Catatan Loading In',
  loadOutTgl: 'Loading Out — Tanggal',
  loadOutJam: 'Loading Out — Waktu',
  loadOutNote: 'Catatan Loading Out',
  decorSource: 'Sumber Dekorasi',
  decorVendorTime: 'Jam Vendor Dekorasi Datang',
  decorSupport: 'Perlu Support Tim Venue',
  decorJenis: 'Jenis Dekorasi',
  decorLM: 'Jenis Dekorasi (Laksamana Muda)',
  decorLMNote: 'Catatan Dekor (Laksamana Muda)',
  decorVendorExt: 'Vendor Eksternal?',
  decorVendorName: 'Vendor dari mana? (nama & kontak)',
  layoutFile: 'Catatan Layout & Seating Plan',
  layoutImgs: 'Gambar Layout',
  areaPakai: 'Area yang Dipakai untuk Seating dan Dekor',
  areaImgs: 'Gambar Area',
  sound: 'Sound System',
  lighting: 'Lighting Khusus',
  screen: 'LED / Proyektor / TV',
  entDok: 'Dokumentasi',
  entEquip: 'Equipment Tambahan',
  entJenis: 'Entertainment (Band/DJ/MC/dll)',
  ruangVIP: 'Ruang VIP',
  musholla: 'Musholla',
  listrik: 'Listrik Tambahan',
  fbFormat: 'Format F&B',
  jamFB: 'Jam Keluar F&B',
  komponen: 'Komponen Menu',
  dietary: 'Dietary Requirement',
  menuFinal: 'Menu Final',
  kNote: 'Catatan Kitchen',
  kPIC: 'PIC Client untuk Konsumsi',
  barMenu: 'Daftar Menu Bar',
  barJam: 'Jam Operasional Bar',
  plating: 'Standar Plating / Presentasi',
  barVIP: 'Special Handling VIP',
  barNote: 'Bar Note',
  bPIC: 'PIC Client untuk Konsumsi',
  m_jamKonsumsi: 'Jam Keluar F&B & Operasional Bar (dari D.2/D.3)',
  penyajianBar: 'Waktu Penyajian Menu Bar',
  floorTambah: 'Kebutuhan Setup',
  dressCode: 'Dress Code Staff Floor',
  barangClient: 'Barang Bawaan Client Perlu Setup',
  floorNote: 'Note untuk Floor',
  guestList: 'Guest List / RSVP',
  hostBantu: 'Perlu Perbantuan Host',
  hostJumlah: 'Berapa Host yang Dibutuhkan',
  penandaTamu: 'Penanda Tamu',
  m_ruangVIP: 'Ruang VIP (dari D.1)',
  m_musholla: 'Musholla (dari D.1)',
  m_layout: 'Catatan Layout & Seating (dari D.1)',
  m_decorLM: 'Catatan Dekor Laksamana Muda (dari D.1)',
  fPIC: 'PIC Client untuk Floor (Hari-H)',
  secTambah: 'Tambahan Security (jumlah & keperluan)',
  emergency: 'Emergency Exit Briefing',
  medical: 'Medical Staff Stand-by',
  bodyCheck: 'Perlu Body Checking?',
  loadVendor: 'Loading Vendor (jadwal masuk-keluar)',
  loadBarang: 'Barang Apa Saja yang Masuk',
  valet: 'Valet / Reservasi Parkir Tamu Penting',
  vipPark: 'VIP Parking — Plat & Nama',
  parkArea: 'Area Parkir yang Digunakan',
  m_privacy: 'Sifat Acara (dari D.1)',
  m_loadDekor: 'Loading Dekorasi (dari D.1)',
  m_loadIn: 'Loading In (dari D.1)',
  m_loadOut: 'Loading Out (dari D.1)',
  secNote: 'Security Note',
  briefTgl: 'Tanggal & Jam Briefing/Rehearsal',
  briefPeserta: 'Peserta Briefing',
  materiDesain: 'Materi Desain Venue',
  namaResmi: 'Nama Resmi Event & Tagline/Tema',
  materiAda: 'Materi Promosi Sudah Ada?',
  izinIG: 'Izin Posting IG',
  izinTT: 'Izin Posting TikTok',
  izinTeaser: 'Izin Teaser/Reels/Live Story',
  izinTag: 'Izin Tag Akun Client',
  izinTagAkun: 'Nama Akun IG yang Di-tag',
  dokEvent: 'Dokumentasi Selama Event Diizinkan',
  hashtag: 'Hashtag Wajib',
  mktPIC: 'PIC Marketing dari Client',
  boothAda: 'Ada Booth?',
  boothUkuran: 'Ukuran & Jumlah Booth',
  boothPosisi: 'Posisi Booth',
  boothAktivitas: 'Jenis Aktivitas Booth',
  boothListrik: 'Kebutuhan Listrik (Watt)',
  boothEquip: 'Peralatan Tambahan',
  boothJam: 'Jam Operasional Booth',
  boothRevshare: 'Revenue Sharing (%)',
  boothCP: 'Contact Person Booth',
  estimasiOTS: 'Estimasi Tamu + Penambahan OTS',
  dealPax: 'Deal per Pax',
  sistemBayar: 'Sistem Pembayaran',
  depositNama: 'Deposit — Keterangan',
  depositNominal: 'Deposit — Nominal',
  depositVia: 'Deposit — Via',
  metodeBayar: 'Metode Pembayaran',
  ketentuanBill: 'Ketentuan Bill',
  limitAnggaran: 'Limit Anggaran Client',
  diskonKasir: 'Penyesuaian Harga / Diskon (%)',
  voucher: 'Voucher / Kupon',
  voucherImgs: 'Gambar Voucher / Kupon',
  itemTambah: 'Item Tambahan / Pesanan Khusus',
  refundPIC: 'PIC Pembayaran',
  jamOrder: 'Jam Operasional & Mulai Boleh Order',
  kasirTambah: 'Request Tambahan Kasir',
  noteInvoice: 'Note Invoice',
  cPIChp: 'PIC Client Hari-H (Kasir) + No. WA',
  sewaVenue: 'Sewa Venue',
  biayaTeknis: 'Sound, Lighting, dll',
  biayaLain: 'Lain-lain',
  m_itemTambah: 'Item Tambahan dari Kasir',
  diskon: 'Discount',
  npwp: 'Data Perusahaan untuk Invoice + NPWP',
  materai: 'Materai / Kwitansi Panjang',
  attachFiles: 'Lampiran Berkas',
  attachNote: 'Catatan Dokumen',
  internalNote: 'Internal Note',
  picKoordinator: 'Koordinator Event Internal',
  picMOD: 'Manager On Duty',
  picAcara: 'PIC Acara Klien',
  picOperator: 'PIC Operator',
  picKonsumsi: 'PIC Konsumsi',
  picTamu: 'PIC Tamu',
  picRegis: 'PIC Registrasi',
  picDokumentasi: 'PIC Dokumentasi',
  picBayar: 'PIC Pembayaran',
  picTalent: 'PIC Talent (jika ada)',
  picDekor: 'PIC Dekorasi (jika ada)',
  picParkir: 'Area Parkir PIC',
}
/** Already in the card head; not repeated in the field list (DET_SKIP). */
const DET_SKIP = new Set(['nama', 'tanggal', 'jenis', 'jenisLain', 'pax', 'area', 'areaLain', 'mktPIC'])

/** Split only at lower→Upper, so "JamFB" stays "Jam FB" and "PIC" is not "P I C" (humanKey). */
export const humanKey = (k: string) => String(k || '').replace(/^m_/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase())
export const detLabel = (k: string) => MKT_LABEL[k] || humanKey(k)

/**
 * Strip HTML tags from rich-editor text, keeping paragraphs as line breaks
 * (tanpaTag). Rendered as text afterwards, never as HTML. `&amp;` LAST, or
 * "&amp;lt;" would turn into "<".
 */
export function tanpaTag(s: unknown): string {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0?39;/gi, '\'')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** A menu table ({group: {rows, jam, qty}} + _teks) as short text (fmtMenuLike). */
export function fmtMenuLike(o: Obj): string {
  const out: string[] = []
  if (o._teks && String(o._teks).trim()) out.push(String(o._teks).trim())
  for (const g of Object.keys(o)) {
    if (g === '_teks') continue
    const gd = isObj(o[g]) ? o[g] as Obj : {}
    const rows = Array.isArray(gd.rows) ? gd.rows as Obj[] : []
    if (!rows.length && !gd.jam && !gd.qty) continue
    const kepala = `${g === '__grup__' ? '' : g}${gd.jam ? ` — ${gd.jam}` : ''}${gd.qty ? ` · ${gd.qty}` : ''}`
    if (kepala.trim()) out.push(kepala.trim())
    for (const r of rows) {
      const isi = `${r.menu || ''}${r.qty ? ` (${r.qty})` : ''}${r.jam && r.jam !== gd.jam ? ` — ${r.jam}` : ''}`
      const kat = r.kat || r.catatan || ''
      if (isi.trim()) out.push(`  ${kat ? `${kat}: ` : ''}${isi.trim()}`)
    }
  }
  return out.join('\n')
}

export interface Lampiran { key: string, name: string }
/** {key, name, …} attachment list (adalahLampiran). */
export const adalahLampiran = (v: unknown): v is Lampiran[] =>
  Array.isArray(v) && !!v.length && isObj(v[0]) && 'key' in v[0] && 'name' in v[0]
/** Images are drawn, other files linked — by NAME: the key ends in .png for every kind. */
export const lampiranGambar = (name: string) => /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name)

/**
 * One value by its SHAPE, not by a schema type, so a Marketing shape change
 * does not break the board (fmtDetVal). Unknown objects are dropped, never
 * printed as JSON. The server already dropped money fields and bill lines
 * for non-Heads; `nominal` on name rows only arrives for a Head.
 */
export function fmtDetVal(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return tanpaTag(v)
  if (Array.isArray(v)) {
    if (!v.length) return ''
    if (isObj(v[0])) {
      if (adalahLampiran(v)) return v.map(f => String(f?.name || 'berkas')).join(', ')
      const rows = v as Obj[]
      if ('desc' in v[0] && ('harga' in v[0] || 'jumlah' in v[0])) return ''
      if ('kegiatan' in v[0] || 'mulai' in v[0]) {
        return rows.map((r) => {
          const j = [r.mulai, r.selesai].filter(Boolean).join('–')
          return `${j ? `${j} — ` : ''}${tanpaTag(r.kegiatan || '')}`
        }).filter(x => x.trim()).join('\n')
      }
      if ('barang' in v[0]) {
        return rows.map((r) => {
          const w = [r.tgl, r.jam].filter(Boolean)
          return `${tanpaTag(r.barang || '')}${w.length ? ` — ${w.join(' ')}` : ''}`
        }).filter(x => x.trim()).join('\n')
      }
      if ('nama' in v[0]) {
        return rows.map(r => `${tanpaTag(r.nama || '')}${r.nominal !== null && r.nominal !== undefined && r.nominal !== ''
          ? ` — ${rupiah(Number(r.nominal) || 0)}`
          : ''}`).join('\n')
      }
      return v.map(x => (typeof x === 'string' ? tanpaTag(x) : '')).filter(x => x !== '').join(', ')
    }
    return v.map(x => tanpaTag(x)).filter(x => x !== '').join(', ')
  }
  if (isObj(v)) {
    if ('rows' in v || '_teks' in v) return fmtMenuLike(v)
    // yes/no + note: {v: bool, note?}
    if ('v' in v) {
      let s = v.v === true ? 'Ya' : v.v === false ? 'Tidak' : ''
      if (v.note) s += `${s ? ' — ' : ''}${v.note}`
      return s
    }
    return fmtMenuLike(v)
  }
  return ''
}

export interface BarisDetail { k: string, label: string, teks: string, lampiran?: Lampiran[] }

/** Menu Final / Menu Bar with at least one row: drawn as a table, not as text. */
export const adaTabelMenu = (k: string, v: unknown): boolean =>
  (k === 'menuFinal' || k === 'barMenu') && grupMenuOv(v).some(g => g.rows.length > 0)

/** Every filled field of a Marketing event, in schema order, unknown keys after (detailFields). */
export function detailFields(detail: Obj): BarisDetail[] {
  const out: BarisDetail[] = []
  const lihat = new Set<string>()
  const baris = (k: string) => {
    const v = detail[k]
    // A plain list of menu rows has no text form, but it still has a table.
    const t = fmtDetVal(v) || (adaTabelMenu(k, v) ? 'Menu' : '')
    if (t === '') return
    out.push(adalahLampiran(v) ? { k, label: detLabel(k), teks: t, lampiran: v } : { k, label: detLabel(k), teks: t })
  }
  for (const k of Object.keys(MKT_LABEL)) {
    if (DET_SKIP.has(k)) continue
    lihat.add(k)
    if (k in detail) baris(k)
  }
  for (const k of Object.keys(detail)) {
    if (lihat.has(k) || DET_SKIP.has(k) || k.startsWith('_')) continue
    baris(k)
  }
  return out
}

/**
 * The kitchen & bar fields highlighted when an event card opens (SOROT_MKT),
 * in the order people ask for them — not schema order. Empty ones are not
 * drawn at all.
 */
const SOROT_MKT: [string, string, string][] = [
  ['kNote', 'Catatan Kitchen', 'i-lucide-notebook-pen'],
  ['dietary', 'Dietary / Permintaan Khusus', 'i-lucide-triangle-alert'],
  ['itemTambah', 'Item Tambahan / Pesanan Khusus', 'i-lucide-plus'],
  ['barVIP', 'Special Handling VIP', 'i-lucide-star'],
  ['barNote', 'Catatan Bar', 'i-lucide-notebook-pen'],
  ['menuFinal', 'Menu Final', 'i-lucide-utensils'],
  ['barMenu', 'Menu Bar', 'i-lucide-wine'],
]
export function sorotanEvent(detail: Obj): { label: string, icon: string, teks: string, menu?: unknown }[] {
  const out: { label: string, icon: string, teks: string, menu?: unknown }[] = []
  for (const [k, label, icon] of SOROT_MKT) {
    if (!(k in detail)) continue
    const t = fmtDetVal(detail[k])
    if (adaTabelMenu(k, detail[k])) out.push({ label, icon, teks: t, menu: detail[k] })
    else if (t && t.trim()) out.push({ label, icon, teks: t })
  }
  return out
}

// ─────────────────────────── promo (from BD) ──
// Types, days, status and remaining time: app/utils/promo.ts (shared with BD).

export const promoTglPendek = (s?: string) => (s ? fTglP(s) : '—')

// ─────────────────────────── WhatsApp daily sheet ──

/** The daily reservation sheet for WhatsApp (waResHarian); today's agenda is one context line. */
export function waResHarian(iso: string, agenda: RadarAgenda[], res: RadarReservasi[]): string {
  const ags = agendaTgl(agenda, iso)
  const rs = urutJam(resTgl(res, iso))
  let t = `*RESERVASI ${fTgl(iso).toUpperCase()}*\nLaksamana Muda Coffee & Live Space\n\n`
  if (ags.length) t += `Agenda hari ini: ${ags.map(a => a.judul + (a.jam ? ` (${a.jam})` : '')).join(', ')}\n\n`
  t += `TAMU: ${rs.length} booking, ${paxRes(rs)} pax\n`
  if (!rs.length) t += '(belum ada reservasi)\n'
  for (const r of rs) {
    t += `- ${r.time || '-'} ${r.name || '-'} (${Number(r.pax) || 0} pax${r.table ? `, ${r.table}` : ''})${r.notes ? `\n   Catatan: ${r.notes}` : ''}\n`
  }
  return t
}

// ─────────────────────────── paging ──

/** 20 rows per page, one number per list (PG): two lists on one screen never share a page. */
export const PER_HAL = 20
export const iris = <T>(list: T[], hal: number): T[] => {
  const maks = Math.max(1, Math.ceil(list.length / PER_HAL))
  const h = Math.min(Math.max(1, hal), maks)
  return list.slice((h - 1) * PER_HAL, h * PER_HAL)
}
