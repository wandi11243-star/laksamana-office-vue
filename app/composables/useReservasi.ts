// Reservasi API calls + types — one Backend shared by two Panels (Reservasi and
// Service Excellent), so everything here is mounted under /api/v1/reservasi.
//
// Field names are exactly the ones stored in each row's `data` JSON, the same
// fields the old client wrote: the contract keeps them as they are
// (laksamana-api/docs/api/reservasi.md "Envelope"). Nothing is renamed here.
//
// Versioning (fondasi F1): a reservation's version IS its `updatedAt` in ms.
// `GET /reservations/{id}` returns the authoritative one in `meta.version`; a
// list returns the raw rows with no per-row version, so use `updatedAt` from
// the row you are editing — or re-read that one row before a risky write.
// Every write takes the version it read; without it the API answers 428.
//
//   try { await patchReservation(id, { status: 'Datang' }, versi) }
//   catch (e) { if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' }) }
//
import type { LayoutDenah } from '~/utils/venue-layouts'
import type { PerformaPeriode, RingkasKeseluruhan } from '~/utils/analitik'

// G-07 (guest summary) and G-08 (server paging + CSV export) are wired now
// (docs/migrasi/reservasi.md J.4), plus the version-only poll `ver` below.
// Still without a v1 endpoint on purpose: the diagnostics `ping` / `stats`
// (U3 — not a screen feature). Dana Masuk keeps its paging in the browser:
// its table shows one row per TRANSFER while the API pages reservations.

/** Reservation status. "Booking" was the old Marketing value; the client maps it to "Confirmed". */
export type StatusReservasi = 'Pending' | 'Confirmed' | 'Datang' | 'Cancelled' | 'No-show'

/** Transfer check state of a DP. Empty = not verified yet; "rejected" still blocks the receipt. */
export type TfStatus = '' | 'verified' | 'rejected'

/** One arrival wave of a booking that comes in stages. */
export interface ReservasiArrival {
  pax: number
  at?: number
  by?: string
  [key: string]: unknown
}

/** Permission to share a table that is still locked by someone else. Single use, bound to table + date + time. */
export interface IzinTumpang {
  meja: string
  date: string
  time: string
  lawan: string
  by: string
  at: number
}

/** The newest 20 activity entries of one reservation, kept by the server. */
export interface ReservasiLog {
  ts: number
  by: string
  role: string
  action: string
  detail: string
}

/** One DP instalment. One row in Dana Masuk = one instalment. */
export interface ReservasiDp {
  id: string
  amount: number
  method: string
  proofData: string
  proofName: string
  by: string
  at: number
  // Transfer data read from the proof (scan) or typed in "Cek / Edit".
  tfDate: string
  tfTime: string
  tfBank: string
  tfName: string
  tfAmount: number
  tfStatus: TfStatus
  tfNote: string
  tfSource: string
  tfBy: string
  tfAt: number
  tfOcrAt: number
  tfOcrText: string
  /** OCR output is a suggestion only, never a filled-in value. */
  tfOcrSaran?: { date: string, time: string, bank: string, name: string, amount: number } | null
  /** Columns left empty when this transfer was verified from the picture (`:9894-9942`). */
  tfTanpaData?: string
}

/** A reservation row, exactly as the old client stored it. */
export interface Reservasi {
  id: string
  name: string
  phone: string
  date: string
  time: string
  pax: number
  table: string
  sharing: boolean
  category: string
  foodReq: string
  drinkReq: string
  dpStatus: 'Sudah' | 'Belum'
  dpMethod: string
  dpAmount: number
  lunas: boolean
  dpProofData: string
  dpProofName: string
  dps: ReservasiDp[]
  docReqData: string
  docReqName: string
  source: string
  picType: string
  picName: string
  member: boolean
  memberNo: string
  notes: string
  vip: boolean
  status: StatusReservasi
  createdBy: string
  createdAt: number
  updatedAt: number
  actualPax: number | null
  arrivals: ReservasiArrival[]
  checkinAt: number | null
  /** The tables a guest was moved off while waiting, so they can be put back. The old form rebuilds the record from an explicit field list and does NOT copy this one (`:4850-4890`), so an edit can drop it. Kept in the type because the day-of map reads it; Tahap 3 must decide. */
  tableAsli?: string
  /** Marker for "counted as arrived at closing time". */
  datangDiasumsikan: 0 | 1
  leftAt: number
  followups: { ts: number, by: string, note: string }[]
  izinTumpang: IzinTumpang | null
  log: ReservasiLog[]
  cancelReason: string
  // Transfer fields of the first instalment, kept in step with dps[0] for old links.
  tfDate: string
  tfTime: string
  tfBank: string
  /** The sender's name as read from the proof. Dana Masuk writes it; the old form builder (`:4850-4890`) forgot it, so an edit there dropped it. Copied by the new form, and noted in reservasi.md bagian J. */
  tfName?: string
  tfAmount: number
  tfStatus: TfStatus
  tfNote: string
  tfSource: string
  tfBy: string
  tfAt: number
  tfOcrAt: number
  tfOcrText: string
}

/** One queue entry of guests waiting for a table. */
export interface Waitlist {
  id: string
  name: string
  phone: string
  pax: number
  note: string
  date: string
  addedAt: number
  by: string
  /** 'cancelled' keeps the row as a trace; the queue only shows 'waiting'. */
  status: 'waiting' | 'seated' | 'cancelled'
  seatedAt: number
  table: string
  resId: string
  calledAt: number
  /** Set when leaving the queue, like the old client (`:1954`). */
  cancelledAt?: number
}

/** `master.perms` — 0 not visible, 1 view, 2 may edit; per permission row, per role. */
export type Perms = Record<string, Record<string, 0 | 1 | 2>>

/** The master blob. Every key is optional: the server keeps what is stored, and the old client's defaults are only its own fallback. */
export interface Master {
  tables?: string[]
  dpMethods?: string[]
  infoSources?: string[]
  categories?: string[]
  waTargets?: { id: string, name: string, type: string, detail: string, includeDP: boolean, fields: string[] }[]
  users?: { id: string, name: string, role: string }[]
  perms?: Perms
  dineEstMin?: number
  clashLeadMin?: number
  layouts?: Record<string, LayoutDenah>
  layoutOverrides?: Record<string, string>
  layoutOverrides2?: Record<string, string>
  layoutTanggal?: Record<string, LayoutDenah>
  /** getDay() numbers that use the weekend plan; see hariWeekend() in venue-layouts. */
  hariWeekend?: number[]
  waitlist?: Waitlist[]
  reviews?: unknown[]
  reviewCfg?: unknown
  feedbacks?: unknown[]
  sePerms?: Perms
  seCrew?: unknown[]
  [key: string]: unknown
}

/** Sections of the master that carry items with their own id (PUT/DELETE /master/{section}/{id}). */
export type SectionItem = 'reviews' | 'feedbacks' | 'waitlist'

/** One audit row, newest first. Append-only, trimmed to 500 by the server. */
export interface AuditRow {
  id: string
  ts: number
  user: string
  role: string
  action: string
  detail?: string
  /** Set when the action belongs to a reservation row. */
  res?: string
}

/** A photo or pdf: `{key, data}`, where data is a data: URI or an `@f:<key>` reference. */
export interface FileData {
  key: string
  data: string
}

/** The version of a row: `meta.version` when the read sent one, else the row's `updatedAt`. */
export const versiReservasi = (res: { meta?: Record<string, unknown> }, row?: Reservasi): Versi | undefined =>
  versiDari(res) ?? row?.updatedAt

/** One crew row of `master.users`: the Reservasi panel's own role per person. */
export interface KruReservasi {
  id: string
  name: string
  role: string
  pin?: string
}

/** The two inputs of the in-module role matrix (`master.users` + `master.perms`). */
export interface PeranReservasi {
  users: KruReservasi[]
  perms: Perms | null
}

/** The loaded matrix, shared by every screen's `Layar.boleh` (app/utils/layar/reservasi.ts). */
export const usePeranReservasi = () => useState<PeranReservasi>('reservasi-peran', () => ({ users: [], perms: null }))

/** Load `master.users` and `master.perms` once, on the module home. */
export const muatPeranReservasi = () => {
  const state = usePeranReservasi()
  const { data: users } = useSection<KruReservasi[]>('users')
  const { data: perms } = useSection<Perms>('perms')
  watchEffect(() => {
    state.value = { users: users.value ?? [], perms: perms.value ?? null }
  })
  return state
}

// ---------------------------------------------------------------- reads

/** One DP instalment as `GET /reservasi/dps` sends it: flattened exactly like
 *  the old `muatDp` (field names as the API sends them). */
export interface DpInstalmen {
  resId: string
  dpId: string
  nama: string
  resTgl: string
  tfTgl: string
  tfJam: string
  bank: string
  metode: string
  status: string
  nominal: number | string
  diketik: number | string
  bukti: string
  buktiNama: string
}

/** GET /reservations?from&to — rows whose date is in range, in created_at order.
 *  `q` (name/phone/table) and `status` (normalised) narrow it on the server;
 *  without them the answer is exactly what it always was. */
export const listReservations = (from?: string, to?: string, q?: string, status?: string) =>
  useApi()<Envelope<Reservasi[]> & { meta: { total: number, ver: number } }>('/reservasi/reservations', {
    query: {
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
      status: status || undefined,
    },
  })

/**
 * GET /reservasi/dps?tfFrom&tfTo — DP instalments in range, flattened like
 * `muatDp` (api#311). The range picks the transfer date OR the reservation
 * date and keeps instalments without a transfer date (twin of `dpsBulan()`);
 * without bounds every instalment counts. Read-only, open through the Dana
 * Masuk door (G-14), so cashier/finance holders may call it too.
 */
export const listDpsReservasi = (tfFrom?: string, tfTo?: string) =>
  useApi()<Envelope<DpInstalmen[]>>('/reservasi/dps', {
    query: {
      tfFrom: tfFrom || undefined,
      tfTo: tfTo || undefined,
    },
  })

/**
 * GET /reservasi/ver — the global `_ver` counter, a few dozen bytes. The
 * dashboard map tab polls this every tick and skips its window pull while
 * the counter is unchanged; ANY failure (network, 4xx, unknown shape) falls
 * back to the full pull — never a blank screen (twin of the old
 * `VER_TAK_ADA` fallback, deploy/reservasi:3118-3119).
 */
export const getReservasiVer = (from?: string, to?: string) =>
  useApi()<Envelope<{ ver: number }>>('/reservasi/ver', {
    query: {
      from: from || undefined,
      to: to || undefined,
    },
  })

/**
 * The reactive window every Reservasi screen filters from (dashboard, Dana
 * Masuk, riwayat, analitik). `key` keeps two screens on the same page from
 * sharing one `useAsyncData` slot with different dates. `saring` is
 * server-side narrowing only (G-08 `q`/`status`, no paging): the screen still
 * owns filtering and slicing, exactly as before when it is unset.
 * When `aktif` is provided and false, the fetcher returns [] without calling
 * the API and watches `aktif` to run when enabled.
 */
export const useDaftarReservasi = (
  from: Ref<string>,
  to: Ref<string>,
  key = 'reservasi-daftar',
  saring?: Ref<{ q?: string, status?: string }>,
  aktif?: Ref<boolean>,
) =>
  useAsyncData(
    key,
    () => {
      // Skip API request when inactive, returning an empty list
      if (aktif && !aktif.value) return Promise.resolve([] as Reservasi[])
      return listReservations(from.value, to.value, saring?.value?.q, saring?.value?.status).then(r => r.data)
    },
    { watch: [from, to, ...(saring ? [saring] : []), ...(aktif ? [aktif] : [])], default: () => [] },
  )

/**
 * The red counts of the Reservasi chrome: today's bookings still Pending, on the
 * Dashboard menu item and as the bell dot (`deploy/reservasi/index.html:3819`,
 * the same rule as the dashboard's "Perlu follow up").
 */
export function useLencanaReservasi() {
  // Read from the shared canonical today query to avoid fetching today's list twice
  const { data } = useReservasiHariIni()
  return computed<Record<string, number>>(() => {
    const followUp = (data.value ?? []).filter(r => r.status === 'Pending').length
    return { dashboard: followUp, lonceng: followUp }
  })
}

/**
 * Today's reservations under ONE canonical key (#147): the Beranda widgets
 * each fetched the same day under their own key. Writers keep calling their
 * refresh() (always refetches); the TTL bounds staleness elsewhere.
 */
export function useReservasiHariIni() {
  const hari = hariIni()
  return useAsyncData('reservasi-hari-ini', async () => {
    const r = await listReservations(hari, hari).then(r => r.data)
    stempelCache('reservasi-hari-ini')
    return r
  }, { dedupe: 'defer', default: () => [] as Reservasi[], getCachedData: bacaCache() })
}

/** GET /reservations/{id} — one row, with the authoritative `meta.version`. */
export const getReservation = (id: string) => useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${id}`)

// ---------------------------------------------------------------- G-07: guest summary

/**
 * One guest-summary entry, the legacy `ringkas_tamu` shape
 * (`reservasi-mysql/lib_reservasi_mysql.php:713-748`):
 * `[n, datang, noshow, member, memberNo, vip, kunjunganTerakhir, jumlahPax, namaPertama, namaTerakhir]`.
 */
export type RingkasanTamu = [number, number, number, number, string, number, string, number, string, string]

/**
 * The whole-history map, keyed WITHOUT the legacy `k` prefix (stripped on
 * load, like the old `muatRingkasTamu`). The window rows join it without
 * double counting — see `profilTamuGabung` in app/utils/riwayat.ts.
 */
export type PetaRingkasan = Map<string, RingkasanTamu>

/**
 * GET /reservasi/guests/summary — the Loyal / blacklist / autofill profile
 * over the WHOLE history. `before` bounds it (twin of legacy `sebelum`):
 * only reservations dated before it count. `phone` narrows the map to one
 * number. Keys in the answer carry the legacy `k` prefix.
 */
export const getGuestsSummary = (before?: string, phone?: string) =>
  useApi()<Envelope<{ sebelum: string | null, tamu: Record<string, RingkasanTamu> }> & { meta: { ver: number } }>(
    '/reservasi/guests/summary',
    { query: { before: before || undefined, phone: phone || undefined } },
  )

/**
 * GET /reservasi/analytics?mode=harian|bulanan&date= — the Analitik screen's
 * numbers computed on the server (api#311), so the client no longer pulls
 * the whole table. harian takes date=YYYY-MM-DD, bulanan date=YYYY-MM.
 * `periode` is the performaPeriode shape, `ringkasan` the ringkasKeseluruhan
 * shape over the whole table; `label` echoes the input (the screen formats
 * it for display itself).
 */
export const getReservasiAnalytics = (mode: 'harian' | 'bulanan', date: string) =>
  useApi()<Envelope<{ periode: PerformaPeriode, ringkasan: RingkasKeseluruhan }>>(
    '/reservasi/analytics',
    { query: { mode, date } },
  )

/**
 * The summary for one window start. Pass the window's `dari`: the summary
 * covers everything dated before it, the window everything from it on, so
 * the two never overlap. Skipped while `before` is empty — an unbounded
 * summary would be the whole table, which the window already holds.
 */
export const useRingkasanTamu = (before: Ref<string | undefined>, key = 'reservasi-tamu') =>
  useAsyncData(
    key,
    async () => {
      const m: PetaRingkasan = new Map()
      if (!before.value) return m
      const { data } = await getGuestsSummary(before.value)
      for (const [k, v] of Object.entries(data.tamu ?? {})) m.set(k.startsWith('k') ? k.slice(1) : k, v)
      return m
    },
    { watch: [before], default: () => new Map<string, RingkasanTamu>() },
  )

// ---------------------------------------------------------------- G-08: server paging + export

/** Server-paged reservation filter. `q` matches name/phone/table; `status` compares the normalised status. */
export interface FilterHalamanReservasi {
  from?: string
  to?: string
  q?: string
  status?: string
  page?: number
  perPage?: number
}

export interface MetaHalaman {
  total: number
  ver?: number
  /** Hidden-cancelled count for this filter set; only sent with a `status`. */
  batal?: number
  page?: number
  perPage?: number
}

/**
 * GET /reservations with the G-08 params. Always sent WITH page/perPage here,
 * so `meta.total` counts every match and the rows come in Recap display order
 * (date+time, stable). Without a `status` every row stays — including
 * Cancelled, unlike the screen's default view, which is why callers only use
 * this when a status is chosen.
 */
export const listReservationsHalaman = (f: FilterHalamanReservasi) =>
  useApi()<Envelope<Reservasi[]> & { meta: MetaHalaman }>('/reservasi/reservations', {
    query: {
      from: f.from || undefined,
      to: f.to || undefined,
      q: f.q || undefined,
      status: f.status || undefined,
      page: f.page ?? 1,
      // The API caps a page at 100 rows — clamp here so a big literal
      // never turns into a 422 (marketing VIP sweep hit this, #139).
      perPage: Math.min(f.perPage ?? 10, 100),
    },
  })

/**
 * GET /reservasi/reservations in one call (S1): table-lock windows must see
 * every row. Without `page`/`perPage`/`q`/`status` the answer is exactly what
 * it always was — every row in `created_at` order
 * (laksamana-api/docs/api/reservasi.md §Paging) — so no paging loop is needed.
 * Callers only build a set from this; order does not matter.
 */
export async function daftarReservasiSemua(from: string, to: string): Promise<Record<string, unknown>[]> {
  const r = await useApi()<Envelope<Record<string, unknown>[]>>('/reservasi/reservations', {
    query: { from, to },
  })
  return r.data ?? []
}

/**
 * GET /reservations/export — the same filter as the list, as CSV for Excel
 * (BOM'd by the server). Paging is ignored: the export always covers every
 * matching row, in display order. Callers narrow it to what the server can
 * express (from/to/q/status).
 */
export const exportReservationsCsv = (f: Pick<FilterHalamanReservasi, 'from' | 'to' | 'q' | 'status'>) =>
  useApi()<Blob>('/reservasi/reservations/export', {
    query: {
      from: f.from || undefined,
      to: f.to || undefined,
      q: f.q || undefined,
      status: f.status || undefined,
    },
    responseType: 'blob',
  })

/**
 * GET /audit with `q` + paging (G-08). `q` searches user, role, action and
 * detail — the twin of the screen's search — and `meta.total` counts every
 * match. Without the new params the answer would be the newest 500 with no
 * `meta`; this caller always pages, so `meta` is always there.
 */
export const listAuditHalaman = (q?: string, page = 1, perPage = 10) =>
  useApi()<Envelope<AuditRow[]> & { meta: { total: number, page: number, perPage: number } }>('/reservasi/audit', {
    // The API caps a page at 100 rows — clamp here so a big literal never 422s.
    query: { q: q || undefined, page, perPage: Math.min(perPage, 100) },
  })

/** GET /master — the whole blob. Bootstrap and migrations only; screens read their own section. */
export const getMaster = () => useApi()<Envelope<Master>>('/reservasi/master')

// --- Master section batching state ---
interface SectionWaiter {
  resolve: (value: Envelope<unknown>) => void
  reject: (reason?: unknown) => void
}

const pendingSections = new Map<string, SectionWaiter[]>()
let sectionFlushTimer: ReturnType<typeof setTimeout> | null = null
let batchMasterSectionsSupported = true
const MAX_SECTIONS_PER_BATCH = 30

async function flushPendingSections() {
  sectionFlushTimer = null
  const currentBatch = new Map(pendingSections)
  pendingSections.clear()

  const allNames = Array.from(currentBatch.keys())
  if (!allNames.length) return

  // Split into chunks of at most 30 section names
  const chunks: string[][] = []
  for (let i = 0; i < allNames.length; i += MAX_SECTIONS_PER_BATCH) {
    chunks.push(allNames.slice(i, i + MAX_SECTIONS_PER_BATCH))
  }

  // Fallback helper to query an individual section endpoint
  const fetchSingle = (name: string, waiters: SectionWaiter[]) => {
    useApi()<Envelope<unknown>>(`/reservasi/master/${name}`)
      .then((res) => {
        for (const w of waiters) w.resolve(res)
      })
      .catch((err) => {
        for (const w of waiters) w.reject(err)
      })
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      // If batching is disabled or only 1 section requested, use the single endpoint directly
      if (!batchMasterSectionsSupported || chunk.length === 1) {
        for (const name of chunk) {
          const waiters = currentBatch.get(name) || []
          fetchSingle(name, waiters)
        }
        return
      }

      try {
        const res = await useApi()<{
          data: Record<string, { value: unknown, version: string }>
          meta?: { ver?: number }
        }>('/reservasi/master-sections', {
          query: { names: chunk.join(',') },
        })

        for (const name of chunk) {
          const waiters = currentBatch.get(name) || []
          const entry = res?.data?.[name]
          if (entry !== undefined) {
            const envelope: Envelope<unknown> = {
              data: entry.value,
              meta: {
                version: entry.version,
                ver: res.meta?.ver,
              },
            }
            for (const w of waiters) w.resolve(envelope)
          }
          else {
            // Missing from batch response; fall back to individual fetch
            fetchSingle(name, waiters)
          }
        }
      }
      catch (err) {
        // A 404 indicates the batch endpoint is not deployed; disable batching for this session
        const e = err as { status?: number, statusCode?: number, response?: { status?: number } }
        const status = e?.status ?? e?.statusCode ?? e?.response?.status
        if (status === 404) {
          batchMasterSectionsSupported = false
        }

        // Fall back to single endpoint per section so each waiter gets its own result/error
        for (const name of chunk) {
          const waiters = currentBatch.get(name) || []
          fetchSingle(name, waiters)
        }
      }
    }),
  )
}

/**
 * GET /master/{section} — one independently versioned section, with `meta.version` + `ETag`.
 * Coalesces calls made in the same tick into a single `GET /reservasi/master-sections?names=...`
 * request (up to 30 names per batch). If only one name is requested or if the batch request fails
 * for any reason (404 before deployment, 403, network), it falls back to the single endpoint per name.
 * A 404 permanently disables batching for the session.
 */
export const getSection = <T = unknown>(section: string): Promise<Envelope<T>> => {
  return new Promise<Envelope<T>>((resolve, reject) => {
    let list = pendingSections.get(section)
    if (!list) {
      list = []
      pendingSections.set(section, list)
    }
    list.push({ resolve: v => resolve(v as Envelope<T>), reject })

    // setTimeout 0 ensures calls from multiple useAsyncData setups in the same tick coalesce
    if (!sectionFlushTimer) {
      sectionFlushTimer = setTimeout(flushPendingSections, 0)
    }
  })
}

/** A WhatsApp target from the master section `waTargets`. `includeDP` is the same
 *  flag the old coordination screen encoded in its two hard-coded cards. */
export interface WaTarget {
  id: string
  name: string
  /** 'group' has no number: the text is copied and the coordinator pastes it. */
  type: 'group' | 'contact'
  detail: string
  includeDP: boolean
  fields: string[]
}

/** The reactive read of one master section. */
export const useSection = <T = unknown>(section: string) =>
  useAsyncData(`reservasi-section-${section}`, () => getSection<T>(section).then(r => r.data), { dedupe: 'defer', default: () => undefined })

/**
 * One master section with its ENVELOPE kept. A section write needs that
 * section's own version, and `useAsyncData` throws `meta` away — so a caller
 * that has to write the section must read it this way.
 *
 * The key carries a `-versi` suffix on purpose: `useSection` above caches the
 * bare value under `reservasi-section-${section}`, and sharing that key made
 * every envelope read see the bare value after visiting another screen
 * (empty dropdowns and "0 m" on Master Data, role list gone).
 */
export const useSectionVersi = <T = unknown>(section: string) =>
  useAsyncData(`reservasi-section-${section}-versi`, () => getSection<T>(section), { dedupe: 'defer' })

/** GET /audit — the newest 500 rows, newest first. */
export const getAudit = () => useApi()<Envelope<AuditRow[]>>('/reservasi/audit')

export const useAudit = () =>
  useAsyncData('reservasi-audit', () => getAudit().then(r => r.data), { dedupe: 'defer', default: () => [] })

/** GET /files/{key} — a photo or pdf. */
export const getFile = (key: string) => useApi()<Envelope<FileData>>(`/reservasi/files/${key}`)

// ---------------------------------------------------------------- writes

const headers = (versi?: Versi) => (versi === undefined ? undefined : ifMatch(versi))

/** POST /reservations. `id` is optional; `_audit` adds the audit line in the same transaction. */
export const createReservation = (body: Partial<Reservasi> & { _audit?: { action: string, detail?: string, res?: string } }) =>
  useApi()<Envelope<Reservasi>>('/reservasi/reservations', { method: 'POST', body })

/** PUT /reservations/{id} — replace (createdAt kept). */
export const updateReservation = (id: string, body: Partial<Reservasi>, versi?: Versi) =>
  useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${id}`, { method: 'PUT', body, headers: headers(versi) })

/** PATCH /reservations/{id} — shallow merge of the top-level fields. */
export const patchReservation = (id: string, fields: Partial<Reservasi>, versi?: Versi) =>
  useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${id}`, { method: 'PATCH', body: fields, headers: headers(versi) })

/** DELETE /reservations/{id} — also removes that reservation's photo files. */
export const deleteReservation = (id: string, versi?: Versi) =>
  useApi()<{ deleted: string, id: string }>(`/reservasi/reservations/${id}`, { method: 'DELETE', headers: headers(versi) })

/** PUT /master — the whole blob. Prefer section writes. */
export const putMaster = (value: Master, versi?: Versi) =>
  useApi()<Envelope<Master>>('/reservasi/master', { method: 'PUT', body: { value }, headers: headers(versi) })

/** PUT /master/{section} — one section; `null` removes it. */
export const putSection = (section: string, value: unknown, versi?: Versi) =>
  useApi()<Envelope<unknown>>(`/reservasi/master/${section}`, { method: 'PUT', body: { value }, headers: headers(versi) })

/** PUT /master/{section}/{id} — one item of reviews / feedbacks / waitlist. The id must match the URL. */
export const putSectionItem = <T extends { id: string }>(section: SectionItem, id: string, value: T, versi?: Versi) =>
  useApi()<Envelope<T>>(`/reservasi/master/${section}/${id}`, { method: 'PUT', body: { value }, headers: headers(versi) })

/** DELETE /master/{section}/{id} — the removed item's proof files go with it. */
export const deleteSectionItem = (section: SectionItem, id: string, versi?: Versi) =>
  useApi()<{ deleted: string, id: string }>(`/reservasi/master/${section}/${id}`, { method: 'DELETE', headers: headers(versi) })

/** POST /audit — an action that belongs to no reservation row (settings, roles, review targets). */
export const postAudit = (body: { action: string, detail?: string, res?: string }) =>
  useApi()<{ ok: true }>('/reservasi/audit', { method: 'POST', body })

/** PUT /files/{key} — empty `data` deletes the file. */
export const putFile = (key: string, data: string) =>
  useApi()<{ ok: true }>(`/reservasi/files/${key}`, { method: 'PUT', body: { data } })

// ---------------------------------------------------------------- the table plan
// Five master sections, each with its own content-hash version, so two people
// editing the plan and the per-date schedule never collide. The rules that read
// them (which plan applies on a date, which floor a template belongs to) and the
// editor's data helpers live in app/utils/venue-layouts.ts — this is transport.

export const SECTION_LAYOUT = ['layouts', 'layoutOverrides', 'layoutOverrides2', 'layoutTanggal', 'hariWeekend'] as const
export type SectionLayout = typeof SECTION_LAYOUT[number]

/**
 * The plan sections (and the weekend days) with their versions, in one read.
 * The envelope is kept whole, because a section write needs its own version and
 * `useAsyncData` throws the `meta` away.
 */
export const useDenah = () => {
  const sections = {
    layouts: useSectionVersi<Record<string, LayoutDenah>>('layouts'),
    layoutOverrides: useSectionVersi<Record<string, string>>('layoutOverrides'),
    layoutOverrides2: useSectionVersi<Record<string, string>>('layoutOverrides2'),
    layoutTanggal: useSectionVersi<Record<string, LayoutDenah>>('layoutTanggal'),
    hariWeekend: useSectionVersi<number[]>('hariWeekend'),
  }

  const master = computed<Master>(() => ({
    layouts: sections.layouts.data.value?.data,
    layoutOverrides: sections.layoutOverrides.data.value?.data,
    layoutOverrides2: sections.layoutOverrides2.data.value?.data,
    layoutTanggal: sections.layoutTanggal.data.value?.data,
    hariWeekend: sections.hariWeekend.data.value?.data ?? undefined,
  }))

  /** Each section's own version, for `putDenah(section, value, versi)`. */
  const versi = computed<Record<SectionLayout, Versi | undefined>>(() => ({
    layouts: versiDari(sections.layouts.data.value),
    layoutOverrides: versiDari(sections.layoutOverrides.data.value),
    layoutOverrides2: versiDari(sections.layoutOverrides2.data.value),
    layoutTanggal: versiDari(sections.layoutTanggal.data.value),
    hariWeekend: versiDari(sections.hariWeekend.data.value),
  }))

  const status = computed(() => (Object.values(sections).some(s => s.status.value === 'pending') ? 'pending' : 'success'))

  return { ...sections, master, versi, status }
}

/** Write one plan section. Its version goes back in `If-Match`; the caller handles a conflict with tanganiKonflik(). */
export const putDenah = (section: SectionLayout, value: unknown, versi?: Versi) => putSection(section, value, versi)
