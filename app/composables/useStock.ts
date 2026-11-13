// Stock — API calls + types for the six panels (ordering, purchasing, tree,
// usage, hpp, breakloss). One backend serves them all; reads need any of the
// panel keys, writes follow who does them in the old panels.
//
// Contract: laksamana-api/docs/api/stock.md. Spec: docs/migrasi/stock.md.
// Versions are content hashes: a list read carries `meta.versions` keyed by
// name/id, a single read carries `meta.version`. Writes send it as If-Match.
import type { BahanHpp, ResepHpp } from '~/utils/pohon-resep'
import type { OpnameRingkas, ProdukCatat } from '~/utils/stock-catat'
import { ifMatch, versiDari, type Versi } from '~/utils/versi'
import { hasAccess, isAdminOf } from '~/composables/useMe'

// ---------------------------------------------------------------- Pohon Resep (read-only panel, module `tree`)

/** `GET /stock/hpp/ingredients` — flat or by-name; normalised to a list. */
export async function getHppIngredients(): Promise<{ rows: BahanHpp[] }> {
  const r = await useApi()<Envelope<BahanHpp[] | Record<string, BahanHpp>>>('/stock/hpp/ingredients')
  const d = r.data as BahanHpp[] | Record<string, BahanHpp>
  const rows: BahanHpp[] = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as Partial<BahanHpp>) }))
  return { rows }
}

/** `GET /stock/hpp/recipes` — flat, nested or by-id; normalised to a list. */
export async function getHppRecipes(): Promise<{ rows: ResepHpp[], versions: Record<string, Versi> }> {
  const r = await useApi()<Envelope<ResepHpp[] | Record<string, unknown>>>('/stock/hpp/recipes')
  const flat: ResepHpp[] = []
  const jalan = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) jalan(x)
    }
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (Array.isArray(o.bahan) || typeof o.nama === 'string') flat.push(o as unknown as ResepHpp)
      else for (const k of Object.keys(o)) jalan(o[k])
    }
  }
  jalan(r.data)
  return { rows: flat, versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

// ---------------------------------------------------------------- Usage panel (module `usage`)

/** Product master row, normalised by the API (`docs/api/stock.md:49`); `nama` is the key. */
export interface ProdukStock extends ProdukCatat {
  nama: string
  utama?: string
  cadangan?: string[]
  caraBeli?: string
  sumber?: string
  /** Preferred CK stock display unit (`''` = automatic; CK goods only). */
  satuanTampil?: string
}

export interface BarisItemUsage { item: string, qty: number, unit: string, note?: string }

export interface UsageCatatan {
  id: string
  tanggal: string
  jenis: string
  namaEvent: string
  status: string
  pic: string
  tim: string
  waktu: string
  catatan: string
  items: BarisItemUsage[]
}

export interface WasteCatatan {
  id: string
  tanggal: string
  item: string
  qty: number
  unit: string
  sebab: string
  pic: string
  tim: string
  waktu: string
  fotoNama: string
  adaFoto: boolean
  catatan: string
}

export interface HandoverCatatan {
  id: string
  tanggal: string
  tujuan: string
  penerima: string
  pic: string
  tim: string
  waktu: string
  fotoNama: string
  adaFoto: boolean
  catatan: string
  items: { item: string, qty: number, unit: string }[]
}

export interface OpnameCatatan extends OpnameRingkas {
  id: string
}

export interface VersiMap { versions: Record<string, Versi> }

/** `GET /stock/products` — a list; also accepts the legacy `{nama: {…}}` map. */
export async function getProducts(): Promise<{ rows: ProdukStock[], versions: Record<string, Versi> }> {
  const r = await useApi()<Envelope<ProdukStock[] | Record<string, ProdukStock>>>('/stock/products')
  const d = r.data as ProdukStock[] | Record<string, ProdukStock>
  const rows: ProdukStock[] = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as Partial<ProdukStock>) }))
  return { rows, versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

/**
 * The product master under ONE canonical key (#147): ten screens read it
 * under ten keys, fetching it ten times per session. Writers keep calling
 * their refresh() (always refetches); the TTL bounds staleness elsewhere.
 */
export function useProdukStock() {
  return useAsyncData('stock-produk', async () => {
    const r = await getProducts()
    stempelCache('stock-produk')
    return r
  }, { dedupe: 'defer', default: () => ({ rows: [] as ProdukStock[], versions: {} as Record<string, Versi> }), getCachedData: bacaCache() })
}

/** `POST /stock/products` — purchasing/hpp only; a usage-only account cannot add (gap noted in stock.md D.17). */
export async function createProduk(body: Partial<ProdukStock> & { nama: string }) {
  const r = await useApi()<Envelope<ProdukStock>>('/stock/products', { method: 'POST', body })
  return r.data
}

async function listKind<T>(kind: 'usage' | 'waste' | 'handovers' | 'opname', dari?: string, ke?: string) {
  const r = await useApi()<Envelope<T[]>>(`/stock/${kind}`, {
    params: { from: dari || undefined, to: ke || undefined },
  })
  return { rows: r.data ?? [], versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

export const listUsage = (dari?: string, ke?: string) => listKind<UsageCatatan>('usage', dari, ke)
export const listWaste = (dari?: string, ke?: string) => listKind<WasteCatatan>('waste', dari, ke)
export const listHandovers = (dari?: string, ke?: string) => listKind<HandoverCatatan>('handovers', dari, ke)
export const listOpname = (dari?: string, ke?: string) => listKind<OpnameCatatan>('opname', dari, ke)

/** Writes send the version they edited as If-Match; without one the API answers 428. */
const versiHeaders = (v?: Versi) => (v === undefined || v === null || v === '' ? undefined : ifMatch(v))

type Kind = 'usage' | 'waste' | 'handovers' | 'opname'

async function entriStore<T>(kind: Kind, body: Record<string, unknown>) {
  const r = await useApi()<Envelope<T>>(`/stock/${kind}`, { method: 'POST', body })
  return r.data
}

async function entriPatch<T>(kind: Kind, id: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<T>>(`/stock/${kind}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

async function entriHapus(kind: Kind, id: string, versi?: Versi) {
  await useApi()(`/stock/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

export const createUsage = (b: Record<string, unknown>) => entriStore<UsageCatatan>('usage', b)
export const patchUsage = (id: string, b: Record<string, unknown>, v?: Versi) => entriPatch<UsageCatatan>('usage', id, b, v)
export const deleteUsage = (id: string, v?: Versi) => entriHapus('usage', id, v)

export const createWaste = (b: Record<string, unknown>) => entriStore<WasteCatatan>('waste', b)
export const patchWaste = (id: string, b: Record<string, unknown>, v?: Versi) => entriPatch<WasteCatatan>('waste', id, b, v)
export const deleteWaste = (id: string, v?: Versi) => entriHapus('waste', id, v)

export const createHandover = (b: Record<string, unknown>) => entriStore<HandoverCatatan>('handovers', b)
export const patchHandover = (id: string, b: Record<string, unknown>, v?: Versi) => entriPatch<HandoverCatatan>('handovers', id, b, v)
export const deleteHandover = (id: string, v?: Versi) => entriHapus('handovers', id, v)

export const createOpname = (b: Record<string, unknown>) => entriStore<OpnameCatatan>('opname', b)
export const patchOpname = (id: string, b: Record<string, unknown>, v?: Versi) => entriPatch<OpnameCatatan>('opname', id, b, v)
export const deleteOpname = (id: string, v?: Versi) => entriHapus('opname', id, v)

/** `GET /stock/{waste|handovers}/{id}/photo` → `{foto (data URL), fotoNama}`. */
export async function getFotoEntri(kind: 'waste' | 'handovers', id: string) {
  const r = await useApi()<Envelope<{ foto: string, fotoNama: string }>>(`/stock/${kind}/${encodeURIComponent(id)}/photo`)
  return r.data
}

/** Convenience aliases so callers read naturally. */
export const getWastePhoto = (id: string) => getFotoEntri('waste', id)
export const getHandoverPhoto = (id: string) => getFotoEntri('handovers', id)

// ---------------------------------------------------------------- Break & Loss panel (module `breakloss`)

// Contract: laksamana-api/docs/api/stock.md "Break & Loss". No versions here:
// the API locks rows server-side (opname, edits) and answers 409 on a race.
// A missing `bl_*` table is 503 `breakloss_unavailable`, never DDL.

/** One registered inventory item. `stok`/`totBreak`/`totLoss` are all-time. */
export interface BlItem {
  id: string
  nama: string
  kategori: string
  satuan: string
  lokasi: string
  harga: number
  stokMin: number
  aktif: boolean
  catatan: string
  thumb: string
  adaFoto: boolean
  stok: number
  nMutasi: number
  totBreak: number
  totLoss: number
  dibuatOleh: string
  dibuatAt: string
  diubahOleh: string
  diubahAt: string
}

/** One entry of a movement's edit history (`riwayat`, newest last). */
export interface BlRiwayat {
  at: string
  oleh: string
  sebelum: { itemId?: string, jenis?: string, qty?: number, tanggal?: string, sebab?: string }
}

/** One stock movement. `qty` is signed; break/loss rows are negative. */
export interface BlMutasi {
  id: string
  itemId: string
  tanggal: string
  jenis: 'break' | 'loss' | 'masuk' | 'opname'
  qty: number
  harga: number
  sebab: string
  pic: string
  tim: string
  catatan: string
  adaFoto: boolean
  oleh: string
  waktu: string
  batalAt: string
  batalOleh: string
  batalAlasan: string
  diubahOleh: string
  diubahAt: string
  riwayat: BlRiwayat[]
}

/** `GET /stock/breakloss?dari=&ke=` — the range filters movements only. */
export async function listBreakLoss(dari?: string, ke?: string) {
  const r = await useApi()<Envelope<{ items: BlItem[], mutasi: BlMutasi[] }>>('/stock/breakloss', {
    params: { dari: dari || undefined, ke: ke || undefined },
  })
  return { items: r.data?.items ?? [], mutasi: r.data?.mutasi ?? [] }
}

/** `POST /stock/breakloss/items` — `stokAwal` becomes a `masuk` movement. */
export const createBlItem = (b: Record<string, unknown>) =>
  useApi()<Envelope<{ id: string }>>('/stock/breakloss/items', { method: 'POST', body: b }).then(r => r.data)

/** `PATCH /stock/breakloss/items/{id}` — photo absent/null keeps, `""` removes. */
export const patchBlItem = (id: string, b: Record<string, unknown>) =>
  useApi()<Envelope<{ id: string }>>(`/stock/breakloss/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: b }).then(r => r.data)

/** `PUT /stock/breakloss/items/{id}/active` — deactivate/reactivate, never delete. */
export const setBlItemActive = (id: string, aktif: boolean) =>
  useApi()<Envelope<{ id: string, aktif: boolean }>>(`/stock/breakloss/items/${encodeURIComponent(id)}/active`, { method: 'PUT', body: { aktif } }).then(r => r.data)

/** `POST /stock/breakloss/movements` — break/loss/masuk need `qty`, opname needs `fisik`. */
export const createBlMovement = (b: Record<string, unknown>) =>
  useApi()<Envelope<{ id: string, delta: number, stok: number }>>('/stock/breakloss/movements', { method: 'POST', body: b }).then(r => r.data)

/** `PATCH /stock/breakloss/movements/{id}` — live break/loss rows only. */
export const patchBlMovement = (id: string, b: Record<string, unknown>) =>
  useApi()<Envelope<{ id: string, stok: number }>>(`/stock/breakloss/movements/${encodeURIComponent(id)}`, { method: 'PATCH', body: b }).then(r => r.data)

/** `POST /stock/breakloss/movements/{id}/cancel` — reason required, once only. */
export const cancelBlMovement = (id: string, alasan: string) =>
  useApi()<Envelope<{ id: string }>>(`/stock/breakloss/movements/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { alasan } }).then(r => r.data)

/** `GET /stock/breakloss/items|movements/{id}/photo` → `{foto, fotoNama}`. */
export async function getBlPhoto(kind: 'item' | 'mutasi', id: string) {
  const path = kind === 'item'
    ? `/stock/breakloss/items/${encodeURIComponent(id)}/photo`
    : `/stock/breakloss/movements/${encodeURIComponent(id)}/photo`
  const r = await useApi()<Envelope<{ foto: string, fotoNama: string }>>(path)
  return r.data
}

export const getBlItemPhoto = (id: string) => getBlPhoto('item', id)
export const getBlMovementPhoto = (id: string) => getBlPhoto('mutasi', id)

// ---------------------------------------------------------------- Orders (ordering + purchasing)

// Field names follow the API contract (`docs/api/stock.md`, Orders). Records
// are the legacy shapes plus `nama` where the old endpoints returned maps.
export interface OrderStock {
  nomorOrder: string
  rowIndex?: number
  batchId?: string
  batchName?: string
  item: string
  qty: number
  unit: string
  note?: string
  /** Submit time (`waktu`, the server clock in WIB) — the old Tgl Submit filter reads this. */
  timestamp?: string
  tglDatang?: string
  kedatangan?: string
  catatanAktual?: string
  tglTerima?: string
  catatanTerima?: string
  tglJemput?: string
  status?: string
  tim?: string
  pic?: string
  utama?: string
  terarsip?: boolean
}

export interface BatchGabung { batchId: string, batchName?: string, tglDatang?: string, jumlah?: number, terarsip?: boolean }

/** `GET /stock/orders` — exact filters, ordered by rowIndex. Without
 *  `page`/`per_page` the server returns every row (legacy compat); with them
 *  it returns one page plus `meta.total`. Extra params pass through as-is. */
export async function listOrders(params?: Record<string, string | number | undefined>) {
  const r = await useApi()<Envelope<OrderStock[]>>('/stock/orders', {
    params: Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '')),
  })
  const meta = r.meta ?? {}
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : undefined
  return {
    rows: r.data ?? [],
    versions: (meta.versions ?? {}) as Record<string, Versi>,
    total: num(meta.total),
    page: num(meta.page),
    perPage: num(meta.per_page),
  }
}

/** `GET /stock/orders/batches?tim=&tgl=` — batches that can still be joined. */
export async function joinableBatches(tim?: string, tgl?: string) {
  const r = await useApi()<Envelope<BatchGabung[]>>('/stock/orders/batches', {
    params: { tim: tim || undefined, tgl: tgl || undefined },
  })
  return { rows: r.data ?? [] }
}

/** `GET /stock/orders/stats` — dashboard counters. */
export async function orderStats() {
  const r = await useApi()<Envelope<Record<string, number | string>>>('/stock/orders/stats')
  return { stats: r.data ?? {} }
}

/** `POST /stock/orders/batches` — new batch, or join when batchId is set. */
export async function createBatch(body: {
  orders: { item: string, qty: number, unit: string, note?: string, tglDatang: string }[]
  batchId?: string
  batchName?: string
  tim?: string
  /** Shopping form only: a member's order may wait for the division head (Approval Order). */
  accHead?: boolean
}) {
  const r = await useApi()<Envelope<unknown>>('/stock/orders/batches', { method: 'POST', body })
  return r.data as {
    created: number
    merged: number
    batchId: string
    batchName: string
    orders: OrderStock[]
    mergedItems: string[]
    /** A "Gudang Bar" batch skips Check-in: rows taken at once, stock already lowered. */
    langsung?: { diterima: number, ck?: { disinkron?: number, error?: string } }
    /** Held for the head's approval: no order exists yet (batchId/batchName absent). */
    menungguAcc?: boolean
    accId?: string
    divisi?: string[]
    jumlah?: number
  }
}

// ---------------------------------------------------------------- Approval Order (ACC Head)

export type StatusAcc = 'menunggu' | 'diproses' | 'disetujui' | 'ditolak' | 'dibatalkan'
export interface BarisAcc { item: string, qty: number, unit: string, note?: string, tglDatang?: string, pic?: string }
export interface PengajuanAcc {
  id: string
  waktu: string
  pemohonId: string
  pemohon: string
  divisi: string[]
  tim: string
  tglDatang: string
  status: StatusAcc
  putusOleh: string
  putusAt: string | null
  alasan: string
  orders: BarisAcc[]
  batchId: string
  batchName: string
  hasil: { batchId: string, created: number, merged: number } | null
  /** What was actually approved (the head may change quantities). */
  ordersAcc: BarisAcc[] | null
}
export interface DaftarAcc {
  head: string[]
  admin: boolean
  tersedia: boolean
  menunggu: PengajuanAcc[]
  riwayat: PengajuanAcc[]
  milik: PengajuanAcc[]
}

/** `GET /stock/approvals` — waiting (head/admin), decided history of the caller's divisions, own requests. */
export async function listApprovals() {
  const r = await useApi()<Envelope<DaftarAcc>>('/stock/approvals')
  return r.data
}

/** `POST /stock/approvals/{id}/decision` — approve (quantities may change by row) or reject with a reason. */
export async function decideApproval(id: string, body: { keputusan: 'setuju' | 'tolak', alasan?: string, orders?: { qty: number }[] }) {
  const r = await useApi()<Envelope<{ keputusan: string, created?: number, merged?: number, batchId?: string }>>(
    `/stock/approvals/${encodeURIComponent(id)}/decision`, { method: 'POST', body })
  return r.data
}

/** `POST /stock/approvals/{id}/cancel` — the requester withdraws a waiting request. */
export async function cancelApproval(id: string) {
  await useApi()(`/stock/approvals/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export const NAMA_DIVISI_ACC: Record<string, string> = { kitchen: 'Kitchen', bar: 'Bar', floor: 'Floor' }

/**
 * The approval list, shared by the Approval Order screen and the sidebar
 * badge (one key). Only Ordering crew ask — anyone else would get a 403.
 */
export function useApprovals() {
  const me = useMe()
  return useAsyncData('stock-approvals', () => (hasAccess(me.value, ['ordering']) ? listApprovals() : Promise.resolve(null)), {
    default: () => null as DaftarAcc | null,
  })
}

// ---------------------------------------------------------------- My Ordering / Purchasing role

/** 0 = Tak terlihat, 1 = Lihat, 2 = Boleh ubah (old PERM_NONE / VIEW / EDIT). */
export type IzinHalaman = 0 | 1 | 2
export interface PeranPanel { role: string, perms: Record<string, IzinHalaman> }
export interface PeranStock { ordering?: PeranPanel, purchasing?: PeranPanel }

/** The signed-in user's own roles (`GET /stock/me`); null until loaded or when it failed. */
export const usePeranStock = () => useState<PeranStock | null>('stock-peran', () => null)

/** Loads the roles once per session for the module menu (ModulShell.siapkan). Failure keeps the old menu. */
export async function muatPeranStock(): Promise<void> {
  const state = usePeranStock()
  if (state.value) return
  try {
    const r = await useApi()<Envelope<PeranStock>>('/stock/me')
    state.value = r.data ?? {}
  }
  catch { /* fall back to the role-less menu; the server still guards the writes */ }
}

/**
 * Permission of one Ordering / Purchasing screen for the signed-in user;
 * `cadangan` while the role is not known yet (the menu before /stock/me answers).
 */
export function izinHalaman(panel: 'ordering' | 'purchasing', halaman: string, cadangan: IzinHalaman): IzinHalaman {
  const p = usePeranStock().value?.[panel]
  if (!p) return cadangan
  return p.role === 'admin' ? 2 : (p.perms[halaman] ?? 0)
}

/**
 * May the signed-in user write on this Ordering screen? Same rule as the
 * server guard (StockPeran::bolehUbahOrdering): Purchasing holders and
 * Ordering admins always may; otherwise the role must "Boleh ubah" it.
 */
export function bolehUbahOrdering(halaman: 'order' | 'ck' | 'gb' | 'checkin'): boolean {
  const me = useMe().value
  if (!me || hasAccess(me, ['purchasing']) || isAdminOf(me, 'ordering')) return true
  return izinHalaman('ordering', halaman, 2) >= 2
}

/**
 * May the signed-in user write on this Purchasing screen? Same rule as the
 * server guard (PeranPurchasing): Purchasing admins always may; a `view`
 * role only looks. `lolos` = another Panel doing the same write (HPP saves
 * products) — holders of it may.
 */
export function bolehUbahPurchasing(halaman: 'dashboard' | 'jemput' | 'ck' | 'database', lolos: string[] = []): boolean {
  const me = useMe().value
  if (!me || isAdminOf(me, 'purchasing') || lolos.some(m => hasAccess(me, [m]))) return true
  return izinHalaman('purchasing', halaman, 2) >= 2
}

/** Label of an Ordering role (old roleLabel). */
export const LABEL_PERAN_ORDERING: Record<string, string> = { admin: 'Admin modul', full: 'Order + Check-in', checkin: 'Check-in saja' }

/** Red badge on "Approval Order": requests waiting for the signed-in head. */
export function useLencanaStock() {
  const q = useApprovals()
  return computed<Record<string, number>>(() => ({ ordering_acc: q.data.value?.menunggu.length ?? 0 }))
}

/** `PATCH /stock/orders/{nomor}` — qty, kedatangan, tglJemput, status… Version required. */
export async function patchOrder(nomor: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<OrderStock>>(`/stock/orders/${encodeURIComponent(nomor)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

/** `DELETE /stock/orders/{nomor}` — the Ordering delete button. Version required. */
export async function deleteOrder(nomor: string, versi?: Versi) {
  await useApi()(`/stock/orders/${encodeURIComponent(nomor)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/orders/archive` / `/unarchive` — purchasing only. */
export async function archiveOrders(ids: string[], buka = false) {
  const r = await useApi()<Envelope<{ updated: number }>>(`/stock/orders/${buka ? 'unarchive' : 'archive'}`, {
    method: 'POST',
    body: { orderIds: ids },
  })
  return r.data
}

// ---------------------------------------------------------------- Stock Today

export interface StockToday { stock: Record<string, { stock_now: number, stock_unit: string }>, as_of?: string, count?: number }

/** `GET /stock/stock-today` — the whole snapshot plus its version. */
export async function getStockToday() {
  const r = await useApi()<Envelope<StockToday>>('/stock/stock-today')
  return { data: r.data, versi: versiDari(r) }
}

/** `PUT /stock/stock-today` — replaces the whole snapshot. Version required. */
export async function putStockToday(body: { as_of?: string, stock: Record<string, { stock_now: number, stock_unit?: string }> }, versi?: Versi) {
  const r = await useApi()<Envelope<StockToday>>('/stock/stock-today', {
    method: 'PUT',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

// ---------------------------------------------------------------- Central Kitchen & Gudang Bar

/**
 * Two warehouses on one ledger (stock.md "Central Kitchen & Gudang Bar"):
 * `ck` = Central Kitchen (products `sumber` ck/both, batch "Central Kitchen"),
 * `bar` = Gudang Bar (products `sumber` bar, batch "Gudang Bar").
 */
export type Gudang = 'ck' | 'bar'
export const GUDANG_INFO: Record<Gudang, { nama: string, singkat: string, batch: string, sumber: string[] }> = {
  ck: { nama: 'Central Kitchen', singkat: 'CK', batch: 'Central Kitchen', sumber: ['ck', 'both'] },
  bar: { nama: 'Gudang Bar', singkat: 'Gudang Bar', batch: 'Gudang Bar', sumber: ['bar'] },
}

/**
 * Keep only the balance rows that belong to this warehouse by the product
 * master's `sumber` (CK: ck/both · Gudang Bar: bar). The server's balance also
 * lists any item with old movements in the ledger (`hilang`, e.g. a product
 * moved from CK to Gudang Bar keeps its old CK rows), so a moved product would
 * otherwise show in both warehouses. Rows with no product in the master stay
 * on the CK screen only, as before.
 */
export function saringSaldoGudang(rows: CkSaldo[], produk: ProdukStock[], gudang: Gudang): CkSaldo[] {
  // Master not loaded yet: show the server's rows rather than an empty screen.
  if (!produk.length) return rows
  const sumber = new Map(produk.map(p => [p.nama, p.sumber ?? '']))
  const boleh = GUDANG_INFO[gudang].sumber
  return rows.filter((r) => {
    const s = sumber.get(r.item)
    return s === undefined ? gudang === 'ck' : boleh.includes(s)
  })
}

/** Movements of this warehouse only: by the row's own `gudang` (old rows without it = CK). */
export function saringMutasiGudang<T extends { gudang?: string }>(rows: T[], gudang: Gudang): T[] {
  return rows.filter(m => (m.gudang === 'bar' ? 'bar' : 'ck') === gudang)
}

/** Warehouse of a request batch by its name; '' for a shopping batch. */
export function gudangDariBatch(batchName?: string): Gudang | '' {
  const n = String(batchName ?? '').trim().toLowerCase()
  return n === 'central kitchen' ? 'ck' : n === 'gudang bar' ? 'bar' : ''
}

export interface CkSaldo { item: string, sumber?: string, packIsi?: number, packSatuan?: string, kategori?: string, satuanTampil?: string, masuk: number, keluar: number, saldo: number, terakhir?: string, hilang?: boolean }

export interface CkMutasi {
  id: string
  tanggal: string
  item: string
  arah: string
  qty: number
  qtyInput?: number
  unitInput?: string
  sebab?: string
  status?: string
  ref?: string
  tim?: string
  pic?: string
  waktu?: string
  catatan?: string
  packIsi?: number
  packSatuan?: string
  /** Delivery-edit audit: who last changed it, when, how many times. */
  diubahOleh?: string
  diubahAt?: string
  nUbah?: number
  gudang?: Gudang
  /** Order batch of a check-in row, or the delivery batch of a "Catat kiriman". */
  batchId?: string
}

/** `GET /stock/ck/balance?gudang=` — never stored, always SUM(masuk) − SUM(keluar). */
export async function ckBalance(gudang: Gudang = 'ck') {
  const r = await useApi()<Envelope<CkSaldo[]>>('/stock/ck/balance', {
    params: { gudang: gudang === 'bar' ? 'bar' : undefined },
  })
  return { rows: r.data ?? [] }
}

/** `GET /stock/ck/movements?from=&to=&gudang=` — newest first. */
export async function ckMovements(dari?: string, ke?: string, gudang: Gudang = 'ck') {
  const r = await useApi()<Envelope<CkMutasi[]>>('/stock/ck/movements', {
    params: { from: dari || undefined, to: ke || undefined, gudang: gudang === 'bar' ? 'bar' : undefined },
  })
  return { rows: r.data ?? [], versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

/** `POST /stock/ck/movements` — manual movement (purchasing). */
export async function createMovement(body: Record<string, unknown>) {
  const r = await useApi()<Envelope<CkMutasi>>('/stock/ck/movements', { method: 'POST', body })
  return r.data
}

/** `PATCH /stock/ck/movements/{id}` — check-in rows are refused (422). */
export async function patchMovement(id: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<CkMutasi>>(`/stock/ck/movements/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

/** `DELETE /stock/ck/movements/{id}` — check-in rows are refused (422). */
export async function deleteMovement(id: string, versi?: Versi) {
  await useApi()(`/stock/ck/movements/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/ck/deliveries` — outlet → warehouse (body `gudang`, `batchId`), counted at once. */
export async function deliverToCk(body: Record<string, unknown>) {
  const r = await useApi()<Envelope<CkMutasi>>('/stock/ck/deliveries', { method: 'POST', body })
  return r.data
}

/**
 * `PATCH /stock/ck/deliveries/{id}` — fix a delivery's `tanggal`, `qtyInput`,
 * `unitInput` (`tim`, `catatan` too; the item is fixed). Identical numbers
 * still save: when the master changed after the delivery, the recomputed
 * stock legitimately differs, so "no change" is never a refusal. Version
 * required.
 */
export async function patchDelivery(id: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<CkMutasi>>(`/stock/ck/deliveries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

// ---------------------------------------------------------------- Vendors & products (purchasing database)

export interface VendorStock {
  nama: string
  whatsapp?: string
  perluJadwalJemput?: boolean
  penerima?: string
  bank?: string
  norek?: string
  tutupHari?: number[]
}

export async function listVendors(): Promise<{ rows: VendorStock[], versions: Record<string, Versi> }> {
  const r = await useApi()<Envelope<VendorStock[] | Record<string, VendorStock>>>('/stock/vendors')
  const d = r.data as VendorStock[] | Record<string, VendorStock>
  const rows: VendorStock[] = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as Partial<VendorStock>) }))
  return { rows, versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

/** The vendor master under ONE canonical key (#147, same pattern as useProdukStock). */
export function useVendorStock() {
  return useAsyncData('stock-vendor', async () => {
    const r = await listVendors()
    stempelCache('stock-vendor')
    return r
  }, { dedupe: 'defer', default: () => ({ rows: [] as VendorStock[], versions: {} as Record<string, Versi> }), getCachedData: bacaCache() })
}

export async function createVendor(body: Partial<VendorStock> & { nama: string }) {
  const r = await useApi()<Envelope<VendorStock>>('/stock/vendors', { method: 'POST', body })
  return r.data
}

export async function patchVendor(nama: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<VendorStock>>(`/stock/vendors/${encodeURIComponent(nama)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export async function deleteVendor(nama: string, versi?: Versi) {
  await useApi()(`/stock/vendors/${encodeURIComponent(nama)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/vendors-import` — `{rows}` upsert by name. */
export async function importVendors(rows: Record<string, unknown>[]) {
  const r = await useApi()<Envelope<{ baru: number, diubah: number, dilewati: number, galat: string[] }>>('/stock/vendors-import', {
    method: 'POST',
    body: { rows },
  })
  return r.data
}

export async function patchProduk(nama: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<ProdukStock>>(`/stock/products/${encodeURIComponent(nama)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export async function deleteProduk(nama: string, versi?: Versi) {
  await useApi()(`/stock/products/${encodeURIComponent(nama)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/products-import` — `{rows}` upsert by name, never renames. */
export async function importProducts(rows: Record<string, unknown>[]) {
  const r = await useApi()<Envelope<{ baru: number, diubah: number, dilewati: number, galat: string[] }>>('/stock/products-import', {
    method: 'POST',
    body: { rows },
  })
  return r.data
}

// ---------------------------------------------------------------- Activity log

export interface LogStock { waktu?: string, aktor?: string, modul?: string, aksi?: string, tim?: string, ringkas?: string }

/** `GET /stock/logs` — purchasing admins. */
export async function listLogs(params?: { dari?: string, ke?: string, modul?: string, q?: string, limit?: number }) {
  const r = await useApi()<Envelope<LogStock[]>>('/stock/logs', {
    params: {
      from: params?.dari || undefined,
      to: params?.ke || undefined,
      modul: params?.modul || undefined,
      q: params?.q || undefined,
      limit: params?.limit || undefined,
    },
  })
  return { rows: r.data ?? [] }
}

/** `POST /stock/logs` — fire-and-forget; never fails the caller (stock.md F.19). */
export async function catatLog(entries: { modul: string, aksi: string, tim?: string, ringkas?: string, data?: Record<string, unknown> }[]) {
  try {
    await useApi()('/stock/logs', { method: 'POST', body: { entries } })
  }
  catch {
    // Logging must not break the work it describes.
  }
}

// ---------------------------------------------------------------- Crew, settings & training

export interface KruStock { id: string, name: string, role: string, keterangan?: string }

/** `GET /stock/users` / `/stock/ordering-users` — admins of that panel. The PIN is never returned. */
export async function listKruStock(jenis: 'users' | 'ordering-users') {
  const r = await useApi()<Envelope<KruStock[]>>(`/stock/${jenis}`)
  return { rows: r.data ?? [], versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

export async function createKruStock(jenis: 'users' | 'ordering-users', body: Record<string, unknown>) {
  const r = await useApi()<Envelope<KruStock>>(`/stock/${jenis}`, { method: 'POST', body })
  return r.data
}

export async function patchKruStock(jenis: 'users' | 'ordering-users', id: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<KruStock>>(`/stock/${jenis}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export async function deleteKruStock(jenis: 'users' | 'ordering-users', id: string, versi?: Versi) {
  await useApi()(`/stock/${jenis}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/ordering-users-import` — seed the kitchen crew list. */
export async function importOrderingUsers(users: Record<string, unknown>[]) {
  const r = await useApi()<Envelope<{ seeded: number }>>('/stock/ordering-users-import', {
    method: 'POST',
    body: { users },
  })
  return r.data
}

/**
 * `GET /stock/settings/{ordering|purchasing}` — reads return the empty default
 * with `meta.available: false` while `stock_settings` is missing (stock.md F.21).
 */
export interface TemplateChat { item?: string, gabungan?: string }

export async function getStockSettings(panel: 'ordering' | 'purchasing'): Promise<{ data: { perms?: Record<string, Record<string, number>>, templates?: TemplateChat }, versi: Versi | undefined, tersedia: boolean }> {
  const r = await useApi()<Envelope<{ perms?: Record<string, Record<string, number>>, templates?: TemplateChat }>>(`/stock/settings/${panel}`)
  return { data: r.data ?? {}, versi: versiDari(r), tersedia: (r.meta as Record<string, unknown> | undefined)?.available !== false }
}

/** `PUT /stock/settings/{panel}` — refuses 503 while the table is missing. */
export async function putStockSettings(panel: 'ordering' | 'purchasing', body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<unknown>>(`/stock/settings/${panel}`, {
    method: 'PUT',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export interface ArsipTraining { usage: { files: number, last_date?: string, next_from?: string }, sales_detail: { files: number, last_date?: string, next_from?: string } }

/** `GET /stock/training` — archive status (ordering admins). */
export async function trainingStatus() {
  const r = await useApi()<Envelope<ArsipTraining>>('/stock/training')
  return r.data
}

/** `POST /stock/training` — raw POS xlsx as base64; `.xlsx`/`.xls` ≤ 12 MB. */
export async function uploadTraining(target: 'usage' | 'sales_detail', fileName: string, contentB64: string) {
  const r = await useApi()<Envelope<{ name: string, size: number, target: string }>>('/stock/training', {
    method: 'POST',
    body: { target, fileName, contentB64 },
  })
  return r.data
}

/** `GET /stock/training/{target}` — file list of one archive folder. */
export async function listTraining(target: 'usage' | 'sales_detail') {
  const r = await useApi()<Envelope<{ name: string, size: number, mtime: string }[]>>(`/stock/training/${target}`)
  return { rows: r.data ?? [], total: Number((r.meta as Record<string, unknown> | undefined)?.total ?? (r.data ?? []).length) }
}

// ---------------------------------------------------------------- HPP & Resep

export interface BahanHppTulis {
  nama: string
  satuan?: string
  qty_beli?: number
  harga_beli?: number
  per1?: number
  vendor?: string
  produk?: string
  kategori?: string
  catatan?: string
  di_purchasing?: boolean
  dibeli_jadi?: boolean
  sisi_harga?: string
  updated_at?: string
  updated_by?: string
}

export interface BarisResep { nama?: string, qty?: number, satuan?: string, ref?: string, catatan?: string }

export interface ResepHppTulis {
  id?: string
  nama: string
  jenis?: string
  tipe?: string
  seksi?: string
  kode?: string
  yield_qty?: number
  yield_unit?: string
  harga_lama?: number
  harga_baru?: number
  harga_upsize?: number
  modal_manual?: number
  catatan?: string
  bahan?: BarisResep[]
  aktif?: number | boolean
  di_purchasing?: boolean
  updated_at?: string
  updated_by?: string
}

/** `GET /stock/hpp/ingredients` — with versions keyed by name. */
export async function hppIngredients(): Promise<{ rows: BahanHpp[], versions: Record<string, Versi> }> {
  const r = await useApi()<Envelope<BahanHpp[] | Record<string, BahanHpp>>>('/stock/hpp/ingredients')
  const d = r.data as BahanHpp[] | Record<string, BahanHpp>
  const rows = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as object) }))
  return { rows, versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
}

/** The ingredient master under ONE canonical key (#147, same pattern as useProdukStock). */
export function useBahanHpp() {
  return useAsyncData('hpp-bahan', async () => {
    const r = await hppIngredients()
    stempelCache('hpp-bahan')
    return r
  }, { dedupe: 'defer', default: () => ({ rows: [] as BahanHpp[], versions: {} as Record<string, Versi> }), getCachedData: bacaCache() })
}

export async function createIngredient(body: Partial<BahanHppTulis> & { nama: string }) {
  const r = await useApi()<Envelope<BahanHpp>>('/stock/hpp/ingredients', { method: 'POST', body })
  return r.data
}

export async function patchIngredient(nama: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<BahanHpp>>(`/stock/hpp/ingredients/${encodeURIComponent(nama)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export async function deleteIngredient(nama: string, versi?: Versi) {
  await useApi()(`/stock/hpp/ingredients/${encodeURIComponent(nama)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/hpp/ingredients-merge` — If-Match is the version of `from`. */
export async function mergeIngredients(from: string, into: string, versi?: Versi) {
  const r = await useApi()<Envelope<BahanHpp>>('/stock/hpp/ingredients-merge', {
    method: 'POST',
    body: { from, into },
    headers: versiHeaders(versi),
  })
  return r.data
}

/** `POST /stock/hpp/ingredients-import` — upsert by name, never deletes/renames. */
export async function importIngredients(rows: Record<string, unknown>[]) {
  const r = await useApi()<Envelope<{ baru: number, diubah: number, dilewati: number, galat: string[] }>>('/stock/hpp/ingredients-import', {
    method: 'POST',
    body: { rows },
  })
  return r.data
}

/** `POST /stock/hpp/pull-products` / `/remove-shadows` / `/align-names`. */
export async function hppRapikanBahan(aksi: 'pull-products' | 'remove-shadows' | 'align-names') {
  const r = await useApi()<Envelope<Record<string, unknown>>>(`/stock/hpp/${aksi}`, { method: 'POST', body: {} })
  return r.data
}

/** `GET /stock/hpp/recipes` with versions keyed by id (normalised like the tree reader). */
export async function hppRecipes(): Promise<{ rows: ResepHppTulis[], versions: Record<string, Versi> }> {
  const { rows, versions } = await getHppRecipes()
  return { rows: rows as unknown as ResepHppTulis[], versions }
}

export async function createRecipe(body: Partial<ResepHppTulis> & { nama: string }) {
  const r = await useApi()<Envelope<ResepHppTulis>>('/stock/hpp/recipes', { method: 'POST', body })
  return r.data
}

export async function patchRecipe(id: string, body: Record<string, unknown>, versi?: Versi) {
  const r = await useApi()<Envelope<ResepHppTulis>>(`/stock/hpp/recipes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export async function deleteRecipe(id: string, versi?: Versi) {
  await useApi()(`/stock/hpp/recipes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHeaders(versi) })
}

/** `POST /stock/hpp/recipes-import` — upsert by id, deletes nothing. */
export async function importRecipes(rows: Record<string, unknown>[]) {
  const r = await useApi()<Envelope<{ baru: number, diubah: number, lewat: number, galat: string[] }>>('/stock/hpp/recipes-import', {
    method: 'POST',
    body: { rows },
  })
  return r.data
}

export interface BarisPakai { bahan: string, sa?: number | null, beli?: number | null, resep?: number | null, spoil?: number | null, team?: number | null, rnd?: number | null, comp?: number | null, opname?: number | null, [k: string]: unknown }

export interface PakaiHpp { bulan: string, baris: BarisPakai[], penjualan?: number, catatan?: string, daftarBulan?: string[] }

/** `GET /stock/hpp/usage/{YYYY-MM}` — other months never change its version. */
export async function hppUsage(bulan: string) {
  const r = await useApi()<Envelope<PakaiHpp>>(`/stock/hpp/usage/${encodeURIComponent(bulan)}`)
  return { data: r.data, versi: versiDari(r) }
}

/** `PATCH /stock/hpp/usage/{YYYY-MM}` — rows upserted by bahan. */
export async function patchHppUsage(bulan: string, body: { baris?: BarisPakai[], penjualan?: number, catatan?: string }, versi?: Versi) {
  const r = await useApi()<Envelope<PakaiHpp>>(`/stock/hpp/usage/${encodeURIComponent(bulan)}`, {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

export interface SettingHpp { targetFood: number, targetDrink: number, buffer: number, lampuKuning: number, lampuMerah: number }

/** `GET /stock/hpp/settings` — `{targetFood, targetDrink, buffer, lampuKuning, lampuMerah}`. */
export async function hppSettings() {
  const r = await useApi()<Envelope<SettingHpp>>('/stock/hpp/settings')
  return { data: r.data, versi: versiDari(r) }
}

/** `PATCH /stock/hpp/settings` — only the five keys, as numbers. */
export async function patchHppSettings(body: Partial<SettingHpp>, versi?: Versi) {
  // The body goes out as a JSON STRING, not an object: ofetch 1.5.1 refuses to
  // serialise any object with a truthy `buffer` key (its binary sniff,
  // `value.buffer`, misfires on the settings' `buffer` rate), so the request
  // would arrive as `[object Object]` without a content type and the server
  // answers 422 "The body must be a JSON object". String bodies still get the
  // JSON content type, so this parses. (`patchIngredient` never trips it only
  // because no ingredient body has a top-level `buffer` key.)
  const r = await useApi()<Envelope<SettingHpp>>('/stock/hpp/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: versiHeaders(versi),
  })
  return r.data
}

/** `POST /stock/hpp/import` — one-time move from Excel; 409 when HPP holds data. */
export async function hppImport(body: { bahan: Record<string, unknown>[], resep: Record<string, unknown>[], replace?: boolean }) {
  const r = await useApi()<Envelope<unknown>>('/stock/hpp/import', { method: 'POST', body })
  return r.data
}
