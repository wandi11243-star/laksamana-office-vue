// HPP engine for other modules — port of `laksamana-office/deploy/assets/hpp-mesin.js`
// (LMHppMesin), the factory the old Marketing › Menu Kalkulator used so it never
// copied the HPP formulas.
//
// The formulas themselves are NOT here: they live once in `app/utils/stock-hpp.ts`
// (the port of the HPP module). This file only does what the old factory added on
// top: the setting defaults merged with the stored setting, the old selling-price
// migration (harga_lama → harga_baru, same as muat() in the HPP module), and a
// small object bound to one lookup context.
import type { BahanHppHitung, HasilModal, KonteksHpp, ResepHitung, SettingHppHitung } from '~/utils/stock-hpp'
import { buatKonteks, cogsOf, hargaJual, modalMenu, modalPorsi, numHpp, porsiYield, prasmananKah } from '~/utils/stock-hpp'

export interface DataHppMesin {
  bahan?: BahanHppHitung[]
  resep?: ResepHitung[]
  setting?: SettingHppHitung | null
  /** Purchasing products (only needed for package-unit conversion — admin view). */
  produk?: { nama: string, satuanDasar?: string, isi?: Record<string, number> }[]
}

export interface HppMesin {
  resep: ResepHitung[]
  setting: SettingHppHitung
  ctx: KonteksHpp
  modalMenu: (r?: ResepHitung | null) => HasilModal & { bahan: number, spare: number, rate: number }
  modalPorsi: (r?: ResepHitung | null) => number
  hargaJual: (r?: ResepHitung | null) => number
  cogsOf: (r?: ResepHitung | null) => number | null
  porsiYield: (r?: ResepHitung | null) => number
  prasmananKah: (r?: ResepHitung | null) => boolean
}

/** The old factory's defaults (hpp-mesin.js:15) — not the HPP screen's, which add the traffic lights. */
export const SET_MESIN: SettingHppHitung = { targetFood: 0.33, targetDrink: 0.33, buffer: 0.05 }

export function hppMesin(data: DataHppMesin = {}): HppMesin {
  const setting: SettingHppHitung = { ...SET_MESIN, ...(data.setting ?? {}) }
  // Copies, not the caller's rows: the old code migrated in place, which here
  // would leak harga_baru into a cached API response.
  const resep = (data.resep ?? []).map((r) => {
    const c = { ...r }
    if (!numHpp(c.harga_baru) && numHpp(c.harga_lama)) c.harga_baru = numHpp(c.harga_lama)
    return c
  })
  const ctx = buatKonteks(data.bahan ?? [], resep, data.produk ?? [])
  return {
    resep,
    setting,
    ctx,
    modalMenu: r => modalMenu(ctx, r, setting.buffer),
    modalPorsi: r => modalPorsi(ctx, r, setting.buffer),
    hargaJual,
    cogsOf: r => cogsOf(ctx, r, setting.buffer),
    porsiYield,
    prasmananKah,
  }
}
