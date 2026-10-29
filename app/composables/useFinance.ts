import { ifMatch, versiDari, type Versi } from '~/utils/versi'
import type { InvestorBrankas, MutasiBrankas, SettingBrankas } from '~/utils/brankas'
import type { BayarTagihan, Tagihan } from '~/utils/tagihan'

// Finance invoice calls used by reservasi's kwitansi flow.
//
// Owned by the finance module; reservasi only borrows the three calls its
// receipt needs (PLAN.md §4: `kwitansi.ts` owned by reservasi, used later by
// marketing). Callers need any of the `finance`, `reservasi`, `marketing`
// modules (laksamana-api/docs/api/finance.md "Invoices & kwitansi").

/** The printable document of an issued request (`GET /invoices/file/{resId}`). */
export interface BerkasKwitansi {
  jenis: string
  no: string
  putusOleh: string
  putusAt: number | string
  cap: string
  penanda: { nama: string, jabatan: string, ttd: string }[]
  /** Stamped: the sheet prints plain — no signatures or stamp, enforced server-side. */
  materai?: boolean
  /** Marketing's text overrides (Kepada, U.P, per-row Keterangan), or null when never edited. */
  ubah?: UbahInvoice | null
}

/** Marketing's text overrides on its issued invoice — text only, never numbers. */
export interface UbahInvoice {
  kepada?: string
  up?: string
  ket?: { asal?: string, teks?: string }[]
  oleh?: string
  at?: number
}

/** A kwitansi request row, as `GET /invoices/status?res=` reports it. */
export interface StatusKwitansi {
  id?: string
  resId?: string
  jenis?: string
  status: 'MENUNGGU' | 'DIBUAT' | 'DITOLAK'
  no?: string
  mintaOleh?: string
  mintaAt?: number
  catatan?: string
  materai?: boolean
  ubah?: UbahInvoice | null
}

/**
 * POST /finance/invoices/requests — idempotent per resId: an issued one comes
 * back untouched, a waiting or rejected one becomes a live request.
 */
export const mintaKwitansi = (body: { resId: string, jenis?: string, ringkas?: unknown }) =>
  useApi()<Envelope<StatusKwitansi>>('/finance/invoices/requests', { method: 'POST', body })

/** GET /finance/invoices/status?res=a,b,… — at most 400 ids: chunked + merged (S2). */
export const statusKwitansi = async (resIds: string[]): Promise<Envelope<Record<string, StatusKwitansi>> & { meta?: { versions?: Record<string, Versi> } }> => {
  const out: Record<string, StatusKwitansi> = {}
  const versions: Record<string, Versi> = {}
  for (let i = 0; i < resIds.length; i += 400) {
    const r = await useApi()<Envelope<Record<string, StatusKwitansi>> & { meta?: { versions?: Record<string, Versi> } }>('/finance/invoices/status', {
      query: { res: resIds.slice(i, i + 400).join(',') },
    })
    Object.assign(out, r.data ?? {})
    Object.assign(versions, r.meta?.versions ?? {})
  }
  return { data: out, meta: { versions } }
}

/** GET /finance/invoices/file/{resId} — the printable document, or 404 `not_issued`. */
export const berkasKwitansi = (resId: string) =>
  useApi()<Envelope<BerkasKwitansi>>(`/finance/invoices/file/${resId}`)

// ════════════════════════════════════════════════════════════════════════════
// Kas Kecil (`/finance/petty-cash`), the payment plan in the vault blob, and
// the vault itself for Brankas. Contract: laksamana-api/docs/api/finance.md.
//
// Versions are content hashes: a list read carries `meta.versions` keyed by id,
// a single read carries `meta.version`. Writes send it as If-Match. The whole
// vault blob has ONE version (`meta.version`) for every list.
// ════════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------- Kas Kecil

export interface KkBaris { pos_id: string, debet: number, kredit: number }
export interface KkTrx {
  id: string
  tgl: string
  keterangan: string
  kategori_id?: string | null
  input?: boolean
  bon?: boolean
  dibuat_oleh?: string
  baris: KkBaris[]
}
export interface KkItem { id: string, nama: string, urut?: number, aktif?: boolean }
export type KkList = 'sources' | 'categories'
export type KkTingkat = 0 | 1 | 2
export interface KkAkses {
  matrix: Record<string, Record<string, number>>
  roles: Record<string, string>
}
export interface KkState {
  pos: KkItem[]
  kategori: KkItem[]
  trx: KkTrx[]
  /** role → page → tingkat (the stored matrix; absent = default). */
  akses: Record<string, Record<string, number>>
  /** '#<userId>' or '@<lower name>' → role. */
  peran: Record<string, string>
}

const VERSIONS = (m?: Record<string, unknown>) => (m?.versions ?? {}) as Record<string, Versi>

/** Bootstrap (`getAll`): pos, kategori, trx, akses, peran. */
export const getKk = () => useApi()<Envelope<KkState>>('/finance/petty-cash/')

/** `GET /transactions?from&to` + `meta.versions` per row. */
export async function getKkTrx(from?: string, to?: string) {
  const r = await useApi()<Envelope<KkTrx[]> & { meta?: Record<string, unknown> }>('/finance/petty-cash/transactions', { query: { from, to } })
  return { trx: r.data, versions: VERSIONS(r.meta) }
}
/** One transaction with its split rows + `meta.version` (needed for an edit). */
export async function getKkTrxSatu(id: string) {
  const r = await useApi()<Envelope<KkTrx>>(`/finance/petty-cash/transactions/${id}`)
  return { trx: r.data, version: versiDari(r) }
}
export function createKkTrx(body: Partial<KkTrx>) {
  return useApi()<Envelope<{ id: string }>>('/finance/petty-cash/transactions', { method: 'POST', body })
}
/** PUT replaces the transaction and rewrites its split rows. */
export function updateKkTrx(id: string, body: Partial<KkTrx>, versi: Versi) {
  return useApi()<Envelope<KkTrx>>(`/finance/petty-cash/transactions/${id}`, { method: 'PUT', body, headers: ifMatch(versi) })
}
/** PATCH only the administrative ticks. */
export function patchKkTrx(id: string, body: { input?: boolean, bon?: boolean }, versi: Versi) {
  return useApi()<Envelope<KkTrx>>(`/finance/petty-cash/transactions/${id}`, { method: 'PATCH', body, headers: ifMatch(versi) })
}
export function deleteKkTrx(id: string, versi: Versi) {
  return useApi()<{ deleted: boolean }>(`/finance/petty-cash/transactions/${id}`, { method: 'DELETE', headers: ifMatch(versi) })
}

/** `GET /sources` or `/categories` + `meta.versions` per row. */
export async function getKkItems(list: KkList) {
  const r = await useApi()<Envelope<KkItem[]> & { meta?: Record<string, unknown> }>(`/finance/petty-cash/${list}`)
  return { items: r.data, versions: VERSIONS(r.meta) }
}
export function createKkItem(list: KkList, body: { nama: string, urut?: number }) {
  return useApi()<Envelope<KkItem>>(`/finance/petty-cash/${list}`, { method: 'POST', body })
}
export function updateKkItem(list: KkList, id: string, body: Partial<KkItem>, versi: Versi) {
  return useApi()<Envelope<KkItem>>(`/finance/petty-cash/${list}/${id}`, { method: 'PATCH', body, headers: ifMatch(versi) })
}
export function deleteKkItem(list: KkList, id: string, versi: Versi) {
  return useApi()<{ deleted: boolean }>(`/finance/petty-cash/${list}/${id}`, { method: 'DELETE', headers: ifMatch(versi) })
}

export async function getKkAkses() {
  const r = await useApi()<Envelope<KkAkses> & { meta?: Record<string, unknown> }>('/finance/petty-cash/access')
  return { akses: r.data, version: versiDari(r), roleVersions: (r.meta?.roleVersions ?? {}) as Record<string, Versi> }
}
export function putKkMatrix(matrix: Record<string, Record<string, number>>, versi: Versi) {
  return useApi()<Envelope<KkAkses>>('/finance/petty-cash/access/matrix', { method: 'PUT', body: { matrix }, headers: ifMatch(versi) })
}
export function putKkRole(userId: string, role: string, versi: Versi | undefined) {
  return useApi()<Envelope<unknown>>(`/finance/petty-cash/access/roles/${encodeURIComponent(userId)}`, { method: 'PUT', body: { role }, headers: versi === undefined ? undefined : ifMatch(versi) })
}

// ---------------------------------------------------------------- Planning Pembayaran (bayar list in the vault blob)

export interface RencanaBayar {
  id: string
  vendor?: string
  keterangan?: string
  kategori?: string
  dari?: string
  amount?: number
  batch?: string
  status?: 'scheduled' | 'paid' | string
  bukti?: { ok?: boolean, [k: string]: unknown }
  name?: string
  cat?: string
  [k: string]: unknown
}

/** The payment plan + the vault blob version (one version for the whole blob). */
export async function getBayar() {
  const r = await useApi()<Envelope<{ bayar?: RencanaBayar[] } | RencanaBayar[] | null> & { meta?: Record<string, unknown> }>('/finance/petty-cash/payment-plan')
  // B2: the mock answered `{bayar: [...]}` but the real API answers a bare
  // array `[...]` (same drift as 32ae90f for /kompas/days). Without this the
  // screen reads an empty plan and saving would overwrite the stored one.
  const shape = Array.isArray(r.data) ? r.data : (r.data?.bayar ?? [])
  return { bayar: shape, version: versiDari(r) }
}
export function putBayar(bayar: RencanaBayar[], versi: Versi) {
  return useApi()<Envelope<unknown>>('/finance/petty-cash/payment-plan', { method: 'PUT', body: { bayar }, headers: ifMatch(versi) })
}

// ---------------------------------------------------------------- Tagihan Rutin (VUE-14, `/finance/tagihan`)
//
// No versioning (the legacy actions carry none); the one real race — two
// people paying the same due date — is guarded by the server (422 naming who
// paid first). No DELETE: payments are cancelled, tagihan deactivated. Until
// the old PHP has created the tables the API answers 503 `tagihan_unavailable`.

export type IsiTagihan = Pick<Tagihan, 'nama' | 'kategori' | 'nominal' | 'siklus' | 'mulai' | 'metode' | 'catatan'>
export interface IsiBayarTagihan { periode: string, tglBayar: string, nominal: number, catatan: string }

export async function getTagihan(): Promise<{ tagihan: Tagihan[], bayar: BayarTagihan[] }> {
  const r = await useApi()<Envelope<{ tagihan?: Tagihan[], bayar?: BayarTagihan[] }>>('/finance/tagihan')
  return {
    tagihan: Array.isArray(r.data?.tagihan) ? r.data.tagihan : [],
    bayar: Array.isArray(r.data?.bayar) ? r.data.bayar : [],
  }
}
export function createTagihan(body: Partial<IsiTagihan>) {
  return useApi()<Envelope<Tagihan>>('/finance/tagihan', { method: 'POST', body })
}
export function updateTagihan(id: number, body: Partial<IsiTagihan>) {
  return useApi()<Envelope<Tagihan>>(`/finance/tagihan/${id}`, { method: 'PATCH', body })
}
export function setAktifTagihan(id: number, aktif: boolean) {
  return useApi()<Envelope<Tagihan>>(`/finance/tagihan/${id}/active`, { method: 'PUT', body: { aktif } })
}
export function bayarTagihan(id: number, body: IsiBayarTagihan) {
  return useApi()<Envelope<BayarTagihan>>(`/finance/tagihan/${id}/payments`, { method: 'POST', body })
}
export function batalBayarTagihan(id: number, alasan: string) {
  return useApi()<Envelope<BayarTagihan>>(`/finance/tagihan/payments/${id}/cancel`, { method: 'POST', body: { alasan } })
}

// ---------------------------------------------------------------- Saldo wallet (G-06)

export interface WalletBalance { wallet: string, nama: string, saldo: number }

export interface WalletBalances {
  wallets: WalletBalance[]
  total: number
  /** Stored group → wallet map from the vault setting (defaults applied client-side). */
  peta: Record<string, string>
}

/**
 * GET /finance/petty-cash/wallet-balances — vault-side saldo per wallet for
 * Payment Planning (module `finance`). Kompas sales are NOT in here: the
 * client adds them from kompas state with the same engine as the Brankas
 * panel, as the old page does (`deploy/finance/kas/index.html: saldoSemua`).
 */
export async function getWalletBalances() {
  const r = await useApi()<Envelope<WalletBalances> & { meta?: Record<string, unknown> }>('/finance/petty-cash/wallet-balances')
  return { saldo: r.data, version: versiDari(r) }
}

// ---------------------------------------------------------------- Brankas (`/finance/vault`, module `brankas`)
//
// The vault blob holds the `rekening`, `piutang`, `bayar`, `investor` and
// `mutasi` lists plus `setting`, with ONE version for the whole blob
// (`meta.version` = `updated_at` ms). Legacy `brankasSave` wrote the blob in
// one go; v1 splits it per list, so this panel writes per record and the Kas
// panel writes the payment plan narrowly (`bayarSave`, above) — two panels
// sharing one whole-blob write would overwrite each other without an error.
// Record shapes: laksamana-office/deploy/finance/brankas/index.html.

export type VaultList = 'rekening' | 'piutang' | 'bayar' | 'investor' | 'mutasi'

export interface VaultData {
  rekening?: unknown[]
  piutang?: unknown[]
  bayar?: RencanaBayar[]
  investor?: InvestorBrankas[]
  mutasi?: MutasiBrankas[]
  setting?: SettingBrankas
}

export interface VaultAkses {
  matrix: Record<string, Record<string, number>>
  roles: Record<string, string>
}

/** Bootstrap (`brankasGet`): every list + access + roles + the blob version. */
export async function getVault() {
  const r = await useApi()<Envelope<{ data?: VaultData, akses?: VaultAkses['matrix'], peran?: Record<string, string> }> & { meta?: Record<string, unknown> }>('/finance/vault')
  return {
    vault: r.data.data ?? {},
    akses: { matrix: r.data.akses ?? {}, roles: r.data.peran ?? {} },
    version: versiDari(r),
  }
}

/** One list (`rekening`/`piutang`/`bayar`/`investor`/`mutasi`). */
export async function getVaultList<T = Record<string, unknown>>(list: VaultList) {
  const r = await useApi()<Envelope<T[]> & { meta?: Record<string, unknown> }>(`/finance/vault/${list}`)
  return { rows: r.data ?? [], version: versiDari(r) }
}
export function createVaultRec<T = Record<string, unknown>>(list: VaultList, body: Partial<T>, versi: Versi) {
  return useApi()<Envelope<T>>(`/finance/vault/${list}`, { method: 'POST', body, headers: ifMatch(versi) })
}
/** PUT replaces, PATCH shallow-merges. Both need the whole-blob version. */
export function updateVaultRec<T = Record<string, unknown>>(list: VaultList, id: string, body: Partial<T>, versi: Versi, method: 'PUT' | 'PATCH' = 'PUT') {
  return useApi()<Envelope<T>>(`/finance/vault/${list}/${encodeURIComponent(id)}`, { method, body, headers: ifMatch(versi) })
}
export function deleteVaultRec(list: VaultList, id: string, versi: Versi) {
  return useApi()<{ deleted: boolean }>(`/finance/vault/${list}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: ifMatch(versi) })
}

/** The settings map (`PUT /setting {value: {...}}`), needs the blob version. */
export async function getVaultSetting() {
  const r = await useApi()<Envelope<SettingBrankas>>('/finance/vault/setting')
  return { setting: r.data ?? {}, version: versiDari(r) }
}
export function putVaultSetting(value: SettingBrankas, versi: Versi) {
  return useApi()<Envelope<SettingBrankas>>('/finance/vault/setting', { method: 'PUT', body: { value }, headers: ifMatch(versi) })
}

export async function getVaultAkses() {
  const r = await useApi()<Envelope<VaultAkses> & { meta?: Record<string, unknown> }>('/finance/vault/access')
  return { akses: r.data, version: versiDari(r) }
}
export function putVaultMatrix(matrix: Record<string, Record<string, number>>, versi: Versi) {
  return useApi()<Envelope<VaultAkses>>('/finance/vault/access/matrix', { method: 'PUT', body: { matrix }, headers: ifMatch(versi) })
}
export function putVaultRole(userId: string, role: string, versi: Versi | undefined) {
  return useApi()<Envelope<unknown>>(`/finance/vault/access/roles/${encodeURIComponent(userId)}`, { method: 'PUT', body: { role }, headers: versi === undefined ? undefined : ifMatch(versi) })
}

// ---------------------------------------------------------------- Investor account link (VUE-7b)
//
// The endpoint belongs to the ACCOUNT module (contract:
// laksamana-api/docs/api/account.md "POST /account/investor-akun") and lives
// here only because the brankas modal is its sole caller — same pattern as
// `getRoster` living in useCashier.

/** The Office account created or linked for an investor: `{id, name}` (never a PIN). */
export interface AkunInvestor {
  id: string
  name: string
}

/**
 * Create (`{name, noHp?, pin}`) or link (`{userId}`) an Office account for an
 * investor. The account gets the `investor` module grant (never admin); the
 * link itself (`akunId`/`akunNama`) is stored on the investor record by the
 * caller, through the usual versioned vault write.
 */
export async function buatAkunInvestor(body: { userId: string } | { name: string, noHp?: string, pin: string }) {
  const r = await useApi()<Envelope<AkunInvestor>>('/account/investor-akun', { method: 'POST', body })
  return r.data
}

// ---------------------------------------------------------------- Invoices (panel Finance)

export interface InvoiceReq {
  id: string
  resId?: string
  jenis?: string
  status: 'MENUNGGU' | 'DIBUAT' | 'DITOLAK'
  no?: string
  ringkas?: unknown
  mintaOleh?: string
  mintaAt?: number
  putusOleh?: string
  putusAt?: number
  catatan?: string
  materai?: boolean
  ubah?: UbahInvoice | null
  [k: string]: unknown
}

/** The queue / history (`?status=&jenis=`), + `meta.versions` per row. */
export async function getInvoices(status?: string, jenis?: string) {
  const r = await useApi()<Envelope<InvoiceReq[]> & { meta?: Record<string, unknown> }>('/finance/invoices', { query: { status, jenis } })
  return { rows: r.data, versions: VERSIONS(r.meta), queue: (r.meta?.queue ?? {}) as Record<string, number> }
}
export const getInvoiceQueue = () =>
  useApi()<Envelope<{ total: number, perJenis: Record<string, number> }>>('/finance/invoices/queue')

export function decideInvoice(id: string, body: { aksi: 'buat' | 'tolak' | 'batal', catatan?: string, penanda?: string[], materai?: boolean }, versi: Versi) {
  return useApi()<Envelope<InvoiceReq>>(`/finance/invoices/${id}/decision`, { method: 'POST', body, headers: ifMatch(versi) })
}

/**
 * PUT /finance/invoices/{id}/text — Marketing edits the TEXT of its issued
 * invoice (Kepada, U.P, per-row Keterangan). Empty text returns to the
 * default; the request version still applies.
 */
export function updateInvoiceText(id: string, body: { ubah: { kepada?: string, up?: string, ket?: { asal?: string, teks?: string }[] } }, versi: Versi) {
  return useApi()<Envelope<InvoiceReq>>(`/finance/invoices/${id}/text`, { method: 'PUT', body, headers: ifMatch(versi) })
}

export interface InvoiceSetting {
  prefix?: string
  prefixInvoice?: string
  cap?: string
  penandaDefault?: string
  penandaDefaultInvoice?: string
  [k: string]: unknown
}
export async function getInvoiceSettings() {
  const r = await useApi()<Envelope<InvoiceSetting>>('/finance/invoices/settings')
  return { setting: r.data, version: versiDari(r) }
}
export function putInvoiceSettings(body: Partial<InvoiceSetting>, versi: Versi) {
  return useApi()<Envelope<InvoiceSetting>>('/finance/invoices/settings', { method: 'PUT', body, headers: ifMatch(versi) })
}

export interface Penanda {
  id: string
  nama: string
  jabatan?: string
  ttd?: string
  urut?: number
  aktif?: boolean
  [k: string]: unknown
}
export async function getPenanda() {
  const r = await useApi()<Envelope<Penanda[]> & { meta?: Record<string, unknown> }>('/finance/invoices/signatories')
  return { rows: r.data, versions: VERSIONS(r.meta) }
}
export function createPenanda(body: { nama: string, jabatan?: string, urut?: number, aktif?: boolean }) {
  return useApi()<Envelope<Penanda>>('/finance/invoices/signatories', { method: 'POST', body })
}
export function patchPenanda(id: string, body: Partial<Penanda>, versi: Versi) {
  return useApi()<Envelope<Penanda>>(`/finance/invoices/signatories/${id}`, { method: 'PATCH', body, headers: ifMatch(versi) })
}
export function deletePenanda(id: string, versi: Versi) {
  return useApi()<{ deleted: boolean }>(`/finance/invoices/signatories/${id}`, { method: 'DELETE', headers: ifMatch(versi) })
}
