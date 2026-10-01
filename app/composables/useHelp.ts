// The Help Center's shared state: which chapters this user may read, which have
// been loaded, and the search over them.
//
// TWO GUARDS FOR ONE LEAK (old CLAUDE.md 11009-11011). A forbidden chapter must
// never be pulled in, and the search must never walk it — each guard alone
// leaves no visible symptom:
//   - the loader pulls only chapters from `babSaya` (guard 1), and
//   - `cari()` walks only `babSaya` (guard 2).
// `babSaya` is the single source both use, and it is computed from the user's
// `modules` (GET /me) through the same `babBoleh` the old page used.
import type { Panduan } from '~/utils/help/tipe'
import { HELP_BAB, babBoleh, bolehKunci, type HelpBab } from '~/utils/help/registry'
import { ADA, muatBab } from '~/utils/help/muat'
import { cariPanduan, type HasilCari } from '~/utils/help/cari'

export type StatusBab = 'belum' | 'ada' | 'kosong'

// Imports already in flight, so opening a chapter twice does not import it twice.
// Module scope is fine in an SPA (`ssr: false`); a Promise is not serializable.
const MENUNGGU = new Map<string, Promise<void>>()

export function useHelp() {
  const me = useMe()
  const isi = useState<Record<string, Panduan>>('help-isi', () => ({}))
  const status = useState<Record<string, StatusBab>>('help-status', () => ({}))
  /** One neutral notice shared by both "unknown key" and "not allowed" (routed back home). */
  const pesan = useState<string | null>('help-pesan', () => null)

  /** The chapters this user may read, in registry order. The single access gate. */
  const babSaya = computed(() => HELP_BAB.filter(b => babBoleh(b, me.value?.modules)))

  /** Import one chapter — only when this user is allowed to read it (guard 1). */
  async function muat(kunci: string): Promise<void> {
    if (status.value[kunci] === 'ada' || status.value[kunci] === 'kosong') return
    const sudah = MENUNGGU.get(kunci)
    if (sudah) return sudah
    const bab = HELP_BAB.find(b => b.key === kunci)
    // Not in the registry, or not allowed to this user: nothing is imported.
    if (!bab || !babBoleh(bab, me.value?.modules) || !ADA.has(kunci)) {
      status.value[kunci] = 'kosong'
      return
    }
    const jalan = (async () => {
      try {
        isi.value[kunci] = await muatBab(kunci)
        status.value[kunci] = 'ada'
      }
      catch {
        // A file that fails to import is treated like one never written; the
        // chapter screen says which of the two it looks like.
        status.value[kunci] = 'kosong'
      }
      finally {
        MENUNGGU.delete(kunci)
      }
    })()
    MENUNGGU.set(kunci, jalan)
    return jalan
  }

  /** Load every readable chapter (the old page did this at boot, so `Segera`
   *  markers and search are complete). Only readable ones are ever imported. */
  async function siapkan(): Promise<void> {
    await Promise.all(babSaya.value.map(b => muat(b.key)))
  }

  /** True when a chapter file exists at all (drives the "Segera" / "Sedang disusun" state). */
  const adaBerkas = (kunci: string) => ADA.has(kunci)

  /** Summary to show: the loaded chapter's own, falling back to the registry's one-liner. */
  function ringkasBab(bab: HelpBab): string {
    return isi.value[bab.key]?.ringkas ?? bab.ringkas
  }

  /** The search — walks only the readable chapters (guard 2). */
  function cari(q: string): HasilCari[] {
    return cariPanduan(babSaya.value, isi.value, q)
  }

  // Purge anything a previous session loaded that this user may not read, so a
  // stale chunk cannot be shown after switching accounts without a reload.
  watch(() => me.value?.id, () => {
    const mods = me.value?.modules
    isi.value = Object.fromEntries(
      Object.entries(isi.value).filter(([k]) => bolehKunci(k, mods)),
    ) as Record<string, Panduan>
    status.value = Object.fromEntries(
      Object.entries(status.value).filter(([k]) => bolehKunci(k, mods)),
    ) as Record<string, StatusBab>
  })

  return { me, babSaya, isi, status, pesan, muat, siapkan, adaBerkas, ringkasBab, cari }
}
