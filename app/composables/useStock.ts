// Stock — API calls + types for the five panels (ordering, purchasing, tree,
// usage, hpp). One backend serves them all; reads need any of the five keys,
// writes follow who does them in the old panels.
//
// Contract: laksamana-api/docs/api/stock.md. Spec: docs/migrasi/stock.md.
// Versions are content hashes: a list read carries `meta.versions` keyed by
// name/id, a single read carries `meta.version`. Writes send it as If-Match.
import type { BahanHpp, ResepHpp } from '~/utils/pohon-resep'
import type { OpnameRingkas, ProdukCatat } from '~/utils/stock-catat'
import { ifMatch, versiDari, type Versi } from '~/utils/versi'

// ---------------------------------------------------------------- Pohon Resep (read-only panel, module `tree`)

/** `GET /stock/hpp/ingredients` — flat or by-name; normalised to a list. */
export async function getHppIngredients(): Promise<{ rows: BahanHpp[] }> {
  const r = await useApi()<Envelope<BahanHpp[] | Record<string, BahanHpp>>>('/stock/hpp/ingredients')
  const d = r.data as BahanHpp[] | Record<string, BahanHpp>
  const rows: BahanHpp[] = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as Partial<BahanHpp>) }))
  return { rows }
}

/** `GET /stock/hpp/recipes` — flat, nested or by-id; normalised to a list. */
export async function getHppRecipes() {
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
  return { rows: flat }
}

// ---------------------------------------------------------------- Usage panel (module `usage`)

/** Product master row, normalised by the API (`docs/api/stock.md:49`); `nama` is the key. */
export interface ProdukStock extends ProdukCatat {
  nama: string
  utama?: string
  cadangan?: string[]
  caraBeli?: string
  sumber?: string
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

/** `GET /stock/orders` — exact filters, ordered by rowIndex. */
export async function listOrders(params?: Record<string, string | undefined>) {
  const r = await useApi()<Envelope<OrderStock[]>>('/stock/orders', {
    params: Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)),
  })
  return { rows: r.data ?? [], versions: (r.meta?.versions ?? {}) as Record<string, Versi> }
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
}) {
  const r = await useApi()<Envelope<unknown>>('/stock/orders/batches', { method: 'POST', body })
  return r.data as { created: number, merged: number, batchId: string, batchName: string, orders: OrderStock[], mergedItems: string[] }
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

// ---------------------------------------------------------------- Central Kitchen

export interface CkSaldo { item: string, sumber?: string, packIsi?: number, packSatuan?: string, kategori?: string, masuk: number, keluar: number, saldo: number, terakhir?: string, hilang?: boolean }

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
}

/** `GET /stock/ck/balance` — never stored, always SUM(masuk) − SUM(keluar). */
export async function ckBalance() {
  const r = await useApi()<Envelope<CkSaldo[]>>('/stock/ck/balance')
  return { rows: r.data ?? [] }
}

/** `GET /stock/ck/movements?from=&to=` — newest first. */
export async function ckMovements(dari?: string, ke?: string) {
  const r = await useApi()<Envelope<CkMutasi[]>>('/stock/ck/movements', {
    params: { from: dari || undefined, to: ke || undefined },
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

/** `POST /stock/ck/deliveries` — outlet → CK, counted at once. */
export async function deliverToCk(body: Record<string, unknown>) {
  const r = await useApi()<Envelope<CkMutasi>>('/stock/ck/deliveries', { method: 'POST', body })
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
export async function catatLog(entries: { modul: string, aksi: string, tim?: string, ringkas?: string }[]) {
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
export async function hppRecipes() {
  const { rows } = await getHppRecipes()
  return { rows: rows as unknown as ResepHppTulis[] }
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
  const r = await useApi()<Envelope<SettingHpp>>('/stock/hpp/settings', {
    method: 'PATCH',
    body,
    headers: versiHeaders(versi),
  })
  return r.data
}

/** `POST /stock/hpp/import` — one-time move from Excel; 409 when HPP holds data. */
export async function hppImport(body: { bahan: Record<string, unknown>[], resep: Record<string, unknown>[], replace?: boolean }) {
  const r = await useApi()<Envelope<unknown>>('/stock/hpp/import', { method: 'POST', body })
  return r.data
}
