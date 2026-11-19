/**
 * Marketing › Reservasi VIP ↔ the module Reservasi (`vip-<id>` rows, F.8).
 * One place that writes the Reservasi row of a VIP booking, used by the table
 * lock (MarketingVipKunci) and by every save of the booking form (owner
 * request, Nov 2026: a renamed guest, a new date / hour or new tables must
 * reach Reservasi too, not only on "Simpan & Kunci").
 */
import type { DpVipMkt, VipMkt } from '~/utils/marketing'
import {
  barisReservasiVipMkt, dpsVipMkt, gabungDpsVipMkt, jamAtau00Mkt, mejaTerpakaiVipMkt, sinkronBarisReservasiVipMkt,
} from '~/utils/marketing-vip'
import { ifMatch, versiDari } from '~/utils/versi'
import { tambahHari } from '~/utils/format'

export const resIdVipMkt = (v: VipMkt) => v.resId || `vip-${v.id}`

/**
 * The table list of the venue. `GET /reservasi/master/{section}` answers the
 * section's value itself — for `tables` a plain string array — so it is read
 * as one (the old `{tables}` read always came back empty: "Modul Reservasi
 * belum punya daftar meja").
 */
export async function daftarMejaReservasi(): Promise<string[]> {
  const r = await useApi()<Envelope<unknown>>('/reservasi/master/tables')
  const v = r.data as unknown
  const arr = Array.isArray(v) ? v : (v && typeof v === 'object' && Array.isArray((v as { tables?: unknown }).tables) ? (v as { tables: unknown[] }).tables : [])
  return arr.map(x => String(x ?? '').trim()).filter(Boolean)
}

/** Seating estimate from the venue master (old vipDineEst), 180 fallback. */
async function estimasiDuduk(): Promise<number> {
  const r = await useApi()<Envelope<number>>('/reservasi/master/dineEstMin').catch(() => null)
  return Number(r?.data) > 0 ? Number(r?.data) : 180
}

/** Tables taken by other guests around the booking's date and hour. */
export async function mejaTerpakaiVip(v: VipMkt): Promise<Record<string, string>> {
  if (!v.tanggal) return {}
  const [rows, est] = await Promise.all([
    // A day either side: a 01:00 booking holds its table from 22:00 the night before.
    daftarReservasiSemua(tambahHari(v.tanggal, -1), tambahHari(v.tanggal, 1)),
    estimasiDuduk(),
  ])
  return mejaTerpakaiVipMkt(rows, v.tanggal, jamAtau00Mkt(v.jamMulai), resIdVipMkt(v), est)
}

/** '' when the booking's tables are free at its date & hour, else what clashes. */
export async function bentrokMejaVip(v: VipMkt): Promise<string> {
  const meja = v.meja ?? []
  if (!meja.length || !v.tanggal) return ''
  const pakai = await mejaTerpakaiVip(v)
  const bentrok = meja.filter(m => pakai[m])
  return bentrok.length ? bentrok.map(m => `meja ${m} (${pakai[m]})`).join(', ') : ''
}

async function berkasKeData(url?: string): Promise<string> {
  if (!url) return ''
  const kunci = url.split('/marketing/files/')[1] ?? url.split('/files/')[1] ?? ''
  if (!kunci) return ''
  const blob = await useApi()<Blob>(`/marketing/files/${encodeURIComponent(decodeURIComponent(kunci))}`, { responseType: 'blob' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!)
  return btoa(bin)
}

/**
 * Write the booking into Reservasi: an existing row is updated in place
 * under its version (If-Match) keeping what the crew recorded; a missing one
 * is created whole. DP proofs travel as data, like the old vipDpsUntukReservasi.
 */
export async function kirimVipKeReservasi(v: VipMkt, o: { perusahaan: string, namaPic: string, oleh: string }) {
  const api = useApi()
  const resId = resIdVipMkt(v)
  const dps = dpsVipMkt(v, o.oleh)
  for (const d of dps) {
    const b = (v.bukti ?? []).find(x => x.id === d.vipBuktiId)
    if (!b?.url) continue
    try {
      d.proofData = await berkasKeData(b.url)
    }
    catch {
      // The amount still goes; the proof follows on the next save.
    }
  }
  const ada = await api<Envelope<Record<string, unknown>>>(`/reservasi/reservations/${encodeURIComponent(resId)}`).catch((e: unknown) => {
    if ((e as { statusCode?: number })?.statusCode === 404) return null
    throw e
  })
  if (ada?.data) {
    const baris = sinkronBarisReservasiVipMkt(ada.data, v, dps, o.perusahaan, o.namaPic)
    const versi = versiDari(ada) ?? (ada.data.updatedAt as number | undefined)
    await api(`/reservasi/reservations/${encodeURIComponent(resId)}`, { method: 'PUT', body: baris, headers: ifMatch(versi ?? 0) })
  }
  else {
    const baris = barisReservasiVipMkt(v, gabungDpsVipMkt([] as DpVipMkt[], dps), o.perusahaan, o.namaPic, o.oleh)
    await api('/reservasi/reservations', { method: 'POST', body: baris })
  }
  return resId
}
