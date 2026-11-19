// Marketing › Reservasi VIP + Request Design & Video (issue #61): pure rules.
// No API, no Vue. Tested by tools/uji-marketing-vip.mjs.
//
// Source: laksamana-office deploy/marketing/index.html
//   VIP :15317 vipNominal · :15419 KOL_VIP · :16498 vipBatal · :16608 vipHapus
//       :16982 vipFormUI · :17111 vipDpTotal · :17356 vipDpsUntukReservasi
//       :17411 vipGabungDps · vipTerapkanRingkasanDp · :18062 vipSimpanKunci
//       :16104 vipYatimList · :16282 vipYatimTabel · vipPulihkan · vipDariReservasi
//       :15082 VIP_LOCK_LEAD_MIN · F.8 (lock belongs to Reservasi), F.13 (per-row)
//   REQ :15452 DR_JENIS · :15529 KOL_DESIGNREQ · :15932 drForm · :15983 drSimpan
//       :16024 drBatal · :15499 drProg/drSelesai/drStatusText · :15516 drHitungKat
//       :15616 drSegarkanProgres + brand/PIC options (Konten lends, free fallback)
import type { DpVipMkt, RequestDesainMkt, VipMkt } from '~/utils/marketing'

// ---------------------------------------------------------------- VIP

export const JENIS_VIP_MKT = ['Assisted', 'Regular'] as const
export const REKENING_VIP_MKT = ['QRIS BRI', 'Transfer UOB', 'Cash', 'QRIS BCA']
/** Lock window H-3 jam (VIP_LOCK_LEAD_MIN, :15082). */
export const VIP_LOCK_LEAD_MIN = 180

/** Guests: max first, then min (:vipPax). */
export const vipPaxMkt = (v?: VipMkt | null) => +(v?.paxMax ?? 0) || +(v?.paxMin ?? 0) || 0

/** Assisted counts as turnover; Regular never does (:15317). */
export const vipNominalMkt = (v?: VipMkt | null) => (v?.jenis === 'Assisted' ? (+(v?.nominal ?? 0) || 0) : 0)

/** Sort column Pembayaran: total DP in, not its status text. */
export const vipDpTotalMkt = (v?: VipMkt | null) =>
  (Array.isArray(v?.bukti) ? v.bukti : []).reduce((a, b) => a + (+(b.nominal ?? 0) || 0), 0)

export function rekapVipMkt(rows: VipMkt[]) {
  const hidup = rows.filter(v => !v.batalAt)
  return {
    total: hidup.length,
    assisted: hidup.filter(v => v.jenis === 'Assisted').length,
    regular: hidup.filter(v => v.jenis !== 'Assisted').length,
    nominal: hidup.reduce((a, v) => a + vipNominalMkt(v), 0),
    tanpaNominal: hidup.filter(v => v.jenis === 'Assisted' && !vipNominalMkt(v)).length,
    batal: rows.filter(v => !!v.batalAt).length,
  }
}

/** upcoming = today onwards (the default view, owner request Nov 2026). */
export type PeriodeVipMkt = 'upcoming' | 'semua' | 'hari' | 'minggu' | 'bulan' | 'pilih'
/** aktif = Regular & Assisted without the cancelled (the default); semua = everything. */
export type JenisVipMkt = 'aktif' | 'Assisted' | 'Regular' | 'batal' | 'semua'

/** Kind filter (vipCocokJenis, :15354): cancelled lives only under batal/semua. */
export function vipCocokJenisMkt(v: VipMkt, jenis: JenisVipMkt): boolean {
  if (jenis === 'batal') return !!v.batalAt
  if (jenis === 'semua') return true
  if (v.batalAt) return false
  return jenis === 'aktif' || v.jenis === jenis
}

/** Assisted with no nominal yet (vipBelumNominal, :15393). */
export const vipBelumNominalMkt = (v?: VipMkt | null) => !!v && v.jenis === 'Assisted' && !(+(v.nominal ?? 0))

/** Payment chip (vipStatusBayar, :16671): no DP / DP / paid off against the nominal. */
export function vipStatusBayarMkt(v?: VipMkt | null): { k: 'belum' | 'dp' | 'lunas', t: string } {
  const dp = vipDpTotalMkt(v)
  if (!dp) return { k: 'belum', t: 'Belum DP' }
  const tagihan = vipNominalMkt(v)
  return tagihan > 0 && dp >= tagihan ? { k: 'lunas', t: 'Lunas' } : { k: 'dp', t: 'DP' }
}

/** List filter: text + period + kind (cancelled lives under its own kind). */
export function saringVipMkt(rows: VipMkt[], q: string, periode: PeriodeVipMkt, dari: string, sampai: string, bulan: string, hari: string, jenis: JenisVipMkt): VipMkt[] {
  const s = q.trim().toLowerCase()
  let a = ''
  let b = ''
  if (periode === 'upcoming') {
    a = hari
  }
  else if (periode === 'hari') {
    a = hari
    b = hari
  }
  else if (periode === 'minggu') {
    const d = new Date(`${hari}T00:00:00`)
    const senin = new Date(d)
    senin.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const ahad = new Date(senin)
    ahad.setDate(senin.getDate() + 6)
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    a = iso(senin)
    b = iso(ahad)
  }
  else if (periode === 'bulan') {
    a = `${bulan}-01`
    b = `${bulan}-31`
  }
  else if (periode === 'pilih') {
    a = dari
    b = sampai
  }
  return rows.filter((v) => {
    if (!vipCocokJenisMkt(v, jenis)) return false
    if (a && String(v.tanggal ?? '') < a) return false
    if (b && String(v.tanggal ?? '') > b) return false
    if (s && ![v.nama, v.hp, v.perusahaan, (v.meja ?? []).join(' ')].join(' ').toLowerCase().includes(s)) return false
    return true
  })
}

/** Company from the CRM row, not free text — legacy `perusahaan` is the fallback. */
export function vipPerusahaanMkt(v?: VipMkt | null, dariCrm?: (id: string) => string): string {
  if (v?.clientId && dariCrm) {
    const c = dariCrm(v.clientId)
    if (c) return c
  }
  return String(v?.perusahaan ?? '')
}

/** `vip-<id>` rows of Reservasi without a Marketing row (vipYatimList). */
export function vipYatimMkt(
  barisReservasi: Record<string, unknown>[], ada: Set<string>, hanyaSaya?: string,
): Record<string, unknown>[] {
  return barisReservasi.filter((r) => {
    const id = vipIdDariResMkt(String(r.id ?? ''))
    if (!id || ada.has(id)) return false
    if (hanyaSaya && String(r.picName ?? '').trim().toLowerCase() !== hanyaSaya) return false
    return true
  }).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
}

export const vipIdDariResMkt = (resId: string) => (resId.startsWith('vip-') ? resId.slice(4) : '')

export const vipResBatalMkt = (r?: Record<string, unknown> | null) =>
  ['cancelled', 'no-show', 'noshow', 'batal'].includes(String(r?.status ?? '').toLowerCase())

/** Read back the notes written by the lock (vipUraiCatatan): position, not matching. */
export function uraianCatatanVipMkt(teks?: string) {
  const baris = String(teks ?? '').split('\n')
  const out = { jenis: '', perusahaan: '', layoutReq: '', tv: false, speaker: false, catatan: '', pic: '' }
  let i = 0
  const kepala = (baris[0] ?? '').match(/^RESERVASI RUANG VIP \(([^)]+)\)/)
  if (kepala?.[1]) {
    out.jenis = kepala[1].trim()
    i = 1
  }
  if ((baris[i] ?? '').startsWith('Perusahaan: ')) {
    out.perusahaan = (baris[i] ?? '').slice(12).trim()
    i++
  }
  if ((baris[i] ?? '').startsWith('Request layout: ')) {
    out.layoutReq = (baris[i] ?? '').slice(16).trim()
    i++
  }
  if ((baris[i] ?? '').startsWith('TV: ')) {
    out.tv = /TV: Ya/.test(baris[i] ?? '')
    out.speaker = /Speaker & Mic: Ya/.test(baris[i] ?? '')
    i++
  }
  let akhir = baris.length
  for (let j = baris.length - 1; j >= i; j--) {
    if ((baris[j] ?? '').startsWith('Dari modul Marketing')) {
      const m = (baris[j] ?? '').match(/PIC (.+)$/)
      if (m?.[1]) out.pic = m[1]
      akhir = j
      break
    }
  }
  out.catatan = baris.slice(i, akhir).join('\n').trim()
  return out
}

/** The notes the lock writes (same positions the reader above expects). */
export function catatanVipMkt(v: VipMkt, perusahaan: string, namaPic: string): string {
  return [
    `RESERVASI RUANG VIP (${v.jenis})`,
    perusahaan ? `Perusahaan: ${perusahaan}` : '',
    v.layoutReq ? `Request layout: ${v.layoutReq}` : '',
    `TV: ${v.tv ? 'Ya' : 'Tidak'} · Speaker & Mic: ${v.speaker ? 'Ya' : 'Tidak'}`,
    v.catatan ?? '',
    `Dari modul Marketing — PIC ${namaPic}`,
  ].filter(x => x !== '').join('\n')
}

/** DP rows for the Reservasi record (vipDpsUntukReservasi). */
export function dpsVipMkt(v: VipMkt, oleh: string): DpVipMkt[] {
  return (v.bukti ?? []).map(b => ({
    id: `vip-${v.id}-${b.id}`,
    vipBuktiId: b.id,
    amount: +(b.nominal ?? 0) || 0,
    method: b.metode ?? '',
    proofData: '',
    proofName: b.name ?? '',
    by: b.by || oleh,
    at: b.at ? (new Date(String(b.at)).getTime() || Date.now()) : Date.now(),
    tfDate: '', tfTime: '', tfBank: '', tfName: '', tfAmount: 0,
    tfStatus: '', tfNote: '', tfSource: '', tfBy: '', tfAt: 0, tfOcrAt: 0, tfOcrText: '',
  }))
}

/**
 * Merge Marketing DP rows into the ones already in Reservasi (vipGabungDps):
 * only rows born here (vipBuktiId) are replaced; the crew's own instalments
 * stay, and verified rows keep their verification.
 */
export function gabungDpsVipMkt(lama: DpVipMkt[], baru: DpVipMkt[]): DpVipMkt[] {
  const sisa = lama.filter(p => !(p?.vipBuktiId))
  const peta: Record<string, DpVipMkt> = {}
  for (const p of lama) if (p?.vipBuktiId) peta[String(p.vipBuktiId)] = p
  const dari = baru.map((p) => {
    const l = peta[String(p.vipBuktiId ?? '')]
    if (!l) return p
    return {
      ...l, ...p,
      proofData: p.proofData || l.proofData || '',
      proofName: p.proofName || l.proofName || '',
      tfStatus: l.tfStatus || '', tfNote: l.tfNote || '', tfSource: l.tfSource || '',
      tfBy: l.tfBy || '', tfAt: l.tfAt || 0, tfAmount: l.tfAmount || 0,
      tfDate: l.tfDate || '', tfTime: l.tfTime || '', tfBank: l.tfBank || '', tfName: l.tfName || '',
      tfOcrAt: l.tfOcrAt || 0, tfOcrText: l.tfOcrText || '',
    }
  })
  return [...sisa, ...dari]
}

/** dpStatus/dpAmount/dpMethod/dpProof* summary, like Reservasi's syncDp. */
export function ringkasDpVipMkt(dps: DpVipMkt[]) {
  const total = dps.reduce((a, p) => a + (+(p.amount ?? 0) || 0), 0)
  const pertama = dps[0]
  return {
    dpStatus: total > 0 ? 'Sudah' : 'Belum',
    dpAmount: total,
    dpMethod: String(pertama?.method ?? ''),
    dpProofData: String(pertama?.proofData ?? ''),
    dpProofName: String(pertama?.proofName ?? ''),
  }
}

/** The full `vip-<id>` Reservasi record (vipSimpanKunci rec). */
export function barisReservasiVipMkt(v: VipMkt, dps: DpVipMkt[], perusahaan: string, namaPic: string, oleh: string, kini = Date.now()) {
  const ringkas = ringkasDpVipMkt(dps)
  return {
    id: `vip-${v.id}`,
    name: v.nama ?? '', phone: v.hp ?? '', date: v.tanggal ?? '', time: v.jamMulai ?? '',
    pax: vipPaxMkt(v), table: (v.meja ?? []).join(', '), sharing: false,
    category: 'Corporate / Gathering', foodReq: '', drinkReq: '',
    dps, docReqData: '', docReqName: '', source: 'Marketing', picType: 'Marketing',
    picName: namaPic, member: false, memberNo: '',
    notes: catatanVipMkt(v, perusahaan, namaPic), vip: true, status: 'Confirmed',
    actualPax: 0, checkinAt: 0, leftAt: 0, arrivals: [],
    createdBy: oleh, createdAt: kini, updatedAt: kini, followups: [],
    ...ringkas,
  }
}

/**
 * Update an EXISTING Reservasi row from its Marketing booking (owner request,
 * Nov 2026: a renamed guest, a moved date or new tables never reached
 * Reservasi). Only the fields Marketing owns are written — name, phone, date,
 * time, pax, tables, notes, PIC and the Marketing DP rows (merged so the
 * crew's own instalments and verifications stay). What the Reservasi crew
 * records on the day (status, check-in, arrivals, follow-ups, actual pax)
 * is never reset, unlike a fresh barisReservasiVipMkt.
 */
export function sinkronBarisReservasiVipMkt(lama: Record<string, unknown>, v: VipMkt, dpsBaru: DpVipMkt[], perusahaan: string, namaPic: string, kini = Date.now()) {
  const dps = gabungDpsVipMkt((Array.isArray(lama.dps) ? lama.dps : []) as DpVipMkt[], dpsBaru)
  const b = barisReservasiVipMkt(v, dps, perusahaan, namaPic, String(lama.createdBy ?? ''), kini)
  return {
    ...lama,
    name: b.name, phone: b.phone, date: b.date, time: b.time, pax: b.pax, table: b.table,
    notes: b.notes, picName: b.picName, vip: true, dps,
    ...ringkasDpVipMkt(dps),
    updatedAt: kini,
  }
}

/** Rebuild the Marketing row from its Reservasi row (vipDariReservasi).
 * Assisted on any doubt: it demands a nominal, so a wrong guess shows up as
 * a visible bill — never as silently uncounted turnover. */
export function vipDariReservasiMkt(r: Record<string, unknown>): VipMkt {
  const c = uraianCatatanVipMkt(String(r.notes ?? ''))
  const dps = (Array.isArray(r.dps) ? r.dps : []) as DpVipMkt[]
  return {
    id: vipIdDariResMkt(String(r.id ?? '')),
    jenis: c.jenis === 'Regular' ? 'Regular' : 'Assisted',
    nominal: '',
    menuFix: '',
    nama: String(r.name ?? ''),
    clientId: '',
    perusahaan: c.perusahaan,
    hp: String(r.phone ?? ''),
    tanggal: String(r.date ?? '').slice(0, 10),
    jamMulai: String(r.time ?? ''),
    jamSelesai: '',
    paxMin: (+(r.pax as number) || '') as number | string,
    paxMax: '',
    layoutReq: c.layoutReq,
    tv: c.tv, speaker: c.speaker,
    catatan: c.catatan,
    meja: String(r.table ?? '').split(',').map(x => x.trim()).filter(Boolean),
    mktPIC: '',
    resId: String(r.id ?? ''),
    bukti: dps.filter(p => p?.vipBuktiId).map(p => ({
      id: String(p.vipBuktiId ?? ''), nominal: +(p.amount ?? 0) || 0, metode: String(p.method ?? ''),
      name: String(p.proofName ?? ''), by: String(p.by ?? ''), at: p.at ?? '',
    })),
    createdBy: String(r.createdBy ?? ''),
    createdAt: new Date(+(r.createdAt as number) || Date.now()).toISOString(),
  }
}

/** Reservasi PIC name → Marketing user id, by name (vipUserDariNama). */
export const penggunaDariNamaMkt = (nama: string, users: { id: string, name: string }[]) =>
  users.find(u => String(u.name ?? '').toLowerCase() === String(nama ?? '').trim().toLowerCase())?.id ?? ''

// ---- table lock window (rsvMejaTerpakai, :15156-15245) ----
const hariKe = (tgl: string) => {
  const p = String(tgl ?? '').split('-').map(Number)
  return p[0] ? Math.floor(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) / 86400000) : 0
}
const keMenit = (jam?: string) => {
  const a = String(jam ?? '').split(':').map(Number)
  return jam ? (a[0] || 0) * 60 + (a[1] || 0) : 0
}
const menitMutlak = (tgl: string, jam?: string) => hariKe(tgl) * 1440 + keMenit(jam)
/** Local date of a timestamp — not toISOString (UTC reads 01:00 WIB as yesterday). */
const menitTs = (ts: number) => {
  const x = new Date(ts)
  return menitMutlak(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`, `${x.getHours()}:${x.getMinutes()}`)
}

/**
 * Tables held at `tanggal jam` by OTHER reservations → { table: guest name }.
 * A booking holds its table from 3 hours before its hour to 3 hours after (a seated guest:
 * from check-in for the dining estimate); bookings a day either side count
 * (02:00 locks from 23:00 the night before). Cancelled / no-show / left
 * guests and rows without an hour hold nothing.
 */
export function mejaTerpakaiVipMkt(rows: Record<string, unknown>[], tanggal: string, jam: string, kecualiId = '', estimasiDuduk = 180): Record<string, string> {
  const t = menitMutlak(tanggal, jam)
  const out: Record<string, string> = {}
  for (const r of rows) {
    const tgl = String(r?.date ?? '')
    if (!tgl || (kecualiId && r.id === kecualiId)) continue
    if (Math.abs(hariKe(tgl) - hariKe(tanggal)) > 1) continue
    if (vipResBatalMkt(r) || r.leftAt || !r.time) continue
    const mulaiJam = menitMutlak(tgl, String(r.time))
    const duduk = r.status === 'Datang'
    const awal = mulaiJam - VIP_LOCK_LEAD_MIN
    const akhir = duduk ? Math.max(mulaiJam, r.checkinAt ? menitTs(+(r.checkinAt as number)) : mulaiJam) + estimasiDuduk : mulaiJam + VIP_LOCK_LEAD_MIN
    if (awal > t || akhir < t) continue
    for (const m of String(r.table ?? '').split(',').map(x => x.trim()).filter(Boolean)) out[m] = String(r.name ?? '') || 'terpakai'
  }
  return out
}

/** Status a reopened booking returns to (vipStatusPulih, :16545): seated guests stay Datang. */
export const vipStatusPulihMkt = (r?: Record<string, unknown> | null) =>
  (r && (r.checkinAt || (Array.isArray(r.arrivals) && r.arrivals.length)) ? 'Datang' : 'Confirmed')

/** "HH:MM" or midnight when the hour is empty (lock window needs an hour). */
export const jamAtau00Mkt = (jam?: string) => (String(jam ?? '').slice(0, 5) || '00:00')

// ---------------------------------------------------------------- design requests

export const DR_JENIS_MKT = {
  design: { t: 'Desain', q: 'Design Queue' },
  edit: { t: 'Video / Editing', q: 'Editing Queue' },
} as const
export const DR_PRIO_MKT = [['urgent', 'Urgent'], ['high', 'Tinggi'], ['medium', 'Sedang'], ['low', 'Rendah']] as const
export const DR_PLATFORM_MKT = ['IG', 'TT', 'YT', 'FB', 'Website', 'Threads', 'Google'] as const
export const DR_KAT_MKT = [['open', 'Belum Selesai'], ['done', 'Sudah Selesai'], ['batal', 'Dibatalkan']] as const
export const DR_IMG_MB = 2
export const DR_TOTAL_MB = 6

/** Progress written back by Konten (designReqSet), read here. */
export type ProgDesainMkt = Record<string, { status?: string, picNama?: string, at?: string }>

export const drProgMkt = (prog: ProgDesainMkt, id: string) => (prog[id] && typeof prog[id] === 'object' ? prog[id] : null)
export const drSelesaiMkt = (r: RequestDesainMkt, prog: ProgDesainMkt) => {
  const p = drProgMkt(prog, r.id)
  return !!(p && p.status === 'done')
}
export function drStatusMkt(r: RequestDesainMkt, prog: ProgDesainMkt): string {
  if (r.batalAt) return 'Dibatalkan'
  return drSelesaiMkt(r, prog) ? 'Selesai' : 'Menunggu dikerjakan'
}

export function drHitungKatMkt(rows: RequestDesainMkt[], prog: ProgDesainMkt) {
  return {
    open: rows.filter(r => !r.batalAt && !drSelesaiMkt(r, prog)).length,
    done: rows.filter(r => drSelesaiMkt(r, prog)).length,
    batal: rows.filter(r => !!r.batalAt).length,
  }
}

/** Priority label; unknown → Sedang, like the old row. */
export const drPrioLabelMkt = (p?: string) => DR_PRIO_MKT.find(x => x[0] === p)?.[1] ?? 'Sedang'

/**
 * Deadline hint under the date (renderDesignReq row): "Hari ini", "H-n" or
 * "lewat n h" — only while the request is still open. '' otherwise.
 */
export function drSisaMkt(r: RequestDesainMkt, prog: ProgDesainMkt, hari: string): string {
  if (!r.deadline || r.batalAt || drSelesaiMkt(r, prog)) return ''
  const hariKe = (t: string) => Math.floor(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86400000)
  const rd = hariKe(r.deadline) - hariKe(hari)
  if (rd === 0) return 'Hari ini'
  return rd > 0 ? `H-${rd}` : `lewat ${-rd}h`
}

export type KatDesainMkt = 'open' | 'done' | 'batal' | 'semua'

export function drDataMkt(rows: RequestDesainMkt[], prog: ProgDesainMkt, jenis: string, kat: KatDesainMkt, q: string): RequestDesainMkt[] {
  const s = q.trim().toLowerCase()
  return rows.filter((r) => {
    if (jenis && r.jenis !== jenis) return false
    if (kat === 'open' && (r.batalAt || drSelesaiMkt(r, prog))) return false
    if (kat === 'done' && !drSelesaiMkt(r, prog)) return false
    if (kat === 'batal' && !r.batalAt) return false
    if (s && !`${r.judul ?? ''} ${r.brief ?? ''} ${r.acara ?? ''}`.toLowerCase().includes(s)) return false
    return true
  })
}

type RefDesainMkt = NonNullable<RequestDesainMkt['refs']>[number]

/** Raw photo gate before shrinking (drRefFoto, :15921): images only, 2 MB each. */
export function refFotoBesarMkt(nama: string, tipe: string, ukuran: number): string | null {
  if (!/^image\//.test(tipe)) return `${nama} bukan gambar — dilewati.`
  if (ukuran > DR_IMG_MB * 1024 * 1024) return `${nama} lebih dari ${DR_IMG_MB} MB — dilewati.`
  return null
}

/**
 * Total gate AFTER shrinking (:15926): the data URLs already in the request
 * plus the new one, against 6 MB of raw bytes (×1.37 for base64). Checked on
 * the total, not per file — five 2 MB photos each pass alone.
 */
export function refFotoPenuhMkt(refs: RefDesainMkt[], dataBaru: string): boolean {
  const terpakai = refs.filter(r => r.t === 'img').reduce((s, r) => s + (r.v?.length ?? 0), 0)
  return terpakai + dataBaru.length > DR_TOTAL_MB * 1024 * 1024 * 1.37
}

/**
 * Normalise a reference link (drRefLink, :15905): https:// added when missing
 * (a bare "ig.com/x" is a RELATIVE href that reopens the module). '' = empty.
 */
export function refLinkMkt(v: string): string {
  const s = v.trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) || /^mailto:/i.test(s) ? s : 'https://' + s.replace(/^\/+/, '')
}
