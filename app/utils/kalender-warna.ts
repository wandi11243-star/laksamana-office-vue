// One colour source for every month calendar (Marketing, Event, later Talent
// Schedule) and their legends. Owner decision, Nov 2026: NO solid colours for
// deals. A card keeps the colour of its SOURCE; a deal is marked only by a
// small green dot before the title. Class names are written out in full so
// Tailwind can see them.

export type SumberKalender = 'marketing' | 'ems' | 'reservasi' | 'talent' | 'libur' | 'ulangtahun'

export interface GayaSumber {
  label: string
  /** Card: left rule + soft fill + text colour. */
  kartu: string
  /** Legend swatch. */
  swatch: string
}

export const SUMBER_KALENDER: Record<SumberKalender, GayaSumber> = {
  marketing: { label: 'Event Marketing', kartu: 'border-primary-400 bg-primary-100 text-primary-900', swatch: 'bg-primary-400' },
  ems: { label: 'Acara EMS', kartu: 'border-vip bg-vip/12 text-vip', swatch: 'bg-vip' },
  reservasi: { label: 'Reservasi', kartu: 'border-success bg-success/10 text-success', swatch: 'bg-success' },
  talent: { label: 'Talent', kartu: 'border-error bg-error/12 text-error', swatch: 'bg-error' },
  libur: { label: 'Libur', kartu: 'border-default bg-muted text-muted', swatch: 'bg-muted ring-1 ring-default' },
  ulangtahun: { label: 'Ulang tahun', kartu: 'border-warning bg-warning/12 text-warning', swatch: 'bg-warning' },
}

/** The legend entry and tooltip of the deal dot. */
export const LABEL_DEAL = 'Deal / pasti jalan'

/** Marketing statuses that mean the event will certainly run. */
export const STATUS_DEAL_MKT = ['Deal', 'Confirmed']
/** EMS statuses that mean the event will certainly run (`Today` is an old row value). */
export const STATUS_DEAL_EMS = ['Upcoming', 'Today']

/** Does a card of this source and status get the green deal dot? */
export function adalahDeal(sumber: SumberKalender, status?: string | null): boolean {
  const s = String(status ?? '')
  if (sumber === 'marketing') return STATUS_DEAL_MKT.includes(s)
  if (sumber === 'ems') return STATUS_DEAL_EMS.includes(s)
  return false
}

/** Statuses that are not drawn unless the status filter picks them. */
export const STATUS_TERSEMBUNYI = ['Lost', 'Cancelled']

/** Default status filter: everything except Lost/Cancelled; a picked status shows exactly that. */
export const lolosSaringStatus = (status: string | null | undefined, pilihan: string) =>
  pilihan ? String(status ?? '') === pilihan : !STATUS_TERSEMBUNYI.includes(String(status ?? ''))

/** Talent categories: the tone of `nadaKategori` (status-event.ts) as a card style and a legend swatch. */
export const GAYA_NADA: Record<string, GayaSumber> = {
  info: { label: '', kartu: 'border-info bg-info/12 text-info', swatch: 'bg-info' },
  vip: { label: '', kartu: 'border-vip bg-vip/12 text-vip', swatch: 'bg-vip' },
  success: { label: '', kartu: 'border-success bg-success/10 text-success', swatch: 'bg-success' },
  warning: { label: '', kartu: 'border-warning bg-warning/12 text-warning', swatch: 'bg-warning' },
  error: { label: '', kartu: 'border-error bg-error/12 text-error', swatch: 'bg-error' },
  neutral: { label: '', kartu: 'border-default bg-muted text-muted', swatch: 'bg-muted ring-1 ring-default' },
}
/** The card style of a talent category (`nada` comes from `nadaKategori`). */
export const gayaNada = (nada: string): GayaSumber => GAYA_NADA[nada] ?? GAYA_NADA.neutral!
