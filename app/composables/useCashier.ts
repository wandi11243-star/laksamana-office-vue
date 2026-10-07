// Cashier — API calls + types. Cashier has no backend of its own: everything
// lives in the kompas blob and is written PART BY PART (T-03, U4), never with
// PUT /state. Each part carries its own version, so two people editing
// different days or sections never conflict.
//
// Contract: laksamana-api/docs/api/kompas.md "Granular parts of the blob".
import type { Bon, ComplimentKasir, DailyReport, RokokHari, RokokItem, VoidBaris, VoidSetting } from '~/utils/cashier'
import { ifMatch, versiDari, type Versi } from '~/utils/versi'

export interface Part<T> {
  value: T
  version: Versi
}

async function baca<T>(path: string, kosong: T): Promise<Part<T>> {
  const res = await useApi()<Envelope<T | null>>(path)
  return { value: res.data ?? kosong, version: versiDari(res) ?? '' }
}

async function tulis<T>(path: string, body: Record<string, unknown>, version: Versi): Promise<Part<T>> {
  const res = await useApi()<Envelope<T>>(path, { method: 'PUT', body, headers: ifMatch(version) })
  return { value: res.data, version: versiDari(res) ?? '' }
}

/** One top-level key of the blob (`piutang`, `owners`, `compliments`, …). */
export const getBagianKompas = <T>(key: string, kosong: T) => baca<T>(`/kompas/sections/${key}`, kosong)
export const putBagianKompas = <T>(key: string, value: T, version: Versi) => tulis<T>(`/kompas/sections/${key}`, { value }, version)

/** One Daily Report (`reports[date]`). Null = not submitted yet. */
export const getReport = (date: string) => baca<DailyReport | null>(`/kompas/reports/${date}`, null)
export const putReport = (date: string, value: DailyReport, version: Versi) =>
  tulis<DailyReport>(`/kompas/reports/${date}`, { value }, version)

export const getPiutang = () => getBagianKompas<Bon[]>('piutang', [])
export const putPiutang = (v: Bon[], version: Versi) => putBagianKompas<Bon[]>('piutang', v, version)
export const getOwners = () => getBagianKompas<string[]>('owners', [])
export const putOwners = (v: string[], version: Versi) => putBagianKompas<string[]>('owners', v, version)
export const getCompliments = () => getBagianKompas<ComplimentKasir[]>('compliments', [])
export const putCompliments = (v: ComplimentKasir[], version: Versi) => putBagianKompas<ComplimentKasir[]>('compliments', v, version)

// ---- Rokok (Daily Stock, rekap, setelan item) ----
// One date map (`rokok`) and one item list (`rokok_items`), each its own part
// with its own version (kompas.md "Granular parts of the blob").

export const getRokok = () => getBagianKompas<Record<string, RokokHari>>('rokok', {})
export const putRokok = (v: Record<string, RokokHari>, version: Versi) => putBagianKompas<Record<string, RokokHari>>('rokok', v, version)
export const getRokokItems = () => getBagianKompas<RokokItem[]>('rokok_items', [])
export const putRokokItems = (v: RokokItem[], version: Versi) => putBagianKompas<RokokItem[]>('rokok_items', v, version)
/** Back to the built-in list: `PUT /sections/{key}` with `value: null` removes the part. */
export const hapusRokokItems = (version: Versi) => tulis<null>('/kompas/sections/rokok_items', { value: null }, version)

// ---- Catatan Void (own table void_log, NOT the blob: granular rows) ----
// `diubah` of each row (ms) is its version; the setting carries its own.

export interface VoidList { baris: VoidBaris[], total: number, maks: number, setting: VoidSetting }

/** Rows of a date range, newest first; `total` is counted before the 1500 limit. */
export async function getVoidKasir(from: string, to: string): Promise<VoidList> {
  const res = await useApi()<Envelope<VoidList>>('/kompas/voids', { query: { from, to } })
  return res.data
}

/** A whole bill in one transaction; the server computes each `nominal`. */
export interface VoidBersama { tgl: string, bill: string, penginput: string, salah: string, alasan: string, service: number, tax: number }
export function postVoidKasir(body: VoidBersama & { items: { item: string, subtotal: number }[] }) {
  return useApi()<Envelope<{ n: number, ids: string[] }>>('/kompas/voids', { method: 'POST', body })
}

/** Edit ONE row (not once cancelled). */
export function putVoidKasir(id: string, body: VoidBersama & { item: string, subtotal: number }, version: Versi) {
  return useApi()<Envelope<unknown>>(`/kompas/voids/${encodeURIComponent(id)}`, { method: 'PUT', body, headers: ifMatch(version) })
}

/** Cancelled, never deleted: the row stays, struck through. Reason required. */
export function batalVoidKasir(id: string, alasan: string, version: Versi) {
  return useApi()<Envelope<unknown>>(`/kompas/voids/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { alasan }, headers: ifMatch(version) })
}

/** Module admin of cashier or finance only; the server is the real guard. */
export function putVoidSettingKasir(body: { tax: number, service: number }, version: Versi) {
  return useApi()<Envelope<{ setting?: VoidSetting }>>('/kompas/voids/settings', { method: 'PUT', body, headers: ifMatch(version) })
}
