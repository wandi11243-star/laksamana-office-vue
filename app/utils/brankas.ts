// The Brankas balance engine: wallet constants, the per-wallet balances and
// the investor helpers. Owned by the finance module (`brankas/` panel).
//
// The old Office had this twice — `aktGrup` here in brankas plus `rkHitung`
// in kas (finance.md F.20: one formula for one number). Vue keeps ONE source:
// the per-group `akt` comes from `hitungRekapHari` in `~/utils/kompas` (the
// same function Rekap Penjualan uses), and only the wallet mapping lives
// here. Differences from the legacy twin, all deliberate:
// - the 21 Aug 2026 direction (a typed Aktual replaces the computed one, the
//   typed excess MDR wins) applies here too, because it is the same function;
// - the `error` group is SKIPPED: legacy brankas never listed it (a mistype
//   note is not money in any wallet), while kas keeps it in its own recap;
// - the pre-Aug-2026 combined MDR keys (`RK_MDR_LAMA`) are not read back:
//   kas does not read them either, so both panels agree.
//
// Sources: laksamana-office/deploy/finance/brankas/index.html:670-730
// (wallets, RK_GRUP, MAP_BAWAAN), :940-1100 (aktGrup, saldoSemua),
// :1527-1540 (modalTotal, modalTanpaWadah).
import { hitungRekapHari, RK_GRUP, kNum, type BarisHarian } from '~/utils/kompas'

/** The five wallets: four banks plus the physical cash box. */
export const WADAH = [
  { k: 'bri', n: 'BRI' },
  { k: 'mandiri', n: 'Mandiri' },
  { k: 'bca', n: 'BCA' },
  { k: 'uob', n: 'UOB' },
  { k: 'cash', n: 'Cash / Brankas Fisik' },
] as const

export type WadahKey = 'bri' | 'mandiri' | 'bca' | 'uob' | 'cash'

export const SEMUA_WADAH: readonly string[] = WADAH.map(w => w.k)

/** Display name of a wallet key; unknown keys pass through. */
export const namaWallet = (k?: string) =>
  k === 'cash' ? 'Cash / Brankas Fisik' : (WADAH.find(w => w.k === k)?.n ?? String(k ?? '—'))

/**
 * Default payment-group → wallet map (user, 27 Aug 2026). QR Order, Gofood,
 * Grabfood and TikTok Go settle to UOB, like transfers. A default, not a
 * lock: `setting.peta` overrides it per group.
 */
export const MAP_BAWAAN: Record<string, string> = {
  cash: 'cash',
  edc_bri: 'bri',
  qris_bri: 'bri',
  edc_mandiri: 'mandiri',
  qris_mandiri: 'mandiri',
  edc_bca: 'bca',
  qris_bca: 'bca',
  transfer: 'uob',
  qr_order: 'uob',
  gofood: 'uob',
  grabfood: 'uob',
  tiktokgo: 'uob',
}

/** Brankas settings (`vault.setting`): opening balances, group map, burn. */
export interface SettingBrankas {
  awal?: Record<string, unknown>
  peta?: Record<string, unknown>
  burn?: unknown
  [k: string]: unknown
}

/** Effective wallet of each payment group (stored map wins over the default). */
export function petaGrupWallet(setting?: SettingBrankas | null): Record<string, string> {
  const s = setting?.peta ?? {}
  const out: Record<string, string> = {}
  for (const g of RK_GRUP) {
    if (g.k === 'error') continue
    const v = s[g.k]
    out[g.k] = v === undefined ? (MAP_BAWAAN[g.k] ?? '') : String(v || '')
  }
  return out
}

/** Groups whose money reaches no wallet — shown, never silently dropped. */
export function grupBelumDipetakan(setting?: SettingBrankas | null): { k: string, n: string }[] {
  const p = petaGrupWallet(setting)
  return RK_GRUP.filter(g => g.k !== 'error' && (!p[g.k] || !SEMUHAKAN(p[g.k] ?? '')))
    .map(g => ({ k: g.k, n: g.n }))
}

/** True when the key is one of the five wallets. */
function SEMUHAKAN(k: string) {
  return SEMUA_WADAH.includes(k)
}

/** Free-text deposit destination → wallet key; unknown stays unmapped. */
export function bankDariTujuan(tujuan?: string): string {
  const s = String(tujuan || '').toLowerCase()
  if (!s) return ''
  const b = WADAH.find(w => w.k !== 'cash' && s.includes(w.n.toLowerCase()))
  return b ? b.k : ''
}

export interface SetoranCash {
  id?: string
  tgl?: string
  tujuan?: string
  nominal?: unknown
  hari?: string[]
  catatan?: string
  [k: string]: unknown
}

export interface BayarBrankas {
  id?: string
  name?: string
  amount?: unknown
  status?: string
  dueDate?: string
  dari?: string
  [k: string]: unknown
}

export interface MutasiBrankas {
  id?: string
  tgl?: string
  jenis?: 'masuk' | 'keluar' | 'pindah' | string
  dari?: string
  ke?: string
  nominal?: unknown
  ket?: string
  by?: string
  [k: string]: unknown
}

export interface KembaliModal {
  date?: string
  amount?: unknown
  dari?: string
  by?: string
  [k: string]: unknown
}

export interface TambahanModal {
  id?: string
  date?: string
  amount?: unknown
  ke?: string
  ket?: string
  by?: string
  [k: string]: unknown
}

export interface InvestorBrankas {
  id?: string
  name?: string
  capital?: unknown
  ownership?: unknown
  targetDate?: string
  returns?: KembaliModal[]
  tambahan?: TambahanModal[]
  [k: string]: unknown
}

/** Total capital = opening capital + every later top-up (6 Oct 2026). */
export const modalTotal = (i: InvestorBrankas) =>
  kNum(i.capital) + (i.tambahan ?? []).reduce((s, t) => s + kNum(t.amount), 0)

/** Repayments that never named their source wallet — reported, never guessed. */
export function modalTanpaWadah(investor?: InvestorBrankas[] | null) {
  const out: { inv: string, r: KembaliModal }[] = []
  for (const i of investor ?? [])
    for (const r of i.returns ?? [])
      if (!r.dari || !SEMUA_WADAH.includes(r.dari)) out.push({ inv: String(i.name || '(tanpa nama)'), r })
  return out
}

export interface SaldoWadah {
  awal: number
  masuk: number
  setorMasuk: number
  setorKeluar: number
  mutMasuk: number
  mutKeluar: number
  keluar: number
  modal: number
  modalMasuk: number
  saldo: number
}

const wadahKosong = (): SaldoWadah => ({
  awal: 0, masuk: 0, setorMasuk: 0, setorKeluar: 0, mutMasuk: 0, mutKeluar: 0, keluar: 0, modal: 0, modalMasuk: 0, saldo: 0,
})

export interface MasukanSaldo {
  reports?: Record<string, BarisHarian> | null
  daily?: BarisHarian[] | null
  piutang?: { date?: string, status?: string, lunasDate?: string, nominal?: unknown }[] | null
  setoran?: SetoranCash[] | null
  bayar?: BayarBrankas[] | null
  mutasi?: MutasiBrankas[] | null
  investor?: InvestorBrankas[] | null
  setting?: SettingBrankas | null
}

/**
 * Total Aktual Masuk per payment group over every recorded day — what lets a
 * balance be reconciled with Rekap Penjualan row by row. `saldoSemua` maps
 * these same numbers into wallets; both read this one accumulation.
 */
export function aktualPerGrup(m: Pick<MasukanSaldo, 'reports' | 'daily' | 'piutang'>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of RK_GRUP) {
    if (g.k === 'error') continue
    out[g.k] = 0
  }
  const tgl = Object.keys(m.reports ?? {}).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t)).sort()
  const omset = new Map((m.daily ?? []).map(d => [String(d.date), d]))
  for (const t of tgl) {
    const r = hitungRekapHari((m.reports ?? {})[t] ?? null, omset.get(t) ?? null, m.piutang ?? null, t, null)
    for (const g of RK_GRUP) {
      if (g.k === 'error') continue
      out[g.k]! += r.g[g.k]?.akt ?? 0
    }
  }
  return out
}

/**
 * The balance of every wallet. ONE place — Ringkasan and Saldo & Rekening
 * both read it; two screens computing it themselves will disagree one day.
 */
export function saldoSemua(m: MasukanSaldo): Record<string, SaldoWadah> {
  const out: Record<string, SaldoWadah> = {}
  for (const k of SEMUA_WADAH) out[k] = wadahKosong()
  const awal = m.setting?.awal ?? {}
  for (const k of SEMUA_WADAH) out[k]!.awal = kNum((awal as Record<string, unknown>)[k])

  const peta = petaGrupWallet(m.setting)
  const tgl = Object.keys(m.reports ?? {}).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t)).sort()
  const omset = new Map((m.daily ?? []).map(d => [String(d.date), d]))
  for (const t of tgl) {
    const r = hitungRekapHari((m.reports ?? {})[t] ?? null, omset.get(t) ?? null, m.piutang ?? null, t, null)
    for (const g of RK_GRUP) {
      if (g.k === 'error') continue
      const w = peta[g.k]
      if (!w || !out[w]) continue // unmapped → reported separately, not forced in
      out[w]!.masuk += r.g[g.k]?.akt ?? 0
    }
  }

  // Setoran: physical cash moves from the box to the bank. The nominal is
  // computed by the server from the covered cash days — never recomputed here.
  for (const st of m.setoran ?? []) {
    const n = kNum(st.nominal)
    if (!n) continue
    const b = bankDariTujuan(st.tujuan)
    if (b && out[b]) out[b]!.setorMasuk += n
    out.cash!.setorKeluar += n
  }

  // Only PAID plans have left their source wallet; scheduled ones are plans.
  for (const p of m.bayar ?? []) {
    if (p.status !== 'paid') continue
    const w = p.dari && out[p.dari] ? p.dari : null
    if (w) out[w]!.keluar += kNum(p.amount)
  }

  // Wallet transfers: a `pindah` touches two wallets and nets to zero — that
  // is what keeps the liquid total still when money only moves.
  for (const u of m.mutasi ?? []) {
    const n = kNum(u.nominal)
    if (!n) continue
    if (u.jenis === 'masuk') {
      if (u.ke && out[u.ke]) out[u.ke]!.mutMasuk += n
    }
    else if (u.jenis === 'keluar') {
      if (u.dari && out[u.dari]) out[u.dari]!.mutKeluar += n
    }
    else if (u.jenis === 'pindah') {
      if (u.dari && out[u.dari]) out[u.dari]!.mutKeluar += n
      if (u.ke && out[u.ke]) out[u.ke]!.mutMasuk += n
    }
  }

  // Repayments leave the wallet named when recorded. Old rows without one are
  // NOT dropped into any wallet — report them instead (modalTanpaWadah).
  for (const i of m.investor ?? []) {
    for (const r of i.returns ?? []) {
      const w = r.dari && out[r.dari] ? r.dari : null
      if (w) out[w]!.modal += kNum(r.amount)
    }
    // Later top-ups arrive AFTER the opening balance, so they add to the
    // named wallet. Never record them again as "uang masuk dari luar".
    for (const t of i.tambahan ?? []) {
      if (t.ke && out[t.ke]) out[t.ke]!.modalMasuk += kNum(t.amount)
    }
  }

  for (const k of SEMUA_WADAH) {
    const o = out[k]!
    o.saldo = o.awal + o.masuk + o.setorMasuk + o.mutMasuk + o.modalMasuk
      - o.setorKeluar - o.mutKeluar - o.keluar - o.modal
  }
  return out
}

/** Days from today to an ISO date (negative = past). Null when unparseable. */export function selisihHari(iso?: string): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null
  const hari = new Date()
  const kini = `${hari.getFullYear()}-${String(hari.getMonth() + 1).padStart(2, '0')}-${String(hari.getDate()).padStart(2, '0')}`
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${kini}T00:00:00`).getTime()) / 86400000)
}
