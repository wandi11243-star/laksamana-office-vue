// Cashier — API calls + types. Cashier has no backend of its own: everything
// lives in the kompas blob and is written PART BY PART (T-03, U4), never with
// PUT /state. Each part carries its own version, so two people editing
// different days or sections never conflict.
//
// Contract: laksamana-api/docs/api/kompas.md "Granular parts of the blob".
import type { Bon, ComplimentKasir, DailyReport } from '~/utils/cashier'
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
