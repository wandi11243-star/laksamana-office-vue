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
