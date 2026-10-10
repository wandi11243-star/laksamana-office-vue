// The Help chapter registry — the Vue successor of the old
// `deploy/help/panduan/daftar.js`. It does NOT own the access keys: every
// chapter copies its `izin` from `MODUL[].access` in app/utils/modul.ts, and
// `tools/uji-help.mjs` reds the moment the two drift apart. A second list of
// keys here would sooner or later let someone read a module's guide they may
// not open.
//
// Chapter visibility is decided at runtime by `babBoleh` against the user's
// `modules` (GET /me), exactly like the old `boleh()` read `lm_session.modules`.
import { KUNCI_NONAKTIF, MODUL } from '~/utils/modul'

export interface HelpGrup {
  key: string
  label: string
}

export interface HelpBab {
  /**
   * The access key from `MODUL[].access` that guards this chapter; `null` means
   * the chapter is open to everyone who may open Help (only the intro chapter).
   */
  izin: string | null
  /** The chapter key. MUST equal the data file name in utils/help/panduan/. */
  key: string
  /** The group key from HELP_GRUP. */
  grup: string
  label: string
  ringkas: string
  /**
   * This module is not registered in app/utils/modul.ts yet (analytics,
   * investor — PLAN.md §3 row #14). The chapter is ported and will appear as
   * soon as the module exists; until then the guard allows it to wait.
   */
  menunggu?: boolean
}

/** The groups, in the same order as the old portal (daftar.js LM_HELP_GRUP). */
export const HELP_GRUP: HelpGrup[] = [
  { key: 'panduan', label: 'Mulai Dari Sini' },
  { key: 'operasional', label: 'Operasional' },
  { key: 'tim', label: 'Tim & Kru' },
  { key: 'markom', label: 'Marketing & Event' },
  { key: 'bisnis', label: 'Bisnis & Target' },
  { key: 'lainnya', label: 'Lainnya' },
]

/** The 26 chapters, copied from the old daftar.js. Labels stay as they were. */
export const HELP_BAB: HelpBab[] = [
  { izin: null, key: 'portal', grup: 'panduan', label: 'Office & Cara Masuk',
    ringkas: 'Masuk ke Office, memilih modul, dan apa artinya kalau sebuah modul tidak muncul.' },

  { izin: 'reservasi', key: 'reservasi', grup: 'operasional', label: 'Reservasi',
    ringkas: 'Booking meja, data tamu, DP, dan denah meja.' },
  { izin: 'cashier', key: 'cashier', grup: 'operasional', label: 'Cashier',
    ringkas: 'Setoran, dana masuk, report daily, dan performa kasir.' },
  { izin: 'service_excellent', key: 'service_excellent', grup: 'operasional', label: 'Service Excellent',
    ringkas: 'Ajakan Google Review, verifikasi bukti, pujian & keluhan tamu.' },
  { izin: 'radar', key: 'radar', grup: 'operasional', label: 'Radar',
    ringkas: 'Papan koordinasi lintas modul: agenda, acara, dan reservasi VIP.' },
  { izin: 'ordering', key: 'ordering', grup: 'operasional', label: 'Stock, Ordering',
    ringkas: 'Input order bahan baku dan check-in penerimaan barang.' },
  { izin: 'purchasing', key: 'purchasing', grup: 'operasional', label: 'Stock, Purchasing',
    ringkas: 'Antrian order, daftar vendor, dan dispatch pembelian.' },
  { izin: 'tree', key: 'tree', grup: 'operasional', label: 'Stock, Pohon Resep',
    ringkas: 'Peta resep bertingkat dari bahan mentah sampai menu jadi.' },
  { izin: 'usage', key: 'usage', grup: 'operasional', label: 'Stock, Pemakaian Bahan Baku',
    ringkas: 'Catatan pemakaian, waste, dan serah terima bahan.' },
  { izin: 'hpp', key: 'hpp', grup: 'operasional', label: 'Stock, HPP & Resep',
    ringkas: 'Resep dapur, harga bahan, modal per menu, dan COGS.' },
  { izin: 'breakloss', key: 'breakloss', grup: 'operasional', label: 'Stock, Break & Loss',
    ringkas: 'Barang inventaris yang pecah atau hilang, berikut stok terkininya.' },

  { izin: 'jadwal', key: 'jadwal', grup: 'tim', label: 'Roster, Jadwal Shift',
    ringkas: 'Menyusun jadwal shift kru, pengajuan off, dan data pegawai.' },
  { izin: 'dw', key: 'dw', grup: 'tim', label: 'Roster, Daily Worker',
    ringkas: 'Permintaan daily worker, persetujuan HRD, dan konfirmasi kehadiran.' },
  { izin: 'absensi', key: 'absensi', grup: 'tim', label: 'Absensi',
    ringkas: 'Absen masuk dan pulang lewat HP, verifikasi lokasi dan wajah.' },
  { izin: 'akademi', key: 'akademi', grup: 'tim', label: 'Akademi',
    ringkas: 'Materi training kru dan catatan kelulusannya.' },
  { izin: 'hr', key: 'hr', grup: 'tim', label: 'Staff Performance',
    ringkas: 'Penilaian kru, catatan kinerja, dan rekap per divisi.' },

  { izin: 'marketing', key: 'marketing', grup: 'markom', label: 'Marketing',
    ringkas: 'CRM klien, pipeline, event, reservasi VIP, dan request desain.' },
  { izin: 'event', key: 'event', grup: 'markom', label: 'Event',
    ringkas: 'Perencanaan acara, talent, ticketing, dan check-in hari H.' },
  { izin: 'konten', key: 'konten', grup: 'markom', label: 'Konten',
    ringkas: 'Rencana konten, produksi, performa, dan iklan.' },

  { izin: 'kompas', key: 'kompas', grup: 'bisnis', label: 'Finance, Input Omset Harian',
    ringkas: 'Input omset harian, report daily, compliment, dan breakdown sumber.' },
  { izin: 'finance', key: 'finance', grup: 'bisnis', label: 'Finance, Kas Kecil & Rekap',
    ringkas: 'Buku kas kecil, rekap penjualan, dashboard omset, dan performa.' },
  { izin: 'brankas', key: 'brankas', grup: 'bisnis', label: 'Finance, Brankas',
    ringkas: 'Posisi kas per bank, piutang, mutasi wallet, dan pengembalian modal.' },
  { izin: 'analytics', key: 'analytics', grup: 'bisnis', label: 'Analytics', menunggu: true,
    ringkas: 'Analisa penjualan dari berkas POS: menu, jam, meja, promo, dan void.' },
  { izin: 'bd', key: 'bd', grup: 'bisnis', label: 'BD OS',
    ringkas: 'Bizdev, project, purchase order, dan mitra.' },
  { izin: 'investor', key: 'investor', grup: 'bisnis', label: 'Investor Compass', menunggu: true,
    ringkas: 'Halaman investor: omset, target, dan laporan keuangan bulanan.' },

  { izin: 'howandi_life', key: 'howandi_life', grup: 'lainnya', label: 'Howandi Life OS',
    ringkas: 'Pusat kendali pribadi Nahkoda.' },
]

/** The chapter key (`key`, never `izin` — the intro chapter has none). */
export function kunciBab(bab: HelpBab): string {
  return bab.key
}

/** The `help` key itself has no chapter: reading Help inside Help answers nothing. */
export const KUNCI_HELP = 'help'

/** Every access key declared in app/utils/modul.ts, de-duplicated. */
export function kunciModul(modul = MODUL): string[] {
  return [...new Set(modul.flatMap(m => m.access))]
}

/** True when the module behind this key has no old Office screen (homepage). */
export function tanpaBabLama(modul = MODUL): Set<string> {
  const out = new Set<string>()
  for (const m of modul) if (m.greenfield) for (const k of m.access) out.add(k)
  return out
}

/**
 * Compare the Help registry against app/utils/modul.ts. Replaces the old
 * `tools/uji-help.js` invariant:
 *   - `kurang`: a module key with no chapter (a new module Help forgot).
 *   - `asing`:  a chapter for a key that is not a module at all (a typo, or a
 *               chapter still waiting for its module — `menunggu`).
 * Pure and typed; `tools/uji-help.mjs` repeats it from source so it can run
 * without a build step.
 */
export function periksaRegistryHelp(
  modul = MODUL,
  bab = HELP_BAB,
): { kurang: string[], asing: string[], menunggu: string[] } {
  const izinBab = bab.filter(b => b.izin).map(b => b.izin!)
  const kunci = kunciModul(modul)
  const tanpa = tanpaBabLama(modul)
  const punyaBab = new Set(izinBab)
  const kurang = kunci.filter(k => k !== KUNCI_HELP && !tanpa.has(k) && !punyaBab.has(k))
  const asing: string[] = []
  const menunggu: string[] = []
  for (const b of bab) {
    if (!b.izin) continue
    if (kunci.includes(b.izin)) continue
    if (b.menunggu) menunggu.push(b.izin)
    else asing.push(b.izin)
  }
  return { kurang, asing, menunggu }
}

/**
 * The visibility rule, the same shape as the old `boleh()`:
 * a chapter without `izin` is open to everyone who may open Help; the rest
 * need their key, and `*` holds everything.
 */
export function babBoleh(bab: HelpBab, modules: string[] | null | undefined): boolean {
  if (!bab.izin) return true
  if (KUNCI_NONAKTIF.has(bab.izin)) return false
  const mods = modules ?? []
  return mods.includes('*') || mods.includes(bab.izin)
}

/** True when the user may read this chapter, by key. */
export function bolehKunci(kunci: string, modules: string[] | null | undefined): boolean {
  const bab = HELP_BAB.find(b => b.key === kunci)
  return !!bab && babBoleh(bab, modules)
}

/** The chapters this user may read, in registry order. */
export function babUntuk(modules: string[] | null | undefined): HelpBab[] {
  return HELP_BAB.filter(b => babBoleh(b, modules))
}
