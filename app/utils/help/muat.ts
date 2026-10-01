// The chapter loader — the Vue successor of the old Help engine's lazy
// `muatPanduan()`. The old page pulled `panduan/<key>.js` with a <script> only
// when someone opened that chapter, so a reader never downloaded a module they
// may not open. Here every chapter is a dynamic import behind the importer map
// below; a chapter is imported ONLY when `useHelp().muat()` asks for it for a
// key the user is allowed to read (guard 1 — the same gate `babBoleh` uses).
//
// The map is static on purpose: a bundler cannot follow a computed specifier,
// and a wrong specifier would be a silent 404 at runtime — the old engine went
// out of its way to tell those apart from "not written yet".
import type { Panduan } from './tipe'

export type PemuatanBab = () => Promise<{ default: Panduan }>

/** One importer per chapter file. Keep a line per chapter, in registry order. */
export const PEMUAT: Record<string, PemuatanBab> = {
  portal: () => import('./panduan/portal'),
  reservasi: () => import('./panduan/reservasi'),
  cashier: () => import('./panduan/cashier'),
  service_excellent: () => import('./panduan/service_excellent'),
  radar: () => import('./panduan/radar'),
  ordering: () => import('./panduan/ordering'),
  purchasing: () => import('./panduan/purchasing'),
  tree: () => import('./panduan/tree'),
  usage: () => import('./panduan/usage'),
  hpp: () => import('./panduan/hpp'),
  jadwal: () => import('./panduan/jadwal'),
  dw: () => import('./panduan/dw'),
  absensi: () => import('./panduan/absensi'),
  akademi: () => import('./panduan/akademi'),
  hr: () => import('./panduan/hr'),
  marketing: () => import('./panduan/marketing'),
  event: () => import('./panduan/event'),
  konten: () => import('./panduan/konten'),
  kompas: () => import('./panduan/kompas'),
  finance: () => import('./panduan/finance'),
  brankas: () => import('./panduan/brankas'),
  analytics: () => import('./panduan/analytics'),
  bd: () => import('./panduan/bd'),
  investor: () => import('./panduan/investor'),
  howandi_life: () => import('./panduan/howandi_life'),
}

/** The keys that already have a chapter file. `Segera` is drawn for the rest. */
export const ADA = new Set(Object.keys(PEMUAT))

/** Import one chapter. Throws when the file is not written yet. */
export async function muatBab(kunci: string): Promise<Panduan> {
  const impor = PEMUAT[kunci]
  if (!impor) throw new Error(`Panduan "${kunci}" belum ada`)
  const mod = await impor()
  return mod.default
}
