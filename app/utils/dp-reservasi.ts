// DP instalments — the money side of a reservation, in pure functions.
//
// One Dana Masuk row = one instalment (`dps[]`). A booking's first instalment is
// written by the Input form; later instalments are added from Dana Masuk
// ("Tambah Bukti TF DP"), which is why these live here and not inside either
// screen: both read and write the same list, and two copies of "what is the
// total" is how a receipt gets issued for the wrong number.
//
// Owned by reservasi (PLAN.md §4), imported by DanaMasukPanel and kwitansi.

import type { Reservasi, ReservasiDp } from '~/composables/useReservasi'

/** The instalments of a booking, never undefined (`:1410`). */
export const dpsOf = (r?: Reservasi | null): ReservasiDp[] => (Array.isArray(r?.dps) ? r.dps : [])

/**
 * The FINAL total of all instalments, and always the number shown in Recap and
 * in the CSV (28 July 2026 request). A deposit paid in three goes out as ONE
 * number; the number of transfers is only mentioned as a note, so whoever
 * matches it against the bank statement is not looking for a single transfer of
 * that size.
 *
 * `dpTotal()` is used while `dps[]` is filled rather than `dpAmount`: they
 * should be equal (syncDp() copies one to the other), but `dpAmount` only
 * updates when syncDp() has run, while the total is recomputed from `dps[]` on
 * every read.
 */
export const dpTotal = (r?: Reservasi | null) => dpsOf(r).reduce((a, p) => a + (Number(p.amount) || 0), 0)

/** Verification runs per TRANSFER, not per booking: instalment 1 can be verified while instalment 2 is still being checked (`:1494-1500`). */
export const dpTerverifikasi = (r?: Reservasi | null) => dpsOf(r).filter(p => p.tfStatus === 'verified')

export const dpJumlahTerverifikasi = (r?: Reservasi | null) =>
  dpTerverifikasi(r).reduce((a, p) => a + (Number(p.tfAmount) > 0 ? Number(p.tfAmount) : (Number(p.amount) || 0)), 0)

/** The first instalment's method, the one the form shows. */
export const dpMetode = (r?: Reservasi | null) => dpsOf(r)[0]?.method || ''

/** Is there a proof anywhere on this booking? Either the flat field or an instalment. */
export function adaBuktiDp(r?: Reservasi | null): boolean {
  if (!r) return false
  if (r.dpProofData) return true
  return dpsOf(r).some(p => !!p?.proofData)
}

/** The first default method: the first QRIS one, else the first (`:1490-1493`). */
export function dpMetodeBawaan(dpMethods?: string[]): string {
  const list = dpMethods ?? []
  return list.find(v => /qris/i.test(String(v))) || list[0] || ''
}

/** A fresh instalment (`:1555-1561`), with every field the old client wrote. */
export function dpBaru(nama: string, at = Date.now()): ReservasiDp {
  return {
    id: uid(),
    amount: 0,
    method: '',
    proofData: '',
    proofName: '',
    by: nama,
    at,
    tfDate: '',
    tfTime: '',
    tfBank: '',
    tfName: '',
    tfAmount: 0,
    tfStatus: '',
    tfNote: '',
    tfSource: '',
    tfBy: '',
    tfAt: 0,
    tfOcrAt: 0,
    tfOcrText: '',
    tfOcrSaran: null,
  }
}

/** Old data (one deposit, flat fields) is lifted into a first instalment (`:1502-1509`). */
export function pastikanDps(r: Reservasi): Reservasi {
  if (!Array.isArray(r.dps)) r.dps = []
  if (!r.dps.length && r.dpStatus === 'Sudah' && ((Number(r.dpAmount) || 0) > 0 || r.dpProofData)) {
    r.dps = [{
      ...dpBaru(r.dpMethod || '', r.updatedAt || Date.now()),
      amount: Number(r.dpAmount) || 0,
      method: r.dpMethod || '',
      proofData: r.dpProofData || '',
      proofName: r.dpProofName || '',
    }]
  }
  return r
}

/** A new proof invalidates the old scan of it (`:1562-1565`). */
export function resetDpScan(p: ReservasiDp): ReservasiDp {
  p.tfDate = ''
  p.tfTime = ''
  p.tfBank = ''
  p.tfName = ''
  p.tfAmount = 0
  p.tfStatus = ''
  p.tfSource = ''
  p.tfOcrAt = 0
  p.tfOcrText = ''
  p.tfOcrSaran = null
  return p
}

/**
 * Keep the flat fields and `dps[]` in step (`:1537-1553`).
 * With no instalments at all: the host says the money has not come in, so EVERY
 * trace of the old deposit is cleared — including the scan results still sitting
 * in the flat fields. Left there, ensureDps() could bring the whole thing back
 * later. With instalments: dpAmount is the total, and the flat fields mirror
 * the FIRST one, which is what the old links read.
 */
export function syncDp(r: Reservasi): Reservasi {
  if (!Array.isArray(r.dps)) r.dps = []
  r.dpAmount = dpTotal(r)
  if (r.dps.length) {
    r.dpStatus = 'Sudah'
    r.dpMethod = r.dps[0]?.method || ''
    r.dpProofData = r.dps[0]?.proofData || ''
    r.dpProofName = r.dps[0]?.proofName || ''
  }
  else {
    r.dpStatus = 'Belum'
    r.dpMethod = ''
    r.dpProofData = ''
    r.dpProofName = ''
    r.tfDate = ''
    r.tfTime = ''
    r.tfBank = ''
    r.tfName = ''
    r.tfAmount = 0
    r.tfStatus = ''
    r.tfNote = ''
    r.tfSource = ''
    r.tfBy = ''
    r.tfAt = 0
    r.tfOcrAt = 0
    r.tfOcrText = ''
  }
  r.updatedAt = Date.now()
  return r
}

/** Row ids: "r" + time in base36 + a few random characters (`:3266`). */
export const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** "62" + the rest, from any way of writing an Indonesian number (`:3295`). */
export function normPhone(p?: string | null): string {
  let x = String(p ?? '').replace(/\D/g, '')
  if (x.startsWith('0')) x = `62${x.slice(1)}`
  else if (x.startsWith('62')) { /* already in the stored form */ }
  else if (x.length > 0 && !x.startsWith('62')) x = `62${x}`
  return x
}

/** "0812 3456" -> "62812345…" — what the form shows back after saving (`:3285-3292`). */
export function tampilPhone(p?: string | null): string {
  const x = normPhone(p)
  if (!x) return ''
  if (x.startsWith('62')) return `0${x.slice(2)}`
  return x
}

/* ------------------------------------------------------------------ Dana Masuk
   One panel row = one transfer (`:8997-9016`, `:9358-9391`, `:9175-9213`).
   Source: laksamana-office/deploy/reservasi/index.html (line numbers inline). */

/** One Dana Masuk row: the booking, the instalment, "DP ke-n dari m". */
export interface TxDanaMasuk {
  r: Reservasi
  p: ReservasiDp
  ke: number
  dari: number
}

/**
 * A booking whose flat deposit was never lifted into `dps[]`, as a read-only
 * first instalment — the same condition as `pastikanDps()` (`:1502-1509`), but
 * WITHOUT writing anything back. The list is shared state; a read must not
 * mutate it. The id is stable (`<resId>#dp0`): a fresh `uid()` per recompute
 * would remount every rendered row.
 */
export function dpsTampilan(r: Reservasi): ReservasiDp[] {
  if (dpsOf(r).length) return dpsOf(r)
  if (r.dpStatus === 'Sudah' && ((Number(r.dpAmount) || 0) > 0 || r.dpProofData)) {
    return [{
      ...dpBaru(r.dpMethod || '', r.updatedAt || Date.now()),
      id: `${r.id}#dp0`,
      amount: Number(r.dpAmount) || 0,
      method: r.dpMethod || '',
      proofData: r.dpProofData || '',
      proofName: r.dpProofName || '',
    }]
  }
  return []
}

/**
 * Every transfer with money behind it, across the loaded rows (`:8998-9008`).
 * Empty rows (no amount, no proof) carry no money and are skipped.
 */
export function txSemua(baris: Reservasi[]): TxDanaMasuk[] {
  const keluar: TxDanaMasuk[] = []
  for (const r of baris) {
    const daftar = dpsTampilan(r)
    daftar.forEach((p, i) => {
      if (!Number(p.amount) && !p.proofData) return
      keluar.push({ r, p, ke: i + 1, dari: daftar.length })
    })
  }
  return keluar
}

/** Transfer date, falling back to the booking date (`:9009`). */
export const txTanggal = (x: TxDanaMasuk): string => x.p.tfDate || x.r.date || ''

/** Transfer time (`:9010`). */
export const txJam = (x: TxDanaMasuk): string => x.p.tfTime || ''

/** "Transfer BCA" -> "BCA": the guess before the proof is scanned (`:8997`). */
export const bankDariMetode = (m?: string | null): string => String(m ?? '').replace(/^transfer\s+/i, '').trim()

/** The bank, or the method guess (`:9010`). */
export const txBank = (x: TxDanaMasuk): string => x.p.tfBank || bankDariMetode(x.p.method)

/** The sender's account name (`:9011`). */
export const txNama = (x: TxDanaMasuk): string => x.p.tfName || ''

/** The money: the proof's number wins over what the host typed (`:9012`). */
export const txNominal = (x: TxDanaMasuk): number =>
  Number(x.p.tfAmount) > 0 ? Number(x.p.tfAmount) : (Number(x.p.amount) || 0)

/** Has anyone or anything read this proof (`:9013`). */
export const txSudahScan = (x: TxDanaMasuk): boolean => !!(x.p.tfOcrAt || x.p.tfDate || x.p.tfTime)

/** A `@f:` reference is an image unless its name says pdf; inline data must say `data:image` (`:2501`). */
export function buktiAdalahGambar(data?: string | null, name?: string | null): boolean {
  if (typeof data === 'string' && data.startsWith('@f:')) return !/\.pdf$/i.test(String(name ?? ''))
  return String(data ?? '').startsWith('data:image')
}

/** Only image proofs can be scanned (`:9014`). */
export const txBuktiGambar = (x: TxDanaMasuk): boolean => !!x.p.proofData && buktiAdalahGambar(x.p.proofData, x.p.proofName)

/**
 * The proof's number disagrees with what the host typed — needs a check (`:9016`).
 * Both have to be positive: a zero on either side is "not read yet", not a mismatch.
 */
export function txSelisih(x: TxDanaMasuk): boolean {
  const a = Number(x.p.tfAmount) || 0
  const b = Number(x.p.amount) || 0
  return a > 0 && b > 0 && a !== b
}

/** Verified instalments of one booking (`:1496`). */
export const dpHitungTerverifikasi = (r?: Reservasi | null): number =>
  dpsOf(r).filter(p => p && p.tfStatus === 'verified').length

/** Columns still empty on a transfer, for the verification dialog (`:9894-9900`). */
export function kurangDataTf(p: ReservasiDp, bank: string): string[] {
  const kurang: string[] = []
  if (!p.tfDate) kurang.push('tanggal transfer')
  if (!(Number(p.tfAmount) > 0)) kurang.push('nominal di bukti')
  if (!bank) kurang.push('bank')
  if (!p.tfName) kurang.push('nama pengirim')
  return kurang
}

/** The panel's summary numbers (`:9369-9391`). `total` leaves out rejected transfers: refused money never came in. */
export interface RingkasDanaMasuk {
  total: number
  terverifikasi: number
  belum: number
  ditolak: number
  tanpaBukti: number
  belumScan: number
  selisih: number
  cicilan: number
  perlu: number
  sudah: number
  tolak: number
  perBank: { bank: string, n: number, sum: number }[]
}

export function ringkasDanaMasuk(semua: TxDanaMasuk[]): RingkasDanaMasuk {
  const jumlah = (arr: TxDanaMasuk[]) => arr.reduce((a, x) => a + txNominal(x), 0)
  const terverifikasi = semua.filter(x => x.p.tfStatus === 'verified')
  const ditolak = semua.filter(x => x.p.tfStatus === 'rejected')
  const belum = semua.filter(x => !x.p.tfStatus)
  const perBankMap = new Map<string, { n: number, sum: number }>()
  // The old recap sums the bank over the whole range, rejected included — kept.
  for (const x of semua) {
    const b = txBank(x) || '(tanpa bank)'
    const e = perBankMap.get(b) ?? { n: 0, sum: 0 }
    e.n++
    e.sum += txNominal(x)
    perBankMap.set(b, e)
  }
  return {
    total: jumlah(semua.filter(x => x.p.tfStatus !== 'rejected')),
    terverifikasi: jumlah(terverifikasi),
    belum: jumlah(belum),
    ditolak: jumlah(ditolak),
    tanpaBukti: semua.filter(x => !x.p.proofData).length,
    belumScan: semua.filter(x => !txSudahScan(x) && txBuktiGambar(x)).length,
    selisih: semua.filter(txSelisih).length,
    cicilan: semua.filter(x => x.dari > 1).length,
    perlu: belum.length,
    sudah: terverifikasi.length,
    tolak: ditolak.length,
    perBank: [...perBankMap.entries()]
      .map(([bank, v]) => ({ bank, ...v }))
      .sort((a, b) => b.sum - a.sum),
  }
}

/** The panel's filters (`:9060-9076`, `:9175-9213`). Date range defaults to TODAY on the booking date, not the transfer date. */
export interface SaringDanaMasuk {
  basis: 'reservasi' | 'masuk'
  dari: string
  sampai: string
  bank: string
  status: '' | 'belumScan' | 'selisih'
  q: string
  tab: 'perlu' | 'sudah' | 'tolak'
}

export function saringDanaMasuk(semua: TxDanaMasuk[], f: SaringDanaMasuk, pakaiTab: boolean): TxDanaMasuk[] {
  const dalam = (d: string) => !!d && (!f.dari || d >= f.dari) && (!f.sampai || d <= f.sampai)
  const q = f.q.trim().toLowerCase()
  return semua.filter((x) => {
    if (!dalam(f.basis === 'masuk' ? txTanggal(x) : x.r.date)) return false
    if (f.bank && txBank(x) !== f.bank) return false
    if (f.status === 'belumScan' && txSudahScan(x)) return false
    if (f.status === 'selisih' && !txSelisih(x)) return false
    if (pakaiTab) {
      const st = x.p.tfStatus
      if (f.tab === 'perlu' && (st === 'verified' || st === 'rejected')) return false
      if (f.tab === 'sudah' && st !== 'verified') return false
      if (f.tab === 'tolak' && st !== 'rejected') return false
    }
    if (q && !((x.r.name || '').toLowerCase().includes(q) || (x.r.phone || '').includes(q)
      || txBank(x).toLowerCase().includes(q) || txNama(x).toLowerCase().includes(q))) return false
    return true
  }).sort((a, b) => (txTanggal(b) + txJam(b)).localeCompare(txTanggal(a) + txJam(a)))
}

/**
 * Flat fields mirroring `dps[]` for a PATCH body — what `syncDp()` writes
 * (`:1537-1553`) minus the `updatedAt` stamp, which the server owns.
 */
export function cerminDp(dps: ReservasiDp[]): Pick<Reservasi, 'dpStatus' | 'dpMethod' | 'dpAmount' | 'dpProofData' | 'dpProofName'> {
  if (!dps.length) return { dpStatus: 'Belum', dpMethod: '', dpAmount: 0, dpProofData: '', dpProofName: '' }
  const p0 = dps[0]!
  return {
    dpStatus: 'Sudah',
    dpMethod: p0.method || '',
    dpAmount: dps.reduce((a, p) => a + (Number(p.amount) || 0), 0),
    dpProofData: p0.proofData || '',
    dpProofName: p0.proofName || '',
  }
}

type TfUtama = Pick<Reservasi, 'tfDate' | 'tfTime' | 'tfBank' | 'tfName' | 'tfAmount' | 'tfStatus' | 'tfNote' | 'tfSource' | 'tfBy' | 'tfAt' | 'tfOcrAt' | 'tfOcrText'>

/**
 * Flat transfer fields mirroring the FIRST instalment, for old links. Only sent
 * when instalment 0 is the one being written; with no instalments at all the
 * host says the money has not come in, so every trace is cleared with it.
 */
export function cerminTfUtama(dps: ReservasiDp[]): TfUtama {
  const kosong: TfUtama = {
    tfDate: '', tfTime: '', tfBank: '', tfName: '', tfAmount: 0, tfStatus: '',
    tfNote: '', tfSource: '', tfBy: '', tfAt: 0, tfOcrAt: 0, tfOcrText: '',
  }
  const p0 = dps[0]
  if (!p0) return kosong
  return {
    tfDate: p0.tfDate, tfTime: p0.tfTime, tfBank: p0.tfBank, tfName: p0.tfName,
    tfAmount: p0.tfAmount, tfStatus: p0.tfStatus, tfNote: p0.tfNote, tfSource: p0.tfSource,
    tfBy: p0.tfBy, tfAt: p0.tfAt, tfOcrAt: p0.tfOcrAt, tfOcrText: p0.tfOcrText,
  }
}
