import { getEsbSales } from '~/composables/useAnalytics'
import { EsbGagal, esbTarikRentang } from '~/utils/analytics-esb'
import { ringkasEsb } from '~/utils/cashier-esb'

/** Pull and summarize the complete set of one day's POS bills. */
export async function tarikCashierEsb(date: string, progress: (message: string) => void = () => {}) {
  const { bills, ganda } = await esbTarikRentang(async (page) => {
    try {
      return await getEsbSales(date, date, page)
    }
    catch (error) {
      throw new Error(apiErrorMessage(error))
    }
  }, progress, `ESB ${date}`)
  return { summary: ringkasEsb(bills), ganda }
}

export const pesanGagalEsb = (error: unknown) => {
  if (error instanceof EsbGagal) return error.message
  if (error instanceof Error && !('data' in error)) return error.message
  return apiErrorMessage(error)
}
