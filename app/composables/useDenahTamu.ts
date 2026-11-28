// Guest seat picker (public, no login): the plan behind a denah link the
// WhatsApp bot hands out, and the guest's confirmed tables back into the chat.
// Contract: laksamana-api docs/api/automation.md "Guest seat picker".
import type { Envelope } from '~/composables/useApi'
import type { Reservasi } from '~/composables/useReservasi'
import type { MasterDenah } from '~/utils/venue-layouts'

export interface DenahTamu {
  date: string
  time: string
  /** Unix seconds; the link (and picking) dies after this. */
  expiresAt: number
  /** Guests the bot already knows about (0 = not asked yet). */
  pax: number
  /** True only for links minted for one chat; other links are view-only. */
  pick: boolean
  maxTables: number
  /** The bot's WhatsApp number (digits) for the "Kembali ke WhatsApp" button. */
  wa?: string
  master: MasterDenah & { dineEstMin?: number, clashLeadMin?: number }
  /** Bookings a day either side, without any guest detail (name is "Tamu"). */
  reservations: Reservasi[]
}

/** GET /automation/denah-data?t= — 410 expired, 403 invalid link. */
export async function ambilDenahTamu(t: string): Promise<DenahTamu> {
  const r = await useApi()<Envelope<DenahTamu>>('/automation/denah-data', { query: { t } })
  return r.data
}

/**
 * POST /automation/denah-pilih — 409 `taken` names the tables in `error.details.tables`;
 * 410 `used` = this link already sent a choice (one choice per link).
 */
export async function kirimPilihanMeja(t: string, tables: string[]): Promise<{ tables: string[], wa?: string }> {
  const r = await useApi()<Envelope<{ tables: string[], wa?: string }>>('/automation/denah-pilih', { method: 'POST', body: { t, tables } })
  return r.data
}
