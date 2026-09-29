// The status pill of a reservation, as the old Office drew it everywhere
// (deploy/reservasi/index.html STATUS_CLASS / STATUS_ICON): one colour and one
// icon per status, the word always beside them. One source for every screen.
export type WarnaStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const STATUS_WARNA: Record<string, WarnaStatus> = {
  'Pending': 'warning',
  'Confirmed': 'info',
  'Datang': 'success',
  'Completed': 'success',
  'Cancelled': 'neutral',
  'No-show': 'error',
}

export const STATUS_IKON: Record<string, string> = {
  'Pending': 'i-lucide-hourglass',
  'Confirmed': 'i-lucide-check',
  'Datang': 'i-lucide-map-pin',
  'Completed': 'i-lucide-check-check',
  'Cancelled': 'i-lucide-x',
  'No-show': 'i-lucide-user-x',
}
