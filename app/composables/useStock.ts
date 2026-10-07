// Stock — API calls + types for the five panels (ordering, purchasing, tree,
// usage, hpp). One backend serves them all; reads need any of the five keys,
// writes follow who does them in the old panels.
//
// Contract: laksamana-api/docs/api/stock.md. Spec: docs/migrasi/stock.md.
// Versions are content hashes: a list read carries `meta.versions` keyed by
// name/id, a single read carries `meta.version`. Writes send it as If-Match.
import type { BahanHpp, ResepHpp } from '~/utils/pohon-resep'
import type { OpnameRingkas, ProdukCatat, UsageRingkas } from '~/utils/stock-catat'
import { ifMatch, type Versi } from '~/utils/versi'

// ---------------------------------------------------------------- Pohon Resep (read-only panel, module `tree`)

/** `GET /stock/hpp/ingredients` — flat or by-name; normalised to a list. */
export async function getHppIngredients() {
  const r = await useApi()<Envelope<BahanHpp[] | Record<string, BahanHpp>>>('/stock/hpp/ingredients')
  const d = r.data as BahanHpp[] | Record<string, BahanHpp>
  const rows = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as object) }))
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
export async function getProducts() {
  const r = await useApi()<Envelope<ProdukStock[] | Record<string, ProdukStock>>>('/stock/products')
  const d = r.data as ProdukStock[] | Record<string, ProdukStock>
  const rows = Array.isArray(d) ? d : Object.entries(d ?? {}).map(([nama, v]) => ({ nama, ...(v as object) }))
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

/** Re-export for pages that build KELUAR from the three lists (Daily SO). */
export type { UsageRingkas }
