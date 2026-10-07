// The recipe graph for the Pohon Resep panel. Owned by the stock module.
//
// The old Office shipped the whole graph EMBEDDED in the page
// (`deploy/stock/tree/index.html:275`, generated off-repo into `__DATA__`);
// Vue rebuilds it live from v1 (`GET /stock/hpp/ingredients` + `/recipes`,
// module `tree`, read-only — T-18). Node kinds mirror the old `KIND_LABEL`
// (`tree/index.html:312`); the QA flags are derived client-side:
//
// - `wip` — a row pointing at another recipe (in-house prep, expandable);
//   without a yield number it becomes `wip_noyield`;
// - `root` — a bought raw material; `dibeli_jadi` ones are `storebought`;
// - `unmapped` — names neither the ingredient list nor the recipes;
// - `mismatch` — the row's unit differs from the ingredient's own unit;
// - `implausible` — zero/negative/unreadable quantity.
//
// Sources: laksamana-office/deploy/stock/tree/index.html:276-354;
// contract laksamana-api/docs/api/stock.md:34,39.

export interface BarisBahan {
  nama?: string
  qty?: unknown
  satuan?: string
  ref?: string
  catatan?: string
  [k: string]: unknown
}

export interface ResepHpp {
  id?: string | number
  nama?: string
  jenis?: string
  tipe?: string
  seksi?: string
  yield_qty?: unknown
  yield_unit?: string
  aktif?: boolean
  bahan?: BarisBahan[]
  [k: string]: unknown
}

export interface BahanHpp {
  nama?: string
  satuan?: string
  dibeli_jadi?: boolean
  [k: string]: unknown
}

export type KindPohon = 'menu' | 'root' | 'wip' | 'wip_noyield' | 'mismatch' | 'unmapped' | 'implausible' | 'storebought'

export interface NodePohon {
  name: string
  qty: number
  unit: string
  kind: KindPohon
  children: NodePohon[]
}

export interface MenuPohon {
  name: string
  category: string
  tree: NodePohon
}

export interface PakaiBahan {
  menu: string
  qty: number
  unit: string
}

const norm = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ')

/** Same as the old `fmtQty`: thousands grouped, else up to 3 decimals. */
export function fmtQtyPohon(n: unknown): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  if (Math.abs(v) >= 1000) return v.toLocaleString('en', { maximumFractionDigits: 0 })
  return String(Math.round(v * 1000) / 1000)
}

export const FLAG_POHON: ReadonlySet<KindPohon> = new Set(['wip_noyield', 'mismatch', 'unmapped', 'implausible'])

/** Does any node below (inclusive) carry a QA flag? (`menuHasFlag`) */
export function pohonPunyaFlag(node: NodePohon): boolean {
  if (FLAG_POHON.has(node.kind)) return true
  return node.children.some(pohonPunyaFlag)
}

export interface SumberPohon {
  resep: Map<string, ResepHpp>
  bahan: Map<string, BahanHpp>
}

/** Index recipes + ingredients by normalised name (exact first, then UPPER). */
export function indeksPohon(resep: ResepHpp[], bahan: BahanHpp[]): SumberPohon {
  const r = new Map<string, ResepHpp>()
  for (const x of resep) {
    const k = String(x.nama ?? '').trim()
    if (!k) continue
    if (!r.has(k)) r.set(k, x)
    const u = norm(k)
    if (!r.has(u)) r.set(u, x)
  }
  const b = new Map<string, BahanHpp>()
  for (const x of bahan) {
    const k = String(x.nama ?? '').trim()
    if (!k) continue
    if (!b.has(k)) b.set(k, x)
    const u = norm(k)
    if (!b.has(u)) b.set(u, x)
  }
  return { resep: r, bahan: b }
}

const cariResep = (s: SumberPohon, nama: string) =>
  s.resep.get(String(nama).trim()) ?? s.resep.get(norm(nama))
const cariBahan = (s: SumberPohon, nama: string) =>
  s.bahan.get(String(nama).trim()) ?? s.bahan.get(norm(nama))

function kembangkanBaris(s: SumberPohon, baris: BarisBahan, dikunjungi: Set<string>): NodePohon {
  const name = String(baris.nama ?? '').trim()
  const qty = Number(baris.qty)
  const unit = String(baris.satuan ?? '')
  const kosong: NodePohon = { name, qty: Number.isFinite(qty) ? qty : 0, unit, kind: 'unmapped', children: [] }
  if (!name) return kosong
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ...kosong, kind: 'implausible' }
  }
  const ref = String(baris.ref ?? '').trim().toLowerCase()
  const resep = ref === 'bahan' ? undefined : cariResep(s, name)
  if (resep && ref !== 'bahan') {
    const kunci = norm(resep.nama ?? name)
    if (dikunjungi.has(kunci)) return { ...kosong, kind: 'mismatch', children: [] }
    const punyaYield = Number(resep.yield_qty) > 0
    const anak = punyaYield
      ? (resep.bahan ?? []).filter(b => String(b.nama ?? '').trim()).map(b => kembangkanBaris(s, b, new Set([...dikunjungi, kunci])))
      : []
    return { name, qty, unit, kind: punyaYield ? 'wip' : 'wip_noyield', children: anak }
  }
  const bahan = cariBahan(s, name)
  if (bahan) {
    const satuanSendiri = String(bahan.satuan ?? '').trim()
    if (unit && satuanSendiri && norm(unit) !== norm(satuanSendiri)) {
      return { ...kosong, kind: 'mismatch' }
    }
    return { ...kosong, kind: bahan.dibeli_jadi ? 'storebought' : 'root' }
  }
  return kosong
}

/**
 * Menus = active `dish` recipes (menu jadi); base recipes only appear as WIP
 * children. Category falls back the way the old sidebar grouped it.
 */
export function bangunMenu(s: SumberPohon, semuaResep: ResepHpp[]): MenuPohon[] {
  const out: MenuPohon[] = []
  for (const r of semuaResep) {
    if (r.tipe !== 'dish' || r.aktif === false) continue
    const name = String(r.nama ?? '').trim()
    if (!name) continue
    const anak = (r.bahan ?? [])
      .filter(b => String(b.nama ?? '').trim())
      .map(b => kembangkanBaris(s, b, new Set([norm(name)])))
    out.push({
      name,
      category: String(r.seksi || r.jenis || 'Lainnya'),
      tree: { name, qty: Number(r.yield_qty) > 0 ? Number(r.yield_qty) : 1, unit: String(r.yield_unit || 'porsi'), kind: 'menu', children: anak },
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/** Raw materials → the dishes using them (only `root` rows open the drawer). */
export function whereusedPohon(daftar: MenuPohon[]): Record<string, PakaiBahan[]> {
  const out: Record<string, PakaiBahan[]> = {}
  const jalan = (menu: string, n: NodePohon) => {
    if (n.kind === 'root') {
      (out[n.name] ??= []).push({ menu, qty: n.qty, unit: n.unit })
    }
    for (const c of n.children) jalan(menu, c)
  }
  for (const m of daftar) jalan(m.name, m.tree)
  return out
}

export interface StatPohon {
  menu: number
  mentah: number
  sambungan: number
  tanpaTakaran: number
}

/** Menu / distinct raw materials / links / QA-flagged nodes. */
export function statPohon(daftar: MenuPohon[]): StatPohon {
  const mentah = new Set<string>()
  let sambungan = 0
  let tanpaTakaran = 0
  const jalan = (n: NodePohon) => {
    if (n.kind === 'root') mentah.add(n.name)
    if (FLAG_POHON.has(n.kind)) tanpaTakaran++
    sambungan += n.children.length
    for (const c of n.children) jalan(c)
  }
  for (const m of daftar) jalan(m.tree)
  return { menu: daftar.length, mentah: mentah.size, sambungan, tanpaTakaran }
}
