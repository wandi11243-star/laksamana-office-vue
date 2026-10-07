// Stock — API calls + types for the five panels (ordering, purchasing, tree,
// usage, hpp). One backend serves them all; reads need any of the five keys,
// writes follow who does them in the old panels.
//
// Contract: laksamana-api/docs/api/stock.md. Spec: docs/migrasi/stock.md.
// Versions are content hashes: a list read carries `meta.versions` keyed by
// name/id, a single read carries `meta.version`. Writes send it as If-Match.
import type { BahanHpp, ResepHpp } from '~/utils/pohon-resep'

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
