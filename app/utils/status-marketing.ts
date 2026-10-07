// Status pills of the Marketing module — one source for every screen (DESIGN.md
// rule 5). The old client drew each in its own CSS colour (CLIENT_STATUS,
// INV_STATUS, EVENT_COLOR, deploy/marketing/index.html:3555-3612); here the
// colour carries the shared meaning: waiting = warning, sent/in play = info or
// vip, won = success, lost = error, idle = neutral.
type Warna = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'vip' | 'gold'

const WARNA_EVENT: Record<string, Warna> = {
  'Lead': 'neutral',
  'Prospect': 'info',
  'Approval': 'warning',
  'Quotation Terkirim': 'vip',
  'Confirmed': 'gold',
  'Deal': 'success',
  'Event Done': 'success',
  'Lost': 'error',
}
const IKON_EVENT: Record<string, string> = {
  'Lead': 'i-lucide-sparkle',
  'Prospect': 'i-lucide-message-circle',
  'Approval': 'i-lucide-hourglass',
  'Quotation Terkirim': 'i-lucide-send',
  'Confirmed': 'i-lucide-badge-check',
  'Deal': 'i-lucide-handshake',
  'Event Done': 'i-lucide-flag',
  'Lost': 'i-lucide-circle-x',
}
export const warnaStatusMkt = (s: string): Warna => WARNA_EVENT[s] ?? 'neutral'
export const ikonStatusMkt = (s: string) => IKON_EVENT[s] ?? 'i-lucide-circle'

const WARNA_INV: Record<string, Warna> = { Draft: 'neutral', Sent: 'info', Pending: 'warning', Paid: 'success', Overdue: 'error' }
const IKON_INV: Record<string, string> = { Draft: 'i-lucide-file', Sent: 'i-lucide-send', Pending: 'i-lucide-hourglass', Paid: 'i-lucide-circle-check', Overdue: 'i-lucide-triangle-alert' }
export const warnaInvoiceMkt = (s: string): Warna => WARNA_INV[s] ?? 'neutral'
export const ikonInvoiceMkt = (s: string) => IKON_INV[s] ?? 'i-lucide-file'

/** Event type tags (EVENT_COLOR, :3604). "Lainnya" stays grey whatever was typed. */
const WARNA_JENIS: Record<string, Warna> = {
  'Private Party': 'error', 'Corporate Event': 'success', 'Wedding': 'info', 'Birthday': 'warning', 'Gathering': 'info',
  'Seminar': 'vip', 'Launching': 'gold', 'Competition': 'gold', 'Collaboration Event': 'info', 'Compliment': 'success', 'Lainnya': 'neutral',
}
export const warnaJenisMkt = (jenis?: string): Warna => WARNA_JENIS[jenis ?? ''] ?? 'neutral'
