// Cashier — API calls + types. Cashier has no backend of its own: everything
// lives in the kompas blob and is written PART BY PART (T-03, U4), never with
// PUT /state. Each part carries its own version, so two people editing
// different days or sections never conflict.
//
// Contract: laksamana-api/docs/api/kompas.md "Granular parts of the blob".
import type { Bon, ComplimentKasir, DailyReport, RokokHari, RokokItem, VoidBaris, VoidSetting } from '~/utils/cashier'
import type { EmployeesKompas } from '~/utils/porsi-pic'
import type { BarisHarian } from '~/utils/kompas'
import type { AbaiBri, BarisBri } from '~/utils/cocok-bri'
import type { RosterUser } from '~/composables/useRoster'
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

// ---- Rekap Penjualan (Kas Kecil) ----
// The narrow write (`simpanRekap`): only the panel's own marks survive. It
// writes `setor`, `mdr`, `aktual`, `mdrManual` and the POS flag `esb` — NEVER
// `pay`. The server computes deposit amounts and recomputes `setor`.

export interface RekapHari {
  setor?: boolean
  /** Objects keyed by payment group — the legacy shape the server stores. */
  mdr?: Record<string, number | string> | number | string
  aktual?: Record<string, number | string> | number | string
  mdrManual?: Record<string, number | string> | number | string
  esb?: Record<string, boolean> | string | boolean
  [k: string]: unknown
}

export interface RekapHasil {
  saved: boolean
  ubah?: unknown
  hari?: unknown
  takDikenal?: unknown
  setoran?: unknown[]
}

export function putRekap(body: { hari?: Record<string, RekapHari>, setoran?: { tambah?: unknown[], hapus?: string[] } }, version?: Versi) {
  return useApi()<Envelope<RekapHasil>>('/kompas/rekap', { method: 'PUT', body, headers: version === undefined ? undefined : ifMatch(version) })
}

// ---- Performa Kasir (read-only, one whole-blob read) ----
// The screen needs every daily row of the range INCLUDING `bd` (the event
// deductions), `employees` (also written by Kompas, synced from the roster per
// T-01 U2) and `compliments`. `/daily?from&to` deliberately drops `bd`, so the
// blob read is the correct source here (kompas.md "Endpoints", module cashier).

export interface KompasState {
  daily?: BarisHarian[]
  employees?: EmployeesKompas
  compliments?: ComplimentKasir[]
  owners?: string[]
  piutang?: Bon[]
  reports?: Record<string, DailyReport>
  rekap_setoran?: unknown[]
  [k: string]: unknown
}

export const getKompasState = () => baca<KompasState>('/kompas/state', {})
export const putEmployees = (v: EmployeesKompas, version: Versi) =>
  putBagianKompas<EmployeesKompas>('employees', v, version)

/**
 * `GET /kompas/days/{date}` — all daily rows of one date, replaced together.
 *
 * Shape drift (lane B2, local API 2026-10-08): the mock answered
 * `{rows: [...]}` but the real API answers a bare array `[...]`
 * (KompasState::part `day`). Normalise both to `{rows}` so the callers
 * (`omset/input.vue`, `omset/breakdown.vue`) never see an empty day and
 * never overwrite a day's breakdown with a single fresh row.
 */
export const getDay = async (date: string): Promise<Part<{ rows: BarisHarian[] }>> => {
  const res = await useApi()<Envelope<{ rows: BarisHarian[] } | BarisHarian[] | null>>(`/kompas/days/${date}`)
  const shape = Array.isArray(res.data) ? { rows: res.data } : (res.data ?? { rows: [] })
  return { value: shape, version: versiDari(res) ?? '' }
}
export const putDay = async (date: string, rows: BarisHarian[], version: Versi): Promise<Part<{ rows: BarisHarian[] }>> => {
  const res = await useApi()<Envelope<{ rows: BarisHarian[] } | BarisHarian[]>>(`/kompas/days/${date}`, {
    method: 'PUT', body: { rows }, headers: ifMatch(version),
  })
  const shape = Array.isArray(res.data) ? { rows: res.data } : res.data
  return { value: shape, version: versiDari(res) ?? '' }
}

/** `GET /account/roster` — raw Tim/Keterangan, open to every signed-in user. */
export const getRoster = async (): Promise<RosterUser[]> =>
  (await useApi()<Envelope<RosterUser[]>>('/account/roster')).data ?? []

// ---- Pencocokan QRIS BRI (module cashier or finance, kompas.md "QRIS BRI") ----

export interface BriList {
  baris: BarisBri[]
  total: number
  maks: number
  abai: AbaiBri[]
  /** dpId held by a live row ANYWHERE (older backends only) — v1 does not return it. */
  dipakai?: string[]
}

export async function getBri(from: string, to: string): Promise<BriList> {
  const res = await useApi()<Envelope<Partial<BriList>>>(`/kompas/bri?from=${from}&to=${to}`)
  const d = res.data ?? {}
  return { baris: d.baris ?? [], total: d.total ?? 0, maks: d.maks ?? 2000, abai: d.abai ?? [], dipakai: d.dipakai }
}

export type BriCara = 'cocok' | 'bukan' | 'lepas'

export interface BriMatchItem {
  id: string
  cara: BriCara
  resId?: string
  dpId?: string
  resNama?: string
  resTgl?: string
  catatan?: string
}

export interface BriHasil {
  saved: boolean
  n: number
  gagal: { id: string, sebab: string }[]
}

/** One row, or `{items}` for a bulk apply — each row stands alone on the server. */
export function matchBri(body: BriMatchItem | { items: BriMatchItem[] }) {
  return useApi()<Envelope<BriHasil>>('/kompas/bri/match', { method: 'POST', body })
}

/** A manual incoming fund that is not a reservation DP; `ket` is required. */
export function addBriManual(body: { tgl: string, jam?: string, nominal: number, ket: string }) {
  return useApi()<Envelope<{ id: string }>>('/kompas/bri', { method: 'POST', body })
}

/** Cancel a mutation row (never deletes); If-Match = the row's `diubah`. */
export function cancelBri(id: string, alasan: string, version: Versi) {
  return useApi()<Envelope<{ saved: boolean }>>(`/kompas/bri/${id}/cancel`, { method: 'POST', body: { alasan }, headers: ifMatch(version) })
}

/** Mark a reservation DP as not a valid BRI fund; the DP itself is untouched. */
export function ignoreBriDp(body: { dpId: string, resId?: string, nama?: string, tgl?: string, nominal?: number, alasan: string }) {
  return useApi()<Envelope<{ saved: boolean }>>('/kompas/bri/ignored', { method: 'POST', body })
}

export function unignoreBriDp(dpId: string) {
  return useApi()<Envelope<{ saved: boolean }>>(`/kompas/bri/ignored/${encodeURIComponent(dpId)}`, { method: 'DELETE' })
}

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
